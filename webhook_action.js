
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
const		{getAccessToken, setNextTryRefresh} = require('./gy_oauth2.js');

/*
 * List of Webhook options :
 *
 * api_url 			: Mandatory : The Webhook URL to send the HTTP Post to
 *
 * auth_type 			: Mandatory : 4 valid types none, basic_auth, bearer and oauth2 : If 'none' is specified no authentication will be done.
 *
 * For auth_type basic_auth :
 * username			: Mandatory if auth_type is basic_auth Ignored otherwise
 * password			: Mandatory if auth_type is basic_auth Ignored otherwise
 * 
 * For auth_type bearer :
 * bearer_token			: Mandatory if auth_type is bearer Ignored otherwise
 *
 * For auth_type oauth2 (Only Client Credentials grant type supported. Both Authorization Header and Body format params supported) :
 * clientid			: Mandatory : registered client id of the application
 * client_secret		: Mandatory : registered client secret of the application
 * access_url			: Mandatory : Endpoint for token generation (e.g. https://accounts.google.com/o/oauth2/token)
 * refresh_token		: Optional : If provided then Gyeeta will use it to generate a new access token if existing one expires or fails
 * access_token			: Mandatory only if refresh_token is absent : Indicates an existing OAuth2 Access Token
 * expires_in			: Optional : Indicates Time in sec from current time when the access_token will expire (expires at current + this value in sec)
 * expires_at			: Optional : Indicates Time in msec from 1970 when the access_token will expire (expires at this value in msec)
 * scope			: Optional : Space or comma separated string containing list of scopes
 * use_auth_header		: Optional : Default true : Indicates whether to send the Client ID/Secret using Authentication Header or Form Body Params
 * 
 * Following options can be overriden :
 *
 * proxy_url			: Optional : HTTP/HTTPS Proxies allowed : e.g. 'http://proxy-host:1234'
 * tls_reject_unauthorized 	: Optional : If set to false will skip validation of invalid or self-signed TLS certificates
 * headers			: Optional : Custom Headers to be sent : Needs to be an Object as in "headers" : { "x-processed" : true, "x-mykeys" : [ "val1", "val2" ] }
 * data_format			: Optional : Format of the payload : Currently only 1 format supported : generic. 
 *
 */

let gstats = {
	nalerts		: 0,
	ngrpalerts	: 0,
	nsuccess	: 0,
	nfails		: 0,
	ninvalid	: 0,
	noauthfails	: 0,
	n500		: 0,
	n429		: 0,
	n401		: 0,
	n403		: 0,
	n400		: 0,
	n404		: 0,

	lasterr		: '""',
	lastoautherr	: '""',
};	

const gstatproto = {...gstats};

function printStats()
{
	console.info(`Webhook Action Stats : Total Alerts ${gstats.nalerts}, Total Grouped Alerts ${gstats.ngrpalerts}, Success ${gstats.nsuccess}, Failures ${gstats.nfails}, `,
			`OAuth2 Access Fails ${gstats.noauthfails}, \n\t\tInvalid ${gstats.ninvalid}, #5xx Server Errors ${gstats.n500}, #429 Too Many Requests Errors ${gstats.n429}, \n`,
			`\t\t#401 Unauthorized Errors ${gstats.n401}, #403 Forbidden Errors ${gstats.n401}, #400 Bad Request Errors ${gstats.n400}, #404 Not Found Errors ${gstats.n404}, `,
			`Last Error Message ${gstats.lasterr}, Last OAuth Error Message ${gstats.lastoautherr}\n`);

	if ((gstats.nalerts > Number.MAX_SAFE_INTEGER - 100) || (gstats.ninvalid > Number.MAX_SAFE_INTEGER - 100)) {
		console.info('Resetting Webhook Action Stats as Stats Overflow likely...\n');
		gstats = {...gstatproto};
	}
}	

setInterval(printStats, 60 * 1000);

