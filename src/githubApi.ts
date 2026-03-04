import { readFile, writeFile, mkdir } from "fs/promises";
import { _exists } from "./eleventyUtils";
import { dirname } from "path";

interface ICache {
    data: Object|Array<any>;
    datetime: number;
}

export const DEFAULT_CACHE_PATH = "tests/eleventy-test-out/cache.json";
/**
 * 
 * @param dataToSave variable you want to save in cache
 * @param filepath path to json file the cache should be written to
 * @default tests/eleventy-test-out/cache.json
 * @returns void promise
 */
export async function _cacheWrite(dataToSave: any, filepath: string=DEFAULT_CACHE_PATH) {
    const data: ICache = {
        "datetime": Date.now()-100,  // -100 to fix race condition for tests
        "data": dataToSave
    };
    
    const dir = dirname(filepath);
    if (!(await _exists(dir))) {
        await mkdir(dir, {recursive: true});
    }

    return writeFile(filepath, JSON.stringify(data));
}

/**
 * This function works like as follows:
 * - Check for an existing cache
 * - If the cache exists, check if its outdated (not from today)
 * - If it's not outdated, return cache data
 * - If the cache doesn't exist, run passed function async
 * - Store returned passed function data in cache & return data
 * 
 * @param fetchData async function to run to get new cache data
 * @param filepath path to cache json file
 * @returns promise for the cache data
 */
export async function _cache(fetchData: Function, filepath: string=DEFAULT_CACHE_PATH): Promise<any> {
    return new Promise(async (resolve, reject) => {
        // If cache exists
        if (await _exists(filepath)) {
            const cache: ICache = JSON.parse(await readFile(filepath, {encoding: "utf-8"}));
            const cacheDatetime = new Date(cache.datetime);
            const today = new Date();
            if (cacheDatetime.toDateString() == today.toDateString()) {
                resolve(cache.data);
                return;
            }
        }

        const cacheData = await fetchData();
        await _cacheWrite(cacheData, filepath);
        resolve(cacheData);
    });
}
