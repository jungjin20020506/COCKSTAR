import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Instagram, Timer, Activity, Trophy, BellRing } from '../../components/ui/icons';
import {
    notify, notificationsSupported, notificationPermission, requestNotificationPermission,
} from '../../lib/notify';
import { getInAppBrowser, escapeInAppBrowser, isIOS, isStandalone } from '../../components/ui/InstallPrompt';
import { toast } from '../../lib/toast';

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
// [대기 시간 어림 — "약 N~N분"]
//   한 경기를 10분으로 잡는다. 앞선 경기들이 활성 코트에 나눠 들어가므로
//     최소 = ⌊앞선 경기 ÷ 코트 수⌋ × 10분   (내 앞이 전부 순조롭게 빠질 때)
//     최대 = ⌈(앞선 경기 + 내 경기) ÷ 코트 수⌉ × 10분
//   정확할 수 없는 값이라 단정하는 한 숫자 대신 범위로 말한다 —
//   "약 20분"이라고 했다가 25분이 되면 실망하지만, "약 10~20분"은 약속을 지킨다.
//
// [알림]
//   상태가 바뀌는 '순간'에만 알린다 (매 렌더마다 울리면 아무도 안 본다).
//     · 경기가 잡힘   → 조용한 진동 + 기록
//     · 다음 경기는 나 → 배너 + 진동 + 띠링
//     · 코트 입장     → 배너 + 진동 + 띠링
//   시스템 알림 권한이 없으면 진동·소리·화면 배너까지만 — lib/notify 가 알아서 한다.
// ===================================================================================

const MINUTES_PER_GAME = 10;

/** 앞선 경기 수와 활성 코트 수로 대기 시간 범위(분)를 만든다 */
function waitRange(matchesAhead, courts) {
    const c = Math.max(1, courts);
    const low = Math.floor(matchesAhead / c) * MINUTES_PER_GAME;
    const high = Math.max(MINUTES_PER_GAME, Math.ceil((matchesAhead + 1) / c) * MINUTES_PER_GAME);
    return { low, high };
}

function waitText(matchesAhead, courts) {
    const { low, high } = waitRange(matchesAhead, courts);
    return low <= 0 ? `약 ${high}분 이내` : `약 ${low}~${high}분`;
}

// ===================================================================================
// 알림 권한 상태 배너 — 방 상단 고정
// -----------------------------------------------------------------------------------
// 알림 권한이 없으면 "내 차례" 안내가 화면 배너로만 온다 — 주머니 속 폰에는 안 닿는다.
// 그래서 권한이 허용되기 전까지 방 상단에 얇은 배너를 계속 둔다.
// 상태마다 '지금 할 수 있는 딱 한 가지'로 이어준다.
//
//   · 아직 안 물어봄(default) → [켜기] 한 번에 브라우저 권한 창
//   · 거부됨(denied)          → 브라우저 설정에서 여는 길을 알려준다 (재요청은 브라우저가 막는다)
//   · 카톡 인앱               → 알림 자체가 안 되는 곳 — 브라우저로 탈출
//   · 아이폰 사파리(비설치)    → 홈 화면에 추가해야 알림이 된다 — 설치 안내로
//   · 허용됨(granted)         → 배너 없음
// ===================================================================================

export function NotiPermissionBanner({ onNeedInstall }) {
    const [perm, setPerm] = useState(() => notificationPermission());

    // 설정에서 바꾸고 돌아온 경우를 따라잡는다 (권한 값은 이벤트를 안 쏘므로 직접 다시 읽는다)
    useEffect(() => {
        const sync = () => setPerm(notificationPermission());
        document.addEventListener('visibilitychange', sync);
        window.addEventListener('focus', sync);
        return () => {
            document.removeEventListener('visibilitychange', sync);
            window.removeEventListener('focus', sync);
        };
    }, []);

    if (perm === 'granted') return null;

    const inApp = getInAppBrowser();
    const supported = notificationsSupported();

    let text; let cta; let onClick;
    if (!supported && inApp) {
        text = '카톡 안에서는 경기 알림을 받을 수 없어요';
        cta = '브라우저로 열기';
        onClick = () => { if (!escapeInAppBrowser()) onNeedInstall?.(); };
    } else if (!supported && isIOS() && !isStandalone()) {
        text = '홈 화면에 추가하면 내 차례 알림을 받을 수 있어요';
        cta = '방법 보기';
        onClick = () => onNeedInstall?.();
    } else if (!supported) {
        return null;   // 알림이 아예 없는 환경 — 배너로 조를 방법도 없다
    } else if (perm === 'denied') {
        text = '알림이 꺼져 있어요 — 허용해야 경기 안내를 받을 수 있어요';
        cta = '여는 법';
        onClick = () => toast('브라우저 주소창 옆 자물쇠(또는 설정 → 알림)에서 콕스타 알림을 허용해주세요.');
    } else {
        // default — 켜기 버튼을 누른 '그 순간'에만 권한 창을 띄울 수 있다 (브라우저 규칙)
        text = '알림을 허용해야 내 차례·경기 시작 안내를 받을 수 있어요';
        cta = '켜기';
        onClick = async () => {
            const result = await requestNotificationPermission();
            setPerm(result);
            if (result === 'granted') {
                notify({ title: '알림이 켜졌습니다 🔔', body: '내 차례가 오면 진동·소리와 함께 알려드릴게요.', tag: 'noti-test' });
            }
        };
    }

    return (
        <button
            onClick={onClick}
            className="flex-shrink-0 w-full flex items-center gap-2.5 px-4 py-2 bg-volt/10 border-b border-volt/25 text-left"
        >
            <BellRing size={14} className="text-volt shrink-0" />
            <span className="flex-1 min-w-0 text-[11px] font-bold text-txt break-keep leading-snug">{text}</span>
            <span className="shrink-0 px-3 py-1.5 rounded-full bg-volt text-ink text-[10px] font-black">{cta}</span>
        </button>
    );
}

