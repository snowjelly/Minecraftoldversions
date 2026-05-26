import * as THREE from 'three';
import { Chunk } from './Chunk.js';
import { Human } from './Human.js';

export const WORLD_SIZE = 256;
export const WORLD_HEIGHT = 64;
export const CHUNK_SIZE = 16;

export const BLOCK = {
    AIR: 0,
    STONE: 1,
    GRASS: 2
};

export class World {
    constructor(scene, textureManager) {
        this.scene = scene;
        this.textureManager = textureManager;
        
        // Flat array for voxel data: x + z * WIDTH + y * WIDTH * DEPTH
        // But optimizing for vertical columns might be better for heightmap checks.
        // Let's stick to standard (x, y, z) tuple or flat index.
        // Index = x + z * WORLD_SIZE + y * WORLD_SIZE * WORLD_SIZE
        this.data = new Uint8Array(WORLD_SIZE * WORLD_HEIGHT * WORLD_SIZE);
        
        // Heightmap for lighting: stores the Y level of the highest NON-AIR block at (x, z)
        this.heightMap = new Int8Array(WORLD_SIZE * WORLD_SIZE);

        this.chunks = new Map(); // key: "x,z", value: Chunk instance
        this.mobs = [];

        this.generateTerrain();
        this.updateAllChunks();
    }

    getIndex(x, y, z) {
        return x + z * WORLD_SIZE + y * WORLD_SIZE * WORLD_SIZE;
    }

    generateTerrain(worldType = 'flat') {
        // Clear existing data
        this.data.fill(BLOCK.AIR);
        this.heightMap.fill(0);

        // Simple Seeded Random for consistency (Linear Congruential Generator)
        let seed = 12345;
        const random = () => {
            seed = (seed * 1664525 + 1013904223) % 4294967296;
            return seed / 4294967296;
        };

        for (let x = 0; x < WORLD_SIZE; x++) {
            for (let z = 0; z < WORLD_SIZE; z++) {
                let height = 43;

                if (worldType === 'hilly') {
                    // Simple sine wave terrain for "Cave Game" chaos
                    const scale = 0.05;
                    const h = Math.sin(x * scale) * Math.cos(z * scale) * 10 + 
                              Math.sin(x * scale * 3 + z * scale * 2) * 5;
                    height = 32 + Math.floor(h);
                }

                if (worldType === 'caves') {
                    height = 43; // Flat world base
                }

                // Fill column
                for (let y = 0; y <= height; y++) {
                    let block = BLOCK.STONE;
                    // Place grass on top for flat, rd132211, AND caves
                    if (y === height && (worldType === 'flat' || worldType === 'rd132211' || worldType === 'caves')) block = BLOCK.GRASS;
                    
                    this.data[this.getIndex(x, y, z)] = block;
                }
                
                this.heightMap[x + z * WORLD_SIZE] = height;
            }
        }

        if (worldType === 'caves') {
            this.carveCaves();
        }
    }

