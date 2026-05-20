# ============================================================
# nlp/classifier.py
# FloodGuard ASEAN — Enhanced NLP Classifier
# Keyword synthesis with barangay detection, disaster typing,
# severity classification, entity extraction & confidence scoring
# ============================================================

import re
import math

# ----------------------------------------------------------
# LOCATION DICTIONARY (Cebu Barangays)
# ----------------------------------------------------------
CEBU_LOCATIONS = [
    "Adlaon", "Agsungot", "Apas", "Bacayan", "Banawa",
    "Basak", "Binaliw", "Budlaan", "Bulacao", "Buhisan",
    "Busay", "Cambinocot", "Camputhaw", "Capitol Site",
    "Carreta", "Cogon Pardo", "Cogon Ramos", "Day-as",
    "Ermita", "F Cabantan", "Guba", "Guadalupe",
    "Hipodromo", "Inayawan", "Kalubihan", "Kalunasan",
    "Kamagayan", "Kamputhaw", "Kinasang-an", "Labangon",
    "Lahug", "Lorega", "Luz", "Mabolo", "Mabini",
    "Malubog", "Mambaling", "Mountain View", "Pahina Central",
    "Pahina San Miguel", "Pajac", "Pamutan", "Pardo",
    "Pari-an", "Paril", "Pasil", "Pit-os", "Pulangbato",
    "Pung-ol Sibugay", "Quiot", "Sambag 1", "Sambag 2",
    "San Antonio", "San Jose", "San Nicolas", "Santa Cruz",
    "Sapangdaku", "Sawang Calero", "Sirao", "Suba",
    "Sudlon 1", "Sudlon 2", "T. Padilla", "Tabunan",
    "Tagbao", "Talamban", "Taptap", "Tejero", "Tinago",
    "Tisa", "To-ong", "ULP", "Urgello", "Mandaue",
    "Lapu-Lapu", "Lapu Lapu", "Talisay", "Consolacion",
    "Liloan", "Cordova",
]

LOCATION_SET = {loc.lower(): loc for loc in CEBU_LOCATIONS}

# ----------------------------------------------------------
# DISASTER KEYWORDS
# ----------------------------------------------------------
DISASTER_KEYWORDS = {
    "flood": "flooding",
    "flooding": "flooding",
    "flooded": "flooding",
    "baha": "flooding",
    "water": "flooding",
    "tubig": "flooding",
    "rain": "flooding",
    "ulan": "flooding",
    "surge": "storm_surge",
    "storm": "storm",
    "bagyo": "storm",
    "typhoon": "storm",
    "landslide": "landslide",
    "overflow": "flooding",
    "umaapaw": "flooding",
    "rising": "flooding",
    "mataas": "flooding",
    "lubog": "flooding",
    "basa": "flooding",
    "wet": "flooding",
}

# ----------------------------------------------------------
# SEVERITY INDICATORS
# ----------------------------------------------------------
SEVERITY_HIGH = [
    "severe", "severe flooding", "high flood", "high",
    "emergency", "critical", "danger", "urgent",
    "water rising", "rising water", "nalunod", "lubog",
    "trapped", "drowning", "rescue", "tabang",
    "tulong", "saklolo", "delikado",
]

SEVERITY_MEDIUM = [
    "flooding", "flood", "water", "rain", "wet",
    "overflow", "umaapaw", "mataas", "basa",
    "rising", "peligro", "storm",
]

SEVERITY_LOW = [
    "trees", "tree", "lesser trees", "minor", "slight",
    "some", "possible", "alert", "ambon", "drizzle",
    "gamay", "people reported", "reported",
]

# ----------------------------------------------------------
# ENTITY TYPES
# ----------------------------------------------------------
ENTITY_KEYWORDS = {
    "water": ["water", "tubig", "baha", "flood", "rain", "ulan"],
    "trees": ["trees", "tree", "forest", "lesser trees", "vegetation"],
    "people": ["people", "residents", "folks", "community", "tao", "mga tao"],
    "buildings": ["building", "house", "houses", "structure", "bahay"],
    "roads": ["road", "street", "dalang", "highway", "bridge"],
    "rescue": ["rescue", "help", "tabang", "tulong", "saklolo"],
}

# ----------------------------------------------------------
# URGENCY KEYWORDS (keep for backward compatibility)
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
    # Check multi-word barangays first
    raw_text = ' '.join(tokens)
    for full_name in sorted(CEBU_LOCATIONS, key=len, reverse=True):
        if full_name.lower() in raw_text:
            return full_name
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
# URGENCY CLASSIFIER (backward compatible)
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
            "Cebuano": f"Alerto sa baha: Grabe nga baha sa {loc}. Palihog adto dayon sa pinakalapit nga evacuation center.",
            "Tagalog": f"Babala sa baha: Malubhang pagbaha sa {loc}. Mangyaring lumikas na agad sa pinakamalapit na evacuation center.",
            "English": f"FLOOD ALERT: Severe flooding in {loc}. Please evacuate immediately to the nearest evacuation center.",
        },
        "MEDIUM": {
            "Cebuano": f"PASIDAAN: Nagtubo ang tubig sa {loc}. Pag-andam ug posibleng pagbakwit.",
            "Tagalog": f"BABALA: Tumataas ang tubig sa {loc}. Maghanda para sa posibleng paglikas.",
            "English": f"FLOOD WARNING: Water rising in {loc}. Prepare for possible evacuation.",
        },
        "LOW": {
            "Cebuano": f"ABISO: Posibleng gamay nga baha sa {loc}. Pagbantay ug sunda ang mga updates.",
            "Tagalog": f"ABISO: Posibleng magbaha sa {loc}. Manatiling alerto at subaybayan ang mga update.",
            "English": f"ADVISORY: Light flooding possible in {loc}. Stay alert and monitor local updates.",
        },
    }

    return templates[urgency][language]

