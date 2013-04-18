module.exports = function(db) {
    
    return function(req, res, next) {
        var crud = {
            create: function() {
                db.insert(req.model, function (err, body){
                    if (!err){
                        req.model._rev = body.rev;
                        req.model._id = body.id;
                        res.end(req.model);
                    }
                    else {
                        console.error(err);
                    }
                });
            },
            
            read: function() {
                if (req.model.id) {
                    db.get(req.model.id, { revs_info: true }, function(err, body) {
                        if (!err){
                            res.end(body);
                        }
                        else {
                            console.error(err);
                        }
                    });
                } else {
                    // get a list o every document
                    db.fetch({}, function (err, body){
                        var out = [];

                        if (!err){
                            body.rows.forEach(function(doc) {
                                if (doc.id[0] !== '_'){
                                    out.push(doc.doc);
                                }
                            });
                            res.end(out);
                        }
                        else {
                            console.error(err);
                        }
                    });
                }
            },
            
            update: function() {
                db.insert(req.model, function (err, body){
                    if (!err){
                        // update's gone ok. Updating revision
                        req.model._rev = body.rev;
                        res.end(req.model);
                    }
                    else {
                        // something has gone wrong.
                        // If versions conflicts I update the model with the current one
                        console.warn(err);
                        db.get(req.model.id, { revs_info: true }, function(err, body) {
                            if (!err){
                                res.end(body);
                            }
                            else {
                                console.error(err);
                            }
                        });
                    }
                
                });
            },
            
            delete: function() {
                db.destroy(req.model._id, req.model._rev, function(err, body) {
                    if (!err){
                        res.end(req.model);
                    }
                    else {
                        console.error(err);
                    }
                });
            }
        };

        if (!crud[req.method]) return next(new Error('Unsuppored method ' + req.method));
        crud[req.method]();
    }
};

