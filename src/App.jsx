import React, { Suspense, lazy, useEffect, useState } from 'react';
import {
    BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate,
} from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { RoomsProvider } from './context/RoomsContext';
import { ConfirmProvider } from './components/ui/confirm';
import { Toaster } from './lib/toast';
import { LoadingSpinner, OfflineBanner } from './components/ui/Feedback';
import { CockstarLogo } from './components/ui/Logo';
import { InstallBanner, InstallGuideModal, countVisit } from './components/ui/InstallPrompt';
import { NotificationCenter, useNotiBadge } from './components/ui/NotificationCenter';
import { checkVersionGate, forceUpdate } from './lib/appConfig';
import { AuthModal } from './features/auth/AuthModal';
import { InitialProfileModal } from './features/auth/InitialProfileModal';
import { WelcomeTour } from './features/tutorial/WelcomeTour';
import { useTutorial } from './features/tutorial/useTutorial';
import { WELCOME_TOUR_KEY } from './features/tutorial/guideKeys';
import { HomePage } from './pages/HomePage';
import { Home, Trophy, KokMapIcon, ShoppingBag, User, Search, Bell, AlertCircle } from './components/ui/icons';
import { logError } from './lib/errorLog';

// 첫 화면에 필요 없는 것들은 나중에 받는다.
// 특히 콕맵은 지도 관련 코드가 무거워서, 홈만 열어본 사람에게는 내려받지 않는 게 맞다.
const StorePage = lazy(() => import('./pages/StorePage').then(m => ({ default: m.StorePage })));
const LobbyPage = lazy(() => import('./pages/LobbyPage').then(m => ({ default: m.LobbyPage })));
const GameRoomPage = lazy(() => import('./pages/GameRoomPage').then(m => ({ default: m.GameRoomPage })));
const KokMapPage = lazy(() => import('./pages/KokMapPage').then(m => ({ default: m.KokMapPage })));
const MyInfoPage = lazy(() => import('./pages/MyInfoPage').then(m => ({ default: m.MyInfoPage })));

// ===================================================================================
// 에러 바운더리
// ===================================================================================
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidCatch(error, info) {
        logError('화면 오류', error);
        console.error(info?.componentStack);
    }

    render() {
        if (!this.state.hasError) return this.props.children;
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-ink text-center px-8 max-w-md mx-auto">
                <div className="w-16 h-16 rounded-2xl bg-coral/15 flex items-center justify-center mb-5">
                    <AlertCircle size={30} className="text-coral" />
                </div>
                <h2 className="text-xl font-black text-txt kern-tight mb-2">문제가 발생했어요</h2>
                <p className="text-sm text-dim font-medium mb-8">
                    일시적인 오류입니다. 앱을 다시 시작해주세요.
                </p>
                <button
                    onClick={() => window.location.reload()}
                    className="px-8 py-4 bg-volt text-ink font-black rounded-full label text-xs"
                >
                    다시 시작하기
                </button>
            </div>
        );
    }
}

// ===================================================================================
// 탭바
// ===================================================================================
const TABS = [
    { to: '/', icon: Home, label: '홈' },
    { to: '/game', icon: Trophy, label: '경기', needsAuth: true },
    { to: '/map', icon: KokMapIcon, label: '콕맵' },
    { to: '/store', icon: ShoppingBag, label: '스토어' },
    { to: '/me', icon: User, label: '정보', needsAuth: true },
];

function TabBar({ onNeedAuth }) {
    const location = useLocation();
    const navigate = useNavigate();
    const { user } = useAuth();

    const isActive = (to) => (to === '/'
        ? location.pathname === '/'
        : location.pathname.startsWith(to) || (to === '/game' && location.pathname.startsWith('/room')));

    return (
        <nav
            className="flex justify-around items-center bg-surface border-t border-white/[0.06] pb-safe pt-1 px-2 z-20"
            aria-label="주요 화면"
        >
            {TABS.map(tab => {
                const active = isActive(tab.to);
                const Icon = tab.icon;
                return (
                    <button
                        key={tab.to}
                        onClick={() => {
                            if (tab.needsAuth && !user) { onNeedAuth(); return; }
                            navigate(tab.to);
                        }}
                        aria-current={active ? 'page' : undefined}
                        aria-label={tab.label}
                        className="flex flex-col items-center justify-center w-full pt-2.5 pb-2 transition-all duration-200 active:scale-90"
                    >
                        <div className={`relative flex items-center justify-center transition-colors ${active ? 'text-volt' : 'text-muted'}`}>
                            <Icon size={24} strokeWidth={active ? 2.4 : 2} />
                            {active && <span className="absolute -bottom-2 w-1 h-1 rounded-full bg-volt volt-glow" />}
                        </div>
                        <span className={`text-[11px] mt-1.5 transition-all ${active ? 'font-black text-txt' : 'font-bold text-muted'}`}>
                            {tab.label}
                        </span>
                    </button>
                );
            })}
        </nav>
    );
}

