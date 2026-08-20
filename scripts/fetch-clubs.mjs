// ===================================================================================
// 경기도 배드민턴 동호회(모임) 수집 — 콕맵용
// -----------------------------------------------------------------------------------
// 소모임(somoim.co.kr)의 '지역 × 배드민턴' 검색 페이지를 읽어
// src/data/clubs.json 으로 저장한다.
//
// 왜 소모임만 쓰는가 — 다른 곳은 못 쓰거나 쓰면 안 된다
//   · 소모임  : robots.txt 가 `Allow: /` 이고, 지역별 검색 페이지가 sitemap.xml 에
//               정식으로 등록돼 있다. 즉 "크롤링해서 색인하라"고 열어둔 페이지다.
//   · 당근    : robots.txt 가 ClaudeBot·anthropic-ai 를 이름으로 지목해 차단한다.
//               명시적인 거부 의사이므로 수집하지 않는다.
//   · 네이버 카페 / 구글 / 지도 3사 : 이용약관에서 자동 수집을 금지한다.
//
// ⚠️ 이 데이터는 '전수'가 아니다 — 두 겹으로 일부다.
//   ① 소모임에 등록된 모임만 나온다. 네이버 카페·밴드에만 있는 동호회(오히려 이쪽이
//      훨씬 많다)는 여기 안 잡힌다.
//   ② 소모임의 공개 검색 페이지는 지역을 바꿔도 '배드민턴' 상위 50개를 똑같이 준다.
//      지역별 필터는 앱 안에서만 도는 것으로 보인다. 그래서 최대 50개다.
//      (31개 지역 URL을 다 돌아봤지만 결과가 전부 같았다)
//   화면에는 출처와 "일부"임을 반드시 밝힌다. 숫자를 부풀리면
//   "우리 동네 모임이 왜 없냐"는 오해만 산다.
//
// 실행: npm run fetch:clubs
// ===================================================================================

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../src/data/clubs.json');
const ORIGIN = 'https://www.somoim.co.kr';
const SITEMAP = `${ORIGIN}/sitemap/kr/search/sitemap-kr-search.xml.gz`;

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Accept-Language': 'ko-KR,ko;q=0.9',
};

const CONCURRENCY = 2;
const DELAY_MS = 400;
const nap = (ms) => new Promise(r => setTimeout(r, ms));

async function get(url) {
    let wait = 1500;
    for (let attempt = 0; attempt < 4; attempt += 1) {
        const res = await fetch(url, { headers: HEADERS });
        if (res.ok) return res;
        if (res.status === 429 || res.status >= 500) { await nap(wait); wait *= 2; continue; }
        throw new Error(`HTTP ${res.status}`);
    }
    throw new Error('재시도 초과');
}

