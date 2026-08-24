import React, { useEffect, useState } from 'react';
import { Sparkles, X } from './icons';

// ===================================================================================
// 새 버전 안내 배너
// -----------------------------------------------------------------------------------
// 서비스 워커는 autoUpdate 라 새 버전이 배포되면 조용히 받아두지만, 이미 열려 있는
// 화면은 '다음 새로고침'까지 구버전 코드로 돈다. 체육관에서는 앱을 저녁 내내 켜두므로
// 그 새로고침이 영영 안 올 수 있다 — 그래서 새 버전이 준비되는 순간 아래에 한 줄
// 배너를 띄우고, 버튼 한 번으로 갈아타게 한다.
//
// [동작]
//   · 새 SW 가 제어권을 잡는 순간(controllerchange)을 감지해 배너를 띄운다.
//     첫 설치 때도 이 이벤트가 오므로 '이미 제어 중이었나'로 걸러낸다.
//   · 앱을 오래 켜두는 사용자를 위해 30분마다 + 화면에 돌아올 때마다 새 버전을 확인한다.
//   · 닫아도 된다 — 어차피 다음 자연스러운 새로고침 때 새 버전이 적용된다.
//   · 치명적 버그로 '강제로' 막아야 할 때는 이 배너가 아니라 버전 게이트를 쓴다
//     (config/app.minVersion — docs/OPS.md 3번).
// ===================================================================================

export function UpdateBanner() {
    const [show, setShow] = useState(false);

    useEffect(() => {
        if (!('serviceWorker' in navigator)) return undefined;

        // 첫 설치(페이지가 아직 SW 제어를 안 받던 상태)는 업데이트가 아니다
        let hadController = !!navigator.serviceWorker.controller;
        const onChange = () => {
            if (!hadController) { hadController = true; return; }
            setShow(true);
        };
        navigator.serviceWorker.addEventListener('controllerchange', onChange);

        // 새 버전 확인 — 저녁 내내 켜두는 앱이라 주기적으로 + 화면에 돌아올 때
        const check = () => navigator.serviceWorker.getRegistration()
            .then(r => r?.update())
            .catch(() => { /* 오프라인 등 — 다음 기회에 */ });
        const iv = setInterval(check, 30 * 60 * 1000);
        const onVis = () => { if (document.visibilityState === 'visible') check(); };
        document.addEventListener('visibilitychange', onVis);

        return () => {
            navigator.serviceWorker.removeEventListener('controllerchange', onChange);
            clearInterval(iv);
            document.removeEventListener('visibilitychange', onVis);
        };
    }, []);

    if (!show) return null;

    return (
        <div className="flex-shrink-0 flex items-center gap-3 px-4 py-2.5 bg-volt/15 border-t border-volt/30 animate-fade-in-up">
            <span className="w-8 h-8 rounded-xl bg-volt flex items-center justify-center shrink-0">
                <Sparkles size={16} className="text-ink" />
            </span>
            <div className="flex-1 min-w-0">
                <p className="text-[12px] font-black text-txt leading-tight">새 버전이 나왔어요</p>
                <p className="text-[10px] text-dim font-bold truncate">한 번만 누르면 바로 적용됩니다</p>
            </div>
            <button
                onClick={() => window.location.reload()}
                className="px-3.5 py-2 rounded-full bg-volt text-ink text-[11px] font-black shrink-0 active:scale-95 transition-transform"
            >
                업데이트
            </button>
            <button
                onClick={() => setShow(false)}
                aria-label="업데이트 안내 닫기"
                className="p-1.5 text-dim shrink-0"
            >
                <X size={15} />
            </button>
        </div>
    );
}