export function MyTurnBanner({
    me, roomData, players, inProgressPlayerIds, courtIndexByPlayer, onOpenBrag,
}) {
    const prevStateRef = useRef(null);

    const info = useMemo(() => {
        if (!me) return null;

        // 활성화된 코트 수 — 대기 시간 계산의 분모다
        const courts = roomData?.numInProgressCourts || 1;

        // ① 지금 코트에서 뛰는 중
        if (inProgressPlayerIds?.has(me.id)) {
            const courtNo = (courtIndexByPlayer?.[me.id] ?? 0) + 1;
            return { state: 'playing', courtNo, title: `지금 ${courtNo}번 코트에서 경기 중`, sub: '끝나면 관리자가 종료를 눌러줍니다' };
        }

        // ② 다음 경기가 잡혀 있다 (자동 매칭 · 경기 배정 둘 다 확인)
        //    휴식 판정보다 먼저 본다 — 휴식 중이어도 관리자가 경기에 넣을 수 있고,
        //    그때는 "다음 경기는 나" 알림이 휴식 안내보다 중요하다.
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
                    ? `${blockers.join('·')}님 경기가 끝나면 시작 (${waitText(ahead, courts)})`
                    : `${waitText(ahead, courts)} 뒤 예상`,
            };
        }

        // ③ 휴식 중 (잡힌 경기가 없을 때만)
        if (me.isResting) {
            return { state: 'resting', title: '휴식 중', sub: '위의 복귀 버튼을 누르면 다시 매칭에 들어가요' };
        }

        // ④ 그냥 대기 중
        const queuedMatches = autoEntries.length + schedEntries.filter(([, m]) => (m || []).filter(Boolean).length === 4).length;
        return {
            state: 'waiting',
            title: '대기 중',
            sub: queuedMatches > 0
                ? `앞에 ${queuedMatches}경기가 잡혀 있어요 (${waitText(queuedMatches, courts)})`
                : '관리자가 매칭을 만들면 여기에 표시돼요',
        };
    }, [me, roomData, players, inProgressPlayerIds, courtIndexByPlayer]);

    // 상태가 바뀌는 '순간'에만 알린다 — 진동·소리·시스템 알림·기록을 lib/notify 가 처리
    useEffect(() => {
        const now = info?.state;
        const prev = prevStateRef.current;
        prevStateRef.current = now;
        if (!prev || prev === now || !now) return;
        if (now === 'ready') {
            notify({
                title: '다음 경기는 나! 🏸',
                body: '코트가 비면 바로 시작해요. 준비하세요.',
                tag: 'myturn',
                vibrate: [40, 60, 40, 60, 40],
            });
        } else if (now === 'playing') {
            notify({
                title: `${info.courtNo || ''}번 코트로 입장하세요 🏸`,
                body: '경기가 시작됐어요!',
                tag: 'myturn',
                vibrate: [70, 50, 70],
            });
        } else if (now === 'queued' && (prev === 'waiting' || prev === 'resting')) {
            // 예약 소식은 조용히 — 진동 한 번과 기록만
            notify({ title: '내 경기가 잡혔어요 🔔', body: info.sub || '', tag: 'myturn', silent: true, vibrate: [40] });
        }
    }, [info]);

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
        <div className="space-y-2">
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

            {/* 알림 권한 유도는 방 상단의 NotiPermissionBanner 가 맡는다 —
                허용될 때까지 계속 보이는 배너가 여기 있던 일회성 안내보다 확실하다 */}
        </div>
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
