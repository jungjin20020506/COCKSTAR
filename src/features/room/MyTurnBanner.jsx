import React, { useEffect, useMemo, useRef } from 'react';
import { Instagram, Timer, Activity, Trophy } from '../../components/ui/icons';

// ===================================================================================
// 내 차례 — 선수가 이 방에서 가장 궁금한 한 가지
// -----------------------------------------------------------------------------------
// 지금까지 이 앱은 철저히 '관리자용'이었다. 선수 화면에는 대기 명단과 배정표가
// 그대로 보이지만, 정작 본인이 궁금한 "나 언제 뛰어?"에는 아무도 답하지 않았다.
// 명단에서 자기 이름을 눈으로 찾아야 했다.
//
// 그래서 화면 맨 위에 한 줄로 답한다. 필요한 데이터는 이미 다 있었다 —
// 어느 코트에서 뛰는지, 대기열 몇 번째인지, 앞에 몇 경기가 남았는지.
//
// [대기 시간 어림]
//   (앞선 경기 수 ÷ 코트 수) × 한 경기 시간. 정확할 수 없는 값이라 '약'을 붙이고
//   5분 단위로 반올림한다. 분 단위로 딱 떨어지게 쓰면 안 맞을 때 더 크게 실망한다.
// ===================================================================================

const MINUTES_PER_GAME = 12;

function estimateWait(matchesAhead, courts) {
    const rounds = Math.ceil((matchesAhead + 1) / Math.max(1, courts));
    const mins = rounds * MINUTES_PER_GAME;
    return Math.max(5, Math.round(mins / 5) * 5);
}

/** 살짝 진동 — 체육관에서는 폰을 주머니에 넣고 수다를 떤다 */
function buzz(pattern) {
    try { navigator.vibrate?.(pattern); } catch { /* 지원 안 하면 그만 */ }
}

