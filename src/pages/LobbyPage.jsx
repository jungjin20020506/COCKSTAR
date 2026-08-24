import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { collection, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useRooms } from '../context/RoomsContext';
import { useConfirm } from '../components/ui/confirm';
import { useTutorial } from '../features/tutorial/useTutorial';
import { CREATE_ROOM_GUIDE_KEY } from '../features/tutorial/guideKeys';
import { CreateRoomGuide } from '../features/tutorial/CreateRoomGuide';
import { CreateRoomModal } from '../features/room/CreateRoomModal';
import { EditRoomInfoModal } from '../features/room/EditRoomInfoModal';
import { RoomCard } from '../features/room/RoomCard';
import { SkeletonRoomCard, EmptyState, LoginRequiredPage } from '../components/ui/Feedback';
import { Search, Plus, Archive, ShieldCheck, ArrowUpDown, Navigation, X } from '../components/ui/icons';
import { ROOM_SORTS, decorateRooms, sortRooms, filterRooms } from '../lib/roomSort';
import { usePullToRefresh, PullIndicator } from '../lib/usePullToRefresh.jsx';
import { isRoomAdmin } from '../lib/adminInvite';
import { toast } from '../lib/toast';
import { logError } from '../lib/errorLog';

// ===================================================================================
// 경기 로비 — 방 찾기
// -----------------------------------------------------------------------------------
// [바뀐 것]
//   · 정렬을 고를 수 있다 (최근 운영 / 가까운 / 사람 많은 / 최신 / 이름)
//   · 찜한 방은 어떤 정렬에서도 맨 위
//   · 방 목록 구독을 RoomsContext 하나로 합쳤다 (콕맵과 공유)
//   · 방을 처음 만드는 사람에게 안내가 한 번 나온다
// ===================================================================================

const SORT_STORAGE_KEY = 'cockstar-room-sort';

