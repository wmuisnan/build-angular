'use strict';
var _ = require('lodash');

var ESCAPES = {
  'n': '\n', 'f': '\f', 'r': '\r', 't': '\t',
  'v': '\v', '\'': '\'', '"': '"'
};

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
    } else {
      throw 'Unexpected next character: ' + this.ch;
    }
  }
  return this.tokens;
};


Lexer.prototype.isNumber = function (ch) {
  return '0' <= ch && ch <= '9';
};

Lexer.prototype.isExpOperator = function (ch) {
  return ch === '-' || ch === '+' || this.isNumber(ch);
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

// 传值下一层
AST.prototype.ast = function (text) {
  this.tokens = this.lexer.lex(text);
  return this.program();
  // AST building will be done here
};

AST.prototype.program = function () {
  return { type: AST.Program, body: this.constant() };
};

AST.prototype.constant = function () {
  return { type: AST.Literal, value: this.tokens[0].value };
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
  }
};

ASTCompiler.prototype.escape = function (value) {
  console.log('escape', value);
  if (_.isString(value)) {
    return '\'' +
      value.replace(this.stringEscapeRegex, this.stringEscapeFn) +
      '\'';
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