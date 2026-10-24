import test from "node:test";
import assert from "node:assert/strict";
import worker from "./index.mjs";

const allowedOrigin = "https://z3n1thy.github.io";
const endpoint = "https://worker.example.test/v1/review";

function source(id = "openfda-label-0", url = "https://api.fda.gov/drug/label.json?limit=1") {
  return { id, title: "openFDA label excerpt", url, excerpt: "Reported adverse reactions include nausea." };
}

function drugBody(sources = [source()]) {
  return {
    task: "drug",
    drug: { name: "Semaglutide", facts: [] },
    sources
  };
}

function env(overrides = {}) {
  return Object.assign({
    ALLOWED_ORIGINS: allowedOrigin,
    AI_BACKEND: "openai-compatible",
    AI_API_URL: "https://model.example.test/v1/chat/completions",
    AI_API_KEY: "server-only-test-key",
    AI_MODEL: "example-model",
    REQUESTS_PER_MINUTE: "8"
  }, overrides);
}

function request(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.origin) headers.set("Origin", options.origin);
  if (options.body) headers.set("Content-Type", "application/json");
  return new Request("https://worker.example.test" + path, {
    method: options.method || (options.body ? "POST" : "GET"),
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
}

function mockModelFetch(review, inspect) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async function (url, init) {
    if (inspect) inspect(url, init);
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(review) } }] }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  };
  return function restore() { globalThis.fetch = originalFetch; };
}

test("health endpoint reports configuration without exposing provider secrets", async () => {
  const response = await worker.fetch(request("/health"), env());
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.ok, true);
  assert.equal(data.configured, true);
  assert.equal(JSON.stringify(data).includes("server-only-test-key"), false);
});

test("preflight permits only allowlisted origins", async () => {
  const allowed = await worker.fetch(request("/v1/review", { method: "OPTIONS", origin: allowedOrigin }), env());
  const denied = await worker.fetch(request("/v1/review", { method: "OPTIONS", origin: "https://attacker.invalid" }), env());
  assert.equal(allowed.status, 204);
  assert.equal(allowed.headers.get("Access-Control-Allow-Origin"), allowedOrigin);
  assert.equal(denied.status, 403);
});

test("rejects source links outside the approved public reference hosts", async () => {
  const response = await worker.fetch(request("/v1/review", {
    origin: allowedOrigin,
    body: drugBody([source("bad-source", "https://attacker.invalid/prompt")])
  }), env());
  const data = await response.json();
  assert.equal(response.status, 400);
  assert.equal(data.ok, false);
});

test("fails closed when provider credentials or model settings are missing", async () => {
  const response = await worker.fetch(request("/v1/review", { origin: allowedOrigin, body: drugBody() }), env({ AI_API_KEY: "" }));
  assert.equal(response.status, 503);
  assert.equal((await response.json()).ok, false);
});

