/**
 * Functions for internal Eleventy handling
 * - Determining installed Eleventy versions @see _determineInstalledEleventyVersions 
 * - Installing Eleventy versions @see _installEleventyIfPkgManagerFound
 * - The combination of the two funcs above @see _ensureEleventyExists
 * - Running Eleventy Build @see buildEleventy
 */
import { execSync, fork } from "child_process";
import { existsSync } from "fs";
import { readFile, rm, readdir } from "fs/promises";
import { join } from "path";
import { cwd } from "process";
import debug from "./debug";
import ScenarioOutput from "./ScenarioOutput";

export interface _IbuildEleventyArgs {
    eleventyVersion: string,
    projectRoot: string,
    globalInputDir?: string,
    scenarioDir: string,
    scenarioName: string
}

/**
 * 
 * @param projectRoot project root directory of which to check the node_modules/ dir
 * @returns promise for a dictionary in the style of {"3.0.0": "/path/to/@11ty/eleventy3.0.0"}
 */
export async function _determineInstalledEleventyVersions(projectRoot: string=cwd()) {
    const eleventyPkgsDir = join(projectRoot, "node_modules/@11ty/")
    const versions: {[key:string]: string} = {};

    debug("Determining installed Eleventy versions in " + eleventyPkgsDir)
    
    if (existsSync(eleventyPkgsDir)) {
        let eleventyPkgs = await readdir(eleventyPkgsDir);
        debug(`Found the following installed packages from @11ty: ${eleventyPkgs}`);
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

/**
 * 
 * @param eleventyVersion semantic version to look for (for example: "3", "3.1.2")
 * @param projectRoot project root directory
 * @param filename if filename exists, use install command below (for example: "package-lock.json", "yarn.lock")
 * @param command command to prefix to install eleventy (for example: "yarn add", "npm install")
 * @returns promise for false/true, depending on whether eleventy install was succesful
 */
async function _installEleventyIfPkgManagerFound(eleventyVersion: string, projectRoot: string, filename:string, command: string): Promise<boolean> {
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

/**
 * 
 * @param eleventyVersion semantic version to look for (for example "3", "3.0.0")
 * @param projectRoot project root directory
 * @returns promise for the install directory of specified eleventy version
 */
export async function _ensureEleventyExists(eleventyVersion: string, projectRoot: string) : Promise<string> {
    debug(`Ensuring Eleventy ${eleventyVersion} exists`)
    return new Promise(async (resolve, reject) => {
        const versions = await _determineInstalledEleventyVersions(projectRoot)
        if (Object.keys(versions).includes(eleventyVersion)) {
            resolve(versions[eleventyVersion]);
        } else {
            console.log(`Eleventy version ${eleventyVersion} could not be found. Installing...`)
            const eleventyDir = join(projectRoot, "node_modules/@11ty/eleventy" + eleventyVersion);
            if (await _installEleventyIfPkgManagerFound(
                eleventyVersion, projectRoot, "package-lock.json", "npm install --save-dev")
            ) {
                resolve(eleventyDir);
            } else if (await _installEleventyIfPkgManagerFound(
                eleventyVersion, projectRoot, "yarn.lock", "yarn add -D"
            )) {
                resolve(eleventyDir);
            } else {
                throw new Error(`Error while installing eleventy${eleventyVersion}: Could not determine package manager`);
            }
        }
    })
}

/**
 * **Note:** the below arguments need to be passed in an object. @see _IbuildEleventyArgs
 * 
 * @param eleventyVersion semantic version to look for (for example: "3", "3.1.2")
 * @param scenarioDir path towards directory that holds all test scenarios
 * @param scenarioName name of the test scenario to run
 * @param projectRoot project root directory
 * @param globalInputDir path to the input directory to be used if scenarios do not provide their own
 * 
 * @returns promise for the resulting @see ScenarioOutput
 */
export async function buildEleventy({
    eleventyVersion,
    projectRoot=cwd(),
    globalInputDir,
    scenarioDir,
    scenarioName
}: _IbuildEleventyArgs) : Promise<ScenarioOutput> {
    debug("Running buildEleventy", "scenarioDir: " + scenarioDir, "Eleventy version: " + eleventyVersion)
    return new Promise(async (resolve, reject)=> {
        debug("Finding package for Eleventy " + eleventyVersion);
        const eleventyDir = await _ensureEleventyExists(eleventyVersion, projectRoot);
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
        } else if (globalInputDir && existsSync(globalInputDir)) {
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
