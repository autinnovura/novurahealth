'use client'

import { useState, useRef } from 'react'

const ACCEPTED_TYPES = 'image/*,application/pdf,.csv,.tsv,.txt,.md,.json,.xlsx,.xls,.xlsm,.docx'
const MAX_FILES = 10

interface ImportResponse {
  success: boolean
  message: string
  counts?: Record<string, number>
  saved?: Record<string, number>
  saveErrors?: string[]
  truncated?: boolean
  skipped?: string[]
  debug?: string
}

export default function DataImport({ userId }: { userId: string }) {
  const [files, setFiles] = useState<File[]>([])
  const [status, setStatus] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle')
  const [result, setResult] = useState<ImportResponse | null>(null)
  const [showDebug, setShowDebug] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)

  function addFiles(incoming: FileList | null) {
    if (!incoming) return
    const next = [...files]
    for (let i = 0; i < incoming.length; i++) {
      if (next.length >= MAX_FILES) break
      next.push(incoming[i])
    }
    setFiles(next)
    if (fileRef.current) fileRef.current.value = ''
    if (cameraRef.current) cameraRef.current.value = ''
  }

  function removeFile(index: number) {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  async function handleUpload() {
    if (files.length === 0) return
    setStatus('uploading')
    setResult(null)

    const formData = new FormData()
    formData.append('userId', userId)
    for (const f of files) {
      formData.append('files', f)
    }

    try {
      const res = await fetch('/api/import-data', { method: 'POST', body: formData })
      const data: ImportResponse = await res.json()
      setResult(data)

      if (data.success) {
        setStatus('done')
        setTimeout(() => window.location.reload(), 2500)
      } else {
        setStatus('error')
      }
    } catch {
      setResult({ success: false, message: 'Network error. Please try again.' })
      setStatus('error')
    }
  }

  function reset() {
    setFiles([])
    setStatus('idle')
    setResult(null)
    setShowDebug(false)
    if (fileRef.current) fileRef.current.value = ''
    if (cameraRef.current) cameraRef.current.value = ''
  }

  return (
    <div className="bg-white border border-[#EDEDEA] rounded-xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-full bg-[#E8F0EB] flex items-center justify-center">
          <svg className="w-4 h-4 text-[#2D5A3D]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-[#1E1E1C]">Import Data</h3>
          <p className="text-[10px] text-[#B0B0A8]">Screenshots, PDFs, spreadsheets, CSV, Word docs</p>
        </div>
      </div>

      {/* File inputs (hidden) */}
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPTED_TYPES}
        multiple
        className="hidden"
        onChange={e => addFiles(e.target.files)}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={e => addFiles(e.target.files)}
      />

      {/* Idle + file selection */}
      {(status === 'idle' || status === 'error') && (
        <div className="space-y-3">
          {/* Buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => fileRef.current?.click()}
              className="flex-1 bg-[#2D5A3D] text-white py-3 rounded-xl text-sm font-semibold cursor-pointer hover:bg-[#3A7A52] transition-colors"
            >
              Choose Files
            </button>
            <button
              onClick={() => cameraRef.current?.click()}
              className="px-4 bg-[#F5F5F2] text-[#6B6B65] py-3 rounded-xl text-sm font-semibold cursor-pointer hover:bg-[#EDEDEA] transition-colors"
            >
              Camera
            </button>
          </div>

          {/* Selected file list */}
          {files.length > 0 && (
            <div className="space-y-1.5">
              {files.map((f, i) => (
                <div key={`${f.name}-${i}`} className="flex items-center justify-between bg-[#F5F5F2] rounded-lg px-3 py-2">
                  <span className="text-xs text-[#1E1E1C] truncate flex-1 mr-2">{f.name}</span>
                  <button
                    onClick={() => removeFile(i)}
                    className="text-[#B0B0A8] hover:text-red-500 transition-colors shrink-0 cursor-pointer"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
              <p className="text-[10px] text-[#B0B0A8]">{files.length}/{MAX_FILES} files selected</p>

              <button
                onClick={handleUpload}
                className="w-full bg-[#2D5A3D] text-white py-3 rounded-xl text-sm font-semibold cursor-pointer hover:bg-[#3A7A52] transition-colors"
              >
                Import {files.length} File{files.length > 1 ? 's' : ''}
              </button>
            </div>
          )}

          {/* Error state */}
          {status === 'error' && result && (
            <div className="space-y-2">
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-xs text-red-700">{result.message}</p>
              </div>
              {result.debug && (
                <div>
                  <button
                    onClick={() => setShowDebug(!showDebug)}
                    className="text-[10px] text-[#B0B0A8] underline cursor-pointer"
                  >
                    {showDebug ? 'Hide' : 'Show'} debug info
                  </button>
                  {showDebug && (
                    <pre className="mt-1 bg-[#F5F5F2] rounded-lg p-2 text-[10px] text-[#6B6B65] overflow-x-auto max-h-32 whitespace-pre-wrap">
                      {result.debug}
                    </pre>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Uploading */}
      {status === 'uploading' && (
        <div className="flex items-center gap-3 py-4">
          <div className="w-5 h-5 border-2 border-[#2D5A3D] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[#6B6B65]">Reading and importing your data...</p>
        </div>
      )}

      {/* Done */}
      {status === 'done' && result && (
        <div className="space-y-3">
          <div className="bg-[#E8F0EB] rounded-lg p-3 flex items-center gap-2">
            <svg className="w-5 h-5 text-[#2D5A3D] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <p className="text-sm text-[#2D5A3D] font-medium">{result.message}</p>
          </div>

          {/* Per-category counts */}
          {result.saved && Object.keys(result.saved).length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(result.saved).map(([key, count]) => (
                <div key={key} className="bg-[#E8F0EB] rounded-lg p-2 text-center">
                  <p className="text-lg font-bold text-[#2D5A3D]">{count}</p>
                  <p className="text-[9px] text-[#2D5A3D]/70 uppercase font-semibold">{key}</p>
                </div>
              ))}
            </div>
          )}

          {/* Truncation warning */}
          {result.truncated && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-xs text-amber-700">
                AI response was truncated — some data may be missing. Try uploading fewer files or splitting large spreadsheets.
              </p>
            </div>
          )}

          {/* Skipped files */}
          {result.skipped && result.skipped.length > 0 && (
            <p className="text-xs text-[#B0B0A8]">Skipped: {result.skipped.join(', ')}</p>
          )}

          {/* Save errors */}
          {result.saveErrors && result.saveErrors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-2">
              <p className="text-[10px] text-red-600 font-medium">Some data failed to save:</p>
              {result.saveErrors.map((err, i) => (
                <p key={i} className="text-[10px] text-red-500">{err}</p>
              ))}
            </div>
          )}

          <p className="text-[10px] text-[#B0B0A8] text-center">Refreshing page...</p>
        </div>
      )}
    </div>
  )
}
