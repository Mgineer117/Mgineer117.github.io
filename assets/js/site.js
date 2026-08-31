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
  /* Reassigned once per page from the cover's data-accent, so a publication
     can carry its own highlight. One cover per page, so a module-level value
     is the whole of the state this needs. */
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
      /* These covers are wide and shallow, so a radius drawn from the short
         side barely leaves the cursor. Scale with width instead and let the
         reach cross most of the cover. */
      radius: function (W, H) {
        /* Bounded by the diagonal as well as by width: on a phone a radius
           taken from width alone can exceed the whole canvas, and the field
           collapses into a knot around the finger instead of leaning toward
           it. */
        var diag = Math.sqrt(W * W + H * H);
        return Math.min(Math.max(W * 0.58, 260), diag * 0.62, 940);
      },
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
              /* A linear falloff over a wide radius leaves everything past
                 the halfway mark barely moving. The exponent below 1 keeps
                 the far half of the field genuinely in play: at 0.8R it pulls
                 about 0.35 rather than 0.2. */
              var f = Math.pow(1 - d / R, 0.6) * ptr.active;
              /* pull toward the pointer, with enough swirl to spiral rather
                 than fall straight in */
              a.x += (-dx / d) * f * 66 * dt + (-dy / d) * f * 104 * dt;
              a.y += (-dy / d) * f * 66 * dt + ( dx / d) * f * 104 * dt;
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
        var R = Math.max(520, Math.min(W * 0.78, 1180));
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

    /* Meta-CPO — a safety boundary that holds. Agents drift across the cover
       and are turned back at the constraint; the pointer presses on it like a
       hand on a rope, and a click sends a wave running along it. */
    barrier: {
      settle: 140,
      radius: function (W, H) {
        var d = Math.sqrt(W * W + H * H);
        return Math.min(Math.max(W * 0.55, 260), d * 0.62, 900);
      },
      shape: function (st, x, t, W, ptr) {
        var y = st.y0 + Math.sin(x * st.k + t * 0.42) * st.amp
                      + Math.sin(x * st.k * 2.3 - t * 0.31) * st.amp * 0.28;
        if (ptr && ptr.active > 0.01) {
          var u = (x - ptr.x) / (W * 0.14);
          y += (ptr.y - y) * Math.exp(-u * u) * 0.92 * ptr.active;
        }
        for (var i = 0; i < st.waves.length; i++) {
          var w = st.waves[i];
          var d = Math.abs(x - w.x) - w.age * 520;
          var v = d / (W * 0.05);
          y += w.amp * Math.exp(-v * v) * Math.exp(-w.age * 1.3);
        }
        return y;
      },
      seed: function (W, H) {
        var n = W < 620 ? 16 : W < 1000 ? 26 : 38;
        var ag = [];
        for (var i = 0; i < n; i++) {
          ag.push({ x: Math.random() * W, y: Math.random() * H * 0.5,
                    vx: 18 + Math.random() * 34, vy: 10 + Math.random() * 26, hot: 0 });
        }
        return { agents: ag, y0: H * 0.60, amp: H * 0.13, k: 4.2 / W, waves: [] };
      },
      step: function (st, dt, t, W, H, ptr) {
        for (var w = st.waves.length - 1; w >= 0; w--) {
          st.waves[w].age += dt;
          if (st.waves[w].age > 2.2) st.waves.splice(w, 1);
        }
        for (var i = 0; i < st.agents.length; i++) {
          var a = st.agents[i];
          a.x += a.vx * dt;
          a.y += a.vy * dt;
          var lim = this.shape(st, a.x, t, W, ptr);
          if (a.y > lim - 6) {                 /* turned back at the constraint */
            a.y = lim - 6;
            a.vy = -Math.abs(a.vy) * 0.72 - 12;
            a.hot = 1;
          }
          a.vy += 26 * dt;                     /* a steady pull toward the edge */
          a.hot = Math.max(0, a.hot - dt * 1.8);
          if (a.x > W + 20) { a.x = -20; a.y = Math.random() * H * 0.45; a.vy = 10 + Math.random() * 26; }
          if (a.y < -20) { a.y = -18; a.vy = Math.abs(a.vy) * 0.4; }
        }
      },
      pulse: function (st, x, y, W, H) {
        st.waves.push({ x: x, amp: (y - st.y0) * 0.6 || H * 0.12, age: 0 });
        if (st.waves.length > 3) st.waves.shift();
      },
      draw: function (ctx, st, t, W, H, ptr) {
        var step = Math.max(6, W / 160), x, y;

        /* the side the agents may not enter */
        ctx.beginPath();
        ctx.moveTo(0, H);
        for (x = 0; x <= W; x += step) ctx.lineTo(x, this.shape(st, x, t, W, ptr));
        ctx.lineTo(W, H);
        ctx.closePath();
        ctx.fillStyle = "rgba(" + ACCENT + ",0.055)";
        ctx.fill();

        ctx.beginPath();
        for (x = 0; x <= W; x += step) {
          y = this.shape(st, x, t, W, ptr);
          if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = "rgba(" + ACCENT + ",0.62)";
        ctx.lineWidth = 1.6;
        ctx.stroke();

        for (var i = 0; i < st.agents.length; i++) {
          var a = st.agents[i];
          ctx.beginPath();
          ctx.arc(a.x, a.y, a.hot > 0.05 ? 2.9 : 1.8, 0, Math.PI * 2);
          ctx.fillStyle = a.hot > 0.05
            ? "rgba(" + ACCENT + "," + (0.35 + a.hot * 0.6).toFixed(3) + ")"
            : "rgba(" + BLUE + ",0.5)";
          ctx.fill();
        }
      }
    },

    /* HiMeta — macro-actions discovered, reused, discarded. A tree grows from
       the floor, leans toward the pointer, and is replaced once it tops out. */
    branch: {
      settle: 90,
      seed: function (W, H) {
        return { segs: [], tips: [], age: 0, W: W, H: H, cap: W < 620 ? 130 : 260 };
      },
      root: function (st, W, H) {
        st.segs.length = 0;
        st.tips.length = 0;
        st.age = 0;
        var n = W < 620 ? 1 : 2;
        for (var i = 0; i < n; i++) {
          st.tips.push({
            x: W * (n === 1 ? 0.5 : 0.3 + i * 0.4), y: H + 8,
            a: -Math.PI / 2 + (Math.random() - 0.5) * 0.3,
            len: 0, depth: 0, span: H * (0.16 + Math.random() * 0.07)
          });
        }
      },
      step: function (st, dt, t, W, H, ptr) {
        if (!st.tips.length && !st.segs.length) this.root(st, W, H);
        st.age += dt;

        var sp = H * 0.34;
        for (var i = st.tips.length - 1; i >= 0; i--) {
          var tp = st.tips[i];
          var nx = tp.x + Math.cos(tp.a) * sp * dt;
          var ny = tp.y + Math.sin(tp.a) * sp * dt;

          /* One segment per frame would put the record count in the hundreds
             at 60fps for a line that looks identical; emit per ~5px instead. */
          if (tp.lx === undefined) { tp.lx = tp.x; tp.ly = tp.y; }
          var mx = nx - tp.lx, my = ny - tp.ly;
          if (mx * mx + my * my >= 25) {
            st.segs.push({ x1: tp.lx, y1: tp.ly, x2: nx, y2: ny, d: tp.depth, age: 0 });
            tp.lx = nx; tp.ly = ny;
          }
          tp.x = nx; tp.y = ny; tp.len += sp * dt;

          /* lean toward the pointer rather than snap to it */
          if (ptr && ptr.active > 0.01) {
            var want = Math.atan2(ptr.y - tp.y, ptr.x - tp.x);
            var diff = Math.atan2(Math.sin(want - tp.a), Math.cos(want - tp.a));
            tp.a += diff * 1.1 * dt * ptr.active;
          }
          tp.a += (Math.random() - 0.5) * 1.5 * dt;

          if (tp.len > tp.span) {
            st.tips.splice(i, 1);
            if (tp.depth < 4 && st.segs.length < st.cap) {
              for (var k = 0; k < 2; k++) {
                st.tips.push({
                  x: tp.x, y: tp.y,
                  a: tp.a + (k ? 1 : -1) * (0.34 + Math.random() * 0.34),
                  len: 0, depth: tp.depth + 1,
                  span: tp.span * (0.62 + Math.random() * 0.22)
                });
              }
            }
          }
          if (tp.y < -30 || tp.x < -30 || tp.x > W + 30) st.tips.splice(i, 1);
        }

        for (var j = st.segs.length - 1; j >= 0; j--) {
          st.segs[j].age += dt;
          if (st.segs[j].age > 7.5) st.segs.splice(j, 1);
        }
        if (!st.tips.length && st.age > 3.4) this.root(st, W, H);
      },
      pulse: function (st, x, y, W, H) {
        st.tips.push({ x: x, y: y, a: -Math.PI / 2 + (Math.random() - 0.5) * 1.6,
                       len: 0, depth: 1, span: H * 0.13 });
      },
      draw: function (ctx, st) {
        ctx.lineCap = "round";
        for (var i = 0; i < st.segs.length; i++) {
          var s = st.segs[i];
          var fade = Math.min(1, s.age * 3) * Math.min(1, (7.5 - s.age) * 0.5);
          ctx.beginPath();
          ctx.moveTo(s.x1, s.y1);
          ctx.lineTo(s.x2, s.y2);
          ctx.strokeStyle = s.d === 0
            ? "rgba(" + ACCENT + "," + (0.42 * fade).toFixed(3) + ")"
            : "rgba(" + BLUE + "," + ((0.34 - s.d * 0.05) * fade).toFixed(3) + ")";
          ctx.lineWidth = Math.max(0.6, 2.4 - s.d * 0.45);
          ctx.stroke();
        }
        for (var k = 0; k < st.tips.length; k++) {
          ctx.beginPath();
          ctx.arc(st.tips[k].x, st.tips[k].y, 2, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(" + ACCENT + ",0.75)";
          ctx.fill();
        }
      }
    },

    /* MOOD-CRL — a distribution pulled off its support. Samples ride from the
       training mode to a second one that follows the pointer; the further they
       land from where the data was, the hotter they read. */
    density: {
      settle: 200,
      radius: function (W, H) {
        var d = Math.sqrt(W * W + H * H);
        return Math.min(Math.max(W * 0.55, 260), d * 0.62, 900);
      },
      gauss: function () {
        var u = 0, v = 0;
        while (!u) u = Math.random();
        while (!v) v = Math.random();
        return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
      },
      seed: function (W, H) {
        var n = W < 620 ? 60 : W < 1000 ? 110 : 170;
        var pts = [];
        for (var i = 0; i < n; i++) {
          pts.push({ u: Math.random(), sp: 0.20 + Math.random() * 0.26,
                     gx: this.gauss(), gy: this.gauss(),
                     hx: this.gauss(), hy: this.gauss(), x: 0, y: 0, r: 0 });
        }
        return { pts: pts, sx: W * 0.32, sy: H * 0.54, tx: W * 0.68, ty: H * 0.46,
                 sr: Math.min(W, H) * 0.15, tr: Math.min(W, H) * 0.13 };
      },
      step: function (st, dt, t, W, H, ptr) {
        var wantX = W * (0.66 + Math.sin(t * 0.24) * 0.06);
        var wantY = H * (0.46 + Math.cos(t * 0.19) * 0.10);
        if (ptr && ptr.active > 0.01) {
          wantX = wantX + (ptr.x - wantX) * ptr.active;
          wantY = wantY + (ptr.y - wantY) * ptr.active;
        }
        st.tx += (wantX - st.tx) * (1 - Math.exp(-3.2 * dt));
        st.ty += (wantY - st.ty) * (1 - Math.exp(-3.2 * dt));

        var shift = Math.sqrt((st.tx - st.sx) * (st.tx - st.sx) + (st.ty - st.sy) * (st.ty - st.sy));
        /* Judged against the whole cover. Against the short side, an ordinary
           resting shift already saturated and every sample read as drifted,
           which erases the contrast the picture depends on. */
        var norm = Math.max(1, Math.sqrt(W * W + H * H) * 0.55);

        for (var i = 0; i < st.pts.length; i++) {
          var p = st.pts[i];
          p.u += p.sp * dt;
          if (p.u > 1) {
            p.u = 0;
            p.gx = this.gauss(); p.gy = this.gauss();
            p.hx = this.gauss(); p.hy = this.gauss();
          }
          var e = p.u < 0.5 ? 2 * p.u * p.u : 1 - Math.pow(-2 * p.u + 2, 2) / 2;
          var ax = st.sx + p.gx * st.sr, ay = st.sy + p.gy * st.sr;
          var bx = st.tx + p.hx * st.tr, by = st.ty + p.hy * st.tr;
          p.x = ax + (bx - ax) * e;
          p.y = ay + (by - ay) * e + Math.sin(e * Math.PI) * -18;   /* a slight arc */
          p.r = Math.min(1, (shift / norm) * e);
        }
      },
      pulse: function (st) {
        for (var i = 0; i < st.pts.length; i++) st.pts[i].u = Math.random() * 0.25;
      },
      draw: function (ctx, st) {
        function ring(x, y, r, alpha) {
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(" + BLUE + "," + alpha + ")";
          ctx.lineWidth = 1;
          ctx.stroke();
        }
        ring(st.sx, st.sy, st.sr, 0.16);
        ring(st.sx, st.sy, st.sr * 1.9, 0.08);
        ring(st.tx, st.ty, st.tr, 0.13);

        /* In-support samples are quantised into a few alpha buckets so each
           bucket is one path and one fill; only the drifted ones, which are
           what the cover is about, are drawn individually. */
        var B = 4, buckets = [], i, p;
        for (i = 0; i < B; i++) buckets.push([]);
        for (i = 0; i < st.pts.length; i++) {
          p = st.pts[i];
          if (p.r > 0.45) continue;
          var fade = Math.sin(Math.min(1, p.u) * Math.PI);
          buckets[Math.min(B - 1, (fade * B) | 0)].push(p);
        }
        for (var b = 0; b < B; b++) {
          if (!buckets[b].length) continue;
          ctx.beginPath();
          for (i = 0; i < buckets[b].length; i++) {
            p = buckets[b][i];
            ctx.moveTo(p.x + 1.7, p.y);
            ctx.arc(p.x, p.y, 1.7, 0, Math.PI * 2);
          }
          ctx.fillStyle = "rgba(" + BLUE + "," + (((b + 0.5) / B) * 0.5).toFixed(3) + ")";
          ctx.fill();
        }
        for (i = 0; i < st.pts.length; i++) {
          p = st.pts[i];
          if (p.r <= 0.45) continue;
          var fd = Math.sin(Math.min(1, p.u) * Math.PI);
          ctx.beginPath();
          ctx.arc(p.x, p.y, 1.5 + p.r * 1.4, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(" + ACCENT + "," + (p.r * fd * 0.8).toFixed(3) + ")";
          ctx.fill();
        }
      }
    },

    /* IRPO — reward is sparse, so the interesting thing is the frontier. A
       search floods outward across the cover; the pointer keeps seeding fresh
       fronts, a click drops one. */
    search: {
      /* A ripple of exploration that dies out, not a front that marches.
         A seed spreads outward, weakening with every ring it puts out, and
         stops once it has spent itself; what it lit fades to nothing behind
         it, and after a pause somewhere else starts. Earlier versions had
         the frontier crossing the whole cover and then wiping the sheet in
         one frame to start over -- always moving, and the reset was a
         canvas-wide blink. Both of those are gone: the propagation is
         supposed to disappear. */
      settle: 70,
      seed: function (W, H) {
        var sp = Math.max(13, Math.min(22, W / 70));
        var cols = Math.ceil(W / sp) + 1, rows = Math.ceil(H / sp) + 1;
        var cells = new Float32Array(cols * rows);        /* 0 = unvisited, else age */
        var rings = new Float32Array(cols * rows);        /* how far out it was lit */
        return { cells: cells, rings: rings, cols: cols, rows: rows, sp: sp,
                 front: [], next: [], acc: 0, tick: 0.11, sow: 2.2,
                 ring: 0, reach: 0 };
      },
      sowAt: function (st, x, y) {
        var c = Math.round(x / st.sp), r = Math.round(y / st.sp);
        if (c < 0 || r < 0 || c >= st.cols || r >= st.rows) return;
        var i = r * st.cols + c;
        if (st.cells[i] > 0) return;
        st.cells[i] = 0.0001;
        st.rings[i] = 0;
        st.front.push(i);
        st.ring = 0;
        /* How far this one gets before it has nothing left. Varying it stops
           the cover from looking like the same event on a timer. */
        st.reach = 13 + Math.round(Math.random() * 9);
      },
      step: function (st, dt, t, W, H, ptr) {
        /* A cell ages, and once it has faded past seeing it is unvisited
           again, so the wave can pass back over it later. That is what keeps
           this going without a reset: the old version wiped every cell the
           moment the sheet was 90% explored, which blanked the whole canvas
           in a single frame -- the largest pop on the page, and the reason
           the cover kept emptying out. Nothing is ever cleared now; the
           sheet recycles behind the wave. */
        /* A cell ages out and is unvisited again, so a later ripple can
           cross the same ground. Nothing is ever cleared in bulk. */
        var cells = st.cells, i;
        for (i = 0; i < cells.length; i++) {
          if (cells[i] <= 0) continue;
          cells[i] += dt;
          if (cells[i] > 1.9) cells[i] = 0;
        }

        /* Nothing new starts while the last one is still spreading or still
           visible, so the cover really does empty out between ripples. */
        st.sow += dt;
        if (ptr && ptr.active > 0.4) {
          if (st.sow > 0.9) {
            st.sow = 0;
            this.sowAt(st, ptr.x + (Math.random() - 0.5) * st.sp * 3,
                           ptr.y + (Math.random() - 0.5) * st.sp * 3);
          }
        } else if (!st.front.length && st.sow > 3.4) {
          st.sow = 0;
          this.sowAt(st, W * (0.15 + Math.random() * 0.7),
                         H * (0.15 + Math.random() * 0.7));
        }

        st.acc += dt;
        while (st.acc > st.tick) {
          st.acc -= st.tick;
          if (st.ring >= st.reach) { st.front.length = 0; break; }
          st.ring++;
          var front = st.front, next = st.next;
          next.length = 0;
          for (var f = 0; f < front.length; f++) {
            var idx = front[f];
            var c = idx % st.cols, r = (idx - c) / st.cols;
            for (var k = 0; k < 4; k++) {
              var nc = c + (k === 0 ? 1 : k === 1 ? -1 : 0);
              var nr = r + (k === 2 ? 1 : k === 3 ? -1 : 0);
              if (nc < 0 || nr < 0 || nc >= st.cols || nr >= st.rows) continue;
              var ni = nr * st.cols + nc;
              if (cells[ni] > 0) continue;
              cells[ni] = 0.0001;
              st.rings[ni] = st.ring;
              next.push(ni);
            }
          }
          st.front = next;
          st.next = front;
        }
      },
      pulse: function (st, x, y) { this.sowAt(st, x, y); },
      /* A cell is brightest the instant the wave reaches it and thins from
         there, so the propagation leaves rather than stops. What made it
         read as flicker was the arithmetic: opacity was quantised into five
         steps and cut off at 5%, and the frontier was a separate flat pass
         over the trail, so a cell lost most of its opacity in one frame the
         moment it stopped being the frontier. There is one exponential ramp
         now, sampled finely enough to look continuous, and the frontier is
         simply the youngest end of it -- no second pass, and no step to
         fall off. Fills stay batched, one path per band, so a sheet of
         ~1800 cells costs a few dozen calls rather than 1800. */
      draw: function (ctx, st) {
        var sp = st.sp, cells = st.cells, half = sp * 0.34, side = half * 2;

        var A = 14,          /* opacity bands: fine enough to read smooth  */
            C = 4,           /* colour steps, frontier tint to trail tint  */
            PEAK = 0.38,     /* opacity of a cell the moment it is reached */
            DECAY = 1.95,    /* per second; ~1.8s before it is invisible   */
            WARM = 0.9,      /* seconds a cell keeps some frontier colour  */
            REACH = st.reach || 1;

        var bins = st.bins, i, q, k;
        if (!bins || bins.length !== A * C) {
          bins = st.bins = [];
          for (q = 0; q < A * C; q++) bins.push([]);
        }
        for (q = 0; q < bins.length; q++) bins[q].length = 0;

        for (i = 0; i < cells.length; i++) {
          var a = cells[i];
          if (!a) continue;
          /* Two things dim a cell: its own age, and how far out it was when
             the ripple reached it. The second is what makes the propagation
             spend itself rather than travel at full strength. */
          var spent = 1 - st.rings[i] / REACH;
          if (spent <= 0) continue;
          var v = Math.exp(-a * DECAY) * spent;
          if (v * PEAK < 0.012) continue;      /* below this nothing shows */
          var warmth = a < WARM ? 1 - a / WARM : 0;
          bins[Math.min(C - 1, (warmth * C) | 0) * A +
               Math.min(A - 1, (v * A) | 0)].push(i);
        }

        var ac = ACCENT.split(","), bl = BLUE.split(",");
        for (var cb = 0; cb < C; cb++) {
          var m = (cb + 0.5) / C;
          var col = Math.round(+bl[0] + (+ac[0] - +bl[0]) * m) + "," +
                    Math.round(+bl[1] + (+ac[1] - +bl[1]) * m) + "," +
                    Math.round(+bl[2] + (+ac[2] - +bl[2]) * m);
          for (var ab = 0; ab < A; ab++) {
            var list = bins[cb * A + ab];
            if (!list.length) continue;
            ctx.beginPath();
            for (k = 0; k < list.length; k++) {
              var idx = list[k], c = idx % st.cols, r = (idx - c) / st.cols;
              ctx.rect(c * sp - half, r * sp - half, side, side);
            }
            ctx.fillStyle = "rgba(" + col + "," +
              (PEAK * (ab + 0.5) / A).toFixed(3) + ")";
            ctx.fill();
          }
        }
      }
    },

    /* Sparsity — coverage, not position, is the risk. Points bind to the
       nearest centroid; the ones stranded far from any of them light up, which
       is the whole argument of the paper. The pointer is an extra centroid. */
    clusters: {
      settle: 120,
      radius: function (W, H) {
        var d = Math.sqrt(W * W + H * H);
        return Math.min(Math.max(W * 0.5, 240), d * 0.55, 820);
      },
      seed: function (W, H) {
        var n = W < 620 ? 55 : W < 1000 ? 90 : 140;
        var k = W < 620 ? 3 : 5;
        var pts = [], cen = [], i;
        for (i = 0; i < k; i++) {
          cen.push({ x: W * (0.16 + Math.random() * 0.68), y: H * (0.2 + Math.random() * 0.6),
                     ax: 0, ay: 0, n: 0 });
        }
        for (i = 0; i < n; i++) {
          /* clumped around the centroids, plus a thin scatter between them */
          var host = cen[(Math.random() * cen.length) | 0];
          var loose = Math.random() < 0.22;
          pts.push({
            hx: loose ? Math.random() * W : host.x + (Math.random() - 0.5) * Math.min(W, H) * 0.42,
            hy: loose ? Math.random() * H : host.y + (Math.random() - 0.5) * Math.min(W, H) * 0.38,
            ph: Math.random() * 6.28, x: 0, y: 0, ci: 0, s: 0
          });
        }
        /* Sparsity is judged against the area a centroid ought to cover, not
           against the short side: on a wide cover the latter marked almost
           every point as stranded, which is the opposite of the argument. */
        return { pts: pts, cen: cen, norm: Math.sqrt((W * H) / k) };
      },
      step: function (st, dt, t, W, H, ptr) {
        var i, j, c;
        for (j = 0; j < st.cen.length; j++) { st.cen[j].ax = 0; st.cen[j].ay = 0; st.cen[j].n = 0; }

        var live = ptr && ptr.active > 0.25;
        for (i = 0; i < st.pts.length; i++) {
          var p = st.pts[i];
          p.x = p.hx + Math.sin(t * 0.35 + p.ph) * 5;
          p.y = p.hy + Math.cos(t * 0.29 + p.ph) * 5;

          var best = -1, bd = 1e9;
          for (j = 0; j < st.cen.length; j++) {
            c = st.cen[j];
            var dx = p.x - c.x, dy = p.y - c.y;
            var d2 = dx * dx + dy * dy;
            if (d2 < bd) { bd = d2; best = j; }
          }
          var dist = Math.sqrt(bd);

          if (live) {
            var px = p.x - ptr.x, py = p.y - ptr.y;
            var pd = Math.sqrt(px * px + py * py);
            if (pd < dist) { best = -1; dist = pd; }   /* the cursor wins the point */
          }
          p.ci = best;
          p.s = Math.min(1, dist / st.norm);
          if (best >= 0) { c = st.cen[best]; c.ax += p.x; c.ay += p.y; c.n++; }
        }

        /* Lloyd, damped so the centroids glide instead of snapping */
        for (j = 0; j < st.cen.length; j++) {
          c = st.cen[j];
          if (!c.n) continue;
          c.x += (c.ax / c.n - c.x) * (1 - Math.exp(-1.6 * dt));
          c.y += (c.ay / c.n - c.y) * (1 - Math.exp(-1.6 * dt));
        }
      },
      pulse: function (st, x, y, W, H) {
        for (var j = 0; j < st.cen.length; j++) {
          st.cen[j].x = W * (0.14 + Math.random() * 0.72);
          st.cen[j].y = H * (0.18 + Math.random() * 0.64);
        }
      },
      /* 0.40 marks about one point in six as stranded here — enough to read
         as a signal rather than as noise or as the whole picture. */
      cut: 0.40,
      draw: function (ctx, st, t, W, H, ptr) {
        var i, p, tx, ty;
        ctx.lineWidth = 0.65;

        /* well-covered points all look the same, so they cost one stroke */
        ctx.beginPath();
        for (i = 0; i < st.pts.length; i++) {
          p = st.pts[i];
          if (p.s > this.cut) continue;
          if (p.ci >= 0) { tx = st.cen[p.ci].x; ty = st.cen[p.ci].y; }
          else if (ptr) { tx = ptr.x; ty = ptr.y; } else continue;
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(tx, ty);
        }
        ctx.strokeStyle = "rgba(" + BLUE + ",0.12)";
        ctx.stroke();

        /* the stranded ones are the point of the picture, so they are drawn
           individually and warm with how far from cover they sit */
        for (i = 0; i < st.pts.length; i++) {
          p = st.pts[i];
          if (p.s <= this.cut) continue;
          if (p.ci >= 0) { tx = st.cen[p.ci].x; ty = st.cen[p.ci].y; }
          else if (ptr) { tx = ptr.x; ty = ptr.y; } else continue;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(tx, ty);
          ctx.strokeStyle = "rgba(" + ACCENT + "," + ((p.s - 0.4) * 0.42).toFixed(3) + ")";
          ctx.stroke();
        }
        ctx.beginPath();
        for (i = 0; i < st.pts.length; i++) {
          var q = st.pts[i];
          if (q.s > this.cut) continue;
          ctx.moveTo(q.x + 1.7, q.y);
          ctx.arc(q.x, q.y, 1.7, 0, Math.PI * 2);
        }
        ctx.fillStyle = "rgba(" + BLUE + ",0.5)";
        ctx.fill();

        for (i = 0; i < st.pts.length; i++) {
          var h = st.pts[i];
          if (h.s <= this.cut) continue;
          ctx.beginPath();
          ctx.arc(h.x, h.y, 1.4 + h.s * 1.8, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(" + ACCENT + "," + (0.3 + h.s * 0.55).toFixed(3) + ")";
          ctx.fill();
        }
        for (var j = 0; j < st.cen.length; j++) {
          ctx.beginPath();
          ctx.arc(st.cen[j].x, st.cen[j].y, 5.5, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(255,255,255,0.55)";
          ctx.lineWidth = 1.2;
          ctx.stroke();
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

    /* Normally the cover, since the canvas sits behind the text and gets no
       events of its own. A page whose field is fixed behind everything names
       a wider host instead, so the pointer is tracked the whole way down. */
    var hostSel = canvas.getAttribute("data-host");
    var host = (hostSel && document.querySelector(hostSel)) || canvas.parentElement;
    var field = FIELDS[canvas.getAttribute("data-field")] || FIELDS.contract;
    var accent = canvas.getAttribute("data-accent");
    if (accent && /^\d{1,3},\d{1,3},\d{1,3}$/.test(accent)) ACCENT = accent;
    var ctx = canvas.getContext("2d");               /* the canvas sits behind the */
    if (!ctx) return;             /* a fingerprint blocker can refuse one */
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
      ptr.r = field.radius
        ? field.radius(W, H)
        : Math.max(240, Math.min(Math.min(W, H) * 0.6, W * 0.34));
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
      /* Reduced motion means nothing moves on its own -- not that the field
         stops answering. Once the pointer has left and the field has relaxed
         back, park it on a still frame until someone asks again. */
      if (reduceMotion && !ptr.inside && ptr.active < 0.02 && !ptr.rings.length) stop();
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

      host.addEventListener("pointermove", function (e) { track(e); start(); }, { passive: true });
      host.addEventListener("pointerleave", function () { ptr.inside = false; start(); }, { passive: true });

      host.addEventListener("pointerdown", function (e) {
        /* never steal a tap meant for a link, a button or a form control */
        if (e.target.closest && e.target.closest("a, button, input, textarea, select, label")) return;
        track(e);
        if (!ptr.inside) return;
        ptr.active = 1;
        ptr.rings.push({ x: ptr.x, y: ptr.y, age: 0 });
        if (ptr.rings.length > 5) ptr.rings.shift();
        if (field.pulse) field.pulse(state, ptr.x, ptr.y, W, H);
        start();
      }, { passive: true });

      /* touch never fires pointerleave, so let the halo fade after a tap */
      function release(e) { if (e.pointerType !== "mouse") ptr.inside = false; start(); }
      host.addEventListener("pointerup", release, { passive: true });
      host.addEventListener("pointercancel", release, { passive: true });
    }

    function begin() {
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

      if (reduceMotion) {
        /* Pre-run the field to where it would have settled, and show that.
           The loop starts only when the pointer engages, from bindPointer. */
        var n = field.settle || 200;
        for (var i = 0; i < n; i++) { t += 0.03; field.step(state, 0.03, t, W, H, ptr); }
        paint(0);
        return;
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
      var itemSel = root.getAttribute("data-filter-items") || "[data-tags]";
      var buttons = root.querySelectorAll(".filter-btn");
      var items = root.querySelectorAll(itemSel);
      var groups = root.querySelectorAll("[data-filter-group]");
      var syncUrl = root.hasAttribute("data-filter-url");
      if (!buttons.length || !items.length) return;

      function apply(tag) {
        Array.prototype.forEach.call(items, function (item) {
          var tags = (item.getAttribute("data-tags") || "").split(",").map(function (s) { return s.trim(); });
          item.classList.toggle("is-hidden", !(tag === "all" || tags.indexOf(tag) !== -1));
        });

        Array.prototype.forEach.call(groups, function (group) {
          var kids = group.querySelectorAll(itemSel);
          var shown = 0;
          Array.prototype.forEach.call(kids, function (k) {
            if (!k.classList.contains("is-hidden")) shown++;
          });

          /* The tally beside a heading counts what is on screen. Leaving it
             at the category total under a filter says there are three
             journal articles while one is shown. */
          var badge = group.querySelector("[data-filter-count]") ||
                      group.querySelector(".group-head em");
          if (badge) badge.textContent = shown;

          /* and the heading goes once there is nothing under it at all */
          group.classList.toggle("is-hidden", kids.length > 0 && !shown);
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

  /* ------------------------------------------------------------------ */
  /* Theme toggle                                                        */
  /*                                                                     */
  /* Three states, not two: with nothing stored the page follows the      */
  /* system, and only a click pins data-theme. Pinning the value the      */
  /* system already shows is still a pin -- that is what lets someone     */
  /* keep this site light on a dark machine.                              */
  /* ------------------------------------------------------------------ */
  function theme() {
    var btn = document.getElementById("theme-toggle");
    if (!btn) return;

    var root = document.documentElement;
    var media = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
    var meta = document.querySelector('meta[name="theme-color"]');

    function current() {
      return root.getAttribute("data-theme") ||
             (media && media.matches ? "dark" : "light");
    }

    function paint() {
      var dark = current() === "dark";
      var label = dark ? "Switch to light theme" : "Switch to dark theme";
      btn.setAttribute("aria-label", label);
      btn.title = label;
      if (meta) meta.setAttribute("content", dark ? "#0c1523" : "#ffffff");
    }

    btn.addEventListener("click", function () {
      var next = current() === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem("theme", next); } catch (e) {}
      paint();
    });

    /* Following the system means following it as it changes. */
    if (media && media.addEventListener) {
      media.addEventListener("change", function () {
        if (!root.getAttribute("data-theme")) paint();
      });
    }

    paint();
  }

  function init() {
    /* Run each piece behind its own guard. These are independent features,
       and a throw in one used to silently kill every one after it -- a
       refused 2d context took the filters, the clip players and the copy
       buttons down with it. */
    [theme, heroField, reel, filters, news, paper, copiers, reveal]
      .forEach(function (fn) {
        try { fn(); }
        catch (err) { if (window.console) console.error(fn.name || "init", err); }
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
