// Server-side lobby and race management
const CONSTANTS = require('../shared/constants');
const Utils = require('../shared/utils');
const ServerPhysics = require('./physics');
const AIRacer = require('./ai');
const PowerUpManager = require('./powerups');
const MissileManager = require('./missiles');

// Track definition - oval-ish circuit with curves
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

class Track {
  constructor() {
    this.controlPoints = TRACK_CONTROL_POINTS;
    this.checkpoints = this._generateCheckpoints(CONSTANTS.TRACK.CHECKPOINT_COUNT);
    this.itemBoxPositions = this._generateItemBoxPositions();
    this.spawnPositions = this._generateSpawnPositions();
  }

  _generateCheckpoints(count) {
    const points = [];
    for (let i = 0; i < count; i++) {
      const t = i / count;
      const pt = Utils.getSplinePoint(this.controlPoints, t);
      points.push(pt);
    }
    return points;
  }

  _generateItemBoxPositions() {
    const positions = [];
    // Place item boxes at regular intervals along the track
    for (let i = 0; i < 12; i++) {
      const t = i / 12;
      const pt = Utils.getSplinePoint(this.controlPoints, t);
      const tan = Utils.getSplineTangent(this.controlPoints, t);
      // Offset slightly to left and right
      positions.push({ x: pt.x + tan.z * 3, z: pt.z - tan.x * 3 });
      positions.push({ x: pt.x - tan.z * 3, z: pt.z + tan.x * 3 });
    }
    return positions;
  }

  _generateSpawnPositions() {
    const positions = [];
    const startT = 0;
    for (let i = 0; i < CONSTANTS.MAX_RACERS; i++) {
      const row = Math.floor(i / 2);
      const col = i % 2;
      const t = startT - row * 0.015;
      const pt = Utils.getSplinePoint(this.controlPoints, (t + 1) % 1);
      const tan = Utils.getSplineTangent(this.controlPoints, (t + 1) % 1);
      const offset = (col === 0 ? -1 : 1) * 2.5;
      positions.push({
        x: pt.x + tan.z * offset,
        z: pt.z - tan.x * offset,
        angle: Math.atan2(tan.x, tan.z),
      });
    }
    return positions;
  }

  isOnTrack(x, z) {
    // Check distance to nearest track segment
    let minDist = Infinity;
    const n = this.checkpoints.length;
    for (let i = 0; i < n; i++) {
      const a = this.checkpoints[i];
      const b = this.checkpoints[(i + 1) % n];
      const dist = this._distToSegment(x, z, a.x, a.z, b.x, b.z);
      if (dist < minDist) minDist = dist;
    }
    return minDist < CONSTANTS.TRACK.HALF_WIDTH;
  }

  _distToSegment(px, pz, ax, az, bx, bz) {
    const dx = bx - ax;
    const dz = bz - az;
    const len2 = dx * dx + dz * dz;
    if (len2 === 0) return Utils.dist2D(px, pz, ax, az);

    let t = ((px - ax) * dx + (pz - az) * dz) / len2;
    t = Utils.clamp(t, 0, 1);
    return Utils.dist2D(px, pz, ax + t * dx, az + t * dz);
  }

  getBounds() {
    return { minX: -60, maxX: 120, minZ: -50, maxZ: 120 };
  }

  getTrackData() {
    return {
      controlPoints: this.controlPoints,
      checkpoints: this.checkpoints,
      itemBoxPositions: this.itemBoxPositions,
      spawnPositions: this.spawnPositions,
      width: CONSTANTS.TRACK.WIDTH,
    };
  }
}

class Lobby {
  constructor(id, onBroadcast) {
    this.id = id;
    this.broadcast = onBroadcast;
    this.state = 'waiting'; // waiting, countdown, racing, finished
    this.players = new Map(); // id -> { ws, name, rider, ready }
    this.track = new Track();
    this.physics = new ServerPhysics(this.track);
    this.powerups = new PowerUpManager();
    this.missiles = new MissileManager();
    this.karts = {};
    this.aiRacers = [];
    this.tickInterval = null;
    this.raceStartTime = 0;
    this.finishOrder = [];
    this.countdownTimer = 0;
    this.networkTickCounter = 0;
  }

  // Add a human player
  addPlayer(id, ws, name) {
    if (this.players.size >= CONSTANTS.MAX_HUMANS) {
      return false;
    }
    if (this.state !== 'waiting') {
      return false;
    }

    this.players.set(id, {
      ws,
      name: name || `Player ${this.players.size + 1}`,
      rider: CONSTANTS.RIDERS[this.players.size % CONSTANTS.RIDERS.length],
      ready: false,
    });

    this._broadcastLobbyState();
    return true;
  }

  // Remove a player
  removePlayer(id) {
    this.players.delete(id);
    delete this.karts[id];

    if (this.players.size === 0 && this.state === 'racing') {
      this.stopRace();
    }

    this._broadcastLobbyState();
  }

