const AUTOMATION_AUDIO_ENV = 'MYTHICAL_VOID_AUTOMATION_AUDIO';

function automationAudioEnabled(env = process.env) {
    return env[AUTOMATION_AUDIO_ENV] === '1';
}

function applyBrowserAudioPolicy(args, env = process.env) {
    const nextArgs = [...args];
    if (!automationAudioEnabled(env) && !nextArgs.includes('--mute-audio')) {
        nextArgs.unshift('--mute-audio');
    }
    return nextArgs;
}

module.exports = {
    AUTOMATION_AUDIO_ENV,
    applyBrowserAudioPolicy,
    automationAudioEnabled
};
