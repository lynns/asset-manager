var fs        = require('fs'),
    path      = require('path'),
    rimraf    = require('rimraf'),
    crypto    = require('crypto'),
    url       = require('url'),
    utils     = require('./utils'),
    assets    = require('./assets'),
    
    MANIFEST_NAME = 'manifest.json',
    builtAssets = '',
    paths = [],
    manifest = {},
    inProd = false,
    servePath = '',
    resolvedPaths = {},
    context;

function init(config){
  builtAssets = config.builtAssets || 'builtAssets';
  context = config.context || global;
  inProd = config.inProd || false;
  servePath = config.servePath || '';
  
  var manifestFile = manifestLocation();

  //Production mode with manifest will only refer to manifest file for resolving
  //asset requests to the appropriate markup/string.  Assumes that an external
  //CDN (or equivalent) will actually be serving the asset files.
  if(config.inProd && path.existsSync(manifestFile)) {
    var jsonFile = fs.readFileSync(manifestFile, 'utf8');
     
    manifest = JSON.parse(jsonFile);
        
    console.log("Resolve assets using the manifest file: " + manifestFile);
    
    //setup route path resolution
    context.js = context.img = context.css = resolveInManifest;
  }
  else { 
    utils.expandPaths(config.paths, function(expandedPaths){
      paths = expandedPaths;
      //Output the paths that will be checked when resolving assets
      console.log("Asset Resolution Paths:");
      console.dir(paths);
      
      //setup route path resolution
      context.js = context.img = context.css = resolveAssetHTMLSnippet;
    });
  }
}

//Local Helpers
function manifestLocation() {
  return builtAssets + "/" + MANIFEST_NAME;
}

//Given a route, look up it's request path in the manifest file instead of the filesystem
function resolveInManifest(route){
  var asset = assets.parse(route, context);
  if(asset.isAbsolute) {
    return asset.toHTML();
  }
      
  entry = manifest[asset.requested];

  if(!entry) {
    console.error("Cannot resolve '" + asset.requested + "' in production manifest file.");
    return '';
  }

  return entry.output;
}

/**
 * Given an asset, return the HTML snippet that should be written to the browser to request this asset
 */
function resolveAssetHTMLSnippet(route) {
  var asset = assets.parse(route, context);
  asset = resolveOnFileSystem(asset);
  
  if(asset) {
    return asset.toHTML();
  }
  return '';
}

/**
 * Pass asset through resolution chain for the specific type of asset and
 * return the asset object.
 */
function resolveOnFileSystem(asset){
  if(asset.isAbsolute) {
    return asset;
  }

  var fullPath = utils.resolveAssetPath(asset.getRelativePath(), paths);
  console.log(fullPath);
  if(fullPath) {
    asset.setDiskPath(fullPath);
    return asset;
  }

  return null;
}

/**
 * Express middleware that resolves a static asset file and returns it's content to the browser.
 */
function assetMiddleware (req, res, next){
  console.log("Into middleware: " + req.url);
  //only deal with static asset requests
  var pathParts = req.url.split("/");
  pathParts.shift();//drop the '/' off the front
  if(['css', 'js', 'img'].indexOf(pathParts[0]) !== -1) {
    pathParts.shift();//drop the asset type (gets inferred by the file extension)
    var asset = assets.parse(pathParts.join("/"), context);
    asset = resolveOnFileSystem(asset);
  
    if(asset){
      if(asset.type === 'css') {
        res.send(asset.readContents(), {'Content-Type' : 'text/css'});
      } else
      {
        res.sendfile(asset.diskPath);
      }
    } else {
      console.log("Asset '" + asset.actual + "' cannot be resolved as static asset.");
      next();
    }
  } else {
    next();
  }
}

//precompile = (config, cb) ->
//  inProd = config.inProd = true
//  builtAssets = config.builtAssets ? 'builtAssets'
//  context = config.context ? global
//  servePath = config.servePath ? ''
//  
//  # Remove any previous 'builtAssets'
//  rimraf builtAssets, () ->
//    # Initialize the asset-manager and resolve all of the assets
//    init config, () ->
//      options = stat: true, strict: true
//
//      pattern = '**/*.*'
//      fullPattern = paths.join("/#{pattern},") + "/#{pattern}"
//
//      glob "{#{fullPattern}}", options, (er, files) ->
//        if er
//          console.log "Error: #{er}"
//          return
//
//        manifest = {}
//        async.map files, extractRequestPaths, (err, pathDetails) ->
//          if not path.existsSync(builtAssets)
//            fs.mkdirSync builtAssets, 0755
//            
//          for pathDetail in pathDetails
//            pathDetail.output = context[pathDetail.type](pathDetail.requested)
//            meta = resolvedPaths[path.join(pathDetail.type, pathDetail.requested)]
//            
//            
//            if inProd
//      resolvedPaths[route].content = getContents(resolvedPaths[route].path)
//      route = resolvedPaths[route].relativePath = generateHashedName(route, resolvedPaths[route])
//            
//            pathDetail.relativePath = meta.relativePath
//            outputFilePath = outputFilePathRaw = path.resolve(builtAssets, meta.relativePath)
//            if pathDetail.type is 'js'
//              pathDetail.relativePathRaw = appendToName(meta.relativePath, "_raw")
//              outputFilePathRaw = path.resolve(builtAssets, pathDetail.relativePathRaw)
//            pathDetail.fingerprint = meta.fingerprint
//            
//            manifest[pathDetail.requested] = pathDetail
//            
//            mkdirRecursiveSync path.dirname(outputFilePath), 0755, ->
//              fs.writeFile outputFilePathRaw, meta.content
//              if pathDetail.type is 'js'
//                meta.content_min = compressJS(meta.content)
//                fs.writeFile outputFilePath, meta.content_min
//
//          # Write manifest file to `builtAssets` directory
//          fs.writeFileSync manifestLocation(), JSON.stringify(manifest)
//          
//          cb() if cb

//Public exports
module.exports.init = init;
//module.exports.precompile = precompile;
module.exports.expressMiddleware = assetMiddleware;
