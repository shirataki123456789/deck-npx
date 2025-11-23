// src/utils.ts
import { Card, DeckList, FilterState, ALL_COLORS, TYPE_PRIORITY } from './types';

let allCards: Card[] = [];
const DECK_STORAGE_PREFIX = 'deckbuilder_';
const DECK_NAMES_KEY = 'deckbuilder_names';

// ===============================================
// 🧠 Python版ロジックの完全再現: ソート
// ===============================================

// 色の優先順位 (Python: color_priority)
const COLOR_MAP: Record<string, number> = {
    '赤': 0, '緑': 1, '青': 2, '紫': 3, '黒': 4, '黄': 5
};

/**
 * Pythonの `color_sort_key` を再現
 * 戻り値: [base_priority, type_rank, sub_priority, multi_flag]
 */
function getSortKeys(card: Card): [number, number, number, number] {
    const colorText = card.Color || '';
    const typeText = card.Type || '';
    
    // 色がない場合のフォールバック
    if (!colorText || colorText === '-') return [999, 999, 999, 999];

    // 色リストの解析 (例: "赤/緑" -> ["赤", "緑"])
    const foundColors = ALL_COLORS.filter(c => colorText.includes(c));
    
    if (foundColors.length === 0) return [999, 999, 999, 999];

    const firstColor = foundColors[0];
    const basePriority = COLOR_MAP[firstColor] ?? 999;

    // 多色判定
    const isMulti = colorText.includes('/') || colorText.includes('／');
    const subColors = foundColors.filter(c => c !== firstColor);
    
    // サブカラーの優先度 (多色の場合のみ計算、単色は0)
    let subPriority = 0;
    if (isMulti && subColors.length > 0) {
        subPriority = ALL_COLORS.indexOf(subColors[0]) + 1;
    }
    
    const multiFlag = isMulti ? 1 : 0;

    // タイプランク (LEADER=0, CHARACTER=1...)
    let typeRank = TYPE_PRIORITY.indexOf(typeText);
    if (typeRank === -1) typeRank = 9;

    return [basePriority, typeRank, subPriority, multiFlag];
}

/**
 * カードソート関数
 * Python: values.sort(key=lambda x: x["new_sort_key"])
 * new_sort_key = (type_rank, cost, base_priority, card_id) ※デッキ表示時
 * ここでは汎用的なリスト表示順（色優先）を実装します
 */
function cardSorter(a: Card, b: Card): number {
    const keyA = getSortKeys(a);
    const keyB = getSortKeys(b);

    // 1. Base Priority (主色)
    if (keyA[0] !== keyB[0]) return keyA[0] - keyB[0];

    // 2. Type Rank (タイプ)
    if (keyA[1] !== keyB[1]) return keyA[1] - keyB[1];
    
    // 3. Sub Priority (副色)
    if (keyA[2] !== keyB[2]) return keyA[2] - keyB[2];

    // 4. Multi Flag (多色フラグ)
    if (keyA[3] !== keyB[3]) return keyA[3] - keyB[3];

    // 5. Cost (コスト)
    if (a.Cost !== b.Cost) return a.Cost - b.Cost;

    // 6. ID
    return a.ID.localeCompare(b.ID);
}

// デッキ画像生成用などのために、デッキ内ソート順序もエクスポート
export function deckSorter(a: Card, b: Card): number {
    const keyA = getSortKeys(a);
    const keyB = getSortKeys(b);
    
    // Pythonのデッキソート順: (type_rank, cost, base_priority, card_id)
    // keyA/B = [base, type, sub, multi]
    
    // 1. Type
    if (keyA[1] !== keyB[1]) return keyA[1] - keyB[1];
    // 2. Cost
    if (a.Cost !== b.Cost) return a.Cost - b.Cost;
    // 3. Base Color
    if (keyA[0] !== keyB[0]) return keyA[0] - keyB[0];
    // 4. ID
    return a.ID.localeCompare(b.ID);
}

// ===============================================
// 🔍 データロード & フィルタリング
// ===============================================

