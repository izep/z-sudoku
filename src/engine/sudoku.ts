// ─── Core Types ───────────────────────────────────────────────────────────────
export type Board = number[][]
export type Candidates = Set<number>[][]

export interface SolveResult {
  board: Board
  steps: string[]
  solved: boolean
}

export interface HintResult {
  /** Strategy that will make progress */
  strategy: string
  /** Cells directly involved in the pattern */
  patternCells: [number, number][]
  /** Cells where candidates are eliminated (elimination strategies) */
  eliminationCells: [number, number][]
  /** The digit involved */
  digit: number
  /** Human-readable explanation */
  detail: string
  /** If a cell can be placed: the row, col, and value */
  placement?: { row: number; col: number; digit: number }
  /** Digits to eliminate from eliminationCells */
  eliminations?: { row: number; col: number; digit: number }[]
}

export interface ScoreResult {
  score: number
  difficulty: number
  solvable: boolean
  strategies: Record<string, number>
}

export interface GeneratorResult {
  puzzle: Board
  solution: Board
  score: number
  difficulty: number
  clues: number
  strategies: Record<string, number>
}

// ─── Strategy Weights ─────────────────────────────────────────────────────────
export const STRATEGY_WEIGHTS: Record<string, number> = {
  'Naked Single': 1,
  'Hidden Single': 2,
  'Pointing Pair': 5,
  'Pointing Triple': 6,
  'Box/Line Reduction': 6,
  'Naked Pair': 8,
  'Naked Triple': 12,
  'Hidden Pair': 15,
  'Hidden Triple': 20,
  'X-Wing': 25,
  'Swordfish': 35,
  'Jellyfish': 50,
  'Y-Wing': 60,
  'XYZ-Wing': 80,
}

export const MAX_WEIGHT = Math.max(...Object.values(STRATEGY_WEIGHTS))

// ─── Board Helpers ────────────────────────────────────────────────────────────
function rowCells(row: number): [number, number][] {
  return Array.from({ length: 9 }, (_, c) => [row, c])
}
function colCells(col: number): [number, number][] {
  return Array.from({ length: 9 }, (_, r) => [r, col])
}
function boxCells(row: number, col: number): [number, number][] {
  const br = Math.floor(row / 3) * 3
  const bc = Math.floor(col / 3) * 3
  const cells: [number, number][] = []
  for (let r = br; r < br + 3; r++)
    for (let c = bc; c < bc + 3; c++) cells.push([r, c])
  return cells
}
function peers(row: number, col: number): [number, number][] {
  const seen = new Set<string>()
  const result: [number, number][] = []
  for (const unit of [rowCells(row), colCells(col), boxCells(row, col)]) {
    for (const [r, c] of unit) {
      const key = `${r},${c}`
      if ((r !== row || c !== col) && !seen.has(key)) {
        seen.add(key)
        result.push([r, c])
      }
    }
  }
  return result
}

export function buildCandidates(board: Board): Candidates {
  const cands: Candidates = Array.from({ length: 9 }, () =>
    Array.from({ length: 9 }, () => new Set<number>())
  )
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (board[r][c] !== 0) continue
      for (let d = 1; d <= 9; d++) {
        let ok = true
        for (const [pr, pc] of peers(r, c)) {
          if (board[pr][pc] === d) { ok = false; break }
        }
        if (ok) cands[r][c].add(d)
      }
    }
  }
  return cands
}

function place(board: Board, cands: Candidates, row: number, col: number, digit: number) {
  board[row][col] = digit
  cands[row][col].clear()
  for (const [pr, pc] of peers(row, col)) cands[pr][pc].delete(digit)
}

function applyElim(cands: Candidates, elims: { row: number; col: number; digit: number }[]) {
  for (const { row, col, digit } of elims) cands[row][col].delete(digit)
}

// ─── Individual Strategies ───────────────────────────────────────────────────

