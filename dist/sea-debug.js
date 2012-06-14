/* SeaJS v1.2.0 | seajs.org | MIT Licensed */

/**
 * @fileoverview A Module Loader for the Web.
 * @author lifesinger@gmail.com (Frank Wang)
 */


/**
 * Base namespace for the framework.
 */
var seajs = { _seajs: seajs };


/**
 * @type {string} The version of the framework. It will be replaced
 * with "major.minor.patch" when building.
 */
seajs.version = '1.2.0';


/**
 * The private utilities. Internal use only.
 */
seajs._util = {};


/**
 * The private data. Internal use only.
 */
seajs._data = {

  /**
   * The configuration data.
   */
  config: {
    /**
     * Debug mode. It will be turned off automatically when compressing.
     * @const
     */
    debug: '%DEBUG%',

    /**
     * Modules that are needed to load before all other modules.
     */
    preload: []
  },

  /**
   * Modules that have been memoize()d.
   * { uri: { dependencies: [], factory: fn, exports: {} }, ... }
   */
  memoizedMods: {},

  /**
   * Modules in current fetching package.
   */
  packageMods: []
};


/**
 * The inner namespace for methods. Internal use only.
 */
seajs._fn = {};

/**
 * @fileoverview The minimal language enhancement.
 */

(function(util) {

  var toString = Object.prototype.toString;
  var AP = Array.prototype;


  util.isString = function(val) {
    return toString.call(val) === '[object String]';
  };


  util.isFunction = function(val) {
    return toString.call(val) === '[object Function]';
  };


  util.isRegExp = function(val) {
    return toString.call(val) === '[object RegExp]';
  };


  util.isObject = function(val) {
    return val === Object(val);
  };


  util.isArray = Array.isArray || function(val) {
    return toString.call(val) === '[object Array]';
  };


  util.indexOf = AP.indexOf ?
      function(arr, item) {
        return arr.indexOf(item);
      } :
      function(arr, item) {
        for (var i = 0, len = arr.length; i < len; i++) {
          if (arr[i] === item) {
            return i;
          }
        }
        return -1;
      };


  var forEach = util.forEach = AP.forEach ?
      function(arr, fn) {
        arr.forEach(fn);
      } :
      function(arr, fn) {
        for (var i = 0, len = arr.length; i < len; i++) {
          fn(arr[i], i, arr);
        }
      };


  util.map = AP.map ?
      function(arr, fn) {
        return arr.map(fn);
      } :
      function(arr, fn) {
        var ret = [];
        forEach(arr, function(item, i, arr) {
          ret.push(fn(item, i, arr));
        });
        return ret;
      };


  util.filter = AP.filter ?
      function(arr, fn) {
        return arr.filter(fn);
      } :
      function(arr, fn) {
        var ret = [];
        forEach(arr, function(item, i, arr) {
          if (fn(item, i, arr)) {
            ret.push(item);
          }
        });
        return ret;
      };


  util.unique = function(arr) {
    var ret = [];
    var o = {};

    forEach(arr, function(item) {
      o[item] = 1;
    });

    if (Object.keys) {
      ret = Object.keys(o);
    }
    else {
      for (var p in o) {
        if (o.hasOwnProperty(p)) {
          ret.push(p);
        }
      }
    }

    return ret;
  };


  util.now = Date.now || function() {
    return new Date().getTime();
  };

})(seajs._util);

/**
 * @fileoverview The tiny console support.
 */

(function(util, data) {


  util.log = function() {
    if (data.config.debug && typeof console !== 'undefined') {
      console.log(join(arguments));
    }
  };


  // Helpers
  // -------

  function join(args) {
    return Array.prototype.join.call(args, ' ');
  }

})(seajs._util, seajs._data);

/**
 * @fileoverview Path utilities for the framework.
 */

