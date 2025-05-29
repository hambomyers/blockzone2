/**
 * chiclet.js - Beautiful procedurally-varied glowing blocks
 * This is the visual heart of the game - each block is unique
 * 
 * OPTIMIZED: Lazy loading instead of pre-rendering 300 canvases
 */

export class ChicletRenderer {
    constructor() {
        this.blockSize = 30;
        this.cache = new Map();
        this.styleCache = new Map();
        this.initialized = false;
        
        // Cache size limits to prevent memory leaks
        this.MAX_CACHE_SIZE = 100;
        this.MAX_STYLE_CACHE_SIZE = 200;
    }
    
    initialize() {
        if (this.initialized) return;
        this.initialized = true;
        
        console.log('Chiclet renderer ready (lazy loading enabled)');
        // That's it! No pre-rendering needed
    }
    
    drawBlock(ctx, x, y, color, row, col, pieceData = null) {
        if (!this.initialized) {
            this.initialize();
        }
        
        // Create cache key based on actual rendered color
        let cacheKey;
        if (pieceData && pieceData.type === 'FLOAT') {
            const upMovesUsed = pieceData.upMovesUsed || 0;
            const brightness = Math.floor(255 - (upMovesUsed * 30));
            cacheKey = `FLOAT_${brightness}_${(row * 7 + col * 11) % 25}`;
        } else {
            const variant = (row * 7 + col * 11) % 25;
            cacheKey = `${color}-${variant}`;
        }
        
        // Check cache first
        let cachedBlock = this.cache.get(cacheKey);
        
        if (!cachedBlock) {
            // Create the cached block
            if (pieceData && pieceData.type === 'FLOAT') {
                const upMovesUsed = pieceData.upMovesUsed || 0;
                const brightness = Math.floor(255 - (upMovesUsed * 30));
                const hexBrightness = brightness.toString(16).padStart(2, '0');
                const actualColor = `#${hexBrightness}${hexBrightness}${hexBrightness}`;
                cachedBlock = this.createCachedBlock(actualColor, (row * 7 + col * 11) % 25);
            } else {
                cachedBlock = this.createCachedBlock(color, (row * 7 + col * 11) % 25);
            }
            
            // Manage cache size
            if (this.cache.size >= this.MAX_CACHE_SIZE) {
                const firstKey = this.cache.keys().next().value;
                this.cache.delete(firstKey);
            }
            
            this.cache.set(cacheKey, cachedBlock);
        }
        
        // Draw the cached block
        ctx.drawImage(cachedBlock, x, y);
        
        // Draw the pulsing glow ONLY for powered FLOAT pieces
        if (pieceData && pieceData.type === 'FLOAT' && (pieceData.upMovesUsed || 0) < 7) {
            this.drawFloatGlow(ctx, x, y, 7 - (pieceData.upMovesUsed || 0));
        }
        
        // ARROW FIX: Dark gray arrow for unused FLOAT pieces
        if (pieceData && pieceData.type === 'FLOAT' && (pieceData.upMovesUsed || 0) === 0) {
            this.drawFloatArrow(ctx, x, y);
        }
    }
    
    // ARROW FIX: New dark arrow method
    drawFloatArrow(ctx, x, y) {
        ctx.save();
        
        const centerX = x + this.blockSize / 2;
        const centerY = y + this.blockSize / 2;
        
        // Good visible size
        const arrowHeight = this.blockSize * 0.7;
        const arrowWidth = this.blockSize * 0.5;
        const stemWidth = this.blockSize * 0.2;
        
        // Dark gray with subtle pulsing
        const pulse = Math.sin(Date.now() * 0.004) * 0.1 + 0.9;  // 0.8-1.0 range
        
        // Dark gray arrow with high opacity
        ctx.fillStyle = `rgba(64, 64, 64, ${pulse})`;  // Dark gray
        ctx.strokeStyle = `rgba(32, 32, 32, ${pulse})`; // Even darker outline
        ctx.lineWidth = 2;
        
        // Draw arrow shape
        ctx.beginPath();
        ctx.moveTo(centerX, centerY - arrowHeight/2);
        ctx.lineTo(centerX + arrowWidth/2, centerY - arrowHeight/6);
        ctx.lineTo(centerX + stemWidth/2, centerY - arrowHeight/6);
        ctx.lineTo(centerX + stemWidth/2, centerY + arrowHeight/2);
        ctx.lineTo(centerX - stemWidth/2, centerY + arrowHeight/2);
        ctx.lineTo(centerX - stemWidth/2, centerY - arrowHeight/6);
        ctx.lineTo(centerX - arrowWidth/2, centerY - arrowHeight/6);
        ctx.closePath();
        
        // Fill with dark gray
        ctx.fill();
        
        // Dark subtle shadow for depth
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;
        ctx.stroke();
        
        ctx.restore();
    }
    
