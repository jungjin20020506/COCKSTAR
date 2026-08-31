import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor, act } from '@testing-library/react';

// ===================================================================================
// 2026-08-31 업데이트 검증
// -----------------------------------------------------------------------------------
//  ① QR 초대 모달 — QR 이미지가 실제로 만들어져 화면에 붙는가
//  ② 알림 권한 유도 모달 — 지원/미지원 환경 각각 올바른 버튼이 뜨는가
//  ③ 선수 관리 모달(길게 누르기) — 관리자 휴식/복귀 토글이 동작하는가
//  ④ 자동 매칭 — 휴식 선수가 껴 있어도 '경기 시작'이 눌리는가 (정책 변경)
//  ⑤ 휴식 정책 — repairMatchQueues 가 휴식 선수를 더 이상 해체 사유로 보지 않는가
// ===================================================================================

// qrcode 라이브러리는 진짜 QR 을 만들 필요 없다 — 불렸는지와 결과 반영만 본다
vi.mock('qrcode', () => ({
    default: {
        toDataURL: vi.fn(() => Promise.resolve('data:image/png;base64,QR-STUB')),
    },
}));

import { QrModal, NotiPermissionModal, EditGamesModal, shouldAskNotification } from '../features/room/SmallModals';
import { AutoMatchSection } from '../features/room/AutoMatchSection';
import { RoomEntryFX } from '../features/room/RoomEntryFX';
import { InstallNudgeModal, withInstallFlag } from '../components/ui/InstallPrompt';
import { NotiPermissionBanner } from '../features/room/MyTurnBanner';
import { repairMatchQueues } from '../lib/matchQueues';

beforeEach(() => {
    localStorage.clear();
});

describe('QR 초대 모달', () => {
    it('열면 QR 이미지가 만들어져 화면에 붙는다', async () => {
        const { container } = render(
            <QrModal isOpen onClose={() => {}} roomId="room-abc" roomName="화요 정기전" />,
        );
        await waitFor(() => {
            const img = container.querySelector('img[alt="경기방 입장 QR 코드"]');
            expect(img).toBeTruthy();
            expect(img.src).toContain('QR-STUB');
        });
        // 스캔 주소는 공유 링크와 같은 /room/:id 여야 한다
        expect(container.textContent).toContain('/room/room-abc');
        expect(container.textContent).toContain('화요 정기전');
    });
});

describe('알림 권한 유도 모달', () => {
    it('알림을 지원하는 환경 — 알림 켜기 버튼이 뜨고, 닫으면 다시 묻지 않는다', () => {
        // jsdom 에 Notification 을 흉내 낸다
        vi.stubGlobal('Notification', {
            permission: 'default',
            requestPermission: vi.fn(() => Promise.resolve('granted')),
        });
        expect(shouldAskNotification()).toBe(true);

        const onClose = vi.fn();
        const { getByText } = render(<NotiPermissionModal isOpen onClose={onClose} />);
        expect(getByText('🔔 알림 켜기')).toBeTruthy();

        fireEvent.click(getByText('나중에 할게요'));
        expect(onClose).toHaveBeenCalled();
        // '나중에'를 눌러도 이 기기에서는 다시 묻지 않는다 (귀찮게 하지 않기)
        expect(shouldAskNotification()).toBe(false);
        vi.unstubAllGlobals();
    });

    it('알림 API 가 없는 환경(아이폰 사파리) — 설치 안내로 이어진다', () => {
        // Notification 이 없는 상태 + 아이폰 UA
        const original = window.Notification;
        delete window.Notification;
        vi.stubGlobal('navigator', { ...window.navigator, userAgent: 'iPhone', maxTouchPoints: 5 });

        const onNeedInstall = vi.fn();
        const { getByText } = render(
            <NotiPermissionModal isOpen onClose={() => {}} onNeedInstall={onNeedInstall} />,
        );
        fireEvent.click(getByText('홈 화면에 추가하는 방법 보기'));
        expect(onNeedInstall).toHaveBeenCalled();

        vi.unstubAllGlobals();
        if (original) window.Notification = original;
    });
});

describe('선수 관리 모달 (카드 길게 누르기)', () => {
    const player = { id: 'p1', name: '정형진', todayGames: 3, matchHistory: [], isResting: false };

    it('휴식으로 변경 버튼이 뜨고, 누르면 onToggleRest 가 불린다', () => {
        const onToggleRest = vi.fn();
        const { getByText } = render(
            <EditGamesModal isOpen onClose={() => {}} player={player} onSave={() => {}} onToggleRest={onToggleRest} />,
        );
        fireEvent.click(getByText('😴 휴식으로 변경'));
        expect(onToggleRest).toHaveBeenCalledWith(player);
    });

    it('휴식 중인 선수에게는 복귀 버튼이 뜬다', () => {
        const resting = { ...player, isResting: true };
        const { getByText } = render(
            <EditGamesModal isOpen onClose={() => {}} player={resting} onSave={() => {}} onToggleRest={() => {}} />,
        );
        expect(getByText('🏸 복귀시키기 (매칭에 다시 들어감)')).toBeTruthy();
        expect(getByText(/휴식 중/)).toBeTruthy();
    });
});

