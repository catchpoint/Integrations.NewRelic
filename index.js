'use strict';
const { PubSub } = require('@google-cloud/pubsub');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '.env') });
const newRelicApi = require('./new-relic-metric-api.js');
const topicName = process.env.TopicName;

const TOTAL_HOPS_METRIC = 'catchpoint_TotalHops';
const ROUND_TRIP_TIME_AVERAGE_METRIC = 'catchpoint_RoundTripTimeAvg';
const PACKET_LOSS_PERCENT_METRIC = 'catchpoint_PacketLossPct';
const TRACEROUTE_TEST_ID = 12;
const PING_TEST_ID = 6;
const PACKET_LOSS_MULTIPLIER = 33.333;

/**
 * Publishes a message to a Google Cloud Pub/Sub Topic.
 */
exports.catchpointNewRelicPublish = async (req, res) => {
    console.log(`Publishing message to topic ${topicName}.`);
    const pubsub = new PubSub();
    const topic = pubsub.topic(topicName);
    const data = JSON.stringify(req.body);
    const message = Buffer.from(data, 'utf8');
    try {
        await topic.publish(message);
        res.status(200).send(`Message published to topic ${topicName}.`);
    } catch (err) {
        console.error(err);
        res.status(500).send(err);
        return Promise.reject(err);
    }
};

/**
 * Triggered from a message on Google Cloud Pub/Sub topic.
 */
exports.catchpointNewRelicSubscribe = async (message) => {
    const data = Buffer.from(message.data, 'base64').toString();
    const catchpointData = JSON.parse(data);
    await postToNewRelic(catchpointData);
};

/**
 * Handles parsing Catchpoint webhook data,
 * constructs time series object and writes time series object to New Relic Metrics API. 
 */
async function postToNewRelic(response) {
    const testId = response.TestId;
    const nodeName = response.NodeName;
    const timingMetricsKeys = Object.keys(response.Summary.Timing);
    const timestamp = timeStampInSeconds(response.Summary.Timestamp);
    let errorCode;
    let params = {}
    if (response.Summary.hasOwnProperty('Error')) {
        errorCode = response.Summary.Error.Code
        params['errorCode'] = errorCode;
    }
    /** New Relic Metric API requires data to be sent in the below Json format [{ 
        "metrics":[{
            "name":"memory.heap",
            "type":"gauge",
            "value":2.3,
            "timestamp":CURRENT_TIME_IN_MILLISECONDS_HERE,
            "attributes":{"host.name":"dev.server.com"}
        }] 
    */
    let newRelicJsonString = '[{"metrics":[]}]';
    let newRelicJsonPayload = JSON.parse(newRelicJsonString);
    processTestData(testId, nodeName, timestamp, response.Summary.Timing, newRelicJsonPayload[0].metrics);

    if (response.Summary.hasOwnProperty('Error')) {
    	processErrorTestData(testId, nodeName, timestamp, response.Summary.Error, newRelicJsonPayload[0].metrics, params);
    }

    if (response.Summary.hasOwnProperty('Byte')) {
        processTestData(testId, nodeName, timestamp, response.Summary.Byte.Response, newRelicJsonPayload[0].metrics);
    }

    if (response.hasOwnProperty('TestDetail')) {
        processTestData(testId, nodeName, timestamp, response.TestDetail, newRelicJsonPayload[0].metrics);
    }

    if (response.Summary.Timing.hasOwnProperty('ContentType')) {
        processTestData(testId, nodeName, timestamp, response.Summary.Timing.ContentType, newRelicJsonPayload[0].metrics);
    }

    /** If test type is Traceroute then compute RTT, Packet Loss, #Hops.*/
    if (response.TestDetail.TypeId === TRACEROUTE_TEST_ID) {
        processTracerouteTestData(testId, nodeName, timestamp, response.Diagnostic.TraceRoute, newRelicJsonPayload[0].metrics);
    }

    /** If test type is Ping then compute RTT, Packet Loss */
    else if (response.TestDetail.TypeId === PING_TEST_ID) {
        processTestData(testId, nodeName, timestamp, response.Summary.Ping, newRelicJsonPayload[0].metrics);
    }

    newRelicApi.postDataToNewRelic(newRelicJsonPayload, function (response) {
        console.log("New Relic Request Id: " + response.requestId);
        console.log("Finished posting data to New Relic...");
    });
	const testId = response.TestId;
	const nodeName = response.NodeName;
	const timingMetricsKeys = Object.keys(response.Summary.Timing);
	const timestamp = timeStampInSeconds(response.Summary.Timestamp);

	/** New Relic Metric API requires data to be sent in the below Json format [{ 
		"metrics":[{ 
		   "name":"memory.heap", 
		   "type":"gauge", 
		   "value":2.3, 
		   "timestamp":CURRENT_TIME_IN_MILLISECONDS_HERE, 
		   "attributes":{"host.name":"dev.server.com"} 
		   }] 
		}]
	*/
	let newRelicJsonString = '[{"metrics":[]}]';
	let newRelicJsonPayload = JSON.parse(newRelicJsonString);
	processTestData(testId, nodeName, timestamp, response.Summary.Timing, newRelicJsonPayload[0].metrics);

	if (response.Summary.Timing.hasOwnProperty('ContentType')) {
	    processTestData(testId, nodeName, timestamp, response.Summary.Timing.ContentType, newRelicJsonPayload[0].metrics);
	}

	/** If test type is Traceroute then compute RTT, Packet Loss, #Hops.*/
	if (response.TestDetail.TypeId === TRACEROUTE_TEST_ID) {
	    processTracertTestData(testId, nodeName, timestamp, response.Diagnostic.TraceRoute, newRelicJsonPayload[0].metrics);
	}

	/** If test type is Ping then compute RTT, Packet Loss */
	else if (response.TestDetail.TypeId === PING_TEST_ID) {
	    processTestData(testId, nodeName, timestamp, response.Summary.Ping, newRelicJsonPayload[0].metrics);
	}

	newRelicApi.postDataToNewRelic(newRelicJsonPayload, function (response) {
	    console.log("New Relic Request Id: " + response.requestId);
	    console.log("Finished posting data to New Relic...");
	});
}

