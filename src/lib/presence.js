import { useEffect, useRef } from 'react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

// ===================================================================================
// 접속 확인 — '방을 나갔는데 명단에 남아 있는 사람'을 줄인다
// -----------------------------------------------------------------------------------
// 지금까지 방을 나가는 유일한 방법은 관리자가 카드의 X를 눌러주는 것뿐이었다.
// 그래서 저녁 8시에 잠깐 들렀다 간 사람이 밤 11시까지 대기 명단에 남아 있고,
// 매칭 후보로 계속 뽑혔다. 관리자는 매번 "이 사람 갔어요"를 듣고 손으로 지웠다.
//
// [어떻게]
//   화면이 켜져 있는 동안 3분마다 lastSeen 을 찍는다. 45분 넘게 소식이 없으면
//   '자리 비움'으로 본다.
//
// [왜 자동으로 내보내지 않나]
//   폰 화면이 꺼져 있거나 지하 체육관에서 신호가 끊긴 것뿐일 수 있다.
//   사람을 마음대로 지우면 돌아왔을 때 오늘 기록이 사라져 있다.
//   그래서 자동으로는 '휴식'까지만 바꾸고(매칭 후보에서는 빠진다),
//   실제로 내보내는 건 관리자가 한 번 눌러 확인하게 한다.
// ===================================================================================

/** 하트비트 주기 — 3분. 더 짧게 하면 쓰기 요금이 늘고, 더 길면 판정이 둔해진다 */
const BEAT_MS = 3 * 60 * 1000;

// 판정 규칙(순수 함수)은 presenceRules.js 에 있다 — 여기서 다시 내보내 기존 import 를 지킨다
export { STALE_MINUTES, findStalePlayers, findAutoRestTargets } from './presenceRules';

/**
 * 내가 이 방에 살아 있다고 알린다.
 *
 * 화면이 가려지면(탭 전환·홈 버튼) 멈추고, 돌아오면 즉시 한 번 찍는다.
 * 안 그러면 주머니 속 폰이 밤새 하트비트를 보내서 판정이 무의미해진다.
 */
export function usePresence(roomId, uid, enabled) {
    const lastBeatRef = useRef(0);

    useEffect(() => {
        if (!enabled || !roomId || !uid) return undefined;

        const ref = doc(db, 'rooms', roomId, 'players', uid);
        let cancelled = false;

        const beat = async () => {
            if (cancelled || document.visibilityState !== 'visible') return;
            // 너무 자주 쓰지 않게 한 번 더 막는다 (화면 전환이 잦을 때)
            if (Date.now() - lastBeatRef.current < BEAT_MS * 0.8) return;
            lastBeatRef.current = Date.now();
            try { await updateDoc(ref, { lastSeen: serverTimestamp() }); }
            catch { /* 문서가 없거나 권한이 없으면 조용히 넘어간다 */ }
        };

        beat();
        const id = setInterval(beat, BEAT_MS);
        document.addEventListener('visibilitychange', beat);

        return () => {
            cancelled = true;
            clearInterval(id);
            document.removeEventListener('visibilitychange', beat);
        };
    }, [roomId, uid, enabled]);
}

