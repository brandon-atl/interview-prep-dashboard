# Google Play BI/Data Analyst Interview Q&A Preparation Guide
**Interview Date:** Tuesday, September 2, 2025 | 12:30 PM EDT  
**Panelists:** Nikki Diman (Primary), Brian Mauch (Optional), Jolly Jayaprakash (Recruiter)

---

## 🎯 INTERVIEWER-SPECIFIC CALIBRATION

### **NIKKI DIMAN - Service Delivery Manager**
**Hot Buttons:** Creative problem-solving with minimal data, cross-functional stakeholder management, extracting insights from vast datasets, thought process over perfect solutions  
**Background:** 19+ years global recruiting, President's Circle Winner 2018-2022, Program Manager at Google via Scalence LLC  
**Likely Questions:** Scenario-based problems, stakeholder conflict resolution, data quality challenges  
**Response Style Needed:** Business-first narratives, emphasize collaboration, show creative approaches

### **BRIAN MAUCH - Associate Director of Recruiting (Optional)**
**Hot Buttons:** Technical validation, cultural fit, scalability experience  
**Background:** Associate Director at Scalence LLC, limited public information  
**Likely Questions:** Technical depth validation, team collaboration scenarios  
**Response Style Needed:** Balance technical detail with business impact

### **JOLLY JAYAPRAKASH - Recruiter**
**Hot Buttons:** Immediate availability, flexibility for Pacific hours, SQL expertise validation  
**Background:** 10+ years with current company, supports Google and Apple clients  
**Response Style Needed:** Direct, enthusiastic, emphasize availability and technical readiness

---

## 📊 CATEGORY 1: ROLE-SPECIFIC TECHNICAL QUESTIONS

### Q1: "How would you design a data mart for Google Play Points tier progression analytics?"
*Likely Asker: Nikki Diman*

**30-Second Core:**
"I'd create a star schema with member_fact at the center, dimension tables for tiers, time, geography, and redemption types. Using BigQuery's partitioning by date and clustering by member_id and tier_level for optimal query performance."

**60-Second Standard (with STAR):**
"At Trulieve, I designed a star-schema warehouse processing 100M+ daily records. For Play Points, I'd create:
- Fact table: member_transactions with points earned/redeemed
- Dimensions: tier_hierarchy, reward_catalog, member_demographics
- Aggregated views for tier progression velocity
This reduced query time from 10 minutes to 30 seconds at Home Depot using similar BigQuery optimization."

**90-Second Deep Dive:**
```sql
-- Core architecture for 220M+ members
CREATE TABLE play_points_fact
PARTITION BY DATE(transaction_date)
CLUSTER BY member_id, tier_level AS
SELECT 
  member_id,
  transaction_date,
  points_earned,
  points_redeemed,
  tier_level,
  -- Window functions for progression tracking
  SUM(points_earned) OVER (PARTITION BY member_id 
    ORDER BY transaction_date 
    ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) as cumulative_points,
  LAG(tier_level) OVER (PARTITION BY member_id ORDER BY transaction_date) as previous_tier
FROM raw_transactions;
```

### Q2: "Walk me through investigating a sudden spike in Play Points churn rate"
*Likely Asker: Nikki Diman*

**30-Second Core:**
"I'd segment by tier level, cohort, geography, and redemption patterns using BigQuery CTEs. Compare pre/post spike behaviors, check for system changes, app updates, or competitive actions."

**60-Second Standard:**
"Similar to my Trulieve customer retention analysis that improved metrics by 12%, I'd:
1. Create cohort analysis using window functions
2. Identify concentrated segments (specific tiers, regions)
3. Examine external factors (policy changes, technical issues)
4. Build predictive model for at-risk members
This systematic approach helped recover $3.2M in annual revenue at Trulieve."

**90-Second Deep Dive:**
"Drawing from processing 500M+ SKU records at Home Depot, I'd build:
```sql
WITH churn_analysis AS (
  SELECT 
    tier_level,
    DATE_DIFF(CURRENT_DATE(), last_activity, DAY) as days_inactive,
    points_velocity_30d / NULLIF(points_velocity_90d, 0) as velocity_decline,
    COUNT(*) as member_count,
    AVG(lifetime_value) as avg_ltv_at_risk
  FROM member_activity
  WHERE DATE_DIFF(CURRENT_DATE(), last_activity, DAY) > 30
  GROUP BY tier_level, velocity_decline_bucket
)
```
Expected outcome: Identify root cause within 2 hours, implement targeted interventions within 48 hours."

