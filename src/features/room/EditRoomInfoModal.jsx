import React, { useEffect, useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import { FIELD_CLS, LABEL_CLS, LEVELS } from '../../constants';
import { searchAddress } from '../../lib/kakao';
import { toast } from '../../lib/toast';
import { Search, Crown, Trash2 } from '../../components/ui/icons';

// ===================================================================================
// 방 정보 수정
// -----------------------------------------------------------------------------------
// 예전에는 이 창 하나에 방 정보 + 공동 관리자 + 비밀번호가 다 들어 있었다.
// 관리자는 '사람'을 다루는 일이고 비밀번호는 '보안'이라, 성격이 셋 다 다르다.
// 지금은 관리자와 비밀번호를 각자의 자리로 옮기고 여기는 방 소개만 다룬다.
// ===================================================================================

export function EditRoomInfoModal({ isOpen, onClose, roomData, onSave, onDelete, onManageAdmins, canDelete }) {
    const [form, setForm] = useState({
        name: '', location: '', address: '', coords: null,
        description: '', maxPlayers: 20, levelLimit: 'N조',
    });

    useEffect(() => {
        if (!isOpen || !roomData) return;
        setForm({
            name: roomData.name || '',
            location: roomData.location || '',
            address: roomData.address || '',
            coords: roomData.coords || null,
            description: roomData.description || '',
            maxPlayers: roomData.maxPlayers || 20,
            levelLimit: roomData.levelLimit || 'N조',
        });
    }, [isOpen, roomData]);

    const change = (e) => {
        const { name, value } = e.target;
        setForm(prev => ({ ...prev, [name]: value }));
    };

    const handleAddressSearch = async () => {
        try {
            const { address, buildingName, coords } = await searchAddress();
            setForm(prev => ({
                ...prev,
                address,
                coords: coords || prev.coords,
                location: prev.location || buildingName,
            }));
            if (!coords) toast.error('주소는 찾았지만 좌표를 가져오지 못했어요.');
        } catch (e) {
            if (e.message === 'CANCELLED') return;
            toast.error(e.message);
        }
    };

    const handleSubmit = () => {
        if (!form.name.trim()) { toast.error('방 제목을 입력해주세요.'); return; }
        if (!form.address) { toast.error('장소를 검색해서 입력해주세요.'); return; }
        const max = parseInt(form.maxPlayers, 10);
        if (!Number.isFinite(max) || max < 4) { toast.error('정원은 4명 이상이어야 합니다.'); return; }
        onSave({ ...form, name: form.name.trim(), maxPlayers: max });
        onClose();
    };

    return (
        <Modal
            open={isOpen}
            onClose={onClose}
            title="방 정보 수정"
            size="max-w-lg"
            footer={(
                <div className="space-y-2">
                    <button
                        onClick={handleSubmit}
                        className="w-full py-4 bg-volt text-ink font-black rounded-full shadow-volt label"
                    >
                        저장하기
                    </button>
                    {canDelete && onDelete && (
                        <button
                            onClick={onDelete}
                            className="w-full py-3 bg-coral/10 text-coral font-black rounded-full text-sm hover:bg-coral/20 transition-colors flex items-center justify-center gap-2"
                        >
                            <Trash2 size={15} /> 방 삭제 (되돌릴 수 없어요)
                        </button>
                    )}
                </div>
            )}
        >
            <div className="space-y-4">
                <div>
                    <label className={LABEL_CLS} htmlFor="er-name">방 제목</label>
                    <input
                        data-autofocus
                        id="er-name" type="text" name="name"
                        value={form.name} onChange={change} className={FIELD_CLS}
                    />
                </div>

                <div>
                    <span className={LABEL_CLS}>장소</span>
                    <div className="flex gap-2 mb-2">
                        <input
                            type="text" placeholder="터치해서 주소 수정..."
                            value={form.address} readOnly onClick={handleAddressSearch}
                            className={`${FIELD_CLS} cursor-pointer text-sm truncate`}
                        />
                        <button
                            type="button" onClick={handleAddressSearch}
                            className="bg-volt text-ink px-4 rounded-xl font-black text-sm shrink-0 flex items-center gap-1"
                        >
                            <Search size={15} /> 검색
                        </button>
                    </div>
                    <input
                        type="text" name="location" placeholder="장소명 (예: 콕스타 체육관)"
                        value={form.location} onChange={change}
                        className="w-full p-3 bg-card2 rounded-xl border border-white/10 focus:border-volt outline-none text-sm font-bold text-txt placeholder-muted"
                    />
                    {form.coords
                        ? <p className="text-xs text-volt font-black mt-1.5 ml-1">✓ 위치 좌표 확인됨 — 지도에 표시됩니다</p>
                        : <p className="text-xs text-coral font-black mt-1.5 ml-1">좌표가 없어 지도에 표시되지 않아요</p>}
                </div>

                <div>
                    <label className={LABEL_CLS} htmlFor="er-desc">모임 소개</label>
                    <textarea
                        id="er-desc" name="description" rows={3}
                        value={form.description} onChange={change}
                        className={`${FIELD_CLS} resize-none`}
                    />
                </div>

                <div className="flex gap-4">
                    <div className="flex-1">
                        <label className={LABEL_CLS} htmlFor="er-level">입장 급수</label>
                        <select id="er-level" name="levelLimit" value={form.levelLimit} onChange={change} className={FIELD_CLS}>
                            {['N조', ...LEVELS.filter(l => l !== 'N조')].map(l => (
                                <option key={l} value={l} className="bg-surface">
                                    {l === 'N조' ? '전체 급수' : `${l} 이상`}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="flex-1">
                        <label className={LABEL_CLS} htmlFor="er-max">정원</label>
                        <input
                            id="er-max" type="number" name="maxPlayers" inputMode="numeric" min="4"
                            value={form.maxPlayers} onChange={change} className={FIELD_CLS}
                        />
                    </div>
                </div>

                {onManageAdmins && (
                    <button
                        onClick={onManageAdmins}
                        className="w-full py-3.5 bg-white/5 text-txt font-black rounded-2xl text-sm flex items-center justify-center gap-2 hover:bg-white/10 transition-colors"
                    >
                        <Crown size={16} className="text-volt" /> 공동 관리자 관리
                    </button>
                )}
            </div>
        </Modal>
    );
}
