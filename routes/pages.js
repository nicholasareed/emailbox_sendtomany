



exports.view = function(req, res){
	// Display a File Collection for a url, using the data from Emailbox for the user
	// - Filemess holds the relationship between user/collection and url, that is about all Filemess holds onto

	// Sanitize input
	var key = req.param('key');

	if(!key || key.length < 3){
		res.render('pages/view_missing',{});
		return;
	}

	// See if url key matches in our Collection model
	models.mysql.acquire(function(err, client) {
		if (err) {
			res.render('errors/404',{error: 'mysql acquire error'});
			return;
		} 
		client.query(
			'SELECT * FROM f_collections ' +
			'LEFT JOIN f_users ON (f_collections.user_id = f_users.id) ' +  
			'WHERE f_collections.key=? '
			,[key]
			, function(error, rows, fields) {
				models.mysql.release(client);
				if (error) {
					console.log('ERROR: ' + error);
					res.render('errors/404',{error: 'mysql acquire error'});
					return false;
				}

				if(rows.length < 1){
					res.render('errors/404',{error: 'unable to find'});
					return false;
				}

				// Found a Collection that matches
				// - also includes a user
				var collection = rows[0];

				// Request the info from Emailbox
				// - using user's credentials
				// - should be caching this...
				models.Emailbox.search({
					model: 'AppFilemessCollection',
					conditions: {
						key: key
					},
					fields: [], // All fields for Collection
					limit: 1
				},collection).then(function(FileCollection){
					// Did we get authenticated with Emailbox?
					// - might have failed, in which case we would have just received an empty list
					
					// console.log('FileCollection2');
					// console.log(FileCollection);
					// Render the FileCollection (could be [])
					// FileCollection.foreach(function(i){
					// 	console.log(i);
					// });
					// res.send('shit');
					res.render('pages/view',{FileCollection: FileCollection});

				})
				.fail(function(){
					res.render('pages/view_missing',{});
				});


			}
		);

	});



	// res.render('pages/view', { title: 'Express' });
};