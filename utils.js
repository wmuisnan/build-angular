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