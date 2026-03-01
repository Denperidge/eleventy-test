/**
 * Entrypoint & highest-level functions
 * - Detecting needed eleventy versions for scenarios @see _scenarioDirnameToEleventyVersion
 * - Building all scenarios in a project @see buildScenarios
 * - Providing yarn start functionality
 */
import { join, isAbsolute } from "path";
import { cwd } from "process";
import { readdir } from "fs/promises";
import { get } from "https";

import ScenarioOutput from "./ScenarioOutput";
import { buildEleventy, _determineInstalledEleventyVersions } from "./eleventyUtils";
import debug, { setDebug } from "./debug";

export * from "./eleventyUtils";

export interface IgitHubApiTags {
    name: string,
    zipball_url: string,
    tarball_url: string,
    node_id: string,
    commit: {
        sha: string,
        url: string
    }
}

let versions: Array<IgitHubApiTags>;  // Cache variable for determining latest eleventy versions

/**
 * 
 * @param scenarioDirname directory name from the scenario
 * @returns promise for a string of the extracted eleventy version; even if only a major number is provided
 */
async function _scenarioDirnameToEleventyVersion(scenarioDirname: string) : Promise<string> {
    // Parse {eleventyVersion}--{label}/ vs {eleventyVersion}/ 
    let eleventyVersion = scenarioDirname.includes("--") ? scenarioDirname.split("--")[0] : scenarioDirname;

    debug(`eleventyVersion from dirname: ${eleventyVersion}`);

    if (eleventyVersion.length < 5) {
        debug("eleventyVersion length is under 5, and as such not a full semantic version. Determining latest...")
        const scenarioMajorVersion = scenarioDirname[0];
        if (versions == undefined) {
            
            debug("Pulling Eleventy tags...")
            versions = await new Promise((resolve, reject)=> {
                get({
                    
                    hostname: "api.github.com",
                    path: "/repos/11ty/eleventy/tags",
                    headers: {
                        "User-Agent": "Mozilla/5.0"
                    }
                }, (res)=> {
                    let data: Buffer[] = [];
                    res.on("data", chunk => {
                        data.push(chunk);
                    }).on("end", () => {
                        debug("Parsing Eleventy tags API response...")
                        resolve(
                            JSON.parse(
                                Buffer.concat(data).toString("utf-8")
                            )
                        )
                    }).on("error", (err) => {
                        throw err;
                    })
                });
            });
        }
        for (let i=0; i < versions.length; i++) {
            const version = versions[i];
            debug("Checking " + version);
            // When auto-selecting, choose a non-alpha/canary build
            if (!version.name.includes("-") && version.name[1] == scenarioMajorVersion) {
                eleventyVersion = version.name.substring(1);
                debug("Determined latest of relevant major version for: " + eleventyVersion)
                break;
            }
        }
    }
    return eleventyVersion;
}

interface IbuildScenariosArgs {
    projectRoot: string,
    returnArray?: boolean,
    scenariosDir?: string,
    globalInputDir?: string,
    enableDebug?: boolean
}
interface IbuildScenariosArrayArgs extends IbuildScenariosArgs {
    returnArray?: true,
}
interface IbuildScenariosDictArgs extends IbuildScenariosArgs {
    returnArray?: false,
}

/**
 * **Note:** the below arguments need to be passed in an object. @see IbuildScenariosArgs
 * @param projectRoot project root directory
 * @param returnArray if set to true, return array
 * @param scenariosDir path to directory that holds all scenarios 
 * @param globalInputDir path to the input directory to be used if scenarios do not provide their own
 * @param enableDebug enable debug logging if true
 * 
 * @returns (if returnArray=true) return scenario outputs as array
 * @returns (if returnArray=false) return scenario outputs in a dict, using scenario names as key
 */
export async function buildScenarios(opts: IbuildScenariosArrayArgs): Promise<ScenarioOutput[]>;
export async function buildScenarios(opts: IbuildScenariosDictArgs): Promise<{[key:string]: ScenarioOutput}>;
export async function buildScenarios({projectRoot=cwd(), returnArray=true, scenariosDir="tests/scenarios/", globalInputDir="tests/input", enableDebug=false}) {
    setDebug(enableDebug);
    debug("If you can see this, debugging has been enabled. Starting buildScenarios")

    return new Promise(async (resolve, reject) => {
        scenariosDir = isAbsolute(scenariosDir) ? scenariosDir : join(projectRoot, scenariosDir);
        // if globalInputDir is passed
        if (globalInputDir) {
            // Turn it into an absolute path
            globalInputDir = isAbsolute(globalInputDir) ? globalInputDir : join(projectRoot, globalInputDir);
        }
        debug(`scenariosDir: ${scenariosDir}`, `globalInputDir: ${globalInputDir}`)

        try {
            const scenarioDirs = await readdir(scenariosDir, {recursive: false, encoding: "utf-8"});            
            const scenarioOutputs: ScenarioOutput[] = [];

            debug(`Found scenario dirs: ${scenarioDirs}`)
        
            for (let i=0 ; i < scenarioDirs.length; i++) {
                const scenarioDirname = scenarioDirs[i]
                const scenarioDir = join(scenariosDir, scenarioDirname)
                debug("Parsing Eleventy version of scenario " + scenarioDirname);
                let scenarioEleventyVersion = await _scenarioDirnameToEleventyVersion(scenarioDirname)
                
                debug("Determined Eleventy version: " + scenarioEleventyVersion)

                scenarioOutputs.push(await buildEleventy({
                    eleventyVersion: scenarioEleventyVersion,
                    projectRoot,
                    globalInputDir,
                    scenarioName: scenarioDirname,
                    scenarioDir,
                }))
            }
            if (returnArray) {
                debug("Returning as array...")
                resolve(scenarioOutputs)
            } else {
                debug("Returning as object...")
                const returnDict: {[key: string]: ScenarioOutput} = {};
                scenarioOutputs.forEach((scenarioOutput) => {
                    returnDict[scenarioOutput.title] = scenarioOutput;
                });
                resolve(returnDict)
            }

        } catch (e) {
            throw e;
        }
    });
}

// If run directly using yarn start
if (require.main === module) {
    buildScenarios({
        projectRoot: cwd(),
        enableDebug: true
    });
}