/*
 * The hero canvas fields.
 *
 * Two properties that are easy to break and invisible when they break:
 *
 *   1. Reduced motion means nothing moves on its own -- and NOT that the
 *      field stops answering the pointer. Both halves are checked, because
 *      the obvious implementation of either one loses the other.
 *   2. The fields are one feature among several driven from the same init.
 *      A browser that refuses a 2d context, or an extension that breaks
 *      requestAnimationFrame, must not take the publication filters and the
 *      scroll reveal down with it.
 *
 *   bundle exec jekyll serve                 # in another shell
 *   node tools/test-hero-field.mjs [http://localhost:4000]
 */
import { browser, reporter, sleep } from "./cdp.mjs";

const BASE = (process.argv[2] || "http://localhost:4000").replace(/\/$/, "");
const { check, done } = reporter();
const b = await browser();

/* A cheap hash of the canvas: same value twice means nothing was painted. */
const SNAP = `
  var c = document.getElementById("hero-field");
  if (!c) return null;
  var g = c.getContext("2d");
  if (!g) return null;
  var d = g.getImageData(0, 0, c.width, c.height).data, h = 0;
  for (var i = 3; i < d.length; i += 401) h = (h * 33 + d[i]) | 0;
  return h;`;

async function field(reduced) {
  const t = await b.open(BASE + "/");
  if (reduced) await t.media("prefers-reduced-motion", "reduce");
  await t.send("Page.reload");
  await sleep(2500);

  const start = await t.eval(SNAP);
  await sleep(900);
  const idle = await t.eval(SNAP);

  for (const [x, y] of [[300, 300], [420, 380], [520, 300], [380, 420]]) {
    await t.move(x, y);
    await sleep(90);
  }
  await sleep(300);
  const moved = await t.eval(SNAP);

  await t.click(420, 360);
  await sleep(350);
  const clicked = await t.eval(SNAP);

  t.close();
  return { drew: start !== null, animatesAlone: start !== idle,
           answersMove: idle !== moved, answersClick: moved !== clicked };
}

let r = await field(false);
check("default: draws, animates, answers the pointer",
  r.drew && r.animatesAlone && r.answersMove && r.answersClick, r);

r = await field(true);
check("reduced motion: still, but not inert",
  r.drew && !r.animatesAlone && r.answersMove && r.answersClick, r);

/* Everything below shares one init with the fields. */
async function siblings(label, source) {
  const t = await b.open("about:blank");
  if (source) await t.atStart(source);
  await t.send("Page.navigate", { url: BASE + "/publications/" });
  await sleep(2600);
  const got = await t.eval(`
    var btns = document.querySelectorAll(".filter-btn");
    if (btns.length > 1) btns[1].click();
    return {
      revealRan: document.documentElement.className.indexOf("reveal-ready") >= 0,
      filterWorks: document.querySelectorAll(".pub-card.is-hidden").length > 0
    };`);
  t.close();
  check(label, got.revealRan && got.filterWorks, got);
}

await siblings("healthy page: filters and reveal run", null);
await siblings("a refused 2d context spares the siblings",
  `HTMLCanvasElement.prototype.getContext = function () { return null; };`);
await siblings("a broken requestAnimationFrame spares the siblings",
  `window.requestAnimationFrame = function () { throw new Error("blocked"); };`);

b.kill();
done();
