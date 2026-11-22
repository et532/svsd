# mvp3-a report
Added Search.answer(constraints:), LocalAI.upgrade (+ reorder, test seams parse/model), FindView swaps in the upgrade (detached, only if !AIClient.enabled && LocalAI.isAvailable, applied only if no newer ask). Instant path unchanged; AIClient.rank untouched.
Special check inside upgrade uses Ask.interpret(question) (instant results from Search.answer are never "special" themselves).
Tests: 143 run, 1 skipped (eval), 0 failures; 4 new in LocalAIUpgradeTests.
Deviation: FoundationModelsEvalTests not refactored to call upgrade (optional in brief). Not checked: UI viewed, live model upgrade (no model on sim), eval not run.
