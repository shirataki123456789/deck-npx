// src/pages/index.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, AppState, FilterState } from '../types';
import { loadCardData, saveDeckList, loadDeckList, getSavedDeckNames, filterCards } from '../utils';
import { CardItem } from '../components/CardItem';
import { FilterControls, FilterOptions } from '../components/FilterControls'; // FilterOptionsをインポート
import { DeckManager } from '../components/DeckManager';

const INITIAL_FILTER_STATE: FilterState = {
  search_query: '',
  color: [],
  rarity: [],
  cost: [],
  card_type: [],
  parallel_mode: 'normal',
  attribute: [],
  counter: [],
  block_icon: [],
  feature: [],
  series_id: [],
  trigger: []
};

const INITIAL_APP_STATE: AppState = {
  deck: {},
  leaderCardId: null,
};

const Home: React.FC = () => {
  const [allCards, setAllCards] = useState<Card[]>([]);
  const [appState, setAppState] = useState<AppState>(INITIAL_APP_STATE);
  const [filterState, setFilterState] = useState<FilterState>(INITIAL_FILTER_STATE);
  const [loading, setLoading] = useState(true);
  const [savedDeckNames, setSavedDeckNames] = useState<string[]>([]);
  
  const deckCount = useMemo(() => {
    return Object.values(appState.deck).reduce((sum: number, count: number) => sum + count, 0);
  }, [appState.deck]);

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

  // 💡 Python版のロジック再現: 全カードデータから選択肢を動的に生成
  const filterOptions = useMemo<FilterOptions>(() => {
    if (allCards.length === 0) {
      return { costs: [], counters: [], attributes: [], features: [], blockIcons: [], seriesIds: [], triggers: [] };
    }

    // 重複排除とソート用ヘルパー
    const uniqueSortedNumbers = (arr: (number|null)[]) => Array.from(new Set(arr.filter((v): v is number => v !== null))).sort((a, b) => a - b);
    const uniqueSortedStrings = (arr: string[]) => Array.from(new Set(arr.filter(Boolean))).sort();

    // コスト: sorted(df["コスト数値"].unique())
    const costs = uniqueSortedNumbers(allCards.map(c => c.Cost));

    // カウンター: sorted(df["カウンター"].unique())
    // データがない場合は0として扱うロジックが含まれる場合がありますが、ここでは数値として存在するものを抽出
    const counters = uniqueSortedNumbers(allCards.map(c => c.Counter));

    // 属性: "打/斬" のように / 区切りで格納されているため展開して集計
    // sorted({attr for lst in df["属性リスト"] for attr in lst if attr})
    const attributes = uniqueSortedStrings(
        allCards.flatMap(c => (c.Attribute || '').split('/'))
    );

    // 特徴: 同様に展開
    const features = uniqueSortedStrings(
        allCards.flatMap(c => (c.Feature || '').split('/'))
    );
    
    // ブロックアイコン
    const blockIcons = uniqueSortedStrings(allCards.map(c => c.BlockIcon));
    
    // 入手シリーズ (utils.tsですでに【】の中身だけ抽出済み)
    const seriesIds = uniqueSortedStrings(allCards.map(c => c.SeriesID));

    // トリガー
    const triggers = uniqueSortedStrings(allCards.map(c => c.Trigger));

    return { costs, counters, attributes, features, blockIcons, seriesIds, triggers };
  }, [allCards]);


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
      if (!appState.leaderCardId) {
          alert("リーダーカードが設定されていません。");
          return;
      }
      try {
          const response = await fetch('/api/image-generator', {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
              },
              body: JSON.stringify({ 
                  deck: appState.deck, 
                  leaderId: appState.leaderCardId,
                  // allCardsをAPIに渡す必要がある場合はここで渡す
                  allCards: allCards 
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
  }, [appState.deck, appState.leaderCardId, allCards]);

  const updateDeckCount = useCallback((cardId: string, delta: number) => {
    setAppState(prevState => {
      const newDeck = { ...prevState.deck };
      const currentCount = newDeck[cardId] || 0;
      
      const card = allCards.find(c => c.ID === cardId);
      const isLeader = card?.Type.includes('LEADER');

      let newCount = currentCount + delta;

      if (newCount > 4 && !isLeader) {
          newCount = 4;
      } else if (newCount > 1 && isLeader) {
          newCount = 1; 
      }
      
      if (newCount < 0) newCount = 0;

      if (newCount === 0) {
        delete newDeck[cardId];
      } else {
        newDeck[cardId] = newCount;
      }
      
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

  const filteredCards = useMemo(() => {
    return filterCards(allCards, filterState, appState.leaderCardId);
  }, [allCards, filterState, appState.leaderCardId]);

  return (
    <div className="container mx-auto p-4">
        <div className="flex flex-col lg:flex-row lg:space-x-6">
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
                    options={filterOptions} // 💡 ここで計算したオプションを渡す
                />
            </div>

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