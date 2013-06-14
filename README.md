backboneio.couchdbstorage
=========================

A storage middleware for couchdb and backbone.io.

Syntax:

couchdbstorage(db)

It returns a backbone.io middleware that manages CRUD on a couchdb database

Example:

    // import modules
    var backboneio = require('backbone.io'),
        couchdbstorage = require('./couchdbstorage')couchdbstorage,
        nano = require('nano')('http://localhost:5984'); // define couchdb url
        
     
    var backend = backboneio.createBackend(),  // create a backbone backend
        db = nano.use('dbname');  // define an existing couchdb database

    // this is optional: I manually retrieve a view in case I don't want 
    // to get all the documents

    backend.read(function(req, res) {
        if (!req.model.id) {
            db.view("designname", "viewname", function (err, body){
                var out = []
                if (!err) {
                    body.rows.forEach(function(doc) {
                        out.push(doc.value);
                    });
                    res.end(out);
                }
                else {
                    console.log(err);
                }
            });        
        }
    });

    // couchdbstorage manage CRUD on db
    backend.use(couchdbstorage(db));

Backbone configuration
======================
Don't forget to set your id attribute to "_id":

    MyModel = Backbone.Model.extend({
        idAttribute: "_id",
        ...
        
Setting up change feed
======================
If you need to notify your clients for changes of different servers 
you can use the couchdb change feed:
    
    var setupSync = require('./couchdbstorage').setupSync;

    var feed = setupSync(db, backend);
    feed.follow();

The library filters automatically changes coming from the current process.

You can notify backend events to a subset of clients using the channel feature of backbone.io.
The channel is determined by a function that takes the model and get the channel.

    var getChannel = function (model) {
        return model.group;
    };


    var feed = setupSync(db, backend, getChannel);
    feed.follow();
    
Warning!! This doesn't work for deletion (just create/update).

To leverage this feature you must use an updated version that support: 

    backend.emit('updated', { id: 'myid', foo: 'baz' }, "mychannel");
    
You can find this information in the backbone.io README.md.
