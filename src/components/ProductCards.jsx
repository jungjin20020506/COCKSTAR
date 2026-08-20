import React, { useState } from 'react';
import { formatPrice, openProduct, badgeOf } from '../lib/products';

// ===================================================================================
// 노에러 상품 카드
// -----------------------------------------------------------------------------------
// 홈·스토어 화면에서 함께 쓰는 상품 카드들. 데이터는 lib/products.js 에서 온다.
//
// 디자인 메모
//  · 상품 사진이 대부분 흰 배경이라, 어두운 앱 위에 그냥 얹으면 사진 모서리가
//    네모나게 튀어 보인다. 그래서 사진은 밝은 타일 안에 넣어 '제품 컷'처럼 보이게 했다.
//  · 뱃지는 NEW(신상)와 BEST(40%↑ 할인) 둘뿐이다. 모든 카드에 뱃지가 붙으면
//    아무 뱃지도 눈에 안 들어온다.
//  · 색상 변형은 도트로 보여준다. "이 옷, 다른 색도 있네"를 칸을 더 쓰지 않고 전달한다.
//  · 찜/장바구니 버튼은 넣지 않았다 — 결제가 앱 밖(공식몰)에서 일어나므로
//    눌러도 아무 일도 안 생기는 버튼이 된다. 안 눌리는 버튼은 거짓말이다.
// ===================================================================================

/**
 * 상품 사진.
 * 이미지는 노에러 쪽 CDN에서 바로 불러온다. 주소가 바뀌거나 네트워크가 끊겨 깨질 수 있으므로
 * 실패하면 빈 자리 대신 브랜드 마크를 보여준다. (깨진 이미지 아이콘이 뜨면 앱이 고장나 보인다)
 */
function ProductImage({ src, alt, className = '' }) {
    const [failed, setFailed] = useState(false);
    if (!src || failed) {
        return (
            <div className={`flex items-center justify-center bg-card2 ${className}`}>
                <span className="font-display text-muted text-lg leading-none">NOERROR</span>
            </div>
        );
    }
    return (
        <img
            src={src}
            alt={alt}
            loading="lazy"
            decoding="async"
            onError={() => setFailed(true)}
            className={`object-cover ${className}`}
        />
    );
}

/** NEW / BEST / 할인율 — 사진 위 왼쪽 상단에 세로로 쌓인다 */
function CardBadges({ product }) {
    const badge = badgeOf(product);
    return (
        <div className="absolute top-2 left-2 z-10 flex flex-col items-start gap-1">
            {badge === 'NEW' && (
                <span className="text-[9px] font-black px-2 py-0.5 rounded bg-volt text-ink tracking-wide">NEW</span>
            )}
            {badge === 'BEST' && (
                <span className="text-[9px] font-black px-2 py-0.5 rounded bg-ink text-volt tracking-wide">BEST</span>
            )}
            {product.discountRate > 0 && (
                <span className="text-[10px] font-black px-2 py-0.5 rounded bg-coral text-ink tabular">{product.discountRate}%</span>
            )}
        </div>
    );
}

/** 품절 덮개 */
const SoldOutVeil = () => (
    <div className="absolute inset-0 z-10 bg-ink/70 flex items-center justify-center">
        <span className="text-[11px] font-black label text-dim">SOLD OUT</span>
    </div>
);

/** 색상 이름 → 도트에 칠할 색. 못 알아들으면 회색 (지어내지 않는다) */
const COLOR_HEX = {
    '블랙': '#1a1a1a', 'BLACK': '#1a1a1a', 'BK': '#1a1a1a',
    '화이트': '#f5f5f5', 'WHITE': '#f5f5f5', 'WH': '#f5f5f5',
    '네이비': '#1e3a5f', 'NAVY': '#1e3a5f', 'NV': '#1e3a5f',
    '그레이': '#9ca3af', 'GRAY': '#9ca3af', 'GREY': '#9ca3af',
    '핑크': '#f9a8d4', 'PINK': '#f9a8d4', '연핑크': '#fbcfe8', 'LIGHT PINK': '#fbcfe8', 'L.P': '#fbcfe8',
    '민트': '#6ee7b7', 'MINT': '#6ee7b7',
    '스카이블루': '#7dd3fc', 'SKY BLUE': '#7dd3fc', 'BLUE': '#3b82f6', '블루': '#3b82f6',
    '레드': '#ef4444', 'RED': '#ef4444',
    '옐로우': '#facc15', 'YELLOW': '#facc15',
    '그린': '#22c55e', 'GREEN': '#22c55e',
    '베이지': '#d6c7a1', 'BEIGE': '#d6c7a1',
    '퍼플': '#a78bfa', 'PURPLE': '#a78bfa',
};
function colorDot(name) {
    const key = String(name || '').toUpperCase();
    for (const [k, v] of Object.entries(COLOR_HEX)) {
        if (key.includes(k.toUpperCase())) return v;
    }
    return '#6b7280';
}

