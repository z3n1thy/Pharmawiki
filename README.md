# Pharmapedia — Global Drug, Compound & Clinical Evidence Workbench

**Pharmapedia** is an open-source clinical pharmacology workbench, multi-compound stack/pathway checker, and 5-tier graded literature explorer built for patients, clinicians, and researchers.

It runs **100% client-side as a static website directly from GitHub Pages** (`index.html`, `styles.css`, `catalog.js`, `data.js`, `app.js`) with **zero backend servers, zero API keys, zero accounts, and zero telemetry**.

---

## Global Compound & Drug Coverage

Pharmapedia combines an instant built-in clinical directory (**267 core prescription medications, OTC drugs, biologics, peptides, supplements, nootropics, hormones, botanicals, and neurotransmitters**) with **live client-side federated queries** across four public scientific databases directly from your browser:

1. **NCBI PubChem (`PUG-REST`, `Autocomplete` & `PUG-View`)** — **118,000,000+ chemical compounds**, 2D molecular structures, IUPAC names, SMILES, InChIKeys, `XLogP3`, `TPSA`, Lipinski Rule-of-5 parameters, and pharmacology/toxicology monographs.
2. **EBI ChEMBL (`v34 REST API`)** — **2,400,000+ bioactive molecules**, clinical approval phases (Phase I–IV), verified mechanisms of action, and quantitative human receptor/enzyme binding assays ($K_i$, $\text{IC}_{50}$, $\text{EC}_{50}$, $K_d$ in `nM` / `pChEMBL`).
3. **US FDA OpenFDA (`SPL Drug Labels`)** — Official prescribing indications, clinical pharmacology, CYP450 pharmacokinetics, **Boxed Warnings**, contraindications, and cross-drug label interaction checks.
4. **NCBI PubMed (`E-Utilities`)** — **37,000,000+ biomedical publications** automatically stratified into Pharmapedia's **5-Tier Evidence Grading System** (`Grade A` Human RCTs & Meta-Analyses, `Grade B` Human Cohorts, `Grade C` Animal In Vivo, `Grade D` Cell/In Vitro, `Grade E` Mechanistic Inference & Reviews).

---

## Five Workspace Modules

- **`01 · Compound Workbench` (Default View)** — Opens straight into compound search and multi-database dossier synthesis, including computed **Blood-Brain Barrier CNS Multiparameter Optimization (`CNS MPO 0.0–6.0`)** scores.
- **`02 · Stack & Pathway Checker`** — Add *any* global drug, botanical, or supplement to map shared **CYP450 (`3A4`, `2D6`, `2C9`, `2C19`, `1A2`)**, transporter (`P-gp`, `OATP1B1`, `OCT2`), serotonergic, hemodynamic (`NO/cGMP`, `QTc`, `Coagulation`), CNS-depressant, and renal (`RAAS` / `Li+`) collisions alongside direct FDA drug-label cross-matches.
- **`03 · PubMed Evidence & Grading`** — Query any compound + disease/outcome across PubMed stratified by study tier, and inspect side-by-side translation gap audits.
- **`04 · CNS & Brain Atlas`** — Interactive stereotactic `MNI152` sagittal brain schematic pairing **Allen Human Brain Atlas** regional transcript expression with BBB partitioning.
- **`05 · Protocol Log`** — Private `localStorage`-only regimen log with 1-click `.md` clinician brief export.

---

## GitHub Pages Deployment

1. Open **Settings → Pages** (`https://github.com/z3n1thy/Pharmawiki/settings/pages`).
2. Select **Deploy from a branch** → **`main`** → **`/ (root)`** → **Save**.
3. Access live at **`https://z3n1thy.github.io/Pharmawiki/`** (supports deep links such as `?q=Atorvastatin`).

---

## License & Disclaimer

Educational pharmacology & biomedical literature reference only; not medical advice. Released under the **[MIT License](./LICENSE)**; self-hosted `Manrope` typography licensed under **[SIL Open Font License 1.1](./assets/fonts/OFL.txt)**.
