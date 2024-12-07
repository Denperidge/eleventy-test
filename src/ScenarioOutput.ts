import { join } from "path";
import { stat, readFile, readdir } from "fs/promises";

export async function recursiveFindFiles(dir: string, files:string[]=[]) {
    const foundDirs: string[] = [];
    const contents = await readdir(dir, {encoding: "utf-8"});
    contents.forEach(async (name) => {
        const path = join(dir, name)
        try {
            const stats = await stat(path);
            if (stats.isDirectory()) {
                foundDirs.push(path);
            } else if (stats.isFile()) {
                files.push(path);
            }
        } catch {}
    });

    foundDirs.forEach(async (dir) => {
        files = await recursiveFindFiles(dir, files)
    });

    return files;
}

export default class ScenarioOutput {
    eleventyOutputDir: string;
    title: string;
    private _files: {[key: string]: Promise<string>};
    private cache: {[key: string]: string};

    constructor(pEleventyOutputDir: string, pTitle: string) {
        this._files = {};
        this.cache = {};
        this.title = pTitle;
        this.eleventyOutputDir = pEleventyOutputDir;
    }

    get files() {
        return this._files;
    }

    async loadFiles() {
        return new Promise<ScenarioOutput>(async (resolve, reject) => {
            const files = await recursiveFindFiles(this.eleventyOutputDir);
        
            files.forEach((filepath: string) => {
                this._files[filepath.replace(this.eleventyOutputDir, "")] = 
                    new Promise(async (resolve, reject) => {
                        resolve(await readFile(filepath, {encoding: "utf-8"}));
                    });
            });
            resolve(this)
        });
    }

    getFileContent(filename): Promise<string> {
        return new Promise(async (resolve, reject) => {
            if (!Object.keys(this.cache).includes(filename)) {
                this.cache[filename] = await this._files[filename];
            }
            resolve(this.cache[filename]);
        })

    }
}