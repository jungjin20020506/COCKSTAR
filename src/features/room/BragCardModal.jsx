import React, { useEffect, useRef, useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import { THEMES, drawBragCard, shareBragCard, bragShareText } from '../../lib/bragCard';
import { toast } from '../../lib/toast';
import { logError } from '../../lib/errorLog';
import { Instagram, Download, Loader2, Copy } from '../../components/ui/icons';

// ===================================================================================
// 자랑 카드 — 미리 보고, 테마를 고르고, 올린다
// -----------------------------------------------------------------------------------
// [왜 미리보기가 필요한가]
//   공유 시트로 곧바로 넘기면 사용자는 자기가 뭘 올리는지 모르고 올린다. 한 번 보고
//   "오, 이거 괜찮네"가 되어야 실제로 인스타에 올린다. 이 창의 목적은 그 순간이다.
//
// [왜 테마가 3개인가]
//   같은 그림이 두 번째부터는 안 올라간다. 고를 수 있으면 '내가 만든 것'이 된다.
//
// [인스타그램으로 바로 못 보내나]
//   웹에서 인스타 스토리로 직접 올리는 공개 API 가 없다. 그래서 폰의 공유 시트를
//   띄우고, 거기서 인스타그램을 고르면 스토리 편집기로 넘어간다. 이게 실제로 되는
//   유일한 길이라, 버튼 문구도 그 흐름 그대로 적었다.
// ===================================================================================

export function BragCardModal({ isOpen, onClose, stat }) {
    const [themeKey, setThemeKey] = useState(THEMES[0].key);
    const [busy, setBusy] = useState(false);
    const canvasRef = useRef(null);

    const theme = THEMES.find(t => t.key === themeKey) || THEMES[0];

    // 창이 열리거나 테마가 바뀌면 다시 그린다.
    // 폰트가 아직 안 왔으면 기본 폰트로 그려지므로, 폰트 준비를 기다렸다가 한 번 더 그린다.
    useEffect(() => {
        if (!isOpen || !stat || !canvasRef.current) return undefined;
        let alive = true;
        const paint = () => {
            if (!alive || !canvasRef.current) return;
            try { drawBragCard(canvasRef.current, stat, theme); }
            catch (e) { logError('자랑 카드 미리보기', e); }
        };
        paint();
        document.fonts?.ready?.then(() => { if (alive) paint(); }).catch(() => {});
        return () => { alive = false; };
    }, [isOpen, stat, theme]);

    if (!stat) return null;

    const handleShare = async () => {
        if (busy) return;
        setBusy(true);
        try {
            const how = await shareBragCard(stat, theme);
            toast(how === 'shared'
                ? '공유 시트를 열었어요. 인스타그램을 고르면 스토리로 넘어갑니다.'
                : '사진으로 저장했어요. 인스타그램에서 갤러리로 불러오세요.');
        } catch (e) {
            logError('자랑 카드 공유', e);
            toast.error('카드를 만들지 못했습니다.');
        } finally { setBusy(false); }
    };

    const copyText = async () => {
        try {
            await navigator.clipboard.writeText(bragShareText(stat));
            toast('문구를 복사했어요. 게시물에 붙여넣으세요.');
        } catch {
            toast.error('복사에 실패했습니다.');
        }
    };

    const empty = stat.games === 0;

    return (
        <Modal
            open={isOpen}
            onClose={onClose}
            title="오늘의 기록"
            subtitle="인스타 스토리 크기 그대로예요"
            size="max-w-sm"
            zIndex="z-[130]"
            footer={(
                <div className="space-y-2">
                    <button
                        onClick={handleShare}
                        disabled={busy || empty}
                        className="w-full py-4 bg-volt text-ink font-black rounded-full text-base shadow-volt flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-50"
                    >
                        {busy
                            ? <Loader2 size={18} className="animate-spin" />
                            : <><Instagram size={18} /> 스토리에 올리기</>}
                    </button>
                    <div className="flex gap-2">
                        <button
                            onClick={copyText}
                            disabled={empty}
                            className="flex-1 py-3 bg-white/5 text-dim font-black rounded-full text-xs flex items-center justify-center gap-1.5 disabled:opacity-50"
                        >
                            <Copy size={13} /> 문구 복사
                        </button>
                        <button
                            onClick={handleShare}
                            disabled={busy || empty}
                            className="flex-1 py-3 bg-white/5 text-dim font-black rounded-full text-xs flex items-center justify-center gap-1.5 disabled:opacity-50"
                        >
                            <Download size={13} /> 사진 저장
                        </button>
                    </div>
                </div>
            )}
        >
            {empty ? (
                <div className="text-center py-10">
                    <p className="text-5xl mb-4">🏸</p>
                    <p className="text-sm font-black text-txt mb-1">아직 오늘 경기가 없어요</p>
                    <p className="text-xs text-dim font-medium leading-relaxed break-keep">
                        한 경기라도 뛰고 나면 자랑할 카드가 만들어집니다.
                    </p>
                </div>
            ) : (
                <>
                    {/* 미리보기 — 실제로 만들어질 이미지 그대로 (세로 9:16) */}
                    <div className="rounded-2xl overflow-hidden border border-white/10 bg-black">
                        <canvas
                            ref={canvasRef}
                            className="w-full h-auto block"
                            aria-label={`${stat.name}님의 오늘 기록 카드 미리보기. ${stat.games}경기, ${stat.totalPlayers}명 중 ${stat.rank}위.`}
                        />
                    </div>

                    {/* 테마 고르기 */}
                    <div className="mt-4">
                        <span className="text-[11px] font-black label text-dim block mb-2">테마</span>
                        <div className="grid grid-cols-3 gap-2">
                            {THEMES.map(t => (
                                <button
                                    key={t.key}
                                    onClick={() => setThemeKey(t.key)}
                                    aria-pressed={t.key === themeKey}
                                    className={`p-2.5 rounded-xl border transition-all ${
                                        t.key === themeKey ? 'border-volt bg-volt/10' : 'border-white/10 bg-white/[0.03]'
                                    }`}
                                >
                                    <span
                                        className="block w-full h-6 rounded-md mb-1.5"
                                        style={{ background: `linear-gradient(120deg, ${t.bg} 35%, ${t.accent})` }}
                                    />
                                    <span className={`text-[11px] font-black ${t.key === themeKey ? 'text-txt' : 'text-dim'}`}>
                                        {t.label}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <p className="text-[11px] text-muted font-medium mt-4 leading-relaxed break-keep text-center">
                        공유를 누르면 폰의 공유 시트가 열려요. 거기서 <b className="text-dim">인스타그램</b>을 고르면
                        스토리 편집기로 바로 넘어갑니다.
                    </p>
                </>
            )}
        </Modal>
    );
}
