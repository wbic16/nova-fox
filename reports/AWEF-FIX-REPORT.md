# AWEF Mapping Fix — Nova Fox

Will's ruling (2026-11-26 19:25 CST): "F is for forward." His authored N-03 AWEF text is CANONICAL: **AWEF = A backwards, F forwards, W left, E right.** The code's mapping (W forward / F back) changes to match. Joy's recorded AWEF take already matches canonical — no re-record, no text change.

Seed: engine/integration (= builds/demo24, everything-ship tree, ship EE 987, sha256 12d499546670d9a59fd47c3cd7de5786e93b30b8c4eb5d1281c7fc7fe07e3aef). Target tree: builds/demo26 (demo25 = dev loop's, untouched; demo21 untouched).

## Stage 3 — stamp, commit, stage (complete)
- **Ship EE 995.** NF_SHIP_EE:995 stands exactly once in the built file; the 987 stamp is gone. Unit re-run post-stamp: **435/435**.
- Stamped build: builds/demo26/index.html, 7,096,604 B, sha256 **144215c9e04165e0d8c6216dd7715cfe22572e64781e3a59fe8a72a27238f456**.
- engine/integration mirrored from demo26 (verified identical to demo24 before the mirror; its index.html hashes to the same 144215c9…).
- Commit **b03c130** on exo (parent 6420f87; only this fix's paths staged — the dev loop's unstaged demo21 edit untouched), pushed, **ls-remote verified: origin/exo = b03c130cd8f12860624a6bfddb45d1cb61ec93c8**.
- BUILD-QUEUE.md gained the builder rule ("Authored texts are canonical") with the AWEF case as its worked example; docs/FEATURE-STATUS.md's scheme row records the correction (status stays SHIPPED-STAGED until Will installs + the playable pass).
- **Staged on awsbox** ~/fox-phext-launch/site/index.html — sha256 144215c9… verified identical at both ends; supersedes the uninstalled EE 987 staging. NOT installed into the webroot — Will's sudo step:
  `sudo install -o www-data -g www-data -m 644 ~/fox-phext-launch/site/index.html /sites/web/fox.phext.io/index.html`
- Follow-up commit (this report at reports/AWEF-FIX-REPORT.md) closes the series.
- Note for the record: the two one-shot Jenkins jobs (nova-fox-e2e-demo26, nova-fox-e2e-demo26-scheme) remain disk-installed with their dated timer specs spent, per the estate pattern; the REST API route stays down until the Jenkins security realm has an 'admin' user — flagged here, not fixed (out of scope).

## Stage 1 — fix + unit (complete)
- demo26 copied from demo24; pre-edit build reproduced the seed byte-for-byte (12d49954…) and unit baseline 429/429 — every byte of diff that follows is the fix.
- Edits (all count-asserted): both AWEF tables → `{ f: KeyF, b: KeyA, l: KeyW, r: KeyE }`; toasts ×2 "F walks backward" → "forward"; comments ×3 corrected; nfWalkProbe now presses the scheme's own forward key (`fwdCode`). WASD untouched.
- New unit pins in test3.mjs (+6): both tables carry the scheme · canonical letters asserted (KeyF/KeyA/KeyW/KeyE) · old table absent from source AND build · WASD tables unchanged ×2 · toasts name F forward ×2 and never backward · walk probe follows the scheme. Strike-hint check renamed to "(F walks forward)" (assertion unchanged).
- **Unit post-fix: 435 passed, 0 failed** (429 baseline + 6 new). Pre-stamp built file: 7,096,604 B, sha256 b8e5346e….

## Stage 2 — e2e via Jenkins (complete)
- Jobs installed disk-side (estate pattern) after the loop's demo25 #3 finished (FAILURE — its own baseline result); Jenkins restarted once, 19:36 CST; both jobs registered.
- **Scheme gate: Jenkins `nova-fox-e2e-demo26-scheme` #1 — SUCCESS, 30 passed / 0 failed** (cdp_scheme_test.mjs on demo26, CDP port 9393; matches demo24's #7 scheme result 30/0).
- **Full suite: Jenkins `nova-fox-e2e-demo26` #1 — 79 passed / 8 failed**, and the 8 are the demo24 baseline set leg-for-leg (gesture rift crossing, standing-door span ×4, one-link-two-crossings, portal veer regression, harness page-exception abort) — identical to nova-fox-e2e #6 on demo24 (79/8) and inside the pristine demo20 baseline (#8: 71/12, same cluster + abort). **Zero failures attributable to the AWEF change**; no scheme/movement-direction leg fails in either run.

## Stage 2 — e2e via Jenkins (in progress)
- REST trigger route is DOWN estate-wide: Jenkins restarted 19:22 CST; since then every token-authenticated API call 500s — root cause in the Jenkins log: `UsernameNotFoundException: User admin not found in directory` (LDAP realm has no 'admin'; the estate's own hub-japi.sh fails identically; stored admin password 401s against the realm, as the job template's description records). Not fixable inside this task's scope.
- The estate's working pattern (dev loop, EE 980): disk-install a freestyle job dir from /home/wbic16/jenkins-nova-fox-e2e-config.xml with a one-shot TimerTrigger, restart Jenkins, poll the builds dir on disk. This fix follows that pattern exactly: jobs `nova-fox-e2e-demo26` (full suite, template route) and `nova-fox-e2e-demo26-scheme` (scheme harness via the WorkflowJob runner's proven sed adaptation, as a runner script).
- The dev loop's demo25 full-suite build #3 is genuinely running (started 19:26, log advancing) — the install waits for it to finish rather than killing it with a restart.

## Stage 0 — recon (complete)
- Hub repo ~/nf-repo @ exo 6420f87 (= origin/exo). Seed verified: builds/demo24/index.html and engine/integration/index.html both sha256 12d49954… ✓. NF_SHIP_EE:987 stamp lives at game3.js:23 (`const NF_SHIP_EE = "NF_SHIP_EE:987";`).
- Dev loop's unstaged edit ` M builds/demo21/cdp_test3.mjs` present in the working tree — not touched; commits stage only this fix's paths.
- **Mapping sites found (all in game3.js; scheme.js carries resolution only, no directions):**
  - Movement table (game3.js:2508): AWEF `{ f: KeyW, b: KeyF, l: KeyA, r: KeyE }` — WRONG, flips.
  - Touch stick table `stickCodes()` (game3.js:5847): identical wrong table — flips.
  - Scheme-toggle toasts (game3.js:5741, 5761): "F walks backward in this scheme" — flips to "forward".
  - Comments at 2507, 2710-2712 (strike binding), 5645 (strike guard): "F walks backward" — corrected to forward.
  - `nfWalkProbe` (game3.js:6386): hardcodes `keys.add("KeyW")` as forward — under canonical AWEF KeyW is left; fixed to press the scheme's own forward code (KeyF under AWEF).
- **Readers verified as scheme-name-only (no change needed, follow automatically):** strikeBindingLabel (AWEF→CLICK stays correct: F is a walking key under canonical too, now forward instead of back), the strike-on-F guard at 5647 (same reasoning), N-03 variant selection (3842 + scheme.js schemeBeatId), MOVE_LINES selection (3849 — its AWEF text at 3677 is already canonical verbatim), E-note suppression (5635 — E is right-strafe in both mappings), setScheme/syncSchemeControls labels, saveCtlPrefs, the Esc-menu scheme button (5303), console readout (6277), RESERVED_BIND_CODES (direction-free), the W-tap note handler (scheme-independent).
- Unit pins live in test3.mjs; the strike-hint block (line ~1421) already extracts from game source — new canonical-mapping pins go beside it.
