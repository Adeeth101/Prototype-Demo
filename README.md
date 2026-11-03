# Daylight participant study

Participant site: https://adeeth101.github.io/Prototype-Demo/

Fresh rehearsal: https://adeeth101.github.io/Prototype-Demo/?test=1&run=bowl-v5

## Current flow - 2026-11-03

Information/consent -> three household days -> final optional SUS/custom feedback -> saved receipt -> interview. The physical/researcher-demonstration bypass remains available and records the actual experience route.

Each day has three sections: **draw from bowls -> arrange the drawn tasks -> optional short check-in**. Day 1 is unaided, day 2 is guided practice, and day 3 is a different unaided day. Both unaided arrangements hide energy guidance. Ordinary fit/attention feedback and time-window labels remain available. The questionnaire can be reached early; incomplete days and unsubmitted check-in drafts remain recorded as observed.

## Balanced random days

The pool contains 48 illustrative uses: 16 Personal, 16 Household and 16 Background, with eight one-slot and eight two-slot uses in each category. Each day draws 3 Personal, 3 Household and 4 Background uses. Exactly four tiles are two-slot uses: one Personal, one Household and two Background. Tiles do not repeat across the three days.

A session seed allocates three quota/duration-controlled sets before drawing, without replacement across days. Covered bowl picks reveal the allocated set; a one-click draw option is also available. The draw order/positions, seed, catalogue version and allocation are saved, so refreshing cannot reroll. Washing/drying dependencies are handled as a pair where drawn. Each day gets task-specific time windows built around a checked feasible reference plan. The reference is a feasibility witness, not an optimum; the TEST-only button can load it.

The board retains three meaningful attention lanes, overlapping unattended tasks, fixed fridge/Wi-Fi loads, long tiles, physical tray/recess styling, drag-left return/Undo and hover/drop previews.

## Check-ins and interpretation

Four separate custom single items measure confidence about another unaided day, mental effort, placement convenience and willingness to engage. One optional pattern question and comment follow. The first/final pattern forms cover applying grid intensity; the guided-round question covers spreading load without dropping a need. Answers/explanations are withheld until all days finish. Skips remain null. These custom items are descriptive, not validated scales, and are not added to SUS. Ten original SUS items and their scoring remain unchanged in the final questionnaire.

Quota/duration balancing does not make the days equivalent in energy or difficulty. Raw cross-day emissions are not a learning score. The saved independent-use intensity bounds ignore contention/dependencies and provide only within-day analytical context; `timingOpportunityUsed` is not an exact optimality or causal-learning measure. Changed tasks/windows, fixed order, practice and the questions themselves can affect results. Immediate pattern checks cannot establish lasting learning or real-world transfer.

## Data and privacy

GitHub Pages hosts public code/materials only. Consent identity and responses are stored separately through an HTTPS Sites/Cloudflare D1 service. Every record read/export requires the private researcher key. That key and all exports stay outside this public repository. Session write credentials and browser drafts support refresh/retry. Completion receipts require confirmed server saving.

Researcher dashboard: https://daylight-study-data-u7623871.swiftluck19.chatgpt.site

TEST mode and the researcher's UID are excluded from participant exports. The site does not record the interview, camera or microphone; check separate permissions before Zoom. Participants can withdraw the active website session; separate copies/recordings require contacting the researcher.

## Run and check

Run `python -m http.server 8765 --bind 127.0.0.1` here, then open http://127.0.0.1:8765/. ES modules require HTTP. GitHub Pages publishes the root of main with .nojekyll.

`node checks.mjs` verifies seeded allocation, 3,000 generated feasible days, quotas, no repeats, variable windows, duration/energy and attention constraints. `node checks-learning.mjs` checks the complete draw/arrange/check-in flow, preserved originals, skipped responses, construct separation, partial exits and drag geometry. Live private-storage checks use clearly synthetic TEST records and remove them afterward. Actual browser rehearsal remains necessary; prior Windows visual verification was blocked by browser URL-confidence policy.

All powers/intensities are illustrative. Moving the same uses preserves their energy; new days can have different totals. Slot demand is energy divided by two hours, not instantaneous power or an electrical safety rating.

## AI assistance

Adith chose the concept and requested the revisions. Codex assisted with design, implementation, custom study instruments, testing and deployment. No actual participant evidence or findings were generated. Coursework disclosure and the full AI-use log are maintained in the private HCI working files.