  // Player selects rider
  selectRider(playerId, rider) {
    const player = this.players.get(playerId);
    if (!player) return;
    if (CONSTANTS.RIDERS.includes(rider)) {
      player.rider = rider;
      this._broadcastLobbyState();
    }
  }

  // Player ready
  setReady(playerId, ready) {
    const player = this.players.get(playerId);
    if (!player) return;
    player.ready = ready;

    // Check if all players ready
    let allReady = true;
    for (const [, p] of this.players) {
      if (!p.ready) { allReady = false; break; }
    }

    if (allReady && this.players.size > 0) {
      this.startCountdown();
    }

    this._broadcastLobbyState();
  }

  // Start countdown
  startCountdown() {
    this.state = 'countdown';
    this.countdownTimer = CONSTANTS.COUNTDOWN_SECONDS;

    // Spawn karts
    this._spawnAllRacers();

    // Initialize power-up boxes
    this.powerups.initItemBoxes(this.track.itemBoxPositions);

    // Send race start data
    const raceData = {
      track: this.track.getTrackData(),
      racers: this._getRacerList(),
      powerupBoxes: this.powerups.getState().boxes,
    };

    this._broadcastAll(CONSTANTS.MSG.RACE_START, raceData);

    // Countdown tick
    const countdownInterval = setInterval(() => {
      this.countdownTimer--;
      this._broadcastAll(CONSTANTS.MSG.COUNTDOWN, { count: this.countdownTimer });

      if (this.countdownTimer <= 0) {
        clearInterval(countdownInterval);
        this.startRace();
      }
    }, 1000);
  }

  _spawnAllRacers() {
    let spawnIdx = 0;

    // Human players
    for (const [id, player] of this.players) {
      const spawn = this.track.spawnPositions[spawnIdx];
      this.karts[id] = this.physics.createKartState(id, spawn, spawn.angle);
      this.karts[id].rider = player.rider;
      this.karts[id].isAI = false;
      this.karts[id].name = player.name;
      spawnIdx++;
    }

    // Fill remaining with AI
    const aiCount = CONSTANTS.MAX_RACERS - this.players.size;
    const usedRiders = [...this.players.values()].map(p => p.rider);
    const availableRiders = [...CONSTANTS.RIDERS];

    for (let i = 0; i < aiCount; i++) {
      const aiId = `ai_${i}`;
      const spawn = this.track.spawnPositions[spawnIdx];
      this.karts[aiId] = this.physics.createKartState(aiId, spawn, spawn.angle);

      // Assign rider - cycle through available
      const rider = availableRiders[i % availableRiders.length];
      this.karts[aiId].rider = rider;
      this.karts[aiId].isAI = true;
      this.karts[aiId].name = `CPU ${i + 1}`;

      this.aiRacers.push(new AIRacer(aiId, this.track));
      spawnIdx++;
    }
  }

  _getRacerList() {
    return Object.values(this.karts).map(k => ({
      id: k.id,
      rider: k.rider,
      name: k.name,
      isAI: k.isAI,
    }));
  }

  // Start the race
  startRace() {
    this.state = 'racing';
    this.raceStartTime = Date.now();
    this.networkTickCounter = 0;

    // Fixed timestep game loop
    this.tickInterval = setInterval(() => {
      this._tick();
    }, 1000 / CONSTANTS.TICK_RATE);
  }

  // Main game tick
  _tick() {
    if (this.state !== 'racing') return;

    const dt = CONSTANTS.TICK_DELTA;

    // Process AI inputs
    for (const ai of this.aiRacers) {
      const kart = this.karts[ai.id];
      if (!kart || kart.finished) continue;

      const input = ai.getInput(kart, this.karts, this.track.checkpoints);
      this.physics.updateKart(kart, input);

      // AI power-up usage
      if (input.usePowerup && kart.powerup) {
        this._handlePowerupUse(kart);
      }
    }

    // Process human player karts (inputs are applied via processInput)
    for (const [id] of this.players) {
      const kart = this.karts[id];
      if (kart && !kart._inputProcessed) {
        // Apply last known input or idle
        this.physics.updateKart(kart, kart._lastInput || { throttle: 0, steer: 0, drift: false });
      }
      if (kart) kart._inputProcessed = false;
    }

    // Collisions
    this.physics.checkCollisions(this.karts);

    // Power-ups
    const puUpdate = this.powerups.update(dt);
    if (puUpdate.respawned.length > 0) {
      this._broadcastAll(CONSTANTS.MSG.POWERUP_SPAWN, { boxes: puUpdate.respawned });
    }

    // Check item box collection
    for (const kart of Object.values(this.karts)) {
      const collected = this.powerups.checkCollection(kart);
      if (collected) {
        this._broadcastAll(CONSTANTS.MSG.POWERUP_COLLECT, {
          kartId: kart.id,
          boxId: collected.boxId,
          type: collected.type,
        });
      }

      // Check trap hits
      const trapHit = this.powerups.checkTraps(kart);
      if (trapHit) {
        this._broadcastAll(CONSTANTS.MSG.TRAP_HIT, {
          kartId: kart.id,
          trapId: trapHit.trapId,
          blocked: trapHit.blocked,
        });
      }
    }

    // Missiles
    const missileHits = this.missiles.update(dt, this.karts);
    for (const hit of missileHits) {
      this._broadcastAll(CONSTANTS.MSG.MISSILE_HIT, hit);
    }

    // Race progress
    for (const kart of Object.values(this.karts)) {
      const result = this.physics.updateRaceProgress(kart, this.track.checkpoints);
      if (result === 'lap') {
        this._broadcastAll(CONSTANTS.MSG.LAP_COMPLETE, { kartId: kart.id, lap: kart.lap });
      } else if (result === 'finished') {
        this.finishOrder.push(kart.id);
        this._broadcastAll(CONSTANTS.MSG.RACE_FINISH, {
          kartId: kart.id,
          position: this.finishOrder.length,
          time: Date.now() - this.raceStartTime,
        });

        // Check if all finished
        if (this.finishOrder.length >= Object.keys(this.karts).length) {
          this._endRace();
        }
      }
    }

    // Rank karts
    this.physics.rankKarts(this.karts);

    // Send state updates at network rate
    this.networkTickCounter++;
    if (this.networkTickCounter >= CONSTANTS.TICK_RATE / CONSTANTS.NET.UPDATE_RATE) {
      this.networkTickCounter = 0;
      this._broadcastGameState();
    }
  }

