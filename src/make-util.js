// modules
var fs = require('fs');
var path = require('path');
var shell = require('shelljs');
var ncp = require('child_process');

// global paths
var repoPath = __dirname;
var downloadPath = path.join(repoPath, '_download');

//------------------------------------------------------------------------------
// shell functions
//------------------------------------------------------------------------------
var shellAssert = function () {
    var errMsg = shell.error();
    if (errMsg) {
        throw new Error(errMsg.toString());
    }
}

var cd = function (dir) {
    var cwd = process.cwd();
    if (cwd != dir) {
        console.log('');
        console.log(`> cd ${path.relative(cwd, dir)}`);
        shell.cd(dir);
        shellAssert();
    }
}
exports.cd = cd;

var cp = function (options, source, dest) {
    if (dest) {
        shell.cp(options, source, dest);
    }
    else {
        shell.cp(options, source);
    }

    shellAssert();
}
exports.cp = cp;

var mkdir = function (options, target) {
    if (target) {
        shell.mkdir(options, target);
    }
    else {
        shell.mkdir(options);
    }

    shellAssert();
}
exports.mkdir = mkdir;

var rm = function (options, target) {
    if (target) {
        shell.rm(options, target);
    }
    else {
        shell.rm(options);
    }

    shellAssert();
}
exports.rm = rm;

var test = function (options, p) {
    var result = shell.test(options, p);
    shellAssert();
    return result;
}
exports.test = test;
//------------------------------------------------------------------------------

var assert = function (value, name) {
    if (!value) {
        throw new Error('"' + name + '" cannot be null or empty.');
    }
}
exports.assert = assert;

var ensureExists = function (checkPath) {
    assert(checkPath, 'checkPath');
    var exists = test('-d', checkPath) || test('-f', checkPath);

    if (!exists) {
        fail(checkPath + ' does not exist');
    }
}
exports.ensureExists = ensureExists;

var pathExists = function (checkPath) {
    return test('-d', checkPath) || test('-f', checkPath);
}
exports.pathExists = pathExists;

var fileToJson = function (file) {
    var jsonFromFile = JSON.parse(fs.readFileSync(file).toString());
    return jsonFromFile;
}
exports.fileToJson = fileToJson;