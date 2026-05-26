import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import nipplejs from 'nipplejs';
import { BLOCK } from './World.js';
import { Physics, PLAYER_HEIGHT } from './Physics.js';

const MOVEMENT_SPEED = 4.3; // Approx Minecraft speed
const JUMP_FORCE = 8.0; // Approx jump
const GRAVITY = 20.0; 

export class Player {
    constructor(scene, camera, domElement, world) {
        this.camera = camera;
        this.world = world;
        this.physics = new Physics(world);
        
        this.isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

        this.controls = new PointerLockControls(camera, domElement);
        this.position = new THREE.Vector3(128, 50, 128);
        this.velocity = new THREE.Vector3();
        
        this.camera.rotation.order = 'YXZ';
        this.camera.position.copy(this.position);
        this.camera.position.y += PLAYER_HEIGHT * 0.9; // Eyes level

        this.input = {
            forward: false,
            backward: false,
            left: false,
            right: false,
            jump: false,
            respawn: false,
            moveVector: new THREE.Vector2() // For joystick
        };

        this.interactionMode = 'break'; // 'break' or 'place'
        this.settings = {
            canInteract: true,
            jumpEnabled: true
        };

        this.raycaster = new THREE.Raycaster();
        this.raycaster.far = 5; // Reach distance

        // Selection Box (Face highlight) - Pulsing
        this.selectionMesh = new THREE.Mesh(
            new THREE.PlaneGeometry(1, 1),
            new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4, side: THREE.DoubleSide })
        );
        this.selectionMesh.visible = false;
        scene.add(this.selectionMesh);

        // Ghost Block (Placement highlight) - Full block
        this.ghostMesh = new THREE.Mesh(
            new THREE.BoxGeometry(1.01, 1.01, 1.01),
            new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.2, wireframe: false })
        );
        this.ghostMesh.visible = false;
        scene.add(this.ghostMesh);

        this.setupInputs();
        
        // Target block info
        this.targetBlock = null; // { x, y, z, faceNormal }
    }

    setSettings(settings) {
        this.settings = settings;
        this.updateUIVisibility();
    }

    updateUIVisibility() {
        const btnSwitch = document.getElementById('btn-switch');
        const btnUse = document.getElementById('btn-use');
        
        if (btnSwitch && btnUse) {
            const display = this.settings.canInteract ? '' : 'none';
            btnSwitch.style.display = display;
            btnUse.style.display = display;
        }
    }

    setupInputs() {
        // Desktop Inputs
        document.addEventListener('keydown', (e) => this.onKey(e, true));
        document.addEventListener('keyup', (e) => this.onKey(e, false));
        document.addEventListener('mousedown', (e) => this.onMouse(e));
        
        if (!this.isMobile) {
            // Lock pointer on click only on desktop
            document.body.addEventListener('click', () => {
                if(!this.controls.isLocked) this.controls.lock();
            });
        } else {
            this.setupMobileControls();
        }
    }

    setupMobileControls() {
        const ui = document.getElementById('mobile-ui');
        ui.style.display = 'block';

        // Joystick
        const joystickZone = document.getElementById('joystick-zone');
        this.joystick = nipplejs.create({
            zone: joystickZone,
            mode: 'static',
            position: { left: '50%', top: '50%' },
            color: 'white'
        });

        this.joystick.on('move', (evt, data) => {
            if (data.vector) {
                // NippleJS returns vector {x, y} normalized
                // y is up/down in screen space. Forward in 3D is -Z.
                // Up on stick (y>0) -> Forward (-z)
                // Right on stick (x>0) -> Right (+x)
                this.input.moveVector.set(data.vector.x, data.vector.y);
            }
        });

        this.joystick.on('end', () => {
            this.input.moveVector.set(0, 0);
        });

        // Touch swipe for camera rotation
        let lastTouchX = 0;
        let lastTouchY = 0;
        document.addEventListener('touchstart', (e) => {
            // Ignore if touching controls
            if (e.target.closest('.control-btn') || e.target.closest('#joystick-zone')) return;
            lastTouchX = e.touches[0].pageX;
            lastTouchY = e.touches[0].pageY;
        }, { passive: false });

        document.addEventListener('touchmove', (e) => {
             // Ignore if touching controls
             if (e.target.closest('.control-btn') || e.target.closest('#joystick-zone')) return;
             
             const touchX = e.touches[0].pageX;
             const touchY = e.touches[0].pageY;
             
             const dx = touchX - lastTouchX;
             const dy = touchY - lastTouchY;
             
             const sensitivity = 0.005;
             
             // Use Euler for FPS camera rotation (YXZ order)
             const euler = new THREE.Euler(0, 0, 0, 'YXZ');
             euler.setFromQuaternion(this.camera.quaternion);
             
             euler.y -= dx * sensitivity;
             euler.x -= dy * sensitivity;
             
             // Clamp vertical (Pitch) to avoid gimbal lock
             const PI_2 = Math.PI / 2;
             euler.x = Math.max(-PI_2 + 0.001, Math.min(PI_2 - 0.001, euler.x));
             
             // Force zero roll
             euler.z = 0;
             
             this.camera.quaternion.setFromEuler(euler);

             lastTouchX = touchX;
             lastTouchY = touchY;
        }, { passive: false });

        // Buttons
        const bindBtn = (id, actionKey) => {
            const btn = document.getElementById(id);
            if (!btn) return;
            
            // For continuous actions (Jump, R)
            btn.addEventListener('touchstart', (e) => { e.preventDefault(); this.input[actionKey] = true; });
            btn.addEventListener('touchend', (e) => { e.preventDefault(); this.input[actionKey] = false; });
        };

        bindBtn('btn-jump', 'jump');
        bindBtn('btn-respawn', 'respawn');

        // UI Elements
        const btnSwitch = document.getElementById('btn-switch');
        const btnUse = document.getElementById('btn-use');

        const updateUI = () => {
            if (btnUse) {
                btnUse.textContent = this.interactionMode.toUpperCase();
                btnUse.style.backgroundColor = this.interactionMode === 'place' 
                    ? 'rgba(0, 255, 0, 0.4)' 
                    : 'rgba(255, 0, 0, 0.4)';
            }
        };
        updateUI();

        // Switch Logic
        if(btnSwitch) {
            btnSwitch.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.interactionMode = this.interactionMode === 'break' ? 'place' : 'break';
                updateUI();
            });
        }

        // Use Logic (with repeat)
        if(btnUse) {
            let actionInterval = null;
            
            const startAction = () => {
                this.performAction(this.interactionMode);
                if (actionInterval) clearInterval(actionInterval);
                actionInterval = setInterval(() => {
                    this.performAction(this.interactionMode);
                }, 250);
            };

            const stopAction = () => {
                if (actionInterval) {
                    clearInterval(actionInterval);
                    actionInterval = null;
                }
            };

            btnUse.addEventListener('touchstart', (e) => { 
                e.preventDefault(); 
                startAction(); 
            });
            
            btnUse.addEventListener('touchend', (e) => {
                e.preventDefault();
                stopAction();
            });

            btnUse.addEventListener('touchcancel', (e) => {
                stopAction();
            });
        }
    }

    onKey(e, pressed) {
        switch(e.code) {
            case 'KeyW': this.input.forward = pressed; break;
            case 'KeyS': this.input.backward = pressed; break;
            case 'KeyA': this.input.left = pressed; break;
            case 'KeyD': this.input.right = pressed; break;
            case 'Space': 
                if (this.settings.jumpEnabled) this.input.jump = pressed; 
                break;
            case 'KeyR': this.input.respawn = pressed; break;
        }
    }

    onMouse(e) {
        if (!this.controls.isLocked && !this.isMobile) return;
        
        // On desktop, clicks handle place/break
        if (!this.isMobile) {
            if (e.button === 0) this.performAction('place');
            if (e.button === 2) this.performAction('break');
        }
    }

    performAction(action) {
        if (!this.settings.canInteract) return;
        if (!this.targetBlock) return;
        const { x, y, z, face } = this.targetBlock;

        if (action === 'place') {
            const px = x + face.x;
            const py = y + face.y;
            const pz = z + face.z;

            // Context-sensitive placement:
            // If the new block is at level 43 (grass layer), place Grass.
            // If the new block is above level 43, place Stone.
            // Default to Stone for other cases (below 43).
            let blockToPlace = BLOCK.STONE;
            if (py === 43) {
                blockToPlace = BLOCK.GRASS;
            }

            this.world.setBlock(px, py, pz, blockToPlace);
        } else if (action === 'break') {
            this.world.setBlock(x, y, z, BLOCK.AIR);
        }
    }

    update(dt) {
        if (this.input.respawn) {
            // "While holding 'R', respawn at random X/Z at Y=74 every single frame."
            this.position.set(
                Math.random() * 256,
                74,
                Math.random() * 256
            );
            this.velocity.set(0, 0, 0);
            this.camera.position.copy(this.position);
            return;
        }

        // Void Check
        if (this.position.y < 0) {
            // Infinite fall, do nothing (physics will keep accelerating)
        }

        // Movement Input (Relative to look direction)
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
        forward.y = 0;
        forward.normalize();
        
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
        right.y = 0;
        right.normalize();

        const moveDir = new THREE.Vector3();
        
        // Keyboard
        if (this.input.forward) moveDir.add(forward);
        if (this.input.backward) moveDir.sub(forward);
        if (this.input.right) moveDir.add(right);
        if (this.input.left) moveDir.sub(right);
        
        // Joystick
        if (this.isMobile && (this.input.moveVector.x !== 0 || this.input.moveVector.y !== 0)) {
            // moveVector.y is forward (up on screen), .x is right
            // Add forward component
            moveDir.add(forward.clone().multiplyScalar(this.input.moveVector.y));
            // Add right component
            moveDir.add(right.clone().multiplyScalar(this.input.moveVector.x));
        }

        if (moveDir.length() > 1) moveDir.normalize();

        // Apply Speed
        this.velocity.x = moveDir.x * MOVEMENT_SPEED * dt;
        this.velocity.z = moveDir.z * MOVEMENT_SPEED * dt;

        // Gravity
        this.velocity.y -= GRAVITY * dt;

        // Jumping
        if (this.input.jump && this.onGround && this.settings.jumpEnabled) {
            this.velocity.y = JUMP_FORCE;
            this.onGround = false;
        }

        // Apply Physics (AABB)
        // We separate Axes in Physics class, but here we integrate manually slightly
        // Let's pass the position and velocity to Physics to update position directly?
        // Physics.resolveCollision modifies position and velocity objects.
        
        // Save old position to check grounding
        const preY = this.position.y;
        
        // We apply velocity to position inside physics for correct sliding
        // Wait, simpler integration:
        // X/Z movement first
        let dx = this.velocity.x;
        let dz = this.velocity.z;
        let dy = this.velocity.y * dt;

        // Create a temp velocity vector for the step
        let stepVel = new THREE.Vector3(dx, dy, dz);
        
        // PHYSICS RESOLUTION
        // We iterate small steps or just once? A simple discrete check is usually enough for this scale
        // But we need to handle "onGround".
        
        this.physics.resolveCollision(this.position, stepVel);
        
        // Update velocity based on what happened (if we hit a wall, velocity became 0)
        // Re-extract velocity from the step taken (approx) is tricky.
        // Better: physics updates position and zeroes velocity components on hit.
        
        // Check if we hit ground
        if (this.position.y === preY && this.velocity.y < 0) {
            this.onGround = true;
            this.velocity.y = 0;
        } else {
            this.onGround = false;
        }
        
        // Sync Camera
        this.camera.position.copy(this.position);
        this.camera.position.y += 1.62; // Eye height

        this.updateInteraction();
    }

    updateInteraction() {
        // Raycast from camera center
        this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
        
        const intersects = this.raycaster.intersectObjects(Array.from(this.world.chunks.values()).map(c => c.mesh).filter(m => m));
        
        if (intersects.length > 0) {
            const hit = intersects[0];
            const p = hit.point;
            const n = hit.face.normal;
            
            // Correction for precision issues on block boundaries
            const target = p.clone().add(n.clone().multiplyScalar(-0.01));
            const x = Math.floor(target.x);
            const y = Math.floor(target.y);
            const z = Math.floor(target.z);

            this.targetBlock = { x, y, z, face: n };
            
            // Pulsing opacity (Looping)
            const time = performance.now() / 200;
            const pulse = (Math.sin(time) + 1) / 2; // 0 to 1

            if (this.interactionMode === 'break') {
                // Breaking Mode: Show Pulsing Face, Hide Ghost Box
                this.ghostMesh.visible = false;

                this.selectionMesh.visible = true;
                this.selectionMesh.position.set(x + 0.5, y + 0.5, z + 0.5).add(n.clone().multiplyScalar(0.505));
                this.selectionMesh.lookAt(this.selectionMesh.position.clone().add(n));
                
                this.selectionMesh.material.opacity = pulse * 0.5;
            } else {
                // Placing Mode: Show Ghost Box, Hide Pulsing Face
                this.selectionMesh.visible = false;

                const px = x + n.x;
                const py = y + n.y;
                const pz = z + n.z;
                
                this.ghostMesh.visible = true;
                this.ghostMesh.position.set(px + 0.5, py + 0.5, pz + 0.5);
                this.ghostMesh.material.opacity = pulse * 0.5;
            }

        } else {
            this.targetBlock = null;
            this.selectionMesh.visible = false;
            this.ghostMesh.visible = false;
        }
    }
}