var express = require('express');
var path = require('path');
var bcrypt = require('bcrypt');
var nodemailer = require("nodemailer");
var Handlebars = require("handlebars");
var fs = require('fs');
var https = require('https');
var ObjectID = require('mongodb').ObjectID;
var OAuth = require('oauth');
var oauthserver = require('node-oauth2-server');
var util = require('util');
var async = require('async');
var ss = require('socket.io-stream');
var _ = require('lodash');
var connect = require('connect');
var compression = require('compression');
var cookieParser = require('cookie-parser');
var morgan  = require('morgan');
var bodyParser = require('body-parser');
var methodOverride = require('method-override');
var favicon = require('serve-favicon');
var oauthserver = require('node-oauth2-server');
var oauthmodel = require('./lib/oauthMongoModel.js');
var mongoMatcher = require('hyperyun-mongomatcher');
var util = require('util');
var md5 = require('MD5');
var debug = require('debug');
var permissionCode = new (require('./permissionCode/permissionCode.js'))();
var program = require('commander');

program
  .version('0.0.1')
  .option('-c, --company', 'Company name')
  .option('-u, --url', 'Server url')
  .option('-P, --port', 'Server port')
  .option('-a, --application', 'Application name')
  .option('-e, --email', 'Email for admin user (first run)')
  .option('-p, --password', 'Password for admin user (first run)')
  .option('-l, --delimiter', 'Database delimiter to use (default: "~")')
  .option('-M, --multi', 'Run in Multi-tenancy mode')
  .option('-d, --database', 'Path to MongoDB (default: "mongodb://localhost:27017/hyperstore")')
  .option('-s, --database-server', 'MongoDB server (default: "localhost")')
  .option('-n, --database-name', 'Name of MongoDB database (default: "hyperstore")')
  .option('-D, --database-port', 'Port for MongoDB server (default: "27017")')
  .option('-C, --config', 'Path to configuration JSON file')
  .parse(process.argv);


var configFile = require(program.config ? program.config : './config.json');

if(program.database) var mongoUri = program.database;
else if(program.databaseServer) var mongoUri = "mongodb://"+program.databaseServer+":"+(program.databasePort || "27017")+"/"+(program.databaseName || "hyperstore");
else if(configFile.database && configFile.database.server) var mongoUri = "mongodb://"+configFile.database.server+":"+(configFile.database.port || "27017")+"/"+(configFile.database.name || "hyperstore");
else if(process.env.MONGOLAB_URI) var mongoUri = process.env.MONGOLAB_URI;
else if(process.env.MONGOHQ_URL) var mongoUri = process.env.MONGOHQ_URL;
else var mongoUri = 'mongodb://localhost:27017/hyperstore';

var config = {
	company: (program.company || configFile.company || "hyperyun").toLowerCase(),
	companyCapitalized: (program.company || configFile.company || "Hyperyun"),
	companyApp: "_"+(program.company || configFile.company || "hyperyun").toLowerCase(),
	companyURL: (program.url || configFile.url || "hyperyun.com"),
	port: (program.port || configFile.port || process.env.PORT || 80),
	database: mongoUri,
	dlim : (program.delimiter || configFile.delimiter || "~"),
	application : (program.application || configFile.application || null),
	mulit: (program.mulit || configFile.mulit || false)
}

console.log(config);

var app = express();
var port = config.port;
var server = app.listen(port, function() {
  console.log("Listening on " + port);
});


//Adds host info to res.locals
app.use(function(req,res,next){
	res.locals.host=req.host;
	next();
});


app.use(cookieParser());
// all environments
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(morgan('dev'));
app.use(bodyParser());
app.use(methodOverride());
app.use(compression());

	//Writte allow cross-domain access
var io = require('socket.io')(server,{
	transports: ['websocket', 'polling', 'flashsocket'],
  	rigins:'*:*'
})
//io.listen(server);
var mongo = require('mongoskin');

console.log("Connecting to MongoDB: "+config.database);
var db = mongo.db(config.database, {safe: false});
var mongo_native = require('mongodb');
var Grid = require('gridfs-stream');
var gfs = null;
var db_native = null;
mongo_native.connect(config.database, function(err, db_mongo_native) {
	console.log("MONGO NATIVE CONNECT: ",err,config.database);
	db_native = db_mongo_native;
	gfs = Grid(db_native, mongo_native);
});

// [TODO] Read those from json config file

var company = config.company;
var companyCapitalized = config.companyCapitalized;
// Not used
var companyApp = config.companyApp;
var companyURL = config.url;

var dlim = config.dlim || "~";

/***
 *    ██████╗  █████╗  ██████╗██╗  ██╗██╗    ██╗██╗██████╗ ███████╗
 *    ██╔══██╗██╔══██╗██╔════╝██║ ██╔╝██║    ██║██║██╔══██╗██╔════╝
 *    ██████╔╝███████║██║     █████╔╝ ██║ █╗ ██║██║██████╔╝█████╗
 *    ██╔══██╗██╔══██║██║     ██╔═██╗ ██║███╗██║██║██╔══██╗██╔══╝
 *    ██████╔╝██║  ██║╚██████╗██║  ██╗╚███╔███╔╝██║██║  ██║███████╗
 *    ╚═════╝ ╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝ ╚══╝╚══╝ ╚═╝╚═╝  ╚═╝╚══════╝
 *
 */

var Hyperyun = {};
/***
 *    ██████╗ ███████╗██████╗ ██╗   ██╗ ██████╗
 *    ██╔══██╗██╔════╝██╔══██╗██║   ██║██╔════╝
 *    ██║  ██║█████╗  ██████╔╝██║   ██║██║  ███╗
 *    ██║  ██║██╔══╝  ██╔══██╗██║   ██║██║   ██║
 *    ██████╔╝███████╗██████╔╝╚██████╔╝╚██████╔╝
 *    ╚═════╝ ╚══════╝╚═════╝  ╚═════╝  ╚═════╝
 *
 */
Hyperyun.Debug = {};
Hyperyun.Debug.hyperstore = debug(company+':hypestore');
Hyperyun.Debug.security = debug(company+':security');
Hyperyun.Debug.rest = debug(company+':rest');
Hyperyun.Debug.oauth = debug(company+':oauth');
Hyperyun.Debug.mailer = debug(company+':oauth');
Hyperyun.Debug.socket = debug(company+':socket');
Hyperyun.Debug.eddy = debug(company+':eddy');

/***
 *    ██╗  ██╗██╗   ██╗██████╗ ███████╗██████╗ ███████╗████████╗ ██████╗ ██████╗ ███████╗
 *    ██║  ██║╚██╗ ██╔╝██╔══██╗██╔════╝██╔══██╗██╔════╝╚══██╔══╝██╔═══██╗██╔══██╗██╔════╝
 *    ███████║ ╚████╔╝ ██████╔╝█████╗  ██████╔╝███████╗   ██║   ██║   ██║██████╔╝█████╗
 *    ██╔══██║  ╚██╔╝  ██╔═══╝ ██╔══╝  ██╔══██╗╚════██║   ██║   ██║   ██║██╔══██╗██╔══╝
 *    ██║  ██║   ██║   ██║     ███████╗██║  ██║███████║   ██║   ╚██████╔╝██║  ██║███████╗
 *    ╚═╝  ╚═╝   ╚═╝   ╚═╝     ╚══════╝╚═╝  ╚═╝╚══════╝   ╚═╝    ╚═════╝ ╚═╝  ╚═╝╚══════╝
 *
 */
Hyperyun.Hyperstore = {};
Hyperyun.Hyperstore.collections = {};
Hyperyun.Hyperstore.subscriptions = {};
Hyperyun.Hyperstore.active_queries = {};
Hyperyun.Hyperstore.makeCollection = function(name) {
	var splut = name.split(dlim);
	var appName = splut[0]
	var collectionName = splut[1]
	name = appName + dlim + collectionName

	if(!Hyperyun.Hyperstore.collections[name]) {
		Hyperyun.Debug.eddy("MAKING COLLECTION NAME: " + name);
	  	Hyperyun.Hyperstore.collections[name] = new Object();
		Hyperyun.Hyperstore.collections[name].conn = io.of(name);
		Hyperyun.Hyperstore.collections[name].db = db.collection(name);
		Hyperyun.Hyperstore.collections[name].version=null;
		if(!Hyperyun.Hyperstore.collections[appName+dlim+company+"Collections"])
		{
			Hyperyun.Hyperstore.collections[appName+dlim+company+"Collections"] = {
				conn : io.of(appName+dlim+company+"Collections"),
				db : db.collection(appName+dlim+company+"Collections"),
				version : null
			}
		}
		Hyperyun.Hyperstore.collections[appName+dlim+company+"Collections"].db.insert({name:collectionName},function(err,res){
			if(err)
			{
				console.error("ERROR WHILE INSERTING ",collectionName,err);
				console.trace();
			}
		})
	}
};
Hyperyun.Hyperstore.registerActiveQuery = function(access){
	try{
		var ident = JSON.stringify({sel: access.sel, opt:access.opt});
		if(!Hyperyun.Hyperstore.active_queries[ident])
		{
			Hyperyun.Hyperstore.active_queries[ident] = new Hyperyun.Hyperstore.activeQuery(access);
			Hyperyun.Hyperstore.active_queries[ident].addSubscriber(access.socket.id);
			//Find just occurred, so tap the results with our ref
			if(access.preFindResults && access.preFindResults.touched){
				_.forEach(access.preFindResults.touched, function(touched){
					Hyperyun.Hyperstore.active_queries[ident].subscribeToDatum(touched)
				})
			}
		}
		else
		{
			Hyperyun.Hyperstore.active_queries[ident].addSubscriber(access.socket.id);
		}
	} catch(e){
		console.error("FAILED to register Active Query: ", e);
	}
}
Hyperyun.Hyperstore.unsubscribeListener = function(user_socket){
	if(user_socket)
	{
		_.forEach(Hyperyun.Hyperstore.active_queries, function(query){
			query.removeSubscriber(user_socket);
		})
	}
}
Hyperyun.Hyperstore.notifyQueriesOfDatum = function(doc, access){
	_.forEach(Hyperyun.Hyperstore.active_queries, function(query){
		query.respondToNotification(doc,access);
	})
}

Hyperyun.Hyperstore.createApp = function(application, callback){
	if(!application.name || !application.url) {
		callback({err: companyCapitalized+": Error: Need to provide both a name and a url for the new application ("+application.name+","+application.url+")", res: null});
	} else {
		Hyperyun.Hyperstore.makeCollection(application.url+dlim+company+"Configuration");
		Hyperyun.Hyperstore.collections[application.url+dlim+company+"Configuration"].db.findOne({url: application.url}, function(err, app){
			if(!app) {
				var salt = bcrypt.genSaltSync(10);
				application.user.password = bcrypt.hashSync(application.user.password, salt);
				application.user.activate = new ObjectID().toHexString();
				Hyperyun.Application.generateNewAppJson(application.name, application.url, application.user, function(json) {
					Hyperyun.Hyperstore.makeCollection(application.url+dlim+company+"Collections");
					Hyperyun.Hyperstore.makeCollection(application.url+dlim+company+"Admins");
					var collection = application.url+dlim+company+"Configuration";
					Hyperyun.Hyperstore.makeCollection(application.url+dlim+company+"Configuration");
					Hyperyun.Hyperstore.collections[collection].db.insert(json, function(err, doc){
						if(err) {
							callback({err: err, res: false});
						} else {
							//Initialize collections table
							//TODO: revisit callbacks here
							Hyperyun.Hyperstore.collections[application.url+dlim+company+"Collections"].db.insert({name:"users"},function(){});
							Hyperyun.Hyperstore.collections[application.url+dlim+company+"Collections"].db.insert({name:"files"},function(){});
							_.forEach(
								_.map(Hyperyun.constants.companyColls,function(v,k){return {full:application.app+dlim+v,part:v}}),//create {'foo_collection','collection'} pairs
								function(v){Hyperyun.Hyperstore.collections[application.url+dlim+company+"Collections"].db.insert({name:v.part},function(){})}
							); //init each collection with a name

							Hyperyun.Accounts.createOrUpdateAccount('password', {user: application.user, appName: application.url}, function(err,firstUser){
								if(err && !err.err){
									Hyperyun.Hyperstore.collections[application.url+dlim+company+"Admins"].db.update({emails: {$in: [application.user.email]}}, {$set: {activate: 1, status: 1}}, function(err, res) {
										callback({err: err, res: res});
									});
								} else {
									callback({err: "WAS UNABLE TO ADD"+application.user+"as a member of"+application.url, res: false});
								}
							}, true);
						}
					});
				});
			} else callback({err: false, res: "App exists"});
		});
	}
};

//   ██████╗ ██╗   ██╗███████╗██████╗ ██╗   ██╗
//  ██╔═══██╗██║   ██║██╔════╝██╔══██╗╚██╗ ██╔╝
//  ██║   ██║██║   ██║█████╗  ██████╔╝ ╚████╔╝ 
//  ██║▄▄ ██║██║   ██║██╔══╝  ██╔══██╗  ╚██╔╝  
//  ╚██████╔╝╚██████╔╝███████╗██║  ██║   ██║   
//   ╚══▀▀═╝  ╚═════╝ ╚══════╝╚═╝  ╚═╝   ╚═╝   
// 
Hyperyun.Hyperstore.activeQuery = function(access){
	this.subscribers = new Array()
	this.rawQuery = {sel:access.sel, opt:access.opt}
	this.id = JSON.stringify(this.rawQuery)
	this.matcher = new mongoMatcher(this.rawQuery.sel)
}
Hyperyun.Hyperstore.activeQuery.prototype.addSubscriber = function(user_socket){
	if(!_.contains(this.subscribers, user_socket))
		this.subscribers.push(user_socket);
}
Hyperyun.Hyperstore.activeQuery.prototype.removeSubscriber = function(user_socket){
	if(_.contains(this.subscribers, user_socket))
		this.subscribers = _.without(this.subscribers, user_socket);
}
Hyperyun.Hyperstore.activeQuery.prototype.subscribeToDatum = function(doc_id){
	if(!Hyperyun.Hyperstore.subscriptions[doc_id])
		Hyperyun.Hyperstore.subscriptions[doc_id] = [this.id];
	else if(!_.contains(Hyperyun.Hyperstore.subscriptions[doc_id],this.id))
		Hyperyun.Hyperstore.subscriptions[doc_id].push(this.id);
}
Hyperyun.Hyperstore.activeQuery.prototype.unsubscribeFromDatum = function(doc_id){
	Hyperyun.Hyperstore.subscriptions[doc_id] = _.without(Hyperyun.Hyperstore.subscriptions[doc_id],this.id);
}
Hyperyun.Hyperstore.activeQuery.prototype.respondToNotification = function(doc, access){
	var decision = this.matcher.discern(doc);
	if(_.isBoolean(decision) && decision)
	{
		this.subscribeToDatum(doc._id);
	}
	else if(!_.isBoolean(decision))//Error: selector is malformed
		console.error("Selector malformed:",decision,this.matcher.seed);
}
Hyperyun.Hyperstore.makeCollection(companyApp+dlim+"applications");
Hyperyun.Hyperstore.makeCollection(companyApp+dlim+"users");

/***
 *    ███╗   ███╗ █████╗ ██╗██╗     ███████╗██████╗
 *    ████╗ ████║██╔══██╗██║██║     ██╔════╝██╔══██╗
 *    ██╔████╔██║███████║██║██║     █████╗  ██████╔╝
 *    ██║╚██╔╝██║██╔══██║██║██║     ██╔══╝  ██╔══██╗
 *    ██║ ╚═╝ ██║██║  ██║██║███████╗███████╗██║  ██║
 *    ╚═╝     ╚═╝╚═╝  ╚═╝╚═╝╚══════╝╚══════╝╚═╝  ╚═╝
 *
 */
Hyperyun.Mailer = {};
Hyperyun.Mailer.sendMail = function(appName, templateName, user, socket, callback, sendAsAdmin) {
	var collection = appName+dlim+company+"Emails";
	Hyperyun.Hyperstore.makeCollection(collection);
	Hyperyun.Hyperstore.collections[appName+dlim+company+"Configuration"].db.findOne({url:appName},function(err, app){
		Hyperyun.Hyperstore.collections[collection].db.findOne({template: templateName}, function(err, template) {
			if(sendAsAdmin) {
				var adminMail = require('./mail.json');
				app = {smtp: adminMail.smtp};
				template = adminMail.template[templateName];
			}

			Hyperyun.Debug.mailer("Starting Hyperyun.Mailer.sendMail function");

			if(err || !template) {
				callback(err?err:"No email settings for template '"+templateName+"'");
			} else if(!app || !app.smtp){
				callback(app?"No smtp specified in app settings":"app settings not found")
			} else {
				var mail = template;
				var mailer = nodemailer.createTransport(app.smtp);
				var from = mail.from+" <"+app.smtp.auth.user+">";

				var compileText = Handlebars.compile(mail.Text);
				var compileHTML = Handlebars.compile(mail.HTML);

				var alink = "";
				var flink = "";
					var ahash = "";
				var fhash = "";
				if(templateName=="Registration") {
					if(appName==companyApp) alink = "http://"+companyURL+"/activate/"+encodeURIComponent(user.activate);
					else alink = "http://"+appName+"."+companyURL+"/activate/"+encodeURIComponent(user.activate);
					ahash = encodeURIComponent(user.activate);
				} else if(templateName=="Password Recovery") {
					if(appName==companyApp) flink = "http://"+companyURL+"/forgot/"+encodeURIComponent(user.forgotPassword);
					else flink = "http://"+appName+"."+companyURL+"/forgot/"+encodeURIComponent(user.forgotPassword);
					fhash = encodeURIComponent(user.forgotPassword);
				}
				var handleData = { "user": user, activationLink: alink, forgotPasswordLink: flink, activationHash: ahash, forgotPasswordHash: fhash};
				Hyperyun.Debug.mailer("Send Mail User");
				Hyperyun.Debug.mailer(user);

				var text = compileText(handleData);
				var html = compileHTML(handleData);
				mailer.sendMail({
				    from: from, // sender address
				    to: user.emails[0],  // list of receivers
				    subject: mail.title, // Subject line
				    text: text,// plaintext body
				    html: html // html body
				}, function(error, response){
					Hyperyun.Debug.mailer({error: error, response: response});
					//TODO: relocate this - Hyperyun.Analytics.mailSent(appName, {ip: (access.socket.request.headers["x-real-ip"] ? access.socket.request.headers["x-real-ip"] : socket.request.connection.remoteAddress), toEmail: user.emails[0], user_id: user._id, template: template});
					callback(error, response);
				  mailer.close();
				});

			}
		});
	})
}