function nakedSingle(board: Board, cands: Candidates) {
  for (let r = 0; r < 9; r++)
    for (let c = 0; c < 9; c++)
      if (board[r][c] === 0 && cands[r][c].size === 1) {
        const digit = [...cands[r][c]][0]
        return {
          strategy: 'Naked Single', patternCells: [[r, c]] as [number, number][],
          eliminationCells: [], digit,
          detail: `R${r+1}C${c+1} — only candidate is ${digit}`,
          placement: { row: r, col: c, digit }
        }
      }
  return null
}

function hiddenSingle(board: Board, cands: Candidates) {
  const units: { name: string; cells: [number, number][] }[] = []
  for (let i = 0; i < 9; i++) {
    units.push({ name: `Row ${i+1}`, cells: rowCells(i) })
    units.push({ name: `Col ${i+1}`, cells: colCells(i) })
  }
  for (let br = 0; br < 9; br += 3)
    for (let bc = 0; bc < 9; bc += 3)
      units.push({ name: `Box (R${br+1}-${br+3},C${bc+1}-${bc+3})`, cells: boxCells(br, bc) })

  for (const { name, cells } of units) {
    for (let d = 1; d <= 9; d++) {
      const possible = cells.filter(([r, c]) => board[r][c] === 0 && cands[r][c].has(d))
      if (possible.length === 1) {
        const [r, c] = possible[0]
        return {
          strategy: 'Hidden Single', patternCells: [[r, c]] as [number, number][],
          eliminationCells: [], digit: d,
          detail: `R${r+1}C${c+1} — ${d} is the only place for it in ${name}`,
          placement: { row: r, col: c, digit: d }
        }
      }
    }
  }
  return null
}

function pointingPairTriple(_board: Board, cands: Candidates) {
  for (let br = 0; br < 9; br += 3) {
    for (let bc = 0; bc < 9; bc += 3) {
      const cells = boxCells(br, bc)
      for (let d = 1; d <= 9; d++) {
        const hits = cells.filter(([r, c]) => cands[r][c].has(d))
        if (hits.length < 2 || hits.length > 3) continue
        const rows = [...new Set(hits.map(([r]) => r))]
        const cols = [...new Set(hits.map(([, c]) => c))]
        let elims: { row: number; col: number; digit: number }[] = []
        let lineDesc = ''
        if (rows.length === 1) {
          const row = rows[0]
          elims = rowCells(row)
            .filter(([, c]) => Math.floor(c / 3) * 3 !== bc && cands[row][c].has(d))
            .map(([r, c]) => ({ row: r, col: c, digit: d }))
          lineDesc = `Row ${row+1}`
        } else if (cols.length === 1) {
          const col = cols[0]
          elims = colCells(col)
            .filter(([r]) => Math.floor(r / 3) * 3 !== br && cands[r][col].has(d))
            .map(([r, c]) => ({ row: r, col: c, digit: d }))
          lineDesc = `Col ${col+1}`
        }
        if (elims.length > 0) {
          const label = hits.length === 2 ? 'Pointing Pair' : 'Pointing Triple'
          return {
            strategy: label, patternCells: hits, digit: d,
            eliminationCells: elims.map(e => [e.row, e.col] as [number, number]),
            detail: `${d} in Box(R${br+1}-${br+3},C${bc+1}-${bc+3}) confined to ${lineDesc} — eliminating ${d} from rest of ${lineDesc}`,
            eliminations: elims
          }
        }
      }
    }
  }
  return null
}

