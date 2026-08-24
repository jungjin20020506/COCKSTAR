import React, { useEffect, useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import { toast } from '../../lib/toast';

// ===================================================================================
// 공지사항 작성 — 관리자 전용
// -----------------------------------------------------------------------------------
// 원래 공지 입력은 '방 정보 수정' 안의 한 칸이었는데, 아무도 못 찾았다.
// 공지는 방 정보가 아니라 '오늘의 운영 도구'다 — 그래서 전용 창으로 승격했다.
//
// 여는 곳 세 군데:
//   ① 환경 설정 → 📢 공지사항
//   ② 방 상단 공지 바의 연필 (수정)
//   ③ 공지가 없을 때 관리자에게만 보이는 "공지를 등록해보세요" 바
//
// 저장하면 즉시 모든 접속자 화면 상단에 뜨고(실시간), 새로 입장하는 사람은
// 입장 연출에서도 본다. 빈 값으로 저장하면 공지가 내려간다.
// ===================================================================================

const MAX_LEN = 200;

/** 자주 쓰는 공지 — 탭 한 번으로 넣는다 (총무의 타이핑을 아껴준다) */
const TEMPLATES = [
    '오늘 셔틀콕 각자 지참해주세요 🏸',
    '21시 정리 시작 — 마지막 게임은 20:40까지',
    '이번 달 회비 입금 부탁드려요',
    '신입 환영! 몸풀기 후 매칭 시작합니다',
];

export function NoticeModal({ isOpen, onClose, notice, onSave }) {
    const [text, setText] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (isOpen) setText(notice || '');
    }, [isOpen, notice]);

    const clean = text.trim();
    const hasExisting = !!(notice || '').trim();
    const changed = clean !== (notice || '').trim();

    const applyTemplate = (t) => {
        // 비어 있으면 그대로, 이미 쓴 게 있으면 줄바꿈으로 이어 붙인다
        setText(prev => {
            const cur = prev.trim();
            if (!cur) return t;
            const merged = `${cur}\n${t}`;
            return merged.length > MAX_LEN ? cur : merged;
        });
    };

    const save = async (value) => {
        if (saving) return;
        setSaving(true);
        try {
            await onSave(value);
            onClose();
        } catch { /* 실패 토스트는 saveNotice 가 띄운다 — 창은 열어둬서 다시 시도하게 */ }
        finally { setSaving(false); }
    };

    const handleSubmit = () => {
        if (!clean && !hasExisting) { toast.error('공지 내용을 입력해주세요.'); return; }
        save(clean);   // 빈 값이면 공지 내리기와 같다
    };

    return (
        <Modal
            open={isOpen}
            onClose={onClose}
            title="📢 공지사항"
            subtitle="저장하는 순간 모든 참가자 화면에 바로 보여요"
            size="max-w-sm"
            footer={(
                <div className="space-y-2">
                    <button
                        onClick={handleSubmit}
                        disabled={saving || (!changed && hasExisting)}
                        className="w-full py-3.5 bg-volt text-ink font-black rounded-full text-sm disabled:opacity-40 transition-opacity"
                    >
                        {saving ? '저장 중...' : hasExisting ? (clean ? '공지 수정' : '공지 내리기') : '공지 등록'}
                    </button>
                    {hasExisting && clean && (
                        <button
                            onClick={() => save('')}
                            disabled={saving}
                            className="w-full py-3 bg-coral/10 text-coral font-black rounded-full text-xs disabled:opacity-40"
                        >
                            공지 내리기 (지우기)
                        </button>
                    )}
                </div>
            )}
        >
            <div className="space-y-4">
                <div>
                    <textarea
                        data-autofocus
                        rows={4}
                        maxLength={MAX_LEN}
                        value={text}
                        onChange={(e) => setText(e.target.value.slice(0, MAX_LEN))}
                        placeholder={'예: 오늘 셔틀콕 각자 지참해주세요\n줄바꿈도 됩니다'}
                        className="w-full p-3.5 bg-card2 rounded-xl border border-white/10 focus:border-volt outline-none font-bold text-txt placeholder-muted text-sm resize-none leading-relaxed"
                    />
                    <p className="text-right text-[10px] font-bold text-muted mt-1 tabular">{text.length}/{MAX_LEN}</p>
                </div>

                {/* 자주 쓰는 공지 */}
                <div>
                    <span className="text-[10px] font-black label text-muted block mb-1.5">자주 쓰는 공지</span>
                    <div className="flex flex-wrap gap-1.5">
                        {TEMPLATES.map(t => (
                            <button
                                key={t}
                                onClick={() => applyTemplate(t)}
                                className="px-2.5 py-1.5 rounded-full bg-white/5 border border-white/10 text-[11px] font-bold text-dim active:scale-95 transition-transform text-left"
                            >
                                {t}
                            </button>
                        ))}
                    </div>
                </div>

                {/* 미리보기 — 실제로 보일 모습 그대로 */}
                {clean && (
                    <div>
                        <span className="text-[10px] font-black label text-muted block mb-1.5">미리보기</span>
                        <div className="flex items-start gap-2.5 px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08]">
                            <span className="text-sm shrink-0">📢</span>
                            <span
                                className="flex-1 text-[12px] font-black text-txt break-keep leading-snug whitespace-pre-line"
                                style={{ overflowWrap: 'anywhere' }}
                            >
                                {clean}
                            </span>
                        </div>
                    </div>
                )}

                <p className="text-[11px] text-muted font-medium leading-relaxed break-keep">
                    · 방 화면 맨 위에 고정되고, 새로 들어오는 사람은 입장 연출에서도 봅니다.<br />
                    · 접속해 있는 사람들에게는 바뀌는 순간 바로 반영돼요.
                </p>
            </div>
        </Modal>
    );
}
