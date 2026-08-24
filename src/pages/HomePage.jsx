import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useRooms } from '../context/RoomsContext';
import {
    PRODUCTS, FETCHED_AT, newArrivals, bestDeals, gearPicks, categoryThumb,
} from '../lib/products';
import { ProductCardH, ProductCardWide, ProductImage } from '../components/ProductCards';
import { SkeletonCard, SkeletonStoreCard } from '../components/ui/Feedback';
import { decorateRooms, sortRooms } from '../lib/roomSort';
import { RoomCard } from '../features/room/RoomCard';
import {
    ArrowUpRight, ChevronRight, FlameRaw, ZapRaw, TrophyRaw, Archive, Plus,
} from '../components/ui/icons';

// ===================================================================================
// 홈
// -----------------------------------------------------------------------------------
// 구성 순서에 의도가 있다.
//   ① 인사 → ② 배너 → ③ 카테고리 → ④ 신상 → ⑤ 특가 → ⑥ 장비
//   → ⑦ 파트너 배너 → ⑧ 지금 뜨는 경기 (맨 아래)
//
// '지금 뜨는 경기'는 요청에 따라 맨 아래에 둔다 — 경기를 찾는 사람은 어차피
// 하단 '경기' 탭으로 바로 가고, 홈은 상품·소식 위주로 쓴다.
// 상품 구역은 가로 스크롤 한 줄씩으로 짧게 끊었다. (세로로 길게 늘어놓으면
// 스토어 앱처럼 보인다)
//
// [고친 것] '지금 뜨는 경기'가 오산시·수원시로 하드코딩된 가짜 카드였다.
//   실제로는 존재하지 않는 방이라 누르면 그냥 목록으로 튕겼다. 이제 진짜 방을
//   보여준다 — 지금 경기가 돌아가는 방, 없으면 최근에 운영된 방 순으로.
// ===================================================================================

const DEAL_MAX = Math.max(0, ...PRODUCTS.map(p => p.discountRate));

const bannerSlides = [
    {
        kicker: 'NOERROR · 2026 S/S',
        title: '새 시즌,\n장비를 바꿔라',
        sub: `노에러 신상 컬렉션 ${PRODUCTS.filter(p => p.cat === '신상').length}종`,
        cta: '신상 보기', to: '/store', accent: 'volt', art: FlameRaw,
    },
    {
        kicker: 'TONIGHT',
        title: '오늘 저녁,\n빈 코트를 찾아라',
        sub: '내 주변 실시간 경기방',
        cta: '경기 찾기', to: '/game', accent: 'volt', art: ZapRaw,
    },
    {
        kicker: 'NOERROR · OUTLET',
        title: `지금 최대\n${DEAL_MAX}% 할인`,
        sub: `아웃렛 특가 ${PRODUCTS.filter(p => p.discountRate >= 30).length}종`,
        cta: '특가 보기', to: '/store', accent: 'coral', art: TrophyRaw,
    },
];

