import { canvasFont, recordScore, theme, type CarnivalGame } from '../../carnival';

const { width: WIDTH, height: HEIGHT } = theme.canvas;

export const FRAMES = 5;
export const BALLS_PER_FRAME = 3;
export const PIN_COUNT = 10;
export const BALL_RADIUS = 16;
export const PIN_RADIUS = 10;
/** Pixels per second the ball rolls up the lane. */
export const BALL_SPEED = 600;
/** Pixels per second the ball slides along the foul line while you aim. */
export const AIM_SPEED = 220;
/** Seconds the pins stay as they fell before the next ball. */
export const PAUSE_SECONDS = 0.8;

export const LANE_CENTER = WIDTH / 2;
export const LANE_HALF_WIDTH = 100;
export const LANE_TOP = 50;
const GUTTER = 20;
const FOUL_LINE_Y = 410;
export const BALL_START_Y = 440;
const HEAD_PIN_Y = 190;
const PIN_SPACING = 36;
const ROW_SPACING = 32;
/** The furthest the ball can sit from the middle of the lane. */
export const AIM_LIMIT = LANE_HALF_WIDTH - BALL_RADIUS;

export interface Pin {
  x: number;
  y: number;
  standing: boolean;
}

export interface Ball {
  x: number;
  y: number;
}

export interface DuckpinState {
  pins: Pin[];
  /** The frame being bowled, from 0. */
  frame: number;
  /** The ball being bowled in this frame, from 0. */
  ball: number;
  /** Seconds spent aiming this ball; sets where the ball sits on the foul line. */
  aimTime: number;
  /** The ball rolling up the lane, or null while aiming or pausing. */
  rolling: Ball | null;
  /** Seconds left before the next ball, after a ball has rolled. */
  pause: number;
  /** Pins knocked down in each frame so far. */
  frameScores: number[];
  score: number;
  phase: 'aiming' | 'rolling' | 'over';
}

/** The ten pins in their triangle, head pin nearest the bowler. */
export function setPins(): Pin[] {
  const pins: Pin[] = [];
  for (let row = 0; row < 4; row++) {
    for (let i = 0; i <= row; i++) {
      pins.push({
        x: LANE_CENTER + (i - row / 2) * PIN_SPACING,
        y: HEAD_PIN_Y - row * ROW_SPACING,
        standing: true,
      });
    }
  }
  return pins;
}

export function createState(): DuckpinState {
  return {
    pins: setPins(),
    frame: 0,
    ball: 0,
    aimTime: 0,
    rolling: null,
    pause: 0,
    frameScores: [0],
    score: 0,
    phase: 'aiming',
  };
}

/**
 * Where the ball sits on the foul line after `aimTime` seconds of aiming. It
 * starts in the middle and slides from side to side.
 */
export function aimX(aimTime: number): number {
  const span = AIM_LIMIT * 4;
  // A triangle wave that starts at the middle heading right.
  const t = (((aimTime * AIM_SPEED + AIM_LIMIT) % span) + span) % span;
  const offset = t < span / 2 ? t - AIM_LIMIT : AIM_LIMIT * 3 - t;
  return LANE_CENTER + offset;
}

/** True if a ball rolling straight up the lane at `x` hits this pin. */
export function hits(pin: Pin, x: number): boolean {
  return Math.abs(pin.x - x) <= BALL_RADIUS + PIN_RADIUS;
}

export function pinsStanding(state: DuckpinState): number {
  return state.pins.filter((pin) => pin.standing).length;
}

/** Rolls the ball from where it sits. Returns false if a ball can't be rolled now. */
export function roll(state: DuckpinState): boolean {
  if (state.phase !== 'aiming') return false;
  state.rolling = { x: aimX(state.aimTime), y: BALL_START_Y };
  state.phase = 'rolling';
  return true;
}

/** Moves on to the next ball, or the next frame once the pins are cleared or the balls used up. */
function nextBall(state: DuckpinState): void {
  state.ball += 1;
  state.aimTime = 0;
  if (pinsStanding(state) === 0 || state.ball >= BALLS_PER_FRAME) {
    state.frame += 1;
    state.ball = 0;
    if (state.frame >= FRAMES) {
      state.phase = 'over';
      return;
    }
    state.pins = setPins();
    state.frameScores.push(0);
  }
  state.phase = 'aiming';
}

/** Advances the game by `dt` seconds. */
export function step(state: DuckpinState, dt: number): void {
  if (state.phase === 'aiming') {
    state.aimTime += dt;
    return;
  }
  if (state.phase !== 'rolling') return;

  if (state.rolling) {
    const ball = state.rolling;
    ball.y -= BALL_SPEED * dt;
    for (const pin of state.pins) {
      if (pin.standing && ball.y <= pin.y && hits(pin, ball.x)) {
        pin.standing = false;
        state.score += 1;
        state.frameScores[state.frame] += 1;
      }
    }
    const laneEnd = LANE_TOP - BALL_RADIUS;
    if (ball.y >= laneEnd) return;
    // The ball left the lane partway through this step: the rest of it counts
    // towards the pause.
    dt = (laneEnd - ball.y) / BALL_SPEED;
    state.rolling = null;
    state.pause = PAUSE_SECONDS;
  }

  state.pause -= dt;
  if (state.pause <= 0) {
    state.pause = 0;
    nextBall(state);
  }
}

