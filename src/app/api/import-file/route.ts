import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    const userId = formData.get('userId') as string

    if (!file || !userId) {
      return NextResponse.json({ error: 'Missing file or userId' }, { status: 400 })
    }

    const fileName = file.name.toLowerCase()
    const fileType = file.type
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    let extractedText = ''
    let isImage = false

    // ── ROUTE BY FILE TYPE ──

    // Images → send directly to Claude Vision
    if (fileType.startsWith('image/')) {
      isImage = true
    }

    // CSV / TSV → parse as text
    else if (fileName.endsWith('.csv') || fileName.endsWith('.tsv') || fileType === 'text/csv') {
      extractedText = buffer.toString('utf-8')
      // Truncate if massive
      if (extractedText.length > 15000) {
        extractedText = extractedText.slice(0, 15000) + '\n... [truncated — file too large, showing first 15000 chars]'
      }
    }

    // Plain text / markdown
    else if (fileType.startsWith('text/') || fileName.endsWith('.txt') || fileName.endsWith('.md')) {
      extractedText = buffer.toString('utf-8')
      if (extractedText.length > 15000) {
        extractedText = extractedText.slice(0, 15000) + '\n... [truncated]'
      }
    }

    // JSON
    else if (fileName.endsWith('.json') || fileType === 'application/json') {
      extractedText = buffer.toString('utf-8')
      if (extractedText.length > 15000) {
        extractedText = extractedText.slice(0, 15000) + '\n... [truncated]'
      }
    }

    // PDF → send as document to Claude
    else if (fileName.endsWith('.pdf') || fileType === 'application/pdf') {
      // Claude can read PDFs natively via base64 document type
      const base64 = buffer.toString('base64')
      return await sendToClaudePDF(base64, userId)
    }

    // Excel / Spreadsheets → convert to CSV text server-side
    else if (
      fileName.endsWith('.xlsx') || fileName.endsWith('.xls') ||
      fileType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      fileType === 'application/vnd.ms-excel'
    ) {
      // Use a simple approach: send as base64 to Claude with instruction to parse
      // Claude can handle spreadsheet data if we describe it
      extractedText = `[Excel file uploaded: ${file.name}, size: ${buffer.length} bytes. Unable to parse directly — please use CSV export instead, or upload a screenshot of the spreadsheet.]`
      
      // Try to parse with SheetJS-style approach via dynamic import
      try {
        // We'll send the base64 to Claude as a document and let it try
        const base64 = buffer.toString('base64')
        return await sendToClaudePDF(base64, userId, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      } catch {
        // Fall through to text-based extraction
      }
    }

    // Word docs
    else if (
      fileName.endsWith('.docx') || fileName.endsWith('.doc') ||
      fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      fileType === 'application/msword'
    ) {
      const base64 = buffer.toString('base64')
      return await sendToClaudePDF(base64, userId, fileType)
    }

    // Unsupported
    else {
      return NextResponse.json({
        success: false,
        message: `File type not supported: ${fileType || fileName}. Try uploading a screenshot, CSV, PDF, or text file.`
      })
    }

    // ── HANDLE IMAGE ──
    if (isImage) {
      const base64 = buffer.toString('base64')
      return await sendToClaudeVision(base64, fileType, userId)
    }

    // ── HANDLE TEXT-BASED FILES ──
    if (extractedText) {
      return await sendToClaudeText(extractedText, file.name, userId)
    }

    return NextResponse.json({ success: false, message: 'Could not process the file.' })

  } catch (error) {
    console.error('File import error:', error)
    return NextResponse.json({ success: false, message: 'Something went wrong processing your file.' }, { status: 500 })
  }
}

const EXTRACTION_SYSTEM_PROMPT = `You are a health data extraction assistant for NovuraHealth, a GLP-1 medication tracking app.

The user has uploaded a file containing their previous health tracking data (from a spreadsheet, another app, PDF report, handwritten notes, etc.).

Your job is to extract ALL health data and return it as a JSON object. Extract whatever is present — don't ask for clarification.

Return ONLY a valid JSON object (no markdown, no backticks, no explanation) with this structure:
{
  "extracted": true,
  "summary": "Brief description of what you found",
  "weight_logs": [{"date": "YYYY-MM-DD", "weight": number, "unit": "lbs" or "kg"}],
  "food_logs": [{"date": "YYYY-MM-DD", "food_name": "string", "calories": number or null, "protein": number or null, "carbs": number or null, "fat": number or null}],
  "medication_logs": [{"date": "YYYY-MM-DD", "medication": "string", "dose": "string", "injection_site": "string or null"}],
  "water_logs": [{"date": "YYYY-MM-DD", "amount_oz": number}],
  "side_effect_logs": [{"date": "YYYY-MM-DD", "symptom": "string", "severity": 1-5}],
  "exercise_logs": [{"date": "YYYY-MM-DD", "exercise_type": "string", "duration_min": number or null, "notes": "string or null"}]
}

Rules:
- Only include arrays that have data. Omit empty categories.
- Dates in YYYY-MM-DD format. Assume current year if not specified.
- Assume lbs for weight, oz for water if units aren't specified.
- Be thorough — extract every row/entry visible.
- If no health data found: {"extracted": false, "summary": "Description of what the file contains"}`

async function sendToClaudeVision(base64: string, mediaType: string, userId: string) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY || '',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      system: EXTRACTION_SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
          { type: 'text', text: 'Extract all health data from this image.' }
        ]
      }]
    }),
  })
  return parseClaudeResponse(await res.json())
}

async function sendToClaudePDF(base64: string, userId: string, mediaType: string = 'application/pdf') {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY || '',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      system: EXTRACTION_SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: [
          { type: 'document', source: { type: 'base64', media_type: mediaType, data: base64 } },
          { type: 'text', text: 'Extract all health data from this document.' }
        ]
      }]
    }),
  })
  return parseClaudeResponse(await res.json())
}

async function sendToClaudeText(text: string, fileName: string, userId: string) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY || '',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      system: EXTRACTION_SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `File: ${fileName}\n\nContents:\n${text}\n\nExtract all health data from this file.`
      }]
    }),
  })
  return parseClaudeResponse(await res.json())
}

function parseClaudeResponse(result: any) {
  const responseText = result.content?.[0]?.text || '{}'

  let parsed
  try {
    const clean = responseText.replace(/```json|```/g, '').trim()
    parsed = JSON.parse(clean)
  } catch {
    return NextResponse.json({
      success: false,
      message: "Couldn't parse health data from that file. Try a different format or a screenshot.",
      raw: responseText
    })
  }

  if (!parsed.extracted) {
    return NextResponse.json({
      success: false,
      message: parsed.summary || "No health data found in that file.",
    })
  }

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
    message: `Found ${total} entries: ${parsed.summary}`,
    data: parsed,
    counts,
  })
}
