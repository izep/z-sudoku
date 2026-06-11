/**
 * Human-Strategy Sudoku Solver
 *
 * Solves sudoku puzzles iteratively using named strategies that humans use.
 * Designed to teach sudoku and help improve solve times.
 *
 * Strategies implemented (in order of difficulty):
 *   1.  Naked Single        – only one candidate remains in a cell
 *   2.  Hidden Single       – a digit can only fit in one cell within a unit
 *   3.  Pointing Pair/Triple – box candidates confined to one line; eliminate from rest of line
 *   4.  Box/Line Reduction  – line candidates confined to one box; eliminate from rest of box
 *   5.  Naked Pair          – two cells share exactly two candidates; eliminate from unit peers
 *   6.  Naked Triple        – three cells share exactly three candidates; eliminate from unit peers
 *   7.  Hidden Pair         – two digits in only two cells of a unit; remove other candidates
 *   8.  Hidden Triple       – three digits in only three cells of a unit; remove other candidates
 *   9.  X-Wing              – nFish(2): digit confined to n rows × n cols; eliminate from cover
 *   10. Swordfish           – nFish(3): same pattern across 3 rows/cols
 *   11. Jellyfish           – nFish(4): same pattern across 4 rows/cols
 *   12. Y-Wing (XY-Wing)    – pivot with 2 candidates sees two pincers; eliminate shared wing digit
 *   13. XYZ-Wing            – pivot with 3 candidates sees two bivalue pincers; eliminate Z
 */

// ─── Types ──────────────────────────────────────────────────────────────────

type Board = number[][];
type Candidates = Set<number>[][];

interface Move {
  strategy: string;
  row: number;
  col: number;
  digit: number;
  detail: string;
}

interface EliminationResult {
  strategy: string;
  eliminations: { row: number; col: number; digit: number }[];
  detail: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function boxIndex(row: number, col: number): number {
  return Math.floor(row / 3) * 3 + Math.floor(col / 3);
}

/** All [r,c] peers in the same row */
function rowCells(row: number): [number, number][] {
  return Array.from({ length: 9 }, (_, c) => [row, c] as [number, number]);
}

/** All [r,c] peers in the same column */
function colCells(col: number): [number, number][] {
  return Array.from({ length: 9 }, (_, r) => [r, col] as [number, number]);
}

/** All [r,c] peers in the same 3×3 box */
function boxCells(row: number, col: number): [number, number][] {
  const br = Math.floor(row / 3) * 3;
  const bc = Math.floor(col / 3) * 3;
  const cells: [number, number][] = [];
  for (let r = br; r < br + 3; r++)
    for (let c = bc; c < bc + 3; c++)
      cells.push([r, c]);
  return cells;
}

/** Return all three units (row, col, box) for a cell */
function unitsOf(row: number, col: number): [number, number][][] {
  return [rowCells(row), colCells(col), boxCells(row, col)];
}

/** All unique peers of a cell (same row, col, or box — excluding itself) */
function peers(row: number, col: number): [number, number][] {
  const seen = new Set<string>();
  const result: [number, number][] = [];
  for (const unit of unitsOf(row, col)) {
    for (const [r, c] of unit) {
      const key = `${r},${c}`;
      if ((r !== row || c !== col) && !seen.has(key)) {
        seen.add(key);
        result.push([r, c]);
      }
    }
  }
  return result;
}

/** Build initial candidate sets from a solved/partially-solved board */
function buildCandidates(board: Board): Candidates {
  const cands: Candidates = Array.from({ length: 9 }, () =>
    Array.from({ length: 9 }, () => new Set<number>())
  );

  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (board[r][c] !== 0) continue;
      for (let d = 1; d <= 9; d++) {
        let ok = true;
        for (const [pr, pc] of peers(r, c)) {
          if (board[pr][pc] === d) { ok = false; break; }
        }
        if (ok) cands[r][c].add(d);
      }
    }
  }
  return cands;
}

/** Place a digit: update board + remove it from all peer candidate sets */
function place(
  board: Board,
  cands: Candidates,
  row: number,
  col: number,
  digit: number
): void {
  board[row][col] = digit;
  cands[row][col].clear();
  for (const [pr, pc] of peers(row, col)) {
    cands[pr][pc].delete(digit);
  }
}

// ─── Strategies ─────────────────────────────────────────────────────────────

/**
 * Naked Single:
 * A cell has exactly one candidate remaining — it must be that digit.
 */
function nakedSingle(board: Board, cands: Candidates): Move | null {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (board[r][c] !== 0) continue;
      if (cands[r][c].size === 1) {
        const digit = [...cands[r][c]][0];
        return {
          strategy: "Naked Single",
          row: r,
          col: c,
          digit,
          detail: `R${r + 1}C${c + 1} — only candidate is ${digit}`,
        };
      }
    }
  }
  return null;
}

