import { execSync, fork } from "child_process";
import { existsSync } from "fs";
import { readFile, rm, access, readdir } from "fs/promises";
import { join } from "path";
import { cwd } from "process";

import ScenarioOutput from "./ScenarioOutput";

export async function determineInstalledEleventyVersions(projectRoot: string=cwd()) {
    let eleventyPkgs = await readdir(join(projectRoot, "node_modules/@11ty/"));
    const eleventyRegex = new RegExp(/eleventy(\d|$)/m)
    eleventyPkgs = eleventyPkgs.filter(name => eleventyRegex.test(name))

    const versions: {[key:string]: string} = {};
    for (let i=0; i < eleventyPkgs.length; i++) {
        const eleventyPkg = eleventyPkgs[i];
        const eleventyPkgDir = join(projectRoot, "node_modules/@11ty/", eleventyPkg)
        const version = JSON.parse(
            await readFile(
                join(eleventyPkgDir, "package.json"), 
                {encoding: "utf-8"}
            )).version;
            versions[version] = eleventyPkgDir
    }
    return versions;
}

async function installEleventyIfPkgManagerFound(eleventyVersion: string, projectRoot: string, filename:string, command: string){
    return new Promise(async (resolve, reject) => {
        if (existsSync(join(projectRoot, filename))) {
            try {
                execSync(`${command} @11ty/eleventy${eleventyVersion}@npm:@11ty/eleventy@${eleventyVersion}`, {cwd:projectRoot});
                resolve(true);
            }
            catch (e) {
                throw e;
            }
        } else {
            console.error(`Couldn't detect ${filename}, skipping ${command.split(" ")[0]}...`);
            resolve(false);
        }
    });
}
export async function ensureEleventyExists(projectRoot: string, eleventyVersion: string) : Promise<string> {
    return new Promise(async (resolve, reject) => {
        const versions = determineInstalledEleventyVersions(projectRoot)
        if (Object.keys(versions).includes(eleventyVersion)) {
            resolve(versions[eleventyVersion]);
        } else {
            console.log(`Eleventy version ${eleventyVersion} could not be found. Installing...`)
            const eleventyDir = join(projectRoot, "node_modules/@11ty/eleventy" + eleventyVersion);
            if (await installEleventyIfPkgManagerFound(
                eleventyVersion, projectRoot, "package-lock.json", "npm install --save-dev")
            ) {
                resolve(eleventyDir);
            } else if (await installEleventyIfPkgManagerFound(
                eleventyVersion, projectRoot, "yarn.lock", "yarn add -D"
            )) {
                resolve(eleventyDir);
            } else {
                throw new Error(`Error while installing eleventy${eleventyVersion}: Could not determine package manager`);
            }
            
        }
            

    })
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
