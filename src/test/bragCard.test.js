import { describe, it, expect } from 'vitest';
import { computeBragStat, bragShareText, THEMES } from '../lib/bragCard';
import { findStalePlayers, findAutoRestTargets } from '../lib/presenceRules';
import { getDailyResetKey } from '../lib/time';

// ===================================================================================
// 자랑 카드 통계 · 자리 비움 판정 · 운영일 키
// ===================================================================================

const game = (partners, opponents, iso = new Date().toISOString()) => ({
    timestamp: iso, partners, opponents,
});

const PLAYERS = {
    me: {
        id: 'me', name: '정형진', level: 'B조', todayGames: 5,
        todayRecentGames: [
            game(['a'], ['b', 'c']),
            game(['b'], ['a', 'd']),
            { timestamp: new Date().toISOString(), partners: [], opponents: [], isManual: true },
        ],
    },
    a: { id: 'a', name: '김민수', level: 'A조', todayGames: 3 },
    b: { id: 'b', name: '박지훈', level: 'C조', todayGames: 5 },
    c: { id: 'c', name: '나상호', level: 'B조', todayGames: 2 },
    d: { id: 'd', name: '이상민', level: 'C조', todayGames: 7 },
    bot: { id: 'bot', name: 'Bot 1', level: 'A조', todayGames: 9, isBot: true },
};

describe('computeBragStat', () => {
    const stat = computeBragStat(PLAYERS.me, PLAYERS, '수요 정모');

    it('봇은 등수 계산에서 뺀다', () => {
        // 봇(9경기)이 들어가면 내가 3위가 된다. 사람 기준으로 d(7)만 나보다 많으므로 2위.
        expect(stat.rank).toBe(2);
        expect(stat.totalPlayers).toBe(5);
    });

    it('만난 사람은 팀·상대 구분 없이 센다 (수동 보정 기록은 제외)', () => {
        expect(stat.metCount).toBe(4);   // a, b, c, d
        expect(stat.partners).toContain('김민수');
        expect(stat.partners).toHaveLength(4);
    });

    it('경기 수는 화면 값(todayGames)을 그대로 쓴다', () => {
        expect(stat.games).toBe(5);
        expect(stat.minutes).toBe(60);
    });

    it('가장 많이 친 사람이 에이스다', () => {
        expect(stat.isAce).toBe(false);
        const top = computeBragStat(PLAYERS.d, PLAYERS, '');
        expect(top.isAce).toBe(true);
        expect(top.rank).toBe(1);
    });

    it('공유 문구에 핵심 숫자가 들어간다', () => {
        const text = bragShareText(stat);
        expect(text).toContain('5경기');
        expect(text).toContain('#콕스타');
    });

    it('테마는 3종이고 각각 색이 다르다', () => {
        expect(THEMES).toHaveLength(3);
        expect(new Set(THEMES.map(t => t.accent)).size).toBe(3);
    });
});

describe('자리 비움 판정', () => {
    const old = { toDate: () => new Date(Date.now() - 60 * 60 * 1000) };   // 1시간 전
    const fresh = { toDate: () => new Date() };

    it('오래 소식 없는 사람만 골라낸다', () => {
        const players = {
            gone: { id: 'gone', name: 'a', lastSeen: old },
            here: { id: 'here', name: 'b', lastSeen: fresh },
        };
        expect(findStalePlayers(players).map(p => p.id)).toEqual(['gone']);
    });

    it('lastSeen 기록이 아예 없는 사람은 건드리지 않는다', () => {
        // 이 기능이 생기기 전에 들어온 사람 — 소식이 없는 게 아니라 기록이 없는 것이다
        const players = { legacy: { id: 'legacy', name: 'a' } };
        expect(findStalePlayers(players)).toHaveLength(0);
    });

    it('코트에서 뛰는 사람은 신호가 끊겨도 제외한다', () => {
        const players = { p: { id: 'p', name: 'a', lastSeen: old } };
        expect(findStalePlayers(players, { exclude: new Set(['p']) })).toHaveLength(0);
    });

    it('이미 휴식인 사람은 자동 휴식 대상에서 뺀다', () => {
        const players = {
            a: { id: 'a', name: 'a', lastSeen: old, isResting: true },
            b: { id: 'b', name: 'b', lastSeen: old },
        };
        expect(findAutoRestTargets(players).map(p => p.id)).toEqual(['b']);
    });
});

describe('운영일 키', () => {
    it('새벽 2시 전은 어제로 친다 (KST)', () => {
        // KST 2026-08-24 01:30 = UTC 2026-08-23 16:30 → 운영일은 8/23
        expect(getDailyResetKey(new Date('2026-08-23T16:30:00Z'))).toBe('2026-08-23');
        // KST 2026-08-24 02:30 = UTC 2026-08-23 17:30 → 운영일은 8/24
        expect(getDailyResetKey(new Date('2026-08-23T17:30:00Z'))).toBe('2026-08-24');
    });
});
