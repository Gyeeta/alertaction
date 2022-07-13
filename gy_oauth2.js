

'use strict';

			require('console-stamp')(console, { 
				format: ':date(yyyy-mm-dd HH:MM:ss.l)::label:' 
			});

const 			qs = require('querystring');
const 			axios = require('axios').default;

const			{safetypeof} = require('./gyutil.js');

const			gauthcache = new Map();
const			MaxCacheElem = 256;


/*
 * OAuth2 : Only Client Credentials Grant Type Supported.
 */

let gstats = {
	naccess		: 0,
	nrefresh	: 0,
	nsuccess	: 0,
	nfails		: 0,
	nrefreshfails	: 0,
	ninvalid	: 0,
	n500		: 0,
	n429		: 0,
	n401		: 0,
	n403		: 0,
	n400		: 0,
	n404		: 0,

	lastaccesserr	: '""',
	lastreferr	: '""',
};	

const gstatproto = {...gstats};

function printStats()
{
	if (gstats.naccess === 0 && gstats.ninvalid === 0) {
		return;
	}

	console.info(`OAuth2 Stats : Total Access Token Requests ${gstats.naccess}, Refresh Token Requests ${gstats.nrefresh}, Access Success ${gstats.nsuccess}, Access Failures ${gstats.nfails}, `,
			`Refresh Fails ${gstats.nrefreshfails}, \n\t\tInvalid ${gstats.ninvalid}, #5xx Server Errors ${gstats.n500}, #429 Too Many Requests Errors ${gstats.n429}, `,
			`#401 Unauthorized Errors ${gstats.n401}, #403 Forbidden Errors ${gstats.n401}, \n\t\t#400 Bad Request Errors ${gstats.n400}, #404 Not Found Errors ${gstats.n404}, `,
			`OAuth Stats Active ${gauthcache.size}, Last Access Error Message ${gstats.lastaccesserr}, Last Refresh Error Message ${gstats.lastreferr}\n`);

	if ((gstats.naccess > Number.MAX_SAFE_INTEGER - 100) || (gstats.ninvalid > Number.MAX_SAFE_INTEGER - 100)) {
		console.info('Resetting OAuth2 Stats as Stats Overflow likely...\n');
		gstats = {...gstatproto};
	}
}	

setInterval(printStats, 60 * 1000);

function cleanupCacheMap()
{
	try {
		const			mintime = Date.now() - 3 * 3600 * 1000;
		let			ndels = 0;

		if (gauthcache.size < MaxCacheElem/2) {
			return;
		}	

		for (let [configid, oauthobj] of gauthcache) {
			if (!oauthobj) {
				if (configid) {
					gauthcache.delete(configid);
				}

				continue;
			}	

			if (oauthobj.tlast < mintime) {
				gauthcache.delete(configid);
				ndels++;
			}
		}

		if (ndels > 0) {
			console.info(`OAuth2 Cache : Deleted ${ndels} Elements due to inactivity...\n`);
		}	
	}
	catch(e) {
		console.log(`[ERROR]: Exception caught while cleaning up OAuth2 Cache Entries : ${e}\n`);
	}	
}	

setInterval(cleanupCacheMap, 300 * 1000);


