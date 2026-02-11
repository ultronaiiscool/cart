// Server-side missile simulation
const CONSTANTS = require('../shared/constants');
const Utils = require('../shared/utils');

const M = CONSTANTS.MISSILE;

class MissileManager {
  constructor() {
    this.missiles = [];
    this.nextId = 1;
  }

  // Launch a missile from a kart
  launch(kart, karts) {
    // Find lock-on target
    let target = null;
    let bestDist = M.LOCK_RANGE;

    for (const other of Object.values(karts)) {
      if (other.id === kart.id) continue;
      if (other.finished) continue;

      if (!Utils.isInCone(kart.x, kart.z, kart.angle, other.x, other.z, M.LOCK_CONE, M.LOCK_RANGE)) {
        continue;
      }

      const dist = Utils.dist2D(kart.x, kart.z, other.x, other.z);
      if (dist < bestDist) {
        bestDist = dist;
        target = other;
      }
    }

    const missile = {
      id: this.nextId++,
      ownerId: kart.id,
      targetId: target ? target.id : null,
      x: kart.x + Math.sin(kart.angle) * 2,
      z: kart.z + Math.cos(kart.angle) * 2,
      angle: kart.angle,
      speed: M.SPEED,
      lifetime: M.LIFETIME,
      active: true,
    };

    this.missiles.push(missile);
    return missile;
  }

  // Update all missiles
  update(dt, karts) {
    const hits = [];

    for (let i = this.missiles.length - 1; i >= 0; i--) {
      const m = this.missiles[i];
      if (!m.active) continue;

      m.lifetime -= dt;
      if (m.lifetime <= 0) {
        this.missiles.splice(i, 1);
        continue;
      }

      // Track target if exists
      if (m.targetId && karts[m.targetId]) {
        const target = karts[m.targetId];
        if (!target.finished) {
          const desiredAngle = Utils.angleTo(m.x, m.z, target.x, target.z);
          let angleDiff = Utils.normalizeAngle(desiredAngle - m.angle);

          // Limited turn rate
          const maxTurn = M.TURN_RATE * dt;
          if (angleDiff > maxTurn) angleDiff = maxTurn;
          else if (angleDiff < -maxTurn) angleDiff = -maxTurn;

          m.angle += angleDiff;

          // Check if lost lock (sharp angle)
          const absAngleDiff = Math.abs(Utils.normalizeAngle(desiredAngle - m.angle));
          if (absAngleDiff > M.LOCK_CONE) {
            m.targetId = null; // Lost lock
          }
        }
      }

      // Move missile
      m.x += Math.sin(m.angle) * m.speed * dt;
      m.z += Math.cos(m.angle) * m.speed * dt;

      // Check collision with any kart
      for (const kart of Object.values(karts)) {
        if (kart.id === m.ownerId) continue;
        if (kart.finished) continue;

        const dist = Utils.dist2D(m.x, m.z, kart.x, kart.z);
        if (dist < M.RADIUS + CONSTANTS.KART.KART_RADIUS) {
          m.active = false;

          if (kart.shieldTimer > 0) {
            kart.shieldTimer = 0;
            hits.push({
              missileId: m.id,
              targetId: kart.id,
              blocked: true,
              x: m.x,
              z: m.z,
            });
          } else if (kart.invincibleTimer <= 0) {
            kart.spinTimer = CONSTANTS.POWERUP.SPIN_DURATION;
            kart.speed *= 0.2;
            hits.push({
              missileId: m.id,
              targetId: kart.id,
              blocked: false,
              x: m.x,
              z: m.z,
            });
          }

          break;
        }
      }

      if (!m.active) {
        this.missiles.splice(i, 1);
      }
    }

    return hits;
  }

  getState() {
    return this.missiles.map(m => ({
      id: m.id,
      x: m.x,
      z: m.z,
      angle: m.angle,
      targetId: m.targetId,
    }));
  }
}

module.exports = MissileManager;
