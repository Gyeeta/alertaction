
'use strict';

const			qs = require('qs');
const			{ escapeHtml } = require('./gyutil.js');

function getAlertURI(aobj, addquotes = false)
{
	if (!aobj) {
		return null;
	}

	const			quote = (addquotes ? '\'' : '');

	return {
		uri	: `${quote}${aobj.weburl}/ui/alertDash${quote}`,
	};
}	

function getAlertidURI(aobj, alertobj, addquotes = false)
{
	if (!aobj || !alertobj) {
		return null;
	}

	const			quote = (addquotes ? '\'' : '');

	return {
		uri	: `${quote}${aobj.weburl}/ui/alertdash?${ qs.stringify({ starttime : alertobj.alerttime, endtime : alertobj.alerttime, filter : `alertid = '${alertobj.alertid}'` }) }${quote}`,
	};
}	

function getAlertAckURI(aobj, alertobj, astate, addquotes = false)
{
	if (!aobj || !alertobj || !astate) {
		return null;
	}

	const			quote = (addquotes ? '\'' : '');

	return {
		uri	: `${quote}${aobj.weburl}/v1/alerts/ack?alertid=${alertobj.alertid}&astate=${astate}${quote}`,
	};
}	


const hdrstr = `
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta name="viewport" content="width=device-width" />
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<title>Gyeeta Alerts</title>
<style>

* {
  margin: 0;
  font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
  box-sizing: border-box;
  font-size: 14px;
}

img {
  max-width: 100%;
}

body {
  -webkit-font-smoothing: antialiased;
  -webkit-text-size-adjust: none;
  width: 100% !important;
  height: 100%;
  line-height: 1.6em;
}

table td {
  vertical-align: top;
}

body {
  background-color: #f6f6f6;
}

.body-wrap {
  background-color: #f6f6f6;
  width: 100%;
}

.main {
  background-color: #fff;
  border: 1px solid #e9e9e9;
  border-radius: 3px;
}

.header {
  width: 100%;
  margin-bottom: 20px;
}

.footer {
  width: 100%;
  clear: both;
  color: #A99;
  padding: 20px;
}
.footer p, .footer a, .footer td {
  color: #A99;
  font-size: 12px;
}

h1, h2, h3 {
  font-family: "Helvetica Neue", Helvetica, Arial, "Lucida Grande", sans-serif;
  color: #000;
  margin: 40px 0 0;
  line-height: 1.2em;
  font-weight: 400;
}

h1 {
  font-size: 32px;
  font-weight: 500;
}

h2 {
  font-size: 24px;
}

h3 {
  font-size: 18px;
}

h4 {
  font-size: 14px;
  font-weight: 600;
}

p, ul, ol {
  margin-bottom: 10px;
  font-weight: normal;
}
p li, ul li, ol li {
  margin-left: 5px;
  list-style-position: inside;
}

a {
  color: #348eda;
  text-decoration: underline;
}

pre{
    overflow: auto;
    background: #ddd;
    padding-left: 10px;
    padding-bottom: 10px;
    padding-top: 10px;
    white-space: pre-line;
    white-space: -moz-pre-wrap;
    white-space: -o-pre-wrap;
    white-space: -ms-pre-wrap;
}

.btn-primary {
  text-decoration: none;
  color: #FFF;
  background-color: #348eda;
  border: solid #348eda;
  border-width: 10px 20px;
  line-height: 2em;
  font-weight: bold;
  text-align: center;
  cursor: pointer;
  display: inline-block;
  border-radius: 5px;
  text-transform: capitalize;
}

.btn-secondary {
  text-decoration: none;
  color: #FFF;
  background-color: #008eda;
  border: solid #348eda;
  border-width: 5px 5px;
  line-height: 2em;
  font-weight: bold;
  text-align: center;
  cursor: pointer;
  border-radius: 2px;
  text-transform: capitalize;
}

.last {
  margin-bottom: 0;
}

.first {
  margin-top: 0;
}

.aligncenter {
  text-align: center;
}

.alignright {
  text-align: right;
}

.alignleft {
  text-align: left;
}

.clear {
  clear: both;
}

.alert {
  font-size: 16px;
  color: #fff;
  font-weight: 500;
  padding: 20px;
  text-align: left;
  border-radius: 3px 3px 0 0;
}
.alert a {
  color: #fff;
  text-decoration: none;
  font-weight: 500;
  font-size: 16px;
}
.alert.alert-warning {
  background-color: #9c6a5e;
}
.alert.alert-good {
  background-color: #628240;
}

.alert.alert-expired {
  background-color: #808080;
}

th, td {
  padding: 15px;
}

@media only screen and (max-width: 640px) {
  body {
    padding: 0 !important;
  }

  h1, h2, h3, h4 {
    font-weight: 800 !important;
    margin: 20px 0 5px !important;
  }

  h1 {
    font-size: 22px !important;
  }

  h2 {
    font-size: 18px !important;
  }

  h3 {
    font-size: 16px !important;
  }

}

</style>
</head>

<body itemscope itemtype="http://schema.org/EmailMessage">

<div style="overflow: scroll; display: flex; flex-wrap: wrap; padding: 10px;">
<table class="body-wrap">
  <tr>
    <td></td>
    <td>
      <div>
        <table class="main" width="100%" cellpadding="0" cellspacing="0" border-collapse: separate>
`;


