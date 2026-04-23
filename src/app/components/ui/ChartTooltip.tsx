'use client'

import { ReactNode } from 'react'

interface ChartTooltipProps {
  active?: boolean
  payload?: Array<{ payload: Record<string, unknown> }>
  children: (data: Record<string, unknown>) => ReactNode
}

export default function ChartTooltip({ active, payload, children }: ChartTooltipProps) {
  if (!active || !payload?.length) return null
  const data = payload[0].payload
  return (
    <div
      className="bg-white/95 backdrop-blur-md border border-[#EAF2EB] rounded-2xl shadow-lg p-3 min-w-[160px] animate-[tooltipFadeIn_150ms_ease-out]"
      style={{ pointerEvents: 'none' }}
    >
      {children(data)}
    </div>
  )
}
