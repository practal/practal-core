import { int } from "../things/primitives";
import { freeze, notImplemented } from "../things/utils";
import { contentHashOfFileFormat, PractalFile } from "./practalfile";

export class FileCache {

    #versions : { content_hash : int, file : PractalFile }[];

    constructor() {
        this.#versions = [];
    }

    lookup(version : string) : PractalFile | undefined {
        return this.#versions.find(v => v.file.handle.version === version)?.file;
    }

    add(file : PractalFile) {
        const hash = contentHashOfFileFormat(file.format).hash(file.content);
        this.#versions.push({ content_hash : hash, file : file });
    }

    addIfNewContent(file : PractalFile) : PractalFile {
        const H = contentHashOfFileFormat(file.format);
        const hash = H.hash(file.content);
        for (const version of this.#versions) {
            if (version.content_hash === hash && H.equal(file.content, version.file.content)) {
                return version.file;
            }
        }
        this.#versions.push({ content_hash : hash, file : file });
        return file;
    }

    get last() : PractalFile | undefined {
        if (this.#versions.length === 0) return undefined;
        else {
            return this.#versions[this.#versions.length - 1].file;
        }
    }

}
freeze(FileCache);

export class FilesCache {

    #cache : Map<string, FileCache>

    constructor() {
        this.#cache = new Map();
    }

    cacheOf(file : string) : FileCache {
        let fc = this.#cache.get(file);
        if (fc === undefined) {
            fc = new FileCache();
            this.#cache.set(file, fc);
        }
        return fc; 
    }

}
freeze(FilesCache);