Hyperyun.Mailer.sendMailAdmin = function(user, templateName, callback) {
	var adminMail = require('./adminMail.js');
	var app = {smtp: adminMail.smtp};
	var template = adminMail.template[templateName];

	Hyperyun.Debug.mailer("Starting Hyperyun.Mailer.sendMailAdmin function");

	var mail = template;
	var mailer = nodemailer.createTransport(app.smtp);
	var from = mail.from+" <"+app.smtp.auth.user+">";

	var compileText = Handlebars.compile(mail.Text);
	var compileHTML = Handlebars.compile(mail.HTML);

	var alink = "";
	var flink = "";
	var ahash = "";
	var fhash = "";
	if(templateName=="Registration") {
		alink = "http://"+companyURL+"/activate/"+encodeURIComponent(user.activate);
		ahash = encodeURIComponent(user.activate);
	} else if(templateName=="Password Recovery") {
		flink = "http://"+companyURL+"/forgot/"+encodeURIComponent(user.forgotPassword);
		fhash = encodeURIComponent(user.forgotPassword);
	}
	var handleData = { "user": user, activationLink: alink, forgotPasswordLink: flink, activationHash: ahash, forgotPasswordHash: fhash};
	Hyperyun.Debug.mailer("Send Mail User");
	Hyperyun.Debug.mailer(user);

	var text = compileText(handleData);
	var html = compileHTML(handleData);
	mailer.sendMail({
	    from: from, // sender address
	    to: user.email,  // list of receivers
	    subject: mail.title, // Subject line
	    text: text,// plaintext body
	    html: html // html body
	}, function(error, response){
		Hyperyun.Debug.mailer({error: error, response: response});
		//TODO: relocate this - Hyperyun.Analytics.mailSent(appName, {ip: (access.socket.request.headers["x-real-ip"] ? access.socket.request.headers["x-real-ip"] : socket.request.connection.remoteAddress), toEmail: user.emails[0], user_id: user._id, template: template});
		callback(error, response);
	  mailer.close();
	});			
}

/***
 *    ██████╗ ███████╗███████╗████████╗
 *    ██╔══██╗██╔════╝██╔════╝╚══██╔══╝
 *    ██████╔╝█████╗  ███████╗   ██║
 *    ██╔══██╗██╔══╝  ╚════██║   ██║
 *    ██║  ██║███████╗███████║   ██║
 *    ╚═╝  ╚═╝╚══════╝╚══════╝   ╚═╝
 *
 */
Hyperyun.REST = {};
Hyperyun.REST.readParam = function(check, checkAlt, defaultVal, errorField, res){
	var decodeCheck = decodeURIComponent(check);
	var decodeCheckAlt = decodeURIComponent(checkAlt);
	if(Hyperyun.Utils.isJson(decodeCheck))
		return JSON.parse(decodeCheck);
	else if(Hyperyun.Utils.isJson(decodeCheckAlt))
		return JSON.parse(decodeCheckAlt);
	else if(check === undefined && checkAlt == undefined)
		return defaultVal;
	else
	{
		res.send(400, errorField + " field has invalid JSON: "+(check === undefined?checkAlt:check))
		return undefined;
	}
};
Hyperyun.REST.handleRESTRequest = function(action, collection, req, res){
	if(req.host=="127.0.0.1") req.subdomains.length=0;
	if(req.subdomains.length>0) {
		/*
			Construct an access form the REST request

			reasonable.999geeks.pl/api/read/secFooNice?q={}&m={}&o={limit:30}&token="$2a$10$GTahg6FHl672ZQjw9226Sudv4Myhoxca39b/QQ/b8dz4dZui5W6lu"
		 */
		var appName = req.subdomains[0];
		var sel = Hyperyun.REST.readParam(req.query.q, req.query.query, {}, "Query", res);
		if(sel == undefined) return;
		var opt = Hyperyun.REST.readParam(req.query.o, req.query.options, {}, "Options", res);
		if(opt && opt.reactive) opt.reactive = false;//Prevent subscription attempt, since REST isn't reactive anyways
		var mod = Hyperyun.REST.readParam(req.query.m, req.query.modify, undefined, "Modify", res);
		var login = decodeURIComponent(req.query.auth);
		var apikey = decodeURIComponent(req.query.apikey);
		var accessToken = decodeURIComponent(req.query.token);
		var rawData = {
			appName : appName,
			collection : collection,
			sel : sel,
			options : opt,
			mod : mod,
			version : new Date(),
			loginToken : apikey!="undefined"?apikey:(accessToken!="undefined"?accessToken:login),
			ip : req.connection?req.connection.remoteAddress:undefined,//For 'logs' and 'tracking' inserts
			socketid : false //explicit false for checking later
		}
		var event = Hyperyun.constants.restEvents[action];
		var eventMethod;
		var eventParallelization;
		var finalCallback;
		switch(action){
			case 'read':
				eventMethod = Hyperyun.Events.__find
				eventParallelization = Hyperyun.Events._p_find
				finalCallback = _.once(function(result){
					if(result.err)
						res.send(400,"Error:"+result.err);
					else
						res.send(200, result.array);
				})
				break;
			case 'edit':
				eventMethod = Hyperyun.Events.__update
				eventParallelization = Hyperyun.Events._p_update
				finalCallback = _.once(function(result){
					if(result.err)
						res.send(400,"Error:"+result.err);
					else
						res.send(200, result.res);
				})
				break;
			case 'write':
				eventMethod = Hyperyun.Events.__insert
				eventParallelization = Hyperyun.Events._p_insert
				finalCallback = _.once(function(result){
					if(result.err)
						res.send(400,"Error:"+result.err);
					else
						res.send(200, result.res);
				})
				break;
			case 'delete':
				eventMethod = Hyperyun.Events.__remove
				eventParallelization = Hyperyun.Events._p_remove
				finalCallback = _.once(function(result){
					if(result.err)
						res.send(400,"Error:"+result.err);
					else
						res.send(200, result.res);
				})
				break;
			default :
				res.send(400,"Error: Invalid REST command ('"+action+"')")
				return;
				break;
		}
		/*
		 *	Send constructed REST access through same pipeline as a socket access
		 */
		Hyperyun.Access.processExternalAccess(event, undefined, rawData, eventMethod, eventParallelization, finalCallback, undefined)
	}
}

/***
 *     ██████╗  █████╗ ██╗   ██╗████████╗██╗  ██╗
 *    ██╔═══██╗██╔══██╗██║   ██║╚══██╔══╝██║  ██║
 *    ██║   ██║███████║██║   ██║   ██║   ███████║
 *    ██║   ██║██╔══██║██║   ██║   ██║   ██╔══██║
 *    ╚██████╔╝██║  ██║╚██████╔╝   ██║   ██║  ██║
 *     ╚═════╝ ╚═╝  ╚═╝ ╚═════╝    ╚═╝   ╚═╝  ╚═╝
 *
 */
Hyperyun.OAuth = {};
Hyperyun.OAuth.credentials = {};
Hyperyun.OAuth.getClientRedirectURI = function(application, statedURI, clientID, userID, state, callback)
{
	var collName = application + dlim+"registeredOAuthClients";
	Hyperyun.Hyperstore.makeCollection(collName);
	Hyperyun.Hyperstore.collections[collName].db.findOne({client_id: clientID}, function(err, res){
		if(res && !err)
		{
			var redirect_uri = res.redirect_uri;
			if(statedURI != redirect_uri)
			{
				Hyperyun.Utils.togglelog(statedURI,'oauth');
				Hyperyun.Utils.togglelog(redirect_uri,'oauth');
				if(callback)
					callback("Invalid Redirect URI in Request", statedURI, null, state);
			}
			else
			{
				var authTable = application + dlim+"accessTokens";
				var tenMinutesFromNow = new Date((new Date()).getTime() + 10*60*1000);
				Hyperyun.Hyperstore.makeCollection(authTable);
				var authcode = Hyperyun.Utils.generateUID();
				Hyperyun.Hyperstore.collections[authTable].db.insert({client_id: clientID, redirect_uri: redirect_uri, authorization_code: authcode, expires: tenMinutesFromNow, user_id: userID}, function(err, res){
					if(callback) callback(err, redirect_uri, authcode, state);
				})
			}
		} else  if(callback) callback(err, redirect_uri);
	})
};

Hyperyun.OAuth.assureOAuth = function(req, res, next)
{
	var application = req.subdomains[0];
	if(application)
	{
		if(_.contains(_.keys(Hyperyun.OAuth.credentials), application))
		{
			var oauth = Hyperyun.OAuth.credentials[application];
			oauth.grant()(req, res, next);
		}
		else
		{
			var tc = application + dlim+"registeredOAuthClients";
			var tu = application + dlim+"users";
			var tat = application + dlim+"accessTokens";
			Hyperyun.Hyperstore.makeCollection(tc);
			Hyperyun.Hyperstore.makeCollection(tu);
			Hyperyun.Hyperstore.makeCollection(tat);
			var oauth = Hyperyun.OAuth.credentials[application] = oauthserver({
				model: new oauthmodel(Hyperyun.Hyperstore.collections[tc].db,Hyperyun.Hyperstore.collections[tat].db, Hyperyun.Hyperstore.collections[tu].db),
				grants: ['password', 'authorization_code', 'refresh_token'],
				debug: true,
				clientIdRegex: /^[a-z0-9-_@.]{3,40}$/i
			})
			oauth.grant()(req,res,next);
		}
	}
	else
		res.send({error: "OAuth Verifier '"+application+"' not found"});
}
// NOT USED ??
Hyperyun.OAuth.authoriseOAuth = function(req, res, next) {
	var application = req.subdomains[0];
	if(application)
	{
		if(_.contains(_.keys(Hyperyun.OAuth.credentials), application))
		{
			var oauth = Hyperyun.OAuth.credentials[application];
			return oauth.authorise(oauth, req, next)(req, res, next);
		}
		else
		{
			var tc = application + dlim+"registeredOAuthClients";
			var tu = application + dlim+"users";
			var tat = application + dlim+"accessTokens";
			Hyperyun.Hyperstore.makeCollection(tc);
			Hyperyun.Hyperstore.makeCollection(tu);
			Hyperyun.Hyperstore.makeCollection(tat);
			var oauth = Hyperyun.OAuth.credentials[application] = oauthserver({
				model: new oauthmodel(Hyperyun.Hyperstore.collections[tc].db,Hyperyun.Hyperstore.collections[tat].db, Hyperyun.Hyperstore.collections[tu].db),
				grants: ['password', 'authorization_code'],
				debug: true
			})
			return oauth.authorise(oauth, req, next)(req, res, next);
		}

	}
	else
		res.send({error: "OAuth Verifier '"+application+"' not found"});
}

Hyperyun.OAuth.auth = function(OAuthVersion, provider, code, appName, callback) {
	if(!appName) {
		// Add support for using oauth with the main service in the future.
		callback(true, false);
		return;
	}
	Hyperyun.Hyperstore.makeCollection(appName+dlim+company+"Configuration");
	Hyperyun.Hyperstore.collections[appName+dlim+company+"Configuration"].db.findOne({url: appName}, function(e, conf) {
		if(OAuthVersion=="oauth2") {
			Hyperyun.OAuth.auth2(provider, code, appName, conf.oauth, callback); 
		} else {
			Hyperyun.OAuth.auth1(OAuthVersion, provider, code, appName, conf.oauth, callback); 
		}
	});
}

Hyperyun.OAuth.auth1 = function(OAuthVersion, provider, code, appName, keys, callback) {
	// Get app options to redirect uri
	if(provider=="twitter") {
		var settings = {
			requestUrl: 'https://api.twitter.com/oauth/request_token',
			accessUrl: 'https://api.twitter.com/oauth/access_token',
      authVer: OAuthVersion,
      authCallback: null,
      signatureMethod: 'HMAC-SHA1',
      nonceSize: 32,
      customHeaders: {"User-Agent": companyCapitalized},
      params: {}
		};
		var getUrl = "https://api.github.com/user";
	}

	var oauth = new OAuth.OAuth(settings.requestUrl, settings.accessUrl, keys.consumerKey, keys.consumerSecret, settings.authVer, settings.authCallback, settings.signatureMethod, settings.nonceSize, settings.customHeaders);
   	oauth.getOAuthRequestToken(function(error, oauth_token, oauth_token_secret, oauth_authorize_url, additionalParameters ) {
      if(error) {
        callback(null, error); // Ignore the error upstream, treat as validation failure.
      } else {
        Hyperyun.Utils.togglelog( 'Successfully retrieved the OAuth Request Token' );
        var auth = new Object();
        auth['oauth_authorize_url']= oauth_authorize_url;
        auth["twitter_oauth_token_secret"]= oauth_token_secret;
        auth["twitter_oauth_token"]= oauth_token;
        callback(null, auth);
       // self.redirect(response, "http://twitter.com/oauth/authenticate?oauth_token=" + oauth_token, callback);
      }
    });
/*	oauth.getOAuthAccessToken(parsedUrl.query.oauth_token, request.session.auth["twitter_oauth_token_secret"], parsedUrl.query.oauth_verifier, function( error, oauth_token, oauth_token_secret, additionalParameters ) {
	        if (error) console.error(error);
	});  */
}

Hyperyun.OAuth.auth2 = function(provider, code, appName, keys, callback) {
	// Get app options to redirect uri
	if(provider=="github") {
		var settings = {
	       baseUrl: 'https://github.com/login',
	       authorizeUrl: "/oauth/authorize",
	       tokenUrl: "/oauth/access_token",
	       customHeaders: {"User-Agent": companyCapitalized},
	       params: {}
		};
		var getUrl = "https://api.github.com/user";
	} else if(provider=="facebook") {
		var settings = {
	       baseUrl: "https://graph.facebook.com",
	       authorizeUrl: null,
	       tokenUrl: null,
	       customHeaders: {},
	       params: {redirect_uri: options.redirect_uri}
		};
		var getUrl = "https://graph.facebook.com/me";
	} else if(provider=="weibo") {
		var settings = {
	       baseUrl: "https://api.weibo.com/oauth2",
	       authorizeUrl: "/authorize",
	       tokenUrl: "/access_token",
	       customHeaders: {},
	       params: {redirect_uri: options.redirect_uri}
		};
		var getUrl = "https://api.weibo.com/2/users/show.json";
	} else if(provider=="google") {
		var settings = {
	       baseUrl: "https://accounts.google.com/o/oauth2",
	       authorizeUrl: "/auth",
	       tokenUrl: "/token",
	       customHeaders: {},
	       params: {redirect_uri: options.redirect_uri, grant_type: 'authorization_code'}
		};
		var getUrl = "https://www.googleapis.com/oauth2/v1/userinfo?alt=jso";
	}
  var OAuth2 = OAuth.OAuth2;
 	var oauth2 = new OAuth2(keys.clientID, keys.clientSecret, settings.baseUrl, settings.authorizeUrl,settings.tokenUrl, settings.customHeaders);

	oauth2.getOAuthAccessToken(code, settings.params, function (e, access_token, refresh_token, results) {
       if(results.uid) {
       		getUrl+="?access_token="+access_token+"&uid="+results.uid;
       		access_token="";
       }
       oauth2.getProtectedResource(getUrl, access_token, function (err, resu, resp){
       		// Change err to !err for testing!
       		if(err) callback(null, resu);
       		resu = JSON.parse(resu);
       		Hyperyun.Accounts.createOrUpdateAccount(provider, {user: resu, access_token: access_token, appName: appName}, function(createResp) {
       			if(!createResp.err) callback(createResp.token);
       			else callback(null, createResp.err);
       		});
       });
	});
}

//   █████╗  ██████╗ ██████╗███████╗███████╗███████╗
//  ██╔══██╗██╔════╝██╔════╝██╔════╝██╔════╝██╔════╝
//  ███████║██║     ██║     █████╗  ███████╗███████╗
//  ██╔══██║██║     ██║     ██╔══╝  ╚════██║╚════██║
//  ██║  ██║╚██████╗╚██████╗███████╗███████║███████║
//  ╚═╝  ╚═╝ ╚═════╝ ╚═════╝╚══════╝╚══════╝╚══════╝
//
//  The Access object formalizes the notion of a client data interaction: any way in which
//	the user can ask for or request a modification must coherently be formulated as an access.
//	An access is the object of security and information methods, and can be mutated to reflect
//	security/privacy concerns and successful data access.

