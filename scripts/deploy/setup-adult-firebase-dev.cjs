// Explicitly scoped, idempotent development setup. Never prints Auth configuration or credentials.
const { execFileSync } = require('node:child_process');
const { mkdirSync, writeFileSync, existsSync } = require('node:fs');
const path = require('node:path');
const project = 'mythical-void-dev-eu';
const preview = 'mythical-void-frontend-preview-wihawqqnka-ew.a.run.app';
const accountId = 'adult-accounts-dev';
const member = `serviceAccount:${accountId}@${project}.iam.gserviceaccount.com`;
const role = `projects/${project}/roles/mythicalAdultIdentity`;
const permissions = ['firebaseauth.users.delete', 'firebaseauth.users.get'];
const plan = { project, region: 'europe-west1', auth: 'enable email links; preserve anonymous sign-in and existing domains',
    authorisedDomain: preview, runtimeIdentity: member, identityPermissions: permissions,
    firestore: 'roles/datastore.user restricted to the existing default development database',
    productionChanges: false, emailSent: false };
if (!process.argv.includes('--apply')) { console.log(JSON.stringify(plan, null, 2)); process.exit(0); }
(async () => {
    const token = execFileSync('gcloud', ['auth', 'print-access-token'], { encoding: 'utf8' }).trim();
    async function api(url, method = 'GET', body) {
        const response = await fetch(url, { method, headers: { Authorization: 'Bearer ' + token,
            'x-goog-user-project': project, 'Content-Type': 'application/json' },
            ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(30000) });
        const data = await response.json();
        if (!response.ok) { const e = Error(`${method} ${new URL(url).pathname}: ${response.status} ${data.error?.status || 'failed'}`); e.status = response.status; throw e; }
        return data;
    }
    const configUrl = `https://identitytoolkit.googleapis.com/admin/v2/projects/${project}/config`;
    const before = await api(configUrl);
    const evidence = path.resolve('.visual-review/adult-firebase'); mkdirSync(evidence, { recursive: true });
    if (!existsSync(path.join(evidence, 'auth-before.json'))) writeFileSync(path.join(evidence, 'auth-before.json'), JSON.stringify({ project,
        email: before.signIn?.email || { enabled: false }, authorisedDomains: before.authorizedDomains,
        anonymous: before.signIn?.anonymous, emailPrivacy: before.emailPrivacyConfig }, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    const saUrl = `https://iam.googleapis.com/v1/projects/${project}/serviceAccounts`;
    let serviceAccount;
    try { serviceAccount = await api(saUrl + '/' + `${accountId}@${project}.iam.gserviceaccount.com`); }
    catch (e) { if (e.status !== 404) throw e;
        serviceAccount = await api(saUrl, 'POST', { accountId, serviceAccount: { displayName: 'Mythical Void optional adult accounts development' } }); }
    let existing;
    try { existing = await api('https://iam.googleapis.com/v1/' + role); }
    catch (e) { if (e.status !== 404) throw e;
        existing = await api(`https://iam.googleapis.com/v1/projects/${project}/roles`, 'POST', { roleId: 'mythicalAdultIdentity',
            role: { title: 'Mythical adult identity verification and deletion', stage: 'GA', includedPermissions: permissions } }); }
    if (JSON.stringify(existing.includedPermissions?.sort()) !== JSON.stringify(permissions)) throw Error('Unexpected existing identity-role permissions; no role overwritten');
    const policyUrl = `https://cloudresourcemanager.googleapis.com/v1/projects/${project}`;
    const policy = await api(policyUrl + ':getIamPolicy', 'POST', { options: { requestedPolicyVersion: 3 } });
    const condition = { title: 'AdultAccountDefaultDatabase', expression: `resource.name == "projects/${project}/databases/(default)"` };
    function bind(name, rule) {
        const match = policy.bindings.find(b => b.role === name && (b.condition?.expression || '') === (rule?.expression || ''));
        if (match) { if (!match.members.includes(member)) match.members.push(member); }
        else policy.bindings.push({ role: name, members: [member], ...(rule ? { condition: rule } : {}) });
    }
    bind(role); bind('roles/datastore.user', condition); policy.version = 3;
    await api(policyUrl + ':setIamPolicy', 'POST', { policy });
    await api(configUrl + '?updateMask=signIn.email,authorizedDomains', 'PATCH', {
        signIn: { email: { enabled: true, passwordRequired: false } },
        authorizedDomains: [...new Set([...before.authorizedDomains, preview])] });
    const after = await api(configUrl);
    if (after.signIn?.email?.enabled !== true || after.signIn?.email?.passwordRequired === true ||
        JSON.stringify(after.signIn?.anonymous) !== JSON.stringify(before.signIn?.anonymous) ||
        JSON.stringify(after.emailPrivacyConfig) !== JSON.stringify(before.emailPrivacyConfig)) throw Error('Development auth verification failed');
    const result = { ...plan, configured: true, runtimeServiceAccount: serviceAccount.email, configuredAt: new Date().toISOString() };
    writeFileSync(path.join(evidence, 'development-setup.json'), JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify(result, null, 2));
})().catch(e => { console.error(e.message); process.exitCode = 1; });
