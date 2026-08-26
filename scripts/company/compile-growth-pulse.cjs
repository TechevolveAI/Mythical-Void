#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const knownEvents = new Set([
    'page_view',
    'play_selected',
    'share_completed',
    'share_link_copied'
]);
const sensitiveHeaderPattern = /(?:^|\b)(user(?:\s+|_)id|client(?:\s+|_)id|session(?:\s+|_)id|email|age|gender|city|country|device|browser|user agent|referrer|page location|full url|query string|ip address)(?:\b|$)/i;

function fail(message) {
    throw new Error(message);
}

function parseCsv(text) {
    const rows = [];
    let row = [];
    let cell = '';
    let quoted = false;

    for (let index = 0; index < text.length; index += 1) {
        const character = text[index];
        if (quoted) {
            if (character === '"' && text[index + 1] === '"') {
                cell += '"';
                index += 1;
            } else if (character === '"') {
                quoted = false;
            } else {
                cell += character;
            }
            continue;
        }
        if (character === '"') {
            quoted = true;
        } else if (character === ',') {
            row.push(cell);
            cell = '';
        } else if (character === '\n') {
            row.push(cell.replace(/\r$/, ''));
            rows.push(row);
            row = [];
            cell = '';
        } else {
            cell += character;
        }
    }
    if (quoted) fail('CSV contains an unclosed quoted value');
    if (cell !== '' || row.length > 0) {
        row.push(cell.replace(/\r$/, ''));
        rows.push(row);
    }
    return rows.filter(candidate => candidate.some(value => value.trim() !== ''));
}

function normalizedHeader(value) {
    return String(value || '').replace(/^\uFEFF/, '').trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
}

function findHeaderRow(rows) {
    const index = rows.findIndex(row => {
        const values = row.map(normalizedHeader);
        return values.includes('event name') && values.some(value => ['event count', 'count'].includes(value));
    });
    if (index < 0) fail('expected GA4 columns for Event name and Event count');
    return index;
}

function findColumn(headers, choices, label) {
    const index = headers.findIndex(header => choices.includes(header));
    if (index < 0) fail(`missing ${label} column`);
    return index;
}

function normalizeDate(value) {
    const compact = String(value || '').trim();
    const match = compact.match(/^(\d{4})-?(\d{2})-?(\d{2})$/);
    if (!match) fail(`invalid date "${compact}"; use YYYYMMDD or YYYY-MM-DD`);
    const iso = `${match[1]}-${match[2]}-${match[3]}`;
    if (Number.isNaN(Date.parse(`${iso}T00:00:00Z`))) fail(`invalid date "${compact}"`);
    return iso;
}

