import catalog from '../data/noerrorProducts.json';

// ===================================================================================
// 노에러 상품 데이터
// -----------------------------------------------------------------------------------
// scripts/fetch-noerror-products.mjs 가 공식몰에서 받아 저장한 JSON을 화면에서 쓰기 좋게
// 다듬는다. 화면 컴포넌트가 원본 JSON의 생김새를 직접 알지 않도록 여기서 한 겹 감싼다.
// 나중에 아임웹 공식 API로 갈아타더라도 이 파일만 고치면 화면은 그대로 둘 수 있다.
//
// ⚠️ 가격·재고는 '받아온 시점의 값'이다. 실시간이 아니다.
//    그래서 상품을 누르면 반드시 공식몰의 해당 상품 페이지로 보낸다.
//    앱 안에서 결제까지 하는 구조가 아니므로, 값이 조금 지나도 사고가 나지 않는다.
//    가격이 바뀌었다면 `npm run fetch:products -- --force` 로 다시 받는다.
// ===================================================================================

/** 원본 카테고리 → 화면에 쓸 짧은 이름 */
const CATEGORY_LABEL = {
    '2026SS': '신상',
    '배드민턴 의류': '의류',
    '배드민턴라켓': '라켓',
    '배드민턴화': '신발',
    '배드민턴 가방': '가방',
    '셔틀콕': '셔틀콕',
    'Acc': '용품',
    '🔥OUTLET🔥': '아웃렛',
};

/** 스토어 화면 위쪽 칩에 보여줄 순서 (없는 카테고리는 자동으로 빠진다) */
const CATEGORY_ORDER = ['신상', '의류', '라켓', '신발', '가방', '셔틀콕', '용품', '아웃렛'];

const labelOf = (raw) => CATEGORY_LABEL[raw] || raw || '기타';

/** 공식몰에서 받아온 전체 상품 (190종) — 추리기 전의 원본 */
const ALL_PRODUCTS = (catalog.products || []).map(p => {
    const rate = p.originalPrice && p.originalPrice > p.price
        ? Math.round((1 - p.price / p.originalPrice) * 100)
        : 0;
    return {
        ...p,
        cat: labelOf(p.category),
        image: p.images?.[0] || null,
        discountRate: rate,
        // 색상만 다른 같은 옷이 여러 개라 이름이 겹친다. 목록에서 구분되도록 색을 붙인다.
        displayName: p.color ? `${p.name} · ${p.color}` : p.name,
    };
});

// ===================================================================================
// 대표 상품 추리기
// -----------------------------------------------------------------------------------
// 공식몰 상품을 전부(190개) 띄우면 두 가지가 나빠진다.
//   ① 같은 옷의 색상 변형이 줄줄이 늘어서서 상품 종류가 적어 보인다
//      (예: '노에러 게임 셔츠'가 색깔만 다른 채로 4칸을 차지한다)
//   ② 콕스타는 쇼핑몰이 아니라 경기 앱이다. 스토어가 너무 무거우면 본론이 밀린다
//
// 그래서 이름이 같은 상품은 한 개만 남기고, 카테고리별 할당량만큼만 고른다.
// 색상·사이즈는 어차피 공식몰 상품 페이지에서 고르므로 정보가 사라지지 않는다.
//
// 더 많이/적게 보여주고 싶으면 아래 QUOTA 숫자만 바꾸면 된다.
// (원본은 ALL_PRODUCTS 에 그대로 남아 있어서 다시 수집할 필요가 없다)
// ===================================================================================
const QUOTA = {
    '신상': 5,
    '라켓': 8,
    '의류': 8,
    '가방': 6,
    '신발': 5,
    '셔틀콕': 4,
    '용품': 6,
    '아웃렛': 6,
};

/**
 * 대표로 남길 상품을 고른다.
 * 같은 이름 중에서는 '살 수 있고, 사진이 있고, 할인 중인' 것을 대표로 삼되,
 * 색상 변형들은 colorVariants 로 함께 담는다. (쇼핑몰 카드에 색상 도트로 보여준다)
 */
function curate(list) {
    const best = new Map();
    const variants = new Map();   // 이름 → 색상 목록
    for (const p of list) {
        if (p.color) {
            const arr = variants.get(p.name) || [];
            if (!arr.includes(p.color)) arr.push(p.color);
            variants.set(p.name, arr);
        }
        const cur = best.get(p.name);
        if (!cur) { best.set(p.name, p); continue; }
        const score = (x) => (x.image ? 4 : 0) + (x.soldOut ? 0 : 2) + (x.discountRate > 0 ? 1 : 0);
        if (score(p) > score(cur)) best.set(p.name, p);
    }

    const picked = [];
    for (const cat of CATEGORY_ORDER) {
        const limit = QUOTA[cat] ?? 0;
        if (!limit) continue;
        const group = [...best.values()]
            .filter(p => p.cat === cat)
            // ★ 신상 카테고리는 '최근 등록 순'을 우선한다 — 신상 코너의 존재 이유다.
            //   나머지 카테고리는 할인 폭이 큰 것부터 (살 만한 것이 먼저 보이게).
            .sort((a, b) => cat === '신상'
                ? (b.idx - a.idx)
                : (b.discountRate - a.discountRate || b.idx - a.idx));
        picked.push(...group.slice(0, limit));
    }
    return picked.map(p => ({ ...p, colorVariants: variants.get(p.name) || (p.color ? [p.color] : []) }));
}

