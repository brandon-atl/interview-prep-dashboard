# Deep Read — File Descriptions & Extraction Hooks (No Counts)

---

## 1) `google_intelligence_metrics.csv` (CSV)
**What it is:** A compact sheet of interview‑relevant facts and intelligence signals (role/company context, performance indicators, dates).  
**Good for:** Quick fact chips and recency/confidence badges.  
**Extractable inputs:** Columns `Metric/Data Point`, `Value`, `Change/Growth`, `Source_Date`, `Confidence`. Parse `Source_Date` → ISO; display `Change/Growth` as deltas.

## 2) `google_interview_key_metrics.csv` (CSV)
**What it is:** A key‑facts table spanning interview logistics (timing, panel identifiers), compensation snippets, and anchor metrics to cite.  
**Good for:** “Interview at a glance” cards and a consolidated facts drawer.  
**Extractable inputs:** Columns `Category`, `Value`, `Source`, `Confidence`, `Date`. Group by `Category` to render sections; show `Source` on hover.

## 3) `anticipated_questions_google_play_bi.csv` (CSV)
**What it is:** A curated list of anticipated interview prompts with prep notes tailored to the role.  
**Good for:** Practice queue and answer scaffolding.  
**Extractable inputs:** Columns `Question`, `My Prep Notes (test, STAR link, follow-ups)`. Split the notes field into tags/links where present.

## 4) `Strategic Intelligence Analysis - Google Play BI Role.md` (Markdown)
**What it is:** A strategic briefing that goes well beyond metrics:
- **Interviewer dossiers** (e.g., Nikki Diman context and calibration)  
- **Company strategic intelligence** (business performance, initiatives, challenges, leadership signals)  
- **Technology & innovation** (stack alignment—BigQuery/PLX/Looker; AI/ML notes; security/compliance; skills mapping)  
- **Culture/workplace** (satisfaction, shifts, team dynamics; fit analysis)  
- **Competitive/market** (Play Store position and pressures)  
**Good for:** 90‑second intro generator, interviewer‑aware framing, risk/opportunity chips.  
**Extractable inputs:** Split on markdown headers like `SECTION 1: INTERVIEWER INTELLIGENCE`, `SECTION 2: COMPANY STRATEGIC INTELLIGENCE`, etc.; mine bullet lists for entities (people, tools, programs). Use simple regex for emails/brands if present.

## 5) `Strategic Intelligence Analysis Google Play BI.md` (Markdown)
**What it is:** A second strategic brief with similar depth, structured around:
- **Executive brief of top insights**  
- **Interviewer intelligence** (primary/secondary roles)  
- **Company strategy** (initiatives, opportunities/risks)  
- **Technology ecosystem**  
- **Culture & workplace**  
- **Compensation intelligence**  
- **Red flags & concerns**  
- **Personalized recommendations** and **interview prep strategy**, plus a **“questions to ask”** section.  
**Good for:** Side‑by‑side cards (strategy, risks, questions‑to‑ask), interviewer‑aware guidance.  
**Extractable inputs:** Headers beginning with `**SECTION` and bold subheads; harvest bullets under “Interview Preparation Strategy” and “Strategic Questions to Ask.”

## 6) `Likely Project - Google Play Points Loyalty Program Analytics .md` (Markdown)
**What it is:** A deep‑dive project brief on **Google Play Points** (tiers, accrual/redemption, progression, churn). Includes SQL‑style snippets and KPI definitions for modeling and experimentation.  
**Good for:** A dedicated **Play Points** tab (tier logic, KPIs, hypotheses, experiments) and the **SQL practice** module.  
**Extractable inputs:** Fenced code blocks (```sql ... ```), KPI/bullet lists (e.g., churn, tier progression, redemption velocity), experiment outlines (A/B and diagnostics), and suggested features for modeling. Parse code blocks as schemas/queries.

