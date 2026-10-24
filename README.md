# Pharmawiki — Compound & Drug Search

Pharmawiki is a search-first pharmacology reference. Type at least two characters to see matching curated records immediately and live PubChem/RxNorm suggestions as they arrive. Selecting a result opens its own shareable hash-routed detail page; the study library, pathway map, atlas, evidence grading, and browser-local protocol log are separate routed views.

## Search coverage

- **PubChem** provides live compound suggestions and chemical identity properties through its public REST services.
- **RxNorm / RxNav** adds normalized medication terms, primarily for the U.S. drug vocabulary.
- The bundled `data.js` currently contains **8 curated monographs** and **12 graded study claims**. It is a small reference set, not an exhaustive chemical index.
- No single public source includes every compound and drug ever made. Catalog coverage varies by source; the search page links through to PubChem for broader results.

## Compound detail pages

Each selected local, PubChem, or RxNorm result opens a separate route (for example, `#drug/local/semaglutide`). Curated records show bundled pharmacology and evidence details; external records show identity data returned by their source. Detail pages include Compound, Studies, Brain, Map, and Stack/cart tabs, a fixed reference overview, quick facts, available FDA-label sections, and links to public catalogs. The product area uses explicitly illustrative Pharmawiki package artwork with a common brand example where one is curated; it is not an authentic product photo, pill identifier, or claim of market rank. Verify any actual brand, dose, form, and package against local product information.

### Optional live AI review

The compound page has an **AI evidence review** action for a generated overview, uses, reported side effects, and serious warnings. The Stack tab has an **AI interaction review** action for two to six selected items. These run only when a backend is deployed and its public URL is configured in `ai-config.js`; the checked-in default is deliberately blank. Existing bundled overviews remain fixed reference text and are not misrepresented as AI output.

The browser sends only the selected medicine names, relevant catalog facts, public openFDA label excerpts where available, and bundled reference summaries. Do not send patient details. The backend asks the model to distinguish supplied evidence from unverified model knowledge and only returns citations from the supplied source IDs. AI findings are not independently verified; inspect every cited source. A missing label section, missing interaction finding, or “no flag” result is **not** evidence that a medicine or combination is safe. The output is not a diagnosis, individualized safety determination, or treatment recommendation.

The optional backend template is in [`worker/`](./worker/). It is a Cloudflare Worker (a practical server-side default for this static GitHub Pages app) and accepts an OpenAI Chat Completions-compatible provider URL and model, so no particular model vendor is selected. Provider credentials are read only from the Worker environment; **never put an API key in `ai-config.js`, `app.js`, the repository, or browser code**. The Worker validates request size, source hosts, output fields, citations, and allowed browser origins, and has a timeout and rate limiting. Its in-memory rate-limit fallback is per Worker isolate only; configure Cloudflare's shared Rate Limiting binding for production.

To enable live AI:

1. Deploy `worker/` to Cloudflare Workers. In `worker/wrangler.toml`, set `AI_API_URL` to an HTTPS OpenAI-compatible Chat Completions endpoint, set `AI_MODEL`, and set `ALLOWED_ORIGINS` to the exact website origin(s), with no path (for this GitHub Pages project, `https://z3n1thy.github.io`). Add a local origin such as `http://localhost:8080` only for development. Do not use `*` for a public production deployment.
2. Store the provider key as a Worker secret, not a repository variable or frontend value:

   ```bash
   cd worker
   npx wrangler secret put AI_API_KEY
   npx wrangler deploy
   ```

3. Copy the deployed Worker base URL (the endpoint appends `/v1/review`) into `ai-config.js` as `window.PHARMAWIKI_AI_ENDPOINT = "https://your-worker.workers.dev";`. This URL is public; the provider key is not.
4. For production, configure a Cloudflare Rate Limiting binding named `AI_RATE_LIMIT` and keep the origin allowlist narrow. Deploy the static site and Worker separately.

The backend is not deployed or connected in this repository, no provider key is included, and live AI remains disabled until an operator completes these steps. If the configured provider does not support OpenAI-compatible Chat Completions with JSON-object output, adapt the Worker provider request/response adapter server-side.

### Label and interaction reference limits

U.S. FDA label sections (indications, adverse reactions, warnings, contraindications, and interactions) are requested from openFDA where a match is available. Labels differ by product, formulation, route, and revision; unmatched records and supplements may have no result. Use the linked official product information and DailyMed search to verify the exact medicine. The Stack/cart keeps entries in this browser, but the bundled interaction index currently models only 12 compounds; other entries remain visibly marked **not assessed**. Its 1–10 thermometer is a scaled reference-index signal—not a validated, individualized safety score—and no flag does not mean a combination is safe.

Search terms are sent directly from the browser to PubChem and RxNorm to retrieve live matches. Opening a record can also request PubChem chemical properties and search openFDA. Each external service may process requests under its own policies. The protocol log and optional stack cart are stored in browser `localStorage`; do not enter patient-identifying information.

## Other modules

- **Study library** — Filterable evidence claims and source links.
- **Pathway map & stack checker** — Interactive views of the bundled pathway examples.
- **Brain atlas** — Interactive schematic backed by bundled reference data.
- **Evidence grading** — The app's A–E evidence categories and examples.
- **Protocol log** — Browser-local regimen notes with Markdown export.

The bundled records are reference examples, not a complete drug interaction checker or a substitute for a clinician's review.

## Run locally

No build step or dependencies are required for the static app:

```bash
git clone https://github.com/z3n1thy/Pharmawiki.git
cd Pharmawiki
python3 -m http.server 8080
```

Open `http://localhost:8080`. Live catalog search requires an internet connection; bundled dossiers and modules remain available offline. Live AI additionally requires the Worker/provider setup above and an allowlisted local origin.

Run the server-side checks with Node.js:

```bash
node --test worker/test.mjs
```

The static project can be published from the repository root using GitHub Pages. It uses relative asset paths and includes `.nojekyll`.

## Data and contribution

The small local reference dataset lives in [`data.js`](./data.js). When adding a monograph or evidence claim, include source identifiers (such as PubChem CIDs and PubMed PMIDs), clearly state the evidence level, and distinguish clinical observations from preclinical results. Do not present catalog search results as independently verified clinical evidence.

## Clinical notice and license

This software is for educational and research reference only. It does not provide medical advice, diagnosis, or individualized treatment recommendations. Verify clinical decisions with a licensed physician or pharmacist.

Released under the [MIT License](./LICENSE). Manrope typefaces are covered by the [SIL Open Font License](./assets/fonts/OFL.txt).
