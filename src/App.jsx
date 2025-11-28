import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import {
    getAuth,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signInWithPopup,
    GoogleAuthProvider,
    signOut,
    RecaptchaVerifier,
    signInWithPhoneNumber,
    OAuthProvider,
    updatePassword,
    reauthenticateWithCredential,
    EmailAuthProvider
} from 'firebase/auth';
import { 
    getFirestore, 
    doc, 
    setDoc, 
    getDoc, 
    onSnapshot,
    collection, 
    query, 
    where, 
    addDoc, 
    serverTimestamp,
    orderBy, 
    updateDoc, 
    deleteDoc, 
    runTransaction, 
    writeBatch,
    getDocs
} from 'firebase/firestore';
import {
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
    GripVertical as GripVerticalIcon,
    Settings as SettingsIcon,
    Phone as PhoneIcon,
    MessageCircle as MessageCircleIcon,
    Mail as MailIcon
} from 'lucide-react';

// [추가] 카카오/전화번호 로그인을 위한 모듈 추가
import { 
    RecaptchaVerifier, 
    signInWithPhoneNumber, 
    OAuthProvider 
} from 'firebase/auth';

// [추가] 관리자 설정 아이콘
import { Settings as SettingsIcon } from 'lucide-react';
const Settings = createThinIcon(SettingsIcon);

// [추가] 최고 관리자 목록 (이전 앱과 동일하게 설정)
const SUPER_ADMIN_USERNAMES = ["jung22459369", "domain"];

// [수정] 얇은 아이콘 헬퍼
const createThinIcon = (IconComponent) => {
    return (props) => <IconComponent {...props} strokeWidth={1.5} />;
};

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
const Settings = createThinIcon(SettingsIcon);

