import { SectionDataTerm, TokenType } from "./practalium_parser"
import { Tree } from "./pyramids/deterministic_parser"
import { Handle } from "./theory"

export type UITerm = UITermVarApp | UITermAbstrApp

export enum UITermKind {
    VarApp,
    AbstrApp
}

export type UITermVarApp = {
    kind : UITermKind.VarApp,
    varname : string,
    params : UITerm[],
    syntax? : Tree<SectionDataTerm, TokenType>
}

export type UITermAbstrApp = {
    kind : UITermKind.AbstrApp,
    abstr : Handle,
    params : UITerm[],
    syntax? : Tree<SectionDataTerm, TokenType>
}
