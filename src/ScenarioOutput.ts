import {join } from "path";
import {  lstatSync, readFileSync, readdirSync } from "fs";

export function recursiveFindFiles(dir: string, files:string[]=[]) {
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

export default class ScenarioOutput {
    eleventyOutputDir: string;
    title: string;
    private _files: {[key: string]: () => string};
    private cache: {[key: string]: string};

    constructor(pEleventyOutputDir: string, pTitle: string) {
        this._files = {};
        this.cache = {};
        this.title = pTitle;
        this.eleventyOutputDir = pEleventyOutputDir;
        recursiveFindFiles(this.eleventyOutputDir).forEach((filepath: string) => {
            this._files[filepath.replace(this.eleventyOutputDir, "")] = function() {
                return readFileSync(filepath, {encoding: "utf-8"})
            }
        })
    }
    get files() {
        return this._files;
    }

    getFileContent(filename): string {
        if (!Object.keys(this.cache).includes(filename)) {
            this.cache[filename] = this._files[filename]();
        }
        return this.cache[filename];
    }
}