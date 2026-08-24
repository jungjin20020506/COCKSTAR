import { describe, it, expect } from 'vitest';
import { decorateRooms, sortRooms, filterRooms } from '../lib/roomSort';

// ===================================================================================
// 경기방 정렬 — 로비에서 가장 자주 쓰이는 로직
// -----------------------------------------------------------------------------------
// 여기서 확인하는 것은 '순서'가 아니라 규칙이다.
//   · 찜한 방은 어떤 정렬에서도 맨 위인가
//   · 값이 없는 방(좌표 없음, 운영 기록 없음)이 앞으로 끼어들지 않는가
// 두 번째가 특히 중요하다. 없는 값을 0으로 치면 주소도 없는 방이 '가장 가까운 방'이 된다.
// ===================================================================================

const ts = (iso) => ({ toDate: () => new Date(iso) });

const ROOMS = [
    {
        id: 'a', name: '가 체육관', playerCount: 4,
        coords: { lat: 37.5, lng: 127.0 },
        createdAt: ts('2026-08-01T00:00:00Z'),
        lastActiveAt: ts('2026-08-20T10:00:00Z'),
        inProgressCourts: [{ players: ['p1', 'p2', 'p3', 'p4'] }],
    },
    {
        id: 'b', name: '나 체육관', playerCount: 12,
        coords: { lat: 37.6, lng: 127.0 },
        createdAt: ts('2026-08-10T00:00:00Z'),
        lastActiveAt: ts('2026-08-24T10:00:00Z'),
        inProgressCourts: [],
    },
    {
        id: 'c', name: '다 체육관', playerCount: 2,
        coords: null,                       // 좌표가 없는 방
        createdAt: ts('2026-08-15T00:00:00Z'),
        lastActiveAt: null,                 // 한 번도 운영한 적 없는 방
        inProgressCourts: [],
    },
];

const myLoc = { lat: 37.5, lng: 127.0 };

describe('decorateRooms', () => {
    it('지금 코트에서 뛰는 인원을 센다', () => {
        const [a, b] = decorateRooms(ROOMS, {});
        expect(a.playingNow).toBe(4);
        expect(b.playingNow).toBe(0);
    });

    it('내 위치를 모르면 거리를 계산하지 않는다', () => {
        const list = decorateRooms(ROOMS, {});
        expect(list.every(r => r.distance === undefined)).toBe(true);
    });

    it('좌표가 없는 방은 거리를 비워둔다', () => {
        const list = decorateRooms(ROOMS, { myLoc });
        expect(list.find(r => r.id === 'a').distance).toBeCloseTo(0, 3);
        expect(list.find(r => r.id === 'c').distance).toBeUndefined();
    });
});

describe('sortRooms', () => {
    it('찜한 방은 어떤 정렬에서도 맨 위다', () => {
        const list = decorateRooms(ROOMS, { myLoc, favorites: ['c'] });
        for (const key of ['recent', 'near', 'crowded', 'new', 'name']) {
            expect(sortRooms(list, key)[0].id).toBe('c');
        }
    });

    it('최근 운영순 — 운영 기록이 없는 방은 개설 시각으로 대신한다', () => {
        const list = decorateRooms(ROOMS, {});
        expect(sortRooms(list, 'recent').map(r => r.id)).toEqual(['b', 'a', 'c']);
    });

    it('가까운 순 — 좌표 없는 방은 맨 뒤로 간다', () => {
        const list = decorateRooms(ROOMS, { myLoc });
        expect(sortRooms(list, 'near').map(r => r.id)).toEqual(['a', 'b', 'c']);
    });

    it('사람 많은 순', () => {
        const list = decorateRooms(ROOMS, {});
        expect(sortRooms(list, 'crowded').map(r => r.id)).toEqual(['b', 'a', 'c']);
    });

    it('원본 배열을 건드리지 않는다', () => {
        const list = decorateRooms(ROOMS, {});
        const before = list.map(r => r.id);
        sortRooms(list, 'crowded');
        expect(list.map(r => r.id)).toEqual(before);
    });
});

describe('filterRooms', () => {
    it('이름·장소·주소를 함께 본다', () => {
        const rooms = [
            { id: '1', name: '수요 정모', location: '오산체육관', address: '경기 오산시' },
            { id: '2', name: '금요 리그', location: '수원체육관', address: '경기 수원시' },
        ];
        expect(filterRooms(rooms, '오산').map(r => r.id)).toEqual(['1']);
        expect(filterRooms(rooms, '금요').map(r => r.id)).toEqual(['2']);
        expect(filterRooms(rooms, '경기').map(r => r.id)).toEqual(['1', '2']);
    });

    it('검색어가 비면 전부 돌려준다', () => {
        const rooms = [{ id: '1', name: 'a' }];
        expect(filterRooms(rooms, '   ')).toHaveLength(1);
    });
});
