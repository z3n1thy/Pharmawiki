/* ==========================================================================
   Pharmapedia Federated Clinical Pharmacology Workbench (app.js)
   100% Client-Side Static JS · Live Queries Across PubChem (118M+), ChEMBL,
   OpenFDA SPL Drug Labels, and NCBI PubMed E-Utilities (37M+ Studies)
   ========================================================================== */

(function () {
  "use strict";

  var CURATED = window.PHARMAPEDIA_DATA || { monographs: [], studyClaims: [], brainAtlas: { systems: [], regions: [] }, evidenceGrading: { tiers: [], cases: [] } };
  var CATALOG_RAW = window.PHARMAPEDIA_CATALOG || { categories: [], items: [] };

  /* ------------------------------------------------------------------------
     1. Expand Built-In 267+ Compound Directory & Botanical Marker Map
     ------------------------------------------------------------------------ */
  var BOTANICAL_MARKER_MAP = {
    "ashwagandha": "Withaferin A",
    "bacopa monnieri": "Bacoside A",
    "rhodiola rosea": "Salidroside",
    "ginkgo biloba": "Ginkgolide B",
    "panax ginseng": "Ginsenoside Rg1",
    "st. john's wort": "Hyperforin",
    "hypericum perforatum": "Hyperforin",
    "kratom": "Mitragynine",
    "green tea extract": "Epigallocatechin gallate",
    "egcg": "Epigallocatechin gallate",
    "turmeric": "Curcumin",
    "omega-3 epa": "Icosapent ethyl",
    "fish oil": "Icosapent ethyl",
    "5-htp": "5-Hydroxytryptophan",
    "alpha-gpc": "Choline alfoscerate",
    "cdp-choline": "Citicoline"
  };

  var CATALOG = CATALOG_RAW.items.map(function (tuple, idx) {
    var name = tuple[0];
    var cat = tuple[1];
    var cls = tuple[2];
    var aliases = tuple[3]
      ? tuple[3].split(",").map(function (s) { return s.trim(); }).filter(Boolean)
      : [];
    var tags = tuple[4] || [];
    return {
      id: "cat-" + idx,
      name: name,
      nameLower: name.toLowerCase(),
      category: cat,
      classSummary: cls,
      aliases: aliases,
      aliasesLower: aliases.map(function (a) { return a.toLowerCase(); }),
      tags: tags
    };
  });

  function findCatalogEntry(nameOrAlias) {
    if (!nameOrAlias) return null;
    var q = String(nameOrAlias).trim().toLowerCase();
    var exact = CATALOG.find(function (c) { return c.nameLower === q; });
    if (exact) return exact;
    return CATALOG.find(function (c) { return c.aliasesLower.indexOf(q) !== -1; }) || null;
  }

  function findCuratedMonograph(nameOrAlias) {
    if (!nameOrAlias) return null;
    var q = String(nameOrAlias).trim().toLowerCase();
    return CURATED.monographs.find(function (m) {
      if (m.name.toLowerCase() === q || m.id.toLowerCase() === q) return true;
      if (m.name.toLowerCase().indexOf(q) === 0 || q.indexOf(m.name.toLowerCase()) === 0) return true;
      return (m.aliases || []).some(function (a) { return a.toLowerCase() === q; });
    }) || null;
  }

  /* ------------------------------------------------------------------------
     2. Utility Helpers & Polite Rate-Limited NCBI Queue
     ------------------------------------------------------------------------ */
  function escapeHtml(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function truncateClean(text, maxChars) {
    if (!text) return "";
    var clean = String(text).replace(/\s+/g, " ").trim();
    if (clean.length <= maxChars) return clean;
    return clean.slice(0, maxChars).replace(/\s+\S*$/, "") + "…";
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

  function gradeBadgeHtml(grade, extra) {
    var g = escapeHtml(grade || "E");
    var suffix = extra ? " · " + escapeHtml(extra) : "";
    return '<span class="grade-pill grade-' + g + '">Grade ' + g + suffix + "</span>";
  }

  var toastTimer = null;
  function showToast(msg) {
    var el = document.getElementById("clinical-toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.add("is-visible");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.classList.remove("is-visible");
    }, 2800);
  }

  // Polite NCBI E-utilities spacing queue (max ~2.6 req/sec to avoid HTTP 429)
  var ncbiLastCallTs = 0;
  var ncbiGate = Promise.resolve();
  function fetchNcbiJson(url, signal) {
    var ticket = ncbiGate.then(function () {
      if (signal && signal.aborted) return;
      var now = Date.now();
      var wait = Math.max(0, 380 - (now - ncbiLastCallTs));
      return new Promise(function (resolve) {
        setTimeout(function () {
          ncbiLastCallTs = Date.now();
          resolve();
        }, wait);
      });
    });
    ncbiGate = ticket.catch(function () {});

    return ticket.then(function () {
      if (signal && signal.aborted) {
        var err = new Error("Aborted");
        err.name = "AbortError";
        throw err;
      }
      return fetch(url, { signal: signal }).then(function (res) {
        if (!res.ok) throw new Error("NCBI HTTP " + res.status);
        return res.json();
      });
    });
  }

  function fetchJsonWithTimeout(url, signal, timeoutMs) {
    var ms = timeoutMs || 9000;
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () {
        reject(new Error("Timeout"));
      }, ms);
      fetch(url, { signal: signal })
        .then(function (res) {
          clearTimeout(timer);
          if (!res.ok) throw new Error("HTTP " + res.status);
          return res.json();
        })
        .then(resolve)
        .catch(function (err) {
          clearTimeout(timer);
          reject(err);
        });
    });
  }

  /* ------------------------------------------------------------------------
     3. Federated API Adapters (PubChem, ChEMBL, OpenFDA, PubMed)
     ------------------------------------------------------------------------ */
  var dossierCache = new Map();

  function extractPugViewSections(node, out) {
    if (!node) return;
    var heading = node.TOCHeading || "";
    if (node.Information && Array.isArray(node.Information)) {
      var texts = [];
      node.Information.forEach(function (info) {
        if (info.Value && Array.isArray(info.Value.StringWithMarkup)) {
          info.Value.StringWithMarkup.forEach(function (swm) {
            if (swm.String && swm.String.length > 25) texts.push(swm.String);
          });
        }
      });
      if (texts.length > 0 && heading) {
        out[heading] = (out[heading] ? out[heading] + "\n\n" : "") + texts.slice(0, 3).join("\n\n");
      }
    }
    if (Array.isArray(node.Section)) {
      node.Section.forEach(function (child) {
        extractPugViewSections(child, out);
      });
    }
  }

  function fetchPubChemBundle(queryName, signal) {
    var lower = queryName.trim().toLowerCase();
    var chemLookupName = BOTANICAL_MARKER_MAP[lower] || queryName.trim();
    var isNumericCid = /^\d+$/.test(chemLookupName);
    var propFields = "MolecularFormula,MolecularWeight,IUPACName,InChIKey,XLogP,TPSA,HBondDonorCount,HBondAcceptorCount,RotatableBondCount,CanonicalSMILES";
    var propUrl = isNumericCid
      ? "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/" + encodeURIComponent(chemLookupName) + "/property/" + propFields + "/JSON"
      : "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/" + encodeURIComponent(chemLookupName) + "/property/" + propFields + "/JSON";

    return fetchJsonWithTimeout(propUrl, signal, 8500).then(function (propJson) {
      var props = propJson && propJson.PropertyTable && propJson.PropertyTable.Properties && propJson.PropertyTable.Properties[0];
      if (!props || !props.CID) throw new Error("No PubChem CID");
      var cid = props.CID;
      var markerNote = BOTANICAL_MARKER_MAP[lower] ? BOTANICAL_MARKER_MAP[lower] : null;

      var synPromise = fetchJsonWithTimeout(
        "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/" + cid + "/synonyms/JSON",
        signal,
        6500
      ).catch(function () { return null; });

      var pugViewPromise = fetchJsonWithTimeout(
        "https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/" + cid + "/JSON?heading=Pharmacology+and+Biochemistry",
        signal,
        8500
      ).catch(function () { return null; });

      return Promise.all([synPromise, pugViewPromise]).then(function (pair) {
        var synJson = pair[0];
        var pvJson = pair[1];
        var synonyms = [];
        if (synJson && synJson.InformationList && synJson.InformationList.Information && synJson.InformationList.Information[0]) {
          synonyms = (synJson.InformationList.Information[0].Synonym || [])
            .filter(function (s) {
              return s.length <= 36 && !/^\d/.test(s) && !/^[A-Z0-9-]{12,}$/.test(s) && s.indexOf("CHEMBL") === -1 && s.indexOf("DTXSID") === -1;
            })
            .slice(0, 8);
        }
        var sections = {};
        if (pvJson && pvJson.Record) {
          extractPugViewSections(pvJson.Record, sections);
        }
        return {
          cid: cid,
          markerMolecule: markerNote,
          props: props,
          synonyms: synonyms,
          sections: sections
        };
      });
    });
  }

  function fetchChemblBundle(queryName, inchiKeyPromise, signal) {
    var lower = queryName.trim().toLowerCase();
    var lookupTerm = BOTANICAL_MARKER_MAP[lower] || queryName.trim();
    var isDirectChembl = /^chembl\d+$/i.test(lookupTerm);

    var molPromise;
    if (isDirectChembl) {
      molPromise = fetchJsonWithTimeout(
        "https://www.ebi.ac.uk/chembl/api/data/molecule/" + encodeURIComponent(lookupTerm.toUpperCase()) + ".json",
        signal,
        8500
      );
    } else {
      molPromise = inchiKeyPromise
        .then(function (ik) {
          if (!ik) throw new Error("No IK");
          return fetchJsonWithTimeout(
            "https://www.ebi.ac.uk/chembl/api/data/molecule.json?molecule_structures__standard_inchi_key=" + encodeURIComponent(ik),
            signal,
            7500
          ).then(function (res) {
            if (res && res.molecules && res.molecules.length > 0) return res.molecules[0];
            throw new Error("IK miss");
          });
        })
        .catch(function () {
          return fetchJsonWithTimeout(
            "https://www.ebi.ac.uk/chembl/api/data/molecule/search.json?q=" + encodeURIComponent(lookupTerm) + "&limit=5",
            signal,
            8500
          ).then(function (res) {
            var mols = (res && res.molecules) || [];
            if (mols.length === 0) throw new Error("ChEMBL miss");
            var exact = mols.find(function (m) {
              return m.pref_name && m.pref_name.toLowerCase() === lookupTerm.toLowerCase();
            });
            return exact || mols[0];
          });
        });
    }

    return molPromise.then(function (mol) {
      var chemblId = mol.molecule_chembl_id;
      var mechPromise = fetchJsonWithTimeout(
        "https://www.ebi.ac.uk/chembl/api/data/mechanism.json?molecule_chembl_id=" + encodeURIComponent(chemblId) + "&limit=20",
        signal,
        8000
      ).catch(function () { return { mechanisms: [] }; });

      var actPromise = fetchJsonWithTimeout(
        "https://www.ebi.ac.uk/chembl/api/data/activity.json?molecule_chembl_id=" +
          encodeURIComponent(chemblId) +
          "&target_organism=Homo%20sapiens&pchembl_value__isnull=false&limit=30",
        signal,
        8500
      ).catch(function () { return { activities: [] }; });

      return Promise.all([mechPromise, actPromise]).then(function (resPair) {
        return {
          molecule: mol,
          mechanisms: (resPair[0] && resPair[0].mechanisms) || [],
          activities: (resPair[1] && resPair[1].activities) || []
        };
      });
    });
  }

  function fetchOpenFdaBundle(queryName, signal) {
    var clean = queryName.trim().replace(/["()]/g, "");
    var catEntry = findCatalogEntry(clean);
    var canonical = catEntry ? catEntry.name : clean;
    var q =
      '(openfda.generic_name:"' +
      encodeURIComponent(canonical) +
      '"+openfda.brand_name:"' +
      encodeURIComponent(clean) +
      '"+openfda.substance_name:"' +
      encodeURIComponent(canonical) +
      '")';
    var url = "https://api.fda.gov/drug/label.json?search=" + q + "&limit=1";
    return fetchJsonWithTimeout(url, signal, 8000).then(function (json) {
      var hit = json && json.results && json.results[0];
      if (!hit) throw new Error("No FDA label");
      return hit;
    });
  }

  function classifyPubMedRecord(rec) {
    var types = (rec.pubtype || []).map(function (t) { return t.toLowerCase(); });
    var title = String(rec.title || "").toLowerCase();

    var isRctOrMeta = types.some(function (t) {
      return (
        t.indexOf("randomized controlled trial") !== -1 ||
        t.indexOf("meta-analysis") !== -1 ||
        t.indexOf("clinical trial, phase iii") !== -1 ||
        t.indexOf("clinical trial, phase ii") !== -1 ||
        t.indexOf("controlled clinical trial") !== -1 ||
        t.indexOf("systematic review") !== -1
      );
    });
    if (isRctOrMeta) {
      var labelA = types.some(function (t) { return t.indexOf("meta-analysis") !== -1; })
        ? "Meta-Analysis"
        : types.some(function (t) { return t.indexOf("randomized") !== -1; })
        ? "Human RCT"
        : "Clinical Trial";
      return { grade: "A", label: labelA };
    }

    var isInVitro =
      /\b(in vitro|cell line|cultured cells|hek293|sh-sy5y|hela|organoid|microsomal|recombinant)\b/i.test(title);
    if (isInVitro) {
      return { grade: "D", label: "In Vitro / Cell" };
    }

    var isAnimal =
      /\b(mice|mouse|murine|rats|rat model|zebrafish|drosophila|canine|nonhuman primate|rodent|c57bl)\b/i.test(title);
    if (isAnimal) {
      return { grade: "C", label: "Animal In Vivo" };
    }

    var isInSilico =
      /\b(in silico|molecular docking|molecular dynamics|qsar|network pharmacology)\b/i.test(title);
    if (isInSilico) {
      return { grade: "E", label: "In Silico" };
    }

    var isHumanObs =
      types.some(function (t) {
        return (
          t.indexOf("observational") !== -1 ||
          t.indexOf("clinical trial") !== -1 ||
          t.indexOf("multicenter study") !== -1 ||
          t.indexOf("comparative study") !== -1 ||
          t.indexOf("case reports") !== -1
        );
      }) ||
      /\b(cohort|patients|adults|retrospective|prospective|nationwide|registry|mendelian randomization|case-control)\b/i.test(title);
    if (isHumanObs) {
      return { grade: "B", label: "Human Cohort / Clinical" };
    }

    if (types.some(function (t) { return t.indexOf("review") !== -1; })) {
      return { grade: "E", label: "Literature Review" };
    }

    return { grade: "B", label: "Biomedical Study" };
  }

  function fetchPubMedBundle(compoundName, endpointFilter, tierRestriction, signal) {
    var baseTerm = '"' + compoundName.replace(/"/g, "") + '"[Title/Abstract]';
    if (endpointFilter && endpointFilter.trim()) {
      baseTerm += " AND (" + endpointFilter.trim() + ")";
    }

    var searchTerm = baseTerm;
    if (tierRestriction === "A") {
      searchTerm += " AND (randomized controlled trial[pt] OR meta-analysis[pt] OR systematic review[pt])";
    } else if (tierRestriction === "B") {
      searchTerm += " AND (observational study[pt] OR cohort studies[mh] OR case-control studies[mh])";
    } else if (tierRestriction === "C") {
      searchTerm += " AND (animals[mh] NOT humans[mh])";
    } else if (tierRestriction === "D") {
      searchTerm += ' AND ("in vitro techniques"[mh] OR "cells, cultured"[mh])';
    }

    var esearchUrl =
      "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json&sort=relevance&retmax=20&term=" +
      encodeURIComponent(searchTerm);

    return fetchNcbiJson(esearchUrl, signal).then(function (sJson) {
      var idList = (sJson && sJson.esearchresult && sJson.esearchresult.idlist) || [];
      var totalCount = parseInt((sJson && sJson.esearchresult && sJson.esearchresult.count) || "0", 10);
      if (idList.length === 0) {
        return { total: totalCount, papers: [], tierCounts: null };
      }

      var esumUrl =
        "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id=" +
        idList.join(",");

      return fetchNcbiJson(esumUrl, signal).then(function (sumJson) {
        var resultObj = (sumJson && sumJson.result) || {};
        var papers = idList
          .map(function (id) {
            var item = resultObj[id];
            if (!item || !item.title) return null;
            var cls = classifyPubMedRecord(item);
            var firstAuthor =
              item.authors && item.authors[0] && item.authors[0].name
                ? item.authors[0].name + (item.authors.length > 1 ? " et al." : "")
                : "PubMed Indexed";
            return {
              pmid: id,
              title: item.title.replace(/\[|\]/g, ""),
              journal: item.fulljournalname || item.source || "Biomedical Journal",
              pubdate: (item.pubdate || "").slice(0, 4) || item.pubdate || "",
              author: firstAuthor,
              grade: tierRestriction && tierRestriction !== "all" ? tierRestriction : cls.grade,
              tierLabel: cls.label
            };
          })
          .filter(Boolean);

        return { total: totalCount, papers: papers };
      });
    });
  }

  function fetchPubMedTierCounts(compoundName, signal) {
    var base = '"' + compoundName.replace(/"/g, "") + '"[Title/Abstract]';
    var queries = [
      { key: "A", q: base + " AND (randomized controlled trial[pt] OR meta-analysis[pt])" },
      { key: "B", q: base + " AND (observational study[pt] OR cohort studies[mh])" },
      { key: "C", q: base + " AND (animals[mh] NOT humans[mh])" },
      { key: "D", q: base + ' AND ("in vitro techniques"[mh] OR "cells, cultured"[mh])' }
    ];

    var counts = { A: 0, B: 0, C: 0, D: 0 };
    return queries
      .reduce(function (chain, item) {
        return chain.then(function () {
          var url =
            "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json&rettype=count&term=" +
            encodeURIComponent(item.q);
          return fetchNcbiJson(url, signal)
            .then(function (res) {
              counts[item.key] = parseInt((res && res.esearchresult && res.esearchresult.count) || "0", 10);
            })
            .catch(function () {});
        });
      }, Promise.resolve())
      .then(function () {
        return counts;
      });
  }

  /* ------------------------------------------------------------------------
     4. CNS Multiparameter Optimization (CNS MPO) & BBB Estimator
     ------------------------------------------------------------------------ */
  function monotonicScore(val, low, high) {
    if (val == null || isNaN(val)) return 0.5;
    if (val <= low) return 1.0;
    if (val >= high) return 0.0;
    return (high - val) / (high - low);
  }

  function humpScore(val, minOpt, maxOpt, outerLow, outerHigh) {
    if (val == null || isNaN(val)) return 0.5;
    if (val >= minOpt && val <= maxOpt) return 1.0;
    if (val < minOpt) {
      if (val <= outerLow) return 0.0;
      return (val - outerLow) / (minOpt - outerLow);
    }
    if (val >= outerHigh) return 0.0;
    return (outerHigh - val) / (outerHigh - maxOpt);
  }

  function computeBbbProfile(compoundName, pubchemProps, chemblMol, curatedEntry, catEntry) {
    // Biologic / Peptide check
    var mw = pubchemProps && pubchemProps.MolecularWeight ? parseFloat(pubchemProps.MolecularWeight) : null;
    var molType = chemblMol && chemblMol.molecule_type ? chemblMol.molecule_type : "";

    if ((mw && mw > 1100) || /Antibody|Protein|Enzyme|Oligonucleotide/i.test(molType)) {
      return {
        score: 0.6,
        verdict: "Restricted Parenchymal BBB (Macromolecule / Peptide)",
        detail:
          (curatedEntry && curatedEntry.pk && curatedEntry.pk.bbb) ||
          "Molecular mass (>1,000 Da) restricts passive tight-junction blood-brain barrier diffusion; central actions, if any, rely on circumventricular organs (area postrema / median eminence) or receptor-mediated transcytosis."
      };
    }

    if (!pubchemProps || mw == null) {
      return {
        score: curatedEntry ? 4.2 : 3.0,
        verdict: (curatedEntry && curatedEntry.pk && curatedEntry.pk.bbb) || "Pending Physicochemical Coordinates",
        detail: "Select or resolve small-molecule coordinates to compute Wager CNS Multiparameter Optimization (MPO) BBB partitioning."
      };
    }

    var xlogp = pubchemProps.XLogP != null ? parseFloat(pubchemProps.XLogP) : 2.2;
    var tpsa = pubchemProps.TPSA != null ? parseFloat(pubchemProps.TPSA) : 65;
    var hbd = pubchemProps.HBondDonorCount != null ? parseFloat(pubchemProps.HBondDonorCount) : 1;

    // 6-point scaled CNS MPO approximation
    var sMw = monotonicScore(mw, 360, 500);
    var sLogP = monotonicScore(xlogp, 3.0, 5.0);
    var sTpsa = humpScore(tpsa, 20, 90, 0, 120);
    var sHbd = monotonicScore(hbd, 0.5, 3.5);
    var sLipid = xlogp >= 0.5 && xlogp <= 4.2 ? 1.0 : xlogp < -0.5 ? 0.2 : 0.6;
    var sFlex = monotonicScore(parseFloat(pubchemProps.RotatableBondCount || 4), 5, 10);

    var mpo = Math.round((sMw + sLogP + sTpsa + sHbd + sLipid + sFlex) * 10) / 10;

    // Known P-gp peripheral efflux exclusion check
    var isPgpExcluded =
      catEntry &&
      catEntry.tags.indexOf("Pgp:sub") !== -1 &&
      /loperamide|fexofenadine|domperidone/i.test(compoundName);

    if (isPgpExcluded) {
      return {
        score: 1.8,
        verdict: "Actively Effluxed at BBB (P-gp / ABCB1 Substrate)",
        detail:
          "Despite moderate lipophilicity, endothelial P-glycoprotein (ABCB1) actively pumps this molecule out of brain parenchyma into capillary lumen—preventing central CNS effects at standard doses."
      };
    }

    var verdict =
      mpo >= 4.2
        ? "High Passive BBB Penetration Likely (CNS-Active Space)"
        : mpo >= 2.8
        ? "Moderate / Regulated CNS Partitioning"
        : "Low Passive BBB Permeability (Polar / High-TPSA)";

    if (curatedEntry && curatedEntry.pk && curatedEntry.pk.bbb) {
      verdict = curatedEntry.pk.bbb;
    }

    var detail =
      "Computed CNS MPO: " +
      mpo.toFixed(1) +
      " / 6.0 (MW " +
      mw.toFixed(1) +
      " Da · TPSA " +
      tpsa.toFixed(1) +
      " Å² · XLogP " +
      (pubchemProps.XLogP != null ? xlogp : "N/A") +
      " · HBD " +
      hbd +
      "). Molecules with MPO ≥ 4.0 and TPSA < 90 Å² typically achieve high unbound brain-to-plasma partitioning.";

    return { score: mpo, verdict: verdict, detail: detail };
  }

  /* ------------------------------------------------------------------------
     5. View Switching & Recent Queries State
     ------------------------------------------------------------------------ */
  var activeView = "explorer";
  var recentCompounds = ["Semaglutide", "Escitalopram", "Warfarin", "Caffeine", "Sirolimus", "Atorvastatin"];

  function switchView(viewName) {
    activeView = viewName;
    document.querySelectorAll(".mode-tab-btn").forEach(function (btn) {
      var isAct = btn.getAttribute("data-view") === viewName;
      btn.classList.toggle("is-active", isAct);
      btn.setAttribute("aria-selected", isAct ? "true" : "false");
    });

    document.querySelectorAll(".workspace-view").forEach(function (sec) {
      sec.classList.toggle("is-active", sec.id === "view-" + viewName);
    });
  }

  function pushRecentCompound(name) {
    var clean = String(name).trim();
    if (!clean) return;
    recentCompounds = [clean].concat(
      recentCompounds.filter(function (c) { return c.toLowerCase() !== clean.toLowerCase(); })
    ).slice(0, 7);
    renderRecentChips();
  }

  function renderRecentChips() {
    var bar = document.getElementById("recent-queries-bar");
    if (!bar) return;
    bar.innerHTML =
      "<span>Recent:</span>" +
      recentCompounds
        .map(function (name) {
          return (
            '<button type="button" class="recent-chip" data-recent="' +
            escapeHtml(name) +
            '">' +
            escapeHtml(name) +
            "</button>"
          );
        })
        .join("");

    bar.querySelectorAll(".recent-chip").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var target = btn.getAttribute("data-recent");
        switchView("explorer");
        loadCompoundDossier(target);
      });
    });
  }

  /* ------------------------------------------------------------------------
     6. Sidebar Directory & Federated Omnibox Autocomplete
     ------------------------------------------------------------------------ */
  var activeCompoundName = "Semaglutide";
  var sidebarFilterState = { query: "", category: "all" };

  function initSidebarDirectory() {
    var catSelect = document.getElementById("sidebar-category-select");
    var filterInput = document.getElementById("sidebar-filter-input");
    if (catSelect) {
      catSelect.innerHTML = CATALOG_RAW.categories
        .map(function (c) {
          var cnt =
            c.id === "all"
              ? CATALOG.length
              : CATALOG.filter(function (item) { return item.category === c.id; }).length;
          return '<option value="' + escapeHtml(c.id) + '">' + escapeHtml(c.label) + " (" + cnt + ")</option>";
        })
        .join("");

      catSelect.addEventListener("change", function () {
        sidebarFilterState.category = catSelect.value;
        renderDirectoryList();
      });
    }

    if (filterInput) {
      filterInput.addEventListener("input", function () {
        sidebarFilterState.query = filterInput.value;
        renderDirectoryList();
      });
      filterInput.addEventListener("keydown", function (ev) {
        if (ev.key === "Enter" && filterInput.value.trim()) {
          ev.preventDefault();
          loadCompoundDossier(filterInput.value.trim());
        }
      });
    }

    renderDirectoryList();
  }

  function renderDirectoryList() {
    var listEl = document.getElementById("directory-list");
    var countEl = document.getElementById("directory-count-label");
    if (!listEl) return;

    var q = sidebarFilterState.query.trim().toLowerCase();
    var filtered = CATALOG.filter(function (item) {
      if (sidebarFilterState.category !== "all" && item.category !== sidebarFilterState.category) return false;
      if (!q) return true;
      return (
        item.nameLower.indexOf(q) !== -1 ||
        item.classSummary.toLowerCase().indexOf(q) !== -1 ||
        item.aliasesLower.some(function (a) { return a.indexOf(q) !== -1; })
      );
    });

    if (countEl) {
      countEl.textContent = filtered.length + " Listed · 118M Live";
    }

    var globalTriggerHtml = "";
    if (q.length >= 2) {
      globalTriggerHtml =
        '<button type="button" class="dir-item-btn" data-lookup-global="' +
        escapeHtml(sidebarFilterState.query.trim()) +
        '" style="background: rgba(70,102,160,0.14); border-bottom: 1px solid var(--action-blue);">' +
        '<div class="dir-item-top"><span class="dir-item-name">Query Global Index: “' +
        escapeHtml(sidebarFilterState.query.trim()) +
        '” →</span></div>' +
        '<span class="dir-item-class">Search 118M+ PubChem · ChEMBL · OpenFDA · PubMed</span>' +
        "</button>";
    }

    listEl.innerHTML =
      globalTriggerHtml +
      filtered
        .map(function (item) {
          var isAct = item.nameLower === activeCompoundName.toLowerCase();
          return (
            '<button type="button" class="dir-item-btn' +
            (isAct ? " is-active" : "") +
            '" data-compound="' +
            escapeHtml(item.name) +
            '">' +
            '<div class="dir-item-top">' +
            '<span class="dir-item-name">' +
            escapeHtml(item.name) +
            "</span>" +
            '<span class="dir-item-alias">' +
            escapeHtml(item.aliases.slice(0, 2).join(", ")) +
            "</span>" +
            "</div>" +
            '<span class="dir-item-class">' +
            escapeHtml(item.classSummary) +
            "</span>" +
            "</button>"
          );
        })
        .join("");

    listEl.querySelectorAll("[data-compound]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        loadCompoundDossier(btn.getAttribute("data-compound"));
      });
    });

    var globalBtn = listEl.querySelector("[data-lookup-global]");
    if (globalBtn) {
      globalBtn.addEventListener("click", function () {
        loadCompoundDossier(globalBtn.getAttribute("data-lookup-global"));
      });
    }
  }

  function attachAutocomplete(inputEl, dropdownEl, onSelectCallback) {
    if (!inputEl || !dropdownEl) return;
    var debounceTimer = null;
    var acAbort = null;
    var highlightedIdx = -1;
    var currentItems = [];

    function closeDropdown() {
      dropdownEl.classList.remove("is-open");
      dropdownEl.innerHTML = "";
      currentItems = [];
      highlightedIdx = -1;
    }

    function renderSuggestions(query, pubchemTerms) {
      var qLow = query.toLowerCase();
      var localMatches = CATALOG.filter(function (c) {
        return (
          c.nameLower.indexOf(qLow) !== -1 ||
          c.aliasesLower.some(function (a) { return a.indexOf(qLow) !== -1; })
        );
      }).slice(0, 6);

      var seen = {};
      localMatches.forEach(function (m) { seen[m.nameLower] = true; });

      var remoteMatches = (pubchemTerms || [])
        .filter(function (term) {
          var tLow = String(term).toLowerCase();
          if (seen[tLow]) return false;
          seen[tLow] = true;
          return true;
        })
        .slice(0, 8);

      currentItems = [];
      var html = "";

      if (localMatches.length > 0) {
        html += '<div class="ac-section-label">Clinical Directory</div>';
        localMatches.forEach(function (m) {
          var idx = currentItems.length;
          currentItems.push(m.name);
          html +=
            '<button type="button" class="ac-item" data-ac-idx="' +
            idx +
            '">' +
            "<div><span class=\"ac-item-name\">" +
            escapeHtml(m.name) +
            (m.aliases.length ? " (" + escapeHtml(m.aliases.slice(0, 2).join(", ")) + ")" : "") +
            '</span><span class="ac-item-sub">' +
            escapeHtml(m.classSummary) +
            "</span></div>" +
            '<span class="ac-source-tag">INDEXED</span>' +
            "</button>";
        });
      }

      if (remoteMatches.length > 0) {
        html += '<div class="ac-section-label">PubChem / Global 118M+ Dictionary</div>';
        remoteMatches.forEach(function (term) {
          var idx = currentItems.length;
          currentItems.push(term);
          html +=
            '<button type="button" class="ac-item" data-ac-idx="' +
            idx +
            '">' +
            '<div><span class="ac-item-name">' +
            escapeHtml(term) +
            '</span><span class="ac-item-sub">Live Federated Chemical / Drug Entity</span></div>' +
            '<span class="ac-source-tag">PUBCHEM</span>' +
            "</button>";
        });
      }

      if (currentItems.length === 0) {
        var idxDirect = 0;
        currentItems.push(query);
        html +=
          '<button type="button" class="ac-item" data-ac-idx="' +
          idxDirect +
          '">' +
          '<div><span class="ac-item-name">Lookup “' +
          escapeHtml(query) +
          '” directly</span><span class="ac-item-sub">Query PubChem, ChEMBL, OpenFDA &amp; PubMed</span></div>' +
          '<span class="ac-source-tag">LIVE</span>' +
          "</button>";
      }

      dropdownEl.innerHTML = html;
      dropdownEl.classList.add("is-open");
      highlightedIdx = -1;

      dropdownEl.querySelectorAll(".ac-item").forEach(function (btn) {
        btn.addEventListener("mousedown", function (ev) {
          ev.preventDefault();
          var pick = currentItems[parseInt(btn.getAttribute("data-ac-idx"), 10)];
          closeDropdown();
          onSelectCallback(pick);
        });
      });
    }

    inputEl.addEventListener("input", function () {
      var val = inputEl.value.trim();
      if (debounceTimer) clearTimeout(debounceTimer);
      if (acAbort) acAbort.abort();
      if (val.length < 2) {
        closeDropdown();
        return;
      }

      // Render instant local matches first
      renderSuggestions(val, []);

      debounceTimer = setTimeout(function () {
        acAbort = new AbortController();
        var url =
          "https://pubchem.ncbi.nlm.nih.gov/rest/autocomplete/compound/" +
          encodeURIComponent(val) +
          "/json?limit=10";
        fetch(url, { signal: acAbort.signal })
          .then(function (r) { return r.json(); })
          .then(function (j) {
            var terms = (j && j.dictionary_terms && j.dictionary_terms.compound) || [];
            if (inputEl.value.trim() === val) {
              renderSuggestions(val, terms);
            }
          })
          .catch(function () {});
      }, 170);
    });

    inputEl.addEventListener("keydown", function (ev) {
      if (!dropdownEl.classList.contains("is-open") || currentItems.length === 0) return;
      if (ev.key === "ArrowDown") {
        ev.preventDefault();
        highlightedIdx = (highlightedIdx + 1) % currentItems.length;
        updateHighlight();
      } else if (ev.key === "ArrowUp") {
        ev.preventDefault();
        highlightedIdx = (highlightedIdx - 1 + currentItems.length) % currentItems.length;
        updateHighlight();
      } else if (ev.key === "Enter" && highlightedIdx >= 0) {
        ev.preventDefault();
        var picked = currentItems[highlightedIdx];
        closeDropdown();
        onSelectCallback(picked);
      } else if (ev.key === "Escape") {
        closeDropdown();
      }
    });

    function updateHighlight() {
      dropdownEl.querySelectorAll(".ac-item").forEach(function (el, i) {
        el.classList.toggle("is-highlighted", i === highlightedIdx);
      });
    }

    inputEl.addEventListener("blur", function () {
      setTimeout(closeDropdown, 180);
    });
  }

  /* ------------------------------------------------------------------------
     7. Main Multi-Source Compound Dossier Loader & Renderer
     ------------------------------------------------------------------------ */
  var activeDossierAbort = null;
  var currentDossierState = {
    name: "Semaglutide",
    pubchem: null,
    chembl: null,
    fda: null,
    pubmed: null,
    tierCounts: null,
    selectedTier: "all",
    endpointQuery: "",
    telemetry: { pubchem: "loading", chembl: "loading", fda: "loading", pubmed: "loading" }
  };

  function updateTelemetryBar() {
    var el = document.getElementById("dossier-telemetry-pills");
    if (!el) return;
    var t = currentDossierState.telemetry;
    function pill(label, status) {
      var cls = status.indexOf("✓") !== -1 ? " is-ok" : status === "Querying…" ? " is-loading" : "";
      return '<span class="src-pill' + cls + '">' + escapeHtml(label + ": " + status) + "</span>";
    }
    el.innerHTML =
      pill("PubChem", t.pubchem) +
      pill("ChEMBL", t.chembl) +
      pill("OpenFDA", t.fda) +
      pill("PubMed", t.pubmed);
  }

  function loadCompoundDossier(rawQuery) {
    if (!rawQuery || !String(rawQuery).trim()) return;
    var trimmed = String(rawQuery).trim();
    var catMatch = findCatalogEntry(trimmed);
    var canonicalName = catMatch ? catMatch.name : trimmed;

    activeCompoundName = canonicalName;
    pushRecentCompound(canonicalName);
    renderDirectoryList();

    if (activeDossierAbort) activeDossierAbort.abort();
    activeDossierAbort = new AbortController();
    var signal = activeDossierAbort.signal;

    currentDossierState = {
      name: canonicalName,
      catEntry: catMatch,
      curated: findCuratedMonograph(canonicalName),
      pubchem: null,
      chembl: null,
      fda: null,
      pubmed: null,
      tierCounts: null,
      selectedTier: "all",
      endpointQuery: "",
      telemetry: {
        pubchem: "Querying…",
        chembl: "Querying…",
        fda: "Querying…",
        pubmed: "Querying…"
      }
    };

    var epInput = document.getElementById("dossier-pubmed-endpoint-input");
    if (epInput) epInput.value = "";

    // Check cache first
    var cacheKey = canonicalName.toLowerCase();
    if (dossierCache.has(cacheKey)) {
      var cached = dossierCache.get(cacheKey);
      currentDossierState = Object.assign({}, cached, { selectedTier: "all", endpointQuery: "" });
      renderFullDossier();
      return;
    }

    // Immediate skeleton + curated baseline render (0ms)
    renderFullDossier();

    var t0 = Date.now();

    // 1. PubChem
    var pubchemPromise = fetchPubChemBundle(canonicalName, signal)
      .then(function (pc) {
        if (signal.aborted) return null;
        currentDossierState.pubchem = pc;
        currentDossierState.telemetry.pubchem = "CID " + pc.cid + " ✓ (" + (Date.now() - t0) + "ms)";
        renderDossierHeaderAndChem();
        renderDossierClinical();
        return pc;
      })
      .catch(function (err) {
        if (signal.aborted) return null;
        currentDossierState.telemetry.pubchem = "Macromolecule / Unindexed";
        renderDossierHeaderAndChem();
        return null;
      });

    var ikPromise = pubchemPromise.then(function (pc) {
      return pc && pc.props ? pc.props.InChIKey : null;
    });

    // 2. ChEMBL
    var chemblPromise = fetchChemblBundle(canonicalName, ikPromise, signal)
      .then(function (cb) {
        if (signal.aborted) return null;
        currentDossierState.chembl = cb;
        currentDossierState.telemetry.chembl = cb.molecule.molecule_chembl_id + " ✓";
        renderDossierHeaderAndChem();
        renderDossierTargets();
        return cb;
      })
      .catch(function () {
        if (signal.aborted) return null;
        currentDossierState.telemetry.chembl = "No Bioassay Entry";
        renderDossierHeaderAndChem();
        renderDossierTargets();
        return null;
      });

    // 3. OpenFDA
    var fdaPromise = fetchOpenFdaBundle(canonicalName, signal)
      .then(function (fda) {
        if (signal.aborted) return null;
        currentDossierState.fda = fda;
        currentDossierState.telemetry.fda = "SPL Monograph ✓";
        renderDossierHeaderAndChem();
        renderDossierClinical();
        return fda;
      })
      .catch(function () {
        if (signal.aborted) return null;
        currentDossierState.telemetry.fda = "Non-Rx / Non-US Label";
        renderDossierHeaderAndChem();
        renderDossierClinical();
        return null;
      });

    // 4. PubMed Literature + Tier Counts
    var pubmedPromise = fetchPubMedBundle(canonicalName, "", "all", signal)
      .then(function (pm) {
        if (signal.aborted) return null;
        currentDossierState.pubmed = pm;
        currentDossierState.telemetry.pubmed = pm.total.toLocaleString() + " Papers ✓";
        updateTelemetryBar();
        renderDossierPubMed();

        return fetchPubMedTierCounts(canonicalName, signal).then(function (counts) {
          if (signal.aborted) return;
          currentDossierState.tierCounts = counts;
          renderDossierPubMed();
        });
      })
      .catch(function () {
        if (signal.aborted) return null;
        currentDossierState.telemetry.pubmed = "Offline / Curated Only";
        updateTelemetryBar();
        renderDossierPubMed();
      });

    Promise.allSettled([pubchemPromise, chemblPromise, fdaPromise, pubmedPromise]).then(function () {
      if (!signal.aborted) {
        dossierCache.set(cacheKey, Object.assign({}, currentDossierState));
      }
    });
  }

  function renderFullDossier() {
    renderDossierHeaderAndChem();
    renderDossierPubMed();
    renderDossierTargets();
    renderDossierClinical();
  }

  function renderDossierHeaderAndChem() {
    var st = currentDossierState;
    var nameEl = document.getElementById("dossier-name");
    var badgesEl = document.getElementById("dossier-badges-row");
    var synEl = document.getElementById("dossier-synonyms");
    var linksEl = document.getElementById("dossier-external-links");
    var addStackBtn = document.getElementById("dossier-add-stack-btn");

    if (nameEl) nameEl.textContent = st.name;

    // Phase & Boxed Warning Badges
    var badges = [];
    var mol = st.chembl && st.chembl.molecule;
    var maxPhase = mol ? mol.max_phase : null;
    if (st.fda || maxPhase === 4 || maxPhase === "4.0") {
      badges.push('<span class="phase-badge">Approved Clinical Drug · Phase IV</span>');
    } else if (maxPhase && parseFloat(maxPhase) >= 1) {
      badges.push('<span class="phase-badge">Investigational · Phase ' + escapeHtml(String(maxPhase)) + "</span>");
    } else if (st.catEntry) {
      badges.push('<span class="phase-badge">' + escapeHtml(st.catEntry.category.toUpperCase()) + "</span>");
    } else {
      badges.push('<span class="phase-badge">Chemical / Bioactive Entity</span>');
    }

    if (mol && mol.molecule_type) {
      badges.push('<span class="grade-pill grade-B">' + escapeHtml(mol.molecule_type) + "</span>");
    }

    var hasBoxed = (st.fda && st.fda.boxed_warning && st.fda.boxed_warning.length > 0) || (mol && mol.black_box_warning === 1);
    if (hasBoxed) {
      badges.push('<span class="boxed-warning-pill">FDA Boxed Warning</span>');
    }

    if (st.pubchem && st.pubchem.markerMolecule) {
      badges.push('<span class="grade-pill grade-C">Marker: ' + escapeHtml(st.pubchem.markerMolecule) + "</span>");
    }

    if (badgesEl) badgesEl.innerHTML = badges.join("");

    // Synonyms & Class line
    var synParts = [];
    if (st.catEntry && st.catEntry.classSummary) synParts.push(st.catEntry.classSummary);
    else if (st.curated && st.curated.classLabel) synParts.push(st.curated.classLabel);
    else if (st.fda && st.fda.openfda && st.fda.openfda.pharm_class_epc) {
      synParts.push(st.fda.openfda.pharm_class_epc.slice(0, 2).join(" · "));
    } else if (mol && mol.usan_stem_definition) {
      synParts.push(mol.usan_stem_definition);
    }

    var aliasList = [];
    if (st.catEntry && st.catEntry.aliases.length) aliasList = aliasList.concat(st.catEntry.aliases);
    if (st.fda && st.fda.openfda && st.fda.openfda.brand_name) {
      aliasList = aliasList.concat(st.fda.openfda.brand_name.slice(0, 4));
    }
    if (st.pubchem && st.pubchem.synonyms) {
      aliasList = aliasList.concat(st.pubchem.synonyms.slice(0, 5));
    }
    var dedupAliases = [];
    var seenA = {};
    seenA[st.name.toLowerCase()] = true;
    aliasList.forEach(function (a) {
      var low = String(a).toLowerCase();
      if (!seenA[low]) {
        seenA[low] = true;
        dedupAliases.push(a);
      }
    });

    if (dedupAliases.length > 0) {
      synParts.push("Synonyms / Brands: " + dedupAliases.slice(0, 6).join(", "));
    }
    if (synEl) synEl.textContent = synParts.join("  —  ") || "Resolving nomenclature across federated indexes…";

    // External Provenance Links
    var extLinks = [];
    var cid = (st.pubchem && st.pubchem.cid) || (st.curated && st.curated.pubchemCid);
    if (cid) {
      extLinks.push('<a href="' + pubchemUrl(cid) + '" target="_blank" rel="noopener noreferrer">PubChem CID: ' + escapeHtml(cid) + " ↗</a>");
    }
    var chemblId = (mol && mol.molecule_chembl_id) || (st.curated && st.curated.chemblId);
    if (chemblId) {
      extLinks.push('<a href="' + chemblUrl(chemblId) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(chemblId) + " ↗</a>");
    }
    if (st.fda && st.fda.openfda && st.fda.openfda.rxcui && st.fda.openfda.rxcui[0]) {
      extLinks.push("<span>RxCUI: " + escapeHtml(st.fda.openfda.rxcui[0]) + "</span>");
    }
    if (st.fda && st.fda.openfda && st.fda.openfda.unii && st.fda.openfda.unii[0]) {
      extLinks.push("<span>UNII: " + escapeHtml(st.fda.openfda.unii[0]) + "</span>");
    }
    extLinks.push(
      '<a href="https://pubmed.ncbi.nlm.nih.gov/?term=' +
        encodeURIComponent(st.name) +
        '" target="_blank" rel="noopener noreferrer">PubMed Search ↗</a>'
    );
    if (linksEl) linksEl.innerHTML = extLinks.join(' <span style="color:var(--stone-line-strong)">·</span> ');

    // Stack button state
    if (addStackBtn) {
      var inStack = isCompoundInStack(st.name);
      addStackBtn.textContent = inStack ? "✓ Active in Stack Checker" : "+ Add to Stack Checker";
    }

    updateTelemetryBar();

    // 2D Structure Image
    var imgEl = document.getElementById("structure-img");
    var fallbackEl = document.getElementById("structure-fallback");
    var capEl = document.getElementById("structure-cid-caption");
    if (imgEl && fallbackEl) {
      if (cid) {
        imgEl.style.display = "block";
        fallbackEl.style.display = "none";
        imgEl.src = "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/" + encodeURIComponent(cid) + "/PNG?image_size=360x360";
        imgEl.alt = "2D molecular structure of " + st.name;
        imgEl.onerror = function () {
          imgEl.style.display = "none";
          fallbackEl.style.display = "block";
          fallbackEl.textContent = "Macromolecule / Non-planar Polymer (See Formula & Sequence Metadata)";
        };
        if (capEl) capEl.textContent = "CID " + cid;
      } else {
        imgEl.style.display = "none";
        fallbackEl.style.display = "block";
        fallbackEl.textContent =
          st.telemetry.pubchem === "Querying…"
            ? "Loading 2D coordinates…"
            : "Biologic / Macromolecule (No Small-Molecule 2D Graph)";
        if (capEl) capEl.textContent = mol && mol.molecule_type ? mol.molecule_type : "Structure";
      }
    }

    // Physicochemical Matrix
    var matrixEl = document.getElementById("physchem-matrix");
    var p = (st.pubchem && st.pubchem.props) || {};
    var cur = st.curated;
    if (matrixEl) {
      var formula = p.MolecularFormula || (cur && cur.formula) || "—";
      var mwVal = p.MolecularWeight ? parseFloat(p.MolecularWeight).toFixed(2) + " g/mol" : (cur && cur.mw) || "—";
      var xlogpVal = p.XLogP != null ? String(p.XLogP) : "—";
      var tpsaVal = p.TPSA != null ? p.TPSA + " Å²" : "—";
      var hbdVal = p.HBondDonorCount != null ? String(p.HBondDonorCount) : "—";
      var hbaVal = p.HBondAcceptorCount != null ? String(p.HBondAcceptorCount) : "—";
      var rotVal = p.RotatableBondCount != null ? String(p.RotatableBondCount) : "—";
      var ikVal = p.InChIKey || "—";
      var iupacVal = p.IUPACName || (p.CanonicalSMILES ? "SMILES: " + p.CanonicalSMILES : "—");

      matrixEl.innerHTML =
        '<div class="prop-cell"><span class="prop-label">Formula</span><span class="prop-val mono-code">' +
        escapeHtml(formula) +
        "</span></div>" +
        '<div class="prop-cell"><span class="prop-label">Molecular Weight</span><span class="prop-val mono-code">' +
        escapeHtml(mwVal) +
        "</span></div>" +
        '<div class="prop-cell"><span class="prop-label">Lipophilicity (XLogP3)</span><span class="prop-val mono-code">' +
        escapeHtml(xlogpVal) +
        "</span></div>" +
        '<div class="prop-cell"><span class="prop-label">Polar Area (TPSA)</span><span class="prop-val mono-code">' +
        escapeHtml(tpsaVal) +
        "</span></div>" +
        '<div class="prop-cell"><span class="prop-label">H-Bond Donors / Acc.</span><span class="prop-val mono-code">' +
        escapeHtml(hbdVal + " / " + hbaVal) +
        "</span></div>" +
        '<div class="prop-cell"><span class="prop-label">Rotatable Bonds</span><span class="prop-val mono-code">' +
        escapeHtml(rotVal) +
        "</span></div>" +
        '<div class="prop-cell span-2"><span class="prop-label">InChIKey</span><span class="prop-val mono-code" style="font-size:0.76rem;">' +
        escapeHtml(ikVal) +
        "</span></div>" +
        '<div class="prop-cell" style="grid-column: span 4;"><span class="prop-label">IUPAC Systematic Name / Canonical SMILES</span><span class="prop-val mono-code" style="font-size:0.74rem; font-weight:500; color:var(--text-secondary);">' +
        escapeHtml(truncateClean(iupacVal, 220)) +
        "</span></div>";
    }

    // CNS MPO / BBB Card
    var bbbEl = document.getElementById("bbb-card");
    if (bbbEl) {
      var bbb = computeBbbProfile(st.name, p.CID ? p : null, mol, cur, st.catEntry);
      var filledSegs = Math.round(bbb.score);
      var segsHtml = "";
      for (var i = 0; i < 6; i++) {
        var cls = i < filledSegs ? (bbb.score >= 3.6 ? " on-blue" : " on-watch") : "";
        segsHtml += '<span class="mpo-seg' + cls + '"></span>';
      }
      bbbEl.innerHTML =
        "<div>" +
        '<span class="prop-label">Blood-Brain Barrier &amp; CNS MPO</span>' +
        '<strong style="font-size:0.92rem; display:block; margin-top:2px; color:var(--text-primary);">' +
        escapeHtml(bbb.verdict) +
        "</strong>" +
        '<div class="mpo-meter-track" aria-hidden="true">' +
        segsHtml +
        "</div>" +
        '<p style="font-size:0.76rem; color:var(--text-secondary); margin:6px 0 0 0; line-height:1.45;">' +
        escapeHtml(bbb.detail) +
        "</p>" +
        "</div>" +
        (cur && cur.pk
          ? '<div style="margin-top:10px; padding-top:8px; border-top:1px solid var(--stone-line); font-size:0.75rem; color:var(--text-muted);">' +
            "<strong>t½:</strong> " +
            escapeHtml(cur.pk.halfLife) +
            " · <strong>Clearance:</strong> " +
            escapeHtml(cur.pk.clearance) +
            "</div>"
          : "");
    }
  }

  function renderDossierPubMed() {
    var st = currentDossierState;
    var btnsEl = document.getElementById("dossier-tier-buttons");
    var listEl = document.getElementById("dossier-pubmed-list");
    var totalEl = document.getElementById("pubmed-total-label");
    if (!btnsEl || !listEl) return;

    var tc = st.tierCounts;
    var papers = (st.pubmed && st.pubmed.papers) || [];

    // Sample counts fallback while full PubMed count queue resolves
    var localCounts = { A: 0, B: 0, C: 0, D: 0, E: 0 };
    papers.forEach(function (p) {
      localCounts[p.grade] = (localCounts[p.grade] || 0) + 1;
    });

    var tierDefs = [
      { g: "all", label: "All Loaded", count: st.pubmed ? st.pubmed.total.toLocaleString() : "…", desc: "Total PubMed Records" },
      { g: "A", label: "Grade A · Human RCT", count: tc ? tc.A.toLocaleString() : localCounts.A + "+", desc: "RCTs & Meta-Analyses (Wt 1.0)" },
      { g: "B", label: "Grade B · Observational", count: tc ? tc.B.toLocaleString() : localCounts.B + "+", desc: "Human Cohorts / Registries (0.65)" },
      { g: "C", label: "Grade C · Animal", count: tc ? tc.C.toLocaleString() : localCounts.C + "+", desc: "In Vivo Murine / Rat (Wt 0.35)" },
      { g: "D", label: "Grade D · Cell / In Vitro", count: tc ? tc.D.toLocaleString() : localCounts.D + "+", desc: "Cultured Dish Assays (Wt 0.15)" }
    ];

    if (totalEl && st.pubmed) {
      totalEl.textContent = st.pubmed.total.toLocaleString() + " Indexed PubMed Citations · Epistemically Separated";
    }

    btnsEl.innerHTML = tierDefs
      .map(function (td) {
        var isAct = st.selectedTier === td.g;
        return (
          '<button type="button" class="tier-stat-btn' +
          (isAct ? " is-active" : "") +
          '" data-tier-pick="' +
          escapeHtml(td.g) +
          '">' +
          (td.g === "all"
            ? '<span class="grade-pill grade-B">All Tiers</span>'
            : gradeBadgeHtml(td.g)) +
          '<span class="tier-count-num">' +
          escapeHtml(String(td.count)) +
          "</span>" +
          '<span class="tier-count-desc">' +
          escapeHtml(td.desc) +
          "</span>" +
          "</button>"
        );
      })
      .join("");

    btnsEl.querySelectorAll(".tier-stat-btn").forEach(function (b) {
      b.addEventListener("click", function () {
        var pickedTier = b.getAttribute("data-tier-pick");
        currentDossierState.selectedTier = pickedTier;
        rerunDossierPubMedSubquery();
      });
    });

    // Combine curated claims (if no custom filter) + live PubMed records
    var combinedHtml = "";

    if (st.curated && st.curated.claims && !st.endpointQuery) {
      var curClaims = st.curated.claims.filter(function (c) {
        return st.selectedTier === "all" || c.grade === st.selectedTier;
      });
      combinedHtml += curClaims
        .map(function (c) {
          return (
            '<div class="paper-row" style="border-left: 3px solid var(--action-blue);">' +
            "<div>" +
            gradeBadgeHtml(c.grade, c.tierLabel) +
            '<div class="mono-code" style="font-size:0.7rem; color:var(--text-muted); margin-top:4px;">Benchmark Audit</div>' +
            "</div>" +
            "<div>" +
            '<p class="paper-title">' +
            escapeHtml(c.claim) +
            "</p>" +
            '<div class="paper-meta"><strong>Effect:</strong> ' +
            escapeHtml(c.effect) +
            " · " +
            escapeHtml(c.cohort) +
            "</div>" +
            "</div>" +
            '<a href="' +
            pubmedUrl(c.pmid) +
            '" target="_blank" rel="noopener noreferrer" class="mono-code" style="font-size:0.78rem; white-space:nowrap;">PMID: ' +
            escapeHtml(c.pmid) +
            " ↗</a>" +
            "</div>"
          );
        })
        .join("");
    }

    if (papers.length > 0) {
      combinedHtml += papers
        .map(function (p) {
          return (
            '<div class="paper-row">' +
            "<div>" +
            gradeBadgeHtml(p.grade, p.tierLabel) +
            "</div>" +
            "<div>" +
            '<p class="paper-title">' +
            escapeHtml(p.title) +
            "</p>" +
            '<div class="paper-meta">' +
            escapeHtml(p.author) +
            " · <em>" +
            escapeHtml(p.journal) +
            "</em> (" +
            escapeHtml(p.pubdate) +
            ")</div>" +
            "</div>" +
            '<a href="' +
            pubmedUrl(p.pmid) +
            '" target="_blank" rel="noopener noreferrer" class="mono-code" style="font-size:0.78rem; white-space:nowrap;">PMID: ' +
            escapeHtml(p.pmid) +
            " ↗</a>" +
            "</div>"
          );
        })
        .join("");
    } else if (!combinedHtml) {
      combinedHtml =
        '<div style="padding:18px; text-align:center; color:var(--text-muted); font-size:0.84rem;">' +
        (st.telemetry.pubmed === "Querying…"
          ? "Querying NCBI PubMed E-Utilities…"
          : "No PubMed studies matched this exact tier/endpoint filter.") +
        "</div>";
    }

    listEl.innerHTML = combinedHtml;
  }

  function rerunDossierPubMedSubquery() {
    var st = currentDossierState;
    if (activeDossierAbort) activeDossierAbort.abort();
    activeDossierAbort = new AbortController();
    var sig = activeDossierAbort.signal;

    st.telemetry.pubmed = "Querying…";
    updateTelemetryBar();

    fetchPubMedBundle(st.name, st.endpointQuery, st.selectedTier, sig)
      .then(function (pm) {
        if (sig.aborted) return;
        st.pubmed = pm;
        st.telemetry.pubmed = pm.total.toLocaleString() + " Matched ✓";
        updateTelemetryBar();
        renderDossierPubMed();
      })
      .catch(function () {});
  }

  function renderDossierTargets() {
    var st = currentDossierState;
    var bodyEl = document.getElementById("dossier-targets-body");
    var countEl = document.getElementById("targets-count-label");
    if (!bodyEl) return;

    var rows = [];

    // 1. Curated high-precision targets
    if (st.curated && st.curated.targets) {
      st.curated.targets.forEach(function (t) {
        rows.push({
          target: t.receptor,
          gene: t.gene,
          mode: t.mode,
          metric: t.metric,
          val: t.affinity,
          pchembl: 8.2,
          grade: t.grade,
          source: "Curated Reference"
        });
      });
    }

    // 2. ChEMBL Mechanisms of Action
    var mechs = (st.chembl && st.chembl.mechanisms) || [];
    mechs.forEach(function (m) {
      rows.push({
        target: m.target_pref_name || m.mechanism_of_action || "Molecular Target",
        gene: m.target_chembl_id || "",
        mode: m.action_type || "MODULATOR",
        metric: "Mechanism",
        val: m.mechanism_of_action || "Verified Clinical Target",
        pchembl: 8.5,
        grade: "A",
        source: "ChEMBL Mechanism"
      });
    });

    // 3. ChEMBL Quantitative Homo sapiens Bioactivities (deduplicated per target)
    var acts = (st.chembl && st.chembl.activities) || [];
    var bestByTarget = {};
    acts.forEach(function (a) {
      if (!a.target_pref_name || !a.pchembl_value) return;
      var pVal = parseFloat(a.pchembl_value);
      var key = a.target_pref_name;
      if (!bestByTarget[key] || pVal > bestByTarget[key].pVal) {
        bestByTarget[key] = {
          target: a.target_pref_name,
          gene: a.target_chembl_id || "Homo sapiens",
          mode: a.standard_type || "Assay",
          metric: a.standard_type || "pChEMBL",
          val:
            a.standard_value && a.standard_units
              ? parseFloat(a.standard_value).toFixed(1) + " " + a.standard_units + " (pChEMBL " + pVal.toFixed(2) + ")"
              : "pChEMBL " + pVal.toFixed(2),
          pchembl: pVal,
          grade: "D",
          source: a.assay_chembl_id || "ChEMBL Bioassay"
        };
      }
    });

    Object.keys(bestByTarget)
      .map(function (k) { return bestByTarget[k]; })
      .sort(function (a, b) { return b.pchembl - a.pchembl; })
      .slice(0, 12)
      .forEach(function (item) { rows.push(item); });

    if (countEl) {
      countEl.textContent = rows.length + " Target Records";
    }

    if (rows.length === 0) {
      bodyEl.innerHTML =
        '<div style="color:var(--text-muted); font-size:0.84rem; padding:10px 0;">' +
        (st.telemetry.chembl === "Querying…"
          ? "Querying EBI ChEMBL human receptor & enzyme bioactivity assays…"
          : "No quantitative human nanomolar ChEMBL target bioassays returned; see Clinical Pharmacology & PubChem sections below for pathway mechanisms.") +
        "</div>";
      return;
    }

    bodyEl.innerHTML =
      '<div class="data-table-wrap"><table class="clinical-table">' +
      "<thead><tr><th>Molecular Target / Enzyme</th><th>Action / Assay</th><th>Affinity / Potency</th><th>Relative Potency</th><th>Tier</th></tr></thead>" +
      "<tbody>" +
      rows
        .map(function (r) {
          var pct = Math.max(12, Math.min(100, Math.round(((r.pchembl - 4.0) / 6.0) * 100)));
          var high = r.pchembl >= 7.5;
          return (
            "<tr>" +
            "<td><strong>" +
            escapeHtml(r.target) +
            '</strong> <span class="mono-code" style="font-size:0.72rem; color:var(--text-muted);">' +
            escapeHtml(r.gene) +
            "</span></td>" +
            "<td>" +
            escapeHtml(r.mode) +
            "</td>" +
            '<td class="mono-code">' +
            escapeHtml(r.val) +
            "</td>" +
            '<td><span class="potency-mini-bar"><span class="potency-mini-fill' +
            (high ? " high-potency" : "") +
            '" style="width:' +
            pct +
            '%;"></span></span><span class="mono-code" style="font-size:0.72rem; color:var(--text-muted);">' +
            escapeHtml(r.source) +
            "</span></td>" +
            "<td>" +
            gradeBadgeHtml(r.grade) +
            "</td>" +
            "</tr>"
          );
        })
        .join("") +
      "</tbody></table></div>";
  }

  function renderDossierClinical() {
    var st = currentDossierState;
    var bodyEl = document.getElementById("dossier-clinical-body");
    if (!bodyEl) return;

    var fda = st.fda || {};
    var pv = (st.pubchem && st.pubchem.sections) || {};
    var cur = st.curated;

    var boxedText = fda.boxed_warning ? fda.boxed_warning.join("\n\n") : "";
    var indications =
      (fda.indications_and_usage && fda.indications_and_usage[0]) ||
      pv["Therapeutic Uses"] ||
      pv["Drug Indication"] ||
      (st.catEntry ? st.catEntry.classSummary : "Refer to graded PubMed clinical studies above.");

    var moa =
      (fda.mechanism_of_action && fda.mechanism_of_action[0]) ||
      (fda.clinical_pharmacology && fda.clinical_pharmacology[0]) ||
      pv["Mechanism of Action"] ||
      pv["Pharmacology"] ||
      pv["Pharmacodynamics"] ||
      (cur ? cur.clinicalNote : "Resolving mechanism summary…");

    var pkText =
      (fda.pharmacokinetics && fda.pharmacokinetics[0]) ||
      [pv["Absorption, Distribution and Excretion"], pv["Metabolism/Metabolites"], pv["Biological Half-Life"]]
        .filter(Boolean)
        .join("\n\n") ||
      (cur && cur.pk
        ? "Bioavailability: " +
          cur.pk.bioavailability +
          "\nHalf-Life: " +
          cur.pk.halfLife +
          "\nBBB: " +
          cur.pk.bbb +
          "\nClearance: " +
          cur.pk.clearance
        : "No structured FDA SPL pharmacokinetic paragraph indexed; check molecular ADME & CNS MPO parameters above.");

    var ddiText =
      (fda.drug_interactions && fda.drug_interactions[0]) ||
      (fda.contraindications && fda.contraindications[0]) ||
      pv["Interactions"] ||
      pv["Toxicity"] ||
      (cur ? cur.clinicalNote : "Add this compound to the Stack & Pathway Checker (Tab 02) to evaluate shared CYP450, transporter, and physiological target collisions.");

    var boxedHtml = boxedText
      ? '<div class="boxed-warning-banner">' +
        '<h3 class="boxed-warning-title">FDA Boxed Warning (Black Box Safety Signal)</h3>' +
        '<p class="monograph-prose" style="max-height:150px; color:var(--text-primary);">' +
        escapeHtml(truncateClean(boxedText, 1200)) +
        "</p></div>"
      : "";

    bodyEl.innerHTML =
      boxedHtml +
      '<div class="clinical-sections-grid">' +
      '<div class="monograph-block"><h4><span>Indications &amp; Clinical Context</span><span class="mono-code" style="font-size:0.68rem; color:var(--text-muted);">SPL / PUG</span></h4><p class="monograph-prose">' +
      escapeHtml(truncateClean(indications, 1100)) +
      "</p></div>" +
      '<div class="monograph-block"><h4><span>Mechanism of Action &amp; Pharmacodynamics</span><span class="mono-code" style="font-size:0.68rem; color:var(--text-muted);">PD</span></h4><p class="monograph-prose">' +
      escapeHtml(truncateClean(moa, 1100)) +
      "</p></div>" +
      '<div class="monograph-block"><h4><span>Pharmacokinetics (ADME, t½ &amp; CYP450)</span><span class="mono-code" style="font-size:0.68rem; color:var(--text-muted);">PK</span></h4><p class="monograph-prose">' +
      escapeHtml(truncateClean(pkText, 1100)) +
      "</p></div>" +
      '<div class="monograph-block"><h4><span>Drug Interactions &amp; Contraindications</span><span class="mono-code" style="font-size:0.68rem; color:var(--text-muted);">DDI</span></h4><p class="monograph-prose">' +
      escapeHtml(truncateClean(ddiText, 1100)) +
      "</p></div>" +
      "</div>";
  }

  /* ------------------------------------------------------------------------
     8. Universal Dynamic Stack & Pathway Interaction Engine (Any Global Drug!)
     ------------------------------------------------------------------------ */
  var PATHWAY_NODE_DEFS = {
    CYP3A4: { id: "CYP3A4", name: "CYP3A4 Oxidase", sub: "Hepatic / Gut Clearance", axis: "cyp-axis" },
    CYP2D6: { id: "CYP2D6", name: "CYP2D6 Oxidase", sub: "Phenoconversion / Prodrugs", axis: "cyp-axis" },
    CYP2C9: { id: "CYP2C9", name: "CYP2C9 Oxidase", sub: "Warfarin / NSAID Clearance", axis: "cyp-axis" },
    CYP2C19: { id: "CYP2C19", name: "CYP2C19 Oxidase", sub: "Clopidogrel / SSRI / PPI", axis: "cyp-axis" },
    CYP1A2: { id: "CYP1A2", name: "CYP1A2 Oxidase", sub: "Xanthine / Aryl Clearance", axis: "cyp-axis" },
    CYP2B6: { id: "CYP2B6", name: "CYP2B6 / CYP2C8", sub: "Hepatic Biotransformation", axis: "cyp-axis" },
    CYP2C8: { id: "CYP2B6", name: "CYP2B6 / CYP2C8", sub: "Hepatic Biotransformation", axis: "cyp-axis" },
    Pgp: { id: "Pgp", name: "P-gp / BCRP Efflux", sub: "ABCB1 / ABCG2 Transporter", axis: "cyp-axis" },
    BCRP: { id: "Pgp", name: "P-gp / BCRP Efflux", sub: "ABCB1 / ABCG2 Transporter", axis: "cyp-axis" },
    OATP1B1: { id: "OATP1B1", name: "OATP1B1 / OCT2", sub: "SLCO1B1 / Renal SLC22A2", axis: "organ-axis" },
    OCT2: { id: "OATP1B1", name: "OATP1B1 / OCT2", sub: "SLCO1B1 / Renal SLC22A2", axis: "organ-axis" },

    SERT: { id: "SERT", name: "SERT / 5-HT Tone", sub: "Serotonergic Synapse", axis: "neuro-axis" },
    "5HT2A": { id: "SERT", name: "SERT / 5-HT Tone", sub: "Serotonergic Synapse", axis: "neuro-axis" },
    MAO: { id: "MAO", name: "MAO-A / MAO-B", sub: "Monoamine Catabolism", axis: "neuro-axis" },
    DAT: { id: "Catechol", name: "DAT / NET / D2", sub: "Catecholaminergic Tone", axis: "neuro-axis" },
    NET: { id: "Catechol", name: "DAT / NET / D2", sub: "Catecholaminergic Tone", axis: "neuro-axis" },
    D2: { id: "Catechol", name: "DAT / NET / D2", sub: "Catecholaminergic Tone", axis: "neuro-axis" },

    GABA: { id: "CNSDep", name: "GABAA / CNS Sedation", sub: "Respiratory & Arousal Drive", axis: "sedation-axis" },
    CNSDep: { id: "CNSDep", name: "GABAA / CNS Sedation", sub: "Respiratory & Arousal Drive", axis: "sedation-axis" },
    MOR: { id: "MOR", name: "µ-Opioid (OPRM1)", sub: "Opioid Analgesia / Drive", axis: "sedation-axis" },
    H1: { id: "AChH1", name: "Muscarinic / H1", sub: "Anticholinergic / Histamine", axis: "sedation-axis" },
    ACh: { id: "AChH1", name: "Cholinergic / M1", sub: "Acetylcholine Flux", axis: "neuro-axis" },
    nAChR: { id: "AChH1", name: "Cholinergic / nAChR", sub: "Nicotinic Cholinergic", axis: "neuro-axis" },
    NMDA: { id: "Glutamate", name: "NMDA / AMPA Glu", sub: "Excitatory Plasticity", axis: "neuro-axis" },
    Glutamate: { id: "Glutamate", name: "NMDA / AMPA Glu", sub: "Excitatory Plasticity", axis: "neuro-axis" },
    Adenosine: { id: "Adenosine", name: "Adenosine A1/A2A", sub: "Purinergic Wakefulness", axis: "neuro-axis" },

    QTc: { id: "QTc", name: "hERG / QTc Interval", sub: "Cardiac Repolarization", axis: "hemo-axis" },
    Coag: { id: "Coag", name: "Coagulation / COX-1", sub: "Hemostasis & Platelet", axis: "hemo-axis" },
    NOcGMP: { id: "NOcGMP", name: "NO / cGMP / PDE5", sub: "Systemic Vasodilation", axis: "hemo-axis" },
    RAAS: { id: "RenalRAAS", name: "RAAS / Renal GFR", sub: "Glomerular & Li+ Clearance", axis: "organ-axis" },
    RenalLi: { id: "RenalRAAS", name: "RAAS / Renal GFR", sub: "Glomerular & Li+ Clearance", axis: "organ-axis" },
    GSK3B: { id: "RenalRAAS", name: "GSK-3β / Li+ Pool", sub: "Narrow Therapeutic Index", axis: "organ-axis" },
    AMPK: { id: "AMPK", name: "AMPK / Glycemic", sub: "Hepatic Glucose & Insulin", axis: "organ-axis" },
    HMGCR: { id: "HMGCR", name: "HMGCR / Myocyte", sub: "Mevalonate Statin Axis", axis: "organ-axis" },
    HepaticGSH: { id: "HepaticGSH", name: "Hepatic GSH / NAPQI", sub: "Hepatocyte Redox Pool", axis: "organ-axis" }
  };

  var UNIVERSAL_AXES = [
    { id: "neuro-axis", name: "Serotonergic & Monoamine Load", unit: "5-HT / Catechol / Glu" },
    { id: "cyp-axis", name: "CYP450 & Efflux Bottleneck", unit: "PK Exposure / Prodrug Shift" },
    { id: "sedation-axis", name: "CNS Depression & Opioid Drive", unit: "Sedation / Respiratory" },
    { id: "hemo-axis", name: "Bleeding, QTc & Vasodilation", unit: "Coag / hERG / BP Drop" },
    { id: "organ-axis", name: "Renal, Hepatic & Glycemic Load", unit: "eGFR / Statin / AMPK" }
  ];

  var STACK_PRESETS = [
    {
      id: "ssri-tramadol",
      label: "SSRI + Tramadol + St. John's Wort",
      drugs: ["Escitalopram", "Tramadol", "Hyperforin", "Magnesium Glycinate"],
      note: "Demonstrates triple serotonergic convergence (SERT), CYP2D6 prodrug blunting, and PXR CYP3A4 induction."
    },
    {
      id: "triple-whammy",
      label: "Renal “Triple Whammy” Audit",
      drugs: ["Lisinopril", "Ibuprofen", "Furosemide"],
      note: "Classic clinical nephrotoxicity triad: ACEi efferent arteriole dilation + NSAID afferent constriction + loop diuresis."
    },
    {
      id: "pde5-nitrate",
      label: "PDE5 + Organic Nitrate Hazard",
      drugs: ["Sildenafil", "Nitroglycerin", "Atorvastatin"],
      note: "Synergistic NO -> cGMP accumulation + PDE5 block precipitates profound life-threatening hypotension."
    },
    {
      id: "warfarin-azole",
      label: "Warfarin + Fluconazole + Aspirin",
      drugs: ["Warfarin", "Fluconazole", "Aspirin"],
      note: "Potent CYP2C9 inhibition spikes S-warfarin exposure alongside dual anticoagulant + antiplatelet bleeding risk."
    },
    {
      id: "cognitive-stack",
      label: "Cholinergic & Focus Protocol",
      drugs: ["CDP-Choline", "Caffeine", "L-Theanine", "Magnesium Glycinate"],
      note: "Balanced Adenosine A2A antagonism, glutamate buffering, and choline donation with zero CYP450 collision."
    }
  ];

  var universalStack = {
    presetId: "ssri-tramadol",
    drugNames: ["Escitalopram", "Tramadol", "Hyperforin", "Magnesium Glycinate"],
    profiles: {}, // drugNameLower -> { name, tags: [], fdaDdiText: "", loading: bool }
    focusedEdgeKey: null,
    focusedNodeId: null
  };

  function isCompoundInStack(name) {
    var low = String(name).toLowerCase();
    return universalStack.drugNames.some(function (d) { return d.toLowerCase() === low; });
  }

  function inferTagsFromLiveText(name, fdaObj, pubchemObj, chemblObj) {
    var tags = [];
    var blob = [
      fdaObj && fdaObj.drug_interactions ? fdaObj.drug_interactions.join(" ") : "",
      fdaObj && fdaObj.clinical_pharmacology ? fdaObj.clinical_pharmacology.join(" ") : "",
      fdaObj && fdaObj.pharmacokinetics ? fdaObj.pharmacokinetics.join(" ") : "",
      fdaObj && fdaObj.boxed_warning ? fdaObj.boxed_warning.join(" ") : "",
      fdaObj && fdaObj.openfda && fdaObj.openfda.pharm_class_epc ? fdaObj.openfda.pharm_class_epc.join(" ") : "",
      pubchemObj && pubchemObj.sections ? JSON.stringify(pubchemObj.sections) : "",
      chemblObj && chemblObj.mechanisms ? JSON.stringify(chemblObj.mechanisms) : ""
    ].join(" ");

    function addTag(t) {
      if (tags.indexOf(t) === -1) tags.push(t);
    }

    var cypList = ["CYP3A4", "CYP2D6", "CYP2C9", "CYP2C19", "CYP1A2", "CYP2B6"];
    cypList.forEach(function (cyp) {
      if (new RegExp("strong\\s+" + cyp + "\\s+inhibitor|inhibits\\s+" + cyp + "|inhibitor\\s+of\\s+" + cyp, "i").test(blob)) {
        addTag(cyp + ":inh");
      } else if (new RegExp(cyp + "\\s+inducer|induces\\s+" + cyp, "i").test(blob)) {
        addTag(cyp + ":ind");
      } else if (new RegExp("metabolized\\s+by\\s+" + cyp + "|" + cyp + "\\s+substrate", "i").test(blob)) {
        addTag(cyp + ":sub");
      }
    });

    if (/P-glycoprotein|P-gp|ABCB1/i.test(blob)) addTag("Pgp:sub");
    if (/OATP1B1|SLCO1B1/i.test(blob)) addTag("OATP1B1:sub");
    if (/serotonin syndrome|serotonergic|serotonin reuptake/i.test(blob)) addTag("SERT:inh");
    if (/monoamine oxidase|MAOI/i.test(blob) && /inhibitor/i.test(blob)) addTag("MAO:inh");
    if (/QT prolongation|QTc|torsades de pointes/i.test(blob)) addTag("QTc:risk");
    if (/anticoagulant|bleeding risk|platelet aggregation|Factor Xa|INR/i.test(blob)) addTag("Coag:mod");
    if (/respiratory depression|CNS depressant|benzodiazepine/i.test(blob)) addTag("CNSDep:mod");
    if (/opioid receptor|mu-opioid/i.test(blob)) addTag("MOR:ago");
    if (/organic nitrates|guanylate cyclase|PDE5/i.test(blob)) addTag("NOcGMP:risk");
    if (/angiotensin|ACE inhibitor|NSAID|renal function/i.test(blob)) addTag("RAAS:mod");
    if (/hypoglycemia|insulin|AMPK|blood glucose/i.test(blob)) addTag("AMPK:mod");

    return tags;
  }

  function ensureStackProfile(drugName) {
    var cat = findCatalogEntry(drugName);
    var canonical = cat ? cat.name : drugName.trim();
    var key = canonical.toLowerCase();

    if (universalStack.profiles[key]) return Promise.resolve(universalStack.profiles[key]);

    var initialTags = cat ? cat.tags.slice() : [];
    var profile = {
      name: canonical,
      classLabel: cat ? cat.classSummary : "Global Lookup",
      tags: initialTags,
      fdaDdiText: "",
      loading: true
    };
    universalStack.profiles[key] = profile;

    // Enrich in background from OpenFDA + ChEMBL so ANY global drug maps pathways & cross-label mentions!
    return Promise.allSettled([
      fetchOpenFdaBundle(canonical, null),
      fetchChemblBundle(canonical, Promise.resolve(null), null)
    ]).then(function (results) {
      var fda = results[0].status === "fulfilled" ? results[0].value : null;
      var cb = results[1].status === "fulfilled" ? results[1].value : null;
      if (fda && fda.drug_interactions) {
        profile.fdaDdiText = fda.drug_interactions.join(" ");
      }
      if (!cat && fda && fda.openfda && fda.openfda.pharm_class_epc) {
        profile.classLabel = fda.openfda.pharm_class_epc[0];
      } else if (!cat && cb && cb.molecule && cb.molecule.molecule_type) {
        profile.classLabel = cb.molecule.molecule_type;
      }

      var inferred = inferTagsFromLiveText(canonical, fda, null, cb);
      inferred.forEach(function (t) {
        if (profile.tags.indexOf(t) === -1) profile.tags.push(t);
      });
      if (profile.tags.length === 0) {
        profile.tags.push("CYP3A4:sub"); // fallback metabolic watch when completely uncharacterized
        profile.unmappedNote = true;
      }
      profile.loading = false;
      renderStackAll();
      return profile;
    });
  }

  function addDrugToStack(drugName) {
    var cat = findCatalogEntry(drugName);
    var canonical = cat ? cat.name : String(drugName).trim();
    if (!canonical) return;

    if (!isCompoundInStack(canonical)) {
      universalStack.drugNames.push(canonical);
      universalStack.presetId = "custom";
    }
    updateStackCountBadge();
    ensureStackProfile(canonical);
    renderStackAll();
    renderDossierHeaderAndChem();
  }

  function removeDrugFromStack(drugName) {
    if (universalStack.drugNames.length <= 1) {
      showToast("Keep at least 1 compound in the active stack.");
      return;
    }
    var low = drugName.toLowerCase();
    universalStack.drugNames = universalStack.drugNames.filter(function (d) {
      return d.toLowerCase() !== low;
    });
    universalStack.presetId = "custom";
    updateStackCountBadge();
    renderStackAll();
    renderDossierHeaderAndChem();
  }

  function updateStackCountBadge() {
    var el = document.getElementById("stack-tab-count");
    if (el) el.textContent = String(universalStack.drugNames.length);
  }

  function uniqueList(arr) {
    var seen = {};
    return arr.filter(function (item) {
      if (seen[item]) return false;
      seen[item] = true;
      return true;
    });
  }

  function buildStackGraphAndFindings() {
    var activeProfiles = universalStack.drugNames.map(function (n) {
      var k = n.toLowerCase();
      if (!universalStack.profiles[k]) ensureStackProfile(n);
      return universalStack.profiles[k] || { name: n, tags: [], fdaDdiText: "" };
    });

    var edges = [];
    var nodeHits = {};
    var nodeModesByDrug = {};
    var modeRank = { risk: 6, inh: 5, ind: 5, ago: 4, ant: 4, sub: 3, mod: 2 };

    activeProfiles.forEach(function (prof) {
      var bestPerNode = {};
      prof.tags.forEach(function (tagStr) {
        var parts = tagStr.split(":");
        var rawTarget = parts[0];
        var mode = parts[1] || "mod";
        var def = PATHWAY_NODE_DEFS[rawTarget];
        if (!def) return;
        if (!bestPerNode[def.id] || (modeRank[mode] || 1) > (modeRank[bestPerNode[def.id].mode] || 1)) {
          bestPerNode[def.id] = { def: def, mode: mode, raw: rawTarget };
        }
      });

      Object.keys(bestPerNode).forEach(function (nid) {
        var entry = bestPerNode[nid];
        var def = entry.def;
        var mode = entry.mode;
        var edgeKey = prof.name + "->" + def.id;

        var modeWord =
          mode === "inh" ? "Inhibitor"
          : mode === "ind" ? "Inducer"
          : mode === "sub" ? "Substrate"
          : mode === "ago" ? "Agonist / Donor"
          : mode === "ant" ? "Antagonist"
          : mode === "risk" ? "High-Risk Axis"
          : "Modulator";

        var isAlert = mode === "inh" || mode === "ind" || mode === "risk";
        var baseWeight = mode === "risk" ? 38 : mode === "inh" || mode === "ind" ? 30 : mode === "ago" ? 18 : mode === "sub" ? 16 : 8;

        edges.push({
          key: edgeKey,
          from: prof.name,
          to: def.id,
          targetName: def.name,
          axis: def.axis,
          mode: mode,
          modeWord: modeWord,
          isAlert: isAlert,
          weight: baseWeight
        });

        nodeHits[def.id] = (nodeHits[def.id] || 0) + 1;
        nodeModesByDrug[def.id] = nodeModesByDrug[def.id] || [];
        nodeModesByDrug[def.id].push({ drug: prof.name, mode: mode, raw: entry.raw });
      });
    });

    // Active target nodes
    var seenNodes = {};
    var targetNodes = [];
    edges.forEach(function (e) {
      if (!seenNodes[e.to]) {
        seenNodes[e.to] = true;
        var matchDef = Object.keys(PATHWAY_NODE_DEFS)
          .map(function (k) { return PATHWAY_NODE_DEFS[k]; })
          .find(function (d) { return d.id === e.to; });
        if (matchDef) targetNodes.push(matchDef);
      }
    });

    // Axis scores & clinical findings
    var axisScores = {
      "neuro-axis": 0,
      "cyp-axis": 0,
      "sedation-axis": 0,
      "hemo-axis": 0,
      "organ-axis": 0
    };

    edges.forEach(function (e) {
      var hits = nodeHits[e.to] || 1;
      var mult = hits >= 2 && e.weight >= 14 ? 1.35 : 1.0;
      axisScores[e.axis] = (axisScores[e.axis] || 0) + e.weight * mult;
    });

    var findings = [];

    // 1. Serotonergic + MAOI / Multi-SERT rule
    var sertActors = (nodeModesByDrug["SERT"] || []).map(function (x) { return x.drug; });
    var maoActors = (nodeModesByDrug["MAO"] || []).filter(function (x) { return x.mode === "inh"; }).map(function (x) { return x.drug; });
    if (sertActors.length >= 1 && maoActors.length >= 1) {
      axisScores["neuro-axis"] = 100;
      findings.push({
        severity: "critical",
        badge: "CONTRAINDICATED · SEROTONIN TOXICITY",
        title: "MAOI + Serotonergic Agent Collision (" + maoActors.concat(sertActors).join(" + ") + ")",
        detail: "Concurrent monoamine oxidase inhibition and serotonin reuptake/release elevation risks severe hyperthermia, neuromuscular clonus, and hypertensive/serotonergic crisis."
      });
    } else if (sertActors.length >= 2) {
      axisScores["neuro-axis"] = Math.max(axisScores["neuro-axis"], 82);
      findings.push({
        severity: "critical",
        badge: "PATHWAY CONVERGENCE · SERT",
        title: "Additive Serotonergic Load (" + sertActors.join(" + ") + ")",
        detail: "Multiple active agents elevate synaptic 5-HT tone; monitor closely for clonus, agitation, diaphoresis, and tremor."
      });
    }

    // 2. CYP450 Inhibitor/Inducer + Substrate rules
    ["CYP3A4", "CYP2D6", "CYP2C9", "CYP2C19", "CYP1A2", "Pgp"].forEach(function (enz) {
      var list = nodeModesByDrug[enz] || [];
      if (list.length < 2) return;
      var inhs = list.filter(function (x) { return x.mode === "inh"; }).map(function (x) { return x.drug; });
      var inds = list.filter(function (x) { return x.mode === "ind"; }).map(function (x) { return x.drug; });
      var subs = list.filter(function (x) { return x.mode === "sub"; }).map(function (x) { return x.drug; });

      if (inhs.length > 0 && subs.length > 0) {
        var distinct = subs.some(function (s) { return inhs.indexOf(s) === -1; });
        if (distinct) {
          axisScores["cyp-axis"] = Math.max(axisScores["cyp-axis"], 78);
          findings.push({
            severity: "elevated",
            badge: "PK INHIBITION · " + enz,
            title: enz + " Clearance Block (" + inhs.join(", ") + " → " + subs.join(", ") + ")",
            detail:
              enz === "CYP2D6"
                ? "Inhibiting CYP2D6 elevates parent substrate AUC while blocking bioactivation of CYP2D6 prodrugs (codeine, tramadol, tamoxifen)."
                : "Inhibition of " + enz + " reduces metabolic clearance and elevates systemic plasma Cmax/AUC of co-administered substrates."
          });
        }
      }
      if (inds.length > 0 && subs.length > 0) {
        var distinctInd = subs.some(function (s) { return inds.indexOf(s) === -1; });
        if (distinctInd) {
          axisScores["cyp-axis"] = Math.max(axisScores["cyp-axis"], 76);
          findings.push({
            severity: "elevated",
            badge: "PK INDUCTION · " + enz,
            title: enz + " Accelerated Clearance (" + inds.join(", ") + " → " + subs.join(", ") + ")",
            detail: "Transcriptional induction of " + enz + " slashes plasma concentrations of co-administered substrates, risking therapeutic failure."
          });
        }
      }
    });

    // 3. NO / cGMP + PDE5 Contraindication
    var noList = (nodeModesByDrug["NOcGMP"] || []).filter(function (x) { return x.mode === "risk"; });
    if (noList.length >= 2) {
      axisScores["hemo-axis"] = 100;
      findings.push({
        severity: "critical",
        badge: "CONTRAINDICATED · HEMODYNAMIC",
        title: "Synergistic Nitric Oxide / cGMP Hypotension (" + noList.map(function (x) { return x.drug; }).join(" + ") + ")",
        detail: "Co-administering an organic nitrate/guanylyl cyclase stimulator with a PDE5 inhibitor causes massive cGMP accumulation and precipitous blood-pressure collapse."
      });
    }

    // 4. Dual CNS Depression / Opioid + Benzodiazepine / Sedative
    var morActors = (nodeModesByDrug["MOR"] || []).filter(function (x) { return x.mode === "ago" || x.mode === "mod"; });
    var sedActors = (nodeModesByDrug["CNSDep"] || []);
    if (morActors.length >= 1 && sedActors.length >= 2) {
      axisScores["sedation-axis"] = Math.max(axisScores["sedation-axis"], 88);
      findings.push({
        severity: "critical",
        badge: "FDA BOXED INTERACTION · CNS DRIVE",
        title: "Opioid + Sedative Respiratory Depression Overlap",
        detail: "Combining µ-opioid agonists with benzodiazepines, gabapentinoids, alcohol, or Z-hypnotics compounds brainstem ventilatory depression."
      });
    }

    // 5. QTc Interval Stacking
    var qtcActors = (nodeModesByDrug["QTc"] || []);
    if (qtcActors.length >= 2) {
      axisScores["hemo-axis"] = Math.max(axisScores["hemo-axis"], 76);
      findings.push({
        severity: "elevated",
        badge: "ELECTROPHYSIOLOGY · hERG / QTc",
        title: "Additive QTc Prolongation Signal (" + qtcActors.map(function (x) { return x.drug; }).join(" + ") + ")",
        detail: "Multiple agents delay cardiac IKr (hERG) repolarization; check baseline ECG and serum K+/Mg2+."
      });
    }

    // 6. Bleeding / Coagulation Stacking
    var coagActors = (nodeModesByDrug["Coag"] || []);
    if (coagActors.length >= 2) {
      axisScores["hemo-axis"] = Math.max(axisScores["hemo-axis"], 74);
      findings.push({
        severity: "elevated",
        badge: "HEMOSTASIS · BLEEDING SIGNAL",
        title: "Compounded Anticoagulant / Antiplatelet GI & Systemic Bleed Risk (" + coagActors.map(function (x) { return x.drug; }).join(" + ") + ")",
        detail: "Concurrent Factor Xa / VKORC1 anticoagulation and platelet COX-1 / P2Y12 inhibition markedly elevates major hemorrhage risk."
      });
    }

    // 7. Renal Hemodynamic / Lithium Retention ("Triple Whammy" & Li+ toxicity)
    var renalActors = (nodeModesByDrug["RenalRAAS"] || []);
    if (renalActors.length >= 2) {
      var hasLi = renalActors.some(function (x) { return /lithium/i.test(x.drug); });
      axisScores["organ-axis"] = Math.max(axisScores["organ-axis"], hasLi ? 88 : 74);
      findings.push({
        severity: hasLi ? "critical" : "elevated",
        badge: hasLi ? "NARROW THERAPEUTIC INDEX · LITHIUM" : "RENAL HEMODYNAMICS · eGFR",
        title: hasLi
          ? "Reduced Renal Lithium Clearance (" + renalActors.map(function (x) { return x.drug; }).join(" + ") + ")"
          : "Glomerular Perfusion Pressure Convergence (" + renalActors.map(function (x) { return x.drug; }).join(" + ") + ")",
        detail: hasLi
          ? "NSAIDs, ACEi/ARBs, and thiazides increase proximal tubular Li+ reabsorption and can precipitate acute lithium neuro/nephrotoxicity."
          : "Combining RAAS blockade, prostaglandin COX inhibition, and diuresis impairs glomerular autoregulation and raises acute kidney injury risk."
      });
    }

    // 8. Direct OpenFDA Drug-Label Cross-Mention Scanner!
    for (var i = 0; i < activeProfiles.length; i++) {
      for (var j = i + 1; j < activeProfiles.length; j++) {
        var pA = activeProfiles[i];
        var pB = activeProfiles[j];
        var matchSentence = findLabelMention(pA.fdaDdiText, pB.name) || findLabelMention(pB.fdaDdiText, pA.name);
        if (matchSentence) {
          findings.push({
            severity: "moderate",
            badge: "DIRECT FDA SPL LABEL MATCH",
            title: pA.name + " ↔ " + pB.name + " (Official Prescribing Label)",
            detail: truncateClean(matchSentence, 260)
          });
        }
      }
    }

    Object.keys(axisScores).forEach(function (k) {
      axisScores[k] = Math.max(0, Math.min(100, Math.round(axisScores[k])));
    });

    return {
      profiles: activeProfiles,
      targets: targetNodes,
      edges: edges,
      nodeHits: nodeHits,
      axisScores: axisScores,
      findings: findings.slice(0, 7)
    };
  }

  function findLabelMention(ddiText, otherDrugName) {
    if (!ddiText || !otherDrugName || otherDrugName.length < 4) return null;
    var idx = ddiText.toLowerCase().indexOf(otherDrugName.toLowerCase());
    if (idx === -1) return null;
    var start = Math.max(0, ddiText.lastIndexOf(".", idx) + 1);
    var end = ddiText.indexOf(".", idx + otherDrugName.length);
    if (end === -1) end = Math.min(ddiText.length, idx + 240);
    return ddiText.slice(start, end + 1).trim();
  }

  function renderStackAll() {
    var pillsEl = document.getElementById("stack-active-pills");
    var presetsEl = document.getElementById("universal-stack-presets");
    var capEl = document.getElementById("stack-preset-caption");
    if (!pillsEl || !presetsEl) return;

    presetsEl.innerHTML = STACK_PRESETS.map(function (p) {
      var act = universalStack.presetId === p.id;
      return (
        '<button type="button" class="filter-btn' +
        (act ? " is-active" : "") +
        '" data-upreset="' +
        escapeHtml(p.id) +
        '">' +
        escapeHtml(p.label) +
        "</button>"
      );
    }).join("");

    presetsEl.querySelectorAll("[data-upreset]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var pid = btn.getAttribute("data-upreset");
        var pr = STACK_PRESETS.find(function (x) { return x.id === pid; });
        if (!pr) return;
        universalStack.presetId = pid;
        universalStack.drugNames = pr.drugs.slice();
        universalStack.focusedEdgeKey = null;
        universalStack.focusedNodeId = null;
        if (capEl) capEl.textContent = pr.note;
        updateStackCountBadge();
        pr.drugs.forEach(ensureStackProfile);
        renderStackAll();
      });
    });

    pillsEl.innerHTML = universalStack.drugNames
      .map(function (d) {
        return (
          '<span class="active-drug-pill">' +
          '<button type="button" data-open-dossier="' +
          escapeHtml(d) +
          '" style="background:none;border:none;color:inherit;font:inherit;cursor:pointer;padding:0;">' +
          escapeHtml(d) +
          "</button>" +
          '<button type="button" class="pill-remove-x" data-rm-drug="' +
          escapeHtml(d) +
          '" aria-label="Remove ' +
          escapeHtml(d) +
          '">×</button>' +
          "</span>"
        );
      })
      .join("");

    pillsEl.querySelectorAll("[data-rm-drug]").forEach(function (b) {
      b.addEventListener("click", function () {
        removeDrugFromStack(b.getAttribute("data-rm-drug"));
      });
    });

    pillsEl.querySelectorAll("[data-open-dossier]").forEach(function (b) {
      b.addEventListener("click", function () {
        switchView("explorer");
        loadCompoundDossier(b.getAttribute("data-open-dossier"));
      });
    });

    var model = buildStackGraphAndFindings();
    renderUniversalPathwaySvg(model);
    renderUniversalRiskSummary(model);
  }

  function renderUniversalPathwaySvg(model) {
    var svg = document.getElementById("pathway-svg");
    var bar = document.getElementById("edge-inspector-bar");
    if (!svg) return;

    var W = 840;
    var maxRows = Math.max(model.profiles.length, model.targets.length, UNIVERSAL_AXES.length, 4);
    var H = Math.max(440, maxRows * 62 + 72);
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);

    function yPos(count, boxH) {
      var top = 54;
      var bot = H - 22;
      var span = bot - top;
      if (count <= 1) return [Math.round(top + span / 2 - boxH / 2)];
      var step = (span - boxH) / (count - 1);
      var out = [];
      for (var i = 0; i < count; i++) out.push(Math.round(top + i * step));
      return out;
    }

    var bH = 46;
    var cY = yPos(model.profiles.length, bH);
    var tY = yPos(model.targets.length, bH);
    var aY = yPos(UNIVERSAL_AXES.length, bH);

    var cMap = {};
    model.profiles.forEach(function (p, i) {
      cMap[p.name] = { x: 18, y: cY[i], w: 200, h: bH, data: p };
    });

    var tMap = {};
    model.targets.forEach(function (t, i) {
      tMap[t.id] = { x: 320, y: tY[i], w: 204, h: bH, data: t };
    });

    var aMap = {};
    UNIVERSAL_AXES.forEach(function (a, i) {
      aMap[a.id] = { x: 622, y: aY[i], w: 200, h: bH, data: a };
    });

    if (!universalStack.focusedEdgeKey && model.edges.length > 0) {
      var convEdge = model.edges.find(function (e) { return (model.nodeHits[e.to] || 0) >= 2; });
      universalStack.focusedEdgeKey = (convEdge || model.edges[0]).key;
    }

    var parts = ['<rect width="' + W + '" height="' + H + '" fill="#0B0B0D" />'];
    parts.push('<text x="18" y="28" fill="#CFC9BC" font-size="10.5" font-weight="700" letter-spacing="1.1">01 // ACTIVE REGIMEN</text>');
    parts.push('<text x="320" y="28" fill="#CFC9BC" font-size="10.5" font-weight="700" letter-spacing="1.1">02 // CYP450 &amp; MOLECULAR NODES</text>');
    parts.push('<text x="622" y="28" fill="#CFC9BC" font-size="10.5" font-weight="700" letter-spacing="1.1">03 // CLINICAL RISK AXES</text>');
    parts.push('<line x1="18" y1="38" x2="822" y2="38" stroke="#CFC9BC" stroke-opacity="0.18" />');

    // Compound -> Target edges
    model.edges.forEach(function (e) {
      var s = cMap[e.from];
      var d = tMap[e.to];
      if (!s || !d) return;
      var x1 = s.x + s.w, y1 = s.y + s.h / 2;
      var x2 = d.x, y2 = d.y + d.h / 2;
      var col = e.isAlert ? "#E0645C" : "#4666A0";
      var isFoc = universalStack.focusedNodeId
        ? e.from === universalStack.focusedNodeId || e.to === universalStack.focusedNodeId
        : e.key === universalStack.focusedEdgeKey;
      parts.push(
        '<path class="graph-edge" data-ekey="' +
          escapeHtml(e.key) +
          '" d="M ' + x1 + "," + y1 + " C " + (x1 + 54) + "," + y1 + " " + (x2 - 54) + "," + y2 + " " + x2 + "," + y2 +
          '" fill="none" stroke="' + col + '" stroke-width="' + (isFoc ? "2.6" : "1.7") +
          '" stroke-opacity="' + (isFoc || !universalStack.focusedNodeId ? "0.86" : "0.24") + '" />'
      );
    });

    // Target -> Axis edges
    model.targets.forEach(function (t) {
      var s = tMap[t.id];
      var d = aMap[t.axis];
      if (!s || !d) return;
      var x1 = s.x + s.w, y1 = s.y + s.h / 2;
      var x2 = d.x, y2 = d.y + d.h / 2;
      var multi = (model.nodeHits[t.id] || 0) >= 2;
      parts.push(
        '<path d="M ' + x1 + "," + y1 + " C " + (x1 + 50) + "," + y1 + " " + (x2 - 50) + "," + y2 + " " + x2 + "," + y2 +
          '" fill="none" stroke="' + (multi ? "#E0645C" : "#6D7993") + '" stroke-width="' + (multi ? "2.2" : "1.4") + '" stroke-opacity="0.78" />'
      );
    });

    // Nodes: Compounds
    model.profiles.forEach(function (p) {
      var b = cMap[p.name];
      var foc = universalStack.focusedNodeId === p.name;
      parts.push(
        '<g class="graph-node" data-nid="' + escapeHtml(p.name) + '">' +
          '<rect x="' + b.x + '" y="' + b.y + '" width="' + b.w + '" height="' + b.h + '" rx="6" fill="#12141A" stroke="' + (foc ? "#E0645C" : "#4666A0") + '" stroke-width="' + (foc ? "2" : "1.3") + '" />' +
          '<text x="' + (b.x + 11) + '" y="' + (b.y + 19) + '" fill="#E8ECE8" font-size="12" font-weight="700">' + escapeHtml(truncateClean(p.name, 22)) + "</text>" +
          '<text x="' + (b.x + 11) + '" y="' + (b.y + 35) + '" fill="#8C938D" font-size="10" font-family="monospace">' + escapeHtml(truncateClean(p.classLabel || "Active Agent", 25)) + "</text>" +
        "</g>"
      );
    });

    // Nodes: Targets
    model.targets.forEach(function (t) {
      var b = tMap[t.id];
      var hits = model.nodeHits[t.id] || 0;
      var conv = hits >= 2;
      var foc = universalStack.focusedNodeId === t.id;
      parts.push(
        '<g class="graph-node" data-nid="' + escapeHtml(t.id) + '">' +
          '<rect x="' + b.x + '" y="' + b.y + '" width="' + b.w + '" height="' + b.h + '" rx="6" fill="' + (conv ? "#1B1417" : "#12141A") + '" stroke="' + (conv || foc ? "#E0645C" : "rgba(207,201,188,0.45)") + '" stroke-width="' + (conv || foc ? "1.8" : "1.2") + '" />' +
          '<text x="' + (b.x + 11) + '" y="' + (b.y + 19) + '" fill="#E8ECE8" font-size="12" font-weight="700">' + escapeHtml(t.name) + "</text>" +
          '<text x="' + (b.x + 11) + '" y="' + (b.y + 35) + '" fill="' + (conv ? "#E0645C" : "#8C938D") + '" font-size="10" font-family="monospace">' + (conv ? hits + "x SHARED · " + escapeHtml(t.sub) : escapeHtml(t.sub)) + "</text>" +
        "</g>"
      );
    });

    // Nodes: Axes
    UNIVERSAL_AXES.forEach(function (a) {
      var b = aMap[a.id];
      var sc = model.axisScores[a.id] || 0;
      parts.push(
        '<g opacity="' + (sc > 0 ? "1" : "0.42") + '">' +
          '<rect x="' + b.x + '" y="' + b.y + '" width="' + b.w + '" height="' + b.h + '" rx="6" fill="#101217" stroke="' + (sc >= 70 ? "#E0645C" : "rgba(207,201,188,0.38)") + '" stroke-width="1.2" />' +
          '<text x="' + (b.x + 11) + '" y="' + (b.y + 19) + '" fill="#E8ECE8" font-size="11.5" font-weight="700">' + escapeHtml(truncateClean(a.name, 25)) + "</text>" +
          '<text x="' + (b.x + 11) + '" y="' + (b.y + 35) + '" fill="#8C938D" font-size="10" font-family="monospace">Load Index: ' + sc + "/100</text>" +
        "</g>"
      );
    });

    svg.innerHTML = parts.join("");

    svg.querySelectorAll(".graph-edge").forEach(function (el) {
      el.addEventListener("click", function () {
        universalStack.focusedEdgeKey = el.getAttribute("data-ekey");
        universalStack.focusedNodeId = null;
        renderUniversalPathwaySvg(model);
      });
    });

    svg.querySelectorAll(".graph-node").forEach(function (el) {
      el.addEventListener("click", function () {
        var nid = el.getAttribute("data-nid");
        universalStack.focusedNodeId = universalStack.focusedNodeId === nid ? null : nid;
        renderUniversalPathwaySvg(model);
      });
    });

    if (bar) {
      var sel =
        model.edges.find(function (e) { return e.key === universalStack.focusedEdgeKey; }) ||
        model.edges[0];
      if (sel) {
        bar.innerHTML =
          '<div><span style="font-size:0.68rem; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; color:var(--accent-coral); display:block;">Selected Edge Inspector (Click Any Node or Curve)</span>' +
          '<strong style="font-size:0.9rem;">' + escapeHtml(sel.from) + " → " + escapeHtml(sel.targetName) + " (" + escapeHtml(sel.modeWord) + ")</strong></div>" +
          '<button type="button" class="btn btn-outline-dark btn-xs" id="inspect-edge-drug-btn">Open ' + escapeHtml(sel.from) + " Dossier →</button>";
        var btnOpen = document.getElementById("inspect-edge-drug-btn");
        if (btnOpen) {
          btnOpen.addEventListener("click", function () {
            switchView("explorer");
            loadCompoundDossier(sel.from);
          });
        }
      }
    }
  }

  function renderUniversalRiskSummary(model) {
    var banner = document.getElementById("risk-overall-banner");
    var titleEl = document.getElementById("risk-overall-title");
    var edgeCountEl = document.getElementById("risk-edge-count");
    var axesEl = document.getElementById("axis-breakdown-list");
    var fCountEl = document.getElementById("findings-count-label");
    var fListEl = document.getElementById("stack-findings-list");
    if (!banner || !axesEl || !fListEl) return;

    var maxScore = 0;
    Object.keys(model.axisScores).forEach(function (k) {
      if (model.axisScores[k] > maxScore) maxScore = model.axisScores[k];
    });
    var hasCrit = model.findings.some(function (f) { return f.severity === "critical" || f.severity === "elevated"; });

    banner.className = "risk-overall-banner " + (hasCrit || maxScore >= 72 ? "level-high" : maxScore >= 46 || model.findings.length > 0 ? "level-moderate" : "level-low");
    titleEl.textContent = hasCrit || maxScore >= 72 ? "Elevated Interaction Signal" : maxScore >= 46 || model.findings.length > 0 ? "Moderate Pathway Overlap" : "Low Collision Signal";
    edgeCountEl.textContent = model.edges.length + " Edges";

    axesEl.innerHTML = UNIVERSAL_AXES.map(function (ax) {
      var val = model.axisScores[ax.id] || 0;
      var activeSegs = Math.round(val / 10);
      var cls = val >= 70 ? "filled-high" : val >= 40 ? "filled-mod" : "filled-low";
      var segs = "";
      for (var i = 0; i < 10; i++) segs += '<span class="seg-block' + (i < activeSegs ? " " + cls : "") + '"></span>';
      return (
        '<div><div class="axis-item-top"><strong>' +
        escapeHtml(ax.name) +
        '</strong><span class="mono-code">' +
        val +
        "/100</span></div><div class=\"severity-segments\">" +
        segs +
        "</div></div>"
      );
    }).join("");

    fCountEl.textContent = model.findings.length + " Flags";
    if (model.findings.length === 0) {
      fListEl.innerHTML =
        '<div class="finding-card sev-favorable"><strong style="font-size:0.84rem; display:block; margin-bottom:4px;">No High-Severity Shared Enzymatic or Receptor Collisions Flagged</strong><p style="margin:0; font-size:0.78rem; color:var(--text-secondary);">Active agents show low convergence across mapped CYP450, serotonergic, hemodynamic, and CNS-depressant nodes.</p></div>';
    } else {
      fListEl.innerHTML = model.findings
        .map(function (f) {
          return (
            '<div class="finding-card sev-' + escapeHtml(f.severity) + '">' +
            '<span class="mono-code" style="font-size:0.68rem; color:var(--text-muted); display:block; margin-bottom:3px;">' + escapeHtml(f.badge) + "</span>" +
            '<strong style="font-size:0.84rem; display:block; margin-bottom:4px;">' + escapeHtml(f.title) + "</strong>" +
            '<p style="margin:0; font-size:0.78rem; color:var(--text-secondary); line-height:1.45;">' + escapeHtml(f.detail) + "</p>" +
            "</div>"
          );
        })
        .join("");
    }
  }

  /* ------------------------------------------------------------------------
     9. View 03: Global PubMed Evidence Explorer & 5-Tier Grading Rules
     ------------------------------------------------------------------------ */
  var activeCaseId = CURATED.evidenceGrading.cases[0] ? CURATED.evidenceGrading.cases[0].id : "";
  var ledgerGradeFilter = "all";
  var ledgerExpanded = { "sc-01": true, "sc-11": true };

  function initEvidenceExplorer() {
    // 5-tier cards
    var grid = document.getElementById("tier-cards-grid");
    if (grid) {
      grid.innerHTML = CURATED.evidenceGrading.tiers
        .map(function (t) {
          var pct = Math.round(parseFloat(t.weight) * 100);
          return (
            '<article class="tier-column-card tier-card-' + escapeHtml(t.grade) + '">' +
            "<div>" +
            '<div style="display:flex; justify-content:space-between; align-items:center;">' +
            gradeBadgeHtml(t.grade) +
            '<span class="mono-code" style="font-size:0.72rem; color:var(--text-muted);">Ceiling ' + escapeHtml(t.weight) + "</span></div>" +
            '<div class="tier-weight-bar"><div class="tier-weight-fill" style="width:' + pct + '%;"></div></div>' +
            '<h3 style="font-size:0.95rem; margin:10px 0 6px 0;">' + escapeHtml(t.title) + "</h3>" +
            '<p style="font-size:0.78rem; color:var(--text-secondary); margin:0 0 10px 0;">' + escapeHtml(t.scope) + "</p>" +
            '<div style="padding:8px; background:var(--bg-canvas); border:1px solid var(--stone-line); border-radius:4px; font-size:0.74rem; color:var(--text-secondary);"><strong>Rule:</strong> ' +
            escapeHtml(t.rule) +
            "</div></div>" +
            '<div class="mono-code" style="font-size:0.7rem; color:var(--stone-solid); border-top:1px solid var(--stone-line); padding-top:8px;">' +
            escapeHtml(t.allowed) +
            "</div></article>"
          );
        })
        .join("");
    }

    renderComparator();
    renderReferenceLedger();

    var gradeGroup = document.getElementById("grade-filters");
    if (gradeGroup) {
      gradeGroup.querySelectorAll(".filter-btn").forEach(function (btn) {
        btn.addEventListener("click", function () {
          gradeGroup.querySelectorAll(".filter-btn").forEach(function (b) { b.classList.remove("is-active"); });
          btn.classList.add("is-active");
          ledgerGradeFilter = btn.getAttribute("data-grade");
          renderReferenceLedger();
        });
      });
    }

    var pubForm = document.getElementById("global-pubmed-form");
    var pubResults = document.getElementById("global-pubmed-results");
    if (pubForm && pubResults) {
      pubForm.addEventListener("submit", function (ev) {
        ev.preventDefault();
        var comp = document.getElementById("ev-compound-input").value.trim();
        var out = document.getElementById("ev-outcome-input").value.trim();
        var tier = document.getElementById("ev-tier-select").value;
        if (!comp) return;
        pubResults.innerHTML = '<div style="padding:14px; color:var(--text-muted); font-size:0.84rem;">Querying NCBI PubMed live index…</div>';
        fetchPubMedBundle(comp, out, tier, null)
          .then(function (res) {
            if (!res.papers.length) {
              pubResults.innerHTML = '<div style="padding:14px; color:var(--text-muted);">No PubMed papers matched that exact compound + tier query.</div>';
              return;
            }
            pubResults.innerHTML = res.papers
              .map(function (p) {
                return (
                  '<div class="paper-row">' +
                  "<div>" + gradeBadgeHtml(p.grade, p.tierLabel) + "</div>" +
                  '<div><p class="paper-title">' + escapeHtml(p.title) + '</p><div class="paper-meta">' + escapeHtml(p.author) + " · <em>" + escapeHtml(p.journal) + "</em> (" + escapeHtml(p.pubdate) + ")</div></div>" +
                  '<a href="' + pubmedUrl(p.pmid) + '" target="_blank" rel="noopener noreferrer" class="mono-code" style="font-size:0.78rem; white-space:nowrap;">PMID: ' + escapeHtml(p.pmid) + " ↗</a>" +
                  "</div>"
                );
              })
              .join("");
          })
          .catch(function () {
            pubResults.innerHTML = '<div style="padding:14px; color:var(--text-muted);">PubMed query unavailable right now.</div>';
          });
      });
    }
  }

  function renderComparator() {
    var tabsEl = document.getElementById("comparator-case-tabs");
    var titleEl = document.getElementById("comparator-case-title");
    var sumEl = document.getElementById("comparator-case-summary");
    var rowsEl = document.getElementById("comparator-rows");
    if (!tabsEl || !rowsEl) return;

    var cObj = CURATED.evidenceGrading.cases.find(function (c) { return c.id === activeCaseId; }) || CURATED.evidenceGrading.cases[0];
    if (!cObj) return;

    titleEl.textContent = cObj.name;
    sumEl.textContent = cObj.summary;

    tabsEl.innerHTML = CURATED.evidenceGrading.cases
      .map(function (c) {
        var shortL = c.name.split("·")[0].trim();
        return '<button type="button" class="filter-btn' + (c.id === cObj.id ? " is-active" : "") + '" data-cid="' + escapeHtml(c.id) + '">' + escapeHtml(shortL) + "</button>";
      })
      .join("");

    tabsEl.querySelectorAll("[data-cid]").forEach(function (b) {
      b.addEventListener("click", function () {
        activeCaseId = b.getAttribute("data-cid");
        renderComparator();
      });
    });

    rowsEl.innerHTML = cObj.rows
      .map(function (r) {
        return (
          '<div class="comparator-row">' +
          "<div>" + gradeBadgeHtml(r.grade) + "</div>" +
          '<div style="font-weight:700; font-size:0.86rem;">' + escapeHtml(r.status) + "</div>" +
          '<div style="font-size:0.82rem; color:var(--text-secondary);">' + escapeHtml(r.detail) + "</div>" +
          '<div class="mono-code" style="font-size:0.75rem; text-align:right;"><div>' + escapeHtml(r.metric) + '</div><a href="' + pubmedUrl(r.pmid) + '" target="_blank" rel="noopener noreferrer">PMID: ' + escapeHtml(r.pmid) + " ↗</a></div>" +
          "</div>"
        );
      })
      .join("");
  }

  function renderReferenceLedger() {
    var tbody = document.getElementById("study-ledger-tbody");
    if (!tbody) return;
    var list = CURATED.studyClaims.filter(function (r) {
      return ledgerGradeFilter === "all" || r.grade === ledgerGradeFilter;
    });

    tbody.innerHTML = list
      .map(function (r) {
        var exp = !!ledgerExpanded[r.id];
        var row =
          '<tr data-scid="' + escapeHtml(r.id) + '" style="cursor:pointer;">' +
          "<td><strong>" + escapeHtml(r.compound) + '</strong><div style="font-size:0.72rem; color:var(--text-muted);">' + escapeHtml(r.domainLabel) + " " + (exp ? "[▲]" : "[Audit ▾]") + "</div></td>" +
          "<td>" + escapeHtml(r.endpoint) + "</td>" +
          "<td>" + gradeBadgeHtml(r.grade) + "</td>" +
          '<td style="color:var(--text-secondary);">' + escapeHtml(r.model) + "</td>" +
          '<td class="mono-code">' + escapeHtml(r.effect) + "</td>" +
          '<td class="mono-code"><a href="' + pubmedUrl(r.pmid) + '" target="_blank" rel="noopener noreferrer" class="stop-prop">PMID: ' + escapeHtml(r.pmid) + " ↗</a></td>" +
          "</tr>";

        var audit = exp
          ? '<tr><td colspan="6" style="background:var(--bg-canvas); border-left:3px solid var(--action-blue); padding:12px 16px;">' +
            '<div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px,1fr)); gap:12px; font-size:0.78rem; color:var(--text-secondary);">' +
            "<div><strong style=\"color:var(--stone-solid); display:block;\">Design</strong>" + escapeHtml(r.audit.design) + "</div>" +
            "<div><strong style=\"color:var(--stone-solid); display:block;\">Dosing &amp; Exposure Parity</strong>" + escapeHtml(r.audit.dosingParity) + "</div>" +
            "<div><strong style=\"color:var(--stone-solid); display:block;\">Limitations</strong>" + escapeHtml(r.audit.limitation) + "</div>" +
            "<div><strong style=\"color:var(--stone-solid); display:block;\">Grade Rationale</strong>" + escapeHtml(r.audit.rationale) + "</div>" +
            "</div></td></tr>"
          : "";
        return row + audit;
      })
      .join("");

    tbody.querySelectorAll(".stop-prop").forEach(function (a) {
      a.addEventListener("click", function (ev) { ev.stopPropagation(); });
    });
    tbody.querySelectorAll("[data-scid]").forEach(function (tr) {
      tr.addEventListener("click", function () {
        var id = tr.getAttribute("data-scid");
        ledgerExpanded[id] = !ledgerExpanded[id];
        renderReferenceLedger();
      });
    });
  }

  /* ------------------------------------------------------------------------
     10. View 04: Sagittal Brain Atlas
     ------------------------------------------------------------------------ */
  var atlasState = {
    systemId: CURATED.brainAtlas.systems[0] ? CURATED.brainAtlas.systems[0].id : "5ht",
    regionId: "hippocampus"
  };

  function updateBrainAtlas() {
    var tabsEl = document.getElementById("atlas-system-tabs");
    var genesEl = document.getElementById("atlas-active-genes");
    var layerEl = document.getElementById("atlas-pins-layer");
    var regBtnsEl = document.getElementById("atlas-region-buttons");
    var bodyEl = document.getElementById("atlas-inspector-body");
    var mniEl = document.getElementById("atlas-mni-coord");
    if (!tabsEl || !layerEl || !bodyEl) return;

    var sys = CURATED.brainAtlas.systems.find(function (s) { return s.id === atlasState.systemId; }) || CURATED.brainAtlas.systems[0];
    if (genesEl && sys) genesEl.textContent = sys.genePair;

    tabsEl.innerHTML = CURATED.brainAtlas.systems
      .map(function (s) {
        return '<button type="button" class="filter-btn' + (s.id === atlasState.systemId ? " is-active" : "") + '" data-asys="' + escapeHtml(s.id) + '">' + escapeHtml(s.label) + "</button>";
      })
      .join("");

    tabsEl.querySelectorAll("[data-asys]").forEach(function (b) {
      b.addEventListener("click", function () {
        atlasState.systemId = b.getAttribute("data-asys");
        updateBrainAtlas();
      });
    });

    layerEl.innerHTML = CURATED.brainAtlas.regions
      .map(function (r) {
        var sc = r.systemScores[atlasState.systemId] || 40;
        var rad = Math.round(7 + (sc / 100) * 11);
        var sel = r.id === atlasState.regionId;
        var col = sc >= 82 ? "#E0645C" : "#4666A0";
        var elbowX = r.side === "left" ? r.lx + 22 : r.lx - 22;
        var anchor = r.side === "left" ? "end" : "start";
        var tx = r.side === "left" ? r.lx - 4 : r.lx + 4;
        return (
          '<g class="brain-region-pin" tabindex="0" role="button" data-reg="' + escapeHtml(r.id) + '">' +
          '<path d="M ' + r.cx + "," + r.cy + " L " + elbowX + "," + r.ly + " L " + r.lx + "," + r.ly + '" fill="none" stroke="' + (sel ? "#E0645C" : "rgba(207,201,188,0.36)") + '" stroke-width="' + (sel ? "1.5" : "1") + '" />' +
          '<circle cx="' + r.cx + '" cy="' + r.cy + '" r="' + rad + '" fill="' + col + '" fill-opacity="' + (sel ? "0.45" : "0.22") + '" stroke="' + (sel ? "#E8ECE8" : col) + '" stroke-width="' + (sel ? "2" : "1.2") + '" />' +
          '<circle cx="' + r.cx + '" cy="' + r.cy + '" r="3" fill="' + (sel ? "#E8ECE8" : col) + '" />' +
          '<text x="' + tx + '" y="' + (r.ly + 4) + '" text-anchor="' + anchor + '" fill="' + (sel ? "#E8ECE8" : "#BAC0BA") + '" font-size="' + (sel ? "11" : "10.5") + '" font-weight="' + (sel ? "700" : "500") + '">' + escapeHtml(r.shortName) + " · " + sc + "</text>" +
          "</g>"
        );
      })
      .join("");

    layerEl.querySelectorAll("[data-reg]").forEach(function (g) {
      g.addEventListener("click", function () {
        atlasState.regionId = g.getAttribute("data-reg");
        updateBrainAtlas();
      });
    });

    if (regBtnsEl) {
      regBtnsEl.innerHTML = CURATED.brainAtlas.regions
        .map(function (r) {
          return '<button type="button" class="filter-btn' + (r.id === atlasState.regionId ? " is-active" : "") + '" data-rbtn="' + escapeHtml(r.id) + '">' + escapeHtml(r.shortName) + "</button>";
        })
        .join("");
      regBtnsEl.querySelectorAll("[data-rbtn]").forEach(function (b) {
        b.addEventListener("click", function () {
          atlasState.regionId = b.getAttribute("data-rbtn");
          updateBrainAtlas();
        });
      });
    }

    var reg = CURATED.brainAtlas.regions.find(function (r) { return r.id === atlasState.regionId; }) || CURATED.brainAtlas.regions[0];
    if (!reg) return;
    if (mniEl) mniEl.textContent = "MNI " + reg.mni;

    bodyEl.innerHTML =
      '<h3 style="margin:0 0 6px 0; font-size:1.2rem;">' + escapeHtml(reg.name) + ' <span class="mono-code" style="font-size:0.75rem; color:var(--text-muted);">' + escapeHtml(reg.code) + "</span></h3>" +
      '<p style="font-size:0.84rem; color:var(--text-secondary); margin:0 0 14px 0;">' + escapeHtml(reg.summary) + "</p>" +
      '<div style="font-size:0.72rem; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; color:var(--stone-solid); margin-bottom:8px;">Allen Human Brain Atlas Transcripts</div>' +
      reg.transcripts
        .map(function (t) {
          return (
            '<div class="transcript-row"><span class="mono-code" style="font-weight:700;">' + escapeHtml(t.gene) + '</span>' +
            '<div class="bar-track"><div class="bar-fill' + (t.density >= 85 ? " is-high" : "") + '" style="width:' + t.density + '%;"></div></div>' +
            '<span class="mono-code" style="font-size:0.75rem; color:var(--text-secondary); text-align:right;">' + escapeHtml(t.z) + "</span></div>"
          );
        })
        .join("") +
      '<div style="font-size:0.72rem; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; color:var(--stone-solid); margin:16px 0 8px 0;">Reference CNS Compounds Active Here</div>' +
      reg.compounds
        .map(function (c) {
          return (
            '<div style="padding:9px 11px; background:var(--bg-canvas); border:1px solid var(--stone-line); border-radius:4px; margin-bottom:7px;">' +
            '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:3px;"><strong style="font-size:0.85rem;">' + escapeHtml(c.name) + "</strong>" + gradeBadgeHtml(c.grade) + "</div>" +
            '<div style="font-size:0.78rem; color:var(--text-secondary);">' + escapeHtml(c.metric) + "</div>" +
            '<div style="display:flex; justify-content:space-between; font-size:0.72rem; color:var(--text-muted); margin-top:4px;"><span class="mono-code">Kp,uu: ' + escapeHtml(c.kpuu) + '</span><a href="' + pubmedUrl(c.pmid) + '" target="_blank" rel="noopener noreferrer" class="mono-code">PMID: ' + escapeHtml(c.pmid) + " ↗</a></div></div>"
          );
        })
        .join("");
  }

  /* ------------------------------------------------------------------------
     11. View 05: Private Browser-Local Protocol Log
     ------------------------------------------------------------------------ */
  var STORAGE_KEY = "pharmapedia_protocol_log_v2";
  var protocolEntries = (function () {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var p = JSON.parse(raw);
        if (Array.isArray(p)) return p;
      }
    } catch (e) {}
    return [
      { name: "Rosuvastatin", dose: "10 mg", schedule: "PM Dinner" },
      { name: "Metformin XR", dose: "1000 mg", schedule: "PM Dinner" },
      { name: "Ubiquinol", dose: "200 mg", schedule: "AM With Meal" }
    ];
  })();

  function saveProtocol() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(protocolEntries));
    } catch (e) {}
    var badge = document.getElementById("protocol-tab-count");
    if (badge) badge.textContent = String(protocolEntries.length);
  }

  function renderProtocol() {
    saveProtocol();
    var listEl = document.getElementById("protocol-log-list");
    if (!listEl) return;

    if (protocolEntries.length === 0) {
      listEl.innerHTML = '<div style="padding:16px; text-align:center; color:var(--text-muted); border:1px dashed var(--stone-line-strong); border-radius:4px; font-size:0.84rem;">No entries in local browser log.</div>';
      return;
    }

    listEl.innerHTML = protocolEntries
      .map(function (e, i) {
        return (
          '<div class="protocol-entry">' +
          "<strong>" + escapeHtml(e.name) + "</strong>" +
          '<span class="mono-code" style="color:var(--text-secondary);">' + escapeHtml(e.dose) + "</span>" +
          '<span style="color:var(--text-muted); font-size:0.78rem;">' + escapeHtml(e.schedule) + "</span>" +
          '<button type="button" class="btn btn-outline-dark btn-xs" data-rm-prot="' + i + '">Remove</button>' +
          "</div>"
        );
      })
      .join("");

    listEl.querySelectorAll("[data-rm-prot]").forEach(function (b) {
      b.addEventListener("click", function () {
        protocolEntries.splice(parseInt(b.getAttribute("data-rm-prot"), 10), 1);
        renderProtocol();
      });
    });
  }

  function buildMarkdownBrief() {
    var model = buildStackGraphAndFindings();
    var lines = [
      "# Pharmapedia Clinical Regimen & Interaction Brief",
      "Generated client-side · Zero server transmission · Verify with a licensed clinician.",
      "",
      "## Logged Regimen"
    ];
    protocolEntries.forEach(function (e) {
      lines.push("- **" + e.name + "** — " + e.dose + " (" + e.schedule + ")");
    });
    lines.push("", "## Active Stack Audit (" + universalStack.drugNames.join(", ") + ")");
    if (model.findings.length === 0) {
      lines.push("- No high-severity pathway collisions flagged.");
    } else {
      model.findings.forEach(function (f) {
        lines.push("- **[" + f.badge + "] " + f.title + "**: " + f.detail);
      });
    }
    return lines.join("\n");
  }

  /* ------------------------------------------------------------------------
     12. Master Event Wiring & Startup
     ------------------------------------------------------------------------ */
  document.addEventListener("DOMContentLoaded", function () {
    // Mode tabs
    document.querySelectorAll(".mode-tab-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        switchView(btn.getAttribute("data-view"));
      });
    });

    var brandLink = document.getElementById("brand-reset-link");
    if (brandLink) {
      brandLink.addEventListener("click", function (ev) {
        ev.preventDefault();
        switchView("explorer");
      });
    }

    // Global Omnibox Search + Autocomplete + '/' Shortcut
    var omniInput = document.getElementById("global-omnibox-input");
    var omniDrop = document.getElementById("omnibox-autocomplete");
    var omniForm = document.getElementById("global-search-form");

    attachAutocomplete(omniInput, omniDrop, function (picked) {
      omniInput.value = picked;
      switchView("explorer");
      loadCompoundDossier(picked);
    });

    if (omniForm) {
      omniForm.addEventListener("submit", function (ev) {
        ev.preventDefault();
        if (omniInput && omniInput.value.trim()) {
          omniDrop.classList.remove("is-open");
          switchView("explorer");
          loadCompoundDossier(omniInput.value.trim());
        }
      });
    }

    document.addEventListener("keydown", function (ev) {
      if (ev.key === "/" && document.activeElement && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) {
        ev.preventDefault();
        if (omniInput) omniInput.focus();
      }
    });

    var randomBtn = document.getElementById("random-compound-btn");
    if (randomBtn) {
      randomBtn.addEventListener("click", function () {
        var pick = CATALOG[Math.floor(Math.random() * CATALOG.length)];
        if (pick) {
          switchView("explorer");
          loadCompoundDossier(pick.name);
        }
      });
    }

    // Dossier Header Buttons
    var addStackBtn = document.getElementById("dossier-add-stack-btn");
    if (addStackBtn) {
      addStackBtn.addEventListener("click", function () {
        if (isCompoundInStack(currentDossierState.name)) {
          switchView("stack");
        } else {
          addDrugToStack(currentDossierState.name);
          showToast("Added " + currentDossierState.name + " to Stack Checker.");
        }
      });
    }

    var openStackBtn = document.getElementById("dossier-open-stack-view-btn");
    if (openStackBtn) {
      openStackBtn.addEventListener("click", function () {
        switchView("stack");
      });
    }

    var logDoseBtn = document.getElementById("dossier-log-dose-btn");
    if (logDoseBtn) {
      logDoseBtn.addEventListener("click", function () {
        protocolEntries.push({
          name: currentDossierState.name,
          dose: "Standard Regimen",
          schedule: "AM / Per Label"
        });
        renderProtocol();
        showToast("Logged " + currentDossierState.name + " to local Protocol Log.");
      });
    }

    // Dark/Light Structure Plate Toggle
    var plateBtn = document.getElementById("toggle-plate-btn");
    var stageEl = document.getElementById("structure-stage");
    if (plateBtn && stageEl) {
      plateBtn.addEventListener("click", function () {
        var light = stageEl.classList.toggle("light-plate");
        plateBtn.textContent = light ? "Dark Plate" : "Light Plate";
      });
    }

    // Dossier PubMed Sub-filter
    var subForm = document.getElementById("dossier-pubmed-subform");
    var subInput = document.getElementById("dossier-pubmed-endpoint-input");
    var subReset = document.getElementById("dossier-pubmed-reset-btn");
    if (subForm && subInput) {
      subForm.addEventListener("submit", function (ev) {
        ev.preventDefault();
        currentDossierState.endpointQuery = subInput.value.trim();
        rerunDossierPubMedSubquery();
      });
    }
    if (subReset && subInput) {
      subReset.addEventListener("click", function () {
        subInput.value = "";
        currentDossierState.endpointQuery = "";
        currentDossierState.selectedTier = "all";
        rerunDossierPubMedSubquery();
      });
    }

    // Stack Lab Search & Controls
    var stackSearchInput = document.getElementById("stack-drug-search-input");
    var stackDrop = document.getElementById("stack-autocomplete");
    var stackForm = document.getElementById("stack-add-drug-form");

    attachAutocomplete(stackSearchInput, stackDrop, function (picked) {
      stackSearchInput.value = "";
      addDrugToStack(picked);
      showToast("Added " + picked + " to active stack.");
    });

    if (stackForm && stackSearchInput) {
      stackForm.addEventListener("submit", function (ev) {
        ev.preventDefault();
        if (stackSearchInput.value.trim()) {
          var val = stackSearchInput.value.trim();
          stackSearchInput.value = "";
          stackDrop.classList.remove("is-open");
          addDrugToStack(val);
          showToast("Added " + val + " to active stack.");
        }
      });
    }

    var syncProtBtn = document.getElementById("sync-stack-to-protocol-btn");
    if (syncProtBtn) {
      syncProtBtn.addEventListener("click", function () {
        protocolEntries = universalStack.drugNames.map(function (d) {
          return { name: d, dose: "Active Stack", schedule: "Daily" };
        });
        renderProtocol();
        switchView("protocol");
        showToast("Synced active stack to Protocol Log.");
      });
    }

    // Protocol Log Form & Export
    var protForm = document.getElementById("protocol-add-form");
    if (protForm) {
      protForm.addEventListener("submit", function (ev) {
        ev.preventDefault();
        var n = document.getElementById("protocol-name-input").value.trim();
        var d = document.getElementById("protocol-dose-input").value.trim();
        var s = document.getElementById("protocol-schedule-select").value;
        if (!n || !d) return;
        protocolEntries.push({ name: n, dose: d, schedule: s });
        document.getElementById("protocol-name-input").value = "";
        document.getElementById("protocol-dose-input").value = "";
        renderProtocol();
        showToast("Added " + n + " to local log.");
      });
    }

    var expBtn = document.getElementById("export-markdown-btn");
    if (expBtn) {
      expBtn.addEventListener("click", function () {
        var md = buildMarkdownBrief();
        var blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url;
        a.download = "pharmapedia-clinical-brief.md";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 600);
        showToast("Downloaded pharmapedia-clinical-brief.md");
      });
    }

    var copyBtn = document.getElementById("copy-markdown-btn");
    if (copyBtn) {
      copyBtn.addEventListener("click", function () {
        var md = buildMarkdownBrief();
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(md).then(function () {
            showToast("Copied Markdown brief to clipboard.");
          });
        }
      });
    }

    var clrBtn = document.getElementById("clear-protocol-btn");
    if (clrBtn) {
      clrBtn.addEventListener("click", function () {
        protocolEntries = [];
        renderProtocol();
        showToast("Cleared local protocol log.");
      });
    }

    // Boot all modules
    initSidebarDirectory();
    renderRecentChips();
    universalStack.drugNames.forEach(ensureStackProfile);
    renderStackAll();
    initEvidenceExplorer();
    updateBrainAtlas();
    renderProtocol();

    // Support URL hash or ?q= deep-linking (e.g. ?q=Atorvastatin)!
    var params = new URLSearchParams(window.location.search);
    var initialCompound = params.get("q") || "Semaglutide";
    loadCompoundDossier(initialCompound);
  });
})();
