import React from 'react';
import { Modal } from '../../components/ui/Modal';

// ===================================================================================
// 경기방 만들기 안내 — 처음 만드는 사람에게 딱 한 번
// -----------------------------------------------------------------------------------
// 개설 폼에는 여섯 칸이 있는데, 처음 보면 '정원'과 '입장 급수'가 뭘 하는 값인지
// 알 수 없다. 특히 급수는 "이 값을 낮추면 사람이 안 오나?" 같은 오해가 생긴다.
//
// 그래서 칸마다 '무엇을 적는지'가 아니라 '왜 필요한지'를 적었다.
// 무엇을 적는지는 폼의 placeholder 가 이미 말하고 있다.
// ===================================================================================

const FIELDS = [
    {
        title: '방 제목',
        body: '로비 목록에서 사람들이 보는 첫 줄이에요. 요일·시간·수준을 넣으면 헛걸음이 줄어요.\n예) <b>수요 저녁 8시 · 초심 환영</b>',
    },
    {
        title: '모임 장소',
        body: '주소를 검색해서 넣으면 <b>좌표가 함께 저장</b>돼요. 이게 있어야 콕맵 지도에 핀이 찍히고, “가까운 순”으로 찾는 사람에게 보입니다. 주소 없이 만든 방은 지도에서 사라져요.',
    },
    {
        title: '소개',
        body: '어떤 분위기인지 한두 줄이면 충분해요. 실전 위주인지, 초심자를 챙기는지에 따라 오는 사람이 달라집니다.',
    },
    {
        title: '입장 급수',
        body: '이 급수 <b>이상</b>만 들어올 수 있어요. 실력 차가 너무 나면 양쪽 다 재미없어서 두는 장치입니다.\n대부분은 <b>전체 급수</b>로 두는 게 좋아요 — 처음부터 좁히면 사람이 안 모입니다.',
    },
    {
        title: '정원',
        body: '코트 수에 비해 사람이 너무 많으면 앉아 있는 시간이 길어져요. 코트 1면당 <b>8~10명</b>이 보통입니다.',
    },
    {
        title: '비밀번호',
        body: '아는 사람만 들어오게 할 때 켜세요. 링크를 아무 데나 공유해도 안전합니다.\n안 걸면 누구나 들어올 수 있어요 — 공개 정모라면 그게 낫습니다.',
    },
];

export function CreateRoomGuide({ open, onComplete }) {
    return (
        <Modal
            open={open}
            onClose={onComplete}
            title="경기방 만들기"
            subtitle="처음 한 번만 안내해요 · 30초"
            size="max-w-md"
            zIndex="z-[150]"
            footer={(
                <button
                    onClick={onComplete}
                    data-autofocus
                    className="w-full py-4 bg-volt text-ink font-black rounded-full text-base shadow-volt active:scale-[0.98] transition-transform"
                >
                    알겠어요, 만들러 갈게요
                </button>
            )}
        >
            <p className="text-sm text-dim font-medium leading-relaxed mb-5 break-keep">
                방을 하나 열면 그날 운동의 <b className="text-volt">중심</b>이 됩니다.
                들어온 사람이 대기 명단에 오르고, 매칭도 경기 기록도 전부 이 방 안에서 돌아가요.
            </p>

            <div className="tg-list">
                {FIELDS.map((f, i) => (
                    <div key={f.title} className="tg-item">
                        <span className="tg-num">{i + 1}</span>
                        <div className="min-w-0">
                            <h4>{f.title}</h4>
                            <p dangerouslySetInnerHTML={{ __html: f.body.replace(/\n/g, '<br/>') }} />
                        </div>
                    </div>
                ))}
            </div>

            <div className="tg-note">
                <b>만들고 나면</b> 자동으로 그 방의 관리자가 됩니다.
                선수를 배치하고 경기를 시작·종료하는 안내가 방 안에서 한 번 더 나와요.
            </div>
        </Modal>
    );
}
