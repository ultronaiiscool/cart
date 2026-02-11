// Client-side kart mesh and management
class KartManager {
  constructor(scene, riderSystem, effects) {
    this.scene = scene;
    this.riderSystem = riderSystem;
    this.effects = effects;
    this.karts = new Map(); // id -> { mesh, rider, state, prevState }
    this.localPlayerId = null;

    // Shared geometries for kart body
    this.bodyGeo = this._createKartBodyGeometry();
    this.wheelGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.15, 8);
    this.wheelGeo.rotateZ(Math.PI / 2);
  }

  _createKartBodyGeometry() {
    // Low-poly kart body shape
    const shape = new THREE.Shape();
    // Top view: rounded rectangle
    shape.moveTo(-0.6, -1.0);
    shape.lineTo(0.6, -1.0);
    shape.lineTo(0.7, -0.5);
    shape.lineTo(0.7, 0.8);
    shape.lineTo(0.5, 1.1);
    shape.lineTo(-0.5, 1.1);
    shape.lineTo(-0.7, 0.8);
    shape.lineTo(-0.7, -0.5);
    shape.closePath();

    const extrudeSettings = {
      steps: 1,
      depth: 0.4,
      bevelEnabled: true,
      bevelThickness: 0.1,
      bevelSize: 0.05,
      bevelSegments: 1,
    };

    const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, 0.2, 0);
    return geo;
  }

  // Create a kart with rider
  createKart(id, riderType, kartColorIndex, isLocal) {
    const group = new THREE.Group();

    // Kart body
    const kartColor = CONSTANTS.KART_COLORS[kartColorIndex % CONSTANTS.KART_COLORS.length];
    const bodyMat = new THREE.MeshLambertMaterial({ color: kartColor });
    const body = new THREE.Mesh(this.bodyGeo, bodyMat);
    group.add(body);

    // Wheels
    const wheelMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
    const wheelPositions = [
      { x: -0.7, y: 0.25, z: 0.7 },
      { x: 0.7, y: 0.25, z: 0.7 },
      { x: -0.7, y: 0.25, z: -0.6 },
      { x: 0.7, y: 0.25, z: -0.6 },
    ];
    const wheels = [];
    for (const pos of wheelPositions) {
      const wheel = new THREE.Mesh(this.wheelGeo, wheelMat);
      wheel.position.set(pos.x, pos.y, pos.z);
      group.add(wheel);
      wheels.push(wheel);
    }

    // Rider
    const colors = CONSTANTS.RIDER_COLORS[riderType] || CONSTANTS.RIDER_COLORS.humanoid;
    const rider = this.riderSystem.createRider(riderType, colors);
    rider.position.set(0, 0.3, -0.1);
    rider.scale.setScalar(0.85);
    group.add(rider);

    // Engine block (decorative)
    const engineGeo = new THREE.BoxGeometry(0.5, 0.25, 0.3);
    const engineMat = new THREE.MeshLambertMaterial({ color: 0x444444 });
    const engine = new THREE.Mesh(engineGeo, engineMat);
    engine.position.set(0, 0.45, -0.8);
    group.add(engine);

    // Exhaust pipes
    for (const side of [-1, 1]) {
      const exhaust = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.07, 0.3, 6),
        new THREE.MeshLambertMaterial({ color: 0x666666 })
      );
      exhaust.position.set(side * 0.25, 0.35, -1.1);
      exhaust.rotation.x = 0.3;
      group.add(exhaust);
    }

    // Steering wheel (small)
    const steeringGeo = new THREE.TorusGeometry(0.12, 0.02, 4, 8);
    const steeringMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
    const steering = new THREE.Mesh(steeringGeo, steeringMat);
    steering.position.set(0, 0.7, 0.35);
    steering.rotation.x = -0.5;
    steering.name = 'steeringWheel';
    group.add(steering);

    this.scene.add(group);

    // Shadow
    this.effects.createShadow(id);

    const kartData = {
      mesh: group,
      rider,
      wheels,
      state: null,
      prevState: null,
      interpState: { x: 0, y: 0, z: 0, angle: 0, speed: 0, steerAngle: 0 },
      isLocal,
      riderType,
    };

    this.karts.set(id, kartData);

    if (isLocal) {
      this.localPlayerId = id;
    }

    return kartData;
  }

  // Update kart interpolation from server state
  updateFromServer(id, serverState) {
    const kart = this.karts.get(id);
    if (!kart) return;

    kart.prevState = kart.state ? { ...kart.state } : { ...serverState };
    kart.state = { ...serverState };
  }

  // Interpolate and render all karts
  render(interpFactor, time) {
    for (const [id, kart] of this.karts) {
      if (!kart.state) continue;

      const s = kart.state;
      const p = kart.prevState || s;

      // Interpolate position
      const ix = Utils.lerp(p.x, s.x, interpFactor);
      const iz = Utils.lerp(p.z, s.z, interpFactor);
      const iangle = Utils.lerpAngle(p.angle, s.angle, interpFactor);
      const ispeed = Utils.lerp(p.speed || 0, s.speed || 0, interpFactor);

      kart.mesh.position.set(ix, s.y || 0, iz);
      kart.mesh.rotation.y = iangle;

      // Update shadow
      this.effects.updateShadow(id, ix, iz);

      // Wheel spin
      const wheelSpin = ispeed * time * 0.0001;
      for (let i = 0; i < kart.wheels.length; i++) {
        kart.wheels[i].rotation.x = wheelSpin;
        // Front wheel steering
        if (i < 2) {
          kart.wheels[i].rotation.y = (s.steerAngle || 0) * 0.5;
        }
      }

      // Steering wheel
      kart.mesh.traverse(child => {
        if (child.name === 'steeringWheel') {
          child.rotation.z = -(s.steerAngle || 0) * 2;
        }
      });

      // Animate rider
      this.riderSystem.animateRider(kart.rider, s, time);

      // Shield effect
      const existingShield = kart.mesh.getObjectByName('shield');
      if (s.shieldTimer > 0 && !existingShield) {
        this.effects.createShieldEffect(kart.mesh);
      } else if (s.shieldTimer <= 0 && existingShield) {
        kart.mesh.remove(existingShield);
      }

      // Drift sparks
      if (s.drifting && s.driftTier >= 1) {
        if (Math.random() > 0.5) {
          this.effects.spawnDriftSparks(ix, iz, s.driftTier, s.driftDirection);
        }
      }

      // Boost flames
      if (s.boostTimer > 0) {
        this.effects.spawnBoostFlame(ix, iz, iangle);
      }
    }
  }

  // Get local player kart state for camera
  getLocalKart() {
    if (!this.localPlayerId) return null;
    const kart = this.karts.get(this.localPlayerId);
    if (!kart || !kart.state) return null;
    return {
      x: kart.mesh.position.x,
      y: kart.mesh.position.y,
      z: kart.mesh.position.z,
      angle: kart.state.angle,
      speed: kart.state.speed,
    };
  }

  removeKart(id) {
    const kart = this.karts.get(id);
    if (kart) {
      this.scene.remove(kart.mesh);
      this.effects.removeShadow(id);
      this.karts.delete(id);
    }
  }

  dispose() {
    for (const [id] of this.karts) {
      this.removeKart(id);
    }
  }
}

window.KartManager = KartManager;
