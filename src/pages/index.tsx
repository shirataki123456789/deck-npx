// src/pages/index.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, DeckList, FilterState, AppState, ALL_COLORS, ALL_RARITIES, ALL_TYPES } from '../types';
import { loadCardData, saveDeckList, loadDeckList, getSavedDeckNames, filterCards } from '../utils';
import { CardItem } from '../components/CardItem';
import { FilterControls } from '../components/FilterControls';
import { DeckManager } from '../components/DeckManager'; // 💡 修正: DeckManagerをインポート

const INITIAL_FILTER_STATE: FilterState = {
  search_query: '',
  color: [],
  rarity: [],
  cost_min: null,
  cost_max: null,
  bp_min: null,
  bp_max: null,
  card_type: [],
  is_parallel_only: false,
  
  attribute: [],
  counter_min: null,
  counter_max: null,
  block_icon: [],
  feature: [],
  trigger: [],
};

const INITIAL_APP_STATE: AppState = {
  deck: {},
  leaderCardId: null,
};

const Home: React.FC = () => {
  // 💡 修正: すべてのState変数を定義
  const [allCards, setAllCards] = useState<Card[]>([]);
  const [appState, setAppState] = useState<AppState>(INITIAL_APP_STATE);
  const [filterState, setFilterState] = useState<FilterState>(INITIAL_FILTER_STATE);
  const [loading, setLoading] = useState(true);
  const [savedDeckNames, setSavedDeckNames] = useState<string[]>([]);
  
  // デッキの合計枚数を計算
  const deckCount = useMemo(() => {
    return Object.values(appState.deck).reduce((sum: number, count: number) => sum + count, 0);
  }, [appState.deck]);

  // 全カードデータをロード
  useEffect(() => {
    const fetchCards = async () => {
      setLoading(true);
      const cards = await loadCardData();
      setAllCards(cards);
      setSavedDeckNames(getSavedDeckNames());
      setLoading(false);
    };
    fetchCards();
  }, []);

  // 💡 修正: すべてのデッキ操作関数を定義
  const handleSaveDeck = useCallback((name: string) => {
    if (!name.trim()) {
      alert("デッキ名を指定してください。");
      return;
    }
    saveDeckList(name, appState.deck, appState.leaderCardId);
    setSavedDeckNames(getSavedDeckNames());
    alert(`デッキ「${name}」を保存しました。`);
  }, [appState.deck, appState.leaderCardId]);

  const handleLoadDeck = useCallback((name: string) => {
    const loadedData = loadDeckList(name);
    if (loadedData) {
      setAppState({ deck: loadedData.deckList, leaderCardId: loadedData.leaderId });
      alert(`デッキ「${name}」をロードしました。`);
    } else {
      alert(`デッキ「${name}」が見つかりませんでした。`);
    }
  }, [setAppState]);

  const handleQrImport = useCallback(async (qrData: string) => {
      try {
          const decodedData = JSON.parse(qrData);
          if (decodedData.deck && typeof decodedData.deck === 'object') {
              setAppState({ deck: decodedData.deck, leaderCardId: decodedData.leaderId || null });
              alert("QRコードからデッキをインポートしました。");
          } else {
              throw new Error("QRデータの形式が正しくありません。");
          }
      } catch (e) {
          console.error("QRインポートエラー:", e);
          alert("QRコードの解析に失敗しました。");
      }
  }, [setAppState]);

  const handleGenerateImage = useCallback(async () => {
      try {
          const response = await fetch('/api/image-generator', {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
              },
              body: JSON.stringify({ 
                  deck: appState.deck, 
                  leaderId: appState.leaderCardId 
              }),
          });

          if (!response.ok) {
              throw new Error(`画像生成APIエラー: ${response.statusText}`);
          }

          const blob = await response.blob();
          
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'deck_image.png';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
          
      } catch (error) {
          console.error("画像生成エラー:", error);
          alert("デッキ画像の生成に失敗しました。");
      }
  }, [appState.deck, appState.leaderCardId]);


  // デッキカウント更新ロジック
  const updateDeckCount = useCallback((cardId: string, delta: number) => {
    setAppState(prevState => {
      const newDeck = { ...prevState.deck };
      const currentCount = newDeck[cardId] || 0;
      let newCount = currentCount + delta;

      // 4枚制限 (リーダーは例外)
      const isLeader = allCards.find(c => c.ID === cardId)?.Type.includes('LEADER');
      if (newCount > 4 && !isLeader) {
          newCount = 4;
      } else if (newCount > 1 && isLeader) {
          // リーダーは1枚制限
          newCount = 1; 
      }
      
      if (newCount < 0) newCount = 0;

      if (newCount === 0) {
        delete newDeck[cardId];
      } else {
        newDeck[cardId] = newCount;
      }
      
      // リーダー設定ロジック
      let newLeaderId = prevState.leaderCardId;
      if (isLeader) {
        if (newCount > 0) {
          newLeaderId = cardId;
        } else if (newCount === 0 && newLeaderId === cardId) {
          newLeaderId = null;
        }
      }

      return { ...prevState, deck: newDeck, leaderCardId: newLeaderId };
    });
  }, [allCards]);

  // フィルタリングされたカードリスト
  const filteredCards = useMemo(() => {
    return filterCards(allCards, filterState);
  }, [allCards, filterState]);


  return (
    // 💡 修正されたレイアウトを再適用
    <div className="container mx-auto p-4">
        <div className="flex flex-col lg:flex-row lg:space-x-6">
            
            {/* サイドバー */}
            <div className="w-full lg:w-1/4 space-y-4 mb-6 lg:mb-0">
                <DeckManager
                    appState={appState}
                    savedDeckNames={savedDeckNames}
                    setAppState={setAppState}
                    handleSaveDeck={handleSaveDeck}
                    handleLoadDeck={handleLoadDeck}
                    handleQrImport={handleQrImport}
                    handleGenerateImage={handleGenerateImage}
                />
                <hr className="my-4" />
                <FilterControls
                    filterState={filterState}
                    setFilterState={setFilterState}
                />
            </div>

            {/* メインコンテンツ */}
            <div className="w-full lg:w-3/4">
                <h2 className="text-2xl font-bold mb-4">カードリスト ({deckCount}/50)</h2>
                {loading ? (
                    <p>カードデータをロード中です...</p>
                ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-4">
                        {filteredCards.map(card => {
                            const currentCount = appState.deck[card.ID] || 0;
                            const isLeader = card.Type.includes('LEADER');
                            const isCurrentLeader = appState.leaderCardId === card.ID;
                            
                            return (
                                <CardItem
                                    key={card.ID}
                                    card={card}
                                    currentCount={currentCount}
                                    isLeader={isLeader}
                                    isCurrentLeader={isCurrentLeader}
                                    updateDeckCount={updateDeckCount}
                                />
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};

export default Home;