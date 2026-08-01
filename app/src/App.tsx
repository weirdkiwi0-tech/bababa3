import { useMemo, useState } from 'react'
import './App.css'

type Entry = {
  content: string
  createdAt: string
  updatedAt: string
}

type EntryByDate = Record<string, Entry>

const STORAGE_KEY = 'harucheck.entries.v1'
const USER_KEY = 'harucheck.anonymousUserId.v1'
const APP_TIME_ZONE = 'Asia/Seoul'

function getDateKey(date: Date): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: APP_TIME_ZONE,
  }).format(date)
}

function getMonthKey(dateKey: string): string {
  return dateKey.slice(0, 7)
}

function parseDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function toISO(date: Date): string {
  return date.toISOString()
}

function shiftDays(base: Date, amount: number): Date {
  const next = new Date(base)
  next.setDate(next.getDate() + amount)
  return next
}

function loadEntries(): EntryByDate {
  const raw = localStorage.getItem(STORAGE_KEY)

  if (!raw) {
    return {}
  }

  try {
    return JSON.parse(raw) as EntryByDate
  } catch {
    return {}
  }
}

function saveEntries(entries: EntryByDate): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
}

function getOrCreateAnonymousUserId(): string {
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

function calculateStreak(entries: EntryByDate): {
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

function getRecentPeriodCount(entries: EntryByDate, days: number): number {
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

function getCurrentMonthDays(): Array<{ key: string; dateNumber: number }> {
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

function App() {
  const [entries, setEntries] = useState<EntryByDate>(() => loadEntries())
  const [draft, setDraft] = useState('')
  const [notice, setNotice] = useState('')

  const anonymousUserId = useMemo(() => getOrCreateAnonymousUserId(), [])
  const todayKey = getDateKey(new Date())
  const [selectedDateKey, setSelectedDateKey] = useState(todayKey)
  const todayEntry = entries[todayKey]

  const { currentStreak, bestStreak, monthlyGraceUsed } = useMemo(
    () => calculateStreak(entries),
    [entries],
  )

  const totalEntries = Object.keys(entries).length
  const recent7 = useMemo(() => getRecentPeriodCount(entries, 7), [entries])
  const recent30 = useMemo(() => getRecentPeriodCount(entries, 30), [entries])

  const monthDays = getCurrentMonthDays()
  const selectedEntry = entries[selectedDateKey]

  const completionRate30 = Math.round((recent30 / 30) * 100)

  function upsertTodayEntry() {
    const trimmed = draft.trim()

    if (trimmed.length < 10 || trimmed.length > 300) {
      setNotice('기록은 10자 이상 300자 이하로 입력해주세요.')
      return
    }

    const now = toISO(new Date())
    const next: EntryByDate = {
      ...entries,
      [todayKey]: {
        content: trimmed,
        createdAt: entries[todayKey]?.createdAt ?? now,
        updatedAt: now,
      },
    }

    setEntries(next)
    saveEntries(next)
    setDraft('')
    setNotice(
      entries[todayKey] ? '오늘 기록을 수정했습니다.' : '오늘 기록을 저장했습니다.',
    )
  }

  function deleteTodayEntry() {
    if (!entries[todayKey]) {
      setNotice('삭제할 오늘 기록이 없습니다.')
      return
    }

    const next = { ...entries }
    delete next[todayKey]

    setEntries(next)
    saveEntries(next)
    setNotice('오늘 기록을 삭제했습니다.')
  }

  return (
    <main className="app-shell">
      <header className="hero">
        <p className="kicker">HaruCheck • Phase 1 MVP</p>
        <h1>하루 기록 루틴</h1>
        <p className="subtitle">
          10초 체크인으로 하루를 남기고, 스트릭으로 지속성을 확인하세요.
        </p>
        <p className="anon-id">anonymousUserId: {anonymousUserId}</p>
      </header>

      <section className="panel write-panel" aria-label="오늘 기록">
        <h2>오늘 기록</h2>
        <p className="meta">기준 타임존: {APP_TIME_ZONE}</p>
        {todayEntry ? (
          <article className="today-entry" aria-live="polite">
            <h3>저장된 오늘 기록</h3>
            <p>{todayEntry.content}</p>
          </article>
        ) : (
          <p className="empty">아직 오늘 기록이 없습니다.</p>
        )}

        <label htmlFor="entry">오늘을 10~300자로 남겨보세요</label>
        <textarea
          id="entry"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="예: 아침 산책 15분 완료, 집중이 잘 됐다."
          maxLength={300}
        />
        <p className="meta">{draft.trim().length}/300</p>

        <div className="actions">
          <button type="button" onClick={upsertTodayEntry}>
            저장/수정
          </button>
          <button type="button" className="ghost" onClick={deleteTodayEntry}>
            오늘 기록 삭제
          </button>
        </div>
        {notice ? <p className="notice">{notice}</p> : null}
      </section>

      <section className="panel stats-panel" aria-label="스트릭과 통계">
        <h2>스트릭 / 통계</h2>
        <div className="stats-grid">
          <article>
            <h3>현재 스트릭</h3>
            <strong>{currentStreak}일</strong>
          </article>
          <article>
            <h3>최고 스트릭</h3>
            <strong>{bestStreak}일</strong>
          </article>
          <article>
            <h3>최근 7일 기록</h3>
            <strong>{recent7}일</strong>
          </article>
          <article>
            <h3>최근 30일 완료율</h3>
            <strong>{completionRate30}%</strong>
          </article>
        </div>

        <p className="meta">
          월 유예 사용 여부: {monthlyGraceUsed ? '이번 달 사용됨' : '이번 달 미사용'}
        </p>
        <p className="meta">총 기록 수: {totalEntries}개</p>
      </section>

      <section className="panel calendar-panel" aria-label="월간 캘린더">
        <h2>이번 달 캘린더</h2>
        <div className="calendar-grid">
          {monthDays.map((day) => {
            const checked = Boolean(entries[day.key])
            return (
              <button
                type="button"
                key={day.key}
                className={`day ${checked ? 'checked' : ''} ${
                  day.key === todayKey ? 'today' : ''
                } ${day.key === selectedDateKey ? 'selected' : ''
                }`}
                title={checked ? '기록 완료' : '기록 없음'}
                aria-label={`${day.dateNumber}일 기록 보기`}
                onClick={() => setSelectedDateKey(day.key)}
              >
                <span>{day.dateNumber}</span>
              </button>
            )
          })}
        </div>

        <article className="selected-entry" aria-live="polite">
          <h3>{selectedDateKey} 기록</h3>
          {selectedEntry ? (
            <p>{selectedEntry.content}</p>
          ) : (
            <p className="empty">선택한 날짜의 기록이 없습니다.</p>
          )}
        </article>
      </section>
    </main>
  )
}

export default App
