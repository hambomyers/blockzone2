/**
 * random.js - Deterministic random number generation
 * For replays and consistent piece generation
 */

// Linear congruential generator
export const createRNG = (seed) => {
    let state = seed;
    
    return {
        next: () => {
            state = (state * 1664525 + 1013904223) % 4294967296;
            return state / 4294967296;
        },
        seed: () => state
    };
};

// Choose random element from array
export const choice = (array, rng) => {
    const index = Math.floor(rng.next() * array.length);
    return array[index];
};

// Shuffle array (for bag randomizer)
export const shuffle = (array, rng) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(rng.next() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
};