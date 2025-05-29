/**
 * game-engine.js - Clean game coordinator
 * REWRITTEN: Simple movement logic that works the same for all pieces
 */

import { createPiece, getNextPiece } from './game-state.js';
import * as Physics from './physics-pure.js';
import * as Random from './random.js';
import * as ParticleSystem from './particle-system.js';
import { ScoringEngine } from './scoring-engine.js';

// Main game tick - just coordinates phases
export const tick = (state, deltaTime) => {
    // Don't process in menu/pause/game over states
    if (state.phase === 'MENU' || state.phase === 'PAUSED' || state.phase === 'GAME_OVER') {
        return state;
    }
    
    // Update particles if any exist
    if (state.particles && state.particles.length > 0) {
        state = { 
            ...state, 
            particles: ParticleSystem.updateParticles(state.particles, deltaTime) 
        };
    }
    
    // Process based on phase
    switch (state.phase) {
        case 'FALLING':
            return processFalling(state, deltaTime);
        case 'LOCKING':
            return processLocking(state, deltaTime);
        case 'CLEARING':
            return processClearing(state, deltaTime);
        default:
            return state;
    }
};

// Process falling phase
const processFalling = (state, deltaTime) => {
    if (!state.current) {
        return { ...state, phase: 'GAME_OVER' };
    }
    
    // Apply gravity
    const newAccumulator = state.gravityAccumulator + deltaTime;
    const gravityDelay = state.mode.gravity(state.level);
    
    if (newAccumulator >= gravityDelay) {
        // Try to fall one row
        if (Physics.canPieceFitAt(state.board, state.current, state.current.gridX, state.current.gridY + 1)) {
            const newPiece = {
                ...state.current,
                gridY: state.current.gridY + 1
            };
            
            // Check if we just reached our shadow position
            const shadowY = Physics.calculateShadow(state.board, newPiece);
            const justHitShadow = newPiece.gridY === shadowY && state.current.gridY !== shadowY;
            
            return { 
                ...state, 
                current: newPiece,
                gravityAccumulator: 0,
                lastMove: justHitShadow ? { type: 'GRAVITY_HIT', hitBottom: true } : state.lastMove
            };
        } else {
            // Can't fall - start locking
            return { 
                ...state, 
                phase: 'LOCKING', 
                lockTimer: 0,
                totalLockTime: 0,
                gravityAccumulator: 0
            };
        }
    }
    
    return { ...state, gravityAccumulator: newAccumulator };
};

// Process locking phase
const processLocking = (state, deltaTime) => {
    const newLockTimer = state.lockTimer + deltaTime;
    const newTotalLockTime = (state.totalLockTime || 0) + deltaTime;
    
    // Check if piece can fall again (was moved off its resting position)
    if (Physics.canPieceFitAt(state.board, state.current, state.current.gridX, state.current.gridY + 1)) {
        return { ...state, phase: 'FALLING', lockTimer: 0, totalLockTime: 0 };
    }
    
    // Check if we've exceeded maximum lock time
    if (newTotalLockTime >= state.mode.maxLockTime) {
        return lockPiece(state);
    }
    
    // Lock delay - FLOAT pieces get a bit extra (but still subject to max time)
    const lockDelay = state.current.type === 'FLOAT' ? state.mode.lockDelay * 1.2 : state.mode.lockDelay;
    
    // Lock delay expired - place piece
    if (newLockTimer >= lockDelay) {
        return lockPiece(state);
    }
    
    return { ...state, lockTimer: newLockTimer, totalLockTime: newTotalLockTime };
};

// Process clearing phase
const processClearing = (state, deltaTime) => {
    const newClearTimer = state.clearTimer + deltaTime;
    
    if (newClearTimer >= 300) { // Clear animation time
        return finishClearing(state);
    }
    
    return { ...state, clearTimer: newClearTimer };
};

// Handle player input
export const handleInput = (state, action) => {
    if (state.phase !== 'FALLING' && state.phase !== 'LOCKING') {
        return state;
    }
    
    if (!state.current) return state;
    
    switch (action.type) {
        case 'UP_PRESSED':
            // FLOAT pieces use up to move up, others rotate
            if (state.current.type === 'FLOAT' && (state.current.upMovesUsed || 0) < 7) {
                return move(state, 0, -1);
            } else {
                return rotate(state, 1);
            }
            
        case 'MOVE':
            return move(state, action.dx, action.dy);
            
        case 'ROTATE':
            return rotate(state, action.direction);
            
        case 'HARD_DROP':
            return hardDrop(state);
            
        case 'HOLD':
            return tryHold(state);
            
        default:
            return state;
    }
};

