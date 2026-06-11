import React from 'react'
import type { Grid, CellState } from '../hooks/useGame'
import type { HintResult } from '../engine/sudoku'

interface BoardProps {
  grid: Grid
  solution: number[][]
  selected: [number, number] | null
  hint: HintResult | null
  hintPhase: 'pattern' | 'reveal'
  showErrors: boolean
  onSelect: (r: number, c: number) => void
}

function cellClasses(
  r: number, c: number,
  cell: CellState,
  selected: [number, number] | null,
  grid: Grid,
  hint: HintResult | null,
  hintPhase: 'pattern' | 'reveal'
): string {
  const classes: string[] = ['cell']

  const isSel = selected?.[0] === r && selected?.[1] === c
  const selVal = selected ? grid[selected[0]][selected[1]].value : 0

  if (isSel) classes.push('cell--selected')
  else if (selected) {
    const [sr, sc] = selected
    const sameBox = Math.floor(r/3)===Math.floor(sr/3) && Math.floor(c/3)===Math.floor(sc/3)
    if (r===sr || c===sc || sameBox) classes.push('cell--peer')
  }

  if (selVal !== 0 && cell.value === selVal && !isSel) classes.push('cell--same-digit')

  if (hint) {
    const isPattern = hint.patternCells.some(([pr, pc]) => pr===r && pc===c)
    const isElim = hint.eliminationCells.some(([er, ec]) => er===r && ec===c)
    if (isPattern) classes.push('cell--hint-pattern')
    if (isElim && hintPhase === 'reveal') classes.push('cell--hint-elim')
  }

  if (cell.given) classes.push('cell--given')
  if (cell.isError) classes.push('cell--error')

  // Box borders
  if (r % 3 === 0) classes.push('cell--box-top')
  if (c % 3 === 0) classes.push('cell--box-left')
  if (r === 8) classes.push('cell--box-bottom')
  if (c === 8) classes.push('cell--box-right')

  return classes.join(' ')
}

const Board: React.FC<BoardProps> = ({ grid, solution, selected, hint, hintPhase, showErrors, onSelect }) => {
  if (grid.length === 0) return null

  return (
    <div className="board" role="grid" aria-label="Sudoku board">
      {grid.map((row, r) =>
        row.map((cell, c) => {
          const cls = cellClasses(r, c, cell, selected, grid, hint, hintPhase)
          const hintRevealHere = hint?.placement && hint.placement.row===r && hint.placement.col===c && hintPhase==='reveal'

          return (
            <div
              key={`${r}-${c}`}
              className={cls}
              role="gridcell"
              aria-label={`Row ${r+1} Column ${c+1}${cell.value ? ` value ${cell.value}` : ''}`}
              aria-selected={selected?.[0]===r && selected?.[1]===c}
              onClick={() => onSelect(r, c)}
            >
              {cell.value !== 0 ? (
                <span className={`cell-value${hintRevealHere ? ' cell-value--hint' : ''}`}>
                  {cell.value}
                </span>
              ) : cell.notes.size > 0 ? (
                <div className="notes-grid">
                  {[1,2,3,4,5,6,7,8,9].map(n => {
                    const isHintElim = hint?.eliminations?.some(e => e.row===r && e.col===c && e.digit===n) && hintPhase==='reveal'
                    return (
                      <span
                        key={n}
                        className={`note${cell.notes.has(n) ? ' note--visible' : ''}${isHintElim ? ' note--elim' : ''}`}
                      >
                        {cell.notes.has(n) ? n : ''}
                      </span>
                    )
                  })}
                </div>
              ) : (
                hintRevealHere && hint?.placement ? (
                  <span className="cell-value cell-value--hint">{hint.placement.digit}</span>
                ) : null
              )}
            </div>
          )
        })
      )}
    </div>
  )
}

export default Board
