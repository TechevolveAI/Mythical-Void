#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const configPath = path.join(__dirname, 'public-footprint-config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const maxRedirects = 5;
const timeoutMs = 15000;

function fetchUrl(url, redirectCount = 0) {
    return new Promise(resolve => {
        const client = url.startsWith('https:') ? https : http;
        const request = client.get(url, {
            headers: {
                'User-Agent': 'Mythical-Company-A0-Footprint-Auditor/1.0',
                Accept: '*/*'
            }
        }, response => {
            const status = response.statusCode || 0;
            const location = response.headers.location;
            if (status >= 300 && status < 400 && location) {
                response.resume();
                if (redirectCount >= maxRedirects) {
                    resolve({ url, status, headers: response.headers, body: '', error: 'redirect_limit' });
                    return;
                }
                const nextUrl = new URL(location, url).toString();
                resolve(fetchUrl(nextUrl, redirectCount + 1));
                return;
            }

            const chunks = [];
            let size = 0;
            response.on('data', chunk => {
                size += chunk.length;
                if (size <= 1024 * 1024) chunks.push(chunk);
            });
            response.on('end', () => resolve({
                url,
                status,
                headers: response.headers,
                body: Buffer.concat(chunks).toString('utf8'),
                error: size > 1024 * 1024 ? 'response_too_large' : null
            }));
        });
        request.setTimeout(timeoutMs, () => request.destroy(new Error('timeout')));
        request.on('error', error => resolve({ url, status: 0, headers: {}, body: '', error: error.message }));
    });
}

function finding(severity, code, message) {
    return { severity, code, message };
}

function inspect(check, response) {
    const findings = [];
    const contentType = String(response.headers['content-type'] || '').toLowerCase();
    const body = response.body || '';

    if (response.error) findings.push(finding('major', 'request_error', response.error));
    if (response.status !== 200) {
        findings.push(finding('major', 'unexpected_status', `Expected 200, received ${response.status}`));
    }
    if (!contentType.includes(check.expectedContentType)) {
        findings.push(finding(
            'major',
            'unexpected_content_type',
            `Expected ${check.expectedContentType}, received ${contentType || 'missing'}`
        ));
    }

    if (check.kind === 'home') {
        const requirements = [
            [/<link rel="canonical" href="https:\/\/mythicalvoid\.com\/">/, 'canonical_missing'],
            [/<meta property="og:image" content="https:\/\/mythicalvoid\.com\//, 'og_image_missing'],
            [/<script type="application\/ld\+json">/, 'structured_data_missing'],
            [/<meta name="robots" content="index, follow, max-image-preview:large">/, 'robots_meta_missing']
        ];
        requirements.forEach(([pattern, code]) => {
            if (!pattern.test(body)) findings.push(finding('minor', code, `Homepage requirement failed: ${code}`));
        });

        const requiredHeaders = [
            'content-security-policy',
            'strict-transport-security',
            'x-content-type-options',
            'referrer-policy'
        ];
        requiredHeaders.forEach(header => {
            if (!response.headers[header]) {
                findings.push(finding('major', 'security_header_missing', `Missing ${header}`));
            }
        });
    }

    if (check.kind === 'robots') {
        if (/<!doctype html>|<html/i.test(body)) {
            findings.push(finding('major', 'robots_spa_fallback', 'robots.txt returned HTML instead of a robots policy'));
        }
        if (!/^Sitemap: https:\/\/mythicalvoid\.com\/sitemap\.xml$/m.test(body)) {
            findings.push(finding('major', 'sitemap_declaration_missing', 'robots.txt does not declare the canonical sitemap'));
        }
    }

    if (check.kind === 'sitemap') {
        if (/<!doctype html>|<html/i.test(body)) {
            findings.push(finding('major', 'sitemap_spa_fallback', 'sitemap.xml returned HTML instead of XML'));
        }
        if (!/<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/.test(body)) {
            findings.push(finding('major', 'sitemap_invalid', 'sitemap.xml lacks a sitemap urlset'));
        }
    }

    if (check.kind === 'llms') {
        if (/<!doctype html>|<html/i.test(body)) {
            findings.push(finding('minor', 'llms_spa_fallback', 'llms.txt returned HTML instead of the factual project summary'));
        }
        if (!/^# Mythical Void$/m.test(body)) {
            findings.push(finding('minor', 'llms_identity_missing', 'llms.txt lacks the Mythical Void heading'));
        }
    }

    return {
        path: check.path,
        finalUrl: response.url,
        status: response.status,
        contentType,
        findings
    };
}

async function main() {
    const checkedAt = new Date().toISOString();
    const results = [];

    for (const check of config.checks) {
        const url = new URL(check.path, config.origin).toString();
        const response = await fetchUrl(url);
        results.push(inspect(check, response));
    }

    const findings = results.flatMap(result =>
        result.findings.map(item => ({ path: result.path, ...item }))
    );
    const severityRank = { none: 0, minor: 1, major: 2 };
    const highestSeverity = findings.reduce(
        (current, item) => severityRank[item.severity] > severityRank[current] ? item.severity : current,
        'none'
    );
    const report = {
        workflow: 'A-001',
        version: 1,
        autonomy: 'A0',
        checkedAt,
        origin: config.origin,
        highestSeverity,
        summary: {
            checks: results.length,
            findings: findings.length,
            major: findings.filter(item => item.severity === 'major').length,
            minor: findings.filter(item => item.severity === 'minor').length
        },
        results
    };

    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (highestSeverity === 'major') process.exitCode = 2;
    else if (highestSeverity === 'minor') process.exitCode = 1;
}

if (require.main === module) {
    main().catch(error => {
        console.error(JSON.stringify({
            workflow: 'A-001',
            version: 1,
            autonomy: 'A0',
            fatal: error.message
        }, null, 2));
        process.exit(3);
    });
}

module.exports = { inspect };
