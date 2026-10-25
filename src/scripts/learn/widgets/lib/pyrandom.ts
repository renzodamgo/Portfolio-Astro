// Python's random.Random(seed).gauss() in TypeScript: Mersenne Twister MT19937 seeded like random.seed(int),
// random() with 53 bits and the gauss() pair method. It lets a widget reproduce a Python bench to the last digit.
// No DOM here, so it can be tested from the shell.

export class PyRandom {
  private mt = new Uint32Array(624);
  private idx = 624;
  private gaussNext: number | null = null;

  constructor(seed: number) {
    this.initByArray(PyRandom.key(Math.abs(Math.trunc(seed))));
  }

  /** The 32-bit words of a non-negative integer, least significant first (at least one word). */
  private static key(n: number): number[] {
    const words: number[] = [];
    let v = n;
    do {
      words.push(v % 4294967296);
      v = Math.floor(v / 4294967296);
    } while (v > 0);
    return words;
  }

  private initGenrand(s: number): void {
    const mt = this.mt;
    mt[0] = s >>> 0;
    for (let i = 1; i < 624; i++) {
      const prev = mt[i - 1] ^ (mt[i - 1] >>> 30);
      mt[i] = (Math.imul(1812433253, prev) + i) >>> 0;
    }
    this.idx = 624;
  }

  private initByArray(key: number[]): void {
    this.initGenrand(19650218);
    const mt = this.mt;
    let i = 1, j = 0;
    for (let k = Math.max(624, key.length); k > 0; k--) {
      const prev = mt[i - 1] ^ (mt[i - 1] >>> 30);
      mt[i] = ((mt[i] ^ Math.imul(prev, 1664525)) + key[j] + j) >>> 0;
      i++;
      j++;
      if (i >= 624) {
        mt[0] = mt[623];
        i = 1;
      }
      if (j >= key.length) j = 0;
    }
    for (let k = 623; k > 0; k--) {
      const prev = mt[i - 1] ^ (mt[i - 1] >>> 30);
      mt[i] = ((mt[i] ^ Math.imul(prev, 1566083941)) - i) >>> 0;
      i++;
      if (i >= 624) {
        mt[0] = mt[623];
        i = 1;
      }
    }
    mt[0] = 0x80000000;
    this.idx = 624;
  }

  private nextU32(): number {
    const mt = this.mt;
    if (this.idx >= 624) {
      for (let k = 0; k < 624; k++) {
        const y = (mt[k] & 0x80000000) | (mt[(k + 1) % 624] & 0x7fffffff);
        mt[k] = mt[(k + 397) % 624] ^ (y >>> 1) ^ (y & 1 ? 0x9908b0df : 0);
      }
      this.idx = 0;
    }
    let y = mt[this.idx++];
    y ^= y >>> 11;
    y ^= (y << 7) & 0x9d2c5680;
    y ^= (y << 15) & 0xefc60000;
    y ^= y >>> 18;
    return y >>> 0;
  }

  /** random.random(): a float in [0, 1) with 53 random bits. */
  random(): number {
    const a = this.nextU32() >>> 5;
    const b = this.nextU32() >>> 6;
    return (a * 67108864 + b) / 9007199254740992;
  }

  /** random.gauss(mu, sigma). */
  gauss(mu: number, sigma: number): number {
    let z = this.gaussNext;
    this.gaussNext = null;
    if (z === null) {
      const x2pi = this.random() * 2 * Math.PI;
      const g2rad = Math.sqrt(-2 * Math.log(1 - this.random()));
      z = Math.cos(x2pi) * g2rad;
      this.gaussNext = Math.sin(x2pi) * g2rad;
    }
    return mu + z * sigma;
  }
}
