import {cwd} from "process";
import {join} from "path";
import { readFileSync, rmSync, readdirSync, existsSync } from "fs";
import {execSync, fork} from "child_process";
const DIR_BASE = "tests";
const DIR_SCENARIOS = join(DIR_BASE, "scenarios");
const DIR_TESTS = join(DIR_BASE, "tests");
const DIR_INPUT = join(DIR_BASE, "input");


function buildEleventy({
    eleventyVersion,
    scenarioDir,
    scenarioName,
    projectRoot=cwd(),
    globalInputDir,
    useServe=false
}) {
    console.log(`
Building ${scenarioName} (${eleventyVersion})
projectRoot = ${projectRoot}
globalInputDir = ${globalInputDir}
scenarioDir: ${scenarioDir}
`);
    return new Promise((resolve, reject)=> {
        // I tried using Eleventy programmatically. Emphasis on tried
        // Thanks to https://github.com/actions/setup-node/issues/224#issuecomment-943531791

        const eleventyDir=join(projectRoot, "node_modules/@11ty/", eleventyVersion);
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
                console.log("Code: " + code);
                console.log(out.stdout)
                console.log(out.stderr)
                resolve(code);
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



function main(projectRoot=cwd()) {
    const scenariosDir = join(projectRoot, DIR_SCENARIOS)
    const globalInputDir = existsSync(join(projectRoot, DIR_INPUT)) ? join(projectRoot, DIR_INPUT) : undefined;

    const scenarioDirs = readdirSync(scenariosDir);

    scenarioDirs.forEach(scenarioDirname => {
        const scenarioDir = join(scenariosDir, scenarioDirname)

        let eleventyVersion;
        const scenarioMajorVersion = scenarioDirname[0]
        switch(scenarioMajorVersion) {
            case "1":
            case "2":
            case "3":
                eleventyVersion = "eleventy" + scenarioMajorVersion
                break
            default:
                throw Error(`${scenarioDirname} does not start with a major eleventy version. Exiting.`)
        }
        
        buildEleventy({
            eleventyVersion: eleventyVersion,
            scenarioName: scenarioDirname,
            globalInputDir,
            projectRoot,
            scenarioDir,

        });
    })
}

main();