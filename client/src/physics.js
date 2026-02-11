// Client-side input prediction (optional local physics for responsiveness)
class ClientPhysics {
  constructor() {
    this.localState = null;
    this.inputHistory = [];
  }

  // Initialize local prediction state from server
  initState(state) {
    this.localState = { ...state };
    this.inputHistory = [];
  }

  // Apply input locally for prediction
  applyInput(input, dt) {
    if (!this.localState) return null;

    const K = CONSTANTS.KART;
    const s = this.localState;

    if (s.spinTimer > 0 || s.finished) return s;

    const throttle = input.throttle || 0;
    const steer = input.steer || 0;

    // Simplified local prediction
    const maxSpd = K.MAX_SPEED * (s.boostTimer > 0 ? 1.3 : 1);
    if (throttle > 0) {
      s.speed += K.ACCELERATION * throttle * dt;
      if (s.speed > maxSpd) s.speed = maxSpd;
    } else if (throttle < 0) {
      if (s.speed > 0.5) {
        s.speed -= K.BRAKING * Math.abs(throttle) * dt;
        if (s.speed < 0) s.speed = 0;
      } else {
        s.speed -= K.REVERSE_ACCEL * Math.abs(throttle) * dt;
        if (s.speed < -K.REVERSE_MAX) s.speed = -K.REVERSE_MAX;
      }
    }
    s.speed *= K.DRAG;

    const speedFactor = 1 - (Math.abs(s.speed) / K.MAX_SPEED) * K.SPEED_STEER_FACTOR;
    const targetSteer = steer * K.MAX_STEER_ANGLE * speedFactor;
    s.steerAngle = Utils.lerp(s.steerAngle, targetSteer, K.STEER_SPEED * dt);

    if (Math.abs(s.speed) > 0.5) {
      s.angle += s.steerAngle * (s.speed / K.MAX_SPEED) * dt * 3;
    }

    s.x += Math.sin(s.angle) * s.speed * dt;
    s.z += Math.cos(s.angle) * s.speed * dt;

    return s;
  }

  // Reconcile with server state
  reconcile(serverState) {
    if (!this.localState) {
      this.localState = { ...serverState };
      return;
    }

    // Snap to server if too far off
    const dx = serverState.x - this.localState.x;
    const dz = serverState.z - this.localState.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist > 3) {
      // Too far - snap
      Object.assign(this.localState, serverState);
    } else {
      // Blend toward server
      this.localState.x = Utils.lerp(this.localState.x, serverState.x, 0.3);
      this.localState.z = Utils.lerp(this.localState.z, serverState.z, 0.3);
      this.localState.angle = Utils.lerpAngle(this.localState.angle, serverState.angle, 0.3);
      this.localState.speed = Utils.lerp(this.localState.speed, serverState.speed, 0.5);

      // Always trust server for these
      this.localState.lap = serverState.lap;
      this.localState.position = serverState.position;
      this.localState.powerup = serverState.powerup;
      this.localState.shieldTimer = serverState.shieldTimer;
      this.localState.spinTimer = serverState.spinTimer;
      this.localState.boostTimer = serverState.boostTimer;
      this.localState.drifting = serverState.drifting;
      this.localState.driftTier = serverState.driftTier;
      this.localState.driftDirection = serverState.driftDirection;
      this.localState.finished = serverState.finished;
    }
  }
}

window.ClientPhysics = ClientPhysics;
