import React, { useEffect, useRef, useState } from 'react';
import { getLevelHex } from '../../lib/matchQueues';

// ===================================================================================
// [자동매칭] 관리자 게임형 안내 — 글로 읽지 않고 직접 눌러보며 배운다
// -----------------------------------------------------------------------------------
// 설명서를 아무도 안 읽는다는 걸 전제로 만든 온보딩이다.
// 실제 화면과 똑같이 생긴 '연습 화면'에 가상 선수를 세워두고, 코치(🤖)가 한 칸씩
// 짚어주는 동안 관리자가 진짜처럼 버튼을 눌러본다. 전체 1분.
//
//   ① 👨 남자 매칭을 직접 누른다
//   ② 후보 6개 화면을 5단계로 배운다 (코치 말풍선)
//   ③ 베스트 카드를 직접 골라본다
//   ④ 경기가 끝나 '경기 시작'이 켜지는 걸 직접 본다
//
// ★ 첫 번째 베스트 카드에 '경기중' 선수를 일부러 넣어뒀다.
//   그 카드를 고르면 ④에서 버튼이 「대기」로 잠긴 모습을 보게 되고, 코트를 끝내면
//   색이 돌아오며 버튼이 켜진다. 글로 설명할 내용을 체험으로 바꾼 것이다.
//
// [무조건 보게 만드는 방법 — 일반 튜토리얼과 정반대로 설계했다]
//   끝까지 하고 '확인했습니다'를 눌러야만 '봤음' 기록이 남는다.
//   중간에 닫으면 기록이 안 남아서 다음 접속 때 다시 뜬다.
//   (스킵해도 기록하는 보통 튜토리얼과 반대 — 의도된 비대칭이다)
//
// [전원에게 다시 띄우는 법]
//   guideKeys.js의 AUTOMATCH_GUIDE_KEY 버전을 올린다 ('...-v1' → '...-v2').
//   저장된 데이터를 지우는 방식은 로컬 기록 때문에 안 뜨는 기기가 생긴다.
// ===================================================================================

// ───────────────────────────────────────────────────────────────────────────────────
// 가상 선수들 (연습 화면 전용 — 실제 데이터와 무관)
// ───────────────────────────────────────────────────────────────────────────────────

const WAITING_DEMO = [
    { name: '김민수', level: 'A조', games: 2 },
    { name: '박지훈', level: 'B조', games: 3 },
    { name: '나상호', level: 'B조', games: 3 },
    { name: '신환종', level: 'C조', games: 3 },
    { name: '이상민', level: 'C조', games: 3 },
    { name: '최유진', level: 'D조', games: 2 },
    { name: '오세훈', level: 'C조', games: 4 },
    { name: '강태오', level: 'D조', games: 4 },
];

