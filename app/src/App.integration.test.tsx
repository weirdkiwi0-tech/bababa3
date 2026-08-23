import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'
import { getDateKey, STORAGE_KEY, type EntryByDate } from './lib/entryDomain'

function seedTodayEntry(content: string): void {
  const todayKey = getDateKey(new Date())
  const seeded: EntryByDate = {
    [todayKey]: {
      content,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded))
}

async function openSimpleEntryMode(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.click(screen.getByRole('button', { name: '간편 작성' }))
}

describe('App integration', () => {
  it('shows the current streak title in my information', async () => {
    seedTodayEntry('오늘도 꾸준히 기록해서 현재 칭호를 확인합니다.')

    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: '내 정보' }))

    expect(screen.getByRole('heading', { name: '기록의 시작' })).toBeInTheDocument()
    expect(screen.getByLabelText('칭호 목록')).toBeInTheDocument()
    expect(screen.queryByText('작은 습관의 시작')).not.toBeInTheDocument()
  })

  it('shows validation message when text is too short', async () => {
    const user = userEvent.setup()
    render(<App />)

    await openSimpleEntryMode(user)
    await user.type(screen.getByLabelText('내용'), '짧다')
    await user.click(screen.getByRole('button', { name: '저장' }))

    expect(
      screen.getByText('기록은 10자 이상 입력해주세요.'),
    ).toBeInTheDocument()
  })

  it('saves today entry and persists it in localStorage', async () => {
    const user = userEvent.setup()
    render(<App />)

    await openSimpleEntryMode(user)
    const input = screen.getByLabelText('내용')
    const content = '오늘은 집중해서 작업 계획을 끝까지 완료했다.'

    await user.type(input, content)
    await user.click(screen.getByRole('button', { name: '저장' }))

    expect(screen.getByText('오늘 기록 초안을 저장했습니다.')).toBeInTheDocument()

    const todayKey = getDateKey(new Date())
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as EntryByDate
    expect(stored[todayKey]?.content).toBe(content)
  })

  it('deletes today entry when delete button is clicked', async () => {
    seedTodayEntry('삭제 대상 기록입니다. 충분한 길이를 맞췄습니다.')

    const user = userEvent.setup()
    render(<App />)

    await openSimpleEntryMode(user)
    await user.click(screen.getByRole('button', { name: '오늘 기록 삭제' }))

    expect(screen.getByText('오늘 기록을 삭제했습니다.')).toBeInTheDocument()

    const todayKey = getDateKey(new Date())
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as EntryByDate
    expect(stored[todayKey]).toBeUndefined()
  })

  it('keeps simple entry content out of the design editor', async () => {
    const user = userEvent.setup()
    const simpleContent = '간편 작성에서 입력한 본문은 디자인 편집기에 자동으로 들어가면 안 됩니다.'
    render(<App />)

    await openSimpleEntryMode(user)
    await user.type(screen.getByLabelText('내용'), simpleContent)
    await user.click(screen.getByRole('button', { name: '← 뒤로가기' }))
    await user.click(screen.getByRole('button', { name: '디자인 작성' }))
    await user.click(screen.getByRole('tab', { name: '제작 스튜디오' }))

    expect(screen.queryByText(simpleContent)).not.toBeInTheDocument()
    expect(screen.getByText('본문')).toBeInTheDocument()
  })
})
