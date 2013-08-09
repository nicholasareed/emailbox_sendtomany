
App.Router = Backbone.Router.extend({

	routes: {
		
		'body' : 'body',         // entry point: no hash fragment or #

		'body_login' : 'body_login',

		'recipients': 'recipients',
		'csv': 'csv',
		'content': 'content',
		'preview': 'preview',
		'preview/:id': 'preview',
		'review': 'review',

		'intro' : 'intro',
		'preview_sending/:id' : 'preview_sending',

		'logout' : 'logout'
		
	},

	showView: function(hash,view){
		// Used to discard zombies
		if (!this.currentView){
			this.currentView = {};
		}
		if (this.currentView && this.currentView[hash]){
			this.currentView[hash].close();
		}
		this.currentView[hash] = view.render();
	},


	body: function(){
		var page = new App.Views.Body();
		App.router.showView('body',page);
	},


	csv: function(){
		var page = new App.Views.Csv();
		App.router.showView('step',page);
	},


	recipients: function(){
		// Edit the recipients we are sending to
		var page = new App.Views.Recipients();
		App.router.showView('step',page);

	},


	content: function(){
		// Edit the recipients we are sending to
		var page = new App.Views.Content();
		App.router.showView('step',page);

	},


	preview: function(id){
		// Edit the recipients we are sending to
		var page = new App.Views.Preview({
			id: id
		});
		App.router.showView('step',page);

	},


	review: function(){
		// Edit the recipients we are sending to
		var page = new App.Views.Review();
		App.router.showView('step',page);

	},


	body_login: function(){
		// Redirect through OAuth

		// Unless user_token is already in querystring
		
		if(typeof App.Credentials.access_token != 'string' || App.Credentials.prefix_access_token.length < 1){
			
			// var qs = App.Utils.getUrlVars();
			var oauthParams = App.Utils.getOAuthParamsInUrl();
			// console.log('oauthParams');
			// console.log(oauthParams);
			// alert('oauth');
			// return false;

			// if(typeof qs.user_token == "string"){
			if(typeof oauthParams.access_token == "string"){

				// Have an access_token
				// - save it to localStorage
				// localStorage.setItem(App.Credentials.prefix_access_token + 'user',oauthParams.user_identifier);
				// localStorage.setItem(App.Credentials.prefix_access_token + 'access_token',oauthParams.access_token);
				
				// // Reload page, back to #home
				// window.location = [location.protocol, '//', location.host, location.pathname].join('');
			} else {
				// Show login splash screen
				var page = new App.Views.BodyLogin();
				App.router.showView('bodylogin',page);
			}

		} else {
			// Reload page, back to #home
			window.location = [location.protocol, '//', location.host, location.pathname].join('');
			return;
		} 


	},

	intro: function(){
		var page = new App.Views.Modal.Intro();
		page.render();
	},

	preview_sending: function(id){
		// Sending modal popup

		// Get the email data for this id (array key)

		var page = new App.Views.PreviewSub({
			id: id,
			recipient: App.Data.recipients[id]
		});

		App.router.showView('body',page);
	},


	logout: function(){
		// Logout

		// alert('Logging out');

		// Reset user_token
		localStorage.setItem('ui_user_token','');
		
		window.location = [location.protocol, '//', location.host, location.pathname].join('');

	},


});
