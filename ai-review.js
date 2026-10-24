/* Pharmawiki's public AI-review client. The server-side provider key never belongs here. */
(function () {
  "use strict";

  var endpoint = String(window.PHARMAWIKI_AI_ENDPOINT || "").trim();
  var requests = { drug: 0, stack: 0 };
  var controllers = { drug: null, stack: null };
  var buttons = {
    drug: document.getElementById("run-ai-review-btn"),
    stack: document.getElementById("run-ai-stack-review-btn")
  };
  var statuses = {
    drug: document.getElementById("ai-review-status"),
    stack: document.getElementById("ai-stack-review-status")
  };
  var results = {
    drug: document.getElementById("ai-review-result"),
    stack: document.getElementById("ai-stack-review-result")
  };

  function configuredEndpoint() {
    if (!endpoint) return "";
    try {
      var url = new URL(endpoint, window.location.href);
      var hostname = url.hostname.toLowerCase().replace(/\.$/, "");
      if (url.protocol !== "https:" || hostname === "localhost" || hostname === "::1" || hostname === "[::1]" || /^127\./.test(hostname)) return "";
      if (url.username || url.password || url.search || url.hash) return "";
      var path = url.pathname.replace(/\/+$/, "");
      if (!path.endsWith("/v1/review")) url.pathname = (path || "") + "/v1/review";
      return url.href;
    } catch (_) {
      return "";
    }
  }

  function setStatus(kind, message, state) {
    var element = statuses[kind];
    if (!element) return;
    element.textContent = message;
    element.classList.remove("is-error", "is-loading", "is-success");
    if (state) element.classList.add("is-" + state);
  }

  function endpointMessage() {
    return configuredEndpoint()
      ? "AI endpoint configured. Reviews use selected medicine names and public reference excerpts only; do not include personal health information."
      : "Live AI is not connected. Configure the public endpoint URL in ai-config.js after deploying the Worker; never put an API key in this site.";
  }

  function resetKind(kind) {
    if (!Object.prototype.hasOwnProperty.call(requests, kind)) return;
    requests[kind] += 1;
    if (controllers[kind]) controllers[kind].abort();
    controllers[kind] = null;
    if (results[kind]) {
      results[kind].hidden = true;
      results[kind].textContent = "";
    }
    if (buttons[kind]) {
      buttons[kind].disabled = !configuredEndpoint();
      buttons[kind].removeAttribute("aria-busy");
    }
    setStatus(kind, endpointMessage());
  }

  function reset() {
    resetKind("drug");
    resetKind("stack");
    var badge = document.getElementById("ai-review-connection-badge");
    if (badge) badge.textContent = configuredEndpoint() ? "AI endpoint configured" : "Not connected";
  }

  function safeText(value, maxLength) {
    if (typeof value !== "string") return "";
    return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ").trim().slice(0, maxLength || 1600);
  }

  function normalizeFinding(value, sourceMap) {
    if (typeof value === "string") value = { text: value };
    if (!value || typeof value !== "object") return null;
    var text = safeText(value.text, 1800);
    if (!text) return null;
    var sourceIds = Array.isArray(value.sourceIds) ? value.sourceIds.slice(0, 8).filter(function (id) {
      return typeof id === "string" && Object.prototype.hasOwnProperty.call(sourceMap, id);
    }) : [];
    var basis = value.basis === "provided_source" || value.basis === "unverified_model_knowledge" ? value.basis : "unknown";
    return { text: text, sourceIds: sourceIds, basis: basis };
  }

  function safeSourceUrl(value) {
    try {
      var url = new URL(value);
      if (url.protocol !== "https:") return "";
      if (["api.fda.gov", "pubmed.ncbi.nlm.nih.gov", "pubchem.ncbi.nlm.nih.gov", "dailymed.nlm.nih.gov"].indexOf(url.hostname) === -1) return "";
      return url.href;
    } catch (_) {
      return "";
    }
  }

  function appendText(parent, tag, text, className) {
    var element = document.createElement(tag);
    if (className) element.className = className;
    element.textContent = text;
    parent.appendChild(element);
    return element;
  }

  function appendSourceLinks(parent, finding, sourceMap) {
    var note = document.createElement("div");
    note.className = "ai-review-finding-basis";
    if (finding.basis === "provided_source") {
      note.appendChild(document.createTextNode("AI interpretation of supplied source"));
      if (finding.sourceIds.length) {
        var list = document.createElement("span");
        list.className = "ai-review-source-links";
        finding.sourceIds.forEach(function (id) {
          var source = sourceMap[id];
          var href = source && safeSourceUrl(source.url);
          if (!source || !href) return;
          var link = document.createElement("a");
          link.href = href;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          link.textContent = safeText(source.title, 140) || "Source";
          list.appendChild(link);
        });
        if (list.childNodes.length) note.appendChild(list);
        else note.appendChild(document.createTextNode(" · no verified source link"));
      } else {
        note.appendChild(document.createTextNode(" · no supporting citation identified"));
      }
    } else if (finding.basis === "unverified_model_knowledge") {
      note.textContent = "Model knowledge; not verified against the supplied excerpts.";
    } else {
      note.textContent = "Evidence basis unclear; verify independently.";
    }
    parent.appendChild(note);
  }

  function appendFinding(parent, value, sourceMap) {
    var finding = normalizeFinding(value, sourceMap);
    if (!finding) return false;
    var article = document.createElement("article");
    article.className = "ai-review-finding";
    appendText(article, "p", finding.text, "ai-review-finding-text");
    appendSourceLinks(article, finding, sourceMap);
    parent.appendChild(article);
    return true;
  }

  function appendFindingList(parent, heading, values, sourceMap, emptyMessage) {
    var items = Array.isArray(values) ? values.slice(0, 8) : [];
    var valid = items.filter(function (item) { return normalizeFinding(item, sourceMap); });
    var section = document.createElement("section");
    section.className = "ai-review-section";
    appendText(section, "h4", heading);
    if (!valid.length) {
      appendText(section, "p", emptyMessage || "No supported summary was returned. This does not mean there are no effects or risks.", "ai-review-empty");
    } else {
      valid.forEach(function (item) { appendFinding(section, item, sourceMap); });
    }
    parent.appendChild(section);
  }

  function renderResult(kind, raw, sources) {
    var container = results[kind];
    if (!container) return;
    var sourceMap = {};
    (Array.isArray(sources) ? sources : []).forEach(function (source) {
      if (!source || typeof source.id !== "string") return;
      sourceMap[source.id] = {
        title: safeText(source.title, 180),
        url: safeText(source.url, 1000)
      };
    });
    var data = raw && typeof raw === "object" ? raw : {};
    container.textContent = "";
    container.hidden = false;
    var header = document.createElement("div");
    header.className = "ai-review-result-heading";
    appendText(header, "h3", "AI-generated evidence review");
    appendText(header, "span", "Not independently verified", "ai-review-generated-label");
    container.appendChild(header);

    var overview = normalizeFinding(data.overview, sourceMap);
    if (overview) {
      var overviewSection = document.createElement("section");
      overviewSection.className = "ai-review-section ai-review-overview";
      appendText(overviewSection, "h4", kind === "drug" ? "Summary" : "Stack overview");
      appendFinding(overviewSection, overview, sourceMap);
      container.appendChild(overviewSection);
    }

    if (kind === "drug") {
      appendFindingList(container, "Likely uses described in sources", data.uses, sourceMap, "No use summary was supported by the supplied evidence.");
      appendFindingList(container, "Reported side effects", data.sideEffects, sourceMap, "No side-effect summary was supported by the supplied evidence. This is not evidence that side effects are absent.");
      appendFindingList(container, "Serious warnings and cautions", data.seriousWarnings, sourceMap, "No warning summary was supported by the supplied evidence. Check the full current label.");
      appendFindingList(container, "Contraindications", data.contraindications, sourceMap, "No contraindication summary was supported by the supplied evidence. Check the full current label.");
      appendFindingList(container, "Labeled drug interactions", data.drugInteractions, sourceMap, "No interaction summary was supported by the supplied evidence. Check the full current label.");
    } else {
      appendFindingList(container, "Potential interaction findings", data.interactionFindings, sourceMap, "No interaction finding was supported by the supplied excerpts. This does not establish that the combination is safe.");
    }

    var assessmentLabels = {
      documented_flags: "Flags described in supplied evidence",
      no_flag_in_supplied_evidence: "No flag found in supplied evidence — not a safety clearance",
      insufficient_evidence: "Insufficient evidence for a meaningful assessment"
    };
    var assessment = assessmentLabels[data.assessment] || assessmentLabels.insufficient_evidence;
    var confidence = ["low", "moderate", "high"].indexOf(data.confidence) !== -1 ? data.confidence : "low";
    var summary = document.createElement("section");
    summary.className = "ai-review-assessment";
    appendText(summary, "strong", assessment);
    appendText(summary, "p", "Model-estimated confidence: " + confidence + " (not calibrated or a clinical risk score).", "ai-review-confidence");
    container.appendChild(summary);

    var limitations = Array.isArray(data.limitations) ? data.limitations.map(function (item) { return safeText(item, 500); }).filter(Boolean).slice(0, 6) : [];
    limitations.push("This AI output is not a diagnosis, personalized medical advice, or a guarantee of safety. Do not start, stop, or change medicines based on it; verify with a pharmacist or prescriber.");
    var list = document.createElement("ul");
    list.className = "ai-review-limitations";
    limitations.forEach(function (item) { appendText(list, "li", item); });
    container.appendChild(list);
  }

  function responseMessage(response, payload) {
    var text = payload && typeof payload.error === "string" ? payload.error : "";
    if (response.status === 429) return "The shared AI limit or free allowance has been reached. Please wait and try again later.";
    if (response.status === 503) return "The free AI service is not configured or available yet. Check the Worker AI binding and deployment.";
    if (response.status === 403) return "This site origin is not allowed by the AI backend. Add its origin to the Worker allowlist.";
    if (response.status >= 500) return "The AI backend could not complete the review. Please try again later.";
    return text ? safeText(text, 220) : "The AI backend returned an unexpected response.";
  }

  function run(kind, payload) {
    var url = configuredEndpoint();
    if (!url || !payload || !buttons[kind]) {
      setStatus(kind, "Live AI is not configured. Set the Worker URL in ai-config.js after deployment.", "error");
      return Promise.resolve(false);
    }
    if (controllers[kind]) controllers[kind].abort();
    var controller = typeof window.AbortController === "function" ? new window.AbortController() : null;
    controllers[kind] = controller;
    requests[kind] += 1;
    var requestId = requests[kind];
    var button = buttons[kind];
    var result = results[kind];
    var status = statuses[kind];
    var timeout = controller ? window.setTimeout(function () { controller.abort(); }, 45000) : null;
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    if (result) {
      result.hidden = true;
      result.textContent = "";
    }
    setStatus(kind, "Retrieving public label evidence and requesting a source-limited AI review…", "loading");

    var requestBody = Object.assign({}, payload, { task: kind });
    return window.fetch(url, {
      method: "POST",
      mode: "cors",
      cache: "no-store",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(requestBody),
      signal: controller ? controller.signal : undefined
    }).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (data) {
        if (!response.ok) throw new Error(responseMessage(response, data));
        if (!data || data.ok !== true || !data.review) throw new Error("The AI backend returned an invalid review. Please try again later.");
        if (requestId !== requests[kind]) return false;
        renderResult(kind, data.review, payload.sources || []);
        setStatus(kind, "Review completed. The model output is not independently verified; check every cited source.", "success");
        return true;
      });
    }).catch(function (error) {
      if (requestId !== requests[kind]) return false;
      var message = error && error.name === "AbortError"
        ? "The review timed out or was cancelled. Check your connection and try again."
        : (error && error.message === "Failed to fetch"
          ? "Could not reach the AI backend. Check its URL, deployment, and CORS origin allowlist."
          : (error && error.message || "AI review failed. Please try again."));
      if (result) {
        result.hidden = true;
        result.textContent = "";
      }
      setStatus(kind, message, "error");
      return false;
    }).finally(function () {
      if (timeout) window.clearTimeout(timeout);
      if (requestId === requests[kind]) {
        button.disabled = !configuredEndpoint();
        button.removeAttribute("aria-busy");
        controllers[kind] = null;
      }
      if (status && !status.textContent) setStatus(kind, endpointMessage());
    });
  }

  window.PharmawikiAIReview = {
    reset: reset,
    resetKind: resetKind,
    run: run,
    setStatus: setStatus
  };
  reset();
})();
