/**
 * Sudoku Solver
 *
 * Solves a 9x9 sudoku puzzle using backtracking.
 * Empty cells are represented by 0.
 */

type Board = number[][];

function isValid(board: Board, row: number, col: number, num: number): boolean {
  // Check row
  for (let c = 0; c < 9; c++) {
    if (board[row][c] === num) return false;
  }

  // Check column
  for (let r = 0; r < 9; r++) {
    if (board[r][col] === num) return false;
  }

  // Check 3x3 box
  const boxRow = Math.floor(row / 3) * 3;
  const boxCol = Math.floor(col / 3) * 3;
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      if (board[boxRow + r][boxCol + c] === num) return false;
    }
  }

  return true;
}

function findEmpty(board: Board): [number, number] | null {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (board[r][c] === 0) return [r, c];
    }
  }
  return null;
}

function solve(board: Board): boolean {
  const empty = findEmpty(board);
  if (!empty) return true; // No empty cells — solved

  const [row, col] = empty;

  for (let num = 1; num <= 9; num++) {
    if (isValid(board, row, col, num)) {
      board[row][col] = num;
      if (solve(board)) return true;
      board[row][col] = 0; // Backtrack
    }
  }

  return false; // Trigger backtracking
}

function printBoard(board: Board): void {
  for (let r = 0; r < 9; r++) {
    if (r > 0 && r % 3 === 0) {
      console.log("------+-------+------");
    }
    const row = board[r]
      .map((n, c) => {
        const sep = c > 0 && c % 3 === 0 ? "| " : "";
        return sep + (n === 0 ? "." : n);
      })
      .join(" ");
    console.log(row);
  }
}

function cloneBoard(board: Board): Board {
  return board.map((row) => [...row]);
}

// ---------------------------------------------------------------------------
// Example puzzle (0 = empty)
// ---------------------------------------------------------------------------
const puzzle: Board = [
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

console.log("Puzzle:");
printBoard(puzzle);

const board = cloneBoard(puzzle);

if (solve(board)) {
  console.log("\nSolution:");
  printBoard(board);
} else {
  console.log("\nNo solution exists.");
}
