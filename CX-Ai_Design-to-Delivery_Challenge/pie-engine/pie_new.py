import re
import json
import time
import math
from functools import lru_cache

_zero_shot_classifier = None
_tone_model           = None
_ref_embeddings       = None
_tone_model_name      = "all-MiniLM-L6-v2"


def _get_zero_shot_classifier():
    """
    Loads facebook/bart-large-mnli on first call, caches it.
    This is the model that powers Classifier 1 (audience detection).

    WHY THIS MODEL:
    ─────────────────────────────────────────────────────────────────
    facebook/bart-large-mnli is trained on the MultiNLI dataset
    (392,000 sentence pairs, natural language inference task).
    It can classify ANY text into ANY labels you give it - no
    retraining needed. This is called "zero-shot classification"
    and it's perfect for our use case because:
      - We don't have Pharmaceutical Company-specific labelled training data
      - The 4 audience types are well-defined concepts
      - Accuracy is ~85% on novel classification tasks
      - Confidence scores tell us when to flag for human review

    WHERE TO GET IT:
    ─────────────────────────────────────────────────────────────────
    Hugging Face Hub: huggingface.co/facebook/bart-large-mnli
    Downloads automatically to: ~/.cache/huggingface/hub/
    Size: ~1.6GB (downloads once, cached forever)

    LIGHTER ALTERNATIVE (if laptop has less than 8GB RAM):
    ─────────────────────────────────────────────────────────────────
    Replace with: typeform/distilbert-base-uncased-mnli (~250MB)
    Just change the model= line below.
    Slightly less accurate but 6x faster and 6x smaller.
    """
    global _zero_shot_classifier
    if _zero_shot_classifier is None:
        print("[PIE] Loading audience classifier (bart-large-mnli)...")
        from transformers import pipeline
        _zero_shot_classifier = pipeline(
            "zero-shot-classification",
            model="facebook/bart-large-mnli",
            # device=0  # uncomment this line if you have a GPU
        )
        print("[PIE] Audience classifier ready.")
    return _zero_shot_classifier


def _get_tone_model():
    """
    Loads all-MiniLM-L6-v2 on first call, caches it.
    This powers Classifier 4 (brand tone analysis).

    WHY THIS MODEL:
    ─────────────────────────────────────────────────────────────────
    all-MiniLM-L6-v2 is a sentence transformer fine-tuned on
    1 billion sentence pairs (from natural language inference,
    paraphrase detection, semantic search datasets).

    It converts any sentence into a 384-dimension vector (a list
    of 384 numbers). Sentences with similar meaning end up as
    vectors pointing in similar directions. We measure the angle
    between vectors with cosine similarity:
      - 1.0  = identical meaning
      - 0.8+ = very similar
      - 0.5  = loosely related
      - 0.0  = unrelated

    WHERE TO GET IT:
    ─────────────────────────────────────────────────────────────────
    Hugging Face Hub: huggingface.co/sentence-transformers/all-MiniLM-L6-v2
    Downloads automatically to: ~/.cache/huggingface/hub/
    Size: ~90MB (very fast to download and run)

    THE REFERENCE CORPUS (defined below in BRAND_VOICE_CORPUS):
    ─────────────────────────────────────────────────────────────────
    These 12 sentences represent the "ideal" Pharmaceutical Company brand voice.
    We pre-compute their embeddings once and cache them.
    Any new brief is compared against these 12 sentences.
    Average cosine similarity = the tone score (0 to 1).

    WHERE DOES THE CORPUS COME FROM?
    We wrote these based on the Pharmaceutical Company's public brand guidelines,
    the CXI+AI hackathon slides, and the company's website copy patterns.
    For a production system you'd extract actual approved copy
    from an internal content library.
    """
    global _tone_model, _ref_embeddings
    if _tone_model is None:
        print("[PIE] Loading tone model (all-MiniLM-L6-v2)...")
        from sentence_transformers import SentenceTransformer
        _tone_model = SentenceTransformer(_tone_model_name)
        # Pre-compute reference embeddings once at load time
        import torch
        _ref_embeddings = _tone_model.encode(
            BRAND_VOICE_CORPUS,
            convert_to_tensor=True,
            show_progress_bar=False
        )
        print("[PIE] Tone model ready.")
    return _tone_model, _ref_embeddings


# ══════════════════════════════════════════════════════════════════
#  BRAND VOICE CORPUS
#  These 12 sentences define "Brand tone" for cosine similarity.
#  The more your brief sounds like these, the higher the tone score.
#
#  WHERE THIS DATA COMES FROM:
#  Based on: Pharmaceutical Company Annual Report 2023,
#  Digital brand guidelines (publicly referenced).
#  For production: extract from approved content repository.
# ══════════════════════════════════════════════════════════════════

BRAND_VOICE_CORPUS = [
    "We are committed to delivering breakthroughs that change patients lives for the better.",
    "Science-led, patient-centred, consistently delivered across all markets worldwide.",
    "Clear, trustworthy information designed to help healthcare professionals make better decisions.",
    "Human-centred digital experiences built for real people, not just for medical professionals.",
    "Evidence-based content, written with optimism and scientific credibility.",
    "We write in plain language so every patient can understand their health options.",
    "Accessible information, free of jargon, that empowers people to take confident next steps.",
    "Warm, clear, and direct - we speak to people as people, not as demographics.",
    "All claims are evidence-based and supported by peer-reviewed research.",
    "We comply with all applicable regulations and prioritise patient safety above all else.",
    "Consistent brand experiences across every market, every audience, every channel.",
    "AI-assisted but human-approved - every digital experience reflects our values.",
]


# ══════════════════════════════════════════════════════════════════
#  JURISDICTION LOOKUP TABLE
#
#  WHERE THIS DATA COMES FROM:
#  - EMA: European Medicines Agency - ema.europa.eu
#  - FDA: Food and Drug Administration - fda.gov/regulatory-information
#  - MHRA: Medicines & Healthcare products Regulatory Agency - gov.uk/mhra
#  - TGA: Therapeutic Goods Administration - tga.gov.au
#  - PMDA: Japan Pharmaceuticals and Medical Devices Agency - pmda.go.jp
#  - ANVISA: Brazil National Health Surveillance Agency - gov.br/anvisa
#  - GDPR: EU Regulation 2016/679 - eur-lex.europa.eu
#  - WCAG: W3C Web Content Accessibility Guidelines - w3.org/WAI/WCAG21
#
#  FORMAT: keys are lowercase strings to match against brief text.
#  Each entry has: body, framework, notes, gdpr (whether GDPR applies)
# ══════════════════════════════════════════════════════════════════

