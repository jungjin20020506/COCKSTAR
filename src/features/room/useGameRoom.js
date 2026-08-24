import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    doc, collection, onSnapshot, runTransaction, writeBatch, updateDoc,
    deleteDoc, serverTimestamp, increment, getDoc,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { PLAYERS_PER_MATCH } from '../../constants';
import { getDailyResetKey } from '../../lib/time';
import { repairMatchQueues } from '../../lib/matchQueues';
import { isRoomAdmin, inviteMatches } from '../../lib/adminInvite';
import { findAutoRestTargets, findStalePlayers } from '../../lib/presence';
import { toast } from '../../lib/toast';
import { logError } from '../../lib/errorLog';

// ===================================================================================
// 경기방 상태와 동작 — 화면에서 로직을 떼어냈다
// -----------------------------------------------------------------------------------
// GameRoomView 는 1,200줄짜리 컴포넌트였고, 그 안에 Firestore 트랜잭션 열두 개와
// 화면 마크업이 뒤섞여 있었다. 매칭 규칙을 고치려면 JSX 사이를 헤집어야 했다.
//
// 여기에는 '무엇을 하는가'만 있고 '어떻게 보이는가'는 없다.
// 덕분에 이 파일은 화면 없이도 테스트할 수 있다.
// ===================================================================================