function boxLineReduction(board: Board, cands: Candidates) {
  for (let d = 1; d <= 9; d++) {
    for (let r = 0; r < 9; r++) {
      const hits = rowCells(r).filter(([, c]) => board[r][c] === 0 && cands[r][c].has(d))
      if (hits.length < 2 || hits.length > 3) continue
      const bcs = [...new Set(hits.map(([, c]) => Math.floor(c / 3)))]
      if (bcs.length === 1) {
        const bc = bcs[0] * 3, br = Math.floor(r / 3) * 3
        const elims = boxCells(br, bc)
          .filter(([cr, cc]) => cr !== r && cands[cr][cc].has(d))
          .map(([cr, cc]) => ({ row: cr, col: cc, digit: d }))
        if (elims.length > 0)
          return {
            strategy: 'Box/Line Reduction',
            patternCells: hits, digit: d,
            eliminationCells: elims.map(e => [e.row, e.col] as [number, number]),
            detail: `${d} in Row ${r+1} confined to Box(R${br+1}-${br+3},C${bc+1}-${bc+3}) — eliminating from rest of box`,
            eliminations: elims
          }
      }
    }
    for (let c = 0; c < 9; c++) {
      const hits = colCells(c).filter(([r]) => board[r][c] === 0 && cands[r][c].has(d))
      if (hits.length < 2 || hits.length > 3) continue
      const brs = [...new Set(hits.map(([r]) => Math.floor(r / 3)))]
      if (brs.length === 1) {
        const br = brs[0] * 3, bc = Math.floor(c / 3) * 3
        const elims = boxCells(br, bc)
          .filter(([cr, cc]) => cc !== c && cands[cr][cc].has(d))
          .map(([cr, cc]) => ({ row: cr, col: cc, digit: d }))
        if (elims.length > 0)
          return {
            strategy: 'Box/Line Reduction',
            patternCells: hits, digit: d,
            eliminationCells: elims.map(e => [e.row, e.col] as [number, number]),
            detail: `${d} in Col ${c+1} confined to Box(R${br+1}-${br+3},C${bc+1}-${bc+3}) — eliminating from rest of box`,
            eliminations: elims
          }
      }
    }
  }
  return null
}

function nakedPair(board: Board, cands: Candidates) {
  const units: [number, number][][] = []
  for (let i = 0; i < 9; i++) { units.push(rowCells(i)); units.push(colCells(i)) }
  for (let br = 0; br < 9; br += 3) for (let bc = 0; bc < 9; bc += 3) units.push(boxCells(br, bc))
  for (const unit of units) {
    const emp = unit.filter(([r, c]) => board[r][c] === 0)
    for (let i = 0; i < emp.length; i++) {
      const [r1, c1] = emp[i]; if (cands[r1][c1].size !== 2) continue
      for (let j = i + 1; j < emp.length; j++) {
        const [r2, c2] = emp[j]; if (cands[r2][c2].size !== 2) continue
        const s1 = [...cands[r1][c1]], s2 = [...cands[r2][c2]]
        if (s1[0] !== s2[0] || s1[1] !== s2[1]) continue
        const [d1, d2] = s1
        const elims = unit
          .filter(([r, c]) => !((r===r1&&c===c1)||(r===r2&&c===c2)))
          .flatMap(([r, c]) => {
            const e: { row: number; col: number; digit: number }[] = []
            if (cands[r][c].has(d1)) e.push({ row: r, col: c, digit: d1 })
            if (cands[r][c].has(d2)) e.push({ row: r, col: c, digit: d2 })
            return e
          })
        if (elims.length > 0)
          return {
            strategy: 'Naked Pair',
            patternCells: [[r1,c1],[r2,c2]] as [number,number][],
            digit: d1, eliminationCells: elims.map(e => [e.row, e.col] as [number,number]),
            detail: `Naked Pair {${d1},${d2}} at R${r1+1}C${c1+1} & R${r2+1}C${c2+1}`,
            eliminations: elims
          }
      }
    }
  }
  return null
}

function nakedTriple(board: Board, cands: Candidates) {
  const units: [number, number][][] = []
  for (let i = 0; i < 9; i++) { units.push(rowCells(i)); units.push(colCells(i)) }
  for (let br = 0; br < 9; br += 3) for (let bc = 0; bc < 9; bc += 3) units.push(boxCells(br, bc))
  for (const unit of units) {
    const emp = unit.filter(([r, c]) => board[r][c] === 0 && cands[r][c].size >= 2 && cands[r][c].size <= 3)
    for (let i = 0; i < emp.length; i++)
      for (let j = i+1; j < emp.length; j++)
        for (let k = j+1; k < emp.length; k++) {
          const trip = [emp[i], emp[j], emp[k]] as [number,number][]
          const combined = new Set<number>()
          for (const [r, c] of trip) for (const d of cands[r][c]) combined.add(d)
          if (combined.size !== 3) continue
          const digits = [...combined]
          const elims = unit
            .filter(([r, c]) => !trip.some(([tr, tc]) => tr===r && tc===c))
            .flatMap(([r, c]) => digits.filter(d => cands[r][c].has(d)).map(d => ({ row: r, col: c, digit: d })))
          if (elims.length > 0)
            return {
              strategy: 'Naked Triple', patternCells: trip, digit: digits[0],
              eliminationCells: elims.map(e => [e.row, e.col] as [number,number]),
              detail: `Naked Triple {${digits.join(',')}} at ${trip.map(([r,c])=>`R${r+1}C${c+1}`).join(', ')}`,
              eliminations: elims
            }
        }
  }
  return null
}

