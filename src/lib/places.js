import gymData from '../data/gyms.json';
import clubData from '../data/clubs.json';

// ===================================================================================
// 콕맵 데이터 — 체육관 · 동호회
// -----------------------------------------------------------------------------------
// scripts/fetch-gyms.mjs / fetch-clubs.mjs 가 모아둔 JSON을 화면에서 쓰기 좋게 다듬는다.
//
// ⚠️ 데이터의 한계를 화면에서 숨기지 않는다 — 지도는 한 번 틀리면 아무도 안 본다.
//   · 체육관: 카카오 로컬 API 기준. 운영시간·요금은 API가 주지 않아서 '없음'이다.
//     지어내지 않고 카카오맵 상세 링크로 넘긴다.
//   · 공설/사설: 이름으로 추정한 값이라 100%가 아니다. 화면에도 '추정'이라 적는다.
//   · 동호회: 소모임에 등록된 것만, 그마저도 공개 검색이 주는 상위 50개뿐이다.
//     네이버 카페·밴드 동호회는 여기 없다.
// ===================================================================================

/** 소유 구분 → 화면 표기 */
const OWNERSHIP_LABEL = {
    public: '공설',
    private: '사설',
    school: '학교',
};

/** 체육관 목록 (이름순) */
const GYMS = (gymData.gyms || []).map(g => ({
    ...g,
    // 카카오맵 상세 주소는 장소 id 로 만들 수 있다. 1,000곳어치를 파일에 담지 않는다.
    kakaoUrl: `https://place.map.kakao.com/${g.id}`,
    ownershipLabel: OWNERSHIP_LABEL[g.ownership] || '기타',
    // 이름에 '배드민턴'이 있으면 배드민턴 전용/특화 시설로 본다.
    // 종합체육관에서도 배드민턴을 치지만, 확실한 곳을 따로 보여줄 수 있어야 한다.
    isBadminton: /배드민턴/.test(g.name || ''),
}));

/** 동호회 목록 (멤버 많은 순) */
const CLUBS = clubData.clubs || [];

/** 체육관이 있는 시·군 목록 (많은 순) */
const GYM_REGIONS = Object.entries(gymData.byRegion || {})
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));

const GYM_COUNT = GYMS.length;
const CLUB_COUNT = CLUBS.length;
const GYM_FETCHED_AT = gymData.fetchedAt || null;
const CLUB_FETCHED_AT = clubData.fetchedAt || null;
const CLUB_SOURCE = clubData.source || '소모임';

/**
 * 콕맵 상단 필터.
 * '경기방'은 콕스타에 실제로 열린 방이다 — 다른 앱에는 없는, 우리만 가진 정보다.
 */
const MAP_FILTERS = [
    { key: 'room', label: '🏸 경기방' },
    { key: 'badminton', label: '배드민턴장' },
    { key: 'public', label: '공설' },
    { key: 'private', label: '사설' },
    { key: 'all', label: '전체 체육관' },
];

/** 필터에 맞는 체육관만 */
function filterGyms(key) {
    switch (key) {
        case 'badminton': return GYMS.filter(g => g.isBadminton);
        case 'public': return GYMS.filter(g => g.ownership === 'public');
        case 'private': return GYMS.filter(g => g.ownership === 'private');
        case 'all': return GYMS;
        default: return [];   // 'room' 은 체육관을 안 그린다
    }
}

/** 두 좌표 사이 거리(km) — 하버사인 */
function distanceKm(lat1, lng1, lat2, lng2) {
    const toRad = (d) => (d * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2
        + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
}

/** 지도 중심에서 가까운 체육관 N곳 */
function nearestGyms(lat, lng, list = GYMS, limit = 20) {
    return list
        .map(g => ({ ...g, distance: distanceKm(lat, lng, g.lat, g.lng) }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, limit);
}

/** 이름·주소로 체육관 찾기 */
function searchGyms(text, limit = 20) {
    const q = String(text || '').trim();
    if (!q) return [];
    return GYMS
        .filter(g => g.name.includes(q) || (g.address || '').includes(q))
        .slice(0, limit);
}

/**
 * 그 지역의 동호회.
 * 동호회 데이터에는 좌표가 없고 '수원시' 같은 지역 이름만 있어서 지역으로 맞춘다.
 * (없는 좌표를 지어내 지도에 찍으면 엉뚱한 자리에 핀이 박힌다)
 */
function clubsInRegion(region) {
    if (!region) return [];
    const key = String(region).replace(/\s+/g, '');
    return CLUBS.filter(c => String(c.region || '').replace(/\s+/g, '').includes(key));
}

export {
    GYMS,
    CLUBS,
    GYM_REGIONS,
    GYM_COUNT,
    CLUB_COUNT,
    GYM_FETCHED_AT,
    CLUB_FETCHED_AT,
    CLUB_SOURCE,
    MAP_FILTERS,
    OWNERSHIP_LABEL,
    filterGyms,
    nearestGyms,
    searchGyms,
    clubsInRegion,
    distanceKm,
};
