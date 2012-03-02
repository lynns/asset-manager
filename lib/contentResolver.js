var fs    = require('fs'),
    path  = require('path'),
    utils = require('./utils'),
    
    searchPaths = null,
    compressJS = false,
    contentMetaCache = {};
    
function Content(pathPart, name, ext, type) {
  if(pathPart !== undefined) {
    this.meta = getContentMeta(pathPart, name, ext, type);
    this.setContent(readContentSync(this.meta), type);
  }
}
var proto = Content.prototype;

proto.getDiskPath = function getDiskPath() {
  return this.meta.mainFile;
};

proto.setContent = function setContent(newContent, type) {
  this.content = this.contentRaw = newContent;
  if(compressJS && type === 'js') {
    this.contentRaw = this.content.toString('utf8');
    this.content = utils.compressJS(this.content.toString('utf8'));
  }
};

proto.getContent = function getContent(encoding) {
  if(encoding) {
    return this.content.toString(encoding);
  }
  return this.content;
};
proto.getContentRaw = function getContentRaw(encoding) {
  if(encoding) {
    return this.contentRaw.toString(encoding);
  }
  return this.contentRaw;
};


/**
 * Export the factory function for creating new Content objects
 */
module.exports = function(paths, doCompress) {
  searchPaths = paths || [];
  compressJS = doCompress || false;
  
  return function ContentFactory(pathPart, name, ext, type) {
    return new Content(pathPart, name, ext, type);
  }
};


/**
 * Helper functions
 */
function readContentSync(meta) {
  var contents = fs.readFileSync(meta.mainFile);
  if(meta.assembled) {
    try {
      var assembly = JSON.parse(contents),
          hasTranslations = false;
      
      //append the js files
      var filePath, i, translations, template;
          
      contents = "//Module assembly: " + meta.name + "\n\n";
      for(i=0; i<assembly.files.length; ++i) {
        filePath = path.join(meta.baseModulePath, assembly.files[i]);
        contents = appendContents(contents, fs.readFileSync(filePath).toString('utf8'), assembly.files[i]);
      }
      
      //append any translations
      filePath = path.join(meta.basePath, "../locales", meta.pathPart, meta.name + "_en.json");
      hasTranslations = path.existsSync(filePath);
      if(hasTranslations) {
        translations = fs.readFileSync(filePath).toString('utf8');
        contents = appendContents(contents, "var lang = " + translations + ";", meta.name + "_en.json");
      }
      
      //append the html template
      filePath = path.join(meta.baseModulePath, "template.html");
      if(path.existsSync(filePath)) {
        template = fs.readFileSync(filePath).toString('utf8');
        template = utils.convertHTMLtoJS(template, hasTranslations);
        
        contents = appendContents(contents, template, 'template.html');
      }
      
      //inject call to load the css if there is one
      filePath = path.join(meta.basePath, "css", meta.pathPart, meta.name + ".css");
      if(path.existsSync(filePath)) {
        contents = appendContents(contents, "loadCSS('" + path.join(meta.pathPart, meta.name + ".css") + "');", "CSS auto import");
      }
    } catch (e) {
      var error = "Error building assembly '" + meta.mainFile + "': " + e;
      contents = "//" + error;
      console.error(error);
    }
  }
  
  return contents;
}

function htmlToJSString(html) {
  
}

function appendContents(contents, newContents, fileName) {
  contents += "/*\n * Included File: " + fileName + "\n */\n\n" + newContents + "\n\n";
  return contents;
}

/**
 * Checks filesystem to see if the asset exists in one of our asset paths, 
 * caches the absolute path of the resource, and returns the fullPath if it exists
 * otherwise, it returns null if the path can't be found.
 */
function getContentMeta(pathPart, name, ext, type) {
  var checkPath = path.join(type, pathPart, name + "." + ext),
      indexPath = path.join(type, pathPart, name, "index." + ext),
      assemblyPath = path.join(type, pathPart, name, "assembly.json");
  
  //return from cache if found
  if(contentMetaCache[checkPath]){
    return contentMetaCache[checkPath];
  }

  //try and resolve in searchPaths
  var meta = {
    assembled: false,
    mainFile: null,
    name: name,
    pathPart: pathPart
  };
  
  for(var i=0; i<searchPaths.length; ++i){
    var fullPath = path.resolve(searchPaths[i], checkPath);
    //look for exact path match
    if(path.existsSync(fullPath)) {
      meta.mainFile = fullPath;
      break;
    }
    //look for a folder with an index file in it
    fullPath = path.resolve(searchPaths[i], indexPath);
    //look for exact path match
    if(path.existsSync(fullPath)) {
      meta.mainFile = fullPath;
      break;
    }
    
    //look for a folder with an assemblies.json file in it
    fullPath = path.resolve(searchPaths[i], assemblyPath);
    //look for exact path match
    if(path.existsSync(fullPath)) {
      meta.mainFile = fullPath;
      meta.assembled = true;
      meta.baseModulePath = path.join(searchPaths[i], type, pathPart, name);
      meta.basePath = searchPaths[i];
      break;
    }
  }

  if(meta.mainFile === null) {
    console.log("Unable to find asset: " + checkPath);
  } else {
    contentMetaCache[checkPath] = meta;
  }
  return meta;
}