// Main game orchestration - ties all systems together
class Game {
  constructor() {
    this.renderer = null;
    this.lighting = null;
    this.effects = null;
    this.riderSystem = null;
    this.kartManager = null;
    this.powerupVisuals = null;
    this.missileVisuals = null;
    this.network = null;
    this.clientPhysics = null;
    this.ui = null;

    this.state = 'menu'; // menu, lobby, countdown, racing, finished
    this.trackData = null;
    this.racers = [];
    this.localPlayerId = null;
    this.localRider = 'helmet';

    // Input state
    this.input = {
      throttle: 0,
      steer: 0,
      drift: false,
      usePowerup: false,
    };
    this.keys = {};

    // Timing
    this.lastTime = 0;
    this.accumulator = 0;
    this.interpFactor = 0;
    this.serverTickRate = 1000 / CONSTANTS.NET.UPDATE_RATE;
    this.lastServerUpdate = 0;

    // Last known server kart states for minimap
    this.lastServerKarts = {};

    // Solo mode
    this.soloMode = false;

    // Server URL - configure for deployment
    this.serverUrl = this._getServerUrl();
  }

  _getServerUrl() {
    // Check for configured server URL
    if (window.GAME_SERVER_URL) return window.GAME_SERVER_URL;

    // Development: try localhost
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
      return `${protocol}//${location.hostname}:3000`;
    }

