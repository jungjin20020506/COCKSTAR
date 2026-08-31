// ===================================================================================
// 콕스타 연동 검증 — 앱이 실제로 겪는 상황을 그대로 재현한다
// -----------------------------------------------------------------------------------
// scripts/simulate-matching.mjs 는 '엔진'이 옳은지 본다.
// 이 파일은 '콕스타 데이터를 엔진에 넘기는 층(matchQueues.js)'이 옳은지 본다.
//
// 여기서 걸러야 하는 사고들
//   · Firestore Timestamp 를 그대로 넘겨 시각이 NaN 이 되는 것
//   · serverTimestamp() 가 아직 반영되지 않아 entryTime 이 null 인 상태
//   · 카드에 찍힌 경기 수(todayGames)와 구조체 기록이 어긋나는 것
//   · 나간 선수가 낀 예약 경기가 안 풀려서 매칭이 멈추는 것
//
// 실행: npm run test:integration
// ===================================================================================

import { buildMatchContext, buildCandidatePool, generateMatchOptions } from '../src/lib/matching.js';
import { buildEngineInput, repairMatchQueues, toIsoTime, reconcileHistory } from '../src/lib/matchQueues.js';

let failed = 0;
const check = (label, ok, detail = '') => {
    console.log(`  ${ok ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`);
    if (!ok) failed += 1;
};

const NOW = new Date('2026-08-21T20:00:00+09:00').getTime();
const minsAgo = (m) => new Date(NOW - m * 60000).toISOString();

/** Firestore Timestamp 를 흉내낸다 (읽어온 문서에 들어 있는 모양) */
const ts = (iso) => ({
    seconds: Math.floor(new Date(iso).getTime() / 1000),
    nanoseconds: 0,
    toDate() { return new Date(this.seconds * 1000); },
});

/** 콕스타 선수 문서 모양 */
function player(id, opts = {}) {
    return {
        id, name: id,
        gender: opts.gender || '남',
        level: opts.level || 'B조',
        entryTime: opts.entryTime !== undefined ? opts.entryTime : ts(minsAgo(120)),
        todayGames: opts.todayGames ?? 0,
        isResting: !!opts.isResting,
        matchHistory: opts.matchHistory || [],
        todayRecentGames: opts.todayRecentGames || [],
        ...(opts.isBot ? { isBot: true } : {}),
    };
}

const asMap = (arr) => arr.reduce((a, p) => ({ ...a, [p.id]: p }), {});

console.log('='.repeat(74));
console.log(' 콕스타 연동 검증 (matchQueues 어댑터 + 엔진)');
console.log('='.repeat(74));

// ───────────────────────────────────────────────────────────────────────────────────
console.log('\n[1] 시각 값 — Firestore Timestamp / null / 깨진 값');
{
    check('1-1. Timestamp 객체를 ISO 로 바꾼다',
        toIsoTime(ts('2026-08-21T10:00:00.000Z')) === '2026-08-21T10:00:00.000Z');
    check('1-2. { seconds } 평면 객체도 처리한다',
        toIsoTime({ seconds: 1787306400, nanoseconds: 0 }) !== null);
    check('1-3. serverTimestamp 미반영(null)은 null 로', toIsoTime(null) === null);
    check('1-4. 깨진 문자열은 null 로', toIsoTime('어제쯤') === null);
    check('1-5. 빈 객체도 죽지 않는다', toIsoTime({}) === null);

    // ★ 핵심: 시각이 깨져도 점수가 NaN 이 되면 안 된다
    const players = asMap([
        player('남1', { entryTime: '완전히깨진값', todayGames: 1 }),
        player('남2', { entryTime: null }),
        player('남3', { entryTime: ts(minsAgo(40)) }),
        player('남4', { entryTime: undefined }),
    ]);
    const room = { numInProgressCourts: 2, inProgressCourts: [null, null], autoMatches: {}, scheduledMatches: {} };
    const { allPlayers, gameState } = buildEngineInput(room, players);
    const ctx = buildMatchContext(allPlayers, gameState, { now: NOW });
    const r = generateMatchOptions({ pool: buildCandidatePool(ctx, '남'), ctx, mode: '남', maxOnCourt: 0 });
    const score = r.pages?.[0]?.[0]?.score;
    check('1-6. 시각이 깨져도 점수가 NaN 이 되지 않는다', Number.isFinite(score), `점수 ${score}`);
}

