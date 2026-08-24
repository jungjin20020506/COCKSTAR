// ===================================================================================
// 카카오 주소 검색 + 좌표 변환
// -----------------------------------------------------------------------------------
// 방 만들기와 방 정보 수정 두 곳에서 똑같은 40줄을 복사해 쓰고 있었다.
// 한쪽만 고치면 다른 쪽이 조용히 달라지는 종류의 중복이라 여기로 합쳤다.
//
// SDK 는 index.html 에서 불러온다. 도메인이 등록돼 있지 않거나 네트워크가 막히면
// 아예 없을 수 있어서, 모든 함수가 '없을 때'를 먼저 확인한다.
// ===================================================================================

/** 주소 검색 팝업을 띄우고, 고른 주소의 좌표까지 구해서 돌려준다 */
export function searchAddress() {
    return new Promise((resolve, reject) => {
        if (!window.daum?.Postcode) {
            reject(new Error('주소 검색 서비스를 불러오지 못했습니다. 새로고침 후 다시 시도해주세요.'));
            return;
        }

        new window.daum.Postcode({
            oncomplete: (data) => {
                const address = data.roadAddress || data.jibunAddress;
                const buildingName = data.buildingName || '';

                if (!window.kakao?.maps) {
                    // 주소는 얻었지만 좌표를 못 구한 상태 — 부르는 쪽이 판단하게 그대로 넘긴다
                    resolve({ address, buildingName, coords: null });
                    return;
                }

                window.kakao.maps.load(() => {
                    if (!window.kakao.maps.services) {
                        resolve({ address, buildingName, coords: null });
                        return;
                    }
                    const geocoder = new window.kakao.maps.services.Geocoder();
                    geocoder.addressSearch(address, (result, status) => {
                        if (status === window.kakao.maps.services.Status.OK && result[0]) {
                            resolve({
                                address,
                                buildingName,
                                coords: { lat: parseFloat(result[0].y), lng: parseFloat(result[0].x) },
                            });
                        } else {
                            resolve({ address, buildingName, coords: null });
                        }
                    });
                });
            },
            onclose: (state) => {
                // 사용자가 그냥 닫은 경우 — 오류가 아니므로 조용히 끝낸다
                if (state === 'FORCE_CLOSE') reject(new Error('CANCELLED'));
            },
        }).open();
    });
}

/** 지도 SDK 가 쓸 수 있는 상태인가 */
export function isKakaoMapReady() {
    return !!window.kakao?.maps;
}