/**
 * Hidden Single:
 * Within a unit (row, col, or box), a digit can go in only one cell.
 */
function hiddenSingle(board: Board, cands: Candidates): Move | null {
  const unitDefs: Array<{ name: string; cells: [number, number][] }> = [];

  for (let i = 0; i < 9; i++) {
    unitDefs.push({ name: `Row ${i + 1}`, cells: rowCells(i) });
    unitDefs.push({ name: `Col ${i + 1}`, cells: colCells(i) });
  }
  for (let br = 0; br < 9; br += 3)
    for (let bc = 0; bc < 9; bc += 3)
      unitDefs.push({
        name: `Box (R${br + 1}-${br + 3}, C${bc + 1}-${bc + 3})`,
        cells: boxCells(br, bc),
      });

  for (const { name, cells } of unitDefs) {
    for (let d = 1; d <= 9; d++) {
      const possible = cells.filter(
        ([r, c]) => board[r][c] === 0 && cands[r][c].has(d)
      );
      if (possible.length === 1) {
        const [r, c] = possible[0];
        return {
          strategy: "Hidden Single",
          row: r,
          col: c,
          digit: d,
          detail: `R${r + 1}C${c + 1} — ${d} is the only place for it in ${name}`,
        };
      }
    }
  }
  return null;
}

/**
 * Pointing Pair / Triple:
 * If all candidates for a digit within a box lie on a single row or column,
 * that digit can be eliminated from the rest of that row or column.
 */
function pointingPairTriple(
  _board: Board,
  cands: Candidates
): EliminationResult | null {
  for (let br = 0; br < 9; br += 3) {
    for (let bc = 0; bc < 9; bc += 3) {
      const cells = boxCells(br, bc);
      for (let d = 1; d <= 9; d++) {
        const hits = cells.filter(([r, c]) => cands[r][c].has(d));
        if (hits.length < 2 || hits.length > 3) continue;

        const rows = [...new Set(hits.map(([r]) => r))];
        const cols = [...new Set(hits.map(([, c]) => c))];

        let eliminations: { row: number; col: number; digit: number }[] = [];
        let lineDesc = "";

        if (rows.length === 1) {
          // All in one row — eliminate from rest of that row outside this box
          const row = rows[0];
          eliminations = rowCells(row)
            .filter(([, c]) => (Math.floor(c / 3) * 3) !== bc && cands[row][c].has(d))
            .map(([r, c]) => ({ row: r, col: c, digit: d }));
          lineDesc = `Row ${row + 1}`;
        } else if (cols.length === 1) {
          // All in one col — eliminate from rest of that col outside this box
          const col = cols[0];
          eliminations = colCells(col)
            .filter(([r]) => (Math.floor(r / 3) * 3) !== br && cands[r][col].has(d))
            .map(([r, c]) => ({ row: r, col: c, digit: d }));
          lineDesc = `Col ${col + 1}`;
        }

        if (eliminations.length > 0) {
          const label = hits.length === 2 ? "Pointing Pair" : "Pointing Triple";
          return {
            strategy: label,
            eliminations,
            detail: `${d} in Box (R${br + 1}-${br + 3},C${bc + 1}-${bc + 3}) is confined to ${lineDesc} — eliminating ${d} from rest of ${lineDesc}`,
          };
        }
      }
    }
  }
  return null;
}

/**
 * Box / Line Reduction:
 * If all candidates for a digit within a row or column lie inside one box,
 * that digit can be eliminated from the rest of that box.
 */
function boxLineReduction(
  board: Board,
  cands: Candidates
): EliminationResult | null {
  for (let d = 1; d <= 9; d++) {
    // Check rows
    for (let r = 0; r < 9; r++) {
      const hits = rowCells(r).filter(
        ([, c]) => board[r][c] === 0 && cands[r][c].has(d)
      );
      if (hits.length < 2 || hits.length > 3) continue;
      const boxCols = [...new Set(hits.map(([, c]) => Math.floor(c / 3)))];
      if (boxCols.length === 1) {
        const bc = boxCols[0] * 3;
        const br = Math.floor(r / 3) * 3;
        const eliminations = boxCells(br, bc)
          .filter(([cr, cc]) => cr !== r && cands[cr][cc].has(d))
          .map(([cr, cc]) => ({ row: cr, col: cc, digit: d }));
        if (eliminations.length > 0) {
          return {
            strategy: "Box/Line Reduction",
            eliminations,
            detail: `${d} in Row ${r + 1} is confined to Box (R${br + 1}-${br + 3},C${bc + 1}-${bc + 3}) — eliminating ${d} from rest of that box`,
          };
        }
      }
    }

    // Check columns
    for (let c = 0; c < 9; c++) {
      const hits = colCells(c).filter(
        ([r]) => board[r][c] === 0 && cands[r][c].has(d)
      );
      if (hits.length < 2 || hits.length > 3) continue;
      const boxRows = [...new Set(hits.map(([r]) => Math.floor(r / 3)))];
      if (boxRows.length === 1) {
        const br = boxRows[0] * 3;
        const bc = Math.floor(c / 3) * 3;
        const eliminations = boxCells(br, bc)
          .filter(([cr, cc]) => cc !== c && cands[cr][cc].has(d))
          .map(([cr, cc]) => ({ row: cr, col: cc, digit: d }));
        if (eliminations.length > 0) {
          return {
            strategy: "Box/Line Reduction",
            eliminations,
            detail: `${d} in Col ${c + 1} is confined to Box (R${br + 1}-${br + 3},C${bc + 1}-${bc + 3}) — eliminating ${d} from rest of that box`,
          };
        }
      }
    }
  }
  return null;
}

