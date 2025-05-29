/**
 * main.js - Game coordinator
 * 
 * Minimal coordination layer that:
 * - Creates game components
 * - Routes input to game engine
 * - Runs the game loop
 * - Manages audio state changes
 */

import { createInitialState } from './game-state.js';
import * as Engine from './game-engine.js';
import { Renderer } from './renderer.js';
import { InputController } from './input-controller.js';
import { AudioSystem } from './audio-system.js';
import { Starfield } from './starfield.js';

class NeonDrop {
    constructor(canvas, bgCanvas) {
        this.state = createInitialState();
        this.renderer = new Renderer(canvas);
        this.audio = new AudioSystem();
        this.starfield = new Starfield(bgCanvas);
        
        // State-aware input controller
        this.input = new InputController(
            this.handleAction.bind(this), 
            () => this.state
        );
        
        // Secret STAR key combination tracking
        this.starKeys = { s: false, t: false, a: false, r: false };
        this.starfieldToggled = false; // Prevent multiple toggles per key press
        this.setupStarfieldToggle();
        
        // Handle window resize for starfield
        this.setupWindowResize();
        
        this.lastTime = performance.now();
        this.accumulator = 0;
        this.tickRate = 1000 / 60; // 60 FPS fixed timestep
        
        // Ensure canvases are properly sized first
        this.setupCanvasSizes();
        
        // Initial render after everything is ready
        this.initialRender();
        
        this.loop();
    }
    
    setupCanvasSizes() {
        // Ensure renderer sets up its canvas first
        this.renderer.setupCanvas();
        
        // Starfield should be fullscreen, not match game canvas
        this.starfield.setupCanvas(window.innerWidth, window.innerHeight);
    }
    
    initialRender() {
        // Render starfield first if enabled
        if (this.starfield.enabled) {
            this.starfield.render();
        }
        
        // Then render game on top
        this.renderer.render(this.state, this.starfield.enabled);
    }
    
    setupWindowResize() {
        window.addEventListener('resize', () => {
            // Update starfield canvas to new window size
            this.starfield.setupCanvas(window.innerWidth, window.innerHeight);
            
            // Re-render if enabled
            if (this.starfield.enabled) {
                this.starfield.render();
            }
        });
    }
    
    setupStarfieldToggle() {
        document.addEventListener('keydown', (e) => {
            if (this.state.phase !== 'MENU') return;
            
            const key = e.key.toLowerCase();
            if (['s', 't', 'a', 'r'].includes(key)) {
                this.starKeys[key] = true;
                
                // Check if all STAR keys are held
                if (this.starKeys.s && this.starKeys.t && this.starKeys.a && this.starKeys.r) {
                    const enabled = this.starfield.toggle();
                    console.log(`Starfield ${enabled ? 'enabled' : 'disabled'} - you found the secret!`);
                    console.log('Canvas dimensions:', this.starfield.canvas.width, 'x', this.starfield.canvas.height);
                    console.log('Stars loaded:', this.starfield.stars.length);
                    
                    // Force immediate re-render
                    if (enabled) {
                        this.starfield.render();
                    }
                    this.renderer.render(this.state, this.starfield.enabled);
                }
            }
        });
        
        document.addEventListener('keyup', (e) => {
            const key = e.key.toLowerCase();
            if (['s', 't', 'a', 'r'].includes(key)) {
                this.starKeys[key] = false;
            }
        });
    }
    
    handleAction(action) {
        const oldState = this.state;
        
        switch (this.state.phase) {
            case 'MENU':
                if (action.type === 'SPACE' || action.type === 'ENTER') {
                    this.audio.init();
                    this.state = Engine.startGame(this.state);
                }
                break;
                
            case 'FALLING':
            case 'LOCKING':
                if (action.type === 'ESCAPE') {
                    this.state = { ...this.state, phase: 'PAUSED' };
                } else if (action.type === 'SPACE') {
                    this.state = Engine.handleInput(this.state, { type: 'HARD_DROP' });
                } else {
                    this.state = Engine.handleInput(this.state, action);
                }
                break;
                
            case 'PAUSED':
                if (action.type === 'ESCAPE' || action.type === 'SPACE' || action.type === 'ENTER') {
                    this.state = { ...this.state, phase: 'FALLING' };
                }
                break;
                
            case 'GAME_OVER':
                if (action.type === 'SPACE' || action.type === 'ENTER' || action.type === 'ESCAPE') {
                    this.state = createInitialState();
                }
                break;
        }
        
        // Process audio changes
        this.audio.processStateChange(oldState, this.state);
    }
    
    loop() {
        const now = performance.now();
        const deltaTime = now - this.lastTime;
        this.lastTime = now;
        
        // Fixed timestep with accumulation
        this.accumulator += deltaTime;
        
        // Prevent spiral of death
        this.accumulator = Math.min(this.accumulator, this.tickRate * 5);
        
        // Update game logic at fixed rate
        while (this.accumulator >= this.tickRate) {
            const oldState = this.state;
            this.state = Engine.tick(this.state, this.tickRate);
            this.audio.processStateChange(oldState, this.state);
            this.accumulator -= this.tickRate;
        }
        
        // Render starfield first if enabled
        if (this.starfield.enabled) {
            this.starfield.render();
        }
        
        // Render game on top
        this.renderer.render(this.state, this.starfield.enabled);
        
        requestAnimationFrame(() => this.loop());
    }
}

// Initialize game when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('game-canvas');
    const bgCanvas = document.getElementById('starfield-canvas');
    
    new NeonDrop(canvas, bgCanvas);
});