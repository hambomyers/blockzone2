/**
 * game-state.js - Immutable game state definition
 * Pure functional approach with single source of truth
 */

import * as Random from './random.js';

// Game mode configuration - pure data
export const GAME_MODES = {
    neonDrop: {
        name: 'NEON_DROP',
        gravity: (level) => Math.max(50, 1000 - (level - 1) * 50),
        lockDelay: 500,
        maxLockTime: 5000,  // Added missing property
        board: { width: 10, height: 20 },
        pieces: ['I', 'J', 'L', 'O', 'S', 'T', 'Z', 'FLOAT', 'PLUS', 'U', 'DOT'],
        progressive: true
    }
};

// Initial state factory - pure function
export const createInitialState = () => ({
    // Board state
    board: createEmptyBoard(),
    current: null,
    next: null,
    hold: null,
    canHold: true,
    
    // Add death piece
    deathPiece: null,  // ← NEW
    
    // Game state
    phase: 'MENU',  // MENU | FALLING | LOCKING | CLEARING | PAUSED | GAME_OVER
    mode: GAME_MODES.neonDrop,
    
    // Scoring
    score: 0,
    highScore: loadHighScore(),
    lines: 0,
    level: 1,
    combo: 0,
    
    // Timers (in ms)
    lockTimer: 0,
    totalLockTime: 0,  // Track total time in lock phase
    clearTimer: 0,
    gravityAccumulator: 0,
    
    // Stats
    pieces: 0,
    startTime: null,
    generation: 0,  // Piece generation counter
    
    // Input state
    lastMove: null,
    
    // Visual state
    particles: [],
    clearingLines: [],
    
    // Random number generator
    rng: null,
    
    // Performance
    shadowCache: new Map()  // Cache shadow calculations
});

// Piece definitions - pure data
export const PIECE_DEFINITIONS = {
    I: {
        shape: [[0,0,0,0], [1,1,1,1], [0,0,0,0], [0,0,0,0]],
        color: '#00FFFF',
        spawn: { x: 3, y: -2 }
    },
    J: {
        shape: [[1,0,0], [1,1,1], [0,0,0]],
        color: '#0000FF',
        spawn: { x: 3, y: -2 }
    },
    L: {
        shape: [[0,0,1], [1,1,1], [0,0,0]],
        color: '#FF7F00',
        spawn: { x: 3, y: -2 }
    },
    O: {
        shape: [[1,1], [1,1]],
        color: '#FFFF00',
        spawn: { x: 4, y: -2 }
    },
    S: {
        shape: [[0,1,1], [1,1,0], [0,0,0]],
        color: '#00FF00',
        spawn: { x: 3, y: -2 }
    },
    T: {
        shape: [[0,1,0], [1,1,1], [0,0,0]],
        color: '#8A2BE2',
        spawn: { x: 3, y: -2 }
    },
    Z: {
        shape: [[1,1,0], [0,1,1], [0,0,0]],
        color: '#FF0000',
        spawn: { x: 3, y: -2 }
    },
    FLOAT: {
        shape: [[1]],
        color: '#FFFFFF',
        spawn: { x: 4, y: -1 },
        special: true  // Mark as special piece
    },
    PLUS: {
        shape: [[0,1,0], [1,1,1], [0,1,0]],
        color: '#FFD700',
        spawn: { x: 3, y: -3 }
    },
    U: {
        shape: [[1,0,1], [1,0,1], [1,1,1]],
        color: '#FF69B4',
        spawn: { x: 3, y: -3 }
    },
    DOT: {
        shape: [[1,1,0], [1,0,1], [0,1,1]],
        color: '#00CED1',
        spawn: { x: 3, y: -3 }
    }
};

// Piece progression tiers - pure data
const PIECE_PROGRESSION = [
    { skill: 0, pieces: ['I', 'O', 'T', 'L', 'FLOAT'] },
    { skill: 20, pieces: ['J'] },
    { skill: 60, pieces: ['S', 'Z'] },
    { skill: 150, pieces: ['PLUS'] },
    { skill: 300, pieces: ['U', 'DOT'] }
];

// Pure functions

/**
 * Create empty board - pure function
 */
const createEmptyBoard = () => 
    Array(20).fill(null).map(() => Array(10).fill(null));

/**
 * Load high score - with error handling
 */
const loadHighScore = () => {
    try {
        return parseInt(localStorage.getItem('neonDropHighScore') || '0');
    } catch {
        return 0;
    }
};

/**
 * Save high score - side effect isolated
 */
export const saveHighScore = (score) => {
    try {
        localStorage.setItem('neonDropHighScore', score.toString());
    } catch (e) {
        console.warn('Could not save high score:', e);
    }
};

/**
 * Create a new piece - pure function
 * ALWAYS initializes all properties including upMovesUsed
 */
