import { describe, expect, it } from 'vitest';
import {
  POINTS_PER_WHACK,
  POP_SECONDS,
  ROUND_SECONDS,
  SPAWN_INTERVAL,
  UP_TIME,
  createState,
  popUp,
  secondsLeft,
  snakeRise,
  spawnInterval,
  step,
  upTime,
  whack,
} from './game';

describe('whack-a-mole', () => {
  it('starts with a full clock, no score and every hole empty', () => {
    const state = createState();
    expect(state.holes).toHaveLength(9);
    expect(state.holes.every((h) => h.snakeTime === 0)).toBe(true);
    expect(state.score).toBe(0);
    expect(secondsLeft(state)).toBe(ROUND_SECONDS);
    expect(state.phase).toBe('playing');
  });

  it('pops a snake up from an empty hole', () => {
    const state = createState();
    expect(popUp(state, () => 0)).toBe(true);
    expect(state.holes[0].snakeTime).toBe(UP_TIME.start);
  });

  it('cannot pop up a snake when every hole already has one', () => {
    const state = createState();
    for (const hole of state.holes) hole.snakeTime = 1;
    expect(popUp(state, () => 0)).toBe(false);
  });

  it('scores a whack on a snake that is up and sends it back down', () => {
    const state = createState();
    const hole = state.holes[4];
    hole.snakeTime = 1;
    expect(whack(state, hole.x, hole.y - 20)).toBe(true);
    expect(state.score).toBe(POINTS_PER_WHACK);
    expect(hole.snakeTime).toBe(0);
  });

  it('scores nothing for whacking an empty hole', () => {
    const state = createState();
    const hole = state.holes[4];
    expect(whack(state, hole.x, hole.y)).toBe(false);
    expect(state.score).toBe(0);
  });

  it('drops a snake back down once its time is up', () => {
    const state = createState();
    state.nextSnake = 100;
    state.holes[0].snakeTime = 0.5;
    step(state, 0.6);
    expect(state.holes[0].snakeTime).toBe(0);
    expect(whack(state, state.holes[0].x, state.holes[0].y)).toBe(false);
  });

  it('pops snakes up on a timer', () => {
    const state = createState();
    step(state, SPAWN_INTERVAL.start, () => 0);
    expect(state.holes.filter((h) => h.snakeTime > 0)).toHaveLength(1);
  });

  it('pops snakes up faster, for less time, as the round goes on', () => {
    expect(spawnInterval(0)).toBe(SPAWN_INTERVAL.start);
    expect(spawnInterval(ROUND_SECONDS / 2)).toBeLessThan(spawnInterval(0));
    expect(spawnInterval(ROUND_SECONDS)).toBeCloseTo(SPAWN_INTERVAL.end);
    expect(upTime(ROUND_SECONDS / 2)).toBeLessThan(upTime(0));
    expect(upTime(ROUND_SECONDS)).toBeCloseTo(UP_TIME.end);
  });

  it('ends the round when the time runs out, and ignores whacks after', () => {
    const state = createState();
    state.elapsed = ROUND_SECONDS - 0.01;
    state.holes[0].snakeTime = 1;
    step(state, 0.05);
    expect(state.phase).toBe('over');
    expect(secondsLeft(state)).toBe(0);
    state.holes[0].snakeTime = 1;
    expect(whack(state, state.holes[0].x, state.holes[0].y)).toBe(false);
    expect(state.score).toBe(0);
  });

  it('animates a snake popping out of its hole and dropping back in', () => {
    const state = createState();
    state.nextSnake = 100;
    popUp(state, () => 0);
    const hole = state.holes[0];
    expect(snakeRise(hole)).toBe(0);
    step(state, POP_SECONDS / 2);
    expect(snakeRise(hole)).toBeGreaterThan(0);
    expect(snakeRise(hole)).toBeLessThan(1);
    step(state, POP_SECONDS);
    expect(snakeRise(hole)).toBe(1);
    step(state, hole.snakeTime - POP_SECONDS / 2);
    expect(snakeRise(hole)).toBeLessThan(1);
    step(state, POP_SECONDS);
    expect(snakeRise(hole)).toBe(0);
  });

  it('keeps the last few seconds at a playable pace', () => {
    expect(spawnInterval(ROUND_SECONDS - 3)).toBeGreaterThan(0.5);
  });
});
