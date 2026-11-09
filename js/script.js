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
    zoomFrom(o.from, toRect, false, () => { el.style.visibility = ""; focusWin(o.id); if (o.after) o.after(w); });
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
      id: "about", title: "about_me.txt — Notepad", icon: "assets/chrome-mark.png", w: 560, h: 460, from, full: true,
      menu: ["File", "Edit", "Format", "Help"],
      fill(body) {
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
        const img = h("img"); img.src = "assets/tamagotchi-with-me.png"; img.alt = "Tamagotchi keychain — with me";
        split.append(txt, img);
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
        const face = h("div", "d-face"); const im = h("img"); im.src = "assets/face-pixel.png"; im.alt = ""; face.appendChild(im);
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
    "03": { img: "assets/ei-little-tank-tank.jpg" }
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

  /* ---------- face: the portrait redrawn as pixel art every frame ----------
     The cutout is 840x840. Each frame it is drawn into a tiny canvas (PIX x PIX)
     together with the eye overlay, then shown scaled up with crisp pixels, so the
     moving irises, blinks and sheen all become part of the pixel art. */
  const faceWin = $("face-win");
  const faceBody = $("face");
  const head = $("head");
  const hc = $("head-px");
  const hx = hc.getContext("2d", { willReadFrequently: true });
  const PIX = hc.width, U = PIX / 840;
  const loadImg = (src) => { const im = new Image(); im.src = src; return im; };
  const faceImg = loadImg("assets/face-cutout.webp");
  const EYES = [{ cx: 343, ix: 343, iris: loadImg("assets/iris-l.png") }, { cx: 535, ix: 527, iris: loadImg("assets/iris-r.png") }];
  let look = { x: innerWidth / 2, y: innerHeight };
  let eyeX = 0, eyeY = 0, tiltX = 0, tiltY = 0, pokes = 0, pokeReset = null, blinking = false;
  function blink() { blinking = true; setTimeout(() => { blinking = false; }, 130); }
  (function blinkLoop() { setTimeout(() => { blink(); blinkLoop(); }, 2600 + Math.random() * 3200); })();
  function drawFace() {
    if (!faceImg.complete || !faceImg.naturalWidth) return;
    hx.clearRect(0, 0, PIX, PIX);
    hx.imageSmoothingEnabled = true;
    hx.drawImage(faceImg, 0, 0, PIX, PIX);
    hx.save();
    hx.scale(U, U);
    EYES.forEach((e) => {
      hx.save();
      hx.beginPath(); hx.ellipse(e.cx, 441, 33, 10.5, 0, 0, Math.PI * 2); hx.clip();
      const g = hx.createRadialGradient(e.cx, 444, 2, e.cx, 444, 36);
      g.addColorStop(0, "#b8a5ac"); g.addColorStop(0.6, "#9c868c"); g.addColorStop(1, "#7d6264");
      hx.fillStyle = g; hx.fillRect(e.cx - 45, 418, 90, 46);
      if (e.iris.complete) hx.drawImage(e.iris, e.ix - 18 + eyeX, 423 + eyeY, 36, 36);
      const l = hx.createLinearGradient(0, 418, 0, 464);
      l.addColorStop(0.12, "rgba(42,21,19,0.85)"); l.addColorStop(0.5, "rgba(42,21,19,0)"); l.addColorStop(1, "rgba(90,52,54,0.45)");
      hx.fillStyle = l; hx.fillRect(e.cx - 45, 418, 90, 46);
      if (blinking) { hx.fillStyle = "#86625e"; hx.fillRect(e.cx - 45, 418, 90, 32); hx.fillStyle = "#2e1a15"; hx.fillRect(e.cx - 34, 447, 68, 5); }
      hx.restore();
    });
    hx.restore();
    // lacquer sheen, only on the face pixels
    hx.globalCompositeOperation = "source-atop";
    const sx = PIX * (0.5 - tiltX * 0.45);
    const sh = hx.createLinearGradient(sx - PIX * 0.25, 0, sx + PIX * 0.25, PIX * 0.4);
    sh.addColorStop(0, "rgba(255,255,255,0)"); sh.addColorStop(0.42, "rgba(255,200,230,0.22)"); sh.addColorStop(0.5, "rgba(200,220,255,0.3)"); sh.addColorStop(0.58, "rgba(210,245,255,0.2)"); sh.addColorStop(1, "rgba(255,255,255,0)");
    hx.fillStyle = sh; hx.fillRect(0, 0, PIX, PIX);
    hx.globalCompositeOperation = "source-over";
    // hard pixel edges: no half-transparent blocks
    try {
      const d = hx.getImageData(0, 0, PIX, PIX), a = d.data;
      for (let i = 0; i < a.length; i += 4) { a[i + 3] = a[i + 3] > 110 ? 255 : 0; for (let c = 0; c < 3; c++) a[i + c] = Math.min(255, Math.round(a[i + c] / 20) * 20); }
      hx.putImageData(d, 0, 0);
    } catch (err) { /* canvas tainted when opened from disk: keep soft edges */ }
  }
  function updateEyes() {
    const r = faceBody.getBoundingClientRect();
    if (!r.width) return;
    const dx = look.x - (r.left + r.width / 2), dy = look.y - (r.top + r.height * 0.5);
    const dist = Math.hypot(dx, dy) || 1, k = Math.min(1, dist / 320);
    const ease = reduceMotion ? 1 : 0.16;
    eyeX += ((dx / dist) * 11 * k - eyeX) * ease;
    eyeY += ((dy / dist) * 3 * k - eyeY) * ease;
    const nx = Math.max(-1, Math.min(1, dx / (innerWidth / 2))), ny = Math.max(-1, Math.min(1, dy / (innerHeight / 2)));
    tiltX += (nx - tiltX) * (reduceMotion ? 1 : 0.08);
    tiltY += (ny - tiltY) * (reduceMotion ? 1 : 0.08);
    // whole-pixel shifts only, so the pixel art stays crisp
    if (!reduceMotion) head.style.transform = "translate(" + Math.round(tiltX * 8) + "px," + Math.round(tiltY * 5) + "px)";
    drawFace();
  }
  faceBody.addEventListener("click", (e) => {
    e.stopPropagation();
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
  window.addEventListener("touchmove", (e) => { const t = e.touches[0]; if (t) look = { x: t.clientX, y: t.clientY }; }, { passive: true });
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
  if (!store.get("welcomed", false)) setTimeout(openWelcome, 500);
})();
