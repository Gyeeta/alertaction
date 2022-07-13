
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
 * Gyeeta uses Pagerduty Events API v2 incidents. Grouped Alerts will be sent as separate individual Pager incidents...
 *
 * List of Pagerduty config params sent by Shyama :
 *
 * api_url 			: Optional : Default is https://events.pagerduty.com/v2/enqueue
 * routing_key			: Mandatory : The Integration Key for Events API v2.
 * proxy_url			: Optional : HTTP/HTTPS Proxies allowed : e.g. 'http://proxy-host:1234'
 * tls_reject_unauthorized 	: Optional : If false will skip validation of invalid or self-signed TLS certificates
 */


let gstats = {
	nalerts		: 0,
	ngrpalerts	: 0,
	nsuccess	: 0,
	nfails		: 0,
	ninvalid	: 0,
	n500		: 0,
	n429		: 0,
	n400		: 0,
	n404		: 0,

	lasterr		: '""',
};	

const gstatproto = {...gstats};

function printStats()
{
	console.info(`Pagerduty Action Stats : Total Alerts ${gstats.nalerts}, Total Grouped Alerts ${gstats.ngrpalerts}, Potential Success ${gstats.nsuccess}, Failures ${gstats.nfails}, \n`, 
			`\t\tInvalid ${gstats.ninvalid}, #5xx Server Errors ${gstats.n500}, #429 Too Many Requests Errors ${gstats.n429}, \n`,
			`\t\t#400 Bad Request Errors ${gstats.n400}, #404 Not Found Errors ${gstats.n404}, Last Error Message ${gstats.lasterr}\n`);

	if ((gstats.nalerts > Number.MAX_SAFE_INTEGER - 100) || (gstats.ninvalid > Number.MAX_SAFE_INTEGER - 100)) {
		console.info('Resetting Pagerduty Action Stats as Stats Overflow likely...\n');
		gstats = {...gstatproto};
	}
}	

setInterval(printStats, 60 * 1000);

function axiosSend(optpost)
{
	axios.request(optpost).then(function (response) {
		gstats.nsuccess++;
	})
	.catch(function (error) {
		gstats.nfails++;

		if (safetypeof(error.response) === 'object') {
			if (error.response.status >= 500) {
				gstats.n500++;
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

			if (safetypeof(error.response.data) === 'object' && typeof error.response.data.message === 'string') {
				gstats.lasterr = error.response.data.message;
			}	
		}
	});
}	

function getPayload(oalerts, alert1)
{
	if (!oalerts || !alert1 || !alert1.alertname) {
		return null;
	}	

	let			talertname = alert1.alertname.slice(0, 64), typstr, srcstr, links, event_action;

	if (alert1.alertname.length > 64) talertname += '...';

	if (!oalerts.close) {
		typstr = 'Firing';

		if (alert1.alertdata && alert1.alertdata.host) {
			srcstr = alert1.alertdata.host;
		}
		else if (alert1.alertdata && alert1.alertdata.cluster) {
			srcstr = alert1.alertdata.cluster;
		}
		else {
			srcstr = alert1.subsys;
		}	

		links = [
			{
				href	:	getAlertAckURI(oalerts, alert1, 'acked').uri,
				text	:	'Acknowledge Alert'
			},
			{
				href	:	getAlertAckURI(oalerts, alert1, 'resolved').uri,
				text	:	'Set as Resolved'
			},
			{
				href	:	getAlertidURI(oalerts, alert1).uri,
				text	:	'View in Gyeeta UI'
			},
		];

		event_action = 'trigger';
	}
	else {
		if (oalerts.expired) {
			typstr = 'Expired';
		}
		else {
			typstr = 'Resolved';
		}	

		srcstr = alert1.subsys;

		links = [
			{
				href	:	getAlertidURI(oalerts, alert1).uri,
				text	:	'View in Gyeeta UI'
			},
		];

		event_action = 'resolve';
	}

	return {
		payload : {
			summary 	:	`Gyeeta Alerts : Alert ${typstr} for ${talertname}`,
			timestamp	:	alert1.alerttime,
			source		:	srcstr,
			severity	:	(alert1.severity === 'critical' || alert1.severity === 'warning') ? alert1.severity : 'info',
			component	:	alert1.subsys,
			custom_details	: 	alert1,
		},	
		
		dedup_key	:	alert1.alertid,
		links		:	links,
		event_action	:	event_action,
		client		:	'Gyeeta Alerting',
		client_url	:	oalerts.weburl,
	};	
}

function sendPagerAlert(actobj)
{
	if (!actobj || !Array.isArray(actobj.actions)) {
		gstats.ninvalid++;
		return null;
	}	

	gstats.ngrpalerts++;

	const headers = {
		'Content-Type'	: 'application/json', 
		'User-Agent'	: 'Gyeeta Alerting',
	};	

	/*
	 * We send individual alerts within a group as separate pagers since the dedup_key is to be tied with alertid
	 */
	const			objarr = [];

	for (const alert1 of actobj.alerts) {
		const			obj = getPayload(actobj, alert1);
		
		if (!obj) {
			gstats.ninvalid++;
			return null;
		}

		objarr.push(obj);
	}	
 
	for (let i = 0; i < actobj.actions.length; ++i) {
		const		action = actobj.actions[i];

		if (action.type !== 'pagerduty') {
			continue;
		}
		
		if (!action.config || !action.config.api_url || !action.config.routing_key) {
			gstats.ninvalid++;
			return null;
		}	

		const optpost = {
			method		: 'POST',
			url		: action.config.api_url,
			headers		: { ...headers, ...action.config.headers },
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

		for (const obj of objarr) {
			const			options = {...optpost};

			obj.routing_key		= action.config.routing_key;
			options.data		= obj;

			gstats.nalerts++;

			axiosSend(options);
		}	
	}
}

module.exports = {
	sendPagerAlert,
};


