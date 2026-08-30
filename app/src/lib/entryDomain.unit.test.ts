import { describe, expect, it, vi } from 'vitest'
import {
  ALLOWED_IMAGE_MIME_TYPES,
  ALLOWED_VIDEO_MIME_TYPES,
  calculateStreak,
  canAddAttachment,
  canDeleteEntry,
  canEditEntry,
  ENTRY_MIN_LENGTH,
  formatHistoryDate,
  getDateKey,
  getRecentPeriodCount,
  getStreakTitle,
  loadEntries,
  MAX_ATTACHMENT_COUNT_PER_ENTRY,
  MAX_IMAGE_SIZE_MB,
  MAX_VIDEO_SIZE_MB,
  STORAGE_KEY,
  validateEntryContent,
  validateMediaAttachment,
  type Entry,
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

  it('does not consume grace after an uninterrupted current streak', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-10T03:00:00.000Z'))

    const todayKey = getDateKey(new Date('2026-08-10T03:00:00.000Z'))
    const yesterdayKey = getDateKey(new Date('2026-08-09T03:00:00.000Z'))
    const entries: EntryByDate = {
      [todayKey]: makeEntry('오늘 기록입니다. 충분한 길이로 작성했습니다.'),
      [yesterdayKey]: makeEntry('어제 기록입니다. 충분한 길이로 작성했습니다.'),
    }

    const result = calculateStreak(entries)

    expect(result.currentStreak).toBe(2)
    expect(result.monthlyGraceUsed).toBe(false)
  })

  // TS-101: 월 경계(8/31 -> 9/1)에서 currentStreak가 끊기지 않고, monthlyGraceUsed는 새 달 기준으로 리셋되어야 한다.
  it('keeps current streak continuous across a month boundary and resets grace flag for the new month', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-01T03:00:00.000Z'))

    const aug31Key = getDateKey(new Date('2026-08-31T03:00:00.000Z'))
    const sep01Key = getDateKey(new Date('2026-09-01T03:00:00.000Z'))

    const entries: EntryByDate = {
      [aug31Key]: makeEntry('8월 31일 기록입니다. 충분한 길이로 작성했습니다.'),
      [sep01Key]: makeEntry('9월 1일 기록입니다. 충분한 길이로 작성했습니다.'),
    }

    const result = calculateStreak(entries)

    expect(result.currentStreak).toBe(2)
    expect(result.monthlyGraceUsed).toBe(false)
  })

  // TS-102: 윤년(2028-02-29)이 하루로 정상 처리되고, 다음날(2028-03-01)과의 연속성이 유지되어야 한다.
  it('treats a leap day as a single day and keeps streak continuous into the next month', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2028-03-01T03:00:00.000Z'))

    const leapDayKey = getDateKey(new Date('2028-02-29T03:00:00.000Z'))
    const marchFirstKey = getDateKey(new Date('2028-03-01T03:00:00.000Z'))

    expect(leapDayKey).toBe('2028-02-29')
    expect(marchFirstKey).toBe('2028-03-01')

    const entries: EntryByDate = {
      [leapDayKey]: makeEntry('윤년 2월 29일 기록입니다. 충분한 길이로 작성했습니다.'),
      [marchFirstKey]: makeEntry('3월 1일 기록입니다. 충분한 길이로 작성했습니다.'),
    }

    const result = calculateStreak(entries)

    expect(result.currentStreak).toBe(2)
  })
})

