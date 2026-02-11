// Rider system - 5 distinct low-poly riders with animations
// Each rider is procedurally generated geometry (≤1500 triangles)
class RiderSystem {
  constructor() {
    this.riderMeshes = new Map(); // Cache generated rider meshes
    this.sharedAtlasMaterial = null;
    this._initSharedMaterial();
  }

  _initSharedMaterial() {
    // Create a simple texture atlas (4x4 color blocks)
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    // Fill with rider color regions
    const colors = [
      '#ff4444', '#ffffff', '#333333', '#ffaa44', // Row 1
      '#4488ff', '#aaccff', '#226699', '#88bbff', // Row 2
      '#44cc44', '#ffcc44', '#886622', '#aaddaa', // Row 3
      '#aa88ff', '#ddccff', '#6644aa', '#ff8844', // Row 4
    ];

    for (let i = 0; i < 16; i++) {
      const x = (i % 4) * 16;
      const y = Math.floor(i / 4) * 16;
      ctx.fillStyle = colors[i];
      ctx.fillRect(x, y, 16, 16);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;

    this.sharedAtlasMaterial = new THREE.MeshLambertMaterial({
      map: texture,
      flatShading: false,
    });
  }

  // Create a rider mesh
  createRider(riderType, colors) {
    const cacheKey = riderType;
    if (this.riderMeshes.has(cacheKey)) {
      return this.riderMeshes.get(cacheKey).clone();
    }

    let group;
    switch (riderType) {
      case 'helmet': group = this._buildHelmetRider(colors); break;
      case 'robot': group = this._buildRobotRider(colors); break;
      case 'animal': group = this._buildAnimalRider(colors); break;
      case 'humanoid': group = this._buildHumanoidRider(colors); break;
      case 'ghost': group = this._buildGhostRider(colors); break;
      default: group = this._buildHumanoidRider(colors); break;
    }

    this.riderMeshes.set(cacheKey, group);
    return group.clone();
  }

  // Helmet rider - round helmet with visor
  _buildHelmetRider(colors) {
    const group = new THREE.Group();
    const primary = new THREE.MeshLambertMaterial({ color: colors.primary });
    const secondary = new THREE.MeshLambertMaterial({ color: colors.secondary });
    const accent = new THREE.MeshLambertMaterial({ color: colors.accent });

    // Body - cylinder
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.4, 0.35, 0.8, 8),
      secondary
    );
    body.position.y = 0.9;
    group.add(body);

    // Helmet - sphere
    const helmet = new THREE.Mesh(
      new THREE.SphereGeometry(0.45, 10, 8),
      primary
    );
    helmet.position.y = 1.65;
    helmet.scale.set(1, 0.9, 1.05);
    group.add(helmet);

