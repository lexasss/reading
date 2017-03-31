var DGWM =
/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId])
/******/ 			return installedModules[moduleId].exports;
/******/
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.l = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// identity function for calling harmony imports with the correct context
/******/ 	__webpack_require__.i = function(value) { return value; };
/******/
/******/ 	// define getter function for harmony exports
/******/ 	__webpack_require__.d = function(exports, name, getter) {
/******/ 		if(!__webpack_require__.o(exports, name)) {
/******/ 			Object.defineProperty(exports, name, {
/******/ 				configurable: false,
/******/ 				enumerable: true,
/******/ 				get: getter
/******/ 			});
/******/ 		}
/******/ 	};
/******/
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = function(module) {
/******/ 		var getter = module && module.__esModule ?
/******/ 			function getDefault() { return module['default']; } :
/******/ 			function getModuleExports() { return module; };
/******/ 		__webpack_require__.d(getter, 'a', getter);
/******/ 		return getter;
/******/ 	};
/******/
/******/ 	// Object.prototype.hasOwnProperty.call
/******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(__webpack_require__.s = 5);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


const Logger = {
    enabled: false
};

Logger.moduleErrorPrinter = (moduleName) => {
    if (this.Reading !== undefined) {
        return () => { };
    }

    return (missingService) => {
        console.error( 'Missing "${missingService}" service for "${moduleName}"' );
    };
};

Logger.moduleLogPrinter = (moduleName) => {
    const print = (item) => {
        console.log( item );
    };

    if (this.Reading !== undefined) {
        return () => { };
    }

    return (title) => {
        if (!Logger.enabled) {
            return;
        }

        console.log( '\n', moduleName );
        console.log( title );
        for (let i = 1; i < arguments.length; i += 1) {
            const data = arguments[i];
            if (data === undefined) {
                continue;
            }
            if (data instanceof Array) {
                data.forEach( print );
            }
            else {
                console.log( data );
            }
        }
    };
};

Logger.forModule = (moduleName) => {
    // if (this.Reading !== undefined) {
    //     return () => { };
    // }

    return {
        start: (title) => {
            return new Record( moduleName, title );
        },
        end: (record) => {
            records.delete( record.id );
        },
        log: function () {
            if (!Logger.enabled) {
                return;
            }
            console.log( moduleName, ...arguments );
        }
    };
};

function Record (module, title) {
    this.id = Symbol( title );
    this._record = []; //title ? [ title ] : [];
    this.level = 0;

    this.generalPadding = '';
    for (let i = 0; i < records.size; i += 1) {
        this.generalPadding += Record.padding;
    }

    records.set( this.id, this );

    if (!Logger.enabled) {
        return;
    }

    console.log( '' + this.generalPadding + module + (title ? ' # ' + title : '') );
}

Record.padding = '    ';

Record.prototype.push = function () {
    let levelPadding = '';
    for (let i = 0; i < this.level; i += 1) {
        levelPadding += Record.padding;
    }
    //this._record.push( padding + Array.prototype.join.call( arguments, ' ' ) );
    if (!Logger.enabled) {
        return;
    }
    console.log( Record.padding + this.generalPadding + levelPadding + Array.prototype.join.call( arguments, ' ' ) );
};

Record.prototype.levelUp = function (text) {
    if (text !== undefined) {
        this.push( text );
    }
    this.level += 1;
};

Record.prototype.levelDown = function () {
    this.level -= 1;
    if (this.level < 0) {
        this.level = 0;
    }
};

Record.prototype.notEmpty = function () {
    return this._record.length > 0;
};

Record.prototype.print = function () {
    if (!Logger.enabled) {
        return;
    }
    console.log( Record.padding + this.generalPadding + this._record.join( '\n' + Record.padding ) );
};

const records = new Map();


module.exports = Logger;


/***/ }),
/* 1 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
// Requires:
//      libs/regression
//      utils/logger


const regression = __webpack_require__(4);
const Logger = __webpack_require__(0);

// Line object
function Line (word, wordID, element, index, prevLine) {
    this.left = Number.MAX_VALUE;
    this.top = Number.MAX_VALUE;
    this.right = Number.MIN_VALUE;
    this.bottom = Number.MIN_VALUE;
    this.center = undefined;

    this.index = index || 0;
    this.previous = prevLine || null;
    this.next = null;
    if (this.previous) {
        this.previous.next = this;
    }

    this.fixations = [];
    this.fitEq = null;

    this.words = [];

    if (word) {
        this.addWord( word, wordID, element );
    }
}

Line.init = function (options) {
    _logger = Logger.forModule( 'Line' );

    options = options || {};

    _useModel = options.useModel || false;
    _modelMaxGradient = options.modelMaxGradient || 0.15;
    _modelTypeSwitchThreshold = options.modelTypeSwitchThreshold || 8;
    _modelRemoveOldFixThreshold = options.modelRemoveOldFixThreshold || 10;
};

Line.prototype.width = function () {
    return this.right - this.left;
};

Line.prototype.addWord = function (word, wordID, element) {
    this.left = Math.min( this.left, word.left );
    this.right = Math.max( this.right, word.right );
    this.top = Math.min( this.top, word.top );
    this.bottom = Math.max( this.bottom, word.bottom );

    this.center = {
        x: (this.left + this.right) / 2,
        y: (this.top + this.bottom) / 2
    };

    this.words.push( new Word( word, wordID, element, this ) );
};

Line.prototype.addFixation = function (fixation) {

    this.fixations.push( [fixation.x, fixation.y, fixation.saccade, fixation.id] );
    if (!_useModel || this.fixations.length < 2) {
        return;
    }

    _log = _logger.start( 'addFixation' );

    this._removeOldFixation();
    const type = this.fixations.length < _modelTypeSwitchThreshold ? 'linear' : 'polynomial';
    const model = regression.model( type, this.fixations, 2 );
    this.fitEq = model.equation;
    _log.push( 'model for line', this.index, ':', this.fitEq.map( x => x.toFixed(3) ) );

    if (type === 'linear') {    // put restriction on the gradient
        if (this.fitEq[1] < -_modelMaxGradient) {
            this.fitEq = fixLinearModel( this.fixations, -_modelMaxGradient );
            _log.push( 'model reset to', this.fitEq[0].toFixed(0), ',', this.fitEq[1].toFixed(3) );
        }
        else if (this.fitEq[1] > _modelMaxGradient) {
            this.fitEq = fixLinearModel( this.fixations, _modelMaxGradient );
            _log.push( 'model reset to', this.fitEq[0].toFixed(0), ',', this.fitEq[1].toFixed(3) );
        }
    }

    _logger.end( _log );
};

// returns difference between model x and the actual x
Line.prototype.fit = function (x, y) {
    if (this.fitEq) {
        const result = y - regression.fit( this.fitEq, x );
        //_logger.log( 'fitting', x, 'to line', this.index, ': error is ', result );
        const log = _logger.start( 'fit' );
        log.push( 'e[', this.index, '|', x, y, '] =', Math.floor( result ) );
        _logger.end( log );

        return result;
    }
    return Number.MAX_VALUE;
};

Line.prototype._removeOldFixation = function () {
    const lastIndex = this.fixations.length - 1;
    if (lastIndex < 5) {
        return;
    }

    let index = lastIndex;
    let fix;
    while (index > 0) {
        fix = this.fixations[ index ];
        if (index > 0 && fix[2].newLine) {       // the current line started here
            if (lastIndex - index + 1 > _modelRemoveOldFixThreshold) {     // lets have at least N fixations
                this.fixations = this.fixations.slice( index );
                _log.push( 'line fixations: reduced' );
            }
            break;
        }
        index -= 1;
    }
};

// internal
let _useModel;
let _modelMaxGradient;
let _modelTypeSwitchThreshold;
let _modelRemoveOldFixThreshold;

let _logger;
let _log;

function fixLinearModel (fixations, gradient) {
    let sum = 0;
    for (let i = 0; i < fixations.length; ++i) {
        const fix = fixations[i];
        sum += fix[1] - gradient * fix[0];
    }
    return [sum / fixations.length, gradient];
}

// Word object
function Word (rect, id, element, line) {
    this.rect = rect;
    this.id = id;
    this.element = element;
    this.line = line;
    this.index = line.words.length;
    this.text = element.textContent;
    this.fixations = [];
}

Word.prototype.toString = function () {
    return this.rect.left + ',' + this.rect.top + ' / ' + this.line.index;
};

// Publication
module.exports = {
    Line,
    Word
};


/***/ }),
/* 2 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
// Requires:
//      model/zone


// Fixation detector
const Detector = {

    init: function (options) {
        options = options || {};

        _minDuration = options.minDuration || 80;
        _threshold = options.threshold || 70;
        _sampleDuration = options.sampleDuration || 33;
        _lpc = options.filterDemph || 0.4;
        _invLpc = 1 - _lpc;

        _currentFixation = new Fixation( -10000, -10000, Number.MAX_VALUE );
        _currentFixation.saccade = new Saccade( 0, 0 );
    },

    feed: function (data1, data2) {

        let result;
        if (data2 !== undefined) {    // this is smaple
            result = parseSample( data1, data2 );
        }
        else {
            result = parseFixation( data1 );
        }
        return result;
    },

    add: function (x, y, duration) {
        if (duration < _minDuration) {
            return null;
        }

        const fixation = new Fixation( x, y, duration );
        fixation.previous = _currentFixation;
        _currentFixation.next = fixation;

        fixation.saccade = new Saccade( x - _currentFixation.x, y - _currentFixation.y );

        _currentFixation = fixation;

        return _currentFixation;
    },

    reset: function () {
        _fixations.length = 0;

        _currentFixation = new Fixation(-10000, -10000, Number.MAX_VALUE);
        _currentFixation.saccade = new Saccade(0, 0);

        _candidate = null;
    },

    current: function() {
        return _currentFixation;
    }
};

// internal
let _minDuration;
let _threshold;
let _sampleDuration;
let _lpc;

let _fixations = [];
let _currentFixation;
let _candidate = null;

let _invLpc;

function parseSample (x, y) {
    const dx = x - _currentFixation.x;
    const dy = y - _currentFixation.y;
    let result;

    if (Math.sqrt( dx * dx + dy * dy) > _threshold) {
        if (_candidate === null) {
            _candidate = new Fixation(x, y, _sampleDuration);
            _candidate.previous = _currentFixation;
            _candidate.saccade = new Saccade(x - _currentFixation.x, y - _currentFixation.y);
            _currentFixation.next = _candidate;
        }
        else {
            _candidate.x = _lpc * x + _invLpc * _candidate.x;
            _candidate.y = _lpc * y + _invLpc * _candidate.y;
            _candidate.duration += _sampleDuration;
            _currentFixation = _candidate;
            _candidate = null;
        }
    }
    else {
        _candidate = null;
        const prevDuration = _currentFixation.duration;
        _currentFixation.duration += _sampleDuration;
        _currentFixation.x = _lpc * _currentFixation.x + _invLpc * x;
        _currentFixation.y = _lpc * _currentFixation.y + _invLpc * y;

        if (prevDuration < _minDuration && _currentFixation.duration >= _minDuration) {
            result = _currentFixation;
        }
    }

    return result;
}

function parseFixation (progressingFixation) {
    let result;

    if (progressingFixation.duration < _minDuration) {
        return result;
    }

    if (_currentFixation.duration > progressingFixation.duration) {
        const fixation = new Fixation( progressingFixation.x, progressingFixation.y, progressingFixation.duration );
        fixation.previous = _currentFixation;
        _currentFixation.next = fixation;

        const saccade = progressingFixation.saccade;
        if (saccade) {
            fixation.saccade = new Saccade( saccade.dx, saccade.dy );
        }
        else {
            fixation.saccade = new Saccade( progressingFixation.x - _currentFixation.x,
                                            progressingFixation.y - _currentFixation.y );
        }

        _currentFixation = fixation;
        _fixations.push( _currentFixation );

        result = _currentFixation;
    }
    else {
        _currentFixation.duration = progressingFixation.duration;
        _currentFixation.x = progressingFixation.x;
        _currentFixation.y = progressingFixation.y;
    }

    return result;
}

// Fixation
function Fixation (x, y, duration) {
    this.x = x;
    this.y = y;
    this.duration = duration;
    this.saccade = null;
    this.word = null;
    this.previous = null;
    this.next = null;
}

Fixation.prototype.toString = function () {
    return 'FIX ' + this.x + ',' + this.y + ' / ' + this.duration +
        'ms SACC=[' + this.saccade + '], WORD=[' + this.word + ']';
};

// Saccade
function Saccade (x, y) {
    this.x = x;
    this.y = y;
    this.newLine = false;
}

Saccade.prototype.toString = function () {
    return this.x + ',' + this.y + ' / ' + this.zone +
        (this.newLine ? ', new line' : '');
};

// Publication
module.exports = {
    Detector,
    Fixation,
    Saccade
};

/***/ }),
/* 3 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


const Logger = __webpack_require__(0);
const Line = __webpack_require__(1).Line;

const TextModel = {

    init: function (options) {
        options = options || {};

        _isTextFixed = options.isTextFixed || true;

        _logger = Logger.forModule( 'TextModel' );
    },

    create: function (elements) {
        if (_isTextFixed && _lines.length > 0) {
            return null;
        }

        _log = _logger.start( 'create' );

        this.reset();
        compute( elements );

        _log.push( _lines.length + ' lines' );
        _logger.end( _log );

        return this.model();
    },

    reset: function () {
        // _lines.forEach(function (line) {
        //     line.forEach(function (w) {
        //         _logger.log('new Word({ left: ' + w.rect.left +
        //             ', top: ' + w.rect.top +
        //             ', right: ' + w.rect.right +
        //             ', bottom: ' + w.rect.bottom + ' }),');
        //     });
        // });
        _lines = [];
        _lineSpacing = 0;
        _lineHeight = 0;
        _lineWidth = 0;
    },

    model: function () {
        return {
            lines: _lines,
            lineSpacing: _lineSpacing,
            lineHeight: _lineHeight,
            lineWidth: _lineWidth
        };
    }
};

let _isTextFixed;

let _lines = [];
let _lineSpacing;
let _lineHeight;
let _lineWidth;

let _log;
let _logger;

function compute (elements) {

    let lineY = 0;
    let currentLine = null;

    for (let i = 0; i < elements.length; i += 1) {
        const element = elements[i];
        const rect = element.getBoundingClientRect();
        if (lineY < rect.top || !currentLine) {
            if (currentLine) {
                _lineSpacing += rect.top - currentLine.top;
                _lineHeight += currentLine.bottom - currentLine.top;
                if (_lineWidth < currentLine.right - currentLine.left) {
                    _lineWidth = currentLine.right - currentLine.left;
                }
            }
            currentLine = new Line( rect, i, element, _lines.length, _lines[ _lines.length - 1 ] );
            _lines.push( currentLine );
            lineY = rect.top;
        }
        else {
            currentLine.addWord( rect, i, element );
        }
//                _logger.log('{ left: ' + Math.round(rect.left) + ', top: ' + Math.round(rect.top) + ', right: ' + Math.round(rect.right) + ', bottom: ' + Math.round(rect.bottom) + ' }');
    }

    if (currentLine) {
        _lineHeight += currentLine.bottom - currentLine.top;
        _lineHeight /= _lines.length;
        if (_lineWidth < currentLine.right - currentLine.left) {
            _lineWidth = currentLine.right - currentLine.left;
        }
    }

    if (_lines.length > 1) {
        _lineSpacing /= _lines.length - 1;
    }
    else if (_lines.length > 0) {
        const line = _lines[0];
        _lineSpacing = 2 * (line.bottom - line.top);
    }
}

// Publication
module.exports = TextModel;


/***/ }),
/* 4 */
/***/ (function(module, exports, __webpack_require__) {

/**
* @license
*
* Regression.JS - Regression functions for javascript
* http://tom-alexander.github.com/regression-js/
*
* copyright(c) 2013 Tom Alexander
* Licensed under the MIT license.
*
**/

;(function() {
    'use strict';

    var gaussianElimination = function(a, o) {
           var i = 0, j = 0, k = 0, maxrow = 0, tmp = 0, n = a.length - 1, x = new Array(o);
           for (i = 0; i < n; i++) {
              maxrow = i;
              for (j = i + 1; j < n; j++) {
                 if (Math.abs(a[i][j]) > Math.abs(a[i][maxrow]))
                    maxrow = j;
              }
              for (k = i; k < n + 1; k++) {
                 tmp = a[k][i];
                 a[k][i] = a[k][maxrow];
                 a[k][maxrow] = tmp;
              }
              for (j = i + 1; j < n; j++) {
                 for (k = n; k >= i; k--) {
                    a[k][j] -= a[k][i] * a[i][j] / a[i][i];
                 }
              }
           }
           for (j = n - 1; j >= 0; j--) {
              tmp = 0;
              for (k = j + 1; k < n; k++)
                 tmp += a[k][j] * x[k];
              x[j] = (a[n][j] - tmp) / a[j][j];
           }
           return (x);
    };

    var methods = {
        linear: function(data) {
            var sum = [0, 0, 0, 0, 0], n = 0, results = [];

            for (; n < data.length; n++) {
              if (data[n][1] != null) {
                sum[0] += data[n][0];
                sum[1] += data[n][1];
                sum[2] += data[n][0] * data[n][0];
                sum[3] += data[n][0] * data[n][1];
                sum[4] += data[n][1] * data[n][1];
              }
            }

            var gradient = (n * sum[3] - sum[0] * sum[1]) / (n * sum[2] - sum[0] * sum[0]);
            var intercept = (sum[1] / n) - (gradient * sum[0]) / n;
          //  var correlation = (n * sum[3] - sum[0] * sum[1]) / Math.sqrt((n * sum[2] - sum[0] * sum[0]) * (n * sum[4] - sum[1] * sum[1]));

            for (var i = 0, len = data.length; i < len; i++) {
                var coordinate = [data[i][0], data[i][0] * gradient + intercept];
                results.push(coordinate);
            }

            var string = 'y = ' + Math.round(gradient*100) / 100 + 'x + ' + Math.round(intercept*100) / 100;

            return {equation: [intercept, gradient], points: results, string: string};
        },

        linearThroughOrigin: function(data) {
            var sum = [0, 0], n = 0, results = [];

            for (; n < data.length; n++) {
                if (data[n][1] != null) {
                    sum[0] += data[n][0] * data[n][0]; //sumSqX
                    sum[1] += data[n][0] * data[n][1]; //sumXY
                }
            }

            var gradient = sum[1] / sum[0];

            for (var i = 0, len = data.length; i < len; i++) {
                var coordinate = [data[i][0], data[i][0] * gradient];
                results.push(coordinate);
            }

            var string = 'y = ' + Math.round(gradient*100) / 100 + 'x';

            return {equation: [0, gradient], points: results, string: string};
        },

        exponential: function(data) {
            var sum = [0, 0, 0, 0, 0, 0], n = 0, results = [];

            for (len = data.length; n < len; n++) {
              if (data[n][1] != null) {
                sum[0] += data[n][0];
                sum[1] += data[n][1];
                sum[2] += data[n][0] * data[n][0] * data[n][1];
                sum[3] += data[n][1] * Math.log(data[n][1]);
                sum[4] += data[n][0] * data[n][1] * Math.log(data[n][1]);
                sum[5] += data[n][0] * data[n][1];
              }
            }

            var denominator = (sum[1] * sum[2] - sum[5] * sum[5]);
            var A = Math.pow(Math.E, (sum[2] * sum[3] - sum[5] * sum[4]) / denominator);
            var B = (sum[1] * sum[4] - sum[5] * sum[3]) / denominator;

            for (var i = 0, len = data.length; i < len; i++) {
                var coordinate = [data[i][0], A * Math.pow(Math.E, B * data[i][0])];
                results.push(coordinate);
            }

            var string = 'y = ' + Math.round(A*100) / 100 + 'e^(' + Math.round(B*100) / 100 + 'x)';

            return {equation: [A, B], points: results, string: string};
        },

        logarithmic: function(data) {
            var sum = [0, 0, 0, 0], n = 0, results = [];

            for (len = data.length; n < len; n++) {
              if (data[n][1] != null) {
                sum[0] += Math.log(data[n][0]);
                sum[1] += data[n][1] * Math.log(data[n][0]);
                sum[2] += data[n][1];
                sum[3] += Math.pow(Math.log(data[n][0]), 2);
              }
            }

            var B = (n * sum[1] - sum[2] * sum[0]) / (n * sum[3] - sum[0] * sum[0]);
            var A = (sum[2] - B * sum[0]) / n;

            for (var i = 0, len = data.length; i < len; i++) {
                var coordinate = [data[i][0], A + B * Math.log(data[i][0])];
                results.push(coordinate);
            }

            var string = 'y = ' + Math.round(A*100) / 100 + ' + ' + Math.round(B*100) / 100 + ' ln(x)';

            return {equation: [A, B], points: results, string: string};
        },

        power: function(data) {
            var sum = [0, 0, 0, 0], n = 0, results = [];

            for (len = data.length; n < len; n++) {
              if (data[n][1] != null) {
                sum[0] += Math.log(data[n][0]);
                sum[1] += Math.log(data[n][1]) * Math.log(data[n][0]);
                sum[2] += Math.log(data[n][1]);
                sum[3] += Math.pow(Math.log(data[n][0]), 2);
              }
            }

            var B = (n * sum[1] - sum[2] * sum[0]) / (n * sum[3] - sum[0] * sum[0]);
            var A = Math.pow(Math.E, (sum[2] - B * sum[0]) / n);

            for (var i = 0, len = data.length; i < len; i++) {
                var coordinate = [data[i][0], A * Math.pow(data[i][0] , B)];
                results.push(coordinate);
            }

             var string = 'y = ' + Math.round(A*100) / 100 + 'x^' + Math.round(B*100) / 100;

            return {equation: [A, B], points: results, string: string};
        },

        polynomial: function(data, order) {
            if(typeof order == 'undefined'){
                order = 2;
            }
             var lhs = [], rhs = [], results = [], a = 0, b = 0, i = 0, k = order + 1;

                    for (; i < k; i++) {
                       for (var l = 0, len = data.length; l < len; l++) {
                          if (data[l][1] != null) {
                           a += Math.pow(data[l][0], i) * data[l][1];
                          }
                        }
                        lhs.push(a), a = 0;
                        var c = [];
                        for (var j = 0; j < k; j++) {
                           for (var l = 0, len = data.length; l < len; l++) {
                              if (data[l][1] != null) {
                               b += Math.pow(data[l][0], i + j);
                              }
                            }
                            c.push(b), b = 0;
                        }
                        rhs.push(c);
                    }
            rhs.push(lhs);

           var equation = gaussianElimination(rhs, k);

                for (var i = 0, len = data.length; i < len; i++) {
                    var answer = 0;
                    for (var w = 0; w < equation.length; w++) {
                        answer += equation[w] * Math.pow(data[i][0], w);
                    }
                    results.push([data[i][0], answer]);
                }

                var string = 'y = ';

                for(var i = equation.length-1; i >= 0; i--){
                  if(i > 1) string += Math.round(equation[i] * Math.pow(10, i)) / Math.pow(10, i)  + 'x^' + i + ' + ';
                  else if (i == 1) string += Math.round(equation[i]*100) / 100 + 'x' + ' + ';
                  else string += Math.round(equation[i]*100) / 100;
                }

            return {equation: equation, points: results, string: string};
        },

        lastvalue: function(data) {
          var results = [];
          var lastvalue = null;
          for (var i = 0; i < data.length; i++) {
            if (data[i][1]) {
              lastvalue = data[i][1];
              results.push([data[i][0], data[i][1]]);
            }
            else {
              results.push([data[i][0], lastvalue]);
            }
          }

          return {equation: [lastvalue], points: results, string: "" + lastvalue};
        }
    };

    var regression = {

      model: function(method, data, order) {

        if (typeof method == 'string') {
          return methods[method](data, order);
        }
      },

      fit: function (equation, x) {
        var result = 0;
        var value = 1;

        if (!equation) {
          return Number.MAX_VALUE;
        }

        for (var i = 0; i < equation.length; ++i) {
          result += equation[i] * value;
          value *= x;
        }

        return result;
      }
    };

    if (true) {
        module.exports = regression;
    } else {
        window.regression = regression;
    }

}());


/***/ }),
/* 5 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
// Reading model


const Logger = __webpack_require__(0);
const Line = __webpack_require__(1).Line;
const TextModel = __webpack_require__(3);
const Fixations = __webpack_require__(2);

const DGWM = {

    // Initializes the model
    // Arguments:
    //      settings
    init: function (options) {
        options = options || {};
        options.dgwm = options.dgwm || {};

        _saccadeYThresholdInLines = options.dgwm.saccadeYThresholdInLines || 1.2;
        _saccadeYThresholdInSpacings = options.dgwm.saccadeYThresholdInSpacings || 1.75;
        _fixationXDistFromLineThresholdInPixels = options.dgwm.fixationXDistFromLineThresholdInPixels || 200;
        _fixationYDistFromLineThresholdInSpaces = options.dgwm.fixationYDistFromLineThresholdInSpaces || 0.65;
        _fixationYOffsetDiffThresholdInLines = options.dgwm.fixationYOffsetDiffThresholdInLines || 1.0;
        _emptyLineSuperority = options.dgwm.emptyLineSuperority || 0.3;
        _effectiveLengthReductionMinWordLength = options.dgwm.effectiveLengthReductionMinWordLength || 2;
        _effectiveLengthReductionInChars = options.dgwm.effectiveLengthReductionInChars || 3;

        Line.init( options.line );

        TextModel.init( options.textModel );

        _fixationDetector = Fixations.Detector;
        _fixationDetector.init( options.fixationDetector );

        _logger = Logger.forModule( 'DGWM' );
    },

    feedFixation: function (fixation) {
        if (!fixation) {
            return null;
        }

        _lastFixation = fixation;

        _log = _logger.start( 'feedFixation' );
        _log.push( 'fix', fixation.toString() );

        if (fixation.x === 0 && fixation.y === -1) {
            _log.push( '...invalid' );
            // _currentLine = null;
            _logger.end( _log );
            return null;
        }

        _currentLine = lineFromSaccade( fixation.saccade.x, fixation.saccade.y ); // line, null, or false

        if (!_currentLine) {
            _currentLine = lineFromAbsolutePosition( fixation );
        }
        else {  // check how far the fixation from the currentlt mapped line
            _currentLine = ensureFixationIsClose( fixation );
        }

        if (!_currentLine) {
            _logger.end( _log );
            return null;
        }

        _currentWord = mapToWord( fixation, _currentLine.words );

        fixation.word = _currentWord;
        if (_currentWord && _currentLine) {
            fixation.line = _currentLine.index;
            _currentWord.fixations.push( fixation );
            _currentLine.addFixation( fixation );
        }

        if (_currentWord && _callbacks.onMapped) {
            _callbacks.onMapped( fixation );
        }

        _logger.end( _log );

        return _currentWord ? _currentWord.dom : null;
    },

    feed: function (targets, x, y) {
        let result = null;

        _textModel = TextModel.create( targets );

        const newFixation = _fixationDetector.feed( x, y );
        if (newFixation) {
            result = this.feedFixation( newFixation );
        }
        else {
            _lastFixation = null;
        }

        return result;
    },

    setWords: function (elements) {
        if (elements) {
            this.reset();
            _textModel = TextModel.create( elements );
        }
    },

    reset: function () {
        TextModel.reset();
        _fixationDetector.reset();

        _currentLine = null;
        _currentWord = null;
        _lastFixation = null;
        _textModel = null;
    },

    callbacks: function (callbacks) {
        if (!callbacks) {
            return _callbacks;
        }
        else {
            _callbacks.onMapped = callbacks.onMapped;
        }
    },

    currentWord: function () {
        return _currentWord;
    },

    mappedFix: function () {
        return _lastFixation;
    }
};

// internal
let _saccadeYThresholdInLines;
let _saccadeYThresholdInSpacings;
let _fixationXDistFromLineThresholdInPixels;
let _fixationYDistFromLineThresholdInSpaces;
let _fixationYOffsetDiffThresholdInLines;
let _emptyLineSuperority;

let _effectiveLengthReductionMinWordLength;
let _effectiveLengthReductionInChars;

let _fixationDetector;
let _logger;
let _log;

let _textModel;
let _currentLine;
let _currentWord;
let _lastFixation;

const _callbacks = {
    onMapped: null
};

function hasValuableFixations (line) {
    const progressiveFixations = line.fixations.filter( (fix, fi) => {
        const isProgressive =
            fix[3] &&           // ignore the first fixation in the session (id == 0)
            (fix[2].x > 0 ||    // it should be progressive fixation, or
                (fi === line.fixations.length - 1 &&    // the last fixation mapped to this line
                    line.fixations.length > 1));        // if there are other fixations as well
        return isProgressive;
    });

    if (!_currentLine || line === _currentLine) {
        return progressiveFixations.length > 0;
    }
    else {
        return progressiveFixations.length > 1;
    }
}

function getAverageOffsetY (lines, reference) {
    let sum = 0;
    let weights = 0;
    lines.forEach( line => {
        const y = line.center.y;

        let lineSum = 0;
        let lineWeights = 0;
        line.fixations.forEach( fix => {
            let weight = 1;
            if (reference) {
                const dy = Math.abs( reference.y - fix[1] );
                weight = Math.sqrt( 100 / (dy > 1 ? dy : 1) );
            }
            lineSum += (fix[1] - y);
            lineWeights += weight;
        });

        const averageLineWeight = lineWeights / line.fixations.length;
        const averageOffsetY = lineSum / line.fixations.length;
        _log.push( '    ly =', y.toFixed(0), 'd =', averageOffsetY.toFixed(0), 'w =', averageLineWeight.toFixed(3) );

        sum += averageLineWeight * averageOffsetY;
        weights += averageLineWeight;
    });

    return sum / weights;
}

function getOffsetYFromHistory (reference) {
    const linesWithFixations = _textModel.lines.filter( hasValuableFixations );
    if (!linesWithFixations.length) {
        return 0;
    }

    return getAverageOffsetY( linesWithFixations, reference );
}

function lineFromSaccade (dx, dy) {
    if (!_currentLine) {
        _log.push( 'no reference line to apply line-from-saccade computation' );
        return null;
    }

    const saccadeThreshold = _textModel.lineHeight * _saccadeYThresholdInLines;
    const nextLineSaccadeThreshold = _textModel.lineSpacing * _saccadeYThresholdInSpacings;

    let lineChange = Number.NaN;

    _log.push( 'comparing dy =', dy.toFixed(0), 'against', saccadeThreshold.toFixed(0), '(next_max =', nextLineSaccadeThreshold.toFixed(0), ')' );
    if (Math.abs( dy ) < saccadeThreshold) {
        lineChange = 0;
    }
    else if (dy > 0 && dy < nextLineSaccadeThreshold)  {
        lineChange = 1;
    }
    else if (dy < 0)  {
        lineChange = Math.round( dy / _textModel.lineSpacing);
    }

    _log.push( Number.isNaN( lineChange ) ? 'chaotic jump' : 'line changed by ' + lineChange);

    let result = null;
    if (!Number.isNaN( lineChange )) {
        const newLineIndex = _currentLine.index + lineChange;
        if (newLineIndex >= 0 && newLineIndex < _textModel.lines.length) {
            result = _textModel.lines[ newLineIndex ];
            _log.push( 'line #', result.index );
        }
        else {
            _log.push( 'jump outside the line' );
        }
    }
    else {
        _log.push( 'cannot estimate line from saccade' );
    }

    return result;
}

function lineFromAbsolutePosition (fixation) {
    const verticalThreshold = _textModel.lineSpacing * _fixationYDistFromLineThresholdInSpaces;
    const horizontalThreshold = _fixationXDistFromLineThresholdInPixels;
    _log.push( 'estimating line naively, vt =', verticalThreshold.toFixed(0), 'ht =', horizontalThreshold.toFixed(0) );

    const averageOffsetY = getOffsetYFromHistory( fixation );
    _log.push( '    offset', averageOffsetY.toFixed(0) );

    const proximities = _textModel.lines.map( line => {
        let dy = Math.abs( (fixation.y - averageOffsetY) - line.center.y );
        let dx = fixation.x < line.left ? line.left - fixation.x :
                (fixation.x > line.right ? fixation.x - line.right : 0);
        _log.push( '    proximity to line', line.index, 'at y =', line.center.y.toFixed(0), ':', dx.toFixed(2), dy.toFixed(2) );
        return {
            x: dx / horizontalThreshold,
            y: dy / verticalThreshold,
            valid: dx < horizontalThreshold && dy < verticalThreshold,
            line: line
        };
    });

    const bestProximity = proximities.reduce( (best, proximity) => {
        if (!proximity.valid) {
            return best;
        }

        if (best) {
            const scoreCurrent = proximity.x + proximity.y;
            const scoreBest = best.x + best.y;
            const scoreDelta = scoreBest - scoreCurrent;    // lower is better
            const bestHasFixations = hasValuableFixations( best.line );
            const currentHasFixations = hasValuableFixations( proximity.line );

            let threshold;
            //               current
            // b        | f=yes | f=no |
            // e        |-------+------|
            // s f=yes  |   0   |  -T  |
            // t f=no   |   T   |   T  |
            if (!bestHasFixations) {
                threshold = _emptyLineSuperority;  // favor the upper line,
            }
            else if (!currentHasFixations) {
                threshold = -_emptyLineSuperority; // favor the lower line
            }
            else {
                threshold = 0;  // no favor to any line, apply simple comparison
            }

            if (scoreDelta > threshold) {
                if (best.y < _textModel.lineSpacing / 2) {
                    _log.push( '    replaced! line', proximity.line.index, 'closer than line', best.line.index );
                }
                best = proximity;
            }
        }
        else {
            best = proximity;
        }

        return best;
    }, null);

    const mappedLine = bestProximity ? bestProximity.line : null;
    if (mappedLine) {
        _log.push( 'line #', mappedLine.index );
    }
    else {
        _log.push( 'the fixation is not on any line' );
    }

    return mappedLine;
}

function ensureFixationIsClose (fixation) {
    /*
    const fixOffsetY = fixation.y - _currentLine.center.y;
    const fixationYOffsetDiffThreshold = _textModel.lineHeight * _fixationYOffsetDiffThresholdInLines;

    _log.push( 'fix-line Y offset:', fixOffsetY.toFixed(0) );
    _log.push( '    should differ by no more than', fixationYOffsetDiffThreshold.toFixed(0), 'from other offsets' );

    const doesNotFollow = _textModel.lines.find( (line, li) => {
         _log.push( '    line', li, 'has', line.fixations.length, 'fixaions' );
        if (!line.fixations.length) {
            return false;
        }

        const y = line.center.y;
        _log.push( '    ly =', y.toFixed(0) );

        const avgOffsetY = line.fixations.reduce( (sum, fix) => {
            // _log.push( '        :', (fix[1] - y).toFixed(0) );
            return sum + (fix[1] - y);
        }, 0) / line.fixations.length;

        _log.push( '        d =', avgOffsetY.toFixed(0) );

        if (avgOffsetY === undefined) {
            return false;
        }

        return fixOffsetY < avgOffsetY - fixationYOffsetDiffThreshold ||
               fixOffsetY > avgOffsetY + fixationYOffsetDiffThreshold;
    });*/

    const fixOffsetY = fixation.y - _currentLine.center.y;
    const fixationYOffsetDiffThreshold = _textModel.lineSpacing * _fixationYOffsetDiffThresholdInLines;

    const linesWithFixations = _textModel.lines.filter( hasValuableFixations );
    if (!linesWithFixations.length) {
        _log.push( 'cannot verify mapping' );
        return lineFromAbsolutePosition( fixation );
    }

    _log.push( 'verification:' );
    _log.push( '    fix-line dy =', fixOffsetY.toFixed(0), 'should differ max', fixationYOffsetDiffThreshold.toFixed(0), 'from other offsets' );

    const averageOffsetY = getAverageOffsetY( linesWithFixations, fixation );

    _log.push( 'avg offset =', averageOffsetY.toFixed(0) );

    const doesNotFollow = fixOffsetY < averageOffsetY - fixationYOffsetDiffThreshold ||
                          fixOffsetY > averageOffsetY + fixationYOffsetDiffThreshold;

    // common

    if (doesNotFollow) {
        _log.push( '--- the line is too far, mapping naively' );
        return lineFromAbsolutePosition( fixation );
    }

    _log.push( '--- OK' );
    return _currentLine;
}

