"use strict";

var paramify = require('paramify');
var merge    = require('utils-merge');
var url      = require('url');
var http     = require('http');

/**
 * Create HttpServer
 *
 * @returns {function}
 */
var createServer = module.exports = function createServer() {
  function app(req, res) {
    app.handle(req, res);
  }

  merge(app, HttpServer);

  app.stack      = [];
  app.errorRoute = defaultErrorRoute;

  return app;
};

/**
 * Default Error Route
 *
 * @param {Error}                err
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse}  res
 *
 */
var defaultErrorRoute = function(err, req, res) {
  if (!res.headersSent) {
    res.statusCode = err.status || 500;
    res.end();
  }
};

/**
 * Match
 *
 * If path matches req.url then bind match params
 * to req then call fn with req, res, next
 *
 * @param {String}               path
 * @param {Function}             fn
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse}  res
 * @param {Function}             next
 */
var match = function(path, fn, req, res, next) {
  var matches = paramify(req.url);

  if (matches(path)) {
    req.params = match.params;
    fn(req, res, next);
  } else {
    next();
  }
};

/**
 * @class HttpServer
 * @static
 */
var HttpServer = {};

/**
 * Handle Requests
 *
 * @method handle
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse}  res
 */
HttpServer.handle = function(req, res, next) {
  var n    = 0;
  var self = this;

  /**
   * Process the stack of routes & middleware
   * @inner
   */
  var run = function() {
    if (self.stack[n]) {
      self.stack[n++](req, res, function(err) {
        if (err && next) {
          next(err);
        } else if (err) {
          self.errorRoute(err, req, res);
        } else {
          run();
        }
      });
    } else {
      if (next) {
        next();
      } else {
        res.writeHead(404);
        res.end((req.method != 'HEAD') && 'Not Found' || '');
      }
    }
  };

  run();
};

/**
 * HttpServer VERB
 *
 * For method VERB (GET, POST, PUT, DEL, etc) HTTP requests for path use fn
 *
 * @param {string}          path specifies which requests should get routed to fn
 * @param {requestListener} fn   handles requests, gets args `(req, res, next)`
 */
HttpServer.verb = function(verb, path, fn) {
  this.stack.push(function(req, res, next) {
    if (req.method == verb) {
      match(path, fn, req, res, next);
    } else {
      next();
    }
  });
};

/**
 * HttpServer all
 *
 * For all HTTP methods' requests for path use fn
 *
 * @param {string}          path specifies which requests should get routed to fn
 * @param {requestListener} fn   handles requests, gets args `(req, res, next)`
 */
HttpServer.all = function(path, fn) {
  this.stack.push(function(req, res, next) {
    match(path, fn, req, res, next);
  });
};

/**
 * HttpServer use
 *
 * Use middleware
 *
 * @param {requestListener} fn handles requests, gets args `(req, res, next)`
 */
HttpServer.use = function(fn) {
  this.stack.push(fn);
};

/**
 * HttpServer listen
 *
 * Listen on port
 *
 * @param {natural}  port specifies which port to listen on
 * @param {function} fn   callback for once server is listening
 */
HttpServer.listen = function(port, fn) {
  http.createServer(this).listen(port, fn);
};

/* default verbs (get, put, post, delete (-> del), options, head */
var verbify = function(verb) {
  return function() {
    HttpServer.verb.apply(this, [verb].concat(Array.prototype.slice.call(arguments)));
  };
};

HttpServer.get     = verbify('GET');
HttpServer.put     = verbify('PUT');
HttpServer.post    = verbify('POST');
HttpServer.del     = verbify('DELETE');
HttpServer.options = verbify('OPTIONS');
HttpServer.head    = verbify('HEAD');
