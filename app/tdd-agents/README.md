# TDD Subagents (Workflow)

이 디렉터리는 TDD를 단계별로 분리해 실행하는 작업 단위와 운영 기준을 정의한다.

실제 VS Code workspace 서브에이전트는 루트의 `.github/agents/`에 등록되어 있다.

- Unit Subagent: 순수 함수/도메인 규칙 검증
- Integration Subagent: UI + 상태 + 저장소(localStorage) 연동 검증
- E2E Subagent: 브라우저 기준 사용자 시나리오 검증

권장 실행 순서:

1. `npm run tdd:unit`
2. `npm run tdd:integration`
3. `npm run tdd:e2e`
4. `npm run test:all`

## 실제 서브에이전트

- `.github/agents/harucheck-unit-tdd.agent.md`
- `.github/agents/harucheck-integration-tdd.agent.md`
- `.github/agents/harucheck-e2e-tdd.agent.md`

각 에이전트는 담당 테스트를 먼저 실행하고, 실패 시 해당 범위만 수정한 뒤 같은 테스트를
재실행한다. 담당 단계가 통과한 뒤에만 다음 단계로 넘긴다.
