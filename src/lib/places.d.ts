// places.js 는 데이터 가공 위주라 아직 .js 로 둔다. 타입만 여기서 알려준다.
export declare function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number;
export declare const GYMS: any[];
export declare const CLUBS: any[];
export declare const GYM_REGIONS: Array<{ name: string; count: number }>;
export declare const GYM_COUNT: number;
export declare const CLUB_COUNT: number;
export declare const GYM_FETCHED_AT: string | null;
export declare const CLUB_FETCHED_AT: string | null;
export declare const CLUB_SOURCE: string;
export declare const MAP_FILTERS: Array<{ key: string; label: string }>;
export declare const OWNERSHIP_LABEL: Record<string, string>;
export declare function filterGyms(key: string): any[];
export declare function nearestGyms(lat: number, lng: number, list?: any[], limit?: number): any[];
export declare function searchGyms(text: string, limit?: number): any[];
export declare function clubsInRegion(region: string): any[];
