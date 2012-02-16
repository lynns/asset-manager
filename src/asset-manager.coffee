async           = require 'async'
glob            = require 'glob'
fs              = require 'fs'
path            = require 'path'
rimraf          = require 'rimraf'
crypto          = require 'crypto'
url             = require 'url'
{parser,uglify} = require 'uglify-js'

MANIFEST_NAME = 'manifest.json'
builtAssets = ''
paths = []
manifest = {}
inProd = false
servePath = ''
resolvedPaths = {}

init = (config, cb) ->
  builtAssets = config.builtAssets ? 'builtAssets'
  context = config.context ? global
  inProd = config.inProd ? false
  servePath = config.servePath ? ''

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
    expandPaths config.paths, () ->
      # Output the paths that will be checked when resolving assets
      console.log "Asset Resolution Paths:"
      console.dir paths
      
      # setup route path resolution
      context.js = resolveAssetPath 'js'
      context.css = resolveCSS()
      context.img = resolveAssetPath 'img'

      cb() if cb
  
precompile = (config, cb) ->
  inProd = config.inProd = true
  builtAssets = config.builtAssets ? 'builtAssets'
  context = config.context ? global
  servePath = config.servePath ? ''
  
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
          if not path.existsSync(builtAssets)
            fs.mkdirSync builtAssets, 0755
            
          for pathDetail in pathDetails
            pathDetail.output = context[pathDetail.type](pathDetail.requested)
            meta = resolvedPaths[path.join(pathDetail.type, pathDetail.requested)]
            
            pathDetail.relativePath = meta.relativePath
            outputFilePath = outputFilePathRaw = path.resolve(builtAssets, meta.relativePath)
            if pathDetail.type is 'js'
              pathDetail.relativePathRaw = appendToName(meta.relativePath, "_raw")
              outputFilePathRaw = path.resolve(builtAssets, pathDetail.relativePathRaw)
            pathDetail.fingerprint = meta.fingerprint
            
            manifest[pathDetail.requested] = pathDetail
            
            mkdirRecursiveSync path.dirname(outputFilePath), 0755, ->
              fs.writeFile outputFilePathRaw, meta.content
              if pathDetail.type is 'js'
                meta.content_min = compressJS(meta.content)
                fs.writeFile outputFilePath, meta.content_min

          # Write manifest file to `builtAssets` directory
          fs.writeFileSync manifestLocation(), JSON.stringify(manifest)
          
          cb() if cb

# Local Helpers
manifestLocation = () ->
  return "#{builtAssets}/#{MANIFEST_NAME}"

appendToName = (name, str) ->
  lastDot = name.lastIndexOf '.'
  return "#{name.substr(0,lastDot)}#{str}#{name.substr(lastDot)}"

# Given a route, look up it's request path in the manifest file instead of the filesystem
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

# Express middleware that resolves a static asset file and returns it to the browser
assetMiddleware = (req, res, next) ->
  #only deal with static asset requests
  pathParts = req.url.split "/"
  pathParts = pathParts[1...pathParts.length]
  if pathParts[0] not in ['css', 'js', 'img'] 
    return next()

  route = pathParts.join("/")
  if not doesAssetPathExist(route)
    console.log "Asset '#{route}' cannot be resolved as static asset."
    return next();

  if pathParts[0] is 'css'
    content = (fs.readFileSync resolvedPaths[route].path).toString 'utf8'
    content = fixCSSImagePaths content
    res.send content, {'Content-Type' : 'text/css'}
  else
    res.sendfile resolvedPaths[route].path
  
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

# Return the html template to be used for the given `assetType`
getAbsTemplate = (assetType) ->
  if assetType is 'js'
    return (route) -> return "<script src=\'#{route}\'></script>"
  else if assetType is 'css'
    return (route) -> return "<link href=\'#{route}\' rel=\'stylesheet\'>"
  return (route) -> return "#{route}"

# Checks filesystem to see if route exists in one of our asset paths, 
# caches the absolute path of the resource, and returns the route if it exists
# otherwise, it returns null if the path can't be found.
doesAssetPathExist = (route) ->
  # return from cache if found
  if resolvedPaths[route]
    return true

  # try and resolve in asset paths
  for aPath in paths
    fullPath = path.resolve aPath, route
    if path.existsSync(fullPath)
      resolvedPaths[route] = path: fullPath
      return true

  console.log "Unable to find asset: #{route}"
  return false

# Pass route through resolution chain for the specific type of asset and
# return the path to that asset.
resolveAssetPath = (assetType) ->
  absTemplate = getAbsTemplate assetType
  
  getContents = (path) ->
    if assetType is 'img'
      content = fs.readFileSync(path)
    else
      content = (fs.readFileSync path).toString 'utf8'
      
    if assetType is 'css'
      content = fixCSSImagePaths content
    
    return content
  
  (route) ->
    # return absolute paths right away
    if route?.indexOf('http') is 0
      return absTemplate route
    
    route = path.join assetType, route
    
    if doesAssetPathExist(route)
      if inProd
        resolvedPaths[route].content = getContents(resolvedPaths[route].path)
        route = resolvedPaths[route].relativePath = generateHashedName(route, resolvedPaths[route])
      route = url.resolve servePath, route
      return absTemplate(route)
    
    return ''

# Allow people to pass either a filename that refers directly to a css file or an object that has a key which is the
# media target of the stylesheet and a value which is the filename of the css file.
resolveCSS = () ->
  cssResolver = resolveAssetPath 'css'
  (route) ->
    details = extractMediaType route
    cssLink = cssResolver details.filePath
    return cssLink.replace '>', " media='#{details.mediaType}'>"

resolveImgPath = (path) ->
  resolvedPath = path + ""
  resolvedPath = resolvedPath.replace /url\(|'|"|\)/g, ''
  try
    resolvedPath = img resolvedPath
  catch e
    console.error "Can't resolve image path: #{resolvedPath}"
  if resolvedPath[0] isnt '/'
    resolvedPath = '/' + resolvedPath
  return "url('#{resolvedPath}')"

fixCSSImagePaths = (css) ->
  regex = /url\([^\)]+\)/g
  css = css.replace regex, resolveImgPath
  return css
    
# Hash the file name
generateHashedName = (route, meta) ->
  hash = crypto.createHash('md5')
  # Simulate writing file to disk, including encoding coersions
  # This ensures that the md5 in the name matches the command-line tool.
  hash.update new Buffer(meta.content)
  meta.fingerprint = hash.digest 'hex'
  
  return appendToName(route, "-#{meta.fingerprint}")

# CSS files can be include by passing a string that is the path to the css file OR an object which contains a key that 
# is the media type of the css file and the value is the path to the css file.  This function takes the css 'route' and 
# returns an object with a media type and a path.
extractMediaType = (route) ->
  details = 
    mediaType: 'all'
    filePath: route

  if typeof route isnt 'string'
    for mt, path of route
      details.mediaType = mt
      details.filePath = path
  
  return details

mkdirRecursiveSync = (dir, mode, callback) ->
  pathParts = path.normalize(dir).split '/'
  if path.existsSync dir
    return callback null
    
  mkdirRecursiveSync pathParts.slice(0,-1).join('/'), mode, (err) ->
    return callback err if err and err.errno isnt process.EEXIST
    fs.mkdirSync dir, mode
    callback()

compressJS = (content) ->
  ast = parser.parse content
  ast = uglify.ast_mangle ast
  ast = uglify.ast_squeeze ast
  return uglify.gen_code(ast)

# Public exports
module.exports.init = init
module.exports.precompile = precompile
module.exports.expressMiddleware = assetMiddleware
