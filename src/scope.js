'use strict';

var _ = require('lodash');

function initWatchVal() { }

function Scope() {
  this.$$watchers = [];
  this.$$lastDirtyWatch = null;
  this.$$asyncQueue = [];
  this.$$applyAsyncQueue = [];
  this.$$phase = null;
  this.$$applyAsyncId = null; //  $applyAsync 里 定时器的 ID
  this.$$postDigestQueue = [];
  this.$$children = [];
  this.$root = this;
  this.$$listeners = {};
}

Scope.prototype.$new = function (isolated, parent) {

  var child;
  parent = parent || this;
  if (isolated) {
    child = new Scope();
    child.$root = parent.$root;
    child.$$asyncQueue = parent.$$asyncQueue;
    child.$$postDigestQueue = parent.$$postDigestQueue;
    child.$$applyAsyncQueue = parent.$$applyAsyncQueue;
  } else {
    var ChildScope = function () { };
    ChildScope.prototype = this;
    child = new ChildScope();
  }

  parent.$$children.push(child);
  child.$$watchers = [];
  child.$$children = [];
  child.$$listeners = {};
  child.$parent = parent;
  return child;
};

Scope.prototype.$watch = function (watchFn, listenerFn, valueEq) {
  var self = this;
  var watcher = {
    watchFn: watchFn,
    listenerFn: listenerFn || function () { },
    last: initWatchVal,
    valueEq: !!valueEq
  };
  this.$$watchers.unshift(watcher);
  this.$root.$$lastDirtyWatch = null;
  return function () {
    var index = self.$$watchers.indexOf(watcher);
    if (index >= 0) {
      self.$$watchers.splice(index, 1);
      self.$root.$$lastDirtyWatch = null;
    }
  };
};

Scope.prototype.$$areEqual = function (newValue, oldValue, valueEq) {
  if (valueEq) {
    return _.isEqual(newValue, oldValue);
  } else {
    return newValue === oldValue || (typeof newValue === 'number' && typeof oldValue === 'number' &&
      isNaN(newValue) && isNaN(oldValue));
  }
};

Scope.prototype.$$everyScope = function (fn) {
  if (fn(this)) {
    return this.$$children.every(function (child) {
      return child.$$everyScope(fn);
    });
  } else {
    return false;
  }
};

Scope.prototype.$$digestOnce = function () {
  var dirty;
  var continueLoop = true;
  var self = this;
  this.$$everyScope(function (scope) {
    var newValue, oldValue;
    _.forEachRight(scope.$$watchers, function (watcher) {
      try {
        if (watcher) {
          newValue = watcher.watchFn(scope);
          oldValue = watcher.last;
          if (!scope.$$areEqual(newValue, oldValue, watcher.valueEq)) {
            self.$root.$$lastDirtyWatch = watcher;
            watcher.last = (watcher.valueEq ? _.cloneDeep(newValue) : newValue);
            watcher.listenerFn(newValue,
              (oldValue === initWatchVal ? newValue : oldValue),
              scope);
            dirty = true;
          } else if (self.$root.$$lastDirtyWatch === watcher) {
            continueLoop = false;
            return false;
          }
        }
      } catch (e) {
        console.error(e);
      }
    });
    return continueLoop;
  });
  return dirty;
};


Scope.prototype.$digest = function () {
  var dirty;
  var ttl = 10;
  this.$root.$$lastDirtyWatch = null;
  this.$beginPhase('$digest');

  /* 
    这段代码放在 do ... while 前， 
    是因为do ... while 根据 scope 值出发监听函数。
    如果放在do/while后，这里对scope的修改，
    就不会触发监听函数了
  */
  if (this.$root.$$applyAsyncId) {
    clearTimeout(this.$root.$$applyAsyncId);
    this.$$flushApplyAsync();
  }

  do {
    while (this.$$asyncQueue.length) {
      try {
        var asyncTask = this.$$asyncQueue.shift();
        asyncTask.scope.$eval(asyncTask.expression);
      } catch (e) {
        console.error(e);
      }
    }
    dirty = this.$$digestOnce();
    if ((dirty || this.$$asyncQueue.length) && !(ttl--)) {
      this.$clearPhase();
      throw '10 digest iterations reached';
    }
  } while (dirty || this.$$asyncQueue.length);
  this.$clearPhase();

  while (this.$$postDigestQueue.length) {
    try {
      this.$$postDigestQueue.shift()();
    } catch (e) {
      console.error(e);
    }
  }
};

Scope.prototype.$beginPhase = function (phase) {
  if (this.$$phase) {
    throw this.$$phase + ' already in progress.';
  }
  this.$$phase = phase;
};

