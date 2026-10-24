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

The backend template is in [`worker/`](./worker/). It defaults to **Cloudflare Workers AI** through a server-side binding, using the small `@cf/meta/llama-3.1-8b-instruct` model. Site visitors need no account, subscription, or API key. The Worker owner still needs a Cloudflare account to host the shared endpoint. Workers AI has account quotas and its free allowance and terms can change; this is free to visitors, not unlimited guaranteed compute. If the shared allowance or configured rate limit is reached, reviews may pause until it resets. Keep spending controls enabled in the Cloudflare account.

The Worker validates request size, source hosts, model output, citation IDs, and allowed website origins. It has a timeout and a basic per-isolate rate limit; configure the documented Cloudflare shared Rate Limiting binding for production because the fallback is not globally shared. **Never put any API key in `ai-config.js`, `app.js`, the repository, or browser code.** An optional OpenAI-compatible backend mode remains available for operators who choose another provider; set `AI_BACKEND = "openai-compatible"`, configure `AI_API_URL` and `AI_MODEL`, and store `AI_API_KEY` with `npx wrangler secret put AI_API_KEY`. That optional mode may incur charges.

To enable the shared free-model experience:

1. Create or use a Cloudflare account with Workers AI enabled. In `worker/wrangler.toml`, keep `AI_BACKEND = "cloudflare"` and set `ALLOWED_ORIGINS` to the exact website origin(s), with no path (for this GitHub Pages project, `https://z3n1thy.github.io`). Do not use `*` for a public deployment.
2. From `worker/`, authenticate Wrangler and deploy the Worker:

   ```bash
   npx wrangler login
   npx wrangler deploy
   ```

3. Copy the deployed Worker base URL (the app appends `/v1/review`) into `ai-config.js` as `window.PHARMAWIKI_AI_ENDPOINT = "https://your-worker.workers.dev";`, then publish the static site. This URL is public; no model key is needed for the default Workers AI mode.
4. For production, configure the shared Cloudflare Rate Limiting binding named `AI_RATE_LIMIT` (an example is commented in `worker/wrangler.toml`) and monitor account quotas.

The Worker and site URL are not deployed/configured from this repository, so live AI stays disabled until an operator completes these steps. The project does not include or request credentials.

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
