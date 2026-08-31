import React, { useEffect, useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import { getSensitivity, AUTO_MATCH_SENSITIVITIES } from '../../lib/matching';
import { computeDailySummary, shareSummaryCard } from '../../lib/summaryCard';
import { hashPassword, hasPassword, isLegacyPassword } from '../../lib/roomPassword';
import { toast } from '../../lib/toast';
import { logError } from '../../lib/errorLog';
import { STALE_MINUTES } from '../../lib/presence';
import {
    Crown, Archive, Users, KeyRound, Camera, Eye, EyeOff, Timer, ShieldAlert,
} from '../../components/ui/icons';

/** 민감도 4단계 버튼 한 줄 (컴포넌트 안에 두면 매 렌더마다 재마운트된다) */
function SensitivityRow({ value, onChange }) {
    return (
        <div className="grid grid-cols-4 gap-1.5">
            {AUTO_MATCH_SENSITIVITIES.map(s => (
                <button
                    key={s.key}
                    onClick={() => onChange(s.key)}
                    aria-pressed={value === s.key}
                    className={`py-2 rounded-lg text-xs font-black transition-all ${value === s.key ? 'bg-volt text-ink' : 'bg-white/5 text-dim'}`}
                >
                    {s.label}
                </button>
            ))}
        </div>
    );
}

function Stepper({ label, value, onAdjust, min = 1, hint }) {
    return (
        <div>
            <span className="text-[11px] font-black label text-dim mb-2 block text-center">{label}</span>
            <div className="flex items-center justify-center gap-3">
                <button
                    aria-label={`${label} 줄이기`}
                    onClick={() => onAdjust(-1)}
                    disabled={value <= min}
                    className="w-9 h-9 rounded-full bg-card2 border border-white/10 text-txt font-black active:scale-90 transition-transform disabled:opacity-40"
                >
                    −
                </button>
                <span className="text-xl font-black w-7 text-center tabular text-txt" aria-live="polite">{value}</span>
                <button
                    aria-label={`${label} 늘리기`}
                    onClick={() => onAdjust(1)}
                    className="w-9 h-9 rounded-full bg-volt text-ink font-black active:scale-90 transition-transform"
                >
                    +
                </button>
            </div>
            {hint && <p className="text-[10px] text-muted font-medium text-center mt-1.5 leading-snug">{hint}</p>}
        </div>
    );
}

// ===================================================================================
// 방 환경 설정
// ===================================================================================
export function SettingsModal({
    isOpen, onClose, roomData, players, onSave,
    onReset, onKickAll, onReplayGuide, onManageAdmins, onEditNotice,
    isGhost, onToggleGhost, staleCount, onCleanStale, canManagePassword,
}) {
    const [settings, setSettings] = useState({
        mode: 'admin',
        numScheduledMatches: 4,
        numInProgressCourts: 2,
        courtTimeLimit: 20,
        autoMatchConfig: {
            sensitivity: 'normal', perGenderSensitivity: false,
            maleSensitivity: 'normal', femaleSensitivity: 'normal',
        },
    });
    const [sharing, setSharing] = useState(false);

    // ── 비밀번호 관리 ──
    const [pwOpen, setPwOpen] = useState(false);
    const [pwValue, setPwValue] = useState('');
    const [pwShow, setPwShow] = useState(false);
    const [pwBusy, setPwBusy] = useState(false);

    useEffect(() => {
        if (!roomData) return;
        const cfg = roomData.autoMatchConfig || {};
        setSettings({
            mode: roomData.mode || 'admin',
            numScheduledMatches: roomData.numScheduledMatches || 4,
            numInProgressCourts: roomData.numInProgressCourts || 2,
            courtTimeLimit: roomData.courtTimeLimit ?? 20,
            autoMatchConfig: {
                sensitivity: cfg.sensitivity || 'normal',
                perGenderSensitivity: !!cfg.perGenderSensitivity,
                maleSensitivity: cfg.maleSensitivity || cfg.sensitivity || 'normal',
                femaleSensitivity: cfg.femaleSensitivity || cfg.sensitivity || 'normal',
            },
        });
        setPwOpen(false);
        setPwValue('');
    }, [roomData]);

    const adjust = (field, delta, min = 1) =>
        setSettings(prev => ({ ...prev, [field]: Math.max(min, prev[field] + delta) }));

    const setAuto = (patch) =>
        setSettings(prev => ({ ...prev, autoMatchConfig: { ...prev.autoMatchConfig, ...patch } }));

    // 지금 활성 인원 (휴식 제외) — 민감도를 고를 때 판단 근거가 된다
    const activeList = Object.values(players || {}).filter(p => !p.isResting);
    const activeMale = activeList.filter(p => p.gender === '남').length;
    const activeFemale = activeList.length - activeMale;

    const handleShareSummary = async () => {
        if (sharing) return;
        setSharing(true);
        try {
            const summary = computeDailySummary(players, roomData?.name);
            if (summary.attendees.length === 0) { toast.error('아직 참석한 선수가 없습니다.'); return; }
            const how = await shareSummaryCard(summary);
            toast(how === 'shared' ? '요약 카드를 공유했습니다.' : '요약 카드를 저장했습니다.');
        } catch (e) {
            logError('하루 요약 카드', e);
            toast.error('요약 카드를 만들지 못했습니다.');
        } finally { setSharing(false); }
    };

    const handleSavePassword = async (clear = false) => {
        setPwBusy(true);
        try {
            if (clear) {
                await onSave({ ...settings, passwordHash: '', passwordSalt: '', password: '' });
                toast('비밀번호를 없앴습니다. 이제 누구나 들어올 수 있어요.');
            } else {
                if (!pwValue.trim()) { toast.error('새 비밀번호를 입력해주세요.'); return; }
                const pw = await hashPassword(pwValue);
                await onSave({ ...settings, passwordHash: pw.hash, passwordSalt: pw.salt, password: '' });
                toast('비밀번호를 새로 설정했습니다.');
            }
            setPwValue('');
            setPwOpen(false);
        } catch (e) {
            logError('방 비밀번호 변경', e);
            toast.error('비밀번호를 저장하지 못했습니다.');
        } finally { setPwBusy(false); }
    };

    const legacy = isLegacyPassword(roomData);

    return (
        <Modal
            open={isOpen}
            onClose={onClose}
            title="환경 설정"
            size="max-w-sm"
            footer={(
                <button
                    onClick={() => { onSave(settings); onClose(); }}
                    className="w-full py-4 bg-volt text-ink font-black rounded-full text-base shadow-volt label"
                >
                    설정 저장
                </button>
            )}
        >
            <div className="space-y-6">
                {/* ── 공지사항 — 가장 자주 쓰는 운영 도구라 맨 위에 둔다 ── */}
                {onEditNotice && (
                    <div>
                        <span className="text-[11px] font-black label text-dim mb-2 block">공지사항</span>
                        <button
                            onClick={onEditNotice}
                            className="w-full py-3 bg-volt/10 text-volt font-black rounded-xl text-sm hover:bg-volt/20 transition-colors flex justify-center items-center gap-2"
                        >
                            📢 {(roomData?.notice || '').trim() ? '공지 수정하기' : '공지 등록하기'}
                        </button>
                        {(roomData?.notice || '').trim() ? (
                            <p className="text-[11px] text-muted font-medium mt-2 leading-relaxed break-keep truncate">
                                현재 공지: {roomData.notice}
                            </p>
                        ) : (
                            <p className="text-[11px] text-muted font-medium mt-2 leading-relaxed break-keep">
                                방 상단에 고정되고, 새로 입장하는 사람은 입장 화면에서도 봅니다.
                            </p>
                        )}
                    </div>
                )}

                {/* ── 운영 모드 ── */}
                <div>
                    <span className="text-[11px] font-black label text-dim mb-2 block">운영 모드</span>
                    <div className="flex bg-white/5 rounded-xl p-1">
                        {['admin', 'personal'].map(mode => (
                            <button
                                key={mode}
                                onClick={() => setSettings(s => ({ ...s, mode }))}
                                aria-pressed={settings.mode === mode}
                                className={`flex-1 py-2.5 text-sm font-black rounded-lg transition-all ${settings.mode === mode ? 'bg-volt text-ink' : 'text-dim'}`}
                            >
                                {mode === 'admin' ? '👑 관리자' : '🏃 개인'}
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── 코트 · 경기 ── */}
                <div className="grid grid-cols-2 gap-4">
                    <Stepper
                        label="경기 예정 수"
                        value={settings.numScheduledMatches}
                        onAdjust={(d) => adjust('numScheduledMatches', d)}
                    />
                    <Stepper
                        label="코트 수"
                        value={settings.numInProgressCourts}
                        onAdjust={(d) => adjust('numInProgressCourts', d)}
                        hint="실제 빌린 코트 면 수"
                    />
                </div>

                {/* ── 경기 시간 알림 ── */}
                <div>
                    <div className="flex items-center gap-1.5 mb-2">
                        <Timer size={13} className="text-dim" />
                        <span className="text-[11px] font-black label text-dim">경기 시간 알림</span>
                    </div>
                    <div className="flex gap-1.5">
                        {[0, 15, 20, 25, 30].map(m => (
                            <button
                                key={m}
                                onClick={() => setSettings(s => ({ ...s, courtTimeLimit: m }))}
                                aria-pressed={settings.courtTimeLimit === m}
                                className={`flex-1 py-2 rounded-lg text-xs font-black transition-all ${
                                    settings.courtTimeLimit === m ? 'bg-volt text-ink' : 'bg-white/5 text-dim'
                                }`}
                            >
                                {m === 0 ? '끄기' : `${m}분`}
                            </button>
                        ))}
                    </div>
                    <p className="text-[11px] text-muted font-medium mt-2 leading-relaxed break-keep">
                        이 시간을 넘기면 코트 타이머가 빨갛게 깜빡여요. “그만 내려오세요”를 대신 말해줍니다.
                    </p>
                </div>

                {/* ── 자동 매칭 민감도 ── */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-black label text-dim">🤖 자동 매칭 민감도</span>
                        <span className="text-[10px] font-black text-muted tabular">활성 남 {activeMale} · 여 {activeFemale}</span>
                    </div>
                    <SensitivityRow
                        value={settings.autoMatchConfig.sensitivity}
                        onChange={(k) => setAuto({ sensitivity: k })}
                    />
                    <p className="text-[11px] leading-relaxed text-emerald-400/90 font-medium mt-2">
                        {getSensitivity(settings.autoMatchConfig.sensitivity).desc}
                    </p>

                    <label className="flex items-center gap-2 mt-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={settings.autoMatchConfig.perGenderSensitivity}
                            onChange={(e) => setAuto({ perGenderSensitivity: e.target.checked })}
                            className="w-4 h-4 accent-[#CDFB47]"
                        />
                        <span className="text-xs font-bold text-dim">남/여 따로 정하기</span>
                    </label>
                    {settings.autoMatchConfig.perGenderSensitivity && (
                        <div className="mt-2 space-y-2">
                            <div>
                                <span className="text-[10px] font-black label text-muted block mb-1">남자</span>
                                <SensitivityRow
                                    value={settings.autoMatchConfig.maleSensitivity}
                                    onChange={(k) => setAuto({ maleSensitivity: k })}
                                />
                            </div>
                            <div>
                                <span className="text-[10px] font-black label text-muted block mb-1">여자</span>
                                <SensitivityRow
                                    value={settings.autoMatchConfig.femaleSensitivity}
                                    onChange={(k) => setAuto({ femaleSensitivity: k })}
                                />
                            </div>
                            <p className="text-[10px] text-muted font-medium">혼복은 위 기본값을 씁니다.</p>
                        </div>
                    )}
                </div>

                {/* ── 관리자 ── */}
                <div>
                    <span className="text-[11px] font-black label text-dim mb-2 block">함께 운영하기</span>
                    <button
                        onClick={onManageAdmins}
                        className="w-full py-3 bg-volt/10 text-volt font-black rounded-xl text-sm hover:bg-volt/20 transition-colors flex justify-center items-center gap-2"
                    >
                        <Crown size={16} /> 관리자 추가 · 관리
                    </button>
                    <p className="text-[11px] text-muted font-medium mt-2 leading-relaxed break-keep">
                        방에 있는 사람은 탭 한 번으로 임명할 수 있어요. 없는 사람에게는 초대 링크를 보냅니다.
                    </p>
                </div>

                {/* ── 비밀번호 ── */}
                {canManagePassword && (
                    <div>
                        <div className="flex items-center gap-1.5 mb-2">
                            <KeyRound size={13} className="text-dim" />
                            <span className="text-[11px] font-black label text-dim">입장 비밀번호</span>
                        </div>

                        {legacy && (
                            <div className="flex gap-2 mb-2 p-3 rounded-xl bg-coral/10 border border-coral/30">
                                <ShieldAlert size={15} className="text-coral shrink-0 mt-0.5" />
                                <p className="text-[11px] text-coral font-bold leading-relaxed break-keep">
                                    예전 방식으로 저장된 비밀번호예요. 한 번만 새로 설정해주시면
                                    암호화해서 안전하게 보관합니다.
                                </p>
                            </div>
                        )}

                        {!pwOpen ? (
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setPwOpen(true)}
                                    className="flex-1 py-3 bg-white/5 text-txt font-black rounded-xl text-sm hover:bg-white/10 transition-colors"
                                >
                                    {hasPassword(roomData) ? '비밀번호 바꾸기' : '비밀번호 걸기'}
                                </button>
                                {hasPassword(roomData) && (
                                    <button
                                        onClick={() => handleSavePassword(true)}
                                        disabled={pwBusy}
                                        className="px-4 py-3 bg-coral/10 text-coral font-black rounded-xl text-sm disabled:opacity-50"
                                    >
                                        없애기
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <div className="relative">
                                    <input
                                        type={pwShow ? 'text' : 'password'}
                                        autoComplete="new-password"
                                        placeholder="새 비밀번호"
                                        value={pwValue}
                                        onChange={e => setPwValue(e.target.value)}
                                        className="w-full p-3 pr-11 bg-card2 rounded-xl border border-white/10 focus:border-volt outline-none text-sm font-bold text-txt placeholder-muted"
                                    />
                                    <button
                                        onClick={() => setPwShow(v => !v)}
                                        aria-label={pwShow ? '비밀번호 숨기기' : '비밀번호 보기'}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-dim"
                                    >
                                        {pwShow ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => { setPwOpen(false); setPwValue(''); }}
                                        className="px-4 py-2.5 bg-white/5 text-dim font-black rounded-xl text-xs"
                                    >
                                        취소
                                    </button>
                                    <button
                                        onClick={() => handleSavePassword(false)}
                                        disabled={pwBusy}
                                        className="flex-1 py-2.5 bg-volt text-ink font-black rounded-xl text-xs disabled:opacity-50"
                                    >
                                        {pwBusy ? '저장 중...' : '이 비밀번호로 설정'}
                                    </button>
                                </div>
                                <p className="text-[11px] text-muted font-medium leading-relaxed break-keep">
                                    암호화해서 저장하므로 나중에 다시 볼 수 없어요. 잊으면 여기서 새로 정하면 됩니다.
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {/* ── 자리 비움 정리 ── */}
                {staleCount > 0 && (
                    <div>
                        <span className="text-[11px] font-black label text-dim mb-2 block">명단 정리</span>
                        <button
                            onClick={onCleanStale}
                            className="w-full py-3 bg-white/5 text-txt font-black rounded-xl text-sm hover:bg-white/10 transition-colors flex justify-center items-center gap-2"
                        >
                            <Users size={16} /> 자리 비운 {staleCount}명 내보내기
                        </button>
                        <p className="text-[11px] text-muted font-medium mt-2 leading-relaxed break-keep">
                            {STALE_MINUTES}분 넘게 앱을 열지 않은 사람이에요. 정말 갔는지 확인하고 눌러주세요 —
                            상태는 자동으로 바뀌지 않아요.
                        </p>
                    </div>
                )}

                {/* ── 오늘의 운동 ── */}
                <div>
                    <span className="text-[11px] font-black label text-dim mb-2 block">오늘의 운동</span>
                    <div className="space-y-2">
                        <button
                            onClick={handleShareSummary}
                            disabled={sharing}
                            className="w-full py-3 bg-volt/10 text-volt font-black rounded-xl text-sm hover:bg-volt/20 transition-colors flex justify-center items-center gap-2 disabled:opacity-50"
                        >
                            <Camera size={16} /> {sharing ? '만드는 중...' : '하루 요약 카드 만들기'}
                        </button>
                        <button
                            onClick={onReplayGuide}
                            className="w-full py-3 bg-white/5 text-dim font-black rounded-xl text-sm hover:bg-white/10 transition-colors"
                        >
                            📖 관리자 안내 다시 보기
                        </button>
                    </div>
                </div>

                {/* ── 운영 전용 모드 ── */}
                <div>
                    <span className="text-[11px] font-black label text-dim mb-2 block">내 참여 방식</span>
                    <button
                        onClick={onToggleGhost}
                        className={`w-full py-3 font-black rounded-xl text-sm transition-colors flex justify-center items-center gap-2 ${isGhost ? 'bg-volt/15 text-volt' : 'bg-white/5 text-dim hover:bg-white/10'}`}
                    >
                        👻 {isGhost ? '운영 전용 모드 끄기 (다시 선수로 참여)' : '운영만 하기 (선수 명단에서 빠짐)'}
                    </button>
                    <p className="text-[11px] leading-relaxed text-muted font-medium mt-2 break-keep">
                        {isGhost
                            ? '지금은 선수 명단·인원 수·매칭 후보에 잡히지 않습니다.'
                            : '경기는 안 뛰고 운영만 할 때 켜세요. 매칭 후보에서 빠집니다.'}
                    </p>
                </div>

                {/* ── 고급 ── */}
                <div>
                    <span className="text-[11px] font-black label text-dim mb-2 block">고급 기능</span>
                    <div className="space-y-2">
                        <button
                            onClick={onReset}
                            className="w-full py-3 bg-coral/10 text-coral font-black rounded-xl text-sm hover:bg-coral/20 transition-colors flex justify-center items-center gap-2"
                        >
                            <Archive size={16} /> 시스템 초기화 (경기 삭제)
                        </button>
                        <button
                            onClick={onKickAll}
                            className="w-full py-3 bg-white/5 text-dim font-black rounded-xl text-sm hover:bg-white/10 transition-colors flex justify-center items-center gap-2"
                        >
                            <Users size={16} /> 모든 선수 내보내기
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    );
}
