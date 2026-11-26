#!/usr/bin/env python3
"""
win-state-sealer.py — Nova Fox encoded win state generator.

Run this OFFLINE, on your own machine, away from any synced folder.
It streams dragon-spine.phext (the map: every occupied coordinate of the
merged dragon lexicon, one "0" per scroll), draws ONE coordinate uniformly
at random from the occupied set, seals it with a one-time pad, and prints:

  * the SEED              — yours alone. The pad is derived from it (see
                            below); whoever holds the seed can re-derive
                            the pad. Never transmitted, never reused.
  * the ENCODED WIN STATE — safe to return and publish. It reveals nothing:
    a one-time pad ciphertext is consistent with every possible coordinate.

The winning coordinate is never printed, never written to disk, and never
seen by anyone — not even you. It exists only as seed + ciphertext. The
phrase at that coordinate in the merged lexicon is the winning phrase;
nobody needs to know it in advance, including us.

WHY THE PAD IS EXPENSIVE — the chained derivation
-------------------------------------------------
The pad is not drawn directly. A 32-byte seed is drawn from OS entropy,
then run through a CHAIN of 46,500 scrypt passes, each pass consuming the
previous pass's output; the pad is the first 9 bytes of the final state.
The parameters are FIXED and published (below): the same seed re-derives
the same pad on any machine, forever. A checker pays the full chain for
every candidate — and the chain is sequential, so parallelism cannot
shorten a single one.

The arithmetic (the invariant is total memory traffic):

  * One scrypt pass at n=2^20, r=8, p=1 has a working set of
    128 * n * r = 1,073,741,824 bytes (1 GiB) and moves roughly twice
    that through RAM (ROMix writes the array, then reads it back):
    ~2.15 GB of traffic per pass.
  * 46,500 passes x ~2.15 GB = ~99.9 TB of total memory traffic —
    the same ~100 TB as the original 1TB-resident sizing (a 1TB
    footprint traversed ~100 times), sliced into 1 GiB passes so it
    runs on a 32GB machine. The terabyte is the traffic, not the
    residence.
  * Time = traffic / bandwidth. At modern server bandwidth
    (~350 GB/s) the chain takes ~5 minutes — the ruled target. On an
    old laptop (DDR3/DDR4, ~20-30 GB/s effective) expect roughly
    55-85 minutes, about an hour. ESTIMATE: real hardware varies;
    run --selftest on the actual machine to preview the wait.
  * Why 1 GiB slices: CPython's hashlib.scrypt rejects maxmem >= 2^31
    on standard builds, so a single pass can address under 2 GiB —
    a ~17 GB pass (n=2^24) raises "memory limit exceeded" on exactly
    the class of machine that must run this. Chaining 1 GiB passes
    is portable everywhere.

Stdlib only. No network. This script writes nothing to disk.

Usage:
  python3 win-state-sealer.py dragon-spine.phext            # seal
  python3 win-state-sealer.py --selftest                    # preview the wait
  python3 win-state-sealer.py --open <seed-hex> <cipher-hex>  # reveal (later)
"""

import hashlib
import secrets
import sys
import time

# phext break bytes -> dimension index, coarsest first (libphext semantics,
# derived empirically from sq/libphext during the lexicon builds).
BREAKS = {
    0x01: 0,  # library
    0x1F: 1,  # shelf
    0x1E: 2,  # series
    0x1D: 3,  # collection
    0x1C: 4,  # volume
    0x1A: 5,  # book
    0x19: 6,  # chapter
    0x18: 7,  # section
    0x17: 8,  # scroll
}

EXPECTED_SCROLLS = 55_000_000
EXPECTED_SHA256 = "72bd16b6e51309dadf7d3da69ebebf046c79c9cee66428d20a4f9b93d5fd7b8e"

