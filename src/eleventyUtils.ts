import { execSync, fork } from "child_process";
import { existsSync, constants } from "fs";
import { readFile, rm, access, readdir } from "fs/promises";
import { join } from "path";
import { cwd } from "process";
import debug from "./debug";
import ScenarioOutput from "./ScenarioOutput";

export async function determineInstalledEleventyVersions(projectRoot: string=cwd()) {
    const eleventyPkgsDir = join(projectRoot, "node_modules/@11ty/")
    const versions: {[key:string]: string} = {};

    debug("Determining installed Eleventy versions in " + eleventyPkgsDir)
    
    if (existsSync(eleventyPkgsDir)) {
        let eleventyPkgs = await readdir(eleventyPkgsDir);
        debug(`Found the followintg installed packages from @11ty: ${eleventyPkgs}`);
        const eleventyRegex = new RegExp(/eleventy(\d|$)/m)
        eleventyPkgs = eleventyPkgs.filter(name => eleventyRegex.test(name))

        debug(`Filtered non-main-eleventy packages. Results: ${eleventyPkgs}`)

        for (let i=0; i < eleventyPkgs.length; i++) {
            const eleventyPkg = eleventyPkgs[i];
            const eleventyPkgDir = join(projectRoot, "node_modules/@11ty/", eleventyPkg)
            const version = JSON.parse(
                await readFile(
                    join(eleventyPkgDir, "package.json"), 
                    {encoding: "utf-8"}
                )).version;
                versions[version] = eleventyPkgDir;
                debug(`Found ${version} at ${eleventyPkgDir}`)
        }
    }
    return versions;
}

async function installEleventyIfPkgManagerFound(eleventyVersion: string, projectRoot: string, filename:string, command: string){
    debug(`Attempting to find a package manager to install Eleventy ${eleventyVersion} with`)
    return new Promise(async (resolve, reject) => {
        if (existsSync(join(projectRoot, filename))) {
            try {
                debug("Running Eleventy " + eleventyVersion)
                execSync(`${command} @11ty/eleventy${eleventyVersion}@npm:@11ty/eleventy@${eleventyVersion}`, {cwd:projectRoot});
                debug("Done running Eleventy " + eleventyVersion)
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
    debug(`Ensuring Eleventy ${eleventyVersion} exists`)
    return new Promise(async (resolve, reject) => {
        const versions = await determineInstalledEleventyVersions(projectRoot)
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
    debug("Running buildEleventy", "scenarioDir: " + scenarioDir, "Eleventy version: " + eleventyVersion)
    return new Promise(async (resolve, reject)=> {
        debug("Finding package for Eleventy " + eleventyVersion);
        const eleventyDir = await ensureEleventyExists(projectRoot, eleventyVersion);
        debug("Found pacakge for Eleventy " + eleventyVersion);

        const bin = JSON.parse(
            await readFile(
                join(eleventyDir, "package.json"),
                {encoding: "utf-8"}
            )).bin.eleventy;
        const pathToBin = join(eleventyDir, bin);
        debug(`Found entrypoint for Eleventy ${eleventyVersion} at ${pathToBin}`)
        
        const scenarioInputDir = join(scenarioDir, "input");
        let inputDir: string|undefined;
        debug(`Checking whether to use scenario (${scenarioInputDir}) or global input (${globalInputDir})...`)
        if (existsSync(scenarioInputDir)) {
            debug("Using scenario input")
            inputDir = scenarioInputDir;
        } else if (existsSync(globalInputDir)) {
            debug("Using global input dir")
            inputDir = globalInputDir;
        }
        debug("inputDir: " + inputDir)
        if (inputDir == undefined) {
            throw new Error("inputDir is undefined! Either create a global input dir or one for the scenario specifically")
        }

        const outputDir = join(scenarioDir, "eleventy-test-out")
        debug("Cleaning old test output");
        await rm(outputDir, {force: true, recursive: true})
        debug("Cleaned");

        try {
            debug("Creating Eleventy process...")
            const out = fork(
                pathToBin, 
                ["--input", inputDir, "--output", outputDir ], 
            {cwd: scenarioDir})
            out.on("message", (msg) => {
                console.log(msg)
            })

            out.on("close", async (code) => {
                debug(`Eleventy ${eleventyVersion}/${scenarioName} finished`)
                resolve(new ScenarioOutput(outputDir, scenarioName));
            });
        } catch (e) {
            throw e;
        }
    })
}
