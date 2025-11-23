// src/components/DeckManager.tsx
import React, { useState, ChangeEvent, useMemo } from 'react';
import { AppState, DeckList, Card } from '../types';

interface DeckManagerProps {
  appState: AppState;
  savedDeckNames: string[];
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
  // 💡 関数シグネチャを修正
  handleSaveDeck: (name: string) => void;
  handleLoadDeck: (name: string) => void;
  handleQrImport: (qrData: string) => void;
  handleGenerateImage: () => void;
}

export const DeckManager: React.FC<DeckManagerProps> = ({ 
    appState, 
    savedDeckNames, 
    setAppState, 
    handleSaveDeck, 
    handleLoadDeck, 
    handleQrImport, 
    handleGenerateImage 
}) => {
  const [deckNameInput, setDeckNameInput] = useState(''); // 💡 修正: デッキ名入力をローカルステートとして管理
  const [qrDataInput, setQrDataInput] = useState('');

  const deckCount = useMemo(() => {
    return Object.values(appState.deck).reduce((sum: number, count: number) => sum + count, 0);
  }, [appState.deck]);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold border-b pb-2">デッキ管理</h2>

      {/* デッキ統計 */}
      <div className="p-3 border rounded text-sm bg-gray-50">
        <p>合計枚数: <span className="font-bold text-lg">{deckCount}</span> / 50</p>
        <p>リーダーID: <span className="font-bold">{appState.leaderCardId || '未設定'}</span></p>
      </div>

      {/* デッキ名入力と保存/ロード */}
      <div className="space-y-2">
        <input
          type="text"
          placeholder="デッキ名を入力"
          value={deckNameInput}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setDeckNameInput(e.target.value)}
          className="w-full border p-2 rounded text-sm"
        />
        <div className="flex space-x-2">
          <button
            onClick={() => handleSaveDeck(deckNameInput)}
            className="flex-1 bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-2 rounded text-sm transition"
          >
            保存
          </button>
          <select
            onChange={(e) => handleLoadDeck(e.target.value)}
            className="flex-1 border p-2 rounded text-sm"
            value=""
          >
            <option value="" disabled>ロードするデッキを選択</option>
            {savedDeckNames.map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 画像生成 */}
      <button
        onClick={handleGenerateImage}
        className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded text-sm transition"
      >
        デッキ画像を生成 (PNG)
      </button>

      {/* QRコードインポート */}
      <div className="space-y-2">
        <textarea
          placeholder="QRコードから読み取ったデータをペースト"
          value={qrDataInput}
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setQrDataInput(e.target.value)}
          className="w-full border p-2 rounded text-sm h-16"
        />
        <button
          onClick={() => handleQrImport(qrDataInput)}
          className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-2 px-4 rounded text-sm transition"
        >
          QRデータからインポート
        </button>
      </div>
    </div>
  );
};