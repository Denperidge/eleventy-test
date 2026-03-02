/**
 * Functions for debug logging
 * - enable/disable debug logs: @see _setDebug
 * - log to console if debugging is enabled: @see debug
 */

let debugEnabled = false;

/**
 * @param enabled if true, enabled debug logging
 */
export function _setDebug(enabled: boolean) {
    debugEnabled = enabled;
}

/**
 * @param message If debug is enabled (@see setDebug), log messages to console
 */
export function debug(...message: Array<String>) {
    if (debugEnabled) {
        message.forEach(msg => console.log(msg))
    }
}