/**
 * Naked Pair:
 * Two cells in the same unit both have exactly the same two candidates.
 * Those two digits can be eliminated from all other cells in that unit.
 */
function nakedPair(
  board: Board,
  cands: Candidates
): EliminationResult | null {
  const units: [number, number][][] = [];
  for (let i = 0; i < 9; i++) {
    units.push(rowCells(i));
    units.push(colCells(i));
  }
  for (let br = 0; br < 9; br += 3)
    for (let bc = 0; bc < 9; bc += 3)
      units.push(boxCells(br, bc));

  for (const unit of units) {
    const empties = unit.filter(([r, c]) => board[r][c] === 0);
    for (let i = 0; i < empties.length; i++) {
      const [r1, c1] = empties[i];
      if (cands[r1][c1].size !== 2) continue;
      for (let j = i + 1; j < empties.length; j++) {
        const [r2, c2] = empties[j];
        if (cands[r2][c2].size !== 2) continue;
        const set1 = [...cands[r1][c1]];
        const set2 = [...cands[r2][c2]];
        if (set1[0] === set2[0] && set1[1] === set2[1]) {
          const [d1, d2] = set1;
          const eliminations = unit
            .filter(([r, c]) => {
              if ((r === r1 && c === c1) || (r === r2 && c === c2)) return false;
              return cands[r][c].has(d1) || cands[r][c].has(d2);
            })
            .flatMap(([r, c]) => {
              const elims: { row: number; col: number; digit: number }[] = [];
              if (cands[r][c].has(d1)) elims.push({ row: r, col: c, digit: d1 });
              if (cands[r][c].has(d2)) elims.push({ row: r, col: c, digit: d2 });
              return elims;
            });
          if (eliminations.length > 0) {
            return {
              strategy: "Naked Pair",
              eliminations,
              detail: `Naked Pair {${d1},${d2}} at R${r1 + 1}C${c1 + 1} and R${r2 + 1}C${c2 + 1} — eliminating ${d1} and ${d2} from unit peers`,
            };
          }
        }
      }
    }
  }
  return null;
}

/**
 * Naked Triple:
 * Three cells in a unit collectively contain only three candidates.
 * Those digits can be eliminated from all other cells in that unit.
 */
function nakedTriple(
  board: Board,
  cands: Candidates
): EliminationResult | null {
  const units: [number, number][][] = [];
  for (let i = 0; i < 9; i++) {
    units.push(rowCells(i));
    units.push(colCells(i));
  }
  for (let br = 0; br < 9; br += 3)
    for (let bc = 0; bc < 9; bc += 3)
      units.push(boxCells(br, bc));

  for (const unit of units) {
    const empties = unit.filter(
      ([r, c]) => board[r][c] === 0 && cands[r][c].size >= 2 && cands[r][c].size <= 3
    );
    for (let i = 0; i < empties.length; i++) {
      for (let j = i + 1; j < empties.length; j++) {
        for (let k = j + 1; k < empties.length; k++) {
          const triplet = [empties[i], empties[j], empties[k]] as [number, number][];
          const combined = new Set<number>();
          for (const [r, c] of triplet)
            for (const d of cands[r][c]) combined.add(d);
          if (combined.size !== 3) continue;

          const digits = [...combined];
          const eliminations = unit
            .filter(([r, c]) => !triplet.some(([tr, tc]) => tr === r && tc === c))
            .flatMap(([r, c]) =>
              digits
                .filter((d) => cands[r][c].has(d))
                .map((d) => ({ row: r, col: c, digit: d }))
            );
          if (eliminations.length > 0) {
            const cells = triplet
              .map(([r, c]) => `R${r + 1}C${c + 1}`)
              .join(", ");
            return {
              strategy: "Naked Triple",
              eliminations,
              detail: `Naked Triple {${digits.join(",")}} at ${cells} — eliminating from unit peers`,
            };
          }
        }
      }
    }
  }
  return null;
}