    carveCaves() {
        // MEGA CHAOS CAVES
        // We use a combination of massive worms and high frequency noise carving to create "99.9% more randomness"
        
        const numWorms = 100; 
        for (let i = 0; i < numWorms; i++) {
            let x = Math.random() * WORLD_SIZE;
            let y = Math.random() * 50; 
            let z = Math.random() * WORLD_SIZE;
            
            let dx = (Math.random() - 0.5);
            let dy = (Math.random() - 0.5);
            let dz = (Math.random() - 0.5);
            
            // Normalize
            let len = Math.sqrt(dx*dx + dy*dy + dz*dz);
            if (len === 0) len = 1;
            dx /= len; dy /= len; dz /= len;

            const length = Math.random() * 150 + 50;
            const radiusBase = Math.random() * 3 + 1.5;

            for (let j = 0; j < length; j++) {
                x += dx;
                y += dy;
                z += dz;
                
                // Bounce off X/Z bounds
                if (x < 0 || x >= WORLD_SIZE) dx = -dx;
                if (z < 0 || z >= WORLD_SIZE) dz = -dz;
                
                // Relaxed Y bounds to allow void holes
                if (y < -30) dy += 0.2; // Only steer back if deep in void
                if (y > 70) dy -= 0.2;

                // Massive perturbation for randomness
                dx += (Math.random() - 0.5) * 0.6;
                dy += (Math.random() - 0.5) * 0.6;
                dz += (Math.random() - 0.5) * 0.6;
                
                len = Math.sqrt(dx*dx + dy*dy + dz*dz);
                dx /= len; dy /= len; dz /= len;

                // Variable radius for organic/random shape
                const r = radiusBase * (1 + Math.sin(j * 0.1) * 0.5 + Math.random() * 0.5);
                const ir = Math.ceil(r);
                
                for (let cx = -ir; cx <= ir; cx++) {
                    for (let cy = -ir; cy <= ir; cy++) {
                        for (let cz = -ir; cz <= ir; cz++) {
                            if (cx*cx + cy*cy + cz*cz <= r*r) {
                                const wx = Math.floor(x + cx);
                                const wy = Math.floor(y + cy);
                                const wz = Math.floor(z + cz);
                                if (wx >= 0 && wx < WORLD_SIZE && wy >= 0 && wy < WORLD_HEIGHT && wz >= 0 && wz < WORLD_SIZE) {
                                    this.data[this.getIndex(wx, wy, wz)] = BLOCK.AIR;
                                }
                            }
                        }
                    }
                }
            }
        }
        
        // Swiss Cheese Pass for extra randomness and overhangs
        for (let x = 0; x < WORLD_SIZE; x+=2) {
            for (let z = 0; z < WORLD_SIZE; z+=2) {
                 for (let y = 0; y < 55; y+=2) {
                     // High frequency chaotic noise
                     const noise = Math.sin(x * 0.2 + y * 0.3) * Math.cos(z * 0.2 + y * 0.1) + Math.sin(x * 0.5 + z * 0.5);
                     // Threshold
                     if (noise > 1.3) {
                          const ir = Math.random() > 0.5 ? 2 : 1;
                          for (let cx = -ir; cx <= ir; cx++) {
                            for (let cy = -ir; cy <= ir; cy++) {
                                for (let cz = -ir; cz <= ir; cz++) {
                                    const wx = x + cx;
                                    const wy = y + cy;
                                    const wz = z + cz;
                                    if (wx >= 0 && wx < WORLD_SIZE && wy >= 0 && wy < WORLD_HEIGHT && wz >= 0 && wz < WORLD_SIZE) {
                                        this.data[this.getIndex(wx, wy, wz)] = BLOCK.AIR;
                                    }
                                }
                            }
                        }
                     }
                 }
            }
        }

        // Recompute heightmap
        for(let x=0; x<WORLD_SIZE; x++) {
            for(let z=0; z<WORLD_SIZE; z++) {
                this.updateHeightMap(x, z);
            }
        }
    }

    regenerate(worldType) {
        // Clear mobs
        this.clearMobs();
        
        this.generateTerrain(worldType);
        // Force rebuild of all chunks
        for (const chunk of this.chunks.values()) {
            chunk.dirty = true;
        }
    }

    clearMobs() {
        for (const mob of this.mobs) {
            mob.dispose();
        }
        this.mobs = [];
    }

    spawnMobs(count) {
        this.clearMobs();
        for (let i = 0; i < count; i++) {
            const x = Math.random() * WORLD_SIZE;
            const z = Math.random() * WORLD_SIZE;
            const human = new Human(this, x, z);
            this.mobs.push(human);
        }
    }

    getBlock(x, y, z) {
        if (x < 0 || x >= WORLD_SIZE || y < 0 || y >= WORLD_HEIGHT || z < 0 || z >= WORLD_SIZE) {
            return BLOCK.AIR;
        }
        return this.data[this.getIndex(x, y, z)];
    }

