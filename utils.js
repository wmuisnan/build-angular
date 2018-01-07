var _ = require('lodash');
var timeoutId;
var prevTimeoutId;
var origin = {};
function logLastOne(info, tostring) {
  tostring = tostring === undefined ? true : false;

  if (_.isObject(info)) {
    if (_.isArray(info)) {
      origin.tokens = _.cloneDeep(info);
    } else {
      origin.ast = _.cloneDeep(info);
    }
  } else {
    origin.text = info;
  }

  if (_.isNumber(timeoutId)) return;

  timeoutId = setTimeout(function () {
    console.log(JSON.stringify(origin, null, 2));
    timeoutId = null;
    origin = {};
  }, 150);
}


module.exports = logLastOne;

/* 
    todo
    some["nested"].property.path 就会乱, v0, v1

    function fn(s, l) {
      var
        v0, // path 
        v1, // property 
        v2, // nested 
        v3  // some ;
      if (l && ('some' in l)) { v3 = (l).some; } //


      if (!(l && ('some' in l)) && s && !(s && ('some' in s))) {
        (s).some = {};
      }  //

      if (!(l && ('some' in l)) && s) {
        v3 = (s).some;
      } //

      if (!((v3)['nested'])) {
        (v3)['nested'] = {};
      } //
      if (v3) {
        v2 = (v3)['nested'];
      } //
      if (v2) {
        v1 = (v2).property;
      }
      if (!((v2).property)) {
        (v2).property = {};
      }
      if (v1) { 
        v0 = (v1).path; 
      }
      if (!((v1).path)) { 
        (v1).path = {}; 
      }
      return (v1).path = 42;;
    }
  */

