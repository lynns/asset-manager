var buster = require("buster"),
    path = require('path');

buster.testCase("contentResolver tests", {
  setUp: function(){
    this.cr = require('../lib/contentResolver');
  },
  
  "Test single file resolution with NO compression": {
    setUp: function(){
      this.cf = this.cr(['test/app1'], false);
    },
    
    "for a js file": function() {
      var js = this.cf("", "app1", "js", "js");
      assert.equals(path.resolve("test/app1/js/app1.js"), js.getDiskPath());
      assert.equals("alert( 'hello' );", js.getContent());
      assert.equals("alert( 'hello' );", js.getContentRaw());
    },
    
    "for a css file": function() {
      var css = this.cf("", "app1", "css", "css");
      assert.equals(path.resolve("test/app1/css/app1.css"), css.getDiskPath());
      assert.equals("body {}", css.getContent());
    },
    
    "for a img file": function() {
      var img = this.cf("", "arrow", "png", "img");
      assert.equals(path.resolve("test/app1/img/arrow.png"), img.getDiskPath());
    }
  },
  
  "Test single file resolution with compression": {
    setUp: function(){
      this.cf = this.cr(['test/app1'], true);
    },
    
    "for a js file": function() {
      var js = this.cf("", "app1", "js", "js");
      assert.equals(path.resolve("test/app1/js/app1.js"), js.getDiskPath());
      assert.equals("alert(\"hello\")", js.getContent());
      assert.equals("alert( 'hello' );", js.getContentRaw());
    }
  },
  
  "Test assembled module resolution with NO compression": {
    setUp: function(){
      this.cf = this.cr(['test/app1', 'test/app2'], false);
    },
    
    "for a simpleModule": function() {
      var js = this.cf("", "simpleModule", "js", "js");
      assert.equals(path.resolve("test/app2/js/simpleModule/assembly.json"), js.getDiskPath());
      assert.equals("//Module assembly: simpleModule\n\n/*\n * Included File: main.js\n */\n\nvar m=\"main.js\";\n\n", js.getContent());
    },
    
    "for a fullModule": function() {
      var js = this.cf("", "fullModule", "js", "js");
      assert.equals(path.resolve("test/app1/js/fullModule/assembly.json"), js.getDiskPath());
      assert.equals("//Module assembly: fullModule\n\n/*\n * Included File: helpers.js\n */\n\nvar h=\"helper.js\";\n\n/*\n * Included File: main.js\n */\n\nvar m=\"main.js\";\n\n/*\n * Included File: fullModule_en.json\n */\n\nvar lang = {\"title\":\"value\"};\n\n/*\n * Included File: template.html\n */\n\n\nvar snippetsRaw = \"\\n\" + \n\"    html template body\\n\" + \n\"\\n\" + \n\"\";\n\n\nfunction getSnippets(){\nvar snip = document.createElement('div');\n$(snip).html(snippetsRaw.format(lang));\n\nreturn snip;\n}\n\n\n/*\n * Included File: CSS auto import\n */\n\nloadCSS('fullModule.css');\n\n", js.getContent());
    }
  }
});