/** 화면에 실제로 보여줄 대표 상품 — 신상이 항상 맨 앞이다 (CATEGORY_ORDER 순서 그대로) */
const PRODUCTS = curate(ALL_PRODUCTS);

/** 상품에 붙일 뱃지. 신상엔 NEW, 40% 넘는 할인엔 BEST — 그 외엔 안 붙인다 (뱃지가 흔하면 안 보인다) */
function badgeOf(p) {
    if (p.cat === '신상') return 'NEW';
    if (p.discountRate >= 40) return 'BEST';
    return null;
}

/** 실제로 상품이 있는 카테고리만, 정해진 순서대로 */
const CATEGORIES = CATEGORY_ORDER.filter(c => PRODUCTS.some(p => p.cat === c));

/** 1234567 → "1,234,567" */
const formatPrice = (n) => Number(n || 0).toLocaleString('ko-KR');

const byCategory = (cat) => (cat === '전체' ? PRODUCTS : PRODUCTS.filter(p => p.cat === cat));

/**
 * 이름이 같은 상품(색상만 다른 것)은 하나만 남긴다.
 *
 * 예를 들어 '노에러 게임 셔츠'가 색상별로 4개 있는데, 홈 화면 추천 줄에 그 4개가
 * 나란히 뜨면 상품이 하나뿐인 것처럼 보인다. 목록을 짧게 보여주는 자리에서만 쓴다.
 * (스토어 전체 목록에서는 색상별로 다 보여준다 — 거기서는 고르는 게 목적이므로)
 */
function uniqueByName(list, limit = Infinity) {
    const seen = new Set();
    const out = [];
    for (const p of list) {
        if (seen.has(p.name)) continue;
        seen.add(p.name);
        out.push(p);
        if (out.length >= limit) break;
    }
    return out;
}

/**
 * 신상 — 2026SS 먼저, 모자라면 최근 등록된 의류로 채운다.
 * 아웃렛은 넣지 않는다. '신상'이라고 써놓고 재고 정리 상품을 보여주면 앞뒤가 안 맞는다.
 */
const newArrivals = (limit = 10) => uniqueByName(
    [
        ...PRODUCTS.filter(p => p.cat === '신상'),
        ...PRODUCTS.filter(p => p.cat !== '신상' && p.cat !== '아웃렛').sort((a, b) => b.idx - a.idx),
    ],
    limit
);

/** 할인 폭이 큰 순 — 아웃렛 화면과 홈 특가 줄에 쓴다 */
const bestDeals = (limit = 10) => uniqueByName(
    PRODUCTS.filter(p => p.discountRate >= 20 && !p.soldOut)
        .sort((a, b) => b.discountRate - a.discountRate),
    limit
);

/**
 * 장비류 대표 상품 — 옷만 잔뜩 나오는 걸 막는다.
 *
 * 카테고리를 그냥 이어 붙이면 목록 앞쪽이 전부 라켓으로 채워져서(라켓이 8개나 있다)
 * "장비"라고 해놓고 라켓만 보여주게 된다. 그래서 한 개씩 번갈아 뽑는다.
 */
const gearPicks = (limit = 6) => {
    const groups = ['라켓', '신발', '가방', '셔틀콕']
        .map(c => uniqueByName(PRODUCTS.filter(p => p.cat === c)));
    const out = [];
    for (let round = 0; out.length < limit; round += 1) {
        // 이번 바퀴에 아무것도 못 뽑았으면 더 뽑을 게 없다
        if (groups.every(g => round >= g.length)) break;
        for (const g of groups) {
            if (g[round] && out.length < limit) out.push(g[round]);
        }
    }
    return out;
};

/** 카테고리별 대표 이미지 (스토어 바로가기 타일에 쓴다) */
function categoryThumb(cat) {
    return PRODUCTS.find(p => p.cat === cat && p.image)?.image || null;
}

/**
 * 상품을 누르면 공식몰의 '그 상품' 페이지를 새 탭으로 연다.
 * 쇼핑몰 첫 화면으로 보내면 방금 본 상품을 다시 찾아야 해서 대부분 그냥 나가버린다.
 * noopener/noreferrer는 새 탭이 원래 탭을 조작하지 못하게 막는 안전장치다.
 */
const openProduct = (p) => {
    if (p?.url) window.open(p.url, '_blank', 'noopener,noreferrer');
};

/** 데이터를 언제 받아왔는지 — 화면 아래에 작게 표시해 '실시간이 아님'을 알린다 */
const FETCHED_AT = catalog.fetchedAt || null;
const SOURCE = catalog.source || 'https://www.pjbsports.com';

export {
    PRODUCTS,
    ALL_PRODUCTS,
    CATEGORIES,
    FETCHED_AT,
    SOURCE,
    formatPrice,
    byCategory,
    uniqueByName,
    newArrivals,
    bestDeals,
    gearPicks,
    categoryThumb,
    openProduct,
    badgeOf,
};
