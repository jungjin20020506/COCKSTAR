import { getLevelHex, toIsoTime } from './matchQueues';

// ===================================================================================
// [하루 요약 카드] 오늘의 운동 리포트
// -----------------------------------------------------------------------------------
// 관리자가 버튼 하나로 "오늘 누가 왔고 몇 경기 했는지"를 이미지 한 장으로 만들어
// 단톡방에 공유한다. 운동 끝나고 총무가 손으로 정리하던 걸 대신한다.
//
// 캔버스에 직접 그리는 이유: 화면을 캡처하면 기기마다 크기·잘림이 제각각이고,
// 스크롤해야 보이는 부분은 아예 안 담긴다. 그려서 만들면 항상 같은 결과가 나온다.
//
// [콕스타 이식 시 바꾼 것]
//  · 브랜딩: 콕스라이팅 → 콕스타
//  · 콕스타는 방이 여러 개라 방 이름을 함께 넣는다 (어느 방의 기록인지 알아야 하므로)
//  · 봇(테스트용)은 집계에서 뺀다
// ===================================================================================

/**
 * 오늘의 통계를 계산한다.
 *
 * @param {object} players  { [uid]: player } — 방의 선수 전체
 * @param {string} roomName 방 이름 (카드에 표시)
 */
function computeDailySummary(players, roomName = '') {
    const isToday = (value) => {
        const iso = toIsoTime(value);
        if (!iso) return false;
        return new Date(iso).toDateString() === new Date().toDateString();
    };

    // 봇은 사람이 아니므로 통계에서 뺀다 (넣으면 참석 인원과 평균이 전부 거짓말이 된다)
    const attendees = Object.values(players || {}).filter(p => p && p.name && !p.isBot);

    // 개인 경기 수는 카드에 찍히는 값(todayGames)을 그대로 쓴다.
    // 요약 카드가 화면과 다른 숫자를 말하면 아무도 안 믿는다.
    // (관리자가 경기 수를 손으로 보정한 경우도 그 의도를 존중하게 된다)
    const gamesOf = (p) => Math.max(0, p.todayGames || 0);

    // ── 총 경기 수 ──
    // 한 경기는 4명에게 '같은 timestamp'로 기록되므로, 서로 다른 timestamp의 개수가
    // 곧 실제 경기 수다. 사람 수로 나누는 것보다 정확하다.
    const tsSet = new Set();
    attendees.forEach(p => (p.todayRecentGames || []).forEach(g => {
        if (!g || g.isManual) return;
        if (isToday(g.timestamp)) tsSet.add(toIsoTime(g.timestamp));
    }));

    const totalParticipations = attendees.reduce((sum, p) => sum + gamesOf(p), 0);
    // 구조체 기록이 아직 하나도 없는 방(이 기능을 넣기 전부터 돌던 방)에서는
    // 총 경기 수가 0으로 나온다. 그럴 땐 참가 인원 수로 되짚어 추정한다.
    const totalGames = tsSet.size > 0 ? tsSet.size : Math.round(totalParticipations / 4);

    const sorted = [...attendees].sort(
        (a, b) => gamesOf(b) - gamesOf(a) || (a.name || '').localeCompare(b.name || '', 'ko')
    );
    const ace = sorted[0] && gamesOf(sorted[0]) > 0
        ? { name: sorted[0].name, games: gamesOf(sorted[0]) }
        : null;

    return {
        date: new Date(),
        roomName: roomName || '',
        attendees: sorted.map(p => ({ name: p.name, level: p.level, games: gamesOf(p) })),
        maleCount: attendees.filter(p => p.gender === '남').length,
        femaleCount: attendees.filter(p => p.gender !== '남').length,
        totalGames,
        avgGames: attendees.length
            ? Math.round((totalParticipations / attendees.length) * 10) / 10
            : 0,
        ace,
    };
}


/**
 * 요약 카드를 캔버스에 그린다. (세로형 · 폭 1080 고정 · 참석자 수에 따라 높이 자동)
 *
 * 높이를 '먼저' 계산하는 게 요령이다. 이름 칩의 폭을 measureText로 재서 몇 줄이 되는지
 * 구한 뒤에야 전체 높이를 정할 수 있다. 안 그러면 아래가 잘리거나 여백이 붕 뜬다.
 */
