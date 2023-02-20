import { freeze } from "../things/utils";
import { Identifier, Identifiers } from "./identifier"
import { FileHandle, FileHandleWithVersion, PractalFile, PractalFileFormat } from "./practalfile"
import { Version } from "./version"
import { VSCodeEnvironment } from "./vscode_environment";

export class PackageName {

    ids : Identifiers

    constructor(ids : Identifiers) {
        this.ids = ids;
        if (this.ids.length === 0) throw new Error("Package cannot have empty name.");
        freeze(this);
    }


}
freeze(PackageName);


export class PackageHandle {

    name : PackageName | null 
    version : Version | null
    reference : any

    constructor(name : PackageName, version : Version, reference : any) {
        this.name = name;
        this.version = version;
        this.reference = reference;
        freeze(this);
    }

}
freeze(PackageHandle);

export interface Environment {

    /**
     *  It depends on the environment what `file` can be. 
     *  For a VSCode environment, `file` will be a URI.
     */
    fileHandleOf(file : any) : FileHandle | undefined

    /**
     *  It depends on the environment what `file` and `version` can be. 
     *  For a VSCode environment, `file` will be a URI, and `version` will be the version of the TextDocument.
     */
    fileHandleWithVersionOf(file : any, version : any) : FileHandleWithVersion | undefined

    /**
     * If the file handle has a version, and the environment has no content stored for this version, returns null.
     * If the file has no version, return the newest content for this file.
     */
    readFile(file : FileHandle | FileHandleWithVersion) : Promise<PractalFile | null>

    listPackages() : Promise<PackageHandle[]>

    packageOf(file : FileHandle) : Promise<PackageHandle>

    filesOfPackage(package_handle : PackageHandle) : Promise<FileHandle[]>

}

let environment : Environment | undefined = undefined;

export function Environment() : Environment {
    if (environment !== undefined) return environment;
    environment = new VSCodeEnvironment();
    return environment;
} 
