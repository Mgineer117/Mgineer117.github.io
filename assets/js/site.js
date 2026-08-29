/* ==========================================================================
   site.js — hero field animation + home interactions
   No dependencies. Everything degrades gracefully if a piece is absent.
   ========================================================================== */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ------------------------------------------------------------------ */
  /* Hero fields                                                         */
  /*                                                                     */
  /* One tiny canvas engine, one field per section, picked with          */
  /* data-field on the canvas. Each field is {seed, step, draw, settle}: */
  /* seed builds state for the current size, step advances it, draw      */
  /* paints it, settle is how many frames to pre-run for a static frame  */
  /* under prefers-reduced-motion.                                       */
  /* ------------------------------------------------------------------ */

  var BLUE = "138,183,255";
  var ACCENT = "232,74,39";

  var FIELDS = {

    /* home — perturbed trajectories contracting onto a reference path */
    contract: {
      settle: 240,
      seed: function (W) {
        var n = W < 620 ? 12 : W < 1000 ? 20 : 30;
        var agents = [];
        for (var i = 0; i < n; i++) agents.push(this.spawn(true));
        return { agents: agents };
      },
      spawn: function (seeded) {
        return {
          x: seeded ? Math.random() * 1.1 - 0.05 : -0.06 - Math.random() * 0.25,
          y: Math.random(),
          v: 0.055 + Math.random() * 0.055,
          k: 0.9 + Math.random() * 1.5,
          trail: [],
          lead: Math.random() < 0.16,
          nextKick: 0.15 + Math.random() * 0.5
        };
      },
      ref: function (x, t) {
        return 0.5 +
          0.155 * Math.sin(x * 5.6 + t * 0.16) +
          0.055 * Math.sin(x * 11.3 - t * 0.11);
      },
      step: function (st, dt, t) {
        for (var i = 0; i < st.agents.length; i++) {
          var a = st.agents[i];
          a.x += a.v * dt;
          if (a.x > a.nextKick) {                    /* a disturbance, so the */
            a.y += (Math.random() - 0.5) * 0.42;     /* pull back is visible  */
            a.nextKick = a.x + 0.4 + Math.random() * 0.7;
          }
          a.y += (this.ref(a.x, t) - a.y) * (1 - Math.exp(-a.k * dt));
          a.y = Math.max(-0.15, Math.min(1.15, a.y));
          a.trail.push(a.x, a.y);
          if (a.trail.length > 64) a.trail.splice(0, 2);
          if (a.x > 1.12) st.agents[i] = this.spawn(false);
        }
      },
      draw: function (ctx, st, t, W, H) {
        var x, y;

        ctx.beginPath();                              /* the corridor */
        for (x = -0.05; x <= 1.06; x += 0.01) {
          y = this.ref(x, t) - 0.045;
          if (x < -0.04) ctx.moveTo(x * W, y * H); else ctx.lineTo(x * W, y * H);
        }
        for (x = 1.06; x >= -0.05; x -= 0.01) ctx.lineTo(x * W, (this.ref(x, t) + 0.045) * H);
        ctx.closePath();
        ctx.fillStyle = "rgba(120,170,255,0.045)";
        ctx.fill();

        ctx.beginPath();                              /* the reference itself */
        for (x = -0.05; x <= 1.06; x += 0.008) {
          y = this.ref(x, t);
          if (x < -0.04) ctx.moveTo(x * W, y * H); else ctx.lineTo(x * W, y * H);
        }
        ctx.strokeStyle = "rgba(255,255,255,0.20)";
        ctx.lineWidth = 1.15;
        ctx.setLineDash([5, 7]);
        ctx.stroke();
        ctx.setLineDash([]);

        for (var i = 0; i < st.agents.length; i++) {
          var a = st.agents[i], pts = a.trail;
          if (pts.length < 4) continue;
          var hue = a.lead ? ACCENT : BLUE;
          ctx.lineWidth = a.lead ? 1.5 : 1.1;
          ctx.lineCap = "round";
          for (var j = 2; j < pts.length; j += 2) {
            var f = j / pts.length;
            ctx.beginPath();
            ctx.moveTo(pts[j - 2] * W, pts[j - 1] * H);
            ctx.lineTo(pts[j] * W, pts[j + 1] * H);
            ctx.strokeStyle = "rgba(" + hue + "," + (f * (a.lead ? 0.5 : 0.34)).toFixed(3) + ")";
            ctx.stroke();
          }
          ctx.beginPath();
          ctx.arc(a.x * W, a.y * H, a.lead ? 2.6 : 1.8, 0, Math.PI * 2);
          ctx.fillStyle = a.lead ? "rgba(232,74,39,0.95)" : "rgba(190,215,255,0.8)";
          ctx.fill();
        }
      }
    },

    /* publications — streamlines through a slowly turning phase field */
    flow: {
      settle: 200,
      angle: function (x, y, t, W, H) {
        var nx = x / W, ny = y / H;
        return Math.sin(nx * 3.4 + t * 0.13) * 1.35
             + Math.cos(ny * 2.9 - t * 0.10) * 1.15
             + Math.sin((nx + ny) * 2.2 + t * 0.06) * 0.9;
      },
      seed: function (W, H) {
        var n = W < 620 ? 14 : W < 1000 ? 22 : 32;
        var agents = [];
        for (var i = 0; i < n; i++) agents.push(this.spawn(W, H, true));
        return { agents: agents };
      },
      spawn: function (W, H, seeded) {
        return {
          x: Math.random() * W,
          y: Math.random() * H,
          life: seeded ? Math.random() * 6 : 0,
          maxLife: 5 + Math.random() * 5,
          sp: (W * 0.030) * (0.7 + Math.random() * 0.7),
          trail: [],
          lead: Math.random() < 0.15
        };
      },
      step: function (st, dt, t, W, H) {
        for (var i = 0; i < st.agents.length; i++) {
          var a = st.agents[i];
          var ang = this.angle(a.x, a.y, t, W, H);
          a.x += Math.cos(ang) * a.sp * dt;
          a.y += Math.sin(ang) * a.sp * dt;
          a.life += dt;
          a.trail.push(a.x, a.y);
          if (a.trail.length > 34) a.trail.splice(0, 2);
          if (a.life > a.maxLife || a.x < -60 || a.x > W + 60 || a.y < -60 || a.y > H + 60) {
            st.agents[i] = this.spawn(W, H, false);
          }
        }
      },
      draw: function (ctx, st) {
        ctx.lineCap = "round";
        for (var i = 0; i < st.agents.length; i++) {
          var a = st.agents[i], pts = a.trail;
          if (pts.length < 4) continue;
          /* fade in at birth, out at death, so nothing pops */
          var e = a.life / a.maxLife;
          var env = Math.min(1, e * 6) * Math.min(1, (1 - e) * 4);
          var hue = a.lead ? ACCENT : BLUE;
          ctx.lineWidth = a.lead ? 1.5 : 1.1;
          for (var j = 2; j < pts.length; j += 2) {
            var f = j / pts.length;
            ctx.beginPath();
            ctx.moveTo(pts[j - 2], pts[j - 1]);
            ctx.lineTo(pts[j], pts[j + 1]);
            ctx.strokeStyle = "rgba(" + hue + "," + (f * env * (a.lead ? 0.55 : 0.34)).toFixed(3) + ")";
            ctx.stroke();
          }
          ctx.beginPath();
          ctx.arc(a.x, a.y, a.lead ? 2.4 : 1.6, 0, Math.PI * 2);
          ctx.fillStyle = a.lead
            ? "rgba(232,74,39," + (0.9 * env).toFixed(3) + ")"
            : "rgba(190,215,255," + (0.75 * env).toFixed(3) + ")";
          ctx.fill();
        }
      }
    },

    /* projects — interfering wavefronts (the PDE and multi-phase flow work) */
    waves: {
      settle: 120,
      seed: function (W, H) {
        return {
          src: [
            { bx: W * 0.24, by: H * 0.62, sp: 62, lead: false },
            { bx: W * 0.62, by: H * 0.34, sp: 48, lead: true },
            { bx: W * 0.86, by: H * 0.74, sp: 71, lead: false }
          ],
          maxR: Math.max(W, H) * 0.78
        };
      },
      step: function () { /* fully parameterised by t */ },
      draw: function (ctx, st, t, W, H) {
        ctx.globalCompositeOperation = "lighter";
        ctx.lineWidth = 1.05;
        for (var i = 0; i < st.src.length; i++) {
          var s = st.src[i];
          var cx = s.bx + Math.sin(t * 0.07 + i * 2.1) * W * 0.035;
          var cy = s.by + Math.cos(t * 0.05 + i * 1.4) * H * 0.045;
          var gap = st.maxR / 7;
          for (var k = 0; k < 8; k++) {
            var r = (t * s.sp + k * gap) % st.maxR;
            if (r < 4) continue;
            var a = (1 - r / st.maxR);
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.strokeStyle = "rgba(" + (s.lead ? ACCENT : BLUE) + "," +
              (a * a * (s.lead ? 0.16 : 0.13)).toFixed(3) + ")";
            ctx.stroke();
          }
          ctx.beginPath();
          ctx.arc(cx, cy, 2.2, 0, Math.PI * 2);
          ctx.fillStyle = s.lead ? "rgba(232,74,39,0.75)" : "rgba(190,215,255,0.55)";
          ctx.fill();
        }
        ctx.globalCompositeOperation = "source-over";
      }
    },

    /* teaching — orbits and rigid-body traces (AE352 / AE353) */
    orbits: {
      settle: 260,
      seed: function (W, H) {
        var base = Math.min(W, H);
        var orbits = [];
        var n = W < 620 ? 4 : 6;
        for (var i = 0; i < n; i++) {
          var k = (i + 1) / n;
          orbits.push({
            a: base * (0.16 + k * 0.42),
            b: base * (0.10 + k * 0.30),
            rot: (i * 0.6) + 0.35,
            period: 9 + i * 5.5,
            phase: Math.random() * Math.PI * 2,
            lead: i === 2
          });
        }
        return { orbits: orbits, cx: W * 0.5, cy: H * 0.52 };
      },
      step: function () { /* fully parameterised by t */ },
      at: function (o, ang, st) {
        var x = o.a * Math.cos(ang), y = o.b * Math.sin(ang);
        var c = Math.cos(o.rot), s = Math.sin(o.rot);
        return [st.cx + x * c - y * s, st.cy + x * s + y * c];
      },
      draw: function (ctx, st, t) {
        for (var i = 0; i < st.orbits.length; i++) {
          var o = st.orbits[i];

          ctx.beginPath();                                   /* the path */
          ctx.ellipse(st.cx, st.cy, o.a, o.b, o.rot, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(" + BLUE + ",0.10)";
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 6]);
          ctx.stroke();
          ctx.setLineDash([]);

          var ang = o.phase + (t * Math.PI * 2) / o.period;
          var hue = o.lead ? ACCENT : BLUE;

          ctx.lineWidth = o.lead ? 1.6 : 1.2;                /* the trail */
          ctx.lineCap = "round";
          for (var j = 0; j < 18; j++) {
            var p0 = this.at(o, ang - (j + 1) * 0.045, st);
            var p1 = this.at(o, ang - j * 0.045, st);
            ctx.beginPath();
            ctx.moveTo(p0[0], p0[1]);
            ctx.lineTo(p1[0], p1[1]);
            ctx.strokeStyle = "rgba(" + hue + "," + ((1 - j / 18) * (o.lead ? 0.55 : 0.36)).toFixed(3) + ")";
            ctx.stroke();
          }

          var p = this.at(o, ang, st);                       /* the body */
          ctx.beginPath();
          ctx.arc(p[0], p[1], o.lead ? 3 : 2, 0, Math.PI * 2);
          ctx.fillStyle = o.lead ? "rgba(232,74,39,0.95)" : "rgba(200,222,255,0.85)";
          ctx.fill();
        }

        ctx.beginPath();                                     /* the primary */
        ctx.arc(st.cx, st.cy, 3.4, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.fill();
      }
    },

    /* blog — one continuous curve, drawn like a plotter and slowly evolving */
    trace: {
      settle: 900,
      seed: function (W, H) {
        return { pts: [], p: 0, cx: W * 0.5, cy: H * 0.52, rx: W * 0.34, ry: H * 0.30 };
      },
      step: function (st, dt, t) {
        var steps = 6;                       /* sub-sample so the line is smooth */
        for (var i = 0; i < steps; i++) {
          st.p += (dt / steps) * 0.85;
          var d = 0.9 + Math.sin(t * 0.045) * 0.7;      /* the figure morphs */
          st.pts.push(
            st.cx + st.rx * Math.sin(st.p * 1.00 + d),
            st.cy + st.ry * Math.sin(st.p * 1.41)
          );
        }
        while (st.pts.length > 1500) st.pts.splice(0, 2);
      },
      draw: function (ctx, st) {
        var pts = st.pts, n = pts.length;
        if (n < 6) return;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        var chunk = 2;                       /* stroke every other segment */
        for (var j = 2; j < n; j += chunk * 2) {
          var f = j / n;
          ctx.beginPath();
          ctx.moveTo(pts[j - 2], pts[j - 1]);
          for (var k = 0; k < chunk && j + k * 2 + 1 < n; k++) {
            ctx.lineTo(pts[j + k * 2], pts[j + k * 2 + 1]);
          }
          ctx.lineWidth = 0.7 + f * 0.9;
          ctx.strokeStyle = "rgba(" + BLUE + "," + (f * f * 0.42).toFixed(3) + ")";
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(pts[n - 2], pts[n - 1], 2.6, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(232,74,39,0.9)";
        ctx.fill();
      }
    }
  };

  function heroField() {
    var canvas = document.getElementById("hero-field");
    if (!canvas || !canvas.getContext) return;

    var field = FIELDS[canvas.getAttribute("data-field")] || FIELDS.contract;
    var ctx = canvas.getContext("2d");
    var W = 0, H = 0, dpr = 1, t = 0, raf = null, visible = true, state = null;

    function resize() {
      var rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = rect.width;
      H = rect.height;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      state = field.seed(W, H);
    }

    function paint() {
      ctx.clearRect(0, 0, W, H);
      field.draw(ctx, state, t, W, H);
    }

    var last = 0;
    function loop(now) {
      raf = window.requestAnimationFrame(loop);
      if (!last) last = now;
      var dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      t += dt;
      field.step(state, dt, t, W, H);
      paint();
    }

    function start() {
      if (raf || !visible) return;
      last = 0;
      raf = window.requestAnimationFrame(loop);
    }
    function stop() {
      if (raf) { window.cancelAnimationFrame(raf); raf = null; }
    }

    function begin() {
      if (reduceMotion) {
        var n = field.settle || 200;
        for (var i = 0; i < n; i++) { t += 0.03; field.step(state, 0.03, t, W, H); }
        paint();
        return;
      }

      var rt;
      window.addEventListener("resize", function () {
        clearTimeout(rt);
        rt = setTimeout(resize, 180);
      }, { passive: true });

      document.addEventListener("visibilitychange", function () {
        if (document.hidden) stop(); else start();
      });

      if ("IntersectionObserver" in window) {
        new IntersectionObserver(function (entries) {
          visible = entries[0].isIntersecting;
          if (visible) start(); else stop();
        }, { threshold: 0 }).observe(canvas);
      }

      start();
    }

    /* the canvas can still measure zero if fonts or layout haven't settled */
    resize();
    if (state) {
      begin();
    } else {
      var tries = 0;
      (function retry() {
        resize();
        if (state) return begin();
        if (++tries < 30) window.requestAnimationFrame(retry);
      })();
    }
  }

  /* ------------------------------------------------------------------ */
  /* Reel: swap poster for the animation on hover (fine pointer) or tap  */
  /* ------------------------------------------------------------------ */
  function reel() {
    var stages = document.querySelectorAll(".reel-stage");
    if (!stages.length) return;

    var fine = window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches;

    Array.prototype.forEach.call(stages, function (stage) {
      var img = stage.querySelector("img");
      var src = stage.getAttribute("data-clip");
      if (!img || !src) return;
      var timer = null;

      function play() {
        if (stage.classList.contains("is-playing") || stage.dataset.loading) return;
        stage.dataset.loading = "1";
        var pre = new Image();
        pre.onload = function () {
          img.src = src;
          stage.classList.add("is-playing");
          stage.setAttribute("aria-pressed", "true");
        };
        pre.src = src;
      }

      stage.addEventListener("click", play);
      if (fine) {
        stage.addEventListener("mouseenter", function () {
          timer = setTimeout(play, 260);   /* don't burn data on a mouse sweep */
        });
        stage.addEventListener("mouseleave", function () { clearTimeout(timer); });
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /* Tag filters — shared by the home grid, /publications/ and /projects/ */
  /* ------------------------------------------------------------------ */
  function filters() {
    var roots = document.querySelectorAll("[data-filter-root]");
    if (!roots.length) return;

    Array.prototype.forEach.call(roots, function (root) {
      var buttons = root.querySelectorAll(".filter-btn");
      var items = root.querySelectorAll(root.getAttribute("data-filter-items") || "[data-tags]");
      var groups = root.querySelectorAll("[data-filter-group]");
      var syncUrl = root.hasAttribute("data-filter-url");
      if (!buttons.length || !items.length) return;

      function apply(tag) {
        Array.prototype.forEach.call(items, function (item) {
          var tags = (item.getAttribute("data-tags") || "").split(",").map(function (s) { return s.trim(); });
          item.classList.toggle("is-hidden", !(tag === "all" || tags.indexOf(tag) !== -1));
        });

        /* hide a category heading once everything under it is filtered out */
        Array.prototype.forEach.call(groups, function (group) {
          var kids = group.querySelectorAll(root.getAttribute("data-filter-items") || "[data-tags]");
          var any = false;
          Array.prototype.forEach.call(kids, function (k) {
            if (!k.classList.contains("is-hidden")) any = true;
          });
          group.classList.toggle("is-hidden", kids.length > 0 && !any);
        });
      }

      function select(btn, push) {
        Array.prototype.forEach.call(buttons, function (b) { b.classList.remove("is-active"); });
        btn.classList.add("is-active");
        var tag = btn.getAttribute("data-tag");
        apply(tag);
        if (push && syncUrl && window.history && window.history.pushState) {
          var url = tag === "all"
            ? window.location.pathname
            : window.location.pathname + "?tag=" + encodeURIComponent(tag);
          window.history.pushState({}, "", url);
        }
      }

      Array.prototype.forEach.call(buttons, function (btn) {
        btn.addEventListener("click", function () { select(btn, true); });
      });

      var initial = null;
      if (syncUrl && window.URLSearchParams) {
        var wanted = new URLSearchParams(window.location.search).get("tag");
        if (wanted) {
          Array.prototype.forEach.call(buttons, function (b) {
            if (b.getAttribute("data-tag") === wanted) initial = b;
          });
        }
      }
      select(initial || buttons[0], false);
    });
  }

  /* ------------------------------------------------------------------ */
  /* News: collapse the tail behind a toggle                             */
  /* ------------------------------------------------------------------ */
  function news() {
    var list = document.getElementById("news-list");
    var btn = document.getElementById("news-more");
    if (!list || !btn) return;

    var rows = list.querySelectorAll(".news-row");
    var keep = 5;
    if (rows.length <= keep) { btn.style.display = "none"; return; }

    var open = false;
    function render() {
      Array.prototype.forEach.call(rows, function (row, i) {
        row.classList.toggle("is-hidden", !open && i >= keep);
      });
      btn.textContent = open ? "Show less" : "Show all " + rows.length + " updates";
      btn.setAttribute("aria-expanded", open ? "true" : "false");
    }
    btn.addEventListener("click", function () { open = !open; render(); });
    render();
  }

  /* ------------------------------------------------------------------ */
  /* Scroll reveal                                                       */
  /* ------------------------------------------------------------------ */
  function reveal() {
    var root = document.documentElement;
    root.className += " reveal-ready";           /* tells the head script we made it */

    var els = document.querySelectorAll(".reveal");
    if (!els.length || reduceMotion || !("IntersectionObserver" in window)) {
      root.className = root.className.replace(" reveal-on", "");
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.06 });
    Array.prototype.forEach.call(els, function (el) { io.observe(el); });
  }

  function init() {
    heroField();
    reel();
    filters();
    news();
    reveal();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
