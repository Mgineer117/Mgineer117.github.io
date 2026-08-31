/*
 * Light/dark toggle.
 *
 * The toggle has three states, not two: nothing stored means "follow the
 * system", and only a click pins data-theme. The states that matter are the
 * ones where those disagree -- a pinned light on a dark machine, and a dark
 * machine with nothing pinned -- so those are what this checks.
 *
 *   bundle exec jekyll serve            # in another shell
 *   node tools/test-theme.mjs [http://localhost:4000]
 */
import { browser, reporter, sleep } from "./cdp.mjs";

const BASE = (process.argv[2] || "http://localhost:4000").replace(/\/$/, "");
const LIGHT_BG = "rgb(255, 255, 255)";
const DARK_BG = "rgb(12, 21, 35)";      /* --paper under [data-theme=dark] */

const { check, done } = reporter();
const b = await browser();
const t = await b.open(BASE + "/year-archive/");

const state = () => t.eval(`return {
  attr: document.documentElement.getAttribute("data-theme"),
  stored: (function () { try { return localStorage.getItem("theme"); } catch (e) { return "ERR"; } })(),
  bg: getComputedStyle(document.body).backgroundColor,
  label: (document.getElementById("theme-toggle") || {}).title
};`);
const toggle = () => t.eval(`document.getElementById("theme-toggle").click(); return 1;`);

await t.media("prefers-color-scheme", "light");
await sleep(1200);
let s = await state();
check("light system, nothing pinned -> light",
  s.attr === null && s.bg === LIGHT_BG && s.label === "Switch to dark theme", s);

await toggle(); await sleep(400);
s = await state();
check("click -> dark, pinned and stored",
  s.attr === "dark" && s.stored === "dark" && s.bg === DARK_BG
  && s.label === "Switch to light theme", s);

await t.send("Page.reload"); await sleep(1500);
s = await state();
check("reload keeps dark (pre-paint script ran)", s.attr === "dark" && s.bg === DARK_BG, s);

await toggle(); await sleep(400);
s = await state();
check("click again -> light", s.attr === "light" && s.stored === "light" && s.bg === LIGHT_BG, s);

await t.media("prefers-color-scheme", "dark"); await sleep(400);
s = await state();
check("a pinned light survives a dark system", s.bg === LIGHT_BG, s);

await t.eval(`try { localStorage.removeItem("theme"); } catch (e) {} return 1;`);
await t.send("Page.reload"); await sleep(1500);
s = await state();
check("dark system, nothing pinned -> dark",
  s.attr === null && s.bg === DARK_BG && s.label === "Switch to light theme", s);

t.close(); b.kill();
done();
