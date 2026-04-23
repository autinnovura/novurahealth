'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  Home, TrendingUp, MessageCircle, DollarSign, Settings,
} from 'lucide-react'

const NAV_ITEMS = [
  { href: '/dashboard', icon: Home, label: 'Home' },
  { href: '/maintenance', icon: TrendingUp, label: 'Transition' },
  { href: '/chat', icon: MessageCircle, label: 'Nova' },
  { href: '/savings', icon: DollarSign, label: 'Savings' },
  { href: '/settings', icon: Settings, label: 'Settings' },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-[#EAF2EB] px-4 py-2.5 flex justify-around z-50">
      {NAV_ITEMS.map(item => {
        const active = pathname === item.href
        return (
          <Link key={item.label} href={item.href} className={`flex flex-col items-center gap-1 transition-all duration-300 ${active ? 'text-[#1F4B32]' : 'text-[#6B7A72]/40 hover:text-[#6B7A72]'}`}>
            <item.icon className="w-5 h-5" strokeWidth={1.5} />
            <span className="text-[10px] font-medium">{item.label}</span>
            {active && <div className="w-1 h-1 rounded-full bg-[#7FFFA4] shadow-[0_0_6px_2px_rgba(127,255,164,0.4)]" />}
          </Link>
        )
      })}
    </nav>
  )
}
