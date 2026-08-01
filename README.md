# HaruCheck

긴 글 일기의 부담을 줄이고, 출석 체크처럼 짧은 기록으로 습관을 만드는 웹 애플리케이션입니다.

## 애플리케이션 개요

현재 범위(Phase 1):
- 일일 기록 생성/수정/삭제
- 스트릭(current/best) 및 월 1회 유예
- 월간 캘린더와 기본 통계
- 익명 식별자 기반 연속성 유지

향후 범위(Phase 2):
- 공개 피드
- 공개/비공개 전환
- 신고/콘텐츠 안전

참조 문서:
- PRD.md
- IDEATION.md
- ARCHITECTURE.md
- TRD.md

## 전체 아키텍처 다이어그램

```mermaid
flowchart LR
  U[User Browser] --> FE[Frontend App\nReact + TypeScript + Vite]
  FE --> API[Backend API\n(추후 구현)]
  API --> DB[(Database\n(추후 구현))]

  subgraph Phase1[Phase 1 MVP]
    FE
  end

  subgraph Phase2[Phase 2 Extension]
    API
    DB
  end
```

## 시작하기

1. 저장소 루트로 이동합니다.
2. `app` 디렉터리로 이동합니다.
3. 의존성을 설치하고 개발 서버를 실행합니다.

## 사전개발 환경 요구사항 (prerequisites)

- Node.js 20 이상
- npm 10 이상
- Git
- (선택) VS Code

권장 확인 명령:

```bash
node -v
npm -v
```

## 애플리케이션 실행하기 (로컬)

```bash
cd app
npm install
npm run dev
```

실행 주소:
- http://localhost:5173

## 애플리케이션 배포하기 (Azure) - 추후 작성

아래 항목은 추후 보강 예정입니다.
- Azure 리소스 구성
- 배포 파이프라인(CI/CD)
- 환경 변수/시크릿 관리
- 스테이징/운영 배포 절차

## 애플리케이션 테스트하기

```bash
cd app
npm run lint
npm run build
```

설명:
- `npm run lint`: 정적 코드 검사
- `npm run build`: 타입 체크 및 프로덕션 번들 빌드 검증

추후 자동화 테스트(예: Vitest, Playwright) 도입 시 본 섹션에 테스트 실행 방법을 추가합니다.
