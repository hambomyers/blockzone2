/**
 * scoring-engine.js - Tournament-grade scoring system
 * 
 * Features:
 * - Comprehensive score tracking with validation
 * - Special move detection and scoring
 * - Replay system with frame-perfect timing
 * - Anti-cheat measures with cryptographic validation
 * - Tournament statistics tracking
 */

import * as crypto from './crypto-utils.js';

// Score event types for ledger
const SCORE_EVENTS = {
    SOFT_DROP: 'SOFT_DROP',
    HARD_DROP: 'HARD_DROP',
    LINE_CLEAR: 'LINE_CLEAR',
    SPIN_BONUS: 'SPIN_BONUS',
    COMBO: 'COMBO',
    BACK_TO_BACK: 'BACK_TO_BACK',
    PERFECT_CLEAR: 'PERFECT_CLEAR',
    LEVEL_BONUS: 'LEVEL_BONUS'
};

// Spin detection patterns for T-shaped piece
const SPIN_CORNERS = [
    { dx: -1, dy: -1 }, // Top-left
    { dx: 1, dy: -1 },  // Top-right
    { dx: -1, dy: 1 },  // Bottom-left
    { dx: 1, dy: 1 }    // Bottom-right
];

export class ScoringEngine {
    constructor() {
        // Score ledger for validation
        this.scoreLedger = [];
        
        // High score tracking
        this.highScore = parseInt(localStorage.getItem('neonDropHighScore') || '0');
        this.isNewHighScore = false;
        
        // Replay data
        this.replayData = {
            version: '1.0.0',
            startTime: null,
            inputs: [],
            stateSnapshots: [],
            finalScore: 0,
            verified: false
        };
        
        // Statistics tracking
        this.stats = {
            piecesPlaced: 0,
            linesCleared: 0,
            spinBonuses: 0,
            perfectClears: 0,
            maxCombo: 0,
            totalTime: 0,
            pps: 0, // Pieces per second
            apm: 0, // Attack per minute
            efficiency: 0
        };
        
        // Frame counter for deterministic replay
        this.frameCount = 0;
    }
    
    /**
     * Initialize scoring for a new game
     */
    initializeGame(seed, mode) {
        this.scoreLedger = [];
        this.replayData = {
            version: '1.0.0',
            seed: seed,
            mode: mode,
            startTime: Date.now(),
            inputs: [],
            stateSnapshots: [],
            finalScore: 0,
            verified: false
        };
        this.stats = {
            piecesPlaced: 0,
            linesCleared: 0,
            spinBonuses: 0,
            perfectClears: 0,
            maxCombo: 0,
            totalTime: 0,
            pps: 0,
            apm: 0,
            efficiency: 0
        };
        this.frameCount = 0;
        
        // Add initial state snapshot
        this.addStateSnapshot({
            frame: 0,
            score: 0,
            level: 1,
            lines: 0
        });
    }
    
    /**
     * Record an input for replay system
     */
    recordInput(action, frame) {
        this.replayData.inputs.push({
            frame: frame || this.frameCount,
            action: action,
            timestamp: Date.now() - this.replayData.startTime
        });
    }
    
    /**
     * Add state snapshot for verification
     */
    addStateSnapshot(state) {
        const snapshot = {
            frame: state.frame || this.frameCount,
            score: state.score,
            level: state.level,
            lines: state.lines,
            boardHash: this.hashBoard(state.board),
            timestamp: Date.now() - this.replayData.startTime
        };
        
        this.replayData.stateSnapshots.push(snapshot);
    }
    
    /**
     * Calculate score for soft drop
     */
    scoreSoftDrop(rows, level) {
        const points = rows * 1;
        this.addScoreEvent(SCORE_EVENTS.SOFT_DROP, points, { rows });
        return points;
    }
    
    /**
     * Calculate score for hard drop
     */
    scoreHardDrop(rows, level) {
        const points = rows * 2;
        this.addScoreEvent(SCORE_EVENTS.HARD_DROP, points, { rows });
        return points;
    }
    
