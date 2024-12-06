import {cwd} from "process";
import {join, resolve} from "path";
import {  lstatSync, readFileSync, rmSync, readdirSync, existsSync } from "fs";
import {execSync, fork} from "child_process";
const DIR_BASE = "tests";
const DIR_SCENARIOS = join(DIR_BASE, "scenarios");
const DIR_TESTS = join(DIR_BASE, "tests");
const DIR_INPUT = join(DIR_BASE, "input");

function recursiveFindFiles(dir: string, files:string[]=[]) {
    const foundDirs: string[] = [];
    readdirSync(dir).forEach(name => {
        const path = join(dir, name)
        const stat = lstatSync(path);
        if (stat.isDirectory()) {
            foundDirs.push(path);
        } else if (stat.isFile()) {
            files.push(path);
        }
    });

    foundDirs.forEach((dir) => {
        files = recursiveFindFiles(dir, files)
    });


    return files;
}

class ScenarioOutput {
    eleventyOutputDir: string;
    title: string;
    files: {[key: string]: () => string};

    constructor(pEleventyOutputDir: string, pTitle: string) {
        this.title = pTitle;
        this.eleventyOutputDir = pEleventyOutputDir;
        this.files = {};
        recursiveFindFiles(this.eleventyOutputDir).forEach((filepath: string) => {
            this.files[filepath.replace(this.eleventyOutputDir, "")] = function() {
                return readFileSync(filepath, {encoding: "utf-8"})
            }
        })
    }
}

function ensureEleventyExists(projectRoot: string, eleventyVersion: string) {
    const eleventyDir = join(projectRoot, "node_modules/@11ty/eleventy" + eleventyVersion)
    if (existsSync(eleventyDir)) {
        return eleventyDir;
    } else {
        console.log("Not existing!", eleventyVersion)
        if (existsSync(join(projectRoot, "package-lock.json"))) {
            // NPM is used TODO
            throw Error("not implemented")

        } else if (existsSync(join(projectRoot, "yarn.lock"))) {
            // Yarn is used
            try {
                execSync(`yarn add -D @11ty/eleventy${eleventyVersion}@npm:@11ty/eleventy@${eleventyVersion}`, {cwd:projectRoot})
            } catch (e) {
                console.error(`Couldn't install eleventy ${eleventyVersion} using yarn`)
                throw e;
            }
            return eleventyDir
        } else {
            throw new Error("Could not determine package manager")
        }
        // TODO pnpm
    }
}


async function buildEleventy({
    eleventyVersion,
    scenarioDir,
    scenarioName,
    projectRoot=cwd(),
    globalInputDir,
    useServe=false
}) : Promise<ScenarioOutput> {
    /*
    console.log(`
Building ${scenarioName} (${eleventyVersion})
projectRoot = ${projectRoot}
globalInputDir = ${globalInputDir}
scenarioDir: ${scenarioDir}
`);*/
    return new Promise((resolve, reject)=> {
        // I tried using Eleventy programmatically. Emphasis on tried
        // Thanks to https://github.com/actions/setup-node/issues/224#issuecomment-943531791

        const eleventyDir = ensureEleventyExists(projectRoot, eleventyVersion);

        const bin = JSON.parse(
            readFileSync(
                join(eleventyDir, "package.json"),
                {encoding: "utf-8"})
            ).bin.eleventy;
        const pathToBin = join(eleventyDir, bin);
        
        const scenarioInputDir = join(scenarioDir, "input");
        const inputDir = existsSync(scenarioInputDir) ? scenarioInputDir : globalInputDir;
        if (inputDir == undefined) {
            throw Error("inputDir is undefined!")
        }
        const outputDir = join(scenarioDir, "eleventy-test-out")
        rmSync(outputDir, {force: true, recursive: true})

        try {
            //const command = useServe ? `timeout 5 node ${pathToBin} --serve` : `node ${pathToBin}`
            const out = fork(
                pathToBin, 
                ["--input", inputDir, "--output", outputDir ], 
            {cwd: scenarioDir})
            out.on("message", (msg) => {
                console.log(msg)
            })

            out.on("close", (code) => {
                /*
                console.log("Code: " + code);
                console.log(out.stdout)
                console.log(out.stderr)
                */
                const output = new ScenarioOutput(outputDir, scenarioName)
                resolve(output);
            });
            
            //const out = execFile("node", ["--version"], {cwd: scenarioDir, encoding: "utf-8"});
        // console.log(out)
        } catch (e) {
            if (!useServe) {
                throw e;
            }
        }
    })

}

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
    
            let eleventyVersion;
            const scenarioMajorVersion = scenarioDirname[0]
            switch(scenarioMajorVersion) {
                case "1":
                    eleventyVersion = "1.0.2";
                    break;
                case "2":
                    eleventyVersion = "2.0.1";
                    break;
                case "3":
                    eleventyVersion = "3.0.0"
                    break
                default:
                    throw Error(`${scenarioDirname} does not start with a major eleventy version. Exiting.`)
            }
            
            scenarioOutputs.push(await buildEleventy({
                eleventyVersion,
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