// ===================================================================================
// 자랑 카드 — 선수가 인스타그램에 올리고 싶어지는 오늘의 기록
// -----------------------------------------------------------------------------------
// 기존 '하루 요약 카드'는 관리자용이었다. 방 전체의 참석부 같은 물건이라
// 개인이 스토리에 올릴 만한 그림이 아니었다 (남의 이름이 잔뜩 들어간다).
//
// 이건 정반대다. 주인공이 한 명이고, 숫자가 크고, 세로 9:16 이다.
//   · 인스타 스토리 규격(1080x1920) — 올릴 때 잘리지 않는다
//   · 이름과 오늘 경기 수가 화면의 절반을 차지한다
//   · 방 안 등수·만난 사람 수·코트에 선 시간처럼 '자랑할 거리'를 숫자로 만든다
//   · 테마 3종 — 매번 같은 그림이면 두 번째부터 안 올린다
//
// 왜 화면 캡처가 아니라 캔버스인가: 캡처는 기기마다 크기·잘림·상태바가 다 다르고,
// 스크롤해야 보이는 부분은 아예 안 담긴다. 그려서 만들면 누구 폰에서든 같은 그림이다.
// ===================================================================================

import type { Player } from '../types';

export interface BragStat {
    name: string;
    level: string;
    roomName: string;
    date: Date;
    games: number;
    /** 방 안에서 몇 등인가 (경기 수 기준) */
    rank: number;
    totalPlayers: number;
    /** 오늘 코트에서 만난 사람 수 (중복 제외) */
    metCount: number;
    /** 코트에 서 있던 시간(분) — 한 경기 12분으로 어림잡는다 */
    minutes: number;
    /** 오늘 함께 친 사람 이름 */
    partners: string[];
    /** 방에서 가장 많이 친 사람인가 */
    isAce: boolean;
}

// ── 테마 ──
export interface Theme {
    key: string;
    label: string;
    bg: string;
    accent: string;
    accent2: string;
    text: string;
    dim: string;
    card: string;
}

export const THEMES: Theme[] = [
    { key: 'neon', label: '네온', bg: '#08090C', accent: '#CDFB47', accent2: '#7FE7C4', text: '#F3F5F8', dim: '#8C93A1', card: '#171A21' },
    { key: 'blaze', label: '블레이즈', bg: '#12060A', accent: '#FF6A52', accent2: '#FFC53D', text: '#FFF4F0', dim: '#B08D86', card: '#241014' },
    { key: 'court', label: '코트', bg: '#04140F', accent: '#39E58C', accent2: '#CDFB47', text: '#EAFBF3', dim: '#7FA394', card: '#0B241B' },
];

/** 한 경기에 걸리는 대략의 시간(분). 21점 복식 한 판이 보통 이 정도다. */
const MINUTES_PER_GAME = 12;

/**
 * 한 선수의 오늘 기록을 계산한다.
 *
 * 경기 수는 화면에 찍히는 값(todayGames)을 그대로 쓴다. 카드가 화면과 다른 숫자를
 * 말하면 아무도 안 믿는다. (관리자가 손으로 보정한 경우도 그 의도를 존중하게 된다)
 */
export function computeBragStat(
    me: Player,
    players: Record<string, Player>,
    roomName = '',
): BragStat {
    const humans = Object.values(players || {}).filter(p => p && p.name && !p.isBot);
    const gamesOf = (p: Player) => Math.max(0, p.todayGames || 0);
    const myGames = gamesOf(me);

    // 등수 — 나보다 많이 친 사람 수 + 1 (동점이면 같은 등수)
    const rank = humans.filter(p => gamesOf(p) > myGames).length + 1;

    // 오늘 만난 사람 (같은 팀이었든 상대였든 '만난 것'으로 본다 —
    // 코트에 들어가면 팀을 다시 짜는 게 보통이라 팀/상대 구분은 실제로 의미가 없다)
    const met = new Set<string>();
    (me.todayRecentGames || []).forEach(g => {
        if (!g || g.isManual) return;
        [...(g.partners || []), ...(g.opponents || [])].forEach(id => { if (id) met.add(id); });
    });

    const partnerNames = [...met]
        .map(id => players[id]?.name)
        .filter((n): n is string => !!n);

    const topGames = humans.reduce((m, p) => Math.max(m, gamesOf(p)), 0);

    return {
        name: me.name || '선수',
        level: me.level || 'N조',
        roomName,
        date: new Date(),
        games: myGames,
        rank,
        totalPlayers: humans.length,
        metCount: met.size,
        minutes: myGames * MINUTES_PER_GAME,
        partners: partnerNames,
        isAce: myGames > 0 && myGames === topGames,
    };
}

