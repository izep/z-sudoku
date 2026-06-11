/**
 * Sudoku Board Generator
 *
 * Generates a valid 9×9 sudoku puzzle with a unique solution at a target
 * difficulty level expressed as a float from 0.0 to 1.0.
 *
 * Difficulty scale:
 *   0.0  – trivial (nearly solved, only Naked Singles needed)
 *   0.25 – easy    (Naked + Hidden Singles)
 *   0.5  – medium  (Pointing Pairs, Box/Line, Naked/Hidden Pairs)
 *   0.75 – hard    (X-Wing, Y-Wing, advanced techniques)
 *   1.0  – maximum (requires the hardest currently-implemented strategy)
 *
 * The scale is anchored to the current strategy set and evolves automatically
 * when new strategies are added to STRATEGY_WEIGHTS.
 *
 * Architecture:
 *   1. generateSolution()   – fill a random valid 9×9 grid via backtracking
 *   2. countSolutions()     – fast backtracking counter (stops at 2); ensures uniqueness
 *   3. scorePuzzle()        – run the human solver; sum strategy difficulty weights
 *   4. generate(difficulty) – remove cells until score approaches the target,
 *                             always verifying uniqueness after each removal
 */

import { solve } from "./sudoku-human.ts";

// ─── Types ───────────────────────────────────────────────────────────────────

export type Board = number[][];

export interface GeneratorResult {
  puzzle: Board;
  solution: Board;
  /** Raw difficulty score (strategy-weighted sum) */
  score: number;
  /** Normalised 0–1 difficulty */
  difficulty: number;
  /** Number of clues (filled cells) remaining */
  clues: number;
  /** Strategy breakdown from the solver */
  strategies: Record<string, number>;
}

// ─── Strategy Difficulty Weights ─────────────────────────────────────────────
//
// Each entry maps a strategy name (exactly as returned by the solver) to a
// difficulty cost. These costs are tuned so that a puzzle whose solution
// touches only the hardest strategy scores ≈ MAX_SCORE.
//
// TO ADD A NEW STRATEGY: add one line here. The normalisation in scorePuzzle()
// and the MAX_SCORE anchor in generate() will pick it up automatically.

export const STRATEGY_WEIGHTS: Record<string, number> = {
  // ── Placement strategies ─────────────────────────────────────────────────
  "Naked Single":      1,
  "Hidden Single":     2,

  // ── Elimination — basic ───────────────────────────────────────────────────
  "Pointing Pair":     5,
  "Pointing Triple":   6,
  "Box/Line Reduction": 6,
  "Naked Pair":        8,
  "Naked Triple":      12,
  "Hidden Pair":       15,
  "Hidden Triple":     20,

  // ── Elimination — fish ───────────────────────────────────────────────────
  "X-Wing":            25,
  "Swordfish":         35,
  "Jellyfish":         50,

  // ── Elimination — wings ──────────────────────────────────────────────────
  "Y-Wing":            60,
  "XYZ-Wing":          80,

  // ── Future strategies (add here) ─────────────────────────────────────────
  // "W-Wing":           90,
  // "Skyscraper":       95,
  // "Simple Coloring": 100,
  // "X-Cycle":         120,
  // "Unique Rectangle": 110,
};

/**
 * The reference score for difficulty = 1.0.
 * Computed as the score of a puzzle that uses each strategy exactly once,
 * weighted by the highest strategy available. We use the MAX single-strategy
 * weight as the anchor so that a puzzle requiring only XYZ-Wing (the hardest)
 * once scores close to 1.0.
 *
 * In practice, hard puzzles accumulate many strategy invocations, so real
 * scores easily exceed MAX_WEIGHT. We use a soft cap via tanh so difficulty
 * gracefully approaches 1.0 from below even for very hard puzzles.
 */
