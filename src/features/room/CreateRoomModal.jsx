import React, { useState, useEffect } from 'react';
import { serverTimestamp } from 'firebase/firestore';
import { Modal } from '../../components/ui/Modal';
import { FIELD_CLS, LABEL_CLS, LEVELS } from '../../constants';
import { searchAddress } from '../../lib/kakao';
import { hashPassword } from '../../lib/roomPassword';
import { toast } from '../../lib/toast';
import { logError } from '../../lib/errorLog';
import { MapPin, Search, Loader2 } from '../../components/ui/icons';

// ===================================================================================
// 경기방 개설
// -----------------------------------------------------------------------------------
// [바뀐 것]
//  · 비밀번호를 평문으로 저장하지 않는다 (해시 + 방마다 다른 소금)
//  · 관리자를 uid 로 저장한다 (adminUids). 이메일 문자열 매칭은 남을 나로 오인할 수 있었다
//  · lastActiveAt 을 처음부터 넣는다 — 로비의 '최근 운영순' 정렬이 이 값을 본다
// ===================================================================================

const DEFAULT = {
    name: '', locationName: '', address: '', coords: null, description: '',
    levelLimit: 'N조', maxPlayers: 20, usePassword: false, password: '',
};

export function CreateRoomModal({ isOpen, onClose, onSubmit, user, userData, prefill }) {
    const [form, setForm] = useState(DEFAULT);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        // 콕맵의 '이 체육관에 방 만들기'로 들어오면 주소·좌표가 미리 채워진다
        setForm({ ...DEFAULT, ...(prefill || {}) });
        setError('');
        setLoading(false);
    }, [isOpen, prefill]);

    const set = (patch) => setForm(prev => ({ ...prev, ...patch }));

    const handleAddressSearch = async () => {
        try {
            const { address, buildingName, coords } = await searchAddress();
            set({
                address,
                coords,
                locationName: form.locationName || buildingName,
            });
            if (!coords) {
                setError('주소는 찾았지만 좌표를 가져오지 못했어요. 지도에 표시되지 않을 수 있습니다.');
            } else {
                setError('');
            }
        } catch (e) {
            if (e.message === 'CANCELLED') return;
            toast.error(e.message);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!form.name.trim()) { setError('방 제목을 입력해주세요.'); return; }
        if (!form.address) { setError('장소를 검색해서 입력해주세요.'); return; }
        const max = parseInt(form.maxPlayers, 10);
        if (!Number.isFinite(max) || max < 4) { setError('정원은 4명 이상이어야 합니다.'); return; }
        if (form.usePassword && !form.password.trim()) { setError('비밀번호를 입력해주세요.'); return; }

        setLoading(true);
        try {
            const pw = form.usePassword ? await hashPassword(form.password) : null;

            await onSubmit({
                name: form.name.trim(),
                location: form.locationName.trim() || form.address,
                address: form.address,
                coords: form.coords,
                description: form.description.trim() || '모임 소개가 없습니다.',
                levelLimit: form.levelLimit,
                maxPlayers: max,
                // 평문 password 필드는 더 이상 쓰지 않는다
                passwordHash: pw?.hash || '',
                passwordSalt: pw?.salt || '',
                adminUid: user.uid,
                adminUids: [user.uid],
                adminName: userData?.name || '방장',
                createdAt: serverTimestamp(),
                lastActiveAt: serverTimestamp(),
                playerCount: 0,
                numScheduledMatches: 4,
                numInProgressCourts: 2,
                courtTimeLimit: 20,
                scheduledMatches: {},
                inProgressCourts: [],
                autoMatches: {},
                autoMatchConfig: {
                    sensitivity: 'normal', perGenderSensitivity: false,
                    maleSensitivity: 'normal', femaleSensitivity: 'normal',
                },
            });
            onClose();
        } catch (err) {
            logError('경기방 개설', err);
            setError(`경기방을 만들지 못했습니다: ${err.message}`);
        } finally { setLoading(false); }
    };

    return (
        <Modal
            open={isOpen}
            onClose={loading ? undefined : onClose}
            title="경기방 개설"
            subtitle="New Match"
            size="max-w-lg"
        >
            {error && (
                <p role="alert" className="text-coral mb-4 bg-coral/10 p-3 rounded-xl text-sm font-bold break-keep">
                    {error}
                </p>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className={LABEL_CLS} htmlFor="cr-name">방 제목 <span className="text-volt">*</span></label>
                    <input
                        data-autofocus
                        id="cr-name" type="text" required
                        placeholder="예: 수요 저녁 8시 · 초심 환영"
                        value={form.name}
                        onChange={(e) => set({ name: e.target.value })}
                        className={FIELD_CLS}
                    />
                </div>

                <div className="space-y-3 p-4 bg-white/[0.03] rounded-2xl border border-white/[0.06]">
                    <span className="flex items-center gap-1.5 text-[11px] font-black label text-dim">
                        <MapPin size={13} /> 모임 장소 <span className="text-volt">*</span>
                    </span>
                    <button
                        type="button"
                        onClick={handleAddressSearch}
                        className="w-full py-3 bg-card2 border border-white/10 rounded-xl text-sm font-black text-txt hover:border-volt transition-all flex items-center justify-center gap-2"
                    >
                        <Search size={16} /> 주소 검색하기
                    </button>
                    <div className={`w-full p-3 rounded-xl border text-sm font-bold ${form.address ? 'bg-card2 border-white/10 text-txt' : 'bg-white/[0.02] border-white/[0.06] text-muted'}`}>
                        {form.address ? (
                            <div className="flex items-center gap-2">
                                <span className="flex-1 break-keep">{form.address}</span>
                                {form.coords && (
                                    <span className="text-[10px] bg-volt text-ink px-1.5 py-0.5 rounded-full font-black shrink-0">
                                        좌표 OK
                                    </span>
                                )}
                            </div>
                        ) : '주소가 설정되지 않았습니다.'}
                    </div>
                    <input
                        type="text"
                        placeholder="상세 장소 (예: 콕스타 체육관 2층)"
                        value={form.locationName}
                        onChange={(e) => set({ locationName: e.target.value })}
                        className="w-full p-3 bg-card2 rounded-xl border border-white/10 focus:border-volt outline-none text-sm font-bold text-txt placeholder-muted"
                    />
                </div>

                <div>
                    <label className={LABEL_CLS} htmlFor="cr-desc">소개</label>
                    <textarea
                        id="cr-desc" rows={3}
                        placeholder="어떤 경기를 지향하나요? 자유롭게 소개해주세요."
                        value={form.description}
                        onChange={(e) => set({ description: e.target.value })}
                        className={`${FIELD_CLS} resize-none`}
                    />
                </div>

                <div className="flex gap-4">
                    <div className="flex-1">
                        <label className={LABEL_CLS} htmlFor="cr-level">입장 급수</label>
                        <select
                            id="cr-level" value={form.levelLimit}
                            onChange={(e) => set({ levelLimit: e.target.value })}
                            className={FIELD_CLS}
                        >
                            {['N조', ...LEVELS.filter(l => l !== 'N조')].map(l => (
                                <option key={l} value={l} className="bg-surface">
                                    {l === 'N조' ? '전체 급수' : `${l} 이상`}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="flex-1">
                        <label className={LABEL_CLS} htmlFor="cr-max">정원</label>
                        <input
                            id="cr-max" type="number" inputMode="numeric" min="4" step="1"
                            value={form.maxPlayers}
                            onChange={(e) => set({ maxPlayers: e.target.value })}
                            className={FIELD_CLS}
                        />
                    </div>
                </div>

                <div className="bg-white/[0.03] p-4 rounded-2xl border border-white/[0.06]">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={form.usePassword}
                            onChange={(e) => set({ usePassword: e.target.checked })}
                            className="h-4 w-4 rounded accent-[#CDFB47]"
                        />
                        <span className="text-sm font-black text-txt">비밀번호 설정</span>
                    </label>
                    {form.usePassword && (
                        <>
                            <input
                                type="password" autoComplete="new-password" placeholder="비밀번호 입력"
                                value={form.password}
                                onChange={(e) => set({ password: e.target.value })}
                                className="w-full p-3 mt-3 bg-card2 rounded-xl border border-white/10 focus:border-volt outline-none text-sm font-bold text-txt"
                            />
                            <p className="text-[11px] text-muted font-medium mt-2 leading-relaxed break-keep">
                                비밀번호는 암호화해서 저장돼요. 잊어버려도 방 설정에서 새로 정할 수 있습니다.
                            </p>
                        </>
                    )}
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-4 bg-volt text-ink font-black rounded-full text-base hover:bg-volt-dark transition-colors disabled:opacity-60 flex items-center justify-center shadow-volt label"
                >
                    {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : '경기방 만들기'}
                </button>
            </form>
        </Modal>
    );
}