export function MyTurnBanner({
    me, roomData, players, inProgressPlayerIds, courtIndexByPlayer, onOpenBrag,
}) {
    const prevStateRef = useRef(null);

    const info = useMemo(() => {
        if (!me) return null;

        const courts = roomData?.numInProgressCourts || 1;

        // ① 지금 코트에서 뛰는 중
        if (inProgressPlayerIds?.has(me.id)) {
            const courtNo = (courtIndexByPlayer?.[me.id] ?? 0) + 1;
            return { state: 'playing', title: `지금 ${courtNo}번 코트에서 경기 중`, sub: '끝나면 관리자가 종료를 눌러줍니다' };
        }

        // ② 휴식 중
        if (me.isResting) {
            return { state: 'resting', title: '휴식 중', sub: '위의 복귀 버튼을 누르면 다시 매칭에 들어가요' };
        }

        // ③ 다음 경기가 잡혀 있다 (자동 매칭 · 경기 배정 둘 다 확인)
        const autoEntries = Object.entries(roomData?.autoMatches || {})
            .filter(([, m]) => Array.isArray(m))
            .sort((a, b) => Number(a[0]) - Number(b[0]));
        const autoIdx = autoEntries.findIndex(([, m]) => m.includes(me.id));

        const schedEntries = Object.entries(roomData?.scheduledMatches || {})
            .sort((a, b) => Number(a[0]) - Number(b[0]));
        const schedIdx = schedEntries.findIndex(([, m]) => (m || []).includes(me.id));

        if (autoIdx >= 0 || schedIdx >= 0) {
            const ahead = autoIdx >= 0 ? autoIdx : schedIdx;
            const myMatch = autoIdx >= 0 ? autoEntries[autoIdx][1] : schedEntries[schedIdx][1];
            const blockers = (myMatch || [])
                .filter(id => id && id !== me.id && inProgressPlayerIds?.has(id))
                .map(id => players?.[id]?.name)
                .filter(Boolean);

            const ready = blockers.length === 0 && (myMatch || []).filter(Boolean).length === 4;

            if (ready && ahead === 0) {
                return { state: 'ready', title: '다음 경기는 나!', sub: '코트가 비면 바로 시작해요. 준비하세요 🏸' };
            }
            return {
                state: 'queued',
                title: `다음 경기 예약됨 · 앞에 ${ahead}경기`,
                sub: blockers.length
                    ? `${blockers.join('·')}님 경기가 끝나면 시작 (약 ${estimateWait(ahead, courts)}분)`
                    : `약 ${estimateWait(ahead, courts)}분 뒤 예상`,
            };
        }

        // ④ 그냥 대기 중
        const queuedMatches = autoEntries.length + schedEntries.filter(([, m]) => (m || []).filter(Boolean).length === 4).length;
        return {
            state: 'waiting',
            title: '대기 중',
            sub: queuedMatches > 0
                ? `앞에 ${queuedMatches}경기가 잡혀 있어요 (약 ${estimateWait(queuedMatches, courts)}분)`
                : '관리자가 매칭을 만들면 여기에 표시돼요',
        };
    }, [me, roomData, players, inProgressPlayerIds, courtIndexByPlayer]);

    // 상태가 '내 차례'로 바뀌는 순간에만 진동한다.
    // 매 렌더마다 울리면 주머니에서 계속 떨려서 아무도 안 본다.
    useEffect(() => {
        const now = info?.state;
        const prev = prevStateRef.current;
        prevStateRef.current = now;
        if (!prev || prev === now) return;
        if (now === 'ready') buzz([40, 60, 40]);
        else if (now === 'playing') buzz(70);
    }, [info?.state]);

    if (!info) return null;

    const tone = {
        playing: { bg: 'bg-volt', text: 'text-ink', sub: 'text-ink/70', Icon: Activity },
        ready: { bg: 'bg-volt/15 border border-volt/45', text: 'text-volt', sub: 'text-dim', Icon: Timer },
        queued: { bg: 'bg-white/[0.05] border border-white/10', text: 'text-txt', sub: 'text-dim', Icon: Timer },
        waiting: { bg: 'bg-white/[0.04] border border-white/[0.08]', text: 'text-dim', sub: 'text-muted', Icon: Timer },
        resting: { bg: 'bg-white/[0.04] border border-white/[0.08]', text: 'text-dim', sub: 'text-muted', Icon: Timer },
    }[info.state];

    const Icon = tone.Icon;

    return (
        <section
            className={`rounded-2xl px-4 py-3.5 flex items-center gap-3 ${tone.bg} ${info.state === 'ready' ? 'animate-volt-pulse' : ''}`}
            aria-live="polite"
        >
            <Icon size={20} className={`${tone.text} shrink-0`} />
            <div className="flex-1 min-w-0">
                <p className={`text-sm font-black kern-tight leading-tight ${tone.text}`}>{info.title}</p>
                <p className={`text-[11px] font-bold mt-0.5 truncate ${tone.sub}`}>{info.sub}</p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
                <div className="text-right">
                    <p className={`text-lg font-black tabular leading-none ${tone.text}`}>{me.todayGames || 0}</p>
                    <p className={`text-[9px] font-black label ${tone.sub}`}>경기</p>
                </div>
                {onOpenBrag && (me.todayGames || 0) > 0 && (
                    <button
                        onClick={onOpenBrag}
                        aria-label="오늘의 기록 카드 만들기"
                        title="오늘의 기록 카드 만들기"
                        className={`w-9 h-9 rounded-xl flex items-center justify-center transition-transform active:scale-90 ${
                            info.state === 'playing' ? 'bg-ink/15 text-ink' : 'bg-volt/15 text-volt'
                        }`}
                    >
                        <Instagram size={17} />
                    </button>
                )}
            </div>
        </section>
    );
}

/** 방 안에서 내 순위를 한 줄로 (자랑 카드 유도) */
export function MyRankChip({ rank, total }) {
    if (!rank || !total) return null;
    return (
        <span className="inline-flex items-center gap-1 text-[10px] font-black text-volt bg-volt/10 px-2 py-1 rounded-full">
            <Trophy size={11} /> {total}명 중 {rank}위
        </span>
    );
}
