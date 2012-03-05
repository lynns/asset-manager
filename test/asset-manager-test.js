var buster = require("buster"),
    rimraf = require('rimraf'),
    fs = require('fs'),
    path = require('path'),
    vm = require('vm');

buster.testCase("Asset Manager", {
  setUp: function(done){
    this.am = require('../lib/asset-manager');
    this.tmpDir = 'tmp';
    fs.mkdirSync(this.tmpDir, 0755);
    
    rimraf('builtAssets', function(){
      done();
    });
  },
  
  tearDown: function(done){
    rimraf(this.tmpDir, function(){
      done();
    });
  },
  
  "Test exports.start": {
    setUp: function() {
      this.context = {};
    },
    
    "in development mode": {
      setUp: function(done) {
        this.am.start({
          paths: ['test/app3'],
          context: this.context
        }, function(){
          done();
        });
      },
      
      "check asset function existence": function(){
        assert.isFunction(this.context.css);
        assert.isFunction(this.context.js);
        assert.isFunction(this.context.img);
      },
      
      "check js resolution": function(){
        assert.equals("<script src='/js/app3.js'></script>", this.context.js("app3.js"));
      },
      
      "check css resolution": function(){
        assert.equals("<link href='/css/app3.css' rel='stylesheet' media='all'>", this.context.css("app3.css"));
      },
      
      "check img resolution": function(){
        assert.equals("/img/arrow3.png", this.context.img("arrow3.png"));
      }
    },
    
    "in production mode": {
      setUp: function(done) {
        this.am.start({
          paths: ['test/app3'],
          context: this.context,
          inProd: true,
          servePath: ""
        }, function(){
          done();
        });
      },
      
      "check asset function existence": function(){
        assert.isFunction(this.context.css);
        assert.isFunction(this.context.js);
        assert.isFunction(this.context.img);
      },
      
      "check js resolution": function(){
        assert.equals("<script src='/js/app3-29b858db32acb754b5a863b899c58d4d.js'></script>", this.context.js("app3.js"));
      },
      
      "check css resolution": function(){
        assert.equals("<link href='/css/app3-fcdce6b6d6e2175f6406869882f6f1ce.css' rel='stylesheet' media='all'>", this.context.css("app3.css"));
      },
      
      "check img resolution": function(){
        assert.equals("/img/arrow3-dd0ecf27272f0daade43058090491241.png", this.context.img("arrow3.png"));
      }
    }
  },
  
  "Test exports.precompile": {
    "only english": function(done) {
      var tmpDir = this.tmpDir;
      this.am.precompile({
        paths: ['test/app3'],
        servePath: "CDNPath",
        builtAssets: tmpDir,
        locales: ["en"]
      }, function(){
        assert.equals(true, path.existsSync(path.join(tmpDir, "js", "app3-29b858db32acb754b5a863b899c58d4d.js")));
        assert.equals(true, path.existsSync(path.join(tmpDir, "js", "app3-29b858db32acb754b5a863b899c58d4d_raw.js")));
        
        assert.equals(true, path.existsSync(path.join(tmpDir, "js", "clientManifest-5f9f3f5165419b036895edcb12b9dae5.js")));
        assert.equals(true, path.existsSync(path.join(tmpDir, "js", "clientManifest-5f9f3f5165419b036895edcb12b9dae5_raw.js")));
        
        assert.equals(true, path.existsSync(path.join(tmpDir, "manifest.json")));
        
        assert.equals(true, path.existsSync(path.join(tmpDir, "css", "app3-fcdce6b6d6e2175f6406869882f6f1ce.css")));
        assert.equals(true, path.existsSync(path.join(tmpDir, "img", "arrow3-dd0ecf27272f0daade43058090491241.png")));
        
        var manifest = fs.readFileSync(path.join(tmpDir, "manifest.json"), 'utf8');
        manifest = JSON.parse(manifest);
        
        assert.defined(manifest['app3.js']);
        assert.defined(manifest['app3.css']);
        assert.defined(manifest['arrow3.png']);
        assert.defined(manifest['clientManifest.js']);
        
        assert.equals("app3.js", manifest['app3.js']["requested"]);
        assert.equals("js", manifest['app3.js']["type"]);
        assert.equals("<script src='CDNPath/js/app3-29b858db32acb754b5a863b899c58d4d.js'></script>", manifest['app3.js']["output"]);
        assert.equals("js/app3-29b858db32acb754b5a863b899c58d4d.js", manifest['app3.js']["relativePath"]);
        assert.equals("29b858db32acb754b5a863b899c58d4d", manifest['app3.js']["fingerprint"]);
        assert.equals("<script src='CDNPath/js/app3-29b858db32acb754b5a863b899c58d4d_raw.js'></script>", manifest['app3.js']["outputRaw"]);
        
        var cManifest = fs.readFileSync(path.join(tmpDir, "js", "clientManifest.js"), 'utf8');
        var context = {};
        vm.runInNewContext(cManifest, context);
        cManifest = context.manifest;
        
        assert.defined(cManifest.css);
        assert.defined(cManifest.js);
        assert.defined(cManifest.img);
        
        assert.defined(cManifest.js['app3']);
        assert.defined(cManifest.css['app3.css']);
        assert.defined(cManifest.img['arrow3.png']);
        
        done();
      });
    },
    
    "other languages that all fallback to english": function(done) {
      var tmpDir = this.tmpDir;
      this.am.precompile({
        paths: ['test/app3'],
        servePath: "CDNPath",
        builtAssets: tmpDir,
        locales: ["en", "es", "zh", "fr"]
      }, function(){
        assert.equals(true, path.existsSync(path.join(tmpDir, "js", "app3-29b858db32acb754b5a863b899c58d4d.js")), "english file doesn't exist");
        assert.equals(true, path.existsSync(path.join(tmpDir, "js", "app3-29b858db32acb754b5a863b899c58d4d_es.js")), "spanish file doesn't exist");
        assert.equals(true, path.existsSync(path.join(tmpDir, "js", "app3-29b858db32acb754b5a863b899c58d4d_zh.js")), "chinese file doesn't exist");
        assert.equals(true, path.existsSync(path.join(tmpDir, "js", "app3-29b858db32acb754b5a863b899c58d4d_fr.js")), "french file doesn't exist");
        
        done();
      });
    },
    
    "//other languages that have other translations": function(done) {
      var tmpDir = this.tmpDir;
      this.am.precompile({
        paths: ['test/app1'],
        servePath: "CDNPath",
        builtAssets: this.tmpDir,
        locales: ["en", "es"]
      }, function(){
        assert.equals(true, path.existsSync(path.join(tmpDir, "js", "fullModule-29b858db32acb754b5a863b899c58d4d.js")));
        assert.equals(true, path.existsSync(path.join(tmpDir, "js", "fullModule-29b858db32acb754b5a863b899c58d4d_es.js")));
        done();
      });
    }
  }
});