function HomeHeader({ onSearchClick, onBellClick }) {
    const unread = useNotiBadge();
    return (
        <header className="sticky top-0 glass z-10 px-5 py-3.5 flex justify-between items-center border-b border-white/[0.06]">
            <CockstarLogo markSize={22} />
            <div className="flex space-x-1 text-dim">
                <button
                    onClick={onSearchClick}
                    aria-label="체육관 찾기"
                    className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/5 transition-colors"
                >
                    <Search size={22} />
                </button>
                <button
                    onClick={onBellClick}
                    aria-label={unread > 0 ? `알림 ${unread}개` : '알림'}
                    className="relative w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/5 transition-colors"
                >
                    <Bell size={22} />
                    {unread > 0 && (
                        <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-coral border-2 border-ink" />
                    )}
                </button>
            </div>
        </header>
    );
}

/**
 * 버전 강제 업데이트 게이트.
 * Firestore config/app 의 minVersion 보다 낮은 버전은 이 화면에 갇힌다 —
 * 치명적 버그가 있는 구버전이 계속 데이터를 만지는 걸 막는 마지막 안전장치.
 */
function UpdateGateScreen({ notice }) {
    return (
        <div className="flex flex-col items-center justify-center h-dvh bg-ink text-center px-8 max-w-md mx-auto">
            <div className="animate-pop mb-6"><CockstarLogo markSize={40} /></div>
            <h2 className="text-xl font-black text-txt kern-tight mb-2">새 버전이 필요해요</h2>
            <p className="text-sm text-dim font-medium mb-8 break-keep">
                {notice || '중요한 문제가 고쳐진 새 버전이 나왔어요.\n버튼 한 번이면 됩니다.'}
            </p>
            <button
                onClick={forceUpdate}
                className="px-8 py-4 bg-volt text-ink font-black rounded-full label text-xs shadow-volt"
            >
                새 버전 받기
            </button>
        </div>
    );
}

