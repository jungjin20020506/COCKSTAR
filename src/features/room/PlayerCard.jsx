import React, { useEffect, useRef, useState } from 'react';
import { getLevelColor } from '../../constants';
import { X, Plus, Crown } from '../../components/ui/icons';

// ===================================================================================
// 선수 카드 · 빈 슬롯 · 코트 타이머
// ===================================================================================

/**
 * 선수 카드.
 *
 * [길게 누르기]
 *   경기 수 수정은 카드를 길게(700ms) 누르면 열린다. 한때 점 세 개(⋯) 버튼을
 *   함께 달았지만, 4열 그리드의 작은 카드에서는 거슬리기만 해서 뗐다 —
 *   관리자 안내(RoomAdminGuide)가 길게 누르기를 알려준다.
 *
 * [색약 대응]
 *   남/여 구분을 왼쪽 색 띠 하나에만 맡기지 않는다 — 이름 옆에 ♂/♀ 기호를
 *   같이 둔다. 색을 구분하지 못해도 기호는 읽힌다.
 */
export const PlayerCard = React.memo(function PlayerCard({
    player, isAdmin, isCurrentUser, isPlaying, isResting, isSelected,
    onCardClick, onDeleteClick, onLongPress,
    onDragStart, onDragEnd, onDragOver, onDrop,
}) {
    const timerRef = useRef(null);
    const firedRef = useRef(false);

    const startPress = () => {
        if (!isAdmin || !onLongPress) return;
        firedRef.current = false;
        timerRef.current = setTimeout(() => { firedRef.current = true; onLongPress(player); }, 700);
    };
    const endPress = () => {
        if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    };
    useEffect(() => endPress, []);

    const handleClick = () => {
        // 길게 눌러 메뉴가 떴으면 그 손가락 떼기를 '탭'으로 세지 않는다
        if (firedRef.current) { firedRef.current = false; return; }
        onCardClick?.(player);
    };

    if (!player) return <div className="h-[52px] bg-white/5 rounded-lg animate-pulse" />;

    const levelText = getLevelColor(player.level).replace('border-', 'text-');
    const isMale = player.gender === '남';
    const genderBorder = isMale ? 'border-l-blue-500' : 'border-l-pink-500';
    // 색만으로 남/여를 가르지 않는다 — 기호를 같이 둔다 (색약 대응)
    const genderMark = isMale
        ? <span className="text-[9px] font-black text-blue-400 shrink-0 leading-none" aria-hidden="true">♂</span>
        : <span className="text-[9px] font-black text-pink-400 shrink-0 leading-none" aria-hidden="true">♀</span>;

    let cls = `relative bg-card2 rounded-lg px-2 py-1 h-[52px] flex flex-col justify-center border border-white/[0.06] border-l-[3px] transition-all duration-200 cursor-pointer active:scale-95 ${genderBorder} select-none `;
    if (isPlaying) cls += ' opacity-45 grayscale ';
    if (isResting) cls += ' opacity-40 grayscale ';
    if (isSelected) cls += ' ring-2 ring-volt ring-offset-2 ring-offset-ink scale-105 z-10 shadow-volt ';
    else if (isCurrentUser) cls += ' ring-2 ring-coral ring-offset-2 ring-offset-ink ';

    const canDrag = isAdmin && typeof onDragStart === 'function';

    const label = [
        player.name,
        player.level || 'N조',
        `${player.todayGames || 0}경기`,
        isPlaying ? '경기중' : '',
        isResting ? '휴식중' : '',
        isCurrentUser ? '나' : '',
    ].filter(Boolean).join(', ');

    return (
        <div
            className={cls}
            role="button"
            tabIndex={0}
            aria-label={label}
            aria-pressed={isSelected}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(); } }}
            onMouseDown={startPress} onMouseUp={endPress} onMouseLeave={endPress}
            onTouchStart={startPress} onTouchEnd={endPress} onTouchCancel={endPress}
            onClick={handleClick}
            draggable={canDrag}
            onDragStart={canDrag ? (e) => onDragStart(e, player.id) : undefined}
            onDragEnd={canDrag ? onDragEnd : undefined}
            onDragOver={canDrag ? onDragOver : undefined}
            onDrop={canDrag ? (e) => onDrop(e, { type: 'player', player }) : undefined}
        >
            <div className="flex justify-between items-center gap-0.5 pointer-events-none mb-0.5">
                <span className="text-xs font-black text-txt truncate leading-none">{player.name}</span>
                {genderMark}
            </div>

            {isAdmin && onDeleteClick && (
                <button
                    aria-label={`${player.name} 빼기`}
                    onClick={(e) => { e.stopPropagation(); onDeleteClick(player); }}
                    className="absolute -top-1.5 -right-1.5 bg-ink text-txt hover:bg-coral hover:text-ink rounded-full border border-white/10 p-0.5 transition-colors z-20"
                >
                    <X size={10} strokeWidth={3} />
                </button>
            )}

            <div className="flex justify-between items-center pointer-events-none">
                <span className={`text-[10px] font-black ${levelText}`}>{player.level || 'N'}</span>
                <span className="text-[10px] text-muted font-black tabular">{player.todayGames || 0}G</span>
            </div>

            {player.role === 'admin' && (
                <Crown size={10} className="absolute bottom-0.5 left-1 text-volt/70 pointer-events-none" />
            )}
        </div>
    );
});