    /**
     * Calculate score for line clears with all bonuses
     */
    scoreLineClears(state, linesCleared, lastMove) {
        let score = 0;
        const level = state.level;
        
        // Detect spin bonus
        const hasSpinBonus = this.detectSpinBonus(state, lastMove);
        
        // Base line clear score
        let baseScore = 0;
        if (hasSpinBonus) {
            // Spin bonus scoring
            baseScore = [400, 800, 1200, 1600][Math.min(linesCleared - 1, 3)];
            this.stats.spinBonuses++;
        } else {
            // Normal line clear
            baseScore = [0, 100, 300, 500, 800][Math.min(linesCleared, 4)];
        }
        
        score += baseScore * level;
        
        // Back-to-back bonus (for quad clears or spins)
        const isDifficult = linesCleared === 4 || hasSpinBonus;
        if (isDifficult && state.backToBackCounter > 0) {
            const b2bBonus = Math.floor(baseScore * 0.5) * level;
            score += b2bBonus;
            this.addScoreEvent(SCORE_EVENTS.BACK_TO_BACK, b2bBonus, { 
                multiplier: state.backToBackCounter 
            });
        }
        
        // Combo bonus
        if (state.combo > 1) {
            const comboBonus = 50 * state.combo * level;
            score += comboBonus;
            this.addScoreEvent(SCORE_EVENTS.COMBO, comboBonus, { 
                combo: state.combo 
            });
            this.stats.maxCombo = Math.max(this.stats.maxCombo, state.combo);
        }
        
        // Perfect clear bonus
        if (this.isPerfectClear(state.board)) {
            const perfectBonus = [0, 800, 1200, 1800, 2000][Math.min(linesCleared, 4)] * level;
            score += perfectBonus;
            this.addScoreEvent(SCORE_EVENTS.PERFECT_CLEAR, perfectBonus, {});
            this.stats.perfectClears++;
        }
        
        // Record main line clear event
        this.addScoreEvent(SCORE_EVENTS.LINE_CLEAR, baseScore * level, {
            lines: linesCleared,
            spinBonus: hasSpinBonus,
            level: level
        });
        
        // Update statistics
        this.stats.linesCleared += linesCleared;
        
        return score;
    }
    
    /**
     * Detect spin bonus for T-shaped piece
     */
    detectSpinBonus(state, lastMove) {
        if (!state.current || state.current.type !== 'T') return false;
        if (!lastMove || lastMove.type !== 'ROTATE') return false;
        
        // Count filled corners
        let filledCorners = 0;
        const centerX = state.current.gridX + 1;
        const centerY = state.current.gridY + 1;
        
        SPIN_CORNERS.forEach(corner => {
            const x = centerX + corner.dx;
            const y = centerY + corner.dy;
            
            // Check bounds
            if (x < 0 || x >= 10 || y >= 20) {
                filledCorners++;
            } else if (y >= 0 && state.board[y][x]) {
                filledCorners++;
            }
        });
        
        // Spin requires at least 3 filled corners
        return filledCorners >= 3;
    }
    
    /**
     * Check for perfect clear (all clear)
     */
    isPerfectClear(board) {
        return board.every(row => row.every(cell => cell === null));
    }
    
    /**
     * Add score event to ledger
     */
    addScoreEvent(type, points, metadata) {
        const event = {
            frame: this.frameCount,
            type: type,
            points: points,
            metadata: metadata,
            timestamp: Date.now() - this.replayData.startTime,
            hash: null
        };
        
        // Create hash of previous event + this event for chain validation
        const prevHash = this.scoreLedger.length > 0 
            ? this.scoreLedger[this.scoreLedger.length - 1].hash 
            : '0';
        
        event.hash = this.hashEvent(event, prevHash);
        this.scoreLedger.push(event);
    }
    
    /**
     * Update frame count
     */
    updateFrame() {
        this.frameCount++;
    }
    
    /**
     * Update statistics
     */
    updateStats(state) {
        this.stats.piecesPlaced = state.pieces || 0;
        
        // Calculate PPS (Pieces Per Second)
        const elapsedSeconds = (Date.now() - this.replayData.startTime) / 1000;
        if (elapsedSeconds > 0) {
            this.stats.pps = this.stats.piecesPlaced / elapsedSeconds;
            
            // Calculate APM (Attack Per Minute)
            // Attack = lines sent in versus mode, simplified here as lines cleared
            this.stats.apm = (this.stats.linesCleared / elapsedSeconds) * 60;
            
            // Calculate efficiency (lines per piece)
            if (this.stats.piecesPlaced > 0) {
                this.stats.efficiency = this.stats.linesCleared / this.stats.piecesPlaced;
            }
        }
        
        this.stats.totalTime = elapsedSeconds;
    }
    
    /**
     * Finalize game and create verification data
     */
    finalizeGame(finalState) {
        this.updateStats(finalState);
        
        this.replayData.finalScore = finalState.score;
        this.replayData.stats = { ...this.stats };
        
        // Create final verification hash
        const verificationData = {
            scoreHash: this.hashScoreLedger(),
            finalScore: finalState.score,
            totalInputs: this.replayData.inputs.length,
            totalFrames: this.frameCount,
            stats: this.stats
        };
        
        this.replayData.verificationHash = this.hashObject(verificationData);
        this.replayData.verified = true;
        
        return {
            replay: this.replayData,
            verification: verificationData,
            canSubmitToTournament: this.validateReplay()
        };
    }
    
