// ../../../hf-oauth-build-pRp19k/node_modules/gearhash-jit/dist/esm/wasm.js
var INPUT_OFFSET = 4096;
var PAGES = 8;
var MAX_INPUT_SIZE = PAGES * 65536 - INPUT_OFFSET;

// ../../../hf-oauth-build-pRp19k/node_modules/@huggingface/blake3-jit/dist/esm/compress.js
function compress(cv, cvOff, block, blockOff, out, outOff, full, counter, blockLen, flags) {
  let m0 = block[blockOff] | 0;
  let m1 = block[blockOff + 1] | 0;
  let m2 = block[blockOff + 2] | 0;
  let m3 = block[blockOff + 3] | 0;
  let m4 = block[blockOff + 4] | 0;
  let m5 = block[blockOff + 5] | 0;
  let m6 = block[blockOff + 6] | 0;
  let m7 = block[blockOff + 7] | 0;
  let m8 = block[blockOff + 8] | 0;
  let m9 = block[blockOff + 9] | 0;
  let m10 = block[blockOff + 10] | 0;
  let m11 = block[blockOff + 11] | 0;
  let m12 = block[blockOff + 12] | 0;
  let m13 = block[blockOff + 13] | 0;
  let m14 = block[blockOff + 14] | 0;
  let m15 = block[blockOff + 15] | 0;
  let s0 = cv[cvOff] | 0;
  let s1 = cv[cvOff + 1] | 0;
  let s2 = cv[cvOff + 2] | 0;
  let s3 = cv[cvOff + 3] | 0;
  let s4 = cv[cvOff + 4] | 0;
  let s5 = cv[cvOff + 5] | 0;
  let s6 = cv[cvOff + 6] | 0;
  let s7 = cv[cvOff + 7] | 0;
  let s8 = 1779033703;
  let s9 = 3144134277;
  let s10 = 1013904242;
  let s11 = 2773480762;
  let s12 = counter | 0;
  let s13 = counter / 4294967296 | 0;
  let s14 = blockLen | 0;
  let s15 = flags | 0;
  s0 = (s0 + s4 | 0) + m0 | 0;
  s12 ^= s0;
  s12 = s12 >>> 16 | s12 << 16;
  s8 = s8 + s12 | 0;
  s4 ^= s8;
  s4 = s4 >>> 12 | s4 << 20;
  s0 = (s0 + s4 | 0) + m1 | 0;
  s12 ^= s0;
  s12 = s12 >>> 8 | s12 << 24;
  s8 = s8 + s12 | 0;
  s4 ^= s8;
  s4 = s4 >>> 7 | s4 << 25;
  s1 = (s1 + s5 | 0) + m2 | 0;
  s13 ^= s1;
  s13 = s13 >>> 16 | s13 << 16;
  s9 = s9 + s13 | 0;
  s5 ^= s9;
  s5 = s5 >>> 12 | s5 << 20;
  s1 = (s1 + s5 | 0) + m3 | 0;
  s13 ^= s1;
  s13 = s13 >>> 8 | s13 << 24;
  s9 = s9 + s13 | 0;
  s5 ^= s9;
  s5 = s5 >>> 7 | s5 << 25;
  s2 = (s2 + s6 | 0) + m4 | 0;
  s14 ^= s2;
  s14 = s14 >>> 16 | s14 << 16;
  s10 = s10 + s14 | 0;
  s6 ^= s10;
  s6 = s6 >>> 12 | s6 << 20;
  s2 = (s2 + s6 | 0) + m5 | 0;
  s14 ^= s2;
  s14 = s14 >>> 8 | s14 << 24;
  s10 = s10 + s14 | 0;
  s6 ^= s10;
  s6 = s6 >>> 7 | s6 << 25;
  s3 = (s3 + s7 | 0) + m6 | 0;
  s15 ^= s3;
  s15 = s15 >>> 16 | s15 << 16;
  s11 = s11 + s15 | 0;
  s7 ^= s11;
  s7 = s7 >>> 12 | s7 << 20;
  s3 = (s3 + s7 | 0) + m7 | 0;
  s15 ^= s3;
  s15 = s15 >>> 8 | s15 << 24;
  s11 = s11 + s15 | 0;
  s7 ^= s11;
  s7 = s7 >>> 7 | s7 << 25;
  s0 = (s0 + s5 | 0) + m8 | 0;
  s15 ^= s0;
  s15 = s15 >>> 16 | s15 << 16;
  s10 = s10 + s15 | 0;
  s5 ^= s10;
  s5 = s5 >>> 12 | s5 << 20;
  s0 = (s0 + s5 | 0) + m9 | 0;
  s15 ^= s0;
  s15 = s15 >>> 8 | s15 << 24;
  s10 = s10 + s15 | 0;
  s5 ^= s10;
  s5 = s5 >>> 7 | s5 << 25;
  s1 = (s1 + s6 | 0) + m10 | 0;
  s12 ^= s1;
  s12 = s12 >>> 16 | s12 << 16;
  s11 = s11 + s12 | 0;
  s6 ^= s11;
  s6 = s6 >>> 12 | s6 << 20;
  s1 = (s1 + s6 | 0) + m11 | 0;
  s12 ^= s1;
  s12 = s12 >>> 8 | s12 << 24;
  s11 = s11 + s12 | 0;
  s6 ^= s11;
  s6 = s6 >>> 7 | s6 << 25;
  s2 = (s2 + s7 | 0) + m12 | 0;
  s13 ^= s2;
  s13 = s13 >>> 16 | s13 << 16;
  s8 = s8 + s13 | 0;
  s7 ^= s8;
  s7 = s7 >>> 12 | s7 << 20;
  s2 = (s2 + s7 | 0) + m13 | 0;
  s13 ^= s2;
  s13 = s13 >>> 8 | s13 << 24;
  s8 = s8 + s13 | 0;
  s7 ^= s8;
  s7 = s7 >>> 7 | s7 << 25;
  s3 = (s3 + s4 | 0) + m14 | 0;
  s14 ^= s3;
  s14 = s14 >>> 16 | s14 << 16;
  s9 = s9 + s14 | 0;
  s4 ^= s9;
  s4 = s4 >>> 12 | s4 << 20;
  s3 = (s3 + s4 | 0) + m15 | 0;
  s14 ^= s3;
  s14 = s14 >>> 8 | s14 << 24;
  s9 = s9 + s14 | 0;
  s4 ^= s9;
  s4 = s4 >>> 7 | s4 << 25;
  {
    const t0 = m0, t1 = m1;
    m0 = m2;
    m2 = m3;
    m3 = m10;
    m10 = m12;
    m12 = m9;
    m9 = m11;
    m11 = m5;
    m5 = t0;
    m1 = m6;
    m6 = m4;
    m4 = m7;
    m7 = m13;
    m13 = m14;
    m14 = m15;
    m15 = m8;
    m8 = t1;
  }
  s0 = (s0 + s4 | 0) + m0 | 0;
  s12 ^= s0;
  s12 = s12 >>> 16 | s12 << 16;
  s8 = s8 + s12 | 0;
  s4 ^= s8;
  s4 = s4 >>> 12 | s4 << 20;
  s0 = (s0 + s4 | 0) + m1 | 0;
  s12 ^= s0;
  s12 = s12 >>> 8 | s12 << 24;
  s8 = s8 + s12 | 0;
  s4 ^= s8;
  s4 = s4 >>> 7 | s4 << 25;
  s1 = (s1 + s5 | 0) + m2 | 0;
  s13 ^= s1;
  s13 = s13 >>> 16 | s13 << 16;
  s9 = s9 + s13 | 0;
  s5 ^= s9;
  s5 = s5 >>> 12 | s5 << 20;
  s1 = (s1 + s5 | 0) + m3 | 0;
  s13 ^= s1;
  s13 = s13 >>> 8 | s13 << 24;
  s9 = s9 + s13 | 0;
  s5 ^= s9;
  s5 = s5 >>> 7 | s5 << 25;
  s2 = (s2 + s6 | 0) + m4 | 0;
  s14 ^= s2;
  s14 = s14 >>> 16 | s14 << 16;
  s10 = s10 + s14 | 0;
  s6 ^= s10;
  s6 = s6 >>> 12 | s6 << 20;
  s2 = (s2 + s6 | 0) + m5 | 0;
  s14 ^= s2;
  s14 = s14 >>> 8 | s14 << 24;
  s10 = s10 + s14 | 0;
  s6 ^= s10;
  s6 = s6 >>> 7 | s6 << 25;
  s3 = (s3 + s7 | 0) + m6 | 0;
  s15 ^= s3;
  s15 = s15 >>> 16 | s15 << 16;
  s11 = s11 + s15 | 0;
  s7 ^= s11;
  s7 = s7 >>> 12 | s7 << 20;
  s3 = (s3 + s7 | 0) + m7 | 0;
  s15 ^= s3;
  s15 = s15 >>> 8 | s15 << 24;
  s11 = s11 + s15 | 0;
  s7 ^= s11;
  s7 = s7 >>> 7 | s7 << 25;
  s0 = (s0 + s5 | 0) + m8 | 0;
  s15 ^= s0;
  s15 = s15 >>> 16 | s15 << 16;
  s10 = s10 + s15 | 0;
  s5 ^= s10;
  s5 = s5 >>> 12 | s5 << 20;
  s0 = (s0 + s5 | 0) + m9 | 0;
  s15 ^= s0;
  s15 = s15 >>> 8 | s15 << 24;
  s10 = s10 + s15 | 0;
  s5 ^= s10;
  s5 = s5 >>> 7 | s5 << 25;
  s1 = (s1 + s6 | 0) + m10 | 0;
  s12 ^= s1;
  s12 = s12 >>> 16 | s12 << 16;
  s11 = s11 + s12 | 0;
  s6 ^= s11;
  s6 = s6 >>> 12 | s6 << 20;
  s1 = (s1 + s6 | 0) + m11 | 0;
  s12 ^= s1;
  s12 = s12 >>> 8 | s12 << 24;
  s11 = s11 + s12 | 0;
  s6 ^= s11;
  s6 = s6 >>> 7 | s6 << 25;
  s2 = (s2 + s7 | 0) + m12 | 0;
  s13 ^= s2;
  s13 = s13 >>> 16 | s13 << 16;
  s8 = s8 + s13 | 0;
  s7 ^= s8;
  s7 = s7 >>> 12 | s7 << 20;
  s2 = (s2 + s7 | 0) + m13 | 0;
  s13 ^= s2;
  s13 = s13 >>> 8 | s13 << 24;
  s8 = s8 + s13 | 0;
  s7 ^= s8;
  s7 = s7 >>> 7 | s7 << 25;
  s3 = (s3 + s4 | 0) + m14 | 0;
  s14 ^= s3;
  s14 = s14 >>> 16 | s14 << 16;
  s9 = s9 + s14 | 0;
  s4 ^= s9;
  s4 = s4 >>> 12 | s4 << 20;
  s3 = (s3 + s4 | 0) + m15 | 0;
  s14 ^= s3;
  s14 = s14 >>> 8 | s14 << 24;
  s9 = s9 + s14 | 0;
  s4 ^= s9;
  s4 = s4 >>> 7 | s4 << 25;
  {
    const t0 = m0, t1 = m1;
    m0 = m2;
    m2 = m3;
    m3 = m10;
    m10 = m12;
    m12 = m9;
    m9 = m11;
    m11 = m5;
    m5 = t0;
    m1 = m6;
    m6 = m4;
    m4 = m7;
    m7 = m13;
    m13 = m14;
    m14 = m15;
    m15 = m8;
    m8 = t1;
  }
  s0 = (s0 + s4 | 0) + m0 | 0;
  s12 ^= s0;
  s12 = s12 >>> 16 | s12 << 16;
  s8 = s8 + s12 | 0;
  s4 ^= s8;
  s4 = s4 >>> 12 | s4 << 20;
  s0 = (s0 + s4 | 0) + m1 | 0;
  s12 ^= s0;
  s12 = s12 >>> 8 | s12 << 24;
  s8 = s8 + s12 | 0;
  s4 ^= s8;
  s4 = s4 >>> 7 | s4 << 25;
  s1 = (s1 + s5 | 0) + m2 | 0;
  s13 ^= s1;
  s13 = s13 >>> 16 | s13 << 16;
  s9 = s9 + s13 | 0;
  s5 ^= s9;
  s5 = s5 >>> 12 | s5 << 20;
  s1 = (s1 + s5 | 0) + m3 | 0;
  s13 ^= s1;
  s13 = s13 >>> 8 | s13 << 24;
  s9 = s9 + s13 | 0;
  s5 ^= s9;
  s5 = s5 >>> 7 | s5 << 25;
  s2 = (s2 + s6 | 0) + m4 | 0;
  s14 ^= s2;
  s14 = s14 >>> 16 | s14 << 16;
  s10 = s10 + s14 | 0;
  s6 ^= s10;
  s6 = s6 >>> 12 | s6 << 20;
  s2 = (s2 + s6 | 0) + m5 | 0;
  s14 ^= s2;
  s14 = s14 >>> 8 | s14 << 24;
  s10 = s10 + s14 | 0;
  s6 ^= s10;
  s6 = s6 >>> 7 | s6 << 25;
  s3 = (s3 + s7 | 0) + m6 | 0;
  s15 ^= s3;
  s15 = s15 >>> 16 | s15 << 16;
  s11 = s11 + s15 | 0;
  s7 ^= s11;
  s7 = s7 >>> 12 | s7 << 20;
  s3 = (s3 + s7 | 0) + m7 | 0;
  s15 ^= s3;
  s15 = s15 >>> 8 | s15 << 24;
  s11 = s11 + s15 | 0;
  s7 ^= s11;
  s7 = s7 >>> 7 | s7 << 25;
  s0 = (s0 + s5 | 0) + m8 | 0;
  s15 ^= s0;
  s15 = s15 >>> 16 | s15 << 16;
  s10 = s10 + s15 | 0;
  s5 ^= s10;
  s5 = s5 >>> 12 | s5 << 20;
  s0 = (s0 + s5 | 0) + m9 | 0;
  s15 ^= s0;
  s15 = s15 >>> 8 | s15 << 24;
  s10 = s10 + s15 | 0;
  s5 ^= s10;
  s5 = s5 >>> 7 | s5 << 25;
  s1 = (s1 + s6 | 0) + m10 | 0;
  s12 ^= s1;
  s12 = s12 >>> 16 | s12 << 16;
  s11 = s11 + s12 | 0;
  s6 ^= s11;
  s6 = s6 >>> 12 | s6 << 20;
  s1 = (s1 + s6 | 0) + m11 | 0;
  s12 ^= s1;
  s12 = s12 >>> 8 | s12 << 24;
  s11 = s11 + s12 | 0;
  s6 ^= s11;
  s6 = s6 >>> 7 | s6 << 25;
  s2 = (s2 + s7 | 0) + m12 | 0;
  s13 ^= s2;
  s13 = s13 >>> 16 | s13 << 16;
  s8 = s8 + s13 | 0;
  s7 ^= s8;
  s7 = s7 >>> 12 | s7 << 20;
  s2 = (s2 + s7 | 0) + m13 | 0;
  s13 ^= s2;
  s13 = s13 >>> 8 | s13 << 24;
  s8 = s8 + s13 | 0;
  s7 ^= s8;
  s7 = s7 >>> 7 | s7 << 25;
  s3 = (s3 + s4 | 0) + m14 | 0;
  s14 ^= s3;
  s14 = s14 >>> 16 | s14 << 16;
  s9 = s9 + s14 | 0;
  s4 ^= s9;
  s4 = s4 >>> 12 | s4 << 20;
  s3 = (s3 + s4 | 0) + m15 | 0;
  s14 ^= s3;
  s14 = s14 >>> 8 | s14 << 24;
  s9 = s9 + s14 | 0;
  s4 ^= s9;
  s4 = s4 >>> 7 | s4 << 25;
  {
    const t0 = m0, t1 = m1;
    m0 = m2;
    m2 = m3;
    m3 = m10;
    m10 = m12;
    m12 = m9;
    m9 = m11;
    m11 = m5;
    m5 = t0;
    m1 = m6;
    m6 = m4;
    m4 = m7;
    m7 = m13;
    m13 = m14;
    m14 = m15;
    m15 = m8;
    m8 = t1;
  }
  s0 = (s0 + s4 | 0) + m0 | 0;
  s12 ^= s0;
  s12 = s12 >>> 16 | s12 << 16;
  s8 = s8 + s12 | 0;
  s4 ^= s8;
  s4 = s4 >>> 12 | s4 << 20;
  s0 = (s0 + s4 | 0) + m1 | 0;
  s12 ^= s0;
  s12 = s12 >>> 8 | s12 << 24;
  s8 = s8 + s12 | 0;
  s4 ^= s8;
  s4 = s4 >>> 7 | s4 << 25;
  s1 = (s1 + s5 | 0) + m2 | 0;
  s13 ^= s1;
  s13 = s13 >>> 16 | s13 << 16;
  s9 = s9 + s13 | 0;
  s5 ^= s9;
  s5 = s5 >>> 12 | s5 << 20;
  s1 = (s1 + s5 | 0) + m3 | 0;
  s13 ^= s1;
  s13 = s13 >>> 8 | s13 << 24;
  s9 = s9 + s13 | 0;
  s5 ^= s9;
  s5 = s5 >>> 7 | s5 << 25;
  s2 = (s2 + s6 | 0) + m4 | 0;
  s14 ^= s2;
  s14 = s14 >>> 16 | s14 << 16;
  s10 = s10 + s14 | 0;
  s6 ^= s10;
  s6 = s6 >>> 12 | s6 << 20;
  s2 = (s2 + s6 | 0) + m5 | 0;
  s14 ^= s2;
  s14 = s14 >>> 8 | s14 << 24;
  s10 = s10 + s14 | 0;
  s6 ^= s10;
  s6 = s6 >>> 7 | s6 << 25;
  s3 = (s3 + s7 | 0) + m6 | 0;
  s15 ^= s3;
  s15 = s15 >>> 16 | s15 << 16;
  s11 = s11 + s15 | 0;
  s7 ^= s11;
  s7 = s7 >>> 12 | s7 << 20;
  s3 = (s3 + s7 | 0) + m7 | 0;
  s15 ^= s3;
  s15 = s15 >>> 8 | s15 << 24;
  s11 = s11 + s15 | 0;
  s7 ^= s11;
  s7 = s7 >>> 7 | s7 << 25;
  s0 = (s0 + s5 | 0) + m8 | 0;
  s15 ^= s0;
  s15 = s15 >>> 16 | s15 << 16;
  s10 = s10 + s15 | 0;
  s5 ^= s10;
  s5 = s5 >>> 12 | s5 << 20;
  s0 = (s0 + s5 | 0) + m9 | 0;
  s15 ^= s0;
  s15 = s15 >>> 8 | s15 << 24;
  s10 = s10 + s15 | 0;
  s5 ^= s10;
  s5 = s5 >>> 7 | s5 << 25;
  s1 = (s1 + s6 | 0) + m10 | 0;
  s12 ^= s1;
  s12 = s12 >>> 16 | s12 << 16;
  s11 = s11 + s12 | 0;
  s6 ^= s11;
  s6 = s6 >>> 12 | s6 << 20;
  s1 = (s1 + s6 | 0) + m11 | 0;
  s12 ^= s1;
  s12 = s12 >>> 8 | s12 << 24;
  s11 = s11 + s12 | 0;
  s6 ^= s11;
  s6 = s6 >>> 7 | s6 << 25;
  s2 = (s2 + s7 | 0) + m12 | 0;
  s13 ^= s2;
  s13 = s13 >>> 16 | s13 << 16;
  s8 = s8 + s13 | 0;
  s7 ^= s8;
  s7 = s7 >>> 12 | s7 << 20;
  s2 = (s2 + s7 | 0) + m13 | 0;
  s13 ^= s2;
  s13 = s13 >>> 8 | s13 << 24;
  s8 = s8 + s13 | 0;
  s7 ^= s8;
  s7 = s7 >>> 7 | s7 << 25;
  s3 = (s3 + s4 | 0) + m14 | 0;
  s14 ^= s3;
  s14 = s14 >>> 16 | s14 << 16;
  s9 = s9 + s14 | 0;
  s4 ^= s9;
  s4 = s4 >>> 12 | s4 << 20;
  s3 = (s3 + s4 | 0) + m15 | 0;
  s14 ^= s3;
  s14 = s14 >>> 8 | s14 << 24;
  s9 = s9 + s14 | 0;
  s4 ^= s9;
  s4 = s4 >>> 7 | s4 << 25;
  {
    const t0 = m0, t1 = m1;
    m0 = m2;
    m2 = m3;
    m3 = m10;
    m10 = m12;
    m12 = m9;
    m9 = m11;
    m11 = m5;
    m5 = t0;
    m1 = m6;
    m6 = m4;
    m4 = m7;
    m7 = m13;
    m13 = m14;
    m14 = m15;
    m15 = m8;
    m8 = t1;
  }
  s0 = (s0 + s4 | 0) + m0 | 0;
  s12 ^= s0;
  s12 = s12 >>> 16 | s12 << 16;
  s8 = s8 + s12 | 0;
  s4 ^= s8;
  s4 = s4 >>> 12 | s4 << 20;
  s0 = (s0 + s4 | 0) + m1 | 0;
  s12 ^= s0;
  s12 = s12 >>> 8 | s12 << 24;
  s8 = s8 + s12 | 0;
  s4 ^= s8;
  s4 = s4 >>> 7 | s4 << 25;
  s1 = (s1 + s5 | 0) + m2 | 0;
  s13 ^= s1;
  s13 = s13 >>> 16 | s13 << 16;
  s9 = s9 + s13 | 0;
  s5 ^= s9;
  s5 = s5 >>> 12 | s5 << 20;
  s1 = (s1 + s5 | 0) + m3 | 0;
  s13 ^= s1;
  s13 = s13 >>> 8 | s13 << 24;
  s9 = s9 + s13 | 0;
  s5 ^= s9;
  s5 = s5 >>> 7 | s5 << 25;
  s2 = (s2 + s6 | 0) + m4 | 0;
  s14 ^= s2;
  s14 = s14 >>> 16 | s14 << 16;
  s10 = s10 + s14 | 0;
  s6 ^= s10;
  s6 = s6 >>> 12 | s6 << 20;
  s2 = (s2 + s6 | 0) + m5 | 0;
  s14 ^= s2;
  s14 = s14 >>> 8 | s14 << 24;
  s10 = s10 + s14 | 0;
  s6 ^= s10;
  s6 = s6 >>> 7 | s6 << 25;
  s3 = (s3 + s7 | 0) + m6 | 0;
  s15 ^= s3;
  s15 = s15 >>> 16 | s15 << 16;
  s11 = s11 + s15 | 0;
  s7 ^= s11;
  s7 = s7 >>> 12 | s7 << 20;
  s3 = (s3 + s7 | 0) + m7 | 0;
  s15 ^= s3;
  s15 = s15 >>> 8 | s15 << 24;
  s11 = s11 + s15 | 0;
  s7 ^= s11;
  s7 = s7 >>> 7 | s7 << 25;
  s0 = (s0 + s5 | 0) + m8 | 0;
  s15 ^= s0;
  s15 = s15 >>> 16 | s15 << 16;
  s10 = s10 + s15 | 0;
  s5 ^= s10;
  s5 = s5 >>> 12 | s5 << 20;
  s0 = (s0 + s5 | 0) + m9 | 0;
  s15 ^= s0;
  s15 = s15 >>> 8 | s15 << 24;
  s10 = s10 + s15 | 0;
  s5 ^= s10;
  s5 = s5 >>> 7 | s5 << 25;
  s1 = (s1 + s6 | 0) + m10 | 0;
  s12 ^= s1;
  s12 = s12 >>> 16 | s12 << 16;
  s11 = s11 + s12 | 0;
  s6 ^= s11;
  s6 = s6 >>> 12 | s6 << 20;
  s1 = (s1 + s6 | 0) + m11 | 0;
  s12 ^= s1;
  s12 = s12 >>> 8 | s12 << 24;
  s11 = s11 + s12 | 0;
  s6 ^= s11;
  s6 = s6 >>> 7 | s6 << 25;
  s2 = (s2 + s7 | 0) + m12 | 0;
  s13 ^= s2;
  s13 = s13 >>> 16 | s13 << 16;
  s8 = s8 + s13 | 0;
  s7 ^= s8;
  s7 = s7 >>> 12 | s7 << 20;
  s2 = (s2 + s7 | 0) + m13 | 0;
  s13 ^= s2;
  s13 = s13 >>> 8 | s13 << 24;
  s8 = s8 + s13 | 0;
  s7 ^= s8;
  s7 = s7 >>> 7 | s7 << 25;
  s3 = (s3 + s4 | 0) + m14 | 0;
  s14 ^= s3;
  s14 = s14 >>> 16 | s14 << 16;
  s9 = s9 + s14 | 0;
  s4 ^= s9;
  s4 = s4 >>> 12 | s4 << 20;
  s3 = (s3 + s4 | 0) + m15 | 0;
  s14 ^= s3;
  s14 = s14 >>> 8 | s14 << 24;
  s9 = s9 + s14 | 0;
  s4 ^= s9;
  s4 = s4 >>> 7 | s4 << 25;
  {
    const t0 = m0, t1 = m1;
    m0 = m2;
    m2 = m3;
    m3 = m10;
    m10 = m12;
    m12 = m9;
    m9 = m11;
    m11 = m5;
    m5 = t0;
    m1 = m6;
    m6 = m4;
    m4 = m7;
    m7 = m13;
    m13 = m14;
    m14 = m15;
    m15 = m8;
    m8 = t1;
  }
  s0 = (s0 + s4 | 0) + m0 | 0;
  s12 ^= s0;
  s12 = s12 >>> 16 | s12 << 16;
  s8 = s8 + s12 | 0;
  s4 ^= s8;
  s4 = s4 >>> 12 | s4 << 20;
  s0 = (s0 + s4 | 0) + m1 | 0;
  s12 ^= s0;
  s12 = s12 >>> 8 | s12 << 24;
  s8 = s8 + s12 | 0;
  s4 ^= s8;
  s4 = s4 >>> 7 | s4 << 25;
  s1 = (s1 + s5 | 0) + m2 | 0;
  s13 ^= s1;
  s13 = s13 >>> 16 | s13 << 16;
  s9 = s9 + s13 | 0;
  s5 ^= s9;
  s5 = s5 >>> 12 | s5 << 20;
  s1 = (s1 + s5 | 0) + m3 | 0;
  s13 ^= s1;
  s13 = s13 >>> 8 | s13 << 24;
  s9 = s9 + s13 | 0;
  s5 ^= s9;
  s5 = s5 >>> 7 | s5 << 25;
  s2 = (s2 + s6 | 0) + m4 | 0;
  s14 ^= s2;
  s14 = s14 >>> 16 | s14 << 16;
  s10 = s10 + s14 | 0;
  s6 ^= s10;
  s6 = s6 >>> 12 | s6 << 20;
  s2 = (s2 + s6 | 0) + m5 | 0;
  s14 ^= s2;
  s14 = s14 >>> 8 | s14 << 24;
  s10 = s10 + s14 | 0;
  s6 ^= s10;
  s6 = s6 >>> 7 | s6 << 25;
  s3 = (s3 + s7 | 0) + m6 | 0;
  s15 ^= s3;
  s15 = s15 >>> 16 | s15 << 16;
  s11 = s11 + s15 | 0;
  s7 ^= s11;
  s7 = s7 >>> 12 | s7 << 20;
  s3 = (s3 + s7 | 0) + m7 | 0;
  s15 ^= s3;
  s15 = s15 >>> 8 | s15 << 24;
  s11 = s11 + s15 | 0;
  s7 ^= s11;
  s7 = s7 >>> 7 | s7 << 25;
  s0 = (s0 + s5 | 0) + m8 | 0;
  s15 ^= s0;
  s15 = s15 >>> 16 | s15 << 16;
  s10 = s10 + s15 | 0;
  s5 ^= s10;
  s5 = s5 >>> 12 | s5 << 20;
  s0 = (s0 + s5 | 0) + m9 | 0;
  s15 ^= s0;
  s15 = s15 >>> 8 | s15 << 24;
  s10 = s10 + s15 | 0;
  s5 ^= s10;
  s5 = s5 >>> 7 | s5 << 25;
  s1 = (s1 + s6 | 0) + m10 | 0;
  s12 ^= s1;
  s12 = s12 >>> 16 | s12 << 16;
  s11 = s11 + s12 | 0;
  s6 ^= s11;
  s6 = s6 >>> 12 | s6 << 20;
  s1 = (s1 + s6 | 0) + m11 | 0;
  s12 ^= s1;
  s12 = s12 >>> 8 | s12 << 24;
  s11 = s11 + s12 | 0;
  s6 ^= s11;
  s6 = s6 >>> 7 | s6 << 25;
  s2 = (s2 + s7 | 0) + m12 | 0;
  s13 ^= s2;
  s13 = s13 >>> 16 | s13 << 16;
  s8 = s8 + s13 | 0;
  s7 ^= s8;
  s7 = s7 >>> 12 | s7 << 20;
  s2 = (s2 + s7 | 0) + m13 | 0;
  s13 ^= s2;
  s13 = s13 >>> 8 | s13 << 24;
  s8 = s8 + s13 | 0;
  s7 ^= s8;
  s7 = s7 >>> 7 | s7 << 25;
  s3 = (s3 + s4 | 0) + m14 | 0;
  s14 ^= s3;
  s14 = s14 >>> 16 | s14 << 16;
  s9 = s9 + s14 | 0;
  s4 ^= s9;
  s4 = s4 >>> 12 | s4 << 20;
  s3 = (s3 + s4 | 0) + m15 | 0;
  s14 ^= s3;
  s14 = s14 >>> 8 | s14 << 24;
  s9 = s9 + s14 | 0;
  s4 ^= s9;
  s4 = s4 >>> 7 | s4 << 25;
  {
    const t0 = m0, t1 = m1;
    m0 = m2;
    m2 = m3;
    m3 = m10;
    m10 = m12;
    m12 = m9;
    m9 = m11;
    m11 = m5;
    m5 = t0;
    m1 = m6;
    m6 = m4;
    m4 = m7;
    m7 = m13;
    m13 = m14;
    m14 = m15;
    m15 = m8;
    m8 = t1;
  }
  s0 = (s0 + s4 | 0) + m0 | 0;
  s12 ^= s0;
  s12 = s12 >>> 16 | s12 << 16;
  s8 = s8 + s12 | 0;
  s4 ^= s8;
  s4 = s4 >>> 12 | s4 << 20;
  s0 = (s0 + s4 | 0) + m1 | 0;
  s12 ^= s0;
  s12 = s12 >>> 8 | s12 << 24;
  s8 = s8 + s12 | 0;
  s4 ^= s8;
  s4 = s4 >>> 7 | s4 << 25;
  s1 = (s1 + s5 | 0) + m2 | 0;
  s13 ^= s1;
  s13 = s13 >>> 16 | s13 << 16;
  s9 = s9 + s13 | 0;
  s5 ^= s9;
  s5 = s5 >>> 12 | s5 << 20;
  s1 = (s1 + s5 | 0) + m3 | 0;
  s13 ^= s1;
  s13 = s13 >>> 8 | s13 << 24;
  s9 = s9 + s13 | 0;
  s5 ^= s9;
  s5 = s5 >>> 7 | s5 << 25;
  s2 = (s2 + s6 | 0) + m4 | 0;
  s14 ^= s2;
  s14 = s14 >>> 16 | s14 << 16;
  s10 = s10 + s14 | 0;
  s6 ^= s10;
  s6 = s6 >>> 12 | s6 << 20;
  s2 = (s2 + s6 | 0) + m5 | 0;
  s14 ^= s2;
  s14 = s14 >>> 8 | s14 << 24;
  s10 = s10 + s14 | 0;
  s6 ^= s10;
  s6 = s6 >>> 7 | s6 << 25;
  s3 = (s3 + s7 | 0) + m6 | 0;
  s15 ^= s3;
  s15 = s15 >>> 16 | s15 << 16;
  s11 = s11 + s15 | 0;
  s7 ^= s11;
  s7 = s7 >>> 12 | s7 << 20;
  s3 = (s3 + s7 | 0) + m7 | 0;
  s15 ^= s3;
  s15 = s15 >>> 8 | s15 << 24;
  s11 = s11 + s15 | 0;
  s7 ^= s11;
  s7 = s7 >>> 7 | s7 << 25;
  s0 = (s0 + s5 | 0) + m8 | 0;
  s15 ^= s0;
  s15 = s15 >>> 16 | s15 << 16;
  s10 = s10 + s15 | 0;
  s5 ^= s10;
  s5 = s5 >>> 12 | s5 << 20;
  s0 = (s0 + s5 | 0) + m9 | 0;
  s15 ^= s0;
  s15 = s15 >>> 8 | s15 << 24;
  s10 = s10 + s15 | 0;
  s5 ^= s10;
  s5 = s5 >>> 7 | s5 << 25;
  s1 = (s1 + s6 | 0) + m10 | 0;
  s12 ^= s1;
  s12 = s12 >>> 16 | s12 << 16;
  s11 = s11 + s12 | 0;
  s6 ^= s11;
  s6 = s6 >>> 12 | s6 << 20;
  s1 = (s1 + s6 | 0) + m11 | 0;
  s12 ^= s1;
  s12 = s12 >>> 8 | s12 << 24;
  s11 = s11 + s12 | 0;
  s6 ^= s11;
  s6 = s6 >>> 7 | s6 << 25;
  s2 = (s2 + s7 | 0) + m12 | 0;
  s13 ^= s2;
  s13 = s13 >>> 16 | s13 << 16;
  s8 = s8 + s13 | 0;
  s7 ^= s8;
  s7 = s7 >>> 12 | s7 << 20;
  s2 = (s2 + s7 | 0) + m13 | 0;
  s13 ^= s2;
  s13 = s13 >>> 8 | s13 << 24;
  s8 = s8 + s13 | 0;
  s7 ^= s8;
  s7 = s7 >>> 7 | s7 << 25;
  s3 = (s3 + s4 | 0) + m14 | 0;
  s14 ^= s3;
  s14 = s14 >>> 16 | s14 << 16;
  s9 = s9 + s14 | 0;
  s4 ^= s9;
  s4 = s4 >>> 12 | s4 << 20;
  s3 = (s3 + s4 | 0) + m15 | 0;
  s14 ^= s3;
  s14 = s14 >>> 8 | s14 << 24;
  s9 = s9 + s14 | 0;
  s4 ^= s9;
  s4 = s4 >>> 7 | s4 << 25;
  if (full) {
    out[outOff + 8] = s8 ^ cv[cvOff];
    out[outOff + 9] = s9 ^ cv[cvOff + 1];
    out[outOff + 10] = s10 ^ cv[cvOff + 2];
    out[outOff + 11] = s11 ^ cv[cvOff + 3];
    out[outOff + 12] = s12 ^ cv[cvOff + 4];
    out[outOff + 13] = s13 ^ cv[cvOff + 5];
    out[outOff + 14] = s14 ^ cv[cvOff + 6];
    out[outOff + 15] = s15 ^ cv[cvOff + 7];
  }
  out[outOff] = s0 ^ s8;
  out[outOff + 1] = s1 ^ s9;
  out[outOff + 2] = s2 ^ s10;
  out[outOff + 3] = s3 ^ s11;
  out[outOff + 4] = s4 ^ s12;
  out[outOff + 5] = s5 ^ s13;
  out[outOff + 6] = s6 ^ s14;
  out[outOff + 7] = s7 ^ s15;
}

