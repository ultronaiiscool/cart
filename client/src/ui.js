// HTML overlay UI system
class GameUI {
  constructor() {
    this.elements = {};
    this.currentScreen = null;
    this.riderSelectCallback = null;
    this.readyCallback = null;
    this.joinCallback = null;
  }

  init() {
    this._createStyles();
    this._createMainMenu();
    this._createLobbyScreen();
    this._createHUD();
    this._createCountdown();
    this._createResults();

    this.showScreen('main-menu');
  }

  _createStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .ui-overlay {
        position: absolute;
        top: 0; left: 0; right: 0; bottom: 0;
        pointer-events: none;
        font-family: 'Segoe UI', Arial, sans-serif;
        z-index: 100;
      }
      .ui-screen {
        position: absolute;
        top: 0; left: 0; right: 0; bottom: 0;
        display: none;
        align-items: center;
        justify-content: center;
        flex-direction: column;
        pointer-events: all;
      }
      .ui-screen.active {
        display: flex;
      }
      .ui-panel {
        background: rgba(10, 15, 30, 0.92);
        border-radius: 12px;
        padding: 30px 40px;
        color: white;
        text-align: center;
        border: 2px solid rgba(100, 150, 255, 0.3);
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
        max-width: 500px;
        width: 90%;
      }
      .ui-title {
        font-size: 42px;
        font-weight: bold;
        margin-bottom: 8px;
        background: linear-gradient(135deg, #ff6644, #ffcc00);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        text-shadow: none;
      }
      .ui-subtitle {
        font-size: 14px;
        color: #88aacc;
        margin-bottom: 20px;
      }
      .ui-btn {
        background: linear-gradient(135deg, #4466cc, #5588ff);
        color: white;
        border: none;
        padding: 12px 32px;
        font-size: 16px;
        border-radius: 8px;
        cursor: pointer;
        margin: 6px;
        transition: transform 0.15s, box-shadow 0.15s;
        pointer-events: all;
      }
      .ui-btn:hover {
        transform: scale(1.05);
        box-shadow: 0 4px 16px rgba(85, 136, 255, 0.4);
      }
      .ui-btn.ready {
        background: linear-gradient(135deg, #44aa44, #66cc66);
      }
      .ui-btn.ready.active {
        background: linear-gradient(135deg, #cc4444, #ff6666);
      }
      .ui-input {
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(100, 150, 255, 0.3);
        color: white;
        padding: 10px 16px;
        font-size: 16px;
        border-radius: 6px;
        margin: 8px 0;
        width: 200px;
        text-align: center;
      }
      .ui-input:focus {
        outline: none;
        border-color: #5588ff;
      }
      .rider-select {
        display: flex;
        gap: 10px;
        margin: 16px 0;
        justify-content: center;
        flex-wrap: wrap;
      }
      .rider-option {
        width: 60px;
        height: 70px;
        border: 2px solid rgba(255, 255, 255, 0.2);
        border-radius: 8px;
        cursor: pointer;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        transition: all 0.15s;
        background: rgba(255, 255, 255, 0.05);
        pointer-events: all;
      }
      .rider-option:hover {
        border-color: #5588ff;
        background: rgba(85, 136, 255, 0.15);
      }
      .rider-option.selected {
        border-color: #ffcc00;
        background: rgba(255, 204, 0, 0.15);
      }
      .rider-icon {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        margin-bottom: 4px;
      }
      .rider-name {
        font-size: 10px;
        color: #aaccee;
      }
      .player-list {
        margin: 12px 0;
        text-align: left;
      }
      .player-item {
        padding: 6px 12px;
        margin: 4px 0;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 4px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 14px;
      }
      .player-ready {
        color: #44cc44;
        font-size: 12px;
      }
      /* HUD */
      #hud {
        display: none;
        pointer-events: none;
      }
      #hud.active {
        display: block;
      }
      .hud-speed {
        position: absolute;
        bottom: 30px;
        left: 30px;
        font-size: 36px;
        font-weight: bold;
        color: white;
        text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
      }
      .hud-speed span {
        font-size: 14px;
        opacity: 0.7;
      }
      .hud-position {
        position: absolute;
        top: 20px;
        right: 30px;
        font-size: 48px;
        font-weight: bold;
        color: #ffcc00;
        text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
      }
      .hud-position span {
        font-size: 18px;
        color: #aaa;
      }
      .hud-lap {
        position: absolute;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        font-size: 22px;
        color: white;
        text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
      }
      .hud-powerup {
        position: absolute;
        bottom: 30px;
        right: 30px;
        width: 64px;
        height: 64px;
        border: 3px solid rgba(255, 255, 255, 0.4);
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
        color: white;
        background: rgba(0, 0, 0, 0.5);
        text-shadow: 0 0 8px rgba(255, 200, 0, 0.8);
      }
      .hud-minimap {
        position: absolute;
        bottom: 30px;
        left: 50%;
        transform: translateX(-50%);
        width: 150px;
        height: 150px;
        opacity: 0.6;
      }
      .hud-rider-icon {
        position: absolute;
        top: 80px;
        right: 35px;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        border: 2px solid rgba(255,255,255,0.4);
      }
      /* Countdown */
      #countdown {
        display: none;
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-size: 120px;
        font-weight: bold;
        color: white;
        text-shadow: 0 0 40px rgba(255, 100, 0, 0.8);
        animation: countPulse 1s ease-out;
        pointer-events: none;
      }
      @keyframes countPulse {
        0% { transform: translate(-50%, -50%) scale(2); opacity: 0; }
        30% { opacity: 1; }
        100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
      }
      /* Results */
      #results-screen {
        background: rgba(0, 0, 0, 0.85);
      }
      .results-list {
        text-align: left;
        margin: 16px 0;
      }
      .result-item {
        padding: 8px 16px;
        margin: 4px 0;
        border-radius: 6px;
        display: flex;
        justify-content: space-between;
        font-size: 15px;
      }
      .result-item.gold { background: rgba(255, 204, 0, 0.2); color: #ffcc00; }
      .result-item.silver { background: rgba(192, 192, 192, 0.15); color: #ccc; }
      .result-item.bronze { background: rgba(205, 127, 50, 0.15); color: #cd7f32; }
      .result-item.normal { background: rgba(255, 255, 255, 0.05); color: #999; }
      .result-pos { font-weight: bold; width: 30px; }
      .result-name { flex: 1; }
      .result-time { opacity: 0.7; }
      .connection-status {
        position: absolute;
        top: 8px;
        left: 8px;
        font-size: 11px;
        color: #66aa66;
        pointer-events: none;
      }
    `;
    document.head.appendChild(style);
  }

  _createMainMenu() {
    const screen = this._createScreen('main-menu');
    screen.innerHTML = `
      <div class="ui-panel">
        <div class="ui-title">KART RACER</div>
        <div class="ui-subtitle">3D Multiplayer Racing</div>
        <input type="text" class="ui-input" id="player-name" placeholder="Your Name" maxlength="16" value="Player">
        <br>
        <button class="ui-btn" id="btn-play">Play Online</button>
        <button class="ui-btn" id="btn-solo" style="background: linear-gradient(135deg, #886622, #aa8833);">Solo Race</button>
        <div style="margin-top: 16px; font-size: 11px; color: #667788;">
          WASD/Arrows to drive &bull; Space to drift &bull; E to use item
        </div>
      </div>
    `;
  }

  _createLobbyScreen() {
    const screen = this._createScreen('lobby');
    screen.innerHTML = `
      <div class="ui-panel">
        <div style="font-size: 22px; font-weight: bold; color: #aaddff; margin-bottom: 12px;">Lobby</div>
        <div id="lobby-status" style="color: #88aacc; font-size: 13px; margin-bottom: 12px;">Waiting for players...</div>
        <div style="font-size: 13px; color: #8899aa; margin-bottom: 8px;">Select Rider:</div>
        <div class="rider-select" id="rider-select"></div>
        <div class="player-list" id="player-list"></div>
        <button class="ui-btn ready" id="btn-ready">Ready</button>
        <div style="margin-top: 8px; font-size: 11px; color: #556677;">AI racers fill remaining slots</div>
      </div>
    `;
  }

  _createHUD() {
    const hud = document.createElement('div');
    hud.id = 'hud';
    hud.className = 'ui-overlay';
    hud.innerHTML = `
      <div class="hud-speed" id="hud-speed">0 <span>km/h</span></div>
      <div class="hud-position" id="hud-position">1<span>st</span></div>
      <div class="hud-lap" id="hud-lap">Lap 1 / ${CONSTANTS.LAPS}</div>
      <div class="hud-powerup" id="hud-powerup"></div>
      <div class="hud-rider-icon" id="hud-rider-icon"></div>
      <canvas class="hud-minimap" id="hud-minimap" width="150" height="150"></canvas>
      <div class="connection-status" id="connection-status"></div>
    `;
    document.getElementById('game-ui').appendChild(hud);
    this.elements.hud = hud;
  }

  _createCountdown() {
    const cd = document.createElement('div');
    cd.id = 'countdown';
    document.getElementById('game-ui').appendChild(cd);
    this.elements.countdown = cd;
  }

  _createResults() {
    const screen = this._createScreen('results-screen');
    screen.id = 'results-screen';
    screen.innerHTML = `
      <div class="ui-panel">
        <div class="ui-title" style="font-size: 32px;">Race Complete!</div>
        <div class="results-list" id="results-list"></div>
        <button class="ui-btn" id="btn-back-menu">Back to Menu</button>
      </div>
    `;
  }

  _createScreen(id) {
    const existing = document.getElementById(id);
    if (existing) return existing;

    const screen = document.createElement('div');
    screen.id = id;
    screen.className = 'ui-screen';
    document.getElementById('game-ui').appendChild(screen);
    return screen;
  }

  showScreen(id) {
    document.querySelectorAll('.ui-screen').forEach(s => s.classList.remove('active'));
    const el = document.getElementById(id);
    if (el) el.classList.add('active');
    this.currentScreen = id;

    // HUD visibility
    const hud = document.getElementById('hud');
    if (hud) {
      hud.className = id === 'racing' ? 'ui-overlay active' : 'ui-overlay';
      hud.classList.toggle('active', id === 'racing');
    }
  }

  showHUD() {
    const hud = document.getElementById('hud');
    if (hud) hud.classList.add('active');
  }

  hideHUD() {
    const hud = document.getElementById('hud');
    if (hud) hud.classList.remove('active');
  }

  // Setup lobby with rider options
  setupLobby(riders, riderColors) {
    const container = document.getElementById('rider-select');
    if (!container) return;
    container.innerHTML = '';

    for (const rider of riders) {
      const colors = riderColors[rider];
      const div = document.createElement('div');
      div.className = 'rider-option';
      div.dataset.rider = rider;
      div.innerHTML = `
        <div class="rider-icon" style="background: #${colors.primary.toString(16).padStart(6, '0')};"></div>
        <div class="rider-name">${rider}</div>
      `;
      div.addEventListener('click', () => {
        container.querySelectorAll('.rider-option').forEach(o => o.classList.remove('selected'));
        div.classList.add('selected');
        if (this.riderSelectCallback) this.riderSelectCallback(rider);
      });
      container.appendChild(div);
    }

    // Select first by default
    if (container.firstChild) container.firstChild.classList.add('selected');
  }

  // Update player list in lobby
  updateLobby(players) {
    const list = document.getElementById('player-list');
    if (!list) return;
    list.innerHTML = '';

    for (const player of players) {
      const div = document.createElement('div');
      div.className = 'player-item';
      div.innerHTML = `
        <span>${player.name} (${player.rider})</span>
        <span class="player-ready">${player.ready ? 'READY' : ''}</span>
      `;
      list.appendChild(div);
    }

    const status = document.getElementById('lobby-status');
    if (status) {
      status.textContent = `${players.length}/${CONSTANTS.MAX_HUMANS} players (${CONSTANTS.MAX_RACERS - players.length} AI)`;
    }
  }

  // Countdown display
  showCountdown(count) {
    const el = this.elements.countdown;
    if (!el) return;
    el.style.display = 'block';
    el.textContent = count > 0 ? count : 'GO!';
    el.style.animation = 'none';
    el.offsetHeight; // Trigger reflow
    el.style.animation = 'countPulse 1s ease-out';

    if (count <= 0) {
      setTimeout(() => { el.style.display = 'none'; }, 1000);
    }
  }

  // HUD updates
  updateHUD(data) {
    const speed = document.getElementById('hud-speed');
    if (speed) speed.innerHTML = `${Math.round(Math.abs(data.speed || 0) * 3.6)} <span>km/h</span>`;

    const pos = document.getElementById('hud-position');
    if (pos) {
      const p = data.position || 1;
      const suffix = p === 1 ? 'st' : p === 2 ? 'nd' : p === 3 ? 'rd' : 'th';
      pos.innerHTML = `${p}<span>${suffix}</span>`;
    }

    const lap = document.getElementById('hud-lap');
    if (lap) lap.textContent = `Lap ${Math.min((data.lap || 0) + 1, CONSTANTS.LAPS)} / ${CONSTANTS.LAPS}`;

    const pu = document.getElementById('hud-powerup');
    if (pu) {
      const icons = {
        speed_boost: '\u26A1',
        shield: '\u{1F6E1}',
        trap: '\u{1F4A3}',
        spin: '\u{1F300}',
        missile: '\u{1F3AF}',
      };
      pu.textContent = data.powerup ? (icons[data.powerup] || '?') : '';
    }
  }

  // Update minimap
  updateMinimap(trackPoints, karts, localId) {
    const canvas = document.getElementById('hud-minimap');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    if (!trackPoints || trackPoints.length === 0) return;

    // Find track bounds
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const p of trackPoints) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.z < minZ) minZ = p.z;
      if (p.z > maxZ) maxZ = p.z;
    }
    const rangeX = maxX - minX || 1;
    const rangeZ = maxZ - minZ || 1;
    const scale = Math.min((w - 20) / rangeX, (h - 20) / rangeZ);
    const offX = (w - rangeX * scale) / 2;
    const offZ = (h - rangeZ * scale) / 2;

    const toScreen = (x, z) => ({
      sx: (x - minX) * scale + offX,
      sy: (z - minZ) * scale + offZ,
    });

    // Draw track
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i <= trackPoints.length; i++) {
      const p = trackPoints[i % trackPoints.length];
      const { sx, sy } = toScreen(p.x, p.z);
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.closePath();
    ctx.stroke();

    // Draw karts
    if (karts) {
      for (const [id, kart] of Object.entries(karts)) {
        const { sx, sy } = toScreen(kart.x, kart.z);
        ctx.fillStyle = id === localId ? '#ffcc00' : '#ffffff';
        ctx.beginPath();
        ctx.arc(sx, sy, id === localId ? 4 : 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Show race results
  showResults(results) {
    const list = document.getElementById('results-list');
    if (!list) return;
    list.innerHTML = '';

    const classes = ['gold', 'silver', 'bronze'];
    for (const r of results) {
      const div = document.createElement('div');
      const cls = r.position <= 3 ? classes[r.position - 1] : 'normal';
      div.className = `result-item ${cls}`;
      const timeStr = r.time ? `${(r.time / 1000).toFixed(1)}s` : 'DNF';
      div.innerHTML = `
        <span class="result-pos">${r.position}.</span>
        <span class="result-name">${r.name} ${r.isAI ? '(AI)' : ''}</span>
        <span class="result-time">${timeStr}</span>
      `;
      list.appendChild(div);
    }

    this.showScreen('results-screen');
    this.hideHUD();
  }

  setConnectionStatus(text) {
    const el = document.getElementById('connection-status');
    if (el) el.textContent = text;
  }

  getPlayerName() {
    const input = document.getElementById('player-name');
    return input ? input.value.trim() || 'Player' : 'Player';
  }

  // Set rider icon in HUD
  setRiderIcon(riderType) {
    const el = document.getElementById('hud-rider-icon');
    if (!el) return;
    const colors = CONSTANTS.RIDER_COLORS[riderType];
    if (colors) {
      el.style.background = `#${colors.primary.toString(16).padStart(6, '0')}`;
    }
  }
}

window.GameUI = GameUI;
