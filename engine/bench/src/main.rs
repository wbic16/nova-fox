// Nova Fox capacity bench — synthetic phext at scale, measured against libphext-rs 0.6.6 (reference).
// Each phase is a separate process invocation so /usr/bin/time -v reports per-phase peak RSS.
use std::time::Instant;

struct Rng(u64);
impl Rng {
    fn next(&mut self) -> u64 {
        let mut x = self.0;
        x ^= x << 13;
        x ^= x >> 7;
        x ^= x << 17;
        self.0 = x;
        x
    }
}

// Room-like scroll content: ~1 KB of glyph-grid lines + flux tokens, deterministic per seed.
fn room(rng: &mut Rng, target: usize) -> String {
    const GLYPHS: &[u8] = b"=~ .:()*!+,-#$%@&_{}[]^/|";
    const FLUX: &[u8] = b"abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let mut s = String::with_capacity(target + 64);
    while s.len() < target {
        let kind = rng.next() % 4;
        if kind == 0 {
            // a flux line (Base-88-style noise, per the OG spec's rooms of noise)
            for _ in 0..60 {
                s.push(FLUX[(rng.next() % FLUX.len() as u64) as usize] as char);
            }
        } else {
            for _ in 0..60 {
                s.push(GLYPHS[(rng.next() % GLYPHS.len() as u64) as usize] as char);
            }
        }
        s.push('\n');
    }
    s.truncate(target);
    s
}

fn gen(path: &str, mb: usize) {
    let target_bytes = mb * 1024 * 1024;
    let mut rng = Rng(0x9E3779B97F4A7C15);
    let mut out: Vec<u8> = Vec::with_capacity(target_bytes + 1024);
    let mut scrolls: u64 = 0;
    let mut sections: u64 = 0;
    while out.len() < target_bytes {
        let r = room(&mut rng, 1024);
        out.extend_from_slice(r.as_bytes());
        scrolls += 1;
        if scrolls % 100 == 0 {
            sections += 1;
            if sections % 100 == 0 {
                out.push(0x19); // chapter break
            } else {
                out.push(0x18); // section break
            }
        } else {
            out.push(0x17); // scroll break
        }
    }
    std::fs::write(path, &out).unwrap();
    println!("gen: {} bytes, {} scrolls -> {}", out.len(), scrolls, path);
}

fn read(path: &str) -> String {
    let t = Instant::now();
    let data = std::fs::read_to_string(path).unwrap();
    println!("read_to_string: {} bytes in {:?}", data.len(), t.elapsed());
    data
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let mode = args[1].as_str();
    match mode {
        "gen" => gen(&args[2], args[3].parse().unwrap()),
        "phokenize" => {
            let data = read(&args[2]);
            let t = Instant::now();
            let v = libphext::phext::phokenize(&data);
            println!("phokenize: {} scrolls in {:?}", v.len(), t.elapsed());
        }
        "explode" => {
            let data = read(&args[2]);
            let t = Instant::now();
            let m = libphext::phext::explode(&data);
            println!("explode: {} scrolls in {:?}", m.len(), t.elapsed());
        }
        "spans" => {
            let data = read(&args[2]);
            let t = Instant::now();
            let v = libphext::phext::spans(&data);
            let build = t.elapsed();
            let mid = &v[v.len() / 2];
            let t2 = Instant::now();
            let text = &data[mid.range.clone()];
            let lookup = t2.elapsed();
            println!(
                "spans: {} spans built in {:?}; mid scroll {} bytes read in {:?}",
                v.len(),
                build,
                text.len(),
                lookup
            );
        }
        "offset" => {
            let data = read(&args[2]);
            let v = libphext::phext::phokenize(&data);
            let idx = (v.len() as f64 * 0.8) as usize;
            let coord = v[idx].coord;
            let t = Instant::now();
            let off = libphext::phext::offset(&data, coord);
            println!(
                "offset(scroll #{}/{}): byte {} in {:?} (offset() rescans the document)",
                idx,
                v.len(),
                off,
                t.elapsed()
            );
        }
        "replace" => {
            let data = read(&args[2]);
            let v = libphext::phext::phokenize(&data);
            let coord = v[v.len() / 2].coord;
            let mut rng = Rng(42);
            let new_scroll = room(&mut rng, 1024);
            let t = Instant::now();
            let out = libphext::phext::replace(&data, coord, &new_scroll);
            println!(
                "replace one mid scroll: {} -> {} bytes in {:?} (whole-document re-serialization)",
                data.len(),
                out.len(),
                t.elapsed()
            );
            if args.len() > 3 {
                let t2 = Instant::now();
                std::fs::write(&args[3], &out).unwrap();
                println!("write full document to disk: {:?}", t2.elapsed());
            }
        }
        "scan" => {
            let t = Instant::now();
            let bytes = std::fs::read(&args[2]).unwrap();
            let read_ms = t.elapsed();
            let t2 = Instant::now();
            let mut count: u64 = 0;
            for b in &bytes {
                match b {
                    0x01 | 0x1F | 0x1E | 0x1D | 0x1C | 0x1A | 0x19 | 0x18 | 0x17 => count += 1,
                    _ => {}
                }
            }
            println!(
                "raw read {:?}; delimiter scan (index-build equivalent): {} breaks in {:?}",
                read_ms,
                count,
                t2.elapsed()
            );
        }
        "wal" => {
            // Append one ~1 KB WAL segment (one action's inscription) to a log file.
            let path = &args[2];
            let n: usize = args[3].parse().unwrap();
            let mut rng = Rng(7);
            let seg = room(&mut rng, 1024);
            let mut f = std::fs::OpenOptions::new()
                .create(true)
                .append(true)
                .open(path)
                .unwrap();
            use std::io::Write;
            let t = Instant::now();
            for _ in 0..n {
                f.write_all(seg.as_bytes()).unwrap();
                f.write_all(b"\x17").unwrap();
            }
            f.sync_all().unwrap();
            println!("wal: {} appends of ~1 KB (fsync at end) in {:?}", n, t.elapsed());
        }
        "life" => {
            let side: usize = args[2].parse().unwrap();
            let gens: usize = args[3].parse().unwrap();
            let mut rng = Rng(12345);
            let mut cur = vec![0u8; side * side];
            for c in cur.iter_mut() {
                *c = (rng.next() % 4 == 0) as u8;
            }
            let mut nxt = vec![0u8; side * side];
            let t = Instant::now();
            for _ in 0..gens {
                for y in 0..side {
                    for x in 0..side {
                        let mut n = 0u8;
                        for dy in -1isize..=1 {
                            for dx in -1isize..=1 {
                                if dx == 0 && dy == 0 {
                                    continue;
                                }
                                let xx = (x as isize + dx).rem_euclid(side as isize) as usize;
                                let yy = (y as isize + dy).rem_euclid(side as isize) as usize;
                                n += cur[yy * side + xx];
                            }
                        }
                        let alive = cur[y * side + x] == 1;
                        nxt[y * side + x] = matches!((alive, n), (true, 2) | (true, 3) | (false, 3)) as u8;
                    }
                }
                std::mem::swap(&mut cur, &mut nxt);
            }
            let el = t.elapsed();
            let total = (side * side * gens) as f64;
            println!(
                "life: {}x{} x {} gens in {:?} = {:.0} cells/sec (single thread, naive)",
                side,
                side,
                gens,
                el,
                total / el.as_secs_f64()
            );
        }
        _ => panic!("unknown mode {}", mode),
    }
}