    // Visor - flattened box
    const visor = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.2, 0.15),
      accent
    );
    visor.position.set(0, 1.6, 0.35);
    group.add(visor);

    // Arms
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.1, 0.6, 6),
        secondary
      );
      arm.position.set(side * 0.5, 1.0, 0.2);
      arm.rotation.x = -0.5;
      arm.rotation.z = side * 0.3;
      arm.name = side === -1 ? 'armL' : 'armR';
      group.add(arm);
    }

    group.name = 'rider_helmet';
    return group;
  }

  // Robot rider - boxy with antenna
  _buildRobotRider(colors) {
    const group = new THREE.Group();
    const primary = new THREE.MeshLambertMaterial({ color: colors.primary });
    const secondary = new THREE.MeshLambertMaterial({ color: colors.secondary });
    const accent = new THREE.MeshLambertMaterial({ color: colors.accent });

    // Body - box
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.7, 0.5),
      primary
    );
    body.position.y = 0.95;
    group.add(body);

    // Head - box
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.5, 0.5),
      primary
    );
    head.position.y = 1.6;
    group.add(head);

    // Eyes - small spheres
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(
        new THREE.SphereGeometry(0.08, 6, 4),
        new THREE.MeshBasicMaterial({ color: 0xff0000 })
      );
      eye.position.set(side * 0.15, 1.65, 0.26);
      group.add(eye);
    }

    // Antenna
    const antenna = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 0.3, 4),
      accent
    );
    antenna.position.set(0, 2.0, 0);
    group.add(antenna);

    const antennaTip = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 6, 4),
      new THREE.MeshBasicMaterial({ color: 0x44ff44 })
    );
    antennaTip.position.set(0, 2.2, 0);
    group.add(antennaTip);

    // Arms - boxes
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(
        new THREE.BoxGeometry(0.15, 0.5, 0.15),
        secondary
      );
      arm.position.set(side * 0.5, 1.0, 0.15);
      arm.rotation.x = -0.4;
      arm.name = side === -1 ? 'armL' : 'armR';
      group.add(arm);
    }

    group.name = 'rider_robot';
    return group;
  }

  // Animal rider - cat-like with ears
  _buildAnimalRider(colors) {
    const group = new THREE.Group();
    const primary = new THREE.MeshLambertMaterial({ color: colors.primary });
    const secondary = new THREE.MeshLambertMaterial({ color: colors.secondary });
    const accent = new THREE.MeshLambertMaterial({ color: colors.accent });

    // Body - rounded
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.4, 0.7, 8),
      primary
    );
    body.position.y = 0.9;
    group.add(body);

    // Head - sphere
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.4, 8, 6),
      primary
    );
    head.position.y = 1.55;
    group.add(head);

    // Ears - cones
    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(
        new THREE.ConeGeometry(0.12, 0.3, 4),
        secondary
      );
      ear.position.set(side * 0.25, 1.95, -0.05);
      ear.rotation.z = side * 0.2;
      group.add(ear);
    }

    // Snout - small sphere
    const snout = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 6, 4),
      secondary
    );
    snout.position.set(0, 1.45, 0.35);
    group.add(snout);

    // Nose
    const nose = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 4, 3),
      accent
    );
    nose.position.set(0, 1.48, 0.45);
    group.add(nose);

    // Eyes
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 6, 4),
        new THREE.MeshBasicMaterial({ color: 0x111111 })
      );
      eye.position.set(side * 0.15, 1.6, 0.3);
      group.add(eye);
    }

    // Arms
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.08, 0.5, 6),
        primary
      );
      arm.position.set(side * 0.45, 1.0, 0.15);
      arm.rotation.x = -0.5;
      arm.rotation.z = side * 0.2;
      arm.name = side === -1 ? 'armL' : 'armR';
      group.add(arm);
    }

    // Tail
    const tail = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.04, 0.5, 6),
      primary
    );
    tail.position.set(0, 0.85, -0.4);
    tail.rotation.x = 0.8;
    tail.name = 'tail';
    group.add(tail);

    group.name = 'rider_animal';
    return group;
  }

  // Minimal humanoid - simple figure
  _buildHumanoidRider(colors) {
    const group = new THREE.Group();
    const primary = new THREE.MeshLambertMaterial({ color: colors.primary });
    const secondary = new THREE.MeshLambertMaterial({ color: colors.secondary });
    const accent = new THREE.MeshLambertMaterial({ color: colors.accent });

    // Body - tapered cylinder
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.35, 0.7, 8),
      primary
    );
    body.position.y = 0.95;
    group.add(body);

    // Head - sphere
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 8, 6),
      secondary
    );
    head.position.y = 1.6;
    group.add(head);

    // Cap
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.32, 0.15, 8),
      accent
    );
    cap.position.y = 1.85;
    group.add(cap);

    // Cap brim
    const brim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.35, 0.04, 8),
      accent
    );
    brim.position.set(0, 1.78, 0.1);
    brim.rotation.x = -0.15;
    group.add(brim);

    // Eyes
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(
        new THREE.SphereGeometry(0.05, 6, 4),
        new THREE.MeshBasicMaterial({ color: 0x111111 })
      );
      eye.position.set(side * 0.12, 1.6, 0.25);
      group.add(eye);
    }

    // Arms
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, 0.55, 6),
        primary
      );
      arm.position.set(side * 0.42, 1.0, 0.15);
      arm.rotation.x = -0.5;
      arm.rotation.z = side * 0.25;
      arm.name = side === -1 ? 'armL' : 'armR';
      group.add(arm);
    }

    group.name = 'rider_humanoid';
    return group;
  }

  // Ghost rider - translucent floating form
  _buildGhostRider(colors) {
    const group = new THREE.Group();
    const primary = new THREE.MeshLambertMaterial({
      color: colors.primary,
      transparent: true,
      opacity: 0.75,
    });
    const secondary = new THREE.MeshLambertMaterial({
      color: colors.secondary,
      transparent: true,
      opacity: 0.7,
    });

    // Body - tapered shape
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.5, 0.9, 8),
      primary
    );
    body.position.y = 0.85;
    group.add(body);

    // Head - sphere
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.38, 8, 6),
      primary
    );
    head.position.y = 1.6;
    group.add(head);

    // Eyes - glowing
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(
        new THREE.SphereGeometry(0.1, 6, 4),
        new THREE.MeshBasicMaterial({ color: 0xffff88 })
      );
      eye.position.set(side * 0.15, 1.6, 0.28);
      group.add(eye);
    }

    // Wispy trails
    for (let i = 0; i < 3; i++) {
      const wisp = new THREE.Mesh(
        new THREE.ConeGeometry(0.08, 0.4, 4),
        secondary
      );
      wisp.position.set(
        (Math.random() - 0.5) * 0.4,
        0.3 + i * 0.1,
        -0.2 + Math.random() * 0.1
      );
      wisp.rotation.x = Math.PI;
      wisp.name = `wisp_${i}`;
      group.add(wisp);
    }

    // Arms - wispy
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.1, 0.5, 6),
        secondary
      );
      arm.position.set(side * 0.4, 1.0, 0.15);
      arm.rotation.x = -0.4;
      arm.rotation.z = side * 0.3;
      arm.name = side === -1 ? 'armL' : 'armR';
      group.add(arm);
    }

    group.name = 'rider_ghost';
    return group;
  }

  // Animate rider based on kart state
  animateRider(riderGroup, state, time) {
    if (!riderGroup) return;

    const steer = state.steerAngle || 0;
    const speed = state.speed || 0;
    const drifting = state.drifting || false;

    // Lean on steer
    riderGroup.rotation.z = -steer * 0.3;
    riderGroup.rotation.x = Math.min(speed * 0.003, 0.15); // Lean forward at speed

    // Arm animation
    riderGroup.traverse((child) => {
      if (child.name === 'armL') {
        child.rotation.x = -0.5 + steer * 0.4;
        child.rotation.z = -0.25 + Math.sin(time * 0.003) * 0.05;
      }
      if (child.name === 'armR') {
        child.rotation.x = -0.5 - steer * 0.4;
        child.rotation.z = 0.25 + Math.sin(time * 0.003 + 1) * 0.05;
      }
      // Ghost wisps float
      if (child.name && child.name.startsWith('wisp_')) {
        child.rotation.z = Math.sin(time * 0.005 + parseInt(child.name.split('_')[1])) * 0.3;
      }
      // Animal tail wag
      if (child.name === 'tail') {
        child.rotation.z = Math.sin(time * 0.008) * 0.4;
      }
    });

    // Drift: extra body lean
    if (drifting) {
      riderGroup.rotation.z += state.driftDirection * 0.15;
    }

    // Idle bob
    riderGroup.position.y = Math.sin(time * 0.004) * 0.03;
  }
}

window.RiderSystem = RiderSystem;
