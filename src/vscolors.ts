const semanticTokenColorizations = `
"practal-module-name": {"foreground": "strong"},
"practal-abstraction" : {"foreground": "yellow"},          
"practal-abstraction-declaration": {"foreground": "yellow", "underline": true},
"practal-identifier": {"foreground": "normal"},
"practal-syntactic-category": {"foreground": "cyan", "italic": true}, 
"practal-syntactic-category-declaration": { "foreground": "cyan", "underline": true, "italic": true }, 
"practal-syntactic-category-keyword": {"foreground": "violet", "italic": true, "bold": true}, 
"practal-syntactic-comparator": {"foreground": "magenta"}, 
"practal-invalid": {"foreground": "red"},
"practal-primary-keyword": {"foreground": "magenta", "bold": true},
"practal-secondary-keyword": {"foreground": "violet", "bold": true},
"practal-free-variable": {"foreground": "blue"},
"practal-bound-variable": { "italic": true, "foreground": "green"},
"practal-custom-syntax": {"foreground": "normal"},
"practal-variable": {"foreground": "normal"},          
"practal-comment" : {"foreground": "weaker"},          
"practal-label" : {"foreground": "weak"},
"practal-square-braces" : {"foreground":"normal"},
"practal-punctuation" : {"foreground":"normal"},
"practal-syntax-fragment" : {"foreground":"normal"},
"practal-syntax-optional-space" : {"foreground": "weak", "underline": true},
"practal-syntax-mandatory-space" : {"underline": true, "foreground":"magenta"},
"practal-latex-syntax" : {"foreground":"normal"},
"practal-latex-space" : {},
"practal-latex-control-sequence" : { "italic": true, "foreground" : "violet"},
"practal-round-braces": {"foreground": "weakest"}
`;

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
    ["green", "#859900"]
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
    ["green", "#859900"]
];

function transform(rules : string, colormap : ColorMap) : string {
    for (const [name, color] of colormap) {
        while (true) {
            let replaced = rules.replace(`"${name}"`, `"${color}"`);
            if (replaced !== rules) {
                rules = replaced;
            } else break;
        }
    }
    return rules;
}

function show(descr : string, colormap : ColorMap) {
    console.log("===== " + descr);
    console.log(transform(semanticTokenColorizations, colormap));
}

show("solarized dark", solarized_dark);
show("solarized light", solarized_light);


