"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// node_modules/.pnpm/ws@8.22.0/node_modules/ws/lib/constants.js
var require_constants = __commonJS({
  "node_modules/.pnpm/ws@8.22.0/node_modules/ws/lib/constants.js"(exports2, module2) {
    "use strict";
    var BINARY_TYPES = ["nodebuffer", "arraybuffer", "fragments"];
    var hasBlob = typeof Blob !== "undefined";
    if (hasBlob) BINARY_TYPES.push("blob");
    module2.exports = {
      BINARY_TYPES,
      CLOSE_TIMEOUT: 3e4,
      EMPTY_BUFFER: Buffer.alloc(0),
      GUID: "258EAFA5-E914-47DA-95CA-C5AB0DC85B11",
      hasBlob,
      kForOnEventAttribute: /* @__PURE__ */ Symbol("kIsForOnEventAttribute"),
      kListener: /* @__PURE__ */ Symbol("kListener"),
      kStatusCode: /* @__PURE__ */ Symbol("status-code"),
      kWebSocket: /* @__PURE__ */ Symbol("websocket"),
      NOOP: () => {
      }
    };
  }
});

// node_modules/.pnpm/ws@8.22.0/node_modules/ws/lib/buffer-util.js
var require_buffer_util = __commonJS({
  "node_modules/.pnpm/ws@8.22.0/node_modules/ws/lib/buffer-util.js"(exports2, module2) {
    "use strict";
    var { EMPTY_BUFFER } = require_constants();
    var FastBuffer = Buffer[Symbol.species];
    function concat(list, totalLength) {
      if (list.length === 0) return EMPTY_BUFFER;
      if (list.length === 1) return list[0];
      const target = Buffer.allocUnsafe(totalLength);
      let offset = 0;
      for (let i = 0; i < list.length; i++) {
        const buf = list[i];
        target.set(buf, offset);
        offset += buf.length;
      }
      if (offset < totalLength) {
        return new FastBuffer(target.buffer, target.byteOffset, offset);
      }
      return target;
    }
    function _mask(source, mask, output, offset, length) {
      for (let i = 0; i < length; i++) {
        output[offset + i] = source[i] ^ mask[i & 3];
      }
    }
    function _unmask(buffer, mask) {
      for (let i = 0; i < buffer.length; i++) {
        buffer[i] ^= mask[i & 3];
      }
    }
    function toArrayBuffer(buf) {
      if (buf.length === buf.buffer.byteLength) {
        return buf.buffer;
      }
      return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length);
    }
    function toBuffer(data) {
      toBuffer.readOnly = true;
      if (Buffer.isBuffer(data)) return data;
      let buf;
      if (data instanceof ArrayBuffer) {
        buf = new FastBuffer(data);
      } else if (ArrayBuffer.isView(data)) {
        buf = new FastBuffer(data.buffer, data.byteOffset, data.byteLength);
      } else {
        buf = Buffer.from(data);
        toBuffer.readOnly = false;
      }
      return buf;
    }
    module2.exports = {
      concat,
      mask: _mask,
      toArrayBuffer,
      toBuffer,
      unmask: _unmask
    };
    if (!process.env.WS_NO_BUFFER_UTIL) {
      try {
        const bufferUtil = require("bufferutil");
        module2.exports.mask = function(source, mask, output, offset, length) {
          if (length < 48) _mask(source, mask, output, offset, length);
          else bufferUtil.mask(source, mask, output, offset, length);
        };
        module2.exports.unmask = function(buffer, mask) {
          if (buffer.length < 32) _unmask(buffer, mask);
          else bufferUtil.unmask(buffer, mask);
        };
      } catch (e) {
      }
    }
  }
});

// node_modules/.pnpm/ws@8.22.0/node_modules/ws/lib/limiter.js
var require_limiter = __commonJS({
  "node_modules/.pnpm/ws@8.22.0/node_modules/ws/lib/limiter.js"(exports2, module2) {
    "use strict";
    var kDone = /* @__PURE__ */ Symbol("kDone");
    var kRun = /* @__PURE__ */ Symbol("kRun");
    var Limiter = class {
      /**
       * Creates a new `Limiter`.
       *
       * @param {Number} [concurrency=Infinity] The maximum number of jobs allowed
       *     to run concurrently
       */
      constructor(concurrency) {
        this[kDone] = () => {
          this.pending--;
          this[kRun]();
        };
        this.concurrency = concurrency || Infinity;
        this.jobs = [];
        this.pending = 0;
      }
      /**
       * Adds a job to the queue.
       *
       * @param {Function} job The job to run
       * @public
       */
      add(job) {
        this.jobs.push(job);
        this[kRun]();
      }
      /**
       * Removes a job from the queue and runs it if possible.
       *
       * @private
       */
      [kRun]() {
        if (this.pending === this.concurrency) return;
        if (this.jobs.length) {
          const job = this.jobs.shift();
          this.pending++;
          job(this[kDone]);
        }
      }
    };
    module2.exports = Limiter;
  }
});

// node_modules/.pnpm/ws@8.22.0/node_modules/ws/lib/permessage-deflate.js
var require_permessage_deflate = __commonJS({
  "node_modules/.pnpm/ws@8.22.0/node_modules/ws/lib/permessage-deflate.js"(exports2, module2) {
    "use strict";
    var zlib = require("zlib");
    var bufferUtil = require_buffer_util();
    var Limiter = require_limiter();
    var { kStatusCode } = require_constants();
    var FastBuffer = Buffer[Symbol.species];
    var TRAILER = Buffer.from([0, 0, 255, 255]);
    var kPerMessageDeflate = /* @__PURE__ */ Symbol("permessage-deflate");
    var kTotalLength = /* @__PURE__ */ Symbol("total-length");
    var kCallback = /* @__PURE__ */ Symbol("callback");
    var kBuffers = /* @__PURE__ */ Symbol("buffers");
    var kError = /* @__PURE__ */ Symbol("error");
    var zlibLimiter;
    var PerMessageDeflate2 = class {
      /**
       * Creates a PerMessageDeflate instance.
       *
       * @param {Object} [options] Configuration options
       * @param {(Boolean|Number)} [options.clientMaxWindowBits] Advertise support
       *     for, or request, a custom client window size
       * @param {Boolean} [options.clientNoContextTakeover=false] Advertise/
       *     acknowledge disabling of client context takeover
       * @param {Number} [options.concurrencyLimit=10] The number of concurrent
       *     calls to zlib
       * @param {Boolean} [options.isServer=false] Create the instance in either
       *     server or client mode
       * @param {Number} [options.maxPayload=0] The maximum allowed message length
       * @param {(Boolean|Number)} [options.serverMaxWindowBits] Request/confirm the
       *     use of a custom server window size
       * @param {Boolean} [options.serverNoContextTakeover=false] Request/accept
       *     disabling of server context takeover
       * @param {Number} [options.threshold=1024] Size (in bytes) below which
       *     messages should not be compressed if context takeover is disabled
       * @param {Object} [options.zlibDeflateOptions] Options to pass to zlib on
       *     deflate
       * @param {Object} [options.zlibInflateOptions] Options to pass to zlib on
       *     inflate
       */
      constructor(options) {
        this._options = options || {};
        this._threshold = this._options.threshold !== void 0 ? this._options.threshold : 1024;
        this._maxPayload = this._options.maxPayload | 0;
        this._isServer = !!this._options.isServer;
        this._deflate = null;
        this._inflate = null;
        this.params = null;
        if (!zlibLimiter) {
          const concurrency = this._options.concurrencyLimit !== void 0 ? this._options.concurrencyLimit : 10;
          zlibLimiter = new Limiter(concurrency);
        }
      }
      /**
       * @type {String}
       */
      static get extensionName() {
        return "permessage-deflate";
      }
      /**
       * Create an extension negotiation offer.
       *
       * @return {Object} Extension parameters
       * @public
       */
      offer() {
        const params = {};
        if (this._options.serverNoContextTakeover) {
          params.server_no_context_takeover = true;
        }
        if (this._options.clientNoContextTakeover) {
          params.client_no_context_takeover = true;
        }
        if (this._options.serverMaxWindowBits) {
          params.server_max_window_bits = this._options.serverMaxWindowBits;
        }
        if (this._options.clientMaxWindowBits) {
          params.client_max_window_bits = this._options.clientMaxWindowBits;
        } else if (this._options.clientMaxWindowBits == null) {
          params.client_max_window_bits = true;
        }
        return params;
      }
      /**
       * Accept an extension negotiation offer/response.
       *
       * @param {Array} configurations The extension negotiation offers/reponse
       * @return {Object} Accepted configuration
       * @public
       */
      accept(configurations) {
        configurations = this.normalizeParams(configurations);
        this.params = this._isServer ? this.acceptAsServer(configurations) : this.acceptAsClient(configurations);
        return this.params;
      }
      /**
       * Releases all resources used by the extension.
       *
       * @public
       */
      cleanup() {
        if (this._inflate) {
          this._inflate.close();
          this._inflate = null;
        }
        if (this._deflate) {
          const callback = this._deflate[kCallback];
          this._deflate.close();
          this._deflate = null;
          if (callback) {
            callback(
              new Error(
                "The deflate stream was closed while data was being processed"
              )
            );
          }
        }
      }
      /**
       *  Accept an extension negotiation offer.
       *
       * @param {Array} offers The extension negotiation offers
       * @return {Object} Accepted configuration
       * @private
       */
      acceptAsServer(offers) {
        const opts = this._options;
        const accepted = offers.find((params) => {
          if (opts.serverNoContextTakeover === false && params.server_no_context_takeover || params.server_max_window_bits && (opts.serverMaxWindowBits === false || typeof opts.serverMaxWindowBits === "number" && opts.serverMaxWindowBits > params.server_max_window_bits) || typeof opts.clientMaxWindowBits === "number" && (typeof params.client_max_window_bits === "number" ? opts.clientMaxWindowBits > params.client_max_window_bits : !params.client_max_window_bits)) {
            return false;
          }
          return true;
        });
        if (!accepted) {
          throw new Error("None of the extension offers can be accepted");
        }
        if (opts.serverNoContextTakeover) {
          accepted.server_no_context_takeover = true;
        }
        if (opts.clientNoContextTakeover) {
          accepted.client_no_context_takeover = true;
        }
        if (typeof opts.serverMaxWindowBits === "number") {
          accepted.server_max_window_bits = opts.serverMaxWindowBits;
        }
        if (typeof opts.clientMaxWindowBits === "number") {
          accepted.client_max_window_bits = opts.clientMaxWindowBits;
        } else if (accepted.client_max_window_bits === true || opts.clientMaxWindowBits === false) {
          delete accepted.client_max_window_bits;
        }
        return accepted;
      }
      /**
       * Accept the extension negotiation response.
       *
       * @param {Array} response The extension negotiation response
       * @return {Object} Accepted configuration
       * @private
       */
      acceptAsClient(response) {
        const params = response[0];
        if (this._options.clientNoContextTakeover === false && params.client_no_context_takeover) {
          throw new Error('Unexpected parameter "client_no_context_takeover"');
        }
        if (!params.client_max_window_bits) {
          if (typeof this._options.clientMaxWindowBits === "number") {
            params.client_max_window_bits = this._options.clientMaxWindowBits;
          }
        } else if (this._options.clientMaxWindowBits === false || typeof this._options.clientMaxWindowBits === "number" && params.client_max_window_bits > this._options.clientMaxWindowBits) {
          throw new Error(
            'Unexpected or invalid parameter "client_max_window_bits"'
          );
        }
        return params;
      }
      /**
       * Normalize parameters.
       *
       * @param {Array} configurations The extension negotiation offers/reponse
       * @return {Array} The offers/response with normalized parameters
       * @private
       */
      normalizeParams(configurations) {
        configurations.forEach((params) => {
          Object.keys(params).forEach((key) => {
            let value = params[key];
            if (value.length > 1) {
              throw new Error(`Parameter "${key}" must have only a single value`);
            }
            value = value[0];
            if (key === "client_max_window_bits") {
              if (value !== true) {
                const num = +value;
                if (!Number.isInteger(num) || num < 8 || num > 15) {
                  throw new TypeError(
                    `Invalid value for parameter "${key}": ${value}`
                  );
                }
                value = num;
              } else if (!this._isServer) {
                throw new TypeError(
                  `Invalid value for parameter "${key}": ${value}`
                );
              }
            } else if (key === "server_max_window_bits") {
              const num = +value;
              if (!Number.isInteger(num) || num < 8 || num > 15) {
                throw new TypeError(
                  `Invalid value for parameter "${key}": ${value}`
                );
              }
              value = num;
            } else if (key === "client_no_context_takeover" || key === "server_no_context_takeover") {
              if (value !== true) {
                throw new TypeError(
                  `Invalid value for parameter "${key}": ${value}`
                );
              }
            } else {
              throw new Error(`Unknown parameter "${key}"`);
            }
            params[key] = value;
          });
        });
        return configurations;
      }
      /**
       * Decompress data. Concurrency limited.
       *
       * @param {Buffer} data Compressed data
       * @param {Boolean} fin Specifies whether or not this is the last fragment
       * @param {Function} callback Callback
       * @public
       */
      decompress(data, fin, callback) {
        zlibLimiter.add((done) => {
          this._decompress(data, fin, (err, result) => {
            done();
            callback(err, result);
          });
        });
      }
      /**
       * Compress data. Concurrency limited.
       *
       * @param {(Buffer|String)} data Data to compress
       * @param {Boolean} fin Specifies whether or not this is the last fragment
       * @param {Function} callback Callback
       * @public
       */
      compress(data, fin, callback) {
        zlibLimiter.add((done) => {
          this._compress(data, fin, (err, result) => {
            done();
            callback(err, result);
          });
        });
      }
      /**
       * Decompress data.
       *
       * @param {Buffer} data Compressed data
       * @param {Boolean} fin Specifies whether or not this is the last fragment
       * @param {Function} callback Callback
       * @private
       */
      _decompress(data, fin, callback) {
        const endpoint = this._isServer ? "client" : "server";
        if (!this._inflate) {
          const key = `${endpoint}_max_window_bits`;
          const windowBits = typeof this.params[key] !== "number" ? zlib.Z_DEFAULT_WINDOWBITS : this.params[key];
          this._inflate = zlib.createInflateRaw({
            ...this._options.zlibInflateOptions,
            windowBits
          });
          this._inflate[kPerMessageDeflate] = this;
          this._inflate[kTotalLength] = 0;
          this._inflate[kBuffers] = [];
          this._inflate.on("error", inflateOnError);
          this._inflate.on("data", inflateOnData);
        }
        this._inflate[kCallback] = callback;
        this._inflate.write(data);
        if (fin) this._inflate.write(TRAILER);
        this._inflate.flush(() => {
          const err = this._inflate[kError];
          if (err) {
            this._inflate.close();
            this._inflate = null;
            callback(err);
            return;
          }
          const data2 = bufferUtil.concat(
            this._inflate[kBuffers],
            this._inflate[kTotalLength]
          );
          if (this._inflate._readableState.endEmitted) {
            this._inflate.close();
            this._inflate = null;
          } else {
            this._inflate[kTotalLength] = 0;
            this._inflate[kBuffers] = [];
            if (fin && this.params[`${endpoint}_no_context_takeover`]) {
              this._inflate.reset();
            }
          }
          callback(null, data2);
        });
      }
      /**
       * Compress data.
       *
       * @param {(Buffer|String)} data Data to compress
       * @param {Boolean} fin Specifies whether or not this is the last fragment
       * @param {Function} callback Callback
       * @private
       */
      _compress(data, fin, callback) {
        const endpoint = this._isServer ? "server" : "client";
        if (!this._deflate) {
          const key = `${endpoint}_max_window_bits`;
          const windowBits = typeof this.params[key] !== "number" ? zlib.Z_DEFAULT_WINDOWBITS : this.params[key];
          this._deflate = zlib.createDeflateRaw({
            ...this._options.zlibDeflateOptions,
            windowBits
          });
          this._deflate[kTotalLength] = 0;
          this._deflate[kBuffers] = [];
          this._deflate.on("data", deflateOnData);
        }
        this._deflate[kCallback] = callback;
        this._deflate.write(data);
        this._deflate.flush(zlib.Z_SYNC_FLUSH, () => {
          if (!this._deflate) {
            return;
          }
          let data2 = bufferUtil.concat(
            this._deflate[kBuffers],
            this._deflate[kTotalLength]
          );
          if (fin) {
            data2 = new FastBuffer(data2.buffer, data2.byteOffset, data2.length - 4);
          }
          this._deflate[kCallback] = null;
          this._deflate[kTotalLength] = 0;
          this._deflate[kBuffers] = [];
          if (fin && this.params[`${endpoint}_no_context_takeover`]) {
            this._deflate.reset();
          }
          callback(null, data2);
        });
      }
    };
    module2.exports = PerMessageDeflate2;
    function deflateOnData(chunk) {
      this[kBuffers].push(chunk);
      this[kTotalLength] += chunk.length;
    }
    function inflateOnData(chunk) {
      this[kTotalLength] += chunk.length;
      if (this[kPerMessageDeflate]._maxPayload < 1 || this[kTotalLength] <= this[kPerMessageDeflate]._maxPayload) {
        this[kBuffers].push(chunk);
        return;
      }
      this[kError] = new RangeError("Max payload size exceeded");
      this[kError].code = "WS_ERR_UNSUPPORTED_MESSAGE_LENGTH";
      this[kError][kStatusCode] = 1009;
      this.removeListener("data", inflateOnData);
      this.reset();
    }
    function inflateOnError(err) {
      this[kPerMessageDeflate]._inflate = null;
      if (this[kError]) {
        this[kCallback](this[kError]);
        return;
      }
      err[kStatusCode] = 1007;
      this[kCallback](err);
    }
  }
});

// node_modules/.pnpm/ws@8.22.0/node_modules/ws/lib/validation.js
var require_validation = __commonJS({
  "node_modules/.pnpm/ws@8.22.0/node_modules/ws/lib/validation.js"(exports2, module2) {
    "use strict";
    var { isUtf8 } = require("buffer");
    var { hasBlob } = require_constants();
    var tokenChars = [
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      // 0 - 15
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      // 16 - 31
      0,
      1,
      0,
      1,
      1,
      1,
      1,
      1,
      0,
      0,
      1,
      1,
      0,
      1,
      1,
      0,
      // 32 - 47
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      0,
      0,
      0,
      0,
      0,
      0,
      // 48 - 63
      0,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      // 64 - 79
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      0,
      0,
      0,
      1,
      1,
      // 80 - 95
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      // 96 - 111
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      0,
      1,
      0,
      1,
      0
      // 112 - 127
    ];
    function isValidStatusCode(code) {
      return code >= 1e3 && code <= 1014 && code !== 1004 && code !== 1005 && code !== 1006 || code >= 3e3 && code <= 4999;
    }
    function _isValidUTF8(buf) {
      const len = buf.length;
      let i = 0;
      while (i < len) {
        if ((buf[i] & 128) === 0) {
          i++;
        } else if ((buf[i] & 224) === 192) {
          if (i + 1 === len || (buf[i + 1] & 192) !== 128 || (buf[i] & 254) === 192) {
            return false;
          }
          i += 2;
        } else if ((buf[i] & 240) === 224) {
          if (i + 2 >= len || (buf[i + 1] & 192) !== 128 || (buf[i + 2] & 192) !== 128 || buf[i] === 224 && (buf[i + 1] & 224) === 128 || // Overlong
          buf[i] === 237 && (buf[i + 1] & 224) === 160) {
            return false;
          }
          i += 3;
        } else if ((buf[i] & 248) === 240) {
          if (i + 3 >= len || (buf[i + 1] & 192) !== 128 || (buf[i + 2] & 192) !== 128 || (buf[i + 3] & 192) !== 128 || buf[i] === 240 && (buf[i + 1] & 240) === 128 || // Overlong
          buf[i] === 244 && buf[i + 1] > 143 || buf[i] > 244) {
            return false;
          }
          i += 4;
        } else {
          return false;
        }
      }
      return true;
    }
    function isBlob(value) {
      return hasBlob && typeof value === "object" && typeof value.arrayBuffer === "function" && typeof value.type === "string" && typeof value.stream === "function" && (value[Symbol.toStringTag] === "Blob" || value[Symbol.toStringTag] === "File");
    }
    module2.exports = {
      isBlob,
      isValidStatusCode,
      isValidUTF8: _isValidUTF8,
      tokenChars
    };
    if (isUtf8) {
      module2.exports.isValidUTF8 = function(buf) {
        return buf.length < 24 ? _isValidUTF8(buf) : isUtf8(buf);
      };
    } else if (!process.env.WS_NO_UTF_8_VALIDATE) {
      try {
        const isValidUTF8 = require("utf-8-validate");
        module2.exports.isValidUTF8 = function(buf) {
          return buf.length < 32 ? _isValidUTF8(buf) : isValidUTF8(buf);
        };
      } catch (e) {
      }
    }
  }
});

// node_modules/.pnpm/ws@8.22.0/node_modules/ws/lib/receiver.js
var require_receiver = __commonJS({
  "node_modules/.pnpm/ws@8.22.0/node_modules/ws/lib/receiver.js"(exports2, module2) {
    "use strict";
    var { Writable } = require("stream");
    var PerMessageDeflate2 = require_permessage_deflate();
    var {
      BINARY_TYPES,
      EMPTY_BUFFER,
      kStatusCode,
      kWebSocket
    } = require_constants();
    var { concat, toArrayBuffer, unmask } = require_buffer_util();
    var { isValidStatusCode, isValidUTF8 } = require_validation();
    var FastBuffer = Buffer[Symbol.species];
    var GET_INFO = 0;
    var GET_PAYLOAD_LENGTH_16 = 1;
    var GET_PAYLOAD_LENGTH_64 = 2;
    var GET_MASK = 3;
    var GET_DATA = 4;
    var INFLATING = 5;
    var DEFER_EVENT = 6;
    var Receiver2 = class extends Writable {
      /**
       * Creates a Receiver instance.
       *
       * @param {Object} [options] Options object
       * @param {Boolean} [options.allowSynchronousEvents=true] Specifies whether
       *     any of the `'message'`, `'ping'`, and `'pong'` events can be emitted
       *     multiple times in the same tick
       * @param {String} [options.binaryType=nodebuffer] The type for binary data
       * @param {Object} [options.extensions] An object containing the negotiated
       *     extensions
       * @param {Boolean} [options.isServer=false] Specifies whether to operate in
       *     client or server mode
       * @param {Number} [options.maxBufferedChunks=0] The maximum number of
       *     buffered data chunks
       * @param {Number} [options.maxFragments=0] The maximum number of message
       *     fragments
       * @param {Number} [options.maxPayload=0] The maximum allowed message length
       * @param {Boolean} [options.skipUTF8Validation=false] Specifies whether or
       *     not to skip UTF-8 validation for text and close messages
       */
      constructor(options = {}) {
        super();
        this._allowSynchronousEvents = options.allowSynchronousEvents !== void 0 ? options.allowSynchronousEvents : true;
        this._binaryType = options.binaryType || BINARY_TYPES[0];
        this._extensions = options.extensions || {};
        this._isServer = !!options.isServer;
        this._maxBufferedChunks = options.maxBufferedChunks | 0;
        this._maxFragments = options.maxFragments | 0;
        this._maxPayload = options.maxPayload | 0;
        this._skipUTF8Validation = !!options.skipUTF8Validation;
        this[kWebSocket] = void 0;
        this._bufferedBytes = 0;
        this._buffers = [];
        this._compressed = false;
        this._payloadLength = 0;
        this._mask = void 0;
        this._fragmented = 0;
        this._masked = false;
        this._fin = false;
        this._opcode = 0;
        this._totalPayloadLength = 0;
        this._messageLength = 0;
        this._numFragments = 0;
        this._fragments = [];
        this._errored = false;
        this._loop = false;
        this._state = GET_INFO;
      }
      /**
       * Implements `Writable.prototype._write()`.
       *
       * @param {Buffer} chunk The chunk of data to write
       * @param {String} encoding The character encoding of `chunk`
       * @param {Function} cb Callback
       * @private
       */
      _write(chunk, encoding, cb) {
        if (this._opcode === 8 && this._state == GET_INFO) return cb();
        if (this._maxBufferedChunks > 0 && this._buffers.length >= this._maxBufferedChunks) {
          cb(
            this.createError(
              RangeError,
              "Too many buffered chunks",
              false,
              1008,
              "WS_ERR_TOO_MANY_BUFFERED_PARTS"
            )
          );
          return;
        }
        this._bufferedBytes += chunk.length;
        this._buffers.push(chunk);
        this.startLoop(cb);
      }
      /**
       * Consumes `n` bytes from the buffered data.
       *
       * @param {Number} n The number of bytes to consume
       * @return {Buffer} The consumed bytes
       * @private
       */
      consume(n) {
        this._bufferedBytes -= n;
        if (n === this._buffers[0].length) return this._buffers.shift();
        if (n < this._buffers[0].length) {
          const buf = this._buffers[0];
          this._buffers[0] = new FastBuffer(
            buf.buffer,
            buf.byteOffset + n,
            buf.length - n
          );
          return new FastBuffer(buf.buffer, buf.byteOffset, n);
        }
        const dst = Buffer.allocUnsafe(n);
        do {
          const buf = this._buffers[0];
          const offset = dst.length - n;
          if (n >= buf.length) {
            dst.set(this._buffers.shift(), offset);
          } else {
            dst.set(new Uint8Array(buf.buffer, buf.byteOffset, n), offset);
            this._buffers[0] = new FastBuffer(
              buf.buffer,
              buf.byteOffset + n,
              buf.length - n
            );
          }
          n -= buf.length;
        } while (n > 0);
        return dst;
      }
      /**
       * Starts the parsing loop.
       *
       * @param {Function} cb Callback
       * @private
       */
      startLoop(cb) {
        this._loop = true;
        do {
          switch (this._state) {
            case GET_INFO:
              this.getInfo(cb);
              break;
            case GET_PAYLOAD_LENGTH_16:
              this.getPayloadLength16(cb);
              break;
            case GET_PAYLOAD_LENGTH_64:
              this.getPayloadLength64(cb);
              break;
            case GET_MASK:
              this.getMask();
              break;
            case GET_DATA:
              this.getData(cb);
              break;
            case INFLATING:
            case DEFER_EVENT:
              this._loop = false;
              return;
          }
        } while (this._loop);
        if (!this._errored) cb();
      }
      /**
       * Reads the first two bytes of a frame.
       *
       * @param {Function} cb Callback
       * @private
       */
      getInfo(cb) {
        if (this._bufferedBytes < 2) {
          this._loop = false;
          return;
        }
        const buf = this.consume(2);
        if ((buf[0] & 48) !== 0) {
          const error = this.createError(
            RangeError,
            "RSV2 and RSV3 must be clear",
            true,
            1002,
            "WS_ERR_UNEXPECTED_RSV_2_3"
          );
          cb(error);
          return;
        }
        const compressed = (buf[0] & 64) === 64;
        if (compressed && !this._extensions[PerMessageDeflate2.extensionName]) {
          const error = this.createError(
            RangeError,
            "RSV1 must be clear",
            true,
            1002,
            "WS_ERR_UNEXPECTED_RSV_1"
          );
          cb(error);
          return;
        }
        this._fin = (buf[0] & 128) === 128;
        this._opcode = buf[0] & 15;
        this._payloadLength = buf[1] & 127;
        if (this._opcode === 0) {
          if (compressed) {
            const error = this.createError(
              RangeError,
              "RSV1 must be clear",
              true,
              1002,
              "WS_ERR_UNEXPECTED_RSV_1"
            );
            cb(error);
            return;
          }
          if (!this._fragmented) {
            const error = this.createError(
              RangeError,
              "invalid opcode 0",
              true,
              1002,
              "WS_ERR_INVALID_OPCODE"
            );
            cb(error);
            return;
          }
          this._opcode = this._fragmented;
        } else if (this._opcode === 1 || this._opcode === 2) {
          if (this._fragmented) {
            const error = this.createError(
              RangeError,
              `invalid opcode ${this._opcode}`,
              true,
              1002,
              "WS_ERR_INVALID_OPCODE"
            );
            cb(error);
            return;
          }
          this._compressed = compressed;
        } else if (this._opcode > 7 && this._opcode < 11) {
          if (!this._fin) {
            const error = this.createError(
              RangeError,
              "FIN must be set",
              true,
              1002,
              "WS_ERR_EXPECTED_FIN"
            );
            cb(error);
            return;
          }
          if (compressed) {
            const error = this.createError(
              RangeError,
              "RSV1 must be clear",
              true,
              1002,
              "WS_ERR_UNEXPECTED_RSV_1"
            );
            cb(error);
            return;
          }
          if (this._payloadLength > 125 || this._opcode === 8 && this._payloadLength === 1) {
            const error = this.createError(
              RangeError,
              `invalid payload length ${this._payloadLength}`,
              true,
              1002,
              "WS_ERR_INVALID_CONTROL_PAYLOAD_LENGTH"
            );
            cb(error);
            return;
          }
        } else {
          const error = this.createError(
            RangeError,
            `invalid opcode ${this._opcode}`,
            true,
            1002,
            "WS_ERR_INVALID_OPCODE"
          );
          cb(error);
          return;
        }
        if (!this._fin && !this._fragmented) this._fragmented = this._opcode;
        this._masked = (buf[1] & 128) === 128;
        if (this._isServer) {
          if (!this._masked) {
            const error = this.createError(
              RangeError,
              "MASK must be set",
              true,
              1002,
              "WS_ERR_EXPECTED_MASK"
            );
            cb(error);
            return;
          }
        } else if (this._masked) {
          const error = this.createError(
            RangeError,
            "MASK must be clear",
            true,
            1002,
            "WS_ERR_UNEXPECTED_MASK"
          );
          cb(error);
          return;
        }
        if (this._payloadLength === 126) this._state = GET_PAYLOAD_LENGTH_16;
        else if (this._payloadLength === 127) this._state = GET_PAYLOAD_LENGTH_64;
        else this.haveLength(cb);
      }
      /**
       * Gets extended payload length (7+16).
       *
       * @param {Function} cb Callback
       * @private
       */
      getPayloadLength16(cb) {
        if (this._bufferedBytes < 2) {
          this._loop = false;
          return;
        }
        this._payloadLength = this.consume(2).readUInt16BE(0);
        this.haveLength(cb);
      }
      /**
       * Gets extended payload length (7+64).
       *
       * @param {Function} cb Callback
       * @private
       */
      getPayloadLength64(cb) {
        if (this._bufferedBytes < 8) {
          this._loop = false;
          return;
        }
        const buf = this.consume(8);
        const num = buf.readUInt32BE(0);
        if (num > Math.pow(2, 53 - 32) - 1) {
          const error = this.createError(
            RangeError,
            "Unsupported WebSocket frame: payload length > 2^53 - 1",
            false,
            1009,
            "WS_ERR_UNSUPPORTED_DATA_PAYLOAD_LENGTH"
          );
          cb(error);
          return;
        }
        this._payloadLength = num * Math.pow(2, 32) + buf.readUInt32BE(4);
        this.haveLength(cb);
      }
      /**
       * Payload length has been read.
       *
       * @param {Function} cb Callback
       * @private
       */
      haveLength(cb) {
        if (this._payloadLength && this._opcode < 8) {
          this._totalPayloadLength += this._payloadLength;
          if (this._totalPayloadLength > this._maxPayload && this._maxPayload > 0) {
            const error = this.createError(
              RangeError,
              "Max payload size exceeded",
              false,
              1009,
              "WS_ERR_UNSUPPORTED_MESSAGE_LENGTH"
            );
            cb(error);
            return;
          }
        }
        if (this._masked) this._state = GET_MASK;
        else this._state = GET_DATA;
      }
      /**
       * Reads mask bytes.
       *
       * @private
       */
      getMask() {
        if (this._bufferedBytes < 4) {
          this._loop = false;
          return;
        }
        this._mask = this.consume(4);
        this._state = GET_DATA;
      }
      /**
       * Reads data bytes.
       *
       * @param {Function} cb Callback
       * @private
       */
      getData(cb) {
        let data = EMPTY_BUFFER;
        if (this._payloadLength) {
          if (this._bufferedBytes < this._payloadLength) {
            this._loop = false;
            return;
          }
          data = this.consume(this._payloadLength);
          if (this._masked && (this._mask[0] | this._mask[1] | this._mask[2] | this._mask[3]) !== 0) {
            unmask(data, this._mask);
          }
        }
        if (this._opcode > 7) {
          this.controlMessage(data, cb);
          return;
        }
        if (this._maxFragments > 0 && ++this._numFragments > this._maxFragments) {
          const error = this.createError(
            RangeError,
            "Too many message fragments",
            false,
            1008,
            "WS_ERR_TOO_MANY_BUFFERED_PARTS"
          );
          cb(error);
          return;
        }
        if (this._compressed) {
          this._state = INFLATING;
          this.decompress(data, cb);
          return;
        }
        if (data.length) {
          this._messageLength = this._totalPayloadLength;
          this._fragments.push(data);
        }
        this.dataMessage(cb);
      }
      /**
       * Decompresses data.
       *
       * @param {Buffer} data Compressed data
       * @param {Function} cb Callback
       * @private
       */
      decompress(data, cb) {
        const perMessageDeflate = this._extensions[PerMessageDeflate2.extensionName];
        perMessageDeflate.decompress(data, this._fin, (err, buf) => {
          if (err) return cb(err);
          if (buf.length) {
            this._messageLength += buf.length;
            if (this._messageLength > this._maxPayload && this._maxPayload > 0) {
              const error = this.createError(
                RangeError,
                "Max payload size exceeded",
                false,
                1009,
                "WS_ERR_UNSUPPORTED_MESSAGE_LENGTH"
              );
              cb(error);
              return;
            }
            this._fragments.push(buf);
          }
          this.dataMessage(cb);
          if (this._state === GET_INFO) this.startLoop(cb);
        });
      }
      /**
       * Handles a data message.
       *
       * @param {Function} cb Callback
       * @private
       */
      dataMessage(cb) {
        if (!this._fin) {
          this._state = GET_INFO;
          return;
        }
        const messageLength = this._messageLength;
        const fragments = this._fragments;
        this._totalPayloadLength = 0;
        this._messageLength = 0;
        this._fragmented = 0;
        this._numFragments = 0;
        this._fragments = [];
        if (this._opcode === 2) {
          let data;
          if (this._binaryType === "nodebuffer") {
            data = concat(fragments, messageLength);
          } else if (this._binaryType === "arraybuffer") {
            data = toArrayBuffer(concat(fragments, messageLength));
          } else if (this._binaryType === "blob") {
            data = new Blob(fragments);
          } else {
            data = fragments;
          }
          if (this._allowSynchronousEvents) {
            this.emit("message", data, true);
            this._state = GET_INFO;
          } else {
            this._state = DEFER_EVENT;
            setImmediate(() => {
              this.emit("message", data, true);
              this._state = GET_INFO;
              this.startLoop(cb);
            });
          }
        } else {
          const buf = concat(fragments, messageLength);
          if (!this._skipUTF8Validation && !isValidUTF8(buf)) {
            const error = this.createError(
              Error,
              "invalid UTF-8 sequence",
              true,
              1007,
              "WS_ERR_INVALID_UTF8"
            );
            cb(error);
            return;
          }
          if (this._state === INFLATING || this._allowSynchronousEvents) {
            this.emit("message", buf, false);
            this._state = GET_INFO;
          } else {
            this._state = DEFER_EVENT;
            setImmediate(() => {
              this.emit("message", buf, false);
              this._state = GET_INFO;
              this.startLoop(cb);
            });
          }
        }
      }
      /**
       * Handles a control message.
       *
       * @param {Buffer} data Data to handle
       * @return {(Error|RangeError|undefined)} A possible error
       * @private
       */
      controlMessage(data, cb) {
        if (this._opcode === 8) {
          if (data.length === 0) {
            this._loop = false;
            this.emit("conclude", 1005, EMPTY_BUFFER);
            this.end();
          } else {
            const code = data.readUInt16BE(0);
            if (!isValidStatusCode(code)) {
              const error = this.createError(
                RangeError,
                `invalid status code ${code}`,
                true,
                1002,
                "WS_ERR_INVALID_CLOSE_CODE"
              );
              cb(error);
              return;
            }
            const buf = new FastBuffer(
              data.buffer,
              data.byteOffset + 2,
              data.length - 2
            );
            if (!this._skipUTF8Validation && !isValidUTF8(buf)) {
              const error = this.createError(
                Error,
                "invalid UTF-8 sequence",
                true,
                1007,
                "WS_ERR_INVALID_UTF8"
              );
              cb(error);
              return;
            }
            this._loop = false;
            this.emit("conclude", code, buf);
            this.end();
          }
          this._state = GET_INFO;
          return;
        }
        if (this._allowSynchronousEvents) {
          this.emit(this._opcode === 9 ? "ping" : "pong", data);
          this._state = GET_INFO;
        } else {
          this._state = DEFER_EVENT;
          setImmediate(() => {
            this.emit(this._opcode === 9 ? "ping" : "pong", data);
            this._state = GET_INFO;
            this.startLoop(cb);
          });
        }
      }
      /**
       * Builds an error object.
       *
       * @param {function(new:Error|RangeError)} ErrorCtor The error constructor
       * @param {String} message The error message
       * @param {Boolean} prefix Specifies whether or not to add a default prefix to
       *     `message`
       * @param {Number} statusCode The status code
       * @param {String} errorCode The exposed error code
       * @return {(Error|RangeError)} The error
       * @private
       */
      createError(ErrorCtor, message, prefix, statusCode, errorCode) {
        this._loop = false;
        this._errored = true;
        const err = new ErrorCtor(
          prefix ? `Invalid WebSocket frame: ${message}` : message
        );
        Error.captureStackTrace(err, this.createError);
        err.code = errorCode;
        err[kStatusCode] = statusCode;
        return err;
      }
    };
    module2.exports = Receiver2;
  }
});

// node_modules/.pnpm/ws@8.22.0/node_modules/ws/lib/sender.js
var require_sender = __commonJS({
  "node_modules/.pnpm/ws@8.22.0/node_modules/ws/lib/sender.js"(exports2, module2) {
    "use strict";
    var { Duplex } = require("stream");
    var { randomFillSync } = require("crypto");
    var {
      types: { isUint8Array }
    } = require("util");
    var PerMessageDeflate2 = require_permessage_deflate();
    var { EMPTY_BUFFER, kWebSocket, NOOP } = require_constants();
    var { isBlob, isValidStatusCode } = require_validation();
    var { mask: applyMask, toBuffer } = require_buffer_util();
    var kByteLength = /* @__PURE__ */ Symbol("kByteLength");
    var maskBuffer = Buffer.alloc(4);
    var RANDOM_POOL_SIZE = 8 * 1024;
    var randomPool;
    var randomPoolPointer = RANDOM_POOL_SIZE;
    var DEFAULT = 0;
    var DEFLATING = 1;
    var GET_BLOB_DATA = 2;
    var Sender2 = class _Sender {
      /**
       * Creates a Sender instance.
       *
       * @param {Duplex} socket The connection socket
       * @param {Object} [extensions] An object containing the negotiated extensions
       * @param {Function} [generateMask] The function used to generate the masking
       *     key
       */
      constructor(socket, extensions, generateMask) {
        this._extensions = extensions || {};
        if (generateMask) {
          this._generateMask = generateMask;
          this._maskBuffer = Buffer.alloc(4);
        }
        this._socket = socket;
        this._firstFragment = true;
        this._compress = false;
        this._bufferedBytes = 0;
        this._queue = [];
        this._state = DEFAULT;
        this.onerror = NOOP;
        this[kWebSocket] = void 0;
      }
      /**
       * Frames a piece of data according to the HyBi WebSocket protocol.
       *
       * @param {(Buffer|String)} data The data to frame
       * @param {Object} options Options object
       * @param {Boolean} [options.fin=false] Specifies whether or not to set the
       *     FIN bit
       * @param {Function} [options.generateMask] The function used to generate the
       *     masking key
       * @param {Boolean} [options.mask=false] Specifies whether or not to mask
       *     `data`
       * @param {Buffer} [options.maskBuffer] The buffer used to store the masking
       *     key
       * @param {Number} options.opcode The opcode
       * @param {Boolean} [options.readOnly=false] Specifies whether `data` can be
       *     modified
       * @param {Boolean} [options.rsv1=false] Specifies whether or not to set the
       *     RSV1 bit
       * @return {(Buffer|String)[]} The framed data
       * @public
       */
      static frame(data, options) {
        let mask;
        let merge = false;
        let offset = 2;
        let skipMasking = false;
        if (options.mask) {
          mask = options.maskBuffer || maskBuffer;
          if (options.generateMask) {
            options.generateMask(mask);
          } else {
            if (randomPoolPointer === RANDOM_POOL_SIZE) {
              if (randomPool === void 0) {
                randomPool = Buffer.alloc(RANDOM_POOL_SIZE);
              }
              randomFillSync(randomPool, 0, RANDOM_POOL_SIZE);
              randomPoolPointer = 0;
            }
            mask[0] = randomPool[randomPoolPointer++];
            mask[1] = randomPool[randomPoolPointer++];
            mask[2] = randomPool[randomPoolPointer++];
            mask[3] = randomPool[randomPoolPointer++];
          }
          skipMasking = (mask[0] | mask[1] | mask[2] | mask[3]) === 0;
          offset = 6;
        }
        let dataLength;
        if (typeof data === "string") {
          if ((!options.mask || skipMasking) && options[kByteLength] !== void 0) {
            dataLength = options[kByteLength];
          } else {
            data = Buffer.from(data);
            dataLength = data.length;
          }
        } else {
          dataLength = data.length;
          merge = options.mask && options.readOnly && !skipMasking;
        }
        let payloadLength = dataLength;
        if (dataLength >= 65536) {
          offset += 8;
          payloadLength = 127;
        } else if (dataLength > 125) {
          offset += 2;
          payloadLength = 126;
        }
        const target = Buffer.allocUnsafe(merge ? dataLength + offset : offset);
        target[0] = options.fin ? options.opcode | 128 : options.opcode;
        if (options.rsv1) target[0] |= 64;
        target[1] = payloadLength;
        if (payloadLength === 126) {
          target.writeUInt16BE(dataLength, 2);
        } else if (payloadLength === 127) {
          target[2] = target[3] = 0;
          target.writeUIntBE(dataLength, 4, 6);
        }
        if (!options.mask) return [target, data];
        target[1] |= 128;
        target[offset - 4] = mask[0];
        target[offset - 3] = mask[1];
        target[offset - 2] = mask[2];
        target[offset - 1] = mask[3];
        if (skipMasking) return [target, data];
        if (merge) {
          applyMask(data, mask, target, offset, dataLength);
          return [target];
        }
        applyMask(data, mask, data, 0, dataLength);
        return [target, data];
      }
      /**
       * Sends a close message to the other peer.
       *
       * @param {Number} [code] The status code component of the body
       * @param {(String|Buffer)} [data] The message component of the body
       * @param {Boolean} [mask=false] Specifies whether or not to mask the message
       * @param {Function} [cb] Callback
       * @public
       */
      close(code, data, mask, cb) {
        let buf;
        if (code === void 0) {
          buf = EMPTY_BUFFER;
        } else if (typeof code !== "number" || !isValidStatusCode(code)) {
          throw new TypeError("First argument must be a valid error code number");
        } else if (data === void 0 || !data.length) {
          buf = Buffer.allocUnsafe(2);
          buf.writeUInt16BE(code, 0);
        } else {
          const length = Buffer.byteLength(data);
          if (length > 123) {
            throw new RangeError("The message must not be greater than 123 bytes");
          }
          buf = Buffer.allocUnsafe(2 + length);
          buf.writeUInt16BE(code, 0);
          if (typeof data === "string") {
            buf.write(data, 2);
          } else if (isUint8Array(data)) {
            buf.set(data, 2);
          } else {
            throw new TypeError("Second argument must be a string or a Uint8Array");
          }
        }
        const options = {
          [kByteLength]: buf.length,
          fin: true,
          generateMask: this._generateMask,
          mask,
          maskBuffer: this._maskBuffer,
          opcode: 8,
          readOnly: false,
          rsv1: false
        };
        if (this._state !== DEFAULT) {
          this.enqueue([this.dispatch, buf, false, options, cb]);
        } else {
          this.sendFrame(_Sender.frame(buf, options), cb);
        }
      }
      /**
       * Sends a ping message to the other peer.
       *
       * @param {*} data The message to send
       * @param {Boolean} [mask=false] Specifies whether or not to mask `data`
       * @param {Function} [cb] Callback
       * @public
       */
      ping(data, mask, cb) {
        let byteLength;
        let readOnly;
        if (typeof data === "string") {
          byteLength = Buffer.byteLength(data);
          readOnly = false;
        } else if (isBlob(data)) {
          byteLength = data.size;
          readOnly = false;
        } else {
          data = toBuffer(data);
          byteLength = data.length;
          readOnly = toBuffer.readOnly;
        }
        if (byteLength > 125) {
          throw new RangeError("The data size must not be greater than 125 bytes");
        }
        const options = {
          [kByteLength]: byteLength,
          fin: true,
          generateMask: this._generateMask,
          mask,
          maskBuffer: this._maskBuffer,
          opcode: 9,
          readOnly,
          rsv1: false
        };
        if (isBlob(data)) {
          if (this._state !== DEFAULT) {
            this.enqueue([this.getBlobData, data, false, options, cb]);
          } else {
            this.getBlobData(data, false, options, cb);
          }
        } else if (this._state !== DEFAULT) {
          this.enqueue([this.dispatch, data, false, options, cb]);
        } else {
          this.sendFrame(_Sender.frame(data, options), cb);
        }
      }
      /**
       * Sends a pong message to the other peer.
       *
       * @param {*} data The message to send
       * @param {Boolean} [mask=false] Specifies whether or not to mask `data`
       * @param {Function} [cb] Callback
       * @public
       */
      pong(data, mask, cb) {
        let byteLength;
        let readOnly;
        if (typeof data === "string") {
          byteLength = Buffer.byteLength(data);
          readOnly = false;
        } else if (isBlob(data)) {
          byteLength = data.size;
          readOnly = false;
        } else {
          data = toBuffer(data);
          byteLength = data.length;
          readOnly = toBuffer.readOnly;
        }
        if (byteLength > 125) {
          throw new RangeError("The data size must not be greater than 125 bytes");
        }
        const options = {
          [kByteLength]: byteLength,
          fin: true,
          generateMask: this._generateMask,
          mask,
          maskBuffer: this._maskBuffer,
          opcode: 10,
          readOnly,
          rsv1: false
        };
        if (isBlob(data)) {
          if (this._state !== DEFAULT) {
            this.enqueue([this.getBlobData, data, false, options, cb]);
          } else {
            this.getBlobData(data, false, options, cb);
          }
        } else if (this._state !== DEFAULT) {
          this.enqueue([this.dispatch, data, false, options, cb]);
        } else {
          this.sendFrame(_Sender.frame(data, options), cb);
        }
      }
      /**
       * Sends a data message to the other peer.
       *
       * @param {*} data The message to send
       * @param {Object} options Options object
       * @param {Boolean} [options.binary=false] Specifies whether `data` is binary
       *     or text
       * @param {Boolean} [options.compress=false] Specifies whether or not to
       *     compress `data`
       * @param {Boolean} [options.fin=false] Specifies whether the fragment is the
       *     last one
       * @param {Boolean} [options.mask=false] Specifies whether or not to mask
       *     `data`
       * @param {Function} [cb] Callback
       * @public
       */
      send(data, options, cb) {
        const perMessageDeflate = this._extensions[PerMessageDeflate2.extensionName];
        let opcode = options.binary ? 2 : 1;
        let rsv1 = options.compress;
        let byteLength;
        let readOnly;
        if (typeof data === "string") {
          byteLength = Buffer.byteLength(data);
          readOnly = false;
        } else if (isBlob(data)) {
          byteLength = data.size;
          readOnly = false;
        } else {
          data = toBuffer(data);
          byteLength = data.length;
          readOnly = toBuffer.readOnly;
        }
        if (this._firstFragment) {
          this._firstFragment = false;
          if (rsv1 && perMessageDeflate && perMessageDeflate.params[perMessageDeflate._isServer ? "server_no_context_takeover" : "client_no_context_takeover"]) {
            rsv1 = byteLength >= perMessageDeflate._threshold;
          }
          this._compress = rsv1;
        } else {
          rsv1 = false;
          opcode = 0;
        }
        if (options.fin) this._firstFragment = true;
        const opts = {
          [kByteLength]: byteLength,
          fin: options.fin,
          generateMask: this._generateMask,
          mask: options.mask,
          maskBuffer: this._maskBuffer,
          opcode,
          readOnly,
          rsv1
        };
        if (isBlob(data)) {
          if (this._state !== DEFAULT) {
            this.enqueue([this.getBlobData, data, this._compress, opts, cb]);
          } else {
            this.getBlobData(data, this._compress, opts, cb);
          }
        } else if (this._state !== DEFAULT) {
          this.enqueue([this.dispatch, data, this._compress, opts, cb]);
        } else {
          this.dispatch(data, this._compress, opts, cb);
        }
      }
      /**
       * Gets the contents of a blob as binary data.
       *
       * @param {Blob} blob The blob
       * @param {Boolean} [compress=false] Specifies whether or not to compress
       *     the data
       * @param {Object} options Options object
       * @param {Boolean} [options.fin=false] Specifies whether or not to set the
       *     FIN bit
       * @param {Function} [options.generateMask] The function used to generate the
       *     masking key
       * @param {Boolean} [options.mask=false] Specifies whether or not to mask
       *     `data`
       * @param {Buffer} [options.maskBuffer] The buffer used to store the masking
       *     key
       * @param {Number} options.opcode The opcode
       * @param {Boolean} [options.readOnly=false] Specifies whether `data` can be
       *     modified
       * @param {Boolean} [options.rsv1=false] Specifies whether or not to set the
       *     RSV1 bit
       * @param {Function} [cb] Callback
       * @private
       */
      getBlobData(blob, compress, options, cb) {
        this._bufferedBytes += options[kByteLength];
        this._state = GET_BLOB_DATA;
        blob.arrayBuffer().then((arrayBuffer) => {
          if (this._socket.destroyed) {
            const err = new Error(
              "The socket was closed while the blob was being read"
            );
            process.nextTick(callCallbacks, this, err, cb);
            return;
          }
          this._bufferedBytes -= options[kByteLength];
          const data = toBuffer(arrayBuffer);
          if (!compress) {
            this._state = DEFAULT;
            this.sendFrame(_Sender.frame(data, options), cb);
            this.dequeue();
          } else {
            this.dispatch(data, compress, options, cb);
          }
        }).catch((err) => {
          process.nextTick(onError, this, err, cb);
        });
      }
      /**
       * Dispatches a message.
       *
       * @param {(Buffer|String)} data The message to send
       * @param {Boolean} [compress=false] Specifies whether or not to compress
       *     `data`
       * @param {Object} options Options object
       * @param {Boolean} [options.fin=false] Specifies whether or not to set the
       *     FIN bit
       * @param {Function} [options.generateMask] The function used to generate the
       *     masking key
       * @param {Boolean} [options.mask=false] Specifies whether or not to mask
       *     `data`
       * @param {Buffer} [options.maskBuffer] The buffer used to store the masking
       *     key
       * @param {Number} options.opcode The opcode
       * @param {Boolean} [options.readOnly=false] Specifies whether `data` can be
       *     modified
       * @param {Boolean} [options.rsv1=false] Specifies whether or not to set the
       *     RSV1 bit
       * @param {Function} [cb] Callback
       * @private
       */
      dispatch(data, compress, options, cb) {
        if (!compress) {
          this.sendFrame(_Sender.frame(data, options), cb);
          return;
        }
        const perMessageDeflate = this._extensions[PerMessageDeflate2.extensionName];
        this._bufferedBytes += options[kByteLength];
        this._state = DEFLATING;
        perMessageDeflate.compress(data, options.fin, (_, buf) => {
          if (this._socket.destroyed) {
            const err = new Error(
              "The socket was closed while data was being compressed"
            );
            callCallbacks(this, err, cb);
            return;
          }
          this._bufferedBytes -= options[kByteLength];
          this._state = DEFAULT;
          options.readOnly = false;
          this.sendFrame(_Sender.frame(buf, options), cb);
          this.dequeue();
        });
      }
      /**
       * Executes queued send operations.
       *
       * @private
       */
      dequeue() {
        while (this._state === DEFAULT && this._queue.length) {
          const params = this._queue.shift();
          this._bufferedBytes -= params[3][kByteLength];
          Reflect.apply(params[0], this, params.slice(1));
        }
      }
      /**
       * Enqueues a send operation.
       *
       * @param {Array} params Send operation parameters.
       * @private
       */
      enqueue(params) {
        this._bufferedBytes += params[3][kByteLength];
        this._queue.push(params);
      }
      /**
       * Sends a frame.
       *
       * @param {(Buffer | String)[]} list The frame to send
       * @param {Function} [cb] Callback
       * @private
       */
      sendFrame(list, cb) {
        if (list.length === 2) {
          this._socket.cork();
          this._socket.write(list[0]);
          this._socket.write(list[1], cb);
          this._socket.uncork();
        } else {
          this._socket.write(list[0], cb);
        }
      }
    };
    module2.exports = Sender2;
    function callCallbacks(sender, err, cb) {
      if (typeof cb === "function") cb(err);
      for (let i = 0; i < sender._queue.length; i++) {
        const params = sender._queue[i];
        const callback = params[params.length - 1];
        if (typeof callback === "function") callback(err);
      }
    }
    function onError(sender, err, cb) {
      callCallbacks(sender, err, cb);
      sender.onerror(err);
    }
  }
});

// node_modules/.pnpm/ws@8.22.0/node_modules/ws/lib/event-target.js
var require_event_target = __commonJS({
  "node_modules/.pnpm/ws@8.22.0/node_modules/ws/lib/event-target.js"(exports2, module2) {
    "use strict";
    var { kForOnEventAttribute, kListener } = require_constants();
    var kCode = /* @__PURE__ */ Symbol("kCode");
    var kData = /* @__PURE__ */ Symbol("kData");
    var kError = /* @__PURE__ */ Symbol("kError");
    var kMessage = /* @__PURE__ */ Symbol("kMessage");
    var kReason = /* @__PURE__ */ Symbol("kReason");
    var kTarget = /* @__PURE__ */ Symbol("kTarget");
    var kType = /* @__PURE__ */ Symbol("kType");
    var kWasClean = /* @__PURE__ */ Symbol("kWasClean");
    var Event = class {
      /**
       * Create a new `Event`.
       *
       * @param {String} type The name of the event
       * @throws {TypeError} If the `type` argument is not specified
       */
      constructor(type) {
        this[kTarget] = null;
        this[kType] = type;
      }
      /**
       * @type {*}
       */
      get target() {
        return this[kTarget];
      }
      /**
       * @type {String}
       */
      get type() {
        return this[kType];
      }
    };
    Object.defineProperty(Event.prototype, "target", { enumerable: true });
    Object.defineProperty(Event.prototype, "type", { enumerable: true });
    var CloseEvent = class extends Event {
      /**
       * Create a new `CloseEvent`.
       *
       * @param {String} type The name of the event
       * @param {Object} [options] A dictionary object that allows for setting
       *     attributes via object members of the same name
       * @param {Number} [options.code=0] The status code explaining why the
       *     connection was closed
       * @param {String} [options.reason=''] A human-readable string explaining why
       *     the connection was closed
       * @param {Boolean} [options.wasClean=false] Indicates whether or not the
       *     connection was cleanly closed
       */
      constructor(type, options = {}) {
        super(type);
        this[kCode] = options.code === void 0 ? 0 : options.code;
        this[kReason] = options.reason === void 0 ? "" : options.reason;
        this[kWasClean] = options.wasClean === void 0 ? false : options.wasClean;
      }
      /**
       * @type {Number}
       */
      get code() {
        return this[kCode];
      }
      /**
       * @type {String}
       */
      get reason() {
        return this[kReason];
      }
      /**
       * @type {Boolean}
       */
      get wasClean() {
        return this[kWasClean];
      }
    };
    Object.defineProperty(CloseEvent.prototype, "code", { enumerable: true });
    Object.defineProperty(CloseEvent.prototype, "reason", { enumerable: true });
    Object.defineProperty(CloseEvent.prototype, "wasClean", { enumerable: true });
    var ErrorEvent = class extends Event {
      /**
       * Create a new `ErrorEvent`.
       *
       * @param {String} type The name of the event
       * @param {Object} [options] A dictionary object that allows for setting
       *     attributes via object members of the same name
       * @param {*} [options.error=null] The error that generated this event
       * @param {String} [options.message=''] The error message
       */
      constructor(type, options = {}) {
        super(type);
        this[kError] = options.error === void 0 ? null : options.error;
        this[kMessage] = options.message === void 0 ? "" : options.message;
      }
      /**
       * @type {*}
       */
      get error() {
        return this[kError];
      }
      /**
       * @type {String}
       */
      get message() {
        return this[kMessage];
      }
    };
    Object.defineProperty(ErrorEvent.prototype, "error", { enumerable: true });
    Object.defineProperty(ErrorEvent.prototype, "message", { enumerable: true });
    var MessageEvent = class extends Event {
      /**
       * Create a new `MessageEvent`.
       *
       * @param {String} type The name of the event
       * @param {Object} [options] A dictionary object that allows for setting
       *     attributes via object members of the same name
       * @param {*} [options.data=null] The message content
       */
      constructor(type, options = {}) {
        super(type);
        this[kData] = options.data === void 0 ? null : options.data;
      }
      /**
       * @type {*}
       */
      get data() {
        return this[kData];
      }
    };
    Object.defineProperty(MessageEvent.prototype, "data", { enumerable: true });
    var EventTarget = {
      /**
       * Register an event listener.
       *
       * @param {String} type A string representing the event type to listen for
       * @param {(Function|Object)} handler The listener to add
       * @param {Object} [options] An options object specifies characteristics about
       *     the event listener
       * @param {Boolean} [options.once=false] A `Boolean` indicating that the
       *     listener should be invoked at most once after being added. If `true`,
       *     the listener would be automatically removed when invoked.
       * @public
       */
      addEventListener(type, handler, options = {}) {
        for (const listener of this.listeners(type)) {
          if (!options[kForOnEventAttribute] && listener[kListener] === handler && !listener[kForOnEventAttribute]) {
            return;
          }
        }
        let wrapper;
        if (type === "message") {
          wrapper = function onMessage(data, isBinary) {
            const event = new MessageEvent("message", {
              data: isBinary ? data : data.toString()
            });
            event[kTarget] = this;
            callListener(handler, this, event);
          };
        } else if (type === "close") {
          wrapper = function onClose(code, message) {
            const event = new CloseEvent("close", {
              code,
              reason: message.toString(),
              wasClean: this._closeFrameReceived && this._closeFrameSent
            });
            event[kTarget] = this;
            callListener(handler, this, event);
          };
        } else if (type === "error") {
          wrapper = function onError(error) {
            const event = new ErrorEvent("error", {
              error,
              message: error.message
            });
            event[kTarget] = this;
            callListener(handler, this, event);
          };
        } else if (type === "open") {
          wrapper = function onOpen() {
            const event = new Event("open");
            event[kTarget] = this;
            callListener(handler, this, event);
          };
        } else {
          return;
        }
        wrapper[kForOnEventAttribute] = !!options[kForOnEventAttribute];
        wrapper[kListener] = handler;
        if (options.once) {
          this.once(type, wrapper);
        } else {
          this.on(type, wrapper);
        }
      },
      /**
       * Remove an event listener.
       *
       * @param {String} type A string representing the event type to remove
       * @param {(Function|Object)} handler The listener to remove
       * @public
       */
      removeEventListener(type, handler) {
        for (const listener of this.listeners(type)) {
          if (listener[kListener] === handler && !listener[kForOnEventAttribute]) {
            this.removeListener(type, listener);
            break;
          }
        }
      }
    };
    module2.exports = {
      CloseEvent,
      ErrorEvent,
      Event,
      EventTarget,
      MessageEvent
    };
    function callListener(listener, thisArg, event) {
      if (typeof listener === "object" && listener.handleEvent) {
        listener.handleEvent.call(listener, event);
      } else {
        listener.call(thisArg, event);
      }
    }
  }
});

// node_modules/.pnpm/ws@8.22.0/node_modules/ws/lib/extension.js
var require_extension = __commonJS({
  "node_modules/.pnpm/ws@8.22.0/node_modules/ws/lib/extension.js"(exports2, module2) {
    "use strict";
    var { tokenChars } = require_validation();
    function push(dest, name, elem) {
      if (dest[name] === void 0) dest[name] = [elem];
      else dest[name].push(elem);
    }
    function parse(header) {
      const offers = /* @__PURE__ */ Object.create(null);
      let params = /* @__PURE__ */ Object.create(null);
      let mustUnescape = false;
      let isEscaping = false;
      let inQuotes = false;
      let extensionName;
      let paramName;
      let start = -1;
      let code = -1;
      let end = -1;
      let i = 0;
      for (; i < header.length; i++) {
        code = header.charCodeAt(i);
        if (extensionName === void 0) {
          if (end === -1 && tokenChars[code] === 1) {
            if (start === -1) start = i;
          } else if (i !== 0 && (code === 32 || code === 9)) {
            if (end === -1 && start !== -1) end = i;
          } else if (code === 59 || code === 44) {
            if (start === -1) {
              throw new SyntaxError(`Unexpected character at index ${i}`);
            }
            if (end === -1) end = i;
            const name = header.slice(start, end);
            if (code === 44) {
              push(offers, name, params);
              params = /* @__PURE__ */ Object.create(null);
            } else {
              extensionName = name;
            }
            start = end = -1;
          } else {
            throw new SyntaxError(`Unexpected character at index ${i}`);
          }
        } else if (paramName === void 0) {
          if (end === -1 && tokenChars[code] === 1) {
            if (start === -1) start = i;
          } else if (code === 32 || code === 9) {
            if (end === -1 && start !== -1) end = i;
          } else if (code === 59 || code === 44) {
            if (start === -1) {
              throw new SyntaxError(`Unexpected character at index ${i}`);
            }
            if (end === -1) end = i;
            push(params, header.slice(start, end), true);
            if (code === 44) {
              push(offers, extensionName, params);
              params = /* @__PURE__ */ Object.create(null);
              extensionName = void 0;
            }
            start = end = -1;
          } else if (code === 61 && start !== -1 && end === -1) {
            paramName = header.slice(start, i);
            start = end = -1;
          } else {
            throw new SyntaxError(`Unexpected character at index ${i}`);
          }
        } else {
          if (isEscaping) {
            if (tokenChars[code] !== 1) {
              throw new SyntaxError(`Unexpected character at index ${i}`);
            }
            if (start === -1) start = i;
            else if (!mustUnescape) mustUnescape = true;
            isEscaping = false;
          } else if (inQuotes) {
            if (tokenChars[code] === 1) {
              if (start === -1) start = i;
            } else if (code === 34 && start !== -1) {
              inQuotes = false;
              end = i;
            } else if (code === 92) {
              isEscaping = true;
            } else {
              throw new SyntaxError(`Unexpected character at index ${i}`);
            }
          } else if (code === 34 && header.charCodeAt(i - 1) === 61) {
            inQuotes = true;
          } else if (end === -1 && tokenChars[code] === 1) {
            if (start === -1) start = i;
          } else if (start !== -1 && (code === 32 || code === 9)) {
            if (end === -1) end = i;
          } else if (code === 59 || code === 44) {
            if (start === -1) {
              throw new SyntaxError(`Unexpected character at index ${i}`);
            }
            if (end === -1) end = i;
            let value = header.slice(start, end);
            if (mustUnescape) {
              value = value.replace(/\\/g, "");
              mustUnescape = false;
            }
            push(params, paramName, value);
            if (code === 44) {
              push(offers, extensionName, params);
              params = /* @__PURE__ */ Object.create(null);
              extensionName = void 0;
            }
            paramName = void 0;
            start = end = -1;
          } else {
            throw new SyntaxError(`Unexpected character at index ${i}`);
          }
        }
      }
      if (start === -1 || inQuotes || code === 32 || code === 9) {
        throw new SyntaxError("Unexpected end of input");
      }
      if (end === -1) end = i;
      const token = header.slice(start, end);
      if (extensionName === void 0) {
        push(offers, token, params);
      } else {
        if (paramName === void 0) {
          push(params, token, true);
        } else if (mustUnescape) {
          push(params, paramName, token.replace(/\\/g, ""));
        } else {
          push(params, paramName, token);
        }
        push(offers, extensionName, params);
      }
      return offers;
    }
    function format(extensions) {
      return Object.keys(extensions).map((extension2) => {
        let configurations = extensions[extension2];
        if (!Array.isArray(configurations)) configurations = [configurations];
        return configurations.map((params) => {
          return [extension2].concat(
            Object.keys(params).map((k) => {
              let values = params[k];
              if (!Array.isArray(values)) values = [values];
              return values.map((v) => v === true ? k : `${k}=${v}`).join("; ");
            })
          ).join("; ");
        }).join(", ");
      }).join(", ");
    }
    module2.exports = { format, parse };
  }
});

// node_modules/.pnpm/ws@8.22.0/node_modules/ws/lib/websocket.js
var require_websocket = __commonJS({
  "node_modules/.pnpm/ws@8.22.0/node_modules/ws/lib/websocket.js"(exports2, module2) {
    "use strict";
    var EventEmitter = require("events");
    var https = require("https");
    var http = require("http");
    var net = require("net");
    var tls = require("tls");
    var { randomBytes, createHash } = require("crypto");
    var { Duplex, Readable } = require("stream");
    var { URL } = require("url");
    var PerMessageDeflate2 = require_permessage_deflate();
    var Receiver2 = require_receiver();
    var Sender2 = require_sender();
    var { isBlob } = require_validation();
    var {
      BINARY_TYPES,
      CLOSE_TIMEOUT,
      EMPTY_BUFFER,
      GUID,
      kForOnEventAttribute,
      kListener,
      kStatusCode,
      kWebSocket,
      NOOP
    } = require_constants();
    var {
      EventTarget: { addEventListener, removeEventListener }
    } = require_event_target();
    var { format, parse } = require_extension();
    var { toBuffer } = require_buffer_util();
    var kAborted = /* @__PURE__ */ Symbol("kAborted");
    var protocolVersions = [8, 13];
    var readyStates = ["CONNECTING", "OPEN", "CLOSING", "CLOSED"];
    var subprotocolRegex = /^[!#$%&'*+\-.0-9A-Z^_`|a-z~]+$/;
    var WebSocket2 = class _WebSocket extends EventEmitter {
      /**
       * Create a new `WebSocket`.
       *
       * @param {(String|URL)} address The URL to which to connect
       * @param {(String|String[])} [protocols] The subprotocols
       * @param {Object} [options] Connection options
       */
      constructor(address, protocols, options) {
        super();
        this._binaryType = BINARY_TYPES[0];
        this._closeCode = 1006;
        this._closeFrameReceived = false;
        this._closeFrameSent = false;
        this._closeMessage = EMPTY_BUFFER;
        this._closeTimer = null;
        this._errorEmitted = false;
        this._extensions = {};
        this._paused = false;
        this._protocol = "";
        this._readyState = _WebSocket.CONNECTING;
        this._receiver = null;
        this._sender = null;
        this._socket = null;
        if (address !== null) {
          this._bufferedAmount = 0;
          this._isServer = false;
          this._redirects = 0;
          if (protocols === void 0) {
            if (!options || options.protocols === void 0) {
              protocols = [];
            } else if (Array.isArray(options.protocols)) {
              protocols = options.protocols;
            } else {
              protocols = [options.protocols];
            }
          } else if (!Array.isArray(protocols)) {
            if (typeof protocols === "object" && protocols !== null) {
              options = protocols;
              if (options.protocols === void 0) {
                protocols = [];
              } else if (Array.isArray(options.protocols)) {
                protocols = options.protocols;
              } else {
                protocols = [options.protocols];
              }
            } else {
              protocols = [protocols];
            }
          }
          initAsClient(this, address, protocols, options);
        } else {
          this._autoPong = options.autoPong;
          this._closeTimeout = options.closeTimeout;
          this._isServer = true;
        }
      }
      /**
       * For historical reasons, the custom "nodebuffer" type is used by the default
       * instead of "blob".
       *
       * @type {String}
       */
      get binaryType() {
        return this._binaryType;
      }
      set binaryType(type) {
        if (!BINARY_TYPES.includes(type)) return;
        this._binaryType = type;
        if (this._receiver) this._receiver._binaryType = type;
      }
      /**
       * @type {Number}
       */
      get bufferedAmount() {
        if (!this._socket) return this._bufferedAmount;
        return this._socket._writableState.length + this._sender._bufferedBytes;
      }
      /**
       * @type {String}
       */
      get extensions() {
        return Object.keys(this._extensions).join();
      }
      /**
       * @type {Boolean}
       */
      get isPaused() {
        return this._paused;
      }
      /**
       * @type {Function}
       */
      /* istanbul ignore next */
      get onclose() {
        return null;
      }
      /**
       * @type {Function}
       */
      /* istanbul ignore next */
      get onerror() {
        return null;
      }
      /**
       * @type {Function}
       */
      /* istanbul ignore next */
      get onopen() {
        return null;
      }
      /**
       * @type {Function}
       */
      /* istanbul ignore next */
      get onmessage() {
        return null;
      }
      /**
       * @type {String}
       */
      get protocol() {
        return this._protocol;
      }
      /**
       * @type {Number}
       */
      get readyState() {
        return this._readyState;
      }
      /**
       * @type {String}
       */
      get url() {
        return this._url;
      }
      /**
       * Set up the socket and the internal resources.
       *
       * @param {Duplex} socket The network socket between the server and client
       * @param {Buffer} head The first packet of the upgraded stream
       * @param {Object} options Options object
       * @param {Boolean} [options.allowSynchronousEvents=false] Specifies whether
       *     any of the `'message'`, `'ping'`, and `'pong'` events can be emitted
       *     multiple times in the same tick
       * @param {Function} [options.generateMask] The function used to generate the
       *     masking key
       * @param {Number} [options.maxBufferedChunks=0] The maximum number of
       *     buffered data chunks
       * @param {Number} [options.maxFragments=0] The maximum number of message
       *     fragments
       * @param {Number} [options.maxPayload=0] The maximum allowed message size
       * @param {Boolean} [options.skipUTF8Validation=false] Specifies whether or
       *     not to skip UTF-8 validation for text and close messages
       * @private
       */
      setSocket(socket, head, options) {
        const receiver = new Receiver2({
          allowSynchronousEvents: options.allowSynchronousEvents,
          binaryType: this.binaryType,
          extensions: this._extensions,
          isServer: this._isServer,
          maxBufferedChunks: options.maxBufferedChunks,
          maxFragments: options.maxFragments,
          maxPayload: options.maxPayload,
          skipUTF8Validation: options.skipUTF8Validation
        });
        const sender = new Sender2(socket, this._extensions, options.generateMask);
        this._receiver = receiver;
        this._sender = sender;
        this._socket = socket;
        receiver[kWebSocket] = this;
        sender[kWebSocket] = this;
        socket[kWebSocket] = this;
        receiver.on("conclude", receiverOnConclude);
        receiver.on("drain", receiverOnDrain);
        receiver.on("error", receiverOnError);
        receiver.on("message", receiverOnMessage);
        receiver.on("ping", receiverOnPing);
        receiver.on("pong", receiverOnPong);
        sender.onerror = senderOnError;
        if (socket.setTimeout) socket.setTimeout(0);
        if (socket.setNoDelay) socket.setNoDelay();
        if (head.length > 0) socket.unshift(head);
        socket.on("close", socketOnClose);
        socket.on("data", socketOnData);
        socket.on("end", socketOnEnd);
        socket.on("error", socketOnError);
        this._readyState = _WebSocket.OPEN;
        this.emit("open");
      }
      /**
       * Emit the `'close'` event.
       *
       * @private
       */
      emitClose() {
        if (!this._socket) {
          this._readyState = _WebSocket.CLOSED;
          this.emit("close", this._closeCode, this._closeMessage);
          return;
        }
        if (this._extensions[PerMessageDeflate2.extensionName]) {
          this._extensions[PerMessageDeflate2.extensionName].cleanup();
        }
        this._receiver.removeAllListeners();
        this._readyState = _WebSocket.CLOSED;
        this.emit("close", this._closeCode, this._closeMessage);
      }
      /**
       * Start a closing handshake.
       *
       *          +----------+   +-----------+   +----------+
       *     - - -|ws.close()|-->|close frame|-->|ws.close()|- - -
       *    |     +----------+   +-----------+   +----------+     |
       *          +----------+   +-----------+         |
       * CLOSING  |ws.close()|<--|close frame|<--+-----+       CLOSING
       *          +----------+   +-----------+   |
       *    |           |                        |   +---+        |
       *                +------------------------+-->|fin| - - - -
       *    |         +---+                      |   +---+
       *     - - - - -|fin|<---------------------+
       *              +---+
       *
       * @param {Number} [code] Status code explaining why the connection is closing
       * @param {(String|Buffer)} [data] The reason why the connection is
       *     closing
       * @public
       */
      close(code, data) {
        if (this.readyState === _WebSocket.CLOSED) return;
        if (this.readyState === _WebSocket.CONNECTING) {
          const msg = "WebSocket was closed before the connection was established";
          abortHandshake(this, this._req, msg);
          return;
        }
        if (this.readyState === _WebSocket.CLOSING) {
          if (this._closeFrameSent && (this._closeFrameReceived || this._receiver._writableState.errorEmitted)) {
            this._socket.end();
          }
          return;
        }
        this._sender.close(code, data, !this._isServer, (err) => {
          if (err) return;
          this._closeFrameSent = true;
          if (this._closeFrameReceived || this._receiver._writableState.errorEmitted) {
            this._socket.end();
          }
        });
        this._readyState = _WebSocket.CLOSING;
        setCloseTimer(this);
      }
      /**
       * Pause the socket.
       *
       * @public
       */
      pause() {
        if (this.readyState === _WebSocket.CONNECTING || this.readyState === _WebSocket.CLOSED) {
          return;
        }
        this._paused = true;
        this._socket.pause();
      }
      /**
       * Send a ping.
       *
       * @param {*} [data] The data to send
       * @param {Boolean} [mask] Indicates whether or not to mask `data`
       * @param {Function} [cb] Callback which is executed when the ping is sent
       * @public
       */
      ping(data, mask, cb) {
        if (this.readyState === _WebSocket.CONNECTING) {
          throw new Error("WebSocket is not open: readyState 0 (CONNECTING)");
        }
        if (typeof data === "function") {
          cb = data;
          data = mask = void 0;
        } else if (typeof mask === "function") {
          cb = mask;
          mask = void 0;
        }
        if (typeof data === "number") data = data.toString();
        if (this.readyState !== _WebSocket.OPEN) {
          sendAfterClose(this, data, cb);
          return;
        }
        if (mask === void 0) mask = !this._isServer;
        this._sender.ping(data || EMPTY_BUFFER, mask, cb);
      }
      /**
       * Send a pong.
       *
       * @param {*} [data] The data to send
       * @param {Boolean} [mask] Indicates whether or not to mask `data`
       * @param {Function} [cb] Callback which is executed when the pong is sent
       * @public
       */
      pong(data, mask, cb) {
        if (this.readyState === _WebSocket.CONNECTING) {
          throw new Error("WebSocket is not open: readyState 0 (CONNECTING)");
        }
        if (typeof data === "function") {
          cb = data;
          data = mask = void 0;
        } else if (typeof mask === "function") {
          cb = mask;
          mask = void 0;
        }
        if (typeof data === "number") data = data.toString();
        if (this.readyState !== _WebSocket.OPEN) {
          sendAfterClose(this, data, cb);
          return;
        }
        if (mask === void 0) mask = !this._isServer;
        this._sender.pong(data || EMPTY_BUFFER, mask, cb);
      }
      /**
       * Resume the socket.
       *
       * @public
       */
      resume() {
        if (this.readyState === _WebSocket.CONNECTING || this.readyState === _WebSocket.CLOSED) {
          return;
        }
        this._paused = false;
        if (!this._receiver._writableState.needDrain) this._socket.resume();
      }
      /**
       * Send a data message.
       *
       * @param {*} data The message to send
       * @param {Object} [options] Options object
       * @param {Boolean} [options.binary] Specifies whether `data` is binary or
       *     text
       * @param {Boolean} [options.compress] Specifies whether or not to compress
       *     `data`
       * @param {Boolean} [options.fin=true] Specifies whether the fragment is the
       *     last one
       * @param {Boolean} [options.mask] Specifies whether or not to mask `data`
       * @param {Function} [cb] Callback which is executed when data is written out
       * @public
       */
      send(data, options, cb) {
        if (this.readyState === _WebSocket.CONNECTING) {
          throw new Error("WebSocket is not open: readyState 0 (CONNECTING)");
        }
        if (typeof options === "function") {
          cb = options;
          options = {};
        }
        if (typeof data === "number") data = data.toString();
        if (this.readyState !== _WebSocket.OPEN) {
          sendAfterClose(this, data, cb);
          return;
        }
        const opts = {
          binary: typeof data !== "string",
          mask: !this._isServer,
          compress: true,
          fin: true,
          ...options
        };
        if (!this._extensions[PerMessageDeflate2.extensionName]) {
          opts.compress = false;
        }
        this._sender.send(data || EMPTY_BUFFER, opts, cb);
      }
      /**
       * Forcibly close the connection.
       *
       * @public
       */
      terminate() {
        if (this.readyState === _WebSocket.CLOSED) return;
        if (this.readyState === _WebSocket.CONNECTING) {
          const msg = "WebSocket was closed before the connection was established";
          abortHandshake(this, this._req, msg);
          return;
        }
        if (this._socket) {
          this._readyState = _WebSocket.CLOSING;
          this._socket.destroy();
        }
      }
    };
    Object.defineProperty(WebSocket2, "CONNECTING", {
      enumerable: true,
      value: readyStates.indexOf("CONNECTING")
    });
    Object.defineProperty(WebSocket2.prototype, "CONNECTING", {
      enumerable: true,
      value: readyStates.indexOf("CONNECTING")
    });
    Object.defineProperty(WebSocket2, "OPEN", {
      enumerable: true,
      value: readyStates.indexOf("OPEN")
    });
    Object.defineProperty(WebSocket2.prototype, "OPEN", {
      enumerable: true,
      value: readyStates.indexOf("OPEN")
    });
    Object.defineProperty(WebSocket2, "CLOSING", {
      enumerable: true,
      value: readyStates.indexOf("CLOSING")
    });
    Object.defineProperty(WebSocket2.prototype, "CLOSING", {
      enumerable: true,
      value: readyStates.indexOf("CLOSING")
    });
    Object.defineProperty(WebSocket2, "CLOSED", {
      enumerable: true,
      value: readyStates.indexOf("CLOSED")
    });
    Object.defineProperty(WebSocket2.prototype, "CLOSED", {
      enumerable: true,
      value: readyStates.indexOf("CLOSED")
    });
    [
      "binaryType",
      "bufferedAmount",
      "extensions",
      "isPaused",
      "protocol",
      "readyState",
      "url"
    ].forEach((property) => {
      Object.defineProperty(WebSocket2.prototype, property, { enumerable: true });
    });
    ["open", "error", "close", "message"].forEach((method) => {
      Object.defineProperty(WebSocket2.prototype, `on${method}`, {
        enumerable: true,
        get() {
          for (const listener of this.listeners(method)) {
            if (listener[kForOnEventAttribute]) return listener[kListener];
          }
          return null;
        },
        set(handler) {
          for (const listener of this.listeners(method)) {
            if (listener[kForOnEventAttribute]) {
              this.removeListener(method, listener);
              break;
            }
          }
          if (typeof handler !== "function") return;
          this.addEventListener(method, handler, {
            [kForOnEventAttribute]: true
          });
        }
      });
    });
    WebSocket2.prototype.addEventListener = addEventListener;
    WebSocket2.prototype.removeEventListener = removeEventListener;
    module2.exports = WebSocket2;
    function initAsClient(websocket, address, protocols, options) {
      const opts = {
        allowSynchronousEvents: true,
        autoPong: true,
        closeTimeout: CLOSE_TIMEOUT,
        protocolVersion: protocolVersions[1],
        maxBufferedChunks: 256 * 1024,
        maxFragments: 16 * 1024,
        maxPayload: 100 * 1024 * 1024,
        skipUTF8Validation: false,
        perMessageDeflate: true,
        followRedirects: false,
        maxRedirects: 10,
        ...options,
        socketPath: void 0,
        hostname: void 0,
        protocol: void 0,
        protocols: void 0,
        timeout: void 0,
        method: "GET",
        host: void 0,
        path: void 0,
        port: void 0
      };
      websocket._autoPong = opts.autoPong;
      websocket._closeTimeout = opts.closeTimeout;
      if (!protocolVersions.includes(opts.protocolVersion)) {
        throw new RangeError(
          `Unsupported protocol version: ${opts.protocolVersion} (supported versions: ${protocolVersions.join(", ")})`
        );
      }
      let parsedUrl;
      if (address instanceof URL) {
        parsedUrl = address;
      } else {
        try {
          parsedUrl = new URL(address);
        } catch {
          throw new SyntaxError(`Invalid URL: ${address}`);
        }
      }
      if (parsedUrl.protocol === "http:") {
        parsedUrl.protocol = "ws:";
      } else if (parsedUrl.protocol === "https:") {
        parsedUrl.protocol = "wss:";
      }
      websocket._url = parsedUrl.href;
      const isSecure = parsedUrl.protocol === "wss:";
      const isIpcUrl = parsedUrl.protocol === "ws+unix:";
      let invalidUrlMessage;
      if (parsedUrl.protocol !== "ws:" && !isSecure && !isIpcUrl) {
        invalidUrlMessage = `The URL's protocol must be one of "ws:", "wss:", "http:", "https:", or "ws+unix:"`;
      } else if (isIpcUrl && !parsedUrl.pathname) {
        invalidUrlMessage = "The URL's pathname is empty";
      } else if (parsedUrl.hash) {
        invalidUrlMessage = "The URL contains a fragment identifier";
      }
      if (invalidUrlMessage) {
        const err = new SyntaxError(invalidUrlMessage);
        if (websocket._redirects === 0) {
          throw err;
        } else {
          emitErrorAndClose(websocket, err);
          return;
        }
      }
      const defaultPort = isSecure ? 443 : 80;
      const key = randomBytes(16).toString("base64");
      const request = isSecure ? https.request : http.request;
      const protocolSet = /* @__PURE__ */ new Set();
      let perMessageDeflate;
      opts.createConnection = opts.createConnection || (isSecure ? tlsConnect : netConnect);
      opts.defaultPort = opts.defaultPort || defaultPort;
      opts.port = parsedUrl.port || defaultPort;
      opts.host = parsedUrl.hostname.startsWith("[") ? parsedUrl.hostname.slice(1, -1) : parsedUrl.hostname;
      opts.headers = {
        ...opts.headers,
        "Sec-WebSocket-Version": opts.protocolVersion,
        "Sec-WebSocket-Key": key,
        Connection: "Upgrade",
        Upgrade: "websocket"
      };
      opts.path = parsedUrl.pathname + parsedUrl.search;
      opts.timeout = opts.handshakeTimeout;
      if (opts.perMessageDeflate) {
        perMessageDeflate = new PerMessageDeflate2({
          ...opts.perMessageDeflate,
          isServer: false,
          maxPayload: opts.maxPayload
        });
        opts.headers["Sec-WebSocket-Extensions"] = format({
          [PerMessageDeflate2.extensionName]: perMessageDeflate.offer()
        });
      }
      if (protocols.length) {
        for (const protocol of protocols) {
          if (typeof protocol !== "string" || !subprotocolRegex.test(protocol) || protocolSet.has(protocol)) {
            throw new SyntaxError(
              "An invalid or duplicated subprotocol was specified"
            );
          }
          protocolSet.add(protocol);
        }
        opts.headers["Sec-WebSocket-Protocol"] = protocols.join(",");
      }
      if (opts.origin) {
        if (opts.protocolVersion < 13) {
          opts.headers["Sec-WebSocket-Origin"] = opts.origin;
        } else {
          opts.headers.Origin = opts.origin;
        }
      }
      if (parsedUrl.username || parsedUrl.password) {
        opts.auth = `${parsedUrl.username}:${parsedUrl.password}`;
      }
      if (isIpcUrl) {
        const parts2 = opts.path.split(":");
        opts.socketPath = parts2[0];
        opts.path = parts2[1];
      }
      let req;
      if (opts.followRedirects) {
        if (websocket._redirects === 0) {
          websocket._originalIpc = isIpcUrl;
          websocket._originalSecure = isSecure;
          websocket._originalHostOrSocketPath = isIpcUrl ? opts.socketPath : parsedUrl.host;
          const headers = options && options.headers;
          options = { ...options, headers: {} };
          if (headers) {
            for (const [key2, value] of Object.entries(headers)) {
              options.headers[key2.toLowerCase()] = value;
            }
          }
        } else if (websocket.listenerCount("redirect") === 0) {
          const isSameHost = isIpcUrl ? websocket._originalIpc ? opts.socketPath === websocket._originalHostOrSocketPath : false : websocket._originalIpc ? false : parsedUrl.host === websocket._originalHostOrSocketPath;
          if (!isSameHost || websocket._originalSecure && !isSecure) {
            delete opts.headers.authorization;
            delete opts.headers.cookie;
            if (!isSameHost) delete opts.headers.host;
            opts.auth = void 0;
          }
        }
        if (opts.auth && !options.headers.authorization) {
          options.headers.authorization = "Basic " + Buffer.from(opts.auth).toString("base64");
        }
        req = websocket._req = request(opts);
        if (websocket._redirects) {
          websocket.emit("redirect", websocket.url, req);
        }
      } else {
        req = websocket._req = request(opts);
      }
      if (opts.timeout) {
        req.on("timeout", () => {
          abortHandshake(websocket, req, "Opening handshake has timed out");
        });
      }
      req.on("error", (err) => {
        if (req === null || req[kAborted]) return;
        req = websocket._req = null;
        emitErrorAndClose(websocket, err);
      });
      req.on("response", (res) => {
        const location = res.headers.location;
        const statusCode = res.statusCode;
        if (location && opts.followRedirects && statusCode >= 300 && statusCode < 400) {
          if (++websocket._redirects > opts.maxRedirects) {
            abortHandshake(websocket, req, "Maximum redirects exceeded");
            return;
          }
          req.abort();
          let addr;
          try {
            addr = new URL(location, address);
          } catch (e) {
            const err = new SyntaxError(`Invalid URL: ${location}`);
            emitErrorAndClose(websocket, err);
            return;
          }
          initAsClient(websocket, addr, protocols, options);
        } else if (!websocket.emit("unexpected-response", req, res)) {
          abortHandshake(
            websocket,
            req,
            `Unexpected server response: ${res.statusCode}`
          );
        }
      });
      req.on("upgrade", (res, socket, head) => {
        websocket.emit("upgrade", res);
        if (websocket.readyState !== WebSocket2.CONNECTING) return;
        req = websocket._req = null;
        const upgrade = res.headers.upgrade;
        if (upgrade === void 0 || upgrade.toLowerCase() !== "websocket") {
          abortHandshake(websocket, socket, "Invalid Upgrade header");
          return;
        }
        const digest = createHash("sha1").update(key + GUID).digest("base64");
        if (res.headers["sec-websocket-accept"] !== digest) {
          abortHandshake(websocket, socket, "Invalid Sec-WebSocket-Accept header");
          return;
        }
        const serverProt = res.headers["sec-websocket-protocol"];
        let protError;
        if (serverProt !== void 0) {
          if (!protocolSet.size) {
            protError = "Server sent a subprotocol but none was requested";
          } else if (!protocolSet.has(serverProt)) {
            protError = "Server sent an invalid subprotocol";
          }
        } else if (protocolSet.size) {
          protError = "Server sent no subprotocol";
        }
        if (protError) {
          abortHandshake(websocket, socket, protError);
          return;
        }
        if (serverProt) websocket._protocol = serverProt;
        const secWebSocketExtensions = res.headers["sec-websocket-extensions"];
        if (secWebSocketExtensions !== void 0) {
          if (!perMessageDeflate) {
            const message = "Server sent a Sec-WebSocket-Extensions header but no extension was requested";
            abortHandshake(websocket, socket, message);
            return;
          }
          let extensions;
          try {
            extensions = parse(secWebSocketExtensions);
          } catch (err) {
            const message = "Invalid Sec-WebSocket-Extensions header";
            abortHandshake(websocket, socket, message);
            return;
          }
          const extensionNames = Object.keys(extensions);
          if (extensionNames.length !== 1 || extensionNames[0] !== PerMessageDeflate2.extensionName) {
            const message = "Server indicated an extension that was not requested";
            abortHandshake(websocket, socket, message);
            return;
          }
          try {
            perMessageDeflate.accept(extensions[PerMessageDeflate2.extensionName]);
          } catch (err) {
            const message = "Invalid Sec-WebSocket-Extensions header";
            abortHandshake(websocket, socket, message);
            return;
          }
          websocket._extensions[PerMessageDeflate2.extensionName] = perMessageDeflate;
        }
        websocket.setSocket(socket, head, {
          allowSynchronousEvents: opts.allowSynchronousEvents,
          generateMask: opts.generateMask,
          maxBufferedChunks: opts.maxBufferedChunks,
          maxFragments: opts.maxFragments,
          maxPayload: opts.maxPayload,
          skipUTF8Validation: opts.skipUTF8Validation
        });
      });
      if (opts.finishRequest) {
        opts.finishRequest(req, websocket);
      } else {
        req.end();
      }
    }
    function emitErrorAndClose(websocket, err) {
      websocket._readyState = WebSocket2.CLOSING;
      websocket._errorEmitted = true;
      websocket.emit("error", err);
      websocket.emitClose();
    }
    function netConnect(options) {
      options.path = options.socketPath;
      return net.connect(options);
    }
    function tlsConnect(options) {
      options.path = void 0;
      if (!options.servername && options.servername !== "") {
        options.servername = net.isIP(options.host) ? "" : options.host;
      }
      return tls.connect(options);
    }
    function abortHandshake(websocket, stream, message) {
      websocket._readyState = WebSocket2.CLOSING;
      const err = new Error(message);
      Error.captureStackTrace(err, abortHandshake);
      if (stream.setHeader) {
        stream[kAborted] = true;
        stream.abort();
        if (stream.socket && !stream.socket.destroyed) {
          stream.socket.destroy();
        }
        process.nextTick(emitErrorAndClose, websocket, err);
      } else {
        stream.destroy(err);
        stream.once("error", websocket.emit.bind(websocket, "error"));
        stream.once("close", websocket.emitClose.bind(websocket));
      }
    }
    function sendAfterClose(websocket, data, cb) {
      if (data) {
        const length = isBlob(data) ? data.size : toBuffer(data).length;
        if (websocket._socket) websocket._sender._bufferedBytes += length;
        else websocket._bufferedAmount += length;
      }
      if (cb) {
        const err = new Error(
          `WebSocket is not open: readyState ${websocket.readyState} (${readyStates[websocket.readyState]})`
        );
        process.nextTick(cb, err);
      }
    }
    function receiverOnConclude(code, reason) {
      const websocket = this[kWebSocket];
      websocket._closeFrameReceived = true;
      websocket._closeMessage = reason;
      websocket._closeCode = code;
      if (websocket._socket[kWebSocket] === void 0) return;
      websocket._socket.removeListener("data", socketOnData);
      process.nextTick(resume, websocket._socket);
      if (code === 1005) websocket.close();
      else websocket.close(code, reason);
    }
    function receiverOnDrain() {
      const websocket = this[kWebSocket];
      if (!websocket.isPaused) websocket._socket.resume();
    }
    function receiverOnError(err) {
      const websocket = this[kWebSocket];
      if (websocket._socket[kWebSocket] !== void 0) {
        websocket._socket.removeListener("data", socketOnData);
        process.nextTick(resume, websocket._socket);
        websocket.close(err[kStatusCode]);
      }
      if (!websocket._errorEmitted) {
        websocket._errorEmitted = true;
        websocket.emit("error", err);
      }
    }
    function receiverOnFinish() {
      this[kWebSocket].emitClose();
    }
    function receiverOnMessage(data, isBinary) {
      this[kWebSocket].emit("message", data, isBinary);
    }
    function receiverOnPing(data) {
      const websocket = this[kWebSocket];
      if (websocket._autoPong) websocket.pong(data, !this._isServer, NOOP);
      websocket.emit("ping", data);
    }
    function receiverOnPong(data) {
      this[kWebSocket].emit("pong", data);
    }
    function resume(stream) {
      stream.resume();
    }
    function senderOnError(err) {
      const websocket = this[kWebSocket];
      if (websocket.readyState === WebSocket2.CLOSED) return;
      if (websocket.readyState === WebSocket2.OPEN) {
        websocket._readyState = WebSocket2.CLOSING;
        setCloseTimer(websocket);
      }
      this._socket.end();
      if (!websocket._errorEmitted) {
        websocket._errorEmitted = true;
        websocket.emit("error", err);
      }
    }
    function setCloseTimer(websocket) {
      websocket._closeTimer = setTimeout(
        websocket._socket.destroy.bind(websocket._socket),
        websocket._closeTimeout
      );
    }
    function socketOnClose() {
      const websocket = this[kWebSocket];
      this.removeListener("close", socketOnClose);
      this.removeListener("data", socketOnData);
      this.removeListener("end", socketOnEnd);
      websocket._readyState = WebSocket2.CLOSING;
      if (!this._readableState.endEmitted && !websocket._closeFrameReceived && !websocket._receiver._writableState.errorEmitted && this._readableState.length !== 0) {
        const chunk = this.read(this._readableState.length);
        websocket._receiver.write(chunk);
      }
      websocket._receiver.end();
      this[kWebSocket] = void 0;
      clearTimeout(websocket._closeTimer);
      if (websocket._receiver._writableState.finished || websocket._receiver._writableState.errorEmitted) {
        websocket.emitClose();
      } else {
        websocket._receiver.on("error", receiverOnFinish);
        websocket._receiver.on("finish", receiverOnFinish);
      }
    }
    function socketOnData(chunk) {
      if (!this[kWebSocket]._receiver.write(chunk)) {
        this.pause();
      }
    }
    function socketOnEnd() {
      const websocket = this[kWebSocket];
      websocket._readyState = WebSocket2.CLOSING;
      websocket._receiver.end();
      this.end();
    }
    function socketOnError() {
      const websocket = this[kWebSocket];
      this.removeListener("error", socketOnError);
      this.on("error", NOOP);
      if (websocket) {
        websocket._readyState = WebSocket2.CLOSING;
        this.destroy();
      }
    }
  }
});

// node_modules/.pnpm/ws@8.22.0/node_modules/ws/lib/stream.js
var require_stream = __commonJS({
  "node_modules/.pnpm/ws@8.22.0/node_modules/ws/lib/stream.js"(exports2, module2) {
    "use strict";
    var WebSocket2 = require_websocket();
    var { Duplex } = require("stream");
    function emitClose(stream) {
      stream.emit("close");
    }
    function duplexOnEnd() {
      if (!this.destroyed && this._writableState.finished) {
        this.destroy();
      }
    }
    function duplexOnError(err) {
      this.removeListener("error", duplexOnError);
      this.destroy();
      if (this.listenerCount("error") === 0) {
        this.emit("error", err);
      }
    }
    function createWebSocketStream2(ws, options) {
      let terminateOnDestroy = true;
      const duplex = new Duplex({
        ...options,
        autoDestroy: false,
        emitClose: false,
        objectMode: false,
        writableObjectMode: false
      });
      ws.on("message", function message(msg, isBinary) {
        const data = !isBinary && duplex._readableState.objectMode ? msg.toString() : msg;
        if (!duplex.push(data)) ws.pause();
      });
      ws.once("error", function error(err) {
        if (duplex.destroyed) return;
        terminateOnDestroy = false;
        duplex.destroy(err);
      });
      ws.once("close", function close() {
        if (duplex.destroyed) return;
        duplex.push(null);
      });
      duplex._destroy = function(err, callback) {
        if (ws.readyState === ws.CLOSED) {
          callback(err);
          process.nextTick(emitClose, duplex);
          return;
        }
        let called = false;
        ws.once("error", function error(err2) {
          called = true;
          callback(err2);
        });
        ws.once("close", function close() {
          if (!called) callback(err);
          process.nextTick(emitClose, duplex);
        });
        if (terminateOnDestroy) ws.terminate();
      };
      duplex._final = function(callback) {
        if (ws.readyState === ws.CONNECTING) {
          ws.once("open", function open() {
            duplex._final(callback);
          });
          return;
        }
        if (ws._socket === null) return;
        if (ws._socket._writableState.finished) {
          callback();
          if (duplex._readableState.endEmitted) duplex.destroy();
        } else {
          ws._socket.once("finish", function finish() {
            callback();
          });
          ws.close();
        }
      };
      duplex._read = function() {
        if (ws.isPaused) ws.resume();
      };
      duplex._write = function(chunk, encoding, callback) {
        if (ws.readyState === ws.CONNECTING) {
          ws.once("open", function open() {
            duplex._write(chunk, encoding, callback);
          });
          return;
        }
        ws.send(chunk, callback);
      };
      duplex.on("end", duplexOnEnd);
      duplex.on("error", duplexOnError);
      return duplex;
    }
    module2.exports = createWebSocketStream2;
  }
});

// node_modules/.pnpm/ws@8.22.0/node_modules/ws/lib/subprotocol.js
var require_subprotocol = __commonJS({
  "node_modules/.pnpm/ws@8.22.0/node_modules/ws/lib/subprotocol.js"(exports2, module2) {
    "use strict";
    var { tokenChars } = require_validation();
    function parse(header) {
      const protocols = /* @__PURE__ */ new Set();
      let start = -1;
      let end = -1;
      let i = 0;
      for (i; i < header.length; i++) {
        const code = header.charCodeAt(i);
        if (end === -1 && tokenChars[code] === 1) {
          if (start === -1) start = i;
        } else if (i !== 0 && (code === 32 || code === 9)) {
          if (end === -1 && start !== -1) end = i;
        } else if (code === 44) {
          if (start === -1) {
            throw new SyntaxError(`Unexpected character at index ${i}`);
          }
          if (end === -1) end = i;
          const protocol2 = header.slice(start, end);
          if (protocols.has(protocol2)) {
            throw new SyntaxError(`The "${protocol2}" subprotocol is duplicated`);
          }
          protocols.add(protocol2);
          start = end = -1;
        } else {
          throw new SyntaxError(`Unexpected character at index ${i}`);
        }
      }
      if (start === -1 || end !== -1) {
        throw new SyntaxError("Unexpected end of input");
      }
      const protocol = header.slice(start, i);
      if (protocols.has(protocol)) {
        throw new SyntaxError(`The "${protocol}" subprotocol is duplicated`);
      }
      protocols.add(protocol);
      return protocols;
    }
    module2.exports = { parse };
  }
});

// node_modules/.pnpm/ws@8.22.0/node_modules/ws/lib/websocket-server.js
var require_websocket_server = __commonJS({
  "node_modules/.pnpm/ws@8.22.0/node_modules/ws/lib/websocket-server.js"(exports2, module2) {
    "use strict";
    var EventEmitter = require("events");
    var http = require("http");
    var { Duplex } = require("stream");
    var { createHash } = require("crypto");
    var extension2 = require_extension();
    var PerMessageDeflate2 = require_permessage_deflate();
    var subprotocol2 = require_subprotocol();
    var WebSocket2 = require_websocket();
    var { CLOSE_TIMEOUT, GUID, kWebSocket } = require_constants();
    var keyRegex = /^[+/0-9A-Za-z]{22}==$/;
    var RUNNING = 0;
    var CLOSING = 1;
    var CLOSED = 2;
    var WebSocketServer2 = class extends EventEmitter {
      /**
       * Create a `WebSocketServer` instance.
       *
       * @param {Object} options Configuration options
       * @param {Boolean} [options.allowSynchronousEvents=true] Specifies whether
       *     any of the `'message'`, `'ping'`, and `'pong'` events can be emitted
       *     multiple times in the same tick
       * @param {Boolean} [options.autoPong=true] Specifies whether or not to
       *     automatically send a pong in response to a ping
       * @param {Number} [options.backlog=511] The maximum length of the queue of
       *     pending connections
       * @param {Boolean} [options.clientTracking=true] Specifies whether or not to
       *     track clients
       * @param {Number} [options.closeTimeout=30000] Duration in milliseconds to
       *     wait for the closing handshake to finish after `websocket.close()` is
       *     called
       * @param {Function} [options.handleProtocols] A hook to handle protocols
       * @param {String} [options.host] The hostname where to bind the server
       * @param {Number} [options.maxBufferedChunks=262144] The maximum number of
       *     buffered data chunks
       * @param {Number} [options.maxFragments=16384] The maximum number of message
       *     fragments
       * @param {Number} [options.maxPayload=104857600] The maximum allowed message
       *     size
       * @param {Boolean} [options.noServer=false] Enable no server mode
       * @param {String} [options.path] Accept only connections matching this path
       * @param {(Boolean|Object)} [options.perMessageDeflate=false] Enable/disable
       *     permessage-deflate
       * @param {Number} [options.port] The port where to bind the server
       * @param {(http.Server|https.Server)} [options.server] A pre-created HTTP/S
       *     server to use
       * @param {Boolean} [options.skipUTF8Validation=false] Specifies whether or
       *     not to skip UTF-8 validation for text and close messages
       * @param {Function} [options.verifyClient] A hook to reject connections
       * @param {Function} [options.WebSocket=WebSocket] Specifies the `WebSocket`
       *     class to use. It must be the `WebSocket` class or class that extends it
       * @param {Function} [callback] A listener for the `listening` event
       */
      constructor(options, callback) {
        super();
        options = {
          allowSynchronousEvents: true,
          autoPong: true,
          maxBufferedChunks: 256 * 1024,
          maxFragments: 16 * 1024,
          maxPayload: 100 * 1024 * 1024,
          skipUTF8Validation: false,
          perMessageDeflate: false,
          handleProtocols: null,
          clientTracking: true,
          closeTimeout: CLOSE_TIMEOUT,
          verifyClient: null,
          noServer: false,
          backlog: null,
          // use default (511 as implemented in net.js)
          server: null,
          host: null,
          path: null,
          port: null,
          WebSocket: WebSocket2,
          ...options
        };
        if (options.port == null && !options.server && !options.noServer || options.port != null && (options.server || options.noServer) || options.server && options.noServer) {
          throw new TypeError(
            'One and only one of the "port", "server", or "noServer" options must be specified'
          );
        }
        if (options.port != null) {
          this._server = http.createServer((req, res) => {
            const body = http.STATUS_CODES[426];
            res.writeHead(426, {
              "Content-Length": body.length,
              "Content-Type": "text/plain"
            });
            res.end(body);
          });
          this._server.listen(
            options.port,
            options.host,
            options.backlog,
            callback
          );
        } else if (options.server) {
          this._server = options.server;
        }
        if (this._server) {
          const emitConnection = this.emit.bind(this, "connection");
          this._removeListeners = addListeners(this._server, {
            listening: this.emit.bind(this, "listening"),
            error: this.emit.bind(this, "error"),
            upgrade: (req, socket, head) => {
              this.handleUpgrade(req, socket, head, emitConnection);
            }
          });
        }
        if (options.perMessageDeflate === true) options.perMessageDeflate = {};
        if (options.clientTracking) {
          this.clients = /* @__PURE__ */ new Set();
          this._shouldEmitClose = false;
        }
        this.options = options;
        this._state = RUNNING;
      }
      /**
       * Returns the bound address, the address family name, and port of the server
       * as reported by the operating system if listening on an IP socket.
       * If the server is listening on a pipe or UNIX domain socket, the name is
       * returned as a string.
       *
       * @return {(Object|String|null)} The address of the server
       * @public
       */
      address() {
        if (this.options.noServer) {
          throw new Error('The server is operating in "noServer" mode');
        }
        if (!this._server) return null;
        return this._server.address();
      }
      /**
       * Stop the server from accepting new connections and emit the `'close'` event
       * when all existing connections are closed.
       *
       * @param {Function} [cb] A one-time listener for the `'close'` event
       * @public
       */
      close(cb) {
        if (this._state === CLOSED) {
          if (cb) {
            this.once("close", () => {
              cb(new Error("The server is not running"));
            });
          }
          process.nextTick(emitClose, this);
          return;
        }
        if (cb) this.once("close", cb);
        if (this._state === CLOSING) return;
        this._state = CLOSING;
        if (this.options.noServer || this.options.server) {
          if (this._server) {
            this._removeListeners();
            this._removeListeners = this._server = null;
          }
          if (this.clients) {
            if (!this.clients.size) {
              process.nextTick(emitClose, this);
            } else {
              this._shouldEmitClose = true;
            }
          } else {
            process.nextTick(emitClose, this);
          }
        } else {
          const server = this._server;
          this._removeListeners();
          this._removeListeners = this._server = null;
          server.close(() => {
            emitClose(this);
          });
        }
      }
      /**
       * See if a given request should be handled by this server instance.
       *
       * @param {http.IncomingMessage} req Request object to inspect
       * @return {Boolean} `true` if the request is valid, else `false`
       * @public
       */
      shouldHandle(req) {
        if (this.options.path) {
          const index = req.url.indexOf("?");
          const pathname = index !== -1 ? req.url.slice(0, index) : req.url;
          if (pathname !== this.options.path) return false;
        }
        return true;
      }
      /**
       * Handle a HTTP Upgrade request.
       *
       * @param {http.IncomingMessage} req The request object
       * @param {Duplex} socket The network socket between the server and client
       * @param {Buffer} head The first packet of the upgraded stream
       * @param {Function} cb Callback
       * @public
       */
      handleUpgrade(req, socket, head, cb) {
        socket.on("error", socketOnError);
        const key = req.headers["sec-websocket-key"];
        const upgrade = req.headers.upgrade;
        const version = +req.headers["sec-websocket-version"];
        if (req.method !== "GET") {
          const message = "Invalid HTTP method";
          abortHandshakeOrEmitwsClientError(this, req, socket, 405, message);
          return;
        }
        if (upgrade === void 0 || upgrade.toLowerCase() !== "websocket") {
          const message = "Invalid Upgrade header";
          abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
          return;
        }
        if (key === void 0 || !keyRegex.test(key)) {
          const message = "Missing or invalid Sec-WebSocket-Key header";
          abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
          return;
        }
        if (version !== 13 && version !== 8) {
          const message = "Missing or invalid Sec-WebSocket-Version header";
          abortHandshakeOrEmitwsClientError(this, req, socket, 400, message, {
            "Sec-WebSocket-Version": "13, 8"
          });
          return;
        }
        if (!this.shouldHandle(req)) {
          abortHandshake(socket, 400);
          return;
        }
        const secWebSocketProtocol = req.headers["sec-websocket-protocol"];
        let protocols = /* @__PURE__ */ new Set();
        if (secWebSocketProtocol !== void 0) {
          try {
            protocols = subprotocol2.parse(secWebSocketProtocol);
          } catch (err) {
            const message = "Invalid Sec-WebSocket-Protocol header";
            abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
            return;
          }
        }
        const secWebSocketExtensions = req.headers["sec-websocket-extensions"];
        const extensions = {};
        if (this.options.perMessageDeflate && secWebSocketExtensions !== void 0) {
          const perMessageDeflate = new PerMessageDeflate2({
            ...this.options.perMessageDeflate,
            isServer: true,
            maxPayload: this.options.maxPayload
          });
          try {
            const offers = extension2.parse(secWebSocketExtensions);
            if (offers[PerMessageDeflate2.extensionName]) {
              perMessageDeflate.accept(offers[PerMessageDeflate2.extensionName]);
              extensions[PerMessageDeflate2.extensionName] = perMessageDeflate;
            }
          } catch (err) {
            const message = "Invalid or unacceptable Sec-WebSocket-Extensions header";
            abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
            return;
          }
        }
        if (this.options.verifyClient) {
          const info = {
            origin: req.headers[`${version === 8 ? "sec-websocket-origin" : "origin"}`],
            secure: !!(req.socket.authorized || req.socket.encrypted),
            req
          };
          if (this.options.verifyClient.length === 2) {
            this.options.verifyClient(info, (verified, code, message, headers) => {
              if (!verified) {
                return abortHandshake(socket, code || 401, message, headers);
              }
              this.completeUpgrade(
                extensions,
                key,
                protocols,
                req,
                socket,
                head,
                cb
              );
            });
            return;
          }
          if (!this.options.verifyClient(info)) return abortHandshake(socket, 401);
        }
        this.completeUpgrade(extensions, key, protocols, req, socket, head, cb);
      }
      /**
       * Upgrade the connection to WebSocket.
       *
       * @param {Object} extensions The accepted extensions
       * @param {String} key The value of the `Sec-WebSocket-Key` header
       * @param {Set} protocols The subprotocols
       * @param {http.IncomingMessage} req The request object
       * @param {Duplex} socket The network socket between the server and client
       * @param {Buffer} head The first packet of the upgraded stream
       * @param {Function} cb Callback
       * @throws {Error} If called more than once with the same socket
       * @private
       */
      completeUpgrade(extensions, key, protocols, req, socket, head, cb) {
        if (!socket.readable || !socket.writable) return socket.destroy();
        if (socket[kWebSocket]) {
          throw new Error(
            "server.handleUpgrade() was called more than once with the same socket, possibly due to a misconfiguration"
          );
        }
        if (this._state > RUNNING) return abortHandshake(socket, 503);
        const digest = createHash("sha1").update(key + GUID).digest("base64");
        const headers = [
          "HTTP/1.1 101 Switching Protocols",
          "Upgrade: websocket",
          "Connection: Upgrade",
          `Sec-WebSocket-Accept: ${digest}`
        ];
        const ws = new this.options.WebSocket(null, void 0, this.options);
        if (protocols.size) {
          const protocol = this.options.handleProtocols ? this.options.handleProtocols(protocols, req) : protocols.values().next().value;
          if (protocol) {
            headers.push(`Sec-WebSocket-Protocol: ${protocol}`);
            ws._protocol = protocol;
          }
        }
        if (extensions[PerMessageDeflate2.extensionName]) {
          const params = extensions[PerMessageDeflate2.extensionName].params;
          const value = extension2.format({
            [PerMessageDeflate2.extensionName]: [params]
          });
          headers.push(`Sec-WebSocket-Extensions: ${value}`);
          ws._extensions = extensions;
        }
        this.emit("headers", headers, req);
        socket.write(headers.concat("\r\n").join("\r\n"));
        socket.removeListener("error", socketOnError);
        ws.setSocket(socket, head, {
          allowSynchronousEvents: this.options.allowSynchronousEvents,
          maxBufferedChunks: this.options.maxBufferedChunks,
          maxFragments: this.options.maxFragments,
          maxPayload: this.options.maxPayload,
          skipUTF8Validation: this.options.skipUTF8Validation
        });
        if (this.clients) {
          this.clients.add(ws);
          ws.on("close", () => {
            this.clients.delete(ws);
            if (this._shouldEmitClose && !this.clients.size) {
              process.nextTick(emitClose, this);
            }
          });
        }
        cb(ws, req);
      }
    };
    module2.exports = WebSocketServer2;
    function addListeners(server, map) {
      for (const event of Object.keys(map)) server.on(event, map[event]);
      return function removeListeners() {
        for (const event of Object.keys(map)) {
          server.removeListener(event, map[event]);
        }
      };
    }
    function emitClose(server) {
      server._state = CLOSED;
      server.emit("close");
    }
    function socketOnError() {
      this.destroy();
    }
    function abortHandshake(socket, code, message, headers) {
      message = message || http.STATUS_CODES[code];
      headers = {
        Connection: "close",
        "Content-Type": "text/html",
        "Content-Length": Buffer.byteLength(message),
        ...headers
      };
      socket.once("finish", socket.destroy);
      socket.end(
        `HTTP/1.1 ${code} ${http.STATUS_CODES[code]}\r
` + Object.keys(headers).map((h) => `${h}: ${headers[h]}`).join("\r\n") + "\r\n\r\n" + message
      );
    }
    function abortHandshakeOrEmitwsClientError(server, req, socket, code, message, headers) {
      if (server.listenerCount("wsClientError")) {
        const err = new Error(message);
        Error.captureStackTrace(err, abortHandshakeOrEmitwsClientError);
        server.emit("wsClientError", err, socket, req);
      } else {
        abortHandshake(socket, code, message, headers);
      }
    }
  }
});

// backend/rooms.mjs
var rooms_exports = {};
__export(rooms_exports, {
  RoomHub: () => RoomHub,
  attachRooms: () => attachRooms,
  mergeEnglishDefinitions: () => mergeEnglishDefinitions
});
module.exports = __toCommonJS(rooms_exports);
var import_node_crypto = require("node:crypto");

// node_modules/.pnpm/ws@8.22.0/node_modules/ws/wrapper.mjs
var import_stream = __toESM(require_stream(), 1);
var import_extension = __toESM(require_extension(), 1);
var import_permessage_deflate = __toESM(require_permessage_deflate(), 1);
var import_receiver = __toESM(require_receiver(), 1);
var import_sender = __toESM(require_sender(), 1);
var import_subprotocol = __toESM(require_subprotocol(), 1);
var import_websocket = __toESM(require_websocket(), 1);
var import_websocket_server = __toESM(require_websocket_server(), 1);

// src/game/wordBank.ts
var ADDITIONAL_WORDS = [
  // Food and meals.
  { id: "banana", answer: "banana", meaning: "Qu\u1EA3 chu\u1ED1i", category: "Th\u1EE9c \u0103n", partOfSpeech: "noun", difficulty: 1 },
  { id: "potato", answer: "potato", meaning: "C\u1EE7 khoai t\xE2y", category: "Th\u1EE9c \u0103n", partOfSpeech: "noun", difficulty: 2 },
  { id: "tomato", answer: "tomato", meaning: "Qu\u1EA3 c\xE0 chua", category: "Th\u1EE9c \u0103n", partOfSpeech: "noun", difficulty: 2 },
  { id: "onion", answer: "onion", meaning: "C\u1EE7 h\xE0nh t\xE2y", category: "Th\u1EE9c \u0103n", partOfSpeech: "noun", difficulty: 2 },
  { id: "garlic", answer: "garlic", meaning: "T\u1ECFi", category: "Th\u1EE9c \u0103n", partOfSpeech: "noun", difficulty: 2 },
  { id: "pepper", answer: "pepper", meaning: "H\u1EA1t ti\xEAu d\xF9ng l\xE0m gia v\u1ECB", category: "Th\u1EE9c \u0103n", partOfSpeech: "noun", difficulty: 2 },
  { id: "cheese", answer: "cheese", meaning: "Ph\xF4 mai", category: "Th\u1EE9c \u0103n", partOfSpeech: "noun", difficulty: 2 },
  { id: "butter", answer: "butter", meaning: "B\u01A1 l\xE0m t\u1EEB s\u1EEFa", category: "Th\u1EE9c \u0103n", partOfSpeech: "noun", difficulty: 2 },
  { id: "yogurt", answer: "yogurt", meaning: "S\u1EEFa chua", category: "Th\u1EE9c \u0103n", partOfSpeech: "noun", difficulty: 3 },
  { id: "egg", answer: "egg", meaning: "Qu\u1EA3 tr\u1EE9ng", category: "Th\u1EE9c \u0103n", partOfSpeech: "noun", difficulty: 1 },
  { id: "soup", answer: "soup", meaning: "M\xF3n s\xFAp", category: "Th\u1EE9c \u0103n", partOfSpeech: "noun", difficulty: 1 },
  { id: "salad", answer: "salad", meaning: "M\xF3n rau tr\u1ED9n", category: "Th\u1EE9c \u0103n", partOfSpeech: "noun", difficulty: 1 },
  { id: "noodle", answer: "noodle", meaning: "M\u1ED9t s\u1EE3i m\xEC", category: "Th\u1EE9c \u0103n", partOfSpeech: "noun", difficulty: 2 },
  { id: "sandwich", answer: "sandwich", meaning: "B\xE1nh m\xEC k\u1EB9p gi\u1EEFa hai l\xE1t", category: "Th\u1EE9c \u0103n", partOfSpeech: "noun", difficulty: 3 },
  { id: "biscuit", answer: "biscuit", meaning: "B\xE1nh quy", category: "Th\u1EE9c \u0103n", partOfSpeech: "noun", difficulty: 3 },
  { id: "chocolate", answer: "chocolate", meaning: "S\xF4 c\xF4 la", category: "Th\u1EE9c \u0103n", partOfSpeech: "noun", difficulty: 3 },
  { id: "breakfast", answer: "breakfast", meaning: "B\u1EEFa s\xE1ng", category: "B\u1EEFa \u0103n", partOfSpeech: "noun", difficulty: 2 },
  { id: "lunch", answer: "lunch", meaning: "B\u1EEFa tr\u01B0a", category: "B\u1EEFa \u0103n", partOfSpeech: "noun", difficulty: 2 },
  { id: "dinner", answer: "dinner", meaning: "B\u1EEFa t\u1ED1i", category: "B\u1EEFa \u0103n", partOfSpeech: "noun", difficulty: 2 },
  { id: "cucumber", answer: "cucumber", meaning: "Qu\u1EA3 d\u01B0a chu\u1ED9t", category: "Th\u1EE9c \u0103n", partOfSpeech: "noun", difficulty: 3 },
  { id: "cabbage", answer: "cabbage", meaning: "B\u1EAFp c\u1EA3i", category: "Th\u1EE9c \u0103n", partOfSpeech: "noun", difficulty: 2 },
  { id: "broccoli", answer: "broccoli", meaning: "B\xF4ng c\u1EA3i xanh", category: "Th\u1EE9c \u0103n", partOfSpeech: "noun", difficulty: 3 },
  { id: "pineapple", answer: "pineapple", meaning: "Qu\u1EA3 d\u1EE9a", category: "Th\u1EE9c \u0103n", partOfSpeech: "noun", difficulty: 2 },
  { id: "strawberry", answer: "strawberry", meaning: "Qu\u1EA3 d\xE2u t\xE2y", category: "Th\u1EE9c \u0103n", partOfSpeech: "noun", difficulty: 3 },
  { id: "watermelon", answer: "watermelon", meaning: "Qu\u1EA3 d\u01B0a h\u1EA5u", category: "Th\u1EE9c \u0103n", partOfSpeech: "noun", difficulty: 2 },
  { id: "blueberry", answer: "blueberry", meaning: "Qu\u1EA3 vi\u1EC7t qu\u1EA5t", category: "Th\u1EE9c \u0103n", partOfSpeech: "noun", difficulty: 3 },
  { id: "peanut", answer: "peanut", meaning: "H\u1EA1t l\u1EA1c", category: "Th\u1EE9c \u0103n", partOfSpeech: "noun", difficulty: 2 },
  { id: "mushroom", answer: "mushroom", meaning: "N\u1EA5m d\xF9ng l\xE0m th\u1EE9c \u0103n", category: "Th\u1EE9c \u0103n", partOfSpeech: "noun", difficulty: 2 },
  { id: "sausage", answer: "sausage", meaning: "X\xFAc x\xEDch", category: "Th\u1EE9c \u0103n", partOfSpeech: "noun", difficulty: 3 },
  { id: "pancake", answer: "pancake", meaning: "B\xE1nh k\u1EBFp", category: "Th\u1EE9c \u0103n", partOfSpeech: "noun", difficulty: 2 },
  // Animals and nature.
  { id: "duck", answer: "duck", meaning: "Con v\u1ECBt", category: "\u0110\u1ED9ng v\u1EADt", partOfSpeech: "noun", difficulty: 1 },
  { id: "sheep", answer: "sheep", meaning: "Con c\u1EEBu", category: "\u0110\u1ED9ng v\u1EADt", partOfSpeech: "noun", difficulty: 2 },
  { id: "goat", answer: "goat", meaning: "Con d\xEA", category: "\u0110\u1ED9ng v\u1EADt", partOfSpeech: "noun", difficulty: 1 },
  { id: "pig", answer: "pig", meaning: "Con l\u1EE3n", category: "\u0110\u1ED9ng v\u1EADt", partOfSpeech: "noun", difficulty: 1 },
  { id: "cow", answer: "cow", meaning: "Con b\xF2 c\xE1i", category: "\u0110\u1ED9ng v\u1EADt", partOfSpeech: "noun", difficulty: 1 },
  { id: "mouse", answer: "mouse", meaning: "Con chu\u1ED9t nh\u1ECF", category: "\u0110\u1ED9ng v\u1EADt", partOfSpeech: "noun", difficulty: 2 },
  { id: "monkey", answer: "monkey", meaning: "Con kh\u1EC9", category: "\u0110\u1ED9ng v\u1EADt", partOfSpeech: "noun", difficulty: 2 },
  { id: "giraffe", answer: "giraffe", meaning: "H\u01B0\u01A1u cao c\u1ED5", category: "\u0110\u1ED9ng v\u1EADt", partOfSpeech: "noun", difficulty: 3 },
  { id: "dolphin", answer: "dolphin", meaning: "C\xE1 heo", category: "\u0110\u1ED9ng v\u1EADt", partOfSpeech: "noun", difficulty: 3 },
  { id: "penguin", answer: "penguin", meaning: "Chim c\xE1nh c\u1EE5t", category: "\u0110\u1ED9ng v\u1EADt", partOfSpeech: "noun", difficulty: 3 },
  { id: "kangaroo", answer: "kangaroo", meaning: "Chu\u1ED9t t\xFAi", category: "\u0110\u1ED9ng v\u1EADt", partOfSpeech: "noun", difficulty: 3 },
  { id: "crocodile", answer: "crocodile", meaning: "C\xE1 s\u1EA5u", category: "\u0110\u1ED9ng v\u1EADt", partOfSpeech: "noun", difficulty: 3 },
  { id: "butterfly", answer: "butterfly", meaning: "Con b\u01B0\u1EDBm", category: "\u0110\u1ED9ng v\u1EADt", partOfSpeech: "noun", difficulty: 2 },
  { id: "mosquito", answer: "mosquito", meaning: "Con mu\u1ED7i", category: "\u0110\u1ED9ng v\u1EADt", partOfSpeech: "noun", difficulty: 3 },
  { id: "squirrel", answer: "squirrel", meaning: "Con s\xF3c", category: "\u0110\u1ED9ng v\u1EADt", partOfSpeech: "noun", difficulty: 3 },
  { id: "octopus", answer: "octopus", meaning: "B\u1EA1ch tu\u1ED9c", category: "\u0110\u1ED9ng v\u1EADt", partOfSpeech: "noun", difficulty: 3 },
  { id: "turtle", answer: "turtle", meaning: "Con r\xF9a", category: "\u0110\u1ED9ng v\u1EADt", partOfSpeech: "noun", difficulty: 2 },
  { id: "spider", answer: "spider", meaning: "Con nh\u1EC7n", category: "\u0110\u1ED9ng v\u1EADt", partOfSpeech: "noun", difficulty: 2 },
  { id: "ant", answer: "ant", meaning: "Con ki\u1EBFn", category: "\u0110\u1ED9ng v\u1EADt", partOfSpeech: "noun", difficulty: 1 },
  { id: "bee", answer: "bee", meaning: "Con ong", category: "\u0110\u1ED9ng v\u1EADt", partOfSpeech: "noun", difficulty: 1 },
  { id: "grass", answer: "grass", meaning: "C\u1ECF", category: "Thi\xEAn nhi\xEAn", partOfSpeech: "noun", difficulty: 2 },
  { id: "tree", answer: "tree", meaning: "C\xE2y th\xE2n g\u1ED7", category: "Thi\xEAn nhi\xEAn", partOfSpeech: "noun", difficulty: 1 },
  { id: "leaf", answer: "leaf", meaning: "Chi\u1EBFc l\xE1", category: "Thi\xEAn nhi\xEAn", partOfSpeech: "noun", difficulty: 1 },
  { id: "branch", answer: "branch", meaning: "C\xE0nh c\xE2y", category: "Thi\xEAn nhi\xEAn", partOfSpeech: "noun", difficulty: 2 },
  { id: "beach", answer: "beach", meaning: "B\xE3i bi\u1EC3n", category: "Thi\xEAn nhi\xEAn", partOfSpeech: "noun", difficulty: 2 },
  { id: "island", answer: "island", meaning: "H\xF2n \u0111\u1EA3o", category: "Thi\xEAn nhi\xEAn", partOfSpeech: "noun", difficulty: 3 },
  { id: "desert", answer: "desert", meaning: "Sa m\u1EA1c", category: "Thi\xEAn nhi\xEAn", partOfSpeech: "noun", difficulty: 2 },
  { id: "waterfall", answer: "waterfall", meaning: "Th\xE1c n\u01B0\u1EDBc", category: "Thi\xEAn nhi\xEAn", partOfSpeech: "noun", difficulty: 2 },
  { id: "rainbow", answer: "rainbow", meaning: "C\u1EA7u v\u1ED3ng", category: "Thi\xEAn nhi\xEAn", partOfSpeech: "noun", difficulty: 2 },
  { id: "weather", answer: "weather", meaning: "Th\u1EDDi ti\u1EBFt", category: "Thi\xEAn nhi\xEAn", partOfSpeech: "noun", difficulty: 3 },
  // Rooms, furniture and useful objects.
  { id: "door", answer: "door", meaning: "C\xE1nh c\u1EEDa", category: "Nh\xE0 \u1EDF", partOfSpeech: "noun", difficulty: 1 },
  { id: "wall", answer: "wall", meaning: "B\u1EE9c t\u01B0\u1EDDng", category: "Nh\xE0 \u1EDF", partOfSpeech: "noun", difficulty: 1 },
  { id: "floor", answer: "floor", meaning: "S\xE0n nh\xE0", category: "Nh\xE0 \u1EDF", partOfSpeech: "noun", difficulty: 2 },
  { id: "ceiling", answer: "ceiling", meaning: "Tr\u1EA7n nh\xE0", category: "Nh\xE0 \u1EDF", partOfSpeech: "noun", difficulty: 3 },
  { id: "kitchen", answer: "kitchen", meaning: "Nh\xE0 b\u1EBFp", category: "Nh\xE0 \u1EDF", partOfSpeech: "noun", difficulty: 2 },
  { id: "bedroom", answer: "bedroom", meaning: "Ph\xF2ng ng\u1EE7", category: "Nh\xE0 \u1EDF", partOfSpeech: "noun", difficulty: 2 },
  { id: "bathroom", answer: "bathroom", meaning: "Ph\xF2ng t\u1EAFm", category: "Nh\xE0 \u1EDF", partOfSpeech: "noun", difficulty: 2 },
  { id: "shower", answer: "shower", meaning: "V\xF2i hoa sen", category: "\u0110\u1ED3 v\u1EADt", partOfSpeech: "noun", difficulty: 2 },
  { id: "towel", answer: "towel", meaning: "Kh\u0103n d\xF9ng \u0111\u1EC3 lau kh\xF4", category: "\u0110\u1ED3 v\u1EADt", partOfSpeech: "noun", difficulty: 2 },
  { id: "mirror", answer: "mirror", meaning: "C\xE1i g\u01B0\u01A1ng", category: "\u0110\u1ED3 v\u1EADt", partOfSpeech: "noun", difficulty: 2 },
  { id: "pillow", answer: "pillow", meaning: "C\xE1i g\u1ED1i", category: "\u0110\u1ED3 v\u1EADt", partOfSpeech: "noun", difficulty: 2 },
  { id: "curtain", answer: "curtain", meaning: "R\xE8m c\u1EEDa", category: "\u0110\u1ED3 v\u1EADt", partOfSpeech: "noun", difficulty: 3 },
  { id: "carpet", answer: "carpet", meaning: "Th\u1EA3m tr\u1EA3i s\xE0n", category: "\u0110\u1ED3 v\u1EADt", partOfSpeech: "noun", difficulty: 2 },
  { id: "wardrobe", answer: "wardrobe", meaning: "T\u1EE7 qu\u1EA7n \xE1o", category: "\u0110\u1ED3 v\u1EADt", partOfSpeech: "noun", difficulty: 3 },
  { id: "cupboard", answer: "cupboard", meaning: "T\u1EE7 \u0111\u1EF1ng b\xE1t \u0111\u0129a", category: "\u0110\u1ED3 v\u1EADt", partOfSpeech: "noun", difficulty: 3 },
  { id: "refrigerator", answer: "refrigerator", meaning: "T\u1EE7 l\u1EA1nh", category: "Thi\u1EBFt b\u1ECB", partOfSpeech: "noun", difficulty: 3 },
  { id: "microwave", answer: "microwave", meaning: "L\xF2 vi s\xF3ng", category: "Thi\u1EBFt b\u1ECB", partOfSpeech: "noun", difficulty: 3 },
  { id: "telephone", answer: "telephone", meaning: "\u0110i\u1EC7n tho\u1EA1i", category: "Thi\u1EBFt b\u1ECB", partOfSpeech: "noun", difficulty: 2 },
  { id: "computer", answer: "computer", meaning: "M\xE1y t\xEDnh", category: "Thi\u1EBFt b\u1ECB", partOfSpeech: "noun", difficulty: 2 },
  { id: "keyboard", answer: "keyboard", meaning: "B\xE0n ph\xEDm m\xE1y t\xEDnh", category: "Thi\u1EBFt b\u1ECB", partOfSpeech: "noun", difficulty: 2 },
  { id: "television", answer: "television", meaning: "Ti vi", category: "Thi\u1EBFt b\u1ECB", partOfSpeech: "noun", difficulty: 3 },
  { id: "headphones", answer: "headphones", meaning: "Tai nghe", category: "Thi\u1EBFt b\u1ECB", partOfSpeech: "noun", difficulty: 3 },
  { id: "backpack", answer: "backpack", meaning: "Ba l\xF4", category: "\u0110\u1ED3 v\u1EADt", partOfSpeech: "noun", difficulty: 2 },
  { id: "umbrella", answer: "umbrella", meaning: "C\xE1i \xF4 che m\u01B0a", category: "\u0110\u1ED3 v\u1EADt", partOfSpeech: "noun", difficulty: 3 },
  { id: "notebook", answer: "notebook", meaning: "Quy\u1EC3n v\u1EDF", category: "\u0110\u1ED3 v\u1EADt", partOfSpeech: "noun", difficulty: 2 },
  { id: "scissors", answer: "scissors", meaning: "C\xE1i k\xE9o", category: "\u0110\u1ED3 v\u1EADt", partOfSpeech: "noun", difficulty: 3 },
  { id: "toothbrush", answer: "toothbrush", meaning: "B\xE0n ch\u1EA3i \u0111\xE1nh r\u0103ng", category: "\u0110\u1ED3 v\u1EADt", partOfSpeech: "noun", difficulty: 3 },
  { id: "toothpaste", answer: "toothpaste", meaning: "Kem \u0111\xE1nh r\u0103ng", category: "\u0110\u1ED3 v\u1EADt", partOfSpeech: "noun", difficulty: 3 },
  { id: "calendar", answer: "calendar", meaning: "T\u1EDD l\u1ECBch", category: "\u0110\u1ED3 v\u1EADt", partOfSpeech: "noun", difficulty: 3 },
  { id: "envelope", answer: "envelope", meaning: "Phong b\xEC", category: "\u0110\u1ED3 v\u1EADt", partOfSpeech: "noun", difficulty: 3 },
  // People and places.
  { id: "mother", answer: "mother", meaning: "M\u1EB9", category: "Gia \u0111\xECnh", partOfSpeech: "noun", difficulty: 1 },
  { id: "father", answer: "father", meaning: "B\u1ED1", category: "Gia \u0111\xECnh", partOfSpeech: "noun", difficulty: 1 },
  { id: "sister", answer: "sister", meaning: "Ch\u1ECB ho\u1EB7c em g\xE1i", category: "Gia \u0111\xECnh", partOfSpeech: "noun", difficulty: 1 },
  { id: "brother", answer: "brother", meaning: "Anh ho\u1EB7c em trai", category: "Gia \u0111\xECnh", partOfSpeech: "noun", difficulty: 2 },
  { id: "teacher", answer: "teacher", meaning: "Gi\xE1o vi\xEAn", category: "Ngh\u1EC1 nghi\u1EC7p", partOfSpeech: "noun", difficulty: 2 },
  { id: "student", answer: "student", meaning: "H\u1ECDc sinh ho\u1EB7c sinh vi\xEAn", category: "Con ng\u01B0\u1EDDi", partOfSpeech: "noun", difficulty: 2 },
  { id: "farmer", answer: "farmer", meaning: "N\xF4ng d\xE2n", category: "Ngh\u1EC1 nghi\u1EC7p", partOfSpeech: "noun", difficulty: 2 },
  { id: "driver", answer: "driver", meaning: "Ng\u01B0\u1EDDi l\xE1i xe", category: "Ngh\u1EC1 nghi\u1EC7p", partOfSpeech: "noun", difficulty: 2 },
  { id: "engineer", answer: "engineer", meaning: "K\u1EF9 s\u01B0", category: "Ngh\u1EC1 nghi\u1EC7p", partOfSpeech: "noun", difficulty: 3 },
  { id: "firefighter", answer: "firefighter", meaning: "L\xEDnh c\u1EE9u h\u1ECFa", category: "Ngh\u1EC1 nghi\u1EC7p", partOfSpeech: "noun", difficulty: 3 },
  { id: "dentist", answer: "dentist", meaning: "Nha s\u0129", category: "Ngh\u1EC1 nghi\u1EC7p", partOfSpeech: "noun", difficulty: 2 },
  { id: "nurse", answer: "nurse", meaning: "\u0110i\u1EC1u d\u01B0\u1EE1ng vi\xEAn", category: "Ngh\u1EC1 nghi\u1EC7p", partOfSpeech: "noun", difficulty: 2 },
  { id: "neighbor", answer: "neighbor", meaning: "Ng\u01B0\u1EDDi h\xE0ng x\xF3m", category: "Con ng\u01B0\u1EDDi", partOfSpeech: "noun", difficulty: 3 },
  { id: "customer", answer: "customer", meaning: "Kh\xE1ch mua h\xE0ng", category: "Con ng\u01B0\u1EDDi", partOfSpeech: "noun", difficulty: 2 },
  { id: "manager", answer: "manager", meaning: "Ng\u01B0\u1EDDi qu\u1EA3n l\xFD", category: "Ngh\u1EC1 nghi\u1EC7p", partOfSpeech: "noun", difficulty: 2 },
  { id: "children", answer: "children", meaning: "Nh\u1EEFng \u0111\u1EE9a tr\u1EBB", category: "Con ng\u01B0\u1EDDi", partOfSpeech: "noun", difficulty: 3 },
  { id: "airport", answer: "airport", meaning: "S\xE2n bay", category: "\u0110\u1ECBa \u0111i\u1EC3m", partOfSpeech: "noun", difficulty: 2 },
  { id: "station", answer: "station", meaning: "Nh\xE0 ga xe l\u1EEDa", category: "\u0110\u1ECBa \u0111i\u1EC3m", partOfSpeech: "noun", difficulty: 2 },
  { id: "hospital", answer: "hospital", meaning: "B\u1EC7nh vi\u1EC7n", category: "\u0110\u1ECBa \u0111i\u1EC3m", partOfSpeech: "noun", difficulty: 2 },
  { id: "restaurant", answer: "restaurant", meaning: "Nh\xE0 h\xE0ng", category: "\u0110\u1ECBa \u0111i\u1EC3m", partOfSpeech: "noun", difficulty: 3 },
  { id: "supermarket", answer: "supermarket", meaning: "Si\xEAu th\u1ECB", category: "\u0110\u1ECBa \u0111i\u1EC3m", partOfSpeech: "noun", difficulty: 3 },
  { id: "playground", answer: "playground", meaning: "S\xE2n ch\u01A1i", category: "\u0110\u1ECBa \u0111i\u1EC3m", partOfSpeech: "noun", difficulty: 2 },
  { id: "classroom", answer: "classroom", meaning: "Ph\xF2ng h\u1ECDc", category: "\u0110\u1ECBa \u0111i\u1EC3m", partOfSpeech: "noun", difficulty: 2 },
  { id: "building", answer: "building", meaning: "T\xF2a nh\xE0", category: "Nh\xE0 \u1EDF", partOfSpeech: "noun", difficulty: 2 },
  { id: "apartment", answer: "apartment", meaning: "C\u0103n h\u1ED9", category: "Nh\xE0 \u1EDF", partOfSpeech: "noun", difficulty: 3 },
  { id: "factory", answer: "factory", meaning: "Nh\xE0 m\xE1y", category: "\u0110\u1ECBa \u0111i\u1EC3m", partOfSpeech: "noun", difficulty: 2 },
  { id: "museum", answer: "museum", meaning: "B\u1EA3o t\xE0ng", category: "\u0110\u1ECBa \u0111i\u1EC3m", partOfSpeech: "noun", difficulty: 3 },
  { id: "market", answer: "market", meaning: "Khu ch\u1EE3", category: "\u0110\u1ECBa \u0111i\u1EC3m", partOfSpeech: "noun", difficulty: 2 },
  { id: "office", answer: "office", meaning: "V\u0103n ph\xF2ng", category: "\u0110\u1ECBa \u0111i\u1EC3m", partOfSpeech: "noun", difficulty: 2 },
  { id: "street", answer: "street", meaning: "\u0110\u01B0\u1EDDng ph\u1ED1", category: "\u0110\u1ECBa \u0111i\u1EC3m", partOfSpeech: "noun", difficulty: 2 },
  // Everyday actions; each gloss identifies the intended verb sense.
  { id: "read", answer: "read", meaning: "\u0110\u1ECDc ch\u1EEF", category: "Ho\u1EA1t \u0111\u1ED9ng", partOfSpeech: "verb", difficulty: 1 },
  { id: "speak", answer: "speak", meaning: "N\xF3i th\xE0nh l\u1EDDi", category: "Giao ti\u1EBFp", partOfSpeech: "verb", difficulty: 2 },
  { id: "drink", answer: "drink", meaning: "U\u1ED1ng", category: "Ho\u1EA1t \u0111\u1ED9ng", partOfSpeech: "verb", difficulty: 2 },
  { id: "cook", answer: "cook", meaning: "N\u1EA5u \u0103n", category: "Ho\u1EA1t \u0111\u1ED9ng", partOfSpeech: "verb", difficulty: 1 },
  { id: "clean", answer: "clean", meaning: "Lau d\u1ECDn cho s\u1EA1ch", category: "Ho\u1EA1t \u0111\u1ED9ng", partOfSpeech: "verb", difficulty: 2 },
  { id: "open", answer: "open", meaning: "M\u1EDF ra", category: "Ho\u1EA1t \u0111\u1ED9ng", partOfSpeech: "verb", difficulty: 1 },
  { id: "close", answer: "close", meaning: "\u0110\xF3ng l\u1EA1i", category: "Ho\u1EA1t \u0111\u1ED9ng", partOfSpeech: "verb", difficulty: 2 },
  { id: "watch", answer: "watch", meaning: "Xem v\xE0 ch\xFA \xFD theo d\xF5i", category: "Ho\u1EA1t \u0111\u1ED9ng", partOfSpeech: "verb", difficulty: 2 },
  { id: "paint", answer: "paint", meaning: "V\u1EBD b\u1EB1ng m\xE0u ho\u1EB7c s\u01A1n", category: "S\xE1ng t\u1EA1o", partOfSpeech: "verb", difficulty: 2 },
  { id: "draw", answer: "draw", meaning: "V\u1EBD b\u1EB1ng n\xE9t b\xFAt", category: "S\xE1ng t\u1EA1o", partOfSpeech: "verb", difficulty: 2 },
  { id: "swim", answer: "swim", meaning: "B\u01A1i", category: "V\u1EADn \u0111\u1ED9ng", partOfSpeech: "verb", difficulty: 1 },
  { id: "climb", answer: "climb", meaning: "Leo tr\xE8o", category: "V\u1EADn \u0111\u1ED9ng", partOfSpeech: "verb", difficulty: 3 },
  { id: "carry", answer: "carry", meaning: "Mang ho\u1EB7c x\xE1ch theo", category: "Ho\u1EA1t \u0111\u1ED9ng", partOfSpeech: "verb", difficulty: 2 },
  { id: "choose", answer: "choose", meaning: "L\u1EF1a ch\u1ECDn", category: "Ho\u1EA1t \u0111\u1ED9ng", partOfSpeech: "verb", difficulty: 3 },
  { id: "answer", answer: "answer", meaning: "Tr\u1EA3 l\u1EDDi c\xE2u h\u1ECFi", category: "Giao ti\u1EBFp", partOfSpeech: "verb", difficulty: 3 },
  { id: "explain", answer: "explain", meaning: "Gi\u1EA3i th\xEDch", category: "Giao ti\u1EBFp", partOfSpeech: "verb", difficulty: 2 },
  { id: "remember", answer: "remember", meaning: "Nh\u1EDB m\u1ED9t \u0111i\u1EC1u \u0111\xE3 bi\u1EBFt", category: "H\u1ECDc t\u1EADp", partOfSpeech: "verb", difficulty: 2 },
  { id: "forget", answer: "forget", meaning: "Qu\xEAn", category: "H\u1ECDc t\u1EADp", partOfSpeech: "verb", difficulty: 2 },
  { id: "practice", answer: "practice", meaning: "Luy\u1EC7n t\u1EADp \u0111\u1EC3 th\xE0nh th\u1EA1o", category: "H\u1ECDc t\u1EADp", partOfSpeech: "verb", difficulty: 3 },
  { id: "prepare", answer: "prepare", meaning: "Chu\u1EA9n b\u1ECB", category: "Ho\u1EA1t \u0111\u1ED9ng", partOfSpeech: "verb", difficulty: 2 },
  { id: "collect", answer: "collect", meaning: "Thu th\u1EADp", category: "Ho\u1EA1t \u0111\u1ED9ng", partOfSpeech: "verb", difficulty: 2 },
  { id: "protect", answer: "protect", meaning: "B\u1EA3o v\u1EC7 kh\u1ECFi nguy hi\u1EC3m", category: "Ho\u1EA1t \u0111\u1ED9ng", partOfSpeech: "verb", difficulty: 2 },
  { id: "discover", answer: "discover", meaning: "Kh\xE1m ph\xE1 \u0111i\u1EC1u ch\u01B0a bi\u1EBFt", category: "H\u1ECDc t\u1EADp", partOfSpeech: "verb", difficulty: 3 },
  { id: "improve", answer: "improve", meaning: "C\u1EA3i thi\u1EC7n", category: "Ho\u1EA1t \u0111\u1ED9ng", partOfSpeech: "verb", difficulty: 2 },
  { id: "compare", answer: "compare", meaning: "So s\xE1nh", category: "H\u1ECDc t\u1EADp", partOfSpeech: "verb", difficulty: 2 },
  { id: "describe", answer: "describe", meaning: "Mi\xEAu t\u1EA3 b\u1EB1ng l\u1EDDi", category: "Giao ti\u1EBFp", partOfSpeech: "verb", difficulty: 3 },
  { id: "continue", answer: "continue", meaning: "Ti\u1EBFp t\u1EE5c", category: "Ho\u1EA1t \u0111\u1ED9ng", partOfSpeech: "verb", difficulty: 3 },
  { id: "understand", answer: "understand", meaning: "Hi\u1EC3u", category: "H\u1ECDc t\u1EADp", partOfSpeech: "verb", difficulty: 3 },
  { id: "celebrate", answer: "celebrate", meaning: "\u0102n m\u1EEBng m\u1ED9t d\u1ECBp vui", category: "Ho\u1EA1t \u0111\u1ED9ng", partOfSpeech: "verb", difficulty: 3 },
  { id: "exercise", answer: "exercise", meaning: "T\u1EADp th\u1EC3 d\u1EE5c", category: "V\u1EADn \u0111\u1ED9ng", partOfSpeech: "verb", difficulty: 3 },
  // Descriptions, feelings and qualities.
  { id: "small", answer: "small", meaning: "Nh\u1ECF v\u1EC1 k\xEDch th\u01B0\u1EDBc", category: "T\xEDnh t\u1EEB", partOfSpeech: "adjective", difficulty: 1 },
  { id: "large", answer: "large", meaning: "L\u1EDBn v\u1EC1 k\xEDch th\u01B0\u1EDBc", category: "T\xEDnh t\u1EEB", partOfSpeech: "adjective", difficulty: 2 },
  { id: "short", answer: "short", meaning: "Ng\u1EAFn v\u1EC1 chi\u1EC1u d\xE0i", category: "T\xEDnh t\u1EEB", partOfSpeech: "adjective", difficulty: 2 },
  { id: "tall", answer: "tall", meaning: "Cao v\u1EC1 v\xF3c d\xE1ng", category: "T\xEDnh t\u1EEB", partOfSpeech: "adjective", difficulty: 1 },
  { id: "young", answer: "young", meaning: "Tr\u1EBB tu\u1ED5i", category: "T\xEDnh t\u1EEB", partOfSpeech: "adjective", difficulty: 2 },
  { id: "old", answer: "old", meaning: "Gi\xE0, nhi\u1EC1u tu\u1ED5i", category: "T\xEDnh t\u1EEB", partOfSpeech: "adjective", difficulty: 1 },
  { id: "new", answer: "new", meaning: "M\u1EDBi, ch\u01B0a qua s\u1EED d\u1EE5ng", category: "T\xEDnh t\u1EEB", partOfSpeech: "adjective", difficulty: 1 },
  { id: "warm", answer: "warm", meaning: "\u1EA4m", category: "Nhi\u1EC7t \u0111\u1ED9", partOfSpeech: "adjective", difficulty: 1 },
  { id: "cold", answer: "cold", meaning: "L\u1EA1nh", category: "Nhi\u1EC7t \u0111\u1ED9", partOfSpeech: "adjective", difficulty: 1 },
  { id: "hot", answer: "hot", meaning: "N\xF3ng v\u1EC1 nhi\u1EC7t \u0111\u1ED9", category: "Nhi\u1EC7t \u0111\u1ED9", partOfSpeech: "adjective", difficulty: 1 },
  { id: "fast", answer: "fast", meaning: "Nhanh v\u1EC1 t\u1ED1c \u0111\u1ED9", category: "T\xEDnh t\u1EEB", partOfSpeech: "adjective", difficulty: 1 },
  { id: "slow", answer: "slow", meaning: "Ch\u1EADm v\u1EC1 t\u1ED1c \u0111\u1ED9", category: "T\xEDnh t\u1EEB", partOfSpeech: "adjective", difficulty: 1 },
  { id: "easy", answer: "easy", meaning: "D\u1EC5 l\xE0m", category: "T\xEDnh t\u1EEB", partOfSpeech: "adjective", difficulty: 1 },
  { id: "difficult", answer: "difficult", meaning: "Kh\xF3 th\u1EF1c hi\u1EC7n", category: "T\xEDnh t\u1EEB", partOfSpeech: "adjective", difficulty: 3 },
  { id: "beautiful", answer: "beautiful", meaning: "\u0110\u1EB9p", category: "T\xEDnh t\u1EEB", partOfSpeech: "adjective", difficulty: 3 },
  { id: "comfortable", answer: "comfortable", meaning: "Tho\u1EA3i m\xE1i, d\u1EC5 ch\u1ECBu", category: "T\xEDnh t\u1EEB", partOfSpeech: "adjective", difficulty: 3 },
  { id: "dangerous", answer: "dangerous", meaning: "Nguy hi\u1EC3m", category: "T\xEDnh t\u1EEB", partOfSpeech: "adjective", difficulty: 3 },
  { id: "friendly", answer: "friendly", meaning: "Th\xE2n thi\u1EC7n", category: "T\xEDnh t\u1EEB", partOfSpeech: "adjective", difficulty: 2 },
  { id: "healthy", answer: "healthy", meaning: "Kh\u1ECFe m\u1EA1nh", category: "T\xEDnh t\u1EEB", partOfSpeech: "adjective", difficulty: 3 },
  { id: "helpful", answer: "helpful", meaning: "S\u1EB5n l\xF2ng gi\xFAp \u0111\u1EE1", category: "T\xEDnh t\u1EEB", partOfSpeech: "adjective", difficulty: 2 },
  { id: "important", answer: "important", meaning: "Quan tr\u1ECDng", category: "T\xEDnh t\u1EEB", partOfSpeech: "adjective", difficulty: 3 },
  { id: "interesting", answer: "interesting", meaning: "Th\xFA v\u1ECB, g\xE2y h\u1EE9ng th\xFA", category: "T\xEDnh t\u1EEB", partOfSpeech: "adjective", difficulty: 3 },
  { id: "expensive", answer: "expensive", meaning: "\u0110\u1EAFt ti\u1EC1n", category: "T\xEDnh t\u1EEB", partOfSpeech: "adjective", difficulty: 3 },
  { id: "delicious", answer: "delicious", meaning: "Ngon khi \u0103n", category: "T\xEDnh t\u1EEB", partOfSpeech: "adjective", difficulty: 3 },
  { id: "thirsty", answer: "thirsty", meaning: "Kh\xE1t n\u01B0\u1EDBc", category: "T\xEDnh t\u1EEB", partOfSpeech: "adjective", difficulty: 3 },
  { id: "excited", answer: "excited", meaning: "H\xE0o h\u1EE9ng", category: "C\u1EA3m x\xFAc", partOfSpeech: "adjective", difficulty: 3 },
  { id: "surprised", answer: "surprised", meaning: "Ng\u1EA1c nhi\xEAn", category: "C\u1EA3m x\xFAc", partOfSpeech: "adjective", difficulty: 3 },
  { id: "patient", answer: "patient", meaning: "Ki\xEAn nh\u1EABn", category: "T\xEDnh t\u1EEB", partOfSpeech: "adjective", difficulty: 3 },
  { id: "honest", answer: "honest", meaning: "Trung th\u1EF1c", category: "T\xEDnh t\u1EEB", partOfSpeech: "adjective", difficulty: 3 },
  { id: "polite", answer: "polite", meaning: "L\u1ECBch s\u1EF1", category: "T\xEDnh t\u1EEB", partOfSpeech: "adjective", difficulty: 2 }
];

// src/game/vocabulary.ts
var WORDS = [
  { id: "apple", answer: "apple", meaning: "Qu\u1EA3 t\xE1o", category: "Th\u1EE9c \u0103n", partOfSpeech: "noun", difficulty: 1 },
  { id: "bread", answer: "bread", meaning: "B\xE1nh m\xEC", category: "Th\u1EE9c \u0103n", partOfSpeech: "noun", difficulty: 2 },
  { id: "water", answer: "water", meaning: "N\u01B0\u1EDBc u\u1ED1ng", category: "Th\u1EE9c \u0103n", partOfSpeech: "noun", difficulty: 1 },
  { id: "milk", answer: "milk", meaning: "S\u1EEFa", category: "Th\u1EE9c \u0103n", partOfSpeech: "noun", difficulty: 1 },
  { id: "rice", answer: "rice", meaning: "G\u1EA1o / c\u01A1m", category: "Th\u1EE9c \u0103n", partOfSpeech: "noun", difficulty: 1 },
  { id: "lemon", answer: "lemon", meaning: "Qu\u1EA3 chanh v\xE0ng", category: "Th\u1EE9c \u0103n", partOfSpeech: "noun", difficulty: 2 },
  { id: "carrot", answer: "carrot", meaning: "C\u1EE7 c\xE0 r\u1ED1t", category: "Th\u1EE9c \u0103n", partOfSpeech: "noun", difficulty: 2 },
  { id: "orange", answer: "orange", meaning: "Qu\u1EA3 cam", category: "Th\u1EE9c \u0103n", partOfSpeech: "noun", difficulty: 2 },
  { id: "cat", answer: "cat", meaning: "Con m\xE8o", category: "\u0110\u1ED9ng v\u1EADt", partOfSpeech: "noun", difficulty: 1 },
  { id: "dog", answer: "dog", meaning: "Con ch\xF3", category: "\u0110\u1ED9ng v\u1EADt", partOfSpeech: "noun", difficulty: 1 },
  { id: "bird", answer: "bird", meaning: "Con chim", category: "\u0110\u1ED9ng v\u1EADt", partOfSpeech: "noun", difficulty: 1 },
  { id: "fish", answer: "fish", meaning: "Con c\xE1", category: "\u0110\u1ED9ng v\u1EADt", partOfSpeech: "noun", difficulty: 1 },
  { id: "tiger", answer: "tiger", meaning: "Con h\u1ED5", category: "\u0110\u1ED9ng v\u1EADt", partOfSpeech: "noun", difficulty: 2 },
  { id: "rabbit", answer: "rabbit", meaning: "Con th\u1ECF", category: "\u0110\u1ED9ng v\u1EADt", partOfSpeech: "noun", difficulty: 2 },
  { id: "horse", answer: "horse", meaning: "Con ng\u1EF1a", category: "\u0110\u1ED9ng v\u1EADt", partOfSpeech: "noun", difficulty: 2 },
  { id: "elephant", answer: "elephant", meaning: "Con voi", category: "\u0110\u1ED9ng v\u1EADt", partOfSpeech: "noun", difficulty: 3 },
  { id: "sun", answer: "sun", meaning: "M\u1EB7t tr\u1EDDi", category: "Thi\xEAn nhi\xEAn", partOfSpeech: "noun", difficulty: 1 },
  { id: "moon", answer: "moon", meaning: "M\u1EB7t tr\u0103ng", category: "Thi\xEAn nhi\xEAn", partOfSpeech: "noun", difficulty: 1 },
  { id: "star", answer: "star", meaning: "Ng\xF4i sao", category: "Thi\xEAn nhi\xEAn", partOfSpeech: "noun", difficulty: 1 },
  { id: "rain", answer: "rain", meaning: "M\u01B0a", category: "Thi\xEAn nhi\xEAn", partOfSpeech: "noun", difficulty: 1 },
  { id: "cloud", answer: "cloud", meaning: "\u0110\xE1m m\xE2y", category: "Thi\xEAn nhi\xEAn", partOfSpeech: "noun", difficulty: 2 },
  { id: "river", answer: "river", meaning: "D\xF2ng s\xF4ng", category: "Thi\xEAn nhi\xEAn", partOfSpeech: "noun", difficulty: 2 },
  { id: "forest", answer: "forest", meaning: "Khu r\u1EEBng", category: "Thi\xEAn nhi\xEAn", partOfSpeech: "noun", difficulty: 2 },
  { id: "flower", answer: "flower", meaning: "B\xF4ng hoa", category: "Thi\xEAn nhi\xEAn", partOfSpeech: "noun", difficulty: 2 },
  { id: "book", answer: "book", meaning: "Quy\u1EC3n s\xE1ch", category: "\u0110\u1ED3 v\u1EADt", partOfSpeech: "noun", difficulty: 1 },
  { id: "chair", answer: "chair", meaning: "C\xE1i gh\u1EBF", category: "\u0110\u1ED3 v\u1EADt", partOfSpeech: "noun", difficulty: 2 },
  { id: "table", answer: "table", meaning: "C\xE1i b\xE0n", category: "\u0110\u1ED3 v\u1EADt", partOfSpeech: "noun", difficulty: 1 },
  { id: "window", answer: "window", meaning: "C\u1EEDa s\u1ED5", category: "\u0110\u1ED3 v\u1EADt", partOfSpeech: "noun", difficulty: 2 },
  { id: "pencil", answer: "pencil", meaning: "B\xFAt ch\xEC", category: "\u0110\u1ED3 v\u1EADt", partOfSpeech: "noun", difficulty: 2 },
  { id: "school", answer: "school", meaning: "Tr\u01B0\u1EDDng h\u1ECDc", category: "\u0110\u1ECBa \u0111i\u1EC3m", partOfSpeech: "noun", difficulty: 2 },
  { id: "garden", answer: "garden", meaning: "Khu v\u01B0\u1EDDn", category: "\u0110\u1ECBa \u0111i\u1EC3m", partOfSpeech: "noun", difficulty: 2 },
  { id: "bridge", answer: "bridge", meaning: "C\xE2y c\u1EA7u", category: "\u0110\u1ECBa \u0111i\u1EC3m", partOfSpeech: "noun", difficulty: 3 },
  { id: "happy", answer: "happy", meaning: "Vui v\u1EBB", category: "T\xEDnh t\u1EEB", partOfSpeech: "adjective", difficulty: 1 },
  { id: "hungry", answer: "hungry", meaning: "\u0110\xF3i b\u1EE5ng", category: "T\xEDnh t\u1EEB", partOfSpeech: "adjective", difficulty: 2 },
  { id: "quiet", answer: "quiet", meaning: "Y\xEAn t\u0129nh", category: "T\xEDnh t\u1EEB", partOfSpeech: "adjective", difficulty: 3 },
  { id: "brave", answer: "brave", meaning: "D\u0169ng c\u1EA3m", category: "T\xEDnh t\u1EEB", partOfSpeech: "adjective", difficulty: 2 },
  { id: "yellow", answer: "yellow", meaning: "M\xE0u v\xE0ng", category: "M\xE0u s\u1EAFc", partOfSpeech: "adjective", difficulty: 2 },
  { id: "purple", answer: "purple", meaning: "M\xE0u t\xEDm", category: "M\xE0u s\u1EAFc", partOfSpeech: "adjective", difficulty: 3 },
  { id: "green", answer: "green", meaning: "M\xE0u xanh l\xE1", category: "M\xE0u s\u1EAFc", partOfSpeech: "adjective", difficulty: 1 },
  { id: "walk", answer: "walk", meaning: "\u0110i b\u1ED9", category: "\u0110\u1ED9ng t\u1EEB", partOfSpeech: "verb", difficulty: 1 },
  { id: "sleep", answer: "sleep", meaning: "Ng\u1EE7", category: "\u0110\u1ED9ng t\u1EEB", partOfSpeech: "verb", difficulty: 1 },
  { id: "listen", answer: "listen", meaning: "L\u1EAFng nghe", category: "\u0110\u1ED9ng t\u1EEB", partOfSpeech: "verb", difficulty: 3 },
  { id: "learn", answer: "learn", meaning: "H\u1ECDc", category: "\u0110\u1ED9ng t\u1EEB", partOfSpeech: "verb", difficulty: 2 },
  { id: "write", answer: "write", meaning: "Vi\u1EBFt", category: "\u0110\u1ED9ng t\u1EEB", partOfSpeech: "verb", difficulty: 3 },
  { id: "smile", answer: "smile", meaning: "M\u1EC9m c\u01B0\u1EDDi", category: "\u0110\u1ED9ng t\u1EEB", partOfSpeech: "verb", difficulty: 2 },
  { id: "friend", answer: "friend", meaning: "Ng\u01B0\u1EDDi b\u1EA1n", category: "Con ng\u01B0\u1EDDi", partOfSpeech: "noun", difficulty: 2 },
  { id: "family", answer: "family", meaning: "Gia \u0111\xECnh", category: "Con ng\u01B0\u1EDDi", partOfSpeech: "noun", difficulty: 2 },
  { id: "doctor", answer: "doctor", meaning: "B\xE1c s\u0129", category: "Con ng\u01B0\u1EDDi", partOfSpeech: "noun", difficulty: 2 },
  { id: "lantern", answer: "lantern", meaning: "\u0110\xE8n l\u1ED3ng", category: "\u0110\u1ED3 v\u1EADt", partOfSpeech: "noun", difficulty: 2 },
  { id: "blanket", answer: "blanket", meaning: "C\xE1i ch\u0103n", category: "\u0110\u1ED3 v\u1EADt", partOfSpeech: "noun", difficulty: 2 },
  { id: "village", answer: "village", meaning: "Ng\xF4i l\xE0ng", category: "\u0110\u1ECBa \u0111i\u1EC3m", partOfSpeech: "noun", difficulty: 2 },
  { id: "pumpkin", answer: "pumpkin", meaning: "Qu\u1EA3 b\xED ng\xF4", category: "Th\u1EE9c \u0103n", partOfSpeech: "noun", difficulty: 2 },
  { id: "thunder", answer: "thunder", meaning: "Ti\u1EBFng s\u1EA5m", category: "Thi\xEAn nhi\xEAn", partOfSpeech: "noun", difficulty: 3 },
  { id: "chicken", answer: "chicken", meaning: "Con g\xE0", category: "\u0110\u1ED9ng v\u1EADt", partOfSpeech: "noun", difficulty: 2 },
  { id: "morning", answer: "morning", meaning: "Bu\u1ED5i s\xE1ng", category: "Th\u1EDDi gian", partOfSpeech: "noun", difficulty: 2 },
  { id: "mountain", answer: "mountain", meaning: "Ng\u1ECDn n\xFAi", category: "Thi\xEAn nhi\xEAn", partOfSpeech: "noun", difficulty: 2 },
  { id: "library", answer: "library", meaning: "Th\u01B0 vi\u1EC7n", category: "\u0110\u1ECBa \u0111i\u1EC3m", partOfSpeech: "noun", difficulty: 2 },
  { id: "journey", answer: "journey", meaning: "Chuy\u1EBFn h\xE0nh tr\xECnh", category: "Di chuy\u1EC3n", partOfSpeech: "noun", difficulty: 3 },
  { id: "curious", answer: "curious", meaning: "T\xF2 m\xF2", category: "T\xEDnh t\u1EEB", partOfSpeech: "adjective", difficulty: 3 },
  { id: "careful", answer: "careful", meaning: "C\u1EA9n th\u1EADn", category: "T\xEDnh t\u1EEB", partOfSpeech: "adjective", difficulty: 2 },
  ...ADDITIONAL_WORDS
];
function lootChanceFor(word) {
  return { 1: 0.15, 2: 0.3, 3: 0.45 }[word.difficulty];
}
function answersFor(word) {
  return [...new Set([word.answer, ...word.alternatives ?? []].map((value) => value.toLowerCase()))];
}
function historyKeysFor(word) {
  return [...new Set([...answersFor(word), ...word.historyAliases ?? []].map((value) => value.trim().toLowerCase()))];
}
function createChallenge(word, kind, id, rng = Math.random) {
  const letters = [...word.answer];
  const hint = word.translationHint ?? letters.map((letter, index) => index === 0 || index === letters.length - 1 ? letter : "_").join(" ");
  let prompt = word.meaning;
  if (kind === "scramble") {
    for (let index = letters.length - 1; index > 0; index--) {
      const other = Math.floor(Math.max(0, Math.min(0.999999, rng())) * (index + 1));
      [letters[index], letters[other]] = [letters[other], letters[index]];
    }
    if (letters.join("") === word.answer && new Set(letters).size > 1) {
      const other = letters.findIndex((letter) => letter !== letters[0]);
      [letters[0], letters[other]] = [letters[other], letters[0]];
    }
    prompt = letters.join(" / ");
  } else if (kind === "missing") {
    const distinguishing = word.translationHint?.split(" ");
    prompt = letters.map((letter, index) => index % 2 === 1 && distinguishing?.[index] !== letter ? "_" : letter).join(" ");
  }
  return { id, word, kind, prompt, hint, credited: /* @__PURE__ */ new Set(), mistakes: 0, assisted: false };
}

// src/game/worldLayout.ts
var WORLD_WIDTH = 6400;
var VIEW_WIDTH = 1280;
var cameraTarget = (playerX) => Math.max(0, Math.min(WORLD_WIDTH - VIEW_WIDTH, playerX - VIEW_WIDTH / 2));

// src/game/learningProgression.ts
var MAX_LEARNING_LEVEL = 10;
var WORDS_PER_LEARNING_LEVEL = 20;
function getWordLearningLevel(word) {
  if (Number.isInteger(word.learningLevel) && word.learningLevel >= 1 && word.learningLevel <= MAX_LEARNING_LEVEL) return word.learningLevel;
  return { 1: 1, 2: 4, 3: 7 }[word.difficulty];
}
function getLearningProgress(completedWords) {
  const completed = Number.isFinite(completedWords) ? Math.max(0, Math.floor(completedWords)) : 0;
  const level = Math.min(MAX_LEARNING_LEVEL, 1 + Math.floor(completed / WORDS_PER_LEARNING_LEVEL));
  return {
    level,
    progress: level === MAX_LEARNING_LEVEL ? WORDS_PER_LEARNING_LEVEL : completed % WORDS_PER_LEARNING_LEVEL,
    step: WORDS_PER_LEARNING_LEVEL,
    nextLevelAt: level === MAX_LEARNING_LEVEL ? null : level * WORDS_PER_LEARNING_LEVEL
  };
}
function learningLevelOrder(level) {
  return [
    level,
    ...Array.from({ length: level - 1 }, (_, index) => level - 1 - index),
    ...Array.from({ length: MAX_LEARNING_LEVEL - level }, (_, index) => level + 1 + index)
  ];
}

// src/game/wordDeck.ts
var WordDeck = class {
  constructor(bank, random = Math.random) {
    this.random = random;
    this.entries = bank.map((word, index) => {
      const aliases = historyKeysFor(word);
      this.byWord.set(word, index);
      for (const alias of aliases) {
        const ids = this.byAlias.get(alias);
        if (ids) ids.push(index);
        else this.byAlias.set(alias, [index]);
      }
      return {
        word,
        aliases,
        long: word.answer.length >= 7,
        seen: false,
        blocked: 0,
        level: getWordLearningLevel(word),
        allSlot: -1,
        longSlot: -1,
        levelSlot: -1,
        levelLongSlot: -1
      };
    });
    for (let index = 0; index < this.entries.length; index++) this.makeAvailable(index);
    this.remaining = bank.length;
    this.longRemaining = this.long.length;
    this.cached = { remaining: bank.length, total: bank.length, bossReady: this.longRemaining >= 9 };
  }
  random;
  entries;
  byWord = /* @__PURE__ */ new Map();
  byAlias = /* @__PURE__ */ new Map();
  seen = /* @__PURE__ */ new Set();
  all = [];
  long = [];
  levels = Array.from({ length: MAX_LEARNING_LEVEL + 1 }, () => []);
  longLevels = Array.from({ length: MAX_LEARNING_LEVEL + 1 }, () => []);
  reserved = /* @__PURE__ */ new Map();
  remaining;
  longRemaining;
  cached;
  get availability() {
    return this.cached;
  }
  /** Merge historical exposure without rebuilding pools or normalizing already known keys. */
  addSeen(answers) {
    let changed = false;
    for (const raw of answers) {
      if (this.seen.has(raw)) continue;
      const answer = raw.trim().toLowerCase();
      if (this.seen.has(answer)) continue;
      this.seen.add(answer);
      for (const id of this.byAlias.get(answer) ?? []) {
        const entry = this.entries[id];
        if (entry.seen) continue;
        entry.seen = true;
        this.remaining--;
        if (entry.long) this.longRemaining--;
        this.removeAvailable(id);
        changed = true;
      }
    }
    if (changed) this.cached = { remaining: this.remaining, total: this.entries.length, bossReady: this.longRemaining >= 9 };
  }
  isUnseen(word) {
    const id = this.byWord.get(word);
    return id === void 0 ? !historyKeysFor(word).some((answer) => this.seen.has(answer)) : !this.entries[id].seen;
  }
  /** Atomic reservation in at most ten indexed bands; no bank scan, even on fallback. */
  reserve(count, longOnly = false, preferredLevel, allowHigherLevels = true) {
    const pools = preferredLevel === void 0 ? [longOnly ? this.long : this.all] : learningLevelOrder(preferredLevel).filter((level) => allowHigherLevels || level <= preferredLevel).map((level) => (longOnly ? this.longLevels : this.levels)[level]);
    if (pools.reduce((total, pool) => total + pool.length, 0) < count) return void 0;
    const chosen = [];
    while (chosen.length < count) {
      const pool = pools.find((available) => available.length > 0);
      if (!pool) break;
      const fraction = this.random();
      const random = Number.isFinite(fraction) ? Math.max(0, Math.min(0.999999, fraction)) : 0;
      const id = pool[Math.floor(random * pool.length)];
      const affected = [...new Set(this.entries[id].aliases.flatMap((alias) => this.byAlias.get(alias) ?? []))];
      this.reserved.set(id, affected);
      for (const related of affected) {
        this.entries[related].blocked++;
        this.removeAvailable(related);
      }
      chosen.push(this.entries[id].word);
    }
    if (chosen.length === count) return chosen;
    this.release(chosen);
    return void 0;
  }
  markShown(word) {
    const id = this.byWord.get(word);
    this.addSeen(id === void 0 ? historyKeysFor(word) : this.entries[id].aliases);
    this.release([word]);
  }
  release(words) {
    for (const word of words) {
      const id = this.byWord.get(word);
      if (id === void 0) continue;
      const affected = this.reserved.get(id);
      if (!affected) continue;
      this.reserved.delete(id);
      for (const related of affected) {
        this.entries[related].blocked--;
        this.makeAvailable(related);
      }
    }
  }
  clearReservations() {
    this.release([...this.reserved.keys()].map((id) => this.entries[id].word));
  }
  makeAvailable(id) {
    const entry = this.entries[id];
    if (entry.seen || entry.blocked > 0 || entry.allSlot >= 0) return;
    entry.allSlot = this.all.length;
    this.all.push(id);
    entry.levelSlot = this.levels[entry.level].length;
    this.levels[entry.level].push(id);
    if (entry.long) {
      entry.longSlot = this.long.length;
      this.long.push(id);
    }
    if (entry.long) {
      entry.levelLongSlot = this.longLevels[entry.level].length;
      this.longLevels[entry.level].push(id);
    }
  }
  removeAvailable(id) {
    const remove = (pool, slotName) => {
      const entry = this.entries[id];
      const slot = entry[slotName];
      if (slot < 0) return;
      const last = pool.pop();
      if (slot < pool.length) {
        pool[slot] = last;
        this.entries[last][slotName] = slot;
      }
      entry[slotName] = -1;
    };
    remove(this.all, "allSlot");
    remove(this.long, "longSlot");
    remove(this.levels[this.entries[id].level], "levelSlot");
    remove(this.longLevels[this.entries[id].level], "levelLongSlot");
  }
};

// src/game/characterCatalog.generated.json
var characterCatalog_generated_default = {
  version: 1,
  sourcePacks: [
    "Tiny RPG Character Asset Pack 01 v2.0 -Full 22 Characters",
    "Tiny RPG Character Asset Pack 02 -Full 20 Characters"
  ],
  characters: [
    {
      id: "archer",
      name: "Archer",
      label: "Cung th\u1EE7",
      faction: "hero",
      portrait: "/art/characters/archer/portrait.png",
      displayScale: 7,
      originX: 0.5,
      originY: 0.57,
      bodyHeight: 17,
      bodyWidth: 22,
      hitOffset: {
        x: 1,
        y: -9
      },
      actions: {
        idle: "archer-idle",
        move: "archer-move",
        attack: "archer-attack",
        hurt: "archer-hurt",
        death: "archer-death"
      }
    },
    {
      id: "armored-axeman",
      name: "Armored Axeman",
      label: "Chi\u1EBFn binh r\xECu",
      faction: "hero",
      portrait: "/art/characters/armored-axeman/portrait.png",
      displayScale: 7,
      originX: 0.5,
      originY: 0.57,
      bodyHeight: 19,
      bodyWidth: 19,
      hitOffset: {
        x: 3,
        y: -10
      },
      actions: {
        idle: "armored-axeman-idle",
        move: "armored-axeman-move",
        attack: "armored-axeman-attack",
        hurt: "armored-axeman-hurt",
        death: "armored-axeman-death"
      }
    },
    {
      id: "armored-orc",
      name: "Armored Orc",
      label: "Orc b\u1ECDc gi\xE1p",
      faction: "enemy",
      enemyKind: "armored",
      portrait: "/art/characters/armored-orc/portrait.png",
      displayScale: 6.58,
      originX: 0.5,
      originY: 0.57,
      bodyHeight: 19,
      bodyWidth: 25,
      hitOffset: {
        x: 3,
        y: -10
      },
      actions: {
        idle: "armored-orc-idle",
        move: "armored-orc-move",
        attack: "armored-orc-attack",
        hurt: "armored-orc-hurt",
        death: "armored-orc-death"
      }
    },
    {
      id: "armored-skeleton",
      name: "Armored Skeleton",
      label: "B\u1ED9 x\u01B0\u01A1ng b\u1ECDc gi\xE1p",
      faction: "enemy",
      enemyKind: "armored",
      portrait: "/art/characters/armored-skeleton/portrait.png",
      displayScale: 5.43,
      originX: 0.5,
      originY: 0.58,
      bodyHeight: 23,
      bodyWidth: 18,
      hitOffset: {
        x: 3,
        y: -12
      },
      actions: {
        idle: "armored-skeleton-idle",
        move: "armored-skeleton-move",
        attack: "armored-skeleton-attack",
        hurt: "armored-skeleton-hurt",
        death: "armored-skeleton-death"
      }
    },
    {
      id: "bat",
      name: "Bat",
      label: "D\u01A1i",
      faction: "enemy",
      enemyKind: "runner",
      portrait: "/art/characters/bat/portrait.png",
      displayScale: 7,
      originX: 0.5,
      originY: 0.6,
      bodyHeight: 11,
      bodyWidth: 22,
      hitOffset: {
        x: -1,
        y: -17
      },
      actions: {
        idle: "bat-idle",
        move: "bat-move",
        attack: "bat-attack",
        hurt: "bat-hurt",
        death: "bat-death"
      }
    },
    {
      id: "black-knight-a",
      name: "Black Knight_A",
      label: "K\u1EF5 s\u0129 \u0111en A",
      faction: "enemy",
      enemyKind: "armored",
      portrait: "/art/characters/black-knight-a/portrait.png",
      displayScale: 5,
      originX: 0.5,
      originY: 0.58,
      bodyHeight: 30,
      bodyWidth: 16,
      hitOffset: {
        x: 2,
        y: -13
      },
      actions: {
        idle: "black-knight-a-idle",
        move: "black-knight-a-move",
        attack: "black-knight-a-attack",
        hurt: "black-knight-a-hurt",
        death: "black-knight-a-death"
      }
    },
    {
      id: "black-knight-b",
      name: "Black Knight_B",
      label: "K\u1EF5 s\u0129 \u0111en B",
      faction: "enemy",
      enemyKind: "armored",
      portrait: "/art/characters/black-knight-b/portrait.png",
      displayScale: 6.25,
      originX: 0.5,
      originY: 0.57,
      bodyHeight: 20,
      bodyWidth: 19,
      hitOffset: {
        x: 0,
        y: -11
      },
      actions: {
        idle: "black-knight-b-idle",
        move: "black-knight-b-move",
        attack: "black-knight-b-attack",
        hurt: "black-knight-b-hurt",
        death: "black-knight-b-death"
      }
    },
    {
      id: "black-knight-c",
      name: "Black Knight_C",
      label: "K\u1EF5 s\u0129 \u0111en C",
      faction: "enemy",
      enemyKind: "armored",
      portrait: "/art/characters/black-knight-c/portrait.png",
      displayScale: 5,
      originX: 0.5,
      originY: 0.57,
      bodyHeight: 27,
      bodyWidth: 39,
      hitOffset: {
        x: 3,
        y: -13
      },
      actions: {
        idle: "black-knight-c-idle",
        move: "black-knight-c-move",
        attack: "black-knight-c-attack",
        hurt: "black-knight-c-hurt",
        death: "black-knight-c-death"
      }
    },
    {
      id: "blood-monster-a",
      name: "Blood Monster_A",
      label: "Qu\xE1i v\u1EADt m\xE1u A",
      faction: "enemy",
      enemyKind: "tank",
      portrait: "/art/characters/blood-monster-a/portrait.png",
      displayScale: 12,
      originX: 0.5,
      originY: 0.58,
      bodyHeight: 15,
      bodyWidth: 20,
      hitOffset: {
        x: 2,
        y: -9
      },
      actions: {
        idle: "blood-monster-a-idle",
        move: "blood-monster-a-move",
        attack: "blood-monster-a-attack",
        hurt: "blood-monster-a-hurt",
        death: "blood-monster-a-death"
      }
    },
    {
      id: "blood-monster-b",
      name: "Blood Monster_B",
      label: "Qu\xE1i v\u1EADt m\xE1u B",
      faction: "enemy",
      enemyKind: "tank",
      portrait: "/art/characters/blood-monster-b/portrait.png",
      displayScale: 12,
      originX: 0.5,
      originY: 0.6,
      bodyHeight: 14,
      bodyWidth: 14,
      hitOffset: {
        x: 3,
        y: -14
      },
      actions: {
        idle: "blood-monster-b-idle",
        move: "blood-monster-b-move",
        attack: "blood-monster-b-attack",
        hurt: "blood-monster-b-hurt",
        death: "blood-monster-b-death"
      }
    },
    {
      id: "demon-a",
      name: "Demon_A",
      label: "\xC1c qu\u1EF7 A",
      faction: "enemy",
      enemyKind: "runner",
      portrait: "/art/characters/demon-a/portrait.png",
      displayScale: 5.5,
      originX: 0.5,
      originY: 0.59,
      bodyHeight: 20,
      bodyWidth: 20,
      hitOffset: {
        x: 3,
        y: -11
      },
      actions: {
        idle: "demon-a-idle",
        move: "demon-a-move",
        attack: "demon-a-attack",
        hurt: "demon-a-hurt",
        death: "demon-a-death"
      }
    },
    {
      id: "demon-b",
      name: "Demon_B",
      label: "\xC1c qu\u1EF7 B",
      faction: "enemy",
      enemyKind: "armored",
      portrait: "/art/characters/demon-b/portrait.png",
      displayScale: 6.94,
      originX: 0.5,
      originY: 0.58,
      bodyHeight: 18,
      bodyWidth: 18,
      hitOffset: {
        x: 2,
        y: -10
      },
      actions: {
        idle: "demon-b-idle",
        move: "demon-b-move",
        attack: "demon-b-attack",
        hurt: "demon-b-hurt",
        death: "demon-b-death"
      }
    },
    {
      id: "demon-c",
      name: "Demon_C",
      label: "\xC1c qu\u1EF7 C",
      faction: "enemy",
      enemyKind: "normal",
      portrait: "/art/characters/demon-c/portrait.png",
      displayScale: 5.24,
      originX: 0.5,
      originY: 0.56,
      bodyHeight: 21,
      bodyWidth: 31,
      hitOffset: {
        x: 3,
        y: -13
      },
      actions: {
        idle: "demon-c-idle",
        move: "demon-c-move",
        attack: "demon-c-attack",
        hurt: "demon-c-hurt",
        death: "demon-c-death"
      }
    },
    {
      id: "demon-d",
      name: "Demon_D",
      label: "\xC1c qu\u1EF7 D",
      faction: "enemy",
      enemyKind: "tank",
      portrait: "/art/characters/demon-d/portrait.png",
      displayScale: 8.75,
      originX: 0.5,
      originY: 0.58,
      bodyHeight: 24,
      bodyWidth: 25,
      hitOffset: {
        x: 3,
        y: -13
      },
      actions: {
        idle: "demon-d-idle",
        move: "demon-d-move",
        attack: "demon-d-attack",
        hurt: "demon-d-hurt",
        death: "demon-d-death"
      }
    },
    {
      id: "demon-e",
      name: "Demon_E",
      label: "\xC1c qu\u1EF7 E",
      faction: "enemy",
      enemyKind: "runner",
      portrait: "/art/characters/demon-e/portrait.png",
      displayScale: 5,
      originX: 0.5,
      originY: 0.59,
      bodyHeight: 23,
      bodyWidth: 46,
      hitOffset: {
        x: 3,
        y: -12
      },
      actions: {
        idle: "demon-e-idle",
        move: "demon-e-move",
        attack: "demon-e-attack",
        hurt: "demon-e-hurt",
        death: "demon-e-death"
      }
    },
    {
      id: "demoness-a",
      name: "Demoness_A",
      label: "N\u1EEF qu\u1EF7 A",
      faction: "enemy",
      enemyKind: "normal",
      portrait: "/art/characters/demoness-a/portrait.png",
      displayScale: 4.8,
      originX: 0.5,
      originY: 0.58,
      bodyHeight: 26,
      bodyWidth: 34,
      hitOffset: {
        x: 3,
        y: -13
      },
      actions: {
        idle: "demoness-a-idle",
        move: "demoness-a-move",
        attack: "demoness-a-attack",
        hurt: "demoness-a-hurt",
        death: "demoness-a-death"
      }
    },
    {
      id: "demoness-b",
      name: "Demoness_B",
      label: "N\u1EEF qu\u1EF7 B",
      faction: "enemy",
      enemyKind: "normal",
      portrait: "/art/characters/demoness-b/portrait.png",
      displayScale: 4.8,
      originX: 0.5,
      originY: 0.59,
      bodyHeight: 23,
      bodyWidth: 24,
      hitOffset: {
        x: -1,
        y: -13
      },
      actions: {
        idle: "demoness-b-idle",
        move: "demoness-b-move",
        attack: "demoness-b-attack",
        hurt: "demoness-b-hurt",
        death: "demoness-b-death"
      }
    },
    {
      id: "elite-orc",
      name: "Elite Orc",
      label: "Orc tinh nhu\u1EC7",
      faction: "enemy",
      enemyKind: "armored",
      portrait: "/art/characters/elite-orc/portrait.png",
      displayScale: 5.43,
      originX: 0.5,
      originY: 0.57,
      bodyHeight: 23,
      bodyWidth: 28,
      hitOffset: {
        x: 3,
        y: -12
      },
      actions: {
        idle: "elite-orc-idle",
        move: "elite-orc-move",
        attack: "elite-orc-attack",
        hurt: "elite-orc-hurt",
        death: "elite-orc-death"
      }
    },
    {
      id: "eyeball-monster",
      name: "Eyeball Monster",
      label: "Qu\xE1i v\u1EADt nh\xE3n c\u1EA7u",
      faction: "enemy",
      enemyKind: "normal",
      portrait: "/art/characters/eyeball-monster/portrait.png",
      displayScale: 7,
      originX: 0.5,
      originY: 0.58,
      bodyHeight: 13,
      bodyWidth: 15,
      hitOffset: {
        x: 0,
        y: -7
      },
      actions: {
        idle: "eyeball-monster-idle",
        move: "eyeball-monster-move",
        attack: "eyeball-monster-attack",
        hurt: "eyeball-monster-hurt",
        death: "eyeball-monster-death"
      }
    },
    {
      id: "flame-golem",
      name: "Flame Golem",
      label: "Kh\u1ED5ng l\u1ED3 l\u1EEDa",
      faction: "enemy",
      enemyKind: "tank",
      portrait: "/art/characters/flame-golem/portrait.png",
      displayScale: 8,
      originX: 0.5,
      originY: 0.57,
      bodyHeight: 28,
      bodyWidth: 32,
      hitOffset: {
        x: 2,
        y: -13
      },
      actions: {
        idle: "flame-golem-idle",
        move: "flame-golem-move",
        attack: "flame-golem-attack",
        hurt: "flame-golem-hurt",
        death: "flame-golem-death"
      }
    },
    {
      id: "ghostfire",
      name: "Ghostfire",
      label: "L\u1EEDa ma",
      faction: "enemy",
      enemyKind: "normal",
      portrait: "/art/characters/ghostfire/portrait.png",
      displayScale: 5,
      originX: 0.5,
      originY: 0.6,
      bodyHeight: 22,
      bodyWidth: 13,
      hitOffset: {
        x: 2,
        y: -20
      },
      actions: {
        idle: "ghostfire-idle",
        move: "ghostfire-move",
        attack: "ghostfire-attack",
        hurt: "ghostfire-hurt",
        death: "ghostfire-death"
      }
    },
    {
      id: "greatsword-skeleton",
      name: "Greatsword Skeleton",
      label: "B\u1ED9 x\u01B0\u01A1ng \u0111\u1EA1i ki\u1EBFm",
      faction: "enemy",
      enemyKind: "armored",
      portrait: "/art/characters/greatsword-skeleton/portrait.png",
      displayScale: 6.58,
      originX: 0.5,
      originY: 0.57,
      bodyHeight: 19,
      bodyWidth: 31,
      hitOffset: {
        x: -3,
        y: -10
      },
      actions: {
        idle: "greatsword-skeleton-idle",
        move: "greatsword-skeleton-move",
        attack: "greatsword-skeleton-attack",
        hurt: "greatsword-skeleton-hurt",
        death: "greatsword-skeleton-death"
      }
    },
    {
      id: "hellbat",
      name: "Hellbat",
      label: "D\u01A1i \u0111\u1ECBa ng\u1EE5c",
      faction: "enemy",
      enemyKind: "runner",
      portrait: "/art/characters/hellbat/portrait.png",
      displayScale: 7,
      originX: 0.5,
      originY: 0.6,
      bodyHeight: 11,
      bodyWidth: 22,
      hitOffset: {
        x: -1,
        y: -17
      },
      actions: {
        idle: "hellbat-idle",
        move: "hellbat-move",
        attack: "hellbat-attack",
        hurt: "hellbat-hurt",
        death: "hellbat-death"
      }
    },
    {
      id: "hellhound",
      name: "Hellhound",
      label: "Ch\xF3 \u0111\u1ECBa ng\u1EE5c",
      faction: "enemy",
      enemyKind: "runner",
      portrait: "/art/characters/hellhound/portrait.png",
      displayScale: 6.88,
      originX: 0.5,
      originY: 0.57,
      bodyHeight: 16,
      bodyWidth: 29,
      hitOffset: {
        x: 0,
        y: -9
      },
      actions: {
        idle: "hellhound-idle",
        move: "hellhound-move",
        attack: "hellhound-attack",
        hurt: "hellhound-hurt",
        death: "hellhound-death"
      }
    },
    {
      id: "knight",
      name: "Knight",
      label: "Hi\u1EC7p s\u0129",
      faction: "hero",
      portrait: "/art/characters/knight/portrait.png",
      displayScale: 7,
      originX: 0.5,
      originY: 0.57,
      bodyHeight: 18,
      bodyWidth: 26,
      hitOffset: {
        x: 3,
        y: -10
      },
      actions: {
        idle: "knight-idle",
        move: "knight-move",
        attack: "knight-attack",
        hurt: "knight-hurt",
        death: "knight-death"
      }
    },
    {
      id: "knight-templar",
      name: "Knight Templar",
      label: "Hi\u1EC7p s\u0129 d\xF2ng \u0110\u1EC1n",
      faction: "hero",
      portrait: "/art/characters/knight-templar/portrait.png",
      displayScale: 7,
      originX: 0.5,
      originY: 0.57,
      bodyHeight: 17,
      bodyWidth: 27,
      hitOffset: {
        x: 3,
        y: -9
      },
      actions: {
        idle: "knight-templar-idle",
        move: "knight-templar-move",
        attack: "knight-templar-attack",
        hurt: "knight-templar-hurt",
        death: "knight-templar-death"
      }
    },
    {
      id: "lancer",
      name: "Lancer",
      label: "Th\u01B0\u01A1ng th\u1EE7",
      faction: "hero",
      portrait: "/art/characters/lancer/portrait.png",
      displayScale: 5.5,
      originX: 0.5,
      originY: 0.57,
      bodyHeight: 37,
      bodyWidth: 35,
      hitOffset: {
        x: 0,
        y: -13
      },
      actions: {
        idle: "lancer-idle",
        move: "lancer-move",
        attack: "lancer-attack",
        hurt: "lancer-hurt",
        death: "lancer-death"
      }
    },
    {
      id: "lava-slime",
      name: "Lava Slime",
      label: "Qu\xE1i nh\u1EA7y dung nham",
      faction: "enemy",
      enemyKind: "normal",
      portrait: "/art/characters/lava-slime/portrait.png",
      displayScale: 7,
      originX: 0.5,
      originY: 0.57,
      bodyHeight: 14,
      bodyWidth: 23,
      hitOffset: {
        x: -2,
        y: -8
      },
      actions: {
        idle: "lava-slime-idle",
        move: "lava-slime-move",
        attack: "lava-slime-attack",
        hurt: "lava-slime-hurt",
        death: "lava-slime-death"
      }
    },
    {
      id: "minotaur",
      name: "Minotaur",
      label: "Qu\xE1i v\u1EADt \u0111\u1EA7u b\xF2",
      faction: "enemy",
      enemyKind: "tank",
      portrait: "/art/characters/minotaur/portrait.png",
      displayScale: 10.5,
      originX: 0.5,
      originY: 0.59,
      bodyHeight: 20,
      bodyWidth: 30,
      hitOffset: {
        x: 3,
        y: -12
      },
      actions: {
        idle: "minotaur-idle",
        move: "minotaur-move",
        attack: "minotaur-attack",
        hurt: "minotaur-hurt",
        death: "minotaur-death"
      }
    },
    {
      id: "necromancer",
      name: "Necromancer",
      label: "Ph\xE1p s\u01B0 g\u1ECDi h\u1ED3n",
      faction: "enemy",
      enemyKind: "normal",
      portrait: "/art/characters/necromancer/portrait.png",
      displayScale: 4.8,
      originX: 0.5,
      originY: 0.61,
      bodyHeight: 30,
      bodyWidth: 30,
      hitOffset: {
        x: -3,
        y: -14
      },
      actions: {
        idle: "necromancer-idle",
        move: "necromancer-move",
        attack: "necromancer-attack",
        hurt: "necromancer-hurt",
        death: "necromancer-death"
      }
    },
    {
      id: "orc",
      name: "Orc",
      label: "Orc",
      faction: "enemy",
      enemyKind: "normal",
      portrait: "/art/characters/orc/portrait.png",
      displayScale: 7,
      originX: 0.5,
      originY: 0.57,
      bodyHeight: 15,
      bodyWidth: 22,
      hitOffset: {
        x: 3,
        y: -8
      },
      actions: {
        idle: "orc-idle",
        move: "orc-move",
        attack: "orc-attack",
        hurt: "orc-hurt",
        death: "orc-death"
      }
    },
    {
      id: "orc-rider",
      name: "Orc rider",
      label: "K\u1EF5 binh Orc",
      faction: "enemy",
      enemyKind: "runner",
      portrait: "/art/characters/orc-rider/portrait.png",
      displayScale: 5,
      originX: 0.5,
      originY: 0.57,
      bodyHeight: 28,
      bodyWidth: 32,
      hitOffset: {
        x: 3,
        y: -13
      },
      actions: {
        idle: "orc-rider-idle",
        move: "orc-rider-move",
        attack: "orc-rider-attack",
        hurt: "orc-rider-hurt",
        death: "orc-rider-death"
      }
    },
    {
      id: "priest",
      name: "Priest",
      label: "Tu s\u0129",
      faction: "hero",
      portrait: "/art/characters/priest/portrait.png",
      displayScale: 6.9,
      originX: 0.5,
      originY: 0.58,
      bodyHeight: 20,
      bodyWidth: 16,
      hitOffset: {
        x: 2,
        y: -11
      },
      actions: {
        idle: "priest-idle",
        move: "priest-move",
        attack: "priest-attack",
        hurt: "priest-hurt",
        death: "priest-death"
      }
    },
    {
      id: "skeleton",
      name: "Skeleton",
      label: "B\u1ED9 x\u01B0\u01A1ng",
      faction: "enemy",
      enemyKind: "normal",
      portrait: "/art/characters/skeleton/portrait.png",
      displayScale: 7,
      originX: 0.5,
      originY: 0.57,
      bodyHeight: 15,
      bodyWidth: 26,
      hitOffset: {
        x: 3,
        y: -8
      },
      actions: {
        idle: "skeleton-idle",
        move: "skeleton-move",
        attack: "skeleton-attack",
        hurt: "skeleton-hurt",
        death: "skeleton-death"
      }
    },
    {
      id: "skeleton-archer",
      name: "Skeleton Archer",
      label: "Cung th\u1EE7 x\u01B0\u01A1ng",
      faction: "enemy",
      enemyKind: "normal",
      portrait: "/art/characters/skeleton-archer/portrait.png",
      displayScale: 5.24,
      originX: 0.5,
      originY: 0.59,
      bodyHeight: 21,
      bodyWidth: 21,
      hitOffset: {
        x: 2,
        y: -11
      },
      actions: {
        idle: "skeleton-archer-idle",
        move: "skeleton-archer-move",
        attack: "skeleton-archer-attack",
        hurt: "skeleton-archer-hurt",
        death: "skeleton-archer-death"
      }
    },
    {
      id: "slime",
      name: "Slime",
      label: "Qu\xE1i nh\u1EA7y",
      faction: "enemy",
      enemyKind: "normal",
      portrait: "/art/characters/slime/portrait.png",
      displayScale: 7,
      originX: 0.5,
      originY: 0.57,
      bodyHeight: 11,
      bodyWidth: 23,
      hitOffset: {
        x: -2,
        y: -7
      },
      actions: {
        idle: "slime-idle",
        move: "slime-move",
        attack: "slime-attack",
        hurt: "slime-hurt",
        death: "slime-death"
      }
    },
    {
      id: "soldier",
      name: "Soldier",
      label: "Ng\u01B0\u1EDDi l\xEDnh",
      faction: "hero",
      portrait: "/art/characters/soldier/portrait.png",
      displayScale: 6.57,
      originX: 0.5,
      originY: 0.6,
      bodyHeight: 21,
      bodyWidth: 17,
      hitOffset: {
        x: -1,
        y: -11
      },
      actions: {
        idle: "soldier-idle",
        move: "soldier-move",
        attack: "soldier-attack",
        hurt: "soldier-hurt",
        death: "soldier-death"
      }
    },
    {
      id: "swordsman",
      name: "Swordsman",
      label: "Ki\u1EBFm s\u0129",
      faction: "hero",
      portrait: "/art/characters/swordsman/portrait.png",
      displayScale: 6.57,
      originX: 0.5,
      originY: 0.6,
      bodyHeight: 21,
      bodyWidth: 24,
      hitOffset: {
        x: 3,
        y: -11
      },
      actions: {
        idle: "swordsman-idle",
        move: "swordsman-move",
        attack: "swordsman-attack",
        hurt: "swordsman-hurt",
        death: "swordsman-death"
      }
    },
    {
      id: "warlock",
      name: "Warlock",
      label: "Thu\u1EADt s\u0129 h\u1EAFc \xE1m",
      faction: "enemy",
      enemyKind: "normal",
      portrait: "/art/characters/warlock/portrait.png",
      displayScale: 4.8,
      originX: 0.5,
      originY: 0.58,
      bodyHeight: 24,
      bodyWidth: 21,
      hitOffset: {
        x: 0,
        y: -13
      },
      actions: {
        idle: "warlock-idle",
        move: "warlock-move",
        attack: "warlock-attack",
        hurt: "warlock-hurt",
        death: "warlock-death"
      }
    },
    {
      id: "werebear",
      name: "Werebear",
      label: "Ng\u01B0\u1EDDi g\u1EA5u",
      faction: "enemy",
      enemyKind: "tank",
      portrait: "/art/characters/werebear/portrait.png",
      displayScale: 12,
      originX: 0.5,
      originY: 0.57,
      bodyHeight: 17,
      bodyWidth: 19,
      hitOffset: {
        x: 1,
        y: -9
      },
      actions: {
        idle: "werebear-idle",
        move: "werebear-move",
        attack: "werebear-attack",
        hurt: "werebear-hurt",
        death: "werebear-death"
      }
    },
    {
      id: "werewolf",
      name: "Werewolf",
      label: "Ng\u01B0\u1EDDi s\xF3i",
      faction: "enemy",
      enemyKind: "runner",
      portrait: "/art/characters/werewolf/portrait.png",
      displayScale: 6.88,
      originX: 0.5,
      originY: 0.57,
      bodyHeight: 16,
      bodyWidth: 27,
      hitOffset: {
        x: 3,
        y: -9
      },
      actions: {
        idle: "werewolf-idle",
        move: "werewolf-move",
        attack: "werewolf-attack",
        hurt: "werewolf-hurt",
        death: "werewolf-death"
      }
    },
    {
      id: "wizard",
      name: "Wizard",
      label: "Ph\xE1p s\u01B0",
      faction: "hero",
      portrait: "/art/characters/wizard/portrait.png",
      displayScale: 7,
      originX: 0.5,
      originY: 0.58,
      bodyHeight: 19,
      bodyWidth: 17,
      hitOffset: {
        x: 1,
        y: -10
      },
      actions: {
        idle: "wizard-idle",
        move: "wizard-move",
        attack: "wizard-attack",
        hurt: "wizard-hurt",
        death: "wizard-death"
      }
    }
  ],
  sprites: [
    {
      key: "archer-idle",
      path: "/art/characters/archer/idle.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: true,
      originX: 0.5,
      originY: 0.57
    },
    {
      key: "archer-move",
      path: "/art/characters/archer/move.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: true,
      originX: 0.5,
      originY: 0.57
    },
    {
      key: "archer-attack",
      path: "/art/characters/archer/attack.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: false,
      originX: 0.5,
      originY: 0.57,
      attackContactFrame: 6,
      releaseFrame: 6,
      projectileOffset: {
        x: 9,
        y: -8
      }
    },
    {
      key: "archer-hurt",
      path: "/art/characters/archer/hurt.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100
      ],
      loop: false,
      originX: 0.5,
      originY: 0.57
    },
    {
      key: "archer-death",
      path: "/art/characters/archer/death.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        600
      ],
      loop: false,
      originX: 0.5,
      originY: 0.57
    },
    {
      key: "armored-axeman-idle",
      path: "/art/characters/armored-axeman/idle.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: true,
      originX: 0.5,
      originY: 0.57
    },
    {
      key: "armored-axeman-move",
      path: "/art/characters/armored-axeman/move.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: true,
      originX: 0.5,
      originY: 0.57
    },
    {
      key: "armored-axeman-attack",
      path: "/art/characters/armored-axeman/attack.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: false,
      originX: 0.5,
      originY: 0.57,
      attackContactFrame: 4,
      releaseFrame: 4,
      projectileOffset: {
        x: 14,
        y: -8
      }
    },
    {
      key: "armored-axeman-hurt",
      path: "/art/characters/armored-axeman/hurt.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100
      ],
      loop: false,
      originX: 0.5,
      originY: 0.57
    },
    {
      key: "armored-axeman-death",
      path: "/art/characters/armored-axeman/death.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        600
      ],
      loop: false,
      originX: 0.5,
      originY: 0.57
    },
    {
      key: "armored-orc-idle",
      path: "/art/characters/armored-orc/idle.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: true,
      originX: 0.5,
      originY: 0.57
    },
    {
      key: "armored-orc-move",
      path: "/art/characters/armored-orc/move.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: true,
      originX: 0.5,
      originY: 0.57
    },
    {
      key: "armored-orc-attack",
      path: "/art/characters/armored-orc/attack.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: false,
      originX: 0.5,
      originY: 0.57,
      attackContactFrame: 4,
      releaseFrame: 4
    },
    {
      key: "armored-orc-hurt",
      path: "/art/characters/armored-orc/hurt.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100
      ],
      loop: false,
      originX: 0.5,
      originY: 0.57
    },
    {
      key: "armored-orc-death",
      path: "/art/characters/armored-orc/death.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        600
      ],
      loop: false,
      originX: 0.5,
      originY: 0.57
    },
    {
      key: "armored-skeleton-idle",
      path: "/art/characters/armored-skeleton/idle.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: true,
      originX: 0.5,
      originY: 0.58
    },
    {
      key: "armored-skeleton-move",
      path: "/art/characters/armored-skeleton/move.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: true,
      originX: 0.5,
      originY: 0.58
    },
    {
      key: "armored-skeleton-attack",
      path: "/art/characters/armored-skeleton/attack.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: false,
      originX: 0.5,
      originY: 0.58,
      attackContactFrame: 4,
      releaseFrame: 4
    },
    {
      key: "armored-skeleton-hurt",
      path: "/art/characters/armored-skeleton/hurt.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100
      ],
      loop: false,
      originX: 0.5,
      originY: 0.58
    },
    {
      key: "armored-skeleton-death",
      path: "/art/characters/armored-skeleton/death.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        600
      ],
      loop: false,
      originX: 0.5,
      originY: 0.58
    },
    {
      key: "bat-idle",
      path: "/art/characters/bat/idle.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: true,
      originX: 0.5,
      originY: 0.6
    },
    {
      key: "bat-move",
      path: "/art/characters/bat/move.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: true,
      originX: 0.5,
      originY: 0.6
    },
    {
      key: "bat-attack",
      path: "/art/characters/bat/attack.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: false,
      originX: 0.5,
      originY: 0.6,
      attackContactFrame: 3,
      releaseFrame: 3
    },
    {
      key: "bat-hurt",
      path: "/art/characters/bat/hurt.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100
      ],
      loop: false,
      originX: 0.5,
      originY: 0.6
    },
    {
      key: "bat-death",
      path: "/art/characters/bat/death.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        600
      ],
      loop: false,
      originX: 0.5,
      originY: 0.6
    },
    {
      key: "black-knight-a-idle",
      path: "/art/characters/black-knight-a/idle.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: true,
      originX: 0.5,
      originY: 0.58
    },
    {
      key: "black-knight-a-move",
      path: "/art/characters/black-knight-a/move.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: true,
      originX: 0.5,
      originY: 0.58
    },
    {
      key: "black-knight-a-attack",
      path: "/art/characters/black-knight-a/attack.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100,
        100,
        100,
        100,
        100,
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: false,
      originX: 0.5,
      originY: 0.58,
      attackContactFrame: 5,
      releaseFrame: 5
    },
    {
      key: "black-knight-a-hurt",
      path: "/art/characters/black-knight-a/hurt.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100
      ],
      loop: false,
      originX: 0.5,
      originY: 0.58
    },
    {
      key: "black-knight-a-death",
      path: "/art/characters/black-knight-a/death.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        600
      ],
      loop: false,
      originX: 0.5,
      originY: 0.58
    },
    {
      key: "black-knight-b-idle",
      path: "/art/characters/black-knight-b/idle.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: true,
      originX: 0.5,
      originY: 0.57
    },
    {
      key: "black-knight-b-move",
      path: "/art/characters/black-knight-b/move.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: true,
      originX: 0.5,
      originY: 0.57
    },
    {
      key: "black-knight-b-attack",
      path: "/art/characters/black-knight-b/attack.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: false,
      originX: 0.5,
      originY: 0.57,
      attackContactFrame: 4,
      releaseFrame: 4
    },
    {
      key: "black-knight-b-hurt",
      path: "/art/characters/black-knight-b/hurt.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100
      ],
      loop: false,
      originX: 0.5,
      originY: 0.57
    },
    {
      key: "black-knight-b-death",
      path: "/art/characters/black-knight-b/death.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        600
      ],
      loop: false,
      originX: 0.5,
      originY: 0.57
    },
    {
      key: "black-knight-c-idle",
      path: "/art/characters/black-knight-c/idle.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: true,
      originX: 0.5,
      originY: 0.57
    },
    {
      key: "black-knight-c-move",
      path: "/art/characters/black-knight-c/move.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: true,
      originX: 0.5,
      originY: 0.57
    },
    {
      key: "black-knight-c-attack",
      path: "/art/characters/black-knight-c/attack.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: false,
      originX: 0.5,
      originY: 0.57,
      attackContactFrame: 5,
      releaseFrame: 5
    },
    {
      key: "black-knight-c-hurt",
      path: "/art/characters/black-knight-c/hurt.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100
      ],
      loop: false,
      originX: 0.5,
      originY: 0.57
    },
    {
      key: "black-knight-c-death",
      path: "/art/characters/black-knight-c/death.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100,
        100,
        100,
        100,
        600
      ],
      loop: false,
      originX: 0.5,
      originY: 0.57
    },
    {
      key: "blood-monster-a-idle",
      path: "/art/characters/blood-monster-a/idle.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: true,
      originX: 0.5,
      originY: 0.58
    },
    {
      key: "blood-monster-a-move",
      path: "/art/characters/blood-monster-a/move.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: true,
      originX: 0.5,
      originY: 0.58
    },
    {
      key: "blood-monster-a-attack",
      path: "/art/characters/blood-monster-a/attack.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: false,
      originX: 0.5,
      originY: 0.58,
      attackContactFrame: 4,
      releaseFrame: 4
    },
    {
      key: "blood-monster-a-hurt",
      path: "/art/characters/blood-monster-a/hurt.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100
      ],
      loop: false,
      originX: 0.5,
      originY: 0.58
    },
    {
      key: "blood-monster-a-death",
      path: "/art/characters/blood-monster-a/death.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        600
      ],
      loop: false,
      originX: 0.5,
      originY: 0.58
    },
    {
      key: "blood-monster-b-idle",
      path: "/art/characters/blood-monster-b/idle.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: true,
      originX: 0.5,
      originY: 0.6
    },
    {
      key: "blood-monster-b-move",
      path: "/art/characters/blood-monster-b/move.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: true,
      originX: 0.5,
      originY: 0.6
    },
    {
      key: "blood-monster-b-attack",
      path: "/art/characters/blood-monster-b/attack.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: false,
      originX: 0.5,
      originY: 0.6,
      attackContactFrame: 3,
      releaseFrame: 3
    },
    {
      key: "blood-monster-b-hurt",
      path: "/art/characters/blood-monster-b/hurt.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100
      ],
      loop: false,
      originX: 0.5,
      originY: 0.6
    },
    {
      key: "blood-monster-b-death",
      path: "/art/characters/blood-monster-b/death.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        600
      ],
      loop: false,
      originX: 0.5,
      originY: 0.6
    },
    {
      key: "demon-a-idle",
      path: "/art/characters/demon-a/idle.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: true,
      originX: 0.5,
      originY: 0.59
    },
    {
      key: "demon-a-move",
      path: "/art/characters/demon-a/move.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: true,
      originX: 0.5,
      originY: 0.59
    },
    {
      key: "demon-a-attack",
      path: "/art/characters/demon-a/attack.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: false,
      originX: 0.5,
      originY: 0.59,
      attackContactFrame: 3,
      releaseFrame: 3
    },
    {
      key: "demon-a-hurt",
      path: "/art/characters/demon-a/hurt.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100
      ],
      loop: false,
      originX: 0.5,
      originY: 0.59
    },
    {
      key: "demon-a-death",
      path: "/art/characters/demon-a/death.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        600
      ],
      loop: false,
      originX: 0.5,
      originY: 0.59
    },
    {
      key: "demon-b-idle",
      path: "/art/characters/demon-b/idle.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: true,
      originX: 0.5,
      originY: 0.58
    },
    {
      key: "demon-b-move",
      path: "/art/characters/demon-b/move.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: true,
      originX: 0.5,
      originY: 0.58
    },
    {
      key: "demon-b-attack",
      path: "/art/characters/demon-b/attack.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: false,
      originX: 0.5,
      originY: 0.58,
      attackContactFrame: 6,
      releaseFrame: 6
    },
    {
      key: "demon-b-hurt",
      path: "/art/characters/demon-b/hurt.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100
      ],
      loop: false,
      originX: 0.5,
      originY: 0.58
    },
    {
      key: "demon-b-death",
      path: "/art/characters/demon-b/death.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        600
      ],
      loop: false,
      originX: 0.5,
      originY: 0.58
    },
    {
      key: "demon-c-idle",
      path: "/art/characters/demon-c/idle.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: true,
      originX: 0.5,
      originY: 0.56
    },
    {
      key: "demon-c-move",
      path: "/art/characters/demon-c/move.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: true,
      originX: 0.5,
      originY: 0.56
    },
    {
      key: "demon-c-attack",
      path: "/art/characters/demon-c/attack.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: false,
      originX: 0.5,
      originY: 0.56,
      attackContactFrame: 3,
      releaseFrame: 3
    },
    {
      key: "demon-c-hurt",
      path: "/art/characters/demon-c/hurt.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100
      ],
      loop: false,
      originX: 0.5,
      originY: 0.56
    },
    {
      key: "demon-c-death",
      path: "/art/characters/demon-c/death.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        600
      ],
      loop: false,
      originX: 0.5,
      originY: 0.56
    },
    {
      key: "demon-d-idle",
      path: "/art/characters/demon-d/idle.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: true,
      originX: 0.5,
      originY: 0.58
    },
    {
      key: "demon-d-move",
      path: "/art/characters/demon-d/move.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: true,
      originX: 0.5,
      originY: 0.58
    },
    {
      key: "demon-d-attack",
      path: "/art/characters/demon-d/attack.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: false,
      originX: 0.5,
      originY: 0.58,
      attackContactFrame: 7,
      releaseFrame: 7
    },
    {
      key: "demon-d-hurt",
      path: "/art/characters/demon-d/hurt.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100
      ],
      loop: false,
      originX: 0.5,
      originY: 0.58
    },
    {
      key: "demon-d-death",
      path: "/art/characters/demon-d/death.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        600
      ],
      loop: false,
      originX: 0.5,
      originY: 0.58
    },
    {
      key: "demon-e-idle",
      path: "/art/characters/demon-e/idle.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: true,
      originX: 0.5,
      originY: 0.59
    },
    {
      key: "demon-e-move",
      path: "/art/characters/demon-e/move.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: true,
      originX: 0.5,
      originY: 0.59
    },
    {
      key: "demon-e-attack",
      path: "/art/characters/demon-e/attack.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: false,
      originX: 0.5,
      originY: 0.59,
      attackContactFrame: 5,
      releaseFrame: 5
    },
    {
      key: "demon-e-hurt",
      path: "/art/characters/demon-e/hurt.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100
      ],
      loop: false,
      originX: 0.5,
      originY: 0.59
    },
    {
      key: "demon-e-death",
      path: "/art/characters/demon-e/death.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        600
      ],
      loop: false,
      originX: 0.5,
      originY: 0.59
    },
    {
      key: "demoness-a-idle",
      path: "/art/characters/demoness-a/idle.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: true,
      originX: 0.5,
      originY: 0.58
    },
    {
      key: "demoness-a-move",
      path: "/art/characters/demoness-a/move.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: true,
      originX: 0.5,
      originY: 0.58
    },
    {
      key: "demoness-a-attack",
      path: "/art/characters/demoness-a/attack.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: false,
      originX: 0.5,
      originY: 0.58,
      attackContactFrame: 5,
      releaseFrame: 5
    },
    {
      key: "demoness-a-hurt",
      path: "/art/characters/demoness-a/hurt.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100
      ],
      loop: false,
      originX: 0.5,
      originY: 0.58
    },
    {
      key: "demoness-a-death",
      path: "/art/characters/demoness-a/death.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        600
      ],
      loop: false,
      originX: 0.5,
      originY: 0.58
    },
    {
      key: "demoness-b-idle",
      path: "/art/characters/demoness-b/idle.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: true,
      originX: 0.5,
      originY: 0.59
    },
    {
      key: "demoness-b-move",
      path: "/art/characters/demoness-b/move.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: true,
      originX: 0.5,
      originY: 0.59
    },
    {
      key: "demoness-b-attack",
      path: "/art/characters/demoness-b/attack.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: false,
      originX: 0.5,
      originY: 0.59,
      attackContactFrame: 5,
      releaseFrame: 5
    },
    {
      key: "demoness-b-hurt",
      path: "/art/characters/demoness-b/hurt.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100
      ],
      loop: false,
      originX: 0.5,
      originY: 0.59
    },
    {
      key: "demoness-b-death",
      path: "/art/characters/demoness-b/death.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        600
      ],
      loop: false,
      originX: 0.5,
      originY: 0.59
    },
    {
      key: "elite-orc-idle",
      path: "/art/characters/elite-orc/idle.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: true,
      originX: 0.5,
      originY: 0.57
    },
    {
      key: "elite-orc-move",
      path: "/art/characters/elite-orc/move.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: true,
      originX: 0.5,
      originY: 0.57
    },
    {
      key: "elite-orc-attack",
      path: "/art/characters/elite-orc/attack.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: false,
      originX: 0.5,
      originY: 0.57,
      attackContactFrame: 3,
      releaseFrame: 3
    },
    {
      key: "elite-orc-hurt",
      path: "/art/characters/elite-orc/hurt.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100
      ],
      loop: false,
      originX: 0.5,
      originY: 0.57
    },
    {
      key: "elite-orc-death",
      path: "/art/characters/elite-orc/death.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        600
      ],
      loop: false,
      originX: 0.5,
      originY: 0.57
    },
    {
      key: "eyeball-monster-idle",
      path: "/art/characters/eyeball-monster/idle.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: true,
      originX: 0.5,
      originY: 0.58
    },
    {
      key: "eyeball-monster-move",
      path: "/art/characters/eyeball-monster/move.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: true,
      originX: 0.5,
      originY: 0.58
    },
    {
      key: "eyeball-monster-attack",
      path: "/art/characters/eyeball-monster/attack.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: false,
      originX: 0.5,
      originY: 0.58,
      attackContactFrame: 6,
      releaseFrame: 6
    },
    {
      key: "eyeball-monster-hurt",
      path: "/art/characters/eyeball-monster/hurt.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100
      ],
      loop: false,
      originX: 0.5,
      originY: 0.58
    },
    {
      key: "eyeball-monster-death",
      path: "/art/characters/eyeball-monster/death.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        600
      ],
      loop: false,
      originX: 0.5,
      originY: 0.58
    },
    {
      key: "flame-golem-idle",
      path: "/art/characters/flame-golem/idle.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: true,
      originX: 0.5,
      originY: 0.57
    },
    {
      key: "flame-golem-move",
      path: "/art/characters/flame-golem/move.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100,
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: true,
      originX: 0.5,
      originY: 0.57
    },
    {
      key: "flame-golem-attack",
      path: "/art/characters/flame-golem/attack.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: false,
      originX: 0.5,
      originY: 0.57,
      attackContactFrame: 6,
      releaseFrame: 6
    },
    {
      key: "flame-golem-hurt",
      path: "/art/characters/flame-golem/hurt.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100
      ],
      loop: false,
      originX: 0.5,
      originY: 0.57
    },
    {
      key: "flame-golem-death",
      path: "/art/characters/flame-golem/death.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        600
      ],
      loop: false,
      originX: 0.5,
      originY: 0.57
    },
    {
      key: "ghostfire-idle",
      path: "/art/characters/ghostfire/idle.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: true,
      originX: 0.5,
      originY: 0.6
    },
    {
      key: "ghostfire-move",
      path: "/art/characters/ghostfire/move.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: true,
      originX: 0.5,
      originY: 0.6
    },
    {
      key: "ghostfire-attack",
      path: "/art/characters/ghostfire/attack.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: false,
      originX: 0.5,
      originY: 0.6,
      attackContactFrame: 3,
      releaseFrame: 3
    },
    {
      key: "ghostfire-hurt",
      path: "/art/characters/ghostfire/hurt.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100
      ],
      loop: false,
      originX: 0.5,
      originY: 0.6
    },
    {
      key: "ghostfire-death",
      path: "/art/characters/ghostfire/death.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        600
      ],
      loop: false,
      originX: 0.5,
      originY: 0.6
    },
    {
      key: "greatsword-skeleton-idle",
      path: "/art/characters/greatsword-skeleton/idle.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: true,
      originX: 0.5,
      originY: 0.57
    },
    {
      key: "greatsword-skeleton-move",
      path: "/art/characters/greatsword-skeleton/move.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: true,
      originX: 0.5,
      originY: 0.57
    },
    {
      key: "greatsword-skeleton-attack",
      path: "/art/characters/greatsword-skeleton/attack.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: false,
      originX: 0.5,
      originY: 0.57,
      attackContactFrame: 3,
      releaseFrame: 3
    },
    {
      key: "greatsword-skeleton-hurt",
      path: "/art/characters/greatsword-skeleton/hurt.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100
      ],
      loop: false,
      originX: 0.5,
      originY: 0.57
    },
    {
      key: "greatsword-skeleton-death",
      path: "/art/characters/greatsword-skeleton/death.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        600
      ],
      loop: false,
      originX: 0.5,
      originY: 0.57
    },
    {
      key: "hellbat-idle",
      path: "/art/characters/hellbat/idle.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: true,
      originX: 0.5,
      originY: 0.6
    },
    {
      key: "hellbat-move",
      path: "/art/characters/hellbat/move.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: true,
      originX: 0.5,
      originY: 0.6
    },
    {
      key: "hellbat-attack",
      path: "/art/characters/hellbat/attack.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: false,
      originX: 0.5,
      originY: 0.6,
      attackContactFrame: 3,
      releaseFrame: 3
    },
    {
      key: "hellbat-hurt",
      path: "/art/characters/hellbat/hurt.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100
      ],
      loop: false,
      originX: 0.5,
      originY: 0.6
    },
    {
      key: "hellbat-death",
      path: "/art/characters/hellbat/death.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        600
      ],
      loop: false,
      originX: 0.5,
      originY: 0.6
    },
    {
      key: "hellhound-idle",
      path: "/art/characters/hellhound/idle.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: true,
      originX: 0.5,
      originY: 0.57
    },
    {
      key: "hellhound-move",
      path: "/art/characters/hellhound/move.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: true,
      originX: 0.5,
      originY: 0.57
    },
    {
      key: "hellhound-attack",
      path: "/art/characters/hellhound/attack.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: false,
      originX: 0.5,
      originY: 0.57,
      attackContactFrame: 5,
      releaseFrame: 5
    },
    {
      key: "hellhound-hurt",
      path: "/art/characters/hellhound/hurt.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100
      ],
      loop: false,
      originX: 0.5,
      originY: 0.57
    },
    {
      key: "hellhound-death",
      path: "/art/characters/hellhound/death.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        600
      ],
      loop: false,
      originX: 0.5,
      originY: 0.57
    },
    {
      key: "knight-idle",
      path: "/art/characters/knight/idle.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: true,
      originX: 0.5,
      originY: 0.57
    },
    {
      key: "knight-move",
      path: "/art/characters/knight/move.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: true,
      originX: 0.5,
      originY: 0.57
    },
    {
      key: "knight-attack",
      path: "/art/characters/knight/attack.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: false,
      originX: 0.5,
      originY: 0.57,
      attackContactFrame: 3,
      releaseFrame: 3,
      projectileOffset: {
        x: 14,
        y: -9
      }
    },
    {
      key: "knight-hurt",
      path: "/art/characters/knight/hurt.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100
      ],
      loop: false,
      originX: 0.5,
      originY: 0.57
    },
    {
      key: "knight-death",
      path: "/art/characters/knight/death.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        600
      ],
      loop: false,
      originX: 0.5,
      originY: 0.57
    },
    {
      key: "knight-templar-idle",
      path: "/art/characters/knight-templar/idle.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: true,
      originX: 0.5,
      originY: 0.57
    },
    {
      key: "knight-templar-move",
      path: "/art/characters/knight-templar/move.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: true,
      originX: 0.5,
      originY: 0.57
    },
    {
      key: "knight-templar-attack",
      path: "/art/characters/knight-templar/attack.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: false,
      originX: 0.5,
      originY: 0.57,
      attackContactFrame: 4,
      releaseFrame: 4,
      projectileOffset: {
        x: 18,
        y: -9
      }
    },
    {
      key: "knight-templar-hurt",
      path: "/art/characters/knight-templar/hurt.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100
      ],
      loop: false,
      originX: 0.5,
      originY: 0.57
    },
    {
      key: "knight-templar-death",
      path: "/art/characters/knight-templar/death.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        600
      ],
      loop: false,
      originX: 0.5,
      originY: 0.57
    },
    {
      key: "lancer-idle",
      path: "/art/characters/lancer/idle.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: true,
      originX: 0.5,
      originY: 0.57
    },
    {
      key: "lancer-move",
      path: "/art/characters/lancer/move.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: true,
      originX: 0.5,
      originY: 0.57
    },
    {
      key: "lancer-attack",
      path: "/art/characters/lancer/attack.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: false,
      originX: 0.5,
      originY: 0.57,
      attackContactFrame: 3,
      releaseFrame: 3,
      projectileOffset: {
        x: 20,
        y: -9
      }
    },
    {
      key: "lancer-hurt",
      path: "/art/characters/lancer/hurt.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100
      ],
      loop: false,
      originX: 0.5,
      originY: 0.57
    },
    {
      key: "lancer-death",
      path: "/art/characters/lancer/death.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        600
      ],
      loop: false,
      originX: 0.5,
      originY: 0.57
    },
    {
      key: "lava-slime-idle",
      path: "/art/characters/lava-slime/idle.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: true,
      originX: 0.5,
      originY: 0.57
    },
    {
      key: "lava-slime-move",
      path: "/art/characters/lava-slime/move.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: true,
      originX: 0.5,
      originY: 0.57
    },
    {
      key: "lava-slime-attack",
      path: "/art/characters/lava-slime/attack.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: false,
      originX: 0.5,
      originY: 0.57,
      attackContactFrame: 3,
      releaseFrame: 3
    },
    {
      key: "lava-slime-hurt",
      path: "/art/characters/lava-slime/hurt.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100
      ],
      loop: false,
      originX: 0.5,
      originY: 0.57
    },
    {
      key: "lava-slime-death",
      path: "/art/characters/lava-slime/death.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        600
      ],
      loop: false,
      originX: 0.5,
      originY: 0.57
    },
    {
      key: "minotaur-idle",
      path: "/art/characters/minotaur/idle.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: true,
      originX: 0.5,
      originY: 0.59
    },
    {
      key: "minotaur-move",
      path: "/art/characters/minotaur/move.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: true,
      originX: 0.5,
      originY: 0.59
    },
    {
      key: "minotaur-attack",
      path: "/art/characters/minotaur/attack.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: false,
      originX: 0.5,
      originY: 0.59,
      attackContactFrame: 5,
      releaseFrame: 5
    },
    {
      key: "minotaur-hurt",
      path: "/art/characters/minotaur/hurt.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100
      ],
      loop: false,
      originX: 0.5,
      originY: 0.59
    },
    {
      key: "minotaur-death",
      path: "/art/characters/minotaur/death.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        600
      ],
      loop: false,
      originX: 0.5,
      originY: 0.59
    },
    {
      key: "necromancer-idle",
      path: "/art/characters/necromancer/idle.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: true,
      originX: 0.5,
      originY: 0.61
    },
    {
      key: "necromancer-move",
      path: "/art/characters/necromancer/move.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: true,
      originX: 0.5,
      originY: 0.61
    },
    {
      key: "necromancer-attack",
      path: "/art/characters/necromancer/attack.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: false,
      originX: 0.5,
      originY: 0.61,
      attackContactFrame: 5,
      releaseFrame: 5
    },
    {
      key: "necromancer-hurt",
      path: "/art/characters/necromancer/hurt.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100
      ],
      loop: false,
      originX: 0.5,
      originY: 0.61
    },
    {
      key: "necromancer-death",
      path: "/art/characters/necromancer/death.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100,
        100,
        100,
        600
      ],
      loop: false,
      originX: 0.5,
      originY: 0.61
    },
    {
      key: "orc-idle",
      path: "/art/characters/orc/idle.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: true,
      originX: 0.5,
      originY: 0.57
    },
    {
      key: "orc-move",
      path: "/art/characters/orc/move.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: true,
      originX: 0.5,
      originY: 0.57
    },
    {
      key: "orc-attack",
      path: "/art/characters/orc/attack.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: false,
      originX: 0.5,
      originY: 0.57,
      attackContactFrame: 3,
      releaseFrame: 3
    },
    {
      key: "orc-hurt",
      path: "/art/characters/orc/hurt.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100
      ],
      loop: false,
      originX: 0.5,
      originY: 0.57
    },
    {
      key: "orc-death",
      path: "/art/characters/orc/death.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        600
      ],
      loop: false,
      originX: 0.5,
      originY: 0.57
    },
    {
      key: "orc-rider-idle",
      path: "/art/characters/orc-rider/idle.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: true,
      originX: 0.5,
      originY: 0.57
    },
    {
      key: "orc-rider-move",
      path: "/art/characters/orc-rider/move.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: true,
      originX: 0.5,
      originY: 0.57
    },
    {
      key: "orc-rider-attack",
      path: "/art/characters/orc-rider/attack.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: false,
      originX: 0.5,
      originY: 0.57,
      attackContactFrame: 4,
      releaseFrame: 4
    },
    {
      key: "orc-rider-hurt",
      path: "/art/characters/orc-rider/hurt.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100
      ],
      loop: false,
      originX: 0.5,
      originY: 0.57
    },
    {
      key: "orc-rider-death",
      path: "/art/characters/orc-rider/death.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        600
      ],
      loop: false,
      originX: 0.5,
      originY: 0.57
    },
    {
      key: "priest-idle",
      path: "/art/characters/priest/idle.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: true,
      originX: 0.5,
      originY: 0.58
    },
    {
      key: "priest-move",
      path: "/art/characters/priest/move.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: true,
      originX: 0.5,
      originY: 0.58
    },
    {
      key: "priest-attack",
      path: "/art/characters/priest/attack.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: false,
      originX: 0.5,
      originY: 0.58,
      attackContactFrame: 4,
      releaseFrame: 4,
      projectileOffset: {
        x: 13,
        y: -12
      }
    },
    {
      key: "priest-hurt",
      path: "/art/characters/priest/hurt.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100
      ],
      loop: false,
      originX: 0.5,
      originY: 0.58
    },
    {
      key: "priest-death",
      path: "/art/characters/priest/death.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        600
      ],
      loop: false,
      originX: 0.5,
      originY: 0.58
    },
    {
      key: "skeleton-idle",
      path: "/art/characters/skeleton/idle.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: true,
      originX: 0.5,
      originY: 0.57
    },
    {
      key: "skeleton-move",
      path: "/art/characters/skeleton/move.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: true,
      originX: 0.5,
      originY: 0.57
    },
    {
      key: "skeleton-attack",
      path: "/art/characters/skeleton/attack.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: false,
      originX: 0.5,
      originY: 0.57,
      attackContactFrame: 3,
      releaseFrame: 3
    },
    {
      key: "skeleton-hurt",
      path: "/art/characters/skeleton/hurt.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100
      ],
      loop: false,
      originX: 0.5,
      originY: 0.57
    },
    {
      key: "skeleton-death",
      path: "/art/characters/skeleton/death.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        600
      ],
      loop: false,
      originX: 0.5,
      originY: 0.57
    },
    {
      key: "skeleton-archer-idle",
      path: "/art/characters/skeleton-archer/idle.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: true,
      originX: 0.5,
      originY: 0.59
    },
    {
      key: "skeleton-archer-move",
      path: "/art/characters/skeleton-archer/move.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: true,
      originX: 0.5,
      originY: 0.59
    },
    {
      key: "skeleton-archer-attack",
      path: "/art/characters/skeleton-archer/attack.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: false,
      originX: 0.5,
      originY: 0.59,
      attackContactFrame: 6,
      releaseFrame: 6
    },
    {
      key: "skeleton-archer-hurt",
      path: "/art/characters/skeleton-archer/hurt.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100
      ],
      loop: false,
      originX: 0.5,
      originY: 0.59
    },
    {
      key: "skeleton-archer-death",
      path: "/art/characters/skeleton-archer/death.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        600
      ],
      loop: false,
      originX: 0.5,
      originY: 0.59
    },
    {
      key: "slime-idle",
      path: "/art/characters/slime/idle.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: true,
      originX: 0.5,
      originY: 0.57
    },
    {
      key: "slime-move",
      path: "/art/characters/slime/move.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: true,
      originX: 0.5,
      originY: 0.57
    },
    {
      key: "slime-attack",
      path: "/art/characters/slime/attack.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: false,
      originX: 0.5,
      originY: 0.57,
      attackContactFrame: 3,
      releaseFrame: 3
    },
    {
      key: "slime-hurt",
      path: "/art/characters/slime/hurt.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100
      ],
      loop: false,
      originX: 0.5,
      originY: 0.57
    },
    {
      key: "slime-death",
      path: "/art/characters/slime/death.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        600
      ],
      loop: false,
      originX: 0.5,
      originY: 0.57
    },
    {
      key: "soldier-idle",
      path: "/art/characters/soldier/idle.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: true,
      originX: 0.5,
      originY: 0.6
    },
    {
      key: "soldier-move",
      path: "/art/characters/soldier/move.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: true,
      originX: 0.5,
      originY: 0.6
    },
    {
      key: "soldier-attack",
      path: "/art/characters/soldier/attack.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: false,
      originX: 0.5,
      originY: 0.6,
      attackContactFrame: 7,
      releaseFrame: 7,
      projectileOffset: {
        x: 8,
        y: -10
      }
    },
    {
      key: "soldier-hurt",
      path: "/art/characters/soldier/hurt.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100
      ],
      loop: false,
      originX: 0.5,
      originY: 0.6
    },
    {
      key: "soldier-death",
      path: "/art/characters/soldier/death.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        600
      ],
      loop: false,
      originX: 0.5,
      originY: 0.6
    },
    {
      key: "swordsman-idle",
      path: "/art/characters/swordsman/idle.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: true,
      originX: 0.5,
      originY: 0.6
    },
    {
      key: "swordsman-move",
      path: "/art/characters/swordsman/move.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: true,
      originX: 0.5,
      originY: 0.6
    },
    {
      key: "swordsman-attack",
      path: "/art/characters/swordsman/attack.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: false,
      originX: 0.5,
      originY: 0.6,
      attackContactFrame: 3,
      releaseFrame: 3,
      projectileOffset: {
        x: 14,
        y: -9
      }
    },
    {
      key: "swordsman-hurt",
      path: "/art/characters/swordsman/hurt.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100
      ],
      loop: false,
      originX: 0.5,
      originY: 0.6
    },
    {
      key: "swordsman-death",
      path: "/art/characters/swordsman/death.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        600
      ],
      loop: false,
      originX: 0.5,
      originY: 0.6
    },
    {
      key: "warlock-idle",
      path: "/art/characters/warlock/idle.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: true,
      originX: 0.5,
      originY: 0.58
    },
    {
      key: "warlock-move",
      path: "/art/characters/warlock/move.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: true,
      originX: 0.5,
      originY: 0.58
    },
    {
      key: "warlock-attack",
      path: "/art/characters/warlock/attack.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: false,
      originX: 0.5,
      originY: 0.58,
      attackContactFrame: 4,
      releaseFrame: 4
    },
    {
      key: "warlock-hurt",
      path: "/art/characters/warlock/hurt.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100
      ],
      loop: false,
      originX: 0.5,
      originY: 0.58
    },
    {
      key: "warlock-death",
      path: "/art/characters/warlock/death.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100,
        100,
        100,
        100,
        100,
        600
      ],
      loop: false,
      originX: 0.5,
      originY: 0.58
    },
    {
      key: "werebear-idle",
      path: "/art/characters/werebear/idle.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: true,
      originX: 0.5,
      originY: 0.57
    },
    {
      key: "werebear-move",
      path: "/art/characters/werebear/move.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: true,
      originX: 0.5,
      originY: 0.57
    },
    {
      key: "werebear-attack",
      path: "/art/characters/werebear/attack.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: false,
      originX: 0.5,
      originY: 0.57,
      attackContactFrame: 5,
      releaseFrame: 5
    },
    {
      key: "werebear-hurt",
      path: "/art/characters/werebear/hurt.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100
      ],
      loop: false,
      originX: 0.5,
      originY: 0.57
    },
    {
      key: "werebear-death",
      path: "/art/characters/werebear/death.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        600
      ],
      loop: false,
      originX: 0.5,
      originY: 0.57
    },
    {
      key: "werewolf-idle",
      path: "/art/characters/werewolf/idle.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: true,
      originX: 0.5,
      originY: 0.57
    },
    {
      key: "werewolf-move",
      path: "/art/characters/werewolf/move.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: true,
      originX: 0.5,
      originY: 0.57
    },
    {
      key: "werewolf-attack",
      path: "/art/characters/werewolf/attack.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: false,
      originX: 0.5,
      originY: 0.57,
      attackContactFrame: 5,
      releaseFrame: 5
    },
    {
      key: "werewolf-hurt",
      path: "/art/characters/werewolf/hurt.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100
      ],
      loop: false,
      originX: 0.5,
      originY: 0.57
    },
    {
      key: "werewolf-death",
      path: "/art/characters/werewolf/death.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        600
      ],
      loop: false,
      originX: 0.5,
      originY: 0.57
    },
    {
      key: "wizard-idle",
      path: "/art/characters/wizard/idle.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: true,
      originX: 0.5,
      originY: 0.58
    },
    {
      key: "wizard-move",
      path: "/art/characters/wizard/move.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: true,
      originX: 0.5,
      originY: 0.58
    },
    {
      key: "wizard-attack",
      path: "/art/characters/wizard/attack.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100,
        100,
        100
      ],
      loop: false,
      originX: 0.5,
      originY: 0.58,
      attackContactFrame: 2,
      releaseFrame: 2,
      projectileOffset: {
        x: 12,
        y: -12
      }
    },
    {
      key: "wizard-hurt",
      path: "/art/characters/wizard/hurt.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        100
      ],
      loop: false,
      originX: 0.5,
      originY: 0.58
    },
    {
      key: "wizard-death",
      path: "/art/characters/wizard/death.png",
      size: 100,
      durations: [
        100,
        100,
        100,
        600
      ],
      loop: false,
      originX: 0.5,
      originY: 0.58
    }
  ]
};

// src/game/characterCatalog.ts
var CHARACTER_DISPLAY_MULTIPLIER = 0.85;
var CHARACTERS = characterCatalog_generated_default.characters.map((character) => ({
  ...character,
  displayScale: character.displayScale * CHARACTER_DISPLAY_MULTIPLIER
}));
var HERO_CHARACTERS = CHARACTERS.filter((character) => character.faction === "hero");
var ENEMY_CHARACTERS = CHARACTERS.filter((character) => character.faction === "enemy");
var byId = new Map(CHARACTERS.map((character) => [character.id, character]));
var defaultHero = HERO_CHARACTERS.find((character) => character.id === "soldier") ?? HERO_CHARACTERS[0];
var enemyPools = {
  normal: ENEMY_CHARACTERS.filter((character) => character.enemyKind === "normal"),
  runner: ENEMY_CHARACTERS.filter((character) => character.enemyKind === "runner"),
  armored: ENEMY_CHARACTERS.filter((character) => character.enemyKind === "armored"),
  tank: ENEMY_CHARACTERS.filter((character) => character.enemyKind === "tank")
};
function getHeroCharacter(id) {
  const character = id ? byId.get(id) : void 0;
  return character?.faction === "hero" ? character : defaultHero;
}
function getEnemyCharacters(kind) {
  return enemyPools[kind];
}
function getEnemyCharacter(id, kind) {
  const character = id ? byId.get(id) : void 0;
  if (character?.faction === "enemy" && (!kind || character.enemyKind === kind)) return character;
  return enemyPools[kind ?? "normal"][0];
}

// src/game/heroSkills.ts
var HERO_SKILLS = [
  {
    id: "piercing-arrow",
    heroId: "archer",
    name: "T\xEAn \u0111\u1EA9y l\xF9i",
    threshold: 6,
    color: "#b9e49a",
    attackStyle: "arrow",
    visualKind: "pierce",
    tactics: "Gi\u1EEF xa m\u1EE5c ti\xEAu \u0111\u1EC3 t\xEAn \u0111\u1EA9y l\xF9i m\u1EA1nh g\u1EA5p \u0111\xF4i.",
    description: "\u0110\u1EA9y l\xF9i m\u1EE5c ti\xEAu \u0111\u1EC3 gi\u1EEF kho\u1EA3ng c\xE1ch. Kh\xF4ng t\xE1c \u0111\u1ED9ng l\xEAn Boss.",
    effect: { kind: "push-target", distance: 28 }
  },
  {
    id: "axe-shockwave",
    heroId: "armored-axeman",
    name: "Ch\u1EA5n \u0111\u1ED9ng r\xECu",
    threshold: 10,
    color: "#f4bd73",
    attackStyle: "axe",
    visualKind: "shockwave",
    tactics: "\xC1p s\xE1t \u0111\u1EC3 ch\u1EA5n \u0111\u1ED9ng r\u1ED9ng quanh m\xECnh, l\xE0m qu\xE1i kh\u1EF1ng 0,9 gi\xE2y.",
    description: "L\xE0m kh\u1EF1ng qu\xE1i quanh m\u1EE5c ti\xEAu trong 0,6 gi\xE2y. Boss mi\u1EC5n nhi\u1EC5m.",
    effect: { kind: "stun-area", radius: 150, duration: 600 }
  },
  {
    id: "knight-guard",
    heroId: "knight",
    name: "Khi\xEAn th\xE9p",
    threshold: 10,
    color: "#acc8f0",
    attackStyle: "sword",
    visualKind: "guard",
    tactics: "Khi c\xF2n khi\xEAn, ti\u1EBFn v\u1EC1 m\u1EE5c ti\xEAu nhanh h\u01A1n 25%; ch\u1EE7 \u0111\u1ED9ng ch\u1EAFn \u0111\xF2n r\u1ED3i r\xFAt.",
    description: "Ch\u1EB7n ho\xE0n to\xE0n m\u1ED9t \u0111\xF2n \u0111\xE1nh trong 8 gi\xE2y. Khi\xEAn kh\xF4ng c\u1ED9ng d\u1ED3n.",
    effect: { kind: "guard", duration: 8e3 }
  },
  {
    id: "holy-sanctuary",
    heroId: "knight-templar",
    name: "V\xF9ng th\xE1nh b\u1EA3o h\u1ED9",
    threshold: 12,
    color: "#ffe3a0",
    attackStyle: "holy-spear",
    visualKind: "sanctuary",
    tactics: "\u0110\u1EE9ng trong v\xF9ng s\xE1ng t\u1EA1i ch\u1ED7 k\xEDch ho\u1EA1t \u0111\u1EC3 gi\u1EEF gi\u1EA3m s\xE1t th\u01B0\u01A1ng.",
    description: "Gi\u1EA3m 35% s\xE1t th\u01B0\u01A1ng nh\u1EADn v\xE0o trong 3 gi\xE2y.",
    effect: { kind: "ward", duration: 3e3, reduction: 0.35 }
  },
  {
    id: "lance-drive",
    heroId: "lancer",
    name: "Th\u01B0\u01A1ng ph\xE1 tr\u1EADn",
    threshold: 8,
    color: "#d0e8e5",
    attackStyle: "spear",
    visualKind: "lance",
    tactics: "Canh qu\xE1i c\xF9ng m\u1ED9t ph\xEDa; \u0111\xE1nh \u1EDF \u0111\u1EA7u t\u1EA7m th\u01B0\u01A1ng \u0111\u1EC3 t\u0103ng l\u1EF1c \u0111\u1EA9y c\u1EA3 tuy\u1EBFn.",
    description: "\u0110\u1EA9y l\xF9i m\u1EA1nh c\xE1c qu\xE1i tr\xEAn \u0111\u01B0\u1EDDng t\u1EDBi m\u1EE5c ti\xEAu. Kh\xF4ng \u0111\u1EA9y Boss.",
    effect: { kind: "push-line", distance: 60 }
  },
  {
    id: "restoring-light",
    heroId: "priest",
    name: "\xC1nh s\xE1ng h\u1ED3i ph\u1EE5c",
    threshold: 12,
    color: "#b8efd3",
    attackStyle: "holy-light",
    visualKind: "heal",
    tactics: "\u0110\u1EE9ng y\xEAn \xEDt nh\u1EA5t m\u1ED9t gi\xE2y tr\u01B0\u1EDBc khi \u0111\u1EE7 n\u0103ng l\u01B0\u1EE3ng \u0111\u1EC3 h\u1ED3i 8HP thay v\xEC 5HP.",
    description: "H\u1ED3i 5 HP, t\u1ED1i \u0111a 100 HP.",
    effect: { kind: "heal", amount: 5 }
  },
  {
    id: "pinning-volley",
    heroId: "soldier",
    name: "Lo\u1EA1t t\xEAn gh\xECm ch\xE2n",
    threshold: 8,
    color: "#edce8f",
    attackStyle: "volley",
    visualKind: "volley",
    tactics: "V\u1EEBa l\xF9i kh\u1ECFi m\u1EE5c ti\xEAu v\u1EEBa g\xF5 \u0111\u1EC3 gi\u1EEF hi\u1EC7u \u1EE9ng ch\u1EADm ba gi\xE2y thay v\xEC hai.",
    description: "Gi\u1EA3m 55% t\u1ED1c \u0111\u1ED9 di chuy\u1EC3n c\u1EE7a m\u1EE5c ti\xEAu trong 2 gi\xE2y. Boss mi\u1EC5n nhi\u1EC5m.",
    effect: { kind: "slow", duration: 2e3, factor: 0.45 }
  },
  {
    id: "sword-repulse",
    heroId: "swordsman",
    name: "V\xF2ng ki\u1EBFm ph\u1EA3n k\xEDch",
    threshold: 8,
    color: "#d7d8ff",
    attackStyle: "blade",
    visualKind: "repel",
    tactics: "\u0110\u1EE3i qu\xE1i \xE1p s\xE1t hai ph\xEDa; \u0111\u1EA9y tr\xFAng cho th\xEAm 40% t\u1ED1c \u0111\u1ED9 r\xFAt lui trong 0,9 gi\xE2y.",
    description: "Vung ki\u1EBFm \u0111\u1EA9y l\xF9i c\xE1c qu\xE1i \u1EDF g\u1EA7n b\u1EA1n. Kh\xF4ng \u0111\u1EA9y Boss.",
    effect: { kind: "repel", radius: 160, distance: 42 }
  },
  {
    id: "arcane-frost",
    heroId: "wizard",
    name: "V\xF2ng b\u0103ng",
    threshold: 12,
    color: "#9ce3f2",
    attackStyle: "arcane",
    visualKind: "frost",
    tactics: "Ni\u1EC7m ph\xE9p t\u1EEB xa \u0111\u1EC3 m\u1EDF r\u1ED9ng v\xF9ng b\u0103ng v\xE0 gi\u1EEF qu\xE1i 1,2 gi\xE2y.",
    description: "\u0110\xF3ng b\u0103ng qu\xE1i quanh m\u1EE5c ti\xEAu trong 1 gi\xE2y. Boss mi\u1EC5n nhi\u1EC5m.",
    effect: { kind: "freeze-area", radius: 150, duration: 1e3 }
  }
];
var byHero = new Map(HERO_SKILLS.map((skill) => [skill.heroId, skill]));
function getHeroSkill(heroId) {
  return byHero.get(heroId ?? "soldier") ?? byHero.get("soldier");
}

// src/game/tacticalRules.ts
var MAX_ENEMIES = 6;
var CHARGE_RADIUS = 70;
var RANGED_RADIUS = 62;
var BARREL_RADIUS = 220;
var HEAL_DWELL_MS = 2e3;
var MOMENTUM_LIFETIME = 15e3;
function createWorldObjects() {
  return [
    ...[1050, 2330, 3610, 4890, 5900].map((x, index) => ({ id: index + 1, kind: "barrel", x, radius: BARREL_RADIUS, state: "idle", charges: 1, progress: 0 })),
    ...[1550, 3450, 5350].map((x, index) => ({ id: index + 11, kind: "gate", x, radius: 100, state: "open", charges: 0, progress: 0 })),
    ...[2050, 4200].map((x, index) => ({ id: index + 21, kind: "healing-zone", x, radius: 90, state: "active", charges: 3, progress: 0 }))
  ];
}
var insideLane = (x, from, to, radius) => x >= Math.min(from, to) - radius && x <= Math.max(from, to) + radius;
function clipAtGate(from, to, objects) {
  let result = to;
  for (const object of objects) {
    if (object.kind !== "gate" || object.state !== "closed" || from === object.x) continue;
    if (from < object.x && result >= object.x) result = object.x - 4;
    if (from > object.x && result <= object.x) result = object.x + 4;
  }
  return result;
}
function shieldsFollowers(enemy) {
  return enemy.kind === "tank" || enemy.role === "shield" && enemy.hp > 1;
}

// src/game/heroCombat.ts
var MELEE = /* @__PURE__ */ new Set(["armored-axeman", "knight", "knight-templar", "lancer", "swordsman"]);
var SPEARS = /* @__PURE__ */ new Set(["knight-templar", "lancer"]);
function getHeroCombat(heroId) {
  return MELEE.has(heroId ?? "") ? { class: "melee", maxHp: 150, range: SPEARS.has(heroId ?? "") ? 160 : 120 } : { class: "ranged", maxHp: 100, range: 1e4 };
}
function attackReach(heroId, targetKind) {
  const profile = getHeroCombat(heroId);
  return profile.range + (profile.class === "melee" && targetKind === "tank" ? 100 : 0);
}
var MELEE_LETTER_INTERVAL = 70;

// src/game/partyState.ts
function createActorState(heroId, x) {
  return {
    playerX: x,
    targetId: null,
    hp: getHeroCombat(heroId).maxHp,
    movement: 0,
    input: "",
    jamUntil: 0,
    boostUntil: 0,
    heroId,
    heroCharge: 0,
    heroActiveUntil: 0,
    heroGuardUntil: 0,
    heroWardUntil: 0,
    lastPlayerHurt: -Infinity,
    lastMovedAt: 0,
    dashUntil: 0,
    wardX: x,
    inventory: { health: 1, freeze: 1, damage: 1, shield: 1 },
    momentum: 0,
    momentumStreak: 0,
    momentumUntil: 0,
    healingProgress: /* @__PURE__ */ new Map(),
    queuedLetters: [],
    queuedChallengeId: null,
    approachTargetId: null,
    nextMeleeShotAt: 0,
    combatPaused: false
  };
}

// src/game/engine.ts
var PLAYER_X = 640;
var PLAYER_SPEED = 160;
var PLAYER_BOUNDS = { min: 240, max: WORLD_WIDTH - 240 };
var BOSS_SLAM_RANGE = 300;
var JAM_MS = 300;
var STUN_MS = { normal: 300, runner: 300, armored: 300, tank: 0 };
var ENEMY_SPEED = { normal: 14, runner: 33, armored: 10, tank: 7 };
var KINDS = ["scramble", "missing", "translate", "hint"];
function canTargetEnemy(enemies, candidate, playerX = PLAYER_X) {
  return candidate.state === "alive" && !enemies.some((enemy) => shieldsFollowers(enemy) && enemy.id !== candidate.id && Math.sign(enemy.x - playerX) === Math.sign(candidate.x - playerX) && Math.abs(enemy.x - playerX) < Math.abs(candidate.x - playerX));
}
var GameEngine = class {
  constructor(random = Math.random, progress, onWordSeen, bank = WORDS) {
    this.random = random;
    this.onWordSeen = onWordSeen;
    this.deck = new WordDeck(bank, random);
    if (progress) this.setProgress(progress);
  }
  random;
  onWordSeen;
  clock = 0;
  playerX = PLAYER_X;
  enemies = [];
  targetId = null;
  worldObjects = [];
  phase = "menu";
  movement = 0;
  hp = 100;
  score = 0;
  combo = 0;
  bestCombo = 0;
  kills = 0;
  words = 0;
  bossKills = 0;
  input = "";
  jamUntil = 0;
  countdown = 0;
  freezeUntil = 0;
  boostUntil = 0;
  heroId = "soldier";
  heroCharge = 0;
  heroActiveUntil = 0;
  heroGuardUntil = 0;
  heroWardUntil = 0;
  nextSpawn = 0;
  nextBoss = 9e4;
  inventory = { health: 1, freeze: 1, damage: 1, shield: 1 };
  notice = "";
  noticeUntil = 0;
  summary = null;
  events = [];
  projectiles = [];
  results = /* @__PURE__ */ new Map();
  bornAt = /* @__PURE__ */ new Map();
  revealed = /* @__PURE__ */ new Map();
  finalUntil = /* @__PURE__ */ new Map();
  deck;
  reservations = /* @__PURE__ */ new Map();
  lastSeenSource;
  lastResultsSource;
  correctLetters = 0;
  correctKeys = 0;
  wrongKeys = 0;
  enemySequence = 0;
  // Independent of gameplay RNG and retained across retries so every skin gets its turn.
  appearanceSequence = { normal: 0, runner: 0, armored: 0, tank: 0 };
  challengeSequence = 0;
  shotSequence = 0;
  runSequence = 0;
  lastPlayerHurt = -Infinity;
  momentum = 0;
  momentumStreak = 0;
  momentumUntil = 0;
  lastMovedAt = 0;
  dashUntil = 0;
  wardX = PLAYER_X;
  nextFormationAt = 12e3;
  formationSequence = 0;
  party = /* @__PURE__ */ new Map();
  retiredActors = /* @__PURE__ */ new Map();
  actorId = null;
  claims = /* @__PURE__ */ new Map();
  healingProgress = /* @__PURE__ */ new Map();
  spawnActorSequence = 0;
  queuedLetters = [];
  queuedChallengeId = null;
  approachTargetId = null;
  nextMeleeShotAt = 0;
  combatPaused = false;
  captureActor() {
    return {
      playerX: this.playerX,
      targetId: this.targetId,
      hp: this.hp,
      movement: this.movement,
      input: this.input,
      jamUntil: this.jamUntil,
      boostUntil: this.boostUntil,
      heroId: this.heroId,
      heroCharge: this.heroCharge,
      heroActiveUntil: this.heroActiveUntil,
      heroGuardUntil: this.heroGuardUntil,
      heroWardUntil: this.heroWardUntil,
      lastPlayerHurt: this.lastPlayerHurt,
      lastMovedAt: this.lastMovedAt,
      dashUntil: this.dashUntil,
      wardX: this.wardX,
      inventory: this.inventory,
      momentum: this.momentum,
      momentumStreak: this.momentumStreak,
      momentumUntil: this.momentumUntil,
      healingProgress: this.healingProgress,
      queuedLetters: this.queuedLetters,
      queuedChallengeId: this.queuedChallengeId,
      approachTargetId: this.approachTargetId,
      nextMeleeShotAt: this.nextMeleeShotAt,
      combatPaused: this.combatPaused
    };
  }
  syncActor() {
    const actor = this.actorId ? this.party.get(this.actorId) ?? this.retiredActors.get(this.actorId) : void 0;
    if (actor) actor.state = this.captureActor();
  }
  asActor(id, action) {
    const actor = this.party.get(id) ?? this.retiredActors.get(id);
    if (!actor) throw new Error("Unknown party player");
    if (this.actorId === id) return action();
    const previous = this.actorId;
    this.syncActor();
    this.actorId = id;
    Object.assign(this, actor.state);
    try {
      return action();
    } finally {
      this.syncActor();
      this.actorId = previous;
      const restore = previous ? this.party.get(previous) ?? this.retiredActors.get(previous) : void 0;
      if (restore) Object.assign(this, restore.state);
    }
  }
  get players() {
    this.syncActor();
    return [...this.party.values()].map((actor) => ({
      ...actor.member,
      connected: actor.connected,
      x: actor.state.playerX,
      hp: actor.state.hp,
      maxHp: getHeroCombat(actor.member.heroId).maxHp,
      targetId: actor.state.targetId
    }));
  }
  configureParty(members) {
    if (this.phase !== "menu" && this.phase !== "over") throw new Error("Party can only change before a match");
    if (!members.length || members.length > 4 || new Set(members.map((member) => member.id)).size !== members.length || new Set(members.map((member) => member.heroId)).size !== members.length || members.some((member) => !member.id.trim() || getHeroCharacter(member.heroId).id !== member.heroId)) {
      throw new Error("Party requires one to four distinct players and heroes");
    }
    this.party.clear();
    this.retiredActors.clear();
    this.claims.clear();
    members.forEach((member, index) => this.party.set(member.id, {
      member: { ...member },
      connected: true,
      state: createActorState(member.heroId, PLAYER_X + (index - (members.length - 1) / 2) * 72)
    }));
    this.actorId = members[0].id;
    Object.assign(this, this.party.get(this.actorId).state);
  }
  commandAs(playerId, action) {
    const actor = this.party.get(playerId);
    this.syncActor();
    if (!actor || !actor.connected || actor.state.hp <= 0) return void 0;
    if (action.constructor.name === "AsyncFunction") throw new Error("Party commands must be synchronous");
    return this.asActor(playerId, () => {
      const result = action();
      if (result && typeof result.then === "function") throw new Error("Party commands must be synchronous");
      return result;
    });
  }
  snapshotFor(playerId) {
    if (!this.party.has(playerId)) throw new Error("Unknown party player");
    return this.asActor(playerId, () => this.snapshot());
  }
  setPartyConnected(playerId, connected) {
    const actor = this.party.get(playerId);
    if (!actor) return;
    this.asActor(playerId, () => {
      actor.connected = connected;
      this.movement = 0;
      this.input = "";
      this.chooseTarget(null);
      this.healingProgress.clear();
    });
  }
  removePartyPlayer(playerId) {
    const actor = this.party.get(playerId);
    if (!actor) return;
    this.setPartyConnected(playerId, false);
    this.syncActor();
    this.party.delete(playerId);
    if (this.projectiles.some((shot) => shot.ownerId === playerId)) this.retiredActors.set(playerId, actor);
    if (this.actorId === playerId) {
      this.actorId = this.party.keys().next().value ?? null;
      if (this.actorId) Object.assign(this, this.party.get(this.actorId).state);
    }
    if ((!this.party.size || this.players.every((player) => player.hp <= 0)) && this.phase === "playing") this.finishRun("defeat");
  }
  emit(...events) {
    this.events.push(...events.map((event) => this.actorId && !event.playerId ? { ...event, playerId: this.actorId } : event));
  }
  targetAvailable(id) {
    return !this.actorId || !this.claims.has(id) || this.claims.get(id) === this.actorId;
  }
  chooseTarget(id) {
    if (id !== this.targetId) {
      this.clearQueuedAttack();
      this.input = "";
    }
    if (this.actorId && this.targetId !== null && this.claims.get(this.targetId) === this.actorId) this.claims.delete(this.targetId);
    this.targetId = id !== null && this.targetAvailable(id) ? id : null;
    if (this.actorId && this.targetId !== null) this.claims.set(this.targetId, this.actorId);
  }
  forLivingActors(action, connectedOnly = false) {
    for (const player of this.players) {
      if (player.hp <= 0 || connectedOnly && player.connected === false) continue;
      this.asActor(player.id, action);
    }
  }
  enemyActor(enemy) {
    if (!this.party.size) return void 0;
    const living = this.players.filter((player) => player.hp > 0);
    const locked = living.find((player) => player.id === enemy.attackTargetPlayerId);
    if (enemy.attackUntil && locked) return locked.id;
    if (enemy.attackUntil && enemy.attackTargetPlayerId && !locked) enemy.attackUntil = 0;
    return living.sort((a, b) => Math.abs(a.x - enemy.x) - Math.abs(b.x - enemy.x))[0]?.id;
  }
  hurtArea(amount, enemy, inside) {
    if (!this.party.size) return inside(this.playerX) ? this.hurt(amount, enemy) : 0;
    let damage = 0;
    this.forLivingActors(() => {
      if (inside(this.playerX)) damage += this.hurt(amount, enemy);
    });
    return damage;
  }
  /** Refresh persisted learning history before the next run without recreating the renderer. */
  setProgress(progress) {
    if (progress.words !== this.lastResultsSource) {
      this.deck.addSeen(Object.keys(progress.words));
      this.lastResultsSource = progress.words;
    }
    if (progress.seenWords !== this.lastSeenSource) {
      this.deck.addSeen(Object.keys(progress.seenWords ?? {}));
      this.lastSeenSource = progress.seenWords;
    }
  }
  /** Hero selection is a menu action; switching mid-run cannot refresh or stack skill charges. */
  setHero(id) {
    if (this.phase !== "menu" && this.phase !== "over") return;
    const next = getHeroCharacter(id).id;
    if (next === this.heroId) return;
    this.heroId = next;
    this.hp = getHeroCombat(next).maxHp;
    this.resetHeroSkill();
  }
  resetHeroSkill() {
    this.heroCharge = 0;
    this.heroActiveUntil = this.heroGuardUntil = this.heroWardUntil = 0;
    this.dashUntil = 0;
  }
  start(mode = "survival") {
    this.runSequence++;
    this.clock = 0;
    this.playerX = PLAYER_X;
    this.movement = 0;
    this.phase = "playing";
    this.hp = getHeroCombat(this.heroId).maxHp;
    this.clearQueuedAttack();
    this.combatPaused = false;
    this.score = this.combo = this.bestCombo = this.kills = this.words = this.bossKills = 0;
    this.correctLetters = this.correctKeys = this.wrongKeys = 0;
    this.shotSequence = 0;
    this.momentum = this.momentumStreak = this.momentumUntil = this.lastMovedAt = this.dashUntil = 0;
    this.wardX = PLAYER_X;
    this.nextFormationAt = 12e3;
    this.formationSequence = 0;
    this.worldObjects = createWorldObjects();
    this.input = "";
    this.resetHeroSkill();
    this.chooseTarget(null);
    this.jamUntil = this.freezeUntil = this.boostUntil = this.countdown = 0;
    this.inventory = { health: 1, freeze: 1, damage: 1, shield: 1 };
    this.enemies = [];
    this.projectiles = [];
    this.events = [];
    this.results.clear();
    this.bornAt.clear();
    this.revealed.clear();
    this.finalUntil.clear();
    this.deck.clearReservations();
    this.reservations.clear();
    this.summary = null;
    this.lastPlayerHurt = -Infinity;
    this.nextSpawn = 6500;
    this.nextBoss = mode === "boss" ? 18e4 : 9e4;
    this.healingProgress = /* @__PURE__ */ new Map();
    this.claims.clear();
    this.retiredActors.clear();
    this.spawnActorSequence = 0;
    if (this.party.size) {
      [...this.party.values()].forEach((actor, index) => {
        actor.state = createActorState(actor.member.heroId, PLAYER_X + (index - (this.party.size - 1) / 2) * 72);
      });
      this.actorId = this.party.keys().next().value;
      Object.assign(this, this.party.get(this.actorId).state);
    }
    const bossSpawned = mode === "boss" && this.spawn("tank", 1);
    if (!bossSpawned) {
      this.spawn("normal", -1, 160);
      this.spawn("normal", 1, 1120);
      for (let index = 2; index < this.party.size; index++) this.spawn("normal", index % 2 ? 1 : -1);
    }
    if (this.party.size) this.forLivingActors(() => this.selectUrgent(), true);
    else this.selectUrgent();
    this.inform(bossSpawned ? "T\u1EADp Boss d\xF9ng 9 t\u1EEB d\xE0i; c\xF3 th\u1EC3 cao h\u01A1n b\u1EADc hi\u1EC7n t\u1EA1i. Ho\xE0n th\xE0nh t\u1EEB \u0111\u1EC3 ph\xE1 gi\xE1p!" : mode === "boss" ? "Ch\u01B0a \u0111\u1EE7 9 t\u1EEB d\xE0i m\u1EDBi cho Tank. Ti\u1EBFp t\u1EE5c v\u1EDBi zombie th\u01B0\u1EDDng." : "G\xF5 tr\u1ECDn t\u1EEB ti\u1EBFng Anh. Tab \u0111\u1EC3 ch\u1ECDn m\u1EE5c ti\xEAu.", 5500);
    this.checkVocabularyComplete();
  }
  step(deltaMs) {
    if (!Number.isFinite(deltaMs) || deltaMs <= 0) return;
    let remaining = deltaMs;
    if (this.phase === "countdown") {
      const elapsed = Math.min(remaining, this.countdown);
      this.countdown -= elapsed;
      remaining -= elapsed;
      if (this.countdown <= 0) this.phase = "playing";
    }
    if (this.phase !== "playing") return;
    while (remaining > 0 && this.phase === "playing") {
      const slice = Math.min(10, remaining);
      this.tick(slice);
      remaining -= slice;
    }
  }
  tick(delta) {
    this.clock += delta;
    const advance = () => {
      this.enforceTargetVisibility();
      this.movePlayer(delta);
      this.releaseMeleeLetter();
      this.updateWorld(delta);
      if (this.momentum > 0 && this.clock >= this.momentumUntil) {
        this.changeMomentum(-1);
        this.momentumUntil = this.clock + 5e3;
      }
    };
    if (this.party.size) this.forLivingActors(advance, true);
    else advance();
    this.resolveProjectiles();
    this.recycleDistantEnemies();
    for (const enemy of [...this.enemies]) {
      const actor = this.enemyActor(enemy);
      if (actor) this.asActor(actor, () => this.updateEnemy(enemy, delta));
      else if (!this.party.size) this.updateEnemy(enemy, delta);
    }
    if (this.phase !== "playing") return;
    const living = this.players.filter((player) => player.hp > 0);
    if (living.length) this.asActor(living[this.spawnActorSequence % living.length].id, () => this.updateSpawning());
    else if (!this.party.size) this.updateSpawning();
    const refresh = () => {
      this.enforceTargetVisibility();
      if (!this.getTarget() && !this.getWorldTarget()) this.selectUrgent();
    };
    if (this.party.size) this.forLivingActors(refresh, true);
    else refresh();
    this.checkVocabularyComplete();
  }
  updateSpawning() {
    const boss = this.enemies.find((enemy) => enemy.kind === "tank");
    if (!boss && this.clock >= this.nextBoss) {
      if (this.enemies.length <= 3) {
        if (this.spawn("tank", this.countSide(-1) > this.countSide(1) ? 1 : -1, void 0, false)) {
          this.nextBoss = Infinity;
          this.inform("C\u1EA2NH B\xC1O: Tank B\u1EA3o H\u1ED9! Boss kh\xF4ng kh\u1EF1ng khi tr\xFAng ch\u1EEF.", 5e3);
        } else this.nextBoss = this.clock + 3e4;
      }
    }
    if (this.clock >= this.nextSpawn) {
      const cap = boss ? 3 : Math.min(6, 4 + Math.floor(this.words / 20));
      if (this.enemies.length < cap) {
        const roll = this.rand();
        const kind = this.words >= 4 && roll > 0.82 ? "armored" : this.words >= 2 && roll > 0.55 ? "runner" : "normal";
        const side = this.countSide(-1) < this.countSide(1) ? -1 : this.countSide(1) < this.countSide(-1) ? 1 : this.rand() < 0.5 ? -1 : 1;
        if (!boss && this.words >= 4 && this.clock >= this.nextFormationAt && this.enemies.length <= cap - 2) this.spawnFormation(side);
        else this.spawn(kind, side);
      }
      this.nextSpawn = this.clock + Math.max(4e3, 6500 - this.words * 35);
      this.spawnActorSequence++;
    }
  }
  updateEnemy(enemy, delta) {
    if (this.phase !== "playing") return;
    if (enemy.kind === "tank") this.updateBoss(enemy, delta);
    if (this.phase !== "playing") return;
    const contact = enemy.kind === "tank" ? 180 : 92;
    const distance = Math.abs(enemy.x - this.playerX);
    const side = enemy.x >= this.playerX ? 1 : -1;
    const specialist = enemy.role === "ranged" || enemy.role === "summoner";
    if (enemy.kind !== "tank" && !specialist && enemy.attackUntil && distance > contact + 8) enemy.attackUntil = 0;
    if (enemy.kind !== "tank" && (enemy.state === "resolving" || this.clock < enemy.stunUntil || this.clock < this.freezeUntil || this.clock < (enemy.freezeUntil ?? 0))) return;
    if (specialist) {
      this.updateSpecialist(enemy, delta);
      return;
    }
    const rageBoost = enemy.kind === "tank" ? 1 + enemy.rage / 250 : 1;
    const slow = enemy.kind !== "tank" && this.clock < (enemy.slowUntil ?? 0) ? enemy.slowFactor ?? 1 : 1;
    if (distance > contact && !(enemy.kind === "tank" && enemy.attackUntil)) {
      const destination = enemy.x - side * enemy.speed * rageBoost * slow * delta / 1e3;
      enemy.x = clipAtGate(enemy.x, destination, this.worldObjects);
      if (Math.abs(enemy.x - this.playerX) < contact) enemy.x = this.playerX + side * contact;
    }
    if (enemy.kind !== "tank" && enemy.state === "alive" && Math.abs(enemy.x - this.playerX) <= contact && this.clock >= enemy.nextAttackAt) {
      if (!enemy.attackUntil) {
        enemy.attackUntil = this.clock + 500;
        enemy.attackKind = "melee";
        enemy.attackTargetX = this.playerX;
        enemy.attackStartX = enemy.x;
        enemy.attackTargetPlayerId = this.actorId ?? void 0;
        this.emit({
          type: "attack",
          enemyId: enemy.id,
          enemyKind: enemy.kind,
          attackKind: "melee",
          x: enemy.x,
          targetX: this.playerX,
          duration: 500
        });
      } else if (this.clock >= enemy.attackUntil) {
        const damage = this.hurt(enemy.kind === "runner" ? 12 : enemy.kind === "armored" ? 18 : 15, enemy);
        this.emit({
          type: "attack-impact",
          enemyId: enemy.id,
          enemyKind: enemy.kind,
          attackKind: "melee",
          x: enemy.x,
          targetX: this.playerX,
          hit: damage > 0,
          damage
        });
        enemy.x += side * 105;
        enemy.nextAttackAt = this.clock + 1800;
        enemy.attackUntil = 0;
      }
    }
  }
  setMovement(direction) {
    this.movement = this.phase === "playing" ? direction : 0;
    if (this.movement) this.approachTargetId = null;
  }
  movePlayer(delta) {
    const facingTarget = this.getTarget();
    const target = this.combatTarget();
    const approach = !this.combatPaused && this.approachTargetId === target?.id && this.queuedLetters.length > 0 && target && !this.inAttackRange(target) ? Math.sign(target.x - this.playerX) : 0;
    const direction = this.movement || approach;
    if (!direction) return;
    const knightAdvance = this.heroId === "knight" && this.clock < this.heroGuardUntil && facingTarget && direction === Math.sign(facingTarget.x - this.playerX) ? 0.25 : 0;
    const speed = PLAYER_SPEED * (1 + this.momentum * 0.03 + (this.clock < this.dashUntil ? 0.4 : 0) + knightAdvance);
    let next = Math.max(PLAYER_BOUNDS.min, Math.min(
      PLAYER_BOUNDS.max,
      this.playerX + direction * speed * delta / 1e3
    ));
    if (!this.movement && target) {
      const stop = target.x - direction * attackReach(this.heroId, target.kind);
      next = direction > 0 ? Math.min(next, stop) : Math.max(next, stop);
    }
    for (const enemy of this.enemies) {
      if (enemy.hp <= 0 || enemy.kind !== "tank") continue;
      const radius = 180;
      if (direction > 0 && enemy.x >= this.playerX) {
        next = Math.min(next, Math.max(this.playerX, enemy.x - radius));
      } else if (direction < 0 && enemy.x <= this.playerX) {
        next = Math.max(next, Math.min(this.playerX, enemy.x + radius));
      }
    }
    if (next !== this.playerX) this.lastMovedAt = this.clock;
    this.playerX = next;
  }
  flankPosition(side, distance) {
    const viewLeft = cameraTarget(this.playerX);
    const desired = this.playerX + side * distance;
    const outsideView = side < 0 ? Math.min(desired, viewLeft - 60) : Math.max(desired, viewLeft + VIEW_WIDTH + 60);
    return Math.max(-60, Math.min(WORLD_WIDTH + 60, outsideView));
  }
  recycleDistantEnemies() {
    const viewers = this.party.size ? this.players.filter((player) => player.hp > 0) : [{ id: "", x: this.playerX }];
    for (const enemy of this.enemies) {
      if (enemy.kind === "tank" || enemy.attackUntil > this.clock) continue;
      if (viewers.some((viewer) => Math.abs(enemy.x - viewer.x) <= 1100 || enemy.x >= cameraTarget(viewer.x) - 100 && enemy.x <= cameraTarget(viewer.x) + VIEW_WIDTH + 100)) continue;
      if (this.party.size ? [...this.party.values()].some((actor) => actor.state.targetId === enemy.id && actor.state.input.length > 0) : enemy.id === this.targetId && this.input.length > 0) continue;
      if (this.projectiles.some((shot) => shot.enemyId === enemy.id)) continue;
      const nearest = [...viewers].sort((a, b) => Math.abs(a.x - enemy.x) - Math.abs(b.x - enemy.x))[0];
      if (!nearest) continue;
      const reposition = () => {
        enemy.x = this.flankPosition(enemy.x >= this.playerX ? 1 : -1, 760);
      };
      if (nearest.id) this.asActor(nearest.id, reposition);
      else reposition();
    }
  }
  typeKey(rawKey) {
    if (this.phase !== "playing" || this.hp <= 0) return;
    this.enforceTargetVisibility();
    if (rawKey === "Backspace") {
      this.input = this.input.slice(0, -1);
      this.queuedLetters = this.queuedLetters.filter((letter) => letter.index < this.input.length);
      if (!this.queuedLetters.length) this.approachTargetId = null;
      return;
    }
    if (!/^[a-z]$/i.test(rawKey) || this.clock < this.jamUntil) return;
    const world = this.getWorldTarget();
    const target = this.combatTarget();
    if (!target) return;
    const melee = getHeroCombat(this.heroId).class === "melee";
    if (melee && this.queuedLetters.length && answersFor(target.challenge.word).includes(this.input)) {
      this.combatPaused = false;
      if (!this.movement) this.approachTargetId = target.id;
      this.releaseMeleeLetter();
      return;
    }
    const key = rawKey.toLowerCase();
    const next = this.input + key;
    const possibilities = answersFor(target.challenge.word).filter((answer) => answer.startsWith(next));
    if (!possibilities.length) {
      this.wrongKeys++;
      target.challenge.mistakes++;
      this.resultFor(target.challenge.word).mistakes++;
      this.combo = Math.max(0, this.combo - 2);
      this.changeMomentum(-1);
      this.jamUntil = this.clock + JAM_MS;
      if (target.kind === "tank") target.rage = Math.min(100, target.rage + 6);
      this.emit({ type: "jam", ...world ? { worldObjectId: world.id } : { enemyId: target.id }, glyph: key, duration: JAM_MS });
      this.inform("K\u1EB9t \u0111\u1EA1n! Gi\u1EEF b\xECnh t\u0129nh, ph\u1EA7n \u0111\xFAng v\u1EABn c\xF2n.", 1300);
      return;
    }
    this.input = next;
    this.correctKeys++;
    const index = next.length - 1;
    const final = possibilities.includes(next);
    if (melee) {
      this.combatPaused = false;
      this.queuedChallengeId = target.challenge.id;
      if (!target.challenge.credited.has(index) || final) this.queuedLetters.push({ index, glyph: key, final });
      if (!this.movement && this.queuedLetters.length) this.approachTargetId = target.id;
      this.releaseMeleeLetter();
      return;
    }
    this.launchLetter(target, { index, glyph: key, final });
  }
  combatTarget() {
    const world = this.getWorldTarget();
    return this.getTarget() ?? (world?.challenge ? { id: -world.id, kind: "barrel", x: world.x, challenge: world.challenge } : void 0);
  }
  inAttackRange(target) {
    return Math.abs(target.x - this.playerX) <= attackReach(this.heroId, target.kind) + 1e-3;
  }
  clearQueuedAttack() {
    this.queuedLetters = [];
    this.queuedChallengeId = null;
    this.approachTargetId = null;
    this.nextMeleeShotAt = 0;
  }
  cancelApproach() {
    this.approachTargetId = null;
    this.combatPaused = true;
  }
  releaseMeleeLetter() {
    if (this.phase !== "playing" || this.hp <= 0 || this.combatPaused || !this.queuedLetters.length) return;
    const target = this.combatTarget();
    if (!target || target.challenge.id !== this.queuedChallengeId) {
      this.clearQueuedAttack();
      this.input = "";
      return;
    }
    if (!this.inAttackRange(target) || this.clock < this.nextMeleeShotAt || this.clock < this.jamUntil) return;
    const letter = this.queuedLetters.shift();
    this.nextMeleeShotAt = this.clock + MELEE_LETTER_INTERVAL;
    this.launchLetter(target, letter);
    if (!this.queuedLetters.length) this.approachTargetId = null;
  }
  /** A letter earns charge, damage and word completion only after it actually launches. */
  launchLetter(target, letter) {
    const { index, glyph: key, final } = letter;
    const world = target.kind === "barrel" ? this.getWorldTarget() : void 0;
    const effective = !target.challenge.credited.has(index);
    const shotId = ++this.shotSequence;
    const baseDuration = Math.round(160 + Math.abs(target.x - this.playerX) / 5);
    const finalDue = Math.max(this.clock + baseDuration, ...this.projectiles.filter((shot) => shot.enemyId === target.id && shot.challengeId === target.challenge.id).map((shot) => shot.due));
    const duration = final ? finalDue - this.clock : baseDuration;
    if (effective) {
      target.challenge.credited.add(index);
      this.correctLetters++;
      this.projectiles.push({
        ownerId: this.actorId ?? void 0,
        shotId,
        enemyId: target.id,
        challengeId: target.challenge.id,
        index,
        firedAt: this.clock,
        due: this.clock + duration,
        final,
        glyph: key,
        effective: true
      });
    }
    this.emit({
      type: "shot",
      shotId,
      challengeId: target.challenge.id,
      ...world ? { worldObjectId: world.id } : { enemyId: target.id },
      x: target.x,
      sourceX: this.playerX,
      glyph: key,
      duration,
      effective,
      firedAt: this.clock,
      impactAt: this.clock + duration
    });
    if (effective && target.kind !== "barrel") this.chargeHeroSkill(target);
    if (final) {
      if (!effective) this.projectiles.push({
        ownerId: this.actorId ?? void 0,
        shotId,
        enemyId: target.id,
        challengeId: target.challenge.id,
        index,
        firedAt: this.clock,
        due: this.clock + duration,
        final: true,
        glyph: key,
        effective: false
      });
      this.finishWord(target);
      if (target.kind !== "barrel") target.state = "resolving";
      else if (world) world.resolving = true;
      this.input = "";
      this.chooseTarget(null);
      this.selectUrgent();
    }
  }
  cycleTarget(direction = 1) {
    if (this.phase !== "playing") return;
    this.enforceTargetVisibility();
    if (this.input.length > 0) return;
    const alive = [
      ...this.enemies.filter((enemy) => this.targetAvailable(enemy.id) && (!this.party.size || Math.abs(enemy.x - this.playerX) <= 1e3) && canTargetEnemy(this.enemies, enemy, this.playerX)),
      ...this.worldObjects.filter((object) => object.kind === "barrel" && object.state === "active" && !object.resolving && this.targetAvailable(-object.id) && Math.abs(object.x - this.playerX) < 760).map((object) => ({ id: -object.id, x: object.x }))
    ].sort((left, right) => left.x - right.x);
    if (!alive.length) return;
    const previous = alive.findIndex((enemy) => enemy.id === this.targetId);
    this.chooseTarget(alive[(previous + (direction < 0 ? -1 : 1) + alive.length) % alive.length].id);
  }
  chargeHeroSkill(target) {
    if (this.phase !== "playing") return;
    const skill = getHeroSkill(this.heroId);
    this.heroCharge++;
    if (this.heroCharge < skill.threshold) return;
    this.heroCharge -= skill.threshold;
    this.activateHeroSkill(skill, target);
  }
  /** Preserve attack warnings when a local skill extends an existing stun/freeze interval. */
  blockEnemy(enemy, kind, duration) {
    const previous = Math.max(this.clock, this.freezeUntil, enemy.stunUntil, enemy.freezeUntil ?? 0);
    if (kind === "stun") enemy.stunUntil = Math.max(enemy.stunUntil, this.clock + duration);
    else enemy.freezeUntil = Math.max(enemy.freezeUntil ?? 0, this.clock + duration);
    const next = Math.max(previous, enemy.stunUntil, enemy.freezeUntil ?? 0);
    this.holdAttack(enemy, next - previous);
  }
  /** Move outward without crossing another body, a shielding Boss, the player or world bounds. */
  pushEnemies(enemies, distance) {
    const affected = [];
    const ordered = [...enemies].sort((a, b) => Math.abs(b.x - this.playerX) - Math.abs(a.x - this.playerX));
    for (const enemy of ordered) {
      const side = Math.sign(enemy.x - this.playerX) || enemy.side;
      const away = Math.abs(enemy.x - this.playerX);
      let limit = side > 0 ? WORLD_WIDTH + 60 - enemy.x : enemy.x + 60;
      for (const other of this.enemies) {
        if (other.id === enemy.id || other.hp <= 0 || (Math.sign(other.x - this.playerX) || other.side) !== side) continue;
        const otherDistance = Math.abs(other.x - this.playerX);
        if (otherDistance >= away) limit = Math.min(limit, Math.max(0, otherDistance - away - 1));
      }
      const pushed = Math.max(0, Math.min(distance, limit));
      if (pushed <= 0) continue;
      enemy.x += side * pushed;
      affected.push(enemy);
    }
    return affected;
  }
  activateHeroSkill(skill, target) {
    let targetX = target.x;
    const distance = Math.abs(target.x - this.playerX);
    const eligible = this.enemies.filter((enemy) => enemy.kind !== "tank" && canTargetEnemy(this.enemies, enemy, this.playerX));
    const effect = skill.effect;
    let affected = [], duration = 500, radius = 0, value;
    switch (effect.kind) {
      case "push-target":
        affected = this.pushEnemies(eligible.filter((enemy) => enemy.id === target.id), effect.distance * (distance > 300 ? 2 : 1));
        break;
      case "stun-area":
        radius = effect.radius;
        duration = effect.duration;
        if (distance <= 160) {
          radius = 225;
          duration = 900;
          targetX = this.playerX;
        }
        affected = eligible.filter((enemy) => Math.abs(enemy.x - targetX) <= radius);
        for (const enemy of affected) this.blockEnemy(enemy, "stun", duration);
        break;
      case "guard":
        duration = effect.duration;
        this.heroGuardUntil = this.clock + duration;
        break;
      case "ward":
        duration = effect.duration;
        this.heroWardUntil = this.clock + duration;
        this.wardX = this.playerX;
        radius = 180;
        targetX = this.playerX;
        break;
      case "push-line": {
        const side = Math.sign(targetX - this.playerX) || target.side;
        const reach = Math.abs(targetX - this.playerX);
        affected = this.pushEnemies(eligible.filter((enemy) => (Math.sign(enemy.x - this.playerX) || enemy.side) === side && Math.abs(enemy.x - this.playerX) <= reach), effect.distance * (reach >= 120 ? 1.5 : 1));
        break;
      }
      case "heal":
        value = Math.min(effect.amount + (this.clock - this.lastMovedAt >= 1e3 ? 3 : 0), getHeroCombat(this.heroId).maxHp - this.hp);
        this.hp += value;
        break;
      case "slow":
        duration = effect.duration;
        if (this.movement * Math.sign(targetX - this.playerX) < 0) duration += 1e3;
        affected = eligible.filter((enemy) => enemy.id === target.id);
        for (const enemy of affected) {
          enemy.slowUntil = Math.max(enemy.slowUntil ?? 0, this.clock + duration);
          enemy.slowFactor = effect.factor;
        }
        break;
      case "repel":
        radius = effect.radius;
        affected = this.pushEnemies(eligible.filter((enemy) => Math.abs(enemy.x - this.playerX) <= radius), effect.distance);
        if (affected.length) this.dashUntil = this.clock + 900;
        break;
      case "freeze-area":
        radius = effect.radius;
        duration = effect.duration;
        if (distance > 350) {
          radius = 200;
          duration = 1200;
        }
        affected = eligible.filter((enemy) => Math.abs(enemy.x - targetX) <= radius);
        for (const enemy of affected) this.blockEnemy(enemy, "freeze", duration);
        break;
    }
    const defensive = effect.kind === "guard" || effect.kind === "ward" || effect.kind === "heal";
    this.heroActiveUntil = defensive || affected.length ? this.clock + duration : 0;
    this.emit({
      type: "hero-skill",
      heroId: this.heroId,
      skillId: skill.id,
      visualKind: skill.visualKind,
      x: this.playerX,
      targetX,
      radius,
      duration,
      targets: affected.map((enemy) => ({ enemyId: enemy.id, x: enemy.x })),
      value,
      skillPhase: "activate"
    });
  }
  pause() {
    this.cancelApproach();
    if (this.party.size) {
      this.movement = 0;
      return;
    }
    if (this.phase === "playing" || this.phase === "countdown") {
      this.phase = "paused";
      this.countdown = 0;
      this.movement = 0;
    }
  }
  resume() {
    if (this.phase === "paused") {
      this.phase = "countdown";
      this.countdown = 2e3;
    }
  }
  toMenu() {
    this.phase = "menu";
    this.movement = 0;
    this.clearQueuedAttack();
    this.projectiles = [];
    this.events = [];
    this.resetHeroSkill();
  }
  useItem(item) {
    if (this.phase !== "playing" || !this.inventory[item]) return;
    if (item === "health") {
      if (this.hp >= getHeroCombat(this.heroId).maxHp) {
        this.inform("HP \u0111ang \u0111\u1EA7y. T\xFAi c\u1EE9u th\u01B0\u01A1ng \u0111\u01B0\u1EE3c gi\u1EEF l\u1EA1i.");
        return;
      }
      this.hp = Math.min(getHeroCombat(this.heroId).maxHp, this.hp + 25);
      this.inform("+25 HP");
    } else if (item === "freeze") {
      const previousFreeze = this.freezeUntil;
      this.freezeUntil = this.clock + 3e3;
      for (const enemy of this.enemies) {
        if (enemy.kind === "tank") continue;
        const previousBlock = Math.max(this.clock, previousFreeze, enemy.stunUntil, enemy.freezeUntil ?? 0);
        const extension2 = Math.max(previousBlock, this.freezeUntil) - previousBlock;
        this.holdAttack(enemy, extension2);
      }
      this.inform("\u0110\xF3ng b\u0103ng zombie 3 gi\xE2y. Boss \u0111\u01B0\u1EE3c mi\u1EC5n nhi\u1EC5m.");
    } else if (item === "damage") {
      this.boostUntil = this.clock + 6e3;
      this.inform("\u0110\u1EA1n m\u1EA1nh: x2 s\xE1t th\u01B0\u01A1ng m\u1ED7i t\u1EEB trong 6 gi\xE2y.");
    } else {
      const target = this.getTarget();
      if (!target) return;
      if (!target.challenge.assisted) {
        target.challenge.assisted = true;
        this.resultFor(target.challenge.word).assisted++;
      }
      const answer = answersFor(target.challenge.word).find((word) => word.startsWith(this.input));
      const distinguishing = target.challenge.word.translationHint?.split(" ");
      this.revealed.set(target.challenge.id, [...answer].map((letter, index) => index === 0 || index === answer.length - 1 || index === this.input.length || distinguishing?.[index] === letter ? letter : "_").join(" "));
      this.inform("\u0110\xE3 hi\u1EC7n g\u1EE3i \xFD. L\u01B0\u1EE3t n\xE0y \u0111\u01B0\u1EE3c ghi l\xE0 c\xF3 h\u1ED7 tr\u1EE3.");
    }
    this.inventory[item]--;
  }
  snapshot() {
    const target = this.getTarget();
    const world = this.getWorldTarget();
    const boss = this.enemies.find((enemy) => enemy.kind === "tank");
    const targetCharacter = target ? getEnemyCharacter(target.appearanceId, target.kind) : void 0;
    const bossCharacter = boss ? getEnemyCharacter(boss.appearanceId, boss.kind) : void 0;
    const heroSkill = getHeroSkill(this.heroId);
    const combat = getHeroCombat(this.heroId);
    const combatTarget = this.combatTarget();
    return {
      phase: this.phase,
      hp: this.hp,
      maxHp: combat.maxHp,
      playerX: this.playerX,
      score: this.score,
      combo: this.combo,
      bestCombo: this.bestCombo,
      combat: {
        class: combat.class,
        range: combat.range,
        inRange: !!combatTarget && this.inAttackRange(combatTarget),
        approaching: !this.combatPaused && !this.movement && !!combatTarget && this.approachTargetId === combatTarget.id && this.queuedLetters.length > 0 && !this.inAttackRange(combatTarget),
        queued: this.queuedLetters.length
      },
      kills: this.kills,
      words: this.words,
      elapsed: this.clock,
      input: this.input,
      locked: this.input.length > 0,
      jamRemaining: Math.max(0, this.jamUntil - this.clock),
      countdown: this.countdown,
      enemyCount: this.enemies.length,
      target: target ? {
        id: target.id,
        kind: target.kind,
        prompt: target.challenge.prompt,
        appearanceId: targetCharacter.id,
        name: targetCharacter.name,
        label: targetCharacter.label,
        hint: this.revealed.get(target.challenge.id) ?? (target.challenge.kind === "hint" || target.challenge.kind === "translate" ? target.challenge.hint : ""),
        type: target.challenge.kind,
        length: target.challenge.word.answer.length,
        meaning: target.challenge.word.meaning,
        partOfSpeech: target.challenge.word.partOfSpeech,
        difficulty: target.challenge.word.difficulty,
        learningLevel: getWordLearningLevel(target.challenge.word)
      } : world?.challenge ? {
        id: -world.id,
        kind: "barrel",
        worldObjectId: world.id,
        prompt: world.challenge.prompt,
        hint: this.revealed.get(world.challenge.id) ?? world.challenge.hint,
        type: world.challenge.kind,
        length: world.challenge.word.answer.length,
        meaning: world.challenge.word.meaning,
        partOfSpeech: world.challenge.word.partOfSpeech,
        difficulty: world.challenge.word.difficulty,
        learningLevel: getWordLearningLevel(world.challenge.word),
        label: "Th\xF9ng n\u1ED5"
      } : null,
      boss: boss ? {
        hp: boss.hp,
        maxHp: boss.maxHp,
        phase: boss.bossPhase,
        rage: boss.rage,
        appearanceId: bossCharacter.id,
        name: bossCharacter.name,
        label: bossCharacter.label
      } : null,
      inventory: { ...this.inventory },
      freezeRemaining: Math.max(0, this.freezeUntil - this.clock),
      boostRemaining: Math.max(0, this.boostUntil - this.clock),
      vocabulary: this.vocabularyAvailability(),
      learning: getLearningProgress(this.words),
      momentum: {
        level: this.momentum,
        streak: this.momentumStreak,
        multiplier: 1 + this.momentum * 0.1,
        remaining: Math.max(0, this.momentumUntil - this.clock)
      },
      world: { nearby: this.nearbyWorld(), healingProgress: this.party.size ? Math.max(0, ...this.healingProgress.values()) : this.worldObjects.find((object) => object.kind === "healing-zone" && object.progress > 0)?.progress ?? 0 },
      ...this.actorId && this.party.has(this.actorId) ? { party: { selfId: this.actorId, players: [...this.players] } } : {},
      hero: {
        id: this.heroId,
        skillName: heroSkill.name,
        charge: this.heroCharge,
        threshold: heroSkill.threshold,
        activeRemaining: Math.max(0, this.heroActiveUntil - this.clock)
      },
      notice: this.clock < this.noticeUntil ? this.notice : "",
      summary: this.summary
    };
  }
  drainEvents() {
    const events = this.events;
    this.events = [];
    return events;
  }
  getWorldTarget() {
    return this.worldObjects.find((object) => -object.id === this.targetId && object.kind === "barrel" && this.targetAvailable(-object.id) && object.state === "active" && !object.resolving && object.challenge && Math.abs(object.x - this.playerX) < 800);
  }
  nearbyWorld() {
    const object = this.worldObjects.filter((entry) => entry.kind !== "barrel" && entry.state !== "used" && Math.abs(entry.x - this.playerX) <= entry.radius).sort((a, b) => Math.abs(a.x - this.playerX) - Math.abs(b.x - this.playerX))[0];
    return object ? {
      id: object.id,
      kind: object.kind,
      state: object.state,
      charges: object.charges,
      label: object.kind === "gate" ? object.state === "closed" ? "M\u1EDF c\u1ED5ng" : "\u0110\xF3ng c\u1ED5ng ch\u1EB7n qu\xE1i" : "D\u1EEBng l\u1EA1i \u0111\u1EC3 h\u1ED3i m\xE1u"
    } : null;
  }
  interactWorld() {
    if (this.phase !== "playing" || this.input) return;
    const nearby = this.nearbyWorld();
    const object = this.worldObjects.find((entry) => entry.id === nearby?.id && entry.kind === "gate");
    if (!object) return;
    object.state = object.state === "open" ? "closed" : "open";
    this.emit({ type: "world-interact", worldObjectId: object.id, worldKind: object.kind, x: object.x, state: object.state });
    this.inform(object.state === "closed" ? "\u0110\xE3 \u0111\xF3ng c\u1ED5ng. Qu\xE1i b\u1ECB ch\u1EB7n; Boss c\xF3 th\u1EC3 ph\xE1 qua." : "\u0110\xE3 m\u1EDF c\u1ED5ng.");
  }
  updateWorld(delta) {
    for (const object of this.worldObjects) {
      if (object.kind === "barrel" && object.state === "idle" && this.words >= 6 && this.deck.availability.remaining > 2 && Math.abs(object.x - this.playerX) <= 550) {
        const word = this.allocateWords(1)?.[0];
        if (word) {
          object.challenge = this.challenge(word, "translate");
          object.state = "active";
        }
      }
      if (object.kind !== "healing-zone" || object.state === "used") continue;
      if (Math.abs(object.x - this.playerX) > object.radius || this.movement || this.lastMovedAt === this.clock || this.hp >= getHeroCombat(this.heroId).maxHp || this.clock - this.lastPlayerHurt < 1e3) {
        this.setHealingProgress(object, 0);
        continue;
      }
      const previous = this.party.size ? this.healingProgress.get(object.id) ?? 0 : object.progress;
      const progress = Math.min(1, previous + delta / HEAL_DWELL_MS);
      this.setHealingProgress(object, progress);
      if (progress < 1) continue;
      const value = Math.min(15, getHeroCombat(this.heroId).maxHp - this.hp);
      this.hp += value;
      object.charges--;
      this.setHealingProgress(object, 0);
      if (!object.charges) {
        object.state = "used";
        for (const actor of this.party.values()) actor.state.healingProgress.delete(object.id);
      }
      this.emit({
        type: "world-interact",
        worldObjectId: object.id,
        worldKind: object.kind,
        state: object.state,
        x: object.x,
        value
      });
    }
  }
  setHealingProgress(object, progress) {
    if (!this.party.size) {
      object.progress = progress;
      return;
    }
    this.healingProgress.set(object.id, progress);
    object.progress = Math.max(0, ...[...this.party.values()].map((actor) => actor.state.healingProgress.get(object.id) ?? 0));
  }
  changeMomentum(change) {
    const previous = this.momentum;
    this.momentum = Math.max(0, Math.min(5, this.momentum + change));
    this.momentumStreak = change > 0 ? this.momentumStreak + 1 : Math.max(0, this.momentumStreak - 1);
    if (change > 0) this.momentumUntil = this.clock + MOMENTUM_LIFETIME;
    if (previous !== this.momentum) this.emit({ type: "momentum", value: this.momentum, duration: MOMENTUM_LIFETIME, x: this.playerX });
  }
  explodeBarrel(object) {
    object.state = "used";
    object.resolving = false;
    object.charges = 0;
    const targets = this.enemies.filter((enemy) => enemy.kind !== "tank" && Math.abs(enemy.x - object.x) <= BARREL_RADIUS);
    for (const enemy of targets) {
      this.blockEnemy(enemy, "stun", 1200);
      if (enemy.hp > 1 && enemy.state === "alive") {
        enemy.hp = Math.max(1, enemy.hp - 1);
        const reserved = this.reservations.get(enemy.id);
        if (reserved?.length) this.deck.release([reserved.pop()]);
        this.emit({ type: "armor-break", enemyId: enemy.id, x: enemy.x });
      }
    }
    this.pushEnemies(targets, 90);
    this.emit({
      type: "world-explosion",
      worldObjectId: object.id,
      worldKind: "barrel",
      x: object.x,
      radius: BARREL_RADIUS,
      duration: 1200,
      targets: targets.map((enemy) => ({ enemyId: enemy.id, x: enemy.x }))
    });
    this.bornAt.delete(object.challenge.id);
    this.revealed.delete(object.challenge.id);
  }
  getTarget() {
    return this.enemies.find((enemy) => enemy.id === this.targetId && this.targetAvailable(enemy.id) && canTargetEnemy(this.enemies, enemy, this.playerX));
  }
  enforceTargetVisibility() {
    const live = this.combatTarget();
    if (this.queuedChallengeId !== null && (!live || live.challenge.id !== this.queuedChallengeId)) {
      this.clearQueuedAttack();
      this.input = "";
    }
    if (this.targetId !== null && (!this.targetAvailable(this.targetId) || this.targetId < 0 && !this.getWorldTarget())) {
      this.input = "";
      this.chooseTarget(null);
      return;
    }
    const selected = this.enemies.find((enemy) => enemy.id === this.targetId && enemy.state === "alive");
    if (selected && this.party.size && !this.input && Math.abs(selected.x - this.playerX) > 1e3) {
      this.chooseTarget(null);
      return;
    }
    if (!selected || canTargetEnemy(this.enemies, selected, this.playerX)) return;
    const blocker = this.enemies.filter((enemy) => shieldsFollowers(enemy) && Math.sign(enemy.x - this.playerX) === Math.sign(selected.x - this.playerX) && Math.abs(enemy.x - this.playerX) < Math.abs(selected.x - this.playerX)).sort((a, b) => Math.abs(a.x - this.playerX) - Math.abs(b.x - this.playerX))[0];
    this.input = "";
    this.chooseTarget(blocker && this.targetAvailable(blocker.id) && canTargetEnemy(this.enemies, blocker, this.playerX) ? blocker.id : null);
    if (!this.targetId) this.selectUrgent();
    this.inform("M\u1EE5c ti\xEAu \u0111\u01B0\u1EE3c l\xE1 ch\u1EAFn che ch\u1EAFn. H\xE3y ph\xE1 k\u1EBB ch\u1EAFn tr\u01B0\u1EDBc!", 3e3);
  }
  selectUrgent() {
    if (this.actorId && (!this.party.get(this.actorId)?.connected || this.hp <= 0)) {
      this.chooseTarget(null);
      return;
    }
    if (this.input.length && (this.getTarget() || this.getWorldTarget())) return;
    const enemy = this.enemies.filter((entry) => this.targetAvailable(entry.id) && (!this.party.size || Math.abs(entry.x - this.playerX) <= 1e3) && canTargetEnemy(this.enemies, entry, this.playerX)).sort((a, b) => {
      const time = (entry) => Math.max(0, Math.abs(entry.x - this.playerX) - (entry.kind === "tank" ? 180 : 92)) / entry.speed;
      return time(a) - time(b);
    })[0];
    const barrel = this.worldObjects.find((object) => object.kind === "barrel" && this.targetAvailable(-object.id) && object.state === "active" && !object.resolving && Math.abs(object.x - this.playerX) < 760);
    this.chooseTarget(enemy?.id ?? (barrel ? -barrel.id : null));
  }
  rand() {
    return Math.max(0, Math.min(0.999999, this.random()));
  }
  countSide(side) {
    return this.enemies.filter((enemy) => (enemy.x >= this.playerX ? 1 : -1) === side).length;
  }
  vocabularyAvailability() {
    return { ...this.deck.availability };
  }
  allocateWords(count, minimumLength = 1, allowHigherLevels = true) {
    return this.deck.reserve(count, minimumLength >= 7, getLearningProgress(this.words).level, allowHigherLevels);
  }
  nextReservedWord(enemy) {
    const words = this.reservations.get(enemy.id) ?? [];
    while (words.length) {
      const word = words.shift();
      if (this.deck.isUnseen(word)) return word;
      this.deck.release([word]);
    }
    return this.allocateWords(1, enemy.kind === "tank" ? 7 : 1, enemy.kind !== "tank")?.[0];
  }
  challenge(word, forcedKind) {
    const id = ++this.challengeSequence;
    const challenge = createChallenge(word, forcedKind ?? KINDS[(id - 1) % KINDS.length], id, this.random);
    this.deck.markShown(word);
    try {
      this.onWordSeen?.(word);
    } catch {
      this.inform("Ch\u01B0a l\u01B0u \u0111\u01B0\u1EE3c l\u1ECBch s\u1EED t\u1EEB. Phi\xEAn n\xE0y v\u1EABn kh\xF4ng l\u1EB7p t\u1EEB.");
    }
    this.bornAt.set(id, this.clock);
    this.resultFor(word).encounters++;
    return challenge;
  }
  spawn(kind, side, x, allowHigherLevels = true, role = "melee", formationId) {
    if (this.countSide(side) >= 3 || this.enemies.length >= MAX_ENEMIES) return false;
    let planned = this.allocateWords(kind === "tank" ? 9 : kind === "armored" ? 2 : 1, kind === "tank" ? 7 : 1, allowHigherLevels);
    if (!planned && kind === "armored") {
      kind = "normal";
      planned = this.allocateWords(1);
    }
    if (!planned) return false;
    const word = planned.shift();
    const hp = kind === "tank" ? 9 : kind === "armored" ? 2 : 1;
    const speed = ENEMY_SPEED[kind];
    const spawnX = this.flankPosition(side, 720);
    const appearances = getEnemyCharacters(kind);
    const appearanceId = appearances[this.appearanceSequence[kind] % appearances.length].id;
    const enemy = {
      id: ++this.enemySequence,
      kind,
      side,
      x: x ?? spawnX,
      speed,
      appearanceId,
      role: role === "shield" && kind !== "armored" ? "melee" : role,
      formationId,
      hp,
      maxHp: hp,
      challenge: this.challenge(word),
      state: "alive",
      stunUntil: 0,
      immuneUntil: 0,
      attackUntil: 0,
      nextAttackAt: this.clock + (kind === "tank" ? 8e3 : 0),
      bossPhase: 1,
      rage: 0
    };
    this.enemies.push(enemy);
    this.appearanceSequence[kind]++;
    this.reservations.set(enemy.id, planned);
    if (kind === "tank") this.emit({ type: "boss-warning", enemyId: enemy.id, x: enemy.x });
    return true;
  }
  resultFor(word) {
    let result = this.results.get(word.answer);
    if (!result) {
      result = { word: word.answer, meaning: word.meaning, encounters: 0, completed: 0, mistakes: 0, assisted: 0, totalResponseMs: 0 };
      this.results.set(word.answer, result);
    }
    return result;
  }
  finishWord(enemy) {
    const challenge = enemy.challenge;
    const result = this.resultFor(challenge.word);
    result.completed++;
    result.totalResponseMs += Math.max(0, this.clock - (this.bornAt.get(challenge.id) ?? this.clock));
    this.words++;
    if (!challenge.mistakes) this.combo++;
    if (!challenge.mistakes && !challenge.assisted) this.changeMomentum(1);
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    this.score += Math.round((100 + Math.min(10, this.combo) * 10) * (1 + this.momentum * 0.1));
    if (enemy.kind === "tank") enemy.rage = Math.max(0, (enemy.rage ?? 0) - 8);
  }
  spawnFormation(preferredSide) {
    const side = this.countSide(preferredSide) <= 1 ? preferredSide : preferredSide === 1 ? -1 : 1;
    if (this.countSide(side) > 1) return;
    const id = ++this.formationSequence;
    const pattern = (id - 1) % 3;
    const before = new Set(this.enemies.map((enemy) => enemy.id));
    if (pattern === 1) {
      this.spawn("runner", -1, void 0, true, "melee", id);
      this.spawn("runner", 1, void 0, true, "melee", id);
    } else {
      const inner = this.flankPosition(side, 690);
      this.spawn("armored", side, inner, true, "shield", id);
      const role = pattern === 2 && !this.enemies.some((enemy) => enemy.role === "summoner") ? "summoner" : "ranged";
      this.spawn("normal", side, inner + side * 75, true, role, id);
    }
    const added = this.enemies.filter((enemy) => !before.has(enemy.id));
    if (added.length) this.emit({
      type: "formation",
      formationId: id,
      x: added[0].x,
      role: added[0].role,
      targets: added.map((enemy) => ({ enemyId: enemy.id, x: enemy.x }))
    });
    this.nextFormationAt = this.clock + 18e3;
  }
  updateSpecialist(enemy, delta) {
    const distance = Math.abs(enemy.x - this.playerX);
    const side = Math.sign(enemy.x - this.playerX) || enemy.side;
    const slow = this.clock < (enemy.slowUntil ?? 0) ? enemy.slowFactor ?? 1 : 1;
    if (!enemy.attackUntil) {
      const desired = enemy.role === "summoner" ? 430 : 330;
      if (distance > desired + 12 || distance < 220) {
        const direction = distance < 220 ? side : -side;
        enemy.x = clipAtGate(enemy.x, Math.max(-60, Math.min(
          WORLD_WIDTH + 60,
          enemy.x + direction * enemy.speed * slow * delta / 1e3
        )), this.worldObjects);
      }
    }
    if (this.clock < enemy.nextAttackAt || distance > 620) return;
    if (!enemy.attackUntil) {
      enemy.attackKind = enemy.role === "summoner" ? "summon" : "ranged";
      enemy.attackTargetPlayerId = this.actorId ?? void 0;
      enemy.attackStartX = enemy.x;
      enemy.attackTargetX = this.playerX;
      enemy.attackUntil = this.clock + (enemy.attackKind === "summon" ? 1800 : 1300);
      this.emit({
        type: "attack",
        enemyId: enemy.id,
        enemyKind: enemy.kind,
        attackKind: enemy.attackKind,
        role: enemy.role,
        x: enemy.x,
        targetX: enemy.attackTargetX,
        duration: enemy.attackUntil - this.clock,
        radius: RANGED_RADIUS
      });
      return;
    }
    if (this.clock < enemy.attackUntil) return;
    let damage = 0;
    if (enemy.attackKind === "summon") {
      const cap = this.enemies.some((entry) => entry.kind === "tank") ? 3 : MAX_ENEMIES;
      if ((enemy.summons ?? 0) < 2 && this.enemies.length < cap) {
        const spawnSide = side < 0 ? -1 : 1;
        if (this.spawn("normal", spawnSide, enemy.x + side * 55)) enemy.summons = (enemy.summons ?? 0) + 1;
      }
      if ((enemy.summons ?? 0) >= 2) enemy.role = "ranged";
    } else {
      const targetX = enemy.attackTargetX ?? this.playerX;
      damage = this.hurtArea(10, enemy, (x) => Math.abs(x - targetX) <= RANGED_RADIUS);
    }
    this.emit({
      type: "attack-impact",
      enemyId: enemy.id,
      enemyKind: enemy.kind,
      attackKind: enemy.attackKind,
      x: enemy.attackStartX ?? enemy.x,
      targetX: enemy.attackTargetX ?? this.playerX,
      radius: RANGED_RADIUS,
      hit: damage > 0,
      damage
    });
    enemy.attackUntil = 0;
    enemy.nextAttackAt = this.clock + (enemy.attackKind === "summon" ? 9e3 : 4200);
  }
  resolveProjectiles() {
    const arrived = this.projectiles.filter((shot) => shot.due <= this.clock);
    this.projectiles = this.projectiles.filter((shot) => shot.due > this.clock);
    for (const shot of arrived) {
      if (shot.ownerId) {
        if (this.party.has(shot.ownerId) || this.retiredActors.has(shot.ownerId)) this.asActor(shot.ownerId, () => this.resolveProjectile(shot));
      } else this.resolveProjectile(shot);
    }
    for (const id of this.retiredActors.keys()) if (!this.projectiles.some((shot) => shot.ownerId === id)) this.retiredActors.delete(id);
  }
  resolveProjectile(shot) {
    if (shot.enemyId < 0) {
      const object = this.worldObjects.find((entry) => entry.id === -shot.enemyId && entry.challenge?.id === shot.challengeId && entry.state === "active");
      if (!object) return;
      if (shot.effective) this.emit({
        type: "hit",
        shotId: shot.shotId,
        challengeId: shot.challengeId,
        worldObjectId: object.id,
        worldKind: "barrel",
        x: object.x,
        glyph: shot.glyph,
        duration: 0,
        firedAt: shot.firedAt,
        impactAt: this.clock
      });
      if (shot.final) this.explodeBarrel(object);
      return;
    }
    const enemy = this.enemies.find((entry) => entry.id === shot.enemyId && entry.challenge.id === shot.challengeId);
    if (!enemy) return;
    let appliedStun = 0;
    if (shot.effective && enemy.kind !== "tank") {
      const previousBlock = Math.max(this.clock, enemy.stunUntil, this.freezeUntil, enemy.freezeUntil ?? 0);
      enemy.stunUntil = Math.max(enemy.stunUntil, this.clock + STUN_MS[enemy.kind]);
      enemy.immuneUntil = 0;
      appliedStun = STUN_MS[enemy.kind];
      this.holdAttack(enemy, Math.max(previousBlock, enemy.stunUntil) - previousBlock);
    }
    if (shot.effective) this.emit({
      type: "hit",
      shotId: shot.shotId,
      challengeId: shot.challengeId,
      enemyId: enemy.id,
      x: enemy.x,
      glyph: shot.glyph,
      effective: true,
      duration: appliedStun,
      firedAt: shot.firedAt,
      impactAt: this.clock
    });
    if (!shot.final) return;
    const damage = this.clock < this.boostUntil ? 2 : 1;
    enemy.hp = enemy.kind === "tank" && enemy.hp > 1 ? Math.max(1, enemy.hp - damage) : Math.max(0, enemy.hp - damage);
    if (!enemy.hp) {
      this.kill(enemy);
      return;
    }
    const previousPhase = enemy.bossPhase;
    if (enemy.kind === "tank") enemy.bossPhase = enemy.hp > 6 ? 1 : enemy.hp > 3 ? 2 : 3;
    const final = enemy.kind === "tank" && enemy.hp === 1;
    const next = this.nextReservedWord(enemy);
    if (!next) {
      this.enemies = this.enemies.filter((entry) => entry.id !== enemy.id);
      this.deck.release(this.reservations.get(enemy.id) ?? []);
      this.reservations.delete(enemy.id);
      this.bornAt.delete(enemy.challenge.id);
      this.revealed.delete(enemy.challenge.id);
      this.finalUntil.delete(enemy.id);
      if (this.targetId === enemy.id) {
        this.chooseTarget(null);
        this.input = "";
      }
      this.inform("Kh\xF4ng c\xF2n t\u1EEB m\u1EDBi ph\xF9 h\u1EE3p cho l\u1EDBp gi\xE1p ti\u1EBFp theo.");
      return;
    }
    this.bornAt.delete(enemy.challenge.id);
    this.revealed.delete(enemy.challenge.id);
    enemy.challenge = this.challenge(next, final ? "translate" : void 0);
    enemy.state = "alive";
    this.emit({ type: "armor-break", enemyId: enemy.id, x: enemy.x });
    if (previousPhase !== enemy.bossPhase) {
      this.emit({ type: "boss-phase", enemyId: enemy.id, x: enemy.x });
      this.inform(`Tank chuy\u1EC3n phase ${enemy.bossPhase}! Quan s\xE1t \u0111\xF2n \u0111\u1EADp \u0111\u1EA5t.`, 3500);
    }
    if (final) {
      this.finalUntil.set(enemy.id, this.clock + 16e3);
      this.inform("FINAL STRIKE \xB7 Ho\xE0n th\xE0nh t\u1EEB m\u1EDBi trong 16 gi\xE2y!", 7e3);
    }
  }
  updateBoss(enemy, delta) {
    enemy.rage = Math.min(100, enemy.rage + delta * 18e-4);
    if (enemy.state === "alive" && this.finalUntil.has(enemy.id) && this.clock >= this.finalUntil.get(enemy.id)) {
      this.hurt(18, enemy);
      this.finalUntil.set(enemy.id, this.clock + 16e3);
      this.inform("Final Strike qu\xE1 gi\u1EDD! Boss ph\u1EA3n c\xF4ng. Ti\u1EBFp t\u1EE5c ho\xE0n th\xE0nh t\u1EEB.");
    }
    if (this.phase !== "playing") return;
    if (enemy.rage >= 100 && !enemy.attackUntil) enemy.nextAttackAt = Math.min(enemy.nextAttackAt, this.clock);
    if (this.clock < enemy.nextAttackAt) return;
    if (!enemy.attackUntil) {
      enemy.attackKind = enemy.bossPhase >= 2 && (enemy.attackSequence ?? 0) % 2 === 1 ? "charge" : "slam";
      enemy.attackSequence = (enemy.attackSequence ?? 0) + 1;
      enemy.attackStartX = enemy.x;
      enemy.attackTargetPlayerId = this.actorId ?? void 0;
      enemy.attackTargetX = enemy.attackKind === "charge" ? this.playerX : enemy.x;
      enemy.attackUntil = this.clock + (enemy.bossPhase === 3 ? 1100 : 1500);
      this.emit({
        type: "attack",
        enemyId: enemy.id,
        enemyKind: enemy.kind,
        x: enemy.x,
        attackKind: enemy.attackKind,
        targetX: enemy.attackTargetX,
        duration: enemy.attackUntil - this.clock,
        radius: enemy.attackKind === "charge" ? CHARGE_RADIUS : BOSS_SLAM_RANGE,
        ...enemy.attackKind === "charge" ? { laneFrom: enemy.x, laneTo: enemy.attackTargetX } : {},
        bossPhase: enemy.bossPhase
      });
      this.inform(enemy.attackKind === "charge" ? "Tank kh\xF3a \u0111\u01B0\u1EDDng lao \u2014 ch\u1EA1y kh\u1ECFi v\u1EA1ch b\xE1o!" : "Tank gi\u01A1 tay \u2014 s\u1EAFp \u0111\u1EADp \u0111\u1EA5t!", 1500);
    } else if (this.clock >= enemy.attackUntil) {
      const from = enemy.attackStartX ?? enemy.x;
      const targetX = enemy.attackTargetX ?? (enemy.attackKind === "charge" ? this.playerX : enemy.x);
      const charge = enemy.attackKind === "charge";
      const damage = enemy.state === "alive" ? this.hurtArea(
        enemy.bossPhase === 3 ? 16 : 12,
        enemy,
        (x) => charge ? insideLane(x, from, targetX, CHARGE_RADIUS) : Math.abs(targetX - x) <= BOSS_SLAM_RANGE
      ) : 0;
      if (charge && enemy.state === "alive") {
        let destination = targetX;
        const bodies = this.party.size ? this.players.filter((player) => player.hp > 0).map((player) => player.x) : [this.playerX];
        for (const x of bodies) {
          if (from > targetX && x <= from && x >= targetX - 180) destination = Math.min(from, Math.max(destination, x + 180));
          if (from < targetX && x >= from && x <= targetX + 180) destination = Math.max(from, Math.min(destination, x - 180));
        }
        enemy.x = Math.max(-60, Math.min(WORLD_WIDTH + 60, destination));
        for (const gate of this.worldObjects) if (gate.kind === "gate" && gate.state === "closed" && insideLane(gate.x, from, enemy.x, 5)) {
          gate.state = "open";
          this.emit({ type: "world-interact", worldObjectId: gate.id, worldKind: gate.kind, x: gate.x, state: gate.state });
        }
      }
      this.emit({
        type: "attack-impact",
        enemyId: enemy.id,
        enemyKind: enemy.kind,
        attackKind: charge ? "charge" : "slam",
        x: from,
        targetX,
        hit: damage > 0,
        damage,
        ...charge ? { laneFrom: from, laneTo: targetX } : {},
        radius: charge ? CHARGE_RADIUS : BOSS_SLAM_RANGE,
        bossPhase: enemy.bossPhase
      });
      enemy.attackUntil = 0;
      enemy.rage = Math.max(0, enemy.rage - 30);
      enemy.nextAttackAt = this.clock + (enemy.bossPhase === 3 ? 7e3 : 1e4);
    }
  }
  kill(enemy) {
    if (!this.enemies.some((entry) => entry.id === enemy.id)) return;
    this.enemies = this.enemies.filter((entry) => entry.id !== enemy.id);
    this.deck.release(this.reservations.get(enemy.id) ?? []);
    this.reservations.delete(enemy.id);
    this.kills++;
    this.bornAt.delete(enemy.challenge.id);
    this.revealed.delete(enemy.challenge.id);
    this.finalUntil.delete(enemy.id);
    this.emit({ type: "enemy-death", enemyId: enemy.id, x: enemy.x });
    this.nextSpawn = Math.min(this.nextSpawn, this.clock + 1200);
    if (enemy.kind === "tank") {
      this.bossKills++;
      this.score += 1e3;
      if (this.hp > 0) this.hp = Math.min(getHeroCombat(this.heroId).maxHp, this.hp + 20);
      this.nextBoss = this.clock + 18e4;
      this.emit({ type: "boss-defeat", enemyId: enemy.id, x: enemy.x });
      this.inform("Tank \u0111\xE3 b\u1ECB h\u1EA1! +20 HP \xB7 +1000 \u0111i\u1EC3m. Sinh t\u1ED3n ti\u1EBFp t\u1EE5c!", 6e3);
    }
    const available = ["health", "freeze", "damage", "shield"].filter((item) => this.inventory[item] < 5);
    if (available.length && this.rand() < lootChanceFor(enemy.challenge.word)) {
      const item = available[Math.floor(this.rand() * available.length)];
      this.inventory[item]++;
      this.emit({ type: "pickup", item, enemyId: enemy.id, x: enemy.x });
      this.inform("Nh\u1EB7t \u0111\u01B0\u1EE3c ti\u1EBFp t\u1EBF! D\xF9ng ph\xEDm 1\u20134 khi c\u1EA7n.");
    }
    if (this.targetId === enemy.id) {
      this.chooseTarget(null);
      this.input = "";
    }
    if (!this.getTarget()) this.selectUrgent();
  }
  holdAttack(enemy, duration) {
    if (duration <= 0) return;
    if (enemy.attackUntil > this.clock) enemy.attackUntil += duration;
    enemy.nextAttackAt = Math.max(this.clock, enemy.nextAttackAt) + duration;
  }
  hurt(amount, source) {
    if (this.phase !== "playing" || this.hp <= 0 || this.clock - this.lastPlayerHurt < 650) return 0;
    this.lastPlayerHurt = this.clock;
    if (this.clock < this.heroGuardUntil) {
      const skill = getHeroSkill(this.heroId);
      this.heroGuardUntil = this.heroActiveUntil = 0;
      this.emit({
        type: "hero-skill",
        heroId: this.heroId,
        skillId: skill.id,
        visualKind: skill.visualKind,
        x: this.playerX,
        targetX: source.x,
        radius: 0,
        duration: 500,
        value: amount,
        targets: [{ enemyId: source.id, x: source.x }],
        skillPhase: "block"
      });
      return 0;
    }
    if (this.clock < this.heroWardUntil && Math.abs(this.playerX - this.wardX) <= 180) {
      const effect = getHeroSkill(this.heroId).effect;
      if (effect.kind === "ward") amount = Math.round(amount * (1 - effect.reduction) * 100) / 100;
    }
    const before = this.hp;
    this.hp = Math.max(0, this.hp - amount);
    const damage = before - this.hp;
    this.emit({
      type: "player-hurt",
      duration: 400,
      enemyId: source.id,
      enemyKind: source.kind,
      sourceX: source.x,
      x: this.playerX,
      damage
    });
    if (this.hp === 0) {
      this.chooseTarget(null);
      this.input = "";
      this.movement = 0;
      if (!this.party.size || this.players.every((player) => player.hp <= 0)) this.finishRun("defeat");
    }
    return damage;
  }
  checkVocabularyComplete() {
    if (this.phase !== "playing" || this.enemies.length || this.projectiles.length) return;
    if (this.worldObjects.some((object) => object.kind === "barrel" && object.state === "active")) return;
    if (this.deck.availability.remaining > 0) return;
    this.finishRun("vocabulary-complete");
  }
  finishRun(reason) {
    if (this.phase !== "playing") return;
    this.phase = "over";
    this.movement = 0;
    this.clearQueuedAttack();
    this.projectiles = [];
    const minutes = this.clock / 6e4;
    this.summary = {
      id: `${Date.now()}-${this.runSequence}-${Math.round(this.random() * 1e9)}`,
      endedAt: Date.now(),
      score: this.score,
      kills: this.kills,
      words: this.words,
      bestCombo: this.bestCombo,
      durationMs: this.clock,
      accuracy: this.correctKeys + this.wrongKeys ? this.correctKeys / (this.correctKeys + this.wrongKeys) * 100 : 0,
      wpm: minutes > 0 ? this.correctLetters / 5 / minutes : 0,
      bossKills: this.bossKills,
      results: [...this.results.values()].map((result) => ({ ...result })),
      reason
    };
    this.emit({ type: reason === "defeat" ? "game-over" : "vocabulary-complete" });
    if (reason === "vocabulary-complete") this.inform("\u0110\xE3 kh\xE1m ph\xE1 h\u1EBFt b\u1ED9 t\u1EEB m\u1EDBi. Ho\xE0n th\xE0nh!", 6e4);
  }
  inform(message, duration = 3e3) {
    this.notice = message;
    this.noticeUntil = this.clock + duration;
  }
};

// src/game/englishDictionary.ts
var parts = /* @__PURE__ */ new Set(["noun", "verb", "adjective", "adverb", "preposition", "pronoun", "conjunction", "interjection", "determiner", "numeral", "prefix", "suffix", "abbreviation", "unspecified"]);
var isRecord = (value) => !!value && typeof value === "object" && !Array.isArray(value);
var validText = (value, limit) => typeof value === "string" && !!value.trim() && value.length <= limit && !/[\u0000-\u001f\u007f]/u.test(value);
function mergeEnglishDefinitions(words, value) {
  if (!isRecord(value) || value.version !== 1 || !isRecord(value.source) || !validText(value.source.name, 300) || !validText(value.source.license, 1e3) || !validText(value.source.snapshot, 300) || !isRecord(value.entries)) {
    throw new Error("Unsupported English dictionary format");
  }
  const entries = /* @__PURE__ */ new Map();
  for (const [answer, entry] of Object.entries(value.entries)) {
    if (!/^[a-z]{3,18}$/.test(answer) || !isRecord(entry) || !validText(entry.meaning, 240) || !parts.has(entry.partOfSpeech) || entry.vietnameseMeaning !== void 0 && !validText(entry.vietnameseMeaning, 120)) {
      throw new Error("Invalid English dictionary entry");
    }
    entries.set(answer, entry);
  }
  const excluded = /* @__PURE__ */ new Set();
  const renames = /* @__PURE__ */ new Map();
  const quarantined = /* @__PURE__ */ new Set();
  if (value.excluded !== void 0) {
    if (!Array.isArray(value.excluded)) throw new Error("Invalid dictionary exclusions");
    for (const item of value.excluded) {
      if (!isRecord(item) || typeof item.answer !== "string" || !/^[a-z]{3,18}$/.test(item.answer) || !validText(item.reason, 500) || entries.has(item.answer) || item.canonical !== void 0 && (typeof item.canonical !== "string" || !/^[a-z]{3,18}$/.test(item.canonical) || item.canonical === item.answer)) throw new Error("Invalid dictionary exclusions");
      excluded.add(item.answer);
      if (typeof item.canonical === "string") renames.set(item.answer, item.canonical);
    }
  }
  if (value.quarantined !== void 0) {
    if (!Array.isArray(value.quarantined)) throw new Error("Invalid dictionary quarantine");
    for (const item of value.quarantined) {
      if (!isRecord(item) || typeof item.answer !== "string" || !/^[a-z]{3,18}$/.test(item.answer) || !validText(item.reason, 500) || entries.has(item.answer) || excluded.has(item.answer)) throw new Error("Invalid dictionary quarantine");
      quarantined.add(item.answer);
    }
  }
  const original = new Map(words.map((word) => [word.answer, word]));
  const reviewed = new Map(words.filter((word) => !excluded.has(word.answer) && !quarantined.has(word.answer)).map((word) => [word.answer, { ...word }]));
  for (const [from, to] of renames) {
    if (excluded.has(to)) throw new Error("Chained dictionary rename is not supported");
    if (quarantined.has(to)) continue;
    const retired = original.get(from);
    if (!retired) continue;
    const existing = reviewed.get(to);
    if (!existing && !entries.get(to)?.vietnameseMeaning) throw new Error(`Missing corrected dictionary entry: ${to}`);
    reviewed.set(to, {
      ...existing ?? { ...retired, answer: to },
      historyAliases: [.../* @__PURE__ */ new Set([...existing?.historyAliases ?? [], ...retired.historyAliases ?? [], from])].filter((alias) => alias !== to)
    });
  }
  return [...reviewed.values()].map((word) => {
    const entry = entries.get(word.answer);
    if (!entry) {
      if (value.quarantined !== void 0) throw new Error(`Incomplete bilingual dictionary: ${word.answer}`);
      return { ...word };
    }
    if (word.partOfSpeech !== entry.partOfSpeech && !entry.vietnameseMeaning) throw new Error(`Definition part of speech mismatch: ${word.answer}`);
    return {
      ...word,
      englishMeaning: entry.meaning,
      partOfSpeech: entry.partOfSpeech,
      ...entry.vietnameseMeaning ? { meaning: entry.vietnameseMeaning, translationHint: void 0 } : {}
    };
  });
}
function vocabularyForLanguage(words, language) {
  const bank = words.filter((word) => language === "vi" || word.englishMeaning).map((word) => ({
    ...word,
    meaning: language === "en" ? word.englishMeaning : word.meaning,
    translationHint: void 0
  }));
  const groups = /* @__PURE__ */ new Map();
  for (const word of bank) {
    const key = `${word.meaning.toLowerCase().trim().replace(/[.,;:!?]+$/, "")}|${word.partOfSpeech}|${word.answer.length}|${word.answer[0]}|${word.answer.at(-1)}`;
    const group = groups.get(key) ?? [];
    group.push(word);
    groups.set(key, group);
  }
  for (const group of groups.values()) if (group.length > 1) for (const word of group) {
    const visible = /* @__PURE__ */ new Set([0, word.answer.length - 1]);
    for (const other of group) if (other !== word && ![...visible].some((index) => word.answer[index] !== other.answer[index])) {
      const difference = [...word.answer].findIndex((letter, index) => letter !== other.answer[index]);
      if (difference >= 0) visible.add(difference);
    }
    word.translationHint = [...word.answer].map((letter, index) => visible.has(index) ? letter : "_").join(" ");
  }
  return bank;
}

// backend/rooms.mjs
var HEROES = HERO_CHARACTERS.map((hero) => hero.id);
var ITEMS = /* @__PURE__ */ new Set(["health", "freeze", "damage", "shield"]);
var GRACE_MS = 2e4;
var wire = (value) => JSON.stringify(value, (_key, item) => item instanceof Set ? [...item] : item);
var fail = (message, code = "invalid") => {
  throw Object.assign(new Error(message), { code });
};
var RoomHub = class {
  constructor(words, { now = Date.now, Engine = GameEngine, maxRooms = 32 } = {}) {
    this.words = words;
    this.now = now;
    this.Engine = Engine;
    this.maxRooms = maxRooms;
    this.rooms = /* @__PURE__ */ new Map();
    this.sessions = /* @__PURE__ */ new Map();
    this.allowedWords = new Set(words.map((word) => word.answer));
  }
  hello(message, send) {
    if (message.language !== void 0 && !["vi", "en"].includes(message.language)) fail("Ng\xF4n ng\u1EEF kh\xF4ng h\u1EE3p l\u1EC7.");
    if (!Array.isArray(message.seen) || message.seen.length > 1e5 || message.seen.some((word) => typeof word !== "string" || !/^[a-z]{3,18}$/.test(word))) fail("L\u1ECBch s\u1EED t\u1EEB kh\xF4ng h\u1EE3p l\u1EC7.");
    const old = typeof message.resumeToken === "string" ? this.sessions.get(message.resumeToken) : void 0;
    const session = old && this.rooms.has(old.pin) ? old : {
      id: (0, import_node_crypto.randomUUID)(),
      token: (0, import_node_crypto.randomUUID)(),
      heroId: HEROES.includes(message.heroId) ? message.heroId : "soldier",
      language: message.language ?? "vi",
      seen: /* @__PURE__ */ new Set(),
      pin: "",
      connected: true,
      disconnectedAt: 0,
      attempts: [],
      tokens: 100,
      rateAt: this.now(),
      lastMoveAt: 0
    };
    if (session.connected && session.send) session.send({ type: "replaced", error: "Phi\xEAn n\xE0y \u0111\xE3 \u0111\u01B0\u1EE3c m\u1EDF \u1EDF k\u1EBFt n\u1ED1i kh\xE1c." });
    session.send = send;
    session.connected = true;
    session.disconnectedAt = 0;
    for (const word of message.seen) if (this.allowedWords.has(word)) session.seen.add(word);
    this.sessions.set(session.token, session);
    send({ type: "session", token: session.token, selfId: session.id, nextSeq: (session.lastSeq ?? -1) + 1 });
    if (!session.pin) {
      try {
        this.createRoom(session);
      } catch (error) {
        this.sessions.delete(session.token);
        session.connected = false;
        throw error;
      }
    } else {
      const room = this.rooms.get(session.pin);
      room.engine?.setPartyConnected(session.id, true);
      if (room.seenDuring.size) send({ type: "seen", words: [...room.seenDuring] });
      this.broadcastLobby(room);
      this.sendFrame(room, session, []);
    }
    return session;
  }
  lobby(room, session) {
    return {
      status: room.engine && room.engine.snapshotFor(session.id).phase !== "menu" ? "playing" : "lobby",
      pin: room.pin,
      selfId: session.id,
      hostId: room.hostId,
      language: room.language,
      players: room.members.map((member) => ({ id: member.id, name: member.name, heroId: member.heroId, connected: member.connected })),
      error: ""
    };
  }
  broadcastLobby(room) {
    for (const member of room.members) if (member.connected) member.send({ type: "room", room: this.lobby(room, member) });
  }
  createRoom(session) {
    if (this.rooms.size >= this.maxRooms && !(this.rooms.get(session.pin)?.members.length === 1)) fail("M\xE1y ch\u1EE7 \u0111ang \u0111\u1EE7 ph\xF2ng. H\xE3y th\u1EED l\u1EA1i sau.", "capacity");
    this.leave(session);
    let pin;
    do {
      pin = String((0, import_node_crypto.randomInt)(1e5, 1e6));
    } while (this.rooms.has(pin));
    const room = {
      pin,
      hostId: session.id,
      language: session.language,
      members: [session],
      engine: null,
      seenDuring: /* @__PURE__ */ new Set(),
      pendingSeen: [],
      touchedAt: this.now(),
      tickCount: 0,
      match: 0
    };
    session.pin = pin;
    session.name = "Ng\u01B0\u1EDDi ch\u01A1i 1";
    this.rooms.set(pin, room);
    this.broadcastLobby(room);
  }
  leave(session) {
    const room = this.rooms.get(session.pin);
    if (!room) return;
    room.engine?.removePartyPlayer(session.id);
    room.members = room.members.filter((member) => member !== session);
    session.pin = "";
    if (!room.members.length) this.rooms.delete(room.pin);
    else {
      if (room.hostId === session.id) room.hostId = (room.members.find((member) => member.connected) ?? room.members[0]).id;
      this.broadcastLobby(room);
    }
  }
  receive(session, message) {
    if (!message || typeof message !== "object" || typeof message.type !== "string") fail("L\u1EC7nh kh\xF4ng h\u1EE3p l\u1EC7.");
    const now = this.now();
    session.tokens = Math.min(100, session.tokens + Math.max(0, now - session.rateAt) * 0.08);
    session.rateAt = now;
    if (session.tokens < 1) fail("B\u1EA1n g\u1EEDi thao t\xE1c qu\xE1 nhanh.", "rate");
    session.tokens--;
    let room = this.rooms.get(session.pin);
    if (!room) fail("Ph\xF2ng \u0111\xE3 \u0111\xF3ng. H\xE3y t\u1EA1o ph\xF2ng m\u1EDBi.", "missing");
    room.touchedAt = now;
    if (message.type === "create" || message.type === "join") {
      session.attempts = session.attempts.filter((time) => now - time < 6e4);
      if (session.attempts.length >= 10) fail("\u0110\xE3 th\u1EED v\xE0o ph\xF2ng nhi\u1EC1u l\u1EA7n. Ch\u1EDD m\u1ED9t ph\xFAt r\u1ED3i th\u1EED l\u1EA1i.", "rate");
      session.attempts.push(now);
      if (message.type === "create") {
        this.createRoom(session);
        return;
      }
      if (typeof message.pin !== "string" || !/^\d{6}$/.test(message.pin)) fail("M\xE3 ph\xF2ng ph\u1EA3i g\u1ED3m 6 ch\u1EEF s\u1ED1.");
      const next = this.rooms.get(message.pin);
      if (!next) fail("Kh\xF4ng t\xECm th\u1EA5y ph\xF2ng v\u1EDBi m\xE3 n\xE0y.", "missing");
      if (next === room) return;
      if (next.engine && next.engine.snapshot().phase !== "menu") fail("Ph\xF2ng \u0111ang ch\u01A1i. H\xE3y \u0111\u1EE3i tr\u1EADn k\u1EBFt th\xFAc.", "started");
      if (next.members.length >= 4) fail("Ph\xF2ng \u0111\xE3 \u0111\u1EE7 4 ng\u01B0\u1EDDi.", "full");
      const taken = new Set(next.members.map((member) => member.heroId));
      const heroId = taken.has(session.heroId) ? HEROES.find((id) => !taken.has(id)) : session.heroId;
      this.leave(session);
      session.pin = next.pin;
      session.heroId = heroId;
      session.language = next.language;
      const usedNames = new Set(next.members.map((member) => member.name));
      session.name = [1, 2, 3, 4].map((number) => `Ng\u01B0\u1EDDi ch\u01A1i ${number}`).find((name) => !usedNames.has(name));
      next.members.push(session);
      this.broadcastLobby(next);
      return;
    }
    if (message.type === "hero") {
      if (room.engine && room.engine.snapshot().phase !== "menu") fail("Ch\u1EC9 \u0111\u1ED5i anh h\xF9ng tr\u01B0\u1EDBc tr\u1EADn.");
      if (!HEROES.includes(message.heroId)) fail("Anh h\xF9ng kh\xF4ng h\u1EE3p l\u1EC7.");
      if (room.members.some((member) => member !== session && member.heroId === message.heroId)) fail("Anh h\xF9ng n\xE0y \u0111\xE3 c\xF3 ng\u01B0\u1EDDi ch\u1ECDn.", "hero-taken");
      session.heroId = message.heroId;
      this.broadcastLobby(room);
      return;
    }
    if (message.type === "language") {
      if (room.hostId !== session.id) fail("Ch\u1EC9 ch\u1EE7 ph\xF2ng \u0111\u1ED5i ng\xF4n ng\u1EEF.", "host-only");
      if (room.engine && room.engine.snapshot().phase !== "menu") fail("Ch\u1EC9 \u0111\u1ED5i ng\xF4n ng\u1EEF tr\u01B0\u1EDBc tr\u1EADn.");
      if (!["vi", "en"].includes(message.language)) fail("Ng\xF4n ng\u1EEF kh\xF4ng h\u1EE3p l\u1EC7.");
      if (message.language === "en" && !this.words.some((word) => word.englishMeaning)) fail("Kho t\u1EEB ti\u1EBFng Anh ch\u01B0a s\u1EB5n s\xE0ng.");
      room.language = message.language;
      for (const member of room.members) member.language = room.language;
      this.broadcastLobby(room);
      return;
    }
    if (message.type === "start") {
      if (room.hostId !== session.id) fail("Ch\u1EC9 ch\u1EE7 ph\xF2ng c\xF3 th\u1EC3 b\u1EAFt \u0111\u1EA7u.", "host-only");
      if (!["survival", "boss"].includes(message.mode)) fail("Ch\u1EBF \u0111\u1ED9 kh\xF4ng h\u1EE3p l\u1EC7.");
      if (room.engine && ["playing", "paused", "countdown"].includes(room.engine.snapshot().phase)) fail("Tr\u1EADn \u0111ang di\u1EC5n ra.");
      if (room.members.some((member) => !member.connected)) fail("H\xE3y \u0111\u1EE3i \u0111\u1ED3ng \u0111\u1ED9i k\u1EBFt n\u1ED1i l\u1EA1i.");
      const bank = vocabularyForLanguage(this.words, room.language);
      if (!bank.length) fail("Kho t\u1EEB ti\u1EBFng Anh ch\u01B0a s\u1EB5n s\xE0ng.");
      const seen = Object.fromEntries([...new Set(room.members.flatMap((member) => [...member.seen]))].map((word) => [word, 1]));
      room.seenDuring.clear();
      room.pendingSeen = [];
      room.match++;
      room.engine = new this.Engine(Math.random, { highScore: 0, runs: 0, totalWords: 0, words: {}, seenWords: seen }, (word) => {
        room.seenDuring.add(word.answer);
        room.pendingSeen.push(word.answer);
        for (const member of room.members) member.seen.add(word.answer);
      }, bank);
      room.engine.configureParty(room.members.map((member) => ({ id: member.id, name: member.name, heroId: member.heroId })));
      room.engine.start(message.mode);
      this.broadcastLobby(room);
      this.broadcastFrame(room);
      return;
    }
    if (message.type === "lobby") {
      if (room.hostId !== session.id) fail("Ch\u1EC9 ch\u1EE7 ph\xF2ng m\u1EDF l\u1EA1i s\u1EA3nh.", "host-only");
      if (room.engine?.snapshot().phase !== "over") fail("Tr\u1EADn ch\u01B0a k\u1EBFt th\xFAc.");
      room.engine = null;
      this.broadcastLobby(room);
      return;
    }
    if (message.type !== "command" || !room.engine) fail("Ch\u01B0a c\xF3 tr\u1EADn \u0111ang ch\u01A1i.");
    if (!Number.isSafeInteger(message.seq) || message.seq < 0 || message.seq <= (session.lastSeq ?? -1)) return;
    const command = message.command;
    if (!command || typeof command !== "object") fail("Thao t\xE1c kh\xF4ng h\u1EE3p l\u1EC7.");
    let action;
    if (command.kind === "type" && typeof command.key === "string" && (/^[a-z]$/i.test(command.key) || command.key === "Backspace")) action = () => room.engine.typeKey(command.key);
    else if (command.kind === "move" && [-1, 0, 1].includes(command.direction)) {
      session.lastMoveAt = now;
      action = () => room.engine.setMovement(command.direction);
    } else if (command.kind === "cancel-approach") action = () => room.engine.cancelApproach();
    else if (command.kind === "cycle" && [-1, 1].includes(command.direction)) action = () => room.engine.cycleTarget(command.direction);
    else if (command.kind === "item" && ITEMS.has(command.item)) action = () => room.engine.useItem(command.item);
    else if (command.kind === "interact") action = () => room.engine.interactWorld();
    else fail("Thao t\xE1c kh\xF4ng h\u1EE3p l\u1EC7.");
    session.lastSeq = message.seq;
    room.engine.commandAs(session.id, action);
  }
  disconnect(session, send) {
    if (session.send !== send) return;
    session.connected = false;
    session.disconnectedAt = this.now();
    const room = this.rooms.get(session.pin);
    room?.engine?.setPartyConnected(session.id, false);
    if (room) {
      if (room.hostId === session.id) room.hostId = (room.members.find((member) => member.connected) ?? session).id;
      this.broadcastLobby(room);
    }
  }
  sendFrame(room, member, events) {
    if (!room.engine || !member.connected) return;
    const snapshot = room.engine.snapshotFor(member.id);
    if (snapshot.summary) snapshot.summary = { ...snapshot.summary, id: `${room.pin}:${room.match}:${snapshot.summary.id}` };
    member.send({
      type: "frame",
      clock: room.engine.clock,
      snapshot,
      enemies: room.engine.enemies,
      worldObjects: room.engine.worldObjects ?? [],
      events,
      ack: member.lastSeq ?? -1
    });
  }
  broadcastFrame(room) {
    if (!room.engine) return;
    const events = room.engine.drainEvents();
    for (const member of room.members) if (member.connected) {
      if (room.pendingSeen.length) member.send({ type: "seen", words: room.pendingSeen });
      this.sendFrame(room, member, events);
    }
    room.pendingSeen = [];
  }
  step(delta = 25) {
    const now = this.now();
    for (const session of this.sessions.values()) {
      if (!session.connected && now - session.disconnectedAt >= GRACE_MS) {
        this.leave(session);
        this.sessions.delete(session.token);
      }
    }
    for (const room of this.rooms.values()) {
      if (!room.engine) continue;
      for (const member of room.members) if (now - member.lastMoveAt > 1200) room.engine.commandAs(member.id, () => room.engine.setMovement(0));
      room.engine.step(Math.min(100, Math.max(0, delta)));
      if (++room.tickCount % 2 === 0) this.broadcastFrame(room);
    }
  }
};
function attachRooms(server, words, { corsOrigins = "*", now = Date.now } = {}) {
  const hub = new RoomHub(words, { now });
  const wss = new import_websocket_server.default({ noServer: true, maxPayload: 2 * 1024 * 1024, perMessageDeflate: false });
  const connectionRates = /* @__PURE__ */ new Map();
  server.on("upgrade", (request, socket, head) => {
    const origin = request.headers.origin;
    const ip = socket.remoteAddress ?? "unknown";
    const record = connectionRates.get(ip) ?? { at: now(), count: 0 };
    if (now() - record.at > 6e4) {
      record.at = now();
      record.count = 0;
    }
    record.count++;
    connectionRates.set(ip, record);
    if (request.url !== "/api/rooms" || corsOrigins !== "*" && origin && !corsOrigins.has(origin) || wss.clients.size >= 128 || record.count > 30) {
      socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
      socket.destroy();
      return;
    }
    wss.handleUpgrade(request, socket, head, (ws) => wss.emit("connection", ws));
  });
  wss.on("connection", (ws) => {
    let session, alive = true;
    const send = (value) => {
      if (ws.readyState !== import_websocket.default.OPEN) return;
      if (ws.bufferedAmount > 1024 * 1024) {
        ws.close(1013, "Connection too slow");
        return;
      }
      ws.send(wire(value));
      if (value.type === "replaced") ws.close(4001, "Session replaced");
    };
    const helloTimeout = setTimeout(() => {
      if (!session) ws.close(1008, "Hello required");
    }, 1e4);
    helloTimeout.unref();
    ws.on("pong", () => {
      alive = true;
    });
    ws.on("message", (data, binary) => {
      try {
        if (session && session.send !== send) return;
        if (binary) fail("Ch\u1EC9 nh\u1EADn d\u1EEF li\u1EC7u v\u0103n b\u1EA3n.");
        const message = JSON.parse(data.toString());
        if (!session) {
          if (message?.type !== "hello") fail("C\u1EA7n k\u1EBFt n\u1ED1i v\xE0o ph\xF2ng tr\u01B0\u1EDBc.");
          session = hub.hello(message, send);
          clearTimeout(helloTimeout);
        } else hub.receive(session, message);
      } catch (error) {
        send({ type: "error", error: error.code ? error.message : "Kh\xF4ng x\u1EED l\xFD \u0111\u01B0\u1EE3c thao t\xE1c. H\xE3y th\u1EED l\u1EA1i.", code: error.code ?? "invalid" });
        if (!session) ws.close(1008, "Unable to join");
      }
    });
    const heartbeat = setInterval(() => {
      if (!alive) {
        ws.terminate();
        return;
      }
      alive = false;
      ws.ping();
    }, 15e3);
    heartbeat.unref();
    ws.on("error", () => {
    });
    ws.on("close", () => {
      clearTimeout(helloTimeout);
      clearInterval(heartbeat);
      if (session) hub.disconnect(session, send);
    });
  });
  let previous = now();
  const timer = setInterval(() => {
    const current = now();
    hub.step(current - previous);
    previous = current;
    for (const [ip, record] of connectionRates) if (current - record.at > 6e4) connectionRates.delete(ip);
  }, 25);
  timer.unref();
  const close = () => {
    clearInterval(timer);
    for (const ws of wss.clients) ws.close(1001, "Server restarting");
    wss.close();
  };
  server.once("close", close);
  return { hub, close };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  RoomHub,
  attachRooms,
  mergeEnglishDefinitions
});
