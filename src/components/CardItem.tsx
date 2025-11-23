// src/components/CardItem.tsx
import React from 'react';
import { Card } from '../types';

interface CardItemProps {
    card: Card;
    currentCount: number;
    isLeader: boolean;
    isCurrentLeader: boolean;
    updateDeckCount: (cardId: string, delta: number) => void;
}

export const CardItem: React.FC<CardItemProps> = ({ card, currentCount, isLeader, isCurrentLeader, updateDeckCount }) => {
    
    // 💡 Pythonロジックの再現: ＋ボタンの無効化条件を設定
    const disableAdd = 
        // リーダーカードで、既にデッキに含まれている場合は追加不可 (1枚制限)
        (isLeader && isCurrentLeader) || 
        // 非リーダーカードで、既に4枚ある場合は追加不可 (4枚制限)
        (!isLeader && currentCount >= 4); 

    // 💡 Pythonロジックの再現: −ボタンの無効化条件を設定
    const disableSub = currentCount === 0;

    // 💡 Pythonロジックの再現: カウント表示とリーダー表示
    const countDisplay = isLeader 
        ? (isCurrentLeader ? 'LEADER' : '0') // リーダーの場合は 'LEADER' または '0'
        : `(${currentCount}/4枚)`;           // 非リーダーの場合は '(X/4枚)'

    const countColor = isLeader 
        ? 'text-purple-600' 
        : (currentCount > 0 ? 'text-blue-600' : 'text-gray-500');

    return (
        <div className="w-full flex flex-col items-center border border-gray-200 rounded-lg p-1 transition shadow-sm hover:shadow-md bg-white">
            
            {/* 1. カード画像 */}
            <div className="w-full aspect-[2/3] overflow-hidden rounded mb-1">
                <img 
                    src={card.ImgUrl} 
                    alt={card.Name} 
                    className="w-full h-full object-contain"
                />
            </div>

            {/* 2. カウンターとパラレルマーク */}
            <div className="w-full text-center text-sm mb-1">
                <span className={`font-bold ${countColor}`}>{countDisplay}</span>
                {/* 💡 Pythonロジックの再現: パラレルカードにマーク */}
                {card.is_parallel && <span className="text-xs text-yellow-500 ml-1">✨P</span>}
            </div>

            <div className="flex w-full space-x-1">
                <button
                    onClick={() => updateDeckCount(card.ID, 1)}
                    disabled={disableAdd}
                    className="flex-1 bg-green-500 hover:bg-green-600 text-white text-xs py-1 rounded disabled:bg-gray-400"
                >
                    ＋
                </button>
                <button
                    onClick={() => updateDeckCount(card.ID, -1)}
                    disabled={disableSub}
                    className="flex-1 bg-red-500 hover:bg-red-600 text-white text-xs py-1 rounded disabled:bg-gray-400"
                >
                    −
                </button>
            </div>
            
        </div>
    );
};