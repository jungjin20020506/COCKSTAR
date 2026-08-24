import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// ===================================================================================
// 테스트 환경 준비
// -----------------------------------------------------------------------------------
// jsdom 에는 브라우저에 있는 몇 가지가 없다. 없으면 컴포넌트가 렌더되다가 죽는데,
// 그건 '테스트할 코드의 문제'가 아니라 '환경의 문제'라서 여기서 채워준다.
// ===================================================================================

// matchMedia — 설치 여부 판단(InstallPrompt)에서 쓴다
if (!window.matchMedia) {
    window.matchMedia = (query) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
    });
}

// crypto.subtle — 방 비밀번호 해시에서 쓴다. jsdom 에는 없어서 Node 것을 빌려온다.
if (!globalThis.crypto?.subtle) {
    const { webcrypto } = await import('node:crypto');
    Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
}

// 캔버스 — 자랑 카드는 실제로 그리지 않고 '불렸는지'만 본다
HTMLCanvasElement.prototype.getContext = vi.fn(() => null);

// 진동 — 없는 기기가 많다
if (!navigator.vibrate) navigator.vibrate = () => true;
