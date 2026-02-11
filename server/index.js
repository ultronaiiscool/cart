// Kart Racing Game - WebSocket Server
const http = require('http');
const { WebSocketServer } = require('ws');
const CONSTANTS = require('../shared/constants');
const { Lobby } = require('./lobby');

const PORT = process.env.PORT || 3000;

// Create HTTP server
const httpServer = http.createServer((req, res) => {
  // CORS headers for health checks
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      lobbies: Object.keys(lobbies).length,
      uptime: process.uptime(),
    }));
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Kart Racing Server');
});

// WebSocket server
const wss = new WebSocketServer({ server: httpServer });

// Active lobbies
const lobbies = {};
let nextLobbyId = 1;

// Find or create a lobby
function findOrCreateLobby() {
  // Find a waiting lobby with space
  for (const [id, lobby] of Object.entries(lobbies)) {
    if (lobby.state === 'waiting' && lobby.players.size < CONSTANTS.MAX_HUMANS) {
      return lobby;
    }
  }

  // Create new lobby
  const id = `lobby_${nextLobbyId++}`;
  const lobby = new Lobby(id, null);
  lobbies[id] = lobby;

  console.log(`Created lobby: ${id}`);
  return lobby;
}

// Cleanup empty lobbies periodically
setInterval(() => {
  for (const [id, lobby] of Object.entries(lobbies)) {
    if (lobby.players.size === 0 && lobby.state !== 'racing') {
      delete lobbies[id];
      console.log(`Cleaned up lobby: ${id}`);
    }
  }
}, 30000);

// Handle connections
wss.on('connection', (ws) => {
  let playerId = null;
  let playerLobby = null;

  console.log('New connection');

  ws.on('message', (rawData) => {
    let msg;
    try {
      msg = JSON.parse(rawData.toString());
    } catch (e) {
      return;
    }

    const { type, data } = msg;

    switch (type) {
      case CONSTANTS.MSG.JOIN: {
        if (playerId) return; // Already joined

        playerId = `p_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        playerLobby = findOrCreateLobby();

        const success = playerLobby.addPlayer(playerId, ws, data.name);
        if (!success) {
          ws.send(JSON.stringify({
            type: CONSTANTS.MSG.ERROR,
            data: { message: 'Lobby full or race in progress' },
          }));
          playerId = null;
          playerLobby = null;
          return;
        }

        // Send player their ID
        ws.send(JSON.stringify({
          type: 'welcome',
          data: {
            playerId,
            lobbyId: playerLobby.id,
            riders: CONSTANTS.RIDERS,
            riderColors: CONSTANTS.RIDER_COLORS,
          },
        }));

        console.log(`Player ${playerId} joined ${playerLobby.id}`);
        break;
      }

      case CONSTANTS.MSG.SELECT_RIDER: {
        if (!playerLobby || !playerId) return;
        playerLobby.selectRider(playerId, data.rider);
        break;
      }

      case CONSTANTS.MSG.READY: {
        if (!playerLobby || !playerId) return;
        playerLobby.setReady(playerId, data.ready);
        break;
      }

      case CONSTANTS.MSG.INPUT: {
        if (!playerLobby || !playerId) return;
        playerLobby.processInput(playerId, data);
        break;
      }
    }
  });

  ws.on('close', () => {
    if (playerLobby && playerId) {
      playerLobby.removePlayer(playerId);
      console.log(`Player ${playerId} disconnected`);
    }
  });

  ws.on('error', (err) => {
    console.error('WebSocket error:', err.message);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Kart Racing Server running on port ${PORT}`);
});
