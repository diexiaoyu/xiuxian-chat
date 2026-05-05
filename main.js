// Deno Deploy 原生 WebSocket 服务器
const clients = new Map();

Deno.serve((req) => {
  if (req.headers.get("upgrade") === "websocket") {
    const { socket, response } = Deno.upgradeWebSocket(req);

    socket.onopen = () => {
      const player = { id: crypto.randomUUID(), name: '道友', location: '宗门广场' };
      clients.set(socket, player);

      socket.send(JSON.stringify({
        type: 'system',
        text: '🌟 欢迎踏入修仙世界！你当前在【宗门广场】。'
      }));

      const msg = JSON.stringify({ type: 'system', text: '🌟 一位新道友踏入修仙世界！' });
      clients.forEach((_, clientSocket) => clientSocket.send(msg));
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const player = clients.get(socket);
        if (!player) return;

        if (data.type === 'join') {
          player.name = data.name || '道友';
          socket.send(JSON.stringify({
            type: 'init',
            players: [...clients.values()].map(p => ({ name: p.name, location: p.location })),
            location: player.location
          }));
          const joinMsg = JSON.stringify({ type: 'system', text: `🌟 ${player.name} 踏入修仙世界！` });
          clients.forEach((_, clientSocket) => clientSocket.send(joinMsg));
        }

        if (data.type === 'chat') {
          const msg = JSON.stringify({
            type: 'chat',
            from: player.name,
            text: data.text,
            time: new Date().toLocaleTimeString()
          });
          clients.forEach((_, clientSocket) => clientSocket.send(msg));
        }

        if (data.type === 'move') {
          player.location = data.toLocation || player.location;
          socket.send(JSON.stringify({ type: 'locationUpdate', location: player.location }));
        }
      } catch (e) {
        console.error(e);
      }
    };

    socket.onclose = () => {
      const player = clients.get(socket);
      if (player) {
        clients.delete(socket);
        const leaveMsg = JSON.stringify({ type: 'system', text: `💨 ${player.name} 离开了修仙世界。` });
        clients.forEach((_, clientSocket) => clientSocket.send(leaveMsg));
      }
    };

    return response;
  }

  return new Response('修仙聊天室服务器运行中', { status: 200 });
});
