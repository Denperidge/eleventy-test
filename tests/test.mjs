import test from "ava";
import { JSDOM } from "jsdom";
import { cwd } from "process";
import { buildScenarios } from "../dist/index.js";

const results = await buildScenarios(cwd(), false);

function getDom(input) {
    return new JSDOM(input).window.document;
}

test("When using the same version/config, the output looks identical (3--cjs-builds === 3--esm-builds)", t => {
    t.deepEqual(
        results["3--cjs-builds"].getFileContent("/index.html"), 
        results["3--esm-builds"].getFileContent("/index.html"));
});

test("Scenario-specific inputs are used where defined (2--own-input uses its own input)", t=> {
    const v2regularOutput = results[("2--builds")];
    const v2OwnInputOutput = results[("2--own-input")];

    const ownInputIndexContent = v2OwnInputOutput.getFileContent("/index.html");
    const ownInputSubdirContent = v2OwnInputOutput.getFileContent("/subdir/index.html");

    t.notDeepEqual(v2regularOutput.getFileContent("/index.html"), ownInputIndexContent)
    t.notDeepEqual(v2regularOutput.getFileContent("/subdir/index.html"), ownInputSubdirContent)

    const ownInputIndexDom = getDom(ownInputIndexContent);
    t.deepEqual(ownInputIndexDom.getElementById("text").textContent, "v2!");

    const ownInputSubdirDom = getDom(ownInputSubdirContent)
    t.deepEqual(ownInputSubdirDom.getElementById("paragraph").textContent, "v2!");
})

test("The specified Eleventy versions are used (found correct values for [meta name='generator' content='{{eleventy.generator}}']) ", t => {
    Object.entries(results).forEach(([scenarioTitle, scenarioOutput])=> {
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
                expectedGenerator = "Eleventy v3.0.0";
                break;
            default:
                throw Error("Could not determine Eleventy version")

        }

        const dom = getDom(scenarioOutput.getFileContent("/index.html"))
        const generator = dom.querySelector("meta[name='generator']").content;
        t.is(expectedGenerator, generator)
    })
})

test("The scenario-specific configuration files are reflected in scenario output (Correct title has been rendered from corresponding scenario .eleventy.js)", t => {
    Object.entries(results).forEach(([scenarioTitle, scenarioOutput])=> {
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

        const dom = getDom(scenarioOutput.getFileContent("/index.html"))
        const title = dom.querySelector("title").text;
        t.is(expecedTitle, title)
    })
});

test("Input subdirectories are rendered & returned in every scenarui", t => {
    Object.entries(results).forEach(([scenarioTitle, scenarioOutput])=> {
        const outputFilenames = Object.keys(scenarioOutput.files);
        t.true(outputFilenames.includes("/index.html"));
        t.truthy(scenarioOutput.getFileContent("/index.html"));
        t.not("", scenarioOutput.getFileContent("/index.html"));

        t.true(outputFilenames.includes("/subdir/index.html"))
        t.truthy(scenarioOutput.getFileContent("/subdir/index.html"));
        t.not("", scenarioOutput.getFileContent("/subdir/index.html"));
    })
})