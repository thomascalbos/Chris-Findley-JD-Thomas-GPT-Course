# CineMatch

Product requirements and style guide | Version 0.4 | November 2, 2026

**Help a tired viewer find one movie worth watching, without turning movie night into another browsing session.** CineMatch combines saved taste with a short quiz, explains its pick, and links out to a streaming service.

## What this version covers

Version 0.4 is the build plan for the real CineMatch. It has 16 stories, grouped into six sprints in dependency order: foundations first, features after. Anything not needed by those stories has been cut. The style guide is unchanged.

| Part | Contents |
| --- | --- |
| 1. Product | What viewers can do, and the rules each feature follows |
| 2. Technical foundation | Hosting, movie data, login, matching, and success metrics |
| 3. Roadmap and stories | The roadmap tracker, the story and pull request format, and the 16 stories by sprint |
| 4. Style guide | Colors, type, layout, and voice |

---

# Part 1: Product

## Audience

One person choosing a movie for themselves after a long day. Occasions like date night can shape the pick, but one person answers the questions. The region is the United States.

## Access

- **Logged-out visitors can open only the Tutorial tab and the login page.** Every other page sends them to login.
- **Login is by emailed code.** There are no passwords (CM-03).
- **The site is non-commercial** and runs on free services (Part 2).

## Navigation

| Where | Contents |
| --- | --- |
| Main tabs (bottom bar on phones, header on desktop) | Home, Random, Alerts, Tutorial |
| Account menu | History, Settings, Delete account, Log out |
| Logged out | Tutorial and Log in only |

Home leads with **Find tonight's movie**.

## Tutorial

A guided walkthrough with sample movies, open to anyone (CM-05). It shows the quiz, a pick with its explanation, and "Not this one". Every sample movie is labeled as a sample. It ends with **Get started**, which goes to login. Trying to save anything inside the tutorial explains that it needs an account.

## Account setup

After first login, an optional two-step setup (CM-07):

1. **Streaming services:** any of Netflix, Amazon Prime Video, Paramount+, Disney+, Hulu, Apple TV, HBO Max, and Tubi. Tubi is free with ads.
2. **Favorites:** up to five all-time favorite movies, found with movie search (CM-06). No ranking, and no need to fill all five.

Either step can be skipped. Both can be changed later in Settings (CM-13).

## The quiz

One question per screen, tap-based, with visible progress (CM-09).

| Core question | Choices |
| --- | --- |
| 1 / Occasion | Solo unwind, date night, background watch, movie night, or surprise me |
| 2 / Genre | Up to three of: comedy, drama, action, adventure, thriller, mystery, horror, romance, sci-fi, fantasy, animation, documentary. Or Anything. |
| 3 / Available time | Under 90 minutes, under 2 hours, under 2½ hours, or any length |

Then up to four follow-ups, chosen by these rules and asked in this order:

| Follow-up | Choices | Ask when |
| --- | --- | --- |
| Mood | Light and funny, comforting, emotional, suspenseful, or serious and thought-provoking | Genre is Anything, more than one genre is picked, or the occasion is Surprise me |
| Attention | Background-friendly, easy to follow, or fully absorbing | The occasion isn't Background watch |
| Content rating | G, PG, PG-13, R (multiple allowed), or no preference | Date night, movie night, Anything, or horror or thriller picked |
| Release era | Recent (last 2 years), last 10 years, older (more than 10 years), or any era | Genre is Anything, or the occasion is Surprise me or movie night |
| Audience score | No minimum, 3+, 3.5+, or 4+ stars | The viewer has no saved favorites or ratings |

Rules:

- Never more than seven questions in total.
- Progress shows the three core steps, then "Optional refinement 1 of N".
- Any specific answer can be marked **Must have**; unmarked answers can flex.
- The viewer's services appear on every question with their own Must-have toggle, plus an **Include rewatches** toggle. Watched movies are skipped by default.
- Back keeps earlier answers. There's no free text.

## The pick

One movie at a time (CM-10). It shows:

- poster, title, year, runtime, US rating, audience score out of 5, and synopsis
- **Why this one:** a concrete explanation tied to the viewer's answers and favorites, never generic praise
- where to watch, with subscription, free-with-ads, and rental options labeled, plus when availability was last checked
- **Watch:** opens the streaming service's website in a new tab
- **Not this one:** asks why (seen it, wrong mood, dislike the genre, too intense, or something else), keeps every answer, and finds a different movie. "Seen it" marks the movie watched. A rejected movie never comes back in the same session.

