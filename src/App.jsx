import React, { useState, useEffect, useRef, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import {
    getAuth, onAuthStateChanged, signOut,
    createUserWithEmailAndPassword, signInWithEmailAndPassword,
    signInWithPhoneNumber, updatePassword, PhoneAuthProvider,
    signInWithCredential, OAuthProvider, signInWithPopup,
    EmailAuthProvider, reauthenticateWithCredential,
    RecaptchaVerifier,
    GoogleAuthProvider,
    updateProfile
} from 'firebase/auth';
import {
    getFirestore, doc, setDoc, getDoc, onSnapshot,
    collection, query, where, addDoc, serverTimestamp,
    orderBy, updateDoc, deleteDoc, runTransaction, writeBatch,
    getDocs,
    increment
} from 'firebase/firestore';
import noErrorBanner from './noerror.png';
import {
    Home as HomeIcon,
    Trophy as TrophyIcon,
    Map as MapIcon,
    Users as UsersIcon,
    User as UserIcon,
    X as XIcon,
    Loader2 as Loader2Icon,
    ArrowLeft as ArrowLeftIcon,
    ShieldCheck as ShieldCheckIcon,
    ShoppingBag as ShoppingBagIcon,
    MessageSquare as MessageSquareIcon,
    Search as SearchIcon,
    Bell as BellIcon,
    MapPin as MapPinIcon,
    Phone as PhoneIcon,
    Heart as HeartIcon,
    ChevronRight as ChevronRightIcon,
    Plus as PlusIcon,
    Archive as ArchiveIcon,
    Lock as LockIcon,
    Edit3 as Edit3Icon,
    Clock as ClockIcon,
    AlertCircle as AlertCircleIcon,
    Calendar as CalendarIcon,
    Users2 as Users2Icon,
    BarChart2 as BarChart2Icon,
    CheckCircle as CheckCircleIcon,
    UserCheck as UserCheckIcon,
    GripVertical as GripVerticalIcon,
    Share2 as Share2Icon,
    Copy as CopyIcon,
    FlaskConical as FlaskConicalIcon,
    Flame as FlameIcon,
    Zap as ZapIcon,
    ArrowUpRight as ArrowUpRightIcon,
    Activity as ActivityIcon,
    Star as StarIcon,
    Tag as TagIcon,
    Truck as TruckIcon,
    Timer as TimerIcon
} from 'lucide-react';

// ===================================================================================
// [이식] 콕스라이팅 자동 매칭 — 매칭을 '수동 배정'에서 '엔진 추천 + 관리자 선택'으로
// -----------------------------------------------------------------------------------
// matching.js는 프레임워크·DB를 전혀 모르는 순수 함수 덩어리라 거의 그대로 옮겨왔고,
// 콕스타의 데이터(방 구조·Firestore Timestamp·S~E조 급수)를 엔진이 아는 모양으로
// 번역하는 일은 matchQueues.js가 맡는다. 자세한 사정은 두 파일의 머리 주석 참고.
// ===================================================================================
import {
    buildMatchContext, buildCandidatePool, generateMatchOptions,
    getSensitivity, AUTO_MATCH_SENSITIVITIES,
} from './lib/matching';
import { buildEngineInput, repairMatchQueues } from './lib/matchQueues';
import { computeDailySummary, shareSummaryCard } from './lib/summaryCard';
import { MatchOptionsModal } from './components/MatchOptionsModal';
import { AutoMatchGuide } from './tutorial/AutoMatchGuide';
import { AUTOMATCH_GUIDE_KEY } from './tutorial/guideKeys';

// ── 노에러 공식몰 실제 상품 데이터 (scripts/fetch-noerror-products.mjs 로 수집) ──
import {
    PRODUCTS, CATEGORIES, FETCHED_AT, formatPrice, openProduct,
    byCategory, newArrivals, bestDeals, gearPicks, categoryThumb,
} from './lib/products';
import { ProductCardH, ProductCardGrid, ProductCardWide, ProductImage, NewDropHero } from './components/ProductCards';

// ── 콕맵 데이터: 경기도 체육관(카카오 로컬 API) · 배드민턴 동호회(소모임) ──
import {
    GYMS, GYM_COUNT, CLUB_COUNT, CLUB_SOURCE, MAP_FILTERS,
    filterGyms, nearestGyms, searchGyms, clubsInRegion, distanceKm,
} from './lib/places';

const createIcon = (Icon) => (props) => <Icon strokeWidth={2} {...props} />;

const Share2 = createIcon(Share2Icon);
const Copy = createIcon(CopyIcon);
const FlaskConical = createIcon(FlaskConicalIcon);
const Home = createIcon(HomeIcon);
const Trophy = createIcon(TrophyIcon);
const KokMap = createIcon(MapIcon);
const Users = createIcon(UsersIcon);
const User = createIcon(UserIcon);
const X = createIcon(XIcon);
const Loader2 = createIcon(Loader2Icon);
const ArrowLeft = createIcon(ArrowLeftIcon);
const ShieldCheck = createIcon(ShieldCheckIcon);
const ShoppingBag = createIcon(ShoppingBagIcon);
const MessageSquare = createIcon(MessageSquareIcon);
const Search = createIcon(SearchIcon);
const Bell = createIcon(BellIcon);
const MapPin = createIcon(MapPinIcon);
const Heart = createIcon(HeartIcon);
const ChevronRight = createIcon(ChevronRightIcon);
const Plus = createIcon(PlusIcon);
const Archive = createIcon(ArchiveIcon);
const Lock = createIcon(LockIcon);
const Edit3 = createIcon(Edit3Icon);
const Clock = createIcon(ClockIcon);
const AlertCircle = createIcon(AlertCircleIcon);
const Calendar = createIcon(CalendarIcon);
const Users2 = createIcon(Users2Icon);
const BarChart2 = createIcon(BarChart2Icon);
const CheckCircle = createIcon(CheckCircleIcon);
const UserCheck = createIcon(UserCheckIcon);
const Phone = createIcon(PhoneIcon);
const GripVertical = createIcon(GripVerticalIcon);
const Flame = createIcon(FlameIcon);
const Zap = createIcon(ZapIcon);
const ArrowUpRight = createIcon(ArrowUpRightIcon);
const Activity = createIcon(ActivityIcon);
const Star = createIcon(StarIcon);
const Tag = createIcon(TagIcon);
const Truck = createIcon(TruckIcon);
const Timer = createIcon(TimerIcon);

// ===================================================================================
// Firebase 설정
// ===================================================================================
const firebaseConfig = {
    apiKey: import.meta.env.VITE_API_KEY,
    authDomain: import.meta.env.VITE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_APP_ID,
    measurementId: import.meta.env.VITE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

const isSuperAdmin = (user) => {
    return user && (user.email?.startsWith('domain') || user.email === 'domain@special.user');
};
const convertToEmail = (input) => {
    const cleanInput = input.trim();
    if (cleanInput === 'domain') return 'domain@special.user';
    if (cleanInput.includes('@')) return cleanInput;
    return `${cleanInput}@cockstar.app`;
};

// ===================================================================================
// 상수 / Helper
// ===================================================================================
const LEVEL_ORDER = { 'S조': 1, 'A조': 2, 'B조': 3, 'C조': 4, 'D조': 5, 'E조': 6, 'N조': 7, '미설정': 8 };
const getLevelColor = (level) => {
    switch (level) {
        case 'S조': return 'border-sky-400 text-sky-400';
        case 'A조': return 'border-red-500 text-red-400';
        case 'B조': return 'border-orange-500 text-orange-400';
        case 'C조': return 'border-amber-400 text-amber-300';
        case 'D조': return 'border-emerald-500 text-emerald-400';
        case 'E조': return 'border-blue-500 text-blue-400';
        default: return 'border-zinc-500 text-zinc-400';
    }
};
const PLAYERS_PER_MATCH = 4;

// ===================================================================================
// [이식] 하루 초기화 — '운영일 키'
// -----------------------------------------------------------------------------------
// 원래 코드는 new Date().toISOString().split('T')[0] 로 날짜를 만들었는데,
// 그건 UTC 날짜라서 한국 시간 기준 '오전 9시'에 하루가 바뀐다.
// 운동은 저녁에 하니까, 아침 9시에 갑자기 오늘 경기 수가 0이 되는 셈이다.
//
// 그래서 콕스라이팅과 같은 '운영일 키'를 쓴다. 새벽 2시에 하루가 바뀐다.
//   ① +9시간  → 한국 시간으로 맞춘다
//   ② −2시간  → 새벽 2시 이전은 '어제'로 친다
//   합쳐서 +7시간을 더한 뒤 UTC 날짜를 읽는다.
//
// UTC 필드(getUTCFullYear 등)로 읽는 게 핵심이다. 기기의 표준시 설정이 무엇이든
// 같은 결과가 나온다 — 해외에 있는 사람이 접속해도 한국 기준 운영일로 맞춰진다.
// ===================================================================================
const getDailyResetKey = (now = new Date()) => {
    const shifted = new Date(now.getTime() + 7 * 60 * 60 * 1000);
    const y = shifted.getUTCFullYear();
    const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
    const d = String(shifted.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

// NOERROR 광고 파트너 (콕스타 공식 스폰서)
const NOERROR_URL = 'https://www.pjbsports.com/';

// 예전에는 여기에 가짜 상품 목록(STORE_ITEMS)을 손으로 적어뒀지만,
// 이제 공식몰에서 받아온 실제 상품 190개를 쓴다 → src/lib/products.js
// 데이터 갱신: npm run fetch:products -- --force

// ===================================================================================
// 토스트 (전역 알림) — window 이벤트 기반 싱글턴
// ===================================================================================
function toast(message, type = 'default') {
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('cockstar-toast', { detail: { message, type } }));
    }
}
function Toaster() {
    const [items, setItems] = useState([]);
    useEffect(() => {
        const handler = (e) => {
            const id = Date.now() + Math.random();
            setItems(prev => [...prev, { id, ...e.detail }]);
            setTimeout(() => setItems(prev => prev.filter(i => i.id !== id)), 2600);
        };
        window.addEventListener('cockstar-toast', handler);
        return () => window.removeEventListener('cockstar-toast', handler);
    }, []);
    return (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[300] flex flex-col items-center gap-2 pointer-events-none w-full max-w-sm px-4">
            {items.map(item => {
                const isErr = item.type === 'error';
                const Icon = isErr ? AlertCircle : CheckCircle;
                return (
                    <div key={item.id} className={`animate-toast-in glass w-full flex items-center gap-2.5 px-4 py-3 rounded-2xl border shadow-deep ${isErr ? 'border-coral/40' : 'border-volt/30'}`}>
                        <Icon size={18} className={isErr ? 'text-coral' : 'text-volt'} />
                        <span className="text-sm font-bold text-txt flex-1">{item.message}</span>
                    </div>
                );
            })}
        </div>
    );
}

// ===================================================================================
// 에러 바운더리 (안정성)
// ===================================================================================
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }
    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }
    componentDidCatch(error, info) {
        console.error("앱 오류:", error, info);
    }
    render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center h-screen bg-ink text-center px-8 max-w-md mx-auto">
                    <div className="w-16 h-16 rounded-2xl bg-coral/15 flex items-center justify-center mb-5">
                        <AlertCircle size={30} className="text-coral" />
                    </div>
                    <h2 className="text-xl font-black text-txt kern-tight mb-2">문제가 발생했어요</h2>
                    <p className="text-sm text-dim font-medium mb-8">일시적인 오류입니다. 앱을 다시 시작해주세요.</p>
                    <button onClick={() => window.location.reload()} className="px-8 py-4 bg-volt text-ink font-black rounded-full label text-xs">
                        다시 시작하기
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}

// ===================================================================================
// 브랜드 로고 — 셔틀콕 마크 + 워드마크
// ===================================================================================
function CockstarMark({ size = 28, className = '', duotone = false }) {
    return (
        <svg viewBox="0 0 40 40" width={size} height={size} className={className} fill="none" aria-hidden="true">
            <g stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 26 L7 9" />
                <path d="M20 26 L13.5 6.5" />
                <path d="M20 26 L20 5" />
                <path d="M20 26 L26.5 6.5" />
                <path d="M20 26 L33 9" />
                <path d="M11 12.5 C15 15, 25 15, 29 12.5" opacity="0.55" />
            </g>
            <circle cx="20" cy="30" r="4.6" fill={duotone ? '#CDFB47' : 'currentColor'} stroke={duotone ? '#08090C' : 'none'} strokeWidth="1" />
        </svg>
    );
}

function CockstarLogo({ markSize = 22, className = '' }) {
    return (
        <div className={`flex items-center gap-2 ${className}`}>
            <CockstarMark size={markSize} duotone className="text-txt" />
            <span className="font-display display-italic text-[24px] leading-none text-txt tracking-wide">
                COCK<span className="text-volt">STAR</span>
            </span>
        </div>
    );
}

// ===================================================================================
// 로딩 / 스켈레톤 / 빈 화면
// ===================================================================================
function LoadingSpinner({ text = "LOADING" }) {
    return (
        <div className="flex flex-col items-center justify-center h-full text-txt">
            <Loader2 className="w-9 h-9 animate-spin text-volt" />
            <span className="mt-4 text-[11px] font-black label text-muted">{text}</span>
        </div>
    );
}

function SkeletonCard() {
    return (
        <div className="w-full p-5 rounded-2xl bg-card border border-white/[0.06]">
            <div className="h-4 skeleton rounded w-2/3 mb-3"></div>
            <div className="flex gap-2 mb-4">
                <div className="h-4 skeleton rounded-full w-16"></div>
                <div className="h-4 skeleton rounded-full w-16"></div>
            </div>
            <div className="flex justify-between items-center">
                <div className="h-4 skeleton rounded w-24"></div>
                <div className="h-6 skeleton rounded-full w-16"></div>
            </div>
        </div>
    );
}

function SkeletonStoreCard() {
    return (
        <div className="w-40 flex-shrink-0 mr-3">
            <div className="rounded-2xl overflow-hidden bg-card border border-white/[0.06]">
                <div className="w-full h-32 skeleton"></div>
                <div className="p-3">
                    <div className="h-4 skeleton rounded w-3/4 mb-2"></div>
                    <div className="h-3 skeleton rounded w-1/2"></div>
                </div>
            </div>
        </div>
    );
}

function SkeletonRoomCard() {
    return (
        <div className="rounded-2xl bg-card border border-white/[0.06] p-5">
            <div className="h-5 skeleton rounded w-1/2 mb-3"></div>
            <div className="h-4 skeleton rounded w-3/4 mb-4"></div>
            <div className="flex gap-2">
                <div className="h-6 skeleton rounded-full w-20"></div>
                <div className="h-6 skeleton rounded-full w-16"></div>
            </div>
        </div>
    );
}

function EmptyState({ icon: Icon, title, description, buttonText, onButtonClick }) {
    return (
        <div className="flex flex-col items-center justify-center text-center p-10 rounded-2xl bg-card border border-dashed border-white/10">
            <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
                <Icon className="w-7 h-7 text-volt" />
            </div>
            <h3 className="text-base font-black text-txt mb-1 kern-tight">{title}</h3>
            <p className="text-sm text-dim mb-6 font-medium">{description}</p>
            {buttonText && onButtonClick && (
                <button
                    onClick={onButtonClick}
                    className="px-6 py-3 bg-volt text-ink text-sm font-black rounded-full transition-all active:scale-95"
                >
                    {buttonText}
                </button>
            )}
        </div>
    );
}

function ComingSoonPage({ icon: Icon, title, description }) {
    return (
        <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-ink">
            <div className="w-20 h-20 rounded-3xl bg-card flex items-center justify-center mb-6 grain relative overflow-hidden border border-white/[0.06]">
                <Icon className="w-9 h-9 text-volt relative z-10" />
            </div>
            <span className="text-[11px] font-black label text-volt mb-2">Coming Soon</span>
            <h2 className="text-2xl font-black text-txt mb-2 kern-tight">{title}</h2>
            <p className="text-sm text-dim font-medium max-w-[260px]">{description}</p>
        </div>
    );
}

function LoginRequiredPage({ icon: Icon, title, description, onLoginClick }) {
    return (
        <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-ink">
            <div className="w-20 h-20 rounded-3xl bg-card flex items-center justify-center mb-6 border border-white/[0.06]">
                <Icon className="w-9 h-9 text-volt" />
            </div>
            <h2 className="text-2xl font-black text-txt mb-2 kern-tight">{title}</h2>
            <p className="text-sm text-dim font-medium mb-8">{description}</p>
            <button
                onClick={onLoginClick}
                className="px-9 py-4 bg-volt text-ink text-xs font-black rounded-full shadow-volt transition-transform active:scale-95 label"
            >
                로그인하고 시작하기
            </button>
        </div>
    );
}

// 공용 폼 클래스 (다크)
const FIELD_CLS = "w-full p-3.5 bg-card2 rounded-xl border border-white/10 focus:border-volt outline-none font-bold text-txt placeholder-muted transition-colors";
const LABEL_CLS = "block text-[11px] font-black label text-dim mb-1.5 ml-0.5";

