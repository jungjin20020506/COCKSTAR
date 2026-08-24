import { useCallback, useMemo } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { logError } from '../../lib/errorLog';

// ===================================================================================
// 튜토리얼 시청 기록 — 두 곳에 남기고, 읽을 때 합친다
// -----------------------------------------------------------------------------------
// users/{uid}.tutorialSeen 이 권위 있는 값이고, localStorage 는 보조다.
// 한쪽만 보면 두 가지가 어긋난다.
//   · 서버만 보면 → Firestore 쓰기가 실패했을 때 매번 다시 뜬다
//   · 기기만 보면 → 폰을 바꾸면 이미 본 안내가 또 뜬다
//
// 쓸 때는 둘 다에 쓰고, 읽을 때는 둘 중 하나에만 있어도 '봤다'로 본다.
// ===================================================================================

const localKey = (uid) => `cockstar-tutorial-seen-${uid}`;

function readLocal(uid) {
    if (!uid) return {};
    try { return JSON.parse(localStorage.getItem(localKey(uid)) || '{}'); }
    catch { return {}; }
}

function writeLocal(uid, key, stamp) {
    if (!uid) return;
    try {
        const raw = readLocal(uid);
        localStorage.setItem(localKey(uid), JSON.stringify({ ...raw, [key]: stamp }));
    } catch { /* 사파리 프라이빗 모드 등 — 로컬 저장 실패는 무시한다 */ }
}

/**
 * @param {{uid: string}|null} user
 * @param {{tutorialSeen?: Record<string,string>}|null} userData
 */
export function useTutorial(user, userData) {
    const uid = user?.uid || null;

    const seen = useMemo(() => {
        const remote = userData?.tutorialSeen || {};
        const local = readLocal(uid);
        return { ...local, ...remote };
    }, [uid, userData]);

    const hasSeen = useCallback((key) => !!seen[key], [seen]);

    const markSeen = useCallback(async (key) => {
        const stamp = new Date().toISOString();
        writeLocal(uid, key, stamp);
        if (!uid) return;
        try {
            await setDoc(doc(db, 'users', uid), { tutorialSeen: { [key]: stamp } }, { merge: true });
        } catch (e) {
            // 로컬에는 남았으므로 이 기기에서는 다시 안 뜬다. 조용히 넘어간다.
            logError('튜토리얼 시청 기록', e);
        }
    }, [uid]);

    /** 안내를 처음부터 다시 보고 싶을 때 (설정 화면에서) */
    const resetSeen = useCallback(async (keys) => {
        const cleared = Object.fromEntries(keys.map(k => [k, null]));
        try {
            const raw = readLocal(uid);
            keys.forEach(k => { delete raw[k]; });
            if (uid) localStorage.setItem(localKey(uid), JSON.stringify(raw));
        } catch { /* noop */ }
        if (!uid) return;
        try {
            await setDoc(doc(db, 'users', uid), { tutorialSeen: cleared }, { merge: true });
        } catch (e) {
            logError('튜토리얼 기록 초기화', e);
        }
    }, [uid]);

    return { seen, hasSeen, markSeen, resetSeen };
}