**Must haves are never bent silently.** If nothing meets every Must have, the viewer is told what the closest movie would miss, without its title, and sees it only if they agree. Otherwise they go back to change a preference.

## Random

One movie with no questions (CM-11), drawn from the viewer's services and favorites. Watched movies are skipped unless Include rewatches is on. Offers **Another random pick**. Without setup, it picks well-rated, widely available movies and says setup would make it personal.

## History and ratings

Past picks, newest first, with what happened to each: shown, rejected and why, or Watch clicked (CM-12). Viewers can mark movies watched and rate them 1 to 5 stars. Personal ratings are always shown separately from audience scores.

## Alerts

Track a specific movie and hear when it becomes **included with one of the viewer's paid subscriptions** (CM-15):

- Alerts are created from Alerts-page search or from a movie's details.
- Delivery: email, in-app, or both.
- Rentals and Tubi don't trigger alerts.
- With no paid services saved, the viewer is told an alert needs one.
- States: **Waiting** (shows the services being watched) and **Triggered** (shows which service now has it, when, and a Watch button).

## Settings and deleting an account

- **Settings** edits services and favorites (CM-13).
- **Delete account** removes the account and everything saved with it, after a typed confirmation (CM-08).

---

# Part 2: Technical foundation

## Stack

Everything runs on free tiers, which the non-commercial terms allow.

| Need | Choice | Status |
| --- | --- | --- |
| Hosting | Vercel (free Hobby plan) | **Already live** |
| Database and login | Supabase (free plan): Postgres, emailed-code login, and pgvector for similarity search | CM-01, CM-03 |
| Movie data | TMDB API, free for non-commercial use | CM-02 |
| Login and alert emails | Resend (free tier) | CM-03, CM-15 |
| Scheduled jobs | GitHub Actions (free for public repositories) | CM-04, CM-14 |
| Data science | Python with scikit-learn, run in GitHub Actions or on a team computer | CM-14, CM-16 |

**Security minimum (built into CM-01 and CM-03):** each viewer can read and change only their own data, enforced by the database's row-level security. Secret keys live only in Vercel and GitHub settings, never in the code.

## Movie data

**Source:** TMDB, for movies, US ratings, keywords, audience scores, and US streaming availability. TMDB's availability data comes from JustWatch.

**Terms that must be followed** (confirm the current terms during CM-02):

- Show a notice that CineMatch uses the TMDB API but isn't endorsed or certified by TMDB, on an About page.
- Credit JustWatch for streaming availability.
- Free use is for non-commercial projects only.
- TMDB restricts AI and machine-learning use of its data. Confirm that the similarity model (CM-14) is allowed before building it.

**Catalog:** movies with at least 200 TMDB votes and a known US release, which is roughly 10,000 to 15,000 titles. The team keeps a local copy of the data.

**Audience score:** TMDB's 0-to-10 vote average shown as 0 to 5 stars. Movies with fewer than 200 votes show "Not enough ratings yet".

**Mood, attention, and intensity:** TMDB doesn't provide these, but the quiz needs them. CM-02 tags every movie using rules from its genres and keywords, and a person spot-checks a sample.

**Freshness:** availability refreshes nightly (CM-04), and every movie shows when it was last checked.

## Matching

Matching is built in three steps:

1. **Rules (CM-10).** Must haves filter the movies. Flexible answers, favorites, and services score them. Watched and rejected movies are excluded. This is the current demo's logic, running on real data.
2. **Similarity (CM-14).** Each movie gets a "fingerprint" built from its genres, keywords, synopsis, runtime, era, and mood tags. Similar movies are grouped into clusters with plain-language labels, such as "cozy adventure comedies". A viewer's favorites, high ratings, and accepted picks point to the clusters they like, which supplies candidates for the rules to rank.
3. **Statistics (CM-16).** Test whether similarity actually picks better movies than the rules alone. It's switched on only if it wins.

## Success metrics

These come from the history events saved by CM-10 and CM-12:

- **Time to choice:** from starting the quiz to clicking Watch. The charter's goal of under two minutes is a hypothesis to test, not a promise.
- **First-pick acceptance:** how often the first pick gets a Watch click.
- **Rejections per session,** and the reasons given.
- **Return visits** within 14 days.

