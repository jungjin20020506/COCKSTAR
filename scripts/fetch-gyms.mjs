// ===================================================================================
// 경기도 체육관 수집 (콕맵용)
// -----------------------------------------------------------------------------------
// 카카오 로컬 API(장소 검색)로 경기도 31개 시·군의 체육관·배드민턴장을 모아
// src/data/gyms.json 으로 저장한다.
//
// 왜 카카오 로컬 API인가
//   · 구글맵·네이버지도·카카오맵을 '크롤링'하는 건 세 곳 모두 이용약관 위반이다.
//     반면 카카오 로컬 API는 카카오가 공식으로 열어둔 창구다.
//   · 앱이 이미 카카오맵 JS 키를 쓰고 있어서 키를 새로 발급받을 필요가 없다.
//
// ⚠️ 인증 방법이 특이하다
//   REST 호출인데도 JS 앱키를 쓰려면 Authorization 말고 KA 헤더가 하나 더 필요하다.
//   KA 헤더에 origin(또는 os) 정보가 없으면 401이 난다. 문서에 잘 안 드러나 있어서
//   처음엔 "키가 잘못됐나" 하고 헤매기 쉽다.
//
// ⚠️ 이 API가 주지 않는 것 — 운영시간, 요금, 동호회 정보.
//   그래서 각 체육관의 카카오맵 상세 링크(place_url)를 함께 저장한다.
//   운영시간을 지어내느니 "카카오맵에서 확인" 버튼을 다는 게 정직하다.
//   (문 닫은 체육관에 헛걸음시키는 것보다 낫다)
//
// 실행: npm run fetch:gyms          이어받기 (기본)
//       npm run fetch:gyms -- --force  전체 다시 받기
// ===================================================================================

import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../src/data/gyms.json');

// index.html 에 박혀 있는 카카오맵 JS 앱키와 같은 값
const KAKAO_KEY = process.env.KAKAO_KEY || '4bebedd2921e9ecf2412417b5b35762e';

// ★ origin 은 카카오 개발자센터에 '등록된 웹 도메인'과 정확히 같아야 한다.
//   아무 주소나 적으면 401 "domain mismatched" 가 난다. (KA 헤더를 아예 빼도 401)
//   배포 도메인이 바뀌면 아래 값이나 환경변수 KAKAO_ORIGIN 을 함께 고칠 것.
const KAKAO_ORIGIN = process.env.KAKAO_ORIGIN || 'https://cockstar.vercel.app';
const HEADERS = {
    Authorization: `KakaoAK ${KAKAO_KEY}`,
    KA: `sdk/1.0.0 os/javascript origin/${KAKAO_ORIGIN}`,
};

/** 경기도 31개 시·군 */
const REGIONS = [
    '수원시', '성남시', '고양시', '용인시', '부천시', '안산시', '안양시', '남양주시',
    '화성시', '평택시', '의정부시', '시흥시', '파주시', '광명시', '김포시', '군포시',
    '광주시', '이천시', '양주시', '오산시', '구리시', '안성시', '포천시', '의왕시',
    '하남시', '여주시', '양평군', '동두천시', '과천시', '가평군', '연천군',
];

/**
 * 검색어. 배드민턴을 앞에 두되 일반 체육관도 훑는다.
 * (배드민턴은 전용 구장보다 종합체육관·생활체육관에서 치는 경우가 훨씬 많다)
 */
const KEYWORDS = ['배드민턴장', '배드민턴클럽', '체육관', '국민체육센터', '생활체육관'];

const CONCURRENCY = 3;
const DELAY_MS = 120;
const nap = (ms) => new Promise(r => setTimeout(r, ms));

async function kakaoSearch(query, page) {
    const url = `https://dapi.kakao.com/v2/local/search/keyword.json`
        + `?query=${encodeURIComponent(query)}&size=15&page=${page}`;
    let wait = 1000;
    for (let attempt = 0; attempt < 4; attempt += 1) {
        const res = await fetch(url, { headers: HEADERS });
        if (res.ok) return res.json();
        if (res.status === 429 || res.status >= 500) { await nap(wait); wait *= 2; continue; }
        throw new Error(`HTTP ${res.status} ${await res.text()}`);
    }
    throw new Error('재시도 초과');
}

/**
 * 배드민턴을 칠 만한 곳인지 거른다.
 * '체육관'으로 검색하면 태권도장·헬스장·학교 체육관까지 딸려 오는데,
 * 그대로 지도에 뿌리면 "여기 배드민턴 되나?" 싶은 곳 투성이가 된다.
 */
function looksLikeGym(place) {
    const name = place.place_name || '';
    const cat = place.category_name || '';

    // 시설의 '부속물'은 체육관이 아니다.
    // 카카오에는 '○○체육관 주차장', '○○체육센터 매점'이 별도 장소로 등록돼 있어서
    // 거르지 않으면 지도에 같은 건물이 두세 개씩 찍힌다. (이름 검사보다 먼저 해야 한다 —
    // '배드민턴장 주차장'도 있기 때문)
    if (/주차장|매점|화장실|정문|후문|매표소|셔틀|정류장|버스|출입구/.test(name)) return false;

    // 배드민턴이 이름에 있으면 통과
    if (/배드민턴/.test(name)) return true;

    // 명백히 다른 종목·업종은 제외
    if (/헬스|피트니스|요가|필라테스|골프|당구|볼링|태권도|검도|복싱|주짓수|크로스핏|클라이밍|탁구장|무용|댄스|씨름|사격|승마|퍼스널|아카데미|트릭킹|아크로|체력학원/i.test(name)) return false;
    if (/학원|교습소|사무실|부동산|음식점|카페/.test(cat)) return false;

    // ★ 이름으로만 판단한다.
    //   예전에는 카테고리가 '스포츠시설'이기만 하면 통과시켰는데, 그러면 PT샵·마샬아츠·
    //   경찰체력학원까지 체육관으로 찍힌다. (수원 목록에서만 8곳이 섞여 있었다)
    //   배드민턴을 칠 수 있는 곳은 거의 예외 없이 아래 낱말이 이름에 들어간다.
    return /체육관|체육센터|스포츠센터|생활체육|실내체육|국민체육|체육공원|다목적/.test(name);
}