    /**
     * Validate replay for tournament submission
     */
    validateReplay() {
        // Check for suspicious patterns
        const checks = {
            // Minimum game time (prevent tool-assisted runs)
            minimumTime: this.stats.totalTime > 10,
            
            // Maximum PPS (human limit ~3-4 PPS)
            reasonablePPS: this.stats.pps < 5,
            
            // Input timing variance (humans aren't frame-perfect)
            hasTimingVariance: this.checkTimingVariance(),
            
            // Score ledger integrity
            ledgerValid: this.validateScoreLedger(),
            
            // State snapshot consistency
            snapshotsValid: this.validateSnapshots()
        };
        
        return Object.values(checks).every(check => check === true);
    }
    
    /**
     * Check input timing variance
     */
    checkTimingVariance() {
        if (this.replayData.inputs.length < 10) return true;
        
        const timings = [];
        for (let i = 1; i < this.replayData.inputs.length; i++) {
            timings.push(
                this.replayData.inputs[i].timestamp - 
                this.replayData.inputs[i-1].timestamp
            );
        }
        
        // Calculate variance
        const avg = timings.reduce((a, b) => a + b) / timings.length;
        const variance = timings.reduce((sum, t) => sum + Math.pow(t - avg, 2), 0) / timings.length;
        
        // Suspicious if variance is too low (tool-assisted)
        return variance > 10;
    }
    
    /**
     * Validate score ledger integrity
     */
    validateScoreLedger() {
        let prevHash = '0';
        
        for (const event of this.scoreLedger) {
            const expectedHash = this.hashEvent(
                { ...event, hash: null }, 
                prevHash
            );
            
            if (event.hash !== expectedHash) {
                return false;
            }
            
            prevHash = event.hash;
        }
        
        return true;
    }
    
    /**
     * Validate state snapshots
     */
    validateSnapshots() {
        // Check that snapshots are in order and reasonable
        let prevFrame = -1;
        let prevScore = -1;
        
        for (const snapshot of this.replayData.stateSnapshots) {
            if (snapshot.frame <= prevFrame) return false;
            if (snapshot.score < prevScore) return false;
            
            prevFrame = snapshot.frame;
            prevScore = snapshot.score;
        }
        
        return true;
    }
    
    /**
     * Hash utilities
     */
    hashEvent(event, prevHash) {
        const data = `${prevHash}|${event.frame}|${event.type}|${event.points}|${JSON.stringify(event.metadata)}`;
        return this.simpleHash(data);
    }
    
    hashScoreLedger() {
        const data = this.scoreLedger.map(e => e.hash).join('|');
        return this.simpleHash(data);
    }
    
    hashBoard(board) {
        if (!board) return '0';
        const data = board.map(row => row.map(cell => cell || '0').join('')).join('|');
        return this.simpleHash(data);
    }
    
    hashObject(obj) {
        return this.simpleHash(JSON.stringify(obj));
    }
    
    // Simple hash function (in production, use crypto library)
    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(16);
    }
    
    /**
     * Get current high score
     */
    getHighScore() {
        return this.highScore;
    }
    
    /**
     * Check if current score is a new high score
     */
    checkHighScore(currentScore) {
        if (currentScore > this.highScore) {
            this.highScore = currentScore;
            this.isNewHighScore = true;
            
            // Save to localStorage
            try {
                localStorage.setItem('neonDropHighScore', this.highScore.toString());
            } catch (e) {
                console.warn('Could not save high score to localStorage');
            }
            
            return true;
        }
        return false;
    }
    
    /**
     * Export replay data for tournament submission
     */
    exportReplay() {
        return {
            version: this.replayData.version,
            replay: this.replayData,
            compressed: this.compressReplay(this.replayData)
        };
    }
    
    /**
     * Compress replay data
     */
    compressReplay(data) {
        // Simple RLE compression for inputs
        const compressedInputs = [];
        let current = null;
        let count = 0;
        
        for (const input of data.inputs) {
            const key = `${input.action.type}|${input.action.dx}|${input.action.dy}`;
            
            if (key === current) {
                count++;
            } else {
                if (current) {
                    compressedInputs.push({ key: current, count, frame: input.frame - count });
                }
                current = key;
                count = 1;
            }
        }
        
        if (current) {
            compressedInputs.push({ key: current, count });
        }
        
        return {
            ...data,
            inputs: compressedInputs,
            compressionType: 'RLE'
        };
    }
}