import { useEffect, useState } from 'react';

/**
 * 지금 인터넷에 연결돼 있는지.
 *
 * navigator.onLine 은 "랜선이 꽂혀 있는가"에 가까워서 완벽하진 않지만,
 * 체육관에서 흔한 '와이파이는 잡혔는데 인터넷은 안 되는' 경우 외에는 잘 맞는다.
 */
export function useOnline() {
    const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
    useEffect(() => {
        const up = () => setOnline(true);
        const down = () => setOnline(false);
        window.addEventListener('online', up);
        window.addEventListener('offline', down);
        return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
    }, []);
    return online;
}
