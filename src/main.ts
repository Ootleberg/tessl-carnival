import './style.css';
import { applyTheme, bestScore, type CarnivalGame } from './carnival';
import { registry } from './games';

applyTheme();

const app = document.querySelector<HTMLElement>('#app')!;
let stopGame: (() => void) | undefined;

function renderMidway() {
  app.innerHTML = `
    <section class="midway">
      <h1>Step right up!</h1>
      <p class="lede">Pick a booth and play.</p>
      <ul class="booths"></ul>
    </section>`;
  const list = app.querySelector('.booths')!;
  for (const game of registry.all()) list.append(boothCard(game));
}

function boothCard(game: CarnivalGame): HTMLLIElement {
  const best = bestScore(game.id);
  const item = document.createElement('li');
  item.className = 'booth';
  item.innerHTML = `
    <h2></h2>
    <p class="description"></p>
    <p class="best"></p>
    <a class="play" href="#/play/${game.id}">Play</a>`;
  item.querySelector('h2')!.textContent = game.name;
  item.querySelector('.description')!.textContent = game.description;
  item.querySelector('.best')!.textContent = best === undefined ? 'No scores yet' : `Best: ${best}`;
  return item;
}

function renderGame(game: CarnivalGame) {
  app.innerHTML = `
    <section class="game">
      <div class="game-header">
        <a href="#/">← Back to the midway</a>
        <h1></h1>
      </div>
      <canvas></canvas>
    </section>`;
  app.querySelector('h1')!.textContent = game.name;
  stopGame = game.start(app.querySelector('canvas')!);
}

function route() {
  stopGame?.();
  stopGame = undefined;

  const match = location.hash.match(/^#\/play\/([\w-]+)$/);
  const game = match ? registry.get(match[1]) : undefined;
  if (game) renderGame(game);
  else renderMidway();
}

window.addEventListener('hashchange', route);
route();
