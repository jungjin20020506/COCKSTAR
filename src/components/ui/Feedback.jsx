import React from 'react';
import { Loader2, WifiOff } from './icons';
import { useOnline } from '../../lib/net';

// ===================================================================================
// 로딩 · 빈 화면 · 오프라인 — '지금 무슨 상태인지' 알려주는 것들
// ===================================================================================

export function LoadingSpinner({ text = 'LOADING' }) {
    return (
        <div className="flex flex-col items-center justify-center h-full text-txt" role="status" aria-live="polite">
            <Loader2 className="w-9 h-9 animate-spin text-volt" />
            <span className="mt-4 text-[11px] font-black label text-muted">{text}</span>
        </div>
    );
}

export function SkeletonCard() {
    return (
        <div className="w-full p-5 rounded-2xl bg-card border border-white/[0.06]" aria-hidden="true">
            <div className="h-4 skeleton rounded w-2/3 mb-3" />
            <div className="flex gap-2 mb-4">
                <div className="h-4 skeleton rounded-full w-16" />
                <div className="h-4 skeleton rounded-full w-16" />
            </div>
            <div className="flex justify-between items-center">
                <div className="h-4 skeleton rounded w-24" />
                <div className="h-6 skeleton rounded-full w-16" />
            </div>
        </div>
    );
}

export function SkeletonStoreCard() {
    return (
        <div className="w-40 flex-shrink-0 mr-3" aria-hidden="true">
            <div className="rounded-2xl overflow-hidden bg-card border border-white/[0.06]">
                <div className="w-full h-32 skeleton" />
                <div className="p-3">
                    <div className="h-4 skeleton rounded w-3/4 mb-2" />
                    <div className="h-3 skeleton rounded w-1/2" />
                </div>
            </div>
        </div>
    );
}

export function SkeletonRoomCard() {
    return (
        <div className="rounded-2xl bg-card border border-white/[0.06] p-5" aria-hidden="true">
            <div className="h-5 skeleton rounded w-1/2 mb-3" />
            <div className="h-4 skeleton rounded w-3/4 mb-4" />
            <div className="flex gap-2">
                <div className="h-6 skeleton rounded-full w-20" />
                <div className="h-6 skeleton rounded-full w-16" />
            </div>
        </div>
    );
}

export function EmptyState({ icon: Icon, title, description, buttonText, onButtonClick }) {
    return (
        <div className="flex flex-col items-center justify-center text-center p-10 rounded-2xl bg-card border border-dashed border-white/10">
            <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
                <Icon className="w-7 h-7 text-volt" />
            </div>
            <h3 className="text-base font-black text-txt mb-1 kern-tight">{title}</h3>
            <p className="text-sm text-dim mb-6 font-medium">{description}</p>
            {buttonText && onButtonClick && (
                <button
                    onClick={onButtonClick}
                    className="px-6 py-3 bg-volt text-ink text-sm font-black rounded-full transition-all active:scale-95"
                >
                    {buttonText}
                </button>
            )}
        </div>
    );
}

export function ComingSoonPage({ icon: Icon, title, description }) {
    return (
        <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-ink">
            <div className="w-20 h-20 rounded-3xl bg-card flex items-center justify-center mb-6 grain relative overflow-hidden border border-white/[0.06]">
                <Icon className="w-9 h-9 text-volt relative z-10" />
            </div>
            <span className="text-[11px] font-black label text-volt mb-2">Coming Soon</span>
            <h2 className="text-2xl font-black text-txt mb-2 kern-tight">{title}</h2>
            <p className="text-sm text-dim font-medium max-w-[260px]">{description}</p>
        </div>
    );
}

export function LoginRequiredPage({ icon: Icon, title, description, onLoginClick }) {
    return (
        <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-ink">
            <div className="w-20 h-20 rounded-3xl bg-card flex items-center justify-center mb-6 border border-white/[0.06]">
                <Icon className="w-9 h-9 text-volt" />
            </div>
            <h2 className="text-2xl font-black text-txt mb-2 kern-tight">{title}</h2>
            <p className="text-sm text-dim font-medium mb-8">{description}</p>
            <button
                onClick={onLoginClick}
                className="px-9 py-4 bg-volt text-ink text-xs font-black rounded-full shadow-volt transition-transform active:scale-95 label"
            >
                로그인하고 시작하기
            </button>
        </div>
    );
}

/**
 * 연결이 끊기면 위에 띠를 띄운다.
 *
 * 오프라인 캐시가 켜져 있어서 화면은 그대로 보인다 — 그래서 오히려 더 필요하다.
 * 아무 안내가 없으면 "저장을 눌렀는데 왜 남들에게 안 보이지?" 가 된다.
 */
export function OfflineBanner() {
    const online = useOnline();
    if (online) return null;
    return (
        <div
            role="status"
            className="flex-shrink-0 flex items-center justify-center gap-2 px-4 py-2 bg-coral/15 border-b border-coral/30"
        >
            <WifiOff size={14} className="text-coral shrink-0" />
            <span className="text-[11px] font-black text-coral">
                연결이 끊겼습니다 · 화면은 마지막 상태예요
            </span>
        </div>
    );
}
