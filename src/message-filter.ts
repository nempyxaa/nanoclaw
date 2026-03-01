import { TRIGGER_PATTERN, ASSISTANT_NAME } from './config.js';
import { logger } from './logger.js';

// Rate limiting: track last response time per group
const lastResponseTime: Map<string, number> = new Map();
const MIN_RESPONSE_INTERVAL_MS = 10000; // 10 seconds between responses

/**
 * Smart message filtering to reduce unnecessary Claude API calls
 * Returns true if the message should be processed by Claude
 */
export function shouldProcessMessage(
  content: string,
  chatJid: string,
  senderName: string,
): boolean {
  const trimmed = content.trim();

  // ALWAYS process: Explicit triggers
  if (TRIGGER_PATTERN.test(trimmed)) {
    logger.debug({ content: trimmed.substring(0, 50) }, 'Message has trigger pattern');
    return true;
  }

  // ALWAYS process: Media messages (already have @Gevo prepended)
  if (trimmed.startsWith('[Photo:') || trimmed.startsWith('[Voice message:')) {
    logger.debug('Message is media (photo/voice)');
    return true;
  }

  // Rate limiting: Don't respond too frequently
  const lastResponse = lastResponseTime.get(chatJid) || 0;
  const timeSinceLastResponse = Date.now() - lastResponse;
  if (timeSinceLastResponse < MIN_RESPONSE_INTERVAL_MS) {
    logger.debug(
      { timeSinceLastResponse, minInterval: MIN_RESPONSE_INTERVAL_MS },
      'Rate limit: Too soon since last response',
    );
    return false;
  }

  // SKIP: Very short messages (likely casual chat)
  if (trimmed.length < 10) {
    logger.debug({ length: trimmed.length }, 'Message too short, skipping');
    return false;
  }

  // SKIP: Common greetings between people (not to bot)
  const casualPatterns = [
    /^(hi|hey|hello|привет|пока|bye|thanks|спасибо)\s*(Igor|Andy|Piotr|Петя|Игорь)/i,
    /^(good morning|good night|доброе утро|спокойной ночи)/i,
  ];
  if (casualPatterns.some(pattern => pattern.test(trimmed))) {
    logger.debug('Message is casual greeting between people');
    return false;
  }

  // PROCESS: Questions (contain ?)
  if (trimmed.includes('?')) {
    logger.debug('Message contains question mark');
    lastResponseTime.set(chatJid, Date.now());
    return true;
  }

  // PROCESS: Commands (imperative verbs)
  const commandPatterns = [
    /^(create|make|show|explain|tell|describe|analyze|help|помоги|создай|покажи|расскажи|объясни)/i,
  ];
  if (commandPatterns.some(pattern => pattern.test(trimmed))) {
    logger.debug('Message contains command verb');
    lastResponseTime.set(chatJid, Date.now());
    return true;
  }

  // PROCESS: Follow-ups (references to bot or previous context)
  const botNameLower = ASSISTANT_NAME.toLowerCase();
  const followUpPatterns = [
    new RegExp(`\\b(you|your|тебя|твой|${botNameLower})\\b`, 'i'),
    /\b(that|this|it|это|то|этого)\b.*\b(was|is|правильно|верно|good|bad)\b/i,
  ];
  if (followUpPatterns.some(pattern => pattern.test(trimmed))) {
    logger.debug('Message appears to be follow-up or reference');
    lastResponseTime.set(chatJid, Date.now());
    return true;
  }

  // DEFAULT: Skip to save costs
  logger.debug({ content: trimmed.substring(0, 50) }, 'Message does not match processing criteria, skipping');
  return false;
}

/**
 * Reset rate limiting for a group (call after bot sends a response)
 */
export function markResponseSent(chatJid: string): void {
  lastResponseTime.set(chatJid, Date.now());
}
