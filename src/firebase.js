// ===================================================================================
// Firebase 초기화 — 앱 전체에서 이 파일 하나만 import 한다
// -----------------------------------------------------------------------------------
// 예전에는 App.jsx 맨 위에서 초기화했다. 파일을 나누면서 여기로 옮겼는데,
// 그냥 정리 차원이 아니라 꼭 필요한 일이었다. 모듈이 여러 개가 되면 각자
// initializeApp을 부르게 되고, 그러면 Firebase 인스턴스가 여러 개 생긴다.
// ===================================================================================
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import {
    initializeFirestore,
    getFirestore,
    persistentLocalCache,
    persistentMultipleTabManager,
} from 'firebase/firestore';

// ── 설정 값 ──
// 환경변수가 있으면 그걸 쓰고, 없으면 기본값을 쓴다.
//
// 기본값을 코드에 두는 게 이상해 보일 수 있는데, Firebase 웹 설정은 비밀이 아니다.
// 어차피 브라우저로 내려가는 값이고(개발자도구에 그대로 보인다), 실제 보안은
// Firestore 규칙과 App Check 이 맡는다. 오히려 .env 가 없는 기기에서 빌드하면
// apiKey 가 undefined 로 들어가 앱이 통째로 안 켜지는 사고가 났었다.
const env = import.meta.env;
const firebaseConfig = {
    apiKey: env.VITE_API_KEY || 'AIzaSyC-eeHazZ3kVj7aQicdtlnhEmLbbTJHgGE',
    authDomain: env.VITE_AUTH_DOMAIN || 'noerror-14ce3.firebaseapp.com',
    projectId: env.VITE_PROJECT_ID || 'noerror-14ce3',
    storageBucket: env.VITE_STORAGE_BUCKET || 'noerror-14ce3.appspot.com',
    messagingSenderId: env.VITE_MESSAGING_SENDER_ID || '279065154821',
    appId: env.VITE_APP_ID || '1:279065154821:web:812570dde2bdde560a936c',
    measurementId: env.VITE_MEASUREMENT_ID || 'G-PFGZGHT9T4',
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// ── 오프라인 캐시 ──
// 체육관 와이파이는 자주 끊긴다. 캐시가 있으면 끊긴 사이에도 방 목록·선수 명단이
// 그대로 보이고, 연결이 돌아오면 알아서 맞춰진다. 재방문 시 첫 화면도 즉시 뜬다.
//
// multipleTabManager: 탭을 여러 개 열어도 캐시가 깨지지 않는다. 이게 없으면
// 두 번째 탭에서 캐시가 아예 꺼져버린다 (관리자는 PC에서 탭을 여러 개 연다).
//
// 사파리 프라이빗 모드처럼 저장이 막힌 환경에서는 캐시 없이 그냥 동작한다.
let firestore;
try {
    firestore = initializeFirestore(app, {
        localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
} catch (e) {
    console.warn('오프라인 캐시를 켜지 못했습니다. 온라인 전용으로 동작합니다.', e);
    firestore = getFirestore(app);
}

export const db = firestore;

// ── Firestore 내부 오류 자동 복구 ──
// 일부 기기(특히 아이폰 사파리)에서 IndexedDB 캐시가 꼬이면 SDK 가
// "INTERNAL ASSERTION FAILED" 를 던지며 실시간 구독이 통째로 멈춘다.
// 화면은 떠 있는데 아무것도 갱신되지 않는 '먹통' — 사용자에게는 튕김으로 보인다.
//
// 이 오류는 잡아서 고칠 수 있는 것이 아니라서, 감지 즉시 새로고침 한 번으로
// SDK 를 다시 세운다. 무한 새로고침이 되지 않게 30초에 한 번만 허용한다.
if (typeof window !== 'undefined') {
    const RECOVER_KEY = 'cockstar-firestore-recovered-at';
    const isFirestoreAssertion = (msg) =>
        typeof msg === 'string' && msg.includes('FIRESTORE') && msg.includes('INTERNAL ASSERTION FAILED');

    const recover = () => {
        let last = 0;
        try { last = Number(sessionStorage.getItem(RECOVER_KEY) || '0'); } catch { /* noop */ }
        if (Date.now() - last < 30 * 1000) return;   // 방금 복구했는데 또 터짐 — 루프 방지
        try { sessionStorage.setItem(RECOVER_KEY, String(Date.now())); } catch { /* noop */ }
        window.location.reload();
    };

    window.addEventListener('error', (e) => {
        if (isFirestoreAssertion(e?.message || e?.error?.message)) recover();
    });
    window.addEventListener('unhandledrejection', (e) => {
        if (isFirestoreAssertion(e?.reason?.message)) recover();
    });
}