/**
 * Hidden Pair:
 * Two digits appear as candidates in exactly the same two cells within a unit.
 * All other candidates can be removed from those two cells.
 */
function hiddenPair(
  board: Board,
  cands: Candidates
): EliminationResult | null {
  const units: [number, number][][] = [];
  for (let i = 0; i < 9; i++) {
    units.push(rowCells(i));
    units.push(colCells(i));
  }
  for (let br = 0; br < 9; br += 3)
    for (let bc = 0; bc < 9; bc += 3)
      units.push(boxCells(br, bc));

  for (const unit of units) {
    const empties = unit.filter(([r, c]) => board[r][c] === 0);
    // For each digit, which cells can hold it?
    const digitCells: Map<number, [number, number][]> = new Map();
    for (let d = 1; d <= 9; d++) {
      const dc = empties.filter(([r, c]) => cands[r][c].has(d));
      if (dc.length === 2) digitCells.set(d, dc);
    }

    const digits = [...digitCells.keys()];
    for (let i = 0; i < digits.length; i++) {
      for (let j = i + 1; j < digits.length; j++) {
        const d1 = digits[i], d2 = digits[j];
        const cells1 = digitCells.get(d1)!;
        const cells2 = digitCells.get(d2)!;
        if (
          cells1[0][0] === cells2[0][0] && cells1[0][1] === cells2[0][1] &&
          cells1[1][0] === cells2[1][0] && cells1[1][1] === cells2[1][1]
        ) {
          // Same two cells — remove all other candidates from them
          const eliminations: { row: number; col: number; digit: number }[] = [];
          for (const [r, c] of cells1) {
            for (const d of cands[r][c]) {
              if (d !== d1 && d !== d2)
                eliminations.push({ row: r, col: c, digit: d });
            }
          }
          if (eliminations.length > 0) {
            const cellStr = cells1.map(([r, c]) => `R${r + 1}C${c + 1}`).join(", ");
            return {
              strategy: "Hidden Pair",
              eliminations,
              detail: `Hidden Pair {${d1},${d2}} locked in ${cellStr} — removing other candidates from those cells`,
            };
          }
        }
      }
    }
  }
  return null;
}

/**
 * Hidden Triple:
 * Three digits appear as candidates in exactly the same three cells within a unit.
 * All other candidates in those three cells can be removed.
 */
function hiddenTriple(
  board: Board,
  cands: Candidates
): EliminationResult | null {
  const units: [number, number][][] = [];
  for (let i = 0; i < 9; i++) {
    units.push(rowCells(i));
    units.push(colCells(i));
  }
  for (let br = 0; br < 9; br += 3)
    for (let bc = 0; bc < 9; bc += 3)
      units.push(boxCells(br, bc));

  for (const unit of units) {
    const empties = unit.filter(([r, c]) => board[r][c] === 0);
    // Digits that appear in exactly 2 or 3 cells of this unit
    const digitCells: Map<number, [number, number][]> = new Map();
    for (let d = 1; d <= 9; d++) {
      const dc = empties.filter(([r, c]) => cands[r][c].has(d));
      if (dc.length >= 2 && dc.length <= 3) digitCells.set(d, dc);
    }

    const digits = [...digitCells.keys()];
    for (let i = 0; i < digits.length; i++) {
      for (let j = i + 1; j < digits.length; j++) {
        for (let k = j + 1; k < digits.length; k++) {
          const [d1, d2, d3] = [digits[i], digits[j], digits[k]];
          // Union of cells for these three digits
          const cellSet = new Set<string>();
          for (const d of [d1, d2, d3]) {
            for (const [r, c] of digitCells.get(d)!) {
              cellSet.add(`${r},${c}`);
            }
          }
          if (cellSet.size !== 3) continue;

          const tripleCells = [...cellSet].map((key) => {
            const [r, c] = key.split(",").map(Number);
            return [r, c] as [number, number];
          });

          const eliminations: { row: number; col: number; digit: number }[] = [];
          for (const [r, c] of tripleCells) {
            for (const d of cands[r][c]) {
              if (d !== d1 && d !== d2 && d !== d3)
                eliminations.push({ row: r, col: c, digit: d });
            }
          }
          if (eliminations.length > 0) {
            const cellStr = tripleCells.map(([r, c]) => `R${r + 1}C${c + 1}`).join(", ");
            return {
              strategy: "Hidden Triple",
              eliminations,
              detail: `Hidden Triple {${d1},${d2},${d3}} locked in ${cellStr} — removing other candidates from those cells`,
            };
          }
        }
      }
    }
  }
  return null;
}

