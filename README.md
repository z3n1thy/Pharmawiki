# Pharmapedia — Open-Source Clinical Research Library

**Pharmapedia** is a 100% free, open-source clinical pharmacology reference library, receptor pathway mapper, and multi-compound stack checker built for patients, clinicians, and independent researchers.

It runs **100% client-side as a static website directly from GitHub Pages** (`index.html` + `styles.css` + `data.js` + `app.js`) with **zero backend servers, zero accounts, zero subscriptions, and zero telemetry**.

---

## Core Modules

1. **Compound Monograph Search (`Module 01`)** — Instant client-side search across reference dossiers indexing bioavailability, half-life ($t_{1/2}$), blood-brain barrier partitioning ($K_{p,\text{uu,brain}}$), CYP450/transporter clearance, receptor binding ($K_i$ / $\text{EC}_{50}$), and PubMed-sourced outcome claims.
2. **Quantified Study Library (`Module 02`)** — Filterable biomedical claim ledger with inline **Methodological Audit Drawers** detailing study design, allometric dosing parity, confounders, and honest reporting of large **null Phase III trials** alongside positive outcomes.
3. **Interactive Pathway Map & Stack Checker (`Module 03`)** — Tri-partite SVG network connecting **Active Regimen Compounds → Molecular Targets & CYP Enzymes → Physiological Risk Axes**, computing multi-agent convergence (e.g., `SERT` synergy, `CYP2D6` prodrug phenoconversion, `PXR` induction, `AMPK` overlap).
4. **Neuroanatomical Brain Atlas (`Module 04`)** — Interactive MNI152 sagittal brain schematic pairing **Allen Human Brain Atlas** regional transcript expression (`mRNA z-scores`) with human PET receptor occupancy and BBB permeability.
5. **Strict 5-Tier Evidence Grading (`Module 05`)** — Hard epistemic separation between:
   - **Grade A (`Ceiling 1.00`)**: Human Randomized Controlled Trials, Meta-Analyses & Clinical PK Crossover Studies
   - **Grade B (`Ceiling 0.65`)**: Human Observational Registries, Prospective Cohorts & Mendelian Randomization
   - **Grade C (`Ceiling 0.35`)**: In Vivo Animal Models (with FDA $K_m$ Human Equivalent Dose scaling checks)
   - **Grade D (`Ceiling 0.15`)**: In Vitro Cellular & Biochemical Assays (audited against achievable human unbound $C_{\text{max,u}}$)
   - **Grade E (`Ceiling 0.05`)**: Mechanistic & In Silico Pathway Inference (visually quarantined with dashed edges)
6. **Local-First Protocol Log (`Module 06`)** — Browser-local regimen tracker (`localStorage` only, 0 network requests) with 1-click **Clinician Review Brief (`.md`)** and full **Open Dataset (`.json`)** export.

---

## Hosting Directly on GitHub Pages

This repository is pre-configured to work out-of-the-box on **GitHub Pages** with zero build step required:

- Includes `.nojekyll` and relative asset paths (`./styles.css`, `./data.js`, `./app.js`, `./assets/...`) so it works seamlessly under both subpath URLs (`https://z3n1thy.github.io/Pharmawiki/`) and custom root domains.
- Self-hosts `Manrope` variable `.woff2` fonts (`assets/fonts/`, SIL Open Font License 1.1) so zero external requests to third-party font CDNs are needed.

### Enable in 30 Seconds on GitHub
1. Open **Settings → Pages** in your GitHub repository (`https://github.com/z3n1thy/Pharmawiki/settings/pages`).
2. Under **Build and deployment → Source**, choose **Deploy from a branch**.
3. Select branch **`main`** and folder **`/ (root)`**, then click **Save**.
4. After ~30–60 seconds, visit **`https://z3n1thy.github.io/Pharmawiki/`**.

### Run Locally / Offline
```bash
git clone https://github.com/z3n1thy/Pharmawiki.git
cd Pharmawiki
python3 -m http.server 8080
```
Then open `http://localhost:8080` (or open `index.html` directly in any modern browser).

---

## Contributing New Compounds & Graded Studies

All compounds, pathway edges, brain atlas expression profiles, and graded study records live in plain, human-readable JavaScript/JSON inside [`data.js`](./data.js). Every contributed claim must include:
- Primary **PubMed PMID** (or `NCT` identifier), **PubChem CID**, and **ChEMBL ID** where applicable
- Explicit **Evidence Tier (`A`–`E`)** following Module 05 rules
- Exposure/dosing parity verification for preclinical (`Grade C`/`D`) entries

---

## Clinical Disclaimer & License

Pharmapedia is an educational and clinical literature-synthesis tool and does not constitute medical advice, diagnosis, or individualized treatment recommendations. Always consult a qualified physician or clinical pharmacist before modifying any medication or supplement regimen.

Released 100% free and open-source under the **[MIT License](./LICENSE)**. Typography (`Manrope`) is licensed under the **[SIL Open Font License 1.1](./assets/fonts/OFL.txt)**.
