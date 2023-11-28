# Publish Test Results GitHub Action

This action was created to upload test results either in TRX or JUNIT format to Azure DevOps from a GitHub workflow using [Azure DevOps Publish Test Results task](https://learn.microsoft.com/en-us/azure/devops/pipelines/tasks/reference/publish-test-results-v2). Most of the commonly used properties in the [Azure DevOps Publish Test Results task](https://learn.microsoft.com/en-us/azure/devops/pipelines/tasks/reference/publish-test-results-v2) map to properties of this GitHub action. Like the [Azure DevOps Publish Test Results task](https://learn.microsoft.com/en-us/azure/devops/pipelines/tasks/reference/publish-test-results-v2), this action only supports `Windows` but NOT `Linux`.

Due to the unavailability of a Test results UI, test results are displayed in the console logs of the action.

## Usage

See [action.yml](action.yml)

## Example

```yaml
jobs:
  my_action_job:
    runs-on: windows-latest
    name: A job to run VSTest
    steps:
      - name: Download tests binary zip
        run: powershell Invoke-WebRequest -Uri "https://localworker.blob.core.windows.net/win-x64/tests.zip" -OutFile "./tests.zip"
      - name: Unzip tests binary
        run: powershell Expand-Archive -Path tests.zip -DestinationPath ./
      - name: Run tests
        uses: microsoft-approved-actions/vstest@master
        with:
          testAssembly: CloudTest.DefaultSamples*.dll
          searchFolder: ./tests/
          runInParallel: true
      - name: Publish Test Results
        uses: rasunkar/publishtestresults-action@v1.0.0-beta
        id: PublishTestResults
        with:
            testResultsFormat: 'VSTest'
            testResultsFiles: '**/*.trx'
            searchFolder: ${{ github.workspace }}
            mergeTestResults: true
            testRunTitle: "GitHub#TestResults#"
            failTaskOnFailedTests: false
            adoOrganizationName: "rasunkar"
            adoProjectName: "ADO TCM"
        env:
          ADO_ACCESS_TOKEN: ${{ secrets.ADO_ACCESS_TOKEN }}
```


