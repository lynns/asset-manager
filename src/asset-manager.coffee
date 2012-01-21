async     = require 'async'
assets    = require 'connect-assets'
glob      = require 'glob'
fs        = require 'fs'
path      = require 'path'

builtAssets = ''
paths = []
resolvers = []

init = (config, cb) ->
  builtAssets = config.builtAssets ? 'builtAssets'
  
  expandPaths config.paths, () ->
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

      config.use(mw) if config.use
      resolvers.push resolver

    global.css = extractMediaType()
    global.js = resolveAsset 'js'
    global.img = resolveAsset 'img'
    cb() if cb
  
precompile = (config, cb) ->
  config.inProd = true
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
          pathDetail.output = global[pathDetail.type](pathDetail.requested)
          manifest[pathDetail.requested] = pathDetail

        # Write manifest file to `builtAssets` directory
        if not path.existsSync(builtAssets)
          fs.mkdirSync builtAssets, 0755
        fs.writeFileSync "#{builtAssets}/manifest.json", JSON.stringify(manifest)
    
        cb() if cb
      
# Public exports
module.exports.init = init
module.exports.precompile = precompile

# Local Helpers
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

# Path route through resolution chain for the specific type of asset
resolveAsset = (assetType) ->
  (route) ->
    for resolver in resolvers
      try
        return resolver[assetType] route
      catch e
        continue
    console.warn "Unable to find asset '#{route}'"
    return route

# Allow people to pass either a filename that refers directly to a css file or an object that has a key which is the
# media target of the stylesheet and a value which is the filename of the css file.
extractMediaType = ->
  cssResolver = resolveAsset 'css'
  (route) ->
    mediaType = 'all'
    filePath = route

    if typeof route isnt 'string'
      for mt, path of route
        mediaType = mt
        filePath = path

    cssLink = cssResolver filePath

    return cssLink.replace '>', " media='#{mediaType}'>"

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