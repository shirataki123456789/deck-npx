// src/components/FilterControls.tsx
import React, { ChangeEvent } from 'react';
import { FilterState, ALL_COLORS, ALL_RARITIES, ALL_TYPES } from '../types';

// 💡 暫定の全選択肢 (実際には cardlist.json から動的に取得することが望ましい)
const ALL_ATTRIBUTES = ['斬', '打', '射', '特']; // 属性の例
const ALL_BLOCK_ICONS = ['1', '2', '3', '4']; // ブロックアイコンの例
const ALL_TRIGGERS = ['なし', 'トリガー']; // トリガーの例

interface FilterControlsProps {
  filterState: FilterState;
  setFilterState: React.Dispatch<React.SetStateAction<FilterState>>;
}

export const FilterControls: React.FC<FilterControlsProps> = ({ filterState, setFilterState }) => {
  
  const handleChange = (key: keyof FilterState, value: any) => {
    setFilterState(p => ({ ...p, [key]: value }));
  };

  const handleMultiSelectChange = (key: keyof FilterState, e: ChangeEvent<HTMLSelectElement>) => {
    const selectedOptions = Array.from(e.target.selectedOptions, option => option.value);
    handleChange(key, selectedOptions);
  };
  
  // 最小コスト/BP/カウンターの変更ハンドラ
  const handleMinMaxChange = (key: 'cost_min' | 'cost_max' | 'bp_min' | 'bp_max' | 'counter_min' | 'counter_max', value: string) => {
    const numValue = value === '' ? null : parseInt(value, 10);
    handleChange(key, numValue);
  }

  return (
    <div className="space-y-3">
      <h3 className="font-semibold border-b pb-1">検索フィルター</h3>
      
      {/* 検索窓 (カード名 / 効果テキスト) */}
      <input
        type="text"
        placeholder="カード名 / 効果テキスト"
        value={filterState.search_query}
        onChange={(e: ChangeEvent<HTMLInputElement>) => handleChange('search_query', e.target.value)}
        className="w-full border p-2 rounded text-sm"
      />

      {/* 色フィルター */}
      <div>
        <label className="block text-xs font-medium mb-1">色</label>
        <select
          multiple
          value={filterState.color}
          onChange={(e) => handleMultiSelectChange('color', e)}
          className="w-full border p-1 rounded text-sm h-24"
        >
          {ALL_COLORS.map(color => (
            <option key={color} value={color}>{color}</option>
          ))}
        </select>
      </div>

      {/* レアリティフィルター */}
      <div>
        <label className="block text-xs font-medium mb-1">レアリティ</label>
        <select
          multiple
          value={filterState.rarity}
          onChange={(e) => handleMultiSelectChange('rarity', e)}
          className="w-full border p-1 rounded text-sm h-16"
        >
          {ALL_RARITIES.map(rarity => (
            <option key={rarity} value={rarity}>{rarity}</option>
          ))}
        </select>
      </div>
      
      {/* タイプフィルター */}
      <div>
        <label className="block text-xs font-medium mb-1">タイプ</label>
        <select
          multiple
          value={filterState.card_type}
          onChange={(e) => handleMultiSelectChange('card_type', e)}
          className="w-full border p-1 rounded text-sm h-16"
        >
          {ALL_TYPES.map(type => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
      </div>

      {/* コスト範囲フィルター */}
      <div>
        <label className="block text-xs font-medium mb-1">コスト範囲</label>
        <div className="flex space-x-2">
          <input 
            type="number"
            placeholder="Min"
            value={filterState.cost_min === null ? '' : filterState.cost_min}
            onChange={(e: ChangeEvent<HTMLInputElement>) => handleMinMaxChange('cost_min', e.target.value)}
            className="w-1/2 border p-1 rounded text-sm text-center"
          />
          <input 
            type="number"
            placeholder="Max"
            value={filterState.cost_max === null ? '' : filterState.cost_max}
            onChange={(e: ChangeEvent<HTMLInputElement>) => handleMinMaxChange('cost_max', e.target.value)}
            className="w-1/2 border p-1 rounded text-sm text-center"
          />
        </div>
      </div>

      {/* BP範囲フィルター */}
      <div>
        <label className="block text-xs font-medium mb-1">パワー(BP)範囲</label>
        <div className="flex space-x-2">
          <input 
            type="number"
            placeholder="Min"
            value={filterState.bp_min === null ? '' : filterState.bp_min}
            onChange={(e: ChangeEvent<HTMLInputElement>) => handleMinMaxChange('bp_min', e.target.value)}
            className="w-1/2 border p-1 rounded text-sm text-center"
          />
          <input 
            type="number"
            placeholder="Max"
            value={filterState.bp_max === null ? '' : filterState.bp_max}
            onChange={(e: ChangeEvent<HTMLInputElement>) => handleMinMaxChange('bp_max', e.target.value)}
            className="w-1/2 border p-1 rounded text-sm text-center"
          />
        </div>
      </div>

      {/* ======================================= */}
      {/* 💡 CSV追加項目 (属性, カウンター, ブロックアイコン, トリガー) */}
      {/* ======================================= */}

      {/* カウンター範囲フィルター */}
      <div>
        <label className="block text-xs font-medium mb-1">カウンター範囲</label>
        <div className="flex space-x-2">
          <input 
            type="number"
            placeholder="Min"
            value={filterState.counter_min === null ? '' : filterState.counter_min}
            onChange={(e: ChangeEvent<HTMLInputElement>) => handleMinMaxChange('counter_min', e.target.value)}
            className="w-1/2 border p-1 rounded text-sm text-center"
          />
          <input 
            type="number"
            placeholder="Max"
            value={filterState.counter_max === null ? '' : filterState.counter_max}
            onChange={(e: ChangeEvent<HTMLInputElement>) => handleMinMaxChange('counter_max', e.target.value)}
            className="w-1/2 border p-1 rounded text-sm text-center"
          />
        </div>
      </div>

      {/* 属性フィルター */}
      <div>
        <label className="block text-xs font-medium mb-1">属性</label>
        <select
          multiple
          value={filterState.attribute}
          onChange={(e) => handleMultiSelectChange('attribute', e)}
          className="w-full border p-1 rounded text-sm h-16"
        >
          {/* ALL_ATTRIBUTES は types.ts か utils.ts で定義されているか、動的に生成が必要です */}
          {ALL_ATTRIBUTES.map(attr => (
            <option key={attr} value={attr}>{attr}</option>
          ))}
        </select>
      </div>

      {/* ブロックアイコンフィルター */}
      <div>
        <label className="block text-xs font-medium mb-1">ブロックアイコン</label>
        <select
          multiple
          value={filterState.block_icon}
          onChange={(e) => handleMultiSelectChange('block_icon', e)}
          className="w-full border p-1 rounded text-sm h-16"
        >
          {ALL_BLOCK_ICONS.map(icon => (
            <option key={icon} value={icon}>{icon}</option>
          ))}
        </select>
      </div>

      {/* トリガーフィルター */}
      <div>
        <label className="block text-xs font-medium mb-1">トリガー</label>
        <select
          multiple
          value={filterState.trigger}
          onChange={(e) => handleMultiSelectChange('trigger', e)}
          className="w-full border p-1 rounded text-sm h-16"
        >
          {ALL_TRIGGERS.map(trigger => (
            <option key={trigger} value={trigger}>{trigger}</option>
          ))}
        </select>
      </div>
      
      {/* 特徴フィルター (通常、特徴は数が多いため、検索窓または別のUIが適していますが、ここではmultiselectの例として残します) */}
      {/* ⚠️ 注意: 特徴 (Feature) はCSVでは '/' 区切りの文字列であることが多いため、マルチセレクトでの対応は困難です。検索クエリに含めるか、専用の入力が必要です。*/}
      {/* 今回はロジックはutils.tsで対応済みのため、一旦UIは省略します。 */}

      {/* パラレルフィルター */}
      <div className="flex items-center">
        <input 
          type="checkbox" 
          id="parallel_only"
          checked={filterState.is_parallel_only}
          onChange={(e: ChangeEvent<HTMLInputElement>) => handleChange('is_parallel_only', e.target.checked)}
          className="mr-2"
        />
        <label htmlFor="parallel_only" className="text-sm">パラレルのみ表示</label>
      </div>
    </div>
  );
};