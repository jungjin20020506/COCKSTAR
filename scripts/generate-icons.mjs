#!/usr/bin/env node
// ===================================================================================
// 앱 아이콘 생성기 — 코드로 그린다
// -----------------------------------------------------------------------------------
// 왜 코드인가:
//   · 로고를 고칠 때마다 그림판을 열 필요가 없다. 숫자 하나 바꾸고 다시 돌리면 된다
//   · 192/512/180/32 를 항상 같은 그림으로, 같은 정렬로 뽑는다
//   · 저장소에 원본(이 파일)이 남는다. PNG 만 있으면 누가 어떻게 만들었는지 모른다
//
// 왜 외부 라이브러리가 없는가:
//   PNG 는 zlib 압축 + CRC 만 있으면 만들 수 있고, 둘 다 Node 에 들어 있다.
//   sharp/canvas 같은 네이티브 모듈은 윈도우에서 설치가 자주 깨진다.
//
// 계단현상은 4x4 초과표본(supersampling)으로 없앤다. 픽셀 하나를 16번 찍어보고
// 몇 번 도형 안에 들어갔는지로 투명도를 정한다.
//
// 실행:  node scripts/generate-icons.mjs
// ===================================================================================

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public');

// ── 브랜드 색 (tailwind.config.js 와 같은 값) ──
const VOLT = [0xCD, 0xFB, 0x47];
const INK = [0x08, 0x09, 0x0C];

// ===================================================================================
// PNG 인코더
// ===================================================================================
const CRC_TABLE = (() => {
    const t = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
        t[n] = c;
    }
    return t;
})();

function crc32(buf) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
}

/** RGBA 픽셀 버퍼 → PNG 파일 내용 */
function encodePng(width, height, rgba) {
    const stride = width * 4;
    // 각 줄 앞에 필터 바이트(0 = 필터 없음)를 붙인다 — PNG 규격이 요구한다
    const raw = Buffer.alloc((stride + 1) * height);
    for (let y = 0; y < height; y++) {
        raw[y * (stride + 1)] = 0;
        rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
    }
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8;    // bit depth
    ihdr[9] = 6;    // color type 6 = RGBA
    ihdr[10] = 0;   // compression
    ihdr[11] = 0;   // filter
    ihdr[12] = 0;   // interlace
    return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
        chunk('IHDR', ihdr),
        chunk('IDAT', deflateSync(raw, { level: 9 })),
        chunk('IEND', Buffer.alloc(0)),
    ]);
}

// ===================================================================================
// 도형 — 좌표는 0~1 단위계다 (크기와 무관하게 같은 그림이 나온다)
// ===================================================================================

const insideCircle = (x, y, cx, cy, r) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;

const insideRing = (x, y, cx, cy, r, w) => {
    const d = Math.hypot(x - cx, y - cy);
    return d <= r + w / 2 && d >= r - w / 2;
};

/** 볼록 다각형 안인가 (점들이 시계/반시계 한 방향으로 정렬돼 있어야 한다) */
function insidePolygon(x, y, pts) {
    let sign = 0;
    for (let i = 0; i < pts.length; i++) {
        const [ax, ay] = pts[i];
        const [bx, by] = pts[(i + 1) % pts.length];
        const cross = (bx - ax) * (y - ay) - (by - ay) * (x - ax);
        if (cross === 0) continue;
        const s = cross > 0 ? 1 : -1;
        if (sign === 0) sign = s;
        else if (s !== sign) return false;
    }
    return true;
}

/** 모서리가 둥근 사각형 (0~1 좌표계 전체) */
function insideRoundedSquare(x, y, radius) {
    if (x < 0 || x > 1 || y < 0 || y > 1) return false;
    const cx = Math.min(Math.max(x, radius), 1 - radius);
    const cy = Math.min(Math.max(y, radius), 1 - radius);
    return (x - cx) ** 2 + (y - cy) ** 2 <= radius * radius;
}

// ===================================================================================
// 셔틀콕 마크
// -----------------------------------------------------------------------------------
// 앱 안의 SVG 로고(CockstarMark)와 같은 비율로 맞췄다. 아이콘과 앱 화면의 로고가
// 다르게 생기면 "이 앱 맞나?" 하는 미세한 위화감이 남는다.
//
// 작은 크기(48px)에서 읽히는 게 최우선이라 선이 아니라 '면'으로 그린다.
// 얇은 선은 홈 화면에서 뭉개져서 회색 얼룩이 된다.
// ===================================================================================

