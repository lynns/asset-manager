var fs        = require('fs'),
    path      = require('path'),
    rimraf    = require('rimraf'),
    crypto    = require('crypto'),
    url       = require('url'),
    utils     = require('./utils'),
    assets    = require('./assets'),
    glob      = require('glob'),
    
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
}

function start(config, cb) {
  init(config);
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
      
      if(cb) {
        cb();
      }
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

function precompile(config){
  config.inProd = true;
  init(config);
  
  //Remove any previous 'builtAssets'
  rimraf(builtAssets, function(){
    start(config, function startCB(){
      //Initialize the asset-manager and resolve all of the assets
      var options = {stat: true, strict: true},
          pattern = '**/*.*',
          fullPattern = paths.join("/" + pattern + ",") + "/" + pattern;

      glob("{" + fullPattern + "}", options, function globCB(er, files){
        if(er){
          console.log("Error: " + er);
          return;
        }

        manifest = {};
        
        var parseAssets = function parseAssets(diskPath) {
          return assets.parseDiskPath(diskPath, context, paths);
        };

        var allAssets = files.map(parseAssets);

        utils.mkdirRecursiveSync(path.resolve('./', builtAssets), 0755);

        for(var i=0; i<allAssets.length; ++i) {
          var asset = allAssets[i];
          
          asset.readContents();
          asset.setFingerprint(utils.generateHash(asset.content));
          
          var manifestEntry = asset.getServerManifestEntry();
          
          manifest[manifestEntry.requested] = manifestEntry;
          
          asset.writeContents(builtAssets);
        }
        
        fs.writeFileSync(manifestLocation(), JSON.stringify(manifest));
      });
    });
  });
}

//Public exports
module.exports.start = start;
module.exports.precompile = precompile;
module.exports.expressMiddleware = assetMiddleware;
