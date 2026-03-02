import test from "ava";
import { JSDOM } from "jsdom";
import { cwd } from "process";
import { buildScenarios, _exists } from "../dist/index.js";

function getDom(input) {
    return new JSDOM(input).window.document;
}

const results = await buildScenarios({
    projectRoot: cwd(),
    returnArray: false
});

test("_exists returns true for existing files, false for non-existing, and throws on bad input", async t => {
    t.true(await _exists("package.json"))
    t.false(await _exists("non-existing-file.json"))
    await t.throwsAsync(_exists(2), {
        instanceOf: TypeError
    });
});

test("When using the same version/config, the output looks identical (3--cjs-builds === 3--esm-builds)", async t => {
    t.deepEqual(
        await results["3--cjs-builds"].getFileContent("/index.html"), 
        await results["3.1.2--esm-builds"].getFileContent("/index.html")
    );
});

test("Scenario-specific inputs are used where defined (2--own-input uses its own input)", async t=> {
    const v2regularOutput = results[("2--builds")];
    const v2OwnInputOutput = results[("2--own-input")];

    const ownInputIndexContent = await v2OwnInputOutput.getFileContent("/index.html");
    const ownInputSubdirContent = await v2OwnInputOutput.getFileContent("/subdir/index.html");

    t.notDeepEqual(await v2regularOutput.getFileContent("/index.html"), ownInputIndexContent)
    t.notDeepEqual(await v2regularOutput.getFileContent("/subdir/index.html"), ownInputSubdirContent)

    const ownInputIndexDom = getDom(ownInputIndexContent);
    t.deepEqual(ownInputIndexDom.getElementById("text").textContent, "v2!");

    const ownInputSubdirDom = getDom(ownInputSubdirContent)
    t.deepEqual(ownInputSubdirDom.getElementById("paragraph").textContent, "v2!");
})

test("The specified Eleventy versions are used (found correct values for [meta name='generator' content='{{eleventy.generator}}']) ", async t => {
    // forEach doesn't await async callbacks, so assertions never ran before AVA finished the test.
    // This is why I had to change forEach to for
    for (const [scenarioTitle, scenarioOutput] of Object.entries(results)) {
        let expectedGenerator;
        switch(scenarioTitle[0]) {
            case "1":
                expectedGenerator = "Eleventy v1.0.2";
                break;
            case "2":
                if (scenarioTitle.includes("2.0.0")) {
                    expectedGenerator = "Eleventy v2.0.0";
                } else {
                    expectedGenerator = "Eleventy v2.0.1";
                }
                break;
            case "3":
                if (scenarioTitle.includes("3.0.0")) {
                    expectedGenerator = "Eleventy v3.0.0";
                } else {
                    expectedGenerator = "Eleventy v3.1.2";
                }
                break;
            default:
                throw Error("Could not determine Eleventy version")

        }

        const dom = getDom(await scenarioOutput.getFileContent("/index.html"))
        const generator = dom.querySelector("meta[name='generator']").content;
        t.is(expectedGenerator, generator)
    }
})

test("The scenario-specific configuration files are reflected in scenario output (Correct title has been rendered from corresponding scenario .eleventy.js)", async t => {
    for (const [scenarioTitle, scenarioOutput] of Object.entries(results)) {
        let expecedTitle;
        switch(scenarioTitle[0]) {
            case "1":
                expecedTitle = "v1!";
                break;
            case "2":
                expecedTitle = "v2!";
                break;
            case "3":
                expecedTitle = "v3!";
                break;
            default:
                throw Error("Could not determine Eleventy version")

        }

        const dom = getDom(await scenarioOutput.getFileContent("/index.html"))
        const title = dom.querySelector("title").text;
        t.is(expecedTitle, title)
    }
});

test("Input subdirectories are rendered & returned in every scenario", async t => {
    for (const [scenarioTitle, scenarioOutput] of Object.entries(results)) {
        const scenarioIndex = await scenarioOutput.getFileContent("/index.html");
        const scenarioSubdirIndex = await scenarioOutput.getFileContent("/subdir/index.html");
        
        t.true(scenarioOutput.filepaths.has("/index.html"));
        t.truthy(scenarioIndex);
        t.not("", scenarioIndex);

        t.true(scenarioOutput.filepaths.has("/subdir/index.html"))
        t.truthy(scenarioSubdirIndex);
        t.not("", scenarioSubdirIndex);
    }
})
