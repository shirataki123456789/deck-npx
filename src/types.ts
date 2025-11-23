// src/types.ts

/**
 * カードオブジェクトの型定義 (CSVの全項目を反映)
 */
export interface Card {
  ID: string;
  Name: string;
  Rarity: string; 
  Color: string;
  Cost: number;
  BP: number; 
  Type: string; 
  Effect: string; 
  
  // 💡 CSVからの追加項目
  Code: string; 
  Attribute: string; 
  Counter: number | null; 
  BlockIcon: string; 
  Feature: string; 
  Trigger: string; 
  Acquisition: string; 
  
  // 必須項目
  is_parallel: boolean;
  ImgUrl: string; 
  SetID: string;
  Set: string;
}

/**
 * デッキリストの型定義
 */
export type DeckList = Record<string, number>; // 👈 export

/**
 * フィルタリング条件の型定義
 */
export interface FilterState {
  search_query: string;
  color: string[];
  rarity: string[];
  cost_min: number | null;
  cost_max: number | null;
  bp_min: number | null;
  bp_max: number | null;
  card_type: string[];
  is_parallel_only: boolean;
  
  // 💡 CSVからの追加フィルター
  attribute: string[]; 
  counter_min: number | null; 
  counter_max: number | null; 
  block_icon: string[]; 
  feature: string[]; 
  trigger: string[]; 
}

/**
 * アプリケーションの状態管理の型定義
 */
export interface AppState {
  deck: DeckList;
  leaderCardId: string | null;
} // 👈 export

// UIで利用する全選択肢
export const ALL_COLORS = ['赤', '青', '緑', '紫', '黒', '黄', '多色'];
export const ALL_RARITIES = ['C', 'UC', 'R', 'SR', 'L', 'SEC'];
export const ALL_TYPES = ['CHARACTER', 'EVENT', 'STAGE', 'LEADER'];