    // Simplified glow that's cheap to render every frame
    drawFloatGlow(ctx, x, y, powerLevel) {
        ctx.save();
        
        // Simple pulsing calculation
        const pulse = Math.sin(Date.now() * 0.003) * 0.3 + 0.7;
        const strength = (powerLevel / 7) * pulse;
        
        // Single radial gradient - much cheaper than complex effects
        const centerX = x + this.blockSize / 2;
        const centerY = y + this.blockSize / 2;
        const radius = this.blockSize * (0.7 + strength * 0.5);
        
        const gradient = ctx.createRadialGradient(
            centerX, centerY, this.blockSize * 0.3,
            centerX, centerY, radius
        );
        
        // Simple white glow - no rainbow effects in the animation
        gradient.addColorStop(0, `rgba(255, 255, 255, ${strength * 0.2})`);
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(
            centerX - radius,
            centerY - radius,
            radius * 2,
            radius * 2
        );
        
        ctx.restore();
    }
    
    createCachedBlock(color, variant) {
        const size = this.blockSize;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d', { alpha: true });
        
        this.drawChiclet(ctx, 0, 0, color, variant, variant);
        
        return canvas;
    }
    
    getChicletStyle(row, col, color) {
        const key = `${row}-${col}-${color}`;
        if (this.styleCache.has(key)) {
            return this.styleCache.get(key);
        }
        
        // For FLOAT pieces with power level keys
        let actualColor = color;
        if (color.startsWith('#FLOAT_')) {
            const brightness = parseInt(color.split('_')[1]);
            const hex = brightness.toString(16).padStart(2, '0');
            actualColor = `#${hex}${hex}${hex}`;
        }
        
        const r = parseInt(actualColor.substr(1, 2), 16);
        const g = parseInt(actualColor.substr(3, 2), 16);
        const b = parseInt(actualColor.substr(5, 2), 16);
        
        // Special handling for white/gray floater pieces
        const isFloat = color.startsWith('#FLOAT_') || actualColor === '#FFFFFF';
        
        if (isFloat) {
            const seed = row * 37 + col * 41;
            
            // Subtle color tints for white pieces
            const tintAmount = 5; // Very subtle
            const tints = [
                { r: tintAmount, g: 0, b: 0 },     // Slight red
                { r: 0, g: tintAmount, b: 0 },     // Slight green
                { r: 0, g: 0, b: tintAmount },     // Slight blue
                { r: tintAmount, g: tintAmount, b: 0 }, // Slight yellow
            ];
            
            const tint = tints[seed % tints.length];
            const tintedR = Math.min(255, r + tint.r);
            const tintedG = Math.min(255, g + tint.g);
            const tintedB = Math.min(255, b + tint.b);
            
            const style = {
                edge: `rgb(${Math.max(0, r - 30)}, ${Math.max(0, g - 30)}, ${Math.max(0, b - 30)})`,
                middle: `rgb(${tintedR}, ${tintedG}, ${tintedB})`,
                highlight: `rgb(${Math.min(255, r + 20)}, ${Math.min(255, g + 20)}, ${Math.min(255, b + 20)})`,
                
                // More variations for visual interest
                topCurve: (seed % 4) !== 0,
                rightCurve: ((seed + 1) % 4) !== 0,
                bottomCurve: ((seed + 2) % 4) !== 0,
                leftCurve: ((seed + 3) % 4) !== 0,
                
                topVar: ((seed % 200 - 100) / 150),
                rightVar: (((seed * 3) % 200 - 100) / 150),
                bottomVar: (((seed * 5) % 200 - 100) / 150),
                leftVar: (((seed * 7) % 200 - 100) / 150),
                
                shineSpots: this.calculateShineSpots(row, col, true), // More shine spots
                isBlack: false,
                isWhite: true
            };
            
            this.styleCache.set(key, style);
            return style;
        }
        
        // Rest of the original logic for non-float pieces
        const isWhite = actualColor === '#FFFFFF';
        const edgeAdjust = isWhite ? 40 : 60;
        const middleAdjust = isWhite ? 30 : 60;
        
        const style = {
            edge: `#${Math.max(0, r - edgeAdjust).toString(16).padStart(2, '0')}${Math.max(0, g - edgeAdjust).toString(16).padStart(2, '0')}${Math.max(0, b - edgeAdjust).toString(16).padStart(2, '0')}`,
            middle: isWhite ? '#FFFFFF' : `#${Math.min(255, r + middleAdjust).toString(16).padStart(2, '0')}${Math.min(255, g + middleAdjust).toString(16).padStart(2, '0')}${Math.min(255, b + middleAdjust).toString(16).padStart(2, '0')}`,
            highlight: isWhite ? '#FFFFFF' : `#${Math.min(255, r + 120).toString(16).padStart(2, '0')}${Math.min(255, g + 120).toString(16).padStart(2, '0')}${Math.min(255, b + 120).toString(16).padStart(2, '0')}`,
            
            topCurve: (row * 7 + col * 11) % 3 === 0,
            rightCurve: (row * 13 + col * 17) % 3 === 0,
            bottomCurve: (row * 19 + col * 23) % 3 === 0,
            leftCurve: (row * 29 + col * 31) % 3 === 0,
            
            topVar: ((row * 37 + col * 41) % 200 - 100) / 100,
            rightVar: ((row * 43 + col * 47) % 200 - 100) / 100,
            bottomVar: ((row * 53 + col * 59) % 200 - 100) / 100,
            leftVar: ((row * 61 + col * 67) % 200 - 100) / 100,
            
            shineSpots: this.calculateShineSpots(row, col, isWhite),
            isBlack: actualColor === '#000000',
            isWhite: isWhite
        };
        
        // Check cache size limit
        if (this.styleCache.size >= this.MAX_STYLE_CACHE_SIZE) {
            // Clear half the cache when limit reached
            let count = 0;
            for (const [k] of this.styleCache) {
                if (count++ >= this.MAX_STYLE_CACHE_SIZE / 2) break;
                this.styleCache.delete(k);
            }
        }
        
        this.styleCache.set(key, style);
        return style;
    }
    
