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
    Activity as ActivityIcon
} from 'lucide-react';

// [디자인] 아이콘 선 굵기를 살짝 두껍게(2.0) — 스포츠 앱 특유의 단단한 느낌
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

// ===================================================================================
// Firebase 설정 (Vercel 환경 변수 사용)
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
    if (cleanInput === 'domain') {
        return 'domain@special.user';
    }
    if (cleanInput.includes('@')) {
        return cleanInput;
    }
    return `${cleanInput}@cockstar.app`;
};

// ===================================================================================
// 상수 및 Helper
// ===================================================================================
const LEVEL_ORDER = { 'S조': 1, 'A조': 2, 'B조': 3, 'C조': 4, 'D조': 5, 'E조': 6, 'N조': 7, '미설정': 8 };
// 급수별 색상 (border-/text- 포맷 유지 — PlayerCard 로직 호환)
const getLevelColor = (level) => {
    switch (level) {
        case 'S조': return 'border-sky-400 text-sky-400';
        case 'A조': return 'border-red-500 text-red-500';
        case 'B조': return 'border-orange-500 text-orange-500';
        case 'C조': return 'border-amber-400 text-amber-400';
        case 'D조': return 'border-emerald-500 text-emerald-500';
        case 'E조': return 'border-blue-500 text-blue-500';
        default: return 'border-zinc-500 text-zinc-500';
    }
};
const PLAYERS_PER_MATCH = 4;

// ===================================================================================
// [디자인] 브랜드 로고 — 셔틀콕 마크 + 워드마크
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
            <circle cx="20" cy="30" r="4.6" fill={duotone ? '#CCFF00' : 'currentColor'} stroke={duotone ? '#0B0B0C' : 'none'} strokeWidth="1" />
        </svg>
    );
}

function CockstarLogo({ tone = 'ink', markSize = 22, className = '' }) {
    const light = tone === 'light';
    return (
        <div className={`flex items-center gap-2 ${className}`}>
            <CockstarMark size={markSize} duotone className={light ? 'text-white' : 'text-ink'} />
            <span className={`font-display display-italic uppercase text-[22px] leading-none ${light ? 'text-white' : 'text-ink'}`}>
                COCK<span className={light ? 'text-volt' : 'text-ink'}>STAR</span>
            </span>
        </div>
    );
}

// [디자인] 급수 뱃지
function LevelBadge({ level, className = '' }) {
    const l = level || 'N조';
    const color = getLevelColor(l).replace('border-', 'text-').split(' ').pop();
    return (
        <span className={`inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-tight ${color} ${className}`}>
            <BarChart2 size={12} strokeWidth={2.6} />
            {l === 'N조' ? '전체' : l}
        </span>
    );
}

// ===================================================================================
// 로딩 / 스켈레톤 / 빈 화면
// ===================================================================================
function LoadingSpinner({ text = "LOADING", dark = false }) {
    return (
        <div className={`flex flex-col items-center justify-center h-full ${dark ? 'bg-ink text-white' : 'text-ink'}`}>
            <div className="relative">
                <Loader2 className="w-9 h-9 animate-spin text-volt-deep" />
            </div>
            <span className="mt-4 text-xs font-black uppercase tracking-[0.25em] text-zinc-400">{text}</span>
        </div>
    );
}

function SkeletonCard() {
    return (
        <div className="w-full p-5 rounded-2xl bg-white border border-zinc-100">
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
            <div className="rounded-2xl overflow-hidden bg-white border border-zinc-100">
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
        <div className="rounded-2xl bg-white border border-zinc-100 p-5">
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
        <div className="flex flex-col items-center justify-center text-center p-10 rounded-2xl bg-zinc-50 border border-dashed border-zinc-200">
            <div className="w-14 h-14 rounded-2xl bg-ink flex items-center justify-center mb-4">
                <Icon className="w-7 h-7 text-volt" />
            </div>
            <h3 className="text-base font-black text-ink mb-1 kern-tight">{title}</h3>
            <p className="text-sm text-zinc-500 mb-6 font-medium">{description}</p>
            {buttonText && onButtonClick && (
                <button
                    onClick={onButtonClick}
                    className="px-6 py-3 bg-ink text-white text-sm font-black rounded-full hover:bg-ink-soft transition-all active:scale-95"
                >
                    {buttonText}
                </button>
            )}
        </div>
    );
}

function ComingSoonPage({ icon: Icon, title, description }) {
    return (
        <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-white">
            <div className="w-20 h-20 rounded-3xl bg-ink flex items-center justify-center mb-6 grain relative overflow-hidden">
                <Icon className="w-9 h-9 text-volt relative z-10" />
            </div>
            <span className="text-[11px] font-black uppercase tracking-[0.3em] text-volt-deep mb-2">Coming Soon</span>
            <h2 className="text-2xl font-black text-ink mb-2 kern-tight">{title}</h2>
            <p className="text-sm text-zinc-500 font-medium max-w-[260px]">{description}</p>
        </div>
    );
}

function LoginRequiredPage({ icon: Icon, title, description, onLoginClick }) {
    return (
        <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-white">
            <div className="w-20 h-20 rounded-3xl bg-ink flex items-center justify-center mb-6">
                <Icon className="w-9 h-9 text-volt" />
            </div>
            <h2 className="text-2xl font-black text-ink mb-2 kern-tight">{title}</h2>
            <p className="text-sm text-zinc-500 font-medium mb-8">{description}</p>
            <button
                onClick={onLoginClick}
                className="px-9 py-4 bg-volt text-ink text-sm font-black rounded-full shadow-volt transition-transform active:scale-95 uppercase tracking-wide"
            >
                로그인하고 시작하기
            </button>
        </div>
    );
}

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
            const recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
                'size': 'invisible'
            });
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

    const inputCls = "w-full p-4 bg-zinc-100 rounded-2xl border-2 border-transparent focus:border-ink outline-none font-bold text-ink placeholder-zinc-400 transition-colors";

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-white w-full max-w-md rounded-t-[32px] sm:rounded-[32px] overflow-hidden shadow-ink animate-slide-up sm:animate-scale-in">
                {/* 히어로 헤더 */}
                <div className="relative bg-ink px-8 pt-10 pb-8 grain overflow-hidden">
                    <div className="relative z-10">
                        <CockstarLogo tone="light" markSize={26} />
                        <h1 className="mt-6 text-white font-display display-italic text-3xl leading-[0.95] uppercase">
                            코트를<br /><span className="text-volt">지배하라</span>
                        </h1>
                        <p className="mt-3 text-zinc-400 text-sm font-medium">가입 30초. 오늘 저녁 경기부터 바로 뛴다.</p>
                    </div>
                    <ZapIcon className="absolute -right-4 -bottom-6 w-40 h-40 text-white/5" strokeWidth={1} />
                </div>

                <div className="p-8">
                    {error && <p className="text-red-500 text-xs text-center mb-4 font-bold">{error}</p>}

                    {loginMode === 'select' && (
                        <div className="space-y-3 animate-fade-in-up">
                            <button
                                onClick={handleKakaoLogin}
                                className="w-full py-4 bg-[#FEE500] text-[#1a1a1a] font-black rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                            >
                                <MessageSquare size={18} fill="#1a1a1a" /> 카카오로 시작하기
                            </button>
                            <button
                                onClick={() => setLoginMode('phone')}
                                className="w-full py-4 bg-ink text-white font-black rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                            >
                                <Phone size={18} /> 휴대폰 번호로 시작하기
                            </button>
                        </div>
                    )}

                    {loginMode === 'phone' && (
                        <div className="space-y-4 animate-fade-in-up">
                            <div id="recaptcha-container"></div>
                            <input
                                type="tel"
                                placeholder="휴대폰 번호 (01012345678)"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                className={inputCls}
                            />
                            <button
                                onClick={handleSendCode}
                                disabled={loading}
                                className="w-full py-4 bg-volt text-ink font-black rounded-2xl shadow-volt flex items-center justify-center transition-transform active:scale-95"
                            >
                                {loading ? <Loader2 className="animate-spin" /> : '인증번호 전송'}
                            </button>
                            <button onClick={() => setLoginMode('select')} className="w-full text-zinc-400 text-sm font-bold">뒤로가기</button>
                        </div>
                    )}

                    {loginMode === 'verify' && (
                        <div className="space-y-4 animate-fade-in-up">
                            <p className="text-center text-sm text-zinc-500 font-medium">전송된 인증번호 6자리를 입력해주세요.</p>
                            <input
                                type="number"
                                placeholder="000000"
                                value={vCode}
                                onChange={(e) => setVCode(e.target.value)}
                                className="w-full p-4 bg-zinc-100 rounded-2xl border-2 border-transparent focus:border-ink outline-none text-center text-3xl font-black tracking-[0.4em] tabular"
                            />
                            <button
                                onClick={handleVerifyCode}
                                disabled={loading}
                                className="w-full py-4 bg-ink text-white font-black rounded-2xl flex items-center justify-center transition-transform active:scale-95"
                            >
                                {loading ? <Loader2 className="animate-spin" /> : '인증 완료'}
                            </button>
                            <button onClick={() => setLoginMode('phone')} className="w-full text-zinc-400 text-sm font-bold">번호 다시 입력하기</button>
                        </div>
                    )}

                    {loginMode === 'admin' && (
                        <form onSubmit={handleAdminLogin} className="space-y-3 animate-fade-in-up">
                            <input
                                type="text" placeholder="관리자 아이디"
                                onChange={e => setAdminData({...adminData, id: e.target.value})}
                                className={inputCls}
                            />
                            <input
                                type="password" placeholder="비밀번호"
                                onChange={e => setAdminData({...adminData, pw: e.target.value})}
                                className={inputCls}
                            />
                            <button type="submit" className="w-full py-4 bg-ink text-white font-black rounded-2xl">관리자 인증</button>
                            <button onClick={() => setLoginMode('select')} className="w-full text-zinc-400 text-sm font-bold mt-2">뒤로가기</button>
                        </form>
                    )}

                    {loginMode === 'select' && (
                        <div className="mt-10 text-center">
                            <button
                                onClick={() => setLoginMode('admin')}
                                className="text-[10px] text-zinc-300 font-medium hover:text-zinc-500 transition-colors border-b border-zinc-100"
                            >
                                시스템 관리자 전용 로그인
                            </button>
                        </div>
                    )}
                </div>
                <button onClick={onClose} className="w-full py-4 bg-zinc-50 text-zinc-400 text-xs font-black border-t border-zinc-100 uppercase tracking-wider">
                    다음에 하기
                </button>
            </div>
        </div>
    );
}

