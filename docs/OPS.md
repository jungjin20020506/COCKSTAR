# 콕스타 운영 가이드 (OPS)

코드만으로는 끝나지 않는, **Firebase 콘솔에서 사람이 한 번 해줘야 하는 일**을 모았다.
문의: jung22459369@gmail.com

---

## 1. 비용 알림 설정 (아이디어 #99)

Firebase 비용 폭탄은 코드가 아니라 콘솔에서 막는다. 5분 걸린다.

1. [Google Cloud 콘솔 → 결제 → 예산 및 알림](https://console.cloud.google.com/billing/budgets) 접속
2. **예산 만들기** → 프로젝트 `noerror-14ce3` 선택
3. 월 예산 금액 입력 (예: ₩10,000)
4. 알림 기준: **50% / 90% / 100%** 에서 이메일 발송 (기본값 그대로)
5. 알림 수신자에 jung22459369@gmail.com 확인

추가로 **읽기/쓰기 급증 감지**:
- [Firebase 콘솔 → Firestore → 사용량](https://console.firebase.google.com/project/noerror-14ce3/firestore/usage) 을 주 1회 확인
- 평소보다 읽기가 10배 이상 튀면: 구독 누수(onSnapshot 해제 누락) 또는 봇 접근을 의심할 것

## 2. 서버 푸시(FCM 발송) — 앱을 완전히 닫아도 오는 알림

지금 앱에는 **클라이언트 알림**이 들어 있다 (앱이 열려 있거나 백그라운드에 있을 때
배너·진동·소리). 앱을 **완전히 종료한 상태**에서도 알림을 보내려면 '보내는 서버'가
필요하다. 순서:

1. Firebase 요금제를 Blaze(종량제)로 전환 — 위 1번 예산 알림을 먼저 설정할 것
2. Cloud Functions 프로젝트 추가 (`firebase init functions`)
3. 콘솔 → 프로젝트 설정 → 클라우드 메시징에서 **웹 푸시 인증서(VAPID 키)** 생성
4. 클라이언트: `firebase/messaging` 으로 토큰 발급 → `users/{uid}.fcmTokens` 에 저장
5. Functions: 방 문서 변경(onDocumentUpdated)에서 "경기 시작" 을 감지해
   해당 4명의 토큰으로 `admin.messaging().send()` 호출
6. 아이폰은 **홈 화면에 추가된 PWA + 알림 권한 허용** 상태에서만 수신된다 (iOS 16.4+)

## 3. 버전 강제 업데이트 게이트 (아이디어 #96)

치명적 버그가 있는 구버전을 잠그는 스위치. Firestore 에 문서 하나만 만들면 된다.

- 컬렉션 `config`, 문서 ID `app`:
  ```
  minVersion: "1.1.0"        ← 이 버전 미만은 업데이트 화면에 갇힌다
  notice: "안내 문구 (선택)"
  ```
- 쓰기 권한은 슈퍼 관리자 클레임이 있어야 한다 (firestore.rules).
- 해제하려면 minVersion 을 낮추거나 필드를 지운다.
- 앱 버전은 package.json 의 `version` 이 빌드에 박힌다 — 배포 전에 올려둘 것.

## 4. 상품 데이터 자동 갱신 (아이디어 #61)

- `.github/workflows/update-products.yml` 이 **매주 월요일 03:00 KST** 에 공식몰에서
  상품을 다시 받아 자동 커밋한다.
- 실패하면 저장소에 `store-sync` 라벨 이슈가 열리고 GitHub 이 메일을 보낸다.
- 수동 실행: GitHub → Actions → "상품 데이터 자동 갱신" → Run workflow

## 5. 슈퍼 관리자 권한 (아이디 #82)

슈퍼 관리자는 두 겹이다:

| 층 | 어디서 판정 | 주는 것 | 붙이는 법 |
|---|---|---|---|
| 화면 | `src/lib/superAdmin.ts` 이메일 목록 | 시뮬레이션 랩·신고 검토 메뉴 등 UI | 목록에 이메일 추가 |
| 서버 | Firestore 규칙 `isSuper()` — 커스텀 클레임 | 신고 열람·처리, config/app 쓰기, 남의 방 삭제 | 아래 스크립트 |

**클레임 붙이기 (진짜 권한):**
```bash
npm i -D firebase-admin
# 콘솔 → 프로젝트 설정 → 서비스 계정 → 새 비공개 키 생성 후
$env:GOOGLE_APPLICATION_CREDENTIALS="C:\경로\serviceAccount.json"
node scripts/set-super-admin.mjs domain@cockstar.app
```
- 계정이 없다는 오류가 나면: 콘솔 → Authentication → **사용자 추가**로
  `domain@cockstar.app` 를 먼저 만든다 (아이디 로그인 'domain' 이 이 이메일로 변환된다).
- 확인: `node scripts/set-super-admin.mjs --list` / 해제: `--revoke 이메일`
- 적용은 해당 계정 재로그인 또는 토큰 갱신(최대 1시간) 후.
- ⚠️ 서비스 계정 JSON 은 절대 저장소에 커밋하지 말 것.

## 6. Firestore 일일 백업 (권장)

```bash
gcloud firestore export gs://noerror-14ce3-backup --project noerror-14ce3
```
- Cloud Scheduler 로 매일 새벽 실행을 걸어두면 하루치 이상 잃지 않는다.
- 버킷은 Coldline 스토리지로 만들면 비용이 거의 없다.
