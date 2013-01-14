/**
 * Module dependencies.
 */

// Promises
var Q = require('q');

// validator
var validator = require('validator');
var sanitize = validator.sanitize;


exports.check_payment = function(internal_id, code){
	// Return the email+user
	
	var defer = Q.defer();

	// Search for the User
	// - only return a single person
	models.mysql.acquire(function(err, client) {
		if (err) {
			defer.reject({code:404,msg:'mysql failure'});
			return;
		}
		client.query(
			'SELECT *, f_emails.id as internal_email_id FROM f_emails ' +
			'LEFT JOIN f_users ON f_users.id=f_emails.user_id ' +
			'WHERE f_emails.id=? AND f_emails.code=? '
			,[internal_id, code]
			, function(error, rows, fields) {

				models.mysql.release(client);

				if (error) {
					defer.reject();
					console.log(error);
					return false;
				}

				if(rows.length < 1){
					// Unable to find Email
					defer.reject();
					return;
				}

				// Resolve with single email
				defer.resolve(rows[0]);
			}
		)
	});

	return defer.promise;

};

exports.mark_as_paid = function(internal_id, charge_id){
	// Return the email+user
	
	var defer = Q.defer();

	console.log('internal');
	console.log(internal_id);
	console.log('charge');
	console.log(charge_id);

	// Search for the User
	// - only return a single person
	models.mysql.acquire(function(err, client) {
		if (err) {
			defer.reject({code:404,msg:'mysql failure'});
			return;
		}
		client.query(
			'UPDATE f_emails ' +
			'SET f_emails.paid=1, f_emails.stripe_token=? ' +
			'WHERE f_emails.id=?'
			,[charge_id, internal_id]
			, function(error, info, fields) {

				models.mysql.release(client);

				if (error) {
					console.log('Failed marking as paid');
					console.log(error);
					defer.reject();
					return false;
				}

				// Check if affected one row
				// - todo

				console.log(info);

				// Resolve
				defer.resolve();
			}
		)
	});

	return defer.promise;

};