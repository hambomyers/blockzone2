/**
 * particle-system.js - Spectacular particle effects
 * Pure functional particle system for line clear explosions
 * 
 * OPTIMIZED: Object pooling to reduce garbage collection
 */

// Particle pool for recycling
const particlePool = [];
const MAX_POOL_SIZE = 500;

/**
 * Create a single particle (with object pooling)
 */
export const createParticle = (x, y, color, intensity = 1.0) => {
    // Get recycled particle or create new one
    const particle = particlePool.length > 0 ? particlePool.pop() : {};
    
    // Set/reset all properties
    particle.x = x;
    particle.y = y;
    particle.vx = (Math.random() - 0.5) * 40 * intensity;  // Increased horizontal spread
    particle.vy = -Math.random() * 40 - 30;                // Much stronger upward burst
    particle.color = color;
    particle.life = 1.0;
    particle.size = 2 + Math.random() * 3;
    particle.rotation = Math.random() * Math.PI * 2;
    particle.rotationSpeed = (Math.random() - 0.5) * 0.3;
    particle.type = Math.random() < 0.7 ? 'square' : 'spark';  // Mix of particle types
    
    return particle;
};

/**
 * Create particles for a cleared block
 */
export const createBlockParticles = (blockX, blockY, color, blockSize) => {
    const particles = [];
    const particleCount = 15 + Math.floor(Math.random() * 10); // 15-25 particles per block
    
    for (let i = 0; i < particleCount; i++) {
        // Start from random position within the block
        const offsetX = Math.random() * blockSize;
        const offsetY = Math.random() * blockSize;
        
        particles.push(createParticle(
            blockX + offsetX,
            blockY + offsetY,
            color,
            1.0 + Math.random() * 0.5  // Slight intensity variation
        ));
    }
    
    // Add some special "glow" particles
    for (let i = 0; i < 3; i++) {
        const glowParticle = createParticle(
            blockX + blockSize / 2,
            blockY + blockSize / 2,
            color,
            0.5
        );
        glowParticle.type = 'glow';
        glowParticle.size = 10 + Math.random() * 5;
        glowParticle.vx *= 0.5;  // Slower horizontal movement
        glowParticle.vy *= 0.7;  // Less strong upward for glow
        particles.push(glowParticle);
    }
    
    return particles;
};

/**
 * Create explosion effect for cleared lines
 */
export const createLineExplosion = (board, clearedLines, boardX, boardY, blockSize) => {
    const particles = [];
    
    clearedLines.forEach(lineIndex => {
        const row = board[lineIndex];
        
        row.forEach((color, colIndex) => {
            if (color) {
                const blockParticles = createBlockParticles(
                    boardX + colIndex * blockSize,
                    boardY + lineIndex * blockSize,
                    color,
                    blockSize
                );
                particles.push(...blockParticles);
            }
        });
        
        // Add extra "shockwave" particles along the line
        for (let i = 0; i < 20; i++) {
            const shockwaveParticle = createParticle(
                boardX + Math.random() * (10 * blockSize),
                boardY + lineIndex * blockSize + blockSize / 2,
                '#FFFFFF',
                0.8
            );
            
            // Override some properties for shockwave effect
            shockwaveParticle.vx = (Math.random() - 0.5) * 30;
            shockwaveParticle.vy = (Math.random() - 0.5) * 5;
            shockwaveParticle.size = 1 + Math.random() * 2;
            shockwaveParticle.type = 'spark';
            
            particles.push(shockwaveParticle);
        }
    });
    
    return particles;
};

/**
 * Update a single particle
 */
export const updateParticle = (particle, deltaTime) => {
    const dt = deltaTime / 1000; // Convert to seconds
    
    // Lighter gravity and stronger air resistance for floatier particles
    const gravity = 250; // Reduced from 600
    const airResistance = 0.95; // Increased from 0.98 for more deceleration
    
    // Update velocity
    const newVy = particle.vy + gravity * dt;
    const newVx = particle.vx * Math.pow(airResistance, dt * 60);
    
    // Update position
    const newX = particle.x + newVx * dt * 60;
    const newY = particle.y + newVy * dt * 60;
    
    // Update life and size
    const lifeDecay = particle.type === 'glow' ? 0.5 : 1.0;
    const newLife = Math.max(0, particle.life - dt * lifeDecay);
    const newSize = particle.size * (0.5 + newLife * 0.5); // Shrink as it fades
    
    // Update rotation
    const newRotation = particle.rotation + particle.rotationSpeed;
    
    // Update particle properties in place
    particle.x = newX;
    particle.y = newY;
    particle.vx = newVx;
    particle.vy = newVy;
    particle.life = newLife;
    particle.size = newSize;
    particle.rotation = newRotation;
    
    return particle;
};

