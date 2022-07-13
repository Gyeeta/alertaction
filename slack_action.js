
'use strict';

		require('console-stamp')(console, { 
			format: ':date(yyyy-mm-dd HH:MM:ss.l)::label:' 
		});

const 		https = require('https');
const 		url = require('url');
const 		axios = require('axios').default;
const 		HttpsProxyAgent = require('https-proxy-agent');

const		{getAlertAckURI, getAlertidURI} = require('./alerts_html.js');
const		{safetypeof} = require('./gyutil.js');

/*
 * Gyeeta supports Slack Messaging using either an Incoming Webhook or using Chat PostMessage 
 * 
 * List of Slack config params sent by Shyama :
 *
 * api_url 			: Mandatory : Can be a Webhook URL such as https://hooks.slack.com/services/CCC/XYZ/ABC or Chat PostMessage URL https://slack.com/api/chat.postMessage
 * is_chatpost			: Optional : If present indicates use of Chat PostMessage
 * channel			: Optional for Webhook URLs and Mandatory for Chat PostMessage URL : Can be the Channel ID or name
 * access_token			: Mandatory only for Chat PostMessage URL : e.g. xoxb-1234-abcd-abcd : Must have chat:write Scope
 * proxy_url			: Optional : HTTP/HTTPS Proxies allowed : e.g. 'http://proxy-host:1234'
 * tls_reject_unauthorized 	: Optional : If false will skip validation of invalid or self-signed TLS certificates
 */


let gstats = {
	nalerts		: 0,
	nsuccess	: 0,
	nfails		: 0,
	ninvalid	: 0,
	nwebhook	: 0,
	nchatpost	: 0,
	n500		: 0,
	n403		: 0,
	n429		: 0,
	n400		: 0,
	n404		: 0,

	lasterr		: '""',
};	

const gstatproto = {...gstats};

function printStats()
{
	console.info(`Slack Action Stats : Total Alerts ${gstats.nalerts}, Success ${gstats.nsuccess}, Slack Failures ${gstats.nfails}, Invalid ${gstats.ninvalid}, \n`,
			`\t\tSlack Webhook Alerts ${gstats.nwebhook}, Chat Postmessages ${gstats.nchatpost}, #500 Server Errors ${gstats.n500}, #403 Auth Errors ${gstats.n403}, \n`,
			`\t\t#429 Too Many Requests Errors ${gstats.n429}, #400 Bad Request Errors ${gstats.n400}, #404 Not Found Errors ${gstats.n404}, Last Error Message ${gstats.lasterr}\n`);

	if ((gstats.nalerts > Number.MAX_SAFE_INTEGER - 100) || (gstats.ninvalid > Number.MAX_SAFE_INTEGER - 100)) {
		console.info('Resetting Slack Action Stats as Stats Overflow likely...\n');
		gstats = {...gstatproto};
	}
}	

setInterval(printStats, 60 * 1000);

function axiosSend(optpost)
{
	axios.request(optpost).then(function (response) {
		if (response.data.ok === false) {
			gstats.nfails++;

			if (typeof response.error === 'string') {
				gstats.lasterr = response.error;
			}	
		}	
		else {
			gstats.nsuccess++;
		}	
	})
	.catch(function (error) {
		gstats.nfails++;

		if (safetypeof(error.response) === 'object') {
			if (error.response.status >= 500) {
				gstats.n500++;
			}	
			else if (error.response.status === 403) {
				gstats.n403++;
			}	
			else if (error.response.status === 429) {
				gstats.n429++;
			}	
			else if (error.response.status === 400) {
				gstats.n400++;
			}	
			else if (error.response.status === 404) {
				gstats.n404++;
			}	

			if (typeof error.response.data === 'string') {
				gstats.lasterr = error.response.data;
			}	
		}
	});
}	