/**
 * 공설(지자체 운영)인지 사설인지 짐작한다.
 * 이름만으로 100% 맞힐 수는 없어서 화면에는 '추정'임을 밝힌다.
 */
function guessOwnership(place) {
    const name = place.place_name || '';
    if (/국민체육센터|시립|군립|구립|공설|생활체육|문화체육|종합운동장|주민센터|복지관|올림픽|공원|시민/.test(name)) return 'public';
    if (/초등학교|중학교|고등학교|대학교/.test(name)) return 'school';
    return 'private';
}

/** 주소에서 '경기 수원시' 같은 시군 이름을 뽑는다 */
function regionOf(addr) {
    const m = String(addr || '').match(/경기(?:도)?\s+(\S+[시군])/);
    return m ? m[1] : null;
}

async function main() {
    const force = process.argv.includes('--force');

    let seen = new Map();
    if (!force) {
        try {
            const prev = JSON.parse(await readFile(OUT, 'utf8'));
            (prev.gyms || []).forEach(g => seen.set(g.id, g));
            console.log(`이미 받아둔 ${seen.size}곳에 이어서 받습니다\n`);
        } catch { /* 첫 실행 */ }
    }

    const jobs = [];
    for (const region of REGIONS) {
        for (const kw of KEYWORDS) jobs.push(`경기도 ${region} ${kw}`);
    }
    console.log(`검색 ${jobs.length}건 (${REGIONS.length}개 시군 × ${KEYWORDS.length}개 키워드)\n`);

    let done = 0;
    let skipped = 0;
    const queue = [...jobs];

    const worker = async () => {
        while (queue.length) {
            const query = queue.shift();
            try {
                // 카카오는 한 검색어당 최대 45곳(15 × 3페이지)까지만 준다
                for (let page = 1; page <= 3; page += 1) {
                    const data = await kakaoSearch(query, page);
                    for (const place of data.documents || []) {
                        const addr = place.road_address_name || place.address_name || '';
                        // 검색어에 지역을 넣어도 옆 동네가 섞여 나온다 → 주소로 한 번 더 거른다
                        if (!/^경기/.test(addr)) { skipped += 1; continue; }
                        if (!looksLikeGym(place)) { skipped += 1; continue; }
                        if (seen.has(place.id)) continue;
                        seen.set(place.id, {
                            id: place.id,
                            name: place.place_name,
                            address: addr,
                            region: regionOf(addr),
                            phone: place.phone || null,
                            ownership: guessOwnership(place),
                            // 좌표는 소수점 6자리면 약 10cm 정확도다. 그대로 두면
                            // 한 곳당 30바이트씩 낭비되고 1,000곳이면 무시 못 할 크기가 된다.
                            lat: Number(Number(place.y).toFixed(6)),
                            lng: Number(Number(place.x).toFixed(6)),
                            // 카카오맵 주소는 id 로 만들 수 있으므로 저장하지 않는다 (lib/places.js 참고)
                        });
                    }
                    if (data.meta?.is_end) break;
                    await nap(DELAY_MS);
                }
            } catch (e) {
                console.error(`  ! ${query} → ${e.message}`);
            }
            done += 1;
            if (done % 20 === 0) console.log(`  ${done}/${jobs.length} … 누적 ${seen.size}곳`);
            await nap(DELAY_MS);
        }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));

    const gyms = [...seen.values()].sort((a, b) =>
        (a.region || '').localeCompare(b.region || '', 'ko') || a.name.localeCompare(b.name, 'ko')
    );

    const byRegion = {};
    const byOwnership = {};
    gyms.forEach(g => {
        byRegion[g.region || '기타'] = (byRegion[g.region || '기타'] || 0) + 1;
        byOwnership[g.ownership] = (byOwnership[g.ownership] || 0) + 1;
    });

    await mkdir(dirname(OUT), { recursive: true });
    await writeFile(OUT, JSON.stringify({
        fetchedAt: new Date().toISOString(),
        source: 'Kakao Local API',
        count: gyms.length,
        byRegion,
        byOwnership,
        gyms,
    }, null, 1) + '\n', 'utf8');

    console.log(`\n완료 — 체육관 ${gyms.length}곳 (관련 없어 걸러낸 결과 ${skipped}건)`);
    console.log('구분:', JSON.stringify(byOwnership));
    console.log('배드민턴 이름 포함:', gyms.filter(g => /배드민턴/.test(g.name)).length + '곳');
    console.log(`\n→ ${OUT}`);
}

main().catch(e => { console.error('수집 실패:', e); process.exit(1); });