describe('자동 매칭 — 휴식 선수 정책', () => {
    const players = {
        a: { id: 'a', name: '김선수', gender: '남', level: 'A조', todayGames: 1 },
        b: { id: 'b', name: '이선수', gender: '남', level: 'B조', todayGames: 2 },
        c: { id: 'c', name: '박선수', gender: '남', level: 'B조', todayGames: 1, isResting: true },
        d: { id: 'd', name: '최선수', gender: '남', level: 'C조', todayGames: 0 },
    };

    it('휴식 선수가 껴 있어도 경기 시작 버튼이 활성화된다', () => {
        const onStart = vi.fn();
        const { getByText, container } = render(
            <AutoMatchSection
                autoMatches={{ 0: ['a', 'b', 'c', 'd'] }}
                players={players}
                isAdmin
                currentUserId="a"
                inProgressPlayerIds={new Set()}
                courtIndexByPlayer={{}}
                onGenerate={() => {}}
                generatingGender={null}
                onStart={onStart}
                onDelete={() => {}}
                onClearAll={() => {}}
                onRemovePlayer={() => {}}
            />,
        );
        const startBtn = getByText('경기 시작');
        expect(startBtn.disabled).toBe(false);
        fireEvent.click(startBtn);
        expect(onStart).toHaveBeenCalledWith('0');
        // 휴식 중이라는 안내는 보여주되, 막지는 않는다
        expect(container.textContent).toContain('휴식 중');
        expect(container.textContent).toContain('그래도 시작할 수 있어요');
    });

    it('나간 선수가 껴 있으면 여전히 시작할 수 없다', () => {
        const { getByText } = render(
            <AutoMatchSection
                autoMatches={{ 0: ['a', 'b', 'ghost', 'd'] }}
                players={players}
                isAdmin
                currentUserId="a"
                inProgressPlayerIds={new Set()}
                courtIndexByPlayer={{}}
                onGenerate={() => {}}
                generatingGender={null}
                onStart={() => {}}
                onDelete={() => {}}
                onClearAll={() => {}}
                onRemovePlayer={() => {}}
            />,
        );
        expect(getByText('정리중').disabled).toBe(true);
    });
});

describe('입장 연출 (RoomEntryFX) — 방마다 하루 한 번만', () => {
    it('처음 열면 나오고, 새로고침(재마운트) 후에는 안 나온다', () => {
        const first = render(<RoomEntryFX roomId="fx-room" roomName="화요 정기전" />);
        expect(first.container.textContent).toContain('화요 정기전');
        first.unmount();

        // 새로고침을 흉내 낸다 — 컴포넌트를 처음부터 다시 마운트
        const second = render(<RoomEntryFX roomId="fx-room" roomName="화요 정기전" />);
        expect(second.container.textContent).not.toContain('화요 정기전');
        second.unmount();

        // 다른 방은 그 방의 첫 입장이므로 나온다
        const other = render(<RoomEntryFX roomId="fx-other" roomName="목요 게스트전" />);
        expect(other.container.textContent).toContain('목요 게스트전');
        other.unmount();
    });
});

describe('알림 권한 상단 배너 (NotiPermissionBanner)', () => {
    it('권한을 아직 안 물어본 상태 — 배너가 보이고, 켜기를 누르면 권한 창이 뜬다', async () => {
        const requestPermission = vi.fn(() => Promise.resolve('granted'));
        vi.stubGlobal('Notification', { permission: 'default', requestPermission });

        const { getByText, container } = render(<NotiPermissionBanner />);
        expect(container.textContent).toContain('알림을 허용해야 내 차례·경기 시작 안내를 받을 수 있어요');

        await act(async () => { fireEvent.click(getByText('켜기')); });
        expect(requestPermission).toHaveBeenCalled();
        // 허용되면 배너가 사라진다
        expect(container.textContent).not.toContain('알림을 허용해야');
        vi.unstubAllGlobals();
    });

    it('이미 허용된 상태 — 배너가 아예 없다', () => {
        vi.stubGlobal('Notification', { permission: 'granted', requestPermission: vi.fn() });
        const { container } = render(<NotiPermissionBanner />);
        expect(container.innerHTML).toBe('');
        vi.unstubAllGlobals();
    });

    it('아이폰 사파리(알림 API 없음) — 홈 화면 추가 안내로 잇는다', () => {
        const original = window.Notification;
        delete window.Notification;
        vi.stubGlobal('navigator', { ...window.navigator, userAgent: 'iPhone', maxTouchPoints: 5 });

        const onNeedInstall = vi.fn();
        const { getByText, container } = render(<NotiPermissionBanner onNeedInstall={onNeedInstall} />);
        expect(container.textContent).toContain('홈 화면에 추가하면 내 차례 알림을 받을 수 있어요');
        fireEvent.click(getByText('방법 보기'));
        expect(onNeedInstall).toHaveBeenCalled();

        vi.unstubAllGlobals();
        if (original) window.Notification = original;
    });

    it('거부된 상태 — 설정에서 여는 길을 안내한다', () => {
        vi.stubGlobal('Notification', { permission: 'denied', requestPermission: vi.fn() });
        const { container } = render(<NotiPermissionBanner />);
        expect(container.textContent).toContain('알림이 꺼져 있어요');
        vi.unstubAllGlobals();
    });
});

