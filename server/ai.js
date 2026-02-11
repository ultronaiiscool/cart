// Server-side AI racer logic
const CONSTANTS = require('../shared/constants');
const Utils = require('../shared/utils');

const AI = CONSTANTS.AI;

class AIRacer {
  constructor(id, track) {
    this.id = id;
    this.track = track;
    this.targetWaypoint = 0;
    this.powerupTimer = 0;
    this.driftTimer = 0;
    this.personality = Math.random(); // 0=cautious, 1=aggressive
    this.rng = Utils.seededRandom(id.charCodeAt(0) * 1000 + Date.now());
  }

  // Generate input for this AI racer each tick
  getInput(kart, allKarts, checkpoints) {
    const input = { throttle: 0, steer: 0, drift: false, usePowerup: false };

    if (kart.finished || kart.spinTimer > 0) return input;

    if (!checkpoints || checkpoints.length === 0) {
      input.throttle = 1;
      return input;
    }

    // Find target waypoint
    const wpCount = checkpoints.length;
    const nextIdx = (kart.checkpoint + AI.LOOKAHEAD) % wpCount;
    const target = checkpoints[nextIdx];

    // Angle to target
    const angleToTarget = Utils.angleTo(kart.x, kart.z, target.x, target.z);
    let angleDiff = Utils.normalizeAngle(angleToTarget - kart.angle);

    // Steering
    const steerAmount = Utils.clamp(angleDiff * 2.5, -1, 1);
    input.steer = steerAmount;

    // Throttle - always accelerate, brake in sharp turns
    if (Math.abs(angleDiff) > 1.2 && kart.speed > 20) {
      input.throttle = -0.3;
    } else if (Math.abs(angleDiff) > 0.8 && kart.speed > 30) {
      input.throttle = 0.3;
    } else {
      input.throttle = 1;
    }

    // Drift on corners
    if (Math.abs(angleDiff) > AI.DRIFT_ANGLE_THRESHOLD && kart.speed > CONSTANTS.DRIFT.MIN_SPEED) {
      input.drift = true;
    }

    // Rubber-banding: adjust speed based on position
    this._applyRubberBanding(kart, allKarts, input);

    // Power-up usage
    this.powerupTimer -= CONSTANTS.TICK_DELTA;
    if (kart.powerup && this.powerupTimer <= 0) {
      input.usePowerup = this._shouldUsePowerup(kart, allKarts);
      if (input.usePowerup) {
        this.powerupTimer = AI.POWERUP_USE_DELAY + this.rng() * 2;
      }
    }

    return input;
  }

  _applyRubberBanding(kart, allKarts, input) {
    const kartArray = Object.values(allKarts);
    if (kartArray.length <= 1) return;

    // Find leader's progress
    let maxProgress = 0;
    let minProgress = Infinity;
    for (const k of kartArray) {
      if (k.raceProgress > maxProgress) maxProgress = k.raceProgress;
      if (k.raceProgress < minProgress) minProgress = k.raceProgress;
    }

    const range = maxProgress - minProgress;
    if (range < 1) return;

    const normalizedPos = (kart.raceProgress - minProgress) / range; // 0=last, 1=first

    // Behind racers get slight boost, leaders get slight penalty
    if (normalizedPos < 0.3) {
      // Behind - subtle speed boost
      kart.speed = Math.min(kart.speed * (1 + AI.RUBBER_BAND_STRENGTH * 0.5), CONSTANTS.KART.MAX_SPEED * 1.05);
    } else if (normalizedPos > 0.8) {
      // Way ahead - very subtle slowdown
      kart.speed *= (1 - AI.RUBBER_BAND_STRENGTH * 0.2);
    }
  }

  _shouldUsePowerup(kart, allKarts) {
    const type = kart.powerup;
    if (!type) return false;

    switch (type) {
      case 'speed_boost':
        // Use when not in first or when speed is reasonable
        return kart.speed > 10;

      case 'shield':
        // Use more readily when behind
        return kart.position > 2 || this.rng() > 0.5;

      case 'trap':
        // Use when others are nearby behind
        return kart.position < 6;

      case 'spin':
        // Use when someone is ahead and nearby
        return kart.position > 1;

      case 'missile': {
        // Use when there's a target ahead
        for (const other of Object.values(allKarts)) {
          if (other.id === kart.id) continue;
          if (Utils.isInCone(kart.x, kart.z, kart.angle, other.x, other.z,
            CONSTANTS.MISSILE.LOCK_CONE, CONSTANTS.MISSILE.LOCK_RANGE)) {
            return true;
          }
        }
        return false;
      }

      default:
        return this.rng() > 0.5;
    }
  }
}

module.exports = AIRacer;
