# ============================================================
# nlp/classifier.py
# FloodGuard ASEAN — NLP Classifier
# Ported from Google Colab to Django
# ============================================================

import re

# ----------------------------------------------------------
# LOCATION DICTIONARY
# ----------------------------------------------------------
CEBU_LOCATIONS = [
    "Lahug", "Guadalupe", "Talamban", "Busay", "Banawa",
    "Pari-an", "Ermita", "Sambag", "Mabolo", "Apas",
    "Labangon", "Pardo", "Tisa", "Bulacao", "Inayawan",
    "Carbon", "Colon", "Fuente", "Escario", "Kalunasan",
    "Kinasang-an", "Luz", "Pahina", "Tejero", "Tinago",
    "Mandaue", "Lapu-Lapu", "Talisay",
    "Consolacion", "Liloan", "Cordova",
    "Guar", "Tal", "Lahog", "Mandue",
]

LOCATION_SET = {loc.lower(): loc for loc in CEBU_LOCATIONS}

# ----------------------------------------------------------
# URGENCY KEYWORDS
# ----------------------------------------------------------
HIGH_KEYWORDS = [
    "baha", "lubog", "tabang", "rescue", "sos",
    "nalunod", "patay", "liki",
    "tulong", "saklolo", "lunod", "delikado", "naiipit",
    "help", "drowning", "trapped", "emergency",
    "critical", "danger", "urgent",
]

MEDIUM_KEYWORDS = [
    "umaapaw", "mataas", "puno", "hapit",
    "papataas", "overflow", "flooding", "apas",
    "rising", "peligro",
]

MEDIUM_PHRASES = [
    "mataas ang tubig", "mataas na ang tubig",
    "water rising", "rising water", "road flooded",
    "lumalaki ang tubig", "puno na", "hapit na",
    "papataas pa",
]

LOW_KEYWORDS = [
    "ulan", "ambon", "basa", "tag-ulan", "gamay",
    "umuulan", "maulap", "rain", "wet", "drizzle",
    "possible", "tubig", "alert", "mag-amping",
    "mag-ingat",
]

# ----------------------------------------------------------
# LANGUAGE MARKERS
# ----------------------------------------------------------
CEBUANO_MARKERS = [
    "nga", "naa", "dili", "kay", "unya", "bitaw",
    "dapit", "unsay", "basta", "tabang", "apas",
    "lubog", "ulan", "ambon", "hapit",
]
TAGALOG_MARKERS = [
    "ang", "mga", "ay", "ito", "yung", "saan",
    "paano", "naman", "kaya", "po", "raw",
    "tulong", "lunod", "naiipit", "umuulan",
]
ENGLISH_MARKERS = [
    "the", "is", "are", "and", "flood", "water",
    "road", "help", "area", "rising", "danger",
    "please", "already", "street",
]

# ----------------------------------------------------------
# PREPROCESSOR
# ----------------------------------------------------------
def preprocess(text):
    text = text.lower()
    text = re.sub(r'[^a-z0-9\s]', ' ', text)
    return text.split()

# ----------------------------------------------------------
# LOCATION EXTRACTOR
# ----------------------------------------------------------
def extract_location(tokens):
    for token in tokens:
        if token in LOCATION_SET:
            return LOCATION_SET[token]
        # Fallback: lightweight typo tolerance via character overlap.
        for key, name in LOCATION_SET.items():
            if len(token) >= 4:
                # prefix/substring matches
                if token in key or key in token:
                    return name

                # char-wise similarity (edit-distance approximation)
                matches = sum(1 for a, b in zip(token, key) if a == b)
                if matches >= (len(key) - 1 if (len(key) - 1) > 0 else 0):
                    return name
    return None

# ----------------------------------------------------------
# URGENCY CLASSIFIER
# ----------------------------------------------------------
def classify_urgency(tokens):
    score = 0
    text  = ' '.join(tokens)

    for token in tokens:
        if token in HIGH_KEYWORDS:
            score += 2.0
        elif token in MEDIUM_KEYWORDS:
            score += 0.5
        elif token in LOW_KEYWORDS:
            score += 0.2

    phrase_matched = False
    for phrase in MEDIUM_PHRASES:
        if phrase in text:
            score += 0.8
            phrase_matched = True

    high_hit = any(token in HIGH_KEYWORDS for token in tokens)

    if high_hit and score >= 2.0:
        return "HIGH"
    elif score >= 0.9 or phrase_matched:
        return "MEDIUM"
    else:
        return "LOW"

# ----------------------------------------------------------
# LANGUAGE DETECTOR
# ----------------------------------------------------------
def detect_language(tokens):
    ceb = sum(1   for t in tokens if t in CEBUANO_MARKERS)
    tag = sum(1   for t in tokens if t in TAGALOG_MARKERS)
    eng = sum(0.8 for t in tokens if t in ENGLISH_MARKERS)

    scores = {"Cebuano": ceb, "Tagalog": tag, "English": eng}
    best   = max(scores, key=scores.get)

    if scores[best] == 0:
        return "Cebuano"
    return best

