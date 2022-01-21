const crypto = require('crypto');

// Headers name
const TWITCH_MESSAGE_ID = 'Twitch-Eventsub-Message-Id';
const TWITCH_MESSAGE_TIMESTAMP = 'Twitch-Eventsub-Message-Timestamp';
const TWITCH_MESSAGE_SIGNATURE = 'Twitch-Eventsub-Message-Signature';
const MESSAGE_TYPE = 'Twitch-Eventsub-Message-Type';

// Notification message types
const MESSAGE_TYPE_VERIFICATION = 'webhook_callback_verification';
const MESSAGE_TYPE_NOTIFICATION = 'notification';
const MESSAGE_TYPE_REVOCATION = 'revocation';

const isChallenge = (messageType) => messageType === MESSAGE_TYPE_VERIFICATION;
const isNotification = (messageType) =>
  messageType === MESSAGE_TYPE_NOTIFICATION;
const isRevocation = (messageType) => messageType === MESSAGE_TYPE_REVOCATION;

const handleChallenge = (body) => body.challenge;

/**
 * Looks for the header nammes `headerName` in the object `headers`. If `headerName` can't be find,
 * this function will check for the lower-case version of `headerName`.
 *
 * For example, `getHeader({ 'x-api-token': '123' }, 'X-Api-Token');` will return `'123'`
 * @param headers {object} Map of name:value headers
 * @param headerName {string} the header we're looking for
 * @returns {string | null} result
 */
const getHeader = (headers, headerName) => {
  return headers?.[headerName] || headers?.[headerName.toLowerCase()];
};

/**
 * Check the signature of an incoming message from (presumably) Twitch.
 * @param headers {object} Map of name:value headers
 * @param body {string} body of the incoming request
 * @param secret {string} secret to use for the signature check - the default value is the test secret from Twitch - not an actual secret ;)
 * @param verbose {boolean} Whether this function should log a log of things. Default to false.
 * @returns {object} If the verification failed, returns { verificationStatus: false }, otherwise returns { verificationStatus: true, parsedBody: object, messageType: string }
 */
const signatureCheck = (
  headers,
  body,
  secret = '5f1a6e7cd2e7137ccf9e15b2f43fe63949eb84b1db83c1d5a867dc93429de4e4',
  verbose = false
) => {
  // Headers
  const incomingMessageID = getHeader(headers, TWITCH_MESSAGE_ID);
  const incomingMessageTimestamp = getHeader(headers, TWITCH_MESSAGE_TIMESTAMP);
  const incomingMessageSignature = getHeader(headers, TWITCH_MESSAGE_SIGNATURE);
  const incomingMessageType = getHeader(headers, MESSAGE_TYPE);
  if (
    !incomingMessageID ||
    !incomingMessageTimestamp ||
    !incomingMessageSignature ||
    !incomingMessageType
  ) {
    console.error(
      '@tiphbot/twitch-eventsub-sigcheck',
      `Missing at least one required header ! ${headers.toString()}`
    );

    return { verificationStatus: false };
  }

  // Body
  if (!body) {
    console.error('@tiphbot/twitch-eventsub-sigcheck', 'Body must be defined.');

    return { verificationStatus: false };
  }

  let parsedBody = null;
  try {
    parsedBody = JSON.parse(body);
  } catch (e) {
    console.warn(
      '@tiphbot/twitch-eventsub-sigcheck',
      "Warn: received body was not JSON-serializable. That's weird. We go:",
      body.toString()
    );
  }

  // Compute HMAC signature
  const message = `${incomingMessageID}${incomingMessageTimestamp}${body}`;
  const hmacSig = crypto
    .createHmac('sha256', secret)
    .update(message)
    .digest('hex');
  const computedHmacSignature = `sha256=${hmacSig}`;

  // Signature Check
  if (
    !crypto.timingSafeEqual(
      Buffer.from(computedHmacSignature),
      Buffer.from(incomingMessageSignature)
    )
  ) {
    console.error('@tiphbot/twitch-eventsub-sigcheck', 'Sigcheck failed !');
    console.error('Expected: ', Buffer.from(computedHmacSignature));
    console.error('Got:      ', Buffer.from(incomingMessageSignature));

    return { verificationStatus: false };
  }

  verbose && console.log('@tiphbot/twitch-eventsub-sigcheck', 'Sigcheck OK!');
  return {
    verificationStatus: true,
    messageType: incomingMessageType,
    parsedBody,
  };
};

module.exports = {
  signatureCheck,
  MESSAGE_TYPE_VERIFICATION,
  MESSAGE_TYPE_NOTIFICATION,
  MESSAGE_TYPE_REVOCATION,
  isChallenge,
  isNotification,
  isRevocation,
  handleChallenge,
};
