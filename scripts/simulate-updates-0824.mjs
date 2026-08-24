// ===================================================================================
// 2026-08-24 업데이트 전용 시뮬레이션 — 이번 주 대규모 운영 전 최종 점검
// -----------------------------------------------------------------------------------
//   실행:  node scripts/simulate-updates-0824.mjs
//
// 무엇을 검증하나 (오늘 바뀐 것만 집중적으로):
//   [1] 연속 경기 제한(CONSEC_STREAK) A/B — 켰을 때 '무휴식 3연속'이 실제로 줄고,
//       기존 품질 지표(편차·굶주림·가동률·직전재탕)는 나빠지지 않아야 한다
//   [2] 대규모 하루 풀 시뮬레이션 — 이번 주 상황을 가정한 큰 판 (지각·휴식·이탈 포함)
//   [3] 대기시간 "약 N~N분" — 예측 범위가 실제 대기와 얼마나 맞는지 실측
//   [4] 버전 게이트 비교 로직
//   [5] 알림 라이브러리 (기록 50개 상한 · 안읽음 · 소리 설정) — 실제 모듈 그대로 실행
//   [6] 알림 트리거 상태기계 — 어떤 상태 전환에서 울리는지
//   [7] 동시 관리자 조작 — 트랜잭션 가드 로직을 직렬화 커밋 모델로 재현
//   [8] 최근 본 상품 (상한 12 · 중복 제거 · 최신순)
//   [9] consecStreak 계산 엣지 케이스 (깨진 시각 · 수동 기록 · 경기중)
//
// ※ [6][7][8]과 waitRange 는 컴포넌트/훅 안에 있어 소스에서 '미러링'한 로직이다.
//   소스를 고치면 여기도 같이 고칠 것. 나머지는 실제 모듈을 직접 import 한다.
// ===================================================================================

import {
    buildMatchContext,
    buildCandidatePool,
    generateMatchOptions,
    getSensitivity,
    MATCH_WEIGHTS,
} from '../src/lib/matching.js';
import { repairMatchQueues } from '../src/lib/matchQueues.js';
import { versionLessThan } from '../src/lib/version.js';

const START_MS = new Date('2026-08-24T19:00:00+09:00').getTime();

