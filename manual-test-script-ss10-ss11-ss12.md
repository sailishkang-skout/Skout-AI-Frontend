
# 📝 Manual Testing Script: SS-10, SS-11, SS-12

Follow these steps in order to verify all features work correctly in a browser.

---

## Prerequisites

- ✅ Local/staging environment running (frontend + backend)
- ✅ Logged into the application with a valid user account
- ✅ Have at least one test company in your CRM with:
  - Country field populated
  - Regional intelligence data available
- ✅ Have at least one test prospect with fitScore/timingScore populated
- ✅ Have test CRM flags (disengagement, renewal risk, expansion) in your database

---

## 🎯 Part 1: SS-11 - Prospect Search Score Split (20 mins)

**Navigation Path:** Dashboard → Prospects → Search

| Step  | Action                                                  | Expected Result                                                                                                                                 | Pass/Fail          |
| :---- | :------------------------------------------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------- | :----------------- |
| 1.1   | Navigate to `/prospects/search`                          | Page loads, list of prospects appears                                                                                                           | ☐ Pass ☐ Fail      |
| 1.2   | Locate any prospect with both scores populated           | Verify two score pills appear:      - "ICP Match" label above first pill    - "Signal Timing" label above second pill      - Labels are small, uppercase, gray                                                 | ☐ Pass ☐ Fail      |
| 1.3   | Verify score pill styling                                | Score pills have the same size/colors as legacy scores                                                                                          | ☐ Pass ☐ Fail      |
| 1.4   | Check responsive layout                                  | Resize browser to mobile (375px wide):      - Scores wrap correctly, no overflow    
  - Mobile "Filters" button is visible                                                | ☐ Pass ☐ Fail      |
| 1.5   | Click "Filters" button on mobile                         | Filter panel slides open, "Clear filters" appears                                                                                              | ☐ Pass ☐ Fail      |
| 1.6   | Locate a legacy prospect (single score)                  | Only one "Score" pill appears, no errors                                                                                                       | ☐ Pass ☐ Fail      |
| 1.7   | Locate an unscored prospect                              | "Score" button appears instead of pills                                                                                                        | ☐ Pass ☐ Fail      |
| 1.8   | Click on any prospect to open detail sheet               | Detail sheet loads, same split scores render there too                                                                                          | ☐ Pass ☐ Fail      |
| 1.9   | Close detail sheet                                       | Page returns to search list, no console errors                                                                                                | ☐ Pass ☐ Fail      |
| 1.10  | Check browser console                                    | No JavaScript errors, warnings, or network failures                                                                                             | ☐ Pass ☐ Fail      |

**SS-11 Overall:** ☐ All Pass ☐ Some Failures

---

## 🎯 Part 2: SS-10 - CRM Intelligence Flags (25 mins)

**Navigation Path:** Dashboard → CRM → Intelligence

| Step  | Action                                                  | Expected Result                                                                                                                                 | Pass/Fail          |
| :---- | :------------------------------------------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------- | :----------------- |
| 2.1   | Navigate to `/crm/intelligence`                          | Page loads, "Needs Attention" section appears                                                                                                   | ☐ Pass ☐ Fail      |
| 2.2   | Locate an **Expansion Opportunity** flag                 | - Green "Expansion opportunity" badge    
  - Sparkles icon next to badge    
  - Company name links to `/crm/companies/[id]`    
  - Shows what signal was detected + date                                             | ☐ Pass ☐ Fail      |
| 2.3   | Locate a **Disengagement Risk** flag                     | - Amber "At risk" badge    
  - AlertTriangle icon next to badge  
  - Shows days of inactivity + computed date                                          | ☐ Pass ☐ Fail      |
| 2.4   | Locate a **Renewal Risk** flag                           | - Red "Critical risk" badge  <br>  - X icon next to badge  
  - Shows days until contract expiry + computed date                                  | ☐ Pass ☐ Fail      |