JURISDICTION_MAP = {
    # UK
    "united kingdom": {
        "body": "MHRA",
        "framework": "Human Medicines Regulations 2012 + ABPI Code of Practice",
        "notes": "Post-Brexit UK rules. ABPI code governs pharma promotion to HCPs.",
        "gdpr": True,   # UK GDPR (equivalent to EU GDPR)
    },
    "uk": {
        "body": "MHRA",
        "framework": "Human Medicines Regulations 2012 + ABPI Code of Practice",
        "notes": "Post-Brexit UK rules.",
        "gdpr": True,
    },
    # EU countries - all fall under EMA + national implementation
    "germany":     {"body": "EMA + BfArM", "framework": "Directive 2001/83/EC + AMG (Arzneimittelgesetz)", "notes": "Germany also has the HWG (Heilmittelwerbegesetz) for pharma advertising.", "gdpr": True},
    "france":      {"body": "EMA + ANSM",  "framework": "Directive 2001/83/EC + CSP (Code de la Santé Publique)", "notes": "ANSM oversees French pharmaceutical market.", "gdpr": True},
    "spain":       {"body": "EMA + AEMPS", "framework": "Directive 2001/83/EC + RD 1345/2007",  "notes": "AEMPS is the Spanish medicines regulator.", "gdpr": True},
    "italy":       {"body": "EMA + AIFA",  "framework": "Directive 2001/83/EC + Legislative Decree 219/2006", "notes": "AIFA governs Italian pharma advertising.", "gdpr": True},
    "netherlands": {"body": "EMA + CBG",   "framework": "Directive 2001/83/EC + Geneesmiddelenwet", "notes": "CBG-MEB is the Dutch medicines board.", "gdpr": True},
    "sweden":      {"body": "EMA + MPA",   "framework": "Directive 2001/83/EC + Läkemedelslagen", "notes": "MPA is the Swedish Medical Products Agency.", "gdpr": True},
    "european union": {"body": "EMA",      "framework": "Directive 2001/83/EC (medicinal products for human use)", "notes": "Covers all 27 EU member states.", "gdpr": True},
    "europe":      {"body": "EMA",         "framework": "Directive 2001/83/EC", "notes": "Pan-European default.", "gdpr": True},
    "eu":          {"body": "EMA",         "framework": "Directive 2001/83/EC", "notes": "Pan-European default.", "gdpr": True},
    # USA
    "usa":          {"body": "FDA",   "framework": "21 CFR Parts 201, 202 (prescription drug advertising)", "notes": "FDA requires fair balance - side effects must accompany benefits.", "gdpr": False},
    "united states": {"body": "FDA", "framework": "21 CFR Parts 201, 202", "notes": "FDA oversight. HIPAA for patient data.", "gdpr": False},
    "america":      {"body": "FDA",   "framework": "21 CFR Parts 201, 202", "notes": "FDA oversight.", "gdpr": False},
    # APAC
    "australia": {"body": "TGA",  "framework": "Therapeutic Goods Advertising Code 2021 + TGA Act 1989", "notes": "TGA has strict rules on health claims. Consumer ads require pre-approval.", "gdpr": False},
    "japan":     {"body": "PMDA", "framework": "Pharmaceutical and Medical Device Act (PMD Act) 2014",    "notes": "PMDA. Japanese Pharmaceutical Manufacturers Association (JPMA) code.", "gdpr": False},
    "china":     {"body": "NMPA", "framework": "Drug Administration Law of China 2019",                   "notes": "NMPA (formerly CFDA). Very strict on foreign pharma claims.", "gdpr": False},
    "india":     {"body": "CDSCO","framework": "Drugs and Cosmetics Act 1940 + MCI Guidelines",          "notes": "CDSCO under Ministry of Health. MCI governs HCP promotion.", "gdpr": False},
    "singapore": {"body": "HSA",  "framework": "Health Products Act + Medicines (Advertisement & Sale) Act","notes": "HSA is the Singapore health regulator.", "gdpr": False},
    # Latin America
    "brazil":  {"body": "ANVISA", "framework": "RDC 96/2008 (pharma advertising) + LGPD (data protection)", "notes": "LGPD is Brazil's GDPR equivalent.", "gdpr": False},
    "mexico":  {"body": "COFEPRIS","framework": "Ley General de Salud + NOM-072-SSA1",                  "notes": "COFEPRIS regulates Mexican pharma.", "gdpr": False},
    # Middle East & Africa
    "uae":          {"body": "MOH UAE",   "framework": "Federal Law No. 4 of 1983 + MOH advertising guidelines", "notes": "UAE MOH must approve pharma ads.", "gdpr": False},
    "south africa": {"body": "SAHPRA",    "framework": "Medicines and Related Substances Act 101 of 1965 + PCSA", "notes": "SAHPRA replaced MCC. PCSA is the pharma self-regulation body.", "gdpr": False},
    # Global default
    "global": {"body": "WCAG 2.1 AA + GDPR", "framework": "W3C WCAG 2.1 Level AA + EU GDPR (safe global defaults)", "notes": "No specific country - apply accessibility and data protection as minimum.", "gdpr": True},
}

DEFAULT_JURISDICTION = {
    "body": "WCAG 2.1 AA + GDPR",
    "framework": "Safe global defaults - no specific jurisdiction detected",
    "notes": "No country detected in brief. Applying accessibility and GDPR as minimum standard.",
    "gdpr": True,
}


# ══════════════════════════════════════════════════════════════════
#  RISK KEYWORD LISTS
#
#  WHERE THIS DATA COMES FROM:
#  - FDA guidelines on restricted drug advertising terms
#  - EMA good practice guide on medicinal product information
#  - ABPI Code of Practice (UK)
#  - Medical/Legal/Regulatory (MLR) review trigger terms
#    (publicly referenced in pharma compliance literature)
#
#  HIGH RISK: terms that almost certainly require Medical Affairs/
#    Legal review before publication
#  MEDIUM RISK: terms that add to risk score but may be acceptable
#    with appropriate context/disclaimers
#  LOW RISK: terms that indicate health context but low regulatory risk
# ══════════════════════════════════════════════════════════════════

