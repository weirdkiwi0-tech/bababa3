# Unit Subagent

목표:
- 도메인 규칙을 가장 작은 단위에서 빠르게 검증한다.

범위:
- `src/lib/entryDomain.ts`
- 유효성 검사, 날짜 키/기간 집계, 스트릭 계산

작업 방식:
1. 실패하는 테스트 작성(Red)
2. 최소 구현으로 통과(Green)
3. 중복 제거/가독성 개선(Refactor)

실행:
- `npm run tdd:unit`
