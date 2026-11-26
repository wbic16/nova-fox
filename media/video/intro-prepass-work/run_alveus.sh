#!/bin/bash
# Packet IP-3 — Alveus (Rock Mountain): tiling-field verification.
set -e
cd ~/intro-prepass-work
if ! python3 -c "import PIL" 2>/dev/null; then
  python3 -m venv .venv && .venv/bin/pip -q install pillow
  PY=.venv/bin/python3
else
  PY=python3
fi
$PY verify_field.py frames frames/field-manifest.json