function getSlackJSON(oalerts)
{
	if (!oalerts || !oalerts.alerts || 0 === oalerts.alerts.length || !oalerts.alerts[0].alertname) {
		return null;
	}	

	let			ostr = '{\n', hdrstr;
	const			nalerts = oalerts.alerts.length;

	let			talertname = oalerts.alerts[0].alertname.slice(0, 64);

	if (oalerts.alerts[0].alertname.length > 64) talertname += '...';

	if (!oalerts.close) {
		hdrstr = `"Gyeeta Alert : ${nalerts} Alert(s) Firing for ${talertname} "`;
		ostr += `"text" : ${hdrstr}, \n`;
	}
	else if (oalerts.expired) {
		hdrstr = `"Gyeeta Alert : ${nalerts} Alert Expired for ${talertname} "`;
		ostr += `"text" : ${hdrstr}, \n`;
	}
	else {
		hdrstr = `"Gyeeta Alert : ${nalerts} Alert Resolved for ${talertname} "`;
		ostr += `"text" : ${hdrstr}, \n`;
	}	

	ostr += `"blocks": [ { "type" : "header", "text" : { "type" : "plain_text", "text" : ${hdrstr}, "emoji": true } }, `;

	for (let i = 0; i < nalerts; ++i) {
		const 			ijson = oalerts.alerts[i];
		let			adata = ijson.alertdata;

		ostr += ` { "type": "section", "fields": [ { "type": "mrkdwn", "text" :  "*Alert ${i + 1} Metadata*`;

		for (const prop in ijson) {
			if (prop === 'alertdata') {
				continue;
			}	
			
			if (typeof ijson[prop] === 'string') {
				if (ijson[prop].length > 0) {
					ostr += `\n\n*${prop}* : \\"${JSON.stringify(ijson[prop]).slice(1, -1)}\\"`;
				}	
			}
			else {
				ostr += `\n\n*${prop}* : ${ijson[prop]}`;
			}
		}

		ostr += '\n" }';

		if (adata) {
			ostr += `, { "type": "mrkdwn", "text" :  "*Alert ${i + 1}  Data*`;

			for (const prop in adata) {
				if (typeof adata[prop] === 'string') {
					if (adata[prop].length > 0) {
						ostr += `\n*${prop}* : \\"${JSON.stringify(adata[prop]).slice(1, -1)}\\"`;
					}	
				}
				else {
					ostr += `\n*${prop}* : ${adata[prop]}`;
				}
			}

			ostr += '\n" }';
		}	

		ostr += `] }, { "type": "actions", "elements": [ `;

		if (adata) {
			ostr += ` { "type": "button", "text": { "type": "plain_text", "text": "Acknowledge Alert", "emoji": true }, "value": "acked", "url": "${getAlertAckURI(oalerts, ijson, 'acked').uri}" }, { "type": "button", "text": { "type": "plain_text", "text": "Set As Resolved", "emoji": true }, "value": "resolved", "url": "${getAlertAckURI(oalerts, ijson, 'resolved').uri}" }, `;
		}

		ostr += ` { "type": "button", "text": { "type": "plain_text", "text": "View in Gyeeta UI", "emoji": true }, "value": "ui", "url": "${getAlertidURI(oalerts, ijson).uri}" } ] } ${ i + 1 < nalerts ? ', { "type": "divider" }, ' : '' } `;

	}

	ostr += ']}';	// Keep the closing brace as the last character as channel adding in sendSlackAlert() will slice the last char

	return {
		json : ostr,
	}	
}

function sendSlackAlert(actobj)
{
	if (!actobj || !Array.isArray(actobj.actions)) {
		gstats.ninvalid++;
		return null;
	}	

	const 			slackdata = getSlackJSON(actobj);

	if (safetypeof(slackdata) !== 'object' || !slackdata.json) {
		gstats.ninvalid++;
		return null;
	}	
	
	const			headers = {
		'content-type'	: 'application/json; charset=utf-8;', 
		'User-Agent'	: 'Gyeeta Alerting',
	};	

	for (let i = 0; i < actobj.actions.length; ++i) {
		const		action = actobj.actions[i];

		if (action.type !== 'slack') {
			continue;
		}
		
		if (!action.config || !action.config.api_url) {
			gstats.ninvalid++;
			return null;
		}	

		if (typeof action.config.channel === 'string') {
			slackdata.json = slackdata.json.slice(0, -1) + `, "channel" : "${action.config.channel}" }`;
		}	

		gstats.nalerts++;

		if (typeof action.config.access_token === 'string') {
			headers.Authorization 	= `Bearer ${action.config.access_token}`;
		}	
		else {
			delete headers.Authorization;
		}

		const optpost = {
			method		: 'POST',
			url		: action.config.api_url,
			headers		: { ...headers, ...action.config.headers },
			data		: slackdata.json,
			timeout		: 60000,
		};

		if (typeof action.config.proxy_url === 'string' && action.config.proxy_url) {
			// Refer to https://github.com/axios/axios/issues/2072#issuecomment-567473812
			optpost.proxy		= false;

			const			proxy = url.parse(action.config.proxy_url);

			if (action.config.tls_reject_unauthorized === false) {
				proxy.rejectUnauthorized = false;
			}	

			optpost.httpsAgent	= new HttpsProxyAgent(proxy);
		}	
		else if (action.config.tls_reject_unauthorized === false) {
			optpost.httpsAgent	= new https.Agent({ rejectUnauthorized : false });
		}	

		axiosSend(optpost);
	}

}

module.exports = {
	sendSlackAlert,
};


