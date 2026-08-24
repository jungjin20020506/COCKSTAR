import React, { useEffect, useState, useCallback } from 'react';
import { Modal } from './Modal';
import { CockstarMark } from './Logo';
import { X, Download } from './icons';

// ===================================================================================
// 홈 화면에 설치하기
// -----------------------------------------------------------------------------------
// 콕스타는 저녁마다 여는 앱이라 홈 화면 아이콘의 가치가 크다. 그런데 설치 방법이
// 플랫폼마다 완전히 다르다.
//
//   · 안드로이드/데스크톱 크롬 — beforeinstallprompt 이벤트를 잡아뒀다가
//     사용자가 원할 때 네이티브 설치창을 띄울 수 있다. 버튼 한 번이면 끝난다.
//
//   · 아이폰 사파리 — 그런 이벤트가 아예 없다. 공유 버튼 → '홈 화면에 추가'를
//     사용자가 직접 해야 한다. 그래서 '어디를 눌러야 하는지'를 그림으로 보여준다.
//     이게 없으면 아이폰 사용자는 설치가 가능한지조차 모른다.
//
// [번거롭지 않게 만드는 규칙]
//   ① 이미 설치된 상태(standalone)면 아무것도 띄우지 않는다
//   ② 처음 온 사람에게는 안 띄운다 — 세 번째 방문부터
//   ③ 한 번 닫으면 2주 동안 다시 안 띄운다
//   ④ 자동 배너는 하단에 작게. 화면을 덮지 않는다
//   내 정보 화면에는 항상 '설치하기'가 있어서, 닫았어도 원할 때 찾을 수 있다.
// ===================================================================================

const VISIT_KEY = 'cockstar-visit-count';
const DISMISS_KEY = 'cockstar-install-dismissed-at';
const SNOOZE_MS = 14 * 24 * 60 * 60 * 1000;

export function isStandalone() {
    if (typeof window === 'undefined') return false;
    return window.matchMedia?.('(display-mode: standalone)')?.matches
        || window.navigator.standalone === true;
}