function axiosSend(options, oauthobj)
{
	axios.request(options).then(() => {
		gstats.nsuccess++;
	})
	.catch((error) => {
		gstats.nfails++;

		if (safetypeof(error.response) === 'object') {
			let			retry;

			if (error.response.status >= 500) {
				gstats.n500++;
			}	
			else if (error.response.status === 429) {
				gstats.n429++;
			}	
			else if (error.response.status === 400) {
				gstats.n400++;
				retry = true;
			}	
			else if (error.response.status === 401) {
				gstats.n401++;
				retry = true;
			}	
			else if (error.response.status === 403) {
				gstats.n403++;
				retry = true;
			}	
			else if (error.response.status === 404) {
				gstats.n404++;
			}	

			if (oauthobj) {
				gstats.noauthfails++;
			}	

			if (safetypeof(error.response.data) === 'object' && typeof error.response.data.message === 'string') {
				gstats.lasterr = error.response.data.message;
			}	

			if (retry && safetypeof(oauthobj) === 'object') {
				setNextTryRefresh(oauthobj);
			}	
		}
	});
}	

function getPayload(oalerts, alert1)
{
	if (!oalerts || !alert1 || !alert1.alertname) {
		return null;
	}	

	let			typstr, links;

	if (!oalerts.close) {
		typstr = 'Firing';

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

	}
	else {
		if (oalerts.expired) {
			typstr = 'Expired';
		}
		else {
			typstr = 'Resolved';
		}	

		links = [
			{
				href	:	getAlertidURI(oalerts, alert1).uri,
				text	:	'View in Gyeeta UI'
			},
		];
	}

	return {
		id		:	alert1.alertid,
		time		:	alert1.alerttime,
		status		:	typstr,
		payload 	:	alert1, 
		links		:	links,
		client_url	:	oalerts.weburl,
		client		:	'Gyeeta Alerting',
	};	
}

function sendWebhookAlert(actobj)
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
	 * We send individual alerts within a group as separate alerts
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

		if (action.type !== 'webhook') {
			continue;
		}
		
		if (!action.config || !action.config.api_url || !action.config.auth_type) {
			gstats.ninvalid++;
			return null;
		}	

		const			config = action.config;

		const optpost = {
			method		: 'POST',
			url		: config.api_url,
			headers		: { ...headers, ...config.headers },
			timeout		: 60000,
		};


		if (typeof config.proxy_url === 'string' && config.proxy_url) {
			// Refer to https://github.com/axios/axios/issues/2072#issuecomment-567473812
			optpost.proxy		= false;

			const			proxy = url.parse(config.proxy_url);

			if (config.tls_reject_unauthorized === false) {
				proxy.rejectUnauthorized = false;
			}	

			optpost.httpsAgent	= new HttpsProxyAgent(proxy);
		}	
		else if (action.config.tls_reject_unauthorized === false) {
			optpost.httpsAgent	= new https.Agent({ rejectUnauthorized : false });
		}	

		const sendPayloads = (oauth) => {
			for (const obj of objarr) {
				optpost.data		= obj;
				gstats.nalerts++;

				axiosSend(optpost, oauth);
			}
		};	

		if (config.auth_type === 'basic_auth' && config.username && config.password) {
			optpost.auth	= {
				username	: 	config.username,
				password	:	config.password,
			};	
		}	
		else if (config.auth_type === 'bearer' && config.bearer_token) {
			optpost.headers.Authorization 	= `Bearer ${config.bearer_token}`;
		}	

		if (config.auth_type === 'oauth2') {
			try {
				getAccessToken(config, action.configid, optpost.httpsAgent).then((oauthobj) => {
				
					if (safetypeof(oauthobj) !== 'object') {
						gstats.noauthfails++;
						return null;
					}	

					if (typeof oauthobj.access_token === 'string') {
						optpost.headers.Authorization 	= `Bearer ${oauthobj.access_token}`;
					}

					sendPayloads(oauthobj);
				})
				.catch (() => {
					gstats.noauthfails++;
					return null;
				});	
			}
			catch (e) {
				gstats.noauthfails++;
				return null;
			}	
		}	
		else {
			sendPayloads();
		}	
	}
}

module.exports = {
	sendWebhookAlert,
};