const MAX_WEIGHT = Math.max(...Object.values(STRATEGY_WEIGHTS));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function cloneBoard(board: Board): Board {
  return board.map((r) => [...r]);
}

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Return true if placing digit d at (r,c) violates no sudoku constraints. */
function isLegal(board: Board, r: number, c: number, d: number): boolean {
  for (let i = 0; i < 9; i++) {
    if (board[r][i] === d || board[i][c] === d) return false;
  }
  const br = Math.floor(r / 3) * 3;
  const bc = Math.floor(c / 3) * 3;
  for (let i = br; i < br + 3; i++)
    for (let j = bc; j < bc + 3; j++)
      if (board[i][j] === d) return false;
  return true;
}

// ─── 1. Solution Generator ───────────────────────────────────────────────────

/**
 * Fill a blank grid with a valid, randomly-ordered sudoku solution.
 * Uses backtracking with shuffled digit order for randomness.
 */
export function generateSolution(): Board {
  const board: Board = Array.from({ length: 9 }, () => Array(9).fill(0));

  function fill(pos: number): boolean {
    if (pos === 81) return true;
    const r = Math.floor(pos / 9);
    const c = pos % 9;

    for (const d of shuffled([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
      if (isLegal(board, r, c, d)) {
        board[r][c] = d;
        if (fill(pos + 1)) return true;
        board[r][c] = 0;
      }
    }
    return false;
  }

  fill(0);
  return board;
}

// ─── 2. Uniqueness Counter ───────────────────────────────────────────────────

/**
 * Count the number of solutions to a puzzle, stopping as soon as the count
 * reaches `limit` (default 2). Returns 0, 1, or 2.
 *
 * Uses raw backtracking (not the human solver) for speed.
 */
export function countSolutions(puzzle: Board, limit = 2): number {
  const board = cloneBoard(puzzle);
  let count = 0;

  function solve(pos: number): void {
    if (count >= limit) return;
    if (pos === 81) { count++; return; }

    const r = Math.floor(pos / 9);
    const c = pos % 9;

    if (board[r][c] !== 0) {
      solve(pos + 1);
      return;
    }

    for (let d = 1; d <= 9; d++) {
      if (count >= limit) return;
      if (isLegal(board, r, c, d)) {
        board[r][c] = d;
        solve(pos + 1);
        board[r][c] = 0;
      }
    }
  }

  solve(0);
  return count;
}

// ─── 3. Difficulty Scorer ────────────────────────────────────────────────────

export interface ScoreResult {
  /** Raw weighted strategy score */
  score: number;
  /** Normalised 0–1 difficulty via soft cap */
  difficulty: number;
  /** True if the human solver could fully solve this puzzle */
  solvable: boolean;
  /** Count of each strategy used */
  strategies: Record<string, number>;
}

/**
 * Solve the puzzle with the human solver and compute a difficulty score.
 *
 * Score = sum of (strategy weight × invocation count) for all steps taken.
 *
 * Normalisation uses a sigmoid-like soft cap so the score maps smoothly to
 * 0–1. The reference point (difficulty = 0.63) is a puzzle scoring MAX_WEIGHT,
 * i.e. one that uses the hardest strategy exactly once. Puzzles requiring it
 * multiple times score higher but asymptotically approach 1.0.
 */
export function scorePuzzle(puzzle: Board): ScoreResult {
  const result = solve(puzzle, false);

  const strategies: Record<string, number> = {};
  for (const step of result.steps) {
    const m = step.match(/\[([^\]]+)\]/);
    if (m) strategies[m[1]] = (strategies[m[1]] ?? 0) + 1;
  }

  let score = 0;
  for (const [name, count] of Object.entries(strategies)) {
    score += (STRATEGY_WEIGHTS[name] ?? 0) * count;
  }

  // Soft normalisation: 1 - exp(-score / MAX_WEIGHT)
  // At score = MAX_WEIGHT → difficulty ≈ 0.63
  // At score = 3×MAX_WEIGHT → difficulty ≈ 0.95
  // Asymptotes to 1.0 from below
  const difficulty = 1 - Math.exp(-score / MAX_WEIGHT);

  return { score, difficulty, solvable: result.solved, strategies };
}

// ─── 4. Puzzle Generator ─────────────────────────────────────────────────────

export interface GenerateOptions {
  /**
   * Target difficulty 0.0–1.0.
   * The generator removes cells until the puzzle's measured difficulty
   * is within `tolerance` of this target.
   */
  difficulty?: number;
  /**
   * Acceptable distance from target difficulty. Default 0.05.
   */
  tolerance?: number;
  /**
   * Maximum attempts to generate a puzzle at the target difficulty.
   * Each attempt starts from a fresh random solution. Default 50.
   */
  maxAttempts?: number;
  /**
   * Minimum number of clues to leave in the puzzle. Default 22.
   * (Below ~17 clues, unique solutions become extremely rare.)
   */
  minClues?: number;
}

/**
 * Generate a sudoku puzzle at a target difficulty level.
 *
 * Algorithm:
 *   1. Generate a random filled solution.
 *   2. Create a removal order: shuffle all 81 cell positions, then symmetrise
 *      by pairing each cell with its 180° rotational partner (cosmetically
 *      nicer puzzles, common in published sudoku).
 *   3. Try removing cells one pair at a time:
 *      a. After removal, verify uniqueness (countSolutions = 1).
 *      b. Score the puzzle. If score exceeds target, stop removing.
 *   4. If the resulting difficulty is within tolerance of the target, return it.
 *      Otherwise, retry from a fresh solution (up to maxAttempts).
 *
 * Difficulty targeting:
 *   - The generator overshoots slightly then backtracks: it removes cells
 *     until the score FIRST exceeds the target, then restores the last
 *     removal if the score before removal was closer to the target.
 */
export function generate(
  targetDifficulty = 0.5,
  options: GenerateOptions = {}
): GeneratorResult {
  const {
    tolerance = 0.05,
    maxAttempts = 50,
    minClues = 22,
  } = options;

  // Clamp to [0, 1]
  const target = Math.max(0, Math.min(1, targetDifficulty));

  // Track the best result seen across all attempts (closest to target)
  let bestResult: GeneratorResult | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const solution = generateSolution();
    const puzzle = cloneBoard(solution);

    // Build a shuffled list of unique cell-pair positions (rotational symmetry).
    // Each entry is [pos, mirrorPos]. The centre cell (pos 40) maps to itself.
    const positions = shuffled(Array.from({ length: 81 }, (_, i) => i));
    const pairs: [number, number][] = [];
    const seen = new Set<number>();
    for (const pos of positions) {
      if (seen.has(pos)) continue;
      const mirror = 80 - pos;
      seen.add(pos);
      seen.add(mirror);
      pairs.push([pos, mirror]);
    }

    // Start with full solution; progressively remove cells toward the target.
    // lastGoodPuzzle tracks the state with uniqueness guaranteed.
    let lastGoodPuzzle = cloneBoard(puzzle);
    let lastGoodScore = scorePuzzle(puzzle);

    for (const [pos, mirror] of pairs) {
      const r1 = Math.floor(pos / 9),    c1 = pos % 9;
      const r2 = Math.floor(mirror / 9), c2 = mirror % 9;

      const v1 = puzzle[r1][c1];
      const v2 = puzzle[r2][c2];

      if (v1 === 0 && v2 === 0) continue; // already empty

      // How many filled cells would this removal eliminate?
      let removals = (v1 !== 0 ? 1 : 0);
      if (r2 !== r1 || c2 !== c1) removals += (v2 !== 0 ? 1 : 0);

      const cluesAfter = puzzle.flat().filter(v => v !== 0).length - removals;
      if (cluesAfter < minClues) continue;

      // Tentatively remove
      puzzle[r1][c1] = 0;
      if (r2 !== r1 || c2 !== c1) puzzle[r2][c2] = 0;

      // Restore if removal breaks uniqueness
      if (countSolutions(puzzle) !== 1) {
        puzzle[r1][c1] = v1;
        if (r2 !== r1 || c2 !== c1) puzzle[r2][c2] = v2;
        continue;
      }

      const current = scorePuzzle(puzzle);

      // For target=0: stop as soon as any cell has been removed (score > 0)
      // so we get a nearly-complete puzzle, not the full solution.
      if (target === 0 && current.score > 0) {
        lastGoodPuzzle = cloneBoard(puzzle);
        lastGoodScore = current;
        break;
      }

      // Overshot target — compare both sides and pick the closer one
      if (current.difficulty > target) {
        const distBefore = Math.abs(lastGoodScore.difficulty - target);
        const distAfter  = Math.abs(current.difficulty - target);

        if (distBefore <= distAfter) {
          // Restore: previous state was closer
          puzzle[r1][c1] = v1;
          if (r2 !== r1 || c2 !== c1) puzzle[r2][c2] = v2;
        } else {
          // Keep: current state is closer
          lastGoodPuzzle = cloneBoard(puzzle);
          lastGoodScore = current;
        }
        break;
      }

      // Still below target — commit this removal and continue
      lastGoodPuzzle = cloneBoard(puzzle);
      lastGoodScore = current;
    }

    const candidate: GeneratorResult = {
      puzzle: lastGoodPuzzle,
      solution,
      score: lastGoodScore.score,
      difficulty: lastGoodScore.difficulty,
      clues: lastGoodPuzzle.flat().filter(v => v !== 0).length,
      strategies: lastGoodScore.strategies,
    };

    // Update best seen
    if (
      bestResult === null ||
      Math.abs(candidate.difficulty - target) < Math.abs(bestResult.difficulty - target)
    ) {
      bestResult = candidate;
    }

    // Return immediately if within tolerance
    if (Math.abs(candidate.difficulty - target) <= tolerance) {
      return candidate;
    }
  }

  // Return the closest result found across all attempts
  return bestResult!;
}

