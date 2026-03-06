/**
 * Functions for internal Eleventy handling & async exists
 * - Checking if a file exists asynchronously @see _exists
 * - Determining installed Eleventy versions @see _determineInstalledEleventyVersions 
 * - Installing Eleventy versions @see _installEleventyIfPkgManagerFound
 * - The combination of the two funcs above @see _ensureEleventyExists
 * - Detecting needed eleventy versions for scenarios @see _dirnameToEleventyVersion
 * - Running Eleventy Build @see buildEleventy
 */
import { execSync, fork } from "child_process";
import { readFile, rm, readdir, stat } from "fs/promises";
import { join } from "path";
import { cwd } from "process";

import { debug } from "./debug";
import { ScenarioOutput } from "./ScenarioOutput";
import { _cache, _getReleasedEleventyVersions, IgitHubApiTags } from "./githubApi";

interface ErrorWithCode extends Error {
    code?: string;
}

/**
 * Asynchronously check if passed filepath exists
 * 
 * @param filepath filepath to check
 * @returns true if file exists, false if it doesn't
 * @throws any non-ENOENT errors from fsPromises.stat
 */
export async function _exists(filepath: string) : Promise<Boolean> {
    return new Promise((resolve, reject) => {
        stat(filepath)
            .then(stats => {
                resolve(true)
            })
            .catch((err: ErrorWithCode) => {
                if (err.code && err.code == "ENOENT") {
                    resolve(false);
                } else {
                    reject(err);
                }
            })
    });
}

/**
 * 
 * @param projectRoot project root directory of which to check the node_modules/ dir. 
 * @default process.cwd()
 * @returns promise for a dictionary in the style of {"3.0.0": "/path/to/@11ty/eleventy3.0.0"}
 */
export async function _determineInstalledEleventyVersions(projectRoot: string=cwd()) {
    const eleventyPkgsDir = join(projectRoot, "node_modules/@11ty/")
    const versions: {[key:string]: string} = {};

    debug("Determining installed Eleventy versions in " + eleventyPkgsDir)

    if (await _exists(eleventyPkgsDir)) {
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
 * Return first/latest version using the major version
 * 
 * @param majorVersion major version to lookup (example: 2) 
 * @param allVersions array including all Eleventy versions
 * @returns latest semantic Eleventy version that is not an alpha/beta (example: 2.0.1)
 * @throws {Error} if no major versions can be found
 * @see _getReleasedEleventyVersions
 * @see IgitHubApiTags 
*/
export function _majorToSemanticEleventyVersion(majorVersion: string, allVersions: Array<IgitHubApiTags>): string {
    for (let i=0; i < allVersions.length; i++) {
        const version = allVersions[i];
        debug("Checking " + version);
        // When auto-selecting, choose a non-alpha/canary build
        if (!version.name.includes("-") && version.name[1] == majorVersion) {
            const eleventyVersion = version.name.substring(1);
            debug("Determined latest of relevant major version for: " + eleventyVersion)
            return eleventyVersion;
        }
    }
    throw new Error("Couldn't determine Eleventy version from " + majorVersion);
}

/**
 * 
 * @param scenarioDirname directory name from the scenario
 * @returns promise for a string of the extracted eleventy version; even if only a major number is provided
 */
export async function _dirnameToEleventyVersion(scenarioDirname: string) : Promise<string> {
    // Parse {eleventyVersion}/ vs {label}@{eleventyVersion}/
    let eleventyVersion = scenarioDirname.includes("@") ? scenarioDirname.substring(scenarioDirname.lastIndexOf("@") + 1) : scenarioDirname;
    debug(`eleventyVersion from dirname: ${eleventyVersion}`);

    const versions: Array<IgitHubApiTags> = await _cache(_getReleasedEleventyVersions);

    if (eleventyVersion.length < 5) {
        debug("eleventyVersion length is under 5, and as such not a full semantic version. Determining latest...")
        eleventyVersion = _majorToSemanticEleventyVersion(eleventyVersion[0], versions);
    }
    return eleventyVersion;
}


/**
 * 
 * @param eleventyVersion semantic version to look for (for example: "3", "3.1.2")
 * @param projectRoot project root directory
 * @default process.cwd()
 * 
 * @param filename if filename exists, use install command below (for example: "package-lock.json", "yarn.lock")
 * @param command command to prefix to install eleventy (for example: "yarn add", "npm install")
 * @returns promise for false/true, depending on whether eleventy install was succesful
 */
export async function _installEleventyIfPkgManagerFound(eleventyVersion: string, projectRoot: string=cwd(), filename:string, command: string): Promise<boolean> {
    debug(`Attempting to find a package manager to install Eleventy ${eleventyVersion} with`)
    return new Promise(async (resolve, reject) => {
        if (await _exists(join(projectRoot, filename))) {
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
 * @default process.cwd()
 * @returns promise for the install directory of specified eleventy version
 */
export async function _ensureEleventyExists(eleventyVersion: string, projectRoot: string = cwd()): Promise<string> {
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

interface IbuildEleventyArgs {
    projectRoot?: string,
    globalInputDir?: string,
    scenarioDir: string,
    scenarioName: string
}

/**
 * **Note:** the arguments below need to be passed in an object. @see IbuildEleventyArgs
 * 
 * @param scenarioDir path towards directory that holds all test scenarios
 * @param scenarioName name of the test scenario to run
 * @param projectRoot project root directory
 * @default process.cwd()
 * @param globalInputDir path to the input directory to be used if scenarios do not provide their own
 * 
 * @returns promise for the resulting @see ScenarioOutput
 */
export async function buildEleventy({
    projectRoot=cwd(),
    globalInputDir,
    scenarioDir,
    scenarioName
}: IbuildEleventyArgs) : Promise<ScenarioOutput> {
    debug("Parsing Eleventy version of scenario " + scenarioDir);
    let eleventyVersion = await _dirnameToEleventyVersion(scenarioName)

    debug("Running buildEleventy", "scenarioDir: " + scenarioDir, "Eleventy version: " + eleventyVersion)
    return new Promise(async (resolve, reject)=> {
        debug("Finding package for Eleventy " + eleventyVersion);
        const eleventyDir = await _ensureEleventyExists(eleventyVersion, projectRoot);
        debug("Found package for Eleventy " + eleventyVersion);

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
        if (await _exists(scenarioInputDir)) {
            debug("Using scenario input")
            inputDir = scenarioInputDir;
        } else if (globalInputDir && await _exists(globalInputDir)) {
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
                resolve(await ScenarioOutput.create(outputDir, scenarioName));
            });
        } catch (e) {
            throw e;
        }
    })
}