/**
 * nFish (generalised fish pattern):
 *   n=2 → X-Wing, n=3 → Swordfish, n=4 → Jellyfish
 *
 * Row-based: find n rows where a digit's candidates are confined to the same
 * n columns. Those n columns can have the digit removed everywhere outside
 * those n rows. Column-based is the mirror image.
 *
 * Why it works: the digit must appear exactly once in each of the n base rows.
 * Because all candidates sit in only n cover columns, the digit is "locked"
 * into those column slots by those rows — so no other row in those columns
 * can hold it.
 */
function nFish(
  n: number,
  board: Board,
  cands: Candidates
): EliminationResult | null {
  const names: Record<number, string> = { 2: "X-Wing", 3: "Swordfish", 4: "Jellyfish" };
  const name = names[n] ?? `${n}-Fish`;

  /** Pick all size-n subsets from an array */
  function combos<T>(arr: T[], size: number): T[][] {
    if (size === 0) return [[]];
    if (arr.length < size) return [];
    const [head, ...tail] = arr;
    return [
      ...combos(tail, size - 1).map((c) => [head, ...c]),
      ...combos(tail, size),
    ];
  }

  for (let d = 1; d <= 9; d++) {
    // ── Row-based fish ────────────────────────────────────────────────────
    // For each row, collect the columns where d is a candidate (2..n only)
    const baseRows: [number, number[]][] = [];
    for (let r = 0; r < 9; r++) {
      const cols = rowCells(r)
        .filter(([, c]) => board[r][c] === 0 && cands[r][c].has(d))
        .map(([, c]) => c);
      if (cols.length >= 2 && cols.length <= n) baseRows.push([r, cols]);
    }

    for (const rowSubset of combos(baseRows, n)) {
      const coverCols = [...new Set(rowSubset.flatMap(([, cols]) => cols))];
      if (coverCols.length !== n) continue; // must cover exactly n columns

      const baseRowIdxs = rowSubset.map(([r]) => r);
      const eliminations = coverCols
        .flatMap((c) => colCells(c))
        .filter(
          ([r, c]) =>
            !baseRowIdxs.includes(r) &&
            board[r][c] === 0 &&
            cands[r][c].has(d)
        )
        .map(([r, c]) => ({ row: r, col: c, digit: d }));

      if (eliminations.length > 0) {
        const rowStr = baseRowIdxs.map((r) => r + 1).join("&");
        const colStr = coverCols.map((c) => c + 1).join("&");
        return {
          strategy: name,
          eliminations,
          detail: `${name} on ${d}: rows ${rowStr}, cols ${colStr} — eliminating ${d} from cols ${colStr} outside those rows`,
        };
      }
    }

    // ── Column-based fish ─────────────────────────────────────────────────
    const baseCols: [number, number[]][] = [];
    for (let c = 0; c < 9; c++) {
      const rows = colCells(c)
        .filter(([r]) => board[r][c] === 0 && cands[r][c].has(d))
        .map(([r]) => r);
      if (rows.length >= 2 && rows.length <= n) baseCols.push([c, rows]);
    }

    for (const colSubset of combos(baseCols, n)) {
      const coverRows = [...new Set(colSubset.flatMap(([, rows]) => rows))];
      if (coverRows.length !== n) continue;

      const baseColIdxs = colSubset.map(([c]) => c);
      const eliminations = coverRows
        .flatMap((r) => rowCells(r))
        .filter(
          ([r, c]) =>
            !baseColIdxs.includes(c) &&
            board[r][c] === 0 &&
            cands[r][c].has(d)
        )
        .map(([r, c]) => ({ row: r, col: c, digit: d }));

      if (eliminations.length > 0) {
        const colStr = baseColIdxs.map((c) => c + 1).join("&");
        const rowStr = coverRows.map((r) => r + 1).join("&");
        return {
          strategy: name,
          eliminations,
          detail: `${name} on ${d}: cols ${colStr}, rows ${rowStr} — eliminating ${d} from rows ${rowStr} outside those cols`,
        };
      }
    }
  }
  return null;
}

// Convenience wrappers so the solve loop can call each by name
const xWing    = (b: Board, c: Candidates) => nFish(2, b, c);
const swordfish = (b: Board, c: Candidates) => nFish(3, b, c);
const jellyfish = (b: Board, c: Candidates) => nFish(4, b, c);

/**
 * Y-Wing (XY-Wing):
 * A pivot cell has exactly 2 candidates {A, B}. It sees two pincer cells:
 *   - Pincer 1 has candidates {A, C}
 *   - Pincer 2 has candidates {B, C}
 * Any cell that sees BOTH pincers cannot be C, because:
 *   - If pivot = A → Pincer 2 = C (since pivot's B is gone)
 *   - If pivot = B → Pincer 1 = C (since pivot's A is gone)
 * Either way, C is in one of the pincers, so any mutual peer of both pincers
 * cannot hold C.
 */
