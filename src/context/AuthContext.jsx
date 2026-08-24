import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, onSnapshot, updateDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { getDailyResetKey } from '../lib/time';
import { loadClaims, isSuperAdmin } from '../lib/superAdmin';
import {
    mergeFavorites, readLocalFavorites, writeLocalFavorites, toggleFavorite,
    mergeProductFavorites, readLocalProductFavorites, writeLocalProductFavorites, toggleProductFavorite,
} from '../lib/favorites';
import { logError } from '../lib/errorLog';

// ===================================================================================
// 로그인 상태 — 앱 전체가 한 곳에서 본다
// -----------------------------------------------------------------------------------
// 예전에는 App.jsx 안에 useState 로 있었고, 화면마다 props 로 내려보냈다.
// 파일을 나누면 그 props 가 4~5단계씩 내려가는 '프롭 터널'이 된다.
//
// 여기서 함께 처리하는 것들:
//   · 하루 초기화 — 방과 같은 운영일 키(새벽 2시)를 쓴다.
//     예전에는 사용자 문서만 UTC 자정 기준이라, 오전 9시에 개인 경기 수만
//     먼저 0이 되는 어긋남이 있었다.
//   · 슈퍼 관리자 클레임 — 로그인할 때 한 번 읽어둔다
//   · 찜한 경기방 — 서버 값과 기기 값을 합쳐서 본다
// ===================================================================================

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [userData, setUserData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [localFavs, setLocalFavs] = useState(() => readLocalFavorites());
    const [localProductFavs, setLocalProductFavs] = useState(() => readLocalProductFavorites());

    useEffect(() => {
        let unsubUserDoc = null;

        const unsubAuth = onAuthStateChanged(auth, async (currentUser) => {
            if (unsubUserDoc) { unsubUserDoc(); unsubUserDoc = null; }

            if (!currentUser) {
                setUser(null);
                setUserData(null);
                setLoading(false);
                await loadClaims(null);
                return;
            }

            setUser(currentUser);
            // 슈퍼 관리자 여부는 토큰 클레임에 들어 있다 — 화면을 그리기 전에 읽어둔다
            await loadClaims(currentUser);

            const userDocRef = doc(db, 'users', currentUser.uid);
            unsubUserDoc = onSnapshot(
                userDocRef,
                (snap) => {
                    if (!snap.exists()) { setUserData(null); setLoading(false); return; }
                    const data = snap.data();

                    // ── 하루 초기화 ──
                    // ★ 화면에는 '이미 초기화된 값'을 바로 넣는다.
                    //   예전에는 updateDoc 만 부르고 setUserData 를 건너뛰어서,
                    //   쓰기가 끝나 스냅샷이 다시 올 때까지 화면이 빈 상태였다.
                    const todayKey = getDailyResetKey();
                    if (data.lastResetDate !== todayKey) {
                        setUserData({ ...data, todayGames: 0, lastResetDate: todayKey });
                        updateDoc(userDocRef, { todayGames: 0, lastResetDate: todayKey })
                            .catch(e => logError('사용자 하루 초기화', e));
                    } else {
                        setUserData(data);
                    }
                    setLoading(false);
                },
                (e) => { logError('사용자 문서 구독', e); setLoading(false); },
            );
        });

        return () => { unsubAuth(); if (unsubUserDoc) unsubUserDoc(); };
    }, []);

    // ── 찜한 경기방 ──
    const favorites = useMemo(
        () => mergeFavorites(userData?.favoriteRooms, localFavs),
        [userData, localFavs],
    );

    const toggleRoomFavorite = useCallback(async (roomId) => {
        const next = toggleFavorite(favorites, roomId);
        // 기기에 먼저 쓴다 — 서버 쓰기가 느리거나 실패해도 화면은 즉시 반응한다
        setLocalFavs(next);
        writeLocalFavorites(next);
        if (!user) return next;
        try {
            await setDoc(doc(db, 'users', user.uid), { favoriteRooms: next }, { merge: true });
        } catch (e) {
            logError('찜 저장', e);
        }
        return next;
    }, [favorites, user]);

    // ── 찜한 상품 ──
    const favoriteProducts = useMemo(
        () => mergeProductFavorites(userData?.favoriteProducts, localProductFavs),
        [userData, localProductFavs],
    );

    const toggleProduct = useCallback(async (idx) => {
        const next = toggleProductFavorite(favoriteProducts, idx);
        setLocalProductFavs(next);
        writeLocalProductFavorites(next);
        if (!user) return next;
        try {
            await setDoc(doc(db, 'users', user.uid), { favoriteProducts: next }, { merge: true });
        } catch (e) {
            logError('상품 찜 저장', e);
        }
        return next;
    }, [favoriteProducts, user]);

    const value = useMemo(() => ({
        user,
        userData,
        loading,
        superAdmin: isSuperAdmin(user),
        favorites,
        toggleRoomFavorite,
        favoriteProducts,
        toggleProductFavorite: toggleProduct,
        logout: () => signOut(auth),
    }), [user, userData, loading, favorites, toggleRoomFavorite, favoriteProducts, toggleProduct]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth 는 AuthProvider 안에서만 쓸 수 있습니다.');
    return ctx;
}
