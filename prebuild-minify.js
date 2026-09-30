const fs = require("fs");
const path = require("path");
const stdout = process.stdout;
const UglifyJS = require("terser");
const CleanCSS = require("clean-css");
JSON.minify = require("node-json-minify");

const root = path.join(__dirname, "prebuild-src");

function writeMinified(file, data) {
    return new Promise((res, rej) => {
        fs.writeFile(file, data, (err) => {
            if (err) {
                stdout.write(" -  ❌\n\n\n", () => {
                    rej(err);
                });
                return;
            }
            stdout.write(" -  ✓\n", () => {
                res();
            });
        });
    });
}

async function recursiveMinify(dirPath) {
    let files;
    try {
        files = fs.readdirSync(dirPath);
    } catch {
        return;
    }
    for (const name of files) {
        const filePath = path.join(dirPath, name);
        if (!fs.statSync(filePath).isFile()) {
            // Dependencies are installed after this runs; anything already here is a leftover.
            if (name !== "node_modules") await recursiveMinify(filePath);
            continue;
        }

        // JSON stays as it is, so themes and keyboard layouts remain readable in the config folder
        // they are copied to — except icons.json, which nobody reads by hand.
        // `continue`, not `return`: returning abandoned the rest of the directory, so
        // everything alphabetically after the first .json went unminified — including
        // whole subdirectories.
        if (filePath.endsWith(".json") && !filePath.endsWith("icons.json")) continue;
        // See #446
        if (filePath.endsWith("file-icons-match.js")) continue;
        stdout.write(path.relative(root, filePath)+"...");

        switch (filePath.split(".").pop()) {
            case "js": {
                // terser 5 rejects on a syntax error instead of returning {error}.
                let minified;
                try {
                    minified = await UglifyJS.minify(fs.readFileSync(filePath, {encoding: "utf-8"}), {
                        compress: {
                            dead_code: false,
                            unused: false
                        },
                        output: {
                            beautify: false,
                            ecma: 6
                        }
                    });
                } catch (err) {
                    stdout.write(" -  ❌\n\n\n");
                    throw err;
                }
                await writeMinified(filePath, minified.code);
                break;
            }
            case "css": {
                const output = new CleanCSS({level:2}).minify(fs.readFileSync(filePath, {encoding:"utf-8"}));
                if (output.errors.length >= 1) {
                    stdout.write(" -  ❌\n\n\n");
                    throw new Error(output.errors.join("\n"));
                }
                await writeMinified(filePath, output.styles);
                break;
            }
            case "json": {
                let out;
                try {
                    out = JSON.minify(fs.readFileSync(filePath, {encoding:"utf-8"}));
                } catch(err) {
                    stdout.write(" -  ❌\n\n\n");
                    throw err;
                }
                await writeMinified(filePath, out);
                break;
            }
            default:
                stdout.write("\n");
        }
    }
}

recursiveMinify(root);