function MainBanner({ onNavigate }) {
    const [index, setIndex] = useState(0);
    const timeoutRef = useRef(null);
    const dragStartX = useRef(0);
    const containerRef = useRef(null);
    const dragging = useRef(false);
    const moved = useRef(false);

    const clear = () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
    const next = () => setIndex(p => (p === bannerSlides.length - 1 ? 0 : p + 1));

    useEffect(() => {
        clear();
        timeoutRef.current = setTimeout(next, 5000);
        return clear;
    }, [index]);

    const onDragStart = (e) => {
        dragging.current = true;
        moved.current = false;
        dragStartX.current = e.clientX ?? e.touches[0].clientX;
        clear();
        if (containerRef.current) containerRef.current.style.transition = 'none';
    };
    const onDragMove = (e) => {
        if (!dragging.current) return;
        const x = e.clientX ?? e.touches[0].clientX;
        const diff = dragStartX.current - x;
        if (Math.abs(diff) > 6) moved.current = true;
        if (containerRef.current) {
            containerRef.current.style.transform = `translateX(calc(-${index * 100}% - ${diff}px))`;
        }
    };
    const onDragEnd = (e) => {
        if (!dragging.current) return;
        dragging.current = false;
        const x = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
        const diff = dragStartX.current - x;
        if (containerRef.current) containerRef.current.style.transition = 'transform 0.4s ease-in-out';
        if (Math.abs(diff) > 50) {
            if (diff > 0) next();
            else setIndex(p => (p === 0 ? bannerSlides.length - 1 : p - 1));
        } else if (containerRef.current) {
            containerRef.current.style.transform = `translateX(-${index * 100}%)`;
        }
        timeoutRef.current = setTimeout(next, 5000);
    };

    return (
        <section
            className="relative w-full overflow-hidden rounded-3xl select-none border border-white/[0.06]"
            onMouseDown={onDragStart} onMouseMove={onDragMove} onMouseUp={onDragEnd} onMouseLeave={onDragEnd}
            onTouchStart={onDragStart} onTouchMove={onDragMove} onTouchEnd={onDragEnd}
        >
            <div
                ref={containerRef}
                className="flex transition-transform duration-400 ease-in-out"
                style={{ transform: `translateX(-${index * 100}%)` }}
            >
                {bannerSlides.map((slide, i) => {
                    const Art = slide.art;
                    const accent = slide.accent === 'coral' ? 'text-coral' : 'text-volt';
                    return (
                        <div
                            key={i}
                            role="button"
                            tabIndex={0}
                            onClick={() => { if (!moved.current) onNavigate(slide.to); }}
                            onKeyDown={(e) => { if (e.key === 'Enter') onNavigate(slide.to); }}
                            className="relative w-full h-52 flex-shrink-0 bg-ink grain court-lines overflow-hidden flex flex-col justify-center px-7 cursor-pointer"
                        >
                            <span className={`text-[11px] font-black label ${accent} relative z-10`}>{slide.kicker}</span>
                            <h2 className="mt-2 font-display display-italic text-3xl leading-[0.95] relative z-10 whitespace-pre-line text-txt">
                                {slide.title}
                            </h2>
                            <p className="mt-2 text-xs font-bold relative z-10 text-dim">{slide.sub}</p>
                            <span className={`mt-3 inline-flex items-center gap-1 text-[11px] font-black relative z-10 ${accent}`}>
                                {slide.cta} <ArrowUpRight size={13} />
                            </span>
                            <Art
                                className={`absolute -right-6 -bottom-8 w-44 h-44 ${slide.accent === 'coral' ? 'text-coral/10' : 'text-volt/10'}`}
                                strokeWidth={1}
                            />
                        </div>
                    );
                })}
            </div>
            <div className="absolute bottom-4 right-5 flex space-x-1.5 z-10">
                {bannerSlides.map((_, i) => (
                    <button
                        key={i}
                        onClick={(e) => { e.stopPropagation(); setIndex(i); }}
                        aria-label={`${i + 1}번째 배너 보기`}
                        className={`h-1.5 rounded-full transition-all duration-300 ${index === i ? 'w-6 bg-volt' : 'w-1.5 bg-white/25'}`}
                    />
                ))}
            </div>
        </section>
    );
}

const SectionHeader = ({ title, sub, onMoreClick }) => (
    <div className="flex justify-between items-end mb-4">
        <div>
            {sub && <span className="text-[11px] font-black label text-volt">{sub}</span>}
            <h2 className="text-xl font-black text-txt kern-tight leading-none mt-0.5">{title}</h2>
        </div>
        {onMoreClick && (
            <button
                onClick={onMoreClick}
                className="text-xs font-black text-dim hover:text-txt flex items-center transition-colors label"
            >
                More <ChevronRight size={16} />
            </button>
        )}
    </div>
);

