var fs    = require('fs'),
    path  = require('path'),
    
    searchPaths = null,
    contentMetaCache = {};
    
function Content(pathPart, name, ext, type) {
  if(pathPart !== undefined) {
    this.meta = getContentMeta(pathPart, name, ext, type);
    this.content = readContentSync(this.meta);
  }
}
var proto = Content.prototype;

proto.getDiskPath = function getDiskPath() {
  return this.meta.mainFile;
};

proto.getContent = function getContent(encoding) {
  if(encoding) {
    return this.content.toString(encoding);
  }
  return this.content;
};
proto.getContentRaw = function getContentRaw(encoding) {
  if(encoding) {
    return this.content.toString(encoding);
  }
  return this.content;
};


/**
 * Export the factory function for creating new Content objects
 */
module.exports = function(paths) {
  searchPaths = paths;
  
  return function ContentFactory(pathPart, name, ext, type) {
    return new Content(pathPart, name, ext, type);
  }
};


/**
 * Helper functions
 */
function readContentSync(meta) {
  if(!meta.assembled) {
    return fs.readFileSync(meta.mainFile);
  }
  
  //have to read the assembled version
  return "NEED TO IMPLEMENT THIS STUFF STILL";
}

/**
 * Checks filesystem to see if the asset exists in one of our asset paths, 
 * caches the absolute path of the resource, and returns the fullPath if it exists
 * otherwise, it returns null if the path can't be found.
 */
function getContentMeta(pathPart, name, ext, type) {
  var checkPath = path.join(type, pathPart, name + "." + ext);
  
  //return from cache if found
  if(contentMetaCache[checkPath]){
    return contentMetaCache[checkPath];
  }

  //try and resolve in searchPaths
  var meta = {
    assembled: false,
    mainFile: null
  };
  
  for(var i=0; i<searchPaths.length; ++i){
    var fullPath = path.resolve(searchPaths[i], checkPath);
    //look for exact path match
    if(path.existsSync(fullPath)) {
      meta.mainFile = fullPath;
      break;
    }
    //look for a folder with an index file in it
    
    //look for a folder with an assemblies.json file in it
    
  }

  if(meta.mainFile === null) {
    console.log("Unable to find asset: " + checkPath);
  } else {
    contentMetaCache[checkPath] = meta;
  }
  return meta;
}