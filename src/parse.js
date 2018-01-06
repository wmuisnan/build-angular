'use strict';
var _ = require('lodash');

var ESCAPES = {
  'n': '\n', 'f': '\f', 'r': '\r', 't': '\t',
  'v': '\v', '\'': '\'', '"': '"'
};

var timeoutId;
var origin = {};
function logLastOne (info, tostring) {
  tostring = tostring === undefined ? true : false;
  //var info = origin;
  origin.info = info;
  if (_.isNumber(timeoutId)) return;
  timeoutId = setTimeout(function () {
    var info = origin.info;
    if (tostring) {
      info = JSON.stringify(info, null, 2);
    }
    console.log(info);
    timeoutId = null;
  }, 50);
}



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
      (this.ch === '.' && this.isNumber(this.peek()))
    ) {
      this.readNumber();
    } else if (this.ch === '\'' || this.ch === '"') {
      this.readString(this.ch); // 很机智啊。直接传进去，不用重新另声明一个变量
    } else if (this.ch === '[' || this.ch === ']' || this.ch === ',') {
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
  var token = { text: text };
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

// 传值下一层
AST.prototype.ast = function (text) {
  this.tokens = this.lexer.lex(text);
  // console.log('tokens', this.tokens);
  return this.program();
  // AST building will be done here
};

AST.prototype.program = function () {
  return { type: AST.Program, body: this.primary() };
};

AST.prototype.primary = function () {
  if (this.expect('[')) {
    return this.arrayDeclaration();
  } else if (this.constants.hasOwnProperty(this.tokens[0].text)) {
    return this.constants[this.consume().text];
  } else {
    return this.constant();
  }
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


AST.prototype.constants = {
  'null': { type: AST.Literal, value: null },
  'true': { type: AST.Literal, value: true },
  'false': { type: AST.Literal, value: false }
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
  this.state = { body: [] };

  // console.log('ast', ast);
  logLastOne(ast);

  this.recurse(ast);

  /* jshint -W054 */
  return new Function(this.state.body.join(''));
  /* jshint +W054 */
};

ASTCompiler.prototype.recurse = function (ast) {
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
  }
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
  var lexer = new Lexer();
  var parser = new Parser(lexer);
  return parser.parse(expr);
}




module.exports = parse;