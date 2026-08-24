import { toMillis } from './time';

// ===================================================================================
// 자리 비움 판정 — 순수 함수만 (firebase 를 모른다)
// -----------------------------------------------------------------------------------
// 하트비트를 '찍는' 쪽(presence.js)은 Firestore 가 필요하지만, 찍힌 값을 '판정'하는
// 쪽은 계산일 뿐이다. 나눠두면 판정 규칙을 firebase 없이 테스트할 수 있다.
// ===================================================================================

/** 이만큼 소식이 없으면 자리 비움 */
export const STALE_MINUTES = 45;

/**
 * 자리를 비운 것으로 보이는 선수들.
 *
 * lastSeen 이 아예 없는 사람은 제외한다 — 이 기능이 생기기 전에 들어온 사람이라
 * 소식이 없는 게 아니라 '기록이 없는' 것이다. 그 사람들을 내보내면 억울하다.
 * 대신 방에 다시 들어오는 순간 lastSeen 이 찍히므로 하루면 자연히 정리된다.
 *
 * @param {Record<string, any>} players
 * @param {{ exclude?: Set<string>, minutes?: number }} opts
 *        exclude — 지금 코트에서 뛰는 사람 (신호가 끊겨도 건드리면 안 된다)
 */
export function findStalePlayers(players, { exclude, minutes = STALE_MINUTES } = {}) {
    const cutoff = Date.now() - minutes * 60 * 1000;
    return Object.values(players || {}).filter(p => {
        if (!p || p.isBot) return false;
        if (exclude?.has(p.id)) return false;
        const seen = toMillis(p.lastSeen);
        if (!seen) return false;
        return seen < cutoff;
    });
}

/** 자리 비움인데 아직 '휴식'으로 안 바뀐 사람 — 자동 처리 대상 */
export function findAutoRestTargets(players, opts) {
    return findStalePlayers(players, opts).filter(p => !p.isResting);
}