---

# Part 3: Roadmap and stories

## Roadmap

Sprints run in dependency order: foundations first, features after. Stories in the same sprint can be built at the same time.

| Sprint | ID | Story | Type | Size | Assigned to | Last updated | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1: Data foundation | CM-01 | Database setup | Foundation | M | Chris | 2026-11-08 | In progress |
| 1: Data foundation | CM-02 | Movie data | Foundation | L | Unassigned | 2026-11-02 | Not started |
| 2: Access | CM-03 | Login | Foundation | M | Unassigned | 2026-11-02 | Not started |
| 2: Access | CM-04 | Nightly data refresh | Foundation | M | Unassigned | 2026-11-02 | Not started |
| 2: Access | CM-05 | Tutorial | Feature | M | Unassigned | 2026-11-02 | Not started |
| 3: Getting started | CM-06 | Movie search and details | Feature | M | Unassigned | 2026-11-02 | Not started |
| 3: Getting started | CM-07 | Account setup | Feature | M | Unassigned | 2026-11-02 | Not started |
| 3: Getting started | CM-08 | Delete account | Feature | S | jshannonuva | 2026-11-08 | Done |
| 4: The pick | CM-09 | The quiz | Feature | M | Unassigned | 2026-11-02 | Not started |
| 4: The pick | CM-10 | Recommendation and "Not this one" | Feature | L | Unassigned | 2026-11-02 | Not started |
| 4: The pick | CM-11 | Random pick | Feature | S | Unassigned | 2026-11-02 | Not started |
| 5: Remember and learn | CM-12 | History and ratings | Feature | M | Unassigned | 2026-11-02 | Not started |
| 5: Remember and learn | CM-13 | Settings | Feature | S | Unassigned | 2026-11-02 | Not started |
| 5: Remember and learn | CM-14 | Similarity model | Foundation | L | Unassigned | 2026-11-02 | Not started |
| 6: Alerts and proof | CM-15 | Alerts | Feature | L | Unassigned | 2026-11-02 | Not started |
| 6: Alerts and proof | CM-16 | Similarity testing statistics | Foundation | M | Unassigned | 2026-11-02 | Not started |

**Sizes:** S is about a day, M a few days, and L about a week.

**Status:**

| Status | Meaning |
| --- | --- |
| Not started | Nobody has claimed it |
| In progress | Claimed, with work on a branch |
| In review | Pull request open, waiting for a teammate's review |
| Done | Merged to `main`, with every scenario passing |
| Blocked | Can't continue; say why in the story |

### Keeping the tracker current

- **To claim a story,** put your name in **Assigned to**, set **Status** to In progress, and assign yourself the story's GitHub issue.
- **Whenever you change a story** (its scenarios, assignee, or status), set **Last updated** to that day's date in YYYY-MM-DD format. A new story's Last updated is the date it was created.
- **Change the roadmap row and the story's own tracking table together,** so they always match.

## Story and pull request format

These are the homework requirements every story and pull request follows.

### Writing a story

- **Keep it small:** one thing a user can do that they could not do before.
- **Story:** As a [persona], I want to [do something] so that I can [get some result].
- **Scenarios:** two to four Given-When-Then scenarios. At least one must be a case where things go wrong for the user.

### Building a story

1. Create a branch named `story/cm-XX-short-name` and build the story. AI tools can be used freely for the code.
2. Run every scenario by hand against your change. For each one, record what you did, what you expected, and what happened.
3. If a scenario fails, fix the code or fix the scenario, and say which.
4. Open a pull request from your own GitHub account. The template in `.github/pull_request_template.md` pre-fills these sections:
   - **Story:** As a [persona], I want to [do something] so that I can [get some result].
   - **Scenarios:** your Given-When-Then scenarios.
   - **What changed:** two or three plain sentences.
   - **What the AI got wrong, and how I caught it:** be specific.
   - **Scenario results:** pass or fail for each scenario, with a screenshot or a one-line note of what you saw.
   - **How to check it:** steps a reviewer can follow to run the same scenarios.
5. Request a review from a teammate.

## Sprint 1: Data foundation

### CM-01: Database setup

| Type | Size | Depends on | Assigned to | Last updated | Status |
| --- | --- | --- | --- | --- | --- |
| Foundation | M | Nothing | Chris | 2026-11-08 | In progress |

