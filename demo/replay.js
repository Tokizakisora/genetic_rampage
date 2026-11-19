const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
const images = {};
let screen, state, popup, pressed, storyCount, storyActive, homeY, heading, ticks, gmClicks;
let targets = [];
let battle = null;
const battlePointers = new Map();

function reset() {
  screen = 'Screen1';
  state = [0, 0, 1, 0, 0, 0, 0, 1];
  popup = 0;
  pressed = '';
  storyCount = 0;
  storyActive = false;
  homeY = (820 - 70) / 2;
  heading = 270;
  ticks = 0;
  gmClicks = 0;
  battle = null;
  battlePointers.clear();
  status.textContent = '主畫面 · 可點選開始或劇情水晶。';
  render();
}

function image(name, x, y, width, height) {
  if (images[name]) ctx.drawImage(images[name], x, y + 30, width, height);
}

function text(value, x, y, size = 16, color = 'black', align = 'left') {
  ctx.fillStyle = color;
  ctx.font = size + 'px "Microsoft JhengHei", sans-serif';
  ctx.textAlign = align;
  ctx.fillText(value, x, y + 30);
}

function target(name, x, y, width, height) {
  targets.push({name, x, y, width, height});
}

function sprite(name, file, x, y, width, height) {
  image(file, x, y, width, height);
  target(name, x, y, width, height);
}

function button(name, label, x, y, width, height, selected) {
  ctx.fillStyle = selected ? '#ffc800' : '#cccccc';
  ctx.beginPath();
  ctx.roundRect(x, y + 30, width, height, 6);
  ctx.fill();
  const parts = label.length > 10 ? [label.slice(0, 7), label.slice(7)] : [label];
  parts.forEach((part, i) => text(part, x + width / 2, y + 20 + i * 16, 13, 'black', 'center'));
  target(name, x, y, width, height);
}

function go(next) {
  screen = next;
  popup = 0;
  if (next === 'Screen1') homeY = (820 - 70) / 2;
  status.textContent = next === 'shop' ? '商店 · 依原作初始資料，DNA 為 0。' : '點選星球開啟關卡視窗。';
  render();
}

function render() {
  targets = [];
  ctx.clearRect(0, 0, 400, 850);
  ctx.fillStyle = '#555555';
  ctx.fillRect(0, 0, 400, 30);
  text(screen === 'Screen1' || screen === 'story' ? project.screens.Screen1.Title : screen === 'shop' ? '商店' : screen === 'battle' ? '戰鬥' : '主線', 8, -9, 14, 'white');
  if (screen === 'Screen1') {
    image(gmClicks >= 5 ? 'test.jpg' : 'UI_background.jpg', 0, 0, 400, 820);
    image('title.png', 2, 12, 390, 150);
    sprite('開始', pressed === '開始' ? 'blstart.png' : 'start.png', 75, homeY, 250, 70);
    sprite('劇情水晶', 'crystal.png', 175, 580, 50, 75);
    target('GM', 256, 30, 64, 64);
  } else if (screen === 'story') {
    image(gmClicks >= 5 ? 'test.jpg' : 'UI_background.jpg', 0, 0, 400, 820);
    text('劇情故事：', 0, 35, 30);
    const shown = '        ' + project.story.slice(0, storyCount);
    let row = '', y = 76;
    for (const char of shown) {
      if (ctx.measureText(row + char).width > 390) {
        text(row, 0, y, 20, '#7c3ed8');
        y += 27;
        row = '';
      }
      row += char;
    }
    text(row, 0, y, 20, '#7c3ed8');
    sprite('返回鍵', 'back.png', 0, 760, 50, 50);
  } else if (screen === 'story_line') {
    image('story_line_background.jpg', 0, 0, 400, 820);
    sprite('地球', 'earth.png', 53, 116, 120, 120);
    sprite('木星', 'wood_ball.png', 140, 238, 240, 200);
    sprite('太陽', 'fireball.png', -45, 495, 500, 500);
    sprite('回首頁', pressed === '回首頁' ? 'blackhouse.png' : 'house.png', 335, 2, 55, 55);
    sprite('商店', 'shop.png', 335, 57, 55, 55);
    if (popup) {
      image('form' + popup + '.png', 26, 200, 350, 340);
      sprite('關閉', pressed === '關閉' ? 'blackno.png' : 'no.png', 325, 207, 40, 40);
      sprite('進入', pressed === '進入' ? 'whitehead.png' : 'fighting.png', 185, 485, 40, 40);
    }
  } else if (screen === 'shop') {
    image('shop_background.jpg', 0, 0, 400, 820);
    image('DNA_picture.png', 145, 0, 30, 35);
    text(String(state[0]), 215, 24, 16, 'white', 'center');
    const names = ['小恐龍', '獨狼', '史塔克', state[2] >= 3 || state[6] ? '伊莉絲' : '???', '???', '???'];
    const files = ['dinosaur_right.png', 'boss1_right.png', state[2] >= 2 || state[5] ? 'boss3_right.png' : 'char.png', state[2] >= 3 || state[6] ? 'red_boss_fly_right.png' : 'char.png', 'char.png', 'char.png'];
    for (let i = 0; i < 6; i++) {
      const x = i % 3 * 128, y = 35 + Math.floor(i / 3) * 244;
      image(files[i], x, y, 128, [120, 125, 160, 160, 160, 160][i]);
      text(names[i], x + 64, y + 182, 17, '#00ffff', 'center');
      let label = '敬請期待';
      if (i === 0) label = state[7] === 1 ? '使用中' : '使用';
      if (i > 0 && i < 4) {
        label = i === 1 ? '購買(DNA:100' : i === 2 ? '通關木星即可開啟' : '通關太陽即可開啟';
        if (state[2] >= i && i > 1) label = i === 2 ? '購買(DNA:300)' : '購買(DNA:500)';
        if (state[i + 3]) label = state[7] === i + 1 ? '使用中' : '使用';
      }
      button('造型' + i, label, x, y + 193, 128, 48, state[7] === i + 1 && i < 4);
    }
    sprite('返回主線', 'back.png', 0, 750, 60, 60);
  } else if (screen === 'battle') {
    renderBattle();
  }
}

