import React, { useEffect, useMemo, useState } from 'react';
import { PRODUCTS, newArrivals, bestDeals, formatPrice, openProduct } from '../../lib/products';
import { ProductImage } from '../../components/ProductCards';
import { ArrowUpRight, ChevronRight, HomeRaw, MapRaw } from '../../components/ui/icons';

// ===================================================================================
// 경기방 상단 배너 (자동 회전)
// -----------------------------------------------------------------------------------
// 경기방은 사람들이 저녁 내내 켜두는 화면이라 앱에서 노출 시간이 가장 긴 자리다.
// 고정 이미지 한 장은 몇 분 지나면 아무도 안 본다.
//
//   · 노에러 상품 3장 — 실제 상품 사진·이름·가격. 누르면 그 상품 페이지로 간다
//     (지어낸 카피 문구보다 "얼마짜리 뭐"가 훨씬 잘 눌린다)
//   · 홈 유도 1장 · 콕맵 유도 1장 — 경기방에만 머무는 사람을 다른 화면으로 데려간다
//
// 배너 구성 원칙: 광고 3 + 앱 안내 2. 전부 광고로 채우면 사용자가 이 띠를 통째로
// 무시하게 되어 결국 광고 효과까지 사라진다.
// ===================================================================================

export function GameBanner({ onNavigate }) {
    const [i, setI] = useState(0);

    // 신상 2장 + 최고 할인 1장. 신상이 모자라면 특가로 채운다.
    const promoItems = useMemo(() => {
        const drops = newArrivals(4).filter(p => p.cat === '신상');
        const deals = bestDeals(4).filter(p => !drops.some(d => d.idx === p.idx));
        return [...drops.slice(0, 2), ...deals].slice(0, 3);
    }, []);

    const maxRate = useMemo(() => Math.max(0, ...PRODUCTS.map(p => p.discountRate)), []);

    const slides = useMemo(() => [
        ...promoItems.map(p => ({ kind: 'product', product: p })),
        {
            kind: 'nav', to: '/',
            kicker: 'COCKSTAR', title: '오늘 뭐 살지 고민된다면',
            sub: `노에러 상품 ${PRODUCTS.length}종 · 최대 ${maxRate}%`,
            cta: '홈으로', accent: 'volt', art: HomeRaw,
        },
        {
            kind: 'nav', to: '/map',
            kicker: 'KOK MAP', title: '내 주변 체육관 찾기',
            sub: '지도에서 오늘 열린 경기방 확인',
            cta: '콕맵 열기', accent: 'coral', art: MapRaw,
        },
    ], [promoItems, maxRate]);

    // 6초마다 다음 장. 5장이면 한 바퀴 30초 — 경기 한 판보다 짧다.
    useEffect(() => {
        if (slides.length <= 1) return undefined;
        const t = setTimeout(() => setI(v => (v + 1) % slides.length), 6000);
        return () => clearTimeout(t);
    }, [i, slides.length]);

    if (slides.length === 0) return null;
    const s = slides[i];

    const handleClick = () => {
        if (s.kind === 'product') openProduct(s.product);
        else onNavigate?.(s.to);
    };

    return (
        <div className="w-full flex-shrink-0 relative overflow-hidden bg-ink border-b border-white/[0.06] z-10">
            <button
                onClick={handleClick}
                className="w-full text-left active:opacity-90 transition-opacity"
                aria-label={s.kind === 'product' ? `${s.product.name} 상품 보기` : s.title}
            >
                {s.kind === 'product' ? (
                    <div className="flex items-stretch h-20">
                        <div className="w-20 shrink-0 bg-[#F3F4F6]">
                            <ProductImage src={s.product.image} alt={s.product.name} className="w-full h-full" />
                        </div>
                        <div className="flex-1 min-w-0 px-3.5 flex flex-col justify-center">
                            <span className="text-[9px] font-black label text-volt">NOERROR · 공식 파트너</span>
                            <p className="text-[13px] font-black text-txt truncate kern-tight leading-tight mt-0.5">
                                {s.product.name}
                            </p>
                            <div className="flex items-baseline gap-1.5 mt-0.5">
                                {s.product.discountRate > 0 && (
                                    <span className="text-xs font-black text-coral tabular">{s.product.discountRate}%</span>
                                )}
                                <span className="text-sm font-black text-volt tabular">{formatPrice(s.product.price)}원</span>
                                {s.product.originalPrice > s.product.price && (
                                    <span className="text-[10px] text-muted font-bold tabular line-through">
                                        {formatPrice(s.product.originalPrice)}
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="pr-3 flex items-center">
                            <ArrowUpRight size={18} className="text-muted" />
                        </div>
                    </div>
                ) : (
                    <div className={`relative h-20 grain court-lines flex flex-col justify-center px-4 overflow-hidden ${s.accent === 'coral' ? 'bg-coral/[0.07]' : 'bg-volt/[0.06]'}`}>
                        <span className={`text-[9px] font-black label relative z-10 ${s.accent === 'coral' ? 'text-coral' : 'text-volt'}`}>
                            {s.kicker}
                        </span>
                        <p className="text-[14px] font-black text-txt kern-tight leading-tight mt-0.5 relative z-10">{s.title}</p>
                        <div className="flex items-center gap-1.5 mt-0.5 relative z-10 min-w-0">
                            <span className="text-[10px] font-bold text-dim truncate">{s.sub}</span>
                            <span className={`text-[10px] font-black shrink-0 flex items-center gap-0.5 ${s.accent === 'coral' ? 'text-coral' : 'text-volt'}`}>
                                {s.cta} <ChevronRight size={11} />
                            </span>
                        </div>
                        <s.art className={`absolute -right-3 -bottom-4 w-24 h-24 ${s.accent === 'coral' ? 'text-coral/10' : 'text-volt/10'}`} strokeWidth={1} />
                    </div>
                )}
            </button>

            <div className="absolute bottom-1.5 right-3 flex gap-1 z-10">
                {slides.map((_, k) => (
                    <button
                        key={k}
                        onClick={(e) => { e.stopPropagation(); setI(k); }}
                        aria-label={`${k + 1}번째 배너 보기`}
                        className={`h-1 rounded-full transition-all ${i === k ? 'w-4 bg-volt' : 'w-1 bg-white/25'}`}
                    />
                ))}
            </div>
        </div>
    );
}
