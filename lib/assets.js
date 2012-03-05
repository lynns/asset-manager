var fs      = require('fs'),
    path    = require('path'),
    utils   = require('./utils'),
    contentResolver = null,
    searchPaths = null;

function Asset(route, ext, type, context, servePath, locale) {
  if(route) {
    this.requested = route;
    this.ext = ext;
    this.file = route.substr(route.lastIndexOf("/") + 1);
    this.name = this.file.replace("." + this.ext, "");
    this.pathPart = route.replace(this.file, "");
    this.type = type;
    this.isAbsolute = route.indexOf("http") === 0 ? true : false;
    this.context = context;
    this.servePath = servePath || '';
    this.locale = locale || "en";
    
    this.fingerprint = null;
    this.cr = null;
    if(searchPaths && !this.isAbsolute) {
      this.cr = contentResolver(this.pathPart, this.name, this.ext, this.type, this.locale);
    } 
    
    this.generateActualName();
  }
}
var aproto = Asset.prototype;

aproto.toHTML = function toHTML() {
  return this.getRequestPath();
};

aproto.getRelativePath = function getRelativePath(isRaw) {
  return path.join(this.type, this.generateActualName(isRaw));
};

aproto.getRequestPath = function getRequestPath(isRaw) {
  return this.servePath + path.join("/", this.type, this.generateActualName(isRaw));
};

aproto.getDiskPath = function getDiskPath() {
  return this.cr.getDiskPath();
};

aproto.getContents = function getContent() {
  return this.cr.getContent();
};

aproto.generateActualName = function generateActualName(isRaw){
  var actualName = this.name;
  
  if(this.fingerprint) actualName += "-" + this.fingerprint;
  if(this.locale !== 'en') actualName += "_" + this.locale;
  if(isRaw) actualName += "_raw";
  
  actualName += "." + this.ext;
  
  this.actual = path.join(this.pathPart, actualName);
  return this.actual;
};

aproto.calculateFingerprint = function setFingerprint() {
  if(!this.fingerprint) {
    this.fingerprint = utils.generateHash(this.getContents());
    this.generateActualName();
  }
};

aproto.getServerManifestEntry = function getServerManifestEntry() {
  var entry = {
    requested: this.requested,
    type: this.type,
    output: this.toHTML(),
    relativePath: this.getRelativePath(),
    fingerprint: this.fingerprint
  };
  
  return entry;
};
aproto.getClientManifestEntry = function getClientManifestEntry() {
  var entry = {
    name: this.requested,
    path: this.getRequestPath()
  };
  return entry;
};
aproto.writeContents = function writeContents(basePath) {
  var finalPath = path.join(basePath, this.getRelativePath());
  utils.writeToFile(finalPath, this.cr.getContent());
};


/**
 * IMGAsset Object definition
 */
function IMGAsset(route, ext, context, servePath, locale) {
  Asset.call(this, route, ext, 'img', context, servePath, locale);
}
IMGAsset.prototype = new Asset;


/**
 * JSAsset Object definition
 */
function JSAsset(route, context, servePath, locale) {
  Asset.call(this, route, 'js', 'js', context, servePath, locale);
}
var jproto = JSAsset.prototype = new Asset;

jproto.toHTML = function toHTML() {
  return "<script src='" + this.getRequestPath() + "'></script>";
};

jproto.toHTMLRaw = function toHTMLRaw() {
  return "<script src='" + this.getRequestRawPath() + "'></script>";
};

jproto.getRelativeRawPath = function getRelativeRawPath() {
  return aproto.getRelativePath.call(this, true);
};

jproto.getRequestRawPath = function getRequestRawPath() {
  return aproto.getRequestPath.call(this, true);
};

jproto.getClientManifestEntry = function getClientManifestEntry() {
  var entry = aproto.getClientManifestEntry.call(this);
  entry.name = this.name;
  return entry;
};

