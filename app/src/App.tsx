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
  canEditEntry,
  formatHistoryDate,
  getCurrentMonthDays,
  getDateKey,
  getOrCreateAnonymousUserId,
  getRecentPeriodCount,
  getStreakTitle,
  loadDiaryDesigns,
  loadEntries,
  saveDiaryDesigns,
  saveEntries,
  SELECTED_TITLE_KEY,
  toISO,
  validateEntryContent,
  type DiaryDesign,
  type DiaryDesignByDate,
  type EntryByDate,
  type EntryHistoryItem,
  type MediaAttachment,
} from './lib/entryDomain'
import { deleteMediaFiles, loadMediaFiles, saveMediaFiles } from './lib/mediaStore'
import {
  pullCloudDiaryDesigns,
  pullCloudEntries,
  pullPublicFeedEntries,
  pushCloudDiaryDesigns,
  pushCloudEntries,
  type SharedFeedEntry,
} from './lib/supabaseSync'

type ActiveView = 'my-diary' | 'public-feed' | 'my-info'
type MyDiaryView = 'studio' | 'gallery'
type CanvasRatio = 'classic' | 'wide' | 'story'
type TextAlignMode = 'left' | 'center' | 'right'
type DiaryEntryMode = 'simple' | 'quality'
type FeedViewFilter = 'all' | DiaryEntryMode
type SelectedMedia = { id: string; file: File; attachment: MediaAttachment }
type BlockPoint = { x: number; y: number }
type TextBlockTarget = 'title' | 'body'
type SlideBlockSnapshot = { x: number; y: number; scale: number; rotation?: number }
type StickerSnapshot = {
  id: string
  presetId: string
  x: number
  y: number
  scale: number
  rotation?: number
}
type MovableSelection =
  | { type: 'title' }
  | { type: 'body' }
  | { type: 'image'; imageId: string }
  | { type: 'sticker'; stickerId: string }
type CanvasImageSnapshot = {
  id: string
  mediaId: string
  name: string
  x: number
  y: number
  width: number
  height: number
  rotation?: number
  src?: string
  file?: File
}
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
  backgroundColor: string
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

type ImageDragState = {
  imageId: string
  action: 'drag' | 'resize'
  startPointerX: number
  startPointerY: number
  startX: number
  startY: number
  startWidth: number
  startHeight: number
} | null

type RotationDragState = {
  selection: MovableSelection
  centerX: number
  centerY: number
  startPointerAngle: number
  startRotation: number
} | null

type StickerPreset = {
  id: string
  name: string
  emoji: string
}

type PaperPreset = {
  paperStyle: string
  pattern: string
  defaultColor: string
}

type DiaryDesignPreset = {
  id: string
  name: string
  paperStyle: string
  pattern: string
  preview: string
  defaultColor: string
}

const PAPER_PRESETS: PaperPreset[] = [
  {
    paperStyle: '줄노트',
    pattern:
      'repeating-linear-gradient(0deg, rgba(255, 255, 255, 0.25) 0px, rgba(255, 255, 255, 0.25) 1px, transparent 1px, transparent 11px)',
    defaultColor: '#1b5e57',
  },
  {
    paperStyle: '모눈',
    pattern:
      'repeating-linear-gradient(0deg, rgba(255, 255, 255, 0.22) 0px, rgba(255, 255, 255, 0.22) 1px, transparent 1px, transparent 12px), repeating-linear-gradient(90deg, rgba(255, 255, 255, 0.22) 0px, rgba(255, 255, 255, 0.22) 1px, transparent 1px, transparent 12px)',
    defaultColor: '#1f4f8a',
  },
  {
    paperStyle: '무지',
    pattern: 'linear-gradient(180deg, rgba(255, 255, 255, 0.24), rgba(255, 255, 255, 0.1))',
    defaultColor: '#a34a2f',
  },
]

const DESIGN_PRESETS: DiaryDesignPreset[] = PAPER_PRESETS.map((paper) => ({
  id: paper.paperStyle,
  name: paper.paperStyle,
  paperStyle: paper.paperStyle,
  pattern: paper.pattern,
  preview: `${paper.pattern}, linear-gradient(145deg, ${paper.defaultColor}, ${paper.defaultColor})`,
  defaultColor: paper.defaultColor,
}))

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
  coverStyle: '사용자 색상',
  color: DESIGN_PRESETS[0].defaultColor,
}

function getDesignPreset(templateId: string): DiaryDesignPreset {
  return DESIGN_PRESETS.find((preset) => preset.id === templateId) ?? DESIGN_PRESETS[0]
}

function getDesignPreview(preset: DiaryDesignPreset, color: string): string {
  return `${preset.pattern}, linear-gradient(145deg, ${color}, ${color})`
}

