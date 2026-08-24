import React from 'react';

// ===================================================================================
// 브랜드 마크 — 앱 아이콘과 '같은 그림'이어야 한다
// -----------------------------------------------------------------------------------
// 예전 마크는 가는 선으로 그린 셔틀콕이었다. 큰 화면에서는 예뻤지만 홈 화면 아이콘
// 크기(48px)로 줄이면 선이 뭉개져 회색 얼룩이 됐다. 그래서 면으로 그리는 지금 모양으로
// 바꿨고, scripts/generate-icons.mjs 가 같은 좌표로 PNG 아이콘을 뽑는다.
//
// 좌표를 손으로 두 번 적지 않으려고, 여기서도 같은 공식으로 계산한다.
// 상수만 맞춰두면 앱 안 로고와 홈 화면 아이콘이 절대 어긋나지 않는다.
// ===================================================================================

const CORK = { cx: 50, cy: 71.5, r: 13.8 };
const SKIRT = { yTop: 20, yBase: 66.5, halfTop: 35.5, halfBase: 13.2 };
const SPLIT_ANGLES = [-38, -13, 13, 38];
const BAND = { y: 45.5, w: 2.2 };

/** 깃털을 나누는 칼금 한 장 (코르크 중심에서 밖으로 뻗는 가는 사다리꼴) */
function splitPoints(angleDeg) {
    const a = (angleDeg * Math.PI) / 180;
    const dir = [Math.sin(a), -Math.cos(a)];
    const perp = [-dir[1], dir[0]];
    const from = 13;
    const to = 62;
    const hNear = 0.8;
    const hFar = 1.3;
    const bx = CORK.cx + dir[0] * from;
    const by = CORK.cy + dir[1] * from;
    const tx = CORK.cx + dir[0] * to;
    const ty = CORK.cy + dir[1] * to;
    return [
        [bx - perp[0] * hNear, by - perp[1] * hNear],
        [tx - perp[0] * hFar, ty - perp[1] * hFar],
        [tx + perp[0] * hFar, ty + perp[1] * hFar],
        [bx + perp[0] * hNear, by + perp[1] * hNear],
    ].map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
}

const SKIRT_POINTS = [
    [50 - SKIRT.halfTop, SKIRT.yTop],
    [50 + SKIRT.halfTop, SKIRT.yTop],
    [50 + SKIRT.halfBase, SKIRT.yBase],
    [50 - SKIRT.halfBase, SKIRT.yBase],
].map(([x, y]) => `${x},${y}`).join(' ');

const SPLITS = SPLIT_ANGLES.map(splitPoints);

/**
 * @param {object} props
 * @param {number} [props.size]
 * @param {boolean} [props.plate] 볼트색 판 위에 얹을지 (앱 아이콘과 같은 모습)
 */
export function CockstarMark({ size = 28, className = '', plate = false }) {
    const ink = plate ? '#08090C' : 'currentColor';
    // 판 위에서는 바탕색(볼트)으로 파내고, 판이 없으면 앱 배경색으로 파낸다
    const cut = plate ? '#CDFB47' : '#08090C';

    return (
        <svg
            viewBox="0 0 100 100"
            width={size}
            height={size}
            className={className}
            aria-hidden="true"
            focusable="false"
        >
            {plate && <rect width="100" height="100" rx="22" fill="#CDFB47" />}
            <g transform={plate ? 'translate(50 50) scale(0.74) translate(-50 -50)' : undefined}>
                <polygon points={SKIRT_POINTS} fill={ink} />
                <g fill={cut}>
                    {SPLITS.map((pts, i) => <polygon key={i} points={pts} />)}
                    <rect
                        x={50 - SKIRT.halfTop}
                        y={BAND.y - BAND.w / 2}
                        width={SKIRT.halfTop * 2}
                        height={BAND.w}
                    />
                </g>
                <circle cx={CORK.cx} cy={CORK.cy} r={CORK.r} fill={ink} />
            </g>
        </svg>
    );
}

export function CockstarLogo({ markSize = 22, className = '' }) {
    return (
        <div className={`flex items-center gap-2 ${className}`}>
            <CockstarMark size={markSize} plate className="rounded-[6px]" />
            <span className="font-display display-italic text-[24px] leading-none text-txt tracking-wide">
                COCK<span className="text-volt">STAR</span>
            </span>
        </div>
    );
}
