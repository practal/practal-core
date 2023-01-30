import { freeze } from "./utils";

let _output : ((msg : string) => void) | undefined = undefined;

export function debugging() : boolean {
    return _output !== undefined;
}
freeze(debugging);

export function configureDebugging(output : ((msg : string) => void) | undefined) {
    _output = output;
}
freeze(configureDebugging);

export function debug(msg : string) {
    if (_output !== undefined) {
        _output(msg);
    }
}
freeze(debug);


let _debugId = 0;
export function debugId() : number {
    return _debugId++;
}
freeze(debugId);