(function(util, data, fn, global) {

  var config = data.config;

  var DIRNAME_RE = /.*(?=\/.*$)/;
  var MULTIPLE_SLASH_RE = /([^:\/])\/\/+/g;
  var FILE_EXT_RE = /\.(?:css|js)$/;
  var ROOT_RE = /^(.*?\w)(?:\/|$)/;


  /**
   * Extracts the directory portion of a path.
   * dirname('a/b/c.js') ==> 'a/b/'
   * dirname('d.js') ==> './'
   * @see http://jsperf.com/regex-vs-split/2
   */
  function dirname(path) {
    var s = path.match(DIRNAME_RE);
    return (s ? s[0] : '.') + '/';
  }


  /**
   * Canonicalizes a path.
   * realpath('./a//b/../c') ==> 'a/c'
   */
  function realpath(path) {
    // 'file:///a//b/c' ==> 'file:///a/b/c'
    // 'http://a//b/c' ==> 'http://a/b/c'
    if (MULTIPLE_SLASH_RE.test(path)) {
      MULTIPLE_SLASH_RE.lastIndex = 0;
      path = path.replace(MULTIPLE_SLASH_RE, '$1\/');
    }

    // 'a/b/c', just return.
    if (path.indexOf('.') === -1) {
      return path;
    }

    var original = path.split('/');
    var ret = [], part;

    for (var i = 0, len = original.length; i < len; i++) {
      part = original[i];

      if (part === '..') {
        if (ret.length === 0) {
          throw new Error('The path is invalid: ' + path);
        }
        ret.pop();
      }
      else if (part !== '.') {
        ret.push(part);
      }
    }

    return ret.join('/');
  }


  /**
   * Normalizes an url.
   */
  function normalize(url) {
    url = realpath(url);

    // Adds the default '.js' extension except that the url ends with #.
    // ref: http://jsperf.com/get-the-last-character
    if (url.charAt(url.length - 1) === '#') {
      url = url.slice(0, -1);
    }
    else if (url.indexOf('?') === -1 && !FILE_EXT_RE.test(url)) {
      url += '.js';
    }

    return url;
  }


  /**
   * Parses alias in the module id. Only parse the first part.
   */
  function parseAlias(id) {
    // #xxx means xxx is already alias-parsed.
    if (id.charAt(0) === '#') {
      return id.substring(1);
    }

    var alias = config.alias;

    // Only top-level id needs to parse alias.
    if (alias && isTopLevel(id)) {
      var parts = id.split('/');
      var first = parts[0];

      if (alias.hasOwnProperty(first)) {
        parts[0] = alias[first];
        id = parts.join('/');
      }
    }

    return id;
  }


  var mapCache = {};

  /**
   * Converts the url according to the map rules.
   * @param {string} url The url string.
   * @param {Array=} map The optional map array.
   */
  function parseMap(url, map) {
    // map: [[match, replace], ...]
    map || (map = config.map || []);
    if (!map.length) return url;

    var ret = url;

    // Apply all matched rules in sequence.
    for (var i = 0, len = map.length; i < len; i++) {
      var rule = map[i];

      if (rule && rule.length > 1) {
        var m = rule[0];

        if (util.isString(m) && ret.indexOf(m) > -1 ||
            util.isRegExp(m) && m.test(ret)) {
          ret = ret.replace(m, rule[1]);
        }
      }
    }

    if (ret !== url) {
      mapCache[ret] = url;
    }

    return ret;
  }


  /**
   * Gets the original url.
   * @param {string} url The url string.
   */
  function unParseMap(url) {
    return mapCache[url] || url;
  }


  /**
   * Converts id to uri.
   * @param {string} id The module id.
   * @param {string=} refUrl The referenced uri for relative id.
   */
  function id2Uri(id, refUrl) {
    id = parseAlias(id);
    refUrl || (refUrl = pageUrl);

    var ret;

    // absolute id
    if (isAbsolute(id)) {
      ret = id;
    }
    // relative id
    else if (isRelative(id)) {
      // Converts './a' to 'a', to avoid unnecessary loop in realpath.
      if (id.indexOf('./') === 0) {
        id = id.substring(2);
      }
      ret = dirname(refUrl) + id;
    }
    // root id
    else if (isRoot(id)) {
      ret = refUrl.match(ROOT_RE)[1] + id;
    }
    // top-level id
    else {
      ret = config.base + '/' + id;
    }

    return normalize(ret);
  }


  function isAbsolute(id) {
    return id.indexOf('://') > 0 || id.indexOf('//') === 0;
  }


  function isRelative(id) {
    return id.indexOf('./') === 0 || id.indexOf('../') === 0;
  }


  function isRoot(id) {
    return id.charAt(0) === '/' && id.charAt(1) !== '/';
  }


  function isTopLevel(id) {
    var c = id.charAt(0);
    return id.indexOf('://') === -1 && c !== '.' && c !== '/';
  }


  /**
   * Normalizes pathname to start with '/'
   * Ref: https://groups.google.com/forum/#!topic/seajs/9R29Inqk1UU
   */
  function normalizePathname(pathname) {
    if (pathname.charAt(0) !== '/') {
      pathname = '/' + pathname;
    }
    return pathname;
  }


  var loc = global['location'];
  var pageUrl = loc.protocol + '//' + loc.host +
      normalizePathname(loc.pathname);

  // local file in IE: C:\path\to\xx.js
  if (pageUrl.indexOf('\\') > 0) {
    pageUrl = pageUrl.replace(/\\/g, '/');
  }


  util.dirname = dirname;
  util.realpath = realpath;
  util.normalize = normalize;

  util.parseAlias = parseAlias;
  util.parseMap = parseMap;
  util.unParseMap = unParseMap;

  util.id2Uri = id2Uri;
  util.isAbsolute = isAbsolute;
  util.isTopLevel = isTopLevel;

  util.pageUrl = pageUrl;

})(seajs._util, seajs._data, seajs._fn, this);

