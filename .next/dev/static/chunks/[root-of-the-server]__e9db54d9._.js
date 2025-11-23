(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[turbopack]/browser/dev/hmr-client/hmr-client.ts [client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/// <reference path="../../../shared/runtime-types.d.ts" />
/// <reference path="../../runtime/base/dev-globals.d.ts" />
/// <reference path="../../runtime/base/dev-protocol.d.ts" />
/// <reference path="../../runtime/base/dev-extensions.ts" />
__turbopack_context__.s([
    "connect",
    ()=>connect,
    "setHooks",
    ()=>setHooks,
    "subscribeToUpdate",
    ()=>subscribeToUpdate
]);
function connect({ addMessageListener, sendMessage, onUpdateError = console.error }) {
    addMessageListener((msg)=>{
        switch(msg.type){
            case 'turbopack-connected':
                handleSocketConnected(sendMessage);
                break;
            default:
                try {
                    if (Array.isArray(msg.data)) {
                        for(let i = 0; i < msg.data.length; i++){
                            handleSocketMessage(msg.data[i]);
                        }
                    } else {
                        handleSocketMessage(msg.data);
                    }
                    applyAggregatedUpdates();
                } catch (e) {
                    console.warn('[Fast Refresh] performing full reload\n\n' + "Fast Refresh will perform a full reload when you edit a file that's imported by modules outside of the React rendering tree.\n" + 'You might have a file which exports a React component but also exports a value that is imported by a non-React component file.\n' + 'Consider migrating the non-React component export to a separate file and importing it into both files.\n\n' + 'It is also possible the parent component of the component you edited is a class component, which disables Fast Refresh.\n' + 'Fast Refresh requires at least one parent function component in your React tree.');
                    onUpdateError(e);
                    location.reload();
                }
                break;
        }
    });
    const queued = globalThis.TURBOPACK_CHUNK_UPDATE_LISTENERS;
    if (queued != null && !Array.isArray(queued)) {
        throw new Error('A separate HMR handler was already registered');
    }
    globalThis.TURBOPACK_CHUNK_UPDATE_LISTENERS = {
        push: ([chunkPath, callback])=>{
            subscribeToChunkUpdate(chunkPath, sendMessage, callback);
        }
    };
    if (Array.isArray(queued)) {
        for (const [chunkPath, callback] of queued){
            subscribeToChunkUpdate(chunkPath, sendMessage, callback);
        }
    }
}
const updateCallbackSets = new Map();
function sendJSON(sendMessage, message) {
    sendMessage(JSON.stringify(message));
}
function resourceKey(resource) {
    return JSON.stringify({
        path: resource.path,
        headers: resource.headers || null
    });
}
function subscribeToUpdates(sendMessage, resource) {
    sendJSON(sendMessage, {
        type: 'turbopack-subscribe',
        ...resource
    });
    return ()=>{
        sendJSON(sendMessage, {
            type: 'turbopack-unsubscribe',
            ...resource
        });
    };
}
function handleSocketConnected(sendMessage) {
    for (const key of updateCallbackSets.keys()){
        subscribeToUpdates(sendMessage, JSON.parse(key));
    }
}
// we aggregate all pending updates until the issues are resolved
const chunkListsWithPendingUpdates = new Map();
function aggregateUpdates(msg) {
    const key = resourceKey(msg.resource);
    let aggregated = chunkListsWithPendingUpdates.get(key);
    if (aggregated) {
        aggregated.instruction = mergeChunkListUpdates(aggregated.instruction, msg.instruction);
    } else {
        chunkListsWithPendingUpdates.set(key, msg);
    }
}
function applyAggregatedUpdates() {
    if (chunkListsWithPendingUpdates.size === 0) return;
    hooks.beforeRefresh();
    for (const msg of chunkListsWithPendingUpdates.values()){
        triggerUpdate(msg);
    }
    chunkListsWithPendingUpdates.clear();
    finalizeUpdate();
}
function mergeChunkListUpdates(updateA, updateB) {
    let chunks;
    if (updateA.chunks != null) {
        if (updateB.chunks == null) {
            chunks = updateA.chunks;
        } else {
            chunks = mergeChunkListChunks(updateA.chunks, updateB.chunks);
        }
    } else if (updateB.chunks != null) {
        chunks = updateB.chunks;
    }
    let merged;
    if (updateA.merged != null) {
        if (updateB.merged == null) {
            merged = updateA.merged;
        } else {
            // Since `merged` is an array of updates, we need to merge them all into
            // one, consistent update.
            // Since there can only be `EcmascriptMergeUpdates` in the array, there is
            // no need to key on the `type` field.
            let update = updateA.merged[0];
            for(let i = 1; i < updateA.merged.length; i++){
                update = mergeChunkListEcmascriptMergedUpdates(update, updateA.merged[i]);
            }
            for(let i = 0; i < updateB.merged.length; i++){
                update = mergeChunkListEcmascriptMergedUpdates(update, updateB.merged[i]);
            }
            merged = [
                update
            ];
        }
    } else if (updateB.merged != null) {
        merged = updateB.merged;
    }
    return {
        type: 'ChunkListUpdate',
        chunks,
        merged
    };
}
function mergeChunkListChunks(chunksA, chunksB) {
    const chunks = {};
    for (const [chunkPath, chunkUpdateA] of Object.entries(chunksA)){
        const chunkUpdateB = chunksB[chunkPath];
        if (chunkUpdateB != null) {
            const mergedUpdate = mergeChunkUpdates(chunkUpdateA, chunkUpdateB);
            if (mergedUpdate != null) {
                chunks[chunkPath] = mergedUpdate;
            }
        } else {
            chunks[chunkPath] = chunkUpdateA;
        }
    }
    for (const [chunkPath, chunkUpdateB] of Object.entries(chunksB)){
        if (chunks[chunkPath] == null) {
            chunks[chunkPath] = chunkUpdateB;
        }
    }
    return chunks;
}
function mergeChunkUpdates(updateA, updateB) {
    if (updateA.type === 'added' && updateB.type === 'deleted' || updateA.type === 'deleted' && updateB.type === 'added') {
        return undefined;
    }
    if (updateA.type === 'partial') {
        invariant(updateA.instruction, 'Partial updates are unsupported');
    }
    if (updateB.type === 'partial') {
        invariant(updateB.instruction, 'Partial updates are unsupported');
    }
    return undefined;
}
function mergeChunkListEcmascriptMergedUpdates(mergedA, mergedB) {
    const entries = mergeEcmascriptChunkEntries(mergedA.entries, mergedB.entries);
    const chunks = mergeEcmascriptChunksUpdates(mergedA.chunks, mergedB.chunks);
    return {
        type: 'EcmascriptMergedUpdate',
        entries,
        chunks
    };
}
function mergeEcmascriptChunkEntries(entriesA, entriesB) {
    return {
        ...entriesA,
        ...entriesB
    };
}
function mergeEcmascriptChunksUpdates(chunksA, chunksB) {
    if (chunksA == null) {
        return chunksB;
    }
    if (chunksB == null) {
        return chunksA;
    }
    const chunks = {};
    for (const [chunkPath, chunkUpdateA] of Object.entries(chunksA)){
        const chunkUpdateB = chunksB[chunkPath];
        if (chunkUpdateB != null) {
            const mergedUpdate = mergeEcmascriptChunkUpdates(chunkUpdateA, chunkUpdateB);
            if (mergedUpdate != null) {
                chunks[chunkPath] = mergedUpdate;
            }
        } else {
            chunks[chunkPath] = chunkUpdateA;
        }
    }
    for (const [chunkPath, chunkUpdateB] of Object.entries(chunksB)){
        if (chunks[chunkPath] == null) {
            chunks[chunkPath] = chunkUpdateB;
        }
    }
    if (Object.keys(chunks).length === 0) {
        return undefined;
    }
    return chunks;
}
function mergeEcmascriptChunkUpdates(updateA, updateB) {
    if (updateA.type === 'added' && updateB.type === 'deleted') {
        // These two completely cancel each other out.
        return undefined;
    }
    if (updateA.type === 'deleted' && updateB.type === 'added') {
        const added = [];
        const deleted = [];
        const deletedModules = new Set(updateA.modules ?? []);
        const addedModules = new Set(updateB.modules ?? []);
        for (const moduleId of addedModules){
            if (!deletedModules.has(moduleId)) {
                added.push(moduleId);
            }
        }
        for (const moduleId of deletedModules){
            if (!addedModules.has(moduleId)) {
                deleted.push(moduleId);
            }
        }
        if (added.length === 0 && deleted.length === 0) {
            return undefined;
        }
        return {
            type: 'partial',
            added,
            deleted
        };
    }
    if (updateA.type === 'partial' && updateB.type === 'partial') {
        const added = new Set([
            ...updateA.added ?? [],
            ...updateB.added ?? []
        ]);
        const deleted = new Set([
            ...updateA.deleted ?? [],
            ...updateB.deleted ?? []
        ]);
        if (updateB.added != null) {
            for (const moduleId of updateB.added){
                deleted.delete(moduleId);
            }
        }
        if (updateB.deleted != null) {
            for (const moduleId of updateB.deleted){
                added.delete(moduleId);
            }
        }
        return {
            type: 'partial',
            added: [
                ...added
            ],
            deleted: [
                ...deleted
            ]
        };
    }
    if (updateA.type === 'added' && updateB.type === 'partial') {
        const modules = new Set([
            ...updateA.modules ?? [],
            ...updateB.added ?? []
        ]);
        for (const moduleId of updateB.deleted ?? []){
            modules.delete(moduleId);
        }
        return {
            type: 'added',
            modules: [
                ...modules
            ]
        };
    }
    if (updateA.type === 'partial' && updateB.type === 'deleted') {
        // We could eagerly return `updateB` here, but this would potentially be
        // incorrect if `updateA` has added modules.
        const modules = new Set(updateB.modules ?? []);
        if (updateA.added != null) {
            for (const moduleId of updateA.added){
                modules.delete(moduleId);
            }
        }
        return {
            type: 'deleted',
            modules: [
                ...modules
            ]
        };
    }
    // Any other update combination is invalid.
    return undefined;
}
function invariant(_, message) {
    throw new Error(`Invariant: ${message}`);
}
const CRITICAL = [
    'bug',
    'error',
    'fatal'
];
function compareByList(list, a, b) {
    const aI = list.indexOf(a) + 1 || list.length;
    const bI = list.indexOf(b) + 1 || list.length;
    return aI - bI;
}
const chunksWithIssues = new Map();
function emitIssues() {
    const issues = [];
    const deduplicationSet = new Set();
    for (const [_, chunkIssues] of chunksWithIssues){
        for (const chunkIssue of chunkIssues){
            if (deduplicationSet.has(chunkIssue.formatted)) continue;
            issues.push(chunkIssue);
            deduplicationSet.add(chunkIssue.formatted);
        }
    }
    sortIssues(issues);
    hooks.issues(issues);
}
function handleIssues(msg) {
    const key = resourceKey(msg.resource);
    let hasCriticalIssues = false;
    for (const issue of msg.issues){
        if (CRITICAL.includes(issue.severity)) {
            hasCriticalIssues = true;
        }
    }
    if (msg.issues.length > 0) {
        chunksWithIssues.set(key, msg.issues);
    } else if (chunksWithIssues.has(key)) {
        chunksWithIssues.delete(key);
    }
    emitIssues();
    return hasCriticalIssues;
}
const SEVERITY_ORDER = [
    'bug',
    'fatal',
    'error',
    'warning',
    'info',
    'log'
];
const CATEGORY_ORDER = [
    'parse',
    'resolve',
    'code generation',
    'rendering',
    'typescript',
    'other'
];
function sortIssues(issues) {
    issues.sort((a, b)=>{
        const first = compareByList(SEVERITY_ORDER, a.severity, b.severity);
        if (first !== 0) return first;
        return compareByList(CATEGORY_ORDER, a.category, b.category);
    });
}
const hooks = {
    beforeRefresh: ()=>{},
    refresh: ()=>{},
    buildOk: ()=>{},
    issues: (_issues)=>{}
};
function setHooks(newHooks) {
    Object.assign(hooks, newHooks);
}
function handleSocketMessage(msg) {
    sortIssues(msg.issues);
    handleIssues(msg);
    switch(msg.type){
        case 'issues':
            break;
        case 'partial':
            // aggregate updates
            aggregateUpdates(msg);
            break;
        default:
            // run single update
            const runHooks = chunkListsWithPendingUpdates.size === 0;
            if (runHooks) hooks.beforeRefresh();
            triggerUpdate(msg);
            if (runHooks) finalizeUpdate();
            break;
    }
}
function finalizeUpdate() {
    hooks.refresh();
    hooks.buildOk();
    // This is used by the Next.js integration test suite to notify it when HMR
    // updates have been completed.
    // TODO: Only run this in test environments (gate by `process.env.__NEXT_TEST_MODE`)
    if (globalThis.__NEXT_HMR_CB) {
        globalThis.__NEXT_HMR_CB();
        globalThis.__NEXT_HMR_CB = null;
    }
}
function subscribeToChunkUpdate(chunkListPath, sendMessage, callback) {
    return subscribeToUpdate({
        path: chunkListPath
    }, sendMessage, callback);
}
function subscribeToUpdate(resource, sendMessage, callback) {
    const key = resourceKey(resource);
    let callbackSet;
    const existingCallbackSet = updateCallbackSets.get(key);
    if (!existingCallbackSet) {
        callbackSet = {
            callbacks: new Set([
                callback
            ]),
            unsubscribe: subscribeToUpdates(sendMessage, resource)
        };
        updateCallbackSets.set(key, callbackSet);
    } else {
        existingCallbackSet.callbacks.add(callback);
        callbackSet = existingCallbackSet;
    }
    return ()=>{
        callbackSet.callbacks.delete(callback);
        if (callbackSet.callbacks.size === 0) {
            callbackSet.unsubscribe();
            updateCallbackSets.delete(key);
        }
    };
}
function triggerUpdate(msg) {
    const key = resourceKey(msg.resource);
    const callbackSet = updateCallbackSets.get(key);
    if (!callbackSet) {
        return;
    }
    for (const callback of callbackSet.callbacks){
        callback(msg);
    }
    if (msg.type === 'notFound') {
        // This indicates that the resource which we subscribed to either does not exist or
        // has been deleted. In either case, we should clear all update callbacks, so if a
        // new subscription is created for the same resource, it will send a new "subscribe"
        // message to the server.
        // No need to send an "unsubscribe" message to the server, it will have already
        // dropped the update stream before sending the "notFound" message.
        updateCallbackSets.delete(key);
    }
}
}),
"[project]/src/types.ts [client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// src/types.ts
/**
 * カードオブジェクトの型定義
 */ __turbopack_context__.s([
    "ALL_COLORS",
    ()=>ALL_COLORS,
    "ALL_RARITIES",
    ()=>ALL_RARITIES,
    "ALL_TYPES",
    ()=>ALL_TYPES,
    "TYPE_PRIORITY",
    ()=>TYPE_PRIORITY
]);
const ALL_COLORS = [
    '赤',
    '緑',
    '青',
    '紫',
    '黒',
    '黄'
];
const ALL_RARITIES = [
    'L',
    'C',
    'UC',
    'R',
    'SR',
    'SEC',
    'P'
];
const ALL_TYPES = [
    'LEADER',
    'CHARACTER',
    'EVENT',
    'STAGE'
];
const TYPE_PRIORITY = ALL_TYPES;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/utils.ts [client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// src/utils.ts
__turbopack_context__.s([
    "deckSorter",
    ()=>deckSorter,
    "filterCards",
    ()=>filterCards,
    "getSavedDeckNames",
    ()=>getSavedDeckNames,
    "loadCardData",
    ()=>loadCardData,
    "loadDeckList",
    ()=>loadDeckList,
    "saveDeckList",
    ()=>saveDeckList
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2e$ts__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/types.ts [client] (ecmascript)");
;
let allCards = [];
const DECK_STORAGE_PREFIX = 'deckbuilder_';
const DECK_NAMES_KEY = 'deckbuilder_names';
// ===============================================
// 🧠 Python版ロジックの完全再現: ソート
// ===============================================
// 色の優先順位 (Python: color_priority)
const COLOR_MAP = {
    '赤': 0,
    '緑': 1,
    '青': 2,
    '紫': 3,
    '黒': 4,
    '黄': 5
};
/**
 * Pythonの `color_sort_key` を再現
 * 戻り値: [base_priority, type_rank, sub_priority, multi_flag]
 */ function getSortKeys(card) {
    const colorText = card.Color || '';
    const typeText = card.Type || '';
    // 色がない場合のフォールバック
    if (!colorText || colorText === '-') return [
        999,
        999,
        999,
        999
    ];
    // 色リストの解析 (例: "赤/緑" -> ["赤", "緑"])
    const foundColors = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["ALL_COLORS"].filter((c)=>colorText.includes(c));
    if (foundColors.length === 0) return [
        999,
        999,
        999,
        999
    ];
    const firstColor = foundColors[0];
    const basePriority = COLOR_MAP[firstColor] ?? 999;
    // 多色判定
    const isMulti = colorText.includes('/') || colorText.includes('／');
    const subColors = foundColors.filter((c)=>c !== firstColor);
    // サブカラーの優先度 (多色の場合のみ計算、単色は0)
    let subPriority = 0;
    if (isMulti && subColors.length > 0) {
        subPriority = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["ALL_COLORS"].indexOf(subColors[0]) + 1;
    }
    const multiFlag = isMulti ? 1 : 0;
    // タイプランク (LEADER=0, CHARACTER=1...)
    let typeRank = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["TYPE_PRIORITY"].indexOf(typeText);
    if (typeRank === -1) typeRank = 9;
    return [
        basePriority,
        typeRank,
        subPriority,
        multiFlag
    ];
}
/**
 * カードソート関数
 * Python: values.sort(key=lambda x: x["new_sort_key"])
 * new_sort_key = (type_rank, cost, base_priority, card_id) ※デッキ表示時
 * ここでは汎用的なリスト表示順（色優先）を実装します
 */ function cardSorter(a, b) {
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
function deckSorter(a, b) {
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
async function loadCardData() {
    if (allCards.length > 0) return allCards;
    try {
        const response = await fetch('/cardlist.json'); // 事前にpublicに配置が必要
        const data = await response.json();
        // データの整形（Pythonのload_data相当）
        const processedData = data.map((card)=>({
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
function filterCards(cards, filters, leaderId = null) {
    // リーダーが設定されている場合の色フィルタリング用
    let validColors = [];
    if (leaderId) {
        const leader = cards.find((c)=>c.ID === leaderId);
        if (leader) {
            validColors = leader.Color.replace(/／/g, '/').split('/').filter(Boolean);
        }
    }
    return cards.filter((card)=>{
        // 1. パラレルモード (Normal / Parallel / Both)
        if (filters.parallel_mode === 'normal' && card.is_parallel) return false;
        if (filters.parallel_mode === 'parallel' && !card.is_parallel) return false;
        // 2. リーダー色縛り (デッキ作成モード時)
        // Python版では「リーダーがいるなら、LEADER以外のカードはリーダーの色を含む必要がある」
        if (leaderId && !card.Type.includes('LEADER')) {
            const cardColors = card.Color.replace(/／/g, '/').split('/');
            const hasMatch = cardColors.some((c)=>validColors.includes(c));
            if (!hasMatch) return false;
        }
        // 3. 基本フィルタ
        if (filters.search_query) {
            const q = filters.search_query.toLowerCase();
            const match = card.Name.toLowerCase().includes(q) || card.Effect?.toLowerCase().includes(q) || card.Feature?.toLowerCase().includes(q) || card.Trigger?.toLowerCase().includes(q);
            if (!match) return false;
        }
        // Color (配列チェック)
        if (filters.color.length > 0) {
            const cardColors = card.Color.replace(/／/g, '/').split('/');
            if (!filters.color.some((c)=>cardColors.includes(c))) return false;
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
            if (!filters.attribute.some((a)=>attrs.includes(a))) return false;
        }
        // Feature
        if (filters.feature.length > 0) {
            const feats = card.Feature.split('/');
            if (!filters.feature.some((f)=>feats.includes(f))) return false;
        }
        // SeriesID
        if (filters.series_id.length > 0 && !filters.series_id.includes(card.SeriesID)) return false;
        return true;
    });
}
function saveDeckList(name, deckList, leaderId) {
    const key = DECK_STORAGE_PREFIX + name;
    localStorage.setItem(key, JSON.stringify({
        deckList,
        leaderId
    }));
    const savedNames = getSavedDeckNames();
    if (!savedNames.includes(name)) {
        savedNames.push(name);
        localStorage.setItem(DECK_NAMES_KEY, JSON.stringify(savedNames));
    }
}
function loadDeckList(name) {
    return JSON.parse(localStorage.getItem(DECK_STORAGE_PREFIX + name) || 'null');
}
function getSavedDeckNames() {
    return JSON.parse(localStorage.getItem(DECK_NAMES_KEY) || '[]');
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/CardItem.tsx [client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// src/components/CardItem.tsx
__turbopack_context__.s([
    "CardItem",
    ()=>CardItem
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/react/jsx-dev-runtime.js [client] (ecmascript)");
;
const CardItem = ({ card, currentCount, isLeader, isCurrentLeader, updateDeckCount })=>{
    // 💡 Pythonロジックの再現: ＋ボタンの無効化条件を設定
    const disableAdd = // リーダーカードで、既にデッキに含まれている場合は追加不可 (1枚制限)
    isLeader && isCurrentLeader || !isLeader && currentCount >= 4;
    // 💡 Pythonロジックの再現: −ボタンの無効化条件を設定
    const disableSub = currentCount === 0;
    // 💡 Pythonロジックの再現: カウント表示とリーダー表示
    const countDisplay = isLeader ? isCurrentLeader ? 'LEADER' : '0' : `(${currentCount}/4枚)`; // 非リーダーの場合は '(X/4枚)'
    const countColor = isLeader ? 'text-purple-600' : currentCount > 0 ? 'text-blue-600' : 'text-gray-500';
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "w-full flex flex-col items-center border border-gray-200 rounded-lg p-1 transition shadow-sm hover:shadow-md bg-white",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "w-full aspect-[2/3] overflow-hidden rounded mb-1",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("img", {
                    src: card.ImgUrl,
                    alt: card.Name,
                    className: "w-full h-full object-contain"
                }, void 0, false, {
                    fileName: "[project]/src/components/CardItem.tsx",
                    lineNumber: 39,
                    columnNumber: 17
                }, ("TURBOPACK compile-time value", void 0))
            }, void 0, false, {
                fileName: "[project]/src/components/CardItem.tsx",
                lineNumber: 38,
                columnNumber: 13
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "w-full text-center text-sm mb-1",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: `font-bold ${countColor}`,
                        children: countDisplay
                    }, void 0, false, {
                        fileName: "[project]/src/components/CardItem.tsx",
                        lineNumber: 48,
                        columnNumber: 17
                    }, ("TURBOPACK compile-time value", void 0)),
                    card.is_parallel && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "text-xs text-yellow-500 ml-1",
                        children: "✨P"
                    }, void 0, false, {
                        fileName: "[project]/src/components/CardItem.tsx",
                        lineNumber: 50,
                        columnNumber: 38
                    }, ("TURBOPACK compile-time value", void 0))
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/CardItem.tsx",
                lineNumber: 47,
                columnNumber: 13
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex w-full space-x-1",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        onClick: ()=>updateDeckCount(card.ID, 1),
                        disabled: disableAdd,
                        className: "flex-1 bg-green-500 hover:bg-green-600 text-white text-xs py-1 rounded disabled:bg-gray-400",
                        children: "＋"
                    }, void 0, false, {
                        fileName: "[project]/src/components/CardItem.tsx",
                        lineNumber: 54,
                        columnNumber: 17
                    }, ("TURBOPACK compile-time value", void 0)),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        onClick: ()=>updateDeckCount(card.ID, -1),
                        disabled: disableSub,
                        className: "flex-1 bg-red-500 hover:bg-red-600 text-white text-xs py-1 rounded disabled:bg-gray-400",
                        children: "−"
                    }, void 0, false, {
                        fileName: "[project]/src/components/CardItem.tsx",
                        lineNumber: 61,
                        columnNumber: 17
                    }, ("TURBOPACK compile-time value", void 0))
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/CardItem.tsx",
                lineNumber: 53,
                columnNumber: 13
            }, ("TURBOPACK compile-time value", void 0))
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/CardItem.tsx",
        lineNumber: 35,
        columnNumber: 9
    }, ("TURBOPACK compile-time value", void 0));
};
_c = CardItem;
var _c;
__turbopack_context__.k.register(_c, "CardItem");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/FilterControls.tsx [client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// src/components/FilterControls.tsx
__turbopack_context__.s([
    "FilterControls",
    ()=>FilterControls
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/react/jsx-dev-runtime.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2e$ts__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/types.ts [client] (ecmascript)");
;
;
const FilterControls = ({ filterState, setFilterState, options })=>{
    const handleChange = (key, value)=>{
        setFilterState((p)=>({
                ...p,
                [key]: value
            }));
    };
    const handleMultiSelectChange = (key, e)=>{
        const selectedOptions = Array.from(e.target.selectedOptions, (option)=>option.value);
        handleChange(key, selectedOptions);
    };
    const handleNumberMultiSelectChange = (key, e)=>{
        const selectedOptions = Array.from(e.target.selectedOptions, (option)=>parseInt(option.value, 10));
        handleChange(key, selectedOptions);
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "space-y-3",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                className: "font-semibold border-b pb-1",
                children: "検索フィルター"
            }, void 0, false, {
                fileName: "[project]/src/components/FilterControls.tsx",
                lineNumber: 40,
                columnNumber: 7
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                type: "text",
                placeholder: "カード名 / テキスト / 特徴",
                value: filterState.search_query,
                onChange: (e)=>handleChange('search_query', e.target.value),
                className: "w-full border p-2 rounded text-sm"
            }, void 0, false, {
                fileName: "[project]/src/components/FilterControls.tsx",
                lineNumber: 43,
                columnNumber: 7
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                        className: "block text-xs font-medium mb-1",
                        children: "色"
                    }, void 0, false, {
                        fileName: "[project]/src/components/FilterControls.tsx",
                        lineNumber: 53,
                        columnNumber: 9
                    }, ("TURBOPACK compile-time value", void 0)),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                        multiple: true,
                        value: filterState.color,
                        onChange: (e)=>handleMultiSelectChange('color', e),
                        className: "w-full border p-1 rounded text-sm h-24",
                        children: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["ALL_COLORS"].map((color)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                value: color,
                                children: color
                            }, color, false, {
                                fileName: "[project]/src/components/FilterControls.tsx",
                                lineNumber: 61,
                                columnNumber: 13
                            }, ("TURBOPACK compile-time value", void 0)))
                    }, void 0, false, {
                        fileName: "[project]/src/components/FilterControls.tsx",
                        lineNumber: 54,
                        columnNumber: 9
                    }, ("TURBOPACK compile-time value", void 0))
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/FilterControls.tsx",
                lineNumber: 52,
                columnNumber: 7
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                        className: "block text-xs font-medium mb-1",
                        children: "タイプ"
                    }, void 0, false, {
                        fileName: "[project]/src/components/FilterControls.tsx",
                        lineNumber: 68,
                        columnNumber: 9
                    }, ("TURBOPACK compile-time value", void 0)),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                        multiple: true,
                        value: filterState.card_type,
                        onChange: (e)=>handleMultiSelectChange('card_type', e),
                        className: "w-full border p-1 rounded text-sm h-20",
                        children: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$types$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["ALL_TYPES"].map((type)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                value: type,
                                children: type
                            }, type, false, {
                                fileName: "[project]/src/components/FilterControls.tsx",
                                lineNumber: 76,
                                columnNumber: 13
                            }, ("TURBOPACK compile-time value", void 0)))
                    }, void 0, false, {
                        fileName: "[project]/src/components/FilterControls.tsx",
                        lineNumber: 69,
                        columnNumber: 9
                    }, ("TURBOPACK compile-time value", void 0))
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/FilterControls.tsx",
                lineNumber: 67,
                columnNumber: 7
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                        className: "block text-xs font-medium mb-1",
                        children: "コスト"
                    }, void 0, false, {
                        fileName: "[project]/src/components/FilterControls.tsx",
                        lineNumber: 83,
                        columnNumber: 9
                    }, ("TURBOPACK compile-time value", void 0)),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                        multiple: true,
                        value: filterState.cost.map(String),
                        onChange: (e)=>handleNumberMultiSelectChange('cost', e),
                        className: "w-full border p-1 rounded text-sm h-24",
                        children: options.costs.map((c)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                value: c,
                                children: c
                            }, c, false, {
                                fileName: "[project]/src/components/FilterControls.tsx",
                                lineNumber: 91,
                                columnNumber: 13
                            }, ("TURBOPACK compile-time value", void 0)))
                    }, void 0, false, {
                        fileName: "[project]/src/components/FilterControls.tsx",
                        lineNumber: 84,
                        columnNumber: 9
                    }, ("TURBOPACK compile-time value", void 0))
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/FilterControls.tsx",
                lineNumber: 82,
                columnNumber: 7
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                        className: "block text-xs font-medium mb-1",
                        children: "カウンター"
                    }, void 0, false, {
                        fileName: "[project]/src/components/FilterControls.tsx",
                        lineNumber: 98,
                        columnNumber: 9
                    }, ("TURBOPACK compile-time value", void 0)),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                        multiple: true,
                        value: filterState.counter.map(String),
                        onChange: (e)=>handleNumberMultiSelectChange('counter', e),
                        className: "w-full border p-1 rounded text-sm h-20",
                        children: options.counters.map((c)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                value: c === 0 ? 'なし (0)' : c,
                                children: c === 0 ? 'なし (0)' : c
                            }, c, false, {
                                fileName: "[project]/src/components/FilterControls.tsx",
                                lineNumber: 106,
                                columnNumber: 13
                            }, ("TURBOPACK compile-time value", void 0)))
                    }, void 0, false, {
                        fileName: "[project]/src/components/FilterControls.tsx",
                        lineNumber: 99,
                        columnNumber: 9
                    }, ("TURBOPACK compile-time value", void 0))
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/FilterControls.tsx",
                lineNumber: 97,
                columnNumber: 7
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                        className: "block text-xs font-medium mb-1",
                        children: "属性"
                    }, void 0, false, {
                        fileName: "[project]/src/components/FilterControls.tsx",
                        lineNumber: 113,
                        columnNumber: 9
                    }, ("TURBOPACK compile-time value", void 0)),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                        multiple: true,
                        value: filterState.attribute,
                        onChange: (e)=>handleMultiSelectChange('attribute', e),
                        className: "w-full border p-1 rounded text-sm h-24",
                        children: options.attributes.map((attr)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                value: attr,
                                children: attr
                            }, attr, false, {
                                fileName: "[project]/src/components/FilterControls.tsx",
                                lineNumber: 121,
                                columnNumber: 13
                            }, ("TURBOPACK compile-time value", void 0)))
                    }, void 0, false, {
                        fileName: "[project]/src/components/FilterControls.tsx",
                        lineNumber: 114,
                        columnNumber: 9
                    }, ("TURBOPACK compile-time value", void 0))
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/FilterControls.tsx",
                lineNumber: 112,
                columnNumber: 7
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                        className: "block text-xs font-medium mb-1",
                        children: "特徴"
                    }, void 0, false, {
                        fileName: "[project]/src/components/FilterControls.tsx",
                        lineNumber: 128,
                        columnNumber: 9
                    }, ("TURBOPACK compile-time value", void 0)),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                        multiple: true,
                        value: filterState.feature,
                        onChange: (e)=>handleMultiSelectChange('feature', e),
                        className: "w-full border p-1 rounded text-sm h-24",
                        children: options.features.map((f)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                value: f,
                                children: f
                            }, f, false, {
                                fileName: "[project]/src/components/FilterControls.tsx",
                                lineNumber: 136,
                                columnNumber: 13
                            }, ("TURBOPACK compile-time value", void 0)))
                    }, void 0, false, {
                        fileName: "[project]/src/components/FilterControls.tsx",
                        lineNumber: 129,
                        columnNumber: 9
                    }, ("TURBOPACK compile-time value", void 0))
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/FilterControls.tsx",
                lineNumber: 127,
                columnNumber: 7
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                        className: "block text-xs font-medium mb-1",
                        children: "入手シリーズ"
                    }, void 0, false, {
                        fileName: "[project]/src/components/FilterControls.tsx",
                        lineNumber: 143,
                        columnNumber: 9
                    }, ("TURBOPACK compile-time value", void 0)),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                        multiple: true,
                        value: filterState.series_id,
                        onChange: (e)=>handleMultiSelectChange('series_id', e),
                        className: "w-full border p-1 rounded text-sm h-24",
                        children: options.seriesIds.map((s)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                value: s,
                                children: s
                            }, s, false, {
                                fileName: "[project]/src/components/FilterControls.tsx",
                                lineNumber: 151,
                                columnNumber: 13
                            }, ("TURBOPACK compile-time value", void 0)))
                    }, void 0, false, {
                        fileName: "[project]/src/components/FilterControls.tsx",
                        lineNumber: 144,
                        columnNumber: 9
                    }, ("TURBOPACK compile-time value", void 0))
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/FilterControls.tsx",
                lineNumber: 142,
                columnNumber: 7
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                        className: "block text-xs font-medium mb-1",
                        children: "ブロックアイコン"
                    }, void 0, false, {
                        fileName: "[project]/src/components/FilterControls.tsx",
                        lineNumber: 158,
                        columnNumber: 9
                    }, ("TURBOPACK compile-time value", void 0)),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                        multiple: true,
                        value: filterState.block_icon,
                        onChange: (e)=>handleMultiSelectChange('block_icon', e),
                        className: "w-full border p-1 rounded text-sm h-16",
                        children: options.blockIcons.map((b)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                value: b,
                                children: b
                            }, b, false, {
                                fileName: "[project]/src/components/FilterControls.tsx",
                                lineNumber: 166,
                                columnNumber: 13
                            }, ("TURBOPACK compile-time value", void 0)))
                    }, void 0, false, {
                        fileName: "[project]/src/components/FilterControls.tsx",
                        lineNumber: 159,
                        columnNumber: 9
                    }, ("TURBOPACK compile-time value", void 0))
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/FilterControls.tsx",
                lineNumber: 157,
                columnNumber: 8
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "pt-2",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                        className: "block text-xs font-medium mb-1",
                        children: "カードバージョン"
                    }, void 0, false, {
                        fileName: "[project]/src/components/FilterControls.tsx",
                        lineNumber: 173,
                        columnNumber: 9
                    }, ("TURBOPACK compile-time value", void 0)),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex flex-col space-y-1 text-sm",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                className: "flex items-center",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                        type: "radio",
                                        name: "parallel_mode",
                                        value: "normal",
                                        checked: filterState.parallel_mode === 'normal',
                                        onChange: ()=>handleChange('parallel_mode', 'normal'),
                                        className: "mr-2"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/FilterControls.tsx",
                                        lineNumber: 176,
                                        columnNumber: 17
                                    }, ("TURBOPACK compile-time value", void 0)),
                                    "通常のみ"
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/FilterControls.tsx",
                                lineNumber: 175,
                                columnNumber: 13
                            }, ("TURBOPACK compile-time value", void 0)),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                className: "flex items-center",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                        type: "radio",
                                        name: "parallel_mode",
                                        value: "parallel",
                                        checked: filterState.parallel_mode === 'parallel',
                                        onChange: ()=>handleChange('parallel_mode', 'parallel'),
                                        className: "mr-2"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/FilterControls.tsx",
                                        lineNumber: 187,
                                        columnNumber: 17
                                    }, ("TURBOPACK compile-time value", void 0)),
                                    "パラレルのみ"
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/FilterControls.tsx",
                                lineNumber: 186,
                                columnNumber: 13
                            }, ("TURBOPACK compile-time value", void 0)),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                className: "flex items-center",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                        type: "radio",
                                        name: "parallel_mode",
                                        value: "both",
                                        checked: filterState.parallel_mode === 'both',
                                        onChange: ()=>handleChange('parallel_mode', 'both'),
                                        className: "mr-2"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/FilterControls.tsx",
                                        lineNumber: 198,
                                        columnNumber: 17
                                    }, ("TURBOPACK compile-time value", void 0)),
                                    "両方表示"
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/FilterControls.tsx",
                                lineNumber: 197,
                                columnNumber: 13
                            }, ("TURBOPACK compile-time value", void 0))
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/FilterControls.tsx",
                        lineNumber: 174,
                        columnNumber: 9
                    }, ("TURBOPACK compile-time value", void 0))
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/FilterControls.tsx",
                lineNumber: 172,
                columnNumber: 7
            }, ("TURBOPACK compile-time value", void 0))
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/FilterControls.tsx",
        lineNumber: 39,
        columnNumber: 5
    }, ("TURBOPACK compile-time value", void 0));
};
_c = FilterControls;
var _c;
__turbopack_context__.k.register(_c, "FilterControls");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/DeckManager.tsx [client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// src/components/DeckManager.tsx
__turbopack_context__.s([
    "DeckManager",
    ()=>DeckManager
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/react/jsx-dev-runtime.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/react/index.js [client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
;
const DeckManager = ({ appState, savedDeckNames, setAppState, handleSaveDeck, handleLoadDeck, handleQrImport, handleGenerateImage })=>{
    _s();
    const [deckNameInput, setDeckNameInput] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useState"])(''); // 💡 修正: デッキ名入力をローカルステートとして管理
    const [qrDataInput, setQrDataInput] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useState"])('');
    const deckCount = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "DeckManager.useMemo[deckCount]": ()=>{
            return Object.values(appState.deck).reduce({
                "DeckManager.useMemo[deckCount]": (sum, count)=>sum + count
            }["DeckManager.useMemo[deckCount]"], 0);
        }
    }["DeckManager.useMemo[deckCount]"], [
        appState.deck
    ]);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "space-y-4",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                className: "text-xl font-bold border-b pb-2",
                children: "デッキ管理"
            }, void 0, false, {
                fileName: "[project]/src/components/DeckManager.tsx",
                lineNumber: 34,
                columnNumber: 7
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "p-3 border rounded text-sm bg-gray-50",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        children: [
                            "合計枚数: ",
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "font-bold text-lg",
                                children: deckCount
                            }, void 0, false, {
                                fileName: "[project]/src/components/DeckManager.tsx",
                                lineNumber: 38,
                                columnNumber: 18
                            }, ("TURBOPACK compile-time value", void 0)),
                            " / 50"
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/DeckManager.tsx",
                        lineNumber: 38,
                        columnNumber: 9
                    }, ("TURBOPACK compile-time value", void 0)),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        children: [
                            "リーダーID: ",
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "font-bold",
                                children: appState.leaderCardId || '未設定'
                            }, void 0, false, {
                                fileName: "[project]/src/components/DeckManager.tsx",
                                lineNumber: 39,
                                columnNumber: 20
                            }, ("TURBOPACK compile-time value", void 0))
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/DeckManager.tsx",
                        lineNumber: 39,
                        columnNumber: 9
                    }, ("TURBOPACK compile-time value", void 0))
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/DeckManager.tsx",
                lineNumber: 37,
                columnNumber: 7
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "space-y-2",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                        type: "text",
                        placeholder: "デッキ名を入力",
                        value: deckNameInput,
                        onChange: (e)=>setDeckNameInput(e.target.value),
                        className: "w-full border p-2 rounded text-sm"
                    }, void 0, false, {
                        fileName: "[project]/src/components/DeckManager.tsx",
                        lineNumber: 44,
                        columnNumber: 9
                    }, ("TURBOPACK compile-time value", void 0)),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex space-x-2",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                onClick: ()=>handleSaveDeck(deckNameInput),
                                className: "flex-1 bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-2 rounded text-sm transition",
                                children: "保存"
                            }, void 0, false, {
                                fileName: "[project]/src/components/DeckManager.tsx",
                                lineNumber: 52,
                                columnNumber: 11
                            }, ("TURBOPACK compile-time value", void 0)),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                                onChange: (e)=>handleLoadDeck(e.target.value),
                                className: "flex-1 border p-2 rounded text-sm",
                                value: "",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                        value: "",
                                        disabled: true,
                                        children: "ロードするデッキを選択"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/DeckManager.tsx",
                                        lineNumber: 63,
                                        columnNumber: 13
                                    }, ("TURBOPACK compile-time value", void 0)),
                                    savedDeckNames.map((name)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                            value: name,
                                            children: name
                                        }, name, false, {
                                            fileName: "[project]/src/components/DeckManager.tsx",
                                            lineNumber: 65,
                                            columnNumber: 15
                                        }, ("TURBOPACK compile-time value", void 0)))
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/DeckManager.tsx",
                                lineNumber: 58,
                                columnNumber: 11
                            }, ("TURBOPACK compile-time value", void 0))
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/DeckManager.tsx",
                        lineNumber: 51,
                        columnNumber: 9
                    }, ("TURBOPACK compile-time value", void 0))
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/DeckManager.tsx",
                lineNumber: 43,
                columnNumber: 7
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                onClick: handleGenerateImage,
                className: "w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded text-sm transition",
                children: "デッキ画像を生成 (PNG)"
            }, void 0, false, {
                fileName: "[project]/src/components/DeckManager.tsx",
                lineNumber: 72,
                columnNumber: 7
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "space-y-2",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("textarea", {
                        placeholder: "QRコードから読み取ったデータをペースト",
                        value: qrDataInput,
                        onChange: (e)=>setQrDataInput(e.target.value),
                        className: "w-full border p-2 rounded text-sm h-16"
                    }, void 0, false, {
                        fileName: "[project]/src/components/DeckManager.tsx",
                        lineNumber: 81,
                        columnNumber: 9
                    }, ("TURBOPACK compile-time value", void 0)),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        onClick: ()=>handleQrImport(qrDataInput),
                        className: "w-full bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-2 px-4 rounded text-sm transition",
                        children: "QRデータからインポート"
                    }, void 0, false, {
                        fileName: "[project]/src/components/DeckManager.tsx",
                        lineNumber: 87,
                        columnNumber: 9
                    }, ("TURBOPACK compile-time value", void 0))
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/DeckManager.tsx",
                lineNumber: 80,
                columnNumber: 7
            }, ("TURBOPACK compile-time value", void 0))
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/DeckManager.tsx",
        lineNumber: 33,
        columnNumber: 5
    }, ("TURBOPACK compile-time value", void 0));
};
_s(DeckManager, "VXdr2AHnaY7byDTPG9Zmlqa0rkw=");
_c = DeckManager;
var _c;
__turbopack_context__.k.register(_c, "DeckManager");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/pages/index.tsx [client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// src/pages/index.tsx
__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/react/jsx-dev-runtime.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/react/index.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$utils$2e$ts__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/utils.ts [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$CardItem$2e$tsx__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/CardItem.tsx [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$FilterControls$2e$tsx__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/FilterControls.tsx [client] (ecmascript)"); // FilterOptionsをインポート
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$DeckManager$2e$tsx__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/DeckManager.tsx [client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
;
;
;
;
;
const INITIAL_FILTER_STATE = {
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
const INITIAL_APP_STATE = {
    deck: {},
    leaderCardId: null
};
const Home = ()=>{
    _s();
    const [allCards, setAllCards] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [appState, setAppState] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useState"])(INITIAL_APP_STATE);
    const [filterState, setFilterState] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useState"])(INITIAL_FILTER_STATE);
    const [loading, setLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useState"])(true);
    const [savedDeckNames, setSavedDeckNames] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const deckCount = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "Home.useMemo[deckCount]": ()=>{
            return Object.values(appState.deck).reduce({
                "Home.useMemo[deckCount]": (sum, count)=>sum + count
            }["Home.useMemo[deckCount]"], 0);
        }
    }["Home.useMemo[deckCount]"], [
        appState.deck
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "Home.useEffect": ()=>{
            const fetchCards = {
                "Home.useEffect.fetchCards": async ()=>{
                    setLoading(true);
                    const cards = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$utils$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["loadCardData"])();
                    setAllCards(cards);
                    setSavedDeckNames((0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$utils$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["getSavedDeckNames"])());
                    setLoading(false);
                }
            }["Home.useEffect.fetchCards"];
            fetchCards();
        }
    }["Home.useEffect"], []);
    // 💡 Python版のロジック再現: 全カードデータから選択肢を動的に生成
    const filterOptions = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "Home.useMemo[filterOptions]": ()=>{
            if (allCards.length === 0) {
                return {
                    costs: [],
                    counters: [],
                    attributes: [],
                    features: [],
                    blockIcons: [],
                    seriesIds: [],
                    triggers: []
                };
            }
            // 重複排除とソート用ヘルパー
            const uniqueSortedNumbers = {
                "Home.useMemo[filterOptions].uniqueSortedNumbers": (arr)=>Array.from(new Set(arr.filter({
                        "Home.useMemo[filterOptions].uniqueSortedNumbers": (v)=>v !== null
                    }["Home.useMemo[filterOptions].uniqueSortedNumbers"]))).sort({
                        "Home.useMemo[filterOptions].uniqueSortedNumbers": (a, b)=>a - b
                    }["Home.useMemo[filterOptions].uniqueSortedNumbers"])
            }["Home.useMemo[filterOptions].uniqueSortedNumbers"];
            const uniqueSortedStrings = {
                "Home.useMemo[filterOptions].uniqueSortedStrings": (arr)=>Array.from(new Set(arr.filter(Boolean))).sort()
            }["Home.useMemo[filterOptions].uniqueSortedStrings"];
            // コスト: sorted(df["コスト数値"].unique())
            const costs = uniqueSortedNumbers(allCards.map({
                "Home.useMemo[filterOptions].costs": (c)=>c.Cost
            }["Home.useMemo[filterOptions].costs"]));
            // カウンター: sorted(df["カウンター"].unique())
            // データがない場合は0として扱うロジックが含まれる場合がありますが、ここでは数値として存在するものを抽出
            const counters = uniqueSortedNumbers(allCards.map({
                "Home.useMemo[filterOptions].counters": (c)=>c.Counter
            }["Home.useMemo[filterOptions].counters"]));
            // 属性: "打/斬" のように / 区切りで格納されているため展開して集計
            // sorted({attr for lst in df["属性リスト"] for attr in lst if attr})
            const attributes = uniqueSortedStrings(allCards.flatMap({
                "Home.useMemo[filterOptions].attributes": (c)=>(c.Attribute || '').split('/')
            }["Home.useMemo[filterOptions].attributes"]));
            // 特徴: 同様に展開
            const features = uniqueSortedStrings(allCards.flatMap({
                "Home.useMemo[filterOptions].features": (c)=>(c.Feature || '').split('/')
            }["Home.useMemo[filterOptions].features"]));
            // ブロックアイコン
            const blockIcons = uniqueSortedStrings(allCards.map({
                "Home.useMemo[filterOptions].blockIcons": (c)=>c.BlockIcon
            }["Home.useMemo[filterOptions].blockIcons"]));
            // 入手シリーズ (utils.tsですでに【】の中身だけ抽出済み)
            const seriesIds = uniqueSortedStrings(allCards.map({
                "Home.useMemo[filterOptions].seriesIds": (c)=>c.SeriesID
            }["Home.useMemo[filterOptions].seriesIds"]));
            // トリガー
            const triggers = uniqueSortedStrings(allCards.map({
                "Home.useMemo[filterOptions].triggers": (c)=>c.Trigger
            }["Home.useMemo[filterOptions].triggers"]));
            return {
                costs,
                counters,
                attributes,
                features,
                blockIcons,
                seriesIds,
                triggers
            };
        }
    }["Home.useMemo[filterOptions]"], [
        allCards
    ]);
    const handleSaveDeck = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "Home.useCallback[handleSaveDeck]": (name)=>{
            if (!name.trim()) {
                alert("デッキ名を指定してください。");
                return;
            }
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$utils$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["saveDeckList"])(name, appState.deck, appState.leaderCardId);
            setSavedDeckNames((0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$utils$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["getSavedDeckNames"])());
            alert(`デッキ「${name}」を保存しました。`);
        }
    }["Home.useCallback[handleSaveDeck]"], [
        appState.deck,
        appState.leaderCardId
    ]);
    const handleLoadDeck = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "Home.useCallback[handleLoadDeck]": (name)=>{
            const loadedData = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$utils$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["loadDeckList"])(name);
            if (loadedData) {
                setAppState({
                    deck: loadedData.deckList,
                    leaderCardId: loadedData.leaderId
                });
                alert(`デッキ「${name}」をロードしました。`);
            } else {
                alert(`デッキ「${name}」が見つかりませんでした。`);
            }
        }
    }["Home.useCallback[handleLoadDeck]"], [
        setAppState
    ]);
    const handleQrImport = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "Home.useCallback[handleQrImport]": async (qrData)=>{
            try {
                const decodedData = JSON.parse(qrData);
                if (decodedData.deck && typeof decodedData.deck === 'object') {
                    setAppState({
                        deck: decodedData.deck,
                        leaderCardId: decodedData.leaderId || null
                    });
                    alert("QRコードからデッキをインポートしました。");
                } else {
                    throw new Error("QRデータの形式が正しくありません。");
                }
            } catch (e) {
                console.error("QRインポートエラー:", e);
                alert("QRコードの解析に失敗しました。");
            }
        }
    }["Home.useCallback[handleQrImport]"], [
        setAppState
    ]);
    const handleGenerateImage = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "Home.useCallback[handleGenerateImage]": async ()=>{
            if (!appState.leaderCardId) {
                alert("リーダーカードが設定されていません。");
                return;
            }
            try {
                const response = await fetch('/api/image-generator', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        deck: appState.deck,
                        leaderId: appState.leaderCardId,
                        // allCardsをAPIに渡す必要がある場合はここで渡す
                        allCards: allCards
                    })
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
        }
    }["Home.useCallback[handleGenerateImage]"], [
        appState.deck,
        appState.leaderCardId,
        allCards
    ]);
    const updateDeckCount = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "Home.useCallback[updateDeckCount]": (cardId, delta)=>{
            setAppState({
                "Home.useCallback[updateDeckCount]": (prevState)=>{
                    const newDeck = {
                        ...prevState.deck
                    };
                    const currentCount = newDeck[cardId] || 0;
                    const card = allCards.find({
                        "Home.useCallback[updateDeckCount].card": (c)=>c.ID === cardId
                    }["Home.useCallback[updateDeckCount].card"]);
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
                    return {
                        ...prevState,
                        deck: newDeck,
                        leaderCardId: newLeaderId
                    };
                }
            }["Home.useCallback[updateDeckCount]"]);
        }
    }["Home.useCallback[updateDeckCount]"], [
        allCards
    ]);
    const filteredCards = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "Home.useMemo[filteredCards]": ()=>{
            return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$utils$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["filterCards"])(allCards, filterState, appState.leaderCardId);
        }
    }["Home.useMemo[filteredCards]"], [
        allCards,
        filterState,
        appState.leaderCardId
    ]);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "container mx-auto p-4",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "flex flex-col lg:flex-row lg:space-x-6",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "w-full lg:w-1/4 space-y-4 mb-6 lg:mb-0",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$DeckManager$2e$tsx__$5b$client$5d$__$28$ecmascript$29$__["DeckManager"], {
                            appState: appState,
                            savedDeckNames: savedDeckNames,
                            setAppState: setAppState,
                            handleSaveDeck: handleSaveDeck,
                            handleLoadDeck: handleLoadDeck,
                            handleQrImport: handleQrImport,
                            handleGenerateImage: handleGenerateImage
                        }, void 0, false, {
                            fileName: "[project]/src/pages/index.tsx",
                            lineNumber: 211,
                            columnNumber: 17
                        }, ("TURBOPACK compile-time value", void 0)),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("hr", {
                            className: "my-4"
                        }, void 0, false, {
                            fileName: "[project]/src/pages/index.tsx",
                            lineNumber: 220,
                            columnNumber: 17
                        }, ("TURBOPACK compile-time value", void 0)),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$FilterControls$2e$tsx__$5b$client$5d$__$28$ecmascript$29$__["FilterControls"], {
                            filterState: filterState,
                            setFilterState: setFilterState,
                            options: filterOptions
                        }, void 0, false, {
                            fileName: "[project]/src/pages/index.tsx",
                            lineNumber: 221,
                            columnNumber: 17
                        }, ("TURBOPACK compile-time value", void 0))
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/pages/index.tsx",
                    lineNumber: 210,
                    columnNumber: 13
                }, ("TURBOPACK compile-time value", void 0)),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "w-full lg:w-3/4",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                            className: "text-2xl font-bold mb-4",
                            children: [
                                "カードリスト (",
                                deckCount,
                                "/50)"
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/pages/index.tsx",
                            lineNumber: 229,
                            columnNumber: 17
                        }, ("TURBOPACK compile-time value", void 0)),
                        loading ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            children: "カードデータをロード中です..."
                        }, void 0, false, {
                            fileName: "[project]/src/pages/index.tsx",
                            lineNumber: 231,
                            columnNumber: 21
                        }, ("TURBOPACK compile-time value", void 0)) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-4",
                            children: filteredCards.map((card)=>{
                                const currentCount = appState.deck[card.ID] || 0;
                                const isLeader = card.Type.includes('LEADER');
                                const isCurrentLeader = appState.leaderCardId === card.ID;
                                return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$CardItem$2e$tsx__$5b$client$5d$__$28$ecmascript$29$__["CardItem"], {
                                    card: card,
                                    currentCount: currentCount,
                                    isLeader: isLeader,
                                    isCurrentLeader: isCurrentLeader,
                                    updateDeckCount: updateDeckCount
                                }, card.ID, false, {
                                    fileName: "[project]/src/pages/index.tsx",
                                    lineNumber: 240,
                                    columnNumber: 33
                                }, ("TURBOPACK compile-time value", void 0));
                            })
                        }, void 0, false, {
                            fileName: "[project]/src/pages/index.tsx",
                            lineNumber: 233,
                            columnNumber: 21
                        }, ("TURBOPACK compile-time value", void 0))
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/pages/index.tsx",
                    lineNumber: 228,
                    columnNumber: 13
                }, ("TURBOPACK compile-time value", void 0))
            ]
        }, void 0, true, {
            fileName: "[project]/src/pages/index.tsx",
            lineNumber: 209,
            columnNumber: 9
        }, ("TURBOPACK compile-time value", void 0))
    }, void 0, false, {
        fileName: "[project]/src/pages/index.tsx",
        lineNumber: 208,
        columnNumber: 5
    }, ("TURBOPACK compile-time value", void 0));
};
_s(Home, "AJLRxoqCw2MLW8xUfhLOsvnqSmA=");
_c = Home;
const __TURBOPACK__default__export__ = Home;
var _c;
__turbopack_context__.k.register(_c, "Home");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[next]/entry/page-loader.ts { PAGE => \"[project]/src/pages/index.tsx [client] (ecmascript)\" } [client] (ecmascript)", ((__turbopack_context__, module, exports) => {

const PAGE_PATH = "/";
(window.__NEXT_P = window.__NEXT_P || []).push([
    PAGE_PATH,
    ()=>{
        return __turbopack_context__.r("[project]/src/pages/index.tsx [client] (ecmascript)");
    }
]);
// @ts-expect-error module.hot exists
if (module.hot) {
    // @ts-expect-error module.hot exists
    module.hot.dispose(function() {
        window.__NEXT_P.push([
            PAGE_PATH
        ]);
    });
}
}),
"[hmr-entry]/hmr-entry.js { ENTRY => \"[project]/src/pages/index\" }", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.r("[next]/entry/page-loader.ts { PAGE => \"[project]/src/pages/index.tsx [client] (ecmascript)\" } [client] (ecmascript)");
}),
]);

//# sourceMappingURL=%5Broot-of-the-server%5D__e9db54d9._.js.map