function NoerrorSponsorBanner({ onOpenStore }) {
    return (
        <button
            onClick={onOpenStore}
            className="w-full rounded-3xl overflow-hidden border border-white/[0.06] active:scale-[0.99] transition-transform text-left"
        >
            <div className="relative bg-card grain px-5 py-5 flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-volt flex items-center justify-center shrink-0">
                    <span className="font-display text-ink text-lg leading-none">NE</span>
                </div>
                <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-black label text-volt">Official Partner</span>
                    <h3 className="text-txt font-black text-base kern-tight leading-tight mt-0.5">노에러 공식 스토어</h3>
                    <p className="text-dim text-xs font-bold mt-0.5 truncate">
                        상품 {PRODUCTS.length}종 · 최대 {DEAL_MAX}% 할인
                    </p>
                </div>
                <ArrowUpRight size={20} className="text-dim shrink-0" />
            </div>
        </button>
    );
}

/**
 * 카테고리 바로가기 타일 — 대표 상품 사진 + 아래 라벨.
 *
 * ★ 처음에는 사진 '위에' 어두운 그라디언트를 깔고 글씨를 얹었는데, 4열 타일은
 *   한 칸이 84px밖에 안 돼서 그라디언트가 사진 대부분을 덮었다. 결과적으로
 *   "시커먼 네모 + 글씨"만 보이는 이상한 UI가 됐다. 지금은 사진을 밝은 타일에
 *   그대로 두고 글씨는 타일 '밖' 아래에 둔다.
 */