function yWing(board: Board, cands: Candidates): EliminationResult | null {
  // Collect all bivalue cells (exactly 2 candidates)
  const bivalue: [number, number][] = [];
  for (let r = 0; r < 9; r++)
    for (let c = 0; c < 9; c++)
      if (board[r][c] === 0 && cands[r][c].size === 2) bivalue.push([r, c]);

  for (const [pr, pc] of bivalue) {
    const [A, B] = [...cands[pr][pc]];
    const pivotPeers = new Set(peers(pr, pc).map(([r, c]) => `${r},${c}`));

    // Find pincers that the pivot can see and that share exactly one candidate with it
    const pincer1List = bivalue.filter(([r, c]) => {
      if (r === pr && c === pc) return false;
      if (!pivotPeers.has(`${r},${c}`)) return false;
      const s = cands[r][c];
      return (s.has(A) && !s.has(B)) || (!s.has(A) && s.has(B));
    });

    for (const [p1r, p1c] of pincer1List) {
      // p1 shares A or B with pivot; the shared digit and C make up p1
      const p1Cands = [...cands[p1r][p1c]];
      // The digit p1 shares with pivot
      const sharedWithPivot1 = p1Cands.find((d) => d === A || d === B)!;
      // The "wing" digit C that p1 brings
      const C1 = p1Cands.find((d) => d !== sharedWithPivot1)!;
      // Pivot's other digit (the one p2 must share with pivot)
      const pivotOther = sharedWithPivot1 === A ? B : A;

      // p2 must share pivotOther with pivot and have C1 as its wing digit
      const p1Peers = new Set(peers(p1r, p1c).map(([r, c]) => `${r},${c}`));

      const pincer2List = bivalue.filter(([r, c]) => {
        if (r === pr && c === pc) return false;
        if (r === p1r && c === p1c) return false;
        if (!pivotPeers.has(`${r},${c}`)) return false;
        const s = cands[r][c];
        return s.has(pivotOther) && s.has(C1);
      });

      for (const [p2r, p2c] of pincer2List) {
        // Eliminate C1 from all cells that see BOTH pincers
        const eliminations: { row: number; col: number; digit: number }[] = [];
        for (let r = 0; r < 9; r++) {
          for (let c = 0; c < 9; c++) {
            if (board[r][c] !== 0) continue;
            if (r === p1r && c === p1c) continue;
            if (r === p2r && c === p2c) continue;
            if (!cands[r][c].has(C1)) continue;
            if (
              p1Peers.has(`${r},${c}`) &&
              peers(p2r, p2c).some(([pr2, pc2]) => pr2 === r && pc2 === c)
            ) {
              eliminations.push({ row: r, col: c, digit: C1 });
            }
          }
        }
        if (eliminations.length > 0) {
          return {
            strategy: "Y-Wing",
            eliminations,
            detail:
              `Y-Wing: pivot R${pr + 1}C${pc + 1} {${A},${B}}, ` +
              `pincers R${p1r + 1}C${p1c + 1} {${sharedWithPivot1},${C1}} & ` +
              `R${p2r + 1}C${p2c + 1} {${pivotOther},${C1}} — eliminating ${C1} from mutual peers`,
          };
        }
      }
    }
  }
  return null;
}

/**
 * XYZ-Wing:
 * Like Y-Wing, but the pivot has 3 candidates {X, Y, Z} instead of 2.
 * Pincer 1 has {X, Z}, Pincer 2 has {Y, Z} (both are bivalue).
 * The pivot sees both pincers. Any cell that sees ALL THREE of pivot,
 * pincer1, and pincer2 cannot be Z.
 *
 * Why: Z must live in one of the three cells (pivot, p1, or p2) within
 * their shared unit, so no mutual peer of all three can hold Z.
 */
