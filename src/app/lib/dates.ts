import { format as fmt, startOfDay as sod } from 'date-fns'

export function localDateKey(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return fmt(d, 'yyyy-MM-dd')
}

export function isSameLocalDay(a: Date | string, b: Date | string): boolean {
  return localDateKey(a) === localDateKey(b)
}

export function startOfLocalDay(date: Date): Date {
  return sod(date)
}