**Story:** As a CineMatch developer, I want to store movies and viewer data in a hosted database so that I can build features on real data in the live app.

**Scenarios:**

1. **Given** the Supabase project and tables exist, **when** the live Vercel app reads the movies table, **then** it gets rows back with no errors.
2. **Given** test accounts A and B each have a saved favorite, **when** account A asks the database for favorites, **then** only A's favorite comes back.
3. **Goes wrong:** **given** someone searches the GitHub repo and the app's page source for the database admin key, **when** they look, **then** it isn't there; only the public key appears.

### CM-02: Movie data

| Type | Size | Depends on | Assigned to | Last updated | Status |
| --- | --- | --- | --- | --- | --- |
| Foundation | L | CM-01 | Unassigned | 2026-11-02 | Not started |

**Story:** As a viewer, I want to see real movies and where they stream in the US so that I can get picks I can actually watch.

**Scenarios:**

1. **Given** the import has run, **when** I look up a well-known movie in the database, **then** it has its title, year, runtime, US rating, synopsis, poster, genres, audience score, and which of the eight services carry it (subscription, free, or rent).
2. **Given** the import has run, **when** I check any catalog movie, **then** it has a mood, attention level, and intensity tag, and a teammate's spot-check of 50 random movies finds at least 40 tagged sensibly.
3. **Given** the import has finished, **when** I open the About page, **then** it shows the TMDB notice and JustWatch credit, and the team's local copy holds the same movies.
4. **Goes wrong:** **given** the import stops halfway because of a TMDB error or rate limit, **when** it's run again, **then** it picks up where it stopped without creating duplicate movies.

## Sprint 2: Access

### CM-03: Login

| Type | Size | Depends on | Assigned to | Last updated | Status |
| --- | --- | --- | --- | --- | --- |
| Foundation | M | CM-01 | Unassigned | 2026-11-02 | Not started |

**Story:** As a viewer, I want to log in with a code emailed to me so that I can use CineMatch without creating a password.

**Scenarios:**

1. **Given** I'm logged out, **when** I enter my email and then the 6-digit code from the email, **then** I'm logged in and land on Home.
2. **Given** I logged in yesterday, **when** I return today on the same device, **then** I'm still logged in.
3. **Goes wrong:** **given** I requested a code, **when** I enter a wrong code or one more than 10 minutes old, **then** I see "That code didn't work" and stay logged out.
4. **Goes wrong:** **given** I'm logged out, **when** I go to any page other than Tutorial, such as `/alerts`, **then** I'm sent to the login page.

### CM-04: Nightly data refresh

| Type | Size | Depends on | Assigned to | Last updated | Status |
| --- | --- | --- | --- | --- | --- |
| Foundation | M | CM-02 | Unassigned | 2026-11-02 | Not started |

**Story:** As a viewer, I want to see up-to-date streaming availability so that I can trust Watch to send me to a service that still has the movie.

**Scenarios:**

1. **Given** a movie left Netflix since yesterday, **when** the nightly refresh runs, **then** the movie no longer shows Netflix, and the change is recorded with its date.
2. **Given** the refresh ran last night, **when** I view any movie, **then** I see "Availability checked" with last night's date.
3. **Goes wrong:** **given** last night's refresh failed, **when** the team checks GitHub Actions, **then** the run is marked failed with a notification, and tonight's run catches up.

### CM-05: Tutorial

| Type | Size | Depends on | Assigned to | Last updated | Status |
| --- | --- | --- | --- | --- | --- |
| Feature | M | CM-03, for the login hand-off | Unassigned | 2026-11-02 | Not started |

The tutorial reuses the current demo and its sample movies.

**Story:** As a first-time visitor, I want to try CineMatch with sample movies before logging in so that I can see how it works before giving my email.

**Scenarios:**

1. **Given** I'm logged out, **when** I open the Tutorial tab, **then** I can go through the quiz, see a pick with its explanation, and use "Not this one", all without logging in.
2. **Given** I'm in the tutorial, **when** I look at any movie, **then** it's clearly labeled as a sample, not real availability.
3. **Given** I finish the tutorial, **when** I choose Get started, **then** I go to the login page.
4. **Goes wrong:** **given** I'm in the tutorial, **when** I try to save a pick or create an alert, **then** I'm told that needs an account and offered login, and nothing is saved.

## Sprint 3: Getting started

### CM-06: Movie search and details

