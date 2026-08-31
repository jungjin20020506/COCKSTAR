import React, { useEffect, useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import { toast } from '../../lib/toast';
import { normalizeCode } from '../../lib/adminInvite';
import { shareRoomToKakao, canKakaoShare } from '../../lib/kakaoShare';
import {
    Share2, Copy, ChevronRight, KeyRound, Trophy, MessageSquare, QrCode, BellRing,
} from '../../components/ui/icons';
import {
    notificationsSupported, notificationPermission, requestNotificationPermission, notify,
} from '../../lib/notify';
import { isIOS, isStandalone } from '../../components/ui/InstallPrompt';

// ===================================================================================
// 작은 모달 모음 — 각각 40~80줄이라 파일을 따로 두면 오히려 찾기 어렵다
// ===================================================================================

/** 경기방 초대 링크 공유 — 카카오톡 카드가 1순위, 안 되면 폰 공유 시트, 마지막이 복사 */
export function ShareModal({ isOpen, onClose, room, roomId, roomName, onShowQr }) {
    const shareUrl = `${window.location.origin}/room/${roomId}`;

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(shareUrl);
            toast('초대 링크가 복사되었습니다!');
            onClose();
        } catch {
            toast.error('복사에 실패했습니다. 주소를 길게 눌러 복사해주세요.');
        }
    };

    const kakao = () => {
        const ok = shareRoomToKakao(room || { name: roomName }, shareUrl);
        if (ok) { onClose(); return; }
        toast.error('카카오톡 공유를 열지 못했어요. 링크를 복사해 보내주세요.');
    };

    const systemShare = async () => {
        if (!navigator.share) { copy(); return; }
        try {
            await navigator.share({
                title: 'COCKSTAR 경기 초대',
                text: `🏸 '${roomName || '경기방'}'에 초대합니다!`,
                url: shareUrl,
            });
            onClose();
        } catch (e) {
            if (e?.name !== 'AbortError') copy();
        }
    };

    return (
        <Modal open={isOpen} onClose={onClose} variant="center" size="max-w-xs" ariaLabel="경기방 초대">
            <div className="text-center mb-6 pt-2">
                <div className="w-16 h-16 bg-volt rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Share2 size={28} className="text-ink" />
                </div>
                <h3 className="text-lg font-black text-txt kern-tight">경기방 초대</h3>
                <p className="text-xs text-dim mt-1 font-medium">
                    {roomName ? `'${roomName}'에 크루를 소환하세요.` : '링크를 복사해 크루를 소환하세요.'}
                </p>
            </div>
            <div className="bg-white/5 p-3 rounded-xl mb-5 break-all">
                <p className="text-xs font-bold text-dim leading-relaxed">{shareUrl}</p>
            </div>
            <div className="space-y-2">
                {canKakaoShare() && (
                    <button
                        data-autofocus
                        onClick={kakao}
                        className="w-full py-3.5 bg-[#FEE500] text-[#1a1a1a] font-black rounded-full flex items-center justify-center gap-2"
                    >
                        <MessageSquare size={18} fill="#1a1a1a" /> 카카오톡으로 초대하기
                    </button>
                )}
                <button
                    onClick={systemShare}
                    className="w-full py-3.5 bg-volt text-ink font-black rounded-full flex items-center justify-center gap-2 shadow-volt"
                >
                    <Share2 size={18} /> 다른 앱으로 공유
                </button>
                <button
                    onClick={copy}
                    className="w-full py-3 bg-white/5 text-dim font-black rounded-full flex items-center justify-center gap-2 text-sm"
                >
                    <Copy size={16} /> 링크만 복사
                </button>
                {onShowQr && (
                    <button
                        onClick={() => { onClose(); onShowQr(); }}
                        className="w-full py-3 bg-white/5 text-dim font-black rounded-full flex items-center justify-center gap-2 text-sm"
                    >
                        <QrCode size={16} /> QR 코드로 초대
                    </button>
                )}
                <button onClick={onClose} className="w-full py-2.5 text-muted text-sm font-bold">닫기</button>
            </div>
        </Modal>
    );
}

