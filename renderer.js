/**
 * renderer.js - Visual rendering engine
 * 
 * MA aesthetic: Board is invisible negative space defined by UI elements
 * Elements sit directly on the void, creating implied boundaries
 * 
 * UPDATED: Unified pixelated rendering for preview and hold pieces
 */

import { ChicletRenderer } from './chiclet.js';
import * as Physics from './physics-pure.js';
import * as ParticleSystem from './particle-system.js';
import * as Engine from './game-engine.js';

export class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d', { alpha: true }); // Enable transparency
        this.chicletRenderer = new ChicletRenderer();
        
        this.blockSize = 24;
        
        // Track last piece generation for spawn detection
        this.lastGeneration = 0;
        
        this.setupCanvas();
    }
    
    setupCanvas() {
        const boardWidth = 10 * this.blockSize;  // 240px
        const boardHeight = 20 * this.blockSize; // 480px
        
        // Equal margins for perfect centering
        const marginVertical = 40;   // Equal top and bottom margins
        const marginHorizontal = 60; // Space on sides (no hold box needed there anymore)
        
        // UI elements heights
        const titleHeight = this.blockSize;     // NEON DROP row
        const uiBottomHeight = 50;              // Space for scores and hold piece
        
        // Calculate total canvas size
        this.canvas.width = marginHorizontal * 2 + boardWidth;
        this.canvas.height = marginVertical + titleHeight + boardHeight + uiBottomHeight + marginVertical;
        
        // Center the board horizontally
        this.boardX = (this.canvas.width - boardWidth) / 2;
        
        // Position board vertically with equal spacing
        this.boardY = marginVertical + titleHeight;
        
        this.chicletRenderer.blockSize = this.blockSize;
        this.chicletRenderer.initialize();
        
        // Note: Add this to index.html for Bungee font:
        // <link href="https://fonts.googleapis.com/css2?family=Bungee&display=swap" rel="stylesheet">
    }
    
    render(state, starfieldEnabled = false) {
        // If starfield is enabled, start with transparent canvas to show stars
        if (starfieldEnabled) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            
            // Fill ONLY the game board area with black
            this.ctx.fillStyle = '#000000';
            this.ctx.fillRect(
                this.boardX,
                this.boardY,
                10 * this.blockSize,
                20 * this.blockSize
            );
        } else {
            // No starfield - fill entire canvas with black
            this.ctx.fillStyle = '#000000';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }
        
        // Draw game elements that define the board through negative space
        this.renderBoard(state);
        this.renderCurrentPiece(state);
        this.renderGhostPiece(state);
        
        // Render death piece if it exists
        if (state.deathPiece) {
            const deathPieceOpacity = state.phase === 'GAME_OVER' ? 0.3 : 1.0; // Uniform opacity rule
            this.renderPieceAt(
                state.deathPiece,
                state.deathPiece.gridX * this.blockSize,
                state.deathPiece.gridY * this.blockSize,
                deathPieceOpacity  // Apply consistent opacity
            );
        }
        
        this.renderTitle(state);
        this.renderHoldPiece(state);
        this.renderUI(state);
        this.renderStats(state);
        
        // Render particles if any
        if (state.particles && state.particles.length > 0) {
            this.renderParticles(state.particles);
        }
        
        // Render overlays (menu, pause, game over)
        this.renderOverlays(state);
    }
    
    renderBoard(state) {
        // No board background - just draw the pieces on the void
        state.board.forEach((row, y) => {
            row.forEach((color, x) => {
                if (color) {
                    // Flash clearing lines
                    if (state.clearingLines && state.clearingLines.includes(y)) {
                        this.ctx.globalAlpha = 0.5 + 0.5 * Math.sin(Date.now() * 0.02);
                    }
                    
                    this.chicletRenderer.drawBlock(
                        this.ctx,
                        this.boardX + x * this.blockSize,
                        this.boardY + y * this.blockSize,
                        color, y, x
                    );
                    
                    this.ctx.globalAlpha = 1;
                }
            });
        });
    }
    
    renderCurrentPiece(state) {
        if (!state.current || state.phase === 'GAME_OVER') return;
        
        // Get visual position with gravity smoothing
        const visualPos = this.getVisualPosition(state, state.current);
        
        this.renderPieceAt(
            state.current,
            visualPos.x,
            visualPos.y,
            1.0
        );
    }
    
    renderGhostPiece(state) {
        if (!state.current || state.phase === 'GAME_OVER') return;
        
        // Calculate ghost position
        const ghostY = Physics.calculateShadow(state.board, state.current, state.shadowCache || new Map());
        
        // Don't render if piece is already at ghost
        if (state.current.gridY === ghostY) return;
        
        // Ghost is always at grid position (no smoothing)
        this.renderPieceAt(
            state.current,
            state.current.gridX * this.blockSize,
            ghostY * this.blockSize,
            0.3
        );
    }
    
    renderPieceAt(piece, pixelX, pixelY, opacity) {
        this.ctx.globalAlpha = opacity;
        
        piece.shape.forEach((row, dy) => {
            row.forEach((cell, dx) => {
                if (cell) {
                    this.chicletRenderer.drawBlock(
                        this.ctx,
                        this.boardX + pixelX + dx * this.blockSize,
                        this.boardY + pixelY + dy * this.blockSize,
                        piece.color,
                        piece.rotation * 4 + dy,
                        piece.rotation * 4 + dx,
                        piece
                    );
                }
            });
        });
        
        this.ctx.globalAlpha = 1;
    }
    
    /**
     * Unified pixelated piece rendering
     * Pure function that handles all pixelated piece rendering cases
     */
    renderPixelatedPiece(piece, config) {
        const {
            centerX,
            centerY,
            maxWidth = null,
            maxHeight = null,
            pixelSize = 4,
            gapSize = 2,
            scale = 1,
            opacity = 1
        } = config;
        
        this.ctx.save();
        this.ctx.globalAlpha = opacity;
        
        // Special handling for FLOAT pieces - 2x scale
        const pieceScale = piece.type === 'FLOAT' ? 2 : 1;
        const effectivePixelSize = pixelSize * pieceScale;
        const effectiveGapSize = gapSize * pieceScale;
        
        // Calculate piece bounds
        let minX = piece.shape[0].length, maxX = 0;
        let minY = piece.shape.length, maxY = 0;
        
        piece.shape.forEach((row, dy) => {
            row.forEach((cell, dx) => {
                if (cell) {
                    minX = Math.min(minX, dx);
                    maxX = Math.max(maxX, dx);
                    minY = Math.min(minY, dy);
                    maxY = Math.max(maxY, dy);
                }
            });
        });
        
        const pieceWidth = (maxX - minX + 1) * (effectivePixelSize + effectiveGapSize) - effectiveGapSize;
        const pieceHeight = (maxY - minY + 1) * (effectivePixelSize + effectiveGapSize) - effectiveGapSize;
        
        // Calculate scale to fit within constraints if provided
        let finalScale = scale;
        if (maxWidth && maxHeight) {
            const scaleX = maxWidth / pieceWidth;
            const scaleY = maxHeight / pieceHeight;
            finalScale = Math.min(scaleX, scaleY, scale);
        }
        
        // Apply scaling
        this.ctx.translate(centerX, centerY);
        this.ctx.scale(finalScale, finalScale);
        
        // Draw pixels centered at origin
        const startX = -pieceWidth / 2;
        const startY = -pieceHeight / 2;
        
        piece.shape.forEach((row, dy) => {
            row.forEach((cell, dx) => {
                if (cell) {
                    const pixelX = startX + (dx - minX) * (effectivePixelSize + effectiveGapSize);
                    const pixelY = startY + (dy - minY) * (effectivePixelSize + effectiveGapSize);
                    
                    this.ctx.fillStyle = piece.color;
                    // Rounded rectangle for pixelated effect
                    this.ctx.beginPath();
                    this.ctx.roundRect(pixelX, pixelY, effectivePixelSize, effectivePixelSize, 1);
                    this.ctx.fill();
                }
            });
        });
        
        this.ctx.restore();
    }
    
    renderTitle(state) {
        // Title is "row -1" of the board grid
        const titleY = this.boardY - this.blockSize;
        
        // NEON blocks at columns 0-3
        ['N', 'E', 'O', 'N'].forEach((letter, i) => {
            const x = this.boardX + i * this.blockSize;
            
            // Draw the full chiclet block first
            this.chicletRenderer.drawBlock(this.ctx, x, titleY, '#FFFF00', 0, i);
            
            // Now cut out the letter
            this.ctx.save();
            this.ctx.globalCompositeOperation = 'destination-out';
            
            // 28px bubble letter
            this.ctx.font = 'bold 28px Bungee, monospace';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillStyle = 'rgba(0,0,0,1)'; // Full opacity black for complete cutout
            
            // Shift down by 1 pixel (was 2, now up by 1)
            this.ctx.fillText(letter, x + this.blockSize / 2, titleY + this.blockSize / 2 + 1);
            
            this.ctx.restore();
        });
        
        // DROP blocks at columns 6-9
        ['D', 'R', 'O', 'P'].forEach((letter, i) => {
            const x = this.boardX + (i + 6) * this.blockSize;
            
            // Draw the full chiclet block first
            this.chicletRenderer.drawBlock(this.ctx, x, titleY, '#FFFF00', 0, i + 6);
            
            // Now cut out the letter
            this.ctx.save();
            this.ctx.globalCompositeOperation = 'destination-out';
            
            // 28px bubble letter
            this.ctx.font = 'bold 28px Bungee, monospace';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillStyle = 'rgba(0,0,0,1)'; // Full opacity black for complete cutout
            
            // Shift down by 1 pixel (was 2, now up by 1)
            this.ctx.fillText(letter, x + this.blockSize / 2, titleY + this.blockSize / 2 + 1);
            
            this.ctx.restore();
        });
        
        // Pixelated preview piece in columns 4-5, sitting on board
        if (state.next && state.phase !== 'GAME_OVER') {
            const previewX = this.boardX + 5 * this.blockSize; // Center of columns 4-5
            
            // Calculate the scale based on I-piece fitting in preview area
            const targetWidth = this.blockSize * 2 - 2; // 46 pixels
            const iPieceBaseWidth = 4 * 4 + 3 * 2; // 22 pixels
            const universalScale = targetWidth / iPieceBaseWidth; // ~2.09
            
            // Calculate piece dimensions to position bottom at board edge
            const pieceScale = state.next.type === 'FLOAT' ? 2 : 1;
            const effectivePixelSize = 4 * pieceScale;
            const effectiveGapSize = 2 * pieceScale;
            
            // Find piece bounds
            let minY = state.next.shape.length, maxY = 0;
            state.next.shape.forEach((row, dy) => {
                row.forEach((cell, dx) => {
                    if (cell) {
                        minY = Math.min(minY, dy);
                        maxY = Math.max(maxY, dy);
                    }
                });
            });
            
            const pieceHeight = (maxY - minY + 1) * (effectivePixelSize + effectiveGapSize) - effectiveGapSize;
            const scaledHeight = pieceHeight * universalScale;
            
            // Use unified renderer with bottom-aligned positioning
            this.renderPixelatedPiece(state.next, {
                centerX: previewX,
                centerY: this.boardY - scaledHeight / 2, // Position so bottom touches board
                pixelSize: 4,
                gapSize: 2,
                scale: universalScale
            });
        }
    }
    
    renderHoldPiece(state) {
        if (!state.hold) return;
        
        // Hold piece at bottom center, between scores
        const boardBottom = this.boardY + 20 * this.blockSize;
        const boardCenterX = this.canvas.width / 2;  // True center of canvas
        
        // Calculate the universal scale based on I-piece
        const targetWidth = this.blockSize * 2 - 2; // Same as preview
        const iPieceBaseWidth = 4 * 4 + 3 * 2; // 22 pixels
        const universalScale = targetWidth / iPieceBaseWidth; // ~2.09
        
        // Calculate piece height to position top edge aligned with score text
        const pieceScale = state.hold.type === 'FLOAT' ? 2 : 1;
        const effectivePixelSize = 4 * pieceScale;
        const effectiveGapSize = 2 * pieceScale;
        
        // Find piece bounds
        let minY = state.hold.shape.length, maxY = 0;
        state.hold.shape.forEach((row, dy) => {
            row.forEach((cell, dx) => {
                if (cell) {
                    minY = Math.min(minY, dy);
                    maxY = Math.max(maxY, dy);
                }
            });
        });
        
        const pieceHeight = (maxY - minY + 1) * (effectivePixelSize + effectiveGapSize) - effectiveGapSize;
        const scaledHeight = pieceHeight * universalScale;
        
        // Position so top of piece is 1 pixel below board (same as score text top)
        const holdTopY = boardBottom + 1;
        const holdCenterY = holdTopY + scaledHeight / 2;
        
        // Render held piece using unified renderer
        this.renderPixelatedPiece(state.hold, {
            centerX: boardCenterX,
            centerY: holdCenterY,
            pixelSize: 4,  // Same as preview
            gapSize: 2,    // Same as preview
            scale: universalScale,  // Same scale as preview
            opacity: state.canHold ? 1.0 : 0.5
        });
    }
    
    renderUI(state) {
        const boardBottom = this.boardY + 20 * this.blockSize;

        // Position elements 1 pixel below board
        const uiY = boardBottom + 1;

        // 80s computer font - blocky and white
        this.ctx.font = '16px monospace';
        this.ctx.textBaseline = 'top'; // Align text by its top edge

        // P1 score - left aligned with board
        this.ctx.textAlign = 'left';
        const p1Score = state.score.toString().padStart(6, '0');

        // Check if beating high score
        const isNewHighScore = state.score > (state.highScore || 0);
        this.ctx.fillStyle = isNewHighScore ? '#FFFF00' : '#FFFFFF';
        this.ctx.fillText(`P1 ${p1Score}`, this.boardX, uiY);

        // High score - right aligned with board
        this.ctx.textAlign = 'right';
        const displayHighScore = isNewHighScore ? state.score : (state.highScore || 0);
        const highScore = displayHighScore.toString().padStart(6, '0');
        const rightX = this.boardX + 10 * this.blockSize;
        this.ctx.fillStyle = isNewHighScore ? '#FFFF00' : '#FFFFFF';
        this.ctx.fillText(`HS ${highScore}`, rightX, uiY);

        // Render glowing high score indicator underneath scoring elements
        if (isNewHighScore && state.phase !== 'GAME_OVER') {
            this.ctx.save();
            const boardCenterX = this.boardX + 5 * this.blockSize;
            const glowY = uiY + 16; // Adjust to place it below the scoring elements
            this.ctx.font = 'bold 16px monospace';
            this.ctx.fillStyle = 'rgba(255, 200, 0, 0.5)'; // Warm glow at 50% opacity
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'top';
            this.ctx.shadowColor = 'rgba(255, 200, 0, 0.5)';
            this.ctx.shadowBlur = 10;
            this.ctx.fillText('NEW HIGH SCORE!', boardCenterX, glowY);
            this.ctx.restore();
        }
    }
    
    renderStats(state) {
        // Stats removed - keeping it clean and simple
    }
    
    renderParticles(particles) {
        if (!particles || particles.length === 0) return;
        ParticleSystem.renderParticles(this.ctx, particles);
    }
    
    renderOverlays(state) {
        if (!['MENU', 'PAUSED', 'GAME_OVER'].includes(state.phase)) return;
        
        // All overlays share the same dimming
        this.dimBoardArea();
        
        // Render phase-specific content
        const overlayContent = {
            'MENU': () => this.renderMenuContent(),
            'PAUSED': () => this.renderPausedContent(),
            'GAME_OVER': () => this.renderGameOverContent()
        };
        
        overlayContent[state.phase]?.();
    }
    
    dimBoardArea() {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(
            this.boardX, 
            this.boardY,
            10 * this.blockSize,
            20 * this.blockSize
        );
    }
    
    renderMenuContent() {
        // Stretch "PRESS SPACE TO START" to exactly fit board width
        const text = 'PRESS SPACE TO START';
        const boardWidth = 10 * this.blockSize;
        const centerY = this.boardY + 10 * this.blockSize;
        
        // Use Bungee font to match title
        const fontSize = 14;
        this.ctx.font = `${fontSize}px Bungee, monospace`;
        this.ctx.fillStyle = '#FFFF00';
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'middle';
        
        // Calculate width of each character
        const charWidths = [];
        for (let i = 0; i < text.length; i++) {
            charWidths.push(this.ctx.measureText(text[i]).width);
        }
        
        // Calculate total width of all characters
        const totalCharWidth = charWidths.reduce((sum, w) => sum + w, 0);
        
        // Calculate spacing between characters
        // We need the last character to END at the right edge, not START there
        const availableSpace = boardWidth - totalCharWidth;
        const spacingPerGap = availableSpace / (text.length - 1);
        
        // Draw each character
        let x = this.boardX; // Start exactly at left edge
        for (let i = 0; i < text.length; i++) {
            this.ctx.fillText(text[i], x, centerY);
            x += charWidths[i] + (i < text.length - 1 ? spacingPerGap : 0);
        }
    }
    
    renderPausedContent() {
        this.ctx.font = '36px monospace';
        this.ctx.fillStyle = '#FFFF00';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('PAUSED', 
            this.boardX + 10 * this.blockSize / 2,
            this.boardY + 20 * this.blockSize / 2);
    }
    
    renderGameOverContent() {
        this.ctx.font = '36px monospace';
        this.ctx.fillStyle = '#FF0000';
        this.ctx.textAlign = 'center';
        const centerX = this.boardX + 10 * this.blockSize / 2;
        const centerY = this.boardY + 20 * this.blockSize / 2;
        this.ctx.fillText('GAME OVER', centerX, centerY - 20);
        
        this.ctx.font = '18px monospace';
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.fillText('Press Space to restart', centerX, centerY + 20);
    }
    
    getVisualPosition(state, piece) {
        if (!piece) return { x: 0, y: 0 };
        
        // Detect new piece spawn
        if (piece.generation && piece.generation !== this.lastGeneration) {
            this.lastGeneration = piece.generation;
        }
        
        // Calculate position (no smoothing for horizontal moves)
        const x = piece.gridX * this.blockSize;
        let y = piece.gridY * this.blockSize;
        
        // Add smooth gravity falling ONLY if not resting on shadow
        if (state.gravityAccumulator !== undefined && state.mode && state.phase === 'FALLING') {
            // Check if piece is at its shadow position
            const shadowY = Physics.calculateShadow(state.board, piece, state.shadowCache || new Map());
            const isResting = piece.gridY === shadowY;
            
            // Only apply visual gravity if piece can actually fall
            if (!isResting) {
                const gravityDelay = state.mode.gravity(state.level);
                const gravityProgress = Math.min(state.gravityAccumulator / gravityDelay, 1);
                y += gravityProgress * this.blockSize;
                
                // Clamp to ensure we never render below the shadow
                const maxY = shadowY * this.blockSize;
                y = Math.min(y, maxY);
            }
        }
        
        return { x, y };
    }
}