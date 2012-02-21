var fs    = require('fs'),
    path  = require('path');

function Asset(route, ext, type, context) {
  if(route) {
    this.requested = route;
    this.actual = route;
    this.ext = ext;
    this.file = route.substr(route.lastIndexOf("/") + 1);
    this.name = this.file.replace("." + this.ext, "");
    this.pathPart = this.file.replace(this.file, "");
    this.type = type;
    this.isAbsolute = route.indexOf("http") === 0 ? true : false;
    this.context = context;
    
    this.diskPath = '';
    this.fingerprint = '';
  }
}

Asset.prototype.toHTML = function toHTML() {
  return this.getRelativePath();
};

Asset.prototype.getRelativePath = function getPath() {
  return path.join(this.type, this.actual);
};

Asset.prototype.setDiskPath = function setDiskPath(diskPath) {
  this.diskPath = diskPath;
};

Asset.prototype.setFingerprint = function setFingerprint(fingerprint) {
  this.fingerprint = fingerprint;
  this.actual = path.join(this.pathPart, (this.name + "-" + this.fingerprint + "." + this.ext));
};

Asset.prototype.readContents = function readContents() {
  this.content = fs.readFileSync(this.diskPath);
  return this.content;
};
Asset.prototype.getServerManifestEntry = function getServerManifestEntry() {
  var entry = {
    requested: this.requested,
    type: this.type,
    output: this.toHTML(),
    relativePath: this.getRelativePath(),
    fingerprint: this.fingerprint
  };
  
  return entry;
};

/**
 * IMGAsset Object definition
 */
function IMGAsset(route, ext, context) {
  Asset.call(this, route, ext, 'img', context);
}
IMGAsset.prototype = new Asset;

/**
 * CSSAsset Object definition
 */
function JSAsset(route, context) {
  Asset.call(this, route, 'js', 'js', context);
}
JSAsset.prototype = new Asset;

JSAsset.prototype.readContents = function readContents() {
  this.content = (Asset.prototype.readContents.call(this)).toString('utf8');
  return this.content;
};

JSAsset.prototype.toHTML = function toHTML() {
  return "<script src='" + this.getRelativePath() + "'></script>";
};

/**
 * CSSAsset Object definition
 */
function CSSAsset(route, context) {
  route = this.extractMediaType(route);
  Asset.call(this, route, 'css', 'css', context);
}
CSSAsset.prototype = new Asset;

CSSAsset.prototype.toHTML = function toHTML() {
  return "<link href='" + this.getRelativePath() + "' rel='stylesheet' media='" + this.mediaType + "'>";
};

CSSAsset.prototype.readContents = function readContents() {
  this.content = (Asset.prototype.readContents.call(this)).toString('utf8');
  
  var actual = this.actual;
  function resolveImgPath(path){
    var resolvedPath = path + ""
    resolvedPath = resolvedPath.replace(/url\(|'|"|\)/g, '');
    try {
      resolvedPath = img(resolvedPath);
    }
    catch(e) {
      console.error("Can't resolve image path '" + resolvedPath + "' in '" + actual + "'");
    }
    if(resolvedPath[0] != '/') {
      resolvedPath = '/' + resolvedPath;
    }
    return "url('" + resolvedPath + "')";
  }
  
  //fix the img paths int he css file
  var regex = /url\([^\)]+\)/g
  this.content = this.content.replace(regex, resolveImgPath);
  
  return this.content;
};

/**
 * CSS files can be include by passing a string that is the path to the css file OR an object which contains a key that 
 * is the media type of the css file and the value is the path to the css file.  This function takes the css 'route' and 
 * returns an object with a media type and a path.
 */
CSSAsset.prototype.extractMediaType = function extractMediaType(route){
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
exports.parse = function parse(route, context) {
  var ext = typeof route !== 'string' ? 'css' : route.substr(route.lastIndexOf(".") + 1);
  
  switch(ext) {
    case "js":
      return new JSAsset(route, context);
      break;
    case "css":
      return new CSSAsset(route, context);
    default:
      return new IMGAsset(route, ext, context);
  }
}

exports.parseDiskPath = function parseDiskPath(diskPath, context, paths) {
  var asset = null;
  
  for(var i=0; i<paths.length; ++i) {
    var path = paths[i];
    if(diskPath.indexOf(path) === 0) {
      var route = diskPath.replace(path + '/', '');
      route = route.substr(route.indexOf('/') + 1);
      asset = exports.parse(route, context);
      asset.setDiskPath(diskPath);
      break;
    }
  }
  
  return asset;
}