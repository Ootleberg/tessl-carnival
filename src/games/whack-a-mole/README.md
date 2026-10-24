# Whack-a-Mole

Snakes pop up out of a grid of nine holes. Whack as many as you can before the
clock runs out.

## How to play

- Click a snake while it's up out of its hole to whack it.
- Each snake stays up for a short time, then drops back down.
- Snakes pop up faster, and drop back down sooner, as the round goes on: at the
  start a new snake comes every 1 second and stays up for 1.3 seconds, and by
  the end one comes every 0.35 seconds and stays up for 0.6 seconds.
- A round lasts 30 seconds.
- Click again on the game over screen to play another round.

## Scoring

Every snake you whack scores 10 points. Clicking an empty hole costs nothing.

Your final score is saved to the carnival's score board when the round ends.

## Files

- `game.ts`: the game logic (`createState`, `step`, `popUp`, `whack`,
  `spawnInterval`, `upTime`) and the `whackAMole` entry, the default export the
  midway finds.
- `game.test.ts`: tests for the game logic.
