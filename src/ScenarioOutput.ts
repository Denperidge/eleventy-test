import { join } from "path";
import { readdirSync, readFileSync, lstatSync } from "fs";

// TODO: Due to constructors not being allowed to be async,
// some synchronous code still exists in this file. Would like to get rid of that

/**
 * 
 * @param dir directory to search in
 * @param files currently found files
 * @returns promise for array of filepaths found in dir
 */
export function _recursiveFindFiles(dir: string, files:string[]=[]) {
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
        files = _recursiveFindFiles(dir, files)
    });


    return files;
}

/**
 * @class easy listing & reading of scenario outputs/eleventy-test-out files
 */
export default class ScenarioOutput {
    /** path to this scenario's eleventy-test-out */
    eleventyOutputDir: string;
    /** title of this scenario */
    title: string;
    private _files: {[key: string]: () => string};
    private cache: {[key: string]: string};

    /**
     * @param pEleventyOutputDir path to "eleventy-test-out"
     * @param pTitle scenario title
     */
    constructor(pEleventyOutputDir: string, pTitle: string) {
        this._files = {};
        this.cache = {};
        this.title = pTitle;
        this.eleventyOutputDir = pEleventyOutputDir;
        _recursiveFindFiles(this.eleventyOutputDir).forEach((filepath: string) => {
            this._files[filepath.replace(this.eleventyOutputDir, "")] = function() {
                return readFileSync(filepath, {encoding: "utf-8"})
            }
        })
    }

    /**
     * **Note:** unless you want filenames, you probably want getFileContent instead. @see getFileContent
     * 
     * @returns object with the following layout: {"relative/filename.html": function() => "file contents"}
     */
    get files() {
        return this._files;
    }

    /**
     * Gets file contents from internal cache,
     * reading file contents into the cache if needed
     * 
     * @param filepath relative path to file to read
     * @returns promise for text contents
     */
    getFileContent(filepath: string): Promise<string> {
        return new Promise(async (resolve, reject) => {
            if (!Object.keys(this._files).includes(filepath)) {
                throw new Error(`Can't find "${filepath}" in files. Available files: ${Object.keys(this._files).join(", ")}`)
            }
            if (!Object.keys(this.cache).includes(filepath)) {
                this.cache[filepath] = this._files[filepath]();
            }
            resolve(this.cache[filepath]);
        })
    }
}