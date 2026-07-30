const fs = require('fs');
const path = require('path');
const legal = require('../config/legal.json');

describe('Cloud Save privacy contract', () => {
    test('uses neutral age bands and keeps under-16 paths local-only', () => {
        const under13Option = legal.ageGate.options.find(
            option => option.storeAs === 'age_under_13'
        );
        const teenOption = legal.ageGate.options.find(
            option => option.storeAs === 'age_13_15'
        );
        const childrenSection = legal.privacyPolicy.sections.find(
            section => section.heading === 'Children\'s Privacy'
        );

        expect(legal.ageGate.options.map(option => option.storeAs)).toEqual([
            'age_under_13',
            'age_13_15',
            'age_16_17',
            'age_18_plus'
        ]);
        expect(under13Option.notice).toMatch(/stay on this device/i);
        expect(teenOption.notice).toMatch(/saved on this device/i);
        expect(childrenSection.content).toMatch(/under 16/i);
        expect(childrenSection.content).toMatch(/unavailable/i);
    });

    test('renders a local-save-only state instead of guardian self-attestation', () => {
        const modalSource = fs.readFileSync(
            path.join(__dirname, '../ui/CloudSaveSettingsModal.js'),
            'utf8'
        );

        expect(modalSource).toContain('renderAgeRestricted');
        expect(modalSource).toContain('Cloud Save is unavailable for under-16 profiles');
        expect(modalSource).toContain('Delete Cloud Data');
        expect(modalSource).toContain('anonymous cloud identity');
        expect(modalSource).not.toContain("I am this player's parent or guardian");
    });

    test('shows whether progress was restored or backed up', () => {
        const modalSource = fs.readFileSync(
            path.join(__dirname, '../ui/CloudSaveSettingsModal.js'),
            'utf8'
        );

        expect(modalSource).toContain('Cloud progress was restored to this browser');
        expect(modalSource).toContain('Restored from cloud');
        expect(modalSource).toContain('Backed up to cloud');
        expect(modalSource).toContain('this.scene.cameras.add(0, 0, width, height)');
        expect(modalSource).toContain('this.scene.cameras.main.ignore(this.elements)');
        expect(modalSource).toContain("this.scene.events.once('shutdown', this.destroy, this)");
        expect(modalSource).toContain('this.scene.cameras.remove(this.uiCamera)');
    });

    test('keeps the destructive naming reset behind an explicit local QA route', () => {
        const namingSource = fs.readFileSync(
            path.join(__dirname, '../scenes/NamingScene.js'),
            'utf8'
        );

        expect(namingSource).toContain('import.meta.env.DEV');
        expect(namingSource).toContain("has('debugReset')");
        expect(namingSource).toMatch(
            /if \(showDebugReset\) \{\s*this\.createResetButton\(\);/
        );
    });

    test('deletes anonymous identities only through an authenticated server function', () => {
        const functionSource = fs.readFileSync(
            path.join(
                __dirname,
                '../../supabase/functions/delete-cloud-identity/index.ts'
            ),
            'utf8'
        );

        expect(functionSource).toContain('callerClient.auth.getUser()');
        expect(functionSource).toContain('if (!user.is_anonymous)');
        expect(functionSource).toContain('adminClient.auth.admin.deleteUser(user.id)');
    });

    test('provides local live and restricted Cloud Save preview routes', () => {
        const gameSource = fs.readFileSync(
            path.join(__dirname, '../game.js'),
            'utf8'
        );
        const hatchingSource = fs.readFileSync(
            path.join(__dirname, '../scenes/HatchingScene.js'),
            'utf8'
        );

        expect(gameSource).toContain(
            "['live', 'under13', 'restored', 'uploaded'].includes(testCloudSave)"
        );
        expect(gameSource).toContain('new CloudSaveSettingsModal');
        expect(gameSource).toContain('game.scene.getScenes(true)');
        expect(gameSource).toContain('previewScene?.cameras?.main');
        expect(gameSource).toContain('lastSyncDirection: testCloudSave');
        expect(hatchingSource).toContain("previewParams.has('testCloudSave')");
    });
});