Hyperyun.Access = {};
Hyperyun.Access.Access = function(appName, event, originatingData){
	var self = this;
	self.event = event;
	self.version = new Date();
	self.data = originatingData

	self.app = appName == company ? companyApp : appName;
	self.has = {};

	if(!appName || !_.isString(appName)) throw "Access on undefined Application:"+"("+appName+")"+event
	if(!event || !_.isString(event)) throw "Access on undefined Event:"+"("+appName+")"+event
}
Hyperyun.Access.Access.prototype.associateLogin = function(loginToken, loginInfo){
	var self = this;
	self.loginToken = loginToken;
	self.loginInfo = loginInfo;
	self.login = loginInfo
	Hyperyun.Debug.eddy("ASSOCIATING LOGIN: ",loginToken,loginInfo)

	self.has.login = true;
}
Hyperyun.Access.Access.prototype.associateCollection = function(collection){
	var self = this;
	self.coll = collection;
	self.full_coll = self.app + dlim + self.coll
	Hyperyun.Hyperstore.makeCollection(self.full_coll);
	if(Hyperyun.Hyperstore.collections[self.full_coll])
	{
		self.db = Hyperyun.Hyperstore.collections[self.full_coll].db;
		self.has.collection = true
	}
	else
	{
		console.log("collection ",self.full_coll,"not found");
	}
}
Hyperyun.Access.Access.prototype.associateQuery = function(sel, mod, opt){
	var self =this;
	if(!opt) opt = {}
	self.sel = sel
	self.mod = mod
	self.opt = opt
	self.single = opt.single
	self.multi = opt.multi
	self.upsert = opt.upsert
	self.sort = opt.sort
	self.limit = opt.limit
	self.skip = opt.skip
	self.proj = opt.proj
	self.reactive = opt.reactive

	self.has.query = true
}
Hyperyun.Access.Access.prototype.associateUser = function(user){
	var self = this;
	self.user = user;
	if(_.isPlainObject(user))self.user_id = user._id;

	self.has.user = true
}
Hyperyun.Access.Access.prototype.associateSocket = function(socket){
	var self = this;
	self.socket = socket;
	self.tsid = socket.id;

	self.has.socket = true
}
Hyperyun.Access.Access.prototype.associateStream = function(stream){
	var self = this;
	self.stream = stream;

	self.has.stream = true
}
Hyperyun.Access.Access.prototype.associateError = function(error, detailMessage, error_type){
	var self = this;
	self.error = {errMsg: error, stipMsg: detailMessage}

	self.has.error = true
	if(error_type)self.has[error_type+"Error"] = true;
}
Hyperyun.Access.Access.prototype.summarize = function(){
	var self = this;

	return _.pick(self,['has','app','coll','full_coll','user','tsid','timings','event','sel','mod','opt','error'])
}
Hyperyun.Access.Access.prototype.timeEvent = function(tag, override){
	var self = this;
	if(!self.timings) self.timings = {}
	self.timings[tag] = override? override : new Date();

	self.has.timings = true;
}
Hyperyun.Access.Access.prototype.toJSON = function(){
	var self = this;
	return _.omit(self,['db','socket','stream'])
}
Hyperyun.Access.Access.prototype.isAssociatedWith = function(array){
	var self = this;
	return _.all(array,function(assoc){return self.has[assoc]})
}

Hyperyun.Access.wrapWithAccess = function(event, socket, fn, parallelFn){
	return function(data, callback){
		if(event == 'disconnect')
			Hyperyun.Debug.eddy("Disconnecting wtih reason",data)
		Hyperyun.Access.processAccess(event, socket, data, undefined, fn, parallelFn, callback, {isExternal:true})
	}
}

Hyperyun.Access.wrapWithStreamAccess = function(event, socket, fn, parallelFn){
	return function(stream, data, callback){
		Hyperyun.Access.processAccess(event, socket, data, stream, fn, parallelFn, callback, {isExternal:true});
	}
}

Hyperyun.Access.processAccess = function(event, socket, rawData, streamObject, eventMethod, eventParallelization, finalCallback, constructFlags){
	var rawRevivedData = Hyperyun.Utils.reviveJSON(rawData);
	if(!_.isFunction(finalCallback))
	{
		finalCallback = function(res,err,ver,deb){Hyperyun.Debug.eddy("No callback provided? Would have received",res,err,ver,deb)};//let event methods assume final callback exists
	}	
	//Assemble Access
	Hyperyun.Access.constructAccess(event,rawRevivedData,socket,streamObject, function(err,access){
		if(err || !access){
			finalCallback({res:access, err:err, info:{version: new Date()}})
			return;
		}
		access.timeEvent("constructionDone")
		if(eventParallelization) access.eventParallelization = eventParallelization

		//Sanitize Access
		Hyperyun.Access.verifyAccess(access, function(err, access, stipulationMessage){
			if(access) access.timeEvent("verificationDone")

			Hyperyun.Debug.eddy(err?"Error On "+event+" Access: "+err+". (Stipulation:"+stipulationMessage+"), access was: "+JSON.stringify(access):"Successful On "+event+"Access for "+((access.socket != undefined)?access.socket.id:("umm?"+access.socket))+" ('"+access.stipMsg+"')");
			if(!err && access) eventMethod(access, stipulationMessage, finalCallback);
			else finalCallback({res:access, err:err, info:{version: new Date()}});
		});
	}, constructFlags)
}

Hyperyun.Access.constructAccess = function(event, data, socket, streamObj, callback, flags){
	var error = false;
	var access;
	var appName = 
		data.appName  ? data.appName  :
		data.loginApp ? data.loginApp :
		socket 		  ? socket.appName:
		undefined;
	var tgtCollection = 
		Hyperyun.constants.eventCollectionMap[event] ? Hyperyun.constants.eventCollectionMap[event]: 
		data.collection;

	if(appName == undefined) {
		if(callback)callback("appName isn't defined",undefined);
		return;
	}

	//Set up access: we are promised an appName and event	
	try 
	{
		access = new Hyperyun.Access.Access(appName, event, data);
	}
	catch (e){
		console.error("Error constructing access due to lack of required parameter ("+e+"). Failing access request.")
		if(callback)callback(e, access)
		return;
	}
	//TODO: Idiosyncratic initialization here. Perhaps shift into the more interested function
	if(access.event == 'removeFile') 
		data.sel = {gridfs_id: ObjectID.createFromHexString(data.file_id)};
	if(_.contains(['loggedIn','logout','disconnect','passwordLogin','changePassword','forgotPassword'], access.event))
		access.switchToCompanyAdminIfAdmin = true
	access.socketid = data.socketid;
	access.code = data.code;
	access.name = data.name;
	access.url = data.url
	access.file_id = data.file_id;
	access.metadata = data.metadata;
	access.isAnEventMessage = data.isAnEventMessage;
	access.recursion = data.recursion;
	access.firstUser = data.firstUser;
	//TODO: </End idisyncratic initialization>

	//Perform associations
	if(streamObj) 		access.associateStream(streamObj)
	if(socket) 			access.associateSocket(socket)
	if(tgtCollection) 	access.associateCollection(tgtCollection)
	if(data.sel != undefined) 		access.associateQuery(data.sel, data.mod, data.opt)	
	if(data.loginToken || data.login) access.associateLogin(data.loginToken, data.login);

	if(!flags || flags.isExternal){
		access.loginToken = data.loginToken;
		Hyperyun.Access.associateAccessor(access, function(err,access){
			callback(error, access);  
		})
	}
	//Internal access is trusted
	else{
		access.associateUser({isInternal: true, isAppOwner: true, isCompanyAdmin: true, role: 'Admin'})
		callback(error,access);
	}
}

Hyperyun.Access.verifyAccess = function(access, callback){
	Hyperyun.Hyperstore.makeCollection(access.app+dlim+company+"Configuration");
	Hyperyun.Hyperstore.makeCollection(access.app+dlim+company+"Collections");
	Hyperyun.Hyperstore.collections[access.app+dlim+company+"Configuration"].db.findOne({url:access.app},function(err1,app){
		Hyperyun.Hyperstore.collections[access.app+dlim+company+"Collections"].db.findOne({name:access.coll},function(err,collection){
			if(err || err1 || !app){
				callback("Application not found on "+access.event+" access. (Error?:"+err+"/"+err1+", url:"+access.app+"/"+access.coll+"["+app+"]"+") During verify access, app unavailable for use"); return}

			var errMsg = stipMsg = false;
			var user_role = access.user && access.user.role ? access.user.role.toLowerCase() : 'public'
			var collectionSecurity = collection ? collection.security : {}
			var appSecurity = app.security ? app.security : {}
			var security =
				_.merge(
					Hyperyun.constants.defaultSecurity,
					appSecurity,
					collectionSecurity,
					Hyperyun.constants.hardcoded_security);

			//Failure States
			if(!(security.all && security.all[access.event] > 0) && !(security[user_role] && security[user_role][access.event] > 0))
				callback("Access Denied (Verb permission): Your role '"+user_role+"' is not allowed to perform the '"+access.event+"' verb on the '"+access.full_coll+"' collection", access, "Access not otherwise verified: rejected outright due to out-of-role verb");
			else if(_.contains(Hyperyun.constants.executive_events, access.event) && access.user && (!access.user.isAppOwner && !access.user.isCompanyAdmin))
				callback("Access Denied (Permission): Only app owner may perform "+access.event+" actions",access,"Access not otherwise verified: rejected outright due to non-executive privileged access");
			//Success: verify mongo query if needed, otherwise proceed
			else if(!_.contains(Hyperyun.constants.query_events, access.event))
			{
				callback(errMsg, access, "Non-query access not otherwise verified other than user_role checked for action");
			}
			else 
				Hyperyun.Access.processQueryDocuments(access,security,function(clean_access){
					//access at this point is safe to run mongo queries or to throw
					if(access.mongoCheckError) callback(access.mongoCheckError.errMsg, clean_access, access.mongoCheckError.stipMsg);
					else callback(errMsg, clean_access, access.stipMsg);
				}, access.eventParallelization);
		})
	});
}

Hyperyun.Access.broadcastAccess = function(access, doc){
	//Access is associated with mongo data: broadcast to subscribers
	Hyperyun.Debug.eddy("broadcasting access (",access.event,")? - ",access.preFindResults, access.preFindResults && access.preFindResults.touched);
	if(access.preFindResults && access.preFindResults.touched){
		var activeQueries = []
		_.forEach(access.preFindResults.touched, function(datum){
			_.forEach(Hyperyun.Hyperstore.subscriptions[datum], function(listener){
				if(!_.contains(activeQueries,listener))
				{
					activeQueries.push(listener);
				}
			})
		})
		var socketsToBroadcast = [];
		_.forEach(activeQueries,function(activeQuery){
			socketsToBroadcast = _.union(Hyperyun.Hyperstore.active_queries[activeQuery].subscribers, socketsToBroadcast);
		})
		_.forEach(socketsToBroadcast, function(socket_id){
			Hyperyun.Access.notifySocketSubscriber(socket_id, access);
		})
	}
}

Hyperyun.Access.notifySocketSubscriber = function(socket_id, access){
	var event = Hyperyun.constants.emitEvents[access.event]
	var socket = io.of("/"+access.full_coll).connected[socket_id];
	if(!socket || !event)
	{
		Hyperyun.Debug.eddy("Error notifying",socket_id,"of",event,": ",(event?"Socket was "+socket:"Event was "+event))
		return
	}		

	Hyperyun.Access.findAccessor(access.app, socket.loginTokenUsed, function(err, user){
		if(!err)
		{
			var payload = {
				version: access.version, 
				sel: Hyperyun.Access.redact(access.sel,permissionCode.fromString("444"),user._id,user.groups,user.isCompanyAdmin), 
				opt: access.opt, 
				mod: Hyperyun.Access.redact(access.mod,permissionCode.fromString("444"),user._id,user.groups,user.isCompanyAdmin), 
				socketid: access.socketid}
			//Only emit if the access hasn't been entirely redacted
			if(payload.sel != undefined && !(_.isEqual(payload.sel, {}) && !_.isEqual(access.sel,{}))) 
			{
				socket.emit(event,payload);	
			}
		}
		else Hyperyun.Debug.eddy("Error finding accessor for loginToken ",socket.loginTokenUsed);
	})
}

Hyperyun.Access.associateAccessor = function(access, callback){
	var app = access.app;
	var loginToken = access.loginToken;
	Hyperyun.Access.findAccessor(app, loginToken, function(err, user){
		if(!err && user)
			access.associateUser(user);
		else if(!err)
			access.associateUser({});
		callback(err, access);
	})
}

Hyperyun.Access.findAccessor = function(app, loginToken, callback){
	Hyperyun.Hyperstore.makeCollection(app+dlim+company+"Configuration");
	Hyperyun.Hyperstore.makeCollection(app+dlim+company+"Admins");
	Hyperyun.Hyperstore.makeCollection(app+dlim+"users");
	Hyperyun.Hyperstore.collections[app+dlim+company+"Configuration"].db.findOne({url:app}, function(err,res){
		var check = {$and:[{loginToken:{$exists:true}},{'loginToken.token':loginToken}]}
		if(!err && res) var ownerID = res.user_id;

		Hyperyun.Hyperstore.collections[app+dlim+company+"Admins"].db.findOne(check, function(err,res){
			var userdoc = {};
			if(res && !err) userdoc.isAppOwner = false
			if(res && !err && res.role == 'Admin' && loginToken)//Superadmin
			{
				userdoc.isCompanyAdmin = true;
				userdoc = _.defaults(userdoc, res);
				callback(err,userdoc);
				return;
			}
			Hyperyun.Hyperstore.collections[app+dlim+"users"].db.findOne(check, function(err,res){
				if(!err && res && loginToken){//Existing User
					userdoc = _.defaults(userdoc, res);
					//access.user_id = userdoc._id;
					callback(err, userdoc);
				}
				else callback(err, false);
			})
		})
	})	
}
//   ██████╗███████╗███╗   ██╗███████╗ ██████╗ ██████╗ 
//  ██╔════╝██╔════╝████╗  ██║██╔════╝██╔═══██╗██╔══██╗
//  ██║     █████╗  ██╔██╗ ██║███████╗██║   ██║██████╔╝
//  ██║     ██╔══╝  ██║╚██╗██║╚════██║██║   ██║██╔══██╗
//  ╚██████╗███████╗██║ ╚████║███████║╚██████╔╝██║  ██║
//   ╚═════╝╚══════╝╚═╝  ╚═══╝╚══════╝ ╚═════╝ ╚═╝  ╚═╝
//       
/*
	function Hyperyun.Access.processQueryDocuments

	Looks at the query documents in an access, parses them, and checks permissions.
	Runs a pre-find to check for _doc level permission stipulations.

		Selector Validation

		The selector, if present, is flattened and has each field checked agains thte security
		schema. Each such field is compared to its most specific security, and the security
		code (based on the accessor) is taken from that part of the security. This security
		code is quickly invalidated based on accessor traits, and may also instate the introduction
		of a set of constraints that need to be satisfied by the 'dry run' of the selector on
		the data, to ensure correct & secure access. Once all this is done, the selector is
		rebuilt and considered safe or is invalidated.

		Because we are unable to generally predict what form of accesses a query will perform,
		we run the selector on the database to determine which documents and fields it looks at.
		Then, after running the naked results against the security schema, we flag any access
		that warrants a verification or invalidation.

		Nota Bene: 'fq' means 'field query', referring to a 'bit' of the query document

		hs_doc format that we check:
		{
			_id: ObjectId('320jg20-3g38j88-a30g'),
			foo: 'bar',
			cnt: 12345,
			comment : {...},
			arrey : [...],
			hs_doc : {
				created_at : "Tuesday",
				modified_at : "Wednesday",
				owner_id : 3810fs0-sf02oai-302-aa0s,
				owner_groups : ['members','football_players','moderators'],
				permission : 0x777 //owner,group,public
			}
		}
 */