export function useGameRoom({ roomId, user, superAdmin }) {
    const [roomData, setRoomData] = useState(null);
    const [players, setPlayers] = useState({});
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);
    // 서버 규칙이 읽기를 거부한 경우 — '방이 없다'와 다르다.
    // 공유 링크를 받은 사람은 대부분 아직 로그인 전이라, 이걸 구분 못 하면
    // 멀쩡한 방이 "삭제되었어요"로 보인다.
    const [permissionDenied, setPermissionDenied] = useState(false);

    const roomRef = useMemo(() => doc(db, 'rooms', roomId), [roomId]);
    const playersRef = useMemo(() => collection(db, 'rooms', roomId, 'players'), [roomId]);

    const myUid = user?.uid ?? null;
    const isAdmin = useMemo(
        () => isRoomAdmin(roomData, user, superAdmin),
        [roomData, user, superAdmin],
    );

    // ── 구독 ──
    // ★ user?.uid 를 의존성에 넣는다. 구독은 시작하는 순간의 인증 토큰으로 붙어서,
    //   로그인 전에 열었다가 로그인해도 죽은 구독이 그대로 남는다.
    useEffect(() => {
        setNotFound(false);
        setPermissionDenied(false);
        const unsub = onSnapshot(
            roomRef,
            (snap) => {
                if (snap.exists()) { setRoomData({ id: snap.id, ...snap.data() }); setNotFound(false); }
                else setNotFound(true);
            },
            (e) => {
                if (e?.code === 'permission-denied') { setPermissionDenied(true); setLoading(false); return; }
                logError('경기방 구독', e);
                setNotFound(true);
            },
        );
        return () => unsub();
    }, [roomRef, user?.uid]);

    useEffect(() => {
        const unsub = onSnapshot(
            playersRef,
            (snap) => {
                const arr = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                arr.sort((a, b) => (a.entryTime?.seconds || 0) - (b.entryTime?.seconds || 0));
                setPlayers(arr.reduce((acc, p) => { acc[p.id] = p; return acc; }, {}));
                setLoading(false);
            },
            (e) => {
                if (e?.code !== 'permission-denied') logError('선수 목록 구독', e);
                setLoading(false);
            },
        );
        return () => unsub();
    }, [playersRef, user?.uid]);

    // ── 파생 값 ──
    const inProgressPlayerIds = useMemo(
        () => new Set((roomData?.inProgressCourts || []).flatMap(c => c?.players || []).filter(Boolean)),
        [roomData],
    );
    const scheduledPlayerIds = useMemo(
        () => new Set(Object.values(roomData?.scheduledMatches || {}).flatMap(m => m || []).filter(Boolean)),
        [roomData],
    );
    // 자동 매칭 목록에 올라간 사람도 '대기 중'이 아니다.
    // 여기서 안 빼면 같은 사람이 대기 명단에도 보여서 두 경기에 동시 배정된다.
    const autoMatchPlayerIds = useMemo(
        () => new Set(Object.values(roomData?.autoMatches || {}).flatMap(m => m || []).filter(Boolean)),
        [roomData],
    );

    const waitingPlayers = useMemo(
        () => Object.values(players).filter(p =>
            !inProgressPlayerIds.has(p.id) && !scheduledPlayerIds.has(p.id) && !autoMatchPlayerIds.has(p.id)),
        [players, inProgressPlayerIds, scheduledPlayerIds, autoMatchPlayerIds],
    );

    const courtIndexByPlayer = useMemo(() => {
        const map = {};
        (roomData?.inProgressCourts || []).forEach((court, idx) => {
            (court?.players || []).forEach(pid => { if (pid) map[pid] = idx; });
        });
        return map;
    }, [roomData]);

    const playerCount = Object.keys(players).length;

    // ===============================================================================
    // 인원 수 맞추기
    // -------------------------------------------------------------------------------
    // room.playerCount 는 로비 목록이 읽는 값이다 (로비는 선수 서브컬렉션을 구독하지
    // 않으므로 직접 셀 수 없다). 그런데 예전 코드는 방을 만들 때 0으로 써놓고 그 뒤로
    // 아무도 갱신하지 않았다 — 모든 방이 영원히 '0명'이었다.
    //
    // 이제 들어오고 나갈 때 증감하고, 관리자가 접속해 있을 때 실제 값과 다르면 맞춘다
    // (증감은 놓칠 수 있지만 이 보정이 결국 따라잡는다).
    // ===============================================================================
    useEffect(() => {
        if (!isAdmin || !roomData || loading) return;
        if (roomData.playerCount === playerCount) return;
        updateDoc(roomRef, { playerCount }).catch(e => logError('인원 수 보정', e));
    }, [isAdmin, roomData, playerCount, loading, roomRef]);

    // ===============================================================================
    // 하루 초기화 — 트랜잭션으로 '운영일 키'를 선점한 기기 하나만 실행한다
    // -------------------------------------------------------------------------------
    // 관리자가 두 명 이상 접속해 있으면 둘 다 실행해서 초기화가 겹칠 수 있었다.
    //
    // ⚠️ 남은 한계 — 기기 시계를 완전히 믿지는 못한다. 두 가지 방어를 뒀다.
    //    ① 키는 앞으로만 간다 (>= 이면 중단) — 시계가 틀린 기기가 어제 날짜로
    //       되돌려 초기화를 반복시키는 '핑퐁'을 막는다.
    //    ② 기기 시각이 마지막 초기화 서버 시각보다 과거면 시계가 틀린 것이므로 중단.
    // ===============================================================================
    const resetInFlightRef = useRef(false);

    useEffect(() => {
        if (!isAdmin || !roomData || loading || resetInFlightRef.current) return;
        const todayKey = getDailyResetKey();
        const storedKey = roomData.lastDailyResetKey || roomData.lastResetDate;
        if (storedKey && storedKey >= todayKey) return;

        const playersArray = Object.values(players);
        resetInFlightRef.current = true;

        (async () => {
            try {
                const won = await runTransaction(db, async (t) => {
                    const snap = await t.get(roomRef);
                    if (!snap.exists()) return false;
                    const data = snap.data();

                    const key = data.lastDailyResetKey || data.lastResetDate;
                    if (key && key >= todayKey) return false;   // 다른 기기가 이미 선점했다

                    const lastAt = data.lastDailyResetAt;
                    if (lastAt?.toDate && Date.now() < lastAt.toDate().getTime()) {
                        console.warn('기기 시계가 서버보다 과거입니다 — 하루 초기화를 건너뜁니다.');
                        return false;
                    }

                    t.update(roomRef, {
                        lastDailyResetKey: todayKey,
                        lastResetDate: todayKey,
                        lastDailyResetAt: serverTimestamp(),
                        inProgressCourts: Array(data.numInProgressCourts || 2).fill(null),
                        scheduledMatches: {},
                        autoMatches: {},
                    });
                    return true;
                });

                if (!won) return;

                // 이긴 기기만 선수 기록을 지운다. Firestore 배치 한계는 500이라 400씩 끊는다.
                //
                // ⚠️ 배치 하나가 실패해도 나머지는 계속해야 한다. batch.update 는 대상 문서가
                //   없으면 배치 전체를 실패시키는데, 스냅샷을 찍은 직후 누가 나가면 실제로
                //   그 일이 일어난다. 운영일 키는 이미 선점한 뒤라 여기서 통째로 멈추면
                //   '방은 비었는데 선수 기록은 어제 그대로'가 되고 오늘은 다시 초기화되지 않는다.
                for (let i = 0; i < playersArray.length; i += 400) {
                    const batch = writeBatch(db);
                    playersArray.slice(i, i + 400).forEach(p => {
                        batch.update(doc(playersRef, p.id), {
                            todayGames: 0, matchHistory: [], todayRecentGames: [], isResting: false,
                        });
                    });
                    try { await batch.commit(); }
                    catch (e) { logError(`하루 초기화 배치(${i})`, e); }
                }
            } catch (e) {
                logError('하루 초기화', e);
            } finally {
                resetInFlightRef.current = false;
            }
        })();
    }, [isAdmin, roomData, players, loading, roomRef, playersRef]);

    // ===============================================================================
    // 시작할 수 없게 된 예약 경기 자동 정리
    // -------------------------------------------------------------------------------
    // 예약해 둔 경기의 선수가 나가거나 휴식으로 바뀌면 그 경기는 영원히 시작할 수 없다.
    // 그런데 그 사람들은 여전히 '다음 경기가 잡힌 사람'으로 분류돼 새 매칭 후보에서도
    // 빠지기 때문에, 두면 매칭이 통째로 멈춘다.
    //
    // ⚠️ 관리자가 한 명도 접속해 있지 않으면 정리되지 않는다.
    //    관리자만 방 문서를 쓸 수 있게 하려는 의도이므로 그대로 뒀다.
    // ===============================================================================
    const repairingRef = useRef(false);

    useEffect(() => {
        if (!isAdmin || !roomData || repairingRef.current) return;
        // 선수 스냅샷이 아직 안 온 상태에서 돌리면 '전원 나간 것'으로 오인해 목록을 전부 지운다
        if (Object.keys(players).length === 0) return;

        const queueOf = (src) => ({
            autoMatches: src.autoMatches || {},
            scheduledMatches: src.scheduledMatches || {},
        });
        if (!repairMatchQueues(queueOf(roomData), players).changed) return;

        repairingRef.current = true;
        runTransaction(db, async (t) => {
            const snap = await t.get(roomRef);
            if (!snap.exists()) return;
            const { changed, newState } = repairMatchQueues(queueOf(snap.data()), players);
            if (!changed) return;
            t.update(roomRef, {
                autoMatches: newState.autoMatches,
                scheduledMatches: newState.scheduledMatches,
            });
        })
            .catch(e => logError('예약 경기 자동 정리', e))
            .finally(() => { repairingRef.current = false; });
    }, [isAdmin, roomData, players, roomRef]);

    // ===============================================================================
    // 자리 비움 자동 처리
    // -------------------------------------------------------------------------------
    // 45분 넘게 앱을 안 연 사람을 '휴식'으로 바꾼다. 명단에서 지우지는 않는다 —
    // 화면이 꺼져 있거나 지하에서 신호가 끊긴 것뿐일 수 있고, 지웠다가 돌아오면
    // 오늘 기록이 사라져 있다. 실제로 내보내는 건 관리자가 눌러 확인한다.
    // ===============================================================================
    const staleList = useMemo(
        () => findStalePlayers(players, { exclude: inProgressPlayerIds }),
        [players, inProgressPlayerIds],
    );

    useEffect(() => {
        if (!isAdmin) return;
        const targets = findAutoRestTargets(players, { exclude: inProgressPlayerIds });
        if (targets.length === 0) return;
        const batch = writeBatch(db);
        targets.forEach(p => batch.update(doc(playersRef, p.id), { isResting: true }));
        batch.commit().catch(e => logError('자리 비움 자동 휴식', e));
    }, [isAdmin, players, inProgressPlayerIds, playersRef]);

    // ===============================================================================
    // 동작들
    // ===============================================================================

    /** 방에 참가한다 (선수 문서 생성 + 인원 수 증가) */
    const join = useCallback(async (userData) => {
        if (!user || !userData) return;
        const playerRef = doc(playersRef, user.uid);
        await runTransaction(db, async (t) => {
            const snap = await t.get(playerRef);
            if (snap.exists()) {
                t.update(playerRef, {
                    name: userData.name, level: userData.level, lastSeen: serverTimestamp(),
                });
                return;
            }
            t.set(playerRef, {
                name: userData.name || '선수',
                level: userData.level || 'N조',
                gender: userData.gender || '남',
                birthYear: userData.birthYear || '',
                region: userData.region || '미설정',
                entryTime: serverTimestamp(),
                lastSeen: serverTimestamp(),
                todayGames: 0,
                isResting: false,
                role: 'player',
                matchHistory: [],
                todayRecentGames: [],
            });
            t.update(roomRef, { playerCount: increment(1) });
        });
    }, [user, playersRef, roomRef]);

    /** 방에서 나간다 (예약된 경기에서 먼저 빼고 선수 문서 삭제) */
    const leave = useCallback(async () => {
        if (!user) return;
        if (inProgressPlayerIds.has(user.uid)) {
            toast.error('경기 중에는 나갈 수 없어요. 경기가 끝난 뒤에 눌러주세요.');
            return;
        }
        try {
            await runTransaction(db, async (t) => {
                const snap = await t.get(roomRef);
                if (!snap.exists()) return;
                const data = snap.data();
                const rest = { ...players };
                delete rest[user.uid];
                const { changed, newState } = repairMatchQueues(
                    { autoMatches: data.autoMatches || {}, scheduledMatches: data.scheduledMatches || {} },
                    rest,
                );
                t.update(roomRef, {
                    playerCount: increment(-1),
                    ...(changed ? { autoMatches: newState.autoMatches, scheduledMatches: newState.scheduledMatches } : {}),
                });
            });
            await deleteDoc(doc(playersRef, user.uid));
        } catch (e) {
            logError('방 나가기', e);
            toast.error('나가기에 실패했습니다.');
        }
    }, [user, players, inProgressPlayerIds, roomRef, playersRef]);

    /** 휴식 켜고 끄기 */
    const toggleRest = useCallback(async () => {
        if (!user || !players[user.uid]) return;
        const goingToRest = !players[user.uid].isResting;
        try {
            await updateDoc(doc(playersRef, user.uid), { isResting: goingToRest, lastSeen: serverTimestamp() });
            if (!goingToRest) return;

            // 휴식을 켤 때는 잡혀 있던 다음 경기에서 먼저 빼낸다. 안 빼면 그 경기는 영원히
            // 시작 못 하는 상태로 남고, 본인은 계속 '다음 경기가 잡힌 사람'으로 분류되어
            // 새 매칭 후보에서도 빠진다. (관리자 화면의 자동 정리가 결국 치워주지만,
            // 관리자가 없을 수도 있으므로 본인이 누른 이 순간에 정리하는 게 확실하다)
            //
            // 지금 코트에서 뛰는 중이라면 코트에서는 빼지 않는다 — 관리자가 경기 종료를
            // 눌러 기록을 남길 수 있어야 하기 때문이다.
            await runTransaction(db, async (t) => {
                const snap = await t.get(roomRef);
                if (!snap.exists()) return;
                const data = snap.data();
                const { changed, newState } = repairMatchQueues(
                    { autoMatches: data.autoMatches || {}, scheduledMatches: data.scheduledMatches || {} },
                    { ...players, [user.uid]: { ...players[user.uid], isResting: true } },
                );
                if (!changed) return;
                t.update(roomRef, {
                    autoMatches: newState.autoMatches,
                    scheduledMatches: newState.scheduledMatches,
                });
            });
        } catch (e) {
            logError('휴식 상태 변경', e);
            toast.error('상태 변경에 실패했습니다.');
        }
    }, [user, players, playersRef, roomRef]);

    /** 선수를 예약 슬롯으로 옮기거나 서로 자리를 바꾼다 */
    const swapPlayers = useCallback(async (sourceIds, targetPlayerId, targetMatchIndex, targetSlotIndex) => {
        try {
            await runTransaction(db, async (t) => {
                const rd = await t.get(roomRef);
                if (!rd.exists()) throw new Error('방이 존재하지 않습니다.');
                const schedule = { ...rd.data().scheduledMatches };

                if (targetPlayerId) {
                    const cur = schedule[targetMatchIndex]?.[targetSlotIndex];
                    if (cur !== targetPlayerId) {
                        throw new Error('대상이 이미 다른 곳으로 이동했습니다. 다시 시도해주세요.');
                    }
                }

                sourceIds.forEach(srcId => {
                    Object.keys(schedule).forEach(mKey => {
                        const match = schedule[mKey] || [];
                        const idx = match.indexOf(srcId);
                        if (idx > -1) { const next = [...match]; next[idx] = null; schedule[mKey] = next; }
                    });
                });

                let mIdx = targetMatchIndex;
                let sIdx = targetSlotIndex;
                if (targetPlayerId) {
                    Object.keys(schedule).forEach(mKey => {
                        const idx = (schedule[mKey] || []).indexOf(targetPlayerId);
                        if (idx > -1) { mIdx = parseInt(mKey, 10); sIdx = idx; }
                    });
                }

                if (mIdx !== undefined && sIdx !== undefined) {
                    if (!schedule[mIdx]) schedule[mIdx] = Array(PLAYERS_PER_MATCH).fill(null);
                    if (!targetPlayerId && schedule[mIdx][sIdx] !== null) {
                        throw new Error('이미 다른 관리자가 그 자리에 선수를 배치했습니다.');
                    }
                    schedule[mIdx][sIdx] = sourceIds[0];
                }
                t.update(roomRef, { scheduledMatches: schedule });
            });
        } catch (e) {
            logError('선수 이동', e);
            toast.error(e.message || '작업 중 오류가 발생했습니다.');
            throw e;
        }
    }, [roomRef]);

    /** 빈 슬롯에 선택한 선수들을 채운다 */
    const fillSlot = useCallback(async (matchIndex, slotIndex, selectedIds) => {
        if (selectedIds.length === 0) return;
        try {
            await runTransaction(db, async (t) => {
                const rd = await t.get(roomRef);
                if (!rd.exists()) throw new Error('방 정보가 없습니다.');
                const schedule = { ...rd.data().scheduledMatches };
                if (!schedule[matchIndex]) schedule[matchIndex] = Array(PLAYERS_PER_MATCH).fill(null);
                if (schedule[matchIndex][slotIndex] !== null) {
                    throw new Error('방금 다른 관리자가 이 자리에 선수를 배치했습니다.');
                }
                selectedIds.forEach(srcId => {
                    Object.keys(schedule).forEach(mKey => {
                        const match = schedule[mKey] || [];
                        const idx = match.indexOf(srcId);
                        if (idx > -1) { const next = [...match]; next[idx] = null; schedule[mKey] = next; }
                    });
                });
                let cur = slotIndex;
                selectedIds.forEach(srcId => {
                    while (cur < PLAYERS_PER_MATCH && schedule[matchIndex][cur] !== null) cur += 1;
                    if (cur < PLAYERS_PER_MATCH) { schedule[matchIndex][cur] = srcId; cur += 1; }
                });
                t.update(roomRef, { scheduledMatches: schedule });
            });
        } catch (e) {
            logError('선수 배치', e);
            toast.error(e.message || '동시 작업 충돌이 발생했습니다.');
            throw e;
        }
    }, [roomRef]);

    const removeFromSchedule = useCallback(async (matchIndex, slotIndex) => {
        try {
            await runTransaction(db, async (t) => {
                const rd = await t.get(roomRef);
                if (!rd.exists()) return;
                const schedule = { ...rd.data().scheduledMatches };
                if (!schedule[matchIndex]) return;
                const next = [...schedule[matchIndex]];
                if (next[slotIndex] === null) return;
                next[slotIndex] = null;
                schedule[matchIndex] = next;
                t.update(roomRef, { scheduledMatches: schedule });
            });
        } catch (e) { logError('예약에서 선수 빼기', e); }
    }, [roomRef]);

    /**
     * 경기를 코트로 보낸다.
     *
     * 시작 후 목록 정리 방식이 대기열마다 다르다.
     *  · 경기 배정(수동) : 뒤 경기를 앞으로 당긴다
     *  · 자동 매칭      : 지우고 "0","1",… 로 조밀하게 다시 번호를 매긴다
     */
    const startMatch = useCallback(async (matchIdx, courtIdx, source = 'schedule') => {
        try {
            await runTransaction(db, async (t) => {
                const rd = await t.get(roomRef);
                if (!rd.exists()) throw new Error('방이 존재하지 않습니다.');
                const data = rd.data();
                const isAuto = source === 'auto';
                const queue = { ...(isAuto ? data.autoMatches : data.scheduledMatches) };
                const matchPlayers = queue[matchIdx];
                const courts = [...(data.inProgressCourts || [])];

                if (courts[courtIdx]) throw new Error('이미 다른 관리자가 그 코트에서 경기를 시작했습니다.');
                if (!matchPlayers || matchPlayers.filter(Boolean).length < PLAYERS_PER_MATCH) {
                    throw new Error('경기 인원이 변경되었거나 이미 시작된 경기입니다.');
                }

                // [이중 시작 방지] 모달을 보는 사이 상황이 바뀔 수 있으므로 트랜잭션 안에서 다시 확인한다.
                // 이 검사가 없으면 한 사람이 두 코트에서 동시에 뛰는 상태가 만들어진다.
                const onCourtNow = new Set(courts.flatMap(c => c?.players || []).filter(Boolean));
                if (matchPlayers.some(pid => pid && onCourtNow.has(pid))) {
                    throw new Error('선택한 선수가 이미 다른 코트에서 경기 중입니다.');
                }

                courts[courtIdx] = { players: matchPlayers, startTime: new Date().toISOString() };

                const remaining = Object.entries(queue)
                    .filter(([key]) => String(key) !== String(matchIdx))
                    .sort((a, b) => Number(a[0]) - Number(b[0]))
                    .map(([, v]) => v);
                const reordered = {};
                remaining.forEach((v, i) => { reordered[i] = v; });

                t.update(roomRef, {
                    [isAuto ? 'autoMatches' : 'scheduledMatches']: reordered,
                    inProgressCourts: courts,
                    // 로비의 '최근 운영순'이 보는 값 — 경기가 돌아갔다는 뜻이다
                    lastActiveAt: serverTimestamp(),
                });
            });
        } catch (e) {
            logError('경기 시작', e);
            toast.error(e.message || '작업 충돌이 발생했습니다.');
            throw e;
        }
    }, [roomRef]);

    /**
     * 경기를 끝낸다.
     *
     * ★ 반드시 트랜잭션으로, 그리고 '멱등'하게.
     *   예전에는 화면에 보이는 코트 정보로 batch 를 만들었다. 그러면 관리자 둘이 거의
     *   동시에 종료를 누를 때 둘 다 커밋해서 4명 모두 경기 수가 2씩 오르고 같은 기록이
     *   두 줄 쌓였다. (다음 날 "나 3경기밖에 안 쳤는데 6경기래요"가 되어야 발견되는
     *   종류의 데이터 손상이다)
     *   이제 트랜잭션 안에서 코트를 다시 읽고, 이미 비어 있으면 조용히 끝낸다.
     *
     * @returns {Promise<object|null>} 되돌리기에 쓸 스냅샷
     */
    const endMatch = useCallback(async (courtIdx) => {
        try {
            return await runTransaction(db, async (t) => {
                const roomSnap = await t.get(roomRef);
                if (!roomSnap.exists()) return null;
                const data = roomSnap.data();
                const courts = [...(data.inProgressCourts || [])];
                const court = courts[courtIdx];
                if (!court || !Array.isArray(court.players)) return null;   // 이미 다른 관리자가 종료했다

                // 읽기는 쓰기보다 먼저 전부 끝내야 한다 (Firestore 트랜잭션 규칙)
                const ids = court.players.filter(Boolean);
                const snaps = await Promise.all(ids.map(pid => t.get(doc(playersRef, pid))));
                const before = {};
                snaps.forEach((snap, i) => { if (snap.exists()) before[ids[i]] = snap.data(); });

                const membersString = court.players.map(pid => {
                    const p = before[pid];
                    if (!p) return '퇴장한 선수';
                    const mark = (p.level && p.level !== '미설정') ? p.level[0] : '';
                    return `${mark}${p.isBot ? `[Bot]${p.name}` : p.name}`;
                }).join(', ');

                // ★ timestamp 를 4명 모두에게 '똑같이' 넣는 게 핵심이다.
                //   서로 다른 timestamp 의 개수가 곧 '오늘 총 몇 경기'가 되고,
                //   같은 경기를 두 번 세지 않는 기준도 이 값이다.
                const timestamp = new Date().toISOString();
                const teamA = [court.players[0], court.players[1]].filter(Boolean);
                const teamB = [court.players[2], court.players[3]].filter(Boolean);

                ids.forEach(pid => {
                    const p = before[pid];
                    if (!p) return;   // 경기 중에 방을 나간 사람 — 기록할 문서가 없다
                    const inA = teamA.includes(pid);
                    const structured = {
                        timestamp,
                        partners: (inA ? teamA : teamB).filter(x => x !== pid),
                        opponents: inA ? teamB : teamA,
                    };
                    t.update(doc(playersRef, pid), {
                        todayGames: (p.todayGames || 0) + 1,
                        matchHistory: [membersString, ...(Array.isArray(p.matchHistory) ? p.matchHistory : [])].slice(0, 10),
                        // 최신이 앞. 20개까지만 — 엔진이 보는 건 최근 몇 경기뿐이다
                        todayRecentGames: [structured, ...(Array.isArray(p.todayRecentGames) ? p.todayRecentGames : [])].slice(0, 20),
                    });
                });

                courts[courtIdx] = null;
                t.update(roomRef, { inProgressCourts: courts, lastActiveAt: serverTimestamp() });

                // 되돌리기에 쓸 정보 — 코트 원본과 각 선수의 '이전' 값
                return { courtIdx, court, before };
            });
        } catch (e) {
            logError('경기 종료', e);
            toast.error('경기 종료 중 오류가 발생했습니다.');
            return null;
        }
    }, [roomRef, playersRef]);

    /**
     * 방금 끝낸 경기를 되돌린다.
     *
     * 경기 종료는 되돌릴 수 없는 동작이면서 오조작이 잦은 동작이다(코트가 여러 개면
     * 옆 코트를 누르기 쉽다). 예전에는 관리자가 4명의 경기 수를 하나씩 손으로 내리고
     * 기록도 지워야 했다.
     */
    const undoEndMatch = useCallback(async (snapshot) => {
        if (!snapshot) return;
        const { courtIdx, court, before } = snapshot;
        try {
            await runTransaction(db, async (t) => {
                const roomSnap = await t.get(roomRef);
                if (!roomSnap.exists()) return;
                const courts = [...(roomSnap.data().inProgressCourts || [])];
                if (courts[courtIdx]) throw new Error('그 코트에서 이미 다음 경기가 시작됐어요.');
                courts[courtIdx] = court;

                Object.entries(before).forEach(([pid, prev]) => {
                    t.update(doc(playersRef, pid), {
                        todayGames: prev.todayGames || 0,
                        matchHistory: prev.matchHistory || [],
                        todayRecentGames: prev.todayRecentGames || [],
                    });
                });
                t.update(roomRef, { inProgressCourts: courts });
            });
            toast('경기 종료를 되돌렸습니다.');
        } catch (e) {
            logError('경기 종료 되돌리기', e);
            toast.error(e.message || '되돌리지 못했습니다.');
        }
    }, [roomRef, playersRef]);

    /** 경기 수를 손으로 고친다 */
    const saveGames = useCallback(async (playerId, newCount) => {
        try {
            const player = players[playerId];
            const count = Math.max(0, Math.floor(newCount || 0));

            // 구조체 기록도 함께 맞춘다. 안 맞추면 카드에는 5G인데 엔진은 3경기로 계산해서
            // 그 사람이 계속 '덜 친 사람'으로 우선 배정된다.
            //
            // 늘릴 때는 isManual 표시가 붙은 빈 기록을 넣는다 — 엔진은 이걸 경기 수에는
            // 세지만 '누구와 만났나'에는 넣지 않는다. 없는 만남을 지어내지 않으려는 것이다.
            // 줄일 때는 최신 기록부터 뺀다 (방금 잘못 누른 걸 되돌리는 경우가 대부분이므로).
            const history = Array.isArray(player?.todayRecentGames) ? [...player.todayRecentGames] : [];
            const diff = count - history.length;
            let next = history;
            if (diff > 0) {
                const stamp = new Date().toISOString();
                next = [
                    ...Array.from({ length: diff }, () => ({ timestamp: stamp, partners: [], opponents: [], isManual: true })),
                    ...history,
                ].slice(0, 20);
            } else if (diff < 0) {
                next = history.slice(-diff);
            }

            await updateDoc(doc(playersRef, playerId), { todayGames: count, todayRecentGames: next });
            toast('경기 수가 저장되었습니다.');
        } catch (e) {
            logError('경기 수 수정', e);
            toast.error('수정에 실패했습니다.');
        }
    }, [players, playersRef]);

    const kickPlayer = useCallback(async (playerId) => {
        try {
            await deleteDoc(doc(playersRef, playerId));
            await updateDoc(roomRef, { playerCount: increment(-1) });
        } catch (e) {
            logError('선수 내보내기', e);
            toast.error('내보내기에 실패했습니다.');
        }
    }, [playersRef, roomRef]);

    /** 자리 비운 사람들을 한 번에 내보낸다 */
    const cleanStale = useCallback(async () => {
        if (staleList.length === 0) return;
        try {
            const batch = writeBatch(db);
            staleList.forEach(p => batch.delete(doc(playersRef, p.id)));
            await batch.commit();
            await updateDoc(roomRef, { playerCount: increment(-staleList.length) });
            toast(`자리 비운 ${staleList.length}명을 내보냈습니다.`);
        } catch (e) {
            logError('자리 비움 정리', e);
            toast.error('정리에 실패했습니다.');
        }
    }, [staleList, playersRef, roomRef]);

    // ── 관리자 ──

    const appointAdmin = useCallback(async (player) => {
        await runTransaction(db, async (t) => {
            const snap = await t.get(roomRef);
            if (!snap.exists()) throw new Error('방이 존재하지 않습니다.');
            const data = snap.data();
            const uids = new Set(data.adminUids || []);
            uids.add(player.id);
            t.update(roomRef, {
                adminUids: [...uids],
                adminNames: { ...(data.adminNames || {}), [player.id]: player.name || '' },
            });
        });
        await updateDoc(doc(playersRef, player.id), { role: 'admin' }).catch(() => {});
    }, [roomRef, playersRef]);

    const removeAdmin = useCallback(async (uid) => {
        await runTransaction(db, async (t) => {
            const snap = await t.get(roomRef);
            if (!snap.exists()) return;
            const data = snap.data();
            if (data.adminUid === uid) throw new Error('방장은 해제할 수 없습니다.');
            const names = { ...(data.adminNames || {}) };
            delete names[uid];
            t.update(roomRef, {
                adminUids: (data.adminUids || []).filter(id => id !== uid),
                // 구버전 문자열 목록에도 남아 있을 수 있다 — 같이 지운다
                admins: (data.admins || []).filter(a => a !== uid),
                adminNames: names,
            });
        });
        await updateDoc(doc(playersRef, uid), { role: 'player' }).catch(() => {});
    }, [roomRef, playersRef]);

    const createInviteCode = useCallback(
        (invite) => updateDoc(roomRef, { adminInvite: invite }),
        [roomRef],
    );
    const revokeInvite = useCallback(
        () => updateDoc(roomRef, { adminInvite: null }),
        [roomRef],
    );

    /**
     * 초대 코드를 써서 스스로 관리자가 된다.
     *
     * ★ 코드 확인을 트랜잭션 '안에서' 한 번 더 한다. 화면에 있는 roomData 로 확인하면
     *   그 사이에 방장이 코드를 만료시켰어도 통과해버린다.
     */
    const redeemInvite = useCallback(async (code) => {
        if (!user) return false;
        try {
            const ok = await runTransaction(db, async (t) => {
                const snap = await t.get(roomRef);
                if (!snap.exists()) return false;
                const data = snap.data();
                if (!inviteMatches(data.adminInvite, code)) return false;
                const uids = new Set(data.adminUids || []);
                if (uids.has(user.uid)) return true;
                uids.add(user.uid);
                t.update(roomRef, {
                    adminUids: [...uids],
                    adminNames: {
                        ...(data.adminNames || {}),
                        [user.uid]: players[user.uid]?.name || user.displayName || '',
                    },
                });
                return true;
            });
            return ok;
        } catch (e) {
            logError('초대 코드 사용', e);
            return false;
        }
    }, [user, players, roomRef]);

    // ── 방 설정 ──

    const saveSettings = useCallback(async (next) => {
        try {
            let courts = [...(roomData?.inProgressCourts || [])];
            if (next.numInProgressCourts > courts.length) {
                while (courts.length < next.numInProgressCourts) courts.push(null);
            } else {
                courts = courts.slice(0, next.numInProgressCourts);
            }
            const patch = {
                mode: next.mode,
                numScheduledMatches: next.numScheduledMatches,
                numInProgressCourts: next.numInProgressCourts,
                courtTimeLimit: next.courtTimeLimit,
                inProgressCourts: courts,
                autoMatchConfig: next.autoMatchConfig,
            };
            // 비밀번호는 같은 창에서 따로 저장할 수 있다 — 넘어온 경우에만 반영한다
            if (next.passwordHash !== undefined) {
                patch.passwordHash = next.passwordHash;
                patch.passwordSalt = next.passwordSalt || '';
                patch.password = '';   // 평문 잔재를 지운다
            }
            await updateDoc(roomRef, patch);
            toast('설정이 저장되었습니다.');
        } catch (e) {
            logError('설정 저장', e);
            toast.error('설정을 저장하지 못했습니다.');
        }
    }, [roomData, roomRef]);

    const saveRoomInfo = useCallback(async (updated) => {
        try {
            await updateDoc(roomRef, {
                name: updated.name,
                location: updated.location,
                address: updated.address,
                coords: updated.coords,
                description: updated.description,
                levelLimit: updated.levelLimit,
                maxPlayers: updated.maxPlayers,
            });
            toast('방 정보가 수정되었습니다.');
        } catch (e) {
            logError('방 정보 수정', e);
            toast.error('수정에 실패했습니다.');
        }
    }, [roomRef]);

    const resetSystem = useCallback(async () => {
        try {
            await updateDoc(roomRef, {
                scheduledMatches: {},
                autoMatches: {},
                inProgressCourts: Array(roomData?.numInProgressCourts || 2).fill(null),
            });
            toast('경기 기록이 초기화되었습니다.');
        } catch (e) {
            logError('시스템 초기화', e);
            toast.error('초기화에 실패했습니다.');
        }
    }, [roomData, roomRef]);

    const kickAll = useCallback(async () => {
        try {
            const batch = writeBatch(db);
            Object.keys(players).forEach(pid => batch.delete(doc(playersRef, pid)));
            await batch.commit();
            await updateDoc(roomRef, {
                inProgressCourts: Array(roomData?.numInProgressCourts || 2).fill(null),
                scheduledMatches: {},
                autoMatches: {},
                playerCount: 0,
            });
            toast('모든 선수를 내보냈습니다.');
        } catch (e) {
            logError('전원 내보내기', e);
            toast.error('실패했습니다.');
        }
    }, [players, playersRef, roomData, roomRef]);

    const deleteRoom = useCallback(async () => {
        await deleteDoc(roomRef);
    }, [roomRef]);

    // ── 자동 매칭 목록 ──

    const addAutoMatch = useCallback(async (option) => {
        let failReason = null;
        try {
            await runTransaction(db, async (t) => {
                // ★ 재시도마다 초기화해야 한다. Firestore 트랜잭션은 경합이 나면 이 함수를
                //   처음부터 다시 돌린다. 첫 시도에서 "이미 예약됨"으로 표시해 뒀는데 두 번째
                //   시도에서 성공하면, 실제로는 추가됐으면서 화면에는 실패 안내가 뜬다.
                failReason = null;
                const snap = await t.get(roomRef);
                if (!snap.exists()) throw new Error('방이 존재하지 않습니다.');
                const data = snap.data();
                const autoMatches = { ...(data.autoMatches || {}) };

                const queuedIds = new Set([
                    ...Object.values(autoMatches).flat(),
                    ...Object.values(data.scheduledMatches || {}).flat(),
                ].filter(Boolean));
                if (option.ids.some(id => queuedIds.has(id))) {
                    failReason = '방금 다른 관리자가 같은 선수를 다른 경기에 넣었습니다.';
                    return;
                }
                const gone = option.ids.map(id => players[id]).find(p => !p || p.isResting);
                if (gone !== undefined) {
                    failReason = `${gone?.name || '일부'} 선수가 방금 빠졌습니다.`;
                    return;
                }

                // 새 경기 번호는 '개수'가 아니라 '최대 번호 + 1'로 정한다. 삭제 후 재인덱싱이
                // 실패해 {0, 2} 처럼 구멍 난 상태가 되어도 기존 경기를 덮어쓰지 않는다.
                const nextIdx = Object.keys(autoMatches).reduce((m, k) => Math.max(m, Number(k) + 1), 0);
                autoMatches[String(nextIdx)] = [...option.ids];
                t.update(roomRef, { autoMatches });
            });
        } catch (e) {
            logError('자동 매칭 추가', e);
            failReason = e.message || '목록에 추가하지 못했습니다.';
        }
        return failReason;
    }, [players, roomRef]);

    const deleteAutoMatch = useCallback(async (matchIndex) => {
        try {
            await runTransaction(db, async (t) => {
                const snap = await t.get(roomRef);
                if (!snap.exists()) return;
                const remaining = Object.entries(snap.data().autoMatches || {})
                    .filter(([key]) => String(key) !== String(matchIndex))
                    .sort((a, b) => Number(a[0]) - Number(b[0]))
                    .map(([, v]) => v);
                const reindexed = {};
                remaining.forEach((m, i) => { reindexed[i] = m; });
                t.update(roomRef, { autoMatches: reindexed });
            });
        } catch (e) {
            logError('자동 매칭 삭제', e);
            toast.error('삭제에 실패했습니다.');
        }
    }, [roomRef]);

    const clearAutoMatches = useCallback(async () => {
        try { await updateDoc(roomRef, { autoMatches: {} }); }
        catch (e) { logError('자동 매칭 전체 삭제', e); toast.error('삭제에 실패했습니다.'); }
    }, [roomRef]);

    const createBots = useCallback(async (count, gender) => {
        try {
            const batch = writeBatch(db);
            for (let i = 0; i < count; i += 1) {
                const botId = `bot_${Date.now()}_${Math.floor(Math.random() * 1000)}_${i}`;
                const level = ['A조', 'B조', 'C조', 'D조'][Math.floor(Math.random() * 4)];
                batch.set(doc(playersRef, botId), {
                    name: `Bot ${Math.floor(Math.random() * 1000)}`,
                    level, gender, isBot: true,
                    entryTime: serverTimestamp(), lastSeen: serverTimestamp(),
                    todayGames: 0, isResting: false, matchHistory: [], todayRecentGames: [],
                });
            }
            await batch.commit();
        } catch (e) { logError('봇 생성', e); toast.error('봇 생성에 실패했습니다.'); }
    }, [playersRef]);

    /** 비밀번호 확인용으로 방 문서를 한 번 읽는다 (구독 값이 아직 없을 때) */
    const fetchRoomOnce = useCallback(async () => {
        const snap = await getDoc(roomRef);
        return snap.exists() ? { id: snap.id, ...snap.data() } : null;
    }, [roomRef]);

    return {
        roomData, players, loading, notFound, permissionDenied, isAdmin, myUid, playerCount,
        inProgressPlayerIds, scheduledPlayerIds, autoMatchPlayerIds,
        waitingPlayers, courtIndexByPlayer, staleList,
        roomRef, playersRef,
        // 동작
        join, leave, toggleRest, swapPlayers, fillSlot, removeFromSchedule,
        startMatch, endMatch, undoEndMatch, saveGames, kickPlayer, cleanStale,
        appointAdmin, removeAdmin, createInviteCode, revokeInvite, redeemInvite,
        saveSettings, saveRoomInfo, resetSystem, kickAll, deleteRoom,
        addAutoMatch, deleteAutoMatch, clearAutoMatches, createBots, fetchRoomOnce,
    };
}
