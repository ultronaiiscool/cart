// Lighting setup - one directional sun + hemisphere ambient
class Lighting {
  constructor(scene) {
    this.scene = scene;
    this.sunLight = null;
    this.ambientLight = null;
  }

  init() {
    // Directional sun light - warm tone
    this.sunLight = new THREE.DirectionalLight(0xffeedd, 1.0);
    this.sunLight.position.set(50, 80, 30);
    this.scene.add(this.sunLight);

    // Hemisphere light - sky/ground ambient
    this.ambientLight = new THREE.HemisphereLight(0x88bbdd, 0x446633, 0.6);
    this.scene.add(this.ambientLight);
  }

  // Optional: animate sun position slightly for mood
  update(time) {
    // Gentle sway for visual interest
    const sway = Math.sin(time * 0.0001) * 0.05;
    this.sunLight.position.x = 50 + sway * 10;
  }
}

window.Lighting = Lighting;
