import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { WORLD_HEIGHT, BLOCK } from './World.js';

const MOVEMENT_SPEED = 4.5;
const TURN_SPEED = 5.0;

export class Human {
    constructor(world, x, z) {
        this.world = world;
        this.position = new THREE.Vector3(x, 0, z);
        this.velocity = new THREE.Vector3();
        this.rotation = Math.random() * Math.PI * 2;
        this.mesh = null;
        this.mixer = null;
        
        // Initial placement
        this.position.y = this.getGroundY(x, z);

        this.loadModel();
    }

    loadModel() {
        const loader = new GLTFLoader();
        loader.load('/steves-extra-script-for-implementing-player (1).glb', (gltf) => {
            this.mesh = gltf.scene;
            this.mesh.traverse((child) => {
                if (child.isMesh) {
                    // Fix lighting: Switch to MeshBasicMaterial to match the unlit world style
                    if (child.material) {
                        const oldMat = child.material;
                        child.material = new THREE.MeshBasicMaterial({
                            map: oldMat.map,
                            skinning: true, // Required for animation support
                            side: THREE.FrontSide
                        });
                    }
                }
            });

            // Scale and center
            // Correcting scale: 0.5 was too small, 1.0 roughly matches the 2-block height of a player
            this.mesh.scale.set(1, 1, 1);
            
            // Center the model pivot to feet if needed
            // Usually Mixamo/Blender models have pivot at feet.
            
            this.mesh.position.copy(this.position);
            this.world.scene.add(this.mesh);

            // Animations
            if (gltf.animations && gltf.animations.length > 0) {
                this.mixer = new THREE.AnimationMixer(this.mesh);
                
                // Try to find a walking animation
                let walkClip = gltf.animations.find(anim => anim.name.toLowerCase().includes('walk'));
                if (!walkClip) walkClip = gltf.animations.find(anim => anim.name.toLowerCase().includes('run'));
                // Fallback to index 0 if specific walk not found
                if (!walkClip) walkClip = gltf.animations[0];

                this.walkAction = this.mixer.clipAction(walkClip);
                this.walkAction.play();
            }
        });
    }

    getGroundY(x, z) {
        // Simple heightmap check
        // We can use World.getBlock but we have a heightmap helper in World
        // Note: World.js might need to expose heightmap or we check manually
        // Let's iterate down from max height
        const ix = Math.floor(x);
        const iz = Math.floor(z);
        
        for (let y = WORLD_HEIGHT - 1; y >= 0; y--) {
            if (this.world.getBlock(ix, y, iz) !== BLOCK.AIR) {
                return y + 1; // Top of block
            }
        }
        return 0; // Void
    }

    update(dt) {
        if (!this.mesh) return;

        // 1. Rotate Randomly
        // We'll just add a small random delta to rotation every frame
        // To make it less jittery, maybe change target direction periodically?
        // Prompt says "rotate randomly", let's interpret as constant chaotic turning like the original
        this.rotation += (Math.random() - 0.5) * TURN_SPEED * dt;
        
        // 2. Move Forward Constantly
        const dx = Math.sin(this.rotation) * MOVEMENT_SPEED * dt;
        const dz = Math.cos(this.rotation) * MOVEMENT_SPEED * dt;

        const nextX = this.position.x + dx;
        const nextZ = this.position.z + dz;

        // 3. Collision / Ground Check
        // Simple logic: if next position has ground at similar level, move there.
        // If wall, stop/turn (or just clip through like early versions? Early versions had collision)
        // Let's implement basic "climb 1 block" or "stop at wall"
        
        const groundY = this.getGroundY(nextX, nextZ);
        const currentY = this.position.y;

        // If drop is too large (> 3 blocks), maybe don't go? Or fall.
        // If step up is <= 1.1 block, go up.
        // If step up is > 1.1, it's a wall.
        
        const diff = groundY - currentY;
        let isMoving = false;

        if (diff > 1.1) {
            // Wall hit - effectively just rotate to avoid getting stuck forever?
            // Or just don't move X/Z
            this.rotation += Math.PI; // Turn around roughly
        } else {
            // Move
            this.position.x = nextX;
            this.position.z = nextZ;
            isMoving = true;
            
            // Gravity/Snap to ground
            // Smooth lerp for falling/jumping?
            // For this retro feel, snapping is fine, or simple gravity.
            if (diff < 0) {
                // Falling
                 this.position.y += Math.max(diff, -10 * dt); // Simple gravity cap
            } else {
                // Climbing / Flat
                this.position.y = groundY;
            }
        }
        
        // Update Mesh
        this.mesh.position.copy(this.position);
        this.mesh.rotation.y = this.rotation;

        // Update Animation
        if (this.mixer) {
            if (this.walkAction) {
                // Only animate if moving
                this.walkAction.paused = !isMoving;
            }
            this.mixer.update(dt);
        }
    }

    dispose() {
        if (this.mesh) {
            this.world.scene.remove(this.mesh);
            // Dispose geometry/materials if needed
        }
    }
}