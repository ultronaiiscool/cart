// Client-side power-up visuals
class PowerUpVisuals {
  constructor(scene) {
    this.scene = scene;
    this.itemBoxes = new Map(); // id -> mesh
    this.traps = new Map(); // id -> mesh
    this.animations = [];

    // Shared materials
    this.boxMat = new THREE.MeshLambertMaterial({ color: 0xffcc00 });
    this.boxFrameMat = new THREE.MeshBasicMaterial({
      color: 0xff8800,
      wireframe: true,
    });
    this.trapMat = new THREE.MeshLambertMaterial({ color: 0x22aa22 });
  }

  // Create item boxes from server data
  createItemBoxes(boxes) {
    for (const box of boxes) {
      this.createItemBox(box);
    }
  }

  createItemBox(box) {
    const group = new THREE.Group();

    // Inner cube
    const inner = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      this.boxMat
    );
    group.add(inner);

    // Wireframe outer
    const outer = new THREE.Mesh(
      new THREE.BoxGeometry(1.3, 1.3, 1.3),
      this.boxFrameMat
    );
    group.add(outer);

    // Question mark (simple box shape)
    const qMark = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.5, 0.05),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    qMark.position.set(0, 0, 0.55);
    group.add(qMark);

    group.position.set(box.x, 1.5, box.z);
    group.userData = { boxId: box.id, startY: 1.5 };
    this.scene.add(group);
    this.itemBoxes.set(box.id, group);
  }

  // Hide collected box
  hideBox(boxId) {
    const mesh = this.itemBoxes.get(boxId);
    if (mesh) mesh.visible = false;
  }

  // Show respawned box
  showBox(boxId) {
    const mesh = this.itemBoxes.get(boxId);
    if (mesh) mesh.visible = true;
  }

  // Place a trap on the track
  placeTrap(trap) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.6, 8, 6),
      this.trapMat
    );

    // Add spikes
    for (let i = 0; i < 6; i++) {
      const spike = new THREE.Mesh(
        new THREE.ConeGeometry(0.15, 0.4, 4),
        this.trapMat
      );
      const angle = (i / 6) * Math.PI * 2;
      spike.position.set(Math.cos(angle) * 0.5, 0, Math.sin(angle) * 0.5);
      spike.lookAt(0, 0, 0);
      spike.rotateX(Math.PI / 2);
      mesh.add(spike);
    }

    mesh.position.set(trap.x, 0.5, trap.z);
    this.scene.add(mesh);
    this.traps.set(trap.id, mesh);
  }

  // Remove trap
  removeTrap(trapId) {
    const mesh = this.traps.get(trapId);
    if (mesh) {
      this.scene.remove(mesh);
      this.traps.delete(trapId);
    }
  }

  // Animate item boxes (float + rotate)
  update(time) {
    for (const [, box] of this.itemBoxes) {
      if (!box.visible) continue;
      box.rotation.y = time * 0.002;
      box.position.y = box.userData.startY + Math.sin(time * 0.003) * 0.3;
    }

    // Traps pulse
    for (const [, trap] of this.traps) {
      trap.scale.setScalar(1 + Math.sin(time * 0.005) * 0.05);
    }
  }

  dispose() {
    for (const [, mesh] of this.itemBoxes) {
      this.scene.remove(mesh);
    }
    for (const [, mesh] of this.traps) {
      this.scene.remove(mesh);
    }
  }
}

window.PowerUpVisuals = PowerUpVisuals;
