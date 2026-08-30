import { getOrCreateCloudUserId, supabase } from './supabaseClient'
import type { DiaryDesignByDate, EntryByDate } from './entryDomain'

type EntryRow = {
  date: string
  content: string
  entry_mode: string | null
  author_id: string | null
  is_shared: boolean | null
  quality_snapshot: unknown
  attachments: unknown
  history?: unknown
  created_at: string
  updated_at: string
}

type PublicEntryRow = EntryRow & { user_id: string }

export type SharedFeedEntry = {
  dateKey: string
  authorLabel: string
  content: string
  entryMode: 'simple' | 'quality'
  qualitySnapshot: EntryByDate[string]['qualitySnapshot']
  history?: EntryByDate[string]['history']
  updatedAt: string
}

type DesignRow = {
  date: string
  template_id: string
  paper_style: string
  cover_style: string
  color: string
}

// 로컬 저장(localStorage/IndexedDB)은 그대로 두고, Supabase가 설정된 경우에만 배경에서 동기화한다.
export async function pullCloudEntries(): Promise<EntryByDate | null> {
  if (!supabase) {
    return null
  }

  const userId = await getOrCreateCloudUserId()
  if (!userId) {
    return null
  }

  const primaryResult = await supabase
    .from('entries')
    .select(
      'date, content, entry_mode, author_id, is_shared, quality_snapshot, attachments, history, created_at, updated_at',
    )
    .eq('user_id', userId)

  let rows = primaryResult.data as EntryRow[] | null
  let error = primaryResult.error

  if (error) {
    // history 컬럼이 DB에 없어 에러가 발생한 경우 fallback 조회
    const fallback = await supabase
      .from('entries')
      .select(
        'date, content, entry_mode, author_id, is_shared, quality_snapshot, attachments, created_at, updated_at',
      )
      .eq('user_id', userId)
    rows = fallback.data as EntryRow[] | null
    error = fallback.error
  }

  if (error || !rows) {
    return null
  }

  const entries: EntryByDate = {}
  rows.forEach((row) => {
    entries[row.date] = {
      content: row.content,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      entryMode: (row.entry_mode as 'simple' | 'quality' | undefined) ?? undefined,
      authorId: row.author_id ?? undefined,
      isShared: row.is_shared ?? false,
      qualitySnapshot: (row.quality_snapshot as EntryByDate[string]['qualitySnapshot']) ?? undefined,
      attachments: (row.attachments as EntryByDate[string]['attachments']) ?? undefined,
      history: (row.history as EntryByDate[string]['history']) ?? undefined,
    }
  })

  return entries
}

// 공개(is_shared=true)로 등록된 다른 사용자들의 최근 글을 조회한다 (Phase 2 공개 피드).
export async function pullPublicFeedEntries(limit = 30): Promise<SharedFeedEntry[]> {
  if (!supabase) {
    return []
  }

  const userId = await getOrCreateCloudUserId()

  const primaryResult = await supabase
    .from('entries')
    .select('date, content, entry_mode, quality_snapshot, history, updated_at, user_id')
    .eq('is_shared', true)
    .order('updated_at', { ascending: false })
    .limit(limit)

  let rows = primaryResult.data as PublicEntryRow[] | null
  let error = primaryResult.error

  if (error) {
    // DB에 history 컬럼이 아직 없는 경우 fallback 조회
    const fallback = await supabase
      .from('entries')
      .select('date, content, entry_mode, quality_snapshot, updated_at, user_id')
      .eq('is_shared', true)
      .order('updated_at', { ascending: false })
      .limit(limit)
    rows = fallback.data as PublicEntryRow[] | null
    error = fallback.error
  }

  if (error || !rows) {
    return []
  }

  return rows
    .filter((row) => row.user_id !== userId)
    .map((row) => ({
      dateKey: row.date,
      authorLabel: `익명 사용자 ${row.user_id.slice(0, 4)}`,
      content: row.content,
      entryMode: (row.entry_mode as 'simple' | 'quality') ?? 'simple',
      qualitySnapshot: (row.quality_snapshot as EntryByDate[string]['qualitySnapshot']) ?? undefined,
      history: (row.history as EntryByDate[string]['history']) ?? undefined,
      updatedAt: row.updated_at,
    }))
}

export async function pushCloudEntries(entries: EntryByDate): Promise<void> {
  if (!supabase) {
    return
  }

  const userId = await getOrCreateCloudUserId()
  if (!userId) {
    return
  }

  const rows = Object.entries(entries).map(([date, entry]) => ({
    user_id: userId,
    date,
    content: entry.content,
    entry_mode: entry.entryMode ?? 'simple',
    author_id: entry.authorId ?? null,
    is_shared: entry.isShared ?? false,
    quality_snapshot: entry.qualitySnapshot ?? null,
    attachments: entry.attachments ?? null,
    history: entry.history ?? null,
    created_at: entry.createdAt,
    updated_at: entry.updatedAt,
  }))

  if (rows.length === 0) {
    return
  }

  const { error } = await supabase.from('entries').upsert(rows, { onConflict: 'user_id,date' })

  if (error) {
    // history 컬럼이 DB에 없는 환경에서 에러 발생 시 history 제외 후 재시도
    const fallbackRows = rows.map(({ history: _h, ...rest }) => rest)
    await supabase.from('entries').upsert(fallbackRows, { onConflict: 'user_id,date' })
  }
}

export async function pullCloudDiaryDesigns(): Promise<DiaryDesignByDate | null> {
  if (!supabase) {
    return null
  }

  const userId = await getOrCreateCloudUserId()
  if (!userId) {
    return null
  }

  const { data, error } = await supabase
    .from('diary_designs')
    .select('date, template_id, paper_style, cover_style, color')
    .eq('user_id', userId)

  if (error || !data) {
    return null
  }

  const designs: DiaryDesignByDate = {}
  ;(data as DesignRow[]).forEach((row) => {
    designs[row.date] = {
      templateId: row.template_id,
      paperStyle: row.paper_style,
      coverStyle: row.cover_style,
      color: row.color,
    }
  })

  return designs
}

export async function pushCloudDiaryDesigns(designs: DiaryDesignByDate): Promise<void> {
  if (!supabase) {
    return
  }

  const userId = await getOrCreateCloudUserId()
  if (!userId) {
    return
  }

  const rows = Object.entries(designs).map(([date, design]) => ({
    user_id: userId,
    date,
    template_id: design.templateId,
    paper_style: design.paperStyle,
    cover_style: design.coverStyle,
    color: design.color,
  }))

  if (rows.length === 0) {
    return
  }

  await supabase.from('diary_designs').upsert(rows, { onConflict: 'user_id,date' })
}
