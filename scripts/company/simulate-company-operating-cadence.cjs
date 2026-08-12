#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const defaultPath = path.join(repositoryRoot, 'docs/company/automation/operating-cadence.json');
const cadencePath = process.argv[2] ? path.resolve(process.argv[2]) : defaultPath;

let cadence;
try { cadence = JSON.parse(fs.readFileSync(cadencePath, 'utf8')); }
catch (error) {
    console.error(`Operating cadence could not be read: ${error.message}`);
    process.exit(1);
}

const reference = cadence.referenceSimulation || {};
const start = new Date(`${reference.windowStartLocalDate}T00:00:00Z`);
const end = new Date(`${reference.windowEndExclusiveLocalDate}T00:00:00Z`);
const occurrences = [];

for (let cursor = new Date(start); cursor < end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const localDate = cursor.toISOString().slice(0, 10);
    const dayOfWeek = cursor.getUTCDay();
    for (const schedule of cadence.calendarSchedules || []) {
        if ((schedule.recurrence?.daysOfWeek || []).includes(dayOfWeek)) {
            occurrences.push({ scheduleId: schedule.id, workflowId: schedule.workflowId, localDate, localTime: schedule.recurrence.localTime });
        }
    }
}

const byDay = new Map();
for (const occurrence of occurrences) {
    const values = byDay.get(occurrence.localDate) || [];
    values.push(occurrence);
    byDay.set(occurrence.localDate, values);
}

let sameStartCollisionCount = 0;
let minimumObservedMinutesBetweenStartsOnSameDay = null;
for (const values of byDay.values()) {
    const starts = values.map(item => {
        const [hour, minute] = item.localTime.split(':').map(Number);
        return hour * 60 + minute;
    }).sort((a, b) => a - b);
    for (let index = 1; index < starts.length; index += 1) {
        const difference = starts[index] - starts[index - 1];
        if (difference === 0) sameStartCollisionCount += 1;
        if (minimumObservedMinutesBetweenStartsOnSameDay === null || difference < minimumObservedMinutesBetweenStartsOnSameDay) minimumObservedMinutesBetweenStartsOnSameDay = difference;
    }
}

const calendarDayCount = Math.round((end - start) / 86400000);
const maximumOccurrencesOnOneDay = Math.max(0, ...[...byDay.values()].map(values => values.length));
const resources = cadence.resourceEnvelope || {};
const simulation = {
    workflow: 'A-041-SIMULATION',
    mode: 'local calendar simulation only; no scheduler activation or execution',
    timezone: cadence.clockPolicy?.ianaTimezone,
    windowStartLocalDate: reference.windowStartLocalDate,
    windowEndExclusiveLocalDate: reference.windowEndExclusiveLocalDate,
    calendarDayCount,
    plannedOccurrenceCount: occurrences.length,
    maximumOccurrencesOnOneDay,
    sameStartCollisionCount,
    minimumObservedMinutesBetweenStartsOnSameDay,
    withinDailyRunLimit: maximumOccurrencesOnOneDay <= resources.maximumRunsPerDay,
    withinMonthlyRunLimit: occurrences.length <= resources.maximumPlannedExecutionsInAnyCalendarMonth,
    allSchedulesDisabled: (cadence.calendarSchedules || []).every(item => item.state === 'planned_disabled'),
    simulationActivatesSchedule: false,
    occurrences
};
simulation.simulationValid = Boolean(
    simulation.calendarDayCount === reference.calendarDayCount &&
    simulation.plannedOccurrenceCount === reference.plannedOccurrenceCount &&
    simulation.maximumOccurrencesOnOneDay === reference.maximumOccurrencesOnOneDay &&
    simulation.sameStartCollisionCount === reference.sameStartCollisionCount &&
    simulation.minimumObservedMinutesBetweenStartsOnSameDay === reference.minimumObservedMinutesBetweenStartsOnSameDay &&
    simulation.withinDailyRunLimit &&
    simulation.withinMonthlyRunLimit &&
    simulation.allSchedulesDisabled &&
    reference.simulationActivatesSchedule === false
);

console.log(JSON.stringify(simulation, null, 2));
process.exit(simulation.simulationValid ? 0 : 1);
