import React, { useState, useEffect, useCallback } from 'react';
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
    Search, Bell, MapPin, Heart, ChevronRight, Plus // 아이콘 추가
} from 'lucide-react';

// ===================================================================================
// Firebase 설정 (Vercel 환경 변수 사용)
// ===================================================================================
// .env.local 파일에 VITE_API_KEY=... 형식으로 실제 키를 넣어주세요.
// [FIX] 'import.meta.env' is not available in this preview environment.
// Using placeholders. You must set up .env.local in your actual Vite project.
const firebaseConfig = {
    apiKey: "YOUR_VITE_API_KEY_HERE", // import.meta.env.VITE_API_KEY,
    authDomain: "YOUR_VITE_AUTH_DOMAIN_HERE", // import.meta.env.VITE_AUTH_DOMAIN,
    projectId: "YOUR_VITE_PROJECT_ID_HERE", // import.meta.env.VITE_PROJECT_ID,
    storageBucket: "YOUR_VITE_STORAGE_BUCKET_HERE", // import.meta.env.VITE_STORAGE_BUCKET,
    messagingSenderId: "YOUR_VITE_MESSAGING_SENDER_ID_HERE", // import.meta.env.VITE_MESSAGING_SENDER_ID,
    appId: "YOUR_VITE_APP_ID_HERE" // import.meta.env.VITE_APP_ID
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
            {/* H1: 22px, Bold */}
            <h2 className="text-[22px] font-bold text-[#1E1E1E] mb-3">{title}</h2>
            {/* Body: 16px, Regular */}
            <p className="text-[16px]">{description}</p>
            {/* Caption: 14px, Medium */}
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
            {/* H1: 22px, Bold */}
            <h2 className="text-[22px] font-bold text-[#1E1E1E] mb-3">{title}</h2>
            {/* Body: 16px, Regular */}
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
            
            // Firestore에 사용자 정보가 있는지 확인
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (!userDoc.exists()) {
                // 새 사용자 정보 저장 (기본값)
                await setDoc(doc(db, "users", user.uid), {
                    name: user.displayName || '새 사용자',
                    email: user.email,
                    level: 'N조', // 기본 등급
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
                // 로그인
                await signInWithEmailAndPassword(auth, email, password);
            } else {
                // 회원가입
                if (name.length < 2) {
                    setError("이름을 2자 이상 입력해주세요.");
                    setLoading(false);
                    return;
                }
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;
                
                // Firestore에 추가 정보 저장
                await setDoc(doc(db, "users", user.uid), {
                    name: name,
                    email: user.email,
                    level: 'N조', // 기본 등급
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

    // Firebase 오류 메시지를 한국어로 변환
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
            {/* 가이드라인 8-12px -> 12px (rounded-xl) 적용 */}
            <div className="bg-gray-800 rounded-xl p-8 w-full max-w-md relative text-white shadow-2xl">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-500 hover:text-white"
                    disabled={loading}
                >
                    <X size={28} />
                </button>
                
                {/* H1: 22px, Bold */}
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
                    {/* Button: 16px, Bold */}
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

                {/* Caption: 14px, Medium */}
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
// 페이지 컴포넌트들
// ===================================================================================

/**
 * 1. 홈 페이지 (목업 기반으로 전체 교체)
 */
function HomePage({ user, setPage }) {
    
    // 섹션 타이틀 컴포넌트 (H2: 18px, Bold)
    const SectionHeader = ({ title, onMoreClick }) => (
        <div className="flex justify-between items-center mb-3">
            <h2 className="text-[18px] font-bold text-[#1E1E1E]">{title}</h2>
            {/* Caption: 14px, Medium */}
            <button onClick={onMoreClick} className="text-[14px] text-gray-500 font-medium flex items-center">
                더보기 <ChevronRight size={16} />
            </button>
        </div>
    );

    // 스토어 카드 (Body: 16px, Regular / Caption: 14px, Medium)
    const StoreCard = ({ image, title, brand }) => (
        <div className="w-36 flex-shrink-0">
            <div className="w-full h-32 bg-[#F5F5F5] rounded-lg flex items-center justify-center">
                {/* <img src={image} alt={title} /> */}
                <Store size={40} className="text-[#BDBDBD]" />
            </div>
            <p className="font-bold text-[#1E1E1E] mt-2 truncate text-[16px]">{title}</p>
            <p className="text-[14px] text-gray-600 font-medium">{brand}</p>
        </div>
    );

    // 경기 카드 (Body: 16px / Caption: 14px)
    const GameCard = ({ title, tags, location, current, total }) => (
        <button 
            onClick={() => setPage('game')}
            className="w-full p-4 border border-[#BDBDBD] rounded-lg shadow-sm text-left hover:bg-[#F5F5F5]"
        >
            <p className="font-bold text-[16px] text-[#1E1E1E]">{title}</p>
            <div className="flex space-x-2 my-2">
                {tags.map((tag, index) => (
                    <span 
                        key={index} 
                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            tag.type === 'level' ? 'bg-blue-100 text-blue-800' : 
                            tag.type === 'new' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}
                    >
                        #{tag.label}
                    </span>
                ))}
            </div>
            <div className="text-[14px] text-gray-600 flex justify-between items-center">
                <span className="flex items-center"><MapPin size={14} className="mr-1" /> {location}</span>
                <span className="font-bold text-[#00B16A] text-[16px]">( {current} / {total} 명 )</span>
            </div>
        </button>
    );

    // 커뮤니티 아이템 (Body: 16px)
    const CommunityPost = ({ category, title, likes }) => (
        <button 
            onClick={() => setPage('community')}
            className="p-3 bg-[#F5F5F5] rounded-lg flex justify-between items-center w-full hover:bg-gray-200"
        >
            <p className="truncate text-[#1E1E1E] text-[16px]">
                <span className={`font-semibold ${category === 'Q&A' ? 'text-[#00B16A]' : 'text-gray-700'} mr-2`}>
                    [{category}]
                </span>
                {title}
            </p>
            {/* Caption: 14px */}
            <span className="text-[14px] text-gray-500 whitespace-nowrap flex items-center">
                <Heart size={14} className="mr-1 text-red-500 fill-red-500" /> {likes}
            </span>
        </button>
    );

    return (
        <main className="flex-1 overflow-y-auto p-4 space-y-8 bg-white hide-scrollbar">
            
            {/* (1) 메인 배너 (rounded-xl: 12px) */}
            <section className="bg-[#F5F5F5] h-40 rounded-xl flex items-center justify-center text-gray-500">
                <p>메인 배너 (이벤트/광고)</p>
            </section>

            {/* (2) 섹션: 신상 스토어 */}
            <section>
                <SectionHeader title="신상 스토어" onMoreClick={() => setPage('store')} />
                <div className="flex overflow-x-auto space-x-4 pb-2 hide-scrollbar">
                    <StoreCard title="요넥스 신상 의류" brand="YONEX" />
                    <StoreCard title="빅터 신상 라켓" brand="VICTOR" />
                    <StoreCard title="테크니스트 V2" brand="TECHNIST" />
                </div>
            </section>

            {/* (3) 섹션: 지금 뜨는 경기 */}
            <section>
                <SectionHeader title="지금 뜨는 경기" onMoreClick={() => setPage('game')} />
                <div className="space-y-3">
                    <GameCard 
                        title="오산시 저녁 8시 초심 환영" 
                        tags={[{label: '초심', type: 'new'}, {label: '오산시', type: 'location'}]}
                        location="OO 체육관"
                        current={8}
                        total={12}
                    />
                    <GameCard 
                        title="수원시 주말 40대 A조 모임" 
                        tags={[{label: 'A조', type: 'level'}, {label: '수원시', type: 'location'}]}
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
                    <CommunityPost category="Q&A" title="이 라켓 써보신 분 후기..." likes={12} />
                    <CommunityPost category="자유글" title="C조 탈출하는 법 공유..." likes={8} />
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
    
    // 로그인은 되었지만, 기능은 준비 중 (이전 App.jsx의 복잡한 로직이 여기 통합되어야 함)
    // + 와이어프레임 기반 플로팅 버튼 추가
    return (
        <div className="relative h-full">
            <ComingSoonPage
                icon={Trophy}
                title="경기 시스템"
                description="실시간 대진표, 선수 관리, 경기 기록 기능이 이곳에 구현될 예정입니다. 이전 App.jsx의 로직이 통합됩니다."
            />
            {/* 와이어프레임 B: 플로팅 버튼(FAB) */}
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
    // 와이어프레임 C: 플로팅 버튼(FAB) 추가
    return (
        <div className="relative h-full">
            <ComingSoonPage
                icon={MessageSquare}
                title="커뮤니티"
                description="정보 공유, Q&A, 클럽 홍보, 중고마켓 게시판을 열심히 만들고 있습니다."
            />
            {/* 와이어프레임 C: 플로팅 버튼(FAB) */}
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

    if (!user) { // user는 auth 객체
        return (
            <div className="flex flex-col items-center justify-center h-full text-center text-[#1E1E1E] p-8">
                <User className="w-24 h-24 mb-6 text-[#BDBDBD]" />
                {/* H1: 22px, Bold */}
                <h2 className="text-[22px] font-bold mb-4">로그인이 필요합니다</h2>
                {/* Body: 16px, Regular */}
                <p className="text-gray-500 mb-8 text-[16px]">로그인하고 '콕스타'의 모든 기능을 이용해보세요!</p>
                {/* Button: 16px, Bold */}
                <button
                    onClick={onLoginClick}
                    className="px-10 py-3 bg-[#FFD700] text-black font-bold rounded-lg shadow-lg text-[16px] transition-transform transform hover:scale-105"
                >
                    로그인 / 회원가입
                </button>
            </div>
        );
    }

    if (!userData) { // userData는 firestore 객체
        return <LoadingSpinner text="내 정보 불러오는 중..." />;
    }

    return (
        <div className="p-5 text-[#1E1E1E]">
            {/* H1: 22px, Bold */}
            <h1 className="text-[22px] font-bold mb-8">내 정보</h1>
            
            {/* rounded-xl (12px) 적용 */}
            <div className="bg-[#F5F5F5] rounded-xl p-6 mb-6">
                <div className="flex items-center space-x-5">
                    <div className="w-20 h-20 bg-[#00B16A] rounded-full flex items-center justify-center">
                        <User className="w-12 h-12 text-white" />
                    </div>
                    <div>
                        {/* H2: 18px, Bold */}
                        <h2 className="text-[18px] font-bold">{userData?.name || '사용자'}</h2>
                        {/* Body: 16px, Regular */}
                        <p className="text-gray-600 text-[16px]">{userData?.email || user.email}</p>
                    </div>
                </div>
            </div>

            {/* rounded-xl (12px) 적용 */}
            <div className="bg-[#F5F5F5] rounded-xl p-6 mb-6">
                {/* H2: 18px, Bold */}
                <h3 className="text-[18px] font-semibold mb-4 text-[#00B16A]">나의 프로필</h3>
                {/* Body: 16px, Regular */}
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
                 {/* Button: 16px, Bold */}
                 <button className="mt-6 w-full py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-[16px] font-bold">
                    프로필 수정 (준비 중)
                </button>
            </div>

            {/* Button: 16px, Bold */}
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
 * 홈 페이지 헤더 (H1: 22px, Bold)
 */
function HomePageHeader({ onSearchClick, onBellClick }) {
    return (
        <header className="sticky top-0 bg-white z-10 p-4 border-b border-[#BDBDBD] flex justify-between items-center">
            <h1 className="text-[22px] font-bold text-[#00B16A]">콕스타</h1>
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
 * 공통 서브페이지 헤더 (H1: 22px, Bold)
 */
function SubPageHeader({ page, onBackClick }) {
    const title = page === 'game' ? '경기' :
                  page === 'store' ? '스토어' :
                  page ===U === 'community' ? '커뮤니티' : '내 정보';
    return (
        <header className="sticky top-0 bg-white/80 backdrop-blur-md z-10 p-4 border-b border-[#BDBDBD] flex items-center">
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
    const [user, setUser] = useState(null); // Firebase auth user 객체
    const [userData, setUserData] = useState(null); // Firestore user data
    const [loadingAuth, setLoadingAuth] = useState(true); // Auth 상태 로딩
    const [showLoginModal, setShowLoginModal] = useState(false);

    // Firebase Auth 상태 리스너
    useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            if (!currentUser) {
                // 로그아웃됨
                setUserData(null);
                setLoadingAuth(false);
            }
            // (currentUser가 있으면, onSnapshot 리스너가 userData를 설정할 것임)
        });
        return () => unsubscribeAuth(); // 컴포넌트 언마운트 시 리스너 해제
    }, []);

    // Firestore User 데이터 리스너
    useEffect(() => {
        let unsubscribeUser = () => {};
        if (user) {
            // 로그인됨 ->
            // Firestore에서 실시간으로 사용자 데이터 구독
            const userDocRef = doc(db, "users", user.uid);
            unsubscribeUser = onSnapshot(userDocRef, (doc) => {
                if (doc.exists()) {
                    setUserData(doc.data());
                } else {
                    // Auth는 있는데 DB가 없는 경우 (예: Google 최초 로그인)
                    const newUserData = {
                        name: user.displayName || '새 사용자',
                        email: user.email,
                        level: 'N조',
                        gender: '미설정',
                    };
                    setDoc(userDocRef, newUserData); // DB에 생성
                    setUserData(newUserData); // 상태에도 반영
                }
                setLoadingAuth(false); // userData까지 받아와야 로딩 완료
            });
        }
        
        return () => unsubscribeUser(); // 클린업
    }, [user]); // 'user' (auth 객체)가 변경될 때마다 이 이펙트 재실행

    const handleLogout = async () => {
        await signOut(auth);
        setPage('home'); // 로그아웃 후 홈으로 이동
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
                // HomePage는 App의 setPage가 필요해서 props로 넘겨줘야 함.
                // Firestore에서 가져온 user data (userData)를 전달
                return <HomePage user={userData} setPage={setPage} />;
            case 'game':
                return <GamePage user={user} onLoginClick={handleLoginClick} />; // Auth user (for login check)
            case 'store':
                return <StorePage />;
            case 'community':
                return <CommunityPage />;
            case 'myinfo':
                return <MyInfoPage user={user} userData={userData} onLoginClick={handleLoginClick} onLogout={handleLogout} />; // Auth user, Firestore data
            default:
                return <HomePage user={userData} setPage={setPage} />; // Firestore data
        }
    };

    if (loadingAuth) {
        return (
            // 디자인 가이드 적용
            <div className="bg-white min-h-screen flex items-center justify-center">
                <LoadingSpinner text="콕스타에 접속 중..." />
            </div>
        );
    }

    return (
        <>
            {/* 폰트 적용은 index.html에서 하므로 <style> 태그 제거 */}
            
            {/* 로그인 모달 */}
            {showLoginModal && <AuthModal onClose={handleCloseModal} setPage={setPage} />}

            {/* 메인 앱 레이아웃 (스마트폰 프레임) */}
            {/* hide-scrollbar 클래스 추가 */}
            <div className="max-w-md mx-auto h-screen bg-white shadow-lg overflow-hidden flex flex-col font-sans text-[#1E1E1E] hide-scrollbar">
                
                {/* 헤더 (페이지별 분기 처리) */}
                {page === 'home' ? (
                    <HomePageHeader 
                        onSearchClick={() => alert('검색 기능 준비 중')}
                        onBellClick={() => alert('알림 기능 준비 중')}
                    />
                ) : (
                    <SubPageHeader page={page} onBackClick={() => setPage('home')} />
                )}


                {/* 메인 컨텐츠 영역 (하단 탭 높이만큼 패딩) */}
                {/* hide-scrollbar 클래스 추가 */}
                <main className="flex-grow overflow-y-auto pb-20 hide-scrollbar">
                    {renderPage()}
                </main>

                {/* 하단 네비게이션 탭 */}
                <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-[#BDBDBD] shadow-lg z-10">
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

// 하단 탭 버튼 컴포넌트 (Caption: 14px, Medium)
// 14px로 적용 시 5개 탭이 깨질 수 있으므로, 12px(text-xs) 유지 (디자인 가이드 C 예외)
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
