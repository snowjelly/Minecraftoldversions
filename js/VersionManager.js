import { BLOCK } from './World.js';

export class VersionManager extends EventTarget {
    constructor() {
        super();
        this.currentVersion = 'rd132211';
        
        // Default Settings
        this.settings = {
            worldType: 'flat',
            canInteract: true,
            jumpEnabled: true,
            hasParticles: false,
            mobsEnabled: false,
            blocksAvailable: [BLOCK.STONE, BLOCK.GRASS],
            uiStyle: 'none',
            lightingLevel: 'standard'
        };

        // Configuration Map
        this.configs = {
            'cave_game': {
                worldType: 'caves',
                canInteract: false,
                jumpEnabled: true,
                hasParticles: false,
                mobsEnabled: false,
                blocksAvailable: [BLOCK.STONE],
                uiStyle: 'none',
                lightingLevel: 'simple'
            },
            'rd132211': {
                worldType: 'flat',
                canInteract: true,
                jumpEnabled: true,
                hasParticles: false,
                mobsEnabled: false,
                blocksAvailable: [BLOCK.STONE, BLOCK.GRASS],
                uiStyle: 'none',
                lightingLevel: 'standard'
            },
            'rd132328': {
                worldType: 'flat',
                canInteract: true,
                jumpEnabled: true,
                hasParticles: false,
                mobsEnabled: true,
                blocksAvailable: [BLOCK.STONE, BLOCK.GRASS],
                uiStyle: 'none',
                lightingLevel: 'standard'
            },
            'rd20090515': {
                worldType: 'flat',
                canInteract: true,
                jumpEnabled: true,
                hasParticles: false,
                mobsEnabled: false,
                blocksAvailable: [BLOCK.STONE, BLOCK.GRASS],
                uiStyle: 'none',
                lightingLevel: 'standard'
            },
            'rd160052': {
                worldType: 'flat',
                canInteract: true,
                jumpEnabled: true,
                hasParticles: false,
                mobsEnabled: false,
                blocksAvailable: [BLOCK.STONE, BLOCK.GRASS],
                uiStyle: 'classicHUD',
                lightingLevel: 'standard'
            }
        };
    }

    applyVersion(versionName) {
        // Normalize input keys (e.g., from button IDs or text)
        let key = versionName;
        if (versionName === 'Cave Game Tech Test') key = 'cave_game';
        if (versionName === 'rd-132211') key = 'rd132211';
        if (versionName === 'rd-132328') key = 'rd132328';
        if (versionName === 'rd-20090515') key = 'rd20090515';
        if (versionName === 'rd-160052') key = 'rd160052';
        
        // Fallback for unknown versions
        const config = this.configs[key];

        if (!config) {
            console.warn(`VersionManager: Unknown version '${versionName}', defaulting to rd132211`);
            // Recursive call to default, but prevent infinite loop if default is broken
            if (key !== 'rd132211') this.applyVersion('rd132211');
            return;
        }

        this.currentVersion = key;
        
        // Update internal settings state
        Object.assign(this.settings, config);

        console.log(`[VersionManager] Applied: ${key}`, this.settings);

        // Notify system
        this.dispatchEvent(new CustomEvent('versionChanged', {
            detail: {
                version: key,
                settings: this.settings
            }
        }));
    }
}