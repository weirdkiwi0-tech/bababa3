import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import App from './App'
import { getDateKey, STORAGE_KEY, USER_KEY, type Entry, type EntryByDate } from './lib/entryDomain'

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

function seedEntry(dateKey: string, entry: Partial<Entry> & { content: string }): void {
  const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as EntryByDate
  const seeded: EntryByDate = {
    ...existing,
    [dateKey]: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...entry,
    },
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded))
}

function getPastDateKey(daysAgo: number): string {
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)
  return getDateKey(date)
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

  it('uses the selected title instead of upload badges in the feed', async () => {
    seedTodayEntry('선택한 칭호를 업로드 옆에 표시하는 기록입니다.')

    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: '내 정보' }))
    await user.click(screen.getByRole('button', { name: /기록의 시작/ }))
    await user.click(screen.getByRole('button', { name: '다른 사람 일기' }))

    expect(screen.getByText('기록의 시작')).toBeInTheDocument()
    expect(screen.getByText('1일 연속')).toBeInTheDocument()
    expect(screen.queryByText('내 업로드')).not.toBeInTheDocument()
    expect(screen.queryByText('간단')).not.toBeInTheDocument()
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
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    const user = userEvent.setup()
    render(<App />)

    await openSimpleEntryMode(user)
    await user.click(screen.getByRole('button', { name: '오늘 기록 삭제' }))

    const todayKey = getDateKey(new Date())
    expect(screen.getByText(`${todayKey} 기록을 삭제했습니다.`)).toBeInTheDocument()

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as EntryByDate
    expect(stored[todayKey]).toBeUndefined()
  })

  it('deletes a past-date entry owned by me when the delete button is confirmed', async () => {
    const pastDateKey = getPastDateKey(3)
    seedEntry(pastDateKey, { content: '지난 날짜에 작성한 내 기록입니다. 삭제 테스트용입니다.' })
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: '내 정보' }))
    expect(screen.getByText(pastDateKey)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '삭제' }))

    expect(screen.getByText(`${pastDateKey} 기록을 삭제했습니다.`)).toBeInTheDocument()
    expect(screen.queryByText(pastDateKey)).not.toBeInTheDocument()

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as EntryByDate
    expect(stored[pastDateKey]).toBeUndefined()
  })

  it('blocks deleting an entry authored by another user', async () => {
    localStorage.setItem(USER_KEY, 'me-user-id')
    const pastDateKey = getPastDateKey(2)
    seedEntry(pastDateKey, {
      content: '다른 사람이 작성한 기록입니다. 삭제되면 안 됩니다.',
      authorId: 'other-user-id',
    })
    const confirmSpy = vi.spyOn(window, 'confirm')

    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: '내 정보' }))
    await user.click(screen.getByRole('button', { name: '삭제' }))

    expect(screen.getByText('본인이 작성한 기록만 삭제할 수 있습니다.')).toBeInTheDocument()
    expect(confirmSpy).not.toHaveBeenCalled()
    expect(screen.getByText(pastDateKey)).toBeInTheDocument()

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as EntryByDate
    expect(stored[pastDateKey]?.content).toBe('다른 사람이 작성한 기록입니다. 삭제되면 안 됩니다.')
  })

  it('keeps the entry when the delete confirmation is cancelled', async () => {
    const pastDateKey = getPastDateKey(1)
    seedEntry(pastDateKey, { content: '취소 테스트를 위한 지난 날짜 기록입니다.' })
    vi.spyOn(window, 'confirm').mockReturnValue(false)

    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: '내 정보' }))
    await user.click(screen.getByRole('button', { name: '삭제' }))

    expect(screen.getByText(pastDateKey)).toBeInTheDocument()

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as EntryByDate
    expect(stored[pastDateKey]?.content).toBe('취소 테스트를 위한 지난 날짜 기록입니다.')
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

  it('shows three paper templates with a full-range color picker', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: '디자인 작성' }))

    expect(screen.getByText('서식 3개 · 선택 후 색상을 정할 수 있어요.')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /원하는 색상으로 변경/ })).toHaveLength(3)
    expect(screen.getByLabelText('배경 색상')).toBeInTheDocument()
    expect(screen.getByLabelText('HEX 색상')).toHaveValue('1b5e57')
  })

  it('opens saved image and file attachments from a diary card', async () => {
    const user = userEvent.setup()
    render(<App />)

    await openSimpleEntryMode(user)
    await user.type(screen.getByLabelText('내용'), '이미지와 파일을 함께 저장하는 기록입니다.')
    await user.upload(screen.getByLabelText('사진/파일/영상 첨부'), [
      new File(['image'], 'photo.png', { type: 'image/png' }),
      new File(['text'], 'memo.txt', { type: 'text/plain' }),
    ])
    await user.click(screen.getByRole('button', { name: '저장' }))
    await user.click(screen.getByRole('button', { name: '내 정보' }))
    await user.click(screen.getByRole('button', { name: /첨부 파일 2개/ }))

    expect(screen.getByRole('heading', { name: '일기 첨부 파일' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'photo.png' })).toBeInTheDocument()
    expect(screen.getByText('memo.txt')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '파일 열기' })).toBeInTheDocument()
  })

  it('rejects unsupported or oversized media and keeps valid attachments', async () => {
    const user = userEvent.setup()
    render(<App />)

    await openSimpleEntryMode(user)

    const oversizedImage = new File(['x'], 'huge.jpg', { type: 'image/jpeg' })
    Object.defineProperty(oversizedImage, 'size', { value: 10 * 1024 * 1024 + 1 })

    await user.upload(screen.getByLabelText('사진/파일/영상 첨부'), [
      new File(['gif'], 'animated.gif', { type: 'image/gif' }),
      oversizedImage,
    ])

    expect(
      screen.getByText('지원하지 않는 이미지 형식입니다. jpg, png, webp만 첨부할 수 있습니다.'),
    ).toBeInTheDocument()
    expect(screen.getByText('선택된 첨부 파일이 없습니다.')).toBeInTheDocument()

    await user.upload(screen.getByLabelText('사진/파일/영상 첨부'), [
      new File(['image'], 'photo.jpg', { type: 'image/jpeg' }),
      new File(['gif'], 'animated.gif', { type: 'image/gif' }),
    ])

    expect(screen.getByText('선택된 파일: photo.jpg')).toBeInTheDocument()
  })

  it('rejects attachments beyond the max count of 10 per entry', async () => {
    const todayKey = getDateKey(new Date())
    const existingAttachments = Array.from({ length: 9 }, (_, index) => ({
      id: `existing-${index}`,
      name: `existing-${index}.png`,
      type: 'image/png',
      size: 100,
      kind: 'image' as const,
    }))
    const seeded: EntryByDate = {
      [todayKey]: {
        content: '이미 아홉 개의 첨부 파일을 가진 기록입니다. 최대치에 근접했습니다.',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        attachments: existingAttachments,
      },
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded))

    const user = userEvent.setup()
    render(<App />)

    await openSimpleEntryMode(user)

    await user.upload(screen.getByLabelText('사진/파일/영상 첨부'), [
      new File(['a'], 'new1.png', { type: 'image/png' }),
      new File(['b'], 'new2.png', { type: 'image/png' }),
      new File(['c'], 'new3.png', { type: 'image/png' }),
    ])

    expect(
      screen.getByText('첨부 파일은 최대 10개까지 가능합니다.'),
    ).toBeInTheDocument()
    expect(screen.getByText('선택된 파일: new1.png')).toBeInTheDocument()
  })

  it('separates file add and image insert actions in the design editor', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: '디자인 작성' }))
    await user.click(screen.getByRole('tab', { name: '제작 스튜디오' }))
    await user.click(screen.getByRole('button', { name: '파일' }))

    expect(screen.getByRole('menuitem', { name: '파일 추가' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: '파일 삽입' })).toBeInTheDocument()

    await user.click(screen.getByRole('menuitem', { name: '파일 삽입' }))
    await user.upload(
      screen.getByLabelText('파일 삽입'),
      new File(['image'], 'inserted.png', { type: 'image/png' }),
    )

    expect(screen.getByRole('img', { name: 'inserted.png' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'inserted.png 크기 조절' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'inserted.png 삭제' })).toBeInTheDocument()
  })

  it('rotates the selected design element and can reset its rotation', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: '디자인 작성' }))
    await user.click(screen.getByRole('tab', { name: '제작 스튜디오' }))
    await user.click(screen.getByRole('button', { name: '파일' }))
    await user.click(screen.getByRole('menuitem', { name: '파일 삽입' }))
    await user.upload(
      screen.getByLabelText('파일 삽입'),
      new File(['image'], 'rotated.png', { type: 'image/png' }),
    )

    const image = screen.getByRole('img', { name: 'rotated.png' })
    const rotateButton = screen.getByRole('button', { name: '이미지 15도 회전' })
    fireEvent.pointerDown(rotateButton, { clientX: 10, clientY: 0 })
    fireEvent.pointerMove(window, { clientX: 0, clientY: 10 })
    fireEvent.pointerUp(window)
    expect(image.parentElement?.style.transform).toContain('rotate(90deg)')
    expect(window.getComputedStyle(image.parentElement as HTMLElement).transformOrigin).toBe('50% 50%')
  })

  it('allows editing entry on the same day and restricts editing past entries', async () => {
    const user = userEvent.setup()
    render(<App />)

    await openSimpleEntryMode(user)
    await user.type(screen.getByLabelText('내용'), '오늘 작성한 기록입니다. 당일 수정 가능해야 합니다.')
    await user.click(screen.getByRole('button', { name: '저장' }))

    await user.click(screen.getByRole('button', { name: '내 정보' }))

    const editBtns = screen.getAllByRole('button', { name: '수정' })
    expect(editBtns.length).toBeGreaterThan(0)
    await user.click(editBtns[0])

    expect(screen.getByText(/기록을 수정 중입니다/)).toBeInTheDocument()
  })

  it('displays edit emoji on modified entries and shows history modal on click', async () => {
    const user = userEvent.setup()
    render(<App />)

    await openSimpleEntryMode(user)
    await user.type(screen.getByLabelText('내용'), '수정 전 첫 번째 기록 내용입니다.')
    await user.click(screen.getByRole('button', { name: '저장' }))

    await user.click(screen.getByRole('button', { name: '내 정보' }))
    const editBtn = screen.getAllByRole('button', { name: '수정' })[0]
    await user.click(editBtn)

    const textarea = screen.getByLabelText('내용')
    await user.clear(textarea)
    await user.type(textarea, '수정된 두 번째 기록 내용입니다.')
    await user.click(screen.getByRole('button', { name: '저장' }))

    await user.click(screen.getByRole('button', { name: '내 정보' }))

    const emojiBtn = screen.getAllByRole('button', { name: /수정 이력 보기/ })[0]
    expect(emojiBtn).toBeInTheDocument()

    await user.click(emojiBtn)

    expect(screen.getByRole('heading', { name: /일기 수정 이력/ })).toBeInTheDocument()
    expect(screen.getByText('수정 전 첫 번째 기록 내용입니다.')).toBeInTheDocument()
    expect(screen.getAllByText('수정된 두 번째 기록 내용입니다.').length).toBeGreaterThan(0)
  })

  it('shows modified emoji on public feed entries and opens history modal on click', async () => {
    const user = userEvent.setup()
    render(<App />)

    await openSimpleEntryMode(user)
    await user.type(screen.getByLabelText('내용'), '공개 피드 수정 전 첫 내용입니다.')
    await user.click(screen.getByRole('button', { name: '완료하고 올리기' }))

    await user.click(screen.getByRole('button', { name: '내 일기' }))
    await user.click(screen.getByRole('button', { name: '내 정보' }))
    const editBtn = screen.getAllByRole('button', { name: '수정' })[0]
    await user.click(editBtn)

    const textarea = screen.getByLabelText('내용')
    await user.clear(textarea)
    await user.type(textarea, '공개 피드 수정 후 두 번째 내용입니다.')
    await user.click(screen.getByRole('button', { name: '완료하고 올리기' }))

    await user.click(screen.getByRole('button', { name: '다른 사람 일기' }))

    const feedEmojiBtn = screen.getAllByRole('button', { name: /수정 이력 보기/ })[0]
    expect(feedEmojiBtn).toBeInTheDocument()
    await user.click(feedEmojiBtn)

    expect(screen.getByRole('heading', { name: /일기 수정 이력/ })).toBeInTheDocument()
    expect(screen.getByText('공개 피드 수정 전 첫 내용입니다.')).toBeInTheDocument()
  })
})
