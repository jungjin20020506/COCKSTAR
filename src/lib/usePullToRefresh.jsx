import { useEffect, useRef, useState } from 'react';

// ===================================================================================
// 당겨서 새로고침
// -----------------------------------------------------------------------------------
// 콕스타 데이터는 onSnapshot 실시간이라 기술적으로는 당길 필요가 없다.
// 그래도 넣는 이유: "지금 보는 게 최신 맞아?"라는 불안에 몸으로 답하는 장치다.
// 특히 체육관 와이파이가 끊겼다 붙었을 때, 당겨보고 스피너가 돌면 마음이 놓인다.
//
// [구현 원칙]
//   · 스크롤이 맨 위(scrollTop ≤ 0)일 때만 발동 — 목록 스크롤과 절대 안 겹친다
//   · 세로로 확실히 당길 때만 (가로 스와이프·탭과 구분)
//   · 브라우저 자체 새로고침 제스처와 겹치지 않게 overscroll-behavior-y 는
//     이미 body 에서 꺼져 있다 (index.css)
//
// @param {React.RefObject} scrollRef 스크롤되는 컨테이너
// @param {() => Promise<void>|void} onRefresh 당겼을 때 할 일
// @returns {{ pulling: number, refreshing: boolean }} pulling = 당긴 거리(px)
// ===================================================================================

const THRESHOLD = 70;   // 이만큼 당기면 발동
const MAX_PULL = 110;   // 이 이상은 저항이 걸린 듯 멈춘다

export function usePullToRefresh(scrollRef, onRefresh) {
    const [pulling, setPulling] = useState(0);
    const [refreshing, setRefreshing] = useState(false);
    const startYRef = useRef(null);
    const activeRef = useRef(false);
    const refreshingRef = useRef(false);
    // touchend 는 최신 pulling 값을 클로저로 못 보므로 ref 로 동기화한다
    const pullingRef = useRef(0);
    useEffect(() => { pullingRef.current = pulling; }, [pulling]);

    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return undefined;

        const onStart = (e) => {
            if (refreshingRef.current) return;
            if (el.scrollTop > 0) { startYRef.current = null; return; }
            startYRef.current = e.touches[0].clientY;
            activeRef.current = false;
        };

        const onMove = (e) => {
            if (startYRef.current === null || refreshingRef.current) return;
            const dy = e.touches[0].clientY - startYRef.current;
            if (dy <= 0) { if (activeRef.current) { activeRef.current = false; setPulling(0); } return; }
            if (el.scrollTop > 0) return;
            activeRef.current = true;
            // 당길수록 저항이 커지는 감쇠 곡선
            const eased = Math.min(MAX_PULL, dy * 0.5);
            setPulling(eased);
        };

        const onEnd = async () => {
            if (!activeRef.current) { startYRef.current = null; return; }
            const fired = pullingRef.current >= THRESHOLD;
            startYRef.current = null;
            activeRef.current = false;
            if (!fired) { setPulling(0); return; }
            refreshingRef.current = true;
            setRefreshing(true);
            setPulling(THRESHOLD * 0.7);
            try { navigator.vibrate?.(20); } catch { /* noop */ }
            try { await onRefresh?.(); } catch { /* 실패해도 스피너는 접는다 */ }
            // 실시간 데이터라 즉시 끝나면 '한 게 없어 보인다' — 짧게 돌려준다
            await new Promise(r => setTimeout(r, 500));
            refreshingRef.current = false;
            setRefreshing(false);
            setPulling(0);
        };

        el.addEventListener('touchstart', onStart, { passive: true });
        el.addEventListener('touchmove', onMove, { passive: true });
        el.addEventListener('touchend', onEnd, { passive: true });
        el.addEventListener('touchcancel', onEnd, { passive: true });
        return () => {
            el.removeEventListener('touchstart', onStart);
            el.removeEventListener('touchmove', onMove);
            el.removeEventListener('touchend', onEnd);
            el.removeEventListener('touchcancel', onEnd);
        };
    }, [scrollRef, onRefresh]);

    return { pulling, refreshing };
}

/** 당김 표시기 — 목록 위에 얹는 얇은 원형 스피너 */
export function PullIndicator({ pulling, refreshing }) {
    if (pulling <= 0 && !refreshing) return null;
    const progress = Math.min(1, pulling / THRESHOLD);
    return (
        <div
            className="flex justify-center overflow-hidden transition-[height] duration-150"
            style={{ height: refreshing ? 44 : pulling * 0.55 }}
            aria-hidden="true"
        >
            <div
                className={`w-7 h-7 mt-2 rounded-full border-2 border-volt/30 border-t-volt ${refreshing ? 'animate-spin' : ''}`}
                style={refreshing ? undefined : { transform: `rotate(${progress * 300}deg)`, opacity: 0.35 + progress * 0.65 }}
            />
        </div>
    );
}