    calculateShineSpots(row, col, isWhite) {
        const spots = [];
        const numSpots = isWhite ? 5 : (3 + ((row * 71 + col * 73) % 3));
        
        for (let i = 0; i < numSpots; i++) {
            const seed = row * 79 + col * 83 + i * 89;
            const angle = (seed * 0.1) % (Math.PI * 2);
            const radius = 0.15 + ((seed * 97) % 100) / 100 * 0.25;
            
            const x = Math.max(0.1, Math.min(0.9, 0.5 + Math.cos(angle) * radius));
            const y = Math.max(0.1, Math.min(0.9, 0.5 + Math.sin(angle) * radius));
            const size = isWhite ? 0.15 + ((seed * 101) % 100) / 100 * 0.15 : 0.08 + ((seed * 101) % 100) / 100 * 0.12;
            const intensity = isWhite ? 0.9 + ((seed * 103) % 100) / 100 * 0.1 : 0.7 + ((seed * 103) % 100) / 100 * 0.3;
            const isEdge = ((seed * 131) % 100) < 60;
            
            spots.push({ x, y, size, intensity, isEdge, angle });
        }
        
        return spots;
    }
    
    drawChiclet(ctx, x, y, color, row, col) {
        const size = this.blockSize - 1;
        const style = this.getChicletStyle(row, col, color);
        
        const blockX = x;
        const blockY = y;
        const cornerRadius = 4;
        
        // Draw chiclet shape with edge variations
        ctx.beginPath();
        
        // Top edge
        ctx.moveTo(blockX + cornerRadius, blockY);
        if (style.topCurve) {
            ctx.quadraticCurveTo(
                blockX + size/2, blockY + style.topVar,
                blockX + size - cornerRadius, blockY
            );
        } else {
            ctx.lineTo(blockX + size - cornerRadius, blockY);
        }
        
        // Top-right corner
        ctx.quadraticCurveTo(blockX + size, blockY, blockX + size, blockY + cornerRadius);
        
        // Right edge
        if (style.rightCurve) {
            ctx.quadraticCurveTo(
                blockX + size + style.rightVar, blockY + size/2,
                blockX + size, blockY + size - cornerRadius
            );
        } else {
            ctx.lineTo(blockX + size, blockY + size - cornerRadius);
        }
        
        // Bottom-right corner
        ctx.quadraticCurveTo(blockX + size, blockY + size, blockX + size - cornerRadius, blockY + size);
        
        // Bottom edge
        if (style.bottomCurve) {
            ctx.quadraticCurveTo(
                blockX + size/2, blockY + size + style.bottomVar,
                blockX + cornerRadius, blockY + size
            );
        } else {
            ctx.lineTo(blockX + cornerRadius, blockY + size);
        }
        
        // Bottom-left corner
        ctx.quadraticCurveTo(blockX, blockY + size, blockX, blockY + size - cornerRadius);
        
        // Left edge
        if (style.leftCurve) {
            ctx.quadraticCurveTo(
                blockX + style.leftVar, blockY + size/2,
                blockX, blockY + cornerRadius
            );
        } else {
            ctx.lineTo(blockX, blockY + cornerRadius);
        }
        
        // Top-left corner
        ctx.quadraticCurveTo(blockX, blockY, blockX + cornerRadius, blockY);
        ctx.closePath();
        
        // Fill with edge color
        ctx.fillStyle = style.edge;
        ctx.fill();
        
        // Gradient fill
        const gradient = ctx.createRadialGradient(
            blockX + size/2, blockY + size/2, size * 0.15,
            blockX + size/2, blockY + size/2, size * 0.9
        );
        
        if (style.isWhite) {
            // Special gradient for white floater
            gradient.addColorStop(0, '#FFFFFF');
            gradient.addColorStop(0.5, '#F0F0F0');
            gradient.addColorStop(1, '#C0C0C0');
        } else if (style.isBlack) {
            // Special gradient for black O-piece
            gradient.addColorStop(0, '#333333');
            gradient.addColorStop(0.6, '#000000');
            gradient.addColorStop(1, '#000000');
        } else {
            gradient.addColorStop(0, style.middle);
            gradient.addColorStop(0.6, color);
            gradient.addColorStop(1, style.edge);
        }
        
        ctx.fillStyle = gradient;
        ctx.fill();
        
        // Draw shine spots
        ctx.save();
        ctx.clip();
        
        style.shineSpots.forEach(spot => {
            const spotX = blockX + spot.x * size;
            const spotY = blockY + spot.y * size;
            const spotSize = spot.size * size;
            const alpha = style.isBlack ? spot.intensity * 0.5 : spot.intensity;
            
            if (spot.isEdge) {
                // Elongated edge highlights
                ctx.save();
                ctx.translate(spotX, spotY);
                ctx.rotate(spot.angle);
                ctx.scale(1, 2.5);
                
                const effectiveSize = Math.max(0.5, spotSize);
                const shine = ctx.createRadialGradient(0, 0, 0, 0, 0, effectiveSize);
                shine.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
                shine.addColorStop(0.5, `rgba(255, 255, 255, ${alpha * 0.3})`);
                shine.addColorStop(1, 'rgba(255, 255, 255, 0)');
                
                ctx.fillStyle = shine;
                ctx.beginPath();
                ctx.arc(0, 0, effectiveSize, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            } else {
                // Round shine spots
                const effectiveSize = Math.max(0.5, spotSize);
                const shine = ctx.createRadialGradient(spotX, spotY, 0, spotX, spotY, effectiveSize);
                shine.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
                shine.addColorStop(0.6, `rgba(255, 255, 255, ${alpha * 0.5})`);
                shine.addColorStop(1, 'rgba(255, 255, 255, 0)');
                
                ctx.fillStyle = shine;
                ctx.beginPath();
                ctx.arc(spotX, spotY, effectiveSize, 0, Math.PI * 2);
                ctx.fill();
            }
        });
        
        ctx.restore();
        
        // Edge highlight
        ctx.strokeStyle = style.highlight;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.6;
        
        ctx.beginPath();
        // Just trace the top and left edges for highlight
        ctx.moveTo(blockX + cornerRadius, blockY);
        if (style.topCurve) {
            ctx.quadraticCurveTo(blockX + size/2, blockY + style.topVar, blockX + size - cornerRadius, blockY);
        } else {
            ctx.lineTo(blockX + size - cornerRadius, blockY);
        }
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(blockX + cornerRadius, blockY);
        ctx.quadraticCurveTo(blockX, blockY, blockX, blockY + cornerRadius);
        if (style.leftCurve) {
            ctx.quadraticCurveTo(blockX + style.leftVar, blockY + size/2, blockX, blockY + size - cornerRadius);
        } else {
            ctx.lineTo(blockX, blockY + size - cornerRadius);
        }
        ctx.stroke();
        
        ctx.globalAlpha = 1;
        
        // Extra glow for white floater
        if (style.isWhite) {
            ctx.save();
            ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
            ctx.shadowBlur = 8;
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.lineWidth = 2;
            
            ctx.beginPath();
            ctx.moveTo(blockX + cornerRadius, blockY);
            ctx.lineTo(blockX + size - cornerRadius, blockY);
            ctx.quadraticCurveTo(blockX + size, blockY, blockX + size, blockY + cornerRadius);
            ctx.lineTo(blockX + size, blockY + size - cornerRadius);
            ctx.quadraticCurveTo(blockX + size, blockY + size, blockX + size - cornerRadius, blockY + size);
            ctx.lineTo(blockX + cornerRadius, blockY + size);
            ctx.quadraticCurveTo(blockX, blockY + size, blockX, blockY + size - cornerRadius);
            ctx.lineTo(blockX, blockY + cornerRadius);
            ctx.quadraticCurveTo(blockX, blockY, blockX + cornerRadius, blockY);
            ctx.stroke();
            
            ctx.restore();
        }
    }
    
    // Clear caches if needed
    clearCache() {
        this.cache.clear();
        this.styleCache.clear();
        this.initialized = false;
    }
}