export async function loadCardData(): Promise<Card[]> { 
    if (allCards.length > 0) return allCards;
    try {
        const response = await fetch('/cardlist.json'); // 事前にpublicに配置が必要
        const data: Card[] = await response.json();
        
        // データの整形（Pythonのload_data相当）
        const processedData = data.map(card => ({
            ...card,
            // シリーズIDの抽出ロジック再現
            SeriesID: card.Acquisition?.match(/【(.*?)】/)?.[1] || "その他",
            // 配列項目の正規化
            Attribute: card.Attribute?.replace(/／/g, '/') || '',
            Feature: card.Feature?.replace(/／/g, '/') || ''
        }));

        processedData.sort(cardSorter);
        allCards = processedData;
        return processedData;
    } catch (error) {
        console.error("Error loading card data:", error);
        return [];
    }
}

export function filterCards(cards: Card[], filters: FilterState, leaderId: string | null = null): Card[] {
    // リーダーが設定されている場合の色フィルタリング用
    let validColors: string[] = [];
    if (leaderId) {
        const leader = cards.find(c => c.ID === leaderId);
        if (leader) {
            validColors = leader.Color.replace(/／/g, '/').split('/').filter(Boolean);
        }
    }

    return cards.filter(card => {
        // 1. パラレルモード (Normal / Parallel / Both)
        if (filters.parallel_mode === 'normal' && card.is_parallel) return false;
        if (filters.parallel_mode === 'parallel' && !card.is_parallel) return false;

        // 2. リーダー色縛り (デッキ作成モード時)
        // Python版では「リーダーがいるなら、LEADER以外のカードはリーダーの色を含む必要がある」
        if (leaderId && !card.Type.includes('LEADER')) {
            const cardColors = card.Color.replace(/／/g, '/').split('/');
            const hasMatch = cardColors.some(c => validColors.includes(c));
            if (!hasMatch) return false;
        }

        // 3. 基本フィルタ
        if (filters.search_query) {
            const q = filters.search_query.toLowerCase();
            const match = 
                card.Name.toLowerCase().includes(q) || 
                card.Effect?.toLowerCase().includes(q) || 
                card.Feature?.toLowerCase().includes(q) ||
                card.Trigger?.toLowerCase().includes(q);
            if (!match) return false;
        }

        // Color (配列チェック)
        if (filters.color.length > 0) {
            const cardColors = card.Color.replace(/／/g, '/').split('/');
            if (!filters.color.some(c => cardColors.includes(c))) return false;
        }

        // Type
        if (filters.card_type.length > 0 && !filters.card_type.includes(card.Type)) return false;

        // Cost (複数選択)
        if (filters.cost.length > 0 && !filters.cost.includes(card.Cost)) return false;

        // Counter
        if (filters.counter.length > 0 && (card.Counter === null || !filters.counter.includes(card.Counter))) return false;

        // Attribute
        if (filters.attribute.length > 0) {
             const attrs = card.Attribute.split('/');
             if (!filters.attribute.some(a => attrs.includes(a))) return false;
        }

        // Feature
        if (filters.feature.length > 0) {
            const feats = card.Feature.split('/');
            if (!filters.feature.some(f => feats.includes(f))) return false;
        }

        // SeriesID
        if (filters.series_id.length > 0 && !filters.series_id.includes(card.SeriesID)) return false;

        return true;
    });
}

// 保存・読込関連は以前と同じため省略（必要なら追加します）
export function saveDeckList(name: string, deckList: DeckList, leaderId: string | null): void {
    const key = DECK_STORAGE_PREFIX + name;
    localStorage.setItem(key, JSON.stringify({ deckList, leaderId }));
    const savedNames = getSavedDeckNames();
    if (!savedNames.includes(name)) {
        savedNames.push(name);
        localStorage.setItem(DECK_NAMES_KEY, JSON.stringify(savedNames));
    }
}
export function loadDeckList(name: string) { 
    return JSON.parse(localStorage.getItem(DECK_STORAGE_PREFIX + name) || 'null'); 
}
export function getSavedDeckNames(): string[] { 
    return JSON.parse(localStorage.getItem(DECK_NAMES_KEY) || '[]'); 
}