# Catchpoint and New Relic Integrations 

## Introduction

Catchpoint’s Test Data Webhook feature allows Catchpoint to easily integrate with other tools with its push mechanism. This feature pushes test performance metrics on every run if it's enabled.

This integration uses the Catchpoint Test Data Webhook and the New Relic Metrics API to push data to the New Relic platform. In order to accomplish this setup, we rely on a third-party cloud function, which will accept data from the Catchpoint API, process it, and forward to New Relic. This integration enables DevOps team to visualize Catchpoint's digital experience of end users with New Relic’s Application Performance Monitoring (APM).

The following test types and metrics are supported:

### Catchpoint Tests

#### Supported Metrics Definition

1. **Connect**: The time to establish a connection with a specific URL. Reported in milliseconds.

1. **DNS**: The time to resolve the primary URL. Reported in milliseconds.

1. **Content Load**: The time to load all components, from the first byte to the last byte, from the provided URL. Reported in milliseconds.

1. **Document Complete**: The time to render the full webpage. Reported in milliseconds.

1. **Round Trip Time**: Time difference between the client initiating a request and the client receiving a response. Reported in milliseconds.

1.  **Packet Loss**: Percentage of total packet loss.

#### Supported Tests with Respective Metrics

1. **Web Test**: Connect, DNS, Content Load, Document Complete.

1. **Transaction Test**: Connect, DNS, Content Load, Document Complete.
   
1. **API Test**: Connect, DNS, Content Load.

1. **Traceroute Test**:  Packet Loss , Round Trip Time, Number of Hops.

1. **Ping Test**:  Packet Loss, Round Trip Time.

1. **DNS Test**:  Response Time.

##  Prerequisites

- Google Cloud project
- New Relic Account

## Installation and Configuration

 ### Google Cloud setup:
 
#### Install cloud SDK on your local machine

1. Download the [Cloud SDK installer.](https://dl.google.com/dl/cloudsdk/channels/rapid/GoogleCloudSDKInstaller.exe)

1. Launch the installer and follow the prompts. The installer is signed by Google LLC. Cloud SDK requires Python. Supported versions are 3.5 to 3.7, and 2.7.9 or higher. The installer will install all necessary dependencies, including the needed Python version.

1. After installation has completed, select `Start Cloud SDK Shell` option.

_Note : The installer starts a terminal window and runs the_ `gcloud init` _command._

#### Enabling Google Cloud functions.

1. Go to the project selector page

1. Make sure that billing is enabled for your Google Cloud project. [Learn how to confirm billing is enabled for your project](https://cloud.google.com/billing/docs/how-to/modify-project).

1. Enable the [Cloud Functions and Cloud Pub/Sub APIs.](https://console.cloud.google.com/flows/enableapi?apiid=cloudfunctions,pubsub&redirect=https://cloud.google.com/functions/docs/tutorials/pubsub)

1. Install and initialize the Cloud SDK.

1. Update gcloud components:  
`$ $ gcloud components update`

#### Set up the Google Cloud Monitoring Repository locally

1. Clone this repository into a working directory.  
`$ git clone https://git.catchpoint.net/Integrations/NewRelicWebhook.git`

1. In the `.env` file from NewRelic-Webhook directory, update `newRelicApiKey`.

1. To Find or register an Insert API key for your New Relic account: Go to `one.newrelic.com`  > `account dropdown` > `Account settings` > `API keys`, and select `Insights API keys`.

#### Updating node modules

1. Open Google Cloud SDK Shell and navigate to the directory where the NodeJS scripts were extracted.
`$ cd <path to extracted directory/Integrations.GoogleCloudMonitoring/Stackdriver-Webhook/> `

1. Execute the following chain of commands in the same order. This is done to update all packages to a new major version.

a. $ npm install -g npm-check-updates
b. $ ncu -u
c. $ npm update
d. $ npm install

_Note: Run `npm fund` if prompted

#### Deploying Google Cloud functions.

Open Google Cloud SDK Shell and navigate to the directory where the NodeJS scripts was extracted.  
`$ cd <path to extracted directory/NewRelicWebhook/>;`

 1. Deploy publish function:  
   `$ gcloud functions deploy catchpointNewRelicPublish --trigger-http --runtime nodejs14 --timeout=180 --trigger-http --allow-unauthenticated`

    Copy the URL once the deployment is successful. This will be webhook URL which will be added in Catchpoint portal.
    
 1. Deploy Subscribe function:  
   `$ gcloud functions deploy catchpointNewRelicSubscribe --trigger-topic catchpoint-webhook --timeout=180 --runtime nodejs14 --allow-unauthenticated`
      
####  Set up the Catchpoint Test Data Webhook.

Add the URL copied from Google Cloud to Catchpoint.

1. In Catchpoint, from Settings go to [API page](https://portal.catchpoint.com/ui/Content/Administration/ApiDetail.aspx).

1. Under Test Data Webhook add the copied URL.

1. Select default JSON for Test Data Webhook and save the changes

_Note: Test Data Webhook should be enabled under the test properties page._

## Results

To create dashboards, go to [one.newrelic.com](https://one.newrelic.com/) and click on Dashboards on the top navigation menu.

1. Select the `Create a dashboard` button located at the top-right corner of the dashboards index.

1. Name your dashboard. Select the account the dashboard belongs to. Choose carefully because `this action cannot be modified`.

1. Press `Create` to continue.

1. From the [data explorer](https://docs.newrelic.com/docs/query-your-data/explore-query-data/data-explorer/introduction-data-explorer) and [query builder](https://docs.newrelic.com/docs/query-your-data/explore-query-data/query-builder/introduction-query-builder) features. Use the `+ Add to your dashboard` button and select the Add a chart option.

1. In the Add widget window, select Data Type as Metrics.

1. Input `catchpoint` in the `View a chart with` text box.

	All the Catchpoint specific metrics will have Identifiers in the following format.

	`catchpoint_Connect`  
	`catchpoint_Dns`  
	`catchpoint_Load`  

1. Alternatively, we can use NRQL to draw charts by adding multiple metrics.

	Example NRQL queries to retrieve data:

	`SELECT latest(catchpoint_Client),latest(catchpoint_Connect),latest(catchpoint_ContentLoad),latest(catchpoint_Dns),latest(catchpoint_DocumentComplete) FROM Metric WHERE testId= 1216003 TIMESERIES FACET `testId` LIMIT 10 SINCE 1800 seconds ago`

	`SELECT latest(catchpoint_RoundTripTimeAvg), latest(catchpoint_PacketLossPct), latest(catchpoint_TotalHops) FROM Metric `
