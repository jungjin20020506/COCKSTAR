// ===================================================================================
// 운영일 키 — 앱 전체가 '오늘'을 같은 기준으로 본다
// -----------------------------------------------------------------------------------
// 예전에는 방(새벽 2시 기준)과 사용자 문서(UTC 자정 기준)가 서로 다른 날짜를 썼다.
// 그래서 한국 시간 오전 9시에 개인 경기 수만 먼저 0이 되는 어긋남이 있었다.
// 이제 두 곳 모두 이 함수 하나를 쓴다.
//
//   ① +9시간  → 한국 시간으로 맞춘다
//   ② −2시간  → 새벽 2시 이전은 '어제'로 친다 (운동은 밤늦게 끝난다)
//   합쳐서 +7시간을 더한 뒤 UTC 날짜를 읽는다.
//
// UTC 필드로 읽는 게 핵심이다. 기기의 표준시 설정이 무엇이든 같은 결과가 나온다.
// ===================================================================================

export const getDailyResetKey = (now = new Date()) => {
    const shifted = new Date(now.getTime() + 7 * 60 * 60 * 1000);
    const y = shifted.getUTCFullYear();
    const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
    const d = String(shifted.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

/** 'YYYY-MM-DD' → '2026년 8월 24일 (월)' */
export const formatDateKo = (date) => {
    const d = date instanceof Date ? date : new Date(date);
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]})`;
};

/** 얼마나 지났는지 사람 말로 — '방금', '12분 전', '3시간 전', '2일 전' */
export function timeAgo(value) {
    if (!value) return '';
    const t = value?.toDate ? value.toDate().getTime() : new Date(value).getTime();
    if (!Number.isFinite(t)) return '';
    const sec = Math.floor((Date.now() - t) / 1000);
    if (sec < 60) return '방금';
    if (sec < 3600) return `${Math.floor(sec / 60)}분 전`;
    if (sec < 86400) return `${Math.floor(sec / 3600)}시간 전`;
    if (sec < 86400 * 30) return `${Math.floor(sec / 86400)}일 전`;
    return `${Math.floor(sec / (86400 * 30))}개월 전`;
}

/** Firestore Timestamp / ISO 문자열 / Date → 밀리초. 못 읽으면 null */
export function toMillis(value) {
    if (!value) return null;
    if (value?.toDate) return value.toDate().getTime();
    const t = new Date(value).getTime();
    return Number.isFinite(t) ? t : null;
}
