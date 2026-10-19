/** Local recovery evidence only. This is not a game-save or backend wire format. */
class CloudRecoveryJournal {
    constructor(storage, saveKey) {
        this.storage = storage;
        this.prefix = `${saveKey}-cloud-journal-v1:`;
        this.controlKey = `${this.prefix}control`;
        this.verifiedRecords = new Map();
    }

    static hash(text) {
        const sha256 = CloudRecoveryJournal.sha256 ||
            (typeof module !== 'undefined' && module.exports ? require('@noble/hashes/sha256').sha256 : null);
        if (!sha256) throw Error('RECOVERY_DIGEST_UNAVAILABLE');
        const bytes = typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(text)
            : Uint8Array.from(require('node:buffer').Buffer.from(text, 'utf8'));
        return Array.from(sha256(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
    }

    error() {
        return Object.assign(new Error('Cloud recovery evidence needs review.'), { code: 'cloud_recovery_damaged' });
    }

    seal(body) { return { ...body, digest: CloudRecoveryJournal.hash(JSON.stringify(body)) }; }

    verified(raw) {
        if (this.verifiedRecords.has(raw)) return this.verifiedRecords.get(raw);
        try {
            const value = JSON.parse(raw), { digest, ...body } = value;
            if (value.schemaVersion !== 1 || !/^[a-f0-9]{64}$/.test(digest) ||
                CloudRecoveryJournal.hash(JSON.stringify(body)) !== digest) throw this.error();
            if (body.kind === 'request' && (typeof body.wireRequest !== 'string' ||
                CloudRecoveryJournal.hash(body.wireRequest) !== body.context?.wireDigest)) throw this.error();
            const freeze = node => {
                if (!node || typeof node !== 'object') return;
                Object.values(node).forEach(freeze);
                Object.freeze(node);
            };
            freeze(value);
            this.verifiedRecords.set(raw, value);
            while (this.verifiedRecords.size > 8) this.verifiedRecords.delete(this.verifiedRecords.keys().next().value);
            return value;
        } catch { throw this.error(); }
    }

    write(key, value, { immutable = false, expected } = {}) {
        const raw = JSON.stringify(value), previous = this.storage.getItem(key);
        if ((immutable && previous !== null) || (expected !== undefined && previous !== expected)) throw this.error();
        try { this.storage.setItem(key, raw); }
        catch (error) { if (this.storage.getItem(key) !== raw) throw error; }
        if (this.storage.getItem(key) !== raw) throw this.error();
        return raw;
    }

    inspect() {
        const keys = [];
        for (let index = 0; index < this.storage.length; index++) {
            const key = this.storage.key(index);
            if (key?.startsWith(this.prefix)) keys.push(key);
        }
        const raw = this.storage.getItem(this.controlKey);
        if (raw === null) {
            if (keys.length) throw this.error();
            return { control: null, raw: null, envelopes: {} };
        }
        const control = this.verified(raw);
        if (!/^\d+(?:-\d+)?$/.test(control.id) || !['pending', 'confirmed'].includes(control.phase) ||
            typeof control.evidenceLimited !== 'boolean' || !control.records?.request ||
            Object.keys(control.records).some(kind => !['request', 'local', 'result', 'outcome'].includes(kind)) ||
            !Number.isFinite(control.createdAt) || !['upload', 'mutation'].includes(control.context?.kind) ||
            !/^[a-f0-9]{64}$/.test(control.context?.ownerDigest) ||
            !/^[a-f0-9]{64}$/.test(control.context?.operationDigest) ||
            !/^[a-f0-9]{64}$/.test(control.context?.wireDigest) ||
            typeof control.context?.saveSlot !== 'string' || control.context.saveSlot.length > 64 ||
            !Number.isSafeInteger(control.context?.expectedRevision) || control.context.expectedRevision < 0) throw this.error();
        const known = new Set([this.controlKey]), envelopes = {};
        for (const [kind, reference] of Object.entries(control.records)) {
            const key = `${this.prefix}${control.id}:${kind}`;
            if (reference.key !== key || !/^[a-f0-9]{64}$/.test(reference.digest)) throw this.error();
            known.add(key);
            const envelopeRaw = this.storage.getItem(key);
            // Only a completed operation may retire its large payloads. The
            // checked confirmation manifest stays until the next reservation.
            if (envelopeRaw === null && control.phase === 'confirmed') continue;
            if (envelopeRaw === null) throw this.error();
            const envelope = this.verified(envelopeRaw);
            if (envelope.digest !== reference.digest || envelope.id !== control.id || envelope.kind !== kind ||
                JSON.stringify(envelope.context) !== JSON.stringify(control.context) || typeof envelope.payload !== 'string' ||
                (kind !== 'request' && envelope.requestDigest !== control.records.request.digest)) throw this.error();
            envelopes[kind] = envelope;
        }
        if (keys.some(key => !known.has(key))) throw this.error();
        if (control.phase === 'confirmed' && (control.confirmation?.requestDigest !== control.records.request.digest ||
            !/^[a-f0-9]{64}$/.test(control.confirmation?.activeDigest) ||
            control.confirmation?.resultDigest !== (control.records.result?.digest || null) ||
            control.confirmation?.outcomeDigest !== (control.records.outcome?.digest || null))) throw this.error();
        return { control, raw, envelopes };
    }

    begin(id, payload, context, wireRequest = '') {
        const before = this.inspect();
        if (before.control?.phase === 'pending') throw this.error();
        if (before.control) {
            for (const reference of Object.values(before.control.records)) {
                if (this.storage.getItem(this.controlKey) !== before.raw) throw this.error();
                this.storage.removeItem(reference.key);
                if (this.storage.getItem(reference.key) !== null) throw this.error();
            }
        }
        const envelope = this.seal({ schemaVersion: 1, id, kind: 'request', context, payload, wireRequest });
        const key = `${this.prefix}${id}:request`;
        this.write(key, envelope, { immutable: true });
        const control = this.seal({ schemaVersion: 1, id, phase: 'pending', createdAt: Date.now(), context,
            records: { request: { key, digest: envelope.digest } }, evidenceLimited: true });
        this.write(this.controlKey, control, { expected: before.raw });
        this.inspect();
        return envelope.digest;
    }

    assertLease(lease) {
        const inspected = this.inspect(), { control, envelopes } = inspected;
        if (!control || control.phase !== 'pending' || control.id !== lease.id ||
            control.records.request.digest !== lease.requestDigest ||
            envelopes.request?.payload !== lease.snapshot || control.context.kind !== lease.kind ||
            envelopes.request?.wireRequest !== lease.wireRequest ||
            JSON.stringify(control.context) !== JSON.stringify(lease.context)) throw this.error();
        return inspected;
    }

    append(lease, kind, payload) {
        if (!['local', 'result', 'outcome'].includes(kind)) throw this.error();
        const { control, raw } = this.assertLease(lease);
        const envelope = this.seal({ schemaVersion: 1, id: lease.id, kind, context: control.context,
            requestDigest: lease.requestDigest, payload });
        if (control.records[kind]) {
            if (control.records[kind].digest !== envelope.digest) throw this.error();
            return;
        }
        const key = `${this.prefix}${lease.id}:${kind}`;
        this.write(key, envelope, { immutable: true });
        const { digest, ...body } = control;
        this.write(this.controlKey, this.seal({ ...body,
            records: { ...body.records, [kind]: { key, digest: envelope.digest } } }), { expected: raw });
        this.assertLease(lease);
    }

    markEvidence(lease, limited) {
        const { control, raw } = this.assertLease(lease), { digest, ...body } = control;
        this.write(this.controlKey, this.seal({ ...body, evidenceLimited: limited }), { expected: raw });
        this.assertLease(lease);
    }

    confirm(lease, activeRaw) {
        const { control, raw } = this.assertLease(lease), { digest, ...body } = control;
        if (lease.wireRequest && !control.records.outcome) throw this.error();
        const confirmation = { requestDigest: lease.requestDigest,
            resultDigest: control.records.result?.digest || null,
            outcomeDigest: control.records.outcome?.digest || null,
            activeDigest: CloudRecoveryJournal.hash(activeRaw || '') };
        this.write(this.controlKey, this.seal({ ...body, phase: 'confirmed', evidenceLimited: false,
            confirmation }), { expected: raw });
        if (this.inspect().control.phase !== 'confirmed') throw this.error();
    }
}

if (typeof window !== 'undefined') window.CloudRecoveryJournal = CloudRecoveryJournal;
if (typeof module !== 'undefined' && module.exports) module.exports = CloudRecoveryJournal;