HIGH_RISK_TERMS = [
    "drug", "medicine", "medication", "pharmaceutical", "pharma",
    "prescription", "over-the-counter", "otc",
    "clinical trial", "efficacy", "clinical study", "phase 1", "phase 2",
    "phase 3", "phase 4", "clinical data", "randomised", "randomized",
    "placebo", "double blind", "open label",
    "oncology", "cancer", "tumour", "tumor", "chemotherapy", "immunotherapy",
    "cardiovascular", "diabetes", "insulin", "vaccine", "immunisation",
    "HIV", "AIDS", "rare disease", "orphan drug",
    "adverse event", "side effect", "contraindication", "interaction",
    "overdose", "toxicity", "safety signal", "black box", "warning",
    "indication", "off-label", "compassionate use",
    "dosage", "dose", "mg", "mcg", "daily dose", "twice daily",
    "administration route", "intravenous", "subcutaneous", "oral",
]

MEDIUM_RISK_TERMS = [
    "patient", "disease", "condition", "symptom", "diagnosis",
    "treatment", "therapy", "healthcare", "medical", "clinical",
    "doctor", "physician", "specialist", "consultant", "nurse",
    "hospital", "clinic", "surgery", "procedure", "screening",
    "prevention", "risk factor", "complication", "chronic", "acute",
    "pharmaceutical", "biotech", "life sciences", "health outcome",
    "quality of life", "wellbeing",
]

LOW_RISK_TERMS = [
    "health", "wellness", "information", "resource", "support",
    "community", "awareness", "education", "programme", "initiative",
]

CENSOR_TERMS = [
    'sex', 'porn', 'adult', 'nsfw', 'nude', 'strip', 'escort', 
    'orgasm', 'erection', 'vagina', 'penis', 'fuck', 'shit',
    'hook up', 'one night', 'threesome', 'bdsm', 'fetish',
    'dating', 'kiss', 'darling', 'lover', 'sweetheart',
    'intercourse', 'panties', 'thongs', 'underwear', 'role-play',
    'rape', 'roleplaying', 'roleplay', 'sexual',
]



# ══════════════════════════════════════════════════════════════════
#  AUDIENCE GRADE TARGETS
#  Based on: plain language guidelines (plainlanguage.gov),
#  NHS England content standards, Pharmaceutical Company patient communications policy
# ══════════════════════════════════════════════════════════════════

AUDIENCE_GRADE_TARGETS = {
    "patients":              {"target": 7,  "max": 8,  "label": "Plain language (Grade 7-8)"},
    "healthcare providers":  {"target": 11, "max": 13, "label": "Professional clinical (Grade 11-13)"},
    "channel partners":      {"target": 10, "max": 11, "label": "Business professional (Grade 10-11)"},
    "internal teams":        {"target": 10, "max": 12, "label": "Corporate professional (Grade 10-12)"},
}

AUDIENCE_LABELS = list(AUDIENCE_GRADE_TARGETS.keys())


# ══════════════════════════════════════════════════════════════════
#  CLASSIFIER 1 - AUDIENCE DETECTOR
#  Uses: facebook/bart-large-mnli (zero-shot NLI)
#  Returns: { audience, confidence, all_scores }
# ══════════════════════════════════════════════════════════════════

def classify_audience(brief_text: str) -> dict:
    """
    Detect the intended audience of the web brief using zero-shot NLI.

    Zero-shot NLI works like this:
      - The model has learned that "patients" implies plain language,
        empathy, and health outcomes
      - "healthcare providers" implies clinical detail and evidence
      - It scores each label without needing labelled training data

    Example return:
      {
        "audience": "healthcare providers",
        "confidence": 0.94,
        "all_scores": {
          "healthcare providers": 0.94,
          "patients": 0.04,
          "internal teams": 0.01,
          "channel partners": 0.01
        },
        "flag_for_review": False
      }
    """
    try:
        clf = _get_zero_shot_classifier()
        result = clf(brief_text, AUDIENCE_LABELS, multi_label=False)

        all_scores = dict(zip(result["labels"], [round(s, 3) for s in result["scores"]]))
        top_label  = result["labels"][0]
        confidence = round(result["scores"][0], 3)

        # Flag if confidence is low - humans should confirm
        flag = confidence < 0.65

        return {
            "audience":         top_label,
            "confidence":       confidence,
            "all_scores":       all_scores,
            "flag_for_review":  flag,
            "flag_reason":      "Low confidence - please confirm audience type" if flag else None,
        }

    except Exception as e:
        # Graceful fallback - never crash the pipeline
        print(f"[PIE] Audience classifier error: {e}")
        return _audience_fallback(brief_text)


def _audience_fallback(text: str) -> dict:
    """
    Rule-based fallback if the transformer model is unavailable.
    Works offline and in demo mode. Less accurate but always runs.
    """
    t = text.lower()
    if any(w in t for w in ["hcp", "doctor", "physician", "prescrib", "clinical", "nurse", "pharmacist"]):
        audience, conf = "healthcare providers", 0.82
    elif any(w in t for w in ["patient", "carer", "consumer", "public", "person"]):
        audience, conf = "patients", 0.78
    elif any(w in t for w in ["partner", "distributor", "wholesaler", "channel"]):
        audience, conf = "channel partners", 0.71
    elif any(w in t for w in ["internal", "employee", "staff", "team", "colleague"]):
        audience, conf = "internal teams", 0.75
    else:
        audience, conf = "patients", 0.45   # safe default, low confidence

    return {
        "audience":        audience,
        "confidence":      conf,
        "all_scores":      {audience: conf},
        "flag_for_review": conf < 0.65,
        "flag_reason":     "Fallback classifier used (model unavailable)" if conf < 0.65 else None,
        "source":          "rule-based fallback",
    }


# ══════════════════════════════════════════════════════════════════
#  CLASSIFIER 2 - JURISDICTION DETECTOR
#  Uses: rule-based lookup (no ML needed - deterministic and auditable)
#  Returns: { body, framework, notes, gdpr, country_detected }
# ══════════════════════════════════════════════════════════════════

