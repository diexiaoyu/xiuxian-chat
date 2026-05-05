const WebSocket = require('ws');
const http = require('http');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('修仙聊天室服务器运行中');
});

const wss = new WebSocket.Server({ server });

// 存储所有玩家
const players = new Map(); // { ws连接 -> 玩家信息 }
const locations = {
  '宗门广场': { players: new Set(), desc: '青云门中心广场，弟子们在此聚集交流。' },
  '藏经阁': { players: new Set(), desc: '三层木楼，藏书万卷，可在此学习功法。' },
  '炼丹堂': { players: new Set(), desc: '丹炉林立，药香弥漫，可在此炼制丹药。' },
  '炼器堂': { players: new Set(), desc: '火炉熊熊，可在此打造法宝兵器。' },
  '后山': { players: new Set(), desc: '竹林幽深，灵泉潺潺，适合静修。' },
  '灵田': { players: new Set(), desc: '种植灵草的田地，偶有灵兽出没。' },
  '坊市': { players: new Set(), desc: '修仙者交易之所，人来人往。' },
  '磐石台': { players: new Set(), desc: '野外修炼地，有妖物出没。' },
  '流明河': { players: new Set(), desc: '水行灵气充沛之地。' },
  '锋鸣谷': { players: new Set(), desc: '陨铁坠落之地，金石之气浓烈。' },
};

const realms = ['炼气期', '筑基期', '金丹期', '元婴期', '化神期'];

function broadcast(data) {
  const msg = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}

function sendToLocation(location, data) {
  const msg = JSON.stringify(data);
  if (locations[location]) {
    locations[location].players.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(msg);
      }
    });
  }
}

function getOnlineList() {
  const list = [];
  players.forEach((player, ws) => {
    list.push({
      name: player.name,
      realm: player.realm,
      location: player.location,
    });
  });
  return list;
}

function getLocationPlayers(location) {
  const list = [];
  if (locations[location]) {
    locations[location].players.forEach(ws => {
      const player = players.get(ws);
      if (player) list.push({ name: player.name, realm: player.realm });
    });
  }
  return list;
}

wss.on('connection', (ws) => {
  let playerData = null;

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      switch (data.type) {
        case 'join':
          // 新玩家加入
          const realmIndex = Math.floor(Math.random() * 2); // 随机炼气或筑基
          playerData = {
            name: data.name,
            realm: realms[realmIndex],
            location: '宗门广场',
            hp: 100,
            mana: 100,
          };
          players.set(ws, playerData);
          locations['宗门广场'].players.add(ws);
          
          // 通知所有人
          broadcast({
            type: 'system',
            text: `🌟 ${playerData.name}（${playerData.realm}）踏入修仙世界！`,
            time: new Date().toLocaleTimeString(),
          });
          
          // 发送给该玩家初始数据
          ws.send(JSON.stringify({
            type: 'init',
            players: getOnlineList(),
            location: '宗门广场',
            locationDesc: locations['宗门广场'].desc,
            locationPlayers: getLocationPlayers('宗门广场'),
            myData: playerData,
          }));
          
          // 给同地点其他人发通知
          sendToLocation('宗门广场', {
            type: 'playerEnter',
            name: playerData.name,
            realm: playerData.realm,
          });
          break;

        case 'chat':
          // 发送聊天消息
          if (!playerData) return;
          const chatMsg = {
            type: 'chat',
            from: playerData.name,
            realm: playerData.realm,
            text: data.text,
            time: new Date().toLocaleTimeString(),
          };
          sendToLocation(playerData.location, chatMsg);
          break;

        case 'move':
          // 切换场景
          if (!playerData || !data.toLocation) return;
          if (!locations[data.toLocation]) return;
          
          const oldLoc = playerData.location;
          locations[oldLoc].players.delete(ws);
          
          playerData.location = data.toLocation;
          locations[data.toLocation].players.add(ws);
          
          // 通知旧地点的人
          sendToLocation(oldLoc, {
            type: 'playerLeave',
            name: playerData.name,
          });
          
          // 通知新地点的人
          sendToLocation(data.toLocation, {
            type: 'playerEnter',
            name: playerData.name,
            realm: playerData.realm,
          });
          
          // 发送新地点信息给该玩家
          ws.send(JSON.stringify({
            type: 'locationUpdate',
            location: data.toLocation,
            locationDesc: locations[data.toLocation].desc,
            locationPlayers: getLocationPlayers(data.toLocation),
          }));
          break;

        case 'cultivate':
          // 修炼
          if (!playerData) return;
          const cultMsg = {
            type: 'action',
            from: playerData.name,
            action: '修炼',
            text: `${playerData.name}盘膝而坐，吐纳天地灵气，周身泛起微光。`,
            time: new Date().toLocaleTimeString(),
          };
          sendToLocation(playerData.location, cultMsg);
          break;

        case 'battle':
          // 切磋
          if (!playerData) return;
          const battleMsg = {
            type: 'action',
            from: playerData.name,
            action: '切磋',
            text: `${playerData.name}摆出起手式：「谁来与我一战？」`,
            time: new Date().toLocaleTimeString(),
          };
          sendToLocation(playerData.location, battleMsg);
          break;
      }
    } catch (e) {
      console.error('消息解析错误:', e);
    }
  });

  ws.on('close', () => {
    if (playerData) {
      const loc = playerData.location;
      if (locations[loc]) {
        locations[loc].players.delete(ws);
      }
      players.delete(ws);
      
      broadcast({
        type: 'system',
        text: `💨 ${playerData.name}（${playerData.realm}）离开了修仙世界。`,
        time: new Date().toLocaleTimeString(),
      });
      
      sendToLocation(loc, {
        type: 'playerLeave',
        name: playerData.name,
      });
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`修仙聊天室服务器已开启，端口：${PORT}`);
});