export const LeftPlayerCard = ({ onClick, isAdmin }) => (
    <div className="h-[52px] bg-coral/10 rounded-lg flex flex-col items-center justify-center border-2 border-dashed border-coral/40 relative select-none">
        <span className="text-[10px] font-black text-coral leading-tight">나간 선수</span>
        {isAdmin && onClick && (
            <button
                aria-label="빈 자리 정리"
                onClick={(e) => { e.stopPropagation(); onClick(); }}
                className="absolute -top-1.5 -right-1.5 bg-coral text-ink hover:bg-coral-dark rounded-full p-0.5 z-20"
            >
                <X size={10} strokeWidth={3} />
            </button>
        )}
    </div>
);

export const EmptySlot = ({ onSlotClick, onDragOver, onDrop, isDragOver }) => (
    <button
        type="button"
        aria-label="빈 자리 — 선택한 선수를 넣습니다"
        onClick={onSlotClick}
        onDragOver={onDragOver}
        onDrop={onDrop}
        className={`h-[52px] w-full rounded-lg flex items-center justify-center border-2 border-dashed transition-all cursor-pointer ${
            isDragOver
                ? 'bg-volt/10 border-volt text-volt'
                : 'bg-white/[0.02] border-white/10 text-muted hover:border-volt hover:text-volt'
        }`}
    >
        <Plus size={18} strokeWidth={3} />
    </button>
);

/**
 * 코트 타이머.
 *
 * [경기 시간 초과]
 *   기준 시간(기본 20분)을 넘기면 색이 코랄로 바뀌며 깜빡인다.
 *   "그만 내려오세요"를 관리자가 말하지 않아도 되게 만드는 장치다.
 */
export const CourtTimer = ({ startTime, limitMinutes = 20 }) => {
    const [sec, setSec] = useState(0);

    useEffect(() => {
        if (!startTime) { setSec(0); return undefined; }
        const start = startTime?.toDate ? startTime.toDate() : new Date(startTime);
        const tick = () => setSec(Math.max(0, Math.floor((Date.now() - start.getTime()) / 1000)));
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, [startTime]);

    const over = limitMinutes > 0 && sec >= limitMinutes * 60;
    const mm = String(Math.floor(sec / 60)).padStart(2, '0');
    const ss = String(sec % 60).padStart(2, '0');

    return (
        <div
            className={`text-xs font-black tabular px-2.5 py-1 rounded-md flex items-center gap-1.5 ${
                over ? 'bg-coral text-ink animate-flicker' : 'bg-volt text-ink'
            }`}
            title={over ? `${limitMinutes}분을 넘겼습니다` : undefined}
        >
            <span className="w-1.5 h-1.5 rounded-full bg-ink animate-pulse" />
            {mm}:{ss}
        </div>
    );
};
