const fs = require('fs');
const path = require('path');

describe('shop, inventory, and field-kit interconnection', () => {
    const inventorySource = fs.readFileSync(
        path.join(__dirname, '../scenes/InventoryScene.js'),
        'utf8'
    );
    const shopSource = fs.readFileSync(
        path.join(__dirname, '../scenes/ShopScene.js'),
        'utf8'
    );
    const gameSource = fs.readFileSync(
        path.join(__dirname, '../scenes/GameScene.js'),
        'utf8'
    );
    const levelSource = fs.readFileSync(
        path.join(__dirname, '../scenes/PlatformerLevelScene.js'),
        'utf8'
    );
    const artifactSource = fs.readFileSync(
        path.join(__dirname, '../ui/KatanaArtifactModal.js'),
        'utf8'
    );

    test('preserves canonical inventory slots after filtering and sorting', () => {
        expect(inventorySource).toContain('slot.inventoryIndex =');
        expect(inventorySource).toContain('this.selectedDisplaySlot');
        expect(inventorySource).toContain(
            'const inventoryIndex = slot?.inventoryIndex;'
        );
        expect(inventorySource).toContain(
            'window.InventoryManager?.getItem(inventoryIndex)'
        );
    });

    test('uses real Phaser visibility for item actions instead of a dead flag', () => {
        expect(inventorySource).toContain('setActionButtonVisible(control, visible)');
        expect(inventorySource).toContain('control.button?.setVisible(visible)');
        expect(inventorySource).toContain('control.zone?.setActive(visible)');
        expect(inventorySource).not.toContain(
            'this.equipButton.visible = item.equippable === true'
        );
    });

    test('gives every purchased item a clear destination', () => {
        expect(shopSource.match(/usageHint:/g)?.length).toBe(17);
        expect(shopSource).toContain('Expedition pause menu > Power-ups');
        expect(shopSource).toContain('Inventory > select egg > Hatch');
        expect(shopSource).toContain('Permanent survey support active');
        expect(inventorySource).toContain('item.usageHint || this.getDefaultUsageHint(item)');
    });

    test('preserves existing companions when another egg is hatched', () => {
        expect(shopSource).toContain(
            'preserve both family records in your sanctuary'
        );
        expect(inventorySource).toContain(
            "'s family record stays safe."
        );
        expect(inventorySource).toContain(
            'No companion is replaced or consumed.'
        );
        expect(inventorySource).toContain(
            'answers a second signal.'
        );
        expect(inventorySource).not.toContain('replace your current companion');
        expect(inventorySource).not.toContain('will be gone forever');
        expect(inventorySource).not.toContain('Farewell,');
        expect(shopSource).not.toContain('replace your current companion');
    });

    test('shows the equipped katana and every canonical ship component', () => {
        expect(inventorySource).toContain('FIELD KIT // KATANA EQUIPPED');
        expect(inventorySource).toContain('Use RED MELEE or X during expeditions');
        expect(inventorySource).toContain("'INSPECT'");
        expect(inventorySource).toContain("context: 'inventory'");
        expect(inventorySource).toContain('shipParts.forEach((part, index)');
        expect(inventorySource).not.toContain('void_stabilizer: {');
    });

    test('explains katana acquisition and baseline expedition use', () => {
        expect(gameSource).toContain("context = 'recovery'");
        expect(artifactSource).toContain('CONTINUE // KATANA EQUIPPED');
        expect(artifactSource).toContain('EARTH-FORGED FIELD KATANA');
        expect(levelSource).toContain('FIELD KATANA  //  MELEE');
        expect(levelSource).toContain('this.katanaEquipped = Boolean(');
    });
});