| 2.5   | Click the panel chevron to collapse any flag             | Panel content collapses, chevron rotates                                                                                                      | ☐ Pass ☐ Fail      |
| 2.6   | Click the company link on any flag                       | Navigates to the correct company 360 page                                                                                                     | ☐ Pass ☐ Fail      |
| 2.7   | Use back button to return to intelligence page           | Page loads correctly, state maintained                                                                                                       | ☐ Pass ☐ Fail      |
| 2.8   | Resize browser to mobile width                           | All flag cards stack properly, no overflow                                                                                                    | ☐ Pass ☐ Fail      |
| 2.9   | Verify NextBestActionCard loads on all flags            | Each flag has the next best action card below it                                                                                              | ☐ Pass ☐ Fail      |
| 2.10  | Check total counter at the top of "Needs Attention"      | Number matches total flags across all sections                                                                                                | ☐ Pass ☐ Fail      |
| 2.11  | Check browser console                                    | No JavaScript errors, all API calls succeed                                                                                                  | ☐ Pass ☐ Fail      |

**SS-10 Overall:** ☐ All Pass ☐ Some Failures

---

## 🎯 Part 3: SS-12 - Account 360 Regional Intelligence (25 mins)

**Navigation Path:** Dashboard → CRM → Companies → Select any company with country/regional data

| Step  | Action                                                  | Expected Result                                                                                                                                 | Pass/Fail          |
| :---- | :------------------------------------------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------- | :----------------- |
| 3.1   | Navigate to `/crm/companies/[valid-id]`                  | Account 360 page loads                                                                                                                        | ☐ Pass ☐ Fail      |
| 3.2   | Locate the **Regional Intelligence** section            | Header says "Regional Intelligence for [Country]":  
  - Insights count badge appears next to header                                          | ☐ Pass ☐ Fail      |
| 3.3   | Verify grid layout on desktop                            | Two insights side-by-side (2-column grid)                                                                                                      | ☐ Pass ☐ Fail      |
| 3.4   | Check a **high-confidence insight** (≥70%)                | Badge is green, text says "X% confidence"                                                                                                     | ☐ Pass ☐ Fail      |
| 3.5   | Check a **low-confidence insight** (<70%)                 | Badge is amber, text says "X% confidence"                                                                                                      | ☐ Pass ☐ Fail      |
| 3.6   | Locate a **stale insight**                               | "⚠️ Stale" appears in amber text at the bottom                                                                                                | ☐ Pass ☐ Fail      |
| 3.7   | Verify all insights show:  
  - Source  
  - Effective date                   | Both pieces of metadata appear in small text                                                                                                  | ☐ Pass ☐ Fail      |
| 3.8   | Resize browser to mobile width                           | Grid collapses to 1-column (all insights stacked)                                                                                              | ☐ Pass ☐ Fail      |
| 3.9   | Click back to companies list                              | Page loads correctly, no errors                                                                                                               | ☐ Pass ☐ Fail      |
| 3.10  | Open a person record (not account)                       | Regional Intelligence section does NOT render                                                                                                  | ☐ Pass ☐ Fail      |
| 3.11  | Open an account with no regional data                    | Section is completely hidden, no empty state                                                                                                  | ☐ Pass ☐ Fail      |
| 3.12  | Check browser console                                    | No JavaScript errors, all API calls succeed                                                                                                    | ☐ Pass ☐ Fail      |

**SS-12 Overall:** ☐ All Pass ☐ Some Failures

---

## 🎯 Part 4: Cross-Feature Integration (10 mins)

| Step  | Action                                                  | Expected Result                                                                                                                                 | Pass/Fail          |
| :---- | :------------------------------------------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------- | :----------------- |
| 4.1   | From prospect search, navigate to CRM intelligence       | Maintains session, no login required                                                                                                          | ☐ Pass ☐ Fail      |
| 4.2   | From CRM intelligence, navigate to a company 360 page    | Session maintained, loads correctly                                                                                                           | ☐ Pass ☐ Fail      |
| 4.3   | Navigate back to prospect search from company page       | Session maintained, loads correctly                                                                                                           | ☐ Pass ☐ Fail      |
| 4.4   | Refresh each page once                               | All pages reload, data fetches correctly                                                                                                      | ☐ Pass ☐ Fail      |
| 4.5   | Log out then log back in                             | All pages still accessible, authentication works                                                                                              | ☐ Pass ☐ Fail      |

**Integration Overall:** ☐ All Pass ☐ Some Failures

---