| Type | Size | Depends on | Assigned to | Last updated | Status |
| --- | --- | --- | --- | --- | --- |
| Feature | M | CM-02, CM-03 | Unassigned | 2026-11-02 | Not started |

**Story:** As a viewer, I want to search for a movie and open its details so that I can choose favorites and track movies.

**Scenarios:**

1. **Given** I'm logged in, **when** I type part of a title, **then** matching movies appear with their years within a second.
2. **Given** search results are showing, **when** I open one, **then** I see its poster, year, runtime, rating, audience score, synopsis, and where to watch.
3. **Goes wrong:** **given** I misspell a title by a letter, **when** I search, **then** the right movie still appears. Typing nonsense shows "No movies match".

### CM-07: Account setup

| Type | Size | Depends on | Assigned to | Last updated | Status |
| --- | --- | --- | --- | --- | --- |
| Feature | M | CM-03, CM-06 | Unassigned | 2026-11-02 | Not started |

**Story:** As a new viewer, I want to pick my streaming services and up to five favorite movies so that I can get picks that fit what I have and what I like.

**Scenarios:**

1. **Given** it's my first login, **when** I pick Netflix, HBO Max, and three favorites and finish, **then** I see a summary, and everything is still there after I log out and back in.
2. **Given** I've picked five favorites, **when** I try to add a sixth, **then** I can't, and I see "5 of 5 picked".
3. **Goes wrong:** **given** it's my first login, **when** I skip both steps, **then** I land on Home and can still take the quiz, and picks show every way to watch.

### CM-08: Delete account

| Type | Size | Depends on | Assigned to | Last updated | Status |
| --- | --- | --- | --- | --- | --- |
| Feature | S | CM-03 | jshannonuva | 2026-11-08 | Done |

**Story:** As a viewer who's leaving, I want to delete my account and everything saved with it so that I can be sure my data is gone.

**Scenarios:**

1. **Given** I'm logged in with favorites, history, and an alert, **when** I choose Delete account and confirm, **then** I'm logged out, and logging in again with the same email starts a brand-new, empty account.
2. **Goes wrong:** **given** I opened Delete account by mistake, **when** I choose Cancel, **then** nothing is deleted.
3. **Goes wrong:** **given** the confirmation asks me to type DELETE, **when** I type anything else, **then** the Delete button stays disabled.

## Sprint 4: The pick

### CM-09: The quiz

| Type | Size | Depends on | Assigned to | Last updated | Status |
| --- | --- | --- | --- | --- | --- |
| Feature | M | CM-02, CM-07 | Unassigned | 2026-11-02 | Not started |

**Story:** As a viewer, I want to answer a few quick questions about tonight so that I can get a pick that fits my mood and my time.

**Scenarios:**

1. **Given** I'm logged in, **when** I choose Solo unwind, Comedy and Adventure, and Under 2 hours, **then** I get at most four follow-ups and never more than seven questions in total.
2. **Given** I'm on the third question, **when** I go Back, **then** my earlier answers are still selected.
3. **Given** I picked a specific answer, **when** I turn on Must have, **then** it shows as on. For Anything, the toggle is disabled.
4. **Goes wrong:** **given** I haven't picked an answer, **when** I try to continue, **then** Next is disabled.

### CM-10: Recommendation and "Not this one"

| Type | Size | Depends on | Assigned to | Last updated | Status |
| --- | --- | --- | --- | --- | --- |
| Feature | L | CM-09 | Unassigned | 2026-11-02 | Not started |

**Story:** As a viewer, I want to get one movie with a clear reason, and a better one if I say no, so that I can stop browsing and start watching.

**Scenarios:**

1. **Given** I finished the quiz, **when** my pick appears, **then** it shows the movie's details, a "Why this one" that names my answers, and where to watch. Watch opens the service's website in a new tab.
2. **Given** I have a pick, **when** I choose Not this one and then Seen it, **then** a different movie appears with my answers kept, and the first movie is marked watched and never shown again that session.
3. **Given** I take the quiz twice with different answers (Horror, under 90 minutes, then Documentary, any length), **when** each pick appears, **then** the two picks are different movies.
4. **Goes wrong:** **given** no movie meets all my Must haves, **when** the pick would appear, **then** I'm told what the closest movie misses without seeing its title, and I see it only if I agree.

### CM-11: Random pick

