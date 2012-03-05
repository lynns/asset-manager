var fs        = require('fs'),
    path      = require('path'),
    rimraf    = require('rimraf'),
    crypto    = require('crypto'),
    url       = require('url'),
    utils     = require('./utils'),
    assets    = require('./assets'),
    glob      = require('glob'),
    async     = require('async'),
    
    MANIFEST_NAME = 'manifest.json',
    CLIENT_MANIFEST_NAME = 'clientManifest.js',
    builtAssets = '',
    paths = [],
    manifest = {},
    servePath = '',
    resolvedPaths = {},
    context,
    locales;

function init(config){
  builtAssets = config.builtAssets || 'builtAssets';
  context = config.context || global;
  servePath = config.servePath || '';
  locales = config.locales || ['en'];
  
  config.inProd = config.inProd || false;
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
    
    if(cb) {
      cb();
    }
  }
  else { 
    utils.expandPaths(config.paths, function(expandedPaths){
      paths = expandedPaths;
      //Output the paths that will be checked when resolving assets
      console.log("Asset Resolution Paths:");
      console.dir(paths);
      
      assets.init(paths, config.inProd);
      
      //setup route path resolution
      context.js = context.img = context.css = resolveAssetHTMLSnippet(config.inProd);
      
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

function clientManifestLocation() {
  return builtAssets + "/js/" + CLIENT_MANIFEST_NAME;
}

//Given a route, look up it's request path in the manifest file instead of the filesystem
function resolveInManifest(route){
  var asset = assets.parse(route, context, servePath);
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
function resolveAssetHTMLSnippet(inProd) {
  return function(route) {
    var asset = assets.parse(route, context, servePath);

    if(asset) {
      if(inProd) {
        asset.calculateFingerprint();
      }
      return asset.toHTML();
    }
    return '';
  }
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
    var asset = assets.parse(pathParts.join("/"), context, servePath);
  
    if(asset){
      if(asset.type === 'css') {
        res.send(asset.getContents(), {'Content-Type' : 'text/css'});
      } else if(asset.type === 'js') {
        res.send(asset.getContents(), {'Content-Type' : 'text/javascript'});
      } else {
        res.sendfile(asset.getDiskPath());
      }
    } else {
      console.log("Asset '" + asset.actual + "' cannot be resolved as static asset.");
      next();
    }
  } else {
    next();
  }
}

function precompile(config, cb){
  config.inProd = true;
  init(config);
  
  //Remove any previous 'builtAssets'
  rimraf(builtAssets, function(){
    start(config, function startCB(){
      //Initialize the asset-manager and resolve all of the assets
      var options = {stat: true, strict: true},
          pattern = '**/*.*',
          assemblyPattern = '**/assembly.json',
          fullPattern = paths.join("/" + pattern + ",") + "/" + pattern,
          fullAssemblyPattern = paths.join("/" + assemblyPattern + ",") + "/" + assemblyPattern;
          
      if(paths.length > 1) {
        fullPattern = "{" + fullPattern + "}";
        fullAssemblyPattern = "{" + fullAssemblyPattern + "}";
      }

      //get list of all of the static assets and remove files that are part of assembled modules
      async.series([
        function getListOfAllAssetFiles(callback) {
          glob(fullPattern, options, function globAllCB(er, files){
            if(er){
              console.log("Error: " + er);
              callback(er);
            }

            callback(null, files);
          });
        },
        
        function getListOfAssemblyFiles(callback) {
          glob(fullAssemblyPattern, options, function globAssemblyCB(er, files){
            if(er){
              console.log("Error: " + er);
              callback(er);
            }

            for(var i=0; i<files.length; ++i) {
              files[i] = files[i].substr(0, files[i].lastIndexOf('/'));
            }
            callback(null, files);
          });
        }
      ], function processAssetFiles(er, fileSets) {
        if(er){
          console.log("Error: " + er);
          return;
        }
        manifest = {};
        
        var files = utils.filterAssembliesFiles(fileSets[0], fileSets[1]),
            clientManifest = {css:{}, js:{}, img:{}},
            allAssets = [],
            i;
        
        function parseAsset(diskPath, locale) {
          var asset = assets.parseDiskPath(diskPath, context, paths, servePath, locale);
          asset.calculateFingerprint();
          return asset;
        }

        for(i=0; i<files.length; ++i) {
          var file = files[i];
          if(file.substr(file.lastIndexOf(".") + 1) === 'js') {//Only do localization work on 'js' files
            
            for(var l=0; l<locales.length; ++l){
              clientManifest.js[locales[l]] = {};
              allAssets.push(parseAsset(file, locales[l]));
            }
          }
          else {
            allAssets.push(parseAsset(file));
          }
        }
        
        utils.mkdirRecursiveSync(path.resolve('./', builtAssets), 0755);

        for(i=0; i<allAssets.length; ++i) {
          var asset = allAssets[i],
              manifestEntry = asset.getServerManifestEntry(),
              clientManifestEntry = asset.getClientManifestEntry();
  
          manifest[manifestEntry.requested] = manifestEntry;
          if(asset.type === 'js') {
            clientManifest[asset.type][asset.locale][clientManifestEntry.name] = clientManifestEntry.path;
          } else {
            clientManifest[asset.type][clientManifestEntry.name] = clientManifestEntry.path;
          }
          
          asset.writeContents(builtAssets);
        }
        
        // Generate the client manifest and pull it in as a requestable js asset
        utils.mkdirRecursiveSync(path.dirname(clientManifestLocation()), 0755);
        fs.writeFileSync(clientManifestLocation(), "var manifest = " + JSON.stringify(clientManifest));
        console.log("PUshpath: " + path.resolve(builtAssets));
        paths.push(path.resolve(builtAssets));
        
        var clientManifestAsset = assets.parseDiskPath(path.resolve(clientManifestLocation()), context, paths, servePath);
        clientManifestAsset.calculateFingerprint();
        clientManifestAsset.writeContents(builtAssets);
        
        var clientAssetManifestEntry = clientManifestAsset.getServerManifestEntry();
        manifest[clientAssetManifestEntry.requested] = clientAssetManifestEntry;
        
        paths.pop();
        
        // Write the server manifest file
        fs.writeFileSync(manifestLocation(), JSON.stringify(manifest));
        
        if(cb) {
          cb(manifest);
        }
      });
    });
  });
}

//Public exports
module.exports.start = start;
module.exports.precompile = precompile;
module.exports.expressMiddleware = assetMiddleware;
