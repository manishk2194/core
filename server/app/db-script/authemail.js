var mongoDbConnect = require('_pr/lib/mongodb');
var appConfig = require('_pr/config');
var logger = require('_pr/logger')(module);
var Cryptography = require('_pr/lib/utils/cryptography');
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var authemaildao = require('_pr/model/dao/authemaildao');


var dboptions = {
    host: process.env.DB_HOST || appConfig.db.host,
    port: appConfig.db.port,
    dbName: appConfig.db.dbName
};
mongoDbConnect(dboptions, function(err) {
    if (err) {
        logger.error("Unable to connect to mongo db >>" + err);
        throw new Error(err);
    } else {
        logger.debug('connected to mongodb - host = %s, port = %s, database = %s', dboptions.host, dboptions.port, dboptions.dbName);
    }
});

function parseArguments() {
    var cliArgs = require("command-line-args");
    var cli = cliArgs([{
        name: "help",
        alias: "h",
        type: Boolean,
        description: "Help"
    }, {
        name: "email",
        type: String,
        description: "From User Email ID"
    }, {
        name: "password",
        type: String,
        description: "From User Password"
    }, {
        name: "smtpserver",
        type: String,
        description: "SMTP Server address"
    },
        {
            name: "category",
            type: String,
            description: "Email Category <failedbot,hostfailed>"
        },{
        name: "subject",
        type: String,
        description: "Subject Line for the email"
    },{
        name: "body",
        type: String,
        description: "Body for the email"
    },{
        name: "username",
        type: String,
        description: "Username for the addressing email"
    }]);
    var options;
    try {
        var options = cli.parse();
    }
    catch (e){
        logger.error(e);
        process.exit();
    }


    /* generate a usage guide */
    var usage = cli.getUsage({
        header: "Auth email help",
        footer: "For more information, visit http://www.relevancelab.com"
    });

    if (options.help) {
        console.log(usage);

    }
    return options;
}

function getConfig(config, options) {
    //parsing arguments
    if(!options['help']){
        if (!options['email'] ) {
            logger.error("Email ID is required.")
            config = null;
        }

        if (!options['username']) {
            logger.error("Username  is required.")
            config = null;
        }

        if (!options['subject']) {
            logger.error("Email subject is required.")
            config = null;
        }
        if (!options['body']) {
            logger.error("Email body is required.")
            config = null;
        }
        if (!options['smtpserver']) {
            logger.error("SMTP server is required.")
            config = null;
        }
    }

    return config;
}


function  run(callback) {

    var options = parseArguments();

    var config = getConfig({}, options);
    //logger.info(JSON.stringify(config));

    var cryptoConfig = appConfig.cryptoSettings;
    var cryptography = new Cryptography(cryptoConfig.algorithm, cryptoConfig.password);
    // if(!options.password)
    //     return callback("",null);
    if(!options.email)
        return callback("",null);
    if(!options.smtpserver)
        return callback("",null);
    if(!options.username)
        return callback("",null);

    if(!options.category){
        logger.info("No category flag found. Defaulting to 'failedbot'");
        options.category = "failedbot";
    }
    authemaildao.find({"category":options.category},function(err,ae){
        if(!err){
           // logger.info(JSON.stringify(ae));
            if(ae.length <= 0){
                //no record found
                ae = new authemaildao();

            }
            else{
                ae = ae[0]; //fetching the first one
            }
            ae.email = options.email;
            if(options.password)
                ae.password = cryptography.encryptText(options.password, cryptoConfig.encryptionEncoding,
                cryptoConfig.decryptionEncoding);
            ae.smtpserver = options.smtpserver;
            ae.category = options.category;
            ae.username = options.username;
            ae.subject = options.subject;
            ae.body = options.body;
            ae.save(function(err1,uprec){
                if(!err1){
                    logger.info('Saved Successfully..Reading back');
                    if(options.password)
                        uprec.password = cryptography.decryptText(uprec.password, cryptoConfig.decryptionEncoding,
                        cryptoConfig.encryptionEncoding);
                    logger.info(JSON.stringify(uprec));
                    callback(null,uprec);
                }
                else{
                    callback(err1,null);
                }
            });
        }
        else{
            callback(err,null);
        }
    })






}

run(function (err,done) {
    if(err)
        logger.error(JSON.stringify(err));
    process.exit();

});