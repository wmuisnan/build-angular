'use strict';
var _ = require('lodash');
var logLastOne = require('../utils');
var ESCAPES = {
  'n': '\n', 'f': '\f', 'r': '\r', 't': '\t',
  'v': '\v', '\'': '\'', '"': '"'
};


var log = logLastOne;

// 把字符串转成 token 流
function Lexer() {
}

// 传值下一层
Lexer.prototype.lex = function (text) {
  // Tokenization will be done here
  this.text = text; // The original string
  this.index = 0;   // Our current character index in the string
  this.ch = undefined;  // The current character
  this.tokens = [];    // The resulting collection of tokens.
  while (this.index < this.text.length) {
    this.ch = this.text.charAt(this.index);
    if (
      this.isNumber(this.ch) ||
      (this.is('.') && this.isNumber(this.peek()))
    ) {
      this.readNumber();
    } else if (this.is('\'"')) {
      this.readString(this.ch); // 很机智啊。直接传进去，不用重新另声明一个变量
    } else if (this.is('[],{}:.')) {
      this.tokens.push({
        text: this.ch
      });
      this.index++;
    } else if (this.isIdent(this.ch)) {
      this.readIdent();
    } else if (this.isWhitespace(this.ch)) {
      this.index++;
    } else {
      throw 'Unexpected next character: ' + this.ch;
    }
  }
  return this.tokens;
};

/* 
The characters we consider to be whitespace will be the space, 
the carriage return, the horizontal and vertical tabs, 
the newline, and the non-breaking space
*/
Lexer.prototype.isWhitespace = function (ch) {
  return ch === ' ' || ch === '\r' || ch === '\t' ||
    ch === '\n' || ch === '\v' || ch === '\u00A0';
};


Lexer.prototype.isNumber = function (ch) {
  return '0' <= ch && ch <= '9';
};

Lexer.prototype.isExpOperator = function (ch) {
  return ch === '-' || ch === '+' || this.isNumber(ch);
};

// 标识符识别法： 以字母，下划线 或 $ 开头
Lexer.prototype.isIdent = function (ch) {
  return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') ||
    ch === '_' || ch === '$';
};

/* 
returns the next character in the text, 
without moving the current character index forward
*/
Lexer.prototype.peek = function () {
  return this.index < this.text.length - 1 ?
    this.text.charAt(this.index + 1) :
    false;
};



Lexer.prototype.readString = function (quote) {
  this.index++;
  var string = '';
  var escape = false;
  while (this.index < this.text.length) {
    var ch = this.text.charAt(this.index);
    if (escape) {
      if (ch === 'u') {
        var hex = this.text.substring(this.index + 1, this.index + 5);
        this.index += 4;
        string += String.fromCharCode(parseInt(hex, 16));
      } else {
        var replacement = ESCAPES[ch];
        if (replacement) {
          string += replacement;
        } else {
          string += ch;
        }
      }
      escape = false;
    } else if (ch === quote) {
      this.index++;
      this.tokens.push({
        text: string,
        value: string
      });
      return;
    } else if (ch === '\\') {
      escape = true;
    } else {
      string += ch;
    }
    this.index++;
  }
  throw 'Unmatched quote';
};

Lexer.prototype.readNumber = function () {
  var number = '';
  while (this.index < this.text.length) {
    var ch = this.text.charAt(this.index).toLowerCase();
    if (ch === '.' || this.isNumber(ch)) {
      number += ch;
    } else {
      var nextCh = this.peek();
      var prevCh = number.charAt(number.length - 1);
      if (ch === 'e' && this.isExpOperator(nextCh)) {
        number += ch;
      } else if (this.isExpOperator(ch) && prevCh === 'e' &&
        nextCh && this.isNumber(nextCh)) {
        number += ch;
      } else if (this.isExpOperator(ch) && prevCh === 'e' &&
        (!nextCh || !this.isNumber(nextCh))) {
        throw 'Invalid exponent';
      } else {
        break;
      }
    }
    this.index++;
  }

  this.tokens.push({
    text: number,
    value: Number(number)
  });
};

Lexer.prototype.is = function (chs) {
  return chs.indexOf(this.ch) >= 0;
};

/* 读 identifier */
Lexer.prototype.readIdent = function () {
  var text = '';
  while (this.index < this.text.length) {
    var ch = this.text.charAt(this.index);
    if (this.isIdent(ch) || this.isNumber(ch)) {
      text += ch;
    } else {
      break;
    }
    this.index++;
  }
  var token = {
    text: text,
    identifier: true
  };
  this.tokens.push(token);
};


