import test from "ava";
import { _exists, _cacheRead, _cacheWrite } from "../dist/index.js";
import { readFile, rm } from "fs/promises";

test("_exists returns true for existing files, false for non-existing, and throws on bad input", async t => {
    t.true(await _exists("package.json"))
    t.false(await _exists("non-existing-file.json"))
    await t.throwsAsync(_exists(2), {
        instanceOf: TypeError
    });
});

test("_cacheWrite writes an object or array to a json file correctly, creating a directory & file when needed", async t => {
    const cacheDir = "tests/eleventy-test-out/";
    const testTarget = cacheDir + "test.json";
    const testData = [
        ["piece of text!", 5],
        {"key": "value"},
    ];

    // TODO: proper async test

    for (let i=0; i < 2; i++) {
        // Make sure cache doesn't already exist
        if (await _exists(testTarget)) {
            await rm(cacheDir, {recursive: true});
        }
        t.false(await _exists(cacheDir));

        // The cache folder & file exist after writing
        await _cacheWrite(testData[i], testTarget);
        t.true(await _exists(testTarget))

        // Test written data
        const cache = JSON.parse(await readFile(testTarget, {encoding: "utf-8"}));
        const cacheDatetime = new Date(cache.datetime);
        // Cache datetime year sanity check
        t.true(cacheDatetime.getFullYear() >= 2026, `The cached datetime (${cacheDatetime}) is impossible (date before the creation of this cache function)`)

        // Cache datetime is before the current date
        t.true(cacheDatetime < Date.now());
        // Read data is the same as the written data
        t.deepEqual(cache.data, testData[i]);
    }
});
