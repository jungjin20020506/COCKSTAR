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
    Home, Trophy, Store, Users, User, X, Loader2, ArrowLeft, ShieldCheck, ShoppingBag, MessageSquare,
    Search, Bell, MapPin, Heart, ChevronRight, Plus, Archive,
    // [신규] 아이콘 추가
    Lock, Edit3, Clock, AlertCircle, Calendar, Users2, BarChart2,
    CheckCircle, // [신규]
    UserCheck, // [신규]
    GripVertical // [신규] 드래그 핸들
} from 'lucide-react';

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

// [신규] 경기방 목록 스켈레톤
function SkeletonRoomCard() {
    return (
        <div className="w-full p-4 bg-white rounded-xl shadow-lg animate-pulse">
            <div className="h-5 bg-gray-200 rounded-md w-3/4 mb-3"></div>
            <div className="flex gap-4 mb-4">
                <div className="h-4 bg-gray-200 rounded-full w-1/4"></div>
                <div className="h-4 bg-gray-200 rounded-full w-1/3"></div>
            </div>
            <div className="flex justify-between items-center">
                <div className="h-4 bg-gray-200 rounded-md w-1/3"></div>
                <div className="h-8 bg-gray-200 rounded-lg w-1/4"></div>
            </div>
        </div>
    );
}