// [디자인] 공용 폼 인풋 클래스
const FIELD_CLS = "w-full p-3.5 bg-zinc-100 rounded-xl border-2 border-transparent focus:border-ink outline-none font-bold text-ink placeholder-zinc-400 transition-colors";
const LABEL_CLS = "block text-[11px] font-black uppercase tracking-wider text-zinc-500 mb-1.5 ml-0.5";

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
            setRoomName('');
            setLocationName('');
            setAddress('');
            setCoords(null);
            setDescription('');
            setLevelLimit('N조');
            setMaxPlayers(20);
            setUsePassword(false);
            setPassword('');
            setError('');
            setLoading(false);
        }
    }, [isOpen]);

    const handleAddressSearch = () => {
        if (!window.daum || !window.daum.Postcode) {
            alert("주소 검색 서비스를 불러오는데 실패했습니다.");
            return;
        }

        new window.daum.Postcode({
            oncomplete: function(data) {
                const addr = data.roadAddress || data.jibunAddress;
                const buildingName = data.buildingName || '';

                setAddress(addr);
                if (!locationName && buildingName) {
                    setLocationName(buildingName);
                }

                if (window.kakao && window.kakao.maps) {
                    window.kakao.maps.load(() => {
                        if (window.kakao.maps.services) {
                            const geocoder = new window.kakao.maps.services.Geocoder();
                            geocoder.addressSearch(addr, (result, status) => {
                                if (status === window.kakao.maps.services.Status.OK) {
                                    const lat = result[0].y;
                                    const lng = result[0].x;
                                    setCoords({ lat: parseFloat(lat), lng: parseFloat(lng) });
                                    console.log("좌표 변환 성공:", lat, lng);
                                } else {
                                    console.error("좌표 변환 실패");
                                    setError("주소는 찾았으나 위치 좌표를 가져올 수 없습니다.");
                                }
                            });
                        } else {
                            setError("카카오맵 서비스 모듈을 불러오지 못했습니다.");
                        }
                    });
                } else {
                    setError("카카오맵 SDK가 로드되지 않았습니다.");
                }
            }
        }).open();
    };

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!roomName.trim()) return setError('모임방 제목을 입력해주세요.');
        if (!address) return setError('장소를 검색해서 입력해주세요.');
        if (!coords) return setError('유효한 주소가 아닙니다. 다시 검색해주세요.');
        if (maxPlayers < 4) return setError('최소 인원은 4명 이상이어야 합니다.');
        if (usePassword && !password) return setError('비밀번호를 입력해주세요.');

        setLoading(true);

        const newRoomData = {
            name: roomName,
            location: locationName || address,
            address: address,
            coords: coords,
            description: description || '모임 소개가 없습니다.',
            levelLimit: levelLimit,
            maxPlayers: parseInt(maxPlayers),
            password: usePassword ? password : '',
            adminUid: user.uid,
            adminName: userData?.name || '방장',
            createdAt: serverTimestamp(),
            playerCount: 0,
            numScheduledMatches: 4,
            numInProgressCourts: 2,
            scheduledMatches: {},
            inProgressCourts: [],
        };

        try {
            await onSubmit(newRoomData);
            onClose();
        } catch (err) {
            console.error("Error creating room:", err);
            setError("모임방 생성 실패: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 backdrop-blur-md">
            <div className="bg-white rounded-t-[32px] sm:rounded-[28px] p-6 w-full max-w-lg relative text-ink shadow-ink max-h-[92vh] overflow-y-auto hide-scrollbar animate-slide-up sm:animate-scale-in">
                <button
                    onClick={onClose}
                    className="absolute top-5 right-5 w-9 h-9 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-500 hover:bg-zinc-200 transition-colors"
                    disabled={loading}
                >
                    <X size={20} />
                </button>

                <span className="text-[11px] font-black uppercase tracking-[0.25em] text-volt-deep">New Match</span>
                <h2 className="text-2xl font-black kern-tight mb-6 mt-1">경기방 개설</h2>

                {error && <p className="text-red-500 mb-4 bg-red-50 p-3 rounded-xl text-sm font-bold">{error}</p>}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className={LABEL_CLS}>방 제목 <span className="text-volt-deep">*</span></label>
                        <input
                            type="text"
                            placeholder="예: 3040 실전 정모 (A-C조)"
                            value={roomName}
                            onChange={(e) => setRoomName(e.target.value)}
                            required
                            className={FIELD_CLS}
                        />
                    </div>

                    <div className="space-y-3 p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                        <label className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-zinc-500">
                            <MapPin size={13} /> 모임 장소
                        </label>

                        <button
                            type="button"
                            onClick={handleAddressSearch}
                            className="w-full py-3 bg-white border-2 border-zinc-200 rounded-xl text-sm font-black text-ink hover:border-ink transition-all flex items-center justify-center gap-2"
                        >
                            <Search size={16} />
                            주소 검색하기
                        </button>

                        <div>
                            <div className={`w-full p-3 rounded-xl border text-sm font-bold ${address ? 'bg-white border-zinc-200 text-ink' : 'bg-zinc-100 border-zinc-200 text-zinc-400'}`}>
                                {address ? (
                                    <div className="flex items-center gap-2">
                                        <span className="flex-1">{address}</span>
                                        {coords && <span className="text-[10px] bg-volt text-ink px-1.5 py-0.5 rounded-full font-black">좌표 OK</span>}
                                    </div>
                                ) : (
                                    "주소가 설정되지 않았습니다."
                                )}
                            </div>
                        </div>

                        <input
                            type="text"
                            name="location"
                            placeholder="상세 장소 (예: 콕스타 체육관 2층)"
                            value={locationName}
                            onChange={(e) => setLocationName(e.target.value)}
                            className="w-full p-3 bg-white rounded-xl border-2 border-transparent focus:border-ink outline-none text-sm font-bold"
                        />
                    </div>

                    <div>
                        <label className={LABEL_CLS}>소개</label>
                        <textarea
                            placeholder="어떤 경기를 지향하나요? 자유롭게 소개해주세요."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={3}
                            className={`${FIELD_CLS} resize-none`}
                        />
                    </div>

                    <div className="flex gap-4">
                        <div className="flex-1">
                            <label className={LABEL_CLS}>입장 급수</label>
                            <select
                                value={levelLimit}
                                onChange={(e) => setLevelLimit(e.target.value)}
                                className={FIELD_CLS}
                            >
                                {['N조','S조','A조','B조','C조','D조','E조'].map(l => (
                                    <option key={l} value={l}>{l === 'N조' ? '전체 급수' : `${l} 이상`}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex-1">
                            <label className={LABEL_CLS}>정원</label>
                            <input
                                type="number"
                                value={maxPlayers}
                                onChange={(e) => setMaxPlayers(e.target.value)}
                                min="4"
                                step="1"
                                className={FIELD_CLS}
                            />
                        </div>
                    </div>

                    <div className="bg-zinc-50 p-4 rounded-2xl border border-zinc-100">
                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={usePassword}
                                onChange={(e) => setUsePassword(e.target.checked)}
                                className="h-4 w-4 rounded accent-ink"
                            />
                            <span className="text-sm font-black text-ink">비밀번호 설정</span>
                        </label>
                        {usePassword && (
                            <input
                                type="password"
                                placeholder="비밀번호 입력"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full p-3 mt-3 bg-white rounded-xl border-2 border-transparent focus:border-ink outline-none text-sm font-bold"
                            />
                        )}
                    </div>

                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-4 bg-volt text-ink font-black rounded-full text-base hover:bg-volt-dark transition-colors disabled:bg-zinc-300 flex items-center justify-center shadow-volt uppercase tracking-wide"
                        >
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
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] p-4 backdrop-blur-md">
            <div className="bg-white rounded-[28px] p-6 w-full max-w-xs shadow-ink animate-scale-in">
                <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-ink rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <Share2 size={28} className="text-volt" />
                    </div>
                    <h3 className="text-lg font-black text-ink kern-tight">경기방 초대</h3>
                    <p className="text-xs text-zinc-500 mt-1 font-medium">링크를 복사해 크루를 소환하세요.</p>
                </div>
                <div className="bg-zinc-100 p-3 rounded-xl mb-6 break-all">
                    <p className="text-xs font-bold text-zinc-600 leading-relaxed">{shareUrl}</p>
                </div>
                <div className="space-y-2">
                    <button
                        onClick={() => {
                            navigator.clipboard.writeText(shareUrl);
                            alert("초대 링크가 복사되었습니다!");
                            onClose();
                        }}
                        className="w-full py-3.5 bg-volt text-ink font-black rounded-full flex items-center justify-center gap-2 shadow-volt"
                    >
                        <Copy size={18} /> 링크 복사하기
                    </button>
                    <button onClick={onClose} className="w-full py-3 text-zinc-400 text-sm font-bold">닫기</button>
                </div>
            </div>
        </div>
    );
}

// ===================================================================================
// 홈 — 메인 배너 (디자인된 슬라이드, 외부 이미지 제거)
// ===================================================================================
const bannerImages = [
    { kicker: "TONIGHT", title: "오늘 저녁,\n빈 코트를 찾아라", sub: "내 주변 실시간 경기방", bg: "bg-ink", accent: "text-volt", art: ZapIcon },
    { kicker: "SEASON", title: "이번 시즌,\n급수를 올려라", sub: "실력으로 증명하는 무대", bg: "bg-volt", accent: "text-ink", dark: true, art: FlameIcon },
    { kicker: "CREW", title: "함께 뛸\n크루를 모아라", sub: "링크 하나로 초대 완료", bg: "bg-ink", accent: "text-volt", art: Users2Icon },
];

function MainBanner() {
    const [currentIndex, setCurrentIndex] = useState(0);
    const timeoutRef = useRef(null);
    const dragStartXRef = useRef(0);
    const containerRef = useRef(null);
    const isDraggingRef = useRef(false);

    const resetTimeout = () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
    };

    const nextSlide = () => {
        setCurrentIndex((prevIndex) =>
            prevIndex === bannerImages.length - 1 ? 0 : prevIndex + 1
        );
    };

    useEffect(() => {
        resetTimeout();
        timeoutRef.current = setTimeout(nextSlide, 5000);
        return () => resetTimeout();
    }, [currentIndex]);

    const handleDotClick = (index) => {
        setCurrentIndex(index);
    };

    const handleDragStart = (e) => {
        isDraggingRef.current = true;
        dragStartXRef.current = e.clientX || e.touches[0].clientX;
        resetTimeout();
        if (containerRef.current) {
            containerRef.current.style.transition = 'none';
        }
        e.preventDefault();
    };

    const handleDragMove = (e) => {
        if (!isDraggingRef.current) return;
        e.preventDefault();

        const currentX = e.clientX || e.touches[0].clientX;
        const diff = dragStartXRef.current - currentX;

        if (containerRef.current) {
             containerRef.current.style.transform = `translateX(calc(-${currentIndex * 100}% - ${diff}px))`;
        }
    };

    const handleDragEnd = (e) => {
        if (!isDraggingRef.current) return;
        isDraggingRef.current = false;

        const currentX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
        const diff = dragStartXRef.current - currentX;

        if (containerRef.current) {
            containerRef.current.style.transition = 'transform 0.4s ease-in-out';
        }

        if (Math.abs(diff) > 50) {
            if (diff > 0) {
                nextSlide();
            } else {
                setCurrentIndex((prevIndex) =>
                    prevIndex === 0 ? bannerImages.length - 1 : prevIndex - 1
                );
            }
        } else {
            if (containerRef.current) {
                containerRef.current.style.transform = `translateX(-${currentIndex * 100}%)`;
            }
        }

        timeoutRef.current = setTimeout(nextSlide, 5000);
    };

    return (
        <section
            className="relative w-full overflow-hidden rounded-3xl select-none"
            onMouseDown={handleDragStart}
            onMouseMove={handleDragMove}
            onMouseUp={handleDragEnd}
            onMouseLeave={handleDragEnd}
            onTouchStart={handleDragStart}
            onTouchMove={handleDragMove}
            onTouchEnd={handleDragEnd}
        >
            <div
                ref={containerRef}
                className="flex transition-transform duration-400 ease-in-out"
                style={{ transform: `translateX(-${currentIndex * 100}%)` }}
            >
                {bannerImages.map((slide, index) => {
                    const Art = slide.art;
                    return (
                        <div
                            key={index}
                            className={`relative w-full h-48 flex-shrink-0 ${slide.bg} grain overflow-hidden flex flex-col justify-center px-7`}
                        >
                            <span className={`text-[11px] font-black uppercase tracking-[0.3em] ${slide.accent} relative z-10`}>{slide.kicker}</span>
                            <h2 className={`mt-2 font-display display-italic text-2xl leading-[1.02] uppercase relative z-10 whitespace-pre-line ${slide.dark ? 'text-ink' : 'text-white'}`}>
                                {slide.title}
                            </h2>
                            <p className={`mt-2 text-xs font-bold relative z-10 ${slide.dark ? 'text-ink/60' : 'text-white/60'}`}>{slide.sub}</p>
                            <Art className={`absolute -right-6 -bottom-8 w-44 h-44 ${slide.dark ? 'text-ink/10' : 'text-white/8'}`} strokeWidth={1} />
                        </div>
                    );
                })}
            </div>

            <div className="absolute bottom-4 right-5 flex space-x-1.5 z-10">
                {bannerImages.map((_, index) => (
                    <button
                        key={index}
                        onClick={() => handleDotClick(index)}
                        className={`h-1.5 rounded-full transition-all duration-300 ${
                            currentIndex === index ? 'w-6 bg-volt' : 'w-1.5 bg-white/40'
                        }`}
                    />
                ))}
            </div>
        </section>
    );
}

const SectionHeader = ({ title, sub, onMoreClick }) => (
    <div className="flex justify-between items-end mb-4">
        <div>
            {sub && <span className="text-[11px] font-black uppercase tracking-[0.2em] text-volt-deep">{sub}</span>}
            <h2 className="text-xl font-black text-ink kern-tight leading-none mt-0.5">{title}</h2>
        </div>
        <button
            onClick={onMoreClick}
            className="text-xs font-black text-zinc-400 hover:text-ink flex items-center transition-colors uppercase tracking-wide"
        >
            More <ChevronRight size={16} />
        </button>
    </div>
);

const brandTint = {
    Yonex: 'from-emerald-500 to-emerald-700',
    Victor: 'from-blue-500 to-blue-700',
    Mizuno: 'from-red-500 to-red-700',
    'Li-Ning': 'from-amber-400 to-amber-600',
    Adidas: 'from-zinc-700 to-ink',
};

const StoreCard = ({ image, title, brand }) => (
    <div className="w-40 flex-shrink-0 mr-3">
        <div className="rounded-2xl overflow-hidden bg-white border border-zinc-100 shadow-card">
            <div className={`relative w-full h-32 bg-gradient-to-br ${brandTint[brand] || 'from-zinc-600 to-ink'} grain overflow-hidden flex items-end p-3`}>
                <span className="font-display display-italic uppercase text-white text-lg leading-none relative z-10">{brand}</span>
                <ShoppingBag className="absolute -right-3 -top-3 w-20 h-20 text-white/10" strokeWidth={1} />
            </div>
            <div className="p-3">
                <p className="font-black text-sm text-ink truncate kern-tight">{title}</p>
                <p className="text-xs text-zinc-400 font-bold mt-0.5">{brand}</p>
            </div>
        </div>
    </div>
);

const GameCard = ({ title, tags, location, current, total, onClick }) => {
    const pct = total ? Math.min(100, Math.round((current / total) * 100)) : 0;
    const almostFull = pct >= 75;
    return (
        <button
            onClick={onClick}
            className="w-full p-5 bg-white rounded-2xl border border-zinc-100 shadow-card text-left transition-all duration-200 active:scale-[0.98] hover:border-ink/20 group"
        >
            <div className="flex justify-between items-start gap-3">
                <p className="font-black text-base text-ink kern-tight leading-snug flex-1">{title}</p>
                <ArrowUpRight size={18} className="text-zinc-300 group-hover:text-ink transition-colors shrink-0 mt-0.5" />
            </div>
            <div className="flex flex-wrap gap-1.5 my-3">
                {tags.map((tag, index) => (
                    <span key={index} className="text-[11px] font-black px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600">
                        #{tag.label}
                    </span>
                ))}
            </div>
            <div className="flex justify-between items-center gap-3">
                <span className="text-xs text-zinc-500 font-bold flex items-center">
                    <MapPin size={13} className="mr-1" /> {location}
                </span>
                <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 rounded-full bg-zinc-100 overflow-hidden">
                        <div className={`h-full rounded-full ${almostFull ? 'bg-volt' : 'bg-ink'}`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs font-black text-ink tabular">{current}/{total}</span>
                </div>
            </div>
        </button>
    );
};

const CommunityPost = ({ category, title, likes, onClick }) => (
    <button
        onClick={onClick}
        className="p-4 bg-white rounded-2xl border border-zinc-100 flex justify-between items-center w-full transition-all duration-200 active:scale-[0.99] hover:border-ink/20"
    >
        <p className="truncate text-sm font-bold text-ink flex-1 mr-4">
            <span className={`font-black mr-2 ${category === 'Q&A' ? 'text-volt-deep' : 'text-zinc-400'}`}>
                [{category}]
            </span>
            {title}
        </p>
        <div className="text-xs text-zinc-400 whitespace-nowrap flex items-center font-bold">
            <Heart size={13} className="mr-1" /> {likes}
        </div>
    </button>
);

// 홈 페이지
function HomePage({ user, setPage }) {
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => {
            setLoading(false);
        }, 1500);
        return () => clearTimeout(timer);
    }, []);

    const storeContainerRef = useRef(null);
    const scrollContentRef = useRef(null);
    const scrollAmountRef = useRef(0);
    const animationFrameRef = useRef(null);
    const isDraggingRef = useRef(false);
    const dragStartXRef = useRef(0);
    const scrollLeftRef = useRef(0);
    const lastScrollPosRef = useRef(0);
    const contentWidthRef = useRef(0);

    const storeItems = [
        { title: "요넥스 신상 의류", brand: "Yonex" },
        { title: "빅터 신상 라켓", brand: "Victor" },
        { title: "미즈노 런버드", brand: "Mizuno" },
        { title: "리닝 에어로넛", brand: "Li-Ning" },
        { title: "아디다스 배드민턴", brand: "Adidas" },
    ];
    const doubledStoreItems = [...storeItems, ...storeItems];

    const animateScroll = () => {
        if (!storeContainerRef.current || !scrollContentRef.current || isDraggingRef.current) {
            animationFrameRef.current = requestAnimationFrame(animateScroll);
            return;
        }

        if (scrollAmountRef.current >= contentWidthRef.current) {
            scrollAmountRef.current -= contentWidthRef.current;
            lastScrollPosRef.current = scrollAmountRef.current;
        } else if (scrollAmountRef.current < 0) {
             scrollAmountRef.current += contentWidthRef.current;
             lastScrollPosRef.current = scrollAmountRef.current;
        } else {
            scrollAmountRef.current += 0.5;

            if (Math.abs(lastScrollPosRef.current - scrollAmountRef.current) > 1) {
                 lastScrollPosRef.current += (scrollAmountRef.current - lastScrollPosRef.current) * 0.1;
            } else {
                 lastScrollPosRef.current = scrollAmountRef.current;
            }
        }

        storeContainerRef.current.scrollLeft = lastScrollPosRef.current;

        animationFrameRef.current = requestAnimationFrame(animateScroll);
    };

    useEffect(() => {
        if (loading || !scrollContentRef.current) return;

        contentWidthRef.current = scrollContentRef.current.scrollWidth / 2;

        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = requestAnimationFrame(animateScroll);

        return () => {
            cancelAnimationFrame(animationFrameRef.current);
        };
    }, [loading]);

    const handleStoreDragStart = (e) => {
        e.preventDefault();

        isDraggingRef.current = true;
        dragStartXRef.current = e.clientX || e.touches[0].clientX;
        scrollLeftRef.current = storeContainerRef.current.scrollLeft;
        storeContainerRef.current.style.cursor = 'grabbing';
    };

    const handleStoreDragMove = (e) => {
        if (!isDraggingRef.current) return;

        e.preventDefault();

        const currentX = e.clientX || e.touches[0].clientX;
        const dx = currentX - dragStartXRef.current;

        scrollAmountRef.current = scrollLeftRef.current - dx;
        lastScrollPosRef.current = scrollAmountRef.current;
        storeContainerRef.current.scrollLeft = scrollAmountRef.current;
    };

    const handleStoreDragEnd = () => {
        isDraggingRef.current = false;
        if (storeContainerRef.current) {
            storeContainerRef.current.style.cursor = 'grab';
        }
    };

    useEffect(() => {
        const container = storeContainerRef.current;
        if (!container) return;

        const onTouchStart = (e) => handleStoreDragStart(e);
        const onTouchMove = (e) => handleStoreDragMove(e);
        const onTouchEnd = (e) => handleStoreDragEnd(e);

        container.addEventListener('touchstart', onTouchStart, { passive: false });
        container.addEventListener('touchmove', onTouchMove, { passive: false });
        container.addEventListener('touchend', onTouchEnd, { passive: true });
        container.addEventListener('touchcancel', onTouchEnd, { passive: true });

        return () => {
            container.removeEventListener('touchstart', onTouchStart);
            container.removeEventListener('touchmove', onTouchMove);
            container.removeEventListener('touchend', onTouchEnd);
            container.removeEventListener('touchcancel', onTouchEnd);
        };
    }, [storeContainerRef.current]);

    return (
        <div className="flex-grow p-5 space-y-9 bg-white">

            {/* 인사 히어로 */}
            <section className="pt-1">
                <h1 className="font-display display-italic uppercase text-[26px] leading-[0.98] text-ink">
                    오늘의 코트를<br /><span className="text-volt-deep">정복하라</span>
                </h1>
                <p className="text-sm text-zinc-500 font-bold mt-2">지금 뛸 수 있는 경기, 콕스타가 다 모았다.</p>
            </section>

            {/* 메인 배너 */}
            <MainBanner />

            {/* 신상 스토어 */}
            <section>
                <SectionHeader title="신상 스토어" sub="Gear Up" onMoreClick={() => setPage('store')} />
                <div
                    ref={storeContainerRef}
                    className="w-full overflow-x-auto hide-scrollbar cursor-grab"
                    style={{ overscrollBehaviorX: 'contain', touchAction: 'pan-x' }}
                    onMouseDown={handleStoreDragStart}
                    onMouseMove={handleStoreDragMove}
                    onMouseUp={handleStoreDragEnd}
                    onMouseLeave={handleStoreDragEnd}
                >
                    <div ref={scrollContentRef} className="flex">
                        {loading ? (
                            [...Array(4)].map((_, i) => <SkeletonStoreCard key={i} />)
                        ) : (
                            doubledStoreItems.map((item, index) => (
                                <StoreCard
                                    key={index}
                                    title={item.title}
                                    brand={item.brand}
                                    image={item.image}
                                />
                            ))
                        )}
                        <div className="flex-shrink-0 w-1 h-1"></div>
                    </div>
                </div>
            </section>

            {/* 지금 뜨는 경기 */}
            <section>
                <SectionHeader title="지금 뜨는 경기" sub="Live Now" onMoreClick={() => setPage('game')} />
                <div className="space-y-3">
                    {loading ? (
                        <>
                            <SkeletonCard />
                            <SkeletonCard />
                        </>
                    ) : (
                        <>
                            <GameCard
                                title="오산시 저녁 8시 · 초심 환영"
                                tags={[{label: '초심'}, {label: '오산시'}]}
                                location="OO 체육관"
                                current={8}
                                total={12}
                                onClick={() => setPage('game')}
                            />
                            <GameCard
                                title="수원시 주말 40대 A조 모임"
                                tags={[{label: 'A조'}, {label: '수원시'}, {label: '40대'}]}
                                location="XX 체육관"
                                current={10}
                                total={16}
                                onClick={() => setPage('game')}
                            />
                        </>
                    )}
                </div>
            </section>

            {/* 커뮤니티 인기글 */}
            <section>
                <SectionHeader title="커뮤니티 인기글" sub="Talk" onMoreClick={() => setPage('community')} />
                <div className="space-y-2.5">
                    {loading ? (
                         <>
                            <SkeletonCard />
                            <SkeletonCard />
                            <SkeletonCard />
                        </>
                    ) : (
                        <>
                            <CommunityPost category="Q&A" title="이 라켓 써보신 분 후기 있으신가요?" likes={12} onClick={() => setPage('community')} />
                            <CommunityPost category="자유글" title="C조 탈출하는 법.txt 공유합니다" likes={8} onClick={() => setPage('community')} />
                            <CommunityPost category="중고" title="[판매] 빅터 제트스피드 S12 팝니다" likes={5} onClick={() => setPage('community')} />
                        </>
                    )}
                </div>
            </section>

        </div>
    );
}

