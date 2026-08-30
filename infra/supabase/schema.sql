-- HaruCheck Supabase 스키마: 익명 인증(auth.uid()) 기반 사용자별 기록/디자인 저장
-- Supabase 프로젝트의 SQL Editor에서 실행한다.
-- 사전 조건: Authentication > Providers > Anonymous Sign-Ins 활성화

create table if not exists public.entries (
  user_id uuid not null references auth.users (id) on delete cascade,
  date text not null,
  content text not null,
  entry_mode text not null default 'simple',
  author_id text,
  is_shared boolean not null default false,
  quality_snapshot jsonb,
  attachments jsonb,
  history jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, date),
  constraint entries_content_min_length check (char_length(content) >= 10)
);

create table if not exists public.diary_designs (
  user_id uuid not null references auth.users (id) on delete cascade,
  date text not null,
  template_id text not null,
  paper_style text not null,
  cover_style text not null,
  color text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, date)
);

alter table public.entries enable row level security;
alter table public.diary_designs enable row level security;

-- 각 익명 사용자는 본인(auth.uid())의 행만 읽고 쓸 수 있다.
create policy "entries_owner_select" on public.entries
  for select using (auth.uid() = user_id);
create policy "entries_owner_upsert" on public.entries
  for insert with check (auth.uid() = user_id);
create policy "entries_owner_update" on public.entries
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "entries_owner_delete" on public.entries
  for delete using (auth.uid() = user_id);

-- is_shared=true인 글은 누구나(다른 익명 사용자도) 읽을 수 있다 (공개 피드용, Phase 2).
create policy "entries_public_feed_select" on public.entries
  for select using (is_shared = true);

create policy "designs_owner_select" on public.diary_designs
  for select using (auth.uid() = user_id);
create policy "designs_owner_upsert" on public.diary_designs
  for insert with check (auth.uid() = user_id);
create policy "designs_owner_update" on public.diary_designs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "designs_owner_delete" on public.diary_designs
  for delete using (auth.uid() = user_id);