// SIMPLE move function - same for all pieces
const move = (state, dx, dy) => {
    const piece = state.current;
    const targetX = piece.gridX + dx;
    const targetY = piece.gridY + dy;
    
    // First, try the exact position requested
    if (Physics.canPieceFitAt(state.board, piece, targetX, targetY)) {
        return executeMove(state, targetX, targetY, dx, dy);
    }
    
    // For FLOAT pieces moving horizontally, try one row down
    if (piece.type === 'FLOAT' && dx !== 0 && dy === 0) {
        const altY = targetY + 1;
        if (altY < 20 && Physics.canPieceFitAt(state.board, piece, targetX, altY)) {
            return executeMove(state, targetX, altY, dx, 1);
        }
    }
    
    // Can't move - return state with feedback
    return {
        ...state,
        lastMove: { 
            type: 'MOVE', 
            dx, 
            dy, 
            hitWall: dx !== 0,
            hitFloor: dy > 0,
            hitCeiling: dy < 0
        }
    };
};

// Execute a successful move
const executeMove = (state, newX, newY, dx, dy) => {
    const movedPiece = {
        ...state.current,
        gridX: newX,
        gridY: newY
    };
    
    // Track up moves for FLOAT
    if (state.current.type === 'FLOAT' && dy < 0) {
        movedPiece.upMovesUsed = (state.current.upMovesUsed || 0) + 1;
    }
    
    let newState = {
        ...state,
        current: movedPiece,
        lastMove: { 
            type: 'MOVE', 
            dx, 
            dy,
            hitBottom: dy > 0 && !Physics.canPieceFitAt(state.board, movedPiece, movedPiece.gridX, movedPiece.gridY + 1)
        }
    };
    
    // Reset gravity for vertical moves
    if (dy !== 0) {
        newState.gravityAccumulator = 0;
    }
    
    // Check if we should enter/exit locking phase
    const canFall = Physics.canPieceFitAt(state.board, movedPiece, movedPiece.gridX, movedPiece.gridY + 1);
    
    if (!canFall && state.phase === 'FALLING') {
        newState.phase = 'LOCKING';
        newState.lockTimer = 0;
    } else if (canFall && state.phase === 'LOCKING') {
        // For FLOAT pieces moving up, stay in locking if we choose to
        if (piece.type === 'FLOAT' && dy < 0) {
            // Stay in locking phase - player is positioning the piece
            newState.lockTimer = 0; // Reset timer though
        } else {
            newState.phase = 'FALLING';
            newState.lockTimer = 0;
        }
    } else if (state.phase === 'LOCKING') {
        // Reset lock timer on successful move
        newState.lockTimer = 0;
    }
    
    // Scoring for soft drop
    if (state.scoringEngine && dy > 0) {
        newState.score += state.scoringEngine.scoreSoftDrop(dy);
    }
    
    return newState;
};

// Simple rotate function
const rotate = (state, direction) => {
    const result = Physics.tryRotation(state.board, state.current, direction);
    
    if (!result.success) {
        return state;
    }
    
    let newState = {
        ...state,
        current: result.piece,
        lastMove: { type: 'ROTATE', direction }
    };
    
    // Check if we should enter/exit locking phase
    const canFall = Physics.canPieceFitAt(state.board, result.piece, result.piece.gridX, result.piece.gridY + 1);
    
    if (!canFall && state.phase === 'FALLING') {
        newState.phase = 'LOCKING';
        newState.lockTimer = 0;
    } else if (canFall && state.phase === 'LOCKING') {
        newState.phase = 'FALLING';
        newState.lockTimer = 0;
    } else if (state.phase === 'LOCKING') {
        // Reset lock timer
        newState.lockTimer = 0;
    }
    
    return newState;
};

// Hard drop
const hardDrop = (state) => {
    const shadowY = Physics.calculateShadow(state.board, state.current);
    const dropDistance = shadowY - state.current.gridY;
    
    const droppedPiece = {
        ...state.current,
        gridY: shadowY
    };
    
    let newState = {
        ...state,
        current: droppedPiece,
        lastMove: { type: 'HARD_DROP' }
    };
    
    // Scoring
    if (state.scoringEngine && dropDistance > 0) {
        newState.score += state.scoringEngine.scoreHardDrop(dropDistance);
    }
    
    // Immediately lock
    return lockPiece(newState);
};

