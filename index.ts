import {cwd} from "process";
import {join} from "path";
import { readFileSync, rmSync } from "fs";
import {exec} from "child_process";

const DIR_BASE = "tests";
const DIR_SCENARIOS = join(DIR_BASE, "scenarios");
const DIR_TESTS = join(DIR_BASE, "tests");

function buildEleventy(eleventyVersion, scenarioDir, hashTruncate=16, runAsync=true, useServe=false) {
	// I tried using Eleventy programmatically. Emphasis on tried
	// Thanks to https://github.com/actions/setup-node/issues/224#issuecomment-943531791

    const eleventyDir=`node_modules/@11ty/${eleventyVersion}/`;
    //const bin = JSON.parse()
    const bin = JSON.parse(readFileSync(join(eleventyDir, "package.json"), {encoding: "utf-8"})).bin
    console.log(bin)
    return;

	try {
		const command = useServe ? "timeout 2 npx @11ty/eleventy --serve" : "npx @11ty/eleventy"
		child_process.execSync(command, {cwd: scenarioDir});
	} catch (e) {
		if (!useServe) {
			throw e;
		}
	}
}



function main(directory=cwd()) {
    console.log("AAA")
    buildEleventy("eleventy3", "")
    buildEleventy("eleventy2", "")
    buildEleventy("eleventy1", "")
}

main();