/* 

  1. this.state.body.push('return ', this.recurse(ast.body), ';');
  
  2. this.recurse(ast.body) 
    ast.body: {
      "type": "AssignmentExpression", //2
      "left": {
        "type": "MemberExpression",
        "object": {
          "type": "MemberExpression",
          "object": {
            "type": "MemberExpression",
            "object": {
              "type": "Identifier",
              "name": "some"
            },
            "property": {
              "type": "Literal",
              "value": "nested"
            },
            "computed": true
          },
          "property": {
            "type": "Identifier",
            "name": "property"
          },
          "computed": false
        },
        "property": {
          "type": "Identifier",
          "name": "path"
        },
        "computed": false
      },
      "right": {
        "type": "Literal",
        "value": 42
      }
    }

  3. 解析 AssignmentExpression
     ...
      case AST.AssignmentExpression:
        var leftContext = {};
        this.recurse(ast.left, leftContext, true); // 4
        var leftExpr;
        if (leftContext.computed) {
          leftExpr = this.computedMember(leftContext.context, leftContext.name);
        } else {
          leftExpr = this.nonComputedMember(leftContext.context, leftContext.name);
        }
        return this.assign(leftExpr, this.recurse(ast.right));
     ...
  
  4. this.recurse(ast.left, leftContext, true)
      leftContext： {}
      ast.left: 
      "left": {
        "type": "MemberExpression", // 5 解析 MemberExpression
        "object": {
          "type": "MemberExpression", // 6
          "object": {
            "type": "MemberExpression",
            "object": {
              "type": "Identifier",
              "name": "some"
            },
            "property": {
              "type": "Literal",
              "value": "nested"
            },
            "computed": true
          },
          "property": {
            "type": "Identifier",
            "name": "property"
          },
          "computed": false
        },
        "property": {
          "type": "Identifier",
          "name": "path"
        },
        "computed": false
      },
  5. 解析 MemberExpression
      case AST.MemberExpression:
        intoId = this.nextId(); // 声明第一个变量 v0
        var left = this.recurse(ast.object, undefined, create);  // 6 继续解析
        if (context) {
          context.context = left;
        }
        if (ast.computed) {
          var right = this.recurse(ast.property);
          if (create) {
            this.if_(this.not(this.computedMember(left, right)),
              this.assign(this.computedMember(left, right), '{}'));
          }
          this.if_(left,
            this.assign(intoId, this.computedMember(left, right)));
          if (context) {
            context.name = right;
            context.computed = true;
          }
        } else {
          this.if_(left,
            this.assign(intoId, this.nonComputedMember(left, ast.property.name)));
          if (create) {
            this.if_(this.not(this.nonComputedMember(left, ast.property.name)),
              this.assign(this.nonComputedMember(left, ast.property.name), '{}'));
          }
          if (context) {
            context.name = ast.property.name;
            context.computed = false;
          }
        }
        return intoId;
        
  6. 继续解析 MemberExpression
      MemberExpression: "object": {
        "type": "MemberExpression", // 6
        "object": {
          "type": "MemberExpression", // 7
          "object": {
            "type": "Identifier",
            "name": "some"
          },
          "property": {
            "type": "Literal",
            "value": "nested"
          },
          "computed": true
        },
        "property": {
          "type": "Identifier",
          "name": "property"
        },
        "computed": false
      }, 
      case AST.MemberExpression:
        intoId = this.nextId(); // 声明第一个变量 v0, v1
        
        // 6 继续解析->  v2, v2 = v3["nested"], v2 = {}["nested"]
        var left = this.recurse(ast.object, undefined, create);  
        
        if (context) {
          context.context = left;
        }
        if (ast.computed) {
          var right = this.recurse(ast.property); // -> property
          if (create) {
            this.if_(this.not(this.computedMember(left, right)),
              this.assign(this.computedMember(left, right), '{}'));
          }
          this.if_(left,
            this.assign(intoId, this.computedMember(left, right)));
          if (context) {
            context.name = right;
            context.computed = true;
          }
        } else {
          this.if_(left,
            this.assign(intoId, this.nonComputedMember(left, ast.property.name)));
          if (create) {
            this.if_(this.not(this.nonComputedMember(left, ast.property.name)),
              this.assign(this.nonComputedMember(left, ast.property.name), '{}'));
          }
          if (context) {
            context.name = ast.property.name;
            context.computed = false;
          }
        }
        return intoId;
  
  // 这一步发现出错，非 computed 属性， 也得先创建，后赋值
  7. 继续 MemberExpression -> v2, v2 = v3["nested"], v2 = {}["nested"]
      MemberExpression "object": {
        "type": "MemberExpression", // 7
        "object": {
          "type": "Identifier",     // 8
          "name": "some"
        },
        "property": {
          "type": "Literal",
          "value": "nested"
        },
        "computed": true
      },
      case AST.MemberExpression:
        intoId = this.nextId(); // 声明第一个变量 v0, v1, [v2]
        var left = this.recurse(ast.object, undefined, create);  // 6 继续解析 -> v3 some = {}
        if (context) {
          context.context = left;
        }
        if (ast.computed) {
          var right = this.recurse(ast.property);  // "nested"
          if (create) {
            this.if_(this.not(this.computedMember(left, right)),
              this.assign(this.computedMember(left, right), '{}'));
          }
          this.if_(left,
            this.assign(intoId, this.computedMember(left, right)));
          if (context) {
            context.name = right;
            context.computed = true;
          }
        } else {
          this.if_(left,
            this.assign(intoId, this.nonComputedMember(left, ast.property.name)));
          if (create) {
            this.if_(this.not(this.nonComputedMember(left, ast.property.name)),
              this.assign(this.nonComputedMember(left, ast.property.name), '{}'));
          }
          if (context) {
            context.name = ast.property.name;
            context.computed = false;
          }
        }
        return intoId;   
  
  8. 解析 Identifier 
      Identifier： "object": {
            "type": "Identifier",     // 8
            "name": "some"
          }, 
      case AST.Identifier:
        intoId = this.nextId();   // 声明第一个变量 v0, v1, v2, v3
        this.if_(this.getHasOwnProperty('l', ast.name), 
          this.assign(intoId, this.nonComputedMember('l', ast.name)));
        if (create) {
          this.if_(this.not(this.getHasOwnProperty('l', ast.name)) +
            ' && s && ' +
            this.not(this.getHasOwnProperty('s', ast.name)),
            this.assign(this.nonComputedMember('s', ast.name), '{}'));
        }
        this.if_(this.not(this.getHasOwnProperty('l', ast.name)) + ' && s',
          this.assign(intoId, this.nonComputedMember('s', ast.name)));
        if (context) {
          context.context = this.getHasOwnProperty('l', ast.name) + '?l:s';
          context.name = ast.name;
          context.computed = false;
        }
        return intoId;          
          
  //
  //      
*/