function getAccessToken(config, configid, httpsAgent)
{
	if (!config.clientid || !config.client_secret || !config.access_url) {
		gstats.ninvalid++;
		return null;
	}	
	
	gstats.naccess++;

	let			oauthobj, tnow = Date.now();

	oauthobj = gauthcache.get(configid);

	if (!oauthobj) {
		oauthobj = {

			clientid	:	config.clientid,
			client_secret	:	config.client_secret,
			access_url	:	config.access_url,
			access_token	:	config.access_token,
			refresh_token	:	config.refresh_token,
			expires_at	:	config.expires_at,
			scope		:	config.scope,
			use_auth_header	:	config.use_auth_header,

			tlast		: 	tnow,
			configid	:	configid,
			api_in_progress	:	false,
			authpromise	: 	null,
			refpromise	:	null,
			last_refresh	:	0,
			can_refresh	:	typeof config.refresh_token === 'string',
			useauth		:	undefined,
			nsuccess	: 	0,
			nfails		:	0,
			tsetRefresh	:	0,
		};

		if (gauthcache.size < MaxCacheElem) {
			gauthcache.set(configid, oauthobj);
		}	
	}	

	if (!oauthobj.access_token) {
		if (oauthobj.api_in_progress && oauthobj.authpromise) {
			gstats.nsuccess++;
			return oauthobj.authpromise;
		}

		oauthobj.authpromise = new Promise((resolve, reject) => {
			const data = { 
				'grant_type' 	: 'client_credentials',
				scope		: oauthobj.scope,
			};

			let			options;

			if (oauthobj.use_auth_header !== false) {
				options = {
					method 		: 'POST',
					headers 	: { 
						'content-type'	: 'application/x-www-form-urlencoded', 
						'User-Agent'	: 'Gyeeta Alerting',
					},
					auth 		: {
						username 	: oauthobj.clientid,
						password 	: oauthobj.client_secret,
					},
					data		: qs.stringify(data),
					url		: oauthobj.access_url,
					timeout		: 60000,
					httpsAgent	: httpsAgent,
				};
			}	
			else {
				data.client_id		= oauthobj.clientid;
				data.client_secret	= oauthobj.client_secret;

				options = {
					method 		: 'POST',
					headers 	: { 
						'content-type'	: 'application/x-www-form-urlencoded', 
						'User-Agent'	: 'Gyeeta Alerting',
					},
					data		: qs.stringify(data),
					url		: oauthobj.access_url,
					timeout		: 60000,
					httpsAgent	: httpsAgent,
				};
			}

			if (config.proxy_url) {
				options.proxy		= false;
			}

			axios.request(options).then(({data}) => {
			
				setTimeout(() => {
					oauthobj.api_in_progress 	= false;
					oauthobj.authpromise		= null;
				}, 1000);	
				
				if (!data) {
					gstats.nfails++;

					reject('Invalid OAuth Access Token Response seen : Not of object type');
					return;
				}

				gstats.nsuccess++;
				oauthobj.nsuccess++;

				if (typeof data.access_token === 'string') {
					oauthobj.access_token = data.access_token;
				}	

				if (typeof data.refresh_token === 'string') {
					oauthobj.refresh_token = data.refresh_token;
				}	

				if (data.expires_in) {
					oauthobj.expires_at = Date.now() + Number(data.expires_in) * 1000;
				}	
				else if (data.expires_at) {
					oauthobj.expires_at = Number(data.expires_at);
				}	
				else if (data.expires) {
					oauthobj.expires_at = Number(data.expires);
				}	

				resolve(oauthobj);
			})
			.catch((error) => {
				gstats.nfails++;
				oauthobj.nfails++;

				setTimeout(() => {
					oauthobj.api_in_progress 	= false;
					oauthobj.authpromise		= null;

					gauthcache.delete(oauthobj.configid);

				}, 1000);	
				
				if (error.response) {
					if (error.response.status >= 500) {
						gstats.n500++;
					}	
					else if (error.response.status === 429) {
						gstats.n429++;
					}	
					else if (error.response.status === 400) {
						gstats.n400++;
					}	
					else if (error.response.status === 401) {
						gstats.n401++;
					}	
					else if (error.response.status === 403) {
						gstats.n403++;
					}	
					else if (error.response.status === 404) {
						gstats.n404++;
					}	

					if (safetypeof(error.response.data) === 'object' && typeof error.response.data.message === 'string') {
						gstats.lastaccesserr = error.response.data.message;
						reject(error.response.data.message);

						return;
					}	
				} 

				reject(null);
			});
		});

		oauthobj.api_in_progress = true;

		return oauthobj.authpromise;
	}	

	oauthobj.tlast = Date.now();

	if (oauthobj.refresh_token && (tnow + 300 * 1000 > config.expires_at || oauthobj.last_refresh < oauthobj.tsetRefresh) && oauthobj.last_refresh < tnow - 100 * 1000) {

		if (oauthobj.api_in_progress && oauthobj.refpromise) {
			gstats.nsuccess++;
			return oauthobj.refpromise;
		}

		oauthobj.refpromise = new Promise((resolve, reject) => {

			oauthobj.last_refresh = Date.now();

			const data = { 
				'grant_type' 	: 	'refresh_token',
				scope		: 	oauthobj.scope,
				'refresh_token'	:	oauthobj.refresh_token,
			};

			let			options;

			if (oauthobj.use_auth_header !== false) {
				options = {
					method 		: 'POST',
					headers 	: { 
						'content-type'	: 'application/x-www-form-urlencoded',
						'User-Agent'	: 'Gyeeta Alerting',
					},
					auth 		: {
						username 	: oauthobj.clientid,
						password 	: oauthobj.client_secret,
					},
					data		: qs.stringify(data),
					url		: oauthobj.access_url,
					timeout		: 60000,
					httpsAgent	: httpsAgent,
				};
			}	
			else {
				data.client_id		= oauthobj.clientid;
				data.client_secret	= oauthobj.client_secret;

				options = {
					method 		: 'POST',
					headers 	: { 
						'content-type'	: 'application/x-www-form-urlencoded', 
						'User-Agent'	: 'Gyeeta Alerting',
					},
					data		: qs.stringify(data),
					url		: oauthobj.access_url,
					timeout		: 60000,
					httpsAgent	: httpsAgent,
				};
			}

			if (config.proxy_url) {
				options.proxy		= false;
			}

			gstats.nrefresh++;

			axios.request(options).then(({data}) => {

				setTimeout(() => {
					oauthobj.api_in_progress 	= false;
					oauthobj.refpromise		= null;
				}, 1000);	

				if (!data) {
					gstats.nrefreshfails++;

					reject('Invalid OAuth Refresh Token Response seen : Not of object type');
					return;
				}

				if (typeof data.access_token === 'string') {
					oauthobj.access_token = data.access_token;
				}	

				if (typeof data.refresh_token === 'string') {
					oauthobj.refresh_token = data.refresh_token;
				}	

				if (data.expires_in) {
					oauthobj.expires_at = Date.now() + Number(data.expires_in) * 1000;
				}	
				else if (data.expires_at) {
					oauthobj.expires_at = Number(data.expires_at);
				}	
				else if (data.expires) {
					let		exp = Number(data.expires);

					if (exp <= 3600 * 24 * 365 * 10) {
						oauthobj.expires_at = Date.now() + exp * 1000;
					}
					else {
						oauthobj.expires_at = Number(data.expires);
					}
				}	

				resolve(oauthobj);
			})
			.catch((error) => {
				gstats.nrefreshfails++;

				setTimeout(() => {
					oauthobj.api_in_progress 	= false;
					oauthobj.refpromise		= null;
				}, 1000);	

				if (error.response) {
					if (error.response.status >= 500) {
						gstats.n500++;
					}	
					else if (error.response.status === 429) {
						gstats.n429++;
					}	
					else if (error.response.status === 400) {
						gstats.n400++;
					}	
					else if (error.response.status === 401) {
						gstats.n401++;
					}	
					else if (error.response.status === 403) {
						gstats.n403++;
					}	
					else if (error.response.status === 404) {
						gstats.n404++;
					}	

					if (safetypeof(error.response.data) === 'object' && typeof error.response.data.message === 'string') {
						gstats.lastreferr = error.response.data.message;
						reject(gstats.lastreferr);

						return;
					}	
				} 

				reject(null);
			});
		});

		oauthobj.api_in_progress = true;

		return oauthobj.refpromise;
	}	
	else {
		return Promise.resolve(oauthobj);
	}
}

function refreshAllowed(oauthobj, tnow = Date.now())
{
	if ((safetypeof(oauthobj) !== 'object') || !oauthobj.refresh_token || oauthobj.last_refresh > tnow - 100 * 1000 || oauthobj.api_in_progress) {
		return false;
	}

	return true;
}	

function setNextTryRefresh(oauthobj, tnow = Date.now())
{
	if (oauthobj) {
		oauthobj.tsetRefresh	= tnow;
	}	
}	

module.exports = {
	getAccessToken,
	refreshAllowed,
	setNextTryRefresh,
};


