const axios = require('axios');
const {
  twitchClientId,
  discordWebhookToken,
  twitchClientSecret,
  twitchBroadcasterId,
  webhookSecret,
} = require('./secrets.json');
const {
  signatureCheck,
  isChallenge,
  handleChallenge,
} = require('@tiphbot/twitch-eventsub-sigcheck');

async function getTwitchToken() {
  const rawTokenInfo = await axios({
    method: 'post',
    url: `https://id.twitch.tv/oauth2/token?client_id=${twitchClientId}&client_secret=${twitchClientSecret}&grant_type=client_credentials`,
    headers: {},
  });

  const accessToken = rawTokenInfo?.data?.access_token;
  if (!accessToken) {
    throw new Error(
      'Could not find token inside response body. Body was: ' +
        rawTokenInfo.toString()
    );
  }

  return accessToken;
}

async function getStreamInfos(twitchAccessToken) {
  const rawStreamInfos = await axios({
    method: 'GET',
    url: `https://api.twitch.tv/helix/channels?broadcaster_id=${twitchBroadcasterId}`,
    headers: {
      Authorization: `Bearer ${twitchAccessToken}`,
      'Client-ID': twitchClientId,
    },
  });

  const streamInfos = rawStreamInfos?.data?.data?.[0];
  if (!streamInfos) {
    throw new Error(
      'no streamInfos received. Body was: ' + rawStreamInfos.toString()
    );
  }

  return streamInfos;
}

async function sendDiscordMessage({ title: streamTitle, game_name: gameName }) {
  const response = await axios({
    method: 'POST',
    url: `https://discord.com/api/webhooks/${discordWebhookToken}`,
    headers: {
      'Content-Type': 'application/json',
    },
    data: {
      content:
        'tiphedor est en live ! Venez le regarder !\n\n:arrow_forward:  [twitch.tv/tiphedor](https://twitch.tv/tiphedor)\n\n_ _',
      embeds: [
        {
          title: streamTitle,
          description: gameName,
          url: 'https://twitch.tv/tiphedor',
          color: 13917276,
          image: {
            url: 'https://static-cdn.jtvnw.net/previews-ttv/live_user_tiphedor-1920x1080.jpg',
          },
        },
      ],
    },
  });

  if (response?.data !== '') {
    throw new Error(
      'Could not send message to discord: ' + response.toString()
    );
  }
}

exports.handler = async (event, context, callback) => {
  const { verificationStatus, messageType, parsedBody } = signatureCheck(
    event.headers,
    event.body,
    webhookSecret,
    true
  );

  if (!verificationStatus) {
    return {
      statusCode: 403,
      body: JSON.stringify({
        ok: false,
        message:
          "sigcheck failed, you're not who you say you are, so fuck off!",
      }),
    };
  }

  console.log('Signature check OK !');
  console.log('=====================');
  console.log('Message type: ', messageType);
  console.log('Body:         ', JSON.stringify(parsedBody));

  if (isChallenge(messageType)) {
    console.log('about to ret');
    console.log(
      JSON.stringify({
        statusCode: 200,
        body: handleChallenge(parsedBody),
      })
    );
    return {
      statusCode: 200,
      body: handleChallenge(parsedBody),
    };
  }

  console.log('after');

  try {
    const twitchAccessToken = await getTwitchToken();
    const streamInfos = await getStreamInfos(twitchAccessToken);
    await sendDiscordMessage(streamInfos);

    console.log('everything is ok!');

    callback(null, {
      statusCode: 200,
      body: JSON.stringify({ ok: true }),
    });
  } catch (e) {
    console.log(e);

    callback(null, {
      statusCode: 500,
      body: JSON.stringify({ ok: false }),
    });
  }
};
