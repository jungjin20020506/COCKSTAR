import React, { useState } from 'react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { updateProfile, signOut } from 'firebase/auth';
import { db, auth } from '../../firebase';
import { FIELD_CLS, LABEL_CLS, LEVELS, REGIONS } from '../../constants';
import { getDailyResetKey } from '../../lib/time';
import { toast } from '../../lib/toast';
import { logError } from '../../lib/errorLog';
import { Loader2 } from '../../components/ui/icons';

// ===================================================================================
// 최초 프로필 설정 — 가입 직후 딱 한 번
// -----------------------------------------------------------------------------------
// [탈출구가 필요하다]
//   예전에는 이 화면에 닫기도, 로그아웃도 없었다. 저장이 실패하거나(네트워크가
//   끊기거나 보안 규칙이 막거나) 다른 계정으로 들어왔다는 걸 깨달으면
//   앱을 완전히 지웠다 깔지 않는 한 빠져나올 수 없었다.
//   지금은 아래에 '다른 계정으로 로그인'을 뒀다.
//
// [하루 초기화 키]
//   방과 같은 운영일 키(새벽 2시)를 쓴다. 예전에는 여기서만 손으로 계산해서
//   방과 어긋난 날짜가 저장됐다.
// ===================================================================================

export function InitialProfileModal({ user }) {
    const [form, setForm] = useState({
        name: '', level: 'N조', gender: '남', birthYear: '2000', region: '경기',
    });
    const [loading, setLoading] = useState(false);

    const currentYear = new Date().getFullYear();
    const birthYears = Array.from({ length: 70 }, (_, i) => currentYear - i - 10);

    const handleSave = async (e) => {
        e.preventDefault();
        if (!form.name.trim()) { toast.error('이름을 입력해주세요.'); return; }
        setLoading(true);
        try {
            await setDoc(doc(db, 'users', user.uid), {
                ...form,
                name: form.name.trim(),
                email: user.email || '',
                todayGames: 0,
                lastResetDate: getDailyResetKey(),
                favoriteRooms: [],
                createdAt: serverTimestamp(),
            });
            await updateProfile(user, { displayName: form.name.trim() });
            toast('환영합니다! 프로필 설정 완료.');
        } catch (err) {
            logError('최초 프로필 저장', err);
            toast.error('저장에 실패했습니다. 연결 상태를 확인해주세요.');
        } finally { setLoading(false); }
    };

    return (
        <div className="fixed inset-0 bg-ink/95 backdrop-blur-md z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div
                role="dialog"
                aria-modal="true"
                aria-label="선수 프로필 설정"
                className="bg-surface rounded-t-[32px] sm:rounded-[28px] p-8 w-full max-w-md shadow-deep border border-white/[0.06] max-h-[94vh] overflow-y-auto hide-scrollbar animate-slide-up sm:animate-scale-in"
            >
                <div className="mb-8">
                    <span className="text-[11px] font-black label text-volt">Almost There</span>
                    <h2 className="text-2xl font-black kern-tight mt-1 text-txt">선수 프로필 완성</h2>
                    <p className="text-dim font-bold text-sm mt-1">코트에 서기 전, 딱 한 걸음 남았어요.</p>
                </div>

                <form onSubmit={handleSave} className="space-y-5">
                    <div>
                        <label className={LABEL_CLS} htmlFor="ip-name">이름 <span className="text-volt">*</span></label>
                        <input
                            id="ip-name"
                            type="text"
                            autoComplete="name"
                            placeholder="경기방에서 보일 이름"
                            required
                            value={form.name}
                            onChange={e => setForm({ ...form, name: e.target.value })}
                            className={FIELD_CLS}
                        />
                        <p className="text-[11px] text-muted font-medium mt-1.5 ml-0.5">
                            같은 방 사람들이 보는 이름이에요. 본명이나 늘 쓰는 별명을 권해요.
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={LABEL_CLS} htmlFor="ip-level">급수</label>
                            <select
                                id="ip-level"
                                value={form.level}
                                onChange={e => setForm({ ...form, level: e.target.value })}
                                className={FIELD_CLS}
                            >
                                {LEVELS.map(l => <option key={l} value={l} className="bg-surface">{l}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={LABEL_CLS} htmlFor="ip-region">지역</label>
                            <select
                                id="ip-region"
                                value={form.region}
                                onChange={e => setForm({ ...form, region: e.target.value })}
                                className={FIELD_CLS}
                            >
                                {REGIONS.map(r => <option key={r} value={r} className="bg-surface">{r}</option>)}
                            </select>
                        </div>
                    </div>
                    <p className="text-[11px] text-muted font-medium -mt-3 ml-0.5">
                        급수를 모르면 <b className="text-dim">N조</b>로 두세요. 매칭 엔진이 중간 실력으로 봅니다.
                    </p>

                    <div>
                        <span className={LABEL_CLS}>성별</span>
                        <div className="flex bg-white/5 p-1 rounded-xl" role="radiogroup" aria-label="성별">
                            {['남', '여'].map(g => (
                                <button
                                    key={g}
                                    type="button"
                                    role="radio"
                                    aria-checked={form.gender === g}
                                    onClick={() => setForm({ ...form, gender: g })}
                                    className={`flex-1 py-3 rounded-lg text-sm font-black transition-all ${form.gender === g ? 'bg-volt text-ink' : 'text-dim'}`}
                                >
                                    {g}
                                </button>
                            ))}
                        </div>
                        <p className="text-[11px] text-muted font-medium mt-1.5 ml-0.5">
                            남복·여복·혼복 매칭을 나누는 데 쓰여요.
                        </p>
                    </div>

                    <div>
                        <label className={LABEL_CLS} htmlFor="ip-birth">출생년도</label>
                        <select
                            id="ip-birth"
                            value={form.birthYear}
                            onChange={e => setForm({ ...form, birthYear: e.target.value })}
                            className={FIELD_CLS}
                        >
                            {birthYears.map(y => <option key={y} value={y} className="bg-surface">{y}년생</option>)}
                        </select>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-5 bg-volt text-ink font-black rounded-full shadow-volt text-base label disabled:opacity-60"
                    >
                        {loading ? <Loader2 className="animate-spin mx-auto" /> : '코트로 들어가기'}
                    </button>
                </form>

                {/* 탈출구 — 이게 없으면 저장이 안 될 때 앱에 갇힌다 */}
                <button
                    onClick={() => signOut(auth)}
                    className="w-full mt-4 py-3 text-muted text-xs font-bold hover:text-dim transition-colors"
                >
                    다른 계정으로 로그인할게요
                </button>
            </div>
        </div>
    );
}
