var vows = require('vows');
var assert = require('assert');
var assetManager = require('../lib/asset-manager.js')

var dev = {"dev":1};
var prod = {"prod":1};

vows.describe('asset-manager')
  .addBatch({
    'DEV MODE': {
      'with multiple app folders': {
        topic: function() {
          assetManager.init({
            paths: ['test/app1', 'test/app2', 'test/app3'],
            context: dev
          }, this.callback);
        },

        'can resolve app1 assets': function () {
          assert.equal(dev.img("arrow.png"), "/img/arrow.png");
          assert.equal(dev.js("app1.js"), "<script src='/js/app1.js'></script>");
          assert.equal(dev.css("app1.css"), "<link rel='stylesheet' href='/css/app1.css' media='all'>");
          assert.equal(dev.css({"screen": "app1.css"}), "<link rel='stylesheet' href='/css/app1.css' media='screen'>");
        },

        'can resolve app2 assets': function () {
          assert.equal(dev.img("arrow2.png"), "/img/arrow2.png");
          assert.equal(dev.js("app2.js"), "<script src='/js/app2.js'></script>");
          assert.equal(dev.css("app2.css"), "<link rel='stylesheet' href='/css/app2.css' media='all'>");
        },

        'can resolve app3 assets': function () {
          assert.equal(dev.img("arrow3.png"), "/img/arrow3.png");
          assert.equal(dev.js("app3.js"), "<script src='/js/app3.js'></script>");
          assert.equal(dev.css("app3.css"), "<link rel='stylesheet' href='/css/app3.css' media='all'>");
        },

        'can override file resolution by naming file same thing': function () {
          assert.equal(dev.css("app2Override.css"), "<link rel='stylesheet' href='/css/app2Override.css' media='all'>");
        }
      }
    },
    'PROD MODE': {
      'with only app1 assets': {
        topic: function() {
          assetManager.init({
            paths: ['test/app1', 'test/app2', 'test/app3'],
            inProd: true,
            builtAssets: 'test/builtAssets',
            context: prod
          }, this.callback);
        },

        'can resolve app1 assets': function () {
          assert.equal(prod.img("arrow.png"), "/img/arrow-d41d8cd98f00b204e9800998ecf8427e.png");
          assert.equal(prod.js("app1.js"), "<script src='/js/app1-29b858db32acb754b5a863b899c58d4d.js'></script>");
          assert.equal(prod.css("app1.css"), "<link rel='stylesheet' href='/css/app1-fcdce6b6d6e2175f6406869882f6f1ce.css' media='all'>");
          assert.equal(prod.css({"screen": "app1.css"}), "<link rel='stylesheet' href='/css/app1-fcdce6b6d6e2175f6406869882f6f1ce.css' media='screen'>");
        },

        'can resolve app2 assets': function () {
          assert.equal(prod.img("arrow2.png"), "/img/arrow2-d41d8cd98f00b204e9800998ecf8427e.png");
          assert.equal(prod.js("app2.js"), "<script src='/js/app2-29b858db32acb754b5a863b899c58d4d.js'></script>");
          assert.equal(prod.css("app2.css"), "<link rel='stylesheet' href='/css/app2-fcdce6b6d6e2175f6406869882f6f1ce.css' media='all'>");
        },

        'can resolve app3 assets': function () {
          assert.equal(prod.img("arrow3.png"), "/img/arrow3-d41d8cd98f00b204e9800998ecf8427e.png");
          assert.equal(prod.js("app3.js"), "<script src='/js/app3-29b858db32acb754b5a863b899c58d4d.js'></script>");
          assert.equal(prod.css("app3.css"), "<link rel='stylesheet' href='/css/app3-fcdce6b6d6e2175f6406869882f6f1ce.css' media='all'>");
        },

        'can override file resolution by naming file same thing': function () {
          assert.equal(prod.css("app2Override.css"), "<link rel='stylesheet' href='/css/app2Override-5de5d96438a417e677a5a7d6b849423f.css' media='all'>");
        }
      }
    }
  }).export(module);