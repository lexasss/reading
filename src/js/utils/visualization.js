// Base for visualizations
//
// Requires:
//
// Interface to implement:
//        _load
//        _fillDataQueryList

(function (app) { 'use strict';

    // Visualization constructor
    // Arguments:
    //      options: {
    //          wordColor           - word color
    //          wordFont      c     - word font
    //          wordHighlightColor  - mapped word rectangle color
    //          wordStrokeColor     - word rectable border color
    //          infoColor           - info text color
    //          infoFont            - info text font
    //          colorMetric         - word background coloring metric
    //          mapping             - mapping type
    //      }
    function Visualization (options) {
        this.wordColor = options.wordColor || '#080'//'#CCC';
        this.wordFont = options.wordFont || '22pt Calibri, Arial, sans-serif';
        this.wordHighlightColor = options.wordHighlightColor || '#606';
        this.wordStrokeColor = options.wordStrokeColor || '#888';
        this.infoColor = options.infoColor || '#444';
        this.infoFont = options.infoFont || '18px Arial';

        this.colorMetric = options.colorMetric !== undefined ? options.colorMetric : app.Metric.Type.DURATION;
        this.mapping = options.mapping !== undefined ? options.mapping : Visualization.Mapping.STATIC;

        this._snapshot = null;
        this._sessioName = '';
    }

    // Initialization routine, to be called prior constructing any visualization object
    //  Arguments:
    //      root              - selector for the element that contains visualizations
    //      callbacks: {
    //          shown ()      - the path overlay was displayed
    //          hidden ()     - the path overlay was hidden
    //      }
    Visualization.init = function (root, callbacks) {
        _callbacks = callbacks;

        _view = document.querySelector( root );
        _wait = _view.querySelector( '.wait' );
        _canvas = document.querySelector( root + ' canvas');
        _sessionPrompt = document.querySelector( root + ' #session' );
        _filePrompt = document.querySelector( root + ' #file' );

        _view.classList.add( 'invisible' );
        _sessionPrompt.classList.add( 'invisible' );
        _filePrompt.classList.add( 'invisible' );

        Visualization.root = document.querySelector( root );

        var close = document.querySelector( root + ' .close' );
        close.addEventListener( 'click', () => {
            _view.classList.add( 'invisible' );

            var ctx = _canvas.getContext('2d');
            ctx.clearRect( 0, 0, _width, _height );

            if (callbacks.hidden) {
                callbacks.hidden();
            }
        });

        var select = document.querySelector( root + ' .select' );
        select.addEventListener( 'click', () => {
            var list = _sessionPrompt.querySelector( '#conditions' );
            _sessionPrompt.classList.add( 'invisible' );

            if (list.multiple) {
                var options = [];
                for (var i = 0; i < list.selectedOptions.length; i++) {
                    options.push( list.selectedOptions[i].value );
                }
                _sessionPromtCallback( options );
            }
            else {
                var selectedOption = list.options[ list.selectedIndex ];
                _sessionPromtCallback( selectedOption.value, selectedOption.textContent );
            }
        });

        var browse = document.querySelector( root + ' .file' );
        browse.addEventListener( 'change', e => {
            var fileName = e.target.files[0];
            _filePrompt.classList.add( 'invisible' );

            _filePromtCallback( fileName );
        });

        var categories = document.querySelector( root + ' #categories' );
        categories.addEventListener( 'change', e => {
            var selectedOption = e.target.options[ e.target.selectedIndex ];

            if (selectedOption && selectedOption.data) {
                var list = _sessionPrompt.querySelector( '#conditions' );
                list.innerHTML = '';
                selectedOption.data.forEach( session => {
                    addOption( list, session );
                });
            }
        });
    };

    Visualization.prototype.queryData = function (multiple) {
        if (_callbacks.shown) {
            _callbacks.shown();
        }

        _view.classList.remove( 'invisible' );
        _wait.classList.remove( 'invisible' );

        if (this._snapshot) {
            this._showDataSelectionDialog( multiple );
            return;
        }

        if (_waiting) {
            return;
        }

        _waiting = true;
        app.firebase.once( 'value', snapshot => {
            _waiting = false;

            if (!snapshot.exists()) {
                window.alert( 'no records in DB' );
                return;
            }

            this._snapshot = snapshot;

            if (!_view.classList.contains('invisible')) {
                this._showDataSelectionDialog( multiple );
            }

        }, function (err) {
            window.alert( err );
        });
    };

    Visualization.prototype._callbacks = function () {
        return _callbacks;
    }

    Visualization.prototype._getConditionNameFromSessionName = function (sessionName, considerSpacings) {
        var result;
        var nameParts = sessionName.split( '_' );
        if (nameParts.length === 3) {
            result = nameParts[1];
            if (considerSpacings) {
                result += ', spacing #' + nameParts[2];
            }
        }
        return result;
    }

    Visualization.prototype._getConditions = function (uniteSpacings) {
        var conditions = new Map();
        this._snapshot.forEach( childSnapshot => {
            var sessionName = childSnapshot.key();
            var key = this._getConditionNameFromSessionName( sessionName, !uniteSpacings );
            if (key) {
                var sessions = conditions.get( key ) || [];
                sessions.push( sessionName );
                conditions.set( key, sessions );
            }
        });

        return new Map([...conditions.entries()].sort());
    }

    Visualization.prototype._showDataSelectionDialog = function (multiple) {
        _wait.classList.add( 'invisible' );

        var list = _sessionPrompt.querySelector( '#conditions' );
        list.multiple = !!multiple;
        list.innerHTML = '';

        var categories = this._fillDataQueryList( list );

        var catList = _sessionPrompt.querySelector( '#categories' );
        if (categories) {
            catList.innerHTML = '';
            catList.classList.remove( 'hidden' );
            for (var key of categories.keys()) {
                addOption( catList, key, key, categories.get( key ) );
            }
            var event = new Event('change');
            catList.dispatchEvent( event );
        }
        else {
            catList.classList.add( 'hidden' );
        }

        _sessionPromtCallback = this._load.bind( this );
        _sessionPrompt.classList.remove( 'invisible' );
    };

    Visualization.prototype._showFileSelectionDialog = function (prompt, callback) {
        if (_callbacks.shown) {
            _callbacks.shown();
        }

        _view.classList.remove( 'invisible' );

        _filePromtCallback = callback;
        _filePrompt.querySelector( '.title' ).textContent = prompt || 'Select a file:';
        _filePrompt.querySelector( '.file' ).filename = '';
        _filePrompt.classList.remove( 'invisible' );
    };

    Visualization.prototype._getCanvas2D = function () {
        if (!_width || !_height) {
            _width = parseInt( window.getComputedStyle( _canvas ).width );
            _height = parseInt( window.getComputedStyle( _canvas ).height );
            _canvas.setAttribute( 'width',  _width );
            _canvas.setAttribute( 'height', _height );
        }

        var ctx = _canvas.getContext('2d');

        ctx.font = this.wordFont;
        ctx.clearRect(0, 0, _width, _height);

        return ctx;
    };

    Visualization.prototype._drawTitle = function (ctx, title) {
        ctx.fillStyle = this.infoColor;
        ctx.font = this.infoFont;

        var textWidth = ctx.measureText( title ).width;
        ctx.fillText( title, (_canvas.width - textWidth) / 2, 32);
    };

    Visualization.prototype._drawWords = function (ctx, words, metricRange, showIDs, hideBoundingBox) {
        ctx.strokeStyle = this.wordStrokeColor;
        ctx.lineWidth = 1;

        var indexComputer = IndexComputer();

        words.forEach( (word, index) => {
            var alpha = app.Metric.getAlpha( word, this.colorMetric, metricRange );
            this._drawWord( ctx, word, alpha,
                showIDs ? indexComputer.feed( word.x, word.y ) : null,
                hideBoundingBox);
        });
    };

    Visualization.prototype._drawWord = function (ctx, word, backgroundAlpha, indexes, hideBoundingBox) {
        if (backgroundAlpha > 0) {
            //backgroundAlpha = Math.sin( backgroundAlpha * Math.PI / 2);
            // ctx.fillStyle = app.Colors.rgb2rgba( this.wordHighlightColor, backgroundAlpha);
            // ctx.fillRect( Math.round( word.x ), Math.round( word.y ), Math.round( word.width ), Math.round( word.height ) );
        }

        ctx.font = this.wordFont;
        ctx.textAlign = 'start';
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = this.wordColor;
        ctx.fillText( word.text, word.x, word.y + 0.8 * word.height);

        if (backgroundAlpha > 0) {
            ctx.fillStyle = app.Colors.rgb2rgba( this.wordHighlightColor, backgroundAlpha);
            ctx.fillText( word.text, word.x, word.y + 0.8 * word.height);
        }

        if (indexes) {
            if (indexes.word === 0) {
                ctx.fillStyle = '#080';
                ctx.textAlign = 'end';
                ctx.fillText( '' + indexes.line, word.x - 20, word.y + 0.8 * word.height );
            }

            ctx.fillStyle = '#008';
            ctx.textAlign = 'center';
            ctx.fillText( '' + indexes.word, word.x + word.width / 2, word.y );
        }

        if (!hideBoundingBox) {
            if (word.participants) {
                ctx.font = '12px Arial';
                word.participants.forEach( (participant, index) => {
                    if (index > 2) {
                        return;
                    }
                    let id = +participant.name.substr(1);
                    ctx.fillStyle = '#004' //`rgb(${10*id},0,0)`;
                    ctx.fillText( participant.name, word.x, word.y + index * 15 - 20);
                });
                ctx.font = this.wordFont;
            }
            else {
                ctx.strokeRect( word.x, word.y, word.width, word.height);
            }
        }
    };

    var _height;
    var _width;
    var _callbacks;
    var _view;
    var _wait;
    var _canvas;
    var _sessionPrompt;
    var _filePrompt;

    var _sessionPromtCallback;
    var _filePromtCallback;

    var _waiting = false;

    var IndexComputer = function () {
        var lastX = -1;
        var lastY = -1;
        var currentWordIndex = -1;
        var currentLineIndex = -1;

        return {
            feed: function (x, y) {
                if (y > lastY) {
                    currentLineIndex++;
                    currentWordIndex = 0;
                }
                else if (x > lastX) {
                    currentWordIndex++;
                }

                lastX = x;
                lastY = y;

                return {
                    word: currentWordIndex,
                    line: currentLineIndex
                };
            }
        };
    };

    function addOption (list, value, text, data) {
        var option = document.createElement( 'option' );
        option.value = value;
        option.textContent = text || value;
        if (data) {
            option.data = data;
        }
        list.appendChild( option );

        return option;
    }

    Visualization.Mapping = {
        STATIC: 0,
        DYNAMIC: 1
    };

    app.Visualization = Visualization;

})( this.Reading || module.exports );