    setBlock(x, y, z, type) {
        if (x < 0 || x >= WORLD_SIZE || y < 0 || y >= WORLD_HEIGHT || z < 0 || z >= WORLD_SIZE) {
            return;
        }

        this.data[this.getIndex(x, y, z)] = type;
        this.updateHeightMap(x, z);
        this.updateChunkAt(x, z);
        
        // Update neighbor chunks if on border
        if (x % CHUNK_SIZE === 0) this.updateChunkAt(x - 1, z);
        if (x % CHUNK_SIZE === CHUNK_SIZE - 1) this.updateChunkAt(x + 1, z);
        if (z % CHUNK_SIZE === 0) this.updateChunkAt(x, z - 1);
        if (z % CHUNK_SIZE === CHUNK_SIZE - 1) this.updateChunkAt(x, z + 1);
    }

    updateHeightMap(x, z) {
        let y = WORLD_HEIGHT - 1;
        while (y >= 0) {
            if (this.data[this.getIndex(x, y, z)] !== BLOCK.AIR) {
                break;
            }
            y--;
        }
        this.heightMap[x + z * WORLD_SIZE] = y;
    }

    // Lighting: Returns true if the block at x,y,z receives direct sunlight
    // A block is lit if the block ABOVE it is exposed to sky.
    // So we check if y > heightMap of the column.
    // Note: This function checks if space (x,y,z) is in light.
    isExposed(x, y, z) {
        if (x < 0 || x >= WORLD_SIZE || z < 0 || z >= WORLD_SIZE) return true;
        if (y >= WORLD_HEIGHT) return true;
        
        const h = this.heightMap[x + z * WORLD_SIZE];
        return y > h;
    }

    updateChunkAt(x, z) {
        const cx = Math.floor(x / CHUNK_SIZE);
        const cz = Math.floor(z / CHUNK_SIZE);
        const key = `${cx},${cz}`;
        if (this.chunks.has(key)) {
            this.chunks.get(key).dirty = true;
        }
    }

    updateAllChunks() {
        const numChunks = WORLD_SIZE / CHUNK_SIZE;
        for (let cx = 0; cx < numChunks; cx++) {
            for (let cz = 0; cz < numChunks; cz++) {
                const chunk = new Chunk(this, cx, cz);
                this.chunks.set(`${cx},${cz}`, chunk);
                chunk.dirty = true;
            }
        }
    }

    update(dt) {
        // Rebuild dirty chunks
        for (const chunk of this.chunks.values()) {
            if (chunk.dirty) {
                chunk.build();
                chunk.dirty = false;
            }
        }

        // Update Mobs
        for (const mob of this.mobs) {
            mob.update(dt);
        }
    }

    // RLE Compression for Save/Load
    serialize() {
        const rle = [];
        let count = 0;
        let lastType = -1;

        // Iterate entire data array
        for (let i = 0; i < this.data.length; i++) {
            const type = this.data[i];
            if (type === lastType) {
                count++;
            } else {
                if (lastType !== -1) {
                    rle.push(count, lastType);
                }
                lastType = type;
                count = 1;
            }
        }
        // Push last
        if (lastType !== -1) {
            rle.push(count, lastType);
        }

        return rle;
    }

    deserialize(rle) {
        let offset = 0;
        for (let i = 0; i < rle.length; i += 2) {
            const count = rle[i];
            const type = rle[i+1];
            
            // Fill data
            for (let j = 0; j < count; j++) {
                if (offset < this.data.length) {
                    this.data[offset] = type;
                    offset++;
                }
            }
        }

        // Rebuild everything
        this.heightMap.fill(0);
        // Recompute heightmap
        for (let x = 0; x < WORLD_SIZE; x++) {
            for (let z = 0; z < WORLD_SIZE; z++) {
                this.updateHeightMap(x, z);
            }
        }
        
        // Mark all chunks dirty
        for (const chunk of this.chunks.values()) {
            chunk.dirty = true;
        }
    }
}