/** 코르크(공) — 마크의 무게중심 */
const CORK = { cx: 0.5, cy: 0.715, r: 0.138 };

// ── 깃털 치마 — 아래가 좁고 위로 벌어지는 원뿔 ──
// 처음에는 깃털 5장을 따로따로 그렸는데, 작게 줄이니 깃털 사이 틈만 보여서
// 거미나 왕관처럼 읽혔다. 실제 셔틀콕은 깃털이 서로 겹쳐 '하나의 면'을 이룬다.
// 그래서 통짜 원뿔로 그리고, 그 위에 바탕색 선을 그어 깃털을 나눈다.
const SKIRT = {
    yTop: 0.200,
    yBase: 0.665,
    halfTop: 0.355,
    halfBase: 0.132,
};

function skirtHalfWidth(y) {
    const t = (y - SKIRT.yTop) / (SKIRT.yBase - SKIRT.yTop);
    return SKIRT.halfTop + (SKIRT.halfBase - SKIRT.halfTop) * t;
}

function insideSkirt(x, y) {
    if (y < SKIRT.yTop || y > SKIRT.yBase) return false;
    return Math.abs(x - SKIRT.cx0) <= skirtHalfWidth(y);
}
SKIRT.cx0 = 0.5;

/** 깃털을 나누는 칼금 — 코르크 중심에서 밖으로 뻗는 가는 선 (바탕색으로 판다) */
const SPLIT_ANGLES = [-38, -13, 13, 38];

function splitPolygon(angleDeg) {
    const a = (angleDeg * Math.PI) / 180;
    const dir = [Math.sin(a), -Math.cos(a)];
    const perp = [-dir[1], dir[0]];
    const from = 0.13;
    const to = 0.62;
    const halfNear = 0.008;
    const halfFar = 0.013;   // 위로 갈수록 아주 살짝 벌어진다 — 깃털이 퍼지는 느낌
    const bx = CORK.cx + dir[0] * from;
    const by = CORK.cy + dir[1] * from;
    const tx = CORK.cx + dir[0] * to;
    const ty = CORK.cy + dir[1] * to;
    return [
        [bx - perp[0] * halfNear, by - perp[1] * halfNear],
        [tx - perp[0] * halfFar, ty - perp[1] * halfFar],
        [tx + perp[0] * halfFar, ty + perp[1] * halfFar],
        [bx + perp[0] * halfNear, by + perp[1] * halfNear],
    ];
}

const SPLITS = SPLIT_ANGLES.map(splitPolygon);

/** 깃털을 묶는 실 — 치마를 가로지르는 가는 띠 (역시 바탕색으로 판다) */
const BAND = { y: 0.455, w: 0.022 };

/** 잉크로 칠할 영역인가 */
function markInk(x, y) {
    if (insideCircle(x, y, CORK.cx, CORK.cy, CORK.r)) return true;
    if (insideSkirt(x, y)) return true;
    return false;
}

/** 잉크에서 다시 파낼 영역인가 (깃털 칼금 · 실) */
function markCut(x, y) {
    for (const poly of SPLITS) if (insidePolygon(x, y, poly)) return true;
    if (Math.abs(y - BAND.y) <= BAND.w / 2 && Math.abs(x - 0.5) <= skirtHalfWidth(y) + 0.02) return true;
    return false;
}

function markCoverage(x, y) {
    if (!markInk(x, y)) return false;
    // 코르크 안은 절대 파지 않는다 — 마크의 무게중심이라 여기가 뚫리면 흐물흐물해진다
    if (insideCircle(x, y, CORK.cx, CORK.cy, CORK.r * 0.94)) return true;
    return !markCut(x, y);
}

// ===================================================================================
// 렌더링
// ===================================================================================

/**
 * @param {number} size 픽셀
 * @param {object} opts
 * @param {boolean} opts.rounded 모서리를 둥글게 자를지 (false = 꽉 채움)
 * @param {number} opts.markScale 마크 크기 (1 = 캔버스 전체, 0.68 = 안전영역)
 */
