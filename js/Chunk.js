import * as THREE from 'three';
import { CHUNK_SIZE, WORLD_HEIGHT, BLOCK } from './World.js';

export class Chunk {
    constructor(world, cx, cz) {
        this.world = world;
        this.cx = cx;
        this.cz = cz;
        this.mesh = null;
        this.dirty = false;
    }

    build() {
        if (this.mesh) {
            this.world.scene.remove(this.mesh);
            this.mesh.geometry.dispose();
            this.mesh = null;
        }

        const positions = [];
        const uvs = [];
        const colors = [];
        
        const startX = this.cx * CHUNK_SIZE;
        const startZ = this.cz * CHUNK_SIZE;

        for (let x = 0; x < CHUNK_SIZE; x++) {
            for (let z = 0; z < CHUNK_SIZE; z++) {
                const wx = startX + x;
                const wz = startZ + z;

                for (let y = 0; y < WORLD_HEIGHT; y++) {
                    const type = this.world.getBlock(wx, y, wz);
                    if (type === BLOCK.AIR) continue;

                    // Check neighbors to cull faces
                    // Top (Y+)
                    if (this.world.getBlock(wx, y + 1, wz) === BLOCK.AIR) {
                        this.addFace(positions, uvs, colors, wx, y, wz, 'top', this.world.textureManager.getUVs(type, 'top'));
                    }
                    // Bottom (Y-)
                    if (this.world.getBlock(wx, y - 1, wz) === BLOCK.AIR) {
                        this.addFace(positions, uvs, colors, wx, y, wz, 'bottom', this.world.textureManager.getUVs(type, 'bottom'));
                    }
                    // Right (X+)
                    if (this.world.getBlock(wx + 1, y, wz) === BLOCK.AIR) {
                        this.addFace(positions, uvs, colors, wx, y, wz, 'right', this.world.textureManager.getUVs(type, 'right'));
                    }
                    // Left (X-)
                    if (this.world.getBlock(wx - 1, y, wz) === BLOCK.AIR) {
                        this.addFace(positions, uvs, colors, wx, y, wz, 'left', this.world.textureManager.getUVs(type, 'left'));
                    }
                    // Front (Z+)
                    if (this.world.getBlock(wx, y, wz + 1) === BLOCK.AIR) {
                        this.addFace(positions, uvs, colors, wx, y, wz, 'front', this.world.textureManager.getUVs(type, 'front'));
                    }
                    // Back (Z-)
                    if (this.world.getBlock(wx, y, wz - 1) === BLOCK.AIR) {
                        this.addFace(positions, uvs, colors, wx, y, wz, 'back', this.world.textureManager.getUVs(type, 'back'));
                    }
                }
            }
        }

        if (positions.length === 0) return;

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

        this.mesh = new THREE.Mesh(geometry, this.world.textureManager.material);
        this.world.scene.add(this.mesh);
    }

    addFace(positions, uvs, colors, x, y, z, dir, uvRange) {
        // uvRange: [uMin, vMin, uMax, vMax]
        
        const uMin = uvRange[0];
        const vMin = uvRange[1];
        const uMax = uvRange[2];
        const vMax = uvRange[3];

        let lighting = 1.0;
        
        // Accurate Face Shading
        if (dir === 'top') lighting = 1.0;
        else if (dir === 'bottom') lighting = 0.5;
        else if (dir === 'front' || dir === 'back') lighting = 0.8;
        else lighting = 0.6; // Left/Right

        // Shadowing Logic
        let nx = x, ny = y, nz = z;
        if (dir === 'top') ny++;
        else if (dir === 'bottom') ny--;
        else if (dir === 'front') nz++;
        else if (dir === 'back') nz--;
        else if (dir === 'right') nx++;
        else if (dir === 'left') nx--;

        // Check if the adjacent block space is exposed to the sky
        if (!this.world.isExposed(nx, ny, nz)) {
            lighting *= 0.6;
        }

        const r = lighting, g = lighting, b = lighting;

        // Push Vertices and UVs
        // Standard Unit Cube logic
        // Y is up.
        
        if (dir === 'top') {
            positions.push(
                x, y+1, z+1,  x+1, y+1, z+1,  x, y+1, z,
                x+1, y+1, z+1,  x+1, y+1, z,  x, y+1, z
            );
            uvs.push(
                uMin, vMin, uMax, vMin, uMin, vMax,
                uMax, vMin, uMax, vMax, uMin, vMax
            );
        } else if (dir === 'bottom') {
            positions.push(
                x, y, z,  x+1, y, z,  x, y, z+1,
                x+1, y, z,  x+1, y, z+1,  x, y, z+1
            );
            uvs.push(
                uMin, vMax, uMax, vMax, uMin, vMin,
                uMax, vMax, uMax, vMin, uMin, vMin
            );
        } else if (dir === 'front') { // Z+
            positions.push(
                x, y, z+1,  x+1, y, z+1,  x, y+1, z+1,
                x+1, y, z+1,  x+1, y+1, z+1,  x, y+1, z+1
            );
            uvs.push(
                uMin, vMin, uMax, vMin, uMin, vMax,
                uMax, vMin, uMax, vMax, uMin, vMax
            );
        } else if (dir === 'back') { // Z-
            positions.push(
                x+1, y, z,  x, y, z,  x, y+1, z,
                x+1, y, z,  x, y+1, z,  x+1, y+1, z
            );
            uvs.push(
                uMin, vMin, uMax, vMin, uMax, vMax,
                uMin, vMin, uMax, vMax, uMin, vMax
            );
        } else if (dir === 'right') { // X+
            positions.push(
                x+1, y, z+1,  x+1, y, z,  x+1, y+1, z+1,
                x+1, y, z,  x+1, y+1, z,  x+1, y+1, z+1
            );
            uvs.push(
                uMin, vMin, uMax, vMin, uMin, vMax,
                uMax, vMin, uMax, vMax, uMin, vMax
            );
        } else if (dir === 'left') { // X-
            positions.push(
                x, y, z,  x, y, z+1,  x, y+1, z,
                x, y, z+1,  x, y+1, z+1,  x, y+1, z
            );
            uvs.push(
                uMin, vMin, uMax, vMin, uMin, vMax,
                uMax, vMin, uMax, vMax, uMin, vMax
            );
        }

        // Push colors (6 vertices per face)
        for (let i = 0; i < 6; i++) {
            colors.push(r, g, b);
        }
    }
}