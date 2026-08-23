# E2E Subagent

목표:
- 실제 브라우저 관점에서 핵심 사용자 시나리오를 검증한다.

범위:
- `tests/e2e/*.spec.ts`
- 저장/재접속 복원, 입력 검증 메시지

작업 방식:
1. 사용자 여정 시나리오 정의(Red)
2. 앱 전체 기준으로 통과(Green)
3. flaky 테스트 제거 및 셀렉터 안정화(Refactor)

실행:
- `npm run tdd:e2e`
