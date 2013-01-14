/**
 * Module dependencies.
 */

// Promises
var Q = require('q');

// validator
var validator = require('validator');
var sanitize = validator.sanitize;

exports.loginUser = function(bodyObj){
	// Check emailbox for a user based on the submitted credentials

	var defer = Q.defer();

	process.nextTick(function(){

		var user = {};

		user.user_token = bodyObj.user_token;

		models.Emailbox.user(user)

			.then(function(result){
				// Did we get authenticated with Emailbox?

				if(typeof result.id != 'string'){
					defer.reject(2);
					return;
				}

				// Sweet, we have a valid user

				// Update the user_token for this user
				// - or if they don't exist in the DB, add them

				var created = new Date();
				created = created.getTime();

				// Try and insert the user and key
				models.mysql.acquire(function(err, client) {
					if (err) {
						defer.reject({code:404,msg:'mysql failure'});
						return;
					}
					client.query(
						'INSERT INTO f_users (id, emailbox_id, user_token, created) ' +
						'VALUES (?, ?, ?, ?) ' +
						'ON DUPLICATE KEY UPDATE ' +
						'user_token=?'
						,[null, result.id, bodyObj.user_token, created, bodyObj.user_token]
						, function(error, info, fields) {

							models.mysql.release(client);

							if (error) {
								defer.reject({code:101,msg:'Failed INSERT or UPDATE'});
								console.log(error);
								return false;
							}

							// Inserted anybody?
							if(info.insertId > 0){
								// Yes
							} else {
								// No
							}

							// Get the full person
							models.Api.getUser(bodyObj.user_token)
								.then(function(user){
									defer.resolve(user);
								})
								.fail(function(){
									defer.reject();
								});

							// Build the newUser
							// var newUser = {
							// 	id : info.insertId,
							// 	username : obj.email,
							// 	developer: developer
							// };

							// console.log('info');
							// console.log(info);

							// defer.resolve(info);

						}
					);

				});


			})

			.fail(function(result){
				defer.reject({code:404,msg:result});
				// jsonError(res,101,'Failed logging in user');
			});

	});

	return defer.promise;

};


exports.getUser = function(user_token){
	// Return a User
	var defer = Q.defer();

	// Search for the User
	// - only return a single person
	models.mysql.acquire(function(err, client) {
		if (err) {
			defer.reject({code:404,msg:'mysql failure'});
			return;
		}
		client.query(
			'SELECT * FROM f_users ' +
			'WHERE f_users.user_token=?'
			,[user_token]
			, function(error, rows, fields) {

				models.mysql.release(client);

				if (error) {
					defer.reject({code:101,msg:'Failed INSERT or UPDATE'});
					console.log(error);
					return false;
				}

				if(rows.length < 1){
					// Unable to find User
					defer.reject();
					return;
				}

				// Resolve with single user
				defer.resolve(rows[0]);
			}
		)
	});

	return defer.promise;


};


exports.insertUrl = function(data){
	// Try inserting a URL into our database

	var defer = Q.defer();

	// Validate the key
	process.nextTick(function(){
		try {
			validator.check(data.key).notNull().isAlphanumeric().len(3,200);
		} catch (e) {
			// console.log(e.message); //Invalid integer

			defer.reject({code:101,msg:'Must be alphanumeric and between 3 and 200 characters'});
			return;
		}

		// Make the key lowercase
		data.key = data.key.toLowerCase();
		data.created = new Date();
		data.created = data.created.getTime() / 1000;

		// Try and insert the key
		models.mysql.acquire(function(err, client) {
			if (err) {
				defer.reject({code:404,msg:'mysql failure'});
				return;
			}
			client.query(
				'INSERT INTO f_collections (id, user_id, f_collections.key, created) ' +
				'VALUES (?, ?, ?, ?)'
				,[null, data.user_id, data.key, data.created]
				, function(error, info, fields) {

					models.mysql.release(client);

					if (error) {
						defer.reject({code:101,msg:'Unable to create that URL'});
						console.log(error);
						return false;
					}

					// Build the newUser
					// var newUser = {
					// 	id : info.insertId,
					// 	username : obj.email,
					// 	developer: developer
					// };

					defer.resolve();

				}
			);

		});
	});

	return defer.promise;
}
