// Server-side physics simulation
const CONSTANTS = require('../shared/constants');
const Utils = require('../shared/utils');

const K = CONSTANTS.KART;
const D = CONSTANTS.DRIFT;
const dt = CONSTANTS.TICK_DELTA;

class ServerPhysics {
  constructor(track) {
    this.track = track;
  }

  // Create a new kart state
  createKartState(id, spawnPos, spawnAngle) {
    return {
      id,
      x: spawnPos.x,
      y: K.GROUND_Y,
      z: spawnPos.z,
      angle: spawnAngle,
      speed: 0,
      steerAngle: 0,
      // Drift
      drifting: false,
      driftDirection: 0,
      driftCharge: 0,
      driftTier: 0,
      // Boost
      boostTimer: 0,
      boostMultiplier: 1,
      // Status
      spinTimer: 0,
      shieldTimer: 0,
      invincibleTimer: 0,
      // Power-up
      powerup: null,
      // Race progress
      lap: 0,
      checkpoint: 0,
      raceProgress: 0,
      finished: false,
      finishTime: 0,
      position: 1,
      // Collision
      hitTimer: 0,
    };
  }

  // Process input and update kart state
  updateKart(kart, input) {
    if (kart.finished) return;

    // Spinning (hit by power-up)
    if (kart.spinTimer > 0) {
      kart.spinTimer -= dt;
      kart.speed *= (1 - CONSTANTS.POWERUP.SPIN_SPEED_LOSS * dt);
      kart.angle += 8 * dt; // Spin visually
      kart.speed *= K.DRAG;
      this._moveKart(kart);
      return;
    }

    // Hit stun
    if (kart.hitTimer > 0) {
      kart.hitTimer -= dt;
      kart.speed *= 0.95;
      this._moveKart(kart);
      return;
    }

    // Timers
    if (kart.boostTimer > 0) {
      kart.boostTimer -= dt;
      if (kart.boostTimer <= 0) kart.boostMultiplier = 1;
    }
    if (kart.shieldTimer > 0) kart.shieldTimer -= dt;
    if (kart.invincibleTimer > 0) kart.invincibleTimer -= dt;

    const throttle = input.throttle || 0; // -1 to 1
    const steer = input.steer || 0; // -1 to 1
    const drift = input.drift || false;

    // Check if on track
    const onTrack = this._isOnTrack(kart.x, kart.z);
    const speedMult = onTrack ? 1 : K.OFF_TRACK_MULTIPLIER;

    // Acceleration / braking
    const maxSpd = K.MAX_SPEED * kart.boostMultiplier * speedMult;
    if (throttle > 0) {
      kart.speed += K.ACCELERATION * throttle * dt;
      if (kart.speed > maxSpd) kart.speed = maxSpd;
    } else if (throttle < 0) {
      if (kart.speed > 0.5) {
        kart.speed -= K.BRAKING * Math.abs(throttle) * dt;
        if (kart.speed < 0) kart.speed = 0;
      } else {
        kart.speed -= K.REVERSE_ACCEL * Math.abs(throttle) * dt;
        if (kart.speed < -K.REVERSE_MAX) kart.speed = -K.REVERSE_MAX;
      }
    }

    // Drag
    kart.speed *= K.DRAG;

    // Steering
    const speedFactor = 1 - (Math.abs(kart.speed) / K.MAX_SPEED) * K.SPEED_STEER_FACTOR;
    const targetSteer = steer * K.MAX_STEER_ANGLE * speedFactor;

    if (Math.abs(steer) > 0.1) {
      kart.steerAngle = Utils.lerp(kart.steerAngle, targetSteer, K.STEER_SPEED * dt);
    } else {
      kart.steerAngle = Utils.lerp(kart.steerAngle, 0, K.STEER_RETURN * dt);
    }

    // Drift logic
    if (drift && Math.abs(kart.speed) > D.MIN_SPEED && Math.abs(steer) > D.STEER_THRESHOLD) {
      if (!kart.drifting) {
        kart.drifting = true;
        kart.driftDirection = steer > 0 ? 1 : -1;
        kart.driftCharge = 0;
        kart.driftTier = 0;
      }
      kart.driftCharge += D.CHARGE_RATE * dt;

      if (kart.driftCharge >= D.TIER3_TIME) kart.driftTier = 3;
      else if (kart.driftCharge >= D.TIER2_TIME) kart.driftTier = 2;
      else if (kart.driftCharge >= D.TIER1_TIME) kart.driftTier = 1;

      // Apply drift angle offset
      kart.angle += kart.driftDirection * D.DRIFT_ANGLE * dt * (kart.speed / K.MAX_SPEED);
      kart.steerAngle *= D.DRIFT_STEER_MULT;
    } else if (kart.drifting) {
      // Release drift - apply boost
      if (kart.driftTier >= 1) {
        const boosts = [0, D.TIER1_BOOST, D.TIER2_BOOST, D.TIER3_BOOST];
        const durations = [0, D.BOOST_DURATION_1, D.BOOST_DURATION_2, D.BOOST_DURATION_3];
        kart.boostMultiplier = boosts[kart.driftTier];
        kart.boostTimer = durations[kart.driftTier];
      }
      kart.drifting = false;
      kart.driftCharge = 0;
      kart.driftTier = 0;
    }

    // Apply steering to angle
    if (Math.abs(kart.speed) > 0.5) {
      kart.angle += kart.steerAngle * (kart.speed / K.MAX_SPEED) * dt * 3;
    }

    this._moveKart(kart);
  }

