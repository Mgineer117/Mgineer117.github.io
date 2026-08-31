/*
 * The topic filter on the publications page.
 *
 * Two things have to stay true for every topic, and both are the kind that
 * look fine until you read the numbers:
 *
 *   - a heading's tally counts what is on screen, not what exists, so
 *     "Journal articles 3" never sits above one card;
 *   - a group the filter emptied disappears entirely, rather than sitting
 *     there announcing zero.
 *
 *   bundle exec jekyll serve                # in another shell
 *   node tools/test-filters.mjs [http://localhost:4000]
 */
import { browser, reporter, sleep } from "./cdp.mjs";

const BASE = (process.argv[2] || "http://localhost:4000").replace(/\/$/, "");
const { check, done } = reporter();
const b = await browser();
const t = await b.open("about:blank");

/* This page counts a visit when it loads. A test that runs often should not
   move a number the site is showing people, so drop those calls. */
await t.atStart(`(function () {
  var real = window.fetch;
  window.fetch = function (u) {
    if (String(u).indexOf("firestore.googleapis.com") >= 0) {
      return Promise.reject(new Error("blocked in test"));
    }
    return real.apply(this, arguments);
  };
})();`);
await t.send("Page.navigate", { url: BASE + "/publications/" });
await sleep(2500);

const snap = () => t.eval(`
  var out = [];
  document.querySelectorAll("[data-filter-group]").forEach(function (g) {
    out.push({
      name: g.querySelector(".group-head span").textContent.replace(/\\s+/g, " ").trim(),
      badge: parseInt(g.querySelector(".group-head em").textContent, 10),
      shown: g.querySelectorAll(".pub-card:not(.is-hidden)").length,
      hidden: getComputedStyle(g).display === "none"
    });
  });
  return { groups: out,
           tags: Array.from(document.querySelectorAll(".filter-btn"))
                      .map(function (b) { return b.textContent.trim(); }) };`);

const pick = (label) => t.eval(`
  var b = Array.from(document.querySelectorAll(".filter-btn"))
    .find(function (x) { return x.textContent.trim() === ${JSON.stringify(label)}; });
  if (b) b.click();
  return !!b;`);

const agrees = (s) => s.groups.every((g) =>
  g.shown === 0 ? g.hidden : (!g.hidden && g.badge === g.shown));

let s = await snap();
check("unfiltered, every tally matches its group", agrees(s), s.groups);
const totals = s.groups.map((g) => g.badge);

for (const tag of s.tags.filter((x) => x !== "All")) {
  await pick(tag);
  await sleep(350);
  const f = await snap();
  check(`"${tag}": tallies follow the filter, empty groups go`, agrees(f), f.groups);
}

await pick("All");
await sleep(350);
s = await snap();
check("clearing the filter restores the totals",
  s.groups.every((g, i) => g.badge === totals[i]), s.groups);

t.close();
b.kill();
done();
