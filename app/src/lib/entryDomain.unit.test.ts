import { describe, expect, it, vi } from 'vitest'
import {
  calculateStreak,
  ENTRY_MIN_LENGTH,
  getDateKey,
  getRecentPeriodCount,
  getStreakTitle,
  loadEntries,
  STORAGE_KEY,
  validateEntryContent,
  type EntryByDate,
} from './entryDomain'

function makeEntry(content: string): { content: string; createdAt: string; updatedAt: string } {
  return {
    content,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  }
}

describe('entryDomain.validateEntryContent', () => {
  it('returns error for too-short content', () => {
    const result = validateEntryContent('짧다')
    expect(result).toContain(`${ENTRY_MIN_LENGTH}`)
  })

  it('returns null for valid length content', () => {
    const result = validateEntryContent('유효한 기록 내용입니다')
    expect(result).toBeNull()
  })

  it('accepts content longer than 300 characters', () => {
    const longText = 'a'.repeat(301)

    expect(validateEntryContent(longText)).toBeNull()
  })
})

describe('entryDomain.calculateStreak', () => {
  it('uses one monthly grace for current streak calculation', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-10T03:00:00.000Z'))

    const todayKey = getDateKey(new Date('2026-08-10T03:00:00.000Z'))
    const twoDaysAgoKey = getDateKey(new Date('2026-08-08T03:00:00.000Z'))

    const entries: EntryByDate = {
      [todayKey]: makeEntry('오늘 기록은 충분히 길게 작성합니다'),
      [twoDaysAgoKey]: makeEntry('이틀 전 기록도 충분한 길이입니다'),
    }

    const result = calculateStreak(entries)

    expect(result.currentStreak).toBe(2)
    expect(result.monthlyGraceUsed).toBe(true)
  })

  it('returns zero streaks when no entries exist', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-10T03:00:00.000Z'))

    const result = calculateStreak({})

    expect(result.currentStreak).toBe(0)
    expect(result.bestStreak).toBe(0)
    expect(result.monthlyGraceUsed).toBe(false)
  })
})

describe('entryDomain.getStreakTitle', () => {
  it('returns the highest title reached by the current streak', () => {
    expect(getStreakTitle(0).title).toBe('기록의 시작')
    expect(getStreakTitle(7).title).toBe('일주일 기록자')
    expect(getStreakTitle(99).title).toBe('한 달의 주인공')
    expect(getStreakTitle(100).title).toBe('기록의 장인')
  })
})

describe('entryDomain.getRecentPeriodCount', () => {
  it('counts entries inside recent day window', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-10T03:00:00.000Z'))

    const today = getDateKey(new Date('2026-08-10T03:00:00.000Z'))
    const yesterday = getDateKey(new Date('2026-08-09T03:00:00.000Z'))
    const old = getDateKey(new Date('2026-07-20T03:00:00.000Z'))

    const entries: EntryByDate = {
      [today]: makeEntry('오늘 기록입니다. 충분한 길이를 채웠습니다.'),
      [yesterday]: makeEntry('어제 기록도 충분한 길이로 작성했습니다.'),
      [old]: makeEntry('오래된 기록입니다.'),
    }

    expect(getRecentPeriodCount(entries, 7)).toBe(2)
  })
})

describe('entryDomain.loadEntries', () => {
  it('removes blocked default gibberish text from saved entries', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        '2026-08-08': makeEntry('ㄴㅁㄴㅁㅇㅁㅇㅁㅇㅁㄴㅇㅁㄴㅇ'),
        '2026-08-09': makeEntry('정상 내용입니다'),
      }),
    )

    const loaded = loadEntries()

    expect(loaded['2026-08-08']).toBeUndefined()
    expect(loaded['2026-08-09']?.content).toBe('정상 내용입니다')
  })
})
