var path    = require('path'),
    fs      = require('fs'),
    async   = require('async'),
    glob    = require('glob'),
    crypto  = require('crypto'),
    parser  = require('uglify-js').parser,
    uglify  = require('uglify-js').uglify;

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

exports.writeToFile = function writeToFile(filePath, content) {
  mkdirRecursiveSync(path.dirname(filePath), 0755);
  fs.writeFile(filePath, content);
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
  ast = uglify.ast_squeeze(ast);
  return uglify.gen_code(ast);
}