function xyzWing(board: Board, cands: Candidates): EliminationResult | null {
  // Collect trivalue pivots
  const trivalue: [number, number][] = [];
  for (let r = 0; r < 9; r++)
    for (let c = 0; c < 9; c++)
      if (board[r][c] === 0 && cands[r][c].size === 3) trivalue.push([r, c]);

  // Bivalue cells for pincers
  const bivalue: [number, number][] = [];
  for (let r = 0; r < 9; r++)
    for (let c = 0; c < 9; c++)
      if (board[r][c] === 0 && cands[r][c].size === 2) bivalue.push([r, c]);

  for (const [pr, pc] of trivalue) {
    const pivotCands = [...cands[pr][pc]]; // [X, Y, Z]
    const pivotPeerSet = new Set(peers(pr, pc).map(([r, c]) => `${r},${c}`));

    // Find bivalue pincers that the pivot sees and that are a subset of pivot's candidates
    const validPincers = bivalue.filter(([r, c]) => {
      if (!pivotPeerSet.has(`${r},${c}`)) return false;
      return [...cands[r][c]].every((d) => pivotCands.includes(d));
    });

    // Need two pincers whose union with pivot covers all 3 pivot digits
    // and whose intersection (the Z digit) is what we eliminate
    for (let i = 0; i < validPincers.length; i++) {
      for (let j = i + 1; j < validPincers.length; j++) {
        const [p1r, p1c] = validPincers[i];
        const [p2r, p2c] = validPincers[j];

        const p1set = [...cands[p1r][p1c]];
        const p2set = [...cands[p2r][p2c]];

        // The shared digit between the two pincers is Z
        const Z = p1set.find((d) => p2set.includes(d));
        if (Z === undefined) continue;

        // Together the two pincers must cover all 3 pivot digits
        const covered = new Set([...p1set, ...p2set]);
        if (!pivotCands.every((d) => covered.has(d))) continue;

        // Eliminate Z from cells that see ALL THREE: pivot, p1, p2
        const p1PeerSet = new Set(peers(p1r, p1c).map(([r, c]) => `${r},${c}`));
        const p2PeerSet = new Set(peers(p2r, p2c).map(([r, c]) => `${r},${c}`));

        const eliminations: { row: number; col: number; digit: number }[] = [];
        for (let r = 0; r < 9; r++) {
          for (let c = 0; c < 9; c++) {
            if (board[r][c] !== 0) continue;
            if ((r === pr && c === pc) || (r === p1r && c === p1c) || (r === p2r && c === p2c)) continue;
            if (!cands[r][c].has(Z)) continue;
            const key = `${r},${c}`;
            if (pivotPeerSet.has(key) && p1PeerSet.has(key) && p2PeerSet.has(key)) {
              eliminations.push({ row: r, col: c, digit: Z });
            }
          }
        }

        if (eliminations.length > 0) {
          return {
            strategy: "XYZ-Wing",
            eliminations,
            detail:
              `XYZ-Wing: pivot R${pr + 1}C${pc + 1} {${pivotCands.join(",")}} — ` +
              `pincers R${p1r + 1}C${p1c + 1} {${p1set.join(",")}} & ` +
              `R${p2r + 1}C${p2c + 1} {${p2set.join(",")}} — eliminating ${Z} from cells seeing all three`,
          };
        }
      }
    }
  }
  return null;
}

// ─── Main Solver ─────────────────────────────────────────────────────────────

function isSolved(board: Board): boolean {
  return board.every((row) => row.every((v) => v !== 0));
}

function applyElimination(
  cands: Candidates,
  result: EliminationResult
): void {
  for (const { row, col, digit } of result.eliminations) {
    cands[row][col].delete(digit);
  }
}

export function solve(
  puzzle: Board,
  verbose = true
): { board: Board; steps: string[]; solved: boolean } {
  const board: Board = puzzle.map((r) => [...r]);
  const cands = buildCandidates(board);
  const steps: string[] = [];

  let stepNum = 0;

  while (!isSolved(board)) {
    let progress = false;

    // --- Placement strategies (find a cell to fill) ---
    const placementFinders = [nakedSingle, hiddenSingle];
    for (const finder of placementFinders) {
      const move = finder(board, cands);
      if (move) {
        stepNum++;
        const msg = `Step ${stepNum}: [${move.strategy}] Place ${move.digit} → ${move.detail}`;
        steps.push(msg);
        if (verbose) console.log(msg);
        place(board, cands, move.row, move.col, move.digit);
        progress = true;
        break; // Restart with simplest strategy first
      }
    }
    if (progress) continue;

    // --- Elimination strategies (narrow candidates) ---
    const eliminationFinders = [
      pointingPairTriple,
      boxLineReduction,
      nakedPair,
      nakedTriple,
      hiddenPair,
      hiddenTriple,
      xWing,
      swordfish,
      jellyfish,
      yWing,
      xyzWing,
    ];
    for (const finder of eliminationFinders) {
      const result = finder(board, cands);
      if (result) {
        stepNum++;
        const elims = result.eliminations
          .map((e) => `${e.digit}@R${e.row + 1}C${e.col + 1}`)
          .join(", ");
        const msg = `Step ${stepNum}: [${result.strategy}] Eliminate ${elims} — ${result.detail}`;
        steps.push(msg);
        if (verbose) console.log(msg);
        applyElimination(cands, result);
        progress = true;
        break; // Restart from simplest
      }
    }
    if (progress) continue;

    // No strategy made progress
    break;
  }

  return { board, steps, solved: isSolved(board) };
}