describe('설치 유도 모달 (InstallNudgeModal)', () => {
    it('탈출 주소에 install=1 표시가 붙는다', () => {
        expect(withInstallFlag('https://cockstar.vercel.app/room/abc')).toBe(
            'https://cockstar.vercel.app/room/abc?install=1',
        );
        // 기존 쿼리가 있어도 보존된다
        expect(withInstallFlag('https://cockstar.vercel.app/room/abc?x=1')).toContain('x=1');
        expect(withInstallFlag('https://cockstar.vercel.app/room/abc?x=1')).toContain('install=1');
    });

    it('카카오톡 인앱 — "브라우저로 열고 설치하기" 버튼 하나를 내민다', async () => {
        vi.useFakeTimers();
        vi.stubGlobal('navigator', { ...window.navigator, userAgent: 'Mozilla/5.0 KAKAOTALK', maxTouchPoints: 5 });

        const { container, getByText } = render(<InstallNudgeModal />);
        await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
        expect(getByText('브라우저로 열고 설치하기')).toBeTruthy();
        expect(container.textContent).toContain('카카오톡 안에서는 설치와 알림이 안 돼요');

        vi.unstubAllGlobals();
        vi.useRealTimers();
    });

    it('인앱 탈출 후 도착(install=1) — 아이폰 사파리에서 설치 안내가 바로 열리고 주소가 정리된다', async () => {
        vi.useFakeTimers();
        vi.stubGlobal('navigator', { ...window.navigator, userAgent: 'Mozilla/5.0 iPhone Safari', maxTouchPoints: 5 });
        window.history.replaceState(null, '', '/?install=1');

        // install=1 은 '앱이 뜨는 순간'(모듈 로드 시점)에 한 번만 읽힌다 —
        // 실제 앱 시작을 흉내 내려면 모듈을 새로 불러와야 한다
        vi.resetModules();
        const { InstallNudgeModal: FreshNudge } = await import('../components/ui/InstallPrompt');

        const { container } = render(<FreshNudge />);
        await act(async () => { await vi.advanceTimersByTimeAsync(600); });
        expect(container.textContent).toContain('홈 화면에 추가');
        // 주소의 install=1 은 바로 지워진다 (새로고침해도 또 뜨지 않게)
        expect(window.location.search).not.toContain('install');

        window.history.replaceState(null, '', '/');
        vi.unstubAllGlobals();
        vi.useRealTimers();
    });
});

describe('repairMatchQueues — 휴식은 해체 사유가 아니다', () => {
    it('휴식 선수만 낀 경기는 그대로 두고, 나간 선수가 낀 경기만 정리한다', () => {
        const players = {
            a: { id: 'a', name: 'a' },
            b: { id: 'b', name: 'b' },
            c: { id: 'c', name: 'c', isResting: true },
            d: { id: 'd', name: 'd' },
        };
        const { changed, newState, dissolvedCount } = repairMatchQueues({
            autoMatches: { 0: ['a', 'b', 'c', 'd'], 1: ['a', 'gone', 'b', 'd'] },
            scheduledMatches: { 0: ['c', 'gone', null, null] },
        }, players);

        expect(changed).toBe(true);
        expect(dissolvedCount).toBe(1);                                  // 'gone' 낀 자동 매칭만 해체
        expect(newState.autoMatches['0']).toEqual(['a', 'b', 'c', 'd']); // 휴식 선수 경기는 유지
        expect(newState.scheduledMatches['0'][0]).toBe('c');             // 휴식 선수 슬롯 유지
        expect(newState.scheduledMatches['0'][1]).toBe(null);            // 나간 선수 슬롯만 비움
    });
});