  _moveKart(kart) {
    // Move based on speed and angle
    kart.x += Math.sin(kart.angle) * kart.speed * dt;
    kart.z += Math.cos(kart.angle) * kart.speed * dt;
    kart.y = K.GROUND_Y;

    // Track boundaries
    this._clampToTrackBounds(kart);
  }

  _isOnTrack(x, z) {
    if (!this.track) return true;
    return this.track.isOnTrack(x, z);
  }

  _clampToTrackBounds(kart) {
    if (!this.track) return;
    const bounds = this.track.getBounds();
    if (bounds) {
      kart.x = Utils.clamp(kart.x, bounds.minX, bounds.maxX);
      kart.z = Utils.clamp(kart.z, bounds.minZ, bounds.maxZ);
    }
  }

  // Check kart-to-kart collisions
  checkCollisions(karts) {
    const kartArray = Object.values(karts);
    for (let i = 0; i < kartArray.length; i++) {
      for (let j = i + 1; j < kartArray.length; j++) {
        const a = kartArray[i];
        const b = kartArray[j];
        const dist = Utils.dist2D(a.x, a.z, b.x, b.z);
        const minDist = K.KART_RADIUS * 2;
        if (dist < minDist && dist > 0.01) {
          // Push apart
          const overlap = minDist - dist;
          const nx = (b.x - a.x) / dist;
          const nz = (b.z - a.z) / dist;
          a.x -= nx * overlap * 0.5;
          a.z -= nz * overlap * 0.5;
          b.x += nx * overlap * 0.5;
          b.z += nz * overlap * 0.5;

          // Bounce speeds
          const relSpeed = Math.abs(a.speed - b.speed);
          if (relSpeed > 2) {
            a.speed *= K.BOUNCE_FACTOR;
            b.speed *= K.BOUNCE_FACTOR;
          }
        }
      }
    }
  }

  // Update race progress based on checkpoints
  updateRaceProgress(kart, checkpoints) {
    if (kart.finished || !checkpoints || checkpoints.length === 0) return null;

    const nextCP = (kart.checkpoint + 1) % checkpoints.length;
    const cp = checkpoints[nextCP];
    const dist = Utils.dist2D(kart.x, kart.z, cp.x, cp.z);

    if (dist < CONSTANTS.AI.WAYPOINT_REACH_DIST) {
      kart.checkpoint = nextCP;

      // Lap completion (crossing checkpoint 0)
      if (nextCP === 0 && kart.raceProgress > 0) {
        kart.lap++;
        if (kart.lap >= CONSTANTS.LAPS) {
          kart.finished = true;
          kart.finishTime = Date.now();
          return 'finished';
        }
        return 'lap';
      }
    }

    // Calculate total progress for ranking
    kart.raceProgress = kart.lap * checkpoints.length + kart.checkpoint +
      (1 - dist / (CONSTANTS.AI.WAYPOINT_REACH_DIST * 4));

    return null;
  }

  // Rank all karts by progress
  rankKarts(karts) {
    const sorted = Object.values(karts).sort((a, b) => {
      if (a.finished && b.finished) return a.finishTime - b.finishTime;
      if (a.finished) return -1;
      if (b.finished) return 1;
      return b.raceProgress - a.raceProgress;
    });
    sorted.forEach((k, i) => { k.position = i + 1; });
    return sorted;
  }
}

module.exports = ServerPhysics;
