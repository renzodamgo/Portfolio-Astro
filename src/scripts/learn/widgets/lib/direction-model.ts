// Port of DirectionVote (learn: src/my_open/my_open/direction.py): which coloured line is longer, confirmed over
// several frames. No DOM here, so it can be tested from the shell.

export const MIN_LENGTH = 40; // px: shorter lines are noise
export const MIN_CONFIDENCE = 0.25; // how much longer one line must be than the other: |blue - orange| / the longest
export const CONFIRMATIONS = 5; // consecutive frames that must agree

/** Why a frame did not vote (or null when it did). */
export type Reason = 'short' | 'close' | null;

export function frameVote(blue: number, orange: number): { vote: number; confidence: number; longest: number; reason: Reason } {
  const longest = Math.max(blue, orange);
  const confidence = Math.abs(blue - orange) / Math.max(longest, 1);
  let vote = 0;
  let reason: Reason = null;
  if (longest < MIN_LENGTH) reason = 'short';
  else if (confidence < MIN_CONFIDENCE) reason = 'close';
  else vote = blue > orange ? 1 : -1;
  return { vote, confidence, longest, reason };
}

export class DirectionVote {
  candidate = 0; // what the last frame voted for (0: nothing clear)
  hits = 0; // consecutive frames that voted for it
  direction = 0;

  /** Feed one frame's two line lengths (pixels). Returns the decision so far: +1, -1 or 0. */
  update(blueLength: number, orangeLength: number): number {
    const { vote } = frameVote(blueLength, orangeLength);
    this.hits = vote !== 0 && vote === this.candidate ? this.hits + 1 : vote !== 0 ? 1 : 0;
    this.candidate = vote;
    this.direction = this.hits >= CONFIRMATIONS ? vote : 0;
    return this.direction;
  }
}
