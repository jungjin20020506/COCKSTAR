// ===================================================================================
// 노에러(NOERROR) 공식몰 상품 수집
// -----------------------------------------------------------------------------------
// 콕스타 스토어 화면에 띄울 실제 상품 데이터를 pjbsports.com에서 받아
// src/data/noerrorProducts.json 으로 저장한다.
//
// 왜 이렇게 하나
//   · 아임웹(imweb)으로 만든 사이트라 상품 페이지마다 JSON-LD(구조화 데이터)가
//     서버에서 그대로 내려온다. 브라우저를 띄울 필요 없이 fetch만으로 읽을 수 있다.
//   · 상품 '목록' 페이지는 이름·가격을 나중에 JS로 채우기 때문에 긁으면 빈 값이 나온다.
//     반드시 개별 상품 페이지(/shop_view/{번호})를 받아야 한다.
//   · 전체 상품 주소는 sitemap.xml에 다 들어 있다.
//   · robots.txt가 수집을 허용한다 (Allow: / — 막힌 건 로그인·장바구니·관리자뿐).
//
// 상대 서버에 부담을 주지 않으려고 동시 요청을 2개로 묶고 사이에 쉬는 시간을 둔다.
// 한 페이지가 400KB 가까이 되므로 전체 한 번 도는 데 몇 분 걸린다.
//
// 실행
//   npm run fetch:products           이어받기 — 아직 안 받은 상품만 (기본)
//   npm run fetch:products -- --force  전체 다시 받기 (가격이 바뀌었을 때)
// ===================================================================================

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ORIGIN = 'https://www.pjbsports.com';
const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../src/data/noerrorProducts.json');

// 평범한 브라우저처럼 보내지 않으면 403으로 막힌다
const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Accept-Language': 'ko-KR,ko;q=0.9',
};

// 상대 서버 배려 — 너무 빨리 두드리면 429(요청 과다)로 막힌다.
// 실제로 연달아 돌렸다가 77건이 429로 실패한 적이 있어서 보수적으로 잡았다.
const CONCURRENCY = 2;
const DELAY_MS = 350;
const MAX_RETRY = 4;
const nap = (ms) => new Promise(r => setTimeout(r, ms));

/**
 * 429/5xx는 잠시 쉬었다가 다시 시도한다. (기다리는 시간을 2배씩 늘린다)
 * 한 번 실패했다고 상품을 통째로 빠뜨리면 화면에 구멍이 생긴다.
 */
async function fetchWithRetry(url) {
    let wait = 1500;
    for (let attempt = 0; attempt <= MAX_RETRY; attempt += 1) {
        const res = await fetch(url, { headers: HEADERS });
        if (res.ok) return res;
        const retryable = res.status === 429 || res.status >= 500;
        if (!retryable || attempt === MAX_RETRY) throw new Error(`HTTP ${res.status}`);
        await nap(wait);
        wait *= 2;
    }
    throw new Error('재시도 초과');
}

/** 상품 페이지 주소 → 상품 번호 */
const idxOf = (url) => Number((url.match(/\/shop_view\/(\d+)/) || [])[1]);

/**
 * 페이지에 박힌 JSON-LD 블록을 전부 꺼낸다.
 * 아임웹은 작은따옴표(type='application/ld+json')를 쓰므로 따옴표를 둘 다 받는다.
 */
