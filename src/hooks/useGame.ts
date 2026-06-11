import { useState, useEffect, useCallback, useRef } from 'react'
import { generate, getHint, buildCandidates, type Board, type HintResult, type GeneratorResult } from '../engine/sudoku'

export interface CellState {
  value: number         // 0 = empty
  given: boolean        // from the original puzzle
  notes: Set<number>    // pencil marks
  isError: boolean      // conflicts with solution
}

export type Grid = CellState[][]

export interface GameSettings {
  showErrors: boolean       // highlight wrong digits immediately
  progressiveDifficulty: boolean
  difficulty: number        // 0-1
}

export interface ScoreEntry {
  score: number
  difficulty: number
  timeSeconds: number
  date: string
  strategies: Record<string, number>
}

export type HintPhase = 'pattern' | 'reveal'

function makeGrid(puzzle: Board, solution: Board): Grid {
  return puzzle.map((row, r) =>
    row.map((v, c) => ({
      value: v,
      given: v !== 0,
      notes: new Set<number>(),
      isError: false,
    }))
  )
}

function cloneGrid(grid: Grid): Grid {
  return grid.map(row => row.map(cell => ({ ...cell, notes: new Set(cell.notes) })))
}

function checkErrors(grid: Grid, solution: Board): Grid {
  return grid.map((row, r) =>
    row.map((cell, c) => ({
      ...cell,
      notes: new Set(cell.notes),
      isError: cell.value !== 0 && !cell.given && cell.value !== solution[r][c]
    }))
  )
}

function isSolved(grid: Grid, solution: Board): boolean {
  return grid.every((row, r) => row.every((cell, c) => cell.value === solution[r][c]))
}

/** Compute score: higher difficulty + faster time = higher score */
function computeScore(difficulty: number, timeSeconds: number): number {
  if (timeSeconds <= 0) return 0
  const base = 10000
  const diffMultiplier = 0.1 + difficulty * 9.9   // 0.1x at diff=0, 10x at diff=1
  const timePenalty = Math.log10(1 + timeSeconds)  // grows slowly
  return Math.round(base * diffMultiplier / timePenalty)
}

/** Expected solve time in seconds for a given difficulty — for adaptive difficulty */
function expectedTime(difficulty: number): number {
  // Rough model: 0.0→60s, 0.5→300s, 1.0→1200s
  return 60 * Math.pow(20, difficulty)
}

const STORAGE_KEY = 'sudoku-highscores'
const SETTINGS_KEY = 'sudoku-settings'
const GAME_KEY = 'sudoku-game'

function loadHighScores(): ScoreEntry[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') } catch { return [] }
}
function saveHighScores(scores: ScoreEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(scores.slice(0, 20)))
}
function loadSettings(): GameSettings {
  try {
    const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}')
    return {
      showErrors: s.showErrors ?? true,
      progressiveDifficulty: s.progressiveDifficulty ?? false,
      difficulty: s.difficulty ?? 0.3,
    }
  } catch {
    return { showErrors: true, progressiveDifficulty: false, difficulty: 0.3 }
  }
}

