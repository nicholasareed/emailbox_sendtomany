App.Collections = {};

App.Collections.UserEmailAccounts = Backbone.Collection.extend({

	model: App.Models.UserEmailAccount,

	sync: Backbone.cachingSync(emailbox_sync_collection, 'UserEmailAccounts'),

	// comparator: function( Thread ) {
	// 	return -1 * Thread.toJSON().app.AppPkgDevConvomail.wait_until;
	// },

	fetchAll: function(options){
		var that = this;

		// Fetch from emailbox
		return this.fetch({
			data: {
				model: 'UserEmailAccount',
				conditions: {},
				fields: [], // id + seconds
				limit: 10,
				sort: {
					'name' : -1
				}
			}
		});

	},

});



function emailbox_sync_collection(method, model, options) {

	// console.log('backbone collection sync overwritten');

	var dfd = $.Deferred();

	options || (options = {});

	switch (method) {
		case 'create':
			break;

		case 'update':
			break;

		case 'delete':
			break;

		case 'read':
			// read/search request
			// console.log('sync reading');
			// console.log(options);
			// console.log(model); // or collection
			// console.log(model.model.prototype.fields);

			// turn on caching for fucking everything yeah
			// - fuck it why not?
			if(App.Credentials.usePatching){
				options.data.cache = true;
			}

			// Create namespace for storing
			// console.info(model);
			console.log(1);
			console.log(model);
			var ns = model.model.prototype.internalModelName + '_';

            // Need to include a passed new cachePrefix for some collections
            if(options.ns){
                // console.warn('cachePrefix');
                ns = ns + options.ns + '_';
            }

            // Collection namespace?
            // - for ids
            if(options.options && options.options.collectionCachePrefix){
                ns = ns+ options.options.collectionCachePrefix + '_';
            }
			// console.log('ns');
			// console.log(ns);
			// console.log(options);
			// return false;

			// Get previous cache_hash
			// - just stored in memory for now
			try {
				options.data.hash = App.Data.Store.CollectionCache[ns].hash;
			} catch(err){
				// no hash exists
			}

			Api.search({
				data: options.data,
				success: function(response){ // ajax arguments

					response = JSON.parse(response);

					if(response.code != 200){
						console.log('=error');
						if(options.error) options.error(this,response);
						dfd.reject();
						return;
					}
					// console.log('Calling success');

					if(response.hasOwnProperty('patch')){
						// returned a patch

						// do the patching
						// - need to get our previous edition
						// - apply the patch
						// - re-save the data

						// Get previous version of data
						// - stored in memory, not backed up anywhere
						// - included hash+text
						try {
							// console.log(collection.model.internalModelName + '_' + model.id);
							if(App.Data.Store.CollectionCache[ns].text.length > 0){
								// ok

							}
						} catch(err){
							// No previous cache to compare against!
							// - this should never be sent if we're sending a valid hash
							console.error('HUGE FAILURE CACHING!');
							console.log(err);
							return false;
						}

						// Create patcher
						var dmp = new diff_match_patch();

						// Build patches from text
						var patches = dmp.patch_fromText(response.patch);

						// get our result text!
						var result_text = dmp.patch_apply(patches, App.Data.Store.CollectionCache[ns].text);

						// Convert text to an object
						try {
							response.data = JSON.parse(result_text[0]); // 1st, only 1 patch expected
						} catch(err){
							// Shoot, it wasn't able to be a object, this is kinda fucked now
							// - need to 
							console.error('Failed recreating JSON');
							return false;
						}

					}

					// After patching (if any occurred)

					// Return data without the 'Model' lead
					var tmp = [];
					var tmp = _.map(response.data,function(v){
						return v[options.data.model];
					});

					// Return single value
					window.setTimeout(function(){

						// Resolve
						dfd.resolve(tmp);

						// Fire success function
						if(options.success){
							options.success(tmp);
						}
					},1);

					// Update cache with hash and text
					App.Data.Store.CollectionCache[ns] = {
						hash: response.hash,
						text: JSON.stringify(response.data)
					};
				
				}
			});

			break;
	}

	return dfd.promise();

}


function contacts_sync_collection(method, model, options) {

	// console.log('backbone collection sync overwritten');

	var dfd = $.Deferred();

	options || (options = {});

	switch (method) {
		case 'create':
			break;

		case 'update':
			break;

		case 'delete':
			break;

		case 'read':
			// read/search request
			// console.log('sync reading');
			// console.log(options);
			// console.log(model); // or collection
			// console.log(model.model.prototype.fields);

			var contactFields = ["id","displayName","name","emails","photos"];
			var contactFindOptions = {
				// filter: searchCritera,
				multiple: true
			};

			// alert('loading contacts');
			App.Utils.Notification.toast('Loading Contacts (may freeze for a moment)');

			if(usePg){

				// Go get data
				try {
					navigator.contacts.find(contactFields, function(all_contacts){
						// Filter contacts who have no email address
						var contacts_with_email = [];
						$.each(all_contacts,function(i,contact){
							try {
								if(contact.emails.length > 0){
									contacts_with_email.push(contact);
								}
							} catch (err){

							}
						});

						// console.log('with email');
						// console.log(JSON.stringify(contacts_with_email.splice(0,2)));

						// alert(contacts_with_email.length);

						// get only the top 25
						// contacts_with_email = contacts_with_email.splice(0,25);

						// Parse and sort
						var contacts_parsed = parse_and_sort_contacts(contacts_with_email);
						// contacts_parsed = contacts_parsed.splice(0,25);

						console.log('Got all contacts');
						console.log(contacts_parsed);
						console.log(JSON.stringify(contacts_parsed));

						// Resolve
						dfd.resolve(contacts_parsed);

						// Fire success function
						if(options.success){
							options.success(contacts_parsed);
						}

					}, function(err){
						// Err with contacts
						alert('Error with contacts');
					}, contactFindOptions);
				} catch(err){
					alert('failed getting contacts');
					console.log('Failed loading contacts');
					console.log(err);
					if(usePg){
						alert("Failed loading Contacts");
					}
					
				}
			} else {
				// not on mobile
				alert('contacts gonna be broke');
			}


			break;
	}

	return dfd.promise();

}


function parse_and_sort_contacts(contacts){

	// eh, need to make this work with newer contact searching and adding

	contacts = _.map(contacts,function(contact){
		// Iterating over every contact we have
		// - returning an array of emails, with each email having the contact data included
		// - instead of sorting by contact, we go by email address as the primary display
		
		var data = {
			id: contact._id, 
			name: contact.common.name,
			email: ''
		};

		var tmp_emails = [];

		// Iterate over emails for contact
		// - remove emails we do not care about, like @craigslist
		_.each(contact.common.emails,function(email, index){
			var tmp_data = _.clone(data);

			// Don't use contacts that are from craigslist (too many sale- emails that we don't care about)
			if(email.address.indexOf('@craigslist') != -1){
				// return out of _.each
				return;
			}

			// Set email value
			tmp_data.email = email.address;

			// console.log('adding');
			tmp_emails.push(tmp_data);
		})

		if(tmp_emails.length < 1){
			return [];
		}

		// console.log('return: ' + tmp_emails.length);
		return tmp_emails;

	});
	contacts = _.reduce(contacts,function(contact,next){
		return contact.concat(next);
	});
	contacts = _.compact(contacts); // get rid of empty arrays
	contacts = _.uniq(contacts);

	// // Sort
	// contacts = App.Utils.sortBy({
	// 	arr: contacts,
	// 	path: 'email',
	// 	direction: 'desc', // desc
	// 	type: 'string'
	// });
	console.log(contacts.length);
	return contacts;

};