function hiddenPair(board: Board, cands: Candidates) {
  const units: [number, number][][] = []
  for (let i = 0; i < 9; i++) { units.push(rowCells(i)); units.push(colCells(i)) }
  for (let br = 0; br < 9; br += 3) for (let bc = 0; bc < 9; bc += 3) units.push(boxCells(br, bc))
  for (const unit of units) {
    const emp = unit.filter(([r, c]) => board[r][c] === 0)
    const dcells = new Map<number, [number,number][]>()
    for (let d = 1; d <= 9; d++) {
      const dc = emp.filter(([r, c]) => cands[r][c].has(d))
      if (dc.length === 2) dcells.set(d, dc)
    }
    const digits = [...dcells.keys()]
    for (let i = 0; i < digits.length; i++)
      for (let j = i+1; j < digits.length; j++) {
        const [d1, d2] = [digits[i], digits[j]]
        const c1 = dcells.get(d1)!, c2 = dcells.get(d2)!
        if (c1[0][0]!==c2[0][0]||c1[0][1]!==c2[0][1]||c1[1][0]!==c2[1][0]||c1[1][1]!==c2[1][1]) continue
        const elims: { row: number; col: number; digit: number }[] = []
        for (const [r, c] of c1)
          for (const d of cands[r][c])
            if (d!==d1 && d!==d2) elims.push({ row: r, col: c, digit: d })
        if (elims.length > 0)
          return {
            strategy: 'Hidden Pair', patternCells: c1, digit: d1,
            eliminationCells: elims.map(e => [e.row, e.col] as [number,number]),
            detail: `Hidden Pair {${d1},${d2}} at ${c1.map(([r,c])=>`R${r+1}C${c+1}`).join(' & ')}`,
            eliminations: elims
          }
      }
  }
  return null
}

function hiddenTriple(board: Board, cands: Candidates) {
  const units: [number, number][][] = []
  for (let i = 0; i < 9; i++) { units.push(rowCells(i)); units.push(colCells(i)) }
  for (let br = 0; br < 9; br += 3) for (let bc = 0; bc < 9; bc += 3) units.push(boxCells(br, bc))
  for (const unit of units) {
    const emp = unit.filter(([r, c]) => board[r][c] === 0)
    const dcells = new Map<number, [number,number][]>()
    for (let d = 1; d <= 9; d++) {
      const dc = emp.filter(([r, c]) => cands[r][c].has(d))
      if (dc.length >= 2 && dc.length <= 3) dcells.set(d, dc)
    }
    const digits = [...dcells.keys()]
    for (let i = 0; i < digits.length; i++)
      for (let j = i+1; j < digits.length; j++)
        for (let k = j+1; k < digits.length; k++) {
          const [d1, d2, d3] = [digits[i], digits[j], digits[k]]
          const cellSet = new Set<string>()
          for (const d of [d1,d2,d3]) for (const [r,c] of dcells.get(d)!) cellSet.add(`${r},${c}`)
          if (cellSet.size !== 3) continue
          const tripleCells = [...cellSet].map(k => k.split(',').map(Number) as [number,number])
          const elims: { row: number; col: number; digit: number }[] = []
          for (const [r, c] of tripleCells)
            for (const d of cands[r][c])
              if (d!==d1 && d!==d2 && d!==d3) elims.push({ row: r, col: c, digit: d })
          if (elims.length > 0)
            return {
              strategy: 'Hidden Triple', patternCells: tripleCells, digit: d1,
              eliminationCells: elims.map(e => [e.row, e.col] as [number,number]),
              detail: `Hidden Triple {${d1},${d2},${d3}} at ${tripleCells.map(([r,c])=>`R${r+1}C${c+1}`).join(', ')}`,
              eliminations: elims
            }
        }
  }
  return null
}

