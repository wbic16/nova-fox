Nova Fox cadence data — one record per item, append-only. A daily job appends new items and fills blanks as builds land.
Fields: item | tree | inception EE | built EE | shipped EE | live EE | i-to-b | status | source
"-" means not yet or not applicable. "*" after an EE means reconstructed — the basis is named in CADENCE.md.
EE = floor((unix - 1795327200) / 420) + 1. Snapshot taken EE 969 (2026-11-26 16:58 CST).

item: Sellable core | tree: demo4 | inception: 898* | built: 946 | shipped: 948 | live: 948 | i-to-b: 48 | status: live | source: ECONOMY-BUILD-REPORT; dated note 2026-11-26 14:35 CST
item: Ladder shop | tree: demo5 | inception: 948 | built: 950 | shipped: - | live: - | i-to-b: 2 | status: built, unshipped | source: LADDER-BUILD-REPORT; dated note dispatch 14:35 CST
item: Form editor | tree: demo6 | inception: 951 | built: 961 | shipped: - | live: - | i-to-b: 10 | status: built, unshipped (recovery pass) | source: FORM-EDITOR-REPORT; forms ruling 14:50 CST
item: Portals — diagnosis + fix | tree: demo7 | inception: 952 | built: 966 | shipped: - | live: - | i-to-b: 14 | status: built, unshipped (diagnosis done 953) | source: PORTAL-DIAGNOSIS; PORTAL-FIX-REPORT; Will playtest report ~15:00 CST
item: Loading word trail | tree: demo9 | inception: 954 | built: 958 | shipped: - | live: - | i-to-b: 4 | status: built, unshipped | source: LOADING-TRAIL-REPORT; Will 15:15 CST
item: Gravity in subspace + wooze | tree: demo10 | inception: 954 | built: 959 | shipped: - | live: - | i-to-b: 5 | status: built, unshipped | source: GRAVITY-SUBSPACE-REPORT; rulings 15:13 + 15:38 CST
item: Fox Vision | tree: demo11 | inception: 955 | built: 963 | shipped: - | live: - | i-to-b: 8 | status: built, unshipped | source: FOX-VISION-REPORT (spec verbatim 15:20 CST)
item: Strike hint | tree: demo12 | inception: 955 | built: 962 | shipped: - | live: - | i-to-b: 7 | status: built, unshipped | source: STRIKE-HINT-REPORT; Will 15:23 CST
item: Esc menu | tree: demo13 | inception: 955 | built: - | shipped: - | live: - | i-to-b: - | status: in flight (age 14 EE at 969; still advancing EE 968) | source: Will 15:23 CST + extension 15:24; watchdog EE 968
item: In-game console | tree: demo15 | inception: 956 | built: 960 | shipped: - | live: - | i-to-b: 4 | status: built, unshipped | source: CONSOLE-REPORT (directive verbatim 15:26 CST)
item: Speedrun modes | tree: demo16 | inception: 956 | built: 967 | shipped: - | live: - | i-to-b: 11 | status: built, unshipped | source: SPEEDRUN-REPORT; Will 15:28 CST
item: Test client (REST/MCP) | tree: testclient | inception: 958 | built: - | shipped: - | live: - | i-to-b: - | status: in flight (age 11 EE at 969) | source: Will 15:41 CST (dated note); watchdog EE 968
item: Script inscription | tree: integration/NARRATION.md | inception: 958 | built: 959 | shipped: - | live: - | i-to-b: 1 | status: delivered into integration tree | source: SCRIPT-INSCRIPTION-REPORT; dispatched ~15:43 CST
item: Joy recording (35 takes) | tree: narration-audio-joy | inception: 959 | built: 960 | shipped: - | live: - | i-to-b: 1 | status: recorded, not yet wired into a build | source: RECORDING-REPORT; casting ruled 15:52 CST
item: Banter wiring | tree: demo17 | inception: 959 | built: 966 | shipped: - | live: - | i-to-b: 7 | status: built, unshipped | source: BANTER-REPORT (unit 249/249); Joy's hundred received 15:52 CST
item: Warp text | tree: demo18 | inception: 960 | built: 963 | shipped: - | live: - | i-to-b: 3 | status: built, unshipped | source: WARP-TEXT-REPORT (Will verbatim 15:55 CST)
item: Repo canonical home | tree: wbic16/nova-fox@exo | inception: 963 | built: 966 | shipped: 966 | live: 966 | i-to-b: 3 | status: shipped (the push is the delivery) | source: GITHUB-HOME-REPORT; Will's order 16:17 CST
item: Scheme preference (AWEF) | tree: demo19 | inception: 963 | built: - | shipped: - | live: - | i-to-b: - | status: in flight (age 6 EE at 969) | source: Will 16:17 CST; watchdog EE 968
item: Current ship (merge + stage) | tree: integration -> awsbox staging | inception: 967 | built: - | shipped: - | live: - | i-to-b: - | status: in flight (age 2 EE at 969; gate-blocked 967, go-ahead 968, re-dispatched) | source: SHIP-REPORT; deploy order 16:44 CST, go-ahead 16:55 CST