// ../../../hf-oauth-build-pRp19k/node_modules/@huggingface/blake3-jit/dist/esm/constants.js
var IV = new Uint32Array([
  1779033703,
  3144134277,
  1013904242,
  2773480762,
  1359893119,
  2600822924,
  528734635,
  1541459225
]);
var CHUNK_START = 1;
var CHUNK_END = 1 << 1;
var PARENT = 1 << 2;
var ROOT = 1 << 3;
var KEYED_HASH = 1 << 4;
var DERIVE_KEY_CONTEXT = 1 << 5;
var DERIVE_KEY_MATERIAL = 1 << 6;
var OUT_LEN = 32;
var KEY_LEN = 32;
var BLOCK_LEN = 64;
var CHUNK_LEN = 1024;
var MAX_DEPTH = 54;
var PERMUTATIONS = new Uint8Array([
  0,
  1,
  2,
  3,
  4,
  5,
  6,
  7,
  8,
  9,
  10,
  11,
  12,
  13,
  14,
  15,
  2,
  6,
  3,
  10,
  7,
  0,
  4,
  13,
  1,
  11,
  12,
  5,
  9,
  14,
  15,
  8,
  3,
  4,
  10,
  12,
  13,
  2,
  7,
  14,
  6,
  5,
  9,
  0,
  11,
  15,
  8,
  1,
  10,
  7,
  12,
  9,
  14,
  3,
  13,
  15,
  4,
  0,
  11,
  2,
  5,
  8,
  1,
  6,
  12,
  13,
  9,
  11,
  15,
  10,
  14,
  8,
  7,
  2,
  5,
  3,
  0,
  1,
  6,
  4,
  9,
  14,
  11,
  5,
  8,
  12,
  15,
  1,
  13,
  3,
  0,
  10,
  2,
  6,
  4,
  7,
  11,
  15,
  5,
  0,
  1,
  9,
  8,
  6,
  14,
  10,
  2,
  12,
  3,
  4,
  7,
  13
]);