function normalizeDiaryDesign(design?: Partial<DiaryDesign>): DiaryDesign {
  const templateId = design?.templateId ?? DEFAULT_DIARY_DESIGN.templateId
  const preset = getDesignPreset(templateId)

  return {
    templateId,
    paperStyle: design?.paperStyle ?? preset.paperStyle,
    coverStyle: design?.coverStyle ?? DEFAULT_DIARY_DESIGN.coverStyle,
    color: design?.color ?? preset.defaultColor,
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

function getMediaKind(type: string): MediaAttachment['kind'] {
  if (type.startsWith('image/')) {
    return 'image'
  }

  if (type.startsWith('video/')) {
    return 'video'
  }

  return 'file'
}

function createMediaId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `media-${Math.random().toString(36).slice(2, 10)}`
}

function formatFileSize(size: number): string {
  if (size < 1024) {
    return `${size} B`
  }

  if (size < 1024 * 1024) {
    return `${Math.round(size / 1024)} KB`
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function persistEntries(next: EntryByDate): void {
  saveEntries(next)
  void pushCloudEntries(next)
}

function persistDiaryDesigns(next: DiaryDesignByDate): void {
  saveDiaryDesigns(next)
  void pushCloudDiaryDesigns(next)
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
  const [colorHex, setColorHex] = useState(() => draftDesign.color.slice(1))
  const [myDiaryView, setMyDiaryView] = useState<MyDiaryView>('studio')
  const [canvasRatio, setCanvasRatio] = useState<CanvasRatio>('classic')
  const [textAlignMode, setTextAlignMode] = useState<TextAlignMode>('left')
  const [entryTitle, setEntryTitle] = useState('')
  const [selectedEntryMode, setSelectedEntryMode] = useState<DiaryEntryMode | null>(null)
  const [selectedMedia, setSelectedMedia] = useState<SelectedMedia[]>([])
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false)
  const [placedImages, setPlacedImages] = useState<CanvasImageSnapshot[]>(() =>
    (entries[todayKey]?.qualitySnapshot?.images ?? []).map((image) => ({ ...image })),
  )
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({})
  const [activeEntryDateKey, setActiveEntryDateKey] = useState<string | null>(null)
  const [activeHistoryTarget, setActiveHistoryTarget] = useState<{
    dateKey: string
    content: string
    updatedAt: string
    history: EntryHistoryItem[]
  } | null>(null)
  const [notice, setNotice] = useState('')
  const [activeView, setActiveView] = useState<ActiveView>('my-diary')
  const [selectedTitle, setSelectedTitle] = useState(() => localStorage.getItem(SELECTED_TITLE_KEY) ?? '')
  const [isCompactNavOpen, setIsCompactNavOpen] = useState(false)
  const [publicFeedFilter, setPublicFeedFilter] = useState<FeedViewFilter>('all')
  const [publicFeedDateKey, setPublicFeedDateKey] = useState(todayKey)
  const [selectedDateKey, setSelectedDateKey] = useState(todayKey)
  const [titleBlockPosition, setTitleBlockPosition] = useState<BlockPoint>({ x: 22, y: 20 })
  const [titleBlockScale, setTitleBlockScale] = useState(1)
  const [titleBlockRotation, setTitleBlockRotation] = useState(0)
  const [bodyBlockPosition, setBodyBlockPosition] = useState<BlockPoint>({ x: 22, y: 180 })
  const [bodyBlockScale, setBodyBlockScale] = useState(1)
  const [bodyBlockRotation, setBodyBlockRotation] = useState(0)
  const [selectedStickerPresetId, setSelectedStickerPresetId] = useState(STICKER_PRESETS[0].id)
  const [placedStickers, setPlacedStickers] = useState<StickerSnapshot[]>([])
  const [selectedMovable, setSelectedMovable] = useState<MovableSelection | null>(null)
  const [lockedTargets, setLockedTargets] = useState<Record<string, boolean>>({})
  const [isTextEditMode, setIsTextEditMode] = useState(false)
  const [activeFeedSlide, setActiveFeedSlide] = useState<FeedSlideView | null>(null)
  const dragStateRef = useRef<TextBlockDragState>(null)
  const stickerDragStateRef = useRef<StickerDragState>(null)
  const imageDragStateRef = useRef<ImageDragState>(null)
  const rotationDragStateRef = useRef<RotationDragState>(null)
  const addMediaInputRef = useRef<HTMLInputElement | null>(null)
  const insertMediaInputRef = useRef<HTMLInputElement | null>(null)
  const canvasRef = useRef<HTMLDivElement | null>(null)
  const titleBlockRef = useRef<HTMLDivElement | null>(null)
  const bodyBlockRef = useRef<HTMLDivElement | null>(null)
  const isQualityEditorActive =
    activeView === 'my-diary' && selectedEntryMode === 'quality'

  const todayAttachments =
    selectedMedia.length > 0
      ? selectedMedia.map(({ attachment }) => attachment)
      : entries[todayKey]?.attachments ?? []

  const [sharedFeedEntries, setSharedFeedEntries] = useState<SharedFeedEntry[]>([])

  // 다른 기기/브라우저에서 접속했을 때 최신 기록을 병합해온다 (Supabase 미설정 시 아무 동작 없음).
  useEffect(() => {
    let cancelled = false

    void Promise.all([pullCloudEntries(), pullCloudDiaryDesigns()]).then(
      ([cloudEntries, cloudDesigns]) => {
        if (cancelled) {
          return
        }

        if (cloudEntries) {
          setEntries((current) => {
            const merged: EntryByDate = { ...current }
            Object.entries(cloudEntries).forEach(([dateKey, cloudEntry]) => {
              const localEntry = merged[dateKey]
              if (!localEntry || cloudEntry.updatedAt > localEntry.updatedAt) {
                merged[dateKey] = cloudEntry
              }
            })
            saveEntries(merged)
            return merged
          })
        }

        if (cloudDesigns) {
          setDesignByDate((current) => {
            const merged = { ...cloudDesigns, ...current }
            saveDiaryDesigns(merged)
            return merged
          })
        }
      },
    )

    void pullPublicFeedEntries().then((shared) => {
      if (!cancelled) {
        setSharedFeedEntries(shared)
      }
    })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const ids = Object.values(entries).flatMap((entry) => [
      ...(entry.attachments ?? []).map((attachment) => attachment.id),
      ...(entry.qualitySnapshot?.images ?? []).map((image) => image.mediaId),
    ])
    let cancelled = false
    const nextUrls: Record<string, string> = {}

    void loadMediaFiles(ids).then((files) => {
      if (cancelled) {
        return
      }

      Object.entries(files).forEach(([id, file]) => {
        nextUrls[id] = URL.createObjectURL(file)
      })
      setMediaUrls(nextUrls)
    })

    return () => {
      cancelled = true
      Object.values(nextUrls).forEach((url) => URL.revokeObjectURL(url))
    }
  }, [entries])

  const { currentStreak, bestStreak, monthlyGraceUsed } = useMemo(
    () => calculateStreak(entries),
    [entries],
  )
  const currentTitle = getStreakTitle(currentStreak)
  const unlockedTitles = STREAK_TITLES.filter((streakTitle) => currentStreak >= streakTitle.days)
  const displayedTitle = unlockedTitles.some((streakTitle) => streakTitle.title === selectedTitle)
    ? selectedTitle
    : currentTitle.title

  const totalEntries = Object.keys(entries).length
  const recent7 = useMemo(() => getRecentPeriodCount(entries, 7), [entries])
  const recent30 = useMemo(() => getRecentPeriodCount(entries, 30), [entries])

  const monthDays = useMemo(() => getCurrentMonthDays(), [])
  const selectedEntry = entries[selectedDateKey]
  const activeEntry = activeEntryDateKey ? entries[activeEntryDateKey] : undefined
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
              backgroundColor:
                entry.qualitySnapshot?.backgroundColor ?? design.color,
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
        attachments: entry.attachments ?? [],
        entryMode: entry.entryMode ?? 'simple',
        isMine: true,
        displayedTitle,
        streakDays: currentStreak,
        updatedAt: entry.updatedAt,
        history: entry.history ?? [],
      }))

    const othersPublicEntries = sharedFeedEntries.map((shared, index) => {
      const qualityView: FeedSlideView | null =
        shared.entryMode === 'quality' && shared.qualitySnapshot
          ? {
              author: shared.authorLabel,
              isMine: false,
              title: shared.qualitySnapshot.title,
              body: shared.qualitySnapshot.body,
              backgroundColor: shared.qualitySnapshot.backgroundColor ?? '#1b5e57',
              templateId: shared.qualitySnapshot.templateId,
              textAlign: shared.qualitySnapshot.textAlign,
              titleBlock: shared.qualitySnapshot.titleBlock,
              bodyBlock: shared.qualitySnapshot.bodyBlock,
              stickers: shared.qualitySnapshot.stickers ?? [],
            }
          : null

      return {
        qualityView,
        id: `shared-${index}-${shared.dateKey}`,
        dateKey: shared.dateKey,
        author: shared.authorLabel,
        content: shared.content,
        attachments: [] as MediaAttachment[],
        entryMode: shared.entryMode,
        isMine: false,
        displayedTitle: '',
        streakDays: 0,
        updatedAt: shared.updatedAt,
        history: shared.history ?? [],
      }
    })

    return [...myPublicEntries, ...othersPublicEntries]
  }, [currentStreak, designByDate, displayedTitle, entries, sharedFeedEntries])
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
    () => getDesignPreset(draftDesign.templateId),
    [draftDesign.templateId],
  )
  const activeDesignPreview = getDesignPreview(activeDesignPreset, draftDesign.color)

  function getSelectionLockKey(selection: MovableSelection): string {
    if (selection.type === 'image') {
      return `image:${selection.imageId}`
    }

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

  function getElementRotation(selection: MovableSelection): number {
    if (selection.type === 'title') {
      return titleBlockRotation
    }

    if (selection.type === 'body') {
      return bodyBlockRotation
    }

    if (selection.type === 'image') {
      return placedImages.find((image) => image.id === selection.imageId)?.rotation ?? 0
    }

    return placedStickers.find((sticker) => sticker.id === selection.stickerId)?.rotation ?? 0
  }

  function setElementRotation(selection: MovableSelection, rotation: number): void {
    const normalizedRotation = ((rotation % 360) + 360) % 360

    if (selection.type === 'title') {
      setTitleBlockRotation(normalizedRotation)
    } else if (selection.type === 'body') {
      setBodyBlockRotation(normalizedRotation)
    } else if (selection.type === 'image') {
      setPlacedImages((current) =>
        current.map((image) =>
          image.id === selection.imageId ? { ...image, rotation: normalizedRotation } : image,
        ),
      )
    } else {
      setPlacedStickers((current) =>
        current.map((sticker) =>
          sticker.id === selection.stickerId
            ? { ...sticker, rotation: normalizedRotation }
            : sticker,
        ),
      )
    }
  }

  function beginElementRotation(
    selection: MovableSelection,
    event: ReactPointerEvent<HTMLButtonElement>,
  ): void {
    event.stopPropagation()
    event.preventDefault()

    if (isSelectionLocked(selection)) {
      return
    }

    const handle = event.currentTarget
    const element = handle.parentElement
    if (!element) {
      return
    }

    const bounds = element.getBoundingClientRect()
    const centerX = bounds.left + bounds.width / 2
    const centerY = bounds.top + bounds.height / 2
    const startPointerAngle = Math.atan2(event.clientY - centerY, event.clientX - centerX)

    setSelectedMovable(selection)
    rotationDragStateRef.current = {
      selection,
      centerX,
      centerY,
      startPointerAngle,
      startRotation: getElementRotation(selection),
    }
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

  function clampCanvasImage(image: CanvasImageSnapshot): CanvasImageSnapshot {
    const bounds = getCanvasBounds()

    if (!bounds) {
      return image
    }

    const minOffset = 4
    return {
      ...image,
      x: clampValue(image.x, minOffset, Math.max(minOffset, bounds.width - image.width - minOffset)),
      y: clampValue(image.y, minOffset, Math.max(minOffset, bounds.height - image.height - minOffset)),
    }
  }

  useEffect(() => {
    function onRotationPointerMove(event: PointerEvent) {
      const dragState = rotationDragStateRef.current

      if (!dragState) {
        return
      }

      const pointerAngle = Math.atan2(
        event.clientY - dragState.centerY,
        event.clientX - dragState.centerX,
      )
      const angleDelta = ((pointerAngle - dragState.startPointerAngle) * 180) / Math.PI
      setElementRotation(dragState.selection, dragState.startRotation + angleDelta)
    }

    function onRotationPointerUp() {
      rotationDragStateRef.current = null
    }

    window.addEventListener('pointermove', onRotationPointerMove)
    window.addEventListener('pointerup', onRotationPointerUp)

    return () => {
      window.removeEventListener('pointermove', onRotationPointerMove)
      window.removeEventListener('pointerup', onRotationPointerUp)
    }
  }, [bodyBlockRotation, placedImages, placedStickers, titleBlockRotation])

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
    function onImagePointerMove(event: PointerEvent) {
      const dragState = imageDragStateRef.current

      if (!dragState) {
        return
      }

      const deltaX = event.clientX - dragState.startPointerX
      const deltaY = event.clientY - dragState.startPointerY

      if (dragState.action === 'resize') {
        const aspectRatio = dragState.startWidth / dragState.startHeight
        const nextWidth = clampValue(dragState.startWidth + deltaX, 80, 640)
        const nextHeight = nextWidth / aspectRatio

        setPlacedImages((current) =>
          current.map((image) =>
            image.id === dragState.imageId
              ? clampCanvasImage({ ...image, width: nextWidth, height: nextHeight })
              : image,
          ),
        )
        return
      }

      setPlacedImages((current) =>
        current.map((image) =>
          image.id === dragState.imageId
            ? clampCanvasImage({
                ...image,
                x: dragState.startX + deltaX,
                y: dragState.startY + deltaY,
              })
            : image,
        ),
      )
    }

    function onImagePointerUp() {
      imageDragStateRef.current = null
    }

    window.addEventListener('pointermove', onImagePointerMove)
    window.addEventListener('pointerup', onImagePointerUp)

    return () => {
      window.removeEventListener('pointermove', onImagePointerMove)
      window.removeEventListener('pointerup', onImagePointerUp)
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
      setPlacedImages((current) => current.map((image) => clampCanvasImage(image)))
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

  function beginCanvasImageDrag(imageId: string, event: ReactPointerEvent<HTMLDivElement>) {
    const targetElement = event.target as HTMLElement | null
    if (
      targetElement?.closest('.canvas-image-resize') ||
      targetElement?.closest('.canvas-image-remove') ||
      targetElement?.closest('.element-lock-toggle') ||
      targetElement?.closest('.element-rotate-toggle')
    ) {
      return
    }

    event.stopPropagation()
    event.preventDefault()

    const selection: MovableSelection = { type: 'image', imageId }
    setSelectedMovable(selection)

    if (isSelectionLocked(selection)) {
      return
    }

    const targetImage = placedImages.find((image) => image.id === imageId)
    if (!targetImage) {
      return
    }

    imageDragStateRef.current = {
      imageId,
      action: 'drag',
      startPointerX: event.clientX,
      startPointerY: event.clientY,
      startX: targetImage.x,
      startY: targetImage.y,
      startWidth: targetImage.width,
      startHeight: targetImage.height,
    }
  }

  function beginCanvasImageResize(imageId: string, event: ReactPointerEvent<HTMLButtonElement>) {
    event.stopPropagation()
    event.preventDefault()

    const selection: MovableSelection = { type: 'image', imageId }
    setSelectedMovable(selection)

    if (isSelectionLocked(selection)) {
      return
    }

    const targetImage = placedImages.find((image) => image.id === imageId)
    if (!targetImage) {
      return
    }

    imageDragStateRef.current = {
      imageId,
      action: 'resize',
      startPointerX: event.clientX,
      startPointerY: event.clientY,
      startX: targetImage.x,
      startY: targetImage.y,
      startWidth: targetImage.width,
      startHeight: targetImage.height,
    }
  }

  function removeCanvasImage(imageId: string) {
    setPlacedImages((current) => current.filter((image) => image.id !== imageId))
    setSelectedMovable((current) =>
      current?.type === 'image' && current.imageId === imageId ? null : current,
    )
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

  function startEditingEntry(dateKey: string) {
    if (!canEditEntry(dateKey, new Date())) {
      setNotice('수정할 수 있는 시간이 지났습니다. 작성 당일에만 수정할 수 있습니다.')
      return
    }

    const targetEntry = entries[dateKey]
    if (!targetEntry) {
      return
    }

    setActiveView('my-diary')
    setActiveEntryDateKey(null)

    const mode = targetEntry.entryMode ?? 'simple'
    setSelectedEntryMode(mode)

    if (mode === 'quality' && targetEntry.qualitySnapshot) {
      setEntryTitle(targetEntry.qualitySnapshot.title || '')
      setQualityDraft(targetEntry.qualitySnapshot.body || '')
    } else {
      const parts = splitTitleAndBody(targetEntry.content)
      setEntryTitle(parts.title)
      setDraft(parts.body || targetEntry.content)
    }

    setNotice(`${dateKey} 기록을 수정 중입니다.`)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function persistTodayEntry(mode: 'draft' | 'publish') {
    if (!canEditEntry(todayKey, new Date())) {
      setNotice('수정할 수 있는 시간이 지났습니다. 작성 당일에만 수정할 수 있습니다.')
      return
    }

    const contentDraft = selectedEntryMode === 'quality' ? qualityDraft : draft
    const validationError = validateEntryContent(contentDraft)
    if (validationError) {
      setNotice(validationError)
      return
    }

    const trimmed = contentDraft.trim()
    const trimmedTitle = entryTitle.trim()
    const composedContent = trimmedTitle ? `${trimmedTitle}\n\n${trimmed}` : trimmed
    const attachments =
      selectedMedia.length > 0
        ? selectedMedia.map(({ attachment }) => attachment)
        : entries[todayKey]?.attachments ?? []

    await saveMediaFiles([
      ...selectedMedia.map(({ id, file }) => ({ id, file })),
      ...placedImages
        .filter((image): image is CanvasImageSnapshot & { file: File } => Boolean(image.file))
        .map(({ mediaId, file }) => ({ id: mediaId, file })),
    ])

    const now = toISO(new Date())
    const existing = entries[todayKey]
    const existingHistory: EntryHistoryItem[] = existing?.history ? [...existing.history] : []
    if (existing && existing.content !== composedContent) {
      existingHistory.push({
        content: existing.content,
        updatedAt: existing.updatedAt || existing.createdAt,
      })
    }

    const next: EntryByDate = {
      ...entries,
      [todayKey]: {
        content: composedContent,
        createdAt: entries[todayKey]?.createdAt ?? now,
        updatedAt: now,
        history: existingHistory,
        attachments,
        entryMode: selectedEntryMode ?? 'simple',
        authorId: anonymousUserId,
        isShared: mode === 'publish' ? true : entries[todayKey]?.isShared,
        qualitySnapshot:
          selectedEntryMode === 'quality'
            ? {
                title: trimmedTitle,
                body: trimmed,
              backgroundColor: draftDesign.color,
                templateId: draftDesign.templateId,
                images: placedImages.map(({ file: _file, src: _src, ...image }) => image),
                textAlign: textAlignMode,
                titleBlock: {
                  x: titleBlockPosition.x,
                  y: titleBlockPosition.y,
                  scale: titleBlockScale,
                  rotation: titleBlockRotation,
                },
                bodyBlock: {
                  x: bodyBlockPosition.x,
                  y: bodyBlockPosition.y,
                  scale: bodyBlockScale,
                  rotation: bodyBlockRotation,
                },
                stickers: placedStickers,
              }
            : undefined,
      },
    }

    setEntries(next)
    persistEntries(next)

    if (mode === 'publish') {
      setActiveView('public-feed')
      setNotice('제작 완료. 공개 피드에 올렸습니다.')
      void pullPublicFeedEntries().then(setSharedFeedEntries)
      return
    }

    setNotice(entries[todayKey] ? '오늘 기록 초안을 수정했습니다.' : '오늘 기록 초안을 저장했습니다.')
  }

  function applyDesignPreset(preset: DiaryDesignPreset) {
    const nextDesign: DiaryDesign = {
      templateId: preset.id,
      coverStyle: '사용자 색상',
      paperStyle: preset.paperStyle,
      color: preset.defaultColor,
    }

    const nextByDate: DiaryDesignByDate = {
      ...designByDate,
      [todayKey]: nextDesign,
    }

    setDraftDesign(nextDesign)
    setColorHex(nextDesign.color.slice(1))
    setDesignByDate(nextByDate)
    persistDiaryDesigns(nextByDate)
    setNotice('템플릿을 적용했습니다.')
  }

  function updateDesignColor(color: string): void {
    const normalizedColor = color.toLowerCase()
    if (!/^#[0-9a-f]{6}$/.test(normalizedColor)) {
      return
    }

    const nextDesign = { ...draftDesign, color: normalizedColor }
    const nextByDate: DiaryDesignByDate = {
      ...designByDate,
      [todayKey]: nextDesign,
    }

    setDraftDesign(nextDesign)
    setColorHex(normalizedColor.slice(1))
    setDesignByDate(nextByDate)
    persistDiaryDesigns(nextByDate)
  }

  function handleMediaSelection(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files

    if (!files) {
      setSelectedMedia([])
      setMediaPickerOpen(false)
      return
    }

    setMediaPickerOpen(false)
    setSelectedMedia(
      Array.from(files).map((file) => {
        const id = createMediaId()
        return {
          id,
          file,
          attachment: {
            id,
            name: file.name,
            type: file.type || 'application/octet-stream',
            size: file.size,
            kind: getMediaKind(file.type),
          },
        }
      }),
    )
  }

  function handleCanvasImageSelection(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []).filter((file) =>
      file.type.startsWith('image/'),
    )

    setMediaPickerOpen(false)
    if (files.length === 0) {
      setNotice('파일 삽입은 이미지 파일만 지원합니다.')
      return
    }

    const nextImages = files.map((file, index) => {
      const mediaId = createMediaId()
      return {
        id: createMediaId(),
        mediaId,
        name: file.name,
        x: 24 + (index % 3) * 34,
        y: 96 + Math.floor(index / 3) * 34,
        width: 220,
        height: 146,
        src: URL.createObjectURL(file),
        file,
      }
    })

    setPlacedImages((current) => [...current, ...nextImages])
    setSelectedMovable({ type: 'image', imageId: nextImages[0].id })
    setNotice('이미지를 캔버스에 삽입했습니다. 드래그하거나 모서리에서 크기를 조절해보세요.')
  }

  function deleteTodayEntry() {
    if (!entries[todayKey]) {
      setNotice('삭제할 오늘 기록이 없습니다.')
      return
    }

    const next = { ...entries }
    delete next[todayKey]

    setEntries(next)
    persistEntries(next)
    void deleteMediaFiles(entries[todayKey]?.attachments?.map(({ id }) => id) ?? [])
    setNotice('오늘 기록을 삭제했습니다.')
  }

  function selectTitle(title: (typeof STREAK_TITLES)[number]): void {
    if (currentStreak < title.days) {
      return
    }

    setSelectedTitle(title.title)
    localStorage.setItem(SELECTED_TITLE_KEY, title.title)
  }

  return (
    <main className={`app-shell ${isQualityEditorActive ? 'quality-editor-mode' : ''}`}>
      <header className="hero">
        <div className="hero-title-row">
          <h1>원데이</h1>
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
                  accept="image/*,video/*,.pdf,.txt,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                  multiple
                  onChange={handleMediaSelection}
                />
                {todayAttachments.length > 0 ? (
                  <p className="meta">선택된 파일: {todayAttachments.map(({ name }) => name).join(', ')}</p>
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
                        <div className="quality-media-picker">
                          <button
                            type="button"
                            className="ghost"
                            onClick={() => setMediaPickerOpen((current) => !current)}
                          >
                            파일
                          </button>
                          {mediaPickerOpen ? (
                            <div className="media-picker-menu" role="menu" aria-label="파일 작업 선택">
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => addMediaInputRef.current?.click()}
                              >
                                파일 추가
                              </button>
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => insertMediaInputRef.current?.click()}
                              >
                                파일 삽입
                              </button>
                            </div>
                          ) : null}
                          <input
                            ref={addMediaInputRef}
                            id="quality-media-add"
                            className="media-file-input-hidden"
                            aria-label="파일 추가"
                            type="file"
                            accept="image/*,video/*,.pdf,.txt,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                            multiple
                            onChange={handleMediaSelection}
                          />
                          <input
                            ref={insertMediaInputRef}
                            id="quality-media-insert"
                            className="media-file-input-hidden"
                            aria-label="파일 삽입"
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={handleCanvasImageSelection}
                          />
                        </div>
                      </div>

                      <p className="quality-counter">
                        {qualityDraft.trim().length}자 (최소 {ENTRY_MIN_LENGTH}자)
                      </p>
                    </div>
                  ) : null}

                  {todayAttachments.length > 0 ? (
                    <p className="meta quality-meta">선택된 파일: {todayAttachments.map(({ name }) => name).join(', ')}</p>
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
                        style={{ background: activeDesignPreview }}
                      >
                        <div
                          className="slide-editor-overlay"
                          onPointerDown={(event) => {
                            if (event.target === event.currentTarget) {
                              setSelectedMovable(null)
                            }
                          }}
                        >
                          <div className="canvas-image-layer" aria-label="삽입 이미지 레이어">
                            {placedImages.map((image) => {
                              const imageUrl = image.src ?? mediaUrls[image.mediaId]
                              const selected =
                                selectedMovable?.type === 'image' &&
                                selectedMovable.imageId === image.id

                              return (
                                <div
                                  key={image.id}
                                  className={`canvas-image-item ${selected ? 'is-selected' : ''}`}
                                  style={{
                                    width: image.width,
                                    height: image.height,
                                    transform: `translate(${image.x}px, ${image.y}px) rotate(${image.rotation ?? 0}deg)`,
                                  }}
                                  onPointerDown={(event) => beginCanvasImageDrag(image.id, event)}
                                >
                                  {imageUrl ? <img src={imageUrl} alt={image.name} draggable={false} /> : null}
                                  {selected ? (
                                    <>
                                      <button
                                        type="button"
                                        className="canvas-image-remove"
                                        aria-label={`${image.name} 삭제`}
                                        onClick={() => removeCanvasImage(image.id)}
                                      >
                                        ×
                                      </button>
                                      <button
                                        type="button"
                                        className="canvas-image-resize"
                                        aria-label={`${image.name} 크기 조절`}
                                        onPointerDown={(event) => beginCanvasImageResize(image.id, event)}
                                      />
                                      <button
                                        type="button"
                                        className="element-lock-toggle"
                                        onClick={(event) => {
                                          event.stopPropagation()
                                          toggleLockForSelection({ type: 'image', imageId: image.id })
                                        }}
                                      >
                                        {isSelectionLocked({ type: 'image', imageId: image.id }) ? '🔒' : '🔓'}
                                      </button>
                                      <button
                                        type="button"
                                        className="element-rotate-toggle"
                                        title="이미지 15도 회전"
                                        aria-label="이미지 15도 회전"
                                        disabled={isSelectionLocked({ type: 'image', imageId: image.id })}
                                        onPointerDown={(event) =>
                                          beginElementRotation({ type: 'image', imageId: image.id }, event)
                                        }
                                      >
                                        ↻
                                      </button>
                                    </>
                                  ) : null}
                                </div>
                              )
                            })}
                          </div>

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
                                  transform: `translate(${sticker.x}px, ${sticker.y}px) rotate(${sticker.rotation ?? 0}deg) scale(${sticker.scale})`,
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
                                    <button
                                      type="button"
                                      className="element-rotate-toggle"
                                      title="스티커 15도 회전"
                                      aria-label="스티커 15도 회전"
                                      disabled={isSelectionLocked({ type: 'sticker', stickerId: sticker.id })}
                                      onPointerDown={(event) =>
                                        beginElementRotation(
                                          { type: 'sticker', stickerId: sticker.id },
                                          event,
                                        )
                                      }
                                    >
                                      ↻
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
                              transform: `translate(${titleBlockPosition.x}px, ${titleBlockPosition.y}px) rotate(${titleBlockRotation}deg) scale(${titleBlockScale})`,
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
                                  <>
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
                                    <button
                                      type="button"
                                      className="element-rotate-toggle"
                                      title="제목 15도 회전"
                                      aria-label="제목 15도 회전"
                                      disabled={isSelectionLocked({ type: 'title' })}
                                      onPointerDown={(event) =>
                                        beginElementRotation({ type: 'title' }, event)
                                      }
                                    >
                                      ↻
                                    </button>
                                  </>
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
                              transform: `translate(${bodyBlockPosition.x}px, ${bodyBlockPosition.y}px) rotate(${bodyBlockRotation}deg) scale(${bodyBlockScale})`,
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
                                  <>
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
                                    <button
                                      type="button"
                                      className="element-rotate-toggle"
                                      title="본문 15도 회전"
                                      aria-label="본문 15도 회전"
                                      disabled={isSelectionLocked({ type: 'body' })}
                                      onPointerDown={(event) =>
                                        beginElementRotation({ type: 'body' }, event)
                                      }
                                    >
                                      ↻
                                    </button>
                                  </>
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
                    <p className="meta">서식 {DESIGN_PRESETS.length}개 · 선택 후 색상을 정할 수 있어요.</p>
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
                          <span>원하는 색상으로 변경</span>
                        </button>
                      ))}
                    </div>
                    <div className="design-color-controls" aria-label="배경 색상 선택">
                      <label htmlFor="design-color">선택한 서식 색상</label>
                      <div className="design-color-inputs">
                        <input
                          id="design-color"
                          type="color"
                          aria-label="배경 색상"
                          value={draftDesign.color}
                          onChange={(event) => updateDesignColor(event.target.value)}
                        />
                        <input
                          type="text"
                          className="design-hex-input"
                          aria-label="HEX 색상"
                          value={colorHex}
                          maxLength={6}
                          onChange={(event) => {
                            const nextHex = event.target.value.replace(/[^0-9a-f]/gi, '').slice(0, 6)
                            setColorHex(nextHex)
                            if (nextHex.length === 6) {
                              updateDesignColor(`#${nextHex}`)
                            }
                          }}
                          onBlur={() => setColorHex(draftDesign.color.slice(1))}
                        />
                      </div>
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
                  {item.isMine ? (
                    <>
                      <span className="feed-badge title-badge">{item.displayedTitle}</span>
                      <span className="feed-badge streak-badge">{item.streakDays}일 연속</span>
                    </>
                  ) : (
                    <span
                      className={`feed-badge mode-badge ${
                        item.entryMode === 'quality' ? 'quality' : 'simple'
                      }`}
                    >
                      {item.entryMode === 'quality' ? '퀄리티' : '간단'}
                    </span>
                  )}
                  {item.history && item.history.length > 0 ? (
                    <button
                      type="button"
                      className="history-emoji-btn feed-history-btn"
                      title="수정 이력 및 이전 내용 보기"
                      aria-label={`${item.dateKey} 수정 이력 보기`}
                      onClick={() =>
                        setActiveHistoryTarget({
                          dateKey: item.dateKey,
                          content: item.content,
                          updatedAt: item.updatedAt,
                          history: item.history,
                        })
                      }
                    >
                      ✏️ 수정됨
                    </button>
                  ) : null}
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
                {item.isMine && item.attachments.length > 0 ? (
                  <button
                    type="button"
                    className="attachment-preview-trigger"
                    onClick={() => setActiveEntryDateKey(item.dateKey)}
                  >
                    첨부 파일 {item.attachments.length}개 보기
                  </button>
                ) : null}
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
                  <article
                    key={dateKey}
                    className="my-entry-card"
                    role="button"
                    tabIndex={0}
                    onClick={() => setActiveEntryDateKey(dateKey)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        setActiveEntryDateKey(dateKey)
                      }
                    }}
                  >
                    <div className="my-entry-card-header">
                      <div className="my-entry-title-group">
                        <h3>{dateKey}</h3>
                        {entry.history && entry.history.length > 0 ? (
                          <button
                            type="button"
                            className="history-emoji-btn"
                            title="수정 이력 및 이전 내용 보기"
                            aria-label={`${dateKey} 수정 이력 보기`}
                            onClick={(event) => {
                              event.stopPropagation()
                              setActiveHistoryTarget({
                                dateKey,
                                content: entry.content,
                                updatedAt: entry.updatedAt,
                                history: entry.history!,
                              })
                            }}
                          >
                            ✏️ 수정됨
                          </button>
                        ) : null}
                      </div>
                      {canEditEntry(dateKey, new Date()) ? (
                        <button
                          type="button"
                          className="edit-entry-btn"
                          onClick={(event) => {
                            event.stopPropagation()
                            startEditingEntry(dateKey)
                          }}
                        >
                          수정
                        </button>
                      ) : (
                        <span className="edit-disabled-tag" title="기록 당일에만 수정이 가능합니다.">
                          수정 불가 (당일만)
                        </span>
                      )}
                    </div>
                    <p>{entry.content}</p>
                    {entry.attachments?.length ? (
                      <p className="meta attachment-hint">첨부 파일 {entry.attachments.length}개 · 눌러서 보기</p>
                    ) : null}
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="panel title-panel" aria-label="내 칭호">
            <div className="title-panel-heading">
              <div>
                <p className="eyebrow">현재 칭호</p>
                <h2>{displayedTitle}</h2>
              </div>
              <span className="title-mark" aria-hidden="true">
                ✦
              </span>
            </div>
            <p className="meta">현재 스트릭 {currentStreak}일을 기록하고 있어요.</p>
            <div className="title-list" aria-label="칭호 목록">
              {STREAK_TITLES.filter((streakTitle) => currentStreak >= streakTitle.days).map(
                (streakTitle) => (
                  <button
                    type="button"
                    className={`title-item unlocked ${displayedTitle === streakTitle.title ? 'selected' : ''}`}
                    onClick={() => selectTitle(streakTitle)}
                    key={streakTitle.days}
                  >
                    <span aria-hidden="true">✓</span>
                    <strong>{streakTitle.title}</strong>
                    <small>{streakTitle.days === 0 ? '첫 기록' : `${streakTitle.days}일 연속`}</small>
                  </button>
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
              <div className="selected-entry-header">
                <div className="my-entry-title-group">
                  <h3>{selectedDateKey} 기록</h3>
                  {selectedEntry?.history && selectedEntry.history.length > 0 ? (
                    <button
                      type="button"
                      className="history-emoji-btn"
                      title="수정 이력 및 이전 내용 보기"
                      aria-label={`${selectedDateKey} 수정 이력 보기`}
                      onClick={() =>
                        setActiveHistoryTarget({
                          dateKey: selectedDateKey,
                          content: selectedEntry.content,
                          updatedAt: selectedEntry.updatedAt,
                          history: selectedEntry.history!,
                        })
                      }
                    >
                      ✏️ 수정됨
                    </button>
                  ) : null}
                </div>
                {selectedEntry ? (
                  canEditEntry(selectedDateKey, new Date()) ? (
                    <button
                      type="button"
                      className="edit-entry-btn"
                      onClick={() => startEditingEntry(selectedDateKey)}
                    >
                      수정
                    </button>
                  ) : (
                    <span className="edit-disabled-tag">작성 당일에만 수정 가능</span>
                  )
                ) : null}
              </div>
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
                  getDesignPreview(
                    getDesignPreset(activeFeedSlide.templateId),
                    activeFeedSlide.backgroundColor,
                  ),
              }}
            >
              <div className="sticker-layer" aria-label="스티커 미리보기">
                {activeFeedSlide.stickers.map((sticker) => (
                  <div
                    key={sticker.id}
                    className="sticker-view-item"
                    style={{
                      transform: `translate(${sticker.x}px, ${sticker.y}px) rotate(${sticker.rotation ?? 0}deg) scale(${sticker.scale})`,
                    }}
                  >
                    {getStickerEmoji(sticker.presetId)}
                  </div>
                ))}
              </div>

              <div
                className="slide-viewer-block title"
                style={{
                  transform: `translate(${activeFeedSlide.titleBlock.x}px, ${activeFeedSlide.titleBlock.y}px) rotate(${activeFeedSlide.titleBlock.rotation ?? 0}deg) scale(${activeFeedSlide.titleBlock.scale})`,
                  textAlign: activeFeedSlide.textAlign,
                }}
              >
                <span className="text-zone-label">제목</span>
                <p className="slide-title-preview">{activeFeedSlide.title || '제목 없음'}</p>
              </div>

              <div
                className="slide-viewer-block body"
                style={{
                  transform: `translate(${activeFeedSlide.bodyBlock.x}px, ${activeFeedSlide.bodyBlock.y}px) rotate(${activeFeedSlide.bodyBlock.rotation ?? 0}deg) scale(${activeFeedSlide.bodyBlock.scale})`,
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

      {activeEntryDateKey && activeEntry ? (
        <section className="media-viewer-overlay" aria-label="일기 첨부 파일 보기">
          <article className="media-viewer-panel">
            <div className="slide-viewer-header">
              <div>
                <p className="eyebrow">{activeEntryDateKey}</p>
                <h2>일기 첨부 파일</h2>
              </div>
              <div className="media-viewer-actions">
                {activeEntry.history && activeEntry.history.length > 0 ? (
                  <button
                    type="button"
                    className="history-emoji-btn"
                    title="수정 이력 및 이전 내용 보기"
                    aria-label={`${activeEntryDateKey} 수정 이력 보기`}
                    onClick={() =>
                      setActiveHistoryTarget({
                        dateKey: activeEntryDateKey,
                        content: activeEntry.content,
                        updatedAt: activeEntry.updatedAt,
                        history: activeEntry.history!,
                      })
                    }
                  >
                    ✏️ 수정 이력
                  </button>
                ) : null}
                {canEditEntry(activeEntryDateKey, new Date()) ? (
                  <button
                    type="button"
                    className="edit-entry-btn"
                    onClick={() => startEditingEntry(activeEntryDateKey)}
                  >
                    수정하기
                  </button>
                ) : (
                  <span className="edit-disabled-tag">작성 당일에만 수정 가능</span>
                )}
                <button type="button" className="ghost" onClick={() => setActiveEntryDateKey(null)}>
                  닫기
                </button>
              </div>
            </div>
            <p className="media-viewer-content">{activeEntry.content}</p>
            {activeEntry.attachments?.length ? (
              <div className="attachment-grid">
                {activeEntry.attachments.map((attachment) => {
                  const url = mediaUrls[attachment.id]

                  return (
                    <article className="attachment-card" key={attachment.id}>
                      {url && attachment.kind === 'image' ? (
                        <img src={url} alt={attachment.name} />
                      ) : null}
                      {url && attachment.kind === 'video' ? (
                        <video src={url} controls preload="metadata" aria-label={attachment.name} />
                      ) : null}
                      {!url ? <div className="attachment-placeholder">파일을 불러오는 중...</div> : null}
                      <div className="attachment-card-meta">
                        <strong>{attachment.name}</strong>
                        <span>{formatFileSize(attachment.size)}</span>
                        {url && attachment.kind === 'file' ? (
                          <a href={url} download={attachment.name} target="_blank" rel="noreferrer">
                            파일 열기
                          </a>
                        ) : null}
                      </div>
                    </article>
                  )
                })}
              </div>
            ) : (
              <p className="empty">이 일기에는 첨부 파일이 없습니다.</p>
            )}
          </article>
        </section>
      ) : null}

      {activeHistoryTarget ? (
        <section className="media-viewer-overlay" aria-label="수정 이력 보기">
          <article className="media-viewer-panel history-viewer-panel">
            <div className="slide-viewer-header">
              <div>
                <p className="eyebrow">{activeHistoryTarget.dateKey}</p>
                <h2>일기 수정 이력 ✏️</h2>
              </div>
              <button type="button" className="ghost" onClick={() => setActiveHistoryTarget(null)}>
                닫기
              </button>
            </div>

            <div className="history-current-info">
              <p className="meta">최종 수정 시각: {formatHistoryDate(activeHistoryTarget.updatedAt)}</p>
              <div className="history-current-content">
                <strong>현재 내용</strong>
                <p>{activeHistoryTarget.content}</p>
              </div>
            </div>

            <h3 className="history-section-title">
              수정 전 내용 목록 ({activeHistoryTarget.history.length}개)
            </h3>
            {activeHistoryTarget.history.length ? (
              <div className="history-list">
                {activeHistoryTarget.history.slice().reverse().map((item, index) => (
                  <article key={index} className="history-item-card">
                    <div className="history-item-header">
                      <span className="history-item-ver">
                        수정 전 (버전 #{activeHistoryTarget.history.length - index})
                      </span>
                      <span className="history-item-time">{formatHistoryDate(item.updatedAt)}</span>
                    </div>
                    <p className="history-item-content">{item.content}</p>
                  </article>
                ))}
              </div>
            ) : (
              <p className="empty">수정 전 이력이 없습니다.</p>
            )}
          </article>
        </section>
      ) : null}
    </main>
  )
}

export default App
