const { execFile } = require('child_process');
const core = require('@actions/core');
const github = require('@actions/github');
const path = require('path');
let uuid = require('uuid');
const os = require('os');
const fs = require('fs');
const superagent = require('superagent');
const AdmZip = require('adm-zip');
const util = require('./util');
const makeJson = require('./make.json');
const makeUtil = require('./make-util');

const MERGE_THRESHOLD = 100;
const TESTRUN_SYSTEM = 'AT#GitHubActionWorkflow';

async function publishTestResultsThroughExe() {
    console.log("publishtestresultsthroughexe() start");
    const testRunner = core.getInput('testResultsFormat');
    const testResultsFiles = core.getMultilineInput('testResultsFiles');
    let testRunTitle = core.getInput('testRunTitle');
    const publishRunAttachments = util.parseBooleanValue(core.getInput('publishRunAttachments'), false);
    let searchFolder = core.getInput('searchFolder');
    let mergeTestResults = util.parseBooleanValue(core.getInput('mergeTestResults'), false);
    const failTaskOnFailedTests = util.parseBooleanValue(core.getInput('failTaskOnFailedTests'), false);
    const failTaskOnMissingResultsFile = util.parseBooleanValue(core.getInput('failTaskOnMissingResultsFile'), false);
    const adoCollectionUri = "https://dev.azure.com/" + core.getInput('adoOrganizationName');
    const adoProjectName = core.getInput('adoProjectName');

    if (util.isNullOrWhitespace(searchFolder)) {
        searchFolder = process.env.RUNNER_TEMP;
    }

    if (process.env.RUNNER_TEMP && (!path.isAbsolute(searchFolder))) {
        searchFolder = path.join(process.env.RUNNER_TEMP, searchFolder);
    }

    if (util.isNullOrWhitespace(testRunTitle)) {
        const workflowName = github.workflow;
        const run_id = github.run_id;
        testRunTitle = TESTRUN_SYSTEM + "-" + workflowName + "-" + run_id;
    }

    testRunTitle = testRunTitle;

    console.log('testRunner: ' + testRunner);
    console.log('testResultsFiles: ' + testResultsFiles);
    console.log('mergeTestResults: ' + mergeTestResults);
    console.log('testRunTitle: ' + testRunTitle);
    console.log('publishRunAttachments: ' + publishRunAttachments);
    console.log('failTaskOnFailedTests: ' + failTaskOnFailedTests);
    console.log('failTaskOnMissingResultsFile: ' + failTaskOnMissingResultsFile);
    console.log('adoCollectionUri: ' + adoCollectionUri);
    console.log('adoProjectName: ' + adoProjectName);
    console.log('searchFolder:' + searchFolder);

    // Sending allowBrokenSymbolicLinks as true, so we don't want to throw error when symlinks are broken.
    // And can continue with other files if there are any.
    const findOptions = {
        cwd: searchFolder,
        nodir: true,
        absolute: true,
        omitBrokenSymbolicLinks: true,
        implicitDescendants: true,
        followSymbolicLinks: true
    };

    const matchingTestResultsFiles = await util.findGlobMatch(searchFolder, testResultsFiles, findOptions);

    const testResultsFilesCount = matchingTestResultsFiles ? matchingTestResultsFiles.length : 0;

    console.log('Detected ' + testResultsFilesCount + ' test result files');

    const forceMerge = testResultsFilesCount > MERGE_THRESHOLD;
    if (forceMerge) {
        console.log('Detected large number of test result files. Merged all of them into a single file and published a single test run to optimize for test result publish performance instead of publishing hundreds of test runs');
        mergeTestResults = true;
    }

    const args = getArguments(matchingTestResultsFiles);
    console.log("Arguments are" + args);

    execFile('modules/TestResultsPublisher.exe',
        args,
        {
            env: {
                ...process.env,
                testrunner: testRunner,
                owner: "GitHubTest",
                testruntitle: testRunTitle,
                collectionurl: adoCollectionUri,
                projectName: adoProjectName,
                accesstoken: process.env.ADO_ACCESS_TOKEN,
                testRunSystem: TESTRUN_SYSTEM,
                mergeresults: mergeTestResults,
            }
        },
        function (err, data) {
            console.log(err);
            console.log(data.toString());
        }
    );
}

function getArguments(matchingTestResultsFiles) {
    const responseFilePath = createResponseFile(matchingTestResultsFiles);
    if (responseFilePath == null) {
        return null;
    }

    // Adding '@' because this is a response file argument
    const args = ['@' + responseFilePath];

    return args;
}

function modifyMatchingFileName(matchingTestResultsFiles) {
    for (let i = 0; i < matchingTestResultsFiles.length; i++) {
        // We need to add quotes around the file name because the file name can contain spaces.
        // The quotes will be handled by response file reader.
        matchingTestResultsFiles[i] = '\"' + matchingTestResultsFiles[i] + '\"';
    }

    return matchingTestResultsFiles;
}

function createResponseFile(matchingTestResultsFiles) {
    let responseFilePath = null;
    try {
        const agentTempDirectory = process.env.RUNNER_TEMP
        // The response file is being created in agent temp directory so that it is automatically deleted after.
        responseFilePath = path.join(agentTempDirectory, uuid.v1() + '.txt');

        // Adding quotes around matching file names
        matchingTestResultsFiles = modifyMatchingFileName(matchingTestResultsFiles);

        // Preparing File content
        const fileContent = os.EOL + matchingTestResultsFiles.join(os.EOL);

        // Writing matching file names in the response file
        fs.writeFileSync(responseFilePath, fileContent);
    } catch (ex) {
        // Log telemetry and return null path
        console.error('exception', ex);

        console.error("Exception while writing to response file: " + ex);
        return null;
    }

    return responseFilePath;
}

async function downloadExternals() {
    if (makeJson.hasOwnProperty('externals')) {
        console.log('');
        console.log('> start getting task externals');
        // .zip files
        var externals = makeJson.externals;
        if (externals.hasOwnProperty('archivePackages')) {
            var archivePackages = externals.archivePackages;

            archivePackages.forEach(async archive => {
                makeUtil.assert(archive.url, 'archive.url');
                makeUtil.assert(archive.dest, 'archive.dest');
                await downloadArchive(archive.url);
            });
        }
        console.log('> finished getting task externals');
    }

}

async function downloadArchive(zipUrl) {
    var downloadPath = path.join(__dirname, '_download');
    if (!makeUtil.pathExists(downloadPath)) {
        makeUtil.mkdir(downloadPath);
    }
    const filePath = path.join(downloadPath, 'PublishTestResults.zip');

    // Create a writable stream
    const output = fs.createWriteStream(filePath);

    // Make a GET request and pipe the response to the output stream
    superagent.get(zipUrl).pipe(output);

    // Handle the finish event
    output.on('finish', async () => {
        console.log('Zip file downloaded successfully');
        // Create an instance of the zip file
        const zip = new AdmZip(filePath);

        // Extract the zip file to a directory
        zip.extractAllTo('.', true);

        console.log('Extracted the zip file');

        makeUtil.rm(filePath);

        // call through exe
        await publishTestResultsThroughExe();
    });
}

async function run() {
    // download externals
    await downloadExternals();

}

run();
