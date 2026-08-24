import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { WelcomeTour } from '../features/tutorial/WelcomeTour';
import { RoomAdminGuide } from '../features/tutorial/RoomAdminGuide';

// ===================================================================================
// 튜토리얼 렌더 스모크 — 슬라이드를 끝까지 넘겨본다
// -----------------------------------------------------------------------------------
// 튜토리얼은 '가입 직후 딱 한 번'만 떠서, 슬라이드 하나가 런타임에 깨져도
// 개발 중에는 좀처럼 발견되지 않는다 (다들 이미 봤다고 기록돼 있으니까).
// 그래서 여기서 매 슬라이드를 실제로 렌더하고 클릭해 끝까지 간다.
// ===================================================================================

describe('환영 투어 (WelcomeTour)', () => {
    it('아홉 장을 끝까지 넘기면 onComplete 가 불린다', () => {
        const onComplete = vi.fn();
        const { getByText, container } = render(
            <WelcomeTour userName="테스터" onComplete={onComplete} />,
        );

        // 첫 장 — 이름이 인사에 들어간다
        expect(container.textContent).toContain('테스터님');

        // 마지막 장까지 CTA 를 계속 누른다 (장마다 문구가 달라 role 로 찾는다)
        for (let guard = 0; guard < 20 && onComplete.mock.calls.length === 0; guard += 1) {
            const next = container.querySelector('.wt-next');
            expect(next).toBeTruthy();
            fireEvent.click(next);
        }
        expect(onComplete).toHaveBeenCalledTimes(1);
        // 진행 표기가 9장 기준인지 (슬라이드를 더하고 카운트를 안 고치면 여기서 잡힌다)
        expect(container.textContent).toContain('9 / 9');
    });

    it('새 알림 슬라이드가 들어 있다', () => {
        const { container } = render(<WelcomeTour onComplete={() => {}} />);
        const next = () => fireEvent.click(container.querySelector('.wt-next'));
        next(); next(); next();   // STEP 3 = 알림 슬라이드
        expect(container.textContent).toContain('내 차례는');
        expect(container.textContent).toContain('띠링');
    });

    it('뒤로가기는 이전 장으로 간다 (앱이 꺼지지 않는다)', () => {
        const { container } = render(<WelcomeTour onComplete={() => {}} />);
        fireEvent.click(container.querySelector('.wt-next'));
        expect(container.textContent).toContain('2 / 9');
        fireEvent.popState(window);   // act() 로 감싸 상태 반영까지 기다린다
        expect(container.textContent).toContain('1 / 9');
    });
});

describe('관리자 안내 (RoomAdminGuide)', () => {
    it('네 페이지를 끝까지 넘기면 onComplete 가 불린다', () => {
        const onComplete = vi.fn();
        const { container, getByText } = render(
            <RoomAdminGuide open onComplete={onComplete} />,
        );
        // 1→2→3→4 페이지 이동 후 마지막 버튼
        fireEvent.click(getByText('다음'));
        fireEvent.click(getByText('다음'));
        fireEvent.click(getByText('다음'));
        // 4페이지 = 새 기능 안내
        expect(container.ownerDocument.body.textContent).toContain('공지사항');
        expect(container.ownerDocument.body.textContent).toContain('매칭 타임라인');
        expect(container.ownerDocument.body.textContent).toContain('3연속');
        fireEvent.click(getByText('시작할게요'));
        expect(onComplete).toHaveBeenCalledTimes(1);
    });
});
