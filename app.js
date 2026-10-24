/* ==========================================================================
   Pharmawiki Compound Search & Reference App (app.js)
   Client-side vanilla JS; live catalog lookups go directly to PubChem and RxNorm.
   ========================================================================== */

(function () {
  "use strict";

  var DATA = window.PHARMAWIKI_DATA;
  if (!DATA) {
    console.error("Pharmawiki dataset (data.js) failed to load.");
    return;
  }

  /* ------------------------------------------------------------------------
     Utility Helpers
     ------------------------------------------------------------------------ */
  function escapeHtml(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function pubmedUrl(pmid) {
    return "https://pubmed.ncbi.nlm.nih.gov/" + encodeURIComponent(pmid) + "/";
  }

  function pubchemUrl(cid) {
    return "https://pubchem.ncbi.nlm.nih.gov/compound/" + encodeURIComponent(cid);
  }

  function chemblUrl(id) {
    return "https://www.ebi.ac.uk/chembl/compound_report_card/" + encodeURIComponent(id) + "/";
  }

  var toastTimer = null;
  function showToast(message) {
    var toast = document.getElementById("clinical-toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("is-visible");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toast.classList.remove("is-visible");
    }, 3100);
  }

  function gradeBadgeHtml(grade, extraLabel) {
    var clean = escapeHtml(grade);
    var suffix = extraLabel ? " · " + escapeHtml(extraLabel) : "";
    return '<span class="grade-pill grade-' + clean + '">Grade ' + clean + suffix + "</span>";
  }

  /* ------------------------------------------------------------------------
     Mobile Navigation Menu
     ------------------------------------------------------------------------ */
  function initMobileNav() {
    var toggle = document.getElementById("mobile-menu-toggle");
    var nav = document.getElementById("primary-nav");
    if (!toggle || !nav) return;

    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });

    nav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        nav.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  /* ------------------------------------------------------------------------
     1. Compound & Drug Catalog Search
     ------------------------------------------------------------------------ */
  var catalogSearch = {
    query: "",
    requestId: 0,
    timer: null,
    controller: null,
    pubchem: [],
    rxnorm: [],
    pubchemError: false,
    rxnormError: false
  };
  var detailRequestId = 0;
  var currentDrugFacts = [];
  var currentDrugContext = null;
  var activeDrugTab = "compound";
  var drugDetailTabsInitialized = false;

  var AI_OVERVIEWS = {
    semaglutide: "Semaglutide is a long-acting GLP-1 receptor agonist. It mimics an incretin hormone, supporting glucose-dependent insulin release and reducing appetite; it can also slow stomach emptying. Approved uses differ between products and formulations, including type 2 diabetes and chronic weight management. This profile summarizes selected research, not an individual treatment plan.",
    escitalopram: "Escitalopram is a selective serotonin reuptake inhibitor (SSRI) used for depression and, depending on the product label, anxiety disorders. It increases serotonin signalling by blocking the serotonin transporter. Benefit and adverse effects vary by person; check the official label below for warnings and reported reactions.",
    metformin: "Metformin is a biguanide commonly prescribed for type 2 diabetes. It primarily lowers liver glucose production and improves insulin sensitivity; it is not an insulin substitute. The curated profile also notes renal transporter interactions and product-specific warnings.",
    "magnesium-threonate": "Magnesium L-threonate is a magnesium salt sold mainly as a dietary supplement, not an FDA-approved treatment for cognitive disease. The bundled evidence includes animal work and a small human pilot; those findings do not establish that it prevents or treats memory problems. Supplement contents and evidence quality can vary.",
    "cdp-choline": "Citicoline (CDP-choline) is a choline-containing compound involved in phospholipid synthesis and cholinergic pathways. It is sold as a supplement in some markets and has been studied for neurological outcomes. The bundled evidence includes a large stroke trial that did not show benefit on its primary outcome, alongside smaller studies.",
    nac: "N-acetylcysteine (NAC) is a precursor used by the body to make glutathione and is also used as a mucolytic. Acetylcysteine has an FDA-approved role in acetaminophen overdose; approved routes and uses depend on the product. The profile distinguishes these established uses from less certain supplement claims.",
    bupropion: "Bupropion is an aminoketone antidepressant that inhibits norepinephrine and dopamine reuptake. Depending on formulation and label, it is used for depression, seasonal affective disorder, or smoking cessation. It also inhibits CYP2D6, so interactions and formulation-specific warnings matter.",
    "lithium-lowdose": "Lithium carbonate is a mood-stabilizing prescription medicine used in bipolar disorder. It has a narrow therapeutic range, is cleared by the kidneys, and requires clinician-directed monitoring. This record discusses lithium pharmacology; it should not be read as support for unsupervised microdosing or over-the-counter lithium products."
  };

  // Brand names are examples for navigation/context, not claims of market rank.
  // The accompanying vector art is deliberately illustrative, never a fake product photo.
  var PRODUCT_BRAND_PROFILES = {
    semaglutide: { brand: "Ozempic", form: "Prefilled injection pen · example product", kind: "pen", color: "#70418A" },
    escitalopram: { brand: "Lexapro", form: "Oral tablets · product form varies", kind: "tablet", color: "#337B7B" },
    metformin: { brand: "Glucophage", form: "Oral tablets · strength and form vary", kind: "tablet", color: "#347A65" },
    "magnesium-threonate": { brand: "Magtein", form: "Supplement ingredient · finished-product form varies", kind: "capsule", color: "#617548" },
    "cdp-choline": { brand: "Cognizin", form: "Branded citicoline ingredient · finished-product brand varies", kind: "capsule", color: "#426D9A" },
    nac: { brand: "Fluimucil", form: "Example acetylcysteine brand · form varies by market", kind: "tablet", color: "#488391" },
    bupropion: { brand: "Wellbutrin", form: "Modified-release tablets · formulation matters", kind: "tablet", color: "#8A5944" },
    "lithium-lowdose": { brand: "Lithobid", form: "Example extended-release tablet brand · country varies", kind: "tablet", color: "#735A88" }
  };

  var ROUTE_TO_PAGE = {
    search: "search", top: "search", studies: "studies", "study-library": "studies",
    pathways: "pathways", "stack-checker": "pathways", atlas: "atlas", "brain-atlas": "atlas",
    evidence: "evidence", "evidence-grading": "evidence", protocol: "protocol", "protocol-log": "protocol"
  };

  function setText(id, value) {
    var element = document.getElementById(id);
    if (element) element.textContent = value == null ? "" : String(value);
  }

  function setSourceLink(id, href, visible) {
    var link = document.getElementById(id);
    if (!link) return;
    if (href) link.href = href;
    link.hidden = !visible;
  }

  function renderDrugFacts(rows) {
    currentDrugFacts = rows || [];
    var factsEl = document.getElementById("drug-facts");
    if (!factsEl) return;
    factsEl.innerHTML = currentDrugFacts.map(function (fact) {
      return '<div class="drug-fact-row"><span>' + escapeHtml(fact.label) + '</span><strong>' + escapeHtml(fact.value) + "</strong></div>";
    }).join("") || '<p class="drug-facts-empty">No structured facts are available for this record.</p>';
  }

  function setDrugOverview(text, note) {
    var overview = document.getElementById("drug-overview");
    if (!overview) return;
    overview.innerHTML = '<p>' + escapeHtml(text) + '</p>' +
      (note ? '<p class="generated-overview-note">' + escapeHtml(note) + "</p>" : "");
  }

  function setDrugIdentifiers(html) {
    var element = document.getElementById("drug-page-identifiers");
    if (element) element.innerHTML = html || "";
  }

  function resetDrugPage(name, source, subtitle) {
    detailRequestId += 1;
    var token = detailRequestId;
    var monograph = findMonographForName(name || "");
    currentDrugContext = {
      name: name || "Compound detail",
      source: source || "Reference record",
      monograph: monograph || null,
      record: null,
      brand: "",
      brandSource: "",
      form: ""
    };
    setText("drug-page-title", name || "Compound detail");
    setText("drug-page-subtitle", subtitle || "Reference details from the selected catalog record.");
    setText("drug-page-type", source || "Medication & chemical reference");
    setText("drug-page-record-source", source || "Reference record");
    setText("dossier-source-label", source || "Catalog record");
    setDrugIdentifiers("");
    var dossierIds = document.getElementById("dossier-ids");
    var overview = document.getElementById("drug-overview");
    var body = document.getElementById("dossier-body");
    var labelGrid = document.getElementById("drug-label-grid");
    var labelState = document.getElementById("drug-label-state");
    if (dossierIds) dossierIds.innerHTML = "";
    if (overview) overview.innerHTML = '<p>Building a source-grounded overview…</p>';
    if (body) body.innerHTML = '<div class="empty-detail-state"><span class="catalog-spinner" aria-hidden="true"></span><p>Loading reference details…</p></div>';
    if (labelGrid) labelGrid.hidden = true;
    if (labelState) labelState.textContent = "Looking for a matching U.S. FDA drug label…";
    renderDrugFacts([]);
    setSourceLink("drug-pubchem-link", "https://pubchem.ncbi.nlm.nih.gov/", false);
    setSourceLink("drug-rxnorm-link", "https://rxnav.nlm.nih.gov/", false);
    setSourceLink("drug-fda-link", "https://api.fda.gov/", false);
    setSourceLink("drug-dailymed-link", "https://dailymed.nlm.nih.gov/dailymed/", true);
    renderDefaultDrugProductPackage();
    renderRelatedDrugRecords();
    setActiveDrugTab("compound", false);
    return token;
  }

  function dailyMedSearchUrl(term) {
    return "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=" + encodeURIComponent(term || "");
  }

  function renderDrugProductPackage(profile) {
    var art = document.getElementById("drug-product-art");
    var caption = document.getElementById("drug-product-caption");
    if (!art) return;
    var product = profile || {};
    var brand = product.brand || "Brand not identified";
    var form = product.form || "Product form not identified in this record";
    var productName = (currentDrugContext && currentDrugContext.name) || "Compound reference";
    var color = /^#[0-9a-f]{6}$/i.test(product.color || "") ? product.color : "#4666A0";
    var safeBrand = brand.length > 27 ? brand.slice(0, 24) + "…" : brand;
    var safeName = productName.length > 32 ? productName.slice(0, 29) + "…" : productName;
    var safeForm = form.length > 31 ? form.slice(0, 28) + "…" : form;
    var icon = "";
    if (product.kind === "tablet") {
      icon = '<g transform="translate(216 133) rotate(-32)"><rect x="-18" y="-8" width="36" height="16" rx="8" fill="#FFFFFF" stroke="#87909A" stroke-width="1.5"/><path d="M0 -8v16" stroke="#87909A" stroke-width="1.2"/></g>';
    } else if (product.kind === "capsule") {
      icon = '<g transform="translate(216 133) rotate(-32)"><rect x="-20" y="-8" width="40" height="16" rx="8" fill="#FFFFFF" stroke="#87909A" stroke-width="1.5"/><path d="M0 -7.5v15" stroke="#87909A" stroke-width="1.2"/><path d="M-19 0a8 8 0 0 1 8-8h11v16h-11a8 8 0 0 1-8-8Z" fill="' + color + '" opacity=".86"/></g>';
    } else if (product.kind === "pen") {
      icon = '<g transform="translate(218 132) rotate(-38)"><rect x="-7" y="-31" width="14" height="54" rx="6" fill="#FFFFFF" stroke="#87909A" stroke-width="1.5"/><rect x="-7" y="-10" width="14" height="12" fill="' + color + '"/><path d="M-3 23h6l-3 9Z" fill="#A9B2BD"/><path d="M-4 -23h8" stroke="#87909A" stroke-width="1.5"/></g>';
    }
    art.innerHTML =
      '<svg class="drug-package-svg" viewBox="0 0 300 190" role="img" aria-label="Illustrative package artwork for ' + escapeHtml(brand) + ', not an actual medicine package">' +
      '<title>Illustrative package artwork: ' + escapeHtml(brand) + '</title>' +
      '<desc>A Pharmawiki-created reference illustration, not an authentic product photograph or a pill identification image.</desc>' +
      '<defs><linearGradient id="package-front-shade" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#E7E9E7"/></linearGradient></defs>' +
      '<ellipse cx="155" cy="166" rx="106" ry="11" fill="#14202B" opacity=".12"/>' +
      '<polygon points="68,35 220,35 244,49 92,49" fill="#F7F8F7" stroke="#C5CBCB"/>' +
      '<polygon points="220,35 244,49 244,151 220,139" fill="#D4DAD9" stroke="#B7C0C1"/>' +
      '<rect x="68" y="35" width="152" height="116" rx="3" fill="url(#package-front-shade)" stroke="#B7C0C1"/>' +
      '<rect x="68" y="35" width="152" height="12" rx="3" fill="' + color + '"/>' +
      '<rect x="80" y="59" width="8" height="65" rx="4" fill="' + color + '" opacity=".20"/>' +
      '<text x="98" y="73" fill="#25313B" font-family="Arial, sans-serif" font-size="15" font-weight="700">' + escapeHtml(safeBrand) + '</text>' +
      '<text x="98" y="91" fill="#42505A" font-family="Arial, sans-serif" font-size="8.5">' + escapeHtml(safeName) + '</text>' +
      '<text x="98" y="107" fill="#707B82" font-family="Arial, sans-serif" font-size="7.5">' + escapeHtml(safeForm) + '</text>' +
      '<line x1="98" y1="115" x2="201" y2="115" stroke="#D2D7D6"/>' +
      '<text x="98" y="129" fill="#738087" font-family="Arial, sans-serif" font-size="6.5" letter-spacing="1.1">PHARMAWIKI REFERENCE ART</text>' +
      icon +
      '<text x="230" y="99" fill="#626D73" font-family="Arial, sans-serif" font-size="6" text-anchor="middle" transform="rotate(90 230 99)">ILLUSTRATION</text>' +
      '<circle cx="229" cy="147" r="10" fill="' + color + '" opacity=".13"/><path d="M225 147h8M229 143v8" stroke="' + color + '" stroke-width="1.4"/>' +
      '</svg>';
    if (caption) {
      var origin = product.origin ? product.origin + ": " : "";
      var brandNote = brand === "Brand not identified"
        ? "No brand was identified in the selected record. "
        : origin + brand + " is shown as a brand reference only. ";
      caption.textContent = brandNote + "This is illustrative artwork, not authentic packaging or a pill identifier. Product form, strength, and packaging vary by country and manufacturer; verify the actual product.";
    }
  }

  function renderDefaultDrugProductPackage() {
    var context = currentDrugContext || {};
    var monograph = context.monograph;
    var profile = monograph && PRODUCT_BRAND_PROFILES[monograph.id];
    if (profile) {
      context.brand = profile.brand;
      context.form = profile.form;
      context.brandSource = "Common brand example";
      renderDrugProductPackage({
        brand: profile.brand,
        form: profile.form,
        kind: profile.kind,
        color: profile.color,
        origin: "Common brand example"
      });
      return;
    }
    context.brand = "Brand not identified";
    context.form = "Product form not identified in this record";
    context.brandSource = "No brand supplied";
    renderDrugProductPackage({
      brand: context.brand,
      form: context.form,
      kind: "unknown",
      color: "#4666A0",
      origin: "No brand supplied"
    });
  }

  function updateDrugProductBrand(brand, form, origin) {
    if (!currentDrugContext || !brand) return;
    currentDrugContext.brand = String(brand).trim();
    currentDrugContext.form = form || currentDrugContext.form || "Product form not identified in this record";
    currentDrugContext.brandSource = origin || "Catalog record";
    var monographProfile = currentDrugContext.monograph && PRODUCT_BRAND_PROFILES[currentDrugContext.monograph.id];
    renderDrugProductPackage({
      brand: currentDrugContext.brand,
      form: currentDrugContext.form,
      kind: (monographProfile && monographProfile.kind) || inferProductKind(currentDrugContext.form),
      color: (monographProfile && monographProfile.color) || "#4666A0",
      origin: currentDrugContext.brandSource
    });
  }

  function inferProductKind(form) {
    var value = String(form || "").toLowerCase();
    if (/tablet|tab\b|effervescent/.test(value)) return "tablet";
    if (/capsule|cap\b/.test(value)) return "capsule";
    if (/pen|injection|injectable/.test(value)) return "pen";
    return "unknown";
  }

  function extractRxNormBrand(name) {
    var value = String(name || "").trim();
    var match = value.match(/^(.+?)\s+(?=\d+(?:\.\d+)?\s*(?:mcg|µg|mg|g|ml|iu|unit|meq|mmol)\b)/i);
    return match ? match[1].trim() : value;
  }

  function extractRxNormForm(name) {
    var match = String(name || "").match(/\b(oral tablet|tablet|capsule|oral solution|oral suspension|injection|prefilled syringe|prefilled pen|extended release|delayed release|chewable)\b/i);
    return match ? match[1] : "Product form not specified by this RxNorm term";
  }

  function renderHeroChips() {
    var container = document.getElementById("hero-compound-chips");
    if (!container) return;

    container.innerHTML = DATA.monographs.slice(0, 6).map(function (m) {
      return (
        '<button type="button" class="compound-chip" data-quick-id="' +
        escapeHtml(m.id) +
        '">' +
        escapeHtml(m.name) +
        "</button>"
      );
    }).join("");
  }

  function renderDossier(monographId) {
    var m = DATA.monographs.find(function (item) { return item.id === monographId; });
    if (!m) return;

    var token = resetDrugPage(m.name, "Curated Pharmawiki monograph", m.classLabel);
    setText("drug-page-record-source", "Curated reference · local dataset");
    setText("dossier-source-label", "Curated profile");
    var cidLink = '<a href="' + pubchemUrl(m.pubchemCid) + '" target="_blank" rel="noopener noreferrer">CID:' + escapeHtml(m.pubchemCid) + '</a>';
    var chemblLink = '<a href="' + chemblUrl(m.chemblId) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(m.chemblId) + '</a>';
    var dossierIds = document.getElementById("dossier-ids");
    if (dossierIds) dossierIds.innerHTML = cidLink + "<span>·</span>" + chemblLink;
    setDrugIdentifiers(
      '<span>CAS ' + escapeHtml(m.cas) + '</span>' +
      '<a href="' + pubchemUrl(m.pubchemCid) + '" target="_blank" rel="noopener noreferrer">PubChem CID ' + escapeHtml(m.pubchemCid) + ' ↗</a>' +
      '<a href="' + chemblUrl(m.chemblId) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(m.chemblId) + ' ↗</a>'
    );
    setSourceLink("drug-pubchem-link", pubchemUrl(m.pubchemCid), true);
    setSourceLink("drug-rxnorm-link", "https://rxnav.nlm.nih.gov/", false);
    setSourceLink("drug-dailymed-link", dailyMedSearchUrl(m.name), true);

    var overview = AI_OVERVIEWS[m.id] || (m.name + " is listed as " + m.classLabel + ". Review the mechanisms, evidence grades, and source links below for the available details.");
    setDrugOverview(overview, "Static summary of this bundled reference record; it is not a live AI response or a medical recommendation.");
    renderDrugFacts([
      { label: "Chemical class", value: m.classLabel },
      { label: "Molecular formula", value: m.formula },
      { label: "Molecular weight", value: m.mw },
      { label: "Bioavailability", value: m.pk.bioavailability },
      { label: "Half-life", value: m.pk.halfLife },
      { label: "BBB / distribution", value: m.pk.bbb },
      { label: "Clearance", value: m.pk.clearance }
    ]);

    var targetsHtml = m.targets.map(function (t) {
      return '<div class="target-row"><div><strong>' + escapeHtml(t.receptor) +
        '</strong><span class="target-gene">' + escapeHtml(t.gene) +
        '</span><p class="drug-target-mode">' + escapeHtml(t.mode || "") +
        '</p></div><div class="target-affinity">' + escapeHtml(t.metric) + ": " + escapeHtml(t.affinity) +
        '</div><div>' + gradeBadgeHtml(t.grade) + "</div></div>";
    }).join("");
    var claimsHtml = m.claims.map(function (c) {
      return '<div class="dossier-claim-item"><div class="dossier-claim-top">' + gradeBadgeHtml(c.grade, c.tierLabel) +
        '<span class="dossier-claim-effect">' + escapeHtml(c.effect) +
        '</span></div><p class="dossier-claim-text">' + escapeHtml(c.claim) +
        '</p><div class="dossier-claim-meta"><span>' + escapeHtml(c.cohort) +
        '</span><a href="' + pubmedUrl(c.pmid) + '" target="_blank" rel="noopener noreferrer">PMID: ' + escapeHtml(c.pmid) +
        " ↗</a></div></div>";
    }).join("");
    var bodyEl = document.getElementById("dossier-body");
    if (bodyEl) {
      bodyEl.innerHTML =
        '<div class="dossier-subhead"><span>Pharmacokinetics</span><span>Curated values</span></div><div class="pk-mini-grid">' +
        '<div class="pk-cell"><span class="pk-label">Bioavailability</span><span class="pk-val">' + escapeHtml(m.pk.bioavailability) +
        '</span></div><div class="pk-cell"><span class="pk-label">Elimination half-life</span><span class="pk-val">' + escapeHtml(m.pk.halfLife) +
        '</span></div><div class="pk-cell"><span class="pk-label">BBB partitioning</span><span class="pk-val">' + escapeHtml(m.pk.bbb) +
        '</span></div><div class="pk-cell"><span class="pk-label">Clearance / CYP</span><span class="pk-val">' + escapeHtml(m.pk.clearance) +
        '</span></div></div><div class="dossier-subhead"><span>Targets &amp; pathways</span><span>Affinity / evidence</span></div>' +
        '<div class="target-list">' + targetsHtml +
        '</div><div class="dossier-subhead"><span>Curated outcome claims</span><span>PubMed provenance</span></div>' +
        '<div class="dossier-claims-list">' + claimsHtml +
        '</div><div class="dossier-note">' + escapeHtml(m.clinicalNote) + "</div>";
    }
    loadOpenFdaLabel(m.name, token);
  }

  function renderCatalogResultButton(source, index, id, name, description, sourceLabel) {
    var dataAttributes = ' data-result-source="' + escapeHtml(source) + '"';
    if (id) dataAttributes += ' data-result-id="' + escapeHtml(id) + '"';
    if (index != null) dataAttributes += ' data-result-index="' + index + '"';
    return (
      '<button type="button" class="catalog-result" aria-pressed="false"' + dataAttributes + '>' +
      '<span class="catalog-result-copy"><strong>' + escapeHtml(name) +
      '</strong><span class="catalog-result-description">' + escapeHtml(description || "") +
      '</span></span><span class="catalog-source-tag">' + escapeHtml(sourceLabel) + "</span></button>"
    );
  }

  var activeSuggestionIndex = -1;

  function renderCatalogSuggestionButton(source, index, id, name, description, sourceLabel) {
    var token = id || index || 0;
    var optionId = "catalog-option-" + source + "-" + String(token).replace(/[^A-Za-z0-9_-]/g, "-");
    var attributes = ' id="' + escapeHtml(optionId) + '" data-result-source="' + escapeHtml(source) + '"';
    if (id) attributes += ' data-result-id="' + escapeHtml(id) + '"';
    if (index != null) attributes += ' data-result-index="' + index + '"';
    return '<button type="button" role="option" aria-selected="false" class="catalog-suggestion"' + attributes + '>' +
      '<span class="catalog-suggestion-copy"><strong>' + escapeHtml(name) +
      '</strong><small>' + escapeHtml(description || "") +
      '</small></span><span class="catalog-source-tag">' + escapeHtml(sourceLabel) + "</span></button>";
  }

  function closeCatalogSuggestions() {
    var panel = document.getElementById("catalog-suggestions");
    var input = document.getElementById("hero-compound-input");
    if (panel) panel.hidden = true;
    if (input) {
      input.setAttribute("aria-expanded", "false");
      input.removeAttribute("aria-activedescendant");
    }
    activeSuggestionIndex = -1;
  }

  function setActiveCatalogSuggestion(index) {
    var input = document.getElementById("hero-compound-input");
    var options = Array.prototype.slice.call(document.querySelectorAll(".catalog-suggestion"));
    activeSuggestionIndex = index >= 0 && index < options.length ? index : -1;
    options.forEach(function (option, optionIndex) {
      var active = optionIndex === activeSuggestionIndex;
      option.classList.toggle("is-active", active);
      option.setAttribute("aria-selected", active ? "true" : "false");
    });
    if (input) {
      if (activeSuggestionIndex < 0) input.removeAttribute("aria-activedescendant");
      else {
        input.setAttribute("aria-activedescendant", options[activeSuggestionIndex].id);
        if (typeof options[activeSuggestionIndex].scrollIntoView === "function") {
          options[activeSuggestionIndex].scrollIntoView({ block: "nearest" });
        }
      }
    }
  }

  function renderCatalogSuggestions(localMatches, query, loading) {
    var panel = document.getElementById("catalog-suggestions");
    var optionsEl = document.getElementById("catalog-suggestion-options");
    var statusEl = document.getElementById("catalog-suggestions-status");
    var input = document.getElementById("hero-compound-input");
    if (!panel || !optionsEl || !statusEl || !input) return;
    var searchPage = document.querySelector('[data-page="search"]');
    if (searchPage && searchPage.hidden) {
      closeCatalogSuggestions();
      return;
    }
    var cleanQuery = String(query || "").trim();
    if (!cleanQuery) {
      optionsEl.innerHTML = "";
      statusEl.textContent = "";
      closeCatalogSuggestions();
      return;
    }

    var options = [];
    if (cleanQuery.length >= 2) {
      localMatches.slice(0, 8).forEach(function (item) {
        options.push(renderCatalogSuggestionButton("local", null, item.id, item.name, item.classLabel, "Curated"));
      });
      catalogSearch.pubchem.slice(0, 6).forEach(function (item, index) {
        options.push(renderCatalogSuggestionButton("pubchem", index, null, item.name, "Chemical identity · open PubChem detail", "PubChem"));
      });
      catalogSearch.rxnorm.slice(0, 6).forEach(function (item, index) {
        options.push(renderCatalogSuggestionButton("rxnorm", index, null, item.name, rxNormTypeLabel(item.tty), "RxNorm"));
      });
    }
    optionsEl.innerHTML = options.join("");
    activeSuggestionIndex = -1;
    input.removeAttribute("aria-activedescendant");
    panel.hidden = false;
    input.setAttribute("aria-expanded", "true");
    var unavailableSources = [];
    if (catalogSearch.pubchemError) unavailableSources.push("PubChem");
    if (catalogSearch.rxnormError) unavailableSources.push("RxNorm");

    if (cleanQuery.length < 2) {
      statusEl.textContent = "Type one more character to see compound and medicine suggestions.";
    } else if (loading) {
      statusEl.textContent = options.length ? "Searching PubChem and RxNorm for more options…" : "Searching PubChem and RxNorm…";
    } else if (options.length) {
      statusEl.textContent = options.length + " suggestions · use the arrow keys or select one to open its page." +
        (unavailableSources.length ? " " + unavailableSources.join(" and ") + (unavailableSources.length === 1 ? " is" : " are") + " unavailable." : "");
    } else if (unavailableSources.length) {
      var searchUrl = "https://pubchem.ncbi.nlm.nih.gov/#query=" + encodeURIComponent(cleanQuery);
      statusEl.innerHTML = unavailableSources.join(" and ") + " suggestions are unavailable. <a href=\"" + escapeHtml(searchUrl) +
        "\" target=\"_blank\" rel=\"noopener noreferrer\">Search PubChem directly ↗</a>";
    } else {
      statusEl.textContent = "No matches yet. Try a generic name, brand, synonym, or PubChem CID.";
    }
  }

  function openCatalogResult(button) {
    if (!button) return;
    var source = button.getAttribute("data-result-source");
    closeCatalogSuggestions();
    if (source === "local") {
      var localItem = DATA.monographs.find(function (item) { return item.id === button.getAttribute("data-result-id"); });
      if (localItem) window.location.hash = makeDrugRoute("local", localItem);
    } else if (source === "pubchem") {
      var pubchemItem = catalogSearch.pubchem[parseInt(button.getAttribute("data-result-index"), 10)];
      if (pubchemItem) window.location.hash = makeDrugRoute("pubchem", pubchemItem);
    } else if (source === "rxnorm") {
      var rxnormItem = catalogSearch.rxnorm[parseInt(button.getAttribute("data-result-index"), 10)];
      if (rxnormItem) window.location.hash = makeDrugRoute("rxnorm", rxnormItem);
    }
  }

  function renderCatalogResults(localMatches, query, loading) {
    var resultsEl = document.getElementById("catalog-results");
    if (!resultsEl) return;

    var sections = [];
    if (localMatches.length) {
      sections.push(
        '<section class="catalog-result-group"><h2>Curated dossiers <span>' + localMatches.length +
        '</span></h2><div class="catalog-result-list">' +
        localMatches.map(function (m) {
          return renderCatalogResultButton("local", null, m.id, m.name, m.classLabel, "Curated");
        }).join("") +
        "</div></section>"
      );
    }

    if (catalogSearch.pubchem.length) {
      sections.push(
        '<section class="catalog-result-group"><h2>PubChem compounds <span>' + catalogSearch.pubchem.length +
        '</span></h2><div class="catalog-result-list">' +
        catalogSearch.pubchem.map(function (item, index) {
          return renderCatalogResultButton("pubchem", index, null, item.name, "Open chemical identity and properties", "PubChem");
        }).join("") +
        "</div></section>"
      );
    }

    if (catalogSearch.rxnorm.length) {
      sections.push(
        '<section class="catalog-result-group"><h2>RxNorm drug terms <span>' + catalogSearch.rxnorm.length +
        '</span></h2><div class="catalog-result-list">' +
        catalogSearch.rxnorm.map(function (item, index) {
          return renderCatalogResultButton(
            "rxnorm", index, null, item.name,
            rxNormTypeLabel(item.tty) + (item.synonym ? " · " + item.synonym : ""),
            "RxNorm"
          );
        }).join("") +
        "</div></section>"
      );
    }

    if (loading) {
      sections.push('<p class="catalog-loading" role="status">Searching PubChem and RxNorm…</p>');
    }

    if (query.length < 2) {
      if (query.length === 1 && !localMatches.length) {
        sections.push('<div class="catalog-empty-state"><p>Type one more character to search the live catalogs.</p></div>');
      } else if (!sections.length) {
        sections.push('<div class="catalog-empty-state"><h2>Start with a compound or medicine</h2><p>Type at least two characters to search PubChem and RxNorm. Open a result for its own reference page, package illustration, overview, studies, brain map, and available label information.</p></div>');
      }
    } else if (!loading && !sections.length) {
      if (catalogSearch.pubchemError || catalogSearch.rxnormError) {
        sections.push('<div class="catalog-empty-state"><h2>Live catalog lookup unavailable</h2><p>Check your connection, or open the full PubChem search below. Curated dossiers remain available offline.</p></div>');
      } else {
        sections.push('<div class="catalog-empty-state"><h2>No matches found</h2><p>Try a generic name, brand name, synonym, or PubChem CID.</p></div>');
      }
    }

    if (query.length >= 2) {
      sections.push(
        '<div class="catalog-results-footer"><a href="https://pubchem.ncbi.nlm.nih.gov/#query=' +
        encodeURIComponent(query) +
        '" target="_blank" rel="noopener noreferrer">Open full PubChem search ↗</a></div>'
      );
    }

    resultsEl.innerHTML = sections.join("");
  }

  function localMonographMatches(query) {
    var q = query.toLowerCase();
    if (!q) return [];
    return DATA.monographs.filter(function (m) {
      var haystack = [
        m.name,
        m.classLabel,
        m.pubchemCid,
        m.chemblId,
        m.cas,
        m.formula,
        m.pk.clearance,
        (m.aliases || []).join(" "),
        m.targets.map(function (t) { return t.receptor + " " + t.gene; }).join(" "),
        m.claims.map(function (c) { return c.claim + " " + c.pmid; }).join(" ")
      ].join(" ").toLowerCase();
      return haystack.indexOf(q) !== -1;
    });
  }

  function pubchemAutocompleteTerms(payload) {
    var terms = payload && payload.dictionary_terms && payload.dictionary_terms.compound;
    if (!Array.isArray(terms)) return [];
    var seen = {};
    return terms.map(function (term) {
      if (typeof term === "string") return { name: term };
      if (!term || typeof term !== "object") return null;
      var name = term.term || term.name || term.value || term.label;
      return name ? { name: String(name) } : null;
    }).filter(function (item) {
      if (!item || !item.name) return false;
      var key = item.name.toLowerCase();
      if (seen[key]) return false;
      seen[key] = true;
      return true;
    }).slice(0, 20);
  }

  function rxNormConcepts(payload) {
    var groups = payload && payload.drugGroup && payload.drugGroup.conceptGroup;
    if (!Array.isArray(groups)) return [];
    var seen = {};
    var concepts = [];
    groups.forEach(function (group) {
      (group.conceptProperties || []).forEach(function (concept) {
        if (!concept || !concept.rxcui || !concept.name) return;
        var key = String(concept.rxcui) + ":" + String(concept.tty || "");
        if (seen[key]) return;
        seen[key] = true;
        concepts.push({
          rxcui: String(concept.rxcui),
          name: String(concept.name),
          tty: String(concept.tty || ""),
          synonym: String(concept.synonym || "")
        });
      });
    });
    return concepts.slice(0, 16);
  }

  function rxNormTypeLabel(tty) {
    var labels = {
      IN: "Ingredient",
      PIN: "Precise ingredient",
      MIN: "Multiple ingredients",
      BN: "Brand name",
      SCD: "Clinical drug",
      SBD: "Branded drug",
      GPCK: "Generic pack",
      BPCK: "Branded pack"
    };
    return labels[tty] || (tty ? "RxNorm " + tty : "RxNorm drug term");
  }

  function fetchJson(url, signal) {
    if (typeof window.fetch !== "function") return Promise.reject(new Error("Fetch is unavailable"));
    var options = { headers: { Accept: "application/json" } };
    if (signal) options.signal = signal;
    return window.fetch(url, options).then(function (response) {
      if (!response.ok) throw new Error("Catalog request failed (" + response.status + ")");
      return response.json();
    });
  }

  var FDA_SEARCH_ALIASES = {
    "magnesium l-threonate": "",
    "cdp-choline": "citicoline",
    "cdp-choline (citicoline)": "citicoline",
    "n-acetylcysteine": "acetylcysteine",
    "n-acetylcysteine (nac)": "acetylcysteine",
    "lithium (carbonate / microdose context)": "lithium carbonate"
  };

  function normalizedName(value) {
    return String(value || "").toLowerCase().replace(/\s+/g, " ").trim();
  }

  function labelSearchUrl(name) {
    var raw = normalizedName(name);
    var monograph = findMonographForName(name);
    var monographName = monograph ? normalizedName(monograph.name) : "";
    var term = FDA_SEARCH_ALIASES.hasOwnProperty(raw)
      ? FDA_SEARCH_ALIASES[raw]
      : (monograph && FDA_SEARCH_ALIASES.hasOwnProperty(monographName) ? FDA_SEARCH_ALIASES[monographName] : (monograph ? monograph.name : raw));
    if (!monograph && term) {
      term = term.replace(/\s+\d+(?:\.\d+)?\s*(?:mcg|µg|mg|g|ml|l|iu|units?|unt|meq|mmol)\b.*$/i, "").trim();
    }
    if (!term || term.length < 2) return "";
    var safeTerm = term.replace(/"/g, " ").replace(/\\/g, " ").replace(/\s+/g, " ").trim();
    var expression = 'openfda.generic_name:"' + safeTerm + '" OR openfda.brand_name:"' + safeTerm + '"';
    return "https://api.fda.gov/drug/label.json?search=" + encodeURIComponent(expression) + "&limit=5";
  }

  function labelValue(record, key) {
    var values = record && record[key];
    if (!Array.isArray(values)) values = values ? [values] : [];
    return values.map(function (value) {
      return String(value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    }).filter(Boolean).slice(0, 4);
  }

  function renderLabelField(id, values) {
    var element = document.getElementById(id);
    if (!element) return;
    var text = (values || []).map(function (value) {
      return String(value).length > 2200 ? String(value).slice(0, 2200) + "… [section excerpt]" : String(value);
    });
    element.innerHTML = text.length
      ? text.map(function (value) { return "<p>" + escapeHtml(value) + "</p>"; }).join("")
      : '<p class="label-unavailable">Not listed in the matched FDA record.</p>';
  }

  function loadOpenFdaLabel(name, requestId) {
    var state = document.getElementById("drug-label-state");
    var grid = document.getElementById("drug-label-grid");
    var link = document.getElementById("drug-fda-link");
    var url = labelSearchUrl(name);
    if (grid) grid.hidden = true;
    if (state) state.textContent = url ? "Searching openFDA label records…" : "No U.S. FDA drug-label match is expected for this supplement or substance.";
    if (link) link.hidden = true;
    if (!url) return;
    var controller = typeof window.AbortController === "function" ? new window.AbortController() : null;
    var timeout = controller ? window.setTimeout(function () { controller.abort(); }, 10000) : null;

    fetchJson(url, controller ? controller.signal : null).then(function (payload) {
      if (timeout) window.clearTimeout(timeout);
      if (requestId !== detailRequestId) return;
      var records = payload && Array.isArray(payload.results) ? payload.results : [];
      if (!records.length) throw new Error("No FDA label found");
      var wanted = normalizedName(name);
      records.sort(function (a, b) {
        function score(record) {
          var terms = [].concat(record.openfda && record.openfda.generic_name || [], record.openfda && record.openfda.brand_name || []);
          return terms.some(function (value) { return normalizedName(value).indexOf(wanted) !== -1 || wanted.indexOf(normalizedName(value)) !== -1; }) ? 1 : 0;
        }
        return score(b) - score(a);
      });
      var record = records[0];
      renderLabelField("drug-label-indications", labelValue(record, "indications_and_usage"));
      renderLabelField("drug-label-adverse", labelValue(record, "adverse_reactions"));
      renderLabelField("drug-label-warnings", labelValue(record, "boxed_warning").concat(labelValue(record, "warnings_and_cautions")).concat(labelValue(record, "warnings")));
      renderLabelField("drug-label-contraindications", labelValue(record, "contraindications"));
      renderLabelField("drug-label-interactions", labelValue(record, "drug_interactions"));
      if (!findMonographForName(name)) {
        var overviewParts = ["A matching U.S. FDA label is available for " + name + "."];
        var overviewIndication = labelValue(record, "indications_and_usage")[0];
        var overviewAdverse = labelValue(record, "adverse_reactions")[0];
        if (overviewIndication) overviewParts.push("The label describes use for: " + overviewIndication.slice(0, 620) + (overviewIndication.length > 620 ? "…" : ""));
        if (overviewAdverse) overviewParts.push("Reported adverse reactions include: " + overviewAdverse.slice(0, 480) + (overviewAdverse.length > 480 ? "…" : ""));
        setDrugOverview(overviewParts.join(" "), "Excerpt assembled from a matched openFDA label. It is not a live AI response; verify the exact product label and full prescribing information.");
      }
      if (grid) grid.hidden = false;
      var openfda = record.openfda || {};
      var names = [].concat(openfda.generic_name || [], openfda.brand_name || []).filter(Boolean);
      var labelBrands = [].concat(openfda.brand_name || []).filter(Boolean);
      if (labelBrands.length && currentDrugContext && currentDrugContext.brandSource === "No brand supplied") {
        updateDrugProductBrand(labelBrands[0], currentDrugContext.form, "openFDA label brand example");
      }
      var manufacturers = [].concat(openfda.manufacturer_name || []).filter(Boolean);
      var routes = [].concat(openfda.route || []).filter(Boolean);
      var applications = [].concat(openfda.application_number || []).filter(Boolean);
      var labelTitle = names.slice(0, 2).join(" / ") || name;
      var labelFacts = [];
      if (manufacturers.length) labelFacts.push({ label: "Label manufacturer", value: manufacturers.slice(0, 2).join(" / ") });
      if (routes.length) labelFacts.push({ label: "Label route(s)", value: routes.slice(0, 3).join(" / ") });
      if (applications.length) labelFacts.push({ label: "FDA application", value: applications[0] });
      if (record.effective_time) labelFacts.push({ label: "Label revision", value: record.effective_time });
      if (labelFacts.length) renderDrugFacts(currentDrugFacts.concat(labelFacts));
      var effective = record.effective_time ? " · label updated " + record.effective_time : "";
      if (state) state.textContent = "Matched U.S. FDA label: " + labelTitle + effective + ". Verify the exact product and current prescribing information.";
      if (link) {
        link.href = url;
        link.hidden = false;
      }
    }).catch(function () {
      if (timeout) window.clearTimeout(timeout);
      if (requestId !== detailRequestId) return;
      if (grid) grid.hidden = true;
      if (state) state.textContent = "No matching U.S. FDA label could be loaded. This may be a supplement, a non-U.S. product, or an unavailable record; try the DailyMed search below.";
    });
  }

  function updateCatalogStatus(localCount, loading) {
    var status = document.getElementById("hero-search-status");
    if (!status) return;
    if (!catalogSearch.query) {
      status.textContent = DATA.monographs.length + " curated dossiers · live search ready";
      return;
    }
    if (catalogSearch.query.length < 2) {
      status.textContent = localCount + " curated matches · type 1 more character";
      return;
    }
    if (loading) {
      status.textContent = localCount + " curated · searching live catalogs…";
      return;
    }
    status.textContent =
      localCount + " curated · " + catalogSearch.pubchem.length + " PubChem · " +
      catalogSearch.rxnorm.length + " RxNorm" +
      ((catalogSearch.pubchemError || catalogSearch.rxnormError) ? " · source unavailable" : "");
  }

  function runCatalogSearch(query, requestId) {
    if (requestId !== catalogSearch.requestId) return;
    var controller = typeof window.AbortController === "function" ? new window.AbortController() : null;
    catalogSearch.controller = controller;
    var signal = controller ? controller.signal : null;
    var timeout = controller ? window.setTimeout(function () { controller.abort(); }, 10000) : null;
    var pubchemUrl =
      "https://pubchem.ncbi.nlm.nih.gov/rest/autocomplete/compound/" +
      encodeURIComponent(query) + "/json?limit=20";
    var rxnormUrl =
      "https://rxnav.nlm.nih.gov/REST/drugs.json?name=" + encodeURIComponent(query);

    var pubchemRequest = fetchJson(pubchemUrl, signal).then(function (payload) {
      return { results: pubchemAutocompleteTerms(payload), error: false };
    }).catch(function () {
      return { results: [], error: true };
    });
    var rxnormRequest = fetchJson(rxnormUrl, signal).then(function (payload) {
      return { results: rxNormConcepts(payload), error: false };
    }).catch(function () {
      return { results: [], error: true };
    });

    Promise.all([pubchemRequest, rxnormRequest]).then(function (responses) {
      if (timeout) window.clearTimeout(timeout);
      if (requestId !== catalogSearch.requestId) return;
      catalogSearch.controller = null;
      catalogSearch.pubchem = responses[0].results;
      catalogSearch.rxnorm = responses[1].results;
      catalogSearch.pubchemError = responses[0].error;
      catalogSearch.rxnormError = responses[1].error;
      var localMatches = localMonographMatches(query.toLowerCase());
      renderCatalogResults(localMatches, query, false);
      renderCatalogSuggestions(localMatches, query, false);
      updateCatalogStatus(localMatches.length, false);
    });
  }

  function handleCompoundQuery(query) {
    var cleanQuery = String(query || "").trim();
    catalogSearch.query = cleanQuery;
    catalogSearch.requestId += 1;
    var requestId = catalogSearch.requestId;

    if (catalogSearch.timer) window.clearTimeout(catalogSearch.timer);
    if (catalogSearch.controller) catalogSearch.controller.abort();
    catalogSearch.controller = null;
    catalogSearch.pubchem = [];
    catalogSearch.rxnorm = [];
    catalogSearch.pubchemError = false;
    catalogSearch.rxnormError = false;

    var localMatches = cleanQuery.length >= 2 ? localMonographMatches(cleanQuery.toLowerCase()) : [];
    if (!cleanQuery) {
      renderCatalogResults([], "", false);
      renderCatalogSuggestions([], "", false);
      updateCatalogStatus(0, false);
      return;
    }

    if (cleanQuery.length < 2) {
      renderCatalogResults(localMatches, cleanQuery, false);
      renderCatalogSuggestions(localMatches, cleanQuery, false);
      updateCatalogStatus(localMatches.length, false);
      return;
    }

    renderCatalogResults(localMatches, cleanQuery, true);
    renderCatalogSuggestions(localMatches, cleanQuery, true);
    updateCatalogStatus(localMatches.length, true);
    catalogSearch.timer = window.setTimeout(function () {
      runCatalogSearch(cleanQuery, requestId);
    }, 280);
  }

  var MONOGRAPH_PREFIX_ALIASES = {
    semaglutide: ["ozempic", "wegovy", "rybelsus"],
    escitalopram: ["lexapro", "cipralex"],
    metformin: ["glucophage"],
    "magnesium-threonate": ["magnesium l-threonate", "magtein"],
    "cdp-choline": ["cdp-choline", "citicoline", "cognizin"],
    nac: ["n-acetylcysteine", "acetylcysteine", "fluimucil"],
    bupropion: ["wellbutrin", "zyban"],
    "lithium-lowdose": ["lithium carbonate", "lithobid", "quilonum sr"]
  };

  function findMonographForName(name) {
    var lookup = normalizedName(name);
    return DATA.monographs.find(function (item) {
      var primaryName = normalizedName(item.name);
      if (lookup === primaryName || lookup.indexOf(primaryName + " ") === 0) return true;
      return (MONOGRAPH_PREFIX_ALIASES[item.id] || []).some(function (alias) {
        var normalizedAlias = normalizedName(alias);
        return lookup === normalizedAlias || lookup.indexOf(normalizedAlias + " ") === 0;
      });
    });
  }

  function overviewForName(name) {
    var monograph = findMonographForName(name);
    return monograph && AI_OVERVIEWS[monograph.id] ? AI_OVERVIEWS[monograph.id] :
      "This record identifies a compound or medication term, but the available catalog data is not enough to make a reliable medical overview. Confirm the exact substance and product, and use official labeling and high-quality clinical references for indications, adverse effects, and interactions.";
  }

  function setActiveDrugTab(tabName, renderPanel) {
    var validTabs = ["compound", "studies", "brain", "map", "stack"];
    if (validTabs.indexOf(tabName) === -1) tabName = "compound";
    activeDrugTab = tabName;
    document.querySelectorAll("[data-drug-tab]").forEach(function (tab) {
      var active = tab.getAttribute("data-drug-tab") === tabName;
      tab.setAttribute("aria-selected", active ? "true" : "false");
      tab.tabIndex = active ? 0 : -1;
      tab.classList.toggle("is-active", active);
    });
    document.querySelectorAll("[data-drug-panel]").forEach(function (panel) {
      panel.hidden = panel.getAttribute("data-drug-panel") !== tabName;
    });
    if (renderPanel === false) return;
    if (tabName === "studies") renderDrugStudiesPanel();
    else if (tabName === "brain") renderDrugBrainPanel();
    else if (tabName === "map") renderDrugMechanismMap();
    else if (tabName === "stack") renderDrugStackPanel();
  }

  function initDrugDetailTabs() {
    var tabs = document.getElementById("drug-detail-tabs");
    if (!tabs || drugDetailTabsInitialized) return;
    drugDetailTabsInitialized = true;
    tabs.addEventListener("click", function (event) {
      var button = event.target.closest("[data-drug-tab]");
      if (!button || !tabs.contains(button)) return;
      setActiveDrugTab(button.getAttribute("data-drug-tab"));
    });
    tabs.addEventListener("keydown", function (event) {
      var button = event.target.closest("[data-drug-tab]");
      if (!button) return;
      var keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
      if (keys.indexOf(event.key) === -1) return;
      event.preventDefault();
      var tabButtons = Array.prototype.slice.call(tabs.querySelectorAll("[data-drug-tab]"));
      var index = tabButtons.indexOf(button);
      if (event.key === "Home") index = 0;
      else if (event.key === "End") index = tabButtons.length - 1;
      else if (event.key === "ArrowRight") index = (index + 1) % tabButtons.length;
      else index = (index - 1 + tabButtons.length) % tabButtons.length;
      setActiveDrugTab(tabButtons[index].getAttribute("data-drug-tab"));
      tabButtons[index].focus();
    });

    var copyButton = document.getElementById("copy-drug-link");
    if (copyButton) copyButton.addEventListener("click", function () {
      var url = window.location.href;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(function () {
          showToast("Compound page link copied.");
        }).catch(function () {
          showToast("Copy was blocked by the browser. You can copy the page address from the address bar.");
        });
      } else {
        showToast("Copy is unavailable here. You can copy the page address from the address bar.");
      }
    });
    var printButton = document.getElementById("print-drug-page");
    if (printButton) printButton.addEventListener("click", function () { window.print(); });

    var addCurrentButton = document.getElementById("add-current-to-stack");
    if (addCurrentButton) addCurrentButton.addEventListener("click", function () {
      if (!currentDrugContext) return;
      var existingIndex = findStackCartIndex(currentDrugContext.name);
      if (existingIndex >= 0) removeStackCartItem(existingIndex);
      else addStackCartItem(currentDrugContext.name, currentDrugContext.source);
      renderDrugStackPanel();
    });

    var addForm = document.getElementById("drug-stack-add-form");
    if (addForm) addForm.addEventListener("submit", function (event) {
      event.preventDefault();
      var input = document.getElementById("drug-stack-add-input");
      var name = input ? input.value.trim() : "";
      if (!name) return;
      if (addStackCartItem(name, "Manual cart entry")) {
        if (input) input.value = "";
        renderDrugStackPanel();
      }
    });
    var cartList = document.getElementById("drug-stack-cart-list");
    if (cartList) cartList.addEventListener("click", function (event) {
      var button = event.target.closest("[data-stack-remove]");
      if (!button) return;
      var index = Number(button.getAttribute("data-stack-remove"));
      if (isFinite(index)) removeStackCartItem(index);
      renderDrugStackPanel();
    });
    var clearButton = document.getElementById("clear-drug-stack");
    if (clearButton) clearButton.addEventListener("click", function () {
      stackCart = [];
      saveStackCart();
      syncStackCartToPathwayState();
      renderDrugStackPanel();
    });
    var fullMapLink = document.getElementById("open-pathway-stack");
    if (fullMapLink) fullMapLink.addEventListener("click", syncStackCartToPathwayState);
  }

  function renderRelatedDrugRecords() {
    var container = document.getElementById("drug-related-links");
    if (!container) return;
    var monograph = currentDrugContext && currentDrugContext.monograph;
    if (!monograph || !Array.isArray(monograph.targets)) {
      container.innerHTML = '<p class="drug-related-empty">No shared-target comparison is available for this catalog term.</p>';
      return;
    }
    var genes = {};
    monograph.targets.forEach(function (target) {
      String(target.gene || "").toUpperCase().split(/[^A-Z0-9-]+/).filter(Boolean).forEach(function (gene) {
        if (gene.length > 2) genes[gene] = true;
      });
    });
    var matches = DATA.monographs.filter(function (other) {
      return other.id !== monograph.id && (other.targets || []).some(function (target) {
        return String(target.gene || "").toUpperCase().split(/[^A-Z0-9-]+/).some(function (gene) { return !!genes[gene]; });
      });
    }).map(function (other) {
      var shared = {};
      (other.targets || []).forEach(function (target) {
        String(target.gene || "").toUpperCase().split(/[^A-Z0-9-]+/).forEach(function (gene) { if (genes[gene]) shared[gene] = true; });
      });
      return { record: other, genes: Object.keys(shared) };
    }).sort(function (a, b) { return b.genes.length - a.genes.length; }).slice(0, 4);
    container.innerHTML = matches.length ? matches.map(function (match) {
      return '<a class="drug-related-link" href="#drug/local/' + encodeURIComponent(match.record.id) + '"><strong>' + escapeHtml(match.record.name) + '</strong><span>' + escapeHtml(match.genes.join(" · ")) + '</span></a>';
    }).join("") : '<p class="drug-related-empty">No shared target genes appear in the bundled local records.</p>';
  }

  function drugStudyTerms() {
    if (!currentDrugContext) return [];
    var terms = [currentDrugContext.name];
    var monograph = currentDrugContext.monograph;
    if (monograph) {
      terms.push(monograph.name);
      (MONOGRAPH_PREFIX_ALIASES[monograph.id] || []).forEach(function (alias) { terms.push(alias); });
    }
    var seen = {};
    return terms.map(function (term) { return normalizedName(term); }).filter(function (term) {
      if (!term || term.length < 5 || seen[term]) return false;
      seen[term] = true;
      return true;
    });
  }

  function renderDrugStudiesPanel() {
    var container = document.getElementById("drug-studies-list");
    if (!container || !currentDrugContext) return;
    var query = currentDrugContext.name;
    var link = document.getElementById("drug-studies-pubmed-link");
    if (link) link.href = "https://pubmed.ncbi.nlm.nih.gov/?term=" + encodeURIComponent(query);
    var terms = drugStudyTerms();
    var claims = (DATA.studyClaims || []).filter(function (claim) {
      var compound = normalizedName(claim.compound);
      return terms.some(function (term) { return compound.indexOf(term) !== -1; });
    });
    if (!claims.length) {
      container.innerHTML = '<div class="drug-study-empty"><span class="drug-empty-icon" aria-hidden="true">↗</span><h3>No bundled study claims matched this record</h3><p>The local evidence ledger is intentionally limited. Search PubMed for the selected name and verify study design, population, dose, and outcomes in the original paper.</p><a href="https://pubmed.ncbi.nlm.nih.gov/?term=' + encodeURIComponent(query) + '" target="_blank" rel="noopener noreferrer">Search PubMed for ' + escapeHtml(query) + ' ↗</a></div>';
      return;
    }
    container.innerHTML = claims.map(function (claim) {
      var audit = claim.audit || {};
      return '<article class="drug-study-card">' +
        '<div class="drug-study-card-top"><span class="drug-study-source">' + escapeHtml(claim.sourceTag || claim.domainLabel || "Bundled ledger") + '</span>' + gradeBadgeHtml(claim.grade, claim.domainLabel || "") + '</div>' +
        '<h3>' + escapeHtml(claim.endpoint || "Study outcome") + '</h3>' +
        '<p class="drug-study-design"><strong>' + escapeHtml(claim.compound || query) + '</strong> · ' + escapeHtml(claim.model || claim.domainLabel || "Study details in local ledger") + '</p>' +
        '<div class="drug-study-effect"><span>Reported outcome</span><strong>' + escapeHtml(claim.effect || "Not quantified in the bundled record") + '</strong></div>' +
        '<div class="drug-study-footer"><a href="' + pubmedUrl(claim.pmid) + '" target="_blank" rel="noopener noreferrer">PubMed PMID ' + escapeHtml(claim.pmid) + ' ↗</a><span>Grade ' + escapeHtml(claim.grade) + ' is the app’s evidence category, not a quality guarantee.</span></div>' +
        (audit.design || audit.limitation ? '<details class="drug-study-audit"><summary>Study design &amp; limitations</summary>' +
          (audit.design ? '<p><strong>Design:</strong> ' + escapeHtml(audit.design) + '</p>' : '') +
          (audit.dosingParity ? '<p><strong>Dose/context:</strong> ' + escapeHtml(audit.dosingParity) + '</p>' : '') +
          (audit.limitation ? '<p><strong>Limitation:</strong> ' + escapeHtml(audit.limitation) + '</p>' : '') +
          (audit.rationale ? '<p><strong>Evidence note:</strong> ' + escapeHtml(audit.rationale) + '</p>' : '') +
          '</details>' : '') +
        '</article>';
    }).join("");
  }

  function renderDrugBrainPanel() {
    var regionList = document.getElementById("drug-brain-regions");
    var pins = document.getElementById("drug-brain-pins");
    if (!regionList || !pins || !currentDrugContext) return;
    var monograph = currentDrugContext.monograph;
    var targetGenes = {};
    (monograph && monograph.targets || []).forEach(function (target) {
      String(target.gene || "").toUpperCase().split(/[^A-Z0-9-]+/).filter(Boolean).forEach(function (gene) { if (gene.length > 2) targetGenes[gene] = true; });
    });
    var searchableName = normalizedName(currentDrugContext.name).replace(/\s+\d+(?:\.\d+)?\s*(?:mcg|µg|mg|g|ml|iu|unit|meq|mmol)\b.*$/i, "").trim();
    var compoundTerms = [searchableName];
    if (monograph) compoundTerms.push(monograph.name);
    if (monograph) compoundTerms = compoundTerms.concat(MONOGRAPH_PREFIX_ALIASES[monograph.id] || []);
    compoundTerms = compoundTerms.map(normalizedName).filter(function (term) { return term.length >= 5; });
    var matches = (DATA.brainAtlas.regions || []).map(function (region) {
      var direct = (region.compounds || []).filter(function (compound) {
        var value = normalizedName(compound.name);
        return compoundTerms.some(function (term) { return value === term || value.indexOf(term) !== -1 || term.indexOf(value) !== -1; });
      });
      var transcripts = (region.transcripts || []).filter(function (transcript) {
        return String(transcript.gene || "").toUpperCase().split(/[^A-Z0-9-]+/).some(function (gene) { return !!targetGenes[gene]; });
      });
      if (!direct.length && !transcripts.length) return null;
      var density = transcripts.reduce(function (best, transcript) { return Math.max(best, Number(transcript.density) || 0); }, 0);
      return { region: region, direct: direct, transcripts: transcripts, density: density };
    }).filter(Boolean).sort(function (a, b) {
      if (!!a.direct.length !== !!b.direct.length) return a.direct.length ? -1 : 1;
      return b.density - a.density;
    });
    pins.innerHTML = matches.map(function (match) {
      var region = match.region;
      var value = match.density || (match.direct.length ? 68 : 45);
      var radius = Math.max(6, Math.min(12, Math.round(5 + value / 15)));
      var fill = match.direct.length ? "#E0645C" : "#6F91D0";
      var title = region.name + (match.direct.length ? "; compound listed in bundled atlas" : "; target transcript match");
      return '<g class="drug-brain-pin" aria-label="' + escapeHtml(title) + '"><title>' + escapeHtml(title) + '</title><circle cx="' + region.cx + '" cy="' + region.cy + '" r="' + (radius + 5) + '" fill="' + fill + '" opacity=".16"/><circle cx="' + region.cx + '" cy="' + region.cy + '" r="' + radius + '" fill="' + fill + '" stroke="#F0F2EE" stroke-width="1.4"/><circle cx="' + region.cx + '" cy="' + region.cy + '" r="2" fill="#FFFFFF"/></g>';
    }).join("");
    if (!matches.length) {
      regionList.innerHTML = '<div class="drug-study-empty"><h3>No direct atlas match found</h3><p>The bundled region list has no exact compound or target-transcript match for this monograph. This is a data-coverage limitation, not evidence of no brain activity.</p></div>';
      return;
    }
    regionList.innerHTML = matches.map(function (match) {
      var region = match.region;
      var evidence = "";
      if (match.direct.length) evidence += '<div><span class="brain-match-type direct">Compound record</span><p>' + escapeHtml(match.direct.map(function (item) { return item.metric || "Listed in regional atlas"; }).join(" · ")) + '</p></div>';
      if (match.transcripts.length) evidence += '<div><span class="brain-match-type transcript">Target transcript match</span><p>' + escapeHtml(match.transcripts.map(function (item) { return item.gene + " · density " + item.density + "/100"; }).join(" · ")) + '</p></div>';
      return '<article class="drug-brain-region"><div><h3>' + escapeHtml(region.name) + '</h3><span class="mono-code">' + escapeHtml(region.code || region.shortName || "Atlas region") + '</span></div>' + evidence + '</article>';
    }).join("");
  }

  function drugMechanismRows() {
    var context = currentDrugContext;
    if (!context) return [];
    var monograph = context.monograph;
    if (monograph && Array.isArray(monograph.targets) && monograph.targets.length) {
      return monograph.targets.map(function (target) {
        return {
          target: target.receptor || target.gene || "Target",
          gene: target.gene || "",
          mode: target.mode || "Mechanism not listed",
          metric: [target.metric, target.affinity].filter(Boolean).join(" "),
          grade: target.grade || "E",
          detail: target.mode || "Curated target record",
          pmid: target.pmid || ""
        };
      });
    }
    var model = findStackCompoundForName(context.name);
    if (!model) return [];
    return DATA.stackChecker.compoundEdges.filter(function (edge) { return edge.from === model.id; }).map(function (edge) {
      var target = DATA.stackChecker.targets.find(function (item) { return item.id === edge.to; });
      return {
        target: target ? target.name : edge.to,
        gene: target ? target.sub : "",
        mode: edge.type || "Pathway link",
        metric: edge.potency || "",
        grade: edge.grade || "E",
        detail: edge.mechanism || "Bundled pathway link",
        pmid: edge.pmid || ""
      };
    });
  }

  function renderDrugMechanismMap() {
    var container = document.getElementById("drug-mechanism-map");
    if (!container || !currentDrugContext) return;
    var rows = drugMechanismRows();
    if (!rows.length) {
      container.innerHTML = '<div class="drug-study-empty"><h3>No curated target map for this catalog term</h3><p>Pharmawiki does not infer a mechanism from a chemical drawing or name. Check the linked source catalog or search for a more specific medication term.</p></div>';
      return;
    }
    var width = 980;
    var rowHeight = 106;
    var height = Math.max(370, rows.length * rowHeight + 48);
    var sourceY = Math.round(height / 2 - 42);
    var sourceName = currentDrugContext.name.length > 24 ? currentDrugContext.name.slice(0, 21) + "…" : currentDrugContext.name;
    var parts = ['<svg class="drug-mechanism-svg" viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="Curated target and mechanism map for ' + escapeHtml(currentDrugContext.name) + '"><title>Bundled target map for ' + escapeHtml(currentDrugContext.name) + '</title><desc>Lines connect this compound record to reported molecular targets and mechanism notes. They do not establish clinical outcomes.</desc>'];
    parts.push('<text x="45" y="26" class="map-col-label">COMPOUND RECORD</text><text x="337" y="26" class="map-col-label">TARGET</text><text x="691" y="26" class="map-col-label">MECHANISM / EVIDENCE</text>');
    rows.forEach(function (row, index) {
      var y = 48 + index * rowHeight;
      var cy = y + 37;
      var color = row.grade === "A" ? "#6F91D0" : row.grade === "B" ? "#70A98B" : row.grade === "C" ? "#D2AA65" : "#87909A";
      parts.push('<path d="M 242 ' + (sourceY + 42) + ' C 278 ' + (sourceY + 42) + ' 288 ' + cy + ' 324 ' + cy + '" fill="none" stroke="' + color + '" stroke-width="2" stroke-opacity=".7"/>');
      parts.push('<path d="M 590 ' + cy + ' C 626 ' + cy + ' 648 ' + cy + ' 680 ' + cy + '" fill="none" stroke="' + color + '" stroke-width="2" stroke-opacity=".7"/>');
      parts.push('<rect x="324" y="' + y + '" width="266" height="74" rx="10" class="map-target-node" stroke="' + color + '"/>');
      parts.push('<text x="341" y="' + (y + 23) + '" class="map-target-title">' + escapeHtml(row.target.length > 34 ? row.target.slice(0, 31) + "…" : row.target) + '</text>');
      parts.push('<text x="341" y="' + (y + 43) + '" class="map-target-gene">' + escapeHtml(row.gene || "Molecular target") + '</text>');
      parts.push('<text x="341" y="' + (y + 62) + '" class="map-grade">GRADE ' + escapeHtml(row.grade) + '</text>');
      parts.push('<rect x="680" y="' + y + '" width="264" height="74" rx="10" class="map-effect-node"/>');
      parts.push('<text x="697" y="' + (y + 23) + '" class="map-target-title">' + escapeHtml(row.mode.length > 33 ? row.mode.slice(0, 30) + "…" : row.mode) + '</text>');
      parts.push('<text x="697" y="' + (y + 43) + '" class="map-target-gene">' + escapeHtml(row.metric.length > 34 ? row.metric.slice(0, 31) + "…" : row.metric) + '</text>');
      if (row.pmid) parts.push('<a href="' + pubmedUrl(row.pmid) + '" target="_blank" rel="noopener noreferrer"><text x="697" y="' + (y + 62) + '" class="map-grade map-link">PUBMED ' + escapeHtml(row.pmid) + ' ↗</text></a>');
      else parts.push('<text x="697" y="' + (y + 62) + '" class="map-grade">SOURCE IN CURATED PROFILE</text>');
    });
    parts.push('<rect x="38" y="' + sourceY + '" width="204" height="84" rx="12" class="map-compound-node"/><text x="56" y="' + (sourceY + 32) + '" class="map-source-title">' + escapeHtml(sourceName) + '</text><text x="56" y="' + (sourceY + 55) + '" class="map-source-sub">PHARMAWIKI REFERENCE</text></svg>');
    container.innerHTML = parts.join("");
  }

  function showPubChemLoading(item) {
    var name = item.name || "PubChem compound";
    var token = resetDrugPage(name, "PubChem chemical record", "Chemical identity and reference data from PubChem.");
    if (currentDrugContext) currentDrugContext.record = item;
    setText("drug-page-record-source", "PubChem PUG REST · live record");
    setText("dossier-source-label", "PubChem record");
    setSourceLink("drug-pubchem-link", "https://pubchem.ncbi.nlm.nih.gov/#query=" + encodeURIComponent(name), true);
    setSourceLink("drug-rxnorm-link", "https://rxnav.nlm.nih.gov/REST/drugs.json?name=" + encodeURIComponent(name), true);
    setSourceLink("drug-dailymed-link", dailyMedSearchUrl(name), true);
    setDrugOverview(overviewForName(name), "This is a fixed, source-grounded summary where a local match exists; it is not generated by a live AI service.");
    loadOpenFdaLabel(name, token);
    return token;
  }

  function showPubChemError(item, requestId) {
    if (requestId !== detailRequestId) return;
    var bodyEl = document.getElementById("dossier-body");
    setText("drug-page-record-source", "PubChem chemical record");
    if (bodyEl) {
      bodyEl.innerHTML = '<div class="empty-detail-state"><h2>Could not load this record</h2><p>PubChem did not return chemical properties for “' +
        escapeHtml(item.name) +
        '”. Try another synonym or open the source catalog directly.</p><p><a href="https://pubchem.ncbi.nlm.nih.gov/#query=' +
        encodeURIComponent(item.name) + '" target="_blank" rel="noopener noreferrer">Search PubChem ↗</a></p></div>';
    }
  }

  function renderPubChemDetail(item, property, synonyms, requestId) {
    if (requestId !== detailRequestId) return;
    var bodyEl = document.getElementById("dossier-body");
    if (!bodyEl) return;
    var cid = property.CID == null ? "" : String(property.CID);
    var name = item.name || property.IUPACName || "PubChem compound";
    setText("drug-page-title", name);
    setText("drug-page-subtitle", "Chemical identity and selected computed properties from PubChem.");
    setText("drug-page-type", "Chemical compound · PubChem");
    setText("drug-page-record-source", "PubChem PUG REST · live record");
    setText("dossier-source-label", "PubChem compound");
    setDrugIdentifiers(cid ? '<a href="' + pubchemUrl(cid) + '" target="_blank" rel="noopener noreferrer">PubChem CID ' + escapeHtml(cid) + ' ↗</a>' : "");
    setSourceLink("drug-pubchem-link", cid ? pubchemUrl(cid) : "https://pubchem.ncbi.nlm.nih.gov/#query=" + encodeURIComponent(name), true);

    function field(label, value, suffix) {
      return '<div class="pk-cell"><span class="pk-label">' + escapeHtml(label) +
        '</span><span class="pk-val">' + escapeHtml(value == null || value === "" ? "Not listed" : String(value) + (suffix || "")) + "</span></div>";
    }
    var synonymValues = [];
    if (synonyms && synonyms.InformationList && Array.isArray(synonyms.InformationList.Information)) {
      var record = synonyms.InformationList.Information[0];
      if (record && Array.isArray(record.Synonym)) synonymValues = record.Synonym.slice(0, 8);
    }
    var synonymsHtml = synonymValues.length
      ? '<div class="dossier-subhead"><span>Other indexed names</span><span>PubChem</span></div><ul class="external-synonym-list">' +
        synonymValues.map(function (synonym) { return "<li>" + escapeHtml(synonym) + "</li>"; }).join("") + "</ul>"
      : "";
    var iupacHtml = property.IUPACName
      ? '<div class="external-property-block"><span class="pk-label">IUPAC name</span><p>' + escapeHtml(property.IUPACName) + "</p></div>"
      : "";
    renderDrugFacts([
      { label: "PubChem CID", value: cid || "Not listed" },
      { label: "Molecular formula", value: property.MolecularFormula || "Not listed" },
      { label: "Molecular weight", value: property.MolecularWeight ? property.MolecularWeight + " g/mol" : "Not listed" },
      { label: "XLogP", value: property.XLogP == null ? "Not listed" : property.XLogP },
      { label: "Topological polar surface area", value: property.TPSA == null ? "Not listed" : property.TPSA + " Å²" },
      { label: "Hydrogen-bond donors / acceptors", value: String(property.HBondDonorCount == null ? "?" : property.HBondDonorCount) + " / " + String(property.HBondAcceptorCount == null ? "?" : property.HBondAcceptorCount) }
    ]);
    bodyEl.innerHTML =
      '<div class="dossier-title-row"><div><h2 class="dossier-compound-name">' + escapeHtml(name) +
      '</h2><p class="dossier-class">Chemical identity from PubChem</p></div><div class="dossier-chem-meta">' +
      (cid ? "CID " + escapeHtml(cid) : "") + "</div></div>" +
      '<div class="pk-mini-grid">' +
      field("Molecular formula", property.MolecularFormula) +
      field("Molecular weight", property.MolecularWeight, " g/mol") +
      field("XLogP", property.XLogP) +
      field("Topological polar surface area", property.TPSA, " Å²") +
      field("H-bond donors", property.HBondDonorCount) +
      field("H-bond acceptors", property.HBondAcceptorCount) +
      '</div>' + iupacHtml + synonymsHtml +
      '<div class="dossier-note">PubChem chemical properties identify the substance; they do not establish clinical efficacy, dosing, or safety. Check primary clinical sources before applying any medical information.</div>';
  }

  function loadPubChemDetail(item) {
    var requestId = showPubChemLoading(item);
    var propertyUrl =
      "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/" +
      encodeURIComponent(item.name) +
      "/property/MolecularFormula,MolecularWeight,IUPACName,XLogP,TPSA,HBondDonorCount,HBondAcceptorCount/JSON";

    fetchJson(propertyUrl).then(function (payload) {
      var list = payload && payload.PropertyTable && payload.PropertyTable.Properties;
      if (!Array.isArray(list) || !list.length) throw new Error("No PubChem property record");
      var property = list[0];
      var synonymsUrl = property.CID
        ? "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/" + encodeURIComponent(property.CID) + "/synonyms/JSON"
        : "";
      var synonymRequest = synonymsUrl ? fetchJson(synonymsUrl).catch(function () { return null; }) : Promise.resolve(null);
      return synonymRequest.then(function (synonyms) {
        renderPubChemDetail(item, property, synonyms, requestId);
      });
    }).catch(function () {
      showPubChemError(item, requestId);
    });
  }

  function loadPubChemFacts(name, requestId) {
    var fields = "MolecularFormula,MolecularWeight,IUPACName,XLogP,TPSA,HBondDonorCount,HBondAcceptorCount";
    var url = "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/" + encodeURIComponent(name) + "/property/" + fields + "/JSON";
    fetchJson(url).then(function (payload) {
      if (requestId !== detailRequestId) return;
      var property = payload && payload.PropertyTable && payload.PropertyTable.Properties && payload.PropertyTable.Properties[0];
      if (!property || !property.CID) return;
      setSourceLink("drug-pubchem-link", pubchemUrl(property.CID), true);
      renderDrugFacts(currentDrugFacts.concat([
        { label: "PubChem CID", value: property.CID },
        { label: "Molecular formula", value: property.MolecularFormula || "Not listed" },
        { label: "Molecular weight", value: property.MolecularWeight ? property.MolecularWeight + " g/mol" : "Not listed" },
        { label: "XLogP", value: property.XLogP == null ? "Not listed" : property.XLogP },
        { label: "Topological polar surface area", value: property.TPSA == null ? "Not listed" : property.TPSA + " Å²" }
      ]));
    }).catch(function () { /* RxNorm records remain usable when PubChem properties are unavailable. */ });
  }

  function renderRxNormDetail(item) {
    var name = item.name || "RxNorm medication term";
    var token = resetDrugPage(name, "RxNorm medication record", rxNormTypeLabel(item.tty));
    setText("drug-page-record-source", "RxNorm · live medication vocabulary");
    setText("dossier-source-label", "RxNorm medication term");
    setDrugIdentifiers('<a href="https://rxnav.nlm.nih.gov/REST/rxcui/' + encodeURIComponent(item.rxcui) + '/allProperties.json?prop=all" target="_blank" rel="noopener noreferrer">RxCUI ' + escapeHtml(item.rxcui) + ' ↗</a>');
    setSourceLink("drug-pubchem-link", "https://pubchem.ncbi.nlm.nih.gov/#query=" + encodeURIComponent(name), true);
    setSourceLink("drug-rxnorm-link", "https://rxnav.nlm.nih.gov/REST/rxcui/" + encodeURIComponent(item.rxcui) + "/allProperties.json?prop=all", true);
    setSourceLink("drug-dailymed-link", dailyMedSearchUrl(name), true);
    setDrugOverview(overviewForName(name), "RxNorm is a normalized drug vocabulary, not a complete product history or medical assessment. This overview is not generated by a live AI service.");
    renderDrugFacts([
      { label: "RxCUI", value: item.rxcui || "Not listed" },
      { label: "Term type", value: rxNormTypeLabel(item.tty) },
      { label: "Synonym", value: item.synonym || "Not listed" }
    ]);
    var bodyEl = document.getElementById("dossier-body");
    if (bodyEl) {
      bodyEl.innerHTML =
        '<div class="dossier-title-row"><div><h2 class="dossier-compound-name">' + escapeHtml(name) +
        '</h2><p class="dossier-class">Normalized medication term from RxNorm</p></div></div>' +
        '<div class="pk-mini-grid">' +
        '<div class="pk-cell"><span class="pk-label">RxCUI</span><span class="pk-val">' + escapeHtml(item.rxcui || "Not listed") +
        '</span></div><div class="pk-cell"><span class="pk-label">Term type</span><span class="pk-val">' + escapeHtml(rxNormTypeLabel(item.tty)) +
        '</span></div></div>' +
        (item.synonym ? '<div class="external-property-block"><span class="pk-label">Synonym</span><p>' + escapeHtml(item.synonym) + "</p></div>" : "") +
        '<div class="dossier-note">RxNorm normalizes medication names and clinical drug terms, primarily for the U.S. drug vocabulary. It is not a complete historical or worldwide drug list, and this entry alone is not a clinical safety or treatment recommendation.</div>' +
        '<p class="external-record-link"><a href="https://rxnav.nlm.nih.gov/REST/rxcui/' + encodeURIComponent(item.rxcui) + '/allProperties.json?prop=all" target="_blank" rel="noopener noreferrer">View RxNorm API record ↗</a> · ' +
        '<a href="https://pubchem.ncbi.nlm.nih.gov/#query=' + encodeURIComponent(name) + '" target="_blank" rel="noopener noreferrer">Search chemical identity on PubChem ↗</a></p>';
    }
    currentDrugContext.record = item;
    if (["BN", "SBD", "BPCK"].indexOf(item.tty) !== -1) {
      updateDrugProductBrand(extractRxNormBrand(name), extractRxNormForm(name), "RxNorm branded term");
    }
    loadOpenFdaLabel(name, token);
    loadPubChemFacts(name, token);
  }

  function focusDrugHeading() {
    var heading = document.getElementById("drug-page-title");
    if (!heading) return;
    try { heading.focus({ preventScroll: true }); } catch (e) { heading.focus(); }
  }

  function setPage(pageName) {
    document.querySelectorAll("[data-page]").forEach(function (page) {
      page.hidden = page.getAttribute("data-page") !== pageName;
    });
    var navPage = pageName === "drug" ? "search" : pageName;
    document.querySelectorAll("[data-nav-page]").forEach(function (link) {
      var active = link.getAttribute("data-nav-page") === navPage;
      link.classList.toggle("is-active", active);
      if (active) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }

  function decodeRoutePart(value) {
    try { return decodeURIComponent(value || ""); } catch (e) { return value || ""; }
  }

  function routeFromHash() {
    var route = window.location.hash.slice(1).replace(/^\//, "");
    var parts = route.split("/");
    if (parts[0] === "drug") {
      setPage("drug");
      var source = decodeRoutePart(parts[1]);
      if (source === "local") {
        var localId = decodeRoutePart(parts[2]);
        if (DATA.monographs.some(function (item) { return item.id === localId; })) {
          renderDossier(localId);
          focusDrugHeading();
        } else setPage("search");
      } else if (source === "pubchem" && decodeRoutePart(parts[2])) {
        loadPubChemDetail({ name: decodeRoutePart(parts[2]) });
        focusDrugHeading();
      } else if (source === "rxnorm" && decodeRoutePart(parts[2]) && decodeRoutePart(parts[3])) {
        renderRxNormDetail({
          rxcui: decodeRoutePart(parts[2]),
          name: decodeRoutePart(parts[3]),
          tty: decodeRoutePart(parts[4]),
          synonym: ""
        });
        focusDrugHeading();
      } else {
        setPage("search");
      }
      return;
    }
    var pageName = ROUTE_TO_PAGE[route] || "search";
    if (pageName === "pathways" && stackCart.length) syncStackCartToPathwayState();
    setPage(pageName);
  }

  function initPageRouter() {
    window.addEventListener("hashchange", routeFromHash);
    routeFromHash();
  }

  function makeDrugRoute(source, item) {
    if (source === "local") return "#drug/local/" + encodeURIComponent(item.id);
    if (source === "pubchem") return "#drug/pubchem/" + encodeURIComponent(item.name);
    return "#drug/rxnorm/" + encodeURIComponent(item.rxcui) + "/" +
      encodeURIComponent(item.name) + "/" + encodeURIComponent(item.tty || "");
  }

  function initCompoundSearch() {
    var input = document.getElementById("hero-compound-input");
    var clearButton = document.getElementById("clear-compound-search");
    var results = document.getElementById("catalog-results");
    var suggestions = document.getElementById("catalog-suggestions");
    var autocomplete = document.getElementById("catalog-autocomplete");
    var chips = document.getElementById("hero-compound-chips");
    if (!input || !results || !suggestions) return;

    renderHeroChips();
    renderCatalogResults([], "", false);
    renderCatalogSuggestions([], "", false);
    updateCatalogStatus(0, false);

    input.addEventListener("input", function () {
      handleCompoundQuery(input.value);
    });

    input.addEventListener("focus", function () {
      if (!input.value.trim()) return;
      renderCatalogSuggestions(localMonographMatches(input.value.trim().toLowerCase()), input.value, false);
    });

    input.addEventListener("keydown", function (event) {
      var optionButtons = Array.prototype.slice.call(document.querySelectorAll("#catalog-suggestion-options .catalog-suggestion"));
      if (event.key === "ArrowDown" && !suggestions.hidden && optionButtons.length) {
        event.preventDefault();
        setActiveCatalogSuggestion(activeSuggestionIndex < 0 ? 0 : Math.min(activeSuggestionIndex + 1, optionButtons.length - 1));
      } else if (event.key === "ArrowUp" && !suggestions.hidden && optionButtons.length) {
        event.preventDefault();
        setActiveCatalogSuggestion(activeSuggestionIndex < 0 ? optionButtons.length - 1 : Math.max(activeSuggestionIndex - 1, 0));
      } else if (event.key === "Enter" && !suggestions.hidden && activeSuggestionIndex >= 0 && optionButtons[activeSuggestionIndex]) {
        event.preventDefault();
        openCatalogResult(optionButtons[activeSuggestionIndex]);
      } else if (event.key === "Escape") {
        closeCatalogSuggestions();
      }
    });

    if (clearButton) {
      clearButton.addEventListener("click", function () {
        input.value = "";
        handleCompoundQuery("");
        input.focus();
      });
    }

    if (chips) {
      chips.addEventListener("click", function (event) {
        var button = event.target.closest("[data-quick-id]");
        if (!button) return;
        var id = button.getAttribute("data-quick-id");
        var monograph = DATA.monographs.find(function (item) { return item.id === id; });
        if (!monograph) return;
        input.value = monograph.name;
        handleCompoundQuery(monograph.name);
        window.location.hash = makeDrugRoute("local", monograph);
      });
    }

    function handleCatalogOptionClick(event) {
      var button = event.target.closest("[data-result-source]");
      if (button) openCatalogResult(button);
    }

    results.addEventListener("click", handleCatalogOptionClick);
    suggestions.addEventListener("click", handleCatalogOptionClick);
    if (autocomplete) {
      document.addEventListener("click", function (event) {
        if (!autocomplete.contains(event.target)) closeCatalogSuggestions();
      });
    }
  }

  /* ------------------------------------------------------------------------
     2. Study Library & Quantified Evidence Ledger
     ------------------------------------------------------------------------ */
  var ledgerState = {
    domain: "all",
    grade: "all",
    query: "",
    expandedIds: { "sc-01": true, "sc-11": true }
  };

  function renderStudyLedger() {
    var tbody = document.getElementById("study-ledger-tbody");
    if (!tbody) return;

    var q = ledgerState.query.trim().toLowerCase();
    var rows = DATA.studyClaims.filter(function (item) {
      if (ledgerState.domain !== "all" && item.domain !== ledgerState.domain) return false;
      if (ledgerState.grade !== "all" && item.grade !== ledgerState.grade) return false;
      if (q) {
        var hay = (
          item.compound +
          " " +
          item.endpoint +
          " " +
          item.grade +
          " " +
          item.model +
          " " +
          item.effect +
          " " +
          item.pmid +
          " " +
          item.sourceTag
        ).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });

    if (rows.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="6" style="text-align:center; padding: 28px; color: var(--text-muted);">No graded study records match the active filter criteria. Reset domain or tier filters above.</td></tr>';
      return;
    }

    tbody.innerHTML = rows
      .map(function (r) {
        var expanded = !!ledgerState.expandedIds[r.id];
        var mainRow =
          '<tr class="claim-row' +
          (expanded ? " is-expanded" : "") +
          '" data-claim-id="' +
          escapeHtml(r.id) +
          '" tabindex="0" role="button" aria-expanded="' +
          (expanded ? "true" : "false") +
          '">' +
          '<td><span class="compound-cell-title">' +
          escapeHtml(r.compound) +
          '</span><span class="compound-cell-domain">' +
          escapeHtml(r.domainLabel) +
          '<span class="row-expand-hint">' +
          (expanded ? "[Hide audit ▲]" : "[Inspect audit ▾]") +
          "</span></span></td>" +
          "<td>" +
          escapeHtml(r.endpoint) +
          "</td>" +
          "<td>" +
          gradeBadgeHtml(r.grade) +
          "</td>" +
          '<td style="color: var(--text-secondary);">' +
          escapeHtml(r.model) +
          "</td>" +
          '<td><span class="effect-badge effect-' +
          escapeHtml(r.direction) +
          '">' +
          escapeHtml(r.effect) +
          "</span></td>" +
          '<td class="mono-code" style="white-space: nowrap;">' +
          '<a href="' +
          pubmedUrl(r.pmid) +
          '" target="_blank" rel="noopener noreferrer" class="pmid-stop-prop">PMID: ' +
          escapeHtml(r.pmid) +
          " ↗</a>" +
          '<div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 2px;">' +
          escapeHtml(r.sourceTag) +
          "</div></td>" +
          "</tr>";

        var drawerRow = expanded
          ? '<tr class="audit-drawer-row"><td colspan="6">' +
            '<div class="audit-drawer-grid">' +
            '<div><span class="audit-col-label">Study Design</span><p class="audit-col-text">' +
            escapeHtml(r.audit.design) +
            "</p></div>" +
            '<div><span class="audit-col-label">Dosing &amp; Exposure Parity</span><p class="audit-col-text">' +
            escapeHtml(r.audit.dosingParity) +
            "</p></div>" +
            '<div><span class="audit-col-label">Confounders &amp; Limitations</span><p class="audit-col-text">' +
            escapeHtml(r.audit.limitation) +
            "</p></div>" +
            '<div><span class="audit-col-label">Grade Rationale</span><p class="audit-col-text">' +
            escapeHtml(r.audit.rationale) +
            "</p></div>" +
            "</div></td></tr>"
          : "";

        return mainRow + drawerRow;
      })
      .join("");

    tbody.querySelectorAll(".pmid-stop-prop").forEach(function (a) {
      a.addEventListener("click", function (ev) {
        ev.stopPropagation();
      });
    });

    tbody.querySelectorAll("tr.claim-row").forEach(function (tr) {
      function toggleRow() {
        var id = tr.getAttribute("data-claim-id");
        ledgerState.expandedIds[id] = !ledgerState.expandedIds[id];
        renderStudyLedger();
      }
      tr.addEventListener("click", toggleRow);
      tr.addEventListener("keydown", function (ev) {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          toggleRow();
        }
      });
    });
  }

  function initStudyLedger() {
    renderStudyLedger();

    var domainGroup = document.getElementById("domain-filters");
    if (domainGroup) {
      domainGroup.querySelectorAll(".filter-btn").forEach(function (btn) {
        btn.addEventListener("click", function () {
          domainGroup.querySelectorAll(".filter-btn").forEach(function (b) {
            b.classList.remove("is-active");
          });
          btn.classList.add("is-active");
          ledgerState.domain = btn.getAttribute("data-domain");
          renderStudyLedger();
        });
      });
    }

    var gradeGroup = document.getElementById("grade-filters");
    if (gradeGroup) {
      gradeGroup.querySelectorAll(".filter-btn").forEach(function (btn) {
        btn.addEventListener("click", function () {
          gradeGroup.querySelectorAll(".filter-btn").forEach(function (b) {
            b.classList.remove("is-active");
          });
          btn.classList.add("is-active");
          ledgerState.grade = btn.getAttribute("data-grade");
          renderStudyLedger();
        });
      });
    }

    var searchInput = document.getElementById("ledger-filter-input");
    if (searchInput) {
      searchInput.addEventListener("input", function () {
        ledgerState.query = searchInput.value;
        renderStudyLedger();
      });
    }
  }

  /* ------------------------------------------------------------------------
     3. Interactive Stack Checker & Pathway Visualization Lab
     ------------------------------------------------------------------------ */
  var STACK_CART_STORAGE_KEY = "pharmawiki_reference_stack_v1";
  var STACK_NAME_ALIASES = {
    escitalopram: ["lexapro", "cipralex"],
    tramadol: ["tramadol hcl"],
    "st-johns-wort": ["st johns wort", "st john's wort", "hypericum perforatum"],
    bupropion: ["wellbutrin", "wellbutrin xl", "zyban"],
    "magnesium-glycinate": ["magnesium glycinate", "mg glycinate"],
    "cdp-choline": ["citicoline", "cognizin", "cdp choline"],
    caffeine: ["caffeine"],
    "l-theanine": ["theanine", "l theanine"],
    rosuvastatin: ["crestor"],
    berberine: ["berberine hcl", "berberine"],
    metformin: ["metformin", "metformin xr", "glucophage"],
    coq10: ["ubiquinol", "coq10", "co q10"]
  };

  function stackSearchKey(value) {
    return normalizedName(value).replace(/[^a-z0-9]+/g, " ").trim();
  }

  function findStackCompoundForName(name) {
    var key = stackSearchKey(name);
    if (!key) return null;
    return DATA.stackChecker.compounds.find(function (compound) {
      var candidates = [compound.name, compound.id.replace(/-/g, " ")].concat(STACK_NAME_ALIASES[compound.id] || []).map(stackSearchKey);
      return candidates.some(function (candidate) {
        return key === candidate || key.indexOf(candidate + " ") === 0 || candidate.indexOf(key + " ") === 0;
      });
    }) || null;
  }

  function loadStackCart() {
    try {
      var parsed = JSON.parse(window.localStorage.getItem(STACK_CART_STORAGE_KEY) || "[]");
      if (!Array.isArray(parsed)) return [];
      var seen = {};
      return parsed.filter(function (entry) {
        return entry && typeof entry.name === "string" && entry.name.trim().length > 0;
      }).slice(0, 30).map(function (entry) {
        var name = entry.name.trim().slice(0, 100);
        var key = stackSearchKey(name);
        if (!key || seen[key]) return null;
        seen[key] = true;
        var model = findStackCompoundForName(name);
        return { name: name, modelId: model ? model.id : null, source: String(entry.source || "Saved cart entry").slice(0, 80) };
      }).filter(Boolean);
    } catch (error) {
      return [];
    }
  }

  var stackCart = loadStackCart();

  function saveStackCart() {
    try {
      window.localStorage.setItem(STACK_CART_STORAGE_KEY, JSON.stringify(stackCart));
    } catch (error) {
      // The cart remains usable for this page view if storage is blocked or full.
    }
  }

  function findStackCartIndex(name) {
    var key = stackSearchKey(name);
    return stackCart.findIndex(function (item) { return stackSearchKey(item.name) === key; });
  }

  function syncStackCartToPathwayState() {
    stackState.activeCompounds = stackCart.map(function (item) { return item.modelId; }).filter(function (id, index, ids) {
      return id && ids.indexOf(id) === index;
    });
    stackState.presetId = "custom";
    stackState.focusedEdgeId = null;
    stackState.focusedNodeId = null;
    updateAllStackViews();
  }

  function addStackCartItem(name, source) {
    var clean = String(name || "").trim().replace(/\s+/g, " ").slice(0, 100);
    if (!clean) return false;
    if (findStackCartIndex(clean) >= 0) {
      showToast(clean + " is already in your stack.");
      return false;
    }
    if (stackCart.length >= 30) {
      showToast("The local cart is limited to 30 entries.");
      return false;
    }
    var model = findStackCompoundForName(clean);
    stackCart.push({ name: clean, modelId: model ? model.id : null, source: source || "Manual cart entry" });
    saveStackCart();
    syncStackCartToPathwayState();
    return true;
  }

  function removeStackCartItem(index) {
    if (index < 0 || index >= stackCart.length) return;
    stackCart.splice(index, 1);
    saveStackCart();
    syncStackCartToPathwayState();
  }

  var stackState = {
    presetId: DATA.stackChecker.presets[0].id,
    activeCompounds: DATA.stackChecker.presets[0].activeCompounds.slice(),
    focusedEdgeId: null,
    focusedNodeId: null
  };

  function renderDrugStackPanel() {
    var list = document.getElementById("drug-stack-cart-list");
    var count = document.getElementById("drug-stack-cart-count");
    var addCurrent = document.getElementById("add-current-to-stack");
    var unassessed = document.getElementById("drug-stack-unassessed");
    var segments = document.getElementById("drug-stack-meter-segments");
    var scoreEl = document.getElementById("drug-stack-score");
    var meter = document.getElementById("drug-stack-meter");
    var caption = document.getElementById("drug-stack-meter-caption");
    var feedback = document.getElementById("drug-stack-feedback");
    if (!list || !currentDrugContext) return;

    var currentIndex = findStackCartIndex(currentDrugContext.name);
    if (addCurrent) {
      addCurrent.textContent = currentIndex >= 0 ? "✓ In stack · remove" : "＋ Add this record";
      addCurrent.setAttribute("aria-pressed", currentIndex >= 0 ? "true" : "false");
      addCurrent.classList.toggle("is-selected", currentIndex >= 0);
    }
    if (count) count.textContent = stackCart.length + (stackCart.length === 1 ? " item" : " items");
    list.innerHTML = stackCart.length ? stackCart.map(function (item, index) {
      var model = item.modelId && DATA.stackChecker.compounds.find(function (compound) { return compound.id === item.modelId; });
      var status = model ? "In pathway index · " + model.name : "Not assessed by bundled pathway index";
      return '<li class="drug-stack-cart-item"><span class="drug-stack-cart-copy"><strong>' + escapeHtml(item.name) + '</strong><small>' + escapeHtml(status) + '</small></span><button type="button" class="drug-stack-remove" data-stack-remove="' + index + '" aria-label="Remove ' + escapeHtml(item.name) + ' from stack">×</button></li>';
    }).join("") : '<li class="drug-stack-cart-empty">Your stack is empty. Add this record or enter another medicine or supplement.</li>';

    var unassessedItems = stackCart.filter(function (item) {
      return !item.modelId || !DATA.stackChecker.compounds.some(function (compound) { return compound.id === item.modelId; });
    });
    if (unassessed) {
      unassessed.hidden = unassessedItems.length === 0;
      unassessed.innerHTML = unassessedItems.length
        ? '<strong>Not assessed:</strong> ' + escapeHtml(unassessedItems.map(function (item) { return item.name; }).join(", ")) + '. These entries are saved in the browser cart but are excluded from the pathway signal. No interaction conclusion is available for them.'
        : "";
    }

    var modelIds = stackCart.map(function (item) { return item.modelId; }).filter(function (id, index, ids) {
      return id && DATA.stackChecker.compounds.some(function (compound) { return compound.id === id; }) && ids.indexOf(id) === index;
    });
    if (segments) {
      var segmentHtml = "";
      for (var level = 10; level >= 1; level--) segmentHtml += '<span class="drug-stack-meter-segment" data-level="' + level + '"></span>';
      segments.innerHTML = segmentHtml;
    }
    if (!meter || !scoreEl || !caption || !feedback) return;

    meter.classList.remove("level-low", "level-moderate", "level-high", "is-unscored");
    meter.setAttribute("role", "img");
    meter.setAttribute("aria-label", "Reference interaction signal not scored");
    meter.removeAttribute("aria-valuemin");
    meter.removeAttribute("aria-valuemax");
    meter.removeAttribute("aria-valuenow");
    meter.removeAttribute("aria-valuetext");
    var score = null;
    var result = null;
    var subgraph = null;
    if (modelIds.length >= 2) {
      subgraph = computeActiveSubgraph(modelIds);
      result = evaluateStackRisk(subgraph, modelIds);
      var maxAxis = 0;
      Object.keys(result.axisScores).forEach(function (axis) { maxAxis = Math.max(maxAxis, result.axisScores[axis]); });
      var severityFloor = result.matchedRules.reduce(function (floor, rule) {
        var values = { critical: 9, elevated: 8, moderate: 6, favorable: 1 };
        return Math.max(floor, values[rule.severity] || 1);
      }, 1);
      // Use the strongest of the pathway index and any rule severity, not an average.
      score = Math.max(Math.ceil(maxAxis / 10), severityFloor);
      score = Math.max(1, Math.min(10, score));
      meter.setAttribute("role", "meter");
      meter.setAttribute("aria-valuemin", "1");
      meter.setAttribute("aria-valuemax", "10");
      meter.setAttribute("aria-valuenow", String(score));
      meter.removeAttribute("aria-label");
      meter.setAttribute("aria-valuetext", "Reference interaction signal " + score + " out of 10; not a clinical safety score");
      meter.classList.add(score >= 8 ? "level-high" : score >= 5 ? "level-moderate" : "level-low");
      scoreEl.textContent = String(score);
      caption.textContent = "Reference index signal " + score + "/10. The strongest bundled 0–100 pathway-axis score is scaled to 1–10; any critical/elevated rule sets a minimum of 9/8. This is not a validated or individualized risk estimate.";
    } else {
      meter.classList.add("is-unscored");
      meter.setAttribute("aria-label", modelIds.length === 1
        ? "Reference interaction signal not scored; only one indexed compound is selected"
        : "Reference interaction signal not scored; fewer than two indexed compounds are selected");
      scoreEl.textContent = "—";
      caption.textContent = modelIds.length === 1
        ? "Not scored: only one distinct item is recognized by the pathway index. Add another indexed compound for a limited combination signal."
        : "Not scored: fewer than two distinct cart items are recognized by the pathway index. Unknown items remain unassessed.";
    }
    if (segments && score != null) {
      segments.querySelectorAll(".drug-stack-meter-segment").forEach(function (segment) {
        if (Number(segment.getAttribute("data-level")) <= score) segment.classList.add("is-filled");
      });
    }

    if (modelIds.length < 2) {
      feedback.innerHTML = '<div class="drug-stack-feedback-empty"><strong>Combination signal unavailable.</strong><p>At least two distinct modeled compounds are needed. Items outside this 12-compound pathway index are not assessed.</p></div>';
      return;
    }
    var axisRows = DATA.stackChecker.axes.map(function (axis) {
      return { name: axis.name, score: result.axisScores[axis.id] || 0 };
    }).filter(function (axis) { return axis.score > 0; }).sort(function (a, b) { return b.score - a.score; }).slice(0, 4);
    var axisHtml = axisRows.length ? '<div class="drug-stack-axis-list"><h3>Modeled pathway-axis load</h3>' + axisRows.map(function (axis) {
      return '<div class="drug-stack-axis-row"><span>' + escapeHtml(axis.name) + '</span><strong>' + axis.score + '/100</strong><i aria-hidden="true"><b style="width:' + axis.score + '%"></b></i></div>';
    }).join("") + '</div>' : "";
    var ruleHtml = result.matchedRules.length ? '<div class="drug-stack-rule-list"><h3>Matching curated interaction rules (' + result.matchedRules.length + ')</h3>' + result.matchedRules.map(function (rule) {
      return '<article class="drug-stack-rule"><div><span class="drug-stack-rule-badge sev-' + escapeHtml(rule.severity) + '">' + escapeHtml(rule.badge) + '</span>' + (rule.pmid ? '<a href="' + pubmedUrl(rule.pmid) + '" target="_blank" rel="noopener noreferrer">PMID ' + escapeHtml(rule.pmid) + ' ↗</a>' : '') + '</div><h4>' + escapeHtml(rule.title) + '</h4><p>' + escapeHtml(rule.detail) + '</p></article>';
    }).join("") + '</div>' : '<div class="drug-stack-feedback-empty"><strong>No matching interaction rule in the bundled index for these modeled entries.</strong><p>Coverage is limited; absence of a rule is not evidence that the combination is safe.</p></div>';
    feedback.innerHTML = axisHtml + ruleHtml;
  }

  function renderStackPresets() {
    var container = document.getElementById("stack-presets");
    if (!container) return;

    container.innerHTML = DATA.stackChecker.presets
      .map(function (p) {
        var active = p.id === stackState.presetId;
        return (
          '<button type="button" class="preset-card' +
          (active ? " is-active" : "") +
          '" data-preset-id="' +
          escapeHtml(p.id) +
          '">' +
          '<div class="preset-card-top">' +
          '<span class="preset-card-title">' +
          escapeHtml(p.label) +
          "</span>" +
          '<span class="preset-tag">' +
          escapeHtml(p.shortTag) +
          "</span>" +
          "</div>" +
          '<p class="preset-card-desc">' +
          escapeHtml(p.description) +
          "</p>" +
          "</button>"
        );
      })
      .join("");

    container.querySelectorAll(".preset-card").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var pid = btn.getAttribute("data-preset-id");
        var preset = DATA.stackChecker.presets.find(function (p) {
          return p.id === pid;
        });
        if (!preset) return;
        stackState.presetId = pid;
        stackState.activeCompounds = preset.activeCompounds.slice();
        stackState.focusedEdgeId = null;
        stackState.focusedNodeId = null;
        updateAllStackViews();
      });
    });
  }

  function renderStackToggles() {
    var container = document.getElementById("stack-compound-toggles");
    var counter = document.getElementById("active-stack-counter");
    if (!container) return;

    if (counter) {
      counter.textContent =
        stackState.activeCompounds.length +
        (stackState.activeCompounds.length === 1 ? " active agent" : " active agents");
    }

    container.innerHTML = DATA.stackChecker.compounds
      .map(function (c) {
        var isOn = stackState.activeCompounds.indexOf(c.id) !== -1;
        return (
          '<button type="button" class="stack-compound-btn' +
          (isOn ? " is-on" : "") +
          '" data-compound-id="' +
          escapeHtml(c.id) +
          '" aria-pressed="' +
          (isOn ? "true" : "false") +
          '">' +
          '<span class="stack-check-indicator" aria-hidden="true"></span>' +
          "<span>" +
          escapeHtml(c.name) +
          "</span>" +
          '<span class="stack-dose-meta">' +
          escapeHtml(c.dose) +
          "</span>" +
          "</button>"
        );
      })
      .join("");

    container.querySelectorAll(".stack-compound-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var cid = btn.getAttribute("data-compound-id");
        var idx = stackState.activeCompounds.indexOf(cid);
        if (idx !== -1) {
          stackState.activeCompounds.splice(idx, 1);
        } else {
          stackState.activeCompounds.push(cid);
        }
        stackState.presetId = "custom";
        stackState.focusedEdgeId = null;
        stackState.focusedNodeId = null;
        updateAllStackViews();
      });
    });
  }

  function computeActiveSubgraph(activeIdsOverride) {
    var activeIds = activeIdsOverride || stackState.activeCompounds;
    var activeCompounds = DATA.stackChecker.compounds.filter(function (c) {
      return activeIds.indexOf(c.id) !== -1;
    });

    var cEdges = DATA.stackChecker.compoundEdges.filter(function (e) {
      return activeIds.indexOf(e.from) !== -1;
    });

    var targetHitCount = {};
    cEdges.forEach(function (e) {
      targetHitCount[e.to] = (targetHitCount[e.to] || 0) + 1;
    });

    var activeTargets = DATA.stackChecker.targets.filter(function (t) {
      return !!targetHitCount[t.id];
    });

    var activeTargetIds = activeTargets.map(function (t) {
      return t.id;
    });

    var tEdges = DATA.stackChecker.targetAxisEdges.filter(function (e) {
      return activeTargetIds.indexOf(e.from) !== -1;
    });

    var activeAxisIds = {};
    tEdges.forEach(function (e) {
      activeAxisIds[e.to] = true;
    });

    var axes = DATA.stackChecker.axes;
    return {
      compounds: activeCompounds,
      targets: activeTargets,
      axes: axes,
      cEdges: cEdges,
      tEdges: tEdges,
      targetHitCount: targetHitCount,
      activeAxisIds: activeAxisIds
    };
  }

  function renderPathwaySvg(subgraph) {
    var svg = document.getElementById("pathway-svg");
    if (!svg) return;

    var W = 820;
    var H = Math.max(460, Math.max(subgraph.compounds.length, subgraph.targets.length, subgraph.axes.length) * 66 + 70);
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);

    function yPositions(count, boxH) {
      var usableTop = 54;
      var usableBottom = H - 24;
      var span = usableBottom - usableTop;
      if (count <= 1) return [usableTop + span / 2 - boxH / 2];
      var step = (span - boxH) / (count - 1);
      var arr = [];
      for (var i = 0; i < count; i++) {
        arr.push(Math.round(usableTop + i * step));
      }
      return arr;
    }

    var compBoxH = 48;
    var targBoxH = 48;
    var axisBoxH = 48;

    var compY = yPositions(subgraph.compounds.length, compBoxH);
    var targY = yPositions(subgraph.targets.length, targBoxH);
    var axisY = yPositions(subgraph.axes.length, axisBoxH);

    var compMap = {};
    subgraph.compounds.forEach(function (c, i) {
      compMap[c.id] = { x: 18, y: compY[i], w: 192, h: compBoxH, data: c };
    });

    var targMap = {};
    subgraph.targets.forEach(function (t, i) {
      targMap[t.id] = { x: 312, y: targY[i], w: 196, h: targBoxH, data: t };
    });

    var axisMap = {};
    subgraph.axes.forEach(function (a, i) {
      axisMap[a.id] = { x: 608, y: axisY[i], w: 194, h: axisBoxH, data: a };
    });

    // Default focused edge for inspector bar
    if (!stackState.focusedEdgeId && subgraph.cEdges.length > 0) {
      // Prefer a multi-hit target edge if present
      var collisionEdge = subgraph.cEdges.find(function (e) {
        return (subgraph.targetHitCount[e.to] || 0) >= 2;
      });
      stackState.focusedEdgeId = (collisionEdge || subgraph.cEdges[0]).id;
    }

    function edgeConnectedToFocus(edgeObj, isTargetAxis) {
      if (stackState.focusedNodeId) {
        if (isTargetAxis) {
          return edgeObj.from === stackState.focusedNodeId || edgeObj.to === stackState.focusedNodeId;
        }
        return edgeObj.from === stackState.focusedNodeId || edgeObj.to === stackState.focusedNodeId;
      }
      if (stackState.focusedEdgeId) {
        if (!isTargetAxis) return edgeObj.id === stackState.focusedEdgeId;
        var selCEdge = subgraph.cEdges.find(function (ce) {
          return ce.id === stackState.focusedEdgeId;
        });
        return selCEdge && selCEdge.to === edgeObj.from;
      }
      return true;
    }

    var parts = [];

    // Subtle Clinical Grid Background
    parts.push('<rect width="' + W + '" height="' + H + '" fill="#0B0B0D" />');
    for (var gx = 40; gx < W; gx += 60) {
      parts.push(
        '<line x1="' + gx + '" y1="0" x2="' + gx + '" y2="' + H + '" stroke="#CFC9BC" stroke-opacity="0.04" />'
      );
    }

    // Column Headers
    parts.push(
      '<text x="18" y="28" fill="#CFC9BC" font-size="10.5" font-weight="700" letter-spacing="1.1">01 // ACTIVE COMPOUNDS</text>'
    );
    parts.push(
      '<text x="312" y="28" fill="#CFC9BC" font-size="10.5" font-weight="700" letter-spacing="1.1">02 // RECEPTORS &amp; CYP ENZYMES</text>'
    );
    parts.push(
      '<text x="608" y="28" fill="#CFC9BC" font-size="10.5" font-weight="700" letter-spacing="1.1">03 // PHYSIOLOGICAL AXES</text>'
    );
    parts.push('<line x1="18" y1="38" x2="802" y2="38" stroke="#CFC9BC" stroke-opacity="0.18" />');

    // Compound -> Target Edges
    subgraph.cEdges.forEach(function (e) {
      var src = compMap[e.from];
      var dst = targMap[e.to];
      if (!src || !dst) return;

      var x1 = src.x + src.w;
      var y1 = src.y + src.h / 2;
      var x2 = dst.x;
      var y2 = dst.y + dst.h / 2;
      var cpx1 = x1 + 52;
      var cpx2 = x2 - 52;

      var isAlert = e.type === "inhibition" || e.type === "induction";
      var stroke = isAlert ? "#E0645C" : "#4666A0";
      var dashed = e.grade === "C" || e.grade === "D" || e.grade === "E" ? ' stroke-dasharray="5 4"' : "";
      var highlighted = edgeConnectedToFocus(e, false);
      var opacity = highlighted ? "0.95" : "0.28";
      var width = e.id === stackState.focusedEdgeId ? "2.8" : highlighted ? "2.1" : "1.4";

      parts.push(
        '<path class="graph-edge" data-edge-id="' +
          escapeHtml(e.id) +
          '" d="M ' +
          x1 +
          "," +
          y1 +
          " C " +
          cpx1 +
          "," +
          y1 +
          " " +
          cpx2 +
          "," +
          y2 +
          " " +
          x2 +
          "," +
          y2 +
          '" fill="none" stroke="' +
          stroke +
          '" stroke-width="' +
          width +
          '" stroke-opacity="' +
          opacity +
          '"' +
          dashed +
          " />"
      );
    });

    // Target -> Axis Edges
    subgraph.tEdges.forEach(function (te) {
      var src = targMap[te.from];
      var dst = axisMap[te.to];
      if (!src || !dst) return;

      var x1 = src.x + src.w;
      var y1 = src.y + src.h / 2;
      var x2 = dst.x;
      var y2 = dst.y + dst.h / 2;
      var cpx1 = x1 + 50;
      var cpx2 = x2 - 50;

      var multiHit = (subgraph.targetHitCount[te.from] || 0) >= 2;
      var stroke = multiHit ? "#E0645C" : "#6D7993";
      var highlighted = edgeConnectedToFocus(te, true);
      var opacity = highlighted ? "0.88" : "0.25";
      var width = multiHit ? "2.3" : "1.5";

      parts.push(
        '<path d="M ' +
          x1 +
          "," +
          y1 +
          " C " +
          cpx1 +
          "," +
          y1 +
          " " +
          cpx2 +
          "," +
          y2 +
          " " +
          x2 +
          "," +
          y2 +
          '" fill="none" stroke="' +
          stroke +
          '" stroke-width="' +
          width +
          '" stroke-opacity="' +
          opacity +
          '" />'
      );
    });

    // Column 1 Nodes: Compounds
    subgraph.compounds.forEach(function (c) {
      var box = compMap[c.id];
      var isFocused = stackState.focusedNodeId === c.id;
      var borderCol = isFocused ? "#E0645C" : "#4666A0";
      parts.push(
        '<g class="graph-node" data-node-id="' +
          escapeHtml(c.id) +
          '">' +
          '<rect x="' +
          box.x +
          '" y="' +
          box.y +
          '" width="' +
          box.w +
          '" height="' +
          box.h +
          '" rx="6" fill="#12141A" stroke="' +
          borderCol +
          '" stroke-width="' +
          (isFocused ? "2" : "1.3") +
          '" />' +
          '<text x="' +
          (box.x + 12) +
          '" y="' +
          (box.y + 20) +
          '" fill="#E8ECE8" font-size="12.5" font-weight="700">' +
          escapeHtml(c.name) +
          "</text>" +
          '<text x="' +
          (box.x + 12) +
          '" y="' +
          (box.y + 36) +
          '" fill="#8C938D" font-size="10.5" font-family="monospace">' +
          escapeHtml(c.dose) +
          " · t½ " +
          escapeHtml(c.halfLife) +
          "</text>" +
          "</g>"
      );
    });

    // Column 2 Nodes: Molecular Targets
    subgraph.targets.forEach(function (t) {
      var box = targMap[t.id];
      var hits = subgraph.targetHitCount[t.id] || 0;
      var isConvergent = hits >= 2;
      var isFocused = stackState.focusedNodeId === t.id;
      var stroke = isFocused || isConvergent ? "#E0645C" : "rgba(207, 201, 188, 0.45)";
      var fill = isConvergent ? "#1B1417" : "#12141A";

      parts.push(
        '<g class="graph-node" data-node-id="' +
          escapeHtml(t.id) +
          '">' +
          '<rect x="' +
          box.x +
          '" y="' +
          box.y +
          '" width="' +
          box.w +
          '" height="' +
          box.h +
          '" rx="6" fill="' +
          fill +
          '" stroke="' +
          stroke +
          '" stroke-width="' +
          (isConvergent || isFocused ? "1.8" : "1.2") +
          '" />' +
          '<text x="' +
          (box.x + 12) +
          '" y="' +
          (box.y + 20) +
          '" fill="#E8ECE8" font-size="12" font-weight="700">' +
          escapeHtml(t.name) +
          "</text>" +
          '<text x="' +
          (box.x + 12) +
          '" y="' +
          (box.y + 36) +
          '" fill="' +
          (isConvergent ? "#E0645C" : "#8C938D") +
          '" font-size="10" font-family="monospace">' +
          (isConvergent ? hits + "x CONVERGENCE · " + escapeHtml(t.sub) : escapeHtml(t.sub)) +
          "</text>" +
          "</g>"
      );
    });

    // Column 3 Nodes: Physiological Axes
    subgraph.axes.forEach(function (a) {
      var box = axisMap[a.id];
      var isActive = !!subgraph.activeAxisIds[a.id];
      var isFocused = stackState.focusedNodeId === a.id;
      var stroke = isFocused
        ? "#E0645C"
        : isActive
        ? "rgba(207, 201, 188, 0.50)"
        : "rgba(207, 201, 188, 0.16)";
      parts.push(
        '<g class="graph-node" data-node-id="' +
          escapeHtml(a.id) +
          '" opacity="' +
          (isActive ? "1" : "0.42") +
          '">' +
          '<rect x="' +
          box.x +
          '" y="' +
          box.y +
          '" width="' +
          box.w +
          '" height="' +
          box.h +
          '" rx="6" fill="#101217" stroke="' +
          stroke +
          '" stroke-width="1.2" />' +
          '<text x="' +
          (box.x + 12) +
          '" y="' +
          (box.y + 20) +
          '" fill="#E8ECE8" font-size="12" font-weight="700">' +
          escapeHtml(a.name) +
          "</text>" +
          '<text x="' +
          (box.x + 12) +
          '" y="' +
          (box.y + 36) +
          '" fill="#8C938D" font-size="10" font-family="monospace">' +
          escapeHtml(a.unit) +
          "</text>" +
          "</g>"
      );
    });

    svg.innerHTML = parts.join("");

    // Bind Edge & Node Click/Hover Interactions
    svg.querySelectorAll(".graph-edge").forEach(function (el) {
      el.addEventListener("click", function () {
        stackState.focusedEdgeId = el.getAttribute("data-edge-id");
        stackState.focusedNodeId = null;
        renderPathwaySvg(subgraph);
        renderEdgeInspector(subgraph);
      });
    });

    svg.querySelectorAll(".graph-node").forEach(function (el) {
      el.addEventListener("click", function () {
        var nid = el.getAttribute("data-node-id");
        if (stackState.focusedNodeId === nid) {
          stackState.focusedNodeId = null;
        } else {
          stackState.focusedNodeId = nid;
          var matchingEdge = subgraph.cEdges.find(function (ce) {
            return ce.from === nid || ce.to === nid;
          });
          if (matchingEdge) stackState.focusedEdgeId = matchingEdge.id;
        }
        renderPathwaySvg(subgraph);
        renderEdgeInspector(subgraph);
      });
    });

    renderEdgeInspector(subgraph);
  }

  function renderEdgeInspector(subgraph) {
    var bar = document.getElementById("edge-inspector-bar");
    if (!bar) return;

    var edge =
      subgraph.cEdges.find(function (e) {
        return e.id === stackState.focusedEdgeId;
      }) || subgraph.cEdges[0];

    if (!edge) {
      bar.innerHTML =
        '<div class="edge-inspector-main"><span class="edge-inspector-kicker">PATHWAY INSPECTOR</span><p class="edge-inspector-desc">Select at least one compound to inspect target linkage.</p></div>';
      return;
    }

    var comp = DATA.stackChecker.compounds.find(function (c) {
      return c.id === edge.from;
    });
    var targ = DATA.stackChecker.targets.find(function (t) {
      return t.id === edge.to;
    });

    bar.innerHTML =
      '<div class="edge-inspector-main">' +
      '<span class="edge-inspector-kicker">SELECTED PATHWAY LINKAGE · CLICK ANY NODE OR EDGE IN GRAPH</span>' +
      '<h4 class="edge-inspector-title">' +
      escapeHtml(comp ? comp.name : edge.from) +
      " → " +
      escapeHtml(targ ? targ.name : edge.to) +
      " (" +
      escapeHtml(edge.potency) +
      ")</h4>" +
      '<p class="edge-inspector-desc">' +
      escapeHtml(edge.mechanism) +
      "</p>" +
      "</div>" +
      '<div class="edge-inspector-meta">' +
      gradeBadgeHtml(edge.grade) +
      '<a href="' +
      pubmedUrl(edge.pmid) +
      '" target="_blank" rel="noopener noreferrer" class="mono-code" style="font-size: 0.8rem;">PMID: ' +
      escapeHtml(edge.pmid) +
      " ↗</a>" +
      "</div>";
  }

  function evaluateStackRisk(subgraph, activeSetOverride) {
    // Compute 0-100 score per axis based on active edges and multi-hit multipliers
    var axisScores = {
      "serotonin-axis": 0,
      "cyp-axis": 0,
      "cortical-axis": 0,
      "glycemic-axis": 0,
      "myopathy-axis": 0
    };

    var targetToAxis = {};
    DATA.stackChecker.targetAxisEdges.forEach(function (te) {
      targetToAxis[te.from] = te.to;
    });

    subgraph.cEdges.forEach(function (ce) {
      var ax = targetToAxis[ce.to];
      if (!ax) return;
      var hits = subgraph.targetHitCount[ce.to] || 1;
      var isBufferingMod = ce.type === "modulation" && ce.weight <= 8;
      var mult = hits >= 2 && !isBufferingMod && ce.weight > 0 ? 1.25 : 1.0;
      axisScores[ax] = (axisScores[ax] || 0) + ce.weight * mult;
    });

    Object.keys(axisScores).forEach(function (k) {
      axisScores[k] = Math.max(0, Math.min(100, Math.round(axisScores[k])));
    });

    // Evaluate multi-compound clinical rules
    var activeSet = activeSetOverride || stackState.activeCompounds;
    var matchedRules = DATA.stackChecker.interactionRules.filter(function (rule) {
      if (rule.requiresAnyCount) {
        var count = rule.requiresAnyCount.pool.filter(function (id) {
          return activeSet.indexOf(id) !== -1;
        }).length;
        if (count < rule.requiresAnyCount.min) return false;
      }
      if (rule.requiresAll) {
        var allPresent = rule.requiresAll.every(function (id) {
          return activeSet.indexOf(id) !== -1;
        });
        if (!allPresent) return false;
      }
      if (rule.requiresAny) {
        var anyPresent = rule.requiresAny.some(function (id) {
          return activeSet.indexOf(id) !== -1;
        });
        if (!anyPresent) return false;
      }
      return true;
    });

    return { axisScores: axisScores, matchedRules: matchedRules };
  }

  function renderRiskSummary(subgraph) {
    var result = evaluateStackRisk(subgraph);
    var banner = document.getElementById("risk-overall-banner");
    var titleEl = document.getElementById("risk-overall-title");
    var edgeCountEl = document.getElementById("risk-edge-count");
    var axesListEl = document.getElementById("axis-breakdown-list");
    var findingsCountEl = document.getElementById("findings-count-label");
    var findingsEl = document.getElementById("stack-findings-list");

    if (!banner || !axesListEl || !findingsEl) return;
    if (!subgraph.compounds.length) {
      banner.className = "risk-overall-banner level-unknown";
      if (titleEl) titleEl.textContent = "No modeled items selected";
      if (edgeCountEl) edgeCountEl.textContent = "0 Indexed Edges";
      if (findingsCountEl) findingsCountEl.textContent = "Not assessed";
      axesListEl.innerHTML = '<p class="stack-no-items-note">Select indexed compounds to view the reference pathway map.</p>';
      findingsEl.innerHTML = '<div class="finding-card sev-unknown"><div class="finding-kicker"><span>NO ASSESSMENT</span><span>LIMITED INDEX</span></div><h4 class="finding-title">No modeled compounds are selected</h4><p class="finding-detail">Nothing is being scored. An empty or unmodeled selection does not imply safety.</p></div>';
      return;
    }

    var maxScore = 0;
    Object.keys(result.axisScores).forEach(function (k) {
      if (result.axisScores[k] > maxScore) maxScore = result.axisScores[k];
    });

    var hasCritical = result.matchedRules.some(function (r) {
      return r.severity === "critical" || r.severity === "elevated";
    });

    banner.className = "risk-overall-banner";
    if (hasCritical || maxScore >= 72) {
      banner.classList.add("level-high");
      titleEl.textContent = "Higher-severity flags in index";
    } else if (maxScore >= 42 || result.matchedRules.some(function (r) { return r.severity === "moderate"; })) {
      banner.classList.add("level-moderate");
      titleEl.textContent = "Pathway overlap in index";
    } else {
      banner.classList.add("level-low");
      titleEl.textContent = "No higher-tier flag matched";
    }

    edgeCountEl.textContent = subgraph.cEdges.length + " Active Edges";

    axesListEl.innerHTML = DATA.stackChecker.axes
      .map(function (axis) {
        var val = result.axisScores[axis.id] || 0;
        var activeSegs = Math.round(val / 10);
        var segClass = val >= 70 ? "filled-high" : val >= 40 ? "filled-mod" : "filled-low";
        var segHtml = "";
        for (var i = 0; i < 10; i++) {
          segHtml +=
            '<span class="seg-block' + (i < activeSegs ? " " + segClass : "") + '"></span>';
        }
        var bandWord = val >= 70 ? "Higher index load" : val >= 40 ? "Moderate index load" : val > 0 ? "Some index signal" : "No modeled edge";
        return (
          '<div class="axis-item">' +
          '<div class="axis-item-top">' +
          '<span class="axis-name">' +
          escapeHtml(axis.name) +
          "</span>" +
          '<span class="axis-score-val">' +
          escapeHtml(bandWord) +
          " · " +
          val +
          "/100</span>" +
          "</div>" +
          '<div class="severity-segments" aria-hidden="true">' +
          segHtml +
          "</div>" +
          "</div>"
        );
      })
      .join("");

    findingsCountEl.textContent =
      result.matchedRules.length +
      (result.matchedRules.length === 1 ? " Signal" : " Signals");

    if (result.matchedRules.length === 0) {
      findingsEl.innerHTML =
        '<div class="finding-card sev-unknown">' +
        '<div class="finding-kicker"><span>NO MATCHING RULE IN INDEX</span><span>LIMITED COVERAGE</span></div>' +
        '<h4 class="finding-title">No bundled interaction rule matched this selection</h4>' +
        '<p class="finding-detail">The local rule set did not return a specific flag. It is incomplete; absence of a flag is not evidence that a combination is safe.</p>' +
        "</div>";
    } else {
      findingsEl.innerHTML = result.matchedRules
        .map(function (r) {
          return (
            '<div class="finding-card sev-' +
            escapeHtml(r.severity) +
            '">' +
            '<div class="finding-kicker">' +
            "<span>" +
            escapeHtml(r.badge) +
            "</span>" +
            '<a href="' +
            pubmedUrl(r.pmid) +
            '" target="_blank" rel="noopener noreferrer">PMID: ' +
            escapeHtml(r.pmid) +
            " ↗</a>" +
            "</div>" +
            '<h4 class="finding-title">' +
            escapeHtml(r.title) +
            "</h4>" +
            '<p class="finding-detail">' +
            escapeHtml(r.detail) +
            "</p>" +
            "</div>"
          );
        })
        .join("");
    }
  }

  function updateAllStackViews() {
    renderStackPresets();
    renderStackToggles();
    var subgraph = computeActiveSubgraph();
    renderPathwaySvg(subgraph);
    renderRiskSummary(subgraph);
  }

  /* ------------------------------------------------------------------------
     4. Neuroanatomical Brain Atlas Teaser
     ------------------------------------------------------------------------ */
  var atlasState = {
    systemId: DATA.brainAtlas.systems[0].id,
    regionId: "hippocampus"
  };

  function renderAtlasSystemTabs() {
    var container = document.getElementById("atlas-system-tabs");
    var genesLabel = document.getElementById("atlas-active-genes");
    if (!container) return;

    var activeSys =
      DATA.brainAtlas.systems.find(function (s) {
        return s.id === atlasState.systemId;
      }) || DATA.brainAtlas.systems[0];

    if (genesLabel) {
      genesLabel.textContent = activeSys.genePair;
    }

    container.innerHTML = DATA.brainAtlas.systems
      .map(function (s) {
        var active = s.id === atlasState.systemId;
        return (
          '<button type="button" role="tab" aria-selected="' +
          (active ? "true" : "false") +
          '" class="filter-btn' +
          (active ? " is-active" : "") +
          '" data-sys-id="' +
          escapeHtml(s.id) +
          '">' +
          escapeHtml(s.label) +
          "</button>"
        );
      })
      .join("");

    container.querySelectorAll(".filter-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        atlasState.systemId = btn.getAttribute("data-sys-id");
        updateBrainAtlas();
      });
    });
  }

  function renderAtlasSvgPins() {
    var layer = document.getElementById("atlas-pins-layer");
    var btnStrip = document.getElementById("atlas-region-buttons");
    if (!layer || !btnStrip) return;

    layer.innerHTML = DATA.brainAtlas.regions
      .map(function (r) {
        var score = r.systemScores[atlasState.systemId] || 40;
        var outerR = Math.round(7 + (score / 100) * 11);
        var isSel = r.id === atlasState.regionId;
        var fillCol = score >= 82 ? "#E0645C" : "#4666A0";
        var fillOp = isSel ? "0.45" : "0.22";
        var ringStroke = isSel ? "#E8ECE8" : fillCol;
        var elbowX = r.side === "left" ? r.lx + 22 : r.lx - 22;
        var anchor = r.side === "left" ? "end" : "start";
        var textX = r.side === "left" ? r.lx - 4 : r.lx + 4;
        var leaderCol = isSel ? "#E0645C" : "rgba(207, 201, 188, 0.36)";

        return (
          '<g class="brain-region-pin" tabindex="0" role="button" aria-label="Inspect ' +
          escapeHtml(r.name) +
          '" data-region-id="' +
          escapeHtml(r.id) +
          '">' +
          '<path d="M ' +
          r.cx +
          "," +
          r.cy +
          " L " +
          elbowX +
          "," +
          r.ly +
          " L " +
          r.lx +
          "," +
          r.ly +
          '" fill="none" stroke="' +
          leaderCol +
          '" stroke-width="' +
          (isSel ? "1.5" : "1") +
          '" />' +
          '<circle cx="' +
          r.cx +
          '" cy="' +
          r.cy +
          '" r="' +
          outerR +
          '" fill="' +
          fillCol +
          '" fill-opacity="' +
          fillOp +
          '" stroke="' +
          ringStroke +
          '" stroke-width="' +
          (isSel ? "2" : "1.2") +
          '" />' +
          '<circle cx="' +
          r.cx +
          '" cy="' +
          r.cy +
          '" r="3" fill="' +
          (isSel ? "#E8ECE8" : fillCol) +
          '" />' +
          '<text x="' +
          textX +
          '" y="' +
          (r.ly + 4) +
          '" text-anchor="' +
          anchor +
          '" fill="' +
          (isSel ? "#E8ECE8" : "#BAC0BA") +
          '" font-size="' +
          (isSel ? "11" : "10.5") +
          '" font-weight="' +
          (isSel ? "700" : "500") +
          '">' +
          escapeHtml(r.shortName) +
          " · " +
          score +
          "</text>" +
          "</g>"
        );
      })
      .join("");

    layer.querySelectorAll(".brain-region-pin").forEach(function (g) {
      function selectPin() {
        atlasState.regionId = g.getAttribute("data-region-id");
        updateBrainAtlas();
      }
      g.addEventListener("click", selectPin);
      g.addEventListener("keydown", function (ev) {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          selectPin();
        }
      });
    });

    btnStrip.innerHTML = DATA.brainAtlas.regions
      .map(function (r) {
        var isSel = r.id === atlasState.regionId;
        return (
          '<button type="button" class="compound-chip' +
          (isSel ? " is-selected" : "") +
          '" data-region-id="' +
          escapeHtml(r.id) +
          '">' +
          escapeHtml(r.shortName) +
          "</button>"
        );
      })
      .join("");

    btnStrip.querySelectorAll(".compound-chip").forEach(function (btn) {
      btn.addEventListener("click", function () {
        atlasState.regionId = btn.getAttribute("data-region-id");
        updateBrainAtlas();
      });
    });
  }

  function renderAtlasInspector() {
    var body = document.getElementById("atlas-inspector-body");
    var mniEl = document.getElementById("atlas-mni-coord");
    if (!body) return;

    var region =
      DATA.brainAtlas.regions.find(function (r) {
        return r.id === atlasState.regionId;
      }) || DATA.brainAtlas.regions[0];

    if (mniEl) {
      mniEl.textContent = "MNI " + region.mni;
    }

    var sysScore = region.systemScores[atlasState.systemId] || 50;

    var transcriptsHtml = region.transcripts
      .map(function (t) {
        var high = t.density >= 85;
        return (
          '<div class="transcript-row">' +
          '<span class="transcript-gene">' +
          escapeHtml(t.gene) +
          "</span>" +
          '<div class="bar-track"><div class="bar-fill' +
          (high ? " is-high" : "") +
          '" style="width:' +
          t.density +
          '%;"></div></div>' +
          '<span class="transcript-z">' +
          escapeHtml(t.z) +
          "</span>" +
          "</div>"
        );
      })
      .join("");

    var compsHtml = region.compounds
      .map(function (c) {
        return (
          '<div class="atlas-compound-row">' +
          '<div class="atlas-compound-top">' +
          '<span class="atlas-compound-name">' +
          escapeHtml(c.name) +
          "</span>" +
          gradeBadgeHtml(c.grade) +
          "</div>" +
          '<div style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 4px;">' +
          escapeHtml(c.metric) +
          "</div>" +
          '<div style="display:flex; justify-content:space-between; align-items:center;">' +
          '<span class="kpuu-tag">BBB Kp,uu: ' +
          escapeHtml(c.kpuu) +
          "</span>" +
          '<a href="' +
          pubmedUrl(c.pmid) +
          '" target="_blank" rel="noopener noreferrer" class="mono-code" style="font-size:0.75rem;">PMID: ' +
          escapeHtml(c.pmid) +
          " ↗</a>" +
          "</div>" +
          "</div>"
        );
      })
      .join("");

    body.innerHTML =
      '<div style="display:flex; align-items:baseline; justify-content:space-between; gap:8px; margin-bottom:6px;">' +
      '<h3 style="margin:0; font-size:1.3rem; letter-spacing:-0.02em;">' +
      escapeHtml(region.name) +
      "</h3>" +
      '<span class="mono-code" style="font-size:0.76rem; color:var(--text-muted);">' +
      escapeHtml(region.code) +
      "</span>" +
      "</div>" +
      '<p style="font-size:0.84rem; color:var(--text-secondary); margin:0 0 14px 0; line-height:1.5;">' +
      escapeHtml(region.summary) +
      "</p>" +
      '<div style="padding:8px 12px; background:var(--bg-canvas); border:1px solid var(--stone-line); border-radius:4px; margin-bottom:16px; display:flex; justify-content:space-between; font-size:0.8rem;">' +
      '<span style="color:var(--text-muted);">Selected Overlay Density Index</span>' +
      '<strong class="tabular">' +
      sysScore +
      " / 100</strong>" +
      "</div>" +
      '<div class="dossier-subhead"><span>Dominant Human mRNA Transcripts</span><span>Allen Brain z-Score</span></div>' +
      '<div class="transcript-bars">' +
      transcriptsHtml +
      "</div>" +
      '<div class="dossier-subhead"><span>BBB-Validated Compounds Active Here</span><span>Provenance</span></div>' +
      '<div class="atlas-compound-list">' +
      compsHtml +
      "</div>";
  }

  function updateBrainAtlas() {
    renderAtlasSystemTabs();
    renderAtlasSvgPins();
    renderAtlasInspector();
  }

  /* ------------------------------------------------------------------------
     5. Five-Tier Evidence Grading & Translation Gap Comparator
     ------------------------------------------------------------------------ */
  var activeCaseId = DATA.evidenceGrading.cases[0].id;

  function renderEvidenceTiers() {
    var grid = document.getElementById("tier-cards-grid");
    if (!grid) return;

    grid.innerHTML = DATA.evidenceGrading.tiers
      .map(function (t) {
        var pct = Math.round(parseFloat(t.weight) * 100);
        return (
          '<article class="tier-column-card tier-card-' +
          escapeHtml(t.grade) +
          '">' +
          "<div>" +
          '<div style="display:flex; align-items:center; justify-content:space-between; gap:8px;">' +
          gradeBadgeHtml(t.grade) +
          '<span class="mono-code" style="font-size:0.75rem; color:var(--text-muted);">Ceiling ' +
          escapeHtml(t.weight) +
          "</span>" +
          "</div>" +
          '<div class="tier-weight-bar" aria-hidden="true"><div class="tier-weight-fill" style="width:' +
          pct +
          '%;"></div></div>' +
          '<h3 class="tier-title">' +
          escapeHtml(t.title) +
          "</h3>" +
          '<p class="tier-scope">' +
          escapeHtml(t.scope) +
          "</p>" +
          '<div class="tier-rule-box"><strong>Audit Rule:</strong> ' +
          escapeHtml(t.rule) +
          "</div>" +
          "</div>" +
          '<div class="tier-allowed-quote">Allowed framing:<br />' +
          escapeHtml(t.allowed) +
          "</div>" +
          "</article>"
        );
      })
      .join("");
  }

  function renderTranslationComparator() {
    var tabsEl = document.getElementById("comparator-case-tabs");
    var titleEl = document.getElementById("comparator-case-title");
    var summaryEl = document.getElementById("comparator-case-summary");
    var rowsEl = document.getElementById("comparator-rows");
    if (!tabsEl || !rowsEl) return;

    var activeCase =
      DATA.evidenceGrading.cases.find(function (c) {
        return c.id === activeCaseId;
      }) || DATA.evidenceGrading.cases[0];

    titleEl.textContent = activeCase.name;
    summaryEl.textContent = activeCase.summary;

    tabsEl.innerHTML = DATA.evidenceGrading.cases
      .map(function (c) {
        var shortLabel = c.name.split("·")[0].trim();
        var isAct = c.id === activeCaseId;
        return (
          '<button type="button" role="tab" aria-selected="' +
          (isAct ? "true" : "false") +
          '" class="filter-btn' +
          (isAct ? " is-active" : "") +
          '" data-case-id="' +
          escapeHtml(c.id) +
          '">' +
          escapeHtml(shortLabel) +
          "</button>"
        );
      })
      .join("");

    tabsEl.querySelectorAll(".filter-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        activeCaseId = btn.getAttribute("data-case-id");
        renderTranslationComparator();
      });
    });

    rowsEl.innerHTML = activeCase.rows
      .map(function (r) {
        return (
          '<div class="comparator-row">' +
          "<div>" +
          gradeBadgeHtml(r.grade) +
          "</div>" +
          '<div class="comp-status">' +
          escapeHtml(r.status) +
          "</div>" +
          '<div class="comp-detail">' +
          escapeHtml(r.detail) +
          "</div>" +
          '<div class="comp-metric">' +
          "<div>" +
          escapeHtml(r.metric) +
          "</div>" +
          '<a href="' +
          pubmedUrl(r.pmid) +
          '" target="_blank" rel="noopener noreferrer" style="font-size:0.73rem;">PMID: ' +
          escapeHtml(r.pmid) +
          " ↗</a>" +
          "</div>" +
          "</div>"
        );
      })
      .join("");
  }

  /* ------------------------------------------------------------------------
     6. Browser-Local Protocol Log
     ------------------------------------------------------------------------ */
  var STORAGE_KEY = "pharmawiki_protocol_log_v1";
  // Migrate notes saved before the brand rename without losing browser-local data.
  var LEGACY_STORAGE_KEY = "pharma" + "pedia_protocol_log_v1";

  var defaultProtocolEntries = [
    { name: "Rosuvastatin", dose: "10 mg", schedule: "PM Dinner", washout: "~95 h (5x t½)" },
    { name: "Metformin XR", dose: "1000 mg", schedule: "PM Dinner", washout: "~31 h plasma" },
    { name: "Ubiquinol (CoQ10)", dose: "200 mg", schedule: "AM With Meal", washout: "~165 h (5x t½)" }
  ];

  function loadProtocolEntries() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        raw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
        if (raw) {
          window.localStorage.setItem(STORAGE_KEY, raw);
          window.localStorage.removeItem(LEGACY_STORAGE_KEY);
        }
      }
      if (!raw) return defaultProtocolEntries.slice();
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : defaultProtocolEntries.slice();
    } catch (e) {
      return defaultProtocolEntries.slice();
    }
  }

  function saveProtocolEntries(entries) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch (e) {
      // Ignore storage quota errors in restricted browsing modes
    }
  }

  var protocolEntries = loadProtocolEntries();

  function renderProtocolLog() {
    var listEl = document.getElementById("protocol-log-list");
    if (!listEl) return;

    if (protocolEntries.length === 0) {
      listEl.innerHTML =
        '<div style="padding: 18px; text-align:center; color: var(--text-muted); border: 1px dashed var(--stone-line-strong); border-radius: 4px; font-size: 0.84rem;">Local protocol log is empty. Add an agent above or copy the active stack from the Stack Checker.</div>';
      return;
    }

    listEl.innerHTML = protocolEntries
      .map(function (entry, idx) {
        return (
          '<div class="protocol-entry">' +
          "<div><strong>" +
          escapeHtml(entry.name) +
          "</strong></div>" +
          '<div class="mono-code" style="color: var(--text-secondary);">' +
          escapeHtml(entry.dose) +
          "</div>" +
          '<div style="color: var(--text-muted); font-size: 0.78rem;">' +
          escapeHtml(entry.schedule) +
          (entry.washout ? " · Washout " + escapeHtml(entry.washout) : "") +
          "</div>" +
          '<button type="button" class="remove-entry-btn" data-remove-idx="' +
          idx +
          '" aria-label="Remove ' +
          escapeHtml(entry.name) +
          '">Remove</button>' +
          "</div>"
        );
      })
      .join("");

    listEl.querySelectorAll(".remove-entry-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var idx = parseInt(btn.getAttribute("data-remove-idx"), 10);
        protocolEntries.splice(idx, 1);
        saveProtocolEntries(protocolEntries);
        renderProtocolLog();
      });
    });
  }

  function buildProtocolMarkdown() {
    var lines = [
      "# Pharmawiki Clinical Regimen & Interaction Brief",
      "Generated locally via Pharmawiki Open-Source Library (v" + DATA.meta.version + ")",
      "Zero-telemetry client-side export · Verify all changes with a licensed clinician.",
      "",
      "## 1. Logged Protocol Regimen"
    ];

    if (protocolEntries.length === 0) {
      lines.push("- (No entries logged)");
    } else {
      protocolEntries.forEach(function (e) {
        lines.push(
          "- **" +
            e.name +
            "** — " +
            e.dose +
            " (" +
            e.schedule +
            (e.washout ? ", est. 5x t½ washout: " + e.washout : "") +
            ")"
        );
      });
    }

    var subgraph = computeActiveSubgraph();
    var risk = evaluateStackRisk(subgraph);
    lines.push("");
    lines.push("## 2. Active Stack Checker Audit (" + subgraph.compounds.length + " Compounds)");
    subgraph.compounds.forEach(function (c) {
      lines.push("- " + c.name + " (" + c.dose + ", t½ " + c.halfLife + ")");
    });

    lines.push("");
    lines.push("## 3. Detected Convergence Signals");
    if (risk.matchedRules.length === 0) {
      lines.push("- No high-severity CYP450 or serotonergic collisions flagged in active stack.");
    } else {
      risk.matchedRules.forEach(function (r) {
        lines.push(
          "- **[" +
            r.badge +
            "] " +
            r.title +
            "**: " +
            r.detail +
            " (https://pubmed.ncbi.nlm.nih.gov/" +
            r.pmid +
            "/)"
        );
      });
    }

    return lines.join("\n");
  }

  function triggerDownload(filename, mimeType, content) {
    var blob = new Blob([content], { type: mimeType });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 800);
  }

  function initProtocolActions() {
    renderProtocolLog();

    var form = document.getElementById("protocol-add-form");
    if (form) {
      form.addEventListener("submit", function (ev) {
        ev.preventDefault();
        var nameInput = document.getElementById("protocol-name-input");
        var doseInput = document.getElementById("protocol-dose-input");
        var schedSelect = document.getElementById("protocol-schedule-select");
        var name = nameInput.value.trim();
        var dose = doseInput.value.trim();
        if (!name || !dose) return;

        protocolEntries.push({
          name: name,
          dose: dose,
          schedule: schedSelect.value,
          washout: "Check monograph t½"
        });
        saveProtocolEntries(protocolEntries);
        renderProtocolLog();
        nameInput.value = "";
        doseInput.value = "";
        showToast("Added " + name + " to local browser log.");
      });
    }

    var sendStackBtn = document.getElementById("send-stack-to-log-btn");
    if (sendStackBtn) {
      sendStackBtn.addEventListener("click", function () {
        var active = DATA.stackChecker.compounds.filter(function (c) {
          return stackState.activeCompounds.indexOf(c.id) !== -1;
        });
        protocolEntries = active.map(function (c) {
          var numericHalf = parseFloat(c.halfLife);
          var wash = !isNaN(numericHalf) ? "~" + Math.round(numericHalf * 5) + " h" : c.halfLife;
          return {
            name: c.name,
            dose: c.dose,
            schedule: "Per Regimen",
            washout: wash
          };
        });
        saveProtocolEntries(protocolEntries);
        renderProtocolLog();
        var targetSec = document.getElementById("protocol-log");
        if (targetSec) targetSec.scrollIntoView({ behavior: "smooth" });
        showToast("Synced " + protocolEntries.length + " stack compounds to local Protocol Log.");
      });
    }

    var exportMdBtn = document.getElementById("export-markdown-btn");
    if (exportMdBtn) {
      exportMdBtn.addEventListener("click", function () {
        var md = buildProtocolMarkdown();
        triggerDownload("pharmawiki-clinical-brief.md", "text/markdown;charset=utf-8", md);
        showToast("Downloaded pharmawiki-clinical-brief.md");
      });
    }

    var copyMdBtn = document.getElementById("copy-markdown-btn");
    if (copyMdBtn) {
      copyMdBtn.addEventListener("click", function () {
        var md = buildProtocolMarkdown();
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(md).then(function () {
            showToast("Copied Markdown clinical brief to clipboard.");
          });
        } else {
          showToast("Clipboard API unavailable; use Export (.md) button.");
        }
      });
    }

    var clearBtn = document.getElementById("clear-protocol-btn");
    if (clearBtn) {
      clearBtn.addEventListener("click", function () {
        protocolEntries = [];
        saveProtocolEntries(protocolEntries);
        renderProtocolLog();
        showToast("Purged local browser protocol log.");
      });
    }


  }

  /* ------------------------------------------------------------------------
     Initialize Search and Reference Modules
     ------------------------------------------------------------------------ */
  document.addEventListener("DOMContentLoaded", function () {
    initMobileNav();
    initCompoundSearch();
    initDrugDetailTabs();
    initStudyLedger();
    updateAllStackViews();
    updateBrainAtlas();
    renderEvidenceTiers();
    renderTranslationComparator();
    initProtocolActions();
    initPageRouter();
  });
})();