describe('entryDomain.getDateKey midnight boundary (TS-103)', () => {
  it('returns different date keys just before and just after KST midnight', () => {
    const justBeforeMidnightKst = new Date('2026-08-31T14:59:00.000Z') // 2026-08-31 23:59 KST
    const justAfterMidnightKst = new Date('2026-08-31T15:01:00.000Z') // 2026-09-01 00:01 KST

    const beforeKey = getDateKey(justBeforeMidnightKst)
    const afterKey = getDateKey(justAfterMidnightKst)

    expect(beforeKey).toBe('2026-08-31')
    expect(afterKey).toBe('2026-09-01')
    expect(beforeKey).not.toBe(afterKey)
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

describe('entryDomain.canEditEntry', () => {
  it('returns true when entry date matches current date', () => {
    const now = new Date('2026-08-05T14:30:00.000+09:00')
    const dateKey = getDateKey(now) // 2026-08-05

    expect(canEditEntry(dateKey, now)).toBe(true)
  })

  it('returns false when entry date is from a past date', () => {
    const now = new Date('2026-08-06T09:00:00.000+09:00')
    const pastEntryDateKey = '2026-08-05'

    expect(canEditEntry(pastEntryDateKey, now)).toBe(false)
  })

  it('returns false when entry date is empty or invalid', () => {
    const now = new Date('2026-08-05T14:30:00.000+09:00')

    expect(canEditEntry('', now)).toBe(false)
  })
})

describe('entryDomain.canDeleteEntry', () => {
  function makeOwnedEntry(authorId?: string): Entry {
    return {
      content: '삭제 테스트용 기록입니다',
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
      ...(authorId !== undefined ? { authorId } : {}),
    }
  }

  it('returns false when entry does not exist', () => {
    expect(canDeleteEntry(undefined, 'user-1')).toBe(false)
  })

  it('returns true when entry has no authorId (legacy local entry)', () => {
    expect(canDeleteEntry(makeOwnedEntry(), 'user-1')).toBe(true)
  })

  it('returns true when authorId matches currentUserId', () => {
    expect(canDeleteEntry(makeOwnedEntry('user-1'), 'user-1')).toBe(true)
  })

  it('returns false when authorId does not match currentUserId', () => {
    expect(canDeleteEntry(makeOwnedEntry('user-1'), 'user-2')).toBe(false)
  })
})

describe('entryDomain.formatHistoryDate', () => {
  it('formats ISO string into readable Korean date time', () => {
    const iso = '2026-08-05T14:30:00.000Z'
    const formatted = formatHistoryDate(iso)

    expect(formatted).toContain('2026')
    expect(formatted).toContain('8월')
  })
})

describe('entryDomain.validateMediaAttachment', () => {
  it('allows an image within allowed mime types and size', () => {
    const result = validateMediaAttachment({
      type: ALLOWED_IMAGE_MIME_TYPES[0],
      size: 1 * 1024 * 1024,
    })

    expect(result).toBeNull()
  })

  it('allows a video within allowed mime types and size', () => {
    const result = validateMediaAttachment({
      type: ALLOWED_VIDEO_MIME_TYPES[0],
      size: 1 * 1024 * 1024,
    })

    expect(result).toBeNull()
  })

  it('rejects an image mime type that is not allowed', () => {
    const result = validateMediaAttachment({ type: 'image/gif', size: 1024 })

    expect(result).not.toBeNull()
  })

  it('rejects a video mime type that is not allowed', () => {
    const result = validateMediaAttachment({ type: 'video/avi', size: 1024 })

    expect(result).not.toBeNull()
  })

  it('rejects an image exceeding the max size', () => {
    const result = validateMediaAttachment({
      type: 'image/png',
      size: MAX_IMAGE_SIZE_MB * 1024 * 1024 + 1,
    })

    expect(result).not.toBeNull()
    expect(result).toContain(`${MAX_IMAGE_SIZE_MB}MB`)
  })

  it('rejects a video exceeding the max size', () => {
    const result = validateMediaAttachment({
      type: 'video/mp4',
      size: MAX_VIDEO_SIZE_MB * 1024 * 1024 + 1,
    })

    expect(result).not.toBeNull()
    expect(result).toContain(`${MAX_VIDEO_SIZE_MB}MB`)
  })

  it('passes through non image/video attachments such as documents', () => {
    const result = validateMediaAttachment({ type: 'application/pdf', size: 999 * 1024 * 1024 })

    expect(result).toBeNull()
  })
})

describe('entryDomain.canAddAttachment', () => {
  it('allows adding when current count is below the max', () => {
    expect(canAddAttachment(0)).toBe(true)
    expect(canAddAttachment(MAX_ATTACHMENT_COUNT_PER_ENTRY - 1)).toBe(true)
  })

  it('blocks adding when current count has reached the max', () => {
    expect(canAddAttachment(MAX_ATTACHMENT_COUNT_PER_ENTRY)).toBe(false)
    expect(canAddAttachment(MAX_ATTACHMENT_COUNT_PER_ENTRY + 1)).toBe(false)
  })
})
