// Nova Fox demo — WASM core kernels (source of nova_core.wasm).
//
// The deterministic heart of the subspace module, per the brief's stack
// (WASM core owns the verbs' mathematics; rendering and document glue
// live outside). Three kernels, no imports, fixed buffers:
//
//   hash_bytes(len)        FNV-1a + xorshift scramble over IN[..len]
//                          (the phorge-style seed hash: coordinate+tune in,
//                          pocket seed out — deterministic everywhere)
//   life_step(w, h)        one Conway step (B3/S23) over the 0/1 layer
//                          in IN, result in OUT
//   gen_foam(seed, w, h)   the pocket foam: border '=', interior earth
//                          at 30% by xorshift32 — OUT holds glyph bytes
//
// Build: rustc --target wasm32-unknown-unknown --crate-type cdylib \
//          -O -C panic=abort -C lto=fat -C strip=symbols core.rs \
//          -o nova_core.wasm        (no_std: the binary stays kilobytes)

#![no_std]

#[panic_handler]
fn panic(_: &core::panic::PanicInfo) -> ! {
    loop {}
}

const CAP: usize = 70000;
static mut IN: [u8; CAP] = [0; CAP];
static mut OUT: [u8; CAP] = [0; CAP];

#[no_mangle]
pub extern "C" fn in_ptr() -> *mut u8 {
    unsafe { IN.as_mut_ptr() }
}

#[no_mangle]
pub extern "C" fn out_ptr() -> *mut u8 {
    unsafe { OUT.as_mut_ptr() }
}

fn scramble(mut h: u32) -> u32 {
    h ^= h << 13;
    h ^= h >> 17;
    h ^= h << 5;
    h
}

#[no_mangle]
pub extern "C" fn hash_bytes(len: u32) -> u32 {
    let n = (len as usize).min(CAP);
    let mut h: u32 = 2166136261;
    for i in 0..n {
        h ^= unsafe { IN[i] } as u32;
        h = h.wrapping_mul(16777619);
    }
    scramble(h)
}

fn xorshift(mut s: u32) -> u32 {
    s ^= s << 13;
    s ^= s >> 17;
    s ^= s << 5;
    s
}

#[no_mangle]
pub extern "C" fn gen_foam(seed: u32, w: u32, h: u32) {
    let (w, h) = (w as usize, h as usize);
    if w * h > CAP {
        return;
    }
    let mut s = scramble(seed ^ 0x9E3779B9);
    if s == 0 {
        s = 0x2545F491;
    }
    for y in 0..h {
        for x in 0..w {
            let i = y * w + x;
            if x == 0 || y == 0 || x == w - 1 || y == h - 1 {
                unsafe { OUT[i] = b'=' };
            } else {
                s = xorshift(s);
                unsafe { OUT[i] = if s % 100 < 30 { b'=' } else { b' ' } };
            }
        }
    }
}

#[no_mangle]
pub extern "C" fn life_step(w: u32, h: u32) {
    let (w, h) = (w as usize, h as usize);
    if w * h > CAP || w == 0 || h == 0 {
        return;
    }
    for y in 0..h {
        for x in 0..w {
            let mut n: u32 = 0;
            for dy in -1i32..=1 {
                for dx in -1i32..=1 {
                    if dx == 0 && dy == 0 {
                        continue;
                    }
                    let (nx, ny) = (x as i32 + dx, y as i32 + dy);
                    if nx >= 0 && ny >= 0 && (nx as usize) < w && (ny as usize) < h {
                        if unsafe { IN[ny as usize * w + nx as usize] } != 0 {
                            n += 1;
                        }
                    }
                }
            }
            let alive = unsafe { IN[y * w + x] } != 0;
            let next = if alive { n == 2 || n == 3 } else { n == 3 };
            unsafe { OUT[y * w + x] = if next { 1 } else { 0 } };
        }
    }
}
