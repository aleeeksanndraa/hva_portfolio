(() => {
  "use strict";

  const PROJECTS = window.PROJECTS || [];
  const $ = (id) => document.getElementById(id);
  const root = $("root");
  const views = { home: $("home-view"), project: $("project-view"), archive: $("archive-view"), about: $("about-view") };
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ------------------------------------------------------------------
   * Storage (per visitor, best effort)
   * ------------------------------------------------------------------ */
  const store = {
    get(k, d) { try { const v = localStorage.getItem("sasha:" + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem("sasha:" + k, JSON.stringify(v)); } catch (e) { /* private mode */ } }
  };

  /* ------------------------------------------------------------------
   * Sound — tiny synthesized blips, off until the visitor turns it on
   * ------------------------------------------------------------------ */
  let soundOn = store.get("sound", false);
  let ctx = null;
  function blip(freq, dur, type, vol, slide) {
    if (!soundOn) return;
    try {
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      const t = ctx.currentTime;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type || "square";
      o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
      g.gain.setValueAtTime(vol || 0.05, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + dur + 0.02);
    } catch (e) { /* audio unavailable */ }
  }
  const sfx = {
    tick: () => blip(1400, 0.03, "square", 0.025),
    click: () => blip(520, 0.08, "square", 0.05, 880),
    open: () => { blip(330, 0.09, "square", 0.05, 660); setTimeout(() => blip(660, 0.12, "square", 0.04, 990), 70); },
    poke: () => blip(240, 0.12, "triangle", 0.08, 160),
    star: () => [784, 988, 1175, 1568].forEach((f, i) => setTimeout(() => blip(f, 0.1, "square", 0.045), i * 70)),
    eat: () => blip(880, 0.06, "square", 0.04, 1320),
    die: () => blip(300, 0.4, "sawtooth", 0.05, 60)
  };
  const soundBtn = $("sound-toggle");
  function renderSound() {
    soundBtn.textContent = soundOn ? "♪ SOUND ON" : "♪ SOUND OFF";
    soundBtn.setAttribute("aria-pressed", String(soundOn));
  }
  soundBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    soundOn = !soundOn;
    store.set("sound", soundOn);
    renderSound();
    sfx.click();
  });
  renderSound();

  /* ------------------------------------------------------------------
   * Pixel layer — cursor trail, click bursts, view transitions
   * ------------------------------------------------------------------ */
  const pc = $("pixels");
  const px = pc.getContext("2d");
  const CELL = 12;
  let parts = [];
  let wipe = null;
  function sizePixels() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    pc.width = Math.round(innerWidth * dpr);
    pc.height = Math.round(innerHeight * dpr);
    px.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  sizePixels();
  let lastTrail = { x: -99, y: -99 };
  function trail(x, y) {
    if (reduceMotion) return;
    const gx = Math.floor(x / CELL) * CELL;
    const gy = Math.floor(y / CELL) * CELL;
    if (gx === lastTrail.x && gy === lastTrail.y) return;
    lastTrail = { x: gx, y: gy };
    parts.push({ x: gx, y: gy, vx: 0, vy: 0, life: 1, decay: 0.035, c: "17,17,16", snap: true });
  }
  function burst(x, y, n, color) {
    if (reduceMotion) return;
    for (let i = 0; i < (n || 14); i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 2 + Math.random() * 5;
      parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 2, life: 1, decay: 0.02 + Math.random() * 0.02, c: color || "17,17,16", g: 0.25 });
    }
  }
  // pixel wipe: cover the screen square by square, swap, then uncover
  function pixelWipe(swap) {
    if (reduceMotion) { swap(); return; }
    const cols = Math.ceil(innerWidth / 48);
    const rows = Math.ceil(innerHeight / 48);
    const order = [];
    for (let i = 0; i < cols * rows; i++) order.push(Math.random());
    wipe = { cols, rows, order, t: 0, swapped: false, swap };
  }
  function drawPixels() {
    px.clearRect(0, 0, innerWidth, innerHeight);
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.x += p.vx; p.y += p.vy; if (p.g) p.vy += p.g;
      p.life -= p.decay;
      if (p.life <= 0) { parts.splice(i, 1); continue; }
      px.fillStyle = "rgba(" + p.c + "," + (p.snap ? p.life * 0.35 : p.life).toFixed(3) + ")";
      const s = p.snap ? CELL : 6;
      px.fillRect(p.snap ? p.x : Math.round(p.x / 6) * 6, p.snap ? p.y : Math.round(p.y / 6) * 6, s, s);
    }
    if (wipe) {
      wipe.t += 0.06;
      const w = 48;
      // 0..1 covering, 1..2 uncovering
      for (let r = 0; r < wipe.rows; r++) {
        for (let c = 0; c < wipe.cols; c++) {
          const k = wipe.order[r * wipe.cols + c];
          const on = wipe.t < 1 ? wipe.t > k : wipe.t - 1 < k;
          if (on) { px.fillStyle = "#111110"; px.fillRect(c * w, r * w, w, w); }
        }
      }
      if (wipe.t >= 1 && !wipe.swapped) { wipe.swapped = true; wipe.swap(); }
      if (wipe.t >= 2) wipe = null;
    }
  }

  /* ------------------------------------------------------------------
   * Stars (collectibles)
   * ------------------------------------------------------------------ */
  const STARS = [
    { id: "corner", hint: "Hiding in a corner of the landing" },
    { id: "eyebrow", hint: "Near the very top" },
    { id: "floor", hint: "Down on the floor, by the hint" },
    { id: "drift", hint: "Floating on the right" },
    { id: "poke", hint: "Poke the face five times" },
    { id: "reader", hint: "Read any project to the very end" },
    { id: "snake", hint: "Eat 10 ✦ in the snake game" }
  ];
  let got = store.get("stars", []);
  if (!Array.isArray(got)) got = [];
  function renderStars() {
    $("stars-count").textContent = String(got.length);
    $("stars-total").textContent = String(STARS.length);
    const list = $("stars-list");
    list.innerHTML = "";
    STARS.forEach((s) => {
      const li = document.createElement("li");
      const have = got.includes(s.id);
      li.className = have ? "got" : "";
      li.textContent = (have ? "✦ " : "· ") + s.hint;
      list.appendChild(li);
    });
    const note = $("stars-note");
    if (got.length >= STARS.length) {
      note.innerHTML = 'All found. You clearly have time — <a href="mailto:aleksandraslahova88@gmail.com?subject=I%20found%20all%20the%20stars">say hi</a>.';
    } else {
      note.textContent = "Find all " + STARS.length + " to unlock a little something.";
    }
  }
  let toastT = null;
  function toast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastT);
    toastT = setTimeout(() => t.classList.remove("show"), 2400);
  }
  function collect(id, x, y) {
    if (got.includes(id)) return false;
    got.push(id);
    store.set("stars", got);
    renderStars();
    sfx.star();
    if (x != null) burst(x, y, 26);
    const hud = $("stars-hud");
    hud.classList.remove("bump"); void hud.offsetWidth; hud.classList.add("bump");
    toast(got.length >= STARS.length ? "✦ ALL " + STARS.length + " STARS — check the panel" : "✦ STAR FOUND — " + got.length + "/" + STARS.length);
    return true;
  }
  // stars hidden on the landing
  const PICKS = [
    { id: "corner", style: "right: 2.6vw; bottom: 3.2vh;" },
    { id: "eyebrow", style: "left: 63vw; top: 3vh;" },
    { id: "floor", style: "left: 41vw; bottom: 2.6vh;" },
    { id: "drift", style: "right: 6vw; top: 38vh;" }
  ];
  function placePicks() {
    PICKS.forEach((p) => {
      if (got.includes(p.id) || document.querySelector('[data-star="' + p.id + '"]')) return;
      const b = document.createElement("button");
      b.type = "button";
      b.className = "star-pick";
      b.dataset.star = p.id;
      b.setAttribute("aria-label", "Hidden star");
      b.setAttribute("style", p.style);
      b.textContent = "✦";
      views.home.appendChild(b);
    });
  }

  /* ------------------------------------------------------------------
   * Card ring
   * ------------------------------------------------------------------ */
  const COVERS = {
    "01": { img: "assets/badge-tight.png", cls: "light" },
    "02": { type: "IN //<br>BETWEEN" },
    "03": { img: "assets/ei-little-tank-tank.jpg", cls: "shade" }
  };
  const CARDS = PROJECTS.map((p, i) => ({
    kind: "project", index: i, num: p.index, title: p.title,
    meta: p.course.split("(")[0].trim() + " · " + p.year,
    cover: COVERS[p.index] || { type: p.title }
  }));
  CARDS.push({ kind: "about", num: "ME", title: "ABOUT", meta: "Who's behind the face", cover: { img: "assets/tamagotchi-with-me.png", cls: "light" } });
  CARDS.push({ kind: "play", num: "▸", title: "PLAY", meta: "Snake on a Sasha·gotchi", cover: { pixels: true } });
  CARDS.push({ kind: "archive", num: "—", title: "ARCHIVE", meta: "Every project as a list", cover: { img: "assets/chrome-folder.png", cls: "light" } });

  const ring = $("ring");
  const N = CARDS.length;
  const STEP = 360 / N;
  let angle = 0;
  let targetAngle = 0;
  let front = -1;
  let radius = 420;
  let radiusY = 220;
  const cardEls = [];

  function drawSnakeCover(cv) {
    const x = cv.getContext("2d");
    x.fillStyle = "#c5cbb0"; x.fillRect(0, 0, 16, 22);
    x.fillStyle = "#2b2f25";
    [[3, 6], [4, 6], [5, 6], [6, 6], [6, 7], [6, 8], [7, 8], [8, 8], [9, 8], [9, 9], [9, 10], [10, 10], [11, 10]].forEach(([a, b]) => x.fillRect(a, b, 1, 1));
    x.fillRect(12, 4, 1, 1); x.fillRect(11, 5, 3, 1); x.fillRect(12, 6, 1, 1);
  }

  CARDS.forEach((c, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "ring-card " + (c.cover.cls || "");
    b.dataset.card = String(i);
    b.setAttribute("aria-label", c.title + " — " + c.meta);
    if (c.cover.img) {
      const img = document.createElement("img");
      img.src = c.cover.img;
      img.alt = "";
      b.appendChild(img);
    } else if (c.cover.pixels) {
      const cv = document.createElement("canvas");
      cv.className = "card-pixels";
      cv.width = 16; cv.height = 22;
      drawSnakeCover(cv);
      b.appendChild(cv);
      b.style.color = "#2b2f25";
    } else {
      const t = document.createElement("div");
      t.className = "card-type";
      t.innerHTML = c.cover.type;
      b.appendChild(t);
    }
    const lab = document.createElement("div");
    lab.className = "card-label";
    lab.innerHTML = "<span>" + c.num + "</span><span>" + (c.kind === "project" ? "OPEN →" : c.title) + "</span>";
    b.appendChild(lab);
    ring.appendChild(b);
    cardEls.push(b);
  });

  function layout() {
    const w = innerWidth, h = innerHeight;
    const small = w < 760;
    const cw = Math.round(Math.max(96, Math.min(190, w * 0.14, h * 0.21)));
    radius = small ? Math.min(w * 0.36, 200) : Math.min(w * 0.36, h * 0.66, 560);
    radiusY = h * (small ? 0.24 : 0.26);
    document.documentElement.style.setProperty("--cw", cw + "px");
    document.documentElement.style.setProperty("--fw", Math.round(Math.min(h * 0.27, w * (small ? 0.42 : 0.2), 280)) + "px");
    sizePixels();
  }

  function renderRing() {
    cardEls.forEach((el, i) => {
      const a = i * STEP - angle;
      const rel = (((a % 360) + 540) % 360) - 180; // -180..180, 0 = front (below the face)
      const rad = rel * Math.PI / 180;
      const depth = Math.cos(rad); // 1 front, -1 behind the head
      const x = Math.sin(rad) * radius;
      const y = depth * radiusY;
      const sc = 0.58 + 0.42 * ((depth + 1) / 2);
      el.style.transform = "translate(" + x.toFixed(1) + "px," + y.toFixed(1) + "px) scale(" + sc.toFixed(3) + ") rotate(" + (Math.sin(rad) * -14).toFixed(2) + "deg)";
      el.style.opacity = (0.35 + 0.65 * ((depth + 1) / 2)).toFixed(3);
      el.style.zIndex = String(Math.round((depth + 1) * 50)); // face sits at 50
      el.style.filter = depth < -0.3 ? "grayscale(1) blur(1.5px)" : "none";
    });
    const f = ((Math.round(angle / STEP) % N) + N) % N;
    if (f !== front) {
      if (front !== -1) sfx.tick();
      front = f;
      cardEls.forEach((el, i) => el.classList.toggle("is-front", i === f));
      const c = CARDS[f];
      $("cap-index").textContent = c.num;
      $("cap-title").textContent = c.title;
      $("cap-meta").textContent = c.meta;
      const cap = $("card-caption");
      cap.classList.remove("swap"); void cap.offsetWidth; cap.classList.add("swap");
    }
  }

  let snapT = null;
  function nudge(deltaDeg) {
    targetAngle += deltaDeg;
    clearTimeout(snapT);
    snapT = setTimeout(() => { targetAngle = Math.round(targetAngle / STEP) * STEP; }, 140);
    $("landing-hint").classList.add("is-gone");
  }
  function spinTo(i) {
    // shortest way round to card i
    const cur = Math.round(targetAngle / STEP);
    let d = ((i - cur) % N + N) % N;
    if (d > N / 2) d -= N;
    targetAngle = (cur + d) * STEP;
  }

  window.addEventListener("wheel", (e) => {
    if (view !== "home" || anyModal()) return;
    e.preventDefault();
    const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    nudge(d * 0.12);
  }, { passive: false });

  // touch / drag to spin
  let drag = null;
  views.home.addEventListener("pointerdown", (e) => {
    if (e.target.closest(".star-pick, #face")) return;
    drag = { x: e.clientX, moved: 0, start: targetAngle };
  });
  window.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    drag.moved = Math.max(drag.moved, Math.abs(dx));
    if (drag.moved > 6) targetAngle = drag.start - dx * 0.25;
  });
  window.addEventListener("pointerup", () => {
    if (!drag) return;
    if (drag.moved > 6) { targetAngle = Math.round(targetAngle / STEP) * STEP; $("landing-hint").classList.add("is-gone"); }
    setTimeout(() => { drag = null; }, 0);
  });

  /* ------------------------------------------------------------------
   * Face — eyes follow the cursor, blink, react to pokes
   * ------------------------------------------------------------------ */
  const face = $("face");
  const pupils = [$("pupil-l"), $("pupil-r")];
  const eyes = [$("eye-l"), $("eye-r")];
  let look = { x: innerWidth / 2, y: innerHeight };
  let eyeX = 0, eyeY = 0;
  let pokes = 0;
  let pokeReset = null;
  function blink() {
    eyes.forEach((e) => e.classList.add("blink"));
    setTimeout(() => eyes.forEach((e) => e.classList.remove("blink")), 130);
  }
  (function blinkLoop() {
    setTimeout(() => { if (view === "home") blink(); blinkLoop(); }, 2600 + Math.random() * 3200);
  })();
  function updateEyes() {
    const r = face.getBoundingClientRect();
    if (!r.width) return;
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height * 0.47;
    const dx = look.x - cx;
    const dy = look.y - cy;
    const dist = Math.hypot(dx, dy) || 1;
    const k = Math.min(1, dist / 260);
    const tx = (dx / dist) * 14 * k;
    const ty = (dy / dist) * 7 * k;
    eyeX += (tx - eyeX) * 0.2;
    eyeY += (ty - eyeY) * 0.2;
    pupils.forEach((p) => p.setAttribute("transform", "translate(" + eyeX.toFixed(2) + " " + eyeY.toFixed(2) + ")"));
  }
  face.addEventListener("click", (e) => {
    e.stopPropagation();
    sfx.poke();
    burst(e.clientX, e.clientY, 10, "201,80,90");
    face.classList.remove("poked"); void face.offsetWidth; face.classList.add("poked");
    blink();
    pokes++;
    clearTimeout(pokeReset);
    pokeReset = setTimeout(() => { pokes = 0; }, 2500);
    if (pokes >= 5) { pokes = 0; if (!collect("poke", e.clientX, e.clientY)) toast("ow. okay. you already have that one."); }
    else if (pokes === 3 && !got.includes("poke")) toast("hey—");
  });

  /* ------------------------------------------------------------------
   * Views
   * ------------------------------------------------------------------ */
  let view = "home";
  function setView(next, after) {
    pixelWipe(() => {
      view = next;
      Object.keys(views).forEach((k) => { views[k].hidden = k !== view; });
      root.classList.toggle("is-landing", view === "home");
      root.classList.toggle("is-static", view !== "home");
      window.scrollTo(0, 0);
      if (after) after();
    });
  }

  function renderProjectDetail(i) {
    const p = PROJECTS[i];
    $("project-index").textContent = p.index;
    $("project-title").textContent = p.title;
    const meta = $("project-meta");
    meta.innerHTML = "";
    [["YEAR", p.year], ["COURSE", p.course], ["ROLE", p.role], ["STATUS", p.status]].forEach(([label, value]) => {
      const col = document.createElement("div");
      const l = document.createElement("div");
      l.className = "meta-label";
      l.textContent = label;
      const v = document.createElement("div");
      v.textContent = value;
      col.append(l, v);
      meta.appendChild(col);
    });
    const chaptersEl = $("chapters");
    chaptersEl.innerHTML = "";
    p.chapters.forEach((c) => {
      const section = document.createElement("section");
      section.className = "chapter";
      const num = document.createElement("div");
      num.className = "chapter-num";
      num.textContent = c.n;
      const body = document.createElement("div");
      body.className = "chapter-body";
      const top = document.createElement("div");
      top.className = "chapter-top";
      const h2 = document.createElement("h2");
      h2.className = "chapter-title";
      h2.textContent = c.title;
      const pEl = document.createElement("p");
      pEl.className = "chapter-text";
      pEl.textContent = c.text;
      top.append(h2, pEl);
      body.appendChild(top);
      if (c.media.length) {
        const media = document.createElement("div");
        media.className = "chapter-media";
        c.media.forEach((m) => {
          const fig = document.createElement("figure");
          fig.className = "media-figure";
          const box = document.createElement("div");
          box.className = "media-box " + m.kind;
          if (m.img) {
            const img = document.createElement("img");
            img.src = m.img;
            img.alt = m.label;
            img.loading = "lazy";
            box.appendChild(img);
          }
          const cap = document.createElement("figcaption");
          cap.className = "media-caption";
          cap.textContent = m.label;
          fig.append(box, cap);
          media.appendChild(fig);
        });
        body.appendChild(media);
      }
      section.append(num, body);
      chaptersEl.appendChild(section);
    });
    $("read-star").hidden = true;
  }

  function renderArchive() {
    const list = $("archive-list");
    list.innerHTML = "";
    PROJECTS.forEach((p, i) => {
      const row = document.createElement("div");
      row.className = "archive-row";
      row.dataset.action = "open-project";
      row.dataset.index = String(i);
      [p.index, p.title, p.course, p.year, "→"].forEach((t, k) => {
        const d = document.createElement("div");
        if (k === 1) d.className = "archive-project-title";
        if (k === 4) d.className = "archive-mark";
        d.textContent = t;
        row.appendChild(d);
      });
      list.appendChild(row);
    });
    const row = document.createElement("div");
    row.className = "archive-row is-placeholder";
    row.innerHTML = "<div>" + String(PROJECTS.length + 1).padStart(2, "0") + '</div><div class="archive-project-title">Project —</div><div>—</div><div>—</div><div class="archive-mark">—</div>';
    list.appendChild(row);
    const end = document.createElement("div");
    end.className = "archive-list-end";
    list.appendChild(end);
  }

  // reaching the end of a project earns the reader star
  window.addEventListener("scroll", () => {
    if (view !== "project") return;
    const nearEnd = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 40;
    if (nearEnd && collect("reader")) $("read-star").hidden = false;
  }, { passive: true });

  function openCard(i) {
    const c = CARDS[i];
    sfx.open();
    if (c.kind === "project") setView("project", () => renderProjectDetail(c.index));
    else if (c.kind === "about") setView("about");
    else if (c.kind === "archive") setView("archive", renderArchive);
    else if (c.kind === "play") openSnake();
  }

  /* ------------------------------------------------------------------
   * Snake
   * ------------------------------------------------------------------ */
  const sc = $("snake-canvas");
  const sx = sc.getContext("2d");
  const G = 20; // grid cells
  const C = sc.width / G;
  let snake = [], dir = { x: 1, y: 0 }, nextDir = dir, food = { x: 0, y: 0 }, score = 0, alive = true, running = false, stepT = 0;
  let best = store.get("snake-best", 0);
  $("snake-best").textContent = String(best);
  function resetSnake() {
    snake = [{ x: 8, y: 10 }, { x: 7, y: 10 }, { x: 6, y: 10 }];
    dir = { x: 1, y: 0 };
    nextDir = dir;
    score = 0;
    alive = true;
    placeFood();
    $("snake-score").textContent = "0";
    drawSnake();
  }
  function placeFood() {
    do { food = { x: Math.floor(Math.random() * G), y: Math.floor(Math.random() * G) }; }
    while (snake.some((s) => s.x === food.x && s.y === food.y));
  }
  function drawSnake() {
    sx.fillStyle = "#c5cbb0";
    sx.fillRect(0, 0, sc.width, sc.height);
    sx.fillStyle = "rgba(43,47,37,0.07)";
    for (let i = 0; i < G; i++) for (let j = 0; j < G; j++) sx.fillRect(i * C + 1, j * C + 1, C - 2, C - 2);
    sx.fillStyle = "#2b2f25";
    // food as a little pixel star
    const fx = food.x * C, fy = food.y * C, u = C / 4;
    sx.fillRect(fx + u * 1.5, fy, u, C);
    sx.fillRect(fx, fy + u * 1.5, C, u);
    snake.forEach((s, i) => {
      const pad = i === 0 ? 0 : 1;
      sx.fillRect(s.x * C + pad, s.y * C + pad, C - pad * 2, C - pad * 2);
    });
  }
  function stepSnake() {
    dir = nextDir;
    const head = { x: (snake[0].x + dir.x + G) % G, y: (snake[0].y + dir.y + G) % G };
    if (snake.some((s) => s.x === head.x && s.y === head.y)) {
      alive = false;
      running = false;
      sfx.die();
      $("snake-msg").innerHTML = "GAME OVER · " + score + "<br>SPACE / TAP TO RETRY";
      $("snake-msg").hidden = false;
      return;
    }
    snake.unshift(head);
    if (head.x === food.x && head.y === food.y) {
      score++;
      sfx.eat();
      $("snake-score").textContent = String(score);
      if (score > best) { best = score; store.set("snake-best", best); $("snake-best").textContent = String(best); }
      if (score === 10) collect("snake");
      placeFood();
    } else {
      snake.pop();
    }
    drawSnake();
  }
  function startSnake() {
    if (!alive) resetSnake();
    running = true;
    $("snake-msg").hidden = true;
  }
  function setDir(name) {
    const m = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } }[name];
    if (!m) return;
    if (m.x === -dir.x && m.y === -dir.y) return;
    nextDir = m;
    if (!running) startSnake();
  }
  function openSnake() {
    $("snake").hidden = false;
    resetSnake();
    running = false;
    $("snake-msg").innerHTML = "PRESS SPACE<br>OR TAP TO START";
    $("snake-msg").hidden = false;
  }
  function closeSnake() { $("snake").hidden = true; running = false; }
  document.querySelectorAll(".console-pad button").forEach((b) => b.addEventListener("click", () => setDir(b.dataset.dir)));
  let swipe = null;
  sc.addEventListener("pointerdown", (e) => { swipe = { x: e.clientX, y: e.clientY }; });
  sc.addEventListener("pointerup", (e) => {
    if (!swipe) return;
    const dx = e.clientX - swipe.x, dy = e.clientY - swipe.y;
    swipe = null;
    if (Math.hypot(dx, dy) < 18) { if (!running) startSnake(); return; }
    setDir(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up"));
  });

  function anyModal() { return !$("snake").hidden || !$("stars-panel").hidden; }

  /* ------------------------------------------------------------------
   * Input
   * ------------------------------------------------------------------ */
  window.addEventListener("keydown", (e) => {
    if (!$("snake").hidden) {
      const k = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right", w: "up", s: "down", a: "left", d: "right" }[e.key];
      if (k) { e.preventDefault(); setDir(k); }
      if (e.key === " ") { e.preventDefault(); if (running) { running = false; $("snake-msg").innerHTML = "PAUSED"; $("snake-msg").hidden = false; } else startSnake(); }
      if (e.key === "Escape") closeSnake();
      return;
    }
    if (!$("stars-panel").hidden) { if (e.key === "Escape") $("stars-panel").hidden = true; return; }
    if (view !== "home") { if (e.key === "Escape") setView("home"); return; }
    if (e.key === "ArrowRight") { e.preventDefault(); spinTo((front + 1) % N); }
    if (e.key === "ArrowLeft") { e.preventDefault(); spinTo((front - 1 + N) % N); }
  });

  window.addEventListener("mousemove", (e) => {
    look = { x: e.clientX, y: e.clientY };
    if (view === "home" && !anyModal()) trail(e.clientX, e.clientY);
  });
  window.addEventListener("touchmove", (e) => {
    const t = e.touches[0];
    if (t) look = { x: t.clientX, y: t.clientY };
  }, { passive: true });

  document.addEventListener("click", (e) => {
    const pick = e.target.closest(".star-pick");
    if (pick) { const r = pick.getBoundingClientRect(); collect(pick.dataset.star, r.left + r.width / 2, r.top + r.height / 2); pick.remove(); return; }
    const card = e.target.closest(".ring-card");
    if (card) {
      if (drag && drag.moved > 6) return;
      const i = parseInt(card.dataset.card, 10);
      if (i === front) openCard(i);
      else { sfx.click(); spinTo(i); }
      return;
    }
    const el = e.target.closest("[data-action]");
    if (el) {
      const a = el.dataset.action;
      sfx.click();
      if (a === "home") { if (view !== "home") setView("home"); else spinTo(0); }
      else if (a === "projects") { if (view !== "home") setView("home", () => spinTo(0)); else spinTo(0); }
      else if (a === "about") setView("about");
      else if (a === "archive") setView("archive", renderArchive);
      else if (a === "play") openSnake();
      else if (a === "open-project") { const i = parseInt(el.dataset.index, 10); setView("project", () => renderProjectDetail(i)); }
      else if (a === "close-snake") closeSnake();
      else if (a === "stars") { renderStars(); $("stars-panel").hidden = false; }
      else if (a === "close-stars") $("stars-panel").hidden = true;
      return;
    }
    if (e.target.classList.contains("modal")) { e.target.hidden = true; running = false; return; }
    if (view === "home" && !(drag && drag.moved > 6)) burst(e.clientX, e.clientY, 12);
  });

  window.addEventListener("resize", layout);

  /* ------------------------------------------------------------------
   * Loop
   * ------------------------------------------------------------------ */
  let lastNow = performance.now();
  function tick(now) {
    const dt = Math.min(64, now - lastNow);
    lastNow = now;
    if (view === "home") {
      angle += (targetAngle - angle) * (reduceMotion ? 1 : 0.1);
      if (Math.abs(targetAngle - angle) < 0.01) angle = targetAngle;
      renderRing();
      updateEyes();
    }
    if (running) {
      stepT += dt;
      const speed = Math.max(70, 150 - score * 4);
      while (stepT > speed && running) { stepT -= speed; stepSnake(); }
    } else stepT = 0;
    drawPixels();
    requestAnimationFrame(tick);
  }

  layout();
  placePicks();
  renderStars();
  resetSnake();
  renderRing();
  requestAnimationFrame(tick);
})();
