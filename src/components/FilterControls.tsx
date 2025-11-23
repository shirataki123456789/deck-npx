// src/components/FilterControls.tsx
import React, { ChangeEvent } from 'react';
import { FilterState, ALL_COLORS, ALL_TYPES } from '../types';

// 💡 親から受け取る選択肢データの型定義
export interface FilterOptions {
    costs: number[];
    counters: number[];
    attributes: string[];
    features: string[];
    blockIcons: string[];
    seriesIds: string[];
    triggers: string[];
}

interface FilterControlsProps {
  filterState: FilterState;
  setFilterState: React.Dispatch<React.SetStateAction<FilterState>>;
  options: FilterOptions; // 💡 追加: Python版のように動的な選択肢を受け取る
}

export const FilterControls: React.FC<FilterControlsProps> = ({ filterState, setFilterState, options }) => {
  
  const handleChange = (key: keyof FilterState, value: any) => {
    setFilterState(p => ({ ...p, [key]: value }));
  };

  const handleMultiSelectChange = (key: keyof FilterState, e: ChangeEvent<HTMLSelectElement>) => {
    const selectedOptions = Array.from(e.target.selectedOptions, option => option.value);
    handleChange(key, selectedOptions);
  };

  const handleNumberMultiSelectChange = (key: keyof FilterState, e: ChangeEvent<HTMLSelectElement>) => {
    const selectedOptions = Array.from(e.target.selectedOptions, option => parseInt(option.value, 10));
    handleChange(key, selectedOptions);
  };

  return (
    <div className="space-y-3">
      <h3 className="font-semibold border-b pb-1">検索フィルター</h3>
      
      {/* 検索窓 */}
      <input
        type="text"
        placeholder="カード名 / テキスト / 特徴"
        value={filterState.search_query}
        onChange={(e: ChangeEvent<HTMLInputElement>) => handleChange('search_query', e.target.value)}
        className="w-full border p-2 rounded text-sm"
      />

      {/* 色 (固定値) */}
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

      {/* タイプ (固定値) */}
      <div>
        <label className="block text-xs font-medium mb-1">タイプ</label>
        <select
          multiple
          value={filterState.card_type}
          onChange={(e) => handleMultiSelectChange('card_type', e)}
          className="w-full border p-1 rounded text-sm h-20"
        >
          {ALL_TYPES.map(type => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
      </div>

      {/* コスト (動的) */}
      <div>
        <label className="block text-xs font-medium mb-1">コスト</label>
        <select
          multiple
          value={filterState.cost.map(String)}
          onChange={(e) => handleNumberMultiSelectChange('cost', e)}
          className="w-full border p-1 rounded text-sm h-24"
        >
          {options.costs.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* カウンター (動的) */}
      <div>
        <label className="block text-xs font-medium mb-1">カウンター</label>
        <select
          multiple
          value={filterState.counter.map(String)}
          onChange={(e) => handleNumberMultiSelectChange('counter', e)}
          className="w-full border p-1 rounded text-sm h-20"
        >
          {options.counters.map(c => (
            <option key={c} value={c === 0 ? 'なし (0)' : c}>{c === 0 ? 'なし (0)' : c}</option>
          ))}
        </select>
      </div>

      {/* 属性 (動的) */}
      <div>
        <label className="block text-xs font-medium mb-1">属性</label>
        <select
          multiple
          value={filterState.attribute}
          onChange={(e) => handleMultiSelectChange('attribute', e)}
          className="w-full border p-1 rounded text-sm h-24"
        >
          {options.attributes.map(attr => (
            <option key={attr} value={attr}>{attr}</option>
          ))}
        </select>
      </div>

      {/* 特徴 (動的) - Python版では検索窓と併用ですが、ここでは選択可能に */}
      <div>
        <label className="block text-xs font-medium mb-1">特徴</label>
        <select
          multiple
          value={filterState.feature}
          onChange={(e) => handleMultiSelectChange('feature', e)}
          className="w-full border p-1 rounded text-sm h-24"
        >
          {options.features.map(f => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
      </div>

      {/* 入手シリーズ (動的) */}
      <div>
        <label className="block text-xs font-medium mb-1">入手シリーズ</label>
        <select
          multiple
          value={filterState.series_id}
          onChange={(e) => handleMultiSelectChange('series_id', e)}
          className="w-full border p-1 rounded text-sm h-24"
        >
          {options.seriesIds.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

       {/* ブロックアイコン (動的) */}
       <div>
        <label className="block text-xs font-medium mb-1">ブロックアイコン</label>
        <select
          multiple
          value={filterState.block_icon}
          onChange={(e) => handleMultiSelectChange('block_icon', e)}
          className="w-full border p-1 rounded text-sm h-16"
        >
          {options.blockIcons.map(b => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
      </div>

      {/* パラレルモード切替 */}
      <div className="pt-2">
        <label className="block text-xs font-medium mb-1">カードバージョン</label>
        <div className="flex flex-col space-y-1 text-sm">
            <label className="flex items-center">
                <input 
                    type="radio" 
                    name="parallel_mode" 
                    value="normal"
                    checked={filterState.parallel_mode === 'normal'}
                    onChange={() => handleChange('parallel_mode', 'normal')}
                    className="mr-2"
                />
                通常のみ
            </label>
            <label className="flex items-center">
                <input 
                    type="radio" 
                    name="parallel_mode" 
                    value="parallel"
                    checked={filterState.parallel_mode === 'parallel'}
                    onChange={() => handleChange('parallel_mode', 'parallel')}
                    className="mr-2"
                />
                パラレルのみ
            </label>
            <label className="flex items-center">
                <input 
                    type="radio" 
                    name="parallel_mode" 
                    value="both"
                    checked={filterState.parallel_mode === 'both'}
                    onChange={() => handleChange('parallel_mode', 'both')}
                    className="mr-2"
                />
                両方表示
            </label>
        </div>
      </div>
    </div>
  );
};