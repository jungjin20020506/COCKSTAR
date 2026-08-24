// ===================================================================================
// 카카오톡 공유 — 초대 링크를 '카드'로 보낸다
// -----------------------------------------------------------------------------------
// 초대 링크는 이 앱의 사실상 유일한 유입 경로인데, 지금까지는 맨 주소 한 줄을
// 복사해 보내는 게 전부였다. 카톡 SDK 는 이미 index.html 에서 불러오고 있었는데
// 초기화(Kakao.init)를 안 해서 한 번도 쓰인 적이 없다.
//
// 카드로 보내면 방 이름·장소·인원이 미리보기로 박혀서 누르는 사람이 확 는다.
//
// [실패에 관대해야 한다]
//   SDK 가 안 왔거나(네트워크), 도메인이 카카오 개발자 콘솔에 등록돼 있지 않으면
//   공유가 실패한다. 그럴 때 조용히 죽는 대신 false 를 돌려줘서, 부르는 쪽이
//   링크 복사로 넘어갈 수 있게 한다.
// ===================================================================================

// 지도 SDK 와 같은 JavaScript 키를 쓴다 (같은 카카오 앱이다)
const KAKAO_JS_KEY = '4bebedd2921e9ecf2412417b5b35762e';

function ready() {
    const K = window.Kakao;
    if (!K) return null;
    try {
        if (!K.isInitialized()) K.init(KAKAO_JS_KEY);
        return K;
    } catch {
        return null;
    }
}

/** 카카오톡 카드 공유가 가능한 환경인가 */
export function canKakaoShare() {
    return !!ready()?.Share;
}

/**
 * 경기방 초대 카드를 보낸다.
 * @returns {boolean} 시도조차 못 했으면 false (부르는 쪽이 복사로 폴백)
 */
export function shareRoomToKakao(room, url) {
    const K = ready();
    if (!K?.Share) return false;
    try {
        const parts = [
            room.location,
            `참가 ${room.playerCount || 0}${room.maxPlayers ? `/${room.maxPlayers}` : ''}명`,
            room.levelLimit && room.levelLimit !== 'N조' ? `${room.levelLimit} 이상` : null,
        ].filter(Boolean);

        K.Share.sendDefault({
            objectType: 'text',
            text: `🏸 '${room.name}' 경기방에 초대합니다!\n${parts.join(' · ')}`,
            link: { webUrl: url, mobileWebUrl: url },
            buttonTitle: '경기방 입장하기',
        });
        return true;
    } catch {
        // 도메인 미등록 등 — 부르는 쪽이 복사로 넘어간다
        return false;
    }
}