    // Production: Render deployment URL (configure this)
    return `wss://kart-racing-server.onrender.com`;
  }

  async init() {
    // Init Three.js renderer
    this.renderer = new Renderer();
    this.renderer.init();

    // Lighting
    this.lighting = new Lighting(this.renderer.scene);
    this.lighting.init();

    // Effects
    this.effects = new Effects(this.renderer.scene);

    // Rider system
    this.riderSystem = new RiderSystem();

    // Kart manager
    this.kartManager = new KartManager(this.renderer.scene, this.riderSystem, this.effects);

    // Power-up visuals
    this.powerupVisuals = new PowerUpVisuals(this.renderer.scene);

    // Missile visuals
    this.missileVisuals = new MissileVisuals(this.renderer.scene, this.effects);

    // Client physics
    this.clientPhysics = new ClientPhysics();

    // Network
    this.network = new NetworkClient();

    // UI
    this.ui = new GameUI();
    this.ui.init();

    // Setup input
    this._setupInput();

    // Setup UI callbacks
    this._setupUICallbacks();

    // Setup network handlers
    this._setupNetworkHandlers();

    // Start render loop
    this._startLoop();
  }

  _setupInput() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      // Prevent browser defaults for game keys
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;

      // Power-up on key up (single press)
      if (e.code === 'KeyE' || e.code === 'ShiftRight') {
        this.input.usePowerup = true;
      }
    });
  }

  _updateInput() {
    // Throttle
    const up = this.keys['ArrowUp'] || this.keys['KeyW'];
    const down = this.keys['ArrowDown'] || this.keys['KeyS'];
    this.input.throttle = up ? 1 : (down ? -1 : 0);

    // Steering
    const left = this.keys['ArrowLeft'] || this.keys['KeyA'];
    const right = this.keys['ArrowRight'] || this.keys['KeyD'];
    this.input.steer = left ? -1 : (right ? 1 : 0);

    // Drift
    this.input.drift = this.keys['Space'] || false;
  }

  _setupUICallbacks() {
    // Play online button
    document.getElementById('btn-play')?.addEventListener('click', () => {
      this.soloMode = false;
      this._connectAndJoin();
    });

    // Solo mode
    document.getElementById('btn-solo')?.addEventListener('click', () => {
      this.soloMode = true;
      this._startSoloMode();
    });

    // Ready button
    document.getElementById('btn-ready')?.addEventListener('click', () => {
      const btn = document.getElementById('btn-ready');
      const isReady = btn.classList.toggle('active');
      btn.textContent = isReady ? 'Cancel' : 'Ready';
      this.network.setReady(isReady);
    });

    // Back to menu
    document.getElementById('btn-back-menu')?.addEventListener('click', () => {
      this._cleanup();
      this.ui.showScreen('main-menu');
      this.state = 'menu';
    });

    // Rider selection
    this.ui.riderSelectCallback = (rider) => {
      this.localRider = rider;
      this.network.selectRider(rider);
    };
  }

  async _connectAndJoin() {
    this.ui.setConnectionStatus('Connecting...');

    try {
      await this.network.connect(this.serverUrl);
      this.ui.setConnectionStatus('Connected');

      const name = this.ui.getPlayerName();
      this.network.join(name);
    } catch (err) {
      this.ui.setConnectionStatus('Connection failed');
      console.error('Failed to connect:', err);

      // Fall back to solo mode
      setTimeout(() => {
        if (confirm('Could not connect to server. Play solo instead?')) {
          this._startSoloMode();
        }
      }, 500);
    }
  }

  _setupNetworkHandlers() {
    this.network.on('welcome', (data) => {
      this.localPlayerId = data.playerId;
      this.ui.setupLobby(data.riders, data.riderColors);
      this.ui.showScreen('lobby');
      this.state = 'lobby';
    });

    this.network.on(CONSTANTS.MSG.LOBBY_STATE, (data) => {
      this.ui.updateLobby(data.players);
    });

    this.network.on(CONSTANTS.MSG.RACE_START, (data) => {
      this.trackData = data.track;
      this.racers = data.racers;
      this._initRace();
    });

    this.network.on(CONSTANTS.MSG.COUNTDOWN, (data) => {
      this.state = 'countdown';
      this.ui.showCountdown(data.count);
      if (data.count <= 0) {
        this.state = 'racing';
        this.ui.showScreen('racing');
        this.ui.showHUD();
      }
    });

    this.network.on(CONSTANTS.MSG.GAME_STATE, (data) => {
      this._handleServerState(data);
    });

    this.network.on(CONSTANTS.MSG.POWERUP_COLLECT, (data) => {
      this.powerupVisuals.hideBox(data.boxId);
      this.effects.spawnCollectSparkle(
        data.kartId === this.localPlayerId ? this.kartManager.getLocalKart()?.x || 0 : 0,
        data.kartId === this.localPlayerId ? this.kartManager.getLocalKart()?.z || 0 : 0
      );
    });

    this.network.on(CONSTANTS.MSG.POWERUP_SPAWN, (data) => {
      for (const boxId of data.boxes) {
        this.powerupVisuals.showBox(boxId);
      }
    });

    this.network.on(CONSTANTS.MSG.POWERUP_USE, (data) => {
      if (data.action === 'place_trap' && data.trap) {
        this.powerupVisuals.placeTrap(data.trap);
      }
    });

    this.network.on(CONSTANTS.MSG.TRAP_HIT, (data) => {
      this.powerupVisuals.removeTrap(data.trapId);
      if (!data.blocked) {
        // Visual effect on the kart
      }
    });

    this.network.on(CONSTANTS.MSG.MISSILE_SPAWN, (data) => {
      this.missileVisuals.spawn(data.missile);
    });

    this.network.on(CONSTANTS.MSG.MISSILE_HIT, (data) => {
      this.missileVisuals.explode(data.x, data.z);
      this.missileVisuals.remove(data.missileId);
    });

    this.network.on(CONSTANTS.MSG.LAP_COMPLETE, (data) => {
      if (data.kartId === this.localPlayerId) {
        // Flash lap notification
      }
    });

    this.network.on(CONSTANTS.MSG.RACE_RESULTS, (data) => {
      this.state = 'finished';
      this.ui.showResults(data.results);
    });

    this.network.on('disconnect', () => {
      this.ui.setConnectionStatus('Disconnected');
    });
  }

  _initRace() {
    // Build track
    this.renderer.buildTrack(this.trackData);

    // Create karts
    let kartIdx = 0;
    for (const racer of this.racers) {
      const isLocal = racer.id === this.localPlayerId;
      this.kartManager.createKart(racer.id, racer.rider, kartIdx, isLocal);
      kartIdx++;

      if (isLocal) {
        this.ui.setRiderIcon(racer.rider);
      }
    }

    // Create item boxes
    if (this.trackData.itemBoxPositions) {
      const boxes = this.trackData.itemBoxPositions.map((pos, i) => ({
        id: i,
        x: pos.x,
        z: pos.z,
      }));
      this.powerupVisuals.createItemBoxes(boxes);
    }

    this.state = 'countdown';
  }

  _handleServerState(data) {
    this.lastServerUpdate = performance.now();
    this.lastServerKarts = data.karts;

    // Update all karts from server
    for (const [id, state] of Object.entries(data.karts)) {
      this.kartManager.updateFromServer(id, state);

      // Reconcile local player
      if (id === this.localPlayerId) {
        this.clientPhysics.reconcile(state);

        // Update HUD
        this.ui.updateHUD({
          speed: state.speed,
          position: state.position,
          lap: state.lap,
          powerup: state.powerup,
        });
      }
    }

    // Update missiles
    if (data.missiles) {
      this.missileVisuals.updateFromServer(data.missiles);
    }
  }

  _startSoloMode() {
    this.soloMode = true;
    this.localPlayerId = 'local_player';
    this.state = 'countdown';

    // Use the same track as server
    const TRACK_CONTROL_POINTS = [
      { x: 0, z: 80 },
      { x: 30, z: 90 },
      { x: 60, z: 85 },
      { x: 80, z: 65 },
      { x: 85, z: 35 },
      { x: 75, z: 10 },
      { x: 55, z: -10 },
      { x: 30, z: -15 },
      { x: 5, z: -5 },
      { x: -15, z: 15 },
      { x: -25, z: 40 },
      { x: -20, z: 60 },
    ];

    // Generate checkpoints
    const checkpoints = [];
    for (let i = 0; i < CONSTANTS.TRACK.CHECKPOINT_COUNT; i++) {
      const t = i / CONSTANTS.TRACK.CHECKPOINT_COUNT;
      checkpoints.push(Utils.getSplinePoint(TRACK_CONTROL_POINTS, t));
    }

    // Generate spawn positions
    const spawnPositions = [];
    for (let i = 0; i < 8; i++) {
      const row = Math.floor(i / 2);
      const col = i % 2;
      const t = -row * 0.015;
      const pt = Utils.getSplinePoint(TRACK_CONTROL_POINTS, ((t % 1) + 1) % 1);
      const tan = Utils.getSplineTangent(TRACK_CONTROL_POINTS, ((t % 1) + 1) % 1);
      const offset = (col === 0 ? -1 : 1) * 2.5;
      spawnPositions.push({
        x: pt.x + tan.z * offset,
        z: pt.z - tan.x * offset,
        angle: Math.atan2(tan.x, tan.z),
      });
    }

    // Generate item box positions
    const itemBoxPositions = [];
    for (let i = 0; i < 12; i++) {
      const t = i / 12;
      const pt = Utils.getSplinePoint(TRACK_CONTROL_POINTS, t);
      const tan = Utils.getSplineTangent(TRACK_CONTROL_POINTS, t);
      itemBoxPositions.push({ x: pt.x + tan.z * 3, z: pt.z - tan.x * 3 });
      itemBoxPositions.push({ x: pt.x - tan.z * 3, z: pt.z + tan.x * 3 });
    }

    this.trackData = {
      controlPoints: TRACK_CONTROL_POINTS,
      checkpoints,
      spawnPositions,
      itemBoxPositions,
      width: CONSTANTS.TRACK.WIDTH,
    };

    // Build track visuals
    this.renderer.buildTrack(this.trackData);

    // Create local player kart
    this.kartManager.createKart(this.localPlayerId, this.localRider, 0, true);
    const spawn = spawnPositions[0];
    const localState = {
      x: spawn.x, y: 0, z: spawn.z,
      angle: spawn.angle, speed: 0, steerAngle: 0,
      drifting: false, driftTier: 0, driftDirection: 0,
      boostTimer: 0, shieldTimer: 0, spinTimer: 0,
      powerup: null, lap: 0, position: 1, finished: false,
      checkpoint: 0, raceProgress: 0,
    };
    this.kartManager.updateFromServer(this.localPlayerId, localState);
    this.clientPhysics.initState(localState);

    // Create AI karts
    this._soloAIs = [];
    for (let i = 0; i < 7; i++) {
      const aiId = `ai_${i}`;
      const rider = CONSTANTS.RIDERS[i % CONSTANTS.RIDERS.length];
      this.kartManager.createKart(aiId, rider, i + 1, false);
      const aiSpawn = spawnPositions[i + 1];
      const aiState = {
        x: aiSpawn.x, y: 0, z: aiSpawn.z,
        angle: aiSpawn.angle, speed: 0, steerAngle: 0,
        drifting: false, driftTier: 0, driftDirection: 0,
        boostTimer: 0, shieldTimer: 0, spinTimer: 0,
        powerup: null, lap: 0, position: i + 2, finished: false,
        checkpoint: 0, raceProgress: 0,
      };
      this.kartManager.updateFromServer(aiId, aiState);

      this._soloAIs.push({
        id: aiId,
        state: aiState,
        checkpoints,
        personality: Math.random(),
      });
    }

    // Create item boxes
    const boxes = itemBoxPositions.map((pos, i) => ({ id: i, x: pos.x, z: pos.z }));
    this.powerupVisuals.createItemBoxes(boxes);

    // Countdown
    this.ui.showScreen('racing');
    this.ui.setRiderIcon(this.localRider);

    let count = 3;
    this.ui.showCountdown(count);
    const countdownInterval = setInterval(() => {
      count--;
      this.ui.showCountdown(count);
      if (count <= 0) {
        clearInterval(countdownInterval);
        this.state = 'racing';
        this.ui.showHUD();
      }
    }, 1000);
  }

  _updateSoloMode(dt) {
    if (this.state !== 'racing' || !this.soloMode) return;

    const localState = this.clientPhysics.localState;
    if (!localState) return;

    // Apply player input
    this._updateInput();
    this.clientPhysics.applyInput(this.input, dt);
    this.input.usePowerup = false; // Reset after send

    // Update local kart visual
    this.kartManager.updateFromServer(this.localPlayerId, { ...localState });

    // Update race progress for local player
    this._updateSoloCheckpoint(localState, this.trackData.checkpoints);

    // AI updates
    const AI_CONST = CONSTANTS.AI;
    const K = CONSTANTS.KART;
    for (const ai of this._soloAIs) {
      if (ai.state.finished) continue;

      // AI input
      const wpIdx = (ai.state.checkpoint + AI_CONST.LOOKAHEAD) % ai.checkpoints.length;
      const target = ai.checkpoints[wpIdx];
      const angleToTarget = Utils.angleTo(ai.state.x, ai.state.z, target.x, target.z);
      const angleDiff = Utils.normalizeAngle(angleToTarget - ai.state.angle);
      const steer = Utils.clamp(angleDiff * 2.5, -1, 1);
      let throttle = 1;
      if (Math.abs(angleDiff) > 1.2 && ai.state.speed > 20) throttle = -0.3;
      else if (Math.abs(angleDiff) > 0.8 && ai.state.speed > 30) throttle = 0.3;

      // Simple physics for AI
      const maxSpd = K.MAX_SPEED * (ai.state.boostTimer > 0 ? 1.3 : 1);
      if (throttle > 0) {
        ai.state.speed += K.ACCELERATION * throttle * dt;
        if (ai.state.speed > maxSpd) ai.state.speed = maxSpd;
      } else {
        ai.state.speed -= K.BRAKING * Math.abs(throttle) * dt;
        if (ai.state.speed < 0) ai.state.speed = 0;
      }
      ai.state.speed *= K.DRAG;

      const speedFactor = 1 - (Math.abs(ai.state.speed) / K.MAX_SPEED) * K.SPEED_STEER_FACTOR;
      ai.state.steerAngle = Utils.lerp(ai.state.steerAngle, steer * K.MAX_STEER_ANGLE * speedFactor, K.STEER_SPEED * dt);

      if (Math.abs(ai.state.speed) > 0.5) {
        ai.state.angle += ai.state.steerAngle * (ai.state.speed / K.MAX_SPEED) * dt * 3;
      }

      ai.state.x += Math.sin(ai.state.angle) * ai.state.speed * dt;
      ai.state.z += Math.cos(ai.state.angle) * ai.state.speed * dt;

      // Checkpoint progress
      this._updateSoloCheckpoint(ai.state, ai.checkpoints);

      // Update visuals
      this.kartManager.updateFromServer(ai.id, { ...ai.state });
    }

    // Rank all
    const allStates = [localState, ...this._soloAIs.map(a => a.state)];
    allStates.sort((a, b) => b.raceProgress - a.raceProgress);
    allStates.forEach((s, i) => s.position = i + 1);

    // Update HUD
    this.ui.updateHUD({
      speed: localState.speed,
      position: localState.position,
      lap: localState.lap,
      powerup: localState.powerup,
    });

    // Minimap
    const kartMap = {};
    kartMap[this.localPlayerId] = localState;
    for (const ai of this._soloAIs) kartMap[ai.id] = ai.state;
    this.ui.updateMinimap(this.trackData.checkpoints, kartMap, this.localPlayerId);

    // Check finish
    if (localState.finished && this.state === 'racing') {
      this.state = 'finished';
      const results = allStates.map((s, i) => ({
        position: i + 1,
        name: s === localState ? 'You' : `CPU ${this._soloAIs.findIndex(a => a.state === s) + 1}`,
        time: s.finished ? 1000 * (CONSTANTS.LAPS * 30) : null, // Approximate
        isAI: s !== localState,
      }));
      setTimeout(() => this.ui.showResults(results), 2000);
    }
  }

  _updateSoloCheckpoint(state, checkpoints) {
    if (state.finished || !checkpoints) return;
    const nextCP = (state.checkpoint + 1) % checkpoints.length;
    const cp = checkpoints[nextCP];
    const dist = Utils.dist2D(state.x, state.z, cp.x, cp.z);

    if (dist < CONSTANTS.AI.WAYPOINT_REACH_DIST) {
      state.checkpoint = nextCP;
      if (nextCP === 0 && state.raceProgress > 0) {
        state.lap++;
        if (state.lap >= CONSTANTS.LAPS) {
          state.finished = true;
        }
      }
    }
    state.raceProgress = state.lap * checkpoints.length + state.checkpoint +
      (1 - Math.min(dist, CONSTANTS.AI.WAYPOINT_REACH_DIST * 4) / (CONSTANTS.AI.WAYPOINT_REACH_DIST * 4));
  }

  _startLoop() {
    this.lastTime = performance.now();

    const loop = (time) => {
      requestAnimationFrame(loop);

      const dt = Math.min((time - this.lastTime) / 1000, 0.05); // Cap at 50ms
      this.lastTime = time;

      // Update input
      if (this.state === 'racing' && !this.soloMode) {
        this._updateInput();

        // Send input to server
        this.network.sendInput({
          throttle: this.input.throttle,
          steer: this.input.steer,
          drift: this.input.drift,
          usePowerup: this.input.usePowerup,
        });
        this.input.usePowerup = false;
      }

      // Solo mode physics
      if (this.soloMode) {
        this._updateSoloMode(dt);
      }

      // Interpolation factor
      const timeSinceUpdate = time - this.lastServerUpdate;
      this.interpFactor = Utils.clamp(timeSinceUpdate / this.serverTickRate, 0, 1);

      // Render karts
      this.kartManager.render(this.soloMode ? 1 : this.interpFactor, time);

      // Render missiles
      this.missileVisuals.render(this.interpFactor, time);

      // Update effects
      this.effects.update(dt);

      // Update power-up animations
      this.powerupVisuals.update(time);

      // Update lighting
      this.lighting.update(time);

      // Camera follow
      const localKart = this.kartManager.getLocalKart();
      if (localKart && (this.state === 'racing' || this.state === 'countdown')) {
        this.renderer.updateCamera(localKart, dt);
      }

      // Minimap (online mode)
      if (!this.soloMode && this.trackData && this.lastServerKarts) {
        this.ui.updateMinimap(this.trackData.checkpoints, this.lastServerKarts, this.localPlayerId);
      }

      // Render scene
      this.renderer.render();
    };

    requestAnimationFrame(loop);
  }

  _cleanup() {
    this.kartManager.dispose();
    this.powerupVisuals.dispose();
    this.missileVisuals.dispose();
    this.network.disconnect();
    this.state = 'menu';
    this.trackData = null;
    this.racers = [];
    this.soloMode = false;
    this._soloAIs = [];

    // Clear track
    while (this.renderer.trackGroup.children.length > 0) {
      this.renderer.trackGroup.remove(this.renderer.trackGroup.children[0]);
    }
  }
}

// Boot
window.addEventListener('DOMContentLoaded', () => {
  const game = new Game();
  game.init();
});
