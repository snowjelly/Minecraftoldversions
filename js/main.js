import * as THREE from 'three';
import { World } from './World.js';
import { Player } from './Player.js';
import { TextureManager } from './TextureManager.js';
import { VersionManager } from './VersionManager.js';


async function init(startVersion = 'rd-132211', shouldLoad = false) {
    console.log(`Initializing...`);
    
    const versionManager = new VersionManager();

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x7fcdfe);

    const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);

    const renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    document.body.appendChild(renderer.domElement);

    // Load Textures
    const textureManager = new TextureManager();
    await textureManager.load();

    // Init World
    const world = new World(scene, textureManager);

    // Init Player
    const player = new Player(scene, camera, renderer.domElement, world);

    // Connect Version Manager
    versionManager.addEventListener('versionChanged', (e) => {
        const settings = e.detail.settings;
        
        // Update World
        world.regenerate(settings.worldType);
        
        // Spawn Mobs if enabled
        if (settings.mobsEnabled) {
            world.spawnMobs(10);
        }

        // Update Player
        player.setSettings(settings);

        // Update Scene (Lighting)
        scene.background = new THREE.Color(0x7fcdfe);
    });

    // Apply initial version
    versionManager.applyVersion(startVersion);

    // Resize Handler
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // Prevent scrolling globally
    document.addEventListener('touchmove', (e) => {
        e.preventDefault();
    }, { passive: false });

    // --- Save/Load Logic ---
    const SAVE_KEY = 'rubydung_level_dat';
    
    const btnSave = document.getElementById('btn-save-level');
    const btnLoad = document.getElementById('btn-load-level');
    const btnReset = document.getElementById('btn-reset-level');
    const startScreen = document.getElementById('start-screen');

    // Enable Save button when running
    btnSave.classList.remove('disabled');

    const saveLevel = () => {
        const data = {
            version: versionManager.currentVersion,
            timestamp: Date.now(),
            player: {
                position: player.position.toArray(),
                rotation: { y: player.camera.rotation.y, x: player.camera.rotation.x } // Store camera rot
            },
            world: world.serialize()
        };
        try {
            const json = JSON.stringify(data);
            localStorage.setItem(SAVE_KEY, json);
            alert('Level Saved!');
        } catch (e) {
            console.error(e);
            alert('Failed to save level (Quota exceeded?)');
        }
    };

    const loadLevel = () => {
        const json = localStorage.getItem(SAVE_KEY);
        if (!json) {
            alert('No saved level found.');
            return;
        }
        try {
            const data = JSON.parse(json);
            
            // If we are in the menu and loading a different version, we might need to switch?
            // For now, just load the data into current world instance
            if (data.version && data.version !== versionManager.currentVersion) {
                console.log("Switching version to match save: " + data.version);
                versionManager.applyVersion(data.version);
            }

            // Restore World
            if (data.world) {
                world.deserialize(data.world);
            }

            // Restore Player
            if (data.player) {
                player.position.fromArray(data.player.position);
                player.velocity.set(0,0,0);
                if (data.player.rotation) {
                    // Set camera rotation
                    // Player class uses camera rotation for direction
                    player.camera.rotation.y = data.player.rotation.y;
                    player.camera.rotation.x = data.player.rotation.x;
                }
            }
            
            // Hide menu if visible
            startScreen.style.display = 'none';
            if (player.controls) player.controls.lock();

            console.log("Level Loaded!");

        } catch (e) {
            console.error(e);
            alert('Failed to load level.');
        }
    };

    const resetLevel = () => {
        if (confirm('Are you sure you want to delete your saved level?')) {
            localStorage.removeItem(SAVE_KEY);
            alert('Save file deleted.');
        }
    };

    // Attach listeners
    btnSave.onclick = saveLevel;
    btnLoad.onclick = loadLevel;
    btnReset.onclick = resetLevel;

    if (shouldLoad) {
        // Delay slightly to ensure world is ready
        setTimeout(loadLevel, 100);
    }

    // Pause / Menu Toggle
    document.addEventListener('keydown', (e) => {
        if (e.code === 'Escape') {
            if (startScreen.style.display === 'none') {
                startScreen.style.display = 'flex';
                if (player.controls) player.controls.unlock();
            } else {
                startScreen.style.display = 'none';
                if (player.controls) player.controls.lock();
            }
        }
    });

    // Also, if we just started, check if user wanted to load?
    // The user clicks "Start Version" -> init() -> game starts.
    // If user clicks "Load Level" in the menu (before init), we need to handle that.
    // But init() is called by the buttons in index.html.
    // We need to modify index.html to handle "Load Level" triggering init().

    const clock = new THREE.Clock();

    function animate() {
        requestAnimationFrame(animate);
        
        // Pause logic: if menu is open, don't update physics?
        if (startScreen.style.display !== 'none') {
            clock.getDelta(); // consume time
            return;
        }

        const dt = Math.min(clock.getDelta(), 0.1);

        player.update(dt);
        world.update(dt);

        renderer.render(scene, camera);
    }

    animate();
}

export { init as startGame };