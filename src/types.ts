// src/types.ts

/**
 * カードオブジェクトの型定義
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
  
  // CSV/Python版にある追加項目
  Code: string; 
  Attribute: string; 
  Counter: number | null; 
  BlockIcon: string; 
  Feature: string; 
  Trigger: string; 
  Acquisition: string; 
  SeriesID: string; // 入手情報の【】内
  
  // 必須項目
  is_parallel: boolean;
  ImgUrl: string; 
  SetID: string;
  Set: string;
}

/**
 * デッキリストの型定義
 */
export type DeckList = Record<string, number>;

/**
 * フィルタリング条件の型定義
 */
export interface FilterState {
  search_query: string;
  color: string[];
  rarity: string[];
  cost: number[]; 
  card_type: string[];
  
  parallel_mode: 'normal' | 'parallel' | 'both'; 
  
  attribute: string[]; 
  counter: number[]; 
  block_icon: string[]; 
  feature: string[]; 
  series_id: string[];
  trigger: string[]; // 💡 ここを追加しました
}

/**
 * アプリケーションの状態管理の型定義
 */
export interface AppState {
  deck: DeckList;
  leaderCardId: string | null;
}

// ==========================================
// 定数定義
// ==========================================

export const ALL_COLORS = ['赤', '緑', '青', '紫', '黒', '黄'];
export const ALL_RARITIES = ['L', 'C', 'UC', 'R', 'SR', 'SEC', 'P'];
export const ALL_TYPES = ['LEADER', 'CHARACTER', 'EVENT', 'STAGE'];
export const TYPE_PRIORITY = ALL_TYPES;