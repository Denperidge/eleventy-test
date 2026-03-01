let debugEnabled = false;

/**
 * @param enabled if true, enabled debug logging
 */
export function setDebug(enabled: boolean) {
    debugEnabled = enabled;
}

/**
 * @param message If debug is enabled (@see setDebug), log messages to console
 */
export default function debug(...message: Array<String>) {
    if (debugEnabled) {
        message.forEach(msg => console.log(msg))
    }
}