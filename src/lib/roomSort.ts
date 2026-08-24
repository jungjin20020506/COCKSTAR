import { distanceKm } from './places';
import type { Room, RoomSortKey } from '../types';

// ===================================================================================
// 경기방 목록 정렬 — "어떤 순서로 보고 싶은지"는 사람마다 다르다
// -----------------------------------------------------------------------------------
// 예전에는 무조건 '최근 개설순' 하나였다. 그런데 실제로 방을 고르는 기준은
//   · 오늘 사람이 모여 있는 곳    → 최근 운영순
//   · 집에서 가까운 곳            → 가까운 순
//   · 북적이는 곳 / 한산한 곳     → 인원 순
// 처럼 제각각이다. 그래서 고를 수 있게 했다.
//
// ★ 찜한 방은 어떤 정렬에서도 항상 맨 위다.
//   매주 가는 방이 정해져 있는 사람에게는 정렬보다 이게 더 중요하다.
// ===================================================================================

export interface SortOption { key: RoomSortKey; label: string; hint: string; needsLocation?: boolean; }

export const ROOM_SORTS: SortOption[] = [
    { key: 'recent',  label: '최근 운영순', hint: '오늘 경기가 돌아간 방 먼저' },
    { key: 'near',    label: '가까운 순',   hint: '내 위치 기준', needsLocation: true },
    { key: 'crowded', label: '사람 많은 순', hint: '지금 인원이 많은 방 먼저' },
    { key: 'new',     label: '최신 개설순', hint: '새로 만들어진 방 먼저' },
    { key: 'name',    label: '이름순',      hint: '가나다' },
];

type Millis = number;

function ms(value: unknown): Millis {
    if (!value) return 0;
    const v = value as { toDate?: () => Date };
    if (typeof v.toDate === 'function') return v.toDate().getTime();
    const t = new Date(value as string).getTime();
    return Number.isFinite(t) ? t : 0;
}

export interface DecoratedRoom extends Room {
    /** 내 위치에서의 거리(km). 좌표가 없거나 내 위치를 모르면 undefined */
    distance?: number;
    /** 찜했는가 */
    favorite?: boolean;
    /** 지금 코트에서 뛰고 있는 사람 수 */
    playingNow?: number;
}

/**
 * 방 목록에 거리·찜·진행중 정보를 붙인다.
 * 정렬과 화면 표시가 같은 값을 보게 하려고 한 곳에서 계산한다.
 */
export function decorateRooms(
    rooms: Room[],
    opts: { myLoc?: { lat: number; lng: number } | null; favorites?: string[] } = {},
): DecoratedRoom[] {
    const favs = new Set(opts.favorites || []);
    return rooms.map(r => {
        const playingNow = (r.inProgressCourts || [])
            .reduce((n, c) => n + (c?.players?.filter(Boolean).length || 0), 0);
        let distance: number | undefined;
        if (opts.myLoc && r.coords?.lat && r.coords?.lng) {
            distance = distanceKm(opts.myLoc.lat, opts.myLoc.lng, r.coords.lat, r.coords.lng);
        }
        return { ...r, distance, favorite: favs.has(r.id), playingNow };
    });
}

/**
 * 정렬한다. 찜한 방은 항상 맨 위 (그 안에서는 고른 기준으로 다시 정렬).
 *
 * 값이 없는 방을 뒤로 보내는 게 중요하다. 예를 들어 '가까운 순'인데 좌표가 없는 방을
 * 0km 로 치면 주소도 없는 방이 1등으로 올라온다.
 */
export function sortRooms(rooms: DecoratedRoom[], key: RoomSortKey): DecoratedRoom[] {
    const byKey = (a: DecoratedRoom, b: DecoratedRoom): number => {
        switch (key) {
            case 'recent': {
                // 오늘 경기가 돌아간 방이 먼저. lastActiveAt 이 없으면 개설 시각으로 대신한다.
                const av = ms(a.lastActiveAt) || ms(a.createdAt);
                const bv = ms(b.lastActiveAt) || ms(b.createdAt);
                return bv - av;
            }
            case 'near': {
                const av = a.distance ?? Infinity;
                const bv = b.distance ?? Infinity;
                return av - bv;
            }
            case 'crowded':
                return (b.playerCount || 0) - (a.playerCount || 0);
            case 'new':
                return ms(b.createdAt) - ms(a.createdAt);
            case 'name':
                return (a.name || '').localeCompare(b.name || '', 'ko');
            default:
                return 0;
        }
    };

    return [...rooms].sort((a, b) => {
        if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
        return byKey(a, b) || (a.name || '').localeCompare(b.name || '', 'ko');
    });
}

/** 검색어로 거른다 (이름·장소·주소) */
export function filterRooms<T extends Room>(rooms: T[], term: string): T[] {
    const q = String(term || '').trim().toLowerCase();
    if (!q) return rooms;
    return rooms.filter(r =>
        (r.name || '').toLowerCase().includes(q)
        || (r.location || '').toLowerCase().includes(q)
        || (r.address || '').toLowerCase().includes(q));
}
