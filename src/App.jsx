import React, { useState, useEffect, useRef, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import {
    getAuth,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signInWithPopup,
    GoogleAuthProvider,
    signOut
} from 'firebase/auth';
import { 
    getFirestore, 
    doc, 
    setDoc, 
    getDoc, 
    onSnapshot,
    // [신규] Firestore 기능 추가
    collection, 
    query, 
    where, 
    addDoc, 
    serverTimestamp,
    orderBy, // [신규] 정렬 기능
    updateDoc, // [신규] 문서 업데이트 기능
    deleteDoc // [신규] 문서 삭제 기능
} from 'firebase/firestore';
import {
    // [수정] 아이콘 굵기(strokeWidth)를 1.5로 일괄 변경하기 위해 
    // createReactComponent 헬퍼와 원본 아이콘(Icon)을 가져옵니다.
    createReactComponent,
    Home as HomeIcon, 
    Trophy as TrophyIcon, 
    Store as StoreIcon, 
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
    GripVertical as GripVerticalIcon
} from 'lucide-react';

// [신규] 얇은 아이콘을 생성하는 헬퍼 함수
// 기본 strokeWidth: 1.5, 기본 size: 24
const createIcon = (name, iconNode) => createReactComponent(name, iconNode, {
    strokeWidth: 1.5,
    size: 24,
});

// [신규] 앱에서 사용할 얇은 아이콘을 재정의합니다.
// 이제 앱 전역에서 <Home />을 호출하면 굵기 1.5가 적용된 아이콘이 나옵니다.
const Home = createIcon('Home', HomeIcon.iconNode);
const Trophy = createIcon('Trophy', TrophyIcon.iconNode);
const Store = createIcon('Store', StoreIcon.iconNode);
const Users = createIcon('Users', UsersIcon.iconNode);
const User = createIcon('User', UserIcon.iconNode);
const X = createIcon('X', XIcon.iconNode);
const Loader2 = createIcon('Loader2', Loader2Icon.iconNode);
const ArrowLeft = createIcon('ArrowLeft', ArrowLeftIcon.iconNode);
const ShieldCheck = createIcon('ShieldCheck', ShieldCheckIcon.iconNode);
const ShoppingBag = createIcon('ShoppingBag', ShoppingBagIcon.iconNode);
const MessageSquare = createIcon('MessageSquare', MessageSquareIcon.iconNode);
const Search = createIcon('Search', SearchIcon.iconNode);
const Bell = createIcon('Bell', BellIcon.iconNode);
const MapPin = createIcon('MapPin', MapPinIcon.iconNode);
const Heart = createIcon('Heart', HeartIcon.iconNode);
const ChevronRight = createIcon('ChevronRight', ChevronRightIcon.iconNode);
const Plus = createIcon('Plus', PlusIcon.iconNode);
const Archive = createIcon('Archive', ArchiveIcon.iconNode);
const Lock = createIcon('Lock', LockIcon.node);
const Edit3 = createIcon('Edit3', Edit3Icon.iconNode);
const Clock = createIcon('Clock', ClockIcon.iconNode);
const AlertCircle = createIcon('AlertCircle', AlertCircleIcon.iconNode);
const Calendar = createIcon('Calendar', CalendarIcon.iconNode);
const Users2 = createIcon('Users2', Users2Icon.iconNode);
const BarChart2 = createIcon('BarChart2', BarChart2Icon.iconNode);
const CheckCircle = createIcon('CheckCircle', CheckCircleIcon.iconNode);
const UserCheck = createIcon('UserCheck', UserCheckIcon.iconNode);
const GripVertical = createIcon('GripVertical', GripVerticalIcon.iconNode);
// ===================================================================================
// Firebase 설정 (Vercel 환경 변수 사용)
// ===================================================================================
// .env.local 파일에 VITE_API_KEY=... 형식으로 실제 키를 넣어주세요.
const firebaseConfig = {
    apiKey: import.meta.env.VITE_API_KEY,
    authDomain: import.meta.env.VITE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_APP_ID,
    measurementId: import.meta.env.VITE_MEASUREMENT_ID
};

// Firebase 앱 초기화
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// [신규] 앱 ID (Firestore 경로에 사용)
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// ===================================================================================
// [신규] 상수 및 Helper 함수 (구버전 앱 참고)
// ===================================================================================
// 급수 정렬 순서
const LEVEL_ORDER = { 'S조': 1, 'A조': 2, 'B조': 3, 'C조': 4, 'D조': 5, 'E조': 6, 'N조': 7, '미설정': 8 };
// 급수별 Tailwind CSS 색상
const getLevelColor = (level) => {
    switch (level) {
        case 'S조': return 'border-sky-400 text-sky-500'; // S조 (하늘)
        case 'A조': return 'border-red-500 text-red-600'; // A조 (빨강)
        case 'B조': return 'border-orange-500 text-orange-600'; // B조 (주황)
        case 'C조': return 'border-yellow-500 text-yellow-600'; // C조 (노랑)
        case 'D조': return 'border-green-500 text-green-600'; // D조 (초록)
        case 'E조': return 'border-blue-500 text-blue-600'; // E조 (파랑)
        default: return 'border-gray-400 text-gray-500'; // N조 및 기타
    }
};
// 4인 1조
const PLAYERS_PER_MATCH = 4;


// ===================================================================================
// 로딩 스피너 컴포넌트
// ===================================================================================
function LoadingSpinner({ text = "로딩 중..." }) {
    return (
        <div className="flex flex-col items-center justify-center h-full text-[#1E1E1E]">
            <Loader2 className="w-10 h-10 animate-spin text-[#00B16A]" />
            <span className="mt-4 text-base font-semibold">{text}</span>
        </div>
    );
}

// ===================================================================================
// [신규] 스켈레톤 로딩 컴포넌트 (아이디어 #1)
// ===================================================================================
function SkeletonCard() {
    return (
        <div className="w-full p-4 bg-white rounded-xl shadow-lg animate-pulse">
            <div className="h-5 bg-gray-200 rounded-md w-3/4 mb-3"></div>
            <div className="flex gap-2 mb-4">
                <div className="h-4 bg-gray-200 rounded-full w-1/4"></div>
                <div className="h-4 bg-gray-200 rounded-full w-1/4"></div>
            </div>
            <div className="flex justify-between items-center">
                <div className="h-4 bg-gray-200 rounded-md w-1/3"></div>
                <div className="h-6 bg-gray-200 rounded-full w-1/4"></div>
            </div>
        </div>
    );
}

function SkeletonStoreCard() {
     return (
        <div className="w-40 flex-shrink-0 mr-4 animate-pulse"> {/* mr-4 추가 */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                <div className="w-full h-32 object-cover bg-gray-200"></div>
                <div className="p-3">
                    <div className="h-5 bg-gray-200 rounded-md w-3/4 mb-2"></div>
                    <div className="h-4 bg-gray-200 rounded-md w-1/2"></div>
                </div>
            </div>
        </div>
    );
}

// [신규] 로비 스켈레톤
function SkeletonRoomCard() {
    return (
        <div className="bg-white rounded-xl shadow-lg p-4 animate-pulse">
            <div className="h-6 bg-gray-200 rounded-md w-1/2 mb-3"></div>
            <div className="h-4 bg-gray-200 rounded-md w-3/4 mb-4"></div>
            <div className="flex flex-wrap gap-2">
                <div className="h-6 bg-gray-200 rounded-full w-1/4"></div>
                <div className="h-6 bg-gray-200 rounded-full w-1/4"></div>
                <div className="h-6 bg-gray-200 rounded-full w-1/3"></div>
            </div>
        </div>
    );
}


// ===================================================================================
// [신규] 빈 화면 (Empty State) 컴포넌트 (아이디어 #3)
// ===================================================================================
function EmptyState({ icon: Icon, title, description, buttonText, onButtonClick }) {
    return (
        <div className="flex flex-col items-center justify-center text-center text-gray-500 p-8 bg-gray-50 rounded-xl">
            <Icon className="w-16 h-16 mb-4 text-gray-400" />
            <h3 className="text-lg font-semibold text-[#1E1E1E] mb-2">{title}</h3>
            <p className="text-sm mb-6">{description}</p>
            {buttonText && onButtonClick && (
                <button
                    onClick={onButtonClick}
                    className="px-6 py-2 bg-[#00B16A] text-white text-sm font-bold rounded-lg shadow-md hover:bg-green-700 transition-colors"
                >
                    {buttonText}
                </button>
            )}
        </div>
    );
}

// ===================================================================================
// 기능 준비 중 (Coming Soon) 컴포넌트
// ===================================================================================
function ComingSoonPage({ icon: Icon, title, description }) {
    return (
        <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 p-8">
            <Icon className="w-20 h-20 mb-6 text-[#00B16A]" />
            <h2 className="text-2xl font-bold text-[#1E1E1E] mb-3">{title}</h2>
            <p className="text-base">{description}</p>
            <p className="mt-2 text-sm">빠른 시일 내에 멋진 기능으로 찾아뵙겠습니다!</p>
        </div>
    );
}

// ===================================================================================
// 로그인 필요 (Login Required) 컴포넌트
// ===================================================================================
function LoginRequiredPage({ icon: Icon, title, description, onLoginClick }) {
    return (
        <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 p-8">
            <Icon className="w-20 h-20 mb-6 text-[#FFD700]" />
            <h2 className="text-2xl font-bold text-[#1E1E1E] mb-3">{title}</h2>
            <p className="text-base">{description}</p>
            <button
                onClick={onLoginClick}
                className="mt-8 px-8 py-3 bg-[#FFD700] text-black text-base font-bold rounded-lg shadow-lg transition-transform transform hover:scale-105"
            >
                로그인 하러 가기
            </button>
        </div>
    );
}


// ===================================================================================
// 로그인/회원가입 모달
// ===================================================================================
function AuthModal({ onClose, setPage }) {
    const [isLoginMode, setIsLoginMode] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState(''); // 회원가입용
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleGoogleLogin = async () => {
        setLoading(true);
        setError('');
        try {
            const result = await signInWithPopup(auth, googleProvider);
            const user = result.user;
            
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (!userDoc.exists()) {
                await setDoc(doc(db, "users", user.uid), {
                    name: user.displayName || '새 사용자',
                    email: user.email,
                    level: 'N조',
                    gender: '미설정',
                });
            }
            onClose();
        } catch (err) {
            console.error("Google 로그인 오류:", err);
            // OAuth 오류는 콘솔에만 표시하고, 사용자에게는 간단히 안내
            if (err.code === 'auth/operation-not-allowed' || err.code === 'auth/unauthorized-domain') {
                 setError('현재 Google 로그인을 사용할 수 없습니다. 관리자에게 문의하세요.');
            } else {
                 setError(getFirebaseErrorMessage(err));
            }
        } finally {
            setLoading(false);
        }
    };

    const handleEmailAuth = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            if (isLoginMode) {
                await signInWithEmailAndPassword(auth, email, password);
            } else {
                if (name.length < 2) {
                    setError("이름을 2자 이상 입력해주세요.");
                    setLoading(false);
                    return;
                }
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;
                
                await setDoc(doc(db, "users", user.uid), {
                    name: name,
                    email: user.email,
                    level: 'N조',
                    gender: '미설정',
                });
            }
            onClose();
        } catch (err) {
            console.error("이메일 인증 오류:", err);
            setError(getFirebaseErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    const getFirebaseErrorMessage = (error) => {
        switch (error.code) {
            case 'auth/user-not-found':
                return '가입되지 않은 이메일입니다.';
            case 'auth/wrong-password':
                return '비밀번호가 일치하지 않습니다.';
            case 'auth/email-already-in-use':
                return '이미 사용 중인 이메일입니다.';
            case 'auth/weak-password':
                return '비밀번호는 6자리 이상이어야 합니다.';
            case 'auth/invalid-email':
                return '유효하지 않은 이메일 형식입니다.';
            default:
                return '로그인 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-xl p-8 w-full max-w-md relative text-white shadow-2xl">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-500 hover:text-white"
                    disabled={loading}
                >
                    <X size={28} />
                </button>
                
                <h2 className="text-2xl font-extrabold text-center mb-6 text-[#FFD700] tracking-tighter">
                    {isLoginMode ? '콕스타 로그인' : '콕스타 회원가입'}
                </h2>

                {error && <p className="text-red-400 text-center mb-4 bg-red-900/50 p-3 rounded-lg text-sm">{error}</p>}

                <form onSubmit={handleEmailAuth} className="space-y-4">
                    {!isLoginMode && (
                        <input
                            type="text"
                            placeholder="이름 (닉네임)"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                            className="w-full p-4 bg-gray-700 rounded-lg text-white placeholder-gray-400 border-2 border-gray-600 focus:border-[#00B16A] focus:outline-none text-base"
                        />
                    )}
                    <input
                        type="email"
                        placeholder="이메일 주소"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="w-full p-4 bg-gray-700 rounded-lg text-white placeholder-gray-400 border-2 border-gray-600 focus:border-[#00B16A] focus:outline-none text-base"
                    />
                    <input
                        type="password"
                        placeholder="비밀번호 (6자 이상)"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="w-full p-4 bg-gray-700 rounded-lg text-white placeholder-gray-400 border-2 border-gray-600 focus:border-[#00B16A] focus:outline-none text-base"
                    />
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-4 bg-[#00B16A] text-white font-bold rounded-lg text-base hover:bg-green-600 transition-colors disabled:bg-gray-600 flex items-center justify-center"
                    >
                        {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : (isLoginMode ? '로그인' : '회원가입')}
                    </button>
                </form>

                <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t border-gray-600" />
                    </div>
                    <div className="relative flex justify-center text-sm">
                        <span className="bg-gray-800 px-2 text-gray-400">OR</span>
                    </div>
                </div>

                <button
                    onClick={handleGoogleLogin}
                    disabled={loading}
                    className="w-full py-4 bg-white text-black font-bold rounded-lg text-base hover:bg-gray-200 transition-colors flex items-center justify-center gap-3 disabled:bg-gray-400"
                >
                    <svg className="w-6 h-6" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.8 2.38 30.47 0 24 0 14.62 0 6.78 5.48 2.76 13.23l7.88 6.14C12.24 13.62 17.7 9.5 24 9.5z"></path><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.9-2.26 5.48-4.8 7.18l7.66 5.92C42.92 38.04 46.98 32.08 46.98 24.55z"></path><path fill="#FBBC05" d="M10.6 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59L2.76 13.23C1.18 16.29 0 19.99 0 24s1.18 7.71 2.76 10.77l7.84-5.18z"></path><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.66-5.92c-2.13 1.45-4.82 2.3-7.92 2.3-6.11 0-11.31-4.08-13.16-9.56L2.76 34.77C6.78 42.52 14.62 48 24 48z"></path><path fill="none" d="M0 0h48v48H0z"></path></svg>
                    Google 계정으로 계속하기
                </button>

                <p className="mt-6 text-center text-gray-400 text-sm font-medium">
                    {isLoginMode ? '계정이 없으신가요?' : '이미 계정이 있으신가요?'}
                    <button
                        onClick={() => {
                            setIsLoginMode(!isLoginMode);
                            setError('');
                        }}
                        className="font-bold text-[#FFD700] hover:text-yellow-300 ml-2"
                    >
                        {isLoginMode ? '회원가입' : '로그인'}
                    </button>
                </p>
            </div>
        </div>
    );
}

// ===================================================================================
// [신규] 모임 생성 모달 (GamePage용)
// ===================================================================================
function CreateRoomModal({ isOpen, onClose, onSubmit, user, userData }) {
    // 폼 상태
    const [roomName, setRoomName] = useState('');
    const [location, setLocation] = useState('');
    const [description, setDescription] = useState('');
    const [levelLimit, setLevelLimit] = useState('N조'); // 급수 제한
    const [maxPlayers, setMaxPlayers] = useState(20); // 인원 제한
    const [usePassword, setUsePassword] = useState(false);
    const [password, setPassword] = useState('');
    
    // 유효성 검사 및 로딩
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // 모달이 열릴 때 상태 초기화
    useEffect(() => {
        if (isOpen) {
            setRoomName('');
            setLocation('');
            setDescription('');
            setLevelLimit('N조');
            setMaxPlayers(20);
            setUsePassword(false);
            setPassword('');
            setError('');
            setLoading(false);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!roomName.trim()) {
            setError('모임방 제목을 입력해주세요.');
            return;
        }

        if (usePassword && !password) {
            setError('비밀번호를 입력해주세요.');
            return;
        }

        setLoading(true);

        const newRoomData = {
            name: roomName,
            location: location || '장소 미정',
            description: description || '모임 소개가 없습니다.',
            levelLimit: levelLimit,
            maxPlayers: maxPlayers,
            password: usePassword ? password : '',
            adminUid: user.uid,
            adminName: userData?.name || '방장',
            // Firestore 서버 시간 기준 생성
            createdAt: serverTimestamp(),
            // [수정] 경기 시스템 초기 데이터 추가
            playerCount: 0,
            numScheduledMatches: 4, // 기본 4 경기 예정
            numInProgressCourts: 2, // 기본 2 코트
            scheduledMatches: {},   // { 0: [p1, p2, p3, p4], 1: [...] }
            inProgressCourts: [],   // [ { players: [...], startTime: ... }, null ]
        };

        try {
            await onSubmit(newRoomData); // 부모 컴포넌트(GamePage)에서 addDoc 처리
            onClose(); // 성공 시 모달 닫기
        } catch (err) {
            console.error("Error creating room:", err);
            setError("모임방 생성에 실패했습니다. 다시 시도해주세요.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-6 w-full max-w-lg relative text-[#1E1E1E] shadow-2xl max-h-[90vh] overflow-y-auto">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                    disabled={loading}
                >
                    <X size={24} />
                </button>
                
                <h2 className="text-xl font-bold text-center mb-6">새 모임방 만들기</h2>

                {error && <p className="text-red-500 text-center mb-4 bg-red-100 p-3 rounded-lg text-sm">{error}</p>}

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* 방 제목 */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">방 제목 <span className="text-red-500">*</span></label>
                        <input
                            type="text"
                            placeholder="예: 콕스타 3040 정모 (A-C조)"
                            value={roomName}
                            onChange={(e) => setRoomName(e.target.value)}
                            required
                            className="w-full p-3 bg-gray-100 rounded-lg text-base border border-gray-200 focus:border-[#00B16A] focus:ring-1 focus:ring-[#00B16A] focus:outline-none"
                        />
                    </div>

                    {/* 장소 */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">장소</label>
                        <input
                            type="text"
                            placeholder="예: 콕스타 전용 체육관"
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                            className="w-full p-3 bg-gray-100 rounded-lg text-base border border-gray-200 focus:border-[#00B16A] focus:ring-1 focus:ring-[#00B16A] focus:outline-none"
                        />
                    </div>

                    {/* 소개 */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">소개</label>
                        <textarea
                            placeholder="모임에 대해 간단히 소개해주세요."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={3}
                            className="w-full p-3 bg-gray-100 rounded-lg text-base border border-gray-200 focus:border-[#00B16A] focus:ring-1 focus:ring-[#00B16A] focus:outline-none"
                        />
                    </div>

                    {/* 급수 제한 / 인원 제한 */}
                    <div className="flex gap-4">
                        <div className="flex-1">
                            <label className="block text-sm font-bold text-gray-700 mb-1">입장 급수</label>
                            <select
                                value={levelLimit}
                                onChange={(e) => setLevelLimit(e.target.value)}
                                className="w-full p-3 bg-gray-100 rounded-lg text-base border border-gray-200 focus:border-[#00B16A] focus:ring-1 focus:ring-[#00B16A] focus:outline-none"
                            >
                                <option value="N조">전체 급수</option>
                                <option value="S조">S조 이상</option>
                                <option value="A조">A조 이상</option>
                                <option value="B조">B조 이상</option>
                                <option value="C조">C조 이상</option>
                                <option value="D조">D조 이상</option>
                                <option value="E조">E조 이상</option>
                            </select>
                        </div>
                        <div className="flex-1">
                            <label className="block text-sm font-bold text-gray-700 mb-1">인원 제한</label>
                             <input
                                type="number"
                                value={maxPlayers}
                                onChange={(e) => setMaxPlayers(Math.max(4, parseInt(e.target.value) || 4))}
                                min="4"
                                step="1"
                                className="w-full p-3 bg-gray-100 rounded-lg text-base border border-gray-200 focus:border-[#00B16A] focus:ring-1 focus:ring-[#00B16A] focus:outline-none"
                            />
                        </div>
                    </div>

                    {/* 비밀번호 */}
                    <div>
                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={usePassword}
                                onChange={(e) => setUsePassword(e.target.checked)}
                                className="h-4 w-4 rounded text-[#00B16A] focus:ring-[#00B16A]"
                            />
                            <span className="text-sm font-bold text-gray-700">비밀번호 설정</span>
                        </label>
                        {usePassword && (
                            <input
                                type="password"
                                placeholder="비밀번호 입력"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full p-3 mt-2 bg-gray-100 rounded-lg text-base border border-gray-200 focus:border-[#00B16A] focus:ring-1 focus:ring-[#00B16A] focus:outline-none"
                            />
                        )}
                    </div>

                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 bg-[#00B16A] text-white font-bold rounded-lg text-base hover:bg-green-700 transition-colors disabled:bg-gray-400 flex items-center justify-center"
                        >
                            {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : '모임방 만들기'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ===================================================================================
// 페이지 컴포넌트들 (UI 원칙 적용)
// ===================================================================================

/**
 * [신규] 1. 메인 배너 캐러셀 (요청 #3)
 */
const bannerImages = [
    "https://placehold.co/600x400/00B16A/FFFFFF?text=Event+1",
    "https://placehold.co/600x400/FFD700/000000?text=New+Item",
    "https://placehold.co/600x400/1E1E1E/FFFFFF?text=Sale",
    "https://placehold.co/600x400/008a50/FFFFFF?text=Event+2",
    "https://placehold.co/600x400/F5F5F5/1E1E1E?text=Brand",
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
        timeoutRef.current = setTimeout(nextSlide, 5000); // 5초마다 자동 슬라이드
        return () => resetTimeout();
    }, [currentIndex]);

    const handleDotClick = (index) => {
        setCurrentIndex(index);
    };

    const handleDragStart = (e) => {
        isDraggingRef.current = true;
        dragStartXRef.current = e.clientX || e.touches[0].clientX;
        resetTimeout(); // 드래그 시작 시 자동 슬라이드 정지
        if (containerRef.current) {
            containerRef.current.style.transition = 'none'; // 드래그 중에는 transition 제거
        }
        // [수정] 텍스트 선택 방지 (드래그 시작 시)
        e.preventDefault();
    };

    const handleDragMove = (e) => {
        if (!isDraggingRef.current) return;
        // [수정] 페이지 스크롤 방지 (드래그 이동 시)
        e.preventDefault();
        
        const currentX = e.clientX || e.touches[0].clientX;
        const diff = dragStartXRef.current - currentX;
        
        // 부드러운 드래그를 위해 현재 위치 기준으로 이동
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
            containerRef.current.style.transition = 'transform 0.4s ease-in-out'; // transition 복구
        }

        // 일정 거리 이상 드래그했을 때만 슬라이드 변경
        if (Math.abs(diff) > 50) { // 50px 이상
            if (diff > 0) {
                // 오른쪽으로 스와이프 (다음)
                nextSlide();
            } else {
                // 왼쪽으로 스와이프 (이전)
                setCurrentIndex((prevIndex) =>
                    prevIndex === 0 ? bannerImages.length - 1 : prevIndex - 1
                );
            }
        } else {
            // 원위치
            if (containerRef.current) {
                containerRef.current.style.transform = `translateX(-${currentIndex * 100}%)`;
            }
        }

        // 자동 슬라이드 재시작
        timeoutRef.current = setTimeout(nextSlide, 5000);
    };


    return (
        <section 
            className="relative w-full overflow-hidden rounded-xl shadow-lg"
            onMouseDown={handleDragStart}
            onMouseMove={handleDragMove}
            onMouseUp={handleDragEnd}
            onMouseLeave={handleDragEnd} // 컨테이너 밖으로 나가도 드래그 종료
            onTouchStart={handleDragStart}
            onTouchMove={handleDragMove}
            onTouchEnd={handleDragEnd}
        >
            {/* 1. 슬라이드 컨테이너 */}
            <div 
                ref={containerRef}
                className="flex transition-transform duration-400 ease-in-out"
                style={{ transform: `translateX(-${currentIndex * 100}%)` }}
            >
                {bannerImages.map((src, index) => (
                    <img
                        key={index}
                        src={src}
                        alt={`Banner ${index + 1}`}
                        className="w-full h-40 object-cover flex-shrink-0"
                        draggable="false" // 이미지 기본 드래그 방지
                    />
                ))}
            </div>

            {/* 2. 페이지네이션 (점) */}
            <div className="absolute bottom-3 right-3 flex space-x-1.5">
                {bannerImages.map((_, index) => (
                    <button
                        key={index}
                        onClick={() => handleDotClick(index)}
                        className={`h-1.5 rounded-full bg-white/70 transition-all duration-300 ${
                            currentIndex === index ? 'w-5 bg-white' : 'w-1.5'
                        }`}
                    />
                ))}
            </div>
        </section>
    );
}


/**
 * 2. 홈 페이지
 */
function HomePage({ user, setPage }) {

    // [아이디어 #1] 스켈레톤 로딩을 위한 상태
    const [loading, setLoading] = useState(true);

    // 1.5초 후 로딩 상태 해제 (데이터 로딩 시뮬레이션)
    useEffect(() => {
        const timer = setTimeout(() => {
            setLoading(false);
        }, 1500);
        return () => clearTimeout(timer); // 컴포넌트 언마운트 시 타이머 제거
    }, []);

    // [수정] SectionHeader 컴포넌트 디자인 변경
    const SectionHeader = ({ title, onMoreClick }) => (
        // [수정] mb-4 -> mb-6 (제목-내용간 여백 증가)
        <div className="flex justify-between items-center mb-6">
            {/* [수정] text-xl font-bold -> text-3xl font-extrabold tracking-tighter (H2 강조) */}
            <h2 className="text-3xl font-extrabold text-[#1E1E1E] tracking-tighter">{title}</h2>
            <button 
                onClick={onMoreClick} 
                // [수정] font-semibold text-gray-700 -> font-medium text-gray-500 (더보기 버튼 약화)
                // [수정] transition-colors 추가
                className="text-sm font-medium text-gray-500 hover:text-[#00B16A] flex items-center transition-colors"
            >
                더보기 <ChevronRight size={18} />
            </button>
        </div>
    );

    // [수정] StoreCard 컴포넌트 디자인 변경
    const StoreCard = ({ image, title, brand }) => (
        <div className="w-40 flex-shrink-0 mr-4">
            {/* [수정] shadow-lg -> shadow-md (그림자 약화) */}
            <div className="bg-white rounded-xl shadow-md overflow-hidden">
                <img 
                    src={image || "https://placehold.co/160x128/F5F5F5/BDBDBD?text=Store"} 
                    alt={title} 
                    className="w-full h-32 object-cover bg-gray-200"
                    loading="lazy"
                />
                <div className="p-3">
                    <p className="font-bold text-base text-[#1E1E1E] mt-1 truncate">{title}</p>
                    <p className="text-sm text-gray-500">{brand}</p>
                </div>
            </div>
        </div>
    );

    // [수정] GameCard 컴포넌트 디자인 변경
    const GameCard = ({ title, tags, location, current, total }) => (
        <button 
            onClick={() => setPage('game')}
            // [수정] p-4 -> p-5 (내부 여백 증가)
            // [수정] shadow-lg -> shadow-md (그림자 약화)
            // [수정] transition-transform -> transition-all duration-200 (부드러운 전환)
            className="w-full p-5 bg-white rounded-xl shadow-md text-left transition-all duration-200 transform hover:scale-[1.02]"
        >
            {/* [수정] text-lg font-bold -> text-base font-semibold (H3 약화) */}
            <p className="font-semibold text-base text-[#1E1E1E] mb-2">{title}</p>
            <div className="flex flex-wrap gap-2 mb-3">
                {tags.map((tag, index) => (
                    <span 
                        key={index} 
                        className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-700"
                    >
                        #{tag.label}
                    </span>
                ))}
            </div>
            <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 flex items-center">
                    {/* [수정] 아이콘 크기/여백 조절 (16/mr-1 -> 14/mr-1.5) */}
                    <MapPin size={14} className="mr-1.5" /> {location}
                </span>
                {/* [수정] bg-green-50 -> bg-green-100/80 (색상 일관성 및 투명도) */}
                <span className="text-sm font-medium text-[#00B16A] bg-green-100/80 px-2.5 py-1 rounded-full">
                    {current} / {total}명
                </span>
            </div>
        </button>
    );

    // [수정] CommunityPost 컴포넌트 디자인 변경
    const CommunityPost = ({ category, title, likes }) => (
        <button 
            onClick={() => setPage('community')}
            // [수정] p-4 -> p-5 (내부 여백 증가)
            // [수정] shadow-lg -> shadow-md (그림자 약화)
            // [수정] transition-shadow -> transition-all duration-200 (부드러운 전환)
            // [수정] hover:shadow-md -> hover:shadow-lg (호버 시 그림자 살짝 강조)
            className="p-5 bg-white rounded-xl shadow-md flex justify-between items-center w-full transition-all duration-200 hover:shadow-lg"
        >
            {/* [수정] text-base -> text-base font-medium (본문 제목 두께 살짝) */}
            <p className="truncate text-base font-medium text-[#1E1E1E] flex-1 mr-4">
                <span className={`font-semibold ${category === 'Q&A' ? 'text-[#00B16A]' : 'text-gray-700'} mr-2`}>
                    [{category}]
                </span>
                {title}
            </p>
            {/* [수정] 부가정보(좋아요) 약화: text-sm font-medium -> text-xs font-normal text-gray-400 */}
            <div className="text-xs text-gray-400 whitespace-nowrap flex items-center font-normal transition-colors hover:text-red-500">
                {/* [수정] 아이콘 크기 조절 (16 -> 14) */}
                <Heart size={14} className="mr-1" /> {likes}
            </div>
        </button>
    );

    // =================================================================
    // [신규] '신상 스토어' 마퀴 + 드래그 로직 (수정 완료)
    // =================================================================
    const storeContainerRef = useRef(null);
    const scrollContentRef = useRef(null);
    const scrollAmountRef = useRef(0);
    const animationFrameRef = useRef(null);
    const isDraggingRef = useRef(false);
    const dragStartXRef = useRef(0);
    const scrollLeftRef = useRef(0);
    const lastScrollPosRef = useRef(0); // [신규] 점프 시 위치 보정용
    const contentWidthRef = useRef(0); // [신규] 콘텐츠 총 너비

    // 목업 데이터
    const storeItems = [
        { title: "요넥스 신상 의류", brand: "Yonex", image: "https://placehold.co/160x128/34A853/FFFFFF?text=Yonex+1" },
        { title: "빅터 신상 라켓", brand: "Victor", image: "https://placehold.co/160x128/4285F4/FFFFFF?text=Victor+2" },
        { title: "미즈노 런버드", brand: "Mizuno", image: "https://placehold.co/160x128/EA4335/FFFFFF?text=Mizuno+3" },
        { title: "리닝 에어로넛", brand: "Li-Ning", image: "https://placehold.co/160x128/FBBC05/000000?text=Li-Ning+4" },
        { title: "아디다스 배드민턴", brand: "Adidas", image: "https://placehold.co/160x128/1E1E1E/FFFFFF?text=Adidas+5" },
    ];
    // 무한 루프를 위해 2배로 복제
    const doubledStoreItems = [...storeItems, ...storeItems];

    // 자동 스크롤 애니메이션
    const animateScroll = () => {
        if (!storeContainerRef.current || !scrollContentRef.current || isDraggingRef.current) {
            animationFrameRef.current = requestAnimationFrame(animateScroll);
            return;
        }

        // [수정] 점프 로직 (5번 -> 1번)
        if (scrollAmountRef.current >= contentWidthRef.current) {
            // 5번 -> 1번으로 점프
            scrollAmountRef.current -= contentWidthRef.current;
            lastScrollPosRef.current = scrollAmountRef.current; // 점프한 위치 기록
        } else if (scrollAmountRef.current < 0) {
            // (왼쪽 드래그) 1번 -> 5번으로 점프
             scrollAmountRef.current += contentWidthRef.current;
             lastScrollPosRef.current = scrollAmountRef.current; // 점프한 위치 기록
        } else {
             // 부드럽게 스크롤
            scrollAmountRef.current += 0.5; // 스크롤 속도
            
            // lastScrollPos를 현재 위치로 부드럽게 보간 (드래그 후 부드러운 시작)
            if (Math.abs(lastScrollPosRef.current - scrollAmountRef.current) > 1) {
                 lastScrollPosRef.current += (scrollAmountRef.current - lastScrollPosRef.current) * 0.1;
            } else {
                 lastScrollPosRef.current = scrollAmountRef.current;
            }
        }
        
        storeContainerRef.current.scrollLeft = lastScrollPosRef.current;

        animationFrameRef.current = requestAnimationFrame(animateScroll);
    };

    // [수정] 로딩 상태 변경 시 및 1회만 실행
    useEffect(() => {
        if (loading || !scrollContentRef.current) return;

        // 1세트의 너비(5개 카드)를 계산
        contentWidthRef.current = scrollContentRef.current.scrollWidth / 2;
        
        // 애니메이션 시작
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = requestAnimationFrame(animateScroll);
        
        return () => {
            cancelAnimationFrame(animationFrameRef.current);
        };
    }, [loading]); // 로딩이 끝나면 너비를 다시 계산하고 애니메이션 시작

    // [신규] '신상 스토어' 드래그 시작 핸들러
    const handleStoreDragStart = (e) => {
        // [수정] e.preventDefault() 추가 (텍스트 선택 등 기본 동작 방지)
        e.preventDefault();
        
        isDraggingRef.current = true;
        dragStartXRef.current = e.clientX || e.touches[0].clientX;
        scrollLeftRef.current = storeContainerRef.current.scrollLeft;
        storeContainerRef.current.style.cursor = 'grabbing';
    };

    // [신규] '신상 스토어' 드래그 이동 핸들러
    const handleStoreDragMove = (e) => {
        if (!isDraggingRef.current) return;
        
        // [수정] e.preventDefault() 추가 (페이지 스크롤, 새로고침 등 방지)
        e.preventDefault(); 
        
        const currentX = e.clientX || e.touches[0].clientX;
        const dx = currentX - dragStartXRef.current; // 시작점으로부터의 변화량
        
        // [수정] scrollAmountRef와 lastScrollPosRef를 직접 업데이트
        scrollAmountRef.current = scrollLeftRef.current - dx;
        lastScrollPosRef.current = scrollAmountRef.current;
        storeContainerRef.current.scrollLeft = scrollAmountRef.current;
    };

    // [신규] '신상 스토어' 드래그 종료 핸들러
    const handleStoreDragEnd = () => {
        isDraggingRef.current = false;
        if (storeContainerRef.current) {
            storeContainerRef.current.style.cursor = 'grab';
        }
        // 자동 스크롤이 animateScroll 루프에서 자동으로 재개됨
    };
    
    // [신규] 터치 이벤트 수동 등록 (Passive 오류 방지)
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
    }, [storeContainerRef.current]); // [수정] ref.current를 의존성으로


   // ... HomePage 함수 내부 ...

return (
    <div className="flex-grow p-6 space-y-10">

            {/* (1) 섹션: 메인 배너 */}
            <MainBanner />

            {/* (2) 섹션: 신상 스토어 */}
            <section>
                <SectionHeader title="신상 스토어" onMoreClick={() => setPage('store')} />
                {/* ... (마퀴 스크롤 로직) ...
                    [수정] 스켈레톤 카드 내부 디자인도 shadow-lg -> shadow-md로 변경됩니다. (SkeletonStoreCard 확인)
                */}
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

            {/* (3) 섹션: 지금 뜨는 경기 */}
            <section>
                <SectionHeader title="지금 뜨는 경기" onMoreClick={() => setPage('game')} />
                <div className="space-y-4">
                    {loading ? (
                        <>
                            <SkeletonCard />
                            <SkeletonCard />
                        </>
                    ) : (
                        <>
                            <GameCard 
                                title="오산시 저녁 8시 초심 환영" 
                                tags={[{label: '초심'}, {label: '오산시'}]}
                                location="OO 체육관"
                                current={8}
                                total={12}
                            />
                            <GameCard 
                                title="수원시 주말 40대 A조 모임" 
                                tags={[{label: 'A조'}, {label: '수원시'}, {label: '40대'}]}
                                location="XX 체육관"
                                current={10}
                                total={16}
                            />
                        </>
                    )}
                </div>
            </section>

            {/* (4) 섹션: 커뮤니티 인기글 */}
            <section>
                <SectionHeader title="커뮤니티 인기글" onMoreClick={() => setPage('community')} />
                <div className="space-y-3">
                    {loading ? (
                         <>
                            <SkeletonCard />
                            <SkeletonCard />
                            <SkeletonCard />
                        </>
                    ) : (
                        <>
                            <CommunityPost category="Q&A" title="이 라켓 써보신 분 후기 있으신가요?" likes={12} />
                            <CommunityPost category="자유글" title="C조 탈출하는 법.txt 공유합니다" likes={8} />
                            <CommunityPost category="중고" title="[판매] 빅터 제트스피드 S12 팝니다" likes={5} />
                        </>
                    )}
                </div>
            </section>

        </div>
    );
}


/**
 * 3. 경기 시스템 페이지 (구현 시작)
 */
function GamePage({ user, userData, onLoginClick }) {
    // [신규] '로비' / '경기방' 뷰 전환
    const [currentView, setCurrentView] = useState('lobby'); // 'lobby', 'room'
    const [selectedRoomId, setSelectedRoomId] = useState(null);

    // [신규] 로비 상태
    const [rooms, setRooms] = useState([]);
    const [loadingRooms, setLoadingRooms] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    
    // [신규] 모임 생성 모달 관련 상태
    const [showCreateRoomModal, setShowCreateRoomModal] = useState(false);

    // [신규] Firestore 'rooms' 컬렉션 경로
    const roomsCollectionRef = collection(db, "rooms");

    // [신규] 모임방 목록 실시간 구독 (로비 뷰가 활성화될 때)
    useEffect(() => {
        if (!user || currentView !== 'lobby') {
            setLoadingRooms(false); // 로그아웃 상태거나 로비가 아니면 로딩 중지
            return;
        }

        setLoadingRooms(true);
        // [수정] orderBy("createdAt", "desc") 쿼리 제거.
        // serverTimestamp()로 생성되는 문서를 쿼리에서 바로 정렬하면 l.toDate 오류가 발생합니다.
        const q = query(roomsCollectionRef); 

        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const roomsData = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // [신규] 클라이언트(JS)에서 직접 정렬합니다.
            roomsData.sort((a, b) => {
                const timeA = a.createdAt;
                const timeB = b.createdAt;

                // .toDate 함수가 있는 실제 Timestamp 객체만 비교
                if (timeA && typeof timeA.toDate === 'function' && timeB && typeof timeB.toDate === 'function') {
                    return timeB.toDate().getTime() - timeA.toDate().getTime(); // 'desc' (최신순)
                }
                // 임시 값(null 등)은 정렬 순서를 유지
                if (timeA) return -1; // timeA가 임시값이면 (최신) 맨 위로
                if (timeB) return 1;
                return 0;
            });

            setRooms(roomsData);
            setLoadingRooms(false);
        }, (error) => {
            console.error("Error fetching rooms: ", error);
            setLoadingRooms(false);
        });

        // 클린업 함수
        return () => unsubscribe();
    }, [user, currentView, roomsCollectionRef]); // [수정] 의존성 배열에 roomsCollectionRef 추가

    // [신규] 검색어 필터링
    const filteredRooms = useMemo(() => {
        return rooms.filter(room => 
            room.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            room.location.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [rooms, searchTerm]);

    // [신규] 모임 생성 (Modal에서 호출)
    const handleCreateRoom = async (newRoomData) => {
        if (!user) {
            onLoginClick(); // 혹시 모를 비로그인 상태 방지
            return;
        }
        
        // addDoc은 자동으로 Promise를 반환하므로, 모달에서 await 처리
        const docRef = await addDoc(roomsCollectionRef, newRoomData);
        
        // 방 생성 후 바로 입장
        handleEnterRoom(docRef.id);
    };

    // [신규] 모임방 입장
    const handleEnterRoom = (roomId) => {
        setSelectedRoomId(roomId);
        setCurrentView('room');
    };

    // [신규] 모임방 나가기 (GameRoomView에서 호출)
    const handleExitRoom = () => {
        setSelectedRoomId(null);
        setCurrentView('lobby');
    };


    // 1. 로그인 필요 뷰
    if (!user || !userData) {
        return (
            <LoginRequiredPage
                icon={ShieldCheck}
                title="로그인 필요"
                description="경기/모임 시스템은 로그인 후 이용 가능합니다."
                onLoginClick={onLoginClick}
            />
        );
    }
    
    // 2-1. 경기방 뷰
    if (currentView === 'room') {
        return (
            <GameRoomView 
                roomId={selectedRoomId}
                user={user}
                userData={userData}
                onExitRoom={handleExitRoom} 
                roomsCollectionRef={roomsCollectionRef} // [신규] ref 전달
            />
        );
    }

    // 2-2. 로비 뷰 (기본)
    return (
        <div className="relative h-full flex flex-col">
            {/* 로비 헤더 (검색창) */}
            <div className="p-4 bg-white border-b border-gray-200">
                <div className="relative">
                    <input
                        type="text"
                        placeholder="모임방 이름 또는 장소 검색"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full p-3 pl-10 bg-gray-100 rounded-lg text-base border border-gray-200 focus:border-[#00B16A] focus:ring-1 focus:ring-[#00B16A] focus:outline-none"
                    />
                    <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                </div>
            </div>

            {/* 로비 본문 (방 목록) */}
            <main className="flex-grow overflow-y-auto bg-gray-50 p-4 space-y-4 hide-scrollbar">
                {loadingRooms ? (
                    <>
                        <SkeletonRoomCard />
                        <SkeletonRoomCard />
                        <SkeletonRoomCard />
                    </>
                ) : filteredRooms.length > 0 ? (
                    filteredRooms.map(room => (
                        <RoomCard 
                            key={room.id} 
                            room={room} 
                            onEnter={() => handleEnterRoom(room.id)}
                        />
                    ))
                ) : (
                    <EmptyState
                        icon={Archive}
                        title="개설된 모임방이 없습니다"
                        description={searchTerm ? "검색 결과가 없습니다." : "새로운 모임방을 만들어보세요!"}
                    />
                )}
            </main>

            {/* 모임 생성 (CTA) 버튼 */}
            <button
                onClick={() => setShowCreateRoomModal(true)}
                className="absolute bottom-6 right-6 bg-[#00B16A] text-white w-14 h-14 rounded-full shadow-lg shadow-green-500/30 flex items-center justify-center transition-transform transform hover:scale-110"
            >
                <Plus size={28} />
            </button>

            {/* 모임 생성 모달 */}
            <CreateRoomModal
                isOpen={showCreateRoomModal}
                onClose={() => setShowCreateRoomModal(false)}
                onSubmit={handleCreateRoom}
                user={user}
                userData={userData}
            />
        </div>
    );
}

// [신규] 로비의 모임방 카드 컴포넌트
function RoomCard({ room, onEnter }) {
    const levelColor = room.levelLimit === 'N조' ? 'text-gray-500' : 'text-[#00B16A]';
    
    // Firestore Timestamp를 Date 객체로 변환
    const formatDate = (timestamp) => {
        // [수정] timestamp가 존재하고, .toDate 메서드를 가지고 있는지 *먼저* 확인합니다.
        if (timestamp && typeof timestamp.toDate === 'function') {
            const date = timestamp.toDate();
            // 예: 11. 07 (금) 13:05
            return `${date.getMonth() + 1}. ${date.getDate()} (${'일월화수목금토'[date.getDay()]}) ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
        }
        
        // .toDate가 없거나 timestamp가 null이면 (예: 서버가 아직 쓰기 전)
        return '방금 전'; // 오류 대신 '방금 전'으로 표시
    };

    return (
        <div 
            className="bg-white rounded-xl shadow-lg p-4 cursor-pointer transition-shadow hover:shadow-md"
            onClick={onEnter}
        >
            <div className="flex justify-between items-start mb-2">
                <h3 className="text-lg font-bold text-[#1E1E1E] mr-2">{room.name}</h3>
                {room.password && (
                    <Lock size={16} className="text-gray-400 flex-shrink-0" />
                )}
            </div>
            
            <p className="text-sm text-gray-600 mb-3 truncate">
                <MapPin size={14} className="inline mr-1" />
                {room.location}
            </p>

            <div className="flex flex-wrap gap-2 items-center text-sm">
                <span className="flex items-center gap-1 px-3 py-1 bg-gray-100 rounded-full text-gray-700 font-medium">
                    <Users size={14} />
                    {room.playerCount || 0} / {room.maxPlayers}
                </span>
                <span className={`flex items-center gap-1 px-3 py-1 bg-gray-100 rounded-full font-medium ${levelColor}`}>
                    <BarChart2 size={14} />
                    {room.levelLimit === 'N조' ? '전체 급수' : `${room.levelLimit} 이상`}
                </span>
                <span className="flex items-center gap-1 px-3 py-1 bg-gray-100 rounded-full text-gray-500 font-medium">
                    <Clock size={14} />
                    {formatDate(room.createdAt)}
                </span>
            </div>
        </div>
    );
}

// ===================================================================================
// [신규] 경기방 내부 컴포넌트 (PlayerCard, EmptySlot)
// ===================================================================================

/**
 * [신규] 플레이어 카드
 * 구버전 App (1).jsx의 PlayerCard 로직을 콕스타 디자인으로 재구성
 */
const PlayerCard = React.memo(({ 
    player, 
    isAdmin, 
    isCurrentUser, 
    isPlaying,
    isResting,
    onDragStart,
    onDragEnd,
    onDragOver,
    onDrop
}) => {
    if (!player) {
        // 플레이어 데이터가 로드되기 전일 수 있음
        return <div className="h-20 bg-gray-100 rounded-lg animate-pulse"></div>;
    }

    const levelStyle = getLevelColor(player.level);
    const genderColor = player.gender === '남' ? 'border-l-blue-500' : 'border-l-pink-500';

    // 카드 스타일
    let cardClasses = `bg-white rounded-lg shadow-sm p-3 h-20 flex flex-col justify-between relative border-l-4 transition-all ${genderColor}`;
    
    if (isPlaying) {
        cardClasses += " opacity-50 bg-gray-100"; // 경기 중
    }
    if (isResting) {
        cardClasses += " opacity-50 grayscale"; // 휴식 중
    }
    if (isCurrentUser) {
        cardClasses += " ring-2 ring-offset-1 ring-[#FFD700]"; // 현재 유저 (노랑 테두리)
    }

    // 관리자만 드래그 가능
    const canDrag = isAdmin;

    return (
        <div
            className={cardClasses}
            draggable={canDrag}
            onDragStart={canDrag ? (e) => onDragStart(e, player.id) : undefined}
            onDragEnd={canDrag ? onDragEnd : undefined}
            onDragOver={canDrag ? onDragOver : undefined}
            onDrop={canDrag ? (e) => onDrop(e, { type: 'player', player: player }) : undefined}
        >
            {/* 상단: 이름, 성별 */}
            <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-[#1E1E1E] truncate pr-4">
                    {player.name}
                </span>
                {canDrag && (
                    <GripVertical size={16} className="text-gray-400 absolute top-2 right-1 cursor-grab" />
                )}
            </div>
            
            {/* 하단: 급수, 게임 수 */}
            <div className="flex justify-between items-center text-xs">
                <span className={`font-bold ${levelStyle}`}>{player.level || 'N조'}</span>
                <span className="text-gray-500 font-medium">
                    {player.todayGames || 0}G
                </span>
            </div>
        </div>
    );
});

/**
 * [신규] 빈 슬롯
 * 구버전 App (1).jsx의 EmptySlot 로직을 콕스타 디자인으로 재구성
 */
const EmptySlot = ({ onDragOver, onDrop, isDragOver }) => (
    <div 
        onDragOver={onDragOver} 
        onDrop={onDrop}
        className={`h-20 bg-gray-100/50 rounded-lg flex items-center justify-center text-gray-400 border-2 border-dashed border-gray-300 transition-all ${
            isDragOver ? 'bg-green-100 border-green-400' : ''
        }`}
    >
        <Plus size={20} />
    </div>
);


// [신규] 경기방 뷰 컴포넌트 (로직 구현)
function GameRoomView({ roomId, user, userData, onExitRoom, roomsCollectionRef }) {
    const [roomData, setRoomData] = useState(null);
    const [players, setPlayers] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    const [activeTab, setActiveTab] = useState('matching'); // 'matching', 'inProgress'

    // [신규] 드래그 앤 드롭 상태
    const [draggedPlayerId, setDraggedPlayerId] = useState(null);
    const [dragOverSlot, setDragOverSlot] = useState(null); // { matchIndex, slotIndex }

    // [신규] Firestore 경로
    const roomDocRef = doc(roomsCollectionRef, roomId);
    const playersCollectionRef = collection(roomDocRef, "players");
    
    // [신규] 방 정보 및 플레이어 목록 실시간 구독
    useEffect(() => {
        setLoading(true);

        // 1. 방 정보 구독
        const unsubRoom = onSnapshot(roomDocRef, (doc) => {
            if (doc.exists()) {
                setRoomData({ id: doc.id, ...doc.data() });
            } else {
                setError("모임방을 찾을 수 없습니다.");
                setLoading(false);
                onExitRoom(); // [수정] 방이 없으면 자동 나가기
            }
        }, (err) => {
            console.error("Error fetching room data:", err);
            setError("모임방 정보를 불러오는 데 실패했습니다.");
            setLoading(false);
        });

        // 2. 플레이어 목록 구독
        // [수정] orderBy("entryTime", "asc") 제거.
        // serverTimestamp()와 클라이언트 orderBy는 충돌을 일으켜 'l.toDate' 오류를 발생시킵니다.
        const unsubPlayers = onSnapshot(playersCollectionRef, (snapshot) => {
            // [신규] 데이터를 먼저 배열로 변환
            const playersDataArray = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // [신규] 클라이언트(JS)에서 직접 정렬
            playersDataArray.sort((a, b) => {
                const timeA = a.entryTime;
                const timeB = b.entryTime;

                // entryTime이 실제 Timestamp 객체일 때만 .toDate()로 비교
                if (timeA && typeof timeA.toDate === 'function' && timeB && typeof timeB.toDate === 'function') {
                    return timeA.toDate().getTime() - timeB.toDate().getTime(); // 'asc' (오래된 순)
                }
                // null이나 임시 값(아직 서버에 기록 안 됨)은 정렬 순서를 유지하거나 뒤로 보냅니다.
                if (timeA) return -1;
                if (timeB) return 1;
                return 0;
            });

            // [수정] 정렬된 배열을 reduce로 다시 {id: player} 형태의 객체로 변환
            const playersData = playersDataArray.reduce((acc, player) => {
                acc[player.id] = player;
                return acc;
            }, {});
            
            setPlayers(playersData);
            setLoading(false); // 플레이어 목록까지 받아야 로딩 완료
        }, (err) => {
            console.error("Error fetching players:", err);
            setError("플레이어 목록을 불러오는 데 실패했습니다.");
            setLoading(false);
        });
        
        // 3. (중요) 현재 유저가 'players' 목록에 없으면 추가 (즉, 입장 처리)
        const playerDocRef = doc(playersCollectionRef, user.uid);
        getDoc(playerDocRef).then(playerDoc => {
            if (!playerDoc.exists()) {
                setDoc(playerDocRef, {
                    name: userData.name, // [수정] user.displayName 대신 userData.name
                    email: userData.email, // [수정] user.email 대신 userData.email
                    level: userData.level || 'N조',
                    gender: userData.gender || '미설정',
                    todayGames: 0,
                    isResting: false,
                    entryTime: serverTimestamp() 
                }).catch(err => console.error("Failed to add player to room:", err));
            }
        });

        // 클린업 함수
        return () => {
            unsubRoom();
            unsubPlayers();
            
            // (중요) 방에서 나갈 때 'players' 목록에서 자신을 제거
            deleteDoc(playerDocRef).catch(err => {
                console.warn("Failed to remove player on exit:", err);
            });
        };
    }, [roomId, user.uid, userData, onExitRoom, playersCollectionRef, roomDocRef]); // [수정] 의존성 배열

    
    // =================================================
    // [신규] 헬퍼 (Memoized)
    // =================================================

    // 현재 유저가 방장인지 확인
    const isAdmin = useMemo(() => user.uid === roomData?.adminUid, [user.uid, roomData?.adminUid]);

    // '경기 진행' 중인 플레이어 ID Set (빠른 조회용)
    const inProgressPlayerIds = useMemo(() => 
        new Set((roomData?.inProgressCourts || []).flatMap(c => c?.players || []).filter(Boolean))
    , [roomData?.inProgressCourts]);

    // '경기 예정' 중인 플레이어 ID Set (빠른 조회용)
    const scheduledPlayerIds = useMemo(() => 
        new Set(Object.values(roomData?.scheduledMatches || {}).flatMap(match => match || []).filter(Boolean))
    , [roomData?.scheduledMatches]);

    // '대기 명단' 플레이어 목록 (정렬 포함)
    const waitingPlayers = useMemo(() => 
        Object.values(players)
            .filter(p => 
                !p.isResting && 
                !inProgressPlayerIds.has(p.id) && 
                !scheduledPlayerIds.has(p.id)
            )
            .sort((a, b) => (LEVEL_ORDER[a.level] || 99) - (LEVEL_ORDER[b.level] || 99)) // 급수 정렬
    , [players, inProgressPlayerIds, scheduledPlayerIds]);
    
    // '휴식 중' 플레이어 목록
    const restingPlayers = useMemo(() =>
        Object.values(players).filter(p => p.isResting)
    , [players]);

    // =================================================
    // [신규] 드래그 앤 드롭 핸들러
    // =================================================

    const handleDragStart = (e, playerId) => {
        if (!isAdmin) return;
        e.dataTransfer.setData("playerId", playerId);
        setDraggedPlayerId(playerId);
    };

    const handleDragEnd = () => {
        setDraggedPlayerId(null);
        setDragOverSlot(null);
    };

    const handleDragOver = (e, target) => {
        e.preventDefault();
        if (!isAdmin) return;
        
        if (target?.type === 'slot') {
            setDragOverSlot({ matchIndex: target.matchIndex, slotIndex: target.slotIndex });
        } else {
            setDragOverSlot(null); // 대기열이나 다른 곳 위
        }
    };

    const handleDrop = async (e, target) => {
        e.preventDefault();
        if (!isAdmin || !draggedPlayerId) return;

        const sourcePlayerId = draggedPlayerId;
        const currentScheduledMatches = JSON.parse(JSON.stringify(roomData.scheduledMatches || {}));

        // 1. 드래그 소스(Source) 위치 찾기 및 제거
        let sourceFound = false;
        Object.keys(currentScheduledMatches).forEach(mIdx => {
            const sIdx = currentScheduledMatches[mIdx].indexOf(sourcePlayerId);
            if (sIdx > -1) {
                currentScheduledMatches[mIdx][sIdx] = null; // 소스 위치에서 제거
                sourceFound = true;
            }
        });

        // 2. 드롭 타겟(Target)에 플레이어 배치
        if (target.type === 'slot') {
            // "경기 예정" 슬롯에 놓은 경우
            const { matchIndex, slotIndex } = target;
            if (!currentScheduledMatches[matchIndex]) {
                currentScheduledMatches[matchIndex] = Array(PLAYERS_PER_MATCH).fill(null);
            }
            
            // 타겟 슬롯에 이미 누가 있는지 확인 (스왑용)
            const playerInTargetSlot = currentScheduledMatches[matchIndex][slotIndex];

            // 타겟 슬롯에 드래그한 플레이어 배치
            currentScheduledMatches[matchIndex][slotIndex] = sourcePlayerId;

            // 3. 스왑(Swap) 로직
            if (playerInTargetSlot && sourceFound) {
                // 소스 위치를 다시 찾아야 함 (null이 되었으므로)
                let swapped = false; // [수정] 스왑이 한 번만 일어나도록 플래그 추가
                Object.keys(currentScheduledMatches).forEach(mIdx => {
                    if (swapped) return; // 이미 스왑했으면 종료
                    const sIdx = currentScheduledMatches[mIdx].indexOf(null); // 방금 null로 만든 소스 위치
                    if (sIdx > -1) {
                         // playerInTargetSlot을 원래 소스 위치로 이동
                        currentScheduledMatches[mIdx][sIdx] = playerInTargetSlot;
                        sourceFound = false; // 스왑 완료
                        swapped = true; // [수정] 플래그 설정
                    }
                });
            }

        } else if (target.type === 'player' && sourceFound) {
            // (스왑 로직) 다른 플레이어 카드 위에 놓은 경우
            const targetPlayerId = target.player.id;

            // 타겟 플레이어 위치 찾기
            let targetLoc = null;
            Object.keys(currentScheduledMatches).forEach(mIdx => {
                const sIdx = currentScheduledMatches[mIdx].indexOf(targetPlayerId);
                if (sIdx > -1) {
                    targetLoc = { matchIndex: mIdx, slotIndex: sIdx };
                }
            });

            if (targetLoc) {
                // 타겟 위치에 소스 플레이어 배치
                currentScheduledMatches[targetLoc.matchIndex][targetLoc.slotIndex] = sourcePlayerId;
                
                // [수정] 스왑 로직 플래그 추가
                let swapped = false;
                // 소스 위치를 다시 찾아 타겟 플레이어 배치
                Object.keys(currentScheduledMatches).forEach(mIdx => {
                    if (swapped) return;
                    const sIdx = currentScheduledMatches[mIdx].indexOf(null); // 방금 null로 만든 소스 위치
                    if (sIdx > -1) {
                        currentScheduledMatches[mIdx][sIdx] = targetPlayerId;
                        sourceFound = false;
                        swapped = true;
                    }
                });
            }
        }
        // else if (target.type === 'waiting') {
        //    // '대기 명단'에 놓은 경우 (1번 로직에서 이미 제거됨)
        // }
        
        // 4. Firestore 업데이트
        try {
            await updateDoc(roomDocRef, { scheduledMatches: currentScheduledMatches });
        } catch (err) {
            console.error("Failed to update matches:", err);
            // (에러 처리)
        }

        setDraggedPlayerId(null);
        setDragOverSlot(null);
    };


    // --- 렌더링 ---
    
    if (loading) {
        return (
            <div className="flex-grow flex items-center justify-center bg-white">
                <LoadingSpinner text="모임방 입장 중..." />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex-grow flex flex-col items-center justify-center bg-white p-4">
                <AlertCircle size={48} className="text-red-500 mb-4" />
                <h3 className="text-lg font-bold text-red-600 mb-2">오류 발생</h3>
                <p className="text-gray-600 text-center mb-6">{error}</p>
                <button
                    onClick={onExitRoom}
                    className="px-6 py-2 bg-gray-600 text-white text-sm font-bold rounded-lg shadow-md hover:bg-gray-700 transition-colors"
                >
                    로비로 돌아가기
                </button>
            </div>
        );
    }
    
    return (
        <div className="flex flex-col h-full bg-white">
            {/* 1. 경기방 헤더 */}
            <header className="flex-shrink-0 p-4 flex items-center justify-between gap-2 bg-white sticky top-16 z-10 border-b border-gray-200">
                <div className="flex items-center gap-2 min-w-0">
                    <button 
                        onClick={onExitRoom} 
                        className="mr-1 p-2 rounded-full text-gray-500 hover:bg-gray-100 hover:text-[#1E1E1E] transition-colors"
                    >
                        <ArrowLeft size={24} />
                    </button>
                    <h1 className="text-xl font-bold text-[#1E1E1E] truncate">
                        {roomData?.name || '로딩 중...'}
                    </h1>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-sm font-semibold text-gray-600 flex items-center gap-1">
                        <Users size={16} /> {Object.keys(players).length}
                    </span>
                    {/* [신규] 관리자 배지 */}
                    {isAdmin && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded bg-[#FFD700] text-black">
                            방장
                        </span>
                    )}
                </div>
            </header>

            {/* 2. 탭 네비게이션 (과거 앱 구조 참고) */}
            <nav className="flex-shrink-0 flex bg-white border-b border-gray-200 sticky top-[137px] z-10">
                <button
                    onClick={() => setActiveTab('matching')}
                    className={`flex-1 py-3 text-center text-sm font-bold border-b-2 ${
                        activeTab === 'matching' ? 'border-[#00B16A] text-[#00B16A]' : 'border-transparent text-gray-500'
                    }`}
                >
                    매칭
                </button>
                <button
                    onClick={() => setActiveTab('inProgress')}
                    className={`flex-1 py-3 text-center text-sm font-bold border-b-2 ${
                        activeTab === 'inProgress' ? 'border-[#00B16A] text-[#00B16A]' : 'border-transparent text-gray-500'
                    }`}
                >
                    경기 진행
                </button>
            </nav>

            {/* 3. 탭 콘텐츠 (과거 앱 구조 참고) */}
            <main className="flex-grow overflow-y-auto p-4 bg-gray-50 hide-scrollbar">
                {activeTab === 'matching' ? (
                    /* "매칭" 탭 */
                    <div className="space-y-6">
                        {/* [수정] 대기 명단 섹션 */}
                        <section 
                            className="bg-white rounded-xl shadow-sm p-4"
                            onDragOver={(e) => handleDragOver(e, { type: 'waiting' })}
                            onDrop={(e) => handleDrop(e, { type: 'waiting' })}
                        >
                            <h2 className="text-lg font-bold text-[#1E1E1E] mb-3">대기 명단 ({waitingPlayers.length})</h2>
                            {waitingPlayers.length > 0 ? (
                                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                    {waitingPlayers.map(p => (
                                        <PlayerCard 
                                            key={p.id} 
                                            player={p} 
                                            isAdmin={isAdmin}
                                            isCurrentUser={user.uid === p.id}
                                            isPlaying={false}
                                            isResting={p.isResting}
                                            onDragStart={handleDragStart}
                                            onDragEnd={handleDragEnd}
                                            onDragOver={(e) => handleDragOver(e, { type: 'player', player: p })}
                                            onDrop={handleDrop}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-gray-500 text-center py-4">대기 중인 선수가 없습니다.</p>
                            )}
                        </section>

                        {/* [수정] 경기 예정 섹션 */}
                        <section className="bg-white rounded-xl shadow-sm p-4">
                            <h2 className="text-lg font-bold text-[#1E1E1E] mb-3">경기 예정</h2>
                            {roomData?.numScheduledMatches > 0 ? (
                                <div className="space-y-3">
                                    {Array.from({ length: roomData.numScheduledMatches }).map((_, matchIndex) => {
                                        const match = roomData.scheduledMatches?.[matchIndex] || Array(PLAYERS_PER_MATCH).fill(null);
                                        const playerCount = match.filter(Boolean).length;

                                        return (
                                            <div key={matchIndex} className="bg-gray-50 rounded-lg p-2 border border-gray-200">
                                                <div className="flex justify-between items-center mb-2 px-1">
                                                    <span className="font-bold text-gray-700">매치 {matchIndex + 1}</span>
                                                    {/* (TODO) '경기 시작' 버튼 */}
                                                    <button 
                                                        className={`px-3 py-1 text-sm font-bold rounded-md ${
                                                            playerCount === PLAYERS_PER_MATCH 
                                                            ? 'bg-[#00B16A] text-white' 
                                                            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                                        }`}
                                                        disabled={playerCount !== PLAYERS_PER_MATCH}
                                                    >
                                                        경기 시작
                                                    </button>
                                                </div>
                                                <div className="grid grid-cols-4 gap-2">
                                                    {match.map((playerId, slotIndex) => {
                                                        const player = playerId ? players[playerId] : null;
                                                        const isDragOver = dragOverSlot?.matchIndex === matchIndex && dragOverSlot?.slotIndex === slotIndex;
                                                        
                                                        return player ? (
                                                            <PlayerCard
                                                                key={player.id}
                                                                player={player}
                                                                isAdmin={isAdmin}
                                                                isCurrentUser={user.uid === player.id}
                                                                isPlaying={inProgressPlayerIds.has(player.id)}
                                                                isResting={player.isResting}
                                                                onDragStart={handleDragStart}
                                                                onDragEnd={handleDragEnd}
                                                                onDragOver={(e) => handleDragOver(e, { type: 'slot', matchIndex, slotIndex })}
                                                                onDrop={(e) => handleDrop(e, { type: 'slot', matchIndex, slotIndex })}
                                                            />
                                                        ) : (
                                                            <EmptySlot
                                                                key={slotIndex}
                                                                isDragOver={isDragOver}
                                                                onDragOver={(e) => handleDragOver(e, { type: 'slot', matchIndex, slotIndex })}
                                                                onDrop={(e) => handleDrop(e, { type: 'slot', matchIndex, slotIndex })}
                                                            />
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <EmptyState icon={Trophy} title="예정된 경기가 없습니다" description="방장이 경기를 배정할 때까지 기다려주세요." />
                            )}
                        </section>

                         {/* [신규] 휴식 중인 선수 섹션 */}
                         <section className="bg-white rounded-xl shadow-sm p-4">
                            <h2 className="text-lg font-bold text-[#1E1E1E] mb-3">휴식 중 ({restingPlayers.length})</h2>
                            {restingPlayers.length > 0 ? (
                                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                    {restingPlayers.map(p => (
                                        <PlayerCard 
                                            key={p.id} 
                                            player={p} 
                                            isAdmin={isAdmin}
                                            isCurrentUser={user.uid === p.id}
                                            isPlaying={false}
                                            isResting={p.isResting}
                                            onDragStart={() => {}} // 드래그 방지
                                            onDragEnd={() => {}}
                                            onDragOver={(e) => e.preventDefault()}
                                            onDrop={() => {}}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-gray-500 text-center py-4">휴식 중인 선수가 없습니다.</p>
                            )}
                        </section>
                    </div>
                ) : (
                    /* "경기 진행" 탭 */
                    <div className="space-y-6">
                        <section className="bg-white rounded-xl shadow-sm p-4">
                            <h2 className="text-lg font-bold text-[#1E1E1E] mb-3">경기 진행 중 (TODO)</h2>
                            <EmptyState
                                icon={Trophy}
                                title="진행 중인 경기가 없습니다"
                                description="'매칭' 탭에서 경기를 배정한 후 '경기 시작'을 눌러주세요."
                            />
                        </section>
                    </div>
                )}
            </main>
        </div>
    );
}

/**
 * 4. 스토어 페이지
 */
function StorePage() {
    return (
        <ComingSoonPage
            icon={ShoppingBag}
            title="브랜드 스토어"
            description="여러 배드민턴 브랜드 용품을 모아보는 쇼핑몰 기능을 준비 중입니다."
        />
    );
}

/**
 * 5. 커뮤니티 페이지
 */
function CommunityPage() {
    return (
        <div className="relative h-full">
            <ComingSoonPage
                icon={MessageSquare}
                title="커뮤니티"
                description="정보 공유, Q&A, 클럽 홍보, 중고마켓 게시판을 열심히 만들고 있습니다."
            />
            {/* (아이디어 #2) CTA 버튼 그림자 */}
            <button
                onClick={() => alert('글쓰기 기능 준비 중')}
                className="absolute bottom-6 right-6 bg-[#00B16A] text-white w-14 h-14 rounded-full shadow-lg shadow-green-500/30 flex items-center justify-center transition-transform transform hover:scale-110"
            >
                <Plus size={28} />
            </button>
        </div>
    );
}

/**
 * 6. 내 정보 페이지
 */
function MyInfoPage({ user, userData, onLoginClick, onLogout, setPage }) { // setPage 프롭스 추가

    if (!user) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center text-[#1E1E1E] p-8">
                <User className="w-24 h-24 mb-6 text-[#BDBDBD]" />
                <h2 className="text-2xl font-bold mb-4">로그인이 필요합니다</h2>
                <p className="text-gray-500 mb-8 text-base">로그인하고 '콕스타'의 모든 기능을 이용해보세요!</p>
                <button
                    onClick={onLoginClick}
                    className="px-10 py-3 bg-[#FFD700] text-black font-bold rounded-lg shadow-lg text-base transition-transform transform hover:scale-105"
                >
                    로그인 / 회원가입
                </button>
            </div>
        );
    }

    if (!userData) {
        return <LoadingSpinner text="내 정보 불러오는 중..." />;
    }

    return (
        <div className="p-5 text-[#1E1E1E] space-y-6"> {/* 여백 조정 */}
            <h1 className="text-2xl font-bold mb-2">내 정보</h1> {/* mb-8 -> mb-2 */}
            
            <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex items-center space-x-5">
                    <div className="w-20 h-20 bg-[#00B16A] rounded-full flex items-center justify-center">
                        <User className="w-12 h-12 text-white" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold">{userData?.name || '사용자'}</h2>
                        <p className="text-gray-600 text-base">{userData?.email || user.email}</p>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-semibold mb-4 text-[#00B16A]">나의 프로필</h3>
                <div className="space-y-3 text-base">
                    <div className="flex justify-between">
                        <span className="text-gray-500">급수</span>
                        <span className="font-semibold">{userData?.level || '미설정'}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-500">성별</span>
                        <span className="font-semibold">{userData?.gender || '미설정'}</span>
                    </div>
                    {/* [신규] 이메일 정보 추가 (userData에서 가져오기) */}
                    <div className="flex justify-between">
                        <span className="text-gray-500">이메일</span>
                        <span className="font-semibold truncate max-w-[200px]">{userData?.email || '미설정'}</span>
                    </div>
                </div>
                 <button className="mt-6 w-full py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-base font-bold">
                    프로필 수정 (준비 중)
                </button>
            </div>

            {/* [아이디어 #3] 빈 화면(Empty State) 적용 예시 */}
            <div className="bg-white rounded-xl shadow-lg p-6">
                 <h3 className="text-lg font-semibold mb-4 text-[#00B16A]">찜한 아이템</h3>
                 <EmptyState
                    icon={Archive}
                    title="찜한 아이템이 없습니다"
                    description="스토어에서 마음에 드는 상품을 찜해보세요!"
                    buttonText="스토어 둘러보기"
                    onButtonClick={() => setPage('store')}
                 />
            </div>

            <button
                onClick={onLogout}
                className="w-full py-4 bg-red-600 text-white font-bold rounded-lg text-base hover:bg-red-700 transition-colors"
            >
                로그아웃
            </button>
        </div>
    );
}

/**
 * 홈 페이지 헤더
 */
function HomePageHeader({ onSearchClick, onBellClick }) {
    return (
        // [수정] bg-white -> bg-white/80 backdrop-blur-md (유리 효과 적용)
        <header className="sticky top-0 bg-white/80 backdrop-blur-md z-10 p-4 shadow-sm flex justify-between items-center">
            <h1 className="text-3xl font-extrabold text-[#00B16A] tracking-tighter">
                COCKSTAR
            </h1>

            <div className="flex space-x-3 text-xl text-gray-700">
                <button 
                    onClick={onSearchClick} 
                    className="p-2 rounded-full hover:bg-gray-100 hover:text-[#1E1E1E] transition-colors"
                >
                    {/* 아이콘 굵기 1.5로 자동 변경됨 */}
                    <Search size={24} /> 
                </button>
                <button 
                    onClick={onBellClick} 
                    className="p-2 rounded-full hover:bg-gray-100 hover:text-[#1E1E1E] transition-colors"
                >
                    {/* 아이콘 굵기 1.5로 자동 변경됨 */}
                    <Bell size={24} />
                </button>
            </div>
        </header>
    );
}
}

/**
 * 공통 서브페이지 헤더
 */
function SubPageHeader({ page, onBackClick }) {
    const title = page === 'game' ? '경기' :
                  page === 'store' ? '스토어' :
                  page === 'community' ? '커뮤니티' : '내 정보';
    return (
        <header className="sticky top-0 bg-white/80 backdrop-blur-md z-10 p-4 shadow-sm flex items-center">
            <button 
                onClick={onBackClick} 
                className="mr-2 p-2 rounded-full text-gray-500 hover:bg-gray-100 hover:text-[#1E1E1E] transition-colors"
            >
                <ArrowLeft size={24} />
            </button>
            <h1 className="text-2xl font-bold text-[#1E1E1E]">
                {title}
            </h1>
        </header>
    );
}


// ===================================================================================
// 메인 App 컴포넌트 (라우팅)
// ===================================================================================
// ===================================================================================
// 메인 App 컴포넌트 (라우팅)
// ===================================================================================

// [수정] 하단 탭 버튼 컴포넌트 (App 함수 *밖으로* 이동)
const TabButton = ({ icon: Icon, label, isActive, onClick }) => {
    return (
        <button
            onClick={onClick}
            // [아이디어 #5] 마이크로 인터랙션: 탭 버튼
            className={`flex flex-col items-center justify-center w-full pt-3 pb-2 transition-all duration-200 transform ${
                isActive ? 'text-[#00B16A]' : 'text-gray-500 hover:text-gray-700'
            } hover:scale-110 active:scale-95`}
        >
            <Icon size={26} className="mb-1" />
            <span className={`text-sm ${isActive ? 'font-bold' : 'font-medium'}`}>
                {label}
            </span>
        </button>
    );
};

export default function App() {
    const [page, setPage] = useState('home'); // home, game, store, community, myinfo
    const [user, setUser] = useState(null);
    const [userData, setUserData] = useState(null);
    const [loadingAuth, setLoadingAuth] = useState(true);
    const [showLoginModal, setShowLoginModal] = useState(false);

    // Firebase Auth 상태 리스너
    useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            if (!currentUser) {
                setUserData(null);
                setLoadingAuth(false);
            }
        });
        return () => unsubscribeAuth();
    }, []);

    // Firestore User 데이터 리스너
    useEffect(() => {
        let unsubscribeUser = () => {};
        if (user) {
            setLoadingAuth(true); // 유저는 있는데 userData가 아직 없을 때 로딩 시작
            const userDocRef = doc(db, "users", user.uid);
            unsubscribeUser = onSnapshot(userDocRef, (doc) => {
                if (doc.exists()) {
                    setUserData(doc.data());
                } else {
                    // [수정] userData에 email도 포함
                    const newUserData = {
                        name: user.displayName || '새 사용자',
                        email: user.email,
                        level: 'N조',
                        gender: '미설정',
                    };
                    setDoc(userDocRef, newUserData)
                        .then(() => setUserData(newUserData))
                        .catch(err => console.error("Error creating user doc:", err));
                }
                setLoadingAuth(false);
            }, (error) => {
                console.error("Error listening to user doc:", error);
                setLoadingAuth(false);
            });
        }

        return () => unsubscribeUser();
    }, [user]);

    const handleLogout = async () => {
        try {
            await signOut(auth);
            setPage('home');
        } catch (error) {
            console.error("Logout Error:", error);
        }
    };

    const handleLoginClick = () => {
        setShowLoginModal(true);
    };

    const handleCloseModal = () => {
        setShowLoginModal(false);
    };

    // 현재 페이지에 맞는 컴포넌트 렌더링
    const renderPage = () => {
        switch (page) {
            case 'home':
                return <HomePage user={userData} setPage={setPage} />;
            case 'game':
                return <GamePage user={user} userData={userData} onLoginClick={handleLoginClick} />;
            case 'store':
                return <StorePage />;
            case 'community':
                return <CommunityPage />;
            case 'myinfo':
                return <MyInfoPage 
                            user={user} 
                            userData={userData} 
                            onLoginClick={handleLoginClick} 
                            onLogout={handleLogout}
                            setPage={setPage} // EmptyState 버튼용
                    />;
            default:
                return <HomePage user={userData} setPage={setPage} />;
        }
    };

    if (loadingAuth && !userData) { // 초기 로딩 또는 유저 변경 시
        return (
            <div className="bg-white min-h-screen flex items-center justify-center">
                <LoadingSpinner text="콕스타에 접속 중..." />
            </div>
        );
    }

    // [수정] 여기가 올바른 App 함수의 return 문입니다.
    return (
        <>
            {showLoginModal && <AuthModal onClose={handleCloseModal} setPage={setPage} />}

            {/* [수정] 배경색 bg-gray-50 -> bg-slate-100 */}
            <div className="max-w-md mx-auto h-screen bg-slate-100 shadow-lg overflow-hidden flex flex-col font-sans text-[#1E1E1E] hide-scrollbar">

                {page === 'home' ? (
                    <HomePageHeader 
                        onSearchClick={() => alert('검색 기능 준비 중')}
                        onBellClick={() => alert('알림 기능 준비 중')}
                    />
                ) : (
                    <SubPageHeader page={page} onBackClick={() => setPage('home')} />
                )}

                {/* [수정] 하단 여백 pb-20 -> pb-24
                    [수정] 홈(home)페이지만 앱 배경색(slate-100)을 따르고, 
                            나머지 페이지(경기, 스토어 등)는 흰색 배경(bg-white)을 갖도록 논리 수정
                */}
                <main className={`flex-grow overflow-y-auto pb-24 hide-scrollbar ${page === 'home' ? 'bg-slate-100' : 'bg-white'}`}>
                    {renderPage()}
                </main>

                <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-gray-200 shadow-lg z-10">
                    {/* [수정] 탭 버튼을 감싸는 div 추가 */}
                    <div className="flex justify-around">
                        <TabButton
                            icon={Home}
                            label="홈"
                            isActive={page === 'home'}
                            onClick={() => setPage('home')}
                        />
                        <TabButton
                            icon={Trophy}
                            label="경기"
                            isActive={page === 'game'}
                            onClick={() => setPage('game')}
                        />
                        <TabButton
                            icon={Store}
                            label="스토어"
                            isActive={page === 'store'}
                            onClick={() => setPage('store')}
                        />
                        <TabButton
                            icon={Users}
                            label="커뮤니티"
                            isActive={page === 'community'}
                            onClick={() => setPage('community')}
                        />
                        <TabButton
                            icon={User}
                            label="내 정보"
                            isActive={page === 'myinfo'}
                            onClick={() => setPage('myinfo')}
                        />
                    </div>
                </nav>
            </div>
        </>
    );
}
