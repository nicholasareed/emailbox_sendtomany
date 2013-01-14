/**
 * Module dependencies.
 */

// Promises
var Q = require('q');

// HTTP Requests
var request = require('request');

// validator
var validator = require('validator');
var sanitize = validator.sanitize;

exports.search = function(data,user){
	return models.Emailbox.query('api/search',data,user);
};
exports.count = function(data,user){
	return models.Emailbox.query('api/count',data,user);
};
exports.event = function(data,user){
	return models.Emailbox.query('api/event',data,user);
};
exports.user = function(user){
	return models.Emailbox.query('api/user',{},user);
};

exports.query = function(url,data,user){

	// Returns a search promise
	var defer = Q.defer();

	var apiRequest = {
		auth: {
			app: creds.app_key,
			user_token: user.user_token
		},
		data: data
	};

	// console.log('query');
	// console.log(apiRequest);

	var options = {
		url: 'https://getemailbox.com/' + url,
		port: 80,
		method: 'POST',
		json: true,
		body: JSON.stringify(apiRequest)
	};

	var outReq = request.post(options, function(e, r, outRes) {

		if(outRes.code != 200){
			defer.reject();
			return;
		}

		// Resolve defered
		defer.resolve(outRes.data);
	});


	return defer.promise;

};

