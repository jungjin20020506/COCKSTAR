import React, { useState, useEffect, useRef, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
// [수정] 중복된 import를 하나로 합쳤습니다.
import {
    getAuth, onAuthStateChanged, signOut,
    createUserWithEmailAndPassword, signInWithEmailAndPassword,
    signInWithPhoneNumber, updatePassword, PhoneAuthProvider,
    signInWithCredential, OAuthProvider, signInWithPopup,
    EmailAuthProvider, reauthenticateWithCredential,
    RecaptchaVerifier,
    GoogleAuthProvider, // 추가: ReferenceError 해결
    updateProfile
} from 'firebase/auth';
import { 
    getFirestore, doc, setDoc, getDoc, onSnapshot,
    collection, query, where, addDoc, serverTimestamp,
    orderBy, updateDoc, deleteDoc, runTransaction, writeBatch,
    getDocs,
    increment // 인원수 증감을 위해 추가
} from 'firebase/firestore';
// StoreIcon 대신 Map 아이콘을 가져옵니다.
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
    Phone as PhoneIcon, // 추가: Phone 아이콘 소스 가져오기
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
    Share2 as Share2Icon, // 공유 아이콘 추가
    Copy as CopyIcon,      // 복사 아이콘 추가
    FlaskConical as FlaskConicalIcon // [테스트용] 플라스크 아이콘 추가
} from 'lucide-react';

// [추가] Lucide 아이콘의 선 굵기를 일괄 조절하는 헬퍼 함수
const createThinIcon = (Icon) => (props) => <Icon {...props} strokeWidth={1.5} />;

const Share2 = createThinIcon(Share2Icon);
const Copy = createThinIcon(CopyIcon);
const FlaskConical = createThinIcon(FlaskConicalIcon);
const Home = createThinIcon(HomeIcon);
const Trophy = createThinIcon(TrophyIcon);
const KokMap = createThinIcon(MapIcon); // Store -> KokMap으로 명칭 변경
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
const Phone = createThinIcon(PhoneIcon); // 추가: Phone 아이콘 정의
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
// 현재 badminton-app 로그인 방식은 Kakao(OAuthProvider)를 사용하므로 
// 아래 googleProvider 선언은 에러 방지를 위해 주석 처리하거나 삭제해도 무방합니다.
const googleProvider = new GoogleAuthProvider();

// [신규] 앱 ID (Firestore 경로에 사용)
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// [신규] 슈퍼 관리자 식별자 (이메일이 'domain'으로 시작하면 관리자)
const isSuperAdmin = (user) => {
    return user && (user.email?.startsWith('domain') || user.email === 'domain@special.user');
};
const convertToEmail = (input) => {
    // 1. 공백 제거
    const cleanInput = input.trim();
    
    // 2. 슈퍼 관리자 (domain) 처리
    if (cleanInput === 'domain') {
        return 'domain@special.user';
    }
    
    // 3. 이미 이메일 형식(@가 있음)이라면 그대로 반환
    if (cleanInput.includes('@')) {
        return cleanInput;
    }
    
    // 4. 일반 아이디라면 뒷부분에 가짜 도메인 붙이기 (이전 앱 호환)
    return `${cleanInput}@cockstar.app`;
};
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

function AuthModal({ isOpen, onClose }) {
    const [loginMode, setLoginMode] = useState('select'); // 'select', 'phone', 'admin', 'verify'
    const [error, setError] = useState('');
    const [adminData, setAdminData] = useState({ id: '', pw: '' });
    
    // [신규] 전화번호 로그인 상태 관리
    const [phone, setPhone] = useState('');
    const [vCode, setVCode] = useState('');
    const [confirmationResult, setConfirmationResult] = useState(null);
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    // [신규] 인증번호 전송 함수
    const handleSendCode = async () => {
        if (!phone.trim()) return setError("전화번호를 입력해주세요.");
        setError('');
        setLoading(true);

        try {
            // invisible 리캡차 설정 (버튼 클릭 시 자동으로 검증)
            const recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
                'size': 'invisible'
            });
            
            // 한국 국가번호(+82) 추가 및 010의 앞 0 제거
            const formatPhone = phone.startsWith('+') ? phone : `+82${phone.replace(/^0/, '')}`;
            
            const result = await signInWithPhoneNumber(auth, formatPhone, recaptchaVerifier);
            setConfirmationResult(result);
            setLoginMode('verify'); // 인증번호 입력 화면으로 전환
        } catch (err) {
            console.error(err);
            setError("인증번호 전송에 실패했습니다. 번호를 확인해주세요.");
        } finally {
            setLoading(false);
        }
    };

    // [신규] 인증번호 확인 함수
    const handleVerifyCode = async () => {
        if (!vCode.trim()) return setError("인증번호를 입력해주세요.");
        setError('');
        setLoading(true);
        try {
            await confirmationResult.confirm(vCode);
            onClose(); // 로그인 성공 시 모달 닫기
        } catch (err) {
            setError("인증번호가 일치하지 않습니다.");
        } finally {
            setLoading(false);
        }
    };

    // 카카오 로그인 (OAuthProvider 사용)
    const handleKakaoLogin = async () => {
        try {
            const provider = new OAuthProvider('oidc.kakao');
            await signInWithPopup(auth, provider);
            onClose();
        } catch (err) { setError("카카오 로그인 실패: " + err.message); }
    };

    // 관리자 로그인 로직
    const handleAdminLogin = async (e) => {
        e.preventDefault();
        const email = adminData.id === 'domain' ? 'domain@special.user' : `${adminData.id}@cockstar.app`;
        try {
            await signInWithEmailAndPassword(auth, email, adminData.pw);
            onClose();
        } catch (err) { setError("관리자 정보가 일치하지 않습니다."); }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl animate-fade-in-up">
                <div className="p-8">
                    <div className="text-center mb-8">
                        <h1 className="text-3xl font-black text-[#00B16A] tracking-tighter mb-2">COCKSTAR</h1>
                        <p className="text-gray-400 text-sm font-medium">배드민턴 동호인의 신뢰받는 놀이터</p>
                    </div>

                    {error && <p className="text-red-500 text-xs text-center mb-4 font-bold">{error}</p>}

                   {loginMode === 'select' && (
                        <div className="space-y-3">
                            <button 
                                onClick={handleKakaoLogin}
                                className="w-full py-4 bg-[#FEE500] text-[#3c1e1e] font-bold rounded-2xl flex items-center justify-center gap-2 shadow-sm hover:opacity-90 transition-all"
                            >
                                <MessageSquare size={18} fill="#3c1e1e" /> 카카오톡으로 시작하기
                            </button>
                            <button 
                                onClick={() => setLoginMode('phone')}
                                className="w-full py-4 bg-white border-2 border-gray-100 text-gray-700 font-bold rounded-2xl flex items-center justify-center gap-2 hover:bg-gray-50 transition-all"
                            >
                                <Phone size={18} /> 휴대폰 번호로 시작하기
                            </button>
                        </div>
                    )}

                    {loginMode === 'phone' && (
                        <div className="space-y-4">
                            {/* 리캡차 컨테이너 (필수) */}
                            <div id="recaptcha-container"></div>
                            <input 
                                type="tel" 
                                placeholder="휴대폰 번호 (01012345678)" 
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                className="w-full p-4 bg-gray-50 border border-gray-100 rounded-xl focus:border-[#00B16A] outline-none font-bold"
                            />
                            <button 
                                onClick={handleSendCode}
                                disabled={loading}
                                className="w-full py-4 bg-[#00B16A] text-white font-bold rounded-xl shadow-lg flex items-center justify-center transition-all active:scale-95"
                            >
                                {loading ? <Loader2 className="animate-spin" /> : '인증번호 전송'}
                            </button>
                            <button onClick={() => setLoginMode('select')} className="w-full text-gray-400 text-sm font-medium">뒤로가기</button>
                        </div>
                    )}

                    {loginMode === 'verify' && (
                        <div className="space-y-4">
                            <p className="text-center text-sm text-gray-500 font-medium">전송된 인증번호 6자리를 입력해주세요.</p>
                            <input 
                                type="number" 
                                placeholder="000000" 
                                value={vCode}
                                onChange={(e) => setVCode(e.target.value)}
                                className="w-full p-4 bg-gray-50 border border-gray-100 rounded-xl focus:border-[#00B16A] outline-none text-center text-2xl font-black tracking-widest"
                            />
                            <button 
                                onClick={handleVerifyCode}
                                disabled={loading}
                                className="w-full py-4 bg-[#1E1E1E] text-white font-bold rounded-xl shadow-lg flex items-center justify-center transition-all active:scale-95"
                            >
                                {loading ? <Loader2 className="animate-spin" /> : '인증 완료'}
                            </button>
                            <button onClick={() => setLoginMode('phone')} className="w-full text-gray-400 text-sm font-medium">번호 다시 입력하기</button>
                        </div>
                    )}

                    {loginMode === 'admin' && (
                        <form onSubmit={handleAdminLogin} className="space-y-3">
                            <input 
                                type="text" placeholder="관리자 아이디" 
                                onChange={e => setAdminData({...adminData, id: e.target.value})}
                                className="w-full p-4 bg-gray-50 border border-gray-100 rounded-xl focus:border-[#00B16A] outline-none"
                            />
                            <input 
                                type="password" placeholder="비밀번호" 
                                onChange={e => setAdminData({...adminData, pw: e.target.value})}
                                className="w-full p-4 bg-gray-50 border border-gray-100 rounded-xl focus:border-[#00B16A] outline-none"
                            />
                            <button type="submit" className="w-full py-4 bg-[#1E1E1E] text-white font-bold rounded-xl">관리자 인증</button>
                            <button onClick={() => setLoginMode('select')} className="w-full text-gray-400 text-sm font-medium mt-2">뒤로가기</button>
                        </form>
                    )}
                    {/* [디자인 요청] 하단 연하고 작고 얇은 관리자 로그인 */}
                    {loginMode === 'select' && (
                        <div className="mt-10 text-center">
                            <button 
                                onClick={() => setLoginMode('admin')}
                                className="text-[10px] text-gray-300 font-light hover:text-gray-500 transition-colors border-b border-gray-100"
                            >
                                시스템 관리자 전용 로그인
                            </button>
                        </div>
                    )}
                </div>
                <button onClick={onClose} className="w-full py-4 bg-gray-50 text-gray-400 text-xs font-bold border-t border-gray-100">
                    다음에 하기
                </button>
            </div>
        </div>
    );
}

