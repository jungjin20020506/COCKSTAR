import React, { useEffect, useState } from 'react';
import { getDailyResetKey } from '../../lib/time';

// ===================================================================================
// 경기방 입장 연출 — 코트에 들어서는 순간
// -----------------------------------------------------------------------------------
// 방에 들어가면 1.8초짜리 오프닝이 재생된다. 라임색 플래시 → 방 이름이 쾅 하고
// 박히고 → 공지가 있으면 이어서 떠오른다. 체육관 전광판이 켜지는 느낌.
//
// [무거워지지 않게 지킨 것]
//   · 전부 CSS 애니메이션 — JS 는 타이머 하나뿐이다. 이미지·라이브러리 없음.
//   · 재생이 끝나면 DOM 에서 완전히 사라진다 (남아서 터치를 막는 일이 없다)
//   · 아무 곳이나 탭하면 즉시 건너뛴다 — 연출은 서비스지 통행세가 아니다
//   · 방마다 '오늘 처음 들어올 때' 딱 한 번만 — 기기에 기록을 남기므로
//     새로고침·앱 재실행으로는 다시 나오지 않는다. (예전에는 메모리에만 기억해서
//     새로고침할 때마다 다시 재생됐다)
// ===================================================================================

// localStorage 를 못 쓰는 환경(사파리 프라이빗 등)을 위한 메모리 폴백
const seenThisSession = new Set();

/** 이 방의 연출을 오늘 이미 봤는가 */
function alreadySeen(roomId) {
    if (seenThisSession.has(roomId)) return true;
    try { return localStorage.getItem(`cockstar-entryfx-${roomId}`) === getDailyResetKey(); }
    catch { return false; }
}

function markSeen(roomId) {
    seenThisSession.add(roomId);
    try { localStorage.setItem(`cockstar-entryfx-${roomId}`, getDailyResetKey()); }
    catch { /* 저장이 막힌 환경 — 메모리 폴백만으로 동작한다 */ }
}

export function RoomEntryFX({ roomId, roomName, notice, locationName }) {
    // 초기화 함수는 순수하게 — StrictMode 가 두 번 불러도 같은 답이 나와야 한다.
    // '봤다' 기록은 아래 effect 에서 남긴다.
    const [visible, setVisible] = useState(() => !!roomId && !alreadySeen(roomId));

    useEffect(() => {
        if (!visible) return undefined;
        if (roomId) markSeen(roomId);
        const t = setTimeout(() => setVisible(false), notice ? 2600 : 1900);
        return () => clearTimeout(t);
    }, [visible, notice, roomId]);

    if (!visible) return null;

    return (
        <div
            className="entryfx-wrap"
            onClick={() => setVisible(false)}
            role="presentation"
            aria-hidden="true"
        >
            <div className="entryfx-flash" />
            <div className="entryfx-lines court-lines" />
            <div className="entryfx-body">
                <p className="entryfx-label">ENTER THE COURT</p>
                <h2 className="entryfx-title kern-tight">{roomName}</h2>
                {locationName && <p className="entryfx-loc">{locationName}</p>}
                <div className="entryfx-bar" />
                {notice && (
                    <div className="entryfx-notice">
                        <span className="entryfx-notice-icon">📢</span>
                        <span className="break-keep">{notice}</span>
                    </div>
                )}
            </div>
            <div className="entryfx-shuttle">🏸</div>
        </div>
    );
}