// ===================================================================================
// 로그인 모달
// ===================================================================================
function AuthModal({ isOpen, onClose }) {
    const [loginMode, setLoginMode] = useState('select');
    const [error, setError] = useState('');
    const [adminData, setAdminData] = useState({ id: '', pw: '' });

    const [phone, setPhone] = useState('');
    const [vCode, setVCode] = useState('');
    const [confirmationResult, setConfirmationResult] = useState(null);
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handleSendCode = async () => {
        if (!phone.trim()) return setError("전화번호를 입력해주세요.");
        setError('');
        setLoading(true);
        try {
            const recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', { 'size': 'invisible' });
            const formatPhone = phone.startsWith('+') ? phone : `+82${phone.replace(/^0/, '')}`;
            const result = await signInWithPhoneNumber(auth, formatPhone, recaptchaVerifier);
            setConfirmationResult(result);
            setLoginMode('verify');
        } catch (err) {
            console.error(err);
            setError("인증번호 전송에 실패했습니다. 번호를 확인해주세요.");
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyCode = async () => {
        if (!vCode.trim()) return setError("인증번호를 입력해주세요.");
        setError('');
        setLoading(true);
        try {
            await confirmationResult.confirm(vCode);
            onClose();
        } catch (err) {
            setError("인증번호가 일치하지 않습니다.");
        } finally {
            setLoading(false);
        }
    };

    const handleKakaoLogin = async () => {
        try {
            const provider = new OAuthProvider('oidc.kakao');
            await signInWithPopup(auth, provider);
            onClose();
        } catch (err) { setError("카카오 로그인 실패: " + err.message); }
    };

    const handleAdminLogin = async (e) => {
        e.preventDefault();
        const email = adminData.id === 'domain' ? 'domain@special.user' : `${adminData.id}@cockstar.app`;
        try {
            await signInWithEmailAndPassword(auth, email, adminData.pw);
            onClose();
        } catch (err) { setError("관리자 정보가 일치하지 않습니다."); }
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-surface w-full max-w-md rounded-t-[32px] sm:rounded-[32px] overflow-hidden shadow-deep border border-white/[0.06] animate-slide-up sm:animate-scale-in">
                <div className="relative bg-ink px-8 pt-10 pb-8 grain court-lines overflow-hidden">
                    <div className="relative z-10">
                        <CockstarLogo markSize={26} />
                        <h1 className="mt-6 text-txt font-display display-italic text-4xl leading-[0.92]">
                            코트를<br /><span className="text-volt">지배하라</span>
                        </h1>
                        <p className="mt-3 text-dim text-sm font-medium">가입 30초. 오늘 저녁 경기부터 바로 뛴다.</p>
                    </div>
                    <ZapIcon className="absolute -right-4 -bottom-6 w-40 h-40 text-white/[0.04]" strokeWidth={1} />
                </div>

                <div className="p-8">
                    {error && <p className="text-coral text-xs text-center mb-4 font-bold">{error}</p>}

                    {loginMode === 'select' && (
                        <div className="space-y-3 animate-fade-in-up">
                            <button onClick={handleKakaoLogin} className="w-full py-4 bg-[#FEE500] text-[#1a1a1a] font-black rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform">
                                <MessageSquare size={18} fill="#1a1a1a" /> 카카오로 시작하기
                            </button>
                            <button onClick={() => setLoginMode('phone')} className="w-full py-4 bg-volt text-ink font-black rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform">
                                <Phone size={18} /> 휴대폰 번호로 시작하기
                            </button>
                        </div>
                    )}

                    {loginMode === 'phone' && (
                        <div className="space-y-4 animate-fade-in-up">
                            <div id="recaptcha-container"></div>
                            <input type="tel" placeholder="휴대폰 번호 (01012345678)" value={phone} onChange={(e) => setPhone(e.target.value)} className={FIELD_CLS} />
                            <button onClick={handleSendCode} disabled={loading} className="w-full py-4 bg-volt text-ink font-black rounded-2xl shadow-volt flex items-center justify-center transition-transform active:scale-95">
                                {loading ? <Loader2 className="animate-spin" /> : '인증번호 전송'}
                            </button>
                            <button onClick={() => setLoginMode('select')} className="w-full text-dim text-sm font-bold">뒤로가기</button>
                        </div>
                    )}

                    {loginMode === 'verify' && (
                        <div className="space-y-4 animate-fade-in-up">
                            <p className="text-center text-sm text-dim font-medium">전송된 인증번호 6자리를 입력해주세요.</p>
                            <input type="number" placeholder="000000" value={vCode} onChange={(e) => setVCode(e.target.value)} className="w-full p-4 bg-card2 rounded-2xl border border-white/10 focus:border-volt outline-none text-center text-3xl font-black tracking-[0.4em] tabular text-txt" />
                            <button onClick={handleVerifyCode} disabled={loading} className="w-full py-4 bg-volt text-ink font-black rounded-2xl flex items-center justify-center transition-transform active:scale-95">
                                {loading ? <Loader2 className="animate-spin" /> : '인증 완료'}
                            </button>
                            <button onClick={() => setLoginMode('phone')} className="w-full text-dim text-sm font-bold">번호 다시 입력하기</button>
                        </div>
                    )}

                    {loginMode === 'admin' && (
                        <form onSubmit={handleAdminLogin} className="space-y-3 animate-fade-in-up">
                            <input type="text" placeholder="관리자 아이디" onChange={e => setAdminData({...adminData, id: e.target.value})} className={FIELD_CLS} />
                            <input type="password" placeholder="비밀번호" onChange={e => setAdminData({...adminData, pw: e.target.value})} className={FIELD_CLS} />
                            <button type="submit" className="w-full py-4 bg-white/10 text-txt font-black rounded-2xl">관리자 인증</button>
                            <button onClick={() => setLoginMode('select')} className="w-full text-dim text-sm font-bold mt-2">뒤로가기</button>
                        </form>
                    )}

                    {loginMode === 'select' && (
                        <div className="mt-10 text-center">
                            <button onClick={() => setLoginMode('admin')} className="text-[10px] text-muted font-medium hover:text-dim transition-colors border-b border-white/10">
                                시스템 관리자 전용 로그인
                            </button>
                        </div>
                    )}
                </div>
                <button onClick={onClose} className="w-full py-4 bg-white/[0.03] text-muted text-[11px] font-black border-t border-white/[0.06] label">
                    다음에 하기
                </button>
            </div>
        </div>
    );
}

// 모임 생성 모달
function CreateRoomModal({ isOpen, onClose, onSubmit, user, userData }) {
    const [roomName, setRoomName] = useState('');
    const [locationName, setLocationName] = useState('');
    const [address, setAddress] = useState('');
    const [coords, setCoords] = useState(null);
    const [description, setDescription] = useState('');
    const [levelLimit, setLevelLimit] = useState('N조');
    const [maxPlayers, setMaxPlayers] = useState(20);
    const [usePassword, setUsePassword] = useState(false);
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setRoomName(''); setLocationName(''); setAddress(''); setCoords(null);
            setDescription(''); setLevelLimit('N조'); setMaxPlayers(20);
            setUsePassword(false); setPassword(''); setError(''); setLoading(false);
        }
    }, [isOpen]);

    const handleAddressSearch = () => {
        if (!window.daum || !window.daum.Postcode) {
            toast("주소 검색 서비스를 불러오지 못했습니다.", 'error');
            return;
        }
        new window.daum.Postcode({
            oncomplete: function(data) {
                const addr = data.roadAddress || data.jibunAddress;
                const buildingName = data.buildingName || '';
                setAddress(addr);
                if (!locationName && buildingName) setLocationName(buildingName);
                if (window.kakao && window.kakao.maps) {
                    window.kakao.maps.load(() => {
                        if (window.kakao.maps.services) {
                            const geocoder = new window.kakao.maps.services.Geocoder();
                            geocoder.addressSearch(addr, (result, status) => {
                                if (status === window.kakao.maps.services.Status.OK) {
                                    setCoords({ lat: parseFloat(result[0].y), lng: parseFloat(result[0].x) });
                                } else {
                                    setError("주소는 찾았으나 위치 좌표를 가져올 수 없습니다.");
                                }
                            });
                        } else { setError("카카오맵 서비스 모듈을 불러오지 못했습니다."); }
                    });
                } else { setError("카카오맵 SDK가 로드되지 않았습니다."); }
            }
        }).open();
    };

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (!roomName.trim()) return setError('경기방 제목을 입력해주세요.');
        if (!address) return setError('장소를 검색해서 입력해주세요.');
        if (!coords) return setError('유효한 주소가 아닙니다. 다시 검색해주세요.');
        if (maxPlayers < 4) return setError('최소 인원은 4명 이상이어야 합니다.');
        if (usePassword && !password) return setError('비밀번호를 입력해주세요.');

        setLoading(true);
        const newRoomData = {
            name: roomName, location: locationName || address, address: address, coords: coords,
            description: description || '모임 소개가 없습니다.', levelLimit: levelLimit,
            maxPlayers: parseInt(maxPlayers), password: usePassword ? password : '',
            adminUid: user.uid, adminName: userData?.name || '방장', createdAt: serverTimestamp(),
            playerCount: 0, numScheduledMatches: 4, numInProgressCourts: 2, scheduledMatches: {}, inProgressCourts: [],
            // [자동 매칭] 새 방의 기본값. 민감도 '보통' = 경기중인 선수를 1명까지 미리 예약한다.
            autoMatches: {},
            autoMatchConfig: { sensitivity: 'normal', perGenderSensitivity: false, maleSensitivity: 'normal', femaleSensitivity: 'normal' },
        };
        try {
            await onSubmit(newRoomData);
            onClose();
        } catch (err) {
            console.error("Error creating room:", err);
            setError("경기방 생성 실패: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 backdrop-blur-md">
            <div className="bg-surface rounded-t-[32px] sm:rounded-[28px] p-6 w-full max-w-lg relative text-txt shadow-deep border border-white/[0.06] max-h-[92vh] overflow-y-auto hide-scrollbar animate-slide-up sm:animate-scale-in">
                <button onClick={onClose} className="absolute top-5 right-5 w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-dim hover:bg-white/10 transition-colors" disabled={loading}>
                    <X size={20} />
                </button>

                <span className="text-[11px] font-black label text-volt">New Match</span>
                <h2 className="text-2xl font-black kern-tight mb-6 mt-1 text-txt">경기방 개설</h2>

                {error && <p className="text-coral mb-4 bg-coral/10 p-3 rounded-xl text-sm font-bold">{error}</p>}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className={LABEL_CLS}>방 제목 <span className="text-volt">*</span></label>
                        <input type="text" placeholder="예: 3040 실전 정모 (A-C조)" value={roomName} onChange={(e) => setRoomName(e.target.value)} required className={FIELD_CLS} />
                    </div>

                    <div className="space-y-3 p-4 bg-white/[0.03] rounded-2xl border border-white/[0.06]">
                        <label className="flex items-center gap-1.5 text-[11px] font-black label text-dim">
                            <MapPin size={13} /> 모임 장소
                        </label>
                        <button type="button" onClick={handleAddressSearch} className="w-full py-3 bg-card2 border border-white/10 rounded-xl text-sm font-black text-txt hover:border-volt transition-all flex items-center justify-center gap-2">
                            <Search size={16} /> 주소 검색하기
                        </button>
                        <div className={`w-full p-3 rounded-xl border text-sm font-bold ${address ? 'bg-card2 border-white/10 text-txt' : 'bg-white/[0.02] border-white/[0.06] text-muted'}`}>
                            {address ? (
                                <div className="flex items-center gap-2">
                                    <span className="flex-1">{address}</span>
                                    {coords && <span className="text-[10px] bg-volt text-ink px-1.5 py-0.5 rounded-full font-black">좌표 OK</span>}
                                </div>
                            ) : "주소가 설정되지 않았습니다."}
                        </div>
                        <input type="text" placeholder="상세 장소 (예: 콕스타 체육관 2층)" value={locationName} onChange={(e) => setLocationName(e.target.value)} className="w-full p-3 bg-card2 rounded-xl border border-white/10 focus:border-volt outline-none text-sm font-bold text-txt" />
                    </div>

                    <div>
                        <label className={LABEL_CLS}>소개</label>
                        <textarea placeholder="어떤 경기를 지향하나요? 자유롭게 소개해주세요." value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={`${FIELD_CLS} resize-none`} />
                    </div>

                    <div className="flex gap-4">
                        <div className="flex-1">
                            <label className={LABEL_CLS}>입장 급수</label>
                            <select value={levelLimit} onChange={(e) => setLevelLimit(e.target.value)} className={FIELD_CLS}>
                                {['N조','S조','A조','B조','C조','D조','E조'].map(l => (<option key={l} value={l} className="bg-surface">{l === 'N조' ? '전체 급수' : `${l} 이상`}</option>))}
                            </select>
                        </div>
                        <div className="flex-1">
                            <label className={LABEL_CLS}>정원</label>
                            <input type="number" value={maxPlayers} onChange={(e) => setMaxPlayers(e.target.value)} min="4" step="1" className={FIELD_CLS} />
                        </div>
                    </div>

                    <div className="bg-white/[0.03] p-4 rounded-2xl border border-white/[0.06]">
                        <label className="flex items-center gap-2">
                            <input type="checkbox" checked={usePassword} onChange={(e) => setUsePassword(e.target.checked)} className="h-4 w-4 rounded accent-volt" />
                            <span className="text-sm font-black text-txt">비밀번호 설정</span>
                        </label>
                        {usePassword && (
                            <input type="password" placeholder="비밀번호 입력" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full p-3 mt-3 bg-card2 rounded-xl border border-white/10 focus:border-volt outline-none text-sm font-bold text-txt" />
                        )}
                    </div>

                    <div className="pt-2">
                        <button type="submit" disabled={loading} className="w-full py-4 bg-volt text-ink font-black rounded-full text-base hover:bg-volt-dark transition-colors disabled:bg-white/10 disabled:text-muted flex items-center justify-center shadow-volt label">
                            {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : '경기방 만들기'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function ShareModal({ isOpen, onClose, roomId }) {
    if (!isOpen) return null;
    const shareUrl = `${window.location.origin}?roomId=${roomId}`;
    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4 backdrop-blur-md">
            <div className="bg-surface rounded-[28px] p-6 w-full max-w-xs shadow-deep border border-white/[0.06] animate-scale-in">
                <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-volt rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <Share2 size={28} className="text-ink" />
                    </div>
                    <h3 className="text-lg font-black text-txt kern-tight">경기방 초대</h3>
                    <p className="text-xs text-dim mt-1 font-medium">링크를 복사해 크루를 소환하세요.</p>
                </div>
                <div className="bg-white/5 p-3 rounded-xl mb-6 break-all">
                    <p className="text-xs font-bold text-dim leading-relaxed">{shareUrl}</p>
                </div>
                <div className="space-y-2">
                    <button onClick={() => { navigator.clipboard.writeText(shareUrl); toast("초대 링크가 복사되었습니다!"); onClose(); }} className="w-full py-3.5 bg-volt text-ink font-black rounded-full flex items-center justify-center gap-2 shadow-volt">
                        <Copy size={18} /> 링크 복사하기
                    </button>
                    <button onClick={onClose} className="w-full py-3 text-dim text-sm font-bold">닫기</button>
                </div>
            </div>
        </div>
    );
}

// ===================================================================================
// 홈 — 메인 배너 (2/3 노에러 프로모션)
// ===================================================================================
// 메인 배너 — 실제 상품 수·할인율을 넣어 문구가 거짓말이 되지 않게 한다.
// (예전에는 "최대 20%"처럼 손으로 적어둔 숫자여서 실제 할인과 어긋났다)
const bannerSlides = [
    {
        kicker: "NOERROR · 2026 S/S",
        title: "새 시즌,\n장비를 바꿔라",
        sub: `노에러 신상 컬렉션 ${PRODUCTS.filter(p => p.cat === '신상').length}종`,
        cta: "신상 보기", type: 'store', accent: 'volt', art: FlameIcon,
    },
    {
        kicker: "TONIGHT",
        title: "오늘 저녁,\n빈 코트를 찾아라",
        sub: "내 주변 실시간 경기방",
        cta: "경기 찾기", type: 'game', accent: 'volt', art: ZapIcon,
    },
    {
        kicker: "NOERROR · OUTLET",
        title: `지금 최대\n${Math.max(0, ...PRODUCTS.map(p => p.discountRate))}% 할인`,
        sub: `아웃렛 특가 ${PRODUCTS.filter(p => p.discountRate >= 30).length}종`,
        cta: "특가 보기", type: 'store', accent: 'coral', art: TrophyIcon,
    },
];

function MainBanner({ onNavigate }) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const timeoutRef = useRef(null);
    const dragStartXRef = useRef(0);
    const containerRef = useRef(null);
    const isDraggingRef = useRef(false);
    const movedRef = useRef(false);

    const resetTimeout = () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
    const nextSlide = () => setCurrentIndex((p) => (p === bannerSlides.length - 1 ? 0 : p + 1));

    useEffect(() => {
        resetTimeout();
        timeoutRef.current = setTimeout(nextSlide, 5000);
        return () => resetTimeout();
    }, [currentIndex]);

    const handleDragStart = (e) => {
        isDraggingRef.current = true;
        movedRef.current = false;
        dragStartXRef.current = e.clientX || e.touches[0].clientX;
        resetTimeout();
        if (containerRef.current) containerRef.current.style.transition = 'none';
        e.preventDefault();
    };
    const handleDragMove = (e) => {
        if (!isDraggingRef.current) return;
        e.preventDefault();
        const currentX = e.clientX || e.touches[0].clientX;
        const diff = dragStartXRef.current - currentX;
        if (Math.abs(diff) > 6) movedRef.current = true;
        if (containerRef.current) containerRef.current.style.transform = `translateX(calc(-${currentIndex * 100}% - ${diff}px))`;
    };
    const handleDragEnd = (e) => {
        if (!isDraggingRef.current) return;
        isDraggingRef.current = false;
        const currentX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
        const diff = dragStartXRef.current - currentX;
        if (containerRef.current) containerRef.current.style.transition = 'transform 0.4s ease-in-out';
        if (Math.abs(diff) > 50) {
            if (diff > 0) nextSlide();
            else setCurrentIndex((p) => (p === 0 ? bannerSlides.length - 1 : p - 1));
        } else if (containerRef.current) {
            containerRef.current.style.transform = `translateX(-${currentIndex * 100}%)`;
        }
        timeoutRef.current = setTimeout(nextSlide, 5000);
    };

    const fireSlide = (slide) => {
        if (movedRef.current) return; // 넘기려고 끌었을 뿐이면 눌린 게 아니다
        // 상품 배너는 앱 안의 스토어 화면으로 보낸다.
        // 바로 외부 쇼핑몰로 튕기면 앱을 벗어나 버려서 다시 안 돌아온다.
        onNavigate && onNavigate(slide.type === 'store' ? 'store' : 'game');
    };

    return (
        <section
            className="relative w-full overflow-hidden rounded-3xl select-none border border-white/[0.06]"
            onMouseDown={handleDragStart} onMouseMove={handleDragMove} onMouseUp={handleDragEnd} onMouseLeave={handleDragEnd}
            onTouchStart={handleDragStart} onTouchMove={handleDragMove} onTouchEnd={handleDragEnd}
        >
            <div ref={containerRef} className="flex transition-transform duration-400 ease-in-out" style={{ transform: `translateX(-${currentIndex * 100}%)` }}>
                {bannerSlides.map((slide, index) => {
                    const Art = slide.art;
                    const accent = slide.accent === 'coral' ? 'text-coral' : 'text-volt';
                    return (
                        <div key={index} onClick={() => fireSlide(slide)} className="relative w-full h-52 flex-shrink-0 bg-ink grain court-lines overflow-hidden flex flex-col justify-center px-7 cursor-pointer">
                            <span className={`text-[11px] font-black label ${accent} relative z-10`}>{slide.kicker}</span>
                            <h2 className="mt-2 font-display display-italic text-3xl leading-[0.95] relative z-10 whitespace-pre-line text-txt">{slide.title}</h2>
                            <p className="mt-2 text-xs font-bold relative z-10 text-dim">{slide.sub}</p>
                            <span className={`mt-3 inline-flex items-center gap-1 text-[11px] font-black relative z-10 ${accent}`}>
                                {slide.cta} <ArrowUpRight size={13} />
                            </span>
                            <Art className={`absolute -right-6 -bottom-8 w-44 h-44 ${slide.accent === 'coral' ? 'text-coral/10' : 'text-volt/10'}`} strokeWidth={1} />
                        </div>
                    );
                })}
            </div>
            <div className="absolute bottom-4 right-5 flex space-x-1.5 z-10">
                {bannerSlides.map((_, index) => (
                    <button key={index} onClick={(e) => { e.stopPropagation(); setCurrentIndex(index); }} className={`h-1.5 rounded-full transition-all duration-300 ${currentIndex === index ? 'w-6 bg-volt' : 'w-1.5 bg-white/25'}`} />
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
            <button onClick={onMoreClick} className="text-xs font-black text-dim hover:text-txt flex items-center transition-colors label">
                More <ChevronRight size={16} />
            </button>
        )}
    </div>
);

// NOERROR 공식 파트너 배너 (홈 광고)
// 문구의 숫자는 실제 상품 데이터에서 계산한다 — 손으로 적어두면 금방 사실과 어긋난다.
function NoerrorSponsorBanner({ onOpenStore }) {
    const maxRate = Math.max(0, ...PRODUCTS.map(p => p.discountRate));
    return (
        <button onClick={onOpenStore} className="w-full rounded-3xl overflow-hidden border border-white/[0.06] active:scale-[0.99] transition-transform text-left">
            <div className="relative bg-card grain px-5 py-5 flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-volt flex items-center justify-center shrink-0">
                    <span className="font-display text-ink text-lg leading-none">NE</span>
                </div>
                <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-black label text-volt">Official Partner</span>
                    <h3 className="text-txt font-black text-base kern-tight leading-tight mt-0.5">노에러 공식 스토어</h3>
                    <p className="text-dim text-xs font-bold mt-0.5 truncate">
                        상품 {PRODUCTS.length}종 · 최대 {maxRate}% 할인
                    </p>
                </div>
                <ArrowUpRight size={20} className="text-dim shrink-0" />
            </div>
        </button>
    );
}

/**
 * 가로로 넘겨 보는 상품 줄.
 *
 * ★ 이 컴포넌트는 반드시 최상위에 있어야 한다.
 *   예전에는 HomePage 안에서 정의했는데, 그러면 HomePage 가 다시 그려질 때마다
 *   '새로운 컴포넌트 종류'로 취급돼서 안쪽 상품 카드가 통째로 언마운트→재마운트된다.
 *   이미지가 매번 다시 로드되고 스크롤 위치도 초기화된다.
 */
function ProductRow({ items, loading }) {
    return (
        <div className="flex gap-3 overflow-x-auto hide-scrollbar -mx-5 px-5 pb-1" style={{ overscrollBehaviorX: 'contain' }}>
            {loading
                ? [...Array(4)].map((_, i) => <SkeletonStoreCard key={i} />)
                : items.map(p => <ProductCardH key={p.idx} product={p} />)}
        </div>
    );
}

/**
 * 카테고리 바로가기 타일 — 대표 상품 사진 + 아래 라벨.
 *
 * ★ 처음에는 사진 '위에' 어두운 그라디언트를 깔고 글씨를 얹었는데, 4열 타일은
 *   한 칸이 84px밖에 안 돼서 그라디언트가 사진 대부분을 덮었다. 결과적으로
 *   "시커먼 네모 + 글씨"만 보이는 이상한 UI가 됐다 (실기기에서 확인).
 *   지금은 사진을 밝은 타일에 그대로 두고 글씨는 타일 '밖' 아래에 둔다 —
 *   쇼핑몰 앱들의 카테고리 아이콘과 같은 방식이라 한눈에 읽힌다.
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

const GameCard = ({ title, tags, location, current, total, onClick }) => {
    const pct = total ? Math.min(100, Math.round((current / total) * 100)) : 0;
    const almostFull = pct >= 75;
    return (
        <button onClick={onClick} className="w-full p-5 bg-card rounded-2xl border border-white/[0.06] text-left transition-all duration-200 active:scale-[0.98] hover:border-white/15 group">
            <div className="flex justify-between items-start gap-3">
                <p className="font-black text-base text-txt kern-tight leading-snug flex-1">{title}</p>
                <ArrowUpRight size={18} className="text-muted group-hover:text-volt transition-colors shrink-0 mt-0.5" />
            </div>
            <div className="flex flex-wrap gap-1.5 my-3">
                {tags.map((tag, index) => (<span key={index} className="text-[11px] font-black px-2 py-0.5 rounded-full bg-white/5 text-dim">#{tag.label}</span>))}
            </div>
            <div className="flex justify-between items-center gap-3">
                <span className="text-xs text-dim font-bold flex items-center"><MapPin size={13} className="mr-1" /> {location}</span>
                <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div className={`h-full rounded-full ${almostFull ? 'bg-coral' : 'bg-volt'}`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs font-black text-txt tabular">{current}/{total}</span>
                </div>
            </div>
        </button>
    );
};

const CommunityPost = ({ category, title, likes, onClick }) => (
    <button onClick={onClick} className="p-4 bg-card rounded-2xl border border-white/[0.06] flex justify-between items-center w-full transition-all duration-200 active:scale-[0.99] hover:border-white/15">
        <p className="truncate text-sm font-bold text-txt flex-1 mr-4">
            <span className={`font-black mr-2 ${category === 'Q&A' ? 'text-volt' : 'text-muted'}`}>[{category}]</span>
            {title}
        </p>
        <div className="text-xs text-muted whitespace-nowrap flex items-center font-bold"><Heart size={13} className="mr-1" /> {likes}</div>
    </button>
);

// 홈 페이지
// -----------------------------------------------------------------------------------
// 구성 순서에 의도가 있다.
//   ① 인사 → ② 배너 → ③ 카테고리 바로가기 → ④ 특가 → ⑤ 신상 → ⑥ 장비
//   → ⑦ 지금 뜨는 경기 → ⑧ 커뮤니티 → ⑨ 파트너 배너
// 상품을 위쪽에 두되, 경기·커뮤니티가 아래로 밀려 안 보이지 않게 상품 구역은
// 가로 스크롤 한 줄씩으로 짧게 끊었다. (세로로 길게 늘어놓으면 스토어 앱처럼 보인다)
//
// 예전에 있던 '자동으로 흘러가는 상품 띠'는 뺐다. 사용자가 읽으려고 멈춰도 계속
// 움직여서 가격을 확인하기 어렵고, 손가락 스크롤과도 싸운다. 그냥 가로 스크롤이 낫다.
function HomePage({ user, setPage }) {
    const [loading, setLoading] = useState(true);
    useEffect(() => { const t = setTimeout(() => setLoading(false), 700); return () => clearTimeout(t); }, []);

    // 목록은 렌더마다 다시 계산할 필요가 없다 (데이터가 고정된 JSON이므로)
    const deals = useMemo(() => bestDeals(10), []);
    const fresh = useMemo(() => newArrivals(10), []);
    const gear = useMemo(() => gearPicks(8), []);
    const topDeal = deals[0];

    const goStore = () => setPage('store');

    return (
        <div className="flex-grow p-5 space-y-9 bg-ink">
            <section className="pt-1">
                <h1 className="font-display display-italic text-[30px] leading-[0.95] text-txt">
                    오늘의 코트를<br /><span className="text-volt">정복하라</span>
                </h1>
                <p className="text-sm text-dim font-bold mt-2">지금 뛸 수 있는 경기, 콕스타가 다 모았다.</p>
            </section>

            <MainBanner onNavigate={setPage} />

            {/* 카테고리 바로가기 — 사진 타일이라 뭐가 있는지 바로 보인다 */}
            <section>
                <SectionHeader title="뭐 찾으세요?" sub="Shop by Category" onMoreClick={goStore} />
                <div className="grid grid-cols-4 gap-2.5">
                    {['라켓', '의류', '신발', '가방'].map(c => (
                        <CategoryTile key={c} cat={c} onClick={goStore} />
                    ))}
                </div>
            </section>

            {/* 신상 — 파트너 브랜드의 신상이 상품 구역 맨 앞이다 */}
            <section>
                <SectionHeader title="노에러 신상" sub="New Arrivals · 2026 S/S" onMoreClick={goStore} />
                <ProductRow items={fresh} loading={loading} />
            </section>

            {/* 오늘의 특가 — 제일 크게 한 장 + 나머지는 가로 줄 */}
            {topDeal && (
                <section>
                    <SectionHeader title="놓치면 후회할 특가" sub={`Outlet · 최대 ${topDeal.discountRate}%`} onMoreClick={goStore} />
                    <div className="space-y-3">
                        {loading ? <SkeletonCard /> : <ProductCardWide product={topDeal} />}
                        <ProductRow items={deals.slice(1)} loading={loading} />
                    </div>
                </section>
            )}

            {/* 장비 — 옷만 계속 나오지 않도록 라켓·신발·가방·셔틀콕을 따로 모았다 */}
            <section>
                <SectionHeader title="장비 바꿀 때 됐다면" sub="Rackets · Shoes · Bags" onMoreClick={goStore} />
                <ProductRow items={gear} loading={loading} />
            </section>

            <section>
                <SectionHeader title="지금 뜨는 경기" sub="Live Now" onMoreClick={() => setPage('game')} />
                <div className="space-y-3">
                    {loading ? (<><SkeletonCard /><SkeletonCard /></>) : (
                        <>
                            <GameCard title="오산시 저녁 8시 · 초심 환영" tags={[{label: '초심'}, {label: '오산시'}]} location="OO 체육관" current={8} total={12} onClick={() => setPage('game')} />
                            <GameCard title="수원시 주말 40대 A조 모임" tags={[{label: 'A조'}, {label: '수원시'}, {label: '40대'}]} location="XX 체육관" current={10} total={16} onClick={() => setPage('game')} />
                        </>
                    )}
                </div>
            </section>

            <NoerrorSponsorBanner onOpenStore={goStore} />
        </div>
    );
}