function combos<T>(arr: T[], n: number): T[][] {
  if (n === 0) return [[]]
  if (arr.length < n) return []
  const [h, ...t] = arr
  return [...combos(t, n-1).map(c => [h, ...c]), ...combos(t, n)]
}

function nFishStrategy(n: number, board: Board, cands: Candidates) {
  const nm: Record<number, string> = { 2: 'X-Wing', 3: 'Swordfish', 4: 'Jellyfish' }
  const name = nm[n] ?? `${n}-Fish`
  for (let d = 1; d <= 9; d++) {
    const baseRows: [number, number[]][] = []
    for (let r = 0; r < 9; r++) {
      const cols = rowCells(r).filter(([, c]) => board[r][c]===0 && cands[r][c].has(d)).map(([,c])=>c)
      if (cols.length >= 2 && cols.length <= n) baseRows.push([r, cols])
    }
    for (const sub of combos(baseRows, n)) {
      const cvr = [...new Set(sub.flatMap(([, cs]) => cs))]
      if (cvr.length !== n) continue
      const idxs = sub.map(([r]) => r)
      const patternCells: [number,number][] = sub.flatMap(([r, cs]) => cs.map(c => [r, c] as [number,number]))
      const elims: { row: number; col: number; digit: number }[] = []
      for (const c of cvr)
        for (let r = 0; r < 9; r++)
          if (!idxs.includes(r) && board[r][c]===0 && cands[r][c].has(d))
            elims.push({ row: r, col: c, digit: d })
      if (elims.length > 0)
        return {
          strategy: name, patternCells, digit: d,
          eliminationCells: elims.map(e => [e.row, e.col] as [number,number]),
          detail: `${name} on ${d}: rows [${idxs.map(r=>r+1)}], cols [${cvr.map(c=>c+1)}]`,
          eliminations: elims
        }
    }
    const baseCols: [number, number[]][] = []
    for (let c = 0; c < 9; c++) {
      const rows = colCells(c).filter(([r]) => board[r][c]===0 && cands[r][c].has(d)).map(([r])=>r)
      if (rows.length >= 2 && rows.length <= n) baseCols.push([c, rows])
    }
    for (const sub of combos(baseCols, n)) {
      const cvr = [...new Set(sub.flatMap(([, rs]) => rs))]
      if (cvr.length !== n) continue
      const idxs = sub.map(([c]) => c)
      const patternCells: [number,number][] = sub.flatMap(([c, rs]) => rs.map(r => [r, c] as [number,number]))
      const elims: { row: number; col: number; digit: number }[] = []
      for (const r of cvr)
        for (let c = 0; c < 9; c++)
          if (!idxs.includes(c) && board[r][c]===0 && cands[r][c].has(d))
            elims.push({ row: r, col: c, digit: d })
      if (elims.length > 0)
        return {
          strategy: name, patternCells, digit: d,
          eliminationCells: elims.map(e => [e.row, e.col] as [number,number]),
          detail: `${name} on ${d}: cols [${idxs.map(c=>c+1)}], rows [${cvr.map(r=>r+1)}]`,
          eliminations: elims
        }
    }
  }
  return null
}

