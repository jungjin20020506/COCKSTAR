import React, { useEffect, useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import { ShieldAlert, CheckCircle } from '../../components/ui/icons';
import { REPORT_REASONS, submitReport, fetchOpenReports, resolveReport } from '../../lib/reports';
import { FIELD_CLS } from '../../constants';
import { toast } from '../../lib/toast';
import { logError } from '../../lib/errorLog';

// ===================================================================================
// 신고 창 (사용자용) + 신고 검토 대기열 (슈퍼 관리자용)
// ===================================================================================

export function ReportModal({ isOpen, onClose, user, roomId, roomName }) {
    const [reason, setReason] = useState(REPORT_REASONS[0]);
    const [detail, setDetail] = useState('');
    const [sending, setSending] = useState(false);

    useEffect(() => {
        if (isOpen) { setReason(REPORT_REASONS[0]); setDetail(''); }
    }, [isOpen]);

    const handleSubmit = async () => {
        if (sending) return;
        setSending(true);
        try {
            await submitReport({ user, roomId, roomName, reason, detail });
            toast('신고가 접수되었습니다. 검토 후 조치할게요.');
            onClose();
        } catch (e) {
            logError('신고 접수', e);
            toast.error('접수에 실패했습니다. 잠시 후 다시 시도해주세요.');
        } finally { setSending(false); }
    };

    return (
        <Modal
            open={isOpen}
            onClose={onClose}
            title="신고하기"
            subtitle={roomName ? `대상: ${roomName}` : undefined}
            size="max-w-sm"
            footer={(
                <button
                    onClick={handleSubmit}
                    disabled={sending}
                    className="w-full py-3.5 bg-coral text-ink font-black rounded-full text-sm disabled:opacity-50"
                >
                    {sending ? '접수 중...' : '신고 접수'}
                </button>
            )}
        >
            <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                    {REPORT_REASONS.map(r => (
                        <button
                            key={r}
                            onClick={() => setReason(r)}
                            aria-pressed={reason === r}
                            className={`px-3.5 py-2 rounded-full text-[12px] font-black transition-all ${
                                reason === r ? 'bg-coral text-ink' : 'bg-white/5 text-dim border border-white/10'
                            }`}
                        >
                            {r}
                        </button>
                    ))}
                </div>
                <textarea
                    rows={3}
                    value={detail}
                    onChange={(e) => setDetail(e.target.value)}
                    placeholder="어떤 점이 문제였는지 적어주시면 검토가 빨라져요 (선택)"
                    className={`${FIELD_CLS} resize-none text-sm`}
                />
                <p className="text-[11px] text-muted font-medium break-keep">
                    신고 내용은 관리자만 볼 수 있어요. 허위 신고가 반복되면 이용이 제한될 수 있습니다.
                </p>
            </div>
        </Modal>
    );
}

/** 슈퍼 관리자 전용 — 신고 검토 대기열 */
export function ReportQueueModal({ isOpen, onClose }) {
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        setLoading(true);
        fetchOpenReports()
            .then(setReports)
            .catch(e => { logError('신고 목록', e); toast.error('신고 목록을 불러오지 못했습니다.'); })
            .finally(() => setLoading(false));
    }, [isOpen]);

    const handleResolve = async (id) => {
        try {
            await resolveReport(id);
            setReports(prev => prev.filter(r => r.id !== id));
            toast('처리 완료로 표시했습니다.');
        } catch (e) {
            logError('신고 처리', e);
            toast.error('처리에 실패했습니다.');
        }
    };

    return (
        <Modal
            open={isOpen}
            onClose={onClose}
            title="신고 검토"
            subtitle={`미처리 ${reports.length}건`}
            size="max-w-md"
        >
            {loading ? (
                <p className="text-center text-sm text-dim font-bold py-10">불러오는 중...</p>
            ) : reports.length === 0 ? (
                <div className="text-center py-12">
                    <ShieldAlert size={26} className="text-muted mx-auto mb-3" />
                    <p className="text-sm text-dim font-bold">미처리 신고가 없습니다</p>
                </div>
            ) : (
                <div className="space-y-2.5">
                    {reports.map(r => (
                        <div key={r.id} className="p-4 rounded-2xl bg-card border border-white/[0.06]">
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-[12px] font-black text-coral">{r.reason}</span>
                                <span className="text-[10px] font-bold text-muted tabular">
                                    {r.createdAt?.toDate?.()?.toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) || ''}
                                </span>
                            </div>
                            {r.roomName && <p className="text-sm font-black text-txt mt-1.5 truncate">방: {r.roomName}</p>}
                            {r.detail && <p className="text-[12px] text-dim font-medium mt-1 break-keep">{r.detail}</p>}
                            <div className="flex gap-2 mt-3">
                                {r.roomId && (
                                    <a
                                        href={`/room/${r.roomId}`}
                                        className="flex-1 py-2 text-center rounded-full bg-white/5 border border-white/10 text-[11px] font-black text-txt"
                                    >
                                        방 열어보기
                                    </a>
                                )}
                                <button
                                    onClick={() => handleResolve(r.id)}
                                    className="flex-1 py-2 rounded-full bg-volt text-ink text-[11px] font-black flex items-center justify-center gap-1"
                                >
                                    <CheckCircle size={13} /> 처리 완료
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </Modal>
    );
}
