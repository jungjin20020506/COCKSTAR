import React, { useEffect, useState, useCallback } from 'react';
import { Modal } from './Modal';
import { CockstarMark } from './Logo';
import { X, Download } from './icons';
import { getDailyResetKey } from '../../lib/time';

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
// 닫으면 일주일 조용히. (예전 2주 — 설치가 알림의 선행 조건이 되면서 유도를 당겼다.
//  단, '닫기'는 언제나 한 번에 되고, 안 깔아도 모든 기능이 브라우저에서 그대로 된다)
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

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

export function isAndroid() {
    if (typeof navigator === 'undefined') return false;
    return /Android/i.test(navigator.userAgent);
}

/**
 * 안드로이드의 '진짜 크롬'인가.
 *
 * 왜 가르나 — PWA 설치 결과물이 브라우저마다 다르다.
 *   · 크롬: 구글 서버가 서명한 WebAPK — 설치창 한 번이면 끝, 경고 없음
 *   · 삼성 인터넷 등: 자체 생성 패키지가 구버전 SDK 를 타깃해서 Play 프로텍트가
 *     "안전하지 않은 앱 차단됨" 경고를 띄운다 (실사용자 스크린샷으로 확인).
 * 그래서 안드로이드인데 크롬이 아니면, 설치 대신 '크롬으로 열기'를 권한다.
 *
 * 삼성 인터넷·엣지·웨일 등도 UA 에 "Chrome/"을 넣으므로 자기 이름으로 걸러낸다.
 */
export function isAndroidChrome() {
    if (!isAndroid()) return false;
    const ua = navigator.userAgent || '';
    return /Chrome\/\d+/.test(ua)
        && !/SamsungBrowser|EdgA|EdgW|OPR\/|Whale|NAVER|UCBrowser|MiuiBrowser|Firefox/i.test(ua);
}

/**
 * 지금 페이지를 크롬으로 다시 연다 (install=1 을 붙여 도착 즉시 설치로 잇는다).
 * 크롬이 없는 기기는 fallback 주소로 그냥 남는다.
 */
