# Changelog - Google Play Interview Prep Dashboard

## Session: September 5, 2025

### Major Changes

#### 🚫 Upload-First, Agnostic Dashboard
- Removed all auto-loading and hardcoded/sampled data paths
- Disabled all tabs until files are processed; Upload is the landing tab
- Hid Interview Countdown until a JD file (filename contains "JD") with an `Interview Date:` is parsed
- Replaced remaining static copy with placeholders; content is now derived only from uploaded files

#### 🧭 Command Center Now Data-Driven
- Metrics tiles: render only from uploaded metrics (CSV or extracted) with strict validation (currency/percent/M,B,K)
- Removed CSV-from-text mis-parsing; CSV parsing occurs only for explicit metrics CSV uploads
- Nonsense tiles eliminated; long labels/growth/context are truncated for clean UI
- Added Copy Metrics button (Markdown)

#### 🧠 Company Intel (Agnostic)
- Added `extractCompanyIntelAgnostic()` to build a Markdown briefing from uploaded content:
  - Detected tech stack, key metrics, strengths, and gaps
- Render briefing as Markdown; added tech stack badges above briefing
- Copy/Download briefing actions (Markdown)

#### 📄 Resume Integration
- Text extraction from uploaded resume files (filename contains "resume")
- Merged resume-derived strengths into Command Center strengths
- Role inference from resume when not available elsewhere (prefers recent dated title lines)
- PDF resumes supported via PDF.js; DOCX via Mammoth

