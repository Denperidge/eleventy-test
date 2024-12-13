
let debugEnabled = false;

export function setDebug(enabled) {
    debugEnabled = enabled;
}


export default function debug(...message) {
    if (debugEnabled) {
        message.forEach(msg => console.log(msg))
    }
}