function yWingStrategy(board: Board, cands: Candidates) {
  const biv: [number,number][] = []
  for (let r=0;r<9;r++) for (let c=0;c<9;c++) if (board[r][c]===0 && cands[r][c].size===2) biv.push([r,c])
  for (const [pr, pc] of biv) {
    const [A, B] = [...cands[pr][pc]]
    const pivPeers = new Set(peers(pr,pc).map(([r,c])=>`${r},${c}`))
    const p1list = biv.filter(([r,c]) => {
      if (r===pr&&c===pc) return false
      if (!pivPeers.has(`${r},${c}`)) return false
      const s = cands[r][c]
      return (s.has(A)&&!s.has(B))||(!s.has(A)&&s.has(B))
    })
    for (const [p1r, p1c] of p1list) {
      const p1c_arr = [...cands[p1r][p1c]]
      const shared1 = p1c_arr.find(d => d===A||d===B)!
      const C = p1c_arr.find(d => d!==shared1)!
      const pivOther = shared1===A ? B : A
      const p1Peers = new Set(peers(p1r,p1c).map(([r,c])=>`${r},${c}`))
      const p2list = biv.filter(([r,c]) => {
        if ((r===pr&&c===pc)||(r===p1r&&c===p1c)) return false
        if (!pivPeers.has(`${r},${c}`)) return false
        return cands[r][c].has(pivOther) && cands[r][c].has(C)
      })
      for (const [p2r, p2c] of p2list) {
        const elims: { row: number; col: number; digit: number }[] = []
        for (let r=0;r<9;r++) for (let c=0;c<9;c++) {
          if (board[r][c]!==0||!cands[r][c].has(C)) continue
          if ((r===p1r&&c===p1c)||(r===p2r&&c===p2c)) continue
          if (p1Peers.has(`${r},${c}`) && peers(p2r,p2c).some(([rr,cc])=>rr===r&&cc===c))
            elims.push({ row: r, col: c, digit: C })
        }
        if (elims.length > 0)
          return {
            strategy: 'Y-Wing',
            patternCells: [[pr,pc],[p1r,p1c],[p2r,p2c]] as [number,number][],
            digit: C,
            eliminationCells: elims.map(e => [e.row, e.col] as [number,number]),
            detail: `Y-Wing: pivot R${pr+1}C${pc+1}{${A},${B}} pincers R${p1r+1}C${p1c+1} & R${p2r+1}C${p2c+1} — eliminating ${C}`,
            eliminations: elims
          }
      }
    }
  }
  return null
}

function xyzWingStrategy(board: Board, cands: Candidates) {
  const triv: [number,number][] = [], biv: [number,number][] = []
  for (let r=0;r<9;r++) for (let c=0;c<9;c++) {
    if (board[r][c]!==0) continue
    if (cands[r][c].size===3) triv.push([r,c])
    if (cands[r][c].size===2) biv.push([r,c])
  }
  for (const [pr, pc] of triv) {
    const pca = [...cands[pr][pc]]
    const pivP = new Set(peers(pr,pc).map(([r,c])=>`${r},${c}`))
    const vp = biv.filter(([r,c]) => pivP.has(`${r},${c}`) && [...cands[r][c]].every(d => pca.includes(d)))
    for (let i=0;i<vp.length;i++) for (let j=i+1;j<vp.length;j++) {
      const [p1r,p1c]=vp[i],[p2r,p2c]=vp[j]
      const p1s=[...cands[p1r][p1c]], p2s=[...cands[p2r][p2c]]
      const Z = p1s.find(d => p2s.includes(d)); if (!Z) continue
      const cov = new Set([...p1s,...p2s]); if (!pca.every(d => cov.has(d))) continue
      const p1P = new Set(peers(p1r,p1c).map(([r,c])=>`${r},${c}`))
      const p2P = new Set(peers(p2r,p2c).map(([r,c])=>`${r},${c}`))
      const elims: { row: number; col: number; digit: number }[] = []
      for (let r=0;r<9;r++) for (let c=0;c<9;c++) {
        if (board[r][c]!==0||!cands[r][c].has(Z)) continue
        if ((r===pr&&c===pc)||(r===p1r&&c===p1c)||(r===p2r&&c===p2c)) continue
        const k = `${r},${c}`
        if (pivP.has(k)&&p1P.has(k)&&p2P.has(k)) elims.push({ row: r, col: c, digit: Z })
      }
      if (elims.length > 0)
        return {
          strategy: 'XYZ-Wing',
          patternCells: [[pr,pc],[p1r,p1c],[p2r,p2c]] as [number,number][],
          digit: Z,
          eliminationCells: elims.map(e => [e.row, e.col] as [number,number]),
          detail: `XYZ-Wing: pivot R${pr+1}C${pc+1}{${pca.join(',')}} pincers R${p1r+1}C${p1c+1} & R${p2r+1}C${p2c+1} — eliminating ${Z}`,
          eliminations: elims
        }
    }
  }
  return null
}

