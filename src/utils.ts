// src/utils.ts
import { Card, DeckList, FilterState } from './types';

let allCards: Card[] = [];
const DECK_STORAGE_PREFIX = 'deckbuilder_';
const DECK_NAMES_KEY = 'deckbuilder_names';

// ===============================================
// 💡 最終ソート順序の定義
// ===============================================

// 1. 色の優先順位: 赤 → 緑 → 青 → 紫 → 黒 → 黄
const COLOR_ORDER = ['赤', '緑', '青', '紫', '黒', '黄', '無色', '']; 

// 2. タイプの優先順位: LEADER → CHARACTER → EVENT → STAGE
const TYPE_ORDER = ['LEADER', 'CHARACTER', 'EVENT', 'STAGE', '']; 

/**
 * カードの色からソートキーを取得するヘルパー関数
 * 混色カードはすべてリーダーカードであることを前提に、単色リーダーの後にグループ化します。
 * @returns [プライマリソートインデックス, セカンダリソートインデックス] のタプル
 */
function getColorSortKeys(colorStr: string): [number, number] {
    if (!colorStr) return [COLOR_ORDER.indexOf(''), 0];

    // 色を '/' で分割し、空文字を削除
    const colors = colorStr.split('/').map(c => c.trim()).filter(c => c !== '');
    
    // 単色カードの場合 (colors.length === 1)
    if (colors.length === 1) {
        // プライマリキー: 基本色のインデックス
        const primaryKey = COLOR_ORDER.indexOf(colors[0]);
        // セカンダリキー: 0 (単色を混色より前に配置)
        return [primaryKey, 0];
    }
    
    // 混色（多色）カードの場合 (colors.length >= 2)
    if (colors.length >= 2) {
        const primaryColor = colors[0];
        const secondaryColor = colors[1];
        
        // 💡 混色グループのプライマリキーを設定 (単色グループの次に来る大きな値)
        // COLOR_ORDER.length を使用することで、すべての単色(0～6)の後に続く
        const primaryKey = COLOR_ORDER.length; 
        
        // 混色内でのソートは、第一色（100倍）と第二色（1倍）の結合インデックスで行う
        const firstColorIndex = COLOR_ORDER.indexOf(primaryColor);
        const secondColorIndex = COLOR_ORDER.indexOf(secondaryColor);

        const secondaryKey = (firstColorIndex * 100) + secondColorIndex;
        
        // 混色グループを primaryKey (7) の位置に配置し、
        // secondaryKey で 第一色 → 第二色の優先順位を適用
        return [primaryKey, secondaryKey]; 
    }

    // その他の特殊なケース
    return [COLOR_ORDER.indexOf(colorStr), 0];
}


/**
 * カードをソートするための最終的な比較関数
 * 優先順位: 1. Color (Primary) -> 2. Color (Secondary) -> 3. Type -> 4. Cost -> 5. ID
 */
function cardSorter(a: Card, b: Card): number {
    // 1. Color (色) の比較
    const [primaryA, secondaryA] = getColorSortKeys(a.Color || '');
    const [primaryB, secondaryB] = getColorSortKeys(b.Color || '');

    // 1.1 プライマリカラー (単色グループ vs 混色グループ) で比較
    if (primaryA !== primaryB) {
        return primaryA - primaryB;
    }
    
    // 1.2 セカンダリカラー (単色内での順序 or 混色内での第一色/第二色順序) で比較
    if (secondaryA !== secondaryB) {
        return secondaryA - secondaryB;
    }

    // 2. Type (タイプ) でソート
    // 修正後の順序: LEADER → CHARACTER → EVENT → STAGE
    const typeA = a.Type || '';
    const typeB = b.Type || '';
    const typeIndexA = TYPE_ORDER.indexOf(typeA.toUpperCase()); 
    const typeIndexB = TYPE_ORDER.indexOf(typeB.toUpperCase());
    if (typeIndexA !== typeIndexB) {
        return typeIndexA - typeIndexB;
    }
    
    // 3. Cost (コスト) でソート (昇順)
    const costA = a.Cost || 0;
    const costB = b.Cost || 0;
    if (costA !== costB) {
        return costA - costB;
    }

    // 4. ID (カードID) でソート (昇順)
    return a.ID.localeCompare(b.ID);
}