function drawSummaryCard(canvas, s) {
    const W = 1080, PAD = 64;
    // COCKSTAR "Blackout" 팔레트 (tailwind.config.js와 같은 값)
    const VOLT = '#CDFB47', BG = '#08090C', CARD = '#171A21',
          LINE = 'rgba(255,255,255,0.09)', TEXT = '#F3F5F8', DIM = '#8C93A1';
    const ctx = canvas.getContext('2d');
    const rr = (x, y, w, h, r) => {
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
        else ctx.rect(x, y, w, h); // roundRect 없는 구형 웹뷰 폴백
    };

    // ── 참석자 칩이 몇 줄이 되는지 먼저 재서 캔버스 높이를 정한다 ──
    const chipFont = '700 30px "Pretendard", "Noto Sans KR", sans-serif';
    const chipH = 62, chipGapX = 14, chipGapY = 16, innerW = W - PAD * 2;
    ctx.font = chipFont;
    const chips = s.attendees.map(a => {
        const label = a.games > 0 ? `${a.name} ${a.games}` : a.name;
        return { ...a, label, w: Math.ceil(ctx.measureText(label).width) + 74 };
    });
    let rows = chips.length ? 1 : 0, x = 0;
    chips.forEach(c => {
        if (x > 0 && x + c.w > innerW) { rows++; x = 0; }
        x += c.w + chipGapX;
    });

    const chipsStartY = s.ace ? 928 : 812;
    const H = chipsStartY + rows * (chipH + chipGapY) + 172;
    canvas.width = W; canvas.height = H;

    // ── 배경 (앱의 분위기를 그대로 — 좌상단 청록 / 우하단 따뜻한 갈색) ──
    ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);
    let grd = ctx.createRadialGradient(W * 0.2, -100, 0, W * 0.2, -100, 900);
    grd.addColorStop(0, 'rgba(22,50,58,0.75)'); grd.addColorStop(1, 'rgba(22,50,58,0)');
    ctx.fillStyle = grd; ctx.fillRect(0, 0, W, H);
    grd = ctx.createRadialGradient(W, H, 0, W, H, 800);
    grd.addColorStop(0, 'rgba(42,34,16,0.6)'); grd.addColorStop(1, 'rgba(42,34,16,0)');
    ctx.fillStyle = grd; ctx.fillRect(0, 0, W, H);

    // ── 헤더 ──
    ctx.fillStyle = VOLT; ctx.fillRect(0, 0, W, 10);
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = DIM; ctx.font = '700 24px "Pretendard", "Noto Sans KR", sans-serif';
    ctx.fillText('C O C K S T A R   O F F I C I A L', PAD, 88);
    ctx.textAlign = 'right';
    ctx.fillText('DAILY REPORT', W - PAD, 88);
    ctx.textAlign = 'left';

    ctx.fillStyle = VOLT; ctx.font = '900 104px "Pretendard", "Noto Sans KR", sans-serif';
    ctx.fillText('콕스타', PAD, 212);
    ctx.fillStyle = DIM; ctx.font = '400 34px "Anton", "Pretendard", sans-serif';
    ctx.fillText('TODAY MATCH REPORT', PAD + 6, 262);

    // 날짜 + 방 이름 (콕스타는 방이 여러 개라 어느 방인지 밝혀야 한다)
    const d = s.date;
    const dateStr = `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${['일','월','화','수','목','금','토'][d.getDay()]})`;
    ctx.fillStyle = TEXT; ctx.font = '700 42px "Pretendard", "Noto Sans KR", sans-serif';
    ctx.fillText(dateStr, PAD, 340);
    if (s.roomName) {
        const dw = ctx.measureText(dateStr).width;
        ctx.fillStyle = DIM; ctx.font = '700 30px "Pretendard", "Noto Sans KR", sans-serif';
        ctx.fillText(`· ${s.roomName}`, PAD + dw + 18, 340);
    }

    // ── 통계 타일 3개 ──
    const tileY = 400, tileH = 210, tileGap = 22;
    const tileW = (innerW - tileGap * 2) / 3;
    const tiles = [
        { v: `${s.attendees.length}`, u: '명', k: `참석 인원 (남${s.maleCount}·여${s.femaleCount})` },
        { v: `${s.totalGames}`, u: '경기', k: '오늘 총 경기' },
        { v: `${s.avgGames}`, u: '게임', k: '1인 평균' },
    ];
    tiles.forEach((t, i) => {
        const tx = PAD + i * (tileW + tileGap);
        ctx.fillStyle = CARD; rr(tx, tileY, tileW, tileH, 26); ctx.fill();
        ctx.strokeStyle = LINE; ctx.lineWidth = 2; rr(tx, tileY, tileW, tileH, 26); ctx.stroke();
        ctx.fillStyle = i === 0 ? VOLT : TEXT;
        ctx.font = '900 84px "Pretendard", "Noto Sans KR", sans-serif';
        const vw = ctx.measureText(t.v).width;
        ctx.fillText(t.v, tx + 34, tileY + 118);
        ctx.fillStyle = DIM; ctx.font = '700 32px "Pretendard", "Noto Sans KR", sans-serif';
        ctx.fillText(t.u, tx + 34 + vw + 8, tileY + 116);
        ctx.font = '500 26px "Pretendard", "Noto Sans KR", sans-serif';
        ctx.fillText(t.k, tx + 34, tileY + 172);
    });

    // ── 오늘의 에이스 ──
    if (s.ace) {
        const ay = 664, ah = 122;
        ctx.fillStyle = 'rgba(205,251,71,0.10)'; rr(PAD, ay, innerW, ah, 26); ctx.fill();
        ctx.strokeStyle = 'rgba(205,251,71,0.45)'; ctx.lineWidth = 2; rr(PAD, ay, innerW, ah, 26); ctx.stroke();
        ctx.font = '900 46px "Pretendard", "Noto Sans KR", sans-serif'; ctx.fillStyle = TEXT;
        ctx.fillText(`🔥 오늘의 에이스  ${s.ace.name}`, PAD + 40, ay + 78);
        ctx.textAlign = 'right'; ctx.fillStyle = VOLT;
        ctx.fillText(`${s.ace.games}경기`, W - PAD - 40, ay + 78);
        ctx.textAlign = 'left';
    }

    // ── 참석 멤버 칩 (급수 색 점 + 이름 + 경기 수) ──
    ctx.fillStyle = VOLT; ctx.font = '700 27px "Pretendard", "Noto Sans KR", sans-serif';
    ctx.fillText(`TODAY'S PLAYERS · ${s.attendees.length}명`, PAD, chipsStartY - 34);

    let cx = PAD, cy = chipsStartY;
    chips.forEach(c => {
        if (cx > PAD && cx + c.w > W - PAD) { cx = PAD; cy += chipH + chipGapY; }
        ctx.fillStyle = CARD; rr(cx, cy, c.w, chipH, 31); ctx.fill();
        ctx.strokeStyle = LINE; ctx.lineWidth = 2; rr(cx, cy, c.w, chipH, 31); ctx.stroke();
        ctx.fillStyle = getLevelHex(c.level);
        ctx.beginPath(); ctx.arc(cx + 32, cy + chipH / 2, 9, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = TEXT; ctx.font = chipFont;
        ctx.fillText(c.label, cx + 54, cy + chipH / 2 + 11);
        cx += c.w + chipGapX;
    });

    // ── 푸터 ──
    const fy = H - 96;
    ctx.strokeStyle = LINE; ctx.beginPath(); ctx.moveTo(PAD, fy - 42); ctx.lineTo(W - PAD, fy - 42); ctx.stroke();
    ctx.fillStyle = TEXT; ctx.font = '700 34px "Pretendard", "Noto Sans KR", sans-serif';
    ctx.fillText('오늘도 함께해서 즐거웠습니다. 다음 운동에서 만나요! 🏸', PAD, fy + 10);
    ctx.fillStyle = DIM; ctx.font = '500 24px "Pretendard", "Noto Sans KR", sans-serif';
    ctx.fillText('⚡ COCKSTAR · 실시간 배드민턴 매칭', PAD, fy + 56);
}


