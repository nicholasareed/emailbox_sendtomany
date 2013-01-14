
// http requests
var request = require('request');

// defer
var Q = require('q');

// Querystring
var querystring = require('querystring');

// uuid
var uuid = require('node-uuid');

// Handle a ping from an event
function ping(req,res){
	// Handle a Ping request
	// - just respond with a true
	// - doesn't deal with auth at all? 

	// Set response Content-Type
	if(req.body.obj == 'ping'){
		res.contentType('json');
		res.send({
			ping: true
		});

		return true;
	}

	return false;
}

exports.login = function(req, res){
	// A user is trying to login using an emailbox user_token

	// Set response Content-Type
	res.contentType('json');

	var bodyObj = req.body;
	
	if(typeof bodyObj != "object"){
		jsonError(res, 101, "Expecting object");
		return;
	}
	if(typeof bodyObj.user_token != "string"){
		jsonError(res, 101, "Expecting user_token",bodyObj);
		return;
	}


	// Request updated credentials from Emailbox
	// - via /api/user
	models.Api.loginUser(bodyObj)
		.then(function(user){
			// Succeeded in logging in the user
			// - log this person in using a cookie (expected to be on filemess.com, not anywhere else)

			req.session.user = user; // user is OUR version of the user

			// Return success
			jsonSuccess(res,'Logged in',{
				user: {
					id: user.id,
					stripe_active: user.stripe_active,
					stripe_publishable_key: user.stripe_publishable_key
				}
			});

		})
		.fail(function(result){
			// Failed to log the user in
			console.log(result);
			jsonError(res,101,'Unable to log this user in');
		});

	// Do we already have this User ID?
	// - update or insert if we do

};

exports.logout = function(req, res){
	req.session.user = null;
	jsonSuccess(res,'Logged out');
};

exports.emails = function(req, res){
	// Return a list of recent emails
	// - paid, further details

	// Check login status
	if(!req.session.user){
		res.redirect('/');
		return;
	}

	// Set response Content-Type
	res.contentType('json');

	// Get emails for the logged in user
	models.User.get_emails(req.session.user.id)
		.then(function(emails){
			// Return list of emails
			jsonSuccess(res,'',emails);

		})
		.fail(function(){
			console.log('Failed resolving get_emails');
			jsonError(res,101,'failed resolving get_emails');
		});


};


exports.stripe_oauth_callback = function(req, res){

	// Check login status
	if(!req.session.user){
		res.redirect('/');
		return;
	}

	// Set response Content-Type
	res.contentType('json');

	// Get the incoming params

	if(typeof req.query.code != 'string'){
		res.send('Invalid code from stripe');
		return;
	}

	var body = {
		code: req.query.code,
		grant_type: 'authorization_code'
	};

	var headers = {
		Authorization: 'Bearer ' + creds.stripe_test_secret_key
	}

	var options = {
		url: creds.stripe_access_token_url,
		port: 80,
		method: 'POST',
		form: body,
		headers: headers
	};

	var outReq = request.post(options, function(e, r, outRes) {

		// Got a response from Stripe

		/*
		Sample Response:
		{
		  "access_token": "sk_test_qhZmFGzbuBH8JM5klGI8dK88",
		  "refresh_token": "rt_0yQBJW90cKyBz9GbDhxKjViuepdSkJbqX0rWEKoLycuzxCnI",
		  "token_type": "bearer",
		  "scope": "read_only",
		  "stripe_user_id": "acct_0y0KY2irJnjYWdvlLn5D",
		  "livemode": false,
		  "stripe_publishable_key": "pk_test_2gipML98xRfWjCqzllTZYxav"
		}*/

		// Pull out our variables
		models.User.update_stripe(req.session.user, outRes)
			.then(function(){

				res.redirect('/');
				// console.log(outRes);
				// res.send(outRes);

			})
			.fail(function(){
				console.log('Failed2');
				res.redirect('/');
			});

	});
};


exports.payment = function(req, res){
	// Check out a payment

	var api_key = creds.stripe_test_secret_key;  // secret stripe API key
	var stripe = require('stripe')(api_key);

	// check params:

	var internal_id = req.param('internal_id');
	var code = req.param('code');

	// Check MySQL for these values
	models.Payment.check_payment(internal_id, code)
		.then(function(email){
			// Found

			// console.log('found email');
			// console.log(email);

			// Paid already?
			if(email.paid){
				// console.log(email);
				res.render('pages/payment_made',{details: email});
				return;
			}

			// Past a certain date?
			// - todo...

			// Already POSTed form?
			if(req.method != 'POST'){
				// Render payment form
				res.render('pages/payment');
				return;
			}

			// Process payment

			console.log('Stripe token');
			console.log(req.body.stripeToken);

			stripe.charges.create(
				{
					amount: 500,
					currency: "usd",
					card: req.body.stripeToken,
					description: "Payment for starred email in inbox - " + email.user_id.toString()
				},
				function(err, charge) {
					if (err) {
						console.log("Couldn't create the charge record");
						return;
					}
					
					// Save as Paid!
					var charge_id = charge.id;
					email.stripe_token = charge.id;
					models.Payment.mark_as_paid(email.internal_email_id, charge.id)
						.then(function(){
							// finished marking as Paid
							console.log('Finished marking as paid');

							res.render('pages/payment_made',{details: email});

						});


					// Emit the Star event
					var eventData = {
						event: 'Email.action',
						obj: {
							_id: email.email_id,
							action: 'star'
						}
					};
					models.Emailbox.event(eventData,email)
						.then(function(){
							// Finished emitting event
							console.log('Emitted Star event');
						});

				}
			);

		})
		.fail(function(){
			res.render('errors/404');
		});

};

