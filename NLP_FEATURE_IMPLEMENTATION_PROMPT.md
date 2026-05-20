# NLP Report Feature Implementation Prompt

## Feature Overview
Implement an NLP-powered report submission system that processes user-submitted gibberish/test reports about flood situations in barangays and visualizes the analyzed danger zones on an interactive Leaflet map.

## User Workflow

### 1. Report Submission (Report Page)
- Users navigate to the **Report Page**
- Input a gibberish report about flooding/disaster in a specific barangay
  - Example reports:
    - "lahug is flooding"
    - "high flood in lahug"
    - "lots of people reported on lahug about lesser trees"
    - "barangay mambaling has water rising"
    - "cebu north coastal area experiencing heavy rain and flooding"
- Submit the report with a timestamp
- Report is stored with metadata (barangay detected, severity detected, user info)

### 2. NLP Processing with Keyword Synthesis
- Backend NLP classifier analyzes the report using keyword matching and synthesis:

#### **A. Keyword Synthesis & Matching**
  - Match words against predefined datasets:
    - **Barangay Database**: All Cebu barangay names (lahug, mambaling, talamban, etc.)
    - **Disaster Keywords**: flood, water, rain, landslide, storm, surge, overflow, rising, etc.
    - **Severity Indicators**:
      - High: "high flood", "severe flooding", "water rising", "emergency"
      - Medium: "flooding", "water", "wet", "rain"
      - Low: "trees", "minor", "slight", "some"
    - **Entity Types**: water, trees, people, residents, buildings, roads, etc.

#### **B. NLP Processing Pipeline**
  1. **Tokenize** the report text into words
  2. **Normalize** (lowercase, remove punctuation)
  3. **Match against keyword databases**:
     - Loop through barangay database → extract barangay name if found
     - Loop through disaster keywords → extract disaster type
     - Loop through severity indicators → determine severity level
     - Extract all matched keywords/entities
  4. **Synthesize** the matched data into structured output
  5. **Calculate confidence** based on keyword matches (e.g., 95% if multiple keywords match)

#### **C. Example Synthesis**
  Input: "lahug is flooding"
  - Keywords found: ["lahug", "flooding"]
  - Barangay match: "lahug" ✓
  - Disaster match: "flooding" ✓
  - Severity: "high" (disaster type indicates severity)
  - Output: `{"barangay": "lahug", "severity": "high", "type": "flooding", "confidence": 0.95}`

  Input: "lots of people reported on lahug about lesser trees"
  - Keywords found: ["lahug", "people", "trees"]
  - Barangay match: "lahug" ✓
  - Disaster match: none directly, but has damage indicators → severity "low"
  - Output: `{"barangay": "lahug", "severity": "low", "type": "tree_damage", "confidence": 0.75}`

- Return structured data to frontend:
  ```json
  {
    "barangay": "lahug",
    "severity": "high",
    "type": "flooding",
    "confidence": 0.85,
    "keywords": ["flooding", "water"],
    "matched_entities": ["water", "rising"],
    "reported_at": "2026-05-20T10:30:00Z"
  }
  ```

### 3. NLP Results Tab Display
- Create a new **NLP Tab** in the dashboard
- Display the analysis results:
  - Report text
  - Detected barangay
  - Severity level (color-coded: green/yellow/red)
  - Disaster type
  - Confidence score
  - Timestamp
  - List of submitted reports with their analysis

### 4. Map Visualization
- **Leaflet Map Integration**:
  - Load Cebu barangay GeoJSON
  - Highlight the detected barangay in danger zone color based on severity:
    - **Green**: Low/No threat
    - **Yellow**: Medium flood risk
    - **Red**: High flood risk
  - Show report marker on the map with:
    - Pop-up displaying report details
    - Icon color matching severity
  - Allow toggling between reports
  - Show barangay boundary and name

## Technical Requirements

### Frontend (Ionic/Angular)
- **Report Form Component**:
  - Text area for report input
  - Submit button
  - Loading indicator
  - Success/error feedback

- **NLP Tab/Page**:
  - Display recent reports
  - Show analysis results in card format
  - List view of all analyzed reports
  - Filter by severity or barangay

- **Map Component**:
  - Integrate Leaflet map library
  - Load and render Cebu barangay GeoJSON
  - Dynamic barangay highlighting based on severity
  - Report markers with pop-ups
  - Zoom to barangay on report selection
  - Legend showing severity colors

### Backend (Django/Python)
- **Report Model**:
  - Store report text
  - Store detected barangay
  - Store severity level
  - Store analysis confidence
  - Timestamp
  - User reference

- **NLP Classifier Endpoint** (`/api/nlp/analyze/`):
  - Accept report text as input
  - Process through keyword synthesis:
    1. **Tokenize & Normalize**: Convert text to lowercase, remove punctuation
    2. **Barangay Matching**: Loop through Cebu barangay names, find matches
    3. **Disaster Type Matching**: Match against disaster keywords dictionary
    4. **Severity Matching**: Use severity indicator keywords to classify level
    5. **Entity Extraction**: Identify relevant entities (water, people, trees, etc.)
  - Build confidence score based on matched keywords
  - Return structured JSON response with synthesis results
  - Handle edge cases (no barangay detected, gibberish, etc.)
  - **Keyword Databases to Use**:
    - Barangay list: Load from GeoJSON properties
    - Disaster keywords: `{flood, water, rain, surge, overflow, landslide, storm, rising}`
    - Severity keywords: `{high: [severe, high, emergency], medium: [flooding, water, rain], low: [trees, minor, slight]}`

- **Reports API Endpoints**:
  - `POST /api/reports/` - Submit new report
  - `GET /api/reports/` - List all reports
  - `GET /api/reports/{id}/` - Get specific report with NLP analysis

### GeoJSON Data
- Use existing `cebu_barangay_map.geojson`
- Properties should include:
  - barangay name (for matching detected barangay)
  - coordinates/geometry

## UI/UX Flow

```
Dashboard
    ├── Dashboard Tab (existing)
    ├── Report Tab (existing)
    │   └── Submit Report Form
    │       └── Success → Show NLP Analysis
    └── NLP Tab (NEW)
        ├── Analysis Results Card
        │   ├── Report text
        │   ├── Detected barangay
        │   ├── Severity badge (color-coded)
        │   ├── Disaster type
        │   └── Confidence score
        ├── Reports List
        └── Leaflet Map
            ├── Barangay boundaries (highlighted by severity)
            ├── Report markers
            └── Legend
```

## Test Data / Gibberish Reports
Examples to test with:
1. "lahug is flooding"
2. "high flood in lahug"
3. "cebu north has water rising"
4. "mambaling barangay experiencing flooding"
5. "lots of people reported on lahug about lesser trees"
6. "talamban area has flooding hazard"
7. "weather is bad in sudlon"
8. "barangay apas water level rising"

## Expected Output
After submitting a report like "lahug is flooding":
- **NLP Analysis**:
  - Barangay: Lahug
  - Severity: High
  - Type: Flooding
  - Confidence: 95%
- **Map Display**:
  - Lahug barangay highlighted in RED (high severity)
  - Marker placed on Lahug centroid
  - Pop-up shows report details

## Notes for Teacher/Submission
- This is a **Test Implementation** using gibberish/sample data
- Purpose: Demonstrate NLP integration with spatial visualization
- Real deployment would include:
  - Real-time data from actual flood sensors
  - Integration with disaster management systems
  - Multi-language support
  - Advanced NLP model training
- Current implementation focuses on:
  - Proof of concept
  - Barangay detection from text
  - Severity classification
  - Interactive map visualization