// 후보 6개 (베스트 2 · 보통 2 · 아쉬움 2)
const OPTIONS_DEMO = [
    {
        tier: 'best', emoji: '🏆', label: '베스트', waitChip: '3번 코트 대기',
        team: [
            { name: '정형진', level: 'B조', games: 3, playing: true },
            { name: '나상호', level: 'B조', games: 3 },
            { name: '신환종', level: 'C조', games: 3 },
            { name: '이상민', level: 'C조', games: 3 },
        ],
        reasons: [
            { tone: 'good', text: '4명 모두 오늘 처음 만나는 조합!' },
            { tone: 'good', text: '4명 모두 3경기로 딱 같아요' },
            { tone: 'wait', text: '3번 코트 끝나야 시작 (곧 끝나요) — 경기중: 정형진' },
        ],
    },
    {
        tier: 'best', emoji: '🏆', label: '베스트',
        team: [
            { name: '김민수', level: 'A조', games: 2 },
            { name: '나상호', level: 'B조', games: 3 },
            { name: '박지훈', level: 'B조', games: 3 },
            { name: '이상민', level: 'C조', games: 3 },
        ],
        reasons: [
            { tone: 'good', text: '만난 적 있는 짝: 박지훈·이상민 (나머지 5쌍은 처음!)' },
            { tone: 'good', text: '오래 기다린 선수: 김민수 (20분째)' },
            { tone: 'good', text: '가장 적게 친 선수 포함: 김민수 (2경기)' },
        ],
    },
    {
        tier: 'normal', emoji: '👍', label: '보통',
        team: [
            { name: '박지훈', level: 'B조', games: 3 },
            { name: '오세훈', level: 'C조', games: 4 },
            { name: '신환종', level: 'C조', games: 3 },
            { name: '강태오', level: 'D조', games: 4 },
        ],
        reasons: [
            { tone: 'mid', text: '겹치는 짝: 신환종·오세훈, 박지훈·강태오 (나머지 4쌍은 처음)' },
            { tone: 'mid', text: '급수는 그럭저럭 맞아요' },
            { tone: 'mid', text: '경기 수 3~4경기로 비슷' },
        ],
    },
    {
        tier: 'normal', emoji: '👍', label: '보통',
        team: [
            { name: '김민수', level: 'A조', games: 2 },
            { name: '나상호', level: 'B조', games: 3 },
            { name: '오세훈', level: 'C조', games: 4 },
            { name: '이상민', level: 'C조', games: 3 },
        ],
        reasons: [
            { tone: 'mid', text: '겹치는 짝: 나상호·이상민, 오세훈·이상민 (나머지 4쌍은 처음)' },
            { tone: 'good', text: '가장 적게 친 선수 포함: 김민수 (2경기)' },
            { tone: 'mid', text: '급수는 그럭저럭 맞아요' },
        ],
    },
    {
        tier: 'bad', emoji: '⚠️', label: '아쉬움',
        team: [
            { name: '오세훈', level: 'C조', games: 4 },
            { name: '강태오', level: 'D조', games: 4 },
            { name: '박지훈', level: 'B조', games: 3 },
            { name: '최유진', level: 'D조', games: 2 },
        ],
        reasons: [
            { tone: 'bad', text: '방금 경기에서 만난 짝: 오세훈·강태오' },
            { tone: 'mid', text: '급수는 그럭저럭 맞아요' },
            { tone: 'mid', text: '경기 수 2~4경기로 비슷' },
        ],
    },
    {
        tier: 'bad', emoji: '⚠️', label: '아쉬움',
        team: [
            { name: '김민수', level: 'A조', games: 2 },
            { name: '신환종', level: 'C조', games: 3 },
            { name: '나상호', level: 'B조', games: 3 },
            { name: '강태오', level: 'D조', games: 4 },
        ],
        reasons: [
            { tone: 'bad', text: '방금 경기에서 만난 짝: 나상호·강태오' },
            { tone: 'bad', text: '급수 차이가 커요 (최고↔최저 3급수)' },
            { tone: 'mid', text: '경기 수 2~4경기로 비슷' },
        ],
    },
];

// ───────────────────────────────────────────────────────────────────────────────────
// 예시용 부품 — 실제 화면과 '같은 모양'이어야 근육 기억이 옮겨간다.
// 선택지 카드(mo-*)는 진짜 모달과 CSS를 그대로 공유하고,
// 선수 카드는 App.jsx의 PlayerCard와 똑같은 Tailwind 조합으로 맞췄다.
// (복제하면 실제 화면과 어긋나고 유지보수가 두 배가 되므로, 바꿀 땐 양쪽을 같이 볼 것)
// ───────────────────────────────────────────────────────────────────────────────────

/** 실제 선수 카드와 같은 모양의 예시 카드 */
function DemoPlayerCard({ name, level, games, gender = '남', playing = false }) {
    return (
        <div className={`relative bg-card2 rounded-lg px-2 py-1 h-[52px] flex flex-col justify-center border border-white/[0.06] border-l-[3px] transition-all duration-300 ${gender === '남' ? 'border-l-blue-500' : 'border-l-pink-500'} ${playing ? 'opacity-45 grayscale' : ''}`}>
            <span className="text-xs font-black text-txt truncate leading-none mb-1">{name}</span>
            <div className="flex justify-between items-center">
                <span className="text-[10px] font-black" style={{ color: getLevelHex(level) }}>{level}</span>
                <span className="text-[10px] text-muted font-black tabular">{games}G</span>
            </div>
            {playing && <span className="amg-playing-tag">경기중</span>}
        </div>
    );
}

/** 선택지 카드 안의 작은 선수 칩 (진짜 모달의 .mo-chip과 동일) */
function DemoChip({ name, level, games, playing, hi }) {
    return (
        <div className={`mo-chip ${playing ? 'playing' : ''} ${hi ? 'amg2-hi' : ''}`}>
            <div className="mo-chip-name">{name}</div>
            <div className="mo-chip-sub">
                <span style={{ color: playing ? '#9aa0aa' : getLevelHex(level) }}>{level.replace('조', '')}</span>
                <span className="mo-chip-games">{games}G</span>
            </div>
            {playing && <span className="mo-chip-tag">경기중</span>}
        </div>
    );
}

