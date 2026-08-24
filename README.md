# COCKSTAR · 콕스타 🏸

배드민턴 실시간 매칭 플랫폼. 경기방을 열고, 자동 매칭으로 공평하게 코트를 돌리고,
오늘의 기록을 카드로 남긴다.

## 개발

```bash
npm install
npm run dev        # 개발 서버 (localhost:5173)
npm run verify     # lint + 타입 + 테스트 + 빌드 (푸시 전 이거 하나)
```

| 명령 | 하는 일 |
|---|---|
| `npm run build` | 프로덕션 빌드 (PWA 서비스 워커 포함) |
| `npm test` | 컴포넌트·로직 테스트 (vitest) |
| `npm run test:matching` | 자동 매칭 엔진 시뮬레이션 |
| `npm run typecheck` | TypeScript 검사 |
| `npm run icons` | 앱 아이콘 재생성 (`scripts/generate-icons.mjs`) |
| `npm run fetch:products` | 노에러 상품 데이터 갱신 |

## 구조

```
src/
├── App.jsx               라우터 + 앱 껍데기
├── firebase.js           Firebase 초기화 (오프라인 캐시 포함)
├── constants.js          전역 상수 · 문의 창구
├── context/              로그인 상태 · 경기방 목록 (전역 구독 1개)
├── pages/                화면 5개 (홈 · 스토어 · 로비 · 경기방 · 콕맵 · 내 정보)
├── features/
│   ├── auth/             로그인 · 계정 찾기 · 프로필
│   ├── room/             경기방 부품 + useGameRoom (모든 Firestore 로직)
│   ├── tutorial/         환영 투어 · 방 만들기 안내 · 관리자 안내 · 자동매칭 연습
│   └── feedback/         문의 · 버그 신고
├── components/ui/        Modal · confirm · 토스트 · 아이콘 · 로고 · 설치 안내
├── lib/                  순수 로직 (매칭 엔진 · 정렬 · 카드 그리기 · 비밀번호 해시 …)
└── test/                 vitest
```

- **매칭 엔진**(`lib/matching.js`)은 프레임워크를 모르는 순수 함수다.
  `lib/matchQueues.js` 가 Firestore 데이터를 엔진이 아는 모양으로 번역한다.
- **보안 규칙**은 `firestore.rules` 가 진실이다.
  배포: `firebase deploy --only firestore:rules`
- **환경변수**는 없어도 돌아간다 (`src/firebase.js` 의 기본값).
  다른 Firebase 프로젝트를 쓰려면 `.env` 에 `VITE_API_KEY` 등을 넣는다.

## 만든 사람

정형진 · 문의는 앱 안 **내 정보 → 문의·버그 신고**
