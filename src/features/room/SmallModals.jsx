import React, { useEffect, useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import { toast } from '../../lib/toast';
import { normalizeCode } from '../../lib/adminInvite';
import { shareRoomToKakao, canKakaoShare } from '../../lib/kakaoShare';
import { Share2, Copy, ChevronRight, KeyRound, Trophy, MessageSquare } from '../../components/ui/icons';

// ===================================================================================
// 작은 모달 모음 — 각각 40~80줄이라 파일을 따로 두면 오히려 찾기 어렵다
// ===================================================================================

/** 경기방 초대 링크 공유 — 카카오톡 카드가 1순위, 안 되면 폰 공유 시트, 마지막이 복사 */
export function ShareModal({ isOpen, onClose, room, roomId, roomName }) {
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

/** 경기 수 수정 + 오늘 함께 친 사람 보기 */
export function EditGamesModal({ isOpen, onClose, player, onSave }) {
    const [games, setGames] = useState(0);

    useEffect(() => { if (isOpen && player) setGames(player.todayGames || 0); }, [isOpen, player]);

    if (!player) return null;

    return (
        <Modal open={isOpen} onClose={onClose} variant="center" size="max-w-sm" ariaLabel={`${player.name} 경기 수 수정`}>
            <div className="text-center mb-6 pt-2">
                <h3 className="text-lg font-black text-txt kern-tight mb-0.5">{player.name}</h3>
                <p className="text-[11px] text-muted font-bold label">경기 수 · 히스토리</p>
            </div>

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
