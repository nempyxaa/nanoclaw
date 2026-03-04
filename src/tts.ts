import { Channel, VoiceConfig } from './types.js';
import { MediaProcessor } from './media-processor.js';
import { logger } from './logger.js';

const DEFAULT_SUMMARY_THRESHOLD = 200;

function stripMarkdown(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // [text](url) → text
    .replace(/[*_~`]/g, '') // remove formatting chars
    .trim();
}

export async function sendVoiceDuplicate(
  channel: Channel,
  jid: string,
  text: string,
  voiceConfig: VoiceConfig,
  mediaProcessor: MediaProcessor,
): Promise<void> {
  if (!voiceConfig.enabled || !channel.sendVoice) return;

  const cleanText = stripMarkdown(text);
  if (!cleanText) return;

  const threshold = voiceConfig.summaryThreshold ?? DEFAULT_SUMMARY_THRESHOLD;

  try {
    let voiceText: string;
    if (cleanText.length < threshold) {
      voiceText = cleanText;
    } else {
      voiceText = await mediaProcessor.summarizeForVoice(cleanText);
    }

    // OpenAI TTS max input is 4096 chars
    const audio = await mediaProcessor.synthesizeVoice(
      voiceText.slice(0, 4096),
      voiceConfig.voice,
    );
    await channel.sendVoice(jid, audio);
  } catch (err) {
    logger.error({ jid, err }, 'Failed to send voice duplicate');
  }
}

export interface EditVoiceDebouncer {
  schedule(
    messageId: string,
    jid: string,
    text: string,
    voiceConfig: VoiceConfig,
    channel: Channel,
  ): void;
}

export function createEditVoiceDebouncer(
  mediaProcessor: MediaProcessor,
  delayMs: number = 5000,
): EditVoiceDebouncer {
  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  return {
    schedule(messageId, jid, text, voiceConfig, channel) {
      const existing = timers.get(messageId);
      if (existing) clearTimeout(existing);

      timers.set(
        messageId,
        setTimeout(async () => {
          timers.delete(messageId);
          await sendVoiceDuplicate(
            channel,
            jid,
            text,
            voiceConfig,
            mediaProcessor,
          );
        }, delayMs),
      );
    },
  };
}