function activate(name) {
  if (name === 'GM') {
    gmClicks++;
    if (gmClicks === 5) state = [1000, 0, 3, 0, 0, 0, 0, 1];
  } else if (name === '開始') go('story_line');
  else if (name === '劇情水晶') { screen = 'story'; storyActive = true; }
  else if (name === '返回鍵') { screen = 'Screen1'; storyActive = false; }
  else if (name === '回首頁') go('Screen1');
  else if (name === '商店') go('shop');
  else if (name === '返回主線') go('story_line');
  else if (['地球', '木星', '太陽'].includes(name)) {
    if (popup) return;
    const level = ['地球', '木星', '太陽'].indexOf(name) + 1;
    if (state[2] < level) alert(level === 2 ? '請先通關"地球"' : '請先通關"木星"');
    else popup = level;
  } else if (name === '關閉') popup = 0;
  else if (name === '進入') {
    state[1] = popup;
    battle = new BattleVM(battleProgram, popup, state[7]);
    battle.globals['global 初始值清單'] = state;
    // Starting positions are the presentation arrangements authorized for this project.
    const scene = battleProgram.scenes[['earth', 'jupiter', 'sun'][popup - 1]].presentation.components;
    for (const actor of ['恐龍', 'BOSS']) {
      for (const property of ['X', 'Y']) battle.set(actor, property, scene[actor][property]);
    }
    battle.event('飛行狀態偵測器', 'Timer');
    battle.flush();
    screen = 'battle';
    status.textContent = '按住方向鍵移動、點擊戰鬥區射擊，或按住技能鍵自動朝向頭目連射。';
  } else if (name.startsWith('造型')) {
    const i = Number(name.slice(2));
    if (i >= 4) return;
    if (i === 0) state[7] = 1;
    else if (state[i + 3]) state[7] = i + 1;
    else if (i >= 2 && state[2] < i) alert(i === 2 ? '請先通關木星!' : '請先通關太陽!');
    else {
      const cost = [0, 100, 300, 500][i];
      if (state[0] < cost) alert('持有DNA數量不足!');
      else {
        state[0] -= cost;
        state[i + 3] = 1;
        render();
        alert('購買成功!');
      }
    }
  }
  render();
}

canvas.addEventListener('pointerdown', event => {
  const rect = canvas.getBoundingClientRect();
  const x = (event.clientX - rect.left) * 400 / rect.width;
  if (screen === 'battle') {
    const y = (event.clientY - rect.top) * 850 / rect.height;
    const hit = [...targets].reverse().find(t => x >= t.x && x <= t.x + t.width && y >= t.y && y <= t.y + t.height);
    canvas.setPointerCapture(event.pointerId);
    if (hit) {
      battlePointers.set(event.pointerId, hit.name);
      battle.event(hit.name, 'TouchDown');
    } else if (y < 650) battle.event('畫布1', 'TouchDown', {x, y});
    battle.flush();
    render();
    return;
  }
  const y = (event.clientY - rect.top) * 850 / rect.height - 30;
  const hit = [...targets].reverse().find(t => x >= t.x && x <= t.x + t.width && y >= t.y && y <= t.y + t.height);
  if (!hit) return;
  pressed = hit.name;
  canvas.setPointerCapture(event.pointerId);
  if (['返回鍵', '商店', '返回主線'].includes(pressed) || pressed.startsWith('造型')) {
    const name = pressed;
    pressed = '';
    activate(name);
  }
  render();
});
canvas.addEventListener('pointerup', event => {
  if (screen === 'battle') {
    const name = battlePointers.get(event.pointerId);
    if (name) battle.event(name, 'TouchUp');
    battlePointers.delete(event.pointerId);
    battle.flush();
    render();
    return;
  }
  const name = pressed;
  pressed = '';
  if (name) activate(name);
  render();
});
canvas.addEventListener('pointercancel', event => {
  const name = battlePointers.get(event.pointerId);
  if (name && battle) battle.event(name, 'TouchUp');
  battlePointers.delete(event.pointerId);
  pressed = '';
  render();
});
document.getElementById('reset').addEventListener('click', reset);

