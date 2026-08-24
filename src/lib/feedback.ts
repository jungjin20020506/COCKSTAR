// ===================================================================================
// 문의 창구 — 사용자가 버그·불편을 알릴 수 있게
// -----------------------------------------------------------------------------------
// 지금까지 사용자가 무언가 잘못됐을 때 할 수 있는 일이 없었다. 오류는 콘솔로
// 사라지고, 불편한 점은 마음속에 남았다가 앱을 지우는 걸로 끝났다.
//
// 두 갈래를 준다. 성격이 다르다.
//   · 카카오 오픈채팅 — 즉답이 필요한 것, 가볍게 말 걸고 싶은 것
//   · 이메일          — 길게 쓸 것, 스크린샷을 붙일 것, 기록이 남아야 할 것
//
// 메일에는 진단 정보(앱 버전·화면 크기·최근 오류)를 자동으로 붙인다. 이게 없으면
// "안 돼요" 한 줄만 오고, 다시 물어보는 데 하루가 간다.
// 개인정보(이름·이메일·방 이름)는 넣지 않는다 — 본문에 직접 쓴 것만 전달된다.
// ===================================================================================

import { SUPPORT } from '../constants';
import { diagnosticsText } from './errorLog';

export type FeedbackKind = 'bug' | 'idea' | 'question' | 'etc';

export const FEEDBACK_KINDS: Array<{ key: FeedbackKind; label: string; emoji: string; hint: string }> = [
    { key: 'bug', label: '버그 신고', emoji: '🐞', hint: '눌렀는데 안 되거나, 숫자가 이상해요' },
    { key: 'idea', label: '기능 제안', emoji: '💡', hint: '이런 게 있으면 좋겠어요' },
    { key: 'question', label: '사용 문의', emoji: '❓', hint: '이건 어떻게 쓰는 건가요?' },
    { key: 'etc', label: '기타', emoji: '💬', hint: '그 밖의 이야기' },
];

export function kindLabel(kind: FeedbackKind): string {
    return FEEDBACK_KINDS.find(k => k.key === kind)?.label || '문의';
}

/** 메일 본문을 만든다. 진단 정보는 사용자가 지울 수 있게 맨 아래에 둔다. */
export function buildMailBody(kind: FeedbackKind, message: string, includeDiagnostics: boolean): string {
    const lines = [
        message.trim() || '(내용을 적어주세요)',
        '',
        '',
        '─────────────────────',
    ];
    if (includeDiagnostics) {
        lines.push('아래는 문제를 찾는 데 쓰이는 정보입니다. 지우고 보내셔도 됩니다.');
        lines.push('');
        lines.push(diagnosticsText());
    } else {
        lines.push('COCKSTAR 앱에서 보냄');
    }
    return lines.join('\n');
}

export function buildMailtoUrl(kind: FeedbackKind, message: string, includeDiagnostics = true): string {
    const subject = `[콕스타] ${kindLabel(kind)}`;
    const body = buildMailBody(kind, message, includeDiagnostics);
    return `mailto:${SUPPORT.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** 메일 앱을 연다. 열리지 않는 환경(일부 인앱 브라우저)에서는 false 를 돌려준다. */
export function openMail(kind: FeedbackKind, message: string, includeDiagnostics = true): boolean {
    try {
        window.location.href = buildMailtoUrl(kind, message, includeDiagnostics);
        return true;
    } catch {
        return false;
    }
}

export function openKakaoChat(): void {
    window.open(SUPPORT.kakaoOpenChat, '_blank', 'noopener,noreferrer');
}