Scope.prototype.$clearPhase = function () {
  this.$$phase = null;
};

Scope.prototype.$eval = function (expr, locals) {
  return expr(this, locals);
};


Scope.prototype.$apply = function (expr) {
  try {
    this.$beginPhase('$apply');
    return this.$eval(expr);
  } finally {
    this.$clearPhase();
    // this.$digest();
    this.$root.$digest();
  }
};


Scope.prototype.$evalAsync = function (expr) {
  var self = this;
  /* 
    这个 self.$$asyncQueue.length 判断条件有啥用
    是个优化条件？asyncQueue 里有元素的话，应该是处在 digest 阶段
    page 72 有解释，但还是不很清楚

    在 $evalAsync 之后紧接着调用 $digest, 会执行随后的 $digest(A) 
    而不是 $evalAsync 定时器里的 $digest(B)
    因为 $evalAsync 调用之后，直接调用 A， B 被定时器包裹会等到下个事件循环
    A 执行完后，再执行定时器函数，这时 $$asyncQueue.length 为 0, 
    所以， B 不会执行 。
   
    -- 由测试案例 
        [calls the listener once when the watch array is empty]
    联想到
  */

  if (!self.$$phase && !self.$$asyncQueue.length) {
    setTimeout(function () {
      if (self.$$asyncQueue.length) {
        // self.$digest();
        self.$root.$digest();
      }
    }, 0);
  }
  this.$$asyncQueue.push({ scope: this, expression: expr });
};

Scope.prototype.$$flushApplyAsync = function () {
  while (this.$$applyAsyncQueue.length) {
    try {
      this.$$applyAsyncQueue.shift()();
    } catch (e) {
      console.error(e);
    }
  }
  this.$root.$$applyAsyncId = null;
};


Scope.prototype.$applyAsync = function (expr) {
  var self = this;
  self.$$applyAsyncQueue.push(function () {
    self.$eval(expr);
  });
  /* 
  // 下面一种更好，没有重复生成定时器
  clearTimeout(self.$$applyAsyncId);
  self.$$applyAsyncId = setTimeout(function () {
    self.$apply(function () {
      while (self.$$applyAsyncQueue.length) {
        self.$$applyAsyncQueue.shift()();
      }
    });
  }, 0); 
  */
  if (self.$root.$$applyAsyncId === null) {
    self.$root.$$applyAsyncId = setTimeout(function () {
      self.$apply(_.bind(self.$$flushApplyAsync, self));
    }, 0);
  }
};

Scope.prototype.$$postDigest = function (fn) {
  this.$$postDigestQueue.push(fn);
};



Scope.prototype.$watchGroup = function (watchFns, listenerFn) {
  var self = this;
  // 这种区分watch的方法很省事
  var newValues = new Array(watchFns.length);
  var oldValues = new Array(watchFns.length);
  var changeReactionScheduled = false;
  var firstRun = true;

  if (watchFns.length === 0) {
    var shouldCall = true;
    self.$evalAsync(function () {
      if (shouldCall) {
        listenerFn(newValues, newValues, self);
      }
    });
    return function () {
      shouldCall = false;
    };
  }

  function watchGroupListener() {
    if (firstRun) {
      firstRun = false;
      listenerFn(newValues, newValues, self);
    } else {
      listenerFn(newValues, oldValues, self);
    }
    changeReactionScheduled = false;
  }

  var destroyFunctions = _.map(watchFns, function (watchFn, i) {
    return self.$watch(watchFn, function (newValue, oldValue) {
      newValues[i] = newValue;
      oldValues[i] = oldValue;
      if (!changeReactionScheduled) {
        changeReactionScheduled = true;
        self.$evalAsync(watchGroupListener);
      }
    });
  });

  return function () {
    _.forEach(destroyFunctions, function (destroyFunction) {
      destroyFunction();
    });
  };

};

Scope.prototype.$destroy = function () {
  if (this.$parent) {
    var siblings = this.$parent.$$children;
    var indexOfThis = siblings.indexOf(this);
    if (indexOfThis >= 0) {
      siblings.splice(indexOfThis, 1);
    }
  }
  this.$$watchers = null;
};

function isArrayLike(obj) {
  if (_.isNull(obj) || _.isUndefined(obj)) {
    return false;
  }
  var length = obj.length;

  // 比下面的书中比较的更好， 支持 { length: 0, otherKey: 'abc' }
  // 这个应该还能优化
  if (length === 0) {
    return _.keys(obj).length === length;
  } else {
    return (_.isNumber(length) && length > 0 && (length - 1) in obj);
  }

  /* return length === 0 ||
  (_.isNumber(length) && length > 0 && (length - 1) in obj); */
}


