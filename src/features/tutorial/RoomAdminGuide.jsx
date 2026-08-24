import React, { useEffect, useRef, useState } from 'react';
import { getLevelHex } from '../../lib/matchQueues';

// ===================================================================================
// 방 관리자 안내 v3 — 글로 읽지 않고, 직접 눌러보면서 배운다
// -----------------------------------------------------------------------------------
// v2까지는 항목을 글로 나열했는데 아무도 읽지 않았다 ("눈에 들어오지도 않는다"는
// 실제 피드백). 그래서 자동매칭 안내(AutoMatchGuide)와 같은 게임형으로 갈아엎었다.
// 실제 화면과 똑같이 생긴 연습 화면 위에서 코치(🤖)가 한 걸음씩 시키고,
// 관리자가 진짜처럼 눌러본다. 전체 2분.
//
//   ① 선수 카드 해부 — 카드의 네 부분이 각각 무엇인지 번호로 짚어준다
//   ② 탭해서 선택 → 빈칸에 넣기 → 경기 시작 → 경기 종료 (한 판을 직접 돌린다)
//   ③ 카드를 '꾹' 눌러 경기 수 수정 창을 직접 열어본다
//   ④ 설정(⋮)을 직접 눌러 열고, 항목을 하나씩 밝혀가며 배운다
//
// [무조건 보게 만드는 방법 — AutoMatchGuide와 같은 비대칭]
//   끝까지 하고 '확인했습니다'를 눌러야만 '봤음' 기록이 남는다(onComplete).
//   '나중에 할게요'(onDismiss)로 닫으면 기록이 안 남아 다음 접속 때 다시 뜬다.
//
// [전원에게 다시 띄우는 법] guideKeys.js 의 ROOM_ADMIN_GUIDE_KEY 버전을 올린다.
// ===================================================================================

// ───────────────────────────────────────────────────────────────────────────────────
// 연습용 부품 — 실제 PlayerCard와 같은 Tailwind 조합 (모양이 같아야 근육 기억이 옮겨간다)
// ───────────────────────────────────────────────────────────────────────────────────

function DemoCard({
    name, level, games, gender = '남', playing = false, selected = false, bump = false,
}) {
    return (
        <div
            className={`relative bg-card2 rounded-lg px-2 py-1 h-[52px] flex flex-col justify-center border border-white/[0.06] border-l-[3px] transition-all duration-300 select-none ${gender === '남' ? 'border-l-blue-500' : 'border-l-pink-500'} ${playing ? 'opacity-45 grayscale' : ''} ${selected ? 'ring-2 ring-volt ring-offset-2 ring-offset-ink scale-105 z-10 shadow-volt' : ''}`}
        >
            <div className="flex justify-between items-center gap-0.5 mb-0.5">
                <span className="text-xs font-black text-txt truncate leading-none">{name}</span>
                <span className={`text-[9px] font-black shrink-0 leading-none ${gender === '남' ? 'text-blue-400' : 'text-pink-400'}`}>{gender === '남' ? '♂' : '♀'}</span>
            </div>
            <div className="flex justify-between items-center">
                <span className="text-[10px] font-black" style={{ color: getLevelHex(level) }}>{level}</span>
                <span className={`text-[10px] font-black tabular ${bump ? 'text-volt' : 'text-muted'}`}>{games}G</span>
            </div>
            {playing && <span className="amg-playing-tag">경기중</span>}
        </div>
    );
}

