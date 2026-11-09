(() => {
  "use strict";

  const PROJECTS = window.PROJECTS || [];
  const $ = (id) => document.getElementById(id);
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isSmall = () => innerWidth < 760;
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

  /* ------------------------------------------------------------------
   * Storage (per visitor, best effort)
   * ------------------------------------------------------------------ */
  const store = {
    get(k, d) { try { const v = localStorage.getItem("sasha:" + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem("sasha:" + k, JSON.stringify(v)); } catch (e) { /* private mode */ } }
  };

  /* ------------------------------------------------------------------
   * Sound — synthesized 8-bit blips, off until the visitor turns it on
   * ------------------------------------------------------------------ */
  let soundOn = store.get("sound", false);
  let actx = null;
  function blip(freq, dur, type, vol, slide) {
    if (!soundOn) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const t = actx.currentTime;
      const o = actx.createOscillator();
      const g = actx.createGain();
      o.type = type || "square";
      o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
      g.gain.setValueAtTime(vol || 0.05, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(actx.destination);
      o.start(t);
      o.stop(t + dur + 0.02);
    } catch (e) { /* audio unavailable */ }
  }
  const seq = (notes, gap, type, vol) => notes.forEach((f, i) => setTimeout(() => blip(f, gap / 1000 * 1.4, type || "square", vol || 0.04), i * gap));
  const sfx = {
    tick: () => blip(1400, 0.03, "square", 0.022),
    click: () => blip(520, 0.06, "square", 0.04, 760),
    open: () => seq([392, 523, 659], 55, "square", 0.04),
    close: () => seq([659, 523, 392], 45, "square", 0.035),
    min: () => blip(700, 0.12, "triangle", 0.06, 200),
    poke: () => blip(240, 0.12, "triangle", 0.08, 160),
    star: () => seq([784, 988, 1175, 1568], 70, "square", 0.045),
    eat: () => blip(880, 0.06, "square", 0.04, 1320),
    die: () => blip(300, 0.4, "sawtooth", 0.05, 60),
    boot: () => seq([523, 659, 784, 1047, 784, 1047], 110, "triangle", 0.06),
    error: () => seq([220, 220], 140, "square", 0.05)
  };
  const soundBtn = $("tray-sound");
  function setSound(on) {
    soundOn = on;
    store.set("sound", on);
    soundBtn.textContent = on ? "🔊" : "🔇";
    soundBtn.setAttribute("aria-pressed", String(on));
    soundBtn.title = on ? "Sound on" : "Sound off";
    renderStartMenu();
  }
  soundBtn.addEventListener("click", (e) => { e.stopPropagation(); setSound(!soundOn); sfx.click(); });

  /* ------------------------------------------------------------------
   * Pixel layer — cursor trail and click bursts
   * ------------------------------------------------------------------ */
  const pc = $("pixels");
  const px = pc.getContext("2d");
  const CELL = 12;
  const parts = [];
  function sizePixels() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    pc.width = Math.round(innerWidth * dpr);
    pc.height = Math.round(innerHeight * dpr);
    px.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  let lastTrail = "";
  function trail(x, y) {
    if (reduceMotion) return;
    const gx = Math.floor(x / CELL) * CELL, gy = Math.floor(y / CELL) * CELL;
    const key = gx + ":" + gy;
    if (key === lastTrail) return;
    lastTrail = key;
    parts.push({ x: gx, y: gy, vx: 0, vy: 0, life: 1, decay: 0.035, c: Math.random() < 0.25 ? "238,236,240" : "215,163,189", snap: true });
  }
  function burst(x, y, n, color) {
    if (reduceMotion) return;
    for (let i = 0; i < (n || 14); i++) {
      const a = Math.random() * Math.PI * 2, s = 2 + Math.random() * 5;
      parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 2, life: 1, decay: 0.02 + Math.random() * 0.02, c: color || (Math.random() < 0.5 ? "255,255,255" : (Math.random() < 0.5 ? "215,163,189" : "35,38,79")), g: 0.25 });
    }
  }
  function drawPixels() {
    px.clearRect(0, 0, innerWidth, innerHeight);
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.x += p.vx; p.y += p.vy; if (p.g) p.vy += p.g;
      p.life -= p.decay;
      if (p.life <= 0) { parts.splice(i, 1); continue; }
      px.fillStyle = "rgba(" + p.c + "," + (p.snap ? p.life * 0.55 : p.life).toFixed(3) + ")";
      if (p.snap) px.fillRect(p.x + 1, p.y + 1, CELL - 2, CELL - 2);
      else px.fillRect(Math.round(p.x / 6) * 6, Math.round(p.y / 6) * 6, 6, 6);
    }
  }

  /* ------------------------------------------------------------------
   * Balloon notifications
   * ------------------------------------------------------------------ */
  let balloonT = null;
  function balloon(title, text) {
    const b = $("balloon");
    b.innerHTML = "";
    b.append(h("b", null, title), h("span", null, text || ""));
    b.classList.add("show");
    clearTimeout(balloonT);
    balloonT = setTimeout(() => b.classList.remove("show"), 3200);
  }

  /* ------------------------------------------------------------------
   * Stars (collectibles)
   * ------------------------------------------------------------------ */
  const STARS = [
    { id: "corner", hint: "Lying around on the desktop" },
    { id: "drift", hint: "Floating somewhere on the right" },
    { id: "trash", hint: "Someone threw one away" },
    { id: "readme", hint: "At the bottom of about_me.txt" },
    { id: "poke", hint: "Poke the face five times" },
    { id: "reader", hint: "Read any project to the very end" },
    { id: "snake", hint: "Eat 10 ✦ in snake.exe" }
  ];
  let got = store.get("stars", []);
  if (!Array.isArray(got)) got = [];
  function renderStarCount() {
    $("stars-count").textContent = String(got.length);
    $("stars-total").textContent = String(STARS.length);
    if (wins.stars) fillStars(wins.stars.body);
  }
  function collect(id, x, y) {
    if (got.includes(id)) return false;
    got.push(id);
    store.set("stars", got);
    renderStarCount();
    sfx.star();
    if (x != null) burst(x, y, 26);
    const t = $("tray-stars");
    t.classList.remove("bump"); void t.offsetWidth; t.classList.add("bump");
    if (got.length >= STARS.length) balloon("✦ All " + STARS.length + " stars found", "Open stars.txt for your reward.");
    else balloon("✦ Star found", got.length + " of " + STARS.length + " collected.");
    return true;
  }
  function starPick(id, cls, style) {
    const b = h("button", "star-pick" + (cls ? " " + cls : ""), "✦");
    b.type = "button";
    b.dataset.star = id;
    b.setAttribute("aria-label", "Hidden star");
    if (style) b.setAttribute("style", style);
    return b;
  }
  function placeDesktopStars() {
    [["corner", "right: 2.4vw; bottom: 54px;"], ["drift", "right: 9vw; top: 46vh;"]].forEach(([id, style]) => {
      if (!got.includes(id)) $("desktop").appendChild(starPick(id, "", style));
    });
  }

  /* ------------------------------------------------------------------
   * Window manager
   * ------------------------------------------------------------------ */
  const wins = {};
  let zTop = 100;
  let cascade = 0;
  const winLayer = $("windows");
  const tasks = $("tasks");

  /* ------------------------------------------------------------------
   * Pixel reveal: things appear through a grid of pastel pixels that
   * blink away in random order.
   * ------------------------------------------------------------------ */
  const PIX_COLORS = ["#b4a7dd", "#c1b6e6", "#e3ddf4", "#f6f3fa", "#d7a3bd", "#2e2452"];
  function pixelCover(el, opts) {
    if (reduceMotion || !el) return;
    const o = Object.assign({ cell: 14, dur: 520, delay: 0, fixed: false }, opts || {});
    const W = o.fixed ? innerWidth : el.offsetWidth, H = o.fixed ? innerHeight : el.offsetHeight;
    if (!W || !H) return;
    const cv = h("canvas", "pix-cover");
    const cols = Math.ceil(W / o.cell), rows = Math.ceil(H / o.cell);
    cv.width = cols; cv.height = rows;
    if (o.fixed) cv.classList.add("fixed");
    else if (getComputedStyle(el).position === "static") el.style.position = "relative";
    const x = cv.getContext("2d");
    const cells = [];
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      // mostly the light tones, a few pink and ink pixels
      const r = Math.random();
      x.fillStyle = r < 0.04 ? PIX_COLORS[5] : r < 0.14 ? PIX_COLORS[4] : PIX_COLORS[Math.floor(Math.random() * 4)];
      x.fillRect(i, j, 1, 1);
      cells.push(i, j);
    }
    for (let k = cells.length / 2 - 1; k > 0; k--) {
      const m = Math.floor(Math.random() * (k + 1));
      [cells[2 * k], cells[2 * m]] = [cells[2 * m], cells[2 * k]];
      [cells[2 * k + 1], cells[2 * m + 1]] = [cells[2 * m + 1], cells[2 * k + 1]];
    }
    (o.fixed ? document.body : el).appendChild(cv);
    const n = cells.length / 2;
    let done = 0, t0 = null;
    function step(now) {
      if (t0 === null) t0 = now + o.delay;
      const p = Math.max(0, Math.min(1, (now - t0) / o.dur));
      const target = Math.floor(n * p * p * (3 - 2 * p));
      for (; done < target; done++) x.clearRect(cells[2 * done], cells[2 * done + 1], 1, 1);
      if (p < 1) requestAnimationFrame(step); else cv.remove();
    }
    requestAnimationFrame(step);
  }

  function zoomFrom(fromRect, toRect, reverse, done) {
    if (reduceMotion || !fromRect) { done && done(); return; }
    const z = h("div", "zoom-rect");
    document.body.appendChild(z);
    const steps = 6;
    let i = 0;
    const a = reverse ? toRect : fromRect, b = reverse ? fromRect : toRect;
    (function frame() {
      const t = i / steps;
      z.style.left = (a.left + (b.left - a.left) * t) + "px";
      z.style.top = (a.top + (b.top - a.top) * t) + "px";
      z.style.width = (a.width + (b.width - a.width) * t) + "px";
      z.style.height = (a.height + (b.height - a.height) * t) + "px";
      if (i++ < steps) setTimeout(frame, 22);
      else { z.remove(); done && done(); }
    })();
  }

  function focusWin(id) {
    Object.keys(wins).forEach((k) => {
      const on = k === id;
      wins[k].el.classList.toggle("is-active", on);
      wins[k].task.classList.toggle("is-active", on && !wins[k].el.classList.contains("is-min"));
    });
    if (wins[id]) wins[id].el.style.zIndex = String(++zTop);
  }

  function createWin(o) {
    const el = h("div", "win" + (o.full ? " app" : ""));
    el.dataset.win = o.id;
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-label", o.title);
    const bar = h("div", "win-bar");
    const title = h("span", "win-title");
    if (o.icon) { const im = h("img"); im.src = o.icon; im.alt = ""; title.appendChild(im); }
    title.append(o.title);
    const btns = h("span", "win-btns");
    const bMin = h("button", null, "_"); bMin.type = "button"; bMin.setAttribute("aria-label", "Minimise");
    const bMax = h("button", null, "□"); bMax.type = "button"; bMax.setAttribute("aria-label", "Maximise");
    const bClose = h("button", null, "×"); bClose.type = "button"; bClose.setAttribute("aria-label", "Close");
    btns.append(bMin, bMax, bClose);
    bar.append(title, btns);
    el.appendChild(bar);
    if (o.menu) {
      const m = h("div", "win-menu");
      o.menu.forEach((t) => m.appendChild(h("span", null, t)));
      el.appendChild(m);
    }
    const body = h("div", "win-body" + (o.flat ? " flat" : ""));
    el.appendChild(body);
    let status = null;
    if (o.status) {
      status = h("div", "win-status");
      o.status.forEach((t) => status.appendChild(h("span", null, t)));
      el.appendChild(status);
    }

    // size + position (cascade from centre)
    const W = Math.min(o.w || 560, innerWidth - 24);
    const H = o.h === "auto" ? 0 : Math.min(o.h || 420, innerHeight - 64);
    const off = isSmall() ? 0 : 1;
    const x = Math.max(8, Math.min(innerWidth - W - 8, (innerWidth - W) / 2 + ((o.dx || 0) + cascade * 26) * off));
    const Hc = H || 360;
    const y = Math.max(8, Math.min(innerHeight - Hc - 48, (innerHeight - 40 - Hc) / 2 + ((o.dy || 0) + cascade * 22) * off));
    cascade = (cascade + 1) % 6;
    Object.assign(el.style, { left: x + "px", top: y + "px", width: W + "px", height: H ? H + "px" : "auto", visibility: "hidden" });
    winLayer.appendChild(el);
    if (!H) {
      requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        if (r.bottom > innerHeight - 48) el.style.top = Math.max(8, innerHeight - 48 - r.height) + "px";
      });
    }

    // taskbar button
    const task = h("button", "task");
    task.type = "button";
    if (o.icon) { const im = h("img"); im.src = o.icon; im.alt = ""; im.style.cssText = "width:14px;height:14px"; task.appendChild(im); }
    task.appendChild(h("span", null, o.title));
    tasks.appendChild(task);

    const w = { id: o.id, el, body, status, task, onClose: o.onClose };
    wins[o.id] = w;

    o.fill(body, w);

    const toRect = el.getBoundingClientRect();
    zoomFrom(o.from, toRect, false, () => { el.style.visibility = ""; pixelCover(el, { cell: 16, dur: 420 }); focusWin(o.id); if (o.after) o.after(w); });
    sfx.open();

    el.addEventListener("pointerdown", () => focusWin(o.id));
    bClose.addEventListener("click", (e) => { e.stopPropagation(); closeWin(o.id); });
    bMin.addEventListener("click", (e) => { e.stopPropagation(); minWin(o.id); });
    bMax.addEventListener("click", (e) => { e.stopPropagation(); el.classList.toggle("is-max"); sfx.click(); });
    bar.addEventListener("dblclick", (e) => { if (!e.target.closest("button")) el.classList.toggle("is-max"); });
    task.addEventListener("click", () => {
      if (el.classList.contains("is-min")) { el.classList.remove("is-min"); focusWin(o.id); sfx.open(); }
      else if (el.classList.contains("is-active")) minWin(o.id);
      else focusWin(o.id);
    });

    // drag by the title bar (not on phones, where windows are full screen)
    let drag = null;
    bar.addEventListener("pointerdown", (e) => {
      if (e.target.closest("button") || isSmall() || el.classList.contains("is-max")) return;
      drag = { dx: e.clientX - el.offsetLeft, dy: e.clientY - el.offsetTop };
      bar.setPointerCapture(e.pointerId);
    });
    bar.addEventListener("pointermove", (e) => {
      if (!drag) return;
      const nx = Math.max(-el.offsetWidth + 80, Math.min(innerWidth - 80, e.clientX - drag.dx));
      const ny = Math.max(0, Math.min(innerHeight - 70, e.clientY - drag.dy));
      el.style.left = nx + "px";
      el.style.top = ny + "px";
    });
    bar.addEventListener("pointerup", () => { drag = null; });
    return w;
  }

  function minWin(id) {
    const w = wins[id];
    if (!w) return;
    sfx.min();
    zoomFrom(w.el.getBoundingClientRect(), w.task.getBoundingClientRect(), false, null);
    w.el.classList.add("is-min");
    w.el.classList.remove("is-active");
    w.task.classList.remove("is-active");
  }
  function closeWin(id) {
    const w = wins[id];
    if (!w) return;
    sfx.close();
    if (w.onClose) w.onClose();
    zoomFrom(w.el.getBoundingClientRect(), w.task.getBoundingClientRect(), false, null);
    w.el.remove();
    w.task.remove();
    delete wins[id];
  }

  /* ------------------------------------------------------------------
   * Apps
   * ------------------------------------------------------------------ */
  function openApp(app, from) {
    const id = app;
    if (wins[id]) {
      wins[id].el.classList.remove("is-min");
      focusWin(id);
      return wins[id];
    }
    closeStart();
    const fromRect = from && from.getBoundingClientRect ? from.getBoundingClientRect() : null;
    if (app.startsWith("project:")) return openProject(parseInt(app.split(":")[1], 10), fromRect);
    if (app === "about") return openAbout(fromRect);
    if (app === "archive") return openArchive(fromRect);
    if (app === "snake") return openSnake(fromRect);
    if (app === "stars") return openStars(fromRect);
    if (app === "trash") return openTrash(fromRect);
    return null;
  }

  const slug = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

  function openProject(i, from) {
    const p = PROJECTS[i];
    if (!p) return null;
    return createWin({
      id: "project:" + i,
      title: p.index + "_" + slug(p.title) + ".doc",
      icon: "assets/chrome-folder.png",
      w: 900, h: 640, from, full: true,
      menu: ["File", "Edit", "View", "Help"],
      status: [p.chapters.length + " chapters", p.status],
      fill(body, w) {
        const doc = h("div", "doc");
        const head = h("header", "doc-head");
        head.append(h("div", "doc-index", p.index + " / " + String(PROJECTS.length).padStart(2, "0")), h("h1", "doc-title", p.title));
        const meta = h("div", "doc-meta");
        [["YEAR", p.year], ["COURSE", p.course], ["ROLE", p.role], ["STATUS", p.status]].forEach(([l, v]) => {
          const d = h("div"); d.append(h("b", null, l), document.createTextNode(v)); meta.appendChild(d);
        });
        head.appendChild(meta);
        doc.appendChild(head);
        p.chapters.forEach((c) => {
          const s = h("section", "chap");
          const body2 = h("div");
          body2.append(h("h2", null, c.title), h("p", null, c.text));
          if (c.media && c.media.length) {
            const m = h("div", "chap-media");
            c.media.forEach((md) => {
              const f = h("figure");
              const box = h("div", "mb " + md.kind);
              if (md.img) { const im = h("img"); im.src = md.img; im.alt = md.label; im.loading = "lazy"; box.appendChild(im); }
              f.append(box, h("figcaption", null, md.label));
              m.appendChild(f);
            });
            body2.appendChild(m);
          }
          s.append(h("div", "chap-n", c.n), body2);
          doc.appendChild(s);
        });
        const end = h("div", "doc-end");
        end.append(h("span", null, "— end of " + p.index + " —"), h("span", null, i < PROJECTS.length - 1 ? "next: " + PROJECTS[i + 1].title : "that's all for now"));
        doc.appendChild(end);
        body.appendChild(doc);
        body.addEventListener("scroll", () => {
          if (body.scrollTop + body.clientHeight >= body.scrollHeight - 30) {
            const r = body.getBoundingClientRect();
            if (collect("reader", r.left + r.width / 2, r.bottom - 30)) end.firstChild.textContent = "✦ you read to the end — star found";
          }
        }, { passive: true });
      }
    });
  }

  function openAbout(from) {
    return createWin({
      id: "about", title: "about_me.txt", icon: "assets/chrome-mark.png", w: 600, h: 600, from, full: true,
      menu: ["File", "Edit", "Format", "Help"],
      fill(body) {
        // a tiny desktop with the tamagotchi hanging on it
        const desk = h("div", "about-desk");
        desk.innerHTML = '<div class="ad-grid"></div><i class="ad-spark" style="left:12%;top:18%">✦</i><i class="ad-spark p" style="left:80%;top:62%">✦</i><i class="ad-spark" style="left:72%;top:14%;font-size:12px">✦</i>' +
          '<div class="ad-icon" style="left:14px;top:14px"><span class="ad-ico">▤</span><span>cv.pdf</span></div>' +
          '<div class="ad-icon" style="left:14px;top:84px"><span class="ad-ico">✉</span><span>say_hi</span></div>' +
          '<div class="ad-bubble">hi, it\u2019s me ✦<br>feed me attention</div>' +
          '<img class="ad-tama" src="assets/tamagotchi-with-me.png" alt="A silver Tamagotchi keychain with my photo on its screen">' +
          '<div class="ad-bar"><span>✦ start</span><span>sasha_pet.exe</span><span class="ad-clock">♥ 100%</span></div>';
        const tama = desk.querySelector(".ad-tama");
        tama.addEventListener("click", () => { tama.classList.remove("boop"); void tama.offsetWidth; tama.classList.add("boop"); sfx.poke(); const r = tama.getBoundingClientRect(); burst(r.left + r.width / 2, r.top + r.height * 0.6, 10, "215,163,189"); });
        desk.querySelector(".ad-icon").addEventListener("dblclick", () => balloon("cv.pdf", "ask me for it: aleksandraslahova88@gmail.com"));
        desk.querySelectorAll(".ad-icon")[1].addEventListener("dblclick", () => { location.href = "mailto:aleksandraslahova88@gmail.com"; });
        body.appendChild(desk);
        const n = h("div", "notepad");
        const split = h("div", "about-split");
        const txt = h("div");
        txt.append(
          h("p", null, "hi, I'm Sasha (Aleksandra) ✦"),
          h("p", null, "Digital & Product Designer with 4+ years across agency, product and freelance work: UI/UX, responsive design, brand and design systems for clients in fintech, gaming, real estate and editorial."),
          h("p", null, "Currently enrolled in the MA Digital Design / Interaction Design at HvA, using this site to sharpen the practice, communicate it clearly, and open the next role.")
        );
        const links = h("p", "links");
        [["mailto:aleksandraslahova88@gmail.com", "aleksandraslahova88@gmail.com"], ["https://www.instagram.com/aleeeksanndraa/", "Instagram"], ["https://www.linkedin.com/in/aleksandra-slahova-461826264/", "LinkedIn"]].forEach(([href, t]) => {
          const a = h("a", null, t); a.href = href; if (href.startsWith("http")) { a.target = "_blank"; a.rel = "noopener"; } links.appendChild(a);
        });
        txt.appendChild(links);
        split.append(txt);
        n.appendChild(split);
        const tail = h("p", null, "\n\n\n\n");
        tail.style.cssText = "margin-top:60vh;color:#a9abc9";
        tail.append("psst. ", got.includes("readme") ? "you already found this one." : "");
        if (!got.includes("readme")) tail.appendChild(starPick("readme", "inside"));
        n.appendChild(tail);
        body.appendChild(n);
      }
    });
  }

  function openArchive(from) {
    return createWin({
      id: "archive", title: "C:\\Projects", icon: "assets/chrome-folder.png", w: 640, h: 360, from, dx: -40, dy: -20, full: true,
      menu: ["File", "Edit", "View", "Go", "Favorites", "Help"],
      status: [PROJECTS.length + " object(s)", "process book"],
      fill(body) {
        const t = h("table", "explorer");
        const hr = h("tr");
        ["Name", "Course", "Year", "Status"].forEach((x) => hr.appendChild(h("th", null, x)));
        const thead = h("thead"); thead.appendChild(hr); t.appendChild(thead);
        const tb = h("tbody");
        PROJECTS.forEach((p, i) => {
          const tr = h("tr", "row");
          tr.tabIndex = 0;
          const td = h("td");
          const im = h("img"); im.src = "assets/chrome-folder.png"; im.alt = "";
          td.append(im, p.index + "_" + slug(p.title));
          tr.append(td, h("td", null, p.course.split("(")[0].trim()), h("td", null, p.year), h("td", null, p.status.split("—")[0].trim()));
          const go = () => openApp("project:" + i, tr);
          tr.addEventListener("dblclick", go);
          tr.addEventListener("click", () => { if (isSmall()) go(); else sfx.click(); });
          tr.addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
          tb.appendChild(tr);
        });
        const more = h("tr", "muted");
        more.append(h("td", null, String(PROJECTS.length + 1).padStart(2, "0") + "_coming_soon"), h("td", null, "—"), h("td", null, "—"), h("td", null, "—"));
        tb.appendChild(more);
        t.appendChild(tb);
        body.appendChild(t);
        body.appendChild(h("div", "snake-tip", isSmall() ? "  tap a folder to open it" : "  double-click a folder to open it")).style.padding = "10px 8px";
      }
    });
  }

  function fillStars(body) {
    body.innerHTML = "";
    const ul = h("ul", "stars-list");
    STARS.forEach((s) => ul.appendChild(h("li", got.includes(s.id) ? "got" : "", (got.includes(s.id) ? "✦  " : "·  ") + s.hint)));
    const note = h("div", "stars-note");
    if (got.length >= STARS.length) {
      note.append("All found. You clearly have time to spare — ");
      const a = h("a", null, "say hi");
      a.href = "mailto:aleksandraslahova88@gmail.com?subject=I%20found%20all%20the%20stars";
      note.append(a, " and tell me which one was hardest.");
    } else note.textContent = got.length + " of " + STARS.length + " found. Collect them all to unlock a little something.";
    body.append(ul, note);
  }
  function openStars(from) {
    return createWin({ id: "stars", title: "stars.txt", w: 380, h: 330, from, dx: 180, dy: -60, fill: fillStars });
  }

  function openTrash(from) {
    return createWin({
      id: "trash", title: "Recycle Bin", w: 420, h: 260, from, dx: -120, dy: 40,
      status: ["3 object(s)", "Empty Recycle Bin"],
      fill(body) {
        const b = h("div", "trash-body");
        const files = [["▤", "metal_card_v1.fig", () => balloon("metal_card_v1.fig", "The aluminium badge never happened. Acrylic did — see 01 Custom Badge.")], ["▦", "moodboard_old_FINAL_final2.png", () => balloon("Error", "This file is too embarrassing to open.")]];
        files.forEach(([ico, name, fn]) => {
          const f = h("button", "file");
          f.type = "button";
          f.append(h("i", null, ico), h("span", null, name));
          f.addEventListener("click", () => { sfx.error(); fn(); });
          b.appendChild(f);
        });
        const s = h("div", "file");
        if (!got.includes("trash")) s.appendChild(starPick("trash", "inside"));
        else s.appendChild(h("i", null, "·"));
        s.appendChild(h("span", null, got.includes("trash") ? "(rescued)" : "star.png"));
        b.appendChild(s);
        body.appendChild(b);
      }
    });
  }

  /* ---------- snake ---------- */
  let snakeApi = null;
  function openSnake(from) {
    return createWin({
      id: "snake", title: "snake.exe", w: 300, h: "auto", from, dx: 220, dy: -40, flat: true,
      onClose() { if (snakeApi) snakeApi.stop(); snakeApi = null; },
      fill(body) {
        const app = h("div", "snake-app");
        const lcd = h("div", "lcd");
        const cv = h("canvas"); cv.width = 240; cv.height = 240;
        const msg = h("div", "lcd-msg"); msg.innerHTML = "PRESS SPACE<br>OR TAP TO START";
        lcd.append(cv, msg);
        const sc = h("div", "snake-score");
        const sS = h("b", null, "0"), sB = h("b", null, String(store.get("snake-best", 0)));
        const s1 = h("span", null, "SCORE "), s2 = h("span", null, "BEST ");
        s1.appendChild(sS); s2.appendChild(sB); sc.append(s1, s2);
        const pad = h("div", "pad");
        [["up", "▲"], ["left", "◀"], ["down", "▼"], ["right", "▶"]].forEach(([d, t]) => {
          const b = h("button", null, t); b.type = "button"; b.dataset.dir = d; b.setAttribute("aria-label", d); pad.appendChild(b);
        });
        app.append(lcd, sc, pad, h("div", "snake-tip", "EAT 10 ✦ TO EARN A STAR"));
        body.appendChild(app);
        snakeApi = makeSnake(cv, msg, sS, sB, pad);
      }
    });
  }

  function makeSnake(cv, msg, scoreEl, bestEl, pad) {
    const x = cv.getContext("2d");
    const G = 20, C = cv.width / G;
    let snake, dir, nextDir, food, score, alive = false, running = false, acc = 0, best = store.get("snake-best", 0);
    function reset() {
      snake = [{ x: 8, y: 16 }, { x: 7, y: 16 }, { x: 6, y: 16 }];
      dir = { x: 1, y: 0 }; nextDir = dir; score = 0; alive = true;
      placeFood(); scoreEl.textContent = "0"; draw();
    }
    function placeFood() {
      do { food = { x: Math.floor(Math.random() * G), y: Math.floor(Math.random() * G) }; }
      while (snake.some((s) => s.x === food.x && s.y === food.y));
    }
    function draw() {
      x.fillStyle = "#e3ddf4"; x.fillRect(0, 0, cv.width, cv.height);
      x.fillStyle = "rgba(63,40,113,0.08)";
      for (let i = 0; i < G; i++) for (let j = 0; j < G; j++) x.fillRect(i * C + 1, j * C + 1, C - 2, C - 2);
      x.fillStyle = "#2e2452";
      const fx = food.x * C, fy = food.y * C, u = C / 4;
      x.fillRect(fx + u * 1.5, fy, u, C); x.fillRect(fx, fy + u * 1.5, C, u);
      snake.forEach((s, i) => { const p = i === 0 ? 0 : 1; x.fillRect(s.x * C + p, s.y * C + p, C - p * 2, C - p * 2); });
    }
    function step() {
      dir = nextDir;
      const head = { x: (snake[0].x + dir.x + G) % G, y: (snake[0].y + dir.y + G) % G };
      if (snake.some((s) => s.x === head.x && s.y === head.y)) {
        alive = false; running = false; sfx.die();
        msg.innerHTML = "GAME OVER · " + score + "<br>SPACE / TAP TO RETRY"; msg.hidden = false; return;
      }
      snake.unshift(head);
      if (head.x === food.x && head.y === food.y) {
        score++; sfx.eat(); scoreEl.textContent = String(score);
        if (score > best) { best = score; store.set("snake-best", best); bestEl.textContent = String(best); }
        if (score === 10) { const r = cv.getBoundingClientRect(); collect("snake", r.left + r.width / 2, r.top + r.height / 2); }
        placeFood();
      } else snake.pop();
      draw();
    }
    function start() { if (!alive) reset(); running = true; msg.hidden = true; }
    function setDir(n) {
      const m = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } }[n];
      if (!m || (m.x === -dir.x && m.y === -dir.y)) return;
      nextDir = m;
      if (!running) start();
    }
    pad.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => setDir(b.dataset.dir)));
    let sw = null;
    cv.addEventListener("pointerdown", (e) => { sw = { x: e.clientX, y: e.clientY }; });
    cv.addEventListener("pointerup", (e) => {
      if (!sw) return;
      const dx = e.clientX - sw.x, dy = e.clientY - sw.y; sw = null;
      if (Math.hypot(dx, dy) < 18) { if (!running) start(); return; }
      setDir(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up"));
    });
    reset(); alive = false;
    return {
      key(e) {
        const k = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right", w: "up", s: "down", a: "left", d: "right" }[e.key];
        if (k) { e.preventDefault(); setDir(k); return true; }
        if (e.key === " ") {
          e.preventDefault();
          if (running) { running = false; msg.innerHTML = "PAUSED"; msg.hidden = false; } else start();
          return true;
        }
        return false;
      },
      tick(dt) {
        if (!running) { acc = 0; return; }
        acc += dt;
        const speed = Math.max(70, 150 - score * 4);
        while (acc > speed && running) { acc -= speed; step(); }
      },
      stop() { running = false; }
    };
  }

  /* ---------- welcome dialog (first visit) ---------- */
  function openWelcome() {
    createWin({
      id: "welcome", title: "hello.exe", w: 380, h: "auto", flat: true, dy: -60,
      fill(body, w) {
        const d = h("div", "dialog");
        const face = h("div", "d-face"); const im = h("img"); im.src = "assets/face-cutout.webp"; im.alt = ""; face.appendChild(im);
        const t = h("div");
        t.append(h("b", "d-big", "I am not a robot :)"),
          "Welcome to Sasha OS, my process book. Spin the windows around my head and open a project. " + STARS.length + " ✦ are hidden around.");
        d.append(face, t);
        const bar = h("div", "loadbar"); bar.appendChild(h("i"));
        const act = h("div", "dialog-actions");
        const snd = h("button", "btn98 primary", "sure ♪"); snd.type = "button"; snd.title = "Enter with sound on";
        const ok = h("button", "btn98", "idk"); ok.type = "button"; ok.title = "Enter quietly";
        snd.addEventListener("click", () => { setSound(true); sfx.boot(); closeWin("welcome"); });
        ok.addEventListener("click", () => closeWin("welcome"));
        act.append(snd, ok);
        body.append(d, bar, act);
        setTimeout(() => snd.focus(), 200);
      }
    });
    store.set("welcomed", true);
  }

  /* ------------------------------------------------------------------
   * Start menu
   * ------------------------------------------------------------------ */
  const startBtn = $("start-btn");
  const startMenu = $("start-menu");
  function renderStartMenu() {
    const box = $("sm-items");
    box.innerHTML = "";
    const item = (ico, label, fn) => {
      const b = h("button"); b.type = "button"; b.setAttribute("role", "menuitem");
      b.append(h("span", "sm-ico", ico), label);
      b.addEventListener("click", (e) => { e.stopPropagation(); closeStart(); fn(b); });
      box.appendChild(b);
    };
    PROJECTS.forEach((p, i) => item("▤", p.index + " " + p.title.charAt(0) + p.title.slice(1).toLowerCase(), (b) => openApp("project:" + i, startBtn)));
    box.appendChild(h("div", "sm-sep"));
    item("✎", "About me", () => openApp("about", startBtn));
    item("▣", "All projects", () => openApp("archive", startBtn));
    item("▸", "Snake", () => openApp("snake", startBtn));
    item("✦", "Stars (" + got.length + "/" + STARS.length + ")", () => openApp("stars", startBtn));
    box.appendChild(h("div", "sm-sep"));
    item(soundOn ? "🔊" : "🔇", soundOn ? "Turn sound off" : "Turn sound on", () => { setSound(!soundOn); sfx.click(); });
    item("⏻", "Shut down…", shutDown);
  }
  function closeStart() { startMenu.hidden = true; startBtn.setAttribute("aria-expanded", "false"); }
  startBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const open = startMenu.hidden;
    if (open) renderStartMenu();
    startMenu.hidden = !open;
    startBtn.setAttribute("aria-expanded", String(open));
    sfx.click();
  });
  function shutDown() {
    sfx.close();
    const s = h("div");
    s.style.cssText = "position:fixed;inset:0;z-index:990;background:#b4a7dd;color:#2e2452;display:flex;align-items:center;justify-content:center;text-align:center;font-family:Silkscreen,monospace;font-size:clamp(14px,2.4vw,26px);line-height:1.6;cursor:pointer;padding:16px";
    s.innerHTML = "It's now safe to close this tab.<br><span style='font-size:.6em;color:#fff'>(or click anywhere to start again)</span>";
    s.addEventListener("click", () => { s.remove(); sfx.boot(); });
    document.body.appendChild(s);
  }

  /* ------------------------------------------------------------------
   * Orbit: face window + project windows circling it
   * ------------------------------------------------------------------ */
  const COVERS = {
    "01": { img: "assets/badge-tight.png" },
    "02": { type: "IN //<br>BETWEEN" },
    "03": { type: "TAN<br>DEM" },
    "04": { img: "assets/ei-little-tank-tank.jpg" },
    "05": { type: "PERS<br>ONAL" }
  };
  const CARDS = PROJECTS.map((p, i) => ({ app: "project:" + i, num: p.index, title: p.title, file: p.index + "_" + slug(p.title) + ".doc", meta: p.course.split("(")[0].trim() + " · " + p.year, cover: COVERS[p.index] || { type: p.title } }));
  CARDS.push({ app: "about", num: "ME", title: "ABOUT", file: "about_me.txt", meta: "who's behind the face", cover: { img: "assets/tamagotchi-with-me.png" } });
  CARDS.push({ app: "snake", num: "▸", title: "PLAY SNAKE", file: "snake.exe", meta: "eat 10 ✦ for a star", cover: { snake: true } });
  CARDS.push({ app: "archive", num: "—", title: "ALL PROJECTS", file: "C:\\Projects", meta: "every project as a list", cover: { img: "assets/chrome-folder.png" } });

  const ring = $("ring");
  const N = CARDS.length, STEP = 360 / N;
  let angle = 0, targetAngle = 0, front = -1, radius = 420, radiusY = 220;
  const cardEls = [];

  function drawSnakeIcon(cv, w, hgt) {
    const x = cv.getContext("2d");
    x.fillStyle = "#e3ddf4"; x.fillRect(0, 0, w, hgt);
    x.fillStyle = "#2e2452";
    const oy = Math.floor((hgt - 8) / 2), ox = Math.floor((w - 13) / 2);
    [[0, 3], [1, 3], [2, 3], [3, 3], [3, 4], [3, 5], [4, 5], [5, 5], [6, 5], [6, 6], [6, 7], [7, 7], [8, 7]].forEach(([a, b]) => x.fillRect(ox + a, oy + b, 1, 1));
    x.fillRect(ox + 11, oy, 1, 1); x.fillRect(ox + 10, oy + 1, 3, 1); x.fillRect(ox + 11, oy + 2, 1, 1);
  }
  document.querySelectorAll(".icon-snake").forEach((c) => drawSnakeIcon(c, 16, 16));

  CARDS.forEach((c, i) => {
    const b = h("button", "ring-card");
    b.type = "button";
    b.dataset.card = String(i);
    b.setAttribute("aria-label", c.title + " — " + c.meta);
    const bar = h("div", "win-bar");
    bar.append(h("span", "win-title", c.file));
    const bt = h("span", "win-btns"); bt.innerHTML = "<i>×</i>"; bar.appendChild(bt);
    const body = h("div", "rc-body");
    if (c.cover.img) { const im = h("img"); im.src = c.cover.img; im.alt = ""; body.appendChild(im); }
    else if (c.cover.snake) { const cv = h("canvas"); cv.width = 16; cv.height = 15; drawSnakeIcon(cv, 16, 15); body.appendChild(cv); }
    else { const t = h("div", "rc-type"); t.innerHTML = c.cover.type; body.appendChild(t); }
    b.append(bar, body);
    ring.appendChild(b);
    cardEls.push(b);
  });

  function layout() {
    const w = innerWidth, hh = innerHeight - 40, small = isSmall();
    const cw = Math.round(Math.max(96, Math.min(180, w * 0.13, hh * 0.21)));
    radius = small ? Math.min(w * 0.36, 200) : Math.min(w * 0.34, hh * 0.7, 540);
    radiusY = hh * (small ? 0.27 : 0.315);
    document.documentElement.style.setProperty("--cw", cw + "px");
    document.documentElement.style.setProperty("--fw", Math.round(Math.min(hh * 0.4, w * (small ? 0.56 : 0.24), 340)) + "px");
    sizePixels();
  }

  function renderRing() {
    cardEls.forEach((el, i) => {
      const rel = ((((i * STEP - angle) % 360) + 540) % 360) - 180;
      const rad = rel * Math.PI / 180;
      const depth = Math.cos(rad);
      const sc = 0.56 + 0.44 * ((depth + 1) / 2);
      el.style.transform = "translate(" + (Math.sin(rad) * radius).toFixed(1) + "px," + (depth * radiusY).toFixed(1) + "px) scale(" + sc.toFixed(3) + ") rotate(" + (Math.sin(rad) * -10).toFixed(2) + "deg)";
      el.style.opacity = depth > -0.05 ? "1" : (0.45 + 0.55 * (depth + 1)).toFixed(3);
      el.style.zIndex = String(Math.round((depth + 1) * 50));
      el.style.filter = depth < -0.3 ? "saturate(0.4) blur(1px)" : "none";
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
  function nudge(d) {
    targetAngle += d;
    clearTimeout(snapT);
    snapT = setTimeout(() => { targetAngle = Math.round(targetAngle / STEP) * STEP; }, 140);
  }
  function spinTo(i) {
    const cur = Math.round(targetAngle / STEP);
    let d = ((i - cur) % N + N) % N;
    if (d > N / 2) d -= N;
    targetAngle = (cur + d) * STEP;
  }
  $("cap-meta").parentElement.querySelector(".cap-hint").textContent = isSmall() ? "tap the front window" : "click the front window to open";

  window.addEventListener("wheel", (e) => {
    if (e.target.closest(".win.app, #start-menu")) return;
    e.preventDefault();
    nudge((Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) * 0.12);
  }, { passive: false });

  let drag = null;
  $("orbit").addEventListener("pointerdown", (e) => {
    if (e.target.closest("#face-win")) return;
    drag = { x: e.clientX, moved: 0, start: targetAngle };
  });
  window.addEventListener("pointermove", (e) => {
    look = { x: e.clientX, y: e.clientY };
    lastMove = performance.now();
    if (e.pointerType === "mouse" && !e.target.closest(".win.app")) trail(e.clientX, e.clientY);
    if (!drag) return;
    const dx = e.clientX - drag.x;
    drag.moved = Math.max(drag.moved, Math.abs(dx));
    if (drag.moved > 6) targetAngle = drag.start - dx * 0.25;
  });
  window.addEventListener("pointerup", () => {
    if (!drag) return;
    if (drag.moved > 6) targetAngle = Math.round(targetAngle / STEP) * STEP;
    setTimeout(() => { drag = null; }, 0);
  });

  /* ---------- face: a head-turn video cut into a sprite sheet ----------
     assets/face-turn.webp holds 57 frames (420px each, 10 per row) cut from a
     turning-head video with the background removed. Each frame is tagged with
     its head pose [yaw, pitch] in degrees; we show the frame whose pose is
     closest to "looking at the cursor". */
  const faceWin = $("face-win");
  const faceBody = $("face");
  const hc = $("head-px");
  const hx = hc.getContext("2d");
  const SHEET = { src: "assets/face-turn.webp", size: 420, cols: 10, poses: [[0.2,15.8],[3.8,16.4],[7.8,17.0],[11.0,17.9],[14.0,18.5],[18.2,19.3],[20.3,17.3],[22.8,17.5],[25.8,15.0],[27.3,17.2],[29.4,14.9],[34.5,14.9],[36.7,13.2],[39.1,12.3],[36.5,11.7],[32.3,15.0],[-2.7,15.5],[-5.4,15.3],[-8.1,15.1],[-10.4,15.5],[-13.7,17.3],[-16.1,15.5],[-20.7,14.7],[-24.8,14.9],[-30.2,15.9],[-33.1,15.6],[-33.1,13.8],[-23.5,16.5],[-19.3,15.9],[-12.6,15.7],[1.0,12.0],[1.0,9.0],[1.1,6.9],[0.5,4.4],[0.1,1.7],[0.1,-0.9],[0.2,-2.7],[0.3,17.3],[0.8,14.1],[-1.6,3.8],[-5.4,4.8],[-13.1,2.5],[-17.7,4.7],[-23.9,5.0],[-27.8,3.8],[-37.4,7.8],[-43.7,6.0],[32.3,11.7],[27.2,10.8],[27.4,7.5],[22.9,9.3],[19.0,9.9],[14.7,9.0],[12.2,8.8],[7.9,7.5],[5.1,7.0],[0.9,10.5]] };
  const sheet = new Image(); sheet.src = SHEET.src;
  const NEUTRAL_PITCH = 16;
  let look = { x: innerWidth / 2, y: innerHeight };
  let lastMove = performance.now();   // last time the cursor actually moved
  let tYaw = 0, tPitch = NEUTRAL_PITCH, shown = -1, pokes = 0, pokeReset = null;
  function blink() { /* the video has no blink */ }
  // mosaic: 0 = big blocks, 1 = the clear photo (animated in after loading)
  let mosaic = 0, lastKey = "";
  const mc = document.createElement("canvas"), mx = mc.getContext("2d");
  // draw frame i of a sprite sheet into the head canvas (same size + position for every sheet)
  function blit(img, sh, i, alpha) {
    const s = sh.size, sx = (i % sh.cols) * s, sy = Math.floor(i / sh.cols) * s;
    hx.globalAlpha = alpha == null ? 1 : alpha;
    if (mosaic >= 1) { hx.imageSmoothingEnabled = true; hx.drawImage(img, sx, sy, s, s, 0, 0, hc.width, hc.height); }
    else {
      const n = Math.max(8, Math.round(hc.width * mosaic * mosaic));
      mc.width = n; mc.height = n; mx.clearRect(0, 0, n, n);
      mx.drawImage(img, sx, sy, s, s, 0, 0, n, n);
      hx.imageSmoothingEnabled = false;
      hx.drawImage(mc, 0, 0, n, n, 0, 0, hc.width, hc.height);
    }
    hx.globalAlpha = 1;
  }
  const ready = (img) => img.complete && img.naturalWidth > 0;
  // one frame, or a crossfade between two: layers = [[img, sheet, index, alpha], ...]
  function paint(layers) {
    const key = layers.map((l) => l[1].src + l[2] + ":" + (l[3] == null ? 1 : l[3].toFixed(2))).join("|") + "@" + mosaic;
    if (key === lastKey) return;
    if (!layers.every((l) => ready(l[0]))) return;
    lastKey = key;
    hx.clearRect(0, 0, hc.width, hc.height);
    layers.forEach((l) => blit(l[0], l[1], l[2], l[3]));
  }
  function resolveFace(dur) {
    if (reduceMotion) { mosaic = 1; return; }
    const t0 = performance.now();
    (function step(now) {
      const p = Math.min(1, (now - t0) / dur);
      // step through a few chunky resolutions, like an old image loading
      mosaic = p >= 1 ? 1 : Math.round(p * 7) / 7 * 0.9 + 0.08;
      if (p < 1) requestAnimationFrame(step);
    })(t0);
  }
  // nearest head-turn frame for a pose
  function turnFrame(yaw, pitch) {
    let best = 0, bd = Infinity;
    SHEET.poses.forEach((p, i) => { const d = (p[0] - yaw) ** 2 + 2.2 * (p[1] - pitch) ** 2; if (d < bd) { bd = d; best = i; } });
    return best;
  }

  /* ---------- character state system ----------
     idle      : the head follows the cursor (head-turn sheet)
     settling  : before an emotion, the head eases back to facing forward
     emotion   : a registered emotion plays once; cursor-following is paused
     returning : short crossfade from the emotion's last frame back to idle
     Only one emotion runs at a time, each has its own cooldown. */
  const EMOTIONS = {};
  function registerEmotion(name, def) {
    const e = Object.assign({ fps: 12, cooldown: 6000, fadeIn: 160, fadeOut: 260 }, def);
    if (e.src) { e.img = new Image(); e.img.src = e.src; e.sheet = { src: e.src, size: e.size, cols: e.cols }; }
    e.lastEnd = -Infinity;
    EMOTIONS[name] = e;
  }
  const character = {
    state: "idle", emotion: null, t0: 0,
    busy() { return this.state !== "idle"; },
    play(name) {
      const e = EMOTIONS[name], now = performance.now();
      const cur = this.emotion;
      const interrupting = cur && cur.loop && !e.loop && this.state === "emotion";
      if (!e || (this.busy() && !interrupting) || mosaic < 1 || now - e.lastEnd < e.cooldown) return false;
      if (e.img && !ready(e.img)) return false;
      if (interrupting) cur.lastEnd = now;
      // coming out of the (front-facing) blink loop, skip the settle step
      this.emotion = e; this.state = (e.settle === false || interrupting) ? "emotion" : "settling"; this.t0 = now;
      return true;
    }
  };
  function stepCharacter(now) {
    const r = faceBody.getBoundingClientRect();
    if (!r.width) return;
    const c = character, e = c.emotion;
    let wantYaw = 0, wantPitch = NEUTRAL_PITCH;
    if (c.state === "idle") {
      const dx = look.x - (r.left + r.width / 2), dy = look.y - (r.top + r.height * 0.45);
      const nx = Math.max(-1, Math.min(1, dx / (innerWidth * 0.45)));
      const ny = Math.max(-1, Math.min(1, dy / (innerHeight * 0.45)));
      wantYaw = nx * 38;
      wantPitch = ny < 0 ? NEUTRAL_PITCH + ny * 20 : NEUTRAL_PITCH + ny * 3;
    }
    const ease = reduceMotion ? 1 : (c.state === "settling" ? 0.2 : 0.12);
    tYaw += (wantYaw - tYaw) * ease;
    tPitch += (wantPitch - tPitch) * ease;
    const idleLayer = [sheet, SHEET, turnFrame(tYaw, tPitch), 1];

    // cursor resting (just scrolling / using arrows): look ahead and blink
    if (c.state === "idle" && now - lastMove > IDLE_AFTER && EMOTIONS.idle_blink) character.play("idle_blink");

    if (c.state === "settling") {
      // wait until the head faces forward (or give up waiting after 700ms)
      if ((Math.abs(tYaw) < 3 && Math.abs(tPitch - NEUTRAL_PITCH) < 2) || now - c.t0 > 700) { c.state = "emotion"; c.t0 = now; }
      paint([idleLayer]);
      return;
    }
    if (c.state === "emotion") {
      const el = now - c.t0;
      if (reduceMotion) {
        // no playback: show the expression's key frame as a still, then go back
        paint([[e.img, e.sheet, e.still, 1]]);
        if (el > (e.stillFor || 1800)) { c.state = "returning"; c.t0 = now; }
        return;
      }
      if (e.loop) {
        // loops until the cursor moves again, then hands back to following
        if (lastMove > c.t0) { c.state = "returning"; c.t0 = now; c.loopFrame = Math.floor(el / 1000 * e.fps) % e.frames; return; }
        const lf = reduceMotion ? 0 : Math.floor(el / 1000 * e.fps) % e.frames;
        const fade = reduceMotion ? 1 : Math.min(1, el / e.fadeIn);
        paint(fade < 1 ? [idleLayer, [e.img, e.sheet, lf, fade]] : [[e.img, e.sheet, lf, 1]]);
        return;
      }
      const f = Math.floor(el / 1000 * e.fps);
      if (f >= e.frames) { c.state = "returning"; c.t0 = now; paint([[e.img, e.sheet, e.frames - 1, 1]]); return; }
      const fade = Math.min(1, el / e.fadeIn);
      paint(fade < 1 ? [idleLayer, [e.img, e.sheet, f, fade]] : [[e.img, e.sheet, f, 1]]);
      return;
    }
    if (c.state === "returning") {
      const p = reduceMotion ? 1 : Math.min(1, (now - c.t0) / e.fadeOut);
      const last = e.loop ? (c.loopFrame || 0) : (reduceMotion ? e.still : e.frames - 1);
      paint(p < 1 ? [[e.img, e.sheet, last, 1], [sheet, SHEET, idleLayer[2], p]] : [idleLayer]);
      if (p >= 1) { e.lastEnd = now; c.state = "idle"; c.emotion = null; }
      return;
    }
    paint([idleLayer]);
  }
  // kept under its old name for the main loop
  function updateEyes() { stepCharacter(performance.now()); }

  registerEmotion("sassy_smirk", {
    // 4 s clip: side-eye, mischievous smirk, back to looking forward
    src: "assets/face-smirk.webp", size: 420, cols: 10, frames: 49, fps: 12,
    still: 30, stillFor: 1800, cooldown: 8000
  });

  // idle: front-facing blink loop while the cursor rests
  const IDLE_AFTER = 1600;
  registerEmotion("idle_blink", {
    src: "assets/face-blink.webp", size: 420, cols: 10, frames: 49, fps: 12,
    loop: true, cooldown: 0, fadeIn: 220, fadeOut: 160
  });

  registerEmotion("pout", {
    // 4 s clip: neutral, then a scrunched-up pout; plays when you poke her face
    src: "assets/face-pout.webp", size: 420, cols: 10, frames: 49, fps: 12,
    still: 40, stillFor: 1500, cooldown: 1500, fadeIn: 120, fadeOut: 420, settle: false
  });

  // trigger: hover a project card for 2 s; once per hover
  cardEls.forEach((el) => {
    let timer = null, fired = false;
    el.addEventListener("pointerenter", (ev) => {
      if (ev.pointerType !== "mouse") return;
      clearTimeout(timer);
      if (fired) return;
      timer = setTimeout(() => { fired = character.play("sassy_smirk") || fired; }, 2000);
    });
    el.addEventListener("pointerleave", () => { clearTimeout(timer); timer = null; fired = false; });
  });

  faceBody.addEventListener("click", (e) => {
    e.stopPropagation();
    // another emotion (the smirk) is mid-play: don't stack a second one on top
    if (character.busy() && character.emotion !== EMOTIONS.pout && !character.emotion.loop) return;
    character.play("pout");
    sfx.poke();
    burst(e.clientX, e.clientY, 10, "215,163,189");
    faceWin.classList.remove("poked"); void faceWin.offsetWidth; faceWin.classList.add("poked");
    blink();
    pokes++;
    clearTimeout(pokeReset);
    pokeReset = setTimeout(() => { pokes = 0; }, 2500);
    if (pokes >= 5) { pokes = 0; if (!collect("poke", e.clientX, e.clientY)) balloon("sasha.exe", "ow. okay. you already have that one."); }
    else if (pokes === 3 && !got.includes("poke")) balloon("sasha.exe", "hey—");
  });

  /* ------------------------------------------------------------------
   * Global input
   * ------------------------------------------------------------------ */
  document.addEventListener("click", (e) => {
    if (!e.target.closest("#start-menu, #start-btn")) closeStart();
    const pick = e.target.closest(".star-pick");
    if (pick) {
      const r = pick.getBoundingClientRect();
      collect(pick.dataset.star, r.left + r.width / 2, r.top + r.height / 2);
      const parent = pick.parentElement;
      pick.remove();
      if (parent && parent.classList.contains("file")) parent.querySelector("span").textContent = "(rescued)";
      return;
    }
    const card = e.target.closest(".ring-card");
    if (card) {
      if (drag && drag.moved > 6) return;
      const i = parseInt(card.dataset.card, 10);
      if (i === front) openApp(CARDS[i].app, card);
      else { sfx.click(); spinTo(i); }
      return;
    }
    const opener = e.target.closest("[data-open]");
    if (opener) {
      // desktop icons open on double-click like a real desktop; one tap on phones / keyboard
      if (opener.classList.contains("icon") && e.detail === 1 && !isSmall()) { sfx.click(); return; }
      openApp(opener.dataset.open, opener);
      return;
    }
    if (!e.target.closest(".win, #taskbar") && !(drag && drag.moved > 6)) burst(e.clientX, e.clientY, 12);
  });
  window.addEventListener("keydown", (e) => {
    if (wins.snake && wins.snake.el.classList.contains("is-active") && snakeApi && snakeApi.key(e)) return;
    if (e.key === "Escape") {
      if (!startMenu.hidden) { closeStart(); return; }
      const act = Object.values(wins).find((w) => w.el.classList.contains("is-active") && !w.el.classList.contains("is-min"));
      if (act) closeWin(act.id);
      return;
    }
    if (e.target.closest && e.target.closest(".win.app")) return;
    if (e.key === "ArrowRight") { e.preventDefault(); spinTo((front + 1) % N); }
    if (e.key === "ArrowLeft") { e.preventDefault(); spinTo((front - 1 + N) % N); }
  });
  window.addEventListener("touchmove", (e) => { const t = e.touches[0]; if (t) { look = { x: t.clientX, y: t.clientY }; lastMove = performance.now(); } }, { passive: true });
  window.addEventListener("resize", layout);

  /* ---------- clock ---------- */
  function clock() {
    const d = new Date();
    $("clock").textContent = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  setInterval(clock, 15000);

  /* ------------------------------------------------------------------
   * Loop
   * ------------------------------------------------------------------ */
  const frameLabel = $("frame-label");
  let wasSpinning = false;
  let lastNow = performance.now();
  function tick(now) {
    const dt = Math.min(64, now - lastNow);
    lastNow = now;
    angle += (targetAngle - angle) * (reduceMotion ? 1 : 0.1);
    if (Math.abs(targetAngle - angle) < 0.01) angle = targetAngle;
    renderRing();
    updateEyes();
    if (snakeApi) snakeApi.tick(dt);
    const spinning = Math.abs(targetAngle - angle) > 0.5;
    if (spinning !== wasSpinning) { wasSpinning = spinning; frameLabel.textContent = spinning ? "✦ sasha os 2026 · spinning…" : "♡ sasha os 2026 · online"; }
    drawPixels();
    requestAnimationFrame(tick);
  }

  layout();
  clock();
  setSound(soundOn);
  renderStarCount();
  placeDesktopStars();
  renderRing();
  requestAnimationFrame(tick);
  boot();

  /* ------------------------------------------------------------------
   * Boot: a loading screen that waits for the heavy images, then the
   * desktop appears through pixels.
   * ------------------------------------------------------------------ */
  function boot() {
    const screen = $("boot");
    const bar = $("boot-bar"), pct = $("boot-pct"), line = $("boot-line");
    const LINES = ["waking up…", "polishing the chrome…", "brushing my hair…", "loading projects…", "feeding the tamagotchi…", "almost there ✦"];
    const urls = [SHEET.src, "assets/face-smirk.webp", "assets/face-pout.webp", "assets/face-blink.webp", "assets/face-cutout.webp", "assets/tamagotchi-with-me.png", "assets/chrome-folder.png", "assets/chrome-cursor.png", "assets/pin-silver.png"]
      .concat(CARDS.filter((c) => c.cover.img).map((c) => c.cover.img));
    let loaded = 0;
    const uniq = Array.from(new Set(urls));
    uniq.forEach((u) => { const im = new Image(); im.onload = im.onerror = () => { loaded++; }; im.src = u; });
    const t0 = performance.now(), MIN = reduceMotion ? 300 : 1900;
    let shownP = 0, finished = false;
    (function step(now) {
      const timeP = Math.min(1, (now - t0) / MIN);
      const want = Math.min(timeP, (loaded / uniq.length) * 0.97 + (loaded === uniq.length ? 0.03 : 0));
      shownP += (want - shownP) * 0.18;
      if (want >= 1 && shownP > 0.995) shownP = 1;
      const p = Math.round(shownP * 100);
      bar.style.width = p + "%";
      pct.textContent = String(p).padStart(3, "0") + "%";
      line.textContent = LINES[Math.min(LINES.length - 1, Math.floor(shownP * LINES.length))];
      if (shownP < 1) requestAnimationFrame(step);
      else if (!finished) { finished = true; setTimeout(done, 250); }
    })(t0);
    // never hang on a slow image
    setTimeout(() => { loaded = uniq.length; }, 9000);
    function done() {
      screen.hidden = true;
      document.body.classList.remove("booting");
      sfx.boot();
      pixelCover(document.body, { fixed: true, cell: 22, dur: 900 });
      cardEls.forEach((el, i) => pixelCover(el, { cell: 12, dur: 500, delay: 500 + i * 70 }));
      document.querySelectorAll("#icons .icon").forEach((el, i) => pixelCover(el, { cell: 8, dur: 380, delay: 300 + i * 60 }));
      setTimeout(() => resolveFace(1100), 350);
      if (!store.get("welcomed", false)) setTimeout(openWelcome, 1500);
    }
  }
})();