Scope.prototype.$watchCollection = function (watchFn, listenerFn) {
  var self = this;
  var newValue;
  var oldValue;
  var changeCount = 0;
  // var objLength = 0;
  var oldLength;
  var veryOldValue;
  var trackVeryOldValue = (listenerFn.length > 1);
  var firstRun = true;
  var internalWatchFn = function (scope) {
    var newLength;
    newValue = watchFn(scope);
    if (_.isObject(newValue)) {
      if (isArrayLike(newValue)) {

        // step1
        if (!_.isArray(oldValue)) { // oldValue 永远是合法的数组。因为后面两步
          changeCount++;
          // 为何把旧值设为数组，特性？ 为后续和下次比较准备。需要往 oldValue 添加内容，设置长度
          oldValue = [];
        }

        // step 2
        if (newValue.length !== oldValue.length) {
          changeCount++;
          oldValue.length = newValue.length;
        }

        // step 3
        _.forEach(newValue, function (newItem, i) {
          var bothNaN = _.isNaN(newItem) && _.isNaN(oldValue[i]);
          if (!bothNaN && newItem !== oldValue[i]) {
            changeCount++;
            oldValue[i] = newItem;
          }
        });
        /* 
          检测是否变化 step1 ~ 3， 符合其中一个条件即可了，为和还要并行？
          那么，这么做的原因，除了检测变化，另一个原因是更新数据，
          比如更新长度，数组内容 
        */
      } else {

        if (!_.isObject(oldValue) || isArrayLike(oldValue)) {
          changeCount++;
          oldValue = {};
          oldLength = 0;
        }

        newLength = 0;
        _.forOwn(newValue, function (newVal, key) {
          newLength++;
          if (oldValue.hasOwnProperty(key)) {
            var bothNaN = _.isNaN(newVal) && _.isNaN(oldValue[key]);
            if (!bothNaN && oldValue[key] !== newVal) {
              changeCount++;
              oldValue[key] = newVal;
            }
          } else {
            changeCount++;
            oldLength++; // 为后续比较准备
            oldValue[key] = newVal;
          }

        });

        /* 
        也可以这样实现
        var newLength; 
        if ((newLength = _.keys(newValue).length) !== objLength) {
          objLength = newLength;
          changeCount++;
        } 
        */

        // 是否被删
        if (oldLength > newLength) {
          changeCount++;
          _.forOwn(oldValue, function (oldVal, key) {
            if (!newValue.hasOwnProperty(key)) {
              oldLength--;
              delete oldValue[key];
            }
          });
        }

      }
    } else {
      if (!self.$$areEqual(newValue, oldValue, false)) {
        changeCount++;
      }
      oldValue = newValue;
    }


    return changeCount;
  };
  var internalListenerFn = function () {
    if (firstRun) {
      listenerFn(newValue, newValue, self);
      firstRun = false;
    } else {
      listenerFn(newValue, veryOldValue, self);
    }
    if (trackVeryOldValue) {
      veryOldValue = _.clone(newValue);
    }
  };
  return this.$watch(internalWatchFn, internalListenerFn);
};

Scope.prototype.$on = function (eventName, listener) {
  var listeners = this.$$listeners[eventName];
  if (!listeners) {
    this.$$listeners[eventName] = listeners = [];
  }
  listeners.push(listener);

  return function () {
    var index = listeners.indexOf(listener);
    if (index >= 0) {
      // listeners.splice(index, 1); // not-skit-part-A
      listeners[index] = null;
    }
  };
};


Scope.prototype.$emit = function (eventName) {
  var event = { name: eventName };
  var listenerArgs = [event].concat(_.tail(arguments));
  var scope = this;
  do {
    scope.$$fireEventOnScope(eventName, listenerArgs);
    scope = scope.$parent;
  } while (scope);
  return event;
};

Scope.prototype.$broadcast = function (eventName) {
  var event = { name: eventName };
  var listenerArgs = [event].concat(_.tail(arguments));
  this.$$fireEventOnScope(eventName, listenerArgs);
  return event;
};

Scope.prototype.$$fireEventOnScope = function (eventName, listenerArgs) {
  var listeners = this.$$listeners[eventName] || [];
  /* 
    比下面的循环好些 for test does not skip the next listener when removed on ' + method
  _.forEachRight(listeners, function (listener) { // not-skit-part-B
    listener.apply(null, listenerArgs);
  }); 
  */
  var i = 0;
  while (i < listeners.length) {
    if (listeners[i] === null) {
      listeners.splice(i, 1);
    } else {
      listeners[i].apply(null, listenerArgs);
      i++;
    }
  }
  return event;
};

module.exports = Scope;