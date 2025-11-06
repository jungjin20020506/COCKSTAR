import React, { useState, useEffect } from 'react';
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
    Search, Bell, MapPin, Heart, ChevronRight, Plus
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
            <span className="mt-4 text-[16px] font-semibold">{text}</span>
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
            <h2 className="text-[22px] font-bold text-[#1E1E1E] mb-3">{title}</h2>
            <p className="text-[16px]">{description}</p>
            <p className="mt-2 text-[14px]">빠른 시일 내에 멋진 기능으로 찾아뵙겠습니다!</p>
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
            <h2 className="text-[22px] font-bold text-[#1E1E1E] mb-3">{title}</h2>
            <p className="text-[16px]">{description}</p>
            <button
                onClick={onLoginClick}
                className="mt-8 px-8 py-3 bg-[#FFD700] text-black text-[16px] font-bold rounded-lg shadow-lg transition-transform transform hover:scale-105"
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
            {/* [UI 개선] rounded-xl 적용 */}
            <div className="bg-gray-800 rounded-xl p-8 w-full max-w-md relative text-white shadow-2xl">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-500 hover:text-white"
                    disabled={loading}
                >
                    <X size={28} />
                </button>
                
                <h2 className="text-[22px] font-bold text-center mb-6 text-[#FFD700]">
                    {isLoginMode ? '콕스타 로그인' : '콕스타 회원가입'}
                </h2>

                {error && <p className="text-red-400 text-center mb-4 bg-red-900/50 p-3 rounded-lg text-[14px]">{error}</p>}

                <form onSubmit={handleEmailAuth} className="space-y-4">
                    {!isLoginMode && (
                        <input
                            type="text"
                            placeholder="이름 (닉네임)"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                            className="w-full p-4 bg-gray-700 rounded-lg text-white placeholder-gray-400 border-2 border-gray-600 focus:border-[#00B16A] focus:outline-none text-[16px]"
                        />
                    )}
                    <input
                        type="email"
                        placeholder="이메일 주소"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="w-full p-4 bg-gray-700 rounded-lg text-white placeholder-gray-400 border-2 border-gray-600 focus:border-[#00B16A] focus:outline-none text-[16px]"
                    />
                    <input
                        type="password"
                        placeholder="비밀번호 (6자 이상)"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="w-full p-4 bg-gray-700 rounded-lg text-white placeholder-gray-400 border-2 border-gray-600 focus:border-[#00B16A] focus:outline-none text-[16px]"
                    />
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-4 bg-[#00B16A] text-white font-bold rounded-lg text-[16px] hover:bg-green-600 transition-colors disabled:bg-gray-600 flex items-center justify-center"
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
                    className="w-full py-4 bg-white text-black font-bold rounded-lg text-[16px] hover:bg-gray-200 transition-colors flex items-center justify-center gap-3 disabled:bg-gray-400"
                >
                    <svg className="w-6 h-6" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.8 2.38 30.47 0 24 0 14.62 0 6.78 5.48 2.76 13.23l7.88 6.14C12.24 13.62 17.7 9.5 24 9.5z"></path><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.9-2.26 5.48-4.8 7.18l7.66 5.92C42.92 38.04 46.98 32.08 46.98 24.55z"></path><path fill="#FBBC05" d="M10.6 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59L2.76 13.23C1.18 16.29 0 19.99 0 24s1.18 7.71 2.76 10.77l7.84-5.18z"></path><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.66-5.92c-2.13 1.45-4.82 2.3-7.92 2.3-6.11 0-11.31-4.08-13.16-9.56L2.76 34.77C6.78 42.52 14.62 48 24 48z"></path><path fill="none" d="M0 0h48v48H0z"></path></svg>
                    Google 계정으로 계속하기
                </button>

                <p className="mt-6 text-center text-gray-400 text-[14px] font-medium">
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
// 페이지 컴포넌트들 (UI 개선안 적용)
// ===================================================================================

/**
 * 1. 홈 페이지 (UI 개선안 전체 적용)
 */
function HomePage({ user, setPage }) {
    
    // [UI 개선] 섹션 타이틀 (11, 12, 14)
    const SectionHeader = ({ title, onMoreClick }) => (
        <div className="flex justify-between items-center mb-4">
            {/* 11. H2 강조 (text-xl), 12. 자간 (tracking-tight) */}
            <h2 className="text-xl font-bold text-[#1E1E1E] tracking-tight">{title}</h2>
            {/* 14. '더보기' 버튼 (font-semibold, text-gray-700) */}
            <button 
                onClick={onMoreClick} 
                className="text-sm font-semibold text-gray-700 hover:text-[#00B16A] flex items-center"
            >
                더보기 <ChevronRight size={18} />
            </button>
        </div>
    );

    // [UI 개선] 스토어 카드 (2, 4, 15, 20)
    const StoreCard = ({ image, title, brand }) => (
        <div className="w-40 flex-shrink-0">
            {/* 2. bg-white, 4. shadow-lg, 15. rounded-xl */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                {/* 20. 이미지 플레이스홀더 교체 (img 태그 사용) */}
                <img 
                    src={image || "https://placehold.co/160x128/F5F5F5/BDBDBD?text=Store"} 
                    alt={title} 
                    className="w-full h-32 object-cover"
                />
                <div className="p-3">
                    <p className="font-bold text-[#1E1E1E] truncate text-[16px]">{title}</p>
                    {/* 6. 회색 통일 (text-gray-600) */}
                    <p className="text-[14px] text-gray-600 font-medium">{brand}</p>
                </div>
            </div>
        </div>
    );

    // [UI 개선] 경기 카드 (2, 3, 4, 10, 15, 16, 17, 18, 22)
    const GameCard = ({ title, tags, location, current, total }) => (
        <button 
            onClick={() => setPage('game')}
            // 2. bg-white, 3. border 제거, 4. shadow-lg, 10. p-4, 15. rounded-xl
            className="w-full p-4 bg-white rounded-xl shadow-lg text-left transition-transform transform hover:scale-[1.02]"
        >
            <p className="font-bold text-[16px] text-[#1E1E1E] mb-2">{title}</p>
            <div className="flex flex-wrap gap-2 mb-3">
                {tags.map((tag, index) => (
                    <span 
                        key={index} 
                        // 16. 태그 축소, 17. 태그 컬러 단순화
                        className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-700"
                    >
                        #{tag.label}
                    </span>
                ))}
            </div>
            <div className="flex justify-between items-center">
                {/* 6. 회색 통일, 18. 아이콘 크기 (size 16) */}
                <span className="text-[14px] text-gray-600 flex items-center">
                    <MapPin size={16} className="mr-1" /> {location}
                </span>
                {/* 22. 인원 수 표시 (괄호 제거, 폰트 수정) */}
                <span className="text-sm font-semibold text-gray-700">{current} / {total}명</span>
            </div>
        </button>
    );

    // [UI 개선] 커뮤니티 아이템 (2, 4, 10, 15, 18, 21)
    const CommunityPost = ({ category, title, likes }) => (
        <button 
            onClick={() => setPage('community')}
            // 2. bg-white, 4. shadow-lg, 10. p-4, 15. rounded-xl
            className="p-4 bg-white rounded-xl shadow-lg flex justify-between items-center w-full transition-shadow hover:shadow-md"
        >
            <p className="truncate text-[#1E1E1E] text-[16px] flex-1 mr-4">
                <span className={`font-semibold ${category === 'Q&A' ? 'text-[#00B16A]' : 'text-gray-700'} mr-2`}>
                    [{category}]
                </span>
                {title}
            </p>
            {/* 18. 아이콘 크기, 21. 하트 아이콘 (fill-none, text-gray-500) */}
            <span className="text-[14px] text-gray-500 whitespace-nowrap flex items-center font-medium">
                <Heart size={16} className="mr-1 text-gray-500" fill="none" /> {likes}
            </span>
        </button>
    );

    return (
        // [UI 개선] 7. 좌우 여백 (p-4)
        <main className="flex-1 overflow-y-auto p-4 space-y-8 hide-scrollbar">
            
            {/* [UI 개선] 5. 메인 배너 (그라데이션), 15. rounded-xl */}
            <section className="bg-gradient-to-r from-[#00B16A] to-[#008a50] h-40 rounded-xl flex items-center justify-center text-white p-6 shadow-lg">
                <h2 className="text-xl font-bold">Dynamic & Reliable Playground</h2>
            </section>

            {/* (2) 섹션: 신상 스토어 */}
            <section>
                <SectionHeader title="신상 스토어" onMoreClick={() => setPage('store')} />
                {/* [UI 개선] 7, 8. 가로 스크롤 여백 (px-4로 컨테이너에 패딩) */}
                <div className="flex overflow-x-auto space-x-4 pb-2 hide-scrollbar -mx-4 px-4">
                    <StoreCard title="요넥스 신상 의류" brand="YONEX" image="https://placehold.co/160x128/E0F2F1/00695C?text=YONEX" />
                    <StoreCard title="빅터 신상 라켓" brand="VICTOR" image="https://placehold.co/160x128/E3F2FD/01579B?text=VICTOR" />
                    <StoreCard title="테크니스트 V2" brand="TECHNIST" image="https://placehold.co/160x128/F1F8E9/33691E?text=TECHNIST" />
                    <StoreCard title="리닝 에어로우" brand="LI-NING" image="https://placehold.co/160x128/FFF8E1/E65100?text=LI-NING" />
                </div>
            </section>

            {/* (3) 섹션: 지금 뜨는 경기 */}
            <section>
                <SectionHeader title="지금 뜨는 경기" onMoreClick={() => setPage('game')} />
                {/* [UI 개선] 9. 섹션 구분 (space-y-4) */}
                <div className="space-y-4">
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
                </div>
            </section>

            {/* (4) 섹션: 커뮤니티 인기글 */}
            <section>
                <SectionHeader title="커뮤니티 인기글" onMoreClick={() => setPage('community')} />
                <div className="space-y-3">
                    <CommunityPost category="Q&A" title="이 라켓 써보신 분 후기 있으신가요?" likes={12} />
                    <CommunityPost category="자유글" title="C조 탈출하는 법.txt 공유합니다" likes={8} />
                    <CommunityPost category="중고" title="[판매] 빅터 제트스피드 S12 팝니다" likes={5} />
                </div>
            </section>

        </main>
    );
}


/**
 * 2. 경기 시스템 페이지
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
            <button
                onClick={() => alert('모임 만들기 기능 준비 중')}
                className="absolute bottom-6 right-6 bg-[#00B16A] text-white w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-transform transform hover:scale-110"
            >
                <Plus size={28} />
            </button>
        </div>
    );
}

/**
 * 3. 스토어 페이지
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
 * 4. 커뮤니티 페이지
 */
function CommunityPage() {
    return (
        <div className="relative h-full">
            <ComingSoonPage
                icon={MessageSquare}
                title="커뮤니티"
                description="정보 공유, Q&A, 클럽 홍보, 중고마켓 게시판을 열심히 만들고 있습니다."
            />
            <button
                onClick={() => alert('글쓰기 기능 준비 중')}
                className="absolute bottom-6 right-6 bg-[#00B16A] text-white w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-transform transform hover:scale-110"
            >
                <Plus size={28} />
            </button>
        </div>
    );
}

/**
 * 5. 내 정보 페이지
 */
function MyInfoPage({ user, userData, onLoginClick, onLogout }) { 

    if (!user) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center text-[#1E1E1E] p-8">
                <User className="w-24 h-24 mb-6 text-[#BDBDBD]" />
                <h2 className="text-[22px] font-bold mb-4">로그인이 필요합니다</h2>
                <p className="text-gray-500 mb-8 text-[16px]">로그인하고 '콕스타'의 모든 기능을 이용해보세요!</p>
                <button
                    onClick={onLoginClick}
                    className="px-10 py-3 bg-[#FFD700] text-black font-bold rounded-lg shadow-lg text-[16px] transition-transform transform hover:scale-105"
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
        <div className="p-5 text-[#1E1E1E]">
            <h1 className="text-[22px] font-bold mb-8">내 정보</h1>
            
            {/* [UI 개선] 15. rounded-xl 적용 */}
            <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
                <div className="flex items-center space-x-5">
                    <div className="w-20 h-20 bg-[#00B16A] rounded-full flex items-center justify-center">
                        <User className="w-12 h-12 text-white" />
                    </div>
                    <div>
                        <h2 className="text-[18px] font-bold">{userData?.name || '사용자'}</h2>
                        <p className="text-gray-600 text-[16px]">{userData?.email || user.email}</p>
                    </div>
                </div>
            </div>

            {/* [UI 개선] 15. rounded-xl 적용 */}
            <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
                <h3 className="text-[18px] font-semibold mb-4 text-[#00B16A]">나의 프로필</h3>
                <div className="space-y-3 text-[16px]">
                    <div className="flex justify-between">
                        <span className="text-gray-500">급수</span>
                        <span className="font-semibold">{userData?.level || '미설정'}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-500">성별</span>
                        <span className="font-semibold">{userData?.gender || '미설정'}</span>
                    </div>
                </div>
                 <button className="mt-6 w-full py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-[16px] font-bold">
                    프로필 수정 (준비 중)
                </button>
            </div>

            <button
                onClick={onLogout}
                className="w-full py-4 bg-red-600 text-white font-bold rounded-lg text-[16px] hover:bg-red-700 transition-colors"
            >
                로그아웃
            </button>
        </div>
    );
}

/**
 * [UI 개선] 홈 페이지 헤더 (19. shadow-sm, COCKSTAR 로고)
 */
function HomePageHeader({ onSearchClick, onBellClick }) {
    return (
        // 19. border-b 제거, shadow-sm 적용. bg-white로 배경색 명시
        <header className="sticky top-0 bg-white z-10 p-4 shadow-sm flex justify-between items-center">
            {/* COCKSTAR 로고 이미지 (public/logo.png) */}
            <img src="/logo.png" alt="COCKSTAR" className="h-6" /> {/* 로고 높이 h-6 (24px) */}
            
            <div className="flex space-x-5 text-xl text-gray-700">
                <button onClick={onSearchClick} className="hover:text-[#1E1E1E]">
                    <Search size={24} />
                </button>
                <button onClick={onBellClick} className="hover:text-[#1E1E1E]">
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
        // [UI 개선] 19. shadow-sm, bg-white로 배경색 명시 (기존 backdrop-blur 유지)
        <header className="sticky top-0 bg-white/80 backdrop-blur-md z-10 p-4 shadow-sm flex items-center">
            <button onClick={onBackClick} className="mr-3 text-gray-500 hover:text-[#1E1E1E]">
                <ArrowLeft size={24} />
            </button>
            <h1 className="text-[22px] font-bold text-[#1E1E1E]">
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
Read more about this in the [documentation](https://google.com).
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
                    setDoc(userDocRef, newUserData);
                    setUserData(newUserData);
                }
                setLoadingAuth(false);
            });
        }
        
        return () => unsubscribeUser();
    }, [user]);

    const handleLogout = async () => {
        await signOut(auth);
        setPage('home');
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
                return <MyInfoPage user={user} userData={userData} onLoginClick={handleLoginClick} onLogout={handleLogout} />;
            default:
                return <HomePage user={userData} setPage={setPage} />;
        }
    };

    if (loadingAuth) {
        return (
            <div className="bg-white min-h-screen flex items-center justify-center">
                <LoadingSpinner text="콕스타에 접속 중..." />
            </div>
        );
    }

    return (
        <>
            {showLoginModal && <AuthModal onClose={handleCloseModal} setPage={setPage} />}

            {/* [UI 개선] 메인 앱 레이아웃
              1. 전체 배경색 (bg-gray-50) 적용
              - 스크롤바 숨기기 (hide-scrollbar)
            */}
            <div className="max-w-md mx-auto h-screen bg-gray-50 shadow-lg overflow-hidden flex flex-col font-sans text-[#1E1E1E] hide-scrollbar">
                
                {/* 헤더 (페이지별 분기 처리) */}
                {page === 'home' ? (
                    <HomePageHeader 
                        onSearchClick={() => alert('검색 기능 준비 중')}
                        onBellClick={() => alert('알림 기능 준비 중')}
                    />
                ) : (
                    <SubPageHeader page={page} onBackClick={() => setPage('home')} />
                )}


                {/* [UI 개선] 메인 컨텐츠 영역
                  - 홈이 아닐 때는 bg-white를 주어 카드와 구분 (MyInfo 등)
                  - 홈은 자체 p-4가 있으므로 여기엔 패딩 없음
                */}
                <main className={`flex-grow overflow-y-auto pb-20 hide-scrollbar ${page !== 'home' ? 'bg-white' : ''}`}>
                    {renderPage()}
                </main>

                {/* 하단 네비게이션 탭 */}
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
            className={`flex flex-col items-center justify-center w-full pt-3 pb-2 transition-colors ${
                isActive ? 'text-[#00B16A]' : 'text-gray-400 hover:text-gray-600'
            }`}
        >
            <Icon size={26} className="mb-1" />
            <span className={`text-xs ${isActive ? 'font-bold' : 'font-medium'}`}>
                {label}
            </span>
        </button>
    );
};
