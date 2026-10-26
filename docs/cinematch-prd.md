# CineMatch

Expanded product requirements and style guide | Version 0.2 | October 26, 2026

**Help a tired viewer find one movie worth watching, without turning movie night into another browsing session.** CineMatch combines saved taste with a short questionnaire, explains its pick, and links out to a streaming service.

## Purpose of this version

Define a mobile-first interactive demo that responds to viewer choices using a curated sample movie catalog. It will walk through a realistic example before any public launch. This document specifies the product and visual direction; implementation is a later step.

## Audience and value

The primary viewer is choosing a movie for themselves after a long day. Date night and other occasions can shape a recommendation, but multi-user accounts and shared matching are outside this demo. One person provides the answers.

## Experience at a glance

| Area | Intended experience |
| --- | --- |
| Home | Lead with **Find tonight's movie**. Offer Random, Trending, and Alerts below. |
| Setup | Optional account creation, services, Letterboxd sample import, and up to five favorite movies. |
| Find a movie | Three opening questions, up to four adaptive follow-ups, then one explained recommendation. |
| Explore | A personalized random pick, five trending movies across services, and availability alerts. |
| Remember | Account-based favorites and history; mark watched and rate movies from 1 to 5 stars. |

## Platform and boundaries

Design for phone screens first, with bottom navigation, then expand for desktop. Use the United States for the demo region. Accounts, imports, trending, scores, and availability use illustrative data; the Watch action opens the streaming service website in a new tab.

*Basis: CineMatch Final.docx product charter and confirmed product-owner decisions. Later answers supersede the early PRD (v0.1), including optional onboarding and removal of free-text questionnaire input.*

---

# Start with taste

All setup is optional. Viewers can skip it and try recommendations immediately.

## Account and guest behavior

Guests can explore the main questionnaire, random recommendations, and Trending. Ask for an account when they attempt to save favorites, recommendation history, or a movie alert. Preserve their current movie and questionnaire answers through that transition.

Account creation and sign-in use sample behavior. Production authentication and cross-device storage are later work.

## Optional onboarding sequence

| Step | Behavior |
| --- | --- |
| Streaming services | Select any subscribed services, with Tubi offered as a free service. Allow Skip. |
| Letterboxd import | Enter a username or profile link. Clearly identify this as a sample import; preview ratings, watched history, and watchlist before confirming. |
| Five favorites | Search and select **up to five** all-time favorites. No ranking or requirement to fill all five slots. Allow Skip. |
| Finish | Summarize selected services and taste inputs, then continue to Home or resume the guest's interrupted action. |

## Services included in the demo

**Netflix / Amazon Prime Video / Paramount+ / Disney+ / Hulu / Apple TV / HBO / Tubi**

Verify exact service names, links, plans, and catalog coverage during implementation. Tubi is free with ads and does not count as a paid subscription for alert triggers.

## How saved taste is used

Favorites and imported ratings help rank candidates and may gently broaden flexible preferences. Watchlist movies receive priority when they fit. Exclude known watched titles by default; offer an **Include rewatches** toggle. Release era and watched status are separate choices.

## After onboarding

Services, favorites, and imports are configured during onboarding only; editing is deferred. History still supports watched status and personal ratings. Choose notification delivery when creating an alert.

---

# Three questions to start

One question per screen. Tap-based choices, visible progress, and a short adaptive flow.

| Opening question | Choices and behavior |
| --- | --- |
| 1 / Occasion | Solo unwind, date night, background watch, movie night, or surprise me. Refine mood only when useful. |
| 2 / Genre | Select up to three genres, or choose Anything. Example set: comedy, drama, action, adventure, thriller, mystery, horror, romance, sci-fi, fantasy, animation, documentary. |
| 3 / Available time | Under 90 minutes, under 2 hours, under 2½ hours, or any length. |

## Adaptive follow-up pool

| Preference | Proposed choices to validate in the demo |
| --- | --- |
| Mood or intensity | Light and funny, comforting, emotional, suspenseful, or serious and thought-provoking. Use when occasion and genre leave uncertainty. |
| Content rating | Choose acceptable US content ratings, or no preference. An explicit content limit is distinct from an audience score. |
| Audience score | Optional minimum sample audience score on a 1-to-5-star scale. Include no minimum. |
| Release era | Recent releases, last 10 years, older favorites, or any era. Exact year boundaries remain to be defined. |
| Attention level | Background-friendly, easy to follow, or fully absorbing. |

## Flow rules

Ask **at most four** follow-ups from the pool, for a maximum of seven questions in the main flow. Do not ask every follow-up. Skip redundant questions and use saved context where it helps. The exact branching rules are a prototype design decision.

