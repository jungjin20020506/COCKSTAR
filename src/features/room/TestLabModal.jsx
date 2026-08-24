import React from 'react';
import { Modal } from '../../components/ui/Modal';
import { FlaskConical, Loader2, ShieldAlert } from '../../components/ui/icons';

// ===================================================================================
// 시뮬레이션 랩 — 개발용
// -----------------------------------------------------------------------------------
// [왜 슈퍼 관리자 전용인가]
//   가상 선수(봇)를 방에 쏟아붓고 자동으로 경기를 돌리는 기능이다. 개발할 때는
//   꼭 필요하지만, 실제 운영 중인 방에서 잘못 누르면 명단에 'Bot 482' 같은 이름이
//   여덟 개 생기고 경기 기록이 뒤섞인다. 되돌리려면 하나씩 지워야 한다.
//
//   예전에는 방 관리자면 누구나 이 버튼을 볼 수 있었다. 실험실 아이콘이 설정 옆에
//   나란히 있어서 눌러보게 되어 있었다.
//
//   이제 슈퍼 관리자(개발자)에게만 보인다. 화면 자체가 안 그려지므로 실수의
//   여지가 없다.
// ===================================================================================

export function TestLabModal({ isOpen, onClose, onCreateBots, isAutoPlay, setIsAutoPlay }) {
    return (
        <Modal open={isOpen} onClose={onClose} variant="center" size="max-w-sm" ariaLabel="시뮬레이션 랩">
            <div className="flex items-center gap-2 mb-5 pt-1">
                <FlaskConical size={22} className="text-volt" />
                <h3 className="text-xl font-black kern-tight text-txt">시뮬레이션 랩</h3>
            </div>

            <div className="flex gap-2.5 p-3 rounded-xl bg-coral/10 border border-coral/30 mb-5">
                <ShieldAlert size={16} className="text-coral shrink-0 mt-0.5" />
                <p className="text-[11px] text-coral font-bold leading-relaxed break-keep">
                    개발용 도구입니다. 실제로 운영 중인 방에서는 쓰지 마세요 —
                    가상 선수가 명단과 경기 기록에 섞입니다.
                </p>
            </div>

            <div className="space-y-5">
                <div className="bg-white/[0.03] p-4 rounded-2xl border border-white/[0.06]">
                    <h4 className="font-black text-sm text-dim mb-3">🤖 가상 선수(Bot) 투입</h4>
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            onClick={() => onCreateBots(4, '남')}
                            className="py-3 bg-card2 border border-white/10 rounded-xl text-sm font-black hover:border-blue-500 hover:text-blue-400 transition-colors text-txt"
                        >
                            남성 4명 추가
                        </button>
                        <button
                            onClick={() => onCreateBots(4, '여')}
                            className="py-3 bg-card2 border border-white/10 rounded-xl text-sm font-black hover:border-pink-500 hover:text-pink-400 transition-colors text-txt"
                        >
                            여성 4명 추가
                        </button>
                    </div>
                    <p className="text-xs text-muted mt-2 text-center font-medium">대기 명단으로 즉시 투입됩니다.</p>
                </div>

                <div className="bg-white/[0.03] p-4 rounded-2xl border border-white/[0.06]">
                    <h4 className="font-black text-sm text-dim mb-3">⚡ 자동 매칭 시뮬레이션</h4>
                    <button
                        onClick={() => setIsAutoPlay(!isAutoPlay)}
                        className={`w-full py-4 rounded-full text-lg font-black transition-all flex items-center justify-center gap-2 ${
                            isAutoPlay ? 'bg-coral text-ink' : 'bg-volt text-ink shadow-volt'
                        }`}
                    >
                        {isAutoPlay ? <><Loader2 className="animate-spin" /> 시뮬레이션 중지</> : '자동 테스트 시작'}
                    </button>
                    <p className="text-xs text-muted mt-2 text-center font-medium">
                        {isAutoPlay ? '봇들이 자동으로 경기를 진행하고 종료합니다.' : '버튼을 누르면 봇들이 스스로 움직입니다.'}
                    </p>
                </div>
            </div>
        </Modal>
    );
}