function addAlertText(inputjson)
{

	let			mobj = { metadata : '', data : '' }, adata;

	const printprop = (prop, val, obj, oprop) => {

		if (typeof val === 'string') {
			if (val.length > 0) {
				obj[oprop] += `${prop} : ${JSON.stringify(val)}\n`;
			}
		}
		else {
			obj[oprop] += `${prop} : ${val}\n`;
		}	
	};	

	for (const prop in inputjson) {
		if (prop === 'alertdata') {
			adata = inputjson.alertdata;
			continue;
		}	

		printprop(prop, inputjson[prop], mobj, 'metadata');
	}	


	if (typeof adata === 'object') {
		for (const prop in adata) {
			printprop(prop, adata[prop], mobj, 'data');
		}	
	}

	return mobj;
}	


function getAlertsHTML(oalerts)
{
	if (!oalerts || !oalerts.alerts) {
		return null;
	}	

	const				alerttext = [];

	for (let ajson of oalerts.alerts) {
		alerttext.push(addAlertText(ajson));
	}	

	const endstr = `
		      </table>
		    </td>
		  </tr>
		</table>

		</div>
	    </td>
	    <td></td>
	  </tr>
	</table>
	</div>

	</body>
	</html>
	`;

	const				nalerts = oalerts.alerts.length;

	if (!oalerts.close) {
		let falert = `
			${hdrstr}
			  <tr>
			    <td class="alert alert-warning">
				<strong>${nalerts} Alert(s) Firing</strong>
				<div style="float: right;" >
			    	<a href=${getAlertURI(oalerts, true).uri} target='_blank'><strong><u>Gyeeta Alert UI Dashboard</u></strong></a>
				</div>
			    </td>
			  </tr>

			`;

		for (let i = 0; i < nalerts; ++i) {
			falert += `
			 <tr>
			    <td>
			      <table width="100%" cellpadding="0" cellspacing="0">
				<tr>
				  <td>
				    <div style="border-style: solid; border-width: 1px; padding: 10px;">
				    <div style="height: 500px; overflow: scroll; padding: 10px;">
				    <strong>Alert ${i + 1} Metadata</strong><br />
					<pre>${escapeHtml(alerttext[i].metadata)}</pre>	
					<i><b>Alert ${i + 1} Data</b></i><br />
					<pre>${escapeHtml(alerttext[i].data)}</pre>
					</div>
				    <a href=${getAlertAckURI(oalerts, oalerts.alerts[i], 'acked', true).uri} target='_blank' class='btn-secondary' ><strong>Acknowledge Alert</strong></a>
				    <a href=${getAlertAckURI(oalerts, oalerts.alerts[i], 'resolved', true).uri} target='_blank' class='btn-secondary' ><strong>Set as Resolved</strong></a>
				    <a href=${getAlertidURI(oalerts, oalerts.alerts[i], true).uri} target='_blank' class='btn-secondary' ><strong>View Alert in UI</strong></a>
				    </div >			
				  </td>
				</tr>
			       <tr>
				  <td>
				    <br />
				    <hr />
				    <br />
				  </td>
				</tr>
			`;
		}	

		return {
			html :	falert + endstr,
		};	
	}

	let 			estring, rdatastr = '';
	
	if (oalerts.expired) {
		estring = `
			${hdrstr}
			  <tr>
			    <td class="alert alert-expired">
				<strong>${nalerts} Alert(s) Expired</strong>
				<div style="float: right;" >
			    	<a href=${getAlertURI(oalerts, true).uri} target='_blank' ><strong><u>Gyeeta Alert UI Dashboard</u></strong></a>
				</div>
			    </td>
			  </tr>
			`;
	}
	else {
		estring = `
			${hdrstr}
			  <tr>
			    <td class="alert alert-good">
				<strong>${nalerts} Alert(s) Resolved</strong>
				<div style="float: right;" >
			    	<a href=${getAlertURI(oalerts, true).uri} target='_blank' ><strong><u>Gyeeta Alert UI Dashboard</u></strong></a>
				</div>
			    </td>
			  </tr>
			`;
	}

	for (let i = 0; i < nalerts; ++i) {
		rdatastr += `
		 <tr>
		    <td>
		      <table width="100%" cellpadding="0" cellspacing="0">
			<tr>
			  <td>
			    <div style="border-style: solid; border-width: 1px; padding: 10px;">
			    <div style="height: 400px; overflow: scroll; padding: 10px;">
			    <strong>Alert ${i + 1} Metadata</strong><br />
				<pre>${escapeHtml(alerttext[i].metadata)}</pre>	
				</div>
			    <a href=${getAlertidURI(oalerts, oalerts.alerts[i], true).uri} target='_blank' class='btn-secondary' ><strong>View Alert in UI</strong></a>
			    </div >			
			  </td>
			</tr>
		       <tr>
			  <td>
			    <br />
			    <hr />
			    <br />
			  </td>
			</tr>
		`;
	}	

	return {
		html :	estring + rdatastr + endstr,
	};	

}

