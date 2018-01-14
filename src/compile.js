'use strict';
var _ = require('lodash');
var $ = require('jquery');



function $CompileProvider($provide) {
  var hasDirectives = {};




  this.directive = function (name, directiveFactory) {
    if (_.isString(name)) {
      if (name === 'hasOwnProperty') {
        throw 'hasOwnProperty is not a valid directive name';
      }
      if (!hasDirectives.hasOwnProperty(name)) {
        hasDirectives[name] = [];
        $provide.factory(name + 'Directive', ['$injector', function ($injector) {
          console.log('directive run');
          var factories = hasDirectives[name];
          return _.map(factories, $injector.invoke);
        }]);

      }
      hasDirectives[name].push(directiveFactory);
    } else {
      _.forEach(name, _.bind(function (directiveFactory, name) {
        this.directive(name, directiveFactory);
      }, this));
    }

  };



  this.$get = ['$injector', function ($injector) {

    var PREFIX_REGEXP = /(x[\:\-_]|data[\:\-_])/i;

    function directiveNormalize(name) {
      return _.camelCase(name.replace(PREFIX_REGEXP, ''));
    }

    function addDirective(directives, name) {
      if (hasDirectives.hasOwnProperty(name)) {
        directives.push.apply(directives, $injector.get(name + 'Directive'));
      }
    }

    function nodeName(element) {
      return element.nodeName ? element.nodeName : element[0].nodeName;
    }

    function compile($compileNodes) {
      return compileNodes($compileNodes);
    }

    // 编译元素： 找指令，把元素丢到指令里去
    function compileNodes($compileNodes) {
      _.forEach($compileNodes, function (node) {
        // 找指令
        var directives = collectDirectives(node);
        // 把元素丢到指令里去
        applyDirectivesToNode(directives, node);

        // 如果有子级，递归找下去
        if (node.childNodes && node.childNodes.length) {
          compileNodes(node.childNodes);
        }
      });
    }

    // 找指令
    function collectDirectives(node) {
      var directives = [];
      var normalizedNodeName = directiveNormalize(nodeName(node).toLowerCase());
      addDirective(directives, normalizedNodeName);
      _.forEach(node.attributes, function (attr) {
        var normalizedAttrName = directiveNormalize(attr.name.toLowerCase());
        if (/^ngAttr[A-Z]/.test(normalizedAttrName)) {
          normalizedAttrName =
            normalizedAttrName[6].toLowerCase() +
            normalizedAttrName.substring(7);
        }
        addDirective(directives, normalizedAttrName);
      });
      return directives;
    }

    // 应用指令, 把元素丢到指令里去
    function applyDirectivesToNode(directives, compileNode) {
      var $compileNode = $(compileNode);
      _.forEach(directives, function (directive) {
        if (directive.compile) {
          directive.compile($compileNode);
        }
      });
    }

    return compile;
  }];
}

$CompileProvider.$inject = ['$provide'];

module.exports = $CompileProvider;