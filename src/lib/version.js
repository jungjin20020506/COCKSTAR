// ===================================================================================
// 버전 문자열 비교 — 순수 함수만 (버전 게이트가 쓴다)
// -----------------------------------------------------------------------------------
// appConfig.js 에서 분리한 이유: 시뮬레이션·테스트가 firebase 초기화 없이
// 이 로직만 불러 검증할 수 있어야 한다.
// ===================================================================================

/** "v1.0.0" / "1.0.0" → [1,0,0]. 파싱 불가면 null */
export function parseVer(v) {
    const m = String(v || '').replace(/^v/, '').match(/^(\d+)\.(\d+)\.(\d+)/);
    return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/** a < b 이면 true. 어느 쪽이든 파싱 못 하면 false — 게이트는 보수적으로 (막지 않는다) */
export function versionLessThan(a, b) {
    const pa = parseVer(a);
    const pb = parseVer(b);
    if (!pa || !pb) return false;
    for (let i = 0; i < 3; i += 1) {
        if (pa[i] !== pb[i]) return pa[i] < pb[i];
    }
    return false;
}