def detect_jurisdiction(brief_text: str, country: str = "") -> dict:
    """
    Map country/region mentions to the applicable regulatory framework.

    WHY RULE-BASED (not ML)?
    Jurisdiction detection is a lookup problem, not a classification
    problem. A lookup table is:
      - 100% deterministic - same input always gives same output
      - Fully auditable - you can see exactly why a rule fired
      - Trivially updatable - add a new country in one line
      - No false positives from ML overconfidence

    This is a deliberate data-science design choice: use ML where
    you need generalisation, use rules where you need determinism.

    Example return:
      {
        "body": "EMA + BfArM",
        "framework": "Directive 2001/83/EC + AMG",
        "notes": "Germany-specific...",
        "gdpr": True,
        "country_detected": "germany",
        "source": "lookup"
      }
    """
    # Combine brief text and explicitly passed country for matching
    search_text = (brief_text + " " + country).lower()

    # Strip punctuation for cleaner matching
    search_text = re.sub(r"[^\w\s]", " ", search_text)

    # Try exact phrase match first (longest match wins)
    matched_key   = None
    matched_length = 0
    for key in JURISDICTION_MAP:
        if key in search_text and len(key) > matched_length:
            matched_key    = key
            matched_length = len(key)

    if matched_key:
        result = dict(JURISDICTION_MAP[matched_key])   # copy, don't mutate
        result["country_detected"] = matched_key
        result["source"]           = "lookup"
        return result

    # No match - return safe global defaults
    result = dict(DEFAULT_JURISDICTION)
    result["country_detected"] = None
    result["source"]           = "default"
    return result


# ══════════════════════════════════════════════════════════════════
#  CLASSIFIER 3 - CONTENT RISK SCORER
#  Uses: keyword matching + sigmoid normalisation
#  Returns: { risk_score, level, triggers, recommendations }
# ══════════════════════════════════════════════════════════════════

def score_risk(brief_text: str, jurisdiction: dict = None) -> dict:
    """
    Score 0 to 1 how risky this brief is for pharma regulatory purposes.

    The score combines:
      - High-risk keyword hits (weight: 0.18 each, capped at 1.0)
      - Medium-risk keyword hits (weight: 0.07 each)
      - Low-risk keyword hits (weight: 0.03 each)

    A sigmoid function smooths the raw score so it never spikes
    dramatically on a single keyword.

    Risk levels:
      HIGH   >= 0.75  - requires Medical Affairs review before LLM runs
      MEDIUM  0.4 to 0.74 - add disclaimer requirement to enriched prompt
      LOW    < 0.4    - pass through with standard brand checks

    Example return:
      {
        "risk_score": 0.87,
        "level": "HIGH",
        "triggers": ["oncology", "clinical trial", "dosage"],
        "medium_triggers": ["patient", "treatment"],
        "recommendations": [
          "Do not make unsubstantiated efficacy claims",
          "Include a regulatory disclaimer",
          "Flag for Medical Affairs review"
        ]
      }
    """
    text_lower = re.sub(r"[^\w\s]", " ", brief_text.lower())
    censor_hits = [t for t in CENSOR_TERMS if t in text_lower]

    if censor_hits:
        return {
            "risk_score": 1.0,
            "level": "CENSORED",
            "triggers": censor_hits,
            "medium_triggers": [],
            "recommendations": [
                "🚫 PG-13 VIOLATION: Inappropriate content detected",
                "Rejected before LLM. Brief contains explicit/NSFW terms.",
                f"Blocked terms: {', '.join(censor_hits)}"
            ]
        }

    high_hits   = [t for t in HIGH_RISK_TERMS   if t in text_lower]
    medium_hits = [t for t in MEDIUM_RISK_TERMS if t in text_lower]
    low_hits    = [t for t in LOW_RISK_TERMS    if t in text_lower]
    
    # Linear score - simple, proportional, fully explainable
    # Each high-risk term adds 0.20, each medium adds 0.08, each low adds 0.03
    # Capped at 1.0. This is intentional - it's auditable:
    #   "Score is 0.76 because 3 high-risk terms were detected"
    risk_score = min(1.0, round(
        len(high_hits)   * 0.20 +
        len(medium_hits) * 0.08 +
        len(low_hits)    * 0.03,
        3
    ))

    # Jurisdiction multiplier - some markets are stricter
    if jurisdiction:
        body = jurisdiction.get("body", "")
        if "FDA" in body:
            risk_score = min(1.0, round(risk_score * 1.15, 3))  # FDA: stricter
        elif "EMA" in body or "MHRA" in body:
            risk_score = min(1.0, round(risk_score * 1.10, 3))  # EU/UK: slightly stricter

    level = "HIGH" if risk_score >= 0.75 else "MEDIUM" if risk_score >= 0.4 else "LOW"

    # Generate specific, actionable recommendations
    recs = []
    if level == "HIGH":
        recs.append("Do NOT make unsubstantiated efficacy or safety claims")
        recs.append("Include a regulatory disclaimer in the content")
        recs.append("Flag for Medical Affairs and Legal review before LLM generation")
        if any(t in high_hits for t in ["clinical trial", "phase 1", "phase 2", "phase 3"]):
            recs.append("Clinical trial data must include full methodology reference")
        if any(t in high_hits for t in ["side effect", "adverse event", "contraindication"]):
            recs.append("Adverse event information must follow fair balance requirements")
    elif level == "MEDIUM":
        recs.append("Add a general medical disclaimer")
        recs.append("Ensure all health claims are supported by approved references")
    else:
        recs.append("Standard brand compliance check applies")

    if jurisdiction and jurisdiction.get("gdpr"):
        recs.append("GDPR: Cookie consent banner required on this page")

    return {
        "risk_score":        risk_score,
        "level":             level,
        "triggers":          high_hits,
        "medium_triggers":   medium_hits,
        "recommendations":   recs,
    }


# ══════════════════════════════════════════════════════════════════
#  CLASSIFIER 4 - BRAND TONE ANALYSER
#  Uses: sentence-transformers (all-MiniLM-L6-v2) + cosine similarity
#  Returns: { tone_score, inject_guidance, label, distance_to_corpus }
# ══════════════════════════════════════════════════════════════════