// ─── Display ─────────────────────────────────────────────────────────────────

function printBoard(board: Board, label?: string): void {
  if (label) console.log(`\n${label}`);
  console.log("┌───────┬───────┬───────┐");
  for (let r = 0; r < 9; r++) {
    if (r > 0 && r % 3 === 0) console.log("├───────┼───────┼───────┤");
    const row = "│ " + [0, 3, 6]
      .map((bc) =>
        board[r].slice(bc, bc + 3).map((v) => (v === 0 ? "." : v)).join(" ")
      )
      .join(" │ ") + " │";
    console.log(row);
  }
  console.log("└───────┴───────┴───────┘");
}

// ─── Puzzles ──────────────────────────────────────────────────────────────────

// Easy puzzle — solvable with Naked Singles only
const easy: Board = [
  [5, 3, 0, 0, 7, 0, 0, 0, 0],
  [6, 0, 0, 1, 9, 5, 0, 0, 0],
  [0, 9, 8, 0, 0, 0, 0, 6, 0],
  [8, 0, 0, 0, 6, 0, 0, 0, 3],
  [4, 0, 0, 8, 0, 3, 0, 0, 1],
  [7, 0, 0, 0, 2, 0, 0, 0, 6],
  [0, 6, 0, 0, 0, 0, 2, 8, 0],
  [0, 0, 0, 4, 1, 9, 0, 0, 5],
  [0, 0, 0, 0, 8, 0, 0, 7, 9],
];

// Medium puzzle — requires Hidden Singles
const medium: Board = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 3, 0, 8, 5],
  [0, 0, 1, 0, 2, 0, 0, 0, 0],
  [0, 0, 0, 5, 0, 7, 0, 0, 0],
  [0, 0, 4, 0, 0, 0, 1, 0, 0],
  [0, 9, 0, 0, 0, 0, 0, 0, 0],
  [5, 0, 0, 0, 0, 0, 0, 7, 3],
  [0, 0, 2, 0, 1, 0, 0, 0, 0],
  [0, 0, 0, 0, 4, 0, 0, 0, 9],
];

// Hard puzzle — requires Pointing Pairs, Naked Pairs, Hidden Pairs, Box/Line Reduction
const hard: Board = [
  [0, 2, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 6, 0, 0, 0, 0, 3],
  [0, 7, 4, 0, 8, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 3, 0, 0, 2],
  [0, 8, 0, 0, 4, 0, 0, 1, 0],
  [6, 0, 0, 5, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 1, 0, 7, 8, 0],
  [5, 0, 0, 0, 0, 9, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 4, 0],
];

// ─── Run ─────────────────────────────────────────────────────────────────────

function printSummary(result: ReturnType<typeof solve>): void {
  const used: Record<string, number> = {};
  for (const step of result.steps) {
    const m = step.match(/\[([^\]]+)\]/);
    if (m) used[m[1]] = (used[m[1]] ?? 0) + 1;
  }
  const breakdown = Object.entries(used)
    .map(([k, v]) => `${k} ×${v}`)
    .join("  |  ");
  console.log(`\nTotal steps: ${result.steps.length} | Solved: ${result.solved}`);
  if (breakdown) console.log(`Strategies: ${breakdown}`);
}

console.log("═══════════════════════════════════════════════════════");
console.log("            HUMAN-STRATEGY SUDOKU SOLVER               ");
console.log("═══════════════════════════════════════════════════════");

// --- Easy ---
printBoard(easy, "EASY PUZZLE (Naked Singles):");
console.log("\n── Solving steps ──────────────────────────────────────");
const easyResult = solve(easy, true);
printBoard(easyResult.board, easyResult.solved ? "SOLVED:" : "STUCK (partial solution):");
printSummary(easyResult);

console.log("\n\n═══════════════════════════════════════════════════════");

// --- Medium ---
printBoard(medium, "MEDIUM PUZZLE (Hidden Singles):");
console.log("\n── Solving steps ──────────────────────────────────────");
const medResult = solve(medium, true);
printBoard(medResult.board, medResult.solved ? "SOLVED:" : "STUCK (partial solution):");
printSummary(medResult);

console.log("\n\n═══════════════════════════════════════════════════════");

// --- Hard ---
printBoard(hard, "HARD PUZZLE (Pointing Pairs, Naked Pairs, Hidden Pairs, Box/Line Reduction):");
console.log("\n── Solving steps ──────────────────────────────────────");
const hardResult = solve(hard, true);
printBoard(hardResult.board, hardResult.solved ? "SOLVED:" : "STUCK (partial solution):");
printSummary(hardResult);