// ─── Public Solver ────────────────────────────────────────────────────────────

export function solve(puzzle: Board, verbose = false): SolveResult {
  const board = puzzle.map(r => [...r])
  const cands = buildCandidates(board)
  const steps: string[] = []
  let n = 0

  const placement = [nakedSingle, hiddenSingle]
  const elimination = [
    pointingPairTriple, boxLineReduction, nakedPair, nakedTriple,
    hiddenPair, hiddenTriple,
    (b: Board, c: Candidates) => nFishStrategy(2, b, c),
    (b: Board, c: Candidates) => nFishStrategy(3, b, c),
    (b: Board, c: Candidates) => nFishStrategy(4, b, c),
    yWingStrategy, xyzWingStrategy
  ]

  while (board.some(r => r.some(v => v === 0))) {
    let progress = false
    for (const fn of placement) {
      const h = fn(board, cands)
      if (h?.placement) {
        n++; const msg = `Step ${n}: [${h.strategy}] ${h.detail}`
        steps.push(msg); if (verbose) console.log(msg)
        place(board, cands, h.placement.row, h.placement.col, h.placement.digit)
        progress = true; break
      }
    }
    if (progress) continue
    for (const fn of elimination) {
      const h = fn(board, cands)
      if (h?.eliminations?.length) {
        n++; const msg = `Step ${n}: [${h.strategy}] ${h.detail}`
        steps.push(msg); if (verbose) console.log(msg)
        applyElim(cands, h.eliminations)
        progress = true; break
      }
    }
    if (!progress) break
  }

  return { board, steps, solved: board.every(r => r.every(v => v !== 0)) }
}

// ─── Hint Engine ──────────────────────────────────────────────────────────────

/**
 * Given the current board state, return the next logical hint.
 * This is what drives the hint UI.
 */
export function getHint(board: Board): HintResult | null {
  const cands = buildCandidates(board)
  const placement = [nakedSingle, hiddenSingle]
  const elimination = [
    pointingPairTriple, boxLineReduction, nakedPair, nakedTriple,
    hiddenPair, hiddenTriple,
    (b: Board, c: Candidates) => nFishStrategy(2, b, c),
    (b: Board, c: Candidates) => nFishStrategy(3, b, c),
    (b: Board, c: Candidates) => nFishStrategy(4, b, c),
    yWingStrategy, xyzWingStrategy
  ]
  for (const fn of [...placement, ...elimination]) {
    const h = fn(board, cands)
    if (h) return h as HintResult
  }
  return null
}

// ─── Difficulty Scorer ────────────────────────────────────────────────────────

export function scorePuzzle(puzzle: Board): ScoreResult {
  const result = solve(puzzle, false)
  const strategies: Record<string, number> = {}
  for (const step of result.steps) {
    const m = step.match(/\[([^\]]+)\]/)
    if (m) strategies[m[1]] = (strategies[m[1]] ?? 0) + 1
  }
  let score = 0
  for (const [name, count] of Object.entries(strategies))
    score += (STRATEGY_WEIGHTS[name] ?? 0) * count
  const difficulty = 1 - Math.exp(-score / MAX_WEIGHT)
  return { score, difficulty, solvable: result.solved, strategies }
}

// ─── Solution Generator ───────────────────────────────────────────────────────