// Lock piece
const lockPiece = (state) => {
    // Check for game over condition
    if (state.current.gridY < 0) {
        // Place visible parts on board
        const newBoard = Physics.placePiece(state.board, state.current);
        
        // Save the death piece before clearing current
        return gameOver({
            ...state,
            board: newBoard,
            deathPiece: { ...state.current }  // ← Snapshot the piece
        });
    }
    
    // Normal locking logic continues unchanged...
    const newBoard = Physics.placePiece(state.board, state.current);
    
    // Check for lines
    const clearedLines = Physics.findClearedLines(newBoard);
    
    // Update stats
    if (state.scoringEngine) {
        state.scoringEngine.updateStats({ ...state, pieces: state.pieces + 1 });
    }
    
    if (clearedLines.length > 0) {
        // Create particles
        const particles = ParticleSystem.createLineExplosion(
            newBoard, clearedLines,
            60, 104, 24  // Board position and block size from renderer
        );
        
        return {
            ...state,
            board: newBoard,
            current: null,
            phase: 'CLEARING',
            clearTimer: 0,
            clearingLines: clearedLines,
            canHold: true,
            particles: [...(state.particles || []), ...particles]
        };
    }
    
    // No lines - spawn next
    return spawnNextPiece({
        ...state,
        board: newBoard,
        current: null,
        canHold: true,
        pieces: state.pieces + 1
    });
};

// Finish clearing
const finishClearing = (state) => {
    const newBoard = Physics.removeClearedLines(state.board, state.clearingLines);
    const linesCleared = state.clearingLines.length;
    
    let newState = {
        ...state,
        board: newBoard,
        clearingLines: [],
        lines: state.lines + linesCleared,
        level: Math.floor((state.lines + linesCleared) / 10) + 1
    };
    
    // Update score and combo
    if (state.scoringEngine) {
        newState.score += state.scoringEngine.scoreLineClears(state, linesCleared, state.lastMove);
        newState.combo = linesCleared > 0 ? state.combo + 1 : 0;
    }
    
    return spawnNextPiece(newState);
};

// Spawn next piece
const spawnNextPiece = (state) => {
    if (state.phase === 'GAME_OVER') return state;
    
    const newPiece = {
        ...state.next,
        generation: state.generation + 1,
        upMovesUsed: 0
    };
    
    // Check if can spawn
    if (!Physics.canSpawn(state.board, newPiece)) {
        return gameOver(state);
    }
    
    // Get next piece
    const nextPiece = getNextPiece(state);
    
    return {
        ...state,
        current: newPiece,
        next: nextPiece,
        pieces: state.pieces + 1,
        phase: 'FALLING',
        generation: state.generation + 1
    };
};

// Game over
const gameOver = (state) => {
    if (state.scoringEngine) {
        state.scoringEngine.finalizeGame(state);
    }
    
    return {
        ...state,
        phase: 'GAME_OVER',
        current: null,
        next: null
    };
};

// Start game
export const startGame = (state) => {
    if (state.phase === 'FALLING' || state.phase === 'LOCKING' || state.phase === 'CLEARING') {
        return state;
    }
    
    // Initialize
    const scoringEngine = new ScoringEngine();
    const rng = state.rng || Random.createRNG(Date.now());
    
    const emptyBoard = Array(20).fill().map(() => Array(10).fill(null));
    
    // Get initial pieces
    const firstPiece = getNextPiece({ ...state, rng });
    const nextPiece = getNextPiece({ ...state, rng });
    
    return {
        ...state,
        board: emptyBoard,
        phase: 'FALLING',
        current: { ...firstPiece, generation: 1, upMovesUsed: 0 },
        next: nextPiece,
        score: 0,
        lines: 0,
        level: 1,
        pieces: 1,
        combo: 0,
        generation: 1,
        particles: [],
        scoringEngine,
        rng,
        gravityAccumulator: 0,
        startTime: Date.now()
    };
};

// Hold piece
const tryHold = (state) => {
    if (!state.current || !state.canHold) return state;
    
    const held = state.current;
    const newCurrent = state.hold || state.next;
    
    // Reset positions
    const heldPiece = createPiece(held.type);
    const activePiece = {
        ...createPiece(newCurrent.type),
        generation: state.generation + 1,
        upMovesUsed: 0
    };
    
    return {
        ...state,
        current: activePiece,
        hold: heldPiece,
        next: state.hold ? state.next : getNextPiece(state),
        canHold: false,
        phase: 'FALLING',
        generation: state.generation + 1
    };
};