/** 실제 선택지 카드와 같은 모양의 예시 (배울 부분만 밝게 비출 수 있다) */
function DemoOptionCard({ opt, dim, hi, hiReasons, hiChipName, clickable, onPick }) {
    return (
        <div className={`${dim ? 'amg2-dim' : ''} ${hi || clickable ? 'amg2-hi' : ''} ${clickable ? 'amg2-fingerbox' : ''}`}>
            {clickable && <div className="amg2-finger">👇</div>}
            <button
                type="button"
                className={`mo-card ${opt.tier}`}
                style={{ cursor: clickable ? 'pointer' : 'default', width: '100%' }}
                onClick={clickable ? onPick : undefined}
            >
                <div className="mo-card-head">
                    <span className="mo-tier">{opt.emoji} {opt.label}</span>
                    {opt.waitChip && <span className="mo-wait-chip">⏳ {opt.waitChip}</span>}
                </div>
                <div className="mo-teams">
                    <div className="mo-team">
                        {opt.team.slice(0, 2).map(p => <DemoChip key={p.name} {...p} hi={hiChipName === p.name} />)}
                    </div>
                    <div className="mo-vs">VS</div>
                    <div className="mo-team">
                        {opt.team.slice(2, 4).map(p => <DemoChip key={p.name} {...p} hi={hiChipName === p.name} />)}
                    </div>
                </div>
                <ul className={`mo-reasons ${hiReasons ? 'amg2-hi' : ''}`} style={hiReasons ? { padding: '6px 8px' } : undefined}>
                    {opt.reasons.map((r, i) => <li key={i} className={`tone-${r.tone}`}>{r.text}</li>)}
                </ul>
            </button>
        </div>
    );
}

// ───────────────────────────────────────────────────────────────────────────────────
// 본체
// ───────────────────────────────────────────────────────────────────────────────────

const STAGE_ORDER = ['intro', 'press', 'options', 'queue', 'done'];

// options 단계에서 코치가 한 칸씩 짚어주는 순서
const OPTION_STEPS = [
    { focus: 0, text: '후보 6개가 나왔어요!\n🏆 금색으로 빛나는 카드가 베스트 — 지금 만들 수 있는 제일 좋은 조합이에요.' },
    { focus: 3, text: '👍 초록 = 보통 · ⚠️ 노랑 = 아쉬움.\n색만 봐도 좋은 순서를 알 수 있어요.' },
    { focus: 0, text: '카드 아래엔 이유가 적혀 있어요.\n초록 줄 = 좋은 점 · 빨간 줄 = 아쉬운 점.' },
    { focus: 0, text: '회색 「경기중」 = 지금 코트에서 뛰는 선수.\n같이 뽑아도 돼요 — 그 경기가 끝나면 자동으로 풀려요.' },
    { focus: 0, text: '마음에 드는 카드를 누르면 그게 다음 경기!\n베스트 카드를 눌러보세요 👇' },
];

