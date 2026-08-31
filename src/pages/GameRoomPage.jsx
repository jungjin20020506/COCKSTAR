import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../components/ui/confirm';
import { useGameRoom } from '../features/room/useGameRoom';
import { usePresence } from '../lib/presence';
import { useTutorial } from '../features/tutorial/useTutorial';
import { ROOM_ADMIN_GUIDE_KEY, AUTOMATCH_GUIDE_KEY } from '../features/tutorial/guideKeys';
import { RoomAdminGuide } from '../features/tutorial/RoomAdminGuide';
import { AutoMatchGuide } from '../features/tutorial/AutoMatchGuide';
import { PlayerCard, LeftPlayerCard, EmptySlot, CourtTimer } from '../features/room/PlayerCard';
import { AutoMatchSection } from '../features/room/AutoMatchSection';
import { GameBanner } from '../features/room/GameBanner';
import { MyTurnBanner } from '../features/room/MyTurnBanner';
import { JoinGate } from '../features/room/JoinGate';
import { SettingsModal } from '../features/room/SettingsModal';
import { EditRoomInfoModal } from '../features/room/EditRoomInfoModal';
import { AdminManagerModal } from '../features/room/AdminManagerModal';
import { BragCardModal } from '../features/room/BragCardModal';
import {
    ShareModal, CourtSelectionModal, EditGamesModal, AdminCodeModal,
    QrModal, NotiPermissionModal, shouldAskNotification,
} from '../features/room/SmallModals';
import { InstallGuideModal } from '../components/ui/InstallPrompt';
import { MatchOptionsModal } from '../components/MatchOptionsModal';
import { RoomEntryFX } from '../features/room/RoomEntryFX';
import { MatchTimelineModal } from '../features/room/MatchTimelineModal';
import { NoticeModal } from '../features/room/NoticeModal';
import { ReportModal } from '../features/room/ReportModal';
import { timeAgo } from '../lib/time';
import { LoadingSpinner } from '../components/ui/Feedback';
import {
    ArrowLeft, Share2, Edit3, GripVertical, QrCode, Users, Lock,
    Trophy, KeyRound, Crown, LogOut, Clock, ShieldAlert,
} from '../components/ui/icons';
import { PLAYERS_PER_MATCH, FIELD_CLS } from '../constants';
import {
    buildMatchContext, buildCandidatePool, generateMatchOptions, getSensitivity,
} from '../lib/matching';
import { buildEngineInput } from '../lib/matchQueues';
import { verifyPassword, hasPassword } from '../lib/roomPassword';
import { computeBragStat } from '../lib/bragCard';
import { toast } from '../lib/toast';
import { logError } from '../lib/errorLog';

// ===================================================================================
// 공지 바 — 방 상단 고정. 탭하면 펼쳐지고, 새 공지에는 NEW 표시가 붙는다.
// -----------------------------------------------------------------------------------
// '봤다' 기준: 펼쳐 보거나 8초 동안 화면에 있었으면 본 것 (기기 저장).
// 관리자는 오른쪽 연필로 바로 수정한다.
// ===================================================================================
function RoomNoticeBar({ roomId, notice, updatedAt, isAdmin, onEdit }) {
    const seenKey = `cockstar-notice-seen-${roomId}`;
    const [expanded, setExpanded] = useState(false);
    const [isNew, setIsNew] = useState(false);

    // 공지 내용이 바뀌면 접고, NEW 여부를 다시 계산한다
    useEffect(() => {
        setExpanded(false);
        try { setIsNew(localStorage.getItem(seenKey) !== notice); }
        catch { setIsNew(false); }
    }, [notice, seenKey]);

    const markSeen = useCallback(() => {
        try { localStorage.setItem(seenKey, notice); } catch { /* noop */ }
        setIsNew(false);
    }, [seenKey, notice]);

    // 8초 동안 화면에 있었으면 본 것으로 친다
    useEffect(() => {
        if (!isNew) return undefined;
        const t = setTimeout(markSeen, 8000);
        return () => clearTimeout(t);
    }, [isNew, markSeen]);

    return (
        <div key={notice} className="flex-shrink-0 flex items-start gap-2.5 px-4 py-2.5 bg-white/[0.04] border-b border-white/[0.06] notice-in">
            <span className="text-sm shrink-0 notice-megaphone mt-px" aria-hidden="true">📢</span>
            <button
                onClick={() => { setExpanded(v => !v); markSeen(); }}
                className="flex-1 min-w-0 text-left"
                aria-expanded={expanded}
                aria-label="공지 펼치기"
            >
                <span
                    className={`block text-[12px] font-black text-txt break-keep leading-snug whitespace-pre-line ${expanded ? '' : 'notice-clamp'}`}
                    style={{ overflowWrap: 'anywhere' }}
                >
                    {notice}
                </span>
                {expanded && updatedAt && (
                    <span className="block text-[10px] font-bold text-muted mt-1">{timeAgo(updatedAt)} 등록</span>
                )}
            </button>
            {isNew && (
                <span className="shrink-0 text-[9px] font-black px-1.5 py-0.5 rounded bg-volt text-ink mt-0.5 animate-pulse">NEW</span>
            )}
            {isAdmin && (
                <button
                    onClick={onEdit}
                    aria-label="공지 수정"
                    className="shrink-0 p-1 -mr-1 text-muted hover:text-volt transition-colors"
                >
                    <Edit3 size={13} />
                </button>
            )}
        </div>
    );
}

// ===================================================================================
// 경기방 화면
// -----------------------------------------------------------------------------------
// 로직은 useGameRoom 훅에 있고 여기는 '보여주기'만 한다.
// 화면 흐름은 네 단계다.
//   ① 비밀번호   → 잠긴 방이면 먼저 푼다
//   ② 참가 확인   → 구경만 할지, 명단에 올릴지 (예전에는 열자마자 자동 참가였다)
//   ③ 운영 화면   → 대기 명단 · 자동 매칭 · 경기 배정 · 코트
//   ④ 안내       → 관리자로 처음 들어왔으면 운영 안내 → 자동매칭 연습
// ===================================================================================

