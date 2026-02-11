// WebSocket network client
class NetworkClient {
  constructor() {
    this.ws = null;
    this.connected = false;
    this.playerId = null;
    this.lobbyId = null;
    this.handlers = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.serverUrl = null;
  }

  // Connect to WebSocket server
  connect(url) {
    this.serverUrl = url;

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(url);
      } catch (e) {
        reject(e);
        return;
      }

      this.ws.onopen = () => {
        console.log('Connected to server');
        this.connected = true;
        this.reconnectAttempts = 0;
        resolve();
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this._handleMessage(msg);
        } catch (e) {
          console.error('Failed to parse message:', e);
        }
      };

      this.ws.onclose = () => {
        console.log('Disconnected from server');
        this.connected = false;
        this._handleDisconnect();
      };

      this.ws.onerror = (err) => {
        console.error('WebSocket error');
        if (!this.connected) reject(new Error('Connection failed'));
      };
    });
  }

  // Register message handler
  on(type, callback) {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, []);
    }
    this.handlers.get(type).push(callback);
  }

  // Remove handler
  off(type, callback) {
    const handlers = this.handlers.get(type);
    if (handlers) {
      const idx = handlers.indexOf(callback);
      if (idx >= 0) handlers.splice(idx, 1);
    }
  }

  // Send message
  send(type, data) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ type, data }));
  }

  // Join lobby
  join(name) {
    this.send(CONSTANTS.MSG.JOIN, { name });
  }

  // Select rider
  selectRider(rider) {
    this.send(CONSTANTS.MSG.SELECT_RIDER, { rider });
  }

  // Set ready
  setReady(ready) {
    this.send(CONSTANTS.MSG.READY, { ready });
  }

  // Send input
  sendInput(input) {
    this.send(CONSTANTS.MSG.INPUT, input);
  }

  _handleMessage(msg) {
    const { type, data } = msg;

    // Special handling for welcome
    if (type === 'welcome') {
      this.playerId = data.playerId;
      this.lobbyId = data.lobbyId;
    }

    const handlers = this.handlers.get(type);
    if (handlers) {
      for (const handler of handlers) {
        handler(data);
      }
    }
  }

  _handleDisconnect() {
    const handlers = this.handlers.get('disconnect');
    if (handlers) {
      for (const handler of handlers) {
        handler();
      }
    }

    // Auto reconnect
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 16000);
      console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
      setTimeout(() => {
        if (!this.connected && this.serverUrl) {
          this.connect(this.serverUrl).catch(() => {});
        }
      }, delay);
    }
  }

  disconnect() {
    this.maxReconnectAttempts = 0; // Prevent auto-reconnect
    if (this.ws) {
      this.ws.close();
    }
  }
}

window.NetworkClient = NetworkClient;
