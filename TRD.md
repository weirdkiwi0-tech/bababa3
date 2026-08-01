# TRD (Technical Requirements Document)

## 1. 문서 개요
- 문서명: HaruCheck TRD
- 버전: v1.0
- 작성일: 2026-08-01
- 상태: Draft for Build
- 참조 문서:
  - PRD.md
  - IDEATION.md
  - ARCHITECTURE.md

## 2. 문서 목적
본 문서는 HaruCheck의 MVP(Phase 1) 구현을 위한 기술 요구사항을 정의한다.
기능 구현 범위, 데이터 구조, API 계약, 정책 처리, 품질 기준, 관측성, 보안/프라이버시, 테스트 기준을 포함한다.

## 3. 범위
### 3.1 Phase 1 구현 범위
- 일일 출석 체크
- 미니 일기 작성/수정/삭제
- 스트릭 계산 및 월 1회 유예
- 캘린더/기본 통계
- 익명 식별자 기반 사용자 연속성 유지

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

## 4. 기술 아키텍처 요구사항
### 4.1 구성
- Client App
  - 체크인, 캘린더, 통계 화면
  - anonymousUserId 생성 및 저장
- API Service
  - Entry API
  - Streak API
  - Stats API
- Data Store
  - Entry
  - Streak
  - AnonymousProfile

### 4.2 아키텍처 원칙
- 도메인 책임 분리 (Entry/Streak/Stats)
- 정책값 하드코딩 금지 (설정값 분리)
- 확장 가능성 우선 (향후 인증/커뮤니티 기능)
- 장애 시 재시도 경로 보장

## 5. 기능 요구사항 (기술 관점)
### 5.1 Check-in
- 하루 1회 기록 원칙을 보장해야 한다.
- 동일 날짜 재작성 시 신규 생성이 아닌 업데이트로 처리해야 한다.
- 텍스트 유효성 검사를 서버와 클라이언트 모두에서 수행해야 한다.

### 5.2 Entry (미니 일기)
- 길이 제한: minLength=10, maxLength=300
- 허용 문자셋: UTF-8 텍스트
- 수정/삭제 시 작성자(anonymousUserId) 소유권 검증이 필요하다.

### 5.3 Streak
- 기록 완료 시 currentStreak를 갱신해야 한다.
- 하루 누락 시 monthlyGraceUsed가 false이면 유예를 1회 사용해 streak를 유지한다.
- monthlyGraceUsed가 true이면 정책대로 streak를 갱신한다.
- bestStreak는 currentStreak 최대값을 유지해야 한다.

### 5.4 Calendar/Stats
- 월간 기록일 여부를 날짜별로 조회할 수 있어야 한다.
- 총 기록일, 최근 7일 기록일, currentStreak, bestStreak를 제공해야 한다.

## 6. 정책 요구사항
### 6.1 정책 설정값
- entry.minLength = 10
- entry.maxLength = 300
- streak.monthlyGraceLimit = 1
- visibility.default = public (Phase 2 적용)

### 6.2 월 경계 처리
- monthlyGraceUsed는 월 단위로 초기화되어야 한다.
- 월 변경 기준 타임존은 단일 기준으로 고정해야 한다.
- 권장: Asia/Seoul 고정 또는 UTC 고정 중 하나 선택 후 전역 일관 적용

### 6.3 날짜 경계 처리
- 하루 기준은 정책 타임존의 로컬 날짜로 계산해야 한다.
- 같은 날 중복 작성은 update 처리로 정합성을 유지한다.

## 7. 데이터 모델 요구사항
### 7.1 Entry
- id: string (UUID)
- anonymousUserId: string
- date: string (yyyy-mm-dd)
- content: text
- isShared: boolean
- createdAt: datetime
- updatedAt: datetime

제약:
- unique(anonymousUserId, date)
- content length 10~300

### 7.2 Streak
- anonymousUserId: string (PK)
- currentStreak: integer >= 0
- bestStreak: integer >= 0
- lastWrittenDate: string (yyyy-mm-dd)
- monthlyGraceUsed: boolean
- updatedAt: datetime

### 7.3 AnonymousProfile
- anonymousUserId: string (PK)
- displayName: string | null
- createdAt: datetime
- lastActiveAt: datetime

## 8. API 요구사항
### 8.1 인증/식별
- Authorization 기반 로그인은 사용하지 않는다.
- anonymousUserId를 요청 헤더 또는 쿠키로 전달한다.
- 미존재 시 클라이언트에서 생성, 서버에서 최초 등록 가능해야 한다.

### 8.2 엔드포인트 (초안)
- POST /v1/entries/today
  - 목적: 오늘 기록 생성/업데이트
- GET /v1/entries/:date
  - 목적: 특정 날짜 기록 조회
- PATCH /v1/entries/:date
  - 목적: 특정 날짜 기록 수정
- DELETE /v1/entries/:date
  - 목적: 특정 날짜 기록 삭제
- GET /v1/streak
  - 목적: 현재/최고 스트릭 조회
- GET /v1/calendar?month=YYYY-MM
  - 목적: 월간 기록일 조회
- GET /v1/stats/summary
  - 목적: 기본 통계 조회

### 8.3 에러 계약
- 공통 에러 포맷:
  - code: string
  - message: string
  - traceId: string
- 대표 에러 코드:
  - VALIDATION_ERROR
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

### 11.3 회귀 테스트
- 월 경계(말일/익월 1일)
- 윤년 날짜
- 타임존 경계(자정 전후)

### 11.4 수용 테스트
- PRD AC-001~AC-005
- PRD AC-101~AC-104
- PRD AC-201~AC-204
- PRD AC-301~AC-304 (Phase 2)

## 12. 릴리즈 체크리스트 (Phase 1)
- 정책값 설정 파일 분리 완료
- API 에러 표준 포맷 적용 완료
- 추적 이벤트 수집 검증 완료
- KPI 산식 집계 검증 완료
- 핵심 회귀 테스트 통과

## 13. 오픈 이슈
- anonymousUserId 전달 방식 최종 확정 (헤더 vs 쿠키)
- displayName 정책 확정 (자동 생성 vs 사용자 입력)
- 정책 타임존 최종 확정 (Asia/Seoul vs UTC)

## 14. 변경 이력
- v1.0 (2026-08-01): PRD v1.0 기준 정합화