export function GameRoomPage({ onLoginClick }) {
    const { roomId } = useParams();
    const navigate = useNavigate();
    const confirm = useConfirm();
    const [searchParams, setSearchParams] = useSearchParams();
    const { user, userData, superAdmin } = useAuth();
    const room = useGameRoom({ roomId, user, superAdmin });
    const { hasSeen, markSeen, resetSeen } = useTutorial(user, userData);

    const {
        roomData, players, loading, notFound, permissionDenied, isAdmin, myUid, playerCount,
        inProgressPlayerIds, waitingPlayers, courtIndexByPlayer, staleList,
    } = room;

    // ── 화면 상태 ──
    const [tab, setTab] = useState('matching');
    const [selectedIds, setSelectedIds] = useState([]);
    const [passwordInput, setPasswordInput] = useState('');
    const [unlocked, setUnlocked] = useState(false);
    const [peeking, setPeeking] = useState(false);
    const [joining, setJoining] = useState(false);

    const [showSettings, setShowSettings] = useState(false);
    const [showEditInfo, setShowEditInfo] = useState(false);
    const [showAdmins, setShowAdmins] = useState(false);
    const [showShare, setShowShare] = useState(false);
    const [showQr, setShowQr] = useState(false);
    const [showBrag, setShowBrag] = useState(false);
    const [showAdminCode, setShowAdminCode] = useState(false);
    const [editGamePlayer, setEditGamePlayer] = useState(null);
    const [showNotiAsk, setShowNotiAsk] = useState(false);
    const [showInstallGuide, setShowInstallGuide] = useState(false);

    const [courtModal, setCourtModal] = useState(null);   // { matchIndex, source, courts }
    const [matchOptions, setMatchOptions] = useState(null);
    const [generatingGender, setGeneratingGender] = useState(null);
    const generatingRef = useRef(false);
    const swipeRef = useRef(null);            // 좌우 스와이프 시작점
    const courtSigRef = useRef({});           // 코트별 선수 구성 — 새 경기 입장 연출용
    const courtFirstRenderRef = useRef(true);

    const [showAdminGuide, setShowAdminGuide] = useState(false);
    const [showAutoGuide, setShowAutoGuide] = useState(false);
    const [showTimeline, setShowTimeline] = useState(false);
    const [showReport, setShowReport] = useState(false);
    const [showNotice, setShowNotice] = useState(false);
    // 내가 방금 저장한 공지에는 "공지가 업데이트됐어요" 토스트를 안 띄운다 (저장 토스트와 중복)
    const noticeSavedByMeRef = useRef(false);
    const prevNoticeRef = useRef(null);

    const me = myUid ? players[myUid] : null;
    const joined = !!me;

    // ── 👻 운영 전용 모드 ──
    // 코치·총무처럼 '운영만 하고 경기는 안 뛰는 사람'을 위한 모드.
    // 방마다 따로 켠다(어떤 방에서는 뛰고 어떤 방에서는 운영만 할 수 있어야 한다)
    // → 방 문서가 아니라 기기에 저장한다.
    const ghostKey = `cockstar-ghost-admin-${roomId}`;
    const [isGhost, setIsGhost] = useState(() => {
        try { return localStorage.getItem(ghostKey) === '1'; }
        catch { return false; }
    });
    // 일반 회원이 켜면 자기만 현황판에서 사라져 매칭에 영영 안 들어간다 — 관리자만 인정한다
    const ghostActive = isGhost && isAdmin;

    // 살아 있다고 알린다 (자리 비움 판정에 쓰인다)
    usePresence(roomId, myUid, joined && !ghostActive);

    // ── 비밀번호 ──
    const locked = hasPassword(roomData) && !unlocked && !superAdmin && roomData?.adminUid !== myUid;

    const handleUnlock = async () => {
        const ok = await verifyPassword(passwordInput, roomData || {});
        if (ok) { setUnlocked(true); setPasswordInput(''); }
        else toast.error('비밀번호가 틀렸습니다.');
    };

    // ── 초대 링크로 들어온 경우: 코드가 맞으면 바로 관리자가 된다 ──
    const inviteHandledRef = useRef(false);
    useEffect(() => {
        const code = searchParams.get('adminInvite');
        if (!code || !user || !roomData || inviteHandledRef.current) return;
        inviteHandledRef.current = true;
        (async () => {
            const ok = await room.redeemInvite(code);
            if (ok) toast('공동 관리자가 되었습니다! 👑');
            else toast.error('초대 코드가 만료되었거나 올바르지 않습니다.');
            const next = new URLSearchParams(searchParams);
            next.delete('adminInvite');
            setSearchParams(next, { replace: true });
        })();
    }, [searchParams, user, roomData, room, setSearchParams]);

    // ── 관리자 안내: 이 방에 관리자로 처음 들어왔을 때 ──
    useEffect(() => {
        if (loading || !isAdmin || !joined && !ghostActive) return;
        if (locked) return;
        if (hasSeen(ROOM_ADMIN_GUIDE_KEY)) return;
        if (showSettings || showEditInfo || showShare || courtModal) return;
        const t = setTimeout(() => setShowAdminGuide(true), 600);
        return () => clearTimeout(t);
    }, [loading, isAdmin, joined, ghostActive, locked, hasSeen, showSettings, showEditInfo, showShare, courtModal]);

    // 자동매칭 연습은 운영 안내를 끝낸 다음에 이어서 나온다 (겹쳐 뜨면 둘 다 못 쓴다)
    const finishAdminGuide = async () => {
        setShowAdminGuide(false);
        await markSeen(ROOM_ADMIN_GUIDE_KEY);
        if (!hasSeen(AUTOMATCH_GUIDE_KEY)) setTimeout(() => setShowAutoGuide(true), 350);
    };

    useEffect(() => {
        if (loading || !isAdmin || locked) return;
        if (!hasSeen(ROOM_ADMIN_GUIDE_KEY)) return;   // 운영 안내가 먼저다
        if (hasSeen(AUTOMATCH_GUIDE_KEY) || showAdminGuide || showAutoGuide) return;
        const t = setTimeout(() => setShowAutoGuide(true), 600);
        return () => clearTimeout(t);
    }, [loading, isAdmin, locked, hasSeen, showAdminGuide, showAutoGuide]);

    // ── 참가 ──
    const handleJoin = async () => {
        if (!user) { onLoginClick(); return; }
        setJoining(true);
        try {
            await room.join(userData);
            toast('참가했습니다. 대기 명단에 올라갔어요!');
            // 참가 직후 알림 권한을 한 번 권한다 — "내 차례" 알림의 가치가 가장 와닿는 순간이다.
            // 이미 물어봤거나 권한이 정해진 기기에서는 조용히 넘어간다.
            if (shouldAskNotification()) setTimeout(() => setShowNotiAsk(true), 900);
        } catch (e) {
            logError('방 참가', e);
            toast.error('참가에 실패했습니다.');
        } finally { setJoining(false); }
    };

    const handleLeaveRoom = async () => {
        const ok = await confirm({
            title: '방을 나갈까요?',
            description: joined ? '대기 명단에서 빠지고 오늘 이 방의 기록이 사라집니다.' : '',
            confirmText: '나가기',
            tone: joined ? 'danger' : 'default',
        });
        if (!ok) return;
        if (joined && !ghostActive) await room.leave();
        navigate('/game');
    };

    const handleToggleGhost = async () => {
        if (!user) return;
        const next = !isGhost;
        if (next && inProgressPlayerIds.has(user.uid)) {
            toast.error('경기 중에는 운영 모드로 바꿀 수 없습니다. 경기가 끝난 뒤 눌러주세요.');
            return;
        }
        try { localStorage.setItem(ghostKey, next ? '1' : '0'); } catch { /* noop */ }
        setIsGhost(next);
        if (next) {
            await room.leave();
            toast('운영 전용 모드로 바꿨습니다. 선수 명단에서 빠집니다.');
        } else {
            await room.join(userData);
        }
    };

    // ── 선수 선택 · 배치 ──
    const handleCardClick = (player) => {
        if (!isAdmin) return;
        if (selectedIds.includes(player.id)) {
            setSelectedIds(prev => prev.filter(id => id !== player.id));
            return;
        }
        const inSchedule = Object.values(roomData?.scheduledMatches || {})
            .some(m => m && m.includes(player.id));
        if (selectedIds.length > 0 && inSchedule) {
            if (selectedIds.length > 1) {
                toast.error('선수 교체는 1명만 선택한 상태에서 가능합니다.');
                return;
            }
            let mIdx = null;
            let sIdx = null;
            Object.keys(roomData.scheduledMatches || {}).forEach(key => {
                const idx = (roomData.scheduledMatches[key] || []).indexOf(player.id);
                if (idx > -1) { mIdx = parseInt(key, 10); sIdx = idx; }
            });
            room.swapPlayers(selectedIds, player.id, mIdx, sIdx).then(() => setSelectedIds([]));
            return;
        }
        setSelectedIds(prev => [...prev, player.id]);
    };

    const handleSlotClick = (matchIndex, slotIndex) => {
        if (!isAdmin || selectedIds.length === 0) return;
        room.fillSlot(matchIndex, slotIndex, selectedIds).then(() => setSelectedIds([]));
    };

    const handleKick = async (player) => {
        const ok = await confirm({
            title: `${player.name}님을 내보낼까요?`,
            description: '오늘 이 방의 경기 기록도 함께 사라집니다.',
            confirmText: '내보내기',
            tone: 'danger',
        });
        if (!ok) return;
        await room.kickPlayer(player.id);
        setSelectedIds(prev => prev.filter(id => id !== player.id));
    };

    // ── 경기 시작 · 종료 ──
    const handleStartClick = (matchIndex, source = 'schedule') => {
        if (!isAdmin) { toast.error('관리자만 가능합니다.'); return; }
        const courts = roomData?.inProgressCourts || [];
        const empty = [];
        for (let i = 0; i < (roomData?.numInProgressCourts || 0); i += 1) {
            if (!courts[i]) empty.push(i);
        }
        if (empty.length === 0) { toast.error('빈 코트가 없습니다.'); return; }
        if (empty.length === 1) { room.startMatch(matchIndex, empty[0], source); return; }
        setCourtModal({ matchIndex, source, courts: empty });
    };

    const handleEndMatch = async (courtIdx) => {
        const snapshot = await room.endMatch(courtIdx);
        if (!snapshot) return;
        // 경기 종료는 오조작이 잦다(코트가 여러 개면 옆 코트를 누르기 쉽다).
        // 예전에는 4명의 경기 수를 하나씩 손으로 되돌려야 했다.
        toast.undo('경기를 종료했습니다.', () => room.undoEndMatch(snapshot));
    };

    // ── 자동 매칭 ──
    const computeOptions = useCallback((gender) => {
        const isMixed = gender === '혼복';
        const cfg = roomData?.autoMatchConfig || {};
        const master = cfg.sensitivity || 'normal';
        const key = (cfg.perGenderSensitivity && !isMixed)
            ? ((gender === '남' ? cfg.maleSensitivity : cfg.femaleSensitivity) || master)
            : master;
        const sens = getSensitivity(key);

        const { allPlayers, gameState } = buildEngineInput(roomData, players);
        const ctx = buildMatchContext(allPlayers, gameState, { now: Date.now() });
        const pool = buildCandidatePool(ctx, gender);

        // 예약이 쌓이면 목록 전체가 대기 상태가 되어 코트가 논다 —
        // 엔진이 이번엔 '바로 시작 가능한 조합'을 우선하도록 알려준다.
        const pendingReservations = Object.values(roomData?.autoMatches || {})
            .filter(m => (m || []).some(id => id && inProgressPlayerIds.has(id))).length;

        return generateMatchOptions({
            pool, ctx, mode: gender, maxOnCourt: sens.maxOnCourt, pages: 3, pendingReservations,
        });
    }, [roomData, players, inProgressPlayerIds]);

    const handleGenerate = async (gender) => {
        if (!isAdmin || generatingRef.current) return;
        if (!roomData) { toast.error('데이터를 불러오는 중입니다. 잠시 후 다시 눌러주세요.'); return; }
        const isMixed = gender === '혼복';
        const label = isMixed ? '혼복' : (gender === '남' ? '남자' : '여자');

        generatingRef.current = true;
        setGeneratingGender(gender);
        try {
            const result = computeOptions(gender);
            if (result.status !== 'ok') {
                toast.error(isMixed
                    ? `혼복은 남자 2명, 여자 2명 이상 필요합니다. (현재 남 ${result.maleCount ?? 0} · 여 ${result.femaleCount ?? 0})`
                    : `${label} 선수가 4명 이상 필요합니다. (현재 ${result.poolSize}명)`);
                return;
            }
            setMatchOptions({ gender, genderLabel: label, result });
        } catch (e) {
            logError('자동 매칭 계산', e);
            toast.error('매칭 후보를 계산하지 못했습니다.');
        } finally {
            generatingRef.current = false;
            setGeneratingGender(null);
        }
    };

    const handleSelectOption = async (option) => {
        const fail = await room.addAutoMatch(option);
        setMatchOptions(null);
        if (fail) toast.error(`${fail} 매칭 버튼을 한 번 더 눌러주세요.`);
    };

    // ── 자랑 카드 ──
    const bragStat = useMemo(
        () => (me ? computeBragStat(me, players, roomData?.name) : null),
        [me, players, roomData],
    );

    // ── 빈 코트 펄스 — "지금 올릴 수 있는 경기"가 있는데 코트가 놀고 있을 때 ──
    // 휴식 중인 선수가 낀 경기도 시작할 수 있으므로 휴식은 따지지 않는다.
    const hasStartable = useMemo(() => {
        const schedOk = Object.values(roomData?.scheduledMatches || {})
            .some(m => (m || []).filter(Boolean).length === PLAYERS_PER_MATCH
                && (m || []).every(id => !id || (!inProgressPlayerIds.has(id) && players[id])));
        const autoOk = Object.values(roomData?.autoMatches || {})
            .some(m => Array.isArray(m) && m.filter(Boolean).length === PLAYERS_PER_MATCH
                && m.every(id => !inProgressPlayerIds.has(id) && players[id]));
        return schedOk || autoOk;
    }, [roomData, players, inProgressPlayerIds]);

    // ── [연출] 코트에 새 경기가 들어오는 순간을 기억한다 (렌더 후 '본 것'으로 기록) ──
    useEffect(() => {
        (roomData?.inProgressCourts || []).forEach((c, i) => {
            courtSigRef.current[i] = (c?.players || []).filter(Boolean).join('|');
        });
        if (roomData) courtFirstRenderRef.current = false;
    });

    // ── 접속 중에 공지가 바뀌면 알려준다 (내가 방금 저장한 경우는 제외) ──
    useEffect(() => {
        if (!roomData) return;
        const cur = roomData.notice || '';
        const prev = prevNoticeRef.current;
        prevNoticeRef.current = cur;
        if (prev === null || prev === cur) return;
        if (noticeSavedByMeRef.current) { noticeSavedByMeRef.current = false; return; }
        if (cur) toast('📢 공지가 업데이트되었습니다');
    }, [roomData]);

    // ── 화면 ──
    // 읽기 권한이 없다 = 로그인이 필요하다 (공유 링크를 받은 사람의 기본 경로다)
    if (permissionDenied && !user) {
        return (
            <div className="flex flex-col items-center justify-center h-full bg-ink p-8 text-center">
                <div className="w-14 h-14 rounded-2xl bg-volt flex items-center justify-center mb-4">
                    <Lock size={26} className="text-ink" />
                </div>
                <h2 className="text-lg font-black kern-tight mb-1 text-txt">경기방 초대를 받으셨네요!</h2>
                <p className="text-sm text-dim font-medium mb-6">로그인하면 바로 입장할 수 있어요.<br />가입은 30초면 됩니다.</p>
                <button
                    onClick={onLoginClick}
                    className="w-full max-w-xs py-4 bg-volt text-ink font-black rounded-full shadow-volt"
                >
                    로그인하고 입장하기
                </button>
                <button onClick={() => navigate('/')} className="mt-4 text-dim text-sm font-bold">
                    나중에 할게요
                </button>
            </div>
        );
    }
    if (permissionDenied && user) {
        return (
            <div className="flex flex-col items-center justify-center h-full bg-ink p-8 text-center">
                <p className="text-5xl mb-4">🔒</p>
                <h2 className="text-xl font-black text-txt kern-tight mb-2">이 방을 볼 권한이 없어요</h2>
                <p className="text-sm text-dim font-medium mb-8">방장에게 문의해주세요.</p>
                <button
                    onClick={() => navigate('/game')}
                    className="px-8 py-4 bg-volt text-ink font-black rounded-full label text-xs"
                >
                    경기방 목록으로
                </button>
            </div>
        );
    }

    if (notFound) {
        return (
            <div className="flex flex-col items-center justify-center h-full bg-ink p-8 text-center">
                <p className="text-5xl mb-4">🏸</p>
                <h2 className="text-xl font-black text-txt kern-tight mb-2">방을 찾을 수 없습니다</h2>
                <p className="text-sm text-dim font-medium mb-8">삭제되었거나 링크가 잘못되었어요.</p>
                <button
                    onClick={() => navigate('/game')}
                    className="px-8 py-4 bg-volt text-ink font-black rounded-full label text-xs"
                >
                    경기방 목록으로
                </button>
            </div>
        );
    }

    if (loading || !roomData) return <LoadingSpinner text="ENTERING" />;

    if (locked) {
        return (
            <div className="flex flex-col items-center justify-center h-full bg-ink p-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-volt flex items-center justify-center mb-4">
                    <Lock size={28} className="text-ink" />
                </div>
                <h2 className="text-xl font-black kern-tight mb-1 text-txt">비밀번호가 있는 방입니다</h2>
                <p className="text-sm text-dim font-medium mb-6">{roomData.name}</p>
                <input
                    type="password"
                    autoComplete="off"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleUnlock(); }}
                    aria-label="방 비밀번호"
                    className={`${FIELD_CLS} max-w-xs text-center mb-4`}
                />
                <button
                    onClick={handleUnlock}
                    className="w-full max-w-xs py-4 bg-volt text-ink font-black rounded-full shadow-volt"
                >
                    입장하기
                </button>
                <button onClick={() => navigate('/game')} className="mt-4 text-dim text-sm font-bold">
                    목록으로 돌아가기
                </button>
            </div>
        );
    }

    // 참가 확인 — 구경만 하려던 사람이 명단에 오르지 않게
    if (!joined && !ghostActive && !peeking) {
        if (!user) {
            return (
                <div className="flex flex-col items-center justify-center h-full bg-ink p-8 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-volt flex items-center justify-center mb-4">
                        <Lock size={26} className="text-ink" />
                    </div>
                    <h2 className="text-lg font-black kern-tight mb-1 text-txt">{roomData.name}</h2>
                    <p className="text-sm text-dim font-medium mb-6">이 경기방에 참여하려면<br />로그인이 필요합니다.</p>
                    <button
                        onClick={onLoginClick}
                        className="w-full max-w-xs py-4 bg-volt text-ink font-black rounded-full shadow-volt"
                    >
                        로그인하고 입장하기
                    </button>
                </div>
            );
        }
        return (
            <div className="h-full flex flex-col bg-ink">
                <header className="flex-shrink-0 h-14 px-3 flex items-center bg-surface border-b border-white/[0.06]">
                    <button
                        onClick={() => navigate('/game')}
                        aria-label="뒤로"
                        className="p-2 text-dim hover:text-txt transition-colors"
                    >
                        <ArrowLeft size={22} />
                    </button>
                    <span className="text-sm font-black text-txt truncate ml-1">경기방 참가</span>
                </header>
                <JoinGate
                    room={roomData}
                    userData={userData}
                    playerCount={playerCount}
                    onJoin={handleJoin}
                    onPeek={() => setPeeking(true)}
                    joining={joining}
                />
            </div>
        );
    }

    const maleWaiting = waitingPlayers.filter(p => p.gender === '남');
    const femaleWaiting = waitingPlayers.filter(p => p.gender !== '남');
    const courtLimit = roomData.courtTimeLimit ?? 20;
    // 방 포인트 색 — CSS 변수로 내려보내 곳곳(탭·배지·코트 헤더)이 같은 색을 입는다
    const accent = roomData.themeColor || '#CDFB47';

    return (
        <div className="flex flex-col h-full bg-ink" style={{ '--room-accent': accent }}>
            {/* 입장 연출 — 방 이름이 전광판처럼 켜진다 (탭하면 건너뛰기) */}
            <RoomEntryFX
                roomId={roomId}
                roomName={roomData.name}
                notice={roomData.notice}
                locationName={roomData.location}
            />

            {/* ── 헤더 ── */}
            {/* sticky 가 곧 포지셔닝 컨텍스트다 — relative 를 겹치면 헤더 고정이 깨질 수 있다 */}
            <header className="flex-shrink-0 h-16 px-3 flex items-center justify-between bg-surface sticky top-0 z-30 border-b border-white/[0.06]">
                {/* 테마색 스트립 — 이 방만의 색 */}
                <span className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: `linear-gradient(90deg, ${accent}, transparent 70%)` }} />
                <div className="flex items-center gap-2 overflow-hidden flex-1 mr-2">
                    <button
                        onClick={handleLeaveRoom}
                        aria-label="방 나가기"
                        className="p-2 -ml-1 text-dim hover:text-txt transition-colors"
                    >
                        <ArrowLeft size={22} />
                    </button>
                    <div className="flex flex-col overflow-hidden justify-center">
                        <div className="flex items-center gap-1.5">
                            <h1 className="text-base font-black text-txt truncate leading-tight kern-tight">{roomData.name}</h1>
                            {isAdmin && (
                                <button
                                    onClick={() => setShowEditInfo(true)}
                                    aria-label="방 정보 수정"
                                    className="text-muted hover:text-volt p-0.5"
                                >
                                    <Edit3 size={14} />
                                </button>
                            )}
                        </div>
                        <div className="flex items-center text-[11px] text-dim font-bold leading-none mt-1 space-x-1.5 truncate">
                            <span className="truncate max-w-[90px]">{roomData.location}</span>
                            <span className="w-1 h-1 bg-muted rounded-full" />
                            <span className="flex items-center gap-1 text-dim">
                                <Users size={12} />{playerCount}/{roomData.maxPlayers}
                            </span>
                            <span className="w-1 h-1 bg-muted rounded-full" />
                            <span className={isAdmin ? 'text-volt font-black' : 'text-dim'}>
                                {isAdmin ? 'ADMIN' : peeking && !joined ? '구경 중' : 'PLAYER'}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                    {/* QR 초대 — 예전 '실험실' 자리. 누구나 누르면 이 방의 QR이 뜨고,
                        스캔한 사람은 바로 /room/:id 로 들어온다 */}
                    <button
                        onClick={() => setShowQr(true)}
                        aria-label="QR 코드로 초대"
                        title="QR 코드로 초대"
                        className="w-9 h-9 flex items-center justify-center rounded-full text-dim hover:text-volt hover:bg-white/5 transition-all"
                    >
                        <QrCode size={19} />
                    </button>
                    <button
                        onClick={() => setShowShare(true)}
                        aria-label="경기방 공유"
                        className="w-9 h-9 flex items-center justify-center rounded-full text-dim hover:text-volt hover:bg-white/5 transition-all"
                    >
                        <Share2 size={19} />
                    </button>

                    {/* 관리자가 아닌 사람에게만 — 초대 코드로 관리자가 되는 뒷문 */}
                    {!isAdmin && user && (
                        <button
                            onClick={() => setShowAdminCode(true)}
                            aria-label="관리자 코드 입력"
                            title="관리자 코드 입력"
                            className="w-9 h-9 flex items-center justify-center rounded-full text-muted hover:text-volt hover:bg-white/5 transition-all"
                        >
                            <KeyRound size={17} />
                        </button>
                    )}

                    {ghostActive ? (
                        <span
                            className="h-9 px-3 rounded-full text-xs font-black flex items-center justify-center bg-white/10 text-dim"
                            title="선수 명단에 잡히지 않습니다 — 설정에서 되돌릴 수 있어요"
                        >
                            👻 운영중
                        </span>
                    ) : joined ? (
                        <button
                            onClick={room.toggleRest}
                            className={`h-9 px-3.5 rounded-full text-xs font-black transition-all flex items-center justify-center ${me?.isResting ? 'bg-white/10 text-dim' : 'bg-volt text-ink'}`}
                        >
                            {me?.isResting ? '복귀' : '휴식'}
                        </button>
                    ) : (
                        <button
                            onClick={handleJoin}
                            className="h-9 px-3.5 rounded-full text-xs font-black bg-volt text-ink"
                        >
                            참가하기
                        </button>
                    )}

                    {isAdmin && (
                        <button
                            onClick={() => setShowSettings(true)}
                            aria-label="방 설정"
                            className="w-9 h-9 flex items-center justify-center rounded-full text-dim hover:text-txt hover:bg-white/5 transition-all"
                        >
                            <GripVertical size={19} />
                        </button>
                    )}
                </div>
            </header>

            <GameBanner onNavigate={navigate} />

            {/* ── 공지 — 채팅보다 먼저 필요한 한 줄. 탭하면 펼쳐지고, 새 공지엔 NEW ── */}
            {roomData.notice ? (
                <RoomNoticeBar
                    roomId={roomId}
                    notice={roomData.notice}
                    updatedAt={roomData.noticeUpdatedAt}
                    isAdmin={isAdmin}
                    onEdit={() => setShowNotice(true)}
                />
            ) : isAdmin ? (
                /* 공지가 없을 때 — 관리자에게만 보이는 등록 유도 (참가자 화면은 깨끗하게) */
                <button
                    onClick={() => setShowNotice(true)}
                    className="flex-shrink-0 w-full flex items-center gap-2 px-4 py-2 bg-transparent border-b border-dashed border-white/[0.08] text-left"
                >
                    <span className="text-xs" aria-hidden="true">📢</span>
                    <span className="flex-1 text-[11px] font-bold text-muted">
                        공지를 등록해보세요 — 입장하는 모두에게 보여요
                    </span>
                    <span className="text-[9px] font-black text-muted/60 label shrink-0">관리자만 보임</span>
                </button>
            ) : null}

            {/* 탭 — 데스크톱(lg)에서는 두 화면을 나란히 펼치므로 탭이 필요 없다 */}
            <div className="flex bg-surface px-2 border-b border-white/[0.06] lg:hidden">
                {[{ key: 'matching', label: '매칭 대기' }, { key: 'inProgress', label: '경기 진행' }].map(t => (
                    <button
                        key={t.key}
                        onClick={() => setTab(t.key)}
                        aria-current={tab === t.key}
                        className={`flex-1 py-3 text-sm font-black border-b-2 transition-colors label ${tab === t.key ? '' : 'border-transparent text-muted'}`}
                        style={tab === t.key ? { color: accent, borderColor: accent } : undefined}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            <main
                className="flex-grow overflow-y-auto p-4 space-y-4 pb-24 hide-scrollbar"
                // 좌우 스와이프로도 탭 전환 — 손가락 이동이 가로로 확실할 때만 (세로 스크롤과 구분)
                onTouchStart={(e) => {
                    swipeRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
                }}
                onTouchEnd={(e) => {
                    const start = swipeRef.current;
                    swipeRef.current = null;
                    if (!start || window.innerWidth >= 1024) return;
                    const dx = e.changedTouches[0].clientX - start.x;
                    const dy = e.changedTouches[0].clientY - start.y;
                    if (Math.abs(dx) < 64 || Math.abs(dx) < Math.abs(dy) * 1.6) return;
                    if (dx < 0 && tab === 'matching') setTab('inProgress');
                    else if (dx > 0 && tab === 'inProgress') setTab('matching');
                }}
            >
                {/* 내 차례 — 선수가 가장 궁금한 한 가지 */}
                {me && (
                    <MyTurnBanner
                        me={me}
                        roomData={roomData}
                        players={players}
                        inProgressPlayerIds={inProgressPlayerIds}
                        courtIndexByPlayer={courtIndexByPlayer}
                        onOpenBrag={() => setShowBrag(true)}
                    />
                )}

                {/* 데스크톱(lg)에서는 왼쪽 매칭 · 오른쪽 코트를 나란히 — 관리자 PC 운영 대비 */}
                <div className="lg:grid lg:grid-cols-2 lg:gap-5 lg:items-start">
                    <div className={`space-y-4 ${tab === 'matching' ? '' : 'hidden'} lg:block`}>
                        <section className="bg-card rounded-2xl p-4 border border-white/[0.06]">
                            <div className="flex justify-between items-center mb-4 border-b border-white/[0.06] pb-3">
                                <h2 className="text-xs font-black label text-txt flex items-center gap-2">
                                    <Users size={15} style={{ color: accent }} />대기 명단
                                </h2>
                                <span className="text-ink text-xs font-black px-2.5 py-0.5 rounded-full tabular" style={{ backgroundColor: accent }}>
                                    {waitingPlayers.length}
                                </span>
                            </div>

                            <div className="grid grid-cols-4 gap-2">
                                {maleWaiting.map(p => (
                                    <PlayerCard
                                        key={p.id} player={p} isAdmin={isAdmin}
                                        isCurrentUser={myUid === p.id}
                                        isSelected={selectedIds.includes(p.id)}
                                        isResting={p.isResting}
                                        onCardClick={handleCardClick}
                                        onDeleteClick={handleKick}
                                        onLongPress={setEditGamePlayer}
                                    />
                                ))}
                            </div>

                            {maleWaiting.length > 0 && femaleWaiting.length > 0 && (
                                <div className="my-4 relative">
                                    <div className="absolute inset-0 flex items-center">
                                        <div className="w-full border-t border-dashed border-white/10" />
                                    </div>
                                    <div className="relative flex justify-center">
                                        <span className="bg-card px-2 text-[10px] text-muted font-black label">여성 회원</span>
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-4 gap-2">
                                {femaleWaiting.map(p => (
                                    <PlayerCard
                                        key={p.id} player={p} isAdmin={isAdmin}
                                        isCurrentUser={myUid === p.id}
                                        isSelected={selectedIds.includes(p.id)}
                                        isResting={p.isResting}
                                        onCardClick={handleCardClick}
                                        onDeleteClick={handleKick}
                                        onLongPress={setEditGamePlayer}
                                    />
                                ))}
                            </div>

                            {waitingPlayers.length === 0 && (
                                <div className="text-center py-8">
                                    <p className="text-sm text-dim font-bold">대기 중인 선수가 없습니다.</p>
                                    <p className="text-xs text-muted mt-1 font-medium">새로운 선수를 기다리는 중...</p>
                                </div>
                            )}

                            {isAdmin && selectedIds.length > 0 && (
                                <div className="mt-3 flex items-center justify-between px-1">
                                    <span className="text-[11px] font-black text-volt">{selectedIds.length}명 선택됨</span>
                                    <button
                                        onClick={() => setSelectedIds([])}
                                        className="text-[11px] font-bold text-muted"
                                    >
                                        선택 해제
                                    </button>
                                </div>
                            )}
                        </section>

                        <AutoMatchSection
                            autoMatches={roomData.autoMatches}
                            players={players}
                            isAdmin={isAdmin}
                            currentUserId={myUid}
                            inProgressPlayerIds={inProgressPlayerIds}
                            courtIndexByPlayer={courtIndexByPlayer}
                            onGenerate={handleGenerate}
                            generatingGender={generatingGender}
                            onStart={(idx) => handleStartClick(idx, 'auto')}
                            onDelete={room.deleteAutoMatch}
                            onClearAll={async () => {
                                const ok = await confirm({
                                    title: '자동 매칭 목록을 모두 지울까요?',
                                    confirmText: '전체 삭제',
                                    tone: 'danger',
                                });
                                if (ok) room.clearAutoMatches();
                            }}
                            onRemovePlayer={(matchIndex) => room.deleteAutoMatch(matchIndex)}
                        />

                        <section className="space-y-3">
                            <h2 className="text-xs font-black label text-dim ml-1">경기 배정 · Schedule</h2>
                            {Array.from({ length: roomData.numScheduledMatches }).map((_, mIdx) => {
                                const match = roomData.scheduledMatches?.[mIdx] || Array(PLAYERS_PER_MATCH).fill(null);
                                const filled = match.filter(Boolean).length;
                                return (
                                    <div key={mIdx} className="bg-card rounded-2xl p-3 border border-white/[0.06] flex flex-col gap-2">
                                        <div className="flex justify-between items-center px-1">
                                            <div className="flex items-center gap-2">
                                                <span className="text-ink text-[11px] font-black px-2.5 py-1 rounded-md tracking-wide" style={{ backgroundColor: accent }}>
                                                    MATCH {mIdx + 1}
                                                </span>
                                                <span className="text-[11px] font-black text-muted tabular">{filled}/4</span>
                                            </div>
                                            {isAdmin && (
                                                <button
                                                    onClick={() => handleStartClick(mIdx)}
                                                    disabled={filled < PLAYERS_PER_MATCH}
                                                    className={`flex items-center gap-1 px-3.5 py-1.5 rounded-full text-xs font-black transition-all label ${filled === PLAYERS_PER_MATCH ? 'bg-volt text-ink shadow-volt' : 'bg-white/5 text-muted cursor-not-allowed'}`}
                                                >
                                                    경기 시작
                                                </button>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-4 gap-2">
                                            {match.map((pid, sIdx) => {
                                                if (pid && players[pid]) {
                                                    return (
                                                        <PlayerCard
                                                            key={pid} player={players[pid]} isAdmin={isAdmin}
                                                            isCurrentUser={myUid === pid}
                                                            isSelected={selectedIds.includes(pid)}
                                                            onCardClick={handleCardClick}
                                                            onDeleteClick={() => room.removeFromSchedule(mIdx, sIdx)}
                                                            onLongPress={setEditGamePlayer}
                                                        />
                                                    );
                                                }
                                                if (pid) {
                                                    return (
                                                        <LeftPlayerCard
                                                            key={`left-${mIdx}-${sIdx}`} isAdmin={isAdmin}
                                                            onClick={() => room.removeFromSchedule(mIdx, sIdx)}
                                                        />
                                                    );
                                                }
                                                return (
                                                    <EmptySlot
                                                        key={`empty-${mIdx}-${sIdx}`}
                                                        onSlotClick={() => handleSlotClick(mIdx, sIdx)}
                                                    />
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </section>
                    </div>

                    <div className={`space-y-4 ${tab === 'inProgress' ? '' : 'hidden'} lg:block`}>
                        <h2 className="hidden lg:block text-xs font-black label text-dim ml-1">경기 진행 · Courts</h2>
                        <div className="grid grid-cols-1 gap-4">
                            {Array.from({ length: roomData.numInProgressCourts }).map((_, cIdx) => {
                                const court = roomData.inProgressCourts?.[cIdx];
                                const busy = !!court;
                                // 새 경기가 이 코트에 방금 들어왔나 — 카드 4장이 착착 꽂히는 연출
                                const sig = (court?.players || []).filter(Boolean).join('|');
                                const isNewGame = !!sig && sig !== courtSigRef.current[cIdx] && !courtFirstRenderRef.current;
                                // 올릴 경기가 있는데 코트가 놀고 있다 — 관리자 시선을 끈다
                                const needsFill = !busy && hasStartable;
                                return (
                                    <div
                                        key={cIdx}
                                        className={`rounded-2xl border transition-all overflow-hidden bg-card ${busy ? '' : 'border-dashed border-white/10'} ${needsFill ? 'court-empty-pulse' : ''}`}
                                        style={busy ? { borderColor: `${accent}66` } : undefined}
                                    >
                                        <div
                                            className={`px-4 py-3 flex justify-between items-center ${busy ? '' : 'border-b border-white/[0.06]'}`}
                                            style={busy ? { backgroundColor: accent } : undefined}
                                        >
                                            <span className={`font-black text-sm tracking-wide ${busy ? 'text-ink' : 'text-muted'}`}>
                                                COURT {cIdx + 1}
                                            </span>
                                            {busy ? (
                                                <div className="flex items-center gap-2">
                                                    <CourtTimer startTime={court.startTime} limitMinutes={courtLimit} />
                                                    {isAdmin && (
                                                        <button
                                                            onClick={() => handleEndMatch(cIdx)}
                                                            className="bg-ink text-txt text-xs font-black px-3 py-1.5 rounded-full active:scale-95 transition-transform"
                                                        >
                                                            경기 종료
                                                        </button>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className={`text-xs font-bold label ${needsFill ? 'text-volt' : 'text-muted'}`}>
                                                    {needsFill ? '다음 경기를 올려주세요' : '대기 중'}
                                                </span>
                                            )}
                                        </div>
                                        <div className={`p-3 ${isNewGame ? 'auto-deal' : ''}`}>
                                            <div className="grid grid-cols-4 gap-2">
                                                {busy ? court.players.map((pid, idx) => {
                                                    if (pid && players[pid]) {
                                                        return (
                                                            <PlayerCard
                                                                key={pid} player={players[pid]} isPlaying isAdmin={isAdmin}
                                                                isCurrentUser={myUid === pid}
                                                                onLongPress={setEditGamePlayer}
                                                            />
                                                        );
                                                    }
                                                    if (pid) return <LeftPlayerCard key={`lc-${cIdx}-${idx}`} isAdmin={false} />;
                                                    return <div key={`e-${cIdx}-${idx}`} className="h-[52px] bg-white/[0.02] rounded-lg border border-white/[0.06]" />;
                                                }) : (
                                                    <div className="col-span-4 h-[52px] flex items-center justify-center text-muted gap-2">
                                                        <Trophy size={18} /><span className="text-sm font-bold">경기가 없습니다</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* 오늘 끝난 경기 복기 — "아까 그 경기 누구랑 누구였지?" */}
                        <button
                            onClick={() => setShowTimeline(true)}
                            className="w-full py-3 rounded-2xl bg-white/[0.03] border border-white/[0.07] text-dim text-xs font-black flex items-center justify-center gap-1.5 hover:text-txt transition-colors"
                        >
                            <Clock size={14} /> 오늘의 매칭 타임라인
                        </button>
                    </div>
                </div>

                {/* 구경만 하는 사람에게는 참가 버튼을, 참가한 사람에게는 나가기를 */}
                {!joined && !ghostActive && peeking && (
                    <button
                        onClick={handleJoin}
                        className="w-full py-4 bg-volt text-ink font-black rounded-full shadow-volt"
                    >
                        이 방에 참가하기
                    </button>
                )}
                <div className="flex items-center justify-center gap-4">
                    {joined && (
                        <button
                            onClick={handleLeaveRoom}
                            className="py-3 text-muted text-xs font-bold flex items-center justify-center gap-1.5 hover:text-coral transition-colors"
                        >
                            <LogOut size={14} /> 이 방에서 나가기
                        </button>
                    )}
                    {user && !isAdmin && (
                        <button
                            onClick={() => setShowReport(true)}
                            className="py-3 text-muted/70 text-[11px] font-bold flex items-center justify-center gap-1 hover:text-coral transition-colors"
                        >
                            <ShieldAlert size={12} /> 신고
                        </button>
                    )}
                </div>
            </main>

            {/* ── 모달 ── */}
            <CourtSelectionModal
                isOpen={!!courtModal}
                onClose={() => setCourtModal(null)}
                courts={courtModal?.courts || []}
                onSelect={(idx) => {
                    room.startMatch(courtModal.matchIndex, idx, courtModal.source);
                    setCourtModal(null);
                }}
            />

            <ShareModal
                isOpen={showShare}
                onClose={() => setShowShare(false)}
                room={roomData}
                roomId={roomId}
                roomName={roomData.name}
                onShowQr={() => setShowQr(true)}
            />

            <QrModal
                isOpen={showQr}
                onClose={() => setShowQr(false)}
                roomId={roomId}
                roomName={roomData.name}
            />

            {/* 참가 직후 한 번 — 알림 권한 유도 (거절해도 모든 기능 그대로) */}
            <NotiPermissionModal
                isOpen={showNotiAsk}
                onClose={() => setShowNotiAsk(false)}
                onNeedInstall={() => setShowInstallGuide(true)}
            />
            <InstallGuideModal isOpen={showInstallGuide} onClose={() => setShowInstallGuide(false)} />

            <SettingsModal
                isOpen={showSettings}
                onClose={() => setShowSettings(false)}
                roomData={roomData}
                players={players}
                onSave={room.saveSettings}
                onEditNotice={() => { setShowSettings(false); setShowNotice(true); }}
                onManageAdmins={() => { setShowSettings(false); setShowAdmins(true); }}
                canManagePassword={isAdmin}
                staleCount={staleList.length}
                onCleanStale={async () => {
                    const ok = await confirm({
                        title: `자리 비운 ${staleList.length}명을 내보낼까요?`,
                        description: staleList.map(p => p.name).join(', '),
                        confirmText: '내보내기',
                        tone: 'danger',
                    });
                    if (ok) room.cleanStale();
                }}
                onReset={async () => {
                    const ok = await confirm({
                        title: '모든 경기 기록을 초기화할까요?',
                        description: '진행 중인 경기와 대기열이 지워집니다. 선수 목록은 그대로예요.',
                        confirmText: '초기화',
                        tone: 'danger',
                    });
                    if (ok) room.resetSystem();
                }}
                onKickAll={async () => {
                    const ok = await confirm({
                        title: '모든 선수를 내보낼까요?',
                        description: '오늘 이 방의 경기 기록이 전부 사라집니다.',
                        confirmText: '전원 내보내기',
                        tone: 'danger',
                    });
                    if (ok) room.kickAll();
                }}
                onReplayGuide={async () => {
                    setShowSettings(false);
                    await resetSeen([ROOM_ADMIN_GUIDE_KEY, AUTOMATCH_GUIDE_KEY]);
                    setShowAdminGuide(true);
                }}
                isGhost={ghostActive}
                onToggleGhost={handleToggleGhost}
            />

            <EditRoomInfoModal
                isOpen={showEditInfo}
                onClose={() => setShowEditInfo(false)}
                roomData={roomData}
                onSave={room.saveRoomInfo}
                onManageAdmins={() => { setShowEditInfo(false); setShowAdmins(true); }}
                canDelete={roomData.adminUid === myUid || superAdmin}
                onDelete={async () => {
                    const ok = await confirm({
                        title: '이 방을 삭제할까요?',
                        description: '선수 명단과 오늘 기록이 함께 사라집니다. 되돌릴 수 없어요.',
                        confirmText: '삭제',
                        tone: 'danger',
                    });
                    if (!ok) return;
                    await room.deleteRoom();
                    toast('방이 삭제되었습니다.');
                    navigate('/game');
                }}
            />

            <AdminManagerModal
                isOpen={showAdmins}
                onClose={() => setShowAdmins(false)}
                room={roomData}
                players={players}
                currentUid={myUid}
                onAppoint={room.appointAdmin}
                onRemove={room.removeAdmin}
                onCreateInvite={room.createInviteCode}
                onRevokeInvite={room.revokeInvite}
            />

            <AdminCodeModal
                isOpen={showAdminCode}
                onClose={() => setShowAdminCode(false)}
                onSubmit={async (code) => {
                    const ok = await room.redeemInvite(code);
                    if (ok) { toast('공동 관리자가 되었습니다! 👑'); setShowAdminCode(false); }
                    else toast.error('코드가 만료되었거나 올바르지 않습니다.');
                }}
            />

            <EditGamesModal
                isOpen={!!editGamePlayer}
                onClose={() => setEditGamePlayer(null)}
                // 길게 누른 순간의 스냅샷이 아니라 '지금' 데이터를 보여준다 —
                // 휴식 토글이 모달 안에서 바로 반영되게
                player={editGamePlayer ? (players[editGamePlayer.id] || editGamePlayer) : null}
                onSave={(id, count) => { room.saveGames(id, count); setEditGamePlayer(null); }}
                onToggleRest={(p) => room.setPlayerResting(p.id, !p.isResting)}
            />

            <BragCardModal
                isOpen={showBrag}
                onClose={() => setShowBrag(false)}
                stat={bragStat}
            />

            <MatchTimelineModal
                isOpen={showTimeline}
                onClose={() => setShowTimeline(false)}
                players={players}
            />

            <NoticeModal
                isOpen={showNotice}
                onClose={() => setShowNotice(false)}
                notice={roomData.notice || ''}
                onSave={async (text) => {
                    noticeSavedByMeRef.current = true;   // 스냅샷이 저장보다 먼저 오므로 미리 표시
                    try { await room.saveNotice(text); }
                    catch (e) { noticeSavedByMeRef.current = false; throw e; }
                }}
            />

            <ReportModal
                isOpen={showReport}
                onClose={() => setShowReport(false)}
                user={user}
                roomId={roomId}
                roomName={roomData.name}
            />

            {matchOptions && (
                <MatchOptionsModal
                    genderLabel={matchOptions.genderLabel}
                    result={matchOptions.result}
                    queueCount={Object.keys(roomData.autoMatches || {}).length}
                    onSelect={handleSelectOption}
                    onRegenerate={() => {
                        try {
                            const result = computeOptions(matchOptions.gender);
                            if (result.status !== 'ok') {
                                toast.error('지금은 매칭할 수 있는 선수가 부족합니다.');
                                return;
                            }
                            setMatchOptions({ ...matchOptions, result });
                        } catch (e) { logError('다시 계산', e); }
                    }}
                    onCancel={() => setMatchOptions(null)}
                />
            )}

            <RoomAdminGuide
                open={showAdminGuide}
                onComplete={finishAdminGuide}
                // '나중에 할게요' — 기록을 안 남기고 닫는다 (다음 접속 때 다시 뜬다)
                onDismiss={() => setShowAdminGuide(false)}
            />

            {showAutoGuide && (
                <AutoMatchGuide
                    userName={userData?.name}
                    onComplete={async () => { setShowAutoGuide(false); await markSeen(AUTOMATCH_GUIDE_KEY); }}
                    onDismiss={() => setShowAutoGuide(false)}
                />
            )}
        </div>
    );
}
