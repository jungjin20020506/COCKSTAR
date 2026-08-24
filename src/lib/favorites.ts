// ===================================================================================
// 경기방 찜하기
// -----------------------------------------------------------------------------------
// 매주 같은 방에 가는 사람이 대부분이다. 그런데 로비는 방이 늘어날수록 스크롤이
// 길어져서, 자기 방을 찾는 데 매번 시간이 걸린다. 찜한 방은 어떤 정렬에서도 맨 위다.
//
// 저장은 두 곳에 한다.
//   · users/{uid}.favoriteRooms — 기기를 바꿔도 따라온다 (권위 있는 값)
//   · localStorage              — 로그인 전에도 쓸 수 있고, 로그인하면 합쳐진다
//
// 한쪽만 쓰면 곤란하다. 서버만 쓰면 로그인 전에 못 쓰고, 기기만 쓰면 폰을 바꿀 때
// 사라진다. 읽을 때 둘을 합집합으로 본다.
// ===================================================================================

const LS_KEY = 'cockstar-favorite-rooms';
const LS_KEY_PRODUCTS = 'cockstar-favorite-products';

export function readLocalFavorites(): string[] {
    try {
        const raw = JSON.parse(localStorage.getItem(LS_KEY) || '[]');
        return Array.isArray(raw) ? raw.filter(x => typeof x === 'string') : [];
    } catch {
        return [];
    }
}

export function writeLocalFavorites(ids: string[]): void {
    try { localStorage.setItem(LS_KEY, JSON.stringify([...new Set(ids)])); }
    catch { /* 사파리 프라이빗 모드 — 저장 실패는 무시한다 */ }
}

/** 서버 값과 기기 값을 합친다 (둘 중 하나에만 있어도 찜한 것으로 본다) */
export function mergeFavorites(remote: string[] | undefined, local: string[]): string[] {
    return [...new Set([...(remote || []), ...local])];
}

export function toggleFavorite(list: string[], roomId: string): string[] {
    return list.includes(roomId) ? list.filter(id => id !== roomId) : [...list, roomId];
}

// ── 찜한 상품 ──
// 방과 같은 방식(서버 + 기기 합집합)이다. 상품 id 는 products.js 의 idx 를 쓴다.
// 결제는 공식몰에서 일어나므로 여기 찜은 '나중에 볼 목록'이자, 파트너에게 넘길
// 수요 신호이기도 하다.

export function readLocalProductFavorites(): number[] {
    try {
        const raw = JSON.parse(localStorage.getItem(LS_KEY_PRODUCTS) || '[]');
        return Array.isArray(raw) ? raw.filter(x => typeof x === 'number') : [];
    } catch {
        return [];
    }
}

export function writeLocalProductFavorites(ids: number[]): void {
    try { localStorage.setItem(LS_KEY_PRODUCTS, JSON.stringify([...new Set(ids)])); }
    catch { /* 저장 실패는 무시한다 */ }
}

export function mergeProductFavorites(remote: number[] | undefined, local: number[]): number[] {
    return [...new Set([...(remote || []), ...local])];
}

export function toggleProductFavorite(list: number[], idx: number): number[] {
    return list.includes(idx) ? list.filter(id => id !== idx) : [...list, idx];
}
