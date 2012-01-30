async     = require 'async'
assets    = require 'connect-assets'
glob      = require 'glob'
fs        = require 'fs'
path      = require 'path'
rimraf    = require 'rimraf'

MANIFEST_NAME = 'manifest.json'
builtAssets = ''
paths = []
manifest = {}

init = (config, cb) ->
  builtAssets = config.builtAssets ? 'builtAssets'
  context = config.context ? global

  # Production mode with manifest will only refer to manifest file for resolving
  # asset requests to the appropriate markup/string.  Assumes that an external
  # CDN (or equivalent) will actually be serving the asset files.
  if config.inProd and path.existsSync(manifestLocation())
    console.log "Resolve assets using the manifest file: #{manifestLocation()}"
    
    fs.readFile manifestLocation(), 'utf8', (err, jsonFile) ->
      manifest = JSON.parse jsonFile
      
      context.js = context.img = resolveInManifest
        
      context.css = (route) ->
        details = extractMediaType route
        
        output = resolveInManifest details.filePath
        
        if output.length isnt 0 and details.mediaType isnt 'all'
          output = output.replace "media='all'", "media='#{details.mediaType}'"
          
        return output
        
      cb() if cb
    
  else 
    resolvers = []
    expandPaths config.paths, () ->
      # Output the paths that will be checked when resolving assets
      console.log "Asset Resolution Paths:"
      console.dir paths

      for path in paths
        resolver = 'path': path
        mw = assets
          src: resolver.path
          build: config.inProd ? false
          helperContext: resolver
          buildDir: builtAssets
          servePath: config.servePath ? ''

        config.app.use(mw) if config.app
        resolvers.push resolver

      context.css = resolveCSS(resolvers)
      context.js = resolveAsset 'js', resolvers
      context.img = resolveAsset 'img', resolvers
      cb() if cb
  
precompile = (config, cb) ->
  config.inProd = true
  builtAssets = config.builtAssets ? 'builtAssets'
  context = config.context ? global
  
  # Remove any previous 'builtAssets'
  rimraf builtAssets, () ->
    # Initialize the asset-manager and resolve all of the assets
    init config, () ->
      options = stat: true, strict: true

      pattern = '**/*.*'
      fullPattern = paths.join("/#{pattern},") + "/#{pattern}"

      glob "{#{fullPattern}}", options, (er, files) ->
        if er
          console.log "Error: #{er}"
          return

        manifest = {}
        async.map files, extractRequestPaths, (err, pathDetails) ->
          for pathDetail in pathDetails
            pathDetail.output = context[pathDetail.type](pathDetail.requested)
            manifest[pathDetail.requested] = pathDetail

          # Write manifest file to `builtAssets` directory
          if not path.existsSync(builtAssets)
            fs.mkdirSync builtAssets, 0755
          fs.writeFileSync manifestLocation(), JSON.stringify(manifest)
          
          cb() if cb
      
# Public exports
module.exports.init = init
module.exports.precompile = precompile

# Local Helpers
manifestLocation = () ->
  return "#{builtAssets}/#{MANIFEST_NAME}"

resolveInManifest = (route) ->
  if route.indexOf('http') is 0
    assetType = route.substr(route.lastIndexOf('.') + 1)
    absOutput = getAbsTemplate(assetType)(route)
    if assetType is 'css'
      absOutput = absOutput.replace '>', " media='all'>"
    return absOutput
      
  entry = manifest[route]

  if not entry
    console.error "Cannot resolve '#{route}' in production manifest file."
    return ''

  return entry.output
  
# Given a list of paths that may contain globs, resolve the globs and set the `paths` to be an array
# of all the actual paths that `origPaths` expands to
expandPaths = (origPaths, cb) ->
  async.map origPaths, expandPath, (er, results) ->
    paths = []
    for result in results
      if Array.isArray(result)
        paths = paths.concat result
      else
        paths.push result
    cb()

# Take a path that contains a potential glob in it and resolve it to the list of files corresponding to that glob
expandPath = (path, cb) ->
  if path.indexOf("*") is -1
    cb null, path
    return
  
  glob path, {stat: true, strict: true}, (er, files) ->
    cb null, files

getAbsTemplate = (assetType) ->
  if assetType is 'js'
    return (route) -> return "<script src=\'#{route}\'></script>"
  else if assetType is 'css'
    return (route) -> return "<link href=\'#{route}\' rel=\'stylesheet\'>"
  return (route) -> return "#{route}"

# Path route through resolution chain for the specific type of asset
resolveAsset = (assetType, resolvers) ->
  absTemplate = getAbsTemplate assetType
  
  (route) ->
    # return absolute paths right away
    if route.indexOf('http') is 0
      return absTemplate route
      
    for resolver in resolvers
      try
        return resolver[assetType] route
      catch e
        continue
    console.warn "Unable to find asset '#{route}'"
    return route

# Allow people to pass either a filename that refers directly to a css file or an object that has a key which is the
# media target of the stylesheet and a value which is the filename of the css file.
resolveCSS = (resolvers) ->
  cssResolver = resolveAsset 'css', resolvers
  (route) ->
    details = extractMediaType route
    cssLink = cssResolver details.filePath
    return cssLink.replace '>', " media='#{details.mediaType}'>"

extractMediaType = (route) ->
  details = 
    mediaType: 'all'
    filePath: route

  if typeof route isnt 'string'
    for mt, path of route
      details.mediaType = mt
      details.filePath = path
  
  return details
  
# Given a filesystem path, extract the path that would actually be requested by a template
extractRequestPaths = (file, cb) ->
  for path in paths
    if file.indexOf(path) is 0
      extract = file.replace(path + '/', '')
      assetType = extract.substr(0, extract.indexOf('/'))
      extract = extract.substr(assetType.length + 1)
      cb null,
        requested: extract,
        type: assetType
      break;