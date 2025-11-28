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
    deleteDoc, // [신규] 문서 삭제 기능
    runTransaction, // [추가] 데이터 안전 이동
    writeBatch      // [추가] 여러 문서 한번에 수정
} from 'firebase/firestore';
import {
    // [수정] createReactComponent를 제거하고, 원본 아이콘만 'as'로 가져옵니다.
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

// [수정] 얇은 아이콘을 생성하는 '새로운' 헬퍼 함수
// (createReactComponent가 비공개 함수라, 이 방식으로 우회합니다)
const createThinIcon = (IconComponent) => {
    // props를 받아서 strokeWidth=1.5를 기본값으로 추가한 새 컴포넌트를 반환
    return (props) => <IconComponent {...props} strokeWidth={1.5} />;
};

// [수정] 앱에서 사용할 얇은 아이콘을 새 헬퍼로 재정의합니다.
const Home = createThinIcon(HomeIcon);
const Trophy = createThinIcon(TrophyIcon);
const Store = createThinIcon(StoreIcon);
const Users = createThinIcon(UsersIcon);
const User = createThinIcon(UserIcon);
const X = createThinIcon(XIcon);
const Loader2 = createThinIcon(Loader2Icon);
const ArrowLeft = createThinIcon(ArrowLeftIcon);
const ShieldCheck = createThinIcon(ShieldCheckIcon);
const ShoppingBag = createThinIcon(ShoppingBagIcon);
const MessageSquare = createThinIcon(MessageSquareIcon);
const Search = createThinIcon(SearchIcon);
const Bell = createThinIcon(BellIcon);
const MapPin = createThinIcon(MapPinIcon);
const Heart = createThinIcon(HeartIcon);
const ChevronRight = createThinIcon(ChevronRightIcon);
const Plus = createThinIcon(PlusIcon);
const Archive = createThinIcon(ArchiveIcon);
const Lock = createThinIcon(LockIcon);
const Edit3 = createThinIcon(Edit3Icon);
const Clock = createThinIcon(ClockIcon);
const AlertCircle = createThinIcon(AlertCircleIcon);
const Calendar = createThinIcon(CalendarIcon);
const Users2 = createThinIcon(Users2Icon);
const BarChart2 = createThinIcon(BarChart2Icon);
const CheckCircle = createThinIcon(CheckCircleIcon);
const UserCheck = createThinIcon(UserCheckIcon);
const GripVertical = createThinIcon(GripVerticalIcon);
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

  // [재수정] SectionHeader 컴포넌트 디자인 변경 (모바일 최적화)
const SectionHeader = ({ title, onMoreClick }) => (
    // [재수정] mb-6 -> mb-4 (제목 크기가 줄었으므로 하단 여백도 살짝 줄여 균형 맞춤)
    <div className="flex justify-between items-center mb-4">
        {/* [재수정] text-3xl font-extrabold -> text-2xl font-bold (더 세련된 크기로) */}
        <h2 className="text-2xl font-bold text-[#1E1E1E] tracking-tight">{title}</h2>
        <button 
            onClick={onMoreClick} 
            // (더보기 버튼은 디자인이 좋으므로 유지)
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
    <div className="flex-grow p-6 space-y-12">

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

// [수정] 로비의 모임방 카드 컴포넌트 (시간 정보 제거)
function RoomCard({ room, onEnter }) {
    const levelColor = room.levelLimit === 'N조' ? 'text-gray-500' : 'text-[#00B16A]';
    
    return (
        <div 
            className="bg-white rounded-xl shadow-lg p-5 cursor-pointer transition-all hover:shadow-xl hover:scale-[1.01] active:scale-95 border border-gray-50"
            onClick={onEnter}
        >
            <div className="flex justify-between items-start mb-2">
                <h3 className="text-lg font-bold text-[#1E1E1E] mr-2 tracking-tight">{room.name}</h3>
                {room.password && (
                    <Lock size={16} className="text-gray-400 flex-shrink-0" />
                )}
            </div>
            
            <p className="text-sm text-gray-500 mb-4 truncate font-medium">
                <MapPin size={14} className="inline mr-1 -mt-0.5" />
                {room.location}
            </p>

            <div className="flex flex-wrap gap-2 items-center text-xs font-bold">
                <span className="flex items-center gap-1 px-2.5 py-1.5 bg-gray-100 rounded-lg text-gray-600">
                    <Users size={14} />
                    {room.playerCount || 0} / {room.maxPlayers}
                </span>
                <span className={`flex items-center gap-1 px-2.5 py-1.5 bg-gray-100 rounded-lg ${levelColor}`}>
                    <BarChart2 size={14} />
                    {room.levelLimit === 'N조' ? '전체 급수' : `${room.levelLimit} 이상`}
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
    isSelected, // [신규] 선택된 상태
    onCardClick, // [신규] 클릭 핸들러
    onDeleteClick, // [신규] 삭제(X) 핸들러
    onDragStart,
    onDragEnd,
    onDragOver,
    onDrop
}) => {
    if (!player) return <div className="h-14 bg-gray-100 rounded-lg animate-pulse"></div>;

    const levelColorClass = getLevelColor(player.level);
    const genderBorder = player.gender === '남' ? 'border-l-blue-500' : 'border-l-pink-500';

    // 스타일 클래스 조합
    let containerClass = `relative bg-white rounded-lg shadow-sm p-2 h-16 flex flex-col justify-between border-l-[3px] transition-all duration-200 cursor-pointer hover:shadow-md ${genderBorder} `;
    
    // [신규] 상태별 스타일
    if (isPlaying) containerClass += " opacity-50 bg-gray-50 grayscale ";
    if (isResting) containerClass += " opacity-40 bg-gray-100 grayscale ";
    
    // [신규] 선택 효과 (크기 확대 + 노란색 링)
    if (isSelected) {
        containerClass += " ring-2 ring-[#FFD700] ring-offset-1 transform scale-105 z-10 ";
    } else if (isCurrentUser) {
        containerClass += " ring-1 ring-[#00B16A] ring-offset-1 "; // 본인은 초록색 얇은 링
    }

    const canDrag = isAdmin;

    return (
        <div
            className={containerClass}
            onClick={() => onCardClick && onCardClick(player)} // 클릭 이벤트 연결
            draggable={canDrag}
            onDragStart={canDrag ? (e) => onDragStart(e, player.id) : undefined}
            onDragEnd={canDrag ? onDragEnd : undefined}
            onDragOver={canDrag ? onDragOver : undefined}
            onDrop={canDrag ? (e) => onDrop(e, { type: 'player', player: player }) : undefined}
        >
            {/* 상단: 이름 */}
            <div className="flex justify-between items-start">
                <span className="text-xs font-bold text-[#1E1E1E] truncate w-full pr-1 leading-tight">
                    {player.name}
                </span>
                {/* [신규] 관리자용 내보내기(X) 버튼 */}
                {isAdmin && (
                    <button 
                        onClick={(e) => {
                            e.stopPropagation(); // 카드 클릭 방지
                            onDeleteClick && onDeleteClick(player);
                        }}
                        className="absolute -top-1.5 -right-1.5 bg-white text-gray-400 hover:text-red-500 rounded-full shadow-sm border border-gray-100 p-0.5 transition-colors z-20"
                    >
                        <XIcon size={12} strokeWidth={3} />
                    </button>
                )}
            </div>
            
            {/* 하단: 급수, 게임 수 */}
            <div className="flex justify-between items-end mt-1">
                <span className={`text-[10px] font-extrabold ${levelColorClass.replace('border-', 'text-')}`}>
                    {player.level || 'N'}
                </span>
                <span className="text-[10px] text-gray-400 font-medium">
                    {player.todayGames || 0}G
                </span>
            </div>
        </div>
    );
});

/**
 * [수정] 빈 슬롯 (크기 축소)
 */
const EmptySlot = ({ onSlotClick, onDragOver, onDrop, isDragOver }) => (
    <div 
        onClick={onSlotClick}
        onDragOver={onDragOver} 
        onDrop={onDrop}
        className={`h-16 bg-gray-50/80 rounded-lg flex items-center justify-center text-gray-300 border border-dashed border-gray-300 transition-all cursor-pointer hover:bg-white hover:border-[#00B16A] hover:text-[#00B16A] ${
            isDragOver ? 'bg-green-50 border-[#00B16A] text-[#00B16A]' : ''
        }`}
    >
        <Plus size={16} />
    </div>
);


// [신규] 경기방 뷰 컴포넌트 (모든 요청사항 반영)
function GameRoomView({ roomId, user, userData, onExitRoom, roomsCollectionRef }) {
    const [roomData, setRoomData] = useState(null);
    const [players, setPlayers] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('matching'); 

    // 드래그 상태
    const [draggedPlayerId, setDraggedPlayerId] = useState(null);
    const [dragOverSlot, setDragOverSlot] = useState(null); 

    // [신규] 다중 선택 상태 & 환경설정 모달 상태
    const [selectedPlayerIds, setSelectedPlayerIds] = useState([]); 
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    
    // 경기 시작 관련 상태
    const [courtModalOpen, setCourtModalOpen] = useState(false);
    const [pendingMatchIndex, setPendingMatchIndex] = useState(null); 
    const [availableCourts, setAvailableCourts] = useState([]); 

    // Firestore 참조 Memoization (무한 로딩 방지)
    const roomDocRef = useMemo(() => doc(db, "rooms", roomId), [roomId]);
    const playersCollectionRef = useMemo(() => collection(db, "rooms", roomId, "players"), [roomId]);

    // [신규] 현재 방장인지 & 관리자 모드인지 확인
    const isAdmin = useMemo(() => {
        if (!roomData) return false;
        // 방장이거나 admins 목록에 있거나
        return user.uid === roomData.adminUid || (roomData.admins || []).includes(userData.email);
    }, [user.uid, roomData, userData]);

    // 1. 방 정보 구독
    useEffect(() => {
        setLoading(true);
        const unsubRoom = onSnapshot(roomDocRef, (doc) => {
            if (doc.exists()) {
                setRoomData({ id: doc.id, ...doc.data() });
            } else {
                setError("방이 존재하지 않습니다.");
                setLoading(false);
                onExitRoom();
            }
        });
        return () => unsubRoom();
    }, [roomDocRef]);

    // 2. 플레이어 목록 구독 & [신규] 인원수 동기화
    useEffect(() => {
        const unsubPlayers = onSnapshot(playersCollectionRef, async (snapshot) => {
            const playersDataArray = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            // 입장 시간순 정렬
            playersDataArray.sort((a, b) => {
                const timeA = a.entryTime?.toDate ? a.entryTime.toDate().getTime() : 0;
                const timeB = b.entryTime?.toDate ? b.entryTime.toDate().getTime() : 0;
                return timeA - timeB;
            });

            const playersMap = playersDataArray.reduce((acc, p) => ({ ...acc, [p.id]: p }), {});
            setPlayers(playersMap);
            setLoading(false);

            // [신규] 방 인원수 동기화 (방 정보의 playerCount 업데이트)
            if (roomDocRef && playersDataArray.length >= 0) {
                 // 쓰기 빈도를 줄이기 위해 약간의 꼼수(로컬 비교)를 쓸 수 있으나, 여기선 안전하게 업데이트
                 // 단, 무한루프 방지를 위해 현재 roomData와 다를 때만 업데이트는 생략하고
                 // Firestore updateDoc은 가볍게 호출
                 updateDoc(roomDocRef, { playerCount: playersDataArray.length }).catch(console.error);
            }
        });
        return () => unsubPlayers();
    }, [playersCollectionRef, roomDocRef]);

    // 3. 내 입장 처리
    useEffect(() => {
        const myDocRef = doc(playersCollectionRef, user.uid);
        getDoc(myDocRef).then(snap => {
            if(!snap.exists()) {
                setDoc(myDocRef, {
                    name: userData.name,
                    email: userData.email,
                    level: userData.level || 'N조',
                    gender: userData.gender || '미설정',
                    todayGames: 0,
                    isResting: false,
                    entryTime: serverTimestamp()
                });
            }
        });
        return () => {
            // 퇴장 시 플레이어 삭제하지 않음 (이전 앱 로직상 유지하는 경우도 있음. 
            // 만약 퇴장 시 자동 삭제를 원하면 여기서 deleteDoc 호출)
        };
    }, [user.uid]);

    // --- Helper Lists ---
    const inProgressPlayerIds = useMemo(() => new Set((roomData?.inProgressCourts || []).flatMap(c => c?.players || []).filter(Boolean)), [roomData]);
    const scheduledPlayerIds = useMemo(() => new Set(Object.values(roomData?.scheduledMatches || {}).flatMap(m => m || []).filter(Boolean)), [roomData]);

    const waitingPlayers = useMemo(() => Object.values(players).filter(p => !p.isResting && !inProgressPlayerIds.has(p.id) && !scheduledPlayerIds.has(p.id)), [players, inProgressPlayerIds, scheduledPlayerIds]);
    
    // [신규] 남녀 구분
    const maleWaiting = waitingPlayers.filter(p => p.gender === '남');
    const femaleWaiting = waitingPlayers.filter(p => p.gender !== '남'); // 여 또는 미설정

    // --- Actions ---

    // [신규] 카드 클릭 (다중 선택)
    const handleCardClick = (player) => {
        if (!isAdmin) return; // 관리자만 선택 가능 (또는 개인 모드 로직 추가 가능)

        setSelectedPlayerIds(prev => {
            if (prev.includes(player.id)) return prev.filter(id => id !== player.id);
            return [...prev, player.id];
        });
    };

    // [신규] 선수 강퇴
    const handleKickPlayer = async (player) => {
        if (!window.confirm(`'${player.name}'님을 내보내시겠습니까?`)) return;
        try {
            // 스케줄/진행 중이라면 제거 로직이 복잡하므로, 일단 목록에서 삭제만 처리
            await deleteDoc(doc(playersCollectionRef, player.id));
            setSelectedPlayerIds(prev => prev.filter(id => id !== player.id));
        } catch (e) {
            console.error(e);
            alert("삭제 실패");
        }
    };

    // [신규] 환경 설정 저장
    const handleSettingsSave = async (newSettings) => {
        try {
            // 코트 수 변경 시 배열 크기 조정
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

    // [신규] 시스템 초기화
    const handleSystemReset = async () => {
        if(!window.confirm("모든 경기 기록을 초기화하시겠습니까? (선수 목록은 유지)")) return;
        await updateDoc(roomDocRef, {
            scheduledMatches: {},
            inProgressCourts: Array(roomData.numInProgressCourts).fill(null)
        });
    };

    // [신규] 모든 선수 내보내기
    const handleKickAll = async () => {
        if(!window.confirm("방에 있는 모든 선수를 내보내시겠습니까?")) return;
        // Batch delete
        const batch = writeBatch(db);
        Object.keys(players).forEach(pid => {
            batch.delete(doc(playersCollectionRef, pid));
        });
        await batch.commit();
        onExitRoom(); // 나도 나감
    };

    // 슬롯 클릭 (선수 배치)
    const handleSlotClick = async (matchIndex, slotIndex) => {
        if (!isAdmin || selectedPlayerIds.length === 0) return;

        // 선택된 선수들 배치 (순서대로)
        const currentSchedule = { ...(roomData.scheduledMatches || {}) };
        if (!currentSchedule[matchIndex]) currentSchedule[matchIndex] = Array(PLAYERS_PER_MATCH).fill(null);
        
        const targetMatch = [...currentSchedule[matchIndex]];
        let insertIdx = slotIndex;
        
        // 선택된 선수들을 빈 자리에 채워넣음
        selectedPlayerIds.forEach(pid => {
            // 이미 다른 곳에 있는지 체크 로직은 생략(단순화)하거나 필요시 추가
            // 현재 매치의 빈 곳 찾기
            while(insertIdx < PLAYERS_PER_MATCH && targetMatch[insertIdx] !== null) {
                insertIdx++;
            }
            if (insertIdx < PLAYERS_PER_MATCH) {
                targetMatch[insertIdx] = pid;
                insertIdx++;
            }
        });

        // 다른 매치에서 해당 선수들 제거 (이동 로직)
        const newScheduleCleaned = {};
        Object.keys(currentSchedule).forEach(k => {
            const m = [...(currentSchedule[k] || [])];
            // 이번에 배치할 매치가 아니면, 선택된 선수들 제거
            if (parseInt(k) !== matchIndex) {
                for(let i=0; i<m.length; i++) {
                    if (selectedPlayerIds.includes(m[i])) m[i] = null;
                }
            }
            newScheduleCleaned[k] = m;
        });

        newScheduleCleaned[matchIndex] = targetMatch;

        await updateDoc(roomDocRef, { scheduledMatches: newScheduleCleaned });
        setSelectedPlayerIds([]); // 선택 해제
    };

    // 경기 시작 로직
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
                const data = rd.data();
                const matchPlayers = data.scheduledMatches[matchIdx];
                
                if (!matchPlayers || matchPlayers.includes(null)) throw "인원이 부족합니다.";
                
                // 스케줄 제거 & 재정렬
                const newSched = { ...data.scheduledMatches };
                delete newSched[matchIdx];
                // 키 재정렬
                const reordered = {};
                Object.values(newSched).forEach((m, i) => reordered[i] = m);

                // 코트 투입
                const newCourts = [...(data.inProgressCourts || [])];
                newCourts[courtIdx] = { players: matchPlayers, startTime: new Date().toISOString() };

                t.update(roomDocRef, { scheduledMatches: reordered, inProgressCourts: newCourts });
            });
            setCourtModalOpen(false);
        } catch (e) { alert(e); }
    };

    const handleEndMatch = async (courtIdx) => {
        if (!isAdmin || !confirm("경기 종료?")) return;
        const court = roomData.inProgressCourts[courtIdx];
        const batch = writeBatch(db);
        
        // 게임 수 증가
        court.players.forEach(pid => {
            if (players[pid]) {
                const ref = doc(playersCollectionRef, pid);
                batch.update(ref, { todayGames: (players[pid].todayGames || 0) + 1 });
            }
        });
        
        // 코트 비우기
        const newCourts = [...roomData.inProgressCourts];
        newCourts[courtIdx] = null;
        
        await batch.commit(); // 게임수 업데이트
        await updateDoc(roomDocRef, { inProgressCourts: newCourts }); // 코트 상태 업데이트
    };


    // --- Render ---
    if (loading) return <LoadingSpinner text="입장 중..." />;
    if (error) return <div className="p-10 text-center">{error}</div>;

    return (
        <div className="flex flex-col h-full bg-white">
            {/* 헤더 */}
            <header className="flex-shrink-0 px-4 py-3 flex items-center justify-between bg-white border-b border-gray-100 sticky top-0 z-30">
                <div className="flex items-center gap-3">
                    <button onClick={onExitRoom} className="p-1 text-gray-400 hover:text-black"><ArrowLeftIcon size={24}/></button>
                    <div>
                        <h1 className="text-lg font-bold text-[#1E1E1E] leading-none">{roomData?.name}</h1>
                        <span className="text-xs text-gray-500 font-medium">{roomData?.location}</span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {/* [신규] 관리자용 설정 버튼 */}
                    {isAdmin && (
                        <button 
                            onClick={() => setIsSettingsOpen(true)}
                            className="p-2 text-gray-400 hover:text-[#00B16A] transition-colors"
                        >
                            <Edit3Icon size={20} />
                        </button>
                    )}
                    <div className="flex flex-col items-end">
                        <span className="text-xs font-bold text-[#00B16A]">{isAdmin ? '관리자 모드' : '개인 모드'}</span>
                        <span className="text-[10px] text-gray-400">
                            <UsersIcon size={10} className="inline mr-1"/>
                            {Object.keys(players).length}명
                        </span>
                    </div>
                </div>
            </header>

            {/* 탭 */}
            <div className="flex border-b border-gray-100">
                <button onClick={() => setActiveTab('matching')} className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'matching' ? 'border-[#00B16A] text-[#00B16A]' : 'border-transparent text-gray-400'}`}>매칭 대기</button>
                <button onClick={() => setActiveTab('inProgress')} className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'inProgress' ? 'border-[#00B16A] text-[#00B16A]' : 'border-transparent text-gray-400'}`}>경기 진행</button>
            </div>

            {/* 메인 컨텐츠 */}
            <main className="flex-grow overflow-y-auto p-3 bg-slate-50 space-y-4 pb-24">
                {activeTab === 'matching' ? (
                    <>
                        {/* 대기 명단 (남녀 구분) */}
                        <section className="bg-white rounded-xl shadow-sm p-3 border border-gray-100">
                            <h2 className="text-sm font-bold text-gray-800 mb-3 flex justify-between">
                                <span>대기 명단</span>
                                <span className="text-[#00B16A]">{waitingPlayers.length}명</span>
                            </h2>
                            <div className="grid grid-cols-4 gap-2"> {/* 카드 작아짐 -> 컬럼 수 4개 유지/확대 */}
                                {maleWaiting.map(p => (
                                    <PlayerCard 
                                        key={p.id} player={p} isAdmin={isAdmin} isCurrentUser={user.uid === p.id}
                                        isSelected={selectedPlayerIds.includes(p.id)}
                                        onCardClick={handleCardClick}
                                        onDeleteClick={handleKickPlayer}
                                    />
                                ))}
                            </div>
                            {maleWaiting.length > 0 && femaleWaiting.length > 0 && (
                                <div className="my-3 border-t border-dashed border-gray-300 relative h-0">
                                    <span className="absolute left-1/2 -top-2 bg-white px-2 text-[10px] text-gray-400 -translate-x-1/2">여성 회원</span>
                                </div>
                            )}
                            <div className="grid grid-cols-4 gap-2">
                                {femaleWaiting.map(p => (
                                    <PlayerCard 
                                        key={p.id} player={p} isAdmin={isAdmin} isCurrentUser={user.uid === p.id}
                                        isSelected={selectedPlayerIds.includes(p.id)}
                                        onCardClick={handleCardClick}
                                        onDeleteClick={handleKickPlayer}
                                    />
                                ))}
                            </div>
                            {waitingPlayers.length === 0 && <p className="text-center text-xs text-gray-400 py-4">대기 중인 선수가 없습니다.</p>}
                        </section>

                        {/* 경기 예정 테이블 */}
                        <section className="space-y-2">
                            {Array.from({ length: roomData.numScheduledMatches }).map((_, mIdx) => {
                                const match = roomData.scheduledMatches?.[mIdx] || Array(PLAYERS_PER_MATCH).fill(null);
                                const fullCount = match.filter(Boolean).length;
                                return (
                                    <div key={mIdx} className="bg-white rounded-xl p-2 shadow-sm border border-gray-100 flex gap-2 items-center">
                                        <div className="flex flex-col items-center justify-center w-8 gap-1">
                                            <span className="text-xs font-bold text-gray-400">Match</span>
                                            <span className="text-lg font-black text-[#1E1E1E]">{mIdx + 1}</span>
                                        </div>
                                        <div className="flex-1 grid grid-cols-4 gap-1.5">
                                            {match.map((pid, sIdx) => (
                                                pid ? (
                                                    <PlayerCard 
                                                        key={pid} player={players[pid]} isAdmin={isAdmin} isCurrentUser={user.uid === pid}
                                                        isSelected={selectedPlayerIds.includes(pid)}
                                                        onCardClick={handleCardClick}
                                                        onDeleteClick={() => { /* 스케줄 삭제 로직 별도 필요 */ }}
                                                    />
                                                ) : (
                                                    <EmptySlot key={sIdx} onSlotClick={() => handleSlotClick(mIdx, sIdx)} />
                                                )
                                            ))}
                                        </div>
                                        <div className="w-10 flex justify-center">
                                            <button 
                                                onClick={() => handleStartClick(mIdx)}
                                                disabled={fullCount < PLAYERS_PER_MATCH}
                                                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                                                    fullCount === PLAYERS_PER_MATCH 
                                                    ? 'bg-[#00B16A] text-white shadow-md hover:scale-110' 
                                                    : 'bg-gray-100 text-gray-300'
                                                }`}
                                            >
                                                <ChevronRightIcon size={20} strokeWidth={3} />
                                            </button>
                                        </div>
                                    </div>
                                )
                            })}
                        </section>
                    </>
                ) : (
                    /* 경기 진행 탭 */
                    <div className="space-y-3">
                        {Array.from({ length: roomData.numInProgressCourts }).map((_, cIdx) => {
                            const court = roomData.inProgressCourts?.[cIdx];
                            const isOccupied = !!court;
                            return (
                                <div key={cIdx} className={`rounded-xl border-2 overflow-hidden ${isOccupied ? 'bg-white border-[#00B16A]/30' : 'bg-gray-50 border-dashed border-gray-200'}`}>
                                    <div className={`px-3 py-2 flex justify-between items-center ${isOccupied ? 'bg-[#00B16A]/5' : ''}`}>
                                        <span className="font-bold text-sm text-[#1E1E1E]">COURT {cIdx + 1}</span>
                                        {isOccupied ? (
                                            <div className="flex items-center gap-2">
                                                <CourtTimer startTime={court.startTime} />
                                                {isAdmin && (
                                                    <button onClick={() => handleEndMatch(cIdx)} className="bg-white border border-red-100 text-red-500 text-xs font-bold px-2 py-1 rounded hover:bg-red-50">종료</button>
                                                )}
                                            </div>
                                        ) : <span className="text-xs text-gray-400">비어있음</span>}
                                    </div>
                                    <div className="p-2 grid grid-cols-4 gap-1.5">
                                        {isOccupied ? court.players.map(pid => (
                                            players[pid] ? <PlayerCard key={pid} player={players[pid]} isPlaying={true} /> : <div key={pid} className="h-14 bg-gray-100 rounded"/>
                                        )) : (
                                            <div className="col-span-4 h-14 flex items-center justify-center text-gray-300">
                                                <TrophyIcon size={24} className="opacity-20"/>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </main>

            {/* 모달들 */}
            <CourtSelectionModal 
                isOpen={courtModalOpen} 
                onClose={() => setCourtModalOpen(false)} 
                courts={availableCourts} 
                onSelect={(idx) => processStartMatch(pendingMatchIndex, idx)}
            />
            <SettingsModal 
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                roomData={roomData}
                onSave={handleSettingsSave}
                onReset={handleSystemReset}
                onKickAll={handleKickAll}
            />
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

