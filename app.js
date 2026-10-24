/* ==========================================================================
   Pharmapedia Compound Search & Reference App (app.js)
   Client-side vanilla JS; live catalog lookups go directly to PubChem and RxNorm.
   ========================================================================== */

(function () {
  "use strict";

  var DATA = window.PHARMAPEDIA_DATA;
  if (!DATA) {
    console.error("Pharmapedia dataset (data.js) failed to load.");
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
    var m = DATA.monographs.find(function (item) {
      return item.id === monographId;
    });
    var idsEl = document.getElementById("dossier-ids");
    var bodyEl = document.getElementById("dossier-body");
    var sourceEl = document.getElementById("dossier-source-label");
    if (!m || !idsEl || !bodyEl) return;

    detailRequestId += 1;
    if (sourceEl) sourceEl.textContent = "Curated dossier";
    idsEl.innerHTML =
      '<a href="' + pubchemUrl(m.pubchemCid) + '" target="_blank" rel="noopener noreferrer" title="View on NCBI PubChem">CID:' +
      escapeHtml(m.pubchemCid) +
      '</a><span>·</span><a href="' + chemblUrl(m.chemblId) + '" target="_blank" rel="noopener noreferrer" title="View on EBI ChEMBL">' +
      escapeHtml(m.chemblId) +
      "</a>";

    var targetsHtml = m.targets.map(function (t) {
      return (
        '<div class="target-row"><div><strong>' +
        escapeHtml(t.receptor) +
        '</strong><span class="target-gene">' +
        escapeHtml(t.gene) +
        '</span></div><div class="target-affinity">' +
        escapeHtml(t.metric) + ": " + escapeHtml(t.affinity) +
        "</div><div>" + gradeBadgeHtml(t.grade) + "</div></div>"
      );
    }).join("");

    var claimsHtml = m.claims.map(function (c) {
      return (
        '<div class="dossier-claim-item"><div class="dossier-claim-top">' +
        gradeBadgeHtml(c.grade, c.tierLabel) +
        '<span class="dossier-claim-effect">' + escapeHtml(c.effect) +
        '</span></div><p class="dossier-claim-text">' + escapeHtml(c.claim) +
        '</p><div class="dossier-claim-meta"><span>' + escapeHtml(c.cohort) +
        '</span><a href="' + pubmedUrl(c.pmid) +
        '" target="_blank" rel="noopener noreferrer">PMID: ' + escapeHtml(c.pmid) +
        " ↗</a></div></div>"
      );
    }).join("");

    bodyEl.innerHTML =
      '<div class="dossier-title-row"><div><h2 class="dossier-compound-name">' +
      escapeHtml(m.name) +
      '</h2><p class="dossier-class">' + escapeHtml(m.classLabel) +
      '</p></div><div class="dossier-chem-meta"><div>CAS ' + escapeHtml(m.cas) +
      '</div><div>' + escapeHtml(m.mw) +
      '</div></div></div><div class="pk-mini-grid">' +
      '<div class="pk-cell"><span class="pk-label">Bioavailability</span><span class="pk-val">' + escapeHtml(m.pk.bioavailability) +
      '</span></div><div class="pk-cell"><span class="pk-label">Elimination Half-Life</span><span class="pk-val">' + escapeHtml(m.pk.halfLife) +
      '</span></div><div class="pk-cell"><span class="pk-label">BBB Partitioning</span><span class="pk-val">' + escapeHtml(m.pk.bbb) +
      '</span></div><div class="pk-cell"><span class="pk-label">Clearance / CYP</span><span class="pk-val">' + escapeHtml(m.pk.clearance) +
      '</span></div></div><div class="dossier-subhead"><span>Primary Molecular Targets</span><span>Affinity / Grade</span></div>' +
      '<div class="target-list">' + targetsHtml +
      '</div><div class="dossier-subhead"><span>Graded Outcome Claims</span><span>PubMed Provenance</span></div>' +
      '<div class="dossier-claims-list">' + claimsHtml +
      '</div><div class="dossier-note">' + escapeHtml(m.clinicalNote) + "</div>";
  }

  function clearCompoundDetails() {
    detailRequestId += 1;
    var idsEl = document.getElementById("dossier-ids");
    var bodyEl = document.getElementById("dossier-body");
    var sourceEl = document.getElementById("dossier-source-label");
    if (idsEl) idsEl.innerHTML = "";
    if (sourceEl) sourceEl.textContent = "Record details";
    if (bodyEl) {
      bodyEl.innerHTML =
        '<div class="empty-detail-state"><span class="empty-detail-mark" aria-hidden="true">⌕</span>' +
        '<h2>Select a search result</h2><p>Compound identifiers, chemical properties, or curated pharmacology details will appear here.</p></div>';
    }
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
        sections.push('<div class="catalog-empty-state"><h2>Start with a compound or medicine</h2><p>Type at least two characters to search PubChem and RxNorm. Select a result to see identifiers and available reference data.</p></div>');
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
      updateCatalogStatus(localMatches.length, false);
    });
  }

  function handleCompoundQuery(query) {
    var input = document.getElementById("hero-compound-input");
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
    clearCompoundDetails();

    var localMatches = localMonographMatches(cleanQuery.toLowerCase());
    if (!cleanQuery) {
      renderCatalogResults([], "", false);
      updateCatalogStatus(0, false);
      return;
    }

    if (cleanQuery.length < 2) {
      renderCatalogResults(localMatches, cleanQuery, false);
      updateCatalogStatus(localMatches.length, false);
      return;
    }

    renderCatalogResults(localMatches, cleanQuery, true);
    updateCatalogStatus(localMatches.length, true);
    catalogSearch.timer = window.setTimeout(function () {
      runCatalogSearch(cleanQuery, requestId);
    }, 280);
  }

  function setDetailHeader(source, linksHtml) {
    var sourceEl = document.getElementById("dossier-source-label");
    var idsEl = document.getElementById("dossier-ids");
    if (sourceEl) sourceEl.textContent = source;
    if (idsEl) idsEl.innerHTML = linksHtml || "";
  }

  function showPubChemLoading(item) {
    detailRequestId += 1;
    var bodyEl = document.getElementById("dossier-body");
    setDetailHeader("PubChem compound", "Loading…");
    if (bodyEl) {
      bodyEl.innerHTML = '<div class="empty-detail-state"><span class="catalog-spinner" aria-hidden="true"></span><h2>' +
        escapeHtml(item.name) + '</h2><p>Loading chemical identity and properties from PubChem…</p></div>';
    }
    return detailRequestId;
  }

  function showPubChemError(item, requestId) {
    if (requestId !== detailRequestId) return;
    var bodyEl = document.getElementById("dossier-body");
    setDetailHeader("PubChem compound", "");
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
    var idsHtml = cid
      ? '<a href="' + pubchemUrl(cid) + '" target="_blank" rel="noopener noreferrer">CID:' + escapeHtml(cid) + '</a>'
      : '<span>PubChem record</span>';
    setDetailHeader("PubChem compound", idsHtml);

    function field(label, value, suffix) {
      var text = value == null || value === "" ? "Not listed" : String(value) + (suffix || "");
      return '<div class="pk-cell"><span class="pk-label">' + escapeHtml(label) +
        '</span><span class="pk-val">' + escapeHtml(text) + "</span></div>";
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

  function renderRxNormDetail(item) {
    detailRequestId += 1;
    var rxcui = encodeURIComponent(item.rxcui);
    var apiUrl = "https://rxnav.nlm.nih.gov/REST/rxcui/" + rxcui + "/allProperties.json?prop=all";
    setDetailHeader(
      "RxNorm drug term",
      '<a href="' + apiUrl + '" target="_blank" rel="noopener noreferrer">RxCUI:' + escapeHtml(item.rxcui) + '</a>'
    );
    var bodyEl = document.getElementById("dossier-body");
    if (!bodyEl) return;
    bodyEl.innerHTML =
      '<div class="dossier-title-row"><div><h2 class="dossier-compound-name">' + escapeHtml(item.name) +
      '</h2><p class="dossier-class">Normalized medication term from RxNorm</p></div></div>' +
      '<div class="pk-mini-grid">' +
      '<div class="pk-cell"><span class="pk-label">RxCUI</span><span class="pk-val">' + escapeHtml(item.rxcui) +
      '</span></div><div class="pk-cell"><span class="pk-label">Term type</span><span class="pk-val">' + escapeHtml(rxNormTypeLabel(item.tty)) +
      '</span></div></div>' +
      (item.synonym ? '<div class="external-property-block"><span class="pk-label">Synonym</span><p>' + escapeHtml(item.synonym) + "</p></div>" : "") +
      '<div class="dossier-note">RxNorm normalizes medication names and clinical drug terms, primarily for the U.S. drug vocabulary. It is not a complete historical or worldwide drug list, and this entry alone is not a clinical safety or treatment recommendation.</div>' +
      '<p class="external-record-link"><a href="' + apiUrl + '" target="_blank" rel="noopener noreferrer">View RxNorm API record ↗</a> · ' +
      '<a href="https://pubchem.ncbi.nlm.nih.gov/#query=' + encodeURIComponent(item.name) + '" target="_blank" rel="noopener noreferrer">Search chemical identity on PubChem ↗</a></p>';
  }

  function initCompoundSearch() {
    var input = document.getElementById("hero-compound-input");
    var clearButton = document.getElementById("clear-compound-search");
    var results = document.getElementById("catalog-results");
    var chips = document.getElementById("hero-compound-chips");
    if (!input || !results) return;

    renderHeroChips();
    renderCatalogResults([], "", false);
    updateCatalogStatus(0, false);

    input.addEventListener("input", function () {
      handleCompoundQuery(input.value);
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
        renderDossier(monograph.id);
      });
    }

    results.addEventListener("click", function (event) {
      var button = event.target.closest("[data-result-source]");
      if (!button) return;
      results.querySelectorAll(".catalog-result").forEach(function (resultButton) {
        resultButton.classList.remove("is-selected");
        resultButton.setAttribute("aria-pressed", "false");
      });
      button.classList.add("is-selected");
      button.setAttribute("aria-pressed", "true");

      var source = button.getAttribute("data-result-source");
      if (source === "local") {
        renderDossier(button.getAttribute("data-result-id"));
      } else if (source === "pubchem") {
        var pubchemItem = catalogSearch.pubchem[parseInt(button.getAttribute("data-result-index"), 10)];
        if (pubchemItem) loadPubChemDetail(pubchemItem);
      } else if (source === "rxnorm") {
        var rxnormItem = catalogSearch.rxnorm[parseInt(button.getAttribute("data-result-index"), 10)];
        if (rxnormItem) renderRxNormDetail(rxnormItem);
      }
    });
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
  var stackState = {
    presetId: DATA.stackChecker.presets[0].id,
    activeCompounds: DATA.stackChecker.presets[0].activeCompounds.slice(),
    focusedEdgeId: null,
    focusedNodeId: null
  };

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
          if (stackState.activeCompounds.length === 1) {
            showToast("Keep at least 1 active compound in the stack graph.");
            return;
          }
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

  function computeActiveSubgraph() {
    var activeIds = stackState.activeCompounds;
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

  function evaluateStackRisk(subgraph) {
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
    var activeSet = stackState.activeCompounds;
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
      titleEl.textContent = "Elevated Interaction Signal";
    } else if (maxScore >= 42 || result.matchedRules.some(function (r) { return r.severity === "moderate"; })) {
      banner.classList.add("level-moderate");
      titleEl.textContent = "Moderate Pathway Overlap";
    } else {
      banner.classList.add("level-low");
      titleEl.textContent = "Low Collision Signal";
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
        var bandWord = val >= 70 ? "Elevated" : val >= 40 ? "Moderate" : val > 0 ? "Watch / Low" : "Baseline";
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
        '<div class="finding-card sev-favorable">' +
        '<div class="finding-kicker"><span>NO MAJOR COLLISION FLAGS</span><span>PK/PD AUDIT</span></div>' +
        '<h4 class="finding-title">No High-Severity Shared Enzymatic or Serotonergic Bottlenecks Detected</h4>' +
        '<p class="finding-detail">Active agents distribute across non-overlapping primary clearance and receptor pathways in the current reference index.</p>' +
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
  var STORAGE_KEY = "pharmapedia_protocol_log_v1";

  var defaultProtocolEntries = [
    { name: "Rosuvastatin", dose: "10 mg", schedule: "PM Dinner", washout: "~95 h (5x t½)" },
    { name: "Metformin XR", dose: "1000 mg", schedule: "PM Dinner", washout: "~31 h plasma" },
    { name: "Ubiquinol (CoQ10)", dose: "200 mg", schedule: "AM With Meal", washout: "~165 h (5x t½)" }
  ];

  function loadProtocolEntries() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
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
      "# Pharmapedia Clinical Regimen & Interaction Brief",
      "Generated locally via Pharmapedia Open-Source Library (v" + DATA.meta.version + ")",
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
        triggerDownload("pharmapedia-clinical-brief.md", "text/markdown;charset=utf-8", md);
        showToast("Downloaded pharmapedia-clinical-brief.md");
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
    initStudyLedger();
    updateAllStackViews();
    updateBrainAtlas();
    renderEvidenceTiers();
    renderTranslationComparator();
    initProtocolActions();
  });
})();
