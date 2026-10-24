const { UUID, UID, POLICY, fail, digest } = require('./snapshot.cjs');
const CHUNK_BYTES = 256 * 1024;
class FirestoreAdultStore {
    constructor(db, now = () => Date.now()) { this.db = db; this.now = now; }
    account(uid) { if (!UID.test(uid || '')) throw fail('sign_in_required', 401); return this.db.collection('adultAccounts').doc(uid); }
    adventure(uid, id) { if (!UUID.test(id || '')) throw fail('invalid_adventure'); return this.account(uid).collection('adventures').doc(id); }
    admitted(row) {
        if (row?.deletedAt) throw fail('account_deleted', 401);
        if (row?.adultDeclared !== true || row.policyVersion !== POLICY) throw fail('adult_declaration_required', 403);
        return row;
    }
    async requireAccount(uid) { return this.admitted((await this.account(uid).get()).data()); }
    async consent(uid) {
        const ref = this.account(uid);
        await this.db.runTransaction(async tx => {
            const previous = (await tx.get(ref)).data();
            if (previous?.deletedAt) throw fail('account_deleted', 401);
            tx.set(ref, { adultDeclared: true, policyVersion: POLICY, declaredAt: previous?.declaredAt || this.now(),
                activeCount: previous?.activeCount || 0 }, { merge: true });
        });
        return { accepted: true };
    }
    async list(uid) {
        await this.requireAccount(uid);
        const rows = await this.account(uid).collection('adventures').where('removed', '==', false).limit(50).get();
        return { adventures: rows.docs.map(d => {
            const r = d.data(); return { id: d.id, revision: r.revision, display_name: r.displayName,
                updated_at: new Date(r.updatedAt).toISOString() };
        }).sort((a, b) => b.updated_at.localeCompare(a.updated_at)) };
    }
    async read(uid, id) {
        const ref = this.adventure(uid, id);
        return this.db.runTransaction(async tx => {
            const [account, record] = await tx.getAll(this.account(uid), ref);
            this.admitted(account.data()); const row = record.data();
            if (!row) throw fail('adventure_not_found', 404);
            if (row.removed) throw fail('adventure_removed', 410);
            if (!Number.isInteger(row.chunks) || row.chunks < 1 || row.chunks > 8) throw fail('accounts_unavailable', 503);
            const chunks = await tx.getAll(...Array.from({ length: row.chunks }, (_, i) => ref.collection('payload').doc(String(i))));
            if (chunks.some(d => !d.exists || d.data().revision !== row.revision)) throw fail('accounts_unavailable', 503);
            const bytes = Buffer.concat(chunks.map(d => Buffer.from(d.data().value, 'base64')));
            if (digest(bytes) !== row.digest) throw fail('accounts_unavailable', 503);
            return { adventure: { id, revision: row.revision, operation_id: row.operationId,
                game_state: JSON.parse(bytes.toString()), updated_at: new Date(row.updatedAt).toISOString() },
                mediaOwners: row.mediaOwners || [] };
        });
    }
    async save(uid, { id, revision, operationId, state }, ownerId = null) {
        const ref = this.adventure(uid, id), accountRef = this.account(uid);
        const bytes = Buffer.from(JSON.stringify(state)), hash = digest(bytes);
        const chunks = Array.from({ length: Math.ceil(bytes.length / CHUNK_BYTES) }, (_, i) => bytes.subarray(i * CHUNK_BYTES, (i + 1) * CHUNK_BYTES).toString('base64'));
        return this.db.runTransaction(async tx => {
            const [account, record] = await tx.getAll(accountRef, ref);
            const admitted = this.admitted(account.data()), previous = record.data();
            if (previous?.removed) throw fail('adventure_removed', 410);
            if (previous?.operationId === operationId) {
                if (previous.digest !== hash) throw fail('adventure_changed', 409);
                return { id, revision: previous.revision, operationId };
            }
            if ((previous?.revision || 0) !== revision) throw fail('adventure_changed', 409);
            if (!previous && admitted.activeCount >= 50) throw fail('library_full', 409);
            const mediaOwners = [...new Set([...(previous?.mediaOwners || []), ...(ownerId ? [ownerId] : [])])];
            if (mediaOwners.length > 50) throw fail('media_identity_limit', 409);
            const nextRevision = revision + 1;
            tx.set(ref, { revision: nextRevision, operationId, digest: hash, chunks: chunks.length,
                displayName: String(state.creature.name || 'Your creature').slice(0, 80), updatedAt: this.now(),
                removed: false, mediaOwners });
            chunks.forEach((value, i) => tx.set(ref.collection('payload').doc(String(i)), { revision: nextRevision, value }));
            for (let i = chunks.length; i < (previous?.chunks || 0); i++) tx.delete(ref.collection('payload').doc(String(i)));
            if (!previous) tx.update(accountRef, { activeCount: admitted.activeCount + 1 });
            return { id, revision: nextRevision, operationId };
        });
    }
    async remove(uid, id, revision) {
        const ref = this.adventure(uid, id), accountRef = this.account(uid);
        await this.db.runTransaction(async tx => {
            const [account, record] = await tx.getAll(accountRef, ref);
            const admitted = this.admitted(account.data()), row = record.data();
            if (row?.removed) return;
            if (!row || row.revision !== revision) throw fail('adventure_changed', 409);
            for (let i = 0; i < row.chunks; i++) tx.delete(ref.collection('payload').doc(String(i)));
            tx.set(ref, { removed: true, revision: row.revision + 1, removedAt: this.now() });
            tx.update(accountRef, { activeCount: Math.max(0, admitted.activeCount - 1) });
        });
        return { removed: true };
    }
    async erase(uid) {
        // Fence new writes before removing copies. A failed erase can safely be retried.
        const ref = this.account(uid);
        await this.db.runTransaction(async tx => {
            const row = (await tx.get(ref)).data();
            if (!row?.deletedAt) this.admitted(row);
            tx.set(ref, { deletedAt: row?.deletedAt || this.now(), activeCount: 0 });
        });
        await this.db.recursiveDelete(ref.collection('adventures'));
    }
}
module.exports = { FirestoreAdultStore };
