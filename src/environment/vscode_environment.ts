import * as vscode from 'vscode';
import { debug } from "../things/debug";
import { Environment, PackageHandle } from "./environment";
import { Identifiers } from "./identifier";
import { FileHandle, PractalFile } from "./practalfile";


function listWorkspaceFolders() {
    const folders = vscode.workspace.workspaceFolders;
    if (folders === undefined) {
        debug("no workspace found");
    } else {
        debug("found " + folders.length + " workspace folders");
        let i = 1;
        for (const folder of folders) {
            debug("    " + i + ") " + folder.name + " at " + folder.uri);
            i += 1;
        }
    } 
}

export class VSCodeEnvironment implements Environment {

    constructor() {
        debug("VSCode environment is live!");
        vscode.workspace.onDidChangeWorkspaceFolders(event => {
            //const added_folders = event.added;
            //const removed_folders = event.removed;
            listWorkspaceFolders();
        });
        listWorkspaceFolders();
    }

    fileHandleOf(file: any): FileHandle | undefined {
        throw new Error("Method not implemented.");
    }
    readFile(file: FileHandle): Promise<PractalFile> {
        throw new Error("Method not implemented.");
    }
    listGlobalPackages(): Promise<Identifiers[]> {
        throw new Error("Method not implemented.");
    }
    globalPackageOf(file: FileHandle): Promise<PackageHandle> {
        throw new Error("Method not implemented.");
    }
    versionsOfGlobalPackage(global_package_name: Identifiers): Promise<PackageHandle[]> {
        throw new Error("Method not implemented.");
    }
    filesOfGlobalPackage(package_handle: PackageHandle): Promise<[FileHandle[]][]> {
        throw new Error("Method not implemented.");
    }

}

