import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../components/ui/confirm';
import { useRooms } from '../context/RoomsContext';
import { useTutorial } from '../features/tutorial/useTutorial';
import { ALL_GUIDE_KEYS } from '../features/tutorial/guideKeys';
import { EditProfileModal } from '../features/auth/EditProfileModal';
import { FeedbackModal } from '../features/feedback/FeedbackModal';
import { InstallGuideModal, useInstallState, isAndroid, isAndroidChrome } from '../components/ui/InstallPrompt';
import { ReportQueueModal } from '../features/room/ReportModal';
import { ProductCardGrid } from '../components/ProductCards';
import { EmptyState } from '../components/ui/Feedback';
import { PRODUCTS } from '../lib/products';
import { displayAccount, SUPPORT } from '../constants';
import { toast } from '../lib/toast';
import {
    User, BarChart2, UserCheck, Heart, Archive, Copy, Star, MessageSquare,
    HelpCircle, Download, ZapRaw, ChevronRight, LogOut, ShieldAlert,
} from '../components/ui/icons';

// ===================================================================================
// 내 정보
// -----------------------------------------------------------------------------------
// [추가된 것]
//   · 문의·버그 신고 — 지금까지 사용자가 무언가 잘못됐을 때 할 수 있는 일이 없었다
//   · 찜한 상품 — 자리만 있고 담는 방법이 없던 빈 상자를 채웠다
//   · 찜한 경기방 바로가기
//   · 앱 설치 안내 (아이폰은 공유 버튼을 거쳐야 해서 따로 알려줘야 한다)
//   · 안내 다시 보기
// ===================================================================================

