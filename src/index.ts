import { cwd } from "process";
import { join } from "path";
import { readdirSync, existsSync } from "fs";

import ScenarioOutput from "./ScenarioOutput";
import {buildEleventy} from "./eleventyUtils";


const DIR_BASE = "tests";
const DIR_SCENARIOS = join(DIR_BASE, "scenarios");
const DIR_INPUT = join(DIR_BASE, "input");

export * from "./eleventyUtils";

export async function buildScenarios(projectRoot: string, returnArray?:true): Promise<ScenarioOutput[]>;
export async function buildScenarios(projectRoot: string, returnArray?:false): Promise<{[key:string]: ScenarioOutput}>;
export async function buildScenarios(projectRoot=cwd(), returnArray=true) {
    return new Promise(async (resolve, reject) => {
        const scenariosDir = join(projectRoot, DIR_SCENARIOS)
        const globalInputDir = existsSync(join(projectRoot, DIR_INPUT)) ? join(projectRoot, DIR_INPUT) : undefined;
    
        const scenarioDirs = readdirSync(scenariosDir);
    
        const scenarioOutputs: ScenarioOutput[] = [];
    
        for (let i=0; i < scenarioDirs.length; i++) {
            const scenarioDirname = scenarioDirs[i]
            const scenarioDir = join(scenariosDir, scenarioDirname)
            let scenarioEleventyVersion = scenarioDirname.includes("--") ? scenarioDirname.split("--")[0] : scenarioDirname;

            if (scenarioEleventyVersion.length < 5) {
                const scenarioMajorVersion = scenarioDirname[0];
                const versions = await (await fetch("https://api.github.com/repos/11ty/eleventy/tags")).json();
                for (let i=0; i < versions.length; i++) {
                    const version = versions[i];
                    // When auto-selecting, choose a non-alpha/canary build
                    if (!version.name.includes("-") && version.name[1] == scenarioMajorVersion) {
                        scenarioEleventyVersion = version.name.substring(1);
                        break;
                    }
                }
            }
            
            
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
    });
}

if (require.main === module) {
    buildScenarios(cwd());
}