/** 빈 코트가 여럿일 때 어느 코트에서 시작할지 */
export function CourtSelectionModal({ isOpen, onClose, courts, onSelect }) {
    return (
        <Modal open={isOpen} onClose={onClose} variant="center" size="max-w-sm" ariaLabel="코트 선택">
            <h3 className="text-xl font-black kern-tight text-center text-txt pt-2">코트 선택</h3>
            <p className="text-dim text-sm text-center mb-6 font-bold">경기를 시작할 코트를 선택해주세요.</p>
            <div className="space-y-3">
                {courts.map((idx, i) => (
                    <button
                        key={idx}
                        data-autofocus={i === 0 ? true : undefined}
                        onClick={() => onSelect(idx)}
                        className="w-full py-4 bg-white/5 hover:bg-volt hover:text-ink border border-white/10 hover:border-volt rounded-2xl text-lg font-black transition-all duration-200 flex justify-between items-center px-6 group text-txt"
                    >
                        <span className="flex items-center gap-2"><Trophy size={18} /> COURT {idx + 1}</span>
                        <ChevronRight className="text-muted group-hover:text-ink" />
                    </button>
                ))}
            </div>
            <button onClick={onClose} className="mt-6 w-full py-3 text-dim font-black hover:bg-white/5 rounded-full transition-colors">
                취소
            </button>
        </Modal>
    );
}

