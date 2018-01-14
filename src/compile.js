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
          return _.map(factories, function (factory, i) {
            var directive = $injector.invoke(factory);
            directive.restrict = directive.restrict || 'EA';
            directive.priority = directive.priority || 0;
            directive.name = directive.name || name;
            directive.index = i;
            return directive;
          });
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

    function addDirective(directives, name, mode) {
      if (hasDirectives.hasOwnProperty(name)) {
        // directives.push.apply(directives, $injector.get(name + 'Directive'));
        var foundDirectives = $injector.get(name + 'Directive');
        var applicableDirectives = _.filter(foundDirectives, function (dir) {
          return dir.restrict.indexOf(mode) !== -1;
        });
        directives.push.apply(directives, applicableDirectives);
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
        var terminal = applyDirectivesToNode(directives, node);

        // 如果有子级，递归找下去
        if (!terminal && node.childNodes && node.childNodes.length) {
          compileNodes(node.childNodes);
        }
      });
    }

    function byPriority(a, b) {
      var diff = b.priority - a.priority;
      if (diff !== 0) {
        return diff;
      } else {
        if (a.name !== b.name) {
          return (a.name < b.name ? -1 : 1);
        } else {
          return a.index - b.index;
        }
      }
    }

    // 找指令
    function collectDirectives(node) {
      var directives = [];
      if (node.nodeType === Node.ELEMENT_NODE) {
        var normalizedNodeName = directiveNormalize(nodeName(node).toLowerCase());
        addDirective(directives, normalizedNodeName, 'E');
        _.forEach(node.attributes, function (attr) {
          var normalizedAttrName = directiveNormalize(attr.name.toLowerCase());
          if (/^ngAttr[A-Z]/.test(normalizedAttrName)) {
            normalizedAttrName =
              normalizedAttrName[6].toLowerCase() +
              normalizedAttrName.substring(7);
          }
          addDirective(directives, normalizedAttrName, 'A');
        });
        _.forEach(node.classList, function (cls) {
          var normalizedClassName = directiveNormalize(cls);
          addDirective(directives, normalizedClassName, 'C');
        });
      } else if (node.nodeType === Node.COMMENT_NODE) {
        var match = /^\s*directive\:\s*([\d\w\-_]+)/.exec(node.nodeValue);
        if (match) {
          addDirective(directives, directiveNormalize(match[1]), 'M');
        }
      }


      directives.sort(byPriority);

      return directives;
    }

    // 应用指令, 把元素丢到指令里去
    function applyDirectivesToNode(directives, compileNode) {
      var $compileNode = $(compileNode);
      var terminalPriority = -Number.MAX_VALUE;
      var terminal = false;
      _.forEach(directives, function (directive) {
        if (directive.priority < terminalPriority) {
          return false;
        }
        if (directive.compile) {
          directive.compile($compileNode);
        }
        if (directive.terminal) {
          terminal = true;
          terminalPriority = directive.priority;
        }
      });
      return terminal;
    }

    return compile;
  }];
}

$CompileProvider.$inject = ['$provide'];

module.exports = $CompileProvider;