function extractLdBlocks(html) {
    const re = /<script[^>]*type=['"]application\/ld\+json['"][^>]*>([\s\S]*?)<\/script>/gi;
    const out = [];
    for (const m of html.matchAll(re)) {
        try { out.push(JSON.parse(m[1].trim())); } catch { /* 깨진 블록은 건너뛴다 */ }
    }
    return out;
}

/**
 * 정가(할인 전 가격)를 찾는다.
 * JSON-LD에는 판매가만 들어 있어서, 취소선으로 찍히는 정가는 HTML에서 따로 긁는다.
 *
 * ⚠️ 아임웹의 클래스 이름이 헷갈린다 — 직관과 반대다.
 *      real_price → 실제로 파는 가격 (47,000원)
 *      sale_price → 취소선 그은 정가 (60,000원)   ← 우리가 찾는 값
 * 못 찾으면 null. 없는 값을 지어내면 "할인 중"이라고 거짓말하는 화면이 된다.
 */
function findOriginalPrice(html, salePrice) {
    const m = html.match(/class=["'][^"']*\bsale_price\b[^"']*["'][^>]*>\s*([\d,]{4,})\s*원/i);
    if (!m) return null;
    const v = Number(m[1].replace(/,/g, ''));
    return Number.isFinite(v) && v > salePrice ? v : null;
}

/**
 * 설명글에서 사람이 읽을 이름·색상·사이즈를 뽑아낸다.
 *
 * 상품명이 'NEGS-W153 (여)' 같은 모델코드라 그대로 쓰면 화면이 암호문이 된다.
 * 다행히 설명글이 아래 형식으로 통일돼 있어서 여기서 진짜 이름을 얻을 수 있다.
 *
 *   [ 제품 설명 ]
 *   노에러 게임 셔츠        ← 이게 사람이 읽는 이름
 *   색    상 : 핑크
 *   사이즈 :  여85~105
 *   원    단 : POLYESTER 90%, SPANDEX 10%
 *
 * JSON-LD로 오면서 줄바꿈이 통째로 사라져 '셔츠색    상 : 핑크'처럼 붙어버리므로,
 * 줄바꿈 대신 항목 이름(색 상 / 사이즈 / 원 단)을 기준으로 잘라낸다.
 * 가방·라켓처럼 형식이 다른 상품도 있으니 못 찾으면 조용히 null을 돌려준다.
 */
function parseDescription(desc) {
    if (!desc) return { title: null, color: null, size: null };

    // 머리말이 상품마다 제각각이다: [ 제품 설명 ] / [ 제품설명 ] / [ 제품 스펙 ] / 제품스펙
    const body = decodeEntities(desc)
        .replace(/^\s*\[?\s*제품\s*(설명|스펙)\s*\]?/, '')
        .trim();

    // 항목 이름들 — 이 앞까지가 상품 이름이고, 이 뒤가 값이다
    const LABELS = '제품명|색\\s*상|사이즈|원\\s*단|소재|중량|무게';

    const grab = (label) => {
        const m = body.match(new RegExp(`${label}\\s*:\\s*(.+?)(?=${LABELS})|${label}\\s*:\\s*(.+)$`));
        const v = (m?.[1] ?? m?.[2] ?? '').trim().replace(/\s+/g, ' ');
        return v || null;
    };

    const color = grab('색\\s*상');
    const size = grab('사이즈');

    // 이름 = 맨 앞부터 첫 항목 이름이 나오기 전까지
    const cut = body.search(new RegExp(`(${LABELS})\\s*:`));
    let title = (cut > 0 ? body.slice(0, cut) : (cut === 0 ? '' : body)).trim().replace(/\s+/g, ' ');
    // 너무 길거나(설명 통째로) 너무 짧으면 이름으로 못 쓴다
    if (title.length > 40 || title.length < 2) title = null;

    return { title, color, size };
}

/** 설명글에 &times; 같은 HTML 엔티티가 섞여 들어온다 — 화면에 그대로 나오면 흉하다 */
function decodeEntities(s) {
    return String(s)
        .replace(/&times;/gi, '×')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&quot;/gi, '"')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>');
}

/**
 * 화면에 쓸 이름을 정한다.
 *
 * 설명글에서 뽑은 이름이 제일 좋지만(예: '노에러 게임 셔츠'), 가방·신발처럼
 * 설명이 스펙표로만 된 상품은 원래 상품명이 오히려 읽기 좋다.
 *   '노에러 미니백, BG-MB01 WH'  → 쉼표 앞만 쓰면 '노에러 미니백'
 *   '프로스펙스 / 스핀오프 PK'    → 그대로 써도 읽힌다
 * 아웃렛 상품명에 붙은 🔥 같은 장식 문자는 떼어낸다.
 */
function pickDisplayName(descTitle, modelCode) {
    if (descTitle) return descTitle;
    const clean = String(modelCode || '').replace(/[🔥🎉★☆]/g, '').trim();
    if (clean.includes(',')) {
        const head = clean.split(',')[0].trim();
        if (head.length >= 2) return head;
    }
    return clean || '노에러 상품';
}

async function fetchProduct(idx) {
    const res = await fetchWithRetry(`${ORIGIN}/shop_view/${idx}`);
    const html = await res.text();

    const blocks = extractLdBlocks(html);
    const product = blocks.find(b => b['@type'] === 'Product');
    if (!product) return null; // 상품이 아닌 페이지(안내글 등)

    const crumb = blocks.find(b => b['@type'] === 'BreadcrumbList');
    // 빵부스러기의 첫 칸이 카테고리다. &nbsp; 가 섞여 들어오므로 정리한다.
    const category = crumb?.itemListElement?.[0]?.name
        ?.replace(/&nbsp;| /g, ' ')
        .replace(/\s+/g, ' ')
        .trim() || '기타';

    // ★ 대리점 회원 전용 상품은 아예 담지 않는다.
    //   B2B 도매가라서 일반 회원에게 보이면 안 되고, 앱 번들에 들어가면 누구나 열어볼 수
    //   있게 된다. 화면에서 거르는 것보다 아예 안 가져오는 게 확실하다.
    if (category.includes('대리점')) return { dealerOnly: true };

    const price = Number(product.offers?.price);
    const soldOut = /OutOfStock|SoldOut/i.test(product.offers?.availability || '');
    const rawDesc = String(product.description || '').trim();
    const parsed = parseDescription(rawDesc);
    const modelCode = String(product.name || '').replace(/[🔥🎉★☆]/g, '').trim();

    return {
        idx,
        // 화면에 쓸 이름은 설명글에서 뽑은 것을 우선한다 (모델코드는 따로 보관)
        name: pickDisplayName(parsed.title, product.name),
        modelCode,
        brand: product.brand?.name || 'NOERROR',
        category,
        color: parsed.color,
        size: parsed.size,
        price: Number.isFinite(price) ? price : null,
        originalPrice: Number.isFinite(price) ? findOriginalPrice(html, price) : null,
        soldOut,
        // 첫 장이 대표 이미지. 배열이 아닌 경우도 방어한다.
        images: (Array.isArray(product.image) ? product.image : [product.image]).filter(Boolean).slice(0, 3),
        description: decodeEntities(rawDesc).replace(/\s+/g, ' ').slice(0, 200),
        url: `${ORIGIN}/shop_view/${idx}`,
    };
}

/**
 * 이미 받아둔 파일을 읽는다. 없으면 빈 목록.
 * 기본은 '이어받기' — 이미 있는 상품은 건너뛴다. 429로 중간에 끊겨도 다시 돌리면
 * 빠진 것만 채운다. 가격까지 전부 새로 받고 싶으면 --force 를 붙인다.
 */
async function loadExisting() {
    try {
        const { readFile } = await import('node:fs/promises');
        const json = JSON.parse(await readFile(OUT, 'utf8'));
        return {
            products: Array.isArray(json.products) ? json.products : [],
            // 대리점 전용으로 확인된 번호도 기억해 둔다. 저장은 안 하지만 다시 받을 필요도 없다.
            skipIdx: Array.isArray(json.skipIdx) ? json.skipIdx : [],
        };
    } catch { return { products: [], skipIdx: [] }; }
}

async function main() {
    const force = process.argv.includes('--force');

    process.stdout.write('사이트맵 읽는 중... ');
    const xml = await (await fetchWithRetry(`${ORIGIN}/sitemap.xml`)).text();
    const allIdx = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)]
        .map(m => m[1])
        .filter(u => u.includes('/shop_view/'))
        .map(idxOf)
        .filter(Number.isFinite);
    console.log(`상품 ${allIdx.length}개 발견`);

    const prev = force ? { products: [], skipIdx: [] } : await loadExisting();
    const have = new Set([...prev.products.map(p => p.idx), ...prev.skipIdx]);
    const idxList = allIdx.filter(i => !have.has(i));
    console.log(force
        ? '전체 다시 받습니다 (--force)\n'
        : `이미 확인한 ${have.size}개는 건너뜁니다 → ${idxList.length}개만 받습니다\n`);

    const products = [...prev.products];
    const skipIdx = new Set(prev.skipIdx);
    const failed = [];
    let dealerOnly = 0;
    let done = 0;

    // 동시 요청을 CONCURRENCY개로 제한한다 (상대 서버 배려)
    const queue = [...idxList];
    const worker = async () => {
        while (queue.length) {
            const idx = queue.shift();
            try {
                const p = await fetchProduct(idx);
                if (p?.dealerOnly) { dealerOnly += 1; skipIdx.add(idx); }
                else if (!p) skipIdx.add(idx); // 상품이 아닌 페이지
                else if (p && p.name && p.price) products.push(p);
            } catch (e) {
                failed.push({ idx, reason: e.message });
            }
            done += 1;
            if (done % 25 === 0) process.stdout.write(`  ${done}/${idxList.length} …\n`);
            await nap(DELAY_MS);
        }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));

    products.sort((a, b) => b.idx - a.idx); // 최신 등록 순

    const byCategory = {};
    products.forEach(p => { byCategory[p.category] = (byCategory[p.category] || 0) + 1; });

    await mkdir(dirname(OUT), { recursive: true });
    await writeFile(OUT, JSON.stringify({
        fetchedAt: new Date().toISOString(),
        source: ORIGIN,
        count: products.length,
        byCategory,
        // 상품이 아니거나 대리점 전용이라 담지 않은 번호 — 다음 실행에서 건너뛴다
        skipIdx: [...skipIdx].sort((a, b) => a - b),
        products,
    }, null, 1) + '\n', 'utf8');

    console.log(`\n완료 — 상품 ${products.length}개 저장 (대리점 전용 ${dealerOnly}개는 제외)`);
    console.log(Object.entries(byCategory).map(([k, v]) => `  ${k}: ${v}`).join('\n'));
    console.log(`\n할인 중 ${products.filter(p => p.originalPrice).length}개 · 품절 ${products.filter(p => p.soldOut).length}개`);
    if (failed.length) console.log(`\n실패 ${failed.length}건: ${failed.slice(0, 5).map(f => f.idx).join(', ')}…`);
    console.log(`\n→ ${OUT}`);
}

main().catch(e => { console.error('수집 실패:', e); process.exit(1); });
