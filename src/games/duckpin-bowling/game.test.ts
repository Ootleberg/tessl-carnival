import { describe, expect, it } from 'vitest';
import {
  AIM_LIMIT,
  AIM_SPEED,
  BALLS_PER_FRAME,
  FRAMES,
  LANE_CENTER,
  PIN_COUNT,
  aimX,
  createState,
  hits,
  pinsStanding,
  roll,
  step,
  type DuckpinState,
} from './game';

/** Steps the game until it is waiting for the next ball, or over. */
function finishBall(state: DuckpinState) {
  for (let i = 0; i < 1000 && state.phase === 'rolling'; i++) step(state, 0.02);
}

describe('duckpin bowling', () => {
  it('starts on the first ball of the first frame with ten pins standing', () => {
    const state = createState();
    expect(state.pins).toHaveLength(PIN_COUNT);
    expect(pinsStanding(state)).toBe(PIN_COUNT);
    expect(state.frame).toBe(0);
    expect(state.ball).toBe(0);
    expect(state.score).toBe(0);
    expect(state.phase).toBe('aiming');
  });

  it('starts aiming from the middle and slides within the lane', () => {
    expect(aimX(0)).toBe(LANE_CENTER);
    expect(aimX(AIM_LIMIT / AIM_SPEED)).toBeCloseTo(LANE_CENTER + AIM_LIMIT);
    expect(aimX((AIM_LIMIT * 3) / AIM_SPEED)).toBeCloseTo(LANE_CENTER - AIM_LIMIT);
    for (let t = 0; t < 10; t += 0.07) {
      expect(Math.abs(aimX(t) - LANE_CENTER)).toBeLessThanOrEqual(AIM_LIMIT + 1e-9);
    }
  });

  it('knocks down every pin in the ball path and scores one point each', () => {
    const state = createState();
    roll(state);
    finishBall(state);
    const expected = createState().pins.filter((pin) => hits(pin, LANE_CENTER)).length;
    expect(expected).toBeGreaterThan(0);
    expect(expected).toBeLessThan(PIN_COUNT);
    expect(state.score).toBe(expected);
    expect(state.frameScores[0]).toBe(expected);
    expect(pinsStanding(state)).toBe(PIN_COUNT - expected);
  });

  it('leaves knocked pins down for the next ball in the frame', () => {
    const state = createState();
    roll(state);
    finishBall(state);
    expect(state.phase).toBe('aiming');
    expect(state.frame).toBe(0);
    expect(state.ball).toBe(1);
    const standing = pinsStanding(state);
    // The same line again hits nothing new.
    roll(state);
    finishBall(state);
    expect(pinsStanding(state)).toBe(standing);
  });

  it('cannot roll a second ball while one is rolling', () => {
    const state = createState();
    expect(roll(state)).toBe(true);
    expect(roll(state)).toBe(false);
  });

  it('moves to the next frame with fresh pins after three balls', () => {
    const state = createState();
    for (let i = 0; i < BALLS_PER_FRAME; i++) {
      roll(state);
      finishBall(state);
    }
    expect(state.frame).toBe(1);
    expect(state.ball).toBe(0);
    expect(pinsStanding(state)).toBe(PIN_COUNT);
  });

  it('moves to the next frame early once every pin is down', () => {
    const state = createState();
    for (const pin of state.pins) pin.standing = false;
    roll(state);
    finishBall(state);
    expect(state.frame).toBe(1);
    expect(state.ball).toBe(0);
    expect(pinsStanding(state)).toBe(PIN_COUNT);
  });

  it('ends the game after the last frame and ignores further rolls', () => {
    const state = createState();
    for (let i = 0; i < FRAMES * BALLS_PER_FRAME; i++) {
      roll(state);
      finishBall(state);
    }
    expect(state.phase).toBe('over');
    expect(state.frameScores).toHaveLength(FRAMES);
    expect(state.score).toBe(state.frameScores.reduce((a, b) => a + b, 0));
    expect(roll(state)).toBe(false);
  });
});
