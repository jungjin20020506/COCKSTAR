// ===================================================================================
// 자동 매칭 어댑터 · 대기열 교착 해소
// -----------------------------------------------------------------------------------
// 콕스라이팅에서 옮겨온 매칭 엔진(matching.js)은 프레임워크·DB를 전혀 모르는
// 순수 함수 덩어리다. 그래서 엔진을 그대로 두고, "콕스타의 데이터를 엔진이 아는
// 모양으로 번역해 주는 층"을 여기 따로 뒀다.
//
// 이렇게 나눈 이유: 나중에 콕스라이팅에서 엔진이 개선되면 matching.js만 덮어쓰면
// 되고, 콕스타 쪽 사정(방 구조·Firestore Timestamp·급수 체계)은 이 파일만 고치면 된다.
//
// ── 두 앱의 데이터가 어떻게 다른가 ──
//   콕스라이팅                        콕스타
//   players/{id}                      rooms/{roomId}/players/{uid}
//   status: 'active'|'inactive'       (문서가 있으면 방에 있는 것 — status 없음)
//   entryTime: ISO 문자열             entryTime: Firestore Timestamp
//   gameState/live 문서               rooms/{roomId} 문서 자체
// ===================================================================================

const PLAYERS_PER_MATCH = 4;

// ===================================================================================
// 1. 시각 값 정규화
// ===================================================================================

/**
 * 무엇이 들어오든 ISO 문자열로 바꾼다. 못 바꾸면 null.
 *
 * 콕스타는 entryTime을 serverTimestamp()로 쓰기 때문에 값의 모양이 세 가지나 된다.
 *   ① Firestore Timestamp 객체 (읽어온 뒤)
 *   ② { seconds, nanoseconds } 평면 객체 (캐시에서 올라온 경우)
 *   ③ null — serverTimestamp()가 아직 서버에 반영되기 전 (로컬 스냅샷)
 *
 * 매칭 엔진은 시각을 new Date(x)로 파싱하는데, ③을 그냥 넘기면 NaN이 나고
 * 그 NaN이 점수 전체로 번져서 순위가 '조용히' 무의미해진다. (화면엔 오류가 안 뜬다)
 * 그래서 엔진에 넘기기 전에 여기서 한 번 걸러낸다.
 */
function toIsoTime(value) {
    if (!value) return null;
    if (typeof value === 'string') {
        return Number.isFinite(new Date(value).getTime()) ? value : null;
    }
    if (value instanceof Date) {
        return Number.isFinite(value.getTime()) ? value.toISOString() : null;
    }
    // Firestore Timestamp (toDate 메서드가 있는 경우)
    if (typeof value.toDate === 'function') {
        try {
            const d = value.toDate();
            return Number.isFinite(d.getTime()) ? d.toISOString() : null;
        } catch { return null; }
    }
    // { seconds, nanoseconds } 평면 객체
    if (typeof value.seconds === 'number') {
        const ms = value.seconds * 1000 + Math.floor((value.nanoseconds || 0) / 1e6);
        return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
        return new Date(value).toISOString();
    }
    return null;
}

/** 맨 앞 기록이 오늘이 아니면 배열 전체를 버린다 (날짜가 바뀌면 오늘 기록 초기화) */
function filterTodayGames(games) {
    if (!Array.isArray(games) || games.length === 0) return [];
    const first = toIsoTime(games[0]?.timestamp);
    if (!first) return [];
    return new Date(first).toDateString() === new Date().toDateString() ? games : [];
}


// ===================================================================================
// 2. 급수 색 (캔버스·차트처럼 Tailwind 클래스를 못 쓰는 곳에서 필요한 실제 색값)
// -----------------------------------------------------------------------------------
// App.jsx의 getLevelColor()는 Tailwind 클래스 문자열을 돌려준다. 화면에는 그게 맞지만
// 하루 요약 카드는 <canvas>에 직접 그리기 때문에 hex 값이 필요하다.
// 두 곳의 색이 어긋나지 않도록 Tailwind 팔레트의 실제 색을 그대로 적어둔다.
// ===================================================================================
const LEVEL_HEX = {
    'S조': '#38BDF8', // sky-400
    'A조': '#F87171', // red-400
    'B조': '#FB923C', // orange-400
    'C조': '#FCD34D', // amber-300
    'D조': '#34D399', // emerald-400
    'E조': '#60A5FA', // blue-400
};
const getLevelHex = (level) => LEVEL_HEX[level] || '#A1A1AA';


// ===================================================================================
// 3. 콕스타 방 데이터 → 매칭 엔진 입력
// ===================================================================================

/**
 * 방(roomData)과 선수 목록(players)을 매칭 엔진이 아는 모양으로 번역한다.
 *
 * @param {object} roomData rooms/{roomId} 문서
 * @param {object} players  { [uid]: player } — rooms/{roomId}/players 전체
 * @returns {{ allPlayers: object, gameState: object }}
 */
