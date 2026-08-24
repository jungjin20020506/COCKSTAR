// ===================================================================================
// 경기방 비밀번호 — 평문 저장을 없앤다
// -----------------------------------------------------------------------------------
// 예전에는 방 문서에 비밀번호가 그대로 들어 있었고, 화면에서 `입력값 === 방.password`
// 로 비교했다. 방 문서는 로비 목록을 그리려고 모든 접속자가 내려받는 값이라,
// 개발자도구를 열면 모든 방의 비밀번호가 그대로 보였다.
//
// 이제 SHA-256 해시만 저장한다. 방마다 다른 소금(salt)을 섞어서, 같은 비밀번호를
// 쓴 두 방의 해시가 서로 달라지게 한다 (하나가 풀려도 나머지가 같이 풀리지 않는다).
//
// ⚠️ 한계를 분명히 해두자. 해시는 '훔쳐본 사람이 바로 못 쓰게' 만들 뿐이고,
//    무차별 대입까지 막지는 못한다. 방 비밀번호는 은행 비밀번호가 아니라
//    '아무나 못 들어오게 하는 문고리'라서 이 정도가 적정선이다.
//    진짜로 막아야 한다면 Cloud Functions 에서 검증해야 한다.
// ===================================================================================

/** 방마다 다른 소금을 만든다 (방 생성 때 한 번) */
export function makeSalt(): string {
    const bytes = new Uint8Array(12);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

async function sha256(text: string): Promise<string> {
    const data = new TextEncoder().encode(text);
    const buf = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('');
}

export interface PasswordRecord { hash: string; salt: string; }

/** 비밀번호 → 저장할 값. 빈 문자열이면 '비밀번호 없음'을 뜻하는 null 을 준다. */
export async function hashPassword(plain: string): Promise<PasswordRecord | null> {
    const p = String(plain || '').trim();
    if (!p) return null;
    const salt = makeSalt();
    return { hash: await sha256(`${salt}:${p}`), salt };
}

/**
 * 입력한 비밀번호가 맞는지 확인한다.
 *
 * 구버전 방(평문 password 필드만 있는 방)도 그대로 열려야 한다.
 * 이미 만들어져 돌아가는 방을 잠가버리면 그 방은 아무도 못 들어간다.
 */
export async function verifyPassword(
    input: string,
    room: { passwordHash?: string; passwordSalt?: string; password?: string },
): Promise<boolean> {
    const p = String(input || '').trim();
    if (room.passwordHash && room.passwordSalt) {
        return (await sha256(`${room.passwordSalt}:${p}`)) === room.passwordHash;
    }
    // 구버전 평문 — 통과시키되, 화면 쪽에서 관리자에게 '비밀번호를 다시 설정해달라'고 안내한다
    if (room.password) return room.password === p;
    return true; // 비밀번호가 없는 방
}

/** 이 방에 비밀번호가 걸려 있는가 */
export function hasPassword(room: { passwordHash?: string; password?: string } | null | undefined): boolean {
    if (!room) return false;
    return !!(room.passwordHash || room.password);
}

/** 아직 평문으로 저장돼 있는 방인가 (관리자에게 재설정을 권해야 한다) */
export function isLegacyPassword(room: { passwordHash?: string; password?: string } | null | undefined): boolean {
    if (!room) return false;
    return !room.passwordHash && !!room.password;
}
