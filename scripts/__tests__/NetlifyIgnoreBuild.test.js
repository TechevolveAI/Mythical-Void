const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const script = path.resolve(__dirname, '..', 'netlify-ignore-build.cjs');

function git(cwd, args) {
    return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

function write(root, relativePath, value) {
    const target = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, value);
}

function makeRepository(changes) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-netlify-ignore-'));
    git(root, ['init', '--quiet']);
    git(root, ['config', 'user.email', 'studio-test@mythicalvoid.invalid']);
    git(root, ['config', 'user.name', 'Mythical Studio Test']);
    write(root, 'src/game.js', 'export const version = 1;\n');
    write(root, 'docs/company/operations/current-state.json', '{"state":"before"}\n');
    write(root, 'docs/company/FOUNDER_CONTROL_PAGE.md', '# Before\n');
    git(root, ['add', '.']);
    git(root, ['commit', '--quiet', '-m', 'before']);
    const before = git(root, ['rev-parse', 'HEAD']);

    Object.entries(changes).forEach(([relativePath, value]) => write(root, relativePath, value));
    git(root, ['add', '.']);
    git(root, ['commit', '--quiet', '-m', 'after']);
    const after = git(root, ['rev-parse', 'HEAD']);
    return { root, before, after };
}

function run(root, before, after, extraEnv = {}) {
    return spawnSync(process.execPath, [script], {
        cwd: root,
        env: {
            ...process.env,
            CACHED_COMMIT_REF: before,
            COMMIT_REF: after,
            ...extraEnv
        },
        encoding: 'utf8'
    });
}

describe('Netlify build-capacity guard', () => {
    const roots = [];

    afterEach(() => {
        roots.splice(0).forEach(root => fs.rmSync(root, { recursive: true, force: true }));
    });

    test.each([
        ['operations record', { 'docs/company/operations/current-state.json': '{"state":"after"}\n' }],
        ['research record', { 'docs/company/research/first-five-playtest.json': '{"sessions":0}\n' }],
        ['review record', { 'docs/company/reviews/visual-review.json': '{"approved":false}\n' }],
        ['founder page', { 'docs/company/FOUNDER_CONTROL_PAGE.md': '# After\n' }]
    ])('skips a build for a private %s change', (_label, changes) => {
        const repository = makeRepository(changes);
        roots.push(repository.root);
        const result = run(repository.root, repository.before, repository.after);
        expect(result.status).toBe(0);
        expect(result.stdout).toContain('private studio-record');
    });

    test.each([
        ['game source', { 'src/game.js': 'export const version = 2;\n' }],
        ['public page', { 'public/new-page.html': '<h1>New</h1>\n' }],
        ['hosting rules', { 'netlify.toml': '[build]\ncommand="npm run build"\n' }],
        ['package definition', { 'package.json': '{"scripts":{"build":"vite build"}}\n' }],
        ['company build script', { 'scripts/company/build-news.cjs': 'process.stdout.write("build");\n' }],
        ['mixed private and public work', {
            'docs/company/operations/current-state.json': '{"state":"after"}\n',
            'src/game.js': 'export const version = 2;\n'
        }]
    ])('continues the build for a %s change', (_label, changes) => {
        const repository = makeRepository(changes);
        roots.push(repository.root);
        const result = run(repository.root, repository.before, repository.after);
        expect(result.status).toBe(1);
        expect(result.stdout).toContain('build continues');
    });

    test('continues when trusted commit references are missing', () => {
        const result = spawnSync(process.execPath, [script], {
            env: { ...process.env, CACHED_COMMIT_REF: '', COMMIT_REF: '' },
            encoding: 'utf8'
        });
        expect(result.status).toBe(1);
        expect(result.stdout).toContain('trusted previous/current commit pair');
    });

    test('continues when the prior and current commits are identical', () => {
        const commit = 'a'.repeat(40);
        const result = spawnSync(process.execPath, [script], {
            env: { ...process.env, CACHED_COMMIT_REF: commit, COMMIT_REF: commit },
            encoding: 'utf8'
        });
        expect(result.status).toBe(1);
        expect(result.stdout).toContain('no distinct prior build');
    });

    test('skips an unbatched pull-request preview before spending build credits', () => {
        const repository = makeRepository({ 'src/game.js': 'export const version = 2;\n' });
        roots.push(repository.root);
        const result = run(repository.root, repository.before, repository.after, {
            CONTEXT: 'deploy-preview',
            HEAD: 'codex/core-journey-next-level'
        });
        expect(result.status).toBe(0);
        expect(result.stdout).toContain('not a batched codex/release-* preview branch');
    });

    test('continues a batched release preview with player-facing changes', () => {
        const repository = makeRepository({ 'src/game.js': 'export const version = 2;\n' });
        roots.push(repository.root);
        const result = run(repository.root, repository.before, repository.after, {
            CONTEXT: 'deploy-preview',
            HEAD: 'codex/release-september-levels'
        });
        expect(result.status).toBe(1);
        expect(result.stdout).toContain('public or build-affecting files changed');
    });

    test('continues a protected-main production build regardless of branch naming', () => {
        const repository = makeRepository({ 'src/game.js': 'export const version = 2;\n' });
        roots.push(repository.root);
        const result = run(repository.root, repository.before, repository.after, {
            CONTEXT: 'production',
            BRANCH: 'main'
        });
        expect(result.status).toBe(1);
        expect(result.stdout).toContain('public or build-affecting files changed');
    });
});
