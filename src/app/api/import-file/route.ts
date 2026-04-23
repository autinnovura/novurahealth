import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import mammoth from 'mammoth'
import { getAuthedUser, unauthorized } from '../../lib/auth'
import { importLimiter, checkRateLimit } from '../../lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 300 // Vercel Pro allows up to 300s

const MODEL = 'claude-sonnet-4-5'
const MAX_TOKENS = 16000
const MAX_FILES = 10
const MAX_TEXT_CHARS = 80000

const EXTRACTION_SYSTEM_PROMPT = `You are a health data extraction assistant for NovuraHealth, a GLP-1 medication tracking app.

The user has uploaded one or more files containing their health tracking history — spreadsheets, PDFs, screenshots, exports from other apps, or handwritten notes.

Your job: extract EVERY data point you can find and return it as a single JSON object. Extract aggressively — err on the side of including data, even if incomplete.

CRITICAL: Return ONLY a valid JSON object. No prose, no markdown fences, no explanation. Your response must start with { and end with }.

Schema:
{
  "extracted": true,
  "summary": "short description of what you found",
  "weight_logs": [{"date": "YYYY-MM-DD", "weight": <number>, "unit": "lbs" | "kg"}],
  "food_logs": [{"date": "YYYY-MM-DD", "food_name": "<string>", "calories": <number|null>, "protein": <number|null>, "carbs": <number|null>, "fat": <number|null>}],
  "medication_logs": [{"date": "YYYY-MM-DD", "medication": "<string>", "dose": "<string>", "injection_site": "<string|null>"}],
  "water_logs": [{"date": "YYYY-MM-DD", "amount_oz": <number>}],
  "side_effect_logs": [{"date": "YYYY-MM-DD", "symptom": "<string>", "severity": <1-5>}],
  "exercise_logs": [{"date": "YYYY-MM-DD", "exercise_type": "<string>", "duration_min": <number|null>, "notes": "<string|null>"}]
}

Rules:
- Omit arrays that have no data.
- Dates must be YYYY-MM-DD. Convert 2-digit years correctly (24→2024, 25→2025, 26→2026).
- Assume lbs for weight and oz for water unless the source uses metric.
- If only daily averages are given (e.g. "Avg Cal/Day: 1550"), create ONE food_log entry for that date with food_name "Daily average" and the calorie/protein values.
- For side effects listed as strings ("Mild nausea", "Moderate GI discomfort"), use severity 2 for mild, 3 for moderate, 4 for severe.
- Include EVERY row visible. Do not summarize, sample, or skip rows.
- If the file contains no health data: {"extracted": false, "summary": "description of file contents"}`

export async function POST(req: NextRequest) {
  const user = await getAuthedUser()
  if (!user) return unauthorized()

  const { success: allowed } = await checkRateLimit(importLimiter, user.id)
  if (!allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded. Please slow down.' }, { status: 429 })
  }

  try {
    const formData = await req.formData()
    const userId = user.id

    // Accept both "file" (legacy, single) and "files" (multiple)
    const single = formData.get('file') as File | null
    const multi = formData.getAll('files') as File[]
    const files: File[] = multi.length > 0 ? multi : single ? [single] : []
    if (files.length === 0) {
      return NextResponse.json({ error: 'No files uploaded' }, { status: 400 })
    }
    if (files.length > MAX_FILES) {
      return NextResponse.json(
        { error: `Max ${MAX_FILES} files per upload. You sent ${files.length}.` },
        { status: 400 }
      )
    }

    // Process each file into the right Claude content block
    const content: any[] = []
    const textBlocks: string[] = []
    const skipped: string[] = []

    for (const file of files) {
      const result = await processFile(file)
      if (result.type === 'image') {
        content.push({
          type: 'image',
          source: { type: 'base64', media_type: result.mediaType, data: result.base64 },
        })
      } else if (result.type === 'pdf') {
        content.push({
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: result.base64 },
        })
      } else if (result.type === 'text') {
        textBlocks.push(`--- File: ${file.name} ---\n${result.text}`)
      } else if (result.type === 'skip') {
        skipped.push(`${file.name} (${result.reason})`)
      }
    }

    if (textBlocks.length > 0) {
      let combined = textBlocks.join('\n\n')
      if (combined.length > MAX_TEXT_CHARS) {
        combined = combined.slice(0, MAX_TEXT_CHARS) + '\n\n... [truncated — file too large]'
      }
      content.push({ type: 'text', text: `Extracted text from uploaded files:\n\n${combined}` })
    }

    if (content.length === 0) {
      return NextResponse.json({
        success: false,
        message: skipped.length
          ? `Couldn't read: ${skipped.join('; ')}`
          : 'No readable content found.',
      })
    }

    content.push({
      type: 'text',
      text: 'Extract ALL health data from the above file(s). Return ONLY the JSON object.',
    })

    // Call Claude
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: EXTRACTION_SYSTEM_PROMPT,
        messages: [{ role: 'user', content }],
      }),
    })

    if (!claudeRes.ok) {
      const errText = await claudeRes.text()
      console.error('Claude API error:', claudeRes.status, errText)
      return NextResponse.json(
        {
          success: false,
          message: `AI extraction failed (${claudeRes.status}). Please try again.`,
          debug: errText.slice(0, 500),
        },
        { status: 500 }
      )
    }

    const result = await claudeRes.json()

    // Combine ALL text blocks, not just the first
    const responseText = (result.content || [])
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('\n')

    if (!responseText) {
      return NextResponse.json({
        success: false,
        message: 'AI returned an empty response. Try again.',
        debug: JSON.stringify(result).slice(0, 500),
      })
    }

    const parsed = extractJSON(responseText)

    if (!parsed) {
      return NextResponse.json({
        success: false,
        message: "AI response wasn't valid JSON. Try again or use a cleaner file.",
        debug: responseText.slice(0, 500),
      })
    }

    if (!parsed.extracted) {
      return NextResponse.json({
        success: false,
        message: parsed.summary || 'No health data found in that file.',
      })
    }

    // Check stop_reason — if we got cut off, flag it
    const truncated = result.stop_reason === 'max_tokens'

    const counts: Record<string, number> = {}
    if (parsed.weight_logs?.length) counts.weight = parsed.weight_logs.length
    if (parsed.food_logs?.length) counts.food = parsed.food_logs.length
    if (parsed.medication_logs?.length) counts.medication = parsed.medication_logs.length
    if (parsed.water_logs?.length) counts.water = parsed.water_logs.length
    if (parsed.side_effect_logs?.length) counts.side_effects = parsed.side_effect_logs.length
    if (parsed.exercise_logs?.length) counts.exercise = parsed.exercise_logs.length
    const total = Object.values(counts).reduce((a, b) => a + b, 0)

    return NextResponse.json({
      success: true,
      message: `Found ${total} entries across ${files.length} file${files.length > 1 ? 's' : ''}. ${parsed.summary}`,
      data: parsed,
      counts,
      truncated,
      skipped: skipped.length ? skipped : undefined,
    })
  } catch (error: any) {
    console.error('Import error:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Something went wrong processing your file.',
        debug: error?.message,
      },
      { status: 500 }
    )
  }
}

