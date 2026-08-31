/*
 * The smallest thing that drives a headless Chrome: spawn it, open a tab,
 * run expressions in the page, send real input. Shared by the tests in this
 * directory so neither of them carries the plumbing.
 *
 * Node 22+ (global WebSocket) and Google Chrome. No dependencies.
 */
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME = process.env.CHROME ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function browser() {
  const port = 9000 + Math.floor(Math.random() * 900);
  const proc = spawn(CHROME, [
    "--headless=new", `--remote-debugging-port=${port}`,
    `--user-data-dir=${mkdtempSync(join(tmpdir(), "cdp-"))}`,
    "--no-first-run", "--no-default-browser-check", "--disable-gpu", "about:blank",
  ], { stdio: "ignore" });

  for (let i = 0; i < 60; i++) {
    try { await fetch(`http://127.0.0.1:${port}/json/version`); break; }
    catch { await sleep(200); }
  }

  return {
    kill: () => proc.kill("SIGKILL"),
    async open(url) {
      const t = await (await fetch(
        `http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`,
        { method: "PUT" })).json();
      return tab(t.webSocketDebuggerUrl);
    },
  };
}

async function tab(wsUrl) {
  const ws = new WebSocket(wsUrl);
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

  /* Not optional. Without the Page domain enabled,
     addScriptToEvaluateOnNewDocument is accepted and then quietly ignored,
     so a test that takes an API away still runs against an intact page and
     passes having proved nothing. */
  await send("Page.enable");

  return {
    send,
    close: () => ws.close(),
    async eval(expr) {
      const r = await send("Runtime.evaluate", {
        expression: `(async () => { ${expr} })()`,
        awaitPromise: true, returnByValue: true,
      });
      if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.text);
      return r.result?.result?.value;
    },
    /* Runs before any of the page's own script, so a test can take a browser
       API away the way an extension or a privacy setting does. */
    atStart: (source) => send("Page.addScriptToEvaluateOnNewDocument", { source }),
    media: (name, value) =>
      send("Emulation.setEmulatedMedia", { features: [{ name, value }] }),
    touch: (on = true) =>
      send("Emulation.setTouchEmulationEnabled", { enabled: on, maxTouchPoints: 5 }),
    move: (x, y) => send("Input.dispatchMouseEvent",
      { type: "mouseMoved", x, y, button: "none", buttons: 0, pointerType: "mouse" }),
    async click(x, y) {
      const base = { x, y, button: "left", clickCount: 1, pointerType: "mouse" };
      await send("Input.dispatchMouseEvent", { ...base, type: "mousePressed", buttons: 1 });
      await send("Input.dispatchMouseEvent", { ...base, type: "mouseReleased", buttons: 0 });
    },
  };
}

export function reporter() {
  let failed = 0;
  return {
    check(name, cond, got) {
      console.log((cond ? "ok   " : "FAIL ") + name +
        (cond ? "" : "\n       got " + JSON.stringify(got)));
      if (!cond) failed++;
    },
    done() {
      console.log(failed ? `\n${failed} failed` : "\nall passed");
      process.exit(failed ? 1 : 0);
    },
  };
}
