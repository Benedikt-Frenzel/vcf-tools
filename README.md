# VCF Tools

A static landing page for independent, browser-based VMware Cloud Foundation utilities:

- [VCF Ports](https://benedikt-frenzel.github.io/vcf-ports/) — VCF 9.1 communication matrix and firewall planning exports
- [VCF Compliance](https://benedikt-frenzel.github.io/vcf-compliance/) — VCF Operations compliance scorecard builder

The site uses vendored [Clarity Design](https://clarity.design/) assets and has no backend, analytics, runtime CDN, or build step.

## GitHub Pages

The workflow in `.github/workflows/pages.yml` publishes the repository root on pushes to `main`. In **Settings → Pages**, select **GitHub Actions** as the source. On every push and pull request it also installs the Node test deps and runs the accessibility suite.

## Testing

```bash
npm install
npm test
```

`test/a11y.test.js` loads `index.html` + `theme.js` in jsdom (offline) and checks:

- axe-core WCAG 2 A/AA + best-practice (color-contrast disabled under jsdom)
- document language, skip link, landmarks, and heading hierarchy
- primary nav current-page markup
- theme switcher `aria-pressed` state after click
- named interactive controls and no positive `tabindex`

## Local preview

```bash
python3 -m http.server 8080
```

Open <http://localhost:8080>.

## Disclaimer

Independent community projects. Not affiliated with, endorsed by, or supported by Broadcom Inc. or any of its subsidiaries. Product names and trademarks belong to their respective owners.
