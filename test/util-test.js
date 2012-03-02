var buster = require("buster"),
    fs = require('fs'),
    path = require('path');

buster.testCase("Utils tests", {
  setUp: function(){
    this.utils = require('../lib/utils');
  },
  
  "Test mkdirRecursiveSync": {
    setUp: function(){
      this.baseFolder = "test/tmp";
      fs.mkdirSync(this.baseFolder);
    },
    
    tearDown: function(){
      fs.rmdirSync(this.baseFolder);
    },
    
    "make a single folder": function() {
      var folder = this.baseFolder + "/test1";
      assert.same(true, this.utils.mkdirRecursiveSync(folder));
      assert.same(true, path.existsSync(folder));
      
      fs.rmdirSync(folder);
    },
    
    "make a nested folder": function() {
      var folder = this.baseFolder + "/more/test1";
      assert.same(true, this.utils.mkdirRecursiveSync(folder));
      assert.same(true, path.existsSync(folder));
      
      fs.rmdirSync(folder);
      fs.rmdirSync(this.baseFolder + "/more");
    }
  },
    
  "Test expandPaths": {
    "expand a single path": function(done){
      var basePaths = ['test/app1'];
      this.utils.expandPaths(basePaths, function(paths) {
        assert.same(paths.length, 1);
        assert.same(paths[0], "test/app1");
        done();
      });
    },
  
    "expand multiple paths": function(done){
      var basePaths = ['test/app1', 'test/app2'];
      this.utils.expandPaths(basePaths, function(paths) {
        assert.same(paths.length, 2);
        assert.same(paths[0], "test/app1");
        assert.same(paths[1], "test/app2");
        done();
      });
    },
  
    "expand wildcard path": function(done){
      var basePaths = ['test/*'];
      this.utils.expandPaths(basePaths, function(paths) {
        assert.same(paths.length, 3);
        assert.same(paths[0], "test/app1");
        assert.same(paths[1], "test/app2");
        assert.same(paths[2], "test/app3");
        done();
      });
    },
  
    "expand invalid path": function(done){
      var basePaths = ['noPath/here'];
      this.utils.expandPaths(basePaths, function(paths) {
        assert.same(paths.length, 0);
        done();
      });
    }
  },

  "Test compressJS": {
    "Compressing a typical JS string": function(){
      var jsString = "var j = 1;";
      var compressed = this.utils.compressJS(jsString);
    
      assert.typeOf(compressed, "string");
      assert.equals("var j=1", compressed);
    }
  },

  "Test generateHash": {
    "Hash a string": function(){
      var s = "This is my string";
      var hash = this.utils.generateHash(s);
    
      assert.typeOf(hash, "string");
      assert.equals("c2a9ce57e8df081b4baad80d81868bbb", hash);
    
      s = s + " ";
      var hash2 = this.utils.generateHash(s);
    
      refute.equals(hash, hash2);
    }
  },

  "Test convertHTMLtoJS": {
    setUp: function(){
      this.appendSnippetCode = function(js) {
        return js + "\n\n\nfunction getSnippets(){\nvar snip = document.createElement('div');\n$(snip).html(snippetsRaw);\n\nreturn snip;\n}\n";
      };
    },
  
    "convert plain text body content": function(){
      var html = "<html><body>MyText</body></html>";
      var js = this.utils.convertHTMLtoJS(html);
    
      assert.typeOf(js, "string");
      assert.equals(this.appendSnippetCode("\nvar snippetsRaw = \"MyText\\n\" + \n\"\";"), js);
    },
  
    "convert body with tags": function(){
      var html = "<html><body><a href='hello'>MyText</a></body></html>";
      var js = this.utils.convertHTMLtoJS(html);
    
      assert.typeOf(js, "string");
      assert.equals(this.appendSnippetCode("\nvar snippetsRaw = \"<a href='hello'>MyText</a>\\n\" + \n\"\";"), js);
    },
  
    "convert body with tags and double quotes": function(){
      var html = "<html><body><a href=\"hello\">MyText</a></body></html>";
      var js = this.utils.convertHTMLtoJS(html);
    
      assert.typeOf(js, "string");
      assert.equals(this.appendSnippetCode("\nvar snippetsRaw = \"<a href=\\\"hello\\\">MyText</a>\\n\" + \n\"\";"), js);
    },
  
    "convert multiline body": function(){
      var html = "<html><body>MyText\nNewLine</body></html>";
      var js = this.utils.convertHTMLtoJS(html);
    
      assert.typeOf(js, "string");
      assert.equals(this.appendSnippetCode("\nvar snippetsRaw = \"MyText\\n\" + \n\"NewLine\\n\" + \n\"\";"), js);
    },
  
    "convert html with exclude lines": function(){
      var html = "<html><body>MyText\nRemoveLine<!-- exclude LINE -->\nLastLine</body></html>";
      var js = this.utils.convertHTMLtoJS(html);
    
      assert.typeOf(js, "string");
      assert.equals(this.appendSnippetCode("\nvar snippetsRaw = \"MyText\\n\" + \n\"LastLine\\n\" + \n\"\";"), js);
    },
  
    "convert html with multiline exclude comments": function(){
      var html = "<html><body>MyText\n<!-- exclude START -->\nRemoveLine1\nRemoveLine2\n<!-- exclude END -->\nLastLine</body></html>";
      var js = this.utils.convertHTMLtoJS(html);
    
      assert.typeOf(js, "string");
      assert.equals(this.appendSnippetCode("\nvar snippetsRaw = \"MyText\\n\" + \n\"LastLine\\n\" + \n\"\";"), js);
    }
  }
});
  
//  "Checks if a string path is accepted": function () {
//    this.config.paths = "path1";
//    var wrangler = require("../lib/assetWrangler")(this.config);
//    
//    var paths = wrangler.getPaths();
//    
//    assert.typeOf(paths, "object");
//    assert.equals(1, paths.length);
//  },
//  
//  "No config.paths should get default path value": function () {
//    var wrangler = require("../lib/assetWrangler")(this.config);
//
//    var paths = wrangler.getPaths();
//
//    assert.typeOf(paths, "object");
//    assert.equals(1, paths.length);
//    assert.equals("assets", paths[0]);
//  },
//  
//  "No config object should just get defaults": function () {
//    var wrangler = require("../lib/assetWrangler")();
//
//    var paths = wrangler.getPaths();
//
//    assert.typeOf(paths, "object");
//    assert.equals(1, paths.length);
//    assert.equals("assets", paths[0]);
//  }
//buster.testCase("Test Reading Module Dependencies", {
//  setUp: function(){
//    this.config = {
//      paths: 'test/assets'
//    };
//  },
//  
//  "Assemble bundles": function () {
//    var wrangler = require("../lib/assetWrangler")(this.config);
//    
//    wrangler.assembleBundles();
//    assert(true);
//  }
//});