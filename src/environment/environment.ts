import { freeze } from "../things/utils";
import { Identifier, Identifiers } from "./identifier"
import { FileHandle, PractalFile, PractalFileFormat } from "./practalfile"
import { Version } from "./version"
import { VSCodeEnvironment } from "./vscode_environment";

export type PackageName = Identifiers

export class PackageHandle {

    name : PackageName
    version : Version
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
     *  It depends on the environment what `file` can be. For a VSCode environment, it will be a URI.
     */
    fileHandleOf(file : any) : FileHandle | undefined

    readFile(file : FileHandle) : Promise<PractalFile>

    listGlobalPackages() : Promise<PackageName[]>

    globalPackageOf(file : FileHandle) : Promise<PackageHandle>

    versionsOfGlobalPackage(global_package_name : PackageName) : Promise<PackageHandle[]>

    filesOfGlobalPackage(package_handle : PackageHandle) : Promise<[FileHandle[]][]>

}

let environment : Environment | undefined = undefined;

export function Environment() : Environment {
    if (environment !== undefined) return environment;
    environment = new VSCodeEnvironment();
    return environment;
} 