Hyperyun.Access.processQueryDocuments = function(access, security, toCallOnProcessed, toCallOnDocument){
	//Translate a bit
	var access_map = {find:'444',remove:'222',insert:'222',update:'222',removeFile:'222',uploadFile:'222',chmod:"200",chown:"200"};
	var access_type = access_map[access.event]?access_map[access.event]:'444';
	var access_priv = permissionCode.fromString(access_type)
	//Defaultize access
	access = _.defaults(access,{limit:100, skip:0, hash:false, sel:{}, mod:{}, proj:{}});
	access.preFindResults = {violated:[],obeyed:[], touched:[]};
	if((access.opt.single || access.opt.multi === undefined) && access.event == 'delete')
	{
		access.limit = access.opt.limit = 1;
	}
	//Set hardcoded max size of queries
	if(access.opt.limit > 1000 || access.limit > 1000)
	{
		access.opt.limit = Math.max(access.opt.limit,access.limit);
		access.stipMsg = companyCapitalized+" has a 1000 document limit for queries : limit reduced to 1000 from "+access.opt.limit;
		access.limit = access.opt.limit = 1000;
	}
	//If we're updating, set up the stuff we care about checking in modifier
	if(access.event == 'update')
	{
		var fSel = access.opt && access.opt.upsert?Hyperyun.Access.flattenQueryIntoQueryPaths(access.sel, "", true):[];
		var fMod = _.union(fSel,Hyperyun.Access.flattenQueryIntoQueryPaths(access.mod, "", true));
	}
	access.timeEvent("preFindStart")

	//Per Doc
	function perDoc(doc, onDocProcessingDone)
	{
    	access.timeEvent('preFindEnd')
		//Do Omission
		var isObj = _.isObject(doc);
		var redactDoc = Hyperyun.Access.redact(doc, access_priv, access.user?access.user._id:undefined, access.groups, access.user && (access.user.isInternal || access.user.isCompanyAdmin || access.user.isAppOwner));
		if(!redactDoc && isObj)//was invalidate-redacted to nothing
		{
			onDocProcessingDone(access);
			return;
		}
		if(access.event == 'update' || access.event == 'chmod' || access.event == 'chown')
		{
			var badModification = Hyperyun.Access.detectProhibitedModification(fMod, doc, access_priv, access.user?access.user._id:undefined, access.groups);
			if(badModification){
				Hyperyun.Access.setCensorError(access, "Invalidated by pre-find: tried to access forbidden document field ("+badModification+") in modifier", badModification)
				access.preFindResults.violated.push({vDoc:doc, vFQ:{}});
			}
		}
		if(redactDoc && !badModification) access.preFindResults.touched.push(doc._id);
		if(_.size(access.preFindResults.violated) > 0 )
			Hyperyun.Access.setCensorError(access,"Invalidated by pre-find: tried to access forbidden document field ("+JSON.stringify(access.preFindResults.violated[0])+") in selector", access.preFindResults.violated[0])
		else if(!access.mongoCheckError && !access.stipMsg)
			access.stipMsg = "No bad access detected in selector " + (access.event == 'update'?"or modifier":"") + "(" + JSON.stringify(access.sel) + (access.event == 'update'?"/"+JSON.stringify(access.mod)+")":")")
		
		//.each passes null when it's done
		if(doc != null) toCallOnDocument(redactDoc, access, onDocProcessingDone);
    }
    //TODO: this ensures not calling back multiple times, but our code flow shouldn't even have this be possible. Debug.
	toCallOnProcessed = _.once(toCallOnProcessed);
	//Singleton count alternate flowpath
	if(access.limit == 1)
	{
		db_native.collection(access.full_coll).find(access.sel,
			{sort:access.opt.sort,skip:access.opt.skip,limit:access.opt.limit}).maxTimeMS(35000).toArray(function(err,results){
			if(results)
				var doc = results[0]
			if(!err)
			{
				perDoc(doc,
					function() {
						access.preFindResults.obeyed = [doc];
					  access.preFindResults.touched = [doc._id];
					  toCallOnProcessed(access);
					}
				);
			}
			else
			{
				Hyperyun.Access.setCensorError(access,err,undefined);
	    		toCallOnProcessed(access);
			}
		})
	}
	//Default flowpath
	else
	{
    	//Do the Aggregation
    	var stages;
		if(_.isObject(access.opt.sort)) stages = [
			{ $match : access.sel },
			{ $sort  : access.opt.sort},
	        { $skip  : access.opt.skip }, 
	        { $limit : access.opt.limit}
		]
		else stages = [
			{ $match : access.sel },
	        { $skip  : access.opt.skip }, 
	        { $limit : access.opt.limit }
		];
		var cursor = db_native.collection(access.full_coll).find(access.sel,{sort:access.opt.sort,skip:access.opt.skip,limit:access.opt.limit})
		//Async process the Docs
	    var q = async.queue(function (doc, callback) {
		  perDoc(doc, function(){callback()});
		}, Infinity);
		var hasRunAtAll = false //TODO: eugh
		var allDone = false;
		var cntr = 0;

		var cStream = cursor.stream();

		cStream.on("data", function(doc){
		  if(doc) q.push(doc); // dispatching doc to async.queue
		  hasRunAtAll = true;
		})
		cStream.on("error", function(err){
		  	console.error("Error in process query stream:",err);
		  if (err){
		  	Hyperyun.Access.setCensorError(access,err,undefined);
		  	toCallOnProcessed(access);
		  }
		})
		cStream.on("end", function(){
			if(!hasRunAtAll)
			{
				access.preFindResults.obeyed = access.preFindResults.touched = [];
				if(access.event == "insert")//run insert if we found no assets
				{
					toCallOnDocument(undefined, access, toCallOnProcessed);
				}
				else
				{
					access.debugMessage = "Stream ended without running anything. AllDone:"+allDone
					toCallOnProcessed(access);
				}
			}
			else
			{
				allDone = true;
				//if q drained before we got here, close out
				if(_.size(q.tasks) == 0)
				{
					access.debugMessage = "Stream ended with the q drained"
					toCallOnProcessed(access);
				}
			}
		})
		q.drain = function() {
			//if 'end' triggered before we finished, close out
		  if(allDone)
		  {
		  	access.debugMessage = "Stream ended before q drained"
		    toCallOnProcessed(access);

		  }
		}
	}
}
Hyperyun.Access.hsDocPermitsAccess = function(hs_doc, field, accessor_permission_code, accessor_id, accessor_groups, isAdmin)
{
	if(isAdmin) {return true;}
	if(hs_doc)
	{
		var accesscode = accessor_permission_code;
		var docPermissions = hs_doc.permissions !== undefined?hs_doc.permissions:permissionCode.encodePermission(hs_doc);
		var fieldPermissions = hs_doc.omits && field && hs_doc.omits[field] !== undefined?hs_doc.omits[field]:undefined;
		if(fieldPermissions !== undefined) docPermissions = fieldPermissions;
		if(_.isString(docPermissions)) docPermissions = permissionCode.fromString(docPermissions);
		if(docPermissions === undefined)//HS_doc doesn't have any permissions specified
		{
			//TODO: what do if no permissions whatsoever defined?
			//      should lack of hs_doc permission imply free access?
			docPermissions = permissionCode.fromString("777")
		}
		//Do masks: if we don't meet criteria, our access isn't valid
		if(hs_doc.owner_id && hs_doc.owner_id.toString() != accessor_id)
		{
			Hyperyun.Debug.eddy(hs_doc.owner_id, "is not equal to",accessor_id,":revoking permission");
			accesscode = permissionCode.revokePermission(accesscode, 'owner');
		}
		else
		{
			Hyperyun.Debug.eddy("allowed, since",hs_doc.owner_id,accessor_id);
		}
		if(_.size(_.intersection(hs_doc.owner_groups, accessor_groups)) <= 0)
			accesscode = permissionCode.revokePermission(accesscode, 'group');
		return docPermissions & accesscode
	} else {return true;} //TODO: Should lack of hs_doc entail permission?
}
Hyperyun.Access.redact = function(doc, accessor_permission_code, accessor_id, accessor_groups, isAdmin){
	var result = Hyperyun.Access.recursiveCensor(
		doc,
		function(hs_doc){
			return Hyperyun.Access.hsDocPermitsAccess(hs_doc, undefined, accessor_permission_code, accessor_id, accessor_groups, isAdmin);
		},
		function(hs_doc,field){
			return Hyperyun.Access.hsDocPermitsAccess(hs_doc, field, accessor_permission_code, accessor_id, accessor_groups, isAdmin);
		})
	return (result==null && doc !=null)?false:result
}
Hyperyun.Access.detectProhibitedModification = function(flattened_query, doc, accessor_permission_code, accessor_id, accessor_groups, isAdmin){
	return _.find(flattened_query, function(fq){
		var hs_doc = fq.path.associatedHS_Doc(doc)
		var field = fq.path.finalField()
		var clean = Hyperyun.Access.hsDocPermitsAccess(hs_doc, field, accessor_permission_code, accessor_id, accessor_groups, isAdmin);
		if(!clean) Hyperyun.Debug.eddy("PROHIBITED ACCESS ON : ",field, hs_doc,accessor_id)

		return !clean;
	})
}
Hyperyun.Access.autoPermissionDocument = function(document){
	return Hyperyun.Access.recursiveTransformField(document,"hs_doc",function(hs_doc){
		if(!hs_doc.permissions)
		{
			return _.extend(hs_doc,{permissions : permissionCode.fromString("777")})//TODO: make this app specific!!!!
		}
		return hs_doc
	})
}
Hyperyun.Access.setCensorError = function(access, errMsg, stipMsg){
	access.mongoCheckError = {
		errMsg: errMsg,
		stipMsg: stipMsg
	}
}
//This useful recursive function will omit objects where the fnDet function isn't satisfied by the hs_doc, and omit fields where fnTran is dissatisfied by the hs_doc
//	fnDet is passed the hs_doc for the current level, and must return a boolean value (false = prune, true = retain)
// 	fnTran is passed the hs_doc for the current level and the field key being considered for transform (false = omit, true = recurse)
Hyperyun.Access.recursiveCensor = function(document, fnDet, fnTran){
	if(_.isPlainObject(document))
	{
		if(_.isFunction(fnDet) && fnDet(document.hs_doc))
		{
			return _.transform(document, function(result,v,k){
				if(!_.isFunction(fnTran) || (_.isFunction(fnTran) && fnTran(document.hs_doc,k)))
				{
					result[k] = Hyperyun.Access.recursiveCensor(v, fnDet, fnTran)
				}
				else
				{
					return undefined//omit object's field
				}
			})
		} else {
			return undefined//omit whole object
		}
	}
	else if(_.isArray(document))
		return _.map(document, function(ele){return Hyperyun.Access.recursiveCensor(ele, fnDet, fnTran)});
	else
		return document;
}
Hyperyun.Access.recursiveTransformField = function(document, field, fnTran){
	if(_.isPlainObject(document))
	{
		return _.transform(document, function(result, v, k){
			if(k == field && fnTran)
				result[k] = fnTran(v)
			else
				result[k] = Hyperyun.Access.recursiveTransformField(v,field,fnTran);
		})
	}
	else if(_.isArray(document))
		return _.map(document, function(ele){return Hyperyun.Access.recursiveTransformField(ele, field, fnTran)});
	else
		return document
}
//  ███████╗██╗   ██╗███████╗███╗   ██╗████████╗███████╗
//  ██╔════╝██║   ██║██╔════╝████╗  ██║╚══██╔══╝██╔════╝
//  █████╗  ██║   ██║█████╗  ██╔██╗ ██║   ██║   ███████╗
//  ██╔══╝  ╚██╗ ██╔╝██╔══╝  ██║╚██╗██║   ██║   ╚════██║
//  ███████╗ ╚████╔╝ ███████╗██║ ╚████║   ██║   ███████║
//  ╚══════╝  ╚═══╝  ╚══════╝╚═╝  ╚═══╝   ╚═╝   ╚══════╝
//
//Setup Events
Hyperyun.Events = {};
Hyperyun.Events.__generateAPIKey = function(access, stipulation, callback){
	Hyperyun.Application.generateAPIKey(access.app, callback);
}

Hyperyun.Events.__analyticsEvent = function(access, stipulation, callback){
	Hyperyun.Application.recordAnalyticsEvent(access);
	callback(true);
}

Hyperyun.Events.__createCollection = function(access, stipulation, callback){
	Hyperyun.Application.recordAnalyticsEvent(access);
	if(access && access.coll && access.coll != 'messages') Hyperyun.Analytics.originateMessageEvent(access.app,'messages','collectionMade',access.summarize(),function(res,err,ver){Hyperyun.Debug.eddy("originated message!")})
	callback({name: access.coll, array:[], version: access.version});
}

Hyperyun.Events.__logout = function(access, stipulation, callback){
	Hyperyun.Hyperstore.unsubscribeListener(access.socket?access.socket.id:undefined);
	_.each(Hyperyun.Sockets.findClientsSocket(), function(client){
		if(client.loginTokenUsed == access.loginToken && client != access.socket) client.emit("remoteLogout");
	});
	if(access.user_id)
	{
		var selector = {"_id":access.user_id}
		var modifier = {$set: {isOnline: false, loginToken: undefined}}
		access.db.update(selector, modifier, {}, function(err, doc){
					Hyperyun.Application.recordAnalyticsEvent(access);
					if(access && access.coll && access.coll != 'messages') Hyperyun.Analytics.originateMessageEvent(access.app,'messages','logout',access.summarize(),function(res,err,ver){Hyperyun.Debug.eddy("originated message!")})
					io.of("/"+access.full_coll).emit('getUpdate', {methodAlias:'logout',version: new Date(), sel: selector, mod: modifier, options: {}, socketid: access.tsid, timing:access.timings});
					if(!err) callback({err: false, res: true, info:{version: new Date()}});
					else callback({err: err, res:undefined, info:{version: new Date()}});
				});
	} else {
		callback({err:"No user_id retrieved: database information not updated",res:true,info:{version: new Date()}});
	}
}

Hyperyun.Events.__passwordSignUp = function(access, stipulation, callback){
	Hyperyun.Accounts.createAccount('password', access.sel, null, access.app, false, callback);
}

Hyperyun.Events.__passwordLogin = function(access, stipulation, callback){
	var loginSelector = null;
	if(access.login) {
		var asAdmin = access.login.asAdmin;
		if(access.login.email) loginSelector = {emails: {$in: [access.login.email]}};
		else if(access.login.username) loginSelector = {username: access.login.username};
		else if(access.login.token) loginSelector = {"loginToken.token": access.login.token};
	}
	if(loginSelector) {
		var loginTable = asAdmin?access.app+dlim+company+"Admins":access.app+dlim+"users";
		Hyperyun.Hyperstore.collections[loginTable].db.findOne(loginSelector, function(err,doc) {
			if(doc){
				if (doc.status) {
					if(!access.login.token) {
						bcrypt.compare(access.login.password, doc.password, function(err, res) {
						    if(res) {
								var enddate=new Date()
								enddate.setDate(enddate.getDate() + 6);
								var token = bcrypt.hashSync(doc._id+new Date(), bcrypt.genSaltSync(10));
								access.socket.loginTokenUsed = access.loginToken
								var modifier = {$set: {isOnline:true, lastLoggedIn:new Date(),loginToken: {token: token, expires: enddate}}};
								Hyperyun.Hyperstore.collections[loginTable].db.update(loginSelector, modifier, {}, function(err, sth){
									doc.loginToken= {token: token, expires: enddate};
									delete doc.password;
									callback({err: err, info:{version: access.version}, res: doc, user: doc, token: token, exdate: enddate});
									if(!err)
									io.of("/"+access.full_coll).emit('getUpdate', {methodAlias:'login',version: new Date(), sel: loginSelector, mod: modifier, options: {}, socketid: access.tsid, timing:access.timings});
								});
							}
							else callback({err: companyCapitalized+": Error: Incorrect password.", res: undefined, info:{version: access.version}});
						});
					} else {
						var enddate=new Date()
						enddate.setDate(enddate.getDate() + 6);
						var token = access.login.token;
						access.socket.loginTokenUsed = access.loginToken
						var modifier = {$set: {isOnline:true, lastLoggedIn:new Date(),loginToken: {token: token, expires: enddate}}};
						Hyperyun.Hyperstore.collections[loginTable].db.update(loginSelector, modifier, {}, function(err, sth){
							doc.loginToken= {token: token, expires: enddate};
							delete doc.password;
							callback({err: err, info:{version: access.version}, res: doc, user: doc, token: token, exdate: enddate});
							if(!err)
							io.of("/"+access.full_coll).emit('getUpdate', {methodAlias:'login',version: new Date(), sel: loginSelector, mod: modifier, options: {}, socketid: access.tsid, timing:access.timings});
						});
					}
				} else callback({err: companyCapitalized+": Error: Account not activated yet.", res: undefined, info:{version: access.version}});
			} else callback({err: companyCapitalized+": Error: unable to find doc to log in to. Target account does not exist in "+loginTable,res:undefined, info:{version: access.version}})
		});
	} else callback({err: companyCapitalized+": Error: Provided identification insufficient. Check that an email or username field is defined in your login. Received info was:"+access.login, res:undefined, info:{version: access.version}});
}

Hyperyun.Events.__loggedIn = function(access, stipulation, callback){
	var response = {res:access.user};
	if(!access.loginToken)
	{
		callback({err:"Failed to login: no token provided"});
		return;
	}
	if(!access.user_id)
	{
		callback({err:"User_id not found"});
		return;
	}
	var sel = {_id:access.user_id}
	var mod = {$set:{isOnline: true, lastLoggedIn:new Date()}}
	access.db.update(
		sel,
		mod,
		function(err, res){if(!err){Hyperyun.Debug.eddy("SUCCESSFULLY LOGGED IN, using token "+access.loginToken)}else{Hyperyun.Debug.eddy("Failed to login.")}
	});
	Hyperyun.Hyperstore.collections[access.app+dlim+company+"Configuration"].db.findOne({url:access.app},function(err, app){
		if(!err && app)
		{
			Hyperyun.Application.recordAnalyticsEvent(access);
			if(access && access.coll && access.coll != 'messages') Hyperyun.Analytics.originateMessageEvent(access.app,'messages','login',access.summarize(),function(res,err,ver){Hyperyun.Debug.eddy("originated message!")})
			if(app.settings)
			{
				response.reconnects = app.settings.reconnect;
				response.defaultDisconnectModificationStrategy = app.settings.defaultDisconnectModificationStrategy?app.settings.defaultDisconnectModificationStrategy:1;
				response.disconnectModificationStrategy = app.settings.disconnectModificationStrategy?app.settings.disconnectModificationStrategy:{};
			}
		}
		else if(!app){
			Hyperyun.Debug.eddy("Logged in to nonexistant app??",access)
		}
		callback(response);
	});
}

Hyperyun.Events.__changePassword = function(access, stipulation, callback){
	var selector = access.data.forgotPassword?{"forgotPassword":access.data.forgotPassword}:{"loginToken.token":access.loginToken};
	access.db.findOne(selector, function(err, user){
		if(!err && user) {
			var changePW = function(){
				bcrypt.genSalt(10, function(err, salt) {
					bcrypt.hash(access.data.newpassword, salt, function(err, hash) {
						if(hash && !err)
							access.db.update({_id: user._id}, {$set: {password: hash}}, {}, function(err, sth){
								Hyperyun.Application.recordAnalyticsEvent(access);
								if(access && access.coll && access.coll != 'messages') Hyperyun.Analytics.originateMessageEvent(access.app,'messages','passwordChanged',access.summarize(),function(res,err,ver){Hyperyun.Debug.eddy("originated message!")})
								callback({err: err, res: true, info:{version: access.version}});
							})
						else callback({err:companyCapitalized+": Error: Change password failed on hash.", res:undefined, info:{version:access.version}});
					})
				});
			};
			if(access.data.forgotPassword)
				changePW;
			else
				bcrypt.compare(access.data.oldpassword, user.password, function(err, res) {
				    if(res) {
						changePW();
				    } else callback({err: companyCapitalized+": Error: Incorrect password.", res: undefined, info:{version: access.version}});
				});
		} else callback({err: err, res: undefined, info:{version: access.version}});
	});
}

