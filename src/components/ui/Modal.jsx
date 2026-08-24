import React, { useEffect, useRef } from 'react';
import { X } from './icons';

// ===================================================================================
// 공용 모달 — 접근성과 아이폰 동작을 한 곳에서 책임진다
// -----------------------------------------------------------------------------------
// 예전에는 모달마다 fixed inset-0 ... 를 손으로 복사해 썼다. 그래서 모달마다
// 조금씩 달랐고, 아래 것들이 어디에도 없었다.
//
//   · Esc 로 닫기
//   · 열려 있는 동안 뒤 화면 스크롤 잠금 (아이폰에서 특히 티가 난다 —
//     모달 안을 스크롤하려다 뒤 페이지가 움직여버린다)
//   · 열릴 때 포커스를 모달 안으로, 닫힐 때 원래 자리로 (스크린리더·키보드)
//   · role="dialog" aria-modal — 보조기기가 '지금은 이 창만 있다'를 안다
//   · 안전영역(노치·홈바) 여백
// ===================================================================================

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {string} [props.title] 화면에 보이는 제목 (없으면 ariaLabel 필수)
 * @param {string} [props.ariaLabel] 제목을 안 보여줄 때 보조기기용 이름
 * @param {'sheet'|'center'} [props.variant] sheet=아래에서 올라옴(기본), center=가운데
 * @param {string} [props.size] max-w-* 클래스
 * @param {React.ReactNode} [props.footer] 아래 고정 영역
 * @param {boolean} [props.dismissable] 배경 탭·Esc 로 닫을 수 있는가 (기본 true)
 */
export function Modal({
    open, onClose, title, ariaLabel, subtitle,
    variant = 'sheet', size = 'max-w-md', footer, dismissable = true,
    children, zIndex = 'z-[100]',
}) {
    const panelRef = useRef(null);
    const restoreFocusRef = useRef(null);

    useEffect(() => {
        if (!open) return undefined;

        restoreFocusRef.current = document.activeElement;

        // 뒤 화면 스크롤 잠금.
        // position:fixed 로 몸통을 고정하면 아이폰에서도 확실히 멈춘다.
        // 잠글 때 스크롤 위치를 기억했다가 풀 때 되돌린다 — 안 그러면 맨 위로 튄다.
        const scrollY = window.scrollY;
        const body = document.body;
        const prev = {
            position: body.style.position,
            top: body.style.top,
            width: body.style.width,
            overflow: body.style.overflow,
        };
        body.style.position = 'fixed';
        body.style.top = `-${scrollY}px`;
        body.style.width = '100%';
        body.style.overflow = 'hidden';

        const onKey = (e) => {
            if (e.key === 'Escape' && dismissable) { e.stopPropagation(); onClose?.(); return; }
            if (e.key !== 'Tab') return;
            // 포커스가 모달 밖으로 빠져나가지 않게 가둔다
            const focusables = panelRef.current?.querySelectorAll(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
            );
            if (!focusables || focusables.length === 0) return;
            const list = [...focusables].filter(el => !el.disabled && el.offsetParent !== null);
            if (list.length === 0) return;
            const first = list[0];
            const last = list[list.length - 1];
            if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        };
        document.addEventListener('keydown', onKey, true);

        // 열리자마자 모달 안으로 포커스를 옮긴다.
        // 첫 입력칸이 있으면 거기로 — 없으면 패널 자체로.
        const t = setTimeout(() => {
            const target = panelRef.current?.querySelector('[data-autofocus]')
                || panelRef.current;
            target?.focus?.({ preventScroll: true });
        }, 40);

        return () => {
            clearTimeout(t);
            document.removeEventListener('keydown', onKey, true);
            body.style.position = prev.position;
            body.style.top = prev.top;
            body.style.width = prev.width;
            body.style.overflow = prev.overflow;
            window.scrollTo(0, scrollY);
            restoreFocusRef.current?.focus?.({ preventScroll: true });
        };
    }, [open, onClose, dismissable]);

    if (!open) return null;

    const isSheet = variant === 'sheet';

    return (
        <div
            className={`fixed inset-0 bg-black/80 backdrop-blur-md ${zIndex} flex justify-center ${isSheet ? 'items-end sm:items-center p-0 sm:p-4' : 'items-center p-4'}`}
            onMouseDown={(e) => { if (dismissable && e.target === e.currentTarget) onClose?.(); }}
        >
            <div
                ref={panelRef}
                tabIndex={-1}
                role="dialog"
                aria-modal="true"
                aria-label={title ? undefined : ariaLabel}
                aria-labelledby={title ? 'modal-title' : undefined}
                className={`bg-surface w-full ${size} shadow-deep border border-white/[0.06] outline-none flex flex-col max-h-[92vh] ${
                    isSheet
                        ? 'rounded-t-[32px] sm:rounded-[28px] animate-slide-up sm:animate-scale-in'
                        : 'rounded-[28px] animate-scale-in'
                }`}
            >
                {(title || onClose) && (
                    <div className="flex-shrink-0 flex justify-between items-start gap-3 px-6 pt-6 pb-4">
                        <div className="min-w-0">
                            {title && (
                                <h2 id="modal-title" className="text-xl font-black kern-tight text-txt truncate">{title}</h2>
                            )}
                            {subtitle && <p className="text-xs text-dim font-bold mt-1">{subtitle}</p>}
                        </div>
                        {onClose && (
                            <button
                                onClick={onClose}
                                aria-label="닫기"
                                className="w-9 h-9 shrink-0 rounded-full bg-white/5 flex items-center justify-center text-dim hover:bg-white/10 hover:text-txt transition-colors"
                            >
                                <X size={20} />
                            </button>
                        )}
                    </div>
                )}

                <div className="flex-1 min-h-0 overflow-y-auto hide-scrollbar px-6 pb-6">
                    {children}
                </div>

                {footer && (
                    <div className="flex-shrink-0 px-6 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] border-t border-white/[0.06]">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
}
