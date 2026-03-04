import test from "ava";
import { _exists, _cache, _cacheWrite } from "../dist/index.js";
import { readFile, rm, writeFile } from "fs/promises";

const CACHE_DIR = "tests/eleventy-test-out/";
const TEST_JSON_TARGET = CACHE_DIR + "test.json";

async function ensureNotExisting(t, existsPath, removePath=undefined) {
    if (removePath == undefined) {
        removePath = existsPath;
    }
    if (await _exists(existsPath)) {
        await rm(removePath, {recursive: true});
    }
    t.false(await _exists(existsPath));
}

test("_exists returns true for existing files, false for non-existing, and throws on bad input", async t => {
    t.true(await _exists("package.json"))
    t.false(await _exists("non-existing-file.json"))
    await t.throwsAsync(_exists(2), {
        instanceOf: TypeError
    });
});

test.serial("_cacheWrite writes an object or array to a json file correctly, creating a directory & file when needed", async t => {
    const testData = [
        ["piece of text!", 5],
        {"key": "value"},
    ];

    // TODO: proper async test

    for (let i=0; i < 2; i++) {
        // Make sure cache doesn't already exist
        await ensureNotExisting(t, TEST_JSON_TARGET, CACHE_DIR);

        // The cache folder & file exist after writing
        await _cacheWrite(testData[i], TEST_JSON_TARGET);
        t.true(await _exists(TEST_JSON_TARGET))

        // Test written data
        const cache = JSON.parse(await readFile(TEST_JSON_TARGET, {encoding: "utf-8"}));
        const cacheDatetime = new Date(cache.datetime);
        // Cache datetime year sanity check
        t.true(cacheDatetime.getFullYear() >= 2026, `The cached datetime (${cacheDatetime}) is impossible (date before the creation of this cache function)`)

        // Cache datetime is before the current date
        t.true(cacheDatetime < Date.now());
        // Read data is the same as the written data
        t.deepEqual(cache.data, testData[i]);
    }
});

async function cacheExampledata() {
    return 20;
}

test.serial("_cache returns function output if it doesn't exist & writes to file", async t => {
    await ensureNotExisting(t, TEST_JSON_TARGET);

    const expectedData = await cacheExampledata();
    const cacheData = await _cache(cacheExampledata, TEST_JSON_TARGET);

    t.deepEqual(cacheData, expectedData);
    const writtenCache = JSON.parse(await readFile(TEST_JSON_TARGET, {encoding: "utf-8"}));
    t.deepEqual(writtenCache.data, expectedData);
});


test.serial("_cache does not return cache if it is outdated", async t => {
    // Make sure cache doesn't exist
    await ensureNotExisting(t, TEST_JSON_TARGET);

    // Create new cache
    const wrongData = "Random string that shouldn't be read";
    await _cacheWrite(wrongData, TEST_JSON_TARGET);
    
    // Read the cache
    const expiredCache = JSON.parse(await readFile(TEST_JSON_TARGET, {encoding: "utf-8"}));

    // Set date to yesterday: ms-s-h-d
    expiredCache.datetime -= 1000*60*60*24;

    // Re-write the cache
    await writeFile(TEST_JSON_TARGET, JSON.stringify(expiredCache), {encoding: "utf-8"});

    // Re-read cache
    const cacheReturn = await _cache(cacheExampledata, TEST_JSON_TARGET);
    const cacheWritten = JSON.parse(await readFile(TEST_JSON_TARGET, {encoding: "utf-8"})).data;

    // Check if the read data is different from the original wrong data 
    const expectedData = await cacheExampledata();
    t.is(cacheReturn, expectedData);
    t.not(cacheReturn, wrongData);  // Measure twice cut once?
    t.is(cacheWritten, expectedData);
    t.not(cacheWritten, wrongData);
});