Hyperyun.Events.__forgotPassword = function(access, stipulation, callback){
	var selector = {emails: {$in: [access.data.email]}}
	access.db.findOne(selector, {}, function(err, user){
		if(!err && user) {
			var token = new ObjectID().toHexString();
			access.db.findAndModify(selector, [['_id','asc']], {$set: {forgotPassword: token}}, {}, function(err, doc){
				if(!err)
				{
					doc.forgotPassword = token;
					Hyperyun.Mailer.sendMail(access.app, "Password Recovery", doc, access?access.socket:undefined, function(e, res) {
						callback({err:e, res:(e?false:res), info:{version:access.version}})
					});
				} else callback({err: err, res: null, info:{version:access.version}});
			});
		} else callback({err: companyCapitalized+": Error: email does not exist.", res: null, info:{version: access.version}});
	});
}

Hyperyun.Events.__activate = function(access, stipulation, callback){
	Hyperyun.Accounts.activateAccount(access.app, access.code, function(res){
		Hyperyun.Application.recordAnalyticsEvent(access);
		if(access && access.coll && access.coll != 'messages') Hyperyun.Analytics.originateMessageEvent(access.app,'messages','accountActivated',access.summarize(),function(res,err,ver){Hyperyun.Debug.eddy("originated message!")})
		callback({err: res.err, res:res.err?undefined:true, info:{version: new Date()}});
	})
}

Hyperyun.Events.__getOAuthSettings = function(access, stipulation, callback){
	access.db.findOne({url: access.app}, function(err,app){
		if(app && !err) {
			if(access.data.method=="github") {
				callback({ redirect_uri: "http://"+access.data.host+"/auth/github/oauth2/"+access.app+"/"+access.socket}, {url: "https://github.com/login/oauth/authorize", client_id: "82d45035bc88a95124eb"});
			} else if(access.data.method=="facebook") {
				callback({ redirect_uri: "http://"+access.data.host+"/auth/facebook/oauth2/"+access.app+"/"+access.socket}, {url: "https://www.facebook.com/dialog/oauth", client_id: app.services[access.data.method].public});
			} else if(access.data.method=="google") {
				callback({ redirect_uri: "http://"+access.data.host+"/auth/google/oauth2/"+access.app+"/"+access.socket, response_type:"code", scope: "https://www.googleapis.com/auth/userinfo.profile"}, {url: "https://accounts.google.com/o/oauth2/auth", client_id: app.services[access.data.method].public});
			} else if(access.data.method=="weibo") {
				state = encodeURIComponent(JSON.stringify({socket: access.socket, appName: access.app}));
				callback({ redirect_uri: "http://"+access.data.host+"/auth/weibo/oauth2/", state: state}, {url: "https://api.weibo.com/2/oauth2/authorize", client_id: "3371699035"});
			} else callback({error: companyCapitalized+": Wrong method/service"}, {});
		} else callback({error: companyCapitalized+": Settings not found", status: err}, {});
	})
}


Hyperyun.Events.__afterOAuth = function(access, stipulation, callback){
	access.socket.emit('OAuthLogin', access.data);
	if(callback) callback(true);
}

Hyperyun.Events.__disconnect = function(access, stipulation, callback){
	try
	{
		if(access.socket)
		{
			Hyperyun.Debug.eddy("unsubscribing actual socket of id = ", access.socket.id);
			Hyperyun.Hyperstore.unsubscribeListener(access.socket?access.socket.id:undefined);
			Hyperyun.Sockets.noteDisconnection(access.socket);
		}
		else Hyperyun.Debug.eddy("unsubscribing some mofo socket, access.loginToken = ",access.loginToken);
		Hyperyun.Application.recordAnalyticsEvent(access);
		if(access && access.coll && access.coll != 'messages') Hyperyun.Analytics.originateMessageEvent(access.app,'messages','disconnect',access.summarize(),function(res,err,ver){Hyperyun.Debug.eddy("originated message!")})
		var selector = {"loginToken.token":access.loginToken}
		var modifier = {$set: {isOnline: false, loginToken: undefined}}
		if(access.loginToken){
			access.db.update(selector, modifier, access.opt, function(err,res){
				if(err)
					Hyperyun.Debug.eddy("Error logging out user on socket "+access.socket.id+": "+err);
				else
					Hyperyun.Debug.eddy("Successfully logged out user on socket "+access.socket.id+(res!=undefined?": "+JSON.stringify(res):""));
				callback({err:err,res:res,info:{version: new Date()}})
			});
			io.of("/"+access.full_coll).emit('getUpdate', {methodAlias:'disconnect',version: new Date(), sel: selector, mod: modifier, options: {}, socketid: access.tsid,timing:access.timings});
		}
	}catch(err){Hyperyun.Utils.togglelog("Bad disconnect. Err: "+err);}
}

Hyperyun.Events.__removeFile = function(access, stipulation, callback){
	gfs.remove({_id:access.file_id},function(error){
		access.db.remove({gridfs_id:new ObjectID(access.file_id)}, function(err, res){
			if(!err){
				io.of("/"+access.full_coll).emit('getRemove', {methodAlias:'removeFile',version:null, sel: {gridfs_id:access.file_id}, socketid: 0, timing:access.timings});
				Hyperyun.Application.recordAnalyticsEvent(access);
				if(access && access.coll && access.coll != 'messages') Hyperyun.Analytics.originateMessageEvent(access.app,'messages','fileRemoved',access.summarize(),function(res,err,ver){Hyperyun.Debug.eddy("originated message!")})
				if(callback) callback({err: err, res: true, info:{version: new Date()}});
			} else {
				if(callback) callback({err: companyCapitalized+": DB error: error while removing from db.", res: null, info:{version: new Date()}});
			}
		});
	});
};

Hyperyun.Events.__uploadFile = function(access, stipulation, callback){
	var mongoid = new ObjectID();
	var filename = mongoid.toHexString()+"."+access.metadata.filetype;
	var writestream = gfs.createWriteStream({filename: filename, content_type: access.metadata.type, metadata: access.metadata});
	access.stream.pipe(writestream);
	writestream.on('close', function (file) {
	  // do something with `file`
	  if(file) {
  		var fileInfo = file.metadata;
		if(!access.user) _.merge({hs_doc:{owner_id:access.user_id}},fileInfo);
	  	fileInfo.gridfs_id = file._id;
	  	fileInfo.filename = file.metadata.name;
	  	fileInfo.link = file._id + "/" + file.metadata.name;
	  	fileInfo.createdAt = new Date();
	  	access.db.insert(fileInfo, function (err, doc){
	  		if(!err) {
	  			io.of("/"+access.full_coll).emit('getInsert', {methodAlias:'uploadFile',version: null, sel: fileInfo, socketid: 0, timing:access.timings}); //ignore  data.socketid
				Hyperyun.Application.recordAnalyticsEvent(access);
				if(access && access.coll && access.coll != 'messages') Hyperyun.Analytics.originateMessageEvent(access.app,'messages','fileUploaded',access.summarize(),function(res,err,ver){Hyperyun.Debug.eddy("originated message!")})
				callback({err: null, res: fileInfo, info:{version: new Date()}});
	  		} else {
			  	if(callback) callback({err: companyCapitalized+": DB error: error while writing to db.", res: null, info:{version: new Date()}});
			}
	  	});
	  } else {
	  	if(callback) callback({err: companyCapitalized+": File Write error: Someting went wrong", res: null, info:{version: new Date()}});
	  }
	});
};
Hyperyun.Events.__unfind = function(access, stipulation, callback){
	var ident = JSON.stringify({sel: access.sel, opt:access.opt});
	if(ident && Hyperyun.Hyperstore.active_queries[ident] && access.socket && access.socket.id)
	{
		Hyperyun.Hyperstore.active_queries[ident].removeSubscriber(access.socket.id);
		if(callback) callback({err:null,res:"Unsubscribed from "+ident,info:{version: new Date()}})
	}
	else if(callback) callback({err:companyCapitalized+": Query not found ("+ident+")", res: null, info:{version: new Date()}})
}
Hyperyun.Events.__find = function(access, stipulation, callback){
	if(_.size(_.uniq(_.values(access.proj))) > 1)
		callback({err:companyCapitalized+": Error: Differentiated projection disallowed in Mongo.", info:{version: access.version}});
	else
	{
		//TODO: introduce 'INVALIDATE' behaviour: currently omits entire records based on bad access
		if(access.reactive)//check for active queries
		{
			Hyperyun.Hyperstore.registerActiveQuery(access);
		}
		if(access.preFindResults)
		{
			callback({name: access.coll, array: access.preFindResults.obeyed?access.preFindResults.obeyed:[],  info : {version: access.version, debug: {stip:access.stipMsg,timing:access.timings}}});
			Hyperyun.Application.recordAnalyticsEvent(access);
			if(access && access.coll && access.coll != 'messages') Hyperyun.Analytics.originateMessageEvent(access.app,'messages','find',access.summarize(),function(res,err,ver){Hyperyun.Debug.eddy("originated message!")})
		}
		else
		{
			callback({name:access.coll,array:[], info : {version:access.version, debug: {stip:"no pre find results available", timing:access.timings}}});
		}
	}
}
Hyperyun.Events._p_find = function(doc,access,callback){
	access.preFindResults.obeyed.push(doc);
	callback(access);
}

Hyperyun.Events.__insert = function(access, stipulation, callback){
	//access.sel = _.defaults(access.sel, {createdAt: new Date(), modifiedAt: new Date(), hs_doc: {createdAt: new Date(), modifiedAt: new Date()}});
	//access.sel = Hyperyun.Access.autoPermissionDocument(access.sel);
	access.timeEvent("mongoOpStart")
	if(access.coll == company+"Logs" || access.coll == company+"Tracking") access.sel.ip = (access.socket.request.headers["x-real-ip"] ? access.socket.request.headers["x-real-ip"] : access.socket.request.connection.remoteAddress);
	Hyperyun.Hyperstore.makeCollection(access.full_coll);
	access.db.insert(access.sel, {safe:true}, function(err, doc){
		access.timeEvent("mongoOpEnd")
		if(!err && doc && _.size(doc)>0)
		{
			Hyperyun.Hyperstore.notifyQueriesOfDatum(doc[0],access);
			access.preFindResults.touched.push(doc[0]._id);
			Hyperyun.Access.broadcastAccess(access,doc[0]);
			Hyperyun.Application.recordAnalyticsEvent(access);
			if(access && access.coll && access.coll != 'messages') Hyperyun.Analytics.originateMessageEvent(access.app,'messages','insert',access.summarize(),function(res,err,ver){Hyperyun.Debug.eddy("originated message!")})
		}
		else
			Hyperyun.Debug.eddy("INSERTION ERROR:",err);
		callback({err: err, res: doc, info:{version: access.version, acc: access, debug: {timing:access.timings}}});
	});
}
//Parallelized portion
Hyperyun.Events._p_insert = function(doc,access,callback){
	callback(access);
}

Hyperyun.Events.__remove = function(access, stipulation, callback){
	if(access.opt.single === true) access.opt.multi = false;
	else if(access.opt.single === false) access.opt.multi = true;
	else {access.opt.single = true; access.opt.multi = false;}

	access.timeEvent("mongoOpEnd")
	if(!access.mongoCheckError)
	{
		try{
		Hyperyun.Access.broadcastAccess(access);
		Hyperyun.Application.recordAnalyticsEvent(access);
		if(access && access.coll && access.coll != 'messages') Hyperyun.Analytics.originateMessageEvent(access.app,'messages','remove',access.summarize(),function(res,err,ver){Hyperyun.Debug.eddy("originated message!")})
		}catch(e){
			console.error("Some error in __remove:",e);
		}
	}
	callback({err: access.mongoCheckError, res: _.size(access.preFindResults.touched), info:{version: access.version, debug: {timing:access.timings}}});
}
//Parallelized portion
Hyperyun.Events._p_remove = function(doc,access,callback){
	if(!access.mongoCheckError && _.isPlainObject(doc))
	{
		var docOpt = _.defaults({single:true, multi:false},access.opt)
		access.db.remove({_id:doc._id}, docOpt,function(err,res){
			if(err)
			{
				console.error("Failure in _p_remove:",err,"(",id,")");
			}
			else{
				Hyperyun.Hyperstore.notifyQueriesOfDatum(doc,access);
				access.preFindResults.touched.push(doc._id)
			}
			callback(access);
		})
	}
	else
		callback(access);
}

Hyperyun.Events.__update = function(access, stipulation, callback){
	access.timeEvent("mongoOpEnd")
	if(!access.mongoCheckError)
	{
		Hyperyun.Access.broadcastAccess(access);
		if(access && access.coll && access.coll != 'messages') Hyperyun.Analytics.originateMessageEvent(access.app,'messages','update',access.summarize(),function(res,err,ver){Hyperyun.Debug.eddy("originated message!")})
		Hyperyun.Application.recordAnalyticsEvent(access);
	}
	callback({err: access.mongoCheckError, res: _.size(access.preFindResults.touched), info:{version: new Date(), debug: {timing:access.timings}}});
}
//Parallelized portion
Hyperyun.Events._p_update = function(doc,access,callback){
	if(access.mod == {}){
		access.mongoCheckError = {
			errMsg : "Censored modifier returns a blank modifier. HS_DOC not allowed to be altered via update by clients",
			stipMsg : access.data.mod
		}
	}
	if(!access.mongoCheckError && _.isPlainObject(doc))
	{
		if(access.opt.upsert && _.size(access.preFindResults.touched) == 0)
		{
			Hyperyun.Debug.eddy("_p_updating A")
			access.db.update(access.sel,access.mod,access.opt,function(err,res){
				if(err) console.error("Failure in upsert",err);
				else Hyperyun.Hyperstore.notifyQueriesOfDatum(doc,access);

				callback(access);
			})
		}
		else
		{
			Hyperyun.Debug.eddy("_p_updating B",doc)
			var docSel = _.defaults({_id:doc._id},access.sel)
			var docOpt = _.defaults({multi:false, single:true},access.opt)
			access.db.update(docSel,access.mod, docOpt,function(err,res){
				if(err)
				{
					access.errMsg = err;
					console.error("Failure in p_update:",err,"(",doc._id,")");
				}			
				else Hyperyun.Hyperstore.notifyQueriesOfDatum(doc,access);

				callback(access);
			})
		}
	}
	else callback(access);
}
Hyperyun.Events.__chownWhere = function(access, stipulation, callback){

}
Hyperyun.Events._p_chownWhere = function(doc,access,callback){

}

Hyperyun.Events.__chmodWhere = function(access, stipulation, callback){
	access.timeEvent("mongoOpEnd")
	if(!access.mongoCheckError)
	{
		access.opt.applicant = access.user_id;
		Hyperyun.Access.broadcastAccess(access);
		Hyperyun.Application.recordAnalyticsEvent(access);
		if(access && access.coll && access.coll != 'messages') Hyperyun.Analytics.originateMessageEvent(access.app,'messages','chmod',access.summarize(),function(res,err,ver){Hyperyun.Debug.eddy("originated message!")})
	}
	callback({err: access.mongoCheckError, res: _.size(access.preFindResults.touched), info:{version: new Date(), debug: {timing:access.timings}}});		
}
Hyperyun.Events._p_chmodWhere = function(doc,access,callback){
	//Sanitize
	var code = permissionCode.fromString(access.opt.permissionString)
	access.opt.code = code;
	var matcher = access.opt.recursiveSelector?new mongoMatcher(access.opt.recursiveSelector):new mongoMatcher(access.sel);
	var omitFieldToSet = access.opt.omitFieldToSet?access.opt.omitFieldToSet:undefined
	if(!_.isString(access.opt.permissionString) || !_.isObject(access.sel)) {
		access.mongoCheckError = {
			errMsg:!_.isObject(access.sel)?"Top-level Selector required for chmodWhere, but selector not specified. Received "+access.sel:"Permission string to chmod not specified as a string",
			stipMsg:access.sel
		}
		callback(access);
		return undefined;
	}
	//Accumulate chmod alterations
	var modifier = {$set:{}}
	function perDoc(level,path){
		if(path == undefined) path = ""
		Hyperyun.Debug.eddy("discerning",level);
		if(matcher.discern(level)){
			Hyperyun.Debug.eddy('matched: hsdoc is',level.hs_doc)
			if(!level.hs_doc)
				return; //no permissions existant? TODO: instantiate new
			var setPath = path+(path==""?"":".")+"hs_doc.";
			setPath += (access.opt.omitFieldToSet && _.isString(omitFieldToSet) && access.opt.omitFieldToSet != "" && access.opt.omitFieldToSet[0] != ".")?
				"omits."+access.opt.omitFieldToSet : "permissions"
			modifier["$set"][setPath] = code
		} else {
			Hyperyun.Debug.eddy("didn't match", matcher.seed,matcher.evaluator)
		}
	}
	if(access.opt.recursiveSelector)
	{
		Hyperyun.Utils.recurseApply(doc, perDoc);
	}
	else //This is only toplevel chmod, so no need to run mongomatcher discernment - we've already matched
	{
		//perDoc(doc)
		Hyperyun.Debug.eddy('matched: hsdoc is',doc.hs_doc,access.user_id)
		if(!doc.hs_doc || (doc.hs_doc && !doc.hs_doc.owner_id))
			Hyperyun.Debug.eddy('no permissions extant');//return; //no permissions existant?
		else
		{
			var setPath = "hs_doc.";
			setPath += (access.opt.omitFieldToSet && _.isString(omitFieldToSet) && access.opt.omitFieldToSet != "" && access.opt.omitFieldToSet[0] != ".")?
				"omits."+access.opt.omitFieldToSet : "permissions"
			modifier["$set"][setPath] = code
		}
	}
	//Modifier is accumulated: apply it
	if(!_.isEqual(modifier["$set"],{}))
		Hyperyun.Hyperstore.collections[access.full_coll].db.update({_id:doc._id},modifier,function(err,res){callback(access)})
	else
		callback(access);
}
Hyperyun.Events._queryAppOwnerTargets = function(data, callback){
	//Bail if no data provided
	if(!data){callback({res:undefined, err:"No Data", info:{version: new Date()}}); return;}
	if(!data.presented_id){callback({res:undefined, err:"No Identification presented", info:{version: new Date()}}); return;}

	var identifier = data.presented_id.identifier
	Hyperyun.Hyperstore.makeCollection(companyApp+dlim+"appOwners");
	Hyperyun.Hyperstore.collections[companyApp+dlim+"appOwners"].db.findOne({$or:[{email:identifier},{screen_name:identifier}]},function(err,match){
		if(!err && match)
		{
			//each match has `email`,`screen_name`,and (importantly) an array of `apps` names
			if(!match.apps){callback({res:false,err:"No matches",info:{version: new Date()}});return;}
			//For each app, see if our credentials could log in as an appOwner
			async.map(match.apps, function(app,next){
				Hyperyun.Hyperstore.makeCollection(app+dlim+company+"Admins");
				Hyperyun.Hyperstore.collections[app+dlim+company+"Admins"].db.find({$or:[{emails:{$in:[identifier]}},{username:identifier}]}).toArray(function(err,docs){
					if(err || !docs){next(false);return;}
					//if we match any of the appOwners of this app, we're good
					async.some(docs,function(doc,next_b){
						bcrypt.compare(data.presented_id.password, doc.password, function(err, response) {
							if(err) Hyperyun.Debug.eddy("BCRYPT ERR 3882",err)
							next_b(err?false:(response?true:false))
						});
					},
					function(matched){
						next(false, matched);
					})
				})
			},function(err, results){
				//after all checked, return app name array of apps we can log in as appOwner of
				callback({
					res: _.filter(match.apps, function(v,k){
						return results && results[k]
					}),
					err: err,
					info:{
						version: new Date()}
				});
			})
		} else if(callback) callback({res:false,err:err,info:{version:new Date()}})
	})
}

