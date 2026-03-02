import test from "ava";
import { _exists } from "../dist/index.js";

test("_exists returns true for existing files, false for non-existing, and throws on bad input", async t => {
    t.true(await _exists("package.json"))
    t.false(await _exists("non-existing-file.json"))
    await t.throwsAsync(_exists(2), {
        instanceOf: TypeError
    });
});
