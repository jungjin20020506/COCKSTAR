import React, { useState, useRef, useEffect } from 'react';
import {
    signInWithEmailAndPassword, signInWithPhoneNumber, signInWithPopup,
    OAuthProvider, RecaptchaVerifier, sendPasswordResetEmail,
} from 'firebase/auth';
import { auth } from '../../firebase';
import { Modal } from '../../components/ui/Modal';
import { CockstarLogo } from '../../components/ui/Logo';
import { Loader2, MessageSquare, Phone, KeyRound, ArrowLeft, ZapRaw } from '../../components/ui/icons';
import { FIELD_CLS, convertToEmail, SUPPORT } from '../../constants';
import { logError } from '../../lib/errorLog';
import { openKakaoChat } from '../../lib/feedback';

// ===================================================================================
// 로그인 — 카카오 · 휴대폰 · (관리자) 아이디/비밀번호 + 계정 찾기
// ===================================================================================

/** 01012345678 → +821012345678 */
function toE164(input) {
    const raw = String(input || '').replace(/[^0-9+]/g, '');
    if (raw.startsWith('+')) return raw;
    return `+82${raw.replace(/^0/, '')}`;
}

/**
 * 입력 중 자동 하이픈: 01012345678 → 010-1234-5678.
 * 눈으로 자기 번호를 확인하기 훨씬 쉽다 (틀린 번호로 인증번호를 날리는 사고 방지).
 * 저장·전송 값은 toE164 가 하이픈을 벗겨내므로 형식은 화면에만 존재한다.
 */