# ==========================================================
# ENHANCED NLP ANALYSIS FUNCTIONS
# ==========================================================

# ----------------------------------------------------------
# SEVERITY CLASSIFIER (enhanced with keyword synthesis)
# ----------------------------------------------------------
def classify_severity(tokens):
    text = ' '.join(tokens)

    # Check multi-word severity phrases
    for phrase in SEVERITY_HIGH:
        if phrase in text:
            return "high"
    for phrase in SEVERITY_MEDIUM:
        if phrase in text:
            return "medium"

    # Check individual tokens
    for token in tokens:
        if token in {"severe", "emergency", "critical", "danger", "urgent",
                     "rescue", "drowning", "trapped", "nalunod", "lubog"}:
            return "high"
        if token in {"flood", "flooding", "water", "rain", "storm",
                     "overflow", "rising", "mataas"}:
            return "medium"
        if token in {"trees", "minor", "slight", "some", "possible",
                     "reported", "ambon", "drizzle"}:
            return "low"

    # Assess based on matched keywords count
    high_count = sum(1 for t in tokens if t in SEVERITY_HIGH)
    med_count  = sum(1 for t in tokens if t in SEVERITY_MEDIUM)
    low_count  = sum(1 for t in tokens if t in SEVERITY_LOW)

    if high_count > 0:
        return "high"
    elif med_count > 0:
        return "medium"
    elif low_count > 0:
        return "low"
    return "low"

# ----------------------------------------------------------
# DISASTER TYPE DETECTION
# ----------------------------------------------------------
def detect_disaster_type(tokens, matched_keywords):
    text = ' '.join(tokens)

    # Check for specific disaster types
    if any(w in text for w in ["landslide", "landslide"]):
        return "landslide"
    if any(w in text for w in ["storm", "bagyo", "typhoon", "surge"]):
        return "storm"
    if any(w in text for w in ["flood", "baha", "water", "rain", "overflow",
                                "umaapaw", "rising", "mataas", "lubog"]):
        return "flooding"
    if any(w in text for w in ["trees", "tree", "lesser trees", "vegetation"]):
        return "tree_damage"
    if any(w in text for w in ["fire", "sunog"]):
        return "fire"
    if any(w in text for w in ["earthquake", "linog"]):
        return "earthquake"

    return "flooding"

# ----------------------------------------------------------
# ENTITY EXTRACTION
# ----------------------------------------------------------
def extract_entities(tokens):
    entities = []
    text = ' '.join(tokens)
    matched = set()

    for entity_type, keywords in ENTITY_KEYWORDS.items():
        for kw in keywords:
            if kw in text and entity_type not in matched:
                entities.append(entity_type)
                matched.add(entity_type)
                break

    return entities

# ----------------------------------------------------------
# CONFIDENCE CALCULATION
# ----------------------------------------------------------
def calculate_confidence(tokens, location, severity, disaster_type):
    score = 0.0
    max_score = 0.0

    # Barangay match = 40%
    max_score += 40.0
    if location:
        score += 40.0
    else:
        return 0.30  # Low confidence if no barangay detected

    # Disaster type match = 25%
    max_score += 25.0
    disaster_hit = False
    text = ' '.join(tokens)
    for kw in DISASTER_KEYWORDS:
        if kw in text:
            disaster_hit = True
            break
    if disaster_hit:
        score += 25.0

    # Severity keywords = 20%
    max_score += 20.0
    severity_count = 0
    for t in tokens:
        if t in SEVERITY_HIGH + SEVERITY_MEDIUM + SEVERITY_LOW:
            severity_count += 1
    score += min(20.0, severity_count * 5.0)

    # Entity keywords = 10%
    max_score += 10.0
    entities = extract_entities(tokens)
    score += min(10.0, len(entities) * 3.0)

    # General keyword density = 5%
    max_score += 5.0
    meaningful = [t for t in tokens if len(t) > 2]
    score += min(5.0, len(meaningful) * 0.5)

    # Normalize
    confidence = score / max_score
    return round(min(confidence, 1.0), 4)

# ----------------------------------------------------------
# ENHANCED NLP ANALYZE (full synthesis pipeline)
# ----------------------------------------------------------
def analyze_report(text):
    tokens   = preprocess(text)
    location = extract_location(tokens)
    severity = classify_severity(tokens)
    disaster_type = detect_disaster_type(tokens, [t for t in tokens])

    # Extract keywords (all matched words)
    matched_keywords = []
    all_keywords = (
        list(DISASTER_KEYWORDS.keys()) +
        SEVERITY_HIGH + SEVERITY_MEDIUM + SEVERITY_LOW +
        [kw for kw_list in ENTITY_KEYWORDS.values() for kw in kw_list]
    )
    text_lower = ' '.join(tokens)
    for kw in sorted(set(all_keywords), key=len, reverse=True):
        if kw in text_lower and kw not in matched_keywords:
            matched_keywords.append(kw)

    # Extract entities
    entities = extract_entities(tokens)

    # Calculate confidence
    confidence = calculate_confidence(tokens, location, severity, disaster_type)

    # Backward compatibility fields
    urgency = severity.upper()
    language = detect_language(tokens)
    alert = generate_alert(location, urgency, language)

    return {
        "message": text,
        "barangay": location,
        "severity": severity,
        "disaster_type": disaster_type,
        "confidence": confidence,
        "keywords": matched_keywords[:10],
        "matched_entities": entities,
        "location": location,
        "urgency": urgency.upper(),
        "language": language,
        "alert": alert,
    }

# ----------------------------------------------------------
# MAIN CLASSIFY FUNCTION (backward compatible)
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