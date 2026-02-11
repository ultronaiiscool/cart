// Three.js renderer setup - WebGL 1 compatible, low-poly stylized
class Renderer {
  constructor() {
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.trackGroup = null;
    this.kartGroup = null;
    this.effectsGroup = null;
    this.skybox = null;
  }

  init() {
    // Scene
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x88bbdd, 60, 200);

    // Camera
    this.camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.5, 300);
    this.camera.position.set(0, 8, -12);

    // Renderer - WebGL 1 compatible
    this.renderer = new THREE.WebGLRenderer({
      antialias: false,
      powerPreference: 'low-power',
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setClearColor(0x88bbdd);
    this.renderer.sortObjects = true;
    document.getElementById('game-canvas').appendChild(this.renderer.domElement);

    // Groups
    this.trackGroup = new THREE.Group();
    this.kartGroup = new THREE.Group();
    this.effectsGroup = new THREE.Group();
    this.scene.add(this.trackGroup);
    this.scene.add(this.kartGroup);
    this.scene.add(this.effectsGroup);

    // Skybox
    this._createSkybox();

    // Ground
    this._createGround();

    // Resize handler
    window.addEventListener('resize', () => this._onResize());
  }

  _createSkybox() {
    // Gradient sky dome
    const skyGeo = new THREE.SphereGeometry(250, 16, 12);
    const skyColors = [];
    const positions = skyGeo.attributes.position;

    for (let i = 0; i < positions.count; i++) {
      const y = positions.getY(i);
      const ratio = (y + 250) / 500;
      const topColor = new THREE.Color(0x4488cc);
      const bottomColor = new THREE.Color(0xccddee);
      const color = new THREE.Color().lerpColors(bottomColor, topColor, ratio);
      skyColors.push(color.r, color.g, color.b);
    }

    skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(skyColors, 3));
    const skyMat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      side: THREE.BackSide,
    });
    this.skybox = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(this.skybox);
  }

  _createGround() {
    // Large ground plane
    const groundGeo = new THREE.PlaneGeometry(400, 400, 1, 1);
    const groundMat = new THREE.MeshLambertMaterial({ color: 0x66aa44 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    this.scene.add(ground);
  }

  // Build the track mesh from control points
  buildTrack(trackData) {
    // Clear existing
    while (this.trackGroup.children.length > 0) {
      this.trackGroup.remove(this.trackGroup.children[0]);
    }

    const controlPoints = trackData.controlPoints;
    const width = trackData.width;

    // Generate track surface from spline
    const segments = 120;
    const trackVertices = [];
    const trackIndices = [];
    const trackColors = [];

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const pt = Utils.getSplinePoint(controlPoints, t);
      const tan = Utils.getSplineTangent(controlPoints, t);
      const normal = { x: -tan.z, z: tan.x };

      // Left and right edges
      const lx = pt.x + normal.x * width / 2;
      const lz = pt.z + normal.z * width / 2;
      const rx = pt.x - normal.x * width / 2;
      const rz = pt.z - normal.z * width / 2;

      trackVertices.push(lx, 0.01, lz);
      trackVertices.push(rx, 0.01, rz);

      // Track colors - darker in center, lighter at edges
      const mainColor = new THREE.Color(0x555566);
      const edgeColor = new THREE.Color(0x666677);
      trackColors.push(edgeColor.r, edgeColor.g, edgeColor.b);
      trackColors.push(edgeColor.r, edgeColor.g, edgeColor.b);
    }

    // Build indices
    for (let i = 0; i < segments; i++) {
      const idx = i * 2;
      trackIndices.push(idx, idx + 1, idx + 2);
      trackIndices.push(idx + 1, idx + 3, idx + 2);
    }

    const trackGeo = new THREE.BufferGeometry();
    trackGeo.setAttribute('position', new THREE.Float32BufferAttribute(trackVertices, 3));
    trackGeo.setAttribute('color', new THREE.Float32BufferAttribute(trackColors, 3));
    trackGeo.setIndex(trackIndices);
    trackGeo.computeVertexNormals();

    const trackMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    const trackMesh = new THREE.Mesh(trackGeo, trackMat);
    this.trackGroup.add(trackMesh);

    // Track edges (curbs)
    this._buildCurbs(controlPoints, width, segments);

    // Decorations
    this._buildDecorations(controlPoints, width);

    // Start/finish line
    this._buildStartLine(controlPoints, width);
  }

  _buildCurbs(controlPoints, width, segments) {
    const curbWidth = 1.2;

    for (const side of [-1, 1]) {
      const curbVerts = [];
      const curbCols = [];
      const curbIdx = [];

      for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const pt = Utils.getSplinePoint(controlPoints, t);
        const tan = Utils.getSplineTangent(controlPoints, t);
        const normal = { x: -tan.z, z: tan.x };

        const innerOffset = width / 2 * side;
        const outerOffset = (width / 2 + curbWidth) * side;

        const ix = pt.x + normal.x * innerOffset;
        const iz = pt.z + normal.z * innerOffset;
        const ox = pt.x + normal.x * outerOffset;
        const oz = pt.z + normal.z * outerOffset;

        curbVerts.push(ix, 0.02, iz);
        curbVerts.push(ox, 0.02, oz);

        // Alternating red/white curb pattern
        const stripeIdx = Math.floor(i / 3) % 2;
        const col = stripeIdx === 0 ? new THREE.Color(0xcc2222) : new THREE.Color(0xeeeeee);
        curbCols.push(col.r, col.g, col.b);
        curbCols.push(col.r, col.g, col.b);
      }

      for (let i = 0; i < segments; i++) {
        const idx = i * 2;
        curbIdx.push(idx, idx + 1, idx + 2);
        curbIdx.push(idx + 1, idx + 3, idx + 2);
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(curbVerts, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(curbCols, 3));
      geo.setIndex(curbIdx);
      geo.computeVertexNormals();

      const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
      this.trackGroup.add(new THREE.Mesh(geo, mat));
    }
  }

  _buildDecorations(controlPoints, width) {
    // Trees along track edges
    const treeMat = new THREE.MeshLambertMaterial({ color: 0x338833 });
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x664422 });
    const treeGeo = new THREE.ConeGeometry(2, 5, 6);
    const trunkGeo = new THREE.CylinderGeometry(0.3, 0.5, 2, 6);

    for (let i = 0; i < 40; i++) {
      const t = i / 40;
      const pt = Utils.getSplinePoint(controlPoints, t);
      const tan = Utils.getSplineTangent(controlPoints, t);
      const normal = { x: -tan.z, z: tan.x };

      for (const side of [-1, 1]) {
        if (Math.random() > 0.6) continue;

        const offset = (width / 2 + 5 + Math.random() * 8) * side;
        const x = pt.x + normal.x * offset;
        const z = pt.z + normal.z * offset;

        // Tree crown
        const crown = new THREE.Mesh(treeGeo, treeMat);
        crown.position.set(x, 4.5, z);
        crown.scale.set(0.7 + Math.random() * 0.6, 0.8 + Math.random() * 0.4, 0.7 + Math.random() * 0.6);
        this.trackGroup.add(crown);

        // Trunk
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.set(x, 1, z);
        this.trackGroup.add(trunk);
      }
    }
  }

  _buildStartLine(controlPoints, width) {
    const pt = Utils.getSplinePoint(controlPoints, 0);
    const tan = Utils.getSplineTangent(controlPoints, 0);
    const normal = { x: -tan.z, z: tan.x };

    // Checkered pattern start line
    const lineGeo = new THREE.PlaneGeometry(width, 2, 8, 1);
    const lineColors = [];
    const positions = lineGeo.attributes.position;

    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const checkerX = Math.floor((x + width / 2) / (width / 8));
      const isBlack = checkerX % 2 === 0;
      const col = isBlack ? 0.1 : 0.95;
      lineColors.push(col, col, col);
    }

    lineGeo.setAttribute('color', new THREE.Float32BufferAttribute(lineColors, 3));
    const lineMat = new THREE.MeshBasicMaterial({ vertexColors: true });
    const line = new THREE.Mesh(lineGeo, lineMat);
    line.rotation.x = -Math.PI / 2;
    line.position.set(pt.x, 0.03, pt.z);
    line.rotation.y = -Math.atan2(tan.x, tan.z);
    // Rotate around Y to align with track direction
    this.trackGroup.add(line);
  }

  // Update camera to follow a kart
  updateCamera(target, dt) {
    if (!target) return;

    const idealOffset = new THREE.Vector3(
      -Math.sin(target.angle) * 14,
      7,
      -Math.cos(target.angle) * 14
    );

    const idealLook = new THREE.Vector3(
      target.x + Math.sin(target.angle) * 6,
      1,
      target.z + Math.cos(target.angle) * 6
    );

    const targetPos = new THREE.Vector3(
      target.x + idealOffset.x,
      idealOffset.y,
      target.z + idealOffset.z
    );

    // Smooth follow
    const smoothSpeed = target.speed > 30 ? 3 : 4;
    this.camera.position.lerp(targetPos, smoothSpeed * dt);
    const currentLook = new THREE.Vector3();
    this.camera.getWorldDirection(currentLook);
    this.camera.lookAt(idealLook);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  _onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  dispose() {
    this.renderer.dispose();
  }
}

window.Renderer = Renderer;
