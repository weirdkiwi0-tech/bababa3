export type Entry = {
  content: string
  createdAt: string
  updatedAt: string
  entryMode?: 'simple' | 'quality'
  authorId?: string
  qualitySnapshot?: {
    title: string
    body: string
      backgroundColor?: string
    templateId: string
    textAlign: 'left' | 'center' | 'right'
    titleBlock: {
      x: number
      y: number
      scale: number
    }
    bodyBlock: {
      x: number
      y: number
      scale: number
    }
    stickers?: Array<{
      id: string
      presetId: string
      x: number
      y: number
      scale: number
    }>
  }
}

export type EntryByDate = Record<string, Entry>

export type DiaryDesign = {
  templateId: string
  paperStyle: string
  coverStyle: string
  color: string
}

export type DiaryDesignByDate = Record<string, DiaryDesign>

export const STORAGE_KEY = 'harucheck.entries.v1'
export const USER_KEY = 'harucheck.anonymousUserId.v1'
export const DIARY_DESIGN_KEY = 'harucheck.diaryDesignByDate.v1'
export const APP_TIME_ZONE = 'Asia/Seoul'
export const ENTRY_MIN_LENGTH = 10
export const STREAK_TITLES = [
  { days: 0, title: '기록의 시작' },
  { days: 3, title: '작은 습관의 시작' },
  { days: 7, title: '일주일 기록자' },
  { days: 14, title: '꾸준함의 증거' },
  { days: 30, title: '한 달의 주인공' },
  { days: 100, title: '기록의 장인' },
] as const
const BLOCKED_DEFAULT_TEXT = 'ㄴㅁㄴㅁㅇㅁㅇㅁㅇㅁㄴㅇㅁㄴㅇ'

const dateFormatter = new Intl.DateTimeFormat('sv-SE', {
  timeZone: APP_TIME_ZONE,
})

export function getDateKey(date: Date): string {
  return dateFormatter.format(date)
}

function getMonthKey(dateKey: string): string {
  return dateKey.slice(0, 7)
}

function parseDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function toISO(date: Date): string {
  return date.toISOString()
}

function shiftDays(base: Date, amount: number): Date {
  const next = new Date(base)
  next.setDate(next.getDate() + amount)
  return next
}

export function loadEntries(): EntryByDate {
  const raw = localStorage.getItem(STORAGE_KEY)

  if (!raw) {
    return {}
  }

  try {
    const parsed = JSON.parse(raw) as EntryByDate
    const sanitized = Object.fromEntries(
      Object.entries(parsed)
        .map(([dateKey, entry]) => {
          const cleanedContent = entry.content.replaceAll(BLOCKED_DEFAULT_TEXT, '').trim()

          if (!cleanedContent) {
            return null
          }

          return [
            dateKey,
            {
              ...entry,
              content: cleanedContent,
            },
          ] as const
        })
        .filter((value): value is readonly [string, Entry] => value !== null),
    )

    if (JSON.stringify(parsed) !== JSON.stringify(sanitized)) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized))
    }

    return sanitized
  } catch {
    return {}
  }
}

export function saveEntries(entries: EntryByDate): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
}

export function loadDiaryDesigns(): DiaryDesignByDate {
  const raw = localStorage.getItem(DIARY_DESIGN_KEY)

  if (!raw) {
    return {}
  }

  try {
    return JSON.parse(raw) as DiaryDesignByDate
  } catch {
    return {}
  }
}

export function saveDiaryDesigns(designs: DiaryDesignByDate): void {
  localStorage.setItem(DIARY_DESIGN_KEY, JSON.stringify(designs))
}

export function getOrCreateAnonymousUserId(): string {
  const stored = localStorage.getItem(USER_KEY)

  if (stored) {
    return stored
  }

  const generated =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `anon-${Math.random().toString(36).slice(2, 10)}`

  localStorage.setItem(USER_KEY, generated)
  return generated
}

export function validateEntryContent(content: string): string | null {
  const trimmed = content.trim()

  if (trimmed.length < ENTRY_MIN_LENGTH) {
    return `기록은 ${ENTRY_MIN_LENGTH}자 이상 입력해주세요.`
  }

  return null
}

export function getStreakTitle(streak: number): (typeof STREAK_TITLES)[number] {
  return STREAK_TITLES.reduce((current, candidate) => {
    return candidate.days <= streak && candidate.days >= current.days ? candidate : current
  }, STREAK_TITLES[0])
}

export function calculateStreak(entries: EntryByDate): {
  currentStreak: number
  bestStreak: number
  monthlyGraceUsed: boolean
} {
  const keys = Object.keys(entries).sort()

  if (keys.length === 0) {
    return { currentStreak: 0, bestStreak: 0, monthlyGraceUsed: false }
  }

  const entrySet = new Set(keys)
  const today = new Date()
  const todayKey = getDateKey(today)

  let cursor = new Date(today)
  let currentStreak = 0
  const graceUsedByMonth = new Set<string>()
  let monthlyGraceUsed = false

  while (true) {
    const cursorKey = getDateKey(cursor)

    if (entrySet.has(cursorKey)) {
      currentStreak += 1
      cursor = shiftDays(cursor, -1)
      continue
    }

    const monthKey = getMonthKey(cursorKey)
    if (!graceUsedByMonth.has(monthKey)) {
      graceUsedByMonth.add(monthKey)
      if (monthKey === getMonthKey(todayKey)) {
        monthlyGraceUsed = true
      }
      cursor = shiftDays(cursor, -1)
      continue
    }

    break
  }

  const first = parseDateKey(keys[0])
  let run = 0
  let bestStreak = 0
  const historicalGrace = new Set<string>()
  let day = new Date(first)

  while (getDateKey(day) <= todayKey) {
    const key = getDateKey(day)

    if (entrySet.has(key)) {
      run += 1
      if (run > bestStreak) {
        bestStreak = run
      }
    } else {
      const monthKey = getMonthKey(key)
      if (!historicalGrace.has(monthKey)) {
        historicalGrace.add(monthKey)
      } else {
        run = 0
      }
    }

    day = shiftDays(day, 1)
  }

  return { currentStreak, bestStreak, monthlyGraceUsed }
}

export function getRecentPeriodCount(entries: EntryByDate, days: number): number {
  const today = new Date()
  const entrySet = new Set(Object.keys(entries))
  let count = 0

  for (let i = 0; i < days; i += 1) {
    const day = shiftDays(today, -i)
    const dayKey = getDateKey(day)
    if (entrySet.has(dayKey)) {
      count += 1
    }
  }

  return count
}

export function getCurrentMonthDays(): Array<{ key: string; dateNumber: number }> {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const first = new Date(year, month, 1)
  const last = new Date(year, month + 1, 0)

  const result: Array<{ key: string; dateNumber: number }> = []
  for (let d = first.getDate(); d <= last.getDate(); d += 1) {
    const date = new Date(year, month, d)
    result.push({ key: getDateKey(date), dateNumber: d })
  }

  return result
}