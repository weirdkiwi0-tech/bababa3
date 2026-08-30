# TRD (Technical Requirements Document)

## 1. 문서 개요
- 문서명: HaruCheck TRD
- 버전: v1.6
- 작성일: 2026-08-08
- 상태: Draft for Build (단일 기술 기준 문서, Guest URL + 일기 커스텀/미디어 반영)
- 참조 문서:
  - PRD.md
  - IDEATION.md

## 2. 문서 목적
본 문서는 HaruCheck의 MVP(Phase 1) 구현을 위한 기술 요구사항을 정의한다.
기능 구현 범위, 아키텍처 경계, 데이터 구조, API 계약, 정책 처리, 품질 기준, 관측성, 보안/프라이버시, 테스트 기준을 포함한다.

## 3. 범위
### 3.1 Phase 1 구현 범위
- 일일 출석 체크
- 미니 일기 작성/수정/삭제
- 스티커/속지/페이지 서식 커스텀
- 폰트 스타일 선택
- 사진/동영상 첨부
- 스트릭 계산 및 월 1회 유예
- 캘린더/기본 통계
- 익명 식별자 기반 사용자 연속성 유지
- 비로그인 게스트 플레이
- 고유 URL 기반 데이터 연속성 유지

### 3.2 Phase 1 제외 범위
- 로그인/회원가입
- 소셜 피드 조회/공유
- 공개/비공개 전환 UI
- 신고/콘텐츠 안전 운영
- 고급 소셜(팔로우/DM)

### 3.3 Phase 2 연계 포인트
- Entry.isShared 필드 유지
- Community API 확장 슬롯 유지
- 신고/안전 이벤트 수집 확장 가능 구조 유지
- 공개 기록 공유 URL 확장 구조 유지

## 4. 기술 아키텍처 요구사항
### 4.1 구성
- Client App
  - 체크인, 캘린더, 통계 화면
  - 일기 커스텀 UI(스티커/속지/표지/폰트)
  - 사진/동영상 첨부 UI
  - anonymousUserId 생성 및 저장
  - 고유 URL 생성/노출 및 URL 라우팅 복원
- API Service
  - Entry API
  - Streak API
  - Stats API
  - Community API (Phase 2)
- Data Store
  - Entry
  - Streak
  - AnonymousProfile
  - 미디어 메타데이터/스토리지 참조
  - Policy config

### 4.2 아키텍처 원칙
- MVP는 개인 지속성 검증에 집중한다.
- 로그인 없이도 사용자별 연속성을 유지한다.
- 디지털 매체 강점을 활용한 기록 커스텀/미디어 중심 작성 경험을 제공한다.
- 도메인 책임 분리 (Entry/Editor-Custom/Streak/Stats/Identity-lite)
- 정책값 하드코딩 금지 (설정값 분리)
- 확장 가능성 우선 (향후 인증/커뮤니티 기능)
- 장애 시 재시도 경로 보장

### 4.3 제품 경계 (Bounded Context)
- Check-in Domain
  - 오늘 기록 생성/수정/삭제
- Editor-Custom Domain
  - 스티커, 속지/페이지 서식, 폰트 스타일, 첨부 미디어 관리
- Streak Domain
  - 연속일 계산, 월 1회 유예 처리
- Calendar/Stats Domain
  - 월간 기록 시각화, 집계
- Identity-lite Domain
  - 익명 식별자 관리, 마지막 활동 갱신
- Community Domain (Phase 2)
  - 공개 피드, 공유 URL, 공개/비공개 전환, 신고/안전

### 4.4 핵심 플로우
#### 4.4.1 일일 체크인
1. 클라이언트는 고유 URL 키(urlKey)와 anonymousUserId를 확인/생성한다.
2. 오늘 날짜 Entry 존재 여부를 조회한다.
3. 미니 일기 유효성 검사(최소 10자)를 수행한다.
4. 스티커/서식/폰트/미디어 첨부 메타데이터를 검증한다.
5. Entry를 저장한다(동일 날짜는 update).
6. Streak를 갱신한다(유예 정책 포함).
7. 캘린더/통계를 재계산한다.
8. 사용자에게 개인 고유 URL을 유지 가능한 형태로 제공한다.