jproto.getServerManifestEntry = function getServerManifestEntry() {
  var entry = aproto.getServerManifestEntry.call(this);
  entry.outputRaw = this.toHTMLRaw();
  return entry;
};

jproto.getContents = function getContent() {
  return this.cr.getContent('utf8');
};

jproto.writeContents = function writeContents(basePath) {
  aproto.writeContents.call(this, basePath);
  
  var finalPath = path.join(basePath, this.getRelativeRawPath());
  utils.writeToFile(finalPath, this.cr.getContentRaw('utf8'));
};


/**
 * CSSAsset Object definition
 */
function CSSAsset(route, context, servePath, locale) {
  route = this.extractMediaType(route);
  Asset.call(this, route, 'css', 'css', context, servePath, locale);
  
  if(this.cr) {
    var content = this.cr.getContent('utf8');
    var actual = this.generateActualName();
    function resolveImgPath(path){
      var resolvedPath = path + "";
      resolvedPath = resolvedPath.replace(/url\(|'|"|\)/g, '');
      try {
        resolvedPath = img(resolvedPath);
      }
      catch(e) {
        console.error("Can't resolve image path '" + resolvedPath + "' in '" + actual + "'");
      }
      if(resolvedPath[0] != '/' && resolvedPath.indexOf('http') !== 0) {
        resolvedPath = '/' + resolvedPath;
      }
      return "url('" + resolvedPath + "')";
    }

    //fix the img paths in the css file
    var regex = /url\([^\)]+\)/g
    this.cr.setContent(content.replace(regex, resolveImgPath), 'css');
  }
}
var cproto = CSSAsset.prototype = new Asset;

cproto.toHTML = function toHTML() {
  return "<link href='" + this.getRequestPath() + "' rel='stylesheet' media='" + this.mediaType + "'>";
};

cproto.getContents = function getContent() {
  return this.cr.getContent('utf8');
};

cproto.writeContents = function writeContents(basePath) {
  var content = this.getContents();
  
  var finalPath = path.join(basePath, this.getRelativePath());
  utils.writeToFile(finalPath, content);
};

/**
 * CSS files can be include by passing a string that is the path to the css file OR an object which contains a key that 
 * is the media type of the css file and the value is the path to the css file.  This function takes the css 'route' and 
 * returns an object with a media type and a path.
 */
cproto.extractMediaType = function extractMediaType(route){
  this.mediaType = 'all';

  if(typeof route !== 'string') {
    for(var key in route) {
      this.mediaType = key;
      route = route[key];
    }
  }
  
  return route;
}


/**
 * Declare exports
 */
exports.init = function init(paths, compress){
  searchPaths = paths;
  contentResolver = require('./contentResolver')(paths, compress);
};

exports.parse = function parse(route, context, servePath, locale) {
  var ext = typeof route !== 'string' ? 'css' : route.substr(route.lastIndexOf(".") + 1);
  
  switch(ext) {
    case "js":
      return new JSAsset(route, context, servePath, locale);
      break;
    case "css":
      return new CSSAsset(route, context, servePath, locale);
    default:
      return new IMGAsset(route, ext, context, servePath, locale);
  }
};

/**
 * Given an absolute path on the filesystem, extract the piece that is the relative path
 * and create an `Asset` for that file.  This function is here to support the precompile
 * function of the asset-manager.
 */
exports.parseDiskPath = function parseDiskPath(diskPath, context, paths, servePath, locale) {
  var asset = null;
  
  for(var i=0; i<paths.length; ++i) {
    var aPath = paths[i];
    if(diskPath.indexOf(aPath) === 0) {
      var route = diskPath.replace(aPath + '/', '');
      route = route.substr(route.indexOf('/') + 1);
      asset = exports.parse(route, context, servePath, locale);
      break;
    }
  }
  
  if(asset === null) {
    console.log("Unable to find asset: " + diskPath);
  }
  
  return asset;
};