import React from 'react';
import { LEVEL_ORDER } from '../../constants';
import { Users, BarChart2, MapPin, Lock, ShieldAlert } from '../../components/ui/icons';

// ===================================================================================
// 참가 확인 — 방을 '열어보는 것'과 '참가하는 것'을 나눈다
// -----------------------------------------------------------------------------------
// 예전에는 방 화면을 열기만 해도 선수 문서가 자동으로 만들어졌다. 그래서
//   · 어떤 방인지 구경만 하려던 사람이 대기 명단에 올라가고
//   · 매칭 후보로 뽑혀서 관리자가 "이 사람 누구지?" 하며 손으로 빼야 했다
// 카톡 링크를 받고 눌러본 사람 전부가 명단에 쌓였다.
//
// 이제 '참가하기'를 한 번 누르게 한다. 버튼 하나 늘었지만, 명단에 있는 사람은
// 전부 실제로 뛸 사람이 된다.
//
// [여기서 함께 막는 것]
//   정원과 입장 급수는 방을 만들 때 설정하면서 정작 아무도 검사하지 않았다.
//   'A조 이상' 방에 E조가 그냥 들어왔다. 참가 버튼을 누르는 이 자리가 검사하기
//   가장 자연스러운 지점이다.
// ===================================================================================

/**
 * 이 방에 들어갈 수 있는지 확인한다.
 * @returns {{ok: true} | {ok: false, reason: string, detail: string}}
 */
export function checkJoinable(room, userData, playerCount) {
    if (!room) return { ok: false, reason: '방을 찾을 수 없습니다.', detail: '' };

    // ── 급수 제한 ──
    // 'N조' = 전체 허용. 그 외에는 '설정 급수 이상'만 들어올 수 있다.
    // LEVEL_ORDER 는 숫자가 작을수록 상위 급수다 (S조=1 … E조=6).
    const limit = room.levelLimit;
    if (limit && limit !== 'N조') {
        const need = LEVEL_ORDER[limit] ?? 99;
        const mine = LEVEL_ORDER[userData?.level] ?? 99;
        // 급수를 안 정한 사람(N조·미설정)은 막지 않는다 —
        // '실력이 낮다'가 아니라 '아직 모른다'이므로 방장이 판단할 몫이다.
        const unset = !userData?.level || userData.level === 'N조' || userData.level === '미설정';
        if (!unset && mine > need) {
            return {
                ok: false,
                reason: `${limit} 이상만 참가할 수 있는 방이에요`,
                detail: `내 급수는 ${userData.level}입니다. 방장에게 문의하거나 다른 방을 찾아보세요.`,
            };
        }
    }

    // ── 정원 ──
    const max = Number(room.maxPlayers) || 0;
    if (max > 0 && playerCount >= max) {
        return {
            ok: false,
            reason: '정원이 가득 찼어요',
            detail: `${playerCount}/${max}명. 누군가 나가면 참가할 수 있습니다.`,
        };
    }

    return { ok: true };
}

export function JoinGate({ room, userData, playerCount, onJoin, onPeek, joining }) {
    const check = checkJoinable(room, userData, playerCount);
    const max = Number(room?.maxPlayers) || 0;

    return (
        <div className="flex-1 flex items-center justify-center p-6 bg-ink">
            <div className="w-full max-w-sm">
                <div className="bg-card rounded-[28px] border border-white/[0.06] p-6 grain court-lines relative overflow-hidden">
                    <div className="relative z-10">
                        <span className="text-[11px] font-black label text-volt">Join Match</span>
                        <h2 className="text-2xl font-black text-txt kern-tight mt-1 leading-tight break-keep">
                            {room?.name}
                        </h2>

                        <div className="flex flex-wrap gap-2 mt-4">
                            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 text-txt rounded-full text-[11px] font-black">
                                <BarChart2 size={13} className="text-volt" />
                                {room?.levelLimit === 'N조' ? '전체 급수' : `${room?.levelLimit} 이상`}
                            </span>
                            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 text-dim rounded-full text-[11px] font-black">
                                <Users size={13} /> {playerCount}{max ? `/${max}` : ''}명
                            </span>
                            {(room?.passwordHash || room?.password) && (
                                <span className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 text-dim rounded-full text-[11px] font-black">
                                    <Lock size={12} /> 비밀방
                                </span>
                            )}
                        </div>

                        {room?.location && (
                            <p className="flex items-start gap-1.5 text-xs text-dim font-bold mt-3 break-keep">
                                <MapPin size={13} className="mt-0.5 shrink-0" />
                                <span>{room.location}</span>
                            </p>
                        )}

                        {room?.description && (
                            <p className="text-[13px] text-dim font-medium leading-relaxed mt-4 break-keep border-t border-white/[0.06] pt-4">
                                {room.description}
                            </p>
                        )}
                    </div>
                </div>

                {check.ok ? (
                    <>
                        <button
                            onClick={onJoin}
                            disabled={joining}
                            className="w-full mt-4 py-4 bg-volt text-ink font-black rounded-full text-base shadow-volt active:scale-[0.98] transition-transform disabled:opacity-60"
                        >
                            {joining ? '참가하는 중...' : '이 방에 참가하기'}
                        </button>
                        <p className="text-[11px] text-muted font-medium text-center mt-2.5 leading-relaxed break-keep">
                            참가하면 대기 명단에 올라가고 매칭 후보가 됩니다.
                        </p>
                    </>
                ) : (
                    <div className="mt-4 rounded-2xl bg-coral/[0.08] border border-coral/30 p-4 flex gap-3">
                        <ShieldAlert size={18} className="text-coral shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm font-black text-coral break-keep">{check.reason}</p>
                            {check.detail && (
                                <p className="text-[12px] text-dim font-medium mt-1 leading-relaxed break-keep">
                                    {check.detail}
                                </p>
                            )}
                        </div>
                    </div>
                )}

                <button
                    onClick={onPeek}
                    className="w-full mt-3 py-3 text-dim text-sm font-bold hover:text-txt transition-colors"
                >
                    참가 없이 둘러보기
                </button>
            </div>
        </div>
    );
}
