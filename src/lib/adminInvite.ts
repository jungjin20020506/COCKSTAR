// ===================================================================================
// 공동 관리자 초대 — '개인 고유 코드 전달'을 없앤다
// -----------------------------------------------------------------------------------
// 예전 방식: 상대에게 "내 정보 화면에서 아이디를 복사해서 보내주세요" 라고 부탁하고,
//            받은 문자열을 방장이 손으로 붙여넣는다. 두 사람이 카톡을 세 번 주고받아야
//            관리자 한 명이 추가됐다.
//
// 새 방식은 세 갈래다. 상황에 맞는 걸 쓰면 된다.
//
//   ① 명단에서 임명 (제일 흔한 경우)
//      공동 관리자로 세울 사람은 십중팔구 이미 그 방에 들어와 있다.
//      선수 카드를 눌러 '관리자로 임명' — 탭 한 번. 코드도, 복사도 필요 없다.
//
//   ② 초대 코드 (아직 방에 없는 사람)
//      방장이 6자리 코드를 만들어 카톡으로 던진다. 상대는 방에서 코드를 넣으면 끝.
//      24시간 뒤 자동으로 만료된다 — 오래된 코드가 떠돌아다니지 않게.
//
//   ③ 초대 링크
//      코드가 박힌 링크를 누르면 방에 들어가면서 관리자로 등록된다. 가장 빠르다.
//
// 코드에서 헷갈리는 글자(0/O, 1/I/L)를 뺐다. 전화로 불러주는 일이 실제로 생긴다.
// ===================================================================================

const ALPHABET = '23456789ACDEFGHJKMNPQRTUVWXY';
const CODE_LEN = 6;

/** 24시간 */
export const INVITE_TTL_MS = 24 * 60 * 60 * 1000;

export interface AdminInvite {
    code: string;
    /** 만료 시각(밀리초). 서버 시각이 아니라 만든 기기의 시각이다 — 문고리 수준의 장치다 */
    expiresAt: number;
    createdBy: string;
    createdByName?: string;
}

export function makeInviteCode(): string {
    const bytes = new Uint8Array(CODE_LEN);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, b => ALPHABET[b % ALPHABET.length]).join('');
}

export function createInvite(uid: string, name?: string): AdminInvite {
    return {
        code: makeInviteCode(),
        expiresAt: Date.now() + INVITE_TTL_MS,
        createdBy: uid,
        createdByName: name || '',
    };
}

export function isInviteValid(invite: AdminInvite | null | undefined): boolean {
    return !!invite?.code && Number(invite.expiresAt) > Date.now();
}

/** 사용자가 입력한 코드를 정규화한다 (소문자·공백·하이픈을 너그럽게 받는다) */
export function normalizeCode(input: string): string {
    return String(input || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
}

export function inviteMatches(invite: AdminInvite | null | undefined, input: string): boolean {
    if (!isInviteValid(invite)) return false;
    return invite!.code === normalizeCode(input);
}

/** 남은 시간을 사람 말로 */
export function inviteRemainText(invite: AdminInvite | null | undefined): string {
    if (!isInviteValid(invite)) return '만료됨';
    const ms = invite!.expiresAt - Date.now();
    const h = Math.floor(ms / 3600000);
    if (h >= 1) return `${h}시간 남음`;
    return `${Math.max(1, Math.floor(ms / 60000))}분 남음`;
}

/** 초대 링크 — 누르면 방에 들어가면서 관리자로 등록된다 */
export function inviteLink(roomId: string, code: string): string {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}/room/${roomId}?adminInvite=${code}`;
}

// ===================================================================================
// 관리자 판별
// -----------------------------------------------------------------------------------
// 구버전 방은 admins 에 이메일이나 아이디 문자열이 들어 있다. 새 방은 adminUids 에
// uid 만 들어간다. 둘 다 읽되, 새로 쓸 때는 uid 만 쓴다.
//
// 예전 판별식에는 `admin === user.email.split('@')[0]` 이 있었다. 아이디가
// 'kim' 인 사람과 'kim@gmail.com' 인 남이 같은 사람으로 취급될 수 있었다.
// ===================================================================================
export function isRoomAdmin(
    room: { adminUid?: string; adminUids?: string[]; admins?: string[] } | null | undefined,
    user: { uid: string; email?: string | null } | null | undefined,
    superAdmin = false,
): boolean {
    if (!room || !user) return false;
    if (superAdmin) return true;
    if (room.adminUid === user.uid) return true;
    if (Array.isArray(room.adminUids) && room.adminUids.includes(user.uid)) return true;
    // 구버전 호환 — uid 또는 정확한 이메일만 인정한다
    if (Array.isArray(room.admins)) {
        const email = user.email || '';
        return room.admins.some(a => a === user.uid || (!!email && a === email));
    }
    return false;
}
