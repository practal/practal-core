import { TextLines } from "../pyramids/textlines";
import { addHash, int, nat, startHash, string } from "../things/primitives";
import { assertNever } from "../things/test";
import { Hash, mkHash } from "../things/things";
import { freeze } from "../things/utils";
import { Identifiers } from "./identifier";

export class FileHandle {
    reference : any
    constructor(reference : any) {
        this.reference = reference;
        freeze(this);
    }
    withVersion(version : FileVersion) : FileHandleWithVersion {
        return new FileHandleWithVersion(this.reference, version);
    }
    toString() : string {
        return "FileHandle(" + this.reference + ")";
    }
}
freeze(FileHandle);

export type FileVersion = string
export class FileHandleWithVersion {
    reference : any
    version : FileVersion
    constructor(reference : any, version : FileVersion) {
        this.reference = reference;
        this.version = version;
        freeze(this);
    }
    withoutVersion() : FileHandle {
        return new FileHandle(this.reference);
    }
    toString() : string {
        return "FileHandle(" + this.reference + "; version = " + this.version + ")";
    }
}
freeze(FileHandleWithVersion);

export const enum PractalFileFormat {
    practal,
    config,
    binary
}

export const allPractalFileFormats : PractalFileFormat[] = [
    PractalFileFormat.practal,
    PractalFileFormat.config,
    PractalFileFormat.binary
];
freeze(allPractalFileFormats);

export function suffixOfPractalFileFormat(format : PractalFileFormat) : string {
    switch (format) {
        case PractalFileFormat.practal: return "practal";
        case PractalFileFormat.config: return "practal.config";
        case PractalFileFormat.binary: return "practal.binary";
        default: assertNever(format);
    }
}
freeze(suffixOfPractalFileFormat);

export interface Binary {
    /** length in bytes */
    length : nat

    /** unsigned byte at index */
    at(index : nat) : nat
}

export type PractalFile = 
    PractalFileCase<PractalFileFormat.practal, TextLines> | 
    PractalFileCase<PractalFileFormat.config, TextLines> |
    PractalFileCase<PractalFileFormat.binary, Binary>

export type PractalFileCase<format extends PractalFileFormat, Content> = {
    format : format,
    handle : FileHandleWithVersion,
    name : string,
    content_hash : int,
    content : Content
}

export function PractalTextFile(format : PractalFileFormat.practal | PractalFileFormat.config,
    handle : FileHandleWithVersion,
    name : string,
    content : TextLines) : PractalFile 
{
    const hash = textLinesHash.hash(content);
    const file : PractalFile = {
        format : format,
        handle : handle, 
        name : name,
        content_hash : hash,
        content : content
    };
    freeze(file);
    return file;
}
freeze(PractalTextFile);

export function PractalBinaryFile(
    handle : FileHandleWithVersion,
    name : string,
    content : Binary) : PractalFile 
{
    const hash = binariesHash.hash(content);
    const file : PractalFile = {
        format : PractalFileFormat.binary,
        handle : handle, 
        name : name,
        content_hash : hash,
        content : content
    };
    freeze(file);
    return file;
}
freeze(PractalBinaryFile);

const textLinesHashSeed = string.hash("TextLines");
const binariesHashSeed = string.hash("Binary");

function equalTextLines(lines1 : TextLines, lines2 : TextLines) : boolean {
    if (lines1 === lines2) return true;
    const count = lines1.lineCount;
    if (count !== lines2.lineCount) return false;
    for (let i = 0; i < count; i++) {
        if (lines1.lineAt(i) !== lines2.lineAt(i)) return false;
    }
    return true;
}

function hashTextLines(lines : TextLines) : int {
    let hash = startHash(textLinesHashSeed);
    const count = lines.lineCount;
    for (let i = 0; i < count; i++) {
        hash = addHash(hash, string.hash(lines.lineAt(i)));
    }
    return hash;
}

function equalBinaries(binary1 : Binary, binary2 : Binary) : boolean {
    if (binary1 === binary2) return true;
    const len = binary1.length;
    if (len !== binary2.length) return false;
    for (let i = 0; i < len; i++) {
        if (binary1.at(i) !== binary2.at(i)) return false;
    }
    return true;
}

function hashBinary(binary : Binary) : int {
    let hash = startHash(binariesHashSeed);
    const count = binary.length;
    for (let i = 0; i < count; i++) {
        hash = addHash(hash, binary.at(i));
    }
    return hash;
}

const textLinesHash : Hash<TextLines> = mkHash("TextLines", 
    x => true,
    equalTextLines,
    hashTextLines);

const binariesHash : Hash<Binary> = mkHash("Binary", 
    x => true,
    equalBinaries,
    hashBinary);

export function contentHashOfFileFormat(format : PractalFileFormat) : Hash<any> {
    switch (format) {
        case PractalFileFormat.practal: return textLinesHash;
        case PractalFileFormat.config: return textLinesHash;
        case PractalFileFormat.binary: return binariesHash;
        default: assertNever(format);
    }
}
freeze(contentHashOfFileFormat);