/** 태그를 걷어내고 남은 글자 조각들 */
function textParts(html) {
    return html
        .replace(/<[^>]+>/g, '\n')
        .replace(/&quot;/g, '"').replace(/&amp;/g, '&')
        .replace(/&#x27;|&apos;/g, "'").replace(/&nbsp;/g, ' ')
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .split('\n')
        .map(s => s.trim())
        .filter(Boolean);
}

/**
 * 검색 결과 페이지에서 모임 카드를 뽑는다.
 *
 * 카드는 `<a href="/{uuid}">…</a>` 한 덩어리다. 안쪽에 이미지 마크업이 잔뜩 있어서
 * 태그를 다 걷어낸 뒤 남는 글자만 본다. 보통 [이름, 소개, 지역, 멤버수] 순으로 나온다.
 * 소모임이 마크업을 바꾸면 이 부분이 먼저 깨지므로, 못 읽으면 조용히 건너뛴다.
 */
function parseCards(html, urlRegion) {
    const re = /<a\s[^>]*href="(\/[0-9a-f]{8}-[0-9a-f-]{10,})"[\s\S]*?<\/a>/g;
    const out = [];
    for (const m of html.matchAll(re)) {
        const id = m[1].slice(1);
        const parts = textParts(m[0]).filter(s => s !== '모임 대표 이미지');
        if (parts.length === 0) continue;

        const name = parts[0];
        if (!name || name.length > 60) continue;

        // 멤버 수는 '멤버 32' 또는 숫자만 오는 등 형태가 들쭉날쭉하다
        const memberText = parts.find(s => /멤버|명$/.test(s)) || '';
        const memberNum = Number((memberText.match(/(\d+)/) || [])[1]);

        // 지역 표기는 '수원시 영통구' 처럼 온다.
        // 느슨하게 '시/군/구가 들어간 줄'로 잡으면 모임 소개글의 '- 정모시간 : 월요일…'
        // 같은 문장까지 지역으로 둔갑한다. 그래서 지역 이름 모양을 정확히 요구한다.
        const AREA_RE = /^(?:서울|경기|인천|부산|대구|광주|대전|울산|세종|강원|충북|충남|전북|전남|경북|경남|제주)?\s*[가-힣]{2,10}[시군구](?:\s+[가-힣]{2,10}[시군구])?$/;
        const areaText = parts.find(s => s !== name && s.length <= 20 && AREA_RE.test(s)) || null;

        out.push({
            id,
            name,
            description: parts.slice(1).find(s => s.length > 10 && s !== areaText) || null,
            // 지역은 카드에 찍힌 값을 쓴다.
            // 검색 URL의 지역은 결과에 반영되지 않아서(위 주석 ② 참고) 그걸 믿으면
            // 안산 모임이 가평 모임으로 둔갑한다.
            region: areaText || urlRegion,
            members: Number.isFinite(memberNum) ? memberNum : null,
            url: `${ORIGIN}/${id}`,
        });
    }
    return out;
}

async function main() {
    process.stdout.write('소모임 사이트맵 읽는 중... ');
    const buf = Buffer.from(await (await get(SITEMAP)).arrayBuffer());
    let xml;
    try { xml = zlib.gunzipSync(buf).toString('utf8'); } catch { xml = buf.toString('utf8'); }

    // 경기도 × 배드민턴 검색 페이지만 고른다
    const targets = [...xml.matchAll(/<loc>\s*(.*?)\s*<\/loc>/g)]
        .map(m => m[1])
        .filter(u => {
            const d = decodeURIComponent(u);
            return d.includes('/groups/search/경기도/') && d.endsWith('/배드민턴');
        });
    console.log(`경기도 지역 ${targets.length}곳\n`);

    const clubs = [];
    const seen = new Set();
    let done = 0;
    const queue = [...targets];

    const worker = async () => {
        while (queue.length) {
            const url = queue.shift();
            const urlRegion = decodeURIComponent(url).split('/groups/search/경기도/')[1].replace('/배드민턴', '');
            try {
                const html = await (await get(url)).text();
                for (const c of parseCards(html, urlRegion)) {
                    if (seen.has(c.id)) continue;   // 같은 모임이 인접 지역에 중복 노출된다
                    seen.add(c.id);
                    clubs.push(c);
                }
            } catch (e) {
                console.error(`  ! ${urlRegion} → ${e.message}`);
            }
            done += 1;
            if (done % 10 === 0) console.log(`  ${done}/${targets.length} … 누적 ${clubs.length}개`);
            await nap(DELAY_MS);
        }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));

    clubs.sort((a, b) => (b.members || 0) - (a.members || 0));

    const byRegion = {};
    clubs.forEach(c => { byRegion[c.region] = (byRegion[c.region] || 0) + 1; });

    await mkdir(dirname(OUT), { recursive: true });
    await writeFile(OUT, JSON.stringify({
        fetchedAt: new Date().toISOString(),
        source: '소모임 (somoim.co.kr)',
        note: '소모임에 등록된 모임만 포함합니다. 전체 동호회의 일부입니다.',
        count: clubs.length,
        byRegion,
        clubs,
    }, null, 1) + '\n', 'utf8');

    console.log(`\n완료 — 모임 ${clubs.length}개`);
    console.log('지역 상위:', Object.entries(byRegion).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${k} ${v}`).join(' / '));
    console.log(`\n→ ${OUT}`);
}

main().catch(e => { console.error('수집 실패:', e); process.exit(1); });