function SkeletonStoreCard() {
     return (
        <div className="w-40 flex-shrink-0 animate-pulse mr-4"> {/* [수정] 마진 추가 */}
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
            setError(getFirebaseErrorMessage(err));
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
    const [roomName, setRoomName] = useState('');
    const [location, setLocation] = useState('');
    const [description, setDescription] = useState('');
    const [levelLimit, setLevelLimit] = useState('N조'); // D조, C조, B조, A조, S조, N조(제한없음)
    const [memberLimit, setMemberLimit] = useState(20);
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (!roomName.trim() || !location.trim()) {
            setError('방 제목과 장소는 필수입니다.');
            return;
        }
        if (roomName.length > 30) {
            setError('방 제목은 30자 이내로 입력해주세요.');
            return;
        }

        setLoading(true);
        const newRoomData = {
            name: roomName,
            location: location,
            description: description,
            levelLimit: levelLimit,
            memberLimit: Number(memberLimit),
            password: password,
            // 방장(admin) 정보
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
            await onSubmit(newRoomData);
            // 성공 시 모달 닫기 및 폼 초기화
            onClose();
            setRoomName('');
            setLocation('');
            setDescription('');
            setLevelLimit('N조');
            setMemberLimit(20);
            setPassword('');
        } catch (err) {
            console.error("Error creating room: ", err);
            setError('모임 생성에 실패했습니다. 잠시 후 다시 시도해주세요.');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-6 w-full max-w-md relative shadow-2xl flex flex-col max-h-[90vh]">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                    disabled={loading}
                >
                    <X size={24} />
                </button>
                
                <h2 className="text-2xl font-bold text-center mb-6 text-[#1E1E1E]">
                    새 모임 만들기
                </h2>

                {error && <p className="text-red-500 text-center mb-4 bg-red-100 p-3 rounded-lg text-sm">{error}</p>}

                <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto pr-2">
                    {/* 방 제목 (필수) */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">방 제목 <span className="text-red-500">*</span></label>
                        <input
                            type="text"
                            placeholder="예: 수원시 주말 40대 A조 모임"
                            value={roomName}
                            onChange={(e) => setRoomName(e.target.value)}
                            required
                            className="w-full p-3 bg-gray-100 rounded-lg text-gray-900 border-2 border-gray-200 focus:border-[#00B16A] focus:outline-none text-base"
                        />
                    </div>
                    
                    {/* 장소 (필수) */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">장소 <span className="text-red-500">*</span></label>
                        <input
                            type="text"
                            placeholder="예: OO 체육관"
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                            required
                            className="w-full p-3 bg-gray-100 rounded-lg text-gray-900 border-2 border-gray-200 focus:border-[#00B16A] focus:outline-none text-base"
                        />
                    </div>
                    
                    {/* 모임 소개 (선택) */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">모임 소개</label>
                        <textarea
                            placeholder="모임에 대한 간단한 소개를 적어주세요. (참가비, 준비물 등)"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={3}
                            className="w-full p-3 bg-gray-100 rounded-lg text-gray-900 border-2 border-gray-200 focus:border-[#00B16A] focus:outline-none text-base"
                        />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        {/* 급수 제한 (선택) */}
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">입장 급수</label>
                            <select
                                value={levelLimit}
                                onChange={(e) => setLevelLimit(e.target.value)}
                                className="w-full p-3 bg-gray-100 rounded-lg text-gray-900 border-2 border-gray-200 focus:border-[#00B16A] focus:outline-none text-base"
                            >
                                <option value="N조">제한 없음 (N조)</option>
                                <option value="D조">D조 이상</option>
                                <option value="C조">C조 이상</option>
                                <option value="B조">B조 이상</option>
                                <option value="A조">A조 이상</option>
                                <option value="S조">S조 이상</option>
                            </select>
                        </div>
                        
                        {/* 인원 제한 (선택) */}
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">인원 제한</label>
                            <input
                                type="number"
                                min="4"
                                max="100"
                                step="2"
                                value={memberLimit}
                                onChange={(e) => setMemberLimit(e.target.value)}
                                className="w-full p-3 bg-gray-100 rounded-lg text-gray-900 border-2 border-gray-200 focus:border-[#00B16A] focus:outline-none text-base"
                            />
                        </div>
                    </div>

                    {/* 비밀번호 (선택) */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">비밀번호 (선택)</label>
                        <input
                            type="password"
                            placeholder="비공개 방으로 만들려면 입력"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full p-3 bg-gray-100 rounded-lg text-gray-900 border-2 border-gray-200 focus:border-[#00B16A] focus:outline-none text-base"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full mt-4 py-3 bg-[#00B16A] text-white font-bold rounded-lg text-base hover:bg-green-600 transition-colors disabled:bg-gray-400 flex items-center justify-center"
                    >
                        {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : '모임 만들기'}
                    </button>
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
    };

    const handleDragMove = (e) => {
        if (!isDraggingRef.current) return;
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

    // [수정] '신상 스토어' 섹션 로직 추가
    const storeContainerRef = useRef(null);
    const isDraggingRef = useRef(false);
    // [수정] isHoveringRef 제거
    const dragStartXRef = useRef(0);
    const scrollLeftRef = useRef(0);
    const animationFrameRef = useRef(null);
    const storeContentWidthRef = useRef(0);

    // 1.5초 후 로딩 상태 해제 (데이터 로딩 시뮬레이션)
    useEffect(() => {
        const timer = setTimeout(() => {
            setLoading(false);
        }, 1500);
        return () => clearTimeout(timer); // 컴포넌트 언마운트 시 타이머 제거
    }, []);

    // [신규] '신상 스토어' 자동 스크롤 로직
    useEffect(() => {
        // [수정] 로딩이 끝나야(loading === false) 애니메이션을 시작합니다.
        if (loading) {
            // 로딩 중(스켈레톤 표시 중)에는 애니메이션을 실행하지 않습니다.
            return;
        }

        // [수정] 로딩이 끝난 후, 실제 카드 DOM이 렌더링될 시간을 100ms 줍니다.
        const startTimer = setTimeout(() => {
            if (!storeContainerRef.current) return;

            // [수정] 너비 계산을 이 시점으로 이동 (로딩 끝난 후 실제 너비)
            storeContentWidthRef.current = storeContainerRef.current.scrollWidth / 2;

            // [수정] 만약 너비가 0이면 (DOM이 아직 반영 안 됨) 100ms 후 재시도
            if (storeContentWidthRef.current === 0) {
                setTimeout(() => {
                    if (storeContainerRef.current) {
                         storeContentWidthRef.current = storeContainerRef.current.scrollWidth / 2;
                    }
                }, 100);
            }

            const animateScroll = () => {
                if (storeContainerRef.current && !isDraggingRef.current) {
                    // 스크롤 속도 (0.5px 씩)
                    storeContainerRef.current.scrollLeft += 0.5; 
                    
                    // [수정] 너비가 0일 때(초기 계산 전)는 루프를 실행하지 않음
                    if (storeContentWidthRef.current === 0) {
                        // 스켈레톤 -> 실제 카드로 바뀐 후 너비 재계산
                        storeContentWidthRef.current = storeContainerRef.current.scrollWidth / 2;
                    }
    
                    // [수정] "순간이동" 버그를 잡는 핵심 로직입니다.
                    // 스크롤이 1번 세트의 끝(storeContentWidthRef.current)을 넘어가면
                    if (storeContentWidthRef.current > 0 && 
                        storeContainerRef.current.scrollLeft >= storeContentWidthRef.current) {
                        
                        // 1번 세트 끝에 도달하면, 
                        // (현재 스크롤 위치 - 1번 세트 너비) = 2번 세트에서 스크롤된 거리
                        // 그 거리를 1번 세트의 시작점(0)에 더해줍니다.
                        const newScrollLeft = storeContainerRef.current.scrollLeft - storeContentWidthRef.current;
                        storeContainerRef.current.scrollLeft = newScrollLeft;
                    }
                }
                animationFrameRef.current = requestAnimationFrame(animateScroll);
            };

            // 애니메이션 시작
            animationFrameRef.current = requestAnimationFrame(animateScroll);

        }, 100); // 100ms 딜레이 (DOM 반영 시간)

        return () => {
            // 컴포넌트 언마운트 시 애니메이션 프레임 정리
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
            clearTimeout(startTimer);
        };
    }, [loading]); // [수정] 'loading' 상태가 변경될 때마다 이 Effect를 재실행
    
    // [신규] '신상 스토어' 수동 터치 리스너 (Passive Error 해결)
    useEffect(() => {
        const container = storeContainerRef.current;
        if (!container) return;

        // [신규] 'touchstart' 이벤트 (e.preventDefault()를 위해 non-passive로 등록)
        // handleStoreDragStart를 직접 호출하지 않고 터치 전용 로직을 만듭니다.
        const onTouchStart = (e) => {
            e.preventDefault(); // 브라우저 기본 동작(선택 등) 방지
            
            isDraggingRef.current = true;
            dragStartXRef.current = e.touches[0].clientX; // touch 이벤트이므로 e.touches[0] 사용
            scrollLeftRef.current = container.scrollLeft;
            container.style.cursor = 'grabbing';
        };

        // [신규] 'touchmove' 이벤트 (e.preventDefault()를 위해 non-passive로 등록)
        const onTouchMove = (e) => {
            if (!isDraggingRef.current) return;
            e.preventDefault(); // 브라우저 스크롤/새로고침 방지

            const currentX = e.touches[0].clientX; // touch 이벤트이므로 e.touches[0] 사용
            const dx = currentX - dragStartXRef.current;
            container.scrollLeft = scrollLeftRef.current - dx;
        };

        // [신규] 'touchend' 이벤트 (드래그 종료 로직)
        // handleStoreDragEnd는 e 객체가 필요 없으므로 재사용
        const onTouchEnd = () => {
            handleStoreDragEnd();
        };

        // 리스너 등록 (passive: false가 핵심)
        container.addEventListener('touchstart', onTouchStart, { passive: false });
        container.addEventListener('touchmove', onTouchMove, { passive: false });
        
        // touchmove와 달리, touchend/touchcancel은 passive 여부가 중요하지 않습니다.
        // React의 onTouchEnd를 그대로 사용해도 되지만, 통일성을 위해 여기서 등록합니다.
        container.addEventListener('touchend', onTouchEnd);
        container.addEventListener('touchcancel', onTouchEnd); // 예외 상황 처리

        // 클린업 함수
        return () => {
            container.removeEventListener('touchstart', onTouchStart);
            container.removeEventListener('touchmove', onTouchMove);
            container.removeEventListener('touchend', onTouchEnd);
            container.removeEventListener('touchcancel', onTouchEnd);
        };

    }, []); // 마운트 시 한 번만 실행

    // [신규] '신상 스토어' 드래그 시작 핸들러 (마우스 전용으로 수정)
    const handleStoreDragStart = (e) => {
        // e.preventDefault(); // (옵션) 마우스 드래그 시 텍스트 선택 방지
        isDraggingRef.current = true;
        dragStartXRef.current = e.clientX; // 마우스 전용
        scrollLeftRef.current = storeContainerRef.current.scrollLeft;
        storeContainerRef.current.style.cursor = 'grabbing';
    };

    // [신규] '신상 스토어' 드래그 이동 핸들러 (마우스 전용으로 수정)
    const handleStoreDragMove = (e) => {
        if (!isDraggingRef.current) return;
        // e.preventDefault(); // (옵션)
        const currentX = e.clientX; // 마우스 전용
        const dx = currentX - dragStartXRef.current;
        storeContainerRef.current.scrollLeft = scrollLeftRef.current - dx;
    };

    // [신규] '신상 스토어' 드래그 종료 핸들러 (마우스 + 터치 공용)
    const handleStoreDragEnd = () => {
        isDraggingRef.current = false;
        // [수정] isHoveringRef.current = false; 라인 제거
        storeContainerRef.current.style.cursor = 'grab';
    };

    // [수정] handleStoreHoverStart, handleStoreHoverEnd 함수 전체 제거


    const SectionHeader = ({ title, onMoreClick }) => (
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-[#1E1E1E] tracking-tight">{title}</h2>
            <button 
                onClick={onMoreClick} 
                className="text-sm font-semibold text-gray-700 hover:text-[#00B16A] flex items-center"
            >
                더보기 <ChevronRight size={18} />
            </button>
        </div>
    );

    const storeItems = [
        { title: "요넥스 신상 의류", brand: "Yonex", image: "https://placehold.co/160x128/00B16A/FFFFFF?text=Yonex" },
        { title: "빅터 신상 라켓", brand: "Victor", image: "https://placehold.co/160x128/FFD700/000000?text=Victor" },
        { title: "리닝 백", brand: "Li-Ning", image: "https://placehold.co/160x128/1E1E1E/FFFFFF?text=Li-Ning" },
        { title: "아디다스 슈즈", brand: "Adidas", image: "https://placehold.co/160x128/F5F5F5/1E1E1E?text=Adidas" },
        { title: "테크니스트 셔틀콕", brand: "Technist", image: "https://placehold.co/160x128/008a50/FFFFFF?text=Technist" },
    ];

    // [신규] 무한 스크롤을 위해 아이템 목록 2배로
    const duplicatedStoreItems = [...storeItems, ...storeItems];

    const StoreCard = ({ image, title, brand }) => (
        <div className="w-40 flex-shrink-0 mr-4"> {/* 마퀴용 간격(mr-4) 추가 */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                <img 
                    src={image || "https://placehold.co/160x128/F5F5F5/BDBDBD?text=Store"} 
                    alt={title} 
                    className="w-full h-32 object-cover bg-gray-200"
                    loading="lazy" // (아이디어 #4)
                    draggable="false" // [신규] 드래그 시 이미지 고스트 방지
                />
                <div className="p-3">
                    <p className="font-bold text-base text-[#1E1E1E] mt-1 truncate">{title}</p>
                    <p className="text-sm text-gray-500">{brand}</p>
                </div>
            </div>
        </div>
    );

    const GameCard = ({ title, tags, location, current, total }) => (
        <button 
            onClick={() => setPage('game')}
            className="w-full p-4 bg-white rounded-xl shadow-lg text-left transition-transform transform hover:scale-[1.02]"
        >
            <p className="font-bold text-lg text-[#1E1E1E] mb-2">{title}</p>
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
                    <MapPin size={16} className="mr-1" /> {location}
                </span>
                <span className="text-sm font-medium text-[#00B16A] bg-green-50 px-2 py-1 rounded-full">
                    {current} / {total}명
                </span>
            </div>
        </button>
    );

    const CommunityPost = ({ category, title, likes }) => (
        <button 
            onClick={() => setPage('community')}
            className="p-4 bg-white rounded-xl shadow-lg flex justify-between items-center w-full transition-shadow hover:shadow-md"
        >
            <p className="truncate text-base text-[#1E1E1E] flex-1 mr-4">
                <span className={`font-semibold ${category === 'Q&A' ? 'text-[#00B16A]' : 'text-gray-700'} mr-2`}>
                    [{category}]
                </span>
                {title}
            </p>
            {/* [아이디어 #5] 마이크로 인터랙션: 하트 버튼 */}
            <div className="text-sm text-gray-500 whitespace-nowrap flex items-center font-medium transition-colors hover:text-red-500">
                <Heart size={16} className="mr-1" /> {likes}
            </div>
        </button>
    );

    return (
        <main className="p-4 space-y-8 bg-gray-50"> {/* 넉넉한 여백 */}
            
            {/* (1) 섹션: 메인 배너 */}
            <MainBanner />

            {/* (2) 섹션: 신상 스토어 (요청 #4 - 마퀴 -> 스와이프로 수정) */}
            <section>
                <SectionHeader title="신상 스토어" onMoreClick={() => setPage('store')} />
                {/* [수정] 마퀴 -> 스와이프 컨테이너로 변경 */}
                <div 
                    ref={storeContainerRef}
                    // [수정] overflow-x-auto, hide-scrollbar, cursor-grab 추가
                    className="w-full overflow-x-auto hide-scrollbar cursor-grab" // active:cursor-grabbing은 JS로 제어
                    
                    // [수정] 마우스 이벤트만 남김 (터치 이벤트는 useEffect에서 수동 등록)
                    onMouseDown={handleStoreDragStart}
                    onMouseMove={handleStoreDragMove}
                    onMouseUp={handleStoreDragEnd}
                    onMouseLeave={handleStoreDragEnd} // 마우스가 컨테이너 밖으로 나가면 드래그 종료
                    // onTouchStart={handleStoreDragStart}  <- 제거
                    // onTouchMove={handleStoreDragMove}  <- 제거
                    // onTouchEnd={handleStoreDragEnd}      <- 제거 (useEffect로 이동)
                >
                    {/* [수정] animate-marquee 클래스 제거, flex로 변경 */}
                    <div className="flex"> 
                        {/* [아이디어 #1] 스켈레톤 로딩 */}
                        {loading ? (
                            // [수정] 스켈레톤 카드 4개만 표시
                            [...Array(4)].map((_, i) => <SkeletonStoreCard key={i} />)
                        ) : (
                            /* [수정] 무한 루프를 위해 2배로 늘린 아이템 사용 */
                            duplicatedStoreItems.map((item, index) => (
                                <StoreCard 
                                    key={index} // key는 index로 설정 (목록이 정적이므로)
                                    title={item.title} 
                                    brand={item.brand} 
                                    image={item.image} 
                                />
                            ))
                        )}
                        {/* [신규] 마지막 아이템 뒤에 여백을 주기 위한 요소 (필요 시) */}
                        {/* <div className="flex-shrink-0 w-1 h-1"></div> */}
                    </div>
                </div>
            </section>

            {/* (3) 섹션: 지금 뜨는 경기 */}
            <section>
                <SectionHeader title="지금 뜨는 경기" onMoreClick={() => setPage('game')} />
                <div className="space-y-4">
                    {/* [아이디어 #1] 스켈레톤 로딩 */}
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
                    {/* [아이디어 #1] 스켈레톤 로딩 */}
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

        </main>
    );
}


/**
 * 3. 경기 시스템 페이지 (구현 시작)
 */
function GamePage({ user, userData, onLoginClick }) {
    // [신규] '로비' / '경기방' 뷰 전환
    const [currentView, setCurrentView] = useState('lobby'); // 'lobby', 'room'
    const [selectedRoomId, setSelectedRoomId] = useState(null);
    
    // [신규] 모임방 목록(로비) 관련 상태
    const [rooms, setRooms] = useState([]);
    const [loadingRooms, setLoadingRooms] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    
    // [신규] 모임 생성 모달 관련 상태
    const [showCreateRoomModal, setShowCreateRoomModal] = useState(false);

    // [신규] Firestore 'rooms' 컬렉션 경로
    const roomsCollectionRef = collection(db, "rooms");

    // [신규] 모임방 목록 실시간 구독 (로비 뷰가 활성화될 때)
    useEffect(() => {
        // 사용자가 로그인했고, 로비 뷰에 있을 때만 구독
        if (user && currentView === 'lobby') {
            setLoadingRooms(true);
            
            // 생성된 시간(createdAt)의 내림차순(desc)으로 정렬
            const q = query(roomsCollectionRef, orderBy("createdAt", "desc"));
            
            const unsubscribe = onSnapshot(q, (querySnapshot) => {
                const roomsData = querySnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setRooms(roomsData);
                setLoadingRooms(false);
            }, (error) => {
                console.error("Error fetching rooms: ", error);
                setLoadingRooms(false);
            });

            // 클린업 함수: 컴포넌트 언마운트 시 또는 뷰가 바뀔 때 구독 해제
            return () => unsubscribe();
        }
    }, [user, currentView, roomsCollectionRef]); // [수정] 의존성 배열에 roomsCollectionRef 추가

    // [신규] 검색어 필터링
    const filteredRooms = rooms.filter(room => 
        room.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        room.location.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // [신규] 모임 생성 처리
    const handleCreateRoomSubmit = async (newRoomData) => {
        if (!user) {
            alert("로그인이 필요합니다.");
            return;
        }
        
        // addDoc은 자동으로 Promise를 반환하므로, 모달에서 await 처리
        const docRef = await addDoc(roomsCollectionRef, newRoomData);
        
        // 방 생성 후 바로 입장
        handleEnterRoom(docRef.id);
    };

    // [신규] 모임방 입장
    const handleEnterRoom = (roomId, roomPassword = "") => {
        const room = rooms.find(r => r.id === roomId);
        if (!room) return;

        // 비밀번호 확인
        if (room.password && room.password !== "") {
            const enteredPassword = prompt("비밀번호를 입력하세요:");
            if (enteredPassword !== room.password) {
                alert("비밀번호가 틀렸습니다.");
                return;
            }
        }
        
        // (참고: 실제 '입장' 로직(플레이어 추가)은 GameRoomView 내부에서 처리)
        setSelectedRoomId(roomId);
        setCurrentView('room');
    };

    // [신규] 로비로 나가기
    const handleExitRoom = () => {
        setSelectedRoomId(null);
        setCurrentView('lobby');
    };
    
    // --- 1. 로그인 확인 ---
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
    
    // --- 2. 뷰 라우팅 ---
    
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
            {/* 모임 생성 모달 */}
            <CreateRoomModal
                isOpen={showCreateRoomModal}
                onClose={() => setShowCreateRoomModal(false)}
                onSubmit={handleCreateRoomSubmit}
                user={user}
                userData={userData}
            />
            
            {/* 로비 콘텐츠 */}
            <div className="p-4 flex-shrink-0">
                {/* 검색창 */}
                <div className="relative">
                    <input 
                        type="text"
                        placeholder="모임 이름 또는 장소로 검색"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full p-3 pl-10 bg-white rounded-lg shadow-sm border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#00B16A]"
                    />
                    <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                </div>
            </div>

            {/* 모임 목록 */}
            <div className="flex-grow overflow-y-auto p-4 pt-0 space-y-4 hide-scrollbar">
                {loadingRooms ? (
                    <>
                        <SkeletonRoomCard />
                        <SkeletonRoomCard />
                        <SkeletonRoomCard />
                    </>
                ) : filteredRooms.length === 0 ? (
                    <EmptyState
                        icon={AlertCircle}
                        title="열린 모임이 없습니다"
                        description={searchTerm ? "검색 결과가 없습니다." : "새로운 모임을 만들어보세요!"}
                        buttonText="모임 만들기"
                        onButtonClick={() => setShowCreateRoomModal(true)}
                    />
                ) : (
                    filteredRooms.map(room => (
                        <RoomCard 
                            key={room.id} 
                            room={room} 
                            onEnter={() => handleEnterRoom(room.id, room.password)} 
                        />
                    ))
                )}
            </div>
            
            {/* 모임 만들기 FAB (플로팅 버튼) */}
            <button
                onClick={() => setShowCreateRoomModal(true)}
                className="absolute bottom-6 right-6 bg-[#00B16A] text-white w-14 h-14 rounded-full shadow-lg shadow-green-500/30 flex items-center justify-center transition-transform transform hover:scale-110"
            >
                <Edit3 size={24} />
            </button>
        </div>
    );
}

// [신규] 로비의 모임방 카드 컴포넌트
function RoomCard({ room, onEnter }) {
    const levelColor = room.levelLimit === 'N조' ? 'text-gray-500' : 'text-[#00B16A]';
    
    // Firestore Timestamp를 Date 객체로 변환
    const formatDate = (timestamp) => {
        if (!timestamp) return '시간 정보 없음';
        const date = timestamp.toDate();
        // 예: 11. 07 (금) 13:05
        return `${date.getMonth() + 1}. ${date.getDate()} (${'일월화수목금토'[date.getDay()]}) ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    };

    return (
        <div 
            className="bg-white rounded-xl shadow-lg p-4 w-full text-left transition-shadow hover:shadow-md cursor-pointer"
            onClick={onEnter}
        >
            <div className="flex justify-between items-start mb-2">
                {/* 방 제목 및 관리자 */}
                <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-[#1E1E1E] truncate">{room.name}</h3>
                    <p className="text-sm text-gray-500 truncate">
                        방장: {room.adminName || '정보 없음'}
                    </p>
                </div>
                {/* 비밀방 아이콘 */}
                {room.password && <Lock size={16} className="text-gray-400 ml-2 flex-shrink-0" />}
            </div>
            
            {/* 장소 */}
            <div className="flex items-center text-sm text-gray-600 mb-3">
                <MapPin size={16} className="mr-2 flex-shrink-0 text-gray-400" />
                <span className="truncate">{room.location || '장소 미정'}</span>
            </div>

            {/* 태그: 인원, 급수, 생성 시간 */}
            <div className="flex flex-wrap gap-2 items-center text-sm">
                <span className="flex items-center gap-1 px-3 py-1 bg-gray-100 rounded-full text-gray-700 font-medium">
                    <Users2 size={14} /> 
                    {room.playerCount || 0} / {room.memberLimit || 'N'}명
                </span>
                <span className={`flex items-center gap-1 px-3 py-1 bg-gray-100 rounded-full font-medium ${levelColor}`}>
                    <BarChart2 size={14} />
                    {room.levelLimit || 'N조'}
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
        const unsubPlayers = onSnapshot(query(playersCollectionRef, orderBy("entryTime", "asc")), (snapshot) => {
            const playersData = snapshot.docs.reduce((acc, doc) => {
                acc[doc.id] = { id: doc.id, ...doc.data() };
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
                Object.keys(currentScheduledMatches).forEach(mIdx => {
                    const sIdx = currentScheduledMatches[mIdx].indexOf(null); // 방금 null로 만든 소스 위치
                    if (sIdx > -1) {
                         // playerInTargetSlot을 원래 소스 위치로 이동
                        currentScheduledMatches[mIdx][sIdx] = playerInTargetSlot;
                        sourceFound = false; // 스왑 완료
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
                // 소스 위치를 다시 찾아 타겟 플레이어 배치
                Object.keys(currentScheduledMatches).forEach(mIdx => {
                    const sIdx = currentScheduledMatches[mIdx].indexOf(null); // 방금 null로 만든 소스 위치
                    if (sIdx > -1) {
                        currentScheduledMatches[mIdx][sIdx] = targetPlayerId;
                        sourceFound = false;
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
        return <LoadingSpinner text="모임방 입장 중..." />;
    }
    
    if (error) {
        return (
            <div className="p-4">
                <EmptyState icon={AlertCircle} title="오류 발생" description={error} />
                <button 
                    onClick={onExitRoom}
                    className="mt-4 w-full py-2 bg-gray-200 text-gray-700 font-bold rounded-lg"
                >
                    로비로 돌아가기
                </button>
            </div>
        );
    }
    
    // (임시) 플레이어 목록 렌더링 (참고용)
    // [수정] waitingPlayers는 useMemo로 이동

    return (
        <div className="flex flex-col h-full bg-white">
            {/* 1. 경기방 헤더 */}
            <header className="flex-shrink-0 p-4 flex items-center justify-between gap-2 bg-white sticky top-16 z-10 border-b border-gray-200">
                <div className="flex items-center gap-2 min-w-0">
                    <button 
                        onClick={onExitRoom} 
                        className="p-2 rounded-full text-gray-500 hover:bg-gray-100 hover:text-[#1E1E1E] transition-colors"
                    >
                        <ArrowLeft size={24} />
                    </button>
                    <h1 className="text-xl font-bold text-[#1E1E1E] truncate">
                        {roomData?.name || '로딩 중...'}
                    </h1>
                </div>
                <div className="flex items-center gap-3">
                    {/* (TODO) 휴식 버튼 등 */}
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
            <nav className="flex-shrink-0 flex border-b border-gray-200 bg-white sticky top-32 z-10">
                <button 
                    onClick={() => setActiveTab('matching')}
                    className={`flex-1 py-3 text-center font-bold ${activeTab === 'matching' ? 'text-[#00B16A] border-b-2 border-[#00B16A]' : 'text-gray-500'}`}
                >
                    매칭
                </button>
                <button 
                    onClick={() => setActiveTab('inProgress')}
                    className={`flex-1 py-3 text-center font-bold ${activeTab === 'inProgress' ? 'text-[#00B16A] border-b-2 border-[#00B16A]' : 'text-gray-500'}`}
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
                            <h2 className="text-lg font-bold text-[#1E1E1E] mb-3">경기 진행</h2>
                            {/* (TODO) In-Progress Court List (구버전 참고) 구현 */}
                            <EmptyState icon={Trophy} title="진행 중인 경기가 없습니다" description="경기가 시작되면 이곳에 표시됩니다." />
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
        <header className="sticky top-0 bg-white z-10 p-4 shadow-sm flex justify-between items-center">
            <h1 className="text-3xl font-extrabold text-[#00B16A] tracking-tighter">
                COCKSTAR
            </h1>
            
            <div className="flex space-x-3 text-xl text-gray-700">
                <button 
                    onClick={onSearchClick} 
                    className="p-2 rounded-full hover:bg-gray-100 hover:text-[#1E1E1E] transition-colors"
                >
                    <Search size={24} />
                </button>
                <button 
                    onClick={onBellClick} 
                    className="p-2 rounded-full hover:bg-gray-100 hover:text-[#1E1E1E] transition-colors"
                >
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
                // [수정] GamePage에 user와 userData 프롭스 전달
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

    return (
        <>
            {showLoginModal && <AuthModal onClose={handleCloseModal} setPage={setPage} />}

            <div className="max-w-md mx-auto h-screen bg-gray-50 shadow-lg overflow-hidden flex flex-col font-sans text-[#1E1E1E] hide-scrollbar">
                
                {page === 'home' ? (
                    <HomePageHeader 
                        onSearchClick={() => alert('검색 기능 준비 중')}
                        onBellClick={() => alert('알림 기능 준비 중')}
                    />
                ) : (
                    <SubPageHeader page={page} onBackClick={() => setPage('home')} />
                )}

                <main className={`flex-grow overflow-y-auto pb-20 hide-scrollbar ${page !== 'home' ? 'bg-white' : ''}`}>
                    {renderPage()}
                </main>

                <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-gray-200 shadow-lg z-10">
                    <div className="flex justify-around h-16">
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

// 하단 탭 버튼 컴포넌트
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