//   █████╗  ██████╗ ██████╗ ██████╗ ██╗   ██╗███╗   ██╗████████╗███████╗
//  ██╔══██╗██╔════╝██╔════╝██╔═══██╗██║   ██║████╗  ██║╚══██╔══╝██╔════╝
//  ███████║██║     ██║     ██║   ██║██║   ██║██╔██╗ ██║   ██║   ███████╗
//  ██╔══██║██║     ██║     ██║   ██║██║   ██║██║╚██╗██║   ██║   ╚════██║
//  ██║  ██║╚██████╗╚██████╗╚██████╔╝╚██████╔╝██║ ╚████║   ██║   ███████║
//  ╚═╝  ╚═╝ ╚═════╝ ╚═════╝ ╚═════╝  ╚═════╝ ╚═╝  ╚═══╝   ╚═╝   ╚══════╝
//
Hyperyun.Accounts = {};
Hyperyun.Accounts.createOrUpdateAccount = function(method, data, callback, asAdmin) {
	var collection = data.appName+dlim+"users";
	Hyperyun.Hyperstore.makeCollection(collection);
	if(data.user.email) var q = {emails: {$in: [data.user.email]}};
	else if(data.user.username) var q = {username: data.user.username};
	else if(data.user.login) var q = {username: data.user.login};
	else if(data.user.screen_name) var q = {username: data.user.screen_name};
	else {
		callback({err: "No email or user passed", res: null, info:{version: new Date()}});
		return false;
	}
	Hyperyun.Hyperstore.collections[collection].db.findOne(q, function(err, doc){
		if(!err && doc) {
			Hyperyun.Accounts.updateAccount(method, data.user, data.access_token, data.appName, doc, function(cb) {
				callback(cb);
			});
		} else {
			Hyperyun.Accounts.createAccount(method, data.user, data.access_token, data.appName, asAdmin, function(cb) {
				callback(cb);
			});
		}
	});
}

Hyperyun.Accounts.createAccount = function(method, data, atoken, appName, asAdmin, callback, access) {
	Hyperyun.Utils.togglelog('Creating new account');
	var collection = asAdmin?appName+dlim+company+"Admins":appName+dlim+"users";
	Hyperyun.Hyperstore.makeCollection(collection);
	var error = false;
	if(method=='password' && !data.password) error = companyCapitalized+": Error: Password missing.";

	if(data.login) data.username = data.login;
	else if(data.screen_name) data.username = data.screen_name;
	if(data.email && data.username) var q = {$or: [ {emails: {$in: [data.email]} }, {username: data.username} ] };
	else if(data.email) var q = {emails: {$in: [data.email]}};
	else if(data.username) var q = {username: data.username};
	else error = companyCapitalized+": Error: You have to input username or email.";
	Hyperyun.Hyperstore.collections[collection].db.findOne(q, function(err, doc){
		if(doc) error = companyCapitalized+": Error: Account exists."
		if(!error) {
			var loginToken = null;
			var pass = null;
			var services = new Object();
			var newUserData =
				{
					hs_doc : {
						createdAt: new Date(),
						modifiedAt: new Date()
					},
					username : (data.username ? data.username : null),
					emails : (data.email ? [data.email] : null),
					createdAt : new Date(),
					profile : (data.profile ? data.profile : null),
					services : services,
					status : status,
					loginToken : loginToken,
					modifiedAt : new Date(),
					role : "Member"
				}
			if(method!='password') {
				var tosalt = bcrypt.genSaltSync(10);
				var exdays = 6;
				var enddate=new Date();
				enddate.setDate(enddate.getDate() + exdays);
				var pdata = data.email || data.username;
				var token = bcrypt.hashSync(pdata, tosalt);
				loginToken = {token: token, expires: enddate};
				services[method] = {access_token: atoken};
				var status = 1;
				if(data.id) services[method].id = data.id;
			} else {
				if(asAdmin) {
					newUserData.password = data.password;
				} else {
					var salt = bcrypt.genSaltSync(10);
					newUserData.password = bcrypt.hashSync(data.password, salt);
					newUserData.activate = new ObjectID().toHexString();
					var status = 0;
				}
			}
			Hyperyun.Application.recordAnalyticsEvent(data);
			//Get application settings to see if activation mandated
			Hyperyun.Hyperstore.makeCollection(appName+dlim+company+"Configuration")
			Hyperyun.Hyperstore.collections[appName+dlim+company+"Configuration"].db.findOne({url:appName}, function(err,app){
				if(!err && app)
				{
					var strat = "";
					if(app.settings)
						strat = app.settings.activationStrategy;
					if(strat == 'no')
					{
						newUserData.activate = 1;
						newUserData.status = 1;
						Hyperyun.Hyperstore.collections[collection].db.insert(newUserData, {safe: true}, function(err, doc){
							if(doc && _.size(doc)==1)
								doc = doc[0];
							var oID = doc._id
							Hyperyun.Hyperstore.collections[collection].db.update({_id:doc._id},{$set:{hs_doc:{createdAt:new Date(),modifiedAt:new Date(),owner_id:oID}}},function(err,res){
								doc.hs_doc = {createdAt:new Date(),modifiedAt:new Date(),owner_id:doc._id}
								delete doc.password;
								if(!err)
								{
									io.of("/"+collection).emit('getInsert', {methodAlias:'accountCreated',version: Hyperyun.Hyperstore.collections[collection].version, sel: doc, socketid: 0});
									if(access && access.coll && access.coll != 'messages') Hyperyun.Analytics.originateMessageEvent(access.app,'messages','accountCreated',access.summarize(),function(res,err,ver){Hyperyun.Debug.eddy("originated message!")})
								}
								callback({err: err, res: doc, info:{version: Hyperyun.Hyperstore.collections[collection].version}});
							})
						});
					}
					else if(strat == 'admin-only')//Don't do e-mail activation, admin-only manual approval
					{
						Hyperyun.Hyperstore.collections[collection].db.insert(newUserData, {safe: true}, function(err, doc){
							if(doc && _.size(doc)==1)
								doc = doc[0];
							Hyperyun.Hyperstore.collections[collection].db.update({_id:doc._id},{$set:{hs_doc:{createdAt:new Date(),modifiedAt:new Date(),owner_id:new ObjectID(doc._id).toHexString()}}},function(err,res){
								doc.hs_doc = {createdAt:new Date(),modifiedAt:new Date(),owner_id:doc._id}
								delete doc.password;
								if(!err)
									io.of("/"+collection).emit('getInsert', {methodAlias:'accountCreated',version: Hyperyun.Hyperstore.collections[collection].version, sel: doc, socketid: 0});
								Hyperyun.Utils.togglelog({err: err, res: doc, ver: Hyperyun.Hyperstore.collections[collection].version});
								callback({err: err, res: doc, info:{version: Hyperyun.Hyperstore.collections[collection].version}});
							});
						});
					}
					else//assume e-mail activation
					{
						Hyperyun.Hyperstore.collections[collection].db.insert(newUserData, {safe: true}, function(err, doc){
							if(doc && _.size(doc)==1)
								doc = doc[0];
							Hyperyun.Hyperstore.collections[collection].db.update({_id:doc._id},{$set:{hs_doc:{createdAt:new Date(),modifiedAt:new Date(),owner_id:doc._id}}},function(err,res){
								doc.hs_doc = {createdAt:new Date(),modifiedAt:new Date(),owner_id:doc._id}
								delete doc.password;
								if(!err)
									io.of("/"+collection).emit('getInsert', {methodAlias:'accountCreated',version: Hyperyun.Hyperstore.collections[collection].version, sel: doc, socketid: 0});
								Hyperyun.Utils.togglelog({err: err, res: doc, ver: Hyperyun.Hyperstore.collections[collection].version});
								if(newUserData.emails && newUserData.emails.length>0 && !err)
									if(asAdmin) {
										if(callback) callback({err: err, res: doc, info:{version: Hyperyun.Hyperstore.collections[collection].version}});
									} else {
										Hyperyun.Mailer.sendMail(appName, "Registration", newUserData, access?access.socket:undefined, function(e, res) {
											if(callback) callback({err: e, res: doc, info:{version: Hyperyun.Hyperstore.collections[collection].version}});
										}, false);
									}
								else
									callback({err: err, res: doc, info:{version: Hyperyun.Hyperstore.collections[collection].version}});
							});
						});
					}
				} else if (callback){
					if(!app) console.log("configuration collection did not exist for",appName)
					callback({err: err, res: app, info:{version:new Date()}});
				}
			});
		} else {
			callback({err: error, res: null, info:{version: Hyperyun.Hyperstore.collections[collection].version}});
		}
	});
}

Hyperyun.Accounts.updateAccount = function(method, data, atoken, appName, user, callback) {
	var error = false;
	var collection = appName+dlim+"users";
	Hyperyun.Hyperstore.makeCollection(collection);
	if(!error) {
		if(user.emails) {
			var q = {emails: {$in: [user.emails[0]]}};
			var pdata = user.emails[0];
		} else if(user.username) {
			var q = {username: user.username};
			var pdata = user.username;
		} else {
			callback({err: "no username or email", res: null, info:{version: new Date()}});
			return false;
		}

		var tosalt = bcrypt.genSaltSync(10);
		var exdays = 6;
		var enddate=new Date();
		enddate.setDate(enddate.getDate() + exdays);
		var token = bcrypt.hashSync(pdata, tosalt);
		var loginToken = {token: token, expires: enddate};
		if(user.services) var services = user.services;
		else var services = {};
		services[method] = {access_token: atoken, id: data.id};

		Hyperyun.Hyperstore.collections[collection].db.findAndModify(q, [['_id','asc']], {$set: {loginToken: loginToken, services: services}}, {}, function(err, doc){
			callback({err: err, token: loginToken, res: loginToken, info:{version: Hyperyun.Hyperstore.collections[collection].version}});
		});
	} else {
		callback({err: error, res: null, info:{version: Hyperyun.Hyperstore.collections[collection].version}});
	}
}

Hyperyun.Accounts.forgotPassword = function(appName, code, callback) {
	var collection = appName+dlim+company+"Configuration";
	Hyperyun.Hyperstore.makeCollection(collection);
	Hyperyun.Hyperstore.collections[collection].db.findOne({url: appName}, function(err, app) {
		if(!err && app) {
			var ucollection = appName+dlim+"users";
			Hyperyun.Hyperstore.makeCollection(ucollection);
			//TODO: lolwat, be better
			if(code.length>2) {
				Hyperyun.Hyperstore.collections[ucollection].db.findOne({forgotPassword: code}, {}, function(err, user) {
					Hyperyun.Utils.togglelog({err: err, usr: user});
					if(!err && user) callback(true)
					else callback(false);
				});
			}
		}
		else callback(false);
	});
}


Hyperyun.Accounts.activateAccount = function(appName, code, callback, access) {
	var collection = appName+dlim+company+"Configuration";
	Hyperyun.Hyperstore.makeCollection(collection);
	Hyperyun.Hyperstore.collections[collection].db.findOne({url: appName}, function(err, app) {
		if(!err && app) {
			var ucollection = appName+dlim+"users";
			Hyperyun.Hyperstore.makeCollection(ucollection);
			if(true || code.length>2) {
				Hyperyun.Hyperstore.collections[ucollection].db.findAndModify({activate: code}, [['_id','asc']], {$set: {activate:1, status: 1}}, {}, function(err, user){
					Hyperyun.Utils.togglelog({activate: code, user: user, ucollection: ucollection});
					if(!err && user) {
						Hyperyun.Mailer.sendMail(appName, "Activation", user, access?access.socket:undefined, function(e, res) {
							if(!app.redirect) callback({url:'/',err:false});
							else callback({url:app.redirect, err:false});
						});
					}
					else
					{
						ucollection = appName+dlim+company+"Admins";
						Hyperyun.Hyperstore.makeCollection(ucollection);
						Hyperyun.Hyperstore.collections[ucollection].db.findAndModify({activate: code}, [['_id','asc']], {$set: {activate:1, status: 1}}, {}, function(err, user){
							Hyperyun.Utils.togglelog({activate: code, user: user, ucollection: ucollection});
							if(!err && user) {
								Hyperyun.Mailer.sendMail(appName, "Activation", user, access?access.socket:undefined, function(e, res) {
									if(!app.redirect) callback({url:'/',err:false});
									else callback({url:app.redirect, err:false});
								});
							}
							else callback({url:false, err:err?err:"User not found"});
						});
					}
				});
			}
		}
		else callback({url:false,err:err?err:"Application not found"});
	});
}

/***
 *     █████╗ ██████╗ ██████╗ ██╗     ██╗ ██████╗ █████╗ ████████╗██╗ ██████╗ ███╗   ██╗
 *    ██╔══██╗██╔══██╗██╔══██╗██║     ██║██╔════╝██╔══██╗╚══██╔══╝██║██╔═══██╗████╗  ██║
 *    ███████║██████╔╝██████╔╝██║     ██║██║     ███████║   ██║   ██║██║   ██║██╔██╗ ██║
 *    ██╔══██║██╔═══╝ ██╔═══╝ ██║     ██║██║     ██╔══██║   ██║   ██║██║   ██║██║╚██╗██║
 *    ██║  ██║██║     ██║     ███████╗██║╚██████╗██║  ██║   ██║   ██║╚██████╔╝██║ ╚████║
 *    ╚═╝  ╚═╝╚═╝     ╚═╝     ╚══════╝╚═╝ ╚═════╝╚═╝  ╚═╝   ╚═╝   ╚═╝ ╚═════╝ ╚═╝  ╚═══╝
 *
 */
Hyperyun.Application = {};

Hyperyun.Application.generateAPIKey = function(appname, callback){
	var apiObject = {
		key: Hyperyun.Utils.generateUID(),
		_id: new ObjectID(),
		role: "Admin"
	}
	Hyperyun.Hyperstore.collections[appName+dlim+company+"Configuration"].db.update({url: appname},{$set:{api:apiObject}},{},function(err, doc){
		Hyperyun.Utils.togglelog("Generated API key ("+apiObject.key+") for "+appname,"generateAPIkey");
		io.of("/"+appname+dlim+company+"Configuration").emit('getUpdate',
			{version: Hyperyun.Hyperstore.collections[appName+dlim+company+"Configuration"].version, sel: {url: appname}, mod: {$set: {api:apiObject}}, options: {}, socketid: 0});

		if(callback) callback({err: err, res:apiObject, info:{version: new Date()}});
	});
}

Hyperyun.Application.recordAnalyticsEvent = function(access)//sid, appName, eventName, timestamp, data)
{
	// Change what the function does
	//TODO: return later on. Abandoned for the second because of $ fields in the access, and can't be assed to fix it just this second;
	if(!access || !access.app)return;

	Hyperyun.Hyperstore.makeCollection(access.app+dlim+company+"Analytics");
	var size = JSON.stringify(access.data).length*16;
	var payload = {
		event: access.event,
		raw: access.data,
		size: size
	}
	Hyperyun.Hyperstore.collections[access.app+dlim+company+"Analytics"].db.insert(payload,function(){

	})
}