/**
 * @fileoverview Utilities for fetching js ans css files.
 */

(function(util, data, global) {

  var config = data.config;

  var head = document.head ||
      document.getElementsByTagName('head')[0] ||
      document.documentElement;

  var UA = navigator.userAgent;
  var isWebKit = UA.indexOf('AppleWebKit') > 0;

  var IS_CSS_RE = /\.css(?:\?|$)/i;
  var READY_STATE_RE = /loaded|complete|undefined/;


  util.getAsset = function(url, callback, charset) {
    var isCSS = IS_CSS_RE.test(url);
    var node = document.createElement(isCSS ? 'link' : 'script');

    if (charset) {
      var cs = util.isFunction(charset) ? charset(url) : charset;
      if (cs) {
        node.charset = cs;
      }
    }

    assetOnload(node, callback);

    if (isCSS) {
      node.rel = 'stylesheet';
      node.href = url;
      head.appendChild(node); // Keep style cascading order
    }
    else {
      node.async = 'async';
      node.src = url;

      // For some cache cases in IE 6-9, the script executes IMMEDIATELY after
      // the end of the insertBefore execution, so use `currentlyAddingScript`
      // to hold current node, for deriving url in `define`.
      currentlyAddingScript = node;
      head.insertBefore(node, head.firstChild);
      currentlyAddingScript = null;
    }
  };

  function assetOnload(node, callback) {
    if (node.nodeName === 'SCRIPT') {
      scriptOnload(node, cb);
    } else {
      styleOnload(node, cb);
    }

    var timer = setTimeout(function() {
      util.log('Time is out:', node.src);
      cb();
    }, config.timeout);

    function cb() {
      if (!cb.isCalled) {
        cb.isCalled = true;
        clearTimeout(timer);
        callback();
      }
    }
  }

  function scriptOnload(node, callback) {

    node.onload = node.onerror = node.onreadystatechange = function() {
      if (READY_STATE_RE.test(node.readyState)) {

        // Ensure only run once
        node.onload = node.onerror = node.onreadystatechange = null;

        // Reduce memory leak
        if (node.parentNode) {
          try {
            if (node.clearAttributes) {
              node.clearAttributes();
            }
            else {
              for (var p in node) delete node[p];
            }
          } catch (x) {
          }

          // Remove the script
          if (!config.debug) {
            head.removeChild(node);
          }
        }

        // Dereference the node
        node = undefined;

        callback();
      }
    };

    // NOTICE:
    // Nothing will happen in Opera when the file status is 404. In this case,
    // the callback will be called when time is out.
  }

  function styleOnload(node, callback) {

    // for IE6-9 and Opera
    if (global.hasOwnProperty('attachEvent')) { // see #208
      node.attachEvent('onload', callback);
      // NOTICE:
      // 1. "onload" will be fired in IE6-9 when the file is 404, but in
      //    this situation, Opera does nothing, so fallback to timeout.
      // 2. "onerror" doesn't fire in any browsers!
    }

    // Polling for Firefox, Chrome, Safari
    else {
      setTimeout(function() {
        poll(node, callback);
      }, 0); // Begin after node insertion
    }

  }

  function poll(node, callback) {
    if (callback.isCalled) {
      return;
    }

    var isLoaded;

    if (isWebKit) {
      if (node['sheet']) {
        isLoaded = true;
      }
    }
    // for Firefox
    else if (node['sheet']) {
      try {
        if (node['sheet'].cssRules) {
          isLoaded = true;
        }
      } catch (ex) {
        if (ex.name === 'SecurityError' || // firefox >= 13.0
            ex.name === 'NS_ERROR_DOM_SECURITY_ERR') { // old firefox
          isLoaded = true;
        }
      }
    }

    setTimeout(function() {
      if (isLoaded) {
        // Place callback in here due to giving time for style rendering.
        callback();
      } else {
        poll(node, callback);
      }
    }, 1);
  }


  var currentlyAddingScript;
  var interactiveScript;

  util.getCurrentScript = function() {
    if (currentlyAddingScript) {
      return currentlyAddingScript;
    }

    // For IE6-9 browsers, the script onload event may not fire right
    // after the the script is evaluated. Kris Zyp found that it
    // could query the script nodes and the one that is in "interactive"
    // mode indicates the current script.
    // Ref: http://goo.gl/JHfFW
    if (interactiveScript &&
        interactiveScript.readyState === 'interactive') {
      return interactiveScript;
    }

    var scripts = head.getElementsByTagName('script');

    for (var i = 0; i < scripts.length; i++) {
      var script = scripts[i];
      if (script.readyState === 'interactive') {
        interactiveScript = script;
        return script;
      }
    }
  };


  util.getScriptAbsoluteSrc = function(node) {
    return node.hasAttribute ? // non-IE6/7
        node.src :
        // see http://msdn.microsoft.com/en-us/library/ms536429(VS.85).aspx
        node.getAttribute('src', 4);
  };

})(seajs._util, seajs._data, this);

