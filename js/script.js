(() => {
  "use strict";

  const PROJECTS = [
    {
      index: "01", title: "CUSTOM BADGE", year: "2026", course: "Digital Design", role: "Concept, fabrication, styling", status: "Complete",
      chapters: [
        { n: "OVERVIEW", title: "A name tag that became a keychain", text: "Made in the first week of Digital Design, when nobody in class knew each other's names yet. What started as a slick metal debit-card concept ended up as a bedazzled clear-acrylic keychain covered in rhinestones — the material changed the whole idea.", media: [{ label: "FIG. 01 — FINAL KEYCHAIN", kind: "wide", img: "assets/process-final-bedazzled-charm.png" }] },
        { n: "BRIEF", title: "Brief", text: "Introduction week: make a personal badge with your name on it, so the class could learn who's who. The real point of the assignment was hidden inside it — a first tour of the Makers Lab, shown the laser cutter, the material stock and the 3D printer.", media: [] },
        { n: "RESEARCH", title: "Research", text: "Less research than reconnaissance: what does this lab actually have. I wanted aluminium and couldn't find any in the material stock, so the badge became a lesson in designing around what's on the shelf rather than what's in my head.", media: [{ label: "FIG. 02 — ACRYLIC MATERIAL REFERENCE", kind: "small", img: "assets/moodboard-acrylic-sheets.png" }, { label: "FIG. 03 — LASER CUTTER BRIEFING", kind: "small" }] },
        { n: "CONCEPT", title: "Concept", text: "First idea: a slim metal card, wallet-sized, name engraved into brushed aluminium — understated, a bit like a debit card. Drawn in Figma as a card shape with a cut into one edge, doubling as a bottle opener.", media: [{ label: "FIG. 04 — METAL CARD REFERENCE", kind: "wide", img: "assets/moodboard-metal-card-01.png" }] },
        { n: "SKETCHES", title: "Sketches", text: "The card outline, the bottle-opener notch and the lettering, all built as vectors in Figma before anything touched the laser cutter — the file the machine actually reads.", media: [{ label: "FIG. 05 — SKETCH & CUT PIECE", kind: "tall", img: "assets/process-sketch-vs-lasercut.png" }] },
        { n: "EXPERIMENTS", title: "Experiments", text: "No aluminium, so clear acrylic instead. First pass out of the laser cutter: the card with \"Sasha\" engraved into it, plus a set of separate 3D letters cut from the same sheet. Held up to the light, the offcuts looked exactly like jelly sweets.", media: [{ label: "FIG. 06 — FIRST LASER-CUT PIECE", kind: "small", img: "assets/process-first-lasercut-card.png" }, { label: "FIG. 07 — LOOSE ACRYLIC LETTERS", kind: "small", img: "assets/process-lasercut-letters.png" }] },
        { n: "ITERATIONS", title: "Iterations", text: "The jelly look changed the direction completely: from a slick metal card to a Y2K keychain. Raided my own nail kit for rhinestones and sparkles, bedazzled the acrylic card by hand, then built up the keychain with extra charms until it read as one deliberately messy, glamorous object.", media: [{ label: "FIG. 08 — ENGRAVED CARD, PRE-BEDAZZLE", kind: "wide", img: "assets/process-final-card-studio.png" }] },
        { n: "PRODUCTION", title: "Production", text: "Every rhinestone placed by hand, so no two badges from this batch would ever match. The 3D letters, the engraved card and the added charms were glued and wired together into one keychain.", media: [{ label: "FIG. 09 — ASSEMBLED KEYCHAIN", kind: "wide", img: "assets/process-final-keychain-detail.png" }] },
        { n: "OUTCOME", title: "Final outcome", text: "The bottle-opener notch never worked — acrylic that thin snaps before it opens anything. It's now where a hair scrunchie sits instead, which suits the badge better than the original idea did.", media: [{ label: "FIG. 10 — SCRUNCHIE ON THE HOOK", kind: "tall" }] },
        { n: "REFLECTION", title: "Reflection", text: "The best part of the badge wasn't the plan, it was the pivot: acrylic reading as jelly, jelly reading as Y2K, Y2K reading as a keychain nobody else in class had. Next time I'd let the material talk earlier instead of designing the metal version first.", media: [] }
      ]
    }
  ];

  const root = document.getElementById("root");
  const homeView = document.getElementById("home-view");
  const projectView = document.getElementById("project-view");
  const archiveView = document.getElementById("archive-view");
  const track = document.getElementById("track");
  const counterNum = document.getElementById("counter-num");
  const progressBar = document.getElementById("progress-bar");

  let view = "home";
  let currentProject = 0;
  let target = 0;
  let current = 0;
  let max = 0;
  let vw = window.innerWidth;
  let sections = [];
  let raf = null;

  const SCROLL_EASE = 0.1;
  const MOVE_AMP_X = 4;
  const MOVE_AMP_Y = 5;
  const MOVE_AMP_ROT = 1.2;
  const MOUSE_PARALLAX = 60;

  let mouseX = 0;
  let mouseY = 0;
  let mouseXEased = 0;
  let mouseYEased = 0;
  window.addEventListener("mousemove", (e) => {
    mouseX = (e.clientX / window.innerWidth) * 2 - 1;
    mouseY = (e.clientY / window.innerHeight) * 2 - 1;
  });

  function setView(next) {
    if (view === next) return;
    view = next;
    homeView.hidden = view !== "home";
    projectView.hidden = view !== "project";
    archiveView.hidden = view !== "archive";
    root.classList.toggle("is-scrolling", view === "home");
    root.classList.toggle("is-static", view !== "home");
    if (view !== "home") window.scrollTo(0, 0);
    else requestAnimationFrame(measure);
  }

  function measure() {
    if (!track) return;
    const kids = track.children;
    const last = kids[kids.length - 1];
    vw = window.innerWidth;
    max = last ? Math.max(0, last.offsetLeft + last.offsetWidth - vw) : 0;
    sections = Array.from(track.children);
    let di = 0;
    sections.forEach((sec) => {
      sec.style.perspective = "900px";
      sec.style.perspectiveOrigin = "50% 55%";
      sec.__revealEl = sec.querySelector(".reveal");
      sec.__parallaxEls = Array.from(sec.querySelectorAll("[data-p]"));
      sec.__swingEls = Array.from(sec.querySelectorAll("[data-swing]"));
      sec.__swingEls.forEach((el) => {
        if (el.dataset.phase === undefined) el.dataset.phase = String((di % 7) * 0.9 + (di % 3) * 0.4);
        di++;
      });
      sec.__parallaxEls.forEach((el) => {
        if (el.dataset.rot === undefined) {
          const m = /rotate\((-?[\d.]+)deg\)/.exec(el.getAttribute("style") || "");
          el.dataset.rot = m ? m[1] : "0";
          el.dataset.phase = String((di % 7) * 0.9 + (di % 3) * 0.4);
        }
        di++;
      });
    });
    target = Math.min(target, max);
    current = target;
  }

  function tick(now) {
    current += (target - current) * SCROLL_EASE;
    if (Math.abs(target - current) < 0.05) current = target;
    track.style.transform = "translate3d(" + (-current).toFixed(2) + "px,0,0)";

    mouseXEased += (mouseX - mouseXEased) * 0.06;
    mouseYEased += (mouseY - mouseYEased) * 0.06;

    if (progressBar) {
      const p = max > 0 ? current / max : 0;
      progressBar.style.transform = "scaleX(" + p.toFixed(4) + ")";
    }

    if (sections.length) {
      let active = 0;
      let bestDist = Infinity;
      sections.forEach((sec, i) => {
        const left = sec.offsetLeft - current;
        const center = left + sec.offsetWidth / 2;
        const dist = Math.abs(center - vw / 2);
        if (dist < bestDist) { bestDist = dist; active = i; }

        // skip offscreen sections entirely — nothing visible to animate
        if (dist > vw * 1.2) return;

        // 3D appearance reveal for text blocks, once per section entry
        const enter = Math.max(0, Math.min(1, (vw - left) / (vw * 0.65)));
        const eased = enter * enter * (3 - 2 * enter);
        const rev = sec.__revealEl;
        if (rev) {
          rev.style.opacity = "1";
          const kids = rev.children;
          for (let k = 0; k < kids.length; k++) {
            const raw = (eased - k * 0.1) / 0.9;
            const s = Math.max(0, Math.min(1, raw));
            const se = s * s * (3 - 2 * s);
            const el = kids[k];
            el.style.opacity = (0.04 + 0.96 * se).toFixed(3);
            el.style.transform =
              "translate3d(0," + ((1 - se) * 34).toFixed(2) + "px," + ((1 - se) * -520).toFixed(1) +
              "px) rotateX(" + ((1 - se) * 58).toFixed(2) + "deg)";
          }
        }

        // small idle movement for decorative elements only (not text)
        const els = sec.__parallaxEls;
        for (let k = 0; k < els.length; k++) {
          const el = els[k];
          const f = parseFloat(el.getAttribute("data-p"));
          const ph = parseFloat(el.dataset.phase || "0");
          const rot = parseFloat(el.dataset.rot || "0");
          const dx = (center - vw / 2) * f + Math.cos(now * 0.00025 + ph * 1.7) * MOVE_AMP_X + mouseXEased * MOUSE_PARALLAX * f;
          const dy = Math.sin(now * 0.00033 + ph) * MOVE_AMP_Y + mouseYEased * MOUSE_PARALLAX * f;
          const dr = Math.sin(now * 0.00021 + ph * 1.3) * MOVE_AMP_ROT;
          const dz = f * 90;
          el.style.transform = "translate3d(" + dx.toFixed(2) + "px," + dy.toFixed(2) + "px," + dz.toFixed(1) + "px) rotate(" + (rot + dr).toFixed(2) + "deg)";
        }

        // pendulum swing, pivoting from the top anchor (e.g. a keyring loop)
        const swings = sec.__swingEls;
        for (let k = 0; k < swings.length; k++) {
          const el = swings[k];
          const ph = parseFloat(el.dataset.phase || "0");
          const swing = Math.sin(now * 0.0006 + ph) * 4.5;
          el.style.transform = "rotate(" + swing.toFixed(2) + "deg)";
        }
      });

      const label = String(active + 1).padStart(2, "0");
      if (counterNum.textContent !== label) counterNum.textContent = label;
    }

    raf = requestAnimationFrame(tick);
  }

  function scrollToSection(i) {
    setView("home");
    requestAnimationFrame(() => {
      measure();
      const sec = sections[i];
      if (sec) target = Math.max(0, Math.min(max, sec.offsetLeft));
    });
  }

  function renderProjectDetail(i) {
    currentProject = i;
    const p = PROJECTS[i];
    document.getElementById("project-index").textContent = p.index;
    document.getElementById("project-title").textContent = p.title;

    const meta = document.getElementById("project-meta");
    meta.innerHTML = "";
    [
      ["YEAR", p.year],
      ["COURSE", p.course],
      ["ROLE", p.role],
      ["STATUS", p.status]
    ].forEach(([label, value]) => {
      const col = document.createElement("div");
      col.innerHTML = '<div class="meta-label">' + label + "</div><div>" + value + "</div>";
      meta.appendChild(col);
    });

    const chaptersEl = document.getElementById("chapters");
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
  }

  function openProject(i) {
    renderProjectDetail(i);
    setView("project");
  }

  function renderArchive() {
    const list = document.getElementById("archive-list");
    list.innerHTML = "";

    PROJECTS.forEach((p, i) => {
      const row = document.createElement("div");
      row.className = "archive-row";
      row.dataset.action = "open-project";
      row.dataset.index = String(i);
      row.innerHTML =
        "<div>" + p.index + "</div>" +
        '<div class="archive-project-title">' + p.title + "</div>" +
        "<div>" + p.course + "</div>" +
        "<div>" + p.year + "</div>" +
        '<div class="archive-mark">→</div>';
      list.appendChild(row);
    });

    // slots reserved for projects still to be added
    for (let n = PROJECTS.length + 1; n <= 3; n++) {
      const row = document.createElement("div");
      row.className = "archive-row is-placeholder";
      row.innerHTML =
        "<div>" + String(n).padStart(2, "0") + "</div>" +
        '<div class="archive-project-title">Project —</div>' +
        "<div>—</div>" +
        "<div>—</div>" +
        '<div class="archive-mark">—</div>';
      list.appendChild(row);
    }

    const end = document.createElement("div");
    end.className = "archive-list-end";
    list.appendChild(end);
  }

  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-action]");
    if (!el) return;
    const action = el.dataset.action;
    switch (action) {
      case "home": scrollToSection(0); break;
      case "projects": scrollToSection(1); break;
      case "about": scrollToSection(2); break;
      case "archive": renderArchive(); setView("archive"); break;
      case "open-project": openProject(parseInt(el.dataset.index, 10)); break;
    }
  });

  let snapTimer = null;

  function nearestSectionIndex(pos) {
    let idx = 0;
    let best = Infinity;
    sections.forEach((sec, i) => {
      const d = Math.abs(sec.offsetLeft - pos);
      if (d < best) { best = d; idx = i; }
    });
    return idx;
  }

  function snapToNearest() {
    if (!sections.length) return;
    const idx = nearestSectionIndex(target);
    target = Math.max(0, Math.min(max, sections[idx].offsetLeft));
  }

  window.addEventListener("wheel", (e) => {
    if (view !== "home") return;
    e.preventDefault();
    const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    target = Math.max(0, Math.min(max, target + d * 1.15));
    clearTimeout(snapTimer);
    snapTimer = setTimeout(snapToNearest, 160);
  }, { passive: false });

  window.addEventListener("keydown", (e) => {
    if (view !== "home") return;
    clearTimeout(snapTimer);
    if (e.key === "ArrowRight") {
      const idx = Math.min(sections.length - 1, nearestSectionIndex(target) + 1);
      target = sections[idx].offsetLeft;
    }
    if (e.key === "ArrowLeft") {
      const idx = Math.max(0, nearestSectionIndex(target) - 1);
      target = sections[idx].offsetLeft;
    }
  });

  window.addEventListener("resize", () => {
    if (view === "home") measure();
  });

  root.classList.add("is-scrolling");
  measure();
  raf = requestAnimationFrame(tick);
})();