def analyse_tone(brief_text: str) -> dict:
    """
    Measure how closely the brief's tone matches brand voice.

    HOW IT WORKS:
    1. Convert the brief to a 384-dim embedding vector
    2. Compare against 12 pre-computed reference embeddings
    3. Average cosine similarity = tone score

    Cosine similarity formula:
      cos(θ) = (A · B) / (|A| × |B|)
    Where A = brief embedding, B = reference embedding
    Result is always between -1 and 1; for semantics it's 0 to 1.

    Thresholds (tunable - adjust based on your corpus):
      >= 0.70  On-brand. No guidance injection needed.
       0.50–0.69  Borderline. Inject gentle tone reminder.
       < 0.50  Off-brand. Inject detailed tone guidance.

    DATASET USED FOR REFERENCE CORPUS:
    The 12 sentences in BRAND_VOICE_CORPUS above were manually
    curated from brand public communications. For production,
    you'd use 50–100 sentences from approved internal copy.

    Example return:
      {
        "tone_score": 0.76,
        "inject_guidance": False,
        "label": "on-brand",
        "top_match": "Science-led, patient-centred...",
        "top_match_score": 0.89
      }
    """
    try:
        model, ref_embeddings = _get_tone_model()
        from sentence_transformers import util

        brief_emb = model.encode(brief_text, convert_to_tensor=True, show_progress_bar=False)
        scores    = util.cos_sim(brief_emb, ref_embeddings)[0]

        scores_list    = scores.tolist()
        avg_score      = round(float(sum(scores_list) / len(scores_list)), 3)
        top_idx        = scores_list.index(max(scores_list))
        top_score      = round(scores_list[top_idx], 3)
        top_sentence   = BRAND_VOICE_CORPUS[top_idx]

        # Determine label and injection decision
        if avg_score >= 0.70:
            label            = "on-brand"
            inject_guidance  = False
        elif avg_score >= 0.50:
            label            = "borderline"
            inject_guidance  = True
        else:
            label            = "off-brand"
            inject_guidance  = True

        return {
            "tone_score":       avg_score,
            "inject_guidance":  inject_guidance,
            "label":            label,
            "top_match":        top_sentence[:80] + "...",
            "top_match_score":  top_score,
        }

    except Exception as e:
        print(f"[PIE] Tone analyser error: {e}")
        return _tone_fallback(brief_text)


def _tone_fallback(text: str) -> dict:
    """
    Rule-based tone fallback. Checks for off-brand signals.
    """
    t = text.lower()
    negative_signals = ["cheap", "affordable", "best", "only", "guaranteed",
                        "cure", "miracle", "revolutionary", "unprecedented"]
    positive_signals = ["patient", "evidence", "clinical", "science", "safe",
                        "clear", "accessible", "compliant", "approved"]

    neg_count = sum(1 for w in negative_signals if w in t)
    pos_count = sum(1 for w in positive_signals if w in t)

    score = max(0.3, min(0.9, 0.6 + pos_count * 0.05 - neg_count * 0.1))
    score = round(score, 3)

    return {
        "tone_score":      score,
        "inject_guidance": score < 0.65,
        "label":           "on-brand" if score >= 0.70 else "borderline" if score >= 0.50 else "off-brand",
        "top_match":       None,
        "top_match_score": None,
        "source":          "rule-based fallback",
    }


# ══════════════════════════════════════════════════════════════════
#  CLASSIFIER 5 - READABILITY PREDICTOR
#  Uses: textstat library (Flesch-Kincaid, Gunning Fog, SMOG)
#  Returns: { predicted_grade, target_grade, inject_simplify, metrics }
# ══════════════════════════════════════════════════════════════════

def predict_readability(brief_text: str, audience: str = "patients") -> dict:
    """
    Predict the Flesch-Kincaid reading grade of the generated content
    based on the complexity of the input brief, then set a target.

    WHY TEXTSTAT:
    textstat implements classic readability formulas directly
    on the text string - no model download, no internet needed.
    It runs in milliseconds.

    FORMULAS USED:
    ─────────────────────────────────────────────────────────────────
    Flesch-Kincaid Grade Level:
      0.39 × (words/sentences) + 11.8 × (syllables/words) - 15.59
    
    Gunning Fog Index:
      0.4 × [(words/sentences) + 100 × (complex_words/words)]
    
    SMOG Index:
      3 + √(polysyllables × 30/sentences)

    We average all three for a robust prediction.

    GRADE → AUDIENCE MAPPING:
    ─────────────────────────────────────────────────────────────────
    Grade 6–8:   General public, patients - NHS "plain English" standard
    Grade 9–10:  Educated layperson, business communications
    Grade 11–13: University-educated professionals, HCPs
    Grade 14+:   Specialist academic/scientific - only for niche content

    Example return:
      {
        "predicted_grade": 10.4,
        "target_grade": 7,
        "inject_simplify": True,
        "metrics": { "flesch_kincaid": 10.2, "gunning_fog": 11.1, "smog": 9.9 },
        "flesch_reading_ease": 52.3,
        "guidance": "Simplify to Grade 7: shorter sentences, avoid polysyllables"
      }
    """
    try:
        import textstat

        # Need at least a few words for meaningful scores
        word_count = len(brief_text.split())
        if word_count < 8:
            brief_text = brief_text + ". " + brief_text  # pad short inputs

        fk    = textstat.flesch_kincaid_grade(brief_text)
        fog   = textstat.gunning_fog(brief_text)
        smog  = textstat.smog_index(brief_text) if word_count >= 30 else fk
        ease  = textstat.flesch_reading_ease(brief_text)

        # Weighted average (FK is most commonly cited, gets highest weight)
        predicted = round(fk * 0.5 + fog * 0.3 + smog * 0.2, 1)

        # Cap at sensible range
        predicted = max(1.0, min(20.0, predicted))

        # Get target for this audience
        audience_lower = audience.lower()
        targets        = AUDIENCE_GRADE_TARGETS.get(audience_lower, AUDIENCE_GRADE_TARGETS["patients"])
        target         = targets["target"]
        inject         = predicted > targets["max"]

        # Build human-readable guidance
        if inject:
            gap = predicted - target
            guidance = (
                f"Simplify to Grade {target}: "
                f"shorter sentences (max 15 words), "
                f"replace polysyllabic words, use active voice. "
                f"Current complexity is {gap:.1f} grades above target."
            )
        else:
            guidance = f"Readability is appropriate for {audience} (Grade {predicted} vs target {target})"

        return {
            "predicted_grade":     predicted,
            "target_grade":        target,
            "target_label":        targets["label"],
            "inject_simplify":     inject,
            "metrics": {
                "flesch_kincaid":  round(fk, 1),
                "gunning_fog":     round(fog, 1),
                "smog":            round(smog, 1),
            },
            "flesch_reading_ease": round(ease, 1),
            "guidance":            guidance,
        }

    except ImportError:
        print("[PIE] textstat not installed - using fallback")
        return _readability_fallback(brief_text, audience)
    except Exception as e:
        print(f"[PIE] Readability error: {e}")
        return _readability_fallback(brief_text, audience)


