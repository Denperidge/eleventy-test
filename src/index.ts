import { cwd } from "process";
import { join, isAbsolute } from "path";
import { readdir, access } from "fs/promises";
import { get } from "https";

import ScenarioOutput from "./ScenarioOutput";
import { buildEleventy, determineInstalledEleventyVersions } from "./eleventyUtils";

export * from "./eleventyUtils";

let versions;  // Cache variable for determining latest eleventy versions

async function scenarioDirnameToEleventyVersion(scenarioDirname) : Promise<string> {
    // Parse {eleventyVersion}--{label}/ vs {eleventyVersion}/ 
    let eleventyVersion = scenarioDirname.includes("--") ? scenarioDirname.split("--")[0] : scenarioDirname;

    if (eleventyVersion.length < 5) {
        const scenarioMajorVersion = scenarioDirname[0];
        if (versions == undefined) {
            console.log("Pulling Eleventy tags...")
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
                        console.log("Parsing API response...")
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
            // When auto-selecting, choose a non-alpha/canary build
            if (!version.name.includes("-") && version.name[1] == scenarioMajorVersion) {
                eleventyVersion = version.name.substring(1);
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
    globalInputDir?: string
}
interface IbuildScenariosArrayArgs extends IbuildScenariosArgs {
    returnArray?: true,
}
interface IbuildScenariosDictArgs extends IbuildScenariosArgs {
    returnArray?: false,
}

export async function buildScenarios(opts: IbuildScenariosArrayArgs): Promise<ScenarioOutput[]>;
export async function buildScenarios(opts: IbuildScenariosDictArgs): Promise<{[key:string]: ScenarioOutput}>;
export async function buildScenarios({projectRoot=cwd(),  returnArray=true, scenariosDir="tests/scenarios/", globalInputDir="tests/input"}) {
    return new Promise(async (resolve, reject) => {
        scenariosDir = isAbsolute(scenariosDir) ? scenariosDir : join(projectRoot, scenariosDir);
        globalInputDir = isAbsolute(globalInputDir) ? globalInputDir : join(projectRoot, globalInputDir);
        try { 
            await access(globalInputDir);
        } catch {
            globalInputDir = "undefined";
        }

        try {
            const scenarioDirs = await readdir(scenariosDir, {recursive: false, encoding: "utf-8"});            
            const scenarioOutputs: ScenarioOutput[] = [];
        
            for (let i=0 ; i < scenarioDirs.length; i++) {
                const scenarioDirname = scenarioDirs[i]
                const scenarioDir = join(scenariosDir, scenarioDirname)
                let scenarioEleventyVersion = await scenarioDirnameToEleventyVersion(scenarioDirname)
                
                scenarioOutputs.push(await buildEleventy({
                    eleventyVersion: scenarioEleventyVersion,
                    scenarioName: scenarioDirname,
                    globalInputDir,
                    projectRoot,
                    scenarioDir,
                }))
            }
            if (returnArray) {
                resolve(scenarioOutputs)
            } else {
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
        projectRoot: cwd()
    });
}