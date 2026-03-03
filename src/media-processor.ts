import OpenAI from 'openai';
import fs from 'fs/promises';
import path from 'path';
import fetch from 'node-fetch';
import { logger } from './logger.js';
import { ASSISTANT_NAME } from './config.js';

export class MediaProcessor {
  private tempDir: string;
  private openai: OpenAI | null = null;

  constructor(tempDir: string = '/tmp/nanoclaw-media') {
    this.tempDir = tempDir;
  }

  private getOpenAI(): OpenAI {
    if (!this.openai) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    }
    return this.openai;
  }

  async init(): Promise<void> {
    await fs.mkdir(this.tempDir, { recursive: true });
  }

  async downloadFile(url: string, filename: string): Promise<string> {
    const filepath = path.join(this.tempDir, filename);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.statusText}`);
    }
    const buffer = await response.buffer();
    await fs.writeFile(filepath, buffer);
    return filepath;
  }

  async analyzeImage(
    imageBuffer: Buffer,
    mimeType: string,
    caption?: string,
  ): Promise<string> {
    try {
      // Convert image to base64
      const base64Image = imageBuffer.toString('base64');

      // Create prompt
      const prompt = caption
        ? `Describe this image. User caption: ${caption}`
        : 'Describe this image in detail.';

      // Call OpenAI Vision API
      const response = await this.getOpenAI().chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${base64Image}`,
                },
              },
            ],
          },
        ],
        max_tokens: 500,
      });

      const description = response.choices[0]?.message?.content || '';

      // Always prepend @Gevo for photo messages so they trigger the bot
      const photoContent = description ? `[Photo: ${description}]` : '[Photo]';

      const content = `@${ASSISTANT_NAME} ${photoContent}`;

      return `${content}${caption ? ` Caption: ${caption}` : ''}`;
    } catch (error: any) {
      logger.error(
        {
          error: error?.message || String(error),
          stack: error?.stack,
        },
        'Failed to analyze image with OpenAI Vision',
      );

      return `[Photo]${caption ? ` Caption: ${caption}` : ''}`;
    }
  }

  async transcribeVoice(audioPath: string, caption?: string): Promise<string> {
    try {
      const audioFile = await fs.readFile(audioPath);
      const audioBlob = new Blob([audioFile]);
      const file = new File([audioBlob], path.basename(audioPath), {
        type: 'audio/ogg',
      });

      const transcription = await this.getOpenAI().audio.transcriptions.create({
        file: file as any,
        model: 'whisper-1',
      });

      // Clean up temp file
      await fs.unlink(audioPath).catch(() => {});

      const transcribedText = transcription.text;

      // Always prepend @Gevo for voice messages so they trigger the bot
      const content = `@${ASSISTANT_NAME} [Voice message: ${transcribedText}]`;

      return `${content}${caption ? ` Caption: ${caption}` : ''}`;
    } catch (error: any) {
      logger.error(
        {
          error: error?.message || String(error),
          stack: error?.stack,
          name: error?.name,
          status: error?.status,
        },
        'Failed to transcribe voice',
      );
      await fs.unlink(audioPath).catch(() => {});
      return `[Voice message]${caption ? ` Caption: ${caption}` : ''}`;
    }
  }
}