// ===================================================================================
// [중요] Firebase 설정 (이전 앱 데이터 연동)
// ===================================================================================
const firebaseConfig = {
  apiKey: "AIzaSyC-eeHazZ3kVj7aQicdtlnhEmLbbTJHgGE",
  authDomain: "noerror-14ce3.firebaseapp.com",
  projectId: "noerror-14ce3",
  storageBucket: "noerror-14ce3.appspot.com",
  messagingSenderId: "279065154821",
  appId: "1:279065154821:web:812570dde2bdde560a936c",
  measurementId: "G-PFGZGHT9T4"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// [신규] 슈퍼 관리자 목록 (이전 앱 기준)
const SUPER_ADMIN_USERNAMES = ["jung22459369", "domain"];
const TEST_PHONE_NUMBER = "01012345678";

// ===================================================================================
// 상수 및 Helper 함수
// ===================================================================================
const LEVEL_ORDER = { 'S조': 1, 'A조': 2, 'B조': 3, 'C조': 4, 'D조': 5, 'E조': 6, 'N조': 7, '미설정': 8 };
const PLAYERS_PER_MATCH = 4;

const getLevelColor = (level) => {
    switch (level) {
        case 'S조': return 'border-sky-400 text-sky-500 bg-sky-50';
        case 'A조': return 'border-red-500 text-red-600 bg-red-50';
        case 'B조': return 'border-orange-500 text-orange-600 bg-orange-50';
        case 'C조': return 'border-yellow-500 text-yellow-600 bg-yellow-50';
        case 'D조': return 'border-green-500 text-green-600 bg-green-50';
        case 'E조': return 'border-blue-500 text-blue-600 bg-blue-50';
        default: return 'border-gray-300 text-gray-500 bg-gray-50';
    }
};

// ===================================================================================
// 컴포넌트 정의
// ===================================================================================

function LoadingSpinner({ text = "로딩 중..." }) {
    return (
        <div className="flex flex-col items-center justify-center h-full text-[#1E1E1E]">
            <Loader2 className="w-10 h-10 animate-spin text-[#00B16A]" />
            <span className="mt-4 text-base font-semibold">{text}</span>
        </div>
    );
}

// [신규] 통합 인증 모달 (카카오/전화번호/이메일)
function AuthModal({ onClose, setPage }) {
    const [loginMethod, setLoginMethod] = useState('main'); // main, email, phone
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [phone, setPhone] = useState('');
    const [verificationCode, setVerificationCode] = useState('');
    const [verificationId, setVerificationId] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // ReCaptcha 초기화
    useEffect(() => {
        if (!window.recaptchaVerifier) {
            try {
                window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', { 'size': 'invisible' });
            } catch (e) { console.error(e); }
        }
    }, []);

    // 1. 카카오 로그인
    const handleKakaoLogin = async () => {
        setLoading(true); setError('');
        try {
            const provider = new OAuthProvider('oidc.kakao');
            const result = await signInWithPopup(auth, provider);
            const user = result.user;
            // 사용자 정보 저장 (없으면 생성)
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (!userDoc.exists()) {
                await setDoc(doc(db, "users", user.uid), {
                    name: user.displayName || '새 사용자',
                    email: user.email,
                    username: `kakao:${user.uid}`,
                    level: 'N조',
                    gender: '미설정',
                    isKakaoUser: true
                });
            }
            onClose();
        } catch (err) {
            console.error(err);
            setError("카카오 로그인 실패. 관리자에게 문의하세요.");
        } finally { setLoading(false); }
    };

    // 2. 전화번호 로그인 (인증번호 발송)
    const handlePhoneLogin = async () => {
        if (!phone) return setError("번호를 입력해주세요.");
        setLoading(true); setError('');
        try {
            const sanitizedPhone = phone.replace(/[^0-9]/g, "");
            const phoneNumber = `+82${sanitizedPhone.startsWith('0') ? sanitizedPhone.substring(1) : sanitizedPhone}`;
            const appVerifier = window.recaptchaVerifier;
            const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
            setVerificationId(confirmationResult);
            setLoginMethod('phone-verify'); // 인증번호 입력 화면으로 전환
        } catch (err) {
            console.error(err);
            setError("인증번호 발송 실패. 번호 형식을 확인해주세요.");
        } finally { setLoading(false); }
    };

    // 3. 전화번호 인증 확인
    const handlePhoneVerify = async () => {
        setLoading(true); setError('');
        try {
            const result = await verificationId.confirm(verificationCode);
            const user = result.user;
             // 사용자 정보 저장 (없으면 생성)
             const userDoc = await getDoc(doc(db, "users", user.uid));
             if (!userDoc.exists()) {
                 await setDoc(doc(db, "users", user.uid), {
                     name: '새 사용자',
                     phone: phone,
                     username: `phone:${phone}`,
                     level: 'N조',
                     gender: '미설정',
                 });
             }
            onClose();
        } catch (err) { setError("인증번호가 올바르지 않습니다."); } finally { setLoading(false); }
    };

    // 4. 이메일/아이디 로그인 (기존 앱 로직 호환)
    const handleEmailLogin = async (e) => {
        e.preventDefault();
        setLoading(true); setError('');
        try {
            let loginEmail = email;
            if (!email.includes('@')) {
                if (email === 'domain') loginEmail = 'domain@special.user'; // 최고관리자 예외 처리
                else loginEmail = `${email}@cockstar.app`; // 기존 앱 아이디 호환
            }
            await signInWithEmailAndPassword(auth, loginEmail, password);
            onClose();
        } catch (err) { setError("아이디 또는 비밀번호가 일치하지 않습니다."); } finally { setLoading(false); }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
            <div id="recaptcha-container"></div>
            <div className="bg-white rounded-xl p-6 w-full max-w-sm relative shadow-2xl">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-black"><X size={24} /></button>
                <h2 className="text-2xl font-extrabold text-center mb-6 text-[#00B16A]">COCKSTAR</h2>
                
                {error && <div className="bg-red-50 text-red-500 text-sm p-3 rounded mb-4 text-center">{error}</div>}

                {loginMethod === 'main' && (
                    <div className="space-y-3">
                        <button onClick={handleKakaoLogin} className="w-full py-3 bg-[#FEE500] text-[#191919] font-bold rounded-xl flex justify-center items-center gap-2">
                             카카오로 3초만에 시작하기
                        </button>
                        <button onClick={() => setLoginMethod('phone')} className="w-full py-3 bg-gray-100 text-gray-700 font-bold rounded-xl">전화번호로 로그인</button>
                        <button onClick={() => setLoginMethod('email')} className="w-full py-3 border border-gray-200 text-gray-700 font-bold rounded-xl">아이디/이메일 로그인</button>
                    </div>
                )}

                {loginMethod === 'phone' && (
                    <div className="space-y-4">
                        <h3 className="font-bold text-center">휴대폰 번호 입력</h3>
                        <input type="tel" placeholder="01012345678" value={phone} onChange={(e)=>setPhone(e.target.value)} className="w-full p-3 bg-gray-50 border rounded-lg"/>
                        <button onClick={handlePhoneLogin} disabled={loading} className="w-full py-3 bg-[#00B16A] text-white font-bold rounded-xl">{loading ? <Loader2 className="animate-spin mx-auto"/> : "인증번호 받기"}</button>
                        <button onClick={() => setLoginMethod('main')} className="w-full text-center text-sm text-gray-400">뒤로가기</button>
                    </div>
                )}

                {loginMethod === 'phone-verify' && (
                    <div className="space-y-4">
                        <h3 className="font-bold text-center">인증번호 입력</h3>
                        <input type="text" placeholder="인증번호 6자리" value={verificationCode} onChange={(e)=>setVerificationCode(e.target.value)} className="w-full p-3 bg-gray-50 border rounded-lg"/>
                        <button onClick={handlePhoneVerify} disabled={loading} className="w-full py-3 bg-[#00B16A] text-white font-bold rounded-xl">{loading ? <Loader2 className="animate-spin mx-auto"/> : "인증 확인"}</button>
                    </div>
                )}

                {loginMethod === 'email' && (
                    <form onSubmit={handleEmailLogin} className="space-y-4">
                        <h3 className="font-bold text-center">아이디 로그인</h3>
                        <input type="text" placeholder="아이디" value={email} onChange={(e)=>setEmail(e.target.value)} className="w-full p-3 bg-gray-50 border rounded-lg"/>
                        <input type="password" placeholder="비밀번호" value={password} onChange={(e)=>setPassword(e.target.value)} className="w-full p-3 bg-gray-50 border rounded-lg"/>
                        <button type="submit" disabled={loading} className="w-full py-3 bg-[#00B16A] text-white font-bold rounded-xl">{loading ? <Loader2 className="animate-spin mx-auto"/> : "로그인"}</button>
                        <button type="button" onClick={() => setLoginMethod('main')} className="w-full text-center text-sm text-gray-400">뒤로가기</button>
                    </form>
                )}
            </div>
        </div>
    );
}

// [신규] 코트 타이머
const CourtTimer = ({ startTime }) => {
    const [time, setTime] = useState('00:00');
    useEffect(() => {
        if (startTime) {
            const interval = setInterval(() => {
                const now = new Date();
                const start = new Date(startTime);
                const diff = Math.floor((now - start) / 1000);
                const m = String(Math.floor(diff / 60)).padStart(2, '0');
                const s = String(diff % 60).padStart(2, '0');
                setTime(`${m}:${s}`);
            }, 1000);
            return () => clearInterval(interval);
        }
    }, [startTime]);
    return <span className="font-mono text-[#00B16A] font-bold">{time}</span>;
};

// ===================================================================================
// 핵심 컴포넌트: 경기방 (GameRoomView) - 통합 로직 적용
// ===================================================================================

// [수정] 선수 카드 (요청하신 디자인 및 기능 반영)
const PlayerCard = React.memo(({ 
    player, 
    isAdmin, 
    isCurrentUser, 
    isPlaying,
    isResting,
    isSelected, // [중요] 선택된 상태
    onCardClick, 
    onDeleteClick, // [중요] 스케줄에서 뺄 때 사용하는 함수
    onDragStart,
}) => {
    if (!player) return <div className="h-12 bg-gray-100 rounded-lg animate-pulse"></div>;

    const levelColorClass = getLevelColor(player.level);
    const genderBorder = player.gender === '남' ? 'border-l-blue-500' : 'border-l-pink-500';

    // 스타일 클래스 조합
    let containerClass = `relative bg-white rounded-lg shadow-sm p-1.5 h-12 flex flex-col justify-center border-l-[3px] transition-all duration-200 cursor-pointer ${genderBorder} `;
    
    // [핵심] 선택 시 모션 효과 (금색 테두리 + 확대)
    if (isSelected) {
        containerClass += " ring-2 ring-[#FFD700] ring-offset-1 transform scale-105 z-10 shadow-md ";
    } else if (isCurrentUser) {
        containerClass += " ring-1 ring-[#00B16A] ring-offset-1 "; 
    } else {
        containerClass += " hover:scale-[1.02] hover:shadow ";
    }
    
    if (isPlaying) containerClass += " opacity-50 bg-gray-50 grayscale ";
    if (isResting) containerClass += " opacity-40 bg-gray-100 grayscale ";

    return (
        <div
            className={containerClass}
            onClick={() => onCardClick && onCardClick(player)}
            draggable={isAdmin}
            onDragStart={(e) => isAdmin && onDragStart && onDragStart(e, player.id)}
        >
            {/* 상단: 이름 & 관리자 아이콘 */}
            <div className="flex justify-between items-start w-full">
                <span className="text-xs font-bold text-[#1E1E1E] truncate pr-1 leading-tight flex items-center gap-1">
                    {player.name}
                    {SUPER_ADMIN_USERNAMES.includes(player.username) && <span className="text-[10px]">👑</span>}
                </span>
                
                {/* [추가] 관리자용 X 버튼 (경기 예정 등에서 삭제할 때) */}
                {isAdmin && onDeleteClick && (
                    <button 
                        onClick={(e) => {
                            e.stopPropagation(); // 카드 클릭 방지
                            onDeleteClick(player);
                        }}
                        className="text-gray-300 hover:text-red-500 transition-colors -mt-0.5 -mr-0.5"
                    >
                        <X size={12} strokeWidth={3} />
                    </button>
                )}
            </div>
            
            {/* 하단: 급수, 게임 수 */}
            <div className="flex justify-between items-end mt-0.5">
                <span className={`text-[9px] font-extrabold px-1 rounded border ${levelColorClass.replace('text-', 'bg-opacity-10 bg-').replace('border-', 'border-')}`}>
                    {player.level || 'N'}
                </span>
                <span className="text-[9px] text-gray-400 font-medium">
                    {player.todayGames || 0}G
                </span>
            </div>
        </div>
    );
});

// 빈 슬롯
const EmptySlot = ({ onClick, onDrop, onDragOver }) => (
    <div 
        onClick={onClick}
        onDrop={onDrop}
        onDragOver={onDragOver}
        className="h-12 bg-gray-50 rounded-lg flex items-center justify-center text-gray-300 border border-dashed border-gray-300 transition-all cursor-pointer hover:bg-white hover:border-[#00B16A] hover:text-[#00B16A]"
    >
        <Plus size={16} />
    </div>
);

// [신규] 방 설정 모달 (이전 앱 기능 통합)
function RoomSettingsModal({ isOpen, onClose, roomData, onSave, onDeleteRoom, user }) {
    const [formData, setFormData] = useState({ name: '', description: '', location: '', password: '', usePassword: false, admins: [] });

    useEffect(() => {
        if(roomData) {
            setFormData({
                name: roomData.name || '',
                description: roomData.description || '',
                location: roomData.location || '',
                password: roomData.password || '',
                usePassword: !!roomData.password,
                admins: roomData.admins || []
            });
        }
    }, [roomData]);

    const handleSave = () => {
        onSave({ ...formData, password: formData.usePassword ? formData.password : '' });
    };

    const handleAdminChange = (idx, val) => {
        const newAdmins = [...formData.admins];
        newAdmins[idx] = val;
        setFormData({...formData, admins: newAdmins});
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl max-h-[80vh] overflow-y-auto">
                <div className="flex justify-between mb-4">
                    <h3 className="text-lg font-bold">방 설정</h3>
                    <button onClick={onClose}><X size={24} className="text-gray-400"/></button>
                </div>
                
                <div className="space-y-3">
                    <div><label className="text-xs font-bold text-gray-500">방 이름</label><input type="text" value={formData.name} onChange={e=>setFormData({...formData, name: e.target.value})} className="w-full p-2 bg-gray-100 rounded border mt-1"/></div>
                    <div><label className="text-xs font-bold text-gray-500">소개</label><textarea value={formData.description} onChange={e=>setFormData({...formData, description: e.target.value})} className="w-full p-2 bg-gray-100 rounded border mt-1" rows={2}/></div>
                    <div><label className="text-xs font-bold text-gray-500">위치</label><input type="text" value={formData.location} onChange={e=>setFormData({...formData, location: e.target.value})} className="w-full p-2 bg-gray-100 rounded border mt-1"/></div>
                    <div>
                        <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={formData.usePassword} onChange={e=>setFormData({...formData, usePassword: e.target.checked})} /> 비밀번호 설정</label>
                        {formData.usePassword && <input type="text" value={formData.password} onChange={e=>setFormData({...formData, password: e.target.value})} className="w-full p-2 bg-gray-100 rounded border mt-1" placeholder="비밀번호"/>}
                    </div>
                    
                    <div className="border-t pt-2">
                        <label className="text-xs font-bold text-gray-500">관리자 관리</label>
                        {formData.admins.map((adm, i) => (
                             <div key={i} className="flex gap-1 mt-1">
                                <input type="text" value={adm} onChange={(e)=>handleAdminChange(i, e.target.value)} className="w-full p-2 bg-gray-100 rounded border"/>
                                <button onClick={()=>{const newAdmins = formData.admins.filter((_, idx)=>idx!==i); setFormData({...formData, admins: newAdmins});}} className="text-red-500 p-2"><X size={16}/></button>
                             </div>
                        ))}
                        <button onClick={()=>setFormData({...formData, admins: [...formData.admins, '']})} className="text-xs text-[#00B16A] font-bold mt-2">+ 관리자 추가</button>
                    </div>

                    <button onClick={handleSave} className="w-full py-3 bg-[#00B16A] text-white font-bold rounded-xl mt-4">저장하기</button>
                    
                    {/* 방 삭제: 방장 또는 슈퍼관리자만 가능 */}
                    {(user.uid === roomData.adminUid || SUPER_ADMIN_USERNAMES.includes(user.uid)) && (
                        <button onClick={onDeleteRoom} className="w-full py-3 bg-red-50 text-red-500 font-bold rounded-xl mt-2">방 삭제</button>
                    )}
                </div>
            </div>
        </div>
    );
}

// ===================================================================================
// GameRoomView (메인 로직)
// ===================================================================================
function GameRoomView({ roomId, user, userData, onExitRoom }) {
    const [roomData, setRoomData] = useState(null);
    const [players, setPlayers] = useState({});
    const [selectedPlayerIds, setSelectedPlayerIds] = useState([]); // 다중 선택
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    
    // [중요] 관리자 권한 체크 (슈퍼관리자 포함)
    const isAdmin = useMemo(() => {
        if (!roomData || !userData) return false;
        return SUPER_ADMIN_USERNAMES.includes(userData.username) || 
               roomData.createdBy === user.uid || 
               (roomData.admins || []).includes(userData.username);
    }, [userData, roomData, user]);

    // 방 데이터 구독
    useEffect(() => {
        const unsub = onSnapshot(doc(db, "rooms", roomId), (d) => {
            if (d.exists()) setRoomData({ id: d.id, ...d.data() });
            else { alert("방이 삭제되었습니다."); onExitRoom(); }
        });
        return () => unsub();
    }, [roomId]);

    // 플레이어 구독
    useEffect(() => {
        const unsub = onSnapshot(collection(db, "rooms", roomId, "players"), (snap) => {
            const pData = {};
            snap.forEach(d => pData[d.id] = { id: d.id, ...d.data() });
            setPlayers(pData);
        });
        return () => unsub();
    }, [roomId]);

    // 입장 처리
    useEffect(() => {
        if(!userData) return;
        const pRef = doc(db, "rooms", roomId, "players", user.uid);
        getDoc(pRef).then(snap => {
            if(!snap.exists()) {
                setDoc(pRef, { ...userData, todayGames: 0, entryTime: serverTimestamp() });
            }
        });
    }, [roomId, user, userData]);

    // [로직 1] 카드 클릭 (선택 토글)
    const handleCardClick = (player) => {
        if (!isAdmin) return;
        setSelectedPlayerIds(prev => {
            if (prev.includes(player.id)) return prev.filter(id => id !== player.id);
            return [...prev, player.id];
        });
    };

    // [로직 2] 빈 슬롯 클릭 (선수 이동)
    const handleSlotClick = async (matchIndex, slotIndex) => {
        if (!isAdmin || selectedPlayerIds.length === 0) return;
        
        // 기존 스케줄에서 선택된 선수들 제거하고 새 자리에 넣기
        const newSchedule = { ...(roomData.scheduledMatches || {}) };
        const targetMatch = [...(newSchedule[matchIndex] || Array(PLAYERS_PER_MATCH).fill(null))];
        
        let insertIdx = slotIndex;
        const playersToMove = [...selectedPlayerIds];

        // 1. 기존 위치에서 제거
        Object.keys(newSchedule).forEach(key => {
            newSchedule[key] = (newSchedule[key] || []).map(pid => playersToMove.includes(pid) ? null : pid);
        });

        // 2. 새 위치에 삽입
        while (playersToMove.length > 0 && insertIdx < PLAYERS_PER_MATCH) {
            if (targetMatch[insertIdx] === null) {
                targetMatch[insertIdx] = playersToMove.shift();
            }
            insertIdx++;
        }
        newSchedule[matchIndex] = targetMatch;

        await updateDoc(doc(db, "rooms", roomId), { scheduledMatches: newSchedule });
        setSelectedPlayerIds([]); // 선택 해제
    };

    // [로직 3] X 버튼 클릭 (대기 명단 복귀)
    const handleRemoveFromSchedule = async (player) => {
        const newSchedule = { ...(roomData.scheduledMatches || {}) };
        Object.keys(newSchedule).forEach(key => {
            newSchedule[key] = (newSchedule[key] || []).map(pid => pid === player.id ? null : pid);
        });
        await updateDoc(doc(db, "rooms", roomId), { scheduledMatches: newSchedule });
    };

    // 방 설정 저장
    const handleSettingsSave = async (settings) => {
        await updateDoc(doc(db, "rooms", roomId), settings);
        setIsSettingsOpen(false);
    };

    // 방 삭제
    const handleDeleteRoom = async () => {
        if(confirm("정말로 방을 삭제하시겠습니까?")) {
            await deleteDoc(doc(db, "rooms", roomId));
            onExitRoom();
        }
    };

    if (!roomData) return <LoadingSpinner />;

    // 대기 명단 필터링 (경기중/스케줄 인원 제외)
    const waitingList = Object.values(players).filter(p => {
        const inGame = (roomData.inProgressCourts || []).some(c => c && c.players.includes(p.id));
        const inSchedule = Object.values(roomData.scheduledMatches || {}).some(m => m && m.includes(p.id));
        return !inGame && !inSchedule;
    }).sort((a,b) => (LEVEL_ORDER[a.level]||99) - (LEVEL_ORDER[b.level]||99));

    return (
        <div className="flex flex-col h-full bg-gray-50">
            {/* 헤더 */}
            <header className="flex-shrink-0 bg-white p-3 border-b flex justify-between items-center sticky top-0 z-30 shadow-sm">
                <div className="flex items-center gap-2">
                    <button onClick={onExitRoom}><ArrowLeft className="text-gray-600" /></button>
                    <div><h1 className="font-bold text-lg leading-tight">{roomData.name}</h1><p className="text-xs text-gray-500">{roomData.location}</p></div>
                </div>
                {/* 관리자 설정 아이콘 */}
                {isAdmin && (
                    <button onClick={() => setIsSettingsOpen(true)} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200">
                        <Settings size={20} className="text-gray-600" />
                    </button>
                )}
            </header>

            <main className="flex-grow overflow-y-auto p-3 space-y-4">
                {/* 1. 대기 명단 */}
                <section className="bg-white p-3 rounded-xl shadow-sm border border-gray-100">
                    <h2 className="text-sm font-bold mb-2 flex justify-between text-gray-700"><span>대기 명단</span><span className="text-[#00B16A]">{waitingList.length}명</span></h2>
                    <div className="grid grid-cols-5 gap-1.5 min-h-[50px]">
                        {waitingList.map(p => (
                            <PlayerCard 
                                key={p.id} player={p} isAdmin={isAdmin} isCurrentUser={user.uid === p.id}
                                isSelected={selectedPlayerIds.includes(p.id)}
                                onCardClick={handleCardClick}
                            />
                        ))}
                    </div>
                </section>

                {/* 2. 경기 예정 */}
                <section className="space-y-2">
                    <h2 className="text-sm font-bold text-gray-700 px-1">경기 예정</h2>
                    {Array.from({ length: roomData.numScheduledMatches || 4 }).map((_, mIdx) => {
                        const match = roomData.scheduledMatches?.[mIdx] || Array(PLAYERS_PER_MATCH).fill(null);
                        return (
                            <div key={mIdx} className="bg-white p-2 rounded-xl shadow-sm border flex gap-2 items-center">
                                <span className="text-lg font-black text-gray-300 w-6 text-center">{mIdx + 1}</span>
                                <div className="grid grid-cols-4 gap-1.5 flex-1">
                                    {match.map((pid, sIdx) => pid ? (
                                        <PlayerCard 
                                            key={pid} player={players[pid]} isAdmin={isAdmin}
                                            isSelected={selectedPlayerIds.includes(pid)}
                                            onCardClick={handleCardClick}
                                            onDeleteClick={handleRemoveFromSchedule} // X 버튼 클릭 시 실행
                                        />
                                    ) : (
                                        <EmptySlot key={sIdx} onClick={() => handleSlotClick(mIdx, sIdx)} />
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </section>
                
                {/* 3. 경기 진행 (기존 로직 유지 또는 필요시 추가) */}
                {/* ... (기존 경기 진행 섹션 코드를 여기에 유지하세요) ... */}
            </main>
            
            <RoomSettingsModal 
                isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} 
                roomData={roomData} onSave={handleSettingsSave} onDeleteRoom={handleDeleteRoom} user={user}
            />
        </div>
    );
}

// ... (홈, 스토어, 커뮤니티, 내정보 등 다른 페이지 컴포넌트는 간소화를 위해 플레이스홀더로 유지하거나 기존 코드 사용)
// 편의상 이 예제에서는 메인 로직인 GamePage와 Auth 위주로 작성됨. 
// 실제 앱에서는 HomePage, StorePage 등은 위에서 작성했던 코드와 동일하게 유지하면 됩니다.

function HomePage({ setPage }) {
    return (
        <div className="p-5 space-y-6">
            <header className="flex justify-between items-center">
                <h1 className="text-2xl font-extrabold text-[#00B16A]">COCKSTAR</h1>
                <Bell className="text-gray-400"/>
            </header>
            <section className="bg-[#00B16A] h-32 rounded-2xl flex items-center justify-center text-white font-bold shadow-lg">
                메인 배너 영역
            </section>
            <section>
                <h2 className="font-bold mb-3 text-lg">지금 뜨는 경기</h2>
                <div onClick={() => setPage('game')} className="bg-white p-4 rounded-xl shadow-md border border-gray-100 cursor-pointer hover:border-[#00B16A] transition-colors">
                    <div className="flex justify-between mb-2">
                        <span className="font-bold">콕스타 주말 번개</span>
                        <span className="text-[#00B16A] text-sm">8/12명</span>
                    </div>
                    <div className="text-sm text-gray-500">탄천종합운동장 | 14:00</div>
                </div>
            </section>
        </div>
    );
}

function LobbyPage({ user, userData, setPage, onEnterRoom }) {
    const [rooms, setRooms] = useState([]);
    const [showCreate, setShowCreate] = useState(false);
    const [newRoomName, setNewRoomName] = useState('');

    useEffect(() => {
        const q = query(collection(db, "rooms"), orderBy("createdAt", "desc"));
        const unsub = onSnapshot(q, (snap) => {
            setRooms(snap.docs.map(d => ({id: d.id, ...d.data()})));
        });
        return () => unsub();
    }, []);

    const handleCreate = async () => {
        if(!newRoomName) return;
        // [중요] 관리자만 방 생성 가능 (기존 앱 로직)
        if (!SUPER_ADMIN_USERNAMES.includes(userData.username)) {
            alert("방 생성 권한이 없습니다. 관리자에게 문의하세요.");
            return;
        }

        const docRef = await addDoc(collection(db, "rooms"), {
            name: newRoomName,
            createdBy: user.uid,
            adminUid: user.uid,
            admins: [userData.username], // 생성자 자동 관리자
            createdAt: serverTimestamp(),
            numScheduledMatches: 4,
            numInProgressCourts: 2,
            scheduledMatches: {},
            inProgressCourts: [null, null]
        });
        onEnterRoom(docRef.id);
    };

    return (
        <div className="p-4 h-full flex flex-col">
            <h1 className="text-2xl font-bold mb-4">경기장 로비</h1>
            <div className="flex-grow space-y-3 overflow-y-auto">
                {rooms.map(room => (
                    <div key={room.id} onClick={() => onEnterRoom(room.id)} className="bg-white p-4 rounded-xl shadow-sm border cursor-pointer hover:border-[#00B16A]">
                        <h3 className="font-bold text-lg">{room.name}</h3>
                        <p className="text-gray-500 text-sm">{room.location || '장소 미정'}</p>
                    </div>
                ))}
            </div>
            
            {/* 방 만들기 버튼 (관리자만 가능하지만 UI는 노출하고 클릭 시 얼럿) */}
            <button onClick={() => setShowCreate(!showCreate)} className="absolute bottom-4 right-4 bg-[#00B16A] text-white p-4 rounded-full shadow-lg">
                <Plus />
            </button>

            {showCreate && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white p-6 rounded-xl w-full max-w-sm">
                        <h3 className="font-bold mb-4">새 방 만들기</h3>
                        <input className="w-full border p-2 rounded mb-4" placeholder="방 이름" value={newRoomName} onChange={e=>setNewRoomName(e.target.value)}/>
                        <button onClick={handleCreate} className="w-full bg-[#00B16A] text-white py-3 rounded-xl font-bold">생성</button>
                        <button onClick={() => setShowCreate(false)} className="w-full mt-2 text-gray-500">취소</button>
                    </div>
                </div>
            )}
        </div>
    );
}

// ===================================================================================
// Main App
// ===================================================================================
export default function App() {
    const [user, setUser] = useState(null);
    const [userData, setUserData] = useState(null);
    const [page, setPage] = useState('home'); 
    const [roomId, setRoomId] = useState(null);
    const [showAuthModal, setShowAuthModal] = useState(false);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (u) => {
            setUser(u);
            if (u) {
                const snap = await getDoc(doc(db, "users", u.uid));
                if (snap.exists()) setUserData({uid: u.uid, ...snap.data()});
            } else {
                setUserData(null);
            }
        });
        return () => unsub();
    }, []);

    const handleEnterRoom = (rid) => {
        setRoomId(rid);
        setPage('gameRoom');
    };

    const renderContent = () => {
        if (page === 'home') return <HomePage setPage={setPage} />;
        if (page === 'game') return <LobbyPage user={user} userData={userData} setPage={setPage} onEnterRoom={handleEnterRoom} />;
        if (page === 'gameRoom') return <GameRoomView roomId={roomId} user={user} userData={userData} onExitRoom={() => setPage('game')} />;
        return <HomePage setPage={setPage} />;
    };

    return (
        <div className="flex flex-col h-screen bg-white max-w-md mx-auto shadow-2xl relative text-[#1E1E1E]">
            {/* 메인 컨텐츠 */}
            <div className="flex-grow overflow-hidden">
                {renderContent()}
            </div>

            {/* 하단 탭 (경기방 아닐 때만 노출) */}
            {page !== 'gameRoom' && (
                <nav className="flex justify-around items-center bg-white border-t py-2 pb-safe">
                    <button onClick={() => setPage('home')} className={`flex flex-col items-center ${page === 'home' ? 'text-[#00B16A]' : 'text-gray-400'}`}>
                        <Home size={24} strokeWidth={page === 'home' ? 2.5 : 1.5} />
                        <span className="text-[10px] mt-1">홈</span>
                    </button>
                    <button onClick={() => setPage('game')} className={`flex flex-col items-center ${page === 'game' ? 'text-[#00B16A]' : 'text-gray-400'}`}>
                        <Trophy size={24} strokeWidth={page === 'game' ? 2.5 : 1.5} />
                        <span className="text-[10px] mt-1">경기</span>
                    </button>
                    <button onClick={() => setPage('store')} className={`flex flex-col items-center ${page === 'store' ? 'text-[#00B16A]' : 'text-gray-400'}`}>
                        <Store size={24} />
                        <span className="text-[10px] mt-1">스토어</span>
                    </button>
                    <button onClick={() => setPage('community')} className={`flex flex-col items-center ${page === 'community' ? 'text-[#00B16A]' : 'text-gray-400'}`}>
                        <Users size={24} />
                        <span className="text-[10px] mt-1">커뮤니티</span>
                    </button>
                    <button onClick={() => user ? setPage('myinfo') : setShowAuthModal(true)} className={`flex flex-col items-center ${page === 'myinfo' ? 'text-[#00B16A]' : 'text-gray-400'}`}>
                        <User size={24} />
                        <span className="text-[10px] mt-1">내정보</span>
                    </button>
                </nav>
            )}

            {/* 로그인 모달 */}
            {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} setPage={setPage} />}
        </div>
    );
}