  // Process player input
  processInput(playerId, input) {
    const kart = this.karts[playerId];
    if (!kart || this.state !== 'racing') return;

    kart._lastInput = input;
    kart._inputProcessed = true;
    this.physics.updateKart(kart, input);

    // Power-up use
    if (input.usePowerup && kart.powerup) {
      this._handlePowerupUse(kart);
    }
  }

  _handlePowerupUse(kart) {
    const type = kart.powerup;

    if (type === 'missile') {
      const missile = this.missiles.launch(kart, this.karts);
      kart.powerup = null;
      this._broadcastAll(CONSTANTS.MSG.MISSILE_SPAWN, {
        missile: {
          id: missile.id,
          ownerId: missile.ownerId,
          x: missile.x,
          z: missile.z,
          angle: missile.angle,
          targetId: missile.targetId,
        },
      });
    } else {
      const result = this.powerups.usePowerup(kart, this.karts);
      if (result) {
        this._broadcastAll(CONSTANTS.MSG.POWERUP_USE, result);
      }
    }
  }

  _broadcastGameState() {
    const state = {
      karts: {},
      missiles: this.missiles.getState(),
      time: Date.now() - this.raceStartTime,
    };

    for (const [id, kart] of Object.entries(this.karts)) {
      state.karts[id] = {
        x: Math.round(kart.x * 100) / 100,
        y: Math.round(kart.y * 100) / 100,
        z: Math.round(kart.z * 100) / 100,
        angle: Math.round(kart.angle * 1000) / 1000,
        speed: Math.round(kart.speed * 10) / 10,
        steerAngle: Math.round(kart.steerAngle * 100) / 100,
        drifting: kart.drifting,
        driftTier: kart.driftTier,
        driftDirection: kart.driftDirection,
        boostTimer: kart.boostTimer > 0 ? 1 : 0,
        shieldTimer: kart.shieldTimer > 0 ? 1 : 0,
        spinTimer: kart.spinTimer > 0 ? 1 : 0,
        powerup: kart.powerup,
        lap: kart.lap,
        position: kart.position,
        finished: kart.finished,
      };
    }

    this._broadcastAll(CONSTANTS.MSG.GAME_STATE, state);
  }

  _endRace() {
    this.state = 'finished';
    clearInterval(this.tickInterval);

    const results = this.physics.rankKarts(this.karts).map((k, i) => ({
      id: k.id,
      name: k.name,
      rider: k.rider,
      position: i + 1,
      time: k.finishTime ? k.finishTime - this.raceStartTime : null,
      isAI: k.isAI,
    }));

    this._broadcastAll(CONSTANTS.MSG.RACE_RESULTS, { results });
  }

  stopRace() {
    if (this.tickInterval) clearInterval(this.tickInterval);
    this.state = 'finished';
  }

  _broadcastLobbyState() {
    const state = {
      lobbyId: this.id,
      players: [],
      state: this.state,
    };
    for (const [id, p] of this.players) {
      state.players.push({
        id,
        name: p.name,
        rider: p.rider,
        ready: p.ready,
      });
    }
    this._broadcastAll(CONSTANTS.MSG.LOBBY_STATE, state);
  }

  _broadcastAll(type, data) {
    const msg = JSON.stringify({ type, data });
    for (const [, player] of this.players) {
      try {
        if (player.ws.readyState === 1) { // WebSocket.OPEN
          player.ws.send(msg);
        }
      } catch (e) {
        // Connection may have closed
      }
    }
  }
}

module.exports = { Lobby, Track };