function renderIcon(size, { rounded = false, markScale = 0.68 } = {}) {
    const SS = 4;                      // 한 변당 4번 → 픽셀당 16번 찍는다
    const rgba = Buffer.alloc(size * size * 4);
    const step = 1 / (size * SS);
    const half = step / 2;

    for (let py = 0; py < size; py++) {
        for (let px = 0; px < size; px++) {
            let bgHits = 0;
            let markHits = 0;

            for (let sy = 0; sy < SS; sy++) {
                for (let sx = 0; sx < SS; sx++) {
                    const x = (px * SS + sx) * step + half;
                    const y = (py * SS + sy) * step + half;

                    const inBg = rounded ? insideRoundedSquare(x, y, 0.22) : true;
                    if (inBg) bgHits++;

                    // 마크는 가운데에 markScale 배로 놓는다.
                    // 마스크 아이콘(안드로이드)은 바깥 20%가 잘려 나갈 수 있어서
                    // 마크가 안전영역 안에 들어와야 한다.
                    const mx = (x - 0.5) / markScale + 0.5;
                    const my = (y - 0.5) / markScale + 0.5;
                    if (inBg && markCoverage(mx, my)) markHits++;
                }
            }

            const total = SS * SS;
            const bgA = bgHits / total;
            const markA = markHits / total;

            // 볼트 바탕 위에 잉크 마크 — 홈 화면에서 가장 멀리서도 보이는 조합이다
            const r = VOLT[0] * (1 - markA) + INK[0] * markA;
            const g = VOLT[1] * (1 - markA) + INK[1] * markA;
            const b = VOLT[2] * (1 - markA) + INK[2] * markA;

            const i = (py * size + px) * 4;
            rgba[i] = Math.round(r);
            rgba[i + 1] = Math.round(g);
            rgba[i + 2] = Math.round(b);
            rgba[i + 3] = Math.round(bgA * 255);
        }
    }
    return encodePng(size, size, rgba);
}

// ===================================================================================
// SVG — 브라우저 탭 아이콘용 (해상도에 상관없이 선명하다)
// ===================================================================================
function renderSvg() {
    const n = (v) => (v * 100).toFixed(2);
    const poly = (pts) => pts.map(([x, y]) => `${n(x)},${n(y)}`).join(' ');
    const skirt = poly([
        [0.5 - SKIRT.halfTop, SKIRT.yTop],
        [0.5 + SKIRT.halfTop, SKIRT.yTop],
        [0.5 + SKIRT.halfBase, SKIRT.yBase],
        [0.5 - SKIRT.halfBase, SKIRT.yBase],
    ]);
    const cuts = SPLITS.map(p => `<polygon points="${poly(p)}" fill="#CDFB47"/>`).join('\n      ');
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <rect width="100" height="100" rx="22" fill="#CDFB47"/>
  <g transform="translate(50 50) scale(0.68) translate(-50 -50)">
    <polygon points="${skirt}" fill="#08090C"/>
    <g>
      ${cuts}
      <rect x="${n(0.5 - SKIRT.halfTop)}" y="${n(BAND.y - BAND.w / 2)}" width="${n(SKIRT.halfTop * 2)}" height="${n(BAND.w)}" fill="#CDFB47"/>
    </g>
    <circle cx="${n(CORK.cx)}" cy="${n(CORK.cy)}" r="${n(CORK.r)}" fill="#08090C"/>
  </g>
</svg>
`;
}

// ===================================================================================
// 실행
// ===================================================================================
mkdirSync(OUT, { recursive: true });

const targets = [
    // 안드로이드/PWA — 꽉 채운다. maskable 로 쓰이면 OS 가 알아서 모서리를 자른다
    { file: 'icon-192.png', size: 192, rounded: false, markScale: 0.74 },
    { file: 'icon-512.png', size: 512, rounded: false, markScale: 0.74 },
    // iOS 홈 화면 — iOS 는 자기 모양(스퀘어클)으로 자르므로 역시 꽉 채운다
    { file: 'apple-touch-icon.png', size: 180, rounded: false, markScale: 0.74 },
    // 브라우저 탭 — 작아서 마크를 조금 더 키운다
    { file: 'favicon-32.png', size: 32, rounded: true, markScale: 0.80 },
    { file: 'favicon-64.png', size: 64, rounded: true, markScale: 0.80 },
    // 기존 파일 이름도 유지 (index.html 이 참조하던 것)
    { file: 'logo.png', size: 512, rounded: true, markScale: 0.74 },
];

for (const t of targets) {
    const png = renderIcon(t.size, { rounded: t.rounded, markScale: t.markScale });
    writeFileSync(join(OUT, t.file), png);
    console.log(`  ✓ ${t.file.padEnd(24)} ${t.size}x${t.size}  ${(png.length / 1024).toFixed(1)}KB`);
}

writeFileSync(join(OUT, 'icon.svg'), renderSvg());
console.log('  ✓ icon.svg');
console.log('\n아이콘 생성 완료 — public/ 에 저장했습니다.');
