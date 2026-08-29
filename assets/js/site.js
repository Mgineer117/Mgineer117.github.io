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
  /* One canvas engine, one field per section, picked with data-field on */
  /* the canvas. A field is {seed, step, draw, pulse, settle}: seed       */
  /* builds state for the current size, step advances it, draw paints it, */
  /* pulse reacts to a click, settle is how many frames to pre-run for a  */
  /* static frame under prefers-reduced-motion.                          */
  /*                                                                     */
  /* Every step/draw also receives `ptr`, the pointer over the cover:     */
  /* {x, y, inside, active} in canvas pixels, where active eases 0..1 so  */
  /* the field relaxes rather than snapping when the pointer leaves.      */
  /* ------------------------------------------------------------------ */

  var BLUE = "138,183,255";
  var ACCENT = "232,74,39";

  var FIELDS = {

    /* home — trajectories contracting onto a reference path.
       The pointer acts as a second, moving reference: trajectories near it
       break away and track it, then contract back once it leaves. */
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
      step: function (st, dt, t, W, H, ptr) {
        var R = ptr ? ptr.r : Math.min(W, H) * 0.46;
        for (var i = 0; i < st.agents.length; i++) {
          var a = st.agents[i];
          a.x += a.v * dt;

          if (a.x > a.nextKick) {                    /* an autonomous disturbance */
            a.y += (Math.random() - 0.5) * 0.42;
            a.nextKick = a.x + 0.4 + Math.random() * 0.7;
          }

          /* inside the pointer's radius a trajectory tracks the pointer, and
             the closer it gets the less the real reference holds it */
          var hold = 1;
          if (ptr && ptr.active > 0.01) {
            var dx = ptr.x - a.x * W, dy = ptr.y - a.y * H;
            var d = Math.sqrt(dx * dx + dy * dy);
            if (d < R) {
              var f = (1 - d / R) * ptr.active;
              a.y += (dy / H) * f * 3.8 * dt;
              a.x += (dx / W) * f * 0.35 * dt;
              hold = 1 - 0.88 * f;
            }
          }

          a.y += (this.ref(a.x, t) - a.y) * (1 - Math.exp(-a.k * hold * dt));
          a.y = Math.max(-0.2, Math.min(1.2, a.y));
          a.trail.push(a.x, a.y);
          if (a.trail.length > 64) a.trail.splice(0, 2);
          if (a.x > 1.12) st.agents[i] = this.spawn(false);
        }
      },
      pulse: function (st, x, y, W, H) {            /* a click gathers them in */
        var R = Math.max(340, Math.min(W, H) * 0.9);
        for (var i = 0; i < st.agents.length; i++) {
          var a = st.agents[i];
          var dx = x - a.x * W, dy = y - a.y * H;
          var d = Math.sqrt(dx * dx + dy * dy);
          if (d < R) {
            var f = 1 - d / R;
            a.y += (dy / H) * f * 0.9;
            a.x += (dx / W) * f * 0.3;
            a.y = Math.max(-0.2, Math.min(1.2, a.y));
          }
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

    /* publications — streamlines through a turning phase field.
       Streamlines near the pointer spiral in and follow it; a click draws
       them in hard. */
    flow: {
      settle: 200,
      angle: function (x, y, t, W, H) {
        var nx = x / W, ny = y / H;
        return Math.sin(nx * 3.4 + t * 0.13) * 1.35
             + Math.cos(ny * 2.9 - t * 0.10) * 1.15
             + Math.sin((nx + ny) * 2.2 + t * 0.06) * 0.9;
      },
      seed: function (W, H) {
        var n = W < 620 ? 18 : W < 1000 ? 30 : 44;
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
      step: function (st, dt, t, W, H, ptr) {
        var R = ptr ? ptr.r : Math.min(W, H) * 0.5;
        for (var i = 0; i < st.agents.length; i++) {
          var a = st.agents[i];
          var ang = this.angle(a.x, a.y, t, W, H);
          a.x += Math.cos(ang) * a.sp * dt;
          a.y += Math.sin(ang) * a.sp * dt;

          if (ptr && ptr.active > 0.01) {
            var dx = a.x - ptr.x, dy = a.y - ptr.y;
            var d = Math.sqrt(dx * dx + dy * dy);
            if (d > 0.5 && d < R) {
              var f = (1 - d / R) * ptr.active;
              /* pull toward the pointer, with enough swirl to spiral rather
                 than fall straight in */
              a.x += (-dx / d) * f * 72 * dt + (-dy / d) * f * 108 * dt;
              a.y += (-dy / d) * f * 72 * dt + ( dx / d) * f * 108 * dt;
            }
          }

          a.life += dt;
          a.trail.push(a.x, a.y);
          if (a.trail.length > 34) a.trail.splice(0, 2);
          if (a.life > a.maxLife || a.x < -60 || a.x > W + 60 || a.y < -60 || a.y > H + 60) {
            st.agents[i] = this.spawn(W, H, false);
          }
        }
      },
      pulse: function (st, x, y, W, H) {            /* a click draws them in */
        var R = Math.max(360, Math.min(W, H) * 0.95);
        for (var i = 0; i < st.agents.length; i++) {
          var a = st.agents[i];
          var dx = x - a.x, dy = y - a.y;
          var d = Math.sqrt(dx * dx + dy * dy) || 1;
          if (d < R) {
            var f = (1 - d / R) * 0.5;
            a.x += dx * f;
            a.y += dy * f;
            a.trail.length = 0;
          }
        }
      },
      draw: function (ctx, st) {
        ctx.lineCap = "round";
        for (var i = 0; i < st.agents.length; i++) {
          var a = st.agents[i], pts = a.trail;
          if (pts.length < 4) continue;
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

    /* projects — interfering wavefronts. The pointer is a live source and a
       click drops a lasting one, so you can build up your own interference. */
    waves: {
      settle: 120,
      seed: function (W, H) {
        return {
          src: [
            { bx: W * 0.24, by: H * 0.62, sp: 62, lead: false },
            { bx: W * 0.62, by: H * 0.34, sp: 48, lead: true },
            { bx: W * 0.86, by: H * 0.74, sp: 71, lead: false }
          ],
          drops: [],
          maxR: Math.max(W, H) * 0.78
        };
      },
      step: function (st, dt) {
        for (var i = st.drops.length - 1; i >= 0; i--) {
          st.drops[i].age += dt;
          if (st.drops[i].age > 6) st.drops.splice(i, 1);
        }
      },
      pulse: function (st, x, y) {
        st.drops.push({ x: x, y: y, age: 0 });
        if (st.drops.length > 6) st.drops.shift();
      },
      rings: function (ctx, cx, cy, phase, maxR, rgb, gain) {
        var gap = maxR / 7;
        for (var k = 0; k < 8; k++) {
          var r = (phase + k * gap) % maxR;
          if (r < 4) continue;
          var a = 1 - r / maxR;
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(" + rgb + "," + (a * a * gain).toFixed(3) + ")";
          ctx.stroke();
        }
      },
      draw: function (ctx, st, t, W, H, ptr) {
        ctx.globalCompositeOperation = "lighter";
        ctx.lineWidth = 1.05;

        for (var i = 0; i < st.src.length; i++) {
          var s = st.src[i];
          var cx = s.bx + Math.sin(t * 0.07 + i * 2.1) * W * 0.035;
          var cy = s.by + Math.cos(t * 0.05 + i * 1.4) * H * 0.045;
          this.rings(ctx, cx, cy, t * s.sp, st.maxR, s.lead ? ACCENT : BLUE, s.lead ? 0.16 : 0.13);
          ctx.beginPath();
          ctx.arc(cx, cy, 2.2, 0, Math.PI * 2);
          ctx.fillStyle = s.lead ? "rgba(232,74,39,0.75)" : "rgba(190,215,255,0.55)";
          ctx.fill();
        }

        for (var d = 0; d < st.drops.length; d++) {          /* clicked sources */
          var dr = st.drops[d];
          var fade = Math.max(0, 1 - dr.age / 6);
          this.rings(ctx, dr.x, dr.y, dr.age * 96, st.maxR * 0.8, ACCENT, 0.26 * fade);
        }

        if (ptr && ptr.active > 0.01) {                      /* the pointer itself */
          this.rings(ctx, ptr.x, ptr.y, t * 84, st.maxR * 0.55, BLUE, 0.2 * ptr.active);
        }

        ctx.globalCompositeOperation = "source-over";
      }
    },

    /* teaching — orbits. The pointer pulls the primary, so the whole system
       leans toward it; a click re-phases every body at once. */
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
        return { orbits: orbits, cx: W * 0.5, cy: H * 0.52, hx: W * 0.5, hy: H * 0.52 };
      },
      step: function (st, dt, t, W, H, ptr) {
        var tx = W * 0.5, ty = H * 0.52;
        if (ptr && ptr.active > 0.01) {
          tx += (ptr.x - W * 0.5) * 0.3 * ptr.active;
          ty += (ptr.y - H * 0.52) * 0.3 * ptr.active;
        }
        var k = 1 - Math.exp(-2.2 * dt);
        st.cx += (tx - st.cx) * k;
        st.cy += (ty - st.cy) * k;
      },
      pulse: function (st) {
        for (var i = 0; i < st.orbits.length; i++) {
          st.orbits[i].phase += (Math.random() - 0.5) * 2.4;
        }
      },
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

    /* blog — one continuous curve drawn like a plotter. The pen follows the
       pointer; a click changes the figure it is drawing. */
    /* publication / project / teaching detail pages — a lattice under load.
       Every other field here is loose particles; this one is a connected
       sheet, so the interaction reads as deformation rather than drift. Nodes
       are sprung to a rest grid and pulled toward the pointer, and a click
       sends a ring travelling outward through the mesh. Where the sheet is
       stretched it brightens, so the shape of the disturbance is the only
       cursor the page needs. */
    lattice: {
      settle: 60,
      seed: function (W, H) {
        var sp = Math.max(44, Math.min(72, W / 24));
        var cols = Math.ceil(W / sp) + 1;
        var rows = Math.ceil(H / sp) + 1;
        var ox = (W - (cols - 1) * sp) / 2;
        var oy = (H - (rows - 1) * sp) / 2;
        var nodes = [];
        for (var r = 0; r < rows; r++) {
          for (var c = 0; c < cols; c++) {
            var rx = ox + c * sp, ry = oy + r * sp;
            nodes.push({
              rx: rx, ry: ry, x: rx, y: ry, vx: 0, vy: 0,
              ph: (c * 0.55 + r * 0.9)          /* keeps the idle drift from marching in step */
            });
          }
        }
        return { nodes: nodes, cols: cols, rows: rows, sp: sp, drops: [] };
      },

      step: function (st, dt, t, W, H, ptr) {
        var R = ptr ? ptr.r : Math.min(W, H) * 0.6;
        var drops = st.drops;

        for (var i = drops.length - 1; i >= 0; i--) {
          drops[i].age += dt;
          if (drops[i].age > 2.4) drops.splice(i, 1);
        }

        var K = 26;                                   /* spring back to rest  */
        var damp = Math.exp(-5.2 * dt);
        var band = st.sp * 1.5;

        for (var n = 0; n < st.nodes.length; n++) {
          var a = st.nodes[n];
          var fx = 0, fy = 0;

          /* the pointer is a weight on the sheet: nearby nodes lean into it */
          if (ptr && ptr.active > 0.01) {
            var dx = ptr.x - a.rx, dy = ptr.y - a.ry;
            var d = Math.sqrt(dx * dx + dy * dy);
            if (d > 0.5 && d < R) {
              var w = (1 - d / R);
              w = w * w * ptr.active;
              fx += (dx / d) * w * 950;
              fy += (dy / d) * w * 950;
            }
          }

          /* a click travels outward as a ring of displacement */
          for (var k = 0; k < drops.length; k++) {
            var dr = drops[k];
            var ex = a.rx - dr.x, ey = a.ry - dr.y;
            var ed = Math.sqrt(ex * ex + ey * ey) || 1;
            var ring = dr.age * 460;
            var off = (ed - ring) / band;
            var amp = Math.exp(-off * off) * Math.exp(-dr.age * 1.5);
            if (amp > 0.002) {
              fx += (ex / ed) * amp * 1500;
              fy += (ey / ed) * amp * 1500;
            }
          }

          /* A travelling swell so the sheet is never completely still. The
             phase comes from rest position, not from the node index, so it
             reads as one wave crossing the mesh instead of per-node jitter.
             Amplitude lands near force/K pixels, the spring being stiff
             relative to how slowly this term turns over. */
          fx += Math.sin(t * 0.50 + a.rx * 0.0090 + a.ry * 0.0140) * 118;
          fy += Math.cos(t * 0.41 + a.rx * 0.0115 - a.ry * 0.0075) * 104;

          fx += (a.rx - a.x) * K;
          fy += (a.ry - a.y) * K;

          a.vx = (a.vx + fx * dt) * damp;
          a.vy = (a.vy + fy * dt) * damp;
          a.x += a.vx * dt;
          a.y += a.vy * dt;
        }
      },

      pulse: function (st, x, y) {
        st.drops.push({ x: x, y: y, age: 0 });
        if (st.drops.length > 4) st.drops.shift();
      },

      draw: function (ctx, st) {
        var nodes = st.nodes, cols = st.cols, rows = st.rows, sp = st.sp;
        ctx.lineCap = "round";

        /* Strain per node, reused by both passes: how far it has been pulled
           off its rest position, normalised against the grid pitch. */
        for (var i = 0; i < nodes.length; i++) {
          var a = nodes[i];
          var ex = a.x - a.rx, ey = a.y - a.ry;
          a.s = Math.min(1, Math.sqrt(ex * ex + ey * ey) / (sp * 0.85));
        }

        /* Two passes. Everything slack shares one colour, so it goes into a
           single path and costs one stroke; only the segments actually under
           load need their own. At rest that is one stroke call for the whole
           mesh instead of one per edge. */
        var hot = [];
        function seg(p, q) {
          var st2 = (p.s + q.s) * 0.5;
          /* The idle swell alone reaches ~0.14 strain, so the cut sits above
             that: at rest the whole mesh is one path and one stroke. */
          if (st2 < 0.22) {
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
          } else {
            hot.push(p, q, st2);
          }
        }

        ctx.beginPath();
        ctx.strokeStyle = "rgba(" + BLUE + ",0.12)";
        ctx.lineWidth = 0.7;

        var r, c;
        for (r = 0; r < rows; r++) {
          for (c = 0; c < cols - 1; c++) seg(nodes[r * cols + c], nodes[r * cols + c + 1]);
        }
        for (c = 0; c < cols; c++) {
          for (r = 0; r < rows - 1; r++) seg(nodes[r * cols + c], nodes[(r + 1) * cols + c]);
        }
        ctx.stroke();

        for (i = 0; i < hot.length; i += 3) {
          var p = hot[i], q = hot[i + 1];
          var mix = Math.min(1, hot[i + 2] * 1.35);
          ctx.strokeStyle = mix > 0.55
            ? "rgba(" + ACCENT + "," + (0.20 + mix * 0.5).toFixed(3) + ")"
            : "rgba(" + BLUE + "," + (0.12 + mix * 0.55).toFixed(3) + ")";
          ctx.lineWidth = 0.7 + mix * 1.6;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(q.x, q.y);
          ctx.stroke();
        }

        /* only the nodes actually under load get a marker */
        for (i = 0; i < nodes.length; i++) {
          var b = nodes[i];
          if (b.s < 0.24) continue;
          ctx.beginPath();
          ctx.arc(b.x, b.y, 1 + b.s * 2.1, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(" + ACCENT + "," + (b.s * 0.75).toFixed(3) + ")";
          ctx.fill();
        }
      }
    },

    trace: {
      settle: 900,
      seed: function (W, H) {
        return {
          pts: [], p: 0,
          cx: W * 0.5, cy: H * 0.52,
          rx: W * 0.34, ry: H * 0.30,
          fx: 1.00, fy: 1.41
        };
      },
      step: function (st, dt, t, W, H, ptr) {
        var tx = W * 0.5, ty = H * 0.52, scale = 1;
        if (ptr && ptr.active > 0.01) {
          tx += (ptr.x - W * 0.5) * 0.45 * ptr.active;
          ty += (ptr.y - H * 0.52) * 0.45 * ptr.active;
          scale = 1 - 0.22 * ptr.active;
        }
        var k = 1 - Math.exp(-1.6 * dt);
        st.cx += (tx - st.cx) * k;
        st.cy += (ty - st.cy) * k;
        st.rx += (W * 0.34 * scale - st.rx) * k;
        st.ry += (H * 0.30 * scale - st.ry) * k;

        var steps = 6;
        for (var i = 0; i < steps; i++) {
          st.p += (dt / steps) * 0.85;
          var d = 0.9 + Math.sin(t * 0.045) * 0.7;
          st.pts.push(
            st.cx + st.rx * Math.sin(st.p * st.fx + d),
            st.cy + st.ry * Math.sin(st.p * st.fy)
          );
        }
        while (st.pts.length > 1500) st.pts.splice(0, 2);
      },
      pulse: function (st) {
        var ratios = [1.41, 1.5, 2, 2.5, 3, 0.75, 1.25];
        st.fy = ratios[Math.floor(Math.random() * ratios.length)];
        st.fx = Math.random() < 0.5 ? 1 : 1.5;
      },
      draw: function (ctx, st) {
        var pts = st.pts, n = pts.length;
        if (n < 6) return;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        var chunk = 2;
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

    var host = canvas.parentElement;                 /* the cover, not the canvas: */
    var field = FIELDS[canvas.getAttribute("data-field")] || FIELDS.contract;
    var ctx = canvas.getContext("2d");               /* the canvas sits behind the */
    var W = 0, H = 0, dpr = 1, t = 0;                /* text and gets no events    */
    var raf = null, visible = true, state = null;

    var ptr = { x: 0, y: 0, inside: false, active: 0, rings: [], r: 240 };

    function resize() {
      var rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = rect.width;
      H = rect.height;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      /* The section covers are about half the height of the home cover, so a
         radius taken from min(W, H) collapses and the field stops reacting.
         Floor it, and never let it swallow the whole width. */
      ptr.r = Math.max(240, Math.min(Math.min(W, H) * 0.6, W * 0.34));
      state = field.seed(W, H);
    }

    /* No cursor marker: what the field does around the pointer is the
       indicator. A click still leaves one expanding ring as confirmation. */
    function drawRings(dt) {
      for (var i = ptr.rings.length - 1; i >= 0; i--) {
        var r = ptr.rings[i];
        r.age += dt;
        if (r.age > 0.85) { ptr.rings.splice(i, 1); continue; }
        var e = r.age / 0.85;
        ctx.beginPath();
        ctx.arc(r.x, r.y, 12 + e * 92, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(232,74,39," + ((1 - e) * 0.4).toFixed(3) + ")";
        ctx.lineWidth = 1.4 * (1 - e) + 0.4;
        ctx.stroke();
      }
    }

    function paint(dt) {
      ctx.clearRect(0, 0, W, H);
      field.draw(ctx, state, t, W, H, ptr);
      drawRings(dt);
    }

    var last = 0;
    function loop(now) {
      raf = window.requestAnimationFrame(loop);
      if (!last) last = now;
      var dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      t += dt;
      ptr.active += ((ptr.inside ? 1 : 0) - ptr.active) * (1 - Math.exp(-4 * dt));
      field.step(state, dt, t, W, H, ptr);
      paint(dt);
    }

    function start() {
      if (raf || !visible) return;
      last = 0;
      raf = window.requestAnimationFrame(loop);
    }
    function stop() {
      if (raf) { window.cancelAnimationFrame(raf); raf = null; }
    }

    function track(e) {
      var rect = canvas.getBoundingClientRect();
      ptr.x = e.clientX - rect.left;
      ptr.y = e.clientY - rect.top;
      ptr.inside = ptr.x >= 0 && ptr.x <= rect.width && ptr.y >= 0 && ptr.y <= rect.height;
    }

    function bindPointer() {
      if (!host) return;

      host.addEventListener("pointermove", track, { passive: true });
      host.addEventListener("pointerleave", function () { ptr.inside = false; }, { passive: true });

      host.addEventListener("pointerdown", function (e) {
        /* never steal a tap meant for a link, a button or a form control */
        if (e.target.closest && e.target.closest("a, button, input, textarea, select, label")) return;
        track(e);
        if (!ptr.inside) return;
        ptr.active = 1;
        ptr.rings.push({ x: ptr.x, y: ptr.y, age: 0 });
        if (ptr.rings.length > 5) ptr.rings.shift();
        if (field.pulse) field.pulse(state, ptr.x, ptr.y, W, H);
      }, { passive: true });

      /* touch never fires pointerleave, so let the halo fade after a tap */
      function release(e) { if (e.pointerType !== "mouse") ptr.inside = false; }
      host.addEventListener("pointerup", release, { passive: true });
      host.addEventListener("pointercancel", release, { passive: true });
    }

    function begin() {
      if (reduceMotion) {
        var n = field.settle || 200;
        for (var i = 0; i < n; i++) { t += 0.03; field.step(state, 0.03, t, W, H, ptr); }
        paint(0);
        return;                       /* no interaction when motion is unwelcome */
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

      bindPointer();
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

  /* ----------------------------------------------------------------- paper --
     A publication page is long and mathematical, so it gets three things a
     scrolling reader actually uses: a contents list built from its own
     headings, a marker for where you are in it, and a progress bar. All three
     are additive — none of them is required for the prose to read correctly. */

  function paper() {
    var prose = document.getElementById("paper-prose");
    if (!prose) return;

    var bar = document.querySelector("#paper-progress i");
    var toc = document.getElementById("paper-toc");
    var list = toc ? toc.querySelector("ol") : null;

    /* --- contents, from whatever headings the page happens to have --- */
    var heads = prose.querySelectorAll("h2");
    var links = [];
    if (list && heads.length > 1) {
      Array.prototype.forEach.call(heads, function (h, i) {
        var text = (h.textContent || "").replace(/\s+/g, " ").trim();
        if (!text) return;
        if (!h.id) {
          h.id = "sec-" + (text.toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "") || ("part-" + i));
        }
        var li = document.createElement("li");
        var a = document.createElement("a");
        a.href = "#" + h.id;
        a.textContent = text;
        li.appendChild(a);
        list.appendChild(li);
        links.push({ a: a, el: h });
      });
      if (links.length) toc.hidden = false;
    }

    /* --- progress, and which heading is current --- */
    var ticking = false;
    function frame() {
      ticking = false;
      var doc = document.documentElement;
      var max = (doc.scrollHeight - window.innerHeight) || 1;
      if (bar) {
        var pct = Math.max(0, Math.min(1, window.pageYOffset / max));
        bar.style.transform = "scaleX(" + pct + ")";
      }
      if (!links.length) return;
      var mark = window.pageYOffset + (window.innerHeight * 0.28);
      var current = 0;
      for (var i = 0; i < links.length; i++) {
        if (links[i].el.getBoundingClientRect().top + window.pageYOffset <= mark) current = i;
      }
      links.forEach(function (l, i) {
        l.a.className = (i === current) ? "is-here" : "";
      });
    }
    function onScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(frame);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    frame();
  }

  /* Copy-to-clipboard for the citation block. One delegated handler replaces
     the per-page scripts that each defined the same function and id. */
  function copiers() {
    document.addEventListener("click", function (e) {
      var btn = e.target.closest ? e.target.closest("[data-copy]") : null;
      if (!btn) return;
      var src = document.querySelector(btn.getAttribute("data-copy"));
      if (!src) return;
      var text = (src.textContent || "").trim();
      var done = function (ok) {
        var was = btn.textContent;
        btn.textContent = ok ? "Copied" : "Press \u2318C";
        btn.classList.add("is-copied");
        setTimeout(function () {
          btn.textContent = was;
          btn.classList.remove("is-copied");
        }, 1800);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
      } else {
        /* Older Safari and any non-secure context land here. */
        var ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        var ok = false;
        try { ok = document.execCommand("copy"); } catch (err) { ok = false; }
        document.body.removeChild(ta);
        done(ok);
      }
    });
  }

  function init() {
    heroField();
    reel();
    filters();
    news();
    paper();
    copiers();
    reveal();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