Viewers can mark individual preferences **Must have**; unmarked preferences may flex. Service selection should be visible as a session preference with the same strictness control. Keep previous answers when going back. No free-text request field or chat in this version.

*Suggested progress treatment: show the three core steps, then label any extra questions as optional refinements with a count. Do not promise a fixed total that unexpectedly grows.*

---

# One pick with a reason

Use the viewer's choices to filter and rank a curated sample catalog.

## Recommendation behavior

Apply preferences marked Must have first. Rank eligible movies using tonight's answers, favorites, imported ratings, and watchlist signals. Flexible preferences may broaden to improve the fit. Different choices should produce meaningfully different results, rather than a fixed scripted recommendation.

When services are selected, favor available titles on those services; a service requirement marked Must have is strict. If services were skipped, recommend any suitable movie and show streaming or rental options. Availability is illustrative sample data for the United States.

## Recommendation screen

| Content | Actions |
| --- | --- |
| Poster, title, release year, runtime, content rating, sample audience score out of five, and short synopsis. | **Watch** opens the streaming service website in a new tab. |
| A concise explanation connecting the movie to the viewer's occasion, preferences, and saved taste. | **Not this one** asks one follow-up before choosing a different title. |
| Available services, with subscription, free-with-ads, and rental options distinguished. | **Notify me** is available when tracking future paid-subscription availability is relevant. |

## If the pick misses

Ask why: **seen it, wrong mood, dislike the genre, too intense, or something else**. Keep this tap-based. Preserve previous answers, use the response to adjust the next pick, and avoid immediately repeating a rejected movie. The rejection question is separate from the seven-question initial flow.

## If no movie meets every requirement

Before revealing a movie, explain which requirement the closest candidate would miss and ask whether the viewer wants to see it. Reveal the title only after they agree. If they decline, allow them to adjust a preference; never silently treat a Must have as flexible.

## History and feedback

Signed-in viewers can revisit recommendation history, mark a movie watched, and rate it from 1 to 5 stars. Keep personal ratings visibly separate from sample audience scores. A Watch click records a handoff, not proof that the movie was played or completed.

---

# More ways to find a movie

Supporting pages keep the single-pick experience easy to reach.

## Random Recommendation

Skip tonight's questionnaire and choose one movie using saved taste and selected services. Retain the watched-movie default and Include rewatches control. If no profile inputs exist, use a broad sample pick and show where it can be watched. Offer another random pick and the normal movie details.

## Top 5 Trending

Show exactly five sample trending movies **across services**, including titles outside the viewer's subscriptions. Display availability and allow movie details and Notify me. Label the list as sample trending data; it is not a live popularity ranking or a personalized list.

## Alerts

Provide a dedicated movie search on the Alerts page, plus Notify me from movie details. An alert tracks a specific movie becoming **included with a selected paid subscription**. Rental availability and Tubi availability do not trigger this alert type.

On alert creation, let viewers choose **email, in-app notifications, or both**. Guests are asked to create an account while retaining the selected movie. If no paid subscriptions are selected, explain that one is needed to determine when an alert would apply.

| Example state | What the viewer sees |
| --- | --- |
| Waiting | The tracked movie, selected paid services, delivery choice, and a clear waiting status. |
| Available | The tracked movie, a sample notification that it is now included on a selected paid service, and a Watch action. |

Show waiting and available examples directly. Do not add a simulation button, time jump, or actual delivery. Account-based alert saving is demonstrated; no background availability monitor or email system is implied.

## Navigation

Home, Random, Trending, and Alerts are the primary destinations, with history accessible from Home or an account control. Use mobile bottom navigation with persistent text labels. Desktop may move these destinations to a header without changing their meaning.

> **Keep the demo honest:** make sample availability, scores, trends, imports, and notification states recognizable as illustrative. A real service link must not imply a verified movie-level playback link or current availability.

---

# A movie night example

A tired viewer sets up their taste, rejects one pick, and finds a better match.

| Beat | Example walkthrough |
| --- | --- |
| 1 / Set the foundation | A sample viewer signs in, chooses Netflix, Amazon Prime Video, and HBO, previews a Letterboxd sample import, and selects up to five favorites. |
| 2 / Describe tonight | Choose Solo unwind, Comedy and Adventure, and Under 2 hours. Mark runtime Must have. A follow-up asks for Easy to follow. |
| 3 / First recommendation | Show a matching sample title with its rationale and illustrative service availability. The viewer selects Not this one, then Seen it. |
| 4 / Better match | Keep the existing answers and exclude the rejected title. Show a different suitable movie. Watch opens its service website in a new tab. |
| 5 / Explore and return | Visit Random and Top 5 Trending; inspect waiting and available alerts. In history, demonstrate marking a movie watched and assigning a personal rating. |