// ───────────────────────────────────────────────────────────────────────────────────
console.log('\n[2] 경기 수 — 카드 숫자와 엔진 계산이 같아야 한다');
{
    // 이 기능을 넣기 전부터 돌던 방: todayGames 는 있는데 구조체 기록이 없다
    const legacy = player('남1', { todayGames: 5, todayRecentGames: [] });
    check('2-1. 기록이 없어도 카드 숫자만큼 경기 수를 센다',
        reconcileHistory(legacy).length === 5, `${reconcileHistory(legacy).length}경기`);
    check('2-2. 채워 넣은 기록은 isManual 로 표시된다 (없는 만남을 지어내지 않는다)',
        reconcileHistory(legacy).every(g => g.isManual && g.partners.length === 0));

    // 관리자가 경기 수를 줄인 경우
    const trimmed = player('남2', {
        todayGames: 1,
        todayRecentGames: [
            { timestamp: minsAgo(10), partners: ['남3'], opponents: ['남4', '남5'] },
            { timestamp: minsAgo(40), partners: ['남6'], opponents: ['남7', '남8'] },
            { timestamp: minsAgo(70), partners: ['남9'], opponents: ['남1', '남2'] },
        ],
    });
    const cut = reconcileHistory(trimmed);
    check('2-3. 카드 숫자가 더 적으면 오래된 기록부터 잘라낸다', cut.length === 1);
    check('2-4. 자를 때 최신 기록을 남긴다 (대기 시간 계산이 망가지지 않게)',
        cut[0].partners[0] === '남3');

    // 엔진이 보는 경기 수 = 카드 숫자
    const players = asMap([
        player('남1', { todayGames: 5 }),
        player('남2', { todayGames: 1 }),
        player('남3', { todayGames: 1 }),
        player('남4', { todayGames: 1 }),
        player('남5', { todayGames: 1 }),
    ]);
    const room = { numInProgressCourts: 1, inProgressCourts: [null], autoMatches: {}, scheduledMatches: {} };
    const { allPlayers, gameState } = buildEngineInput(room, players);
    const ctx = buildMatchContext(allPlayers, gameState, { now: NOW });
    check('2-5. 엔진이 세는 경기 수가 카드 숫자와 같다',
        ctx.stats['남1'].games === 5 && ctx.stats['남2'].games === 1,
        `남1 ${ctx.stats['남1'].games} / 남2 ${ctx.stats['남2'].games}`);

    const r = generateMatchOptions({ pool: buildCandidatePool(ctx, '남'), ctx, mode: '남', maxOnCourt: 0 });
    const best = r.pages[0][0].ids;
    check('2-6. 많이 친 사람(5경기)이 베스트에서 빠진다', !best.includes('남1'), best.join('·'));
}

// ───────────────────────────────────────────────────────────────────────────────────
console.log('\n[3] 경기중인 선수 — 코트 정보가 엔진에 제대로 전달되는가');
{
    const players = asMap([
        player('남1'), player('남2'), player('남3'), player('남4'),
        player('남5'), player('남6'), player('남7'), player('남8'),
    ]);
    const room = {
        numInProgressCourts: 2,
        inProgressCourts: [
            { players: ['남1', '남2', '남3', '남4'], startTime: minsAgo(9) },
            null,
        ],
        autoMatches: {}, scheduledMatches: {},
    };
    const { allPlayers, gameState } = buildEngineInput(room, players);
    const ctx = buildMatchContext(allPlayers, gameState, { now: NOW });

    check('3-1. 코트에서 뛰는 선수를 onCourt 로 인식한다',
        ctx.stats['남1'].onCourt === true && ctx.stats['남5'].onCourt === false);
    check('3-2. 진행 중인 경기가 경기 수에 반영된다 (+1)',
        ctx.stats['남1'].games === 1 && ctx.stats['남5'].games === 0);
    check('3-3. 남은 시간이 계산된다', Math.round(ctx.stats['남1'].remainingMin) === 6,
        `${Math.round(ctx.stats['남1'].remainingMin)}분`);

    // 지금 같이 뛰는 사람과 또 붙지 않아야 한다
    const r = generateMatchOptions({ pool: buildCandidatePool(ctx, '남'), ctx, mode: '남', maxOnCourt: 4 });
    const best = r.pages[0][0].ids;
    const courtMates = ['남1', '남2', '남3', '남4'].filter(id => best.includes(id));
    check('3-4. 지금 한 코트에 있는 4명이 그대로 다시 묶이지 않는다', courtMates.length < 4, best.join('·'));
}

