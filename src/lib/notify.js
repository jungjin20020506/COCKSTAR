// ===================================================================================
// 알림 — 시스템 알림 + 진동 + 소리 + 알림 기록
// -----------------------------------------------------------------------------------
// 체육관에서 폰은 주머니나 가방 안에 있다. "내 차례"를 화면 배너로만 알리면
// 화면을 보고 있는 사람에게만 닿는다. 그래서 세 겹으로 알린다.
//
//   ① 시스템 알림 — 앱이 뒤(백그라운드 탭·홈 화면)에 있어도 배너가 뜬다.
//      · 안드로이드: 브라우저·설치형 PWA 모두 동작
//      · 아이폰: iOS 16.4+ 에서 '홈 화면에 추가'한 PWA 만 지원 (사파리 탭은 불가)
//        → 그래서 설치 유도(InstallPrompt)가 알림의 선행 조건이기도 하다.
//   ② 진동 — navigator.vibrate (안드로이드). 아이폰 웹은 진동 API 가 없다.
//   ③ 소리 — WebAudio 로 만든 짧은 "띠링". 체육관 소음 대응. 설정에서 끌 수 있다.
//
// ⚠️ 앱을 완전히 종료한 상태까지 알림을 보내려면 서버(FCM 발송)가 필요하다.
//    지금은 서버가 없으므로 '앱이 켜져 있는 동안'(백그라운드 포함)의 알림이다.
//    서버 발송 단계는 docs/OPS.md 에 적어뒀다.
//
// [알림 기록]
//   보낸 알림은 기기에 최근 50개까지 남긴다. 홈의 종 아이콘(알림 센터)이 이 목록을
//   보여준다 — "아까 뭐라고 울렸지?"에 답하는 곳이다.
// ===================================================================================

const LOG_KEY = 'cockstar-noti-log';
const READ_KEY = 'cockstar-noti-read-at';
const SOUND_KEY = 'cockstar-noti-sound';
const LOG_MAX = 50;
const CHANGE_EVENT = 'cockstar-noti-change';

// ── 지원 여부 ──
// 아이폰 사파리(비설치)는 window.Notification 자체가 없다 — 그 환경에서는
// 진동·소리·화면 배너만으로 알리고, 설치를 권한다.
export function notificationsSupported() {
    return typeof window !== 'undefined' && 'Notification' in window;
}

export function notificationPermission() {
    return notificationsSupported() ? Notification.permission : 'unsupported';
}

/** 권한을 요청한다. 반드시 사용자가 버튼을 누른 직후에만 부를 것 (브라우저 규칙) */
export async function requestNotificationPermission() {
    if (!notificationsSupported()) return 'unsupported';
    try {
        const result = await Notification.requestPermission();
        return result;
    } catch {
        // 사파리 구버전은 콜백 방식만 받는다
        return new Promise(resolve => {
            try { Notification.requestPermission(resolve); }
            catch { resolve('denied'); }
        });
    }
}

// ── 소리 설정 ──
export function soundEnabled() {
    try { return localStorage.getItem(SOUND_KEY) !== '0'; }
    catch { return true; }
}
export function setSoundEnabled(on) {
    try { localStorage.setItem(SOUND_KEY, on ? '1' : '0'); } catch { /* noop */ }
    emitChange();
}

// ── 소리 — 파일 없이 WebAudio 로 "띠링" 두 음을 만든다 (용량 0) ──
let audioCtx = null;
export function playChime() {
    if (!soundEnabled()) return;
    try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        if (!audioCtx) audioCtx = new Ctx();
        if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
        const now = audioCtx.currentTime;
        [[880, 0], [1318.5, 0.13]].forEach(([freq, at]) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.0001, now + at);
            gain.gain.exponentialRampToValueAtTime(0.18, now + at + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + at + 0.34);
            osc.connect(gain).connect(audioCtx.destination);
            osc.start(now + at);
            osc.stop(now + at + 0.4);
        });
    } catch { /* 소리를 못 내는 환경이면 그냥 조용히 */ }
}

/** 진동 — 지원 안 하면 아무 일도 없다 */
export function buzz(pattern = [60, 40, 60]) {
    try { navigator.vibrate?.(pattern); } catch { /* noop */ }
}

// ── 알림 기록 ──
export function readNotiLog() {
    try {
        const raw = JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
        return Array.isArray(raw) ? raw : [];
    } catch { return []; }
}
function appendNotiLog(entry) {
    try {
        const next = [entry, ...readNotiLog()].slice(0, LOG_MAX);
        localStorage.setItem(LOG_KEY, JSON.stringify(next));
    } catch { /* noop */ }
    emitChange();
}
export function clearNotiLog() {
    try { localStorage.removeItem(LOG_KEY); } catch { /* noop */ }
    emitChange();
}
export function markNotiRead() {
    try { localStorage.setItem(READ_KEY, String(Date.now())); } catch { /* noop */ }
    emitChange();
}
export function unreadNotiCount() {
    let readAt = 0;
    try { readAt = Number(localStorage.getItem(READ_KEY) || '0'); } catch { /* noop */ }
    return readNotiLog().filter(n => n.ts > readAt).length;
}

// 알림 센터·종 아이콘이 같은 데이터를 보게, 바뀔 때마다 이벤트를 쏜다
function emitChange() {
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}
export const NOTI_CHANGE_EVENT = CHANGE_EVENT;

/**
 * [핵심] 알림을 보낸다 — 시스템 알림 + 진동 + 소리 + 기록, 되는 것 전부.
 *
 * 시스템 알림은 서비스 워커 등록이 있으면 그쪽으로 보낸다(설치형 PWA·백그라운드에서
 * 더 안정적이다). 없으면 new Notification 으로 낸다.
 *
 * @param {object} p
 * @param {string} p.title
 * @param {string} [p.body]
 * @param {string} [p.tag]   같은 tag 는 이전 알림을 갈아치운다 (알림이 쌓이지 않게)
 * @param {Array}  [p.vibrate] 진동 패턴
 * @param {boolean} [p.silent] 소리 없이 (기록·진동만)
 */
export async function notify({ title, body = '', tag, vibrate = [60, 40, 60], silent = false }) {
    appendNotiLog({ ts: Date.now(), title, body });
    buzz(vibrate);
    if (!silent) playChime();

    if (!notificationsSupported() || Notification.permission !== 'granted') return false;

    const options = {
        body,
        tag: tag || 'cockstar',
        renotify: true,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        vibrate,
        silent: false,
    };
    try {
        const reg = await navigator.serviceWorker?.getRegistration?.();
        if (reg?.showNotification) {
            await reg.showNotification(title, options);
            return true;
        }
    } catch { /* 아래 폴백으로 */ }
    try {
        // 폴백 — 서비스 워커가 없는 환경 (일부 브라우저는 이 생성자를 막는다)
        const n = new Notification(title, options);
        n.onclick = () => { try { window.focus(); n.close(); } catch { /* noop */ } };
        return true;
    } catch { return false; }
}
