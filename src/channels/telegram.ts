import { Bot, InputFile } from 'grammy';

import { ASSISTANT_NAME, TRIGGER_PATTERN } from '../config.js';
import { logger } from '../logger.js';
import {
  Channel,
  OnChatMetadata,
  OnInboundMessage,
  RegisteredGroup,
} from '../types.js';
import { MediaProcessor } from '../media-processor.js';

export interface TelegramChannelOpts {
  onMessage: OnInboundMessage;
  onChatMetadata: OnChatMetadata;
  registeredGroups: () => Record<string, RegisteredGroup>;
}

export class TelegramChannel implements Channel {
  name = 'telegram';

  private bot: Bot | null = null;
  private opts: TelegramChannelOpts;
  private botToken: string;
  private mediaProcessor: MediaProcessor;

  constructor(botToken: string, opts: TelegramChannelOpts) {
    this.botToken = botToken;
    this.opts = opts;
    this.mediaProcessor = new MediaProcessor();
  }

  async connect(): Promise<void> {
    await this.mediaProcessor.init();
    this.bot = new Bot(this.botToken);

    // Command to get chat ID (useful for registration)
    this.bot.command('chatid', (ctx) => {
      const chatId = ctx.chat.id;
      const chatType = ctx.chat.type;
      const chatName =
        chatType === 'private'
          ? ctx.from?.first_name || 'Private'
          : (ctx.chat as any).title || 'Unknown';

      ctx.reply(
        `Chat ID: \`tg:${chatId}\`\nName: ${chatName}\nType: ${chatType}`,
        { parse_mode: 'Markdown' },
      );
    });

    // Command to check bot status
    this.bot.command('ping', (ctx) => {
      ctx.reply(`${ASSISTANT_NAME} is online.`);
    });

    this.bot.on('message:text', async (ctx) => {
      // Skip commands
      if (ctx.message.text.startsWith('/')) return;

      const chatJid = `tg:${ctx.chat.id}`;

      // Handle full voice request — reply to bot message with 🔊 or voice commands
      const trimmed = ctx.message.text.trim().toLowerCase();
      const isVoiceRequest =
        trimmed === '🔊' ||
        /^(озвуч|войс|voice|полная озвучка|full voice|read aloud|прочитай|давай)/i.test(
          trimmed,
        );
      if (isVoiceRequest && ctx.message.reply_to_message?.text) {
        const group = this.opts.registeredGroups()[chatJid];
        if (group?.voiceConfig?.enabled) {
          const replyText = ctx.message.reply_to_message.text;
          try {
            const audio = await this.mediaProcessor.synthesizeVoice(
              replyText.slice(0, 4096),
              group.voiceConfig.voice,
            );
            await this.sendVoice(chatJid, audio);
          } catch (err) {
            logger.error({ err }, 'Failed to handle 🔊 reply');
          }
          return;
        }
      }
      let content = ctx.message.text;
      const timestamp = new Date(ctx.message.date * 1000).toISOString();
      const senderName =
        ctx.from?.first_name ||
        ctx.from?.username ||
        ctx.from?.id.toString() ||
        'Unknown';
      const sender = ctx.from?.id.toString() || '';
      const msgId = ctx.message.message_id.toString();

      // Determine chat name
      const chatName =
        ctx.chat.type === 'private'
          ? senderName
          : (ctx.chat as any).title || chatJid;

      // Translate Telegram @bot_username mentions into TRIGGER_PATTERN format.
      // Telegram @mentions (e.g., @andy_ai_bot) won't match TRIGGER_PATTERN
      // (e.g., ^@Andy\b), so we prepend the trigger when the bot is @mentioned.
      const botUsername = ctx.me?.username?.toLowerCase();
      if (botUsername) {
        const entities = ctx.message.entities || [];
        const isBotMentioned = entities.some((entity) => {
          if (entity.type === 'mention') {
            const mentionText = content
              .substring(entity.offset, entity.offset + entity.length)
              .toLowerCase();
            return mentionText === `@${botUsername}`;
          }
          return false;
        });
        if (isBotMentioned && !TRIGGER_PATTERN.test(content)) {
          content = `@${ASSISTANT_NAME} ${content}`;
        }
      }

      // Store chat metadata for discovery
      const isGroup =
        ctx.chat.type === 'group' || ctx.chat.type === 'supergroup';
      this.opts.onChatMetadata(
        chatJid,
        timestamp,
        chatName,
        'telegram',
        isGroup,
      );

      // Only deliver full message for registered groups
      const group = this.opts.registeredGroups()[chatJid];
      if (!group) {
        logger.debug(
          { chatJid, chatName },
          'Message from unregistered Telegram chat',
        );
        return;
      }

      // Deliver message — startMessageLoop() will pick it up
      this.opts.onMessage(chatJid, {
        id: msgId,
        chat_jid: chatJid,
        sender,
        sender_name: senderName,
        content,
        timestamp,
        is_from_me: false,
      });

      logger.info(
        { chatJid, chatName, sender: senderName },
        'Telegram message stored',
      );
    });

    // Handle photo messages
    this.bot.on('message:photo', async (ctx) => {
      const chatJid = `tg:${ctx.chat.id}`;
      const group = this.opts.registeredGroups()[chatJid];
      if (!group) return;

      try {
        // Get the largest photo
        const photo = ctx.message.photo[ctx.message.photo.length - 1];
        const file = await ctx.api.getFile(photo.file_id);
        const fileUrl = `https://api.telegram.org/file/bot${this.botToken}/${file.file_path}`;

        // Download and analyze
        const response = await fetch(fileUrl);
        const imageBuffer = Buffer.from(await response.arrayBuffer());
        const caption = ctx.message.caption;

        const content = await this.mediaProcessor.analyzeImage(
          imageBuffer,
          'image/jpeg',
          caption,
        );

        this.deliverMessage(ctx, chatJid, content);
      } catch (error) {
        logger.error({ error }, 'Failed to process photo');
        const caption = ctx.message.caption ? ` ${ctx.message.caption}` : '';
        this.deliverMessage(ctx, chatJid, `[Photo]${caption}`);
      }
    });

    // Handle voice messages
    this.bot.on('message:voice', async (ctx) => {
      const chatJid = `tg:${ctx.chat.id}`;
      const group = this.opts.registeredGroups()[chatJid];
      if (!group) return;

      try {
        const voice = ctx.message.voice;
        const file = await ctx.api.getFile(voice.file_id);
        const fileUrl = `https://api.telegram.org/file/bot${this.botToken}/${file.file_path}`;

        // Download voice file
        const filepath = await this.mediaProcessor.downloadFile(
          fileUrl,
          `voice_${Date.now()}.ogg`,
        );

        const caption = ctx.message.caption;
        const content = await this.mediaProcessor.transcribeVoice(
          filepath,
          caption,
        );

        this.deliverMessage(ctx, chatJid, content);
      } catch (error) {
        logger.error({ error }, 'Failed to process voice');
        const caption = ctx.message.caption ? ` ${ctx.message.caption}` : '';
        this.deliverMessage(ctx, chatJid, `[Voice message]${caption}`);
      }
    });

    // Handle non-text messages with placeholders so the agent knows something was sent
    const storeNonText = (ctx: any, placeholder: string) => {
      const chatJid = `tg:${ctx.chat.id}`;
      const group = this.opts.registeredGroups()[chatJid];
      if (!group) return;

      const caption = ctx.message.caption ? ` ${ctx.message.caption}` : '';
      this.deliverMessage(ctx, chatJid, `${placeholder}${caption}`);
    };

    this.bot.on('message:video', (ctx) => storeNonText(ctx, '[Video]'));
    this.bot.on('message:audio', (ctx) => storeNonText(ctx, '[Audio]'));
    this.bot.on('message:document', (ctx) => {
      const name = ctx.message.document?.file_name || 'file';
      storeNonText(ctx, `[Document: ${name}]`);
    });
    this.bot.on('message:sticker', (ctx) => {
      const emoji = ctx.message.sticker?.emoji || '';
      storeNonText(ctx, `[Sticker ${emoji}]`);
    });
    this.bot.on('message:location', (ctx) => storeNonText(ctx, '[Location]'));
    this.bot.on('message:contact', (ctx) => storeNonText(ctx, '[Contact]'));

    // Handle errors gracefully
    this.bot.catch((err) => {
      logger.error({ err: err.message }, 'Telegram bot error');
    });

    // Start polling — returns a Promise that resolves when started
    return new Promise<void>((resolve) => {
      this.bot!.start({
        onStart: (botInfo) => {
          logger.info(
            { username: botInfo.username, id: botInfo.id },
            'Telegram bot connected',
          );
          console.log(`\n  Telegram bot: @${botInfo.username}`);
          console.log(
            `  Send /chatid to the bot to get a chat's registration ID\n`,
          );
          resolve();
        },
      });
    });
  }