// ───────────────────────────────────────────────────────────────────────────────────
console.log('\n[4] 이중 배정 방지 — 이미 예약된 사람은 후보에서 빠진다');
{
    const players = asMap(Array.from({ length: 8 }, (_, i) => player(`남${i + 1}`)));
    const room = {
        numInProgressCourts: 2, inProgressCourts: [null, null],
        autoMatches: { '0': ['남1', '남2', '남3', '남4'] },
        scheduledMatches: { '0': ['남5', null, null, null] },
    };
    const { allPlayers, gameState } = buildEngineInput(room, players);
    const ctx = buildMatchContext(allPlayers, gameState, { now: NOW });
    const pool = buildCandidatePool(ctx, '남').map(p => p.id);

    check('4-1. 자동 매칭에 잡힌 사람이 후보에서 빠진다', !pool.includes('남1'));
    check('4-2. 경기 예정에 잡힌 사람도 빠진다', !pool.includes('남5'));
    check('4-3. 남은 사람만 후보가 된다', pool.sort().join(',') === '남6,남7,남8', pool.join(','));
}

// ───────────────────────────────────────────────────────────────────────────────────
console.log('\n[5] 교착 해소 — 나간 사람이 낀 예약 정리 (휴식은 해체 사유가 아니다)');
{
    // 남3이 방을 나갔다(문서 없음), 남6은 휴식으로 바꿨다.
    // ★ 정책 변경(2026-08-31): 휴식은 '표시'일 뿐 예약을 해체하지 않는다 —
    //   관리자가 휴식 중인 선수를 그대로 경기에 올릴 수 있어야 하기 때문.
    //   해체 대상은 '나간 사람'이 낀 경기뿐이다.
    const players = asMap([
        player('남1'), player('남2'), player('남4'), player('남5'),
        player('남6', { isResting: true }), player('남7'), player('남8'),
    ]);
    const queues = {
        autoMatches: { '0': ['남1', '남2', '남3', '남4'], '1': ['남5', '남6', '남7', '남8'] },
        scheduledMatches: { '0': ['남1', '남3', null, null] },
    };
    const { changed, newState, dissolvedCount } = repairMatchQueues(queues, players);

    check('5-1. 고칠 게 있다고 판단한다', changed === true);
    check('5-2. 나간 사람이 낀 자동 매칭만 통째로 해체한다', dissolvedCount === 1, `${dissolvedCount}경기 해체`);
    check('5-3. 휴식 선수가 낀 경기는 남고, 번호가 조밀하게 다시 매겨진다',
        Object.keys(newState.autoMatches).length === 1
        && JSON.stringify(newState.autoMatches['0']) === JSON.stringify(['남5', '남6', '남7', '남8']),
        JSON.stringify(newState.autoMatches));
    check('5-4. 경기 예정은 해당 칸만 비운다 (관리자 배치 존중)',
        newState.scheduledMatches['0'][0] === '남1' && newState.scheduledMatches['0'][1] === null,
        JSON.stringify(newState.scheduledMatches['0']));

    // 멀쩡한 상태에서는 아무것도 건드리지 않아야 한다 (무한 반복 방지)
    const clean = repairMatchQueues(
        { autoMatches: { '0': ['남1', '남2', '남4', '남5'] }, scheduledMatches: {} },
        players
    );
    check('5-5. 멀쩡하면 아무것도 바꾸지 않는다 (정리가 무한 반복되지 않게)', clean.changed === false);
}