/**
 * References:
 *  - http://unixpapa.com/js/dyna.html
 *  - ../test/research/load-js-css/test.html
 *  - ../test/issues/load-css/test.html
 *  - http://www.blaze.io/technical/ies-premature-execution-problem/
 */

/**
 * @fileoverview Module constructor.
 */

(function(fn) {

  /**
   * Module constructor.
   * @constructor
   * @param {string=} id The module id.
   * @param {Array.<string>|string=} deps The module dependencies.
   * @param {function()|Object} factory The module factory function.
   */
  fn.Module = function(id, deps, factory) {

    this.id = id;
    this.dependencies = deps || [];
    this.factory = factory;

  };

})(seajs._fn);

/**
 * @fileoverview Module authoring format.
 */

(function(util, data, fn) {

  /**
   * Defines a module.
   * @param {string=} id The module id.
   * @param {Array.<string>|string=} deps The module dependencies.
   * @param {function()|Object} factory The module factory function.
   */
  fn.define = function(id, deps, factory) {
    var argsLen = arguments.length;

    // define(factory)
    if (argsLen === 1) {
      factory = id;
      id = undefined;
    }
    // define(id || deps, factory)
    else if (argsLen === 2) {
      factory = deps;
      deps = undefined;

      // define(deps, factory)
      if (util.isArray(id)) {
        deps = id;
        id = undefined;
      }
    }

    // Parse dependencies
    if (!util.isArray(deps) && util.isFunction(factory)) {
      deps = parseDependencies(factory.toString());
    }

    // Get url directly for specific modules.
    if (id) {
      var uri = util.id2Uri(id);
    }
    // Try to derive url in IE6-9 for anonymous modules.
    else if (document.attachEvent) {

      // Try to get the current script
      var script = util.getCurrentScript();
      if (script) {
        uri = util.unParseMap(util.getScriptAbsoluteSrc(script));
      }

      if (!uri) {
        util.log('Failed to derive URL from interactive script for:',
            factory.toString());

        // NOTE: If the id-deriving methods above is failed, then falls back
        // to use onload event to get the url.
      }
    }

    var mod = new fn.Module(id, deps, factory);

    if (uri) {
      util.memoize(uri, mod);
      data.packageMods.push(mod);
    }
    else {
      // Saves information for "memoizing" work in the onload event.
      data.anonymousMod = mod;
    }

  }


  // Helpers
  // -------

  var DEPS_RE = /(?:^|[^.$])\brequire\s*\(\s*(["'])([^"'\s\)]+)\1\s*\)/g;
  var BLOCK_COMMENT_RE = /(?:^|\n|\r)\s*\/\*[\s\S]*?\*\/\s*(?:\r|\n|$)/g;
  var LINE_COMMENT_RE = /(?:^|\n|\r)\s*\/\/.*(?:\r|\n|$)/g;


  function parseDependencies(code) {
    // Parse these `requires`:
    //   var a = require('a');
    //   someMethod(require('b'));
    //   require('c');
    //   ...
    // Doesn't parse:
    //   someInstance.require(...);
    var ret = [], match;

    code = removeComments(code);
    DEPS_RE.lastIndex = 0;

    while ((match = DEPS_RE.exec(code))) {
      if (match[2]) {
        ret.push(match[2]);
      }
    }

    return util.unique(ret);
  }


  // http://lifesinger.github.com/lab/2011/remove-comments-safely/
  function removeComments(code) {
    BLOCK_COMMENT_RE.lastIndex = 0;
    LINE_COMMENT_RE.lastIndex = 0;

    return code
        .replace(BLOCK_COMMENT_RE, '\n')
        .replace(LINE_COMMENT_RE, '\n');
  }

})(seajs._util, seajs._data, seajs._fn);

/**
 * @fileoverview The factory for "require".
 */

(function(util, data, fn) {

  var slice = Array.prototype.slice;
  var RP = Require.prototype;


  /**
   * the require constructor function
   * @param {string} id The module id.
   */
  function Require(id) {
    var context = this.context;
    var uri, mod;

    // require(mod) ** inner use ONLY.
    if (util.isObject(id)) {
      mod = id;
      uri = mod.id;
    }
    // NOTICE: id maybe undefined in 404 etc cases.
    else if (util.isString(id)) {
      uri = RP.resolve(id, context);
      mod = data.memoizedMods[uri];
    }

    // Just return null when:
    //  1. the module file is 404.
    //  2. the module file is not written with valid module format.
    //  3. other error cases.
    if (!mod) {
      return null;
    }

    // Checks circular dependencies.
    if (isCircular(context, uri)) {
      util.log('Found circular dependencies:', uri);
      return mod.exports;
    }

    // Initializes module exports.
    if (!mod.exports) {
      initExports(mod, {
        uri: uri,
        parent: context
      });
    }

    return mod.exports;
  }


  /**
   * Use the internal require() machinery to look up the location of a module,
   * but rather than loading the module, just return the resolved filepath.
   *
   * @param {string|Array.<string>} ids The module ids to be resolved.
   * @param {Object=} context The context of require function.
   */
  RP.resolve = function(ids, context) {
    if (util.isString(ids)) {
      return util.id2Uri(ids, (context || this.context || {}).uri);
    }

    return util.map(ids, function(id) {
      return RP.resolve(id, context);
    });
  };


  /**
   * Loads the specified modules asynchronously and execute the optional
   * callback when complete.
   * @param {Array.<string>} ids The specified modules.
   * @param {function(*)=} callback The optional callback function.
   */
  RP.async = function(ids, callback) {
    fn.load(ids, callback, this.context);
  };


  /**
   * Plugin can override this method to add custom loading.
   */
  RP.load = function(uri, callback, charset) {
    util.getAsset(uri, callback, charset);
  };


  /**
   * The factory of "require" function.
   * @param {Object} context The data related to "require" instance.
   */
  function createRequire(context) {
    // context: {
    //   uri: '',
    //   parent: context
    // }
    var that = { context: context || {} };

    function require(id) {
      return Require.call(that, id);
    }

    require.constructor = Require;

    for (var p in RP) {
      if (RP.hasOwnProperty(p)) {
        (function(name) {
          require[name] = function() {
            return RP[name].apply(that, slice.call(arguments));
          };
        })(p);
      }
    }

    return require;
  }


  function initExports(mod, context) {
    var ret;
    var factory = mod.factory;

    mod.exports = {};
    delete mod.factory;
    delete mod.ready;

    if (util.isFunction(factory)) {
      ret = factory(createRequire(context), mod.exports, mod);
      if (ret !== undefined) {
        mod.exports = ret;
      }
    }
    else if (factory !== undefined) {
      mod.exports = factory;
    }
  }


  function isCircular(context, uri) {
    if (context.uri === uri) {
      return true;
    }
    if (context.parent) {
      return isCircular(context.parent, uri);
    }
    return false;
  }


  fn.Require = Require;
  fn.createRequire = createRequire;

})(seajs._util, seajs._data, seajs._fn);

/**
 * @fileoverview Loads a module and gets it ready to be require()d.
 */

(function(util, data, fn) {

  var memoizedMods = data.memoizedMods;
  var config = data.config;
  var RP = fn.Require.prototype;


  // Module status:
  //  1. downloaded - The script file has been downloaded to the browser.
  //  2. define()d - The define() has been executed.
  //  3. memoize()d - The module info has been added to memoizedMods.
  //  4. require()d -  The module.exports is available.


  /**
   * Loads preload modules before callback.
   * @param {function()} callback The callback function.
   */
  function preload(callback) {
    var preloadMods = config.preload;

    if (preloadMods.length) {
      load(preloadMods, function() {
        config.preload = [];
        callback();
      });
    }
    else {
      callback();
    }
  }


  /**
   * Loads modules to the environment.
   * @param {Array.<string>} ids An array composed of module id.
   * @param {function(*)=} callback The callback function.
   * @param {Object=} context The context of current executing environment.
   */
  function load(ids, callback, context) {
    if (util.isString(ids)) {
      ids = [ids];
    }
    var uris = RP.resolve(ids, context);

    provide(uris, function() {
      var require = fn.createRequire(context);

      var args = util.map(uris, function(uri) {
        return require(data.memoizedMods[uri]);
      });

      if (callback) {
        callback.apply(null, args);
      }
    });
  }


  /**
   * Provides modules to the environment.
   * @param {Array.<string>} uris An array composed of module uri.
   * @param {function()=} callback The callback function.
   */
  function provide(uris, callback) {
    var unReadyUris = getUnReadyUris(uris);

    if (unReadyUris.length === 0) {
      return onProvide();
    }

    for (var i = 0, n = unReadyUris.length, remain = n; i < n; i++) {
      (function(uri) {

        if (memoizedMods[uri]) {
          onLoad();
        } else {
          fetch(uri, onLoad);
        }

        function onLoad() {
            var mod = memoizedMods[uri];

            if (mod) {
              var deps = mod.dependencies;

              if (deps.length) {
                // Converts deps to absolute id.
                deps = mod.dependencies = RP.resolve(deps, {
                  uri: mod.id
                });
              }

              var m = deps.length;

              if (m) {
                // if a -> [b -> [c -> [a, e], d]]
                // when use(['a', 'b'])
                // should remove a from c.deps
                deps = removeCyclicWaitingUris(uri, deps);
                m = deps.length;
              }

              if (m) {
                remain += m;
                provide(deps, function() {
                  remain -= m;
                  if (remain === 0) onProvide();
                });
              }
            }

            if (--remain === 0) onProvide();
        }

      })(unReadyUris[i]);
    }

    function onProvide() {
      setReadyState(unReadyUris);
      callback();
    }
  }


  var fetchingList = {};
  var fetchedList = {};
  var callbackList = {};

  /**
   * Fetches a module file.
   * @param {string} uri The module uri.
   * @param {function()} callback The callback function.
   */
  function fetch(uri, callback) {
    var srcUrl = util.parseMap(uri);

    if (fetchedList[srcUrl]) {
      callback();
      return;
    }

    if (fetchingList[srcUrl]) {
      callbackList[srcUrl].push(callback);
      return;
    }

    fetchingList[srcUrl] = true;
    callbackList[srcUrl] = [callback];

    RP.load(
        srcUrl,

        function() {
          fetchedList[srcUrl] = true;

          // Memoize anonymous module
          var mod = data.anonymousMod;
          if (mod) {
            // Don't override existed module
            if (!memoizedMods[uri]) {
              memoize(uri, mod);
            }
            data.anonymousMod = null;
          }

          // Assign the first module in package to memoizeMos[uri]
          // See: test/issues/un-correspondence
          mod = data.packageMods[0];
          if (mod && !memoizedMods[uri]) {
            memoizedMods[uri] = mod;
          }
          data.packageMods = [];

          // Clear
          if (fetchingList[srcUrl]) {
            delete fetchingList[srcUrl];
          }

          // Call callbackList
          if (callbackList[srcUrl]) {
            util.forEach(callbackList[srcUrl], function(fn) {
              fn();
            });
            delete callbackList[srcUrl];
          }

        },

        data.config.charset
    );
  }


  // Helpers

  /**
   * Caches mod info to memoizedMods.
   */
  function memoize(uri, mod) {
    mod.id = uri; // change id to the absolute path.
    memoizedMods[uri] = mod;
  }

  /**
   * Set mod.ready to true when all the requires of the module is loaded.
   */
  function setReadyState(uris) {
    util.forEach(uris, function(uri) {
      if (memoizedMods[uri]) {
        memoizedMods[uri].ready = true;
      }
    });
  }

  /**
   * Removes the "ready = true" uris from input.
   */
  function getUnReadyUris(uris) {
    return util.filter(uris, function(uri) {
      var mod = memoizedMods[uri];
      return !mod || !mod.ready;
    });
  }

  /**
   * if a -> [b -> [c -> [a, e], d]]
   * call removeMemoizedCyclicUris(c, [a, e])
   * return [e]
   */
  function removeCyclicWaitingUris(uri, deps) {
    return util.filter(deps, function(dep) {
      return !isCyclicWaiting(memoizedMods[dep], uri);
    });
  }

  function isCyclicWaiting(mod, uri) {
    if (!mod || mod.ready) return false;

    var deps = mod.dependencies || [];
    if (deps.length) {
      if (util.indexOf(deps, uri) > -1) {
        return true;
      }
      else {
        for (var i = 0; i < deps.length; i++) {
          if (isCyclicWaiting(memoizedMods[deps[i]], uri)) {
            return true;
          }
        }
        return false;
      }
    }

    return false;
  }


  util.memoize = memoize;
  fn.preload = preload;
  fn.load = load;

})(seajs._util, seajs._data, seajs._fn);

/**
 * @fileoverview The configuration.
 */

(function(host, util, data, fn) {

  var config = data.config;

  var noCachePrefix = 'seajs-ts=';
  var noCacheTimeStamp = noCachePrefix + util.now();


  // Async inserted script.
  var loaderScript = document.getElementById('seajsnode');

  // Static script.
  if (!loaderScript) {
    var scripts = document.getElementsByTagName('script');
    loaderScript = scripts[scripts.length - 1];
  }

  var loaderSrc = util.getScriptAbsoluteSrc(loaderScript) ||
      util.pageUrl; // When sea.js is inline, set base to pageUrl.

  var base = util.dirname(loaderSrc);
  util.loaderDir = base;

  // When src is "http://test.com/libs/seajs/1.0.0/sea.js", redirect base
  // to "http://test.com/libs/"
  var match = base.match(/^(.+\/)seajs\/[\d\.]+\/$/);
  if (match) {
    base = match[1];
  }

  config.base = base;


  var dataMain = loaderScript.getAttribute('data-main');
  if (dataMain) {
    // data-main="abc" is equivalent to data-main="./abc"
    if (util.isTopLevel(dataMain)) {
      dataMain = './' + dataMain;
    }
    config.main = dataMain;
  }


  // The max time to load a script file.
  config.timeout = 20000;


  /**
   * The function to configure the framework.
   * config({
   *   'base': 'path/to/base',
   *   'alias': {
   *     'app': 'biz/xx',
   *     'jquery': 'jquery-1.5.2',
   *     'cart': 'cart?t=20110419'
   *   },
   *   'map': [
   *     ['test.cdn.cn', 'localhost']
   *   ],
   *   preload: [],
   *   charset: 'utf-8',
   *   timeout: 20000, // 20s
   *   debug: false
   * });
   *
   * @param {Object} o The config object.
   */
  fn.config = function(o) {
    for (var k in o) {
      var previous = config[k];
      var current = o[k];

      if (previous && k === 'alias') {
        for (var p in current) {
          if (current.hasOwnProperty(p)) {
            checkAliasConflict(previous[p], current[p]);
            previous[p] = current[p];
          }
        }
      }
      else if (previous && (k === 'map' || k === 'preload')) {
        // for config({ preload: 'some-module' })
        if (!util.isArray(current)) {
          current = [current];
        }
        util.forEach(current, function(item) {
          if (item) { // Ignore empty string.
            previous.push(item);
          }
        });
        // NOTICE: no need to check conflict for map and preload.
      }
      else {
        config[k] = current;
      }
    }

    // Make sure config.base is absolute path.
    var base = config.base;
    if (base && !util.isAbsolute(base)) {
      config.base = util.id2Uri('./' + base + '#');
    }

    // Use map to implement nocache
    if (config.debug === 2) {
      config.debug = 1;
      fn.config({
        map: [
          [/.*/, function(url) {
            if (url.indexOf(noCachePrefix) === -1) {
              url += (url.indexOf('?') === -1 ? '?' : '&') + noCacheTimeStamp;
            }
            return url;
          }]
        ]
      });
    }

    // Sync
    if (config.debug) {
      host.debug = config.debug;
    }

    return this;
  };


  function checkAliasConflict(previous, current) {
    if (previous && previous !== current) {
      throw new Error('Alias is conflicted: ' + current);
    }
  }

})(seajs, seajs._util, seajs._data, seajs._fn);

/**
 * @fileoverview Prepare for plugins environment.
 */

(function(data, util, fn, global) {

  var config = data.config;


  // register plugin names
  var alias = {};
  var loaderDir = util.loaderDir;

  util.forEach(
      ['base', 'map', 'text', 'json', 'coffee', 'less'],
      function(name) {
        name = 'plugin-' + name;
        alias[name] = loaderDir + name;
      });

  fn.config({
    alias: alias
  });


  // handle seajs-debug
  if (~global.location.search.indexOf('seajs-debug') ||
      ~document.cookie.indexOf('seajs=1')) {
    fn.config({ debug: 2 });
    config.preload.push('plugin-map');
  }


})(seajs._data, seajs._util, seajs._fn, this);

/**
 * @fileoverview The bootstrap and entrances.
 */

(function(host, data, fn) {

  /**
   * Loads modules to the environment.
   * @param {Array.<string>} ids An array composed of module id.
   * @param {function(*)=} callback The callback function.
   */
  fn.use = function(ids, callback) {
    fn.preload(function() {
      fn.load(ids, callback);
    });
  };


  // data-main
  var mainModuleId = data.config.main;
  if (mainModuleId) {
    fn.use([mainModuleId]);
  }


  // Parses the pre-call of seajs.config/seajs.use/define.
  // Ref: test/bootstrap/async-3.html
  (function(args) {
    if (args) {
      var hash = {
        0: 'config',
        1: 'use',
        2: 'define'
      };
      for (var i = 0; i < args.length; i += 2) {
        fn[hash[args[i]]].apply(host, args[i + 1]);
      }
      delete host._seajs;
    }
  })((host._seajs || 0)['args']);

})(seajs, seajs._data, seajs._fn);

/**
 * @fileoverview The public api of seajs.
 */

(function(host, data, fn, global) {

  // Avoids conflicting when sea.js is loaded multi times.
  if (host._seajs) {
    global.seajs = host._seajs;
    return;
  }

  // SeaJS Loader API:
  host.config = fn.config;
  host.use = fn.use;

  // Module Authoring API:
  var previousDefine = global.define;
  global.define = fn.define;


  // For custom loader name.
  host.noConflict = function(all) {
    global.seajs = host._seajs;
    if (all) {
      global.define = previousDefine;
      host.define = fn.define;
    }
    return host;
  };


  // Keep for plugin developers.
  host.pluginSDK = {
    util: host._util,
    data: host._data
  };


  // For debug.
  var debug = data.config.debug;
  if (debug) {
    host.debug = !!debug;
  }


  // Keeps clean!
  delete host._util;
  delete host._data;
  delete host._fn;
  delete host._seajs;

})(seajs, seajs._data, seajs._fn, this);
