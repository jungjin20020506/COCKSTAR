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
    updateProfile
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
    updateDoc, 
    deleteDoc, 
    runTransaction, 
    writeBatch
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
    Settings as SettingsIcon,
    Trash2 as Trash2Icon,
    UserMinus as UserMinusIcon,
    UserPlus as UserPlusIcon
} from 'lucide-react';

// ===================================================================================
// 1. 아이콘 헬퍼
// ===================================================================================
const createThinIcon = (IconComponent) => (props) => <IconComponent {...props} strokeWidth={1.5} />;

const Home = createThinIcon(HomeIcon);
const Trophy = createThinIcon(TrophyIcon);
const Store = createThinIcon(StoreIcon);
const Users = createThinIcon(UsersIcon);
const User = createThinIcon(UserIcon);
const X = createThinIcon(XIcon);
const Loader2 = createThinIcon(Loader2Icon);
const ArrowLeft = createThinIcon(ArrowLeftIcon);
const ShieldCheck = createThinIcon(ShieldCheckIcon);
const Search = createThinIcon(SearchIcon);
const Bell = createThinIcon(BellIcon);
const MapPin = createThinIcon(MapPinIcon);
const Heart = createThinIcon(HeartIcon);
const ChevronRight = createThinIcon(ChevronRightIcon);
const Plus = createThinIcon(PlusIcon);
const Archive = createThinIcon(ArchiveIcon);
const Lock = createThinIcon(LockIcon);
const Settings = createThinIcon(SettingsIcon);
const Trash2 = createThinIcon(Trash2Icon);

// ===================================================================================
// 2. 설정 및 상수 (이전 앱 데이터 연동)
// ===================================================================================
// [중요] 이전 앱과 동일한 Firebase Config 사용
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

const SUPER_ADMIN_USERNAMES = ["jung22459369", "domain"];
const PLAYERS_PER_MATCH = 4;
const LEVEL_ORDER = { 'S조': 1, 'A조': 2, 'B조': 3, 'C조': 4, 'D조': 5, 'E조': 6, 'N조': 7, '미설정': 8 };

const getLevelColor = (level) => {
    switch (level) {
        case 'S조': return 'border-sky-400 text-sky-500';
        case 'A조': return 'border-red-500 text-red-600';
        case 'B조': return 'border-orange-500 text-orange-600';
        case 'C조': return 'border-yellow-500 text-yellow-600';
        case 'D조': return 'border-green-500 text-green-600';
        case 'E조': return 'border-blue-500 text-blue-600'; // E조 추가
        default: return 'border-gray-400 text-gray-500';
    }
};

// ===================================================================================
// 3. 공용 UI 컴포넌트
// ===================================================================================
function LoadingSpinner({ text = "로딩 중..." }) {
    return (
        <div className="flex flex-col items-center justify-center h-full text-[#1E1E1E]">
            <Loader2 className="w-10 h-10 animate-spin text-[#00B16A]" />
            <span className="mt-4 text-base font-semibold">{text}</span>
        </div>
    );
}

function EmptyState({ icon: Icon, title, description, buttonText, onButtonClick }) {
    return (
        <div className="flex flex-col items-center justify-center text-center text-gray-500 p-8 bg-gray-50 rounded-xl">
            <Icon className="w-16 h-16 mb-4 text-gray-400" />
            <h3 className="text-lg font-semibold text-[#1E1E1E] mb-2">{title}</h3>
            <p className="text-sm mb-6">{description}</p>
            {buttonText && onButtonClick && (
                <button onClick={onButtonClick} className="px-6 py-2 bg-[#00B16A] text-white text-sm font-bold rounded-lg shadow-md hover:bg-green-700 transition-colors">
                    {buttonText}
                </button>
            )}
        </div>
    );
}

