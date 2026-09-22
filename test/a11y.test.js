"use strict";

/**
 * Accessibility tests for the VCF Tools landing page.
 *
 * Loads index.html + theme.js in jsdom (no network) and runs axe-core plus
 * a few structural checks that axe does not cover (skip link target, theme
 * switcher pressed state after interaction).
 */

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");
const axe = require("axe-core");

const REPO_ROOT = path.resolve(__dirname, "..");

function loadPage() {
  let html = fs.readFileSync(path.join(REPO_ROOT, "index.html"), "utf8");
  // Offline: drop stylesheet links (axe color-contrast is disabled anyway).
  html = html.replace(/<link rel="stylesheet"[^>]*>\n?/g, "");
  const themeJs = fs.readFileSync(path.join(REPO_ROOT, "theme.js"), "utf8");
  assert.ok(!themeJs.includes("</script"), "theme.js must not contain a closing script tag");
  html = html.replace(
    '<script src="theme.js"></script>',
    "<script>\n" + themeJs + "\n</script>"
  );

  const dom = new JSDOM(html, {
    url: "http://localhost/",
    runScripts: "dangerously",
    pretendToBeVisual: true,
    beforeParse(window) {
      // jsdom does not implement matchMedia; theme.js needs it at parse time.
      window.matchMedia = (query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener() {},
        removeListener() {},
        addEventListener() {},
        removeEventListener() {},
        dispatchEvent() {
          return false;
        },
      });
    },
  });

  // Fire DOMContentLoaded so theme.js binds the switcher listeners.
  dom.window.document.dispatchEvent(new dom.window.Event("DOMContentLoaded", { bubbles: true }));
  return dom;
}

async function runAxe(dom) {
  const { window } = dom;
  window.eval(axe.source);
  // color-contrast needs real layout/fonts; skip under jsdom.
  return window.axe.run(window.document, {
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "best-practice"] },
    rules: { "color-contrast": { enabled: false } },
  });
}

function formatViolations(violations) {
  return violations
    .map((v) => {
      const nodes = v.nodes
        .map((n) => `    - ${n.target.join(", ")}: ${n.failureSummary}`)
        .join("\n");
      return `${v.id} (${v.impact}): ${v.help}\n${nodes}`;
    })
    .join("\n\n");
}

test("axe-core finds no WCAG 2 A/AA violations on the landing page", async () => {
  const dom = loadPage();
  const results = await runAxe(dom);
  assert.equal(
    results.violations.length,
    0,
    `axe violations:\n${formatViolations(results.violations)}`
  );
  dom.window.close();
});

test("document language, landmarks, and heading hierarchy are in place", () => {
  const dom = loadPage();
  const doc = dom.window.document;

  assert.equal(doc.documentElement.lang, "en");
  assert.ok(doc.querySelector('a.skip-link[href="#main"]'), "skip link targets #main");
  assert.ok(doc.getElementById("main"), "#main landmark target exists");
  assert.equal(doc.querySelector("main")?.id, "main");
  assert.equal(doc.querySelector('nav[aria-label="Primary navigation"]')?.tagName, "NAV");
  assert.equal(doc.querySelector("h1")?.id, "page-title");
  assert.ok(doc.querySelector('section[aria-labelledby="page-title"]'));
  assert.ok(doc.querySelector('section[aria-labelledby="tools-title"]'));
  assert.ok(doc.querySelector('section[aria-labelledby="principles-title"]'));

  const headings = [...doc.querySelectorAll("h1, h2, h3")].map((el) => ({
    level: Number(el.tagName[1]),
    text: el.textContent.trim(),
  }));
  assert.equal(headings[0].level, 1, "first heading must be h1");
  for (let i = 1; i < headings.length; i++) {
    assert.ok(
      headings[i].level <= headings[i - 1].level + 1,
      `heading level jump: ${headings[i - 1].text} (h${headings[i - 1].level}) → ${headings[i].text} (h${headings[i].level})`
    );
  }

  dom.window.close();
});

test("primary nav marks Overview as current and names the home link", () => {
  const dom = loadPage();
  const doc = dom.window.document;

  assert.equal(
    doc.querySelector('header .branding a[aria-label="VCF Tools home"]')?.getAttribute("href"),
    "./"
  );
  const active = doc.querySelector("header .header-actions .nav-link.active");
  assert.equal(active?.textContent.trim(), "Overview");
  assert.equal(active?.getAttribute("aria-current"), "page");

  const labels = [...doc.querySelectorAll("header .header-actions .nav-link")].map((a) =>
    a.textContent.trim()
  );
  assert.deepEqual(labels, ["Overview", "Ports", "Compliance", "Feedback ✉", "GitHub ↗"]);

  dom.window.close();
});

test("theme switcher exposes a pressed state and updates on click", () => {
  const dom = loadPage();
  const doc = dom.window.document;
  const root = doc.getElementById("theme-switcher");

  assert.ok(root);
  assert.equal(root.getAttribute("role"), "group");
  assert.equal(root.getAttribute("aria-label"), "Color theme");

  const buttons = [...root.querySelectorAll("button[data-theme]")];
  assert.deepEqual(
    buttons.map((b) => b.dataset.theme),
    ["light", "dark", "system"]
  );
  for (const button of buttons) {
    assert.ok(button.getAttribute("title"), `${button.dataset.theme} needs a title`);
    assert.ok(
      button.getAttribute("aria-pressed") === "true" || button.getAttribute("aria-pressed") === "false",
      `${button.dataset.theme} needs aria-pressed`
    );
  }

  // Default preference is system.
  assert.equal(buttons.find((b) => b.dataset.theme === "system")?.getAttribute("aria-pressed"), "true");
  assert.equal(buttons.find((b) => b.dataset.theme === "light")?.getAttribute("aria-pressed"), "false");

  buttons.find((b) => b.dataset.theme === "dark").click();
  assert.equal(buttons.find((b) => b.dataset.theme === "dark")?.getAttribute("aria-pressed"), "true");
  assert.equal(buttons.find((b) => b.dataset.theme === "system")?.getAttribute("aria-pressed"), "false");
  assert.equal(doc.body.getAttribute("cds-theme"), "dark");
  assert.equal(dom.window.localStorage.getItem("vcf-tools.theme"), "dark");

  dom.window.close();
});

test("interactive controls are named and no positive tabindex is used", () => {
  const dom = loadPage();
  const doc = dom.window.document;

  const positiveTabindex = [...doc.querySelectorAll("[tabindex]")].filter(
    (el) => Number(el.getAttribute("tabindex")) > 0
  );
  assert.deepEqual(
    positiveTabindex.map((el) => el.outerHTML.slice(0, 80)),
    [],
    "positive tabindex values create a custom tab order"
  );

  for (const el of doc.querySelectorAll("a, button")) {
    const name = (el.getAttribute("aria-label") || el.textContent || "").trim();
    assert.ok(name, `unnamed interactive element: ${el.outerHTML.slice(0, 120)}`);
  }

  for (const el of doc.querySelectorAll("[aria-hidden='true']")) {
    assert.equal(
      el.querySelectorAll("a, button, input, select, textarea").length,
      0,
      "aria-hidden must not wrap focusable controls"
    );
  }

  dom.window.close();
});