/** 색상 변형 도트 줄 — 변형이 2개 이상일 때만 (하나뿐이면 정보가 아니다) */
function ColorDots({ variants }) {
    if (!variants || variants.length < 2) return null;
    return (
        <div className="flex items-center gap-1 mt-1.5">
            {variants.slice(0, 5).map(c => (
                <span key={c} title={c}
                    className="w-2.5 h-2.5 rounded-full border border-white/25 shrink-0"
                    style={{ backgroundColor: colorDot(c) }} />
            ))}
            {variants.length > 5 && (
                <span className="text-[9px] font-bold text-muted">+{variants.length - 5}</span>
            )}
        </div>
    );
}

/** 가격 줄 — 정가가 있으면 취소선으로 함께 보여준다 */
const PriceRow = ({ product, size = 'sm' }) => (
    <div className="flex items-baseline gap-1.5 mt-1 min-w-0">
        <span className={`text-txt font-black tabular ${size === 'lg' ? 'text-base' : 'text-sm'}`}>
            {formatPrice(product.price)}<span className="text-[0.75em] font-bold">원</span>
        </span>
        {product.originalPrice > product.price && (
            <span className="text-[10px] text-muted font-bold tabular line-through shrink-0">
                {formatPrice(product.originalPrice)}
            </span>
        )}
    </div>
);

/**
 * 가로 스크롤 줄에 쓰는 카드 (홈 화면)
 */
function ProductCardH({ product }) {
    return (
        <button
            onClick={() => openProduct(product)}
            className="w-36 flex-shrink-0 text-left active:scale-[0.97] transition-transform"
        >
            <div className="rounded-2xl overflow-hidden bg-card border border-white/[0.06]">
                <div className="relative w-full aspect-square bg-[#F3F4F6]">
                    <CardBadges product={product} />
                    {product.soldOut && <SoldOutVeil />}
                    <ProductImage src={product.image} alt={product.name} className="w-full h-full" />
                </div>
                <div className="p-2.5">
                    <p className="font-black text-[13px] text-txt truncate kern-tight leading-tight">{product.name}</p>
                    <p className="text-[10px] text-muted font-bold truncate mt-0.5">{product.color || product.cat}</p>
                    <PriceRow product={product} />
                </div>
            </div>
        </button>
    );
}

/**
 * 2열 그리드에 쓰는 카드 (스토어 화면) — 쇼핑몰의 기본 단위
 */
function ProductCardGrid({ product }) {
    return (
        <button
            onClick={() => openProduct(product)}
            className="text-left active:scale-[0.97] transition-transform group"
        >
            <div className="rounded-2xl overflow-hidden bg-card border border-white/[0.06] h-full flex flex-col group-hover:border-white/15 transition-colors">
                <div className="relative w-full aspect-square bg-[#F3F4F6] overflow-hidden">
                    <CardBadges product={product} />
                    {product.soldOut && <SoldOutVeil />}
                    <ProductImage src={product.image} alt={product.name}
                        className="w-full h-full group-hover:scale-105 transition-transform duration-500" />
                </div>
                <div className="p-3 flex-1 flex flex-col">
                    <p className="text-[10px] font-black label text-muted">{product.brand || 'NOERROR'}</p>
                    <p className="font-black text-sm text-txt kern-tight leading-tight mt-0.5 line-clamp-2">{product.name}</p>
                    <div className="mt-auto pt-1.5">
                        <div className="flex items-baseline gap-1.5">
                            {product.discountRate > 0 && (
                                <span className="text-sm font-black text-coral tabular">{product.discountRate}%</span>
                            )}
                            <span className="text-[15px] font-black text-txt tabular">
                                {formatPrice(product.price)}<span className="text-[11px] font-bold">원</span>
                            </span>
                        </div>
                        {product.originalPrice > product.price && (
                            <p className="text-[10px] text-muted font-bold tabular line-through leading-none mt-0.5">
                                {formatPrice(product.originalPrice)}원
                            </p>
                        )}
                        <ColorDots variants={product.colorVariants} />
                    </div>
                </div>
            </div>
        </button>
    );
}

