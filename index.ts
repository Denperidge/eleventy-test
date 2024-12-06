import {cwd} from "process";
import {join} from "path";
import { readFileSync, rmSync, readdirSync, existsSync } from "fs";
import {execSync, fork} from "child_process";
const DIR_BASE = "tests";
const DIR_SCENARIOS = join(DIR_BASE, "scenarios");
const DIR_TESTS = join(DIR_BASE, "tests");
const DIR_INPUT = join(DIR_BASE, "input");


function buildEleventy(eleventyVersion, scenarioDir, projectRoot=cwd(), generalInputDir, hashTruncate=16, runAsync=true, useServe=false) {
    return new Promise((resolve, reject)=> {

        // I tried using Eleventy programmatically. Emphasis on tried
        // Thanks to https://github.com/actions/setup-node/issues/224#issuecomment-943531791

        const eleventyDir=join(projectRoot, "node_modules/@11ty/", eleventyVersion);
        const bin = JSON.parse(
            readFileSync(
                join(eleventyDir, "package.json"),
                {encoding: "utf-8"})
            ).bin.eleventy;
        const pathToBin = join(eleventyDir, bin);
        
        const scenarioInputDir = join(projectRoot, scenarioDir, "input");
        console.log(scenarioInputDir)
        const inputDir = existsSync(scenarioInputDir) ? scenarioInputDir : generalInputDir;
        if (inputDir == undefined) {
            throw Error("inputDir is undefined!")
        }
        const outputDir = join(scenarioDir, "eleventy-test-out")

        try {
            console.log(inputDir)
            //const command = useServe ? `timeout 5 node ${pathToBin} --serve` : `node ${pathToBin}`
            const out = fork(pathToBin, ["--input", inputDir, "--output", outputDir ], {cwd: scenarioDir})
            out.on("message", (msg) => {
                console.log(msg)
            })

            out.on("close", (code) => {
                console.log("Code: " + code);
                resolve(code);
            });
            
            //const out = execFile("node", ["--version"], {cwd: scenarioDir, encoding: "utf-8"});
        // console.log(out)
        } catch (e) {
            if (!useServe) {
                throw e;
            }
        }
    })

}



function main(projectRoot=cwd()) {
    const scenarios = readdirSync(DIR_SCENARIOS);

    let generalInputDir = existsSync(join(projectRoot, DIR_INPUT)) ? join(projectRoot, DIR_INPUT) : undefined;

    scenarios.forEach(dirname => {
        const scenarioDir = join(cwd(), DIR_SCENARIOS, dirname)
        buildEleventy("eleventy3", scenarioDir, cwd(), generalInputDir)
    })
    return;
    buildEleventy("eleventy2", "")
    buildEleventy("eleventy1", "")
}

main();