  private deliverMessage(ctx: any, chatJid: string, content: string): void {
    const timestamp = new Date(ctx.message.date * 1000).toISOString();
    const senderName =
      ctx.from?.first_name ||
      ctx.from?.username ||
      ctx.from?.id?.toString() ||
      'Unknown';
    const chatName =
      ctx.chat.type === 'private'
        ? senderName
        : (ctx.chat as any).title || chatJid;

    const isGroup = ctx.chat.type === 'group' || ctx.chat.type === 'supergroup';
    this.opts.onChatMetadata(chatJid, timestamp, chatName, 'telegram', isGroup);
    this.opts.onMessage(chatJid, {
      id: ctx.message.message_id.toString(),
      chat_jid: chatJid,
      sender: ctx.from?.id?.toString() || '',
      sender_name: senderName,
      content,
      timestamp,
      is_from_me: false,
    });

    logger.info(
      { chatJid, chatName, sender: senderName },
      'Telegram message stored',
    );
  }

  async sendMessage(jid: string, text: string): Promise<string | undefined> {
    if (!this.bot) {
      logger.warn('Telegram bot not initialized');
      return undefined;
    }

    try {
      const numericId = jid.replace(/^tg:/, '');

      // Telegram has a 4096 character limit per message — split if needed
      const MAX_LENGTH = 4096;
      const chunks =
        text.length <= MAX_LENGTH
          ? [text]
          : Array.from(
              { length: Math.ceil(text.length / MAX_LENGTH) },
              (_, i) => text.slice(i * MAX_LENGTH, (i + 1) * MAX_LENGTH),
            );

      let firstMessageId: string | undefined;
      for (const chunk of chunks) {
        try {
          const sent = await this.bot.api.sendMessage(numericId, chunk, {
            parse_mode: 'Markdown',
          });
          if (!firstMessageId) firstMessageId = sent.message_id.toString();
        } catch {
          // Markdown parsing failed (unmatched * or _) — send as plain text
          const sent = await this.bot.api.sendMessage(numericId, chunk);
          if (!firstMessageId) firstMessageId = sent.message_id.toString();
        }
      }
      logger.info({ jid, length: text.length }, 'Telegram message sent');
      return firstMessageId;
    } catch (err) {
      logger.error({ jid, err }, 'Failed to send Telegram message');
      return undefined;
    }
  }

