async function handleSession(websocket: WebSocket) {
  websocket.accept()
  websocket.addEventListener('message', async ({ data }) => {
    data = data.toString();
    if (data.startsWith("pull")) {
      let args = data.split(' ');
      let cursor = args[1] || '';
      let curkeys = await ARCHIVE_KV.list({ limit: 990, cursor: cursor });

      websocket.send(JSON.stringify({ type: 'cursor', cursor: curkeys.cursor || '', expect: curkeys.keys.length }))

      const doSend = async function(key: string) {
        let kvout = await ARCHIVE_KV.get(key, "text");
        // pretty sure we're going to have this KV key
        websocket.send(JSON.stringify({ type: 'message', key: key, message: btoa(kvout!), }))
      }
      await Promise.all(curkeys.keys.map(item => doSend(item.name)));
      await setTimeout(() => {}, 2000); // make sure we messages before we send done
      websocket.send(JSON.stringify({ type: 'done' }))
    }
    else {
      // An unknown message came into the server. Send back an error message
      websocket.send(JSON.stringify({ type: 'error', error: 'Unknown message received', data: data }))
    }
  })

  websocket.addEventListener('close', async evt => {
    // Handle when a client closes the WebSocket connection
    console.log(evt)
  })
}

async function websocketHandler(request: Request) {
  const upgradeHeader = request.headers.get('Upgrade')
  if (upgradeHeader !== 'websocket') {
    return new Response('Expected websocket', { status: 400 })
  }

  const [client, server] = Object.values(new WebSocketPair())
  await handleSession(server)

  return new Response(null, {
    status: 101,
    webSocket: client,
  })
}

export async function handleRequest(request: Request): Promise<Response> {
  if (!request.url.endsWith('this_should_be_a_secret_string_todo_add_to_config')) {
    return new Response('403', {status: 403})
  }
  return websocketHandler(request)
}
