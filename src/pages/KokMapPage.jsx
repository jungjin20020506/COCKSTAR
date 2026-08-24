import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRooms } from '../context/RoomsContext';
import {
    GYMS, GYM_COUNT, CLUB_COUNT, CLUB_SOURCE, MAP_FILTERS,
    filterGyms, nearestGyms, searchGyms, clubsInRegion, distanceKm,
} from '../lib/places';
import { toast } from '../lib/toast';
import { logError } from '../lib/errorLog';
import { Search, X, MapPin, Plus, Phone, ArrowUpRight } from '../components/ui/icons';

// ===================================================================================
// 콕맵 — 내 주변 체육관 · 경기방 · 동호회
// -----------------------------------------------------------------------------------
// 표시하는 것
//   · 체육관 — 카카오 로컬 API로 모은 경기도 시·군 (공설/사설/학교 추정 구분)
//   · 경기방 — 콕스타에 실제로 열린 방. 우리만 가진 정보라 눈에 띄게 둔다
//   · 동호회 — 소모임에 등록된 배드민턴 모임 (지역이 맞는 것만, 일부)
//
// ⚠️ 운영시간·요금은 넣지 않았다. 카카오 로컬 API가 주지 않는 값이라 지어낼 수밖에
//    없는데, 틀린 시간을 보고 헛걸음한 사람이 한 명이라도 생기면 지도 전체를 못 믿게 된다.
//    대신 '카카오맵에서 보기'로 넘긴다.
//
// ★ 지도가 없어도 전부 동작한다.
//   카카오 SDK 는 도메인 미등록·네트워크 문제로 안 뜰 수 있다. 8초 안에 못 뜨면
//   목록 전용 모드로 전환한다. 검색·목록·상세·전화·카카오맵 링크는 지도 없이도 된다.
//
// [추가된 것] 체육관 상세에서 바로 '이 체육관에 방 만들기'.
//   콕맵(발견)과 경기방(행동)이 그동안 완전히 끊겨 있었다. 좋은 체육관을 찾아도
//   방을 만들려면 주소를 외워서 다른 탭에서 다시 검색해야 했다.
// ===================================================================================

/**
 * 지도 오버레이에 넣을 문자열을 안전하게 만든다.
 * 경기방 이름은 사용자가 직접 지은 값이라, HTML 에 그대로 끼워 넣으면 태그가 실행된다.
 * (지도를 보기만 해도 실행되므로 클릭조차 필요 없다)
 */