test("uses the free Cloudflare Workers AI binding without a provider API key", async () => {
  const originalFetch = globalThis.fetch;
  let chosenModel = "";
  globalThis.fetch = function () { throw new Error("The external provider path should not be called."); };
  try {
    const ai = {
      run: async function (model, options) {
        chosenModel = model;
        assert.equal(options.messages.length, 2);
        return { response: JSON.stringify({
          overview: { text: "A cautious free-model summary.", basis: "provided_source", sourceIds: ["openfda-label-0"] },
          uses: [], sideEffects: [], seriousWarnings: [], contraindications: [], drugInteractions: [], interactionFindings: [],
          assessment: "insufficient_evidence", confidence: "low", limitations: []
        }) };
      }
    };
    const response = await worker.fetch(request("/v1/review", {
      origin: allowedOrigin,
      headers: { "CF-Connecting-IP": "192.0.2.24" },
      body: drugBody()
    }), env({
      AI_BACKEND: "cloudflare",
      AI: ai,
      AI_API_URL: "",
      AI_API_KEY: "",
      AI_MODEL: "@cf/meta/llama-3.1-8b-instruct"
    }));
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(chosenModel, "@cf/meta/llama-3.1-8b-instruct");
    assert.equal(data.review.overview.text, "A cautious free-model summary.");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("returns a retryable response when the shared free AI quota is exhausted", async () => {
  const response = await worker.fetch(request("/v1/review", {
    origin: allowedOrigin,
    headers: { "CF-Connecting-IP": "192.0.2.25" },
    body: drugBody()
  }), env({
    AI_BACKEND: "cloudflare",
    AI: { run: async function () { throw new Error("Daily neuron limit exceeded."); } },
    AI_API_URL: "",
    AI_API_KEY: "",
    AI_MODEL: "@cf/meta/llama-3.1-8b-instruct"
  }));
  const data = await response.json();
  assert.equal(response.status, 429);
  assert.match(data.error, /quota is temporarily exhausted/i);
});

test("validates model output, allows only supplied citation IDs, and keeps the key server-side", async () => {
  const review = {
    overview: { text: "A source-grounded overview.", basis: "provided_source", sourceIds: ["openfda-label-0", "invented-id"] },
    uses: [{ text: "Use statement.", basis: "provided_source", sourceIds: ["openfda-label-0"] }],
    sideEffects: [{ text: "Nausea is reported.", basis: "provided_source", sourceIds: ["openfda-label-0"] }],
    seriousWarnings: [],
    interactionFindings: [],
    assessment: "no_flag_in_supplied_evidence",
    confidence: "moderate",
    limitations: ["Limited excerpts."]
  };
  let restore = mockModelFetch(review, function (url, init) {
    assert.equal(String(url), "https://model.example.test/v1/chat/completions");
    assert.equal(new Headers(init.headers).get("Authorization"), "Bearer server-only-test-key");
  });
  try {
    const response = await worker.fetch(request("/v1/review", {
      origin: allowedOrigin,
      headers: { "CF-Connecting-IP": "192.0.2.21" },
      body: drugBody()
    }), env());
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(data.ok, true);
    assert.deepEqual(data.review.overview.sourceIds, ["openfda-label-0"]);
    assert.equal(JSON.stringify(data).includes("server-only-test-key"), false);
  } finally {
    restore();
  }
});

test("accepts a bounded stack review and preserves only supplied interaction citations", async () => {
  const review = {
    overview: { text: "Evidence is limited to these selected sources.", basis: "provided_source", sourceIds: ["rule-0"] },
    uses: [], sideEffects: [], seriousWarnings: [], contraindications: [], drugInteractions: [],
    interactionFindings: [{ text: "The supplied bundled rule flags this pairing.", basis: "provided_source", sourceIds: ["rule-0", "unknown-source"] }],
    assessment: "documented_flags", confidence: "low", limitations: []
  };
  const restore = mockModelFetch(review);
  try {
    const body = {
      task: "stack",
      stack: {
        items: [
          { name: "Escitalopram", localReferenceMatch: true, localReferenceName: "Escitalopram" },
          { name: "Tramadol", localReferenceMatch: true, localReferenceName: "Tramadol HCl" }
        ],
        bundledRules: [{ title: "Bundled rule", severity: "critical", detail: "Reference excerpt.", sourceId: "rule-0" }]
      },
      sources: [source("rule-0", "https://pubmed.ncbi.nlm.nih.gov/23486848/")]
    };
    const response = await worker.fetch(request("/v1/review", {
      origin: allowedOrigin,
      headers: { "CF-Connecting-IP": "192.0.2.23" },
      body
    }), env());
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(data.review.assessment, "documented_flags");
    assert.deepEqual(data.review.interactionFindings[0].sourceIds, ["rule-0"]);
  } finally {
    restore();
  }
});

test("applies the fallback per-isolate request limit", async () => {
  const restore = mockModelFetch({
    overview: { text: "Limited review.", basis: "unknown", sourceIds: [] },
    uses: [], sideEffects: [], seriousWarnings: [], interactionFindings: [],
    assessment: "insufficient_evidence", confidence: "low", limitations: []
  });
  try {
    const options = {
      origin: allowedOrigin,
      headers: { "CF-Connecting-IP": "192.0.2.22" },
      body: drugBody()
    };
    const first = await worker.fetch(request("/v1/review", options), env({ REQUESTS_PER_MINUTE: "1" }));
    const second = await worker.fetch(request("/v1/review", options), env({ REQUESTS_PER_MINUTE: "1" }));
    assert.equal(first.status, 200);
    assert.equal(second.status, 429);
  } finally {
    restore();
  }
});