// ── FILE PROCESSORS ──

type ProcessResult =
  | { type: 'image'; base64: string; mediaType: string }
  | { type: 'pdf'; base64: string }
  | { type: 'text'; text: string }
  | { type: 'skip'; reason: string }

async function processFile(file: File): Promise<ProcessResult> {
  const name = file.name.toLowerCase()
  const type = file.type
  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  // Images — send directly to Claude Vision
  if (type.startsWith('image/') || /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(name)) {
    let mediaType = type.startsWith('image/') ? type : 'image/jpeg'
    // Claude Vision doesn't support HEIC — client should convert, but flag here
    if (mediaType === 'image/heic' || mediaType === 'image/heif') {
      return { type: 'skip', reason: 'HEIC not supported, convert to JPG/PNG first' }
    }
    return { type: 'image', base64: buffer.toString('base64'), mediaType }
  }

  // PDF — Claude reads PDFs natively
  if (name.endsWith('.pdf') || type === 'application/pdf') {
    return { type: 'pdf', base64: buffer.toString('base64') }
  }

  // Excel — convert each sheet to CSV
  if (/\.(xlsx|xls|xlsm)$/i.test(name)) {
    try {
      const wb = XLSX.read(buffer, { type: 'buffer' })
      const texts: string[] = []
      for (const sheetName of wb.SheetNames) {
        const sheet = wb.Sheets[sheetName]
        const csv = XLSX.utils.sheet_to_csv(sheet)
        if (csv.trim()) texts.push(`Sheet: ${sheetName}\n${csv}`)
      }
      if (texts.length === 0) {
        return { type: 'skip', reason: 'Excel file had no readable sheets' }
      }
      return { type: 'text', text: texts.join('\n\n') }
    } catch (e: any) {
      return { type: 'skip', reason: `couldn't read Excel file: ${e?.message}` }
    }
  }

  // Word docs — extract raw text with mammoth
  if (/\.docx$/i.test(name)) {
    try {
      const { value } = await mammoth.extractRawText({ buffer })
      if (!value.trim()) {
        return { type: 'skip', reason: 'Word doc had no text content' }
      }
      return { type: 'text', text: value }
    } catch (e: any) {
      return { type: 'skip', reason: `couldn't read Word doc: ${e?.message}` }
    }
  }

  // CSV / TSV / plain text / markdown / JSON
  if (
    /\.(csv|tsv|txt|md|json)$/i.test(name) ||
    type.startsWith('text/') ||
    type === 'application/json'
  ) {
    return { type: 'text', text: buffer.toString('utf-8') }
  }

  return { type: 'skip', reason: `unsupported file type: ${type || 'unknown'}` }
}

// ── ROBUST JSON EXTRACTION ──

function extractJSON(text: string): any | null {
  // Strategy 1: direct parse
  try {
    return JSON.parse(text.trim())
  } catch {}

  // Strategy 2: strip markdown code fences
  const stripped = text.replace(/```json\s*|\s*```/g, '').trim()
  try {
    return JSON.parse(stripped)
  } catch {}

  // Strategy 3: find first { and last } — handles preamble/postamble
  const first = stripped.indexOf('{')
  const last = stripped.lastIndexOf('}')
  if (first !== -1 && last > first) {
    try {
      return JSON.parse(stripped.slice(first, last + 1))
    } catch {}
  }

  return null
}