function escapeHtml(text) {
    return String(text ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * 체육관 종류별 색 점 마커 이미지.
 * 카카오 MarkerImage 는 여러 마커가 공유할 수 있어서 종류마다 한 번만 만들어 돌려 쓴다.
 * 수백 개 마커를 찍어도 이미지 객체는 네 개뿐이고, SVG data URI 라 네트워크 요청도 없다.
 */
const GYM_PIN_COLORS = {
    badminton: '#CDFB47',
    public: '#60A5FA',
    private: '#F3F5F8',
    school: '#8C93A1',
};
const gymPinCache = {};
function gymPinImage(kind) {
    const color = GYM_PIN_COLORS[kind] || GYM_PIN_COLORS.private;
    if (gymPinCache[color]) return gymPinCache[color];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><circle cx="8" cy="8" r="5.5" fill="${color}" stroke="#08090C" stroke-width="2"/></svg>`;
    const img = new window.kakao.maps.MarkerImage(
        `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
        new window.kakao.maps.Size(16, 16),
        { offset: new window.kakao.maps.Point(8, 8) },
    );
    gymPinCache[color] = img;
    return img;
}

export function KokMapPage() {
    const navigate = useNavigate();
    const { rooms } = useRooms();

    const mapRef = useRef(null);
    const mapInstance = useRef(null);
    const clustererRef = useRef(null);
    const roomObjectsRef = useRef([]);
    const gymMarkersRef = useRef([]);
    const centerDebounceRef = useRef(null);
    const geocoder = useRef(null);

    const [isMapReady, setIsMapReady] = useState(false);
    const [mapFailed, setMapFailed] = useState(false);
    const [selectedRoom, setSelectedRoom] = useState(null);
    const [selectedGym, setSelectedGym] = useState(null);
    const [activeFilter, setActiveFilter] = useState('badminton');
    const [searchText, setSearchText] = useState('');
    const [sheetOpen, setSheetOpen] = useState(false);
    const [center, setCenter] = useState({ lat: 37.2636, lng: 127.0286 });  // 수원시청

    // ── 지도 만들기 (8초 안에 못 뜨면 목록 전용 모드) ──
    useEffect(() => {
        const container = mapRef.current;
        if (!container) return undefined;

        if (!document.getElementById('kakao-map-style')) {
            const style = document.createElement('style');
            style.id = 'kakao-map-style';
            style.innerHTML = `
                #kakao-map img { max-width: none !important; height: auto !important; border: 0 !important; }
                #kakao-map div { border: 0 !important; }
                .room-label {
                    padding: 4px 9px; background-color: #08090C; border: 1.5px solid #CDFB47;
                    border-radius: 999px; font-size: 11px; font-weight: 900; color: #F3F5F8;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.4); transform: translateY(-45px);
                    white-space: nowrap; position: relative; letter-spacing: -0.02em;
                }
                .room-label::after {
                    content: ''; position: absolute; bottom: -5px; left: 50%; transform: translateX(-50%);
                    border-width: 5px 5px 0; border-style: solid;
                    border-color: #CDFB47 transparent transparent transparent;
                }
            `;
            document.head.appendChild(style);
        }

        let cancelled = false;
        const initMap = () => {
            if (mapInstance.current) { setIsMapReady(true); return true; }
            if (!window.kakao?.maps?.load) return false;

            window.kakao.maps.load(() => {
                if (cancelled) return;
                try {
                    const map = new window.kakao.maps.Map(container, {
                        center: new window.kakao.maps.LatLng(37.2636, 127.0286),
                        level: 7,
                    });
                    mapInstance.current = map;
                    geocoder.current = window.kakao.maps.services
                        ? new window.kakao.maps.services.Geocoder() : null;

                    try {
                        if (window.kakao.maps.MarkerClusterer) {
                            clustererRef.current = new window.kakao.maps.MarkerClusterer({
                                map, averageCenter: true, minLevel: 5, disableClickZoom: false,
                            });
                        }
                    } catch { clustererRef.current = null; }

                    window.kakao.maps.event.addListener(map, 'click', () => {
                        setSelectedRoom(null); setSelectedGym(null);
                    });
                    // 지도를 옮기면 목록도 따라온다. idle 은 드래그 중에도 계속 튀므로
                    // 400ms 디바운스로 묶는다 — 안 그러면 지도만 만져도 화면 전체가 계속 다시 그려진다.
                    window.kakao.maps.event.addListener(map, 'idle', () => {
                        clearTimeout(centerDebounceRef.current);
                        centerDebounceRef.current = setTimeout(() => {
                            const c = map.getCenter();
                            setCenter({ lat: c.getLat(), lng: c.getLng() });
                        }, 400);
                    });
                    setIsMapReady(true);
                } catch (e) {
                    logError('지도 초기화', e);
                    setMapFailed(true);
                }
            });
            return true;
        };

        if (initMap()) return () => { cancelled = true; };

        const id = setInterval(() => { if (initMap()) clearInterval(id); }, 100);
        // ★ 8초가 지나도 SDK 가 안 오면 포기를 선언한다.
        //   예전에는 이 인터벌이 영원히 돌아서 회색 화면 앞에서 기다리게 했다.
        const giveUp = setTimeout(() => {
            clearInterval(id);
            if (!mapInstance.current) setMapFailed(true);
        }, 8000);
        return () => { cancelled = true; clearInterval(id); clearTimeout(giveUp); };
    }, []);

    // ── 체육관 핀 ──
    useEffect(() => {
        if (!isMapReady || !window.kakao) return undefined;
        const map = mapInstance.current;
        const clusterer = clustererRef.current;

        const list = filterGyms(activeFilter);
        if (clusterer) clusterer.clear();
        gymMarkersRef.current.forEach(m => m.setMap(null));
        gymMarkersRef.current = [];
        if (list.length === 0) return undefined;

        const markers = list.map(gym => {
            const kind = gym.isBadminton ? 'badminton' : gym.ownership;
            const marker = new window.kakao.maps.Marker({
                position: new window.kakao.maps.LatLng(gym.lat, gym.lng),
                image: gymPinImage(kind),
                title: gym.name,
                clickable: true,
            });
            window.kakao.maps.event.addListener(marker, 'click', () => {
                map.panTo(marker.getPosition());
                setSelectedGym(gym);
                setSelectedRoom(null);
                setSheetOpen(true);
            });
            return marker;
        });

        gymMarkersRef.current = markers;
        if (clusterer) clusterer.addMarkers(markers);
        else markers.forEach(m => m.setMap(map));

        return () => {
            if (clusterer) clusterer.clear();
            markers.forEach(m => m.setMap(null));
            gymMarkersRef.current = [];
        };
    }, [isMapReady, activeFilter]);

    // ── 경기방 핀 ──
    useEffect(() => {
        if (!isMapReady || !window.kakao) return undefined;
        const map = mapInstance.current;
        roomObjectsRef.current.forEach(o => { o.marker.setMap(null); o.overlay.setMap(null); });

        const next = [];
        rooms.forEach(room => {
            if (!room.coords?.lat || !room.coords?.lng) return;
            const pos = new window.kakao.maps.LatLng(room.coords.lat, room.coords.lng);
            const marker = new window.kakao.maps.Marker({ position: pos, map, clickable: true });
            const overlay = new window.kakao.maps.CustomOverlay({
                // 방 이름은 사용자 입력이다 — HTML 로 그대로 넣으면 태그가 실행된다
                position: pos, content: `<div class="room-label">${escapeHtml(room.name)}</div>`, map, yAnchor: 1,
            });
            window.kakao.maps.event.addListener(marker, 'click', () => {
                map.panTo(pos); setSelectedRoom(room); setSelectedGym(null); setSheetOpen(true);
            });
            next.push({ marker, overlay });
        });
        roomObjectsRef.current = next;
        return () => next.forEach(o => { o.marker.setMap(null); o.overlay.setMap(null); });
    }, [rooms, isMapReady]);

    // ── 검색 ──
    const handleSearch = () => {
        const q = searchText.trim();
        if (!q) return;
        const hit = searchGyms(q, 1)[0];
        if (hit) {
            setSelectedGym(hit); setSelectedRoom(null); setSheetOpen(true);
            if (mapInstance.current && window.kakao?.maps) {
                mapInstance.current.panTo(new window.kakao.maps.LatLng(hit.lat, hit.lng));
                mapInstance.current.setLevel(4);
            }
            return;
        }
        if (geocoder.current && mapInstance.current) {
            geocoder.current.addressSearch(q, (result, status) => {
                if (status === window.kakao.maps.services.Status.OK && result[0]) {
                    const pos = new window.kakao.maps.LatLng(result[0].y, result[0].x);
                    mapInstance.current.panTo(pos);
                    setCenter({ lat: Number(result[0].y), lng: Number(result[0].x) });
                    setSheetOpen(true);
                } else toast.error('검색 결과가 없습니다.');
            });
        } else {
            setSheetOpen(true);
            if (searchGyms(q, 1).length === 0) toast.error('이름·주소에 일치하는 체육관이 없습니다.');
        }
    };

    const handleMyLoc = () => {
        if (!navigator.geolocation) { toast.error('위치 정보를 사용할 수 없습니다.'); return; }
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                setCenter(p);   // 지도 없는 모드에서도 '가까운 순' 목록이 내 위치 기준이 된다
                if (mapInstance.current && window.kakao?.maps) {
                    mapInstance.current.panTo(new window.kakao.maps.LatLng(p.lat, p.lng));
                    mapInstance.current.setLevel(5);
                }
                setSheetOpen(true);
            },
            () => toast.error('위치 권한이 필요합니다.'),
        );
    };

    // ── 목록 ──
    const listedGyms = useMemo(() => {
        const q = searchText.trim();
        if (q) return searchGyms(q, 30);
        const pool = activeFilter === 'room' ? GYMS : filterGyms(activeFilter);
        return nearestGyms(center.lat, center.lng, pool, 30);
    }, [searchText, activeFilter, center.lat, center.lng]);

    const nearbyClubs = useMemo(
        () => (selectedGym ? clubsInRegion(selectedGym.region) : []),
        [selectedGym],
    );

    const roomsAtGym = useMemo(() => {
        if (!selectedGym) return [];
        return rooms.filter(r => r.coords?.lat
            && distanceKm(selectedGym.lat, selectedGym.lng, r.coords.lat, r.coords.lng) < 1);
    }, [selectedGym, rooms]);

    /** 이 체육관 정보를 들고 방 개설 화면으로 간다 */
    const createRoomHere = (gym) => {
        navigate('/game', {
            state: {
                prefill: {
                    address: gym.address,
                    locationName: gym.name,
                    coords: { lat: gym.lat, lng: gym.lng },
                },
            },
        });
    };

    // 체육관 상세 — 지도 모드의 아래 시트와 '지도 실패' 목록 모드 양쪽에서 그대로 쓴다.
    // 한쪽에만 두면 다른 쪽에서 목록을 눌러도 아무 일도 안 일어나는 버그가 된다.
    const gymDetailView = selectedGym && (
        <div>
            <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${selectedGym.isBadminton ? 'bg-volt text-ink' : 'bg-white/10 text-dim'}`}>
                            {selectedGym.isBadminton ? '배드민턴' : selectedGym.ownershipLabel}
                        </span>
                        <span className="text-[10px] font-bold text-muted">{selectedGym.region}</span>
                    </div>
                    <h3 className="text-lg font-black text-txt kern-tight leading-tight">{selectedGym.name}</h3>
                    <p className="text-xs text-dim font-bold mt-1">{selectedGym.address}</p>
                </div>
                <button onClick={() => setSelectedGym(null)} aria-label="닫기" className="p-1 text-dim shrink-0">
                    <X size={20} />
                </button>
            </div>

            <div className="flex gap-2">
                {selectedGym.phone && (
                    <a
                        href={`tel:${selectedGym.phone}`}
                        className="flex-1 py-2.5 bg-white/5 text-txt font-black rounded-xl text-xs text-center border border-white/10 flex items-center justify-center gap-1"
                    >
                        <Phone size={13} /> 전화
                    </a>
                )}
                <a
                    href={selectedGym.kakaoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-[2] py-2.5 bg-white/5 text-txt font-black rounded-xl text-xs text-center border border-white/10 flex items-center justify-center gap-1"
                >
                    카카오맵에서 보기 <ArrowUpRight size={12} />
                </a>
            </div>

            {/* 콕맵(발견) → 경기방(행동)을 잇는 다리 */}
            <button
                onClick={() => createRoomHere(selectedGym)}
                className="w-full mt-2 py-3 bg-volt text-ink font-black rounded-xl text-sm flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform"
            >
                <Plus size={16} strokeWidth={2.6} /> 이 체육관에 경기방 만들기
            </button>

            <p className="text-[10px] text-muted font-bold mt-2 text-center">
                운영시간·이용료는 카카오맵 또는 전화로 확인해주세요
            </p>

            {roomsAtGym.length > 0 && (
                <div className="mt-5">
                    <h4 className="text-[11px] font-black label text-volt mb-2">여기 열린 경기방 {roomsAtGym.length}</h4>
                    <div className="space-y-2">
                        {roomsAtGym.map(r => (
                            <button
                                key={r.id}
                                onClick={() => navigate(`/room/${r.id}`)}
                                className="w-full text-left p-3 bg-card rounded-xl border border-volt/30"
                            >
                                <p className="text-sm font-black text-txt truncate">{r.name}</p>
                                <p className="text-[11px] text-dim font-bold mt-0.5">
                                    {r.location} · {r.playerCount || 0}/{r.maxPlayers}명
                                </p>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {nearbyClubs.length > 0 && (
                <div className="mt-5">
                    <h4 className="text-[11px] font-black label text-dim mb-2">
                        {selectedGym.region} 동호회 {nearbyClubs.length}
                    </h4>
                    <div className="space-y-2">
                        {nearbyClubs.slice(0, 5).map(c => (
                            <a
                                key={c.id}
                                href={c.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block p-3 bg-card rounded-xl border border-white/[0.06]"
                            >
                                <p className="text-sm font-black text-txt truncate">{c.name}</p>
                                {c.description && (
                                    <p className="text-[11px] text-dim font-medium mt-0.5 line-clamp-2">{c.description}</p>
                                )}
                                <p className="text-[10px] text-muted font-bold mt-1">
                                    {c.region}{c.members ? ` · 멤버 ${c.members}` : ''} · 소모임
                                </p>
                            </a>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );

    const hasDetail = !!(selectedGym || selectedRoom);

    /** 목록 아이템 — 컴포넌트가 아니라 렌더 함수다. 내부 컴포넌트는 매 렌더마다 재마운트된다 */
    const renderGymRow = (g) => (
        <button
            key={g.id}
            onClick={() => {
                setSelectedGym(g); setSelectedRoom(null); setSheetOpen(true);
                if (mapInstance.current && window.kakao?.maps) {
                    mapInstance.current.panTo(new window.kakao.maps.LatLng(g.lat, g.lng));
                }
            }}
            className="w-full text-left p-3 bg-card rounded-xl border border-white/[0.06] flex items-center gap-3 active:scale-[0.99] transition-transform"
        >
            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${g.isBadminton ? 'bg-volt' : g.ownership === 'public' ? 'bg-blue-400' : g.ownership === 'school' ? 'bg-muted' : 'bg-txt'}`} />
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                    <p className="text-sm font-black text-txt truncate">{g.name}</p>
                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-white/5 text-muted shrink-0">
                        {g.ownershipLabel}
                    </span>
                </div>
                <p className="text-[11px] text-dim font-bold truncate mt-0.5">{g.address}</p>
            </div>
            {g.distance !== undefined && (
                <span className="text-[10px] font-black text-muted tabular shrink-0">
                    {g.distance < 1 ? `${Math.round(g.distance * 1000)}m` : `${g.distance.toFixed(1)}km`}
                </span>
            )}
        </button>
    );

    return (
        <div className="relative h-full w-full flex flex-col bg-ink overflow-hidden">
            {/* ── ① 고정 헤더: 검색 + 필터 ── */}
            <div className="flex-shrink-0 bg-surface border-b border-white/[0.06] px-4 pt-3 pb-2.5 z-20">
                <div className="bg-card rounded-2xl border border-white/10 flex items-center p-2 pl-3.5">
                    <Search size={17} className="text-muted mr-2 shrink-0" />
                    <input
                        type="search"
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
                        placeholder="체육관 이름·주소 검색"
                        aria-label="체육관 검색"
                        className="flex-1 bg-transparent outline-none text-sm font-bold text-txt placeholder-muted min-w-0"
                    />
                    {searchText && (
                        <button onClick={() => setSearchText('')} aria-label="검색어 지우기" className="p-1 text-dim">
                            <X size={16} />
                        </button>
                    )}
                    <button
                        onClick={handleSearch}
                        className="px-3.5 py-1.5 rounded-xl bg-volt text-ink text-xs font-black ml-1 shrink-0"
                    >
                        검색
                    </button>
                </div>
                <div className="flex gap-1.5 overflow-x-auto hide-scrollbar mt-2.5 -mx-4 px-4">
                    {MAP_FILTERS.map(f => (
                        <button
                            key={f.key}
                            onClick={() => { setActiveFilter(f.key); setSelectedGym(null); setSelectedRoom(null); }}
                            aria-pressed={activeFilter === f.key}
                            className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-black transition-all whitespace-nowrap ${activeFilter === f.key ? 'bg-volt text-ink' : 'bg-white/5 text-dim border border-white/10'}`}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── ② 지도 (실패하면 목록 전용 모드) ── */}
            <div className="relative flex-grow min-h-0">
                {mapFailed ? (
                    <div className="absolute inset-0 overflow-y-auto hide-scrollbar bg-ink px-4 pt-3 pb-24">
                        {selectedGym ? gymDetailView : (
                            <>
                                <div className="mb-3 p-3 rounded-xl bg-coral/10 border border-coral/30">
                                    <p className="text-xs font-black text-coral">지도를 불러오지 못했습니다</p>
                                    <p className="text-[11px] text-dim font-bold mt-1 leading-relaxed">
                                        네트워크 상태를 확인해주세요. 체육관 검색과 목록은 그대로 쓸 수 있습니다.
                                    </p>
                                </div>
                                <div className="space-y-2">{listedGyms.map(renderGymRow)}</div>
                            </>
                        )}
                    </div>
                ) : (
                    <>
                        <div id="kakao-map" ref={mapRef} className="absolute inset-0 bg-[#1a1c22]" />
                        {!isMapReady && (
                            <div className="absolute inset-0 flex items-center justify-center bg-ink/60">
                                <span className="text-xs font-black label text-muted animate-pulse">지도를 불러오는 중…</span>
                            </div>
                        )}
                        <div className="absolute right-3.5 bottom-3.5 flex flex-col gap-2 z-10">
                            <button
                                onClick={() => mapInstance.current?.setLevel(mapInstance.current.getLevel() - 1, { animate: true })}
                                aria-label="지도 확대"
                                className="w-10 h-10 glass rounded-xl border border-white/10 flex items-center justify-center text-txt font-black text-lg shadow-deep"
                            >
                                +
                            </button>
                            <button
                                onClick={() => mapInstance.current?.setLevel(mapInstance.current.getLevel() + 1, { animate: true })}
                                aria-label="지도 축소"
                                className="w-10 h-10 glass rounded-xl border border-white/10 flex items-center justify-center text-txt font-black text-lg shadow-deep"
                            >
                                −
                            </button>
                            <button
                                onClick={handleMyLoc}
                                aria-label="내 위치로 이동"
                                className="w-10 h-10 glass rounded-xl border border-white/10 flex items-center justify-center text-volt shadow-deep"
                            >
                                <MapPin size={18} />
                            </button>
                        </div>
                    </>
                )}
            </div>

            {/* ── ③ 아래 시트 ── */}
            {!mapFailed && (
                <div className={`flex-shrink-0 bg-surface border-t border-white/10 rounded-t-3xl z-20 transition-all duration-300 flex flex-col ${sheetOpen ? 'h-[58vh]' : 'h-auto'}`}>
                    <button
                        onClick={() => {
                            if (sheetOpen && hasDetail) { setSelectedGym(null); setSelectedRoom(null); }
                            setSheetOpen(!sheetOpen);
                        }}
                        aria-expanded={sheetOpen}
                        aria-label={sheetOpen ? '목록 접기' : '목록 펼치기'}
                        className="flex-shrink-0 w-full pt-2.5 pb-2 flex flex-col items-center"
                    >
                        <span className="w-10 h-1 rounded-full bg-white/20" />
                        {!sheetOpen && (
                            <div className="flex items-center gap-2 mt-2 pb-1">
                                <span className="text-sm font-black text-txt">
                                    이 근처 체육관 <span className="text-volt tabular">{listedGyms.length}</span>
                                </span>
                                <span className="text-[10px] font-bold text-muted">눌러서 열기</span>
                            </div>
                        )}
                    </button>

                    {sheetOpen && (
                        <div className="flex-1 min-h-0 overflow-y-auto hide-scrollbar px-4 pb-6">
                            {selectedGym ? gymDetailView : selectedRoom ? (
                                <div>
                                    <div className="flex items-start justify-between gap-3 mb-2">
                                        <div className="min-w-0">
                                            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-volt text-ink">경기방</span>
                                            <h3 className="text-lg font-black text-txt kern-tight leading-tight mt-1.5">{selectedRoom.name}</h3>
                                            <p className="text-xs text-dim font-bold mt-1">{selectedRoom.location} · {selectedRoom.address}</p>
                                        </div>
                                        <button onClick={() => setSelectedRoom(null)} aria-label="닫기" className="p-1 text-dim shrink-0">
                                            <X size={20} />
                                        </button>
                                    </div>
                                    <p className="text-xs text-dim font-medium leading-relaxed">{selectedRoom.description}</p>
                                    <button
                                        onClick={() => navigate(`/room/${selectedRoom.id}`)}
                                        className="w-full mt-4 py-3 bg-volt text-ink font-black rounded-full text-sm"
                                    >
                                        경기방 보러가기
                                    </button>
                                </div>
                            ) : (
                                <div>
                                    <div className="flex items-center justify-between mb-2.5">
                                        <h3 className="text-sm font-black text-txt">
                                            {searchText.trim() ? '검색 결과' : '가까운 체육관'}
                                            <span className="text-volt tabular ml-1.5">{listedGyms.length}</span>
                                        </h3>
                                        <div className="flex items-center gap-2">
                                            {[['bg-volt', '배드민턴'], ['bg-blue-400', '공설'], ['bg-txt', '사설']].map(([c, l]) => (
                                                <span key={l} className="flex items-center gap-1">
                                                    <span className={`w-1.5 h-1.5 rounded-full ${c}`} />
                                                    <span className="text-[9px] font-black text-muted">{l}</span>
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                    {listedGyms.length === 0 ? (
                                        <p className="text-center text-sm text-dim font-bold py-8">조건에 맞는 체육관이 없습니다.</p>
                                    ) : (
                                        <div className="space-y-2">{listedGyms.map(renderGymRow)}</div>
                                    )}
                                    <p className="text-center text-[10px] text-muted/70 font-bold mt-4 leading-relaxed">
                                        경기도 {GYM_COUNT}곳 · 출처 카카오맵 | 동호회 {CLUB_COUNT}개 · 출처 {CLUB_SOURCE}
                                        <br />공설/사설은 이름 기준 추정입니다
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
