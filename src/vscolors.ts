const semanticTokenColorizations = `
"Theme" : {
    "rules": {
        "practal-module-name": {"foreground": "module"},
        "practal-abstraction" : {"foreground": "abstraction"},          
        "practal-abstraction-declaration": {"foreground": "abstraction", "underline": true},
        "practal-identifier": {"foreground": "normal"},
        "practal-syntactic-category": {"foreground": "sc", "italic": true}, 
        "practal-syntactic-category-declaration": { "foreground": "sc", "underline": true, "italic": true }, 
        "practal-syntactic-category-keyword": {"foreground": "secondary", "italic": true, "bold": true}, 
        "practal-syntactic-comparator": {"foreground": "primary"}, 
        "practal-invalid": {"foreground": "red"},
        "practal-primary-keyword": {"foreground": "primary", "bold": true},
        "practal-secondary-keyword": {"foreground": "secondary", "bold": true},
        "practal-free-variable": {"foreground": "free"},
        "practal-bound-variable": { "italic": true, "foreground": "bound"},
        "practal-custom-syntax": {"foreground": "normal"},
        "practal-variable": {"foreground": "normal"},          
        "practal-comment" : {"foreground": "comment"},          
        "practal-label" : {"foreground": "weak"},
        "practal-label-expr" : {"foreground": "normal", "italic": true},
        "practal-square-braces" : {"foreground":"punctuation"},
        "practal-punctuation" : {"foreground":"punctuation"},
        "practal-syntax-fragment" : {"foreground":"normal"},
        "practal-syntax-optional-space" : {"foreground": "weak", "underline": true},
        "practal-syntax-mandatory-space" : {"underline": true, "foreground":"primary"},
        "practal-latex-syntax" : {"foreground":"normal"},
        "practal-latex-space" : {},
        "practal-latex-control-sequence" : { "italic": true, "foreground" : "secondary"},
        "practal-round-braces": {"foreground": "weakest"}
    }
},`;

type ColorMap = [string, string][]

const solarized_dark : ColorMap = [
    ["strongest", "#fdf6e3"],
    ["strong", "#eee8d5"],
    ["normal", "#93a1a1"],
    ["weak", "#839496"],
    ["weaker", "#657b83"],
    ["weakest", "#586e75"],    
    ["yellow", "#b58900"],
    ["orange", "#cb4b16"],
    ["red", "#dc322f"],
    ["magenta", "#d33682"],
    ["violet", "#6c71c4"],
    ["blue", "#268bd2"],
    ["cyan", "#2aa198"],
    ["green", "#859900"],

    ["comment", "weaker"],
    ["primary", "magenta"],
    ["secondary", "violet"],
    ["abstraction", "yellow"],
    ["module", "strong"],
    ["sc", "cyan"],
    ["free", "blue"],
    ["bound", "green"],
    ["punctuation", "normal"]
];

const solarized_light : ColorMap = [
    ["strongest", "#002b36"],
    ["strong", "#073642"],
    ["normal", "#586e75"],
    ["weak", "#657b83"],
    ["weaker", "#839496"],
    ["weakest", "#93a1a1"],
    ["yellow", "#b58900"],
    ["orange", "#cb4b16"],
    ["red", "#dc322f"],
    ["magenta", "#d33682"],
    ["violet", "#6c71c4"],
    ["blue", "#268bd2"],
    ["cyan", "#2aa198"],
    ["green", "#859900"],

    ["comment", "weaker"],
    ["primary", "magenta"],
    ["secondary", "violet"],
    ["abstraction", "yellow"],
    ["module", "strong"],
    ["sc", "cyan"],
    ["free", "blue"],
    ["bound", "green"],
    ["punctuation", "normal"]
];

const default_dark : ColorMap = [
    ["normal", "#D4D4D4"], // done
    ["weak", "#BEBEBE"],
    ["weakest", "#6A6A6A"],
    ["red", "#FF0000"],

    ["comment", "#6A9955"],
    ["primary", "#C586C0"],
    ["secondary", "#e29660"],
    ["abstraction", "#DCDCAA"],
    ["module", "normal"],
    ["sc", "#569CD6"],
    ["free", "#9CDCFE"],
    ["bound", "#4EC9B0"],    
    ["punctuation", "normal"]
];

const default_light : ColorMap = [
    ["normal", "#000000"], // done
    ["weak", "#6A6A6A"],
    ["weakest", "#BEBEBE"],
    ["red", "#FF0000"],

    ["comment", "#008000"],
    ["primary", "#AF00DB"],
    ["secondary", "#098658"],
    ["abstraction", "#795E26"],
    ["module", "normal"],
    ["sc", "#569CD6"],
    ["free", "#0070C1"],
    ["bound", "#A31515"],    
    ["punctuation", "normal"]
];

function transform(rules : string, colormap : ColorMap) : string {
    let changed = true;
    while (changed) {
        changed = false;
        for (const [name, color] of colormap) {
            while (true) {
                let replaced = rules.replace(`"${name}"`, `"${color}"`);
                if (replaced !== rules) {
                    changed = true;
                    rules = replaced;
                } else break;
            }
        }
    }
    return rules;
}

function show(colormap : ColorMap, theme : string) {
    let cm = [...colormap];
    cm.push(["Theme", theme]);
    console.log(transform(semanticTokenColorizations, cm));
}

//show(default_dark, "[*Dark*]");
//show(default_light, "[*Light*]"); 
show(solarized_dark, "[*Dark*]");
show(solarized_light, "[*Light*]");



