// src/pages/api/image-generator.ts
import { NextApiRequest, NextApiResponse } from 'next';
import sharp from 'sharp';
import axios from 'axios';
import QRCode from 'qrcode'; // npm install qrcode
import { DeckList, Card, ALL_COLORS, TYPE_PRIORITY } from '../../types';

// カードデータはサーバーサイドでもロードする必要があります
// 実際には utils.ts のロジックを再利用するか、JSONを直接読み込みます
// ここでは簡略化のため、リクエストボディにカード情報の詳細を含めるか、
// またはサーバー側で cardlist.json を読む実装にします。
// 今回は「URLから画像をダウンロードする」関数を実装します。

async function fetchImageBuffer(url: string): Promise<Buffer | null> {
    try {
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        return Buffer.from(response.data);
    } catch (error) {
        console.error(`Failed to fetch image: ${url}`);
        return null;
    }
}

// サーバーサイドでのソート用ヘルパー (utils.tsと同じロジックが必要)
// 簡略化したものをここに定義
const COLOR_MAP: Record<string, number> = { '赤': 0, '緑': 1, '青': 2, '紫': 3, '黒': 4, '黄': 5 };
function getSortKey(card: Card) {
    const colors = (card.Color || '').replace(/／/g, '/').split('/').filter(c => ALL_COLORS.includes(c));
    const base = colors.length > 0 ? COLOR_MAP[colors[0]] : 999;
    const typeRank = TYPE_PRIORITY.indexOf(card.Type) !== -1 ? TYPE_PRIORITY.indexOf(card.Type) : 9;
    return { base, typeRank, cost: card.Cost, id: card.ID };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

    // フロントエンドから fullCards データを送ってもらうか、ここで cardlist.json を読み込む
    // ここでは req.body に deckList と leaderId、そして簡易的な cardMap を受け取ると仮定
    // または、実際の運用ではここでJSONをfs.readFileSyncで読むのが一般的です。
    const { leaderId, deck, allCards } = req.body as { leaderId: string; deck: DeckList; allCards: Card[] };

    if (!leaderId || !deck) return res.status(400).json({ message: 'Missing data' });

    try {
        const FINAL_WIDTH = 2150;
        const FINAL_HEIGHT = 2048;
        
        // 1. リーダー情報の取得
        const leader = allCards.find(c => c.ID === leaderId);
        if (!leader) throw new Error('Leader not found');

        // 2. デッキ内カードの展開とソート
        const deckCards: { card: Card; count: number }[] = [];
        Object.entries(deck).forEach(([id, count]) => {
            const card = allCards.find(c => c.ID === id);
            if (card) deckCards.push({ card, count });
        });

        // Python版と同じソート順: Type -> Cost -> Color -> ID
        deckCards.sort((a, b) => {
            const keyA = getSortKey(a.card);
            const keyB = getSortKey(b.card);
            if (keyA.typeRank !== keyB.typeRank) return keyA.typeRank - keyB.typeRank;
            if (keyA.cost !== keyB.cost) return keyA.cost - keyB.cost;
            if (keyA.base !== keyB.base) return keyA.base - keyB.base;
            return keyA.id.localeCompare(keyB.id);
        });

        // 3. 背景グラデーションの作成 (SVGを使用)
        const leaderColors = leader.Color.replace(/／/g, '/').split('/').filter(Boolean);
        const colorMapHex: Record<string, string> = {
            "赤": "#AC1122", "緑": "#008866", "青": "#0084BD",
            "紫": "#93388B", "黒": "#211818", "黄": "#F7E731"
        };
        const bgColors = leaderColors.map(c => colorMapHex[c] || "#FFFFFF");
        
        // SVGでグラデーション定義
        let svgGradient = '';
        if (bgColors.length <= 1) {
            svgGradient = `<rect width="${FINAL_WIDTH}" height="${FINAL_HEIGHT}" fill="${bgColors[0] || '#FFFFFF'}" />`;
        } else {
            const stops = bgColors.map((color, i) => {
                const offset = (i / (bgColors.length - 1)) * 100;
                return `<stop offset="${offset}%" stop-color="${color}" />`;
            }).join('');
            svgGradient = `
                <defs>
                    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="0%">
                        ${stops}
                    </linearGradient>
                </defs>
                <rect width="${FINAL_WIDTH}" height="${FINAL_HEIGHT}" fill="url(#grad)" />
            `;
        }

        // 4. デッキリストテキストとQRコード生成
        const deckLines = [`1x${leader.ID}`];
        deckCards.forEach(item => deckLines.push(`${item.count}x${item.card.ID}`));
        const deckText = deckLines.join('\n');
        
        const qrBuffer = await QRCode.toBuffer(deckText, { width: 400, margin: 2 });

        // 5. テキスト描画用SVG (デッキ名など)
        // Python版ではデッキ名を描画していましたが、ここでは固定文字かリクエストから取得
        const deckName = (req.body.deckName || 'Deck List');
        const textSvg = `
            <svg width="${FINAL_WIDTH}" height="${FINAL_HEIGHT}">
                <style>
                    .title { fill: white; font-size: 70px; font-weight: bold; font-family: sans-serif; }
                    .bg { fill: rgba(0,0,0,0.5); }
                </style>
                <rect x="750" y="200" width="800" height="120" rx="10" class="bg" />
                <text x="1150" y="285" text-anchor="middle" class="title">${deckName}</text>
            </svg>
        `;

        // 6. 画像合成レイヤーの作成
        const composites: sharp.OverlayOptions[] = [];

        // (A) QRコード配置 (右上)
        composites.push({ input: qrBuffer, top: 50, left: FINAL_WIDTH - 450 });

        // (B) リーダー画像配置 (左上)
        // Python: GAP=48, UPPER_HEIGHT=548 程度
        const leaderBuffer = await fetchImageBuffer(leader.ImgUrl);
        if (leaderBuffer) {
            // リーダーは上半分をクロップして表示
            const resizedLeader = await sharp(leaderBuffer)
                .resize(400, null) // 幅400
                .extract({ left: 0, top: 0, width: 400, height: 550 }) // 上部切り出し
                .toBuffer();
            composites.push({ input: resizedLeader, top: 48, left: 48 });
        }
        
        // (C) テキストレイヤー
        composites.push({ input: Buffer.from(textSvg), top: 0, left: 0 });

        // (D) デッキカード配置 (グリッド)
        const GRID_START_Y = 548 + 50; // UPPER_HEIGHT + margin
        const CARD_WIDTH = 215;
        const CARD_HEIGHT = 300;
        const COLS = 10;
        const MARGIN = 0;
        
        // グリッド全体の開始X位置計算 (センタリング)
        const gridTotalWidth = (CARD_WIDTH * COLS) + (MARGIN * (COLS - 1));
        const GRID_START_X = Math.floor((FINAL_WIDTH - gridTotalWidth) / 2);

        // カード画像の取得と配置
        // 重複カードをフラットな配列に展開
        const flatCardIds: string[] = [];
        deckCards.forEach(item => {
            for(let i=0; i<item.count; i++) flatCardIds.push(item.card.ID);
        });

        // 必要な画像のユニークIDリスト
        const uniqueIds = [...new Set(flatCardIds)];
        const imageBuffers: Record<string, Buffer> = {};
        
        // 並列ダウンロード
        await Promise.all(uniqueIds.map(async (id) => {
            const card = allCards.find(c => c.ID === id);
            if (card) {
                const buf = await fetchImageBuffer(card.ImgUrl);
                if (buf) {
                    // リサイズしておく
                    imageBuffers[id] = await sharp(buf).resize(CARD_WIDTH, CARD_HEIGHT).toBuffer();
                }
            }
        }));

        // グリッド配置
        flatCardIds.forEach((id, index) => {
            const buf = imageBuffers[id];
            if (!buf) return;

            const row = Math.floor(index / COLS);
            const col = index % COLS;
            
            const x = GRID_START_X + col * (CARD_WIDTH + MARGIN);
            const y = GRID_START_Y + row * (CARD_HEIGHT + MARGIN);

            composites.push({ input: buf, top: y, left: x });
        });

        // 7. 最終合成
        const finalImage = await sharp({
            create: {
                width: FINAL_WIDTH,
                height: FINAL_HEIGHT,
                channels: 4,
                background: { r: 0, g: 0, b: 0, alpha: 0 }
            }
        })
        .composite([
            { input: Buffer.from(`<svg><rect width="${FINAL_WIDTH}" height="${FINAL_HEIGHT}" fill="white"/></svg>`), blend: 'dest-over' }, // ベース白
            { input: Buffer.from(`<svg width="${FINAL_WIDTH}" height="${FINAL_HEIGHT}">${svgGradient}</svg>`), top: 0, left: 0 }, // グラデーション
            ...composites
        ])
        .png()
        .toBuffer();

        res.setHeader('Content-Type', 'image/png');
        res.send(finalImage);

    } catch (error) {
        console.error('Generator error:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
}