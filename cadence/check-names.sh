#!/bin/sh
# check-names.sh <demoNN> — fail if the name is taken in the tracked tree
# or as an untracked hub worktree. Run BEFORE dispatching a build under a
# new demoNN name. (EE 1213 shrink: name collisions cost the demo35 ship
# hold EE 1073->1076, the demo62/demo63 rename, and a blocked FF EE 1213.)
set -eu
cd ~/nf-repo
name="builds/$1"
if git ls-tree --name-only HEAD "$name" | grep -q .; then echo "TAKEN (tracked): $name"; exit 1; fi
if [ -e "$name" ]; then echo "TAKEN (worktree): $name"; exit 1; fi
echo "FREE: $name"
