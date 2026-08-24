// ===================================================================================
// 에러 수집 — 지금까지 오류는 console.error 로 사라졌다
// -----------------------------------------------------------------------------------
// 사용자 폰에서 난 오류는 우리가 볼 방법이 없었다. 이제 세 가지를 한다.
//   ① 최근 오류 30건을 기기에 남긴다 → 문의 메일에 자동으로 붙는다
//   ② 잡히지 않은 오류·Promise 거부를 전역에서 받아 적는다
//   ③ VITE_SENTRY_DSN 이 있으면 Sentry 로도 보낸다 (없으면 아무것도 안 불러온다)
//
// Sentry를 '있으면 쓰고 없으면 만다'로 만든 이유: DSN 없이 SDK를 넣어두면 30KB가
// 그냥 낭비된다. 동적 import 라서 DSN이 없는 지금은 코드조차 내려받지 않는다.
// ===================================================================================

const KEY = 'cockstar-error-log';
const MAX = 30;

/** @returns {Array<{at:string, msg:string, where:string}>} */
export function readErrorLog() {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]'); }
    catch { return []; }
}

export function logError(where, error) {
    const msg = error?.message || String(error || '알 수 없는 오류');
    console.error(`[${where}]`, error);
    try {
        const list = readErrorLog();
        list.unshift({ at: new Date().toISOString(), where, msg: msg.slice(0, 300) });
        localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
    } catch { /* 저장 실패는 무시 — 로그 때문에 앱이 죽으면 안 된다 */ }

    if (sentry) { try { sentry.captureException(error instanceof Error ? error : new Error(msg)); } catch { /* noop */ } }
}

export function clearErrorLog() {
    try { localStorage.removeItem(KEY); } catch { /* noop */ }
}

let sentry = null;

/** 앱 시작 때 한 번 부른다 */
export function initErrorTracking() {
    if (typeof window === 'undefined') return;

    window.addEventListener('error', (e) => {
        // 이미지 로딩 실패 같은 리소스 오류는 제외 (message가 비어 있다)
        if (!e.message) return;
        logError('window.error', e.error || new Error(e.message));
    });
    window.addEventListener('unhandledrejection', (e) => {
        logError('unhandledrejection', e.reason);
    });

    const dsn = import.meta.env.VITE_SENTRY_DSN;
    if (!dsn) return;
    // Sentry 는 '설치돼 있을 때만' 쓰는 선택 의존성이다. 모듈 이름을 변수로 감추면
    // 번들러가 정적으로 해석하지 않아, 패키지가 없어도 빌드가 통과한다.
    const moduleName = '@sentry/react';
    import(/* @vite-ignore */ moduleName)
        .then(S => {
            S.init({ dsn, tracesSampleRate: 0.1, environment: import.meta.env.MODE });
            sentry = S;
        })
        .catch(() => { /* Sentry 없이도 앱은 돌아간다 */ });
}

/** 문의 메일에 붙일 진단 정보 — 개인정보는 넣지 않는다 */
export function diagnosticsText() {
    const errs = readErrorLog().slice(0, 5)
        .map(e => `  · ${e.at} [${e.where}] ${e.msg}`)
        .join('\n');
    return [
        `앱 버전: ${__APP_VERSION__ || 'dev'}`,
        `화면: ${window.innerWidth}x${window.innerHeight}`,
        `브라우저: ${navigator.userAgent}`,
        `온라인: ${navigator.onLine ? '예' : '아니오'}`,
        errs ? `최근 오류:\n${errs}` : '최근 오류: 없음',
    ].join('\n');
}
