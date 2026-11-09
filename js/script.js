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
  const songs = [];   // audio files that must stop when sound is switched off
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
    error: () => seq([220, 220], 140, "square", 0.05),
    pixelOn: () => seq([262, 392, 523, 784, 1047], 60, "square", 0.04),
    pixelOff: () => seq([1047, 784, 523, 392], 50, "square", 0.035)
  };
  const soundBtn = $("tray-sound");
  function setSound(on) {
    soundOn = on;
    if (!on) songs.forEach((a) => a.pause());
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
  // shooting stars across the wallpaper sky, every few seconds
  (function shootingStars() {
    const wp = document.getElementById("wallpaper");
    if (reduceMotion || !wp) return;
    const one = () => {
      if (!document.hidden) {
        const st = h("i", "wp-shoot");
        st.style.left = (35 + Math.random() * 60) + "vw";
        st.style.top = (2 + Math.random() * 28) + "vh";
        st.style.width = (80 + Math.random() * 90) + "px";
        st.style.animationDuration = (1.1 + Math.random() * 0.8) + "s";
        st.addEventListener("animationend", () => st.remove());
        wp.appendChild(st);
      }
      setTimeout(one, 3500 + Math.random() * 5500);
    };
    setTimeout(one, 2500);
  })();
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
    if (got.length >= STARS.length) { balloon("✦ All " + STARS.length + " stars found", "Look at me. New look unlocked."); window.dispatchEvent(new Event("sasha:allstars")); }
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
    if (app === "blocks") return openBlocks(fromRect);
    if (app === "flap") return openFlap(fromRect);
    if (app === "dash") return openDash(fromRect);
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

  /* ---------- blocks.exe: falling blocks in purples, with an 8-bit folk tune ---------- */
  // chiptune player: square-wave lead + triangle bass, scheduled ahead on the audio clock
  const TUNE = (() => {
    const N = (n) => 440 * Math.pow(2, (n - 69) / 12);
    const E5 = 76, B4 = 71, C5 = 72, D5 = 74, A4 = 69, F5 = 77, A5 = 81, G5 = 79, Gs4 = 68;
    // Korobeiniki, a 19th-century Russian folk song (public domain); [midi note or 0 = rest, beats]
    const lead = [
      [E5, 1], [B4, .5], [C5, .5], [D5, 1], [C5, .5], [B4, .5], [A4, 1], [A4, .5], [C5, .5], [E5, 1], [D5, .5], [C5, .5],
      [B4, 1.5], [C5, .5], [D5, 1], [E5, 1], [C5, 1], [A4, 1], [A4, 1], [0, 1],
      [0, .5], [D5, 1], [F5, .5], [A5, 1], [G5, .5], [F5, .5], [E5, 1.5], [C5, .5], [E5, 1], [D5, .5], [C5, .5],
      [B4, 1], [B4, .5], [C5, .5], [D5, 1], [E5, 1], [C5, 1], [A4, 1], [A4, 1], [0, .5]
    ];
    const roots = [52, 52, 45, 45, Gs4 - 24, 52, 45, 45, 50, 50, 48, 48, 47, 52, 45, 45]; // one per 2 beats
    return { lead: lead.map(([n, b]) => [n ? N(n) : 0, b]), bass: roots.map(N) };
  })();
  function makeMusic() {
    let timer = null, nextT = 0, li = 0, bi = 0, leadT = 0, bassT = 0, gain = null;
    const BEAT = 60 / 144;
    function note(f, t, dur, type, vol) {
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = type; o.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(vol, t); g.gain.setValueAtTime(vol, t + dur * 0.8); g.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.98);
      o.connect(g).connect(gain); o.start(t); o.stop(t + dur);
    }
    function pump() {
      const ahead = actx.currentTime + 0.25;
      while (leadT < ahead) {
        const [f, b] = TUNE.lead[li]; if (f) note(f, leadT, b * BEAT, "square", 0.05);
        leadT += b * BEAT; li = (li + 1) % TUNE.lead.length;
      }
      while (bassT < ahead) {
        const r = TUNE.bass[Math.floor(bi / 4) % TUNE.bass.length];
        note(bi % 2 ? r * 2 : r, bassT, BEAT / 2, "triangle", 0.09);
        bassT += BEAT / 2; bi++;
      }
    }
    return {
      play() {
        if (timer || !soundOn) return;
        try {
          actx = actx || new (window.AudioContext || window.webkitAudioContext)();
          if (actx.state === "suspended") actx.resume();
          gain = actx.createGain(); gain.gain.value = 0.8; gain.connect(actx.destination);
          leadT = bassT = actx.currentTime + 0.05; beatZero = performance.now() + 50;
          timer = setInterval(pump, 80); pump();
        } catch (e) { /* audio unavailable */ }
      },
      stop() {
        if (!timer) return;
        clearInterval(timer); timer = null; beatZero = 0;
        try { gain.gain.setTargetAtTime(0, actx.currentTime, 0.03); const g = gain; setTimeout(() => g.disconnect(), 300); } catch (e) { /* ignore */ }
      },
      get on() { return !!timer; }
    };
  }

  let blocksApi = null, beatZero = 0, danced = false;
  // while blocks.exe is open the big head bops along to the 144 bpm tune
  function danceStep(now) {
    const el = document.getElementById("head-px");
    // only while blocks.exe is open AND its tune is actually playing
    if (!blocksApi || !beatZero || now < beatZero || reduceMotion || !el) {
      if (danced && el) { el.style.translate = el.style.rotate = el.style.scale = ""; danced = false; }
      return;
    }
    danced = true;
    const BEAT = 60000 / 144, t = now - beatZero, ph = (t / BEAT) % 1;
    // a hop on every beat: up in an arc, squash when she lands, stretch on the way up
    const up = Math.sin(ph * Math.PI), land = Math.max(0, 1 - ph / 0.18) + Math.max(0, (ph - 0.9) / 0.1);
    const sq = Math.min(1, land) * 0.04, st = up * 0.02;
    el.style.translate = "0 " + (-12 * up).toFixed(1) + "px";
    el.style.rotate = "";
    el.style.scale = (1 + sq - st).toFixed(3) + " " + (1 - sq + st).toFixed(3);
  }

  function openBlocks(from) {
    return createWin({
      id: "blocks", title: "blocks.exe", w: 320, h: "auto", from, dx: -240, dy: -30, flat: true,
      onClose() { if (blocksApi) blocksApi.stop(); blocksApi = null; if (!flapApi) setPixelFace(false); },
      fill(body) {
        const app = h("div", "snake-app blocks-app");
        const row = h("div", "blocks-row");
        const lcd = h("div", "lcd blocks-lcd");
        const cv = h("canvas"); cv.width = 160; cv.height = 320;
        const msg = h("div", "lcd-msg"); msg.innerHTML = "PRESS SPACE<br>OR TAP TO START";
        lcd.append(cv, msg);
        const side = h("div", "blocks-side");
        const nx = h("canvas", "blocks-next"); nx.width = 64; nx.height = 64;
        const sS = h("b", null, "0"), sL = h("b", null, "0"), sB = h("b", null, String(store.get("blocks-best", 0)));
        const stat = (l, el) => { const d = h("div", "blocks-stat"); d.append(h("span", null, l), el); return d; };
        const mus = h("button", "btn98 blocks-music", soundOn ? "♪ on" : "♪ off"); mus.type = "button"; mus.title = "Music";
        side.append(h("span", "blocks-lbl", "NEXT"), nx, stat("SCORE", sS), stat("LINES", sL), stat("BEST", sB), mus);
        row.append(lcd, side);
        const pad = h("div", "pad blocks-pad");
        [["left", "◀"], ["rotate", "⟳"], ["right", "▶"], ["down", "▼"], ["drop", "⤓"]].forEach(([d, t]) => {
          const b = h("button", null, t); b.type = "button"; b.dataset.act = d; b.setAttribute("aria-label", d); pad.appendChild(b);
        });
        app.append(row, pad, h("div", "snake-tip", "← → MOVE · ↑ TURN · ↓ DROP · SPACE SLAM"));
        body.appendChild(app);
        blocksApi = makeBlocks(cv, nx, msg, sS, sL, sB, pad, mus);
        setPixelFace(true);
      }
    });
  }

  function makeBlocks(cv, nxc, msg, scoreEl, linesEl, bestEl, pad, musBtn) {
    const x = cv.getContext("2d"), nx = nxc.getContext("2d");
    const W = 10, H = 20, C = 16;
    // pieces in the desktop's purples
    const SHAPES = {
      I: [[0, 1], [1, 1], [2, 1], [3, 1]], O: [[1, 0], [2, 0], [1, 1], [2, 1]], T: [[1, 0], [0, 1], [1, 1], [2, 1]],
      S: [[1, 0], [2, 0], [0, 1], [1, 1]], Z: [[0, 0], [1, 0], [1, 1], [2, 1]], J: [[0, 0], [0, 1], [1, 1], [2, 1]], L: [[2, 0], [0, 1], [1, 1], [2, 1]]
    };
    const COL = { I: "#b4a7dd", O: "#d7a3bd", T: "#8a6fc4", S: "#c9b8ec", Z: "#a77fb8", J: "#5d4a96", L: "#e3c4dc" };
    const music = makeMusic();
    let grid, cur, next, score, lines, alive = false, running = false, acc = 0, best = store.get("blocks-best", 0), bag = [];
    const draw7 = () => { if (!bag.length) bag = Object.keys(SHAPES).sort(() => Math.random() - 0.5); return bag.pop(); };
    const piece = (k) => ({ k, cells: SHAPES[k].map((c) => c.slice()), x: 3, y: 0 });
    const fits = (cells, ox, oy) => cells.every(([cx, cy]) => { const X = cx + ox, Y = cy + oy; return X >= 0 && X < W && Y < H && (Y < 0 || !grid[Y][X]); });
    function block(ctx, X, Y, col, sz) {
      ctx.fillStyle = col; ctx.fillRect(X, Y, sz, sz);
      ctx.fillStyle = "rgba(255,255,255,0.45)"; ctx.fillRect(X, Y, sz, 2); ctx.fillRect(X, Y, 2, sz);
      ctx.fillStyle = "rgba(46,36,82,0.35)"; ctx.fillRect(X, Y + sz - 2, sz, 2); ctx.fillRect(X + sz - 2, Y, 2, sz);
      ctx.strokeStyle = "#2e2452"; ctx.lineWidth = 1; ctx.strokeRect(X + 0.5, Y + 0.5, sz - 1, sz - 1);
    }
    function draw() {
      x.fillStyle = "#e3ddf4"; x.fillRect(0, 0, cv.width, cv.height);
      x.fillStyle = "rgba(63,40,113,0.07)";
      for (let i = 0; i < W; i++) for (let j = 0; j < H; j++) x.fillRect(i * C + 1, j * C + 1, C - 2, C - 2);
      for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if (grid[j][i]) block(x, i * C, j * C, grid[j][i], C);
      if (cur) {
        let gy = cur.y; while (fits(cur.cells, cur.x, gy + 1)) gy++;
        x.fillStyle = "rgba(46,36,82,0.16)";
        cur.cells.forEach(([cx, cy]) => { if (cy + gy >= 0) x.fillRect((cx + cur.x) * C + 2, (cy + gy) * C + 2, C - 4, C - 4); });
        cur.cells.forEach(([cx, cy]) => { if (cy + cur.y >= 0) block(x, (cx + cur.x) * C, (cy + cur.y) * C, COL[cur.k], C); });
      }
      nx.fillStyle = "#e3ddf4"; nx.fillRect(0, 0, 64, 64);
      if (next) SHAPES[next].forEach(([cx, cy]) => block(nx, 8 + cx * 12, 20 + cy * 12, COL[next], 12));
    }
    function reset() {
      grid = Array.from({ length: H }, () => Array(W).fill(null));
      score = 0; lines = 0; bag = []; next = draw7(); spawn();
      scoreEl.textContent = "0"; linesEl.textContent = "0"; alive = true; draw();
    }
    function spawn() {
      cur = piece(next); next = draw7();
      if (!fits(cur.cells, cur.x, cur.y)) gameOver();
    }
    function gameOver() {
      alive = false; running = false; music.stop(); sfx.die();
      msg.innerHTML = "GAME OVER · " + score + "<br>SPACE / TAP TO RETRY"; msg.hidden = false;
    }
    function lock() {
      cur.cells.forEach(([cx, cy]) => { if (cy + cur.y >= 0) grid[cy + cur.y][cx + cur.x] = COL[cur.k]; });
      let cleared = 0;
      for (let j = H - 1; j >= 0; j--) if (grid[j].every(Boolean)) { grid.splice(j, 1); grid.unshift(Array(W).fill(null)); cleared++; j++; }
      if (cleared) {
        lines += cleared; score += [0, 100, 300, 500, 800][cleared] * (1 + Math.floor(lines / 10));
        sfx.eat(); if (cleared >= 4) sfx.star();
        const r = cv.getBoundingClientRect(); burst(r.left + r.width / 2, r.top + r.height * 0.8, 10 + cleared * 6, "193,182,230");
      } else blip(180, 0.05, "square", 0.03);
      scoreEl.textContent = String(score); linesEl.textContent = String(lines);
      if (score > best) { best = score; store.set("blocks-best", best); bestEl.textContent = String(best); }
      spawn();
    }
    function move(dx) { if (cur && fits(cur.cells, cur.x + dx, cur.y)) { cur.x += dx; sfx.tick(); draw(); } }
    function rotate() {
      if (!cur || cur.k === "O") return;
      const rc = cur.cells.map(([cx, cy]) => [2 - cy, cx]);
      for (const kick of [0, -1, 1, -2, 2]) if (fits(rc, cur.x + kick, cur.y)) { cur.cells = rc; cur.x += kick; blip(660, 0.04, "square", 0.03); draw(); return; }
    }
    function soft() { if (!cur) return; if (fits(cur.cells, cur.x, cur.y + 1)) { cur.y++; acc = 0; } else lock(); draw(); }
    function slam() { if (!cur) return; while (fits(cur.cells, cur.x, cur.y + 1)) { cur.y++; score += 2; } lock(); draw(); }
    function start() { if (!alive) reset(); running = true; msg.hidden = true; music.play(); syncMus(); }
    function pause() { running = false; music.stop(); msg.innerHTML = "PAUSED"; msg.hidden = false; }
    function syncMus() { musBtn.textContent = music.on ? "♪ on" : "♪ off"; }
    function act(a) {
      if (!running) { start(); return; }
      ({ left: () => move(-1), right: () => move(1), rotate, down: soft, drop: slam })[a]();
    }
    musBtn.addEventListener("click", () => {
      if (music.on) music.stop();
      else { if (!soundOn) setSound(true); if (running) music.play(); }
      musBtn.textContent = music.on || (!running && soundOn) ? "♪ on" : "♪ off";
    });
    pad.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => act(b.dataset.act)));
    let sw = null;
    cv.addEventListener("pointerdown", (e) => { sw = { x: e.clientX, y: e.clientY }; });
    cv.addEventListener("pointerup", (e) => {
      if (!sw) return;
      const dx = e.clientX - sw.x, dy = e.clientY - sw.y; sw = null;
      if (!running) { start(); return; }
      if (Math.hypot(dx, dy) < 14) rotate();
      else if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 1 : -1);
      else if (dy > 0) slam();
    });
    reset(); alive = false; cur = null; draw();
    return {
      key(e) {
        const k = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "rotate", ArrowDown: "down", a: "left", d: "right", w: "rotate", s: "down" }[e.key];
        if (k) { e.preventDefault(); if (running) act(k); return true; }
        if (e.key === " ") { e.preventDefault(); if (running) slam(); else start(); return true; }
        if (e.key === "p" || e.key === "P") { if (running) pause(); else if (alive) start(); return true; }
        return false;
      },
      tick(dt) {
        if (!running) { acc = 0; return; }
        acc += dt;
        const speed = Math.max(90, 650 - Math.floor(lines / 10) * 60);
        while (acc > speed && running) { acc -= speed; soft(); }
      },
      stop() { running = false; music.stop(); }
    };
  }

  /* ---------- flap.exe: a flappy game, MLG montage edition (her head is the bird) ---------- */
  const mlg = {
    // synthesized: no sampled audio, all made on the fly
    hit() { blip(1800, 0.05, "square", 0.05, 900); blip(2600, 0.03, "square", 0.03); },
    horn() {
      if (!soundOn) return;
      try {
        actx = actx || new (window.AudioContext || window.webkitAudioContext)();
        const t = actx.currentTime;
        [0, 0.28, 0.56].forEach((d, k) => [233, 294, 349].forEach((f) => {
          const o = actx.createOscillator(), g = actx.createGain();
          o.type = "sawtooth"; o.frequency.setValueAtTime(f, t + d); o.frequency.linearRampToValueAtTime(f * 0.97, t + d + (k === 2 ? 0.6 : 0.22));
          g.gain.setValueAtTime(0.0001, t + d); g.gain.exponentialRampToValueAtTime(0.035, t + d + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, t + d + (k === 2 ? 0.65 : 0.24));
          o.connect(g).connect(actx.destination); o.start(t + d); o.stop(t + d + 0.7);
        }));
      } catch (e) { /* audio unavailable */ }
    },
    flap() { blip(520, 0.07, "triangle", 0.05, 900); },
    wow() { seq([392, 523, 784], 60, "square", 0.04); }
  };
  const FLAP_WORDS = ["WOW", "+1", "OH BABY", "NICE", "MOM GET THE CAMERA", "SICK", "360", "EZ", "CRISP", "OMG"];
  let flapApi = null;
  function openFlap(from) {
    return createWin({
      id: "flap", title: "mlg_flap.exe", w: 300, h: "auto", from, dx: 260, dy: 10, flat: true,
      onClose() { if (flapApi) flapApi.stop(); flapApi = null; setShades(false); if (!blocksApi) setPixelFace(false); },
      fill(body) {
        const app = h("div", "snake-app flap-app");
        const lcd = h("div", "lcd flap-lcd");
        const cv = h("canvas"); cv.width = 240; cv.height = 340;
        const msg = h("div", "lcd-msg"); msg.innerHTML = "SPACE / CLICK TO FLAP<br>GET READY TO GET REKT";
        lcd.append(cv, msg);
        const sc = h("div", "snake-score");
        const sS = h("b", null, "0"), sB = h("b", null, String(store.get("flap-best", 0)));
        const s1 = h("span", null, "SCORE "), s2 = h("span", null, "BEST ");
        s1.appendChild(sS); s2.appendChild(sB); sc.append(s1, s2);
        app.append(lcd, sc, h("div", "snake-tip", "SPACE / CLICK / TAP · SOUND ON FOR MAX MLG"), h("div", "snake-tip", "♪ Bytesize – Dig Dug")); 
        body.appendChild(app);
        flapApi = makeFlap(cv, msg, sS, sB, lcd);
        setPixelFace(true); setTimeout(() => setShades(true), 500);
      }
    });
  }
  function makeFlap(cv, msg, scoreEl, bestEl, lcd) {
    const x = cv.getContext("2d"), W = cv.width, H = cv.height;
    const head = new Image(); head.src = "assets/face-cutout.webp";
    const GAP = 122, PW = 40, SPD = 1.5, GRAV = 0.28, JUMP = -5.2;
    let by, vy, pipes, score, alive = false, running = false, acc = 0, best = store.get("flap-best", 0);
    let fx = [], shake = 0, hue = 0, shades = 0, tri = 0, frame = 0;
    // Bytesize – Dig Dug (Sasha's Monstercat Gold license), from 0:55
    const song = new Audio("assets/flap-dubstep.mp3"); song.loop = true; song.volume = 0.55; song.preload = "none"; songs.push(song);
    const dubs = {
      play() { if (!soundOn) return; song.currentTime = 0; const pr = song.play(); if (pr && pr.catch) pr.catch(() => {}); },
      stop() { song.pause(); }
    };
    function reset() { by = H / 2; vy = 0; pipes = []; score = 0; fx = []; shake = 0; shades = 0; hue = 0; scoreEl.textContent = "0"; addPipe(W + 40); addPipe(W + 40 + 175); draw(); }
    function addPipe(px) { pipes.push({ x: px, gy: 60 + Math.random() * (H - 120 - GAP - 40), done: false }); }
    function pop(text, X, Y, big) { fx.push({ t: text, x: X, y: Y, life: 1, big, hm: false, r: (Math.random() - 0.5) * 0.5 }); }
    function hitmark(X, Y) { fx.push({ hm: true, x: X, y: Y, life: 1 }); }
    function flap() { if (!running) { start(); return; } vy = JUMP; mlg.flap(); }
    function start() { if (!alive) { reset(); alive = true; } running = true; msg.hidden = true; vy = JUMP; dubs.play(); }
    function die() {
      alive = false; running = false; shake = 18; dubs.stop(); mlg.horn(); sfx.die();
      pop("GET REKT", W / 2, H / 2 - 30, true); hitmark(60, by); hitmark(70, by - 12);
      msg.innerHTML = "WASTED · " + score + "<br>SPACE / TAP TO RETRY"; msg.hidden = false;
      lcd.classList.remove("mlg-flash"); void lcd.offsetWidth; lcd.classList.add("mlg-flash");
    }
    function scored() {
      score++; scoreEl.textContent = String(score);
      if (score > best) { best = score; store.set("flap-best", best); bestEl.textContent = String(best); }
      mlg.hit(); hitmark(60 + 18, by - 6); shake = 6; hue = 1;
      pop(FLAP_WORDS[Math.floor(Math.random() * FLAP_WORDS.length)], 70 + Math.random() * 120, 60 + Math.random() * 200, false);
      if (score % 5 === 0) { mlg.horn(); pop(score % 10 === 0 ? "WOMBO COMBO" : "OH BABY A TRIPLE", W / 2, 90, true); tri = 1; shake = 14; }
      if (score === 10) { shades = 1; pop("DEAL WITH IT", W / 2, H - 70, true); }
    }
    function drawPipe(px, y0, y1) {
      const g = x.createLinearGradient(px, 0, px + PW, 0);
      g.addColorStop(0, "#c3c5d0"); g.addColorStop(0.35, "#fbfbfd"); g.addColorStop(0.55, "#a9abb8"); g.addColorStop(1, "#e6e7ee");
      x.fillStyle = g; x.fillRect(px, y0, PW, y1 - y0);
      x.strokeStyle = "#2e2452"; x.lineWidth = 2; x.strokeRect(px + 1, y0 + 1, PW - 2, y1 - y0 - 2);
    }
    function draw() {
      x.save();
      if (shake > 0) x.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
      // sky: lavender, with a rainbow wash after each point
      const sky = x.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, "#cdc3ea"); sky.addColorStop(1, "#e3ddf4");
      x.fillStyle = sky; x.fillRect(-20, -20, W + 40, H + 40);
      if (hue > 0) { x.fillStyle = "hsla(" + (frame * 9 % 360) + ",80%,75%," + (hue * 0.35).toFixed(2) + ")"; x.fillRect(-20, -20, W + 40, H + 40); }
      if (tri > 0) { // the triangle with the eye
        x.globalAlpha = tri * 0.8; x.fillStyle = "#2e2452";
        x.beginPath(); x.moveTo(W / 2, 110); x.lineTo(W / 2 - 50, 196); x.lineTo(W / 2 + 50, 196); x.closePath(); x.fill();
        x.fillStyle = "#f6f3fa"; x.beginPath(); x.ellipse(W / 2, 168, 15, 8, 0, 0, Math.PI * 2); x.fill();
        x.fillStyle = "#2e2452"; x.beginPath(); x.arc(W / 2, 168, 4, 0, Math.PI * 2); x.fill(); x.globalAlpha = 1;
      }
      pipes.forEach((p) => { drawPipe(p.x, -4, p.gy); drawPipe(p.x, p.gy + GAP, H + 4); });
      x.fillStyle = "#b4a7dd"; x.fillRect(-20, H - 10, W + 40, 14);
      // her head, tilting with speed
      x.save(); x.translate(60, by); x.rotate(Math.max(-0.5, Math.min(1.2, vy * 0.08)));
      if (head.complete && head.naturalWidth) x.drawImage(head, -18, -18, 36, 36); else { x.fillStyle = "#6d1d2b"; x.fillRect(-12, -12, 24, 24); }
      if (shades > 0) { x.fillStyle = "#111"; x.fillRect(-13, -6 - (1 - shades) * 40, 11, 5); x.fillRect(1, -6 - (1 - shades) * 40, 11, 5); x.fillRect(-2, -5 - (1 - shades) * 40, 4, 2); }
      x.restore();
      fx.forEach((f) => {
        x.globalAlpha = Math.max(0, f.life);
        if (f.hm) { // hitmarker
          x.strokeStyle = "#fff"; x.lineWidth = 3; const s = 6, g = 3;
          [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => { x.beginPath(); x.moveTo(f.x + a * g, f.y + b * g); x.lineTo(f.x + a * (g + s), f.y + b * (g + s)); x.stroke(); });
          x.strokeStyle = "#2e2452"; x.lineWidth = 1;
          [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => { x.beginPath(); x.moveTo(f.x + a * g, f.y + b * g); x.lineTo(f.x + a * (g + s), f.y + b * (g + s)); x.stroke(); });
        } else {
          x.save(); x.translate(f.x, f.y); x.rotate(f.r); const sz = f.big ? 22 : 15;
          x.font = "900 " + sz + "px Impact, Archivo, sans-serif"; x.textAlign = "center";
          x.lineWidth = 4; x.strokeStyle = "#2e2452"; x.strokeText(f.t, 0, 0);
          x.fillStyle = f.big ? "#fff200" : "hsl(" + (frame * 12 % 360) + ",90%,70%)"; x.fillText(f.t, 0, 0); x.restore();
        }
        x.globalAlpha = 1;
      });
      x.font = "900 34px Impact, Archivo, sans-serif"; x.textAlign = "center"; x.lineWidth = 5; x.strokeStyle = "#2e2452";
      x.strokeText(String(score), W / 2, 44); x.fillStyle = "#fff"; x.fillText(String(score), W / 2, 44);
      x.restore();
    }
    function step() {
      frame++;
      if (running) {
        vy += GRAV; by += vy;
        if (by < 14) { by = 14; vy = Math.max(vy, 0); }   // soft ceiling
        pipes.forEach((p) => { p.x -= SPD + Math.min(0.8, score * 0.03); if (!p.done && p.x + PW < 60 - 14) { p.done = true; scored(); } });
        if (pipes[0].x < -PW) { pipes.shift(); addPipe(pipes[pipes.length - 1].x + 175); }
        const hitPipe = pipes.some((p) => 60 + 11 > p.x && 60 - 11 < p.x + PW && (by - 11 < p.gy || by + 11 > p.gy + GAP));   // forgiving hitbox
        if (by > H - 24 || hitPipe) die();
      }
      fx.forEach((f) => { f.life -= f.hm ? 0.05 : 0.018; if (!f.hm) f.y -= 0.6; });
      fx = fx.filter((f) => f.life > 0);
      shake *= 0.85; if (shake < 0.5) shake = 0;
      hue *= 0.93; tri *= 0.97; if (shades > 0 && shades < 1) shades = Math.min(1, shades + 0.05);
      draw();
    }
    cv.addEventListener("pointerdown", (e) => { e.preventDefault(); flap(); });
    reset(); draw();
    return {
      key(e) { if (e.key === " " || e.key === "ArrowUp" || e.key === "w") { e.preventDefault(); flap(); return true; } return false; },
      tick(dt) { acc += dt; let n = 0; while (acc > 16.7 && n < 4) { acc -= 16.7; step(); n++; } if (n === 4) acc = 0; },
      stop() { running = false; dubs.stop(); }
    };
  }

  /* ---------- beat engine: synthesized drums, wobble bass and leads (no samples) ---------- */
  function makeBeat(kind) {
    const BPM = kind === "dub" ? 140 : 174, S = 60 / BPM / 4;   // one 16th note
    let timer = null, gain = null, t = 0, step = 0, noise = null, t0 = 0;
    const ctx = () => actx;
    function nz() {
      if (noise) return noise;
      const b = actx.createBuffer(1, actx.sampleRate * 0.5, actx.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      return (noise = b);
    }
    function env(g, at, v, dec) { g.gain.setValueAtTime(v, at); g.gain.exponentialRampToValueAtTime(0.0001, at + dec); }
    function kick(at, v) {
      const o = actx.createOscillator(), g = actx.createGain();
      o.frequency.setValueAtTime(160, at); o.frequency.exponentialRampToValueAtTime(38, at + 0.14);
      env(g, at, v || 0.55, 0.3); o.connect(g).connect(gain); o.start(at); o.stop(at + 0.32);
    }
    function hiss(at, v, dec, hp) {
      const s = actx.createBufferSource(), f = actx.createBiquadFilter(), g = actx.createGain();
      s.buffer = nz(); f.type = "highpass"; f.frequency.value = hp; env(g, at, v, dec);
      s.connect(f).connect(g).connect(gain); s.start(at); s.stop(at + dec + 0.02);
    }
    function snare(at, v) { hiss(at, v || 0.3, 0.18, 1400); tone(at, 190, 0.08, "triangle", 0.12); }
    function hat(at, v, open) { hiss(at, v || 0.05, open ? 0.12 : 0.035, 7500); }
    function tone(at, f, dur, type, v, slide) {
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = type; o.frequency.setValueAtTime(f, at); if (slide) o.frequency.exponentialRampToValueAtTime(slide, at + dur);
      g.gain.setValueAtTime(v, at); g.gain.setValueAtTime(v, at + dur * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      o.connect(g).connect(gain); o.start(at); o.stop(at + dur + 0.02);
    }
    // the wub: detuned saws through a resonant lowpass that an LFO opens and closes
    function wob(at, f, dur, rate, v, bend) {
      const f1 = actx.createBiquadFilter(), g = actx.createGain(), l = actx.createOscillator(), lg = actx.createGain();
      f1.type = "lowpass"; f1.Q.value = 9; f1.frequency.value = 380;
      l.type = "sine"; l.frequency.value = rate; lg.gain.value = 1300; l.connect(lg).connect(f1.frequency);
      g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(v, at + 0.01);
      g.gain.setValueAtTime(v, at + dur * 0.85); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      [1, 1.012, 0.5].forEach((m, k) => {
        const o = actx.createOscillator(); o.type = k === 2 ? "square" : "sawtooth";
        o.frequency.setValueAtTime(f * m, at); if (bend) o.frequency.exponentialRampToValueAtTime(f * m * bend, at + dur);
        o.connect(f1); o.start(at); o.stop(at + dur + 0.02);
      });
      f1.connect(g).connect(gain); l.start(at); l.stop(at + dur + 0.02);
    }
    function sawBass(at, f, dur, v) {
      const f1 = actx.createBiquadFilter(), g = actx.createGain(), o = actx.createOscillator();
      f1.type = "lowpass"; f1.Q.value = 6; f1.frequency.setValueAtTime(2200, at); f1.frequency.exponentialRampToValueAtTime(300, at + dur);
      o.type = "sawtooth"; o.frequency.value = f; env(g, at, v, dur);
      o.connect(f1).connect(g).connect(gain); o.start(at); o.stop(at + dur + 0.02);
    }

    // ---- "dub": hard half-time dubstep at 140, F minor. 8-bar loop: 2 bars build, 6 bars drop ----
    let curve = null;
    function dist() {   // a hard clipper for the growls
      const ws = actx.createWaveShaper();
      if (!curve) { curve = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const v = i / 512 - 1; curve[i] = Math.tanh(v * 6); } }
      ws.curve = curve; return ws;
    }
    function growl(at, f, dur, rate, v, bend, shape) {
      const f1 = actx.createBiquadFilter(), g = actx.createGain(), l = actx.createOscillator(), lg = actx.createGain(), d = dist(), post = actx.createBiquadFilter();
      f1.type = "lowpass"; f1.Q.value = 14; f1.frequency.value = 300;
      l.type = shape || "sine"; l.frequency.value = rate; lg.gain.value = 2200; l.connect(lg).connect(f1.frequency);
      post.type = "lowpass"; post.frequency.value = 4200;
      g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(v, at + 0.008);
      g.gain.setValueAtTime(v, at + dur * 0.9); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      [[1, "sawtooth"], [1.007, "sawtooth"], [0.5, "square"], [2.003, "square"]].forEach(([m, ty]) => {
        const o = actx.createOscillator(); o.type = ty;
        o.frequency.setValueAtTime(f * m, at); if (bend) o.frequency.exponentialRampToValueAtTime(f * m * bend, at + dur);
        o.connect(f1); o.start(at); o.stop(at + dur + 0.02);
      });
      f1.connect(d).connect(post).connect(g).connect(gain); l.start(at); l.stop(at + dur + 0.02);
    }
    function sub(at, f, dur, v) { tone(at, f, dur, "sine", v); }
    const DF = 43.65, DN = [DF, DF, DF * 1.189, DF, DF * 0.891, DF, DF * 1.498, DF * 1.335];
    const DR = [4.67, 9.33, 2.33, 18.67, 7, 14, 3.5, 28];
    function dub(n, at) {
      const s = n % 16, bar = Math.floor(n / 16) % 8;
      if (bar < 2) {   // build: kick on the beat, snare roll speeding up, riser, then silence and a zap
        if (s % 4 === 0 && bar === 0) kick(at, 0.5);
        if (bar === 0 && s % 4 === 0) snare(at, 0.12);
        if (bar === 1) { if (s < 8 ? s % 2 === 0 : true) snare(at, 0.1 + s * 0.015); if (s >= 12) snare(at + S / 2, 0.14); }
        if (bar === 0 && s === 0) tone(at, 120, S * 30, "sawtooth", 0.04, 3200);
        if (bar === 1 && s === 15) tone(at, 3000, 0.2, "square", 0.04, 60);
        hat(at, 0.02 + bar * 0.02);
        return;
      }
      // the drop
      if (s === 0) { kick(at, 0.7); sub(at, DF, S * 3, 0.22); }
      if (s === 10 || (bar % 2 && s === 3)) kick(at, 0.55);
      if (s === 8) { snare(at, 0.42); hiss(at, 0.12, 0.25, 3000); }
      if (s % 2 === 0) hat(at, 0.035);
      if (bar === 7 && s >= 12) snare(at, 0.2 + (s - 12) * 0.05);
      const k = (bar * 4 + Math.floor(s / 4)) % 8;
      if (s % 4 === 0 && !(bar === 7 && s >= 12)) {
        const r = DR[(k * 3 + bar) % DR.length], b = bar % 2 && s === 12 ? 0.5 : (k % 3 === 2 ? 1.5 : 0);
        growl(at, DN[k], S * 3.8, r, 0.2, b, k % 2 ? "square" : "sine");
      } else if (s % 4 === 2 && (bar + s) % 3 === 0) growl(at, DN[(k + 2) % 8] * 2, S * 1.6, 28, 0.16, 0.7, "square");   // stutter screech
      if (s === 14 && bar % 2 === 0) tone(at, 1600, 0.12, "square", 0.04, 4000);   // metallic yelp
    }

    // ---- "dash": bright 150bpm four-on-the-floor in A minor (Am F C G) ----
    const CH = [[220, 261.63, 329.63], [174.61, 220, 261.63], [261.63, 329.63, 392], [196, 246.94, 293.66]];
    const MEL = [0, 0, 2, 0, 1, 0, 2, 1, 0, 2, 1, 0, 2, 0, 1, 2];
    function dash(n, at) {
      // bright drum & bass: A minor (Am F C G), arps on top, reese underneath
      const s = n % 16, bar = Math.floor(n / 16) % 8, ch = CH[bar % 4];
      dnbDrums(s, bar, at, bar === 7);
      if (s === 0 || s === 8 || s === 11) chipBass(at, ch[0] / 2, S * (s === 11 ? 5 : 3), 0.07);
      if (s % 2 === 0) tone(at, ch[(s / 2 + bar) % 3] * 2, S * 0.9, "square", 0.02);   // arp
      if (bar >= 4 && MEL[(s + bar * 3) % 16] !== 1 && s % 3 !== 2) chipLead(at, ch[MEL[(s + bar * 3) % 16]] * 4, 0.03);   // lead in the second half
    }

    // ---- 8-bit voices (square / triangle / noise only, like an old console) ----
    function chipKick(at, v) {
      const o = actx.createOscillator(), g = actx.createGain(); o.type = "triangle";
      o.frequency.setValueAtTime(220, at); o.frequency.exponentialRampToValueAtTime(45, at + 0.09);
      env(g, at, (v || 0.5) * 1.3, 0.16); o.connect(g).connect(gain); o.start(at); o.stop(at + 0.18);
    }
    function chipChord(at, freqs, dur, v) {   // fast arpeggio instead of a pad
      const step = S / 2;
      for (let i = 0; i * step < dur - 0.01; i++) tone(at + i * step, freqs[i % freqs.length] * 2, step * 0.95, "square", v);
    }
    function chipBass(at, f, dur, v) {
      tone(at, f * 2, dur, "triangle", v * 2.2);
      tone(at, f * 2, Math.min(dur, S * 1.5), "square", v * 0.45, f * 1.98);
    }
    function chipLead(at, f, v) { tone(at, f, S * 1.6, "square", v * 0.9); tone(at + S * 0.5, f * 1.003, S, "square", v * 0.35); }

    // ---- drum & bass toolkit: two-step break + rolling reese bass ----
    function dnbDrums(s, bar, at, fill) {
      if (s === 0 || s === 10 || (bar % 2 === 1 && s === 7)) chipKick(at, 0.55);
      if (s === 4 || s === 12) snare(at, 0.34);
      if (s === 7 || s === 15 || (bar % 2 === 0 && s === 9)) snare(at, 0.07);   // ghost notes
      hat(at, s % 2 ? 0.022 : 0.04); if (s === 6 || s === 14) hat(at, 0.035, true);
      if (fill && s >= 12) { snare(at, 0.12 + (s - 12) * 0.05); if (s % 2) snare(at + S / 2, 0.1); }
    }
    function reese(at, f, dur, v, open) {
      const f1 = actx.createBiquadFilter(), g = actx.createGain();
      f1.type = "lowpass"; f1.Q.value = 5;
      f1.frequency.setValueAtTime(220, at); f1.frequency.linearRampToValueAtTime(open || 900, at + dur * 0.5); f1.frequency.linearRampToValueAtTime(260, at + dur);
      g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(v, at + 0.02);
      g.gain.setValueAtTime(v, at + dur * 0.85); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      [-18, 18].forEach((c) => { const o = actx.createOscillator(); o.type = "sawtooth"; o.frequency.value = f; o.detune.value = c; o.connect(f1); o.start(at); o.stop(at + dur + 0.02); });
      const sub = actx.createOscillator(), sg = actx.createGain(); sub.type = "sine"; sub.frequency.value = f / 2;
      sg.gain.setValueAtTime(0.0001, at); sg.gain.exponentialRampToValueAtTime(v * 1.6, at + 0.02); sg.gain.setValueAtTime(v * 1.6, at + dur * 0.85); sg.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      sub.connect(sg).connect(gain); sub.start(at); sub.stop(at + dur + 0.02);
      f1.connect(g).connect(gain);
    }

    // ---- "melo": emotional melodic dubstep, 174 bpm half-time, F minor (Db Ab Eb Fm) ----
    // supersaw chords that duck under the kick, a pluck lead, a growl bass on the drop
    const PROG = [[138.59, 174.61, 207.65], [103.83, 130.81, 155.56], [155.56, 196, 233.08], [174.61, 207.65, 261.63]];
    const ROOT = [34.65, 51.91, 38.89, 43.65];
    const HOOK = [5, -1, 4, -1, 3, -1, 4, 2, -1, 3, -1, 2, 1, -1, 2, -1];   // index into the scale, -1 = rest
    const SCALE = [349.23, 392, 415.3, 466.16, 523.25, 622.25, 698.46];
    function supersaw(at, freqs, dur, v) {
      const f1 = actx.createBiquadFilter(), g = actx.createGain();
      f1.type = "lowpass"; f1.frequency.setValueAtTime(900, at); f1.frequency.linearRampToValueAtTime(3200, at + dur * 0.3);
      // sidechain pump: dip on every beat
      g.gain.setValueAtTime(0.0001, at);
      for (let b = 0; b < dur / (S * 4) - 0.01; b++) {
        const bt = at + b * S * 4;
        g.gain.setValueAtTime(0.0001, bt); g.gain.exponentialRampToValueAtTime(v, bt + S * 2.4);
      }
      g.gain.setValueAtTime(v, at + dur - 0.05); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      freqs.forEach((f) => [-14, -6, 0, 7, 15].forEach((c) => {
        const o = actx.createOscillator(); o.type = "sawtooth"; o.frequency.value = f * 2; o.detune.value = c;
        o.connect(f1); o.start(at); o.stop(at + dur + 0.02);
      }));
      f1.connect(g).connect(gain);
    }
    function pluck(at, f, v) {
      const o = actx.createOscillator(), o2 = actx.createOscillator(), f1 = actx.createBiquadFilter(), g = actx.createGain();
      o.type = "square"; o2.type = "sawtooth"; o.frequency.value = f; o2.frequency.value = f * 2.003;
      f1.type = "lowpass"; f1.Q.value = 4; f1.frequency.setValueAtTime(5000, at); f1.frequency.exponentialRampToValueAtTime(500, at + 0.25);
      env(g, at, v, 0.32); o.connect(f1); o2.connect(f1); f1.connect(g).connect(gain);
      o.start(at); o2.start(at); o.stop(at + 0.34); o2.stop(at + 0.34);
    }
    function melo(n, at) {
      // melodic drum & bass: intro bars 0-3 (pads, pluck, light hats), full roll bars 4-15
      const s = n % 16, bar = Math.floor(n / 16) % 16, c = bar % 4, intro = bar < 4;
      if (s === 0) chipChord(at, PROG[c], S * 16, intro ? 0.016 : 0.014);
      if (intro) { if (s % 2 === 0) hat(at, 0.025); if (bar === 3) { if (s >= 8) snare(at, 0.08 + (s - 8) * 0.03); if (s === 8) tone(at, 300, S * 8, "sawtooth", 0.03, 2400); } }
      else {
        dnbDrums(s, bar, at, bar % 8 === 7);
        if (s === 0 || s === 6 || s === 10) chipBass(at, ROOT[c] * 2, S * (s === 6 ? 4 : 6), 0.07);
      }
      const k = HOOK[(s + (bar % 2) * 3) % 16];
      if (k >= 0) chipLead(at, SCALE[k] * (!intro && bar % 4 >= 2 ? 2 : 1), intro ? 0.04 : 0.032);
    }

    const fn = kind === "dub" ? dub : kind === "melo" ? melo : dash;
    function pump() {
      const ahead = actx.currentTime + 0.2;
      while (t < ahead) { fn(step, t); t += S; step++; }
    }
    return {
      play() {
        if (timer || !soundOn) return;
        try {
          actx = actx || new (window.AudioContext || window.webkitAudioContext)();
          if (actx.state === "suspended") actx.resume();
          gain = actx.createGain(); gain.gain.value = kind === "dub" ? 0.55 : kind === "dash" ? 0.6 : 0.7; gain.connect(actx.destination);
          t = t0 = actx.currentTime + 0.05; step = kind === "melo" ? 64 : 0;   // skip the intro, start on the drop
          timer = setInterval(pump, 60); pump();
        } catch (e) { /* audio unavailable */ }
      },
      stop() {
        if (!timer) return;
        clearInterval(timer); timer = null;
        try { gain.gain.setTargetAtTime(0, actx.currentTime, 0.04); const g = gain; setTimeout(() => g.disconnect(), 400); } catch (e) { /* ignore */ }
      },
      // 0..1 position inside the current beat (for visuals), or -1 when silent
      pulse() { if (!timer) return -1; const b = (ctx().currentTime - t0) / (S * 4); return b - Math.floor(b); },
      get on() { return !!timer; }
    };
  }

  /* ---------- beat_dash.exe: a one-button rhythm runner (her face on the cube) ---------- */
  let dashApi = null;
  function openDash(from) {
    return createWin({
      id: "dash", title: "beat_dash.exe", w: 380, h: "auto", from, dx: 0, dy: 160, flat: true,
      onClose() { if (dashApi) dashApi.stop(); dashApi = null; },
      fill(body) {
        const app = h("div", "snake-app dash-app");
        const lcd = h("div", "lcd dash-lcd");
        const cv = h("canvas"); cv.width = 340; cv.height = 200;
        const msg = h("div", "lcd-msg"); msg.innerHTML = "SPACE / CLICK TO JUMP<br>HOLD TO KEEP JUMPING";
        lcd.append(cv, msg);
        const sc = h("div", "snake-score");
        const sA = h("b", null, "1"), sB = h("b", null, store.get("dash-best", 0) + "%");
        const s1 = h("span", null, "ATTEMPT "), s2 = h("span", null, "BEST ");
        s1.appendChild(sA); s2.appendChild(sB); sc.append(s1, s2);
        app.append(lcd, sc, h("div", "snake-tip", "JUMP ON THE BEAT · SOUND ON FOR THE TRACK"), h("div", "snake-tip", "♪ Feint – Snake Eyes (feat. CoMa) · 8-bit edit by Sasha"));
        body.appendChild(app);
        dashApi = makeDash(cv, msg, sA, sB);
      }
    });
  }
  // beat_dash level: laid out on the beat grid of the song (175 bpm), denser where the track is loud
  const DASH = { T0: 0.2177, BEAT: 60 / 175.15, PPS: 252, END: 85,
    // loudness per beat, 0-9 (measured from the track)
    E: "95893991000000853976799759883987496879894958498859699979696949597979997978575607474987596969686857488769687978796899999966885389679989996599637112110200321023200102010022202330010201002221233022232252244343479797969996929699969296939699949997929799" };
  // [sky top, sky bottom, shape colour (A = alpha), shape] — pastel phrases, then night phrases for the loud parts
  const DASH_THEMES = [
    ["#b9aee3", "#e7e1f6", "rgba(255,255,255,A)", "s"], ["#d9b3cf", "#f4e3ee", "rgba(255,255,255,A)", "o"],
    ["#a9bde6", "#e1e8f7", "rgba(255,255,255,A)", "d"], ["#c6b5ea", "#f1e6f6", "rgba(255,255,255,A)", "t"],
    ["#2e2452", "#6d5aa8", "rgba(215,163,189,A)", "x"], ["#3a1f45", "#a0607f", "rgba(255,255,255,A)", "d"],
    ["#1f2a52", "#5a74b4", "rgba(180,167,221,A)", "o"], ["#2e2452", "#8a6fc4", "rgba(255,242,0,A)", "t"]
  ];
  function dashLevel(GY, C, PX) {
    let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const obs = [], bx = (i) => (DASH.T0 + i * DASH.BEAT) * DASH.PPS + PX;
    const spike = (X, up) => obs.push({ k: "s", x: X, y: GY - C - (up || 0), w: C, h: C });
    const block = (X, w, hh) => obs.push({ k: "b", x: X, y: GY - hh, w, h: hh });
    const pad = (X) => obs.push({ k: "p", x: X, y: GY - 5, w: C, h: 5 });
    let i = 6;   // a short run-up before the first obstacle
    while (i < DASH.E.length - 4) {
      const e = +DASH.E[i], X = bx(i) + 36;   // jump on the beat to clear what sits at X
      if (e <= 1) { i += 4; continue; }
      if (e <= 4) { spike(X); i += 4; continue; }
      if (e <= 6) { if (i % 8 === 0) { spike(X); spike(X + C); } else spike(X); i += 2; continue; }
      // loud: a little 4-beat move
      const r = rnd();
      if (r < 0.3) { spike(X); spike(bx(i + 2) + 36); spike(bx(i + 2) + 36 + C); }
      else if (r < 0.5) { pad(bx(i) + 10); spike(bx(i) + 50); spike(bx(i) + 70); spike(bx(i) + 90); }
      else if (r < 0.7) { block(X, 40, 20); block(bx(i + 2) + 36, 40, 40); }
      else if (r < 0.85) { spike(X); spike(X + C); spike(bx(i + 2) + 36); }
      else { block(X, 120, 20); }   // a long white block to hop onto and run along
      i += 4;
    }
    return obs;
  }
  function makeDash(cv, msg, attEl, bestEl) {
    const x = cv.getContext("2d"), W = cv.width, H = cv.height, GY = 164, C = 20, PX = 70;
    const head = new Image(); head.src = "assets/face-cutout.webp";
    // Sasha's own 8-bit edit of Feint – Snake Eyes (licensed via Monstercat Gold), starting at 1:01
    const song = new Audio("assets/flap-song.mp3"); song.volume = 0.6; song.preload = "auto"; songs.push(song);
    const music = {
      play() { if (!soundOn) return; song.currentTime = 0; const pr = song.play(); if (pr && pr.catch) pr.catch(() => {}); },
      stop() { song.pause(); },
      get on() { return !song.paused; }
    };
    const GRAV = 0.92, JUMP = -10.2, PAD = -15, LEN = DASH.END * DASH.PPS;
    let cy, vy, rot, ground, cam, obs, parts, trail, alive = false, running = false, held = false, t = 0;
    let attempt = 1, best = store.get("dash-best", 0), acc = 0, frame = 0, dead = 0, spd = DASH.PPS / 60, won = 0;
    function build() { obs = dashLevel(GY, C, PX); }
    function reset() { cy = GY - C; vy = 0; rot = 0; ground = true; cam = 0; t = 0; parts = []; trail = []; dead = 0; won = 0; build(); }
    function start() {
      if (dead) return;
      if (!alive) { reset(); alive = true; }
      running = true; msg.hidden = true; music.stop(); music.play();
    }
    function die() {
      running = false; alive = false; dead = 1; music.stop(); sfx.die();
      const pct = Math.min(100, Math.floor(cam / LEN * 100));
      if (pct > best) { best = pct; store.set("dash-best", best); bestEl.textContent = best + "%"; }
      for (let i = 0; i < 26; i++) { const a = Math.random() * 6.28, s = 1 + Math.random() * 4; parts.push({ x: PX + C / 2, y: cy + C / 2, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, c: i % 3 }); }
      setTimeout(() => { dead = 0; attempt++; attEl.textContent = String(attempt); reset(); alive = true; running = true; music.play(); }, 900);
    }
    function win() {
      running = false; alive = false; won = 1; music.stop(); sfx.star();
      best = 100; store.set("dash-best", 100); bestEl.textContent = "100%";
      msg.innerHTML = "LEVEL COMPLETE ✦<br>SPACE / TAP TO GO AGAIN"; msg.hidden = false;
    }
    function jump(force) { vy = force || JUMP; ground = false; }
    function press() { held = true; if (!running) { start(); if (running) jump(); return; } if (ground) jump(); }
    function step() {
      frame++;
      if (running) {
        // the song is the clock: stay locked to it while it plays
        if (music.on && song.currentTime > 0) { t = song.currentTime; cam = t * DASH.PPS; } else { t += 1 / 60; cam = t * DASH.PPS; }
        if (held && ground) jump();
        vy += GRAV; cy += vy; ground = false;
        if (vy < 0 || !ground) rot += 0.11;
        if (cy >= GY - C) { cy = GY - C; vy = 0; ground = true; }
        const L = PX + cam, R = L + C;
        for (const o of obs) {
          if (o.x > R + 4 || o.x + o.w < L - 4) continue;
          if (o.k === "s") { // a slightly forgiving triangle hitbox
            if (R - 6 > o.x && L + 6 < o.x + o.w && cy + C - 4 > o.y + 9) { die(); return; }
          } else if (o.k === "p") {
            if (R > o.x && L < o.x + o.w && cy + C >= GY - 14 && vy >= 0) { jump(PAD); burstAt(o.x - cam + 10, GY - 4); }
          } else if (R > o.x && L < o.x + o.w) {
            if (vy >= 0 && cy + C - vy <= o.y + 2) { cy = o.y - C; vy = 0; ground = true; }   // landed on top
            else if (cy + C > o.y + 3) { die(); return; }   // hit the side
          }
        }
        if (ground) rot = Math.round(rot / (Math.PI / 2)) * (Math.PI / 2);
        trail.push({ x: PX + cam, y: cy + C / 2, life: 1 }); if (trail.length > 14) trail.shift();
        if (cam >= LEN) win();
      }
      parts.forEach((p) => { p.x += p.vx; p.y += p.vy; p.vy += 0.15; p.life -= 0.025; });
      parts = parts.filter((p) => p.life > 0);
      trail.forEach((t) => (t.life -= 0.07));
      draw();
    }
    function burstAt(X, Y) { for (let i = 0; i < 8; i++) parts.push({ x: X + cam - cam, y: Y, vx: (Math.random() - 0.5) * 3, vy: -Math.random() * 3, life: 0.8, c: 1 }); }
    const COL = ["#2e2452", "#d7a3bd", "#ffffff"];
    function draw() {
      const bt = (t - DASH.T0) / DASH.BEAT, beat = running ? bt - Math.floor(bt) : (frame % 24) / 24, kick = Math.pow(1 - beat, 3);
      // the world changes every 16 beats (a phrase); loud phrases get the night palette
      const phrase = Math.max(0, Math.floor(bt / 16)), pb = bt - phrase * 16;
      let loudSum = 0; for (let k = phrase * 16; k < phrase * 16 + 16; k++) loudSum += +(DASH.E[k] || 0);
      const th = running ? DASH_THEMES[(loudSum / 16 >= 7 ? 4 : 0) + (phrase % 4)] : DASH_THEMES[0];
      const sky = x.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, th[0]); sky.addColorStop(1, th[1]);
      x.fillStyle = sky; x.fillRect(0, 0, W, H);
      // background shapes that pulse with the kick (the shape changes with the phrase)
      x.strokeStyle = th[2].replace("A", (0.22 + kick * 0.35).toFixed(2)); x.fillStyle = x.strokeStyle; x.lineWidth = 2;
      for (let i = 0; i < 10; i++) {
        const bx = ((i * 61 - cam * 0.25) % (W + 80) + W + 80) % (W + 80) - 40, by = 20 + (i * 37) % 110, sz = 16 + (i % 3) * 10 + kick * 6;
        x.save(); x.translate(bx, by); x.rotate((th[3] === "d" ? Math.PI / 4 : 0) + (th[3] === "x" ? bt * 0.4 : 0));
        if (th[3] === "o") { x.beginPath(); x.arc(0, 0, sz / 2, 0, 6.29); x.stroke(); }
        else if (th[3] === "t") { x.beginPath(); x.moveTo(0, -sz / 2); x.lineTo(sz / 2, sz / 2); x.lineTo(-sz / 2, sz / 2); x.closePath(); x.stroke(); }
        else if (th[3] === "x") { x.font = (sz + 6) + "px sans-serif"; x.textAlign = "center"; x.fillText("✦", 0, sz / 3); }
        else x.strokeRect(-sz / 2, -sz / 2, sz, sz);
        x.restore();
      }
      // a flash as each new phrase comes in
      if (running && pb < 1) { x.fillStyle = "rgba(255,255,255," + ((1 - pb) * 0.45).toFixed(2) + ")"; x.fillRect(0, 0, W, H); }
      // ground: chrome tiles
      const gg = x.createLinearGradient(0, GY, 0, H);
      gg.addColorStop(0, "#fbfbfd"); gg.addColorStop(0.3, "#c3c5d0"); gg.addColorStop(1, "#8f8aa8");
      x.fillStyle = gg; x.fillRect(0, GY, W, H - GY);
      x.fillStyle = "#2e2452"; x.fillRect(0, GY, W, 2);
      // floor seams sit exactly on the beat grid: when a seam reaches the cube, that's the beat
      const bi = Math.floor(bt), eNow = +(DASH.E[Math.max(0, bi)] || 0);
      for (let i = Math.max(0, bi - 2); i < bi + 6; i++) {
        const sx = (DASH.T0 + i * DASH.BEAT) * DASH.PPS + PX - cam;
        if (sx < -4 || sx > W + 4) continue;
        const loud = +(DASH.E[i] || 0) >= 7;
        x.fillStyle = i === bi ? "rgba(215,163,189," + (0.4 + kick * 0.6).toFixed(2) + ")" : (loud ? "rgba(46,36,82,.4)" : "rgba(46,36,82,.2)");
        x.fillRect(Math.floor(sx), GY + 2, i % 4 === 0 ? 3 : 2, H - GY);
        if (i % 4 === 0) { x.fillStyle = "#d7a3bd"; x.fillRect(Math.floor(sx) - 1, GY - 3, 5, 3); }
      }
      // obstacles
      obs.forEach((o) => {
        const ox = o.x - cam; if (ox > W + 10 || ox + o.w < -10) return;
        if (o.k === "s") {
          x.save(); const pz = 1 + kick * 0.12; x.translate(ox + o.w / 2, o.y + o.h); x.scale(pz, pz); x.translate(-(ox + o.w / 2), -(o.y + o.h));
          x.fillStyle = "#2e2452"; x.beginPath(); x.moveTo(ox, o.y + o.h); x.lineTo(ox + o.w / 2, o.y); x.lineTo(ox + o.w, o.y + o.h); x.closePath(); x.fill();
          x.fillStyle = "#d7a3bd"; x.beginPath(); x.moveTo(ox + 5, o.y + o.h - 2); x.lineTo(ox + o.w / 2, o.y + 7); x.lineTo(ox + o.w - 5, o.y + o.h - 2); x.closePath(); x.fill();
          x.restore();
        } else if (o.k === "p") {
          x.fillStyle = "#fff200"; x.fillRect(ox + 2, o.y + 1, o.w - 4, o.h); x.strokeStyle = "#2e2452"; x.lineWidth = 1.5; x.strokeRect(ox + 2, o.y + 1, o.w - 4, o.h);
        } else {
          x.fillStyle = "#f6f3fa"; x.fillRect(ox, o.y, o.w, o.h);
          x.strokeStyle = "#2e2452"; x.lineWidth = 2; x.strokeRect(ox + 1, o.y + 1, o.w - 2, o.h - 2);
          x.strokeStyle = "rgba(215,163,189," + (0.5 + kick * 0.5).toFixed(2) + ")"; x.strokeRect(ox + 5, o.y + 5, o.w - 10, o.h - 10);
        }
      });
      // trail
      trail.forEach((t) => { if (t.life <= 0) return; x.fillStyle = "rgba(215,163,189," + (t.life * 0.6).toFixed(2) + ")"; const s = 6 * t.life; x.fillRect(t.x - cam - s / 2 - 4, t.y - s / 2, s, s); });
      // the cube with her face
      if (!dead) {
        x.save(); x.translate(PX + C / 2, cy + C / 2); x.rotate(rot);
        const s = C * (1 + kick * 0.08);
        x.fillStyle = "#d7a3bd"; x.fillRect(-s / 2, -s / 2, s, s);
        if (head.complete && head.naturalWidth) { x.save(); x.beginPath(); x.rect(-s / 2 + 2, -s / 2 + 2, s - 4, s - 4); x.clip(); x.drawImage(head, -s / 2 - 3, -s / 2 - 2, s + 6, s + 6); x.restore(); }
        x.strokeStyle = "#2e2452"; x.lineWidth = 2; x.strokeRect(-s / 2, -s / 2, s, s);
        x.restore();
      }
      parts.forEach((q) => { x.globalAlpha = Math.max(0, q.life); x.fillStyle = COL[q.c]; x.fillRect(q.x - 2, q.y - 2, 4, 4); });
      x.globalAlpha = 1;
      // loud beats flash the whole screen a little
      if (running && eNow >= 7) { x.fillStyle = "rgba(255,255,255," + (kick * (eNow - 6) * 0.06).toFixed(3) + ")"; x.fillRect(0, 0, W, H); }
      // progress bar
      const pr = Math.min(1, cam / LEN);
      x.fillStyle = "rgba(46,36,82,.35)"; x.fillRect(W / 2 - 80, 8, 160, 6);
      x.fillStyle = "#fff"; x.fillRect(W / 2 - 80, 8, 160 * pr, 6);
      x.font = "700 9px 'Space Mono', monospace"; x.textAlign = "center"; x.fillStyle = "#2e2452";
      x.fillText(Math.floor(pr * 100) + "%", W / 2, 26);
      if (dead) { x.fillStyle = "rgba(255,255,255," + (0.5 * dead).toFixed(2) + ")"; x.fillRect(0, 0, W, H); dead = Math.max(0.01, dead * 0.9); }
    }
    cv.addEventListener("pointerdown", (e) => { e.preventDefault(); press(); });
    window.addEventListener("pointerup", () => (held = false));
    reset(); draw();
    return {
      key(e) {
        if (e.key === " " || e.key === "ArrowUp" || e.key === "w") { e.preventDefault(); if (!e.repeat) press(); return true; }
        return false;
      },
      keyup(e) { if (e.key === " " || e.key === "ArrowUp" || e.key === "w") held = false; },
      tick(dt) { acc += dt; let n = 0; while (acc > 16.7 && n < 4) { acc -= 16.7; step(); n++; } if (n === 4) acc = 0; },
      stop() { running = false; music.stop(); }
    };
  }

  window.addEventListener("keyup", (e) => { if (dashApi) dashApi.keyup(e); });

  /* ---------- welcome dialog (first visit) ---------- */
  function openWelcome() {
    createWin({
      id: "welcome", title: "hello.exe", w: 380, h: "auto", flat: true, dy: -60,
      fill(body, w) {
        const d = h("div", "dialog");
        const face = h("div", "d-face"); const im = h("img"); im.src = "assets/face-cutout.webp"; im.alt = ""; face.appendChild(im);
        const t = h("div");
        t.append(h("div", "d-tag", "✦ process book · sasha"), h("b", "d-big", "I am not a robot :)"),
          "This is my process book: the research, sketches, prototypes and reflections behind my HvA Digital Design projects, dressed up as a little desktop. Spin the windows around my head and open a project. " + STARS.length + " ✦ are hidden around.");
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
    item("▦", "Blocks", () => openApp("blocks", startBtn));
    item("✈", "MLG Flap", () => openApp("flap", startBtn));
    item("◆", "Beat Dash", () => openApp("dash", startBtn));
    item("✦", "Stars (" + got.length + "/" + STARS.length + ")", () => openApp("stars", startBtn));
    box.appendChild(h("div", "sm-sep"));
    item(soundOn ? "🔊" : "🔇", soundOn ? "Turn sound off" : "Turn sound on", () => { setSound(!soundOn); sfx.click(); });
    item("↻", "Restart (reset stars)", restartOS);
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
  // restart: forget the found stars (and the glasses reward) and boot again
  function restartOS() {
    sfx.close();
    try { localStorage.removeItem("sasha:stars"); localStorage.removeItem("sasha:skin"); } catch (e) { /* private mode */ }
    setTimeout(() => location.reload(), 250);
  }
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
    "05": { type: "PERS<br>ONAL" },
    "06": { type: "SELF<br>GROW" }
  };
  const CARDS = PROJECTS.map((p, i) => ({ app: "project:" + i, num: p.index, title: p.title, file: p.index + "_" + slug(p.title) + ".doc", meta: p.course.split("(")[0].trim() + " · " + p.year, cover: COVERS[p.index] || { type: p.title } }));

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

  /* ---------- desktop icons can be dragged around (positions remembered) ---------- */
  const iconBox = $("icons");
  const iconEls = [...iconBox.querySelectorAll(".icon")];
  let iconsFree = false;
  function freeIcons(saved) {
    // switch from the grid to free positions, keeping where everything is now
    if (iconsFree) return;
    const box = iconBox.getBoundingClientRect();
    const pos = iconEls.map((el) => { const r = el.getBoundingClientRect(); return [r.left - box.left, r.top - box.top]; });
    iconEls.forEach((el, i) => {
      const p = (saved && saved[el.dataset.open]) || pos[i];
      el.style.position = "absolute"; el.style.left = p[0] + "px"; el.style.top = p[1] + "px";
    });
    iconBox.classList.add("free");
    iconsFree = true;
  }
  function clampIcon(el) {
    const box = iconBox.getBoundingClientRect(), r = el.getBoundingClientRect();
    const x = Math.max(-box.left, Math.min(innerWidth - r.width - box.left, parseFloat(el.style.left)));
    const y = Math.max(-box.top, Math.min(innerHeight - 48 - r.height - box.top, parseFloat(el.style.top)));
    el.style.left = x + "px"; el.style.top = y + "px";
  }
  function saveIcons() {
    const o = {}; iconEls.forEach((el) => { o[el.dataset.open] = [parseFloat(el.style.left), parseFloat(el.style.top)]; });
    store.set("icons", o);
  }
  const savedIcons = store.get("icons", null);
  if (savedIcons && !isSmall()) { freeIcons(savedIcons); iconEls.forEach(clampIcon); }
  iconEls.forEach((el) => {
    el.addEventListener("pointerdown", (e) => {
      if (isSmall() || e.button !== 0) return;
      const sx = e.clientX, sy = e.clientY;
      let ox = 0, oy = 0, moving = false;
      const move = (ev) => {
        if (!moving) {
          if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 5) return;
          moving = true; freeIcons();
          ox = parseFloat(el.style.left) - sx; oy = parseFloat(el.style.top) - sy;
          el.classList.add("dragging");
        }
        el.style.left = ev.clientX + ox + "px"; el.style.top = ev.clientY + oy + "px";
        clampIcon(el);
      };
      const up = () => {
        removeEventListener("pointermove", move); removeEventListener("pointerup", up); removeEventListener("pointercancel", up);
        if (!moving) return;
        el.classList.remove("dragging");
        el.dataset.justDragged = "1";
        setTimeout(() => delete el.dataset.justDragged, 0);
        saveIcons();
      };
      addEventListener("pointermove", move); addEventListener("pointerup", up); addEventListener("pointercancel", up);
    });
    el.addEventListener("dragstart", (e) => e.preventDefault());
  });
  addEventListener("resize", () => { if (iconsFree) iconEls.forEach(clampIcon); });

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
  // reward skin: after all stars are found she transforms and keeps the star glasses on
  const GLASSES = { src: "assets/face-glasses-turn.webp", size: 420, cols: 10, yawMax: 22, poses: [[0.2,15.5],[1.0,13.8],[2.9,16.5],[6.1,16.0],[5.8,17.9],[7.9,17.1],[9.2,19.0],[11.6,19.6],[14.2,20.0],[16.3,18.5],[17.6,19.8],[18.0,17.5],[-0.6,17.5],[-1.5,19.6],[-4.6,19.5],[-8.9,20.4],[-8.3,18.8],[-10.8,18.6],[-13.1,18.1],[-1.6,13.4],[-0.4,10.5],[0.5,6.9],[-0.4,8.4],[12.5,17.2],[19.1,23.5],[20.8,21.1],[20.5,18.4],[1.9,18.0],[-4.7,18.0],[14.7,17.4],[4.9,14.5],[9.0,20.6],[10.0,17.6]] };
  const gsheet = new Image(); gsheet.src = GLASSES.src;
  let skin = store.get("skin", "plain");
  const skinSheet = () => skin === "glasses" ? [gsheet, GLASSES] : [sheet, SHEET];
  const NEUTRAL_PITCH = 16;
  let look = { x: innerWidth / 2, y: innerHeight };
  let lastMove = performance.now();   // last time the cursor actually moved
  let tYaw = 0, tPitch = NEUTRAL_PITCH, shown = -1, pokes = 0, pokeReset = null;
  function blink() { /* the video has no blink */ }
  // mosaic: 0 = big blocks, 1 = the clear photo (animated in after loading)
  let mosaic = 0, lastKey = "";
  // pix: 0 = the normal photo, 1 = a chunky pixel sprite of her
  const PIX_RES = 56;
  let pix = 0, pixAnim = 0;
  function setPixelFace(on) {
    const from = pix, to = on ? 1 : 0;
    if (from === to) return;
    if (reduceMotion) { pix = to; return; }
    const t0 = performance.now(), id = ++pixAnim;
    sfx[on ? "pixelOn" : "pixelOff"]();
    (function step(now) {
      if (id !== pixAnim) return;
      const p = Math.min(1, (now - t0) / 700);
      // jump through a few resolutions, like a retro transform
      const q = Math.round(p * 6) / 6;
      pix = p >= 1 ? to : from + (to - from) * Math.min(0.97, q);
      if (p < 1) requestAnimationFrame(step);
    })(t0);
  }
  const mc = document.createElement("canvas"), mx = mc.getContext("2d");
  // draw frame i of a sprite sheet into the head canvas (same size + position for every sheet)
  function blit(img, sh, i, alpha) {
    const s = sh.size, sx = (i % sh.cols) * s, sy = Math.floor(i / sh.cols) * s;
    hx.globalAlpha = alpha == null ? 1 : alpha;
    if (pix > 0 && mosaic >= 1) {
      // pixel-sprite version of the face (while blocks.exe is open)
      const n = Math.round(hc.width - (hc.width - PIX_RES) * pix);
      mc.width = n; mc.height = n; mx.clearRect(0, 0, n, n);
      mx.imageSmoothingEnabled = true;
      mx.drawImage(img, sx, sy, s, s, 0, 0, n, n);
      if (pix >= 1) {
        // crisp sprite edges + a reduced palette
        const d = mx.getImageData(0, 0, n, n), a = d.data;
        for (let k = 0; k < a.length; k += 4) {
          if (a[k + 3] < 110) { a[k + 3] = 0; continue; }
          a[k + 3] = 255;
          for (let c = 0; c < 3; c++) a[k + c] = Math.min(255, Math.round(a[k + c] / 36) * 36 + 10);
        }
        mx.putImageData(d, 0, 0);
      }
      hx.imageSmoothingEnabled = false;
      hx.drawImage(mc, 0, 0, n, n, 0, 0, hc.width, hc.height);
    }
    else if (mosaic >= 1) { hx.imageSmoothingEnabled = true; hx.drawImage(img, sx, sy, s, s, 0, 0, hc.width, hc.height); }
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
    const key = layers.map((l) => l[1].src + l[2] + ":" + (l[3] == null ? 1 : l[3].toFixed(2))).join("|") + "@" + mosaic + "/" + pix + "/" + shadesP.toFixed(2) + "/" + Math.round(tYaw);
    if (key === lastKey) return;
    if (!layers.every((l) => ready(l[0]))) return;
    lastKey = key;
    hx.clearRect(0, 0, hc.width, hc.height);
    layers.forEach((l) => blit(l[0], l[1], l[2], l[3]));
    if (shadesP > 0) drawShades();
  }
  // meme pixel shades for mlg_flap.exe: they drop down from above onto her eyes
  const SHADES = [
    "XXXXXXXXXXXXXXXXXXXXXX",
    "XWWXXXXXXXXXXWWXXXXXXX",
    ".XWWXXXXX..XXXWWXXXXX.",
    "..XXXXXX....XXXXXX...."
  ];
  let shadesP = 0, shadesAnim = 0;
  function drawShades() {
    const cell = 11 * hc.width / 420, w = SHADES[0].length * cell;
    const cx = hc.width / 2 + tYaw * 1.6 * hc.width / 420, y0 = hc.height * 0.455 - (1 - shadesP) * hc.height * 0.6;
    hx.globalAlpha = Math.min(1, shadesP * 1.5);
    SHADES.forEach((row, r) => [...row].forEach((ch, c) => {
      if (ch === ".") return;
      hx.fillStyle = ch === "W" ? "#ffffff" : "#0b0b0f";
      hx.fillRect(Math.round(cx - w / 2 + c * cell), Math.round(y0 + r * cell), Math.ceil(cell), Math.ceil(cell));
    }));
    hx.globalAlpha = 1;
  }
  function setShades(on) {
    const id = ++shadesAnim, from = shadesP, to = on ? 1 : 0, t0 = performance.now();
    if (reduceMotion) { shadesP = to; return; }
    (function step(now) {
      if (id !== shadesAnim) return;
      const p = Math.min(1, (now - t0) / (on ? 900 : 300));
      shadesP = from + (to - from) * (on ? 1 - Math.pow(1 - p, 3) : p);
      if (p < 1) requestAnimationFrame(step);
    })(t0);
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
  function turnFrame(yaw, pitch, sh) {
    let best = 0, bd = Infinity;
    (sh || SHEET).poses.forEach((p, i) => { const d = (p[0] - yaw) ** 2 + 2.2 * (p[1] - pitch) ** 2; if (d < bd) { bd = d; best = i; } });
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
      wantYaw = nx * (skin === "glasses" ? GLASSES.yawMax : 38);
      wantPitch = ny < 0 ? NEUTRAL_PITCH + ny * 20 : NEUTRAL_PITCH + ny * 3;
    }
    const ease = reduceMotion ? 1 : (c.state === "settling" ? 0.2 : 0.12);
    tYaw += (wantYaw - tYaw) * ease;
    tPitch += (wantPitch - tPitch) * ease;
    const [sImg, sSh] = skinSheet();
    const idleLayer = [sImg, sSh, turnFrame(tYaw, tPitch, sSh), 1];

    // all stars found: transform once the head is free
    if (c.state === "idle" && pendingGlasses && character.play("glasses_on")) { pendingGlasses = false; magicSound(); magicFx(); }

    // cursor resting (just scrolling / using arrows): look ahead and blink
    if (c.state === "idle" && skin === "plain" && now - lastMove > IDLE_AFTER && EMOTIONS.idle_blink) character.play("idle_blink");

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
        if (el > (e.stillFor || 1800)) { c.state = "returning"; c.t0 = now; if (e.onEnd) e.onEnd(); }
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
      if (f >= e.frames) { c.state = "returning"; c.t0 = now; if (e.onEnd) e.onEnd(); paint([[e.img, e.sheet, e.frames - 1, 1]]); return; }
      const fade = Math.min(1, el / e.fadeIn);
      paint(fade < 1 ? [idleLayer, [e.img, e.sheet, f, fade]] : [[e.img, e.sheet, f, 1]]);
      return;
    }
    if (c.state === "returning") {
      const p = reduceMotion ? 1 : Math.min(1, (now - c.t0) / e.fadeOut);
      const last = e.loop ? (c.loopFrame || 0) : (reduceMotion ? e.still : e.frames - 1);
      paint(p < 1 ? [[e.img, e.sheet, last, 1], [idleLayer[0], idleLayer[1], idleLayer[2], p]] : [idleLayer]);
      if (p >= 1) { e.lastEnd = now; c.state = "idle"; c.emotion = null; }
      return;
    }
    paint([idleLayer]);
  }
  // kept under its old name for the main loop
  function updateEyes() { stepCharacter(performance.now()); }

  // idle: front-facing blink loop while the cursor rests
  const IDLE_AFTER = 1600;
  registerEmotion("idle_blink", {
    src: "assets/face-blink.webp", size: 420, cols: 10, frames: 49, fps: 12,
    loop: true, cooldown: 0, fadeIn: 220, fadeOut: 160
  });

  registerEmotion("pout", {
    // pout clip, calm opening trimmed off (starts as the scrunch builds); plays when you poke her face
    src: "assets/face-pout.webp", size: 420, cols: 10, frames: 33, fps: 12,
    still: 21, stillFor: 1500, cooldown: 1500, fadeIn: 120, fadeOut: 420, settle: false
  });

  // the reward: a full turn, and she comes back round wearing the star glasses
  registerEmotion("glasses_on", {
    src: "assets/face-glasses-on.webp", size: 420, cols: 10, frames: 49, fps: 12,
    still: 48, stillFor: 1200, cooldown: 0, fadeIn: 200, fadeOut: 200,
    onEnd() { skin = "glasses"; store.set("skin", "glasses"); }
  });
  // in glasses, a poke gets a smug little smirk instead of the pout
  registerEmotion("glasses_smirk", {
    src: "assets/face-glasses-smirk.webp", size: 420, cols: 10, frames: 49, fps: 12,
    still: 24, stillFor: 1500, cooldown: 1500, fadeIn: 120, fadeOut: 300, settle: false
  });
  let pendingGlasses = false;

  /* magical-girl transformation effects around the spin: glow + light rays behind the head,
     a spiral of stars closing in, then a starburst flash as the glasses land and glitter after */
  // magical-girl transformation sound, synced with magicFx (flash at 3.3s)
  function magicSound() {
    if (!soundOn) return;
    const at = (ms, fn) => setTimeout(fn, ms);
    // 1. rising shimmer while the stars spiral in
    const up = [523, 659, 784, 988, 1047, 1319, 1568, 1976];
    for (let r = 0; r < 3; r++) up.forEach((f, i) => at(200 + r * 1000 + i * 110, () => blip(f * (r === 2 ? 1.5 : 1), 0.18, "triangle", 0.035 + r * 0.01)));
    // twinkles on top
    for (let i = 0; i < 14; i++) at(300 + Math.random() * 2900, () => blip(2400 + Math.random() * 1600, 0.06, "sine", 0.025));
    // 2. swell into the flash
    at(2700, () => blip(220, 0.6, "sawtooth", 0.03, 880));
    // 3. the flash: a big bright chord
    at(3300, () => { [523, 659, 784, 1047, 1319].forEach((f) => blip(f, 1.1, "square", 0.028)); blip(130, 0.8, "triangle", 0.09, 65); });
    // 4. glitter falling down
    [3136, 2637, 2349, 2093, 1760, 1568, 1319, 1175, 1047].forEach((f, i) => at(3500 + i * 70, () => blip(f, 0.09, "sine", 0.035)));
    // 5. ta-da
    at(4400, () => seq([784, 1047], 110, "square", 0.045));
    at(4650, () => [659, 784, 1047, 1568].forEach((f) => blip(f, 0.9, "triangle", 0.05)));
  }
  function magicFx() {
    if (reduceMotion) return;
    const r = faceBody.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height * 0.45, R = Math.max(r.width, r.height);
    const back = h("div", "mg-back");
    back.append(h("i", "mg-aura"), h("i", "mg-rays"));
    faceWin.prepend(back);
    const front = h("div", "mg-front");
    front.style.left = cx + "px"; front.style.top = cy + "px"; front.style.setProperty("--R", R * 0.75 + "px");
    const N = 16;
    for (let i = 0; i < N; i++) {
      // outer spins round the head, inner star slides inwards: together a closing spiral
      const st = h("i", "mg-orbit" + (i % 3 === 0 ? " p" : i % 3 === 1 ? " l" : ""));
      st.style.setProperty("--a", (360 / N) * i + "deg");
      st.style.setProperty("--d", (i % 4) * 0.12 + "s");
      const star = h("b", null, "✦"); star.style.fontSize = 20 + (i % 4) * 9 + "px";
      st.appendChild(star);
      front.appendChild(st);
    }
    document.body.appendChild(front);
    const flash = () => {
      const f = h("div", "mg-flash"); f.style.setProperty("--x", cx + "px"); f.style.setProperty("--y", cy + "px");
      document.body.appendChild(f); setTimeout(() => f.remove(), 1200);
      const ring = h("i", "mg-ring"); front.appendChild(ring);
      burst(cx, cy, 40, "255,255,255"); burst(cx, cy, 30, "215,163,189"); burst(cx, cy, 24, "193,182,230");
      sfx.star();
      // glitter drifting down around her
      for (let i = 0; i < 26; i++) {
        const g = h("i", "mg-glitter" + (i % 2 ? " p" : ""), i % 3 ? "✦" : "✧");
        g.style.left = (Math.random() - 0.5) * R * 1.6 + "px";
        g.style.top = (Math.random() - 0.8) * R * 0.9 + "px";
        g.style.fontSize = 8 + Math.random() * 16 + "px";
        g.style.animationDelay = Math.random() * 0.9 + "s";
        front.appendChild(g);
      }
    };
    // the glasses come round at ~3.3 s into the clip, after up to 0.7 s of settling
    const sparkleTimer = setInterval(() => burst(cx + (Math.random() - 0.5) * R, cy + (Math.random() - 0.5) * R * 0.9, 4, Math.random() < 0.5 ? "255,255,255" : "215,163,189"), 140);
    setTimeout(() => { clearInterval(sparkleTimer); flash(); }, 3300);
    setTimeout(() => { back.classList.add("out"); front.classList.add("out"); }, 5600);
    setTimeout(() => { back.remove(); front.remove(); }, 6400);
  }
  window.addEventListener("sasha:allstars", () => { if (skin !== "glasses") pendingGlasses = true; });
  if (skin !== "glasses" && got.length >= STARS.length) pendingGlasses = true;

  faceBody.addEventListener("click", (e) => {
    e.stopPropagation();
    const pokeAs = skin === "glasses" ? "glasses_smirk" : "pout";
    // another one-shot emotion is mid-play: don't stack a second one on top
    if (character.busy() && character.emotion !== EMOTIONS[pokeAs] && !character.emotion.loop) return;
    character.play(pokeAs);
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
    if (opener && opener.dataset.justDragged) { delete opener.dataset.justDragged; return; }
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
    if (wins.blocks && wins.blocks.el.classList.contains("is-active") && blocksApi && blocksApi.key(e)) return;
    if (wins.flap && wins.flap.el.classList.contains("is-active") && flapApi && flapApi.key(e)) return;
    if (wins.dash && wins.dash.el.classList.contains("is-active") && dashApi && dashApi.key(e)) return;
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
    if (blocksApi) blocksApi.tick(dt);
    if (flapApi) flapApi.tick(dt);
    if (dashApi) dashApi.tick(dt);
    danceStep(performance.now());
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
    const urls = [SHEET.src, skin === "glasses" ? GLASSES.src : "assets/face-glasses-on.webp", "assets/face-pout.webp", "assets/face-blink.webp", "assets/face-cutout.webp", "assets/tamagotchi-with-me.png", "assets/chrome-folder.png", "assets/chrome-cursor.png", "assets/pin-silver.png"]
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
      setTimeout(openWelcome, 1500);   // greet on every entry
    }
  }
})();
