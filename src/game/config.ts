/** Single source of truth for tunable rule values. No magic numbers elsewhere. */
export const GAME_CONFIG = {
  MIN_PLAYERS: 2,
  MAX_PLAYERS: 10,
  STARTING_HAND_SIZE: 7,
  MERCY_LIMIT: 25,
  UNO_REQUIRED_AT: 1,
  UNO_WINDOW_MS: 6000,
  UNO_PENALTY_CARDS: 2,
  TURN_SECONDS: 45,
  ALLOW_STACKING: true,
  ALLOW_SEVEN_SWAP: true,
  ALLOW_ZERO_ROTATION: true,
  ALLOW_COLOR_ROULETTE_STACKING: false,
  /** Optional Score Mode. */
  SCORE_TARGET: 1000,
  KNOCKOUT_BONUS: 250,
  /** Safety valve so a pathological deck can never hang the server. */
  MAX_REVEAL_ITERATIONS: 400,
} as const;

export type GameConfig = typeof GAME_CONFIG;
