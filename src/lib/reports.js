import {
    collection, addDoc, query, where, orderBy, limit, getDocs,
    doc, updateDoc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';

// ===================================================================================
// 신고 — 부적절한 방 이름·닉네임을 슈퍼 관리자 검토 대기열로
// -----------------------------------------------------------------------------------
// 지금까지 이상한 방을 봐도 사용자가 할 수 있는 일이 없었다. 이제 신고가 쌓이면
// 슈퍼 관리자가 '내 정보'에서 대기열을 보고 처리한다.
//
// 보안은 firestore.rules 가 맡는다:
//   · 만들기 — 로그인한 본인 이름으로만
//   · 읽기·처리 — 슈퍼 관리자만 (신고자가 서로의 신고를 볼 수 없다)
// ===================================================================================

export const REPORT_REASONS = [
    '부적절한 방 이름',
    '부적절한 닉네임',
    '스팸 · 도배',
    '기타',
];

/** 신고를 접수한다 */
export async function submitReport({ user, roomId, roomName, reason, detail }) {
    if (!user) throw new Error('로그인이 필요합니다.');
    await addDoc(collection(db, 'reports'), {
        reporterUid: user.uid,
        roomId: roomId || null,
        roomName: roomName || '',
        reason: reason || '기타',
        detail: (detail || '').slice(0, 500),
        status: 'open',
        createdAt: serverTimestamp(),
    });
}

/** 미처리 신고 목록 (슈퍼 관리자 전용 — 규칙이 다른 사람은 거부한다) */
export async function fetchOpenReports() {
    const q = query(
        collection(db, 'reports'),
        where('status', '==', 'open'),
        orderBy('createdAt', 'desc'),
        limit(50),
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/** 신고를 처리 완료로 표시한다 */
export async function resolveReport(reportId) {
    await updateDoc(doc(db, 'reports', reportId), {
        status: 'resolved',
        resolvedAt: serverTimestamp(),
    });
}
