import React, { useState, useEffect } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import {
    updateProfile, updatePassword, EmailAuthProvider, reauthenticateWithCredential,
} from 'firebase/auth';
import { db } from '../../firebase';
import { Modal } from '../../components/ui/Modal';
import { FIELD_CLS, LABEL_CLS, LEVELS, REGIONS, ACCOUNT_DOMAIN } from '../../constants';
import { toast } from '../../lib/toast';
import { logError } from '../../lib/errorLog';
import { Loader2 } from '../../components/ui/icons';

// ===================================================================================
// 프로필 수정
// -----------------------------------------------------------------------------------
// [고친 것] 지역(region)이 통째로 빠져 있었다.
//   가입할 때는 지역을 물어보면서 수정 화면에는 칸도 없고 저장 필드에도 없었다.
//   이사를 가면 영영 못 바꿨고, 지역을 쓰는 기능(주변 방 찾기)이 계속 옛날 값을 봤다.
// ===================================================================================

export function EditProfileModal({ isOpen, onClose, userData, user }) {
    const [form, setForm] = useState({
        name: '', level: 'N조', gender: '남', birthYear: '2000', region: '경기',
        currentPassword: '', newPassword: '', confirmPassword: '',
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    useEffect(() => {
        if (!isOpen || !userData) return;
        setForm({
            name: userData.name || '',
            level: userData.level || 'N조',
            gender: userData.gender || '남',
            birthYear: userData.birthYear || '2000',
            region: userData.region || '경기',
            currentPassword: '', newPassword: '', confirmPassword: '',
        });
        setError('');
    }, [isOpen, userData]);

    // 카카오·휴대폰으로 가입한 사람에게는 비밀번호 자체가 없다 —
    // 비밀번호 변경 칸을 보여주면 "내 비밀번호가 뭐였지" 하고 헤매게 된다.
    const hasPassword = !!user?.email && user.email.endsWith(`@${ACCOUNT_DOMAIN}`);

    const change = (e) => {
        const { name, value } = e.target;
        setForm(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setError('');
        if (!form.name.trim()) { setError('이름을 입력해주세요.'); return; }
        setLoading(true);
        try {
            if (hasPassword && form.newPassword) {
                if (form.newPassword.length < 6) throw new Error('새 비밀번호는 6자 이상이어야 합니다.');
                if (form.newPassword !== form.confirmPassword) throw new Error('새 비밀번호가 일치하지 않습니다.');
                if (!form.currentPassword) throw new Error('비밀번호를 바꾸려면 현재 비밀번호가 필요합니다.');
                const cred = EmailAuthProvider.credential(user.email, form.currentPassword);
                await reauthenticateWithCredential(user, cred);
                await updatePassword(user, form.newPassword);
            }

            await updateDoc(doc(db, 'users', user.uid), {
                name: form.name.trim(),
                level: form.level,
                gender: form.gender,
                birthYear: form.birthYear,
                region: form.region,
            });
            if (user.displayName !== form.name.trim()) {
                await updateProfile(user, { displayName: form.name.trim() });
            }
            toast('프로필이 수정되었습니다.');
            onClose();
        } catch (err) {
            logError('프로필 수정', err);
            if (err?.code === 'auth/wrong-password' || err?.code === 'auth/invalid-credential') {
                setError('현재 비밀번호가 올바르지 않습니다.');
            } else {
                setError(err?.message || '프로필 수정 중 오류가 발생했습니다.');
            }
        } finally { setLoading(false); }
    };

    const currentYear = new Date().getFullYear();
    const birthYears = Array.from({ length: 70 }, (_, i) => currentYear - i - 10);

    return (
        <Modal open={isOpen} onClose={onClose} title="프로필 수정" size="max-w-md">
            {error && (
                <div role="alert" className="bg-coral/10 text-coral text-sm p-3 rounded-xl mb-4 text-center font-bold">
                    {error}
                </div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
                <div>
                    <label className={LABEL_CLS} htmlFor="ep-name">이름</label>
                    <input
                        data-autofocus
                        id="ep-name" type="text" name="name" autoComplete="name"
                        value={form.name} onChange={change} className={FIELD_CLS}
                    />
                </div>

                <div className="flex gap-3">
                    <div className="flex-1">
                        <label className={LABEL_CLS} htmlFor="ep-level">급수</label>
                        <select id="ep-level" name="level" value={form.level} onChange={change} className={FIELD_CLS}>
                            {LEVELS.map(l => <option key={l} value={l} className="bg-surface">{l}</option>)}
                        </select>
                    </div>
                    <div className="flex-1">
                        <span className={LABEL_CLS}>성별</span>
                        <div className="flex bg-white/5 p-1 rounded-xl" role="radiogroup" aria-label="성별">
                            {['남', '여'].map(g => (
                                <button
                                    key={g} type="button" role="radio" aria-checked={form.gender === g}
                                    onClick={() => setForm(prev => ({ ...prev, gender: g }))}
                                    className={`flex-1 py-2.5 rounded-lg text-sm font-black transition-all ${form.gender === g ? 'bg-volt text-ink' : 'text-dim'}`}
                                >
                                    {g}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="flex gap-3">
                    <div className="flex-1">
                        <label className={LABEL_CLS} htmlFor="ep-birth">출생년도</label>
                        <select id="ep-birth" name="birthYear" value={form.birthYear} onChange={change} className={FIELD_CLS}>
                            {birthYears.map(y => <option key={y} value={y} className="bg-surface">{y}년생</option>)}
                        </select>
                    </div>
                    <div className="flex-1">
                        <label className={LABEL_CLS} htmlFor="ep-region">지역</label>
                        <select id="ep-region" name="region" value={form.region} onChange={change} className={FIELD_CLS}>
                            {REGIONS.map(r => <option key={r} value={r} className="bg-surface">{r}</option>)}
                        </select>
                    </div>
                </div>

                {hasPassword && (
                    <div className="pt-4 border-t border-white/[0.06]">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-[11px] font-black label text-dim">비밀번호 변경</span>
                            <button
                                type="button"
                                onClick={() => setShowPassword(v => !v)}
                                className="text-xs text-dim hover:text-txt font-bold"
                            >
                                {showPassword ? '숨기기' : '보이기'}
                            </button>
                        </div>
                        <div className="space-y-3 bg-white/[0.03] p-4 rounded-2xl border border-white/[0.06]">
                            <input
                                type={showPassword ? 'text' : 'password'} name="currentPassword"
                                autoComplete="current-password" placeholder="현재 비밀번호 (변경 시 필수)"
                                value={form.currentPassword} onChange={change}
                                className="w-full p-3 bg-card2 border border-white/10 rounded-lg focus:border-volt outline-none text-sm font-bold text-txt"
                            />
                            <input
                                type={showPassword ? 'text' : 'password'} name="newPassword"
                                autoComplete="new-password" placeholder="새 비밀번호 (6자 이상)"
                                value={form.newPassword} onChange={change}
                                className="w-full p-3 bg-card2 border border-white/10 rounded-lg focus:border-volt outline-none text-sm font-bold text-txt"
                            />
                            <input
                                type={showPassword ? 'text' : 'password'} name="confirmPassword"
                                autoComplete="new-password" placeholder="새 비밀번호 확인"
                                value={form.confirmPassword} onChange={change}
                                className="w-full p-3 bg-card2 border border-white/10 rounded-lg focus:border-volt outline-none text-sm font-bold text-txt"
                            />
                        </div>
                    </div>
                )}

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-4 bg-volt text-ink font-black rounded-full shadow-volt disabled:opacity-60 mt-2 label"
                >
                    {loading ? <Loader2 className="animate-spin mx-auto" /> : '저장하기'}
                </button>
            </form>
        </Modal>
    );
}