/** ① 선수 카드 해부도 — 큰 카드 + 번호 딱지 + 아래 설명 */
function CardAnatomy() {
    const dot = (n, style) => (
        <span
            className="absolute w-[18px] h-[18px] rounded-full bg-volt text-ink text-[11px] font-black flex items-center justify-center z-10 shadow-volt"
            style={style}
        >{n}</span>
    );
    return (
        <div>
            <div className="flex justify-center my-4">
                <div className="relative" style={{ width: 168 }}>
                    {dot(1, { top: 8, left: -9 })}
                    {dot(2, { top: 8, right: -9 })}
                    {dot(3, { bottom: 8, left: -9 })}
                    {dot(4, { bottom: 8, right: -9 })}
                    {/* 실제 카드를 1.5배로 — 모양은 완전히 같다 */}
                    <div className="relative bg-card2 rounded-xl px-3.5 py-2 h-[78px] flex flex-col justify-center border border-white/[0.06] border-l-[5px] border-l-blue-500">
                        <div className="flex justify-between items-center mb-1.5">
                            <span className="text-lg font-black text-txt leading-none">김민수</span>
                            <span className="text-sm font-black text-blue-400 leading-none">♂</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-sm font-black" style={{ color: getLevelHex('A조') }}>A조</span>
                            <span className="text-sm text-muted font-black tabular">2G</span>
                        </div>
                    </div>
                </div>
            </div>
            <div className="space-y-1.5">
                {[
                    ['1', '이름', '이 선수가 누구인지'],
                    ['2', '남 ♂ / 여 ♀', '왼쪽 색 띠도 같아요 — 파랑=남 · 분홍=여'],
                    ['3', '급수', 'A조가 제일 잘 치고 → E조 순서예요'],
                    ['4', '오늘 친 경기 수', '"2G" = 오늘 2경기 쳤다는 뜻. 이 숫자가 공평의 기준!'],
                ].map(([n, h, p]) => (
                    <div key={n} className="flex items-start gap-2.5 p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.07]">
                        <span className="w-[18px] h-[18px] rounded-full bg-volt text-ink text-[11px] font-black flex items-center justify-center shrink-0">{n}</span>
                        <p className="text-[12px] leading-snug text-dim font-medium min-w-0">
                            <b className="text-txt">{h}</b> — {p}
                        </p>
                    </div>
                ))}
            </div>
        </div>
    );
}

/** 빈 슬롯 (실제 EmptySlot과 같은 모양) */
function DemoSlot({ onClick, finger }) {
    return (
        <div className={onClick ? 'amg2-fingerbox' : ''}>
            {finger && <div className="amg2-finger" style={{ fontSize: 24, top: -30 }}>👇</div>}
            <button
                type="button"
                onClick={onClick}
                className={`h-[52px] w-full rounded-lg flex items-center justify-center border-2 border-dashed transition-all ${onClick ? 'bg-volt/10 border-volt text-volt amg2-hi cursor-pointer' : 'bg-white/[0.02] border-white/10 text-muted'}`}
            >
                <span className="text-lg font-black leading-none">+</span>
            </button>
        </div>
    );
}

// ───────────────────────────────────────────────────────────────────────────────────
// 본체
// ───────────────────────────────────────────────────────────────────────────────────

const STAGE_ORDER = ['intro', 'card', 'place', 'court', 'press', 'settings', 'done'];