// ===================================================================================
// 경기 로비 페이지
// ===================================================================================
function GamePage({ user, userData, onLoginClick, sharedRoomId }) {
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
        if (!user || currentView !== 'lobby') {
            return;
        }
        setLoadingRooms(true);
        const q = query(roomsCollectionRef);

        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const roomsData = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

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
                name: updatedData.name,
                location: updatedData.location,
                address: updatedData.address,
                coords: updatedData.coords,
                description: updatedData.description,
                password: updatedData.password,
                admins: updatedData.admins
            });
            alert("방 정보가 수정되었습니다.");
            setIsEditModalOpen(false);
            setEditRoomData(null);
        } catch (e) {
            alert("수정 실패: " + e.message);
        }
    };

    const handleDeleteRoom = async () => {
        if (!editRoomData) return;
        if (!confirm("정말로 이 방을 삭제하시겠습니까?")) return;
        try {
            await deleteDoc(doc(db, "rooms", editRoomData.id));
            alert("방이 삭제되었습니다.");
            setIsEditModalOpen(false);
            setEditRoomData(null);
        } catch (e) {
            alert("삭제 실패: " + e.message);
        }
    };

    const onEditClick = (room) => {
        setEditRoomData(room);
        setIsEditModalOpen(true);
    };

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
            <div className="relative h-full overflow-hidden">
                <div className="filter blur-md pointer-events-none h-full">
                    <GameRoomView roomId={selectedRoomId} user={null} userData={null} preview={true} />
                </div>
                <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-ink/50 backdrop-blur-[2px]">
                    <div className="bg-white p-8 rounded-[28px] shadow-ink text-center max-w-[80%] animate-scale-in">
                        <div className="w-14 h-14 rounded-2xl bg-ink flex items-center justify-center mx-auto mb-4">
                            <Lock size={26} className="text-volt" />
                        </div>
                        <h2 className="text-lg font-black kern-tight mb-1">경기방 입장</h2>
                        <p className="text-sm text-zinc-500 font-medium mb-6">이 경기방에 참여하려면<br/>로그인이 필요합니다.</p>
                        <button
                            onClick={onLoginClick}
                            className="w-full py-4 bg-volt text-ink font-black rounded-full shadow-volt"
                        >
                            로그인하고 입장하기
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (!user && !selectedRoomId) {
        return <LoginRequiredPage icon={ShieldCheck} title="로그인이 필요합니다" description="경기 시스템은 로그인 후 이용할 수 있습니다." onLoginClick={onLoginClick} />;
    }

    if (currentView === 'room') {
        return <GameRoomView roomId={selectedRoomId} user={user} userData={userData} onExitRoom={() => { setSelectedRoomId(null); setCurrentView('lobby'); }} roomsCollectionRef={roomsCollectionRef} />;
    }

    return (
        <div className="relative h-full flex flex-col bg-zinc-50">
            {/* 로비 헤더 */}
            <div className="px-5 pt-4 pb-3 bg-white border-b border-zinc-100">
                <div className="flex items-baseline justify-between mb-3">
                    <div>
                        <span className="text-[11px] font-black uppercase tracking-[0.2em] text-volt-deep">Matches</span>
                        <h1 className="text-2xl font-black kern-tight leading-none mt-0.5">경기방</h1>
                    </div>
                    <span className="text-xs font-black text-zinc-400 tabular">{filteredRooms.length} OPEN</span>
                </div>
                <div className="relative">
                    <input type="text" placeholder="경기방 이름 또는 장소 검색" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full p-3.5 pl-11 bg-zinc-100 rounded-2xl text-sm font-bold border-2 border-transparent focus:border-ink outline-none placeholder-zinc-400" />
                    <Search size={20} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                </div>
            </div>

            <main className="flex-grow overflow-y-auto p-4 space-y-3 hide-scrollbar">
                {loadingRooms ? (
                    <><SkeletonRoomCard /><SkeletonRoomCard /><SkeletonRoomCard /></>
                ) : filteredRooms.length > 0 ? (
                    filteredRooms.map(room => (
                        <RoomCard
                            key={room.id}
                            room={room}
                            user={user}
                            onEnter={() => handleEnterRoom(room.id)}
                            onEdit={onEditClick}
                        />
                    ))
                ) : (
                    <EmptyState icon={Archive} title="개설된 경기방이 없습니다" description={searchTerm ? "검색 결과가 없습니다." : "첫 번째 경기방을 만들어보세요!"} buttonText={searchTerm ? null : "경기방 만들기"} onButtonClick={searchTerm ? null : () => setShowCreateRoomModal(true)} />
                )}
            </main>

            {/* 생성 FAB */}
            <button onClick={() => setShowCreateRoomModal(true)} className="absolute bottom-6 right-6 bg-volt text-ink h-14 pl-4 pr-5 rounded-full shadow-volt flex items-center gap-1.5 transition-transform active:scale-90 font-black">
                <Plus size={22} strokeWidth={2.6} /> 개설
            </button>

            <CreateRoomModal isOpen={showCreateRoomModal} onClose={() => setShowCreateRoomModal(false)} onSubmit={handleCreateRoom} user={user} userData={userData} />

            <EditRoomInfoModal
                isOpen={isEditModalOpen}
                onClose={() => { setIsEditModalOpen(false); setEditRoomData(null); }}
                roomData={editRoomData}
                onSave={handleUpdateRoom}
                onDelete={handleDeleteRoom}
            />
        </div>
    );
}

// 로비 카드
function RoomCard({ room, onEnter, onEdit, user }) {
    const isAdmin = user && (
        isSuperAdmin(user) ||
        user.uid === room.adminUid ||
        (room.admins && room.admins.some(admin =>
            admin === user.email ||
            admin === user.uid ||
            (user.email && admin === user.email.split('@')[0])
        ))
    );
    return (
        <div
            className="bg-white rounded-2xl border border-zinc-100 shadow-card p-5 cursor-pointer transition-all hover:border-ink/20 active:scale-[0.98] relative group overflow-hidden"
            onClick={onEnter}
        >
            {/* 좌측 볼트 엣지 */}
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-volt" />
            <div className="flex justify-between items-start mb-2 pl-1">
                <div className="flex items-center gap-2 overflow-hidden">
                    <h3 className="text-base font-black text-ink kern-tight truncate">{room.name}</h3>
                    {room.password && (
                        <Lock size={14} className="text-zinc-400 flex-shrink-0" />
                    )}
                </div>

                {isAdmin && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onEdit(room);
                        }}
                        className="p-2 -mr-2 -mt-2 text-zinc-300 hover:text-ink rounded-full transition-colors z-10"
                    >
                        <Edit3Icon size={16} />
                    </button>
                )}
            </div>

            <p className="text-xs text-zinc-500 mb-4 truncate font-bold pl-1">
                <MapPin size={13} className="inline mr-1 -mt-0.5" />
                {room.location}
            </p>

            <div className="flex flex-wrap gap-2 items-center pl-1">
                <span className="flex items-center gap-1.5 px-3 py-1.5 bg-ink text-white rounded-full text-[11px] font-black uppercase tracking-tight">
                    <BarChart2 size={13} className="text-volt" />
                    {room.levelLimit === 'N조' ? '전체 급수' : `${room.levelLimit} 이상`}
                </span>
                <span className="flex items-center gap-1 px-3 py-1.5 bg-zinc-100 text-zinc-500 rounded-full text-[11px] font-black">
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
        } else {
            setTime('00:00');
        }
    }, [startTime]);

    return (
        <div className="text-xs font-black tabular text-volt bg-ink px-2.5 py-1 rounded-md flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-volt animate-pulse"></span>
            {time}
        </div>
    );
};

const PlayerCard = React.memo(({
    player,
    isAdmin,
    isCurrentUser,
    isPlaying,
    isResting,
    isSelected,
    onCardClick,
    onDeleteClick,
    onLongPress,
    onDragStart,
    onDragEnd,
    onDragOver,
    onDrop
}) => {
    const longPressTimer = useRef(null);
    const isLongPressExecuted = useRef(false);

    const startPress = () => {
        if (!isAdmin || !onLongPress) return;

        isLongPressExecuted.current = false;
        longPressTimer.current = setTimeout(() => {
            isLongPressExecuted.current = true;
            onLongPress(player);
        }, 800);
    };

    const endPress = () => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }
    };

    const handleClick = (e) => {
        if (isLongPressExecuted.current) {
            isLongPressExecuted.current = false;
            return;
        }
        if (onCardClick) onCardClick(player);
    };

    if (!player) return <div className="h-[52px] bg-zinc-100 rounded-lg animate-pulse"></div>;

    const levelColorClass = getLevelColor(player.level);
    const genderBorder = player.gender === '남' ? 'border-l-blue-500' : 'border-l-pink-500';

    let containerClass = `relative bg-white rounded-lg px-2 py-1 h-[52px] flex flex-col justify-center border border-zinc-100 border-l-[3px] transition-all duration-200 cursor-pointer active:scale-95 ${genderBorder} select-none `;

    if (isPlaying) containerClass += " opacity-45 grayscale ";
    if (isResting) containerClass += " opacity-40 bg-zinc-100 grayscale ";

    if (isSelected) {
        containerClass += " ring-2 ring-volt ring-offset-1 scale-105 z-10 shadow-volt ";
    } else if (isCurrentUser) {
        containerClass += " ring-2 ring-ink ring-offset-1 ";
    }

    const canDrag = isAdmin && typeof onDragStart === 'function';

    return (
        <div
            className={containerClass}
            onMouseDown={startPress}
            onMouseUp={endPress}
            onMouseLeave={endPress}
            onTouchStart={startPress}
            onTouchEnd={endPress}
            onClick={handleClick}

            draggable={canDrag}
            onDragStart={canDrag ? (e) => onDragStart(e, player.id) : undefined}
            onDragEnd={canDrag ? onDragEnd : undefined}
            onDragOver={canDrag ? onDragOver : undefined}
            onDrop={canDrag ? (e) => onDrop(e, { type: 'player', player: player }) : undefined}
        >
            <div className="flex justify-between items-start pointer-events-none mb-0.5">
                <span className="text-xs font-black text-ink truncate w-full pr-1 leading-none">
                    {player.name}
                </span>
                {isAdmin && (
                    <button
                        className="pointer-events-auto absolute -top-1.5 -right-1.5 bg-ink text-white hover:bg-red-500 rounded-full shadow p-0.5 transition-colors z-20"
                        onClick={(e) => {
                            e.stopPropagation();
                            onDeleteClick && onDeleteClick(player);
                        }}
                    >
                        <XIcon size={10} strokeWidth={3} />
                    </button>
                )}
            </div>

            <div className="flex justify-between items-center pointer-events-none">
                <span className={`text-[10px] font-black ${levelColorClass.replace('border-', 'text-')}`}>
                    {player.level || 'N'}
                </span>
                <span className="text-[10px] text-zinc-400 font-black tabular">
                    {player.todayGames || 0}G
                </span>
            </div>
        </div>
    );
});

const LeftPlayerCard = ({ onClick, isAdmin }) => (
    <div className="h-[52px] bg-red-50 rounded-lg flex flex-col items-center justify-center border-2 border-dashed border-red-300 relative select-none">
        <span className="text-[10px] font-black text-red-500 leading-tight">나간 선수</span>

        {isAdmin && onClick && (
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    onClick();
                }}
                className="absolute -top-1.5 -right-1.5 bg-red-500 text-white hover:bg-red-600 rounded-full shadow p-0.5 z-20"
            >
                <XIcon size={10} strokeWidth={3} />
            </button>
        )}
    </div>
);

const EmptySlot = ({ onSlotClick, onDragOver, onDrop, isDragOver }) => (
    <div
        onClick={onSlotClick}
        onDragOver={onDragOver}
        onDrop={onDrop}
        className={`h-[52px] rounded-lg flex items-center justify-center border-2 border-dashed transition-all cursor-pointer ${
            isDragOver
            ? 'bg-volt/10 border-volt text-volt-deep'
            : 'bg-zinc-50 border-zinc-200 text-zinc-300 hover:border-ink hover:text-ink'
        }`}
    >
        <Plus size={18} strokeWidth={3} />
    </div>
);