| Type | Size | Depends on | Assigned to | Last updated | Status |
| --- | --- | --- | --- | --- | --- |
| Feature | S | CM-07 | Unassigned | 2026-11-02 | Not started |

**Story:** As a viewer too tired for questions, I want to get one random movie that fits my taste so that I can start watching right away.

**Scenarios:**

1. **Given** I saved services and favorites, **when** I open Random, **then** I get one movie available on my services, with Another random pick.
2. **Given** I've marked movies watched, **when** I get random picks, **then** watched movies are skipped unless Include rewatches is on.
3. **Goes wrong:** **given** I skipped setup, **when** I open Random, **then** I get a well-rated, widely available movie and a note that setup would make it personal.

## Sprint 5: Remember and learn

### CM-12: History and ratings

| Type | Size | Depends on | Assigned to | Last updated | Status |
| --- | --- | --- | --- | --- | --- |
| Feature | M | CM-10 | Unassigned | 2026-11-02 | Not started |

**Story:** As a viewer, I want to see my past picks, mark them watched, and rate them so that I can find last week's movie and teach CineMatch my taste.

**Scenarios:**

1. **Given** I got two picks yesterday, **when** I open History, **then** both appear, newest first, with what I did with each: shown, rejected and why, or Watch clicked.
2. **Given** I'm in History, **when** I rate a movie 4 stars, **then** my rating shows separately from the audience score and is still there after I log in again.
3. **Goes wrong:** **given** my account is brand new, **when** I open History, **then** I see "Nothing here yet" with a link to the quiz.

### CM-13: Settings

| Type | Size | Depends on | Assigned to | Last updated | Status |
| --- | --- | --- | --- | --- | --- |
| Feature | S | CM-07 | Unassigned | 2026-11-02 | Not started |

**Story:** As a viewer whose subscriptions changed, I want to edit my services and favorites so that I can keep my picks accurate.

**Scenarios:**

1. **Given** I saved Netflix and Hulu, **when** I turn off Hulu, turn on HBO Max, and save in Settings, **then** the next quiz shows Netflix and HBO Max as my services.
2. **Given** I have favorites, **when** I swap one for another and save, **then** the change is still there after I log in again.
3. **Goes wrong:** **given** I have a waiting alert, **when** I remove every paid service and save, **then** I'm warned that alerts need a paid service, and my alert is kept.

### CM-14: Similarity model

| Type | Size | Depends on | Assigned to | Last updated | Status |
| --- | --- | --- | --- | --- | --- |
| Foundation | L | CM-02 and confirmed TMDB terms | Unassigned | 2026-11-02 | Not started |

**Story:** As a viewer, I want to get picks similar to the movies I love so that I can enjoy my first pick more often.

**Scenarios:**

1. **Given** the catalog is loaded, **when** the model runs, **then** every movie has a fingerprint and belongs to a cluster with a plain-language label.
2. **Given** the model has run, **when** a teammate checks the five nearest movies for 10 well-known films, **then** they judge most of them similar: at least 7 of the 10 sets.
3. **Goes wrong:** **given** a movie has no keywords or synopsis, **when** the model runs, **then** that movie still gets a fingerprint from its genres, runtime, and year, and the run doesn't crash.

## Sprint 6: Alerts and proof

### CM-15: Alerts

| Type | Size | Depends on | Assigned to | Last updated | Status |
| --- | --- | --- | --- | --- | --- |
| Feature | L | CM-04, CM-06, CM-07 | Unassigned | 2026-11-02 | Not started |

**Story:** As a viewer, I want to track a movie and hear when it arrives on a service I pay for so that I can watch it as soon as it's included.

**Scenarios:**

1. **Given** I subscribe to Netflix, **when** I find a movie that isn't on Netflix and create an alert by email, **then** it shows as Waiting, with my paid services and delivery choice.
2. **Given** I have a waiting alert, **when** the nightly refresh records the movie joining Netflix as part of the subscription, **then** I get exactly one email and one in-app notice with a Watch button, and the alert shows Triggered.
3. **Goes wrong:** **given** I have a waiting alert, **when** the movie appears only as a rental or on Tubi, **then** no alert fires.
4. **Goes wrong:** **given** I have no paid services saved, **when** I try to create an alert, **then** I'm told an alert needs a paid subscription.

### CM-16: Similarity testing statistics