export function RoomAdminGuide({ open, onComplete, onDismiss }) {
    const [stage, setStage] = useState('intro');
    const [sub, setSub] = useState(0);            // 단계 안의 작은 걸음
    const [selected, setSelected] = useState(false);
    const [placed, setPlaced] = useState(false);
    const [filled4, setFilled4] = useState(false);
    const [ended, setEnded] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const bodyRef = useRef(null);
    const pressTimerRef = useRef(null);

    const go = (next) => { setStage(next); setSub(0); };

    useEffect(() => { bodyRef.current?.scrollTo?.({ top: 0 }); }, [stage, sub]);
    useEffect(() => () => clearTimeout(pressTimerRef.current), []);

    if (!open) return null;

    // ── 길게 누르기 연습 (실제와 같은 0.7초) ──
    const pressStart = () => {
        clearTimeout(pressTimerRef.current);
        pressTimerRef.current = setTimeout(() => { setEditOpen(true); setSub(1); }, 700);
    };
    const pressEnd = () => clearTimeout(pressTimerRef.current);

    // ── 코치 대사와 버튼 (단계 × 걸음) ──
    let coachText = '';
    let coachBtn = null;

    if (stage === 'intro') {
        coachText = '관리자님, 환영해요! 👑\n버튼이 많아 보여도 실제로 쓰는 건 몇 개 안 돼요.\n글 말고, 직접 눌러보면서 배워요. 딱 2분!';
        coachBtn = { label: '🎮 직접 해보기', onClick: () => go('card') };
    } else if (stage === 'card') {
        if (sub === 0) {
            coachText = '모든 건 이 카드 한 장에서 시작해요.\n네 부분만 알면 끝 — 위 번호를 봐주세요.';
            coachBtn = { label: '다 봤어요', onClick: () => setSub(1) };
        } else if (sub === 1) {
            coachText = '이제 카드를 한 번 눌러(탭해) 보세요 👇';
        } else {
            coachText = '라임색 테두리 = 선택됐다는 뜻!\n이렇게 고른 선수를 경기 빈칸에 넣는 거예요.';
            coachBtn = { label: '넣으러 가기', onClick: () => go('place') };
        }
    } else if (stage === 'place') {
        if (!placed) {
            coachText = '아래가 "경기 배정"이에요. 두 자리가 비어 있죠?\n선택된 김민수 선수를 빈칸에 넣어보세요 👇';
        } else if (!filled4) {
            coachText = '쏙! 들어갔어요 🙌\n한 자리 남았네요 — 연습이니까 제가 채울게요.';
            coachBtn = { label: '마지막 한 명 채우기', onClick: () => setFilled4(true) };
        } else {
            coachText = '4명이 다 차면 「경기 시작」에 불이 들어와요.\n눌러서 코트로 보내보세요 👇';
        }
    } else if (stage === 'court') {
        if (!ended) {
            coachText = '경기가 코트에 올라갔어요! 타이머가 돌아요.\n경기가 끝나면 「경기 종료」 — 눌러보세요 👇';
        } else {
            coachText = '4명 모두 경기 수가 +1 됐어요 (2G→3G 라임색!)\n잘못 눌렀다면 몇 초간 뜨는 「되돌리기」로 취소돼요.';
            coachBtn = { label: '다음', onClick: () => go('press') };
        }
    } else if (stage === 'press') {
        if (sub === 0) {
            coachText = '숨은 기능 하나!\n이번엔 카드를 꾹~ (1초간) 눌러보세요 👇';
        } else if (editOpen) {
            coachText = '경기 수를 손으로 고치는 창이에요.\n늦게 온 분 경기 수를 맞춰줄 때 써요. 저장을 눌러보세요.';
        } else {
            coachText = '이제 카드로 할 수 있는 건 다 배웠어요!\n탭 = 선택 · 꾹 = 경기 수 수정. 이게 전부예요.';
            coachBtn = { label: '설정 보러 가기', onClick: () => go('settings') };
        }
    } else if (stage === 'settings') {
        if (sub === 0) {
            coachText = '마지막! 설정이 어디 있는지 볼게요.\n방 화면 오른쪽 위 ⋮ 버튼 — 눌러보세요 👇';
        } else if (sub === 1) {
            coachText = '설정이 열렸어요. 맨 위가 📢 공지사항!\n"셔틀콕 각자 지참" 같은 걸 쓰면 모든 사람 화면 맨 위에 떠요. 새로 오는 사람은 입장할 때도 보고요.';
            coachBtn = { label: '다음', onClick: () => setSub(2) };
        } else if (sub === 2) {
            coachText = '코트 수는 실제로 빌린 코트 면 수와 꼭 맞추세요.\n경기 시간 알림은 넘기면 타이머가 빨갛게 깜빡여요 — "그만 내려오세요"를 대신 말해줘요.';
            coachBtn = { label: '다음', onClick: () => setSub(3) };
        } else if (sub === 3) {
            coachText = '민감도는 "경기중인 선수를 미리 예약할지"예요.\n뭔지 모르겠으면 보통 그대로 두세요 — 충분해요.';
            coachBtn = { label: '다음', onClick: () => setSub(4) };
        } else {
            coachText = '운영을 나눠요!\n👑 관리자 추가 = 명단에서 탭 한 번으로 임명.\n👻 운영만 하기 = 경기 안 뛰는 총무·코치용 (매칭에서 빠져요).';
            coachBtn = { label: '거의 다 왔어요!', onClick: () => go('done') };
        }
    } else if (stage === 'done') {
        coachText = '이제 진짜 화면에서 그대로 하시면 돼요!\n자동매칭 사용법은 바로 이어서 연습이 나와요.';
        coachBtn = { label: '확인했습니다 ✅', onClick: onComplete };
    }

    // ── 연습 화면 조각들 ──
    const scheduleRow = (
        <section className="space-y-2">
            <h2 className="text-xs font-black label text-dim ml-1">경기 배정 · Schedule</h2>
            <div className="bg-card rounded-2xl p-3 border border-white/[0.06] flex flex-col gap-2">
                <div className="flex justify-between items-center px-1">
                    <span className="bg-volt text-ink text-[11px] font-black px-2.5 py-1 rounded-md tracking-wide">MATCH 1</span>
                    <div className={filled4 ? 'amg2-fingerbox' : ''}>
                        {filled4 && <div className="amg2-finger" style={{ fontSize: 22, top: -32 }}>👇</div>}
                        <button
                            type="button"
                            disabled={!filled4}
                            onClick={filled4 ? () => go('court') : undefined}
                            className={`px-3.5 py-1.5 rounded-full text-xs font-black label transition-all ${filled4 ? 'bg-volt text-ink shadow-volt amg2-hi' : 'bg-white/5 text-muted'}`}
                        >
                            경기 시작
                        </button>
                    </div>
                </div>
                <div className="grid grid-cols-4 gap-2">
                    <DemoCard name="박지훈" level="B조" games={3} />
                    <DemoCard name="나상호" level="B조" games={3} />
                    {placed
                        ? <div className="auto-deal"><div className="grid"><DemoCard name="김민수" level="A조" games={2} /></div></div>
                        : <DemoSlot onClick={() => { setPlaced(true); setSelected(false); }} finger />}
                    {filled4
                        ? <div className="auto-deal"><div className="grid"><DemoCard name="이상민" level="C조" games={3} /></div></div>
                        : <DemoSlot />}
                </div>
            </div>
        </section>
    );

    return (
        <div className="amg-wrap">
            <div className="amg-sheet">

                <div className="amg-head">
                    <span className="amg-badge">👑 관리자 첫 안내</span>
                    <button className="amg-skip" onClick={onDismiss || onComplete}>나중에 할게요</button>
                </div>

                <div className="amg-body" ref={bodyRef}>

                    {stage === 'intro' && (
                        <>
                            <h3 className="amg-title cover" style={{ textAlign: 'center' }}>관리자가<br />되셨어요!</h3>
                            <div className="amg2-intro-emoji">👑</div>
                            <p className="amg-lead" style={{ textAlign: 'center' }}>
                                선수를 <b className="hl">고르고 · 넣고 · 시작하고 · 끝내는</b>
                                <br />한 판을 직접 돌려볼 거예요.
                            </p>
                            <div className="amg-box warn" style={{ textAlign: 'center' }}>
                                <b>끝까지(2분) 해야 이 안내가 사라져요.</b>
                                <br />중간에 닫으면 다음 접속 때 다시 떠요!
                            </div>
                        </>
                    )}

                    {stage === 'card' && (
                        <>
                            <div className="amg2-stage-label">🎮 연습 화면 — 실제 카드와 똑같아요</div>
                            {sub === 0 && <CardAnatomy />}
                            {sub >= 1 && (
                                <div className="flex justify-center my-6">
                                    <div className="amg2-fingerbox" style={{ width: 112 }}>
                                        {sub === 1 && <div className="amg2-finger">👇</div>}
                                        <div
                                            role="button"
                                            tabIndex={0}
                                            className={sub === 1 ? 'amg2-hi rounded-lg cursor-pointer' : ''}
                                            onClick={sub === 1 ? () => { setSelected(true); setSub(2); } : undefined}
                                            onKeyDown={sub === 1 ? (e) => { if (e.key === 'Enter') { setSelected(true); setSub(2); } } : undefined}
                                        >
                                            <DemoCard name="김민수" level="A조" games={2} selected={selected} />
                                        </div>
                                    </div>
                                </div>
                            )}
                            {sub === 2 && (
                                <p className="amg-lead" style={{ textAlign: 'center' }}>
                                    <b className="hl">라임색 테두리 = 선택됨</b>
                                    <br />한 번 더 누르면 선택이 풀려요.
                                </p>
                            )}
                        </>
                    )}

                    {stage === 'place' && (
                        <>
                            <div className="amg2-stage-label">🎮 연습 화면 — 실제 화면과 똑같아요</div>
                            {!placed && (
                                <div className="mb-3">
                                    <p className="text-[11px] font-black text-dim mb-1.5 ml-1">선택된 선수</p>
                                    <div style={{ width: 100 }}>
                                        <DemoCard name="김민수" level="A조" games={2} selected />
                                    </div>
                                </div>
                            )}
                            {scheduleRow}
                        </>
                    )}

                    {stage === 'court' && (
                        <>
                            <div className="amg2-stage-label">🎮 연습 화면 — "경기 진행" 탭이에요</div>
                            <div className={`rounded-2xl border overflow-hidden bg-card ${ended ? 'border-dashed border-white/10' : 'border-volt/40'}`}>
                                <div className={`px-4 py-3 flex justify-between items-center ${ended ? 'border-b border-white/[0.06]' : 'bg-volt'}`}>
                                    <span className={`font-black text-sm tracking-wide ${ended ? 'text-muted' : 'text-ink'}`}>COURT 1</span>
                                    {!ended ? (
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-black tabular px-2.5 py-1 rounded-md bg-ink/15 text-ink flex items-center gap-1.5">
                                                <span className="w-1.5 h-1.5 rounded-full bg-ink animate-pulse" />05:12
                                            </span>
                                            <div className="amg2-fingerbox">
                                                <div className="amg2-finger" style={{ fontSize: 22, top: -32 }}>👇</div>
                                                <button
                                                    type="button"
                                                    onClick={() => setEnded(true)}
                                                    className="bg-ink text-txt text-xs font-black px-3 py-1.5 rounded-full amg2-hi"
                                                >경기 종료</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <span className="text-xs text-muted font-bold label">대기 중</span>
                                    )}
                                </div>
                                <div className="p-3 grid grid-cols-4 gap-2">
                                    {!ended ? (
                                        <>
                                            <DemoCard name="박지훈" level="B조" games={3} playing />
                                            <DemoCard name="나상호" level="B조" games={3} playing />
                                            <DemoCard name="김민수" level="A조" games={2} playing />
                                            <DemoCard name="이상민" level="C조" games={3} playing />
                                        </>
                                    ) : (
                                        <div className="col-span-4 h-[52px] flex items-center justify-center text-muted gap-2">
                                            <span className="text-sm font-bold">경기가 없습니다</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {ended && (
                                <>
                                    <div className="glass w-full flex items-center gap-2.5 px-4 py-3 rounded-2xl border border-volt/30 mt-3 animate-fade-in-up">
                                        <span className="text-sm">↩️</span>
                                        <span className="text-sm font-bold text-txt flex-1">경기를 종료했습니다.</span>
                                        <span className="px-3 py-1.5 rounded-full bg-volt text-ink text-[11px] font-black">되돌리기</span>
                                    </div>
                                    <p className="text-[11px] font-black text-dim mt-4 mb-1.5 ml-1">대기 명단으로 돌아온 선수들 — 경기 수 +1!</p>
                                    <div className="grid grid-cols-4 gap-2">
                                        <DemoCard name="박지훈" level="B조" games={4} bump />
                                        <DemoCard name="나상호" level="B조" games={4} bump />
                                        <DemoCard name="김민수" level="A조" games={3} bump />
                                        <DemoCard name="이상민" level="C조" games={4} bump />
                                    </div>
                                </>
                            )}
                        </>
                    )}

                    {stage === 'press' && (
                        <>
                            <div className="amg2-stage-label">🎮 연습 화면 — 꾹 누르기</div>
                            {!editOpen ? (
                                <div className="flex justify-center my-8">
                                    <div className="amg2-fingerbox" style={{ width: 112 }}>
                                        {sub === 0 && <div className="amg2-finger">👇</div>}
                                        <div
                                            role="button"
                                            tabIndex={0}
                                            className={sub === 0 ? 'amg2-hi rounded-lg cursor-pointer' : ''}
                                            onMouseDown={sub === 0 ? pressStart : undefined}
                                            onMouseUp={pressEnd}
                                            onMouseLeave={pressEnd}
                                            onTouchStart={sub === 0 ? pressStart : undefined}
                                            onTouchEnd={pressEnd}
                                            onTouchCancel={pressEnd}
                                        >
                                            <DemoCard name="오세훈" level="C조" games={4} />
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                /* 실제 '경기 수 수정' 창과 같은 모양의 미니 시트 */
                                <div className="bg-surface rounded-[24px] border border-white/[0.08] p-5 my-4 animate-fade-in-up shadow-deep">
                                    <h3 className="text-base font-black text-txt kern-tight mb-1">경기 수 수정</h3>
                                    <p className="text-[11px] text-muted font-bold mb-4">오세훈 · 오늘 친 경기 수를 고칩니다</p>
                                    <div className="flex items-center justify-center gap-4 mb-4">
                                        <span className="w-9 h-9 rounded-full bg-card2 border border-white/10 text-txt font-black flex items-center justify-center">−</span>
                                        <span className="text-2xl font-black tabular text-txt">4</span>
                                        <span className="w-9 h-9 rounded-full bg-volt text-ink font-black flex items-center justify-center">+</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => { setEditOpen(false); setSub(2); }}
                                        className="w-full py-3 bg-volt text-ink font-black rounded-full text-sm amg2-hi"
                                    >저장</button>
                                </div>
                            )}
                            {sub === 2 && (
                                <p className="amg-lead" style={{ textAlign: 'center' }}>
                                    늦게 합류한 분의 경기 수를 맞춰주면
                                    <br /><b className="hl">자동매칭이 더 공평</b>해져요.
                                </p>
                            )}
                        </>
                    )}

                    {stage === 'settings' && (
                        <>
                            <div className="amg2-stage-label">🎮 연습 화면 — 실제 화면과 똑같아요</div>

                            {sub === 0 ? (
                                /* 방 헤더 복제 — ⋮ 위치를 몸으로 기억하게 */
                                <div className="rounded-2xl overflow-hidden border border-white/[0.08] mt-2">
                                    <div className="h-16 px-3 flex items-center justify-between bg-surface border-b border-white/[0.06]">
                                        <div className="flex items-center gap-2">
                                            <span className="text-dim">←</span>
                                            <div>
                                                <p className="text-base font-black text-txt leading-tight kern-tight">우리동네 배드민턴</p>
                                                <p className="text-[11px] text-dim font-bold mt-0.5">콕스타 체육관 · 12/20 · <span className="text-volt font-black">ADMIN</span></p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <span className="w-9 h-9 flex items-center justify-center text-dim amg2-dim">⤴</span>
                                            <span className="h-9 px-3.5 rounded-full text-xs font-black bg-volt text-ink flex items-center amg2-dim">휴식</span>
                                            <div className="amg2-fingerbox">
                                                <div className="amg2-finger" style={{ fontSize: 24, top: -32 }}>👇</div>
                                                <button
                                                    type="button"
                                                    onClick={() => setSub(1)}
                                                    aria-label="설정 열기"
                                                    className="w-9 h-9 flex items-center justify-center rounded-full text-txt bg-white/10 amg2-hi text-lg font-black"
                                                >⋮</button>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="h-24 bg-ink court-lines" />
                                </div>
                            ) : (
                                /* 설정 시트 복제 — 지금 배우는 항목만 밝게 */
                                <div className="bg-surface rounded-[24px] border border-white/[0.08] p-5 space-y-4 shadow-deep">
                                    <h3 className="text-lg font-black text-txt kern-tight">환경 설정</h3>

                                    <div className={sub === 1 ? 'amg2-hi rounded-xl' : 'amg2-dim'}>
                                        <span className="text-[11px] font-black label text-dim mb-1.5 block px-1 pt-1">공지사항</span>
                                        <div className="py-3 bg-volt/10 text-volt font-black rounded-xl text-sm text-center mx-1 mb-1">📢 공지 등록하기</div>
                                    </div>

                                    <div className={sub === 2 ? 'amg2-hi rounded-xl p-1' : 'amg2-dim p-1'}>
                                        <div className="grid grid-cols-2 gap-3 mb-2">
                                            {['경기 예정 수 4', '코트 수 2'].map(t => (
                                                <div key={t} className="text-center">
                                                    <p className="text-[11px] font-black label text-dim mb-1">{t.split(' ').slice(0, -1).join(' ')}</p>
                                                    <p className="text-xl font-black text-txt tabular">− {t.split(' ').pop()} +</p>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="flex gap-1.5">
                                            {['끄기', '15분', '20분'].map((m, i) => (
                                                <span key={m} className={`flex-1 py-1.5 rounded-lg text-xs font-black text-center ${i === 2 ? 'bg-volt text-ink' : 'bg-white/5 text-dim'}`}>{m}</span>
                                            ))}
                                        </div>
                                    </div>

                                    <div className={sub === 3 ? 'amg2-hi rounded-xl p-1' : 'amg2-dim p-1'}>
                                        <span className="text-[11px] font-black label text-dim mb-1.5 block">🤖 자동 매칭 민감도</span>
                                        <div className="grid grid-cols-4 gap-1.5">
                                            {['낮음', '보통', '높음', '최고'].map((m, i) => (
                                                <span key={m} className={`py-1.5 rounded-lg text-xs font-black text-center ${i === 1 ? 'bg-volt text-ink' : 'bg-white/5 text-dim'}`}>{m}</span>
                                            ))}
                                        </div>
                                    </div>

                                    <div className={sub === 4 ? 'amg2-hi rounded-xl p-1' : 'amg2-dim p-1'}>
                                        <div className="py-2.5 bg-volt/10 text-volt font-black rounded-xl text-sm text-center mb-2">👑 관리자 추가 · 관리</div>
                                        <div className="py-2.5 bg-white/5 text-dim font-black rounded-xl text-sm text-center">👻 운영만 하기 (선수 명단에서 빠짐)</div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {stage === 'done' && (
                        <>
                            <div className="amg2-party">🎉</div>
                            <h3 className="amg-title" style={{ textAlign: 'center' }}>이게 전부예요!</h3>
                            <div className="amg-flow">
                                <div><span>1</span> 카드 <b>탭</b> = 선택 → 빈칸에 넣기</div>
                                <div><span>2</span> 4명 차면 <b>경기 시작</b> → 끝나면 <b>경기 종료</b></div>
                                <div><span>3</span> 카드 <b>꾹(1초)</b> = 경기 수 수정</div>
                                <div><span>4</span> 오른쪽 위 <b>⋮</b> = 공지·코트 수·관리자</div>
                            </div>
                            <div className="amg-box tip" style={{ marginTop: 12 }}>
                                다시 보고 싶으면: 설정 ▸ <b>📖 관리자 안내 다시 보기</b>
                                <br />🤖 자동매칭은 버튼만 누르면 후보를 골라줘요 — 바로 이어서 연습!
                            </div>
                        </>
                    )}
                </div>

                {/* ── 코치 말풍선 + 진행 점 ── */}
                <div className="amg2-coach">
                    <div className="amg2-coach-row">
                        <span className="amg2-coach-emoji">🤖</span>
                        <p className="amg2-coach-text">{coachText}</p>
                    </div>
                    {coachBtn && (
                        <button type="button" className="amg2-coach-btn" onClick={coachBtn.onClick}>
                            {coachBtn.label}
                        </button>
                    )}
                    <div className="amg2-dots">
                        {STAGE_ORDER.map(s => (
                            <span key={s} className={`amg2-dot ${s === stage ? 'on' : ''}`} />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
