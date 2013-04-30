// Clients will receive 'backend:create', 'backend:update',
// and 'backend:delete' events respectively.

module.exports.setupSync = function (db, backend){
    var feed = db.follow({since: "now"});

    feed.on('change', function (change) {
        console.log('CHANGES', change);
        if (change.deleted){
            backend.emit('deleted', { _id: change.id });
        }
        else {
            db.get(change.id, { revs_info: true }, function(err, body) {
                if (!err){
                    if (body._revs_info.length > 1){
                        // update
                        backend.emit('updated', body);
                    }
                    else {
                        // create
                        backend.emit('created', body);
                    }
                }
                else {
                    console.error(err);
                }
            });
        }
    });
    feed.follow();


};



//module.exports.couchdbsync = function(io, backends) {
//    Object.keys(backends).forEach(function(backend) {
//        io.of(backend).on('connection', function(socket) {
//            var db = backends[backend],
//                feed = db.follow({since: "now"});

//            feed.on('change', function (change) {
//                socket.get('channel', function(err, channel) {
//                    var broadcast = function (method, object){
//                        if (channel) {
//                            socket.broadcast.to(channel).emit('synced', method, object);
//                        } else {
//                            socket.broadcast.emit('synced', method, object);
//                        }
//                    };

//                    if (change.deleted){
//                        broadcast('delete', {_id: change.id});
//                        socket.broadcast.emit('synced', 'delete', {_id: change.id});
//                    }
//                    else {
//                        db.get(change.id, { revs_info: true }, function(err, body) {
//                            if (!err){
//                                if (body._revs_info.length > 1){
//                                    // update
//                                    broadcast('update', body);
//                                }
//                                else {
//                                    // create
//                                    broadcast('create', body);
//                                }
//                            }
//                            else {
//                                console.error(err);
//                            }
//                        });
//                    }

//                });
//            });

//            feed.follow();
//        });
//    });

//};

module.exports.couchdbstorage = function(db) {
    
    return function(req, res, next) {
        var crud = {
            read: function() {
                if (req.model.id) {
                    db.get(req.model.id, { revs_info: false }, function(err, body) {
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

