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
        for key, name in LOCATION_SET.items():
            if len(token) >= 4 and (
                token in key or key in token or
                sum(a == b for a, b in zip(token, key)) >= len(key) - 1
            ):
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
    loc = location or "your area"

    templates = {
        "HIGH": {
            "Cebuano": f"⚠️ ALERTO SA BAHA: Grabe nga baha sa {loc}. Palihog adto dayon sa pinakalapit nga evacuation center.",
            "Tagalog": f"⚠️ BABALA SA BAHA: Malubhang pagbaha sa {loc}. Mangyaring lumikas na agad sa pinakamalapit na evacuation center.",
            "English": f"⚠️ FLOOD ALERT: Severe flooding in {loc}. Please evacuate immediately to the nearest evacuation center.",
        },
        "MEDIUM": {
            "Cebuano": f"⚠️ PASIDAAN: Nagtubo ang tubig sa {loc}. Pag-andam ug posibleng pagbakwit.",
            "Tagalog": f"⚠️ BABALA: Tumataas ang tubig sa {loc}. Maghanda para sa posibleng paglikas.",
            "English": f"⚠️ FLOOD WARNING: Water rising in {loc}. Prepare for possible evacuation.",
        },
        "LOW": {
            "Cebuano": f"ℹ️ ABISO: Posibleng gamay nga baha sa {loc}. Pagbantay ug sunda ang mga updates.",
            "Tagalog": f"ℹ️ ABISO: Posibleng magbaha sa {loc}. Manatiling alerto at subaybayan ang mga update.",
            "English": f"ℹ️ ADVISORY: Light flooding possible in {loc}. Stay alert and monitor local updates.",
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
    }