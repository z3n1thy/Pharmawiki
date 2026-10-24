# Pharmapedia — Compound & Drug Search

Pharmapedia is a search-first, static pharmacology reference. Start at the compound search to look up the locally curated dossiers or query public compound and medication catalogs. The other pages cover study evidence, pathway mapping, an atlas, evidence grading, and a browser-local protocol log.

## Search coverage

- **PubChem** provides live compound suggestions and chemical identity properties through its public REST services.
- **RxNorm / RxNav** adds normalized medication terms, primarily for the U.S. drug vocabulary.
- The bundled `data.js` currently contains **8 curated monographs** and **12 graded study claims**. It is a small reference set, not an exhaustive chemical index.
- No single public source includes every compound and drug ever made. Catalog coverage varies by source; the search page links through to PubChem for broader results.

Search terms are sent directly from the browser to PubChem and RxNorm to retrieve live matches. Pharmapedia does not store search history or run a search backend or analytics. The external services may process requests under their own policies. The protocol log is stored in browser `localStorage`; do not enter patient-identifying information.

## Other modules

- **Study library** — Filterable evidence claims and source links.
- **Pathway map & stack checker** — Interactive views of the bundled pathway examples.
- **Brain atlas** — Interactive schematic backed by the bundled reference data.
- **Evidence grading** — The app's A–E evidence categories and examples.
- **Protocol log** — Browser-local regimen notes with Markdown export.

The bundled records are reference examples, not a complete drug interaction checker or a substitute for a clinician's review.

## Run locally

No build step or dependencies are required:

```bash
git clone https://github.com/z3n1thy/Pharmawiki.git
cd Pharmawiki
python3 -m http.server 8080
```

Open `http://localhost:8080`. Live catalog search requires an internet connection; bundled dossiers and other bundled modules remain available offline.

The project can also be published from the repository root using GitHub Pages. It uses relative asset paths and includes `.nojekyll`.

## Data and contribution

The small local reference dataset lives in [`data.js`](./data.js). When adding a monograph or evidence claim, include source identifiers (such as PubChem CIDs and PubMed PMIDs), clearly state the evidence level, and distinguish clinical observations from preclinical results. Do not present catalog search results as independently verified clinical evidence.

## Clinical notice and license

This software is for educational and research reference only. It does not provide medical advice, diagnosis, or individualized treatment recommendations. Verify clinical decisions with a licensed physician or pharmacist.

Released under the [MIT License](./LICENSE). Manrope typefaces are covered by the [SIL Open Font License](./assets/fonts/OFL.txt).
