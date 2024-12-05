import {cwd} from "process";
import {join} from "path";
import { readFileSync, rmSync, readdirSync } from "fs";
import {execSync, fork} from "child_process";
const DIR_BASE = "tests";
const DIR_SCENARIOS = join(DIR_BASE, "scenarios");
const DIR_TESTS = join(DIR_BASE, "tests");

function buildEleventy(eleventyVersion, scenarioDir, projectRoot=cwd(), hashTruncate=16, runAsync=true, useServe=false) {
	// I tried using Eleventy programmatically. Emphasis on tried
	// Thanks to https://github.com/actions/setup-node/issues/224#issuecomment-943531791

    const eleventyDir=join(projectRoot, "node_modules/@11ty/", eleventyVersion);
    const bin = JSON.parse(
        readFileSync(
            join(eleventyDir, "package.json"),
            {encoding: "utf-8"})
        ).bin.eleventy;
    const pathToBin = join(eleventyDir, bin);
    console.log(pathToBin)

	try {
		const command = useServe ? `timeout 5 node ${pathToBin} --serve` : `node ${pathToBin}`
		const out = fork(pathToBin, {cwd: scenarioDir}).stdout
        
        //const out = execFile("node", ["--version"], {cwd: scenarioDir, encoding: "utf-8"});
        console.log(out)
	} catch (e) {
		if (!useServe) {
			throw e;
		}
	}
}



function main(directory=cwd()) {
    const scenarios = readdirSync(DIR_SCENARIOS);
    scenarios.forEach(dirname => {
        console.log(dirname)
        const scenarioDir = join(DIR_SCENARIOS, dirname)
        buildEleventy("eleventy3", scenarioDir, cwd())
    })
    return;
    buildEleventy("eleventy2", "")
    buildEleventy("eleventy1", "")
}

main();