import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, hasPassword, isLegacyPassword } from '../lib/roomPassword';
import {
    createInvite, inviteMatches, isInviteValid, normalizeCode, isRoomAdmin,
} from '../lib/adminInvite';
import { isSuperAdmin } from '../lib/superAdmin';
import { checkJoinable } from '../features/room/JoinGate';

// ===================================================================================
// 보안·권한 — 여기가 틀리면 조용히 잘못된다
// -----------------------------------------------------------------------------------
// 이 파일의 테스트는 전부 '실제로 있었던 문제'를 다시 못 일어나게 막는 것들이다.
// ===================================================================================

describe('방 비밀번호', () => {
    it('평문을 저장하지 않는다', async () => {
        const rec = await hashPassword('1234');
        expect(rec.hash).not.toContain('1234');
        expect(rec.salt).toBeTruthy();
    });

    it('같은 비밀번호라도 방마다 해시가 다르다', async () => {
        const a = await hashPassword('1234');
        const b = await hashPassword('1234');
        // 소금이 다르므로 해시도 달라야 한다 — 하나가 풀려도 나머지가 같이 풀리지 않는다
        expect(a.hash).not.toBe(b.hash);
    });

    it('맞는 비밀번호만 통과시킨다', async () => {
        const rec = await hashPassword('1234');
        const room = { passwordHash: rec.hash, passwordSalt: rec.salt };
        expect(await verifyPassword('1234', room)).toBe(true);
        expect(await verifyPassword('12345', room)).toBe(false);
        expect(await verifyPassword('', room)).toBe(false);
    });

    it('비밀번호가 없는 방은 그냥 통과시킨다', async () => {
        expect(await verifyPassword('아무거나', {})).toBe(true);
    });

    it('구버전 평문 방도 열린다 (이미 돌아가는 방을 잠그면 안 된다)', async () => {
        const room = { password: 'old1234' };
        expect(await verifyPassword('old1234', room)).toBe(true);
        expect(await verifyPassword('틀림', room)).toBe(false);
        expect(isLegacyPassword(room)).toBe(true);
        expect(hasPassword(room)).toBe(true);
    });

    it('빈 비밀번호는 잠그지 않은 것으로 본다', async () => {
        expect(await hashPassword('   ')).toBeNull();
    });
});

describe('슈퍼 관리자 판별', () => {
    it('아이디 로그인 계정(domain → domain@cockstar.app)을 인정한다', () => {
        expect(isSuperAdmin({ uid: 'u1', email: 'domain@cockstar.app' })).toBe(true);
        expect(isSuperAdmin({ uid: 'u1', email: 'Domain@Cockstar.app' })).toBe(true); // 대소문자 무시
    });

    it('접두사 사칭은 막는다 (예전 startsWith 사고 재발 방지)', () => {
        expect(isSuperAdmin({ uid: 'u1', email: 'domain1@cockstar.app' })).toBe(false);
        expect(isSuperAdmin({ uid: 'u1', email: 'domain@evil.com' })).toBe(false);
        expect(isSuperAdmin({ uid: 'u1', email: 'domain@cockstar.app.evil.com' })).toBe(false);
    });

    it('로그인 안 한 사람·이메일 없는 계정은 아니다', () => {
        expect(isSuperAdmin(null)).toBe(false);
        expect(isSuperAdmin({ uid: 'u1', email: '' })).toBe(false);
    });
});

describe('관리자 초대 코드', () => {
    it('헷갈리는 글자(0, O, 1, I, L)를 쓰지 않는다', () => {
        for (let i = 0; i < 40; i += 1) {
            expect(createInvite('u1').code).not.toMatch(/[01OIL]/);
        }
    });

    it('소문자·공백·하이픈을 너그럽게 받는다', () => {
        const invite = createInvite('u1');
        const messy = ` ${invite.code.toLowerCase().split('').join('-')} `;
        expect(normalizeCode(messy)).toBe(invite.code);
        expect(inviteMatches(invite, messy)).toBe(true);
    });

    it('만료된 코드는 통과하지 않는다', () => {
        const invite = { ...createInvite('u1'), expiresAt: Date.now() - 1000 };
        expect(isInviteValid(invite)).toBe(false);
        expect(inviteMatches(invite, invite.code)).toBe(false);
    });

    it('없는 코드에는 아무것도 통과하지 않는다', () => {
        expect(inviteMatches(null, 'ABC123')).toBe(false);
        expect(inviteMatches(undefined, '')).toBe(false);
    });
});

describe('관리자 판별', () => {
    const user = { uid: 'u1', email: 'kim@gmail.com' };

    it('방장과 공동 관리자를 인정한다', () => {
        expect(isRoomAdmin({ adminUid: 'u1' }, user)).toBe(true);
        expect(isRoomAdmin({ adminUid: 'x', adminUids: ['u1'] }, user)).toBe(true);
    });

    it('남을 나로 착각하지 않는다', () => {
        // 예전 코드는 `admins` 에 든 문자열과 이메일 앞부분('kim')을 비교했다.
        // 아이디가 'kim' 인 남과 kim@gmail.com 이 같은 사람이 됐다.
        expect(isRoomAdmin({ adminUid: 'x', admins: ['kim'] }, user)).toBe(false);
        expect(isRoomAdmin({ adminUid: 'x', admins: ['kim@gmail.com'] }, user)).toBe(true);
    });

    it('슈퍼 관리자는 모든 방을 연다', () => {
        expect(isRoomAdmin({ adminUid: 'x' }, user, true)).toBe(true);
    });

    it('로그인 전에는 관리자가 아니다', () => {
        expect(isRoomAdmin({ adminUid: 'u1' }, null)).toBe(false);
    });
});

describe('입장 조건', () => {
    const room = { levelLimit: 'B조', maxPlayers: 10 };

    it('설정한 급수보다 낮으면 막는다', () => {
        expect(checkJoinable(room, { level: 'C조' }, 0).ok).toBe(false);
        expect(checkJoinable(room, { level: 'A조' }, 0).ok).toBe(true);
        expect(checkJoinable(room, { level: 'B조' }, 0).ok).toBe(true);
    });

    it('급수를 아직 안 정한 사람은 막지 않는다', () => {
        // 'N조'는 '못 친다'가 아니라 '아직 모른다'이다. 판단은 방장 몫으로 남긴다.
        expect(checkJoinable(room, { level: 'N조' }, 0).ok).toBe(true);
        expect(checkJoinable(room, {}, 0).ok).toBe(true);
    });

    it('전체 급수 방은 누구나 들어간다', () => {
        expect(checkJoinable({ levelLimit: 'N조', maxPlayers: 10 }, { level: 'E조' }, 0).ok).toBe(true);
    });

    it('정원이 차면 막는다', () => {
        expect(checkJoinable(room, { level: 'A조' }, 10).ok).toBe(false);
        expect(checkJoinable(room, { level: 'A조' }, 9).ok).toBe(true);
    });
});
