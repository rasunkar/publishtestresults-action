const {globSync} = require('glob');
const path = require('path');

var isNullOrWhitespace = function(input) {
    if (typeof input === 'undefined' || input === null) {
        return true;
    }
    return input.replace(/\s/g, '').length < 1;
}
exports.isNullOrWhitespace = isNullOrWhitespace;

var parseBooleanValue = function(input, defaultValue) {
    if (isNullOrWhitespace(input)) {
        return defaultValue;
    }
    return JSON.parse(input);
}
exports.parseBooleanValue = parseBooleanValue;


/**
 * Determines the find root from a list of patterns. Performs the find and then applies the glob patterns.
 * Supports interleaved exclude patterns. Unrooted patterns are rooted using defaultRoot, unless
 * matchOptions.matchBase is specified and the pattern is a basename only. For matchBase cases, the
 * defaultRoot is used as the find root.
 *
 * @param  defaultRoot   default path to root unrooted patterns. falls back to System.DefaultWorkingDirectory or process.cwd().
 * @param  patterns      pattern or array of patterns to apply
 * @param  findOptions   defaults to { followSymbolicLinks: true }. following soft links is generally appropriate unless deleting files.
 */
var findGlobMatch = function(defaultRoot, patterns, findOptions) {
    var allMatchingFiles = [];
    patterns.forEach(pattern => {
        var directoryPath = path.join(defaultRoot, pattern);
        console.log("Directory Path"+ directoryPath);
        const matchingFiles = globSync(patterns, findOptions);    
        allMatchingFiles.push(matchingFiles);
    });

    console.log("Matching files:" + allMatchingFiles);
    return allMatchingFiles;
}
exports.findGlobMatch = findGlobMatch;