function isLegal(board: Board, r: number, c: number, d: number): boolean {
  for (let i = 0; i < 9; i++) if (board[r][i] === d || board[i][c] === d) return false
  const br = Math.floor(r/3)*3, bc = Math.floor(c/3)*3
  for (let i=br;i<br+3;i++) for (let j=bc;j<bc+3;j++) if (board[i][j]===d) return false
  return true
}

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length-1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i+1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function generateSolution(): Board {
  const board: Board = Array.from({ length: 9 }, () => Array(9).fill(0))
  function fill(pos: number): boolean {
    if (pos === 81) return true
    const r = Math.floor(pos/9), c = pos%9
    for (const d of shuffled([1,2,3,4,5,6,7,8,9])) {
      if (isLegal(board, r, c, d)) {
        board[r][c] = d
        if (fill(pos+1)) return true
        board[r][c] = 0
      }
    }
    return false
  }
  fill(0)
  return board
}

export function countSolutions(puzzle: Board, limit = 2): number {
  const board = puzzle.map(r => [...r])
  let count = 0
  function bt(pos: number) {
    if (count >= limit) return
    if (pos === 81) { count++; return }
    const r = Math.floor(pos/9), c = pos%9
    if (board[r][c] !== 0) { bt(pos+1); return }
    for (let d = 1; d <= 9; d++) {
      if (count >= limit) return
      if (isLegal(board, r, c, d)) { board[r][c] = d; bt(pos+1); board[r][c] = 0 }
    }
  }
  bt(0)
  return count
}

export function generate(
  targetDifficulty = 0.5,
  minClues = 22
): GeneratorResult {
  const target = Math.max(0, Math.min(1, targetDifficulty))
  let bestResult: GeneratorResult | null = null

  for (let attempt = 0; attempt < 40; attempt++) {
    const solution = generateSolution()
    const puzzle = solution.map(r => [...r])
    const positions = shuffled(Array.from({ length: 81 }, (_, i) => i))
    const pairs: [number, number][] = []
    const seen = new Set<number>()
    for (const pos of positions) {
      if (seen.has(pos)) continue
      const mirror = 80 - pos; seen.add(pos); seen.add(mirror)
      pairs.push([pos, mirror])
    }

    let lastPuzzle = puzzle.map(r => [...r])
    let lastScore = scorePuzzle(puzzle)

    for (const [pos, mirror] of pairs) {
      const r1 = Math.floor(pos/9), c1 = pos%9
      const r2 = Math.floor(mirror/9), c2 = mirror%9
      const v1 = puzzle[r1][c1], v2 = puzzle[r2][c2]
      if (v1===0 && v2===0) continue
      let removals = (v1!==0?1:0)
      if (r2!==r1||c2!==c1) removals += (v2!==0?1:0)
      const cluesAfter = puzzle.flat().filter(v=>v!==0).length - removals
      if (cluesAfter < minClues) continue
      puzzle[r1][c1] = 0
      if (r2!==r1||c2!==c1) puzzle[r2][c2] = 0
      if (countSolutions(puzzle) !== 1) {
        puzzle[r1][c1] = v1
        if (r2!==r1||c2!==c1) puzzle[r2][c2] = v2
        continue
      }
      if (target === 0 && scorePuzzle(puzzle).score > 0) {
        lastPuzzle = puzzle.map(r => [...r]); lastScore = scorePuzzle(puzzle); break
      }
      const cur = scorePuzzle(puzzle)
      if (cur.difficulty > target) {
        const db = Math.abs(lastScore.difficulty - target)
        const da = Math.abs(cur.difficulty - target)
        if (db <= da) { puzzle[r1][c1]=v1; if(r2!==r1||c2!==c1) puzzle[r2][c2]=v2 }
        else { lastPuzzle = puzzle.map(r=>[...r]); lastScore = cur }
        break
      }
      lastPuzzle = puzzle.map(r => [...r]); lastScore = cur
    }

    const candidate: GeneratorResult = {
      puzzle: lastPuzzle, solution,
      score: lastScore.score, difficulty: lastScore.difficulty,
      clues: lastPuzzle.flat().filter(v=>v!==0).length,
      strategies: lastScore.strategies
    }
    if (!bestResult || Math.abs(candidate.difficulty-target) < Math.abs(bestResult.difficulty-target))
      bestResult = candidate
    if (Math.abs(candidate.difficulty - target) <= 0.06) return candidate
  }
  return bestResult!
}