| Type | Size | Depends on | Assigned to | Last updated | Status |
| --- | --- | --- | --- | --- | --- |
| Foundation | M | CM-10, CM-12, CM-14 | Unassigned | 2026-11-02 | Not started |

**Story:** As a CineMatch team member, I want to measure whether similarity matching beats the plain rules so that I can switch it on only if it helps viewers.

Test data comes from viewers' favorites and personal ratings (CM-07, CM-12), plus test viewers the team builds by hand.

**Scenarios:**

1. **Given** test viewers with favorites and ratings, **when** we hide some of their 4- and 5-star movies and run both versions, **then** a report compares how often each version ranks a hidden movie in its top 10, plus how varied the picks are.
2. **Given** the similarity version ranks hidden movies higher without making picks less varied, **when** the team reviews the report, **then** similarity is switched on. Otherwise it stays off, and the report says why.
3. **Goes wrong:** **given** fewer than 20 test viewers, **when** the report runs, **then** it says the sample is too small to trust, instead of naming a winner.

---

# Part 4: Style guide

## Warm light with retro depth

Subtle 80s movie night, with creamsicle orange and a grounded five-color palette.

| Color and hex | Role |
| --- | --- |
| **Midnight teal** `#173F46` | Primary text, navigation, prominent buttons, and selected outlines. The principal brand anchor. |
| **Vintage plum** `#49334D` | Secondary headings, occasional feature panels, and movie-detail emphasis. |
| **Creamsicle orange** `#FFC49A` | Secondary accent for selected chips, warm highlights, and small ticket-like treatments. Pair with teal text. |
| **Warm ivory** `#FFF8EE` | Main screen and card background. Keep most surfaces light and calm. |
| **Muted brick red** `#B9574F` | Restrained decorative emphasis and notification accents. Pair notification color with a readable label or icon. |

### Color and readability

Use teal or plum for small text on ivory, and ivory text on teal or plum. Teal on creamsicle also gives strong contrast. Brick red and ivory are approximately **4.39:1**; avoid this pairing for small text or normal-size button labels. Keep primary actions teal with ivory labels. Red is an accent, not the main text color.

### Visual character

Use clean ivory screens, rounded shapes, and occasional retro ticket or VHS-label details. Reference the warmth and adventure of 80s movie night through typography and small graphic touches. Avoid prominent neon, distressed textures, heavy film grain, or recreating recognizable franchise branding. Real posters sit inside the same rounded card treatment.

*Suggested balance: ivory carries the screens, teal carries structure, creamsicle carries selection, plum adds depth, and brick red appears sparingly. Keep the same color meanings across setup, recommendations, and alerts.*

## Type and interaction

Bree Serif headings. DM Sans for body text, navigation, questions, and controls.

| Typography role | Specification |
| --- | --- |
| Brand and display | **Bree Serif Regular 400**. Use for CineMatch and selected page headings. Mobile display: 28-32 px; desktop: 36-40 px. |
| Section headings | Bree Serif Regular 400 at 22-24 px, or DM Sans Medium 500 for compact functional sections. |
| Body and questions | **DM Sans Regular 400**, 16 px body and 18-20 px main questions. Line spacing about 1.5 for paragraphs. |
| Buttons and navigation | DM Sans Medium 500, 14-16 px. Sentence case, brief wording, persistent labels. |
| Metadata | DM Sans Regular 400, 13-14 px. Keep runtime, rating, year, service, and data-source labels legible. |

### Layout and controls

Start with a single-column phone layout and a consistent spacing rhythm: 8, 16, 24, and 32 px. Corners: 12-16 px for cards, pill shapes for answers. Tap targets about 44 px or larger. Expand desktop layouts while preserving the quiz's one-question-at-a-time focus.

Use selected answer chips with creamsicle fill, teal text, and a visible check or outline. Give Must have a labeled toggle. Show selected, loading, empty, and error states in words as well as color. Keep keyboard focus visible and respect reduced-motion preferences.

### Voice

Write like a playful video-store clerk: friendly, concise, a little witty, and happy to make a choice. Keep jokes out of errors, availability limits, account messages, and important explanations. Explain each recommendation in concrete terms instead of giving generic praise.

| Moment | Example copy |
| --- | --- |
| Question | What kind of night is it? |
| Recommendation rationale | An easygoing adventure under two hours, with the playful energy you like. |
| Rejection follow-up | Not the one? What missed the mark? |
