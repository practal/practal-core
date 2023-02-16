import { int } from "../things/primitives";
import { freeze } from "../things/utils";
import { PackageManager } from "./package_manager";

export class FileHandle {
    handle : int
    constructor(handle : int) {
        this.handle = handle;
        freeze(this);
    }
}
freeze(FileHandle);

export interface Environment {

    /**
     *  It depends on the environment what `file` can be. For a VSCode environment, it will be a URI.
     */
    fileHandleOf(file : any) : FileHandle | undefined

    packageManagerFor(file : FileHandle) : Promise<PackageManager | undefined>

}