## What must work in the future prototype

Skipping setup reaches recommendations. Guest saving requests an account without losing context. A Letterboxd preview requires confirmation. Question count stays within the cap. Choices affect results. Watched titles are excluded unless rewatches are enabled. A rejected pick leads to one follow-up and a different result. Any Must have mismatch requires agreement before revealing the closest match.

Trending shows five movies across services. Alerts support movie search and delivery choice, with waiting and available examples. Watch opens a service website in a new tab. History supports watched status and 1-to-5-star personal ratings. Layouts work on phone and desktop.

## What to learn

Observe whether a viewer understands the questions, trusts the explanation, and chooses a movie without excessive retries. Retain the charter's **under-two-minute time-to-choice** goal as a hypothesis to test, not a promised outcome. Record first-pick acceptance, rejection reasons, and feedback on the flow.

## Open decisions before production

Define the exact era boundaries, adaptive branching, audience-score source and thresholds, and real trending methodology. Verify service identities and links. Decide on movie and availability data providers, supported Letterboxd import method, production accounts and storage, and notification delivery. Live integrations, preference editing, group matching, voice, automatic playback, and a dedicated app are later work.

---

# Style guide: warm light with retro depth

Subtle 80s movie night, with creamsicle orange and a grounded five-color palette.

| Color and hex | Role |
| --- | --- |
| **Midnight teal** `#173F46` | Primary text, navigation, prominent buttons, and selected outlines. The principal brand anchor. |
| **Vintage plum** `#49334D` | Secondary headings, occasional feature panels, and movie-detail emphasis. |
| **Creamsicle orange** `#FFC49A` | Secondary accent for selected chips, warm highlights, and small ticket-like treatments. Pair with teal text. |
| **Warm ivory** `#FFF8EE` | Main screen and card background. Keep most surfaces light and calm. |
| **Muted brick red** `#B9574F` | Restrained decorative emphasis and notification accents. Pair notification color with a readable label or icon. |

## Color and readability

Use teal or plum for small text on ivory, and ivory text on teal or plum. Teal on creamsicle also gives strong contrast. Brick red and ivory are approximately **4.39:1**; avoid this pairing for small text or normal-size button labels. Keep primary actions teal with ivory labels. Red is an accent, not the main text color.

## Visual character

Use clean ivory screens, rounded shapes, and occasional retro ticket or VHS-label details. Reference the warmth and adventure of 80s movie night through typography and small graphic touches. Avoid prominent neon, distressed textures, heavy film grain, or recreating recognizable franchise branding.

*Suggested balance: ivory carries the screens, teal carries structure, creamsicle carries selection, plum adds depth, and brick red appears sparingly. Keep the same color meanings across onboarding, recommendations, and alerts.*

## Type and interaction

Bree Serif headings. DM Sans for body text, navigation, questions, and controls.

| Typography role | Proposed specification |
| --- | --- |
| Brand and display | **Bree Serif Regular 400**. Use for CineMatch and selected page headings. Suggested mobile display: 28-32 px; desktop: 36-40 px. |
| Section headings | Bree Serif Regular 400 at 22-24 px, or DM Sans Medium 500 for compact functional sections. |
| Body and questions | **DM Sans Regular 400**, 16 px body and 18-20 px main questions. Use generous line spacing, about 1.5 for paragraphs. |
| Buttons and navigation | DM Sans Medium 500, 14-16 px. Sentence case, brief wording, persistent labels. |
| Metadata | DM Sans Regular 400, 13-14 px. Keep runtime, rating, year, service, and sample-data labels legible. |

## Layout and controls

Start with a single-column phone layout and a consistent spacing rhythm: 8, 16, 24, and 32 px. Suggested corners: 12-16 px for cards, pill shapes for answers. Make tap targets about 44 px or larger. Expand desktop layouts while preserving the questionnaire's one-question-at-a-time focus.

Use selected answer chips with creamsicle fill, teal text, and a visible check or outline. Give Must have a labeled toggle. Show selected, loading, empty, and error states in words as well as color. Keep keyboard focus visible and respect reduced-motion preferences.

## Voice

Write like a playful video-store clerk: friendly, concise, a little witty, and happy to make a choice. Keep jokes out of errors, availability limits, and important explanations. Explain each recommendation in concrete terms instead of giving generic praise.

| Moment | Example copy |
| --- | --- |
| Question | What kind of night is it? |
| Recommendation rationale | An easygoing adventure under two hours, with the playful energy you like. |
| Rejection follow-up | Not the one? What missed the mark? |
