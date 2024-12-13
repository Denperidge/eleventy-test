import { cwd } from "process";
import { join, isAbsolute } from "path";
import { readdir, access } from "fs/promises";
import { get } from "https";

import ScenarioOutput from "./ScenarioOutput";
import { buildEleventy, determineInstalledEleventyVersions } from "./eleventyUtils";
import debug, { setDebug } from "./debug";
import { existsSync } from "fs";

export * from "./eleventyUtils";

let versions;  // Cache variable for determining latest eleventy versions

async function scenarioDirnameToEleventyVersion(scenarioDirname) : Promise<string> {
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

export async function buildScenarios(opts: IbuildScenariosArrayArgs): Promise<ScenarioOutput[]>;
export async function buildScenarios(opts: IbuildScenariosDictArgs): Promise<{[key:string]: ScenarioOutput}>;
export async function buildScenarios({projectRoot=cwd(),  returnArray=true, scenariosDir="tests/scenarios/", globalInputDir: passedGlobalInputDir="tests/input", enableDebug=false}) {
    setDebug(enableDebug);
    debug("If you can see this, debugging has been enabled. Starting buildScenarios")

    return new Promise(async (resolve, reject) => {
        scenariosDir = isAbsolute(scenariosDir) ? scenariosDir : join(projectRoot, scenariosDir);
        let globalInputDir = (isAbsolute(passedGlobalInputDir) ? passedGlobalInputDir : join(projectRoot, passedGlobalInputDir)) as string|undefined;
        // TODO: fix this extra variable stuff
        if (globalInputDir) {
            globalInputDir = existsSync(globalInputDir) ? globalInputDir : undefined;
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
                let scenarioEleventyVersion = await scenarioDirnameToEleventyVersion(scenarioDirname)
                
                debug("Determined Eleventy version: " + scenarioEleventyVersion)

                scenarioOutputs.push(await buildEleventy({
                    eleventyVersion: scenarioEleventyVersion,
                    scenarioName: scenarioDirname,
                    globalInputDir,
                    projectRoot,
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

if (require.main === module) {
    buildScenarios({
        projectRoot: cwd(),
        enableDebug: true
    });
}