function formatPhone(input) {
    const d = String(input || '').replace(/[^0-9]/g, '').slice(0, 11);
    if (d.length <= 3) return d;
    if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`;
    return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
}

export function AuthModal({ isOpen, onClose }) {
    const [mode, setMode] = useState('select');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const [phone, setPhone] = useState('');
    const [vCode, setVCode] = useState('');
    const [confirmation, setConfirmation] = useState(null);

    const [adminId, setAdminId] = useState('');
    const [adminPw, setAdminPw] = useState('');
    const [findEmail, setFindEmail] = useState('');
    const [findSent, setFindSent] = useState(false);

    // ★ reCAPTCHA 검증기는 '한 번만' 만들어 재사용한다.
    //   예전에는 인증번호 전송을 누를 때마다 new RecaptchaVerifier 를 만들었다.
    //   같은 컨테이너에 두 번 렌더하면 Firebase 가 거부해서, 번호를 잘못 눌러 다시
    //   시도하는 순간부터 계속 실패했다. 번호를 처음에 정확히 친 사람만 가입됐던 셈이다.
    const verifierRef = useRef(null);

    useEffect(() => {
        if (isOpen) return undefined;
        // 창을 닫으면 검증기를 정리한다 (다음에 열 때 새 컨테이너에 붙어야 한다)
        return () => {
            try { verifierRef.current?.clear(); } catch { /* noop */ }
            verifierRef.current = null;
        };
    }, [isOpen]);

    const reset = () => {
        setMode('select'); setError(''); setLoading(false);
        setPhone(''); setVCode(''); setConfirmation('');
        setAdminId(''); setAdminPw(''); setFindEmail(''); setFindSent(false);
    };

    const close = () => { reset(); onClose(); };

    const getVerifier = () => {
        if (verifierRef.current) return verifierRef.current;
        verifierRef.current = new RecaptchaVerifier(auth, 'recaptcha-container', { size: 'invisible' });
        return verifierRef.current;
    };

    const handleSendCode = async () => {
        if (!phone.trim()) { setError('휴대폰 번호를 입력해주세요.'); return; }
        setError(''); setLoading(true);
        try {
            const result = await signInWithPhoneNumber(auth, toE164(phone), getVerifier());
            setConfirmation(result);
            setMode('verify');
        } catch (err) {
            logError('인증번호 전송', err);
            // 검증기가 한 번 소모되면 다시 못 쓴다 — 버리고 다음에 새로 만든다
            try { verifierRef.current?.clear(); } catch { /* noop */ }
            verifierRef.current = null;
            setError(err?.code === 'auth/too-many-requests'
                ? '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.'
                : '인증번호를 보내지 못했습니다. 번호를 확인해주세요.');
        } finally { setLoading(false); }
    };

    const handleVerify = async () => {
        if (!vCode.trim()) { setError('인증번호를 입력해주세요.'); return; }
        setError(''); setLoading(true);
        try {
            await confirmation.confirm(vCode);
            close();
        } catch {
            setError('인증번호가 일치하지 않습니다.');
        } finally { setLoading(false); }
    };

    const handleKakao = async () => {
        setError('');
        try {
            await signInWithPopup(auth, new OAuthProvider('oidc.kakao'));
            close();
        } catch (err) {
            logError('카카오 로그인', err);
            if (err?.code === 'auth/popup-closed-by-user') return;
            setError('카카오 로그인에 실패했습니다.');
        }
    };

    const handleAdminLogin = async (e) => {
        e.preventDefault();
        setError(''); setLoading(true);
        try {
            await signInWithEmailAndPassword(auth, convertToEmail(adminId), adminPw);
            close();
        } catch {
            setError('아이디 또는 비밀번호가 올바르지 않습니다.');
        } finally { setLoading(false); }
    };

    const handleReset = async (e) => {
        e.preventDefault();
        const email = findEmail.trim();
        if (!email.includes('@')) {
            setError('가입할 때 쓴 이메일 주소를 입력해주세요.');
            return;
        }
        setError(''); setLoading(true);
        try {
            await sendPasswordResetEmail(auth, email);
        } catch (err) {
            // 계정이 없어도 "없다"고 알려주지 않는다 —
            // 그 대답 자체가 "이 이메일은 가입돼 있다"를 알려주는 정보가 된다.
            if (err?.code !== 'auth/user-not-found') logError('비밀번호 재설정', err);
        } finally {
            setLoading(false);
            setFindSent(true);
        }
    };

    const back = (to) => (
        <button
            onClick={() => { setMode(to); setError(''); }}
            className="w-full flex items-center justify-center gap-1 text-dim text-sm font-bold py-2 hover:text-txt transition-colors"
        >
            <ArrowLeft size={15} /> 뒤로가기
        </button>
    );

    return (
        <Modal open={isOpen} onClose={close} ariaLabel="로그인" size="max-w-md">
            {/* 헤더 — 모달 본문 안에 두어 스크롤과 함께 움직인다 */}
            <div className="-mx-6 -mt-6 mb-7 relative bg-ink px-8 pt-9 pb-8 grain court-lines overflow-hidden">
                <div className="relative z-10">
                    <CockstarLogo markSize={26} />
                    <h1 className="mt-6 text-txt font-display display-italic text-4xl leading-[0.92]">
                        코트를<br /><span className="text-volt">지배하라</span>
                    </h1>
                    <p className="mt-3 text-dim text-sm font-medium">가입 30초. 오늘 저녁 경기부터 바로 뛴다.</p>
                </div>
                <ZapRaw className="absolute -right-4 -bottom-6 w-40 h-40 text-white/[0.04]" strokeWidth={1} />
            </div>

            {error && (
                <p role="alert" className="text-coral text-xs text-center mb-4 font-bold bg-coral/10 rounded-xl py-2.5 px-3">
                    {error}
                </p>
            )}

            {/* reCAPTCHA 가 붙을 자리 — 보이지 않지만 DOM 에 항상 있어야 한다 */}
            <div id="recaptcha-container" />

            {mode === 'select' && (
                <div className="space-y-3 animate-fade-in-up">
                    <button
                        onClick={handleKakao}
                        className="w-full py-4 bg-[#FEE500] text-[#1a1a1a] font-black rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                    >
                        <MessageSquare size={18} fill="#1a1a1a" /> 카카오로 시작하기
                    </button>
                    <button
                        onClick={() => setMode('phone')}
                        className="w-full py-4 bg-volt text-ink font-black rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                    >
                        <Phone size={18} /> 휴대폰 번호로 시작하기
                    </button>

                    <div className="pt-6 flex flex-col items-center gap-3">
                        <button
                            onClick={() => setMode('find')}
                            className="text-xs text-dim font-bold hover:text-txt transition-colors underline underline-offset-4 decoration-white/20"
                        >
                            로그인이 안 되나요? 계정 찾기
                        </button>
                        <button
                            onClick={() => setMode('admin')}
                            className="text-[10px] text-muted font-medium hover:text-dim transition-colors"
                        >
                            아이디로 로그인 (관리자)
                        </button>
                    </div>
                </div>
            )}

            {mode === 'phone' && (
                <div className="space-y-4 animate-fade-in-up">
                    <input
                        data-autofocus
                        type="tel"
                        inputMode="numeric"
                        autoComplete="tel"
                        placeholder="휴대폰 번호 (010-1234-5678)"
                        value={phone}
                        onChange={(e) => setPhone(formatPhone(e.target.value))}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleSendCode(); }}
                        className={FIELD_CLS}
                    />
                    <button
                        onClick={handleSendCode}
                        disabled={loading}
                        className="w-full py-4 bg-volt text-ink font-black rounded-2xl shadow-volt flex items-center justify-center transition-transform active:scale-95 disabled:opacity-60"
                    >
                        {loading ? <Loader2 className="animate-spin" /> : '인증번호 전송'}
                    </button>
                    {back('select')}
                </div>
            )}

            {mode === 'verify' && (
                <div className="space-y-4 animate-fade-in-up">
                    <p className="text-center text-sm text-dim font-medium">
                        전송된 인증번호 6자리를 입력해주세요.
                    </p>
                    <input
                        data-autofocus
                        type="text"
                        /* ★ 이 세 속성이 가입 전환율을 바꾼다.
                             아이폰·안드로이드가 문자에서 인증번호를 읽어 자동으로 채워준다.
                             type="number" 였을 때는 자동완성이 안 뜨고, 스피너까지 붙었다. */
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={6}
                        pattern="[0-9]*"
                        placeholder="000000"
                        value={vCode}
                        onChange={(e) => setVCode(e.target.value.replace(/[^0-9]/g, ''))}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleVerify(); }}
                        className="w-full p-4 bg-card2 rounded-2xl border border-white/10 focus:border-volt outline-none text-center text-3xl font-black tracking-[0.4em] tabular text-txt"
                    />
                    <button
                        onClick={handleVerify}
                        disabled={loading}
                        className="w-full py-4 bg-volt text-ink font-black rounded-2xl flex items-center justify-center transition-transform active:scale-95 disabled:opacity-60"
                    >
                        {loading ? <Loader2 className="animate-spin" /> : '인증 완료'}
                    </button>
                    {back('phone')}
                </div>
            )}

            {mode === 'admin' && (
                <form onSubmit={handleAdminLogin} className="space-y-3 animate-fade-in-up">
                    <input
                        data-autofocus
                        type="text"
                        autoComplete="username"
                        placeholder="아이디"
                        value={adminId}
                        onChange={e => setAdminId(e.target.value)}
                        className={FIELD_CLS}
                    />
                    <input
                        type="password"
                        autoComplete="current-password"
                        placeholder="비밀번호"
                        value={adminPw}
                        onChange={e => setAdminPw(e.target.value)}
                        className={FIELD_CLS}
                    />
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-4 bg-white/10 text-txt font-black rounded-2xl disabled:opacity-60"
                    >
                        {loading ? <Loader2 className="animate-spin mx-auto" /> : '로그인'}
                    </button>
                    {back('select')}
                </form>
            )}

            {mode === 'find' && (
                <div className="space-y-5 animate-fade-in-up">
                    <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-xl bg-volt/15 flex items-center justify-center shrink-0">
                            <KeyRound size={19} className="text-volt" />
                        </div>
                        <div>
                            <h3 className="text-base font-black text-txt kern-tight">계정 찾기</h3>
                            <p className="text-[11px] text-dim font-bold">가입할 때 쓴 방법으로 찾아요</p>
                        </div>
                    </div>

                    {/* 대부분의 사용자는 여기서 끝난다 —
                        카카오·휴대폰 가입에는 애초에 비밀번호가 없다.
                        "다시 로그인하면 그게 곧 계정 찾기"라는 걸 분명히 말해준다. */}
                    <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-4 space-y-3">
                        <p className="text-[11px] font-black label text-volt">가장 흔한 경우</p>
                        <p className="text-[13px] text-dim font-medium leading-relaxed break-keep">
                            <b className="text-txt">카카오</b>나 <b className="text-txt">휴대폰 번호</b>로 가입하셨다면
                            비밀번호가 아예 없습니다. 같은 방법으로 다시 로그인하면
                            <b className="text-volt"> 예전 기록이 그대로 있는 원래 계정</b>으로 들어갑니다.
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={handleKakao}
                                className="flex-1 py-3 bg-[#FEE500] text-[#1a1a1a] font-black rounded-xl text-xs"
                            >
                                카카오로 로그인
                            </button>
                            <button
                                onClick={() => { setMode('phone'); setError(''); }}
                                className="flex-1 py-3 bg-volt text-ink font-black rounded-xl text-xs"
                            >
                                휴대폰으로 로그인
                            </button>
                        </div>
                    </div>

                    <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-4">
                        <p className="text-[11px] font-black label text-dim mb-2">아이디·비밀번호로 가입한 경우</p>
                        {findSent ? (
                            <p className="text-[13px] text-dim font-medium leading-relaxed break-keep">
                                <b className="text-volt">메일을 보냈습니다.</b> 해당 주소로 가입된 계정이 있다면
                                비밀번호 재설정 링크가 도착합니다. 몇 분 지나도 안 오면 스팸함을 확인해주세요.
                            </p>
                        ) : (
                            <form onSubmit={handleReset} className="space-y-2.5">
                                <input
                                    type="email"
                                    autoComplete="email"
                                    placeholder="가입할 때 쓴 이메일"
                                    value={findEmail}
                                    onChange={e => setFindEmail(e.target.value)}
                                    className="w-full p-3 bg-card2 rounded-xl border border-white/10 focus:border-volt outline-none text-sm font-bold text-txt placeholder-muted"
                                />
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full py-3 bg-white/10 text-txt font-black rounded-xl text-xs disabled:opacity-60"
                                >
                                    {loading ? <Loader2 size={16} className="animate-spin mx-auto" /> : '비밀번호 재설정 메일 받기'}
                                </button>
                            </form>
                        )}
                    </div>

                    <div className="rounded-2xl bg-coral/[0.07] border border-coral/25 p-4">
                        <p className="text-[11px] font-black label text-coral mb-1.5">그래도 안 되면</p>
                        <p className="text-[13px] text-dim font-medium leading-relaxed break-keep mb-3">
                            휴대폰 번호가 바뀌었거나 어떤 방법으로 가입했는지 기억나지 않으시면
                            직접 도와드릴게요. 만든 사람이 직접 답합니다.
                        </p>
                        <button
                            onClick={openKakaoChat}
                            className="w-full py-3 bg-coral/15 text-coral font-black rounded-xl text-xs"
                        >
                            카카오톡으로 문의하기
                        </button>
                        <p className="text-[10px] text-muted font-bold mt-2 text-center">{SUPPORT.email}</p>
                    </div>

                    {back('select')}
                </div>
            )}
        </Modal>
    );
}
