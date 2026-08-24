import React from 'react';
import { MapPin, Users, Lock, BarChart2, Edit3, Star, Activity } from '../../components/ui/icons';
import { timeAgo } from '../../lib/time';

// ===================================================================================
// 로비의 경기방 카드
// -----------------------------------------------------------------------------------
// [추가된 것]
//   · 찜 별표 — 매주 가는 방을 맨 위로 올린다
//   · 지금 경기 중 표시 — "여기 사람 있다"가 방을 고르는 가장 큰 기준이다
//   · 거리 — '가까운 순'으로 볼 때 왜 이 순서인지 보이게
//   · 마지막 운영 시각 — 만들어놓고 안 쓰는 방을 구분할 수 있게
//
// 예전 카드에는 인원 수가 있었지만 그 값(playerCount)이 아무 데서도 갱신되지 않아
// 항상 0명이었다. 지금은 실제 선수 수를 세어 넣는다.
// ===================================================================================

export function RoomCard({ room, onEnter, onEdit, onToggleFavorite, isAdmin }) {
    const locked = !!(room.passwordHash || room.password);
    const playing = room.playingNow || 0;
    const count = room.playerCount || 0;
    const max = room.maxPlayers || 0;
    const pct = max ? Math.min(100, Math.round((count / max) * 100)) : 0;
    const almostFull = pct >= 80;

    const distanceText = room.distance === undefined
        ? null
        : room.distance < 1
            ? `${Math.round(room.distance * 1000)}m`
            : `${room.distance.toFixed(1)}km`;

    // 방 포인트 색 — 방마다 고른 색이 로비 카드에서도 보인다 (내 방 찾기가 빨라진다)
    const accent = room.themeColor || '#CDFB47';

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={onEnter}
            onKeyDown={(e) => { if (e.key === 'Enter') onEnter(); }}
            aria-label={`${room.name}, ${room.location}, ${count}명 참가${playing ? `, ${playing}명 경기 중` : ''}`}
            className="bg-card rounded-2xl border border-white/[0.06] p-5 cursor-pointer transition-all hover:border-white/15 active:scale-[0.98] relative group overflow-hidden"
        >
            <div
                className="absolute left-0 top-0 bottom-0 w-1"
                style={{ backgroundColor: playing > 0 ? accent : (room.themeColor ? `${accent}55` : 'rgba(255,255,255,0.15)') }}
            />

            <div className="flex justify-between items-start mb-2 pl-1 gap-2">
                <div className="flex items-center gap-1.5 overflow-hidden min-w-0">
                    <h3 className="text-base font-black text-txt kern-tight truncate">{room.name}</h3>
                    {locked && <Lock size={13} className="text-muted shrink-0" />}
                </div>

                <div className="flex items-center gap-0.5 shrink-0 -mr-1.5 -mt-1.5">
                    <button
                        onClick={(e) => { e.stopPropagation(); onToggleFavorite?.(room.id); }}
                        aria-label={room.favorite ? '찜 해제' : '찜하기'}
                        aria-pressed={!!room.favorite}
                        className={`p-2 rounded-full transition-colors ${room.favorite ? 'text-volt' : 'text-muted hover:text-dim'}`}
                    >
                        <Star size={16} fill={room.favorite ? 'currentColor' : 'none'} />
                    </button>
                    {isAdmin && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onEdit?.(room); }}
                            aria-label="방 정보 수정"
                            className="p-2 text-muted hover:text-volt rounded-full transition-colors"
                        >
                            <Edit3 size={15} />
                        </button>
                    )}
                </div>
            </div>

            <p className="text-xs text-dim mb-3 truncate font-bold pl-1 flex items-center gap-1">
                <MapPin size={12} className="shrink-0" />
                <span className="truncate">{room.location}</span>
                {distanceText && <span className="text-muted shrink-0">· {distanceText}</span>}
            </p>

            <div className="flex flex-wrap gap-1.5 items-center pl-1">
                {playing > 0 && (
                    <span className="flex items-center gap-1 px-2.5 py-1.5 text-ink rounded-full text-[11px] font-black" style={{ backgroundColor: accent }}>
                        <Activity size={12} /> {playing}명 경기 중
                    </span>
                )}
                <span className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/5 text-txt rounded-full text-[11px] font-black">
                    <BarChart2 size={12} className="text-volt" />
                    {room.levelLimit === 'N조' ? '전체' : `${room.levelLimit}+`}
                </span>
                <span className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-black ${almostFull ? 'bg-coral/15 text-coral' : 'bg-white/5 text-dim'}`}>
                    <Users size={12} /> {count}{max ? `/${max}` : ''}
                </span>
                {room.lastActiveAt && playing === 0 && (
                    <span className="text-[10px] font-bold text-muted ml-auto">
                        {timeAgo(room.lastActiveAt)} 운영
                    </span>
                )}
            </div>
        </div>
    );
}