// ===================================================================================
// 그리기
// ===================================================================================

const W = 1080;
const H = 1920;

const font = (weight: number, size: number) =>
    weight + ' ' + size + 'px "Pretendard", "Noto Sans KR", sans-serif';

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    // roundRect 가 없는 구형 웹뷰(구 카카오 인앱 브라우저 등)를 위한 폴백
    if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, w, h, r);
    else ctx.rect(x, y, w, h);
}

function hexToRgb(hex: string): [number, number, number] {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** 배경 분위기 — 테마마다 다른 빛 번짐 */
function paintBackdrop(ctx: CanvasRenderingContext2D, t: Theme) {
    ctx.fillStyle = t.bg;
    ctx.fillRect(0, 0, W, H);

    const glow = (cx: number, cy: number, r: number, hex: string, alpha: number) => {
        const [rr, gg, bb] = hexToRgb(hex);
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        g.addColorStop(0, 'rgba(' + rr + ',' + gg + ',' + bb + ',' + alpha + ')');
        g.addColorStop(1, 'rgba(' + rr + ',' + gg + ',' + bb + ',0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
    };

    glow(W * 0.15, H * 0.08, 900, t.accent, 0.20);
    glow(W * 0.95, H * 0.42, 820, t.accent2, 0.16);
    glow(W * 0.10, H * 0.95, 760, t.accent, 0.12);

    // 코트 라인 — 앱 화면의 질감을 그대로 가져온다
    const [lr, lg, lb] = hexToRgb(t.accent);
    ctx.strokeStyle = 'rgba(' + lr + ',' + lg + ',' + lb + ',0.07)';
    ctx.lineWidth = 2;
    for (let x = 0; x <= W; x += 60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y <= H; y += 60) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
}

/** 셔틀콕 마크 — 앱 로고와 같은 모양 */
function drawShuttle(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color: string) {
    const s = size / 40;
    ctx.save();
    ctx.translate(cx - size / 2, cy - size / 2);
    ctx.scale(s, s);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const feathers: Array<[number, number]> = [[7, 9], [13.5, 6.5], [20, 5], [26.5, 6.5], [33, 9]];
    feathers.forEach(([x, y]) => { ctx.beginPath(); ctx.moveTo(20, 26); ctx.lineTo(x, y); ctx.stroke(); });
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.moveTo(11, 12.5);
    ctx.bezierCurveTo(15, 15, 25, 15, 29, 12.5);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(20, 30, 4.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

function alphaHex(hex: string, alpha: number): string {
    const [r, g, b] = hexToRgb(hex);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
}

/**
 * 자랑 카드를 그린다.
 *
 * 구성 순서에 의도가 있다. 스토리는 손가락으로 넘기며 0.5초 만에 지나가는 매체라,
 * 위에서부터 '누가 → 몇 경기 → 나머지' 순으로 큰 것부터 놓는다.
 */
export function drawBragCard(canvas: HTMLCanvasElement, s: BragStat, theme: Theme) {
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('캔버스를 쓸 수 없습니다.');
    const PAD = 88;
    const innerW = W - PAD * 2;

    paintBackdrop(ctx, theme);
    ctx.textBaseline = 'alphabetic';

    // ── 상단 바 ──
    ctx.fillStyle = theme.accent;
    ctx.fillRect(0, 0, W, 12);

    drawShuttle(ctx, PAD + 22, 118, 52, theme.accent);
    ctx.fillStyle = theme.text;
    ctx.font = font(900, 38);
    ctx.fillText('COCKSTAR', PAD + 62, 132);

    const d = s.date;
    const dateStr = d.getFullYear() + '.'
        + String(d.getMonth() + 1).padStart(2, '0') + '.'
        + String(d.getDate()).padStart(2, '0');
    ctx.textAlign = 'right';
    ctx.fillStyle = theme.dim;
    ctx.font = font(700, 32);
    ctx.fillText(dateStr, W - PAD, 132);
    ctx.textAlign = 'left';

    // ── 이름 (주인공) ──
    let y = 300;
    ctx.fillStyle = theme.accent;
    ctx.font = font(800, 34);
    ctx.fillText('TODAY RECORD', PAD, y);

    y += 108;
    ctx.fillStyle = theme.text;
    // 이름이 길면 글자를 줄인다 (다섯 글자 넘는 이름도 안 잘리게)
    let nameSize = 138;
    ctx.font = font(900, nameSize);
    while (ctx.measureText(s.name).width > innerW && nameSize > 70) {
        nameSize -= 6;
        ctx.font = font(900, nameSize);
    }
    ctx.fillText(s.name, PAD, y);

    // 급수 + 방 이름
    y += 62;
    ctx.font = font(800, 34);
    const lvW = Math.ceil(ctx.measureText(s.level).width) + 44;
    ctx.fillStyle = theme.accent;
    roundRect(ctx, PAD, y - 34, lvW, 52, 26);
    ctx.fill();
    ctx.fillStyle = theme.bg;
    ctx.fillText(s.level, PAD + 22, y + 2);
    if (s.roomName) {
        ctx.fillStyle = theme.dim;
        ctx.font = font(700, 32);
        const room = s.roomName.length > 18 ? s.roomName.slice(0, 18) + '...' : s.roomName;
        ctx.fillText(room, PAD + lvW + 20, y + 2);
    }

    // ── 오늘 경기 수 (화면의 주인공) ──
    y += 96;
    const heroH = 420;
    ctx.fillStyle = alphaHex(theme.accent, 0.10);
    roundRect(ctx, PAD, y, innerW, heroH, 48);
    ctx.fill();
    ctx.strokeStyle = alphaHex(theme.accent, 0.40);
    ctx.lineWidth = 3;
    roundRect(ctx, PAD, y, innerW, heroH, 48);
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = theme.accent;
    ctx.font = font(900, 260);
    ctx.fillText(String(s.games), W / 2, y + 292);
    ctx.fillStyle = theme.text;
    ctx.font = font(800, 44);
    ctx.fillText('오늘 친 경기', W / 2, y + 366);
    ctx.textAlign = 'left';

    // ── 통계 타일 3개 ──
    y += heroH + 44;
    const tileGap = 22;
    const tileW = (innerW - tileGap * 2) / 3;
    const tileH = 208;
    const tiles = [
        { v: String(s.rank), u: '위', k: s.totalPlayers + '명 중' },
        { v: String(s.metCount), u: '명', k: '오늘 만난 사람' },
        { v: String(s.minutes), u: '분', k: '코트에 선 시간' },
    ];
    tiles.forEach((t, i) => {
        const tx = PAD + i * (tileW + tileGap);
        ctx.fillStyle = theme.card;
        roundRect(ctx, tx, y, tileW, tileH, 32);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.10)';
        ctx.lineWidth = 2;
        roundRect(ctx, tx, y, tileW, tileH, 32);
        ctx.stroke();

        ctx.textAlign = 'center';
        ctx.fillStyle = i === 0 ? theme.accent : theme.text;
        ctx.font = font(900, 88);
        const vw = ctx.measureText(t.v).width;
        ctx.fillText(t.v, tx + tileW / 2 - 12, y + 116);
        ctx.textAlign = 'left';
        ctx.fillStyle = theme.dim;
        ctx.font = font(800, 34);
        ctx.fillText(t.u, tx + tileW / 2 - 12 + vw / 2 + 8, y + 116);
        ctx.textAlign = 'center';
        ctx.font = font(600, 28);
        ctx.fillText(t.k, tx + tileW / 2, y + 168);
        ctx.textAlign = 'left';
    });

    // ── 에이스 배지 ──
    y += tileH + 40;
    if (s.isAce) {
        const bh = 108;
        const g = ctx.createLinearGradient(PAD, y, PAD + innerW, y);
        g.addColorStop(0, alphaHex(theme.accent, 0.22));
        g.addColorStop(1, alphaHex(theme.accent2, 0.14));
        ctx.fillStyle = g;
        roundRect(ctx, PAD, y, innerW, bh, 32);
        ctx.fill();
        ctx.strokeStyle = alphaHex(theme.accent, 0.55);
        ctx.lineWidth = 3;
        roundRect(ctx, PAD, y, innerW, bh, 32);
        ctx.stroke();
        ctx.textAlign = 'center';
        ctx.fillStyle = theme.text;
        ctx.font = font(900, 46);
        ctx.fillText('오늘의 에이스', W / 2, y + 70);
        ctx.textAlign = 'left';
        y += bh + 36;
    }

    // ── 오늘 함께한 사람 ──
    if (s.partners.length > 0) {
        ctx.fillStyle = theme.accent;
        ctx.font = font(800, 30);
        ctx.fillText('오늘 함께한 사람 ' + s.partners.length + '명', PAD, y + 12);
        y += 54;

        const chipH = 62;
        const gapX = 14;
        const gapY = 14;
        ctx.font = font(700, 30);
        let cx = PAD;
        let rows = 0;
        const maxRows = 4;   // 넘치면 '+N'으로 접는다 (카드가 아래로 무한정 길어지면 안 된다)
        let shown = 0;
        for (const p of s.partners) {
            const w = Math.ceil(ctx.measureText(p).width) + 48;
            if (cx > PAD && cx + w > W - PAD) {
                rows += 1;
                cx = PAD;
                y += chipH + gapY;
                if (rows >= maxRows) break;
            }
            ctx.fillStyle = theme.card;
            roundRect(ctx, cx, y, w, chipH, 31);
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.10)';
            ctx.lineWidth = 2;
            roundRect(ctx, cx, y, w, chipH, 31);
            ctx.stroke();
            ctx.fillStyle = theme.text;
            ctx.font = font(700, 30);
            ctx.fillText(p, cx + 24, y + 41);
            cx += w + gapX;
            shown += 1;
        }
        const rest = s.partners.length - shown;
        if (rest > 0) {
            const label = '+' + rest;
            const w = Math.ceil(ctx.measureText(label).width) + 48;
            ctx.fillStyle = alphaHex(theme.accent, 0.14);
            roundRect(ctx, cx, y, w, chipH, 31);
            ctx.fill();
            ctx.fillStyle = theme.accent;
            ctx.fillText(label, cx + 24, y + 41);
        }
    }

    // ── 푸터 ──
    const fy = H - 96;
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(PAD, fy - 58);
    ctx.lineTo(W - PAD, fy - 58);
    ctx.stroke();

    drawShuttle(ctx, PAD + 18, fy - 6, 42, theme.accent);
    ctx.fillStyle = theme.text;
    ctx.font = font(800, 34);
    ctx.fillText('COCKSTAR', PAD + 52, fy + 6);
    ctx.textAlign = 'right';
    ctx.fillStyle = theme.dim;
    ctx.font = font(600, 28);
    ctx.fillText('배드민턴 실시간 매칭', W - PAD, fy + 6);
    ctx.textAlign = 'left';
}

/** 폰트가 준비된 뒤에 그려야 글자가 기본 폰트로 나오지 않는다 */
export async function renderBragCard(s: BragStat, theme: Theme): Promise<Blob> {
    try { await document.fonts?.ready; } catch { /* 폰트 API가 없어도 그린다 */ }
    const canvas = document.createElement('canvas');
    drawBragCard(canvas, s, theme);
    const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/png'));
    if (!blob) throw new Error('이미지를 만들지 못했습니다.');
    return blob;
}

export function bragFileName(s: BragStat): string {
    const d = s.date;
    const stamp = d.getFullYear()
        + String(d.getMonth() + 1).padStart(2, '0')
        + String(d.getDate()).padStart(2, '0');
    return '콕스타_' + stamp + '_' + s.name + '.png';
}

export function bragShareText(s: BragStat): string {
    const bits = ['🏸 오늘 ' + s.games + '경기'];
    if (s.isAce) bits.push('오늘의 에이스 🔥');
    else if (s.rank <= 3) bits.push('방 내 ' + s.rank + '위');
    if (s.metCount) bits.push(s.metCount + '명과 랠리');
    return bits.join(' · ') + '  #콕스타 #배드민턴';
}

/**
 * 공유하거나 저장한다.
 *
 * 인스타그램은 웹에서 바로 '스토리에 올리기'를 할 수 없다(공식 API가 없다).
 * 그래서 실제로 되는 두 가지 길만 쓴다.
 *   ① 폰의 공유 시트 — 거기서 인스타그램을 고르면 스토리 편집기로 바로 넘어간다
 *   ② 안 되면 사진 저장 — 인스타에서 갤러리로 불러오면 된다
 */
export async function shareBragCard(s: BragStat, theme: Theme): Promise<'shared' | 'downloaded'> {
    const blob = await renderBragCard(s, theme);
    const file = new File([blob], bragFileName(s), { type: 'image/png' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
            await navigator.share({ files: [file], text: bragShareText(s) });
            return 'shared';
        } catch (e) {
            // 공유 시트를 그냥 닫은 것은 오류가 아니다
            if ((e as Error)?.name === 'AbortError') return 'shared';
        }
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = bragFileName(s);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    return 'downloaded';
}
