import React, { useState, useEffect, useRef } from 'react';
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
import { getFirestore, doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';
import {
    Home, Trophy, Store, Users, User, X, Loader2, ArrowLeft, ShieldCheck, ShoppingBag, MessageSquare,
    Search, Bell, MapPin, Heart, ChevronRight, Plus, Archive // EmptyState 아이콘
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
        const animateScroll = () => {
            // [수정] isHoveringRef.current 조건 제거
            if (storeContainerRef.current && !isDraggingRef.current) {
                // 스크롤 속도 (0.5px 씩)
                storeContainerRef.current.scrollLeft += 0.5; 
                
                if (storeContentWidthRef.current === 0) {
                    // (최초 1회) 컨텐츠 절반 너비 계산 (무한 루프 기준점)
                    storeContentWidthRef.current = storeContainerRef.current.scrollWidth / 2;
                }

                // 스크롤이 절반을 넘어가면 (두 번째 세트 시작점)
                if (storeContainerRef.current.scrollLeft >= storeContentWidthRef.current) {
                    // 스크롤 위치를 0으로 리셋 (첫 번째 세트 시작점)
                    storeContainerRef.current.scrollLeft = 0; 
                }
            }
            animationFrameRef.current = requestAnimationFrame(animateScroll);
        };

        // 1.5초(로딩 시뮬레이션) 후에 스크롤 시작
        const startTimer = setTimeout(() => {
             // 컴포넌트 마운트 시 최초 너비 계산
            if(storeContainerRef.current) {
                storeContentWidthRef.current = storeContainerRef.current.scrollWidth / 2;
            }
            animationFrameRef.current = requestAnimationFrame(animateScroll);
        }, 1500);

        return () => {
            // 컴포넌트 언마운트 시 애니메이션 프레임 정리
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
            clearTimeout(startTimer);
        };
    }, []); // 빈 배열: 마운트 시 1회 실행

    // [신규] '신상 스토어' 드래그 시작 핸들러
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
        storeContainerRef.current.scrollLeft = scrollLeftRef.current - dx; // 기존 스크롤 위치에서 변화량 적용
    };
    // [신규] '신상 스토어' 드래그 종료 핸들러
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
                    // [수정] onMouseEnter, onMouseOut 핸들러 제거
                    onMouseDown={handleStoreDragStart}
                    onMouseMove={handleStoreDragMove}
                    onMouseUp={handleStoreDragEnd}
                    onMouseLeave={handleStoreDragEnd} // 마우스가 컨테이너 밖으로 나가면 드래그 종료
                    onTouchStart={handleStoreDragStart}
                    onTouchMove={handleStoreDragMove}
                    onTouchEnd={handleStoreDragEnd}
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
 * 3. 경기 시스템 페이지
 */
function GamePage({ user, onLoginClick }) {
    if (!user) {
        return (
            <LoginRequiredPage
                icon={ShieldCheck}
                title="로그인 필요"
                description="경기/모임 시스템은 로그인 후 이용 가능합니다."
                onLoginClick={onLoginClick}
            />
        );
    }
    
    return (
        <div className="relative h-full">
            <ComingSoonPage
                icon={Trophy}
                title="경기 시스템"
                description="실시간 대진표, 선수 관리, 경기 기록 기능이 이곳에 구현될 예정입니다."
            />
            {/* (아이디어 #2) CTA 버튼 그림자 */}
            <button
                onClick={() => alert('모임 만들기 기능 준비 중')}
                className="absolute bottom-6 right-6 bg-[#00B16A] text-white w-14 h-14 rounded-full shadow-lg shadow-green-500/30 flex items-center justify-center transition-transform transform hover:scale-110"
            >
                <Plus size={28} />
            </button>
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
                return <GamePage user={user} onLoginClick={handleLoginClick} />;
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
