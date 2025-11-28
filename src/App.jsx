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
    const [authMode, setAuthMode] = useState('login'); // login, signup, phone, find
    const [loginMethod, setLoginMethod] = useState('main'); // main, email, phone
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [phone, setPhone] = useState('');
    const [verificationCode, setVerificationCode] = useState('');
    const [verificationId, setVerificationId] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    
    // recaptcha 초기화
    useEffect(() => {
        if (!window.recaptchaVerifier) {
            try {
                window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
                    'size': 'invisible'
                });
            } catch (e) {
                console.log("Recaptcha init skipped or failed", e);
            }
        }
    }, []);

    const handleKakaoLogin = async () => {
        setLoading(true); setError('');
        try {
            const provider = new OAuthProvider('oidc.kakao');
            const result = await signInWithPopup(auth, provider);
            const user = result.user;
            
            // 기존 앱 로직: 문서 확인
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
            setError("카카오 로그인 실패: " + err.message);
        } finally { setLoading(false); }
    };

    const handlePhoneLogin = async () => {
        if (!phone) return setError("전화번호를 입력해주세요.");
        setLoading(true); setError('');
        try {
            const sanitizedPhone = phone.replace(/[^0-9]/g, "");
            const phoneNumber = `+82${sanitizedPhone.startsWith('0') ? sanitizedPhone.substring(1) : sanitizedPhone}`;
            const appVerifier = window.recaptchaVerifier;
            const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
            setVerificationId(confirmationResult);
            setLoginMethod('phone-verify');
        } catch (err) {
            console.error(err);
            setError("인증번호 발송 실패. 번호 형식을 확인해주세요.");
        } finally { setLoading(false); }
    };

    const handlePhoneVerify = async () => {
        setLoading(true); setError('');
        try {
            await verificationId.confirm(verificationCode);
            onClose();
        } catch (err) {
            setError("인증번호가 올바르지 않습니다.");
        } finally { setLoading(false); }
    };

    const handleEmailLogin = async (e) => {
        e.preventDefault();
        setLoading(true); setError('');
        try {
            // [중요] 기존 앱 로직: 아이디 입력 시 @cockstar.app 붙여서 이메일 로그인 시도
            let loginEmail = email;
            if (!email.includes('@')) {
                if (email === 'domain') loginEmail = 'domain@special.user';
                else loginEmail = `${email}@cockstar.app`;
            }
            await signInWithEmailAndPassword(auth, loginEmail, password);
            onClose();
        } catch (err) {
            setError("아이디 또는 비밀번호가 일치하지 않습니다.");
        } finally { setLoading(false); }
    };

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div id="recaptcha-container"></div>
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm relative shadow-2xl animate-fade-in-up">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-black"><X size={24} /></button>
                
                <h2 className="text-2xl font-extrabold text-center mb-6 text-[#00B16A] tracking-tight">COCKSTAR</h2>
                
                {error && <div className="bg-red-50 text-red-500 text-sm p-3 rounded-lg mb-4 text-center">{error}</div>}

                {loginMethod === 'main' && (
                    <div className="space-y-3">
                        <button onClick={handleKakaoLogin} className="w-full py-3 bg-[#FEE500] text-[#191919] font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-yellow-400 transition-colors">
                            <MessageCircleIcon size={20} fill="#191919" /> 카카오로 3초만에 시작하기
                        </button>
                        <button onClick={() => setLoginMethod('phone')} className="w-full py-3 bg-gray-100 text-gray-700 font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-gray-200 transition-colors">
                            <PhoneIcon size={20} /> 전화번호로 로그인
                        </button>
                        <button onClick={() => setLoginMethod('email')} className="w-full py-3 bg-white border-2 border-gray-100 text-gray-700 font-bold rounded-xl flex items-center justify-center gap-2 hover:border-gray-300 transition-colors">
                            <MailIcon size={20} /> 아이디/이메일로 로그인
                        </button>
                    </div>
                )}

                {loginMethod === 'phone' && (
                    <div className="space-y-4">
                        <h3 className="text-lg font-bold text-center">전화번호 인증</h3>
                        <input type="tel" placeholder="휴대폰 번호 (- 없이 입력)" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full p-3 bg-gray-50 rounded-lg border focus:border-[#00B16A] outline-none" />
                        <button onClick={handlePhoneLogin} disabled={loading} className="w-full py-3 bg-[#00B16A] text-white font-bold rounded-xl">
                            {loading ? <Loader2 className="animate-spin mx-auto"/> : "인증번호 받기"}
                        </button>
                        <button onClick={() => setLoginMethod('main')} className="w-full text-sm text-gray-400">뒤로가기</button>
                    </div>
                )}

                {loginMethod === 'phone-verify' && (
                    <div className="space-y-4">
                        <h3 className="text-lg font-bold text-center">인증번호 입력</h3>
                        <input type="text" placeholder="인증번호 6자리" value={verificationCode} onChange={(e) => setVerificationCode(e.target.value)} className="w-full p-3 bg-gray-50 rounded-lg border focus:border-[#00B16A] outline-none" />
                        <button onClick={handlePhoneVerify} disabled={loading} className="w-full py-3 bg-[#00B16A] text-white font-bold rounded-xl">
                            {loading ? <Loader2 className="animate-spin mx-auto"/> : "인증 완료"}
                        </button>
                    </div>
                )}

                {loginMethod === 'email' && (
                    <form onSubmit={handleEmailLogin} className="space-y-4">
                         <h3 className="text-lg font-bold text-center">아이디 로그인</h3>
                         <input type="text" placeholder="아이디 또는 이메일" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full p-3 bg-gray-50 rounded-lg border focus:border-[#00B16A] outline-none" />
                         <input type="password" placeholder="비밀번호" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full p-3 bg-gray-50 rounded-lg border focus:border-[#00B16A] outline-none" />
                         <button type="submit" disabled={loading} className="w-full py-3 bg-[#00B16A] text-white font-bold rounded-xl">
                            {loading ? <Loader2 className="animate-spin mx-auto"/> : "로그인"}
                        </button>
                         <button type="button" onClick={() => setLoginMethod('main')} className="w-full text-sm text-gray-400">뒤로가기</button>
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
    isSelected, 
    onCardClick, 
    onDeleteClick, 
    onDragStart,
}) => {
    if (!player) return <div className="h-12 bg-gray-100 rounded-lg animate-pulse"></div>; // 크기 축소

    const levelStyle = getLevelColor(player.level);
    const genderColor = player.gender === '남' ? 'border-l-blue-500' : 'border-l-pink-500';

    // 스타일 클래스 조합
    let containerClass = `relative bg-white rounded-lg shadow-sm p-1.5 h-12 flex flex-col justify-center border-l-[3px] transition-all duration-200 cursor-pointer ${genderColor} `;
    
    // [중요] 선택 시 고급스러운 모션 (금색 테두리 + 확대 + 그림자)
    if (isSelected) {
        containerClass += " ring-2 ring-[#FFD700] ring-offset-1 transform scale-105 shadow-xl z-10 ";
    } else if (isCurrentUser) {
        containerClass += " ring-1 ring-[#00B16A] ring-offset-1 ";
    } else {
        containerClass += " hover:shadow-md hover:scale-[1.02] ";
    }

    if (isPlaying) containerClass += " opacity-50 bg-gray-50 grayscale ";

    return (
        <div
            className={containerClass}
            onClick={() => onCardClick && onCardClick(player)}
            draggable={isAdmin}
            onDragStart={(e) => isAdmin && onDragStart(e, player.id)}
        >
            <div className="flex justify-between items-center w-full">
                {/* 이름 및 관리자 아이콘 */}
                <span className="text-xs font-bold text-[#1E1E1E] truncate pr-1 flex items-center gap-1">
                    {player.name}
                    {(SUPER_ADMIN_USERNAMES.includes(player.username)) && <span className="text-[10px]">👑</span>}
                </span>
                
                {/* [수정] X 버튼: 관리자이고, 삭제 핸들러가 있을 때만 표시 (경기 예정 등에서 사용) */}
                {isAdmin && onDeleteClick && (
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            onDeleteClick(player);
                        }}
                        className="text-gray-300 hover:text-red-500 transition-colors p-0.5"
                    >
                        <X size={12} strokeWidth={3} />
                    </button>
                )}
            </div>
            
            {/* 하단 정보: 급수 (배경색 적용됨) | 게임수 */}
            <div className="flex justify-between items-center mt-1">
                <span className={`text-[9px] font-bold px-1 rounded ${levelStyle} border`}>
                    {player.level}
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
function RoomSettingsModal({ isOpen, onClose, roomData, onSave, onDeleteRoom, user, admins }) {
    const [formData, setFormData] = useState({
        name: '', description: '', location: '', password: '', usePassword: false, admins: []
    });

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
        onSave({
            ...formData,
            password: formData.usePassword ? formData.password : ''
        });
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
                    <div>
                        <label className="text-xs font-bold text-gray-500">방 이름</label>
                        <input type="text" value={formData.name} onChange={e=>setFormData({...formData, name: e.target.value})} className="w-full p-2 bg-gray-100 rounded border mt-1"/>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500">소개</label>
                        <textarea value={formData.description} onChange={e=>setFormData({...formData, description: e.target.value})} className="w-full p-2 bg-gray-100 rounded border mt-1" rows={2}/>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500">위치</label>
                        <input type="text" value={formData.location} onChange={e=>setFormData({...formData, location: e.target.value})} className="w-full p-2 bg-gray-100 rounded border mt-1"/>
                    </div>
                    <div>
                        <label className="flex items-center gap-2 text-sm font-bold">
                            <input type="checkbox" checked={formData.usePassword} onChange={e=>setFormData({...formData, usePassword: e.target.checked})} /> 비밀번호 설정
                        </label>
                        {formData.usePassword && (
                            <input type="text" value={formData.password} onChange={e=>setFormData({...formData, password: e.target.value})} className="w-full p-2 bg-gray-100 rounded border mt-1" placeholder="비밀번호 입력"/>
                        )}
                    </div>
                    
                    <div className="border-t pt-2">
                        <label className="text-xs font-bold text-gray-500">관리자 아이디 관리</label>
                        {formData.admins.map((adm, i) => (
                             <div key={i} className="flex gap-1 mt-1">
                                <input type="text" value={adm} onChange={(e)=>handleAdminChange(i, e.target.value)} className="w-full p-2 bg-gray-100 rounded border"/>
                                <button onClick={()=>{
                                    const newAdmins = formData.admins.filter((_, idx)=>idx!==i);
                                    setFormData({...formData, admins: newAdmins});
                                }} className="text-red-500 p-2"><X size={16}/></button>
                             </div>
                        ))}
                        <button onClick={()=>setFormData({...formData, admins: [...formData.admins, '']})} className="text-xs text-[#00B16A] font-bold mt-2">+ 관리자 추가</button>
                    </div>

                    <button onClick={handleSave} className="w-full py-3 bg-[#00B16A] text-white font-bold rounded-xl shadow-md mt-4">저장하기</button>
                    
                    {/* 방장 또는 슈퍼관리자만 삭제 가능 */}
                    {(user.uid === roomData.adminUid || SUPER_ADMIN_USERNAMES.includes(user.username)) && (
                        <button onClick={onDeleteRoom} className="w-full py-3 bg-red-100 text-red-500 font-bold rounded-xl mt-2">방 삭제</button>
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
    const [draggedPlayerId, setDraggedPlayerId] = useState(null);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    
    // [중요] 관리자 여부 확인 (슈퍼관리자 + 방장 + 지정관리자)
    const isAdmin = useMemo(() => {
        if (!roomData || !userData) return false;
        // 1. 슈퍼관리자 2. 방생성자 3. admins 배열에 포함된 username
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

    // 플레이어 데이터 구독
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
                setDoc(pRef, {
                    ...userData,
                    todayGames: 0,
                    entryTime: serverTimestamp()
                });
            }
        });
    }, [roomId, user, userData]);

    // [중요] 안전한 상태 업데이트 (트랜잭션)
    const updateRoom = async (updateFn) => {
        try {
            await runTransaction(db, async (t) => {
                const ref = doc(db, "rooms", roomId);
                const snap = await t.get(ref);
                if (!snap.exists()) throw "Room error";
                const newData = updateFn(snap.data());
                if (newData) t.update(ref, newData);
            });
        } catch (e) { console.error(e); }
    };

    // --- Actions ---

    // 1. 카드 클릭 (선택 활성화 - 모션 포함)
    const handleCardClick = (player) => {
        if (!isAdmin) return;
        setSelectedPlayerIds(prev => {
            if (prev.includes(player.id)) return prev.filter(id => id !== player.id);
            return [...prev, player.id]; // 다중 선택 지원
        });
    };

    // 2. 슬롯 클릭 (이동 로직 - 클릭 방식)
    const handleSlotClick = async (matchIndex, slotIndex) => {
        if (!isAdmin || selectedPlayerIds.length === 0) return;

        await updateRoom((data) => {
            const currentSchedule = { ...data.scheduledMatches };
            const targetMatch = [...(currentSchedule[matchIndex] || Array(PLAYERS_PER_MATCH).fill(null))];
            
            // 이미 찬 자리는 패스하고 빈 자리 찾기
            let insertIdx = slotIndex;
            const playersToMove = [...selectedPlayerIds];

            // 기존 스케줄에서 선택된 선수들 제거 (이동 처리)
            Object.keys(currentSchedule).forEach(key => {
                currentSchedule[key] = (currentSchedule[key] || []).map(pid => 
                    playersToMove.includes(pid) ? null : pid
                );
            });
            
            // 새 자리에 넣기
            while (playersToMove.length > 0 && insertIdx < PLAYERS_PER_MATCH) {
                if (targetMatch[insertIdx] === null) {
                    targetMatch[insertIdx] = playersToMove.shift();
                }
                insertIdx++;
            }
            
            currentSchedule[matchIndex] = targetMatch;
            return { scheduledMatches: currentSchedule };
        });

        setSelectedPlayerIds([]); // 이동 후 선택 해제
    };

    // 3. X 버튼 클릭 (대기 명단으로 복귀)
    const handleRemoveFromSchedule = async (player) => {
        await updateRoom((data) => {
            const currentSchedule = { ...data.scheduledMatches };
            Object.keys(currentSchedule).forEach(key => {
                currentSchedule[key] = (currentSchedule[key] || []).map(pid => 
                    pid === player.id ? null : pid
                );
            });
            return { scheduledMatches: currentSchedule };
        });
    };

    // 4. 드래그 앤 드롭
    const handleDragStart = (e, pid) => {
        e.dataTransfer.setData("pid", pid);
        setDraggedPlayerId(pid);
    };

    const handleDrop = async (e, targetType, matchIdx, slotIdx) => {
        e.preventDefault();
        const pid = e.dataTransfer.getData("pid");
        if (!pid || !isAdmin) return;

        await updateRoom((data) => {
            const currentSchedule = { ...data.scheduledMatches };
            
            // 기존 위치에서 제거
            Object.keys(currentSchedule).forEach(key => {
                currentSchedule[key] = (currentSchedule[key] || []).map(p => p === pid ? null : p);
            });

            if (targetType === 'slot') {
                const targetMatch = [...(currentSchedule[matchIdx] || Array(PLAYERS_PER_MATCH).fill(null))];
                if (targetMatch[slotIdx] === null) {
                    targetMatch[slotIdx] = pid;
                    currentSchedule[matchIdx] = targetMatch;
                }
            }
            return { scheduledMatches: currentSchedule };
        });
        setDraggedPlayerId(null);
    };

    // 5. 경기 시작
    const handleStartMatch = async (matchIdx) => {
        if (!isAdmin) return;
        await updateRoom((data) => {
            const matchPlayers = data.scheduledMatches[matchIdx];
            if (!matchPlayers || matchPlayers.includes(null)) return null; // 인원 부족

            const emptyCourtIdx = (data.inProgressCourts || []).findIndex(c => c === null);
            if (emptyCourtIdx === -1) {
                alert("빈 코트가 없습니다.");
                return null;
            }

            // 스케줄 당기기 로직 (선택 사항)
            const newSched = { ...data.scheduledMatches };
            delete newSched[matchIdx]; // 현재 매치 삭제
            // 키 재정렬은 생략하거나 필요 시 구현

            const newCourts = [...(data.inProgressCourts || [])];
            newCourts[emptyCourtIdx] = {
                players: matchPlayers,
                startTime: new Date().toISOString()
            };

            return {
                scheduledMatches: newSched,
                inProgressCourts: newCourts
            };
        });
    };

    // 6. 경기 종료
    const handleEndMatch = async (courtIdx) => {
        if(!isAdmin) return;
        if(!confirm("경기를 종료하시겠습니까?")) return;

        const court = roomData.inProgressCourts[courtIdx];
        const batch = writeBatch(db);
        court.players.forEach(pid => {
            if(players[pid]) {
                batch.update(doc(db, "rooms", roomId, "players", pid), {
                    todayGames: (players[pid].todayGames || 0) + 1
                });
            }
        });
        await batch.commit();

        await updateRoom((data) => {
            const newCourts = [...data.inProgressCourts];
            newCourts[courtIdx] = null;
            return { inProgressCourts: newCourts };
        });
    };

    // 방 설정 저장
    const handleSettingsSave = async (newSettings) => {
        await updateDoc(doc(db, "rooms", roomId), {
            name: newSettings.name,
            description: newSettings.description,
            location: newSettings.location,
            password: newSettings.password,
            admins: newSettings.admins
        });
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

    // 대기 명단 정렬
    const waitingList = Object.values(players).filter(p => {
        // 경기 중이거나 스케줄에 있는 선수는 제외
        const inGame = (roomData.inProgressCourts || []).some(c => c && c.players.includes(p.id));
        const inSchedule = Object.values(roomData.scheduledMatches || {}).some(m => m && m.includes(p.id));
        return !inGame && !inSchedule;
    }).sort((a,b) => (LEVEL_ORDER[a.level]||99) - (LEVEL_ORDER[b.level]||99));

    const maleWaiting = waitingList.filter(p => p.gender === '남');
    const femaleWaiting = waitingList.filter(p => p.gender !== '남');

    return (
        <div className="flex flex-col h-full bg-gray-50">
            {/* 상단 헤더 */}
            <header className="flex-shrink-0 bg-white p-3 border-b flex justify-between items-center sticky top-0 z-30 shadow-sm">
                <div className="flex items-center gap-2">
                    <button onClick={onExitRoom}><ArrowLeft className="text-gray-600" /></button>
                    <div>
                        <h1 className="font-bold text-lg leading-tight">{roomData.name}</h1>
                        <p className="text-xs text-gray-500">{roomData.location}</p>
                    </div>
                </div>
                {/* [신규] 관리자에게만 보이는 설정 버튼 */}
                <div className="flex items-center gap-2">
                    <div className="text-right">
                         <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-bold">
                            {isAdmin ? '관리자' : '게스트'}
                         </span>
                         <p className="text-[10px] text-gray-400">{Object.keys(players).length}명 참여중</p>
                    </div>
                    {isAdmin && (
                        <button onClick={() => setIsSettingsOpen(true)} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors">
                            <Settings size={20} className="text-gray-600" />
                        </button>
                    )}
                </div>
            </header>

            <main className="flex-grow overflow-y-auto p-3 space-y-4">
                {/* 1. 대기 명단 */}
                <section className="bg-white p-3 rounded-xl shadow-sm border border-gray-100">
                    <h2 className="text-sm font-bold mb-2 flex justify-between text-gray-700">
                        <span>대기 명단</span>
                        <span className="text-[#00B16A]">{waitingList.length}명</span>
                    </h2>
                    
                    {/* 드롭 영역 (복귀용) */}
                    <div 
                        onDragOver={e => e.preventDefault()} 
                        onDrop={e => handleDrop(e, 'waiting')}
                        className="space-y-3 min-h-[50px]"
                    >
                        <div className="grid grid-cols-5 gap-1.5">
                            {maleWaiting.map(p => (
                                <PlayerCard 
                                    key={p.id} player={p} isAdmin={isAdmin} isCurrentUser={user.uid === p.id}
                                    isSelected={selectedPlayerIds.includes(p.id)}
                                    onCardClick={handleCardClick}
                                    onDragStart={handleDragStart}
                                />
                            ))}
                        </div>
                        {femaleWaiting.length > 0 && <hr className="border-dashed" />}
                        <div className="grid grid-cols-5 gap-1.5">
                            {femaleWaiting.map(p => (
                                <PlayerCard 
                                    key={p.id} player={p} isAdmin={isAdmin} isCurrentUser={user.uid === p.id}
                                    isSelected={selectedPlayerIds.includes(p.id)}
                                    onCardClick={handleCardClick}
                                    onDragStart={handleDragStart}
                                />
                            ))}
                        </div>
                    </div>
                </section>

                {/* 2. 경기 예정 */}
                <section className="space-y-2">
                    <h2 className="text-sm font-bold text-gray-700 px-1">경기 예정</h2>
                    {Array.from({ length: roomData.numScheduledMatches || 4 }).map((_, mIdx) => {
                        const match = roomData.scheduledMatches?.[mIdx] || Array(PLAYERS_PER_MATCH).fill(null);
                        const isFull = match.every(p => p !== null);

                        return (
                            <div key={mIdx} className="bg-white p-2 rounded-xl shadow-sm border flex gap-2 items-center">
                                <span className="text-lg font-black text-gray-300 w-6 text-center">{mIdx + 1}</span>
                                <div className="grid grid-cols-4 gap-1.5 flex-1">
                                    {match.map((pid, sIdx) => pid ? (
                                        <PlayerCard 
                                            key={pid} player={players[pid]} isAdmin={isAdmin}
                                            isSelected={selectedPlayerIds.includes(pid)}
                                            onCardClick={handleCardClick}
                                            onDeleteClick={handleRemoveFromSchedule} // 스케줄에서 제거 핸들러
                                            onDragStart={handleDragStart}
                                        />
                                    ) : (
                                        <EmptySlot 
                                            key={sIdx} 
                                            onClick={() => handleSlotClick(mIdx, sIdx)}
                                            onDragOver={e => e.preventDefault()}
                                            onDrop={e => handleDrop(e, 'slot', mIdx, sIdx)}
                                        />
                                    ))}
                                </div>
                                <button 
                                    onClick={() => handleStartMatch(mIdx)}
                                    disabled={!isFull}
                                    className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-white transition-all ${isFull ? 'bg-[#00B16A] shadow-lg scale-105' : 'bg-gray-200'}`}
                                >
                                    <ChevronRight />
                                </button>
                            </div>
                        );
                    })}
                </section>

                {/* 3. 경기 진행 */}
                <section className="space-y-2">
                    <h2 className="text-sm font-bold text-red-500 px-1">경기 진행</h2>
                    {Array.from({ length: roomData.numInProgressCourts || 2 }).map((_, cIdx) => {
                        const court = roomData.inProgressCourts?.[cIdx];
                        return (
                            <div key={cIdx} className={`p-2 rounded-xl border-2 ${court ? 'bg-white border-green-100' : 'bg-gray-100 border-dashed border-gray-200'}`}>
                                <div className="flex justify-between items-center mb-2 px-1">
                                    <span className="font-bold text-xs text-gray-500">{cIdx + 1}번 코트</span>
                                    {court && (
                                        <div className="flex items-center gap-2">
                                            <CourtTimer startTime={court.startTime} />
                                            {isAdmin && <button onClick={() => handleEndMatch(cIdx)} className="bg-red-50 text-red-500 text-xs px-2 py-1 rounded font-bold">종료</button>}
                                        </div>
                                    )}
                                </div>
                                <div className="grid grid-cols-4 gap-1.5">
                                    {court ? court.players.map((pid, i) => (
                                        players[pid] ? <PlayerCard key={i} player={players[pid]} isPlaying={true} /> : <div key={i} className="bg-gray-100 rounded h-12"/>
                                    )) : (
                                        <div className="col-span-4 h-12 flex items-center justify-center text-gray-300 text-xs">비어있음</div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </section>
            </main>
            
            <RoomSettingsModal 
                isOpen={isSettingsOpen} 
                onClose={() => setIsSettingsOpen(false)} 
                roomData={roomData}
                onSave={handleSettingsSave}
                onDeleteRoom={handleDeleteRoom}
                user={user}
                admins={roomData.admins}
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
