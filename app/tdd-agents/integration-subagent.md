# Integration Subagent

목표:
- UI와 도메인 로직, 저장소 연동이 함께 의도대로 동작하는지 검증한다.

범위:
- `src/App.tsx`
- `src/lib/entryDomain.ts`
- localStorage 상호작용

작업 방식:
1. 사용자 액션 기준 테스트 작성(Red)
2. UI/상태/저장 로직을 최소 수정해 통과(Green)
3. 테스트 안정성/가독성 개선(Refactor)

실행:
- `npm run tdd:integration`
