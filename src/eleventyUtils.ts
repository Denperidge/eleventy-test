import { execSync, fork } from "child_process";
import { readFileSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { cwd } from "process";

import ScenarioOutput from "./ScenarioOutput";


export function ensureEleventyExists(projectRoot: string, eleventyVersion: string) {
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


export async function buildEleventy({
    eleventyVersion,
    scenarioDir,
    scenarioName,
    projectRoot=cwd(),
    globalInputDir
}) : Promise<ScenarioOutput> {
    return new Promise((resolve, reject)=> {
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
            throw e;
        }
    })

}
