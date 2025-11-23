// src/pages/api/image-generator.ts
import { NextApiRequest, NextApiResponse } from 'next';
import sharp from 'sharp'; // ⚠️ Node.js環境（Vercel API Route）でのみ動作
import axios from 'axios';
import { DeckList } from '../../types';

/**
 * 外部URLから画像を取得し、Bufferとして返す
 */
async function fetchImageBuffer(url: string): Promise<Buffer | null> {
    try {
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        return Buffer.from(response.data);
    } catch (error) {
        return null;
    }
}

/**
 * デッキリストを受け取り、画像を生成して返すAPI Route (create_deck_image の代替)
 */
export default async function imageGenerator(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { leaderId, deck } = req.body as { leaderId: string; deck: DeckList };
  
  if (!deck || Object.keys(deck).length === 0) {
    return res.status(400).json({ message: 'Deck data is required' });
  }

  try {
    const IMAGE_WIDTH = 1200;
    const IMAGE_HEIGHT = 800;
    
    // 1. ベースイメージの作成
    let finalImage = sharp({
      create: {
        width: IMAGE_WIDTH,
        height: IMAGE_HEIGHT,
        channels: 4,
        background: { r: 10, g: 10, b: 20, alpha: 1 }
      }
    });
    
    // 2. カード画像の合成、テキスト、QRコードの描画処理をここに追加
    // 💡 この部分はPythonのPILロジックをNode.js/Sharpに移植する最も重要な部分です。
    // (ここでは処理は省略されていますが、このファイルで実行する必要があります。)

    // 3. 最終的な画像をPNG形式でBufferに出力
    const outputBuffer = await finalImage
        .png()
        .toBuffer();

    // 4. 画像データをクライアントに返す
    res.setHeader('Content-Type', 'image/png');
    res.status(200).send(outputBuffer);

  } catch (error) {
    console.error('Image generation failed:', error);
    res.status(500).json({ message: 'Internal Server Error during image generation' });
  }
}