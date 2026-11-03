# Daylight participant study

Participant site: https://adeeth101.github.io/Prototype-Demo/

Try the complete flow with `?test=1`. TEST records are flagged and excluded from the participant export. The consent page offers a TEST-only sample-details button. No participant findings are supplied with this repository.

## Participant flow

Welcome → information and consent → instructions → online activity **or** an activity with the researcher → optional questionnaire → confirmed saved receipt and interview handoff.

The online planner uses twelve broad two-hour periods and three meaningful attention lanes: Personal, Household and Background. Longer uses span two consecutive periods; Background appliances can overlap. There are ten core activities, eight optional extras, and fixed fridge/Wi-Fi loads. Its explicit learning sequence is an unaided first plan, guided practice with live coaching, then a fresh unaided plan with cues hidden. All three snapshots are preserved. Continue to feedback is always available, including for unfinished plans. Breakfast/morning, dinner/later day and washing-before-drying remain the timing rules. Personal/Household each allow one activity per period; unattended Background activities can overlap. Lane choice records the participant’s attention/household context, not power intensity. The alternative route records physical prototype, researcher-led demonstration, or no prototype experience. The last route skips SUS. Instructions and questionnaire context refer to the prototype actually experienced; ten original SUS items are unchanged. Do not combine different experience routes as if they were equivalent conditions.

## Data collection

GitHub Pages hosts only the public frontend and study materials. A separate HTTPS API stores consent and responses in a private Cloudflare D1 database through Sites. **Never commit names, UIDs, responses, access keys or exports to this public repository.**

- Consent is saved before proceeding. Each session receives a random write credential kept in sessionStorage.
- Progress, questionnaire drafts, original prototype events/schedules and final responses are saved to the service. The browser keeps a draft if syncing fails.
- “Ready to talk” appears only after the service confirms final submission.
- Participants can withdraw their active website session. Separate recordings/copies require contacting the researcher.
- All read/export operations require the private researcher key, which is not in this repository or client bundle. Access it from the researcher's private working files.
- Researcher dashboard: https://daylight-study-data-u7623871.swiftluck19.chatgpt.site

The dashboard separates TEST records and exports private JSON plus summary CSV. Partial SUS remains unscored. Check media permissions before Zoom recording, and capture the interview separately. This site does not record microphones, cameras or the interview.

## Development and publication

Run `python -m http.server 8765 --bind 127.0.0.1` here and open http://127.0.0.1:8765/. Files use browser ES modules and must be served over HTTP.

Run `node --check portal.mjs` and `node --check prototype/app.mjs`. Model checks are in `checks.mjs`. The separate API source and its tests are in the private HCI working directory; no secrets are included here. API URL is configured in `config.mjs`.

GitHub Pages publishes the root of `main` using the built-in Pages build. `.nojekyll` preserves these plain static files. No third-party analytics, font service, or form account is required for participants.

## Study limits

Power, intensity profile and 4 kW soft target are illustrative assumptions, not live grid readings, a forecast, or an electrical safety rating. Energy depends on the selected activities plus fixed background loads. Rescheduling the same activities preserves their energy; adding/removing extras changes it. Two-slot uses distribute their energy across both periods. The chart shows slot-average demand, not instantaneous peak. The same-task fixed-order online revision includes practice and revealed information and does not isolate a causal feedback effect. Physical/demonstration sessions must be interpreted according to the actual procedure used.

Researcher: Adith Iyer, u7623871@anu.edu.au. COMP3900, ANU. Prepared 2026-11-02 for sessions on 2026-11-03. Final coursework submission: 2026-11-05 23:59 AEDT.

## AI assistance

Adith selected the concept and proposed the time-axis/five-lane optimisation task. Codex assisted with implementation, study-flow wording, matching the original SUS instrument, consent/data-handling design, automated checks and deployment. Values are illustrative pending verification. No participant evidence or findings were generated. The coursework AI-use log and acknowledgement are maintained separately in the HCI project.

## Learning demonstration update - 2026-11-03

The explicit sequence is **initial unaided -> guided practice -> final unaided -> saved results**. Colour/energy/demand coaching is shown during guided practice; both unaided stages hide it. The final stage starts with an empty board and the same core/chosen-extra activity pool. Each immutable snapshot records phase, help availability, start/end time, original schedule and metrics. A comparison requires valid plans with the same selected uses. This immediate practice check does not demonstrate lasting learning or causal effects; order and practice remain confounded. Incomplete stages remain usable evidence and do not block the questionnaire.

The visual prototype uses a recessed board, an activity tray and rounded raised tiles. Drag left into the tray to remove, with Undo; hover/drag previews show the entire one/two-slot footprint, the active period and attention lane. Green outline means placement fits, not optimal energy use. Red means an invalid fit; guided amber means a timing rule to revisit. Dragging outside/cancelling leaves the original tile in place. The original chosen grip position is kept for long tiles. Delete removes a focused tile; the editor/select-and-click alternatives remain.

Fresh rehearsal: `?test=1&run=learning-v4`. Existing consent/session data remains; previous demonstration snapshots are retained rather than reinterpreted. Participant information version is updated for the three-step activity. No actual participant evidence was generated during development.
