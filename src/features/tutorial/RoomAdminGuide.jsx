import React, { useState } from 'react';
import { Modal } from '../../components/ui/Modal';

// ===================================================================================
// 방 관리자 안내 — 어떤 방이든 '관리자로서 처음' 들어왔을 때 한 번
// -----------------------------------------------------------------------------------
// 관리자는 이 앱에서 가장 많은 버튼을 쥔 사람인데, 그 버튼들이 어디 있는지 알려주는
// 곳이 없었다. 특히 아래 셋은 아무도 스스로 찾지 못한다.
//   · 선수 카드를 길게 누르면 경기 수를 고칠 수 있다
//   · 대기 명단에서 선수를 눌러 관리자로 임명할 수 있다
//   · 운영만 하고 경기는 안 뛰는 '유령 모드'가 있다
//
// 자동매칭 자체는 따로 게임형 안내(AutoMatchGuide)가 맡는다. 여기서는 겹치지 않게
// "그건 따로 나와요" 정도만 언급하고, 나머지 운영 전반을 다룬다.
//
// 세 장으로 나눈 이유: 한 번에 열두 항목을 늘어놓으면 아무도 안 읽는다.
// ===================================================================================

const PAGES = [
    {
        kicker: '기본 흐름',
        title: '경기 한 판이 도는 순서',
        items: [
            { h: '① 대기 명단', p: '방에 들어온 사람이 여기 모여요. 남녀가 나뉘어 보이고, 카드 오른쪽 아래 숫자가 <b>오늘 친 경기 수</b>예요.' },
            { h: '② 선수 배치', p: '대기 명단에서 선수를 <b>탭해서 고르고</b>, 아래 “경기 배정”의 빈칸을 누르면 들어갑니다. 여러 명을 고른 뒤 한 번에 넣을 수도 있어요.' },
            { h: '③ 경기 시작', p: '4명이 다 차면 <b>경기 시작</b>이 켜져요. 빈 코트가 여러 개면 어느 코트인지 물어봅니다.' },
            { h: '④ 경기 종료', p: '“경기 진행” 탭에서 <b>경기 종료</b>를 누르면 4명 모두 경기 수가 1 오르고 기록이 남아요.\n잘못 눌렀다면 <b>되돌리기</b>가 몇 초간 떠요.' },
        ],
    },
    {
        kicker: '자동 매칭 · 설정',
        title: '손으로 안 짜도 됩니다',
        items: [
            { h: '🤖 자동 매칭', p: '버튼을 누르면 후보 6개를 <b>이유와 함께</b> 보여줘요. 마음에 드는 걸 고르면 목록에 들어갑니다.\n자세한 사용법은 이 안내가 끝나면 <b>직접 해보는 연습</b>이 한 번 더 나와요.' },
            { h: '⚙️ 코트 수 · 경기 예정 수', p: '오른쪽 위 설정에서 바꿔요. 코트 수는 <b>실제 빌린 코트 면 수</b>와 맞추세요. 안 맞으면 있지도 않은 코트에 경기가 들어갑니다.' },
            { h: '민감도', p: '“경기 중인 선수를 얼마나 미리 예약할지”를 정해요.\n낮음 = 바로 시작 가능한 조합만 · 높음 = 덜 친 사람을 챙기지만 코트가 끝나길 기다려요.' },
            { h: '👻 운영만 하기', p: '코치·총무처럼 <b>경기는 안 뛰고 운영만</b> 할 때 켜세요. 설정에 있어요. 켜면 대기 명단·인원 수·매칭 후보에서 완전히 빠집니다.' },
        ],
    },
    {
        kicker: '숨은 기능',
        title: '이건 알려주지 않으면 못 찾아요',
        items: [
            { h: '선수 카드 꾹 누르기', p: '경기 수를 손으로 고칠 수 있어요. 오늘 함께 친 사람 목록도 여기서 봅니다.\n(늦게 합류한 사람의 경기 수를 맞춰줄 때 씁니다)' },
            { h: '공동 관리자 임명', p: '대기 명단의 선수를 눌러 <b>관리자로 임명</b>할 수 있어요. 코드를 주고받을 필요 없습니다.\n방에 아직 없는 사람은 <b>초대 코드·링크</b>를 보내세요 (설정 ▸ 관리자 관리).' },
            { h: '경기 번호 꾹 누르기', p: '자동 매칭 목록에서 경기 번호를 길게 누르면 그 경기가 삭제돼요.' },
            { h: '📸 하루 요약 카드', p: '운동이 끝나면 설정에서 오늘의 참석부를 이미지로 만들어 단톡방에 보낼 수 있어요.\n선수들은 각자 <b>자기 기록 카드</b>를 만들어 인스타에 올릴 수 있습니다.' },
            { h: '방 나가도 괜찮아요', p: '관리자가 잠깐 나가도 경기는 그대로예요. 다만 <b>예약 정리</b>는 관리자 화면이 켜져 있을 때 돌아가니, 운영 중에는 켜두는 게 좋아요.' },
        ],
    },
];

export function RoomAdminGuide({ open, onComplete }) {
    const [page, setPage] = useState(0);
    const last = page === PAGES.length - 1;
    const p = PAGES[page];

    return (
        <Modal
            open={open}
            onClose={onComplete}
            title={p.title}
            subtitle={`관리자 안내 · ${page + 1}/${PAGES.length}`}
            size="max-w-md"
            zIndex="z-[150]"
            dismissable={false}
            footer={(
                <div className="flex gap-2">
                    {page > 0 && (
                        <button
                            onClick={() => setPage(v => v - 1)}
                            className="px-6 py-4 bg-white/5 text-dim font-black rounded-full text-sm active:scale-95 transition-transform"
                        >
                            이전
                        </button>
                    )}
                    <button
                        data-autofocus
                        onClick={() => (last ? onComplete() : setPage(v => v + 1))}
                        className="flex-1 py-4 bg-volt text-ink font-black rounded-full text-base shadow-volt active:scale-[0.98] transition-transform"
                    >
                        {last ? '시작할게요' : '다음'}
                    </button>
                </div>
            )}
        >
            <span className="text-[11px] font-black label text-volt block mb-4">👑 {p.kicker}</span>

            <div className="tg-list">
                {p.items.map((it, i) => (
                    <div key={it.h} className="tg-item">
                        <span className="tg-num">{i + 1}</span>
                        <div className="min-w-0">
                            <h4>{it.h}</h4>
                            <p dangerouslySetInnerHTML={{ __html: it.p.replace(/\n/g, '<br/>') }} />
                        </div>
                    </div>
                ))}
            </div>

            {last && (
                <div className="tg-note">
                    이 안내는 <b>방 설정 ▸ 안내 다시 보기</b>에서 언제든 다시 열 수 있어요.
                </div>
            )}
        </Modal>
    );
}