function buildEngineInput(roomData, players) {
    const allPlayers = {};

    Object.values(players || {}).forEach(p => {
        if (!p || !p.id) return;
        allPlayers[p.id] = {
            id: p.id,
            name: p.name || '선수',
            gender: p.gender === '여' ? '여' : '남',
            level: p.level || 'N조',
            // 콕스타는 '방에 문서가 있다 = 참여 중'이다. 엔진은 status를 보므로 여기서 채워준다.
            status: 'active',
            isResting: !!p.isResting,
            // 봇은 콕스라이팅의 게스트와 같은 위치 — 카드 색과 집계에서만 구분한다
            isGuest: !!p.isBot,
            entryTime: toIsoTime(p.entryTime),
            // ★ 엔진의 심장. 없으면 겹침 방지가 통째로 죽는다.
            todayRecentGames: reconcileHistory(p),
        };
    });

    const numInProgressCourts = roomData?.numInProgressCourts ?? (roomData?.inProgressCourts || []).length;

    const gameState = {
        inProgressCourts: (roomData?.inProgressCourts || []).map(court => {
            if (!court || !Array.isArray(court.players)) return null;
            return { players: court.players, startTime: toIsoTime(court.startTime) };
        }),
        autoMatches: roomData?.autoMatches || {},
        scheduledMatches: roomData?.scheduledMatches || {},
        numInProgressCourts,
    };

    return { allPlayers, gameState };
}

/**
 * 구조체 기록을 엔진이 쓸 수 있는 모양으로 정리한다.
 *
 * ★ 왜 구조체가 필요한가
 *   콕스타에 원래 있던 matchHistory는 "B정형진, C나상호, …" 같은 사람이 읽는 문자열이다.
 *   보기에는 좋지만 엔진이 "누가 누구와 몇 번 만났는지"를 셀 수 없다.
 *   그래서 todayRecentGames를 따로 쌓는다. matchHistory는 그대로 두고 함께 기록한다.
 *   (기존 화면이 안 깨지고, 문제가 생기면 이 필드만 무시하면 원래대로 돌아간다)
 */
function normalizeHistory(raw) {
    if (!Array.isArray(raw)) return [];
    return raw
        .map(g => {
            if (!g || typeof g !== 'object') return null;
            const timestamp = toIsoTime(g.timestamp);
            if (!timestamp) return null;
            return {
                timestamp,
                partners: (g.partners || []).filter(Boolean),
                opponents: (g.opponents || []).filter(Boolean),
                ...(g.isManual ? { isManual: true } : {}),
            };
        })
        .filter(Boolean);
}

/**
 * 구조체 기록과 화면에 찍히는 경기 수(todayGames)를 맞춘다.
 *
 * ★ 왜 필요한가
 *   콕스타에는 원래 todayGames라는 '숫자 카운터'가 있었고, 선수 카드는 그 값을 보여준다.
 *   구조체 기록(todayRecentGames)은 이번에 새로 생긴 것이라, 둘이 어긋나는 상황이 있다.
 *     ① 이 기능을 넣기 전부터 돌던 방 — 카운터는 5인데 구조체 기록은 0개
 *     ② 관리자가 경기 수를 손으로 보정한 경우
 *   맞춰주지 않으면 선수 카드에는 5G인데 매칭 후보 칩에는 0G가 떠서, 관리자가
 *   화면을 못 믿게 된다. 더 나쁜 건 엔진이 그 사람을 '한 경기도 안 친 사람'으로 보고
 *   계속 우선 배정한다는 것이다.
 *
 *   그래서 모자란 만큼을 isManual 표시가 붙은 빈 기록으로 채운다.
 *   엔진은 isManual 기록을 '경기 수'에는 세지만 '누구와 만났나' 계산에서는 빼도록
 *   이미 만들어져 있어서, 없는 만남을 지어내지 않는다.
 *
 *   채움 기록은 배열 '뒤'(= 오래된 쪽)에 붙인다. 맨 앞은 '마지막으로 경기를 끝낸 시각'
 *   으로 쓰이기 때문에, 앞에 붙이면 실제 대기 시간이 뭉개진다.
 */
function reconcileHistory(player) {
    const history = normalizeHistory(player?.todayRecentGames);
    const counter = Math.max(0, Math.floor(player?.todayGames || 0));
    const diff = counter - history.length;
    if (diff === 0) return history;

    if (diff > 0) {
        // 기록이 모자란다 → isManual 표시가 붙은 빈 기록으로 채운다.
        // 시각은 입장 시각으로 둔다. 그래야 대기 시간이 '기록이 아예 없을 때'와 똑같아진다.
        const filler = toIsoTime(player?.entryTime) || new Date().toISOString();
        for (let i = 0; i < diff; i += 1) {
            history.push({ timestamp: filler, partners: [], opponents: [], isManual: true });
        }
        return history;
    }

    // 기록이 더 많다 → 오래된 쪽부터 잘라낸다.
    // 앞(최신)을 남기는 게 중요하다. 맨 앞은 '마지막으로 경기를 끝낸 시각'이고,
    // 최근 만남일수록 겹침 방지에 더 중요한 정보이기 때문이다.
    return history.slice(0, counter);
}