// ../../../hf-oauth-build-pRp19k/node_modules/@huggingface/blake3-jit/dist/esm/utils.js
var IS_LITTLE_ENDIAN = new Uint8Array(new Uint32Array([16909060]).buffer)[0] === 4;
function readLittleEndianWordsFull(input, offset, words) {
  for (let i = 0; i < 16; ++i, offset += 4) {
    words[i] = input[offset] | input[offset + 1] << 8 | input[offset + 2] << 16 | input[offset + 3] << 24;
  }
}
function writeLittleEndianBytesPartial(words, wordOffset, output, byteOffset, byteCount) {
  const fullWords = byteCount >>> 2;
  let i = 0;
  for (; i < fullWords; ++i, byteOffset += 4) {
    const w = words[wordOffset + i];
    output[byteOffset] = w & 255;
    output[byteOffset + 1] = w >>> 8 & 255;
    output[byteOffset + 2] = w >>> 16 & 255;
    output[byteOffset + 3] = w >>> 24 & 255;
  }
  const remaining = byteCount & 3;
  if (remaining > 0) {
    const w = words[wordOffset + i];
    output[byteOffset] = w & 255;
    if (remaining > 1)
      output[byteOffset + 1] = w >>> 8 & 255;
    if (remaining > 2)
      output[byteOffset + 2] = w >>> 16 & 255;
  }
}
function encodeUTF8(str) {
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(str);
  }
  const bytes = [];
  for (let i = 0; i < str.length; i++) {
    let c = str.charCodeAt(i);
    if (c < 128) {
      bytes.push(c);
    } else if (c < 2048) {
      bytes.push(192 | c >> 6, 128 | c & 63);
    } else if (c < 55296 || c >= 57344) {
      bytes.push(224 | c >> 12, 128 | c >> 6 & 63, 128 | c & 63);
    } else {
      i++;
      c = 65536 + ((c & 1023) << 10 | str.charCodeAt(i) & 1023);
      bytes.push(240 | c >> 18, 128 | c >> 12 & 63, 128 | c >> 6 & 63, 128 | c & 63);
    }
  }
  return new Uint8Array(bytes);
}
var CTZ32_TABLE = new Uint8Array([
  0,
  1,
  28,
  2,
  29,
  14,
  24,
  3,
  30,
  22,
  20,
  15,
  25,
  17,
  4,
  8,
  31,
  27,
  13,
  23,
  21,
  19,
  16,
  7,
  26,
  12,
  18,
  6,
  11,
  5,
  10,
  9
]);

