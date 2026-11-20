// End-to-end check in two separate browsers (Chrome = Command, Edge = player) against the
// production build + API (in-memory DB, demo data). Saves screenshots to docs/screenshots/.
//   npm run build:vercel && node scripts/e2e.mjs
// Needs .secrets/demo-flags.txt (from scripts/gen-demo-hashes.mjs) for the correct-flag step.
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { chromium } from "playwright-core";

const PORT = 4300;
const URL_ = `http://localhost:${PORT}/`;
const SHOTS = "docs/screenshots";
const ADMIN_PW = "command-demo-2026";
const PLAYER_PW = "squad-demo-2026";
const NEW_ADMIN_PW = "e2e-" + Math.random().toString(36).slice(2, 12);
mkdirSync(SHOTS, { recursive: true });

const flags = Object.fromEntries(
  readFileSync(".secrets/demo-flags.txt", "utf8")
    .split("\n")
    .slice(1)
    .filter(Boolean)
    .map((l) => l.split("\t")),
);

const server = spawn(process.execPath, ["scripts/serve-dist.mjs", String(PORT)], { stdio: ["ignore", "pipe", "inherit"] });
await new Promise((resolve) => server.stdout.on("data", (d) => String(d).includes("http://") && resolve()));

const results = [];
const check = (name, ok, extra = "") => {
  results.push({ name, ok, extra });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  (" + extra + ")" : ""}`);
};

