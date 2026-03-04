/**
 * Entrypoint & highest-level functions
 * - Building all scenarios in a project @see buildScenarios
 * - Providing yarn start functionality
 */
import { join, isAbsolute } from "path";
import { cwd } from "process";
import { readdir } from "fs/promises";

import { ScenarioOutput } from "./ScenarioOutput";
import { buildEleventy, _determineInstalledEleventyVersions } from "./eleventyUtils";
import { debug, _setDebug } from "./debug";

export * from "./eleventyUtils";
export * from "./ScenarioOutput";
export * from "./githubApi";

interface IbuildScenariosArgs {
    projectRoot?: string,
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
 * **Note:** the arguments below need to be passed in an object. @see IbuildScenariosArgs
 * @param projectRoot project root directory
 * @default process.cwd()
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
    _setDebug(enableDebug);
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

                scenarioOutputs.push(await buildEleventy({
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