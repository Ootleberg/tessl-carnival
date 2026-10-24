import { canvasFont, recordScore, theme, type CarnivalGame } from '../../carnival';

const { width: WIDTH, height: HEIGHT } = theme.canvas;

export const ROUND_SECONDS = 30;
export const POINTS_PER_WHACK = 10;
export const HOLE_RADIUS = 48;
const COLUMNS = 3;
const ROWS = 3;
const GRID_TOP = 120;
const ROW_SPACING = 120;
const COLUMN_SPACING = 220;

/** How often a snake pops up, from the start of the round to the end. */
export const SPAWN_INTERVAL = { start: 1.0, end: 0.55 } as const;
/** How long a snake stays up, from the start of the round to the end. */
export const UP_TIME = { start: 1.3, end: 0.6 } as const;
/** Seconds a snake takes to pop out of its hole, and to drop back in. */
export const POP_SECONDS = 0.15;

export interface Hole {
  x: number;
  y: number;
  /** Seconds the snake in this hole stays up for; 0 when the hole is empty. */
  snakeTime: number;
  /** Seconds the current snake was set to stay up for when it popped up. */
  upFor: number;
}

export interface Whack {
  x: number;
  y: number;
  age: number;
}

export interface WhackAMoleState {
  holes: Hole[];
  whacks: Whack[];
  /** Seconds since the round started. */
  elapsed: number;
  /** Seconds until the next snake pops up. */
  nextSnake: number;
  score: number;
  phase: 'playing' | 'over';
}

export function createState(): WhackAMoleState {
  const left = WIDTH / 2 - COLUMN_SPACING * ((COLUMNS - 1) / 2);
  const holes = Array.from({ length: ROWS * COLUMNS }, (_, i) => ({
    x: left + (i % COLUMNS) * COLUMN_SPACING,
    y: GRID_TOP + Math.floor(i / COLUMNS) * ROW_SPACING,
    snakeTime: 0,
    upFor: 0,
  }));
  return {
    holes,
    whacks: [],
    elapsed: 0,
    nextSnake: SPAWN_INTERVAL.start,
    score: 0,
    phase: 'playing',
  };
}

/** How far through the round we are, from 0 to 1. */
function progress(elapsed: number): number {
  return Math.min(Math.max(elapsed / ROUND_SECONDS, 0), 1);
}

/** Seconds between snakes. Snakes pop up faster as the round goes on. */
export function spawnInterval(elapsed: number): number {
  const p = progress(elapsed);
  return SPAWN_INTERVAL.start + (SPAWN_INTERVAL.end - SPAWN_INTERVAL.start) * p;
}

/** Seconds a snake stays up. Snakes drop back down sooner as the round goes on. */
export function upTime(elapsed: number): number {
  const p = progress(elapsed);
  return UP_TIME.start + (UP_TIME.end - UP_TIME.start) * p;
}

export function secondsLeft(state: WhackAMoleState): number {
  return Math.max(ROUND_SECONDS - state.elapsed, 0);
}

/**
 * Pops a snake up from a random empty hole. `random` returns a number in
 * [0, 1), like Math.random. Returns false if every hole already has a snake.
 */
export function popUp(state: WhackAMoleState, random: () => number = Math.random): boolean {
  const empty = state.holes.filter((hole) => hole.snakeTime <= 0);
  if (empty.length === 0) return false;
  const hole = empty[Math.min(Math.floor(random() * empty.length), empty.length - 1)];
  hole.snakeTime = upTime(state.elapsed);
  hole.upFor = hole.snakeTime;
  return true;
}

/**
 * How far the snake in a hole is out, from 0 (down in the hole) to 1 (all the
 * way up). It rises over POP_SECONDS when it pops up and sinks over
 * POP_SECONDS before it drops back down.
 */
export function snakeRise(hole: Hole): number {
  if (hole.snakeTime <= 0) return 0;
  const sinceUp = hole.upFor - hole.snakeTime;
  const t = Math.min(sinceUp / POP_SECONDS, hole.snakeTime / POP_SECONDS, 1);
  const eased = Math.max(t, 0);
  // Ease out, so the snake springs up and slows as it reaches the top.
  return 1 - (1 - eased) * (1 - eased);
}

/** How far below its fully raised spot a snake sits, in pixels. */
function snakeSink(hole: Hole): number {
  return (1 - snakeRise(hole)) * HOLE_RADIUS * 1.6;
}

/** Whether a point is on the part of a snake that is out of its hole. */
function hitsSnake(hole: Hole, x: number, y: number): boolean {
  if (snakeRise(hole) <= 0) return false;
  // Nothing below the hole's front edge shows, so nothing there can be hit.
  if (y > hole.y + HOLE_RADIUS * 0.4) return false;
  // The snake sticks up out of its hole, so aim the hit zone a little above
  // it, and lower it with the snake as it rises and sinks.
  return Math.hypot(x - hole.x, y - (hole.y - HOLE_RADIUS / 2 + snakeSink(hole))) <= HOLE_RADIUS;
}

/** Whacks at a point on the canvas. Returns true if it hit a snake that was up. */
export function whack(state: WhackAMoleState, x: number, y: number): boolean {
  if (state.phase !== 'playing') return false;
  const hole = state.holes.find((h) => hitsSnake(h, x, y));
  if (!hole) return false;
  hole.snakeTime = 0;
  state.score += POINTS_PER_WHACK;
  state.whacks.push({ x: hole.x, y: hole.y, age: 0 });
  return true;
}

