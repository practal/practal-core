import { TextLines } from "../pyramids/textlines";
import { int, nat } from "../things/primitives";
import { freeze } from "../things/utils";
import { Identifiers } from "./identifier";

export class FileHandle {
    reference : any
    constructor(reference : any) {
        this.reference = reference;
        freeze(this);
    }
    toString() : string {
        return "File(" + this.reference + ")";
    }
}
freeze(FileHandle);

interface Binary {
    length : nat // length in bytes
    byte(index : nat) : nat   
}

export const enum PractalFileFormat {
    practal,
    config,
    binary
}

export type PractalFileInfo<Format extends PractalFileFormat> = {
    handle : FileHandle
    format : Format
    namespace : Identifiers
    name : string
    version : nat
}

export type PractalFile = PractalPractalFile | PractalBinaryFile | PractalConfigFile

export type PractalPractalFile = {
    info : PractalFileInfo<PractalFileFormat.practal>
    lines : TextLines
}

export type PractalBinaryFile = {
    info : PractalFileInfo<PractalFileFormat.binary>
    binary : Binary
} 

export type PractalConfigFile = {
    info : PractalFileInfo<PractalFileFormat.config>
    lines : TextLines
}

export interface Environment {

    /**
     *  It depends on the environment what `file` can be. For a VSCode environment, it will be a URI.
     */
    fileHandleOf(file : any) : FileHandle | undefined

    packageManagerFor(file : FileHandle) : Promise<PackageManager>

    readFile(file : FileHandle) : Promise<PractalFile>

}

export interface PackageManager {

    //listPackages() : 


}

/*function run() {
    let worker = new Worker(
}*/