/* 
It takes a Lex- er as an argument. It also has an ast method, 
which will execute the AST building for the tokens of a given expression:
*/

function AST(lexer) {
  this.lexer = lexer;
}


/* 
The value of the type, AST.Program, 
is a “marker constant” defined on the AST function. 
It is used to identify what type of node is being represented. 
Its value is a simple string
*/
AST.Program = 'Program';

AST.Literal = 'Literal';

AST.ArrayExpression = 'ArrayExpression';

AST.ObjectExpression = 'ObjectExpression';

AST.Property = 'Property';

AST.Identifier = 'Identifier';

AST.ThisExpression = 'ThisExpression';

AST.MemberExpression = 'MemberExpression';

// 传值下一层
AST.prototype.ast = function (text) {
  this.tokens = this.lexer.lex(text);
  // console.log('text', text);
  // console.log('tokens', this.tokens);
  logLastOne(text);
  logLastOne(this.tokens);
  return this.program();
  // AST building will be done here
};

AST.prototype.program = function () {
  return { type: AST.Program, body: this.primary() };
};

AST.prototype.primary = function () {
  var primary;
  if (this.expect('[')) {
    primary = this.arrayDeclaration();
  } else if (this.expect('{')) {
    primary = this.object();
  } else if (this.constants.hasOwnProperty(this.tokens[0].text)) {
    primary = this.constants[this.consume().text];
  } else if (this.peek().identifier) {
    primary = this.identifier();
  } else {
    primary = this.constant();
  }

  /*
    解析完一部分，继续往下走，
    当遇到 '.' 时，
  */
  while (this.expect('.')) {
    primary = {
      type: AST.MemberExpression, // 判断当前语句为 MemberExpression
      object: primary, // 把之前的解析结果赋给 object 属性
      property: this.identifier() // 将 '.' 之后的 token 作为标识符处理 
    };
  }
  return primary;
};


AST.prototype.arrayDeclaration = function () {
  var elements = [];
  if (!this.peek(']')) {
    do {
      if (this.peek(']')) { // 支持 尾逗号
        break;
      }
      elements.push(this.primary());
    } while (this.expect(','));
  }
  this.consume(']');
  // return { type: AST.ArrayExpression };
  return { type: AST.ArrayExpression, elements: elements };
};


AST.prototype.object = function () {
  var properties = [];
  if (!this.peek('}')) {
    do {
      var property = { type: AST.Property };
      // constant 不是干掉空格了吗
      // property.key = this.constant();
      if (this.peek().identifier) {
        property.key = this.identifier();
      } else {
        property.key = this.constant();
      }
      this.consume(':');
      property.value = this.primary();
      properties.push(property);
    } while (this.expect(','));
  }
  this.consume('}');
  return { type: AST.ObjectExpression, properties: properties };
};


/**
 * 检测tokens中第一项是否包含特定字符 (不改变tokens)
 * @param {String} e 需要检测的字符 
 * @return {Obeact | undefine}  
 *          e 不存在，返回 tokens 第一项
 *          e 存在， e 与 tokens 第一项相等， 返回 tokens 第一项
 *          e 存在， e 与 tokens 第一项不相等， 返回 undefine
 */
AST.prototype.peek = function (e) {
  if (this.tokens.length > 0) {
    var text = this.tokens[0].text;
    if (text === e || !e) {
      return this.tokens[0];
    }
  }
};


/**
 * 检测 tokens 中第一项是否包含特定字符(会改变 tokens)
 * @param {*} e 用于检测的字符
 * @return {object | undefine} 
 *        存在，则返回 tokens 第一项。
 *        否则 返回 undfined
 */
AST.prototype.expect = function (e) {
  var token = this.peek(e);
  if (token) {
    return this.tokens.shift();
  }
};


/**
 * 检测 tokens 中第一项是否包含特定字符(会改变 tokens)
 * @param {*} e 用于检测的字符
 * @return {object} 
 *        存在，则返回 tokens 第一项。
 * 
 * 与 expect 区别，没有找到符合条件的第一项，expect不会报错，consume 会         
 */
AST.prototype.consume = function (e) {
  var token = this.expect(e);
  if (!token) {
    throw 'Unexpected. Expecting: ' + e;
  }
  return token;
};