def _readability_fallback(text: str, audience: str) -> dict:
    """
    Simple readability estimate without textstat.
    Uses average sentence length and word length as proxies.
    """
    sentences = re.split(r"[.!?]+", text)
    sentences = [s.strip() for s in sentences if s.strip()]
    words     = text.split()

    avg_sentence_len = len(words) / max(len(sentences), 1)
    avg_word_len     = sum(len(w) for w in words) / max(len(words), 1)

    # Rough FK approximation
    predicted = round(0.39 * avg_sentence_len + 11.8 * (avg_word_len / 5) - 15.59, 1)
    predicted = max(1.0, min(20.0, predicted))

    targets = AUDIENCE_GRADE_TARGETS.get(audience.lower(), AUDIENCE_GRADE_TARGETS["patients"])

    return {
        "predicted_grade":     predicted,
        "target_grade":        targets["target"],
        "target_label":        targets["label"],
        "inject_simplify":     predicted > targets["max"],
        "metrics":             {"approx": predicted},
        "flesch_reading_ease": None,
        "guidance":            f"Approximate grade estimate (textstat fallback)",
        "source":              "rule-based fallback",
    }


# ══════════════════════════════════════════════════════════════════
#  ENRICHED PROMPT BUILDER
#  Takes all 5 classifier outputs and builds the structured prompt
#  that gets sent to the LLM
# ══════════════════════════════════════════════════════════════════

def build_enriched_prompt(
    brief_text:    str,
    audience:      dict,
    jurisdiction:  dict,
    risk:          dict,
    tone:          dict,
    readability:   dict,
    user_context:  dict = None,
) -> str:
    """
    Assemble all classifier outputs into a rich, structured prompt
    that tells the LLM exactly what to do and why.

    The enriched prompt has four sections:
      1. CONTEXT - who the user is, what they're building
      2. INTELLIGENCE - what the PIE detected
      3. CONSTRAINTS - what the LLM must/must not do
      4. REQUEST - the original user brief

    This separation is intentional: the LLM can distinguish between
    context (informational), constraints (must-follow), and request
    (the actual task).
    """
    ctx = user_context or {}
    lines = ["You are a senior Pharmaceutical Company digital strategist."]
    lines.append("")

    # ── CONTEXT ──
    lines.append("=== PROJECT CONTEXT ===")
    if ctx.get("build_type"):
        lines.append(f"Build type   : {ctx['build_type']}")
    if ctx.get("dept"):
        lines.append(f"Department   : {ctx['dept']}")
    if ctx.get("country"):
        lines.append(f"Country      : {ctx['country']}")
    if ctx.get("language"):
        lines.append(f"Language     : {ctx['language']}")
    lines.append("")

    # ── INTELLIGENCE ──
    lines.append("=== PROMPT INTELLIGENCE ENGINE OUTPUT ===")
    lines.append(f"Audience     : {audience['audience'].title()} (confidence: {audience['confidence']})")
    if audience.get("flag_for_review"):
        lines.append(f"  ⚠ LOW CONFIDENCE - please confirm audience type with user")
    lines.append(f"Jurisdiction : {jurisdiction['body']}")
    lines.append(f"Framework    : {jurisdiction['framework']}")
    if jurisdiction.get("gdpr"):
        lines.append(f"  GDPR applies - cookie consent banner required")
    lines.append(f"Risk Level   : {risk['level']} (score: {risk['risk_score']})")
    if risk["triggers"]:
        lines.append(f"  Risk terms detected: {', '.join(risk['triggers'])}")
    lines.append(f"Brand Tone   : {tone['label']} (score: {tone['tone_score']})")
    lines.append(f"Readability  : Predicted Grade {readability['predicted_grade']}, target Grade {readability['target_grade']} for {audience['audience']}")
    lines.append("")

    # ── CONSTRAINTS ──
    lines.append("=== CONSTRAINTS (YOU MUST FOLLOW THESE) ===")

    # Risk-based constraints
    for rec in risk["recommendations"]:
        lines.append(f"• {rec}")

    # Tone guidance injection
    if tone["inject_guidance"]:
        lines.append("• TONE: Brief is off-brand. Write in brand voice:")
        lines.append("  Human, optimistic, scientifically credible, clear, no marketing hype.")

    # Readability injection
    if readability["inject_simplify"]:
        lines.append(f"• READABILITY: {readability['guidance']}")

    # Jurisdiction-specific constraints
    body = jurisdiction.get("body", "")
    if "FDA" in body:
        lines.append("• FDA: Must include fair balance - side effects alongside any benefit claims.")
    if "EMA" in body or "MHRA" in body:
        lines.append("• EU/UK: No promotional claims without approved indication reference.")
    if "TGA" in body:
        lines.append("• TGA: Consumer health claims require pre-approval in Australia.")

    lines.append("• DO NOT produce generic Pharmaceutical Company boilerplate - be specific to this brief.")
    lines.append("• Return ONLY valid JSON with the fields specified. No markdown, no explanation.")
    lines.append("")

    # ── REQUEST ──
    lines.append("=== USER REQUEST ===")
    lines.append(brief_text)
    lines.append("")
    lines.append("=== REQUIRED JSON OUTPUT FORMAT ===")
    lines.append("""Return this exact JSON structure:
{
  "projectTitle":    "specific project name",
  "goal":            "2-3 sentence specific goal for this audience in this market",
  "audience":        "specific description of this audience in this context",
  "keyMessages":     ["message 1", "message 2", "message 3"],
  "contentSections": ["Section - specific description", "Section - specific description"],
  "toneAndStyle":    "specific tone for this audience and jurisdiction",
  "inspiration":     "specific design references relevant to this project"
}""")

    return "\n".join(lines)