# --- The chain: FIXED parameters, published, never machine-calibrated. ---
# Anyone re-running the same seed through these exact parameters gets the
# same pad, on any machine, in any year. Changing any of them changes
# every pad ever derived — treat this block as part of the seal.
CHAIN_SALT = b"nova-fox-win-state-chain-v1"
SCRYPT_N = 1 << 20          # 1 GiB working set per pass (128 * n * r bytes)
SCRYPT_R = 8
SCRYPT_P = 1
SCRYPT_MAXMEM = 2**31 - 1   # the most CPython's hashlib.scrypt accepts
SCRYPT_DKLEN = 32
CHAIN_PASSES = 46_500       # x ~2.15 GB traffic = ~99.9 TB total
SEED_BYTES = 32
PAD_BYTES = 9               # one byte per coordinate component


def derive_pad(seed, progress=True):
    """Run the chain: CHAIN_PASSES sequential scrypt passes from the seed.

    Returns the one-time pad (the first PAD_BYTES of the final state).
    Sequential by construction — pass i+1 consumes pass i's output, so
    no parallel shortcut exists for a single chain.
    """
    state = seed
    start = time.time()
    for i in range(1, CHAIN_PASSES + 1):
        state = hashlib.scrypt(state, salt=CHAIN_SALT, n=SCRYPT_N,
                               r=SCRYPT_R, p=SCRYPT_P,
                               maxmem=SCRYPT_MAXMEM, dklen=SCRYPT_DKLEN)
        if progress and i % 500 == 0:
            elapsed = time.time() - start
            eta = elapsed / i * (CHAIN_PASSES - i)
            print(f"  ...pass {i}/{CHAIN_PASSES} "
                  f"({elapsed:.0f}s elapsed, ~{eta:.0f}s to go)",
                  file=sys.stderr)
    return state[:PAD_BYTES]


def print_parameters():
    footprint_gb = 128 * SCRYPT_N * SCRYPT_R / 1e9
    traffic_tb = CHAIN_PASSES * 2 * 128 * SCRYPT_N * SCRYPT_R / 1e12
    print("Chain parameters (fixed, published):")
    print(f"  scrypt n=2^20 r={SCRYPT_R} p={SCRYPT_P}, salt={CHAIN_SALT!r}")
    print(f"  {CHAIN_PASSES} chained passes, {footprint_gb:.2f} GB working "
          f"set per pass, ~{traffic_tb:.1f} TB total memory traffic")


def sample_coordinate(path):
    """Reservoir-sample one coordinate, uniform over all scrolls in the file.

    Also verifies the file's sha256 and scroll count while streaming, so a
    substituted or truncated spine aborts the seal instead of sealing junk.
    """
    coord = [1] * 9
    chosen = None
    count = 0
    in_text = False
    digest = hashlib.sha256()
    with open(path, "rb") as f:
        while True:
            chunk = f.read(1 << 20)
            if not chunk:
                break
            digest.update(chunk)
            for b in chunk:
                dim = BREAKS.get(b)
                if dim is None:
                    if not in_text:
                        in_text = True
                        count += 1
                        if count % 10_000_000 == 0:
                            print(f"  ...{count} scrolls", file=sys.stderr)
                        # Reservoir: the i-th scroll replaces the current
                        # choice with probability 1/i -> uniform overall.
                        if secrets.randbelow(count) == 0:
                            chosen = tuple(coord)
                else:
                    in_text = False
                    coord[dim] += 1
                    for lower in range(dim + 1, 9):
                        coord[lower] = 1
    return chosen, count, digest.hexdigest()