exports.incoming_email = function(req, res){
	// See if the incoming email is a Sent message
	// - cancel an existing "Paid" request

	var bodyObj = req.body;

	if(ping(req,res)){
		return;
	}

	res.send('Triggered incoming_email');

	// Validate request
	// - todo...

	// Wait a few seconds for email to be fully parsed by Thread, etc.
	setTimeout(function(){

		// Get the Email
		// - make a request to the API with the _id
		var email = bodyObj.obj;

		var searchData = {
			model: 'Email',
			conditions: {
				_id: email._id
			},
			fields: [],
			limit: 1
		};

		console.log('Searching');

		var getUser = Q.defer();

		// Get the local user_id
		models.User.get_local_by_emailbox_id(bodyObj.auth.user_id)
			.then(function(local_user){
				console.log('User');
				console.log(local_user);
				getUser.resolve(local_user);
			});

		getUser.promise.then(function(local_user){

			models.Emailbox.search(searchData,bodyObj.auth)
				.then(function(emails){

					console.log('new incoming');

					if(emails.length != 1){
						// Couldn't find the email
						console.log('Unable to find matching email');
						return;
					}

					var email = emails[0];

					// Sent or Received?
					// - received: need to see if a pledged amount should be paid out
					var labels = email.Email.original.labels;
					// console.log('labels');
					// console.log(email.Email.common.email_account);
					// console.log(labels);
					// console.log(labels.indexOf('\\\\Sent'));

					if(labels.indexOf('\\\\Sent') == -1){
						// We received the email
						console.log('Received');
						
						var delivered_to = email.Email.original.headers['Delivered-To'];

						// See if it contains our magic word
						var matched = false;
						creds.trigger_phrases.forEach(function(phrase){
							if(delivered_to.indexOf('+'+phrase+'@') != -1){
								console.log('match: ' + phrase);
								matched = true;
							}
						});
						if(matched){
							// Found the trigger word

							console.log('Found Trigger phrase +...@');

							// Already paid?
							// - don't let them pay twice for responses. They need to send a fresh email in that case

							// todo: finish figuring out if we should actually reply
							// - see if thread_id already exists in our DB
							
							models.mysql.acquire(function(err, client) {
								if (err) {
									return;
								} 
								client.query(
									'SELECT * FROM f_emails ' +
									'WHERE f_emails.thread_id=?'
									, [email.Email.attributes.thread_id]
									, function(error, rows, fields) {

										models.mysql.release(client);

										if(error){
											console.log('Failed SELECT f_emails with thread_id');
											console.log(error);
											return;
										}

										if(rows.length > 0){
											// Already 
											console.log('Already replied with payment info in this Thread');
											return;
										}

										// Have not replied with payment email in this thread yet
										console.log('Replying with Payment page');

										// Build the Payment page
										var code = uuid.v4() + uuid.v4();
										code = code.replace(/-/g,'');

										var emailData = {
											user_id: local_user.id,
											email_id: email.Email._id,
											thread_id: email.Email.attributes.thread_id,
											code: code
										};

										// Write to MySQL
										
										models.mysql.acquire(function(err, client) {
											if (err) {
												return;
											} 
											client.query(
												'INSERT INTO f_emails ' + 
												'(id, user_id, email_id, thread_id, code) ' +
												'VALUES (?, ?, ?, ?, ?)'
												, [null, emailData.user_id, emailData.email_id, emailData.thread_id, emailData.code]
												, function(error, info, fields) {

													models.mysql.release(client);

													if(error){
														console.log('Failed INSERT');
														console.log(error);
														return;
													}

													// Created Payment successfully

													// Get the payment_id
													var insert_id = info.insertId

													// Create the Text and HTMl bodies
													// - should switch to 
													var textBody = 'Pay for attention';
													var htmlBody = 'You have sent an email that activated the attention auto-pay system. ' +
													'<br /><br />' +
													'<a href="http://sponsored.getemailbox.com/payment/'+insert_id+'/'+code+'">Click here to view payment options</a>';

													// Send return email
													var eventData = {
														event: 'Email.send',
														delay: 0,
														obj: {
															To: email.Email.original.headers.From,
															From: delivered_to,
															Subject: email.Email.original.headers.Subject,
															Text: textBody,
															Html: htmlBody,
															headers: {
																'In-Reply-To' : email.Email.common['Message-Id']
															}
														}
													};

													// console.log('EventData');
													// console.log(eventData);

													// Send an email! 
													models.Emailbox.event(eventData, bodyObj.auth)
														.then(function(){
															// Done
															console.log('Fired Email.send event');
														});



												}
											);
										});




									}
								);
							});

						} else {
							console.log('Trigger phrase did not match');
						}

					} else {
						// We sent the Email
						console.log('Sent');

						// Check to see if there was any pledge for the responded-to email

					}


				});
			});

	},2000);



	// {
	//     "event": "Email.send",
	//     "delay": 0,
	//     "obj": {
	//         "To" : "nicholas.a.reed@gmail.com",
	//         "From" : "nicholas.a.reed@gmail.com",
	//         "Subject" : "Test Message 1",
	//         "Text" : "this is a test message",
	//         "Html" : "this is the <strong>test</strong> html",
	//         "headers" : {
	//             "x-test-header" : "this_is_a_test"
	//         }
			
	//     }
	// }
};