function getAlertsText(oalerts)
{
	if (!oalerts || !oalerts.alerts) {
		return null;
	}	

	const				alerttext = [];

	for (let ajson of oalerts.alerts) {
		alerttext.push(addAlertText(ajson));
	}	

	let				ostr = '\nGyeeta Alerts : \n';
	const				nalerts = oalerts.alerts.length;

	if (!oalerts.close) {
		ostr += `\n\n${nalerts} Alert(s) Firing : \n\n`;
	}
	else if (oalerts.expired) {
		ostr += `\n\n${nalerts} Alert(s) Expired : \n\n`;
	}
	else {
		ostr += `\n\n${nalerts} Alert(s) Resolved : \n\n`;
	}	

	if (!oalerts.close) {
		for (let i = 0; i < nalerts; ++i) {
			ostr += `Alert ${i + 1} Metadata : \n${alerttext[i].metadata}\nAlert ${i + 1} Data : \n${alerttext[i].data}\n\n`; 	
		}
	}
	else {
		for (let i = 0; i < nalerts; ++i) {
			ostr += `Alert ${i + 1} Metadata : \n${alerttext[i].metadata}\n\n`; 	
		}
	}	

	ostr += `\n\nGyeeta Alert UI Dashboard Link : ${getAlertURI(oalerts).uri}\n\n`;

	return {
		text : ostr,
	}	
}

module.exports = {
	getAlertURI,
	getAlertidURI,
	getAlertAckURI,
	getAlertsHTML,
	getAlertsText,
};

