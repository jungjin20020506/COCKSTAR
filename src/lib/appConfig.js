import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

// ===================================================================================
// 앱 원격 설정 — 버전 게이트
// -----------------------------------------------------------------------------------
// 치명적인 버그가 배포됐을 때, 그 버전을 계속 쓰는 기기를 막는 마지막 안전장치.
// Firestore 의 config/app 문서 하나로 조종한다 (Remote Config SDK 를 더 얹지 않는다 —
// 번들이 커질 이유가 없다).
//
//   config/app 문서:
//     minVersion: "1.0.0"   ← 이 버전 미만은 업데이트 화면에 갇힌다
//     notice:     "..."      ← (선택) 게이트 화면에 함께 보여줄 안내문
//
// 쓰기는 슈퍼 관리자만 (firestore.rules). 문서가 없으면 게이트는 조용히 꺼진다 —
// 설정 문서 하나 없다고 앱이 안 켜지면 안 된다.
// ===================================================================================

// 비교 로직은 순수 모듈로 분리 — 시뮬레이션이 firebase 없이 검증한다
export { versionLessThan } from './version.js';
import { versionLessThan } from './version.js';

/**
 * 지금 버전이 최소 버전보다 낮은지 확인한다.
 * @returns {Promise<{blocked: boolean, minVersion?: string, notice?: string}>}
 */
export async function checkVersionGate(currentVersion) {
    try {
        const snap = await getDoc(doc(db, 'config', 'app'));
        if (!snap.exists()) return { blocked: false };
        const { minVersion, notice } = snap.data() || {};
        if (!minVersion) return { blocked: false };
        return { blocked: versionLessThan(currentVersion, minVersion), minVersion, notice };
    } catch {
        // 네트워크·권한 문제로 못 읽으면 막지 않는다 — 게이트가 앱을 죽이면 본말전도다
        return { blocked: false };
    }
}

/** 캐시(서비스 워커 포함)를 비우고 새 버전을 받는다 */
export async function forceUpdate() {
    try {
        const regs = await navigator.serviceWorker?.getRegistrations?.() || [];
        await Promise.all(regs.map(r => r.unregister()));
    } catch { /* noop */ }
    try {
        const keys = await window.caches?.keys?.() || [];
        await Promise.all(keys.map(k => caches.delete(k)));
    } catch { /* noop */ }
    window.location.reload();
}
