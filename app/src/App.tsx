import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import './App.css'
import {
  APP_TIME_ZONE,
  ENTRY_MIN_LENGTH,
  STREAK_TITLES,
  calculateStreak,
  getCurrentMonthDays,
  getDateKey,
  getOrCreateAnonymousUserId,
  getRecentPeriodCount,
  getStreakTitle,
  loadDiaryDesigns,
  loadEntries,
  saveDiaryDesigns,
  saveEntries,
  toISO,
  validateEntryContent,
  type DiaryDesign,
  type DiaryDesignByDate,
  type EntryByDate,
} from './lib/entryDomain'

type ActiveView = 'my-diary' | 'public-feed' | 'my-info'
type MyDiaryView = 'studio' | 'gallery'
type CanvasRatio = 'classic' | 'wide' | 'story'
type TextAlignMode = 'left' | 'center' | 'right'
type DiaryEntryMode = 'simple' | 'quality'
type FeedViewFilter = 'all' | DiaryEntryMode
type BlockPoint = { x: number; y: number }
type TextBlockTarget = 'title' | 'body'
type SlideBlockSnapshot = { x: number; y: number; scale: number }
type StickerSnapshot = { id: string; presetId: string; x: number; y: number; scale: number }
type MovableSelection =
  | { type: 'title' }
  | { type: 'body' }
  | { type: 'sticker'; stickerId: string }
type FeedSlideView = {
  author: string
  isMine: boolean
  title: string
  body: string
  templateId: string
  textAlign: TextAlignMode
  titleBlock: SlideBlockSnapshot
  bodyBlock: SlideBlockSnapshot
  stickers: StickerSnapshot[]
}

type TextBlockDragState =
  | {
  target: TextBlockTarget
      action: 'drag' | 'resize'
      startPointerX: number
      startPointerY: number
      startX: number
      startY: number
      startScale: number
    }
  | null

type StickerDragState =
  | {
      stickerId: string
      action: 'drag' | 'resize'
      startPointerX: number
      startPointerY: number
      startX: number
      startY: number
      startScale: number
    }
  | null

type StickerPreset = {
  id: string
  name: string
  emoji: string
}

type CoverPreset = {
  id: string
  name: string
  mainColor: string
  subColor: string
}

type PaperPreset = {
  paperStyle: string
  pattern: string
}

type DiaryDesignPreset = {
  id: string
  name: string
  coverStyle: string
  paperStyle: string
  preview: string
}

const COVER_PRESETS: CoverPreset[] = [
  { id: 'forest', name: '포레스트', mainColor: '#1b5e57', subColor: '#59b58d' },
  { id: 'sunset', name: '선셋', mainColor: '#a34a2f', subColor: '#f1a260' },
  { id: 'ocean', name: '오션', mainColor: '#1f4f8a', subColor: '#67a5df' },
  { id: 'lavender', name: '라벤더', mainColor: '#6a4a8b', subColor: '#b997e6' },
  { id: 'charcoal', name: '차콜', mainColor: '#2f3a42', subColor: '#7d8f9b' },
  { id: 'mint', name: '민트', mainColor: '#1f6b62', subColor: '#8dd8c8' },
]

const PAPER_PRESETS: PaperPreset[] = [
  {
    paperStyle: '줄노트',
    pattern:
      'repeating-linear-gradient(0deg, rgba(255, 255, 255, 0.25) 0px, rgba(255, 255, 255, 0.25) 1px, transparent 1px, transparent 11px)',
  },
  {
    paperStyle: '모눈',
    pattern:
      'repeating-linear-gradient(0deg, rgba(255, 255, 255, 0.22) 0px, rgba(255, 255, 255, 0.22) 1px, transparent 1px, transparent 12px), repeating-linear-gradient(90deg, rgba(255, 255, 255, 0.22) 0px, rgba(255, 255, 255, 0.22) 1px, transparent 1px, transparent 12px)',
  },
  {
    paperStyle: '무지',
    pattern: 'linear-gradient(180deg, rgba(255, 255, 255, 0.24), rgba(255, 255, 255, 0.1))',
  },
  {
    paperStyle: '도트',
    pattern:
      'radial-gradient(circle at 1px 1px, rgba(255, 255, 255, 0.33) 1px, transparent 1.8px)',
  },
]

const DESIGN_PRESETS: DiaryDesignPreset[] = COVER_PRESETS.flatMap((cover) =>
  PAPER_PRESETS.map((paper) => ({
    id: `${cover.id}-${paper.paperStyle}`,
    name: `${cover.name} · ${paper.paperStyle}`,
    coverStyle: cover.name,
    paperStyle: paper.paperStyle,
    preview: `${paper.pattern}, linear-gradient(145deg, ${cover.mainColor}, ${cover.subColor})`,
  })),
)

const STICKER_PRESETS: StickerPreset[] = [
  { id: 'heart', name: '하트', emoji: '💚' },
  { id: 'star', name: '별', emoji: '⭐' },
  { id: 'sparkles', name: '반짝', emoji: '✨' },
  { id: 'flower', name: '꽃', emoji: '🌼' },
  { id: 'coffee', name: '커피', emoji: '☕' },
  { id: 'book', name: '책', emoji: '📖' },
  { id: 'leaf', name: '잎사귀', emoji: '🍃' },
  { id: 'clover', name: '클로버', emoji: '🍀' },
  { id: 'moon', name: '달', emoji: '🌙' },
  { id: 'sun', name: '태양', emoji: '🌞' },
  { id: 'rainbow', name: '무지개', emoji: '🌈' },
  { id: 'gift', name: '선물', emoji: '🎁' },
  { id: 'music', name: '음표', emoji: '🎵' },
  { id: 'balloon', name: '풍선', emoji: '🎈' },
  { id: 'camera', name: '카메라', emoji: '📸' },
  { id: 'pencil', name: '연필', emoji: '✏️' },
  { id: 'rocket', name: '로켓', emoji: '🚀' },
  { id: 'cat', name: '고양이', emoji: '🐱' },
]

const STICKER_BASE_SIZE = 28

const DEFAULT_DIARY_DESIGN: DiaryDesign = {
  templateId: DESIGN_PRESETS[0].id,
  paperStyle: DESIGN_PRESETS[0].paperStyle,
  coverStyle: DESIGN_PRESETS[0].coverStyle,
}

