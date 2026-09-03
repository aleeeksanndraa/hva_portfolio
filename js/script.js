(() => {
  "use strict";

  const PROJECTS = [
    {
      index: "01", title: "CUSTOM BADGE", year: "2026", course: "Digital Design", role: "Concept, interaction, build", status: "Complete",
      chapters: [
        { n: "OVERVIEW", title: "A badge you make, not pick", text: "A small web tool that lets visitors of a student showcase assemble their own badge from a constrained set of shapes, then print it on site. The constraint was the point: fewer choices, better results.", media: [{ label: "FIG. 01 — FINAL TOOL, DESKTOP", kind: "wide" }] },
        { n: "BRIEF", title: "Brief", text: "Design an interactive artefact for the HvA open day that produces something physical. Two weeks, no budget for print beyond a label printer.", media: [] },
        { n: "RESEARCH", title: "Research", text: "Twelve short interviews at the entrance desk. Most visitors did not want to design anything; they wanted to leave with proof they had been there. That reframed the tool from editor to souvenir machine.", media: [{ label: "FIG. 02 — INTERVIEW NOTES", kind: "small" }, { label: "FIG. 03 — DESK OBSERVATION", kind: "small" }] },
        { n: "CONCEPT", title: "Concept", text: "Three decisions, one output. Shape, mark, name. Everything else is fixed by the system so no badge can look bad.", media: [{ label: "FIG. 04 — CONCEPT DIAGRAM", kind: "wide" }] },
        { n: "SKETCHES", title: "Sketches", text: "Paper first, at real badge size, to feel how little space there is for text.", media: [{ label: "FIG. 05 — SKETCHBOOK SPREAD", kind: "tall" }] },
        { n: "EXPERIMENTS", title: "Experiments", text: "Tested the mark set against the printer at 1:1. Thin strokes disappeared below 0.4mm, which removed half the shapes from the system.", media: [{ label: "FIG. 06 — PRINT TESTS", kind: "small" }, { label: "FIG. 07 — STROKE STUDY", kind: "small" }, { label: "FIG. 08 — REJECTED MARKS", kind: "small" }] },
        { n: "ITERATIONS", title: "Iterations", text: "Version one had a colour picker. Version two removed it. The badges got better and the queue got faster.", media: [{ label: "FIG. 09 — V1 / V2 / V3", kind: "wide" }] },
        { n: "PRODUCTION", title: "Production", text: "Built as a single page with a print stylesheet mapped to the label size. One kiosk, one printer, no accounts.", media: [{ label: "FIG. 10 — KIOSK SETUP", kind: "wide" }] },
        { n: "OUTCOME", title: "Final outcome", text: "218 badges printed over one day. The most common configuration was also the simplest one available.", media: [{ label: "FIG. 11 — BADGE COLLECTION", kind: "tall" }] },
        { n: "REFLECTION", title: "Reflection", text: "Removing options was the strongest design move I made. Next time I would test the physical constraint in week one rather than week two.", media: [] }
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
    sections.forEach((sec) => {
      sec.style.perspective = "1200px";
      sec.style.perspectiveOrigin = "50% 60%";
    });
    let di = 0;
    track.querySelectorAll("[data-p]").forEach((el) => {
      if (el.dataset.rot === undefined) {
        const m = /rotate\((-?[\d.]+)deg\)/.exec(el.getAttribute("style") || "");
        el.dataset.rot = m ? m[1] : "0";
        el.dataset.phase = String((di % 7) * 0.9 + (di % 3) * 0.4);
      }
      di++;
    });
    target = Math.min(target, max);
    current = target;
  }

  function tick(now) {
    current += (target - current) * SCROLL_EASE;
    if (Math.abs(target - current) < 0.05) current = target;
    track.style.transform = "translate3d(" + (-current).toFixed(2) + "px,0,0)";

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

        // 3D appearance reveal for text blocks, once per section entry
        const enter = Math.max(0, Math.min(1, (vw - left) / (vw * 0.65)));
        const eased = enter * enter * (3 - 2 * enter);
        const rev = sec.querySelector(".reveal");
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
              "translate3d(0," + ((1 - se) * 28).toFixed(2) + "px," + ((1 - se) * -360).toFixed(1) +
              "px) rotateX(" + ((1 - se) * 40).toFixed(2) + "deg)";
          }
        }

        // small idle movement for decorative elements only (not text)
        sec.querySelectorAll("[data-p]").forEach((el) => {
          const f = parseFloat(el.getAttribute("data-p"));
          const ph = parseFloat(el.dataset.phase || "0");
          const rot = parseFloat(el.dataset.rot || "0");
          const dx = (center - vw / 2) * f + Math.cos(now * 0.00025 + ph * 1.7) * MOVE_AMP_X;
          const dy = Math.sin(now * 0.00033 + ph) * MOVE_AMP_Y;
          const dr = Math.sin(now * 0.00021 + ph * 1.3) * MOVE_AMP_ROT;
          el.style.transform = "translate3d(" + dx.toFixed(2) + "px," + dy.toFixed(2) + "px,0) rotate(" + (rot + dr).toFixed(2) + "deg)";
        });
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

  window.addEventListener("wheel", (e) => {
    if (view !== "home") return;
    e.preventDefault();
    const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    target = Math.max(0, Math.min(max, target + d * 1.15));
  }, { passive: false });

  window.addEventListener("keydown", (e) => {
    if (view !== "home") return;
    const step = vw * 0.8;
    if (e.key === "ArrowRight") target = Math.min(max, target + step);
    if (e.key === "ArrowLeft") target = Math.max(0, target - step);
  });

  window.addEventListener("resize", () => {
    if (view === "home") measure();
  });

  root.classList.add("is-scrolling");
  measure();
  raf = requestAnimationFrame(tick);
})();