// 방 정보 수정 모달
function EditRoomInfoModal({ isOpen, onClose, roomData, onSave, onDelete }) {
    const [formData, setFormData] = useState({
        name: '',
        location: '',
        address: '',
        coords: null,
        description: '',
        maxPlayers: 20,
        levelLimit: 'N조',
        password: '',
        admins: []
    });

    const [usePassword, setUsePassword] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    useEffect(() => {
        if (isOpen && roomData) {
            setFormData({
                name: roomData.name || '',
                location: roomData.location || '',
                address: roomData.address || '',
                coords: roomData.coords || null,
                description: roomData.description || '',
                maxPlayers: roomData.maxPlayers || 20,
                levelLimit: roomData.levelLimit || 'N조',
                password: roomData.password || '',
                admins: roomData.admins || []
            });
            setUsePassword(!!roomData.password);
        }
    }, [isOpen, roomData]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleAddressSearch = () => {
        if (!window.daum || !window.daum.Postcode) {
            alert("주소 검색 서비스를 불러오는데 실패했습니다.");
            return;
        }

        new window.daum.Postcode({
            oncomplete: function(data) {
                const addr = data.roadAddress || data.jibunAddress;
                const buildingName = data.buildingName || '';

                setFormData(prev => ({
                    ...prev,
                    address: addr,
                    location: (!prev.location && buildingName) ? buildingName : prev.location
                }));

                if (window.kakao && window.kakao.maps) {
                    window.kakao.maps.load(() => {
                        if (window.kakao.maps.services) {
                            const geocoder = new window.kakao.maps.services.Geocoder();
                            geocoder.addressSearch(addr, (result, status) => {
                                if (status === window.kakao.maps.services.Status.OK) {
                                    const lat = parseFloat(result[0].y);
                                    const lng = parseFloat(result[0].x);
                                    setFormData(prev => ({ ...prev, coords: { lat, lng } }));
                                    console.log("좌표 수정 완료:", lat, lng);
                                } else {
                                    alert("주소는 찾았으나 좌표를 가져올 수 없습니다.");
                                }
                            });
                        } else {
                            alert("카카오맵 서비스 모듈을 사용할 수 없습니다.");
                        }
                    });
                }
            }
        }).open();
    };

    const handleAdminChange = (index, value) => {
        const newAdmins = [...formData.admins];
        newAdmins[index] = value;
        setFormData(prev => ({ ...prev, admins: newAdmins }));
    };
    const addAdminSlot = () => setFormData(prev => ({ ...prev, admins: [...prev.admins, ''] }));
    const removeAdminSlot = (index) => setFormData(prev => ({ ...prev, admins: prev.admins.filter((_, i) => i !== index) }));

    const handleSubmit = () => {
        if (!formData.address || !formData.coords) {
            alert("장소를 검색하여 유효한 주소를 입력해주세요.");
            return;
        }

        const cleanAdmins = formData.admins.map(a => a.trim()).filter(Boolean);

        onSave({
            ...formData,
            admins: cleanAdmins,
            password: usePassword ? formData.password : ''
        });
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 backdrop-blur-md">
            <div className="bg-white rounded-t-[32px] sm:rounded-[28px] p-6 w-full max-w-lg shadow-ink max-h-[92vh] overflow-y-auto hide-scrollbar animate-slide-up sm:animate-scale-in">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-black kern-tight">방 정보 수정</h3>
                    <button onClick={onClose} className="w-9 h-9 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-500"><X size={20}/></button>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className={LABEL_CLS}>방 제목</label>
                        <input type="text" name="name" value={formData.name} onChange={handleChange} className={FIELD_CLS}/>
                    </div>

                    <div>
                        <label className={LABEL_CLS}>장소 (주소 검색)</label>
                        <div className="flex gap-2 mb-2">
                            <input
                                type="text"
                                placeholder="터치해서 주소 수정..."
                                value={formData.address}
                                readOnly
                                onClick={handleAddressSearch}
                                className={`${FIELD_CLS} cursor-pointer text-sm truncate`}
                            />
                            <button
                                type="button"
                                onClick={handleAddressSearch}
                                className="bg-ink text-white px-4 rounded-xl font-black text-sm shrink-0"
                            >
                                검색
                            </button>
                        </div>
                        <input
                            type="text"
                            name="location"
                            placeholder="장소명 (예: 콕스타 체육관)"
                            value={formData.location}
                            onChange={handleChange}
                            className="w-full p-3 bg-zinc-100 rounded-xl border-2 border-transparent focus:border-ink outline-none text-sm font-bold"
                        />
                        {formData.coords && <p className="text-xs text-volt-deep font-black mt-1 ml-1">✅ 위치 좌표 확인됨</p>}
                    </div>

                    <div>
                        <label className={LABEL_CLS}>모임 소개</label>
                        <textarea name="description" value={formData.description} onChange={handleChange} rows={3} className={`${FIELD_CLS} resize-none`}/>
                    </div>

                    <div className="flex gap-4">
                        <div className="flex-1">
                            <label className={LABEL_CLS}>입장 급수</label>
                            <select
                                name="levelLimit"
                                value={formData.levelLimit}
                                onChange={handleChange}
                                className={FIELD_CLS}
                            >
                                {['N조','S조','A조','B조','C조','D조','E조'].map(l => (
                                    <option key={l} value={l}>{l === 'N조' ? '전체 급수' : `${l} 이상`}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex-1">
                            <label className={LABEL_CLS}>최대 인원</label>
                            <input
                                type="number"
                                name="maxPlayers"
                                value={formData.maxPlayers}
                                onChange={handleChange}
                                min="4"
                                className={FIELD_CLS}
                            />
                        </div>
                    </div>

                    <div className="bg-zinc-50 p-4 rounded-2xl border border-zinc-100">
                        <label className="block text-[11px] font-black uppercase tracking-wider text-zinc-500 mb-2">공동 관리자 (이메일/아이디)</label>
                        {formData.admins.map((adminEmail, idx) => (
                            <div key={idx} className="flex gap-2 mb-2">
                                <input
                                    type="text"
                                    value={adminEmail}
                                    onChange={(e) => handleAdminChange(idx, e.target.value)}
                                    placeholder="user@example.com"
                                    className="flex-1 p-2.5 bg-white rounded-lg border border-zinc-200 text-sm font-bold focus:border-ink outline-none"
                                />
                                <button onClick={() => removeAdminSlot(idx)} className="text-red-400 hover:text-red-600"><X size={18}/></button>
                            </div>
                        ))}
                        <button onClick={addAdminSlot} className="text-sm text-ink font-black hover:underline">+ 관리자 추가</button>
                    </div>

                    <div className="bg-zinc-50 p-4 rounded-2xl border border-zinc-100">
                        <label className="flex items-center gap-2 mb-2">
                            <input type="checkbox" checked={usePassword} onChange={(e) => setUsePassword(e.target.checked)} className="rounded accent-ink"/>
                            <span className="text-sm font-black text-ink">비밀번호 사용</span>
                        </label>
                        {usePassword && (
                            <div className="relative">
                                <input type={showPassword ? "text" : "password"} name="password" value={formData.password} onChange={handleChange} className="w-full p-2.5 bg-white rounded-lg border border-zinc-200 text-sm font-bold focus:border-ink outline-none"/>
                                <button onClick={() => setShowPassword(!showPassword)} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 text-xs font-bold">{showPassword ? '숨기기' : '보기'}</button>
                            </div>
                        )}
                    </div>

                    <button onClick={handleSubmit} className="w-full py-4 bg-volt text-ink font-black rounded-full shadow-volt uppercase tracking-wide">
                        저장하기
                    </button>

                    {onDelete && (
                         <button onClick={onDelete} className="w-full py-3.5 mt-1 bg-red-50 text-red-500 font-black rounded-full hover:bg-red-100 transition-colors">
                            방 삭제 (관리자 전용)
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

// 게임 수 수정 모달
function EditGamesModal({ isOpen, onClose, player, onSave }) {
    const [games, setGames] = useState(0);

    useEffect(() => {
        if (isOpen && player) {
            setGames(player.todayGames || 0);
        }
    }, [isOpen, player]);

    if (!isOpen || !player) return null;

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-md">
            <div className="bg-white rounded-[28px] p-6 w-full max-w-sm shadow-ink animate-scale-in">
                <div className="text-center mb-6">
                    <h3 className="text-lg font-black text-ink kern-tight mb-0.5">{player.name}</h3>
                    <p className="text-[11px] text-zinc-400 font-bold uppercase tracking-wider">경기 수 · 히스토리</p>
                </div>

                <div className="flex items-center justify-center gap-6 mb-8 bg-zinc-50 py-5 rounded-2xl">
                    <button
                        onClick={() => setGames(g => Math.max(0, g - 1))}
                        className="w-11 h-11 rounded-full bg-white border border-zinc-200 text-ink font-black text-xl active:scale-90 transition-transform"
                    >
                        −
                    </button>
                    <span className="text-4xl font-black text-ink w-14 tabular text-center">{games}</span>
                    <button
                        onClick={() => setGames(g => g + 1)}
                        className="w-11 h-11 rounded-full bg-ink text-volt font-black text-xl active:scale-90 transition-transform"
                    >
                        +
                    </button>
                </div>

                <div className="mb-6">
                    <h4 className="text-[11px] font-black uppercase tracking-wider text-zinc-500 mb-3 text-left pl-1">오늘 함께한 선수들</h4>
                    <div className="space-y-2 max-h-40 overflow-y-auto hide-scrollbar">
                        {player.matchHistory && player.matchHistory.length > 0 ? (
                            player.matchHistory.map((historyStr, idx) => (
                                <div key={idx} className="bg-zinc-50 p-2.5 rounded-xl border border-zinc-100 flex items-start gap-3">
                                    <span className="text-[10px] font-black text-volt-deep pt-1 shrink-0">
                                        {player.matchHistory.length - idx}.
                                    </span>
                                    <div className="flex flex-wrap gap-1">
                                        {historyStr.split(', ').map((name, nIdx) => (
                                            <span
                                                key={nIdx}
                                                className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold ${
                                                    name.includes(player.name)
                                                    ? 'bg-ink text-volt'
                                                    : 'bg-white text-zinc-600 border border-zinc-100'
                                                }`}
                                            >
                                                {name}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-[11px] text-zinc-400 py-6 text-center border-2 border-dashed border-zinc-100 rounded-xl font-bold">
                                아직 경기 기록이 없습니다.
                            </p>
                        )}
                    </div>
                </div>

                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 py-3.5 bg-zinc-100 text-zinc-500 font-black rounded-full text-sm">취소</button>
                    <button onClick={() => onSave(player.id, games)} className="flex-1 py-3.5 bg-volt text-ink font-black rounded-full text-sm shadow-volt">저장</button>
                </div>
            </div>
        </div>
    );
}

// 환경 설정 모달
function SettingsModal({ isOpen, onClose, roomData, onSave, onReset, onKickAll }) {
    const [settings, setSettings] = useState({
        mode: 'admin',
        numScheduledMatches: 4,
        numInProgressCourts: 2
    });

    useEffect(() => {
        if (roomData) {
            setSettings({
                mode: roomData.mode || 'admin',
                numScheduledMatches: roomData.numScheduledMatches || 4,
                numInProgressCourts: roomData.numInProgressCourts || 2
            });
        }
    }, [roomData]);

    if (!isOpen) return null;

    const handleSave = () => {
        onSave(settings);
        onClose();
    };

    const adjustCount = (field, delta) => {
        setSettings(prev => ({
            ...prev,
            [field]: Math.max(1, prev[field] + delta)
        }));
    };

    const Stepper = ({ label, field }) => (
        <div>
            <label className="text-[11px] font-black uppercase tracking-wider text-zinc-500 mb-2 block text-center">{label}</label>
            <div className="flex items-center justify-center gap-3">
                <button onClick={() => adjustCount(field, -1)} className="w-9 h-9 rounded-full bg-zinc-100 text-ink font-black active:scale-90 transition-transform">−</button>
                <span className="text-xl font-black w-5 text-center tabular">{settings[field]}</span>
                <button onClick={() => adjustCount(field, 1)} className="w-9 h-9 rounded-full bg-ink text-volt font-black active:scale-90 transition-transform">+</button>
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-md">
            <div className="bg-white rounded-[28px] p-6 w-full max-w-sm shadow-ink animate-scale-in">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-black kern-tight">환경 설정</h3>
                    <button onClick={onClose} className="w-9 h-9 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-500"><XIcon size={20}/></button>
                </div>

                <div className="space-y-6">
                    <div>
                        <label className="text-[11px] font-black uppercase tracking-wider text-zinc-500 mb-2 block">운영 모드</label>
                        <div className="flex bg-zinc-100 rounded-xl p-1">
                            {['admin', 'personal'].map(mode => (
                                <button
                                    key={mode}
                                    onClick={() => setSettings(s => ({ ...s, mode }))}
                                    className={`flex-1 py-2.5 text-sm font-black rounded-lg transition-all ${
                                        settings.mode === mode
                                        ? 'bg-ink text-volt shadow'
                                        : 'text-zinc-400'
                                    }`}
                                >
                                    {mode === 'admin' ? '👑 관리자' : '🏃 개인'}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <Stepper label="경기 예정 수" field="numScheduledMatches" />
                        <Stepper label="코트 수" field="numInProgressCourts" />
                    </div>

                    <div>
                        <label className="text-[11px] font-black uppercase tracking-wider text-zinc-500 mb-2 block">고급 기능</label>
                        <div className="space-y-2">
                            <button onClick={onReset} className="w-full py-3 bg-red-50 text-red-500 font-black rounded-xl text-sm hover:bg-red-100 transition-colors flex justify-center items-center gap-2">
                                <ArchiveIcon size={16}/> 시스템 초기화 (경기 삭제)
                            </button>
                            <button onClick={onKickAll} className="w-full py-3 bg-zinc-100 text-zinc-600 font-black rounded-xl text-sm hover:bg-zinc-200 transition-colors flex justify-center items-center gap-2">
                                <UsersIcon size={16}/> 모든 선수 내보내기
                            </button>
                        </div>
                    </div>

                    <button onClick={handleSave} className="w-full py-4 bg-volt text-ink font-black rounded-full text-base shadow-volt uppercase tracking-wide">
                        설정 저장
                    </button>
                </div>
            </div>
        </div>
    );
}

// 프로필 수정 모달
function EditProfileModal({ isOpen, onClose, userData, user }) {
    const [formData, setFormData] = useState({
        name: '',
        level: 'N조',
        gender: '남',
        birthYear: '2000',
        region: '서울',
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    useEffect(() => {
        if (isOpen && userData) {
            setFormData(prev => ({
                ...prev,
                name: userData.name || '',
                level: userData.level || 'N조',
                gender: userData.gender || '남',
                birthYear: userData.birthYear || '2000',
                currentPassword: '',
                newPassword: '',
                confirmPassword: ''
            }));
        }
    }, [isOpen, userData]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

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
            await updateDoc(userRef, {
                name: formData.name,
                level: formData.level,
                gender: formData.gender,
                birthYear: formData.birthYear
            });

            if (user.displayName !== formData.name) {
                await updateProfile(user, { displayName: formData.name });
            }

            alert("프로필이 성공적으로 수정되었습니다.");
            onClose();
        } catch (err) {
            console.error(err);
            if (err.code === 'auth/wrong-password') {
                setError('현재 비밀번호가 올바르지 않습니다.');
            } else {
                setError(err.message || "프로필 수정 중 오류가 발생했습니다.");
            }
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const currentYear = new Date().getFullYear();
    const birthYears = Array.from({ length: 70 }, (_, i) => currentYear - i - 10);

    return (
        <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 backdrop-blur-md">
            <div className="bg-white rounded-t-[32px] sm:rounded-[28px] p-6 w-full max-w-md shadow-ink max-h-[92vh] overflow-y-auto hide-scrollbar animate-slide-up sm:animate-scale-in">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-black kern-tight">프로필 수정</h3>
                    <button onClick={onClose} className="w-9 h-9 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-500">
                        <X size={20} />
                    </button>
                </div>

                {error && <div className="bg-red-50 text-red-500 text-sm p-3 rounded-xl mb-4 text-center font-bold">{error}</div>}

                <form onSubmit={handleSave} className="space-y-4">
                    <div>
                        <label className={LABEL_CLS}>이름</label>
                        <input
                            type="text" name="name" value={formData.name} onChange={handleChange}
                            className={FIELD_CLS}
                        />
                    </div>

                    <div className="flex gap-3">
                        <div className="flex-1">
                            <label className={LABEL_CLS}>급수</label>
                            <select name="level" value={formData.level} onChange={handleChange}
                                className={FIELD_CLS}
                            >
                                {['S조', 'A조', 'B조', 'C조', 'D조', 'E조', 'N조'].map(l => (
                                    <option key={l} value={l}>{l}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex-1">
                            <label className={LABEL_CLS}>성별</label>
                            <div className="flex bg-zinc-100 p-1 rounded-xl">
                                {['남', '여'].map(g => (
                                    <button
                                        key={g} type="button"
                                        onClick={() => setFormData(prev => ({...prev, gender: g}))}
                                        className={`flex-1 py-2.5 rounded-lg text-sm font-black transition-all ${formData.gender === g ? 'bg-ink text-volt shadow' : 'text-zinc-400'}`}
                                    >
                                        {g}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className={LABEL_CLS}>출생년도</label>
                        <select name="birthYear" value={formData.birthYear} onChange={handleChange}
                            className={FIELD_CLS}
                        >
                            {birthYears.map(year => (
                                <option key={year} value={year}>{year}년생</option>
                            ))}
                        </select>
                    </div>

                    {!isKakaoUser && (
                        <div className="pt-4 border-t border-zinc-100">
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-[11px] font-black uppercase tracking-wider text-zinc-500">비밀번호 변경</label>
                                <button type="button" onClick={() => setShowPassword(!showPassword)} className="text-xs text-zinc-400 hover:text-ink font-bold">
                                    {showPassword ? '숨기기' : '보이기'}
                                </button>
                            </div>
                            <div className="space-y-3 bg-zinc-50 p-4 rounded-2xl border border-zinc-100">
                                <input
                                    type={showPassword ? "text" : "password"} name="currentPassword"
                                    placeholder="현재 비밀번호 (변경 시 필수)"
                                    value={formData.currentPassword} onChange={handleChange}
                                    className="w-full p-3 bg-white border border-zinc-200 rounded-lg focus:border-ink outline-none text-sm font-bold"
                                />
                                <input
                                    type={showPassword ? "text" : "password"} name="newPassword"
                                    placeholder="새 비밀번호 (6자 이상)"
                                    value={formData.newPassword} onChange={handleChange}
                                    className="w-full p-3 bg-white border border-zinc-200 rounded-lg focus:border-ink outline-none text-sm font-bold"
                                />
                                <input
                                    type={showPassword ? "text" : "password"} name="confirmPassword"
                                    placeholder="새 비밀번호 확인"
                                    value={formData.confirmPassword} onChange={handleChange}
                                    className="w-full p-3 bg-white border border-zinc-200 rounded-lg focus:border-ink outline-none text-sm font-bold"
                                />
                            </div>
                        </div>
                    )}

                    <button
                        type="submit" disabled={loading}
                        className="w-full py-4 bg-volt text-ink font-black rounded-full shadow-volt disabled:bg-zinc-300 mt-2 uppercase tracking-wide"
                    >
                        {loading ? <Loader2 className="animate-spin mx-auto"/> : '저장하기'}
                    </button>
                </form>
            </div>
        </div>
    );
}

// 최초 회원가입 프로필 설정 모달
function InitialProfileModal({ isOpen, user }) {
    const [formData, setFormData] = useState({
        name: '',
        level: 'N조',
        gender: '남',
        birthYear: '2000',
        region: '서울'
    });
    const [loading, setLoading] = useState(false);

    const handleSave = async (e) => {
        e.preventDefault();
        if (!formData.name.trim()) return alert("이름(실명)을 입력해주세요.");
        setLoading(true);
        try {
            const now = new Date();
            if (now.getHours() < 2) now.setDate(now.getDate() - 1);
            const dateStr = now.toISOString().split('T')[0];

            await setDoc(doc(db, "users", user.uid), {
                ...formData,
                email: user.email,
                todayGames: 0,
                lastResetDate: dateStr,
                createdAt: serverTimestamp()
            });
            await updateProfile(user, { displayName: formData.name });
            alert("환영합니다! 프로필 설정이 완료되었습니다.");
        } catch (err) {
            console.error(err);
            alert("저장 중 오류가 발생했습니다.");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const regions = ['서울', '경기', '인천', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'];

    return (
        <div className="fixed inset-0 bg-ink/90 backdrop-blur-md z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-white rounded-t-[32px] sm:rounded-[28px] p-8 w-full max-w-md shadow-ink max-h-[94vh] overflow-y-auto hide-scrollbar animate-slide-up sm:animate-scale-in">
                <div className="mb-8">
                    <span className="text-[11px] font-black uppercase tracking-[0.3em] text-volt-deep">Almost There</span>
                    <h2 className="text-2xl font-black kern-tight mt-1">선수 프로필 완성</h2>
                    <p className="text-zinc-500 font-bold text-sm mt-1">코트에 서기 전, 딱 한 걸음 남았어요.</p>
                </div>
                <form onSubmit={handleSave} className="space-y-5">
                    <div>
                        <label className={LABEL_CLS}>이름(실명) <span className="text-volt-deep">*</span></label>
                        <input type="text" placeholder="본명을 입력해주세요" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className={FIELD_CLS} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={LABEL_CLS}>급수</label>
                            <select value={formData.level} onChange={e => setFormData({...formData, level: e.target.value})} className={FIELD_CLS}>
                                {['S조', 'A조', 'B조', 'C조', 'D조', 'E조', 'N조'].map(l => <option key={l} value={l}>{l}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={LABEL_CLS}>지역</label>
                            <select value={formData.region} onChange={e => setFormData({...formData, region: e.target.value})} className={FIELD_CLS}>
                                {regions.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className={LABEL_CLS}>성별</label>
                        <div className="flex bg-zinc-100 p-1 rounded-xl">
                            {['남', '여'].map(g => (
                                <button key={g} type="button" onClick={() => setFormData({...formData, gender: g})} className={`flex-1 py-3 rounded-lg text-sm font-black transition-all ${formData.gender === g ? 'bg-ink text-volt shadow' : 'text-zinc-400'}`}>{g}</button>
                            ))}
                        </div>
                    </div>
                    <button type="submit" disabled={loading} className="w-full py-5 bg-volt text-ink font-black rounded-full shadow-volt text-base uppercase tracking-wide">
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
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-md">
            <div className="bg-white rounded-[28px] p-6 w-full max-w-sm shadow-ink animate-scale-in">
                <h3 className="text-xl font-black kern-tight text-center">코트 선택</h3>
                <p className="text-zinc-500 text-sm text-center mb-6 font-bold">경기를 시작할 코트를 선택해주세요.</p>
                <div className="space-y-3">
                    {courts.map((courtIdx) => (
                        <button
                            key={courtIdx}
                            onClick={() => onSelect(courtIdx)}
                            className="w-full py-4 bg-zinc-50 hover:bg-ink hover:text-white border border-zinc-100 hover:border-ink rounded-2xl text-lg font-black transition-all duration-200 flex justify-between items-center px-6 group"
                        >
                            <span>🏸 COURT {courtIdx + 1}</span>
                            <ChevronRightIcon className="text-zinc-300 group-hover:text-volt" />
                        </button>
                    ))}
                </div>
                <button onClick={onClose} className="mt-6 w-full py-3 text-zinc-500 font-black hover:bg-zinc-100 rounded-full transition-colors">취소</button>
            </div>
        </div>
    );
}

// PJB Sports 광고 배너 (로컬 이미지)
function GameBanner() {
    const pjbBanner = {
        id: 'pjb-sports-banner',
        imageUrl: noErrorBanner,
        linkUrl: 'https://www.pjbsports.com/'
    };

    return (
        <div className="w-full aspect-[5/1] flex-shrink-0 relative overflow-hidden bg-ink border-b border-zinc-800 z-10">
            <div
                className="w-full h-full cursor-pointer"
                onClick={() => {
                    if (pjbBanner.linkUrl) {
                        window.open(pjbBanner.linkUrl, '_blank');
                    }
                }}
            >
                <img
                    src={pjbBanner.imageUrl}
                    alt="PJB SPORTS 광고 배너"
                    className="w-full h-full object-cover"
                />
            </div>
        </div>
    );
}

// 관리자 시뮬레이션 랩
function TestLabModal({ isOpen, onClose, onCreateBots, isAutoPlay, setIsAutoPlay }) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] p-4 backdrop-blur-md">
            <div className="bg-white rounded-[28px] p-6 w-full max-w-sm shadow-ink animate-scale-in border-2 border-volt">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-black kern-tight flex items-center gap-2">
                        <FlaskConical size={22} className="text-volt-deep" /> 시뮬레이션 랩
                    </h3>
                    <button onClick={onClose} className="w-9 h-9 rounded-full bg-zinc-100 flex items-center justify-center"><X size={20} className="text-zinc-500" /></button>
                </div>

                <div className="space-y-6">
                    <div className="bg-zinc-50 p-4 rounded-2xl border border-zinc-100">
                        <h4 className="font-black text-sm text-zinc-600 mb-3">🤖 가상 선수(Bot) 투입</h4>
                        <div className="grid grid-cols-2 gap-2">
                            <button onClick={() => onCreateBots(4, '남')} className="py-3 bg-white border-2 border-zinc-200 rounded-xl text-sm font-black hover:border-blue-500 hover:text-blue-500 transition-colors">
                                남성 4명 추가
                            </button>
                            <button onClick={() => onCreateBots(4, '여')} className="py-3 bg-white border-2 border-zinc-200 rounded-xl text-sm font-black hover:border-pink-500 hover:text-pink-500 transition-colors">
                                여성 4명 추가
                            </button>
                        </div>
                        <p className="text-xs text-zinc-400 mt-2 text-center font-medium">* 대기 명단으로 즉시 투입됩니다.</p>
                    </div>

                    <div className="bg-zinc-50 p-4 rounded-2xl border border-zinc-100">
                        <h4 className="font-black text-sm text-zinc-600 mb-3">⚡ 자동 매칭 시뮬레이션</h4>
                        <button
                            onClick={() => setIsAutoPlay(!isAutoPlay)}
                            className={`w-full py-4 rounded-full text-lg font-black transition-all flex items-center justify-center gap-2 ${
                                isAutoPlay
                                ? 'bg-red-500 text-white ring-2 ring-red-200'
                                : 'bg-ink text-volt shadow-volt'
                            }`}
                        >
                            {isAutoPlay ? (
                                <><Loader2 className="animate-spin" /> 시뮬레이션 중지</>
                            ) : (
                                "자동 테스트 시작"
                            )}
                        </button>
                        <p className="text-xs text-zinc-400 mt-2 text-center font-medium">
                            {isAutoPlay ? "봇들이 자동으로 경기를 진행하고 종료합니다." : "버튼을 누르면 봇들이 스스로 움직입니다."}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

function GameRoomView({ roomId, user, userData, onExitRoom, roomsCollectionRef }) {
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
    const [availableCourts, setAvailableCourts] = useState([]);

    const roomDocRef = useMemo(() => doc(db, "rooms", roomId), [roomId]);
    const playersCollectionRef = useMemo(() => collection(db, "rooms", roomId, "players"), [roomId]);

    const isAdmin = useMemo(() => {
        if (!roomData || !user) return false;

        if (isSuperAdmin(user) || user.uid === roomData.adminUid) return true;

        if (!roomData.admins || !Array.isArray(roomData.admins)) return false;

        const userEmail = user.email || "";
        const userId = userEmail.split('@')[0];

        return roomData.admins.some(admin =>
            admin === userEmail ||
            admin === user.uid ||
            (userId && admin === userId)
        );
    }, [user, roomData]);
    const inProgressPlayerIds = useMemo(() =>
        new Set((roomData?.inProgressCourts || []).flatMap(c => c?.players || []).filter(Boolean)),
    [roomData]);

    const scheduledPlayerIds = useMemo(() =>
        new Set(Object.values(roomData?.scheduledMatches || {}).flatMap(m => m || []).filter(Boolean)),
    [roomData]);

    const waitingPlayers = useMemo(() =>
        Object.values(players).filter(p => !inProgressPlayerIds.has(p.id) && !scheduledPlayerIds.has(p.id)),
    [players, inProgressPlayerIds, scheduledPlayerIds]);

    const maleWaiting = useMemo(() => waitingPlayers.filter(p => p.gender === '남'), [waitingPlayers]);
    const femaleWaiting = useMemo(() => waitingPlayers.filter(p => p.gender !== '남'), [waitingPlayers]);

    const handleShare = async () => {
        const shareUrl = `${window.location.origin}?roomId=${roomId}`;
        const shareData = {
            title: `[COCKSTAR] 경기 초대`,
            text: `🏸 '${roomData?.name}' 경기방에 초대합니다!`,
            url: shareUrl,
        };
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

    useEffect(() => {
        if (!user || !userData || !roomData || loading) return;
        const playerRef = doc(db, "rooms", roomId, "players", user.uid);
        const syncJoin = async () => {
            try {
                await runTransaction(db, async (transaction) => {
                    const playerSnap = await transaction.get(playerRef);
                    if (!playerSnap.exists()) {
                        transaction.set(playerRef, {
                            name: userData.name || '선수',
                            level: userData.level || 'N조',
                            gender: userData.gender || '남',
                            birthYear: userData.birthYear || '',
                            region: userData.region || '미설정',
                            entryTime: serverTimestamp(),
                            todayGames: userData.todayGames || 0,
                            isResting: false,
                            role: 'player'
                        });
                    } else {
                        transaction.update(playerRef, {
                            name: userData.name,
                            level: userData.level
                        });
                    }
                });
            } catch (e) { console.error("입장 실패:", e); }
        };
        syncJoin();
    }, [user?.uid, !!userData, !!roomData, loading, roomId]);

    useEffect(() => {
        const unsubPlayers = onSnapshot(playersCollectionRef, async (snapshot) => {
            const playersArray = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            if (isAdmin && roomData) {
                const now = new Date();
                const todayStr = now.toISOString().split('T')[0];

                if (roomData.lastResetDate !== todayStr) {
                    try {
                        const batch = writeBatch(db);
                        playersArray.forEach(p => {
                            batch.update(doc(playersCollectionRef, p.id), {
                                todayGames: 0,
                                matchHistory: []
                            });
                        });
                        batch.update(roomDocRef, { lastResetDate: todayStr });
                        await batch.commit();
                    } catch (e) {
                        console.error("일일 데이터 초기화 실패:", e);
                    }
                }
            }

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
                const targetMatch = fullMatches[0];
                processStartMatch(targetMatch, emptyCourts[0]);
                return;
            }

            if (waitingPlayers.length > 0) {
                let targetMatchIdx = -1;
                let targetSlotIdx = -1;

                for (let m = 0; m < roomData.numScheduledMatches; m++) {
                    const match = roomData.scheduledMatches?.[m] || [null,null,null,null];
                    const emptyIdx = match.indexOf(null);

                    if (emptyIdx !== -1 && match.length >= 4) {
                        targetMatchIdx = m;
                        targetSlotIdx = emptyIdx;
                        break;
                    } else if (match.length < 4) {
                         targetMatchIdx = m;
                         targetSlotIdx = match.length;
                         break;
                    }
                }

                if (targetMatchIdx !== -1 && targetSlotIdx !== -1) {
                    const playerToMove = waitingPlayers[0];
                    handleSwapPlayers([playerToMove.id], null, targetMatchIdx, targetSlotIdx);
                }
            }
        }, 500);

        return () => clearInterval(simulationInterval);
    }, [isAutoPlay, roomData, waitingPlayers, isAdmin]);

    if (loading) return <LoadingSpinner text="ENTERING" />;

    if (roomData?.password && !isAuthorized) {
        return (
            <div className="flex flex-col items-center justify-center h-full bg-white p-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-ink flex items-center justify-center mb-4">
                    <Lock size={28} className="text-volt" />
                </div>
                <h2 className="text-xl font-black kern-tight mb-4">비밀번호가 있는 방입니다</h2>
                <input type="password" value={inputPassword} onChange={(e) => setInputPassword(e.target.value)} className="w-full max-w-xs p-4 bg-zinc-100 border-2 border-transparent focus:border-ink outline-none rounded-2xl mb-4 text-center font-bold" />
                <button onClick={() => inputPassword === roomData.password ? setIsAuthorized(true) : alert('틀렸습니다.')} className="w-full max-w-xs py-4 bg-volt text-ink font-black rounded-full shadow-volt">입장하기</button>
            </div>
        );
    }

    const handleToggleRest = async () => {
        if (!user || !players[user.uid]) return;
        try {
            const playerRef = doc(playersCollectionRef, user.uid);
            await updateDoc(playerRef, {
                isResting: !players[user.uid].isResting
            });
        } catch (e) {
            console.error("휴식 상태 변경 실패:", e);
            alert("상태 변경에 실패했습니다.");
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
                    if (currentTarget !== targetPlayerId) {
                        throw "대상이 이미 다른 곳으로 이동했거나 자리가 변경되었습니다. 다시 시도해주세요.";
                    }
                }

                sourcePlayerIds.forEach(srcId => {
                    Object.keys(schedule).forEach(mKey => {
                        const match = schedule[mKey] || [];
                        const idx = match.indexOf(srcId);
                        if (idx > -1) {
                            const newMatch = [...match];
                            newMatch[idx] = null;
                            schedule[mKey] = newMatch;
                        }
                    });
                });

                let finalMatchIdx = targetMatchIndex;
                let finalSlotIdx = targetSlotIndex;

                if (targetPlayerId) {
                    Object.keys(schedule).forEach(mKey => {
                        const match = schedule[mKey] || [];
                        const idx = match.indexOf(targetPlayerId);
                        if (idx > -1) {
                            finalMatchIdx = parseInt(mKey);
                            finalSlotIdx = idx;
                        }
                    });
                }

                if (finalMatchIdx !== undefined && finalSlotIdx !== undefined) {
                    const playerToMove = sourcePlayerIds[0];

                    if (!schedule[finalMatchIdx]) schedule[finalMatchIdx] = Array(PLAYERS_PER_MATCH).fill(null);

                    if (!targetPlayerId && schedule[finalMatchIdx][finalSlotIdx] !== null) {
                        throw "이미 다른 관리자가 해당 자리에 선수를 배치했습니다.";
                    }

                    schedule[finalMatchIdx][finalSlotIdx] = playerToMove;
                }

                t.update(roomDocRef, { scheduledMatches: schedule });
            });

            setSelectedPlayerIds([]);

        } catch (e) {
            console.error("Transaction failed: ", e);
            const msg = typeof e === 'string' ? e : "작업 중 오류가 발생했습니다. (데이터 충돌)";
            alert(`🚫 작업 실패: ${msg}`);
        }
    };

    const handleCardClick = (player) => {
        if (!isAdmin) return;

        if (selectedPlayerIds.includes(player.id)) {
            setSelectedPlayerIds(prev => prev.filter(id => id !== player.id));
            return;
        }

        const isInGame = Object.values(roomData.scheduledMatches || {}).some(match => match && match.includes(player.id));

        if (selectedPlayerIds.length > 0 && isInGame) {
            if (selectedPlayerIds.length === 1) {
                let tMatchIdx = null;
                let tSlotIdx = null;
                Object.keys(roomData.scheduledMatches || {}).forEach(mKey => {
                    const idx = (roomData.scheduledMatches[mKey] || []).indexOf(player.id);
                    if (idx > -1) {
                        tMatchIdx = parseInt(mKey);
                        tSlotIdx = idx;
                    }
                });

                handleSwapPlayers(selectedPlayerIds, player.id, tMatchIdx, tSlotIdx);
                return;
            } else {
                alert("선수 교체(스왑)는 1명만 선택된 상태에서 가능합니다.");
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

                if (schedule[matchIndex][slotIndex] !== null) {
                     throw "방금 다른 관리자가 이 자리에 선수를 배치했습니다.";
                }

                selectedPlayerIds.forEach(srcId => {
                    Object.keys(schedule).forEach(mKey => {
                        const match = schedule[mKey] || [];
                        const idx = match.indexOf(srcId);
                        if (idx > -1) {
                            const newMatch = [...match];
                            newMatch[idx] = null;
                            schedule[mKey] = newMatch;
                        }
                    });
                });

                let currentSlot = slotIndex;
                let placedCount = 0;

                selectedPlayerIds.forEach(srcId => {
                    while (currentSlot < PLAYERS_PER_MATCH && schedule[matchIndex][currentSlot] !== null) {
                        currentSlot++;
                    }

                    if (currentSlot < PLAYERS_PER_MATCH) {
                        schedule[matchIndex][currentSlot] = srcId;
                        currentSlot++;
                        placedCount++;
                    }
                });

                t.update(roomDocRef, { scheduledMatches: schedule });
            });

            setSelectedPlayerIds([]);

        } catch (e) {
            console.error("Transaction failed: ", e);
            const msg = typeof e === 'string' ? e : "동시 작업 충돌이 발생했습니다. 다시 시도해주세요.";
            alert(`🚫 배치 실패: ${msg}`);
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
        } catch (e) {
            console.error("선수 제거 실패:", e);
        }
    };

    const handleKickPlayer = async (player) => {
        if (!window.confirm(`'${player.name}'님을 내보내시겠습니까?`)) return;
        try {
            await deleteDoc(doc(playersCollectionRef, player.id));
            setSelectedPlayerIds(prev => prev.filter(id => id !== player.id));
        } catch (e) {
            console.error(e);
            alert("삭제 실패");
        }
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
                mode: newSettings.mode,
                numScheduledMatches: newSettings.numScheduledMatches,
                numInProgressCourts: newSettings.numInProgressCourts,
                inProgressCourts: newCourts
            });
        } catch (e) {
            alert("설정 저장 실패: " + e.message);
        }
    };

    const handleRoomInfoSave = async (updatedData) => {
        try {
            await updateDoc(roomDocRef, {
                name: updatedData.name,
                location: updatedData.location,
                address: updatedData.address,
                coords: updatedData.coords,
                description: updatedData.description,
                maxPlayers: parseInt(updatedData.maxPlayers),
                levelLimit: updatedData.levelLimit,
                password: updatedData.password,
                admins: updatedData.admins
            });
            alert("방 정보가 수정되었습니다.");
        } catch (e) {
            console.error(e);
            alert("수정 실패: " + e.message);
        }
    };

    const handleRoomDelete = async () => {
        if (!confirm("정말로 이 방을 삭제하시겠습니까? 되돌릴 수 없습니다.")) return;
        try {
            await deleteDoc(roomDocRef);
            alert("방이 삭제되었습니다.");
            onExitRoom();
        } catch (e) {
            alert("삭제 실패: " + e.message);
        }
    };

    const handleSystemReset = async () => {
        if(!window.confirm("모든 경기 기록을 초기화하시겠습니까? (선수 목록은 유지)")) return;
        await updateDoc(roomDocRef, {
            scheduledMatches: {},
            inProgressCourts: Array(roomData.numInProgressCourts).fill(null)
        });
    };

    const handleKickAll = async () => {
        if(!window.confirm("방에 있는 모든 선수를 내보내시겠습니까?")) return;

        const batch = writeBatch(db);
        Object.keys(players).forEach(pid => {
            batch.delete(doc(playersCollectionRef, pid));
        });

        const emptyCourts = Array(roomData.numInProgressCourts).fill(null);

        await batch.commit();
        await updateDoc(roomDocRef, {
            inProgressCourts: emptyCourts,
            scheduledMatches: {}
        });
    };

    const handleSaveGames = async (playerId, newCount) => {
        try {
            const roomPlayerRef = doc(playersCollectionRef, playerId);

            await updateDoc(roomPlayerRef, {
                todayGames: newCount
            });

            setEditGamePlayer(null);
        } catch (e) {
            console.error("게임 수 수정 실패:", e);
            alert("수정 실패: " + e.message);
        }
    };

    const handleCreateBots = async (count, gender) => {
        if (!isAdmin) return alert("관리자만 가능합니다.");
        try {
            const batch = writeBatch(db);
            for (let i = 0; i < count; i++) {
                const botId = `bot_${Date.now()}_${Math.floor(Math.random()*1000)}`;
                const botRef = doc(playersCollectionRef, botId);
                const randomLevel = ['A조','B조','C조','D조'][Math.floor(Math.random() * 4)];
                batch.set(botRef, {
                    name: `Bot ${Math.floor(Math.random() * 1000)}`,
                    level: randomLevel,
                    gender: gender,
                    isBot: true,
                    entryTime: serverTimestamp(),
                    todayGames: 0,
                    isResting: false,
                    matchHistory: []
                });
            }
            await batch.commit();
        } catch (e) {
            console.error("봇 생성 실패:", e);
            alert("봇 생성 오류");
        }
    };

    const handleStartClick = (matchIndex) => {
        if (!isAdmin) return alert("관리자만 가능합니다.");
        const emptyCourts = [];
        const currentCourts = roomData.inProgressCourts || [];
        for (let i = 0; i < roomData.numInProgressCourts; i++) {
            if (!currentCourts[i]) emptyCourts.push(i);
        }

        if (emptyCourts.length === 0) return alert("빈 코트가 없습니다.");
        if (emptyCourts.length === 1) processStartMatch(matchIndex, emptyCourts[0]);
        else {
            setPendingMatchIndex(matchIndex);
            setAvailableCourts(emptyCourts);
            setCourtModalOpen(true);
        }
    };

    const processStartMatch = async (matchIdx, courtIdx) => {
        try {
            await runTransaction(db, async (t) => {
                const rd = await t.get(roomDocRef);
                if (!rd.exists()) throw "방이 존재하지 않습니다.";
                const data = rd.data();

                const schedule = { ...data.scheduledMatches };
                const matchPlayers = schedule[matchIdx];
                const currentCourts = [...(data.inProgressCourts || [])];

                if (currentCourts[courtIdx] !== null) {
                    throw "이미 다른 관리자가 해당 코트에서 경기를 시작했습니다.";
                }

                if (!matchPlayers || matchPlayers.filter(Boolean).length < 4) {
                    throw "경기 인원이 변경되었거나 이미 시작된 경기입니다.";
                }

                currentCourts[courtIdx] = {
                    players: matchPlayers,
                    startTime: new Date().toISOString()
                };

                const scheduleValues = Object.entries(schedule)
                    .filter(([key]) => parseInt(key) !== matchIdx)
                    .map(([_, value]) => value);

                const reorderedSchedule = {};
                scheduleValues.forEach((val, i) => {
                    reorderedSchedule[i] = val;
                });

                t.update(roomDocRef, {
                    scheduledMatches: reorderedSchedule,
                    inProgressCourts: currentCourts
                });
            });
            setCourtModalOpen(false);
        } catch (e) {
            console.error("경기 시작 실패:", e);
            alert(typeof e === 'string' ? e : "작업 충돌이 발생했습니다.");
        }
    };

    const handleEndMatch = async (courtIdx) => {
        if (!isAdmin || !confirm("경기를 종료하시겠습니까?")) return;
        const court = roomData.inProgressCourts[courtIdx];
        if (!court || !court.players) return;

        try {
            const batch = writeBatch(db);

            const matchMembersString = court.players
                .map(pid => {
                    const p = players[pid];
                    if (!p) return '퇴장한 선수';
                    const levelMark = (p.level && p.level !== '미설정') ? p.level[0] : '';
                    return `${levelMark}${p.isBot ? `[Bot]${p.name}` : p.name}`;
                })
                .join(', ');

            court.players.forEach(pid => {
                const p = players[pid];
                if (pid && p) {
                    const roomPlayerRef = doc(playersCollectionRef, pid);
                    const currentHistory = Array.isArray(p.matchHistory) ? p.matchHistory : [];

                    batch.update(roomPlayerRef, {
                        todayGames: (p.todayGames || 0) + 1,
                        matchHistory: [matchMembersString, ...currentHistory].slice(0, 10)
                    });
                }
            });

            const newCourts = [...roomData.inProgressCourts];
            newCourts[courtIdx] = null;

            await batch.commit();
            await updateDoc(roomDocRef, { inProgressCourts: newCourts });
        } catch (e) {
            console.error("경기 종료 및 히스토리 저장 오류:", e);
            alert("히스토리 저장 중 오류가 발생했습니다. 데이터를 확인해주세요.");
        }
    };

    if (loading) return <LoadingSpinner text="ENTERING" />;
    if (error) return <div className="p-10 text-center">{error}</div>;

    return (
        <div className="flex flex-col h-full bg-zinc-100">
            {/* 헤더 */}
            <header className="flex-shrink-0 h-16 px-3 flex items-center justify-between bg-ink sticky top-0 z-30">
                <div className="flex items-center gap-2 overflow-hidden flex-1 mr-2">
                   <button
                        onClick={() => {
                            if (confirm("방을 나가시겠습니까?")) {
                                onExitRoom();
                            }
                        }}
                        className="p-2 -ml-1 text-zinc-400 hover:text-white transition-colors"
                    >
                        <ArrowLeft size={22}/>
                    </button>

                    <div className="flex flex-col overflow-hidden justify-center">
                        <div className="flex items-center gap-1.5">
                            <h1 className="text-base font-black text-white truncate leading-tight kern-tight">
                                {roomData?.name}
                            </h1>
                            {isAdmin && (
                                <button onClick={() => setIsEditInfoOpen(true)} className="text-zinc-500 hover:text-volt p-0.5">
                                    <Edit3 size={14} />
                                </button>
                            )}
                        </div>
                        <div className="flex items-center text-[11px] text-zinc-400 font-bold leading-none mt-1 space-x-1.5 truncate">
                            <span className="truncate max-w-[90px]">{roomData?.location}</span>
                            <span className="w-1 h-1 bg-zinc-600 rounded-full"></span>
                            <span className="flex items-center gap-1 text-zinc-300">
                                <Users size={12} />
                                {roomData?.playerCount || 0}/{roomData?.maxPlayers}
                            </span>
                            <span className="w-1 h-1 bg-zinc-600 rounded-full"></span>
                            <span className={isAdmin ? "text-volt font-black" : "text-zinc-400"}>
                                {isAdmin ? 'ADMIN' : 'PLAYER'}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                        onClick={handleShare}
                        className="w-9 h-9 flex items-center justify-center rounded-full text-zinc-400 hover:text-volt hover:bg-white/5 transition-all"
                        title="경기방 공유"
                    >
                        <Share2 size={19} />
                    </button>

                    <button
                        onClick={handleToggleRest}
                        className={`h-9 px-3.5 rounded-full text-xs font-black transition-all flex items-center justify-center ${
                            players[user.uid]?.isResting
                            ? 'bg-white/10 text-zinc-400'
                            : 'bg-volt text-ink'
                        }`}
                    >
                        {players[user.uid]?.isResting ? '복귀' : '휴식'}
                    </button>

                    {isAdmin && (
                        <div className="flex gap-1">
                            <button
                                onClick={() => setIsTestLabOpen(true)}
                                className={`w-9 h-9 flex items-center justify-center rounded-full transition-all ${isAutoPlay ? 'bg-red-500/20 text-red-400 animate-pulse' : 'text-zinc-400 hover:text-volt hover:bg-white/5'}`}
                                title="시뮬레이션 랩"
                            >
                                <FlaskConical size={19} />
                            </button>
                            <button
                                onClick={() => setIsSettingsOpen(true)}
                                className="w-9 h-9 flex items-center justify-center rounded-full text-zinc-400 hover:text-white hover:bg-white/5 transition-all"
                            >
                                <GripVertical size={19} />
                            </button>
                        </div>
                    )}
                </div>
            </header>

            <GameBanner />

            {/* 탭 */}
            <div className="flex bg-ink px-2">
                {[
                    { key: 'matching', label: '매칭 대기' },
                    { key: 'inProgress', label: '경기 진행' },
                ].map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`flex-1 py-3 text-sm font-black border-b-2 transition-colors uppercase tracking-wide ${activeTab === tab.key ? 'border-volt text-volt' : 'border-transparent text-zinc-500'}`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <main className="flex-grow overflow-y-auto p-4 space-y-6 pb-24 hide-scrollbar">
                {activeTab === 'matching' ? (
                    <>
                        <section className="bg-white rounded-2xl shadow-card p-4 border border-zinc-100">
                            <div className="flex justify-between items-center mb-4 border-b border-zinc-100 pb-3">
                                <h2 className="text-xs font-black uppercase tracking-wider text-ink flex items-center gap-2">
                                    <Users size={15} className="text-volt-deep"/>
                                    대기 명단
                                </h2>
                                <span className="bg-ink text-volt text-xs font-black px-2.5 py-0.5 rounded-full tabular">
                                    {waitingPlayers.length}
                                </span>
                            </div>

                            <div className="grid grid-cols-4 gap-2">
                                {maleWaiting.map(p => (
                                   <PlayerCard
                                        key={p.id} player={p} isAdmin={isAdmin} isCurrentUser={user.uid === p.id}
                                        isSelected={selectedPlayerIds.includes(p.id)}
                                        isResting={p.isResting}
                                        onCardClick={handleCardClick}
                                        onDeleteClick={handleKickPlayer}
                                        onLongPress={(p) => setEditGamePlayer(p)}
                                    />
                                ))}
                            </div>

                            {maleWaiting.length > 0 && femaleWaiting.length > 0 && (
                                <div className="my-4 relative">
                                    <div className="absolute inset-0 flex items-center">
                                        <div className="w-full border-t border-dashed border-zinc-200"></div>
                                    </div>
                                    <div className="relative flex justify-center">
                                        <span className="bg-white px-2 text-[10px] text-zinc-400 font-black uppercase tracking-wider">여성 회원</span>
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-4 gap-2">
                                {femaleWaiting.map(p => (
                                    <PlayerCard
                                        key={p.id} player={p} isAdmin={isAdmin} isCurrentUser={user.uid === p.id}
                                        isSelected={selectedPlayerIds.includes(p.id)}
                                        isResting={p.isResting}
                                        onCardClick={handleCardClick}
                                        onDeleteClick={handleKickPlayer}
                                        onLongPress={(p) => setEditGamePlayer(p)}
                                    />
                                ))}
                            </div>

                            {waitingPlayers.length === 0 && (
                                <div className="text-center py-8">
                                    <p className="text-sm text-zinc-400 font-bold">대기 중인 선수가 없습니다.</p>
                                    <p className="text-xs text-zinc-300 mt-1 font-medium">새로운 선수를 기다리는 중...</p>
                                </div>
                            )}
                        </section>

                        <section className="space-y-3">
                            <h2 className="text-xs font-black uppercase tracking-wider text-zinc-500 ml-1">경기 배정 · Schedule</h2>
                            {Array.from({ length: roomData.numScheduledMatches }).map((_, mIdx) => {
                                const match = roomData.scheduledMatches?.[mIdx] || Array(PLAYERS_PER_MATCH).fill(null);
                                const fullCount = match.filter(Boolean).length;
                                return (
                                    <div key={mIdx} className="bg-white rounded-2xl p-3 shadow-card border border-zinc-100 flex flex-col gap-2">
                                        <div className="flex justify-between items-center px-1">
                                            <div className="flex items-center gap-2">
                                                <span className="bg-ink text-white text-[11px] font-black px-2.5 py-1 rounded-md tracking-wide">MATCH {mIdx + 1}</span>
                                                <span className="text-[11px] font-black text-zinc-400 tabular">{fullCount}/4</span>
                                            </div>
                                            <button
                                                onClick={() => handleStartClick(mIdx)}
                                                disabled={fullCount < PLAYERS_PER_MATCH}
                                                className={`flex items-center gap-1 px-3.5 py-1.5 rounded-full text-xs font-black transition-all uppercase tracking-wide ${
                                                    fullCount === PLAYERS_PER_MATCH
                                                    ? 'bg-volt text-ink shadow-volt'
                                                    : 'bg-zinc-100 text-zinc-300 cursor-not-allowed'
                                                }`}
                                            >
                                                경기 시작 <ChevronRightIcon size={14} />
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-4 gap-2">
                                            {match.map((pid, sIdx) => {
                                                if (pid && players[pid]) {
                                                    return (
                                                        <PlayerCard
                                                            key={pid} player={players[pid]} isAdmin={isAdmin} isCurrentUser={user.uid === pid}
                                                            isSelected={selectedPlayerIds.includes(pid)}
                                                            onCardClick={handleCardClick}
                                                            onDeleteClick={() => handleRemoveFromSchedule(mIdx, sIdx)}
                                                            onLongPress={(p) => setEditGamePlayer(p)}
                                                        />
                                                    );
                                                } else if (pid && !players[pid]) {
                                                    return (
                                                        <LeftPlayerCard
                                                            key={`left-${mIdx}-${sIdx}`}
                                                            isAdmin={isAdmin}
                                                            onClick={() => handleRemoveFromSchedule(mIdx, sIdx)}
                                                        />
                                                    );
                                                } else {
                                                    return (
                                                        <EmptySlot key={sIdx} onSlotClick={() => handleSlotClick(mIdx, sIdx)} />
                                                    );
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
                                <div key={cIdx} className={`rounded-2xl border transition-all overflow-hidden ${isOccupied ? 'bg-white border-ink shadow-card' : 'bg-white border-dashed border-zinc-300'}`}>
                                    <div className={`px-4 py-3 flex justify-between items-center ${isOccupied ? 'bg-ink' : 'border-b border-zinc-100'}`}>
                                        <span className={`font-black text-sm tracking-wide ${isOccupied ? 'text-volt' : 'text-zinc-400'}`}>COURT {cIdx + 1}</span>
                                        {isOccupied ? (
                                            <div className="flex items-center gap-2">
                                                <CourtTimer startTime={court.startTime} />
                                                {isAdmin && (
                                                    <button onClick={() => handleEndMatch(cIdx)} className="bg-white text-ink text-xs font-black px-3 py-1.5 rounded-full">
                                                        경기 종료
                                                    </button>
                                                )}
                                            </div>
                                        ) : <span className="text-xs text-zinc-400 font-bold uppercase tracking-wide">대기 중</span>}
                                    </div>
                                    <div className="p-3 grid grid-cols-4 gap-2">
                                        {isOccupied ? court.players.map((pid, idx) => {
                                            if (pid && players[pid]) {
                                                return <PlayerCard key={pid} player={players[pid]} isPlaying={true} isAdmin={isAdmin} onLongPress={(p) => setEditGamePlayer(p)} />;
                                            } else if (pid && !players[pid]) {
                                                return <LeftPlayerCard key={`left-court-${cIdx}-${idx}`} isAdmin={false} />;
                                            } else {
                                                return <div key={`empty-${cIdx}-${idx}`} className="h-[52px] bg-zinc-50 rounded-lg border border-zinc-100"/>;
                                            }
                                        }) : (
                                            <div className="col-span-4 h-[52px] flex items-center justify-center text-zinc-300 gap-2">
                                                <TrophyIcon size={18} />
                                                <span className="text-sm font-bold">경기가 없습니다</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </main>

            <CourtSelectionModal
                isOpen={courtModalOpen}
                onClose={() => setCourtModalOpen(false)}
                courts={availableCourts}
                onSelect={(idx) => processStartMatch(pendingMatchIndex, idx)}
            />

            <ShareModal
                isOpen={showShareModal}
                onClose={() => setShowShareModal(false)}
                roomId={roomId}
            />

            <SettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                roomData={roomData}
                onSave={handleSettingsSave}
                onReset={handleSystemReset}
                onKickAll={handleKickAll}
            />

            <EditGamesModal
                isOpen={!!editGamePlayer}
                onClose={() => setEditGamePlayer(null)}
                player={editGamePlayer}
                onSave={handleSaveGames}
            />

            <EditRoomInfoModal
                isOpen={isEditInfoOpen}
                onClose={() => setIsEditInfoOpen(false)}
                roomData={roomData}
                onSave={handleRoomInfoSave}
                onDelete={handleRoomDelete}
            />

            <TestLabModal
                isOpen={isTestLabOpen}
                onClose={() => setIsTestLabOpen(false)}
                onCreateBots={handleCreateBots}
                isAutoPlay={isAutoPlay}
                setIsAutoPlay={setIsAutoPlay}
            />
        </div>
    );
}

// ===================================================================================
// 콕맵 (Kakao Map)
// ===================================================================================
function KokMapPage() {
    const mapRef = useRef(null);
    const mapInstance = useRef(null);

    const [rooms, setRooms] = useState([]);
    const [isMapReady, setIsMapReady] = useState(false);
    const [mapObjects, setMapObjects] = useState([]);

    const [selectedRoom, setSelectedRoom] = useState(null);
    const [activeFilter, setActiveFilter] = useState('전체');
    const [searchText, setSearchText] = useState('');

    const ps = useRef(null);
    const geocoder = useRef(null);

    useEffect(() => {
        const q = query(collection(db, "rooms"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setRooms(data);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        const container = mapRef.current;
        if (!container) return;

        if (!document.getElementById('kakao-map-style')) {
            const style = document.createElement('style');
            style.id = 'kakao-map-style';
            style.innerHTML = `
                #kakao-map img { max-width: none !important; height: auto !important; border: 0 !important; }
                #kakao-map div { border: 0 !important; }
                .custom-overlay { pointer-events: none; }
                .room-label {
                    padding: 4px 9px;
                    background-color: #0B0B0C;
                    border: 1.5px solid #CCFF00;
                    border-radius: 999px;
                    font-size: 11px;
                    font-weight: 900;
                    color: #FFFFFF;
                    box-shadow: 0 4px 10px rgba(0,0,0,0.25);
                    transform: translateY(-45px);
                    white-space: nowrap;
                    position: relative;
                    letter-spacing: -0.02em;
                }
                .room-label::after {
                    content: '';
                    position: absolute;
                    bottom: -5px;
                    left: 50%;
                    transform: translateX(-50%);
                    border-width: 5px 5px 0;
                    border-style: solid;
                    border-color: #CCFF00 transparent transparent transparent;
                }
            `;
            document.head.appendChild(style);
        }

        const initMap = () => {
            if (mapInstance.current) {
                setIsMapReady(true);
                return true;
            }

            if (window.kakao && window.kakao.maps && window.kakao.maps.load) {
                window.kakao.maps.load(() => {
                    const options = {
                        center: new window.kakao.maps.LatLng(37.5665, 126.9780),
                        level: 5
                    };
                    const map = new window.kakao.maps.Map(container, options);
                    mapInstance.current = map;

                    ps.current = new window.kakao.maps.services.Places();
                    geocoder.current = new window.kakao.maps.services.Geocoder();

                    window.kakao.maps.event.addListener(map, 'click', () => {
                        setSelectedRoom(null);
                    });

                    console.log("✅ 카카오맵 로드 및 초기화 완료");
                    setIsMapReady(true);
                });
                return true;
            }
            return false;
        };

        if (!initMap()) {
            const intervalId = setInterval(() => { if (initMap()) clearInterval(intervalId); }, 100);
            return () => clearInterval(intervalId);
        }
    }, []);

    const handleMapSearch = () => {
        if (!searchText.trim() || !mapInstance.current || !window.kakao) return;
        const map = mapInstance.current;

        geocoder.current.addressSearch(searchText, (result, status) => {
            if (status === window.kakao.maps.services.Status.OK) {
                const coords = new window.kakao.maps.LatLng(result[0].y, result[0].x);
                map.panTo(coords);
            } else {
                ps.current.keywordSearch(searchText, (data, status) => {
                    if (status === window.kakao.maps.services.Status.OK) {
                        const coords = new window.kakao.maps.LatLng(data[0].y, data[0].x);
                        map.panTo(coords);
                    } else {
                        alert('검색 결과가 없습니다. 정확한 주소나 장소명을 입력해주세요.');
                    }
                });
            }
        });
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleMapSearch();
        }
    };

    useEffect(() => {
        if (!isMapReady || !mapInstance.current || !window.kakao) return;
        const map = mapInstance.current;

        mapObjects.forEach(obj => {
            obj.marker.setMap(null);
            obj.overlay.setMap(null);
        });
        const newMapObjects = [];

        const filteredRooms = rooms.filter(r => {
            return activeFilter === '전체'
                ? true
                : (r.name?.includes(activeFilter) || r.description?.includes(activeFilter));
        });

        filteredRooms.forEach(room => {
            if (room.coords?.lat && room.coords?.lng) {
                const markerPosition = new window.kakao.maps.LatLng(room.coords.lat, room.coords.lng);

                const marker = new window.kakao.maps.Marker({
                    position: markerPosition,
                    map: map,
                    clickable: true
                });

                const content = `<div class="room-label">${room.name}</div>`;
                const overlay = new window.kakao.maps.CustomOverlay({
                    position: markerPosition,
                    content: content,
                    map: map,
                    yAnchor: 1
                });

                window.kakao.maps.event.addListener(marker, 'click', () => {
                    map.panTo(markerPosition);
                    setSelectedRoom(room);
                });

                newMapObjects.push({ marker, overlay });
            }
        });

        setMapObjects(newMapObjects);

    }, [rooms, isMapReady, activeFilter]);

    const handleMyLoc = () => {
        if (!mapInstance.current) return;
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition((position) => {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                const locPosition = new window.kakao.maps.LatLng(lat, lon);
                mapInstance.current.panTo(locPosition);
            });
        } else {
            alert("위치 정보를 사용할 수 없습니다.");
        }
    };

    const zoomIn = () => mapInstance.current && mapInstance.current.setLevel(mapInstance.current.getLevel() - 1, {animate: true});
    const zoomOut = () => mapInstance.current && mapInstance.current.setLevel(mapInstance.current.getLevel() + 1, {animate: true});

    return (
        <div className="relative h-full w-full flex flex-col bg-white overflow-hidden">

            {/* 상단 플로팅 검색바 */}
            <div className="absolute top-0 left-0 right-0 z-20 px-4 pt-4 pb-2 pointer-events-none">
                <div className="pointer-events-auto bg-ink rounded-2xl shadow-float flex items-center p-2.5 pl-4 transition-all active:scale-[0.99]">
                    <CockstarMark size={20} duotone className="text-white mr-2.5 shrink-0" />
                    <input
                        type="text"
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="장소, 주소, 모임명 검색"
                        className="flex-1 bg-transparent outline-none text-sm font-bold text-white placeholder-zinc-500"
                    />

                    {searchText ? (
                        <button onClick={() => setSearchText('')} className="p-1 text-zinc-400 hover:text-white">
                            <X size={18} />
                        </button>
                    ) : null}

                    <button onClick={handleMapSearch} className="w-9 h-9 flex items-center justify-center rounded-xl bg-volt text-ink ml-1">
                        <Search size={20} />
                    </button>
                </div>
            </div>

            {/* 필터 칩 */}
            <div className="absolute top-[74px] left-0 right-0 z-20 overflow-x-auto hide-scrollbar px-4 pb-2 flex gap-2 pointer-events-auto">
                {['전체', '배드민턴장', '모임', '레슨', '샵'].map((filter) => {
                    const isActive = activeFilter === filter;
                    return (
                        <button
                            key={filter}
                            onClick={() => setActiveFilter(filter)}
                            className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-black shadow-card transition-all whitespace-nowrap ${
                                isActive
                                ? 'bg-volt text-ink'
                                : 'bg-white text-zinc-600 border border-zinc-100'
                            }`}
                        >
                            {filter}
                        </button>
                    );
                })}
            </div>

            <div
                id="kakao-map"
                ref={mapRef}
                className="flex-grow w-full h-full bg-[#e5e3df] z-0"
            />

            {/* 우측 유틸리티 */}
            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-2.5 z-20">
                <div className="bg-white rounded-2xl shadow-float border border-zinc-100 flex flex-col overflow-hidden">
                    <button onClick={zoomIn} className="p-2.5 text-zinc-500 hover:text-ink active:bg-zinc-100 border-b border-zinc-100">
                        <Plus size={20} />
                    </button>
                    <button onClick={zoomOut} className="p-2.5 text-zinc-500 hover:text-ink active:bg-zinc-100">
                        <span className="block w-5 h-[2px] bg-current my-[9px]"></span>
                    </button>
                </div>
                <button
                    onClick={handleMyLoc}
                    className="bg-ink p-3 rounded-full shadow-float text-volt active:scale-95 transition-all"
                >
                    <MapPin size={22} />
                </button>
            </div>

            {/* 하단 정보 시트 */}
            {selectedRoom && (
                <div className="absolute bottom-0 left-0 right-0 z-30 bg-white rounded-t-[28px] shadow-[0_-8px_30px_rgba(0,0,0,0.15)] animate-slide-up pb-safe">
                    <div className="w-full h-6 flex items-center justify-center" onClick={() => setSelectedRoom(null)}>
                        <div className="w-10 h-1.5 bg-zinc-200 rounded-full cursor-pointer hover:bg-zinc-300 transition-colors"></div>
                    </div>

                    <div className="px-5 pb-6">
                        <div className="flex justify-between items-start mb-1">
                            <div>
                                <h3 className="text-xl font-black text-ink kern-tight leading-tight mb-1">
                                    {selectedRoom.name}
                                </h3>
                                <div className="text-sm text-zinc-500 flex items-center gap-1 font-bold">
                                    <MapPin size={13} className="text-zinc-400" />
                                    <span className="truncate max-w-[200px]">{selectedRoom.address || selectedRoom.location}</span>
                                </div>
                            </div>
                            <button onClick={() => setSelectedRoom(null)} className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-400 hover:text-zinc-600">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="flex items-center gap-2 mb-4 text-sm">
                            <span className="font-black text-volt-deep uppercase tracking-wide text-xs bg-volt/20 px-2 py-0.5 rounded-full">영업 중</span>
                            <span className="text-zinc-600 font-bold">현재 {selectedRoom.playerCount || 0}명 참여 중</span>
                        </div>

                        <div className="grid grid-cols-3 gap-2.5 mb-4">
                             <a
                                href={`https://map.kakao.com/link/to/${selectedRoom.name},${selectedRoom.coords.lat},${selectedRoom.coords.lng}`}
                                target="_blank"
                                rel="noreferrer"
                                className="flex flex-col items-center justify-center gap-1 py-3 bg-ink rounded-2xl active:scale-95 transition-transform"
                            >
                                <MapPin size={20} className="text-volt" />
                                <span className="text-xs font-black text-white">길찾기</span>
                            </a>

                            <a
                                href={`https://map.naver.com/v5/?c=${selectedRoom.coords.lat},${selectedRoom.coords.lng},15,0,0,0,dh`}
                                target="_blank"
                                rel="noreferrer"
                                className="flex flex-col items-center justify-center gap-1 py-3 bg-zinc-100 rounded-2xl active:scale-95 transition-transform"
                            >
                                <span className="font-black text-base text-[#03C75A]">N</span>
                                <span className="text-xs font-black text-zinc-600">네이버</span>
                            </a>

                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(`${selectedRoom.name}\n${selectedRoom.address || selectedRoom.location}`);
                                    alert('주소가 복사되었습니다.');
                                }}
                                className="flex flex-col items-center justify-center gap-1 py-3 bg-zinc-100 rounded-2xl active:scale-95 transition-transform"
                            >
                                <Share2 size={20} className="text-zinc-600" />
                                <span className="text-xs font-black text-zinc-600">공유</span>
                            </button>
                        </div>

                        <button
                            onClick={() => alert('경기방 입장 기능은 경기 탭에서 이용해주세요.')}
                            className="w-full py-4 bg-volt text-ink font-black rounded-full text-base shadow-volt active:scale-[0.98] transition-transform uppercase tracking-wide"
                        >
                            이 곳의 경기방 확인하기
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// 커뮤니티 페이지
function CommunityPage() {
    return (
        <div className="relative h-full">
            <ComingSoonPage
                icon={MessageSquare}
                title="커뮤니티"
                description="정보 공유, Q&A, 클럽 홍보, 중고마켓. 배드민턴의 모든 대화가 곧 이곳에서 시작됩니다."
            />
            <button
                onClick={() => alert('글쓰기 기능 준비 중')}
                className="absolute bottom-6 right-6 bg-volt text-ink h-14 pl-4 pr-5 rounded-full shadow-volt flex items-center gap-1.5 transition-transform active:scale-90 font-black"
            >
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
            <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-white">
                <div className="w-20 h-20 rounded-3xl bg-ink flex items-center justify-center mb-6">
                    <User className="w-9 h-9 text-volt" />
                </div>
                <h2 className="text-2xl font-black kern-tight mb-2">로그인이 필요합니다</h2>
                <p className="text-zinc-500 font-bold mb-8 text-sm">로그인하고 콕스타의 모든 무대를 열어보세요.</p>
                <button
                    onClick={onLoginClick}
                    className="px-9 py-4 bg-volt text-ink font-black rounded-full shadow-volt text-sm uppercase tracking-wide transition-transform active:scale-95"
                >
                    로그인 / 회원가입
                </button>
            </div>
        );
    }

    if (!userData) {
        return <div className="p-10 text-center text-zinc-400 font-bold">프로필 정보를 설정해주세요.</div>;
    }
    return (
        <div className="p-5 space-y-5 bg-zinc-50 min-h-full">
            <div className="pt-1">
                <span className="text-[11px] font-black uppercase tracking-[0.2em] text-volt-deep">Athlete</span>
                <h1 className="text-2xl font-black kern-tight leading-none mt-0.5">내 정보</h1>
            </div>

            {/* 프로필 히어로 카드 (다크) */}
            <div className="bg-ink rounded-[28px] p-6 relative overflow-hidden grain">
                <div className="flex items-center space-x-4 relative z-10">
                    <div className="w-20 h-20 bg-volt rounded-2xl flex items-center justify-center flex-shrink-0">
                        <User className="w-10 h-10 text-ink" strokeWidth={2.4} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h2 className="text-2xl font-black truncate text-white kern-tight">
                            {userData?.name || '사용자'}
                        </h2>
                        <div className="flex items-center gap-2 mt-2">
                            <span className="inline-flex items-center gap-1 text-[11px] font-black text-ink bg-volt px-2 py-1 rounded-full uppercase">
                                <BarChart2 size={12} /> {userData?.level || 'N조'}
                            </span>
                            {userData?.kakaoId && (
                                <span className="text-[10px] bg-[#FEE500] text-black px-2 py-0.5 rounded-full font-black">Kakao</span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="mt-5 flex items-center gap-2 relative z-10">
                    <span className="text-[11px] truncate font-bold bg-white/10 text-zinc-300 px-3 py-2 rounded-xl flex-1">
                        {userData?.email || user?.email || user?.uid}
                    </span>
                    <button
                        onClick={() => {
                            const copyId = userData?.email || user?.email || user?.uid || "";

                            if (!copyId) {
                                alert("복사할 아이디 정보가 없습니다.");
                                return;
                            }

                            if (navigator.clipboard && window.isSecureContext) {
                                navigator.clipboard.writeText(copyId)
                                    .then(() => alert(`아이디가 복사되었습니다!\n${copyId}`))
                                    .catch(() => alert("복사 실패: 다시 시도해주세요."));
                            } else {
                                const textArea = document.createElement("textarea");
                                textArea.value = copyId;
                                document.body.appendChild(textArea);
                                textArea.select();
                                try {
                                    document.execCommand("copy");
                                    alert(`아이디가 복사되었습니다!\n${copyId}`);
                                } catch (err) {
                                    alert("복사에 실패했습니다.");
                                }
                                document.body.removeChild(textArea);
                            }
                        }}
                        className="p-2.5 bg-volt text-ink rounded-xl active:scale-90 transition-transform flex-shrink-0 flex items-center gap-1"
                    >
                        <Copy size={14} />
                        <span className="text-[11px] font-black">복사</span>
                    </button>
                </div>
                <p className="text-[10px] text-zinc-500 font-medium mt-2 ml-1 relative z-10">
                    * 관리자 등록 시 위 아이디를 전달해 주세요.
                </p>
                <ZapIcon className="absolute -right-6 -bottom-8 w-40 h-40 text-white/5" strokeWidth={1} />
            </div>

            {/* 프로필 상세 */}
            <div className="bg-white rounded-2xl border border-zinc-100 shadow-card p-6">
                <h3 className="text-xs font-black uppercase tracking-wider text-zinc-500 mb-5 flex items-center gap-2">
                    <UserCheck size={16} className="text-volt-deep"/> 나의 프로필
                </h3>
                <div className="space-y-3.5 text-sm">
                    <div className="flex justify-between items-center border-b border-zinc-50 pb-3">
                        <span className="text-zinc-400 font-bold">급수</span>
                        <span className="font-black text-ink">{userData?.level || '미설정'}</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-zinc-50 pb-3">
                        <span className="text-zinc-400 font-bold">성별</span>
                        <span className="font-black text-ink">{userData?.gender || '미설정'}</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-zinc-50 pb-3">
                        <span className="text-zinc-400 font-bold">출생년도</span>
                        <span className="font-black text-ink">{userData?.birthYear ? `${userData.birthYear}년생` : '미설정'}</span>
                    </div>
                </div>

                <button
                    onClick={() => setShowEditProfile(true)}
                    className="mt-6 w-full py-3.5 bg-ink text-white rounded-full hover:bg-ink-soft transition-all text-sm font-black uppercase tracking-wide"
                >
                    프로필 수정하기
                </button>
            </div>

            {/* 찜한 아이템 */}
            <div className="bg-white rounded-2xl border border-zinc-100 shadow-card p-6">
                 <h3 className="text-xs font-black uppercase tracking-wider text-zinc-500 mb-4 flex items-center gap-2">
                    <HeartIcon size={16} className="text-volt-deep"/> 찜한 아이템
                 </h3>
                 <EmptyState
                    icon={Archive}
                    title="찜한 아이템이 없습니다"
                    description="스토어에서 마음에 드는 장비를 찜해보세요!"
                    buttonText="스토어 둘러보기"
                    onButtonClick={() => setPage('store')}
                 />
            </div>

            <button
                onClick={onLogout}
                className="w-full py-4 bg-white border border-zinc-100 text-red-500 font-black rounded-full text-sm hover:bg-red-50 transition-colors"
            >
                로그아웃
            </button>

            <EditProfileModal
                isOpen={showEditProfile}
                onClose={() => setShowEditProfile(false)}
                userData={userData}
                user={user}
            />
        </div>
    );
}

// 홈 헤더
function HomePageHeader({ onSearchClick, onBellClick }) {
    return (
        <header className="sticky top-0 bg-white/85 backdrop-blur-md z-10 px-5 py-3.5 flex justify-between items-center border-b border-zinc-100">
            <CockstarLogo tone="ink" markSize={22} />

            <div className="flex space-x-1 text-zinc-700">
                <button
                    onClick={onSearchClick}
                    className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-zinc-100 transition-colors"
                >
                    <Search size={22} />
                </button>
                <button
                    onClick={onBellClick}
                    className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-zinc-100 transition-colors"
                >
                    <Bell size={22} />
                </button>
            </div>
        </header>
    );
}

function SubPageHeader({ page, onBackClick }) {
    const title = page === 'game' ? '경기' :
                  page === 'store' ? '스토어' :
                  page === 'community' ? '커뮤니티' : '내 정보';
    return (
        <header className="sticky top-0 bg-white/85 backdrop-blur-md z-10 px-4 py-3.5 flex items-center border-b border-zinc-100">
            <button
                onClick={onBackClick}
                className="mr-1 w-10 h-10 flex items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 transition-colors"
            >
                <ArrowLeft size={22} />
            </button>
            <h1 className="text-xl font-black text-ink kern-tight">
                {title}
            </h1>
        </header>
    );
}

// ===================================================================================
// 메인 App
// ===================================================================================
const TabButton = ({ icon: Icon, label, isActive, onClick }) => {
    return (
        <button
            onClick={onClick}
            className="flex flex-col items-center justify-center w-full pt-2.5 pb-2 transition-all duration-200 active:scale-90"
        >
            <div className={`relative flex items-center justify-center transition-colors ${isActive ? 'text-ink' : 'text-zinc-400'}`}>
                <Icon size={24} strokeWidth={isActive ? 2.4 : 2} />
                {isActive && <span className="absolute -bottom-2 w-1 h-1 rounded-full bg-volt volt-glow"></span>}
            </div>
            <span className={`text-[11px] mt-1.5 transition-all ${isActive ? 'font-black text-ink' : 'font-bold text-zinc-400'}`}>
                {label}
            </span>
        </button>
    );
};

export default function App() {
    const [page, setPage] = useState(localStorage.getItem('cockstar_last_page') || 'home');
    const [user, setUser] = useState(null);
    const [userData, setUserData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [sharedRoomId, setSharedRoomId] = useState(null);

    useEffect(() => {
        if (page) {
            localStorage.setItem('cockstar_last_page', page);
        }
    }, [page]);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const roomId = params.get('roomId');
        if (roomId) {
            setSharedRoomId(roomId);
            setPage('game');
        }
    }, []);

    const getGameDate = () => {
        const now = new Date();
        return now.toISOString().split('T')[0];
    };

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
                            await updateDoc(userDocRef, {
                                todayGames: 0,
                                lastResetDate: currentGameDate
                            });
                        } else {
                            setUserData(data);
                        }
                    } else {
                        setUserData(null);
                    }
                    setLoading(false);
                });
            } else {
                setUser(null);
                setUserData(null);
                setLoading(false);
            }
        });
        return () => {
            unsubscribeAuth();
            if (unsubscribeUserDoc) unsubscribeUserDoc();
        };
    }, []);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const roomId = params.get('roomId');
        if (roomId) setPage('game');
    }, []);

    const handleTabClick = (targetPage) => {
        if ((targetPage === 'game' || targetPage === 'myInfo') && !user) {
            setIsAuthModalOpen(true);
            return;
        }
        setPage(targetPage);
    };

    if (loading) return (
        <div className="flex flex-col h-screen bg-ink max-w-md mx-auto items-center justify-center">
            <div className="animate-pop">
                <CockstarLogo tone="light" markSize={40} className="scale-150" />
            </div>
            <span className="mt-10 text-[11px] font-black uppercase tracking-[0.3em] text-zinc-600">코트를 준비하는 중</span>
        </div>
    );

    const showHomeHeader = page === 'home';

    return (
        <div className="flex flex-col h-screen bg-white max-w-md mx-auto shadow-2xl overflow-hidden relative font-sans text-ink">
            {showHomeHeader && <HomePageHeader onSearchClick={() => handleTabClick('kokMap')} onBellClick={() => alert('알림 기능 준비 중')} />}

            <main className="flex-grow overflow-y-auto hide-scrollbar bg-white">
                {page === 'home' && <HomePage user={user} setPage={handleTabClick} />}
                {page === 'game' && (
                    <GamePage
                        user={user}
                        userData={userData}
                        sharedRoomId={sharedRoomId}
                        onLoginClick={() => setIsAuthModalOpen(true)}
                    />
                )}
                {page === 'kokMap' && <KokMapPage />}
                {page === 'community' && <CommunityPage />}
                {page === 'myInfo' && <MyInfoPage user={user} userData={userData} onLoginClick={() => setIsAuthModalOpen(true)} onLogout={() => signOut(auth)} setPage={handleTabClick} />}
            </main>

            {/* 하단 네비게이션 */}
            <nav className="flex justify-around items-center bg-white border-t border-zinc-100 pb-safe pt-1 px-2 z-20">
                <TabButton icon={Home} label="홈" isActive={page === 'home'} onClick={() => handleTabClick('home')} />
                <TabButton icon={Trophy} label="경기" isActive={page === 'game'} onClick={() => handleTabClick('game')} />
                <TabButton icon={KokMap} label="콕맵" isActive={page === 'kokMap'} onClick={() => handleTabClick('kokMap')} />
                <TabButton icon={MessageSquare} label="커뮤니티" isActive={page === 'community'} onClick={() => handleTabClick('community')} />
                <TabButton icon={User} label="정보" isActive={page === 'myInfo'} onClick={() => handleTabClick('myInfo')} />
            </nav>

            {user && !userData && !loading && (
                <InitialProfileModal isOpen={true} user={user} />
            )}

            <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
        </div>
    );
}