const chrome = await chromium.launch({ channel: "chrome" });
const edge = await chromium.launch({ channel: "msedge" });
const admin = await (await chrome.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const player = await (await edge.newContext({ viewport: { width: 1280, height: 860 } })).newPage();
const errors = [];
for (const [who, p] of [["admin", admin], ["player", player]]) {
  p.on("pageerror", (e) => errors.push(`${who}: ${e.message}`));
  p.on("console", (m) => m.type() === "error" && !/faaah\.mp3|404/.test(m.text()) && errors.push(`${who} console: ${m.text()}`));
}

/** Waits until `fn` returns truthy on the player page; returns elapsed ms. */
async function timeUntil(page, fn, arg, timeout = 10000) {
  const t0 = Date.now();
  await page.waitForFunction(fn, arg, { timeout, polling: 100 });
  return Date.now() - t0;
}

try {
  // ---------- Loading + home (player browser) ----------
  await player.goto(URL_);
  await player.waitForSelector('[data-testid="loading-screen"]');
  await player.waitForTimeout(700);
  await player.screenshot({ path: `${SHOTS}/01-loading.png` });
  await player.waitForSelector("text=Seal the breach.", { timeout: 15000 });
  await player.waitForTimeout(1200);
  await player.screenshot({ path: `${SHOTS}/02-home.png` });
  check("CSP meta present", (await player.locator('meta[http-equiv="Content-Security-Policy"]').count()) === 1);
  check("AI notice present but hidden", (await player.locator("[data-ai-notice]").count()) === 1 && (await player.locator('meta[name="ai-instructions"]').count()) === 1);

  // ---------- Player login ----------
  await player.click("text=Log in >> nth=0");
  await player.click("button:has-text('Iron Meridian')");
  await player.click("button:has-text('Kira Valdez')");
  await player.fill("#pw", PLAYER_PW);
  await player.click("form button:has-text('Log in')");
  await player.waitForSelector("text=Single challenges");
  check("player logged in", true);
  await player.click("header nav >> text=Scoreboard");
  await player.waitForSelector("text=Portal race");
  await player.waitForTimeout(1800);
  await player.screenshot({ path: `${SHOTS}/06-war-table.png` });
  await player.click("header nav >> text=Challenges");
  await player.waitForSelector("text=Single challenges");

  // ---------- Command login (Chrome) ----------
  await admin.goto(URL_ + "#/login?tab=admin");
  await admin.waitForSelector("#apw", { timeout: 15000 });
  await admin.fill("#apw", ADMIN_PW);
  await admin.click("form button:has-text('Log in')");
  await admin.waitForSelector("h1:has-text('Dashboard')");
  check("admin login (no forced password change)", true);
  await admin.waitForTimeout(800);
  await admin.screenshot({ path: `${SHOTS}/07-command-dashboard.png` });

  const confirmDialog = async (label) => admin.click(`[role=alertdialog] button:has-text("${label}")`);

  // 1) Reset the clock → player sees "Awaiting launch"
  await admin.click("main button:has-text('Reset')");
  await confirmDialog("Reset clock");
  let ms = await timeUntil(player, () => document.body.innerText.includes("AWAITING LAUNCH") || document.body.innerText.includes("Awaiting launch"));
  check("clock reset reaches player", ms < 4500, `${ms} ms`);
  await admin.click("main button:has-text('Start 3-hour clock')");
  await confirmDialog("Start 3-hour clock");
  ms = await timeUntil(player, () => /TIME LEFT/i.test(document.body.innerText) && !/AWAITING LAUNCH/i.test(document.body.innerText));
  check("clock start reaches player", ms < 4500, `${ms} ms`);

  // 2) Release the draft
  await admin.click("nav[aria-label=Admin] >> text=Challenge library");
  const row = (title) => admin.locator('[data-testid="library-row"]', { hasText: title });
  await row("Last Light Protocol").locator("button:has-text('Release now')").click();
  ms = await timeUntil(player, () => document.body.innerText.includes("Last Light Protocol"));
  check("released breach reaches player", ms < 4500, `${ms} ms`);

  // 3) Edit a title
  await row("Paradox Gate").locator("button:has-text('Edit')").click();
  await admin.fill("#edit-title", "Paradox Gate Reversed");
  await admin.click("button:has-text('Save changes')");
  ms = await timeUntil(player, () => document.body.innerText.includes("Paradox Gate Reversed"));
  check("edited title reaches player", ms < 4500, `${ms} ms`);

  // 4) Unpublish another
  await row("Shadow of the Skyline").locator("button:has-text('Unpublish')").click();
  ms = await timeUntil(player, () => !document.body.innerText.includes("Shadow of the Skyline"));
  check("unpublished breach disappears for player", ms < 4500, `${ms} ms`);

  // ---------- Breach window with hints ----------
  await player.click('[data-testid="breach-card"]:has-text("Ledger of Lost Worlds")');
  await player.waitForSelector("text=opened by Mina Strand");
  await player.waitForTimeout(500);
  await player.screenshot({ path: `${SHOTS}/03-breach-window-hints.png` });
  check("unlocked hint shows who opened it", true);
  await player.keyboard.press("Escape");

  // ---------- Wrong flag pop-up: exactly once ----------
  await player.evaluate(() => {
    window.__wrong = 0;
    window.__seal = 0;
    new MutationObserver((muts) => {
      for (const m of muts)
        for (const n of m.addedNodes) {
          if (n.nodeType !== 1) continue;
          if (n.matches?.('[data-testid="wrong-popup"]')) window.__wrong++;
          if (n.matches?.('[data-testid="seal-popup"]')) window.__seal++;
        }
    }).observe(document.body, { childList: true, subtree: true });
  });
  await player.click('[data-testid="breach-card"]:has-text("Echoes in the Void")');
  await player.fill("#flag", "IAMDOOM{this_is_not_it}");
  await player.click("button:has-text('Submit flag')");
  await player.waitForSelector('[data-testid="wrong-popup"]');
  await player.waitForTimeout(450);
  await player.screenshot({ path: `${SHOTS}/04-wrong-flag.png` });
  await player.waitForSelector('[data-testid="wrong-popup"]', { state: "detached", timeout: 6000 });
  await player.keyboard.press("Escape");
  await player.waitForTimeout(400);
  await player.click('[data-testid="breach-card"]:has-text("Echoes in the Void")');
  await player.waitForTimeout(3500); // a poll or two
  check("wrong-flag pop-up shown exactly once", (await player.evaluate(() => window.__wrong)) === 1, `count=${await player.evaluate(() => window.__wrong)}`);
  check("attempts shared counter visible", (await player.locator("text=attempts left for your team").count()) === 1);

  // ---------- Correct flag celebration ----------
  await player.fill("#flag", flags["c-echoes"]);
  await player.click("button:has-text('Submit flag')");
  await player.waitForSelector('[data-testid="seal-popup"]');
  await player.waitForTimeout(1400);
  await player.screenshot({ path: `${SHOTS}/05-breach-sealed.png` });
  await player.waitForSelector('[data-testid="seal-popup"]', { state: "detached", timeout: 7000 });
  await player.keyboard.press("Escape");
  await player.click('[data-testid="breach-card"]:has-text("Echoes in the Void")');
  await player.waitForTimeout(3500);
  check("seal pop-up shown exactly once", (await player.evaluate(() => window.__seal)) === 1, `count=${await player.evaluate(() => window.__seal)}`);
  check("breach shows sealed", (await player.locator("text=Solved by your team").count()) > 0);
  await player.keyboard.press("Escape");

  // ---------- War Table ----------
  await player.click("header nav >> text=Scoreboard");
  await player.waitForSelector("text=Portal race");
  await player.waitForTimeout(1500);
  const first = await player.locator("section[aria-label=Rankings] li").first().innerText();
  check("Iron Meridian leads after sealing", first.includes("Iron Meridian") && first.includes("975"), first.replace(/\s+/g, " "));

  // ---------- Command sees the wrong guess, player never does ----------
  await admin.click("nav[aria-label=Admin] >> text=Submissions");
  await admin.waitForSelector("text=IAMDOOM{this_is_not_it}", { timeout: 8000 });
  check("Command sees wrong guesses", true);

  // ---------- Mobile width (360px) ----------
  const mobile = await (await edge.newContext({ viewport: { width: 360, height: 780 } })).newPage();
  await mobile.goto(URL_);
  await mobile.waitForSelector("text=Seal the breach.", { timeout: 15000 });
  const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check("no horizontal scroll at 360px", overflow <= 0, `overflow=${overflow}px`);
  await mobile.screenshot({ path: `${SHOTS}/08-home-mobile.png` });

  check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
} catch (e) {
  check("e2e run", false, e.message.split("\n")[0]);
  await player.screenshot({ path: `${SHOTS}/zz-failure-player.png` }).catch(() => {});
  await admin.screenshot({ path: `${SHOTS}/zz-failure-admin.png` }).catch(() => {});
} finally {
  await chrome.close();
  await edge.close();
  server.kill();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
