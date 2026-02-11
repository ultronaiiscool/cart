// Shared constants for kart racing game
// Used by both client and server

const CONSTANTS = {
  // Race settings
  MAX_RACERS: 8,
  MAX_HUMANS: 4,
  LAPS: 3,
  COUNTDOWN_SECONDS: 3,

  // Physics (fixed timestep)
  TICK_RATE: 60,
  TICK_DELTA: 1 / 60,
  PHYSICS_SUBSTEPS: 2,

  // Kart tuning
  KART: {
    MAX_SPEED: 45,
    ACCELERATION: 28,
    BRAKING: 40,
    REVERSE_MAX: 15,
    REVERSE_ACCEL: 12,
    DRAG: 0.98,
    STEER_SPEED: 2.8,
    STEER_RETURN: 4.0,
    MAX_STEER_ANGLE: Math.PI / 5,
    SPEED_STEER_FACTOR: 0.55, // Steering reduces at high speed
    OFF_TRACK_MULTIPLIER: 0.5,
    KART_RADIUS: 1.2,
    KART_LENGTH: 2.4,
    KART_WIDTH: 1.6,
    BOUNCE_FACTOR: 0.4,
    GRAVITY: -20,
    GROUND_Y: 0,
  },

  // Drift system
  DRIFT: {
    MIN_SPEED: 15,
    STEER_THRESHOLD: 0.3,
    CHARGE_RATE: 1.0,
    TIER1_TIME: 0.6,
    TIER2_TIME: 1.4,
    TIER3_TIME: 2.4,
    TIER1_BOOST: 1.3,
    TIER2_BOOST: 1.6,
    TIER3_BOOST: 2.0,
    BOOST_DURATION_1: 0.5,
    BOOST_DURATION_2: 0.8,
    BOOST_DURATION_3: 1.2,
    DRIFT_ANGLE: 0.35,
    DRIFT_STEER_MULT: 0.6,
  },

  // Power-ups
  POWERUP: {
    TYPES: ['speed_boost', 'shield', 'trap', 'spin', 'missile'],
    SPEED_BOOST_MULT: 1.5,
    SPEED_BOOST_DURATION: 2.0,
    SHIELD_DURATION: 5.0,
    SPIN_DURATION: 1.5,
    SPIN_SPEED_LOSS: 0.3,
    TRAP_RADIUS: 1.5,
    TRAP_LIFETIME: 15.0,
    ITEM_BOX_RESPAWN: 8.0,
  },

  // Missile
  MISSILE: {
    SPEED: 55,
    TURN_RATE: 2.5,
    LOCK_CONE: Math.PI / 3, // 60 degree cone
    LOCK_RANGE: 80,
    LIFETIME: 6.0,
    RADIUS: 0.6,
  },

  // AI
  AI: {
    WAYPOINT_REACH_DIST: 8,
    LOOKAHEAD: 2,
    DRIFT_ANGLE_THRESHOLD: 0.5,
    POWERUP_USE_DELAY: 1.5,
    RUBBER_BAND_STRENGTH: 0.15,
    RUBBER_BAND_RANGE: 30,
  },

  // Track
  TRACK: {
    WIDTH: 18,
    HALF_WIDTH: 9,
    CHECKPOINT_COUNT: 20,
  },

  // Network
  NET: {
    UPDATE_RATE: 20, // Server sends state 20 times/sec
    INTERPOLATION_DELAY: 100, // ms
    INPUT_BUFFER_SIZE: 32,
  },

  // Riders
  RIDERS: ['helmet', 'robot', 'animal', 'humanoid', 'ghost'],
  RIDER_COLORS: {
    helmet: { primary: 0xff4444, secondary: 0xffffff, accent: 0x333333 },
    robot: { primary: 0x4488ff, secondary: 0xaaccff, accent: 0x226699 },
    animal: { primary: 0x44cc44, secondary: 0xffcc44, accent: 0x886622 },
    humanoid: { primary: 0xff8844, secondary: 0xffddaa, accent: 0x884422 },
    ghost: { primary: 0xaa88ff, secondary: 0xddccff, accent: 0x6644aa },
  },

  // Kart colors (8 karts)
  KART_COLORS: [
    0xff3333, 0x3366ff, 0x33cc33, 0xffcc00,
    0xff66cc, 0x00cccc, 0xff8800, 0x9933ff,
  ],

  // Messages
  MSG: {
    // Client -> Server
    JOIN: 'join',
    SELECT_RIDER: 'select_rider',
    READY: 'ready',
    INPUT: 'input',

    // Server -> Client
    LOBBY_STATE: 'lobby_state',
    RACE_START: 'race_start',
    GAME_STATE: 'game_state',
    COUNTDOWN: 'countdown',
    POWERUP_SPAWN: 'powerup_spawn',
    POWERUP_COLLECT: 'powerup_collect',
    POWERUP_USE: 'powerup_use',
    MISSILE_SPAWN: 'missile_spawn',
    MISSILE_HIT: 'missile_hit',
    TRAP_PLACED: 'trap_placed',
    TRAP_HIT: 'trap_hit',
    PLAYER_HIT: 'player_hit',
    LAP_COMPLETE: 'lap_complete',
    RACE_FINISH: 'race_finish',
    RACE_RESULTS: 'race_results',
    PLAYER_LEFT: 'player_left',
    ERROR: 'error',
  },
};

// Export for both Node.js and browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONSTANTS;
} else if (typeof window !== 'undefined') {
  window.CONSTANTS = CONSTANTS;
}