function Row({ icon: Icon, label, sub, onClick, danger, right }) {
    return (
        <button
            onClick={onClick}
            className="w-full flex items-center gap-3.5 px-5 py-4 hover:bg-white/[0.03] transition-colors text-left"
        >
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${danger ? 'bg-coral/12' : 'bg-white/5'}`}>
                <Icon size={17} className={danger ? 'text-coral' : 'text-volt'} />
            </div>
            <div className="flex-1 min-w-0">
                <p className={`text-sm font-black ${danger ? 'text-coral' : 'text-txt'}`}>{label}</p>
                {sub && <p className="text-[11px] text-muted font-medium mt-0.5 break-keep">{sub}</p>}
            </div>
            {right || <ChevronRight size={16} className="text-muted shrink-0" />}
        </button>
    );
}

export function MyInfoPage({ onLoginClick }) {
    const navigate = useNavigate();
    const confirm = useConfirm();
    const { user, userData, logout, favorites, favoriteProducts, toggleProductFavorite, superAdmin } = useAuth();
    const { rooms } = useRooms();
    const { resetSeen } = useTutorial(user, userData);
    const { installed, canPrompt, promptInstall } = useInstallState();

    const [showEdit, setShowEdit] = useState(false);
    const [showFeedback, setShowFeedback] = useState(false);
    const [showInstall, setShowInstall] = useState(false);
    const [showReports, setShowReports] = useState(false);

    const favProducts = useMemo(
        () => PRODUCTS.filter(p => favoriteProducts.includes(p.idx)),
        [favoriteProducts],
    );
    const favRooms = useMemo(
        () => rooms.filter(r => favorites.includes(r.id)),
        [rooms, favorites],
    );

    if (!user) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-ink">
                <div className="w-20 h-20 rounded-3xl bg-card flex items-center justify-center mb-6 border border-white/[0.06]">
                    <User className="w-9 h-9 text-volt" />
                </div>
                <h2 className="text-2xl font-black kern-tight mb-2 text-txt">로그인이 필요합니다</h2>
                <p className="text-dim font-bold mb-8 text-sm">로그인하고 콕스타의 모든 무대를 열어보세요.</p>
                <button
                    onClick={onLoginClick}
                    className="px-9 py-4 bg-volt text-ink font-black rounded-full shadow-volt text-xs label transition-transform active:scale-95"
                >
                    로그인 / 회원가입
                </button>
                <button
                    onClick={() => setShowFeedback(true)}
                    className="mt-8 text-xs text-muted font-bold underline underline-offset-4"
                >
                    문의하기
                </button>
                <FeedbackModal isOpen={showFeedback} onClose={() => setShowFeedback(false)} />
            </div>
        );
    }

    if (!userData) {
        return <div className="p-10 text-center text-dim font-bold bg-ink min-h-full">프로필 정보를 설정해주세요.</div>;
    }

    const accountId = displayAccount(userData?.email || user?.email) || user.uid;

    const copyId = async () => {
        try {
            await navigator.clipboard.writeText(accountId);
            toast('아이디가 복사되었습니다!');
        } catch {
            toast.error('복사에 실패했습니다.');
        }
    };

    return (
        <div className="p-5 space-y-5 bg-ink min-h-full pb-10">
            <div className="pt-1">
                <span className="text-[11px] font-black label text-volt">Athlete</span>
                <h1 className="text-2xl font-black kern-tight leading-none mt-0.5 text-txt">내 정보</h1>
            </div>

            {/* ── 프로필 카드 ── */}
            <div className="bg-card rounded-[28px] p-6 relative overflow-hidden grain court-lines border border-white/[0.06]">
                <div className="flex items-center space-x-4 relative z-10">
                    <div className="w-20 h-20 bg-volt rounded-2xl flex items-center justify-center flex-shrink-0">
                        <User className="w-10 h-10 text-ink" strokeWidth={2.4} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h2 className="text-2xl font-black truncate text-txt kern-tight">{userData.name || '사용자'}</h2>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <span className="inline-flex items-center gap-1 text-[11px] font-black text-ink bg-volt px-2 py-1 rounded-full label">
                                <BarChart2 size={12} /> {userData.level || 'N조'}
                            </span>
                            {userData.region && (
                                <span className="text-[11px] font-black text-dim bg-white/5 px-2 py-1 rounded-full">
                                    {userData.region}
                                </span>
                            )}
                            {userData.kakaoId && (
                                <span className="text-[10px] bg-[#FEE500] text-black px-2 py-0.5 rounded-full font-black">Kakao</span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="mt-5 flex items-center gap-2 relative z-10">
                    <span className="text-[11px] truncate font-bold bg-white/5 text-dim px-3 py-2 rounded-xl flex-1">
                        {accountId}
                    </span>
                    <button
                        onClick={copyId}
                        aria-label="아이디 복사"
                        className="p-2.5 bg-volt text-ink rounded-xl active:scale-90 transition-transform flex-shrink-0 flex items-center gap-1"
                    >
                        <Copy size={14} /><span className="text-[11px] font-black">복사</span>
                    </button>
                </div>
                <ZapRaw className="absolute -right-6 -bottom-8 w-40 h-40 text-white/[0.04]" strokeWidth={1} />
            </div>

            {/* ── 프로필 상세 ── */}
            <div className="bg-card rounded-2xl border border-white/[0.06] p-6">
                <h3 className="text-xs font-black label text-dim mb-5 flex items-center gap-2">
                    <UserCheck size={16} className="text-volt" /> 나의 프로필
                </h3>
                <div className="space-y-3.5 text-sm">
                    {[
                        ['급수', userData.level || '미설정'],
                        ['성별', userData.gender || '미설정'],
                        ['출생년도', userData.birthYear ? `${userData.birthYear}년생` : '미설정'],
                        ['지역', userData.region || '미설정'],
                    ].map(([k, v]) => (
                        <div key={k} className="flex justify-between items-center border-b border-white/[0.06] pb-3">
                            <span className="text-muted font-bold">{k}</span>
                            <span className="font-black text-txt">{v}</span>
                        </div>
                    ))}
                </div>
                <button
                    onClick={() => setShowEdit(true)}
                    className="mt-6 w-full py-3.5 bg-white/5 text-txt rounded-full hover:bg-white/10 transition-all text-xs font-black label"
                >
                    프로필 수정하기
                </button>
            </div>

            {/* ── 찜한 경기방 ── */}
            {favRooms.length > 0 && (
                <div className="bg-card rounded-2xl border border-white/[0.06] p-5">
                    <h3 className="text-xs font-black label text-dim mb-3 flex items-center gap-2">
                        <Star size={15} className="text-volt" /> 찜한 경기방 {favRooms.length}
                    </h3>
                    <div className="space-y-2">
                        {favRooms.map(r => (
                            <button
                                key={r.id}
                                onClick={() => navigate(`/room/${r.id}`)}
                                className="w-full text-left p-3 bg-card2 rounded-xl border border-white/[0.06] flex items-center gap-3"
                            >
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-black text-txt truncate">{r.name}</p>
                                    <p className="text-[11px] text-muted font-bold truncate">{r.location}</p>
                                </div>
                                <ChevronRight size={16} className="text-muted shrink-0" />
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* ── 찜한 상품 ── */}
            <div className="bg-card rounded-2xl border border-white/[0.06] p-5">
                <h3 className="text-xs font-black label text-dim mb-4 flex items-center gap-2">
                    <Heart size={15} className="text-volt" /> 찜한 아이템 {favProducts.length > 0 && favProducts.length}
                </h3>
                {favProducts.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3">
                        {favProducts.map(p => (
                            <ProductCardGrid
                                key={p.idx}
                                product={p}
                                isFavorite
                                onToggleFavorite={toggleProductFavorite}
                            />
                        ))}
                    </div>
                ) : (
                    <EmptyState
                        icon={Archive}
                        title="찜한 아이템이 없습니다"
                        description="상품 사진 오른쪽 위 하트를 눌러 담아보세요."
                        buttonText="스토어 둘러보기"
                        onButtonClick={() => navigate('/store')}
                    />
                )}
            </div>

            {/* ── 지원 · 설정 ── */}
            <div className="bg-card rounded-2xl border border-white/[0.06] overflow-hidden divide-y divide-white/[0.05]">
                <Row
                    icon={MessageSquare}
                    label="문의 · 버그 신고"
                    sub={`만든 사람(${SUPPORT.developerName})이 직접 읽고 답합니다`}
                    onClick={() => setShowFeedback(true)}
                />
                {!installed && (
                    <Row
                        icon={Download}
                        label="홈 화면에 앱 설치하기"
                        sub="한 번 설치하면 전체 화면으로 더 빠르게 열려요"
                        onClick={() => {
                            // 삼성 인터넷 등은 설치 시 구글 경고가 뜬다 — 안내(크롬 이동 포함)로
                            if (isAndroid() && !isAndroidChrome()) { setShowInstall(true); return; }
                            if (canPrompt) promptInstall(); else setShowInstall(true);
                        }}
                    />
                )}
                {superAdmin && (
                    <Row
                        icon={ShieldAlert}
                        label="신고 검토 (슈퍼 관리자)"
                        sub="사용자들이 접수한 신고 대기열"
                        onClick={() => setShowReports(true)}
                    />
                )}
                <Row
                    icon={HelpCircle}
                    label="사용 안내 다시 보기"
                    sub="처음 봤던 소개와 관리자 안내를 다시 봅니다"
                    onClick={async () => {
                        const ok = await confirm({
                            title: '안내를 처음부터 다시 볼까요?',
                            description: '앱 소개와 관리자 안내가 다음 화면 이동 때 다시 나타납니다.',
                            confirmText: '다시 보기',
                        });
                        if (!ok) return;
                        await resetSeen(ALL_GUIDE_KEYS);
                        toast('안내를 초기화했습니다. 홈으로 이동하면 다시 나와요.');
                        navigate('/');
                    }}
                />
            </div>

            <button
                onClick={async () => {
                    const ok = await confirm({ title: '로그아웃할까요?', confirmText: '로그아웃', tone: 'danger' });
                    if (ok) logout();
                }}
                className="w-full py-4 bg-card border border-white/[0.06] text-coral font-black rounded-full text-sm hover:bg-coral/10 transition-colors flex items-center justify-center gap-2"
            >
                <LogOut size={16} /> 로그아웃
            </button>

            <p className="text-center text-[10px] text-muted/60 font-bold pt-2">
                COCKSTAR {__APP_VERSION__} · 만든 사람 {SUPPORT.developerName}
            </p>

            <EditProfileModal isOpen={showEdit} onClose={() => setShowEdit(false)} userData={userData} user={user} />
            <FeedbackModal isOpen={showFeedback} onClose={() => setShowFeedback(false)} />
            <InstallGuideModal isOpen={showInstall} onClose={() => setShowInstall(false)} />
            {superAdmin && <ReportQueueModal isOpen={showReports} onClose={() => setShowReports(false)} />}
        </div>
    );
}