#### 4.4.2 스트릭 유예
1. 하루 누락을 감지한다.
2. 해당 월 monthlyGraceUsed를 확인한다.
3. false면 유예 사용 처리 후 streak를 유지한다.
4. true면 정책대로 streak를 갱신한다.

#### 4.4.3 공개 게시 (Phase 2)
1. 기본 공개 상태일 때 게시 전 경고를 노출한다.
2. 사용자 확인 후 공개 저장한다.
3. 공유 URL 발급 및 피드 반영을 수행한다.
4. 작성자에게 즉시 비공개 전환을 허용한다.

## 5. 기능 요구사항 (기술 관점)
### 5.1 Check-in
- 하루 1회 기록 원칙을 보장해야 한다.
- 동일 날짜 재작성 시 신규 생성이 아닌 업데이트로 처리해야 한다.
- 텍스트 유효성 검사를 서버와 클라이언트 모두에서 수행해야 한다.

### 5.2 Entry (미니 일기)
- 길이 제한: minLength=10, maxLength 없음
- 허용 문자셋: UTF-8 텍스트
- 수정/삭제 시 작성자(anonymousUserId) 소유권 검증이 필요하다.
- 수정 가능 시간 정책: 기록 작성 당일(Asia/Seoul 기준 날짜 `dateKey`가 현재 날짜 `todayKey`와 일치하는 날)에만 수정이 허용되며, 24시간 카운트다운이 아닌 당일 자정(23:59:59) 지나면 수정을 제한한다.
- 수정 이력 관리: 일기 수정 발생 시 이전 버전의 `content`와 `updatedAt` 시각을 `history` 배열로 누적 기록하며, 수정 이력이 존재하는 기록에는 수정 알림 이모지(✏️)를 표시하고 해당 이모지 클릭 시 수정 시각 및 수정 전 내용 목록을 조회할 수 있도록 한다.

