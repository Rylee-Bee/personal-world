# Front-door screen-reader walkthrough

> **Status:** Script, not yet run · **Verified:** UNKNOWN (no manual screen-reader pass has been done) · **Canonical for:** the manual walk Rylee does before the front door is called accessible · **Read this if:** you are about to sign off the front-door UI.

Automated axe, keyboard and overflow checks pass in `ui/e2e-fd/`. They do not replace this walk. Use the screen reader you actually use (VoiceOver on phone and desktop; NVDA or Orca if you have them). Write what you heard next to each step. "Unclear" is a valid answer.

Set up: open the app, Words Short, Density Standard, Station off. Repeat steps 1–8 once with Station on.

1. **Landmarks.** Open the landmark list. Expect: banner, navigation "Main", main. Four links: Home, Connect, Memory, Settings. The current one is announced as current page.
2. **Skip link.** Press Tab once. Expect "Skip to main content". Activate it. Focus lands in the main area.
3. **Home order.** Read from the top. Expect: Home, the one-line briefing, the Whole world group, Edit Home, Needs you, Needs a look, Your life, Quietly working. No Pick up heading while there is nothing to pick up.
4. **Whole world strip.** Move through the buttons. Each should read like "Downloads: Unavailable. Show details". Music reads "Not configured. Set up in Connect" and is a link.
5. **A row.** Land on the Downloads row. Expect the name, the short meaning, the value and unit, the state word, and "as of" time. The meter is announced with a plain sentence ("Last known: 40 percent of the queue done"), not a bare "image".
6. **Drill-in.** Activate the row. Expect it says expanded. Reading on: meaning, state, detail, freshness, then "Technical evidence" (collapsed), then "Open in Connect". Open the evidence: request, status, timing, error class. Collapse the row. Focus stays on the row button.
7. **Missing values.** The Calendar row has no value. Expect "—" read as a dash or "missing", never "0".
8. **Needs you.** Each item reads its text, its source and one action: "Approve: …" or "Open: …".
9. **Connect → Actions.** Tabs: arrow keys move between tabs. Run a write action: the dialog is announced as a dialog with its title, focus moves in, Escape closes it, focus returns to the Run button. After Confirm, the receipt is announced without moving focus ("SUCCEEDED").
10. **Connect → Advanced.** Secrets read as a name plus "Set" or "Not set". Replace opens a password field that starts empty. No value is ever read out.
11. **Memory.** Five tabs. Records says it is locked and offers "Confirm it's you". Find has a labelled search box.
12. **Settings.** Four radio groups, each announced with its group name and option count. Changing Words or Density changes Home the next time you open it. "Motion follows your device setting" is just text.
13. **Station on.** Everything in steps 1–12 reads the same. Station decoration is silent.
14. **Zoom and reflow.** At 200% zoom and on a 320px-wide window nothing scrolls sideways.

Report back: anything read in a confusing order, any control with no name, any place focus got lost.
