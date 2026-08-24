// ===================================================================================
// 앱 전역 상수 — 화면 여러 곳이 같은 값을 봐야 하는 것들만 모은다
// ===================================================================================

/** 한 경기에 들어가는 사람 수 (복식) */
export const PLAYERS_PER_MATCH = 4;

/** 급수 정렬 순서 (화면 정렬 전용 — 매칭 엔진의 급수 값과는 용도가 다르다) */
export const LEVEL_ORDER = {
    'S조': 1, 'A조': 2, 'B조': 3, 'C조': 4, 'D조': 5, 'E조': 6, 'N조': 7, '미설정': 8,
};

/** 프로필·방 설정에서 고를 수 있는 급수 */
export const LEVELS = ['S조', 'A조', 'B조', 'C조', 'D조', 'E조', 'N조'];

/** 가입 시 고르는 지역 */
export const REGIONS = ['서울', '경기', '인천', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'];

export const getLevelColor = (level) => {
    switch (level) {
        case 'S조': return 'border-sky-400 text-sky-400';
        case 'A조': return 'border-red-500 text-red-400';
        case 'B조': return 'border-orange-500 text-orange-400';
        case 'C조': return 'border-amber-400 text-amber-300';
        case 'D조': return 'border-emerald-500 text-emerald-400';
        case 'E조': return 'border-blue-500 text-blue-400';
        default: return 'border-zinc-500 text-zinc-400';
    }
};

/** NOERROR 공식 파트너 (콕스타 공식 스폰서) */
export const NOERROR_URL = 'https://www.pjbsports.com/';

/**
 * 경기방 포인트 색 — 방마다 고를 수 있는 테마 색 (내 방이라는 소속감).
 * 값은 hex 로 저장한다(roomData.themeColor). 없으면 기본 라임(volt).
 * 전부 어두운 배경 위에서 검정 글자가 읽히는 밝은 색으로 골랐다.
 */
export const ROOM_THEMES = [
    { key: 'volt', color: '#CDFB47', label: '라임' },
    { key: 'sky', color: '#4CC9F0', label: '스카이' },
    { key: 'coral', color: '#FF6A52', label: '코랄' },
    { key: 'violet', color: '#B79CFF', label: '바이올렛' },
    { key: 'gold', color: '#FFC740', label: '골드' },
    { key: 'mint', color: '#34E27A', label: '민트' },
];

/** 공용 폼 클래스 (다크) */
export const FIELD_CLS = 'w-full p-3.5 bg-card2 rounded-xl border border-white/10 focus:border-volt outline-none font-bold text-txt placeholder-muted transition-colors';
export const LABEL_CLS = 'block text-[11px] font-black label text-dim mb-1.5 ml-0.5';

// ===================================================================================
// 문의 창구 — 사용자가 버그·불편을 알릴 수 있는 곳
// ===================================================================================
export const SUPPORT = {
    email: 'jung22459369@gmail.com',
    kakaoOpenChat: 'https://open.kakao.com/o/siJxXzXh',
    developerName: '정형진',
};

// ===================================================================================
// 사용자 계정 이메일 변환
// -----------------------------------------------------------------------------------
// 콕스타는 '아이디'로 가입할 수 있는데 Firebase Auth는 이메일만 받는다.
// 그래서 아이디 뒤에 도메인을 붙여 가짜 이메일을 만든다.
// ===================================================================================
export const ACCOUNT_DOMAIN = 'cockstar.app';

export const convertToEmail = (input) => {
    const clean = String(input || '').trim();
    if (!clean) return '';
    if (clean.includes('@')) return clean;
    return `${clean}@${ACCOUNT_DOMAIN}`;
};

/** 가짜 이메일이면 아이디만 보여준다 (@cockstar.app 은 사용자에게 의미 없는 값이다) */
export const displayAccount = (email) => {
    const s = String(email || '');
    return s.endsWith(`@${ACCOUNT_DOMAIN}`) ? s.split('@')[0] : s;
};