### 5.3 Diary Editor Customization + Media
- 기록별 스티커 메타데이터(스티커 ID, 위치, 크기, 회전, z-index)를 저장/복원해야 한다.
- 속지/페이지 서식/폰트 스타일은 정책에서 허용한 값만 선택 가능해야 한다.
- 템플릿 갤러리는 줄노트, 모눈, 무지 3개 서식만 제공해야 한다.
- 선택한 서식의 배경 색상은 6자리 HEX 값(#000000~#FFFFFF)으로 저장·복원해야 한다.
- 간편 작성 본문 상태와 디자인 작성 본문 상태를 분리해 서로 자동 전파되지 않게 해야 한다.
- 디자인 파일 메뉴는 첨부용 파일 추가와 캔버스용 이미지 삽입을 별도 입력 경로로 제공해야 한다.
- 삽입 이미지의 파일 ID, 위치, 크기, 원본 비율을 저장·복원하고 캔버스 경계 안에서 이동·비율 조절해야 한다.
- 선택된 이미지·스티커·텍스트 블록의 rotation 값을 15도 단위로 변경·초기화하고 저장·복원해야 한다.
- 첨부 미디어는 사진/동영상을 지원해야 하며, 첨부 목록 순서를 보존해야 한다.
- 미디어 업로드는 크기/형식 검증을 서버와 클라이언트에서 모두 수행해야 한다.
- 삭제된 미디어 참조는 기록 저장 시점에 정리되어야 한다.

### 5.4 Streak
- 기록 완료 시 currentStreak를 갱신해야 한다.
- 하루 누락 시 monthlyGraceUsed가 false이면 유예를 1회 사용해 streak를 유지한다.
- monthlyGraceUsed가 true이면 정책대로 streak를 갱신한다.
- bestStreak는 currentStreak 최대값을 유지해야 한다.

### 5.5 Calendar/Stats
- 월간 기록일 여부를 날짜별로 조회할 수 있어야 한다.
- 총 기록일, 최근 7일 기록일, currentStreak, bestStreak를 제공해야 한다.

### 5.6 Identity-lite + Guest URL
- 회원가입/로그인 없이 Phase 1 전체 기능을 사용할 수 있어야 한다.
- 최초 진입 시 고유 URL 식별값(urlKey)을 생성하고 사용자 데이터와 매핑해야 한다.
- 고유 URL 재접속 시 로그인 없이 동일 anonymousUserId 맥락을 복원해야 한다.
- urlKey는 추측이 어려운 난수 기반 문자열이어야 한다.
- 잠금 해제된 칭호 중 선택한 값(selectedTitle)을 anonymousUserId 기준으로 저장·복원해야 한다.
- 내 업로드 표시에는 selectedTitle을 사용하고 기존 업로드·작성 유형 배지는 표시하지 않아야 한다.

### 5.7 Community 공개 접근 (Phase 2)
- 공개된 Entry는 공유 URL로 조회 가능해야 한다.
- 비공개 전환된 Entry의 공유 URL은 즉시 비활성화되어야 한다.
- 공개 피드는 선택한 날짜를 기준으로 해당 날짜의 기록만 반환해야 한다.

## 6. 정책 요구사항
### 6.1 정책 설정값
- entry.minLength = 10
- editor.allowedFontStyles = ["basic", "serif", "handwriting"]
- editor.allowedPageLayouts = ["plain", "lined", "grid"]
- editor.allowedCoverTemplates = ["basic", "memo", "vintage"]
- editor.sticker.maxCountPerEntry = 20
- media.allowedImageMimeTypes = ["image/jpeg", "image/png", "image/webp"]
- media.allowedVideoMimeTypes = ["video/mp4", "video/webm"]
- media.maxFileSizeMb.image = 10
- media.maxFileSizeMb.video = 100
- media.maxAttachmentCountPerEntry = 10
- streak.monthlyGraceLimit = 1
- visibility.default = public (Phase 2 적용)

### 6.2 월 경계 처리
- monthlyGraceUsed는 월 단위로 초기화되어야 한다.
- 월 변경 기준 타임존은 단일 기준으로 고정해야 한다.
- 권장: Asia/Seoul 고정 또는 UTC 고정 중 하나 선택 후 전역 일관 적용

### 6.3 날짜 경계 처리
- 하루 기준은 정책 타임존의 로컬 날짜로 계산해야 한다.
- 같은 날 중복 작성은 update 처리로 정합성을 유지한다.

### 6.4 정책 변경 영향 최소화
- 정책값 변경 시 데이터 스키마 마이그레이션 영향을 최소화해야 한다.
- 정책값은 배포 가능한 설정 계층에서 관리해야 한다.

### 6.5 URL 식별 정책
- 고유 URL 패턴은 `/{urlKey}` 또는 `/u/{urlKey}` 중 하나로 일관 적용해야 한다.
- urlKey는 충분한 엔트로피를 가진 랜덤 토큰으로 생성해야 한다.
- urlKey 평문을 로그/분석 이벤트에 직접 저장하지 않도록 마스킹 또는 해시 처리가 필요하다.

## 7. 데이터 모델 요구사항
### 7.1 Entry
- id: string (UUID)
- anonymousUserId: string
- date: string (yyyy-mm-dd)
- content: text
- styleTemplateId: string | null
- pageLayoutId: string | null
- fontStyleId: string | null
- stickers: jsonb[] (id, x, y, scale, rotation, zIndex)
- attachments: jsonb[] (id, kind, mimeType, url, thumbnailUrl, width, height, durationSec, sizeBytes, order)
- isShared: boolean
- sharedUrlKey: string | null (UNIQUE, Phase 2)
- createdAt: datetime
- updatedAt: datetime

제약:
- unique(anonymousUserId, date)
- content length >= 10

### 7.2 Streak
- anonymousUserId: string (PK)
- currentStreak: integer >= 0
- bestStreak: integer >= 0
- lastWrittenDate: string (yyyy-mm-dd)
- monthlyGraceUsed: boolean
- updatedAt: datetime

### 7.3 AnonymousProfile
- anonymousUserId: string (PK)
- urlKey: string (UNIQUE)
- displayName: string | null
- createdAt: datetime
- lastActiveAt: datetime

## 8. API 요구사항
### 8.1 인증/식별
- Authorization 기반 로그인은 사용하지 않는다.
- 클라이언트 경로의 urlKey를 기본 식별자로 사용한다.
- 내부 API 호출에서는 anonymousUserId를 요청 헤더 또는 쿠키로 전달할 수 있어야 한다.
- urlKey/anonymousUserId 미존재 시 클라이언트에서 생성하고 서버에서 최초 등록 가능해야 한다.

### 8.2 엔드포인트 (초안)
- POST /v1/entries/today
  - 목적: 오늘 기록 생성/업데이트
- GET /v1/entries/:date
  - 목적: 특정 날짜 기록 조회
- PATCH /v1/entries/:date
  - 목적: 특정 날짜 기록 수정
- DELETE /v1/entries/:date
  - 목적: 특정 날짜 기록 삭제
- POST /v1/entries/:date/attachments
  - 목적: 기록 첨부 미디어 업로드
- DELETE /v1/entries/:date/attachments/:attachmentId
  - 목적: 기록 첨부 미디어 삭제
- GET /v1/editor/options
  - 목적: 폰트/속지/표지/스티커 옵션 조회
- GET /v1/streak
  - 목적: 현재/최고 스트릭 조회
- GET /v1/calendar?month=YYYY-MM
  - 목적: 월간 기록일 조회
- GET /v1/stats/summary
  - 목적: 기본 통계 조회
- POST /v1/identity/link
  - 목적: 게스트 식별 생성 및 개인 고유 URL 발급
- GET /v1/identity/resolve/:urlKey
  - 목적: urlKey로 anonymousUserId 컨텍스트 복원
- GET /v1/community/entries/shared/:sharedUrlKey
  - 목적: 공유 URL로 공개 기록 조회

### 8.3 에러 계약
- 공통 에러 포맷:
  - code: string
  - message: string
  - traceId: string
- 대표 에러 코드:
  - VALIDATION_ERROR
  - MEDIA_UNSUPPORTED_TYPE
  - MEDIA_SIZE_EXCEEDED
  - MEDIA_LIMIT_EXCEEDED
  - NOT_FOUND
  - CONFLICT
  - FORBIDDEN
  - INTERNAL_ERROR

## 9. 관측성 요구사항
### 9.1 이벤트
- entry_attempted
- entry_saved
- entry_updated
- entry_deleted
- streak_updated
- grace_used
- revisit_day7
- revisit_day30
- entry_shared
- sticker_applied
- media_attached
- media_removed

### 9.2 로그
- 모든 API 요청에 traceId를 부여해야 한다.
- 실패 응답은 code/message/traceId를 포함해야 한다.
- 개인정보/민감 텍스트 본문은 로그에 평문 저장하지 않는다.

### 9.3 KPI 집계
- 기록 작성 완료율
- WAU 대비 기록 생성 비율
- D7
- D30
- 평균 스트릭 길이

## 10. 비기능 요구사항
### 10.1 성능
- 주요 화면 첫 로드 3초 이내
- 평균 API 응답 시간 목표: 300ms 이내(일반 구간)

### 10.2 신뢰성
- 치명 오류 시 재시도 가능해야 한다.
- 멱등성 보장: 오늘 기록 재전송 시 중복 생성 금지

### 10.3 보안/프라이버시
- 민감 텍스트 로그 마스킹
- anonymousUserId 난수 생성 규칙 적용
- urlKey 추측/열거 방지(랜덤 토큰, 레이트 리밋, 이상 접근 탐지)
- 데이터 삭제 요청 처리 훅(추후 정책 연동) 고려

### 10.4 확장성
- 인증 도입 시 anonymousUserId와 accountId 매핑 가능 구조
- Community API(Phase 2) 추가 시 기존 엔트리 스키마 변경 최소화

## 11. 테스트 요구사항
### 11.1 단위 테스트
- 문자열 길이 검증
- streak 계산 로직
- 월 유예 초기화 로직

### 11.2 통합 테스트
- entry 생성/수정/삭제 전주기
- 중복 날짜 upsert 처리
- streak + calendar + stats 일관성
- 고유 URL 재접속 시 데이터 연속성 복원
- 공유 URL 조회 및 비공개 전환 차단
- 커스텀 옵션/미디어 저장 및 재조회 일관성

### 11.3 회귀 테스트
- 월 경계(말일/익월 1일)
- 윤년 날짜
- 타임존 경계(자정 전후)
- URL 라우트 변경/배포 후 기존 고유 URL 복원 동작 유지

### 11.4 수용 테스트
- PRD AC-001~AC-005
- PRD AC-101~AC-104
- PRD AC-201~AC-204
- PRD AC-301~AC-306 (Phase 2)
- PRD AC-401~AC-404
- PRD AC-501~AC-505

## 12. 릴리즈 체크리스트 (Phase 1)
- 정책값 설정 파일 분리 완료
- API 에러 표준 포맷 적용 완료
- 추적 이벤트 수집 검증 완료
- KPI 산식 집계 검증 완료
- 핵심 회귀 테스트 통과

## 13. 릴리즈 구조
### 13.1 Phase 1
- Check-in
- Editor-Custom
- Streak
- Calendar/Stats
- Identity-lite

### 13.2 Phase 2
- Community Feed
- Visibility controls
- Safety/Report

## 14. 리스크 제어 포인트
- 연속성 단절
  - 익명 식별자 재발급 방지 및 복구 전략 검토
- URL 노출/추측 위험
  - urlKey 엔트로피 확보, 열거 방지, 이상 접근 감시
- 민감정보 노출
  - 게시 전 경고 + 즉시 철회
- 정책 오해
  - 유예 잔여 횟수와 상태를 UI에 명확히 표시

## 15. 확장 고려사항
- 추후 인증 도입 시 anonymousUserId와 accountId 연결 전략
- 멀티 디바이스 동기화 고도화
- 회고 리포트(주간/월간)와 감정 태그 도입

## 16. 오픈 이슈
- 식별 채널 최종 확정 (URL path 기본 + 헤더/쿠키 보조)
- displayName 정책 확정 (자동 생성 vs 사용자 입력)
- 정책 타임존 최종 확정 (Asia/Seoul vs UTC)

## 17. 변경 이력
- v1.6 (2026-08-08): ARCHITECTURE 내용을 TRD에 완전 통합하고 단일 기술 기준 문서로 정리
- v1.5 (2026-08-08): 일기 커스텀/폰트/미디어 첨부 기능의 정책, 데이터 모델, API, 테스트 요구 추가
- v1.4 (2026-08-08): 반응 기능 관련 데이터 모델, API, 이벤트, 테스트 요구 제거
- v1.3 (2026-08-08): Phase 2 공유 URL 연동 요구 반영
- v1.2 (2026-08-08): 게스트 플레이 및 고유 URL 기반 데이터 연속성 요구 반영
- v1.1 (2026-08-08): 초기 아키텍처 핵심 내용(TRD 경계/플로우/리스크/릴리즈 구조) 통합
- v1.0 (2026-08-01): PRD v1.0 기준 정합화
