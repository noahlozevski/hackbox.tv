// Simple single-file Frogger implementation that plugs into the existing game object
let froggerOriginal = {};
let froggerCleanup = null;

function froggerCanPlay(playerCount) {
  return playerCount >= 1;
}

function froggerStart() {
  if (!froggerCanPlay(game.players.length)) {
    alert('Join a room to play the game');
    return;
  }

  froggerOriginal = {
    head: document.head.innerHTML,
    body: document.body.innerHTML,
    state: JSON.parse(JSON.stringify(game.state)),
    onMessage: game.onMessage,
  };

  document.body.innerHTML = '';
  const style = document.createElement('style');
  style.id = 'frogger-styles';
  style.textContent = `
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: linear-gradient(#0b1b2c, #0f2d44);
      color: #f2f2f2;
      font-family: "Segoe UI", Roboto, Arial, sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .frogger-container {
      width: min(900px, 100%);
      max-width: 920px;
      background: rgba(12, 30, 49, 0.92);
      border: 2px solid #1f4c73;
      border-radius: 12px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.35);
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .frogger-hud {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      flex-wrap: wrap;
    }
    .frogger-title {
      font-size: 26px;
      letter-spacing: 1px;
      font-weight: 700;
      text-transform: uppercase;
    }
    .frogger-stats {
      display: flex;
      gap: 14px;
      font-weight: 600;
    }
    .frogger-button {
      background: #2b8a3e;
      color: #fff;
      border: none;
      border-radius: 8px;
      padding: 10px 14px;
      font-size: 14px;
      cursor: pointer;
      transition: background 0.2s ease, transform 0.1s ease;
    }
    .frogger-button:hover { background: #2fa54a; }
    .frogger-button:active { transform: translateY(1px); }
    #frogger-canvas {
      width: 100%;
      border-radius: 10px;
      background: #0a1624;
    }
    .frogger-instructions {
      background: #0f2236;
      border: 1px solid #174065;
      border-radius: 8px;
      padding: 10px 12px;
      font-size: 14px;
      color: #d9e7fa;
      line-height: 1.5;
    }
    .frogger-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.65);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 999;
    }
    .frogger-overlay.hidden { display: none; }
    .frogger-overlay-content {
      background: #0e2135;
      border: 1px solid #1c4463;
      border-radius: 10px;
      padding: 20px;
      text-align: center;
      max-width: 320px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.45);
    }
    .frogger-overlay-content h2 {
      margin: 0 0 8px;
    }
    .frogger-overlay-content p {
      margin: 0 0 14px;
      color: #d1e4ff;
      line-height: 1.4;
    }
    .frogger-row-type {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 6px;
      margin-right: 8px;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.3px;
    }
    .frogger-row-type.safe { background: #1f5133; }
    .frogger-row-type.road { background: #6b1d1d; }
    .frogger-row-type.water { background: #154f6c; }
  `;
  document.head.appendChild(style);

  const container = document.createElement('div');
  container.className = 'frogger-container';
  container.innerHTML = `
    <div class="frogger-hud">
      <button class="frogger-button" id="frogger-exit-btn">Return to chat</button>
      <div class="frogger-title">Frogger</div>
      <div class="frogger-stats">
        <span id="frogger-score">Score: 0</span>
        <span id="frogger-level">Level: 1</span>
        <span id="frogger-lives">Lives: 3</span>
      </div>
    </div>
    <canvas id="frogger-canvas" width="728" height="520"></canvas>
    <div class="frogger-instructions">
      <strong>Move</strong>: Arrow keys or WASD. <strong>Goal</strong>: reach the top without getting hit or falling in the water.
      Logs carry you across. Cars hurt. Clearing a stage speeds things up.
    </div>
    <div class="frogger-overlay hidden" id="frogger-overlay">
      <div class="frogger-overlay-content">
        <h2 id="frogger-overlay-title">Paused</h2>
        <p id="frogger-overlay-text"></p>
        <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
          <button class="frogger-button" id="frogger-restart-btn">Play again</button>
          <button class="frogger-button" id="frogger-exit-btn-overlay">Exit</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(container);

  const canvas = document.getElementById('frogger-canvas');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('frogger-score');
  const levelEl = document.getElementById('frogger-level');
  const livesEl = document.getElementById('frogger-lives');
  const overlay = document.getElementById('frogger-overlay');
  const overlayTitle = document.getElementById('frogger-overlay-title');
  const overlayText = document.getElementById('frogger-overlay-text');
  const restartBtn = document.getElementById('frogger-restart-btn');
  const exitBtns = [
    document.getElementById('frogger-exit-btn'),
    document.getElementById('frogger-exit-btn-overlay'),
  ];

  const columns = 13;
  const lanes = [
    { type: 'goal' },
    { type: 'water', speed: 1.6, dir: 1, spawn: [1.3, 2.0], len: [2, 3] },
    { type: 'water', speed: 1.9, dir: -1, spawn: [1.1, 1.8], len: [2, 3] },
    { type: 'water', speed: 1.4, dir: 1, spawn: [1.4, 2.1], len: [2, 4] },
    { type: 'safe' },
    { type: 'road', speed: 2.6, dir: -1, spawn: [1.0, 1.5], len: [1, 2] },
    { type: 'road', speed: 2.1, dir: 1, spawn: [1.1, 1.7], len: [1, 2] },
    { type: 'road', speed: 1.7, dir: -1, spawn: [1.3, 1.9], len: [1, 2] },
    { type: 'safe' },
    { type: 'start' },
  ];
  const rows = lanes.length;
  const tileSize = Math.floor(canvas.width / columns);
  canvas.height = tileSize * rows;

  let frog = {
    x: Math.floor(columns / 2),
    y: rows - 1,
    lives: 3,
    score: 0,
  };

  let level = 1;
  let highestRow = rows - 1;
  let animationId = null;
  let lastTime = performance.now();
  let running = true;
  let pendingReset = false;

  function nowSeconds() {
    return performance.now() / 1000;
  }

  lanes.forEach((lane) => {
    lane.entities = [];
    lane.nextSpawn = nowSeconds() + Math.random() * (lane.spawn ? lane.spawn[1] : 2);
  });

  function resetFrog() {
    frog.x = Math.floor(columns / 2);
    frog.y = rows - 1;
    highestRow = rows - 1;
  }

  function resetLanes() {
    lanes.forEach((lane) => {
      lane.entities = [];
      lane.nextSpawn =
        nowSeconds() + Math.random() * (lane.spawn ? lane.spawn[1] : 2);
    });
  }

  function updateHud() {
    scoreEl.textContent = `Score: ${frog.score}`;
    levelEl.textContent = `Level: ${level}`;
    livesEl.textContent = `Lives: ${frog.lives}`;
  }

  function showOverlay(title, text) {
    overlayTitle.textContent = title;
    overlayText.textContent = text;
    overlay.classList.remove('hidden');
    running = false;
  }

  function hideOverlay() {
    overlay.classList.add('hidden');
    if (!pendingReset) {
      running = true;
      lastTime = performance.now();
      animationId = requestAnimationFrame(loop);
    }
  }

  function randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  function spawnEntities(now) {
    lanes.forEach((lane, rowIndex) => {
      if (lane.type !== 'road' && lane.type !== 'water') return;
      if (now < lane.nextSpawn) return;
      const length = lane.len
        ? Math.floor(randomBetween(lane.len[0], lane.len[1]))
        : 2;
      const startX = lane.dir > 0 ? -length : columns + length;
      lane.entities.push({ x: startX, len: length, row: rowIndex });
      const baseDelay = lane.spawn ? randomBetween(lane.spawn[0], lane.spawn[1]) : 1.5;
      lane.nextSpawn = now + baseDelay * Math.pow(0.9, level - 1);
    });
  }

  function moveEntities(delta) {
    const speedBoost = 1 + (level - 1) * 0.18;
    lanes.forEach((lane) => {
      if (lane.type !== 'road' && lane.type !== 'water') return;
      lane.entities.forEach((entity) => {
        entity.x += lane.dir * lane.speed * speedBoost * delta;
        if (lane.dir > 0 && entity.x - entity.len > columns) {
          entity.x = -entity.len;
        } else if (lane.dir < 0 && entity.x + entity.len < -0.5) {
          entity.x = columns + entity.len;
        }
      });
    });
  }

  function handleWater(delta, rowIndex, lane) {
    const onLog = lane.entities.find(
      (log) => frog.x >= log.x && frog.x <= log.x + log.len,
    );
    if (!onLog) {
      loseLife('Fell into the water!');
      return;
    }
    frog.x += lane.dir * lane.speed * delta;
    if (frog.x < -0.5 || frog.x > columns - 0.5) {
      loseLife('Fell off the log!');
    }
  }

  function handleRoad(rowIndex, lane) {
    const hit = lane.entities.some(
      (car) => frog.x >= car.x - 0.4 && frog.x <= car.x + car.len + 0.4,
    );
    if (hit) {
      loseLife('Got hit by a car!');
    }
  }

  function loseLife(reason) {
    if (pendingReset) return;
    frog.lives -= 1;
    frog.score = Math.max(0, frog.score - 50);
    updateHud();
    if (frog.lives <= 0) {
      pendingReset = true;
      showOverlay('Game Over', `${reason} Press "Play again" or Exit.`);
      return;
    }
    resetFrog();
  }

  function reachGoal() {
    frog.score += 250 + (level - 1) * 25;
    level += 1;
    pendingReset = true;
    updateHud();
    showOverlay('Stage Cleared', 'Speed increases! Press Play to continue.');
  }

  function clampFrog() {
    frog.x = Math.max(0, Math.min(columns - 1, frog.x));
    frog.y = Math.max(0, Math.min(rows - 1, frog.y));
    if (frog.y < highestRow) {
      highestRow = frog.y;
      frog.score += 10;
      updateHud();
    }
  }

  function handleInput(event) {
    if (!running) return;
    const key = event.key.toLowerCase();
    if (['arrowup', 'w'].includes(key)) {
      frog.y -= 1;
    } else if (['arrowdown', 's'].includes(key)) {
      frog.y += 1;
    } else if (['arrowleft', 'a'].includes(key)) {
      frog.x -= 1;
    } else if (['arrowright', 'd'].includes(key)) {
      frog.x += 1;
    } else {
      return;
    }
    event.preventDefault();
    clampFrog();
    if (frog.y === 0) {
      reachGoal();
    }
  }

  function drawBackground() {
    lanes.forEach((lane, rowIndex) => {
      const y = rowIndex * tileSize;
      if (lane.type === 'goal') {
        ctx.fillStyle = '#1b4c36';
      } else if (lane.type === 'safe' || lane.type === 'start') {
        ctx.fillStyle = '#133024';
      } else if (lane.type === 'road') {
        ctx.fillStyle = '#1a1a1a';
      } else {
        ctx.fillStyle = '#0d354d';
      }
      ctx.fillRect(0, y, canvas.width, tileSize);

      if (lane.type === 'road') {
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.setLineDash([8, 12]);
        ctx.beginPath();
        ctx.moveTo(0, y + tileSize / 2);
        ctx.lineTo(canvas.width, y + tileSize / 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    });
  }

  function drawEntities() {
    lanes.forEach((lane, rowIndex) => {
      if (lane.type === 'road') {
        ctx.fillStyle = '#c0392b';
        lane.entities.forEach((car) => {
          const x = car.x * tileSize;
          ctx.fillRect(
            x,
            rowIndex * tileSize + 6,
            car.len * tileSize * 0.95,
            tileSize - 12,
          );
        });
      } else if (lane.type === 'water') {
        ctx.fillStyle = '#1abc9c';
        lane.entities.forEach((log) => {
          const x = log.x * tileSize;
          ctx.fillRect(
            x,
            rowIndex * tileSize + 8,
            log.len * tileSize,
            tileSize - 16,
          );
        });
      }
    });
  }

  function drawFrog() {
    ctx.save();
    ctx.translate(frog.x * tileSize + tileSize / 2, frog.y * tileSize + tileSize / 2);
    ctx.fillStyle = '#3ec46d';
    ctx.beginPath();
    ctx.arc(0, 0, tileSize * 0.32, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1f9b4c';
    ctx.beginPath();
    ctx.arc(-tileSize * 0.15, -tileSize * 0.05, tileSize * 0.1, 0, Math.PI * 2);
    ctx.arc(tileSize * 0.15, -tileSize * 0.05, tileSize * 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function update(delta) {
    const now = nowSeconds();
    spawnEntities(now);
    moveEntities(delta);

    const lane = lanes[frog.y];
    if (lane.type === 'water') {
      handleWater(delta, frog.y, lane);
    } else if (lane.type === 'road') {
      handleRoad(frog.y, lane);
    }
    clampFrog();
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBackground();
    drawEntities();
    drawFrog();
  }

  function loop(time) {
    const delta = (time - lastTime) / 1000;
    lastTime = time;
    if (running) {
      update(delta);
      draw();
      animationId = requestAnimationFrame(loop);
    }
  }

  function restartGame() {
    pendingReset = false;
    level = 1;
    frog.score = 0;
    frog.lives = 3;
    updateHud();
    resetLanes();
    resetFrog();
    hideOverlay();
  }

  function continueGame() {
    pendingReset = false;
    resetLanes();
    resetFrog();
    hideOverlay();
  }

  function cleanupFrogger() {
    running = false;
    if (animationId) cancelAnimationFrame(animationId);
    window.removeEventListener('keydown', handleInput);
    game.onMessage = froggerOriginal.onMessage;
    document.body.innerHTML = froggerOriginal.body;
    document.head.innerHTML = froggerOriginal.head;
    game.state = froggerOriginal.state;
    froggerCleanup = null;
  }
  froggerCleanup = cleanupFrogger;

  restartBtn.addEventListener('click', () => {
    if (frog.lives <= 0) {
      restartGame();
    } else {
      continueGame();
    }
  });

  exitBtns.forEach((btn) => btn.addEventListener('click', cleanupFrogger));
  window.addEventListener('keydown', handleInput);
  updateHud();
  drawBackground();
  drawEntities();
  drawFrog();
  game.onMessage = function() {};
  animationId = requestAnimationFrame(loop);
}

if (!window.games) {
  window.games = {};
}

window.games.frogger = {
  start: froggerStart,
  stop: function() {
    if (froggerCleanup) {
      froggerCleanup();
    }
  },
  canPlay: froggerCanPlay,
};
