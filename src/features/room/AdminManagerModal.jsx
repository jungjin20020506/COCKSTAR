import React, { useMemo, useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import { useConfirm } from '../../components/ui/confirm';
import { toast } from '../../lib/toast';
import {
    createInvite, isInviteValid, inviteRemainText, inviteLink,
} from '../../lib/adminInvite';
import { Crown, UserPlus, Copy, Link2, X, KeyRound, Search } from '../../components/ui/icons';

// ===================================================================================
// 공동 관리자 관리
// -----------------------------------------------------------------------------------
// 예전에는 "상대에게 고유 코드를 받아서 방장이 손으로 붙여넣기"가 유일한 방법이었다.
// 관리자 한 명 추가하는 데 카톡을 세 번 주고받아야 했다.
//
// 여기서는 세 갈래를 준다. 위에 있는 것일수록 흔한 경우다.
//   ① 명단에서 임명  — 방에 이미 들어와 있는 사람. 탭 한 번. (거의 모든 경우가 여기)
//   ② 초대 링크      — 아직 방에 없는 사람. 링크를 누르면 들어오면서 관리자가 된다
//   ③ 초대 코드      — 링크를 못 쓰는 상황(전화로 불러주기). 6자리, 24시간
//
// 코드는 헷갈리는 글자(0/O, 1/I/L)를 뺀 알파벳으로 만든다. 실제로 전화로 부르는 일이 생긴다.
// ===================================================================================

export function AdminManagerModal({
    isOpen, onClose, room, players, currentUid,
    onAppoint, onRemove, onCreateInvite, onRevokeInvite,
}) {
    const confirm = useConfirm();
    const [search, setSearch] = useState('');
    const [busy, setBusy] = useState(false);

    const ownerUid = room?.adminUid;
    const adminUids = useMemo(() => {
        const set = new Set(room?.adminUids || []);
        if (ownerUid) set.add(ownerUid);
        return set;
    }, [room, ownerUid]);

    const adminNames = room?.adminNames || {};
    const nameOf = (uid) => players?.[uid]?.name || adminNames[uid] || '이름 없음';

    const adminList = useMemo(
        () => [...adminUids].sort((a, b) => (a === ownerUid ? -1 : b === ownerUid ? 1 : 0)),
        [adminUids, ownerUid],
    );

    // 방에 있는데 아직 관리자가 아닌 사람 — 임명 후보
    const candidates = useMemo(() => {
        const q = search.trim().toLowerCase();
        return Object.values(players || {})
            .filter(p => p && !p.isBot && !adminUids.has(p.id))
            .filter(p => !q || (p.name || '').toLowerCase().includes(q))
            .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko'));
    }, [players, adminUids, search]);

    const invite = room?.adminInvite;
    const inviteAlive = isInviteValid(invite);

    const handleAppoint = async (player) => {
        if (busy) return;
        const ok = await confirm({
            title: `${player.name}님을 관리자로?`,
            description: '선수 배치, 경기 시작·종료, 방 설정을 모두 할 수 있게 됩니다.\n나중에 여기서 해제할 수 있어요.',
            confirmText: '임명하기',
        });
        if (!ok) return;
        setBusy(true);
        try {
            await onAppoint(player);
            toast(`${player.name}님이 관리자가 되었습니다.`);
        } finally { setBusy(false); }
    };

    const handleRemove = async (uid) => {
        if (busy) return;
        const self = uid === currentUid;
        const ok = await confirm({
            title: self ? '내 관리자 권한을 뺄까요?' : `${nameOf(uid)}님의 권한을 뺄까요?`,
            description: self
                ? '해제하면 이 방의 설정과 경기 운영을 더 이상 할 수 없어요.\n다시 받으려면 다른 관리자가 임명해줘야 합니다.'
                : '선수로는 그대로 남고, 운영 권한만 없어집니다.',
            confirmText: '권한 해제',
            tone: 'danger',
        });
        if (!ok) return;
        setBusy(true);
        try {
            await onRemove(uid);
            toast('관리자에서 제외했습니다.');
        } finally { setBusy(false); }
    };

    const handleCreateInvite = async () => {
        setBusy(true);
        try {
            const next = createInvite(currentUid, players?.[currentUid]?.name);
            await onCreateInvite(next);
            toast('초대 코드를 만들었습니다. 24시간 동안 쓸 수 있어요.');
        } finally { setBusy(false); }
    };

    const copy = async (text, label) => {
        try {
            await navigator.clipboard.writeText(text);
            toast(`${label}를 복사했습니다.`);
        } catch {
            toast.error('복사에 실패했습니다. 길게 눌러 복사해주세요.');
        }
    };

    const shareLink = async () => {
        const url = inviteLink(room.id, invite.code);
        const data = {
            title: 'COCKSTAR 관리자 초대',
            text: `🏸 '${room.name}' 경기방의 공동 관리자로 초대합니다.`,
            url,
        };
        if (navigator.share) {
            try { await navigator.share(data); return; }
            catch (e) { if (e.name === 'AbortError') return; }
        }
        copy(url, '초대 링크');
    };

    return (
        <Modal
            open={isOpen}
            onClose={onClose}
            title="관리자 관리"
            subtitle="함께 운영할 사람을 추가해요"
            size="max-w-md"
            zIndex="z-[120]"
        >
            {/* ── 현재 관리자 ── */}
            <section className="mb-6">
                <span className="text-[11px] font-black label text-dim block mb-2.5">
                    현재 관리자 {adminList.length}명
                </span>
                <div className="space-y-2">
                    {adminList.map(uid => {
                        const owner = uid === ownerUid;
                        return (
                            <div
                                key={uid}
                                className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06]"
                            >
                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${owner ? 'bg-volt' : 'bg-white/8'}`}>
                                    <Crown size={15} className={owner ? 'text-ink' : 'text-volt'} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-black text-txt truncate">
                                        {nameOf(uid)}
                                        {uid === currentUid && <span className="text-volt text-[11px] ml-1.5">(나)</span>}
                                    </p>
                                    <p className="text-[11px] text-muted font-bold">
                                        {owner ? '방장 · 권한을 뺄 수 없어요' : '공동 관리자'}
                                    </p>
                                </div>
                                {!owner && (
                                    <button
                                        onClick={() => handleRemove(uid)}
                                        aria-label={`${nameOf(uid)} 관리자 해제`}
                                        className="w-8 h-8 rounded-full bg-white/5 text-dim hover:bg-coral/15 hover:text-coral flex items-center justify-center transition-colors shrink-0"
                                    >
                                        <X size={15} />
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* ── ① 명단에서 임명 ── */}
            <section className="mb-6">
                <div className="flex items-center gap-1.5 mb-1">
                    <UserPlus size={14} className="text-volt" />
                    <span className="text-[11px] font-black label text-volt">방에 있는 사람 임명</span>
                </div>
                <p className="text-[12px] text-muted font-medium mb-3 break-keep">
                    가장 빠른 방법이에요. 코드를 주고받을 필요가 없습니다.
                </p>

                {Object.keys(players || {}).length > 6 && (
                    <div className="relative mb-2">
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="이름 검색"
                            className="w-full p-2.5 pl-9 bg-card2 rounded-xl border border-white/10 focus:border-volt outline-none text-sm font-bold text-txt placeholder-muted"
                        />
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                    </div>
                )}

                {candidates.length === 0 ? (
                    <p className="text-[12px] text-muted font-bold text-center py-5 border border-dashed border-white/10 rounded-xl">
                        {search ? '검색 결과가 없어요.' : '임명할 수 있는 사람이 아직 없어요.'}
                    </p>
                ) : (
                    <div className="space-y-1.5 max-h-52 overflow-y-auto hide-scrollbar">
                        {candidates.map(p => (
                            <button
                                key={p.id}
                                onClick={() => handleAppoint(p)}
                                disabled={busy}
                                className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-card2 border border-white/[0.06] hover:border-volt/40 transition-colors text-left disabled:opacity-50"
                            >
                                <span className={`w-1.5 h-8 rounded-full shrink-0 ${p.gender === '남' ? 'bg-blue-500' : 'bg-pink-500'}`} />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-black text-txt truncate">{p.name}</p>
                                    <p className="text-[11px] text-muted font-bold">{p.level || 'N조'} · {p.todayGames || 0}경기</p>
                                </div>
                                <span className="text-[11px] font-black text-volt shrink-0">임명</span>
                            </button>
                        ))}
                    </div>
                )}
            </section>

            {/* ── ② 초대 링크 · 코드 ── */}
            <section>
                <div className="flex items-center gap-1.5 mb-1">
                    <KeyRound size={14} className="text-dim" />
                    <span className="text-[11px] font-black label text-dim">아직 방에 없는 사람</span>
                </div>
                <p className="text-[12px] text-muted font-medium mb-3 break-keep">
                    링크를 보내면 누르는 즉시 관리자가 됩니다. 24시간 뒤 자동으로 만료돼요.
                </p>

                {inviteAlive ? (
                    <div className="rounded-2xl bg-volt/[0.07] border border-volt/30 p-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-black label text-volt">초대 코드</span>
                            <span className="text-[10px] font-black text-muted tabular">{inviteRemainText(invite)}</span>
                        </div>
                        <button
                            onClick={() => copy(invite.code, '코드')}
                            className="w-full text-center text-3xl font-black tabular tracking-[0.28em] text-txt py-2 active:scale-95 transition-transform"
                            aria-label={`초대 코드 ${invite.code.split('').join(' ')} 복사`}
                        >
                            {invite.code}
                        </button>
                        <div className="flex gap-2 mt-3">
                            <button
                                onClick={shareLink}
                                className="flex-1 py-3 bg-volt text-ink font-black rounded-xl text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
                            >
                                <Link2 size={14} /> 초대 링크 보내기
                            </button>
                            <button
                                onClick={() => copy(invite.code, '코드')}
                                aria-label="코드 복사"
                                className="px-4 py-3 bg-white/5 text-dim font-black rounded-xl text-xs"
                            >
                                <Copy size={14} />
                            </button>
                        </div>
                        <button
                            onClick={onRevokeInvite}
                            className="w-full mt-2 py-2 text-[11px] font-bold text-muted hover:text-coral transition-colors"
                        >
                            이 코드 만료시키기
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={handleCreateInvite}
                        disabled={busy}
                        className="w-full py-3.5 bg-white/5 border border-white/10 text-txt font-black rounded-2xl text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-50"
                    >
                        <KeyRound size={16} className="text-volt" /> 초대 코드 만들기
                    </button>
                )}
            </section>
        </Modal>
    );
}
