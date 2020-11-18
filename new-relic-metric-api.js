const unirest = require('unirest');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '.env' )});
const newRelicApiKey = process.env.NewRelicApiKey;

// [START function_postDataToNewRelic]
/**
 * Sends the JSON or metric data to New Relic Metric API endpoint.
 */
module.exports = {
	postDataToNewRelic: function (data, callback) {
		unirest
			.post('https://metric-api.newrelic.com/metric/v1')
			.headers({
				'Api-Key': newRelicApiKey,
				'Content-Type': 'application/json'
			})
			.send(data)
			.then((response) => {
				console.log("Response code from newrelic metric API: " + response.code)
				callback(response.body);
			});
	}
}