// [수정] 선수 카드 (초소형, 모션 강화)
const PlayerCard = React.memo(({ 
    player, 
    context, // 'waiting', 'schedule', 'court'
    isAdmin, 
    isCurrentUser, 
    isSelected, 
    onCardClick, 
    onRemoveFromSchedule 
}) => {
    if (!player) return <div className="h-10 bg-gray-100 rounded-lg animate-pulse w-full"></div>;

    const levelColorClass = getLevelColor(player.level);
    const isWaiting = context === 'waiting';
    const isSchedule = context === 'schedule';

    // 스타일 클래스 조합
    let containerClass = `relative bg-white rounded-lg shadow-sm flex items-center justify-between px-2 h-10 w-full border border-gray-100 transition-all duration-200 cursor-pointer select-none `;
    
    // 성별 표시 (왼쪽 보더)
    containerClass += player.gender === '남' ? 'border-l-4 border-l-blue-500 ' : 'border-l-4 border-l-pink-500 ';

    // 상태별 스타일
    if (player.isResting) containerClass += " opacity-50 grayscale bg-gray-50 ";
    
    // [핵심] 선택 시 모션 및 디자인 (고급스러운 금색 링 + 확대)
    if (isSelected) {
        containerClass += " ring-2 ring-[#FFD700] ring-offset-1 transform scale-105 z-10 shadow-md ";
    } else if (isCurrentUser) {
        containerClass += " ring-1 ring-[#00B16A] ring-offset-0 "; // 본인은 은은한 초록
    } else {
        containerClass += " hover:shadow-md hover:scale-[1.02] "; // 일반 호버 효과
    }

    return (
        <div className={containerClass} onClick={() => onCardClick(player)}>
            {/* 왼쪽: 이름 및 관리자 아이콘 */}
            <div className="flex items-center gap-1 min-w-0 overflow-hidden">
                {(SUPER_ADMIN_USERNAMES.includes(player.username) || player.role === 'admin') && (
                    <span className="text-[10px]">👑</span>
                )}
                <span className="text-xs font-bold text-[#1E1E1E] truncate leading-tight">
                    {player.name}
                </span>
            </div>

            {/* 오른쪽: 급수 및 게임 수 */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
                <span className={`text-[10px] font-extrabold ${levelColorClass.replace('border-', 'text-')}`}>
                    {player.level ? player.level.replace('조', '') : 'N'}
                </span>
                <span className="text-[9px] text-gray-400 font-medium bg-gray-100 px-1 rounded">
                    {player.todayGames || 0}G
                </span>
            </div>

            {/* [신규] 스케줄에서 삭제 버튼 (카드 우측 상단 오버레이 아님, 별도 공간 확보 혹은 오버레이) */}
            {isSchedule && (isAdmin || isCurrentUser) && (
                <button 
                    onClick={(e) => { e.stopPropagation(); onRemoveFromSchedule(player); }}
                    className="absolute -top-1.5 -right-1.5 bg-white text-gray-400 hover:text-red-500 rounded-full shadow border border-gray-200 p-0.5 z-20"
                >
                    <X size={10} strokeWidth={3} />
                </button>
            )}
        </div>
    );
});

// 빈 슬롯 (클릭하여 이동 대상 지정)
const EmptySlot = ({ onClick, isActive }) => (
    <div 
        onClick={onClick}
        className={`h-10 rounded-lg flex items-center justify-center border border-dashed transition-all cursor-pointer ${
            isActive 
            ? 'bg-green-50 border-[#00B16A] text-[#00B16A] shadow-inner' // 이동 가능 상태
            : 'bg-gray-50 border-gray-300 text-gray-300 hover:bg-white hover:border-gray-400'
        }`}
    >
        <Plus size={14} />
    </div>
);

// 타이머 컴포넌트
const CourtTimer = ({ startTime }) => {
    const [elapsed, setElapsed] = useState("00:00");
    useEffect(() => {
        if (!startTime) return;
        const interval = setInterval(() => {
            const start = new Date(startTime).getTime();
            const now = new Date().getTime();
            const diff = Math.floor((now - start) / 1000);
            const m = Math.floor(diff / 60).toString().padStart(2, '0');
            const s = (diff % 60).toString().padStart(2, '0');
            setElapsed(`${m}:${s}`);
        }, 1000);
        return () => clearInterval(interval);
    }, [startTime]);
    return <span className="text-xs font-mono font-bold text-[#00B16A] bg-green-50 px-1.5 py-0.5 rounded">{elapsed}</span>;
};


// ===================================================================================
// 4. 모달 컴포넌트 (로그인, 방생성/설정)
// ===================================================================================

function AuthModal({ onClose, setPage }) {
    const [isLoginMode, setIsLoginMode] = useState(true);
    const [userId, setUserId] = useState(''); // 이메일 대신 아이디 입력
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // [중요] 아이디로 이메일 생성
    const getEmailFromId = (id) => {
        if(id.includes('@')) return id; // 이미 이메일 형식이면 그대로
        return `${id}@cockstar.app`;
    };

    const handleAuth = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const email = getEmailFromId(userId);
            if (isLoginMode) {
                await signInWithEmailAndPassword(auth, email, password);
            } else {
                // 회원가입
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;
                // Firestore에 추가 정보 저장 (이전 앱 구조 호환)
                await setDoc(doc(db, "users", user.uid), {
                    name: name,
                    username: userId, // 아이디 저장
                    email: email,
                    phone: phone,
                    level: 'S조', // 기본값
                    gender: '남', // 기본값
                    birthYear: '2000',
                    createdAt: serverTimestamp()
                });
            }
            onClose();
        } catch (err) {
            console.error(err);
            if (err.code === 'auth/invalid-email') setError('아이디 형식이 올바르지 않습니다.');
            else if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') setError('아이디 또는 비밀번호가 잘못되었습니다.');
            else if (err.code === 'auth/email-already-in-use') setError('이미 사용 중인 아이디입니다.');
            else setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl p-8 w-full max-w-md relative shadow-2xl">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-black"><X size={24} /></button>
                <h2 className="text-2xl font-bold text-center mb-6 text-[#1E1E1E]">
                    {isLoginMode ? '콕스타 로그인' : '회원가입'}
                </h2>
                {error && <p className="text-red-500 text-sm text-center mb-4 bg-red-50 p-2 rounded">{error}</p>}
                
                <form onSubmit={handleAuth} className="space-y-3">
                    {!isLoginMode && (
                        <>
                            <input type="text" placeholder="이름 (실명)" value={name} onChange={e => setName(e.target.value)} className="w-full p-3 bg-gray-50 rounded-lg border focus:border-[#00B16A] outline-none" required />
                            <input type="tel" placeholder="전화번호 (010...)" value={phone} onChange={e => setPhone(e.target.value)} className="w-full p-3 bg-gray-50 rounded-lg border focus:border-[#00B16A] outline-none" required />
                        </>
                    )}
                    <input type="text" placeholder="아이디" value={userId} onChange={e => setUserId(e.target.value)} className="w-full p-3 bg-gray-50 rounded-lg border focus:border-[#00B16A] outline-none" required />
                    <input type="password" placeholder="비밀번호" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-3 bg-gray-50 rounded-lg border focus:border-[#00B16A] outline-none" required />
                    
                    <button type="submit" disabled={loading} className="w-full py-4 bg-[#00B16A] text-white font-bold rounded-xl shadow-lg hover:bg-green-700 transition-all flex justify-center">
                        {loading ? <Loader2 className="animate-spin" /> : (isLoginMode ? '로그인' : '가입하기')}
                    </button>
                </form>
                <div className="mt-4 text-center">
                    <button onClick={() => setIsLoginMode(!isLoginMode)} className="text-sm text-gray-500 hover:text-[#00B16A] font-medium">
                        {isLoginMode ? '계정이 없으신가요? 회원가입' : '이미 계정이 있으신가요? 로그인'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// [수정] 방 생성 및 설정 모달 (관리자 기능 포함)
function RoomSettingsModal({ isOpen, onClose, roomData, onSubmit, onDelete, isEditMode, currentUserUsername }) {
    const [formData, setFormData] = useState({
        name: '', description: '', location: '', password: '', usePassword: false, admins: []
    });
    const [newAdminId, setNewAdminId] = useState('');

    useEffect(() => {
        if (isOpen) {
            if (isEditMode && roomData) {
                setFormData({
                    name: roomData.name || '',
                    description: roomData.description || '',
                    location: roomData.location || '',
                    password: roomData.password || '',
                    usePassword: !!roomData.password,
                    admins: roomData.admins || []
                });
            } else {
                setFormData({ name: '', description: '', location: '', password: '', usePassword: false, admins: [currentUserUsername] });
            }
        }
    }, [isOpen, roomData, isEditMode, currentUserUsername]);

    if (!isOpen) return null;

    const handleSubmit = () => {
        const dataToSave = {
            ...formData,
            password: formData.usePassword ? formData.password : '',
            admins: formData.admins.filter(a => a.trim() !== '')
        };
        onSubmit(dataToSave);
    };

    const handleAddAdmin = () => {
        if (newAdminId.trim() && !formData.admins.includes(newAdminId.trim())) {
            setFormData(prev => ({ ...prev, admins: [...prev.admins, newAdminId.trim()] }));
            setNewAdminId('');
        }
    };

    const handleRemoveAdmin = (adminToRemove) => {
        setFormData(prev => ({ ...prev, admins: prev.admins.filter(a => a !== adminToRemove) }));
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-[#1E1E1E]">{isEditMode ? '방 설정 수정' : '새 모임방 만들기'}</h2>
                    <button onClick={onClose}><X size={24} className="text-gray-400" /></button>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">방 이름</label>
                        <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-3 bg-gray-50 rounded-lg border focus:border-[#00B16A] outline-none" />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">모임 소개</label>
                        <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full p-3 bg-gray-50 rounded-lg border focus:border-[#00B16A] outline-none" rows={3} />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">장소</label>
                        <input type="text" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} className="w-full p-3 bg-gray-50 rounded-lg border focus:border-[#00B16A] outline-none" />
                    </div>
                    
                    {/* 비밀번호 설정 */}
                    <div className="p-3 bg-gray-50 rounded-lg">
                        <label className="flex items-center gap-2 mb-2 cursor-pointer">
                            <input type="checkbox" checked={formData.usePassword} onChange={e => setFormData({...formData, usePassword: e.target.checked})} className="accent-[#00B16A]" />
                            <span className="text-sm font-bold text-gray-700">비밀번호 사용</span>
                        </label>
                        {formData.usePassword && (
                            <input type="text" placeholder="비밀번호 입력" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full p-2 bg-white rounded border focus:border-[#00B16A] outline-none text-sm" />
                        )}
                    </div>

                    {/* 관리자 관리 */}
                    <div className="p-3 bg-gray-50 rounded-lg">
                        <label className="block text-sm font-bold text-gray-700 mb-2">관리자 관리</label>
                        <div className="flex gap-2 mb-2">
                            <input type="text" placeholder="아이디 입력" value={newAdminId} onChange={e => setNewAdminId(e.target.value)} className="flex-1 p-2 bg-white rounded border text-sm" />
                            <button onClick={handleAddAdmin} className="bg-[#1E1E1E] text-white px-3 rounded text-sm font-bold">추가</button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {formData.admins.map(admin => (
                                <span key={admin} className="px-2 py-1 bg-white border rounded text-xs flex items-center gap-1">
                                    {admin}
                                    <button onClick={() => handleRemoveAdmin(admin)} className="text-red-500"><X size={10}/></button>
                                </span>
                            ))}
                        </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                        {isEditMode && onDelete && (
                            <button onClick={onDelete} className="flex-1 py-3 bg-red-100 text-red-500 font-bold rounded-xl hover:bg-red-200">
                                방 삭제
                            </button>
                        )}
                        <button onClick={handleSubmit} className="flex-[2] py-3 bg-[#00B16A] text-white font-bold rounded-xl hover:bg-green-700 shadow-lg">
                            {isEditMode ? '저장하기' : '만들기'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ===================================================================================
// 5. 페이지 컴포넌트
// ===================================================================================

// 경기방 내부 (핵심 로직 개선)
function GameRoomView({ roomId, user, userData, onExitRoom }) {
    const [roomData, setRoomData] = useState(null);
    const [players, setPlayers] = useState({});
    
    // [상태] 선택된 선수 ID (이동의 주체)
    const [selectedPlayerId, setSelectedPlayerId] = useState(null);
    
    // 모달 상태
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    
    const roomRef = doc(db, "rooms", roomId);
    const playersRef = collection(db, "rooms", roomId, "players");

    // 관리자 여부 확인
    const isSuperAdmin = useMemo(() => userData && SUPER_ADMIN_USERNAMES.includes(userData.username), [userData]);
    const isRoomAdmin = useMemo(() => {
        if (!roomData || !userData) return false;
        return isSuperAdmin || (roomData.admins || []).includes(userData.username) || roomData.createdBy === user.uid;
    }, [roomData, userData, isSuperAdmin, user.uid]);

    // 데이터 구독
    useEffect(() => {
        const unsubRoom = onSnapshot(roomRef, (doc) => {
            if (doc.exists()) setRoomData({ id: doc.id, ...doc.data() });
            else { alert("방이 삭제되었습니다."); onExitRoom(); }
        });
        const unsubPlayers = onSnapshot(playersRef, (snapshot) => {
            const pMap = {};
            snapshot.forEach(d => pMap[d.id] = { id: d.id, ...d.data() });
            setPlayers(pMap);
        });
        return () => { unsubRoom(); unsubPlayers(); };
    }, [roomId]);

    // 내 정보 자동 등록 (입장 시)
    useEffect(() => {
        if (userData) {
            const myRef = doc(playersRef, user.uid);
            getDoc(myRef).then(snap => {
                if (!snap.exists()) {
                    setDoc(myRef, {
                        ...userData,
                        todayGames: 0,
                        isResting: false,
                        entryTime: serverTimestamp()
                    });
                }
            });
        }
    }, [userData]);

    // ================= [액션 핸들러] =================

    // 1. 선수 선택 (토글)
    const handlePlayerClick = useCallback((player) => {
        // 권한 체크: 관리자거나 본인인 경우(개인모드 고려, 일단 관리자 위주)
        if (!isRoomAdmin && player.id !== user.uid) return;

        setSelectedPlayerId(prev => prev === player.id ? null : player.id);
    }, [isRoomAdmin, user.uid]);

    // 2. 슬롯 클릭 (이동/배치)
    const handleSlotClick = async (targetLocation) => {
        if (!selectedPlayerId) return; // 선택된 선수가 없으면 무시
        if (!isRoomAdmin) {
             alert("경기 배치는 관리자만 가능합니다.");
             return;
        }

        const { matchIndex, slotIndex } = targetLocation;
        
        try {
            await runTransaction(db, async (t) => {
                const roomDoc = await t.get(roomRef);
                const data = roomDoc.data();
                
                // 기존 위치 찾기 (스케줄 전체 검색)
                let sourceLocation = null;
                Object.keys(data.scheduledMatches || {}).forEach(mIdx => {
                    const match = data.scheduledMatches[mIdx];
                    if (match) {
                        const sIdx = match.indexOf(selectedPlayerId);
                        if (sIdx !== -1) sourceLocation = { matchIndex: mIdx, slotIndex: sIdx };
                    }
                });

                // 기존 위치에서 제거
                if (sourceLocation) {
                    data.scheduledMatches[sourceLocation.matchIndex][sourceLocation.slotIndex] = null;
                }

                // 새 위치에 배치
                const targetMatch = data.scheduledMatches[matchIndex] || Array(PLAYERS_PER_MATCH).fill(null);
                
                // 만약 타겟 위치에 이미 누가 있다면? (교체 로직은 복잡하므로 일단 막거나, 덮어쓰기)
                // 여기서는 '빈 슬롯' 클릭이므로 덮어쓰기(이동) 처리
                if (targetMatch[slotIndex] !== null) {
                    throw new Error("이미 선수가 있는 자리입니다.");
                }
                
                targetMatch[slotIndex] = selectedPlayerId;
                
                // 데이터 업데이트
                const updates = { [`scheduledMatches.${matchIndex}`]: targetMatch };
                if (sourceLocation) {
                     updates[`scheduledMatches.${sourceLocation.matchIndex}`] = data.scheduledMatches[sourceLocation.matchIndex];
                }
                
                t.update(roomRef, updates);
            });
            
            // 이동 성공 후 선택 해제
            setSelectedPlayerId(null);
            
        } catch (e) {
            console.error(e);
            alert(e.message);
        }
    };

    // 3. 스케줄에서 제거
    const handleRemoveFromSchedule = async (player) => {
        if (!isRoomAdmin) return;
        // 트랜잭션으로 안전하게 제거
         await runTransaction(db, async (t) => {
            const roomDoc = await t.get(roomRef);
            const data = roomDoc.data();
            let found = false;
            
            Object.keys(data.scheduledMatches || {}).forEach(mIdx => {
                const match = data.scheduledMatches[mIdx] || [];
                const sIdx = match.indexOf(player.id);
                if (sIdx !== -1) {
                    match[sIdx] = null;
                    t.update(roomRef, { [`scheduledMatches.${mIdx}`]: match });
                    found = true;
                }
            });
         });
         if (selectedPlayerId === player.id) setSelectedPlayerId(null);
    };
    
    // 4. 경기 시작/종료 로직 (이전 앱과 동일하게)
    const handleStartMatch = async (matchIndex) => {
        if(!isRoomAdmin) return;
        // 빈 코트 찾기
        const emptyCourtIdx = (roomData.inProgressCourts || []).findIndex(c => !c);
        if (emptyCourtIdx === -1) {
             // 코트가 모자라면 늘려주거나 경고 (이전 앱 로직: 자동 확장 or 경고)
             if ((roomData.inProgressCourts || []).length < roomData.numInProgressCourts) {
                 // 빈 슬롯이 있으면 그 인덱스 사용
             } else {
                 return alert("빈 코트가 없습니다.");
             }
        }
        
        const players = roomData.scheduledMatches[matchIndex];
        if (!players || players.filter(Boolean).length < 4) return alert("선수가 부족합니다.");

        // 스케줄 제거 및 코트 투입
        const updates = {
            [`scheduledMatches.${matchIndex}`]: Array(PLAYERS_PER_MATCH).fill(null), // 해당 스케줄 비우기
            [`inProgressCourts`]: [...(roomData.inProgressCourts || [])] // 배열 복사
        };
        
        // 빈 코트에 할당
        const targetCourtIdx = emptyCourtIdx !== -1 ? emptyCourtIdx : updates.inProgressCourts.length;
        updates.inProgressCourts[targetCourtIdx] = {
            players: players,
            startTime: new Date().toISOString()
        };
        
        await updateDoc(roomRef, updates);
    };

    const handleEndMatch = async (courtIndex) => {
        if(!isRoomAdmin) return;
        if(!confirm("경기를 종료하시겠습니까?")) return;

        const court = roomData.inProgressCourts[courtIndex];
        const batch = writeBatch(db);
        
        // 게임 수 증가
        court.players.forEach(pid => {
            if (pid && players[pid]) {
                batch.update(doc(playersRef, pid), { todayGames: (players[pid].todayGames || 0) + 1 });
            }
        });
        
        await batch.commit();
        
        // 코트 비우기
        const newCourts = [...roomData.inProgressCourts];
        newCourts[courtIndex] = null;
        await updateDoc(roomRef, { inProgressCourts: newCourts });
    };

    // 5. 방 설정 저장
    const handleSettingsSave = async (data) => {
        await updateDoc(roomRef, data);
        setIsSettingsOpen(false);
    };
    
    const handleDeleteRoom = async () => {
        if(confirm("정말 방을 삭제하시겠습니까?")) {
            await deleteDoc(roomRef);
            onExitRoom();
        }
    };


    if (!roomData) return <LoadingSpinner text="경기장 입장 중..." />;

    // 분류
    const scheduledPlayerIds = new Set(Object.values(roomData.scheduledMatches || {}).flat().filter(Boolean));
    const playingPlayerIds = new Set((roomData.inProgressCourts || []).filter(Boolean).flatMap(c => c.players).filter(Boolean));
    
    const waitingList = Object.values(players)
        .filter(p => !scheduledPlayerIds.has(p.id) && !playingPlayerIds.has(p.id))
        .sort((a,b) => (a.entryTime?.seconds || 0) - (b.entryTime?.seconds || 0));

    const maleWaiting = waitingList.filter(p => p.gender === '남');
    const femaleWaiting = waitingList.filter(p => p.gender !== '남');

    return (
        <div className="flex flex-col h-full bg-gray-50">
            {/* 헤더 */}
            <header className="px-4 py-3 bg-white border-b border-gray-200 flex justify-between items-center sticky top-0 z-30 shadow-sm">
                <div className="flex items-center gap-3">
                    <button onClick={onExitRoom} className="text-gray-500 hover:text-black"><ArrowLeftIcon size={24}/></button>
                    <div>
                        <h1 className="text-lg font-bold text-[#1E1E1E] leading-tight">{roomData.name}</h1>
                        <p className="text-xs text-gray-500 flex items-center gap-1">
                            <MapPinIcon size={10} /> {roomData.location || '장소 미정'}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {/* [관리자 전용] 설정 버튼 */}
                    {isRoomAdmin && (
                        <button onClick={() => setIsSettingsOpen(true)} className="p-2 bg-gray-100 rounded-full text-gray-600 hover:bg-gray-200 transition-colors">
                            <SettingsIcon size={20} />
                        </button>
                    )}
                    <span className="text-xs font-bold bg-[#00B16A]/10 text-[#00B16A] px-2 py-1 rounded-full">
                        {Object.keys(players).length}명
                    </span>
                </div>
            </header>

            <main className="flex-grow overflow-y-auto p-3 space-y-4 pb-20">
                {/* 1. 대기 명단 (2단 그리드 - 남/여) */}
                <section className="bg-white p-3 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex justify-between items-center mb-3">
                        <h2 className="text-sm font-bold text-gray-800">대기 명단 <span className="text-[#00B16A]">{waitingList.length}</span></h2>
                        {/* 퀵 필터 버튼 등 추가 가능 */}
                    </div>
                    
                    <div className="space-y-3">
                        {/* 남성 */}
                        <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                            {maleWaiting.map(p => (
                                <PlayerCard 
                                    key={p.id} 
                                    player={p} 
                                    context="waiting"
                                    isAdmin={isRoomAdmin}
                                    isCurrentUser={user.uid === p.id}
                                    isSelected={selectedPlayerId === p.id}
                                    onCardClick={handlePlayerClick}
                                />
                            ))}
                        </div>
                        {/* 구분선 (둘 다 있을 때만) */}
                        {maleWaiting.length > 0 && femaleWaiting.length > 0 && <div className="border-t border-gray-100"></div>}
                        {/* 여성 */}
                        <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                            {femaleWaiting.map(p => (
                                <PlayerCard 
                                    key={p.id} 
                                    player={p} 
                                    context="waiting"
                                    isAdmin={isRoomAdmin}
                                    isCurrentUser={user.uid === p.id}
                                    isSelected={selectedPlayerId === p.id}
                                    onCardClick={handlePlayerClick}
                                />
                            ))}
                        </div>
                        {waitingList.length === 0 && <p className="text-center text-xs text-gray-400 py-2">대기 중인 선수가 없습니다.</p>}
                    </div>
                </section>

                {/* 2. 경기 예정 (매칭 테이블) */}
                <section className="space-y-2">
                    <h2 className="text-sm font-bold text-gray-800 px-1">경기 예정</h2>
                    {Array.from({ length: roomData.numScheduledMatches || 4 }).map((_, mIdx) => {
                        const matchPlayers = roomData.scheduledMatches?.[mIdx] || Array(4).fill(null);
                        const isReady = matchPlayers.filter(Boolean).length === 4;

                        return (
                            <div key={mIdx} className="bg-white p-2 rounded-xl shadow-sm border border-gray-200 flex gap-2">
                                {/* 매치 번호 */}
                                <div className="flex flex-col justify-center items-center w-8 bg-gray-50 rounded-lg">
                                    <span className="text-[10px] text-gray-400 font-bold">M</span>
                                    <span className="text-lg font-black text-gray-700">{mIdx + 1}</span>
                                </div>
                                
                                {/* 슬롯 그리드 */}
                                <div className="grid grid-cols-4 gap-1.5 flex-1">
                                    {matchPlayers.map((pid, sIdx) => (
                                        pid ? (
                                            <PlayerCard 
                                                key={pid} 
                                                player={players[pid]} 
                                                context="schedule"
                                                isAdmin={isRoomAdmin}
                                                isCurrentUser={user.uid === pid}
                                                isSelected={selectedPlayerId === pid}
                                                onCardClick={handlePlayerClick}
                                                onRemoveFromSchedule={handleRemoveFromSchedule}
                                            />
                                        ) : (
                                            <EmptySlot 
                                                key={sIdx} 
                                                onClick={() => handleSlotClick({ matchIndex: mIdx, slotIndex: sIdx })}
                                                isActive={!!selectedPlayerId} // 선택된 선수가 있으면 활성화 표시
                                            />
                                        )
                                    ))}
                                </div>
                                
                                {/* 시작 버튼 (관리자용) */}
                                {isRoomAdmin && (
                                    <button 
                                        onClick={() => handleStartMatch(mIdx)}
                                        disabled={!isReady}
                                        className={`w-8 rounded-lg flex items-center justify-center transition-all ${
                                            isReady ? 'bg-[#00B16A] text-white shadow-md hover:scale-105' : 'bg-gray-100 text-gray-300'
                                        }`}
                                    >
                                        <ChevronRightIcon size={20} strokeWidth={3} />
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </section>

                {/* 3. 경기 진행 (코트) */}
                <section className="space-y-2">
                    <h2 className="text-sm font-bold text-red-500 px-1">경기 진행</h2>
                    <div className="grid grid-cols-1 gap-3">
                         {(roomData.inProgressCourts || []).map((court, cIdx) => (
                             court ? (
                                <div key={cIdx} className="bg-white rounded-xl shadow border-l-4 border-l-[#00B16A] overflow-hidden">
                                    <div className="bg-gray-50 px-3 py-2 flex justify-between items-center border-b border-gray-100">
                                        <span className="text-xs font-bold text-gray-600">COURT {cIdx + 1}</span>
                                        <div className="flex items-center gap-2">
                                            <CourtTimer startTime={court.startTime} />
                                            {isRoomAdmin && (
                                                <button onClick={() => handleEndMatch(cIdx)} className="bg-white border border-red-200 text-red-500 text-[10px] font-bold px-2 py-1 rounded hover:bg-red-50">
                                                    종료
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <div className="p-2 grid grid-cols-4 gap-1.5">
                                        {court.players.map((pid, idx) => (
                                            <PlayerCard key={idx} player={players[pid]} context="court" />
                                        ))}
                                    </div>
                                </div>
                             ) : null // 빈 코트는 숨기거나 흐릿하게 표시
                         ))}
                    </div>
                </section>
            </main>

            <RoomSettingsModal 
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                roomData={roomData}
                onSubmit={handleSettingsSave}
                onDelete={handleDeleteRoom}
                isEditMode={true}
                currentUserUsername={userData.username}
            />
        </div>
    );
}

// 메인 앱 (라우터)
function App() {
    const [user, setUser] = useState(null);
    const [userData, setUserData] = useState(null);
    const [page, setPage] = useState('home'); 
    const [selectedRoomId, setSelectedRoomId] = useState(null);
    const [showAuthModal, setShowAuthModal] = useState(false);
    
    // 로비 관련 상태
    const [rooms, setRooms] = useState([]);
    const [showCreateRoomModal, setShowCreateRoomModal] = useState(false);

    // 인증 리스너
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);
            if (currentUser) {
                const userDoc = await getDoc(doc(db, "users", currentUser.uid));
                if (userDoc.exists()) setUserData({ uid: currentUser.uid, ...userDoc.data() });
            } else {
                setUserData(null);
            }
        });
        return () => unsubscribe();
    }, []);

    // 방 목록 리스너
    useEffect(() => {
        const q = query(collection(db, "rooms"));
        const unsub = onSnapshot(q, (snap) => {
            const list = snap.docs.map(d => ({id: d.id, ...d.data()}));
            // 최신순 정렬 (createdAt)
            list.sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
            setRooms(list);
        });
        return () => unsub();
    }, []);

    const handleCreateRoom = async (roomData) => {
        if (!user) return setShowAuthModal(true);
        try {
            const docRef = await addDoc(collection(db, "rooms"), {
                ...roomData,
                createdBy: user.uid,
                createdAt: serverTimestamp(),
                numScheduledMatches: 4,
                numInProgressCourts: 3,
                playerCount: 0
            });
            setSelectedRoomId(docRef.id);
            setPage('gameRoom');
            setShowCreateRoomModal(false);
        } catch (e) {
            console.error(e);
            alert("방 생성 실패");
        }
    };

    const handleLogout = async () => {
        await signOut(auth);
        setPage('home');
    };

    // 화면 렌더링 스위치
    const renderContent = () => {
        if (page === 'gameRoom' && selectedRoomId) {
            return <GameRoomView roomId={selectedRoomId} user={user} userData={userData} onExitRoom={() => setPage('game')} />;
        }

        switch (page) {
            case 'home':
                return (
                    <div className="p-6">
                        <h2 className="text-2xl font-bold mb-4">홈 (준비중)</h2>
                        <button onClick={() => setPage('game')} className="bg-[#00B16A] text-white px-4 py-2 rounded-lg">경기 입장하기</button>
                    </div>
                );
            case 'game':
                return (
                    <div className="flex flex-col h-full bg-gray-50">
                        <div className="p-4 bg-white border-b sticky top-0 z-10">
                            <h2 className="text-xl font-bold text-[#1E1E1E]">경기 모임</h2>
                        </div>
                        <div className="p-4 space-y-3 flex-grow overflow-y-auto">
                            {rooms.map(room => (
                                <div key={room.id} onClick={() => { setSelectedRoomId(room.id); setPage('gameRoom'); }} 
                                    className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 cursor-pointer hover:border-[#00B16A] transition-all">
                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className="font-bold text-lg text-[#1E1E1E]">{room.name}</h3>
                                        {room.password && <Lock size={16} className="text-gray-400" />}
                                    </div>
                                    <p className="text-sm text-gray-500 mb-2 truncate">{room.description}</p>
                                    <div className="flex gap-2 text-xs font-bold">
                                        <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded flex items-center gap-1">
                                            <MapPinIcon size={12}/> {room.location}
                                        </span>
                                    </div>
                                </div>
                            ))}
                            {rooms.length === 0 && <EmptyState icon={Archive} title="모임이 없습니다" description="새로운 모임을 만들어보세요!" />}
                        </div>
                        <button onClick={() => user ? setShowCreateRoomModal(true) : setShowAuthModal(true)} 
                            className="absolute bottom-24 right-6 w-14 h-14 bg-[#00B16A] rounded-full text-white shadow-lg flex items-center justify-center hover:scale-110 transition-transform">
                            <Plus size={28}/>
                        </button>
                    </div>
                );
            case 'myinfo':
                return (
                    <div className="p-6">
                        {user ? (
                            <div className="text-center">
                                <div className="w-20 h-20 bg-gray-200 rounded-full mx-auto mb-4 flex items-center justify-center text-3xl">👤</div>
                                <h2 className="text-xl font-bold">{userData?.name}</h2>
                                <p className="text-gray-500 mb-6">{userData?.username}</p>
                                <button onClick={handleLogout} className="w-full py-3 bg-red-100 text-red-500 font-bold rounded-xl">로그아웃</button>
                            </div>
                        ) : (
                            <EmptyState icon={User} title="로그인이 필요합니다" buttonText="로그인" onButtonClick={() => setShowAuthModal(true)} />
                        )}
                    </div>
                );
            default: return null;
        }
    };

    return (
        <div className="flex flex-col h-screen bg-white max-w-md mx-auto shadow-2xl overflow-hidden font-sans text-[#1E1E1E] relative">
            {/* 상단 GNB (게임룸에선 안보임) */}
            {page !== 'gameRoom' && (
                <main className="flex-grow overflow-hidden relative">
                    {renderContent()}
                </main>
            )}

            {/* 전체 화면 모드일 때 (게임룸) */}
            {page === 'gameRoom' && renderContent()}

            {/* 하단 탭 (게임룸에선 안보임) */}
            {page !== 'gameRoom' && (
                <nav className="flex justify-around items-center bg-white border-t border-gray-100 pt-2 pb-safe sticky bottom-0 z-20 h-[70px]">
                    <button onClick={() => setPage('home')} className={`flex flex-col items-center w-full ${page === 'home' ? 'text-[#00B16A]' : 'text-gray-400'}`}>
                        <Home size={24} className="mb-1"/> <span className="text-xs font-bold">홈</span>
                    </button>
                    <button onClick={() => setPage('game')} className={`flex flex-col items-center w-full ${page === 'game' ? 'text-[#00B16A]' : 'text-gray-400'}`}>
                        <Trophy size={24} className="mb-1"/> <span className="text-xs font-bold">경기</span>
                    </button>
                    <button onClick={() => setPage('myinfo')} className={`flex flex-col items-center w-full ${page === 'myinfo' ? 'text-[#00B16A]' : 'text-gray-400'}`}>
                        <User size={24} className="mb-1"/> <span className="text-xs font-bold">내 정보</span>
                    </button>
                </nav>
            )}

            {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
            {showCreateRoomModal && (
                <RoomSettingsModal 
                    isOpen={showCreateRoomModal} 
                    onClose={() => setShowCreateRoomModal(false)} 
                    onSubmit={handleCreateRoom}
                    currentUserUsername={userData?.username}
                />
            )}
        </div>
    );
}

export default App;
