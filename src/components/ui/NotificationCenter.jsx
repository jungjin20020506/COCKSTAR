import React, { useEffect, useState, useCallback } from 'react';
import { Modal } from './Modal';
import { Bell, CheckCircle } from './icons';
import {
    readNotiLog, clearNotiLog, markNotiRead, unreadNotiCount,
    notificationsSupported, notificationPermission, requestNotificationPermission,
    soundEnabled, setSoundEnabled, notify, NOTI_CHANGE_EVENT,
} from '../../lib/notify';
import { isIOS, isStandalone } from './InstallPrompt';
import { toast } from '../../lib/toast';

// ===================================================================================
// 알림 센터 — 홈의 종 아이콘이 여는 화면
// -----------------------------------------------------------------------------------
// 지금까지 종 아이콘은 "준비 중입니다"만 말했다. 이제 세 가지를 한다.
//   ① 지난 알림 목록 — "아까 뭐라고 울렸지?"
//   ② 알림 권한 켜기 — 브라우저 권한 창은 버튼을 누른 직후에만 띄울 수 있다
//   ③ 소리 on/off — 체육관 소음 대응용 "띠링"의 스위치
//
// 아이폰(비설치 사파리)은 시스템 알림 자체가 안 된다. 그 경우 숨기지 않고
// "홈 화면에 추가하면 알림을 받을 수 있어요"로 설치를 권한다 — 이게 진실이다.
// ===================================================================================

/** 종 아이콘 + 안 읽은 알림 점 (HomeHeader 가 쓴다) */
export function useNotiBadge() {
    const [unread, setUnread] = useState(() => unreadNotiCount());
    useEffect(() => {
        const update = () => setUnread(unreadNotiCount());
        window.addEventListener(NOTI_CHANGE_EVENT, update);
        return () => window.removeEventListener(NOTI_CHANGE_EVENT, update);
    }, []);
    return unread;
}

function timeLabel(ts) {
    const diff = Date.now() - ts;
    if (diff < 60000) return '방금';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}분 전`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}시간 전`;
    return new Date(ts).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

export function NotificationCenter({ isOpen, onClose, onNeedInstall }) {
    const [items, setItems] = useState([]);
    const [perm, setPerm] = useState(() => notificationPermission());
    const [sound, setSound] = useState(() => soundEnabled());

    useEffect(() => {
        if (!isOpen) return;
        setItems(readNotiLog());
        setPerm(notificationPermission());
        setSound(soundEnabled());
        markNotiRead();
    }, [isOpen]);

    const handleEnable = useCallback(async () => {
        // 아이폰 사파리(비설치)는 권한 요청 자체가 불가능 — 설치 안내로 보낸다
        if (!notificationsSupported()) {
            if (isIOS() && !isStandalone()) { onNeedInstall?.(); return; }
            toast.error('이 브라우저는 시스템 알림을 지원하지 않아요.');
            return;
        }
        const result = await requestNotificationPermission();
        setPerm(result);
        if (result === 'granted') {
            notify({ title: '알림이 켜졌습니다 🔔', body: '내 경기가 잡히면 이렇게 알려드릴게요.', tag: 'noti-test' });
            setItems(readNotiLog());
        } else if (result === 'denied') {
            toast.error('알림이 차단됐어요. 브라우저 설정에서 허용해주세요.');
        }
    }, [onNeedInstall]);

    const permBox = (() => {
        if (perm === 'granted') {
            return (
                <div className="flex items-center gap-2.5 p-3.5 rounded-2xl bg-volt/10 border border-volt/25">
                    <CheckCircle size={17} className="text-volt shrink-0" />
                    <p className="text-[12px] font-black text-txt">
                        시스템 알림 켜짐 — 내 경기가 잡히면 알려드려요
                    </p>
                </div>
            );
        }
        const iosNoInstall = !notificationsSupported() && isIOS() && !isStandalone();
        return (
            <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/[0.08]">
                <p className="text-[13px] font-black text-txt">
                    {iosNoInstall ? '아이폰은 앱 설치 후 알림을 받을 수 있어요' : '알림을 켜면 경기가 잡히는 순간 알려드려요'}
                </p>
                <p className="text-[11px] text-muted font-medium mt-1 break-keep">
                    {iosNoInstall
                        ? '공유 버튼 → 홈 화면에 추가 후, 앱에서 이 버튼을 다시 누르세요.'
                        : '"다음 경기는 나!", "3번 코트로 입장하세요" 를 배너·진동으로 받아요.'}
                </p>
                <button
                    onClick={handleEnable}
                    className="mt-3 w-full py-3 bg-volt text-ink font-black rounded-full text-[13px] active:scale-[0.98] transition-transform"
                >
                    {iosNoInstall ? '설치 방법 보기' : perm === 'denied' ? '차단됨 — 다시 시도' : '알림 켜기'}
                </button>
            </div>
        );
    })();

    return (
        <Modal
            open={isOpen}
            onClose={onClose}
            title="알림"
            subtitle="내 경기 소식과 지난 알림"
            size="max-w-md"
        >
            <div className="space-y-4">
                {permBox}

                {/* 소리 스위치 */}
                <button
                    onClick={() => { const next = !sound; setSound(next); setSoundEnabled(next); }}
                    className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-white/[0.04] border border-white/[0.08]"
                    aria-pressed={sound}
                >
                    <div className="text-left">
                        <p className="text-[13px] font-black text-txt">알림 소리 "띠링"</p>
                        <p className="text-[11px] text-muted font-medium mt-0.5">체육관이 시끄러우면 진동만으로는 못 느껴요</p>
                    </div>
                    <span className={`w-11 h-6 rounded-full relative transition-colors shrink-0 ${sound ? 'bg-volt' : 'bg-white/15'}`}>
                        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-ink transition-all ${sound ? 'left-[22px]' : 'left-0.5'}`} />
                    </span>
                </button>

                {/* 지난 알림 */}
                <div>
                    <div className="flex items-center justify-between mb-2 px-1">
                        <h3 className="text-[11px] font-black label text-dim">지난 알림</h3>
                        {items.length > 0 && (
                            <button
                                onClick={() => { clearNotiLog(); setItems([]); }}
                                className="text-[11px] font-bold text-muted"
                            >
                                모두 지우기
                            </button>
                        )}
                    </div>
                    {items.length === 0 ? (
                        <div className="text-center py-10">
                            <Bell size={26} className="text-muted mx-auto mb-3" />
                            <p className="text-sm text-dim font-bold">아직 받은 알림이 없어요</p>
                            <p className="text-[11px] text-muted font-medium mt-1">경기방에서 내 경기가 잡히면 여기에 쌓입니다.</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {items.map((n, i) => (
                                <div key={`${n.ts}-${i}`} className="p-3.5 rounded-2xl bg-card border border-white/[0.06]">
                                    <div className="flex items-baseline justify-between gap-2">
                                        <p className="text-[13px] font-black text-txt break-keep">{n.title}</p>
                                        <span className="text-[10px] font-bold text-muted shrink-0 tabular">{timeLabel(n.ts)}</span>
                                    </div>
                                    {n.body && <p className="text-[11px] text-dim font-medium mt-0.5 break-keep">{n.body}</p>}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    );
}
