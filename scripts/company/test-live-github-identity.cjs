#!/usr/bin/env node

const assert = require('assert');
const { EXPECTED, evaluateGitHubIdentity } = require('./audit-live-github-identity.cjs');

const valid = {
    full_name: EXPECTED.repository,
    html_url: EXPECTED.publicUrl,
    description: EXPECTED.description,
    homepage: EXPECTED.homepage,
    private: false,
    archived: false,
    disabled: false,
    topics: [...EXPECTED.topics]
};
let cases = 0;

function rejected(name, expected, change) {
    const value = JSON.parse(JSON.stringify(valid));
    change(value);
    const failures = evaluateGitHubIdentity(value);
    assert(failures.some(failure => failure.includes(expected)), `${name} should report ${expected}`);
    cases += 1;
}

assert.deepStrictEqual(evaluateGitHubIdentity(valid), []);
cases += 1;
assert.deepStrictEqual(evaluateGitHubIdentity({ ...valid, topics: [...valid.topics].reverse() }), []);
cases += 1;
rejected('old internal project wording', 'plain-language description', value => { value.description = 'Shape Project Beacon.'; });
rejected('wrong website', 'website link', value => { value.homepage = 'https://example.com/'; });
rejected('private repository', 'not publicly visible', value => { value.private = true; });
rejected('archived repository', 'not active', value => { value.archived = true; });
rejected('missing topic', 'discovery topics', value => { value.topics.pop(); });
rejected('wrong repository', 'repository identity', value => { value.full_name = 'Someone/Else'; });
rejected('wrong public URL', 'public repository URL', value => { value.html_url = 'https://github.com/Someone/Else'; });

assert.strictEqual(cases, 9);
console.log('Live GitHub identity safeguards passed (9 cases).');
