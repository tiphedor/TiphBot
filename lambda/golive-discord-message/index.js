const https = require('https')
const {
  twitchClientId,
  discordWebhookToken,
  twitchClientSecret
} = require('./secrets.json');

async function httpRequest({ path, method, hostname, headers = {}, body }) {
  const bodyString = JSON.stringify(body);

  const options = {
    hostname,
    method,
    path,
    port: 443,
    headers: {
      ...headers,
      ...(method !== 'GET' && body ? {
        'Content-Length': bodyString.length,
        'Content-Type': 'application/json'
      } : {})
    },
  };

  const promise = new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      res.setEncoding('utf8');
      let responseBody = '';

      res.on('data', (chunk) => {
        responseBody += chunk;
      });

      res.on('end', () => {
        try {
          const json = JSON.parse(responseBody);
          resolve(json);
        } catch(e) {
          resolve(responseBody);
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (method !== 'GET' && body) {
      req.write(bodyString)
    }
    req.end();
  });

  return await promise;
}

async function getTwitchToken() {
  const rawTokenInfo = await httpRequest({
    hostname: 'id.twitch.tv',
    path: `/oauth2/token?client_id=${twitchClientId}&client_secret=${twitchClientSecret}&grant_type=client_credentials`,
    method: 'POST',
    headers: {
      'Client-ID': twitchClientId,
    }
  });

  if (!rawTokenInfo || !rawTokenInfo.access_token) {
    throw new Error('Could not find token inside response body. Body was: ' + rawTokenInfo.toString());
  }

  return rawTokenInfo.access_token;
}

async function getStreamInfos(twitchAccessToken) {
  const rawStreamInfos  = await httpRequest({
    hostname: 'api.twitch.tv',
    path: '/helix/channels?broadcaster_id=29891279',
    headers: {
      Authorization: `Bearer ${twitchAccessToken}`,
      'Client-ID': twitchClientId,
    }
  });

  const streamInfos = rawStreamInfos?.data?.[0];
  if (!streamInfos) {
    throw new Error('no streamInfos received. Body was: ' + rawStreamInfos.toString())
  }

  return streamInfos;
}

async function sendDiscordMessage({ title: streamTitle, game_name: gameName }) {
  const response = await httpRequest({
    hostname: 'discord.com',
    method: 'POST',
    path: `/api/webhooks/${discordWebhookToken}`,
    body: {
      "content": "tiphedor est en live ! Venez le regarder !\n\n:arrow_forward:  [twitch.tv/tiphedor](https://twitch.tv/tiphedor)\n\n_ _",
      "embeds": [
        {
          "title": streamTitle,
          "description": gameName,
          "url": "https://twitch.tv/tiphedor",
          "color": 13917276,
          "image": {
            "url":"https://static-cdn.jtvnw.net/previews-ttv/live_user_tiphedor-1920x1080.jpg"
          }
        }
      ]
    }
  });

  if (response !== '') {
    throw new Error('Could not send message to discord: ' + response.toString());
  }
}

exports.handler = async (event, context) => {
  try {
    const twitchAccessToken = await getTwitchToken();
    const streamInfos = await getStreamInfos(twitchAccessToken);
    await sendDiscordMessage(streamInfos);

    context.succeed('ok');

    console.log('everything is ok!')
    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true })
    }
  } catch (e) {
    console.log(e);
    context.fail(e.toString());

    return {
      statusCode: 404,
      body: JSON.stringify({ ok: false })
    }
  }
}