// ===================================================================================
// NOERROR 스토어 — 전문 쇼핑몰 스타일
// -----------------------------------------------------------------------------------
// 구성 (위 → 아래): 신상이 무조건 제일 먼저다.
//   ① 브랜드 헤더 (작게 — 상품이 주인공)
//   ② NEW DROP 히어로 — 신상 5종을 잡지 화보처럼 큰 사진으로 자동 회전
//   ③ 신상 전체 가로 줄
//   ④ 카테고리 칩 + 정렬 (스크롤하면 위에 붙는다)
//   ⑤ 상품 그리드 (2열)
//   ⑥ 공식몰 배너 + 데이터 기준일
//
// 찜·장바구니·리뷰는 넣지 않았다. 결제가 공식몰에서 일어나는 구조라
// 앱 안에 그 버튼이 있으면 눌러도 아무 일도 안 생긴다. 안 눌리는 버튼은 신뢰를 깎는다.
// ===================================================================================
function StorePage() {
    const [cat, setCat] = useState('전체');
    const [sort, setSort] = useState('추천');

    const cats = useMemo(() => ['전체', ...CATEGORIES], []);
    const maxRate = useMemo(() => Math.max(0, ...PRODUCTS.map(p => p.discountRate)), []);
    const newDrops = useMemo(() => PRODUCTS.filter(p => p.cat === '신상'), []);

    // 정렬 기준. '추천'은 기본 순서(신상 → 카테고리 순) 그대로.
    const SORTS = {
        '추천': null,
        '신상순': (a, b) => b.idx - a.idx,
        '할인율': (a, b) => b.discountRate - a.discountRate,
        '낮은가격': (a, b) => a.price - b.price,
        '높은가격': (a, b) => b.price - a.price,
    };

    const filtered = useMemo(() => {
        const list = byCategory(cat);
        const cmp = SORTS[sort];
        // 품절은 항상 뒤로 — 살 수 없는 상품이 맨 앞에 있으면 헛걸음이 된다
        const stockFirst = (a, b) => Number(a.soldOut) - Number(b.soldOut);
        return [...list].sort((a, b) => stockFirst(a, b) || (cmp ? cmp(a, b) : 0));
    }, [cat, sort]);

    const fetchedLabel = FETCHED_AT
        ? new Date(FETCHED_AT).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
        : null;

    return (
        <div className="min-h-full bg-ink pb-8">
            {/* ── ① 브랜드 헤더 — 얇게. 상품이 주인공이다 ── */}
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

            {/* ── ② NEW DROP 히어로 — 신상이 가장 먼저, 가장 크게 ── */}
            <div className="px-5">
                <NewDropHero products={newDrops} />
            </div>

            {/* ── ③ 신상 전체 한 줄 ── */}
            <div className="mt-7 px-5">
                <div className="flex items-baseline justify-between mb-3">
                    <div>
                        <span className="text-[10px] font-black label text-volt">2026 S/S Collection</span>
                        <h2 className="text-lg font-black text-txt kern-tight leading-none mt-0.5">방금 나온 신상</h2>
                    </div>
                    <button onClick={() => { setCat('신상'); setSort('신상순'); }}
                        className="text-[11px] font-black text-dim flex items-center label">
                        전체 <ChevronRight size={14} />
                    </button>
                </div>
                <div className="flex gap-3 overflow-x-auto hide-scrollbar -mx-5 px-5 pb-1" style={{ overscrollBehaviorX: 'contain' }}>
                    {newDrops.map(p => <ProductCardH key={p.idx} product={p} />)}
                </div>
            </div>

            {/* ── ④ 카테고리 + 정렬 (붙는 헤더) ── */}
            <div className="sticky top-0 glass z-10 border-b border-white/[0.06] mt-7">
                <div className="flex gap-2 overflow-x-auto hide-scrollbar px-5 pt-3.5 pb-2.5">
                    {cats.map(c => (
                        <button key={c} onClick={() => setCat(c)}
                            className={`flex-shrink-0 px-4 py-2 rounded-full text-[13px] font-black transition-all whitespace-nowrap ${cat === c ? 'bg-volt text-ink' : 'bg-white/5 text-dim border border-white/10'}`}>
                            {c}
                        </button>
                    ))}
                </div>
                <div className="flex items-center justify-between px-5 pb-2.5">
                    <span className="text-[11px] font-black text-muted tabular">{filtered.length}개 상품</span>
                    <div className="flex gap-0.5">
                        {Object.keys(SORTS).map(s => (
                            <button key={s} onClick={() => setSort(s)}
                                className={`px-2 py-1 rounded-full text-[11px] font-black transition-colors ${sort === s ? 'text-volt bg-volt/10' : 'text-muted'}`}>
                                {s}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── ⑤ 상품 그리드 ── */}
            {filtered.length > 0 ? (
                <div className="px-5 pt-4 grid grid-cols-2 gap-3">
                    {filtered.map(p => <ProductCardGrid key={p.idx} product={p} />)}
                </div>
            ) : (
                <div className="px-5 py-16 text-center">
                    <p className="text-sm text-dim font-bold">이 분류에는 상품이 없습니다.</p>
                </div>
            )}

            {/* ── ⑥ 공식몰 배너 + 데이터 기준 ── */}
            <div className="px-5 mt-8">
                <button onClick={() => window.open(NOERROR_URL, '_blank', 'noopener,noreferrer')} className="w-full rounded-2xl overflow-hidden border border-white/[0.06] active:scale-[0.99] transition-transform">
                    <img src={noErrorBanner} alt="NOERROR 광고 배너" className="w-full h-auto object-cover" />
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

// ===================================================================================
// 경기 로비 페이지
// ===================================================================================
function GamePage({ user, userData, onLoginClick, sharedRoomId, onNavigate }) {
    const [currentView, setCurrentView] = useState(sharedRoomId ? 'room' : 'lobby');
    const [selectedRoomId, setSelectedRoomId] = useState(sharedRoomId || null);
    const [rooms, setRooms] = useState([]);
    const [loadingRooms, setLoadingRooms] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showCreateRoomModal, setShowCreateRoomModal] = useState(false);
    const [editRoomData, setEditRoomData] = useState(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    const roomsCollectionRef = useMemo(() => collection(db, "rooms"), []);

    useEffect(() => {
        if (!user || currentView !== 'lobby') return;
        setLoadingRooms(true);
        const q = query(roomsCollectionRef);
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const roomsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            roomsData.sort((a, b) => {
                const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
                const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
                return timeB - timeA;
            });
            setRooms(roomsData);
            setLoadingRooms(false);
        }, (error) => {
            console.error("Error fetching rooms: ", error);
            setLoadingRooms(false);
        });
        return () => unsubscribe();
    }, [user, currentView, roomsCollectionRef]);

    const filteredRooms = useMemo(() => {
        return rooms.filter(room =>
            (room.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (room.location || '').toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [rooms, searchTerm]);

    const handleCreateRoom = async (newRoomData) => {
        if (!user) { onLoginClick(); return; }
        const docRef = await addDoc(roomsCollectionRef, newRoomData);
        handleEnterRoom(docRef.id);
    };

    const handleUpdateRoom = async (updatedData) => {
        if (!editRoomData) return;
        try {
            const roomRef = doc(db, "rooms", editRoomData.id);
            await updateDoc(roomRef, {
                name: updatedData.name, location: updatedData.location, address: updatedData.address,
                coords: updatedData.coords, description: updatedData.description,
                password: updatedData.password, admins: updatedData.admins
            });
            toast("방 정보가 수정되었습니다.");
            setIsEditModalOpen(false);
            setEditRoomData(null);
        } catch (e) { toast("수정 실패: " + e.message, 'error'); }
    };

    const handleDeleteRoom = async () => {
        if (!editRoomData) return;
        if (!confirm("정말로 이 방을 삭제하시겠습니까?")) return;
        try {
            await deleteDoc(doc(db, "rooms", editRoomData.id));
            toast("방이 삭제되었습니다.");
            setIsEditModalOpen(false);
            setEditRoomData(null);
        } catch (e) { toast("삭제 실패: " + e.message, 'error'); }
    };

    const onEditClick = (room) => { setEditRoomData(room); setIsEditModalOpen(true); };

    const handleEnterRoom = (roomId) => {
        setSelectedRoomId(roomId);
        setCurrentView('room');
        const url = new URL(window.location);
        url.searchParams.set('roomId', roomId);
        window.history.pushState({}, '', url);
    };

    const handleExitRoom = () => {
        setSelectedRoomId(null);
        setCurrentView('lobby');
        const url = new URL(window.location);
        url.searchParams.delete('roomId');
        window.history.pushState({}, '', url);
    };

    if (!user && selectedRoomId) {
        return (
            <div className="relative h-full overflow-hidden bg-ink">
                <div className="filter blur-md pointer-events-none h-full">
                    <GameRoomView roomId={selectedRoomId} user={null} userData={null} preview={true} />
                </div>
                <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-ink/60 backdrop-blur-[2px]">
                    <div className="bg-surface p-8 rounded-[28px] shadow-deep border border-white/[0.06] text-center max-w-[80%] animate-scale-in">
                        <div className="w-14 h-14 rounded-2xl bg-volt flex items-center justify-center mx-auto mb-4">
                            <Lock size={26} className="text-ink" />
                        </div>
                        <h2 className="text-lg font-black kern-tight mb-1 text-txt">경기방 입장</h2>
                        <p className="text-sm text-dim font-medium mb-6">이 경기방에 참여하려면<br/>로그인이 필요합니다.</p>
                        <button onClick={onLoginClick} className="w-full py-4 bg-volt text-ink font-black rounded-full shadow-volt">로그인하고 입장하기</button>
                    </div>
                </div>
            </div>
        );
    }

    if (!user && !selectedRoomId) {
        return <LoginRequiredPage icon={ShieldCheck} title="로그인이 필요합니다" description="경기 시스템은 로그인 후 이용할 수 있습니다." onLoginClick={onLoginClick} />;
    }

    if (currentView === 'room') {
        return <GameRoomView roomId={selectedRoomId} user={user} userData={userData} onExitRoom={() => { setSelectedRoomId(null); setCurrentView('lobby'); }} roomsCollectionRef={roomsCollectionRef} onNavigate={onNavigate} />;
    }

    return (
        <div className="relative h-full flex flex-col bg-ink">
            <div className="px-5 pt-4 pb-3 bg-surface border-b border-white/[0.06]">
                <div className="flex items-baseline justify-between mb-3">
                    <div>
                        <span className="text-[11px] font-black label text-volt">Matches</span>
                        <h1 className="text-2xl font-black kern-tight leading-none mt-0.5 text-txt">경기방</h1>
                    </div>
                    <span className="text-xs font-black text-dim tabular">{filteredRooms.length} OPEN</span>
                </div>
                <div className="relative">
                    <input type="text" placeholder="경기방 이름 또는 장소 검색" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full p-3.5 pl-11 bg-card2 rounded-2xl text-sm font-bold border border-white/10 focus:border-volt outline-none placeholder-muted text-txt" />
                    <Search size={20} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                </div>
            </div>

            <main className="flex-grow overflow-y-auto p-4 space-y-3 hide-scrollbar">
                {loadingRooms ? (
                    <><SkeletonRoomCard /><SkeletonRoomCard /><SkeletonRoomCard /></>
                ) : filteredRooms.length > 0 ? (
                    filteredRooms.map(room => (
                        <RoomCard key={room.id} room={room} user={user} onEnter={() => handleEnterRoom(room.id)} onEdit={onEditClick} />
                    ))
                ) : (
                    <EmptyState icon={Archive} title="개설된 경기방이 없습니다" description={searchTerm ? "검색 결과가 없습니다." : "첫 번째 경기방을 만들어보세요!"} buttonText={searchTerm ? null : "경기방 만들기"} onButtonClick={searchTerm ? null : () => setShowCreateRoomModal(true)} />
                )}
            </main>

            <button onClick={() => setShowCreateRoomModal(true)} className="absolute bottom-6 right-6 bg-volt text-ink h-14 pl-4 pr-5 rounded-full shadow-volt flex items-center gap-1.5 transition-transform active:scale-90 font-black">
                <Plus size={22} strokeWidth={2.6} /> 개설
            </button>

            <CreateRoomModal isOpen={showCreateRoomModal} onClose={() => setShowCreateRoomModal(false)} onSubmit={handleCreateRoom} user={user} userData={userData} />

            <EditRoomInfoModal isOpen={isEditModalOpen} onClose={() => { setIsEditModalOpen(false); setEditRoomData(null); }} roomData={editRoomData} onSave={handleUpdateRoom} onDelete={handleDeleteRoom} />
        </div>
    );
}

// 로비 카드
function RoomCard({ room, onEnter, onEdit, user }) {
    const isAdmin = user && (
        isSuperAdmin(user) ||
        user.uid === room.adminUid ||
        (room.admins && room.admins.some(admin =>
            admin === user.email || admin === user.uid || (user.email && admin === user.email.split('@')[0])
        ))
    );
    return (
        <div className="bg-card rounded-2xl border border-white/[0.06] p-5 cursor-pointer transition-all hover:border-white/15 active:scale-[0.98] relative group overflow-hidden" onClick={onEnter}>
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-volt" />
            <div className="flex justify-between items-start mb-2 pl-1">
                <div className="flex items-center gap-2 overflow-hidden">
                    <h3 className="text-base font-black text-txt kern-tight truncate">{room.name}</h3>
                    {room.password && <Lock size={14} className="text-muted flex-shrink-0" />}
                </div>
                {isAdmin && (
                    <button onClick={(e) => { e.stopPropagation(); onEdit(room); }} className="p-2 -mr-2 -mt-2 text-muted hover:text-volt rounded-full transition-colors z-10">
                        <Edit3Icon size={16} />
                    </button>
                )}
            </div>
            <p className="text-xs text-dim mb-4 truncate font-bold pl-1">
                <MapPin size={13} className="inline mr-1 -mt-0.5" />{room.location}
            </p>
            <div className="flex flex-wrap gap-2 items-center pl-1">
                <span className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 text-txt rounded-full text-[11px] font-black label">
                    <BarChart2 size={13} className="text-volt" />{room.levelLimit === 'N조' ? '전체 급수' : `${room.levelLimit} 이상`}
                </span>
                <span className="flex items-center gap-1 px-3 py-1.5 bg-white/5 text-dim rounded-full text-[11px] font-black">
                    <Users size={13} /> {room.playerCount || 0}명
                </span>
            </div>
        </div>
    );
}

// ===================================================================================
// 경기방 내부 컴포넌트
// ===================================================================================
const CourtTimer = ({ startTime }) => {
    const [time, setTime] = useState('00:00');
    useEffect(() => {
        if (startTime) {
            const updateTimer = () => {
                const now = new Date();
                const start = startTime.toDate ? startTime.toDate() : new Date(startTime);
                const diff = Math.floor((now - start) / 1000);
                if (diff >= 0) {
                    const minutes = String(Math.floor(diff / 60)).padStart(2, '0');
                    const seconds = String(diff % 60).padStart(2, '0');
                    setTime(`${minutes}:${seconds}`);
                }
            };
            updateTimer();
            const timerId = setInterval(updateTimer, 1000);
            return () => clearInterval(timerId);
        } else { setTime('00:00'); }
    }, [startTime]);
    return (
        <div className="text-xs font-black tabular text-ink bg-volt px-2.5 py-1 rounded-md flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-ink animate-pulse"></span>{time}
        </div>
    );
};

const PlayerCard = React.memo(({ player, isAdmin, isCurrentUser, isPlaying, isResting, isSelected, onCardClick, onDeleteClick, onLongPress, onDragStart, onDragEnd, onDragOver, onDrop }) => {
    const longPressTimer = useRef(null);
    const isLongPressExecuted = useRef(false);

    const startPress = () => {
        if (!isAdmin || !onLongPress) return;
        isLongPressExecuted.current = false;
        longPressTimer.current = setTimeout(() => { isLongPressExecuted.current = true; onLongPress(player); }, 800);
    };
    const endPress = () => { if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; } };
    const handleClick = (e) => {
        if (isLongPressExecuted.current) { isLongPressExecuted.current = false; return; }
        if (onCardClick) onCardClick(player);
    };

    if (!player) return <div className="h-[52px] bg-white/5 rounded-lg animate-pulse"></div>;

    const levelColorClass = getLevelColor(player.level);
    const genderBorder = player.gender === '남' ? 'border-l-blue-500' : 'border-l-pink-500';

    let containerClass = `relative bg-card2 rounded-lg px-2 py-1 h-[52px] flex flex-col justify-center border border-white/[0.06] border-l-[3px] transition-all duration-200 cursor-pointer active:scale-95 ${genderBorder} select-none `;
    if (isPlaying) containerClass += " opacity-45 grayscale ";
    if (isResting) containerClass += " opacity-40 grayscale ";
    if (isSelected) containerClass += " ring-2 ring-volt ring-offset-2 ring-offset-ink scale-105 z-10 shadow-volt ";
    else if (isCurrentUser) containerClass += " ring-2 ring-coral ring-offset-2 ring-offset-ink ";

    const canDrag = isAdmin && typeof onDragStart === 'function';

    return (
        <div className={containerClass}
            onMouseDown={startPress} onMouseUp={endPress} onMouseLeave={endPress}
            onTouchStart={startPress} onTouchEnd={endPress} onClick={handleClick}
            draggable={canDrag}
            onDragStart={canDrag ? (e) => onDragStart(e, player.id) : undefined}
            onDragEnd={canDrag ? onDragEnd : undefined}
            onDragOver={canDrag ? onDragOver : undefined}
            onDrop={canDrag ? (e) => onDrop(e, { type: 'player', player: player }) : undefined}>
            <div className="flex justify-between items-start pointer-events-none mb-0.5">
                <span className="text-xs font-black text-txt truncate w-full pr-1 leading-none">{player.name}</span>
                {isAdmin && (
                    <button className="pointer-events-auto absolute -top-1.5 -right-1.5 bg-ink text-txt hover:bg-coral hover:text-ink rounded-full border border-white/10 p-0.5 transition-colors z-20"
                        onClick={(e) => { e.stopPropagation(); onDeleteClick && onDeleteClick(player); }}>
                        <XIcon size={10} strokeWidth={3} />
                    </button>
                )}
            </div>
            <div className="flex justify-between items-center pointer-events-none">
                <span className={`text-[10px] font-black ${levelColorClass.replace('border-', 'text-')}`}>{player.level || 'N'}</span>
                <span className="text-[10px] text-muted font-black tabular">{player.todayGames || 0}G</span>
            </div>
        </div>
    );
});

const LeftPlayerCard = ({ onClick, isAdmin }) => (
    <div className="h-[52px] bg-coral/10 rounded-lg flex flex-col items-center justify-center border-2 border-dashed border-coral/40 relative select-none">
        <span className="text-[10px] font-black text-coral leading-tight">나간 선수</span>
        {isAdmin && onClick && (
            <button onClick={(e) => { e.stopPropagation(); onClick(); }} className="absolute -top-1.5 -right-1.5 bg-coral text-ink hover:bg-coral-dark rounded-full p-0.5 z-20">
                <XIcon size={10} strokeWidth={3} />
            </button>
        )}
    </div>
);

const EmptySlot = ({ onSlotClick, onDragOver, onDrop, isDragOver }) => (
    <div onClick={onSlotClick} onDragOver={onDragOver} onDrop={onDrop}
        className={`h-[52px] rounded-lg flex items-center justify-center border-2 border-dashed transition-all cursor-pointer ${isDragOver ? 'bg-volt/10 border-volt text-volt' : 'bg-white/[0.02] border-white/10 text-muted hover:border-volt hover:text-volt'}`}>
        <Plus size={18} strokeWidth={3} />
    </div>
);

// 방 정보 수정 모달
function EditRoomInfoModal({ isOpen, onClose, roomData, onSave, onDelete }) {
    const [formData, setFormData] = useState({ name: '', location: '', address: '', coords: null, description: '', maxPlayers: 20, levelLimit: 'N조', password: '', admins: [] });
    const [usePassword, setUsePassword] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    useEffect(() => {
        if (isOpen && roomData) {
            setFormData({
                name: roomData.name || '', location: roomData.location || '', address: roomData.address || '',
                coords: roomData.coords || null, description: roomData.description || '', maxPlayers: roomData.maxPlayers || 20,
                levelLimit: roomData.levelLimit || 'N조', password: roomData.password || '', admins: roomData.admins || []
            });
            setUsePassword(!!roomData.password);
        }
    }, [isOpen, roomData]);

    const handleChange = (e) => { const { name, value } = e.target; setFormData(prev => ({ ...prev, [name]: value })); };

    const handleAddressSearch = () => {
        if (!window.daum || !window.daum.Postcode) { toast("주소 검색 서비스를 불러오지 못했습니다.", 'error'); return; }
        new window.daum.Postcode({
            oncomplete: function(data) {
                const addr = data.roadAddress || data.jibunAddress;
                const buildingName = data.buildingName || '';
                setFormData(prev => ({ ...prev, address: addr, location: (!prev.location && buildingName) ? buildingName : prev.location }));
                if (window.kakao && window.kakao.maps) {
                    window.kakao.maps.load(() => {
                        if (window.kakao.maps.services) {
                            const geocoder = new window.kakao.maps.services.Geocoder();
                            geocoder.addressSearch(addr, (result, status) => {
                                if (status === window.kakao.maps.services.Status.OK) {
                                    setFormData(prev => ({ ...prev, coords: { lat: parseFloat(result[0].y), lng: parseFloat(result[0].x) } }));
                                } else { toast("주소는 찾았으나 좌표를 가져올 수 없습니다.", 'error'); }
                            });
                        } else { toast("카카오맵 서비스 모듈을 사용할 수 없습니다.", 'error'); }
                    });
                }
            }
        }).open();
    };

    const handleAdminChange = (index, value) => { const newAdmins = [...formData.admins]; newAdmins[index] = value; setFormData(prev => ({ ...prev, admins: newAdmins })); };
    const addAdminSlot = () => setFormData(prev => ({ ...prev, admins: [...prev.admins, ''] }));
    const removeAdminSlot = (index) => setFormData(prev => ({ ...prev, admins: prev.admins.filter((_, i) => i !== index) }));

    const handleSubmit = () => {
        if (!formData.address || !formData.coords) { toast("장소를 검색하여 유효한 주소를 입력해주세요.", 'error'); return; }
        const cleanAdmins = formData.admins.map(a => a.trim()).filter(Boolean);
        onSave({ ...formData, admins: cleanAdmins, password: usePassword ? formData.password : '' });
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 backdrop-blur-md">
            <div className="bg-surface rounded-t-[32px] sm:rounded-[28px] p-6 w-full max-w-lg shadow-deep border border-white/[0.06] max-h-[92vh] overflow-y-auto hide-scrollbar animate-slide-up sm:animate-scale-in">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-black kern-tight text-txt">방 정보 수정</h3>
                    <button onClick={onClose} className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-dim"><X size={20}/></button>
                </div>
                <div className="space-y-4">
                    <div>
                        <label className={LABEL_CLS}>방 제목</label>
                        <input type="text" name="name" value={formData.name} onChange={handleChange} className={FIELD_CLS}/>
                    </div>
                    <div>
                        <label className={LABEL_CLS}>장소 (주소 검색)</label>
                        <div className="flex gap-2 mb-2">
                            <input type="text" placeholder="터치해서 주소 수정..." value={formData.address} readOnly onClick={handleAddressSearch} className={`${FIELD_CLS} cursor-pointer text-sm truncate`} />
                            <button type="button" onClick={handleAddressSearch} className="bg-volt text-ink px-4 rounded-xl font-black text-sm shrink-0">검색</button>
                        </div>
                        <input type="text" name="location" placeholder="장소명 (예: 콕스타 체육관)" value={formData.location} onChange={handleChange} className="w-full p-3 bg-card2 rounded-xl border border-white/10 focus:border-volt outline-none text-sm font-bold text-txt" />
                        {formData.coords && <p className="text-xs text-volt font-black mt-1 ml-1">✅ 위치 좌표 확인됨</p>}
                    </div>
                    <div>
                        <label className={LABEL_CLS}>모임 소개</label>
                        <textarea name="description" value={formData.description} onChange={handleChange} rows={3} className={`${FIELD_CLS} resize-none`}/>
                    </div>
                    <div className="flex gap-4">
                        <div className="flex-1">
                            <label className={LABEL_CLS}>입장 급수</label>
                            <select name="levelLimit" value={formData.levelLimit} onChange={handleChange} className={FIELD_CLS}>
                                {['N조','S조','A조','B조','C조','D조','E조'].map(l => (<option key={l} value={l} className="bg-surface">{l === 'N조' ? '전체 급수' : `${l} 이상`}</option>))}
                            </select>
                        </div>
                        <div className="flex-1">
                            <label className={LABEL_CLS}>최대 인원</label>
                            <input type="number" name="maxPlayers" value={formData.maxPlayers} onChange={handleChange} min="4" className={FIELD_CLS} />
                        </div>
                    </div>
                    <div className="bg-white/[0.03] p-4 rounded-2xl border border-white/[0.06]">
                        <label className="block text-[11px] font-black label text-dim mb-2">공동 관리자 (이메일/아이디)</label>
                        {formData.admins.map((adminEmail, idx) => (
                            <div key={idx} className="flex gap-2 mb-2">
                                <input type="text" value={adminEmail} onChange={(e) => handleAdminChange(idx, e.target.value)} placeholder="user@example.com" className="flex-1 p-2.5 bg-card2 rounded-lg border border-white/10 text-sm font-bold focus:border-volt outline-none text-txt" />
                                <button onClick={() => removeAdminSlot(idx)} className="text-coral hover:text-coral-dark"><X size={18}/></button>
                            </div>
                        ))}
                        <button onClick={addAdminSlot} className="text-sm text-volt font-black hover:underline">+ 관리자 추가</button>
                    </div>
                    <div className="bg-white/[0.03] p-4 rounded-2xl border border-white/[0.06]">
                        <label className="flex items-center gap-2 mb-2">
                            <input type="checkbox" checked={usePassword} onChange={(e) => setUsePassword(e.target.checked)} className="rounded accent-volt"/>
                            <span className="text-sm font-black text-txt">비밀번호 사용</span>
                        </label>
                        {usePassword && (
                            <div className="relative">
                                <input type={showPassword ? "text" : "password"} name="password" value={formData.password} onChange={handleChange} className="w-full p-2.5 bg-card2 rounded-lg border border-white/10 text-sm font-bold focus:border-volt outline-none text-txt"/>
                                <button onClick={() => setShowPassword(!showPassword)} className="absolute right-2 top-1/2 -translate-y-1/2 text-dim text-xs font-bold">{showPassword ? '숨기기' : '보기'}</button>
                            </div>
                        )}
                    </div>
                    <button onClick={handleSubmit} className="w-full py-4 bg-volt text-ink font-black rounded-full shadow-volt label">저장하기</button>
                    {onDelete && (
                        <button onClick={onDelete} className="w-full py-3.5 mt-1 bg-coral/10 text-coral font-black rounded-full hover:bg-coral/20 transition-colors">방 삭제 (관리자 전용)</button>
                    )}
                </div>
            </div>
        </div>
    );
}

// 게임 수 수정 모달
function EditGamesModal({ isOpen, onClose, player, onSave }) {
    const [games, setGames] = useState(0);
    useEffect(() => { if (isOpen && player) setGames(player.todayGames || 0); }, [isOpen, player]);
    if (!isOpen || !player) return null;
    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-md">
            <div className="bg-surface rounded-[28px] p-6 w-full max-w-sm shadow-deep border border-white/[0.06] animate-scale-in">
                <div className="text-center mb-6">
                    <h3 className="text-lg font-black text-txt kern-tight mb-0.5">{player.name}</h3>
                    <p className="text-[11px] text-muted font-bold label">경기 수 · 히스토리</p>
                </div>
                <div className="flex items-center justify-center gap-6 mb-8 bg-white/[0.03] py-5 rounded-2xl border border-white/[0.06]">
                    <button onClick={() => setGames(g => Math.max(0, g - 1))} className="w-11 h-11 rounded-full bg-card2 border border-white/10 text-txt font-black text-xl active:scale-90 transition-transform">−</button>
                    <span className="text-4xl font-display text-volt w-14 tabular text-center">{games}</span>
                    <button onClick={() => setGames(g => g + 1)} className="w-11 h-11 rounded-full bg-volt text-ink font-black text-xl active:scale-90 transition-transform">+</button>
                </div>
                <div className="mb-6">
                    <h4 className="text-[11px] font-black label text-dim mb-3 text-left pl-1">오늘 함께한 선수들</h4>
                    <div className="space-y-2 max-h-40 overflow-y-auto hide-scrollbar">
                        {player.matchHistory && player.matchHistory.length > 0 ? (
                            player.matchHistory.map((historyStr, idx) => (
                                <div key={idx} className="bg-white/[0.03] p-2.5 rounded-xl border border-white/[0.06] flex items-start gap-3">
                                    <span className="text-[10px] font-black text-volt pt-1 shrink-0">{player.matchHistory.length - idx}.</span>
                                    <div className="flex flex-wrap gap-1">
                                        {historyStr.split(', ').map((name, nIdx) => (
                                            <span key={nIdx} className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold ${name.includes(player.name) ? 'bg-volt text-ink' : 'bg-white/5 text-dim border border-white/10'}`}>{name}</span>
                                        ))}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-[11px] text-muted py-6 text-center border-2 border-dashed border-white/10 rounded-xl font-bold">아직 경기 기록이 없습니다.</p>
                        )}
                    </div>
                </div>
                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 py-3.5 bg-white/5 text-dim font-black rounded-full text-sm">취소</button>
                    <button onClick={() => onSave(player.id, games)} className="flex-1 py-3.5 bg-volt text-ink font-black rounded-full text-sm shadow-volt">저장</button>
                </div>
            </div>
        </div>
    );
}

/** 민감도 4단계 버튼 한 줄 (컴포넌트 안에 두면 매 렌더마다 재마운트된다 — 위 ProductRow 주석 참고) */
function SensitivityRow({ value, onChange }) {
    return (
        <div className="grid grid-cols-4 gap-1.5">
            {AUTO_MATCH_SENSITIVITIES.map(s => (
                <button
                    key={s.key}
                    onClick={() => onChange(s.key)}
                    className={`py-2 rounded-lg text-xs font-black transition-all ${value === s.key ? 'bg-volt text-ink' : 'bg-white/5 text-dim'}`}
                >{s.label}</button>
            ))}
        </div>
    );
}

// 환경 설정 모달
function SettingsModal({ isOpen, onClose, roomData, onSave, onReset, onKickAll, players, onReplayGuide, isGhost, onToggleGhost }) {
    const [settings, setSettings] = useState({
        mode: 'admin', numScheduledMatches: 4, numInProgressCourts: 2,
        // [자동 매칭] 민감도 = "경기중인 선수를 몇 명까지 미리 예약할지"
        autoMatchConfig: { sensitivity: 'normal', perGenderSensitivity: false, maleSensitivity: 'normal', femaleSensitivity: 'normal' },
    });
    const [sharing, setSharing] = useState(false);

    useEffect(() => {
        if (!roomData) return;
        const cfg = roomData.autoMatchConfig || {};
        setSettings({
            mode: roomData.mode || 'admin',
            numScheduledMatches: roomData.numScheduledMatches || 4,
            numInProgressCourts: roomData.numInProgressCourts || 2,
            autoMatchConfig: {
                sensitivity: cfg.sensitivity || 'normal',
                perGenderSensitivity: !!cfg.perGenderSensitivity,
                maleSensitivity: cfg.maleSensitivity || cfg.sensitivity || 'normal',
                femaleSensitivity: cfg.femaleSensitivity || cfg.sensitivity || 'normal',
            },
        });
    }, [roomData]);
    if (!isOpen) return null;
    const handleSave = () => { onSave(settings); onClose(); };
    const adjustCount = (field, delta) => setSettings(prev => ({ ...prev, [field]: Math.max(1, prev[field] + delta) }));

    const setAuto = (patch) => setSettings(prev => ({ ...prev, autoMatchConfig: { ...prev.autoMatchConfig, ...patch } }));
    const activeSensKey = settings.autoMatchConfig.sensitivity;

    // 지금 활성 인원 (휴식 제외) — 민감도를 고를 때 판단 근거가 된다
    const activeList = Object.values(players || {}).filter(p => !p.isResting);
    const activeMale = activeList.filter(p => p.gender === '남').length;
    const activeFemale = activeList.length - activeMale;

    const handleShareSummary = async () => {
        if (sharing) return;
        setSharing(true);
        try {
            const summary = computeDailySummary(players, roomData?.name);
            if (summary.attendees.length === 0) {
                toast("아직 참석한 선수가 없습니다.", 'error');
                return;
            }
            const how = await shareSummaryCard(summary);
            toast(how === 'shared' ? "요약 카드를 공유했습니다." : "요약 카드를 저장했습니다.");
        } catch (e) {
            console.error("요약 카드 실패:", e);
            toast("요약 카드를 만들지 못했습니다.", 'error');
        } finally { setSharing(false); }
    };


    const Stepper = ({ label, field }) => (
        <div>
            <label className="text-[11px] font-black label text-dim mb-2 block text-center">{label}</label>
            <div className="flex items-center justify-center gap-3">
                <button onClick={() => adjustCount(field, -1)} className="w-9 h-9 rounded-full bg-card2 border border-white/10 text-txt font-black active:scale-90 transition-transform">−</button>
                <span className="text-xl font-black w-5 text-center tabular text-txt">{settings[field]}</span>
                <button onClick={() => adjustCount(field, 1)} className="w-9 h-9 rounded-full bg-volt text-ink font-black active:scale-90 transition-transform">+</button>
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-md">
            <div className="bg-surface rounded-[28px] p-6 w-full max-w-sm shadow-deep border border-white/[0.06] animate-scale-in">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-black kern-tight text-txt">환경 설정</h3>
                    <button onClick={onClose} className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-dim"><XIcon size={20}/></button>
                </div>
                <div className="space-y-6">
                    <div>
                        <label className="text-[11px] font-black label text-dim mb-2 block">운영 모드</label>
                        <div className="flex bg-white/5 rounded-xl p-1">
                            {['admin', 'personal'].map(mode => (
                                <button key={mode} onClick={() => setSettings(s => ({ ...s, mode }))} className={`flex-1 py-2.5 text-sm font-black rounded-lg transition-all ${settings.mode === mode ? 'bg-volt text-ink' : 'text-dim'}`}>
                                    {mode === 'admin' ? '👑 관리자' : '🏃 개인'}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <Stepper label="경기 예정 수" field="numScheduledMatches" />
                        <Stepper label="코트 수" field="numInProgressCourts" />
                    </div>

                    {/* ── [자동 매칭] 민감도 ──
                        점수 커트라인이 아니다. "경기중인 선수를 얼마나 적극적으로 다음 경기에
                        미리 예약할지"를 정한다. 낮음일수록 바로 시작할 수 있는 조합만,
                        높음일수록 덜 친 사람을 챙기지만 코트가 끝나기를 기다려야 한다. */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-[11px] font-black label text-dim">🤖 자동 매칭 민감도</label>
                            <span className="text-[10px] font-black text-muted tabular">활성 남 {activeMale} · 여 {activeFemale}</span>
                        </div>
                        <SensitivityRow value={activeSensKey} onChange={(k) => setAuto({ sensitivity: k })} />
                        <p className="text-[11px] leading-relaxed text-emerald-400/90 font-medium mt-2">
                            {getSensitivity(activeSensKey).desc}
                        </p>

                        <label className="flex items-center gap-2 mt-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={settings.autoMatchConfig.perGenderSensitivity}
                                onChange={(e) => setAuto({ perGenderSensitivity: e.target.checked })}
                                className="w-4 h-4 accent-[#CDFB47]"
                            />
                            <span className="text-xs font-bold text-dim">남/여 따로 정하기</span>
                        </label>
                        {settings.autoMatchConfig.perGenderSensitivity && (
                            <div className="mt-2 space-y-2">
                                <div>
                                    <span className="text-[10px] font-black label text-muted block mb-1">남자</span>
                                    <SensitivityRow value={settings.autoMatchConfig.maleSensitivity} onChange={(k) => setAuto({ maleSensitivity: k })} />
                                </div>
                                <div>
                                    <span className="text-[10px] font-black label text-muted block mb-1">여자</span>
                                    <SensitivityRow value={settings.autoMatchConfig.femaleSensitivity} onChange={(k) => setAuto({ femaleSensitivity: k })} />
                                </div>
                                <p className="text-[10px] text-muted font-medium">혼복은 위 기본값을 씁니다.</p>
                            </div>
                        )}
                    </div>

                    {/* ── 오늘의 운동 요약 · 안내 다시 보기 ── */}
                    <div>
                        <label className="text-[11px] font-black label text-dim mb-2 block">오늘의 운동</label>
                        <div className="space-y-2">
                            <button onClick={handleShareSummary} disabled={sharing} className="w-full py-3 bg-volt/10 text-volt font-black rounded-xl text-sm hover:bg-volt/20 transition-colors flex justify-center items-center gap-2 disabled:opacity-50">
                                📸 {sharing ? '만드는 중...' : '하루 요약 카드 만들기'}
                            </button>
                            <button onClick={onReplayGuide} className="w-full py-3 bg-white/5 text-dim font-black rounded-xl text-sm hover:bg-white/10 transition-colors flex justify-center items-center gap-2">
                                🤖 자동매칭 안내 다시 보기
                            </button>
                        </div>
                    </div>

                    {/* ── 👻 운영 전용 모드 ──
                        코치·총무처럼 운동은 안 하고 방만 굴리는 사람을 위한 모드.
                        켜면 선수 명단·인원 수·매칭 후보에서 완전히 빠진다. 기기에만 저장되므로
                        방마다 따로 정할 수 있다. */}
                    <div>
                        <label className="text-[11px] font-black label text-dim mb-2 block">내 참여 방식</label>
                        <button
                            onClick={onToggleGhost}
                            className={`w-full py-3 font-black rounded-xl text-sm transition-colors flex justify-center items-center gap-2 ${isGhost ? 'bg-volt/15 text-volt' : 'bg-white/5 text-dim hover:bg-white/10'}`}
                        >
                            👻 {isGhost ? '운영 전용 모드 끄기 (다시 선수로 참여)' : '운영만 하기 (선수 명단에서 빠짐)'}
                        </button>
                        <p className="text-[11px] leading-relaxed text-muted font-medium mt-2">
                            {isGhost
                                ? '지금은 선수 명단·인원 수·매칭 후보에 잡히지 않습니다.'
                                : '경기는 안 뛰고 운영만 할 때 켜세요. 매칭 후보에서 빠집니다.'}
                        </p>
                    </div>

                    <div>
                        <label className="text-[11px] font-black label text-dim mb-2 block">고급 기능</label>
                        <div className="space-y-2">
                            <button onClick={onReset} className="w-full py-3 bg-coral/10 text-coral font-black rounded-xl text-sm hover:bg-coral/20 transition-colors flex justify-center items-center gap-2">
                                <ArchiveIcon size={16}/> 시스템 초기화 (경기 삭제)
                            </button>
                            <button onClick={onKickAll} className="w-full py-3 bg-white/5 text-dim font-black rounded-xl text-sm hover:bg-white/10 transition-colors flex justify-center items-center gap-2">
                                <UsersIcon size={16}/> 모든 선수 내보내기
                            </button>
                        </div>
                    </div>
                    <button onClick={handleSave} className="w-full py-4 bg-volt text-ink font-black rounded-full text-base shadow-volt label">설정 저장</button>
                </div>
            </div>
        </div>
    );
}

// 프로필 수정 모달
function EditProfileModal({ isOpen, onClose, userData, user }) {
    const [formData, setFormData] = useState({ name: '', level: 'N조', gender: '남', birthYear: '2000', region: '서울', currentPassword: '', newPassword: '', confirmPassword: '' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    useEffect(() => {
        if (isOpen && userData) {
            setFormData(prev => ({ ...prev, name: userData.name || '', level: userData.level || 'N조', gender: userData.gender || '남', birthYear: userData.birthYear || '2000', currentPassword: '', newPassword: '', confirmPassword: '' }));
        }
    }, [isOpen, userData]);

    const handleChange = (e) => { const { name, value } = e.target; setFormData(prev => ({ ...prev, [name]: value })); };
    const isKakaoUser = userData?.kakaoId || (user?.email && user.email.startsWith('kakao'));

    const handleSave = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            if (!isKakaoUser && formData.newPassword) {
                if (formData.newPassword.length < 6) throw new Error("새 비밀번호는 6자 이상이어야 합니다.");
                if (formData.newPassword !== formData.confirmPassword) throw new Error("새 비밀번호가 일치하지 않습니다.");
                if (!formData.currentPassword) throw new Error("비밀번호를 변경하려면 현재 비밀번호를 입력해주세요.");
                const credential = EmailAuthProvider.credential(user.email, formData.currentPassword);
                await reauthenticateWithCredential(user, credential);
                await updatePassword(user, formData.newPassword);
            }
            const userRef = doc(db, "users", user.uid);
            await updateDoc(userRef, { name: formData.name, level: formData.level, gender: formData.gender, birthYear: formData.birthYear });
            if (user.displayName !== formData.name) await updateProfile(user, { displayName: formData.name });
            toast("프로필이 수정되었습니다.");
            onClose();
        } catch (err) {
            console.error(err);
            if (err.code === 'auth/wrong-password') setError('현재 비밀번호가 올바르지 않습니다.');
            else setError(err.message || "프로필 수정 중 오류가 발생했습니다.");
        } finally { setLoading(false); }
    };

    if (!isOpen) return null;
    const currentYear = new Date().getFullYear();
    const birthYears = Array.from({ length: 70 }, (_, i) => currentYear - i - 10);

    return (
        <div className="fixed inset-0 bg-black/80 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 backdrop-blur-md">
            <div className="bg-surface rounded-t-[32px] sm:rounded-[28px] p-6 w-full max-w-md shadow-deep border border-white/[0.06] max-h-[92vh] overflow-y-auto hide-scrollbar animate-slide-up sm:animate-scale-in">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-black kern-tight text-txt">프로필 수정</h3>
                    <button onClick={onClose} className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-dim"><X size={20} /></button>
                </div>
                {error && <div className="bg-coral/10 text-coral text-sm p-3 rounded-xl mb-4 text-center font-bold">{error}</div>}
                <form onSubmit={handleSave} className="space-y-4">
                    <div>
                        <label className={LABEL_CLS}>이름</label>
                        <input type="text" name="name" value={formData.name} onChange={handleChange} className={FIELD_CLS} />
                    </div>
                    <div className="flex gap-3">
                        <div className="flex-1">
                            <label className={LABEL_CLS}>급수</label>
                            <select name="level" value={formData.level} onChange={handleChange} className={FIELD_CLS}>
                                {['S조', 'A조', 'B조', 'C조', 'D조', 'E조', 'N조'].map(l => (<option key={l} value={l} className="bg-surface">{l}</option>))}
                            </select>
                        </div>
                        <div className="flex-1">
                            <label className={LABEL_CLS}>성별</label>
                            <div className="flex bg-white/5 p-1 rounded-xl">
                                {['남', '여'].map(g => (
                                    <button key={g} type="button" onClick={() => setFormData(prev => ({...prev, gender: g}))} className={`flex-1 py-2.5 rounded-lg text-sm font-black transition-all ${formData.gender === g ? 'bg-volt text-ink' : 'text-dim'}`}>{g}</button>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div>
                        <label className={LABEL_CLS}>출생년도</label>
                        <select name="birthYear" value={formData.birthYear} onChange={handleChange} className={FIELD_CLS}>
                            {birthYears.map(year => (<option key={year} value={year} className="bg-surface">{year}년생</option>))}
                        </select>
                    </div>
                    {!isKakaoUser && (
                        <div className="pt-4 border-t border-white/[0.06]">
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-[11px] font-black label text-dim">비밀번호 변경</label>
                                <button type="button" onClick={() => setShowPassword(!showPassword)} className="text-xs text-dim hover:text-txt font-bold">{showPassword ? '숨기기' : '보이기'}</button>
                            </div>
                            <div className="space-y-3 bg-white/[0.03] p-4 rounded-2xl border border-white/[0.06]">
                                <input type={showPassword ? "text" : "password"} name="currentPassword" placeholder="현재 비밀번호 (변경 시 필수)" value={formData.currentPassword} onChange={handleChange} className="w-full p-3 bg-card2 border border-white/10 rounded-lg focus:border-volt outline-none text-sm font-bold text-txt" />
                                <input type={showPassword ? "text" : "password"} name="newPassword" placeholder="새 비밀번호 (6자 이상)" value={formData.newPassword} onChange={handleChange} className="w-full p-3 bg-card2 border border-white/10 rounded-lg focus:border-volt outline-none text-sm font-bold text-txt" />
                                <input type={showPassword ? "text" : "password"} name="confirmPassword" placeholder="새 비밀번호 확인" value={formData.confirmPassword} onChange={handleChange} className="w-full p-3 bg-card2 border border-white/10 rounded-lg focus:border-volt outline-none text-sm font-bold text-txt" />
                            </div>
                        </div>
                    )}
                    <button type="submit" disabled={loading} className="w-full py-4 bg-volt text-ink font-black rounded-full shadow-volt disabled:bg-white/10 disabled:text-muted mt-2 label">
                        {loading ? <Loader2 className="animate-spin mx-auto"/> : '저장하기'}
                    </button>
                </form>
            </div>
        </div>
    );
}

// 최초 회원가입 프로필 설정 모달
function InitialProfileModal({ isOpen, user }) {
    const [formData, setFormData] = useState({ name: '', level: 'N조', gender: '남', birthYear: '2000', region: '서울' });
    const [loading, setLoading] = useState(false);

    const handleSave = async (e) => {
        e.preventDefault();
        if (!formData.name.trim()) return toast("이름(실명)을 입력해주세요.", 'error');
        setLoading(true);
        try {
            const now = new Date();
            if (now.getHours() < 2) now.setDate(now.getDate() - 1);
            const dateStr = now.toISOString().split('T')[0];
            await setDoc(doc(db, "users", user.uid), { ...formData, email: user.email, todayGames: 0, lastResetDate: dateStr, createdAt: serverTimestamp() });
            await updateProfile(user, { displayName: formData.name });
            toast("환영합니다! 프로필 설정 완료.");
        } catch (err) {
            console.error(err);
            toast("저장 중 오류가 발생했습니다.", 'error');
        } finally { setLoading(false); }
    };

    if (!isOpen) return null;
    const regions = ['서울', '경기', '인천', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'];

    return (
        <div className="fixed inset-0 bg-ink/95 backdrop-blur-md z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-surface rounded-t-[32px] sm:rounded-[28px] p-8 w-full max-w-md shadow-deep border border-white/[0.06] max-h-[94vh] overflow-y-auto hide-scrollbar animate-slide-up sm:animate-scale-in">
                <div className="mb-8">
                    <span className="text-[11px] font-black label text-volt">Almost There</span>
                    <h2 className="text-2xl font-black kern-tight mt-1 text-txt">선수 프로필 완성</h2>
                    <p className="text-dim font-bold text-sm mt-1">코트에 서기 전, 딱 한 걸음 남았어요.</p>
                </div>
                <form onSubmit={handleSave} className="space-y-5">
                    <div>
                        <label className={LABEL_CLS}>이름(실명) <span className="text-volt">*</span></label>
                        <input type="text" placeholder="본명을 입력해주세요" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className={FIELD_CLS} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={LABEL_CLS}>급수</label>
                            <select value={formData.level} onChange={e => setFormData({...formData, level: e.target.value})} className={FIELD_CLS}>
                                {['S조', 'A조', 'B조', 'C조', 'D조', 'E조', 'N조'].map(l => <option key={l} value={l} className="bg-surface">{l}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={LABEL_CLS}>지역</label>
                            <select value={formData.region} onChange={e => setFormData({...formData, region: e.target.value})} className={FIELD_CLS}>
                                {regions.map(r => <option key={r} value={r} className="bg-surface">{r}</option>)}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className={LABEL_CLS}>성별</label>
                        <div className="flex bg-white/5 p-1 rounded-xl">
                            {['남', '여'].map(g => (
                                <button key={g} type="button" onClick={() => setFormData({...formData, gender: g})} className={`flex-1 py-3 rounded-lg text-sm font-black transition-all ${formData.gender === g ? 'bg-volt text-ink' : 'text-dim'}`}>{g}</button>
                            ))}
                        </div>
                    </div>
                    <button type="submit" disabled={loading} className="w-full py-5 bg-volt text-ink font-black rounded-full shadow-volt text-base label">
                        {loading ? "저장 중..." : "코트로 들어가기"}
                    </button>
                </form>
            </div>
        </div>
    );
}

// 코트 선택 모달
function CourtSelectionModal({ isOpen, onClose, courts, onSelect }) {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-md">
            <div className="bg-surface rounded-[28px] p-6 w-full max-w-sm shadow-deep border border-white/[0.06] animate-scale-in">
                <h3 className="text-xl font-black kern-tight text-center text-txt">코트 선택</h3>
                <p className="text-dim text-sm text-center mb-6 font-bold">경기를 시작할 코트를 선택해주세요.</p>
                <div className="space-y-3">
                    {courts.map((courtIdx) => (
                        <button key={courtIdx} onClick={() => onSelect(courtIdx)} className="w-full py-4 bg-white/5 hover:bg-volt hover:text-ink border border-white/10 hover:border-volt rounded-2xl text-lg font-black transition-all duration-200 flex justify-between items-center px-6 group text-txt">
                            <span>🏸 COURT {courtIdx + 1}</span>
                            <ChevronRightIcon className="text-muted group-hover:text-ink" />
                        </button>
                    ))}
                </div>
                <button onClick={onClose} className="mt-6 w-full py-3 text-dim font-black hover:bg-white/5 rounded-full transition-colors">취소</button>
            </div>
        </div>
    );
}

// ===================================================================================
// 게임방 상단 배너 (5장 자동 회전)
// -----------------------------------------------------------------------------------
// 예전에는 고정 이미지 한 장이었다. 경기방은 사람들이 저녁 내내 켜두는 화면이라
// 앱에서 노출 시간이 가장 긴 자리인데, 한 장짜리 그림은 몇 분 지나면 아무도 안 본다.
//
// 그래서 다섯 장을 돌린다.
//   · 노에러 상품 3장 — 실제 상품 사진·이름·가격을 쓴다. 누르면 그 상품 페이지로 간다.
//     (지어낸 카피 문구보다 "얼마짜리 뭐"가 훨씬 잘 눌린다)
//   · 홈 유도 1장 · 콕맵 유도 1장 — 경기방에만 머무는 사람을 다른 화면으로 데려간다.
//
// 배너 구성 원칙: 광고 3 + 앱 안내 2. 전부 광고로 채우면 사용자가 이 띠를 통째로
// 무시하게 되어 결국 광고 효과까지 사라진다.
// ===================================================================================
function GameBanner({ onNavigate }) {
    const [i, setI] = useState(0);

    // 배너로 쓸 상품 3개 — 신상을 최우선으로 앞에 세운다 (파트너 브랜드가 밀고 싶은 것).
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
            kind: 'nav', to: 'home',
            kicker: 'COCKSTAR', title: '오늘 뭐 살지 고민된다면',
            sub: `노에러 상품 ${PRODUCTS.length}종 · 최대 ${maxRate}%`,
            cta: '홈으로', accent: 'volt', art: HomeIcon,
        },
        {
            kind: 'nav', to: 'kokMap',
            kicker: 'KOK MAP', title: '내 주변 체육관 찾기',
            sub: '지도에서 오늘 열린 경기방 확인',
            cta: '콕맵 열기', accent: 'coral', art: KokMap,
        },
    ], [promoItems, maxRate]);

    // 6초마다 다음 장. 5장이면 한 바퀴 30초 — 경기 한 판보다 짧다.
    useEffect(() => {
        if (slides.length <= 1) return;
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
            <button onClick={handleClick} className="w-full text-left active:opacity-90 transition-opacity">
                {s.kind === 'product' ? (
                    // ── 상품 배너 — 왼쪽에 실제 상품 사진, 오른쪽에 이름·가격 ──
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
                    // ── 앱 안내 배너 — 홈 / 콕맵으로 데려간다 ──
                    <div className={`relative h-20 grain court-lines flex flex-col justify-center px-4 overflow-hidden ${s.accent === 'coral' ? 'bg-coral/[0.07]' : 'bg-volt/[0.06]'}`}>
                        <span className={`text-[9px] font-black label relative z-10 ${s.accent === 'coral' ? 'text-coral' : 'text-volt'}`}>{s.kicker}</span>
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

            {/* 진행 점 — 몇 장짜리인지 알려주고, 눌러서 바로 넘길 수도 있다 */}
            <div className="absolute bottom-1.5 right-3 flex gap-1 z-10">
                {slides.map((_, k) => (
                    <button
                        key={k}
                        onClick={(e) => { e.stopPropagation(); setI(k); }}
                        aria-label={`${k + 1}번째 배너`}
                        className={`h-1 rounded-full transition-all ${i === k ? 'w-4 bg-volt' : 'w-1 bg-white/25'}`}
                    />
                ))}
            </div>
        </div>
    );
}

// 관리자 시뮬레이션 랩
function TestLabModal({ isOpen, onClose, onCreateBots, isAutoPlay, setIsAutoPlay }) {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4 backdrop-blur-md">
            <div className="bg-surface rounded-[28px] p-6 w-full max-w-sm shadow-deep animate-scale-in border-2 border-volt">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-black kern-tight flex items-center gap-2 text-txt">
                        <FlaskConical size={22} className="text-volt" /> 시뮬레이션 랩
                    </h3>
                    <button onClick={onClose} className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center"><X size={20} className="text-dim" /></button>
                </div>
                <div className="space-y-6">
                    <div className="bg-white/[0.03] p-4 rounded-2xl border border-white/[0.06]">
                        <h4 className="font-black text-sm text-dim mb-3">🤖 가상 선수(Bot) 투입</h4>
                        <div className="grid grid-cols-2 gap-2">
                            <button onClick={() => onCreateBots(4, '남')} className="py-3 bg-card2 border border-white/10 rounded-xl text-sm font-black hover:border-blue-500 hover:text-blue-400 transition-colors text-txt">남성 4명 추가</button>
                            <button onClick={() => onCreateBots(4, '여')} className="py-3 bg-card2 border border-white/10 rounded-xl text-sm font-black hover:border-pink-500 hover:text-pink-400 transition-colors text-txt">여성 4명 추가</button>
                        </div>
                        <p className="text-xs text-muted mt-2 text-center font-medium">* 대기 명단으로 즉시 투입됩니다.</p>
                    </div>
                    <div className="bg-white/[0.03] p-4 rounded-2xl border border-white/[0.06]">
                        <h4 className="font-black text-sm text-dim mb-3">⚡ 자동 매칭 시뮬레이션</h4>
                        <button onClick={() => setIsAutoPlay(!isAutoPlay)} className={`w-full py-4 rounded-full text-lg font-black transition-all flex items-center justify-center gap-2 ${isAutoPlay ? 'bg-coral text-ink' : 'bg-volt text-ink shadow-volt'}`}>
                            {isAutoPlay ? (<><Loader2 className="animate-spin" /> 시뮬레이션 중지</>) : "자동 테스트 시작"}
                        </button>
                        <p className="text-xs text-muted mt-2 text-center font-medium">{isAutoPlay ? "봇들이 자동으로 경기를 진행하고 종료합니다." : "버튼을 누르면 봇들이 스스로 움직입니다."}</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ===================================================================================
// [자동 매칭] 대기열 섹션
// -----------------------------------------------------------------------------------
// '경기 배정(수동)' 섹션과 나란히 놓이는 두 번째 대기열이다. 둘은 정책이 다르다.
//
//              자동 매칭                      경기 배정 (기존)
//   만드는 법   버튼 → 후보 6개 중 선택        관리자가 슬롯을 눌러 손으로 채움
//   항목       항상 4명 꽉 찬 배열            null이 섞일 수 있는 4칸
//   개수       가변 (추가한 만큼)             고정 (numScheduledMatches)
//   고장났을 때  경기 통째로 해체              해당 슬롯만 비움 (관리자 의도 존중)
//
// PlayerCard·EmptySlot이 이 파일 안에 있어서 컴포넌트도 여기 뒀다.
// (별도 파일로 빼면 App.jsx ↔ 섹션 사이에 순환 import가 생긴다)
// ===================================================================================
function AutoMatchSection({
    autoMatches, players, isAdmin, currentUserId,
    inProgressPlayerIds, courtIndexByPlayer,
    onGenerate, generatingGender,
    onStart, onDelete, onClearAll, onRemovePlayer,
}) {
    const pressTimerRef = useRef(null);
    // 값이 배열이 아닌 항목은 아예 걸러낸다.
    // 예전 버전이 남긴 데이터나 손으로 고친 문서가 섞이면 아래 match.map 에서 화면이 통째로 죽는다.
    const matchList = Object.entries(autoMatches || {})
        .filter(([, m]) => Array.isArray(m))
        .sort((a, b) => Number(a[0]) - Number(b[0]));

    // ── 경기 번호를 800ms 길게 누르면 그 경기 삭제 ──
    const handlePressStart = (matchIndex) => {
        if (!isAdmin) return;
        if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
        pressTimerRef.current = setTimeout(() => onDelete(matchIndex), 800);
    };
    const handlePressEnd = () => {
        if (pressTimerRef.current) { clearTimeout(pressTimerRef.current); pressTimerRef.current = null; }
    };

    // ── [연출] 새로 만들어진 매칭에만 카드가 착착 꽂히는 애니메이션을 준다 ──
    // 기준을 '경기 번호'가 아니라 '선수 구성 시그니처'로 잡는 게 요령이다.
    // 번호로 기억하면 경기를 시작해 번호가 당겨질 때마다 남은 경기들이 전부
    // '새것'으로 보여서 애니메이션이 우수수 다시 재생된다.
    const dealSeenRef = useRef(new Set());
    const isFirstRenderRef = useRef(true);
    const matchSig = (match) => (match || []).filter(Boolean).join('|');
    if (isFirstRenderRef.current) {
        // 늦게 들어온 사람에게 기존 매칭이 우르르 쏟아지지 않도록 첫 렌더는 전부 '본 것'으로 처리
        matchList.forEach(([, m]) => { const s = matchSig(m); if (s) dealSeenRef.current.add(s); });
        isFirstRenderRef.current = false;
    }
    const newDealSigs = new Set(
        matchList.map(([, m]) => matchSig(m)).filter(s => s && !dealSeenRef.current.has(s))
    );
    useEffect(() => {
        matchList.forEach(([, m]) => { const s = matchSig(m); if (s) dealSeenRef.current.add(s); });
    });

    const nameOf = (id) => players[id]?.name || '나간 선수';

    return (
        <section className="space-y-3">
            <div className="flex justify-between items-center ml-1">
                <h2 className="text-xs font-black label text-dim">🤖 자동 매칭 · Auto</h2>
                {isAdmin && matchList.length > 0 && (
                    <button
                        onClick={onClearAll}
                        className="text-[11px] font-black text-coral bg-coral/10 border border-coral/30 rounded-full px-3 py-1"
                    >전체 삭제</button>
                )}
            </div>

            {/* 매칭 만들기 — 누를 때마다 후보 6개를 계산해 보여준다 */}
            {isAdmin && (
                <div className="auto-make-row">
                    {[
                        { key: '남', cls: 'male', label: '👨 남자 매칭' },
                        { key: '여', cls: 'female', label: '👩 여자 매칭' },
                        { key: '혼복', cls: 'mixed', label: '💑 혼복 매칭' },
                    ].map(b => (
                        <button
                            key={b.key}
                            type="button"
                            className={`auto-make-btn ${b.cls}`}
                            onClick={() => onGenerate(b.key)}
                            disabled={!!generatingGender}
                        >
                            {generatingGender === b.key ? '계산 중...' : b.label}
                        </button>
                    ))}
                </div>
            )}

            {matchList.length === 0 && (
                <div className="bg-card rounded-2xl p-5 border border-white/[0.06] text-center">
                    <p className="text-sm text-dim font-bold">만들어진 자동 매칭이 없습니다.</p>
                    <p className="text-xs text-muted mt-1.5 font-medium leading-relaxed">
                        {isAdmin
                            ? <>위 버튼을 누르면 후보 6개를 이유와 함께 보여줍니다.<br />마음에 드는 조합을 고르면 여기에 추가돼요.</>
                            : <>관리자가 매칭을 만들면 여기에 표시됩니다.</>}
                    </p>
                </div>
            )}

            {matchList.map(([matchIndex, match]) => {
                const ids = (match || []).filter(Boolean);

                // 이 경기를 지금 시작할 수 있는지 판단한다.
                //  · onCourt : 아직 코트에서 뛰는 중 (그 경기가 끝나야 시작 가능)
                //  · broken  : 나갔거나 휴식으로 바뀜 (자리를 채우거나 경기를 지워야 함)
                const onCourtIds = ids.filter(id => inProgressPlayerIds.has(id));
                const brokenIds = ids.filter(id => !players[id] || players[id].isResting);
                const canStart = ids.length === PLAYERS_PER_MATCH && onCourtIds.length === 0 && brokenIds.length === 0;

                const waitCourts = [...new Set(
                    onCourtIds.map(id => courtIndexByPlayer[id]).filter(i => i !== undefined)
                )].sort((a, b) => a - b);

                // 왜 아직 못 시작하는지 한 줄로 알려준다 (안 알려주면 버튼이 고장난 줄 안다)
                let note = null;
                if (brokenIds.length > 0) {
                    note = { broken: true, text: `${brokenIds.map(nameOf).join('·')} 빠짐 — 곧 자동으로 정리됩니다` };
                } else if (onCourtIds.length > 0) {
                    const courtText = waitCourts.length ? `${waitCourts.map(c => c + 1).join('·')}번 코트` : '진행 중인 경기';
                    note = { broken: false, text: `${courtText}가 끝나면 시작 — 경기중: ${onCourtIds.map(nameOf).join('·')}` };
                }

                const isNewDeal = newDealSigs.has(matchSig(match));

                return (
                    <div key={`auto-${matchIndex}`} className={`auto-row ${isNewDeal ? 'auto-deal' : ''}`}>
                        {note && (
                            <div className={`auto-wait-note ${note.broken ? 'broken' : ''}`}>
                                <span>{note.broken ? '⚠️' : '⏳'}</span>
                                <span className="truncate">{note.text}</span>
                            </div>
                        )}
                        <div className="flex items-center w-full gap-1.5">
                            <div
                                className="flex-shrink-0 w-7 text-center select-none cursor-pointer"
                                onMouseDown={() => handlePressStart(matchIndex)}
                                onMouseUp={handlePressEnd} onMouseLeave={handlePressEnd}
                                onTouchStart={() => handlePressStart(matchIndex)}
                                onTouchEnd={handlePressEnd} onTouchCancel={handlePressEnd}
                                title={isAdmin ? '길게 누르면 이 경기가 삭제됩니다' : undefined}
                            >
                                <p className="font-black text-lg text-txt tabular">{Number(matchIndex) + 1}</p>
                            </div>
                            <div className="grid grid-cols-4 gap-1.5 flex-1 min-w-0">
                                {match.map((pid, sIdx) => {
                                    if (pid && players[pid]) {
                                        return (
                                            <PlayerCard
                                                key={`${pid}-${matchIndex}-${sIdx}`}
                                                player={players[pid]}
                                                isAdmin={isAdmin}
                                                isCurrentUser={currentUserId === pid}
                                                isPlaying={inProgressPlayerIds.has(pid)}
                                                isResting={players[pid].isResting}
                                                onDeleteClick={() => onRemovePlayer(matchIndex, sIdx)}
                                            />
                                        );
                                    }
                                    return <LeftPlayerCard key={`auto-left-${matchIndex}-${sIdx}`} isAdmin={false} />;
                                })}
                            </div>
                            <div className="flex-shrink-0 w-16">
                                {isAdmin ? (
                                    <button
                                        type="button"
                                        className={`auto-start-btn ${canStart ? 'go' : (brokenIds.length > 0 ? 'fix' : 'wait')}`}
                                        disabled={!canStart}
                                        onClick={() => onStart(matchIndex)}
                                    >
                                        {brokenIds.length > 0 ? '정리중' : (onCourtIds.length > 0 ? '대기' : '경기 시작')}
                                    </button>
                                ) : (
                                    <span className="block text-center text-[10px] font-black text-muted">
                                        {canStart ? '시작 대기' : '진행 대기'}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })}
        </section>
    );
}

function GameRoomView({ roomId, user, userData, onExitRoom, roomsCollectionRef, onNavigate }) {
    const [roomData, setRoomData] = useState(null);
    const [players, setPlayers] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('matching');

    const [isAuthorized, setIsAuthorized] = useState(false);
    const [inputPassword, setInputPassword] = useState('');
    const [showShareModal, setShowShareModal] = useState(false);

    const [selectedPlayerIds, setSelectedPlayerIds] = useState([]);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isEditInfoOpen, setIsEditInfoOpen] = useState(false);
    const [editGamePlayer, setEditGamePlayer] = useState(null);
    const [courtModalOpen, setCourtModalOpen] = useState(false);
    const [pendingMatchIndex, setPendingMatchIndex] = useState(null);
    // 코트 선택 모달에서 시작할 때, 그 경기가 어느 대기열에서 왔는지 기억해 둔다
    // ('auto'와 'schedule'은 시작 후 목록을 정리하는 방식이 다르다)
    const [pendingMatchSource, setPendingMatchSource] = useState('schedule');
    const [availableCourts, setAvailableCourts] = useState([]);

    // ── [자동 매칭] ──
    const [matchOptions, setMatchOptions] = useState(null); // { gender, genderLabel, result }
    const [generatingGender, setGeneratingGender] = useState(null);
    const isGeneratingRef = useRef(false);
    const isRepairingRef = useRef(false);
    const [isGuideOpen, setIsGuideOpen] = useState(false);
    const guideTriedRef = useRef(false);

    const roomDocRef = useMemo(() => doc(db, "rooms", roomId), [roomId]);
    const playersCollectionRef = useMemo(() => collection(db, "rooms", roomId, "players"), [roomId]);

    // ★ user 가 null 일 수 있다.
    //   로그아웃 상태로 공유 링크(?roomId=...)를 열면 GamePage 가 이 화면을 흐릿하게 깔고
    //   그 위에 로그인 안내를 띄운다. 그때 user 는 null 로 들어온다.
    //   예전에는 화면 곳곳에서 user.uid 를 그냥 읽어서 그 경로가 통째로 흰 화면이었다.
    //   (공유 링크를 받은 사람은 대부분 아직 로그인 전이라 오히려 흔한 경로다)
    const myUid = user?.uid ?? null;

    const isAdmin = useMemo(() => {
        if (!roomData || !user) return false;
        if (isSuperAdmin(user) || user.uid === roomData.adminUid) return true;
        if (!roomData.admins || !Array.isArray(roomData.admins)) return false;
        const userEmail = user.email || "";
        const userId = userEmail.split('@')[0];
        return roomData.admins.some(admin => admin === userEmail || admin === user.uid || (userId && admin === userId));
    }, [user, roomData]);

    const inProgressPlayerIds = useMemo(() => new Set((roomData?.inProgressCourts || []).flatMap(c => c?.players || []).filter(Boolean)), [roomData]);
    const scheduledPlayerIds = useMemo(() => new Set(Object.values(roomData?.scheduledMatches || {}).flatMap(m => m || []).filter(Boolean)), [roomData]);
    // [자동 매칭] 자동 매칭 목록에 올라간 사람도 '대기 중'이 아니다.
    // 여기서 안 빼면 같은 사람이 대기 명단에도 보여서 두 경기에 동시 배정된다.
    const autoMatchPlayerIds = useMemo(() => new Set(Object.values(roomData?.autoMatches || {}).flatMap(m => m || []).filter(Boolean)), [roomData]);
    const waitingPlayers = useMemo(
        () => Object.values(players).filter(p =>
            !inProgressPlayerIds.has(p.id) && !scheduledPlayerIds.has(p.id) && !autoMatchPlayerIds.has(p.id)
        ),
        [players, inProgressPlayerIds, scheduledPlayerIds, autoMatchPlayerIds]
    );
    const maleWaiting = useMemo(() => waitingPlayers.filter(p => p.gender === '남'), [waitingPlayers]);
    const femaleWaiting = useMemo(() => waitingPlayers.filter(p => p.gender !== '남'), [waitingPlayers]);

    // 선수 → 지금 뛰고 있는 코트 번호 (자동 매칭 줄에 "3번 코트가 끝나면 시작"을 적으려면 필요)
    const courtIndexByPlayer = useMemo(() => {
        const map = {};
        (roomData?.inProgressCourts || []).forEach((court, idx) => {
            (court?.players || []).forEach(pid => { if (pid) map[pid] = idx; });
        });
        return map;
    }, [roomData]);

    const handleShare = async () => {
        const shareUrl = `${window.location.origin}?roomId=${roomId}`;
        const shareData = { title: `[COCKSTAR] 경기 초대`, text: `🏸 '${roomData?.name}' 경기방에 초대합니다!`, url: shareUrl };
        if (navigator.share) {
            try { await navigator.share(shareData); }
            catch (e) { if (e.name !== 'AbortError') setShowShareModal(true); }
        } else { setShowShareModal(true); }
    };

    useEffect(() => {
        if (roomData && (!roomData.password || user?.uid === roomData.adminUid)) setIsAuthorized(true);
    }, [roomData, user]);

    useEffect(() => {
        setLoading(true);
        const unsubRoom = onSnapshot(roomDocRef, (doc) => {
            if (doc.exists()) setRoomData({ id: doc.id, ...doc.data() });
            else onExitRoom();
        });
        return () => unsubRoom();
    }, [roomDocRef]);

    // ===============================================================================
    // [이식] 👻 운영 전용 모드 (콕스라이팅의 '유령 관리자')
    // -------------------------------------------------------------------------------
    // 코치·총무처럼 '운영만 하고 경기는 안 뛰는 사람'을 위한 모드다.
    // 켜면 선수 카드가 없어져서 대기 명단·인원 수·매칭 후보에 아예 잡히지 않는다.
    // 관리자 기능은 그대로 쓴다.
    //
    // 이게 없으면 운영자가 대기 명단에 계속 남아 매칭 후보에 뽑히고, 관리자가 매번
    // 그 카드를 빼줘야 한다. 인원 수도 한 명씩 부풀어 보인다.
    //
    // 원본은 이름을 '관리자'로 입장하면 켜졌지만, 콕스타는 로그인이 있어서 그럴 필요가
    // 없다. 대신 방마다 따로 켜고 끈다 — 어떤 방에서는 뛰고 어떤 방에서는 운영만 할 수
    // 있어야 하기 때문이다. 그래서 기기에만 저장한다(방 문서를 건드리지 않는다).
    // ===============================================================================
    const ghostKey = `cockstar-ghost-admin-${roomId}`;
    // ★ localStorage를 useState 초기화 함수에서 바로 읽는다 (useEffect로 나중에 읽으면 안 된다).
    //   effect로 읽으면 첫 렌더에서 잠깐 false가 되는데, 그 사이에 방 정보가 캐시에서
    //   즉시 올라오면 아래 입장 처리가 먼저 돌아 선수 문서를 만들어 버린다.
    //   운영 전용 모드로 들어왔는데 매번 선수 카드가 한 번씩 생겼다 사라지게 된다.
    const [isGhost, setIsGhost] = useState(() => {
        try { return localStorage.getItem(ghostKey) === '1'; }
        catch { return false; }
    });

    // 관리자가 아니면 이 모드는 무시한다 —
    // 일반 회원이 켜면 자기만 현황판에서 사라져서 매칭에 영영 안 들어간다.
    const ghostActive = isGhost && isAdmin;

    useEffect(() => {
        if (!user || !userData || !roomData || loading) return;
        // 운영 전용 모드면 선수 문서를 만들지 않는다
        if (ghostActive) return;
        const playerRef = doc(db, "rooms", roomId, "players", user.uid);
        const syncJoin = async () => {
            try {
                await runTransaction(db, async (transaction) => {
                    const playerSnap = await transaction.get(playerRef);
                    if (!playerSnap.exists()) {
                        transaction.set(playerRef, {
                            name: userData.name || '선수', level: userData.level || 'N조', gender: userData.gender || '남',
                            birthYear: userData.birthYear || '', region: userData.region || '미설정', entryTime: serverTimestamp(),
                            todayGames: userData.todayGames || 0, isResting: false, role: 'player'
                        });
                    } else {
                        transaction.update(playerRef, { name: userData.name, level: userData.level });
                    }
                });
            } catch (e) { console.error("입장 실패:", e); }
        };
        syncJoin();
    }, [user?.uid, !!userData, !!roomData, loading, roomId, ghostActive]);

    /**
     * 운영 전용 모드 켜고 끄기.
     * 켤 때는 선수 문서를 지운다 — 그래야 대기 명단과 인원 수에서 사라진다.
     * 끄면 위 syncJoin이 다시 돌아 선수 카드를 만들어 준다.
     */
    const handleToggleGhost = async () => {
        if (!user) return;
        const next = !isGhost;
        if (next && inProgressPlayerIds.has(user.uid)) {
            toast("경기 중에는 운영 모드로 바꿀 수 없습니다. 경기가 끝난 뒤 눌러주세요.", 'error');
            return;
        }
        try { localStorage.setItem(ghostKey, next ? '1' : '0'); } catch { /* 저장 실패는 무시 */ }
        setIsGhost(next);
        if (!next) return;
        try {
            // 잡혀 있던 다음 경기에서 먼저 빼낸 뒤 선수 문서를 지운다.
            // (순서가 반대면 대기열에 '나간 선수' 자리가 잠깐 남는다)
            await runTransaction(db, async (t) => {
                const snap = await t.get(roomDocRef);
                if (!snap.exists()) return;
                const data = snap.data();
                const rest = { ...players };
                delete rest[user.uid];
                const { changed, newState } = repairMatchQueues(
                    { autoMatches: data.autoMatches || {}, scheduledMatches: data.scheduledMatches || {} },
                    rest
                );
                if (!changed) return;
                t.update(roomDocRef, { autoMatches: newState.autoMatches, scheduledMatches: newState.scheduledMatches });
            });
            await deleteDoc(doc(playersCollectionRef, user.uid));
            toast("운영 전용 모드로 바꿨습니다. 선수 명단에서 빠집니다.");
        } catch (e) {
            console.error("운영 모드 전환 실패:", e);
            toast("모드 전환에 실패했습니다.", 'error');
        }
    };

    // ===============================================================================
    // [이식] 하루 초기화 — 리더 선출로 한 번만 실행
    // -------------------------------------------------------------------------------
    // 예전에는 관리자 화면이 "날짜가 다르네?" 하면 곧바로 초기화를 실행했다.
    // 관리자가 두 명 이상 접속해 있으면 둘 다 실행해서 초기화가 겹칠 수 있었다.
    //
    // 이제는 트랜잭션 안에서 운영일 키를 먼저 선점하고(= 리더 선출),
    // 이긴 기기 하나만 선수 기록을 지운다. 진 기기는 조용히 아무것도 안 한다.
    //
    // ⚠️ 남은 한계 — 기기 시계를 완전히 믿지는 못한다.
    //    원본(콕스라이팅)은 서버 시각을 따로 읽어와 한 번 더 확인하지만, 그러려면
    //    전용 문서가 필요하고 이 앱의 보안 규칙에서 그 문서가 허용되는지 확인할 수
    //    없어서 넣지 않았다. 대신 두 가지 방어를 뒀다.
    //      ① 키는 앞으로만 간다 (>= 이면 중단) — 시계가 틀린 기기가 어제 날짜로
    //         되돌려 초기화를 반복시키는 '핑퐁'을 막는다.
    //      ② 기기 시각이 마지막 초기화 서버 시각보다 과거면 시계가 틀린 것이므로 중단.
    //    시계가 '미래'로 크게 어긋난 기기 하나는 여전히 하루를 앞당길 수 있다.
    //    (그 경우 다음 날 실제 날짜가 따라잡을 때까지 초기화가 한 번 건너뛰어진다)
    // ===============================================================================
    const dailyResetInFlightRef = useRef(false);

    const runDailyResetIfDue = async (playersArray) => {
        if (dailyResetInFlightRef.current) return;
        const todayKey = getDailyResetKey();

        // 화면 데이터로 싸게 확인 — 이미 오늘 돌았으면 트랜잭션을 열지도 않는다
        const storedKey = roomData.lastDailyResetKey || roomData.lastResetDate;
        if (storedKey && storedKey >= todayKey) return;

        dailyResetInFlightRef.current = true;
        try {
            const won = await runTransaction(db, async (t) => {
                const snap = await t.get(roomDocRef);
                if (!snap.exists()) return false;
                const data = snap.data();

                const key = data.lastDailyResetKey || data.lastResetDate;
                if (key && key >= todayKey) return false; // 다른 기기가 이미 선점했다

                // 기기 시계가 마지막 초기화(서버 시각)보다 과거면 시계가 틀린 것이다
                const lastAt = data.lastDailyResetAt;
                if (lastAt?.toDate && Date.now() < lastAt.toDate().getTime()) {
                    console.warn('기기 시계가 서버보다 과거입니다 — 하루 초기화를 건너뜁니다.');
                    return false;
                }

                // 이긴 기기가 같은 쓰기에서 방(코트·대기열)까지 비운다
                t.update(roomDocRef, {
                    lastDailyResetKey: todayKey,
                    lastResetDate: todayKey,   // 예전 필드도 같이 맞춰 둔다 (구버전 호환)
                    lastDailyResetAt: serverTimestamp(),
                    inProgressCourts: Array(data.numInProgressCourts || 2).fill(null),
                    scheduledMatches: {},
                    autoMatches: {},
                });
                return true;
            });

            if (!won) return;

            // 이긴 기기만 선수 기록을 지운다. Firestore 배치 한계는 500이라 400씩 끊는다.
            //
            // ⚠️ 배치 하나가 실패해도 나머지는 계속 진행해야 한다.
            //   batch.update 는 대상 문서가 없으면 배치 전체를 실패시키는데, 스냅샷을 찍은
            //   직후 누가 방을 나가면 그 일이 실제로 일어난다. 위에서 운영일 키는 이미
            //   선점한 뒤라, 여기서 통째로 중단되면 '방은 비워졌는데 선수 기록은 어제 그대로'인
            //   상태가 되고 오늘은 다시 초기화되지 않는다.
            for (let i = 0; i < playersArray.length; i += 400) {
                const batch = writeBatch(db);
                playersArray.slice(i, i + 400).forEach(p => {
                    batch.update(doc(playersCollectionRef, p.id), {
                        todayGames: 0,
                        matchHistory: [],
                        todayRecentGames: [],   // [자동 매칭] 구조체 기록도 함께 초기화
                        isResting: false,
                    });
                });
                try {
                    await batch.commit();
                } catch (e) {
                    console.error(`일일 초기화 배치 실패 (${i}~${i + 400}) — 나머지는 계속합니다:`, e);
                }
            }
        } catch (e) {
            console.error("일일 데이터 초기화 실패:", e);
        } finally {
            dailyResetInFlightRef.current = false;
        }
    };

    useEffect(() => {
        const unsubPlayers = onSnapshot(playersCollectionRef, (snapshot) => {
            const playersArray = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            // 초기화는 뒤에서 돌게 두고 화면부터 그린다.
            // await 로 기다리면 배치 커밋이 끝날 때까지(수백 명이면 몇 초) 대기 명단이 안 뜬다.
            if (isAdmin && roomData) { runDailyResetIfDue(playersArray); }
            playersArray.sort((a, b) => (a.entryTime?.seconds || 0) - (b.entryTime?.seconds || 0));
            setPlayers(playersArray.reduce((acc, p) => ({ ...acc, [p.id]: p }), {}));
            setLoading(false);
        });
        return () => unsubPlayers();
    }, [playersCollectionRef, isAdmin, !!roomData, roomDocRef]);

    const [isTestLabOpen, setIsTestLabOpen] = useState(false);
    const [isAutoPlay, setIsAutoPlay] = useState(false);

    useEffect(() => {
        if (!isAutoPlay || !isAdmin || !roomData) return;
        const simulationInterval = setInterval(() => {
            const emptyCourts = [];
            (roomData.inProgressCourts || []).forEach((c, i) => { if(!c) emptyCourts.push(i); });
            const occupiedCourts = [];
            (roomData.inProgressCourts || []).forEach((c, i) => { if(c) occupiedCourts.push(i); });
            if (occupiedCourts.length > 0 && Math.random() < 0.3) {
                const targetCourt = occupiedCourts[Math.floor(Math.random() * occupiedCourts.length)];
                handleEndMatch(targetCourt);
                return;
            }
            const fullMatches = [];
            Object.entries(roomData.scheduledMatches || {}).forEach(([mIdx, players]) => {
                if (players && players.filter(Boolean).length === 4) fullMatches.push(parseInt(mIdx));
            });
            if (fullMatches.length > 0 && emptyCourts.length > 0 && Math.random() < 0.5) {
                processStartMatch(fullMatches[0], emptyCourts[0]);
                return;
            }
            if (waitingPlayers.length > 0) {
                let targetMatchIdx = -1;
                let targetSlotIdx = -1;
                for (let m = 0; m < roomData.numScheduledMatches; m++) {
                    const match = roomData.scheduledMatches?.[m] || [null,null,null,null];
                    const emptyIdx = match.indexOf(null);
                    if (emptyIdx !== -1 && match.length >= 4) { targetMatchIdx = m; targetSlotIdx = emptyIdx; break; }
                    else if (match.length < 4) { targetMatchIdx = m; targetSlotIdx = match.length; break; }
                }
                if (targetMatchIdx !== -1 && targetSlotIdx !== -1) {
                    handleSwapPlayers([waitingPlayers[0].id], null, targetMatchIdx, targetSlotIdx);
                }
            }
        }, 500);
        return () => clearInterval(simulationInterval);
    }, [isAutoPlay, roomData, waitingPlayers, isAdmin]);

    // ===============================================================================
    // [자동 매칭] 시작할 수 없게 된 예약 경기 자동 정리
    // -------------------------------------------------------------------------------
    // 예약해 둔 경기의 선수가 방을 나가거나 휴식으로 바뀌면 그 경기는 영원히 시작할 수
    // 없다. 그런데 그 사람들은 여전히 '다음 경기가 잡힌 사람'으로 분류되어 새 매칭
    // 후보에서도 빠지기 때문에, 그대로 두면 매칭이 통째로 멈춰버린다.
    // (콕스라이팅 시뮬레이션에서 2시간 32경기 나올 상황이 10경기로 폭락했다)
    //
    // 그래서 관리자 화면이 이걸 감지하면 스스로 정리한다. 아무도 안 눌러도 풀린다.
    //
    // ⚠️ 관리자가 한 명도 접속해 있지 않으면 정리되지 않는다. (원본과 같은 한계)
    //    관리자만 방 문서를 쓸 수 있게 하려는 의도이므로 그대로 뒀다.
    // ===============================================================================
    useEffect(() => {
        if (!isAdmin || !roomData || isRepairingRef.current) return;
        // 선수 스냅샷이 아직 안 온 상태에서 돌리면 '전원 나간 것'으로 오인해 목록을 전부 지운다
        if (Object.keys(players).length === 0) return;

        const queueOf = (src) => ({
            autoMatches: src.autoMatches || {},
            scheduledMatches: src.scheduledMatches || {},
        });

        // 먼저 화면 데이터로 싸게 확인하고, 고칠 게 있을 때만 트랜잭션을 연다
        if (!repairMatchQueues(queueOf(roomData), players).changed) return;

        isRepairingRef.current = true;
        runTransaction(db, async (t) => {
            const snap = await t.get(roomDocRef);
            if (!snap.exists()) return;
            // 트랜잭션 안에서 최신 상태로 한 번 더 계산한다 (여러 관리자가 동시에 있어도 수렴한다)
            const { changed, newState } = repairMatchQueues(queueOf(snap.data()), players);
            if (!changed) return;
            t.update(roomDocRef, {
                autoMatches: newState.autoMatches,
                scheduledMatches: newState.scheduledMatches,
            });
        })
            .catch(e => console.error('예약 경기 자동 정리 실패:', e))
            .finally(() => { isRepairingRef.current = false; });
    }, [isAdmin, roomData, players, roomDocRef]);

    // ===============================================================================
    // [자동 매칭] 관리자 게임형 안내
    // -------------------------------------------------------------------------------
    // 기록은 users/{uid}.tutorialSeen(권위) + localStorage(오프라인 대비) 두 곳에 남기고,
    // 읽을 때는 둘을 합쳐서 본다. 한쪽만 보면 기기를 바꿨을 때 또 뜨거나,
    // 반대로 Firestore 쓰기가 실패했는데 안 뜨는 일이 생긴다.
    // ===============================================================================
    const guideLocalKey = user ? `cockstar-tutorial-seen-${user.uid}` : null;
    const hasSeenGuide = useMemo(() => {
        if (userData?.tutorialSeen?.[AUTOMATCH_GUIDE_KEY]) return true;
        if (!guideLocalKey) return false;
        try {
            const raw = JSON.parse(localStorage.getItem(guideLocalKey) || '{}');
            return !!raw[AUTOMATCH_GUIDE_KEY];
        } catch { return false; }
    }, [userData, guideLocalKey]);

    useEffect(() => {
        if (loading || !isAdmin || hasSeenGuide) return;
        if (isGuideOpen || guideTriedRef.current) return;
        // 다른 창이 떠 있으면 기다린다 (겹쳐 뜨면 둘 다 못 쓴다)
        if (isSettingsOpen || isEditInfoOpen || courtModalOpen || showShareModal) return;
        const t = setTimeout(() => { guideTriedRef.current = true; setIsGuideOpen(true); }, 600);
        return () => clearTimeout(t);
    }, [loading, isAdmin, hasSeenGuide, isGuideOpen, isSettingsOpen, isEditInfoOpen, courtModalOpen, showShareModal]);

    /**
     * 안내를 끝까지 본 경우에만 '봤음'으로 기록한다.
     * 중간에 닫으면(나중에 할게요) 기록하지 않아 다음 접속 때 다시 뜬다.
     * — 스킵해도 기록하는 보통 튜토리얼과 정반대다. 꼭 봐야 하는 내용이라 일부러 이렇게 했다.
     */
    const markGuideSeen = async () => {
        setIsGuideOpen(false);
        const stamp = new Date().toISOString();
        if (guideLocalKey) {
            try {
                const raw = JSON.parse(localStorage.getItem(guideLocalKey) || '{}');
                localStorage.setItem(guideLocalKey, JSON.stringify({ ...raw, [AUTOMATCH_GUIDE_KEY]: stamp }));
            } catch { /* 사파리 프라이빗 모드 등 — 로컬 저장 실패는 무시한다 */ }
        }
        if (!user) return;
        try {
            await setDoc(doc(db, "users", user.uid), { tutorialSeen: { [AUTOMATCH_GUIDE_KEY]: stamp } }, { merge: true });
        } catch (e) {
            // 로컬에는 남았으므로 이 기기에서는 다시 안 뜬다. 조용히 넘어간다.
            console.error('안내 시청 기록 실패:', e);
        }
    };

    if (loading) return <LoadingSpinner text="ENTERING" />;

    if (roomData?.password && !isAuthorized) {
        return (
            <div className="flex flex-col items-center justify-center h-full bg-ink p-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-volt flex items-center justify-center mb-4">
                    <Lock size={28} className="text-ink" />
                </div>
                <h2 className="text-xl font-black kern-tight mb-4 text-txt">비밀번호가 있는 방입니다</h2>
                <input type="password" value={inputPassword} onChange={(e) => setInputPassword(e.target.value)} className="w-full max-w-xs p-4 bg-card2 border border-white/10 focus:border-volt outline-none rounded-2xl mb-4 text-center font-bold text-txt" />
                <button onClick={() => inputPassword === roomData.password ? setIsAuthorized(true) : toast('비밀번호가 틀렸습니다.', 'error')} className="w-full max-w-xs py-4 bg-volt text-ink font-black rounded-full shadow-volt">입장하기</button>
            </div>
        );
    }

    const handleToggleRest = async () => {
        if (!user || !players[user.uid]) return;
        const goingToRest = !players[user.uid].isResting;
        try {
            const playerRef = doc(playersCollectionRef, user.uid);
            await updateDoc(playerRef, { isResting: goingToRest });

            // [자동 매칭] 휴식을 켤 때는 잡혀 있던 다음 경기에서 먼저 빼낸다.
            // 안 빼면 그 경기는 영원히 시작 못 하는 상태로 목록에 남고, 본인은 계속
            // '다음 경기가 잡힌 사람'으로 분류되어 새 매칭 후보에서도 빠진다.
            // (관리자 화면의 자동 정리가 결국 치워주지만, 관리자가 없을 수도 있으므로
            //  본인이 누른 이 순간에 스스로 정리하는 게 확실하다)
            //
            // 지금 코트에서 뛰는 중이라면 코트에서는 빼지 않는다 —
            // 관리자가 경기 종료를 눌러 기록을 남길 수 있어야 하기 때문이다.
            if (!goingToRest) return;
            await runTransaction(db, async (t) => {
                const snap = await t.get(roomDocRef);
                if (!snap.exists()) return;
                const data = snap.data();
                const { changed, newState } = repairMatchQueues(
                    { autoMatches: data.autoMatches || {}, scheduledMatches: data.scheduledMatches || {} },
                    { ...players, [user.uid]: { ...players[user.uid], isResting: true } }
                );
                if (!changed) return;
                t.update(roomDocRef, {
                    autoMatches: newState.autoMatches,
                    scheduledMatches: newState.scheduledMatches,
                });
            });
        } catch (e) {
            console.error("휴식 상태 변경 실패:", e);
            toast("상태 변경에 실패했습니다.", 'error');
        }
    };

    const handleSwapPlayers = async (sourcePlayerIds, targetPlayerId, targetMatchIndex, targetSlotIndex) => {
        try {
            await runTransaction(db, async (t) => {
                const rd = await t.get(roomDocRef);
                if (!rd.exists()) throw "방이 존재하지 않습니다.";
                const data = rd.data();
                const schedule = { ...data.scheduledMatches };
                if (targetPlayerId) {
                    const currentTarget = schedule[targetMatchIndex]?.[targetSlotIndex];
                    if (currentTarget !== targetPlayerId) throw "대상이 이미 다른 곳으로 이동했거나 자리가 변경되었습니다. 다시 시도해주세요.";
                }
                sourcePlayerIds.forEach(srcId => {
                    Object.keys(schedule).forEach(mKey => {
                        const match = schedule[mKey] || [];
                        const idx = match.indexOf(srcId);
                        if (idx > -1) { const newMatch = [...match]; newMatch[idx] = null; schedule[mKey] = newMatch; }
                    });
                });
                let finalMatchIdx = targetMatchIndex;
                let finalSlotIdx = targetSlotIndex;
                if (targetPlayerId) {
                    Object.keys(schedule).forEach(mKey => {
                        const match = schedule[mKey] || [];
                        const idx = match.indexOf(targetPlayerId);
                        if (idx > -1) { finalMatchIdx = parseInt(mKey); finalSlotIdx = idx; }
                    });
                }
                if (finalMatchIdx !== undefined && finalSlotIdx !== undefined) {
                    const playerToMove = sourcePlayerIds[0];
                    if (!schedule[finalMatchIdx]) schedule[finalMatchIdx] = Array(PLAYERS_PER_MATCH).fill(null);
                    if (!targetPlayerId && schedule[finalMatchIdx][finalSlotIdx] !== null) throw "이미 다른 관리자가 해당 자리에 선수를 배치했습니다.";
                    schedule[finalMatchIdx][finalSlotIdx] = playerToMove;
                }
                t.update(roomDocRef, { scheduledMatches: schedule });
            });
            setSelectedPlayerIds([]);
        } catch (e) {
            console.error("Transaction failed: ", e);
            toast(typeof e === 'string' ? e : "작업 중 오류가 발생했습니다. (데이터 충돌)", 'error');
        }
    };

    const handleCardClick = (player) => {
        if (!isAdmin) return;
        if (selectedPlayerIds.includes(player.id)) { setSelectedPlayerIds(prev => prev.filter(id => id !== player.id)); return; }
        const isInGame = Object.values(roomData.scheduledMatches || {}).some(match => match && match.includes(player.id));
        if (selectedPlayerIds.length > 0 && isInGame) {
            if (selectedPlayerIds.length === 1) {
                let tMatchIdx = null;
                let tSlotIdx = null;
                Object.keys(roomData.scheduledMatches || {}).forEach(mKey => {
                    const idx = (roomData.scheduledMatches[mKey] || []).indexOf(player.id);
                    if (idx > -1) { tMatchIdx = parseInt(mKey); tSlotIdx = idx; }
                });
                handleSwapPlayers(selectedPlayerIds, player.id, tMatchIdx, tSlotIdx);
                return;
            } else {
                toast("선수 교체(스왑)는 1명만 선택된 상태에서 가능합니다.", 'error');
                return;
            }
        }
        setSelectedPlayerIds(prev => [...prev, player.id]);
    };

    const handleSlotClick = async (matchIndex, slotIndex) => {
        if (!isAdmin) return;
        if (selectedPlayerIds.length === 0) return;
        try {
            await runTransaction(db, async (t) => {
                const rd = await t.get(roomDocRef);
                if (!rd.exists()) throw "방 정보가 없습니다.";
                const data = rd.data();
                const schedule = { ...data.scheduledMatches };
                if (!schedule[matchIndex]) schedule[matchIndex] = Array(PLAYERS_PER_MATCH).fill(null);
                if (schedule[matchIndex][slotIndex] !== null) throw "방금 다른 관리자가 이 자리에 선수를 배치했습니다.";
                selectedPlayerIds.forEach(srcId => {
                    Object.keys(schedule).forEach(mKey => {
                        const match = schedule[mKey] || [];
                        const idx = match.indexOf(srcId);
                        if (idx > -1) { const newMatch = [...match]; newMatch[idx] = null; schedule[mKey] = newMatch; }
                    });
                });
                let currentSlot = slotIndex;
                selectedPlayerIds.forEach(srcId => {
                    while (currentSlot < PLAYERS_PER_MATCH && schedule[matchIndex][currentSlot] !== null) currentSlot++;
                    if (currentSlot < PLAYERS_PER_MATCH) { schedule[matchIndex][currentSlot] = srcId; currentSlot++; }
                });
                t.update(roomDocRef, { scheduledMatches: schedule });
            });
            setSelectedPlayerIds([]);
        } catch (e) {
            console.error("Transaction failed: ", e);
            toast(typeof e === 'string' ? e : "동시 작업 충돌이 발생했습니다. 다시 시도해주세요.", 'error');
        }
    };

    const handleRemoveFromSchedule = async (matchIndex, slotIndex) => {
        if (!isAdmin) return;
        try {
            await runTransaction(db, async (t) => {
                const rd = await t.get(roomDocRef);
                if (!rd.exists()) return;
                const data = rd.data();
                const schedule = { ...data.scheduledMatches };
                if (schedule[matchIndex]) {
                    const newMatch = [...schedule[matchIndex]];
                    if (newMatch[slotIndex] === null) return;
                    newMatch[slotIndex] = null;
                    schedule[matchIndex] = newMatch;
                    t.update(roomDocRef, { scheduledMatches: schedule });
                }
            });
        } catch (e) { console.error("선수 제거 실패:", e); }
    };

    const handleKickPlayer = async (player) => {
        if (!window.confirm(`'${player.name}'님을 내보내시겠습니까?`)) return;
        try {
            await deleteDoc(doc(playersCollectionRef, player.id));
            setSelectedPlayerIds(prev => prev.filter(id => id !== player.id));
        } catch (e) { console.error(e); toast("삭제 실패", 'error'); }
    };

    const handleSettingsSave = async (newSettings) => {
        try {
            let newCourts = [...(roomData.inProgressCourts || [])];
            if (newSettings.numInProgressCourts > newCourts.length) {
                while (newCourts.length < newSettings.numInProgressCourts) newCourts.push(null);
            } else {
                newCourts = newCourts.slice(0, newSettings.numInProgressCourts);
            }
            await updateDoc(roomDocRef, {
                mode: newSettings.mode, numScheduledMatches: newSettings.numScheduledMatches,
                numInProgressCourts: newSettings.numInProgressCourts, inProgressCourts: newCourts,
                // [자동 매칭] 민감도는 방마다 다르게 둘 수 있다 (동호회마다 운영 성향이 다르므로)
                autoMatchConfig: newSettings.autoMatchConfig,
            });
            toast("설정이 저장되었습니다.");
        } catch (e) { toast("설정 저장 실패: " + e.message, 'error'); }
    };

    const handleRoomInfoSave = async (updatedData) => {
        try {
            await updateDoc(roomDocRef, {
                name: updatedData.name, location: updatedData.location, address: updatedData.address, coords: updatedData.coords,
                description: updatedData.description, maxPlayers: parseInt(updatedData.maxPlayers), levelLimit: updatedData.levelLimit,
                password: updatedData.password, admins: updatedData.admins
            });
            toast("방 정보가 수정되었습니다.");
        } catch (e) { console.error(e); toast("수정 실패: " + e.message, 'error'); }
    };

    const handleRoomDelete = async () => {
        if (!confirm("정말로 이 방을 삭제하시겠습니까? 되돌릴 수 없습니다.")) return;
        try {
            await deleteDoc(roomDocRef);
            toast("방이 삭제되었습니다.");
            onExitRoom();
        } catch (e) { toast("삭제 실패: " + e.message, 'error'); }
    };

    const handleSystemReset = async () => {
        if(!window.confirm("모든 경기 기록을 초기화하시겠습니까? (선수 목록은 유지)")) return;
        await updateDoc(roomDocRef, {
            scheduledMatches: {},
            autoMatches: {},
            inProgressCourts: Array(roomData.numInProgressCourts).fill(null),
        });
        toast("경기 기록이 초기화되었습니다.");
    };

    const handleKickAll = async () => {
        if(!window.confirm("방에 있는 모든 선수를 내보내시겠습니까?")) return;
        const batch = writeBatch(db);
        Object.keys(players).forEach(pid => { batch.delete(doc(playersCollectionRef, pid)); });
        const emptyCourts = Array(roomData.numInProgressCourts).fill(null);
        await batch.commit();
        await updateDoc(roomDocRef, { inProgressCourts: emptyCourts, scheduledMatches: {}, autoMatches: {} });
    };

    const handleSaveGames = async (playerId, newCount) => {
        try {
            const roomPlayerRef = doc(playersCollectionRef, playerId);
            const player = players[playerId];
            const count = Math.max(0, Math.floor(newCount || 0));

            // [자동 매칭] 구조체 기록도 함께 맞춘다.
            // 안 맞추면 카드에는 5G인데 엔진은 3경기로 계산하는 상태가 되어,
            // 그 사람이 계속 '덜 친 사람'으로 우선 배정된다.
            //
            // 늘릴 때는 isManual 표시가 붙은 빈 기록을 넣는다 — 엔진은 이걸 경기 수에는
            // 세지만 '누구와 만났나'에는 넣지 않는다. 없는 만남을 지어내지 않으려는 것이다.
            // 줄일 때는 최신 기록부터 뺀다 (방금 잘못 누른 걸 되돌리는 경우가 대부분이므로).
            const history = Array.isArray(player?.todayRecentGames) ? [...player.todayRecentGames] : [];
            const diff = count - history.length;
            let nextHistory = history;
            if (diff > 0) {
                const stamp = new Date().toISOString();
                nextHistory = [
                    ...Array.from({ length: diff }, () => ({ timestamp: stamp, partners: [], opponents: [], isManual: true })),
                    ...history,
                ].slice(0, 20);
            } else if (diff < 0) {
                nextHistory = history.slice(-diff);
            }

            await updateDoc(roomPlayerRef, { todayGames: count, todayRecentGames: nextHistory });
            toast("경기 수가 저장되었습니다.");
            setEditGamePlayer(null);
        } catch (e) { console.error("게임 수 수정 실패:", e); toast("수정 실패: " + e.message, 'error'); }
    };

    const handleCreateBots = async (count, gender) => {
        if (!isAdmin) return toast("관리자만 가능합니다.", 'error');
        try {
            const batch = writeBatch(db);
            for (let i = 0; i < count; i++) {
                const botId = `bot_${Date.now()}_${Math.floor(Math.random()*1000)}`;
                const botRef = doc(playersCollectionRef, botId);
                const randomLevel = ['A조','B조','C조','D조'][Math.floor(Math.random() * 4)];
                batch.set(botRef, { name: `Bot ${Math.floor(Math.random() * 1000)}`, level: randomLevel, gender: gender, isBot: true, entryTime: serverTimestamp(), todayGames: 0, isResting: false, matchHistory: [] });
            }
            await batch.commit();
        } catch (e) { console.error("봇 생성 실패:", e); toast("봇 생성 오류", 'error'); }
    };

    /**
     * @param {number|string} matchIndex 대기열 안의 경기 번호
     * @param {'schedule'|'auto'} source 어느 대기열에서 시작하는지
     */
    const handleStartClick = (matchIndex, source = 'schedule') => {
        if (!isAdmin) return toast("관리자만 가능합니다.", 'error');
        const emptyCourts = [];
        const currentCourts = roomData.inProgressCourts || [];
        for (let i = 0; i < roomData.numInProgressCourts; i++) { if (!currentCourts[i]) emptyCourts.push(i); }
        if (emptyCourts.length === 0) return toast("빈 코트가 없습니다.", 'error');
        if (emptyCourts.length === 1) processStartMatch(matchIndex, emptyCourts[0], source);
        else {
            setPendingMatchIndex(matchIndex);
            setPendingMatchSource(source);
            setAvailableCourts(emptyCourts);
            setCourtModalOpen(true);
        }
    };

    /**
     * 경기를 코트로 보낸다.
     *
     * 시작 후 목록을 정리하는 방식이 대기열마다 다르다.
     *  · 경기 배정(수동) : 뒤 경기를 앞으로 당긴다 (기존 동작 그대로)
     *  · 자동 매칭      : 지우고 "0","1",… 로 조밀하게 다시 번호를 매긴다
     * 결과는 같아 보이지만, 자동 매칭은 항상 4명 꽉 찬 배열이고 경기 예정은 빈 칸이
     * 섞일 수 있어서 코드가 갈린다.
     */
    const processStartMatch = async (matchIdx, courtIdx, source = 'schedule') => {
        try {
            await runTransaction(db, async (t) => {
                const rd = await t.get(roomDocRef);
                if (!rd.exists()) throw "방이 존재하지 않습니다.";
                const data = rd.data();
                const isAuto = source === 'auto';
                const queue = { ...(isAuto ? data.autoMatches : data.scheduledMatches) };
                const matchPlayers = queue[matchIdx];
                const currentCourts = [...(data.inProgressCourts || [])];

                if (currentCourts[courtIdx] !== null) throw "이미 다른 관리자가 해당 코트에서 경기를 시작했습니다.";
                if (!matchPlayers || matchPlayers.filter(Boolean).length < 4) throw "경기 인원이 변경되었거나 이미 시작된 경기입니다.";

                // [이중 시작 방지] 모달을 보는 사이 상황이 바뀔 수 있으므로 트랜잭션 안에서 다시 확인한다.
                // 이 검사가 없으면 한 사람이 두 코트에서 동시에 뛰는 상태가 만들어진다.
                const onCourtNow = new Set(currentCourts.flatMap(c => c?.players || []).filter(Boolean));
                if (matchPlayers.some(pid => pid && onCourtNow.has(pid))) {
                    throw "선택한 선수가 이미 다른 코트에서 경기 중입니다.";
                }

                currentCourts[courtIdx] = { players: matchPlayers, startTime: new Date().toISOString() };

                const remaining = Object.entries(queue)
                    .filter(([key]) => String(key) !== String(matchIdx))
                    .sort((a, b) => Number(a[0]) - Number(b[0]))
                    .map(([, value]) => value);
                const reordered = {};
                remaining.forEach((val, i) => { reordered[i] = val; });

                t.update(roomDocRef, {
                    [isAuto ? 'autoMatches' : 'scheduledMatches']: reordered,
                    inProgressCourts: currentCourts,
                });
            });
            setCourtModalOpen(false);
        } catch (e) {
            console.error("경기 시작 실패:", e);
            toast(typeof e === 'string' ? e : "작업 충돌이 발생했습니다.", 'error');
        }
    };

    const handleEndMatch = async (courtIdx) => {
        if (!isAdmin || !confirm("경기를 종료하시겠습니까?")) return;
        try {
            // ★ 반드시 트랜잭션으로, 그리고 '멱등'하게.
            //   예전에는 화면에 보이는 코트 정보로 batch 를 만들었다. 그러면 관리자 둘이
            //   거의 동시에 종료를 누를 때 둘 다 batch 를 커밋해서, 4명 모두 경기 수가
            //   2씩 오르고 같은 기록이 두 줄 쌓였다. (밤새 몰래 진행되는 종류의 데이터 손상 —
            //   다음 날 "나 3경기밖에 안 쳤는데 6경기래요"가 되어야 발견된다)
            //   이제 트랜잭션 안에서 코트를 다시 읽고, 이미 비어 있으면 조용히 끝낸다.
            //   늦게 누른 쪽은 아무 일도 하지 않는다.
            await runTransaction(db, async (t) => {
                const roomSnap = await t.get(roomDocRef);
                if (!roomSnap.exists()) return;
                const data = roomSnap.data();
                const courts = [...(data.inProgressCourts || [])];
                const court = courts[courtIdx];
                if (!court || !Array.isArray(court.players)) return; // 이미 다른 관리자가 종료했다

                // 선수 문서도 트랜잭션 안에서 읽는다 (읽기는 쓰기보다 먼저 전부 끝내야 한다)
                const ids = court.players.filter(Boolean);
                const snaps = await Promise.all(ids.map(pid => t.get(doc(playersCollectionRef, pid))));
                const docsById = {};
                snaps.forEach((snap, i) => { if (snap.exists()) docsById[ids[i]] = snap.data(); });

                // 표시용 문자열 기록 (기존 화면과의 호환)
                const matchMembersString = court.players.map(pid => {
                    const p = docsById[pid];
                    if (!p) return '퇴장한 선수';
                    const levelMark = (p.level && p.level !== '미설정') ? p.level[0] : '';
                    return `${levelMark}${p.isBot ? `[Bot]${p.name}` : p.name}`;
                }).join(', ');

                // ── [자동 매칭] 구조체 기록 ──
                // ★ timestamp 를 4명 모두에게 '똑같이' 넣는 게 핵심이다.
                //   서로 다른 timestamp 의 개수가 곧 '오늘 총 몇 경기'가 되고,
                //   같은 경기를 두 번 세지 않는 기준도 이 값이다.
                const timestamp = new Date().toISOString();
                const teamA = [court.players[0], court.players[1]].filter(Boolean);
                const teamB = [court.players[2], court.players[3]].filter(Boolean);

                ids.forEach(pid => {
                    const p = docsById[pid];
                    if (!p) return; // 경기 중에 방을 나간 사람 — 기록할 문서가 없다
                    const inA = teamA.includes(pid);
                    const structured = {
                        timestamp,
                        partners: (inA ? teamA : teamB).filter(x => x !== pid),
                        opponents: inA ? teamB : teamA,
                    };
                    const prevHistory = Array.isArray(p.matchHistory) ? p.matchHistory : [];
                    const prevStructured = Array.isArray(p.todayRecentGames) ? p.todayRecentGames : [];
                    t.update(doc(playersCollectionRef, pid), {
                        todayGames: (p.todayGames || 0) + 1,
                        matchHistory: [matchMembersString, ...prevHistory].slice(0, 10),
                        // 최신이 앞. 20개까지만 — 엔진이 보는 건 최근 몇 경기뿐이다
                        todayRecentGames: [structured, ...prevStructured].slice(0, 20),
                    });
                });

                courts[courtIdx] = null;
                t.update(roomDocRef, { inProgressCourts: courts });
            });
        } catch (e) {
            console.error("경기 종료 및 히스토리 저장 오류:", e);
            toast("경기 종료 중 오류가 발생했습니다. 다시 시도해주세요.", 'error');
        }
    };

    // ===============================================================================
    // [자동 매칭] 후보 계산 → 관리자 선택 → 목록 추가
    // -------------------------------------------------------------------------------
    // 앱이 혼자 정하지 않는다. 후보 6개를 이유와 함께 보여주고 관리자가 고른다.
    // 이미 다음 경기가 잡힌 사람은 후보에서 빠진다 (이중 배정 방지).
    // ===============================================================================

    /** 지금 상황으로 선택지를 계산한다 (모달을 처음 열 때 · '다시 계산'을 누를 때) */
    const computeMatchOptions = (gender) => {
        const isMixed = gender === '혼복';
        const config = roomData?.autoMatchConfig || {};

        // 민감도 = "경기중인 선수를 몇 명까지 미리 예약할지"
        const masterSens = config.sensitivity || 'normal';
        const perGender = !!config.perGenderSensitivity;
        const sensKey = (perGender && !isMixed)
            ? ((gender === '남' ? config.maleSensitivity : config.femaleSensitivity) || masterSens)
            : masterSens;
        const sens = getSensitivity(sensKey);

        const { allPlayers, gameState } = buildEngineInput(roomData, players);
        const ctx = buildMatchContext(allPlayers, gameState, { now: Date.now() });
        const pool = buildCandidatePool(ctx, gender);

        // 이미 '코트 끝나기를 기다리는' 예약이 목록에 몇 개나 있는지.
        // 예약이 쌓이면 목록 전체가 대기 상태가 되어 코트가 논다 — 엔진이 이번엔
        // '바로 시작 가능한 조합'을 우선하도록 알려준다.
        const pendingReservations = Object.values(roomData?.autoMatches || {})
            .filter(m => (m || []).some(id => id && inProgressPlayerIds.has(id))).length;

        return generateMatchOptions({
            pool, ctx, mode: gender, maxOnCourt: sens.maxOnCourt, pages: 3, pendingReservations,
        });
    };

    const handleGenerateMatch = async (gender) => {
        const isMixed = gender === '혼복';
        const genderLabel = isMixed ? '혼복' : (gender === '남' ? '남자' : '여자');

        if (!isAdmin || isGeneratingRef.current) return;
        if (!roomData) return toast("데이터를 불러오는 중입니다. 잠시 후 다시 눌러주세요.", 'error');

        isGeneratingRef.current = true;
        setGeneratingGender(gender);
        try {
            const result = computeMatchOptions(gender);

            // 인원이 모자라면 '무엇이 몇 명' 부족한지 정확히 알려준다
            if (result.status !== 'ok') {
                toast(isMixed
                    ? `혼복은 남자 2명, 여자 2명 이상 필요합니다. (현재 남 ${result.maleCount ?? 0} · 여 ${result.femaleCount ?? 0})`
                    : `${genderLabel} 선수가 4명 이상 필요합니다. (현재 ${result.poolSize}명)`,
                'error');
                return;
            }
            setMatchOptions({ gender, genderLabel, result });
        } catch (e) {
            console.error("자동 매칭 계산 실패:", e);
            toast("매칭 후보를 계산하지 못했습니다.", 'error');
        } finally {
            isGeneratingRef.current = false;
            setGeneratingGender(null);
        }
    };

    /** 모달에서 '다시 계산' — 지금 코트 상황으로 후보를 새로 뽑는다 */
    const handleRegenerateOptions = () => {
        if (!matchOptions) return;
        try {
            const result = computeMatchOptions(matchOptions.gender);
            if (result.status !== 'ok') {
                toast("지금은 매칭할 수 있는 선수가 부족합니다.", 'error');
                return;
            }
            setMatchOptions({ ...matchOptions, result });
        } catch (e) { console.error("다시 계산 실패:", e); }
    };

    /** 관리자가 선택지 하나를 골랐을 때 — 자동 매칭 목록 맨 뒤에 추가 */
    const handleSelectMatchOption = async (option) => {
        let failReason = null;
        try {
            await runTransaction(db, async (t) => {
                // ★ 재시도마다 초기화해야 한다.
                //   Firestore 트랜잭션은 경합이 나면 이 함수를 처음부터 다시 돌린다.
                //   첫 시도에서 "이미 예약됨"으로 표시해 뒀는데 두 번째 시도에서 성공하면,
                //   실제로는 추가됐으면서 화면에는 실패 안내가 뜨는 모순이 생긴다.
                failReason = null;
                const snap = await t.get(roomDocRef);
                if (!snap.exists()) throw "방이 존재하지 않습니다.";
                const data = snap.data();
                const autoMatches = { ...(data.autoMatches || {}) };

                // 모달을 보는 사이에 상황이 바뀌었을 수 있으므로 DB 최신 상태로 다시 확인한다.
                //  ① 다른 관리자가 같은 선수를 먼저 넣었는가 (두 대기열 모두 확인)
                const queuedIds = new Set([
                    ...Object.values(autoMatches).flat(),
                    ...Object.values(data.scheduledMatches || {}).flat(),
                ].filter(Boolean));
                if (option.ids.some(id => queuedIds.has(id))) {
                    failReason = '방금 다른 관리자가 같은 선수를 다른 경기에 넣었습니다.';
                    return;
                }
                //  ② 그 사이에 나가거나 휴식으로 바뀐 선수가 있는가
                const gone = option.ids.map(id => players[id]).find(p => !p || p.isResting);
                if (gone !== undefined) {
                    failReason = `${gone?.name || '일부'} 선수가 방금 빠졌습니다.`;
                    return;
                }

                // 새 경기 번호는 '개수'가 아니라 '최대 번호 + 1'로 정한다.
                // 삭제 후 재인덱싱이 실패해 {0, 2} 처럼 구멍 난 상태가 되어도
                // 기존 경기를 덮어쓰지 않는다. (개수로 하면 length=2 가 '2'번을 덮는다)
                const nextIdx = Object.keys(autoMatches).reduce((m, k) => Math.max(m, Number(k) + 1), 0);
                autoMatches[String(nextIdx)] = [...option.ids];
                t.update(roomDocRef, { autoMatches });
            });
        } catch (e) {
            console.error("자동 매칭 추가 실패:", e);
            failReason = typeof e === 'string' ? e : '목록에 추가하지 못했습니다.';
        }

        setMatchOptions(null);
        if (failReason) {
            toast(`${failReason} 매칭 버튼을 한 번 더 눌러주세요.`, 'error');
        }
    };

    const handleDeleteAutoMatch = async (matchIndex) => {
        if (!isAdmin) return;
        if (!window.confirm(`${Number(matchIndex) + 1}번 자동 매칭을 삭제할까요?`)) return;
        try {
            await runTransaction(db, async (t) => {
                const snap = await t.get(roomDocRef);
                if (!snap.exists()) return;
                const remaining = Object.entries(snap.data().autoMatches || {})
                    .filter(([key]) => String(key) !== String(matchIndex))
                    .sort((a, b) => Number(a[0]) - Number(b[0]))
                    .map(([, v]) => v);
                const reindexed = {};
                remaining.forEach((m, i) => { reindexed[i] = m; });
                t.update(roomDocRef, { autoMatches: reindexed });
            });
        } catch (e) { console.error("자동 매칭 삭제 실패:", e); toast("삭제 실패", 'error'); }
    };

    const handleClearAutoMatches = async () => {
        if (!isAdmin) return;
        if (!window.confirm("자동 매칭 목록을 모두 삭제할까요?")) return;
        try { await updateDoc(roomDocRef, { autoMatches: {} }); }
        catch (e) { console.error(e); toast("삭제 실패", 'error'); }
    };

    /** 자동 매칭 경기에서 한 명만 빼기 → 그 경기는 4명이 아니게 되므로 통째로 해체한다 */
    const handleRemoveFromAutoMatch = (matchIndex) => {
        handleDeleteAutoMatch(matchIndex);
    };

    if (loading) return <LoadingSpinner text="ENTERING" />;
    if (error) return <div className="p-10 text-center text-dim">{error}</div>;

    return (
        <div className="flex flex-col h-full bg-ink">
            {/* 헤더 */}
            <header className="flex-shrink-0 h-16 px-3 flex items-center justify-between bg-surface sticky top-0 z-30 border-b border-white/[0.06]">
                <div className="flex items-center gap-2 overflow-hidden flex-1 mr-2">
                    <button onClick={() => { if (confirm("방을 나가시겠습니까?")) onExitRoom(); }} className="p-2 -ml-1 text-dim hover:text-txt transition-colors">
                        <ArrowLeft size={22}/>
                    </button>
                    <div className="flex flex-col overflow-hidden justify-center">
                        <div className="flex items-center gap-1.5">
                            <h1 className="text-base font-black text-txt truncate leading-tight kern-tight">{roomData?.name}</h1>
                            {isAdmin && (
                                <button onClick={() => setIsEditInfoOpen(true)} className="text-muted hover:text-volt p-0.5"><Edit3 size={14} /></button>
                            )}
                        </div>
                        <div className="flex items-center text-[11px] text-dim font-bold leading-none mt-1 space-x-1.5 truncate">
                            <span className="truncate max-w-[90px]">{roomData?.location}</span>
                            <span className="w-1 h-1 bg-muted rounded-full"></span>
                            <span className="flex items-center gap-1 text-dim"><Users size={12} />{roomData?.playerCount || 0}/{roomData?.maxPlayers}</span>
                            <span className="w-1 h-1 bg-muted rounded-full"></span>
                            <span className={isAdmin ? "text-volt font-black" : "text-dim"}>{isAdmin ? 'ADMIN' : 'PLAYER'}</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button onClick={handleShare} className="w-9 h-9 flex items-center justify-center rounded-full text-dim hover:text-volt hover:bg-white/5 transition-all" title="경기방 공유">
                        <Share2 size={19} />
                    </button>
                    {/* 운영 전용 모드에서는 선수 카드 자체가 없으므로 휴식 버튼이 의미가 없다.
                        대신 지금 어떤 모드인지 보여준다 (설정에서 되돌릴 수 있다) */}
                    {ghostActive ? (
                        <span className="h-9 px-3.5 rounded-full text-xs font-black flex items-center justify-center bg-white/10 text-dim" title="선수 명단에 잡히지 않습니다 — 설정에서 되돌릴 수 있어요">
                            👻 운영중
                        </span>
                    ) : (
                        <button onClick={handleToggleRest} className={`h-9 px-3.5 rounded-full text-xs font-black transition-all flex items-center justify-center ${players[myUid]?.isResting ? 'bg-white/10 text-dim' : 'bg-volt text-ink'}`}>
                            {players[myUid]?.isResting ? '복귀' : '휴식'}
                        </button>
                    )}
                    {isAdmin && (
                        <div className="flex gap-1">
                            <button onClick={() => setIsTestLabOpen(true)} className={`w-9 h-9 flex items-center justify-center rounded-full transition-all ${isAutoPlay ? 'bg-coral/20 text-coral animate-pulse' : 'text-dim hover:text-volt hover:bg-white/5'}`} title="시뮬레이션 랩">
                                <FlaskConical size={19} />
                            </button>
                            <button onClick={() => setIsSettingsOpen(true)} className="w-9 h-9 flex items-center justify-center rounded-full text-dim hover:text-txt hover:bg-white/5 transition-all">
                                <GripVertical size={19} />
                            </button>
                        </div>
                    )}
                </div>
            </header>

            <GameBanner onNavigate={onNavigate} />

            <div className="flex bg-surface px-2 border-b border-white/[0.06]">
                {[{ key: 'matching', label: '매칭 대기' }, { key: 'inProgress', label: '경기 진행' }].map(tab => (
                    <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`flex-1 py-3 text-sm font-black border-b-2 transition-colors label ${activeTab === tab.key ? 'border-volt text-volt' : 'border-transparent text-muted'}`}>
                        {tab.label}
                    </button>
                ))}
            </div>

            <main className="flex-grow overflow-y-auto p-4 space-y-6 pb-24 hide-scrollbar">
                {activeTab === 'matching' ? (
                    <>
                        <section className="bg-card rounded-2xl p-4 border border-white/[0.06]">
                            <div className="flex justify-between items-center mb-4 border-b border-white/[0.06] pb-3">
                                <h2 className="text-xs font-black label text-txt flex items-center gap-2"><Users size={15} className="text-volt"/>대기 명단</h2>
                                <span className="bg-volt text-ink text-xs font-black px-2.5 py-0.5 rounded-full tabular">{waitingPlayers.length}</span>
                            </div>
                            <div className="grid grid-cols-4 gap-2">
                                {maleWaiting.map(p => (
                                    <PlayerCard key={p.id} player={p} isAdmin={isAdmin} isCurrentUser={myUid === p.id} isSelected={selectedPlayerIds.includes(p.id)} isResting={p.isResting} onCardClick={handleCardClick} onDeleteClick={handleKickPlayer} onLongPress={(p) => setEditGamePlayer(p)} />
                                ))}
                            </div>
                            {maleWaiting.length > 0 && femaleWaiting.length > 0 && (
                                <div className="my-4 relative">
                                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-dashed border-white/10"></div></div>
                                    <div className="relative flex justify-center"><span className="bg-card px-2 text-[10px] text-muted font-black label">여성 회원</span></div>
                                </div>
                            )}
                            <div className="grid grid-cols-4 gap-2">
                                {femaleWaiting.map(p => (
                                    <PlayerCard key={p.id} player={p} isAdmin={isAdmin} isCurrentUser={myUid === p.id} isSelected={selectedPlayerIds.includes(p.id)} isResting={p.isResting} onCardClick={handleCardClick} onDeleteClick={handleKickPlayer} onLongPress={(p) => setEditGamePlayer(p)} />
                                ))}
                            </div>
                            {waitingPlayers.length === 0 && (
                                <div className="text-center py-8">
                                    <p className="text-sm text-dim font-bold">대기 중인 선수가 없습니다.</p>
                                    <p className="text-xs text-muted mt-1 font-medium">새로운 선수를 기다리는 중...</p>
                                </div>
                            )}
                        </section>

                        {/* [자동 매칭] 엔진이 추천한 조합들 — 수동 배정보다 위에 둔다.
                            대기 명단 바로 다음이 '이제 뭘 하지?'를 가장 자연스럽게 잇는 자리다. */}
                        <AutoMatchSection
                            autoMatches={roomData.autoMatches}
                            players={players}
                            isAdmin={isAdmin}
                            currentUserId={myUid}
                            inProgressPlayerIds={inProgressPlayerIds}
                            courtIndexByPlayer={courtIndexByPlayer}
                            onGenerate={handleGenerateMatch}
                            generatingGender={generatingGender}
                            onStart={(mIdx) => handleStartClick(mIdx, 'auto')}
                            onDelete={handleDeleteAutoMatch}
                            onClearAll={handleClearAutoMatches}
                            onRemovePlayer={handleRemoveFromAutoMatch}
                        />

                        <section className="space-y-3">
                            <h2 className="text-xs font-black label text-dim ml-1">경기 배정 · Schedule</h2>
                            {Array.from({ length: roomData.numScheduledMatches }).map((_, mIdx) => {
                                const match = roomData.scheduledMatches?.[mIdx] || Array(PLAYERS_PER_MATCH).fill(null);
                                const fullCount = match.filter(Boolean).length;
                                return (
                                    <div key={mIdx} className="bg-card rounded-2xl p-3 border border-white/[0.06] flex flex-col gap-2">
                                        <div className="flex justify-between items-center px-1">
                                            <div className="flex items-center gap-2">
                                                <span className="bg-volt text-ink text-[11px] font-black px-2.5 py-1 rounded-md tracking-wide">MATCH {mIdx + 1}</span>
                                                <span className="text-[11px] font-black text-muted tabular">{fullCount}/4</span>
                                            </div>
                                            <button onClick={() => handleStartClick(mIdx)} disabled={fullCount < PLAYERS_PER_MATCH} className={`flex items-center gap-1 px-3.5 py-1.5 rounded-full text-xs font-black transition-all label ${fullCount === PLAYERS_PER_MATCH ? 'bg-volt text-ink shadow-volt' : 'bg-white/5 text-muted cursor-not-allowed'}`}>
                                                경기 시작 <ChevronRightIcon size={14} />
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-4 gap-2">
                                            {match.map((pid, sIdx) => {
                                                if (pid && players[pid]) {
                                                    return <PlayerCard key={pid} player={players[pid]} isAdmin={isAdmin} isCurrentUser={myUid === pid} isSelected={selectedPlayerIds.includes(pid)} onCardClick={handleCardClick} onDeleteClick={() => handleRemoveFromSchedule(mIdx, sIdx)} onLongPress={(p) => setEditGamePlayer(p)} />;
                                                } else if (pid && !players[pid]) {
                                                    return <LeftPlayerCard key={`left-${mIdx}-${sIdx}`} isAdmin={isAdmin} onClick={() => handleRemoveFromSchedule(mIdx, sIdx)} />;
                                                } else {
                                                    return <EmptySlot key={sIdx} onSlotClick={() => handleSlotClick(mIdx, sIdx)} />;
                                                }
                                            })}
                                        </div>
                                    </div>
                                )
                            })}
                        </section>
                    </>
                ) : (
                    <div className="grid grid-cols-1 gap-4">
                        {Array.from({ length: roomData.numInProgressCourts }).map((_, cIdx) => {
                            const court = roomData.inProgressCourts?.[cIdx];
                            const isOccupied = !!court;
                            return (
                                <div key={cIdx} className={`rounded-2xl border transition-all overflow-hidden ${isOccupied ? 'bg-card border-volt/40' : 'bg-card border-dashed border-white/10'}`}>
                                    <div className={`px-4 py-3 flex justify-between items-center ${isOccupied ? 'bg-volt' : 'border-b border-white/[0.06]'}`}>
                                        <span className={`font-black text-sm tracking-wide ${isOccupied ? 'text-ink' : 'text-muted'}`}>COURT {cIdx + 1}</span>
                                        {isOccupied ? (
                                            <div className="flex items-center gap-2">
                                                <CourtTimer startTime={court.startTime} />
                                                {isAdmin && (
                                                    <button onClick={() => handleEndMatch(cIdx)} className="bg-ink text-txt text-xs font-black px-3 py-1.5 rounded-full">경기 종료</button>
                                                )}
                                            </div>
                                        ) : <span className="text-xs text-muted font-bold label">대기 중</span>}
                                    </div>
                                    <div className="p-3 grid grid-cols-4 gap-2">
                                        {isOccupied ? court.players.map((pid, idx) => {
                                            if (pid && players[pid]) {
                                                return <PlayerCard key={pid} player={players[pid]} isPlaying={true} isAdmin={isAdmin} onLongPress={(p) => setEditGamePlayer(p)} />;
                                            } else if (pid && !players[pid]) {
                                                return <LeftPlayerCard key={`left-court-${cIdx}-${idx}`} isAdmin={false} />;
                                            } else {
                                                return <div key={`empty-${cIdx}-${idx}`} className="h-[52px] bg-white/[0.02] rounded-lg border border-white/[0.06]"/>;
                                            }
                                        }) : (
                                            <div className="col-span-4 h-[52px] flex items-center justify-center text-muted gap-2">
                                                <TrophyIcon size={18} /><span className="text-sm font-bold">경기가 없습니다</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </main>

            <CourtSelectionModal isOpen={courtModalOpen} onClose={() => setCourtModalOpen(false)} courts={availableCourts} onSelect={(idx) => processStartMatch(pendingMatchIndex, idx, pendingMatchSource)} />
            <ShareModal isOpen={showShareModal} onClose={() => setShowShareModal(false)} roomId={roomId} />
            <SettingsModal
                isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)}
                roomData={roomData} onSave={handleSettingsSave} onReset={handleSystemReset} onKickAll={handleKickAll}
                players={players}
                onReplayGuide={() => { guideTriedRef.current = true; setIsSettingsOpen(false); setIsGuideOpen(true); }}
                isGhost={ghostActive}
                onToggleGhost={handleToggleGhost}
            />
            <EditGamesModal isOpen={!!editGamePlayer} onClose={() => setEditGamePlayer(null)} player={editGamePlayer} onSave={handleSaveGames} />
            <EditRoomInfoModal isOpen={isEditInfoOpen} onClose={() => setIsEditInfoOpen(false)} roomData={roomData} onSave={handleRoomInfoSave} onDelete={handleRoomDelete} />
            <TestLabModal isOpen={isTestLabOpen} onClose={() => setIsTestLabOpen(false)} onCreateBots={handleCreateBots} isAutoPlay={isAutoPlay} setIsAutoPlay={setIsAutoPlay} />

            {/* [자동 매칭] 후보 6개 고르기 */}
            {matchOptions && (
                <MatchOptionsModal
                    genderLabel={matchOptions.genderLabel}
                    result={matchOptions.result}
                    queueCount={Object.keys(roomData.autoMatches || {}).length}
                    onSelect={handleSelectMatchOption}
                    onRegenerate={handleRegenerateOptions}
                    onCancel={() => setMatchOptions(null)}
                />
            )}

            {/* [자동 매칭] 관리자 게임형 안내 — 끝까지 봐야 기록이 남는다 */}
            {isGuideOpen && (
                <AutoMatchGuide
                    userName={userData?.name}
                    onComplete={markGuideSeen}
                    onDismiss={() => setIsGuideOpen(false)}
                />
            )}
        </div>
    );
}

// ===================================================================================
// 콕맵 (Kakao Map)
// ===================================================================================
// ===================================================================================
// 콕맵 보조 함수 (컴포넌트 밖 — 매 렌더마다 다시 만들 이유가 없다)
// ===================================================================================

/**
 * 지도 오버레이에 넣을 문자열을 안전하게 만든다.
 * 경기방 이름은 사용자가 직접 지은 값이라, HTML 에 그대로 끼워 넣으면 태그가 실행된다.
 * (지도를 보기만 해도 실행되므로 클릭조차 필요 없다)
 */
function escapeHtml(text) {
    return String(text ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * 체육관 종류별 색 점 마커 이미지.
 *
 * 카카오 MarkerImage 는 같은 객체를 여러 마커가 공유할 수 있어서, 종류마다 한 번만
 * 만들어 두고 돌려 쓴다. 수백 개 마커를 찍어도 이미지 객체는 네 개뿐이다.
 * SVG 를 data URI 로 넣으므로 네트워크 요청도 없다.
 */
const GYM_PIN_COLORS = {
    badminton: '#CDFB47',   // 배드민턴 — 앱의 시그니처 색
    public: '#60A5FA',      // 공설
    private: '#F3F5F8',     // 사설
    school: '#8C93A1',      // 학교
};
const gymPinCache = {};
function gymPinImage(kind) {
    const color = GYM_PIN_COLORS[kind] || GYM_PIN_COLORS.private;
    if (gymPinCache[color]) return gymPinCache[color];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><circle cx="8" cy="8" r="5.5" fill="${color}" stroke="#08090C" stroke-width="2"/></svg>`;
    const img = new window.kakao.maps.MarkerImage(
        `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
        new window.kakao.maps.Size(16, 16),
        { offset: new window.kakao.maps.Point(8, 8) }
    );
    gymPinCache[color] = img;
    return img;
}

// ===================================================================================
// 콕맵 — 내 주변 체육관 · 경기방 · 동호회
// -----------------------------------------------------------------------------------
// 예전에는 콕스타에 만들어진 '경기방'만 지도에 찍혔다. 방이 없는 동네에서는 지도가
// 텅 비어서 쓸 이유가 없었다. 이제 경기도 체육관 1,000여 곳을 함께 깔아서,
// 방이 하나도 없어도 "우리 동네에 어디서 칠 수 있나"를 볼 수 있게 했다.
//
// 표시하는 것
//   · 체육관 — 카카오 로컬 API로 모은 경기도 31개 시·군 (공설/사설/학교 추정 구분)
//   · 경기방 — 콕스타에 실제로 열린 방. 우리만 가진 정보라 기본 필터로 둔다.
//   · 동호회 — 소모임에 등록된 배드민턴 모임 (지역이 맞는 것만, 일부)
//
// ⚠️ 운영시간·요금은 넣지 않았다. 카카오 로컬 API가 주지 않는 값이라 지어낼 수밖에
//    없는데, 틀린 시간을 보고 헛걸음한 사람이 한 명이라도 생기면 지도 전체를 못 믿게 된다.
//    대신 '카카오맵에서 보기'로 넘긴다.
//
// 성능 메모: 체육관이 1,000곳이 넘어서 마커를 그냥 찍으면 지도가 버벅인다.
//    카카오 클러스터러(index.html 에서 libraries=clusterer 로 이미 불러온다)로 묶는다.
// ===================================================================================
// ===================================================================================
// 콕맵 — 내 주변 체육관 · 경기방 · 동호회
// -----------------------------------------------------------------------------------
// 화면 구조 (위 → 아래)
//   ① 검색창 + 필터 칩 (지도 위에 겹치지 않는 고정 헤더 — 지도를 가리지 않는다)
//   ② 지도
//   ③ 아래 시트 — 접었다 폈다 할 수 있다 (손잡이 탭)
//        접힘: 손잡이 + "이 근처 체육관 N곳" 한 줄  → 지도가 화면의 주인공
//        펼침: 목록(거리순) 또는 선택한 체육관/경기방 상세
//
// ★ 지도가 없어도 전부 동작한다.
//   카카오 SDK 는 도메인 미등록·네트워크 문제로 안 뜰 수 있다. 예전에는 그 경우
//   회색 빈 화면에서 무한 대기했다 — 사용자에게는 그냥 "고장난 콕맵"이다.
//   지금은 8초 안에 못 뜨면 목록 전용 모드로 전환한다. 검색·목록·상세·전화·
//   카카오맵 링크는 지도 없이도 다 된다. (지도는 장식이 아니라 뷰 중 하나일 뿐이다)
// ===================================================================================
function KokMapPage({ onNavigate }) {
    const mapRef = useRef(null);
    const mapInstance = useRef(null);
    const clustererRef = useRef(null);
    const roomObjectsRef = useRef([]);
    const gymMarkersRef = useRef([]);
    const centerDebounceRef = useRef(null);

    const [rooms, setRooms] = useState([]);
    const [isMapReady, setIsMapReady] = useState(false);
    const [mapFailed, setMapFailed] = useState(false);
    const [selectedRoom, setSelectedRoom] = useState(null);
    const [selectedGym, setSelectedGym] = useState(null);
    const [activeFilter, setActiveFilter] = useState('badminton');
    const [searchText, setSearchText] = useState('');
    const [sheetOpen, setSheetOpen] = useState(false);   // 접힘이 기본 — 지도가 먼저 보인다
    const [center, setCenter] = useState({ lat: 37.2636, lng: 127.0286 }); // 수원시청 (경기도 한복판)
    const geocoder = useRef(null);

    // ── 콕스타 경기방 ──
    useEffect(() => {
        const unsubscribe = onSnapshot(query(collection(db, "rooms")), (snapshot) => {
            setRooms(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        }, (e) => console.error('경기방 구독 실패:', e));
        return () => unsubscribe();
    }, []);

    // ── 지도 만들기 (8초 안에 못 뜨면 목록 전용 모드) ──
    useEffect(() => {
        const container = mapRef.current;
        if (!container) return;
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
                    border-width: 5px 5px 0; border-style: solid; border-color: #CDFB47 transparent transparent transparent;
                }
            `;
            document.head.appendChild(style);
        }

        let cancelled = false;
        const initMap = () => {
            if (mapInstance.current) { setIsMapReady(true); return true; }
            if (window.kakao?.maps?.load) {
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
                        console.error('지도 초기화 실패:', e);
                        setMapFailed(true);
                    }
                });
                return true;
            }
            return false;
        };

        if (!initMap()) {
            const id = setInterval(() => { if (initMap()) clearInterval(id); }, 100);
            // ★ 8초가 지나도 SDK 가 안 오면 포기를 선언한다.
            //   예전에는 이 인터벌이 영원히 돌아서 회색 화면 앞에서 기다리게 했다.
            const giveUp = setTimeout(() => {
                clearInterval(id);
                if (!mapInstance.current) setMapFailed(true);
            }, 8000);
            return () => { cancelled = true; clearInterval(id); clearTimeout(giveUp); };
        }
        return () => { cancelled = true; };
    }, []);

    // ── 체육관 핀 (공유 MarkerImage — DOM 없음) ──
    useEffect(() => {
        if (!isMapReady || !window.kakao) return;
        const map = mapInstance.current;
        const clusterer = clustererRef.current;

        const list = filterGyms(activeFilter);
        if (clusterer) clusterer.clear();
        gymMarkersRef.current.forEach(m => m.setMap(null));
        gymMarkersRef.current = [];
        if (list.length === 0) return;

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
                setSheetOpen(true);   // 핀을 눌렀으면 상세를 보여준다
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

    // ── 경기방 핀 (항상 표시) ──
    useEffect(() => {
        if (!isMapReady || !window.kakao) return;
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

    // ── 검색: 우리 목록 먼저, 안 되면 주소 검색 (지도 없이도 동작) ──
    const handleMapSearch = () => {
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
        // 우리 목록에 없으면 주소로 지도 이동 (지도가 살아 있을 때만)
        if (geocoder.current && mapInstance.current) {
            geocoder.current.addressSearch(q, (result, status) => {
                if (status === window.kakao.maps.services.Status.OK) {
                    const pos = new window.kakao.maps.LatLng(result[0].y, result[0].x);
                    mapInstance.current.panTo(pos);
                    setCenter({ lat: Number(result[0].y), lng: Number(result[0].x) });
                    setSheetOpen(true);
                } else { toast('검색 결과가 없습니다.', 'error'); }
            });
        } else {
            // 지도 없는 모드: 목록 필터로만 검색된다
            setSheetOpen(true);
            if (searchGyms(q, 1).length === 0) toast('이름·주소에 일치하는 체육관이 없습니다.', 'error');
        }
    };
    const handleKeyDown = (e) => { if (e.key === 'Enter') handleMapSearch(); };

    const handleMyLoc = () => {
        if (!navigator.geolocation) { toast("위치 정보를 사용할 수 없습니다.", 'error'); return; }
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
            () => toast("위치 권한이 필요합니다.", 'error')
        );
    };

    // ── 목록: 검색 중이면 검색 결과, 아니면 (지도 중심 or 내 위치) 가까운 순 ──
    const listedGyms = useMemo(() => {
        const q = searchText.trim();
        if (q) return searchGyms(q, 30);
        const pool = activeFilter === 'room' ? GYMS : filterGyms(activeFilter);
        return nearestGyms(center.lat, center.lng, pool, 30);
    }, [searchText, activeFilter, center.lat, center.lng]);

    const nearbyClubs = useMemo(
        () => (selectedGym ? clubsInRegion(selectedGym.region) : []),
        [selectedGym]
    );
    const roomsAtGym = useMemo(() => {
        if (!selectedGym) return [];
        return rooms.filter(r => r.coords?.lat
            && distanceKm(selectedGym.lat, selectedGym.lng, r.coords.lat, r.coords.lng) < 1);
    }, [selectedGym, rooms]);

    // 체육관 상세 뷰 — 지도 모드의 아래 시트와 '지도 실패' 목록 모드 양쪽에서 그대로 쓴다.
    // 한쪽에만 두면 다른 쪽에서 목록을 눌러도 아무 일도 안 일어나는 버그가 된다 (실제로 있었다).
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
                                        <button onClick={() => setSelectedGym(null)} className="p-1 text-dim shrink-0"><X size={20} /></button>
                                    </div>

                                    <div className="flex gap-2">
                                        {selectedGym.phone && (
                                            <a href={`tel:${selectedGym.phone}`} className="flex-1 py-2.5 bg-white/5 text-txt font-black rounded-xl text-xs text-center border border-white/10">
                                                📞 전화
                                            </a>
                                        )}
                                        <a href={selectedGym.kakaoUrl} target="_blank" rel="noopener noreferrer"
                                            className="flex-[2] py-2.5 bg-volt text-ink font-black rounded-xl text-xs text-center">
                                            카카오맵에서 상세 보기
                                        </a>
                                    </div>
                                    <p className="text-[10px] text-muted font-bold mt-2 text-center">
                                        운영시간·이용료는 카카오맵 또는 전화로 확인해주세요
                                    </p>

                                    {roomsAtGym.length > 0 && (
                                        <div className="mt-5">
                                            <h4 className="text-[11px] font-black label text-volt mb-2">여기 열린 경기방 {roomsAtGym.length}</h4>
                                            <div className="space-y-2">
                                                {roomsAtGym.map(r => (
                                                    <button key={r.id} onClick={() => onNavigate?.('game')}
                                                        className="w-full text-left p-3 bg-card rounded-xl border border-volt/30">
                                                        <p className="text-sm font-black text-txt truncate">{r.name}</p>
                                                        <p className="text-[11px] text-dim font-bold mt-0.5">{r.location} · {r.playerCount || 0}/{r.maxPlayers}명</p>
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
                                                    <a key={c.id} href={c.url} target="_blank" rel="noopener noreferrer"
                                                        className="block p-3 bg-card rounded-xl border border-white/[0.06]">
                                                        <p className="text-sm font-black text-txt truncate">{c.name}</p>
                                                        {c.description && <p className="text-[11px] text-dim font-medium mt-0.5 line-clamp-2">{c.description}</p>}
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

    /** 목록 아이템 (공용) — 컴포넌트가 아니라 렌더 함수다. 내부 컴포넌트는 매 렌더마다 재마운트된다 */
    const renderGymRow = (g) => (
        <button
            onClick={() => {
                setSelectedGym(g); setSelectedRoom(null); setSheetOpen(true);
                if (mapInstance.current && window.kakao?.maps) {
                    mapInstance.current.panTo(new window.kakao.maps.LatLng(g.lat, g.lng));
                }
            }}
            key={g.id}
            className="w-full text-left p-3 bg-card rounded-xl border border-white/[0.06] flex items-center gap-3 active:scale-[0.99] transition-transform">
            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${g.isBadminton ? 'bg-volt' : g.ownership === 'public' ? 'bg-blue-400' : g.ownership === 'school' ? 'bg-muted' : 'bg-txt'}`} />
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                    <p className="text-sm font-black text-txt truncate">{g.name}</p>
                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-white/5 text-muted shrink-0">{g.ownershipLabel}</span>
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

            {/* ── ① 고정 헤더: 검색 + 필터 (지도와 겹치지 않는다) ── */}
            <div className="flex-shrink-0 bg-surface border-b border-white/[0.06] px-4 pt-3 pb-2.5 z-20">
                <div className="bg-card rounded-2xl border border-white/10 flex items-center p-2 pl-3.5">
                    <Search size={17} className="text-muted mr-2 shrink-0" />
                    <input
                        type="text" value={searchText}
                        onChange={(e) => setSearchText(e.target.value)} onKeyDown={handleKeyDown}
                        placeholder="체육관 이름·주소 검색"
                        className="flex-1 bg-transparent outline-none text-sm font-bold text-txt placeholder-muted min-w-0"
                    />
                    {searchText && (
                        <button onClick={() => setSearchText('')} className="p-1 text-dim"><X size={16} /></button>
                    )}
                    <button onClick={handleMapSearch} className="px-3.5 py-1.5 rounded-xl bg-volt text-ink text-xs font-black ml-1 shrink-0">검색</button>
                </div>
                <div className="flex gap-1.5 overflow-x-auto hide-scrollbar mt-2.5 -mx-4 px-4">
                    {MAP_FILTERS.map(f => (
                        <button
                            key={f.key}
                            onClick={() => { setActiveFilter(f.key); setSelectedGym(null); setSelectedRoom(null); }}
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
                    // 지도 없이도 콕맵은 죽지 않는다 — 목록이 본체다.
                    // ★ 상세도 여기서 직접 그린다. 아래 시트는 지도 모드에서만 렌더되므로,
                    //   여기서 안 그리면 목록을 눌러도 아무 일도 안 일어난다.
                    <div className="absolute inset-0 overflow-y-auto hide-scrollbar bg-ink px-4 pt-3 pb-24">
                        {selectedGym ? gymDetailView : (
                            <>
                                <div className="mb-3 p-3 rounded-xl bg-coral/10 border border-coral/30">
                                    <p className="text-xs font-black text-coral">지도를 불러오지 못했습니다</p>
                                    <p className="text-[11px] text-dim font-bold mt-1 leading-relaxed">
                                        네트워크 상태를 확인해주세요. 체육관 검색과 목록은 그대로 쓸 수 있습니다.
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    {listedGyms.map(renderGymRow)}
                                </div>
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
                        {/* 지도 조작 버튼 — 오른쪽 아래 한 곳에 모은다 */}
                        <div className="absolute right-3.5 bottom-3.5 flex flex-col gap-2 z-10">
                            <button onClick={() => mapInstance.current?.setLevel(mapInstance.current.getLevel() - 1, { animate: true })}
                                className="w-10 h-10 glass rounded-xl border border-white/10 flex items-center justify-center text-txt font-black text-lg shadow-deep">+</button>
                            <button onClick={() => mapInstance.current?.setLevel(mapInstance.current.getLevel() + 1, { animate: true })}
                                className="w-10 h-10 glass rounded-xl border border-white/10 flex items-center justify-center text-txt font-black text-lg shadow-deep">−</button>
                            <button onClick={handleMyLoc}
                                className="w-10 h-10 glass rounded-xl border border-white/10 flex items-center justify-center text-volt shadow-deep">
                                <MapPin size={18} />
                            </button>
                        </div>
                    </>
                )}
            </div>

            {/* ── ③ 아래 시트 (지도 모드에서만 — 목록 전용 모드는 본문이 곧 목록이다) ── */}
            {!mapFailed && (
                <div className={`flex-shrink-0 bg-surface border-t border-white/10 rounded-t-3xl z-20 transition-all duration-300 flex flex-col ${sheetOpen ? 'h-[58vh]' : 'h-auto'}`}>
                    {/* 손잡이 — 누르면 접었다 폈다 */}
                    <button
                        onClick={() => { if (sheetOpen && hasDetail) { setSelectedGym(null); setSelectedRoom(null); } setSheetOpen(!sheetOpen); }}
                        className="flex-shrink-0 w-full pt-2.5 pb-2 flex flex-col items-center"
                    >
                        <span className="w-10 h-1 rounded-full bg-white/20" />
                        {!sheetOpen && (
                            <div className="flex items-center gap-2 mt-2 pb-1">
                                <span className="text-sm font-black text-txt">이 근처 체육관 <span className="text-volt tabular">{listedGyms.length}</span></span>
                                <span className="text-[10px] font-bold text-muted">눌러서 열기</span>
                            </div>
                        )}
                    </button>

                    {sheetOpen && (
                        <div className="flex-1 min-h-0 overflow-y-auto hide-scrollbar px-4 pb-6">
                            {selectedGym ? gymDetailView : selectedRoom ? (
                                /* ── 경기방 상세 ── */
                                <div>
                                    <div className="flex items-start justify-between gap-3 mb-2">
                                        <div className="min-w-0">
                                            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-volt text-ink">경기방</span>
                                            <h3 className="text-lg font-black text-txt kern-tight leading-tight mt-1.5">{selectedRoom.name}</h3>
                                            <p className="text-xs text-dim font-bold mt-1">{selectedRoom.location} · {selectedRoom.address}</p>
                                        </div>
                                        <button onClick={() => setSelectedRoom(null)} className="p-1 text-dim shrink-0"><X size={20} /></button>
                                    </div>
                                    <p className="text-xs text-dim font-medium leading-relaxed">{selectedRoom.description}</p>
                                    <button onClick={() => onNavigate?.('game')} className="w-full mt-4 py-3 bg-volt text-ink font-black rounded-full text-sm">
                                        경기방 보러가기
                                    </button>
                                </div>

                            ) : (
                                /* ── 목록 ── */
                                <div>
                                    <div className="flex items-center justify-between mb-2.5">
                                        <h3 className="text-sm font-black text-txt">
                                            {searchText.trim() ? '검색 결과' : '가까운 체육관'}
                                            <span className="text-volt tabular ml-1.5">{listedGyms.length}</span>
                                        </h3>
                                        {/* 핀 색 안내는 목록 안에 — 지도를 가리지 않는다 */}
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
                                        <div className="space-y-2">
                                            {listedGyms.map(renderGymRow)}
                                        </div>
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

function CommunityPage() {
    return (
        <div className="relative h-full bg-ink">
            <ComingSoonPage icon={MessageSquare} title="커뮤니티" description="정보 공유, Q&A, 클럽 홍보, 중고마켓. 배드민턴의 모든 대화가 곧 이곳에서 시작됩니다." />
            <button onClick={() => toast('글쓰기 기능 준비 중입니다.')} className="absolute bottom-6 right-6 bg-volt text-ink h-14 pl-4 pr-5 rounded-full shadow-volt flex items-center gap-1.5 transition-transform active:scale-90 font-black">
                <Plus size={22} strokeWidth={2.6} /> 글쓰기
            </button>
        </div>
    );
}

// 내 정보 페이지
function MyInfoPage({ user, userData, onLoginClick, onLogout, setPage }) {
    const [showEditProfile, setShowEditProfile] = useState(false);

    if (!user) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-ink">
                <div className="w-20 h-20 rounded-3xl bg-card flex items-center justify-center mb-6 border border-white/[0.06]">
                    <User className="w-9 h-9 text-volt" />
                </div>
                <h2 className="text-2xl font-black kern-tight mb-2 text-txt">로그인이 필요합니다</h2>
                <p className="text-dim font-bold mb-8 text-sm">로그인하고 콕스타의 모든 무대를 열어보세요.</p>
                <button onClick={onLoginClick} className="px-9 py-4 bg-volt text-ink font-black rounded-full shadow-volt text-xs label transition-transform active:scale-95">
                    로그인 / 회원가입
                </button>
            </div>
        );
    }

    if (!userData) {
        return <div className="p-10 text-center text-dim font-bold bg-ink min-h-full">프로필 정보를 설정해주세요.</div>;
    }
    return (
        <div className="p-5 space-y-5 bg-ink min-h-full">
            <div className="pt-1">
                <span className="text-[11px] font-black label text-volt">Athlete</span>
                <h1 className="text-2xl font-black kern-tight leading-none mt-0.5 text-txt">내 정보</h1>
            </div>

            <div className="bg-card rounded-[28px] p-6 relative overflow-hidden grain court-lines border border-white/[0.06]">
                <div className="flex items-center space-x-4 relative z-10">
                    <div className="w-20 h-20 bg-volt rounded-2xl flex items-center justify-center flex-shrink-0">
                        <User className="w-10 h-10 text-ink" strokeWidth={2.4} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h2 className="text-2xl font-black truncate text-txt kern-tight">{userData?.name || '사용자'}</h2>
                        <div className="flex items-center gap-2 mt-2">
                            <span className="inline-flex items-center gap-1 text-[11px] font-black text-ink bg-volt px-2 py-1 rounded-full label"><BarChart2 size={12} /> {userData?.level || 'N조'}</span>
                            {userData?.kakaoId && (<span className="text-[10px] bg-[#FEE500] text-black px-2 py-0.5 rounded-full font-black">Kakao</span>)}
                        </div>
                    </div>
                </div>
                <div className="mt-5 flex items-center gap-2 relative z-10">
                    <span className="text-[11px] truncate font-bold bg-white/5 text-dim px-3 py-2 rounded-xl flex-1">{userData?.email || user?.email || user?.uid}</span>
                    <button onClick={() => {
                        const copyId = userData?.email || user?.email || user?.uid || "";
                        if (!copyId) { toast("복사할 아이디 정보가 없습니다.", 'error'); return; }
                        if (navigator.clipboard && window.isSecureContext) {
                            navigator.clipboard.writeText(copyId).then(() => toast("아이디가 복사되었습니다!")).catch(() => toast("복사 실패", 'error'));
                        } else {
                            const textArea = document.createElement("textarea");
                            textArea.value = copyId;
                            document.body.appendChild(textArea);
                            textArea.select();
                            try { document.execCommand("copy"); toast("아이디가 복사되었습니다!"); } catch (err) { toast("복사에 실패했습니다.", 'error'); }
                            document.body.removeChild(textArea);
                        }
                    }} className="p-2.5 bg-volt text-ink rounded-xl active:scale-90 transition-transform flex-shrink-0 flex items-center gap-1">
                        <Copy size={14} /><span className="text-[11px] font-black">복사</span>
                    </button>
                </div>
                <p className="text-[10px] text-muted font-medium mt-2 ml-1 relative z-10">* 관리자 등록 시 위 아이디를 전달해 주세요.</p>
                <ZapIcon className="absolute -right-6 -bottom-8 w-40 h-40 text-white/[0.04]" strokeWidth={1} />
            </div>

            <div className="bg-card rounded-2xl border border-white/[0.06] p-6">
                <h3 className="text-xs font-black label text-dim mb-5 flex items-center gap-2"><UserCheck size={16} className="text-volt"/> 나의 프로필</h3>
                <div className="space-y-3.5 text-sm">
                    <div className="flex justify-between items-center border-b border-white/[0.06] pb-3"><span className="text-muted font-bold">급수</span><span className="font-black text-txt">{userData?.level || '미설정'}</span></div>
                    <div className="flex justify-between items-center border-b border-white/[0.06] pb-3"><span className="text-muted font-bold">성별</span><span className="font-black text-txt">{userData?.gender || '미설정'}</span></div>
                    <div className="flex justify-between items-center border-b border-white/[0.06] pb-3"><span className="text-muted font-bold">출생년도</span><span className="font-black text-txt">{userData?.birthYear ? `${userData.birthYear}년생` : '미설정'}</span></div>
                </div>
                <button onClick={() => setShowEditProfile(true)} className="mt-6 w-full py-3.5 bg-white/5 text-txt rounded-full hover:bg-white/10 transition-all text-xs font-black label">프로필 수정하기</button>
            </div>

            <div className="bg-card rounded-2xl border border-white/[0.06] p-6">
                <h3 className="text-xs font-black label text-dim mb-4 flex items-center gap-2"><HeartIcon size={16} className="text-volt"/> 찜한 아이템</h3>
                <EmptyState icon={Archive} title="찜한 아이템이 없습니다" description="노에러 스토어에서 마음에 드는 장비를 찜해보세요!" buttonText="스토어 둘러보기" onButtonClick={() => setPage('store')} />
            </div>

            <button onClick={onLogout} className="w-full py-4 bg-card border border-white/[0.06] text-coral font-black rounded-full text-sm hover:bg-coral/10 transition-colors">로그아웃</button>

            <EditProfileModal isOpen={showEditProfile} onClose={() => setShowEditProfile(false)} userData={userData} user={user} />
        </div>
    );
}

// 홈 헤더
function HomePageHeader({ onSearchClick, onBellClick }) {
    return (
        <header className="sticky top-0 glass z-10 px-5 py-3.5 flex justify-between items-center border-b border-white/[0.06]">
            <CockstarLogo markSize={22} />
            <div className="flex space-x-1 text-dim">
                <button onClick={onSearchClick} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/5 transition-colors"><Search size={22} /></button>
                <button onClick={onBellClick} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/5 transition-colors"><Bell size={22} /></button>
            </div>
        </header>
    );
}

function SubPageHeader({ title, onBackClick }) {
    return (
        <header className="sticky top-0 glass z-10 px-4 py-3.5 flex items-center border-b border-white/[0.06]">
            <button onClick={onBackClick} className="mr-1 w-10 h-10 flex items-center justify-center rounded-full text-dim hover:bg-white/5 transition-colors"><ArrowLeft size={22} /></button>
            <h1 className="text-xl font-black text-txt kern-tight">{title}</h1>
        </header>
    );
}

// ===================================================================================
// 메인 App
// ===================================================================================
const TabButton = ({ icon: Icon, label, isActive, onClick }) => {
    return (
        <button onClick={onClick} className="flex flex-col items-center justify-center w-full pt-2.5 pb-2 transition-all duration-200 active:scale-90">
            <div className={`relative flex items-center justify-center transition-colors ${isActive ? 'text-volt' : 'text-muted'}`}>
                <Icon size={24} strokeWidth={isActive ? 2.4 : 2} />
                {isActive && <span className="absolute -bottom-2 w-1 h-1 rounded-full bg-volt volt-glow"></span>}
            </div>
            <span className={`text-[11px] mt-1.5 transition-all ${isActive ? 'font-black text-txt' : 'font-bold text-muted'}`}>{label}</span>
        </button>
    );
};

function AppInner() {
    const [page, setPage] = useState(localStorage.getItem('cockstar_last_page') || 'home');
    const [user, setUser] = useState(null);
    const [userData, setUserData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [sharedRoomId, setSharedRoomId] = useState(null);
    const mainRef = useRef(null);

    useEffect(() => { if (page) localStorage.setItem('cockstar_last_page', page); }, [page]);

    // 페이지 전환 시 스크롤 상단으로 (UX 안정화)
    useEffect(() => { if (mainRef.current) mainRef.current.scrollTop = 0; }, [page]);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const roomId = params.get('roomId');
        if (roomId) { setSharedRoomId(roomId); setPage('game'); }
    }, []);

    const getGameDate = () => new Date().toISOString().split('T')[0];

    useEffect(() => {
        let unsubscribeUserDoc = null;
        const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
                const userDocRef = doc(db, "users", currentUser.uid);
                unsubscribeUserDoc = onSnapshot(userDocRef, async (docSnap) => {
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        const currentGameDate = getGameDate();
                        if (data.lastResetDate !== currentGameDate) {
                            await updateDoc(userDocRef, { todayGames: 0, lastResetDate: currentGameDate });
                        } else { setUserData(data); }
                    } else { setUserData(null); }
                    setLoading(false);
                });
            } else {
                setUser(null);
                setUserData(null);
                setLoading(false);
            }
        });
        return () => { unsubscribeAuth(); if (unsubscribeUserDoc) unsubscribeUserDoc(); };
    }, []);

    const handleTabClick = (targetPage) => {
        if ((targetPage === 'game' || targetPage === 'myInfo') && !user) { setIsAuthModalOpen(true); return; }
        setPage(targetPage);
    };

    if (loading) return (
        <div className="flex flex-col h-screen bg-ink max-w-md mx-auto items-center justify-center grain court-lines relative overflow-hidden">
            <div className="animate-pop relative z-10"><CockstarLogo markSize={44} className="scale-[1.4]" /></div>
            <span className="mt-10 text-[11px] font-black label text-muted relative z-10">코트를 준비하는 중</span>
        </div>
    );

    const showHomeHeader = page === 'home';
    // 스토어가 하단 탭이 되면서 '← 스토어' 뒤로가기 헤더는 뺐다 — 페이지 안에 자체 헤더가 있다
    const subTitle = null;

    return (
        <div className="flex flex-col h-screen bg-ink max-w-md mx-auto shadow-2xl overflow-hidden relative font-sans text-txt">
            {showHomeHeader && <HomePageHeader onSearchClick={() => handleTabClick('kokMap')} onBellClick={() => toast('알림 기능 준비 중입니다.')} />}
            {subTitle && <SubPageHeader title={subTitle} onBackClick={() => handleTabClick('home')} />}

            <main ref={mainRef} className="flex-grow overflow-y-auto hide-scrollbar bg-ink">
                {page === 'home' && <HomePage user={user} setPage={handleTabClick} />}
                {page === 'store' && <StorePage />}
                {page === 'game' && (<GamePage user={user} userData={userData} sharedRoomId={sharedRoomId} onLoginClick={() => setIsAuthModalOpen(true)} onNavigate={handleTabClick} />)}
                {page === 'kokMap' && <KokMapPage onNavigate={handleTabClick} />}
                {page === 'myInfo' && <MyInfoPage user={user} userData={userData} onLoginClick={() => setIsAuthModalOpen(true)} onLogout={() => signOut(auth)} setPage={handleTabClick} />}
            </main>

            <nav className="flex justify-around items-center bg-surface border-t border-white/[0.06] pb-safe pt-1 px-2 z-20">
                <TabButton icon={Home} label="홈" isActive={page === 'home'} onClick={() => handleTabClick('home')} />
                <TabButton icon={Trophy} label="경기" isActive={page === 'game'} onClick={() => handleTabClick('game')} />
                <TabButton icon={KokMap} label="콕맵" isActive={page === 'kokMap'} onClick={() => handleTabClick('kokMap')} />
                {/* 커뮤니티 탭을 스토어로 교체 — 커뮤니티는 아직 글이 없는 빈 방이었고,
                    스토어는 홈 깊숙한 버튼으로만 들어갈 수 있어서 서로 자리를 바꾸는 게 맞다 */}
                <TabButton icon={ShoppingBag} label="스토어" isActive={page === 'store'} onClick={() => handleTabClick('store')} />
                <TabButton icon={User} label="정보" isActive={page === 'myInfo'} onClick={() => handleTabClick('myInfo')} />
            </nav>

            {user && !userData && !loading && (<InitialProfileModal isOpen={true} user={user} />)}
            <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
            <Toaster />
        </div>
    );
}

export default function App() {
    return (
        <ErrorBoundary>
            <AppInner />
        </ErrorBoundary>
    );
}






