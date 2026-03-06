import { readFile, writeFile, mkdir } from "fs/promises";
import { _exists } from "./eleventyUtils";
import { dirname } from "path";
import { debug } from "./debug";
import { get } from "https";

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


export interface IgitHubApiTags {
    name: string,
    zipball_url: string,
    tarball_url: string,
    node_id: string,
    commit: {
        sha: string,
        url: string
    }
}


/**
 * 
 * @returns GitHub tag info. @see IgitHubApiTags
 */
export async function _requestReleasedEleventyVersions(page=1) : Promise<Array<IgitHubApiTags>> {
    debug("Pulling Eleventy tags...")
    return new Promise((resolve, reject) => {
        get({
            hostname: "api.github.com",
            path: `/repos/11ty/eleventy/tags?per_page=100&page=${page}`,
            headers: {
                "User-Agent": "Mozilla/5.0"
            }
        }, (res)=> {
            let data: Buffer[] = [];
            res.on("data", chunk => {
                data.push(chunk);
            }).on("end", async () => {
                debug("Parsing Eleventy tags API response...")
                let tags: Array<IgitHubApiTags> = JSON.parse(
                    Buffer.concat(data).toString("utf-8")
                )
                resolve(tags);
            }).on("error", (err) => {
                throw err;
            })
        });
    });
}

export async function _getReleasedEleventyVersions() : Promise<Array<IgitHubApiTags>> {
    return new Promise((resolve, reject) => {
        let page = 1;
        let out: Array<IgitHubApiTags> = [];
        const timer = setInterval(async () => {
            const req = await _requestReleasedEleventyVersions(page);
            page++;
            out = out.concat(req);
            if (req.length < 100) {
                clearInterval(timer);
                resolve(out);
            }
        }, 1500)

    })
}