## 7) `Google Q&A Bank.md` (Markdown)
**What it is:** A role‑specific Q&A bank organized by category with interviewer calibration at the top. The technical set leans into BigQuery/scale, the business set into loyalty metrics/priority problems, and there’s culture/stakeholder material as well.  
**Good for:** Auto‑tailored question carousel and mock prompts with likely follow‑ups.  
**Extractable inputs:** Question headers formatted as `### Q…:`; nearby paragraphs often include context and follow‑ups. Also pull any “Hot Buttons”/calibration notes for each interviewer.

## 8) `JD - Google - Data Analyst.md` (Markdown)
**What it is:** The JD with essentials (title, duration, location, pay), a **project summary** of the Play/Store context, and clear **Responsibilities**, **Scope/Deliverables**, and **Qualifications** sections. Interviewer contact lines are included.  
**Good for:** Job facts, responsibilities checklist, and qualification match scoring.  
**Extractable inputs:** Bold section labels (`**KEY RESPONSIBILITIES**`, `**SCOPE / DELIVERABLES**`, `**QUALIFICATIONS**`) followed by `-` bullets; email/role lines for the contacts card.

## 9) `Google - Strategic Synthesis + STAR + Experience Mapping.pdf` (PDF)
**What it is:** A consolidated document blending **strategic synthesis**, **STAR narratives**, and an **experience map** perspective for story flow.  
**Good for:** STAR gallery and a strategy storyboard that ties achievements to the role’s priorities.  
**Extractable inputs:** PDF text blocks that include the STAR structure (“Situation: … Task: … Action: … Result: …”). If figures are present, capture their captions/titles as chip text.

## 10) `Google - Interview Playbook.md` (Markdown)
**What it is:** A working playbook with **performance‑ready STAR narratives**, plus interviewer‑specific delivery notes and a priority storyline tailored to Google Play.  
**Good for:** One‑click 30/60/120‑second STAR cards and delivery cues aligned to each interviewer.  
**Extractable inputs:** Sections titled `STAR #…` containing S/T/A/R sub‑sections; any “delivery”/“calibration” notes under interviewer headers.

## 11) `Brandon Abbott Resume - Google Data Analyst.pdf` (PDF)
**What it is:** Your targeted resume: summary, skills, experience, certifications/education. Emphasizes SQL/BigQuery, large‑scale ETL/BI, and quantified outcomes aligned to the role.  
**Good for:** Profile chips (skills, tools), proof‑point snippets, and cross‑links into STARs.  
**Extractable inputs:** Keywords (skills/tools), quantified impact phrases, and project names. Regex hooks for percents, currency, and large‑scale indicators.

## 12) `08-28 Recruiter Screening Call Transcript - Google Play Data Analyst SQL Role.pdf` (PDF)
**What it is:** The written transcript of the recruiter screen covering the interview structure, expectations (SQL‑heavy, BigQuery/PLX), scheduling, and pay/logistics, along with names/roles of contacts.  
**Good for:** An accurate **interview timeline**, **what‑to‑expect** checklist, and a **contacts** drawer.  
**Extractable inputs:** Phrases describing rounds/order, time windows, rate mentions, availability expectations, and named entities (interviewer names/roles). Regex for currency, dates, and emails.

---

### Wiring guide (selection/regex cues)
- **Markdown sections:** `^#{1,6}\s+` → slice into cards; bold section labels (e.g., `**KEY RESPONSIBILITIES**`) anchor lists.  
- **Q&A blocks:** `^###\s*Q[^:]*:` → take following paragraphs until next header.  
- **STAR blocks:** Look for `Situation:`/`Task:`/`Action:`/`Result:` tokens (md or PDF text).  
- **Contacts:** emails `<...@...>`; proper names preceding roles ("Service Delivery Manager", etc.).  
- **Money/dates:** `\$[0-9][0-9,]*` and ISO‑like dates; normalize to YYYY‑MM‑DD.  
- **SQL/code:** fenced blocks ```sql … ``` for schemas/queries in the Play Points brief.

---


