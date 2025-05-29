/**
 * audio-system.js - Reactive audio engine
 * 
 * Plays sounds by detecting state changes:
 * - Movement sounds (move, rotate, drop)
 * - Game events (lock, clear, quadclear)
 * - UI feedback (level up, game over)
 * 
 * Uses Web Audio API for low-latency sound generation
 */

export class AudioSystem {
    constructor() {
        this.ctx = null;
        this.initialized = false;
        this.lastPlayed = new Map(); // Prevent sound spam
        this.volume = 0.3;
    }
    
    // Simplified Tibetan gong sound for game over
    playGongSound() {
        const now = this.ctx.currentTime;
        
        // Fewer oscillators with more natural harmonics
        const fundamentalFreq = 60; // Deeper fundamental for more resonance
        const harmonics = [1, 2.76, 5.4]; // Simpler harmonic structure
        
        harmonics.forEach((harmonic, index) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            
            osc.frequency.setValueAtTime(fundamentalFreq * harmonic, now);
            osc.type = 'sine';
            
            // Initial strike - longer, smoother attack
            const attackTime = 0.05;
            const decayTime = 0.3;
            const sustainLevel = 0.2 / (index + 1); // Higher harmonics quieter
            const releaseTime = 4.0; // Long, natural ring-out
            
            // ADSR envelope - smoother curve
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(this.volume * 0.7 / (index + 1), now + attackTime);
            gain.gain.exponentialRampToValueAtTime(sustainLevel * this.volume, now + attackTime + decayTime);
            gain.gain.exponentialRampToValueAtTime(0.001, now + releaseTime);
            
            // Subtle vibrato - much reduced
            const vibrato = this.ctx.createOscillator();
            const vibratoGain = this.ctx.createGain();
            vibrato.frequency.setValueAtTime(2.5, now); // Slower, consistent wobble
            vibratoGain.gain.setValueAtTime(harmonic * 0.6, now); // Much less pitch variation
            
            vibrato.connect(vibratoGain);
            vibratoGain.connect(osc.frequency);
            
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            
            osc.start(now);
            osc.stop(now + releaseTime + 0.1);
            vibrato.start(now);
            vibrato.stop(now + releaseTime + 0.1);
        });
        
