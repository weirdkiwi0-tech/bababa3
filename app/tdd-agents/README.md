# TDD Subagents (Workflow)

이 디렉터리는 실제 런타임 에이전트를 생성하는 기능이 아니라,
TDD를 단계별로 분리해 실행하는 작업 단위를 정의한다.

- Unit Subagent: 순수 함수/도메인 규칙 검증
- Integration Subagent: UI + 상태 + 저장소(localStorage) 연동 검증
- E2E Subagent: 브라우저 기준 사용자 시나리오 검증

권장 실행 순서:

1. `npm run tdd:unit`
2. `npm run tdd:integration`
3. `npm run tdd:e2e`
4. `npm run test:all`