async function load() {
  const files = ['UI_background.jpg', 'title.png', 'start.png', 'blstart.png', 'crystal.png', 'back.png', 'story_line_background.jpg', 'earth.png', 'wood_ball.png', 'fireball.png', 'house.png', 'blackhouse.png', 'shop.png', 'form1.png', 'form2.png', 'form3.png', 'no.png', 'blackno.png', 'fighting.png', 'yes.png', 'whitehead.png', 'shop_background.jpg', 'DNA_picture.png', 'dinosaur_right.png', 'boss1_right.png', 'boss3_right.png', 'red_boss_fly_right.png', 'char.png', 'test.jpg', 'battle-earth.png', 'battle-jupiter.png', 'battle-sun.png'];
  // Include all original pictures and HP states referenced by the exported BKY.
  const collect = block => {
    if (!block) return;
    if (block.f && block.f.ASSET) files.push(block.f.ASSET);
    for (const value of Object.values(block.v || {})) collect(value);
    for (const statement of Object.values(block.s || {})) collect(statement);
    collect(block.next);
  };
  battleProgram.blocks.forEach(collect);
  files.push('up.png', 'down.png', 'left.png', 'right.png', 'skill.png', 'openate_background.jpg');
  await Promise.all([...new Set(files)].map(file => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => { images[file] = img; resolve(); };
    img.onerror = () => reject(new Error('圖片載入失敗 ' + file));
    img.src = 'assets/' + file;
  })));
  reset();
  setInterval(() => {
    ticks = (ticks + 1) % 50;
    heading = ticks > 0 && ticks <= 25 ? 270 : 90;
  }, 25);
  // ImageSprite uses its own Interval. The SCM omits it, so use the 100 ms default.
  setInterval(() => {
    homeY += heading === 270 ? 1 : -1;
    if (screen === 'Screen1') render();
  }, 100);
  setInterval(() => {
    if (!storyActive) return;
    storyCount++;
    if (storyCount === project.story.length) storyActive = false;
    if (screen === 'story') render();
  }, 100);
  let previous = performance.now();
  const animate = now => {
    const delta = Math.min(100, now - previous);
    previous = now;
    if (screen === 'battle' && battle) {
      try {
        battle.step(delta);
        if (battle.alerts.length) status.textContent = battle.alerts[battle.alerts.length - 1];
        if (battle.nextScreen) {
          state = battle.nextScreen.value;
          go(battle.nextScreen.name);
          battle = null;
          battlePointers.clear();
        }
        render();
      } catch (error) {
        status.textContent = '還原執行錯誤 · ' + error.message;
        return;
      }
    }
    requestAnimationFrame(animate);
  };
  requestAnimationFrame(animate);
}
load().catch(error => { status.textContent = error.message; });

function renderBattle() {
  if (!battle) return;
  const c = battle.components;
  const drawImage = (file, x, y, width, height) => {
    if (images[file]) ctx.drawImage(images[file], x, y, width, height);
  };
  drawImage(c.story_fight.BackgroundImage, 0, 0, 400, 850);
  drawImage(c['畫布1'].BackgroundImage, 0, 0, 400, 650);
  const drawSprite = (name, offsetX = 0, offsetY = 0) => {
    const sprite = c[name];
    if (!sprite.Visible) return;
    if (sprite.$Type === 'Ball') {
      const hex = String(sprite.PaintColor || '&HFF000000').slice(-6);
      ctx.fillStyle = '#' + hex;
      ctx.beginPath();
      ctx.arc(sprite.X + sprite.Radius, sprite.Y + sprite.Radius, sprite.Radius, 0, Math.PI * 2);
      ctx.fill();
    } else drawImage(sprite.Picture, offsetX + sprite.X, offsetY + sprite.Y, sprite.Width, sprite.Height);
  };
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, 400, 650);
  ctx.clip();
  const sprites = Object.keys(c).filter(name => battle.parents[name] === '畫布1');
  sprites.sort((a, b) => Number(c[a].Z || 1) - Number(c[b].Z || 1));
  sprites.forEach(name => drawSprite(name));
  ctx.restore();
  for (const [name, offsetX, offsetY] of [['往上鍵',0,655], ['往左鍵',0,705], ['往右鍵',0,705], ['往下鍵',0,755], ['技能',300,650]]) {
    drawSprite(name, offsetX, offsetY);
    if (c[name].Visible && c[name].Enabled) target(name, offsetX+c[name].X, offsetY+c[name].Y, c[name].Width, c[name].Height);
  }
  if (c['工具列'].Visible) {
    drawImage(c['返回'].Image, 0, 810, 40, 40);
    target('返回', 0, 810, 40, 40);
  }
  if (c['回首頁'].Visible) target('回首頁', c['回首頁'].X, c['回首頁'].Y, c['回首頁'].Width, c['回首頁'].Height);
}