def seal(path):
    coord, count, sha = sample_coordinate(path)
    if sha != EXPECTED_SHA256:
        print(f"ABORT: spine sha256 {sha} != expected {EXPECTED_SHA256}. Nothing sealed.",
              file=sys.stderr)
        sys.exit(1)
    if count != EXPECTED_SCROLLS:
        print(f"ABORT: spine holds {count} scrolls, expected {EXPECTED_SCROLLS}. Nothing sealed.",
              file=sys.stderr)
        sys.exit(1)
    print(f"Spine verified: {count} scrolls, sha256 ok.")
    print()
    print_parameters()
    print()
    print("Deriving the pad — the expensive part, by design. "
          "Expect ~5 minutes on modern hardware, roughly an hour on an "
          "old laptop (estimate; the --selftest mode previews it).")
    seed = secrets.token_bytes(SEED_BYTES)  # OS entropy; THE secret
    start = time.time()
    pad = derive_pad(seed)
    print(f"Pad derived in {time.time() - start:.0f}s.")
    plain = bytes(coord)  # 9 bytes, one per component, canonical order
    cipher = bytes(p ^ m for p, m in zip(pad, plain))
    print()
    print("SEED — this is the secret. The pad is derived from it, so the")
    print("seed IS the key: keep it offline, on paper or on this machine")
    print("only; sign the record (seed + encoded state + the parameters")
    print("above) with your own key. Never send the seed to anyone, never")
    print("reuse it. If it is lost, the encoded state below can never be")
    print("opened — the proof dies with it.")
    print(seed.hex())
    print()
    print("ENCODED WIN STATE — return this, with your signature. Safe to")
    print("publish; under a one-time pad it is consistent with every")
    print("coordinate in the space.")
    print(cipher.hex())


def open_state(seed_hex, cipher_hex):
    seed = bytes.fromhex(seed_hex)
    cipher = bytes.fromhex(cipher_hex)
    if len(seed) != SEED_BYTES:
        print(f"ABORT: seed must be {SEED_BYTES} bytes (64 hex chars).",
              file=sys.stderr)
        sys.exit(1)
    if len(cipher) != PAD_BYTES:
        print(f"ABORT: encoded state must be {PAD_BYTES} bytes (18 hex chars).",
              file=sys.stderr)
        sys.exit(1)
    print_parameters()
    print()
    print("Re-deriving the pad through the same chain — the same cost as")
    print("sealing, by design.")
    start = time.time()
    pad = derive_pad(seed)
    print(f"Pad re-derived in {time.time() - start:.0f}s.")
    coord = [p ^ c for p, c in zip(pad, cipher)]
    text = (f"{coord[0]}.{coord[1]}.{coord[2]}/"
            f"{coord[3]}.{coord[4]}.{coord[5]}/"
            f"{coord[6]}.{coord[7]}.{coord[8]}")
    print("Winning coordinate:", text)
    print("Read the merged dragon lexicon at this coordinate: the scroll")
    print("there is the phrase the winner spoke. That is the proof.")


def selftest():
    """Run ONE chain pass at the full parameters and project the wait."""
    print_parameters()
    print()
    print("Running one scrypt pass at the full parameters...")
    start = time.time()
    hashlib.scrypt(b"\x00" * SEED_BYTES, salt=CHAIN_SALT, n=SCRYPT_N,
                   r=SCRYPT_R, p=SCRYPT_P, maxmem=SCRYPT_MAXMEM,
                   dklen=SCRYPT_DKLEN)
    dt = time.time() - start
    traffic = 2 * 128 * SCRYPT_N * SCRYPT_R
    print(f"One pass: {dt:.2f}s ({traffic / dt / 1e9:.1f} GB/s effective "
          f"memory traffic on this machine).")
    total = dt * CHAIN_PASSES
    print(f"Projected full chain ({CHAIN_PASSES} passes): "
          f"{total:.0f}s = {total / 60:.1f} minutes.")
    print("That projection is this machine's wait for both sealing and")
    print("opening. Nothing was sealed; no secret was generated.")


if __name__ == "__main__":
    if len(sys.argv) >= 2 and sys.argv[1] == "--open":
        if len(sys.argv) != 4:
            print("usage: win-state-sealer.py --open <seed-hex> <cipher-hex>",
                  file=sys.stderr)
            sys.exit(2)
        open_state(sys.argv[2], sys.argv[3])
    elif len(sys.argv) >= 2 and sys.argv[1] == "--selftest":
        selftest()
    else:
        seal(sys.argv[1] if len(sys.argv) > 1 else "dragon-spine.phext")
