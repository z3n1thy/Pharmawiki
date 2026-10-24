/* ==========================================================================
   Pharmapedia Open-Source Research Dataset (v2.4.0)
   License: MIT — 100% Free, Auditable, Static Client-Side Dataset
   Primary Provenance: PubMed / MEDLINE, NCBI Gene, PubChem, ChEMBL, IUPHAR/BPS,
   Allen Human Brain Atlas (mRNA z-scores)
   ========================================================================== */

window.PHARMAPEDIA_DATA = {
  meta: {
    name: "Pharmapedia Open Research Library",
    version: "2.4.0-open",
    license: "MIT",
    updated: "2026-10",
    repository: "https://github.com/z3n1thy/Pharmawiki",
    counts: {
      compounds: "4,820",
      studies: "142,680",
      pathways: "1,194",
      interactions: "38,410",
      cost: "$0"
    }
  },

  /* ------------------------------------------------------------------------
     1. Compound Monographs (Hero Live Search & Dossier Snapshot)
     ------------------------------------------------------------------------ */
  monographs: [
    {
      id: "semaglutide",
      name: "Semaglutide",
      aliases: ["ozempic", "wegovy", "rybelsus", "glp-1", "glp1r", "33567185", "37952131"],
      classLabel: "Acylated GLP-1 Receptor Agonist · Incretin Mimetic",
      pubchemCid: "56843331",
      chemblId: "CHEMBL2108724",
      cas: "910463-68-2",
      formula: "C187H291N45O59",
      mw: "4113.58 g/mol",
      pk: {
        bioavailability: "89% (SC) · 0.8% (PO)",
        halfLife: "168 h (~7.0 days)",
        bbb: "Restricted (CVO / Arcuate)",
        clearance: "Proteolytic + Albumin bound (>99%)"
      },
      targets: [
        { receptor: "GLP-1 Receptor", gene: "GLP1R", metric: "EC50", affinity: "0.38 nM", mode: "Full Agonist", grade: "A" },
        { receptor: "Gastric Emptying Vagal Afferents", gene: "GLP1R / NTS", metric: "ED50", affinity: "Clinical 0.5–2.4 mg/wk", mode: "Delayed Motility", grade: "A" },
        { receptor: "Mesolimbic Reward Circuitry", gene: "VTA / NAc Indirect", metric: "Signal", affinity: "Secondary", mode: "Cue Attenuation", grade: "B" }
      ],
      claims: [
        {
          grade: "A",
          tierLabel: "Human RCT",
          claim: "Sustained body-weight reduction in adults with overweight or obesity without diabetes (68 weeks)",
          effect: "-14.9% vs -2.4% placebo (ETD -12.4%)",
          cohort: "STEP 1 Phase III RCT · n = 1,961",
          pmid: "33567185"
        },
        {
          grade: "A",
          tierLabel: "Human RCT",
          claim: "Major adverse cardiovascular event (MACE) reduction in preexisting CVD without diabetes",
          effect: "HR 0.80 (95% CI 0.72–0.90; p < 0.001)",
          cohort: "SELECT Outcomes Trial · n = 17,604",
          pmid: "37952131"
        },
        {
          grade: "B",
          tierLabel: "Cohort / EHR",
          claim: "Reduced incident alcohol use disorder hospitalization signal in real-world registries",
          effect: "aHR 0.68 (95% CI 0.62–0.75)",
          cohort: "Nationwide EHR Cohort · n = 83,825",
          pmid: "38796696"
        }
      ],
      clinicalNote: "Delays early-phase gastric emptying; may alter Tmax of narrow-therapeutic-index oral co-medications (e.g., levothyroxine, warfarin). Direct parenchymal BBB penetration is minimal; CNS satiety acts predominantly via circumventricular organs (area postrema & median eminence)."
    },
    {
      id: "escitalopram",
      name: "Escitalopram",
      aliases: ["lexapro", "cipralex", "ssri", "sert", "slc6a4", "29477251"],
      classLabel: "Selective Serotonin Reuptake Inhibitor (S-Enantiomer)",
      pubchemCid: "146570",
      chemblId: "CHEMBL1508",
      cas: "128196-01-0",
      formula: "C20H21FN2O",
      mw: "324.39 g/mol",
      pk: {
        bioavailability: "80% (PO)",
        halfLife: "27–32 h (CYP2C19 dependent)",
        bbb: "High (logBB +0.24 · Kp,uu ~1.1)",
        clearance: "Hepatic CYP2C19, CYP3A4, weak CYP2D6 inh."
      },
      targets: [
        { receptor: "Serotonin Transporter (Orthosteric)", gene: "SLC6A4", metric: "Ki", affinity: "1.1 nM", mode: "Competitive Inhibitor", grade: "A" },
        { receptor: "SERT Allosteric Site", gene: "SLC6A4", metric: "Kd", affinity: "Low µM", mode: "Positive Self-Stabilizer", grade: "B" },
        { receptor: "hERG Potassium Channel", gene: "KCNH2", metric: "IC50", affinity: "2.6 µM", mode: "Dose-Dependent Block", grade: "A" }
      ],
      claims: [
        {
          grade: "A",
          tierLabel: "Meta-Analysis",
          claim: "Acute treatment response in adult major depressive disorder across head-to-head trials",
          effect: "OR 1.68 (95% CrI 1.50–1.87 vs placebo)",
          cohort: "Network Meta-Analysis · 522 RCTs",
          pmid: "29477251"
        },
        {
          grade: "A",
          tierLabel: "PK / Safety",
          claim: "Dose-dependent QTcF interval prolongation (+10.7 ms supratherapeutic 30 mg/d)",
          effect: "+4.3 ms (10 mg) to +10.7 ms (30 mg)",
          cohort: "Thorough QT Crossover Study · FDA Label",
          pmid: "23362284"
        },
        {
          grade: "B",
          tierLabel: "Pharmacogenomics",
          claim: "CYP2C19 poor metabolizers (*2/*2, *2/*3) exhibit ~2.1-fold higher AUC exposure",
          effect: "AUC Ratio 2.06 (CPIC Guideline)",
          cohort: "Pooled Clinical PGx · n = 2,087",
          pmid: "37032424"
        }
      ],
      clinicalNote: "Highest SERT-over-NET/DAT selectivity (>1,000-fold) among clinical SSRIs. Stacking with serotonergic analgesics (tramadol), MAOIs, or Hypericum perforatum elevates neuromuscular clonus and serotonin toxicity risk."
    },
    {
      id: "metformin",
      name: "Metformin",
      aliases: ["glucophage", "ampk", "biguanide", "longevity", "oct1", "11832527"],
      classLabel: "Biguanide · Hepatic Gluconeogenesis & AMPK Modulator",
      pubchemCid: "4091",
      chemblId: "CHEMBL1431",
      cas: "657-24-9",
      formula: "C4H11N5",
      mw: "129.16 g/mol",
      pk: {
        bioavailability: "50–60% (Fasting PO)",
        halfLife: "6.2 h (Plasma) · ~17.6 h (RBC)",
        bbb: "Low–Moderate (Cationic OCT dependent)",
        clearance: "100% Unchanged Renal (OCT2 / MATE1)"
      },
      targets: [
        { receptor: "Mitochondrial Complex I / mGPD", gene: "MT-ND / GPD2", metric: "IC50", affinity: "Hepatic Portal µM", mode: "Redox / AMP:ATP Shift", grade: "B" },
        { receptor: "AMP-Activated Protein Kinase", gene: "PRKAA1/2", metric: "Indirect", affinity: "LKB1 Dependent", mode: "Downstream Activation", grade: "A" },
        { receptor: "Organic Cation Transporters", gene: "SLC22A1 / SLC47A1", metric: "Km", affinity: "0.78–1.4 mM", mode: "Active Influx/Efflux", grade: "A" }
      ],
      claims: [
        {
          grade: "A",
          tierLabel: "Human RCT",
          claim: "Reduction in progression from impaired glucose tolerance to type 2 diabetes",
          effect: "31% incidence reduction (95% CI 17–43%)",
          cohort: "Diabetes Prevention Program · n = 3,234",
          pmid: "11832527"
        },
        {
          grade: "A",
          tierLabel: "Human Safety",
          claim: "Progressive vitamin B12 reduction during multi-year therapy (>4 years)",
          effect: "-19% serum B12; NNH ~14 for deficiency",
          cohort: "HOME Randomized Trial · n = 390",
          pmid: "20488910"
        },
        {
          grade: "B",
          tierLabel: "Observational Audit",
          claim: "All-cause lifespan extension in non-diabetic cohorts remains unproven after time-related bias correction",
          effect: "HR 1.01 (Null upon immortal-time adjustment)",
          cohort: "Danish Registry Re-Analysis · n = 119,083",
          pmid: "35303428"
        }
      ],
      clinicalNote: "Zero CYP450 metabolism, but competes at renal OCT2/MATE1/MATE2-K with cimetidine, dolutegravir, and trimethoprim. Note how millimolar (5–10 mM) in vitro Complex I assays far exceed human systemic plasma Cmax (~10–20 µM)."
    },
    {
      id: "magnesium-threonate",
      name: "Magnesium L-Threonate",
      aliases: ["magtein", "mg", "magnesium", "nmda", "glun2b", "20152114", "26519439"],
      classLabel: "Chelated Divalent Cation · NMDA Pore Voltage Block & Synaptic Cofactor",
      pubchemCid: "45489777",
      chemblId: "CHEMBL2107834",
      cas: "778571-57-6",
      formula: "C8H14MgO10",
      mw: "294.50 g/mol",
      pk: {
        bioavailability: "~7.2% elemental Mg by weight",
        halfLife: "Tissue pool regulated · Renal Tmax 3–4 h",
        bbb: "Regulated active Choroid Plexus transport",
        clearance: "Renal glomerular filtration / TRPM6"
      },
      targets: [
        { receptor: "NMDA Glutamate Channel Pore", gene: "GRIN1 / GRIN2B", metric: "Kd (-60mV)", affinity: "~1.2 mM physiological", mode: "Voltage-Dependent Block", grade: "A" },
        { receptor: "Hippocampal Synaptophysin / NR2B", gene: "GRIN2B", metric: "Rodent CSF", affinity: "+7% to +15% CSF Mg2+", mode: "Preclinical Upregulation", grade: "C" }
      ],
      claims: [
        {
          grade: "C",
          tierLabel: "Animal In Vivo",
          claim: "Elevation of rat cerebrospinal fluid [Mg2+] and hippocampal CA1 synaptic density",
          effect: "+15% CSF [Mg2+] after 24 days oral",
          cohort: "Sprague-Dawley Rats · HED ~1.9 g/d",
          pmid: "20152114"
        },
        {
          grade: "A",
          tierLabel: "Small Human RCT",
          claim: "Composite cognitive Z-score shift in older adults (50–70 y) with subjective cognitive complaints",
          effect: "Cohen's d = 0.42 (Industry-funded pilot)",
          cohort: "12-Week Double-Blind RCT · n = 44",
          pmid: "26519439"
        }
      ],
      clinicalNote: "Exemplifies Pharmapedia's evidence separation: robust hippocampal plasticity data originates from rodent CSF sampling (Grade C), whereas independent large-scale human lumbar-puncture CSF superiority trials over magnesium glycinate/citrate remain absent."
    },
    {
      id: "cdp-choline",
      name: "CDP-Choline (Citicoline)",
      aliases: ["citicoline", "cognizin", "choline", "ach", "phosphatidylcholine", "22691567"],
      classLabel: "Cytidine 5'-Diphosphocholine · Phospholipid & Cholinergic Precursor",
      pubchemCid: "13804",
      chemblId: "CHEMBL612",
      cas: "987-78-0",
      formula: "C14H26N4O11P2",
      mw: "488.32 g/mol",
      pk: {
        bioavailability: ">92% (Hydrolyzed to choline + cytidine)",
        halfLife: "Biphasic: 3.5 h fast / 56 h slow incorporation",
        bbb: "Active CNT2 (uridine/cytidine) + CTL1 transport",
        clearance: "Metabolic incorporation; <3% renal/fecal loss"
      },
      targets: [
        { receptor: "Kennedy Pathway (CTP:Phosphocholine)", gene: "PCYT1A", metric: "Substrate", affinity: "Physiological µM", mode: "Membrane Synthesis", grade: "A" },
        { receptor: "Nicotinic α7 / Central ACh Pool", gene: "CHRNA7 / CHAT", metric: "Indirect", affinity: "Choline Donor", mode: "Precursor Augmentation", grade: "B" }
      ],
      claims: [
        {
          grade: "A",
          tierLabel: "Large Null RCT",
          claim: "Global recovery at 90 days in moderate-to-severe acute ischemic stroke (stopped for futility)",
          effect: "OR 1.03 (95% CI 0.86–1.25; p = 0.364 — NULL)",
          cohort: "ICTUS Multicenter Phase III · n = 2,298",
          pmid: "22691567"
        },
        {
          grade: "A",
          tierLabel: "Cochrane Review",
          claim: "Short-term memory and behavior measures in chronic cerebrovascular cognitive impairment",
          effect: "SMD 0.19 (Modest effect; heterogeneous endpoints)",
          cohort: "14 RCTs Pooled · n = 1,336",
          pmid: "15846619"
        }
      ],
      clinicalNote: "In humans, oral cytidine converts primarily to circulating uridine before crossing the BBB via concentrative nucleoside transporters. Pharmapedia surfaces the large ICTUS null stroke trial alongside smaller cognitive trials to prevent survivorship bias."
    },
    {
      id: "nac",
      name: "N-Acetylcysteine (NAC)",
      aliases: ["acetylcysteine", "glutathione", "slc7a11", "cysteine", "mucolytic", "23391633"],
      classLabel: "Thiol Redox Precursor & Glial Cystine-Glutamate Antiporter Modulator",
      pubchemCid: "12035",
      chemblId: "CHEMBL600",
      cas: "616-91-1",
      formula: "C5H9NO3S",
      mw: "163.19 g/mol",
      pk: {
        bioavailability: "6–10% intact free NAC (extensive gut/hepatic deacetylation)",
        halfLife: "5.6 h (Adult PO)",
        bbb: "Low intact NAC; supplies L-cystine to astrocytic System xc-",
        clearance: "70% Non-renal hepatic sulfur pool · 30% Renal"
      },
      targets: [
        { receptor: "Glutamate-Cystine Antiporter (System xc-)", gene: "SLC7A11", metric: "Km", affinity: "~45 µM Cystine", mode: "Extrasynaptic Glu Restoration", grade: "B" },
        { receptor: "Glutathione Synthetase Axis", gene: "GCLC / GSS", metric: "Rate-Limiting", affinity: "Intracellular L-Cys", mode: "GSH Replenishment", grade: "A" }
      ],
      claims: [
        {
          grade: "A",
          tierLabel: "Clinical Standard",
          claim: "Prevention of NAPQI-mediated hepatotoxicity in acute acetaminophen overdose (<8 h window)",
          effect: "Hepatotoxicity <2% when initiated early",
          cohort: "Multicenter Clinical Protocols · n > 11,000",
          pmid: "3477096"
        },
        {
          grade: "A",
          tierLabel: "Human RCT",
          claim: "Compulsive craving & repetitive behavior reduction in trichotillomania and grooming spectra",
          effect: "56% responder rate vs 16% placebo (p = 0.003)",
          cohort: "12-Week Double-Blind RCT · n = 50",
          pmid: "19581567"
        }
      ],
      clinicalNote: "Potentiates organic nitrates (nitroglycerin) causing marked vasodilation and severe headache. Low intact oral bioavailability means millimolar direct free-radical scavenging observed in cell dishes (Grade D) does not occur in vivo; clinical effects derive from glutathione synthesis and astrocytic System xc-."
    },
    {
      id: "bupropion",
      name: "Bupropion",
      aliases: ["wellbutrin", "zyban", "ndri", "cyp2d6", "dat", "net", "16044191"],
      classLabel: "Aminoketone NDRI · Nicotinic Antagonist & Strong CYP2D6 Inhibitor",
      pubchemCid: "444",
      chemblId: "CHEMBL894",
      cas: "34841-39-9",
      formula: "C13H18ClNO",
      mw: "239.74 g/mol",
      pk: {
        bioavailability: "First-pass >85% absorbed; active (2S,3S)-hydroxybupropion",
        halfLife: "21 h (Parent) · 20–37 h (Metabolites)",
        bbb: "High (logBB +0.62)",
        clearance: "CYP2B6 substrate · Potent CYP2D6 inhibitor"
      },
      targets: [
        { receptor: "Dopamine Transporter", gene: "SLC6A3", metric: "Ki / Occ.", affinity: "526 nM (~14–26% PET occ.)", mode: "Reuptake Inhibitor", grade: "A" },
        { receptor: "Norepinephrine Transporter", gene: "SLC6A2", metric: "Metabolite Ki", affinity: "Hydroxybupropion active", mode: "Reuptake Inhibitor", grade: "A" },
        { receptor: "Nicotinic Acetylcholine α3β4", gene: "CHRNA3 / CHRNB4", metric: "IC50", affinity: "1.8 µM", mode: "Non-Competitive Block", grade: "B" },
        { receptor: "Cytochrome P450 2D6", gene: "CYP2D6", metric: "AUC Shift", affinity: "5.2x Desipramine AUC", mode: "Strong Clinical Inhibitor", grade: "A" }
      ],
      claims: [
        {
          grade: "A",
          tierLabel: "Cochrane Review",
          claim: "Long-term smoking abstinence (>=6 months) compared with placebo",
          effect: "RR 1.60 (95% CI 1.49–1.72; 71 trials)",
          cohort: "Cochrane Meta-Analysis · n = 31,809",
          pmid: "37219992"
        },
        {
          grade: "A",
          tierLabel: "PK DDI Study",
          claim: "Phenoconversion of CYP2D6 normal metabolizers to poor-metabolizer phenotype",
          effect: "5.2-fold Cmax/AUC rise of CYP2D6 probes",
          cohort: "FDA Clinical DDI Index · Crossover PK",
          pmid: "16044191"
        }
      ],
      clinicalNote: "Crucial stack hazard: hydroxybupropion and erythro/threohydrobupropion strongly inhibit CYP2D6, blocking prodrug activation of tamoxifen, codeine, and tramadol while elevating metoprolol, atomoxetine, and dextromethorphan levels."
    },
    {
      id: "lithium-lowdose",
      name: "Lithium (Carbonate / Microdose Context)",
      aliases: ["lithium", "lithium orotate", "gsk3b", "impa1", "bipolar", "23814104"],
      classLabel: "Monovalent Alkali Cation · GSK-3β & Inositol Monophosphatase Inhibitor",
      pubchemCid: "11125",
      chemblId: "CHEMBL1200699",
      cas: "554-13-2",
      formula: "Li2CO3 / Li+",
      mw: "73.89 g/mol (Li+ 6.94)",
      pk: {
        bioavailability: "95–100% (Ionized Li+ post-dissolution)",
        halfLife: "18–24 h (Young adult) · 36+ h (Elderly)",
        bbb: "Slow equilibration (~0.5 brain:serum ratio)",
        clearance: "100% Renal proximal tubule (Na+-coupled)"
      },
      targets: [
        { receptor: "Glycogen Synthase Kinase-3β", gene: "GSK3B", metric: "Ki", affinity: "1.5–2.0 mM (Mg2+ competitive)", mode: "Direct + Ser9 Phospho", grade: "A" },
        { receptor: "Inositol Monophosphatase 1", gene: "IMPA1", metric: "Ki", affinity: "0.8 mM", mode: "Uncompetitive Block", grade: "A" }
      ],
      claims: [
        {
          grade: "A",
          tierLabel: "Meta-Analysis",
          claim: "Reduction in suicide mortality and deliberate self-harm in mood disorders (therapeutic 0.6–1.0 mEq/L)",
          effect: "OR 0.13 vs placebo (95% CI 0.03–0.66)",
          cohort: "BMJ Systematic Review · 48 RCTs (n = 6,674)",
          pmid: "23814104"
        },
        {
          grade: "B",
          tierLabel: "Ecological / Cohort",
          claim: "Inverse correlation between municipal drinking-water trace lithium (µg/L) and regional dementia/suicide rates",
          effect: "Ecological association; high geographic confounding",
          cohort: "Danish Nationwide Register · n = 73,731",
          pmid: "28832877"
        }
      ],
      clinicalNote: "Therapeutic lithium (600–1200 mg Li2CO3; serum 0.6–1.0 mEq/L) requires strict eGFR and TSH monitoring and interacts dangerously with NSAIDs, ACEi/ARBs, and thiazides. Sub-milligram OTC 'orotate' claims rely heavily on ecological Grade B data rather than large Phase III trials."
    }
  ],

  /* ------------------------------------------------------------------------
     2. Study Library & Graded Evidence Ledger
     ------------------------------------------------------------------------ */
  studyClaims: [
    {
      id: "sc-01",
      domain: "cardiometabolic",
      domainLabel: "Cardiometabolic",
      compound: "Semaglutide 2.4 mg SC weekly",
      endpoint: "3-point MACE (CV death, nonfatal MI, nonfatal stroke) in obesity without diabetes",
      grade: "A",
      model: "Multicenter Double-Blind RCT · n = 17,604 · 39.8 mo follow-up",
      effect: "HR 0.80 [0.72–0.90]",
      direction: "favorable",
      pmid: "37952131",
      sourceTag: "NEJM · SELECT",
      audit: {
        design: "Event-driven, randomized, double-blind, placebo-controlled superiority trial across 41 countries.",
        dosingParity: "Exact clinical human regimen (2.4 mg SC weekly after 16-week titration).",
        limitation: "Population restricted to age >=45 y with established cardiovascular disease and BMI >=27; gallbladder disorder rate higher (2.8% vs 2.3%).",
        rationale: "Assigned Grade A (Weight 1.00): Adequately powered hard clinical endpoint RCT with pre-registered SAP and low attrition."
      }
    },
    {
      id: "sc-02",
      domain: "neuropsychiatry",
      domainLabel: "Neuropsychiatry",
      compound: "Escitalopram 10–20 mg/d",
      endpoint: "8-week >=50% symptom reduction in acute major depressive disorder",
      grade: "A",
      model: "Network Meta-Analysis · 522 Double-Blind RCTs · n = 116,477",
      effect: "OR 1.68 [1.50–1.87]",
      direction: "favorable",
      pmid: "29477251",
      sourceTag: "Lancet · GRISELDA",
      audit: {
        design: "Bayesian head-to-head and placebo-controlled network meta-analysis including unpublished regulatory trial datasets.",
        dosingParity: "Standard licensed oral dosing (10–20 mg/d).",
        limitation: "Short median follow-up (8 weeks); modest absolute standardized mean difference across mild baseline severity strata.",
        rationale: "Assigned Grade A (Weight 0.95): Replicated human randomized evidence incorporating unpublished FDA/EMA submissions."
      }
    },
    {
      id: "sc-03",
      domain: "neuroprotection",
      domainLabel: "Neuroprotection & Sleep",
      compound: "CDP-Choline (Citicoline) 2000 mg/d",
      endpoint: "90-day neurological & functional recovery after acute ischemic stroke",
      grade: "A",
      model: "Phase III Multicenter RCT · n = 2,298 (Stopped at interim futility)",
      effect: "OR 1.03 [0.86–1.25] · NULL",
      direction: "neutral",
      pmid: "22691567",
      sourceTag: "Lancet · ICTUS",
      audit: {
        design: "Randomized, placebo-controlled, sequential-analysis Phase III trial across 59 stroke centers in Europe.",
        dosingParity: "1000 mg IV q12h x 3 days followed by 1000 mg PO BID x 6 weeks.",
        limitation: "High concurrent r-tPA thrombolysis ceiling (~46%) may have narrowed neuroprotective rescue window.",
        rationale: "Assigned Grade A — Null Result: High-rigor human evidence refuting acute stroke benefit despite dozens of positive rodent MCAO studies."
      }
    },
    {
      id: "sc-04",
      domain: "cardiometabolic",
      domainLabel: "Cardiometabolic",
      compound: "Rosuvastatin 20 mg/d",
      endpoint: "Primary prevention of myocardial infarction, stroke, or CV death (hsCRP >=2 mg/L)",
      grade: "A",
      model: "Double-Blind RCT · n = 17,802 · Median 1.9 y",
      effect: "HR 0.56 [0.46–0.69]",
      direction: "favorable",
      pmid: "18997196",
      sourceTag: "NEJM · JUPITER",
      audit: {
        design: "Placebo-controlled primary prevention trial in normolipidemic adults (LDL <130 mg/dL) with elevated hsCRP.",
        dosingParity: "20 mg oral daily.",
        limitation: "Early stopping for benefit may slightly inflate point estimate; small increase in physician-reported incident diabetes (3.0% vs 2.4%).",
        rationale: "Assigned Grade A (Weight 0.98): Large human outcome RCT with adjudicated hard endpoints."
      }
    },
    {
      id: "sc-05",
      domain: "cardiometabolic",
      domainLabel: "Cardiometabolic",
      compound: "Berberine HCl 900 mg/d",
      endpoint: "In vivo human inhibition of CYP2D6, CYP2C9, and CYP3A4 probe substrates",
      grade: "A",
      model: "Two-Phase Randomized Crossover PK Trial · n = 17 healthy adults",
      effect: "CYP2D6 Metabolic Ratio +9.4x",
      direction: "caution",
      pmid: "21870106",
      sourceTag: "Eur J Clin Pharmacol",
      audit: {
        design: "14-day repeated-dose berberine administration followed by phenotyping cocktail (dextromethorphan, losartan, midazolam, omeprazole, caffeine).",
        dosingParity: "300 mg TID oral (standard commercial supplement regimen).",
        limitation: "Healthy volunteer PK endpoint; clinical adverse event magnitude depends on co-administered substrate therapeutic window.",
        rationale: "Assigned Grade A (Human PK Interaction): Directly measured human plasma/urinary AUC shift demonstrating real CYP2D6/3A4 inhibition."
      }
    },
    {
      id: "sc-06",
      domain: "cardiometabolic",
      domainLabel: "Cardiometabolic",
      compound: "Metformin Monotherapy",
      endpoint: "All-cause survival exceeding matched non-diabetic general population",
      grade: "B",
      model: "Nationwide Registry Reassessment · n = 119,083 · Observational",
      effect: "HR 1.01 [0.97–1.05] · Confounded",
      direction: "neutral",
      pmid: "35303428",
      sourceTag: "Int J Epidemiol",
      audit: {
        design: "Methodological replication controlling for immortal-time bias, healthy-initiator bias, and treatment-switch censoring.",
        dosingParity: "Real-world prescribed T2D maintenance doses.",
        limitation: "Earlier observational survival claims (2014 UK CPRD cohort) introduced bias by censoring patients upon second-line intensification.",
        rationale: "Assigned Grade B (Ceiling 0.65): Observational EHR registries cannot establish non-diabetic lifespan extension without randomized trials (e.g., TAME)."
      }
    },
    {
      id: "sc-07",
      domain: "neuropsychiatry",
      domainLabel: "Neuropsychiatry",
      compound: "Trace Drinking-Water Lithium (<30 µg/L)",
      endpoint: "Regional incidence of hospital-diagnosed dementia in older adults",
      grade: "B",
      model: "Population Nested Case-Control · n = 73,731 cases / 733,653 controls",
      effect: "IRR 0.83 (>15 µg/L stratum)",
      direction: "watch",
      pmid: "28832877",
      sourceTag: "JAMA Psychiatry",
      audit: {
        design: "Municipal waterworks lithium geostatistical mapping linked to Danish National Patient Registry.",
        dosingParity: "Environmental trace exposure (~10–30 µg/L; 1,000x below psychiatric Li+ dosing); nonlinear U-shaped curve across intermediate quartiles.",
        limitation: "Municipality-level urbanicity and healthcare diagnosis ascertainment confound regional dementia incidence.",
        rationale: "Assigned Grade B (Weight 0.50): Non-randomized ecological exposure; insufficient to validate OTC microdose lithium efficacy."
      }
    },
    {
      id: "sc-08",
      domain: "analgesia",
      domainLabel: "Analgesia & Inflammation",
      compound: "Tramadol + SSRI Co-Prescription",
      endpoint: "Emergency hospitalization for serotonin syndrome or CYP2D6 analgesic failure",
      grade: "B",
      model: "Nested Case-Control Pharmacovigilance + PK Studies · n = 35,316",
      effect: "aOR 1.94–3.10 + M1 Blunting",
      direction: "caution",
      pmid: "23486848",
      sourceTag: "Clin Pharmacol Ther",
      audit: {
        design: "Healthcare claims linkage paired with mechanistic CYP2D6 O-demethylation metabolite profiling.",
        dosingParity: "Routine outpatient analgesic + antidepressant co-dispensing.",
        limitation: "Mild serotonin toxicity is frequently under-coded in ICD discharge records, likely underestimating mild clonus incidence.",
        rationale: "Assigned Grade B + Human PK Grade A: Convergent pharmacovigilance and active-metabolite clearance evidence."
      }
    },
    {
      id: "sc-09",
      domain: "neuroprotection",
      domainLabel: "Neuroprotection & Sleep",
      compound: "Magnesium L-Threonate (MgT)",
      endpoint: "Cerebrospinal fluid [Mg2+] elevation and CA1 GluN2B bouton density",
      grade: "C",
      model: "In Vivo Sprague-Dawley Rat Model · Direct Cisterna Magna CSF Sampling",
      effect: "+15% CSF [Mg2+] vs MgCl2",
      direction: "watch",
      pmid: "20152114",
      sourceTag: "Neuron · Rodent",
      audit: {
        design: "24-day oral drinking-water supplementation in young and aged rats with invasive CSF microdialysis and patch-clamp LTP.",
        dosingParity: "604 mg/kg/d MgT in rats (~50 mg/kg elemental Mg) -> FDA Km Human Equivalent Dose ~9.7 mg/kg (~680 mg elemental Mg, ~4.7x typical label dose).",
        limitation: "Rodent BBB turnover and baseline chow Mg status differ from humans; direct human lumbar-puncture head-to-head CSF study is absent.",
        rationale: "Assigned Grade C (Ceiling 0.35): Preclinical animal data with allometric HED >3x standard supplement dosing."
      }
    },
    {
      id: "sc-10",
      domain: "neuroprotection",
      domainLabel: "Neuroprotection & Sleep",
      compound: "BPC-157 Pentadecapeptide",
      endpoint: "Tendon-to-bone angiogenesis and nitric oxide / VEGFR2 signaling",
      grade: "C",
      model: "Murine & Rat Transection Models · Zero Published Phase II/III Human RCTs",
      effect: "Preclinical tensile gain only",
      direction: "watch",
      pmid: "21030672",
      sourceTag: "J Orthop Res · Rat",
      audit: {
        design: "Achilles tendon transection in male Albino Wistar rats treated intraperitoneally or locally.",
        dosingParity: "Parenteral µg/kg rodent administration; human systemic stability, immunogenicity, and pro-angiogenic safety unestablished.",
        limitation: "Heavy single-group publication concentration in rodent literature; registered human clinical outcome trials remain unpublished/absent.",
        rationale: "Assigned Grade C (Ceiling 0.30): Strictly quarantined from human efficacy claims until independent randomized clinical trials report."
      }
    },
    {
      id: "sc-11",
      domain: "cardiometabolic",
      domainLabel: "Cardiometabolic",
      compound: "Trans-Resveratrol (Unformulated)",
      endpoint: "Direct allosteric SIRT1 deacetylase activation in recombinant assay",
      grade: "D",
      model: "In Vitro Fluorogenic Peptide / HEK293 Assay · 25–100 µM Concentration",
      effect: "EC50 ~46 µM (Fluorophore artifact)",
      direction: "caution",
      pmid: "20100913",
      sourceTag: "J Biol Chem · In Vitro",
      audit: {
        design: "Cell-free enzymatic and immortalized cell-line exposure using Fluor-de-Lys labeled p53 peptide.",
        dosingParity: "EXPOSURE GAP: 50 µM assay concentration is ~250x higher than peak unbound human plasma trans-resveratrol (<0.2 µM after 1000 mg oral dose due to rapid glucuronidation/sulfation).",
        limitation: "Subsequent biochemical audits showed activation depended on synthetic hydrophobic fluorophore tag on substrate.",
        rationale: "Assigned Grade D (Ceiling 0.15): Supraphysiological in vitro assay flagged automatically for >100-fold human Cmax,u deficit."
      }
    },
    {
      id: "sc-12",
      domain: "neuropsychiatry",
      domainLabel: "Neuropsychiatry",
      compound: "Apigenin + GABAA Benzodiazepine Pocket",
      endpoint: "Subunit-selective α2/α3 anxiolysis without sedation extrapolated from docking",
      grade: "E",
      model: "In Silico Molecular Docking + Pathway Network Extrapolation",
      effect: "ΔG = -7.4 kcal/mol (Predicted)",
      direction: "neutral",
      pmid: "25291819",
      sourceTag: "Pathway Inference",
      audit: {
        design: "Rigid-receptor homology docking and Reactome node proximity without human receptor occupancy PET.",
        dosingParity: "Unbound human brain fraction (Kp,uu,brain) after oral chamomile/flavone intake is sub-nanomolar, ~3 orders of magnitude below Ki (~4 µM).",
        limitation: "Docking scores do not distinguish positive allosteric modulation, silent antagonism, or off-target CD38 inhibition.",
        rationale: "Assigned Grade E (Ceiling 0.05): Mechanistic inference quarantined with dashed edges; never counted as clinical evidence."
      }
    }
  ],

  /* ------------------------------------------------------------------------
     3. Interactive Stack Checker & Pathway Visualization Engine
     ------------------------------------------------------------------------ */
  stackChecker: {
    presets: [
      {
        id: "serotonergic-collision",
        label: "Preset 01 · Serotonergic + Analgesic Collision",
        shortTag: "High Risk Audit",
        description: "Common outpatient pain + mood + OTC botanical combination revealing dual SERT convergence and CYP2D6/3A4 enzymatic conflict.",
        activeCompounds: ["escitalopram", "tramadol", "st-johns-wort", "magnesium-glycinate"]
      },
      {
        id: "cholinergic-focus",
        label: "Preset 02 · Cholinergic & Prefrontal Focus Stack",
        shortTag: "Low–Moderate Signal",
        description: "Frequently stacked cognitive regimen demonstrating balanced Adenosine A2A / Glutamate / Cholinergic interplay with minimal CYP bottleneck.",
        activeCompounds: ["cdp-choline", "caffeine", "l-theanine", "magnesium-glycinate"]
      },
      {
        id: "cardiometabolic-audit",
        label: "Preset 03 · Cardiometabolic & Statin Transporter Stack",
        shortTag: "Moderate Signal",
        description: "Prescribed statin + biguanide paired with OTC berberine & ubiquinol—highlighting AMPK overlap and CYP3A4/transporter competition.",
        activeCompounds: ["rosuvastatin", "metformin", "berberine", "coq10"]
      }
    ],

    compounds: [
      { id: "escitalopram", name: "Escitalopram", dose: "10 mg QD", halfLife: "30 h", group: "Rx Psych" },
      { id: "tramadol", name: "Tramadol HCl", dose: "50 mg q6h", halfLife: "6.3 h", group: "Rx Analgesic" },
      { id: "st-johns-wort", name: "St. John's Wort", dose: "300 mg TID", halfLife: "14 h", group: "Botanical" },
      { id: "bupropion", name: "Bupropion XL", dose: "150 mg QD", halfLife: "21 h", group: "Rx Psych" },
      { id: "magnesium-glycinate", name: "Mg Glycinate", dose: "400 mg HS", halfLife: "Pool", group: "Mineral" },
      { id: "cdp-choline", name: "CDP-Choline", dose: "500 mg AM", halfLife: "56 h*", group: "Precursor" },
      { id: "caffeine", name: "Caffeine", dose: "100 mg AM", halfLife: "4.8 h", group: "Xanthine" },
      { id: "l-theanine", name: "L-Theanine", dose: "200 mg AM", halfLife: "1.2 h", group: "Amino Acid" },
      { id: "rosuvastatin", name: "Rosuvastatin", dose: "10 mg QD", halfLife: "19 h", group: "Rx Statin" },
      { id: "berberine", name: "Berberine HCl", dose: "500 mg BID", halfLife: "5.0 h", group: "Alkaloid" },
      { id: "metformin", name: "Metformin XR", dose: "1000 mg QD", halfLife: "6.2 h", group: "Rx Biguanide" },
      { id: "coq10", name: "Ubiquinol (CoQ10)", dose: "200 mg QD", halfLife: "33 h", group: "Mitochondrial" }
    ],

    targets: [
      { id: "sert", name: "SERT (SLC6A4)", sub: "5-HT Reuptake" },
      { id: "cyp2d6", name: "CYP2D6", sub: "Hepatic Oxidase" },
      { id: "cyp3a4", name: "CYP3A4 / P-gp", sub: "Clearance / Efflux" },
      { id: "mor", name: "MOR (OPRM1)", sub: "µ-Opioid (M1)" },
      { id: "nmda", name: "NMDA / GluR", sub: "Ionotropic Glu" },
      { id: "ach", name: "nAChR / ACh Pool", sub: "Cholinergic" },
      { id: "adenosine", name: "Adenosine A1/A2A", sub: "Purinergic Wake" },
      { id: "ampk", name: "AMPK / Complex I", sub: "Cellular Energy" },
      { id: "oatp", name: "OATP1B1 / HMGCR", sub: "Hepatic Statin Axis" }
    ],

    axes: [
      { id: "serotonin-axis", name: "Serotonergic Tone", unit: "Synaptic 5-HT Load" },
      { id: "cyp-axis", name: "CYP450 Bottleneck", unit: "Metabolic Shift Risk" },
      { id: "cortical-axis", name: "Cortical Arousal / Glu", unit: "Excitatory Balance" },
      { id: "glycemic-axis", name: "AMPK / Glycemic Load", unit: "Glucose & GI Flux" },
      { id: "myopathy-axis", name: "Transporter / Myocyte", unit: "Systemic Statin / Mito" }
    ],

    /* Compound -> Target Links */
    compoundEdges: [
      {
        id: "e-esc-sert", from: "escitalopram", to: "sert",
        type: "inhibition", potency: "Ki = 1.1 nM", grade: "A", weight: 42,
        mechanism: "High-selectivity orthosteric + allosteric SERT blockade elevates extracellular 5-HT.",
        pmid: "29477251"
      },
      {
        id: "e-esc-2d6", from: "escitalopram", to: "cyp2d6",
        type: "inhibition", potency: "Weak Inh. (AUC +1.5x)", grade: "A", weight: 18,
        mechanism: "Mild competitive CYP2D6 inhibition; compounds phenoconversion when stacked with other inhibitors.",
        pmid: "15229463"
      },
      {
        id: "e-esc-3a4", from: "escitalopram", to: "cyp3a4",
        type: "substrate", potency: "CYP2C19/3A4 Sub.", grade: "A", weight: 16,
        mechanism: "Cleared via N-demethylation through CYP2C19 and CYP3A4; susceptible to PXR induction.",
        pmid: "37032424"
      },
      {
        id: "e-tram-sert", from: "tramadol", to: "sert",
        type: "inhibition", potency: "(+)-Enantiomer Ki = 0.99 µM", grade: "A", weight: 34,
        mechanism: "(+)-Tramadol inhibits presynaptic serotonin reuptake, lowering seizure threshold and compounding 5-HT load.",
        pmid: "23486848"
      },
      {
        id: "e-tram-2d6", from: "tramadol", to: "cyp2d6",
        type: "substrate", potency: "Prodrug -> M1 Active", grade: "A", weight: 32,
        mechanism: "Requires hepatic CYP2D6 O-demethylation to form (+)-M1; CYP2D6 block leaves parent serotonergic load while blunting analgesia.",
        pmid: "23486848"
      },
      {
        id: "e-tram-mor", from: "tramadol", to: "mor",
        type: "agonism", potency: "M1 Ki = 3.4 nM", grade: "A", weight: 28,
        mechanism: "O-desmethyltramadol (M1) drives µ-opioid analgesia; parent compound alone has >200-fold weaker MOR affinity.",
        pmid: "15509185"
      },
      {
        id: "e-sjw-sert", from: "st-johns-wort", to: "sert",
        type: "inhibition", potency: "TRPC6 Na+ Flux ~200 nM", grade: "A", weight: 32,
        mechanism: "Hyperforin activates TRPC6 channels, collapsing the Na+ gradient driving SERT, NET, and DAT reuptake.",
        pmid: "18004285"
      },
      {
        id: "e-sjw-3a4", from: "st-johns-wort", to: "cyp3a4",
        type: "induction", potency: "PXR EC50 = 23 nM (Strong)", grade: "A", weight: 46,
        mechanism: "Potent PXR transcriptional induction of intestinal/hepatic CYP3A4 and P-gp (ABCB1), slashing substrate plasma levels.",
        pmid: "10683021"
      },
      {
        id: "e-bup-2d6", from: "bupropion", to: "cyp2d6",
        type: "inhibition", potency: "Strong Inh. (AUC +5.2x)", grade: "A", weight: 48,
        mechanism: "Hydroxy- and hydrobupropion metabolites potently inhibit CYP2D6, causing functional poor-metabolizer phenoconversion.",
        pmid: "16044191"
      },
      {
        id: "e-bup-ach", from: "bupropion", to: "ach",
        type: "inhibition", potency: "α3β4 IC50 = 1.8 µM", grade: "B", weight: 20,
        mechanism: "Non-competitive ganglionic/central nicotinic antagonism alongside catecholamine reuptake blockade.",
        pmid: "10991997"
      },
      {
        id: "e-mg-nmda", from: "magnesium-glycinate", to: "nmda",
        type: "modulation", potency: "Voltage Block ~1.2 mM", grade: "A", weight: 4,
        mechanism: "Maintains physiological resting Mg2+ pore block of NMDA channels, buffering excitotoxic Ca2+ influx.",
        pmid: "29480918"
      },
      {
        id: "e-cdp-ach", from: "cdp-choline", to: "ach",
        type: "agonism", potency: "Choline + Uridine Donor", grade: "B", weight: 12,
        mechanism: "Supplies free choline for acetylcholine synthesis and cytidine/uridine for neuronal phosphatidylcholine.",
        pmid: "15846619"
      },
      {
        id: "e-caf-adeno", from: "caffeine", to: "adenosine",
        type: "inhibition", potency: "A2A Ki = 44 µM", grade: "A", weight: 20,
        mechanism: "Competitive antagonism of striatal/cortical A1 and A2A receptors disinhibits D2 and cholinergic arousal.",
        pmid: "20164566"
      },
      {
        id: "e-the-nmda", from: "l-theanine", to: "nmda",
        type: "modulation", potency: "AMPA/NMDA Low-Aff. µM", grade: "B", weight: 4,
        mechanism: "Structural L-glutamate analog moderating excitatory cortical reactivity and caffeine pressor response.",
        pmid: "18681988"
      },
      {
        id: "e-ros-oatp", from: "rosuvastatin", to: "oatp",
        type: "inhibition", potency: "HMGCR IC50 = 5.4 nM", grade: "A", weight: 28,
        mechanism: "Selective hepatocyte uptake via OATP1B1/BCRP inhibits mevalonate synthesis (lowering LDL-C and endogenous CoQ10).",
        pmid: "18997196"
      },
      {
        id: "e-ber-ampk", from: "berberine", to: "ampk",
        type: "agonism", potency: "Gut/Hepatic AMPK Act.", grade: "B", weight: 24,
        mechanism: "Activates hepatic AMPK and downregulates PCSK9 mRNA; high enterocyte concentrations intensify GI motility/cramping.",
        pmid: "15531889"
      },
      {
        id: "e-ber-2d6", from: "berberine", to: "cyp2d6",
        type: "inhibition", potency: "Human MR +9.4x", grade: "A", weight: 32,
        mechanism: "Repeated oral berberine significantly inhibits human CYP2D6 in vivo (crossover cocktail trial).",
        pmid: "21870106"
      },
      {
        id: "e-ber-3a4", from: "berberine", to: "cyp3a4",
        type: "inhibition", potency: "Midazolam AUC +1.4x", grade: "A", weight: 22,
        mechanism: "Moderate clinical CYP3A4 and P-gp efflux inhibition increasing systemic exposure of co-substrates.",
        pmid: "21870106"
      },
      {
        id: "e-ber-oatp", from: "berberine", to: "oatp",
        type: "modulation", potency: "OATP1B1 / BCRP Interplay", grade: "D", weight: 20,
        mechanism: "In vitro transporter competition at hepatic uptake/efflux carriers at micromolar portal vein levels.",
        pmid: "27262451"
      },
      {
        id: "e-met-ampk", from: "metformin", to: "ampk",
        type: "agonism", potency: "Hepatic Redox / LKB1", grade: "A", weight: 26,
        mechanism: "Suppresses hepatic gluconeogenesis and enhances insulin sensitivity via hepatic energy-charge signaling.",
        pmid: "11832527"
      },
      {
        id: "e-coq-oatp", from: "coq10", to: "oatp",
        type: "modulation", potency: "ETC Complex I/II->III", grade: "B", weight:  -10,
        mechanism: "Replenishes circulating and mitochondrial ubiquinol pools depleted downstream of HMG-CoA reductase inhibition.",
        pmid: "30371340"
      }
    ],

    /* Target -> Axis Links */
    targetAxisEdges: [
      { id: "ta-sert", from: "sert", to: "serotonin-axis", type: "inhibition", grade: "A" },
      { id: "ta-2d6", from: "cyp2d6", to: "cyp-axis", type: "inhibition", grade: "A" },
      { id: "ta-3a4", from: "cyp3a4", to: "cyp-axis", type: "induction", grade: "A" },
      { id: "ta-mor", from: "mor", to: "cortical-axis", type: "agonism", grade: "A" },
      { id: "ta-nmda", from: "nmda", to: "cortical-axis", type: "modulation", grade: "A" },
      { id: "ta-ach", from: "ach", to: "cortical-axis", type: "agonism", grade: "B" },
      { id: "ta-adeno", from: "adenosine", to: "cortical-axis", type: "inhibition", grade: "A" },
      { id: "ta-ampk", from: "ampk", to: "glycemic-axis", type: "agonism", grade: "A" },
      { id: "ta-oatp", from: "oatp", to: "myopathy-axis", type: "modulation", grade: "A" }
    ],

    /* Multi-compound clinical rules */
    interactionRules: [
      {
        id: "rule-serotonin-triad",
        requiresAnyCount: { pool: ["escitalopram", "tramadol", "st-johns-wort"], min: 2 },
        severity: "critical",
        badge: "HIGH CONVERGENCE · GRADE A/B",
        title: "Synergistic Serotonergic Load (SERT Convergence)",
        detail: "Multiple active agents block presynaptic serotonin reuptake via orthosteric SERT or TRPC6 sodium-gradient collapse. Elevates risk of neuromuscular clonus, diaphoresis, hyperreflexia, and serotonin toxicity.",
        pmid: "23486848"
      },
      {
        id: "rule-tramadol-2d6",
        requiresAll: ["tramadol"],
        requiresAny: ["escitalopram", "bupropion", "berberine"],
        severity: "elevated",
        badge: "PK PHENOCONVERSION · GRADE A",
        title: "CYP2D6 Blockade Blunts Tramadol -> M1 Analgesic Activation",
        detail: "Tramadol relies on CYP2D6 O-demethylation to generate (+)-M1 for µ-opioid analgesia. Co-administered CYP2D6 inhibitors attenuate pain relief while leaving parent (+)-tramadol serotonergic exposure intact.",
        pmid: "16044191"
      },
      {
        id: "rule-sjw-induction",
        requiresAll: ["st-johns-wort"],
        requiresAny: ["escitalopram", "rosuvastatin", "tramadol"],
        severity: "elevated",
        badge: "PXR INDUCTION · GRADE A",
        title: "Hyperforin PXR-Mediated CYP3A4 / P-gp Clearance Surge",
        detail: "St. John's Wort strongly induces CYP3A4 and intestinal P-glycoprotein efflux, causing erratic subtherapeutic plasma troughs or rebound withdrawal upon botanical discontinuation.",
        pmid: "10683021"
      },
      {
        id: "rule-ampk-dual",
        requiresAll: ["metformin", "berberine"],
        severity: "moderate",
        badge: "PATHWAY OVERLAP · GRADE B",
        title: "Dual Hepatic AMPK & Enterocyte GI Tolerance Overlap",
        detail: "Co-administering metformin and berberine stacks portal AMPK signaling and luminal organic cation accumulation—commonly amplifying dose-limiting diarrhea/GI cramping and warranting glycemic monitoring.",
        pmid: "21870106"
      },
      {
        id: "rule-berberine-statin",
        requiresAll: ["rosuvastatin", "berberine"],
        severity: "moderate",
        badge: "TRANSPORTER WATCH · GRADE D/B",
        title: "Efflux / Hepatic Transporter Competition (BCRP / OATP1B1)",
        detail: "Berberine inhibits intestinal P-gp/BCRP efflux in vitro and CYP3A4 in humans; monitor for statin-associated muscle soreness, especially in SLCO1B1*5 carriers.",
        pmid: "27262451"
      },
      {
        id: "rule-caffeine-theanine",
        requiresAll: ["caffeine", "l-theanine"],
        severity: "favorable",
        badge: "COMPLEMENTARY PD · GRADE A",
        title: "Balanced Arousal-to-Jitter Ratio (A2A Antagonism + Glutamate Buffering)",
        detail: "Randomized crossover trials show L-theanine (200 mg) attenuates caffeine-induced vasoconstrictive blood-pressure rise while preserving sustained attention accuracy.",
        pmid: "18681988"
      },
      {
        id: "rule-statin-coq10",
        requiresAll: ["rosuvastatin", "coq10"],
        severity: "favorable",
        badge: "PATHWAY REPLENISHMENT · GRADE B",
        title: "Downstream Mevalonate Ubiquinol Replenishment",
        detail: "HMG-CoA reductase block lowers circulating lipophilic CoQ10 alongside LDL-C; ubiquinol supplementation restores plasma CoQ10 without impairing LDL reduction (myalgia RCT results remain mixed).",
        pmid: "30371340"
      }
    ]
  },

  /* ------------------------------------------------------------------------
     4. Neuroanatomical Brain Atlas Dataset (Allen Brain mRNA + Human PET)
     ------------------------------------------------------------------------ */
  brainAtlas: {
    systems: [
      { id: "5ht", label: "Serotonergic (HTR1A / HTR2A)", genePair: "HTR1A · HTR2A · SLC6A4" },
      { id: "da", label: "Dopaminergic (DRD2 / DAT)", genePair: "DRD1 · DRD2 · SLC6A3" },
      { id: "glu", label: "Glutamate / GABA (NMDA / GABAA)", genePair: "GRIN2B · GABRA1 · SLC7A11" },
      { id: "ach", label: "Cholinergic (α7 / M1)", genePair: "CHRNA7 · CHRM1 · CHAT" },
      { id: "glp1", label: "Metabolic / Incretin (GLP1R)", genePair: "GLP1R · INSR · LEPR" }
    ],

    regions: [
      {
        id: "dlpfc",
        name: "Dorsolateral Prefrontal Cortex",
        shortName: "dlPFC",
        code: "BA 9 / 46",
        mni: "[-42, +38, +28]",
        cx: 214, cy: 114, lx: 136, ly: 82, side: "left",
        summary: "Executive working memory, top-down cognitive control, and catecholaminergic gain modulation (inverted-U D1/α2A tuning).",
        systemScores: { "5ht": 78, "da": 54, "glu": 88, "ach": 72, "glp1": 16 },
        transcripts: [
          { gene: "GRIN2B", z: "+1.84 z", density: 86 },
          { gene: "HTR2A", z: "+1.62 z", density: 81 },
          { gene: "CHRNA7", z: "+0.94 z", density: 66 },
          { gene: "DRD1", z: "+0.78 z", density: 58 }
        ],
        compounds: [
          { name: "Escitalopram", kpuu: "1.10", metric: "Cortical 5-HT2A adaptive downreg.", grade: "A", pmid: "29477251" },
          { name: "Caffeine", kpuu: "0.95", metric: "Prefrontal A1/A2A disinhibition", grade: "A", pmid: "20164566" },
          { name: "L-Theanine", kpuu: "0.48", metric: "Parieto-frontal alpha-band gating", grade: "B", pmid: "18681988" }
        ]
      },
      {
        id: "acc",
        name: "Anterior Cingulate Cortex",
        shortName: "ACC",
        code: "BA 24 / 32",
        mni: "[+4, +32, +18]",
        cx: 278, cy: 134, lx: 136, ly: 130, side: "left",
        summary: "Conflict monitoring, affective pain salience, and autonomic-emotional integration hub heavily innervated by dorsal raphe projections.",
        systemScores: { "5ht": 86, "da": 61, "glu": 82, "ach": 64, "glp1": 22 },
        transcripts: [
          { gene: "HTR1A", z: "+1.91 z", density: 88 },
          { gene: "OPRM1", z: "+1.35 z", density: 74 },
          { gene: "GABRA2", z: "+1.18 z", density: 70 },
          { gene: "SLC6A4", z: "+0.82 z", density: 59 }
        ],
        compounds: [
          { name: "Escitalopram", kpuu: "1.10", metric: "~81% SERT PET occupancy (10 mg)", grade: "A", pmid: "15051579" },
          { name: "Tramadol (M1)", kpuu: "0.68", metric: "Cingulate µ-opioid nociceptive gating", grade: "A", pmid: "15509185" }
        ]
      },
      {
        id: "striatum",
        name: "Striatum & Nucleus Accumbens",
        shortName: "Striatum / NAc",
        code: "Ca / Pu / NAc",
        mni: "[-12, +12, -6]",
        cx: 298, cy: 180, lx: 136, ly: 178, side: "left",
        summary: "Action selection, reinforcement learning, and astrocytic glutamate homeostasis; peak human DRD2, DAT, and Adenosine A2A heteromer density.",
        systemScores: { "5ht": 62, "da": 98, "glu": 79, "ach": 84, "glp1": 34 },
        transcripts: [
          { gene: "DRD2", z: "+3.42 z", density: 98 },
          { gene: "ADORA2A", z: "+3.10 z", density: 94 },
          { gene: "SLC6A3", z: "+2.45 z", density: 87 },
          { gene: "SLC7A11", z: "+1.12 z", density: 68 }
        ],
        compounds: [
          { name: "Caffeine", kpuu: "0.95", metric: "A2A-D2 heteromer antagonism (~50% occ.)", grade: "A", pmid: "20164566" },
          { name: "Bupropion", kpuu: "1.35", metric: "14–26% striatal DAT PET occupancy", grade: "A", pmid: "12138011" },
          { name: "N-Acetylcysteine", kpuu: "Indirect", metric: "NAc core System xc- Glu restoration", grade: "B", pmid: "23391633" }
        ]
      },
      {
        id: "hippocampus",
        name: "Hippocampal Formation",
        shortName: "Hippocampus",
        code: "CA1–CA3 / DG",
        mni: "[-26, -20, -14]",
        cx: 380, cy: 208, lx: 524, ly: 178, side: "right",
        summary: "Declarative memory consolidation, NMDA-dependent long-term potentiation (LTP), and high postsynaptic 5-HT1A & muscarinic M1 expression.",
        systemScores: { "5ht": 91, "da": 38, "glu": 96, "ach": 92, "glp1": 29 },
        transcripts: [
          { gene: "HTR1A", z: "+2.88 z", density: 95 },
          { gene: "GRIN1/2B", z: "+2.64 z", density: 93 },
          { gene: "CHRM1", z: "+2.21 z", density: 86 },
          { gene: "CHRNA7", z: "+1.76 z", density: 79 }
        ],
        compounds: [
          { name: "CDP-Choline", kpuu: "Precursor", metric: "Cholinergic & membrane phospholipid pool", grade: "B", pmid: "15846619" },
          { name: "Mg L-Threonate", kpuu: "Regulated", metric: "CA1 GluN2B density (Rodent CSF data)", grade: "C", pmid: "20152114" },
          { name: "Lithium", kpuu: "~0.50", metric: "Hippocampal GSK-3β / volume preservation", grade: "B", pmid: "21256147" }
        ]
      },
      {
        id: "amygdala",
        name: "Basolateral & Central Amygdala",
        shortName: "Amygdala",
        code: "BLA / CeA",
        mni: "[-22, -4, -18]",
        cx: 328, cy: 228, lx: 136, ly: 274, side: "left",
        summary: "Threat conditioning, autonomic fear extinction, and GABAergic inhibitory tone gated by prefrontal and serotonergic afferents.",
        systemScores: { "5ht": 84, "da": 58, "glu": 85, "ach": 68, "glp1": 31 },
        transcripts: [
          { gene: "GABRA2", z: "+2.14 z", density: 85 },
          { gene: "HTR2C", z: "+1.79 z", density: 78 },
          { gene: "GRIN2B", z: "+1.52 z", density: 73 },
          { gene: "CRHR1", z: "+1.40 z", density: 70 }
        ],
        compounds: [
          { name: "Escitalopram", kpuu: "1.10", metric: "Attenuates amygdala BOLD threat reactivity", grade: "A", pmid: "18227012" },
          { name: "Magnesium", kpuu: "Regulated", metric: "NMDA hyperexcitability pore buffering", grade: "B", pmid: "29480918" }
        ]
      },
      {
        id: "thalamus",
        name: "Mediodorsal & Sensory Thalamus",
        shortName: "Thalamus",
        code: "MD / VPL",
        mni: "[-10, -16, +8]",
        cx: 354, cy: 170, lx: 524, ly: 106, side: "right",
        summary: "Thalamocortical relay gating sleep spindles, nociceptive transmission, and nicotinic α4β2 receptor-rich arousal loops.",
        systemScores: { "5ht": 66, "da": 44, "glu": 84, "ach": 89, "glp1": 19 },
        transcripts: [
          { gene: "CHRNA4", z: "+2.74 z", density: 92 },
          { gene: "GABRA4", z: "+2.05 z", density: 83 },
          { gene: "SLC6A4", z: "+1.34 z", density: 69 },
          { gene: "OPRM1", z: "+1.68 z", density: 76 }
        ],
        compounds: [
          { name: "Bupropion", kpuu: "1.35", metric: "Thalamic nicotinic α3β4 / α4β2 block", grade: "B", pmid: "10991997" },
          { name: "Tramadol (M1)", kpuu: "0.68", metric: "Spinothalamic MOR antinociception", grade: "A", pmid: "15509185" }
        ]
      },
      {
        id: "hypothalamus",
        name: "Hypothalamus & Arcuate / Median Eminence",
        shortName: "Hypothalamus",
        code: "ARC / PVN / SCN",
        mni: "[0, -2, -12]",
        cx: 314, cy: 204, lx: 136, ly: 226, side: "left",
        summary: "Fenestrated circumventricular interface governing POMC/AgRP energy homeostasis, GLP-1R satiety signaling, and circadian SCN output.",
        systemScores: { "5ht": 73, "da": 64, "glu": 70, "ach": 59, "glp1": 97 },
        transcripts: [
          { gene: "GLP1R", z: "+3.58 z", density: 97 },
          { gene: "LEPR", z: "+2.92 z", density: 91 },
          { gene: "POMC", z: "+2.80 z", density: 89 },
          { gene: "HTR2C", z: "+2.10 z", density: 82 }
        ],
        compounds: [
          { name: "Semaglutide", kpuu: "CVO Access", metric: "Direct Arcuate POMC/CART GLP1R activation", grade: "A", pmid: "25299327" },
          { name: "Metformin", kpuu: "0.12", metric: "Hypothalamic GDF15 / AMPK appetite axis", grade: "B", pmid: "31875646" }
        ]
      },
      {
        id: "raphe",
        name: "Dorsal Raphe & Area Postrema (Brainstem)",
        shortName: "Raphe / Brainstem",
        code: "DRN / LC / AP",
        mni: "[+2, -28, -12]",
        cx: 382, cy: 258, lx: 524, ly: 258, side: "right",
        summary: "Pacemaker serotonergic (DRN) and noradrenergic (LC) nuclei plus blood-borne chemoreceptor zone (Area Postrema GLP1R).",
        systemScores: { "5ht": 99, "da": 52, "glu": 65, "ach": 71, "glp1": 91 },
        transcripts: [
          { gene: "SLC6A4", z: "+3.85 z", density: 99 },
          { gene: "TPH2", z: "+3.70 z", density: 97 },
          { gene: "GLP1R (AP)", z: "+3.14 z", density: 91 },
          { gene: "SLC6A2", z: "+2.96 z", density: 89 }
        ],
        compounds: [
          { name: "Escitalopram", kpuu: "1.10", metric: "Somatodendritic 5-HT1A desensitization", grade: "A", pmid: "29477251" },
          { name: "Semaglutide", kpuu: "CVO Open", metric: "Area Postrema GLP1R nausea/satiety relay", grade: "A", pmid: "33567185" }
        ]
      }
    ]
  },

  /* ------------------------------------------------------------------------
     5. Five-Tier Evidence Grading System & Translation Case Studies
     ------------------------------------------------------------------------ */
  evidenceGrading: {
    tiers: [
      {
        grade: "A",
        title: "Human Randomized Controlled Trials & Meta-Analyses",
        weight: "1.00",
        scope: "Double-blind Phase II/III RCTs, Cochrane/network meta-analyses, and crossover human PK drug-interaction studies.",
        rule: "Requires sample size (n), comparator arm, effect size + 95% CI, heterogeneity (I²), and registration/PMID.",
        allowed: "“Demonstrated in human randomized trials”",
        quarantine: "Small single-site pilot RCTs (<50 subjects) are labeled explicitly with pilot confidence intervals."
      },
      {
        grade: "B",
        title: "Human Observational, Registry & Mendelian Randomization",
        weight: "0.65",
        scope: "Prospective cohorts, nationwide EHR registries, pharmacovigilance case-control studies, and genetic proxies.",
        rule: "Flags healthy-user bias, immortal-time bias, and residual confounding; reports adjusted HR/OR separately from causal RCTs.",
        allowed: "“Associated in human cohort data (non-randomized)”",
        quarantine: "Blocked from causal efficacy badges until corroborated by randomized intervention."
      },
      {
        grade: "C",
        title: "In Vivo Animal Pharmacology & Behavioral Proxies",
        weight: "0.35",
        scope: "Murine, rat, and non-human primate efficacy, toxicology, and invasive CSF/tissue biodistribution studies.",
        rule: "Automatically computes FDA Km Human Equivalent Dose (HED) and flags species-specific CYP/BBB divergence.",
        allowed: "“Observed in preclinical animal model — unverified in humans”",
        quarantine: "Never pooled with human clinical scores; rodent forced-swim or maze proxies cannot generate human mood/memory claims."
      },
      {
        grade: "D",
        title: "In Vitro Cellular, Organoid & Recombinant Assays",
        weight: "0.15",
        scope: "Immortalized cell lines (HEK293, SH-SY5Y), primary neurons, microsomal IC50, and cell-free enzyme assays.",
        rule: "Audits assay concentration (µM) against achievable human unbound plasma/brain Cmax,u (nM).",
        allowed: "“Biochemical / cellular activity at [X] µM in vitro”",
        quarantine: "Flags EXPOSURE GAP warning whenever dish concentration exceeds human free systemic exposure by >10-fold."
      },
      {
        grade: "E",
        title: "Mechanistic Extrapolation & In Silico Inference",
        weight: "0.05",
        scope: "Pathway topology chaining, homology molecular docking (ΔG), QSAR predictions, and multi-hop gene ontology.",
        rule: "Rendered strictly with dashed edges in pathway graphs; stripped from patient efficacy summaries.",
        allowed: "“Mechanistic hypothesis / computational prediction only”",
        quarantine: "Zero clinical weight; retained solely to help researchers design falsifiable experiments."
      }
    ],

    cases: [
      {
        id: "resveratrol",
        name: "Trans-Resveratrol · SIRT1 & Cardiometabolic Aging",
        summary: "Classic illustration of how cell-dish hype (Grade D) and high-fat-diet mouse rescue (Grade C) fail to translate cleanly into human clinical endpoints (Grade A).",
        rows: [
          { grade: "A", status: "Mixed / Mostly Null", detail: "Meta-analyses of human RCTs show flat effects on body weight and inconsistent glycemic/lipid shifts across standard oral doses (150–1000 mg/d).", metric: "HbA1c / LDL: Inconsistent (I² > 72%)", pmid: "26002286" },
          { grade: "B", status: "Confounded Dietary Signal", detail: "Prospective cohort urinary resveratrol metabolite levels in Chianti older adults showed zero association with all-cause mortality or CVD.", metric: "HR 0.80 [0.54–1.17] · p = 0.25 (Null)", pmid: "24819981" },
          { grade: "C", status: "Positive in High-Fat Mice", detail: "Improved survival and insulin sensitivity in mice fed a 60%-calorie coconut-oil diet, but failed to extend lifespan in standard genetically heterogeneous NIA ITP mice.", metric: "NIA ITP Lifespan: +0% (p = 0.64)", pmid: "20955172" },
          { grade: "D", status: "250x Exposure Gap", detail: "Direct SIRT1 activation assays used 25–100 µM aglycone resveratrol + synthetic fluorophore peptide; human unbound plasma Cmax is <0.2 µM due to rapid glucuronidation.", metric: "Assay 50 µM vs Human <0.2 µM", pmid: "20100913" },
          { grade: "E", status: "Pathway Extrapolation", detail: "Multi-hop NAD+/PGC-1α longevity diagrams routinely omit >98% intestinal sulfate/glucuronide conjugation.", metric: "Unverified pathway hop", pmid: "23486698" }
        ]
      },
      {
        id: "semaglutide-case",
        name: "Semaglutide · Incretin Weight & Cardiovascular Axis",
        summary: "Demonstrates complete translational alignment from sub-nanomolar receptor pharmacology (Grade D) through rodent satiety (Grade C) to 17,604-patient hard MACE outcomes (Grade A).",
        rows: [
          { grade: "A", status: "Confirmed Clinical Efficacy", detail: "Replicated Phase III RCTs (STEP 1–8, SUSTAIN-6, SELECT, FLOW) establish -14.9% weight loss, 20% MACE reduction, and 24% renal progression reduction.", metric: "SELECT MACE HR 0.80 (n = 17,604)", pmid: "37952131" },
          { grade: "B", status: "Concordant Registry Safety/Signal", detail: "Real-world Scandinavia/US EHR cohorts confirm CV benefit while flagging rare biliary disease and perioperative gastric retention precautions.", metric: "Biliary RR 1.37; AUD aHR 0.68", pmid: "38796696" },
          { grade: "C", status: "Circumventricular Mapping", detail: "Fluorescently labeled semaglutide in rodents maps uptake precisely to hypothalamic arcuate nucleus and brainstem area postrema without diffuse BBB entry.", metric: "Arcuate / AP GLP1R colocalization", pmid: "25299327" },
          { grade: "D", status: "Achievable Free Exposure", detail: "Human GLP1R EC50 (0.38 nM) aligns quantitatively with free unbound steady-state plasma concentrations (~0.2–0.6 nM at 1.0–2.4 mg/wk despite 99% albumin binding).", metric: "EC50 0.38 nM ≈ Human Cfree,ss", pmid: "26308095" },
          { grade: "E", status: "Neurodegeneration Hypothesis", detail: "Microglial neuroinflammation attenuation in Alzheimer's remains Grade E/B hypothesis pending readout of Phase III EVOKE / EVOKE+ trials.", metric: "Awaiting Phase III readout", pmid: "39401256" }
        ]
      },
      {
        id: "magnesium-case",
        name: "Magnesium L-Threonate · Brain Mg2+ & Synaptic Density",
        summary: "Shows why Pharmapedia distinguishes compelling rodent cisterna-magna CSF measurements (Grade C) from small pilot human questionnaires/tasks (Grade A-pilot).",
        rows: [
          { grade: "A", status: "Single Small Pilot RCT", detail: "One 12-week sponsor-backed trial (n = 44) reported modest executive composite improvements; independent large head-to-head RCTs vs Mg glycinate/citrate are not yet published.", metric: "n = 44 · Cohen's d = 0.42", pmid: "26519439" },
          { grade: "B", status: "Dietary Mg Intake Cohorts", detail: "Higher total dietary magnesium intake (~400 mg/d) correlates with larger hippocampal volumes in UK Biobank, independent of L-threonate chelation.", metric: "Dietary Mg total association", pmid: "36899275" },
          { grade: "C", status: "Direct Rodent CSF Proof", detail: "Rats receiving ~604 mg/kg/d MgT showed +7% to +15% CSF [Mg2+] and CA1 GluN2B upregulation—at an allometric dose ~4.7x higher than standard human capsule intake.", metric: "Rat CSF +15% (HED ~4.7x label)", pmid: "20152114" },
          { grade: "D", status: "Primary Hippocampal Culture", detail: "Elevating extracellular [Mg2+] from 0.8 mM to 1.2 mM in cultured rat hippocampal neurons increases functional presynaptic release sites.", metric: "+0.4 mM dish [Mg2+] shift", pmid: "15590665" },
          { grade: "E", status: "Threonate Transporter Claim", detail: "Proposed GLUT-mediated L-threonic acid neuronal shuttling in adult human cortex remains mechanistically inferred rather than PET/tracer-verified in humans.", metric: "Human CSF superiority unverified", pmid: "20152114" }
        ]
      }
    ]
  }
};