export const createPiece = (type) => {
    const def = PIECE_DEFINITIONS[type];
    if (!def) {
        throw new Error(`Unknown piece type: ${type}`);
    }
    
    return {
        type,
        shape: def.shape,
        color: def.color,
        gridX: def.spawn.x,
        gridY: def.spawn.y,
        rotation: 0,
        upMovesUsed: 0  // ALWAYS initialize for ALL pieces
    };
};

/**
 * Calculate skill score - pure function
 */
const calculateSkillScore = (state) => {
    if (!state.startTime || state.pieces === 0) return 0;
    
    const elapsedSeconds = (Date.now() - state.startTime) / 1000;
    const pps = state.pieces / Math.max(1, elapsedSeconds);
    const efficiency = state.lines / state.pieces;
    
    return Math.floor(
        state.lines * 2 + 
        pps * 50 + 
        efficiency * 100 + 
        state.combo * 20
    );
};

/**
 * Get available pieces based on skill - pure function
 */
const getAvailablePieces = (state) => {
    if (!state.mode.progressive) {
        return state.mode.pieces;
    }
    
    const skillScore = calculateSkillScore(state);
    
    // Accumulate pieces from all unlocked tiers
    return PIECE_PROGRESSION
        .filter(tier => skillScore >= tier.skill)
        .flatMap(tier => tier.pieces);
};

/**
 * Select weighted piece - pure function
 */
const selectWeightedPiece = (availablePieces, rng) => {
    // Special handling for FLOAT (7% chance)
    if (availablePieces.includes('FLOAT') && rng.next() < 0.07) {
        return 'FLOAT';
    }
    
    // Weights for special pieces
    const PIECE_WEIGHTS = {
        'PLUS': 0.5,   // 50% weight
        'U': 0.5,      // 50% weight
        'DOT': 0.5,    // 50% weight
        'DEFAULT': 1.0 // 100% weight
    };
    
    // Build weighted array (excluding FLOAT since we handled it)
    const weightedPieces = availablePieces
        .filter(piece => piece !== 'FLOAT')
        .flatMap(piece => {
            const weight = PIECE_WEIGHTS[piece] || PIECE_WEIGHTS.DEFAULT;
            const count = Math.floor(weight * 100);
            return Array(count).fill(piece);
        });
    
    return Random.choice(weightedPieces, rng);
};

/**
 * Get next piece - pure function with proper error handling
 */
export const getNextPiece = (state) => {
    if (!state.rng) {
        throw new Error('RNG not initialized');
    }
    
    const availablePieces = getAvailablePieces(state);
    
    if (availablePieces.length === 0) {
        throw new Error('No pieces available');
    }
    
    const pieceType = selectWeightedPiece(availablePieces, state.rng);
    return createPiece(pieceType);
};

/**
 * State transition helpers - pure functions
 */

export const isGameActive = (state) => 
    state.phase === 'FALLING' || 
    state.phase === 'LOCKING' || 
    state.phase === 'CLEARING';

export const isGamePaused = (state) => 
    state.phase === 'PAUSED';

export const isGameOver = (state) => 
    state.phase === 'GAME_OVER';

export const canProcessInput = (state) =>
    state.phase === 'FALLING' || 
    state.phase === 'LOCKING';

/**
 * Calculate board statistics - pure function
 */
export const getBoardStats = (board) => {
    let filledCells = 0;
    let maxHeight = 0;
    
    for (let y = 0; y < board.length; y++) {
        for (let x = 0; x < board[y].length; x++) {
            if (board[y][x]) {
                filledCells++;
                maxHeight = Math.max(maxHeight, board.length - y);
            }
        }
    }
    
    return {
        filledCells,
        maxHeight,
        density: filledCells / (board.length * board[0].length)
    };
};

/**
 * Create state snapshot for replay/undo - pure function
 */
export const createStateSnapshot = (state) => ({
    board: state.board.map(row => [...row]),
    score: state.score,
    lines: state.lines,
    level: state.level,
    pieces: state.pieces,
    timestamp: Date.now()
});

/**
 * Validate state integrity - pure function for debugging
 */
export const validateState = (state) => {
    const errors = [];
    
    if (!state.board || state.board.length !== 20) {
        errors.push('Invalid board dimensions');
    }
    
    if (state.board.some(row => row.length !== 10)) {
        errors.push('Invalid board row width');
    }
    
    if (state.current && !PIECE_DEFINITIONS[state.current.type]) {
        errors.push('Invalid current piece type');
    }
    
    if (state.level < 1) {
        errors.push('Invalid level');
    }
    
    if (state.score < 0 || state.lines < 0 || state.pieces < 0) {
        errors.push('Negative counter values');
    }
    
    return {
        valid: errors.length === 0,
        errors
    };
};

export class GameState {
    constructor() {
        this.score = 0;
        this.highScore = 0; // Reset high score to zero
        this.phase = 'MENU';
        // ...other properties...
    }
}