////var vows = require('vows');
//var assert = require('assert');
//var assetManager = require('../lib/asset-manager.js')
//var fs = require('fs')
//var path = require('path')
//
//var dev = {
//  "dev":1
//};
//var prod = {
//  "prod":1
//};
//var prod2 = {
//  "prod2":1
//};
//var prod3 = {
//  "prod3":1
//};
//
//vows.describe('asset-manager')
//  .addBatch({
//    'DEV MODE': {
//      'with multiple app folders': {
//        topic: function() {
//          assetManager.init({
//            paths: ['test/app1', 'test/app2', 'test/app3'],
//            context: dev
//          }, this.callback);
//        },
//
//        'can resolve app1 assets': function () {
//          assert.equal(dev.img("arrow.png"), "/img/arrow.png");
//          assert.equal(dev.js("app1.js"), "<script src='/js/app1.js'></script>");
//          assert.equal(dev.css("app1.css"), "<link rel='stylesheet' href='/css/app1.css' media='all'>");
//          assert.equal(dev.css({
//            "screen": "app1.css"
//          }), "<link rel='stylesheet' href='/css/app1.css' media='screen'>");
//        },
//
//        'can resolve app2 assets': function () {
//          assert.equal(dev.img("arrow2.png"), "/img/arrow2.png");
//          assert.equal(dev.js("app2.js"), "<script src='/js/app2.js'></script>");
//          assert.equal(dev.css("app2.css"), "<link rel='stylesheet' href='/css/app2.css' media='all'>");
//        },
//
//        'can resolve app3 assets': function () {
//          assert.equal(dev.img("arrow3.png"), "/img/arrow3.png");
//          assert.equal(dev.js("app3.js"), "<script src='/js/app3.js'></script>");
//          assert.equal(dev.css("app3.css"), "<link rel='stylesheet' href='/css/app3.css' media='all'>");
//        },
//
//        'can override file resolution by naming file same thing': function () {
//          assert.equal(dev.css("app2Override.css"), "<link rel='stylesheet' href='/css/app2Override.css' media='all'>");
//        },
//
//        'can pass in absolute urls': function () {
//          assert.equal(dev.img("http://my.abs.path/abs.png"), "http://my.abs.path/abs.png");
//          assert.equal(dev.js("http://my.abs.path/abs.js"), "<script src='http://my.abs.path/abs.js'></script>");
//          assert.equal(dev.css("http://my.abs.path/abs.css"), "<link href='http://my.abs.path/abs.css' rel='stylesheet' media='all'>");
//        }
//      }
//    },
//    'PROD MODE - NO Manifest': {
//      'with multiple app folders': {
//        topic: function() {
//          assetManager.init({
//            paths: ['test/app1', 'test/app2', 'test/app3'],
//            inProd: true,
//            builtAssets: 'test/builtAssets',
//            context: prod
//          }, this.callback);
//        },
//
//        'can resolve app1 assets': function () {
//          assert.equal(prod.img("arrow.png"), "/img/arrow-d41d8cd98f00b204e9800998ecf8427e.png");
//          assert.equal(prod.js("app1.js"), "<script src='/js/app1-29b858db32acb754b5a863b899c58d4d.js'></script>");
//          assert.equal(prod.css("app1.css"), "<link rel='stylesheet' href='/css/app1-fcdce6b6d6e2175f6406869882f6f1ce.css' media='all'>");
//          assert.equal(prod.css({
//            "screen": "app1.css"
//          }), "<link rel='stylesheet' href='/css/app1-fcdce6b6d6e2175f6406869882f6f1ce.css' media='screen'>");
//        },
//
//        'can resolve app2 assets': function () {
//          assert.equal(prod.img("arrow2.png"), "/img/arrow2-d41d8cd98f00b204e9800998ecf8427e.png");
//          assert.equal(prod.js("app2.js"), "<script src='/js/app2-29b858db32acb754b5a863b899c58d4d.js'></script>");
//          assert.equal(prod.css("app2.css"), "<link rel='stylesheet' href='/css/app2-fcdce6b6d6e2175f6406869882f6f1ce.css' media='all'>");
//        },
//
//        'can resolve app3 assets': function () {
//          assert.equal(prod.img("arrow3.png"), "/img/arrow3-d41d8cd98f00b204e9800998ecf8427e.png");
//          assert.equal(prod.js("app3.js"), "<script src='/js/app3-29b858db32acb754b5a863b899c58d4d.js'></script>");
//          assert.equal(prod.css("app3.css"), "<link rel='stylesheet' href='/css/app3-fcdce6b6d6e2175f6406869882f6f1ce.css' media='all'>");
//        },
//
//        'can override file resolution by naming file same thing': function () {
//          assert.equal(prod.css("app2Override.css"), "<link rel='stylesheet' href='/css/app2Override-5de5d96438a417e677a5a7d6b849423f.css' media='all'>");
//        },
//
//        'can pass in absolute urls': function () {
//          assert.equal(prod.img("http://my.abs.path/abs.png"), "http://my.abs.path/abs.png");
//          assert.equal(prod.js("http://my.abs.path/abs.js"), "<script src='http://my.abs.path/abs.js'></script>");
//          assert.equal(prod.css("http://my.abs.path/abs.css"), "<link href='http://my.abs.path/abs.css' rel='stylesheet' media='all'>");
//        }
//      }
//    },
//    'Precompile Assets': {
//      'with multiple app folders': {
//        topic: function() {
//          assetManager.precompile({
//            paths: ['test/app1', 'test/app2', 'test/app3'],
//            builtAssets: 'test/builtAssets2',
//            context: prod2
//          }, this.callback);
//        },
//
//        'manifest file should contain asset metadata': function () {
//          var jsonFile = fs.readFileSync('test/builtAssets2/manifest.json', 'utf8');
//          var manifest = JSON.parse(jsonFile);
//          
//          var appCss = manifest['app1.css'];
//          assert.equal(appCss.requested, "app1.css");
//          assert.equal(appCss.type, "css");
//          assert.equal(appCss.fingerprint, "fcdce6b6d6e2175f6406869882f6f1ce");
//          assert.equal(appCss.relativePath, "css/app1-fcdce6b6d6e2175f6406869882f6f1ce.css");
//          assert.equal(appCss.output, "<link rel='stylesheet' href='/css/app1-fcdce6b6d6e2175f6406869882f6f1ce.css' media='all'>");
//          
//          var arrow = manifest['arrow.png'];
//          assert.equal(arrow.requested, "arrow.png");
//          assert.equal(arrow.type, "img");
//          // TODO: connect-assets image fingerprinting is broken...uncomment these when it works again
//          // assert.equal(arrow.fingerprint, "dd0ecf27272f0daade43058090491241");
//          // assert.equal(arrow.relativePath, "img/arrow-dd0ecf27272f0daade43058090491241.png");
//          assert.equal(arrow.fingerprint, "d41d8cd98f00b204e9800998ecf8427e");
//          assert.equal(arrow.relativePath, "img/arrow-d41d8cd98f00b204e9800998ecf8427e.png");
//          assert.equal(arrow.output, "/img/arrow-d41d8cd98f00b204e9800998ecf8427e.png");
//          
//          var keyCount = 0;
//          for(var key in manifest)
//            keyCount++;
//          assert.equal(keyCount, 10);
//        },
//
//        'builtAssets2 folder should contain precompiled assets': function () {
//          assert.equal(path.existsSync('test/builtAssets2/css/app1-fcdce6b6d6e2175f6406869882f6f1ce.css'), true);
//          assert.equal(path.existsSync('test/builtAssets2/css/app2-fcdce6b6d6e2175f6406869882f6f1ce.css'), true);
//          assert.equal(path.existsSync('test/builtAssets2/css/app2Override-5de5d96438a417e677a5a7d6b849423f.css'), true);
//          assert.equal(path.existsSync('test/builtAssets2/css/app3-fcdce6b6d6e2175f6406869882f6f1ce.css'), true);
//          assert.equal(path.existsSync('test/builtAssets2/img/arrow-d41d8cd98f00b204e9800998ecf8427e.png'), true);
//          assert.equal(path.existsSync('test/builtAssets2/img/arrow2-d41d8cd98f00b204e9800998ecf8427e.png'), true);
//          assert.equal(path.existsSync('test/builtAssets2/img/arrow3-d41d8cd98f00b204e9800998ecf8427e.png'), true);
//          assert.equal(path.existsSync('test/builtAssets2/js/app1-29b858db32acb754b5a863b899c58d4d.js'), true);
//          assert.equal(path.existsSync('test/builtAssets2/js/app2-29b858db32acb754b5a863b899c58d4d.js'), true);
//          assert.equal(path.existsSync('test/builtAssets2/js/app3-29b858db32acb754b5a863b899c58d4d.js'), true);
//        },
//      
//      
//        'Serve Precompiled Assets from manifest.json': {
//          'with multiple app folders': {
//            topic: function() {
//              assetManager.init({
//                paths: ['test/app1', 'test/app2', 'test/app3'],
//                builtAssets: 'test/builtAssets2',
//                inProd: true,
//                context: prod3
//              }, this.callback);
//            },
//
//            'can resolve app1 assets': function () {
//              assert.equal(prod3.img("arrow.png"), "/img/arrow-d41d8cd98f00b204e9800998ecf8427e.png");
//              assert.equal(prod3.js("app1.js"), "<script src='/js/app1-29b858db32acb754b5a863b899c58d4d.js'></script>");
//              assert.equal(prod3.css("app1.css"), "<link rel='stylesheet' href='/css/app1-fcdce6b6d6e2175f6406869882f6f1ce.css' media='all'>");
//              assert.equal(prod3.css({
//                "screen": "app1.css"
//              }), "<link rel='stylesheet' href='/css/app1-fcdce6b6d6e2175f6406869882f6f1ce.css' media='screen'>");
//            },
//
//            'can resolve app2 assets': function () {
//              assert.equal(prod3.img("arrow2.png"), "/img/arrow2-d41d8cd98f00b204e9800998ecf8427e.png");
//              assert.equal(prod3.js("app2.js"), "<script src='/js/app2-29b858db32acb754b5a863b899c58d4d.js'></script>");
//              assert.equal(prod3.css("app2.css"), "<link rel='stylesheet' href='/css/app2-fcdce6b6d6e2175f6406869882f6f1ce.css' media='all'>");
//            },
//
//            'can resolve app3 assets': function () {
//              assert.equal(prod3.img("arrow3.png"), "/img/arrow3-d41d8cd98f00b204e9800998ecf8427e.png");
//              assert.equal(prod3.js("app3.js"), "<script src='/js/app3-29b858db32acb754b5a863b899c58d4d.js'></script>");
//              assert.equal(prod3.css("app3.css"), "<link rel='stylesheet' href='/css/app3-fcdce6b6d6e2175f6406869882f6f1ce.css' media='all'>");
//            },
//
//            'can pass in absolute urls': function () {
//              assert.equal(prod3.img("http://my.abs.path/abs.png"), "http://my.abs.path/abs.png");
//              assert.equal(prod3.js("http://my.abs.path/abs.js"), "<script src='http://my.abs.path/abs.js'></script>");
//              assert.equal(prod3.css("http://my.abs.path/abs.css"), "<link href='http://my.abs.path/abs.css' rel='stylesheet' media='all'>");
//            }
//          }
//        }
//      }
//    }
//  }).export(module);