function normalizePath(value) {
    let route = String(value || '').trim();
    if (!route) return '/';
    if (/^https?:\/\//i.test(route)) fail('full page addresses are not accepted; export only Page path and screen class');
    if (/[?#]/.test(route)) fail(`page path "${route}" contains a query or fragment; remove detailed addresses before reporting`);
    if (!route.startsWith('/')) route = `/${route}`;
    route = route.replace(/\/+$/, '') || '/';
    return route;
}

function parseCount(value) {
    const normalized = String(value || '').trim().replace(/,/g, '');
    if (!/^\d+$/.test(normalized)) fail(`event count "${value}" must be a non-negative whole number`);
    return Number(normalized);
}

function percent(numerator, denominator) {
    if (!denominator) return null;
    return (numerator / denominator) * 100;
}

function formatPercent(value) {
    return value === null ? 'Not available' : `${value.toFixed(1)}%`;
}

function cell(value) {
    return String(value).replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function readVisualGate() {
    const gatePath = path.join(repositoryRoot, 'docs', 'company', 'content', 'visual-launch-moments.json');
    if (!fs.existsSync(gatePath)) return { approved: 0, required: 4, ready: false };
    const gate = JSON.parse(fs.readFileSync(gatePath, 'utf8'));
    const moments = Array.isArray(gate.requiredMoments)
        ? gate.requiredMoments
        : (Array.isArray(gate.moments) ? gate.moments : []);
    const approved = moments.filter(moment => moment.currentState === 'approved' || moment.status === 'approved' || moment.approved === true).length;
    const required = Number(gate.approvalRule?.requiredApprovedMoments || moments.length || 4);
    return { approved, required, ready: approved >= required };
}

function compileGrowthPulse(csvText) {
    const rows = parseCsv(csvText);
    const headerIndex = findHeaderRow(rows);
    const headers = rows[headerIndex].map(normalizedHeader);
    const sensitive = headers.filter(header => header === 'name' || sensitiveHeaderPattern.test(header));
    if (sensitive.length > 0) {
        fail(`export contains fields this report does not need: ${sensitive.join(', ')}`);
    }

    const dateIndex = findColumn(headers, ['date'], 'Date');
    const eventIndex = findColumn(headers, ['event name'], 'Event name');
    const countIndex = findColumn(headers, ['event count', 'count'], 'Event count');
    const pageIndex = findColumn(headers, ['page path and screen class', 'page path', 'source page'], 'Page path and screen class');

    const records = [];
    let ignoredRows = 0;
    rows.slice(headerIndex + 1).forEach((row, rowOffset) => {
        if (row.length === 1 && row[0].trim().startsWith('#')) return;
        const eventName = String(row[eventIndex] || '').trim();
        if (!eventName) return;
        if (!knownEvents.has(eventName)) {
            ignoredRows += 1;
            return;
        }
        try {
            records.push({
                date: normalizeDate(row[dateIndex]),
                eventName,
                route: normalizePath(row[pageIndex]),
                count: parseCount(row[countIndex])
            });
        } catch (error) {
            fail(`row ${headerIndex + rowOffset + 2}: ${error.message}`);
        }
    });
    if (records.length === 0) fail('no allowed public-site events were found');

    const dates = [...new Set(records.map(record => record.date))].sort();
    const firstDate = dates[0];
    const lastDate = dates[dates.length - 1];
    const spanDays = Math.round((Date.parse(`${lastDate}T00:00:00Z`) - Date.parse(`${firstDate}T00:00:00Z`)) / 86400000) + 1;
    if (spanDays > 7) fail(`the export spans ${spanDays} days; use one seven-day period so weekly comparisons remain honest`);

    const pages = new Map();
    const totals = { pageViews: 0, playSelections: 0, shares: 0 };
    records.forEach(record => {
        if (!pages.has(record.route)) pages.set(record.route, { pageViews: 0, playSelections: 0, shares: 0 });
        const page = pages.get(record.route);
        if (record.eventName === 'page_view') {
            totals.pageViews += record.count;
            page.pageViews += record.count;
        } else if (record.eventName === 'play_selected') {
            totals.playSelections += record.count;
            page.playSelections += record.count;
        } else {
            totals.shares += record.count;
            page.shares += record.count;
        }
    });

    const playRate = percent(totals.playSelections, totals.pageViews);
    const shareRate = percent(totals.shares, totals.pageViews);
    let decision;
    if (totals.pageViews === 0) {
        decision = 'No public-page visits were present, so this file cannot support a growth decision. Check the export and consented page-view setup.';
    } else if (totals.pageViews < 50) {
        decision = 'Reach is still too small to judge the website. Put Mythical Void on one high-intent game shelf, then collect another full week before changing the message.';
    } else if (playRate < 8) {
        decision = 'People are arriving but too few are choosing Play. Improve the first-screen proof and Play invitation before sending more traffic.';
    } else if (totals.playSelections < 10) {
        decision = 'The Play signal is promising but still small. Keep the page stable and focus on one additional relevant source of visitors.';
    } else {
        decision = 'The public pages are producing meaningful Play intent. Protect the strongest page and focus next on proving successful game starts and first-hatch completion.';
    }

    const pageRows = [...pages.entries()]
        .map(([route, values]) => ({ route, ...values, playRate: percent(values.playSelections, values.pageViews) }))
        .filter(page => page.pageViews || page.playSelections || page.shares)
        .sort((left, right) => right.pageViews - left.pageViews || right.playSelections - left.playSelections || left.route.localeCompare(right.route));

    return {
        schemaVersion: 1,
        reportingLanguage: 'events_and_attempts_not_people',
        period: { firstDate, lastDate, spanDays },
        totals: { ...totals, playRate, shareRate },
        pages: pageRows,
        ignoredRows,
        visualGate: readVisualGate(),
        decision
    };
}

function renderMarkdown(pulse) {
    const lines = [
        `# Mythical Growth Pulse — ${pulse.period.lastDate}`,
        '',
        `**Period:** ${pulse.period.firstDate} to ${pulse.period.lastDate}  `,
        '**Counting language:** Events and attempts, not unique people',
        '',
        '## What happened',
        '',
        `- Public-page views: **${pulse.totals.pageViews}**`,
        `- Play selections: **${pulse.totals.playSelections}**`,
        `- Play-selection rate: **${formatPercent(pulse.totals.playRate)}**`,
        `- Completed shares or copied links: **${pulse.totals.shares}**`,
        `- Share-action rate: **${formatPercent(pulse.totals.shareRate)}**`,
        '',
        '## Page contribution',
        '',
        '| Public page | Views | Play selections | Play rate | Share actions |',
        '| --- | ---: | ---: | ---: | ---: |'
    ];
    pulse.pages.forEach(page => {
        lines.push(`| ${cell(page.route)} | ${page.pageViews} | ${page.playSelections} | ${formatPercent(page.playRate)} | ${page.shares} |`);
    });
    lines.push(
        '',
        '## Recommended next move',
        '',
        pulse.decision,
        '',
        '## Truth and safety checks',
        '',
        `- Authentic visual launch gate: **${pulse.visualGate.approved}/${pulse.visualGate.required} approved**${pulse.visualGate.ready ? ' — ready' : ' — keep public visual expansion closed'}.`,
        `- Ignored rows outside the small event allowlist: **${pulse.ignoredRows}**.`,
        '- This report does not claim unique visitors, individual journeys, retention or player identity.',
        '- It accepts only a seven-day aggregate export and rejects personal, device, location, full-address and query fields.',
        '- It does not publish, message anyone, spend money or change a live channel.',
        ''
    );
    return lines.join('\n');
}

function parseArguments(argv) {
    const result = { input: null, output: null, jsonOutput: null };
    for (let index = 0; index < argv.length; index += 1) {
        const argument = argv[index];
        if (argument === '--output') result.output = argv[++index];
        else if (argument === '--json-output') result.jsonOutput = argv[++index];
        else if (!result.input) result.input = argument;
        else fail(`unexpected argument: ${argument}`);
    }
    if (!result.input) fail('usage: npm run growth:pulse -- <ga4-export.csv> [--output report.md] [--json-output report.json]');
    return result;
}

function main() {
    try {
        const options = parseArguments(process.argv.slice(2));
        const inputPath = path.resolve(options.input);
        const pulse = compileGrowthPulse(fs.readFileSync(inputPath, 'utf8'));
        const markdown = renderMarkdown(pulse);
        if (options.output) {
            const outputPath = path.resolve(options.output);
            fs.mkdirSync(path.dirname(outputPath), { recursive: true });
            fs.writeFileSync(outputPath, `${markdown}\n`);
        } else {
            process.stdout.write(`${markdown}\n`);
        }
        if (options.jsonOutput) {
            const jsonPath = path.resolve(options.jsonOutput);
            fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
            fs.writeFileSync(jsonPath, `${JSON.stringify(pulse, null, 2)}\n`);
        }
    } catch (error) {
        console.error(`Growth pulse compilation failed: ${error.message}`);
        process.exit(1);
    }
}

if (require.main === module) main();

module.exports = { compileGrowthPulse, parseCsv, renderMarkdown };
