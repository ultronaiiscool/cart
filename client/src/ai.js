// Client-side AI - used for single-player/offline mode
// Mirrors server AI logic for consistency
class ClientAI {
  constructor() {
    this.racers = [];
  }

  // Create AI racers for offline play
  createRacer(id, checkpoints) {
    this.racers.push({
      id,
      targetWP: 0,
      checkpoints,
      personality: Math.random(),
      powerupTimer: 0,
    });
  }

  // Get AI input (same logic as server)
  getInput(racer, kart) {
    const input = { throttle: 1, steer: 0, drift: false, usePowerup: false };

    if (!racer.checkpoints || racer.checkpoints.length === 0) return input;
    if (kart.finished || kart.spinTimer > 0) return input;

    const AI = CONSTANTS.AI;
    const wpIdx = (kart.checkpoint + AI.LOOKAHEAD) % racer.checkpoints.length;
    const target = racer.checkpoints[wpIdx];

    const angleToTarget = Utils.angleTo(kart.x, kart.z, target.x, target.z);
    const angleDiff = Utils.normalizeAngle(angleToTarget - kart.angle);

    input.steer = Utils.clamp(angleDiff * 2.5, -1, 1);

    if (Math.abs(angleDiff) > 1.2 && kart.speed > 20) {
      input.throttle = -0.3;
    } else if (Math.abs(angleDiff) > 0.8 && kart.speed > 30) {
      input.throttle = 0.3;
    }

    if (Math.abs(angleDiff) > AI.DRIFT_ANGLE_THRESHOLD && kart.speed > CONSTANTS.DRIFT.MIN_SPEED) {
      input.drift = true;
    }

    return input;
  }

  clear() {
    this.racers = [];
  }
}

window.ClientAI = ClientAI;
