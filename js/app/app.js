//forge.debug = true;

var debugging_mode = true;
var clog = function(v){
	if(debugging_mode){
		window.console.log(v);
	}
};

var App = {
	Models:      {},
	Collections: {},
	Views:       {},
	Utils:       {},
	Plugins:     {},
	Events: 	 _.extend({}, Backbone.Events),
	Data: 		 {
		version: "0.0.13",
		InMemory: {},
		online: true,
		LoggedIn: false, // Logged into app servers
		notifications_queue: [],
		paused: false,
		was_paused: false,
		pushNotification: null,
		Keys: {},
		debug_messages: {},
		backbutton_functions: [],
		menubutton_functions: [],
		settings: {},
		default_settings: {
			debug: true
		},
		xy: {
			win_height: 0, // by default, starts in portrait mode and as orientation changes this will update (portrait only)
			win_width: 0,
			mode: 'portrait' // landscape
		},
		timers: {},
		timerbucket: {},
		Store: { // a temporary data store

			ModelCache: {},
			CollectionCache: {},

			// Models on server
			Thread: {},
			Email: {},

			// Not Models on server (local only, sync later)
			ThreadsRecentlyViewed: [],
			ThreadsRecentlyActedOn: [],
			ContactsRecentlyViewed: [],

			// Local only (don't sync?)
			Attachment: {},
			Contacts: [], // usePg=collection, browser=array
			ContactsParsed: [],
			Contact: {},
			Link: {}
		},
		PermaViews: {
			all: null,
			dunno: null,
			due: null,
			later: null,
			leisure: null,
			contacts: null
		},
		GlobalViews: {
			OnlineStatus: null
		}
	},
	Credentials: tmp_credentials,

	// Called once, at app startup
	init: function () {

		// Measurements
		App.Data.xy.win_height = $(window).height();
		App.Data.xy.win_width = $(window).width();

		var currentUrl = window.location.href;

		// Filepicker API key
		filepicker.setKey(App.Credentials.filepicker_key);

		// Key presses watching
		App.Data.Keys.ctrl = false;
		$(window).keydown(function(evt) {
			if (evt.ctrlKey) { // ctrl
				App.Data.Keys.ctrl = true;
			}
			if (evt.shiftKey) { // shift
				App.Data.Keys.shift = true;
			}
			if (evt.altKey) { // alt
				App.Data.Keys.alt = true;
			}
			if (evt.metaKey) { // meta/command
				App.Data.Keys.meta = true;
			}
		}).keyup(function(evt) {
			if (evt.ctrlKey) { // ctrl
				App.Data.Keys.ctrl = true;
			} else {
				App.Data.Keys.ctrl = false;
			}
			if (evt.shiftKey) { // shift
				App.Data.Keys.shift = true;
			} else {
				App.Data.Keys.shift = false;
			}
			if (evt.altKey) { // alt
				App.Data.Keys.alt = true;
			} else {
				App.Data.Keys.alt = false;
			}
			if (evt.metaKey) { // meta/command
				App.Data.Keys.meta = true;
			} else {
				App.Data.Keys.meta = false;
			}
		});


		// Update in-memory store with localStorage/Prefs
		App.Utils.Storage.get('AppDataStore')
			.then(function(store){
				if(store != null){
					// Make sure all the default keys exist
					App.Data.Store = $.extend(App.Data.Store,store);
					// console.log('AppDataStore');
					// console.log(App.Data.Store);
				} else {
					console.log('null AppDataStore');
				}
			});

		// Update local settings
		// - use default settings if no local ones
		App.Utils.Storage.get('settings','critical')
			.then(function(settings){
				if(!settings){
					// Not created, create them
					settings = $.extend({}, App.Data.default_settings);

					// Save them
					App.Utils.Storage.set('settings',settings,'critical');
						// .then();
				}

				// Set to global
				App.Data.settings = settings;

			});


		App.Utils.Storage.init()
			.then(function(){

				console.log('Loaded Storage.init');

				// init Router
				// - not sure if this actually launches the "" position...
				App.router = new App.Router();

				// Get access_token if it exists
				var oauthParams = App.Utils.getOAuthParamsInUrl();
				if(typeof oauthParams.access_token == "string"){

					// Have an access_token
					// - save it to localStorage
					App.Utils.Storage.set(App.Credentials.prefix_access_token + 'user', oauthParams.user_identifier, 'critical');
					App.Utils.Storage.set(App.Credentials.prefix_access_token + 'access_token', oauthParams.access_token, 'critical');

					// Save
					App.Events.trigger('saveAppDataStore',true);

					// Reload page, back to #
					window.location = [location.protocol, '//', location.host, location.pathname].join('');
					return;
				}

				// Continue loading router
				Backbone.history.start({silent: true}); // Launches "" router
				App.router.navigate('',true);

				// Debug messages
				// - add to body
				var debug_messages = new App.Views.DebugMessages();
				debug_messages.render();

				// Get user and set to app global
				App.Utils.Storage.get(App.Credentials.prefix_access_token + 'user', 'critical')
					.then(function(user){
						App.Credentials.user = user;
					});

				// Start gathering contacts
				// window.setTimeout(function(){
				// 	App.Data.Store.Contacts = new App.Collections.Contacts();
				// 	App.Data.Store.Contacts.fetch();
				// },10000);

				// Get access_token, set to app global, login to app server (doesn't allow offline access yet)
				// - switch to be agnostic to online state (if logged in, let access offline stored data: need better storage/sync mechanisms)
				App.Utils.Storage.get(App.Credentials.prefix_access_token + 'access_token', 'critical')
					.then(function(access_token){

						console.log('Stored access_token:' + access_token);	

						// Make available to requests
						App.Credentials.access_token = access_token;

						// Run login script from body_login page if not logged in
						if(typeof App.Credentials.access_token != 'string' || App.Credentials.access_token.length < 1){
							// App.router.navigate("body_login", true);
							Backbone.history.loadUrl('body_login')
							return;
						}

						// Validate credentials with app server and emailbox 
						// - make an api request to load my email address

						var dfd = $.Deferred();

						// Logged in on server
						App.Data.LoggedIn = true;

						App.Plugins.Sendtomany.login()
							.then(function(){
								// Good, logged into server

								// // Trigger a contacts sync
								// Api.event({
								// 	data: {
								// 		event: 'Contacts.sync',
								// 		obj: true
								// 	},
								// 	success: function(resp){
								// 		// return from contacts sync
								// 	}
								// });

							}) // end .then
							.fail(function(failInfo){
								// Failed login
								// - already started the process of opening windows, so we put the brakes on that, then totally log the person out

								// 
								try {
									if(failInfo.data.code == 404){
										// Unable to reach emailbox
										// - emailbox returning 404
										console.log('Emailbox server is down');

										// Render "unreachable" display
										// - it includes a "try again" button
										Backbone.history.loadUrl('body_unreachable_server')
										return;
									}

								} catch(err){

								}

								// Might have failed if the API was unreachable
								console.log('Failed Sendtomany login');

								// localStorage.setItem(App.Credentials.prefix_access_token + 'access_token',null);
								// 
								App.Utils.Storage.set(App.Credentials.prefix_access_token + 'access_token', 'critical')
									.then(function(){
										App.Credentials.access_token = null;
										Backbone.history.loadUrl('body_login')
									});

							});


							// Get our Email Accounts
							App.Data.UserEmailAccounts = new App.Collections.UserEmailAccounts();

							App.Data.UserEmailAccounts.on('reset',function(accounts){
								accounts.each(EmailAccountAdd, this);
							}, this);

							App.Data.UserEmailAccounts.on('add',function(account){
								EmailAccountAdd(account);
							}, this);

							App.Data.UserEmailAccounts.on('remove',function(account){
								// Shit, should not be removing anything, ever
								console.error('Should never be removing from the email account');
							}, this);

							App.Data.UserEmailAccounts.on('change',function(accounts){
								console.log('eh, got a change on the Email Account, maybe the name changed?');
							}, this);

							function EmailAccountAdd(account){
								// Accepts an UserEmailAccount
								// - separate because both reset and add need it
								App.Data.UserEmailAccounts_Quick = _.map(App.Data.UserEmailAccounts.toJSON(),function(acct){
									return acct.email;
								});
							}

							// Fetch all email accounts
							App.Data.UserEmailAccounts.fetchAll();

							// Load login
							Api.Event.start_listening();
							Backbone.history.loadUrl('body');

					});

		}); // end App.Utils.Storage.init().then...

	}

	
};

jQuery.fn.reverse = [].reverse;
$.whenall = function(arr) { return $.when.apply($, arr); };
