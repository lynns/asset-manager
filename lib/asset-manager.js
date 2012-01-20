(function() {
  var assets, async, builtAssets, expandPath, expandPaths, extractMediaType, extractRequestPaths, fs, glob, init, path, paths, precompile, resolveAsset, resolvers;

  async = require('async');

  assets = require('connect-assets');

  glob = require('glob');

  fs = require('fs');

  path = require('path');

  builtAssets = '';

  paths = [];

  resolvers = [];

  init = function(config, cb) {
    var _ref;
    builtAssets = (_ref = config.builtAssets) != null ? _ref : 'builtAssets';
    return expandPaths(config.paths, function() {
      var mw, path, resolver, _i, _len, _ref2, _ref3;
      console.log("Asset Resolution Paths:");
      console.dir(paths);
      for (_i = 0, _len = paths.length; _i < _len; _i++) {
        path = paths[_i];
        resolver = {
          'path': path
        };
        mw = assets({
          src: resolver.path,
          build: (_ref2 = config.inProd) != null ? _ref2 : false,
          helperContext: resolver,
          buildDir: builtAssets,
          servePath: (_ref3 = config.servePath) != null ? _ref3 : ''
        });
        if (config.use) config.use(mw);
        resolvers.push(resolver);
      }
      global.css = extractMediaType();
      global.js = resolveAsset('js');
      global.img = resolveAsset('img');
      if (cb) return cb();
    });
  };

  precompile = function(config, cb) {
    return init(config, function() {
      var fullPattern, options, pattern;
      options = {
        stat: true,
        strict: true
      };
      pattern = '**/*.*';
      fullPattern = paths.join("/" + pattern + ",") + ("/" + pattern);
      return glob("{" + fullPattern + "}", options, function(er, files) {
        var manifest;
        if (er) {
          console.log("Error: " + er);
          return;
        }
        manifest = {};
        return async.map(files, extractRequestPaths, function(err, pathDetails) {
          var pathDetail, _i, _len;
          for (_i = 0, _len = pathDetails.length; _i < _len; _i++) {
            pathDetail = pathDetails[_i];
            pathDetail.output = global[pathDetail.type](pathDetail.requested);
            manifest[pathDetail.requested] = pathDetail;
          }
          if (!path.existsSync(builtAssets)) fs.mkdirSync(builtAssets, 0755);
          fs.writeFileSync("" + builtAssets + "/manifest.json", JSON.stringify(manifest));
          if (cb) return cb();
        });
      });
    });
  };

  module.exports.init = init;

  module.exports.precompile = precompile;

  expandPaths = function(origPaths, cb) {
    return async.map(origPaths, expandPath, function(er, results) {
      var result, _i, _len;
      paths = [];
      for (_i = 0, _len = results.length; _i < _len; _i++) {
        result = results[_i];
        if (Array.isArray(result)) {
          paths = paths.concat(result);
        } else {
          paths.push(result);
        }
      }
      return cb();
    });
  };

  expandPath = function(path, cb) {
    if (path.indexOf("*") === -1) {
      cb(null, path);
      return;
    }
    return glob(path, {
      stat: true,
      strict: true
    }, function(er, files) {
      return cb(null, files);
    });
  };

  resolveAsset = function(assetType) {
    return function(route) {
      var resolver, _i, _len;
      for (_i = 0, _len = resolvers.length; _i < _len; _i++) {
        resolver = resolvers[_i];
        try {
          return resolver[assetType](route);
        } catch (e) {
          continue;
        }
      }
      console.warn("Unable to find asset '" + route + "'");
      return route;
    };
  };

  extractMediaType = function() {
    var cssResolver;
    cssResolver = resolveAsset('css');
    return function(route) {
      var cssLink, filePath, mediaType, mt, path;
      mediaType = 'all';
      filePath = route;
      if (typeof route !== 'string') {
        for (mt in route) {
          path = route[mt];
          mediaType = mt;
          filePath = path;
        }
      }
      cssLink = cssResolver(filePath);
      return cssLink.replace('>', " media='" + mediaType + "'>");
    };
  };

  extractRequestPaths = function(file, cb) {
    var assetType, extract, path, _i, _len, _results;
    _results = [];
    for (_i = 0, _len = paths.length; _i < _len; _i++) {
      path = paths[_i];
      if (file.indexOf(path) === 0) {
        extract = file.replace(path + '/', '');
        assetType = extract.substr(0, extract.indexOf('/'));
        extract = extract.substr(assetType.length + 1);
        cb(null, {
          requested: extract,
          type: assetType
        });
        break;
      } else {
        _results.push(void 0);
      }
    }
    return _results;
  };

}).call(this);
