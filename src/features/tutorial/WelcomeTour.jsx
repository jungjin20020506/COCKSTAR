import React, { useState, useEffect, useRef } from 'react';
import { CockstarMark } from '../../components/ui/Logo';
import { SUPPORT } from '../../constants';
import { PRODUCTS } from '../../lib/products';
import { GYM_COUNT } from '../../lib/places';

// ===================================================================================
// 환영 투어 — 가입하면 딱 한 번, 끝까지 본다
// -----------------------------------------------------------------------------------
// [왜 스킵 버튼이 없나]
//   콕스타는 '경기방에 들어가서 매칭을 받는다'는, 처음 보면 알 수 없는 구조를 가진
//   앱이다. 스킵할 수 있게 두면 90%가 스킵하고, 그 90%는 홈 화면만 보다가 나간다.
//   대신 짧게 만들었다 — 아홉 장, 45초. 길면 스킵이 없는 게 폭력이 된다.
//
// [왜 개발자 인사로 시작하나]
//   개인이 만든 앱이라는 걸 먼저 밝히면 사용자의 기대치가 달라진다.
//   버그가 있어도 "이 회사 뭐야"가 아니라 "알려줘야겠다"가 된다.
//   실제로 문의 창구를 마지막에 배치한 것도 같은 흐름이다.
//
// [기록]
//   users/{uid}.tutorialSeen[WELCOME_TOUR_KEY] + localStorage.
//   기존 사용자에게도 한 번은 보여주려고 새 키(-v1)를 썼다.
//   앱이 크게 바뀌면 키의 버전을 올린다 (guideKeys.js 참고).
// ===================================================================================

const DEAL_MAX = Math.max(0, ...PRODUCTS.map(p => p.discountRate));

// ── 각 장의 그림 (이미지 파일 없이 CSS/SVG 로 그린다 — 로딩이 없다) ──

function ArtGreeting() {
    return (
        <div className="wt-art">
            <div className="wt-greet-badge">
                <CockstarMark size={54} plate className="rounded-2xl" />
            </div>
            <div className="wt-greet-wave">👋</div>
        </div>
    );
}

function ArtCourt() {
    return (
        <div className="wt-art">
            <div className="wt-court">
                <span className="wt-court-net" />
                {['A', 'B', 'C', 'D'].map((k, i) => (
                    <span key={k} className={`wt-court-dot d${i}`} />
                ))}
                <span className="wt-shuttle">🏸</span>
            </div>
        </div>
    );
}

function ArtEngine() {
    return (
        <div className="wt-art">
            <div className="wt-engine">
                <div className="wt-engine-brain">🤖</div>
                <div className="wt-engine-cards">
                    {['best', 'best', 'normal'].map((t, i) => (
                        <span key={i} className={`wt-engine-card ${t}`} style={{ animationDelay: `${i * 0.18}s` }} />
                    ))}
                </div>
            </div>
        </div>
    );
}

