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
 * @returns {boolean} Whether the incoming message matches the signature.
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
    verbose &&
      console.log(
        `Missing at least one required header ! ${headers.toString()}`
      );

    return false;
  }

  if (!body) {
    verbose && console.log(`Body must be defined.`);

    return false;
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
    verbose &&
      console.log(`@tiphbot/twitch-eventsub-sigcheck: Sigcheck failed !`);

    return false;
  }

  verbose && console.log(`@tiphbot/twitch-eventsub-sigcheck: Sigcheck OK!`);

  if (MESSAGE_TYPE_NOTIFICATION === incomingMessageType) {
    return true;
  }

  if (MESSAGE_TYPE_VERIFICATION === incomingMessageType) {
    // @TODO: Handle Challenge?
    verbose &&
      console.log(
        '@tiphbot/twitch-eventsub-sigcheck: Unsupported (yet) event type `challenge`, returning true since signature matched tho.'
      );

    return true;
  }

  if (MESSAGE_TYPE_REVOCATION === incomingMessageType) {
    // @TODO: Handle Revocation?
    verbose &&
      console.log(
        '@tiphbot/twitch-eventsub-sigcheck: Unsupported (yet) event type `revocation`, returning true since signature matched tho.'
      );

    return true;
  }

  // @TODO: Handle unknown type?
  verbose &&
    console.log(
      `@tiphbot/twitch-eventsub-sigcheck: Unknown event type \`${incomingMessageType}\`, returning true since signature matched tho.`
    );
  return true;
};

module.exports = { signatureCheck };