/** 경기 수 수정 + 휴식/복귀 전환 + 오늘 함께 친 사람 보기 (관리자가 카드를 길게 눌러 연다) */
export function EditGamesModal({ isOpen, onClose, player, onSave, onToggleRest }) {
    const [games, setGames] = useState(0);

    // player?.id 로 좁힌다 — 휴식 토글로 player 객체가 갱신될 때마다
    // 손으로 고치던 경기 수가 원래 값으로 되돌아가면 안 된다
    const playerId = player?.id;
    useEffect(() => {
        if (isOpen && playerId) setGames(player?.todayGames || 0);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, playerId]);

    if (!player) return null;

    return (
        <Modal open={isOpen} onClose={onClose} variant="center" size="max-w-sm" ariaLabel={`${player.name} 선수 관리`}>
            <div className="text-center mb-5 pt-2">
                <h3 className="text-lg font-black text-txt kern-tight mb-0.5">
                    {player.name}
                    {player.isResting && <span className="ml-1.5 text-[11px] font-black text-dim align-middle">😴 휴식 중</span>}
                </h3>
                <p className="text-[11px] text-muted font-bold label">선수 관리 · 경기 수 · 히스토리</p>
            </div>

            {/* 휴식/복귀 — 본인 폰이 없거나 꺼져 있을 때 관리자가 대신 바꿔준다 */}
            {onToggleRest && (
                <button
                    onClick={() => onToggleRest(player)}
                    className={`w-full py-3 mb-5 font-black rounded-xl text-sm transition-colors flex justify-center items-center gap-2 ${
                        player.isResting
                            ? 'bg-volt text-ink shadow-volt'
                            : 'bg-white/5 text-dim border border-white/10 hover:bg-white/10'
                    }`}
                >
                    {player.isResting ? '🏸 복귀시키기 (매칭에 다시 들어감)' : '😴 휴식으로 변경'}
                </button>
            )}

            <div className="flex items-center justify-center gap-6 mb-8 bg-white/[0.03] py-5 rounded-2xl border border-white/[0.06]">
                <button
                    aria-label="경기 수 1 줄이기"
                    onClick={() => setGames(g => Math.max(0, g - 1))}
                    className="w-11 h-11 rounded-full bg-card2 border border-white/10 text-txt font-black text-xl active:scale-90 transition-transform"
                >
                    −
                </button>
                <span className="text-4xl font-display text-volt w-14 tabular text-center" aria-live="polite">{games}</span>
                <button
                    aria-label="경기 수 1 늘리기"
                    onClick={() => setGames(g => g + 1)}
                    className="w-11 h-11 rounded-full bg-volt text-ink font-black text-xl active:scale-90 transition-transform"
                >
                    +
                </button>
            </div>

            <div className="mb-6">
                <h4 className="text-[11px] font-black label text-dim mb-3 text-left pl-1">오늘 함께한 선수들</h4>
                <div className="space-y-2 max-h-40 overflow-y-auto hide-scrollbar">
                    {player.matchHistory?.length > 0 ? (
                        player.matchHistory.map((line, idx) => (
                            <div key={idx} className="bg-white/[0.03] p-2.5 rounded-xl border border-white/[0.06] flex items-start gap-3">
                                <span className="text-[10px] font-black text-volt pt-1 shrink-0">
                                    {player.matchHistory.length - idx}.
                                </span>
                                <div className="flex flex-wrap gap-1">
                                    {line.split(', ').map((name, nIdx) => (
                                        <span
                                            key={nIdx}
                                            className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold ${
                                                name.includes(player.name)
                                                    ? 'bg-volt text-ink'
                                                    : 'bg-white/5 text-dim border border-white/10'
                                            }`}
                                        >
                                            {name}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="text-[11px] text-muted py-6 text-center border-2 border-dashed border-white/10 rounded-xl font-bold">
                            아직 경기 기록이 없습니다.
                        </p>
                    )}
                </div>
            </div>

            <div className="flex gap-3">
                <button onClick={onClose} className="flex-1 py-3.5 bg-white/5 text-dim font-black rounded-full text-sm">취소</button>
                <button
                    onClick={() => onSave(player.id, games)}
                    className="flex-1 py-3.5 bg-volt text-ink font-black rounded-full text-sm shadow-volt"
                >
                    저장
                </button>
            </div>
        </Modal>
    );
}

/**
 * 경기방 QR 초대 — 체육관 벽·데스크에 폰을 세워 두면 오는 사람마다 스캔해서 들어온다.
 *
 * QR 라이브러리는 무겁지 않지만 방에 들어와야 쓰는 물건이라 열 때 동적으로 받는다.
 * 스캔 결과는 공유 링크와 같은 주소(/room/:id)다 — 카메라 앱이 바로 열어준다.
 */
export function QrModal({ isOpen, onClose, roomId, roomName }) {
    const [dataUrl, setDataUrl] = useState(null);
    const [failed, setFailed] = useState(false);
    const shareUrl = `${window.location.origin}/room/${roomId}`;

    useEffect(() => {
        if (!isOpen) return undefined;
        let cancelled = false;
        setFailed(false);
        import('qrcode')
            .then(m => (m.default || m).toDataURL(shareUrl, {
                width: 640,
                margin: 2,
                errorCorrectionLevel: 'M',
                color: { dark: '#08090C', light: '#FFFFFF' },
            }))
            .then(url => { if (!cancelled) setDataUrl(url); })
            .catch(() => { if (!cancelled) setFailed(true); });
        return () => { cancelled = true; };
    }, [isOpen, shareUrl]);

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(shareUrl);
            toast('초대 링크가 복사되었습니다!');
        } catch {
            toast.error('복사에 실패했습니다.');
        }
    };

    return (
        <Modal open={isOpen} onClose={onClose} variant="center" size="max-w-xs" ariaLabel="경기방 QR 초대">
            <div className="text-center mb-4 pt-2">
                <div className="w-14 h-14 bg-volt rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <QrCode size={26} className="text-ink" />
                </div>
                <h3 className="text-lg font-black text-txt kern-tight">QR로 입장하기</h3>
                <p className="text-xs text-dim mt-1 font-medium break-keep">
                    {roomName ? `'${roomName}'` : '이 경기방'} — 카메라로 스캔하면 바로 입장돼요.
                </p>
            </div>

            <div className="bg-white rounded-2xl p-3 mb-4 flex items-center justify-center min-h-[240px]">
                {failed ? (
                    <p className="text-xs font-bold text-neutral-500 text-center px-4 break-keep">
                        QR 이미지를 만들지 못했어요.<br />아래 링크 복사로 초대해주세요.
                    </p>
                ) : dataUrl ? (
                    <img src={dataUrl} alt="경기방 입장 QR 코드" className="w-full h-auto rounded-lg" />
                ) : (
                    <p className="text-xs font-bold text-neutral-400">QR 만드는 중...</p>
                )}
            </div>

            <div className="bg-white/5 p-2.5 rounded-xl mb-4 break-all">
                <p className="text-[11px] font-bold text-dim leading-relaxed text-center">{shareUrl}</p>
            </div>

            <div className="space-y-2">
                <button
                    onClick={copy}
                    className="w-full py-3 bg-white/5 text-dim font-black rounded-full flex items-center justify-center gap-2 text-sm"
                >
                    <Copy size={16} /> 링크 복사
                </button>
                <button data-autofocus onClick={onClose} className="w-full py-3 bg-volt text-ink font-black rounded-full text-sm">
                    닫기
                </button>
            </div>
        </Modal>
    );
}

const NOTI_ASK_KEY = 'cockstar-noti-ask-done';

/** 이 기기에서 알림 권한을 물어볼 필요가 있는가 (참가 직후 한 번만) */
export function shouldAskNotification() {
    try { if (localStorage.getItem(NOTI_ASK_KEY) === '1') return false; } catch { /* noop */ }
    // 안드로이드·데스크톱: 권한이 '아직 안 물어본' 상태일 때
    if (notificationsSupported()) return notificationPermission() === 'default';
    // 아이폰 사파리(비설치): 알림 API 자체가 없다 — 설치하면 받을 수 있다고 안내한다
    return isIOS() && !isStandalone();
}

/**
 * 알림 권한 유도 — 방에 참가한 직후 한 번.
 *
 * 브라우저 권한 창은 '사용자가 버튼을 누른 직후'에만 뜰 수 있으므로,
 * 여기서 가치를 설명하고 큰 버튼 하나로 이어준다. 거절해도 앱은 그대로 쓸 수 있다.
 * 아이폰 사파리(비설치)에서는 권한 창 자체가 없으므로 설치 안내로 이어준다.
 */
export function NotiPermissionModal({ isOpen, onClose, onNeedInstall }) {
    const supported = notificationsSupported();

    const markDone = () => {
        try { localStorage.setItem(NOTI_ASK_KEY, '1'); } catch { /* noop */ }
    };

    const enable = async () => {
        markDone();
        const result = await requestNotificationPermission();
        onClose();
        if (result === 'granted') {
            notify({ title: '알림이 켜졌습니다 🔔', body: '내 차례가 오면 진동·소리와 함께 알려드릴게요.', tag: 'noti-test' });
        } else if (result === 'denied') {
            toast('알림이 꺼져 있어도 앱 화면에는 항상 표시돼요.');
        }
    };

    const later = () => { markDone(); onClose(); };

    return (
        <Modal open={isOpen} onClose={later} variant="center" size="max-w-xs" ariaLabel="경기 알림 켜기" zIndex="z-[150]">
            <div className="text-center mb-5 pt-2">
                <div className="w-16 h-16 bg-volt rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pop">
                    <BellRing size={30} className="text-ink" />
                </div>
                <h3 className="text-lg font-black text-txt kern-tight mb-2">내 차례를 놓치지 마세요</h3>
                <p className="text-sm text-dim font-medium leading-relaxed break-keep">
                    <b className="text-txt">다음 경기가 나일 때</b>, 그리고 <b className="text-txt">코트에 들어갈 때</b><br />
                    진동·소리와 함께 알려드려요.
                </p>
            </div>

            {supported ? (
                <div className="space-y-2">
                    <button
                        data-autofocus
                        onClick={enable}
                        className="w-full py-4 bg-volt text-ink font-black rounded-full shadow-volt text-sm"
                    >
                        🔔 알림 켜기
                    </button>
                    <button onClick={later} className="w-full py-2.5 text-muted text-sm font-bold">
                        나중에 할게요
                    </button>
                    <p className="text-[10px] text-muted font-medium text-center break-keep">
                        다음 화면에서 <b className="text-dim">허용</b>을 눌러주세요. 언제든 끌 수 있어요.
                    </p>
                </div>
            ) : (
                <div className="space-y-2">
                    <p className="text-[11px] text-muted font-medium text-center break-keep mb-1">
                        아이폰은 <b className="text-dim">홈 화면에 추가</b>하면 알림을 받을 수 있어요. (iOS 16.4+)
                    </p>
                    <button
                        data-autofocus
                        onClick={() => { markDone(); onClose(); onNeedInstall?.(); }}
                        className="w-full py-4 bg-volt text-ink font-black rounded-full shadow-volt text-sm"
                    >
                        홈 화면에 추가하는 방법 보기
                    </button>
                    <button onClick={later} className="w-full py-2.5 text-muted text-sm font-bold">
                        나중에 할게요
                    </button>
                </div>
            )}
        </Modal>
    );
}

/**
 * 관리자 초대 코드 입력.
 *
 * 초대 '링크'를 누르면 이 창 없이 바로 등록되므로, 여기는 링크를 못 쓰는 경우
 * (전화로 코드를 불러줬거나, 링크가 카톡에서 안 열리는 경우)를 위한 뒷문이다.
 */
export function AdminCodeModal({ isOpen, onClose, onSubmit }) {
    const [code, setCode] = useState('');
    const [busy, setBusy] = useState(false);

    useEffect(() => { if (isOpen) { setCode(''); setBusy(false); } }, [isOpen]);

    const submit = async (e) => {
        e.preventDefault();
        if (code.length < 6) { toast.error('6자리 코드를 입력해주세요.'); return; }
        setBusy(true);
        try { await onSubmit(code); }
        finally { setBusy(false); }
    };

    return (
        <Modal open={isOpen} onClose={onClose} variant="center" size="max-w-xs" ariaLabel="관리자 코드 입력">
            <div className="text-center mb-5 pt-2">
                <div className="w-14 h-14 bg-volt/15 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <KeyRound size={24} className="text-volt" />
                </div>
                <h3 className="text-lg font-black text-txt kern-tight">관리자 코드 입력</h3>
                <p className="text-xs text-dim mt-1.5 font-medium leading-relaxed break-keep">
                    방장에게 받은 6자리 코드를 넣으면<br />이 방의 공동 관리자가 됩니다.
                </p>
            </div>
            <form onSubmit={submit} className="space-y-3">
                <input
                    data-autofocus
                    type="text"
                    inputMode="text"
                    autoCapitalize="characters"
                    autoComplete="one-time-code"
                    maxLength={7}
                    placeholder="ABC123"
                    value={code}
                    onChange={e => setCode(normalizeCode(e.target.value))}
                    className="w-full p-4 bg-card2 rounded-2xl border border-white/10 focus:border-volt outline-none text-center text-2xl font-black tracking-[0.3em] tabular text-txt placeholder-muted"
                />
                <button
                    type="submit"
                    disabled={busy}
                    className="w-full py-4 bg-volt text-ink font-black rounded-full shadow-volt disabled:opacity-60"
                >
                    {busy ? '확인 중...' : '관리자 되기'}
                </button>
                <button type="button" onClick={onClose} className="w-full py-2 text-dim text-sm font-bold">닫기</button>
            </form>
        </Modal>
    );
}