// [수정] 실제 주소 검색 및 좌표 변환 기능이 추가된 모임 생성 모달
function CreateRoomModal({ isOpen, onClose, onSubmit, user, userData }) {
    // 폼 상태
    const [roomName, setRoomName] = useState('');
    const [locationName, setLocationName] = useState(''); // 장소 이름 (예: 콕스타 배드민턴장)
    const [address, setAddress] = useState('');   // 실제 주소 (예: 서울 강남구...)
    const [coords, setCoords] = useState(null);   // 좌표 {lat, lng}
    
    const [description, setDescription] = useState('');
    const [levelLimit, setLevelLimit] = useState('N조');
    const [maxPlayers, setMaxPlayers] = useState(20);
    const [usePassword, setUsePassword] = useState(false);
    const [password, setPassword] = useState('');
    
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // 초기화
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

    // [핵심] 주소 검색 및 좌표 변환 핸들러
    const handleAddressSearch = () => {
        if (!window.daum || !window.daum.Postcode) {
            alert("주소 검색 서비스를 불러오는데 실패했습니다.");
            return;
        }

        new window.daum.Postcode({
            oncomplete: function(data) {
                // 1. 주소 선택 결과 받기
                const addr = data.roadAddress || data.jibunAddress; // 도로명 또는 지번
                const buildingName = data.buildingName || '';       // 건물명
                
                setAddress(addr);
                // 장소명에 건물명이 있으면 자동 입력 (사용자가 수정 가능)
                if (!locationName && buildingName) {
                    setLocationName(buildingName);
                }

               // 2. 주소를 좌표로 변환 (Geocoding)
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
        if (maxPlayers < 4) return setError('최소 인원은 4명 이상이어야 합니다.'); // 인원수 검증 추가
        if (usePassword && !password) return setError('비밀번호를 입력해주세요.');

        setLoading(true);

        const newRoomData = {
            name: roomName,
            location: locationName || address,
            address: address,
            coords: coords,
            description: description || '모임 소개가 없습니다.',
            levelLimit: levelLimit,
            maxPlayers: parseInt(maxPlayers), // 숫자로 저장
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
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl p-6 w-full max-w-lg relative text-[#1E1E1E] shadow-2xl max-h-[90vh] overflow-y-auto animate-fade-in-up">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-black transition-colors"
                    disabled={loading}
                >
                    <X size={24} />
                </button>
                
                <h2 className="text-xl font-bold text-center mb-6">새 모임방 만들기</h2>

                {error && <p className="text-red-500 text-center mb-4 bg-red-50 p-3 rounded-lg text-sm font-medium">{error}</p>}

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
                            className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 focus:border-[#00B16A] focus:outline-none font-medium"
                        />
                    </div>

                    {/* [UI 개선] 주소 설정 섹션 */}
                    <div className="space-y-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
                        <label className="block text-sm font-bold text-gray-700">📍 모임 장소 설정</label>
                        
                        {/* 1. 주소 검색 버튼 */}
                        <button 
                            type="button"
                            onClick={handleAddressSearch}
                            className="w-full py-3 bg-white border border-gray-300 rounded-lg text-sm font-bold text-gray-700 hover:bg-gray-50 hover:border-[#00B16A] hover:text-[#00B16A] transition-all flex items-center justify-center gap-2 shadow-sm"
                        >
                            <Search size={16} />
                            주소 검색하기
                        </button>

                       {/* 2. 현재 설정된 주소 표시 (읽기 전용) */}
                        <div>
                            <span className="text-xs text-gray-400 font-medium ml-1 mb-1 block">현재 설정된 주소</span>
                            <div className={`w-full p-3 rounded-lg border text-sm font-medium ${address ? 'bg-green-50 border-green-200 text-[#1E1E1E]' : 'bg-gray-100 border-gray-200 text-gray-400'}`}>
                                {address ? (
                                    <div className="flex items-center gap-2">
                                        <span>{address}</span>
                                        {coords && <span className="text-[10px] bg-[#00B16A] text-white px-1.5 py-0.5 rounded-full">좌표O</span>}
                                    </div>
                                ) : (
                                    "주소가 설정되지 않았습니다."
                                )}
                            </div>
                        </div>

                        {/* 3. 장소명/상세주소 입력 */}
                        <div>
                            <span className="text-xs text-gray-400 font-medium ml-1 mb-1 block">장소명 / 상세주소</span>
                            <input 
                                type="text" 
                                name="location" 
                                placeholder="예: 콕스타 체육관 2층"
                                value={locationName} 
                                onChange={(e) => setLocationName(e.target.value)} 
                                className="w-full p-3 bg-white rounded-lg border border-gray-200 focus:border-[#00B16A] focus:outline-none text-sm font-medium"
                            />
                        </div>
                    </div>

                    {/* 소개 */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">소개</label>
                        <textarea
                            placeholder="모임에 대해 간단히 소개해주세요."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={3}
                            className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 focus:border-[#00B16A] focus:outline-none resize-none"
                        />
                    </div>

                    {/* 급수 제한 / 인원 제한 */}
                    <div className="flex gap-4">
                        <div className="flex-1">
                            <label className="block text-sm font-bold text-gray-700 mb-1">입장 급수</label>
                            <select
                                value={levelLimit}
                                onChange={(e) => setLevelLimit(e.target.value)}
                                className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 focus:border-[#00B16A] focus:outline-none"
                            >
                                {['N조','S조','A조','B조','C조','D조','E조'].map(l => (
                                    <option key={l} value={l}>{l === 'N조' ? '전체 급수' : `${l} 이상`}</option>
                                ))}
                            </select>
                        </div>
                       <div className="flex-1">
                            <label className="block text-sm font-bold text-gray-700 mb-1">인원 제한</label>
                             <input
                                type="number"
                                value={maxPlayers}
                                // 실시간 Math.max 제한을 제거하여 숫자를 편하게 입력/삭제할 수 있도록 수정
                                onChange={(e) => setMaxPlayers(e.target.value)}
                                min="4"
                                step="1"
                                className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 focus:border-[#00B16A] focus:outline-none"
                            />
                        </div>
                    </div>

                    {/* 비밀번호 */}
                    <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
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
                                className="w-full p-3 mt-2 bg-white rounded-lg border border-gray-200 focus:border-[#00B16A] focus:outline-none text-sm"
                            />
                        )}
                    </div>

                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-4 bg-[#00B16A] text-white font-bold rounded-xl text-base hover:bg-green-700 transition-colors disabled:bg-gray-400 flex items-center justify-center shadow-lg shadow-green-200"
                        >
                            {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : '모임방 만들기'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
// 1. ShareModal 컴포넌트 정의 (GameRoomView 함수 외부 혹은 파일 상단)
function ShareModal({ isOpen, onClose, roomId }) {
    if (!isOpen) return null;
    const shareUrl = `${window.location.origin}?roomId=${roomId}`;

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl p-6 w-full max-w-xs shadow-2xl animate-fade-in-up">
                <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Share2 size={32} className="text-[#00B16A]" />
                    </div>
                    <h3 className="text-lg font-bold text-[#1E1E1E]">경기방 초대</h3>
                    <p className="text-xs text-gray-500 mt-1">링크를 복사해 동호인들에게 전달하세요!</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-xl mb-6 break-all border border-gray-100">
                    <p className="text-xs font-medium text-gray-600 leading-relaxed">{shareUrl}</p>
                </div>
                <div className="space-y-2">
                    <button 
                        onClick={() => {
                            navigator.clipboard.writeText(shareUrl);
                            alert("초대 링크가 복사되었습니다!");
                            onClose();
                        }}
                        className="w-full py-3 bg-[#00B16A] text-white font-bold rounded-xl flex items-center justify-center gap-2"
                    >
                        <Copy size={18} /> 링크 복사하기
                    </button>
                    <button onClick={onClose} className="w-full py-3 text-gray-400 text-sm font-bold">닫기</button>
                </div>
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


// [재수정] SectionHeader 컴포넌트 (HomePage 외부로 이동)
const SectionHeader = ({ title, onMoreClick }) => (
    <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-[#1E1E1E] tracking-tight">{title}</h2>
        <button 
            onClick={onMoreClick} 
            className="text-sm font-medium text-gray-500 hover:text-[#00B16A] flex items-center transition-colors"
        >
            더보기 <ChevronRight size={18} />
        </button>
    </div>
);

// [수정] StoreCard 컴포넌트 (HomePage 외부로 이동)
const StoreCard = ({ image, title, brand }) => (
    <div className="w-40 flex-shrink-0 mr-4">
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

// [수정] GameCard 컴포넌트 (HomePage 외부로 이동)
const GameCard = ({ title, tags, location, current, total, onClick }) => (
    <button 
        onClick={onClick}
        className="w-full p-5 bg-white rounded-xl shadow-md text-left transition-all duration-200 transform hover:scale-[1.02]"
    >
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
                <MapPin size={14} className="mr-1.5" /> {location}
            </span>
            <span className="text-sm font-medium text-[#00B16A] bg-green-100/80 px-2.5 py-1 rounded-full">
                {current} / {total}명
            </span>
        </div>
    </button>
);

// [수정] CommunityPost 컴포넌트 (HomePage 외부로 이동)
const CommunityPost = ({ category, title, likes, onClick }) => (
    <button 
        onClick={onClick}
        className="p-5 bg-white rounded-xl shadow-md flex justify-between items-center w-full transition-all duration-200 hover:shadow-lg"
    >
        <p className="truncate text-base font-medium text-[#1E1E1E] flex-1 mr-4">
            <span className={`font-semibold ${category === 'Q&A' ? 'text-[#00B16A]' : 'text-gray-700'} mr-2`}>
                [{category}]
            </span>
            {title}
        </p>
        <div className="text-xs text-gray-400 whitespace-nowrap flex items-center font-normal transition-colors hover:text-red-500">
            <Heart size={14} className="mr-1" /> {likes}
        </div>
    </button>
);

/**
 * 2. 홈 페이지
 */
function HomePage({ user, setPage }) {

    // [아이디어 #1] 스켈레톤 로딩을 위한 상태
    const [loading, setLoading] = useState(true);

    // 1.5초 후 로딩 상태 해제
    useEffect(() => {
        const timer = setTimeout(() => {
            setLoading(false);
        }, 1500);
        return () => clearTimeout(timer);
    }, []);

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


// ✅ GamePage.jsx 수정: 공유 링크 접속 시 로그인 유도 및 배경 블러
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

    // [신규] 모임방 목록 실시간 구독
    useEffect(() => {
        if (!user || currentView !== 'lobby') {
            // 로비가 아닐 땐 로딩 상태를 false로 두거나 유지
            return;
        }

        setLoadingRooms(true);
        const q = query(roomsCollectionRef); 

        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const roomsData = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // 클라이언트 정렬 (최신순)
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

    // [신규] 검색어 필터링
    const filteredRooms = useMemo(() => {
        return rooms.filter(room => 
            (room.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (room.location || '').toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [rooms, searchTerm]);

    // [신규] 모임 생성
    const handleCreateRoom = async (newRoomData) => {
        if (!user) { onLoginClick(); return; }
        const docRef = await addDoc(roomsCollectionRef, newRoomData);
        handleEnterRoom(docRef.id);
    };

    // [신규] 방 수정 저장 (로비에서)
    const handleUpdateRoom = async (updatedData) => {
        if (!editRoomData) return;
        try {
            const roomRef = doc(db, "rooms", editRoomData.id);
            await updateDoc(roomRef, {
                name: updatedData.name,
                location: updatedData.location,
                address: updatedData.address, // [필수 추가] 주소 필드 누락 수정
                coords: updatedData.coords,   // [필수 추가] 좌표 필드 누락 수정
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

    // [신규] 방 삭제 (로비에서)
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

    // [신규] 수정 버튼 클릭 시
    const onEditClick = (room) => {
        setEditRoomData(room);
        setIsEditModalOpen(true);
    };

   const handleEnterRoom = (roomId) => {
        setSelectedRoomId(roomId);
        setCurrentView('room');
        // [수정] 방 입장 시 브라우저 URL에 roomId 파라미터를 추가하여 새로고침 시에도 유지되도록 함
        const url = new URL(window.location);
        url.searchParams.set('roomId', roomId);
        window.history.pushState({}, '', url);
    };

    const handleExitRoom = () => {
        setSelectedRoomId(null);
        setCurrentView('lobby');
        // [수정] 방에서 나갈 때 URL에서 roomId 파라미터를 제거함
        const url = new URL(window.location);
        url.searchParams.delete('roomId');
        window.history.pushState({}, '', url);
    };
   // 💡 핵심 변경 부분: 로그인이 안 되어 있는데 공유 링크로 온 경우
    if (!user && selectedRoomId) {
        return (
            <div className="relative h-full overflow-hidden">
                {/* 배경: 경기방 화면 (블러 처리) */}
                <div className="filter blur-md pointer-events-none h-full">
                    <GameRoomView roomId={selectedRoomId} user={null} userData={null} preview={true} />
                </div>
                {/* 중앙: 로그인 유도 레이어 */}
                <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/20 backdrop-blur-[2px]">
                    <div className="bg-white p-8 rounded-3xl shadow-2xl text-center max-w-[80%] animate-fade-in-up">
                        <Lock size={48} className="mx-auto text-[#00B16A] mb-4" />
                        <h2 className="text-xl font-bold mb-2">경기방 입장 안내</h2>
                        <p className="text-sm text-gray-500 mb-6">이 경기방에 참여하시려면<br/>로그인이 필요합니다.</p>
                        <button 
                            onClick={onLoginClick}
                            className="w-full py-4 bg-[#00B16A] text-white font-bold rounded-xl shadow-lg shadow-green-200"
                        >
                            로그인하고 입장하기
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // 일반적인 로그인 필요 화면
    if (!user && !selectedRoomId) {
        return <LoginRequiredPage icon={ShieldCheck} title="로그인 필요" description="경기 시스템은 로그인 후 이용 가능합니다." onLoginClick={onLoginClick} />;
    }

    // 경기방 내부 접속
    if (currentView === 'room') {
        return <GameRoomView roomId={selectedRoomId} user={user} userData={userData} onExitRoom={() => { setSelectedRoomId(null); setCurrentView('lobby'); }} roomsCollectionRef={roomsCollectionRef} />;
    }

    // 2-2. 로비 뷰
    return (
        <div className="relative h-full flex flex-col">
            {/* 로비 헤더 */}
            <div className="p-4 bg-white border-b border-gray-200">
                <div className="relative">
                    <input type="text" placeholder="모임방 이름 또는 장소 검색" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full p-3 pl-10 bg-gray-100 rounded-lg text-base border border-gray-200 focus:border-[#00B16A] focus:ring-1 focus:ring-[#00B16A] focus:outline-none" />
                    <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                </div>
            </div>

            {/* 로비 본문 */}
            <main className="flex-grow overflow-y-auto bg-gray-50 p-4 space-y-4 hide-scrollbar">
                {loadingRooms ? (
                    <><SkeletonRoomCard /><SkeletonRoomCard /><SkeletonRoomCard /></>
                ) : filteredRooms.length > 0 ? (
                    filteredRooms.map(room => (
                        <RoomCard 
                            key={room.id} 
                            room={room} 
                            user={user} // [중요] user 정보 전달
                            onEnter={() => handleEnterRoom(room.id)}
                            onEdit={onEditClick} // [중요] 수정 핸들러 전달
                        />
                    ))
                ) : (
                    <EmptyState icon={Archive} title="개설된 모임방이 없습니다" description={searchTerm ? "검색 결과가 없습니다." : "새로운 모임방을 만들어보세요!"} />
                )}
            </main>

            {/* 모임 생성 버튼 */}
            <button onClick={() => setShowCreateRoomModal(true)} className="absolute bottom-6 right-6 bg-[#00B16A] text-white w-14 h-14 rounded-full shadow-lg shadow-green-500/30 flex items-center justify-center transition-transform transform hover:scale-110">
                <Plus size={28} />
            </button>

            {/* 모달들 */}
            <CreateRoomModal isOpen={showCreateRoomModal} onClose={() => setShowCreateRoomModal(false)} onSubmit={handleCreateRoom} user={user} userData={userData} />
            
            {/* [신규] 로비에서 띄우는 수정 모달 */}
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
// [수정] 로비의 모임방 카드 컴포넌트 (관리자 설정 아이콘 추가)
function RoomCard({ room, onEnter, onEdit, user }) {
    const levelColor = room.levelLimit === 'N조' ? 'text-gray-500' : 'text-[#00B16A]';
    
  // [신규] 관리자 권한 체크 (슈퍼 관리자, 방장, 공동 관리자)
    // 이메일 주소뿐만 아니라 복사된 UID로도 관리자 여부를 판별하도록 수정되었습니다.
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
            className="bg-white rounded-xl shadow-lg p-5 cursor-pointer transition-all hover:shadow-xl hover:scale-[1.01] active:scale-95 border border-gray-50 relative group"
            onClick={onEnter}
        >
            <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2 overflow-hidden">
                    <h3 className="text-lg font-bold text-[#1E1E1E] tracking-tight truncate">{room.name}</h3>
                    {room.password && (
                        <Lock size={16} className="text-gray-400 flex-shrink-0" />
                    )}
                </div>
                
                {/* [신규] 관리자용 수정 버튼 (카드 우측 상단) */}
                {isAdmin && (
                    <button 
                        onClick={(e) => {
                            e.stopPropagation(); // 카드 클릭(입장) 방지
                            onEdit(room);
                        }}
                        className="p-2 -mr-2 -mt-2 text-gray-300 hover:text-[#00B16A] hover:bg-green-50 rounded-full transition-colors z-10"
                    >
                        <Edit3Icon size={18} />
                    </button>
                )}
            </div>
            
            <p className="text-sm text-gray-500 mb-4 truncate font-medium">
                <MapPin size={14} className="inline mr-1 -mt-0.5" />
                {room.location}
            </p>

           <div className="flex flex-wrap gap-2 items-center text-xs font-bold">
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
// [신규] 경기 시간 타이머 컴포넌트 (디자인 수정됨)
const CourtTimer = ({ startTime }) => {
    const [time, setTime] = useState('00:00');
    
    useEffect(() => {
        if (startTime) {
            const updateTimer = () => {
                const now = new Date();
                // Firestore Timestamp 또는 ISO String 처리
                const start = startTime.toDate ? startTime.toDate() : new Date(startTime);
                const diff = Math.floor((now - start) / 1000);
                
                if (diff >= 0) {
                    const minutes = String(Math.floor(diff / 60)).padStart(2, '0');
                    const seconds = String(diff % 60).padStart(2, '0');
                    setTime(`${minutes}:${seconds}`);
                }
            };
            
            updateTimer(); // 즉시 실행
            const timerId = setInterval(updateTimer, 1000);
            return () => clearInterval(timerId);
        } else { 
            setTime('00:00'); 
        }
    }, [startTime]);

    return (
        <div className="text-xs font-mono font-bold text-[#00B16A] bg-green-50 px-2 py-0.5 rounded-md">
            {time}
        </div>
    );
};
/**
 * [수정] 플레이어 카드 (드래그 오류 해결 버전)
 */
/**
 * [수정] 플레이어 카드 (클릭/롱프레스 충돌 해결 버전)
 */
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
    // 롱 프레스 타이머 및 상태
    const longPressTimer = useRef(null);
    const isLongPressExecuted = useRef(false); // 롱프레스가 실행되었는지 체크

    // 1. 누르기 시작 (타이머 가동)
    const startPress = () => {
        if (!isAdmin || !onLongPress) return;
        
        isLongPressExecuted.current = false; // 초기화
        longPressTimer.current = setTimeout(() => {
            isLongPressExecuted.current = true; // 실행됨 표시
            onLongPress(player); // 롱프레스 동작 수행
        }, 800); 
    };

    // 2. 떼거나 나감 (타이머 취소)
    const endPress = () => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }
    };

    // 3. 클릭 확정 (롱프레스가 아니었을 때만 실행)
    const handleClick = (e) => {
        // 이미 롱프레스가 실행되었다면 클릭 동작 무시
        if (isLongPressExecuted.current) {
            isLongPressExecuted.current = false; // 다음을 위해 리셋
            return;
        }
        // 일반 클릭 실행
        if (onCardClick) onCardClick(player);
    };

    if (!player) return <div className="h-[52px] bg-gray-100 rounded-lg animate-pulse"></div>;

    const levelColorClass = getLevelColor(player.level);
    const genderBorder = player.gender === '남' ? 'border-l-blue-500' : 'border-l-pink-500';

    // [수정] 높이 h-16 -> h-[52px], 패딩 px-2 py-1, justify-center로 변경하여 여백 축소
    let containerClass = `relative bg-white rounded-lg shadow-sm px-2 py-1 h-[52px] flex flex-col justify-center border-l-[3px] transition-all duration-200 cursor-pointer hover:shadow-md ${genderBorder} select-none `;
    
    if (isPlaying) containerClass += " opacity-50 bg-gray-50 grayscale ";
    if (isResting) containerClass += " opacity-40 bg-gray-100 grayscale ";
    
    if (isSelected) {
        containerClass += " ring-2 ring-[#FFD700] ring-offset-1 transform scale-105 z-10 ";
    } else if (isCurrentUser) {
        containerClass += " ring-1 ring-[#00B16A] ring-offset-1 ";
    }

    const canDrag = isAdmin && typeof onDragStart === 'function';

    return (
        <div
            className={containerClass}
            // [중요] 이벤트 핸들러 정리
            onMouseDown={startPress}
            onMouseUp={endPress}      // 여기서는 클릭 실행 안 함
            onMouseLeave={endPress}   // 마우스 나가면 취소
            onTouchStart={startPress}
            onTouchEnd={endPress}     // 여기서는 클릭 실행 안 함
            onClick={handleClick}     // 클릭은 오직 여기서만 처리
            
            draggable={canDrag}
            onDragStart={canDrag ? (e) => onDragStart(e, player.id) : undefined}
            onDragEnd={canDrag ? onDragEnd : undefined}
            onDragOver={canDrag ? onDragOver : undefined}
            onDrop={canDrag ? (e) => onDrop(e, { type: 'player', player: player }) : undefined}
        >
            {/* [수정] mb-0.5 추가로 이름과 하단 정보 사이 간격 미세 조정 */}
            <div className="flex justify-between items-start pointer-events-none mb-0.5">
                {/* [수정] leading-none 추가로 텍스트 줄간격 축소 */}
                <span className="text-xs font-bold text-[#1E1E1E] truncate w-full pr-1 leading-none">
                    {player.name}
                </span>
                {isAdmin && (
                    <button 
                        className="pointer-events-auto absolute -top-1 -right-1 bg-white text-gray-400 hover:text-red-500 rounded-full shadow-sm border border-gray-100 p-0.5 transition-colors z-20"
                        onClick={(e) => {
                            e.stopPropagation(); // 카드 클릭 방지
                            onDeleteClick && onDeleteClick(player);
                        }}
                    >
                        <XIcon size={10} strokeWidth={3} />
                    </button>
                )}
            </div>
            
            {/* [수정] items-end -> items-center로 변경 */}
            <div className="flex justify-between items-center pointer-events-none">
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
 * [신규] 나간 선수 카드 (붉은색 점선 표시)
 */
const LeftPlayerCard = ({ onClick, isAdmin }) => (
    // [수정] h-16 -> h-[52px]
    <div className="h-[52px] bg-red-50 rounded-lg flex flex-col items-center justify-center border-2 border-dashed border-red-300 relative select-none">
        <span className="text-[10px] font-bold text-red-500 leading-tight">나간 선수</span>
        
        {isAdmin && onClick && (
            <button
                onClick={(e) => { 
                    e.stopPropagation(); 
                    onClick(); 
                }}
                className="absolute -top-1 -right-1 bg-white text-red-500 hover:bg-red-100 rounded-full shadow-sm p-0.5 border border-red-100 transition-colors z-20"
            >
                <XIcon size={10} strokeWidth={3} />
            </button>
        )}
    </div>
);

/**
 * [수정] 빈 슬롯 (디자인 구분감 개선)
 */
const EmptySlot = ({ onSlotClick, onDragOver, onDrop, isDragOver }) => (
    <div 
        onClick={onSlotClick}
        onDragOver={onDragOver} 
        onDrop={onDrop}
        // [수정] h-16 -> h-[52px]
        className={`h-[52px] rounded-lg flex items-center justify-center border-2 border-dashed transition-all cursor-pointer ${
            isDragOver 
            ? 'bg-green-50 border-[#00B16A] text-[#00B16A]' // 드래그 오버 시 강조
            : 'bg-white border-gray-200 text-gray-300 hover:border-gray-400 hover:text-gray-400' // 평소 (흰 배경에 회색 점선)
        }`}
    >
        <Plus size={18} strokeWidth={3} />
    </div>
);
/**
 * [신규] 방 정보 수정 모달 (관리자용)
 * 이전 앱의 RoomModal 기능을 현재 디자인에 맞춰 이식
 */
// [수정] 방 수정 모달 (주소 검색 및 좌표 변환 기능 추가)
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

    // [핵심] 주소 검색 및 좌표 변환 핸들러 (CreateRoomModal과 동일 로직)
    const handleAddressSearch = () => {
        if (!window.daum || !window.daum.Postcode) {
            alert("주소 검색 서비스를 불러오는데 실패했습니다.");
            return;
        }

        new window.daum.Postcode({
            oncomplete: function(data) {
                const addr = data.roadAddress || data.jibunAddress;
                const buildingName = data.buildingName || '';
                
                // 주소와 장소명 업데이트
                setFormData(prev => ({
                    ...prev,
                    address: addr,
                    location: (!prev.location && buildingName) ? buildingName : prev.location // 장소명이 비어있으면 건물명 자동 입력
                }));

               // 좌표 변환 (Geocoder)
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

    // 관리자 배열 관리
    const handleAdminChange = (index, value) => {
        const newAdmins = [...formData.admins];
        newAdmins[index] = value;
        setFormData(prev => ({ ...prev, admins: newAdmins }));
    };
    const addAdminSlot = () => setFormData(prev => ({ ...prev, admins: [...prev.admins, ''] }));
    const removeAdminSlot = (index) => setFormData(prev => ({ ...prev, admins: prev.admins.filter((_, i) => i !== index) }));

    const handleSubmit = () => {
        // 유효성 검사
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
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto animate-fade-in-up">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-[#1E1E1E]">방 정보 수정</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={24}/></button>
                </div>

                <div className="space-y-4">
                    {/* 방 제목 */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">방 제목</label>
                        <input type="text" name="name" value={formData.name} onChange={handleChange} className="w-full p-3 bg-gray-50 rounded-lg border border-gray-200 focus:border-[#00B16A] focus:outline-none"/>
                    </div>

                    {/* [수정] 주소 검색 필드 */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">장소 (주소 검색)</label>
                        <div className="flex gap-2 mb-2">
                            <input
                                type="text"
                                placeholder="터치해서 주소 수정..."
                                value={formData.address}
                                readOnly
                                onClick={handleAddressSearch}
                                className="w-full p-3 bg-gray-50 rounded-lg border border-gray-200 focus:border-[#00B16A] focus:outline-none cursor-pointer text-sm truncate"
                            />
                            <button 
                                type="button"
                                onClick={handleAddressSearch}
                                className="bg-[#1E1E1E] text-white px-4 rounded-lg font-bold text-sm hover:bg-black transition-colors shrink-0"
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
                            className="w-full p-3 bg-white rounded-lg border border-gray-200 focus:border-[#00B16A] focus:outline-none text-sm"
                        />
                        {formData.coords && <p className="text-xs text-[#00B16A] mt-1 ml-1">✅ 위치 좌표 확인됨</p>}
                    </div>

                    {/* 소개 */}
<div>
    <label className="block text-sm font-bold text-gray-700 mb-1">모임 소개</label>
    <textarea name="description" value={formData.description} onChange={handleChange} rows={3} className="w-full p-3 bg-gray-50 rounded-lg border border-gray-200 focus:border-[#00B16A] focus:outline-none"/>
</div>

{/* 인원 및 급수 제한 수정 */}
<div className="flex gap-4">
    <div className="flex-1">
        <label className="block text-sm font-bold text-gray-700 mb-1">입장 급수</label>
        <select
            name="levelLimit"
            value={formData.levelLimit}
            onChange={handleChange}
            className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 focus:border-[#00B16A] focus:outline-none"
        >
            {['N조','S조','A조','B조','C조','D조','E조'].map(l => (
                <option key={l} value={l}>{l === 'N조' ? '전체 급수' : `${l} 이상`}</option>
            ))}
        </select>
    </div>
    <div className="flex-1">
        <label className="block text-sm font-bold text-gray-700 mb-1">최대 인원</label>
        <input
            type="number"
            name="maxPlayers"
            value={formData.maxPlayers}
            onChange={handleChange}
            min="4"
            className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 focus:border-[#00B16A] focus:outline-none"
        />
    </div>
</div>

                    {/* 관리자 관리 */}
                    <div className="bg-gray-50 p-3 rounded-lg">
                        <label className="block text-sm font-bold text-gray-700 mb-2">공동 관리자 (이메일)</label>
                        {formData.admins.map((adminEmail, idx) => (
                            <div key={idx} className="flex gap-2 mb-2">
                                <input 
                                    type="text" 
                                    value={adminEmail} 
                                    onChange={(e) => handleAdminChange(idx, e.target.value)} 
                                    placeholder="user@example.com"
                                    className="flex-1 p-2 bg-white rounded border border-gray-200 text-sm focus:border-[#00B16A] focus:outline-none"
                                />
                                <button onClick={() => removeAdminSlot(idx)} className="text-red-400 hover:text-red-600"><X size={18}/></button>
                            </div>
                        ))}
                        <button onClick={addAdminSlot} className="text-sm text-[#00B16A] font-bold hover:underline">+ 관리자 추가</button>
                    </div>

                    {/* 비밀번호 설정 */}
                    <div className="bg-gray-50 p-3 rounded-lg">
                        <label className="flex items-center gap-2 mb-2">
                            <input type="checkbox" checked={usePassword} onChange={(e) => setUsePassword(e.target.checked)} className="rounded text-[#00B16A] focus:ring-[#00B16A]"/>
                            <span className="text-sm font-bold text-gray-700">비밀번호 사용</span>
                        </label>
                        {usePassword && (
                            <div className="relative">
                                <input type={showPassword ? "text" : "password"} name="password" value={formData.password} onChange={handleChange} className="w-full p-2 bg-white rounded border border-gray-200 text-sm focus:border-[#00B16A] focus:outline-none"/>
                                <button onClick={() => setShowPassword(!showPassword)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">{showPassword ? '숨기기' : '보기'}</button>
                            </div>
                        )}
                    </div>

                    <button onClick={handleSubmit} className="w-full py-3 bg-[#00B16A] text-white font-bold rounded-xl shadow-lg hover:bg-green-600 transition-colors">
                        저장하기
                    </button>
                    
                    {/* 슈퍼 관리자 전용 삭제 버튼 */}
                    {onDelete && ( 
                         <button onClick={onDelete} className="w-full py-3 mt-2 bg-red-100 text-red-500 font-bold rounded-xl hover:bg-red-200 transition-colors">
                            방 삭제 (관리자 전용)
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
/**
 * [신규] 게임 수 수정 모달 (Long Press 시 호출)
 */
function EditGamesModal({ isOpen, onClose, player, onSave }) {
    const [games, setGames] = useState(0);

    useEffect(() => {
        if (isOpen && player) {
            setGames(player.todayGames || 0);
        }
    }, [isOpen, player]);

    if (!isOpen || !player) return null;

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-fade-in-up">
                <div className="text-center mb-6">
                    <h3 className="text-lg font-bold text-[#1E1E1E] mb-1">{player.name}</h3>
                    <p className="text-xs text-gray-400">경기 수 수정 및 히스토리 확인</p>
                </div>
                
                {/* 경기수 수정 영역 */}
                <div className="flex items-center justify-center gap-6 mb-8 bg-gray-50 py-4 rounded-xl">
                    <button 
                        onClick={() => setGames(g => Math.max(0, g - 1))} 
                        className="w-10 h-10 rounded-full bg-white border border-gray-200 text-gray-600 font-bold text-xl hover:bg-gray-100 transition-colors"
                    >
                        -
                    </button>
                    <span className="text-3xl font-black text-[#00B16A] w-12 tabular-nums text-center">{games}</span>
                    <button 
                        onClick={() => setGames(g => g + 1)} 
                        className="w-10 h-10 rounded-full bg-white border border-gray-200 text-[#00B16A] font-bold text-xl hover:bg-gray-100 transition-colors"
                    >
                        +
                    </button>
                </div>

                {/* [신규] 최근 경기 히스토리 영역 */}
                <div className="mb-6">
                    <h4 className="text-xs font-bold text-gray-500 mb-3 text-left pl-1">오늘 함께한 선수들</h4>
                    <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                        {player.matchHistory && player.matchHistory.length > 0 ? (
                            player.matchHistory.map((historyStr, idx) => (
                                <div key={idx} className="bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                                    <div className="flex flex-wrap gap-1">
                                        {historyStr.split(', ').map((name, nIdx) => (
                                            <span 
                                                key={nIdx} 
                                                className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${
                                                    name === player.name 
                                                    ? 'bg-[#00B16A] text-white' 
                                                    : 'bg-white text-gray-600 border border-gray-100'
                                                }`}
                                            >
                                                {name}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-[11px] text-gray-400 py-6 text-center border-2 border-dashed border-gray-50 rounded-xl">
                                아직 경기 기록이 없습니다.
                            </p>
                        )}
                    </div>
                </div>
                
                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 py-3 bg-gray-100 text-gray-500 font-bold rounded-xl text-sm hover:bg-gray-200 transition-colors">취소</button>
                    <button onClick={() => onSave(player.id, games)} className="flex-1 py-3 bg-[#00B16A] text-white font-bold rounded-xl text-sm shadow-lg shadow-green-100 hover:bg-green-600 transition-colors">저장</button>
                </div>
            </div>
        </div>
    );
}
/**
 * [신규] 환경 설정 모달 (관리자용)
 */
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

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-fade-in-up">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-[#1E1E1E]">환경 설정</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><XIcon size={24}/></button>
                </div>

                <div className="space-y-6">
                    {/* 1. 운영 모드 */}
                    <div>
                        <label className="text-sm font-bold text-gray-500 mb-2 block">운영 모드</label>
                        <div className="flex bg-gray-100 rounded-lg p-1">
                            {['admin', 'personal'].map(mode => (
                                <button
                                    key={mode}
                                    onClick={() => setSettings(s => ({ ...s, mode }))}
                                    className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${
                                        settings.mode === mode 
                                        ? 'bg-white text-[#00B16A] shadow-sm' 
                                        : 'text-gray-400'
                                    }`}
                                >
                                    {mode === 'admin' ? '👑 관리자' : '🏃 개인'}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 2. 코트/매치 수 조절 */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-bold text-gray-500 mb-2 block text-center">경기 예정 수</label>
                            <div className="flex items-center justify-center gap-3">
                                <button onClick={() => adjustCount('numScheduledMatches', -1)} className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 font-bold hover:bg-gray-200">-</button>
                                <span className="text-lg font-bold w-4 text-center">{settings.numScheduledMatches}</span>
                                <button onClick={() => adjustCount('numScheduledMatches', 1)} className="w-8 h-8 rounded-full bg-gray-100 text-[#00B16A] font-bold hover:bg-green-100">+</button>
                            </div>
                        </div>
                        <div>
                            <label className="text-sm font-bold text-gray-500 mb-2 block text-center">코트 수</label>
                            <div className="flex items-center justify-center gap-3">
                                <button onClick={() => adjustCount('numInProgressCourts', -1)} className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 font-bold hover:bg-gray-200">-</button>
                                <span className="text-lg font-bold w-4 text-center">{settings.numInProgressCourts}</span>
                                <button onClick={() => adjustCount('numInProgressCourts', 1)} className="w-8 h-8 rounded-full bg-gray-100 text-[#00B16A] font-bold hover:bg-green-100">+</button>
                            </div>
                        </div>
                    </div>

                    {/* 3. 고급 기능 */}
                    <div>
                        <label className="text-sm font-bold text-gray-500 mb-2 block">고급 기능</label>
                        <div className="space-y-2">
                            <button onClick={onReset} className="w-full py-3 bg-red-50 text-red-500 font-bold rounded-xl text-sm hover:bg-red-100 transition-colors flex justify-center items-center gap-2">
                                <ArchiveIcon size={16}/> 시스템 초기화 (경기 삭제)
                            </button>
                            <button onClick={onKickAll} className="w-full py-3 bg-gray-100 text-gray-600 font-bold rounded-xl text-sm hover:bg-gray-200 transition-colors flex justify-center items-center gap-2">
                                <UsersIcon size={16}/> 모든 선수 내보내기
                            </button>
                        </div>
                    </div>

                   <button onClick={handleSave} className="w-full py-4 bg-[#00B16A] text-white font-bold rounded-xl text-lg shadow-lg hover:bg-green-600 transition-colors">
                        설정 저장
                    </button>
                </div>
            </div>
        </div>
    );
}

/**
 * [신규] 프로필 수정 모달 (현재 디자인 적용 + 이전 앱 로직 통합)
 */
function EditProfileModal({ isOpen, onClose, userData, user }) {
    // 폼 상태 관리
    const [formData, setFormData] = useState({
        name: '',
        level: 'N조',
        gender: '남',
        birthYear: '2000',
        region: '서울', // 추가
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });
    
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false); // 비밀번호 보이기 토글

    // 모달 열릴 때 기존 데이터 로드
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

    // 카카오 유저인지 확인 (비밀번호 변경 숨김 처리용)
    const isKakaoUser = userData?.kakaoId || (user?.email && user.email.startsWith('kakao'));

    const handleSave = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            // 1. 비밀번호 변경 로직 (일반 유저만)
            if (!isKakaoUser && formData.newPassword) {
                if (formData.newPassword.length < 6) throw new Error("새 비밀번호는 6자 이상이어야 합니다.");
                if (formData.newPassword !== formData.confirmPassword) throw new Error("새 비밀번호가 일치하지 않습니다.");
                if (!formData.currentPassword) throw new Error("비밀번호를 변경하려면 현재 비밀번호를 입력해주세요.");

                const credential = EmailAuthProvider.credential(user.email, formData.currentPassword);
                await reauthenticateWithCredential(user, credential); // 재인증
                await updatePassword(user, formData.newPassword); // 비밀번호 업데이트
            }

            // 2. Firestore 정보 업데이트
            const userRef = doc(db, "users", user.uid);
            await updateDoc(userRef, {
                name: formData.name,
                level: formData.level,
                gender: formData.gender,
                birthYear: formData.birthYear
            });

            // 3. Auth 프로필 이름 업데이트
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

    // 출생년도 옵션 (1950 ~ 현재)
    const currentYear = new Date().getFullYear();
    const birthYears = Array.from({ length: 70 }, (_, i) => currentYear - i - 10);

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto animate-fade-in-up">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-[#1E1E1E]">프로필 수정</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-black transition-colors">
                        <X size={24} />
                    </button>
                </div>

                {error && <div className="bg-red-50 text-red-500 text-sm p-3 rounded-lg mb-4 text-center font-medium">{error}</div>}

                <form onSubmit={handleSave} className="space-y-4">
                    {/* 이름 */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">이름</label>
                        <input 
                            type="text" name="name" value={formData.name} onChange={handleChange} 
                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-[#00B16A] focus:outline-none transition-colors"
                        />
                    </div>

                    {/* 급수 & 성별 */}
                    <div className="flex gap-3">
                        <div className="flex-1">
                            <label className="block text-sm font-bold text-gray-700 mb-1">급수</label>
                            <select name="level" value={formData.level} onChange={handleChange}
                                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-[#00B16A] focus:outline-none"
                            >
                                {['S조', 'A조', 'B조', 'C조', 'D조', 'E조', 'N조'].map(l => (
                                    <option key={l} value={l}>{l}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex-1">
                            <label className="block text-sm font-bold text-gray-700 mb-1">성별</label>
                            <div className="flex bg-gray-100 p-1 rounded-xl">
                                {['남', '여'].map(g => (
                                    <button
                                        key={g} type="button"
                                        onClick={() => setFormData(prev => ({...prev, gender: g}))}
                                        className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${formData.gender === g ? 'bg-white text-[#00B16A] shadow-sm' : 'text-gray-400'}`}
                                    >
                                        {g}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* 출생년도 */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">출생년도</label>
                        <select name="birthYear" value={formData.birthYear} onChange={handleChange}
                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-[#00B16A] focus:outline-none"
                        >
                            {birthYears.map(year => (
                                <option key={year} value={year}>{year}년생</option>
                            ))}
                        </select>
                    </div>

                    {/* 비밀번호 변경 (카카오 유저가 아닐 때만 표시) */}
                    {!isKakaoUser && (
                        <div className="pt-4 border-t border-gray-100">
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-sm font-bold text-gray-700">비밀번호 변경</label>
                                <button type="button" onClick={() => setShowPassword(!showPassword)} className="text-xs text-gray-400 hover:text-[#00B16A]">
                                    {showPassword ? '숨기기' : '보이기'}
                                </button>
                            </div>
                            <div className="space-y-3 bg-gray-50 p-4 rounded-xl border border-gray-100">
                                <input 
                                    type={showPassword ? "text" : "password"} name="currentPassword" 
                                    placeholder="현재 비밀번호 (변경 시 필수)" 
                                    value={formData.currentPassword} onChange={handleChange}
                                    className="w-full p-3 bg-white border border-gray-200 rounded-lg focus:border-[#00B16A] focus:outline-none text-sm"
                                />
                                <input 
                                    type={showPassword ? "text" : "password"} name="newPassword" 
                                    placeholder="새 비밀번호 (6자 이상)" 
                                    value={formData.newPassword} onChange={handleChange}
                                    className="w-full p-3 bg-white border border-gray-200 rounded-lg focus:border-[#00B16A] focus:outline-none text-sm"
                                />
                                <input 
                                    type={showPassword ? "text" : "password"} name="confirmPassword" 
                                    placeholder="새 비밀번호 확인" 
                                    value={formData.confirmPassword} onChange={handleChange}
                                    className="w-full p-3 bg-white border border-gray-200 rounded-lg focus:border-[#00B16A] focus:outline-none text-sm"
                                />
                            </div>
                        </div>
                    )}

                    <button 
                        type="submit" disabled={loading}
                        className="w-full py-4 bg-[#00B16A] text-white font-bold rounded-xl shadow-lg shadow-green-200 hover:bg-green-700 transition-colors disabled:bg-gray-300 mt-2"
                    >
                        {loading ? <Loader2 className="animate-spin mx-auto"/> : '저장하기'}
                    </button>
                </form>
            </div>
        </div>
    );
}
// [신규] 최초 회원가입 시 프로필 설정 모달
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
            // [수정] 초기 경기수와 리셋 기준 날짜(새벽 2시 기준) 추가
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
            // Firebase Auth 프로필 업데이트
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
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[200] flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl animate-fade-in-up">
                <div className="text-center mb-8">
                    <h2 className="text-3xl font-black text-[#00B16A] mb-2">필수 정보 입력</h2>
                    <p className="text-gray-500 font-medium">콕스타 시작 전, 프로필을 완성해주세요!</p>
                </div>
                <form onSubmit={handleSave} className="space-y-5">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">이름(실명) <span className="text-red-500">*</span></label>
                        <input type="text" placeholder="본명을 입력해주세요" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl focus:border-[#00B16A] outline-none font-bold" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">급수</label>
                            <select value={formData.level} onChange={e => setFormData({...formData, level: e.target.value})} className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none">
                                {['S조', 'A조', 'B조', 'C조', 'D조', 'E조', 'N조'].map(l => <option key={l} value={l}>{l}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">지역</label>
                            <select value={formData.region} onChange={e => setFormData({...formData, region: e.target.value})} className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none">
                                {regions.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">성별</label>
                        <div className="flex bg-gray-100 p-1 rounded-2xl">
                            {['남', '여'].map(g => (
                                <button key={g} type="button" onClick={() => setFormData({...formData, gender: g})} className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${formData.gender === g ? 'bg-white text-[#00B16A] shadow-sm' : 'text-gray-400'}`}>{g}</button>
                            ))}
                        </div>
                    </div>
                    <button type="submit" disabled={loading} className="w-full py-5 bg-[#00B16A] text-white font-black rounded-2xl shadow-lg shadow-green-200 text-lg">
                        {loading ? "저장 중..." : "콕스타 시작하기"}
                    </button>
                </form>
            </div>
        </div>
    );
}
/**
 * [신규] 오류 해결을 위한 코트 선택 모달 정의
 */
/**
 * [신규] 오류 해결을 위한 코트 선택 모달 정의
 */
function CourtSelectionModal({ isOpen, onClose, courts, onSelect }) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-fade-in-up">
                <h3 className="text-xl font-bold text-[#1E1E1E] mb-2 text-center">코트 선택</h3>
                <p className="text-gray-500 text-sm text-center mb-6">경기를 시작할 코트를 선택해주세요.</p>
                <div className="space-y-3">
                    {courts.map((courtIdx) => (
                        <button
                            key={courtIdx}
                            onClick={() => onSelect(courtIdx)}
                            className="w-full py-4 bg-gray-50 hover:bg-[#00B16A] hover:text-white border border-gray-100 hover:border-[#00B16A] rounded-xl text-lg font-bold transition-all duration-200 flex justify-between items-center px-6 group"
                        >
                            <span>🏸 {courtIdx + 1}번 코트</span>
                            <ChevronRightIcon className="text-gray-300 group-hover:text-white" />
                        </button>
                    ))}
                </div>
                <button onClick={onClose} className="mt-6 w-full py-3 text-gray-500 font-bold hover:bg-gray-100 rounded-lg transition-colors">취소</button>
            </div>
        </div>
    );
}
// [신규] 얇은 띠배너 컴포넌트 (자동 슬라이드) - 크기 확대 및 고정 수정됨
function GameBanner() {
    // ... (기존 GameBanner 코드 유지) ...
    return (
        // ... (기존 반환 코드 유지) ...
        <div className="w-full aspect-[5/1] flex-shrink-0 relative overflow-hidden bg-gray-100 border-b border-gray-100 z-0">
             {/* ... (기존 내용 유지) ... */}
        </div>
    );
}

// ===================================================================================
// [신규] 관리자 시뮬레이션 랩 (Test Lab) 모달
// ===================================================================================
function TestLabModal({ isOpen, onClose, onCreateBots, isAutoPlay, setIsAutoPlay }) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-fade-in-up border-2 border-[#00B16A]">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-[#1E1E1E] flex items-center gap-2">
                        <FlaskConical size={24} className="text-[#00B16A]" /> 시뮬레이션 랩
                    </h3>
                    <button onClick={onClose}><X size={24} className="text-gray-400" /></button>
                </div>

                <div className="space-y-6">
                    {/* 1. 봇 생성기 */}
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                        <h4 className="font-bold text-sm text-gray-600 mb-3">🤖 가상 선수(Bot) 투입</h4>
                        <div className="grid grid-cols-2 gap-2">
                            <button onClick={() => onCreateBots(4, '남')} className="py-3 bg-white border border-gray-200 rounded-lg text-sm font-bold shadow-sm hover:border-blue-500 hover:text-blue-500 transition-colors">
                                남성 4명 추가
                            </button>
                            <button onClick={() => onCreateBots(4, '여')} className="py-3 bg-white border border-gray-200 rounded-lg text-sm font-bold shadow-sm hover:border-pink-500 hover:text-pink-500 transition-colors">
                                여성 4명 추가
                            </button>
                        </div>
                        <p className="text-xs text-gray-400 mt-2 text-center">* 대기 명단으로 즉시 투입됩니다.</p>
                    </div>

                    {/* 2. 자동 플레이 */}
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                        <h4 className="font-bold text-sm text-gray-600 mb-3">⚡ 자동 매칭 시뮬레이션</h4>
                        <button 
                            onClick={() => setIsAutoPlay(!isAutoPlay)}
                            className={`w-full py-4 rounded-xl text-lg font-black transition-all shadow-lg flex items-center justify-center gap-2 ${
                                isAutoPlay 
                                ? 'bg-red-500 text-white hover:bg-red-600 ring-2 ring-red-200' 
                                : 'bg-[#1E1E1E] text-white hover:bg-black'
                            }`}
                        >
                            {isAutoPlay ? (
                                <><Loader2 className="animate-spin" /> 시뮬레이션 중지</>
                            ) : (
                                "자동 테스트 시작"
                            )}
                        </button>
                        <p className="text-xs text-gray-400 mt-2 text-center">
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

    // 보안 및 공유 상태
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [inputPassword, setInputPassword] = useState('');
    
    // [수정] 중복 선언 제거하고 하나만 유지
    const [showShareModal, setShowShareModal] = useState(false);

    // 다중 선택 및 모달 상태
    const [selectedPlayerIds, setSelectedPlayerIds] = useState([]); 
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isEditInfoOpen, setIsEditInfoOpen] = useState(false);
    const [editGamePlayer, setEditGamePlayer] = useState(null);
    const [courtModalOpen, setCourtModalOpen] = useState(false);
    const [pendingMatchIndex, setPendingMatchIndex] = useState(null); 
    const [availableCourts, setAvailableCourts] = useState([]);

   // 1. 참조값 및 권한 계산 (Hook은 항상 최상단)
    const roomDocRef = useMemo(() => doc(db, "rooms", roomId), [roomId]);
    const playersCollectionRef = useMemo(() => collection(db, "rooms", roomId, "players"), [roomId]);

   const isAdmin = useMemo(() => {
        if (!roomData || !user) return false;
        
        // 1. 슈퍼 관리자 및 방장(생성자) 확인
        if (isSuperAdmin(user) || user.uid === roomData.adminUid) return true;
        
        // 2. 공동 관리자 목록 확인
        if (!roomData.admins || !Array.isArray(roomData.admins)) return false;
        
        const userEmail = user.email || "";
        const userId = userEmail.split('@')[0]; // 'admin1@cockstar.app' -> 'admin1'
        
        return roomData.admins.some(admin => 
            admin === userEmail ||    // 이메일 전체 일치
            admin === user.uid ||      // UID 일치
            (userId && admin === userId) // 아이디(ID)만 입력했을 경우 일치
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

    // 2. 주요 함수 정의
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

    // 3. 데이터 구독 및 부가 효과 (Effect)
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
                            todayGames: userData.todayGames || 0,
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

           // 2. 관리자 권한 및 자정(12시) 날짜 체크 후 초기화 로직
            if (isAdmin && roomData) {
                const now = new Date();
                // 자정 기준 날짜 문자열 (ISO 형식의 앞 10자리: YYYY-MM-DD)
                const todayStr = now.toISOString().split('T')[0];
                
                if (roomData.lastResetDate !== todayStr) {
                    try {
                        const batch = writeBatch(db);
                        playersArray.forEach(p => {
                            // [수정] 자정에 오늘 경기수와 매치 히스토리만 초기화 (선수 문서는 유지)
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

    // 4. 조건부 렌더링 (Hook 이후에 배치)
    if (loading) return <LoadingSpinner text="입장 중..." />;

    if (roomData?.password && !isAuthorized) {
        return (
            <div className="flex flex-col items-center justify-center h-full bg-white p-8 text-center">
                <Lock size={48} className="text-[#00B16A] mb-4" />
                <h2 className="text-xl font-bold mb-4">비밀번호가 있는 방입니다</h2>
                <input type="password" value={inputPassword} onChange={(e) => setInputPassword(e.target.value)} className="w-full p-4 bg-gray-50 border rounded-xl mb-4 text-center" />
                <button onClick={() => inputPassword === roomData.password ? setIsAuthorized(true) : alert('틀렸습니다.')} className="w-full py-4 bg-[#00B16A] text-white font-bold rounded-xl">입장하기</button>
            </div>
        );
    }

   

// --- Actions ---

    // [신규] 휴식 상태 전환 핸들러 추가
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

// 1. 선수 교체/이동 로직 (충돌 방지 로직 강화)
    const handleSwapPlayers = async (sourcePlayerIds, targetPlayerId, targetMatchIndex, targetSlotIndex) => {
        try {
            await runTransaction(db, async (t) => {
                // 1. 가장 최신 데이터 가져오기 (이 시점부터 DB 잠금 효과)
                const rd = await t.get(roomDocRef);
                if (!rd.exists()) throw "방이 존재하지 않습니다.";
                
                const data = rd.data();
                const schedule = { ...data.scheduledMatches };

                // [충돌 방지 체크 1] 타겟 대상 검증
                if (targetPlayerId) {
                    const currentTarget = schedule[targetMatchIndex]?.[targetSlotIndex];
                    if (currentTarget !== targetPlayerId) {
                        throw "대상이 이미 다른 곳으로 이동했거나 자리가 변경되었습니다. 다시 시도해주세요.";
                    }
                }

                // 2. 소스(선택된) 선수들의 기존 위치 찾아서 지우기
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

                // 3. 타겟 위치 파악
                let finalMatchIdx = targetMatchIndex;
                let finalSlotIdx = targetSlotIndex;

                if (targetPlayerId) {
                    // 타겟 ID가 넘어왔다면 위치를 다시 한 번 확실하게 찾음
                    Object.keys(schedule).forEach(mKey => {
                        const match = schedule[mKey] || [];
                        const idx = match.indexOf(targetPlayerId);
                        if (idx > -1) {
                            finalMatchIdx = parseInt(mKey);
                            finalSlotIdx = idx;
                        }
                    });
                }

                // 4. 이동 실행
                if (finalMatchIdx !== undefined && finalSlotIdx !== undefined) {
                    const playerToMove = sourcePlayerIds[0]; 
                    
                    if (!schedule[finalMatchIdx]) schedule[finalMatchIdx] = Array(PLAYERS_PER_MATCH).fill(null);
                    
                    // [충돌 방지 체크 2] 빈 자리로 이동하려는데, 그 사이 누가 채웠다면?
                    if (!targetPlayerId && schedule[finalMatchIdx][finalSlotIdx] !== null) {
                        throw "이미 다른 관리자가 해당 자리에 선수를 배치했습니다.";
                    }

                    schedule[finalMatchIdx][finalSlotIdx] = playerToMove;
                }

                // 변경사항 저장
                t.update(roomDocRef, { scheduledMatches: schedule });
            });
            
            // 성공 시 선택 해제
            setSelectedPlayerIds([]); 

        } catch (e) {
            console.error("Transaction failed: ", e);
            const msg = typeof e === 'string' ? e : "작업 중 오류가 발생했습니다. (데이터 충돌)";
            alert(`🚫 작업 실패: ${msg}`);
        }
    };

    // 2. 카드 클릭 (선택 또는 스왑 트리거)
    const handleCardClick = (player) => {
        if (!isAdmin) return;

        // A. 이미 선택된 선수를 다시 누르면 선택 해제
        if (selectedPlayerIds.includes(player.id)) {
            setSelectedPlayerIds(prev => prev.filter(id => id !== player.id));
            return;
        }

        // B. 경기장에 있는 선수인지 확인
        const isInGame = Object.values(roomData.scheduledMatches || {}).some(match => match && match.includes(player.id));

        // C. [이동/교체 로직] 이미 선택된 선수가 있는데, '경기장에 있는 다른 선수'를 눌렀다면? -> 교체(스왑) 시도
        if (selectedPlayerIds.length > 0 && isInGame) {
            if (selectedPlayerIds.length === 1) {
                // 위치 정보를 찾아서 넘겨줌 (검증을 위해)
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

        // D. [선택 로직] 대기 중인 선수거나, 아무도 선택 안 된 상태에서 경기장 선수 클릭 -> 선택 목록에 추가 (다중 선택)
        setSelectedPlayerIds(prev => [...prev, player.id]);
    };

// 3. 빈 슬롯 클릭 (이동 트리거 & 충돌 방지)
    const handleSlotClick = async (matchIndex, slotIndex) => {
        if (!isAdmin) return;
        if (selectedPlayerIds.length === 0) return;

        try {
            await runTransaction(db, async (t) => {
                // 1. 최신 데이터 읽기
                const rd = await t.get(roomDocRef);
                if (!rd.exists()) throw "방 정보가 없습니다.";
                
                const data = rd.data();
                const schedule = { ...data.scheduledMatches };

                // [충돌 방지 체크] 내가 클릭한 '그 자리(slotIndex)'가 여전히 비어있는가?
                if (!schedule[matchIndex]) schedule[matchIndex] = Array(PLAYERS_PER_MATCH).fill(null);
                
                // (다중 선택 이동 시, 첫 번째 자리는 무조건 비어있어야 시작함)
                if (schedule[matchIndex][slotIndex] !== null) {
                     throw "방금 다른 관리자가 이 자리에 선수를 배치했습니다.";
                }

                // 2. 선택된 선수들 기존 자리에서 제거
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

                // 3. 새로운 자리에 채워넣기
                let currentSlot = slotIndex;
                let placedCount = 0;

                selectedPlayerIds.forEach(srcId => {
                    // 빈 자리를 찾아서 넣음
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
            
            setSelectedPlayerIds([]); // 성공 시만 선택 해제

        } catch (e) {
            console.error("Transaction failed: ", e);
            const msg = typeof e === 'string' ? e : "동시 작업 충돌이 발생했습니다. 다시 시도해주세요.";
            alert(`🚫 배치 실패: ${msg}`);
        }
    };
    // [신규] 스케줄에서 특정 슬롯 비우기 (나간 선수 제거용)
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
                // 이미 데이터가 바뀌었는지 확인 (동시 작업 체크)
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
// [신규] 방 정보 수정 저장 핸들러
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

    // [신규] 방 삭제 핸들러
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
        
        const batch = writeBatch(db);
        Object.keys(players).forEach(pid => {
            batch.delete(doc(playersCollectionRef, pid));
        });
        
        // 코트도 모두 비움
        const emptyCourts = Array(roomData.numInProgressCourts).fill(null);
        
        await batch.commit();
        await updateDoc(roomDocRef, { 
            inProgressCourts: emptyCourts,
            scheduledMatches: {} // 배정된 경기도 함께 초기화 권장
        });
    };

   // [해결] 보안 권한 문제를 피하기 위해 관리자는 현재 방의 선수 정보만 수정합니다.
  const handleSaveGames = async (playerId, newCount) => {
        try {
            const roomPlayerRef = doc(playersCollectionRef, playerId);
            
            // 전역 프로필(users) 대신 현재 경기방의 선수 문서만 업데이트합니다.
            await updateDoc(roomPlayerRef, { 
                todayGames: newCount 
            });
            
            setEditGamePlayer(null);
        } catch (e) {
            console.error("게임 수 수정 실패:", e);
            alert("수정 실패: " + e.message);
        }
    };

    // ===========================================================================
    // [신규] 시뮬레이션 랩 로직 (Simulation Logic)
    // ===========================================================================
    const [isTestLabOpen, setIsTestLabOpen] = useState(false); // 모달 열기/닫기
    const [isAutoPlay, setIsAutoPlay] = useState(false);       // 자동 플레이 ON/OFF

    // 1. 봇 생성 함수
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
                    isBot: true, // 봇임을 표시
                    entryTime: serverTimestamp(),
                    todayGames: 0,
                    isResting: false
                });
            }
            await batch.commit();
        } catch (e) {
            console.error("봇 생성 실패:", e);
            alert("봇 생성 오류");
        }
    };

    // 2. 자동 플레이 엔진 (1.5초마다 실행)
    useEffect(() => {
        if (!isAutoPlay || !isAdmin || !roomData) return;

        const simulationInterval = setInterval(() => {
            const emptyCourts = [];
            (roomData.inProgressCourts || []).forEach((c, i) => { if(!c) emptyCourts.push(i); });
            const occupiedCourts = [];
            (roomData.inProgressCourts || []).forEach((c, i) => { if(c) occupiedCourts.push(i); });

            // 행동 1: 30% 확률로 진행 중인 경기 종료 (코트 비우기)
            if (occupiedCourts.length > 0 && Math.random() < 0.3) {
                const targetCourt = occupiedCourts[Math.floor(Math.random() * occupiedCourts.length)];
                handleEndMatch(targetCourt);
                return; // 이번 턴 종료
            }

            // 행동 2: 50% 확률로 꽉 찬 대기열 경기 시작 (코트 채우기)
            const fullMatches = [];
            Object.entries(roomData.scheduledMatches || {}).forEach(([mIdx, players]) => {
                if (players && players.filter(Boolean).length === 4) fullMatches.push(parseInt(mIdx));
            });

            if (fullMatches.length > 0 && emptyCourts.length > 0 && Math.random() < 0.5) {
                const targetMatch = fullMatches[0]; // 첫 번째 꽉 찬 매치 실행
                processStartMatch(targetMatch, emptyCourts[0]);
                return; // 이번 턴 종료
            }

            // 행동 3: 빈 자리에 대기 중인 선수 채워넣기 (항상 시도)
            if (waitingPlayers.length > 0) {
                // 스케줄 중 빈 자리가 있는지 탐색
                let targetMatchIdx = -1;
                let targetSlotIdx = -1;

                // 0번 매치부터 순서대로 빈 자리 찾기
                for (let m = 0; m < roomData.numScheduledMatches; m++) {
                    const match = roomData.scheduledMatches?.[m] || [null,null,null,null];
                    const emptyIdx = match.indexOf(null); // 빈 자리 인덱스
                    
                    if (emptyIdx !== -1 && match.length >= 4) {
                        targetMatchIdx = m;
                        targetSlotIdx = emptyIdx;
                        break;
                    } else if (match.length < 4) {
                         // 배열이 덜 만들어진 경우 (초기 상태)
                         targetMatchIdx = m;
                         targetSlotIdx = match.length;
                         break;
                    }
                }

                if (targetMatchIdx !== -1 && targetSlotIdx !== -1) {
                    // 대기 선수 1명을 그 자리로 이동
                    const playerToMove = waitingPlayers[0];
                    handleSwapPlayers([playerToMove.id], null, targetMatchIdx, targetSlotIdx);
                }
            }

        }, 1500); // 1.5초마다 행동

        return () => clearInterval(simulationInterval);
    }, [isAutoPlay, roomData, waitingPlayers, isAdmin]);

   

    // --- Render ---
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
            if (!rd.exists()) throw "방이 존재하지 않습니다.";
            const data = rd.data();
            
            const schedule = { ...data.scheduledMatches };
            const matchPlayers = schedule[matchIdx];
            const currentCourts = [...(data.inProgressCourts || [])];

            // 1. 검증: 해당 코트가 그 사이 찼는지 확인
            if (currentCourts[courtIdx] !== null) {
                throw "이미 다른 관리자가 해당 코트에서 경기를 시작했습니다.";
            }

            // 2. 검증: 해당 매치 순번의 데이터가 여전히 존재하는지 확인
            if (!matchPlayers || matchPlayers.filter(Boolean).length < 4) {
                throw "경기 인원이 변경되었거나 이미 시작된 경기입니다.";
            }

            // 3. 코트 데이터 업데이트
            currentCourts[courtIdx] = { 
                players: matchPlayers, 
                startTime: new Date().toISOString() 
            };

            // 4. 스케줄에서 해당 매치 삭제 및 인덱스 재정렬 (데이터 유실 방지)
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
        
        try {
            const batch = writeBatch(db);
            
            // [수정] 에러 방지를 위해 4명의 이름을 쉼표로 구분된 하나의 문자열로 합침
            const matchMembersString = court.players
                .map(pid => players[pid]?.name || '알 수 없음')
                .join(', ');

            court.players.forEach(pid => {
                if (players[pid]) {
                    const roomPlayerRef = doc(playersCollectionRef, pid);
                    // [수정] 오늘 경기수 증가 및 매치 히스토리에 문자열 추가 (최근 10개 유지)
                    batch.update(roomPlayerRef, { 
                        todayGames: (players[pid].todayGames || 0) + 1,
                        matchHistory: [matchMembersString, ...(players[pid].matchHistory || [])].slice(0, 10)
                    });
                }
            });
            
            const newCourts = [...roomData.inProgressCourts];
            newCourts[courtIdx] = null;
            
            await batch.commit(); 
            await updateDoc(roomDocRef, { inProgressCourts: newCourts }); 
        } catch (e) {
            console.error("경기 종료 오류:", e);
            alert("권한이 없거나 오류가 발생했습니다.");
        }
    };
    // --- Render ---
    if (loading) return <LoadingSpinner text="입장 중..." />;
    if (error) return <div className="p-10 text-center">{error}</div>;

    return (
        <div className="flex flex-col h-full bg-slate-100">
            {/* [수정] 모바일 최적화 헤더 */}
            <header className="flex-shrink-0 h-14 px-3 flex items-center justify-between bg-white/95 backdrop-blur-sm shadow-sm sticky top-0 z-30 border-b border-gray-100">
                {/* 좌측: 뒤로가기 + 방 정보 */}
                <div className="flex items-center gap-2 overflow-hidden flex-1 mr-2">
                   <button 
    onClick={() => {
        if (confirm("방을 나가시겠습니까?")) {
            onExitRoom(); // useEffect cleanup에서 실제 삭제와 인원수 감소가 처리됩니다.
        }
    }} 
    className="p-2 -ml-2 text-gray-400 hover:text-[#1E1E1E] transition-colors"
>
    <ArrowLeft size={22}/>
</button>
                    
                    <div className="flex flex-col overflow-hidden justify-center">
                        <div className="flex items-center gap-1">
                            <h1 className="text-base font-bold text-[#1E1E1E] truncate leading-tight">
                                {roomData?.name}
                            </h1>
                            {isAdmin && (
                                <button onClick={() => setIsEditInfoOpen(true)} className="text-gray-300 hover:text-[#00B16A] p-0.5">
                                    <Edit3 size={14} />
                                </button>
                            )}
                        </div>
                        <div className="flex items-center text-[11px] text-gray-400 font-medium leading-none mt-0.5 space-x-1.5 truncate">
                            <span className="truncate max-w-[100px]">{roomData?.location}</span>
                            <span className="w-0.5 h-2 bg-gray-300 rounded-full"></span>
                            <span className="flex items-center gap-1 px-2.5 py-1.5 bg-gray-100 rounded-lg text-gray-600">
                                <Users size={14} />
                                {roomData?.playerCount || 0} / {roomData?.maxPlayers}
                            </span>
                            <span className="w-0.5 h-2 bg-gray-300 rounded-full"></span>
                            <span className={isAdmin ? "text-[#00B16A]" : "text-gray-400"}>
                                {isAdmin ? '관리자' : '개인'}
                            </span>
                        </div>
                   </div>
                </div>

                {/* Share2 아이콘 버튼을 대기/휴식 버튼 왼쪽에 추가합니다. */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                    {/* 공유 버튼 추가 */}
    <button 
        onClick={handleShare}
        className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-[#00B16A] hover:bg-green-50 transition-all"
        title="경기방 공유"
    >
        <Share2 size={20} />
    </button>

    <button 
        onClick={handleToggleRest}
        className={`h-8 px-3 rounded-full text-xs font-bold transition-all flex items-center justify-center border ${
            players[user.uid]?.isResting
            ? 'bg-gray-50 text-gray-400 border-gray-200' 
            : 'bg-white text-[#00B16A] border-[#00B16A] shadow-sm' 
        }`}
    >
        {players[user.uid]?.isResting ? '복귀' : '휴식'}
    </button>

                    {/* [신규] 관리자 전용 테스트 랩 버튼 */}
                    {isAdmin && (
                        <div className="flex gap-1.5">
                            <button 
                                onClick={() => setIsTestLabOpen(true)}
                                className={`w-8 h-8 flex items-center justify-center rounded-full transition-all ${isAutoPlay ? 'bg-red-100 text-red-500 animate-pulse' : 'text-gray-400 hover:text-[#00B16A] hover:bg-green-50'}`}
                                title="시뮬레이션 랩"
                            >
                                <FlaskConical size={20} />
                            </button>
                            <button 
                                onClick={() => setIsSettingsOpen(true)}
                                className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-[#1E1E1E] hover:bg-gray-100 transition-all"
                            >
                                <GripVertical size={20} />
                            </button>
                        </div>
                    )}
                </div>
            </header>

            {/* [추가] 광고 배너 (헤더와 탭 사이) */}
            <GameBanner />

            {/* 탭 (흰색 배경) */}
            <div className="flex bg-white border-b border-gray-200">
                <button onClick={() => setActiveTab('matching')} className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'matching' ? 'border-[#00B16A] text-[#00B16A]' : 'border-transparent text-gray-400'}`}>매칭 대기</button>
                <button onClick={() => setActiveTab('inProgress')} className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'inProgress' ? 'border-[#00B16A] text-[#00B16A]' : 'border-transparent text-gray-400'}`}>경기 진행</button>
            </div>

            {/* 메인 컨텐츠 (회색 배경 위 컨텐츠 배치) */}
            <main className="flex-grow overflow-y-auto p-4 space-y-6 pb-24">
                {activeTab === 'matching' ? (
                    <>
                        {/* 1. 대기 명단 섹션 (흰색 박스로 감싸서 구분감 줌) */}
                        <section className="bg-white rounded-2xl shadow-sm p-4 border border-gray-100">
                            <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-2">
                                <h2 className="text-sm font-extrabold text-gray-800 flex items-center gap-2">
                                    <Users size={16} className="text-[#00B16A]"/>
                                    대기 명단
                                </h2>
                                <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2 py-0.5 rounded-full">
                                    {waitingPlayers.length}명
                                </span>
                            </div>
                            
                            {/* 남자 대기 */}
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

                            {/* 구분선 (여성 회원이 있을 때만) */}
                            {maleWaiting.length > 0 && femaleWaiting.length > 0 && (
                                <div className="my-4 relative">
                                    <div className="absolute inset-0 flex items-center">
                                        <div className="w-full border-t border-dashed border-gray-200"></div>
                                    </div>
                                    <div className="relative flex justify-center">
                                        <span className="bg-white px-2 text-[10px] text-gray-400 font-medium">여성 회원</span>
                                    </div>
                                </div>
                            )}

                            {/* 여자 대기 */}
                            <div className="grid grid-cols-4 gap-2">
                                {femaleWaiting.map(p => (
                                    <PlayerCard 
                                        key={p.id} player={p} isAdmin={isAdmin} isCurrentUser={user.uid === p.id}
                                        isSelected={selectedPlayerIds.includes(p.id)}
                                        onCardClick={handleCardClick}
                                        onDeleteClick={handleKickPlayer}
                                        onLongPress={(p) => setEditGamePlayer(p)}
                                    />
                                ))}
                            </div>

                            {waitingPlayers.length === 0 && (
                                <div className="text-center py-8">
                                    <p className="text-sm text-gray-400 font-medium">대기 중인 선수가 없습니다.</p>
                                    <p className="text-xs text-gray-300 mt-1">새로운 선수를 기다리는 중...</p>
                                </div>
                            )}
                        </section>

                        {/* 2. 경기 예정 테이블 (각 매치마다 흰색 카드로 분리) */}
                        <section className="space-y-3">
                            <h2 className="text-sm font-extrabold text-gray-500 ml-1">경기 배정 (Schedule)</h2>
                            {Array.from({ length: roomData.numScheduledMatches }).map((_, mIdx) => {
                                const match = roomData.scheduledMatches?.[mIdx] || Array(PLAYERS_PER_MATCH).fill(null);
                                const fullCount = match.filter(Boolean).length;
                                return (
                                    <div key={mIdx} className="bg-white rounded-2xl p-3 shadow-sm border border-gray-200 flex flex-col gap-2">
                                        {/* 매치 헤더 */}
                                        <div className="flex justify-between items-center px-1">
                                            <div className="flex items-center gap-2">
                                                <span className="bg-gray-100 text-gray-500 text-xs font-bold px-2 py-1 rounded">MATCH {mIdx + 1}</span>
                                            </div>
                                            <button 
                                                onClick={() => handleStartClick(mIdx)}
                                                disabled={fullCount < PLAYERS_PER_MATCH}
                                                className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold transition-all ${
                                                    fullCount === PLAYERS_PER_MATCH 
                                                    ? 'bg-[#00B16A] text-white shadow-md hover:bg-green-600' 
                                                    : 'bg-gray-100 text-gray-300 cursor-not-allowed'
                                                }`}
                                            >
                                                경기 시작 <ChevronRightIcon size={14} />
                                            </button>
                                        </div>

                                        {/* 선수 슬롯 */}
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
                    /* 경기 진행 탭 (그리드 레이아웃 적용) */
                    <div className="grid grid-cols-1 gap-4">
                        {Array.from({ length: roomData.numInProgressCourts }).map((_, cIdx) => {
                            const court = roomData.inProgressCourts?.[cIdx];
                            const isOccupied = !!court;
                            return (
                                <div key={cIdx} className={`rounded-2xl border transition-all ${isOccupied ? 'bg-white border-[#00B16A] shadow-md' : 'bg-white border-dashed border-gray-300'}`}>
                                    <div className={`px-4 py-3 flex justify-between items-center border-b ${isOccupied ? 'bg-green-50/50 border-green-100' : 'border-gray-100'}`}>
                                        <span className={`font-black text-sm ${isOccupied ? 'text-[#00B16A]' : 'text-gray-400'}`}>COURT {cIdx + 1}</span>
                                        {isOccupied ? (
                                            <div className="flex items-center gap-2">
                                                <CourtTimer startTime={court.startTime} />
                                                {isAdmin && (
                                                    <button onClick={() => handleEndMatch(cIdx)} className="bg-white border border-red-200 text-red-500 text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-red-50 shadow-sm">
                                                        경기 종료
                                                    </button>
                                                )}
                                            </div>
                                        ) : <span className="text-xs text-gray-400 font-medium">대기 중</span>}
                                    </div>
                                    <div className="p-3 grid grid-cols-4 gap-2">
                                        {isOccupied ? court.players.map((pid, idx) => {
                                            if (pid && players[pid]) {
                                                return <PlayerCard key={pid} player={players[pid]} isPlaying={true} isAdmin={isAdmin} onLongPress={(p) => setEditGamePlayer(p)} />;
                                            } else if (pid && !players[pid]) {
                                                return <LeftPlayerCard key={`left-court-${cIdx}-${idx}`} isAdmin={false} />;
                                            } else {
                                                return <div key={`empty-${cIdx}-${idx}`} className="h-16 bg-gray-50 rounded-lg border border-gray-100"/>;
                                            }
                                        }) : (
                                            <div className="col-span-4 h-16 flex items-center justify-center text-gray-300 gap-2">
                                                <TrophyIcon size={20} />
                                                <span className="text-sm font-medium">경기가 없습니다</span>
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

            {/* 게임 수 수정 모달 */}
            <EditGamesModal 
                isOpen={!!editGamePlayer}
                onClose={() => setEditGamePlayer(null)}
                player={editGamePlayer}
                onSave={handleSaveGames}
            />
            
           {/* 방 정보 수정 모달 */}
             <EditRoomInfoModal 
                isOpen={isEditInfoOpen}
                onClose={() => setIsEditInfoOpen(false)}
                roomData={roomData}
                onSave={handleRoomInfoSave}
                onDelete={handleRoomDelete}
            />

            {/* [신규] 테스트 랩 모달 연결 */}
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

// [디자인 리뉴얼] 네이버 지도 스타일의 UI + 콕스타 브랜딩 적용
// [수정 완료] 검색 기능 연결 + 지도 마커 표시 오류 해결 (Markers State 관리)
function KokMapPage() {
    const mapRef = useRef(null);
    const mapInstance = useRef(null);
    
    // 데이터 및 지도 상태
    const [rooms, setRooms] = useState([]);
    const [isMapReady, setIsMapReady] = useState(false); // [핵심] 지도가 준비되었는지 확인하는 상태
    // [수정] 마커와 라벨(오버레이)을 함께 관리하기 위해 상태 구조 변경
    const [mapObjects, setMapObjects] = useState([]); // { marker, overlay } 객체 배열

    // UI 상태
    const [selectedRoom, setSelectedRoom] = useState(null);
    const [activeFilter, setActiveFilter] = useState('전체');
    const [searchText, setSearchText] = useState('');

    // [신규] 카카오 서비스 객체 (검색용)
    const ps = useRef(null); // 장소 검색 객체
    const geocoder = useRef(null); // 주소 검색 객체

    // 1. Firestore 데이터 구독 (기존 동일)
    useEffect(() => {
        const q = query(collection(db, "rooms"));
        // ... (기존 코드 유지)
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setRooms(data);
        });
        return () => unsubscribe();
    }, []);

    // 2. 지도 초기화 및 서비스 객체 생성
    useEffect(() => {
        const container = mapRef.current;
        if (!container) return;

        // 지도 스타일 강제 주입 (라벨용 CSS 추가)
        if (!document.getElementById('kakao-map-style')) {
            const style = document.createElement('style');
            style.id = 'kakao-map-style';
            style.innerHTML = `
                #kakao-map img { max-width: none !important; height: auto !important; border: 0 !important; }
                #kakao-map div { border: 0 !important; }
                .custom-overlay { pointer-events: none; } 
                /* [신규] 모임방 이름표 스타일 */
                .room-label {
                    padding: 4px 8px;
                    background-color: white;
                    border: 1px solid #00B16A;
                    border-radius: 12px;
                    font-size: 11px;
                    font-weight: bold;
                    color: #1E1E1E;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                    transform: translateY(-45px); /* 마커 위로 올림 */
                    white-space: nowrap;
                    position: relative;
                }
                .room-label::after {
                    content: '';
                    position: absolute;
                    bottom: -4px;
                    left: 50%;
                    transform: translateX(-50%);
                    border-width: 4px 4px 0;
                    border-style: solid;
                    border-color: #00B16A transparent transparent transparent;
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
                    
                    // [신규] 검색 객체 초기화
                    ps.current = new window.kakao.maps.services.Places();
                    geocoder.current = new window.kakao.maps.services.Geocoder();

                    // 클릭 시 선택 해제
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

    // [신규] 실제 지도 검색 및 이동 함수 (네이버 지도 스타일)
    const handleMapSearch = () => {
        if (!searchText.trim() || !mapInstance.current || !window.kakao) return;
        const map = mapInstance.current;

        // 1. 주소로 검색 시도
        geocoder.current.addressSearch(searchText, (result, status) => {
            if (status === window.kakao.maps.services.Status.OK) {
                const coords = new window.kakao.maps.LatLng(result[0].y, result[0].x);
                map.panTo(coords); // 해당 위치로 지도 이동
                // map.setLevel(3); // 줌 레벨 조정 (선택 사항)
            } else {
                // 2. 주소 검색 실패 시 -> 키워드(장소명) 검색 시도
                ps.current.keywordSearch(searchText, (data, status) => {
                    if (status === window.kakao.maps.services.Status.OK) {
                        const coords = new window.kakao.maps.LatLng(data[0].y, data[0].x);
                        map.panTo(coords); // 첫 번째 검색 결과로 이동
                    } else {
                        alert('검색 결과가 없습니다. 정확한 주소나 장소명을 입력해주세요.');
                    }
                });
            }
        });
    };

    // [신규] 엔터키 처리
    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleMapSearch();
        }
    };

    // 3. 마커 및 라벨 렌더링 (방 목록 변경 시)
    useEffect(() => {
        if (!isMapReady || !mapInstance.current || !window.kakao) return;
        const map = mapInstance.current;

        // 기존 마커와 오버레이 모두 제거
        mapObjects.forEach(obj => {
            obj.marker.setMap(null);
            obj.overlay.setMap(null);
        });
        const newMapObjects = [];

        // 필터링: 여기서는 '카테고리'만 필터링하고, 검색어는 '지도 이동' 용도로 사용
        // (즉, 검색어가 있어도 방은 사라지지 않고 지도만 이동함 -> 네이버 지도 방식)
        const filteredRooms = rooms.filter(r => {
            return activeFilter === '전체' 
                ? true 
                : (r.name?.includes(activeFilter) || r.description?.includes(activeFilter));
        });

        filteredRooms.forEach(room => {
            if (room.coords?.lat && room.coords?.lng) {
                const markerPosition = new window.kakao.maps.LatLng(room.coords.lat, room.coords.lng);
                
                // 1. 마커 생성
                const marker = new window.kakao.maps.Marker({
                    position: markerPosition,
                    map: map,
                    clickable: true
                });

                // 2. [신규] 커스텀 오버레이(이름표) 생성
                const content = `<div class="room-label">${room.name}</div>`;
                const overlay = new window.kakao.maps.CustomOverlay({
                    position: markerPosition,
                    content: content,
                    map: map, // 지도에 표시
                    yAnchor: 1 // 위치 조정은 CSS로 처리함
                });

                // 클릭 이벤트
                window.kakao.maps.event.addListener(marker, 'click', () => {
                    map.panTo(markerPosition);
                    setSelectedRoom(room);
                });

                newMapObjects.push({ marker, overlay });
            }
        });

        setMapObjects(newMapObjects);

    // [중요] searchText는 의존성에서 제거하여, 타이핑 할 때마다 핀이 사라지지 않게 함
    }, [rooms, isMapReady, activeFilter]);

    // 내 위치 찾기
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
            <div className="absolute top-0 left-0 right-0 z-20 px-4 pt-4 pb-2 bg-gradient-to-b from-white/10 to-transparent pointer-events-none">
                <div className="pointer-events-auto bg-white rounded-lg shadow-md flex items-center p-3 border border-gray-100 transition-all active:scale-[0.99]">
                    <button className="p-1 mr-2 text-[#1E1E1E]">
                        <GripVertical size={22} />
                    </button>
                    
                   <input 
                        type="text" 
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        onKeyDown={handleKeyDown} // [추가] 엔터키 이벤트 연결
                        placeholder="장소, 주소, 모임명 검색" 
                        className="flex-1 bg-transparent outline-none text-base font-medium text-[#1E1E1E] placeholder-gray-400"
                    />
                    
                    {searchText ? (
                        <button onClick={() => setSearchText('')} className="p-1 text-gray-400 hover:text-gray-600">
                            <X size={20} />
                        </button>
                    ) : null}
                    
                    {/* [수정] 돋보기 버튼 클릭 시 검색 함수 실행 */}
                    <button onClick={handleMapSearch} className="p-1 text-[#00B16A] ml-1">
                        <Search size={24} />
                    </button>
                </div>
            </div>

            {/* 가로 스크롤 필터 칩 */}
            <div className="absolute top-[72px] left-0 right-0 z-20 overflow-x-auto hide-scrollbar px-4 pb-2 flex gap-2 pointer-events-auto">
                {['전체', '배드민턴장', '모임', '레슨', '샵'].map((filter) => {
                    const isActive = activeFilter === filter;
                    return (
                        <button 
                            key={filter} 
                            onClick={() => setActiveFilter(filter)}
                            className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-sm font-bold border shadow-sm transition-all whitespace-nowrap ${
                                isActive 
                                ? 'bg-[#00B16A] text-white border-[#00B16A]'
                                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                            }`}
                        >
                            {filter}
                        </button>
                    );
                })}
            </div>

            {/* 지도 영역 */}
            <div 
                id="kakao-map" 
                ref={mapRef} 
                className="flex-grow w-full h-full bg-[#e5e3df] z-0"
            />

            {/* 우측 유틸리티 버튼 */}
            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-2.5 z-20">
                <div className="bg-white rounded shadow-md border border-gray-100 flex flex-col overflow-hidden">
                    <button onClick={zoomIn} className="p-2.5 text-gray-500 hover:text-[#1E1E1E] hover:bg-gray-50 active:bg-gray-100 border-b border-gray-100">
                        <Plus size={20} />
                    </button>
                    <button onClick={zoomOut} className="p-2.5 text-gray-500 hover:text-[#1E1E1E] hover:bg-gray-50 active:bg-gray-100">
                        <span className="block w-5 h-[2px] bg-current my-[9px]"></span>
                    </button>
                </div>
                <button 
                    onClick={handleMyLoc}
                    className="bg-white p-2.5 rounded-full shadow-md border border-gray-100 text-[#1E1E1E] hover:text-[#00B16A] active:scale-95 transition-all"
                >
                    <MapPin size={22} />
                </button>
            </div>

            {/* 하단 정보 시트 */}
            {selectedRoom && (
                <div className="absolute bottom-0 left-0 right-0 z-30 bg-white rounded-t-2xl shadow-[0_-5px_20px_rgba(0,0,0,0.1)] animate-slide-up pb-safe">
                    <div className="w-full h-6 flex items-center justify-center" onClick={() => setSelectedRoom(null)}>
                        <div className="w-10 h-1.5 bg-gray-200 rounded-full cursor-pointer hover:bg-gray-300 transition-colors"></div>
                    </div>

                    <div className="px-5 pb-6">
                        <div className="flex justify-between items-start mb-1">
                            <div>
                                <h3 className="text-xl font-bold text-[#1E1E1E] leading-tight mb-1">
                                    {selectedRoom.name}
                                </h3>
                                <div className="text-sm text-gray-500 flex items-center gap-1">
                                    <span className="text-gray-400">장소</span>
                                    <span className="w-0.5 h-2.5 bg-gray-200"></span>
                                    {/* 상세주소가 있으면 상세주소, 없으면 장소명 표시 */}
                                    <span className="truncate max-w-[200px]">{selectedRoom.address || selectedRoom.location}</span>
                                </div>
                            </div>
                            <button onClick={() => setSelectedRoom(null)} className="p-1 text-gray-300 hover:text-gray-500">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex items-center gap-2 mb-4 text-sm">
                            <span className="font-bold text-[#00B16A]">영업 중</span>
                            <span className="text-gray-300">|</span>
                            <span className="text-gray-600">현재 {selectedRoom.playerCount || 0}명 참여 중</span>
                        </div>

                        <div className="grid grid-cols-3 gap-3 mb-4">
                             <a 
                                href={`https://map.kakao.com/link/to/${selectedRoom.name},${selectedRoom.coords.lat},${selectedRoom.coords.lng}`}
                                target="_blank"
                                rel="noreferrer"
                                className="flex flex-col items-center justify-center gap-1 py-3 bg-[#e8fcf3] rounded-lg active:scale-95 transition-transform"
                            >
                                <MapPin size={20} className="text-[#00B16A]" fill="#00B16A" fillOpacity={0.2} />
                                <span className="text-xs font-bold text-[#00B16A]">길찾기</span>
                            </a>
                            
                            <a 
                                href={`https://map.naver.com/v5/?c=${selectedRoom.coords.lat},${selectedRoom.coords.lng},15,0,0,0,dh`} 
                                target="_blank"
                                rel="noreferrer"
                                className="flex flex-col items-center justify-center gap-1 py-3 bg-gray-50 rounded-lg active:scale-95 transition-transform"
                            >
                                <span className="font-bold text-base text-[#03C75A]">N</span>
                                <span className="text-xs font-bold text-gray-600">네이버</span>
                            </a>

                            <button 
                                onClick={() => {
                                    navigator.clipboard.writeText(`${selectedRoom.name}\n${selectedRoom.address || selectedRoom.location}`);
                                    alert('주소가 복사되었습니다.');
                                }}
                                className="flex flex-col items-center justify-center gap-1 py-3 bg-gray-50 rounded-lg active:scale-95 transition-transform"
                            >
                                <Bell size={20} className="text-gray-600" />
                                <span className="text-xs font-bold text-gray-600">공유</span>
                            </button>
                        </div>

                        <button 
                            onClick={() => alert('경기방 입장 기능은 경기 탭에서 이용해주세요.')}
                            className="w-full py-3.5 bg-[#00B16A] text-white font-bold rounded-xl text-base shadow-lg shadow-green-100 active:bg-green-700 transition-colors"
                        >
                            이 곳의 경기방 확인하기
                        </button>
                    </div>
                </div>
            )}
        </div>
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
 * 6. 내 정보 페이지 (수정됨: 프로필 수정 기능 연결)
 */
function MyInfoPage({ user, userData, onLoginClick, onLogout, setPage }) {
    // 프로필 수정 모달 상태
    const [showEditProfile, setShowEditProfile] = useState(false);

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

   // 데이터가 없고 로딩 중도 아니라면 프로필 설정 모달이 뜰 것이므로 빈 화면 반환
    if (!userData) {
        return <div className="p-10 text-center text-gray-400">프로필 정보를 설정해주세요.</div>;
    }
    return (
        <div className="p-5 text-[#1E1E1E] space-y-6">
            <h1 className="text-2xl font-bold mb-2">내 정보</h1>
            
            {/* 프로필 요약 카드 (클릭 시 아이디 복사) */}
           <div className="bg-white rounded-xl shadow-lg p-6 relative border border-gray-50">
                <div className="flex items-center space-x-5">
                    <div className="w-20 h-20 bg-[#00B16A] rounded-full flex items-center justify-center shadow-md flex-shrink-0">
                        <User className="w-10 h-10 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h2 className="text-xl font-extrabold truncate text-[#1E1E1E] mb-1">
                            {userData?.name || '사용자'}
                        </h2>
                        <div className="flex flex-col items-start gap-1">
                            <div className="flex items-center gap-2 w-full">
                                <span className="text-gray-500 text-[11px] truncate font-bold bg-gray-50 px-2 py-1.5 rounded border border-gray-100 flex-1">
                                    {userData?.email || user?.email || user?.uid}
                                </span>
                                <button 
                                    onClick={() => {
                                        // 우선순위: Firestore이메일 > Auth이메일 > Auth UID (모두 없을 경우 빈 문자열)
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
                                            // Fallback: 구형 브라우저 및 모바일 환경
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
                                    className="p-2 bg-green-50 text-[#00B16A] rounded-lg border border-green-100 active:scale-90 transition-transform flex-shrink-0 flex items-center gap-1"
                                >
                                    <Copy size={14} />
                                    <span className="text-[10px] font-bold">복사</span>
                                </button>
                            </div>
                            <p className="text-[9px] text-gray-400 font-medium ml-1">
                                * 관리자 등록 시 위 아이디를 전달해 주세요.
                            </p>
                            {userData?.kakaoId && (
                                <span className="mt-1 text-[10px] bg-[#FEE500] text-black px-2 py-0.5 rounded-full font-bold">Kakao Login</span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* 상세 프로필 정보 카드 */}
            <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-bold mb-5 text-[#00B16A] flex items-center gap-2">
                    <UserCheck size={20}/> 나의 프로필
                </h3>
                <div className="space-y-4 text-base">
                    <div className="flex justify-between items-center border-b border-gray-50 pb-2">
                        <span className="text-gray-400 font-medium">급수</span>
                        <span className="font-bold text-[#1E1E1E]">{userData?.level || '미설정'}</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-gray-50 pb-2">
                        <span className="text-gray-400 font-medium">성별</span>
                        <span className="font-bold text-[#1E1E1E]">{userData?.gender || '미설정'}</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-gray-50 pb-2">
                        <span className="text-gray-400 font-medium">출생년도</span>
                        <span className="font-bold text-[#1E1E1E]">{userData?.birthYear ? `${userData.birthYear}년생` : '미설정'}</span>
                    </div>
                </div>
                
                {/* 수정 버튼 (기능 연결됨) */}
                 <button 
                    onClick={() => setShowEditProfile(true)}
                    className="mt-6 w-full py-3 bg-gray-50 border border-gray-200 text-gray-700 rounded-xl hover:bg-[#00B16A] hover:text-white hover:border-[#00B16A] transition-all text-base font-bold shadow-sm"
                >
                    프로필 수정하기
                </button>
            </div>

            {/* 찜한 아이템 (예시) */}
            <div className="bg-white rounded-xl shadow-lg p-6">
                 <h3 className="text-lg font-bold mb-4 text-[#00B16A] flex items-center gap-2">
                    <HeartIcon size={20}/> 찜한 아이템
                 </h3>
                 <EmptyState
                    icon={Archive}
                    title="찜한 아이템이 없습니다"
                    description="스토어에서 마음에 드는 상품을 찜해보세요!"
                    buttonText="스토어 둘러보기"
                    onButtonClick={() => setPage('store')}
                 />
            </div>

            {/* 로그아웃 버튼 */}
            <button
                onClick={onLogout}
                className="w-full py-4 bg-red-50 text-red-500 font-bold rounded-xl text-base hover:bg-red-100 transition-colors"
            >
                로그아웃
            </button>

            {/* [신규] 프로필 수정 모달 연결 */}
            <EditProfileModal 
                isOpen={showEditProfile}
                onClose={() => setShowEditProfile(false)}
                userData={userData}
                user={user}
            />
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


export default function App() {
    // [수정] 새로고침 시 마지막으로 머물던 페이지를 유지하기 위해 localStorage 값을 초기값으로 사용
    const [page, setPage] = useState(localStorage.getItem('cockstar_last_page') || 'home'); 
    const [user, setUser] = useState(null);
    const [userData, setUserData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false); 
    const [sharedRoomId, setSharedRoomId] = useState(null); 

    // [추가] 페이지(탭)가 변경될 때마다 localStorage에 현재 페이지 상태를 저장
    useEffect(() => {
        if (page) {
            localStorage.setItem('cockstar_last_page', page);
        }
    }, [page]);

    // [신규] URL 파라미터 체크 로직
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const roomId = params.get('roomId');
        if (roomId) {
            setSharedRoomId(roomId);
            setPage('game'); 
        }
    }, []);

 // [수정] 매일 자정(12시) 기준 경기 날짜 계산 함수
    const getGameDate = () => {
        const now = new Date();
        // 자정이 지나면 즉시 새로운 날짜를 반환하여 초기화되도록 설정
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
                        
                        // [추가] 새벽 2시가 지나 날짜가 바뀌었다면 전역 경기수 초기화
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

    // [신규] URL 파라미터 체크 로직 (공유 링크 접속 시 바로 경기 탭으로)
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const roomId = params.get('roomId');
        if (roomId) setPage('game'); 
    }, []);
    // 탭 클릭 시 로그인 여부 체크 핸들러
    const handleTabClick = (targetPage) => {
        if ((targetPage === 'game' || targetPage === 'myInfo') && !user) {
            setIsAuthModalOpen(true); // 로그인이 필요한 탭 클릭 시 모달 팝업
            return;
        }
        setPage(targetPage);
    };

    if (loading) return <LoadingSpinner />;

    return (
        <div className="flex flex-col h-screen bg-white max-w-md mx-auto shadow-2xl overflow-hidden relative font-sans text-[#1E1E1E]">
            {/* ... 헤더 섹션은 기존 유지 (page 상태에 따라 노출) ... */}

           <main className="flex-grow overflow-y-auto hide-scrollbar bg-white">
                {page === 'home' && <HomePage user={user} setPage={handleTabClick} />}
                {page === 'game' && (
                    <GamePage 
                        user={user} 
                        userData={userData} 
                        sharedRoomId={sharedRoomId} // 공유 ID 전달
                        onLoginClick={() => setIsAuthModalOpen(true)} 
                    />
                )}
                {page === 'kokMap' && <KokMapPage />}
                {page === 'community' && <CommunityPage />}
                {page === 'myInfo' && <MyInfoPage user={user} userData={userData} onLoginClick={() => setIsAuthModalOpen(true)} onLogout={() => signOut(auth)} setPage={handleTabClick} />}
            </main>

            {/* 하단 네비게이션 */}
            <nav className="flex justify-around items-center bg-white border-t border-gray-100 pb-safe pt-1 px-2 z-20">
                <TabButton icon={Home} label="홈" isActive={page === 'home'} onClick={() => handleTabClick('home')} />
                <TabButton icon={Trophy} label="경기" isActive={page === 'game'} onClick={() => handleTabClick('game')} />
                <TabButton icon={KokMap} label="콕맵" isActive={page === 'kokMap'} onClick={() => handleTabClick('kokMap')} />
                <TabButton icon={MessageSquare} label="커뮤니티" isActive={page === 'community'} onClick={() => handleTabClick('community')} />
                <TabButton icon={User} label="정보" isActive={page === 'myInfo'} onClick={() => handleTabClick('myInfo')} />
            </nav>

            {/* [신규] 로그인 상태인데 정보가 없는 최초 가입자에게만 강제로 띄움 */}
            {user && !userData && !loading && (
                <InitialProfileModal isOpen={true} user={user} />
            )}

            {/* 통합 로그인 모달 */}
            <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
        </div>
    );
}
