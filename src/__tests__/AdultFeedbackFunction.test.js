const feedbackFunction = require('../../netlify/lib/adult-feedback-core.cjs');

const VALID_FEEDBACK = Object.freeze({
    schemaVersion: 1,
    adultConfirmed: true,
    audienceRole: 'adult_player',
    journey: 'hatched',
    overall: 'promising',
    bestPart: 'creature',
    nextImprovement: 'instructions',
    recommendation: 'yes'
});

function request(body, options = {}) {
    return {
        httpMethod: options.method || 'POST',
        headers: {
            host: 'mythicalvoid.com',
            ...(options.includeOrigin === false ? {} : { origin: options.origin || 'https://mythicalvoid.com' })
        },
        body: body === undefined ? undefined : JSON.stringify(body)
    };
}

function createAdminClient(error = null) {
    const insert = jest.fn(async () => ({ error }));
    return { from: jest.fn(() => ({ insert })), insert };
}

describe('adult-only fixed-choice feedback collector', () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
        process.env.SUPABASE_SERVICE_ROLE_KEY = 'server-only-test-key';
        process.env.DEPLOY_ID = 'deploy_feedback_1';
    });

    afterEach(() => {
        process.env = { ...originalEnv };
        feedbackFunction._internal.resetRuntime();
        jest.restoreAllMocks();
    });

    test('accepts only fixed adult feedback and stores no identity or free text', async () => {
        const adminClient = createAdminClient();
        feedbackFunction._internal.setRuntime({ createClient: () => adminClient });

        const response = await feedbackFunction.handler(request(VALID_FEEDBACK));

        expect(response.statusCode).toBe(201);
        expect(JSON.parse(response.body)).toEqual({ accepted: true });
        const row = adminClient.insert.mock.calls[0][0];
        expect(row).toEqual({
            audience_role: 'adult_player',
            journey: 'hatched',
            overall: 'promising',
            best_part: 'creature',
            next_improvement: 'instructions',
            recommendation: 'yes',
            release_id: 'deploy_feedback_1'
        });
        expect(JSON.stringify(row)).not.toMatch(/name|email|user|session|ip|message|story|device|location/i);
    });

    test('rejects a missing adult confirmation, free text and unknown choices', async () => {
        const createClient = jest.fn();
        feedbackFunction._internal.setRuntime({ createClient });
        const noAdult = await feedbackFunction.handler(request({ ...VALID_FEEDBACK, adultConfirmed: false }));
        const freeText = await feedbackFunction.handler(request({ ...VALID_FEEDBACK, comment: 'My child is called Nova' }));
        const unknown = await feedbackFunction.handler(request({ ...VALID_FEEDBACK, bestPart: 'anything I type' }));

        expect(noAdult.statusCode).toBe(400);
        expect(freeText.statusCode).toBe(400);
        expect(unknown.statusCode).toBe(400);
        expect(createClient).not.toHaveBeenCalled();
    });

    test('rejects missing and cross-origin requests', async () => {
        const createClient = jest.fn();
        feedbackFunction._internal.setRuntime({ createClient });
        const missing = await feedbackFunction.handler(request(VALID_FEEDBACK, { includeOrigin: false }));
        const crossOrigin = await feedbackFunction.handler(request(VALID_FEEDBACK, { origin: 'https://example.test' }));

        expect(missing.statusCode).toBe(403);
        expect(crossOrigin.statusCode).toBe(403);
        expect(createClient).not.toHaveBeenCalled();
    });

    test('does not echo a rejected database value', async () => {
        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
        const adminClient = createAdminClient({ code: 'DATABASE_UNAVAILABLE', message: 'child@example.com' });
        feedbackFunction._internal.setRuntime({ createClient: () => adminClient });

        const response = await feedbackFunction.handler(request(VALID_FEEDBACK));

        expect(response.statusCode).toBe(503);
        expect(response.body).not.toContain('child@example.com');
        expect(consoleError).toHaveBeenCalledWith('[AdultFeedback] Storage unavailable', 'DATABASE_UNAVAILABLE');
    });
});