/**
 * カードデータをロードする関数 (ロード時にソートを実行)
 */
export async function loadCardData(): Promise<Card[]> { 
    if (allCards.length > 0) {
        return allCards;
    }
    try {
        // カードリストJSONの読み込み
        const response = await fetch('/cardlist.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data: Card[] = await response.json();
        
        // 読み込んだデータを並べ替えロジックでソート
        data.sort(cardSorter); 
        
        allCards = data;
        return data;
    } catch (error) {
        console.error("Error loading card data:", error);
        return [];
    }
}

/**
 * デッキリストを保存する関数
 */
export function saveDeckList(name: string, deckList: DeckList, leaderId: string | null): void {
    const key = DECK_STORAGE_PREFIX + name;
    localStorage.setItem(key, JSON.stringify({ deckList, leaderId }));

    const savedNames = JSON.parse(localStorage.getItem(DECK_NAMES_KEY) || '[]');
    if (!savedNames.includes(name)) {
        savedNames.push(name);
        localStorage.setItem(DECK_NAMES_KEY, JSON.stringify(savedNames));
    }
}

/**
 * デッキリストをロードする関数
 */
export function loadDeckList(name: string): { deckList: DeckList, leaderId: string | null } | null { 
    const key = DECK_STORAGE_PREFIX + name;
    const item = localStorage.getItem(key);
    if (item) {
        return JSON.parse(item);
    }
    return null;
}

/**
 * 保存されたデッキ名を取得する関数
 */
export function getSavedDeckNames(): string[] { 
    return JSON.parse(localStorage.getItem(DECK_NAMES_KEY) || '[]');
}

/**
 * カードリストをフィルタリングする関数
 */
export function filterCards(cards: Card[], filters: FilterState): Card[] {
    return cards.filter(card => {
        // 1. 検索キーワード (Name/Effect/Feature)
        if (filters.search_query) {
            const query = filters.search_query.toLowerCase();
            const nameMatch = card.Name.toLowerCase().includes(query);
            const effectMatch = card.Effect?.toLowerCase().includes(query);
            const featureMatch = card.Feature?.toLowerCase().includes(query);
            if (!nameMatch && !effectMatch && !featureMatch) return false;
        }

        // 2. 色フィルタ
        if (filters.color.length > 0) {
            // 多色カードに対応するため、カードの色を配列として扱う
            const cardColors = card.Color?.split('/').map(c => c.trim()) || [];
            // フィルタのいずれかの色にカードの色が含まれていればOK
            if (!filters.color.some(fColor => cardColors.includes(fColor))) return false;
        }

        // 3. レアリティフィルタ
        if (filters.rarity.length > 0 && !filters.rarity.includes(card.Rarity)) return false;

        // 4. コストフィルタ
        if (filters.cost_min !== null && card.Cost < filters.cost_min) return false;
        if (filters.cost_max !== null && card.Cost > filters.cost_max) return false;

        // 5. BPフィルタ
        if (filters.bp_min !== null && card.BP < filters.bp_min) return false;
        if (filters.bp_max !== null && card.BP > filters.bp_max) return false;

        // 6. カードタイプフィルタ
        if (filters.card_type.length > 0 && !filters.card_type.includes(card.Type)) return false;

        // 7. パラレルフィルタ
        if (filters.is_parallel_only && !card.is_parallel) return false;
        
        // 属性フィルタ
        if (filters.attribute.length > 0 && !filters.attribute.includes(card.Attribute)) return false;
        
        // ブロックアイコンフィルタ
        if (filters.block_icon.length > 0 && !filters.block_icon.includes(card.BlockIcon)) return false;
        
        // トリガーフィルタ
        if (filters.trigger.length > 0 && !filters.trigger.includes(card.Trigger)) return false;

        // カウンター範囲フィルタ
        if (card.Counter !== null) {
            if (filters.counter_min !== null && card.Counter < filters.counter_min) return false;
            if (filters.counter_max !== null && card.Counter > filters.counter_max) return false;
        }

        return true;
    });
}