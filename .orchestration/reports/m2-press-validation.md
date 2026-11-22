# m2-press validation: PASS
- Descends from 9f50fff: yes.
- Files: 10 Swift files under ios/Peepl only; 35 lines, all `.buttonStyle(.plain)` -> `PressStyle(scale:)`. Mechanical.
- grep `buttonStyle(.plain)`: only a doc comment in Motion.swift remains.
- xcodegen + xcodebuild (generic iOS Simulator): BUILD SUCCEEDED.
- Scales match plan table / per-item values spot-checked (rows 0.98, pills 0.95, round 0.92, chips 0.94, todo 0.99, neither 0.96, filter x 0.85, voice 0.9). A few unplanned values (0.9 for mic/send/stop, 0.97 for one control) are within the round-button family; not verified individually.
- Not checked: runtime feel, tests (no simulator runtime), buttons that never had buttonStyle (Menu label, ShareLink beyond those changed).
