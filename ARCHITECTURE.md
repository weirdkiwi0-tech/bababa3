# ARCHITECTURE

## 1. 문서 목적
본 문서는 현재까지의 기획 대화를 바탕으로, 하루체크의 제품/데이터/운영 아키텍처를 구현 전 수준에서 정리한다.

## 2. 아키텍처 원칙
- MVP는 개인 지속성 검증에 집중
- 로그인 없이도 사용자별 연속성 유지
- 정책 변경 가능성을 고려한 확장 구조 유지
- 소셜 기능은 Phase 2 분리 설계

## 3. 제품 경계 (Bounded Context)
- Check-in Domain
  - 오늘 기록 생성, 수정, 삭제
- Streak Domain
  - 연속일 계산, 월 1회 유예 처리
- Calendar/Stats Domain
  - 월간 기록 시각화, 집계
- Identity-lite Domain
  - 익명 식별자 관리, 마지막 활동 갱신
- Community Domain (Phase 2)
  - 공개 피드, 공개/비공개 전환, 신고/안전

## 4. 상위 구성도 (개념)
- Client App
  - 체크인 UI, 캘린더 UI, 통계 UI
  - 익명 식별자 보관
- API Layer
  - Entry API
  - Streak API
  - Stats API
  - Community API (Phase 2)
- Data Layer
  - Entry, Streak, AnonymousProfile 저장
- Policy Layer
  - 글자수 정책(10~300)
  - 스트릭 유예 정책(월 1회)
  - 공개 정책(Phase 2: 기본 공개 + 사전 확인)

## 5. 핵심 데이터 모델
- Entry
  - id
  - anonymousUserId
  - date
  - content
  - isShared
  - createdAt
  - updatedAt
- Streak
  - anonymousUserId
  - currentStreak
  - bestStreak
  - lastWrittenDate
  - monthlyGraceUsed
- AnonymousProfile
  - anonymousUserId
  - displayName(optional)
  - createdAt
  - lastActiveAt

## 6. 핵심 플로우
### 6.1 일일 체크인
1. 클라이언트는 anonymousUserId 확인/생성
2. 오늘 날짜 Entry 존재 여부 조회
3. 미니 일기 유효성 검사(10~300)
4. Entry 저장
5. Streak 갱신(유예 정책 포함)
6. 캘린더/통계 재계산

### 6.2 스트릭 유예
1. 하루 누락 감지
2. 해당 월 monthlyGraceUsed 확인
3. false면 유예 사용 처리 후 스트릭 유지
4. true면 정책대로 스트릭 갱신

### 6.3 공개 게시(Phase 2)
1. 기본 공개 상태일 때 게시 전 경고 노출
2. 사용자 확인 후 공유 저장
3. 피드 반영
4. 사용자 즉시 비공개 전환 허용

## 7. 정책 아키텍처
- 정책값은 하드코딩 대신 설정값으로 분리
  - minLength = 10
  - maxLength = 300
  - monthlyGraceLimit = 1
  - defaultVisibility = public (Phase 2 적용)
- 정책 변경 시 데이터 마이그레이션 영향 최소화

## 8. 관측성과 지표 수집
- 이벤트 기준
  - entry_attempted
  - entry_saved
  - streak_updated
  - grace_used
  - revisit_day7
  - revisit_day30
- MVP KPI
  - 작성 완료율
  - D7
  - D30
  - 평균 스트릭
- Phase 2 추가 KPI
  - 공개 전환율
  - 피드 기여 재방문율
  - 신고율

## 9. 리스크 제어 포인트
- 연속성 단절
  - 익명 식별자 재발급 방지 및 복구 전략 검토
- 민감정보 노출
  - 게시 전 경고 + 즉시 철회
- 정책 오해
  - 유예 잔여 횟수와 상태를 UI에 명확히 표시

## 10. 릴리즈 구조
- Phase 1
  - Check-in, Streak, Calendar/Stats, Identity-lite
- Phase 2
  - Community Feed, Safety/Report, Visibility controls

## 11. 확장 고려사항
- 추후 인증 도입 시 anonymousUserId와 accountId 연결 전략
- 멀티 디바이스 동기화 고도화
- 회고 리포트(주간/월간)와 감정 태그 도입