/* 解析字面量, 数字或者字符串 */
AST.prototype.constant = function () {
  // return { type: AST.Literal, value: this.tokens[0].value };
  // this.consume() 也是返回 this.tokens[0]， 意义何在。
  // 在于会改变 tokens consume 返回并从 tokens 删除掉第一个
  return { type: AST.Literal, value: this.consume().value };
};


AST.prototype.identifier = function () {
  return { type: AST.Identifier, name: this.consume().text };
};


AST.prototype.constants = {
  'null': { type: AST.Literal, value: null },
  'true': { type: AST.Literal, value: true },
  'false': { type: AST.Literal, value: false },
  'this': { type: AST.ThisExpression }
};



/* 
The AST Compiler is yet another constructor function,
which takes an AST Builder as an argu- ment. 
It has a method called compile,
which compiles an expression into an expression function:
*/

function ASTCompiler(astBuilder) {
  this.astBuilder = astBuilder;
}

// 传值下一层
ASTCompiler.prototype.compile = function (text) {
  var ast = this.astBuilder.ast(text);
  this.state = { body: [], nextId: 0, vars: [] };

  // console.log('ast', ast);
  logLastOne(ast);

  this.recurse(ast);

  /* jshint -W054 */
  return new Function('s', (
    this.state.vars.length ?
      'var ' + this.state.vars.join(',') + ';' :
      ''
  ) + this.state.body.join(''));
  /* jshint +W054 */
};

ASTCompiler.prototype.nextId = function () {
  var id = 'v' + (this.state.nextId++);
  this.state.vars.push(id);
  return id;
};


ASTCompiler.prototype.if_ = function (test, consequent) {
  this.state.body.push('if(', test, '){', consequent, '}');
};

ASTCompiler.prototype.assign = function (id, value) {
  return id + '=' + value + ';';
};

ASTCompiler.prototype.recurse = function (ast) {
  var intoId;
  switch (ast.type) {
    case AST.Program:
      this.state.body.push('return ', this.recurse(ast.body), ';');
      break;
    case AST.Literal:
      return this.escape(ast.value);
    case AST.ArrayExpression:
      var elements = _.map(ast.elements, _.bind(function (element) {
        return this.recurse(element);
      }, this));
      return '[' + elements.join(',') + ']';
    case AST.ObjectExpression:
      var properties = _.map(ast.properties, _.bind(function (property) {
        // var key = this.escape(property.key.value);
        var key = property.key.type === AST.Identifier ?
          property.key.name :
          this.escape(property.key.value);
        var value = this.recurse(property.value);
        return key + ':' + value;
      }, this));
      return '{' + properties.join(',') + '}';
    case AST.Identifier:
      intoId = this.nextId();
      this.if_('s', this.assign(intoId, this.nonComputedMember('s', ast.name)));
      return intoId;
    case AST.ThisExpression:
      return 's';
    case AST.MemberExpression:
      intoId = this.nextId();
      var left = this.recurse(ast.object);
      this.if_(left,
        this.assign(intoId, this.nonComputedMember(left, ast.property.name)));
      return intoId;
  }
};

ASTCompiler.prototype.nonComputedMember = function (left, right) {
  return '(' + left + ').' + right;
};

ASTCompiler.prototype.escape = function (value) {
  if (_.isString(value)) {
    return '\'' +
      // 把特俗字符转为 unicode 字符
      value.replace(this.stringEscapeRegex, this.stringEscapeFn) +
      '\'';
  } else if (_.isNull(value)) {
    return 'null';
  } else {
    return value;
  }
};

ASTCompiler.prototype.stringEscapeRegex = /[^ a-zA-Z0-9]/g;

ASTCompiler.prototype.stringEscapeFn = function (c) {
  return '\\u' + ('0000' + c.charCodeAt(0).toString(16)).slice(-4);
};


/* 
Parser is a constructor function that 
constructs the complete parsing pipeline from the pieces outlined above. 
It takes a Lexer as an argument, and has a method called parse:
*/
function Parser(lexer) {
  this.lexer = lexer;
  this.ast = new AST(this.lexer);
  this.astCompiler = new ASTCompiler(this.ast);
}

// 传值下一层
Parser.prototype.parse = function (text) {
  return this.astCompiler.compile(text);
};



function parse(expr) {
  // timeoutId++; // 为了log, 跟解析器无关
  var lexer = new Lexer();
  var parser = new Parser(lexer);
  return parser.parse(expr);
}




module.exports = parse;