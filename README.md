# Pharmawiki — Compound & Drug Search

Pharmawiki is a search-first, static pharmacology reference. Start typing in the compound search to get curated suggestions immediately and live PubChem/RxNorm options after two characters. Selecting a result opens its own shareable hash-routed detail page; the study library, pathway map, atlas, evidence grading, and browser-local protocol log are separate routed views rather than one long page.

## Search coverage

- **PubChem** provides live compound suggestions and chemical identity properties through its public REST services.
- **RxNorm / RxNav** adds normalized medication terms, primarily for the U.S. drug vocabulary.
- The bundled `data.js` currently contains **8 curated monographs** and **12 graded study claims**. It is a small reference set, not an exhaustive chemical index.
- No single public source includes every compound and drug ever made. Catalog coverage varies by source; the search page links through to PubChem for broader results.

## Compound detail pages

Each selected local, PubChem, or RxNorm result opens a separate route (for example, `#drug/local/semaglutide`). Curated records show bundled pharmacology and evidence details; external records show the chemical or medication identity data returned by their source. The detail view also provides a source-grounded overview (bundled for curated records, or assembled from a matched label excerpt when available), selected quick facts, source links, and a PubChem 2D chemical structure image when available. A structure drawing is not a picture of a tablet and cannot identify a physical pill.

The “AI overview” heading is a human-readable summary, not a claim of live generation: curated text is bundled, and some external summaries are assembled from returned FDA-label text. This static app has no LLM backend or API key and does not generate individualized advice. U.S. FDA label sections (indications, adverse reactions, warnings, contraindications, and interactions) are requested from openFDA where a match is available. Labels differ by product, formulation, route, and revision; unmatched records and supplements may have no result. Use the linked official product information and DailyMed search to verify a specific medicine. A missing section or label match does not imply that no risk exists.

Search terms are sent directly from the browser to PubChem and RxNorm to retrieve live matches. Opening a record can also request PubChem chemical properties/structure images and search openFDA for U.S. drug-label sections. Pharmawiki has no application server, analytics, or live AI/LLM backend; each external service may process requests under its own policies. The protocol log is stored in browser `localStorage`; do not enter patient-identifying information.

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
