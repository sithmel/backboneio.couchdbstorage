
// Backbone.io notifies automatically changes to each client
// (with the exception of the one who made the changes)
// setupSync get changes from the couchdb change feed
// this is useful when we have many servers connected to a couchdb
// transactionCache filters change notifications
// and to avoid that a change is notified to the same server which made it

var transactionsCache = {};
var cacheTime = 60000;

/*
 cache a transaction
*/
var cacheTransaction = function (db, id, rev, del){
    var tkey,
        dbkey = db.config.db;
    if (dbkey in transactionsCache){
        tkey = id + rev + (del && 'DEL' || '');
        transactionsCache[dbkey][tkey] = new Date().getTime();
    }
};

/*
 init a db cache 
*/
var initTransactionCache = function (db){
    transactionsCache[db.config.db] = {}; 
};

/*
 check if a transaction is cached 
*/
var isTransactionCached = function (db, id, rev, del){
    var tkey,
        dbkey = db.config.db;
    if (dbkey in transactionsCache){
        tkey = id + rev + (del && 'DEL' || '');
        if (tkey in transactionsCache[dbkey]){
            return true;
        }
    }
    return false;
};

/*
 clear old transactions 
*/

setInterval(function (){
    var t0, td, t1 = new Date().getTime();
    for(var dbkey in transactionsCache){
        for(var tkey in transactionsCache[dbkey]){
            t0 = transactionsCache[dbkey][tkey];
            td = t1 - t0;  
            if (td > cacheTime){
                console.log('Removing old transactions:', dbkey, tkey);
                delete transactionsCache[dbkey][tkey];
            }
        }
    }
}, cacheTime / 2);

// Clients will receive 'backend:create', 'backend:update',
// and 'backend:delete' events respectively.

module.exports.setupSync = function (db, backend, getChannel){
    var feed = db.follow({since: "now"});

    // initializing transaction cache
    initTransactionCache(db); 

    feed.on('change', function (change) {
        if (isTransactionCached(db, change.id, change.changes[0].rev, change.deleted )){
            console.log('Transaction is cached: ', change.id, change.changes[0].rev);
            return;
        }

        console.log('Notify this transaction: (id, rev, delete)', change.id, change.changes[0].rev, change.deleted);

        if (change.deleted){
            // notify deletion to all
            backend.emit('deleted', { _id: change.id });
        }
        else {
            db.get(change.id, { revs_info: true }, function(err, body) {
                var channel;
                if (!err){
                    channel = getChannel && getChannel(body) || null;
                    if (body._revs_info.length > 1){
                        // update
                        backend.emit('updated', body, channel);
                    }
                    else {
                        // create
                        backend.emit('created', body, channel);
                    }
                }
                else {
                    console.error(err);
                }
            });
        }
    });
    
    return feed;
    //feed.follow();


};

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
                        cacheTransaction(db, body.id, body.rev, false);
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
                        cacheTransaction(db, body.id, body.rev, false);
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
                        cacheTransaction(db, body.id, body.rev, true);
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

