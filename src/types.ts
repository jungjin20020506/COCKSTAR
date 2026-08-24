// ===================================================================================
// 도메인 타입 — TypeScript 점진 도입의 첫걸음
// -----------------------------------------------------------------------------------
// 앱 전체를 TS로 옮기는 건 위험이 크다(4천 줄짜리 화면 코드가 한 번에 안 돌 수 있다).
// 그래서 '데이터가 어떻게 생겼는지'부터 적어둔다. Firestore 문서 구조는 코드 어디에도
// 적혀 있지 않아서, 필드 이름을 잘못 쓰면 런타임에야 발견됐다.
//
// 새로 만드는 순수 로직 파일은 .ts 로 쓰고 여기 타입을 import 한다.
// 기존 .jsx 파일도 JSDoc `@type {import('./types').Player}` 로 힌트를 받을 수 있다.
// ===================================================================================

/** 급수. N조는 '아직 모름'이지 '못 침'이 아니다. */
export type Level = 'S조' | 'A조' | 'B조' | 'C조' | 'D조' | 'E조' | 'N조' | '미설정';

export type Gender = '남' | '여';

/** Firestore Timestamp / ISO 문자열 / Date 중 아무거나 올 수 있는 자리 */
export type TimeLike = { toDate: () => Date } | string | Date | number | null | undefined;

/** users/{uid} */
export interface UserProfile {
    name: string;
    level: Level;
    gender: Gender;
    birthYear: string;
    region?: string;
    email?: string;
    /** 개인 고유 코드 — 관리자 초대에 쓴다 (사람이 읽고 부를 수 있는 6자리) */
    playerCode?: string;
    todayGames?: number;
    lastResetDate?: string;
    /** 찜한 경기방 id 목록 */
    favoriteRooms?: string[];
    /** 찜한 상품 idx 목록 */
    favoriteProducts?: number[];
    /** 본 튜토리얼 { [키]: ISO시각 } */
    tutorialSeen?: Record<string, string>;
    kakaoId?: string;
    createdAt?: TimeLike;
}

/** rooms/{roomId}/players/{uid} */
export interface Player {
    id: string;
    name: string;
    level: Level;
    gender: Gender;
    birthYear?: string;
    region?: string;
    entryTime?: TimeLike;
    /** 마지막으로 살아 있다고 알린 시각 — 유령 인원 정리에 쓴다 */
    lastSeen?: TimeLike;
    todayGames?: number;
    isResting?: boolean;
    isBot?: boolean;
    role?: 'player' | 'admin';
    /** 화면 표시용 문자열 기록 (구버전 호환) */
    matchHistory?: string[];
    /** 매칭 엔진이 보는 구조체 기록 */
    todayRecentGames?: MatchRecord[];
}

export interface MatchRecord {
    timestamp: string;
    partners: string[];
    opponents: string[];
    /** 관리자가 경기 수를 손으로 올린 경우 — 만남 기록에는 넣지 않는다 */
    isManual?: boolean;
    /** 점수를 입력했다면 */
    score?: { us: number; them: number };
}

export interface Court {
    players: string[];
    startTime: string;
}

export type Sensitivity = 'low' | 'normal' | 'high' | 'max';

export interface AutoMatchConfig {
    sensitivity: Sensitivity;
    perGenderSensitivity: boolean;
    maleSensitivity: Sensitivity;
    femaleSensitivity: Sensitivity;
}

export interface Coords { lat: number; lng: number; }

/** rooms/{roomId} */
export interface Room {
    id: string;
    name: string;
    location: string;
    address: string;
    coords: Coords | null;
    description: string;
    levelLimit: Level;
    maxPlayers: number;
    /** 평문이 아니라 해시. 검증은 lib/roomPassword.ts 참고 */
    passwordHash?: string;
    /** 구버전 평문 필드 — 읽기 전용 호환용. 새로 쓰지 않는다 */
    password?: string;
    adminUid: string;
    adminName: string;
    /** 공동 관리자 uid 목록 */
    adminUids?: string[];
    /** 구버전 이메일/아이디 기반 목록 — 읽기 호환용 */
    admins?: string[];
    createdAt?: TimeLike;
    /** 마지막으로 경기가 돌아간 시각 — '최근 운영순' 정렬에 쓴다 */
    lastActiveAt?: TimeLike;
    playerCount?: number;
    numScheduledMatches: number;
    numInProgressCourts: number;
    scheduledMatches: Record<string, (string | null)[]>;
    inProgressCourts: (Court | null)[];
    autoMatches: Record<string, string[]>;
    autoMatchConfig: AutoMatchConfig;
    lastDailyResetKey?: string;
    lastDailyResetAt?: TimeLike;
}

/** 경기방 목록 정렬 기준 */
export type RoomSortKey = 'recent' | 'near' | 'crowded' | 'new' | 'name';