function ArtBell() {
    return (
        <div className="wt-art">
            <div
                className="animate-volt-pulse"
                style={{
                    width: 96, height: 96, borderRadius: 28,
                    background: 'rgba(205,251,71,.14)', border: '1px solid rgba(205,251,71,.4)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
            >
                <span style={{ fontSize: 44, lineHeight: 1 }}>🔔</span>
            </div>
        </div>
    );
}

function ArtMap() {
    return (
        <div className="wt-art">
            <div className="wt-map">
                {[[22, 30], [58, 18], [74, 52], [34, 66], [50, 42]].map(([x, y], i) => (
                    <span key={i} className="wt-pin" style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${i * 0.15}s` }} />
                ))}
            </div>
        </div>
    );
}

function ArtBrag() {
    return (
        <div className="wt-art">
            <div className="wt-brag">
                <span className="wt-brag-kicker">TODAY RECORD</span>
                <span className="wt-brag-num">12</span>
                <span className="wt-brag-unit">오늘 친 경기</span>
                <div className="wt-brag-tiles">
                    <span>1위</span><span>18명</span><span>144분</span>
                </div>
            </div>
        </div>
    );
}

function ArtStore() {
    return (
        <div className="wt-art">
            <div className="wt-store">
                <span className="wt-store-tag">-{DEAL_MAX}%</span>
                <span className="wt-store-bag">🛍️</span>
            </div>
        </div>
    );
}

function ArtSupport() {
    return (
        <div className="wt-art">
            <div className="wt-support">
                <span className="wt-support-bubble left">앱이 이상해요</span>
                <span className="wt-support-bubble right">바로 고칠게요!</span>
            </div>
        </div>
    );
}

function ArtGo() {
    return (
        <div className="wt-art">
            <div className="wt-go">🏸</div>
        </div>
    );
}

// ── 장면 ──
const SLIDES = [
    {
        art: ArtGreeting,
        kicker: 'HELLO',
        title: `안녕하세요,\n콕스타 개발자 ${SUPPORT.developerName}입니다`,
        body: `제가 배드민턴을 치면서 제일 답답했던 건 “오늘 누구랑 몇 번 쳤는지”를 아무도 모른다는 거였어요.\n\n총무님은 종이에 적고, 저는 계속 같은 사람이랑만 치고, 어떤 분은 한 시간째 앉아만 계시고요.\n\n그래서 직접 만들었습니다. 코드 한 줄까지 전부요.`,
        cta: '어떤 앱인지 볼게요',
    },
    {
        art: ArtCourt,
        kicker: 'STEP 1',
        title: '경기방에 들어가면\n대기 명단에 올라가요',
        body: '동호회 운동을 시작할 때 방을 하나 열어요.\n들어온 사람은 자동으로 대기 명단에 오르고,\n관리자가 여기서 다음 경기를 짭니다.\n\n누가 몇 경기 쳤는지 화면에 계속 보여요.',
        cta: '다음',
    },
    {
        art: ArtEngine,
        kicker: 'STEP 2',
        title: '자동 매칭이\n조합을 골라줍니다',
        body: '이게 콕스타의 심장이에요. 버튼 하나를 누르면\n엔진이 후보 6개를 이유와 함께 보여줍니다.\n\n· 오늘 아직 안 만난 사람끼리 붙여주고\n· 방금 같이 친 사람은 피하고\n· 오래 기다린 사람을 먼저 넣고\n· 급수가 너무 벌어지지 않게 맞춰요\n\n앱이 혼자 정하지 않아요. 고르는 건 사람입니다.',
        cta: '다음',
    },
    {
        art: ArtBell,
        kicker: 'STEP 3',
        title: '내 차례는\n앱이 알려드려요',
        body: '경기방 화면 맨 위에 내 상태가 한 줄로 떠요.\n"다음 경기는 나!" · "약 10~20분 뒤 예상" 처럼요.\n\n알림을 켜두면 내 경기가 잡히는 순간\n진동과 "띠링" 소리로 알려드립니다.\n폰을 주머니에 넣고 수다 떨어도 돼요.\n\n지난 알림은 홈의 종(🔔) 아이콘에서 다시 봅니다.',
        cta: '다음',
    },
    {
        art: ArtMap,
        kicker: 'STEP 4',
        title: '콕맵에서\n칠 곳을 찾아요',
        body: `경기도 체육관 ${GYM_COUNT.toLocaleString()}곳과 동호회를 지도에 담았어요.\n내 주변에 어디서 칠 수 있는지, 지금 열린 경기방은 어디인지 한눈에 봅니다.`,
        cta: '다음',
    },
    {
        art: ArtBrag,
        kicker: 'STEP 5',
        title: '오늘 기록,\n자랑해도 됩니다',
        body: '운동이 끝나면 오늘의 기록 카드를 만들 수 있어요.\n몇 경기 쳤는지, 방에서 몇 등인지, 몇 명과 랠리했는지.\n\n인스타 스토리 크기 그대로라 바로 올릴 수 있어요.',
        cta: '다음',
    },
    {
        art: ArtStore,
        kicker: 'STEP 6',
        title: '장비는\n스토어에서',
        body: `공식 파트너 노에러의 실제 상품 ${PRODUCTS.length}종을 담았어요.\n라켓·신발·의류·셔틀콕까지, 최대 ${DEAL_MAX}% 할인 상품도 있습니다.`,
        cta: '다음',
    },
    {
        art: ArtSupport,
        kicker: 'STEP 7',
        title: '이상하면\n바로 말해주세요',
        body: '혼자 만들다 보니 제가 못 본 게 분명히 있어요.\n\n내 정보 화면에 “문의·버그 신고”가 있습니다.\n카카오톡 오픈채팅으로 바로 말 걸어도 되고,\n메일로 길게 써주셔도 됩니다.\n\n진짜로 다 읽고, 진짜로 고칩니다.',
        cta: '다음',
    },
    {
        art: ArtGo,
        kicker: 'READY',
        title: '준비 끝!\n코트에서 만나요',
        body: '이제 경기 탭에서 방을 찾거나, 직접 하나 만들어보세요.\n방을 처음 만들 때도 안내가 한 번 더 나옵니다.\n\n즐겁게 치세요. 그게 전부예요. 🏸',
        cta: '콕스타 시작하기',
    },
];

export function WelcomeTour({ userName, onComplete }) {
    const [i, setI] = useState(0);
    const bodyRef = useRef(null);
    const last = i === SLIDES.length - 1;
    const slide = SLIDES[i];
    const Art = slide.art;

    // 장이 바뀌면 본문을 맨 위로 (긴 장 뒤에 짧은 장이 오면 중간부터 보인다)
    useEffect(() => { bodyRef.current?.scrollTo?.({ top: 0 }); }, [i]);

    // 뒤로가기로 앱이 꺼지는 걸 막는다 — 투어 중에는 뒤로가기가 '이전 장'이다
    useEffect(() => {
        window.history.pushState({ tour: true }, '');
        const onPop = () => {
            setI(v => Math.max(0, v - 1));
            window.history.pushState({ tour: true }, '');
        };
        window.addEventListener('popstate', onPop);
        return () => window.removeEventListener('popstate', onPop);
    }, []);

    const title = i === 0 && userName
        ? slide.title.replace('안녕하세요,', `${userName}님, 안녕하세요.`)
        : slide.title;

    return (
        <div className="wt-wrap" role="dialog" aria-modal="true" aria-label="콕스타 사용 안내">
            <div className="wt-sheet">
                {/* 진행 막대 — 몇 장 남았는지 보이면 스킵 버튼이 덜 아쉽다 */}
                <div className="wt-progress" aria-hidden="true">
                    {SLIDES.map((_, k) => (
                        <span key={k} className={`wt-progress-seg ${k <= i ? 'on' : ''}`} />
                    ))}
                </div>

                <div className="wt-body" ref={bodyRef}>
                    <Art />
                    <span className="wt-kicker">{slide.kicker}</span>
                    <h2 className="wt-title">{title}</h2>
                    <p className="wt-text">{slide.body}</p>

                    {i === 0 && (
                        <div className="wt-sign">
                            <CockstarMark size={20} className="text-volt" />
                            <span>만든 사람 · {SUPPORT.developerName}</span>
                        </div>
                    )}
                </div>

                <div className="wt-foot">
                    <div className="wt-foot-row">
                        {i > 0 && (
                            <button
                                type="button"
                                className="wt-back"
                                onClick={() => setI(v => v - 1)}
                                aria-label="이전 화면"
                            >
                                이전
                            </button>
                        )}
                        <button
                            type="button"
                            className="wt-next"
                            onClick={() => (last ? onComplete() : setI(v => v + 1))}
                        >
                            {slide.cta}
                        </button>
                    </div>
                    <p className="wt-count">{i + 1} / {SLIDES.length}</p>
                </div>
            </div>
        </div>
    );
}