/**
 * 크게 한 장 보여주는 카드 (홈의 '오늘의 특가' 자리)
 */
function ProductCardWide({ product, kicker = '오늘의 특가' }) {
    return (
        <button
            onClick={() => openProduct(product)}
            className="w-full text-left active:scale-[0.99] transition-transform"
        >
            <div className="rounded-3xl overflow-hidden bg-card border border-white/[0.06] flex items-stretch">
                <div className="relative w-32 shrink-0 bg-[#F3F4F6]">
                    {product.soldOut && <SoldOutVeil />}
                    <ProductImage src={product.image} alt={product.name} className="w-full h-full" />
                </div>
                <div className="flex-1 min-w-0 p-4 flex flex-col justify-center">
                    <span className="text-[10px] font-black label text-coral">{kicker}</span>
                    <p className="font-black text-[15px] text-txt kern-tight leading-tight mt-1 truncate">{product.name}</p>
                    <p className="text-[11px] text-dim font-bold truncate mt-0.5">
                        {[product.color, product.size].filter(Boolean).join(' · ') || product.cat}
                    </p>
                    <div className="flex items-baseline gap-2 mt-2">
                        {product.discountRate > 0 && (
                            <span className="text-sm font-black text-coral tabular">{product.discountRate}%</span>
                        )}
                        <span className="text-base font-black text-txt tabular">{formatPrice(product.price)}원</span>
                        {product.originalPrice > product.price && (
                            <span className="text-[11px] text-muted font-bold tabular line-through">
                                {formatPrice(product.originalPrice)}
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </button>
    );
}

/**
 * 신상 히어로 카드 (스토어 맨 위) — 잡지 화보처럼 사진을 크게 쓴다.
 * 신상 5종을 자동으로 넘기며 보여주고, 누르면 그 상품으로 간다.
 */
function NewDropHero({ products }) {
    const [i, setI] = useState(0);
    const list = products.slice(0, 5);

    React.useEffect(() => {
        if (list.length <= 1) return;
        const t = setTimeout(() => setI(v => (v + 1) % list.length), 4500);
        return () => clearTimeout(t);
    }, [i, list.length]);

    if (list.length === 0) return null;
    const p = list[i];

    return (
        <div className="relative rounded-3xl overflow-hidden border border-white/[0.06]">
            <button onClick={() => openProduct(p)} className="block w-full text-left active:opacity-95 transition-opacity">
                <div className="relative w-full aspect-[4/3] bg-[#F3F4F6]">
                    {/* key 를 줘서 넘어갈 때마다 사진이 교차 페이드된다 */}
                    <ProductImage key={p.idx} src={p.image} alt={p.name} className="w-full h-full animate-fade-in" />
                    <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/25 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 p-5">
                        <span className="inline-block text-[10px] font-black px-2.5 py-1 rounded-full bg-volt text-ink label">
                            2026 S/S NEW
                        </span>
                        <h3 className="font-display display-italic text-2xl text-txt leading-tight mt-2">{p.name}</h3>
                        <div className="flex items-baseline gap-2 mt-1.5">
                            {p.discountRate > 0 && <span className="text-base font-black text-coral tabular">{p.discountRate}%</span>}
                            <span className="text-lg font-black text-txt tabular">{formatPrice(p.price)}원</span>
                            {p.originalPrice > p.price && (
                                <span className="text-xs text-dim font-bold tabular line-through">{formatPrice(p.originalPrice)}</span>
                            )}
                        </div>
                        {p.color && <p className="text-[11px] font-bold text-dim mt-1">{p.color}{p.size ? ` · ${p.size}` : ''}</p>}
                    </div>
                </div>
            </button>
            {list.length > 1 && (
                <div className="absolute top-4 right-4 flex gap-1 z-10">
                    {list.map((_, k) => (
                        <button key={k} onClick={() => setI(k)} aria-label={`${k + 1}번째 신상`}
                            className={`h-1 rounded-full transition-all ${i === k ? 'w-5 bg-volt' : 'w-1.5 bg-white/30'}`} />
                    ))}
                </div>
            )}
        </div>
    );
}

export { ProductCardH, ProductCardGrid, ProductCardWide, ProductImage, NewDropHero };