// ─── Display ─────────────────────────────────────────────────────────────────

function printBoard(board: Board, label?: string): void {
  if (label) console.log(`\n${label}`);
  console.log("┌───────┬───────┬───────┐");
  for (let r = 0; r < 9; r++) {
    if (r > 0 && r % 3 === 0) console.log("├───────┼───────┼───────┤");
    const row =
      "│ " +
      [0, 3, 6]
        .map((bc) =>
          board[r]
            .slice(bc, bc + 3)
            .map((v) => (v === 0 ? "." : v))
            .join(" ")
        )
        .join(" │ ") +
      " │";
    console.log(row);
  }
  console.log("└───────┴───────┴───────┘");
}

// ─── Demo ────────────────────────────────────────────────────────────────────

const LEVELS: [string, number][] = [
  ["0.0  (trivial)",  0.0],
  ["0.25 (easy)",     0.25],
  ["0.5  (medium)",   0.5],
  ["0.75 (hard)",     0.75],
  ["1.0  (maximum)",  1.0],
];

const hardestStrategy = Object.entries(STRATEGY_WEIGHTS).reduce(
  (a, b) => (b[1] > a[1] ? b : a)
)[0];

console.log("═══════════════════════════════════════════════════════");
console.log("             SUDOKU PUZZLE GENERATOR                   ");
console.log("═══════════════════════════════════════════════════════");
console.log(`Difficulty 1.0 anchor: "${hardestStrategy}" (weight ${MAX_WEIGHT})`);
console.log(`Scale evolves automatically when new strategies are added.\n`);

for (const [label, diff] of LEVELS) {
  console.log(`\n─── Difficulty ${label} ${"─".repeat(30)}`);
  const result = generate(diff, { tolerance: 0.06, maxAttempts: 30 });

  printBoard(result.puzzle, `Puzzle (${result.clues} clues):`);
  console.log(`\n  Target:     ${diff.toFixed(2)}`);
  console.log(`  Achieved:   ${result.difficulty.toFixed(4)}`);
  console.log(`  Raw score:  ${result.score}`);
  console.log(`  Clues:      ${result.clues}`);
  const stratSummary = Object.entries(result.strategies)
    .map(([k, v]) => `${k} ×${v}`)
    .join("  |  ");
  console.log(`  Strategies: ${stratSummary || "(none needed — fully given)"}`);
}
