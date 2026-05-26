import * as THREE from 'three';

export class TextureManager {
    constructor() {
        this.atlasTexture = null;
        this.material = null;
    }

    async load() {
        const loader = new THREE.TextureLoader();
        
        // Load the provided assets
        const [grassImg, stoneImg, dirtImg, grassSideImg] = await Promise.all([
            this.loadImage('/top.jpg'),
            this.loadImage('/cobblestone.png'),
            this.loadImage('/dirt.png'),
            this.loadImage('/Mordern grass side.webp')
        ]);

        // Create a canvas for the atlas (4 blocks wide, 1 block high)
        // Order: GrassTop (0), Stone (1), Dirt (2), GrassSide (3)
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 16;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;

        // Draw Images
        ctx.drawImage(grassImg, 0, 0, 16, 16);      // 0
        ctx.drawImage(stoneImg, 16, 0, 16, 16);     // 1
        ctx.drawImage(dirtImg, 32, 0, 16, 16);      // 2
        ctx.drawImage(grassSideImg, 48, 0, 16, 16); // 3

        this.atlasTexture = new THREE.CanvasTexture(canvas);
        this.atlasTexture.magFilter = THREE.NearestFilter;
        this.atlasTexture.minFilter = THREE.NearestFilter;
        this.atlasTexture.wrapS = THREE.ClampToEdgeWrapping;
        this.atlasTexture.wrapT = THREE.ClampToEdgeWrapping;
        this.atlasTexture.colorSpace = THREE.SRGBColorSpace;

        this.material = new THREE.MeshBasicMaterial({
            map: this.atlasTexture,
            vertexColors: true
        });
    }

    loadImage(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = url;
        });
    }

    // Returns UV coordinates [u1, v1, u2, v2]
    getUVs(blockType, face) {
        // Atlas Indices:
        // 0: Grass Top
        // 1: Stone
        // 2: Dirt
        // 3: Grass Side

        let index = 1; // Default Stone

        if (blockType === 1) { // Stone
            index = 1;
        } else if (blockType === 2) { // Grass Block
            index = 0;
        }

        const step = 1.0 / 4.0; // 4 slots
        const u = index * step;
        
        // Inset UVs slightly to prevent texture bleeding
        const offset = 0.001;
        
        return [u + offset, 0 + offset, u + step - offset, 1 - offset];
    }
}