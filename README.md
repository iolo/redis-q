redis-q
=======

[kriskowal's Q](http://documentup.com/kriskowal/q/) support for [node_redis](https://github.com/mranney/node_redis).

usage
-----

* to apply Q with default suffix 'Q':

```javascript
var redis = require('redis-q')(require('redis'));
// verbose way: redisQ is unused
var redis = require('redis'),
    redisQ = require('redis-q')(redis)
// shortest way: redis will be loaded by redis-q
var redis = require('redis-q')();
```

* use Q-applied `RedisClient` methods:

```javascript
var client = redis.createClient(...);
client.setQ(...)
  .then(function (result) { ... })
  .catch(function (err) { ... })
  .done();
```

* use Q-applied `Multi` methods:

```javascript
var client = redis.createClient(...);
client.multi()
  .set(...)
  .set(...)
  ...
  .execQ() // no 'Q' suffix for multi methods except for execQ()
  .then(function (result) { ... })
  .catch(function (err) { ... })
  .done();
```

* to apply Q with custom `suffix`/`prefix`:

```javascript
var redis = require('redis-q')(require('redis'), {prefix:'promiseOf_', suffix:'_withQ'});
var client = redis.createClient(...);
client.promiseOf_set_withQ(...)
  .then(function (result) { ... })
  .catch(function (err) { ... })
  .done();
```

* to apply Q with custom name `mapper`:

```javascript
function customMapper(name) {
  return 'q' + name.charAt(0).toUpperCase() + name.substring(1);
}
var redis = require('redis-q')(require('redis'), {mapper:customMapper});
var client = redis.createClient(...);
client.qSet(...)
  .then(function (result) { ... })
  .catch(function (err) { ... })
  .done();
```

* to apply Q with `multi` and `spread`:

```javascript
var redis = require('redis-q')(require('redis'));
var client = redis.createClient(...);
client.multi()
  .set(...) // command0 --> results[0]
  .set(...) // command1 --> results[1]
  ...       // ... commandN --> results[N]
  .execQ() // no 'Q' suffix for multi methods except for execQ()
  .then(function (results) { assert(results instanceof Array); }) // NOTE: then!
  .catch(function (err) { ... })
  .done();
```

```javascript
var redis = require('redis-q')(require('redis'));
var client = redis.createClient(...);
client.multi()
  .set(...) // command0 --> result0
  .set(...) // command1 --> result1
  ...       // ... commandN --> resultN
  .execQ() // no 'Q' suffix for multi methods except for execQ()
  .spread(function (result0, result1, ..., resultN) { ... }) // NOTE: spread!
  .catch(function (err) { ... })
  .done();
```

* **EXPERIMENTAL** to use JSON object for a value parameter/result with `json`:

```javascript
var redis = require('redis-q')(require('redis'), {json:true});
var client = redis.createClient(...);
client.setQ('a', {b:'c', d:'e'})
  .then(function (result) { return client.getQ('a'); })
  .then(function (result) { assert(result.b === 'c' && result.d === 'e'); ... })
  .catch(function (err) { ... })
  .done();
```

```javascript
var redis = require('redis-q')(require('redis'), {json:true});
var client = redis.createClient(...);
client.multi()
  .setQ(...) // NOTE: setQ not set
  .setQ(...)
  ...
  .execQ() // no 'Q' suffix for multi methods except for execQ()
  .then(function (results) { assert(results instanceof Array); })
  .catch(function (err) { ... })
  .done();
```

> TODO: `msetQ([a, b, ..., z])` style(multiple arguments(commands/parameters) in an array) is not working with 'json' option.

That's all folks!
