const { DateTime, IANAZone } = require("luxon");

class TimezoneError extends Error {
    constructor(message, code, details = {}) {
        super(message);
        this.name = "TimezoneError";
        this.code = code;
        this.details = details;
    }
}

/**
 * Validates and converts local calendar date + time to canonical UTC using Luxon.
 * - Extracts offsets from DateTime objects returned by getPossibleOffsets().
 * - Validates clientOffsetMinutes against the extracted numeric offsets.
 * - Selects matching DateTime instance and converts that exact instant to UTC.
 * - Returns the selected local offset separately (does not read .offset after toUTC()).
 */
function resolveLocalToUtc({ dateStr, timeStr, timezone, clientOffsetMinutes = null, durationMinutes = 30 }) {
    // 1. Format validation
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        throw new TimezoneError("Date must be in YYYY-MM-DD format", "INVALID_DATE_FORMAT");
    }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(timeStr)) {
        throw new TimezoneError("Time must be in HH:mm 24-hour format", "INVALID_TIME_FORMAT");
    }

    // 2. Validate durationMinutes as a finite positive integer within clinical limits (5m to 480m)
    if (typeof durationMinutes !== "number" || !Number.isInteger(durationMinutes) || durationMinutes < 5 || durationMinutes > 480) {
        throw new TimezoneError("Duration must be an integer between 5 and 480 minutes", "INVALID_DURATION");
    }

    const [year, month, day] = dateStr.split("-").map(Number);
    const [hour, minute] = timeStr.split(":").map(Number);

    // 3. Scheduling range limit
    if (year < 2000 || year > 2100) {
        throw new TimezoneError("Scheduling year must be between 2000 and 2100", "YEAR_OUT_OF_RANGE");
    }

    // 4. Calendar date validation
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    if (day < 1 || day > daysInMonth) {
        throw new TimezoneError(`Invalid calendar date: ${dateStr}`, "NON_EXISTENT_CALENDAR_DATE");
    }

    // 5. IANA timezone validation
    if (!IANAZone.isValidZone(timezone)) {
        throw new TimezoneError(`Invalid IANA timezone: ${timezone}`, "INVALID_TIMEZONE");
    }

    // 6. Construct initial DateTime
    const dt = DateTime.fromObject({ year, month, day, hour, minute }, { zone: timezone });
    if (!dt.isValid) {
        throw new TimezoneError(`Invalid DateTime: ${dt.invalidReason}`, "INVALID_DATETIME");
    }

    // 7. Nonexistent local time check: Luxon normalizes gaps forward; verify components
    if (dt.year !== year || dt.month !== month || dt.day !== day || dt.hour !== hour || dt.minute !== minute) {
        throw new TimezoneError(
            `Local time ${dateStr} ${timeStr} does not exist in ${timezone} due to a daylight saving gap or calendar shift`,
            "NON_EXISTENT_LOCAL_TIME"
        );
    }

    // 8. Extract candidate DateTime objects from getPossibleOffsets()
    const possibleDateTimes = dt.getPossibleOffsets(); // Returns DateTime[]
    const numericOffsets = possibleDateTimes.map(item => item.offset).sort((a, b) => a - b);

    let selectedDt;
    let localOffsetMinutes;

    if (possibleDateTimes.length === 1) {
        // Unambiguous instant
        selectedDt = possibleDateTimes[0];
        localOffsetMinutes = selectedDt.offset;
    } else if (possibleDateTimes.length > 1) {
        // Ambiguous fold (e.g. DST fall-back)
        if (clientOffsetMinutes === null || clientOffsetMinutes === undefined) {
            throw new TimezoneError(
                `Local time ${dateStr} ${timeStr} is ambiguous in ${timezone}`,
                "AMBIGUOUS_LOCAL_TIME",
                { possibleOffsets: numericOffsets }
            );
        }

        const offsetNum = Number(clientOffsetMinutes);
        if (!Number.isInteger(offsetNum)) {
            throw new TimezoneError("Disambiguation offset must be an integer", "MALFORMED_OFFSET");
        }

        selectedDt = possibleDateTimes.find(item => item.offset === offsetNum);
        if (!selectedDt) {
            throw new TimezoneError(
                `Invalid offset ${offsetNum} for ambiguous time. Allowed: ${numericOffsets.join(", ")}`,
                "INVALID_DISAMBIGUATION_OFFSET",
                { possibleOffsets: numericOffsets }
            );
        }
        localOffsetMinutes = selectedDt.offset;
    } else {
        throw new TimezoneError("No valid UTC instant exists for this local time", "NON_EXISTENT_LOCAL_TIME");
    }

    // Convert exact instant to UTC
    const canonicalUtc = selectedDt.toUTC();

    return {
        startDateTime: canonicalUtc.toJSDate(),
        endDateTime: canonicalUtc.plus({ minutes: durationMinutes }).toJSDate(),
        canonicalUtcIso: canonicalUtc.toISO(),
        localOffsetMinutes // Preserved local offset (+330, -240, etc.)
    };
}

module.exports = { resolveLocalToUtc, TimezoneError };
