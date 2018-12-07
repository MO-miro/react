/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

'use strict';

const React = require('./src/React');

const log = window.console.log;
window.log = log;
let i = 0;
log(`
  要启动源码里面的日志，请设置 window.__DEV__ = true
  这时候会改变 console.log 的默认行为，旧的console.log绑定到了 window.log上
`)
window.console.log = function(name, obj) {
  if (!window.__DEV__) {
    return log.call(null, ...arguments);
  }
  const args = [`${i++} - ${name}`];
  if (obj) {
    args[0] = `${args[0]}====> `;
    Object.entries(obj).forEach(([key, value]) => {
      args.push(`${key}:`);
      let _value = '';
      switch (typeof value) {
        case 'object':
          if (Array.isArray(value)) {
            try {
              _value = JSON.stringify(value) + '; ';
            } catch (e) {
              _value = value;
            }
          } else {
            _value = value;
          }
          break;
        case 'function':
          _value = value.name + '; ';
          break;
        default:
          _value = (value && value.toString) ? value.toString() + '; ' : value;
      }
      args.push(_value);
    });
  }
  log.apply(this, args);
};


// TODO: decide on the top-level export form.
// This is hacky but makes it work with both Rollup and Jest.
module.exports = React.default || React;