// ../../../hf-oauth-build-pRp19k/node_modules/@huggingface/blake3-jit/dist/esm/hasher.js
var XofReader = class {
  inputCv;
  blockWords;
  counter;
  blockLen;
  flags;
  outputBlock;
  outputBlockOffset;
  constructor(inputCv, blockWords, counter, blockLen, flags) {
    this.inputCv = inputCv;
    this.blockWords = blockWords;
    this.counter = counter;
    this.blockLen = blockLen;
    this.flags = flags | ROOT;
    this.outputBlock = new Uint32Array(16);
    this.outputBlockOffset = 64;
  }
  /**
   * Read the next `length` bytes of output.
   */
  read(length) {
    const output = new Uint8Array(length);
    let outputOffset = 0;
    while (outputOffset < length) {
      if (this.outputBlockOffset >= 64) {
        compress(
          this.inputCv,
          0,
          this.blockWords,
          0,
          this.outputBlock,
          0,
          true,
          // full 64-byte output
          this.counter++,
          this.blockLen,
          this.flags
        );
        this.outputBlockOffset = 0;
      }
      const available = 64 - this.outputBlockOffset;
      const toCopy = Math.min(available, length - outputOffset);
      const wordOffset = this.outputBlockOffset >>> 2;
      const byteWithinWord = this.outputBlockOffset & 3;
      if (byteWithinWord === 0 && toCopy >= 4) {
        const fullWords = toCopy >>> 2;
        writeLittleEndianBytesPartial(this.outputBlock, wordOffset, output, outputOffset, fullWords << 2);
        const bytesCopied = fullWords << 2;
        outputOffset += bytesCopied;
        this.outputBlockOffset += bytesCopied;
      } else {
        for (let i = 0; i < toCopy; i++) {
          const wordIdx = this.outputBlockOffset + i >>> 2;
          const byteIdx = this.outputBlockOffset + i & 3;
          output[outputOffset + i] = this.outputBlock[wordIdx] >>> (byteIdx << 3) & 255;
        }
        outputOffset += toCopy;
        this.outputBlockOffset += toCopy;
      }
    }
    return output;
  }
};
var ChunkState = class {
  chainingValue;
  chunkCounter;
  blockWords;
  blockLen;
  blocksCompressed;
  flags;
  constructor(keyWords, chunkCounter, flags) {
    this.chainingValue = new Uint32Array(keyWords);
    this.chunkCounter = chunkCounter;
    this.blockWords = new Uint32Array(16);
    this.blockLen = 0;
    this.blocksCompressed = 0;
    this.flags = flags;
  }
  resetTo(keyWords, chunkCounter, flags) {
    this.chainingValue.set(keyWords);
    this.chunkCounter = chunkCounter;
    this.blockLen = 0;
    this.blocksCompressed = 0;
    this.flags = flags;
  }
  /**
   * Get the flags for the current block.
   */
  startFlag() {
    return this.blocksCompressed === 0 ? CHUNK_START : 0;
  }
  /**
   * Update the chunk state with input data.
   * Returns the number of bytes consumed.
   */
  update(input, inputOffset, inputLen) {
    let consumed = 0;
    while (inputLen > 0) {
      if (this.blockLen === BLOCK_LEN) {
        compress(this.chainingValue, 0, this.blockWords, 0, this.chainingValue, 0, false, this.chunkCounter, BLOCK_LEN, this.flags | this.startFlag());
        this.blocksCompressed++;
        this.blockLen = 0;
      }
      const want = BLOCK_LEN - this.blockLen;
      const take = Math.min(want, inputLen);
      if (this.blockLen === 0 && take === BLOCK_LEN) {
        readLittleEndianWordsFull(input, inputOffset, this.blockWords);
      } else {
        for (let i = 0; i < take; i++) {
          const pos = this.blockLen + i;
          const wordIdx = pos >>> 2;
          const byteIdx = pos & 3;
          if (byteIdx === 0) {
            this.blockWords[wordIdx] = input[inputOffset + i];
          } else {
            this.blockWords[wordIdx] |= input[inputOffset + i] << (byteIdx << 3);
          }
        }
      }
      this.blockLen += take;
      inputOffset += take;
      inputLen -= take;
      consumed += take;
    }
    return consumed;
  }
  /**
   * Finalize this chunk and return its output.
   * Returns 8 words (chaining value) or 16 words (if root).
   */
  output() {
    const usedWords = this.blockLen + 3 >>> 2;
    for (let i = usedWords; i < 16; i++) {
      this.blockWords[i] = 0;
    }
    return {
      inputCv: this.chainingValue,
      blockWords: this.blockWords,
      blockLen: this.blockLen,
      counter: this.chunkCounter,
      flags: this.flags | this.startFlag() | CHUNK_END
    };
  }
  /**
   * Get the number of bytes in this chunk.
   */
  len() {
    return this.blocksCompressed * BLOCK_LEN + this.blockLen;
  }
};
var Hasher = class _Hasher {
  chunkState;
  keyWords;
  cvStack;
  cvStackLen;
  flags;
  parentBlock;
  parentCv;
  chunkCv;
  outWords;
  finalizeCv;
  /**
   * Create a new Hasher.
   *
   * @param keyWords - Initial key words (IV for regular hashing)
   * @param flags - Domain separation flags
   */
  constructor(keyWords, flags) {
    this.keyWords = keyWords ? new Uint32Array(keyWords) : new Uint32Array(IV);
    this.flags = flags ?? 0;
    this.chunkState = new ChunkState(this.keyWords, 0, this.flags);
    this.cvStack = new Uint32Array(MAX_DEPTH * 8);
    this.cvStackLen = 0;
    this.parentBlock = new Uint32Array(16);
    this.parentCv = new Uint32Array(8);
    this.chunkCv = new Uint32Array(8);
    this.outWords = new Uint32Array(16);
    this.finalizeCv = new Uint32Array(8);
  }
  /**
   * Reset the hasher to process a new message with the same key/flags.
   * Reuses all internal buffers — zero allocations.
   */
  reset() {
    this.chunkState.resetTo(this.keyWords, 0, this.flags);
    this.cvStackLen = 0;
    return this;
  }
  /**
   * Create a new keyed hasher (MAC).
   *
   * @param key - 32-byte key
   */
  static newKeyed(key) {
    if (key.length !== KEY_LEN) {
      throw new Error(`Key must be ${KEY_LEN} bytes, got ${key.length}`);
    }
    const keyWords = new Uint32Array(8);
    if (IS_LITTLE_ENDIAN) {
      const view = new Uint32Array(key.buffer, key.byteOffset, 8);
      keyWords.set(view);
    } else {
      for (let i = 0; i < 8; i++) {
        const off = i * 4;
        keyWords[i] = key[off] | key[off + 1] << 8 | key[off + 2] << 16 | key[off + 3] << 24;
      }
    }
    return new _Hasher(keyWords, KEYED_HASH);
  }
  /**
   * Create a new key derivation hasher.
   *
   * @param context - Context string for domain separation
   */
  static newDeriveKey(context) {
    const contextBytes = encodeUTF8(context);
    const contextHasher = new _Hasher(new Uint32Array(IV), DERIVE_KEY_CONTEXT);
    contextHasher.update(contextBytes);
    const contextKey = new Uint32Array(8);
    const output = contextHasher.finalizeOutput();
    compress(output.inputCv, 0, output.blockWords, 0, contextKey, 0, false, output.counter, output.blockLen, output.flags | ROOT);
    return new _Hasher(contextKey, DERIVE_KEY_MATERIAL);
  }
  /**
   * Push a chaining value onto the stack.
   */
  pushCv(cv, cvOffset) {
    this.cvStack.set(cv.subarray(cvOffset, cvOffset + 8), this.cvStackLen * 8);
    this.cvStackLen++;
  }
  /**
   * Pop a chaining value from the stack.
   */
  popCv(out, outOffset) {
    this.cvStackLen--;
    out.set(this.cvStack.subarray(this.cvStackLen * 8, (this.cvStackLen + 1) * 8), outOffset);
  }
  /**
   * Add a chunk's chaining value and merge completed subtrees.
   */
  addChunkCv(newCv, newCvOffset, totalChunks) {
    const parentBlock = this.parentBlock;
    const parentCv = this.parentCv;
    while ((totalChunks & 1) === 0) {
      this.popCv(parentBlock, 0);
      parentBlock.set(newCv.subarray(newCvOffset, newCvOffset + 8), 8);
      compress(this.keyWords, 0, parentBlock, 0, parentCv, 0, false, 0, BLOCK_LEN, this.flags | PARENT);
      newCv = parentCv;
      newCvOffset = 0;
      totalChunks >>>= 1;
    }
    this.pushCv(newCv, newCvOffset);
  }
  /**
   * Update the hasher with input data.
   *
   * @param input - Data to hash
   * @returns this (for chaining)
   */
  update(input) {
    let inputOffset = 0;
    let inputLen = input.length;
    while (inputLen > 0) {
      if (this.chunkState.len() === CHUNK_LEN) {
        const output = this.chunkState.output();
        const chunkCv = this.chunkCv;
        compress(output.inputCv, 0, output.blockWords, 0, chunkCv, 0, false, output.counter, output.blockLen, output.flags);
        const totalChunks = this.chunkState.chunkCounter + 1;
        this.addChunkCv(chunkCv, 0, totalChunks);
        this.chunkState.resetTo(this.keyWords, totalChunks, this.flags);
      }
      const want = CHUNK_LEN - this.chunkState.len();
      const take = Math.min(want, inputLen);
      this.chunkState.update(input, inputOffset, take);
      inputOffset += take;
      inputLen -= take;
    }
    return this;
  }
  /**
   * Get the output parameters (for XOF mode or finalization).
   */
  finalizeOutput() {
    let output = this.chunkState.output();
    let parentBlock = this.parentBlock;
    let cv = this.finalizeCv;
    if (this.cvStackLen > 0) {
      compress(output.inputCv, 0, output.blockWords, 0, cv, 0, false, output.counter, output.blockLen, output.flags);
      while (this.cvStackLen > 0) {
        this.cvStackLen--;
        parentBlock.set(this.cvStack.subarray(this.cvStackLen * 8, (this.cvStackLen + 1) * 8), 0);
        parentBlock.set(cv, 8);
        if (this.cvStackLen > 0) {
          compress(this.keyWords, 0, parentBlock, 0, cv, 0, false, 0, BLOCK_LEN, this.flags | PARENT);
        } else {
          return {
            inputCv: this.keyWords,
            blockWords: parentBlock,
            blockLen: BLOCK_LEN,
            counter: 0,
            flags: this.flags | PARENT
          };
        }
      }
    }
    return output;
  }
  /**
   * Finalize the hash and return the result.
   *
   * @param outputLength - Number of bytes to output (default: 32)
   * @returns The hash output
   */
  finalize(outputLength = OUT_LEN) {
    const output = this.finalizeOutput();
    const result = new Uint8Array(outputLength);
    if (outputLength <= 64) {
      const outWords = this.outWords;
      compress(
        output.inputCv,
        0,
        output.blockWords,
        0,
        outWords,
        0,
        outputLength > 32,
        // full output if > 32 bytes
        output.counter,
        output.blockLen,
        output.flags | ROOT
      );
      if (IS_LITTLE_ENDIAN) {
        const outBytes = new Uint8Array(outWords.buffer);
        result.set(outBytes.subarray(0, outputLength));
      } else {
        writeLittleEndianBytesPartial(outWords, 0, result, 0, outputLength);
      }
    } else {
      const xof = this.finalizeXof();
      const full = xof.read(outputLength);
      result.set(full);
    }
    return result;
  }
  /**
   * Finalize and return an XOF reader for arbitrary-length output.
   */
  finalizeXof() {
    const output = this.finalizeOutput();
    return new XofReader(new Uint32Array(output.inputCv), new Uint32Array(output.blockWords), output.counter, output.blockLen, output.flags);
  }
};