export function LobbyPage({ onLoginClick }) {
    const navigate = useNavigate();
    const location = useLocation();
    const confirm = useConfirm();
    const { user, userData, favorites, toggleRoomFavorite, superAdmin } = useAuth();
    const { rooms, loading } = useRooms();
    const { hasSeen, markSeen } = useTutorial(user, userData);

    const [term, setTerm] = useState('');
    const [sortKey, setSortKey] = useState(() => {
        try { return localStorage.getItem(SORT_STORAGE_KEY) || 'recent'; }
        catch { return 'recent'; }
    });
    const [sortOpen, setSortOpen] = useState(false);
    const [myLoc, setMyLoc] = useState(null);
    const [locating, setLocating] = useState(false);

    const [showCreate, setShowCreate] = useState(false);
    const [showCreateGuide, setShowCreateGuide] = useState(false);
    const [editRoom, setEditRoom] = useState(null);
    const [prefill, setPrefill] = useState(null);

    // 콕맵의 '이 체육관에 방 만들기'에서 넘어온 경우 — 주소가 채워진 개설 창을 바로 연다
    useEffect(() => {
        const p = location.state?.prefill;
        if (!p || !user) return;
        setPrefill(p);
        // 같은 state 로 다시 열리지 않게 지운다 (뒤로가기로 돌아와도 창이 또 뜨면 안 된다)
        navigate(location.pathname, { replace: true, state: null });
        if (!hasSeen(CREATE_ROOM_GUIDE_KEY)) setShowCreateGuide(true);
        else setShowCreate(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.state, user]);

    const list = useMemo(() => {
        const decorated = decorateRooms(rooms, { myLoc, favorites });
        return sortRooms(filterRooms(decorated, term), sortKey);
    }, [rooms, myLoc, favorites, term, sortKey]);

    // ── 당겨서 새로고침 ──
    // 목록은 onSnapshot 실시간이라 다시 받을 게 없다 — '가까운 순'일 때 위치만 다시 잰다.
    // 그래도 당기는 행위 자체가 "최신 맞아?"라는 불안에 답한다.
    const listRef = useRef(null);
    const handleRefresh = useCallback(async () => {
        if (sortKey !== 'near' || !navigator.geolocation) return;
        await new Promise(resolve => {
            navigator.geolocation.getCurrentPosition(
                (pos) => { setMyLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }); resolve(); },
                () => resolve(),
                { timeout: 5000, maximumAge: 0 },
            );
        });
    }, [sortKey]);
    const { pulling, refreshing } = usePullToRefresh(listRef, handleRefresh);

    const chooseSort = useCallback((key) => {
        setSortKey(key);
        setSortOpen(false);
        try { localStorage.setItem(SORT_STORAGE_KEY, key); } catch { /* noop */ }

        // '가까운 순'은 내 위치를 알아야 의미가 있다. 고른 순간에 물어본다 —
        // 앱을 켜자마자 위치 권한을 묻는 건 거절당하기 딱 좋다.
        if (key !== 'near' || myLoc) return;
        if (!navigator.geolocation) { toast.error('이 기기에서는 위치를 쓸 수 없어요.'); return; }
        setLocating(true);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setMyLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                setLocating(false);
            },
            () => {
                setLocating(false);
                toast.error('위치 권한이 필요해요. 허용하면 가까운 순으로 볼 수 있습니다.');
            },
            { timeout: 8000, maximumAge: 5 * 60 * 1000 },
        );
    }, [myLoc]);

    const handleCreateClick = () => {
        if (!user) { onLoginClick(); return; }
        // 처음 만드는 사람에게는 각 칸이 무슨 뜻인지 먼저 알려준다
        if (!hasSeen(CREATE_ROOM_GUIDE_KEY)) { setShowCreateGuide(true); return; }
        setShowCreate(true);
    };

    const handleCreate = async (data) => {
        const ref = await addDoc(collection(db, 'rooms'), data);
        toast('경기방을 만들었습니다!');
        navigate(`/room/${ref.id}`);
    };

    const handleUpdateRoom = async (updated) => {
        if (!editRoom) return;
        try {
            await updateDoc(doc(db, 'rooms', editRoom.id), {
                name: updated.name,
                location: updated.location,
                address: updated.address,
                coords: updated.coords,
                description: updated.description,
                levelLimit: updated.levelLimit,
                maxPlayers: updated.maxPlayers,
                notice: (updated.notice ?? '').trim(),
                themeColor: updated.themeColor || null,
            });
            toast('방 정보가 수정되었습니다.');
            setEditRoom(null);
        } catch (e) {
            logError('방 정보 수정', e);
            toast.error('수정에 실패했습니다.');
        }
    };

    const handleDeleteRoom = async () => {
        if (!editRoom) return;
        const ok = await confirm({
            title: '이 방을 삭제할까요?',
            description: `'${editRoom.name}'의 선수 명단과 오늘 기록이 함께 사라집니다.\n되돌릴 수 없어요.`,
            confirmText: '삭제',
            tone: 'danger',
        });
        if (!ok) return;
        try {
            await deleteDoc(doc(db, 'rooms', editRoom.id));
            toast('방이 삭제되었습니다.');
            setEditRoom(null);
        } catch (e) {
            logError('방 삭제', e);
            toast.error('삭제에 실패했습니다.');
        }
    };

    if (!user) {
        return (
            <LoginRequiredPage
                icon={ShieldCheck}
                title="로그인이 필요합니다"
                description="경기 시스템은 로그인 후 이용할 수 있습니다."
                onLoginClick={onLoginClick}
            />
        );
    }

    const activeSort = ROOM_SORTS.find(s => s.key === sortKey) || ROOM_SORTS[0];
    const favCount = list.filter(r => r.favorite).length;

    return (
        <div className="relative h-full flex flex-col bg-ink">
            {/* ── 헤더 ── */}
            <div className="px-5 pt-4 pb-3 bg-surface border-b border-white/[0.06]">
                <div className="flex items-baseline justify-between mb-3">
                    <div>
                        <span className="text-[11px] font-black label text-volt">Matches</span>
                        <h1 className="text-2xl font-black kern-tight leading-none mt-0.5 text-txt">경기방</h1>
                    </div>
                    <span className="text-xs font-black text-dim tabular">{list.length} OPEN</span>
                </div>

                <div className="relative">
                    <input
                        type="search"
                        placeholder="경기방 이름 또는 장소 검색"
                        value={term}
                        onChange={(e) => setTerm(e.target.value)}
                        aria-label="경기방 검색"
                        className="w-full p-3.5 pl-11 pr-10 bg-card2 rounded-2xl text-sm font-bold border border-white/10 focus:border-volt outline-none placeholder-muted text-txt"
                    />
                    <Search size={19} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                    {term && (
                        <button
                            onClick={() => setTerm('')}
                            aria-label="검색어 지우기"
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-dim p-1"
                        >
                            <X size={16} />
                        </button>
                    )}
                </div>

                {/* ── 정렬 ── */}
                <div className="flex items-center gap-2 mt-2.5">
                    <button
                        onClick={() => setSortOpen(v => !v)}
                        aria-expanded={sortOpen}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[12px] font-black text-txt"
                    >
                        <ArrowUpDown size={13} className="text-volt" />
                        {activeSort.label}
                    </button>
                    {sortKey === 'near' && (
                        <span className="text-[11px] font-bold text-muted flex items-center gap-1">
                            <Navigation size={11} />
                            {locating ? '위치 확인 중…' : myLoc ? '내 위치 기준' : '위치 권한 필요'}
                        </span>
                    )}
                    {favCount > 0 && (
                        <span className="text-[11px] font-bold text-volt ml-auto">⭐ {favCount}개 찜</span>
                    )}
                </div>

                {sortOpen && (
                    <div className="mt-2 rounded-2xl bg-card border border-white/10 overflow-hidden">
                        {ROOM_SORTS.map(s => (
                            <button
                                key={s.key}
                                onClick={() => chooseSort(s.key)}
                                className={`w-full text-left px-4 py-3 flex items-center justify-between transition-colors ${
                                    s.key === sortKey ? 'bg-volt/10' : 'hover:bg-white/[0.03]'
                                }`}
                            >
                                <div>
                                    <p className={`text-sm font-black ${s.key === sortKey ? 'text-volt' : 'text-txt'}`}>{s.label}</p>
                                    <p className="text-[11px] text-muted font-medium">{s.hint}</p>
                                </div>
                                {s.key === sortKey && <span className="text-volt font-black">✓</span>}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* ── 목록 ── */}
            <main ref={listRef} className="flex-grow overflow-y-auto p-4 space-y-3 hide-scrollbar pb-28">
                <PullIndicator pulling={pulling} refreshing={refreshing} />
                {loading ? (
                    <><SkeletonRoomCard /><SkeletonRoomCard /><SkeletonRoomCard /></>
                ) : list.length > 0 ? (
                    list.map((room, i) => (
                        <div key={room.id} className="animate-content-in" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
                            <RoomCard
                                room={room}
                                onEnter={() => navigate(`/room/${room.id}`)}
                                onEdit={setEditRoom}
                                onToggleFavorite={toggleRoomFavorite}
                                isAdmin={isRoomAdmin(room, user, superAdmin)}
                            />
                        </div>
                    ))
                ) : (
                    <EmptyState
                        icon={Archive}
                        title={term ? '검색 결과가 없습니다' : '개설된 경기방이 없습니다'}
                        description={term ? '다른 이름이나 지역으로 찾아보세요.' : '첫 번째 경기방을 만들어보세요!'}
                        buttonText={term ? null : '경기방 만들기'}
                        onButtonClick={term ? null : handleCreateClick}
                    />
                )}
            </main>

            <button
                onClick={handleCreateClick}
                aria-label="경기방 개설"
                className="absolute bottom-6 right-6 bg-volt text-ink h-14 pl-4 pr-5 rounded-full shadow-volt flex items-center gap-1.5 transition-transform active:scale-90 font-black"
            >
                <Plus size={22} strokeWidth={2.6} /> 개설
            </button>

            <CreateRoomGuide
                open={showCreateGuide}
                onComplete={async () => {
                    setShowCreateGuide(false);
                    await markSeen(CREATE_ROOM_GUIDE_KEY);
                    setShowCreate(true);
                }}
            />

            <CreateRoomModal
                isOpen={showCreate}
                onClose={() => { setShowCreate(false); setPrefill(null); }}
                onSubmit={handleCreate}
                user={user}
                userData={userData}
                prefill={prefill}
            />

            <EditRoomInfoModal
                isOpen={!!editRoom}
                onClose={() => setEditRoom(null)}
                roomData={editRoom}
                onSave={handleUpdateRoom}
                onDelete={handleDeleteRoom}
                canDelete={editRoom ? (editRoom.adminUid === user.uid || superAdmin) : false}
            />
        </div>
    );
}
