'use strict';

var
    Q = require('q'),
    apslice = Array.prototype.slice,
    debug = console.log.bind(console),
    DEBUG = process.env.REDISQ_DEBUG;

/**
 * @module redisq
 */


/**
 *
 * @param {*|array} args *array-like* of objects
 * @returns {Array.<string>} array-like to array of encoded items
 */
function encode(args) {
    var len = args.length;
    var result = new Array(len);
    for (var i = 0; i < len; i++) {
        var arg = args[i];
        // fix #2 - do not encode standalone string to json
        if (typeof arg !== 'string') {
            try {
                arg = JSON.stringify(arg);
            } catch (e) {
                // ignore error! and give up!
            }
        }
        result[i] = arg;
    }
    DEBUG && debug('encode:', args, '-->', result);
    return result;
}

/**
 *
 * @param {string|Array} str encoded string or array of encoded strings
 * @returns {*|Array} array to array of decoded objects. string to decoded objects.
 */
function decode(str) {
    var result;
    if (str instanceof Array) {
        result = str.map(decode);
    } else {
        try {
            result = JSON.parse(str);
        } catch (e) {
            // ignore error! and give up!
            result = str;
        }
    }
    DEBUG && debug('decode:', str, '-->', result);
    return result;
}

/**
 * XXX: depends on node_redis internals.
 *
 * @param {*} obj
 * @returns {Array.<string>} function names of obj to qualify/jsonify
 * @private
 */
function collectFuncNamesToMap(obj) {
    return require('redis/lib/commands').reduce(function (funcNames, command) {
        var func = obj[command];
        command = command.split(' ')[0];
        if (typeof func === 'function' && obj[command.toUpperCase()] === func && func.arguments !== 0) {
            funcNames.push(command);
        }
        return funcNames;
    }, []);
}

/**
 *
 * @param {object} obj
 * @param {Array.<string>} funcNames - original function names to apply Q
 * @param {function(string):string} funcNameMapper maps a function name into Q-applied one
 * @param {boolean} [json=false] use json object for value parameter/result
 * @returns {*} wrapped obj itself
 */
function qualify(obj, funcNames, funcNameMapper, json) {
    funcNames.forEach(function (funcName) {
        var func = obj[funcName];
        if (typeof(func) !== 'function') {
            DEBUG && console.warn('***skip*** function not found:', funcName);
            return;
        }
        var mappedFuncName = funcNameMapper(funcName);
        DEBUG && console.log('qualify function:', funcName, '-->', mappedFuncName);
        obj[mappedFuncName] = function () {
            var d = Q.defer();
            var args;
            // EXPERIMENTAL!!! with 'json' option
            args = (json)
                ? encode(arguments)
                : apslice.call(arguments);
            args.push(function (err, result) {
                if (err) {
                    return d.reject(err);
                }
                // EXPERIMENTAL!!! with 'json' option
                if (json) {
                    result = decode(result);
                }
                return d.resolve(result);
            });
            func.apply(this, args);
            return d.promise;
        };
    });
}

/**
 *
 * @param {object} obj
 * @param {Array.<string>} funcNames - original function names to apply Q
 * @param {function(string):string} funcNameMapper maps a function name into Q-applied one
 */
function jsonify(obj, funcNames, funcNameMapper) {
    funcNames.forEach(function (funcName) {
        var func = obj[funcName];
        if (typeof(func) !== 'function') {
            DEBUG && console.warn('***skip*** function not found:', funcName);
            return;
        }
        var mappedFuncName = funcNameMapper(funcName);
        DEBUG && console.log('jsonify function:', funcName, '-->', mappedFuncName);
        obj[mappedFuncName] = function () {
            // EXPERIMENTAL!!!
            return func.apply(this, encode(arguments));
        };
    });
}

/**
 * add Q wrappers for static/instance functions of redis model and query.
 *
 * @param {redis} [redis] the redis module to wrap
 * @param {object.<string,*>} [options={}] - prefix and/or suffix for wrappers
 * @param {string} [options.prefix='']
 * @param {string} [options.suffix='']
 * @param {function(string):string} [options.mapper]
 * @param {boolean} [options.json=false] use json object for value parameter/result
 * @returns {redis} the wrapped redis module itself, for convenience
 */
function redisQ(redis, options) {
    redis = redis || require('redis');
    options = options || {};
    var prefix = options.prefix || '';
    var suffix = options.suffix || 'Q';
    var mapper = options.mapper || function (funcName) {
        return prefix + funcName + suffix;
    };
    var json = !!options.json;

    // avoid duplicated application for custom mapper function and options...
//    var applied = require('crypto').createHash('md5').update(mapper.toString()).digest('hex');
//    if (redis['__q_applied_' + applied]) {
//        return redis;
//    }

    var client = redis.RedisClient.prototype;
    json && jsonify(client, ['multi'], mapper); // client's multi() method is not async.
    qualify(client, collectFuncNamesToMap(client), mapper, json);

    var multi = redis.Multi.prototype;
    json && jsonify(multi, collectFuncNamesToMap(multi), mapper); // multi's command methods are not async.
    qualify(multi, ['exec'], mapper, json);

    //redis['__q_applied_' + applied] = true;
    return redis;
}

module.exports = redisQ;
module.exports.qualify = qualify;
module.exports.jsonify = jsonify;
module.exports.encode = encode;
module.exports.decode = decode;
