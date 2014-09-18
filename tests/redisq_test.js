'use strict';

var
    assert = require('assert');

function customMapper(name) {
    return 'q' + name.charAt(0).toUpperCase() + name.substring(1);
}

describe('redis-q', function () {
    beforeEach(function () {
        delete require.cache[require.resolve('redis')];
        delete require.cache[require.resolve('../index')];
    });

    describe('with default mapper', function () {
        it('wraps all command methods for RedisClient and Multi', function () {
            var redis = require('../index')(require('redis'));
            var proto = redis.RedisClient.prototype;
            ['get', 'set', 'exists'].forEach(function (command) {
                assert(typeof proto[command + 'Q'] === 'function');
            });
            var mproto = redis.Multi.prototype;
            assert(typeof mproto.execQ === 'function');
        });
    });

    describe('with custom mapper', function () {
        it('wraps all command methods for RedisClient and Multi', function () {
            var redis = require('../index')(require('redis'), {mapper: customMapper});
            var proto = redis.RedisClient.prototype;
            ['get', 'set', 'exists'].forEach(function (command) {
                assert(typeof proto[customMapper(command)] === 'function');
            });
            var mproto = redis.Multi.prototype;
            assert(typeof mproto[customMapper('exec')] === 'function');
        });
    });

    describe('with raw value', function () {
        var redis = require('../index')(require('redis'), {suffix: 'Raw', json: false});
        var client = redis.createClient();

        it('wraps all command methods for RedisClient and Multi', function () {
            var proto = redis.RedisClient.prototype;
            ['get', 'set', 'exists'].forEach(function (command) {
                assert(typeof proto[command + 'Raw'] === 'function');
            });
            var mproto = redis.Multi.prototype;
            assert(typeof mproto.execRaw === 'function');
        });

        it('should set and get', function (done) {
            client.setRaw('foo', 'FOO')
                .then(function (result) {
                    console.log('***set', result);
                    return client.getRaw('foo');
                })
                .then(function (result) {
                    console.log('***get', result);
                    assert(typeof result === 'string');
                    assert.equal(result, 'FOO');
                })
                .fail(assert.ifError)
                .done(done);
        });
        it('should mset and mget', function (done) {
            client.msetRaw('foo', 'FOO', 'bar', 'BAR', 'baz', ['BAZ', 123, true], 'qux', {str: 'QUX', num: 123, bool: true})
                .then(function (result) {
                    console.log('***mset', result);
                    return client.mgetRaw('foo', 'bar', 'baz', 'qux');
                })
                .then(function (result) {
                    console.log('***mget', result);
                    assert(result instanceof Array)
                    assert.equal(result[0], 'FOO');
                    assert.equal(result[1], 'BAR');
                    assert.equal(result[2], 'BAZ,123,true'); // NOTE!!!
                    assert.equal(result[3], '[object Object]'); // NOTE!!!
                })
                .fail(assert.ifError)
                .done(done);
        });
        it('should multi', function (done) {
            client.multi()
                .set('foo', 'FOO')
                .set('bar', 'BAR')
                .set('baz', ['BAZ', 123, true])// NOTE!!!
                .set('qux', {str: 'QUX', num: 123, bool: true}) // NOTE!!!
                .mget('foo', 'bar', 'baz', 'qux')
                .execRaw() // NOTE!!
                .then(function (results) {
                    console.log('***multi', results);
                    assert(results instanceof Array)
                    var result = results[4];
                    assert(result instanceof Array)
                    assert.equal(result[0], 'FOO');
                    assert.equal(result[1], 'BAR');
                    assert.equal(result[2], 'BAZ,123,true'); // NOTE!!!
                    assert.equal(result[3], '[object Object]'); // NOTE!!!
                })
                .fail(assert.ifError)
                .done(done);
        });
        it('should multi with spread', function (done) {
            client.multi()
                .set('foo', 'FOO')
                .set('bar', 'BAR')
                .set('baz', ['BAZ', 123, true])
                .set('qux', {str: 'QUX', num: 123, bool: true})
                .mget('foo', 'bar', 'baz', 'qux')
                .execRaw() // NOTE!!
                .spread(function (result1, result2, result3, result4, result) {
                    console.log('***multi with spread', arguments);
                    assert.equal(result1, 'OK');
                    assert.equal(result2, 'OK');
                    assert.equal(result3, 'OK');
                    assert.equal(result4, 'OK');
                    assert(result instanceof Array)
                    assert.equal(result[0], 'FOO');
                    assert.equal(result[1], 'BAR');
                    assert.equal(result[2], 'BAZ,123,true'); // NOTE!!!
                    assert.equal(result[3], '[object Object]'); // NOTE!!!
                })
                .fail(assert.ifError)
                .done(done);
        });
        it('should mset and mget with array notation', function (done) {
            // NOTE: [ ... ]
            client.msetRaw(['foo', 'FOO', 'bar', 'BAR', 'baz', ['BAZ', 123, true], 'qux', {str: 'QUX', num: 123, bool: true}])
                .then(function (result) {
                    // NOTE: [ ... ]
                    console.log('***mset', result);
                    return client.mgetRaw(['foo', 'bar', 'baz', 'qux']);
                })
                .then(function (result) {
                    console.log('***mget', result);
                    assert(result instanceof Array)
                    assert.equal(result[0], 'FOO');
                    assert.equal(result[1], 'BAR');
                    assert.equal(result[2], 'BAZ,123,true'); // NOTE!!!
                    assert.equal(result[3], '[object Object]'); // NOTE!!!
                })
                .fail(assert.ifError)
                .done(done);
        });
    });

    describe('with json value', function () {
        var redis = require('../index')(require('redis'), {suffix: 'Json', json: true});
        var client = redis.createClient();

        it('wraps all command methods for RedisClient and Multi', function () {
            var proto = redis.RedisClient.prototype;
            ['get', 'set', 'exists'].forEach(function (command) {
                assert(typeof proto[command + 'Json'] === 'function');
            });
            var mproto = redis.Multi.prototype;
            assert(typeof mproto.execJson === 'function');
        });

        it('should set and get', function (done) {
            var obj = {str: 'FOO', num: 123, bool: true};
            client.setJson('foo', obj)
                .then(function (result) {
                    console.log('***set', result);
                    return client.getJson('foo');
                })
                .then(function (result) {
                    console.log('***get', result);
                    assert(typeof result === 'object');
                    assert.equal(result.str, 'FOO');
                    assert.equal(result.num, 123);
                    assert.equal(result.bool, true);
                })
                .fail(assert.ifError)
                .done(done);
        });
        it('should set and get array value', function (done) {
            var obj = ['FOO', 123, true];
            client.setJson('foo', obj)
                .then(function (result) {
                    console.log('***set', result);
                    return client.getJson('foo');
                })
                .then(function (result) {
                    console.log('***get', result);
                    assert(result instanceof Array)
                    assert.equal(result[0], 'FOO');
                    assert.equal(result[1], 123);
                    assert.equal(result[2], true);
                })
                .fail(assert.ifError)
                .done(done);
        });
        it('should mset and mget', function (done) {
            client.msetJson('foo', 'FOO', 'bar', 'BAR', 'baz', ['BAZ', 123, true], 'qux', {str: 'QUX', num: 123, bool: true})
                .then(function (result) {
                    console.log('***mset', result);
                    return client.mgetJson('foo', 'bar', 'baz', 'qux');
                })
                .then(function (result) {
                    console.log('***mget', result);

                    assert(result instanceof Array)
                    assert.equal(result[0], 'FOO');
                    assert.equal(result[1], 'BAR');

                    var ary = result[2];
                    assert(ary instanceof Array);
                    assert.equal(ary[0], 'BAZ');
                    assert.equal(ary[1], 123);
                    assert.equal(ary[2], true);

                    var obj = result[3];
                    assert(typeof obj === 'object');
                    assert.equal(obj.str, 'QUX');
                    assert.equal(obj.num, 123);
                    assert.equal(obj.bool, true);
                })
                .fail(assert.ifError)
                .done(done);
        });
        it('should multi', function (done) {
            client.multi()
                .setJson('foo', 'FOO')
                .setJson('bar', 'BAR')
                .setJson('baz', ['BAZ', 123, true])
                .setJson('qux', {str: 'QUX', num: 123, bool: true})
                .mgetJson('foo', 'bar', 'baz', 'qux')
                .execJson()
                .then(function (results) {
                    console.log('***multi', results);
                    assert(results instanceof Array)
                    assert.equal(results[0], 'OK');
                    assert.equal(results[1], 'OK');
                    assert.equal(results[2], 'OK');
                    assert.equal(results[3], 'OK');

                    var result = results[4];
                    assert(result instanceof Array);
                    assert.equal(result[0], 'FOO');
                    assert.equal(result[1], 'BAR');

                    var ary = result[2];
                    assert(ary instanceof Array);
                    assert.equal(ary[0], 'BAZ');
                    assert.equal(ary[1], 123);
                    assert.equal(ary[2], true);

                    var obj = result[3];
                    assert(typeof obj === 'object');
                    assert.equal(obj.str, 'QUX');
                    assert.equal(obj.num, 123);
                    assert.equal(obj.bool, true);
                })
                .fail(assert.ifError)
                .done(done);
        });
        it('should multi with spread', function (done) {
            client.multi()
                .setJson('foo', 'FOO')
                .setJson('bar', 'BAR')
                .setJson('baz', ['BAZ', 123, true])
                .setJson('qux', {str: 'QUX', num: 123, bool: true})
                .mgetJson('foo', 'bar', 'baz', 'qux')
                .execJson() // NOTE!!
                .spread(function (result0, result1, result2, result3, result4) {
                    console.log('***multi with spread', arguments);
                    assert.equal(result0, 'OK');
                    assert.equal(result1, 'OK');
                    assert.equal(result2, 'OK');
                    assert.equal(result3, 'OK');

                    var result = result4;
                    assert(result instanceof Array);
                    assert.equal(result[0], 'FOO');
                    assert.equal(result[1], 'BAR');

                    var ary = result[2];
                    assert(ary instanceof Array);
                    assert.equal(ary[0], 'BAZ');
                    assert.equal(ary[1], 123);
                    assert.equal(ary[2], true);

                    var obj = result[3];
                    assert(typeof obj === 'object');
                    assert.equal(obj.str, 'QUX');
                    assert.equal(obj.num, 123);
                    assert.equal(obj.bool, true);
                })
                .fail(assert.ifError)
                .done(done);
        });

        // TODO: ... how can i distinguish "single array arg" vs "multiple args in a single array"??
        it.skip('should mset and mget with array notation', function (done) {
            // NOTE: [ ... ]
            client.msetJson(['foo', 'FOO', 'bar', 'BAR', 'baz', ['BAZ', 123, true], 'qux', {str: 'QUX', num: 123, bool: true}])
                .then(function (result) {
                    console.log('***mset', result);
                    // NOTE: [ ... ]
                    return client.mgetJson(['foo', 'bar', 'baz', 'qux']);
                })
                .then(function (result) {
                    console.log('***mget', result);

                    assert(result instanceof Array)
                    assert.equal(result[0], 'FOO');
                    assert.equal(result[1], 'BAR');

                    var ary = result[2];
                    assert(ary instanceof Array);
                    assert.equal(ary[0], 'BAZ');
                    assert.equal(ary[1], 123);
                    assert.equal(ary[2], true);

                    var obj = result[3];
                    assert(typeof obj === 'object');
                    assert.equal(obj.str, 'QUX');
                    assert.equal(obj.num, 123);
                    assert.equal(obj.bool, true);
                })
                .fail(assert.ifError)
                .done(done);
        });
    });
});