/**
 * Update all particles (with object pooling)
 */
export const updateParticles = (particles, deltaTime) => {
    const aliveParticles = [];
    
    particles.forEach(p => {
        const updated = updateParticle(p, deltaTime);
        
        if (updated.life > 0) {
            aliveParticles.push(updated);
        } else if (particlePool.length < MAX_POOL_SIZE) {
            // Recycle dead particle
            particlePool.push(updated);
        }
    });
    
    return aliveParticles;
};

/**
 * Render particles (used by renderer.js)
 */
export const renderParticles = (ctx, particles) => {
    ctx.save();
    
    particles.forEach(particle => {
        ctx.save();
        ctx.globalAlpha = particle.life * 0.8;
        
        if (particle.type === 'glow') {
            // Render glow particles with radial gradient
            const gradient = ctx.createRadialGradient(
                particle.x, particle.y, 0,
                particle.x, particle.y, particle.size
            );
            gradient.addColorStop(0, particle.color);
            gradient.addColorStop(0.4, particle.color);
            gradient.addColorStop(1, 'transparent');
            
            ctx.fillStyle = gradient;
            ctx.fillRect(
                particle.x - particle.size,
                particle.y - particle.size,
                particle.size * 2,
                particle.size * 2
            );
        } else if (particle.type === 'spark') {
            // Render spark particles as lines
            ctx.strokeStyle = particle.color;
            ctx.lineWidth = particle.size * 0.5;
            ctx.lineCap = 'round';
            
            ctx.beginPath();
            const tailLength = Math.min(10, Math.abs(particle.vx) * 0.2);
            ctx.moveTo(particle.x - particle.vx * 0.05, particle.y - particle.vy * 0.05);
            ctx.lineTo(particle.x, particle.y);
            ctx.stroke();
        } else {
            // Render square particles
            ctx.translate(particle.x, particle.y);
            ctx.rotate(particle.rotation);
            
            // Add slight glow effect
            ctx.shadowColor = particle.color;
            ctx.shadowBlur = particle.size * 0.5;
            
            ctx.fillStyle = particle.color;
            ctx.fillRect(
                -particle.size / 2,
                -particle.size / 2,
                particle.size,
                particle.size
            );
        }
        
        ctx.restore();
    });
    
    ctx.restore();
};

/**
 * Create quad clear (4-line) special effect
 */
export const createQuadClearEffect = (boardX, boardY, boardWidth, boardHeight) => {
    const particles = [];
    
    // Create vertical light beams
    for (let i = 0; i < 5; i++) {
        const x = boardX + (i + 0.5) * (boardWidth / 5);
        
        for (let j = 0; j < 30; j++) {
            const beamParticle = createParticle(
                x + (Math.random() - 0.5) * 20,
                boardY + boardHeight,
                '#FFFFFF',
                1.0
            );
            
            // Override for beam effect
            beamParticle.vx = (Math.random() - 0.5) * 2;
            beamParticle.vy = -300 - Math.random() * 200;
            beamParticle.size = 2 + Math.random() * 3;
            beamParticle.type = 'spark';
            
            particles.push(beamParticle);
        }
    }
    
    return particles;
};

/**
 * Create T-spin celebration effect
 */
export const createTSpinEffect = (centerX, centerY) => {
    const particles = [];
    const colors = ['#FF00FF', '#00FFFF', '#FFFF00', '#FF00FF'];
    
    // Create spiral effect
    for (let i = 0; i < 40; i++) {
        const angle = (i / 40) * Math.PI * 4;
        const radius = i * 2;
        const color = colors[Math.floor(i / 10)];
        
        const particle = createParticle(
            centerX + Math.cos(angle) * radius,
            centerY + Math.sin(angle) * radius,
            color,
            0.8
        );
        
        // Override for spiral effect
        particle.vx = Math.cos(angle) * 10;
        particle.vy = Math.sin(angle) * 10 - 15;
        particle.size = 3;
        particle.type = 'spark';
        particle.rotation = angle;
        particle.rotationSpeed = 0.1;
        
        particles.push(particle);
    }
    
    return particles;
};