// ===================================================================================
// 앱 껍데기
// ===================================================================================
function Shell() {
    const location = useLocation();
    const navigate = useNavigate();
    const { user, userData, loading } = useAuth();
    const { hasSeen, markSeen } = useTutorial(user, userData);
    const [authOpen, setAuthOpen] = useState(false);
    const [notiOpen, setNotiOpen] = useState(false);
    const [installGuideOpen, setInstallGuideOpen] = useState(false);
    const [versionGate, setVersionGate] = useState(null);   // { blocked, notice }
    const mainRef = React.useRef(null);

    // 화면을 옮기면 스크롤을 위로 (라우터는 이걸 자동으로 해주지 않는다)
    useEffect(() => { if (mainRef.current) mainRef.current.scrollTop = 0; }, [location.pathname]);

    // 방문 횟수 — 설치 배너를 언제 띄울지 정하는 데 쓴다
    useEffect(() => { countVisit(); }, []);

    // 버전 게이트 — 치명적 버그가 있는 구버전을 막는다 (config/app.minVersion)
    useEffect(() => {
        checkVersionGate(__APP_VERSION__).then(setVersionGate).catch(() => {});
    }, []);

    if (loading) {
        return (
            <div className="flex flex-col h-dvh bg-ink max-w-md mx-auto items-center justify-center grain court-lines relative overflow-hidden">
                <div className="animate-pop relative z-10">
                    <CockstarLogo markSize={44} className="scale-[1.4]" />
                </div>
                <span className="mt-10 text-[11px] font-black label text-muted relative z-10">코트를 준비하는 중</span>
            </div>
        );
    }

    // 치명적 버그가 있는 구버전은 여기서 멈춘다
    if (versionGate?.blocked) return <UpdateGateScreen notice={versionGate.notice} />;

    // 가입은 했는데 프로필이 없는 상태 — 프로필부터 채운다
    const needsProfile = user && !userData;
    // 프로필까지 끝난 사람에게 환영 투어를 한 번 (스킵 없음)
    const needsTour = user && userData && !hasSeen(WELCOME_TOUR_KEY);

    const isHome = location.pathname === '/';
    // 경기방은 관리자가 PC 로 여는 경우가 있어 데스크톱에서 두 열로 넓힌다
    const isRoom = location.pathname.startsWith('/room/');

    return (
        <div className={`flex flex-col h-dvh bg-ink mx-auto shadow-2xl overflow-hidden relative font-sans text-txt ${isRoom ? 'max-w-md lg:max-w-4xl' : 'max-w-md'}`}>
            {isHome && <HomeHeader onSearchClick={() => navigate('/map')} onBellClick={() => setNotiOpen(true)} />}
            <OfflineBanner />

            <main ref={mainRef} className="flex-grow overflow-y-auto hide-scrollbar bg-ink">
                <Suspense fallback={<LoadingSpinner />}>
                    <Routes>
                        <Route path="/" element={<HomePage />} />
                        <Route path="/store" element={<StorePage />} />
                        <Route path="/game" element={<LobbyPage onLoginClick={() => setAuthOpen(true)} />} />
                        <Route path="/room/:roomId" element={<GameRoomPage onLoginClick={() => setAuthOpen(true)} />} />
                        <Route path="/map" element={<KokMapPage />} />
                        <Route path="/me" element={<MyInfoPage onLoginClick={() => setAuthOpen(true)} />} />
                        {/* 예전 공유 링크(?roomId=...)를 새 주소로 넘긴다 —
                            카톡에 뿌려진 링크가 어느 날 갑자기 죽으면 안 된다 */}
                        <Route path="*" element={<LegacyRedirect />} />
                    </Routes>
                </Suspense>
            </main>

            <InstallBanner />
            <TabBar onNeedAuth={() => setAuthOpen(true)} />

            {needsProfile && <InitialProfileModal user={user} />}
            {!needsProfile && needsTour && (
                <WelcomeTour
                    userName={userData?.name}
                    onComplete={() => markSeen(WELCOME_TOUR_KEY)}
                />
            )}

            <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />
            <NotificationCenter
                isOpen={notiOpen}
                onClose={() => setNotiOpen(false)}
                onNeedInstall={() => { setNotiOpen(false); setInstallGuideOpen(true); }}
            />
            <InstallGuideModal isOpen={installGuideOpen} onClose={() => setInstallGuideOpen(false)} />
            <Toaster />
        </div>
    );
}

/**
 * 옛 주소 호환.
 * 예전에는 방을 `/?roomId=xxx` 로 열었다. 그 링크가 카카오톡 대화방마다 남아 있으므로
 * 새 주소로 조용히 넘긴다.
 */
function LegacyRedirect() {
    const location = useLocation();
    const params = new URLSearchParams(location.search);
    const roomId = params.get('roomId');
    if (roomId) return <Navigate to={`/room/${roomId}`} replace />;
    return <Navigate to="/" replace />;
}

/** 루트에서도 옛 링크를 받아준다 */
function RootRedirectGuard({ children }) {
    const location = useLocation();
    const params = new URLSearchParams(location.search);
    const roomId = params.get('roomId');
    if (roomId && location.pathname === '/') return <Navigate to={`/room/${roomId}`} replace />;
    return children;
}

export default function App() {
    return (
        <ErrorBoundary>
            <BrowserRouter>
                <ConfirmProvider>
                    <AuthProvider>
                        <RoomsProvider>
                            <RootRedirectGuard>
                                <Shell />
                            </RootRedirectGuard>
                        </RoomsProvider>
                    </AuthProvider>
                </ConfirmProvider>
            </BrowserRouter>
        </ErrorBoundary>
    );
}
