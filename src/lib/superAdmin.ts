// ===================================================================================
// 슈퍼 관리자 판별
// -----------------------------------------------------------------------------------
// 예전 코드는 `user.email?.startsWith('domain')` 이었다.
// 'domain' 으로 시작하기만 하면 되니까 'domain1@아무데나.com' 으로 가입한 사람도
// 앱 전체의 최고 권한을 가졌다. 실수라기보다 사고에 가깝다.
//
// 이제 두 가지만 인정한다.
//   ① Firebase Auth 커스텀 클레임 superAdmin === true  (제대로 된 방법)
//   ② 아래 목록에 정확히 일치하는 이메일               (클레임을 못 붙이는 동안의 임시)
//
// ★ ②는 임시 수단이다. 서버(Admin SDK)에서 클레임을 붙일 수 있게 되면
//   목록을 비우는 게 맞다. 클레임은 토큰에 서명되어 들어가므로 위조할 수 없고,
//   Firestore 보안 규칙에서도 그대로 검사할 수 있다.
//   붙이는 법:  admin.auth().setCustomUserClaims(uid, { superAdmin: true })
// ===================================================================================

import type { User } from 'firebase/auth';

const SUPER_ADMIN_EMAILS = [
    // 아이디 로그인 'domain' — convertToEmail 이 @cockstar.app 을 붙인다
    'domain@cockstar.app',
    'domain@special.user',
    'jung22459369@gmail.com',
];

/** 토큰에서 읽어온 클레임을 담아둔다 (로그인 때 한 번 읽는다) */
let cachedClaims: Record<string, unknown> | null = null;
let cachedUid: string | null = null;

export async function loadClaims(user: User | null): Promise<void> {
    if (!user) { cachedClaims = null; cachedUid = null; return; }
    try {
        const res = await user.getIdTokenResult();
        cachedClaims = res.claims as Record<string, unknown>;
        cachedUid = user.uid;
    } catch {
        cachedClaims = null;
        cachedUid = null;
    }
}

export function isSuperAdmin(user: { uid?: string; email?: string | null } | null | undefined): boolean {
    if (!user) return false;
    if (cachedUid && cachedUid === user.uid && cachedClaims?.superAdmin === true) return true;
    const email = (user.email || '').toLowerCase().trim();
    return !!email && SUPER_ADMIN_EMAILS.includes(email);
}
