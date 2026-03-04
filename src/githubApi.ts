import { readFile, writeFile, mkdir } from "fs/promises";
import { _exists } from "./eleventyUtils";
import { dirname } from "path";

export async function _cacheRead() {
    
}

export async function _cacheWrite(object: Object|Array<any>, filepath: string="tests/eleventy-test-out/cache.json") {
    const data = {
        "datetime": Date.now(),
        "data": object
    };

    const dir = dirname(filepath);
    if (!(await _exists(dir))) {
        await mkdir(dir, {recursive: true});
    }

    return writeFile(filepath, JSON.stringify(data));
    //JSON.stringify(object);
}