// ===================================================================================
// 4. [자동 복구] 시작할 수 없게 된 예약 경기 정리
// -----------------------------------------------------------------------------------
// 예약해 둔 경기에 들어 있던 선수가 중간에 나가면(퇴장),
// 그 경기는 영원히 START를 누를 수 없다. 그대로 두면 목록이 막혀서
//   "그 선수들은 계속 예약 상태 → 새 매칭 후보에서도 빠짐 → 경기가 안 만들어짐"
// 이라는 교착에 빠진다. (콕스라이팅 시뮬레이션에서 2시간 32경기 → 10경기로 폭락)
//
// 두 대기열에 서로 다른 정책을 쓴다.
//   · 자동 매칭  → 경기를 통째로 해체. 앱이 만든 조합이니 다시 만들면 된다.
//   · 경기 예정  → 문제 슬롯만 비움. 관리자가 손으로 짠 배치이므로 의도를 존중한다.
//
// 순수 함수다 — 쓰기를 하지 않고 결과만 돌려준다. 호출부(App.jsx)가 트랜잭션으로 반영한다.
// ===================================================================================

/**
 * 이 선수가 지금 경기에 들어갈 수 있는 상태인가.
 * 콕스타는 status 필드가 없다(문서가 있으면 방에 있는 것). 그래도 콕스라이팅에서
 * 함께 옮겨온 시뮬레이터는 status를 쓰기 때문에 양쪽 모두 통하도록 관대하게 판정한다.
 *
 * ★ 휴식(isResting)은 '못 뛰는 상태'가 아니다. 휴식은 새 자동 매칭 후보에서만
 *   빠지는 표시이고, 이미 잡힌 예약 경기는 관리자가 그대로 시작할 수 있다.
 *   예전에는 휴식이면 예약을 해체해서, 본인이 누르지도 않은 자동 휴식과 겹치며
 *   "멀쩡한 경기가 저절로 사라지는" 사고가 났다. 해체 대상은 '나간 사람'뿐이다.
 */
const isPlayerUsable = (player) => !!player && player.status !== 'inactive';

/**
 * @param {object} gameState  { autoMatches, scheduledMatches, ... }
 * @param {object} allPlayers 전체 선수 (나간 선수는 아예 없을 수 있다)
 * @returns {{changed: boolean, newState: object, dissolvedCount: number, clearedNames: Array<string>}}
 */
const repairMatchQueues = (gameState, allPlayers) => {
    const newState = JSON.parse(JSON.stringify(gameState || {}));
    let changed = false;
    let dissolvedCount = 0;
    const clearedNames = [];

    // (1) 자동 매칭 — 못 뛰는 선수가 한 명이라도 있으면 그 경기를 해체한다
    const autoMatches = newState.autoMatches || {};
    const keptMatches = [];
    Object.keys(autoMatches)
        .sort((a, b) => Number(a) - Number(b))
        .forEach(key => {
            const match = autoMatches[key];
            if (!Array.isArray(match)) return;
            const broken = match.filter(Boolean).filter(id => !isPlayerUsable(allPlayers?.[id]));
            if (broken.length > 0) {
                changed = true;
                dissolvedCount += 1;
                broken.forEach(id => clearedNames.push(allPlayers?.[id]?.name || '나간 선수'));
                return; // 목록에 다시 담지 않는다 = 해체
            }
            keptMatches.push(match);
        });
    if (changed) {
        // 남은 경기를 "0","1",… 로 조밀하게 다시 매긴다 (중간에 빈 번호가 생기지 않게)
        const reindexed = {};
        keptMatches.forEach((m, i) => { reindexed[String(i)] = m; });
        newState.autoMatches = reindexed;
    }

    // (2) 경기 예정(수동) — 관리자가 짠 배치이므로 해당 칸만 비운다
    const scheduled = newState.scheduledMatches || {};
    Object.keys(scheduled).forEach(key => {
        const match = scheduled[key];
        if (!Array.isArray(match)) return;
        match.forEach((id, slotIndex) => {
            if (id && !isPlayerUsable(allPlayers?.[id])) {
                match[slotIndex] = null;
                changed = true;
                clearedNames.push(allPlayers?.[id]?.name || '나간 선수');
            }
        });
    });

    return { changed, newState, dissolvedCount, clearedNames };
};


export {
    PLAYERS_PER_MATCH,
    toIsoTime,
    filterTodayGames,
    LEVEL_HEX,
    getLevelHex,
    buildEngineInput,
    normalizeHistory,
    reconcileHistory,
    isPlayerUsable,
    repairMatchQueues,
};