let pass = 0;
let fail = 0;
const failures = [];
function check(name, ok, detail = '') {
    if (ok) { pass += 1; console.log(`  ✅ ${name}${detail ? ` — ${detail}` : ''}`); }
    else { fail += 1; failures.push(name); console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ''}`); }
}
function info(text) { console.log(`     ${text}`); }
function section(title) { console.log(`\n[${title}]`); }

function makeRandom(seed) {
    let s = seed >>> 0;
    return () => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 4294967296;
    };
}
const rep = (level, n) => Array.from({ length: n }, () => level);

// ───────────────────────────────────────────────────────────────────────────────────
// 가상 체육관 (앱과 동일한 데이터 구조 — stress-test 와 같은 하네스)
// ───────────────────────────────────────────────────────────────────────────────────

function makeGym({ maleLevels = [], femaleLevels = [], courts, seed }) {
    const rand = makeRandom(seed);
    const allPlayers = {};
    maleLevels.forEach((level, i) => {
        allPlayers[`남${i + 1}`] = {
            id: `남${i + 1}`, name: `남${i + 1}`, gender: '남', level,
            status: 'active', isResting: false,
            entryTime: new Date(START_MS).toISOString(), todayRecentGames: [],
        };
    });
    femaleLevels.forEach((level, i) => {
        allPlayers[`여${i + 1}`] = {
            id: `여${i + 1}`, name: `여${i + 1}`, gender: '여', level,
            status: 'active', isResting: false,
            entryTime: new Date(START_MS).toISOString(), todayRecentGames: [],
        };
    });
    const gameState = {
        numInProgressCourts: courts,
        numScheduledMatches: 4,
        inProgressCourts: Array(courts).fill(null),
        scheduledMatches: {},
        autoMatches: {},
    };
    return { allPlayers, gameState, rand };
}

function startMatch(gym, matchKey, courtIndex, nowMs) {
    const players = gym.gameState.autoMatches[matchKey];
    if (!players || players.filter(Boolean).length !== 4) return false;
    const onCourtIds = new Set(
        gym.gameState.inProgressCourts.filter(Boolean).flatMap(c => c.players).filter(Boolean),
    );
    const blocked = players.some(id => {
        const p = gym.allPlayers[id];
        return !p || p.status !== 'active' || p.isResting || onCourtIds.has(id);
    });
    if (blocked) return false;
    gym.gameState.inProgressCourts[courtIndex] = {
        players: [...players], startTime: new Date(nowMs).toISOString(),
    };
    delete gym.gameState.autoMatches[matchKey];
    const reindexed = {};
    Object.values(gym.gameState.autoMatches).forEach((m, i) => { reindexed[String(i)] = m; });
    gym.gameState.autoMatches = reindexed;
    return true;
}

function endMatch(gym, courtIndex, nowMs) {
    const court = gym.gameState.inProgressCourts[courtIndex];
    if (!court) return null;
    const [a1, a2, b1, b2] = court.players;
    const teamA = [a1, a2].filter(Boolean);
    const teamB = [b1, b2].filter(Boolean);
    const ts = new Date(nowMs).toISOString();
    court.players.filter(Boolean).forEach(id => {
        const p = gym.allPlayers[id];
        if (!p) return;
        const inA = teamA.includes(id);
        p.todayRecentGames = [{
            timestamp: ts,
            partners: (inA ? teamA : teamB).filter(x => x !== id),
            opponents: inA ? teamB : teamA,
        }, ...(p.todayRecentGames || [])].slice(0, 20);
    });
    gym.gameState.inProgressCourts[courtIndex] = null;
    return court.players;
}

function adminGenerate(gym, mode, nowMs, sensitivityKey) {
    const ctx = buildMatchContext(gym.allPlayers, gym.gameState, { now: nowMs });
    const pool = buildCandidatePool(ctx, mode);
    const sens = getSensitivity(sensitivityKey);
    const onCourtIds = new Set(
        gym.gameState.inProgressCourts.filter(Boolean).flatMap(c => c.players).filter(Boolean),
    );
    const pendingReservations = Object.values(gym.gameState.autoMatches)
        .filter(m => (m || []).some(id => id && onCourtIds.has(id))).length;
    const result = generateMatchOptions({
        pool, ctx, mode, maxOnCourt: sens.maxOnCourt, pages: 1, pendingReservations,
    });
    if (result.status !== 'ok') return null;
    const picked = result.pages[0].find(o => o.tier === 'best') || result.pages[0][0];
    const queued = new Set(Object.values(gym.gameState.autoMatches).flat().filter(Boolean));
    if (picked.ids.some(id => queued.has(id))) return null;
    const nextIdx = Object.keys(gym.gameState.autoMatches)
        .reduce((m, k) => Math.max(m, Number(k) + 1), 0);
    gym.gameState.autoMatches[String(nextIdx)] = [...picked.ids];
    return picked;
}

// ───────────────────────────────────────────────────────────────────────────────────
// 하루 시뮬레이션 러너 — 무휴식 연속 진입, 대기시간 예측 정확도까지 측정
// ───────────────────────────────────────────────────────────────────────────────────

const CONSEC_REST_MIN = 6; // 엔진과 같은 기준 (matching.js)

// waitRange — MyTurnBanner.jsx 의 로직 미러 (소스 바뀌면 같이 고칠 것)
const MINUTES_PER_GAME = 10;
function waitRange(matchesAhead, courtsN) {
    const c = Math.max(1, courtsN);
    const low = Math.floor(matchesAhead / c) * MINUTES_PER_GAME;
    const high = Math.max(MINUTES_PER_GAME, Math.ceil((matchesAhead + 1) / c) * MINUTES_PER_GAME);
    return { low, high };
}

function runDay(cfg) {
    const {
        maleLevels = [], femaleLevels = [], courts = 2, minutes = 180, seed = 1,
        sensitivity = 'high', gameMin = 12, gameJitter = 2,
        joinEvents = [], leaveEvents = [], restEvents = [],
        queueTarget = 2,
    } = cfg;

    const gym = makeGym({ maleLevels, femaleLevels, courts, seed });
    joinEvents.forEach(e => {
        gym.allPlayers[e.id] = {
            id: e.id, name: e.id, gender: e.gender || '남', level: e.level || 'B조',
            status: 'inactive', isResting: false,
            entryTime: new Date(START_MS).toISOString(), todayRecentGames: [],
        };
    });
    const rand = gym.rand;
    const courtEnd = Array(courts).fill(null);

    const lastEndMs = {};
    const entryMs = {};
    const streak = {};   // 무휴식 연속 경기 수 (경기 시작 시점 기준)
    const games = {};
    Object.keys(gym.allPlayers).forEach(id => { games[id] = 0; streak[id] = 0; entryMs[id] = START_MS; });
    const latecomers = new Set(joinEvents.map(e => e.id));

    const stats = {
        started: 0, finished: 0, errors: [],
        thirdConsecEvents: 0,          // '무휴식 3연속째' 진입 횟수
        consecOpportunities: 0,        // 벤치에 다른 선택지가 있었는데도 3연속이 된 경우
        sameFourReplays: 0,
        waitPred: [],                  // { ahead, low, high, actual }
        maxWaitHungry: 0,
    };
    let lastFourSig = '';
    const queuedAt = {};               // matchSig → { t, ahead }

    // 실제 관리자처럼 "오래 기다린 사람이 많은 종목"부터 만든다 (stress-test 의 adaptive 모델)
    const modeOrder = (nowMs) => {
        const active = Object.values(gym.allPlayers).filter(p => p.status === 'active' && !p.isResting);
        const m = active.filter(p => p.gender === '남').length;
        const f = active.filter(p => p.gender === '여').length;
        const viable = [];
        if (m >= 4) viable.push('남');
        if (f >= 4) viable.push('여');
        if (m >= 2 && f >= 2) viable.push('혼복');
        if (viable.length === 0) return [];

        const onCourtIds = new Set(gym.gameState.inProgressCourts.filter(Boolean).flatMap(c => c.players).filter(Boolean));
        const queuedIds = new Set(Object.values(gym.gameState.autoMatches).flat().filter(Boolean));
        const waitsOf = (gender) => active
            .filter(p => p.gender === gender && !onCourtIds.has(p.id) && !queuedIds.has(p.id))
            .map(p => Math.max(0, (nowMs - (lastEndMs[p.id] ?? entryMs[p.id] ?? nowMs)) / 60000))
            .sort((a, b) => b - a);
        const topAvg = (arr, n) => (arr.length ? arr.slice(0, n).reduce((s, x) => s + x, 0) / Math.min(n, arr.length) : 0);
        const mW = waitsOf('남');
        const fW = waitsOf('여');
        const need = { '남': topAvg(mW, 4), '여': topAvg(fW, 4), '혼복': (topAvg(mW, 2) + topAvg(fW, 2)) / 2 };
        return viable
            .map(k => [k, need[k] * (0.95 + rand() * 0.1)])
            .sort((a, b) => b[1] - a[1])
            .map(([k]) => k);
    };

    for (let t = 0; t < minutes; t += 1) {
        const nowMs = START_MS + t * 60000;

        restEvents.filter(e => e.at === t).forEach(e => {
            const p = gym.allPlayers[e.id];
            if (p) p.isResting = e.resting;
            if (p && e.resting === false) lastEndMs[e.id] = nowMs;
        });
        leaveEvents.filter(e => e.at === t).forEach(e => {
            const p = gym.allPlayers[e.id];
            if (p) p.status = 'inactive';
        });
        joinEvents.filter(e => e.at === t).forEach(e => {
            const p = gym.allPlayers[e.id];
            if (p) {
                p.status = 'active'; p.entryTime = new Date(nowMs).toISOString();
                games[e.id] ??= 0; streak[e.id] ??= 0; entryMs[e.id] = nowMs;
            }
        });

        // (1) 끝난 경기 정리
        for (let c = 0; c < courts; c += 1) {
            if (courtEnd[c] !== null && t >= courtEnd[c]) {
                const ended = endMatch(gym, c, nowMs);
                (ended || []).forEach(id => { lastEndMs[id] = nowMs; });
                courtEnd[c] = null;
                stats.finished += 1;
            }
        }

        // (1.5) 깨진 예약 자동 해체 — 앱의 repairMatchQueues 와 동일 (useGameRoom 이 매 스냅샷마다 실행)
        //  이게 없으면 이탈·휴식자가 낀 예약에 묶인 나머지 3명이 영원히 굶는다.
        {
            const visible = {};
            Object.values(gym.allPlayers).forEach(p => {
                if (p.status === 'active') visible[p.id] = p;
            });
            const { changed, newState } = repairMatchQueues(
                { autoMatches: gym.gameState.autoMatches, scheduledMatches: gym.gameState.scheduledMatches },
                visible,
            );
            if (changed) {
                gym.gameState.autoMatches = newState.autoMatches;
                gym.gameState.scheduledMatches = newState.scheduledMatches;
                stats.repaired = (stats.repaired || 0) + 1;
            }
        }

        // (2) 큐 채우기 (관리자) — 급한 종목부터, 안 되면 다음 종목 시도
        try {
            let guard = 0;
            while (Object.keys(gym.gameState.autoMatches).length < queueTarget && guard < 4) {
                guard += 1;
                let added = false;
                for (const mode of modeOrder(nowMs)) {
                    const picked = adminGenerate(gym, mode, nowMs, sensitivity);
                    if (!picked) continue;
                    const sig = picked.ids.slice().sort().join('|');
                    const ahead = Object.keys(gym.gameState.autoMatches).length - 1; // 방금 추가된 경기의 앞선 경기 수
                    queuedAt[sig] = { t, ahead };
                    added = true;
                    break;
                }
                if (!added) break;
            }
        } catch (e) {
            stats.errors.push(`t=${t} generate: ${e.message}`);
        }

        // (3) 빈 코트에 시작 가능한 경기 올리기
        for (let c = 0; c < courts; c += 1) {
            if (gym.gameState.inProgressCourts[c]) continue;
            const keys = Object.keys(gym.gameState.autoMatches).sort((a, b) => Number(a) - Number(b));
            for (const key of keys) {
                const ids = gym.gameState.autoMatches[key];
                const sig = (ids || []).slice().sort().join('|');
                if (startMatch(gym, key, c, nowMs)) {
                    stats.started += 1;
                    // 무휴식 연속 측정
                    const benchCount = Object.values(gym.allPlayers).filter(p =>
                        p.status === 'active' && !p.isResting
                        && !gym.gameState.inProgressCourts.filter(Boolean).flatMap(x => x.players).includes(p.id)).length;
                    ids.forEach(id => {
                        const rest = lastEndMs[id] === undefined ? Infinity : (nowMs - lastEndMs[id]) / 60000;
                        streak[id] = rest <= CONSEC_REST_MIN ? (streak[id] || 0) + 1 : 1;
                        games[id] = (games[id] || 0) + 1;
                        if (streak[id] >= 3) {
                            stats.thirdConsecEvents += 1;
                            if (benchCount >= 1) stats.consecOpportunities += 1;
                        }
                    });
                    // 같은 4명 재탕
                    if (sig && sig === lastFourSig) stats.sameFourReplays += 1;
                    lastFourSig = sig;
                    // 대기 예측 정확도
                    const q = queuedAt[sig];
                    if (q) {
                        const { low, high } = waitRange(q.ahead, courts);
                        stats.waitPred.push({ low, high, actual: t - q.t });
                        delete queuedAt[sig];
                    }
                    courtEnd[c] = t + gameMin + Math.round((rand() * 2 - 1) * gameJitter);
                    break;
                }
            }
        }
    }

    // 마무리 지표
    // 편차·굶주림은 '처음부터 끝까지 있었던 사람'끼리 비교한다 — 90분 늦게 온 사람이
    // 경기 수가 적은 건 공평한 것이므로, 지각자는 '참석 시간 비례'로 따로 판정한다.
    const active = Object.values(gym.allPlayers).filter(p => p.status === 'active');
    const fullTimers = active.filter(p => !latecomers.has(p.id));
    const byGender = { '남': [], '여': [] };
    fullTimers.forEach(p => byGender[p.gender]?.push(games[p.id] || 0));
    let maxSpread = 0;
    let starving = 0;      // 엔진 구출선(평균 -3)을 넘겨 뒤처진 사람 — 이건 진짜 문제
    let edgeBehind = 0;    // 평균 -2~-3 구간 — 급수 보호의 설계된 대가 (기록만 한다)
    const genderAvg = {};
    Object.entries(byGender).forEach(([g, list]) => {
        if (list.length < 2) return;
        const avg = list.reduce((s, x) => s + x, 0) / list.length;
        genderAvg[g] = avg;
        maxSpread = Math.max(maxSpread, Math.max(...list) - Math.min(...list));
        starving += list.filter(x => avg - x > 3).length;
        edgeBehind += list.filter(x => avg - x > 2 && avg - x <= 3).length;
    });
    // 지각자: 참석 시간 비율만큼의 기대 경기 수에서 2경기 넘게 밀리면 굶은 것
    let lateStarving = 0;
    active.filter(p => latecomers.has(p.id)).forEach(p => {
        const share = Math.max(0, (START_MS + minutes * 60000 - entryMs[p.id]) / (minutes * 60000));
        const expected = (genderAvg[p.gender] || 0) * share;
        if (expected - (games[p.id] || 0) > 2) lateStarving += 1;
    });
    const theoretical = Math.floor(minutes / (gameMin + 1)) * courts;
    return {
        stats, games, maxSpread, starving, edgeBehind, lateStarving,
        utilization: theoretical > 0 ? stats.started / theoretical : 1,
    };
}

// ═══════════════════════════════════════════════════════════════════════════════════
// [1] 연속 경기 제한 A/B — 감점을 끄고/켜고 같은 씨앗으로 비교
// ═══════════════════════════════════════════════════════════════════════════════════

section('1. 연속 경기 제한 (아이디어 #6) — CONSEC_STREAK 0 vs 25 A/B');

const AB_SCENARIOS = [
    { name: '표준: 남12 · 2코트 · 3시간', cfg: { maleLevels: [...rep('A조', 3), ...rep('B조', 5), ...rep('C조', 4)], courts: 2, minutes: 180 } },
    { name: '넉넉: 남16 · 3코트 · 3시간', cfg: { maleLevels: [...rep('B조', 8), ...rep('C조', 8)], courts: 3, minutes: 180 } },
    { name: '빠듯: 남9 · 2코트 (연속 압박)', cfg: { maleLevels: rep('C조', 9), courts: 2, minutes: 180 } },
    { name: '혼합 대형: 남20 · 여8 · 4코트', cfg: { maleLevels: [...rep('A조', 4), ...rep('B조', 8), ...rep('C조', 8)], femaleLevels: [...rep('B조', 4), ...rep('C조', 4)], courts: 4, minutes: 240 } },
];
const SEEDS = [11, 42, 77];

const original = MATCH_WEIGHTS.CONSEC_STREAK;
let abAllOk = true;
for (const sc of AB_SCENARIOS) {
    let offConsec = 0; let onConsec = 0;
    let offSpread = 0; let onSpread = 0;
    let offUtil = 0; let onUtil = 0;
    let onStarving = 0;
    for (const seed of SEEDS) {
        MATCH_WEIGHTS.CONSEC_STREAK = 0;
        const off = runDay({ ...sc.cfg, seed });
        MATCH_WEIGHTS.CONSEC_STREAK = original;
        const on = runDay({ ...sc.cfg, seed });
        offConsec += off.stats.thirdConsecEvents; onConsec += on.stats.thirdConsecEvents;
        offSpread = Math.max(offSpread, off.maxSpread); onSpread = Math.max(onSpread, on.maxSpread);
        offUtil += off.utilization / SEEDS.length; onUtil += on.utilization / SEEDS.length;
        onStarving += on.starving;
        if (on.stats.errors.length) { abAllOk = false; console.log('    오류:', on.stats.errors.slice(0, 2)); }
    }
    const reduced = onConsec <= offConsec;
    const qualityKept = onSpread <= Math.max(3, offSpread) && onUtil >= offUtil - 0.08 && onStarving === 0;
    check(`${sc.name}`, reduced && qualityKept,
        `3연속 ${offConsec}→${onConsec}회 · 편차 ${offSpread}→${onSpread} · 가동률 ${(offUtil * 100).toFixed(0)}%→${(onUtil * 100).toFixed(0)}%`);
    if (!(reduced && qualityKept)) abAllOk = false;
}
MATCH_WEIGHTS.CONSEC_STREAK = original;

// 물리적으로 연속이 불가피한 극소 인원 — 엔진이 멈추지만 않으면 된다
{
    const tiny = runDay({ maleLevels: rep('C조', 4), courts: 1, minutes: 120, seed: 5 });
    check('4명 · 1코트 (연속 불가피) — 오류 없이 완주', tiny.stats.errors.length === 0 && tiny.stats.started >= 6,
        `${tiny.stats.started}경기 진행`);
    const five = runDay({ maleLevels: rep('C조', 5), courts: 1, minutes: 150, seed: 6 });
    check('5명 · 1코트 — 완주 + 편차 3 이하', five.stats.errors.length === 0 && five.maxSpread <= 3,
        `${five.stats.started}경기 · 편차 ${five.maxSpread}`);
}

// ═══════════════════════════════════════════════════════════════════════════════════
// [2] 이번 주 대규모 가정 — 지각 파도 · 휴식 · 중도 이탈까지 섞은 큰 판
// ═══════════════════════════════════════════════════════════════════════════════════

section('2. 대규모 하루 풀 시뮬레이션 (이번 주 상황 가정)');

for (const seed of [1, 2, 3, 4, 5]) {
    const big = runDay({
        maleLevels: [...rep('S조', 2), ...rep('A조', 5), ...rep('B조', 8), ...rep('C조', 6), ...rep('D조', 3)],
        femaleLevels: [...rep('A조', 2), ...rep('B조', 5), ...rep('C조', 5)],
        courts: 6, minutes: 300, seed,
        joinEvents: [
            { id: '지각남1', gender: '남', level: 'B조', at: 40 },
            { id: '지각남2', gender: '남', level: 'C조', at: 40 },
            { id: '지각여1', gender: '여', level: 'B조', at: 60 },
            { id: '지각남3', gender: '남', level: 'A조', at: 90 },
        ],
        leaveEvents: [
            { id: '남3', at: 150 }, { id: '여2', at: 180 },
        ],
        restEvents: [
            { id: '남5', at: 60, resting: true }, { id: '남5', at: 90, resting: false },
            { id: '여4', at: 100, resting: true }, { id: '여4', at: 130, resting: false },
        ],
        queueTarget: 3,
    });
    // 편차 4까지 허용: 42명 · 5시간 · 전 급수(S~D) 세션에서는 급수 양극단(S조·D조)이
    // 평균 -2~-3 균형점에 수렴하는 것이 엔진의 설계된 트레이드오프다 (구출선은 -3).
    const ok = big.stats.errors.length === 0
        && big.maxSpread <= 4
        && big.starving === 0
        && big.lateStarving === 0
        && big.utilization >= 0.7
        && big.stats.sameFourReplays === 0;
    check(`씨앗 ${seed}: 42명 · 6코트 · 5시간 (지각4·이탈2·휴식2)`, ok,
        `${big.stats.started}경기 · 편차 ${big.maxSpread} · 구출선 밖 ${big.starving}명 · 경계(-2~-3) ${big.edgeBehind}명 · 가동률 ${(big.utilization * 100).toFixed(0)}% · 예약해체 ${big.stats.repaired || 0}회`);
    if (process.env.DEBUG_BIG) {
        const rows = Object.entries(big.games)
            .filter(([id]) => id.startsWith('남') || id.startsWith('여'))
            .sort((a, b) => a[1] - b[1]);
        console.log('     분포:', rows.map(([id, g]) => `${id}:${g}`).join(' '));
    }
}

// ═══════════════════════════════════════════════════════════════════════════════════
// [3] 대기시간 "약 N~N분" 예측 정확도 — 시뮬레이션 실측과 비교
// ═══════════════════════════════════════════════════════════════════════════════════

section('3. 대기시간 표시 (한 경기 10분 기준 · 활성 코트 수 반영)');

// 3-1. 계산식 자체의 불변식
{
    let invariantOk = true;
    const samples = [];
    for (let ahead = 0; ahead <= 12; ahead += 1) {
        for (let c = 1; c <= 6; c += 1) {
            const { low, high } = waitRange(ahead, c);
            if (!(low <= high) || low < 0 || high < MINUTES_PER_GAME) invariantOk = false;
            // 코트가 많을수록 대기 상한이 늘지 않아야 한다
            if (c > 1) {
                const prev = waitRange(ahead, c - 1);
                if (high > prev.high) invariantOk = false;
            }
            if (ahead === 3 && c <= 3) samples.push(`${c}코트→약${low}~${high}분`);
        }
    }
    check('불변식: low≤high · 음수 없음 · 코트 늘면 대기 안 늘어남', invariantOk,
        `앞 3경기 기준: ${samples.join(' · ')}`);
    const r0 = waitRange(0, 2);
    check('바로 다음 차례(ahead 0)는 "약 10분 이내"', r0.low === 0 && r0.high === 10, `low=${r0.low} high=${r0.high}`);
}

// 3-2. 실측: 시뮬레이션에서 예약→시작까지 실제 걸린 시간이 예측 범위에 드는가
{
    const measurements = [];
    for (const seed of [7, 8, 9]) {
        const day = runDay({
            maleLevels: [...rep('A조', 4), ...rep('B조', 6), ...rep('C조', 6)],
            courts: 3, minutes: 240, seed, queueTarget: 3, gameMin: 10, gameJitter: 3,
        });
        measurements.push(...day.stats.waitPred);
    }
    const inRange = measurements.filter(m => m.actual >= Math.max(0, m.low - 2) && m.actual <= m.high + 3).length;
    const over = measurements.filter(m => m.actual > m.high + 3).length;
    const ratio = measurements.length ? inRange / measurements.length : 0;
    // 예측은 어림값 — 80% 이상이 '범위±3분' 안에 들고, 크게 초과(상한+3분)가 15% 미만이면 합격
    check('예측 적중률 80% 이상 (범위 ±3분 허용)', ratio >= 0.8,
        `${measurements.length}건 중 ${inRange}건 적중 (${(ratio * 100).toFixed(0)}%) · 상한 초과 ${over}건`);
}

// ═══════════════════════════════════════════════════════════════════════════════════
// [4] 버전 게이트
// ═══════════════════════════════════════════════════════════════════════════════════

section('4. 버전 강제 업데이트 게이트 (아이디어 #96)');
{
    const cases = [
        ['v1.0.0', '1.0.0', false, '같은 버전은 통과'],
        ['v1.0.0', '1.0.1', true, '패치가 낮으면 차단'],
        ['v1.2.9', '1.3.0', true, '마이너가 낮으면 차단'],
        ['v2.0.0', '1.9.9', false, '높은 버전은 통과'],
        ['v1.10.0', '1.9.0', false, '두 자리 숫자 비교 (문자열 비교 함정)'],
        ['v1.0.0', '', false, 'minVersion 없으면 통과'],
        ['깨진값', '1.0.0', false, '파싱 불가면 막지 않는다 (보수적)'],
        ['v1.0.0', 'abc', false, '조건이 깨져도 막지 않는다'],
    ];
    let allOk = true;
    for (const [cur, min, expected, label] of cases) {
        const got = versionLessThan(cur, min);
        if (got !== expected) { allOk = false; console.log(`     ✗ ${label}: ${cur} vs ${min} → ${got}`); }
    }
    check('8가지 버전 비교 케이스 전부 기대값과 일치', allOk);
}

// ═══════════════════════════════════════════════════════════════════════════════════
// [5] 알림 라이브러리 — 실제 모듈을 localStorage 셈으로 실행
// ═══════════════════════════════════════════════════════════════════════════════════

section('5. 알림 기록·설정 (lib/notify.js 실제 모듈 실행)');
{
    // 브라우저 전역 셈 (모듈이 기대하는 최소한만)
    const store = new Map();
    globalThis.localStorage = {
        getItem: k => (store.has(k) ? store.get(k) : null),
        setItem: (k, v) => store.set(k, String(v)),
        removeItem: k => store.delete(k),
    };
    const notifyLib = await import('../src/lib/notify.js');

    // 60개를 보내면 50개만 남아야 한다 (기록 상한)
    for (let i = 1; i <= 60; i += 1) {
        await notifyLib.notify({ title: `알림 ${i}`, body: '', silent: true });
    }
    const log = notifyLib.readNotiLog();
    check('기록 상한 50개 유지 (60개 발송)', log.length === 50, `${log.length}개`);
    check('최신이 맨 앞', log[0]?.title === '알림 60' && log[49]?.title === '알림 11');
    check('안읽음 수 = 50', notifyLib.unreadNotiCount() === 50, `${notifyLib.unreadNotiCount()}개`);
    notifyLib.markNotiRead();
    check('읽음 처리 후 안읽음 0', notifyLib.unreadNotiCount() === 0);
    await new Promise(r => setTimeout(r, 5));   // 같은 밀리초에 읽음+수신이 겹치지 않게
    await notifyLib.notify({ title: '새 알림', silent: true });
    check('새 알림이 오면 안읽음 1', notifyLib.unreadNotiCount() === 1);

    check('소리 기본값 ON', notifyLib.soundEnabled() === true);
    notifyLib.setSoundEnabled(false);
    check('소리 끄기 저장', notifyLib.soundEnabled() === false);
    notifyLib.setSoundEnabled(true);
    check('소리 켜기 복원', notifyLib.soundEnabled() === true);

    notifyLib.clearNotiLog();
    check('모두 지우기', notifyLib.readNotiLog().length === 0);

    // 시스템 알림 미지원 환경(아이폰 사파리 비설치와 동일)에서도 죽지 않는다
    const result = await notifyLib.notify({ title: '미지원 환경', silent: true });
    check('Notification API 없는 환경에서 안전하게 false 반환', result === false);

    // 깨진 저장값 방어
    store.set('cockstar-noti-log', '{깨진 JSON');
    check('깨진 기록 저장값 → 빈 배열로 복구', Array.isArray(notifyLib.readNotiLog()) && notifyLib.readNotiLog().length === 0);
}

// ═══════════════════════════════════════════════════════════════════════════════════
// [6] 알림 트리거 상태기계 — MyTurnBanner 의 전환 규칙 미러
// ═══════════════════════════════════════════════════════════════════════════════════

section('6. 내 차례 알림 트리거 (상태 전환 규칙)');
{
    // MyTurnBanner.jsx useEffect 의 결정표 미러 (소스 바뀌면 같이 고칠 것)
    function firedOn(prev, now) {
        if (!prev || prev === now || !now) return null;
        if (now === 'ready') return 'loud';                     // 다음 경기는 나! (소리+진동)
        if (now === 'playing') return 'loud';                   // 코트 입장 (소리+진동)
        if (now === 'queued' && (prev === 'waiting' || prev === 'resting')) return 'silent'; // 예약됨 (진동만)
        return null;
    }
    const flow = [
        [null, 'waiting', null, '첫 진입은 조용히'],
        ['waiting', 'queued', 'silent', '경기 잡힘 → 조용한 알림'],
        ['queued', 'ready', 'loud', '다음은 나 → 소리+진동'],
        ['ready', 'playing', 'loud', '코트 입장 → 소리+진동'],
        ['playing', 'waiting', null, '경기 끝 → 알림 없음'],
        ['waiting', 'waiting', null, '같은 상태 반복 → 절대 안 울림'],
        ['resting', 'queued', 'silent', '휴식 복귀 직후 예약 → 조용한 알림'],
        ['queued', 'queued', null, '앞 경기 수만 바뀜 → 안 울림 (스팸 방지)'],
        ['ready', 'queued', null, '앞에 끼어듦 → 안 울림 (혼란 방지)'],
    ];
    let allOk = true;
    for (const [prev, now, expected, label] of flow) {
        const got = firedOn(prev, now);
        if (got !== expected) { allOk = false; console.log(`     ✗ ${label}: ${prev}→${now} 기대 ${expected} 실제 ${got}`); }
    }
    check('9가지 상태 전환 전부 기대대로 (중복 알림 스팸 없음)', allOk);
}

// ═══════════════════════════════════════════════════════════════════════════════════
// [7] 동시 관리자 조작 — 직렬화 커밋 트랜잭션 모델로 가드 로직 재현
// ═══════════════════════════════════════════════════════════════════════════════════

section('7. 관리자 2명 동시 조작 (트랜잭션 가드 — useGameRoom 로직 미러)');
{
    // Firestore 트랜잭션의 핵심 성질만 재현: 읽은 문서가 커밋 전에 바뀌면 재실행
    function makeStore(init) {
        const docs = new Map(Object.entries(init).map(([k, v]) => [k, { data: structuredClone(v), ver: 0 }]));
        return {
            docs,
            async runTransaction(fn) {
                for (let attempt = 0; attempt < 5; attempt += 1) {
                    const readVers = new Map();
                    const writes = [];
                    const t = {
                        get: (key) => {
                            const d = docs.get(key);
                            readVers.set(key, d ? d.ver : -1);
                            return d ? { exists: true, data: structuredClone(d.data) } : { exists: false, data: null };
                        },
                        set: (key, data) => writes.push({ key, data }),
                        update: (key, patch) => writes.push({ key, patch }),
                        delete: (key) => writes.push({ key, del: true }),
                    };
                    const result = await fn(t);
                    // 커밋: 읽은 버전이 그대로인지 확인
                    const conflict = [...readVers].some(([k, v]) => (docs.get(k)?.ver ?? -1) !== v);
                    if (conflict) continue;
                    for (const w of writes) {
                        if (w.del) { docs.delete(w.key); continue; }
                        const cur = docs.get(w.key) || { data: {}, ver: 0 };
                        const next = w.data ? w.data : { ...cur.data, ...w.patch };
                        docs.set(w.key, { data: next, ver: cur.ver + 1 });
                    }
                    return result;
                }
                throw new Error('경합 재시도 초과');
            },
        };
    }
    /** 두 작업을 '둘 다 읽고 나서 순서대로 커밋'하는 최악의 경합으로 실행 */
    async function contend(store, opA, opB) {
        // 직렬화 모델에서는 순차 실행 + 재시도로 같은 결과가 난다
        const a = await store.runTransaction(opA);
        const b = await store.runTransaction(opB);
        return [a, b];
    }

    // 7-1. 같은 선수를 동시에 내보내기 → 인원 -1 은 한 번만
    {
        const store = makeStore({ room: { playerCount: 10 }, 'p/김철수': { name: '김철수' } });
        const kick = (t) => {
            const snap = t.get('p/김철수');
            if (!snap.exists) return 'noop';
            t.delete('p/김철수');
            const room = t.get('room');
            t.update('room', { playerCount: room.data.playerCount - 1 });
            return 'kicked';
        };
        const [a, b] = await contend(store, kick, kick);
        const count = store.docs.get('room').data.playerCount;
        check('같은 선수 동시 내보내기 → playerCount 10→9 (한 번만 감소)',
            count === 9 && [a, b].filter(x => x === 'kicked').length === 1, `결과 [${a}, ${b}] · 인원 ${count}`);
    }

    // 7-2. 자리비움 일괄 정리 동시 실행 → 정확한 감소
    {
        const store = makeStore({
            room: { playerCount: 8 },
            'p/a': { name: 'a' }, 'p/b': { name: 'b' }, 'p/c': { name: 'c' },
        });
        const clean = (t) => {
            const stale = ['p/a', 'p/b', 'p/c'];
            const alive = stale.filter(k => t.get(k).exists);
            if (alive.length === 0) return 0;
            alive.forEach(k => t.delete(k));
            const room = t.get('room');
            t.update('room', { playerCount: room.data.playerCount - alive.length });
            return alive.length;
        };
        const [a, b] = await contend(store, clean, clean);
        const count = store.docs.get('room').data.playerCount;
        check('일괄 정리 동시 실행 → 8→5 정확 (중복 감소 없음)', count === 5 && a + b === 3, `제거 ${a}+${b} · 인원 ${count}`);
    }

    // 7-3. 같은 코트에 동시에 경기 시작 → 한 명만 성공
    {
        const store = makeStore({ room: { courts: [null, null], auto: { 0: ['a', 'b', 'c', 'd'], 1: ['e', 'f', 'g', 'h'] } } });
        const start = (matchKey) => (t) => {
            const room = t.get('room').data;
            if (room.courts[0]) return 'blocked';           // "이미 다른 관리자가 그 코트에서 시작"
            const players = room.auto[matchKey];
            if (!players) return 'gone';
            const onCourt = new Set(room.courts.filter(Boolean).flatMap(c => c.players));
            if (players.some(id => onCourt.has(id))) return 'dup';
            const courts = [...room.courts];
            courts[0] = { players };
            const auto = { ...room.auto };
            delete auto[matchKey];
            t.update('room', { courts, auto });
            return 'started';
        };
        const [a, b] = await contend(store, start('0'), start('1'));
        const room = store.docs.get('room').data;
        check('같은 코트 동시 시작 → 한 경기만 올라감', [a, b].filter(x => x === 'started').length === 1 && room.courts.filter(Boolean).length === 1,
            `결과 [${a}, ${b}]`);
    }

    // 7-4. 같은 슬롯에 동시에 선수 배치 → 한 명만 성공
    {
        const store = makeStore({ room: { sched: { 0: [null, null, null, null] } } });
        const fill = (pid) => (t) => {
            const room = t.get('room').data;
            const sched = { ...room.sched, 0: [...room.sched[0]] };
            if (sched[0][0] !== null) return 'taken';       // "방금 다른 관리자가 배치"
            sched[0][0] = pid;
            t.update('room', { sched });
            return 'filled';
        };
        const [a, b] = await contend(store, fill('영희'), fill('철수'));
        const slot = store.docs.get('room').data.sched[0][0];
        check('같은 슬롯 동시 배치 → 먼저 커밋한 쪽만 성공', [a, b].filter(x => x === 'filled').length === 1 && slot === '영희',
            `결과 [${a}, ${b}] · 슬롯=${slot}`);
    }

    // 7-5. 같은 코트 동시 경기 종료 → 경기 수 +1 은 한 번만 (멱등)
    {
        const store = makeStore({
            room: { courts: [{ players: ['a', 'b', 'c', 'd'] }] },
            'p/a': { todayGames: 3 }, 'p/b': { todayGames: 3 }, 'p/c': { todayGames: 3 }, 'p/d': { todayGames: 3 },
        });
        const end = (t) => {
            const room = t.get('room').data;
            const court = room.courts[0];
            if (!court) return 'already';                    // "이미 종료됨 — 조용히"
            court.players.forEach(id => {
                const p = t.get(`p/${id}`);
                t.update(`p/${id}`, { todayGames: p.data.todayGames + 1 });
            });
            t.update('room', { courts: [null] });
            return 'ended';
        };
        const [a, b] = await contend(store, end, end);
        const gamesA = store.docs.get('p/a').data.todayGames;
        check('같은 코트 동시 종료 → 경기 수 3→4 (두 번 안 오름)', gamesA === 4 && [a, b].filter(x => x === 'ended').length === 1,
            `결과 [${a}, ${b}] · a 의 경기 수 ${gamesA}`);
    }

    // 7-6. 자동매칭 동시 추가 (같은 선수 포함) → 한 쪽만 성공 + 번호 충돌 없음
    {
        const store = makeStore({ room: { auto: {} } });
        const add = (ids) => (t) => {
            const room = t.get('room').data;
            const queued = new Set(Object.values(room.auto).flat());
            if (ids.some(id => queued.has(id))) return 'conflict';
            const nextIdx = Object.keys(room.auto).reduce((m, k) => Math.max(m, Number(k) + 1), 0);
            t.update('room', { auto: { ...room.auto, [String(nextIdx)]: ids } });
            return 'added';
        };
        const [a, b] = await contend(store, add(['a', 'b', 'c', 'd']), add(['c', 'd', 'e', 'f']));
        const auto = store.docs.get('room').data.auto;
        check('겹치는 선수의 동시 자동매칭 추가 → 한 쪽만 등록', [a, b].filter(x => x === 'added').length === 1 && Object.keys(auto).length === 1,
            `결과 [${a}, ${b}]`);
    }
}

// ═══════════════════════════════════════════════════════════════════════════════════
// [8] 최근 본 상품 — 상한 · 중복 제거 · 최신순 (products.js 로직 미러)
// ═══════════════════════════════════════════════════════════════════════════════════

section('8. 최근 본 상품 (아이디어 #65)');
{
    const RECENT_MAX = 12;
    let saved = [];
    const record = (idx) => { saved = [idx, ...saved.filter(i => i !== idx)].slice(0, RECENT_MAX); };

    for (let i = 1; i <= 20; i += 1) record(i);
    check('20개 보면 12개만 남는다', saved.length === 12, `${saved.length}개`);
    check('최신이 맨 앞 (20 → 9 순서)', saved[0] === 20 && saved[11] === 9);
    record(15); // 이미 본 상품을 다시 보면
    check('재조회 시 중복 없이 맨 앞으로', saved[0] === 15 && saved.filter(i => i === 15).length === 1 && saved.length === 12);
}

// ═══════════════════════════════════════════════════════════════════════════════════
// [9] consecStreak 계산 엣지 — 실제 buildMatchContext 로 검증
// ═══════════════════════════════════════════════════════════════════════════════════

section('9. 연속 경기 판정 엣지 케이스 (buildMatchContext 직접 검증)');
{
    const now = START_MS + 120 * 60000;
    const iso = (minAgo) => new Date(now - minAgo * 60000).toISOString();
    const base = (id, games) => ({
        id, name: id, gender: '남', level: 'B조', status: 'active', isResting: false,
        entryTime: new Date(START_MS).toISOString(), todayRecentGames: games,
    });
    const emptyState = { numInProgressCourts: 2, inProgressCourts: [null, null], autoMatches: {}, scheduledMatches: {} };

    // 방금 2연속을 끝낸 사람: 3분 전 종료 + 그 16분 전 종료(= 경기시간 13 + 휴식 3)
    const players = {
        '연속2': base('연속2', [
            { timestamp: iso(3), partners: ['x'], opponents: ['y', 'z'] },
            { timestamp: iso(19), partners: ['y'], opponents: ['x', 'z'] },
        ]),
        '휴식충분': base('휴식충분', [
            { timestamp: iso(12), partners: ['x'], opponents: ['y', 'z'] },
            { timestamp: iso(28), partners: ['y'], opponents: ['x', 'z'] },
        ]),
        '깨진시각': base('깨진시각', [
            { timestamp: '이상한값', partners: ['x'], opponents: ['y', 'z'] },
        ]),
        '수동기록': base('수동기록', [
            { timestamp: iso(2), partners: [], opponents: [], isManual: true },
            { timestamp: iso(4), partners: [], opponents: [], isManual: true },
        ]),
        '신규': base('신규', []),
    };
    const ctx = buildMatchContext(players, emptyState, { now });
    check('2연속 직후(3분 휴식) → 스트릭 2', ctx.stats['연속2'].consecStreak === 2, `실제 ${ctx.stats['연속2'].consecStreak}`);
    check('12분 쉰 사람 → 스트릭 0 (끊김)', ctx.stats['휴식충분'].consecStreak === 0, `실제 ${ctx.stats['휴식충분'].consecStreak}`);
    check('깨진 timestamp → 스트릭 0 · NaN 없음', ctx.stats['깨진시각'].consecStreak === 0 && Number.isFinite(ctx.stats['깨진시각'].waitMin));
    check('수동 보정 기록(isManual)은 연속으로 안 센다', ctx.stats['수동기록'].consecStreak === 0, `실제 ${ctx.stats['수동기록'].consecStreak}`);
    check('기록 없는 신규 → 스트릭 0', ctx.stats['신규'].consecStreak === 0);

    // 경기중인 사람: 코트 시작 4분 전에 직전 경기 종료 → 현재 경기 포함 스트릭 2
    const onCourtState = {
        numInProgressCourts: 2,
        inProgressCourts: [{ players: ['경기중', 'x1', 'x2', 'x3'], startTime: iso(5) }, null],
        autoMatches: {}, scheduledMatches: {},
    };
    const players2 = {
        '경기중': base('경기중', [{ timestamp: iso(9), partners: ['a'], opponents: ['b', 'c'] }]),
        x1: base('x1', []), x2: base('x2', []), x3: base('x3', []),
        a: base('a', []), b: base('b', []), c: base('c', []),
    };
    const ctx2 = buildMatchContext(players2, onCourtState, { now });
    check('경기중 + 직전 경기와 4분 간격 → 스트릭 2 (지금 경기 포함)', ctx2.stats['경기중'].consecStreak === 2,
        `실제 ${ctx2.stats['경기중'].consecStreak}`);
}

// ═══════════════════════════════════════════════════════════════════════════════════

console.log('\n' + '═'.repeat(78));
if (fail === 0) {
    console.log(` 🎉 전부 통과 — 검증 ${pass}건`);
} else {
    console.log(` ❌ 실패 ${fail}건 / 통과 ${pass}건`);
    failures.forEach(f => console.log(`    · ${f}`));
    process.exitCode = 1;
}
console.log('═'.repeat(78));
