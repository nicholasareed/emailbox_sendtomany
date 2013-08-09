// Simpler functions for plugins (like Models/components)

App.Plugins.Sendtomany = {

	login: function(){
		// Login into our server

		var dfd = $.Deferred();

		Api.count({
			data: {
				model: 'UserEmailAccount'
			},
			success: function(res){
				try {
					res = JSON.parse(res);
				}catch(err){
					dfd.reject();
					return;
				}
				if(res.code != 200){
					dfd.reject();
					return;
				}
				dfd.resolve(true);
			}
		});

		return dfd.promise();

	}

}