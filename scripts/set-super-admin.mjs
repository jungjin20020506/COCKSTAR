// ===================================================================================
// 슈퍼 관리자 커스텀 클레임 붙이기 (아이디어 #82)
// -----------------------------------------------------------------------------------
// 클라이언트의 이메일 목록(superAdmin.ts)은 '화면 권한'만 준다.
// Firestore 보안 규칙의 isSuper() 는 토큰의 커스텀 클레임(superAdmin: true)만 믿는다 —
// 신고 검토, config/app(버전 게이트) 쓰기, 남의 방 삭제 같은 서버 권한은
// 이 스크립트로 클레임을 붙여야 실제로 동작한다.
//
// [준비 — 한 번만]
//   1. Firebase 콘솔 → 프로젝트 설정 → 서비스 계정 → "새 비공개 키 생성"
//      → 내려받은 JSON 을 안전한 곳에 저장 (⚠️ 저장소에 커밋 금지!)
//   2. npm i -D firebase-admin
//
// [사용법]
//   set GOOGLE_APPLICATION_CREDENTIALS=C:\경로\serviceAccount.json   (PowerShell 은 $env:)
//   node scripts/set-super-admin.mjs domain@cockstar.app
//   node scripts/set-super-admin.mjs --revoke someone@cockstar.app   (해제)
//   node scripts/set-super-admin.mjs --list                          (현재 클레임 확인)
//
// 이메일을 안 넘기면 기본 목록(아래 DEFAULT_EMAILS)에 전부 붙인다.
// 클레임은 다음 토큰 갱신(최대 1시간) 또는 재로그인 때부터 적용된다.
// ===================================================================================

const DEFAULT_EMAILS = [
    'domain@cockstar.app',
    'jung22459369@gmail.com',
];

async function main() {
    let admin;
    try {
        admin = await import('firebase-admin/app');
    } catch {
        console.error('firebase-admin 이 없습니다. 먼저 설치하세요:\n\n  npm i -D firebase-admin\n');
        process.exit(1);
    }
    const { initializeApp, applicationDefault } = admin;
    const { getAuth } = await import('firebase-admin/auth');

    if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        console.error(
            '서비스 계정 키가 필요합니다.\n'
            + 'Firebase 콘솔 → 프로젝트 설정 → 서비스 계정 → 새 비공개 키 생성 후:\n\n'
            + '  PowerShell:  $env:GOOGLE_APPLICATION_CREDENTIALS="C:\\경로\\serviceAccount.json"\n'
            + '  cmd:         set GOOGLE_APPLICATION_CREDENTIALS=C:\\경로\\serviceAccount.json\n',
        );
        process.exit(1);
    }

    initializeApp({ credential: applicationDefault() });
    const auth = getAuth();

    const args = process.argv.slice(2);
    const revoke = args.includes('--revoke');
    const listOnly = args.includes('--list');
    const emails = args.filter(a => !a.startsWith('--'));
    const targets = emails.length > 0 ? emails : DEFAULT_EMAILS;

    for (const email of targets) {
        try {
            const user = await auth.getUserByEmail(email);
            if (listOnly) {
                console.log(`ℹ️  ${email} (uid: ${user.uid}) → superAdmin: ${user.customClaims?.superAdmin === true}`);
                continue;
            }
            const value = !revoke;
            await auth.setCustomUserClaims(user.uid, { ...(user.customClaims || {}), superAdmin: value });
            console.log(`✅ ${email} → superAdmin: ${value}`);
        } catch (e) {
            if (e?.code === 'auth/user-not-found') {
                console.error(`❌ ${email} — 이 이메일로 가입된 계정이 없습니다.`
                    + ' Firebase 콘솔 → Authentication → 사용자 추가로 먼저 만들어주세요.');
            } else {
                console.error(`❌ ${email} — ${e.message}`);
            }
        }
    }
    if (!listOnly) console.log('\n적용은 해당 계정이 재로그인하거나 토큰이 갱신될 때(최대 1시간)부터입니다.');
}

main();
