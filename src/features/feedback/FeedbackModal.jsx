import React, { useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import { FEEDBACK_KINDS, openMail, openKakaoChat, buildMailtoUrl } from '../../lib/feedback';
import { SUPPORT } from '../../constants';
import { MessageSquare, Send, Copy, Bug, Lightbulb, HelpCircle } from '../../components/ui/icons';
import { toast } from '../../lib/toast';

// ===================================================================================
// 문의 · 버그 신고
// -----------------------------------------------------------------------------------
// 두 갈래를 나란히 둔다. 하나만 두면 놓치는 사람이 생긴다.
//   · 카카오톡 오픈채팅 — 가볍게 말 걸기. 대부분 여기로 온다
//   · 이메일          — 길게 쓰거나 스크린샷을 붙일 때
//
// 메일에는 진단 정보를 자동으로 붙인다(앱 버전·화면 크기·최근 오류 5건).
// "안 돼요" 한 줄만 오면 되묻는 데 하루가 가고, 그 사이에 사용자는 앱을 지운다.
//
// ⚠️ 개인정보는 넣지 않는다. 이름·이메일·방 이름은 진단 정보에 없고,
//    본문에 직접 쓴 것만 전달된다.
// ===================================================================================

const ICON = { bug: Bug, idea: Lightbulb, question: HelpCircle, etc: MessageSquare };

export function FeedbackModal({ isOpen, onClose }) {
    const [kind, setKind] = useState('bug');
    const [message, setMessage] = useState('');
    const [withDiagnostics, setWithDiagnostics] = useState(true);

    const close = () => { setMessage(''); setKind('bug'); onClose(); };

    const handleMail = () => {
        if (!message.trim()) { toast.error('내용을 적어주세요.'); return; }
        openMail(kind, message, withDiagnostics);
        // 메일 앱이 안 열리는 환경(일부 인앱 브라우저)이 있어서 바로 닫지 않는다.
        // 사용자가 '안 열렸는데?' 할 때 주소 복사로 넘어갈 수 있어야 한다.
        toast('메일 앱을 여는 중입니다.');
    };

    const copyAddress = async () => {
        try {
            await navigator.clipboard.writeText(SUPPORT.email);
            toast('메일 주소를 복사했습니다.');
        } catch {
            toast.error('복사에 실패했습니다.');
        }
    };

    return (
        <Modal
            open={isOpen}
            onClose={close}
            title="문의 · 버그 신고"
            subtitle={`만든 사람(${SUPPORT.developerName})이 직접 읽고 답합니다`}
            size="max-w-md"
        >
            {/* ① 무슨 이야기인지 */}
            <span className="text-[11px] font-black label text-dim block mb-2">어떤 이야기인가요?</span>
            <div className="grid grid-cols-2 gap-2 mb-5">
                {FEEDBACK_KINDS.map(k => {
                    const Icon = ICON[k.key];
                    const on = kind === k.key;
                    return (
                        <button
                            key={k.key}
                            onClick={() => setKind(k.key)}
                            aria-pressed={on}
                            className={`p-3 rounded-2xl border text-left transition-all ${
                                on ? 'bg-volt/10 border-volt/50' : 'bg-white/[0.03] border-white/[0.06]'
                            }`}
                        >
                            <Icon size={17} className={on ? 'text-volt' : 'text-dim'} />
                            <p className={`text-[13px] font-black mt-1.5 ${on ? 'text-txt' : 'text-dim'}`}>{k.label}</p>
                            <p className="text-[10px] text-muted font-medium mt-0.5 leading-snug break-keep">{k.hint}</p>
                        </button>
                    );
                })}
            </div>

            {/* ② 내용 */}
            <label className="text-[11px] font-black label text-dim block mb-2" htmlFor="fb-msg">내용</label>
            <textarea
                id="fb-msg"
                data-autofocus
                rows={5}
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder={
                    kind === 'bug'
                        ? '어느 화면에서, 무엇을 눌렀을 때, 어떻게 됐는지 적어주세요.\n예) 경기방에서 경기 종료를 눌렀는데 경기 수가 2씩 올라갔어요.'
                        : '자유롭게 적어주세요.'
                }
                className="w-full p-3.5 bg-card2 rounded-xl border border-white/10 focus:border-volt outline-none text-sm font-medium text-txt placeholder-muted resize-none leading-relaxed"
            />

            <label className="flex items-start gap-2.5 mt-3 cursor-pointer">
                <input
                    type="checkbox"
                    checked={withDiagnostics}
                    onChange={e => setWithDiagnostics(e.target.checked)}
                    className="w-4 h-4 mt-0.5 accent-[#CDFB47] shrink-0"
                />
                <span className="text-[12px] text-dim font-medium leading-relaxed break-keep">
                    진단 정보 함께 보내기
                    <span className="block text-[11px] text-muted mt-0.5">
                        앱 버전·화면 크기·최근 오류 기록. 이름이나 연락처는 들어가지 않고, 메일에서 지울 수 있어요.
                    </span>
                </span>
            </label>

            {/* ③ 보내는 방법 */}
            <div className="mt-6 space-y-2.5">
                <button
                    onClick={openKakaoChat}
                    className="w-full py-4 bg-[#FEE500] text-[#1a1a1a] font-black rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                >
                    <MessageSquare size={18} fill="#1a1a1a" /> 카카오톡으로 바로 말하기
                </button>
                <p className="text-[11px] text-muted font-medium text-center -mt-0.5">
                    가장 빠른 길이에요. 위에 쓴 내용은 채팅에 붙여넣어 주세요.
                </p>

                <button
                    onClick={handleMail}
                    className="w-full py-4 bg-volt text-ink font-black rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-volt mt-3"
                >
                    <Send size={18} /> 메일로 보내기
                </button>

                <div className="flex items-center justify-center gap-2 pt-1">
                    <span className="text-[11px] text-muted font-bold">{SUPPORT.email}</span>
                    <button
                        onClick={copyAddress}
                        aria-label="메일 주소 복사"
                        className="p-1.5 rounded-lg bg-white/5 text-dim hover:text-txt transition-colors"
                    >
                        <Copy size={13} />
                    </button>
                </div>
                <a
                    href={buildMailtoUrl(kind, message, withDiagnostics)}
                    className="block text-center text-[10px] text-muted/70 font-bold underline underline-offset-2"
                >
                    메일 앱이 안 열리면 여기를 눌러보세요
                </a>
            </div>
        </Modal>
    );
}
