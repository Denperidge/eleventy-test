/**
 * Functions to assist with collecting & reading of eleventy test outputs
 * - Recursive file finder function @see _recursiveFindFiles
 * - Class that turns a dir path into an easy file lister/reader @see ScenarioOutput
 */
import { join } from "path";
import { readdir, readFile, lstat } from "fs/promises";

/**
 * 
 * @param dir directory to search in
 * @param files currently found files
 * @returns promise for array of filepaths found in dir
 */
export async function _recursiveFindFiles(dir: string, files: string[] = []): Promise<string[]> {
    const foundDirs: string[] = [];
    const entries = await readdir(dir);

    await Promise.all(entries.map(async (name) => {
        const path = join(dir, name);
        const stat = await lstat(path);
        if (stat.isDirectory()) {
            foundDirs.push(path);
        } else if (stat.isFile()) {
            files.push(path);
        }
    }));

    for (const subDir of foundDirs) {
        files = await _recursiveFindFiles(subDir, files);
    }

    return files;
}

/**
 * @class easy listing & reading of scenario outputs/eleventy-test-out files
 */
export class ScenarioOutput {
    /** path to this scenario's eleventy-test-out */
    eleventyOutputDir: string;
    /** title of this scenario */
    title: string;
    private _filepaths: Set<string>;
    private cache: { [key: string]: string };

    constructor(pEleventyOutputDir: string, pTitle: string) {
        this._filepaths = new Set();
        this.cache = {};
        this.title = pTitle;
        this.eleventyOutputDir = pEleventyOutputDir;
    }

    /**
     * @param pEleventyOutputDir path to "eleventy-test-out"
     * @param pTitle scenario title
     */
    static async create(pEleventyOutputDir: string, pTitle: string): Promise<ScenarioOutput> {
        const instance = new ScenarioOutput(pEleventyOutputDir, pTitle);
        const allFiles = await _recursiveFindFiles(instance.eleventyOutputDir);
        for (const filepath of allFiles) {
            instance._filepaths.add(filepath.replace(instance.eleventyOutputDir, ""));
        }
        return instance;
    }

    /**
    * @returns set of relative paths to output files
     */
    get filepaths(): Set<string> {
        return this._filepaths;
    }

    /**
     * Gets file contents from internal cache,
     * reading file contents into the cache if needed
     *
     * @param filepath relative path to file to read
     * @returns promise for text contents
     */
    async getFileContent(filepath: string): Promise<string> {
        if (!this._filepaths.has(filepath)) {
            throw new Error(`Can't find "${filepath}" in files. Available files: ${Array.from(this._filepaths).join(", ")}`);
        }
        if (!(filepath in this.cache)) {
            this.cache[filepath] = await readFile(join(this.eleventyOutputDir, filepath), { encoding: "utf-8" });
        }
        return this.cache[filepath];
    }
}