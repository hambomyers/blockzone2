/**
 * physics-pure.js - Pure physics with ONE source of truth for collisions
 * REWRITTEN: Single collision detection function used everywhere
 */

// Simple board hash for cache invalidation
const hashBoardSimple = (board) => {
    let hash = 0;
    for (let y = 0; y < board.length; y++) {
        for (let x = 0; x < board[y].length; x++) {
            if (board[y][x]) {
                hash = ((hash << 5) - hash) + (y * 10 + x);
                hash = hash & hash;
            }
        }
    }
    return hash;
};

// THE ONLY COLLISION FUNCTION - everything uses this
export const canPieceFitAt = (board, piece, x, y) => {
    return piece.shape.every((row, dy) =>
        row.every((cell, dx) => {
            if (!cell) return true; // Empty cell in shape
            
            const boardX = x + dx;
            const boardY = y + dy;
            
            // Out of bounds horizontally
            if (boardX < 0 || boardX >= 10) return false;
            
            // Above board is OK
            if (boardY < 0) return true;
            
            // Below board is not OK
            if (boardY >= 20) return false;
            
            // Check board collision
            return board[boardY][boardX] === null;
        })
    );
};

// Calculate where a piece would land if dropped
export const calculateShadow = (board, piece) => {
    let shadowY = piece.gridY;
    
    // Keep going down until we can't
    while (shadowY < 20 && canPieceFitAt(board, piece, piece.gridX, shadowY + 1)) {
        shadowY++;
    }
    
    return shadowY;
};

// Check if piece is at its shadow position
export const isResting = (board, piece) => {
    return piece.gridY === calculateShadow(board, piece);
};

// Rotate piece shape
export const rotatePiece = (piece, direction) => {
    const n = piece.shape.length;
    const rotated = Array(n).fill().map(() => Array(n).fill(0));
    
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            if (direction === 1) {
                rotated[i][j] = piece.shape[n - 1 - j][i];
            } else {
                rotated[i][j] = piece.shape[j][n - 1 - i];
            }
        }
    }
    
    return {
        ...piece,
        shape: rotated,
        rotation: (piece.rotation + direction + 4) % 4
    };
};

// Try rotation with wall kicks
export const tryRotation = (board, piece, direction) => {
    const rotated = rotatePiece(piece, direction);
    
    // Try base rotation first
    if (canPieceFitAt(board, rotated, rotated.gridX, rotated.gridY)) {
        return { success: true, piece: rotated };
    }
    
    // O piece doesn't wall kick
    if (piece.type === 'O') {
        return { success: false };
    }
    
    const kicks = getWallKicks(piece, direction);
    
    // Try each wall kick
    for (const kick of kicks) {
        const kickX = rotated.gridX + kick.x;
        const kickY = rotated.gridY + kick.y;
        
        if (canPieceFitAt(board, rotated, kickX, kickY)) {
            return { 
                success: true, 
                piece: { ...rotated, gridX: kickX, gridY: kickY }
            };
        }
    }
    
    return { success: false };
};

// Get wall kicks for SRS
export const getWallKicks = (piece, direction) => {
    const kicks = {
        'I': {
            '0->1': [{x:-2,y:0}, {x:1,y:0}, {x:-2,y:-1}, {x:1,y:2}],
            '1->0': [{x:2,y:0}, {x:-1,y:0}, {x:2,y:1}, {x:-1,y:-2}],
            '1->2': [{x:-1,y:0}, {x:2,y:0}, {x:-1,y:2}, {x:2,y:-1}],
            '2->1': [{x:1,y:0}, {x:-2,y:0}, {x:1,y:-2}, {x:-2,y:1}],
            '2->3': [{x:2,y:0}, {x:-1,y:0}, {x:2,y:1}, {x:-1,y:-2}],
            '3->2': [{x:-2,y:0}, {x:1,y:0}, {x:-2,y:-1}, {x:1,y:2}],
            '3->0': [{x:1,y:0}, {x:-2,y:0}, {x:1,y:-2}, {x:-2,y:1}],
            '0->3': [{x:-1,y:0}, {x:2,y:0}, {x:-1,y:2}, {x:2,y:-1}]
        },
        'default': {
            '0->1': [{x:-1,y:0}, {x:-1,y:1}, {x:0,y:-2}, {x:-1,y:-2}],
            '1->0': [{x:1,y:0}, {x:1,y:-1}, {x:0,y:2}, {x:1,y:2}],
            '1->2': [{x:1,y:0}, {x:1,y:-1}, {x:0,y:2}, {x:1,y:2}],
            '2->1': [{x:-1,y:0}, {x:-1,y:1}, {x:0,y:-2}, {x:-1,y:-2}],
            '2->3': [{x:1,y:0}, {x:1,y:1}, {x:0,y:-2}, {x:1,y:-2}],
            '3->2': [{x:-1,y:0}, {x:-1,y:-1}, {x:0,y:2}, {x:-1,y:2}],
            '3->0': [{x:-1,y:0}, {x:-1,y:-1}, {x:0,y:2}, {x:-1,y:2}],
            '0->3': [{x:1,y:0}, {x:1,y:1}, {x:0,y:-2}, {x:1,y:-2}]
        }
    };
    
    const fromRot = piece.rotation;
    const toRot = (piece.rotation + direction + 4) % 4;
    const key = `${fromRot}->${toRot}`;
    
    if (piece.type === 'I') {
        return kicks.I[key] || [];
    }
    
    return kicks.default[key] || [];
};

// Place piece on board
export const placePiece = (board, piece) => {
    const newBoard = board.map(row => [...row]);
    
    piece.shape.forEach((row, dy) => {
        row.forEach((cell, dx) => {
            if (cell) {
                const x = piece.gridX + dx;
                const y = piece.gridY + dy;
                if (y >= 0 && y < 20 && x >= 0 && x < 10) {
                    newBoard[y][x] = piece.color;
                }
            }
        });
    });
    
    return newBoard;
};

// Find cleared lines
export const findClearedLines = (board) => {
    return board.reduce((cleared, row, index) => {
        if (row.every(cell => cell !== null)) {
            cleared.push(index);
        }
        return cleared;
    }, []);
};

// Remove cleared lines
export const removeClearedLines = (board, lines) => {
    const newBoard = board.filter((row, index) => !lines.includes(index));
    
    while (newBoard.length < 20) {
        newBoard.unshift(Array(10).fill(null));
    }
    
    return newBoard;
};

// Check if spawn is valid
export const canSpawn = (board, piece) => {
    return canPieceFitAt(board, piece, piece.gridX, piece.gridY);
};