/*
 * Light/dark toggle, driven through a headless Chrome.
 *
 * The toggle has three states, not two: nothing stored means "follow the
 * system", and only a click pins data-theme. The states that matter are the
 * ones where those disagree -- a pinned light on a dark machine, and a dark
 * machine with nothing pinned -- so those are what this checks.
 *
 *   bundle exec jekyll serve      # in another shell
 *   node tools/test-theme.mjs [http://localhost:4000]
 *
 * Node 22+ (global WebSocket) and Google Chrome. No dependencies.
 */
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BASE = (process.argv[2] || "http://localhost:4000").replace(/\/$/, "");
const PAGE = BASE + "/year-archive/";
const CHROME = process.env.CHROME ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9000 + Math.floor(Math.random() * 900);

const LIGHT_BG = "rgb(255, 255, 255)";
const DARK_BG = "rgb(12, 21, 35)";     /* --paper under [data-theme=dark] */

const chrome = spawn(CHROME, [
  "--headless=new", `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${mkdtempSync(join(tmpdir(), "theme-"))}`,
  "--no-first-run", "--no-default-browser-check", "--disable-gpu", "about:blank",
], { stdio: "ignore" });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (let i = 0; i < 60; i++) {
  try { await fetch(`http://127.0.0.1:${PORT}/json/version`); break; } catch { await sleep(200); }
}

async function tab(url) {
  const t = await (await fetch(
    `http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(url)}`, { method: "PUT" })).json();
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((r) => { ws.onopen = r; });
  let id = 0;
  const waiting = new Map();
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && waiting.has(msg.id)) { waiting.get(msg.id)(msg); waiting.delete(msg.id); }
  };
  const send = (method, params = {}) => new Promise((res) => {
    const n = ++id;
    waiting.set(n, res);
    ws.send(JSON.stringify({ id: n, method, params }));
  });
  return {
    send,
    close: () => ws.close(),
    async eval(expr) {
      const r = await send("Runtime.evaluate",
        { expression: `(() => { ${expr} })()`, returnByValue: true });
      if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.text);
      return r.result?.result?.value;
    },
    scheme(value) {
      return send("Emulation.setEmulatedMedia",
        { features: [{ name: "prefers-color-scheme", value }] });
    },
    state() {
      return this.eval(`return {
        attr: document.documentElement.getAttribute("data-theme"),
        stored: (function () { try { return localStorage.getItem("theme"); } catch (e) { return "ERR"; } })(),
        bg: getComputedStyle(document.body).backgroundColor,
        label: (document.getElementById("theme-toggle") || {}).title
      };`);
    },
  };
}

let failed = 0;
function check(name, cond, got) {
  console.log((cond ? "ok   " : "FAIL ") + name + (cond ? "" : "\n       got " + JSON.stringify(got)));
  if (!cond) failed++;
}

const t = await tab(PAGE);
await t.scheme("light");
await sleep(1200);

let s = await t.state();
check("light system, nothing pinned -> light",
  s.attr === null && s.bg === LIGHT_BG && s.label === "Switch to dark theme", s);

await t.eval(`document.getElementById("theme-toggle").click(); return 1;`);
await sleep(400);
s = await t.state();
check("click -> dark, pinned and stored",
  s.attr === "dark" && s.stored === "dark" && s.bg === DARK_BG
  && s.label === "Switch to light theme", s);

await t.send("Page.reload");
await sleep(1500);
s = await t.state();
check("reload keeps dark (pre-paint script ran)", s.attr === "dark" && s.bg === DARK_BG, s);

await t.eval(`document.getElementById("theme-toggle").click(); return 1;`);
await sleep(400);
s = await t.state();
check("click again -> light", s.attr === "light" && s.stored === "light" && s.bg === LIGHT_BG, s);

await t.scheme("dark");
await sleep(400);
s = await t.state();
check("a pinned light survives a dark system", s.bg === LIGHT_BG, s);

await t.eval(`try { localStorage.removeItem("theme"); } catch (e) {} return 1;`);
await t.send("Page.reload");
await sleep(1500);
s = await t.state();
check("dark system, nothing pinned -> dark",
  s.attr === null && s.bg === DARK_BG && s.label === "Switch to light theme", s);

t.close();
chrome.kill("SIGKILL");
console.log(failed ? `\n${failed} failed` : "\nall passed");
process.exit(failed ? 1 : 0);