# ══════════════════════════════════════════════════════════════════
#  PIE SCORE CALCULATOR
#  Combines all 5 classifier outputs into a single 0–100 quality score
# ══════════════════════════════════════════════════════════════════

def calculate_pie_score(audience: dict, jurisdiction: dict, risk: dict,
                        tone: dict, readability: dict) -> dict:
    """
    Weighted PIE score (0–100):
      Compliance (inverse risk)  40%  - most important for Pharmaceutical Company 
      Brand tone                 30%  - second most important
      Audience confidence        20%  - detection certainty
      Readability                10%  - content complexity fit

    Returns: { pie_score, breakdown, grade, interpretation }
    """
    # Component scores (all 0–100)
    compliance_score  = round((1 - risk["risk_score"]) * 100)
    tone_score        = round(tone["tone_score"] * 100)
    audience_score    = round(audience["confidence"] * 100)

    # Readability: 100 if on target, loses 10 points per grade above max
    target = readability["target_grade"]
    predicted = readability["predicted_grade"]
    grade_gap = max(0, predicted - target)
    readability_score = max(0, round(100 - grade_gap * 10))

    # Weighted combination
    pie_score = round(
        compliance_score  * 0.40 +
        tone_score        * 0.30 +
        audience_score    * 0.20 +
        readability_score * 0.10
    )

    # Human-readable grade
    if pie_score >= 90:
        grade = "A"
        interpretation = "Ready for LLM - strong signal quality"
    elif pie_score >= 75:
        grade = "B"
        interpretation = "Proceed - minor enrichments applied"
    elif pie_score >= 60:
        grade = "C"
        interpretation = "Proceed with caution - review recommendations"
    else:
        grade = "D"
        interpretation = "High risk - human review recommended before generation"

    return {
        "pie_score": pie_score,
        "grade":     grade,
        "interpretation": interpretation,
        "breakdown": {
            "compliance":   compliance_score,
            "tone":         tone_score,
            "audience":     audience_score,
            "readability":  readability_score,
        }
    }


def adapt_content(generated_content: str, pie_snapshot: dict) -> dict:
    """
    Deterministic post-generation adaptation pass.

    This is intentionally rule-based for production safety:
      - no external API call required
      - fully traceable edits
      - never mutates core PIE scoring from the original brief
    """
    start = time.time()
    adapted = generated_content or ""
    original = adapted
    changes_made = []
    rationale = []

    readability = pie_snapshot.get("readability", {})
    tone = pie_snapshot.get("tone", {})
    risk = pie_snapshot.get("risk", {})
    audience_label = pie_snapshot.get("audience", {}).get("audience", "patients")
    jurisdiction = pie_snapshot.get("jurisdiction", {})
    risk_level = risk.get("level", "LOW")

    # Censored content should not be transformed into "publishable" output.
    if risk_level == "CENSORED":
        return {
            "adapted_content": adapted,
            "changes_made": [],
            "rationale": [
                "Content blocked: CENSORED risk level detected from PIE pre-check.",
                "No adaptation applied. Human review required.",
            ],
            "adaptation_time": round(time.time() - start, 2),
            "post_assessment": None,
            "blocked": True,
        }

    # 1) Readability simplification
    if readability.get("inject_simplify"):
        before = adapted
        replacements = [
            (r"\b(utilise|utilize)\b", "use"),
            (r"\b(leverage)\b", "use"),
            (r"\bcommence\b", "start"),
            (r"\bapproximately\b", "about"),
            (r"\bprior to\b", "before"),
            (r"\b(very|extremely|highly)\s+", ""),
        ]
        for pattern, replacement in replacements:
            adapted = re.sub(pattern, replacement, adapted, flags=re.IGNORECASE)
        adapted = re.sub(r"\s{2,}", " ", adapted).strip()
        if adapted != before:
            changes_made.append("Simplified vocabulary and sentence structure")
            rationale.append(readability.get("guidance", "Readability simplification requested"))

    # 2) Brand tone alignment
    if tone.get("inject_guidance"):
        before = adapted
        # Keep replacement scope conservative to avoid altering valid clinical meaning.
        adapted = re.sub(
            r"\b(revolutionary|groundbreaking|miracle|guaranteed)\b",
            "evidence-based",
            adapted,
            flags=re.IGNORECASE,
        )
        adapted = re.sub(r"!{2,}", "!", adapted)
        if adapted != before:
            changes_made.append("Aligned to Pharmaceutical Company brand voice (optimistic plus scientific)")
            rationale.append(f"Top corpus match: {tone.get('top_match', 'n/a')}")

    # 3) High-risk compliance guardrails
    if risk_level == "HIGH":
        before = adapted
        lower = adapted.lower()
        has_safety = ("important safety information" in lower) or ("fair balance" in lower)
        if not has_safety:
            adapted += "\n\nImportant Safety Information: Refer to approved prescribing information and present benefits with relevant risk context."

        body = jurisdiction.get("body", "")
        has_regulatory_note = ("no off-label" in lower) or ("approved indication" in lower)
        if (("FDA" in body) or ("EMA" in body) or ("MHRA" in body)) and not has_regulatory_note:
            adapted += "\nRegulatory Note: Include only approved indications and avoid off-label claims."

        if adapted != before:
            changes_made.append("Added compliance guardrails for high-risk content")
            rationale.append("High-risk classification triggered mandatory safety and regulatory framing")

    post_assessment = None
    if adapted != original and adapted.strip():
        adapted_risk = score_risk(adapted, jurisdiction)
        adapted_tone = analyse_tone(adapted)
        adapted_readability = predict_readability(adapted, audience_label)
        adapted_scoring = calculate_pie_score(
            pie_snapshot.get("audience", {}),
            jurisdiction,
            adapted_risk,
            adapted_tone,
            adapted_readability,
        )
        post_assessment = {
            "pie_score_estimate": adapted_scoring["pie_score"],
            "pie_grade_estimate": adapted_scoring["grade"],
            "risk": adapted_risk,
            "tone": adapted_tone,
            "readability": adapted_readability,
        }

    return {
        "adapted_content": adapted,
        "changes_made": changes_made,
        "rationale": rationale,
        "adaptation_time": round(time.time() - start, 2),
        "post_assessment": post_assessment,
        "blocked": False,
    }


