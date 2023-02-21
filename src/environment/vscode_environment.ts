import * as vscode from 'vscode';
import { createTextLines, createTextLinesFromBytes } from '../pyramids/textlines';
import { debug } from "../things/debug";
import { nat } from '../things/primitives';
import { assertNever } from '../things/test';
import { force, notImplemented } from '../things/utils';
import { Environment, PackageHandle } from "./environment";
import { FilesCache } from './filecache';
import { Identifiers } from "./identifier";
import { allPractalFileFormats, Binary, FileHandle, FileHandleWithVersion, FileVersion, PractalBinaryFile, PractalFile, PractalFileFormat, PractalTextFile, suffixOfPractalFileFormat } from "./practalfile";


function makePractalFilesPattern() : string {
    const group = allPractalFileFormats.map(suffixOfPractalFileFormat).join(",");
    return `**/*.{${group}}`;
}

async function listWorkspaceFolders() {
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
    const packageConfigFiles = await vscode.workspace.findFiles("**/package.practal.config");
    debug("Found " + packageConfigFiles.length + " package config files: ");
    for (const f of packageConfigFiles) {
        debug("  " + f);
    }
    const allPractalFiles = await vscode.workspace.findFiles(makePractalFilesPattern());
    debug("Found " + allPractalFiles.length + " practal files: ");
    for (const f of allPractalFiles) {
        debug("  " + f);
    }
    //const moduleFiles = await
}

function uriOf(handle : FileHandle | FileHandleWithVersion) : vscode.Uri {
    const uri = handle.reference;
    if (!(uri instanceof vscode.Uri)) throw new Error("Invalid handle.");
    return uri;
}

function formatOf(uri : vscode.Uri) : PractalFileFormat | undefined {
    for (const format of allPractalFileFormats) {
        const suffix = suffixOfPractalFileFormat(format);
        if (uri.path.endsWith("." + suffix)) {
            return format;
        }
    }
    return undefined;
}

async function practalBinaryFileFromURI(uri : vscode.Uri, version : string) : Promise<PractalFile> {
    const content = await vscode.workspace.fs.readFile(uri);
    const handle = new FileHandleWithVersion(uri, version);
    return PractalBinaryFile(handle, content);
}

async function practalTextFileFromURI(uri : vscode.Uri, format : PractalFileFormat.config | PractalFileFormat.practal, version : string) : Promise<PractalFile> {
    const content = await vscode.workspace.fs.readFile(uri);
    const handle = new FileHandleWithVersion(uri, version);
    return PractalTextFile(format, handle, createTextLinesFromBytes(content));
}

function practalFileFromTextDocument(format : PractalFileFormat.config | PractalFileFormat.practal, 
    version : string, textdocument : vscode.TextDocument) : PractalFile 
{
    let lines : string[] = [];
    const count = textdocument.lineCount;
    for (let i = 0; i < count; i++) {
        lines.push(textdocument.lineAt(i).text);
    }
    const handle = new FileHandleWithVersion(textdocument.uri, version);
    const content = createTextLines(lines);
    return PractalTextFile(format, handle, content);
}

export class VSCodeEnvironment implements Environment {

    #id : string
    #filescache : FilesCache
    #version_counter : nat

    constructor() {
        this.#id = Date.now().toString();
        this.#filescache = new FilesCache();
        this.#version_counter = 0;
        debug("VSCode environment is live (id = " + this.#id + ")!");
        vscode.workspace.onDidChangeWorkspaceFolders(event => {
            //const added_folders = event.added;
            //const removed_folders = event.removed;
            //listWorkspaceFolders();
        });
        listWorkspaceFolders();
    }

    #vsVersion(version : nat) : string {
        return "vs" + this.#id + "_" + version;
    }

    #envVersion() : string {
        const version = "" + this.#version_counter;
        this.#version_counter += 1;
        return "env" + this.#id + "_" + version;
    }

    fileHandleOf(file: any): FileHandle | undefined {
        if (!(file instanceof vscode.Uri)) return undefined;
        return new FileHandle(file);
    }

    fileHandleWithVersionOf(file: any, version: any): FileHandleWithVersion | undefined {
        if (!(file instanceof vscode.Uri)) return undefined;
        if (!nat.is(version)) return undefined;
        const fileversion = this.#vsVersion(version);
        return new FileHandleWithVersion(file, fileversion);
    }

    async readFile(file: FileHandle | FileHandleWithVersion): Promise<PractalFile | null> {
        const uri = uriOf(file);
        const format = formatOf(uri);
        if (format === undefined) throw new Error("Unknown file format.");
        const uri_string = uri.toString();
        const cache = this.#filescache.cacheOf(uri_string);
        if (file instanceof FileHandleWithVersion) {
            const practalfile = cache.lookup(file.version);
            if (practalfile !== undefined) return practalfile;
        }
        if (format === PractalFileFormat.config || format === PractalFileFormat.practal) {
            for (const document of vscode.workspace.textDocuments) {
                if (document.uri.toString() === uri_string) {
                    const version = this.#vsVersion(document.version);
                    if (file instanceof FileHandleWithVersion) {
                        if (version === file.version) {
                            const practalfile = practalFileFromTextDocument(format, version, document);
                            cache.add(practalfile);
                            return practalfile;
                        } else {
                            return null;
                        }
                    } else {
                        let practalfile = cache.lookup(version);
                        if (practalfile !== undefined) return practalfile;
                        practalfile = practalFileFromTextDocument(format, version, document);
                        cache.add(practalfile);
                        return practalfile;                    
                    }
                }
            }
            if (file instanceof FileHandleWithVersion) return null;
            const practalfile = await practalTextFileFromURI(uri, format, this.#envVersion());
            return cache.addIfNewContent(practalfile);
        } else if (format === PractalFileFormat.binary) {
            const practalfile = await practalBinaryFileFromURI(uri, this.#envVersion());
            return cache.addIfNewContent(practalfile);
        } else {
            assertNever(format);
        }
    }

    listPackages(): Promise<PackageHandle[]> {
        throw new Error('Method not implemented.');
    }

    packageOf(file: FileHandle): Promise<PackageHandle> {
        throw new Error('Method not implemented.');
    }

    filesOfPackage(package_handle: PackageHandle): Promise<FileHandle[]> {
        throw new Error('Method not implemented.');
    }

}