### Q3: "How would you optimize a slow BigQuery query processing billions of Play Store transactions?"
*Likely Asker: Brian Mauch*

**30-Second Core:**
"Use EXPLAIN to identify bottlenecks, implement proper partitioning by date, clustering by frequently filtered columns, replace subqueries with CTEs, and leverage materialized views for repeated aggregations."

**60-Second Standard:**
"At Home Depot, I optimized queries from 10 minutes to 30 seconds by:
- Partitioning by transaction_date
- Clustering by member_id and tier_level  
- Converting nested subqueries to CTEs
- Creating materialized views for dashboard metrics
This 80% performance improvement saved 1,040 hours annually."

---

## 💼 CATEGORY 2: BUSINESS PRIORITY QUESTIONS

### Q4: "Google Play Points has stagnant Gold-to-Platinum progression. How would you diagnose and fix this?"
*Likely Asker: Nikki Diman*

**Current State:** Gold members (600-2,999 points) struggle to reach Platinum (3,000+ points) - a 5x jump creating engagement cliff

**Your Approach:**
"Based on my customer segmentation work improving retention 12% at Trulieve, I'd:
1. Analyze point-earning velocity by cohort
2. Identify members 70-80% toward Platinum threshold
3. Create targeted bonus events for high-potential segments
4. A/B test reduced thresholds or intermediate rewards"

**Expected Impact:** 
"15-20% increase in Platinum members within 6 months, driving $2-3M additional revenue through increased engagement"

### Q5: "How would you support the upcoming AI/ML integration for Play Points personalization?"
*Likely Asker: Brian Mauch*

**Your Response:**
"Drawing from my ML clustering experience at Trulieve that improved acquisition 12%, I'd:
1. Build feature store in BigQuery ML with member behavior signals
2. Create real-time data pipelines for model training
3. Implement A/B testing framework for personalized rewards
4. Establish feedback loops for model performance monitoring

At Trulieve, similar ML initiatives drove $3.2M annual revenue increase."

### Q6: "We need real-time dashboards for 200+ stakeholders. How would you approach this?"
*Likely Asker: Nikki Diman*

**Your Approach:**
"From training 50+ users at Home Depot and achieving 30% adoption increase:
1. Segment stakeholders by needs (executives, analysts, operations)
2. Build role-based dashboards with appropriate granularity
3. Implement caching strategies using BigQuery materialized views
4. Create self-service templates in Looker/PLX
5. Conduct targeted training sessions by stakeholder group"

---

## 🤝 CATEGORY 3: CULTURAL FIT QUESTIONS

### Q7: "Describe managing conflicting priorities between Product and Marketing teams"
*Likely Asker: Nikki Diman*

**STAR Response:**
**Situation:** At Home Depot, supply chain and finance defined 'inventory turnover' differently
**Task:** Align both teams on unified metrics for Tableau dashboards
**Action:** Facilitated workshops, documented calculations, proposed primary metric with team-specific drill-downs
**Result:** Achieved consensus in 2 weeks, 30% adoption increase due to trust in data
**Google Application:** "This experience directly applies to aligning Product, Engineering, and Marketing on Play Points KPIs"

### Q8: "How do you handle ambiguous requirements from stakeholders?"
*Likely Asker: Nikki Diman*

**Response:**
"At Trulieve, executives often requested 'customer insights' without specifics. I'd:
1. Schedule 15-minute discovery sessions
2. Present 3 potential approaches with effort/impact matrix
3. Deliver MVP in 48 hours for feedback
4. Iterate based on actual usage
This approach led to 25% faster decision-making and prevented scope creep."

---

## 🎤 STRATEGIC QUESTIONS BANK

### For Nikki Diman:
1. **"With Play Points serving 220M+ members globally, how does your team balance standardized global metrics with local market insights?"**
   - References her global team experience
   - Shows understanding of scale challenges