function mapToWord (fixation, words) {
    _log.push( 'word search' );

    // const mappedWord = mapToWord_Naive( fixation.x, words );
    const mappedWord = mapToWord_Advanced( fixation.x, words );

    if (mappedWord) {
        _log.push( '    mapped to', mappedWord.element.textContent, '=', mappedWord.line.index + ', ' + mappedWord.index );
    }
    else {
        _log.push( '    not mapped' );
    }

    return mappedWord;
}

function mapToWord_Naive (x, words) {
    let mappedWord = null;
    let minDist = Number.MAX_VALUE;

    for (let i = 0; i < words.length; ++i) {
        const word = words[i];
        const rect = word.rect;

        const dist = x < rect.left ? (rect.left - x) : (x > rect.right ? x - rect.right : 0);
        // _log.push( '   ', dist.toFixed(0), 'to', word.element.textContent );

        if (dist < minDist) {
            mappedWord = word;
            minDist = dist;
            if (dist === 0) {
                break;
            }
        }
    }

    _log.push( '    dist =', minDist.toFixed(0) );

    if (minDist > _fixationXDistFromLineThresholdInPixels) {
        mappedWord = null;
    }

    return mappedWord;
}

function mapToWord_Advanced (x, words) {
    let minDist = Number.MAX_VALUE;
    let closestWord = null;

    for (let i = 0; i < words.length; i++) {
        const word = words[i];
        const wordRect = word.rect;
        const wordWidth = wordRect.right - wordRect.left;
        const textLength = word.element.textContent.length;
        let effectiveWordWidth = wordWidth;
        if (word.fixations.length > 0 || textLength > _effectiveLengthReductionMinWordLength) {
            const reduceBy = Math.min( _effectiveLengthReductionInChars, textLength - _effectiveLengthReductionMinWordLength );
            const effectiveWordWidthReduction = wordWidth * (reduceBy / textLength);
            effectiveWordWidth = wordWidth - effectiveWordWidthReduction;
        }
        const wordLeft = wordRect.left;
        const wordRight = wordRect.left + effectiveWordWidth;

        if (x >= wordLeft && x < wordRight) {
            closestWord = word;
            minDist = 0;
        }
        else {
            const dist = Math.max( wordLeft - x, x - wordRight );
            if (dist < minDist) {
                minDist = dist;
                closestWord = word;
            }
        }
    }

    if (minDist > _fixationXDistFromLineThresholdInPixels) {
        closestWord = null;
    }

    return closestWord;
}

// Publication
module.exports = DGWM;


/***/ })
/******/ ]);