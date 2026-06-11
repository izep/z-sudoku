import React from 'react'
import type { HintResult } from '../engine/sudoku'

interface HintBannerProps {
  hint: HintResult
  phase: 'pattern' | 'reveal'
  onApply: () => void
  onDismiss: () => void
}

const strategyDescriptions: Record<string, string> = {
  'Naked Single': 'Only one number can go in this cell.',
  'Hidden Single': 'This number can only fit in one place in this row, column, or box.',
  'Pointing Pair': 'A number in a box is confined to one row or column — remove it from the rest of that line.',
  'Pointing Triple': 'A number in a box is confined to one row or column — remove it from the rest of that line.',
  'Box/Line Reduction': 'A number in a line is confined to one box — remove it from the rest of that box.',
  'Naked Pair': 'Two cells share exactly the same two candidates — remove those numbers from other cells in the unit.',
  'Naked Triple': 'Three cells share exactly three candidates — remove those from other cells in the unit.',
  'Hidden Pair': 'Two numbers only appear in the same two cells in a unit — remove all other candidates from those cells.',
  'Hidden Triple': 'Three numbers only appear in the same three cells — clear other candidates from those cells.',
  'X-Wing': 'A number appears in exactly two cells in each of two rows (or columns) aligned with the same columns (or rows).',
  'Swordfish': 'Like X-Wing but across three rows and three columns.',
  'Jellyfish': 'Like X-Wing but across four rows and four columns.',
  'Y-Wing': 'A pivot cell with two candidates connects two pincers — remove the shared wing digit from their mutual peers.',
  'XYZ-Wing': 'Like Y-Wing but the pivot has three candidates — eliminate the shared digit from cells seeing all three.',
}

const HintBanner: React.FC<HintBannerProps> = ({ hint, phase, onApply, onDismiss }) => {
  const desc = strategyDescriptions[hint.strategy] ?? hint.detail

  return (
    <div className="hint-banner" role="status" aria-live="polite">
      <div className="hint-banner__header">
        <span className="hint-strategy-tag">{hint.strategy}</span>
        <button className="hint-dismiss" onClick={onDismiss} aria-label="Dismiss hint">✕</button>
      </div>

      <p className="hint-desc">{desc}</p>

      {phase === 'pattern' && (
        <p className="hint-sub">
          {hint.patternCells.length > 0
            ? `Highlighted cells show the pattern. Press Reveal to see the answer.`
            : 'Look at the highlighted area.'}
        </p>
      )}

      {phase === 'reveal' && (
        <div className="hint-reveal-row">
          <p className="hint-sub hint-detail">{hint.detail}</p>
          <button className="hint-apply-btn" onClick={onApply}>
            Apply this move
          </button>
        </div>
      )}
    </div>
  )
}

export default HintBanner