# ══════════════════════════════════════════════════════════════════
#  MASTER FUNCTION - run_pie()
#  This is the single function you call from server.py
#  It runs all 5 classifiers and returns everything
# ══════════════════════════════════════════════════════════════════

def run_pie(
    brief_text:   str,
    country:      str  = "",
    dept:         str  = "",
    build_type:   str  = "",
    language:     str  = "English",
    user_name:    str  = "",
    initial_generated: str = "",
) -> dict:
    """
    Run all 5 PIE classifiers on a brief and return the full results.

    Args:
        brief_text:  The user's raw brief input
        country:     Country/region from user profile (e.g. "Germany")
        dept:        Department from user profile (e.g. "Digital Marketing")
        build_type:  What they're building (e.g. "Webpage", "Landing Page")
        language:    Primary language (e.g. "English", "French")
        user_name:   User's name for personalised prompts
        initial_generated: Optional generated copy to adapt after PIE classification

    Returns a dict with:
        pie_score:       int (0–100)
        audience:        dict (Classifier 1 output)
        jurisdiction:    dict (Classifier 2 output)
        risk:            dict (Classifier 3 output)
        tone:            dict (Classifier 4 output)
        readability:     dict (Classifier 5 output)
        enriched_prompt: str (the prompt to send to the LLM)
        adaptation:      dict | None (optional post-generation adaptation result)
        processing_time: float (seconds taken)
        audit_log:       dict (everything needed for compliance audit)
    """
    start = time.time()
    print(f"\n[PIE] Running pipeline on: \"{brief_text[:60]}...\"")

    # ── Run classifiers in sequence ──────────────────────────────
    print("[PIE] 1/5 Audience classifier...")
    audience = classify_audience(brief_text)

    print("[PIE] 2/5 Jurisdiction detector...")
    jurisdiction = detect_jurisdiction(brief_text, country)

    print("[PIE] 3/5 Risk scorer...")
    risk = score_risk(brief_text, jurisdiction)

    print("[PIE] 4/5 Brand tone analyser...")
    tone = analyse_tone(brief_text)

    print("[PIE] 5/5 Readability predictor...")
    readability = predict_readability(brief_text, audience["audience"])

    # ── Calculate PIE score ──────────────────────────────────────
    scoring = calculate_pie_score(audience, jurisdiction, risk, tone, readability)

    # ── Build enriched prompt ────────────────────────────────────
    user_context = {
        "build_type": build_type,
        "dept":       dept,
        "country":    country,
        "language":   language,
        "user_name":  user_name,
    }
    enriched_prompt = build_enriched_prompt(
        brief_text, audience, jurisdiction, risk, tone, readability, user_context
    )

    adaptation = None
    if isinstance(initial_generated, str) and initial_generated.strip():
        adaptation = adapt_content(
            initial_generated,
            {
                "audience": audience,
                "jurisdiction": jurisdiction,
                "risk": risk,
                "tone": tone,
                "readability": readability,
                "pie_score": scoring["pie_score"],
            },
        )

    elapsed = round(time.time() - start, 2)
    print(f"[PIE] Done in {elapsed}s - PIE score: {scoring['pie_score']}/100 ({scoring['grade']})")

    # ── Audit log - saved per run for compliance traceability ────
    import datetime
    audit_log = {
        "timestamp":        datetime.datetime.utcnow().isoformat() + "Z",
        "brief_text":       brief_text,
        "user_context":     user_context,
        "classifier_outputs": {
            "audience":     audience,
            "jurisdiction": jurisdiction,
            "risk":         risk,
            "tone":         tone,
            "readability":  readability,
        },
        "pie_score":        scoring["pie_score"],
        "adaptation_applied": bool(adaptation),
        "processing_time":  elapsed,
    }

    return {
        "pie_score":        scoring["pie_score"],
        "pie_grade":        scoring["grade"],
        "pie_interpretation": scoring["interpretation"],
        "pie_breakdown":    scoring["breakdown"],
        "audience":         audience,
        "jurisdiction":     jurisdiction,
        "risk":             risk,
        "tone":             tone,
        "readability":      readability,
        "enriched_prompt":  enriched_prompt,
        "adaptation":       adaptation,
        "processing_time":  elapsed,
        "audit_log":        audit_log,
    }


# ══════════════════════════════════════════════════════════════════
#  STANDALONE TEST - run this file directly to see it work
#  python pie_new.py
# ══════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    print("=" * 60)
    print("PROMPT INTELLIGENCE ENGINE - STANDALONE TEST")
    print("=" * 60)

    test_briefs = [
        {
            "brief":   "Employee information page about our new birthday scheme, free health check up ath partner clinic. One voucher eligible per employee for the year 2026-2027",
            "country": "Germany",
            "dept":    "Human Resources",
        },
        {
            "brief":   "Landing page for healthcare providers about our diabetes management platform in the UK",
            "country": "United Kingdom",
            "dept":    "Digital Marketing",
        },
        {
            "brief":   "Internal team portal for the CXI+AI digital team to track project delivery and speed dating event after event.",
            "country": "Global",
            "dept":    "CXI+AI",
        },
    ]

    for i, t in enumerate(test_briefs):
        print(f"\n{'─'*60}")
        print(f"TEST {i+1}: {t['brief'][:55]}...")
        print(f"{'─'*60}")

        result = run_pie(
            t["brief"],
            country=t["country"],
            dept=t["dept"],
        )

        print(f"\n  PIE SCORE   : {result['pie_score']}/100 ({result['pie_grade']}) - {result['pie_interpretation']}")
        print(f"  Audience    : {result['audience']['audience']} (conf: {result['audience']['confidence']})")
        print(f"  Jurisdiction: {result['jurisdiction']['body']}")
        print(f"  Risk        : {result['risk']['level']} ({result['risk']['risk_score']})")
        print(f"  Tone        : {result['tone']['label']} ({result['tone']['tone_score']})")
        print(f"  Readability : Grade {result['readability']['predicted_grade']} → target {result['readability']['target_grade']}")
        print(f"  Time        : {result['processing_time']}s")
        print(f"\n  ENRICHED PROMPT PREVIEW (first 400 chars):")
        print(f"  {result['enriched_prompt'][:400]}...")

    print(f"\n{'='*60}")
    print("All tests complete.")
