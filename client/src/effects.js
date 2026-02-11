// Visual effects - blob shadows, particles, boost trails
class Effects {
  constructor(scene) {
    this.scene = scene;
    this.shadows = new Map();
    this.particles = [];
    this.particlePool = [];
    this.maxParticles = 200;
    this.boostTrails = new Map();

    // Shared materials
    this.shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.25,
      depthWrite: false,
    });
    this.shadowGeo = new THREE.CircleGeometry(1.2, 8);
    this.shadowGeo.rotateX(-Math.PI / 2);

    // Particle material
    this.particleMat = new THREE.MeshBasicMaterial({
      transparent: true,
      depthWrite: false,
    });
  }

  // Create blob shadow for a kart
  createShadow(kartId) {
    const shadow = new THREE.Mesh(this.shadowGeo, this.shadowMat);
    shadow.renderOrder = -1;
    this.scene.add(shadow);
    this.shadows.set(kartId, shadow);
    return shadow;
  }

  // Update shadow position
  updateShadow(kartId, x, z) {
    const shadow = this.shadows.get(kartId);
    if (shadow) {
      shadow.position.set(x, 0.05, z);
    }
  }

  // Spawn drift sparks
  spawnDriftSparks(x, z, driftTier, driftDirection) {
    const count = driftTier >= 2 ? 3 : 1;
    const colors = [0xffaa00, 0xff6600, 0xff2200];
    const color = colors[Math.min(driftTier - 1, 2)];

    for (let i = 0; i < count; i++) {
      this._spawnParticle(
        x + (Math.random() - 0.5) * 1.5,
        0.2 + Math.random() * 0.5,
        z + (Math.random() - 0.5) * 1.5,
        (Math.random() - 0.5) * 2,
        1 + Math.random() * 2,
        (Math.random() - 0.5) * 2,
        color,
        0.3 + Math.random() * 0.2,
        0.15 + Math.random() * 0.1
      );
    }
  }

  // Spawn boost flame
  spawnBoostFlame(x, z, angle) {
    for (let i = 0; i < 2; i++) {
      const ox = -Math.sin(angle) * 1.5 + (Math.random() - 0.5) * 0.5;
      const oz = -Math.cos(angle) * 1.5 + (Math.random() - 0.5) * 0.5;
      this._spawnParticle(
        x + ox, 0.4 + Math.random() * 0.3, z + oz,
        -Math.sin(angle) * 3, 0.5, -Math.cos(angle) * 3,
        Math.random() > 0.5 ? 0xff4400 : 0xffaa00,
        0.2 + Math.random() * 0.15,
        0.2 + Math.random() * 0.1
      );
    }
  }

  // Spawn hit explosion
  spawnExplosion(x, z) {
    for (let i = 0; i < 15; i++) {
      this._spawnParticle(
        x, 0.5 + Math.random() * 1.5, z,
        (Math.random() - 0.5) * 8,
        2 + Math.random() * 4,
        (Math.random() - 0.5) * 8,
        [0xff4400, 0xff8800, 0xffcc00][Math.floor(Math.random() * 3)],
        0.2 + Math.random() * 0.3,
        0.4 + Math.random() * 0.3
      );
    }
  }

  // Spawn shield effect
  createShieldEffect(kartMesh) {
    const shieldGeo = new THREE.SphereGeometry(2, 8, 6);
    const shieldMat = new THREE.MeshBasicMaterial({
      color: 0x44aaff,
      transparent: true,
      opacity: 0.25,
      wireframe: true,
    });
    const shield = new THREE.Mesh(shieldGeo, shieldMat);
    shield.name = 'shield';
    kartMesh.add(shield);
    return shield;
  }

  // Spawn item box collect sparkle
  spawnCollectSparkle(x, z) {
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      this._spawnParticle(
        x + Math.cos(angle) * 1.5,
        1 + Math.random(),
        z + Math.sin(angle) * 1.5,
        Math.cos(angle) * 3,
        2 + Math.random() * 2,
        Math.sin(angle) * 3,
        0xffff44,
        0.15,
        0.3
      );
    }
  }

  _spawnParticle(x, y, z, vx, vy, vz, color, size, lifetime) {
    let particle;

    if (this.particlePool.length > 0) {
      particle = this.particlePool.pop();
      particle.mesh.visible = true;
      particle.mesh.material.color.setHex(color);
    } else if (this.particles.length < this.maxParticles) {
      const geo = new THREE.SphereGeometry(1, 4, 3);
      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      this.scene.add(mesh);
      particle = { mesh, mat };
    } else {
      return; // Pool exhausted
    }

    particle.x = x;
    particle.y = y;
    particle.z = z;
    particle.vx = vx;
    particle.vy = vy;
    particle.vz = vz;
    particle.life = lifetime;
    particle.maxLife = lifetime;
    particle.size = size;

    particle.mesh.position.set(x, y, z);
    particle.mesh.scale.setScalar(size);
    particle.mesh.material.opacity = 1;

    this.particles.push(particle);
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;

      if (p.life <= 0) {
        p.mesh.visible = false;
        this.particlePool.push(p);
        this.particles.splice(i, 1);
        continue;
      }

      // Physics
      p.vy -= 5 * dt; // Gravity
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;

      // Fade out
      const lifeRatio = p.life / p.maxLife;
      p.mesh.material.opacity = lifeRatio;
      p.mesh.scale.setScalar(p.size * (0.5 + lifeRatio * 0.5));

      p.mesh.position.set(p.x, Math.max(0, p.y), p.z);
    }
  }

  removeShadow(kartId) {
    const shadow = this.shadows.get(kartId);
    if (shadow) {
      this.scene.remove(shadow);
      this.shadows.delete(kartId);
    }
  }

  dispose() {
    for (const p of this.particles) {
      this.scene.remove(p.mesh);
    }
    for (const p of this.particlePool) {
      this.scene.remove(p.mesh);
    }
    for (const [, shadow] of this.shadows) {
      this.scene.remove(shadow);
    }
  }
}

window.Effects = Effects;