        // Simplified strike sound - less metallic
        const noise = this.ctx.createBufferSource();
        const noiseBuffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.1, this.ctx.sampleRate);
        const noiseData = noiseBuffer.getChannelData(0);
        
        // Smoother noise profile
        for (let i = 0; i < noiseData.length; i++) {
            const progress = i / noiseData.length;
            noiseData[i] = (Math.random() - 0.5) * 2 * (1 - progress * 0.8);
        }
        
        noise.buffer = noiseBuffer;
        
        const noiseFilter = this.ctx.createBiquadFilter();
        noiseFilter.type = 'lowpass'; // Lower frequency components for mallet strike
        noiseFilter.frequency.setValueAtTime(800, now);
        noiseFilter.Q.setValueAtTime(0.7, now);
        
        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(this.volume * 0.15, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        
        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(this.ctx.destination);
        
        noise.start(now);
    }
    
    // Wind/whisper sound for rotation
    playWindSound() {
        const now = this.ctx.currentTime;
        
        // Create white noise using buffer
        const bufferSize = this.ctx.sampleRate * 0.04; // 40ms of noise
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        
        // Fill with white noise
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        
        // Bandpass filter for "airy" sound (500-2000Hz)
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1250, now);
        filter.Q.setValueAtTime(0.5, now);
        
        // Quick fade in/out envelope
        const envelope = this.ctx.createGain();
        envelope.gain.setValueAtTime(0, now);
        envelope.gain.linearRampToValueAtTime(this.volume * 0.3, now + 0.005);
        envelope.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
        
        // Connect the chain
        noise.connect(filter);
        filter.connect(envelope);
        envelope.connect(this.ctx.destination);
        
        noise.start(now);
        noise.stop(now + 0.04);
    }
    
    // Simple bell sound for line clears
    playBellSound(lineCount) {
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        // Connect nodes
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        // Bell-like sine wave
        osc.type = 'sine';
        
        // Frequency increases slightly with more lines (higher pitch)
        const baseFreq = 350; // C#4 ~ 277Hz + a bit higher
        osc.frequency.setValueAtTime(baseFreq + (lineCount * 50), now);
        
        // Volume increases with more lines
        const baseVolume = this.volume * 0.25;
        const intensity = 0.25 * lineCount; // 0.25, 0.5, 0.75, 1.0 scaling
        
        // Bell envelope - quick attack, longer decay
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(baseVolume + intensity * this.volume, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5 + (lineCount * 0.1));
        
        osc.start(now);
        osc.stop(now + 0.6 + (lineCount * 0.1));
    }
    
    init() {
        if (this.initialized) return;
        
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.initialized = true;
        } catch (e) {
            console.warn('Audio not available');
        }
    }
    
    // Detect what changed and play appropriate sounds
    processStateChange(oldState, newState) {
        if (!this.initialized) return;
        
        // Piece locked
        if (oldState.current && !newState.current && newState.board !== oldState.board) {
            this.playSound('lock');
        }
        
        // Lines cleared
        if (newState.clearingLines.length > oldState.clearingLines.length) {
            const lineCount = newState.clearingLines.length;
            this.playBellSound(lineCount);
        }
        
        // Movement and actions from player input
        if (newState.lastMove && newState.lastMove !== oldState.lastMove) {
            const move = newState.lastMove;
            
            // Drop sound for any hit bottom event
            if (move.hitBottom) {
                this.playSound('drop');
            } else if (move.type === 'MOVE' && move.dx !== 0 && !move.hitWall) {
                this.playSound('move');
            } else if (move.type === 'ROTATE') {
                this.playSound('rotate');
            } else if (move.type === 'HARD_DROP') {
                this.playSound('drop');
            }
        }
        
        // Level progression
        if (newState.level > oldState.level) {
            this.playSound('levelup');
        }
        
        // Game over
        if (newState.phase === 'GAME_OVER' && oldState.phase !== 'GAME_OVER') {
            this.playSound('gameover');
        }
    }
    
    playSound(type) {
        if (!this.ctx) return;
        
        // Prevent sound spam (50ms cooldown)
        const now = Date.now();
        const last = this.lastPlayed.get(type) || 0;
        if (now - last < 50) return;
        
        this.lastPlayed.set(type, now);
        
        // Sound definitions
        const sounds = {
            move: () => this.playWindSound(),
            rotate: () => this.playWindSound(),
            drop: () => this.playTone(150, 0.1, 'sine', 100),
            lock: () => this.playTone(300, 0.05, 'square'),
            clear: () => this.playBellSound(1), // Single line
            quadclear: () => this.playBellSound(4), // Four lines
            levelup: () => this.playArpeggio([261, 330, 392, 523], 0.03),
            gameover: () => this.playGongSound()
        };
        
        sounds[type]?.();
    }
    
    // Generate a tone
    playTone(freq, duration, type = 'sine', endFreq = null) {
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc.type = type;
        osc.frequency.setValueAtTime(freq, now);
        
        // Frequency sweep if specified
        if (endFreq) {
            osc.frequency.exponentialRampToValueAtTime(endFreq, now + duration);
        }
        
        // Envelope
        gain.gain.setValueAtTime(this.volume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
        
        osc.start(now);
        osc.stop(now + duration + 0.1);
    }
    
    // Frequency sweep effect
    playSweep(startFreq, endFreq, duration) {
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(startFreq, now);
        osc.frequency.exponentialRampToValueAtTime(endFreq, now + duration);
        
        gain.gain.setValueAtTime(this.volume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
        
        osc.start(now);
        osc.stop(now + duration + 0.1);
    }
    
    // Musical sequence
    playArpeggio(notes, noteLength) {
        notes.forEach((freq, i) => {
            setTimeout(() => {
                this.playTone(freq, noteLength * 2, 'square');
            }, i * noteLength * 1000);
        });
    }
}