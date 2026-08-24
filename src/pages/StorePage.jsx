import React, { useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
    PRODUCTS, CATEGORIES, FETCHED_AT, byCategory,
} from '../lib/products';
import { ProductCardH, ProductCardGrid, NewDropHero } from '../components/ProductCards';
import noErrorBanner from '../noerror.png';
import { NOERROR_URL } from '../constants';
import { ArrowUpRight, ChevronRight, Search, X, Heart } from '../components/ui/icons';

// ===================================================================================
// NOERROR 스토어
// -----------------------------------------------------------------------------------
// 구성 (위 → 아래): 신상이 무조건 제일 먼저다.
//   ① 브랜드 헤더 (작게 — 상품이 주인공)
//   ② NEW DROP 히어로 — 신상을 잡지 화보처럼
//   ③ 신상 전체 가로 줄
//   ④ 검색 + 카테고리 칩 + 정렬 (스크롤하면 위에 붙는다)
//   ⑤ 상품 그리드 (2열)
//   ⑥ 공식몰 배너 + 데이터 기준일
//
// [추가된 것]
//   · 검색 — 190종에 검색이 없어서 "그 라켓 뭐였지"를 스크롤로 찾아야 했다
//   · 찜 — 카드마다 하트. '내 정보'의 찜 목록이 드디어 채워진다
//   · 찜한 것만 보기 필터
// ===================================================================================

const SORTS = {
    '추천': null,
    '신상순': (a, b) => b.idx - a.idx,
    '할인율': (a, b) => b.discountRate - a.discountRate,
    '낮은가격': (a, b) => a.price - b.price,
    '높은가격': (a, b) => b.price - a.price,
};