/***
 *     █████╗ ███╗   ██╗ █████╗ ██╗  ██╗   ██╗████████╗██╗ ██████╗███████╗
 *    ██╔══██╗████╗  ██║██╔══██╗██║  ╚██╗ ██╔╝╚══██╔══╝██║██╔════╝██╔════╝
 *    ███████║██╔██╗ ██║███████║██║   ╚████╔╝    ██║   ██║██║     ███████╗
 *    ██╔══██║██║╚██╗██║██╔══██║██║    ╚██╔╝     ██║   ██║██║     ╚════██║
 *    ██║  ██║██║ ╚████║██║  ██║███████╗██║      ██║   ██║╚██████╗███████║
 *    ╚═╝  ╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝╚══════╝╚═╝      ╚═╝   ╚═╝ ╚═════╝╚══════╝
 *
 */
Hyperyun.Analytics = {};
Hyperyun.Analytics.mailSent = function(appName, info) {
	Hyperyun.Hyperstore.makeCollection(appName+dlim+company+"Mails");
	info.createdAt = new Date();
	Hyperyun.Hyperstore.collections[appName+dlim+company+"Mails"].db.insert(info);
}
Hyperyun.Analytics.originateMessageEvent = function(app, collection, event, payload, callback){
	var data = {
		appName : app,
		collection : collection,
		event : event,
		sel: payload
	}
	//console.log("originating a ",event,"event on collection",collection,"from",payload.coll,"for application",app);
	Hyperyun.Access.processAccess("insert", undefined, data, undefined, Hyperyun.Events.__insert, Hyperyun.Events._p_insert, callback, {isExternal:false})
}

//   ██████╗ ██████╗ ███╗   ██╗███████╗████████╗ █████╗ ███╗   ██╗████████╗███████╗
//  ██╔════╝██╔═══██╗████╗  ██║██╔════╝╚══██╔══╝██╔══██╗████╗  ██║╚══██╔══╝██╔════╝
//  ██║     ██║   ██║██╔██╗ ██║███████╗   ██║   ███████║██╔██╗ ██║   ██║   ███████╗
//  ██║     ██║   ██║██║╚██╗██║╚════██║   ██║   ██╔══██║██║╚██╗██║   ██║   ╚════██║
//  ╚██████╗╚██████╔╝██║ ╚████║███████║   ██║   ██║  ██║██║ ╚████║   ██║   ███████║
//   ╚═════╝ ╚═════╝ ╚═╝  ╚═══╝╚══════╝   ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═══╝   ╚═╝   ╚══════╝
//
//emails, passwords, forgotcode, activation code, user role, logintoken
Hyperyun.Application.generateNewAppJson = function(name, url, user, callback) {
var json = {
	/*
		hs_doc : {
			createdAt: new Date(),
			modifiedAt: new Date(),
			owner_id: user._id.toString()
		},*/
		name: name,
		url: url,
		collections: [
			{
				name: "users",
				security: {
					protectedFields:{
						profile: {
							public: {read:1,write:0,edit:0,delete:0},
							member: {read:1,write:1,edit:2,delete:1},
							admin: {read:1,write:1,edit:1,delete:1}
						},
						activate: {
							public: {read:0,write:0,edit:0,delete:0},
							member: {read:2,write:0,edit:0,delete:0},
							admin: {read:1,write:1,edit:1,delete:1}}
						},
					public: {read:0,write:0,edit:0,delete:0},
					member: {read:2,write:1,edit:0,delete:0},
					admin: {read:1,write:1,edit:1,delete:1}
				}
			}],
		security: {
			public: {write: 1,read: 1,edit: 0,delete: 0},
			member: {write: 1,read: 1,edit: 2,delete: 2},
			admin: {write: 1,read: 1,edit: 1,delete: 1}
		},
		services:{
			github:{
				public:""
			}
		},
		settings: {
			reconnects:[],
			disconnectModificationStrategy:{}
		},
		analytics: {
			brandwidth_total: 0,
			brandwidth: 0,
			storage: 0
		},
		emails: {
			'Registration': {
				'Text': "Hi,\n\
\n\
Thanks for creating an account with "+name+". Click below to confirm your email address:\n\
{{activationLink}}\n\
\n\
If you have problems, please paste the above URL into your web browser. \n\
\n\
Thanks,\n\
"+name+" Team",
				'HTML': "Hi,<br>\n\
<br>\n\
Thanks for creating an account with "+name+". Click below to confirm your email address:<br>\n\
<a href='{{activationLink}}'>{{activationLink}}</a> <br>\n\
<br>\n\
If you have problems, please paste the above URL into your web browser. <br>\n\
<br>\n\
Thanks,<br>\n\
"+name+" Team",
				'send': true,
				'title': "Registration to "+name,
				'from': name
			},
			'Activation': {
				'Text': "Hi,\n\
\n\
Thank you for confirming your email. We hope you'll enjoy "+name+".\n\
\n\
Thanks,\n\
"+name+" Team",
				'HTML': "Hi,<br>\n\
<br>\n\
Thank you for confirming your email. We hope you'll enjoy "+name+".<br>\n\
<br>\n\
Thanks,<br>\n\
"+name+" Team",
				'send': true,
				'title': "Welcome to "+name,
				'from': name
			},
			'Password Recovery': {
				'Text': "If you made this request, and you need your password reset, please go to the following URL to confirm your request and change the password to the new one:\n\
\n\
{{forgotPasswordLink}}\n\
\n\
Note: this URL can only be used to change your password once.\n\
\n\
Please disregard this message if you did not request this change. Your password will not be changed.\n\
\n\
Thanks,\n\
"+name+" Team",
				'HTML': "If you made this request, and you need your password reset, please go to the following URL to confirm your request and change the password to the new one:<br>\n\
<br>\n\
<a href='{{forgotPasswordLink}}'>{{forgotPasswordLink}}</a> <br>\n\
<br>\n\
Note: this URL can only be used to change your password once.<br>\n\
<br>\n\
Please disregard this message if you did not request this change. Your password will not be changed.<br>\n\
<br>\n\
Thanks,<br>\n\
"+name+" Team",
				'send': true,
				'title': "Password Recovery for "+name,
				'from': name
			}
		},
		services: {},
		settings: {
			redirect: "/"
		},
		createdAt: new Date(),
		modifiedAt: new Date()
	}
	callback(json);
	return json;
}

Hyperyun.constants = {
	eventCollectionMap : {
		'uploadFile' : 'files',
		'removeFile' : 'files',
		'cancelUpload' : 'files',
		'createApp' : 'applications',
		'getOAuthSettings' : 'applications',
		'scheduleDeletionOfApplication' : 'applications',
		'unscheduleDeletionOfApplication' : 'applications',
		'generateAPIKey' : 'applications',
		'loggedIn' : 'users',
		'logout' : 'users',
		'disconnect' : 'users',
		'passwordLogin' : 'users',
		'changePassword' : 'users',
		'forgotPassword' : 'users'
	},
	executive_events : [
		//Events requiring app-level executive authority (particularly sensitive app-wide changes)
		'scheduleDeletionOfApplication','unscheduleDeletionOfApplication','generateAPIKey','chmod','chown'
	],
	query_events : [
		//Events requiring mongo document parsing and field-level permissions
		'find','insert','remove','update','removeFile','chmod','chown'
	],
	general_events : [
		//Events requiring app-level security check (catchall for stuff that isn't a proper query or executive action)
		'analyticsEvent','createCollection','logout', 'passwordSignUp',
		'passwordLogin','loggedIn','changePassword', 'forgotPassword',
		'activate','createApp','getOAuthSettings','afterOAuth','disconnect',
		'uploadFile','cancelUpload'
	],
	defaultSecurity : {
	//Security settings that will be used if none more specific are found
		public:{read: 1,write: 1,edit: 0,delete: 0,strategy: 'invalidate'},
		member:{read: 1,write: 1,edit: 2,delete: 2,strategy: 'omit',
			'removeFile': 2},
		admin:{read: 1,write: 1,edit: 1,delete: 1,strategy: 'omit',
			'scheduleDeletionOfApplication' : 1,
			'unscheduleDeletionOfApplication' : 1,
			'generateAPIKey' : 1,
			'removeFile': 1},
		all:{strategy: 'invalidate',
			'analyticsEvent': 1,
			'createCollection': 1,
			'logout': 1,
			'passwordSignUp': 1,
			'passwordLogin': 1,
			'loggedIn': 1,
			'changePassword': 1,
			'forgotPassword': 1,
			'activate': 1,
			'createApp': 1,
			'getOAuthSettings': 1,
			'afterOAuth': 1,
			'disconnect': 1,
			'find': 1,
			'insert': 1,
			'remove': 1,
			'update': 1,
			'uploadFile': 1,
			'cancelUpload': 1,
			'no-op' : 1,
			'chmod' : 1,
			'chown' : 1}
	},
	//Hard-coded security schema for certain tables
	applications_hardcoded_security : {
	//Security settings that should override anything specified on the companyApp+"_applications" table
		protectedFields:{

		},
		public:{

		},
		member:{

		},
		admin:{

		}
	},
	legacy_data_default_permissions : ['read','update','delete','remove'],
	emitEvents : {update:"getUpdate",insert:"getInsert",remove:"getRemove",chmod:"getChmod",chown:"getChown"},
	restEvents : {read:"find",write:"insert",delete:"remove",edit:"update"},
	companyColls : [company+"Admins",company+"Collections",company+"Configuration",company+"Emails",company+"Tracking",company+"Logs",company+"Connections"]
}

//  ██╗   ██╗████████╗██╗██╗     ███████╗
//  ██║   ██║╚══██╔══╝██║██║     ██╔════╝
//  ██║   ██║   ██║   ██║██║     ███████╗
//  ██║   ██║   ██║   ██║██║     ╚════██║
//  ╚██████╔╝   ██║   ██║███████╗███████║
//   ╚═════╝    ╚═╝   ╚═╝╚══════╝╚══════╝
//
Hyperyun.Utils = {};
Hyperyun.Utils.toggleLogExclusionSet = ['security','update','delete','securityMinutiae','hash',"oauth2","megaDebug",'permission','monetization','permissions',"applicationStatistics","generateAPIkey","password",'appDeletion'];
Hyperyun.Utils.togglelog = function(object,subset)
{
	return;
  if(!subset) return true;//subset = '';
  if(_.contains(Hyperyun.Utils.toggleLogExclusionSet, subset))
    return true;
  Hyperyun.Debug.eddy(object);
  return true;
}
Hyperyun.Utils.nanosecondCompare = function(t0,t1){
	return (t1[0]-t0[0])*1000000000 + (t1[1]-t0[1])
}
Hyperyun.Utils.generateUID = function()
{
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);return v.toString(16);});
}
Hyperyun.Utils.reviver = function(ancestor, value) {
	//@ancestor is the last non-mongo-operator in object tree above this element
	//Date revivication
    var a;
    if (typeof value === 'string') {
        a = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}(?:\.\d*)?)Z$/.exec(value);//isdate
        b = /^[0-9a-fA-F]{24}$/.exec(value);//is objectID
        if (a) {
        	return new Date(Date.parse(value));
            //return new Date(Date.UTC(+a[1], +a[2] - 1, +a[3], +a[4],+a[5], +a[6]));
        }
        else if(b && ancestor == "_id")
        {
        	return new ObjectID(value);
        }
    }
    return value;
};
Hyperyun.Utils.reviveJSON = function(obj,ancestor,depth)
{
	if(!depth) depth = 1;
	if(depth > 1000)//Breakout from too-deep jsons
		return obj;
	if(obj instanceof Object || typeof obj === 'object')
	{
		var keys = _.keys(obj);
		for(var i = 0; i < _.size(keys); i++)
		{
			var key = keys[i];
			var mostRecentLiteralAncestor = (Hyperyun.Utils.isMongoOperator(key) || obj instanceof Array || typeof obj==='array')?ancestor:key;
			obj[key] = Hyperyun.Utils.reviveJSON(obj[key], mostRecentLiteralAncestor,depth+1);
		}
		return obj;
	}
	else
		return Hyperyun.Utils.reviver(ancestor,obj);
}
Hyperyun.Utils.isJson = function(str) {
    try {
        JSON.parse(str);
    } catch (e) {
    	console.error("Unable to parse '"+str+"': ",e);
        return false;
    }
    return true;
}
Hyperyun.Utils.isMongoOperator = function(key){
	return _.contains(["$inc","$rename","$setOnInsert","$set","$unset","$in",
		"$gt","$gte","$lt","$lte","$ne","$nin","$mul","$min","$max","$currentDate",
		"$","$addToSet","$pop","$pullAll","$pull","$push","$pushAll",
		"$each","$slice","$sort","$position","$bit","$isolated"],key);
}
Hyperyun.Utils.stringEndsWith = function(str,suffix)
{
	return str.indexOf(suffix, str.length - suffix.length) !== -1;
}

Hyperyun.Utils.hasPath = function(obj, key) {
	if(!obj) return false;
		var idx = key.indexOf(".");
	  if (idx === -1) {
	      return _.has(obj, key);
	  }
	  var thisKey = key.substring(0,idx);
	  var keys = key.substring(idx+1);
	  if(_.has(obj,thisKey))
	    return Hyperyun.Utils.hasPath(obj[thisKey],keys)
	  else
	    return false
}
Hyperyun.Utils.recurseApply = function(obj, fnEachLevel, path){
	if(!_.isString(path)) path = ""
	if(_.isPlainObject(obj) || _.isArray(obj))
		_.forEach(obj,function(e,k){
				Hyperyun.Utils.recurseApply(e, fnEachLevel,path+(path==""?"":".")+k)
		})
	obj = fnEachLevel(obj,path);
	return obj
}

//  ███████╗ ██████╗ ██████╗ 
//  ██╔════╝██╔═══██╗██╔══██╗
//  █████╗  ██║   ██║██████╔╝
//  ██╔══╝  ██║▄▄ ██║██╔═══╝ 
//  ██║     ╚██████╔╝██║     
//  ╚═╝      ╚══▀▀═╝ ╚═╝     
//  Field query paths
Hyperyun.Access.flattenQueryIntoQueryPaths = function(query, path, excludeMongo){
	var result = [];
	if(!path) path = "";
	if(_.isObject(query) && !_.isFunction(query))
		//Create array of keys-as-QueryPaths
		return _.compact(_.flatten(_.map(query, function(v,k){
			var newPath = excludeMongo && Hyperyun.Utils.isMongoOperator(k)?path:path + (path==""?"":".") + k;
			var element = excludeMongo && Hyperyun.Utils.isMongoOperator(k)?undefined:
			{
				path: new Hyperyun.Access.QueryPath(newPath),
				value: v,
				//qDoc: v._doc && !v._doc.auto?v._doc:undefined,
				oType: _.isArray(query)?'Array':'Object'
			}
			return [element, Hyperyun.Access.flattenQueryIntoQueryPaths(v,newPath)];
		})))
	else return result//Default, literal case: we are a 'value', not a 'key', so return empty array to merge
}
Hyperyun.Access.QueryPath = function(string, source){
	var arrPath = string.split(".");
	var excPath = _.reject(arrPath, function(ele){return Hyperyun.Utils.isMongoOperator(ele)});
	var self = this;
	self.dotPath = string,
	self.objDotPath = _.reduce(excPath,function(memo,ele){return memo+"."+ele}),
	self.queryPath = arrPath,
	self.objectPath = excPath,
	self.queryDepth = _.size(arrPath),
	self.objectDepth = _.size(excPath)
}
Hyperyun.Access.QueryPath.prototype.queryObject = function(object){
	var self = this;
	var target = object;
	for(var i = 0; i < self.objectDepth; i ++)
	{
		if(target[self.objectPath[i]])
			target = target[this.objectPath[i]]
		else
			return undefined;
	}
	return target;
}
Hyperyun.Access.QueryPath.prototype.finalField = function(){
	var self = this;
	return _.last(self.objectPath);
}
Hyperyun.Access.QueryPath.prototype.subPath = function(depth){
	var self = this;
	return _.reduce(_.first(self.objectPath,depth+1),function(memo,ele){return memo + "." + ele});
}
Hyperyun.Access.QueryPath.prototype.associatedHS_Doc = function(object){
	if(!object) return undefined;
	var self = this;
	var parent = object;
	var target = object;
	for(var i = 0; i < self.objectDepth-1; i++)
	{
		//BHSDocs don't have hs_docs, but have an implicit one;
		if(self.objectPath[i] == "hs_doc" && target[self.objectPath[i]])
		{
		}
		if(target[self.objectPath[i]])
		{
			if(self.objectPath[i] == "hs_doc")
			{
				var pullFrom = target[self.objectPath[i]];
				return {
					owner_id : pullFrom.owner_id,
					owner_groups : pullFrom.owner_groups,
					createdAt : pullFrom.createdAt,
					modifiedAt : pullFrom.modifiedAt,
					permissions : permissionCode.fromString('700')//TODO: is this bit of logic correct?
				}
			}
			parent = target;
			target = target[self.objectPath[i]];
		} else {}//TODO: handle if bad path given
	}
	if(_.isPlainObject(target))
		return _.isObject(target)?target.hs_doc:undefined;
	else
		return _.isObject(parent)?parent.hs_doc:undefined;
}
/***
 *    ███████╗ ██████╗  ██████╗██╗  ██╗███████╗████████╗███████╗
 *    ██╔════╝██╔═══██╗██╔════╝██║ ██╔╝██╔════╝╚══██╔══╝██╔════╝
 *    ███████╗██║   ██║██║     █████╔╝ █████╗     ██║   ███████╗
 *    ╚════██║██║   ██║██║     ██╔═██╗ ██╔══╝     ██║   ╚════██║
 *    ███████║╚██████╔╝╚██████╗██║  ██╗███████╗   ██║   ███████║
 *    ╚══════╝ ╚═════╝  ╚═════╝╚═╝  ╚═╝╚══════╝   ╚═╝   ╚══════╝
 *
 */
