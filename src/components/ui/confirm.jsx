import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Modal } from './Modal';
import { AlertCircle } from './icons';

// ===================================================================================
// 확인 창 — window.confirm 을 걷어낸다
// -----------------------------------------------------------------------------------
// 방 나가기·경기 종료·삭제가 전부 브라우저 기본 confirm 이었다. 문제가 세 가지다.
//   ① 앱은 새까만 다크 화면인데 confirm 만 흰색 시스템 팝업이라 톤이 깨진다
//   ② 홈 화면에 설치한 PWA 에서는 주소가 함께 뜨거나 아예 안 뜨는 플랫폼이 있다
//   ③ "정말요?" 말고는 아무 정보도 못 준다. 되돌릴 수 있는지, 무엇이 지워지는지.
//
// 쓰는 법은 confirm 과 똑같이 await 한 줄이다 —
//   if (!(await confirm({ title: '...' }))) return;
// 그래야 기존 코드를 옮길 때 흐름이 안 꼬인다.
// ===================================================================================

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
    const [state, setState] = useState(null);
    const resolverRef = useRef(null);

    const confirm = useCallback((options) => {
        // 문자열 하나만 넘겨도 되게 (window.confirm 과 모양을 맞춘다)
        const opts = typeof options === 'string' ? { title: options } : (options || {});
        setState({
            title: opts.title || '계속할까요?',
            description: opts.description || '',
            confirmText: opts.confirmText || '확인',
            cancelText: opts.cancelText || '취소',
            tone: opts.tone || 'default',   // 'default' | 'danger'
        });
        return new Promise((resolve) => { resolverRef.current = resolve; });
    }, []);

    const settle = useCallback((value) => {
        setState(null);
        const resolve = resolverRef.current;
        resolverRef.current = null;
        resolve?.(value);
    }, []);

    const danger = state?.tone === 'danger';

    return (
        <ConfirmContext.Provider value={confirm}>
            {children}
            <Modal
                open={!!state}
                onClose={() => settle(false)}
                variant="center"
                size="max-w-xs"
                ariaLabel={state?.title || '확인'}
                zIndex="z-[220]"
            >
                {state && (
                    <div className="text-center pt-2">
                        <div className={`w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center ${danger ? 'bg-coral/15' : 'bg-volt/15'}`}>
                            <AlertCircle size={26} className={danger ? 'text-coral' : 'text-volt'} />
                        </div>
                        <h3 className="text-lg font-black text-txt kern-tight leading-snug">{state.title}</h3>
                        {state.description && (
                            <p className="text-sm text-dim font-medium mt-2 leading-relaxed whitespace-pre-line">
                                {state.description}
                            </p>
                        )}
                        <div className="flex gap-2.5 mt-7">
                            <button
                                onClick={() => settle(false)}
                                className="flex-1 py-3.5 bg-white/5 text-dim font-black rounded-full text-sm active:scale-95 transition-transform"
                            >
                                {state.cancelText}
                            </button>
                            <button
                                data-autofocus
                                onClick={() => settle(true)}
                                className={`flex-1 py-3.5 font-black rounded-full text-sm active:scale-95 transition-transform ${
                                    danger ? 'bg-coral text-ink' : 'bg-volt text-ink shadow-volt'
                                }`}
                            >
                                {state.confirmText}
                            </button>
                        </div>
                    </div>
                )}
            </Modal>
        </ConfirmContext.Provider>
    );
}

/**
 * @returns {(options: string | {title?:string, description?:string, confirmText?:string, cancelText?:string, tone?:'default'|'danger'}) => Promise<boolean>}
 */
export function useConfirm() {
    const ctx = useContext(ConfirmContext);
    if (!ctx) throw new Error('useConfirm 은 ConfirmProvider 안에서만 쓸 수 있습니다.');
    return ctx;
}
