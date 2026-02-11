// Server-side power-up system
const CONSTANTS = require('../shared/constants');
const Utils = require('../shared/utils');

const PU = CONSTANTS.POWERUP;

class PowerUpManager {
  constructor() {
    this.itemBoxes = [];
    this.activeTraps = [];
    this.nextTrapId = 1;
  }

  // Initialize item boxes along the track
  initItemBoxes(positions) {
    this.itemBoxes = positions.map((pos, i) => ({
      id: i,
      x: pos.x,
      y: 1.5,
      z: pos.z,
      active: true,
      respawnTimer: 0,
    }));
  }

  // Update item box respawn timers
  update(dt) {
    const respawned = [];
    for (const box of this.itemBoxes) {
      if (!box.active) {
        box.respawnTimer -= dt;
        if (box.respawnTimer <= 0) {
          box.active = true;
          respawned.push(box.id);
        }
      }
    }

    // Update trap lifetimes
    const expiredTraps = [];
    for (let i = this.activeTraps.length - 1; i >= 0; i--) {
      this.activeTraps[i].lifetime -= dt;
      if (this.activeTraps[i].lifetime <= 0) {
        expiredTraps.push(this.activeTraps[i].id);
        this.activeTraps.splice(i, 1);
      }
    }

    return { respawned, expiredTraps };
  }

  // Check if a kart collects an item box
  checkCollection(kart) {
    for (const box of this.itemBoxes) {
      if (!box.active) continue;
      if (kart.powerup !== null) continue; // Already has item

      const dist = Utils.dist2D(kart.x, kart.z, box.x, box.z);
      if (dist < 2.5) {
        box.active = false;
        box.respawnTimer = PU.ITEM_BOX_RESPAWN;

        // Assign power-up based on position
        const powerupType = Utils.weightedPowerup(kart.position, CONSTANTS.MAX_RACERS);
        kart.powerup = powerupType;

        return { boxId: box.id, type: powerupType };
      }
    }
    return null;
  }

  // Use a power-up
  usePowerup(kart, karts, direction) {
    const type = kart.powerup;
    if (!type) return null;

    kart.powerup = null;
    const result = { type, kartId: kart.id };

    switch (type) {
      case 'speed_boost':
        kart.boostMultiplier = PU.SPEED_BOOST_MULT;
        kart.boostTimer = PU.SPEED_BOOST_DURATION;
        result.action = 'self_boost';
        break;

      case 'shield':
        kart.shieldTimer = PU.SHIELD_DURATION;
        result.action = 'self_shield';
        break;

      case 'trap': {
        const trapX = kart.x - Math.sin(kart.angle) * 3;
        const trapZ = kart.z - Math.cos(kart.angle) * 3;
        const trap = {
          id: this.nextTrapId++,
          x: trapX,
          z: trapZ,
          ownerId: kart.id,
          lifetime: PU.TRAP_LIFETIME,
        };
        this.activeTraps.push(trap);
        result.action = 'place_trap';
        result.trap = trap;
        break;
      }

      case 'spin': {
        // Hit nearest kart in range ahead
        let target = this._findNearestAhead(kart, karts, 30);
        if (target) {
          if (target.shieldTimer > 0) {
            target.shieldTimer = 0;
            result.action = 'shield_block';
            result.targetId = target.id;
          } else {
            target.spinTimer = PU.SPIN_DURATION;
            result.action = 'spin_hit';
            result.targetId = target.id;
          }
        } else {
          result.action = 'spin_miss';
        }
        break;
      }

      case 'missile':
        // Missile spawning handled by MissileManager
        result.action = 'launch_missile';
        break;
    }

    return result;
  }

  // Check trap collisions
  checkTraps(kart) {
    for (let i = this.activeTraps.length - 1; i >= 0; i--) {
      const trap = this.activeTraps[i];
      if (trap.ownerId === kart.id) continue;

      const dist = Utils.dist2D(kart.x, kart.z, trap.x, trap.z);
      if (dist < PU.TRAP_RADIUS) {
        this.activeTraps.splice(i, 1);

        if (kart.shieldTimer > 0) {
          kart.shieldTimer = 0;
          return { trapId: trap.id, blocked: true };
        }

        kart.spinTimer = PU.SPIN_DURATION;
        return { trapId: trap.id, blocked: false };
      }
    }
    return null;
  }

  _findNearestAhead(kart, karts, range) {
    let nearest = null;
    let nearestDist = range;

    for (const other of Object.values(karts)) {
      if (other.id === kart.id) continue;
      if (!Utils.isInCone(kart.x, kart.z, kart.angle, other.x, other.z, Math.PI, range)) continue;

      const dist = Utils.dist2D(kart.x, kart.z, other.x, other.z);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = other;
      }
    }
    return nearest;
  }

  getState() {
    return {
      boxes: this.itemBoxes.map(b => ({ id: b.id, x: b.x, z: b.z, active: b.active })),
      traps: this.activeTraps.map(t => ({ id: t.id, x: t.x, z: t.z })),
    };
  }
}

module.exports = PowerUpManager;