export function useGame() {
  const [settings, setSettings] = useState<GameSettings>(loadSettings)
  const [gameData, setGameData] = useState<GeneratorResult | null>(null)
  const [grid, setGrid] = useState<Grid>([])
  const [selected, setSelected] = useState<[number, number] | null>(null)
  const [pencilMode, setPencilMode] = useState(false)
  const [history, setHistory] = useState<Grid[]>([])
  const [hint, setHint] = useState<HintResult | null>(null)
  const [hintPhase, setHintPhase] = useState<HintPhase>('pattern')
  const [elapsed, setElapsed] = useState(0)
  const [running, setRunning] = useState(false)
  const [completed, setCompleted] = useState(false)
  const [score, setScore] = useState(0)
  const [highScores, setHighScores] = useState<ScoreEntry[]>(loadHighScores)
  const [generating, setGenerating] = useState(false)
  const [hintsUsed, setHintsUsed] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Persist settings
  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  }, [settings])

  // Timer
  useEffect(() => {
    if (running && !completed) {
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [running, completed])

  const startNewGame = useCallback((targetDiff?: number) => {
    const diff = targetDiff ?? settings.difficulty
    setGenerating(true)
    // Use setTimeout so React can re-render the "generating" state first
    setTimeout(() => {
      const data = generate(diff)
      const g = makeGrid(data.puzzle, data.solution)
      setGameData(data)
      setGrid(g)
      setSelected(null)
      setPencilMode(false)
      setHistory([])
      setHint(null)
      setHintPhase('pattern')
      setElapsed(0)
      setRunning(true)
      setCompleted(false)
      setScore(0)
      setHintsUsed(0)
      setGenerating(false)
    }, 50)
  }, [settings.difficulty])

  const selectCell = useCallback((r: number, c: number) => {
    setSelected([r, c])
    setHint(null)
    setHintPhase('pattern')
  }, [])

  const inputDigit = useCallback((digit: number) => {
    if (!selected || !gameData || completed) return
    const [r, c] = selected
    if (grid[r][c].given) return

    setHistory(h => [...h, cloneGrid(grid)])
    setHint(null)

    setGrid(prev => {
      const next = cloneGrid(prev)
      const cell = next[r][c]
      if (pencilMode) {
        if (digit === 0) { cell.notes.clear() }
        else if (cell.notes.has(digit)) { cell.notes.delete(digit) }
        else { cell.notes.add(digit) }
        cell.value = 0
      } else {
        cell.value = digit
        cell.notes.clear()
        // Remove this digit from notes of peers
        const candidates = buildCandidates(gameData.puzzle)
        // simple: clear note from same row/col/box
        const clearPeer = (pr: number, pc: number) => {
          if (pr===r && pc===c) return
          next[pr][pc].notes.delete(digit)
        }
        for (let i=0;i<9;i++) { clearPeer(r,i); clearPeer(i,c) }
        const br=Math.floor(r/3)*3, bc=Math.floor(c/3)*3
        for (let i=br;i<br+3;i++) for (let j=bc;j<bc+3;j++) clearPeer(i,j)
      }

      const checked = settings.showErrors ? checkErrors(next, gameData.solution) : next
      return checked
    })
  }, [selected, gameData, completed, pencilMode, grid, settings.showErrors])

  // Check completion after grid changes
  useEffect(() => {
    if (!gameData || completed || grid.length === 0) return
    if (isSolved(grid, gameData.solution)) {
      setRunning(false)
      setCompleted(true)
      const s = computeScore(gameData.difficulty, elapsed)
      // Penalise hints: each hint reduces score by 10%
      const penalised = Math.round(s * Math.pow(0.9, hintsUsed))
      setScore(penalised)
      const entry: ScoreEntry = {
        score: penalised,
        difficulty: gameData.difficulty,
        timeSeconds: elapsed,
        date: new Date().toLocaleDateString(),
        strategies: gameData.strategies,
      }
      const newScores = [...highScores, entry].sort((a, b) => b.score - a.score)
      setHighScores(newScores)
      saveHighScores(newScores)

      // Adaptive difficulty
      if (settings.progressiveDifficulty) {
        const exp = expectedTime(gameData.difficulty)
        const ratio = elapsed / exp
        let nextDiff = gameData.difficulty
        if (ratio < 0.6) nextDiff = Math.min(1, gameData.difficulty + 0.1)      // Fast → harder
        else if (ratio > 1.5) nextDiff = Math.max(0, gameData.difficulty - 0.08) // Slow → easier
        else nextDiff = Math.min(1, gameData.difficulty + 0.05)                  // Normal → nudge up
        setSettings(s => ({ ...s, difficulty: Math.round(nextDiff * 20) / 20 }))
      }
    }
  }, [grid])

  const undo = useCallback(() => {
    if (history.length === 0) return
    const prev = history[history.length - 1]
    setHistory(h => h.slice(0, -1))
    setGrid(prev)
  }, [history])

  const erase = useCallback(() => {
    if (!selected || !gameData) return
    const [r, c] = selected
    if (grid[r][c].given) return
    setHistory(h => [...h, cloneGrid(grid)])
    setGrid(prev => {
      const next = cloneGrid(prev)
      next[r][c].value = 0
      next[r][c].notes.clear()
      next[r][c].isError = false
      return next
    })
  }, [selected, gameData, grid])

  const requestHint = useCallback(() => {
    if (!gameData || completed) return
    const boardState = grid.map(row => row.map(c => c.value))

    if (hint !== null && hintPhase === 'pattern') {
      // Second press: reveal the answer / apply the elimination
      setHintPhase('reveal')
      setHintsUsed(n => n + 1)
      return
    }

    // First press: show the pattern
    const h = getHint(boardState)
    setHint(h)
    setHintPhase('pattern')
    if (h) setSelected(h.placement ? [h.placement.row, h.placement.col] : (h.patternCells[0] ?? null))
  }, [gameData, completed, grid, hint, hintPhase])

  const applyHint = useCallback(() => {
    if (!hint || !gameData) return
    if (hint.placement) {
      setHistory(h => [...h, cloneGrid(grid)])
      setGrid(prev => {
        const next = cloneGrid(prev)
        const { row, col, digit } = hint.placement!
        next[row][col].value = digit
        next[row][col].notes.clear()
        next[row][col].isError = false
        return next
      })
    } else if (hint.eliminations) {
      setHistory(h => [...h, cloneGrid(grid)])
      setGrid(prev => {
        const next = cloneGrid(prev)
        for (const { row, col, digit } of hint.eliminations!) {
          next[row][col].notes.delete(digit)
        }
        return next
      })
    }
    setHint(null)
    setHintPhase('pattern')
  }, [hint, gameData, grid])

  const updateSettings = useCallback((partial: Partial<GameSettings>) => {
    setSettings(s => ({ ...s, ...partial }))
  }, [])

  const pauseResume = useCallback(() => {
    setRunning(r => !r)
  }, [])

  return {
    gameData, grid, selected, pencilMode, hint, hintPhase,
    elapsed, running, completed, score, highScores,
    generating, hintsUsed, settings,
    startNewGame, selectCell, inputDigit, undo, erase,
    requestHint, applyHint,
    setPencilMode, updateSettings, pauseResume,
  }
}