// ───────────────────────────────────────────────────────────────────────────────────
console.log('\n[6] 빈 방·이상한 데이터에서 죽지 않는가');
{
    const empty = buildEngineInput({}, {});
    check('6-1. 빈 방에서도 입력을 만든다', Object.keys(empty.allPlayers).length === 0);

    const ctx0 = buildMatchContext(empty.allPlayers, empty.gameState, { now: NOW });
    const r0 = generateMatchOptions({ pool: buildCandidatePool(ctx0, '남'), ctx0: undefined, ctx: ctx0, mode: '남', maxOnCourt: 0 });
    check('6-2. 인원이 없으면 notEnough 로 알린다', r0.status === 'notEnough');

    // 코트 배열에 쓰레기가 섞인 경우
    const weird = buildEngineInput(
        { numInProgressCourts: 3, inProgressCourts: [null, { players: null }, 'x'], autoMatches: null, scheduledMatches: undefined },
        asMap([player('남1'), player('남2')])
    );
    check('6-3. 코트 배열이 깨져 있어도 죽지 않는다', Array.isArray(weird.gameState.inProgressCourts));

    const ctxW = buildMatchContext(weird.allPlayers, weird.gameState, { now: NOW });
    check('6-4. 깨진 코트로도 컨텍스트가 만들어진다', Object.keys(ctxW.stats).length === 2);

    // 휴식 중인 사람만 남은 방
    const resting = buildEngineInput(
        { numInProgressCourts: 1, inProgressCourts: [null] },
        asMap([player('남1', { isResting: true }), player('남2', { isResting: true })])
    );
    const ctxR = buildMatchContext(resting.allPlayers, resting.gameState, { now: NOW });
    check('6-5. 전원 휴식이면 후보가 0명', buildCandidatePool(ctxR, '남').length === 0);
}

// ───────────────────────────────────────────────────────────────────────────────────
console.log('\n[7] 콕스타 급수·성별 표기가 그대로 전달되는가');
{
    const players = asMap([
        player('S', { level: 'S조' }), player('E', { level: 'E조' }),
        player('N', { level: 'N조' }), player('U', { level: '미설정' }),
        player('여1', { gender: '여' }), player('봇', { isBot: true }),
    ]);
    // 급수 필드가 아예 없는 문서 (예전 버전에서 만들어진 선수).
    // player() 헬퍼는 기본값을 채워 넣으므로 여기서는 날것 그대로 넣는다.
    players['X'] = { id: 'X', name: 'X', gender: '남', entryTime: ts(minsAgo(30)), todayGames: 0 };
    const { allPlayers, gameState } = buildEngineInput(
        { numInProgressCourts: 1, inProgressCourts: [null] }, players
    );
    const ctx = buildMatchContext(allPlayers, gameState, { now: NOW });

    check('7-1. S조=1, E조=6', ctx.stats['S'].levelValue === 1 && ctx.stats['E'].levelValue === 6);
    check('7-2. N조·미설정은 중립 3.5', ctx.stats['N'].levelValue === 3.5 && ctx.stats['U'].levelValue === 3.5);
    check('7-3. 급수가 비어 있어도 중립으로 처리', ctx.stats['X'].levelValue === 3.5);
    check('7-4. 여자 후보가 성별로 갈린다',
        buildCandidatePool(ctx, '여').map(p => p.id).join(',') === '여1');
    check('7-5. 봇은 게스트로 표시된다', ctx.stats['봇'].isGuest === true);
}

console.log('\n' + '='.repeat(74));
console.log(failed === 0 ? ' 🎉 연동 검증 모두 통과' : ` ❌ ${failed}건 실패`);
console.log('='.repeat(74));
process.exit(failed === 0 ? 0 : 1);
