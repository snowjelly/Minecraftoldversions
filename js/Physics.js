import { BLOCK } from './World.js';

export const PLAYER_WIDTH = 0.6;
export const PLAYER_HEIGHT = 1.7;

export class Physics {
    constructor(world) {
        this.world = world;
    }

    // AABB Collision Detection
    // Returns adjusted velocity or position
    resolveCollision(pos, vel) {
        // Decompose movement into axes to slide against walls
        this.resolveAxis(pos, vel, 'x');
        this.resolveAxis(pos, vel, 'z');
        this.resolveAxis(pos, vel, 'y');
    }

    resolveAxis(pos, vel, axis) {
        if (vel[axis] === 0) return;

        const nextPos = pos.clone();
        nextPos[axis] += vel[axis];

        // Player Bounding Box
        const minX = nextPos.x - PLAYER_WIDTH / 2;
        const maxX = nextPos.x + PLAYER_WIDTH / 2;
        const minY = nextPos.y; // Position is at feet
        const maxY = nextPos.y + PLAYER_HEIGHT;
        const minZ = nextPos.z - PLAYER_WIDTH / 2;
        const maxZ = nextPos.z + PLAYER_WIDTH / 2;

        // Check potential blocks overlapping
        const startX = Math.floor(minX);
        const endX = Math.floor(maxX);
        const startY = Math.floor(minY);
        const endY = Math.floor(maxY);
        const startZ = Math.floor(minZ);
        const endZ = Math.floor(maxZ);

        let collision = false;

        for (let y = startY; y <= endY; y++) {
            for (let z = startZ; z <= endZ; z++) {
                for (let x = startX; x <= endX; x++) {
                    const block = this.world.getBlock(x, y, z);
                    if (block !== BLOCK.AIR) {
                        collision = true;
                        // Simple resolution: stop velocity
                        // For more robustness, we'd snap to surface, but stopping is fine for basic physics
                    }
                }
            }
        }

        if (collision) {
            vel[axis] = 0;
            // Note: In a robust engine, we'd snap 'pos' to the block face.
            // Here, we just don't apply the velocity to 'pos' in the integration step if we hit something?
            // Wait, this method updates 'pos' potentially? 
            // Better: If collision, velocity becomes 0. Position doesn't update for this axis.
        } else {
            pos[axis] += vel[axis];
        }
    }
}