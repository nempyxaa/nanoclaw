import { ANFISA_WEBHOOK_URL } from './config.js';
import { logger } from './logger.js';

/**
 * Forward a message to Anfisa's webhook.
 * Fire-and-forget: failures are logged but don't block message delivery.
 */
export function notifyAnfisa(
  chatJid: string,
  text: string,
  sender?: string,
): void {
  if (!ANFISA_WEBHOOK_URL) return;

  fetch(ANFISA_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      source: 'gevo',
      chatJid,
      text,
      sender: sender || 'Gevo',
      timestamp: new Date().toISOString(),
    }),
    signal: AbortSignal.timeout(5000),
  })
    .then((response) => {
      if (!response.ok) {
        logger.warn(
          { status: response.status, chatJid },
          'Anfisa webhook returned non-OK status',
        );
      }
    })
    .catch((err) => {
      logger.warn({ err, chatJid }, 'Failed to notify Anfisa webhook');
    });
}
