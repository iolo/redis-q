'use strict';

var
    Q = require('q'),
    apslice = Array.prototype.slice,
    debug = console.log.bind(console),
    DEBUG = true;//!!process.env.REDISQ_DEBUG;

/**
 * @module redisq
 */


/**
 *
 * @param {*} obj
 * @returns {string|Array}
 */
function encode(obj) {
    try {
//        if (obj instanceof Array) {
//            return obj.map(encode);
//        }
        return JSON.stringify(obj);
    } catch (e) {
        // ignore error! and give up!
        return obj;
    }
}

/**
 *
 * @param {string|Array} str
 * @returns {*}
 */
function decode(str) {
    try {
        if (str instanceof Array) {
            return str.map(decode);
        }
        return JSON.parse(str);
    } catch (e) {
        // ignore error! and give up!
        return str;
    }
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
            var args = apslice.call(arguments);
            // EXPERIMENTAL!!! with 'json' option
            if (json) {
                args = args.map(encode);
            }
            DEBUG && debug('encode:', arguments, '-->', args);
            args.push(function (err, result) {
                if (err) {
                    return d.reject(err);
                }
                // EXPERIMENTAL!!! with 'json' option
                if (json) {
                    DEBUG && debug('decode:', result);
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
            var args = apslice.call(arguments).map(encode);
            DEBUG && debug('encode:', arguments, '-->', args);
            return func.apply(this, args);
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
