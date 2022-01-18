#!/bin/bash

### Setup Twitch lambdas
# golive-discord-message
# Prerequisites: configured twitch CLI


### Token
twitchAccessTokenRaw=$(twitch token 2>&1)
twitchAccessToken=$(cut -d ' ' -f6 <<< "$twitchAccessTokenRaw")

### Secrets
for s in $( jq -r "to_entries|map(\"\(.key)=\(.value|tostring)\")|.[]" < secrets.json ); do
    export "${s?}"
done

### Request Body
jsonBodyTemplate='{
     "type": "stream.online",
     "version": "1",
     "condition": {
         "broadcaster_user_id": "_BROADCASTER_ID_"
     },
     "transport": {
         "method": "webhook",
         "callback": "_CALLBACK_URL_",
         "secret": "_CALLBACK_SECRET_"
     }
 }'
jsonBody=$(echo "$jsonBodyTemplate"                  \
  | sed "s|_CALLBACK_URL_|$webhookUrl|g"             \
  | sed "s|_BROADCASTER_ID_|$twitchBroadcasterId|g"  \
  | sed "s|_CALLBACK_SECRET_|$webhookSecret|g")


### Setup Webhook
curl --location --request POST "https://api.twitch.tv/helix/eventsub/subscriptions" \
  --header "Authorization: Bearer $twitchAccessToken" \
  --header "Client-Id: $twitchClientId" \
  --header "Content-Type: application/json" \
  --data "$jsonBody"