/**
 * Converts timestamp string to a supported format and returns time in milliseconds.
 * For example, If timestamp string is '20201030120547624', converts to '2020-10-30T12:05:47Z' 
 */
function timeStampInSeconds(timestamp) {
    let timeStampIndexesToReplace = [0, 4, 6, 8, 10, 12, 14, 16];
    let formattedTimeStamp = '';
    let temp;
    for (var i = 0; i < timeStampIndexesToReplace.length - 1; i++) {
        temp = timestamp.substring(timeStampIndexesToReplace[i], timeStampIndexesToReplace[i + 1]);
        if (i === 0 || i === 1) {
            formattedTimeStamp = formattedTimeStamp + temp + '-';
        }
        else if (i === 2) {
            formattedTimeStamp = formattedTimeStamp + temp + 'T';
        }
        else if (i === 3 || i === 4) {
            formattedTimeStamp = formattedTimeStamp + temp + ':';
        }
        else if (i === 5) {
            formattedTimeStamp = formattedTimeStamp + temp + 'Z';
        }
        else if (i > 5) {
            break;
        }
    }

    let date = new Date(formattedTimeStamp);
    let seconds = date.getTime();
    return seconds;
}

/**
 * Constructs New Relic metric data point object with metric names, type, value, timestamp and attributes along with error code.
 */
function parseTimeSeriesData(metricName, metricValue, testId, nodeName, timeStamp, params = null) {
    let payloadBuilder = {
        name: metricName,
        type: 'gauge',
        value: metricValue,
        timestamp: timeStamp,
        attributes: {
            nodeName: nodeName,
            testId: testId,
        }
    };
    if (params != null && params['errorCode'] != null)
        payloadBuilder['attributes']['errorCode'] = params['errorCode']

    return payloadBuilder;

/**
 * Constructs New Relic metric data point object with metric names, type, value, timestamp and attributes.
 */
function parseTimeSeriesData(metricName, metricValue, testId, nodeName, timeStamp) {
	let payloadBuilder = {
		name: metricName,
		type: 'gauge',
		value: metricValue,
		timestamp: timeStamp,
		attributes: {
			nodeName: nodeName,
			testId: testId
		}
	};
	return payloadBuilder;
}

/**
 * Create/Map key:value pairs for all the metrics and add to New Relic object.
 */
function processTestData(testId, nodeName, timestamp, testData, metrics) {
    const metricKeys = Object.keys(testData);
    for (var i = 0; i < metricKeys.length; i++) {
        let metricValue = testData[metricKeys[i]];
        let metricIdentifier = 'catchpoint_' + metricKeys[i];
        let data = parseTimeSeriesData(metricIdentifier, metricValue, testId, nodeName, timestamp);
        metrics.push(data);
    }
}

/**
 * Create/Map key:value pairs for all the metrics with error type and add to New Relic object.
 */
function processErrorTestData(testId, nodeName, timestamp, testData, metrics, params = null) {
    const metricKeys = Object.keys(testData);
    for (var i = 0; i < metricKeys.length; i++) {
        let metricValue = testData[metricKeys[i]];
        let metricIdentifier = 'catchpoint_error_' + metricKeys[i];
        let data = parseTimeSeriesData(metricIdentifier, metricValue, testId, nodeName, timestamp, params);
        metrics.push(data);
    }
}

/**
 * Compute RTT, Packet Loss, #Hops for Trace Route test and add to New Relic object.
 */
function processTracerouteTestData(testId, nodeName, timestamp, testData, metrics) {
    let data;
    let sumPingTime = 0;
    let packetLossCounter = 0;
    let pingCounter = 0;
    let numberOfHops = testData.Hops.length;

    for (var i = 0; i < 3; i++) {
        if (testData.Hops[numberOfHops - 1].RoundTripTimes[i] != null) {
            sumPingTime += testData.Hops[numberOfHops - 1].RoundTripTimes[i];
            pingCounter++;
        }
        if (testData.Hops[numberOfHops - 1].RoundTripTimes[i] == null) {
            packetLossCounter++;
        }
    }
    let rtt = parseInt((sumPingTime / pingCounter).toFixed());
    let packetLoss = parseInt((PACKET_LOSS_MULTIPLIER * packetLossCounter).toFixed());

    /** Data point for Total Number of Hops */
    data = parseTimeSeriesData(TOTAL_HOPS_METRIC, numberOfHops, testId, nodeName, timestamp);
    metrics.push(data);
    /** Data point for Round Trip Time */
    data = parseTimeSeriesData(ROUND_TRIP_TIME_AVERAGE_METRIC, rtt, testId, nodeName, timestamp);
    metrics.push(data);
    /** Data point for Packet Loss */
    data = parseTimeSeriesData(PACKET_LOSS_PERCENT_METRIC, packetLoss, testId, nodeName, timestamp);
    metrics.push(data);
}