function normalizeDiaryDesign(design?: Partial<DiaryDesign>): DiaryDesign {
  return {
    templateId: design?.templateId ?? DEFAULT_DIARY_DESIGN.templateId,
    paperStyle: design?.paperStyle ?? DEFAULT_DIARY_DESIGN.paperStyle,
    coverStyle: design?.coverStyle ?? DEFAULT_DIARY_DESIGN.coverStyle,
  }
}

function splitTitleAndBody(content: string): { title: string; body: string } {
  const [titleCandidate, ...rest] = content.split('\n\n')

  if (rest.length === 0) {
    return { title: '', body: content }
  }

  return {
    title: titleCandidate,
    body: rest.join('\n\n'),
  }
}

function getStickerEmoji(stickerPresetId: string): string {
  return STICKER_PRESETS.find((preset) => preset.id === stickerPresetId)?.emoji ?? '✨'
}

function App() {
  const [entries, setEntries] = useState<EntryByDate>(() => loadEntries())
  const [designByDate, setDesignByDate] = useState<DiaryDesignByDate>(() =>
    loadDiaryDesigns(),
  )
  const anonymousUserId = useMemo(() => getOrCreateAnonymousUserId(), [])
  const todayKey = getDateKey(new Date())
  const [draft, setDraft] = useState(() => entries[todayKey]?.content ?? '')
  const [qualityDraft, setQualityDraft] = useState(() => {
    const todayEntry = entries[todayKey]

    if (!todayEntry || todayEntry.entryMode !== 'quality') {
      return ''
    }

    return todayEntry.qualitySnapshot?.body ?? splitTitleAndBody(todayEntry.content).body
  })
  const [draftDesign, setDraftDesign] = useState<DiaryDesign>(
    () => normalizeDiaryDesign(loadDiaryDesigns()[todayKey]),
  )
  const [myDiaryView, setMyDiaryView] = useState<MyDiaryView>('studio')
  const [canvasRatio, setCanvasRatio] = useState<CanvasRatio>('classic')
  const [textAlignMode, setTextAlignMode] = useState<TextAlignMode>('left')
  const [entryTitle, setEntryTitle] = useState('')
  const [selectedEntryMode, setSelectedEntryMode] = useState<DiaryEntryMode | null>(null)
  const [selectedMediaNames, setSelectedMediaNames] = useState<string[]>([])
  const [notice, setNotice] = useState('')
  const [activeView, setActiveView] = useState<ActiveView>('my-diary')
  const [isCompactNavOpen, setIsCompactNavOpen] = useState(false)
  const [publicFeedFilter, setPublicFeedFilter] = useState<FeedViewFilter>('all')
  const [publicFeedDateKey, setPublicFeedDateKey] = useState(todayKey)
  const [selectedDateKey, setSelectedDateKey] = useState(todayKey)
  const [titleBlockPosition, setTitleBlockPosition] = useState<BlockPoint>({ x: 22, y: 20 })
  const [titleBlockScale, setTitleBlockScale] = useState(1)
  const [bodyBlockPosition, setBodyBlockPosition] = useState<BlockPoint>({ x: 22, y: 180 })
  const [bodyBlockScale, setBodyBlockScale] = useState(1)
  const [selectedStickerPresetId, setSelectedStickerPresetId] = useState(STICKER_PRESETS[0].id)
  const [placedStickers, setPlacedStickers] = useState<StickerSnapshot[]>([])
  const [selectedMovable, setSelectedMovable] = useState<MovableSelection | null>(null)
  const [lockedTargets, setLockedTargets] = useState<Record<string, boolean>>({})
  const [isTextEditMode, setIsTextEditMode] = useState(false)
  const [activeFeedSlide, setActiveFeedSlide] = useState<FeedSlideView | null>(null)
  const dragStateRef = useRef<TextBlockDragState>(null)
  const stickerDragStateRef = useRef<StickerDragState>(null)
  const canvasRef = useRef<HTMLDivElement | null>(null)
  const titleBlockRef = useRef<HTMLDivElement | null>(null)
  const bodyBlockRef = useRef<HTMLDivElement | null>(null)
  const isQualityEditorActive =
    activeView === 'my-diary' && selectedEntryMode === 'quality'

  const { currentStreak, bestStreak, monthlyGraceUsed } = useMemo(
    () => calculateStreak(entries),
    [entries],
  )
  const currentTitle = getStreakTitle(currentStreak)

  const totalEntries = Object.keys(entries).length
  const recent7 = useMemo(() => getRecentPeriodCount(entries, 7), [entries])
  const recent30 = useMemo(() => getRecentPeriodCount(entries, 30), [entries])

  const monthDays = useMemo(() => getCurrentMonthDays(), [])
  const selectedEntry = entries[selectedDateKey]
  const myEntries = useMemo(
    () =>
      Object.entries(entries)
        .sort(([left], [right]) => right.localeCompare(left))
        .slice(0, 12),
    [entries],
  )
  const publicFeedItems = useMemo(() => {
    const myPublicEntries = Object.entries(entries)
      .sort(([left], [right]) => right.localeCompare(left))
      .slice(0, 8)
      .map(([dateKey, entry]) => ({
        ...(function deriveQualityView() {
          if ((entry.entryMode ?? 'simple') !== 'quality') {
            return { qualityView: null as FeedSlideView | null }
          }

          const split = splitTitleAndBody(entry.content)
          const design = normalizeDiaryDesign(designByDate[dateKey])

          return {
            qualityView: {
              author: '나',
              isMine: true,
              title: entry.qualitySnapshot?.title ?? split.title,
              body: entry.qualitySnapshot?.body ?? split.body,
              templateId: entry.qualitySnapshot?.templateId ?? design.templateId,
              textAlign: entry.qualitySnapshot?.textAlign ?? 'left',
              titleBlock: entry.qualitySnapshot?.titleBlock ?? { x: 22, y: 20, scale: 1 },
              bodyBlock: entry.qualitySnapshot?.bodyBlock ?? { x: 22, y: 180, scale: 1 },
              stickers: entry.qualitySnapshot?.stickers ?? [],
            },
          }
        })(),
        id: `mine-${dateKey}`,
        dateKey,
        author: '나',
        content: entry.content,
        entryMode: entry.entryMode ?? 'simple',
        isMine: true,
      }))

    return myPublicEntries
  }, [designByDate, entries])
  const filteredPublicFeedItems = useMemo(
    () =>
      publicFeedItems.filter(
        (item) =>
          item.dateKey === publicFeedDateKey &&
          (publicFeedFilter === 'all' || item.entryMode === publicFeedFilter),
      ),
    [publicFeedDateKey, publicFeedFilter, publicFeedItems],
  )

  const completionRate30 = Math.round((recent30 / 30) * 100)
  const activeDesignPreset = useMemo(
    () =>
      DESIGN_PRESETS.find((preset) => preset.id === draftDesign.templateId) ??
      DESIGN_PRESETS[0],
    [draftDesign.templateId],
  )

  function getSelectionLockKey(selection: MovableSelection): string {
    if (selection.type === 'sticker') {
      return `sticker:${selection.stickerId}`
    }

    return selection.type
  }

  function isSelectionLocked(selection: MovableSelection | null): boolean {
    if (!selection) {
      return false
    }

    return Boolean(lockedTargets[getSelectionLockKey(selection)])
  }

  function toggleLockForSelection(selection: MovableSelection) {
    const lockKey = getSelectionLockKey(selection)
    const isLocked = Boolean(lockedTargets[lockKey])

    setLockedTargets((current) => {
      if (isLocked) {
        const next = { ...current }
        delete next[lockKey]
        return next
      }

      return {
        ...current,
        [lockKey]: true,
      }
    })

    setNotice(isLocked ? '잠금을 해제했습니다.' : '선택한 요소를 잠금 처리했습니다.')
  }

  function toggleSelectedLock() {
    if (!selectedMovable) {
      return
    }

    toggleLockForSelection(selectedMovable)
  }

  function clampValue(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value))
  }

  function getCanvasBounds(): { width: number; height: number } | null {
    const canvas = canvasRef.current

    if (!canvas) {
      return null
    }

    const rect = canvas.getBoundingClientRect()
    return {
      width: rect.width,
      height: rect.height,
    }
  }

  function clampTextBlockPosition(
    target: TextBlockTarget,
    point: BlockPoint,
    scale: number,
  ): BlockPoint {
    const bounds = getCanvasBounds()
    const targetElement = target === 'title' ? titleBlockRef.current : bodyBlockRef.current

    if (!bounds || !targetElement) {
      return point
    }

    const rect = targetElement.getBoundingClientRect()
    const safeScale = Math.max(scale, 0.01)
    const baseWidth = rect.width / safeScale
    const baseHeight = rect.height / safeScale

    const minOffset = 8
    const safeEdge = 18
    const maxX = Math.max(minOffset, bounds.width - baseWidth * scale - safeEdge)
    const maxY = Math.max(minOffset, bounds.height - baseHeight * scale - safeEdge)

    return {
      x: clampValue(point.x, minOffset, maxX),
      y: clampValue(point.y, minOffset, maxY),
    }
  }

  function clampStickerPlacement(sticker: StickerSnapshot): StickerSnapshot {
    const bounds = getCanvasBounds()

    if (!bounds) {
      return sticker
    }

    const minOffset = 4
    const visualSize = STICKER_BASE_SIZE * sticker.scale
    const maxX = Math.max(minOffset, bounds.width - visualSize - minOffset)
    const maxY = Math.max(minOffset, bounds.height - visualSize - minOffset)

    return {
      ...sticker,
      x: clampValue(sticker.x, minOffset, maxX),
      y: clampValue(sticker.y, minOffset, maxY),
    }
  }

  useEffect(() => {
    function onPointerMove(event: PointerEvent) {
      const dragState = dragStateRef.current

      if (!dragState) {
        return
      }

      const deltaX = event.clientX - dragState.startPointerX
      const deltaY = event.clientY - dragState.startPointerY

      const applyPosition = (next: BlockPoint) => {
        const clamped = clampTextBlockPosition(
          dragState.target,
          next,
          dragState.target === 'title' ? titleBlockScale : bodyBlockScale,
        )

        if (dragState.target === 'title') {
          setTitleBlockPosition(clamped)
          return
        }

        setBodyBlockPosition(clamped)
      }

      const applyScale = (next: number) => {
        if (dragState.target === 'title') {
          setTitleBlockScale(next)
          setTitleBlockPosition((current) =>
            clampTextBlockPosition('title', current, next),
          )
          return
        }

        setBodyBlockScale(next)
        setBodyBlockPosition((current) =>
          clampTextBlockPosition('body', current, next),
        )
      }

      if (dragState.action === 'drag') {
        applyPosition({
          x: dragState.startX + deltaX,
          y: dragState.startY + deltaY,
        })
        return
      }

      const nextScale = Math.min(2.5, Math.max(0.7, dragState.startScale + deltaX / 240))
      applyScale(nextScale)
    }

    function onPointerUp() {
      dragStateRef.current = null
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)

    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }
  }, [bodyBlockScale, titleBlockScale])

  useEffect(() => {
    const compactNavQuery = window.matchMedia('(max-width: 900px)')

    function onCompactNavChange(event: MediaQueryListEvent) {
      if (!event.matches) {
        setIsCompactNavOpen(false)
      }
    }

    if (!compactNavQuery.matches) {
      setIsCompactNavOpen(false)
    }

    compactNavQuery.addEventListener('change', onCompactNavChange)

    return () => {
      compactNavQuery.removeEventListener('change', onCompactNavChange)
    }
  }, [])

  useEffect(() => {
    function onStickerPointerMove(event: PointerEvent) {
      const dragState = stickerDragStateRef.current

      if (!dragState) {
        return
      }

      const deltaX = event.clientX - dragState.startPointerX
      const deltaY = event.clientY - dragState.startPointerY
      const distance = Math.hypot(deltaX, deltaY)

      if (distance < 3) {
        return
      }

      if (dragState.action === 'resize') {
        const scaleDelta = (deltaX + deltaY) / 300

        setPlacedStickers((current) =>
          current.map((sticker) =>
            sticker.id === dragState.stickerId
              ? {
                  ...sticker,
                  scale: Math.min(3, Math.max(0.5, dragState.startScale + scaleDelta)),
                }
              : sticker,
          ),
        )
        return
      }

      setPlacedStickers((current) =>
        current.map((sticker) =>
          sticker.id === dragState.stickerId
            ? clampStickerPlacement({
                ...sticker,
                x: dragState.startX + deltaX,
                y: dragState.startY + deltaY,
              })
            : sticker,
        ),
      )
    }

    function onStickerPointerUp() {
      stickerDragStateRef.current = null
    }

    window.addEventListener('pointermove', onStickerPointerMove)
    window.addEventListener('pointerup', onStickerPointerUp)

    return () => {
      window.removeEventListener('pointermove', onStickerPointerMove)
      window.removeEventListener('pointerup', onStickerPointerUp)
    }
  }, [])

  useEffect(() => {
    function normalizeCanvasLayout() {
      setTitleBlockPosition((current) => {
        const next = clampTextBlockPosition('title', current, titleBlockScale)
        return next.x === current.x && next.y === current.y ? current : next
      })
      setBodyBlockPosition((current) => {
        const next = clampTextBlockPosition('body', current, bodyBlockScale)
        return next.x === current.x && next.y === current.y ? current : next
      })
      setPlacedStickers((current) =>
        current.map((sticker) => clampStickerPlacement(sticker)),
      )
    }

    const frameId = window.requestAnimationFrame(normalizeCanvasLayout)

    function onResize() {
      normalizeCanvasLayout()
    }

    window.addEventListener('resize', onResize)

    return () => {
      window.cancelAnimationFrame(frameId)
      window.removeEventListener('resize', onResize)
    }
  }, [bodyBlockScale, canvasRatio, titleBlockScale])

  function beginStickerDrag(stickerId: string, event: ReactPointerEvent<HTMLDivElement>) {
    const targetElement = event.target as HTMLElement | null
    if (
      targetElement?.closest('.sticker-resize-handle') ||
      targetElement?.closest('.sticker-remove') ||
      targetElement?.closest('.element-lock-toggle')
    ) {
      return
    }

    event.stopPropagation()
    event.preventDefault()

    const selection: MovableSelection = { type: 'sticker', stickerId }
    setSelectedMovable(selection)

    if (isSelectionLocked(selection)) {
      return
    }

    const targetSticker = placedStickers.find((sticker) => sticker.id === stickerId)

    if (!targetSticker) {
      return
    }

    stickerDragStateRef.current = {
      stickerId,
      action: 'drag',
      startPointerX: event.clientX,
      startPointerY: event.clientY,
      startX: targetSticker.x,
      startY: targetSticker.y,
      startScale: targetSticker.scale,
    }
  }

  function beginStickerResize(stickerId: string, event: ReactPointerEvent<HTMLButtonElement>) {
    event.stopPropagation()
    event.preventDefault()

    const selection: MovableSelection = { type: 'sticker', stickerId }
    setSelectedMovable(selection)

    if (isSelectionLocked(selection)) {
      return
    }

    const targetSticker = placedStickers.find((sticker) => sticker.id === stickerId)

    if (!targetSticker) {
      return
    }

    stickerDragStateRef.current = {
      stickerId,
      action: 'resize',
      startPointerX: event.clientX,
      startPointerY: event.clientY,
      startX: targetSticker.x,
      startY: targetSticker.y,
      startScale: targetSticker.scale,
    }
  }

  function addStickerToCanvas() {
    const nextIndex = placedStickers.length
    const nextStickerId =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `sticker-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const nextSticker: StickerSnapshot = {
      id: nextStickerId,
      presetId: selectedStickerPresetId,
      x: 22 + (nextIndex % 5) * 58,
      y: 22 + Math.floor(nextIndex / 5) * 58,
      scale: 1,
    }

    setPlacedStickers((current) => [...current, nextSticker])
    setSelectedMovable({ type: 'sticker', stickerId: nextStickerId })
    setNotice('스티커를 캔버스에 추가했습니다. 드래그해서 위치를 옮겨보세요.')
  }

  function removeSticker(stickerId: string) {
    setPlacedStickers((current) => current.filter((sticker) => sticker.id !== stickerId))
    setSelectedMovable((current) =>
      current?.type === 'sticker' && current.stickerId === stickerId ? null : current,
    )
    setLockedTargets((current) => {
      const lockKey = `sticker:${stickerId}`
      if (!current[lockKey]) {
        return current
      }
      const next = { ...current }
      delete next[lockKey]
      return next
    })
  }

  function clearStickers() {
    setPlacedStickers([])
    setSelectedMovable((current) => (current?.type === 'sticker' ? null : current))
    setLockedTargets((current) =>
      Object.fromEntries(Object.entries(current).filter(([key]) => !key.startsWith('sticker:'))),
    )
    setNotice('스티커를 모두 초기화했습니다.')
  }

  function beginTextBlockDrag(target: TextBlockTarget, event: ReactPointerEvent<HTMLDivElement>) {
    const selection: MovableSelection = target === 'title' ? { type: 'title' } : { type: 'body' }
    setSelectedMovable(selection)

    if (isSelectionLocked(selection)) {
      return
    }

    if (isTextEditMode) {
      return
    }

    const sourcePosition = target === 'title' ? titleBlockPosition : bodyBlockPosition
    const sourceScale = target === 'title' ? titleBlockScale : bodyBlockScale

    dragStateRef.current = {
      target,
      action: 'drag',
      startPointerX: event.clientX,
      startPointerY: event.clientY,
      startX: sourcePosition.x,
      startY: sourcePosition.y,
      startScale: sourceScale,
    }
  }

  function beginTextBlockResize(target: TextBlockTarget, event: ReactPointerEvent<HTMLButtonElement>) {
    event.stopPropagation()

    const selection: MovableSelection = target === 'title' ? { type: 'title' } : { type: 'body' }
    setSelectedMovable(selection)

    if (isSelectionLocked(selection)) {
      return
    }

    const sourcePosition = target === 'title' ? titleBlockPosition : bodyBlockPosition
    const sourceScale = target === 'title' ? titleBlockScale : bodyBlockScale

    dragStateRef.current = {
      target,
      action: 'resize',
      startPointerX: event.clientX,
      startPointerY: event.clientY,
      startX: sourcePosition.x,
      startY: sourcePosition.y,
      startScale: sourceScale,
    }
  }

  function persistTodayEntry(mode: 'draft' | 'publish') {
    const contentDraft = selectedEntryMode === 'quality' ? qualityDraft : draft
    const validationError = validateEntryContent(contentDraft)
    if (validationError) {
      setNotice(validationError)
      return
    }

    const trimmed = contentDraft.trim()
    const trimmedTitle = entryTitle.trim()
    const composedContent = trimmedTitle ? `${trimmedTitle}\n\n${trimmed}` : trimmed

    const now = toISO(new Date())
    const next: EntryByDate = {
      ...entries,
      [todayKey]: {
        content: composedContent,
        createdAt: entries[todayKey]?.createdAt ?? now,
        updatedAt: now,
        entryMode: selectedEntryMode ?? 'simple',
        authorId: anonymousUserId,
        qualitySnapshot:
          selectedEntryMode === 'quality'
            ? {
                title: trimmedTitle,
                body: trimmed,
                templateId: draftDesign.templateId,
                textAlign: textAlignMode,
                titleBlock: {
                  x: titleBlockPosition.x,
                  y: titleBlockPosition.y,
                  scale: titleBlockScale,
                },
                bodyBlock: {
                  x: bodyBlockPosition.x,
                  y: bodyBlockPosition.y,
                  scale: bodyBlockScale,
                },
                stickers: placedStickers,
              }
            : undefined,
      },
    }

    setEntries(next)
    saveEntries(next)

    if (mode === 'publish') {
      setActiveView('public-feed')
      setNotice('제작 완료. 공개 피드에 올렸습니다.')
      return
    }

    setNotice(entries[todayKey] ? '오늘 기록 초안을 수정했습니다.' : '오늘 기록 초안을 저장했습니다.')
  }

  function applyDesignPreset(preset: DiaryDesignPreset) {
    const nextDesign: DiaryDesign = {
      templateId: preset.id,
      coverStyle: preset.coverStyle,
      paperStyle: preset.paperStyle,
    }

    const nextByDate: DiaryDesignByDate = {
      ...designByDate,
      [todayKey]: nextDesign,
    }

    setDraftDesign(nextDesign)
    setDesignByDate(nextByDate)
    saveDiaryDesigns(nextByDate)
    setNotice('템플릿을 적용했습니다.')
  }

  function handleMediaSelection(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files

    if (!files) {
      setSelectedMediaNames([])
      return
    }

    setSelectedMediaNames(Array.from(files).map((file) => file.name))
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
    <main className={`app-shell ${isQualityEditorActive ? 'quality-editor-mode' : ''}`}>
      <header className="hero">
        <div className="hero-title-row">
          <h1>하루 한장</h1>
          {activeView === 'my-diary' && selectedEntryMode === 'simple' ? (
            <button
              type="button"
              className="hero-back-button"
              onClick={() => setSelectedEntryMode(null)}
            >
              ← 뒤로가기
            </button>
          ) : null}
        </div>
        <p className="anon-id">anonymousUserId: {anonymousUserId}</p>
      </header>

      {activeView === 'my-diary' ? (
        <>
          <section
            className={`panel write-panel ${isQualityEditorActive ? 'quality-fullscreen-panel' : ''}`}
            aria-label="오늘 기록"
          >
            {!isQualityEditorActive ? <h2>오늘 기록</h2> : null}
            {!isQualityEditorActive ? <p className="meta">기준 타임존: {APP_TIME_ZONE}</p> : null}
            {selectedEntryMode === null ? (
              <section className="entry-mode-picker" aria-label="작성 모드 선택">
                <h3>작성 방식을 선택하세요</h3>
                <div className="entry-mode-actions">
                  <button
                    type="button"
                    className="entry-mode-btn"
                    onClick={() => setSelectedEntryMode('simple')}
                  >
                    <strong>간편 작성</strong>
                  </button>
                  <button
                    type="button"
                    className="entry-mode-btn quality"
                    onClick={() => {
                      setSelectedEntryMode('quality')
                      setMyDiaryView('gallery')
                    }}
                  >
                    <strong>디자인 작성</strong>
                  </button>
                </div>
              </section>
            ) : selectedEntryMode === 'simple' ? (
              <section className="simple-entry" aria-label="간단 작성">
                <label htmlFor="simple-title">제목</label>
                <input
                  id="simple-title"
                  type="text"
                  className="simple-title-field"
                  value={entryTitle}
                  onChange={(event) => setEntryTitle(event.target.value)}
                  placeholder="오늘 기록 제목"
                  maxLength={40}
                />

                <label htmlFor="entry">내용</label>
                <textarea
                  id="entry"
                  className="diary-input"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="본문"
                />
                <p className="meta">{draft.trim().length}자</p>

                <label htmlFor="media">사진/파일/영상 첨부</label>
                <input
                  id="media"
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  onChange={handleMediaSelection}
                />
                {selectedMediaNames.length > 0 ? (
                  <p className="meta">선택된 파일: {selectedMediaNames.join(', ')}</p>
                ) : (
                  <p className="meta">선택된 첨부 파일이 없습니다.</p>
                )}

                <div className="actions">
                  <button type="button" onClick={() => persistTodayEntry('draft')}>
                    저장
                  </button>
                  <button type="button" onClick={() => persistTodayEntry('publish')}>
                    완료하고 올리기
                  </button>
                  <button type="button" className="ghost" onClick={deleteTodayEntry}>
                    오늘 기록 삭제
                  </button>
                </div>
              </section>
            ) : (
              <section className="quality-workspace" aria-label="퀄리티 일기 제작 공간">
                <header className="quality-topbar" aria-label="퀄리티 제작 설정 바">
                  <div className="quality-topbar-main">
                    <div className="quality-mode-tabs" role="tablist" aria-label="내 일기 모드">
                      <button
                        type="button"
                        role="tab"
                        aria-selected={myDiaryView === 'studio'}
                        className={`mode-tab ${myDiaryView === 'studio' ? 'active' : ''}`}
                        onClick={() => setMyDiaryView('studio')}
                      >
                        제작 스튜디오
                      </button>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={myDiaryView === 'gallery'}
                        className={`mode-tab ${myDiaryView === 'gallery' ? 'active' : ''}`}
                        onClick={() => setMyDiaryView('gallery')}
                      >
                        템플릿 갤러리
                      </button>
                      <button
                        type="button"
                        className="mode-tab"
                        onClick={() => setSelectedEntryMode(null)}
                      >
                        뒤로가기
                      </button>
                    </div>

                    <div className="quality-primary-actions">
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => setSelectedEntryMode(null)}
                      >
                        작성 방식 다시 고르기
                      </button>
                      <button type="button" onClick={() => persistTodayEntry('draft')}>
                        임시 저장
                      </button>
                      <button type="button" onClick={() => persistTodayEntry('publish')}>
                        완료하고 올리기
                      </button>
                      <button type="button" className="ghost" onClick={deleteTodayEntry}>
                        오늘 기록 삭제
                      </button>
                    </div>
                  </div>

                  {myDiaryView === 'studio' ? (
                    <div className="quality-settings-bar">
                      <div className="tool-row" role="group" aria-label="캔버스 비율">
                        <span className="tool-label">비율</span>
                        <div className="tool-chips">
                          <button
                            type="button"
                            className={`tool-chip ${canvasRatio === 'classic' ? 'active' : ''}`}
                            onClick={() => setCanvasRatio('classic')}
                          >
                            문서
                          </button>
                          <button
                            type="button"
                            className={`tool-chip ${canvasRatio === 'wide' ? 'active' : ''}`}
                            onClick={() => setCanvasRatio('wide')}
                          >
                            와이드
                          </button>
                          <button
                            type="button"
                            className={`tool-chip ${canvasRatio === 'story' ? 'active' : ''}`}
                            onClick={() => setCanvasRatio('story')}
                          >
                            스토리
                          </button>
                        </div>
                      </div>

                      <div className="tool-row" role="group" aria-label="텍스트 정렬">
                        <span className="tool-label">정렬</span>
                        <div className="tool-chips">
                          <button
                            type="button"
                            className={`tool-chip ${textAlignMode === 'left' ? 'active' : ''}`}
                            onClick={() => setTextAlignMode('left')}
                          >
                            왼쪽
                          </button>
                          <button
                            type="button"
                            className={`tool-chip ${textAlignMode === 'center' ? 'active' : ''}`}
                            onClick={() => setTextAlignMode('center')}
                          >
                            가운데
                          </button>
                          <button
                            type="button"
                            className={`tool-chip ${textAlignMode === 'right' ? 'active' : ''}`}
                            onClick={() => setTextAlignMode('right')}
                          >
                            오른쪽
                          </button>
                        </div>
                      </div>

                      <div className="quality-settings-actions">
                        <label className="sticker-picker" htmlFor="sticker-preset">
                          <span>스티커</span>
                          <select
                            id="sticker-preset"
                            value={selectedStickerPresetId}
                            onChange={(event) => setSelectedStickerPresetId(event.target.value)}
                          >
                            {STICKER_PRESETS.map((preset) => (
                              <option key={preset.id} value={preset.id}>
                                {preset.emoji} {preset.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <button type="button" className="ghost" onClick={addStickerToCanvas}>
                          스티커 추가
                        </button>
                        <button type="button" className="ghost" onClick={clearStickers}>
                          스티커 초기화
                        </button>
                        {selectedMovable ? (
                          <button
                            type="button"
                            className={`ghost ${isSelectionLocked(selectedMovable) ? 'active-tool' : ''}`}
                            onClick={toggleSelectedLock}
                          >
                            {isSelectionLocked(selectedMovable) ? '🔒 잠금 해제' : '🔓 잠그기'}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className={`ghost ${isTextEditMode ? 'active-tool' : ''}`}
                          onClick={() => setIsTextEditMode((prev) => !prev)}
                        >
                          {isTextEditMode ? '이동/크기 모드' : '텍스트 수정 모드'}
                        </button>
                        <button
                          type="button"
                          className="ghost"
                          onClick={() => {
                            setTitleBlockPosition({ x: 22, y: 20 })
                            setTitleBlockScale(1)
                            setBodyBlockPosition({ x: 22, y: 180 })
                            setBodyBlockScale(1)
                          }}
                        >
                          위치/크기 초기화
                        </button>
                        <label className="quality-media-picker" htmlFor="quality-media">
                          <span>미디어 첨부</span>
                          <input
                            id="quality-media"
                            type="file"
                            accept="image/*,video/*"
                            multiple
                            onChange={handleMediaSelection}
                          />
                        </label>
                      </div>

                      <p className="quality-counter">
                        {qualityDraft.trim().length}자 (최소 {ENTRY_MIN_LENGTH}자)
                      </p>
                    </div>
                  ) : null}

                  {selectedMediaNames.length > 0 ? (
                    <p className="meta quality-meta">선택된 파일: {selectedMediaNames.join(', ')}</p>
                  ) : (
                    <p className="meta quality-meta">선택된 미디어 파일이 없습니다.</p>
                  )}

                  {notice ? <p className="notice quality-notice">{notice}</p> : null}
                </header>

                {myDiaryView === 'studio' ? (
                  <div className="quality-canvas-stage" aria-label="디자인 기반 일기 편집기">
                    <div className="slide-editor-shell quality-stage-shell">
                      <div
                        ref={canvasRef}
                        className={`slide-editor-canvas ratio-${canvasRatio}`}
                        style={{ background: activeDesignPreset.preview }}
                      >
                        <div
                          className="slide-editor-overlay"
                          onPointerDown={(event) => {
                            if (event.target === event.currentTarget) {
                              setSelectedMovable(null)
                            }
                          }}
                        >
                          <div className="sticker-layer" aria-label="스티커 편집 레이어">
                            {placedStickers.map((sticker) => (
                              <div
                                key={sticker.id}
                                className={`sticker-item ${
                                  selectedMovable?.type === 'sticker' &&
                                  selectedMovable.stickerId === sticker.id
                                    ? 'is-selected'
                                    : ''
                                } ${
                                  isSelectionLocked({ type: 'sticker', stickerId: sticker.id })
                                    ? 'is-locked'
                                    : ''
                                }`}
                                style={{
                                  transform: `translate(${sticker.x}px, ${sticker.y}px) scale(${sticker.scale})`,
                                }}
                                onPointerDown={(event) => beginStickerDrag(sticker.id, event)}
                              >
                                <span className="sticker-emoji" aria-hidden="true">
                                  {getStickerEmoji(sticker.presetId)}
                                </span>
                                <button
                                  type="button"
                                  className="sticker-remove"
                                  aria-label="스티커 삭제"
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    removeSticker(sticker.id)
                                  }}
                                >
                                  ×
                                </button>
                                {selectedMovable?.type === 'sticker' &&
                                selectedMovable.stickerId === sticker.id ? (
                                  <>
                                    <button
                                      type="button"
                                      className="sticker-resize-handle"
                                      aria-label="스티커 크기 조절"
                                      onPointerDown={(event) => beginStickerResize(sticker.id, event)}
                                    />
                                    <button
                                      type="button"
                                      className="element-lock-toggle"
                                      onClick={(event) => {
                                        event.stopPropagation()
                                        toggleLockForSelection({ type: 'sticker', stickerId: sticker.id })
                                      }}
                                    >
                                      {isSelectionLocked({ type: 'sticker', stickerId: sticker.id })
                                        ? '🔒'
                                        : '🔓'}
                                    </button>
                                  </>
                                ) : null}
                              </div>
                            ))}
                          </div>

                          <div
                            ref={titleBlockRef}
                            className={`text-block-layer title-block ${isTextEditMode ? 'is-editing' : 'is-transform'} ${
                              selectedMovable?.type === 'title' ? 'is-selected' : ''
                            } ${isSelectionLocked({ type: 'title' }) ? 'is-locked' : ''}`}
                            style={{
                              transform: `translate(${titleBlockPosition.x}px, ${titleBlockPosition.y}px) scale(${titleBlockScale})`,
                              textAlign: textAlignMode,
                            }}
                            onPointerDown={(event) => beginTextBlockDrag('title', event)}
                          >
                            {isTextEditMode ? (
                              <>
                                <div className="text-block-title-zone">
                                  <input
                                    id="entry-title"
                                    className="slide-title-input"
                                    value={entryTitle}
                                    onChange={(event) => setEntryTitle(event.target.value)}
                                    placeholder="제목"
                                    maxLength={40}
                                  />
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="text-block-title-zone">
                                  <p className="slide-title-preview">{entryTitle || '제목'}</p>
                                </div>
                                <button
                                  type="button"
                                  aria-label="제목 블록 크기 조절"
                                  className="text-block-resize-handle"
                                  onPointerDown={(event) => beginTextBlockResize('title', event)}
                                />
                                {selectedMovable?.type === 'title' ? (
                                  <button
                                    type="button"
                                    className="element-lock-toggle"
                                    onClick={(event) => {
                                      event.stopPropagation()
                                      toggleLockForSelection({ type: 'title' })
                                    }}
                                  >
                                    {isSelectionLocked({ type: 'title' }) ? '🔒' : '🔓'}
                                  </button>
                                ) : null}
                              </>
                            )}
                          </div>

                          <div
                            ref={bodyBlockRef}
                            className={`text-block-layer body-block ${isTextEditMode ? 'is-editing' : 'is-transform'} ${
                              selectedMovable?.type === 'body' ? 'is-selected' : ''
                            } ${isSelectionLocked({ type: 'body' }) ? 'is-locked' : ''}`}
                            style={{
                              transform: `translate(${bodyBlockPosition.x}px, ${bodyBlockPosition.y}px) scale(${bodyBlockScale})`,
                              textAlign: textAlignMode,
                            }}
                            onPointerDown={(event) => beginTextBlockDrag('body', event)}
                          >
                            {isTextEditMode ? (
                              <div className="text-block-body-zone">
                                <textarea
                                  autoFocus
                                  id="entry"
                                  className="diary-input slide-editor-textarea"
                                  style={{ textAlign: textAlignMode }}
                                    value={qualityDraft}
                                    onChange={(event) => setQualityDraft(event.target.value)}
                                  placeholder="본문"
                                />
                              </div>
                            ) : (
                              <>
                                <div className="text-block-body-zone">
                                  <p className="slide-body-preview">{qualityDraft || '본문'}</p>
                                </div>
                                <button
                                  type="button"
                                  aria-label="본문 블록 크기 조절"
                                  className="text-block-resize-handle"
                                  onPointerDown={(event) => beginTextBlockResize('body', event)}
                                />
                                {selectedMovable?.type === 'body' ? (
                                  <button
                                    type="button"
                                    className="element-lock-toggle"
                                    onClick={(event) => {
                                      event.stopPropagation()
                                      toggleLockForSelection({ type: 'body' })
                                    }}
                                  >
                                    {isSelectionLocked({ type: 'body' }) ? '🔒' : '🔓'}
                                  </button>
                                ) : null}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="design-browser quality-gallery" aria-label="디자인 선택">
                    <h3>템플릿 갤러리</h3>
                    <p className="meta">PPT/캔바 느낌 템플릿 {DESIGN_PRESETS.length}개</p>
                    <div className="preset-grid">
                      {DESIGN_PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          className={`preset-card ${
                            draftDesign.templateId === preset.id ? 'active' : ''
                          }`}
                          onClick={() => applyDesignPreset(preset)}
                        >
                          <span
                            className="preset-thumb"
                            style={{ background: preset.preview }}
                            aria-hidden="true"
                          />
                          <strong>{preset.name}</strong>
                          <span>{preset.coverStyle} · {preset.paperStyle}</span>
                        </button>
                      ))}
                    </div>
                    <div className="actions compact-actions">
                      <button type="button" onClick={() => setMyDiaryView('studio')}>
                        제작 스튜디오로 돌아가기
                      </button>
                    </div>
                  </div>
                )}
              </section>
            )}
            {notice && !isQualityEditorActive ? <p className="notice">{notice}</p> : null}
          </section>
        </>
      ) : activeView === 'public-feed' ? (
        <section className="panel feed-panel" aria-label="다른 사람 일기">
          <div className="calendar-heading">
            <h2>다른 사람 일기</h2>
            <label className="calendar-date-picker">
              날짜 선택
              <input
                type="date"
                value={publicFeedDateKey}
                onChange={(event) => setPublicFeedDateKey(event.target.value)}
              />
            </label>
          </div>
          <p className="meta">완료 후 올린 글이 여기에 나타납니다.</p>
          <div className="feed-filter" role="tablist" aria-label="일기 유형 필터">
            <button
              type="button"
              role="tab"
              className={`feed-filter-chip ${publicFeedFilter === 'all' ? 'active' : ''}`}
              aria-selected={publicFeedFilter === 'all'}
              onClick={() => setPublicFeedFilter('all')}
            >
              전체
            </button>
            <button
              type="button"
              role="tab"
              className={`feed-filter-chip ${publicFeedFilter === 'simple' ? 'active' : ''}`}
              aria-selected={publicFeedFilter === 'simple'}
              onClick={() => setPublicFeedFilter('simple')}
            >
              간단한 일기
            </button>
            <button
              type="button"
              role="tab"
              className={`feed-filter-chip ${publicFeedFilter === 'quality' ? 'active' : ''}`}
              aria-selected={publicFeedFilter === 'quality'}
              onClick={() => setPublicFeedFilter('quality')}
            >
              퀄리티 일기
            </button>
          </div>
          <div className="feed-list">
            {filteredPublicFeedItems.length === 0 ? (
              <p className="empty">선택한 유형의 일기가 아직 없습니다.</p>
            ) : null}
            {filteredPublicFeedItems.map((item) => (
              <article key={item.id} className="feed-card">
                <h3>
                  {item.author}
                  {item.isMine ? <span className="feed-badge">내 업로드</span> : null}
                  <span
                    className={`feed-badge mode-badge ${
                      item.entryMode === 'quality' ? 'quality' : 'simple'
                    }`}
                  >
                    {item.entryMode === 'quality' ? '퀄리티' : '간단'}
                  </span>
                </h3>
                {item.entryMode === 'quality' && item.qualityView ? (
                  <>
                    <button
                      type="button"
                      className="quality-view-trigger"
                      onClick={() => setActiveFeedSlide(item.qualityView)}
                    >
                      {item.qualityView.title || '제목 없는 일기'}
                    </button>
                  </>
                ) : (
                  <p>{item.content}</p>
                )}
              </article>
            ))}
          </div>
        </section>
      ) : (
        <>
          <section className="panel my-entry-panel" aria-label="내가 올린 일기 내용">
            <h2>내가 올린 일기</h2>
            <p className="meta">최신순으로 최근 12개 표시</p>
            {myEntries.length === 0 ? (
              <p className="empty">아직 작성한 일기가 없습니다.</p>
            ) : (
              <div className="my-entry-list">
                {myEntries.map(([dateKey, entry]) => (
                  <article key={dateKey} className="my-entry-card">
                    <h3>{dateKey}</h3>
                    <p>{entry.content}</p>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="panel title-panel" aria-label="내 칭호">
            <div className="title-panel-heading">
              <div>
                <p className="eyebrow">현재 칭호</p>
                <h2>{currentTitle.title}</h2>
              </div>
              <span className="title-mark" aria-hidden="true">
                ✦
              </span>
            </div>
            <p className="meta">현재 스트릭 {currentStreak}일을 기록하고 있어요.</p>
            <div className="title-list" aria-label="칭호 목록">
              {STREAK_TITLES.filter((streakTitle) => currentStreak >= streakTitle.days).map(
                (streakTitle) => (
                  <div className="title-item unlocked" key={streakTitle.days}>
                    <span aria-hidden="true">✓</span>
                    <strong>{streakTitle.title}</strong>
                    <small>{streakTitle.days === 0 ? '첫 기록' : `${streakTitle.days}일 연속`}</small>
                  </div>
                ),
              )}
            </div>
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

          <section className="panel calendar-panel" aria-label="이번 달 캘린더">
            <div className="calendar-heading">
              <h2>이번 달 캘린더</h2>
              <label className="calendar-date-picker">
                날짜 선택
                <input
                  type="date"
                  value={selectedDateKey}
                  onChange={(event) => setSelectedDateKey(event.target.value)}
                />
              </label>
            </div>
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
        </>
      )}

      <nav
        className={`bottom-nav ${isCompactNavOpen ? 'compact-open' : ''}`}
        aria-label="하단 메뉴"
      >
        <button
          type="button"
          className="bottom-nav-toggle"
          aria-expanded={isCompactNavOpen}
          aria-controls="bottom-nav-items"
          onClick={() => setIsCompactNavOpen((current) => !current)}
        >
          {isCompactNavOpen ? '하단 메뉴 닫기' : '하단 메뉴 열기'}
        </button>

        <div id="bottom-nav-items" className="bottom-nav-items">
          <button
            type="button"
            className={activeView === 'my-diary' ? 'active' : ''}
            onClick={() => {
              setActiveView('my-diary')
              setIsCompactNavOpen(false)
            }}
          >
            내 일기
          </button>
          <button
            type="button"
            className={activeView === 'public-feed' ? 'active' : ''}
            onClick={() => {
              setSelectedEntryMode(null)
              setActiveView('public-feed')
              setIsCompactNavOpen(false)
            }}
          >
            다른 사람 일기
          </button>
          <button
            type="button"
            className={activeView === 'my-info' ? 'active' : ''}
            onClick={() => {
              setSelectedEntryMode(null)
              setActiveView('my-info')
              setIsCompactNavOpen(false)
            }}
          >
            내 정보
          </button>
        </div>
      </nav>

      {activeFeedSlide ? (
        <section className="slide-viewer-overlay" aria-label="퀄리티 일기 관전 뷰어">
          <article className="slide-viewer-panel">
            <div className="slide-viewer-header">
              <h2>{activeFeedSlide.author}의 퀄리티 일기</h2>
              <button type="button" className="ghost" onClick={() => setActiveFeedSlide(null)}>
                닫기
              </button>
            </div>

            <div
              className="slide-viewer-canvas"
              style={{
                background:
                  DESIGN_PRESETS.find((preset) => preset.id === activeFeedSlide.templateId)
                    ?.preview ?? DESIGN_PRESETS[0].preview,
              }}
            >
              <div className="sticker-layer" aria-label="스티커 미리보기">
                {activeFeedSlide.stickers.map((sticker) => (
                  <div
                    key={sticker.id}
                    className="sticker-view-item"
                    style={{
                      transform: `translate(${sticker.x}px, ${sticker.y}px) scale(${sticker.scale})`,
                    }}
                  >
                    {getStickerEmoji(sticker.presetId)}
                  </div>
                ))}
              </div>

              <div
                className="slide-viewer-block title"
                style={{
                  transform: `translate(${activeFeedSlide.titleBlock.x}px, ${activeFeedSlide.titleBlock.y}px) scale(${activeFeedSlide.titleBlock.scale})`,
                  textAlign: activeFeedSlide.textAlign,
                }}
              >
                <span className="text-zone-label">제목</span>
                <p className="slide-title-preview">{activeFeedSlide.title || '제목 없음'}</p>
              </div>

              <div
                className="slide-viewer-block body"
                style={{
                  transform: `translate(${activeFeedSlide.bodyBlock.x}px, ${activeFeedSlide.bodyBlock.y}px) scale(${activeFeedSlide.bodyBlock.scale})`,
                  textAlign: activeFeedSlide.textAlign,
                }}
              >
                <span className="text-zone-label">본문</span>
                <p className="slide-body-preview">{activeFeedSlide.body || '내용 없음'}</p>
              </div>
            </div>

            {activeFeedSlide.isMine ? (
              <div className="slide-viewer-actions">
                <button
                  type="button"
                  onClick={() => {
                    setActiveFeedSlide(null)
                    setActiveView('my-diary')
                    setSelectedEntryMode('quality')
                    setMyDiaryView('studio')
                  }}
                >
                  내 작업으로 돌아가 편집하기
                </button>
              </div>
            ) : (
              <p className="meta slide-viewer-readonly">작성자 외에는 관전만 가능합니다.</p>
            )}
          </article>
        </section>
      ) : null}
    </main>
  )
}

export default App
