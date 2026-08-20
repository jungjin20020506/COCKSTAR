import React, { useState } from 'react';
import { getLevelHex } from '../lib/matchQueues';

// ===================================================================================
// [자동매칭] 매칭 후보 고르기 — 이 기능의 얼굴이 되는 화면
// -----------------------------------------------------------------------------------
// 앱이 혼자 정하지 않는다. 후보 6개(베스트 2 · 보통 2 · 아쉬움 2)를 '왜 이 조합인지'
// 이유와 함께 보여주고, 관리자가 마음에 드는 걸 고른다.
// 실사용에서 "앱이 정해준다"보다 만족도가 훨씬 높았던 부분이다.
//
// 모바일에서는 아래에서 올라오는 바텀시트, 640px 이상에서는 가운데 다이얼로그.
// ===================================================================================

/** 선택지 카드 안의 작은 선수 칩 */
function OptionPlayerChip({ player }) {
    const levelColor = getLevelHex(player.level);
    return (
        <div className={`mo-chip ${player.onCourt ? 'playing' : ''}`}>
            <div className="mo-chip-name">{player.name}</div>
            <div className="mo-chip-sub">
                {/* 경기중인 선수는 급수 색까지 회색으로 죽여서 '아직 못 움직인다'를 분명히 한다 */}
                <span style={{ color: player.onCourt ? '#9aa0aa' : levelColor }}>
                    {(player.level || 'N조').replace('조', '')}
                </span>
                <span className="mo-chip-games">{player.realGames}G</span>
            </div>
            {player.onCourt && <span className="mo-chip-tag">경기중</span>}
        </div>
    );
}

/**
 * @param {string}   genderLabel  '남자' | '여자' | '혼복'
 * @param {object}   result       generateMatchOptions()의 반환값
 * @param {number}   queueCount   자동 매칭 목록에 이미 들어 있는 경기 수
 * @param {function} onSelect     (option) => Promise — 고른 조합을 목록에 넣는다
 * @param {function} onRegenerate 지금 코트 상황으로 후보를 새로 뽑는다
 * @param {function} onCancel     닫기
 */
function MatchOptionsModal({ genderLabel, result, queueCount, onSelect, onRegenerate, onCancel }) {
    const [pageIndex, setPageIndex] = useState(0);
    const [busy, setBusy] = useState(false);

    const pages = result?.pages || [];
    const options = pages[pageIndex] || [];
    const hasMorePages = pages.length > 1;

    const handlePick = async (option) => {
        if (busy) return;
        setBusy(true);
        try { await onSelect(option); } finally { setBusy(false); }
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex items-end sm:items-center justify-center z-[70] p-0 sm:p-4">
            <div className="mo-sheet">

                {/* ── 머리말 ── */}
                <div className="mo-head">
                    <div className="min-w-0">
                        <h3 className="mo-title">{genderLabel} 매칭 고르기</h3>
                        <p className="mo-sub">
                            후보 {result.poolSize}명 · 대기 {result.waitingCount}명 · 경기중 {result.onCourtCount}명
                            {queueCount > 0 && <> · 목록에 {queueCount}경기 대기</>}
                        </p>
                    </div>
                    <button onClick={onCancel} className="mo-close" aria-label="닫기">&times;</button>
                </div>

                {/* ── 지금 상황이 안 좋으면 솔직하게 알려준다 ──
                    순위(베스트)와 품질은 다른 값이다. 후보가 전부 나빠도 1등은 금색으로 빛나기
                    때문에, 최선이 별로일 때는 그 사실을 여기서 미리 말해줘야 관리자가 오해하지 않는다 */}
                {result.qualityHint && (
                    <div className="mo-hint">💡 {result.qualityHint}</div>
                )}

                {/* ── 선택지 목록 ── */}
                <div className="mo-list">
                    {options.map((option, i) => (
                        <button
                            key={`${option.ids.join('-')}-${i}`}
                            type="button"
                            className={`mo-card ${option.tier}`}
                            onClick={() => handlePick(option)}
                            disabled={busy}
                        >
                            <div className="mo-card-head">
                                <span className="mo-tier">{option.tierEmoji} {option.tierLabel}</span>
                                {option.onCourtIds.length > 0 && (
                                    <span className="mo-wait-chip">
                                        ⏳ {option.waitCourts.map(c => `${c + 1}번`).join('·')} 코트 대기
                                    </span>
                                )}
                            </div>

                            {/* A+B VS C+D 배치는 '이렇게 나누면 균형이 맞아요'라는 제안일 뿐이다.
                                점수는 4명 묶음 기준으로 계산된다 (코트에서 팀은 랜덤으로 짜므로) */}
                            <div className="mo-teams">
                                <div className="mo-team">
                                    <OptionPlayerChip player={option.players[0]} />
                                    <OptionPlayerChip player={option.players[1]} />
                                </div>
                                <div className="mo-vs">VS</div>
                                <div className="mo-team">
                                    <OptionPlayerChip player={option.players[2]} />
                                    <OptionPlayerChip player={option.players[3]} />
                                </div>
                            </div>

                            <ul className="mo-reasons">
                                {option.reasons.map((line, k) => (
                                    <li key={k} className={`tone-${line.tone}`}>{line.text}</li>
                                ))}
                            </ul>
                        </button>
                    ))}
                </div>

                {/* ── 아래 버튼 ── */}
                <div className="mo-foot">
                    {hasMorePages && (
                        <button
                            type="button"
                            className="mo-btn ghost"
                            disabled={busy}
                            onClick={() => setPageIndex(i => (i + 1) % pages.length)}
                        >
                            🔀 다른 조합 ({pageIndex + 1}/{pages.length})
                        </button>
                    )}
                    <button type="button" className="mo-btn ghost" disabled={busy} onClick={onRegenerate}>
                        🔄 다시 계산
                    </button>
                    <button type="button" className="mo-btn cancel" disabled={busy} onClick={onCancel}>
                        닫기
                    </button>
                </div>
            </div>
        </div>
    );
}

export { MatchOptionsModal, OptionPlayerChip };
