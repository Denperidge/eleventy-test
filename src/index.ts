import { cwd } from "process";
import { join, isAbsolute } from "path";
import { readdir, access } from "fs/promises";

import ScenarioOutput from "./ScenarioOutput";
import { buildEleventy } from "./eleventyUtils";

export * from "./eleventyUtils";

let versions;  // Cache variable for determining latest eleventy versions

async function scenarioDirnameToEleventyVersion(scenarioDirname) : Promise<string> {
    // Parse {eleventyVersion}--{label}/ vs {eleventyVersion}/ 
    let eleventyVersion = scenarioDirname.includes("--") ? scenarioDirname.split("--")[0] : scenarioDirname;

    if (eleventyVersion.length < 5) {
        const scenarioMajorVersion = scenarioDirname[0];
        if (versions == undefined) {
            versions = await (await fetch("https://api.github.com/repos/11ty/eleventy/tags")).json();
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

export async function buildScenarios(projectRoot: string, returnArray?:true, scenariosDir?: string, globalInputDir?: string): Promise<ScenarioOutput[]>;
export async function buildScenarios(projectRoot: string, returnArray?:false, scenariosDir?: string, globalInputDir?: string): Promise<{[key:string]: ScenarioOutput}>;
export async function buildScenarios(projectRoot=cwd(),  returnArray=true, scenariosDir="tests/scenarios/", globalInputDir="tests/input") {
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
        
            scenarioDirs.forEach(async (scenarioDirname) => {
                const scenarioDir = join(scenariosDir, scenarioDirname)
                let scenarioEleventyVersion = await scenarioDirnameToEleventyVersion(scenarioDirname)
                scenarioOutputs.push(await buildEleventy({
                    eleventyVersion: scenarioEleventyVersion,
                    scenarioName: scenarioDirname,
                    globalInputDir,
                    projectRoot,
                    scenarioDir,
                }))
            });
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
    buildScenarios(cwd());
}