# ----------------------------------------------------------
# ALERT GENERATOR
# ----------------------------------------------------------
def generate_alert(location, urgency, language):
    """Generate deterministic alerts.

    This implementation is intentionally placeholder-friendly for the PDF pipeline:
    - [HOURS], [PATHWAY], [EVACUATION CENTER], [SAFE ROUTE]

    When your flood/GIS layer is ready, you can replace the placeholder variables
    with real model outputs.
    """

    loc = location or "your area"

    # ---- PDF template slots (placeholders for now) ----
    hours = {
        "HIGH": "6",
        "MEDIUM": "4",
        "LOW": "2",
    }.get(urgency, "4")

    pathway = {
        "HIGH": "Gorordo Avenue",
        "MEDIUM": "main drainage channels",
        "LOW": "local waterways",
    }.get(urgency, "local waterways")

    evacuation_center = {
        "HIGH": "Cebu City Sports Center",
        "MEDIUM": "nearest evacuation center",
        "LOW": "barangay evacuation area",
    }.get(urgency, "nearest evacuation center")

    safe_route = {
        "HIGH": "via well-lit safer roads",
        "MEDIUM": "via roads away from low-lying areas",
        "LOW": "follow LGU posted safe routes",
    }.get(urgency, "follow LGU posted safe routes")

    templates = {
        "HIGH": {
            # Matches the PDF intent: ETA + pathway + evacuation center + safe route.
            "Cebuano": f"⚠️ ALERTO SA BAHA: Grabe nga baha ang gilauman sa {loc} sulod sa {hours} oras. Ang baha moagi ug mosunod sa {pathway}. Palihog lumikas ngadto sa {evacuation_center} dayon pinaagi sa {safe_route}. Ayaw pagpabilin sa ubos nga dapit." ,
            "Tagalog": f"⚠️ BABALA SA BAHA: Malubhang pagbaha ang inaasahan sa {loc} sa loob ng {hours} oras. Babalot/aatake ang tubig sa kahabaan ng {pathway}. Mangyaring lumikas sa {evacuation_center} agad sa pamamagitan ng {safe_route}. Huwag manatili sa mga mabababang lugar." ,
            "English": f"⚠️ FLOOD ALERT: Severe flooding is expected in {loc} within {hours} hours. Floodwaters will move along {pathway}. Please evacuate to {evacuation_center} immediately via {safe_route}. Do not stay in low-lying areas.",
        },
        "MEDIUM": {
            "Cebuano": f"⚠️ PASIDAAN: Nag-uswag ang pagbaha sa {loc}. Mahimong mosaka ang tubig (pinaagi sa {pathway}) sulod sa {hours} oras. Moadto sa {evacuation_center} isip pag-andam. Likayi ang mga ubos nga lugar ug magpabilin nga alerto.",
            "Tagalog": f"⚠️ FLOOD WARNING: Tumataas ang tubig sa {loc}. Maaaring umakyat ang tubig sa loob ng {hours} oras sa kahabaan ng {pathway}. Lumipat sa {evacuation_center} bilang pag-iingat. Iwasan ang mabababang lugar at manatiling alerto.",
            "English": f"⚠️ FLOOD WARNING: Flooding is developing in {loc}. Water may rise along {pathway} within {hours} hours. Move to {evacuation_center} as a precaution. Avoid low areas and stay alert.",
        },
        "LOW": {
            "Cebuano": f"ℹ️ ABISO: Posibleng gamay nga baha sa {loc}. Likayi ang ubos nga dapit nga duol sa {pathway}. Magtan-aw sa mga anunsyo sa LGU alang sa updates.",
            "Tagalog": f"ℹ️ ADVISORY: Posibleng bahagyang pagbaha sa {loc}. Iwasan ang mga mabababang lugar malapit sa {pathway}. Suriin ang mga anunsyo ng LGU para sa mga update.",
            "English": f"ℹ️ FLOOD ADVISORY: Light flooding is possible in {loc}. Avoid low-lying areas near {pathway}. Check local LGU announcements for updates.",
        },
    }

    return templates[urgency][language]


# ----------------------------------------------------------
# MAIN CLASSIFY FUNCTION
# ----------------------------------------------------------
def classify_message(text):
    tokens   = preprocess(text)
    location = extract_location(tokens)
    urgency  = classify_urgency(tokens)
    language = detect_language(tokens)
    alert    = generate_alert(location, urgency, language)

    return {
        "message" : text,
        "location": location,
        "urgency" : urgency,
        "language": language,
        "alert"   : alert,
        # PDF requirement: flag when automated extraction fails.
        "requires_manual_review": location is None,
    }
