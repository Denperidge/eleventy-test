import { exec, fork } from "child_process";
import { readFile, rm, access } from "fs/promises";
import { join } from "path";
import { cwd } from "process";

import ScenarioOutput from "./ScenarioOutput";

async function installEleventyIfPkgManagerFound(eleventyVersion: string, projectRoot: string, filename:string, command: string){
    try {
        await access(join(projectRoot, filename))
        await exec(`${command} @11ty/eleventy${eleventyVersion}@npm:@11ty/eleventy@${eleventyVersion}`, {cwd:projectRoot})
        return true;
    } catch {
        console.error(`Couldn't install eleventy ${eleventyVersion} using ${command.split(" ")[0]}`);
        return false;
    }
}
export async function ensureEleventyExists(projectRoot: string, eleventyVersion: string) {
    const eleventyDir = join(projectRoot, "node_modules/@11ty/eleventy" + eleventyVersion)
    try {
        await access(eleventyDir);
        return eleventyDir;
    } catch {
        console.log(`Eleventy version ${eleventyVersion} could not be found. Installing...`)
        
        if (await installEleventyIfPkgManagerFound(
            eleventyVersion, projectRoot, "package-lock.json", "npm install --save-dev")
        ) {
            // Pass
        } else if (await installEleventyIfPkgManagerFound(
            eleventyVersion, projectRoot, "yarn.lock", "yarn add -D"
        )) {
            // Pass
        } else {
            throw new Error(`Error while installing eleventy${eleventyVersion}: Could not determine package manager`);
        }
        return eleventyDir;
    }
}


export async function buildEleventy({
    eleventyVersion,
    scenarioDir,
    scenarioName,
    projectRoot=cwd(),
    globalInputDir
}) : Promise<ScenarioOutput> {
    return new Promise(async (resolve, reject)=> {
        const eleventyDir = await ensureEleventyExists(projectRoot, eleventyVersion);

        const bin = JSON.parse(
            await readFile(
                join(eleventyDir, "package.json"),
                {encoding: "utf-8"}
            )).bin.eleventy;
        const pathToBin = join(eleventyDir, bin);
        
        const scenarioInputDir = join(scenarioDir, "input");
        let inputDir: string|undefined;
        try {
            await access(scenarioInputDir);
            inputDir = scenarioInputDir;
        } catch {
            try {
                await access(globalInputDir);
                inputDir = globalInputDir;
            } catch {
            }
        }
        if (inputDir == undefined) {
            throw Error("inputDir is undefined!")
        }

        const outputDir = join(scenarioDir, "eleventy-test-out")
        await rm(outputDir, {force: true, recursive: true})

        try {
            const out = fork(
                pathToBin, 
                ["--input", inputDir, "--output", outputDir ], 
            {cwd: scenarioDir})
            out.on("message", (msg) => {
                console.log(msg)
            })

            out.on("close", async (code) => {
                resolve(new ScenarioOutput(outputDir, scenarioName));
            });
        } catch (e) {
            throw e;
        }
    })
}
