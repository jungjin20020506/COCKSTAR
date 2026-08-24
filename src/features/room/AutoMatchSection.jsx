import React, { useEffect, useRef } from 'react';
import { PlayerCard, LeftPlayerCard } from './PlayerCard';
import { PLAYERS_PER_MATCH } from '../../constants';

// ===================================================================================
// [자동 매칭] 대기열 섹션
// -----------------------------------------------------------------------------------
// '경기 배정(수동)' 섹션과 나란히 놓이는 두 번째 대기열이다. 둘은 정책이 다르다.
//
//              자동 매칭                      경기 배정 (기존)
//   만드는 법   버튼 → 후보 6개 중 선택        관리자가 슬롯을 눌러 손으로 채움
//   항목       항상 4명 꽉 찬 배열            null이 섞일 수 있는 4칸
//   개수       가변 (추가한 만큼)             고정 (numScheduledMatches)
//   고장났을 때  경기 통째로 해체              해당 슬롯만 비움 (관리자 의도 존중)
// ===================================================================================

export function AutoMatchSection({
    autoMatches, players, isAdmin, currentUserId,
    inProgressPlayerIds, courtIndexByPlayer,
    onGenerate, generatingGender,
    onStart, onDelete, onClearAll, onRemovePlayer,
}) {
    const pressTimerRef = useRef(null);

    // 값이 배열이 아닌 항목은 아예 걸러낸다.
    // 예전 버전이 남긴 데이터나 손으로 고친 문서가 섞이면 아래 match.map 에서 화면이 통째로 죽는다.
    const matchList = Object.entries(autoMatches || {})
        .filter(([, m]) => Array.isArray(m))
        .sort((a, b) => Number(a[0]) - Number(b[0]));

    // ── 경기 번호를 길게 누르면 그 경기 삭제 ──
    const handlePressStart = (matchIndex) => {
        if (!isAdmin) return;
        if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
        pressTimerRef.current = setTimeout(() => onDelete(matchIndex), 800);
    };
    const handlePressEnd = () => {
        if (pressTimerRef.current) { clearTimeout(pressTimerRef.current); pressTimerRef.current = null; }
    };
    useEffect(() => handlePressEnd, []);

    // ── [연출] 새로 만들어진 매칭에만 카드가 착착 꽂히는 애니메이션 ──
    // 기준을 '경기 번호'가 아니라 '선수 구성 시그니처'로 잡는 게 요령이다.
    // 번호로 기억하면 경기를 시작해 번호가 당겨질 때마다 남은 경기들이 전부
    // '새것'으로 보여서 애니메이션이 우수수 다시 재생된다.
    const dealSeenRef = useRef(new Set());
    const isFirstRenderRef = useRef(true);
    const matchSig = (match) => (match || []).filter(Boolean).join('|');

    if (isFirstRenderRef.current) {
        // 늦게 들어온 사람에게 기존 매칭이 우르르 쏟아지지 않도록 첫 렌더는 전부 '본 것'으로 처리
        matchList.forEach(([, m]) => { const s = matchSig(m); if (s) dealSeenRef.current.add(s); });
        isFirstRenderRef.current = false;
    }
    const newDealSigs = new Set(
        matchList.map(([, m]) => matchSig(m)).filter(s => s && !dealSeenRef.current.has(s)),
    );
    useEffect(() => {
        matchList.forEach(([, m]) => { const s = matchSig(m); if (s) dealSeenRef.current.add(s); });
    });

    const nameOf = (id) => players[id]?.name || '나간 선수';

    return (
        <section className="space-y-3">
            <div className="flex justify-between items-center ml-1">
                <h2 className="text-xs font-black label text-dim">🤖 자동 매칭 · Auto</h2>
                {isAdmin && matchList.length > 0 && (
                    <button
                        onClick={onClearAll}
                        className="text-[11px] font-black text-coral bg-coral/10 border border-coral/30 rounded-full px-3 py-1"
                    >
                        전체 삭제
                    </button>
                )}
            </div>

            {isAdmin && (
                <div className="auto-make-row">
                    {[
                        { key: '남', cls: 'male', label: '👨 남자 매칭' },
                        { key: '여', cls: 'female', label: '👩 여자 매칭' },
                        { key: '혼복', cls: 'mixed', label: '💑 혼복 매칭' },
                    ].map(b => (
                        <button
                            key={b.key}
                            type="button"
                            className={`auto-make-btn ${b.cls}`}
                            onClick={() => onGenerate(b.key)}
                            disabled={!!generatingGender}
                        >
                            {generatingGender === b.key ? '계산 중...' : b.label}
                        </button>
                    ))}
                </div>
            )}

            {matchList.length === 0 && (
                <div className="bg-card rounded-2xl p-5 border border-white/[0.06] text-center">
                    <p className="text-sm text-dim font-bold">만들어진 자동 매칭이 없습니다.</p>
                    <p className="text-xs text-muted mt-1.5 font-medium leading-relaxed">
                        {isAdmin
                            ? <>위 버튼을 누르면 후보 6개를 이유와 함께 보여줍니다.<br />마음에 드는 조합을 고르면 여기에 추가돼요.</>
                            : <>관리자가 매칭을 만들면 여기에 표시됩니다.</>}
                    </p>
                </div>
            )}

            {matchList.map(([matchIndex, match]) => {
                const ids = (match || []).filter(Boolean);

                // 이 경기를 지금 시작할 수 있는지 판단한다.
                //  · onCourt : 아직 코트에서 뛰는 중 (그 경기가 끝나야 시작 가능)
                //  · broken  : 나갔거나 휴식으로 바뀜 (자리를 채우거나 경기를 지워야 함)
                const onCourtIds = ids.filter(id => inProgressPlayerIds.has(id));
                const brokenIds = ids.filter(id => !players[id] || players[id].isResting);
                const canStart = ids.length === PLAYERS_PER_MATCH && onCourtIds.length === 0 && brokenIds.length === 0;

                const waitCourts = [...new Set(
                    onCourtIds.map(id => courtIndexByPlayer[id]).filter(i => i !== undefined),
                )].sort((a, b) => a - b);

                // 왜 아직 못 시작하는지 한 줄로 알려준다 (안 알려주면 버튼이 고장난 줄 안다)
                let note = null;
                if (brokenIds.length > 0) {
                    note = { broken: true, text: `${brokenIds.map(nameOf).join('·')} 빠짐 — 곧 자동으로 정리됩니다` };
                } else if (onCourtIds.length > 0) {
                    const courtText = waitCourts.length ? `${waitCourts.map(c => c + 1).join('·')}번 코트` : '진행 중인 경기';
                    note = { broken: false, text: `${courtText}가 끝나면 시작 — 경기중: ${onCourtIds.map(nameOf).join('·')}` };
                }

                const isNewDeal = newDealSigs.has(matchSig(match));

                return (
                    <div key={`auto-${matchIndex}`} className={`auto-row ${isNewDeal ? 'auto-deal' : ''}`}>
                        {note && (
                            <div className={`auto-wait-note ${note.broken ? 'broken' : ''}`}>
                                <span>{note.broken ? '⚠️' : '⏳'}</span>
                                <span className="truncate">{note.text}</span>
                            </div>
                        )}
                        <div className="flex items-center w-full gap-1.5">
                            <div
                                className="flex-shrink-0 w-7 text-center select-none cursor-pointer"
                                onMouseDown={() => handlePressStart(matchIndex)}
                                onMouseUp={handlePressEnd} onMouseLeave={handlePressEnd}
                                onTouchStart={() => handlePressStart(matchIndex)}
                                onTouchEnd={handlePressEnd} onTouchCancel={handlePressEnd}
                                title={isAdmin ? '길게 누르면 이 경기가 삭제됩니다' : undefined}
                            >
                                <p className="font-black text-lg text-txt tabular">{Number(matchIndex) + 1}</p>
                            </div>
                            <div className="grid grid-cols-4 gap-1.5 flex-1 min-w-0">
                                {match.map((pid, sIdx) => (
                                    pid && players[pid] ? (
                                        <PlayerCard
                                            key={`${pid}-${matchIndex}-${sIdx}`}
                                            player={players[pid]}
                                            isAdmin={isAdmin}
                                            isCurrentUser={currentUserId === pid}
                                            isPlaying={inProgressPlayerIds.has(pid)}
                                            isResting={players[pid].isResting}
                                            onDeleteClick={() => onRemovePlayer(matchIndex, sIdx)}
                                        />
                                    ) : (
                                        <LeftPlayerCard key={`auto-left-${matchIndex}-${sIdx}`} isAdmin={false} />
                                    )
                                ))}
                            </div>
                            <div className="flex-shrink-0 w-16">
                                {isAdmin ? (
                                    <button
                                        type="button"
                                        className={`auto-start-btn ${canStart ? 'go' : (brokenIds.length > 0 ? 'fix' : 'wait')}`}
                                        disabled={!canStart}
                                        onClick={() => onStart(matchIndex)}
                                    >
                                        {brokenIds.length > 0 ? '정리중' : (onCourtIds.length > 0 ? '대기' : '경기 시작')}
                                    </button>
                                ) : (
                                    <span className="block text-center text-[10px] font-black text-muted">
                                        {canStart ? '시작 대기' : '진행 대기'}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })}
        </section>
    );
}