export function StorePage() {
    const { favoriteProducts, toggleProductFavorite } = useAuth();
    const [cat, setCat] = useState('전체');
    const [sort, setSort] = useState('추천');
    const [term, setTerm] = useState('');
    const [favOnly, setFavOnly] = useState(false);

    const cats = useMemo(() => ['전체', ...CATEGORIES], []);
    const maxRate = useMemo(() => Math.max(0, ...PRODUCTS.map(p => p.discountRate)), []);
    const newDrops = useMemo(() => PRODUCTS.filter(p => p.cat === '신상'), []);

    const filtered = useMemo(() => {
        let list = byCategory(cat);

        const q = term.trim().toLowerCase();
        if (q) {
            // 이름·색상·카테고리·브랜드를 함께 본다. '검정 라켓'처럼 두 단어를 넣어도
            // 걸리도록 공백으로 쪼개 모두 포함하는 것만 남긴다.
            const words = q.split(/\s+/);
            list = list.filter(p => {
                const hay = [p.name, p.color, p.cat, p.brand].filter(Boolean).join(' ').toLowerCase();
                return words.every(w => hay.includes(w));
            });
        }

        if (favOnly) list = list.filter(p => favoriteProducts.includes(p.idx));

        const cmp = SORTS[sort];
        // 품절은 항상 뒤로 — 살 수 없는 상품이 맨 앞에 있으면 헛걸음이 된다
        const stockFirst = (a, b) => Number(a.soldOut) - Number(b.soldOut);
        return [...list].sort((a, b) => stockFirst(a, b) || (cmp ? cmp(a, b) : 0));
    }, [cat, sort, term, favOnly, favoriteProducts]);

    const fetchedLabel = FETCHED_AT
        ? new Date(FETCHED_AT).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
        : null;

    const searching = term.trim().length > 0;

    return (
        <div className="min-h-full bg-ink pb-8">
            {/* ── ① 브랜드 헤더 ── */}
            <div className="px-5 pt-5 pb-4 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-volt flex items-center justify-center">
                        <span className="font-display text-ink text-sm leading-none">NE</span>
                    </div>
                    <div>
                        <h1 className="font-display display-italic text-xl leading-none text-txt">NOERROR STORE</h1>
                        <p className="text-[10px] font-bold text-dim mt-1">
                            공식 파트너 · {PRODUCTS.length}종 · 최대 <span className="text-coral">{maxRate}%</span>
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => window.open(NOERROR_URL, '_blank', 'noopener,noreferrer')}
                    className="flex items-center gap-1 px-3.5 py-2 rounded-full bg-white/5 border border-white/10 text-[11px] font-black text-dim active:scale-95 transition-transform"
                >
                    공식몰 <ArrowUpRight size={12} />
                </button>
            </div>

            {/* 신상 구역은 검색 중에는 숨긴다 — 찾는 게 있는 사람에게는 방해다 */}
            {!searching && !favOnly && (
                <>
                    <div className="px-5">
                        <NewDropHero products={newDrops} />
                    </div>

                    <div className="mt-7 px-5">
                        <div className="flex items-baseline justify-between mb-3">
                            <div>
                                <span className="text-[10px] font-black label text-volt">2026 S/S Collection</span>
                                <h2 className="text-lg font-black text-txt kern-tight leading-none mt-0.5">방금 나온 신상</h2>
                            </div>
                            <button
                                onClick={() => { setCat('신상'); setSort('신상순'); }}
                                className="text-[11px] font-black text-dim flex items-center label"
                            >
                                전체 <ChevronRight size={14} />
                            </button>
                        </div>
                        <div
                            className="flex gap-3 overflow-x-auto hide-scrollbar -mx-5 px-5 pb-1"
                            style={{ overscrollBehaviorX: 'contain' }}
                        >
                            {newDrops.map(p => (
                                <ProductCardH
                                    key={p.idx}
                                    product={p}
                                    isFavorite={favoriteProducts.includes(p.idx)}
                                    onToggleFavorite={toggleProductFavorite}
                                />
                            ))}
                        </div>
                    </div>
                </>
            )}

            {/* ── ④ 검색 + 카테고리 + 정렬 (붙는 헤더) ── */}
            <div className="sticky top-0 glass z-10 border-b border-white/[0.06] mt-7">
                <div className="px-5 pt-3.5">
                    <div className="relative">
                        <input
                            type="search"
                            value={term}
                            onChange={e => setTerm(e.target.value)}
                            placeholder="상품 이름·색상 검색"
                            aria-label="상품 검색"
                            className="w-full p-3 pl-10 pr-10 bg-card2 rounded-xl border border-white/10 focus:border-volt outline-none text-sm font-bold text-txt placeholder-muted"
                        />
                        <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                        {term && (
                            <button
                                onClick={() => setTerm('')}
                                aria-label="검색어 지우기"
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-dim p-1"
                            >
                                <X size={15} />
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex gap-2 overflow-x-auto hide-scrollbar px-5 pt-2.5 pb-2.5">
                    <button
                        onClick={() => setFavOnly(v => !v)}
                        aria-pressed={favOnly}
                        className={`flex-shrink-0 px-3.5 py-2 rounded-full text-[13px] font-black transition-all whitespace-nowrap flex items-center gap-1 ${
                            favOnly ? 'bg-volt text-ink' : 'bg-white/5 text-dim border border-white/10'
                        }`}
                    >
                        <Heart size={13} fill={favOnly ? 'currentColor' : 'none'} />
                        찜 {favoriteProducts.length > 0 ? favoriteProducts.length : ''}
                    </button>
                    {cats.map(c => (
                        <button
                            key={c}
                            onClick={() => setCat(c)}
                            aria-pressed={cat === c}
                            className={`flex-shrink-0 px-4 py-2 rounded-full text-[13px] font-black transition-all whitespace-nowrap ${
                                cat === c ? 'bg-volt text-ink' : 'bg-white/5 text-dim border border-white/10'
                            }`}
                        >
                            {c}
                        </button>
                    ))}
                </div>

                <div className="flex items-center justify-between px-5 pb-2.5">
                    <span className="text-[11px] font-black text-muted tabular">{filtered.length}개 상품</span>
                    <div className="flex gap-0.5">
                        {Object.keys(SORTS).map(s => (
                            <button
                                key={s}
                                onClick={() => setSort(s)}
                                aria-pressed={sort === s}
                                className={`px-2 py-1 rounded-full text-[11px] font-black transition-colors ${sort === s ? 'text-volt bg-volt/10' : 'text-muted'}`}
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── ⑤ 상품 그리드 ── */}
            {filtered.length > 0 ? (
                <div className="px-5 pt-4 grid grid-cols-2 gap-3">
                    {filtered.map(p => (
                        <ProductCardGrid
                            key={p.idx}
                            product={p}
                            isFavorite={favoriteProducts.includes(p.idx)}
                            onToggleFavorite={toggleProductFavorite}
                        />
                    ))}
                </div>
            ) : (
                <div className="px-5 py-16 text-center">
                    <p className="text-sm text-dim font-bold">
                        {favOnly ? '아직 찜한 상품이 없어요.' : searching ? '검색 결과가 없습니다.' : '이 분류에는 상품이 없습니다.'}
                    </p>
                    {favOnly && (
                        <p className="text-xs text-muted font-medium mt-1.5">
                            상품 사진 오른쪽 위 하트를 눌러 담아보세요.
                        </p>
                    )}
                </div>
            )}

            {/* ── ⑥ 공식몰 배너 + 데이터 기준 ── */}
            <div className="px-5 mt-8">
                <button
                    onClick={() => window.open(NOERROR_URL, '_blank', 'noopener,noreferrer')}
                    className="w-full rounded-2xl overflow-hidden border border-white/[0.06] active:scale-[0.99] transition-transform"
                >
                    <img src={noErrorBanner} alt="NOERROR 공식몰 바로가기" className="w-full h-auto object-cover" />
                </button>
                <p className="text-center text-[11px] text-muted font-bold mt-3">
                    본 스토어는 콕스타 공식 파트너 <span className="text-volt">NOERROR</span> 와 함께합니다.
                </p>
                {fetchedLabel && (
                    <p className="text-center text-[10px] text-muted/70 font-bold mt-1">
                        가격 정보 기준 {fetchedLabel} · 실제 가격과 재고는 공식몰에서 확인하세요
                    </p>
                )}
            </div>
        </div>
    );
}