// ../../../hf-oauth-build-pRp19k/node_modules/@huggingface/blake3-jit/dist/esm/wasm-simd.js
function toLebU32Min2(n) {
  return [n & 127 | 128, n >>> 7 & 127];
}
function toLebU32Padded5(n) {
  return [
    n & 127 | 128,
    n >>> 7 & 127 | 128,
    n >>> 14 & 127 | 128,
    n >>> 21 & 127 | 128,
    n >>> 28 & 15
    // Last byte has no continuation bit
  ];
}
function toSignedLeb128_i32(n) {
  const bytes = [];
  let value = n | 0;
  let more = true;
  while (more) {
    let byte = value & 127;
    value >>= 7;
    if (value === 0 && (byte & 64) === 0 || value === -1 && (byte & 64) !== 0) {
      more = false;
    } else {
      byte |= 128;
    }
    bytes.push(byte);
  }
  return bytes;
}
var MSG_ACCESS_ORDER = [
  // Round 1: 0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15
  0,
  1,
  2,
  3,
  4,
  5,
  6,
  7,
  8,
  9,
  10,
  11,
  12,
  13,
  14,
  15,
  // Round 2: 2,6,3,10,7,0,4,13,1,11,12,5,9,14,15,8
  2,
  6,
  3,
  10,
  7,
  0,
  4,
  13,
  1,
  11,
  12,
  5,
  9,
  14,
  15,
  8,
  // Round 3: 3,4,10,12,13,2,7,14,6,5,9,0,11,15,8,1
  3,
  4,
  10,
  12,
  13,
  2,
  7,
  14,
  6,
  5,
  9,
  0,
  11,
  15,
  8,
  1,
  // Round 4: 10,7,12,9,14,3,13,15,4,0,11,2,5,8,1,6
  10,
  7,
  12,
  9,
  14,
  3,
  13,
  15,
  4,
  0,
  11,
  2,
  5,
  8,
  1,
  6,
  // Round 5: 12,13,9,11,15,10,14,8,7,2,5,3,0,1,6,4
  12,
  13,
  9,
  11,
  15,
  10,
  14,
  8,
  7,
  2,
  5,
  3,
  0,
  1,
  6,
  4,
  // Round 6: 9,14,11,5,8,12,15,1,13,3,0,10,2,6,4,7
  9,
  14,
  11,
  5,
  8,
  12,
  15,
  1,
  13,
  3,
  0,
  10,
  2,
  6,
  4,
  7,
  // Round 7: 11,15,5,0,1,9,8,6,14,10,2,12,3,4,7,13
  11,
  15,
  5,
  0,
  1,
  9,
  8,
  6,
  14,
  10,
  2,
  12,
  3,
  4,
  7,
  13
];
function generateWasmBytes() {
  const code = [];
  function put(bytes) {
    code.push(...bytes);
  }
  put([0, 97, 115, 109]);
  put([1, 0, 0, 0]);
  put([1]);
  put([4]);
  put([1]);
  put([96, 0, 0]);
  put([2]);
  put([11]);
  put([1]);
  put([2, 106, 115]);
  put([3, 109, 101, 109]);
  put([2, 0, 1]);
  put([3]);
  put([4]);
  put([3]);
  put([0]);
  put([0]);
  put([0]);
  put([7]);
  put([50]);
  put([3]);
  put([10]);
  put([99, 111, 109, 112, 114, 101, 115, 115, 52, 120]);
  put([0, 0]);
  put([16]);
  put([
    99,
    111,
    109,
    112,
    114,
    101,
    115,
    115,
    67,
    104,
    117,
    110,
    107,
    115,
    52,
    120
  ]);
  put([0, 1]);
  put([14]);
  put([99, 111, 109, 112, 114, 101, 115, 115, 80, 97, 114, 101, 110, 116]);
  put([0, 2]);
  put([10]);
  const sectionSizeOffset = code.length;
  put([0, 0, 0, 0, 0]);
  put([3]);
  const funcSizeOffset = code.length;
  put([0, 0, 0, 0, 0]);
  const funcBodyStart = code.length;
  put([1]);
  put([32, 123]);
  for (let i = 0; i < 16; i++) {
    put([65, ...toLebU32Min2(i * 16)]);
    put([253, 0, 2, 0]);
    put([33, i]);
  }
  for (let i = 0; i < 8; i++) {
    put([65, ...toLebU32Min2(512 + i * 16)]);
    put([253, 0, 2, 0]);
    put([33, 16 + i]);
  }
  const IV2 = [1779033703, 3144134277, 1013904242, 2773480762];
  for (let i = 0; i < 4; i++) {
    const ivBytes = [];
    for (let j = 0; j < 4; j++) {
      ivBytes.push(IV2[i] & 255);
      ivBytes.push(IV2[i] >>> 8 & 255);
      ivBytes.push(IV2[i] >>> 16 & 255);
      ivBytes.push(IV2[i] >>> 24 & 255);
    }
    put([253, 12, ...ivBytes]);
    put([33, 24 + i]);
  }
  put([65, ...toLebU32Min2(768)]);
  put([253, 0, 2, 0]);
  put([33, 28]);
  put([65, ...toLebU32Min2(784)]);
  put([253, 0, 2, 0]);
  put([33, 29]);
  put([65, ...toLebU32Min2(800)]);
  put([253, 0, 2, 0]);
  put([33, 30]);
  put([65, ...toLebU32Min2(816)]);
  put([253, 0, 2, 0]);
  put([33, 31]);
  let msgIdx = 0;
  function g(a, b, c, d) {
    const mx = MSG_ACCESS_ORDER[msgIdx++];
    const my = MSG_ACCESS_ORDER[msgIdx++];
    put([32, 16 + a]);
    put([32, 16 + b]);
    put([253, 174, 1]);
    put([32, mx]);
    put([253, 174, 1]);
    put([33, 16 + a]);
    put([32, 16 + d]);
    put([32, 16 + a]);
    put([253, 81]);
    put([34, 16 + d]);
    put([32, 16 + d]);
    put([253, 13, 2, 3, 0, 1, 6, 7, 4, 5, 10, 11, 8, 9, 14, 15, 12, 13]);
    put([33, 16 + d]);
    put([32, 16 + c]);
    put([32, 16 + d]);
    put([253, 174, 1]);
    put([33, 16 + c]);
    put([32, 16 + b]);
    put([32, 16 + c]);
    put([253, 81]);
    put([34, 16 + b]);
    put([65, 12]);
    put([253, 173, 1]);
    put([32, 16 + b]);
    put([65, 20]);
    put([253, 171, 1]);
    put([253, 80]);
    put([33, 16 + b]);
    put([32, 16 + a]);
    put([32, 16 + b]);
    put([253, 174, 1]);
    put([32, my]);
    put([253, 174, 1]);
    put([33, 16 + a]);
    put([32, 16 + d]);
    put([32, 16 + a]);
    put([253, 81]);
    put([34, 16 + d]);
    put([32, 16 + d]);
    put([253, 13, 1, 2, 3, 0, 5, 6, 7, 4, 9, 10, 11, 8, 13, 14, 15, 12]);
    put([33, 16 + d]);
    put([32, 16 + c]);
    put([32, 16 + d]);
    put([253, 174, 1]);
    put([33, 16 + c]);
    put([32, 16 + b]);
    put([32, 16 + c]);
    put([253, 81]);
    put([34, 16 + b]);
    put([65, 7]);
    put([253, 173, 1]);
    put([32, 16 + b]);
    put([65, 25]);
    put([253, 171, 1]);
    put([253, 80]);
    put([33, 16 + b]);
  }
  for (let round = 0; round < 7; round++) {
    g(0, 4, 8, 12);
    g(1, 5, 9, 13);
    g(2, 6, 10, 14);
    g(3, 7, 11, 15);
    g(0, 5, 10, 15);
    g(1, 6, 11, 12);
    g(2, 7, 8, 13);
    g(3, 4, 9, 14);
  }
  for (let i = 0; i < 8; i++) {
    put([65, ...toLebU32Min2(640 + i * 16)]);
    put([32, 16 + i]);
    put([32, 24 + i]);
    put([253, 81]);
    put([253, 11, 2, 0]);
  }
  put([11]);
  const funcBodySize = code.length - funcBodyStart;
  const funcSizeBytes = toLebU32Padded5(funcBodySize);
  for (let i = 0; i < 5; i++) {
    code[funcSizeOffset + i] = funcSizeBytes[i];
  }
  const func1SizeOffset = code.length;
  put([0, 0, 0, 0, 0]);
  const func1BodyStart = code.length;
  const compressChunksBody = generateCompressChunks4xBody();
  put(compressChunksBody);
  const func1BodySize = code.length - func1BodyStart;
  const func1SizeBytes = toLebU32Padded5(func1BodySize);
  for (let i = 0; i < 5; i++) {
    code[func1SizeOffset + i] = func1SizeBytes[i];
  }
  const func2SizeOffset = code.length;
  put([0, 0, 0, 0, 0]);
  const func2BodyStart = code.length;
  const compressParentBody = generateCompressParentBody();
  put(compressParentBody);
  const func2BodySize = code.length - func2BodyStart;
  const func2SizeBytes = toLebU32Padded5(func2BodySize);
  for (let i = 0; i < 5; i++) {
    code[func2SizeOffset + i] = func2SizeBytes[i];
  }
  const sectionSize = code.length - sectionSizeOffset - 5;
  const sectionSizeBytes = toLebU32Padded5(sectionSize);
  for (let i = 0; i < 5; i++) {
    code[sectionSizeOffset + i] = sectionSizeBytes[i];
  }
  return new Uint8Array(code);
}
function generateCompressChunks4xBody() {
  const code = [];
  function put(bytes) {
    code.push(...bytes);
  }
  put([2]);
  put([32, 123]);
  put([1, 127]);
  const BATCH_BLOCK_WORDS = SIMD_MEMORY.BATCH_BLOCK_WORDS;
  const BATCH_CV = SIMD_MEMORY.BATCH_CV;
  const BATCH_COUNTER_LOW = SIMD_MEMORY.BATCH_COUNTER_LOW;
  const BATCH_FLAGS_BASE = SIMD_MEMORY.BATCH_FLAGS_BASE;
  const BATCH_OUTPUT = SIMD_MEMORY.BATCH_OUTPUT;
  const IV2 = [1779033703, 3144134277, 1013904242, 2773480762];
  for (let i = 0; i < 8; i++) {
    put([65, ...toLebU32Min2(BATCH_CV + i * 16)]);
    put([253, 0, 2, 0]);
    put([33, 16 + i]);
  }
  put([65, 0]);
  put([33, 32]);
  put([2, 64]);
  put([3, 64]);
  for (let w = 0; w < 16; w++) {
    put([32, 32]);
    put([65, ...toLebU32Min2(256)]);
    put([108]);
    put([65, ...toLebU32Min2(BATCH_BLOCK_WORDS + w * 16)]);
    put([106]);
    put([253, 0, 2, 0]);
    put([33, w]);
  }
  for (let i = 0; i < 4; i++) {
    const ivBytes = [];
    for (let j = 0; j < 4; j++) {
      ivBytes.push(IV2[i] & 255);
      ivBytes.push(IV2[i] >>> 8 & 255);
      ivBytes.push(IV2[i] >>> 16 & 255);
      ivBytes.push(IV2[i] >>> 24 & 255);
    }
    put([253, 12, ...ivBytes]);
    put([33, 24 + i]);
  }
  put([65, ...toLebU32Min2(BATCH_COUNTER_LOW)]);
  put([253, 0, 2, 0]);
  put([33, 28]);
  put([253, 12, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  put([33, 29]);
  const blockLen64 = [];
  for (let j = 0; j < 4; j++) {
    blockLen64.push(64, 0, 0, 0);
  }
  put([253, 12, ...blockLen64]);
  put([33, 30]);
  put([65, ...toLebU32Min2(BATCH_FLAGS_BASE)]);
  put([253, 0, 2, 0]);
  put([32, 32]);
  put([69]);
  put([32, 32]);
  put([65, 15]);
  put([70]);
  put([65, 1]);
  put([116]);
  put([114]);
  put([253, 17]);
  put([253, 80]);
  put([33, 31]);
  let msgIdx = 0;
  function g(a, b, c, d) {
    const mx = MSG_ACCESS_ORDER[msgIdx++];
    const my = MSG_ACCESS_ORDER[msgIdx++];
    put([32, 16 + a]);
    put([32, 16 + b]);
    put([253, 174, 1]);
    put([32, mx]);
    put([253, 174, 1]);
    put([33, 16 + a]);
    put([32, 16 + d]);
    put([32, 16 + a]);
    put([253, 81]);
    put([34, 16 + d]);
    put([32, 16 + d]);
    put([253, 13, 2, 3, 0, 1, 6, 7, 4, 5, 10, 11, 8, 9, 14, 15, 12, 13]);
    put([33, 16 + d]);
    put([32, 16 + c]);
    put([32, 16 + d]);
    put([253, 174, 1]);
    put([33, 16 + c]);
    put([32, 16 + b]);
    put([32, 16 + c]);
    put([253, 81]);
    put([34, 16 + b]);
    put([65, 12]);
    put([253, 173, 1]);
    put([32, 16 + b]);
    put([65, 20]);
    put([253, 171, 1]);
    put([253, 80]);
    put([33, 16 + b]);
    put([32, 16 + a]);
    put([32, 16 + b]);
    put([253, 174, 1]);
    put([32, my]);
    put([253, 174, 1]);
    put([33, 16 + a]);
    put([32, 16 + d]);
    put([32, 16 + a]);
    put([253, 81]);
    put([34, 16 + d]);
    put([32, 16 + d]);
    put([253, 13, 1, 2, 3, 0, 5, 6, 7, 4, 9, 10, 11, 8, 13, 14, 15, 12]);
    put([33, 16 + d]);
    put([32, 16 + c]);
    put([32, 16 + d]);
    put([253, 174, 1]);
    put([33, 16 + c]);
    put([32, 16 + b]);
    put([32, 16 + c]);
    put([253, 81]);
    put([34, 16 + b]);
    put([65, 7]);
    put([253, 173, 1]);
    put([32, 16 + b]);
    put([65, 25]);
    put([253, 171, 1]);
    put([253, 80]);
    put([33, 16 + b]);
  }
  for (let round = 0; round < 7; round++) {
    g(0, 4, 8, 12);
    g(1, 5, 9, 13);
    g(2, 6, 10, 14);
    g(3, 7, 11, 15);
    g(0, 5, 10, 15);
    g(1, 6, 11, 12);
    g(2, 7, 8, 13);
    g(3, 4, 9, 14);
  }
  for (let i = 0; i < 8; i++) {
    put([32, 16 + i]);
    put([32, 24 + i]);
    put([253, 81]);
    put([33, 16 + i]);
  }
  put([32, 32]);
  put([65, 1]);
  put([106]);
  put([34, 32]);
  put([65, 16]);
  put([73]);
  put([13, 0]);
  put([11]);
  put([11]);
  for (let i = 0; i < 8; i++) {
    put([65, ...toLebU32Min2(BATCH_OUTPUT + i * 16)]);
    put([32, 16 + i]);
    put([253, 11, 2, 0]);
  }
  put([11]);
  return code;
}
function generateCompressParentBody() {
  const code = [];
  function put(bytes) {
    code.push(...bytes);
  }
  put([1]);
  put([32, 127]);
  const PARENT_BLOCK_OFFSET = SIMD_MEMORY.PARENT_BLOCK;
  const CHUNK_CV_OFFSET = SIMD_MEMORY.CHUNK_CV;
  const IV2 = [
    1779033703,
    3144134277,
    1013904242,
    2773480762,
    1359893119,
    2600822924,
    528734635,
    1541459225
  ];
  for (let i = 0; i < 16; i++) {
    put([65, ...toLebU32Min2(PARENT_BLOCK_OFFSET + i * 4)]);
    put([40, 2, 0]);
    put([33, i]);
  }
  for (let i = 0; i < 8; i++) {
    put([65, ...toSignedLeb128_i32(IV2[i])]);
    put([33, 16 + i]);
  }
  for (let i = 0; i < 4; i++) {
    put([65, ...toSignedLeb128_i32(IV2[i])]);
    put([33, 24 + i]);
  }
  put([65, 0]);
  put([33, 28]);
  put([65, 0]);
  put([33, 29]);
  put([65, 192, 0]);
  put([33, 30]);
  put([65, 4]);
  put([33, 31]);
  function g(a, b, c, d, mx, my) {
    const sa = 16 + a, sb = 16 + b, sc = 16 + c, sd = 16 + d;
    put([32, sa]);
    put([32, sb]);
    put([106]);
    put([32, mx]);
    put([106]);
    put([33, sa]);
    put([32, sd]);
    put([32, sa]);
    put([115]);
    put([65, 16]);
    put([120]);
    put([33, sd]);
    put([32, sc]);
    put([32, sd]);
    put([106]);
    put([33, sc]);
    put([32, sb]);
    put([32, sc]);
    put([115]);
    put([65, 12]);
    put([120]);
    put([33, sb]);
    put([32, sa]);
    put([32, sb]);
    put([106]);
    put([32, my]);
    put([106]);
    put([33, sa]);
    put([32, sd]);
    put([32, sa]);
    put([115]);
    put([65, 8]);
    put([120]);
    put([33, sd]);
    put([32, sc]);
    put([32, sd]);
    put([106]);
    put([33, sc]);
    put([32, sb]);
    put([32, sc]);
    put([115]);
    put([65, 7]);
    put([120]);
    put([33, sb]);
  }
  let msgIdx = 0;
  for (let round = 0; round < 7; round++) {
    g(0, 4, 8, 12, MSG_ACCESS_ORDER[msgIdx], MSG_ACCESS_ORDER[msgIdx + 1]);
    msgIdx += 2;
    g(1, 5, 9, 13, MSG_ACCESS_ORDER[msgIdx], MSG_ACCESS_ORDER[msgIdx + 1]);
    msgIdx += 2;
    g(2, 6, 10, 14, MSG_ACCESS_ORDER[msgIdx], MSG_ACCESS_ORDER[msgIdx + 1]);
    msgIdx += 2;
    g(3, 7, 11, 15, MSG_ACCESS_ORDER[msgIdx], MSG_ACCESS_ORDER[msgIdx + 1]);
    msgIdx += 2;
    g(0, 5, 10, 15, MSG_ACCESS_ORDER[msgIdx], MSG_ACCESS_ORDER[msgIdx + 1]);
    msgIdx += 2;
    g(1, 6, 11, 12, MSG_ACCESS_ORDER[msgIdx], MSG_ACCESS_ORDER[msgIdx + 1]);
    msgIdx += 2;
    g(2, 7, 8, 13, MSG_ACCESS_ORDER[msgIdx], MSG_ACCESS_ORDER[msgIdx + 1]);
    msgIdx += 2;
    g(3, 4, 9, 14, MSG_ACCESS_ORDER[msgIdx], MSG_ACCESS_ORDER[msgIdx + 1]);
    msgIdx += 2;
  }
  for (let i = 0; i < 8; i++) {
    put([65, ...toLebU32Min2(CHUNK_CV_OFFSET + i * 4)]);
    put([32, 16 + i]);
    put([32, 24 + i]);
    put([115]);
    put([54, 2, 0]);
  }
  put([11]);
  return code;
}
var wasmInstance = null;
var wasmMemory = null;
var wasmCompress4x = null;
var wasmCompressChunks4x = null;
var wasmCompressParent = null;
var wasmMemoryView = null;
var wasmMemoryView32 = null;
function isSimdSupported() {
  try {
    const simdTest = new Uint8Array([
      0,
      97,
      115,
      109,
      // magic: \0asm
      1,
      0,
      0,
      0,
      // version: 1
      // Type section (id=1): () -> v128
      1,
      // section id = 1 (type)
      5,
      // section length = 5
      1,
      // 1 type
      96,
      0,
      1,
      123,
      // func () -> v128
      // Function section (id=3)
      3,
      // section id = 3 (function)
      2,
      // section length = 2
      1,
      // 1 function
      0,
      // type index 0
      // Code section (id=10) with v128.const
      10,
      // section id = 10 (code)
      22,
      // section length = 22
      1,
      // 1 function body
      20,
      // body length = 20
      0,
      // 0 locals
      253,
      12,
      // v128.const opcode
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      11
      // end
    ]);
    return WebAssembly.validate(simdTest);
  } catch {
    return false;
  }
}
function setupArenaViews() {
  if (!wasmMemory)
    return;
  const buffer = wasmMemory.buffer;
  arenaCvStack = new Uint32Array(buffer, SIMD_MEMORY.CV_STACK, 64 * 8);
  arenaParentBlock = new Uint32Array(buffer, SIMD_MEMORY.PARENT_BLOCK, 16);
  arenaChunkCv = new Uint32Array(buffer, SIMD_MEMORY.CHUNK_CV, 8);
  arenaTempCvs = new Uint32Array(buffer, SIMD_MEMORY.TEMP_CVS, 32);
  arenaBatchBlockWords = new Uint32Array(buffer, SIMD_MEMORY.BATCH_BLOCK_WORDS, 16 * 16 * 4);
  arenaBatchCv = new Uint32Array(buffer, SIMD_MEMORY.BATCH_CV, 32);
  arenaBatchCounterLow = new Uint32Array(buffer, SIMD_MEMORY.BATCH_COUNTER_LOW, 4);
  arenaBatchFlagsBase = new Uint32Array(buffer, SIMD_MEMORY.BATCH_FLAGS_BASE, 4);
  arenaBatchOutput = new Uint32Array(buffer, SIMD_MEMORY.BATCH_OUTPUT, 32);
}
var cachedWasmBytes = null;
function initSimdSync() {
  if (wasmInstance)
    return true;
  if (!isSimdSupported()) {
    return false;
  }
  try {
    const wasmBytes = cachedWasmBytes || generateWasmBytes();
    cachedWasmBytes = wasmBytes;
    wasmMemory = new WebAssembly.Memory({ initial: 1 });
    const importObject = {
      js: { mem: wasmMemory }
    };
    const module = new WebAssembly.Module(wasmBytes.buffer);
    wasmInstance = new WebAssembly.Instance(module, importObject);
    wasmCompress4x = wasmInstance.exports.compress4x;
    wasmCompressChunks4x = wasmInstance.exports.compressChunks4x;
    wasmCompressParent = wasmInstance.exports.compressParent;
    wasmMemoryView = new Uint8Array(wasmMemory.buffer);
    wasmMemoryView32 = new Uint32Array(wasmMemory.buffer);
    setupArenaViews();
    return true;
  } catch (e) {
    console.warn("Failed to initialize WASM SIMD:", e);
    return false;
  }
}
var SIMD_MEMORY = {
  // SIMD compress4x working area (used by WASM code) - single block
  BLOCK_WORDS: 0,
  // 4 x 16 words = 512 bytes (transposed layout)
  CHAINING_VALUES: 512,
  // 4 x 8 words = 128 bytes
  OUTPUT: 640,
  // 4 x 8 words = 128 bytes
  COUNTER_LOW: 768,
  // 4 words = 16 bytes
  COUNTER_HIGH: 784,
  // 4 words = 16 bytes
  BLOCK_LEN: 800,
  // 4 words = 16 bytes
  FLAGS: 816,
  // 4 words = 16 bytes
  // End of single-block SIMD working area: 832 bytes
  // SIMD compressChunks4x working area - 16 blocks batched
  // Each block position has 16 v128 values (one per message word) = 256 bytes
  // 16 block positions = 16 × 256 = 4096 bytes
  BATCH_BLOCK_WORDS: 832,
  // 16 positions × 256 bytes = 4096 bytes (transposed), ends at 4928
  BATCH_CV: 4928,
  // 4 × 8 words × 4 bytes = 128 bytes (working CVs), ends at 5056
  BATCH_COUNTER_LOW: 5056,
  // 4 words × 4 bytes = 16 bytes (per-chunk counters), ends at 5072
  BATCH_FLAGS_BASE: 5072,
  // 4 words × 4 bytes = 16 bytes (base flags, no START/END), ends at 5088
  BATCH_OUTPUT: 5088,
  // 4 × 8 words × 4 bytes = 128 bytes (final output), ends at 5216
  // End of batch working area: 5216 bytes
  // WASM Arena: JS working buffers (accessed via TypedArray views)
  CV_STACK: 5216,
  // 64 levels × 8 words × 4 bytes = 2048 bytes, ends at 7264
  PARENT_BLOCK: 7264,
  // 16 words × 4 bytes = 64 bytes, ends at 7328
  CHUNK_CV: 7328,
  // 8 words × 4 bytes = 32 bytes, ends at 7360
  TEMP_CVS: 7360
  // 4 × 8 words × 4 bytes = 128 bytes, ends at 7488
  // Total arena usage: ~7488 bytes (fits comfortably in 64KB page)
};
var arenaCvStack = null;
var arenaParentBlock = null;
var arenaChunkCv = null;
var arenaTempCvs = null;
var arenaBatchBlockWords = null;
var arenaBatchCv = null;
var arenaBatchCounterLow = null;
var arenaBatchFlagsBase = null;
var arenaBatchOutput = null;

// ../../../hf-oauth-build-pRp19k/node_modules/@huggingface/blake3-jit/dist/esm/hash.js
var CV_STACK_DEPTH = 64;
var HYPER_CV_STACK = new Uint32Array(CV_STACK_DEPTH * 8);
var CV_POOL_SIZE = 64;
var CV_POOL = new Uint32Array(CV_POOL_SIZE * 8);
var CV_VIEWS = [];
for (let i = 0; i < CV_POOL_SIZE; i++) {
  CV_VIEWS.push(CV_POOL.subarray(i * 8, i * 8 + 8));
}
var simdAvailable = false;
var SIMD_THRESHOLD = 4 * CHUNK_LEN;
function ensureSimdSync() {
  if (simdAvailable)
    return true;
  simdAvailable = initSimdSync();
  return simdAvailable;
}
var simdChunkCvs = new Uint32Array(32);
var reusableTempCv = new Uint32Array(8);
var reusableChunkCv = new Uint32Array(8);
var reusablePureParentBlock = new Uint32Array(16);
var reusablePureParentCv = new Uint32Array(8);
var reusableSimdCvs = new Uint32Array(32);
var reusableSimdParentBlock = new Uint32Array(16);
var reusableSimdParentCv = new Uint32Array(8);
var reusableOffsets = new Uint32Array(4);
var reusableCounters = new Uint32Array(4);
var reusableBlockLens = new Uint32Array(4);
var reusableFlags = new Uint32Array(4);
var reusableOut8 = new Uint32Array(8);
var reusableOut8View = new Uint8Array(reusableOut8.buffer, 0, 32);
var SIMD_CV_BASE = SIMD_MEMORY.CHAINING_VALUES / 4;
var SIMD_OUT_BASE = SIMD_MEMORY.OUTPUT / 4;
var SIMD_COUNTER_LOW_BASE = SIMD_MEMORY.COUNTER_LOW / 4;
var SIMD_COUNTER_HIGH_BASE = SIMD_MEMORY.COUNTER_HIGH / 4;
var SIMD_BLOCK_LEN_BASE = SIMD_MEMORY.BLOCK_LEN / 4;
var BATCH_CV_BASE = SIMD_MEMORY.BATCH_CV / 4;
var BATCH_COUNTER_LOW_BASE = SIMD_MEMORY.BATCH_COUNTER_LOW / 4;
var BATCH_FLAGS_BASE_OFFSET = SIMD_MEMORY.BATCH_FLAGS_BASE / 4;
var BATCH_OUTPUT_BASE = SIMD_MEMORY.BATCH_OUTPUT / 4;
var batchChunkOffsets = new Uint32Array(4);
var SIMD_FLAGS_BASE = SIMD_MEMORY.FLAGS / 4;
function warmupSimd() {
  return ensureSimdSync();
}

// ../../../hf-oauth-build-pRp19k/node_modules/@huggingface/blake3-jit/dist/esm/index.js
if (typeof globalThis !== "undefined" && typeof globalThis.document !== "undefined") {
  queueMicrotask(() => {
    warmupSimd();
  });
}

// ../../../hf-oauth-build-pRp19k/node_modules/@huggingface/xetchunk-wasm/dist/esm/xet-chunker.js
var TARGET_CHUNK_SIZE = 64 * 1024;
var BLAKE3_DATA_KEY = new Uint8Array([
  102,
  151,
  245,
  119,
  91,
  149,
  80,
  222,
  49,
  53,
  203,
  172,
  165,
  151,
  24,
  28,
  157,
  228,
  33,
  16,
  155,
  235,
  43,
  88,
  180,
  208,
  176,
  75,
  147,
  173,
  242,
  41
]);

// ../../../hf-oauth-build-pRp19k/node_modules/@huggingface/xetchunk-wasm/dist/esm/xorb-hash.js
var BLAKE3_NODE_KEY = new Uint8Array([
  1,
  126,
  197,
  199,
  165,
  71,
  41,
  150,
  253,
  148,
  102,
  102,
  180,
  138,
  2,
  230,
  93,
  221,
  83,
  111,
  55,
  199,
  109,
  210,
  248,
  99,
  82,
  230,
  74,
  83,
  113,
  63
]);
var INDEX_OF_LAST_BYTE_OF_LAST_U64_IN_CHUNK_HASH = 3 * 8;
var nodeHasher = Hasher.newKeyed(BLAKE3_NODE_KEY);

// ../../../hf-oauth-build-pRp19k/node_modules/@huggingface/xetchunk-wasm/dist/esm/hash-utils.js
var ZERO_KEY = new Uint8Array(32);
var VERIFICATION_KEY = new Uint8Array([
  127,
  24,
  87,
  214,
  206,
  86,
  237,
  102,
  18,
  127,
  249,
  19,
  231,
  165,
  195,
  243,
  164,
  205,
  38,
  213,
  181,
  219,
  73,
  230,
  65,
  36,
  152,
  127,
  40,
  251,
  148,
  195
]);
var fileHasher = Hasher.newKeyed(ZERO_KEY);
var verificationHasher = Hasher.newKeyed(VERIFICATION_KEY);

// ../../../hf-oauth-build-pRp19k/node_modules/@huggingface/hub/dist/browser/index.mjs
var HUB_URL = "https://huggingface.co";
async function createApiError(response, opts) {
  const error = new HubApiError(response.url, response.status, response.headers.get("X-Request-Id") ?? opts?.requestId);
  error.message = `Api error with status ${error.statusCode}${opts?.message ? `. ${opts.message}` : ""}`;
  const trailer = [`URL: ${error.url}`, error.requestId ? `Request ID: ${error.requestId}` : void 0].filter(Boolean).join(". ");
  if (response.headers.get("Content-Type")?.startsWith("application/json")) {
    const json = await response.json();
    error.message = json.error || json.message || error.message;
    if (json.error_description) {
      error.message = error.message ? error.message + `: ${json.error_description}` : json.error_description;
    }
    error.data = json;
  } else {
    error.data = { message: await response.text() };
  }
  error.message += `. ${trailer}`;
  throw error;
}
var HubApiError = class extends Error {
  statusCode;
  url;
  requestId;
  data;
  constructor(url, statusCode, requestId, message) {
    super(message);
    this.statusCode = statusCode;
    this.requestId = requestId;
    this.url = url;
  }
};
var isBrowser = typeof window !== "undefined" && typeof window.document !== "undefined";
var isWebWorker = typeof self === "object" && self.constructor && self.constructor.name === "DedicatedWorkerGlobalScope";
var isBackend = !isBrowser && !isWebWorker;
var isFrontend = !isBackend;
var resolve;
var waitPromise = new Promise((r) => {
  resolve = r;
});
function base64FromBytes(arr) {
  if (globalThis.Buffer) {
    return globalThis.Buffer.from(arr).toString("base64");
  } else {
    const bin = [];
    arr.forEach((byte) => {
      bin.push(String.fromCharCode(byte));
    });
    return globalThis.btoa(bin.join(""));
  }
}
var hashSize = 1 << 16;
var mlBits = 4;
var mlMask = (1 << mlBits) - 1;
var runBits = 4;
var runMask = (1 << runBits) - 1;
var blockBuf = makeBuffer(5 << 20);
var hashTable = makeHashTable();
function makeHashTable() {
  try {
    return new Uint32Array(hashSize);
  } catch (error) {
    const hashTable2 = new Array(hashSize);
    for (let i = 0; i < hashSize; i++) {
      hashTable2[i] = 0;
    }
    return hashTable2;
  }
}
function makeBuffer(size) {
  return new Uint8Array(size);
}
var textEncoder = new TextEncoder();
var CRLF = textEncoder.encode("\r\n");
var HEADER_SEPARATOR = textEncoder.encode("\r\n\r\n");
function hasH2Fetch(versions = typeof process !== "undefined" ? process.versions : void 0, frontend = isFrontend) {
  if (frontend || !versions?.undici || versions.bun) {
    return false;
  }
  return Number(versions.undici.split(".")[0]) >= 8;
}
var GLOBAL_DISPATCHER_KEYS = [/* @__PURE__ */ Symbol.for("undici.globalDispatcher.2"), /* @__PURE__ */ Symbol.for("undici.globalDispatcher.1")];
function withHttp1(base) {
  return {
    dispatch: (options, handler) => base.dispatch({ ...options, allowH2: false }, handler)
  };
}
var cached;
async function getHttp1Dispatcher() {
  const globals = globalThis;
  const find = () => GLOBAL_DISPATCHER_KEYS.map((key) => globals[key]).find((d) => typeof d?.dispatch === "function");
  let base = find();
  if (base === void 0) {
    await (await fetch("data:,")).arrayBuffer();
    base = find();
  }
  if (base === void 0) {
    return void 0;
  }
  if (cached?.base !== base) {
    cached = { base, http1: withHttp1(base) };
  }
  return cached.http1;
}
var undiciHttp1Fetch = async (input, init) => {
  const dispatcher = await getHttp1Dispatcher();
  return dispatcher ? fetch(input, { ...init, dispatcher }) : fetch(input, init);
};
var http1Fetch = hasH2Fetch() ? undiciHttp1Fetch : (input, init) => fetch(input, init);
var PARALLEL_MIN_IN_FLIGHT_BYTES = 64 * 1024 * 1024;
var PARALLEL_MAX_IN_FLIGHT_BYTES = 256 * 1024 * 1024;
var HASH_LENGTH = 32;
var XORB_HASH_BOOKEND = "ff".repeat(HASH_LENGTH);
var ZERO_KEY2 = new Uint8Array(32);
var TARGET_CHUNK_SIZE2 = 64 * 1024;
var MAX_CHUNK_SIZE = 2 * TARGET_CHUNK_SIZE2;
var XORB_SIZE = 64 * 1024 * 1024;
var MAX_XORB_CHUNKS = 8 * 1024;
var PROCESSING_PROGRESS_RATIO = 0.1;
var UPLOADING_PROGRESS_RATIO = 1 - PROCESSING_PROGRESS_RATIO;
var SHARD_MAX_SIZE = 64 * 1024 * 1024;
var SHARD_MAGIC_TAG = new Uint8Array([
  "H".charCodeAt(0),
  "F".charCodeAt(0),
  "R".charCodeAt(0),
  "e".charCodeAt(0),
  "p".charCodeAt(0),
  "o".charCodeAt(0),
  "M".charCodeAt(0),
  "e".charCodeAt(0),
  "t".charCodeAt(0),
  "a".charCodeAt(0),
  "D".charCodeAt(0),
  "a".charCodeAt(0),
  "t".charCodeAt(0),
  "a".charCodeAt(0),
  0,
  85,
  105,
  103,
  69,
  106,
  123,
  129,
  87,
  131,
  165,
  189,
  217,
  92,
  205,
  209,
  74,
  169
]);
async function oauthHandleRedirect(opts) {
  if (typeof window === "undefined" && !opts?.redirectedUrl) {
    throw new Error("oauthHandleRedirect is only available in the browser, unless you provide redirectedUrl");
  }
  if (typeof localStorage === "undefined" && (!opts?.nonce || !opts?.codeVerifier)) {
    throw new Error(
      "oauthHandleRedirect requires localStorage to be available, unless you provide nonce and codeVerifier"
    );
  }
  const redirectedUrl = opts?.redirectedUrl ?? window.location.href;
  const searchParams = (() => {
    try {
      return new URL(redirectedUrl).searchParams;
    } catch (err) {
      throw new Error("Failed to parse redirected URL: " + redirectedUrl);
    }
  })();
  const [error, errorDescription] = [searchParams.get("error"), searchParams.get("error_description")];
  if (error) {
    throw new Error(`${error}: ${errorDescription}`);
  }
  const code = searchParams.get("code");
  const nonce = opts?.nonce ?? localStorage.getItem("huggingface.co:oauth:nonce");
  if (!code) {
    throw new Error("Missing oauth code from query parameters in redirected URL: " + redirectedUrl);
  }
  if (!nonce) {
    throw new Error("Missing oauth nonce from localStorage");
  }
  const codeVerifier = opts?.codeVerifier ?? localStorage.getItem("huggingface.co:oauth:code_verifier");
  if (!codeVerifier) {
    throw new Error("Missing oauth code_verifier from localStorage");
  }
  const state = searchParams.get("state");
  if (!state) {
    throw new Error("Missing oauth state from query parameters in redirected URL");
  }
  let parsedState;
  try {
    parsedState = JSON.parse(state);
  } catch {
    throw new Error("Invalid oauth state in redirected URL, unable to parse JSON: " + state);
  }
  if (parsedState.nonce !== nonce) {
    throw new Error("Invalid oauth state in redirected URL");
  }
  const hubUrl = opts?.hubUrl || HUB_URL;
  const openidConfigUrl = `${new URL(hubUrl).origin}/.well-known/openid-configuration`;
  const openidConfigRes = await fetch(openidConfigUrl, {
    headers: {
      Accept: "application/json"
    }
  });
  if (!openidConfigRes.ok) {
    throw await createApiError(openidConfigRes);
  }
  const openidConfig = await openidConfigRes.json();
  const tokenRes = await fetch(openidConfig.token_endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: parsedState.redirectUri,
      code_verifier: codeVerifier
    }).toString()
  });
  if (!opts?.codeVerifier) {
    localStorage.removeItem("huggingface.co:oauth:code_verifier");
  }
  if (!opts?.nonce) {
    localStorage.removeItem("huggingface.co:oauth:nonce");
  }
  if (!tokenRes.ok) {
    throw await createApiError(tokenRes);
  }
  const token = await tokenRes.json();
  const accessTokenExpiresAt = new Date(Date.now() + token.expires_in * 1e3);
  const userInfoRes = await fetch(openidConfig.userinfo_endpoint, {
    headers: {
      Authorization: `Bearer ${token.access_token}`
    }
  });
  if (!userInfoRes.ok) {
    throw await createApiError(userInfoRes);
  }
  const userInfo = await userInfoRes.json();
  return {
    accessToken: token.access_token,
    accessTokenExpiresAt,
    userInfo,
    state: parsedState.state,
    scope: token.scope
  };
}
async function oauthLoginUrl(opts) {
  if (typeof window === "undefined" && (!opts?.redirectUrl || !opts?.clientId)) {
    throw new Error("oauthLogin is only available in the browser, unless you provide clientId and redirectUrl");
  }
  if (typeof localStorage === "undefined" && !opts?.localStorage) {
    throw new Error(
      "oauthLogin requires localStorage to be available in the context, unless you provide a localStorage empty object as argument"
    );
  }
  const hubUrl = opts?.hubUrl || HUB_URL;
  const openidConfigUrl = `${new URL(hubUrl).origin}/.well-known/openid-configuration`;
  const openidConfigRes = await fetch(openidConfigUrl, {
    headers: {
      Accept: "application/json"
    }
  });
  if (!openidConfigRes.ok) {
    throw await createApiError(openidConfigRes);
  }
  const opendidConfig = await openidConfigRes.json();
  const newNonce = globalThis.crypto.randomUUID();
  const newCodeVerifier = globalThis.crypto.randomUUID() + globalThis.crypto.randomUUID();
  if (opts?.localStorage) {
    if (opts.localStorage.codeVerifier !== void 0 && opts.localStorage.codeVerifier !== null) {
      throw new Error(
        "localStorage.codeVerifier must be initially set to null or undefined, and will be filled by oauthLoginUrl"
      );
    }
    if (opts.localStorage.nonce !== void 0 && opts.localStorage.nonce !== null) {
      throw new Error(
        "localStorage.nonce must be initially set to null or undefined, and will be filled by oauthLoginUrl"
      );
    }
    opts.localStorage.codeVerifier = newCodeVerifier;
    opts.localStorage.nonce = newNonce;
  } else {
    localStorage.setItem("huggingface.co:oauth:nonce", newNonce);
    localStorage.setItem("huggingface.co:oauth:code_verifier", newCodeVerifier);
  }
  const redirectUri = opts?.redirectUrl || (typeof window !== "undefined" ? window.location.href : void 0);
  if (!redirectUri) {
    throw new Error("Missing redirectUrl");
  }
  const state = JSON.stringify({
    nonce: newNonce,
    redirectUri,
    state: opts?.state
  });
  const variables = (
    // @ts-expect-error window.huggingface is defined inside static Spaces.
    typeof window !== "undefined" ? window.huggingface?.variables ?? null : null
  );
  const clientId = opts?.clientId || variables?.OAUTH_CLIENT_ID;
  if (!clientId) {
    if (variables) {
      throw new Error("Missing clientId, please add hf_oauth: true to the README.md's metadata in your static Space");
    }
    throw new Error("Missing clientId");
  }
  const challenge = base64FromBytes(
    new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(newCodeVerifier)))
  ).replace(/[+]/g, "-").replace(/[/]/g, "_").replace(/=/g, "");
  return `${opendidConfig.authorization_endpoint}?${new URLSearchParams({
    client_id: clientId,
    scope: opts?.scopes || variables?.OAUTH_SCOPES || "openid profile",
    response_type: "code",
    redirect_uri: redirectUri,
    state,
    code_challenge: challenge,
    code_challenge_method: "S256"
  }).toString()}`;
}
var DIFFUSERS_SAFETENSORS_FILE = "diffusion_pytorch_model.safetensors";
var DIFFUSERS_SAFETENSORS_INDEX_FILE = "diffusion_pytorch_model.safetensors.index.json";
var DIFFUSERS_WEIGHTS_SUBFOLDERS = ["transformer", "unet"];
var MAX_TENSOR_DIM = 2 ** 32;
var LIBRARY_WEIGHT_CANDIDATES = {
  // diffusers keeps the main module (the diffusion transformer / U-Net) under a subfolder,
  // or at the repo root for single-component repos (ControlNets, standalone VAEs). This matches
  // how a diffusion model's size is conventionally reported: the diffusion transformer / U-Net,
  // not the sum of VAE + text encoders.
  diffusers: [
    ...DIFFUSERS_WEIGHTS_SUBFOLDERS.map((folder) => ({
      single: `${folder}/${DIFFUSERS_SAFETENSORS_FILE}`,
      index: `${folder}/${DIFFUSERS_SAFETENSORS_INDEX_FILE}`
    })),
    { single: DIFFUSERS_SAFETENSORS_FILE, index: DIFFUSERS_SAFETENSORS_INDEX_FILE }
  ]
};
export {
  oauthHandleRedirect,
  oauthLoginUrl
};
