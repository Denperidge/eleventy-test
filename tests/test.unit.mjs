import test from "ava";
import { _exists, _cache, _cacheWrite, _getReleasedEleventyVersions, _requestReleasedEleventyVersions, _majorToSemanticEleventyVersion, _dirnameToEleventyVersion } from "../dist/index.js";
import { readFile, rm, writeFile } from "fs/promises";

const CACHE_DIR = "tests/eleventy-test-out/";

function getJsonTarget(t, dir=CACHE_DIR) {
    return dir + `${t.title.replace(/[^a-zA-Z]/g, "")}.json`;
}

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

test("_cacheWrite writes an object or array to a json file correctly, creating a directory & file when needed", async t => {
    const seperateDir = CACHE_DIR + "subdir/";
    const testJsonTarget = getJsonTarget(t, seperateDir);
    const testData = [
        ["piece of text!", 5],
        {"key": "value"},
    ];

    for (let i=0; i < 2; i++) {
        // Make sure cache doesn't already exist
        await ensureNotExisting(t, testJsonTarget, seperateDir);

        // The cache folder & file exist after writing
        await _cacheWrite(testData[i], testJsonTarget);
        t.true(await _exists(testJsonTarget))

        // Test written data
        const cache = JSON.parse(await readFile(testJsonTarget, {encoding: "utf-8"}));
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

test("_cache returns function output if it doesn't exist & writes to file", async t => {
    const testJsonTarget = getJsonTarget(t);
    await ensureNotExisting(t, testJsonTarget);

    const expectedData = await cacheExampledata();
    const cacheData = await _cache(cacheExampledata, testJsonTarget);

    t.deepEqual(cacheData, expectedData);
    const writtenCache = JSON.parse(await readFile(testJsonTarget, {encoding: "utf-8"}));
    t.deepEqual(writtenCache.data, expectedData);
});


test("_cache does not return cache if it is outdated", async t => {
    const testJsonTarget = getJsonTarget(t);
    // Make sure cache doesn't exist
    await ensureNotExisting(t, testJsonTarget);

    // Create new cache
    const wrongData = "Random string that shouldn't be read";
    await _cacheWrite(wrongData, testJsonTarget);
    
    // Read the cache
    const expiredCache = JSON.parse(await readFile(testJsonTarget, {encoding: "utf-8"}));

    // Set date to yesterday: ms-s-h-d
    expiredCache.datetime -= 1000*60*60*24;

    // Re-write the cache
    await writeFile(testJsonTarget, JSON.stringify(expiredCache), {encoding: "utf-8"});

    // Re-read cache
    const cacheReturn = await _cache(cacheExampledata, testJsonTarget);
    const cacheWritten = JSON.parse(await readFile(testJsonTarget, {encoding: "utf-8"})).data;

    // Check if the read data is different from the original wrong data 
    const expectedData = await cacheExampledata();
    t.is(cacheReturn, expectedData);
    t.not(cacheReturn, wrongData);  // Measure twice cut once?
    t.is(cacheWritten, expectedData);
    t.not(cacheWritten, wrongData);
});

test("_requestReleasedEleventyVersions works as intended", async t => {
    const page1 = await _requestReleasedEleventyVersions(1);
    const page2 = await _requestReleasedEleventyVersions(2);
    t.true(page1.length == 100, `Wrong page length for page 1: ${page1.length} != 100`);
    t.true(page2.length == 100, `Wrong page length for page 2: ${page2.length} != 100`);
    t.notDeepEqual(page1, page2);
});

test("_getReleasedEleventyVersions works as intended", async t => {
    const data = await _getReleasedEleventyVersions();
    t.true(data.length >= 218, `Not enough Eleventy Versions have been found. Found ${data.length}, expected <= 218`)
});

const LATEST_ELEVENTY_3_VERSION = "3.1.2";
const LATEST_ELEVENTY_2_VERSION = "2.0.1";
const LATEST_ELEVENTY_1_VERSION = "1.0.2";
test("_majorToSemanticEleventyVersion works as expected", async t => {
    const versions = await _cache(_requestReleasedEleventyVersions);
    t.is(
        _majorToSemanticEleventyVersion("3", versions),
        LATEST_ELEVENTY_3_VERSION
    );
    t.is(
        _majorToSemanticEleventyVersion("2", versions),
        LATEST_ELEVENTY_2_VERSION
    );
    t.is(
        _majorToSemanticEleventyVersion("1", versions),
        LATEST_ELEVENTY_1_VERSION
    );
    t.throws(() => {_majorToSemanticEleventyVersion("0", versions)}, {
        instanceOf: Error,
        message: "Couldn't determine Eleventy version from 0"
    });
    t.throws(() => { _majorToSemanticEleventyVersion(3, [])}, {
        instanceOf: Error,
        message: "Couldn't determine Eleventy version from 3"
    });
});

// This test might be considered integration maybe?
test("_dirnameToEleventyVersion works as expected", async t => {
    const versions = await _cache(_getReleasedEleventyVersions);

    t.is(
        _dirnameToEleventyVersion("3@custom-label", versions),
        LATEST_ELEVENTY_3_VERSION,
        "_dirnameToEleventyVersion could not parse 3@custom-label"
    );
    t.is(
        _dirnameToEleventyVersion("3", versions),
        LATEST_ELEVENTY_3_VERSION,
        "_dirnameToEleventyVersion could not parse 3"
    );
    t.is(
        _dirnameToEleventyVersion("2.0.0-canary.8@label", versions),
        "2.0.0-canary.8",
        "_dirnameToEleventyVersion could not parse 2.0.0-canary.8@label"
    );
});