/**
 * 요약 카드를 만들어 공유하거나(폰 공유 시트) 저장한다.
 *
 * navigator.share는 파일 공유를 지원하지 않는 브라우저가 아직 많아서,
 * 지원 여부를 canShare로 먼저 확인하고 안 되면 다운로드로 떨어진다.
 *
 * @returns {Promise<'shared'|'downloaded'>}
 */
async function shareSummaryCard(summary) {
    const canvas = document.createElement('canvas');
    drawSummaryCard(canvas, summary);

    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('이미지를 만들지 못했습니다.');

    const d = summary.date;
    const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    const fileName = `콕스타_${stamp}_운동요약.png`;
    const file = new File([blob], fileName, { type: 'image/png' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
            await navigator.share({
                files: [file],
                title: '콕스타 오늘의 운동',
                text: `🏸 콕스타 오늘의 운동 — 참석 ${summary.attendees.length}명 · 총 ${summary.totalGames}경기`,
            });
            return 'shared';
        } catch (e) {
            // 사용자가 공유 시트를 그냥 닫은 것은 오류가 아니다 — 조용히 넘어간다
            if (e && e.name === 'AbortError') return 'shared';
            // 그 외 실패는 아래 다운로드로 떨어진다
        }
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // 브라우저가 다운로드를 시작할 시간을 준 뒤에 해제한다
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    return 'downloaded';
}

export { computeDailySummary, drawSummaryCard, shareSummaryCard };
