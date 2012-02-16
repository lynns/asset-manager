(function() {
  var MANIFEST_NAME, appendToName, assetMiddleware, async, builtAssets, compressJS, crypto, doesAssetPathExist, expandPath, expandPaths, extractMediaType, extractRequestPaths, fixCSSImagePaths, fs, generateHashedName, getAbsTemplate, glob, inProd, init, manifest, manifestLocation, mkdirRecursiveSync, parser, path, paths, precompile, resolveAssetPath, resolveCSS, resolveImgPath, resolveInManifest, resolvedPaths, rimraf, servePath, uglify, url, _ref;

  async = require('async');

  glob = require('glob');

  fs = require('fs');

  path = require('path');

  rimraf = require('rimraf');

  crypto = require('crypto');

  url = require('url');

  _ref = require('uglify-js'), parser = _ref.parser, uglify = _ref.uglify;

  MANIFEST_NAME = 'manifest.json';

  builtAssets = '';

  paths = [];

  manifest = {};

  inProd = false;

  servePath = '';

  resolvedPaths = {};

  init = function(config, cb) {
    var context, _ref2, _ref3, _ref4, _ref5;
    builtAssets = (_ref2 = config.builtAssets) != null ? _ref2 : 'builtAssets';
    context = (_ref3 = config.context) != null ? _ref3 : global;
    inProd = (_ref4 = config.inProd) != null ? _ref4 : false;
    servePath = (_ref5 = config.servePath) != null ? _ref5 : '';
    if (config.inProd && path.existsSync(manifestLocation())) {
      console.log("Resolve assets using the manifest file: " + (manifestLocation()));
      return fs.readFile(manifestLocation(), 'utf8', function(err, jsonFile) {
        manifest = JSON.parse(jsonFile);
        context.js = context.img = resolveInManifest;
        context.css = function(route) {
          var details, output;
          details = extractMediaType(route);
          output = resolveInManifest(details.filePath);
          if (output.length !== 0 && details.mediaType !== 'all') {
            output = output.replace("media='all'", "media='" + details.mediaType + "'");
          }
          return output;
        };
        if (cb) return cb();
      });
    } else {
      return expandPaths(config.paths, function() {
        console.log("Asset Resolution Paths:");
        console.dir(paths);
        context.js = resolveAssetPath('js');
        context.css = resolveCSS();
        context.img = resolveAssetPath('img');
        if (cb) return cb();
      });
    }
  };

  precompile = function(config, cb) {
    var context, _ref2, _ref3, _ref4;
    inProd = config.inProd = true;
    builtAssets = (_ref2 = config.builtAssets) != null ? _ref2 : 'builtAssets';
    context = (_ref3 = config.context) != null ? _ref3 : global;
    servePath = (_ref4 = config.servePath) != null ? _ref4 : '';
    return rimraf(builtAssets, function() {
      return init(config, function() {
        var fullPattern, options, pattern;
        options = {
          stat: true,
          strict: true
        };
        pattern = '**/*.*';
        fullPattern = paths.join("/" + pattern + ",") + ("/" + pattern);
        return glob("{" + fullPattern + "}", options, function(er, files) {
          if (er) {
            console.log("Error: " + er);
            return;
          }
          manifest = {};
          return async.map(files, extractRequestPaths, function(err, pathDetails) {
            var meta, outputFilePath, outputFilePathRaw, pathDetail, _i, _len;
            if (!path.existsSync(builtAssets)) fs.mkdirSync(builtAssets, 0755);
            for (_i = 0, _len = pathDetails.length; _i < _len; _i++) {
              pathDetail = pathDetails[_i];
              pathDetail.output = context[pathDetail.type](pathDetail.requested);
              meta = resolvedPaths[path.join(pathDetail.type, pathDetail.requested)];
              pathDetail.relativePath = meta.relativePath;
              outputFilePath = outputFilePathRaw = path.resolve(builtAssets, meta.relativePath);
              if (pathDetail.type === 'js') {
                pathDetail.relativePathRaw = appendToName(meta.relativePath, "_raw");
                outputFilePathRaw = path.resolve(builtAssets, pathDetail.relativePathRaw);
              }
              pathDetail.fingerprint = meta.fingerprint;
              manifest[pathDetail.requested] = pathDetail;
              mkdirRecursiveSync(path.dirname(outputFilePath), 0755, function() {
                fs.writeFile(outputFilePathRaw, meta.content);
                if (pathDetail.type === 'js') {
                  meta.content_min = compressJS(meta.content);
                  return fs.writeFile(outputFilePath, meta.content_min);
                }
              });
            }
            fs.writeFileSync(manifestLocation(), JSON.stringify(manifest));
            if (cb) return cb();
          });
        });
      });
    });
  };

  manifestLocation = function() {
    return "" + builtAssets + "/" + MANIFEST_NAME;
  };

  appendToName = function(name, str) {
    var lastDot;
    lastDot = name.lastIndexOf('.');
    return "" + (name.substr(0, lastDot)) + str + (name.substr(lastDot));
  };

  resolveInManifest = function(route) {
    var absOutput, assetType, entry;
    if (route.indexOf('http') === 0) {
      assetType = route.substr(route.lastIndexOf('.') + 1);
      absOutput = getAbsTemplate(assetType)(route);
      if (assetType === 'css') absOutput = absOutput.replace('>', " media='all'>");
      return absOutput;
    }
    entry = manifest[route];
    if (!entry) {
      console.error("Cannot resolve '" + route + "' in production manifest file.");
      return '';
    }
    return entry.output;
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

  assetMiddleware = function(req, res, next) {
    var content, pathParts, route, _ref2;
    pathParts = req.url.split("/");
    pathParts = pathParts.slice(1, pathParts.length);
    if ((_ref2 = pathParts[0]) !== 'css' && _ref2 !== 'js' && _ref2 !== 'img') {
      return next();
    }
    route = pathParts.join("/");
    if (!doesAssetPathExist(route)) {
      console.log("Asset '" + route + "' cannot be resolved as static asset.");
      return next();
    }
    if (pathParts[0] === 'css') {
      content = (fs.readFileSync(resolvedPaths[route].path)).toString('utf8');
      content = fixCSSImagePaths(content);
      return res.send(content, {
        'Content-Type': 'text/css'
      });
    } else {
      return res.sendfile(resolvedPaths[route].path);
    }
  };

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

  getAbsTemplate = function(assetType) {
    if (assetType === 'js') {
      return function(route) {
        return "<script src=\'" + route + "\'></script>";
      };
    } else if (assetType === 'css') {
      return function(route) {
        return "<link href=\'" + route + "\' rel=\'stylesheet\'>";
      };
    }
    return function(route) {
      return "" + route;
    };
  };

  doesAssetPathExist = function(route) {
    var aPath, fullPath, _i, _len;
    if (resolvedPaths[route]) return true;
    for (_i = 0, _len = paths.length; _i < _len; _i++) {
      aPath = paths[_i];
      fullPath = path.resolve(aPath, route);
      if (path.existsSync(fullPath)) {
        resolvedPaths[route] = {
          path: fullPath
        };
        return true;
      }
    }
    console.log("Unable to find asset: " + route);
    return false;
  };

  resolveAssetPath = function(assetType) {
    var absTemplate, getContents;
    absTemplate = getAbsTemplate(assetType);
    getContents = function(path) {
      var content;
      if (assetType === 'img') {
        content = fs.readFileSync(path);
      } else {
        content = (fs.readFileSync(path)).toString('utf8');
      }
      if (assetType === 'css') content = fixCSSImagePaths(content);
      return content;
    };
    return function(route) {
      if ((route != null ? route.indexOf('http') : void 0) === 0) {
        return absTemplate(route);
      }
      route = path.join(assetType, route);
      if (doesAssetPathExist(route)) {
        if (inProd) {
          resolvedPaths[route].content = getContents(resolvedPaths[route].path);
          route = resolvedPaths[route].relativePath = generateHashedName(route, resolvedPaths[route]);
        }
        route = url.resolve(servePath, route);
        return absTemplate(route);
      }
      return '';
    };
  };

  resolveCSS = function() {
    var cssResolver;
    cssResolver = resolveAssetPath('css');
    return function(route) {
      var cssLink, details;
      details = extractMediaType(route);
      cssLink = cssResolver(details.filePath);
      return cssLink.replace('>', " media='" + details.mediaType + "'>");
    };
  };

  resolveImgPath = function(path) {
    var resolvedPath;
    resolvedPath = path + "";
    resolvedPath = resolvedPath.replace(/url\(|'|"|\)/g, '');
    try {
      resolvedPath = img(resolvedPath);
    } catch (e) {
      console.error("Can't resolve image path: " + resolvedPath);
    }
    if (resolvedPath[0] !== '/') resolvedPath = '/' + resolvedPath;
    return "url('" + resolvedPath + "')";
  };

  fixCSSImagePaths = function(css) {
    var regex;
    regex = /url\([^\)]+\)/g;
    css = css.replace(regex, resolveImgPath);
    return css;
  };

  generateHashedName = function(route, meta) {
    var hash;
    hash = crypto.createHash('md5');
    hash.update(new Buffer(meta.content));
    meta.fingerprint = hash.digest('hex');
    return appendToName(route, "-" + meta.fingerprint);
  };

  extractMediaType = function(route) {
    var details, mt, path;
    details = {
      mediaType: 'all',
      filePath: route
    };
    if (typeof route !== 'string') {
      for (mt in route) {
        path = route[mt];
        details.mediaType = mt;
        details.filePath = path;
      }
    }
    return details;
  };

  mkdirRecursiveSync = function(dir, mode, callback) {
    var pathParts;
    pathParts = path.normalize(dir).split('/');
    if (path.existsSync(dir)) return callback(null);
    return mkdirRecursiveSync(pathParts.slice(0, -1).join('/'), mode, function(err) {
      if (err && err.errno !== process.EEXIST) return callback(err);
      fs.mkdirSync(dir, mode);
      return callback();
    });
  };

  compressJS = function(content) {
    var ast;
    ast = parser.parse(content);
    ast = uglify.ast_mangle(ast);
    ast = uglify.ast_squeeze(ast);
    return uglify.gen_code(ast);
  };

  module.exports.init = init;

  module.exports.precompile = precompile;

  module.exports.expressMiddleware = assetMiddleware;

}).call(this);
