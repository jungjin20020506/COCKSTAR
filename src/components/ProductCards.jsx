import React, { useState } from 'react';
import { formatPrice, openProduct } from '../lib/products';

// ===================================================================================
// 노에러 상품 카드
// -----------------------------------------------------------------------------------
// 홈·스토어 화면에서 함께 쓰는 상품 카드들. 데이터는 lib/products.js 에서 온다.
//
// 디자인 메모
//  · 상품 사진이 대부분 흰 배경이라, 어두운 앱 위에 그냥 얹으면 사진 모서리가
//    네모나게 튀어 보인다. 그래서 사진은 밝은 타일 안에 넣어 '제품 컷'처럼 보이게 했다.
//  · 누르면 공식몰의 '그 상품' 페이지로 간다. 쇼핑몰 첫 화면으로 보내면 방금 본 상품을
//    다시 찾아야 해서 대부분 그냥 나가버린다.
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

/** 할인율 배지 — 할인 중일 때만 */
const DiscountBadge = ({ rate }) => (
    rate > 0
        ? <span className="absolute top-2 left-2 z-10 text-[10px] font-black px-2 py-0.5 rounded-full bg-coral text-ink tabular">{rate}%</span>
        : null
);

/** 품절 덮개 */
const SoldOutVeil = () => (
    <div className="absolute inset-0 z-10 bg-ink/70 flex items-center justify-center">
        <span className="text-[11px] font-black label text-dim">SOLD OUT</span>
    </div>
);

/** 가격 줄 — 정가가 있으면 취소선으로 함께 보여준다 */
const PriceRow = ({ product, size = 'sm' }) => (
    <div className="flex items-baseline gap-1.5 mt-1 min-w-0">
        <span className={`text-volt font-black tabular ${size === 'lg' ? 'text-base' : 'text-sm'}`}>
            {formatPrice(product.price)}원
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
                    <DiscountBadge rate={product.discountRate} />
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
 * 2열 그리드에 쓰는 카드 (스토어 화면)
 */
function ProductCardGrid({ product }) {
    return (
        <button
            onClick={() => openProduct(product)}
            className="text-left active:scale-[0.97] transition-transform"
        >
            <div className="rounded-2xl overflow-hidden bg-card border border-white/[0.06] h-full flex flex-col">
                <div className="relative w-full aspect-square bg-[#F3F4F6]">
                    <DiscountBadge rate={product.discountRate} />
                    {product.soldOut && <SoldOutVeil />}
                    <span className="absolute top-2 right-2 z-10 text-[9px] font-black px-2 py-0.5 rounded-full bg-ink/70 text-dim">
                        {product.cat}
                    </span>
                    <ProductImage src={product.image} alt={product.name} className="w-full h-full" />
                </div>
                <div className="p-3 flex-1 flex flex-col">
                    <p className="font-black text-sm text-txt truncate kern-tight leading-tight">{product.name}</p>
                    <p className="text-[10px] text-muted font-bold truncate mt-0.5">
                        {[product.color, product.size].filter(Boolean).join(' · ') || product.modelCode}
                    </p>
                    <PriceRow product={product} size="lg" />
                </div>
            </div>
        </button>
    );
}

/**
 * 크게 한 장 보여주는 카드 (홈의 '오늘의 특가' 자리)
 * 사진을 왼쪽에 두고 오른쪽에 설명을 붙여, 가로로 넓은 화면에서도 비지 않게 했다.
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
                        <span className="text-base font-black text-volt tabular">{formatPrice(product.price)}원</span>
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

export { ProductCardH, ProductCardGrid, ProductCardWide, ProductImage };
