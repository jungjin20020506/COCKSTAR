import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, Undo2 } from 'lucide-react';

// ===================================================================================
// 토스트 — window 이벤트 기반 싱글턴
// -----------------------------------------------------------------------------------
// 컴포넌트 밖(트랜잭션 콜백, 유틸 함수)에서도 부를 수 있어야 해서 이벤트를 쓴다.
// React context로 하면 훅 안에서만 쓸 수 있어 그 자리들에서 못 쓴다.
//
// [실행 취소]
//   toast.undo(메시지, 되돌리는함수) 를 부르면 5초간 '되돌리기' 버튼이 붙는다.
//   경기 종료처럼 '눌렀는데 아차' 하는 동작에 쓴다.
// ===================================================================================

const EVENT = 'cockstar-toast';

export function toast(message, type = 'default') {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent(EVENT, { detail: { message, type } }));
}

toast.error = (message) => toast(message, 'error');

/**
 * 되돌릴 수 있는 토스트.
 * @param {string} message 보여줄 문구
 * @param {() => (void|Promise<void>)} onUndo '되돌리기'를 누르면 실행
 * @param {number} ms 버튼이 살아 있는 시간
 */
toast.undo = (message, onUndo, ms = 6000) => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent(EVENT, { detail: { message, type: 'undo', onUndo, ms } }));
};

export function Toaster() {
    const [items, setItems] = useState([]);

    useEffect(() => {
        const handler = (e) => {
            const id = `${Date.now()}-${Math.random()}`;
            const life = e.detail?.ms || 2600;
            setItems(prev => [...prev, { id, ...e.detail }]);
            setTimeout(() => setItems(prev => prev.filter(i => i.id !== id)), life);
        };
        window.addEventListener(EVENT, handler);
        return () => window.removeEventListener(EVENT, handler);
    }, []);

    const dismiss = (id) => setItems(prev => prev.filter(i => i.id !== id));

    return (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[300] flex flex-col items-center gap-2 pointer-events-none w-full max-w-sm px-4">
            {items.map(item => {
                const isErr = item.type === 'error';
                const isUndo = item.type === 'undo';
                const Icon = isErr ? AlertCircle : isUndo ? Undo2 : CheckCircle;
                return (
                    <div
                        key={item.id}
                        role="status"
                        aria-live={isErr ? 'assertive' : 'polite'}
                        className={`animate-toast-in glass w-full flex items-center gap-2.5 px-4 py-3 rounded-2xl border shadow-deep ${isErr ? 'border-coral/40' : 'border-volt/30'} ${isUndo ? 'pointer-events-auto' : ''}`}
                    >
                        <Icon size={18} className={isErr ? 'text-coral' : 'text-volt'} strokeWidth={2} />
                        <span className="text-sm font-bold text-txt flex-1">{item.message}</span>
                        {isUndo && (
                            <button
                                onClick={async () => { dismiss(item.id); try { await item.onUndo?.(); } catch (err) { console.error(err); } }}
                                className="shrink-0 px-3 py-1.5 rounded-full bg-volt text-ink text-[11px] font-black active:scale-95 transition-transform"
                            >
                                되돌리기
                            </button>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