2. **"Given the upcoming ML expansion in 6-12 months, what specific AI initiatives are planned for Play Points personalization?"**
   - Demonstrates forward-thinking
   - Aligns with your ML experience

3. **"With your extensive stakeholder management experience, what strategies work best when Product, Engineering, and Marketing have conflicting priorities?"**
   - Acknowledges her expertise
   - Gathers practical insights

### For Brian Mauch:
1. **"How does the team approach balancing technical debt with rapid feature development in the Play Store ecosystem?"**
   - Shows understanding of engineering trade-offs
   - Relevant to data pipeline maintenance

2. **"What role do contractors typically play in driving strategic initiatives versus maintenance work?"**
   - Clarifies growth opportunities
   - Shows ambition

### For Jolly Jayaprakash:
1. **"You mentioned potential for conversion to FTE - what typically drives those decisions?"**
   - Shows long-term interest
   - Practical career planning

2. **"With your 10 years supporting Google, what makes successful contractors stand out?"**
   - Leverages his experience
   - Gets insider tips

---

## 🔧 RECOVERY PROTOCOLS

### Gap: Limited PLX/Google Sheets BI Experience
**Acknowledgment:** "While my primary experience is with Power BI and Tableau..."
**Bridge:** "The core competency of translating complex data into executive insights remains constant. At Trulieve, I presented to C-suite weekly."
**Value Add:** "I'll leverage my 8+ years SQL expertise while completing Google's Advanced Data Analytics Certificate in my first 30 days."

### Gap: Unfamiliar Play Points Metric
**Response:** "While I don't have the exact figure, I understand Play Points has 220M+ members with 5 tier levels. Based on my loyalty program experience improving retention 12%, I'd first establish baseline metrics through cohort analysis. Could you share the current target?"

### Technical Question Stumps You
**Response:** "Let me think through this systematically. In my experience with similar challenges at [Company], I'd approach this by [methodology]. What specific constraints should I consider for Google's scale?"

---

## ⚡ RAPID-FIRE PREPARATION

### Common Technical Quickfires:
- **"CTEs vs Subqueries?"** → "CTEs for readability and reusability, subqueries for simple one-time filters"
- **"Window functions use case?"** → "Calculating running totals for Play Points progression, ranking members within tiers"
- **"BigQuery best practice?"** → "Partition by date, cluster by high-cardinality filters, use APPROX functions for estimates"

### Business Quickfires:
- **"Why Google?"** → "Scale of 3B+ users, cutting-edge data challenges, opportunity to impact millions through Play Points optimization"
- **"Why contractor?"** → "Immediate value delivery while proving fit for potential FTE conversion"
- **"5-year goal?"** → "Lead data science initiatives for Google Play's loyalty programs, driving AI/ML adoption"

---

## 📝 CRITICAL REMINDERS

### Technical Preparation:
- Review BigQuery syntax for CTEs, window functions, MERGE statements
- Practice explaining tier progression logic (Bronze→Silver→Gold→Platinum→Diamond)
- Understand partitioning/clustering for billion-row datasets

### Business Context:
- Play Points: 220M+ members, 5 tiers, point earning/redemption optimization
- Current challenges: Gold-to-Platinum progression, member churn, redemption rates
- Upcoming: AI/ML integration, real-time personalization

### Your Power Stats:
- 500M+ SKU records (Home Depot)
- 100M+ daily processing (Trulieve)
- 12% retention improvement ($3.2M impact)
- 80% query optimization
- 50+ stakeholder training sessions

### Interview Day Checklist:
- [ ] Test video/audio 30 min before
- [ ] Have water and this guide ready
- [ ] Join 3 minutes early
- [ ] Lead with business impact
- [ ] Ask clarifying questions
- [ ] Reference specific scale (220M members)
- [ ] Close with enthusiasm for role

---

## 🎯 CLOSING STATEMENT

"I'm excited about applying my 8+ years of SQL expertise and experience with 500M+ record datasets to optimize Play Points for 220+ million members. My track record includes 12% customer retention improvements and building automated pipelines processing 100M+ daily records. I'm particularly interested in the upcoming AI/ML integration and leveraging BigQuery ML to predict member behavior. What aspect of the Play Points analytics roadmap excites you most?"