function CategoryTile({ cat, onClick }) {
    const thumb = categoryThumb(cat);
    const count = PRODUCTS.filter(p => p.cat === cat).length;
    return (
        <button onClick={onClick} className="text-center active:scale-[0.95] transition-transform">
            <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-[#F3F4F6] border border-white/[0.06]">
                <ProductImage src={thumb} alt={cat} className="w-full h-full" />
            </div>
            <p className="font-black text-xs text-txt mt-1.5 leading-none">{cat}</p>
            <p className="text-[10px] text-muted font-bold tabular leading-none mt-1">{count}종</p>
        </button>
    );
}

/**
 * 가로로 넘겨 보는 상품 줄.
 *
 * ★ 이 컴포넌트는 반드시 최상위에 있어야 한다. HomePage 안에서 정의하면
 *   HomePage 가 다시 그려질 때마다 '새로운 컴포넌트 종류'로 취급돼서 안쪽 상품
 *   카드가 통째로 언마운트→재마운트된다. 이미지가 매번 다시 로드되고 스크롤
 *   위치도 초기화된다.
 */
function ProductRow({ items, loading, favorites, onToggleFavorite }) {
    return (
        <div
            className="flex gap-3 overflow-x-auto hide-scrollbar -mx-5 px-5 pb-1"
            style={{ overscrollBehaviorX: 'contain' }}
        >
            {loading
                ? [...Array(4)].map((_, i) => <SkeletonStoreCard key={i} />)
                : items.map(p => (
                    <ProductCardH
                        key={p.idx}
                        product={p}
                        isFavorite={favorites.includes(p.idx)}
                        onToggleFavorite={onToggleFavorite}
                    />
                ))}
        </div>
    );
}

export function HomePage() {
    const navigate = useNavigate();
    const { favoriteProducts, toggleProductFavorite, favorites, toggleRoomFavorite } = useAuth();
    const { rooms, loading: roomsLoading } = useRooms();

    // 정적 JSON이라 실제로는 즉시 준비된다. 예전에는 일부러 700ms 기다렸는데,
    // 가짜 로딩은 앱을 느리게 만들 뿐이고 스켈레톤의 신뢰도까지 떨어뜨린다.
    const deals = useMemo(() => bestDeals(10), []);
    const fresh = useMemo(() => newArrivals(10), []);
    const gear = useMemo(() => gearPicks(8), []);
    const topDeal = deals[0];

    // ── 지금 뜨는 경기 ──
    // 경기가 돌아가는 방을 맨 앞에, 그다음은 최근에 운영된 방.
    const liveRooms = useMemo(() => {
        const decorated = decorateRooms(rooms, { favorites });
        const sorted = sortRooms(decorated, 'recent');
        const playing = sorted.filter(r => (r.playingNow || 0) > 0);
        const rest = sorted.filter(r => (r.playingNow || 0) === 0);
        return [...playing, ...rest].slice(0, 3);
    }, [rooms, favorites]);

    const goStore = () => navigate('/store');

    return (
        <div className="flex-grow p-5 space-y-9 bg-ink">
            <section className="pt-1">
                <h1 className="font-display display-italic text-[30px] leading-[0.95] text-txt">
                    오늘의 코트를<br /><span className="text-volt">정복하라</span>
                </h1>
                <p className="text-sm text-dim font-bold mt-2">지금 뛸 수 있는 경기, 콕스타가 다 모았다.</p>
            </section>

            <MainBanner onNavigate={navigate} />

            {/* 카테고리 바로가기 — 사진 타일이라 뭐가 있는지 바로 보인다 */}
            <section>
                <SectionHeader title="뭐 찾으세요?" sub="Shop by Category" onMoreClick={goStore} />
                <div className="grid grid-cols-4 gap-2.5">
                    {['라켓', '의류', '신발', '가방'].map(c => (
                        <CategoryTile key={c} cat={c} onClick={goStore} />
                    ))}
                </div>
            </section>

            <section>
                <SectionHeader title="노에러 신상" sub="New Arrivals · 2026 S/S" onMoreClick={goStore} />
                <ProductRow
                    items={fresh}
                    favorites={favoriteProducts}
                    onToggleFavorite={toggleProductFavorite}
                />
            </section>

            {topDeal && (
                <section>
                    <SectionHeader title="놓치면 후회할 특가" sub={`Outlet · 최대 ${topDeal.discountRate}%`} onMoreClick={goStore} />
                    <div className="space-y-3">
                        <ProductCardWide product={topDeal} />
                        <ProductRow
                            items={deals.slice(1)}
                            favorites={favoriteProducts}
                            onToggleFavorite={toggleProductFavorite}
                        />
                    </div>
                </section>
            )}

            <section>
                <SectionHeader title="장비 바꿀 때 됐다면" sub="Rackets · Shoes · Bags" onMoreClick={goStore} />
                <ProductRow
                    items={gear}
                    favorites={favoriteProducts}
                    onToggleFavorite={toggleProductFavorite}
                />
            </section>

            <NoerrorSponsorBanner onOpenStore={goStore} />

            {/* ── 지금 뜨는 경기 — 맨 아래 (진짜 방이다) ── */}
            <section>
                <SectionHeader
                    title="지금 뜨는 경기"
                    sub={liveRooms.some(r => r.playingNow > 0) ? 'Live Now' : 'Open Rooms'}
                    onMoreClick={() => navigate('/game')}
                />
                <div className="space-y-3">
                    {roomsLoading ? (
                        <><SkeletonCard /><SkeletonCard /></>
                    ) : liveRooms.length > 0 ? (
                        liveRooms.map(room => (
                            <RoomCard
                                key={room.id}
                                room={room}
                                onEnter={() => navigate(`/room/${room.id}`)}
                                onToggleFavorite={toggleRoomFavorite}
                            />
                        ))
                    ) : (
                        <button
                            onClick={() => navigate('/game')}
                            className="w-full flex flex-col items-center justify-center text-center p-8 rounded-2xl bg-card border border-dashed border-white/10 active:scale-[0.99] transition-transform"
                        >
                            <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mb-3">
                                <Archive className="w-6 h-6 text-volt" />
                            </div>
                            <p className="text-sm font-black text-txt mb-1">아직 열린 경기방이 없어요</p>
                            <p className="text-xs text-dim font-medium mb-4">첫 번째 방을 만들어보세요.</p>
                            <span className="inline-flex items-center gap-1 px-4 py-2 rounded-full bg-volt text-ink text-xs font-black">
                                <Plus size={14} /> 경기방 만들기
                            </span>
                        </button>
                    )}
                </div>
            </section>

            {FETCHED_AT && (
                <p className="text-center text-[10px] text-muted/70 font-bold">
                    상품 가격 기준 {new Date(FETCHED_AT).toLocaleDateString('ko-KR')}
                </p>
            )}
        </div>
    );
}
