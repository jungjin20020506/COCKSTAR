import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthContext';
import { logError } from '../lib/errorLog';

// ===================================================================================
// 경기방 목록 — 앱 전체가 구독을 하나만 쓴다
// -----------------------------------------------------------------------------------
// 예전에는 로비 화면과 콕맵이 각자 rooms 컬렉션 전체를 구독했다. 두 화면을 오가면
// 구독이 붙었다 떨어졌다 하고, 둘 다 떠 있는 순간에는 같은 데이터를 두 번 받는다.
// 방이 수백 개가 되면 트래픽과 요금이 그대로 두 배다.
//
// 이제 여기서 한 번만 구독하고 두 화면이 나눠 쓴다.
//
// [정렬과 개수]
//   서버에서 lastActiveAt 기준으로 정렬하고 200개로 끊는다. 화면에서 다시 정렬할
//   거라 서버 정렬은 '무엇을 가져올지' 고르는 용도다 — 방이 1,000개가 되어도
//   최근에 돌아간 200개만 받으면 충분하다.
//
//   ⚠️ lastActiveAt 이 없는 구버전 방은 orderBy 결과에서 빠진다.
//      그래서 처음에는 createdAt 으로도 한 번 받아 합친다.
// ===================================================================================

const RoomsContext = createContext(null);

const MAX_ROOMS = 200;

export function RoomsProvider({ children }) {
    // ★ 로그인 상태가 바뀌면 다시 구독한다.
    //   구독은 시작하는 순간의 인증 토큰으로 붙는다. 앱이 뜨자마자(아직 로그인 전)
    //   구독을 걸면 permission-denied 가 나는데, 그 구독은 죽은 채로 남아서
    //   로그인한 뒤에도 목록이 영영 비어 있었다.
    const { user, loading: authLoading } = useAuth();
    const [byId, setById] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        // 인증 판정이 끝날 때까지 기다린다 (로그인 전/후 어느 쪽으로든 확정된 뒤에 붙는다)
        if (authLoading) return undefined;
        setById({});
        setError(null);
        const roomsRef = collection(db, 'rooms');

        // 두 갈래로 구독한다 (구버전 방이 목록에서 사라지지 않게)
        const queries = [
            query(roomsRef, orderBy('lastActiveAt', 'desc'), limit(MAX_ROOMS)),
            query(roomsRef, orderBy('createdAt', 'desc'), limit(MAX_ROOMS)),
        ];

        let settled = 0;
        const unsubs = queries.map((q, idx) => onSnapshot(
            q,
            (snap) => {
                setById(prev => {
                    const next = { ...prev };
                    snap.docChanges().forEach(change => {
                        if (change.type === 'removed') delete next[change.doc.id];
                        else next[change.doc.id] = { id: change.doc.id, ...change.doc.data() };
                    });
                    return next;
                });
                settled += 1;
                if (settled >= 1) setLoading(false);
            },
            (e) => {
                // 로그인 전에는 권한 오류가 정상이다 (서버 규칙이 목록 읽기에 로그인을
                // 요구하는 동안). 로그인하면 위 의존성으로 다시 구독된다 — 기록만 소음이 된다.
                const expected = e?.code === 'permission-denied' && !user;
                // 색인이 없으면 orderBy 가 실패할 수도 있다. 한쪽이 죽어도 다른 쪽으로 목록은 나온다.
                if (!expected) logError(`경기방 구독 #${idx}`, e);
                settled += 1;
                if (settled >= queries.length) { setError(e); setLoading(false); }
            },
        ));

        return () => unsubs.forEach(u => u());
        // user 객체 대신 uid 만 본다 — 같은 로그인의 토큰 갱신으로 재구독하지 않기 위해서다
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [authLoading, user?.uid]);

    const rooms = useMemo(() => Object.values(byId), [byId]);

    const getRoom = useCallback((id) => byId[id] || null, [byId]);

    const value = useMemo(() => ({ rooms, byId, loading, error, getRoom }), [rooms, byId, loading, error, getRoom]);

    return <RoomsContext.Provider value={value}>{children}</RoomsContext.Provider>;
}

export function useRooms() {
    const ctx = useContext(RoomsContext);
    if (!ctx) throw new Error('useRooms 는 RoomsProvider 안에서만 쓸 수 있습니다.');
    return ctx;
}