function AutoMatchGuide({ userName, onComplete, onDismiss }) {
    const [stage, setStage] = useState('intro');
    const [optStep, setOptStep] = useState(0);
    const [courtDone, setCourtDone] = useState(false); // queue 단계: 3번 코트가 끝났는가
    const bodyRef = useRef(null);
    const cardRefs = useRef([]);

    // 단계가 바뀌면 화면을 맨 위로, options 단계에서는 지금 배우는 카드가 보이게 스크롤
    useEffect(() => {
        if (stage !== 'options') {
            bodyRef.current?.scrollTo?.({ top: 0 });
            return;
        }
        const idx = OPTION_STEPS[optStep]?.focus ?? 0;
        const t = setTimeout(() => {
            cardRefs.current[idx]?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }, 150);
        return () => clearTimeout(t);
    }, [stage, optStep]);

    // ── 코치 말풍선 내용 (단계별) ──
    let coachText = '';
    let coachBtn = null;   // { label, onClick }
    if (stage === 'intro') {
        coachText = `${userName ? `${userName} 관리자님! ` : '관리자님! '}이 방에 자동매칭이 생겼어요.\n글 대신 직접 눌러보면서 배워요. 딱 1분!`;
        coachBtn = { label: '🎮 직접 해보기', onClick: () => setStage('press') };
    } else if (stage === 'press') {
        coachText = '여기는 연습 화면이에요. 가상 선수들이 준비됐어요.\n👨 남자 매칭 버튼을 눌러보세요!';
    } else if (stage === 'options') {
        coachText = OPTION_STEPS[optStep].text;
        if (optStep < OPTION_STEPS.length - 1) {
            coachBtn = { label: '다음', onClick: () => setOptStep(s => s + 1) };
        }
    } else if (stage === 'queue') {
        if (!courtDone) {
            coachText = '골랐어요! 자동 매칭 목록에 들어갔어요 🙌\n정형진 선수가 아직 경기중이라 버튼이 「대기」로 잠겨 있죠?';
            coachBtn = { label: '▶ 3번 코트 경기 끝내보기', onClick: () => setCourtDone(true) };
        } else {
            coachText = '경기가 끝나자 색이 돌아오고 버튼이 켜졌어요!\n「경기 시작」을 눌러 코트로 보내보세요 👇';
        }
    } else if (stage === 'done') {
        coachText = '이제 진짜 화면에서 그대로 하시면 돼요!';
        coachBtn = { label: '확인했습니다 ✅', onClick: onComplete };
    }

    const isPicking = stage === 'options' && optStep === OPTION_STEPS.length - 1;

    return (
        <div className="amg-wrap">
            <div className="amg-sheet">

                {/* ── 머리말 ── */}
                <div className="amg-head">
                    <span className="amg-badge">🚨 관리자 필독</span>
                    <button className="amg-skip" onClick={onDismiss}>나중에 할게요</button>
                </div>

                {/* ── 본문 (단계별 연습 화면) ── */}
                <div className="amg-body" ref={bodyRef}>

                    {stage === 'intro' && (
                        <>
                            <h3 className="amg-title cover" style={{ textAlign: 'center' }}>자동매칭이<br />생겼어요!</h3>
                            <div className="amg2-intro-emoji">🎮</div>
                            <p className="amg-lead" style={{ textAlign: 'center' }}>
                                버튼을 누르면 <b className="hl">후보 6개 중에서 골라요.</b>
                                <br />경기중인 선수도 후보에 들어가요.
                            </p>
                            <div className="amg-box warn" style={{ textAlign: 'center' }}>
                                <b>끝까지(1분) 해야 이 안내가 사라져요.</b>
                                <br />중간에 닫으면 다음 접속 때 다시 떠요!
                            </div>
                        </>
                    )}

                    {stage === 'press' && (
                        <>
                            <div className="amg2-stage-label">🎮 연습 화면 — 실제 화면과 똑같아요</div>
                            <div className="amg2-court-chip">
                                <span>🏸</span>
                                <span>3번 코트 경기중: 정형진 · 박준호 vs 김도윤 · 이서준</span>
                            </div>

                            {/* 실제 자동 매칭 섹션과 같은 버튼 3개 — 남자 버튼만 살아 있다 */}
                            <div className="auto-make-row" style={{ marginBottom: 10 }}>
                                <div className="amg2-fingerbox">
                                    <div className="amg2-finger">👇</div>
                                    <button
                                        type="button"
                                        className="auto-make-btn male amg2-hi"
                                        style={{ width: '100%' }}
                                        onClick={() => setStage('options')}
                                    >👨 남자 매칭</button>
                                </div>
                                <button type="button" className="auto-make-btn female amg2-dim">👩 여자 매칭</button>
                                <button type="button" className="auto-make-btn mixed amg2-dim">💑 혼복 매칭</button>
                            </div>

                            {/* 가상 대기 명단 */}
                            <section className="bg-card rounded-2xl p-3 border border-white/[0.06]">
                                <div className="flex justify-between items-center mb-3 border-b border-white/[0.06] pb-2">
                                    <h2 className="text-xs font-black label text-txt">대기 명단</h2>
                                    <span className="bg-volt text-ink text-xs font-black px-2.5 py-0.5 rounded-full tabular">{WAITING_DEMO.length}</span>
                                </div>
                                <div className="grid grid-cols-4 gap-2">
                                    {WAITING_DEMO.map(p => <DemoPlayerCard key={p.name} {...p} />)}
                                </div>
                            </section>
                        </>
                    )}

                    {stage === 'options' && (
                        <>
                            <div className="amg2-stage-label">🎮 연습 화면 — 실제 화면과 똑같아요</div>
                            <h3 className="mo-title" style={{ marginBottom: 2 }}>남자 매칭 고르기</h3>
                            <p className="mo-sub" style={{ marginBottom: 10 }}>후보 12명 · 대기 8명 · 경기중 4명</p>

                            <div className="flex flex-col gap-2">
                                {OPTIONS_DEMO.map((opt, idx) => {
                                    // 지금 배우는 칸만 밝게, 나머지는 흐리게 + 클릭 차단(정해진 길만 가게)
                                    let dim = false, hi = false, hiReasons = false, hiChipName = null;
                                    if (optStep === 0) { hi = idx === 0; dim = idx !== 0; }
                                    else if (optStep === 1) { hi = idx === 2 || idx === 4; dim = !(idx === 2 || idx === 4); }
                                    else if (optStep === 2) { hiReasons = idx === 0; dim = idx !== 0; }
                                    else if (optStep === 3) { hiChipName = idx === 0 ? '정형진' : null; dim = idx !== 0; }
                                    else if (optStep === 4) { dim = idx !== 0; }
                                    return (
                                        <div key={idx} ref={el => { cardRefs.current[idx] = el; }}>
                                            <DemoOptionCard
                                                opt={opt}
                                                dim={dim}
                                                hi={hi}
                                                hiReasons={hiReasons}
                                                hiChipName={hiChipName}
                                                clickable={isPicking && idx === 0}
                                                onPick={() => { setCourtDone(false); setStage('queue'); }}
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}

                    {stage === 'queue' && (
                        <>
                            <div className="amg2-stage-label">🎮 연습 화면 — 실제 화면과 똑같아요</div>
                            <div className="flex items-center gap-2 mb-3">
                                <h2 className="text-xs font-black label text-volt">🤖 자동 매칭</h2>
                            </div>

                            {/* 방금 고른 경기가 목록에 들어간 모습 */}
                            <div className="auto-row">
                                {!courtDone && (
                                    <div className="auto-wait-note">
                                        <span>⏳</span>
                                        <span className="truncate">3번 코트가 끝나면 시작 — 경기중: 정형진</span>
                                    </div>
                                )}
                                <div className="flex items-center w-full gap-1.5">
                                    <div className="flex-shrink-0 w-7 text-center">
                                        <p className="font-black text-lg text-txt tabular">1</p>
                                    </div>
                                    <div className="grid grid-cols-4 gap-1.5 flex-1 min-w-0">
                                        <DemoPlayerCard name="정형진" level="B조" games={3} playing={!courtDone} />
                                        <DemoPlayerCard name="나상호" level="B조" games={3} />
                                        <DemoPlayerCard name="신환종" level="C조" games={3} />
                                        <DemoPlayerCard name="이상민" level="C조" games={3} />
                                    </div>
                                    <div className="flex-shrink-0 w-16 text-center">
                                        {courtDone ? (
                                            <div className="amg2-fingerbox">
                                                <div className="amg2-finger" style={{ fontSize: 22, top: -28 }}>👇</div>
                                                <button
                                                    type="button"
                                                    className="auto-start-btn go amg2-hi"
                                                    onClick={() => setStage('done')}
                                                >경기 시작</button>
                                            </div>
                                        ) : (
                                            <button type="button" className="auto-start-btn wait" disabled>대기</button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    {stage === 'done' && (
                        <>
                            <div className="amg2-party">🎉</div>
                            <h3 className="amg-title" style={{ textAlign: 'center' }}>완벽해요! 이게 전부예요</h3>
                            <div className="amg-flow">
                                <div><span>1</span> 👨👩💑 매칭 버튼 누르기</div>
                                <div><span>2</span> 마음에 드는 카드 <b>골라서 탭</b></div>
                                <div><span>3</span> <b>경기 시작</b>으로 코트에 보내기</div>
                                <div><span>4</span> 경기 끝나면 <b>경기 종료</b></div>
                            </div>
                            <div className="amg-box tip" style={{ marginTop: 12 }}>
                                <b>🔀 다른 조합</b> = 후보 6개 새로 보기 ·
                                <b> 경기 번호 꾹</b> = 삭제
                                <br />다시 보기: 방 설정 ▸ <b>🤖 자동매칭 안내 다시 보기</b>
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

export { AutoMatchGuide };
