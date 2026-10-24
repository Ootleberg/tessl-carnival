# Duckpin Bowling

Bowl a small ball down the lane at ten short yellow pins. You get three balls a
frame to knock them all down.

## How to play

- The ball slides from side to side along the foul line. Click to roll it
  straight up the lane from where it sits.
- The ball knocks down every pin in its path. Pins that fall stay down for the
  rest of the frame.
- Each frame has up to three balls. The frame ends early if you knock every pin
  down, and the next frame starts with all ten pins standing again.
- A game lasts 5 frames.
- Click again on the game over screen to play another game.

## Scoring

Every pin you knock down scores 1 point, so the best possible game is 50.
There are no strike or spare bonuses.

Your final score is saved to the carnival's score board when the game ends.

## Files

- `game.ts`: the game logic (`createState`, `setPins`, `aimX`, `hits`, `roll`,
  `step`, `pinsStanding`) and the `duckpinBowling` entry, the default export the
  midway finds.
- `game.test.ts`: tests for the game logic.