/** Advances the game by `dt` seconds. */
export function step(state: WhackAMoleState, dt: number, random: () => number = Math.random): void {
  for (const whackMark of state.whacks) whackMark.age += dt;
  state.whacks = state.whacks.filter((w) => w.age < 0.3);
  if (state.phase !== 'playing') return;

  state.elapsed += dt;
  for (const hole of state.holes) hole.snakeTime = Math.max(hole.snakeTime - dt, 0);

  if (state.elapsed >= ROUND_SECONDS) {
    state.elapsed = ROUND_SECONDS;
    for (const hole of state.holes) hole.snakeTime = 0;
    state.phase = 'over';
    return;
  }

  state.nextSnake -= dt;
  while (state.nextSnake <= 0) {
    popUp(state, random);
    state.nextSnake += spawnInterval(state.elapsed);
  }
}

function drawSnake(ctx: CanvasRenderingContext2D, hole: Hole) {
  const { colors } = theme;
  // A snake that is part way out sits lower, with the rest hidden in the hole.
  const headY = hole.y - HOLE_RADIUS * 0.9 + snakeSink(hole);

  ctx.save();
  ctx.beginPath();
  ctx.rect(hole.x - HOLE_RADIUS, 0, HOLE_RADIUS * 2, hole.y);
  ctx.ellipse(hole.x, hole.y, HOLE_RADIUS, HOLE_RADIUS * 0.4, 0, 0, Math.PI);
  ctx.clip();

  // Body, rising out of the hole.
  ctx.fillStyle = colors.green;
  ctx.fillRect(hole.x - 14, headY, 28, HOLE_RADIUS * 0.9);
  ctx.beginPath();
  ctx.arc(hole.x, headY, 22, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = colors.background;
  ctx.beginPath();
  ctx.arc(hole.x - 8, headY - 4, 4, 0, Math.PI * 2);
  ctx.arc(hole.x + 8, headY - 4, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = colors.danger;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(hole.x, headY + 14);
  ctx.lineTo(hole.x, headY + 26);
  ctx.lineTo(hole.x - 5, headY + 32);
  ctx.moveTo(hole.x, headY + 26);
  ctx.lineTo(hole.x + 5, headY + 32);
  ctx.stroke();
  ctx.restore();
}

function draw(ctx: CanvasRenderingContext2D, state: WhackAMoleState) {
  const { colors } = theme;

  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Booth awning.
  const stripe = WIDTH / 16;
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = i % 2 === 0 ? colors.stripeA : colors.stripeB;
    ctx.fillRect(i * stripe, 0, stripe, 40);
  }

  // The board the holes sit in.
  ctx.fillStyle = colors.wood;
  ctx.fillRect(40, GRID_TOP - 80, WIDTH - 80, ROW_SPACING * ROWS + 20);

  for (const hole of state.holes) {
    ctx.fillStyle = colors.background;
    ctx.beginPath();
    ctx.ellipse(hole.x, hole.y, HOLE_RADIUS, HOLE_RADIUS * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    if (hole.snakeTime > 0) drawSnake(ctx, hole);
    // The front lip of the hole, over the snake's body.
    ctx.fillStyle = colors.wood;
    ctx.beginPath();
    ctx.ellipse(hole.x, hole.y + 6, HOLE_RADIUS, HOLE_RADIUS * 0.3, 0, 0, Math.PI);
    ctx.fill();
  }

  ctx.strokeStyle = colors.stripeB;
  ctx.lineWidth = 4;
  for (const w of state.whacks) {
    ctx.globalAlpha = 1 - w.age / 0.3;
    ctx.beginPath();
    ctx.arc(w.x, w.y - HOLE_RADIUS * 0.9, 20 + w.age * 120, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  ctx.fillStyle = colors.text;
  ctx.font = canvasFont('body', 'bold');
  ctx.textAlign = 'left';
  ctx.fillText(`Score ${state.score}`, 16, HEIGHT - 20);
  ctx.textAlign = 'right';
  ctx.fillText(`Time ${Math.ceil(secondsLeft(state))}s`, WIDTH - 16, HEIGHT - 20);

  if (state.phase === 'over') {
    ctx.fillStyle = colors.background;
    ctx.globalAlpha = 0.8;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.fillStyle = colors.accent;
    ctx.font = canvasFont('title', 'bold');
    ctx.fillText(`Time's up! You scored ${state.score}`, WIDTH / 2, HEIGHT / 2);
    ctx.fillStyle = colors.text;
    ctx.font = canvasFont('body');
    ctx.fillText('Click to play again', WIDTH / 2, HEIGHT / 2 + 40);
  }
}

export const whackAMole: CarnivalGame = {
  id: 'whack-a-mole',
  name: 'Whack-a-Mole',
  description:
    'Whack the snakes as they pop out of their holes. They get quicker as time runs out.',

  start(canvas) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not available');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;

    let state = createState();
    let scoreRecorded = false;

    const onDown = (event: PointerEvent) => {
      if (state.phase === 'over') {
        state = createState();
        scoreRecorded = false;
        return;
      }
      const rect = canvas.getBoundingClientRect();
      whack(
        state,
        ((event.clientX - rect.left) / rect.width) * WIDTH,
        ((event.clientY - rect.top) / rect.height) * HEIGHT,
      );
    };
    canvas.addEventListener('pointerdown', onDown);

    let frame = 0;
    let last = performance.now();
    const loop = (time: number) => {
      // Cap the step so a background tab doesn't skip the round.
      const dt = Math.min((time - last) / 1000, 0.05);
      last = time;
      step(state, dt);
      if (state.phase === 'over' && !scoreRecorded) {
        recordScore(whackAMole.id, state.score);
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

export default whackAMole;