export function isIOS() {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent;
    // 아이패드는 iPadOS 13부터 데스크톱 사파리로 위장한다 — 터치 지점 수로 가려낸다
    return /iPad|iPhone|iPod/.test(ua)
        || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

/** 방문 횟수를 센다 (앱 시작 때 한 번) */
export function countVisit() {
    try {
        const n = Number(localStorage.getItem(VISIT_KEY) || '0') + 1;
        localStorage.setItem(VISIT_KEY, String(n));
        return n;
    } catch { return 0; }
}

export function useInstallState() {
    const [deferred, setDeferred] = useState(null);
    const [installed, setInstalled] = useState(() => isStandalone());

    useEffect(() => {
        const onPrompt = (e) => {
            e.preventDefault();          // 브라우저 기본 배너를 막고 우리가 때를 고른다
            setDeferred(e);
        };
        const onInstalled = () => { setInstalled(true); setDeferred(null); };
        window.addEventListener('beforeinstallprompt', onPrompt);
        window.addEventListener('appinstalled', onInstalled);
        return () => {
            window.removeEventListener('beforeinstallprompt', onPrompt);
            window.removeEventListener('appinstalled', onInstalled);
        };
    }, []);

    const promptInstall = useCallback(async () => {
        if (!deferred) return false;
        deferred.prompt();
        try { await deferred.userChoice; } catch { /* 사용자가 닫은 것 — 오류가 아니다 */ }
        setDeferred(null);
        return true;
    }, [deferred]);

    return { installed, canPrompt: !!deferred, promptInstall, isIOS: isIOS() };
}

/** 아이폰용 설치 안내 — 어디를 눌러야 하는지 그림으로 */
export function InstallGuideModal({ isOpen, onClose }) {
    const ios = isIOS();

    return (
        <Modal
            open={isOpen}
            onClose={onClose}
            title="홈 화면에 추가하기"
            subtitle={ios ? '아이폰 · 아이패드' : '한 번만 하면 됩니다'}
            size="max-w-xs"
            variant="center"
            zIndex="z-[160]"
            footer={(
                <button
                    data-autofocus
                    onClick={onClose}
                    className="w-full py-3.5 bg-volt text-ink font-black rounded-full text-sm"
                >
                    알겠어요
                </button>
            )}
        >
            <div className="flex justify-center mb-5">
                <CockstarMark size={64} plate className="rounded-2xl shadow-volt" />
            </div>

            {ios ? (
                <ol className="space-y-3">
                    {[
                        { n: 1, t: '아래 공유 버튼을 누르세요', d: '사각형에서 화살표가 위로 나오는 아이콘이에요.', icon: '􀈂' },
                        { n: 2, t: '“홈 화면에 추가”를 찾으세요', d: '메뉴를 조금 내리면 있어요.', icon: '➕' },
                        { n: 3, t: '“추가”를 누르면 끝!', d: '홈 화면에 콕스타 아이콘이 생깁니다.', icon: '✅' },
                    ].map(s => (
                        <li key={s.n} className="flex gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/[0.07]">
                            <span className="w-6 h-6 rounded-full bg-volt text-ink text-xs font-black flex items-center justify-center shrink-0">
                                {s.n}
                            </span>
                            <div className="min-w-0">
                                <p className="text-[13px] font-black text-txt break-keep">{s.t}</p>
                                <p className="text-[11px] text-muted font-medium mt-0.5 break-keep">{s.d}</p>
                            </div>
                        </li>
                    ))}
                </ol>
            ) : (
                <p className="text-sm text-dim font-medium leading-relaxed break-keep text-center">
                    브라우저 주소창 옆의 <b className="text-txt">설치</b> 아이콘을 누르거나,
                    메뉴에서 <b className="text-txt">앱 설치</b>를 고르면 됩니다.
                </p>
            )}

            <p className="text-[11px] text-muted font-medium mt-5 leading-relaxed break-keep text-center">
                설치해도 용량은 거의 들지 않아요. 주소창 없이 전체 화면으로 열리고,
                다음부터 훨씬 빨리 뜹니다.
            </p>
        </Modal>
    );
}

/**
 * 하단 배너 — 조용히 권하고, 닫으면 2주간 안 나온다.
 * 화면을 덮지 않도록 탭바 위에 얇게 얹는다.
 */
export function InstallBanner() {
    const { installed, canPrompt, promptInstall, isIOS: ios } = useInstallState();
    const [show, setShow] = useState(false);
    const [showGuide, setShowGuide] = useState(false);

    useEffect(() => {
        if (installed) return;
        try {
            const visits = Number(localStorage.getItem(VISIT_KEY) || '0');
            const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || '0');
            if (visits < 3) return;                                  // 처음 온 사람은 그냥 둔다
            if (Date.now() - dismissedAt < SNOOZE_MS) return;        // 닫았으면 2주간 조용히
            if (!canPrompt && !ios) return;                          // 설치할 방법이 없으면 안 띄운다
            const t = setTimeout(() => setShow(true), 4000);         // 화면을 좀 보고 나서
            return () => clearTimeout(t);
        } catch { /* localStorage 를 못 쓰면 그냥 안 띄운다 */ }
    }, [installed, canPrompt, ios]);

    const dismiss = () => {
        setShow(false);
        try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* noop */ }
    };

    if (!show || installed) return null;

    return (
        <>
            <div className="flex-shrink-0 flex items-center gap-3 px-4 py-2.5 bg-volt/10 border-t border-volt/25 animate-fade-in-up">
                <CockstarMark size={30} plate className="rounded-lg shrink-0" />
                <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-black text-txt leading-tight">홈 화면에 콕스타 추가</p>
                    <p className="text-[10px] text-dim font-bold truncate">
                        {ios ? '공유 버튼 한 번이면 끝나요' : '한 번 설치하면 더 빠르게 열려요'}
                    </p>
                </div>
                <button
                    onClick={() => { if (canPrompt) promptInstall().then(dismiss); else setShowGuide(true); }}
                    className="px-3.5 py-2 rounded-full bg-volt text-ink text-[11px] font-black shrink-0 flex items-center gap-1"
                >
                    <Download size={13} /> 설치
                </button>
                <button
                    onClick={dismiss}
                    aria-label="설치 안내 닫기"
                    className="p-1.5 text-dim shrink-0"
                >
                    <X size={15} />
                </button>
            </div>
            <InstallGuideModal
                isOpen={showGuide}
                onClose={() => { setShowGuide(false); dismiss(); }}
            />
        </>
    );
}