Hyperyun.Sockets = {};
Hyperyun.Sockets.onAllowedConnection = function(socket, data, tApp){
	socket.on('generateAPIKey', Hyperyun.Access.wrapWithAccess('generateAPIKey',socket,Hyperyun.Events.__generateAPIKey));
	socket.on('analyticsEvent', Hyperyun.Access.wrapWithAccess('analyticsEvent',socket,Hyperyun.Events.__analyticsEvent));
	socket.on('createCollection', Hyperyun.Access.wrapWithAccess('createCollection',socket,Hyperyun.Events.__createCollection));
	socket.on('logout', Hyperyun.Access.wrapWithAccess('logout',socket,Hyperyun.Events.__logout));
	socket.on('passwordSignUp', Hyperyun.Access.wrapWithAccess('passwordSignUp',socket,Hyperyun.Events.__passwordSignUp));
	socket.on('passwordLogin', Hyperyun.Access.wrapWithAccess('passwordLogin',socket,Hyperyun.Events.__passwordLogin));
	socket.on('loggedIn', Hyperyun.Access.wrapWithAccess('loggedIn',socket,Hyperyun.Events.__loggedIn));
	socket.on('changePassword', Hyperyun.Access.wrapWithAccess('changePassword',socket,Hyperyun.Events.__changePassword));
	socket.on('forgotPassword', Hyperyun.Access.wrapWithAccess('forgotPassword',socket,Hyperyun.Events.__forgotPassword));
	socket.on('activate', Hyperyun.Access.wrapWithAccess('activate',socket,Hyperyun.Events.__activate));
	socket.on('getOAuthSettings', Hyperyun.Access.wrapWithAccess('getOAuthSettings',socket,Hyperyun.Events.__getOAuthSettings));
	socket.on('afterOAuth', Hyperyun.Access.wrapWithAccess('afterOAuth',socket,Hyperyun.Events.__afterOAuth));
	socket.on('disconnect', Hyperyun.Access.wrapWithAccess('disconnect',socket,Hyperyun.Events.__disconnect));
	socket.on('removeFile', Hyperyun.Access.wrapWithAccess('removeFile',socket,Hyperyun.Events.__removeFile));
	ss(socket).on('uploadFile', Hyperyun.Access.wrapWithStreamAccess('uploadFile',socket, Hyperyun.Events.__uploadFile));
	socket.on('find', Hyperyun.Access.wrapWithAccess('find',socket,Hyperyun.Events.__find,Hyperyun.Events._p_find));
	socket.on('insert', Hyperyun.Access.wrapWithAccess('insert',socket,Hyperyun.Events.__insert,Hyperyun.Events._p_insert));
	socket.on('remove', Hyperyun.Access.wrapWithAccess('remove',socket,Hyperyun.Events.__remove,Hyperyun.Events._p_remove));
	socket.on('update', Hyperyun.Access.wrapWithAccess('update',socket,Hyperyun.Events.__update,Hyperyun.Events._p_update));
	socket.on('ping',function(data, callback){Hyperyun.Debug.socket("got ping",data,callback);if(callback)callback()})
	socket.on('queryAppOwnerTargets',Hyperyun.Events._queryAppOwnerTargets);
	socket.on('unsubscribeFromQuery',Hyperyun.Access.wrapWithAccess('unsubscribeFind',socket,Hyperyun.Events.__unfind));
	socket.on('chmod',Hyperyun.Access.wrapWithAccess('chmod',socket,Hyperyun.Events.__chmodWhere,Hyperyun.Events._p_chmodWhere));
};

Hyperyun.Sockets.findClientsSocket = function(roomId, namespace) {
    var res = []
    var ns = io.of(namespace ||"/");    // the default namespace is "/"

    if (ns) {
        for (var id in ns.connected) {
            if(roomId) {
                var index = ns.connected[id].rooms.indexOf(roomId) ;
                if(index !== -1) {
                    res.push(ns.connected[id]);
                }
            } else {
                res.push(ns.connected[id]);
            }
        }
    }
    return res;
}

Hyperyun.Sockets.noteConnection = function(socket){
	if(!socket) return;
    var clientIp = (socket.request.headers["x-real-ip"] ? socket.request.headers["x-real-ip"] : socket.request.connection.remoteAddress)
	var coll = company+"Connections"

	Hyperyun.Hyperstore.makeCollection(coll);
	if(Hyperyun.Hyperstore.collections[coll])
	{
		var data = {
			appName : socket.appName,
			version : new Date(),
			sel:{
	    		sid: socket.id,
	    		ip:clientIp,
	    		app: socket.appName
			},
			opt:{
				safe:true
			},
			collection : coll,
			socketid : socket.id,
			loginApp : socket.appName
		}
		Hyperyun.Access.processAccess('insert', 
			socket, 
			data, 
			undefined, 
			Hyperyun.Events.__insert, 
			Hyperyun.Events._p_insert,
			function(err,access){/*connection noted*/},
			{isExternal: false}
		)
	}
}
Hyperyun.Sockets.noteDisconnection = function(socket){

	if(!socket) return;
    var coll = company+"Connections"

	Hyperyun.Hyperstore.makeCollection(coll);
	if(Hyperyun.Hyperstore.collections[coll])
	{
		var data = {
			appName : socket.appName,
			version : new Date(),
			sel:{
	    		sid: socket.id
			},
			opt:{
				safe:true
			},
			collection : coll,
			socketid : socket.id,
			loginApp : socket.appName
		}
		Hyperyun.Access.processAccess('remove', 
			socket, 
			data, 
			undefined, 
			Hyperyun.Events.__remove, 
			Hyperyun.Events._p_remove,
			function(err,access){/*connection noted*/},
			{isExternal: false}
		)
	}
}

Hyperyun.Sockets.verifyNotedConnections = function(){
	var appsToVerify = _.compact(_.map(_.uniq(_.keys(Hyperyun.Hyperstore.collections)), function(k){
		if(k.indexOf((company+"Connections"), k.length - (company+"Connections").length) !== -1)
		{
			return k
		}
		return undefined
	}));
	var access = {preFindResults:{touched:[]}}
	_.forEach(appsToVerify, function(coll){
		Hyperyun.Hyperstore.makeCollection(coll);
		Hyperyun.Hyperstore.collections[coll].db.find({}).toArray(function(err,res){
			if(err) return;
			var reifiedSockets = _.pluck(Hyperyun.Sockets.findClientsSocket(),'id')
			var notedSockets = _.pluck(res,'sid')
			var oldNotes = _.difference(notedSockets, reifiedSockets)
			access.preFindResults = oldNotes;
			_.forEach(oldNotes, function(old){
				app = coll.substring(0, coll.length - (company+"Connections").length)
				Hyperyun.Sockets.noteDisconnection({appName:app, id:old})
			})
		})
	})
}
setInterval(function(){Hyperyun.Sockets.verifyNotedConnections()},5000)


// Run in Multi-tenancy mode
if(config.multi) require('./Multitenant/multitenant.js')(Hyperyun, app, config);

/***
 *    ███████╗███████╗██████╗ ██╗   ██╗███████╗██████╗
 *    ██╔════╝██╔════╝██╔══██╗██║   ██║██╔════╝██╔══██╗
 *    ███████╗█████╗  ██████╔╝██║   ██║█████╗  ██████╔╝
 *    ╚════██║██╔══╝  ██╔══██╗╚██╗ ██╔╝██╔══╝  ██╔══██╗
 *    ███████║███████╗██║  ██║ ╚████╔╝ ███████╗██║  ██║
 *    ╚══════╝╚══════╝╚═╝  ╚═╝  ╚═══╝  ╚══════╝╚═╝  ╚═╝
 *
 */

//user login dialog. Upon successful login, sends user to the decision dialog
app.get('/dialog/login', function(req, res){
	res.render('oauthLogin', {client_id: req.query.client_id, state: req.query.state, scope: req.query.scope, statedURI: req.query.redirect_uri});
})

//user decision dialog. Upon allowing, the user will be sent to the redirect
app.post('/dialog/decision', function(req, res){
	//doing login check
	var collection = req.subdomains[0]+dlim+"users";
	Hyperyun.Hyperstore.makeCollection(collection);
	Hyperyun.Hyperstore.collections[collection].db.findOne({emails: {$in: [req.body.username]}}, function(err, doc){
		if(doc) {
			if (doc.status) {
				bcrypt.compare(req.body.password, doc.password, function(err, response) {
					if(!err && response)
					{
						var userid = doc._id;
						res.render('oauthDecision', {
							username: req.body.username,
							clientname: req.body.client_id,
							client_id: req.body.client_id,
							user_id: userid,
							state: req.body.state,
							scope: req.body.scope,
							statedURI: req.body.statedURI
						});
					} else res.redirect(req.body.statedURI+"?error=access_denied&state="+req.body.state)
				});
			} else res.redirect(req.body.statedURI+"?error=access_denied&state="+req.body.state)
		} else res.redirect(req.body.statedURI+"?error=access_denied&state="+req.body.state)
	});
})
app.get('/debugRedirect', function(req,res){
	res.render('debug',{code: req.query.code, client_id:"12345b", client_secret:"secret"})
})
//will send the user to the redirect location with the auth code
app.get('/oauth2/redirect', function(req, res){
	if(_.size(req.subdomains) <= 0) res.send("Error: no application specified");
	var allowed = req.query.allow == "Allow";
	var client_id = req.query.client_id;
	var user_id = req.query.user_id;
	var state = req.query.state;
	var statedURI = req.query.statedURI;
	var app = req.subdomains[0];
	Hyperyun.OAuth.getClientRedirectURI(app, statedURI, client_id, user_id, state, function(err, url, authcode, state){
		if(!err && url)
		{
			if(allowed)
			{
				url +="/?code="+authcode+"&state="+state;
			}
			res.redirect(url);
		} else res.send("Error: "+err+". Denied url: "+url);
	});
})

app.post('/oauth2/grant', Hyperyun.OAuth.assureOAuth, function(req, res){
})

app.get('/admin', function(req, res) {
	if(config.multi) {
		if(req.subdomains.length>0) {
			res.render('admin', {page: null, appName: req.subdomains[0]});
		} else {
			res.redirect('/login');
		}
	} else if(config.application) {
		res.render('admin', {page: null, appName: config.application});
	} else res.redirect('/');  
});
// Add support for admin clientside routing

app.get('/admin/:page', function(req, res) {
	if(config.multi) {
		if(req.subdomains.length>0) {
			res.render('admin', {page: req.params.page, appName: req.subdomains[0]});
		} else {
			res.redirect('/login');
		}
	} else if(config.application) {
		res.render('admin', {page: req.params.page, appName: config.application});
	} else res.redirect('/'); 
});

app.get('/activate/:code', function(req, res) {
	Hyperyun.Utils.togglelog(req.subdomains);
	if(config.multi) {
		if(req.subdomains.length>0) {
			Hyperyun.Accounts.activateAccount(req.subdomains[0], req.params.code, function(response){
				if(response.url) res.redirect(response.url);
				else if(response.err) res.render('activateError');
				else res.render('activateSuccess');
			});
		} else {
			Hyperyun.Multitenant.activate(req.params.code, function(response) {
				if(response.err) res.render('activateError');
				else res.render('activateSuccess');
			});
		}
	} else if(config.application){
		Hyperyun.Accounts.activateAccount(config.application, req.params.code, function(response){
			if(response.url) res.redirect(response.url);
			else if(response.err) res.render('activateError');
			else res.render('activateSuccess');
		});
	} else res.redirect('/');
});
app.get('/forgot/:code', function(req, res) {
	var appName = null;
	if(config.multi && req.subdomains.length>0) appName = req.subdomains[0];
	else if(config.application) appName = config.application;
	if(appName) {
		Hyperyun.Accounts.forgotPassword(appName, req.params.code, function(exists){
			if(exists) res.render('forgot', {code: req.params.code});
			else res.render('forgotError');
		});
	} else res.redirect('/');
});
app.get('/api/:collection', function(req, res){
	return Hyperyun.REST.handleRESTRequest('read',req.params.collection, req, res);
});
app.post('/api/:collection', function(req, res){
	return Hyperyun.REST.handleRESTRequest('write',req.params.collection, req, res);
});
app.put('/api/:collection', function(req, res){
	return Hyperyun.REST.handleRESTRequest('edit',req.params.collection, req, res);
});
app.delete('/api/:collection', function(req, res){
	return Hyperyun.REST.handleRESTRequest('delete',req.params.collection, req, res);
});
app.get('/api/:action/:collection', function(req, res){
	return Hyperyun.REST.handleRESTRequest(req.params.action,req.params.collection, req, res);
});

app.get('/static/:id/:filename', function(req, res) {

	var readstream = gfs.createReadStream({
	  _id : req.params.id
	});

	//error handling, e.g. file does not exist
	readstream.on('error', function (err) {
	  console.error('An error occurred when trying to find file with filename ',req.params.id,req.params.filename, err);
	  //throw err;
	  res.send(404,"File not found");
	  return;
	});
    //Temporary caching solution, to be deleted once we use nginx
    res.set('Cache-Control', 'public, max-age=31557600000');
    readstream.pipe(res);
});

app.get('/static/:id', function(req, res){
	var readstream = gfs.createReadStream({
	  _id : req.params.id
	});

	//error handling, e.g. file does not exist
	readstream.on('error', function (err) {
	  console.error('An error occurred! File not found with id ',req.params.id, err);
	  //throw err;
	  res.send(404,"File not found");
	  return;
	});

	readstream.pipe(res);
})

app.get('/auth/:provider/:oauthtype/', function(req, res){
	var appName = null;
	if(config.multi && req.subdomains.length>0) appName = req.subdomains[0];
	else if(config.application) appName = config.application;

	Hyperyun.OAuth.auth(req.params.oauthtype, req.params.provider, req.query.code, appName, function(token, err){
		if(token) res.render('afterOAuth', {socket: req.params.socket, token: token, method: req.params.provider});
		else res.render('afterOAuth', {token: false, err: err});
	});
});

app.get('/auth/:provider/:oauthtype/:id/:socket', function(req, res){
	if(req.params.oauthtype=="oauth2") {
		var redirect_uri = "http://"+req.host+req.path;
		Hyperyun.OAuth.auth2(req.params.provider, req.query.code, req.params.id, {redirect_uri: redirect_uri}, function(token, err){
	    	if(token) res.render('afterOAuth', {socket: req.params.socket, token: token, method: req.params.provider});
	    	else res.render('afterOAuth', {token: false, err: err});
	    });
	} else {
		var redirect_uri = "http://"+req.host+req.path;
		Hyperyun.OAuth.auth1(req.params.oauthtype, req.params.provider, req.query.code, req.params.id, {redirect_uri: redirect_uri}, function(token, err){
	    	if(token) res.render('afterOAuth', {socket: req.params.socket, token: token, method: req.params.provider});
	    	else res.render('afterOAuth', {token: false, err: err});
	    });
	}
});

app.get('/cdn/:file',function(req,res){
	res.sendfile(__dirname+'/public/cdn/'+req.params.file);
})

app.get('/', function(req, res) {
	res.render('index');
});

app.get(/^\/(.*)/, function(req, res) {
        var subdomain = req.subdomains[0];
        // fix for localhost
        if(req.host=="127.0.0.1") subdomain = false;
        if(subdomain) {
                if(subdomain!='www' && subdomain!='docs' && subdomain!='account' && subdomain!='admin') {
                        Hyperyun.Hyperstore.makeCollection(subdomain+dlim+company+"Configuration");
                        Hyperyun.Hyperstore.collections[subdomain+dlim+company+"Configuration"].db.findOne({url: subdomain}, function(err, app){
                                if(!app || err) {
                                        res.sendfile(__dirname + '/public/'+req.path);
                                } else {
                                        res.sendfile(__dirname + '/applications/'+subdomain+'/'+req.path);
                                }
                        });
                } else if(subdomain=='www') {
                  res.sendfile(__dirname + '/applications/'+'landingpage'+'/'+req.path);
                } else {
                        res.sendfile(__dirname + '/public/'+req.path);
                }
        } else {
                  res.sendfile(__dirname + '/applications/'+'landingpage'+'/'+req.path);
        }
});

if(config.favicon) app.use(favicon(__dirname + config.favicon));
app.use(express.static(path.join(__dirname, 'public')));

/***
 *    ███████╗ ██████╗  ██████╗██╗  ██╗███████╗████████╗   ██╗ ██████╗
 *    ██╔════╝██╔═══██╗██╔════╝██║ ██╔╝██╔════╝╚══██╔══╝   ██║██╔═══██╗
 *    ███████╗██║   ██║██║     █████╔╝ █████╗     ██║      ██║██║   ██║
 *    ╚════██║██║   ██║██║     ██╔═██╗ ██╔══╝     ██║      ██║██║   ██║
 *    ███████║╚██████╔╝╚██████╗██║  ██╗███████╗   ██║   ██╗██║╚██████╔╝
 *    ╚══════╝ ╚═════╝  ╚═════╝╚═╝  ╚═╝╚══════╝   ╚═╝   ╚═╝╚═╝ ╚═════╝
 *
 */

io.sockets.on('connection', function (socket, data) {
	data = Hyperyun.Utils.reviveJSON(data);
	Hyperyun.Application.recordAnalyticsEvent(data);
	var tApp = socket.request._query.appName;

	socket.appName = tApp
	Hyperyun.Sockets.noteConnection(socket);

	Hyperyun.Sockets.onAllowedConnection(socket, data, tApp);
		console.log("Socket connected with",socket.appName,socket.loginTokenUsed)
});

// Make first app 

if(config.application && program.email && program.password && !config.baas) {
	var application = {
		name: config.application,
		url: config.application, 
		user: {
			email: program.email,
			password: program.password,
		}
	}
	Hyperyun.Hyperstore.createApp(application, function(res) {
		if(res.err) throw res.err;
	});
}