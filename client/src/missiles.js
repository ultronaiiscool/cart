// Client-side missile visuals
class MissileVisuals {
  constructor(scene, effects) {
    this.scene = scene;
    this.effects = effects;
    this.missiles = new Map(); // id -> { mesh, state }

    // Shared geometry
    this.missileGeo = this._createMissileGeometry();
    this.missileMat = new THREE.MeshLambertMaterial({ color: 0xff2222 });
    this.flameMat = new THREE.MeshBasicMaterial({
      color: 0xff8800,
      transparent: true,
      opacity: 0.8,
    });
  }

  _createMissileGeometry() {
    // Simple rocket shape
    const group = new THREE.Group();

    // Body
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.2, 0.8, 6),
      this.missileMat
    );
    body.rotation.x = Math.PI / 2;
    group.add(body);

    // Nose cone
    const nose = new THREE.Mesh(
      new THREE.ConeGeometry(0.15, 0.3, 6),
      this.missileMat
    );
    nose.rotation.x = -Math.PI / 2;
    nose.position.z = 0.55;
    group.add(nose);

    // Fins
    for (let i = 0; i < 4; i++) {
      const fin = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 0.02, 0.2),
        this.missileMat
      );
      fin.position.z = -0.3;
      fin.rotation.z = (i / 4) * Math.PI * 2;
      group.add(fin);
    }

    return group;
  }

  // Spawn missile visual
  spawn(missileData) {
    const mesh = this._createMissileGeometry();
    mesh.position.set(missileData.x, 0.8, missileData.z);
    mesh.rotation.y = missileData.angle;
    this.scene.add(mesh);

    this.missiles.set(missileData.id, {
      mesh,
      state: { ...missileData },
      prevState: { ...missileData },
    });
  }

  // Update missile states from server
  updateFromServer(serverMissiles) {
    // Update existing
    const activeIds = new Set();
    for (const sm of serverMissiles) {
      activeIds.add(sm.id);
      const existing = this.missiles.get(sm.id);
      if (existing) {
        existing.prevState = { ...existing.state };
        existing.state = { ...sm };
      }
    }

    // Remove missiles no longer in server state
    for (const [id] of this.missiles) {
      if (!activeIds.has(id)) {
        this.remove(id);
      }
    }
  }

  // Render missiles with interpolation
  render(interpFactor, time) {
    for (const [id, missile] of this.missiles) {
      const s = missile.state;
      const p = missile.prevState || s;

      const x = Utils.lerp(p.x, s.x, interpFactor);
      const z = Utils.lerp(p.z, s.z, interpFactor);
      const angle = Utils.lerpAngle(p.angle, s.angle, interpFactor);

      missile.mesh.position.set(x, 0.8, z);
      missile.mesh.rotation.y = angle;

      // Trail effect
      if (Math.random() > 0.3) {
        this.effects.spawnBoostFlame(x, z, angle + Math.PI);
      }
    }
  }

  // Missile hit explosion
  explode(x, z) {
    this.effects.spawnExplosion(x, z);
  }

  // Remove missile
  remove(id) {
    const missile = this.missiles.get(id);
    if (missile) {
      this.scene.remove(missile.mesh);
      this.missiles.delete(id);
    }
  }

  dispose() {
    for (const [, missile] of this.missiles) {
      this.scene.remove(missile.mesh);
    }
    this.missiles.clear();
  }
}

window.MissileVisuals = MissileVisuals;