#### 🧩 SQL-Only Experience, With Helpers
- SQL tab shows only if SQL is detected in uploads
- Parsed ```sql fenced blocks and inline SELECT/WITH queries; best snippet auto-loads into editor
- Snippet picker with file filter, source note, and Copy button
- Dynamic schema (tables from SQL) and scenarios derived from document signals (retention, segmentation, optimization, pipelines)
- Enriched SQL Context card: fills scale, volume, key challenge, tech stack, focus areas, and interviewers from data

#### ✍️ Power Intro & Talking Points
- Power Intro generator is now agnostic and built from your metrics, strengths, and tech stack
- Talking Points generator derives Technical Relevance, Proof Points, and Strengths from uploaded content

#### 🔖 Quick Tips
- Tips generated from strengths, gaps, and tech stack; Generate Tips button added

#### 📦 Snapshot Export
- Export Snapshot (Markdown) and Copy Snapshot actions include: tech stack, metrics, strengths, gaps, panelists, top Q&A, SQL snippet list, and the executive brief

### Technical Notes
- Added resume-based helpers: role inference and strength extraction from uploaded resume files
- Added PDF parsing to `readFileContent()` to support PDF uploads across the app
- Added UI gating (`requires-data`) and disabled classes for tabs before processing
- Added source notes/tooltips for metrics and SQL snippet sources

### Files Updated (highlights)
- `index.html`: upload-first UI, requires-data gating, toolbars (copy/export), tech badges, SQL picker filter
- `assets/js/app.js`: upload-only logic, metrics sanitation, dynamic intel/contexts, SQL detection & picker, export/copy helpers, resume parsing & role inference, PDF parsing
- `assets/css/styles.css`: disabled state for tabs/buttons

### Migration/Usage
- Start on Upload tab, add your files (JD, resume, Q&A, metrics CSV, intel/playbook)
- Click Process Files — all tabs and content will derive from your materials
- Use Copy/Export to share metrics/brief/snapshot; SQL features activate only when SQL is detected

## Session: August 30, 2025

### Major Changes

#### ✅ Vercel Deployment Preparation
- **Created `vercel.json`** - Configured routing for proper HTML file serving on Vercel
- **Eliminated CORS Dependencies** - Replaced fetch-based file loading with embedded data
- **Updated Button Text** - Changed "Load From input_files" to "Load Sample Data"

#### ✅ Enhanced Q&A Content (From input_files)
**Source:** `input_files/google_play_interview_qa.md`
- Added 8 comprehensive interview questions with detailed prep notes
- Included likely interviewer assignments (Nikki Diman, Brian Mauch, Jolly Jayaprakash)
- Enhanced technical questions with specific BigQuery/Google Play context
- Added follow-up question preparation and confidence levels

**Questions Added:**
1. How would you design a data mart for Google Play Points tier progression analytics?
2. Walk me through investigating a sudden spike in Play Points churn rate
3. How would you optimize a slow BigQuery query processing billions of Play Store transactions?
4. Google Play Points has stagnant Gold-to-Platinum progression. How would you diagnose and fix this?
5. How would you support the upcoming AI/ML integration for Play Points personalization?
6. We need real-time dashboards for 200+ stakeholders. How would you approach this?
7. Describe managing conflicting priorities between Product and Marketing teams
8. How do you handle ambiguous requirements from stakeholders?

#### ✅ Enhanced STAR Stories (From Strategic Synthesis PDF)
**Source:** `input_files/Google - Strategic Synthesis + STAR + Experience Mapping.pdf`
- Added 7 comprehensive STAR narratives with verified business metrics
- Included Google Play application context for each story
- Added question-to-story matching for optimal preparation

**Stories Added:**
1. **Driving Revenue with Customer Segmentation** - 12% retention improvement, 20% inventory waste reduction
2. **Automating a High-Volume Data Pipeline** - 10+ hours weekly saved, 25% decision efficiency increase  
3. **Optimizing Supply Chain with BigQuery** - 80% manual effort reduction, 25% mis-ship reduction
4. **Enhancing Reporting with a Star Schema Warehouse** - 40% reporting latency reduction
5. **Streamlining Operations with Lean Six Sigma** - 30% project turnover improvement, 15% profit increase
6. **Driving Dashboard Adoption Among Senior Leaders** - 30% adoption increase
7. **Building a CRM from the Ground Up** - 30% order processing time reduction

#### ✅ Enhanced Panelist Intelligence
**Source:** `input_files/google_play_interview_qa.md`
- Updated all 3 panelist profiles with detailed backgrounds
- Added specific hot buttons and response style recommendations
- Included interviewer-specific question preparation

**Panelists Enhanced:**
1. **Nikki Diman** - Service Delivery Manager (Primary)
2. **Brian Mauch** - Associate Director of Recruiting (Optional)  
3. **Jolly Jayaprakash** - Recruiter (Process Coordinator)

### Issues Encountered & Resolved

#### ❌ CORS Security Restrictions
- **Problem:** Browser security prevented local file access via fetch()
- **Solution:** Embedded all content directly in HTML instead of fetching files
- **Impact:** "Load Sample Data" now works on Vercel without server dependencies

#### ❌ Missing Jolly Jayaprakash Panelist
- **Problem:** Document extraction only finding 2 panelists instead of 3
- **Solution:** Added fallback logic ensuring all 3 panelists always present
- **Impact:** Complete panelist coverage restored

#### ❌ Broken JavaScript Code
- **Problem:** Orphaned code between functions causing page load failure
- **Solution:** Removed broken code fragments using sed commands
- **Impact:** Dashboard loads properly again instead of being stuck on "Loading..."

### Technical Implementation

#### Embedded Data Structure
```javascript
// Questions with enhanced metadata
const embeddedQuestions = [
    {
        question: 'How would you design a data mart for Google Play Points...',
        category: 'Technical',
        difficulty: 'Hard',
        prepNotes: 'Create star schema with member_fact at center...',
        starLink: 'Home Depot BigQuery Pipeline...',
        followUps: 'Partitioning strategy, materialized views...',
        confidence: 95,
        fromCSV: true,
        likelyAsker: 'Nikki Diman'
    }
];

// Stories with comprehensive STAR format
const embeddedStories = [
    {
        title: 'Driving Revenue with Customer Segmentation',
        situation: 'At Trulieve, a multi-state cannabis operator...',
        task: 'Leverage transactional data to create personas...',
        action: 'Used Python and K-Means clustering...',
        result: '12% quarterly improvement in retention...',
        businessImpact: '12% quarterly improvement + 20% waste reduction',
        tags: ['ML', 'Customer Segmentation', 'Python', 'K-Means'],
        googlePlayApplication: 'Directly applicable to Play Points...',
        questionMatch: ['Tell me about KPI ownership', 'Design data mart'],
        fromDocuments: true
    }
];
```

### Files Modified
- `index.html` - Main dashboard file with embedded content
- `vercel.json` - New deployment configuration
- `serve.py` - Local development server (created but not needed for Vercel)

### Deployment Ready
- ✅ No CORS dependencies
- ✅ All content embedded
- ✅ Vercel configuration complete  
- ✅ Manual file upload still works
- ✅ 8 questions + 7 STAR stories + 3 panelists loaded via "Load Sample Data"

### Next Steps for User
1. Commit files to GitHub repository
2. Connect repository to Vercel
3. Deploy automatically - no additional configuration needed
4. Dashboard will work immediately with full Q&A and STAR content