function drawPin(ctx: CanvasRenderingContext2D, pin: Pin) {
  const { colors } = theme;
  if (pin.standing) {
    ctx.fillStyle = colors.accent;
    ctx.beginPath();
    ctx.arc(pin.x, pin.y, PIN_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = colors.stripeA;
    ctx.fillRect(pin.x - PIN_RADIUS * 0.7, pin.y - 2, PIN_RADIUS * 1.4, 4);
  } else {
    // A knocked-down pin lies on its side, faded.
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = colors.accent;
    ctx.beginPath();
    ctx.ellipse(pin.x, pin.y, PIN_RADIUS * 1.4, PIN_RADIUS * 0.6, Math.PI / 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function drawBall(ctx: CanvasRenderingContext2D, ball: Ball) {
  ctx.fillStyle = theme.colors.danger;
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, BALL_RADIUS, 0, Math.PI * 2);
  ctx.fill();
}

function draw(ctx: CanvasRenderingContext2D, state: DuckpinState) {
  const { colors } = theme;

  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Booth awning.
  const stripe = WIDTH / 16;
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = i % 2 === 0 ? colors.stripeA : colors.stripeB;
    ctx.fillRect(i * stripe, 0, stripe, 40);
  }

  // Gutters, lane and foul line.
  const left = LANE_CENTER - LANE_HALF_WIDTH;
  ctx.fillStyle = colors.surface;
  ctx.fillRect(left - GUTTER, LANE_TOP, LANE_HALF_WIDTH * 2 + GUTTER * 2, HEIGHT - LANE_TOP);
  ctx.fillStyle = colors.wood;
  ctx.fillRect(left, LANE_TOP, LANE_HALF_WIDTH * 2, HEIGHT - LANE_TOP);
  ctx.fillStyle = colors.danger;
  ctx.fillRect(left, FOUL_LINE_Y, LANE_HALF_WIDTH * 2, 3);

  for (const pin of state.pins) drawPin(ctx, pin);
  if (state.rolling) drawBall(ctx, state.rolling);
  if (state.phase === 'aiming') drawBall(ctx, { x: aimX(state.aimTime), y: BALL_START_Y });

  // Score card down the left.
  ctx.fillStyle = colors.text;
  ctx.font = canvasFont('body', 'bold');
  ctx.textAlign = 'left';
  ctx.fillText(`Score ${state.score}`, 24, 80);
  ctx.font = canvasFont('small');
  for (let i = 0; i < FRAMES; i++) {
    const current = i === state.frame && state.phase !== 'over';
    ctx.fillStyle = current ? colors.accent : colors.muted;
    const pins = state.frameScores[i];
    ctx.fillText(`Frame ${i + 1}: ${pins === undefined ? '-' : pins}`, 24, 116 + i * 26);
  }

  if (state.phase !== 'over') {
    ctx.fillStyle = colors.text;
    ctx.font = canvasFont('body', 'bold');
    ctx.textAlign = 'right';
    ctx.fillText(`Frame ${state.frame + 1}/${FRAMES}`, WIDTH - 24, 80);
    ctx.fillText(`Ball ${state.ball + 1}/${BALLS_PER_FRAME}`, WIDTH - 24, 110);
    ctx.font = canvasFont('small');
    ctx.fillStyle = colors.muted;
    ctx.fillText('Click to roll', WIDTH - 24, 140);
  }

  if (state.phase === 'over') {
    ctx.fillStyle = colors.background;
    ctx.globalAlpha = 0.8;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.fillStyle = colors.accent;
    ctx.font = canvasFont('title', 'bold');
    ctx.fillText(`Game over! You scored ${state.score}`, WIDTH / 2, HEIGHT / 2);
    ctx.fillStyle = colors.text;
    ctx.font = canvasFont('body');
    ctx.fillText('Click to play again', WIDTH / 2, HEIGHT / 2 + 40);
  }
}

export const duckpinBowling: CarnivalGame = {
  id: 'duckpin-bowling',
  name: 'Duckpin Bowling',
  description: 'Roll a small ball at ten yellow pins. Three balls a frame to knock them all down.',

  start(canvas) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not available');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;

    let state = createState();
    let scoreRecorded = false;

    const onDown = () => {
      if (state.phase === 'over') {
        state = createState();
        scoreRecorded = false;
        return;
      }
      roll(state);
    };
    canvas.addEventListener('pointerdown', onDown);

    let frame = 0;
    let last = performance.now();
    const loop = (time: number) => {
      // Cap the step so a background tab doesn't skip a ball.
      const dt = Math.min((time - last) / 1000, 0.05);
      last = time;
      step(state, dt);
      if (state.phase === 'over' && !scoreRecorded) {
        recordScore(duckpinBowling.id, state.score);
        scoreRecorded = true;
      }
      draw(ctx, state);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      canvas.removeEventListener('pointerdown', onDown);
    };
  },
};

export default duckpinBowling;