  async editMessage(
    jid: string,
    messageId: string,
    text: string,
  ): Promise<void> {
    if (!this.bot) {
      logger.warn('Telegram bot not initialized');
      return;
    }

    const numericId = jid.replace(/^tg:/, '');
    try {
      await this.bot.api.editMessageText(
        numericId,
        parseInt(messageId, 10),
        text,
        { parse_mode: 'Markdown' },
      );
    } catch {
      try {
        await this.bot.api.editMessageText(
          numericId,
          parseInt(messageId, 10),
          text,
        );
      } catch (err) {
        logger.error(
          { jid, messageId, err },
          'Failed to edit Telegram message',
        );
      }
    }
  }

  async sendVoice(jid: string, audioBuffer: Buffer): Promise<void> {
    if (!this.bot) {
      logger.warn('Telegram bot not initialized');
      return;
    }
    const numericId = jid.replace(/^tg:/, '');
    try {
      await this.bot.api.sendVoice(
        numericId,
        new InputFile(audioBuffer, 'voice.ogg'),
      );
    } catch (err) {
      logger.error({ jid, err }, 'Failed to send voice message');
    }
  }

  isConnected(): boolean {
    return this.bot !== null;
  }

  ownsJid(jid: string): boolean {
    return jid.startsWith('tg:');
  }

  async disconnect(): Promise<void> {
    if (this.bot) {
      this.bot.stop();
      this.bot = null;
      logger.info('Telegram bot stopped');
    }
  }

  async setTyping(jid: string, isTyping: boolean): Promise<void> {
    if (!this.bot || !isTyping) return;
    try {
      const numericId = jid.replace(/^tg:/, '');
      await this.bot.api.sendChatAction(numericId, 'typing');
    } catch (err) {
      logger.debug({ jid, err }, 'Failed to send Telegram typing indicator');
    }
  }
}
