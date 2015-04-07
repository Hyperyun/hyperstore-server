var _ = require('lodash');
var bcrypt = require('bcrypt');

var oauthMongoModel = function(clientCollection, tokenCollection, userCollection)
{
	this.clients = clientCollection;
	this.tokens = tokenCollection;
	this.users = userCollection;
	/*	
		We assume that the `user` table has a list of user documents which have the fields we need:
			-client_id (text) 
			-client_secret (text)
			-redirect_uri (text)
		We assume that the `tokens` table has .. .. ..
			-client_id
			-access_token
			-user_id
			-expires
	*/
};

//Required for All
oauthMongoModel.prototype.getAccessToken = function(bearerToken, callback)
{
	var self = this;
	self.tokens.findOne({access_Token: bearerToken}, function(err, res){
		if(res && !err)
		{
			var token = res;
			var result = {
				accessToken: token.access_Token,
				clientId: token.client_id,
				expires: token.expires,
				userId: token.userId
			}
			callback(null, result);
		} else {
			console.error("Couldn't retrieve access token (for "+bearerToken+"): " + err);
			callback(err)
		}
	});
}

oauthMongoModel.prototype.getClient = function(clientId, clientSecret, callback)
{
	var self = this;
	self.clients.findOne({client_id: clientId}, function(err, res){
		if(res && !err)
		{
			var client = res;
			if(clientSecret !== null && client.client_secret !== clientSecret) return callback();

			callback(null, {
				clientId: client.client_id,
				clientSecret: client.client_secret,
				redirectUri: client.redirectUri
			})
		} else //might be a password login, so check users
		{
			self.users.findOne({emails:{$in: [clientId]}}, function(err, res){
				if(res && !err)
				{
					var client = res;
					if(clientSecret !== null)
					{
						bcrypt.compare(clientSecret, client.password, function(err, res){
							if(res && !err) {
								callback(null, {
									clientId: clientId,
									clientSecret:clientSecret
								})
							} else callback();
						})
					}
				} else callback(err);
			})
		}
	});
}

var allowedGrantTypes = ['password', 'authorization_code', 'refresh_token'];
oauthMongoModel.prototype.grantTypeAllowed = function(clientId, grantType, callback)
{
	if(_.contains(allowedGrantTypes, grantType))
	{
		callback(false, true);
	}
	else
	{
		callback(false, false);
	}
}

oauthMongoModel.prototype.saveAccessToken = function(accessToken, clientId, expires, user, callback)
{
	var self = this;
	var toSave = {
		access_Token:accessToken,
		client_id: clientId,
		user_id: user,
		expires: expires
	}
	self.tokens.insert(toSave, function(err, res){
		callback(err);
	})
}

//`password` grant grantType
oauthMongoModel.prototype.getUser = function(email, password, callback)
{
	var self = this;
	self.users.findOne({emails: {$in: [email]}}, function(err,doc){	
		if(doc && !err)
		{
			bcrypt.compare(password, doc.password, function(err, res){
				if(res && doc._id) {
					callback(err, doc._id);
				} else callback(err, false);
			})
		} else callback(err);
	})
}

//`authorization_code` grant grantType
oauthMongoModel.prototype.getAuthCode = function(authCode, callback)
{
	var self = this;
	self.tokens.findOne({authorization_code: authCode}, function(err, doc){
		if(doc && !err)
		{
			var result = {
				code: authCode,
				redirectURI: doc.redirect_uri,
				clientId: doc.client_id,
				expires: doc.authorization_code_expiration,
				userId: doc.user_id
			}
			callback(err, result);
		} else callback(err);
	})
}

oauthMongoModel.prototype.saveAuthCode = function(authCode, clientId, expires, user, callback)
{
	var self = this;
	self.tokens.update({client_id: clientId},{$set: {authorization_code: authCode, authorization_code_expiration: expires,
		authorization_user: user}},{upsert:true}, function(err, res){
			callback(err);
		})
}

oauthMongoModel.prototype.consumeAuthCode = function(authCode, callback)
{
	var self = this;
	self.tokens.remove({authorization_code: authCode}, function(err){
		callback(err)
	});
}

//`refresh_token` grantType

oauthMongoModel.prototype.saveRefreshToken = function(refreshToken, clientId, expires, user, callback)
{
	var self = this;
	self.tokens.update({client_id: clientId},{$set: {refresh_token: refreshToken, refresh_token_expiration: expires, refresh_user: user }},{upsert:true},function(err, res){
		callback(err);
	})
}

oauthMongoModel.prototype.getRefreshToken = function(refreshToken, callback)
{
	var self = this;
	self.tokens.findOne({refresh_token: refreshToken}, function(err, doc){
		if(doc && !err)
		{
			var result = {
				clientId: doc.client_id,
				expires: doc.refresh_token_expiration,
				userId: doc.refresh_user
			}
			callback(err, result);
		} else callback(err);
	})
}


module.exports = oauthMongoModel;