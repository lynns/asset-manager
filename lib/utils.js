var path    = require('path'),
    fs      = require('fs'),
    async   = require('async'),
    glob    = require('glob'),
    crypto  = require('crypto'),
    parser  = require('uglify-js').parser,
    uglify  = require('uglify-js').uglify;

//exports.appendToName = function appendToName (name, str){
//  var lastDot = name.lastIndexOf('.');
//  return name.substr(0,lastDot) + str + name.substr(lastDot);
//}
//
///**
// * Given a link tag, set the media attribute.  The given link tag may already have
// * a media attribute set to 'all'.
// */
//exports.setCSSMediaAttribute = function setCSSMediaAttribute(cssString, mediaType) {
//  mediaType = mediaType || 'all';
//  if(cssString.indexOf('media') === -1) {
//    cssString = cssString.replace('>', " media='" + mediaType + "'>");
//  } else {
//    cssString = cssString.replace("media='all'", "media='" + mediaType + "'");
//  }
//  
//  return cssString;
//}

/**
 * Given a dir path, this function will synchronously create the folders if they don't exist.
 */
exports.mkdirRecursiveSync = function mkdirRecursiveSync(dir, mode){
  if(path.existsSync(dir)) {
    return;
  }
  
  var pathParts = path.normalize(dir).split('/');
  mkdirRecursiveSync(pathParts.slice(0,-1).join('/'));
  fs.mkdirSync(dir, mode);
}

/**
 * Given a list of paths that may contain globs, resolve the globs and set the `paths` to be an array
 * of all the actual paths that `origPaths` expands to
 */
exports.expandPaths = function expandPaths(origPaths, cb){
  //Take a path that contains a potential glob in it and resolve it to the list of files corresponding to that glob
  var expandPath = function expandPath(aPath, cb){
    if(aPath.indexOf("*") === -1) {
      cb(null, [aPath]);
    } else {
      glob(aPath, {stat: true, strict: true}, function globCB(er, files){
        cb(null, files);
      });
    }
  };

  async.map(origPaths, expandPath, function expandPathsComplete(er, results){
    var paths = [];
    
    for(var i=0; i<results.length; ++i) {
      var result = results[i];
      paths = paths.concat(result);
    }
      
    cb(paths);
  });
}

/**
 * Checks filesystem to see if route exists in one of our asset paths, 
 * caches the absolute path of the resource, and returns the fullPath if it exists
 * otherwise, it returns null if the path can't be found.
 */
var assetPathCache = {};
exports.resolveAssetPath = function resolveAssetPath(relativePath, paths) {
  //return from cache if found
  if(assetPathCache[relativePath]){
    return assetPathCache[relativePath];
  }

  //try and resolve in asset paths
  for(var i=0; i<paths.length; ++i){
    var fullPath = path.resolve(paths[i], relativePath);
    if(path.existsSync(fullPath)) {
      assetPathCache[relativePath] = fullPath;
      return fullPath;
    }
  }

  console.log("Unable to find asset: " + relativePath);
  return null;
}

/**
 * Return the hash for the provided contents.
 */
exports.generateHash = function generateHash(content){
  var hash = crypto.createHash('md5');
  //Simulate writing file to disk, including encoding coersions
  //This ensures that the md5 in the name matches the command-line tool.
  hash.update(new Buffer(content));
  return hash.digest('hex');
}

/**
 * Minify a javascript string.
 */
exports.compressJS = function compressJS(content){
  var ast = parser.parse(content);
  ast = uglify.ast_mangle(ast);
  ast = uglify.ast_squeeze(ast, {make_seqs:false});
  return uglify.gen_code(ast);
}