export function openInChrome() {
    if (typeof window === 'undefined') return;
    const flagged = withInstallFlag(window.location.href);
    const noProto = flagged.replace(/^https?:\/\//, '');
    try {
        window.location.href = `intent://${noProto}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(flagged)};end`;
    } catch { /* 인텐트가 막힌 환경 — 아무 일도 안 일어난다 */ }
}

// ===================================================================================
// 인앱 브라우저 — 콕스타 유입의 대부분은 카카오톡 링크인데, 카톡이 여는 내장
// 브라우저에서는 PWA 설치가 '원래' 불가능하다 (설치 이벤트도, 사파리 공유 버튼도 없다).
// 그래서 여기서는 설치를 권하는 게 아니라 **크롬/사파리로 탈출**시키는 게 정답이다.
//   · 카카오톡: kakaotalk://web/openExternal 스킴으로 기본 브라우저에 열 수 있다
//   · 라인: 주소에 openExternalBrowser=1 을 붙이면 밖으로 나간다
//   · 그 외 안드로이드 인앱: 크롬 인텐트 스킴
//   · 그 외 아이폰 인앱: 강제 탈출 방법이 없다 — 메뉴 → 'Safari로 열기'를 안내한다
// ===================================================================================

/** 어느 인앱 브라우저 안인지. 아니면 null */
export function getInAppBrowser() {
    if (typeof navigator === 'undefined') return null;
    const ua = navigator.userAgent || '';
    if (/KAKAOTALK/i.test(ua)) return 'kakao';
    if (/\bLine\//i.test(ua)) return 'line';
    if (/Instagram/i.test(ua)) return 'instagram';
    if (/FBAN|FBAV|FB_IAB/i.test(ua)) return 'facebook';
    if (/NAVER\(inapp/i.test(ua)) return 'naver';
    if (/DaumApps/i.test(ua)) return 'daum';
    return null;
}

/**
 * 지금 주소에 install=1 표시를 붙인다.
 * 인앱 브라우저에서 탈출한 사람이 크롬/사파리에 도착하는 순간, 이 표시를 보고
 * 설치 안내(InstallNudgeModal)가 자동으로 열린다 — "버튼 한 번 → 브라우저 이동 →
 * 바로 설치"로 이어지는 다리다.
 */
export function withInstallFlag(url) {
    try {
        const u = new URL(url);
        u.searchParams.set('install', '1');
        return u.toString();
    } catch { return url; }
}

/**
 * 인앱 브라우저에서 기본 브라우저(크롬/사파리)로 탈출을 시도한다.
 * 탈출 주소에는 install=1 이 붙어, 도착하자마자 설치 안내가 이어진다.
 * @returns {boolean} 자동 탈출을 시도했으면 true, 수동 안내가 필요하면 false
 */
export function escapeInAppBrowser() {
    const kind = getInAppBrowser();
    if (!kind || typeof window === 'undefined') return false;
    const url = withInstallFlag(window.location.href);
    try {
        if (kind === 'kakao') {
            // 카카오톡 공식 스킴 — 안드로이드는 크롬, 아이폰은 사파리로 열린다
            window.location.href = `kakaotalk://web/openExternal?url=${encodeURIComponent(url)}`;
            return true;
        }
        if (kind === 'line') {
            const sep = url.includes('?') ? '&' : '?';
            window.location.href = `${url}${sep}openExternalBrowser=1`;
            return true;
        }
        if (isAndroid()) {
            // 안드로이드 인앱 공통 — 크롬 인텐트로 연다
            const noProto = url.replace(/^https?:\/\//, '');
            window.location.href = `intent://${noProto}#Intent;scheme=https;package=com.android.chrome;end`;
            return true;
        }
    } catch { /* 스킴이 막힌 환경 — 아래 수동 안내로 */ }
    return false;   // 아이폰 기타 인앱 — 수동 안내
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

/** 설치 안내 — 어디를 눌러야 하는지 그림으로 (인앱 브라우저면 탈출 방법부터) */
export function InstallGuideModal({ isOpen, onClose }) {
    const ios = isIOS();
    const inApp = getInAppBrowser();

    return (
        <Modal
            open={isOpen}
            onClose={onClose}
            title={inApp ? '브라우저로 열기' : '홈 화면에 추가하기'}
            subtitle={inApp ? '카톡·인앱 브라우저에서는 설치가 안 돼요' : ios ? '아이폰 · 아이패드' : '한 번만 하면 됩니다'}
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

            {inApp ? (
                <div className="space-y-3">
                    <button
                        onClick={() => { if (!escapeInAppBrowser()) { /* 아래 수동 안내가 이미 보인다 */ } }}
                        className="w-full py-3.5 bg-volt text-ink font-black rounded-2xl text-sm active:scale-[0.98] transition-transform"
                    >
                        기본 브라우저로 열기
                    </button>
                    <ol className="space-y-3">
                        {[
                            { n: 1, t: '버튼이 안 되면 메뉴를 여세요', d: '화면 위나 아래의 ⋯ (또는 공유) 버튼이에요.' },
                            { n: 2, t: '"다른 브라우저로 열기"를 찾으세요', d: '아이폰은 "Safari로 열기", 안드로이드는 "브라우저에서 열기".' },
                            { n: 3, t: '열린 뒤 설치 안내를 따라주세요', d: '거기서는 홈 화면 설치와 알림이 됩니다.' },
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
                </div>
            ) : ios ? (
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
            ) : isAndroid() && !isAndroidChrome() ? (
                /* 삼성 인터넷 등 — 여기서 설치하면 구글 경고가 뜬다. 크롬이 정답이고,
                   굳이 여기서 하겠다면 경고를 넘어가는 길을 정확히 알려준다 */
                <div className="space-y-3">
                    <button
                        onClick={openInChrome}
                        className="w-full py-3.5 bg-volt text-ink font-black rounded-2xl text-sm active:scale-[0.98] transition-transform"
                    >
                        Chrome으로 열어 경고 없이 설치하기
                    </button>
                    <ol className="space-y-3">
                        {[
                            { n: 1, t: '이 브라우저에서 설치하려면', d: '메뉴(⋮ 또는 ≡)에서 "앱으로 설치" 또는 "현재 페이지 추가"를 누르세요.' },
                            { n: 2, t: '"안전하지 않은 앱" 창이 뜨면', d: '"세부정보 더보기"를 누른 뒤 "무시하고 설치"를 선택하세요. 크롬이 아닌 브라우저의 설치에 구글이 띄우는 표준 경고로, 콕스타는 개인정보를 수집하는 앱 파일이 아니에요.' },
                            { n: 3, t: '홈 화면에 아이콘이 생기면 끝!', d: '다음부터 전체 화면으로 빠르게 열립니다.' },
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
                </div>
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

// ===================================================================================
// 강한 설치 유도 — 화면 가운데 모달, 하루 한 번
// -----------------------------------------------------------------------------------
// 얇은 배너만으로는 설치율이 오르지 않았다. 그래서 하루 한 번, 환경에 맞는
// '가장 짧은 설치 경로'를 큰 버튼 하나로 내민다.
//
//   · 카톡 등 인앱  → "브라우저로 열고 설치하기" (탈출 주소에 install=1 을 붙여
//                     크롬/사파리 도착 즉시 이 모달이 다시 이어받는다)
//   · 안드로이드 크롬 → "지금 설치하기" (네이티브 설치창이 바로 뜬다)
//   · 아이폰 사파리  → 그림 단계 안내가 바로 열린다 (애플 정책상 버튼 설치 불가 —
//                     공유 → 홈 화면에 추가, 두 번이면 끝)
//
// [지킨 선]
//   닫기는 언제나 한 번에 되고, 안 깔아도 모든 기능이 그대로 된다.
//   같은 날 다시 열어도 또 뜨지 않는다 (운영일 기준 1회). 설치되면 영영 안 뜬다.
// ===================================================================================

const PUSH_KEY = 'cockstar-install-push-day';

/**
 * 인앱 탈출로 도착했다는 표시(install=1)를 앱이 뜨자마자 딱 한 번 읽고 주소에서 지운다.
 * ★ effect 안에서 읽으면 안 된다 — StrictMode 가 effect 를 두 번 돌리는데,
 *   첫 번째 실행이 파라미터를 지워버리면 두 번째(실제) 실행은 아무것도 못 본다.
 */
function consumeInstallFlag() {
    if (typeof window === 'undefined') return false;
    try {
        const params = new URLSearchParams(window.location.search);
        if (params.get('install') !== '1') return false;
        params.delete('install');
        const q = params.toString();
        window.history.replaceState(
            null, '',
            window.location.pathname + (q ? `?${q}` : '') + window.location.hash,
        );
        return true;
    } catch { return false; }
}
const arrivedFromEscape = consumeInstallFlag();

export function InstallNudgeModal() {
    const { installed, canPrompt, promptInstall } = useInstallState();
    const [show, setShow] = useState(false);
    const [showGuide, setShowGuide] = useState(false);
    const inApp = getInAppBrowser();
    const ios = isIOS();

    useEffect(() => {
        if (installed) return undefined;

        // 인앱에서 탈출해 방금 도착한 경우(install=1) — 하루 1회 제한 없이 바로 잇는다
        const fromEscape = arrivedFromEscape;

        try {
            if (!fromEscape && localStorage.getItem(PUSH_KEY) === getDailyResetKey()) return undefined;
        } catch { /* noop */ }

        // 권할 방법이 하나도 없는 환경(구형 데스크톱 브라우저 등)은 조용히
        if (!fromEscape && !inApp && !ios && !isAndroid() && !canPrompt) return undefined;

        // 경기방으로 바로 들어온 사람은 지금 '참가'가 목적이다 — 참가 확인·알림 권한
        // 흐름 위에 설치 모달까지 끼어들면 그냥 나가버린다. 방 화면에서는 띄우지 않는다.
        // 예외 둘: ① install=1 로 도착(설치가 목적) ② 카톡 등 인앱(여기 계속 있으면
        // 설치도 알림도 영영 안 되므로, 방을 충분히 본 뒤 탈출 안내를 띄운다)
        const onRoomPage = window.location.pathname.startsWith('/room/');
        if (!fromEscape && !inApp && onRoomPage) return undefined;

        const delay = fromEscape ? 400 : (inApp && onRoomPage ? 3500 : 1800);
        const t = setTimeout(() => setShow(true), delay);
        return () => clearTimeout(t);
    }, [installed, canPrompt, inApp, ios]);

    const dismiss = () => {
        setShow(false);
        setShowGuide(false);
        try { localStorage.setItem(PUSH_KEY, getDailyResetKey()); } catch { /* noop */ }
    };

    if (!show || installed) return null;

    // ── 아이폰 사파리: 그림 단계 안내를 바로 연다 (이게 곧 설치 화면이다) ──
    if (!inApp && ios) {
        return <InstallGuideModal isOpen onClose={dismiss} />;
    }

    // 탈출 실패(아이폰 인스타 인앱 등) 시 수동 안내로
    if (showGuide) {
        return <InstallGuideModal isOpen onClose={dismiss} />;
    }

    const appName = inApp
        ? ({ kakao: '카카오톡', line: '라인', instagram: '인스타그램', facebook: '페이스북', naver: '네이버', daum: '다음' }[inApp] || '인앱 브라우저')
        : null;

    // 안드로이드인데 크롬이 아니다(삼성 인터넷 등) — 여기서 설치하면 Play 프로텍트가
    // "안전하지 않은 앱" 경고를 띄운다. 크롬으로 한 번 옮겨서 경고 없이 설치시킨다.
    const androidNonChrome = !inApp && isAndroid() && !isAndroidChrome();

    return (
        <Modal open onClose={dismiss} variant="center" size="max-w-xs" ariaLabel="앱 설치 안내" zIndex="z-[150]">
            <div className="text-center mb-5 pt-2">
                <div className="flex justify-center mb-4">
                    <CockstarMark size={64} plate className="rounded-2xl shadow-volt animate-pop" />
                </div>
                <h3 className="text-lg font-black text-txt kern-tight mb-2">
                    {inApp ? '앱으로 설치하고 쓰세요' : '콕스타를 앱으로 설치하세요'}
                </h3>
                <p className="text-sm text-dim font-medium leading-relaxed break-keep">
                    {inApp
                        ? <>{appName} 안에서는 설치와 알림이 안 돼요.<br />버튼 한 번이면 브라우저로 열리고,<br />바로 설치까지 이어집니다.</>
                        : androidNonChrome
                            ? <>이 브라우저에서 설치하면 구글이<br />경고 창을 띄워요. <b className="text-txt">Chrome으로 열면</b><br />버튼 한 번에 경고 없이 설치됩니다.</>
                            : <>홈 화면에서 전체 화면으로 열리고<br /><b className="text-txt">내 차례 알림</b>까지 받을 수 있어요.</>}
                </p>
            </div>

            <div className="space-y-2">
                {inApp ? (
                    <>
                        <button
                            data-autofocus
                            onClick={() => { if (!escapeInAppBrowser()) setShowGuide(true); }}
                            className="w-full py-4 bg-volt text-ink font-black rounded-full shadow-volt text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                        >
                            <Download size={17} /> 브라우저로 열고 설치하기
                        </button>
                        {/* 스킴이 막힌 일부 기기 — 버튼이 조용히 실패하면 이 줄이 유일한 출구다 */}
                        <button
                            onClick={() => setShowGuide(true)}
                            className="w-full py-1 text-[11px] text-muted font-bold break-keep"
                        >
                            버튼이 안 되면? <span className="underline text-dim">⋯ 메뉴로 여는 방법 보기</span>
                        </button>
                    </>
                ) : androidNonChrome ? (
                    <>
                        <button
                            data-autofocus
                            onClick={openInChrome}
                            className="w-full py-4 bg-volt text-ink font-black rounded-full shadow-volt text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                        >
                            <Download size={17} /> Chrome으로 열고 설치하기
                        </button>
                        <button
                            onClick={() => setShowGuide(true)}
                            className="w-full py-1 text-[11px] text-muted font-bold break-keep"
                        >
                            그냥 여기서 설치할래요 <span className="underline text-dim">(경고 창 넘어가는 법)</span>
                        </button>
                    </>
                ) : (
                    <button
                        data-autofocus
                        onClick={() => {
                            if (canPrompt) promptInstall().then(dismiss);
                            else setShowGuide(true);
                        }}
                        className="w-full py-4 bg-volt text-ink font-black rounded-full shadow-volt text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                    >
                        <Download size={17} /> {canPrompt ? '지금 설치하기' : '설치 방법 보기'}
                    </button>
                )}
                <button onClick={dismiss} className="w-full py-2.5 text-muted text-sm font-bold">
                    괜찮아요, 그냥 볼게요
                </button>
                <p className="text-[10px] text-muted font-medium text-center break-keep">
                    설치하지 않아도 모든 기능을 그대로 쓸 수 있어요.
                </p>
            </div>
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

    const inApp = getInAppBrowser();

    useEffect(() => {
        if (installed) return;
        try {
            const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || '0');
            if (Date.now() - dismissedAt < SNOOZE_MS) return;        // 닫았으면 일주일 조용히
            // ★ 첫 방문부터 띄운다. 유입의 대부분이 카톡 링크 1회성 방문이라
            //   "두 번째 방문부터"로 아끼면 설치 유도가 사실상 아무에게도 안 보인다.
            // 띄우는 조건: 설치 방법이 있거나(네이티브 창/아이폰/안드로이드 수동),
            //   인앱 브라우저라서 '탈출 안내'가 필요하거나.
            if (!canPrompt && !ios && !isAndroid() && !inApp) return;
            const t = setTimeout(() => setShow(true), 1500);         // 화면을 잠깐 보고 나서
            return () => clearTimeout(t);
        } catch { /* localStorage 를 못 쓰면 그냥 안 띄운다 */ }
    }, [installed, canPrompt, ios, inApp]);

    const dismiss = () => {
        setShow(false);
        try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* noop */ }
    };

    if (!show || installed) return null;

    // ── 인앱 브라우저 (카톡·라인 등): 설치가 불가능한 곳 — '브라우저로 열기'를 권한다 ──
    if (inApp) {
        const appName = { kakao: '카카오톡', line: '라인', instagram: '인스타그램', facebook: '페이스북', naver: '네이버', daum: '다음' }[inApp] || '인앱';
        return (
            <>
                <div className="flex-shrink-0 flex items-center gap-3 px-4 py-2.5 bg-volt/10 border-t border-volt/25 animate-fade-in-up">
                    <CockstarMark size={30} plate className="rounded-lg shrink-0" />
                    <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-black text-txt leading-tight">브라우저로 열면 앱처럼 쓸 수 있어요</p>
                        <p className="text-[10px] text-dim font-bold truncate">
                            {appName} 안에서는 홈 화면 설치·알림이 안 돼요
                        </p>
                    </div>
                    <button
                        onClick={() => { if (!escapeInAppBrowser()) setShowGuide(true); }}
                        className="px-3.5 py-2 rounded-full bg-volt text-ink text-[11px] font-black shrink-0 flex items-center gap-1"
                    >
                        <Download size={13} /> 브라우저로 열기
                    </button>
                    <button onClick={dismiss} aria-label="안내 닫기" className="p-1.5 text-dim shrink-0">
                        <X size={15} />
                    </button>
                </div>
                <InstallGuideModal
                    isOpen={showGuide}
                    onClose={() => setShowGuide(false)}
                />
            </>
        );
    }

    return (
        <>
            <div className="flex-shrink-0 flex items-center gap-3 px-4 py-3 bg-volt/10 border-t border-volt/25 animate-fade-in-up">
                <CockstarMark size={34} plate className="rounded-lg shrink-0" />
                <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-black text-txt leading-tight">콕스타 앱으로 설치하기</p>
                    <p className="text-[10px] text-dim font-bold truncate">
                        {canPrompt
                            ? '버튼 한 번이면 홈 화면에 설치돼요'
                            : ios ? '공유 버튼 한 번이면 끝나요 · 알림도 받을 수 있어요' : '한 번 설치하면 더 빠르게 열려요'}
                    </p>
                </div>
                <button
                    onClick={() => {
                        // 삼성 인터넷 등에서 네이티브 설치를 밀면 구글 경고가 뜬다 — 안내(크롬 이동 포함)로
                        if (isAndroid() && !isAndroidChrome()) { setShowGuide(true); return; }
                        if (canPrompt) promptInstall().then(dismiss); else setShowGuide(true);
                    }}
                    className="px-4 py-2.5 rounded-full bg-volt text-ink text-[12px] font-black shrink-0 flex items-center gap-1.5 shadow-volt active:scale-95 transition-transform"
                >
                    <Download size={14} /> {canPrompt ? '바로 설치' : '설치'}
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
