import React, { useMemo } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Clock } from '../../components/ui/icons';

// ===================================================================================
// 오늘의 매칭 타임라인 — 관리자 복기용
// -----------------------------------------------------------------------------------
// "아까 그 경기 누구랑 누구였지?" 를 답하는 화면이다.
// 별도 저장 없이, 각 선수의 오늘 경기 기록(todayRecentGames)을 합쳐서 복원한다 —
// 같은 경기는 4명 모두에게 같은 timestamp 로 저장되므로 그 값으로 묶으면 된다.
//
// ⚠️ 한계: 선수가 방을 나가면 그 사람의 기록도 함께 사라진다. 남은 사람들의
//    기록에는 상대로 남아 있어 경기는 복원되지만, 4명 전원이 나간 경기는 안 보인다.
// ===================================================================================

export function MatchTimelineModal({ isOpen, onClose, players }) {
    const games = useMemo(() => {
        if (!isOpen) return [];
        const byTs = new Map();   // timestamp → Set(참가자 id)
        Object.values(players || {}).forEach(p => {
            (Array.isArray(p.todayRecentGames) ? p.todayRecentGames : []).forEach(g => {
                if (!g || g.isManual || !g.timestamp) return;
                let set = byTs.get(g.timestamp);
                if (!set) { set = new Set(); byTs.set(g.timestamp, set); }
                set.add(p.id);
                (g.partners || []).forEach(id => id && set.add(id));
                (g.opponents || []).forEach(id => id && set.add(id));
            });
        });
        return [...byTs.entries()]
            .map(([ts, ids]) => ({ ts, ids: [...ids] }))
            .sort((a, b) => new Date(b.ts) - new Date(a.ts));
    }, [isOpen, players]);

    const nameOf = (id) => players?.[id]?.name || '나간 선수';
    const levelOf = (id) => players?.[id]?.level?.[0] || '';

    return (
        <Modal
            open={isOpen}
            onClose={onClose}
            title="오늘의 매칭 타임라인"
            subtitle={`끝난 경기 ${games.length}개 · 최신순`}
            size="max-w-md"
        >
            {games.length === 0 ? (
                <div className="text-center py-12">
                    <Clock size={26} className="text-muted mx-auto mb-3" />
                    <p className="text-sm text-dim font-bold">아직 끝난 경기가 없습니다</p>
                    <p className="text-[11px] text-muted font-medium mt-1">경기 종료를 누르면 여기에 쌓여요.</p>
                </div>
            ) : (
                <div className="relative pl-5">
                    {/* 세로 타임라인 선 */}
                    <div className="absolute left-[7px] top-2 bottom-2 w-px bg-white/10" />
                    <div className="space-y-3">
                        {games.map((g, i) => {
                            const d = new Date(g.ts);
                            const timeText = Number.isFinite(d.getTime())
                                ? d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
                                : '';
                            return (
                                <div key={g.ts} className="relative">
                                    <span className={`absolute -left-5 top-1.5 w-[9px] h-[9px] rounded-full border-2 border-ink ${i === 0 ? 'bg-volt' : 'bg-white/30'}`} />
                                    <div className="bg-card rounded-2xl border border-white/[0.06] p-3.5">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-[11px] font-black text-volt tabular">{timeText}</span>
                                            <span className="text-[10px] font-black text-muted label">GAME {games.length - i}</span>
                                        </div>
                                        <div className="flex flex-wrap gap-1.5">
                                            {g.ids.map(id => (
                                                <span
                                                    key={id}
                                                    className="text-[11px] font-black px-2 py-1 rounded-lg bg-white/[0.05] border border-white/[0.07] text-txt"
                                                >
                                                    {levelOf(id) && <span className="text-dim mr-0.5">{levelOf(id)}</span>}
                                                    {nameOf(id)}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </Modal>
    );
}
