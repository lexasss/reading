// Base for visualizations
// Interface to implement:
//        _load
//        _fillDataQueryList

(function (app) { 'use strict';

    // Visualization constructor
    // Arguments:
    //      options: {
    //          wordColor           - word color
    //          wordHighlightColor  - mapped word rectangle color
    //          wordStrokeColor     - word rectable border color
    //          textColor           - info text color
    //          textFont            - info text font
    //          colorMetric         - word background coloring metric
    //      }
    function Visualization (options) {
        this.wordColor = options.wordColor || '#CCC';
        this.wordHighlightColor = options.wordHighlightColor || '#606';
        this.wordStrokeColor = options.wordStrokeColor || '#800';
        this.textColor = options.textColor || '#CCC';
        this.textFont = options.textFont || '18px Arial';

        this.colorMetric = options.colorMetric !== undefined ? options.colorMetric : app.Metric.Type.DURATION;
        
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
        _canvas = document.querySelector( root + ' canvas');
        _sessionPrompt = document.querySelector( root + ' #session' );
        _filePrompt = document.querySelector( root + ' #file' );

        _view.classList.add( 'invisible' );
        _sessionPrompt.classList.add( 'invisible' );
        _filePrompt.classList.add( 'invisible' );

        var close = document.querySelector( root + ' .close' );
        close.addEventListener('click', () => {
            _view.classList.add( 'invisible' );

            var ctx = _canvas.getContext('2d');
            ctx.clearRect( 0, 0, _width, _height );

            if (callbacks.hidden) {
                callbacks.hidden();
            }
        });

        var select = document.querySelector( root + ' .select' );
        select.addEventListener('click', () => {
            var list = _sessionPrompt.querySelector( 'select' );
            var selectedOption = list.options[ list.selectedIndex ];
            _sessionPrompt.classList.add( 'invisible' );

            _sessionPromtCallback( selectedOption.value, selectedOption.textContent );
        });

        var browse = document.querySelector( root + ' .file' );
        browse.addEventListener('change', (e) => {
            var fileName = e.target.files[0];
            _filePrompt.classList.add( 'invisible' );

            _filePromtCallback( fileName );
        });
    };

    Visualization.prototype.queryData = function () {
        if (this._snapshot) {
            this._showDataSelectionDialog();
            return;
        }   

        app.firebase.once('value', snapshot => {
            if (!snapshot.exists()) {
                window.alert( 'no records in DB' );
                return;
            }

            this._snapshot = snapshot;
            this._showDataSelectionDialog();

        }, function (err) {
            window.alert( err );
        });
    };

    Visualization.prototype._showDataSelectionDialog = function () {
        if (_callbacks.shown) {
            _callbacks.shown();
        }

        _view.classList.remove( 'invisible' );

        var list = _sessionPrompt.querySelector( 'select' );
        list.innerHTML = '';

        this._fillDataQueryList( list );

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

        ctx.font = '24pt Calibri, Arial, sans-serif';
        ctx.clearRect(0, 0, _width, _height);

        return ctx;
    };

    Visualization.prototype._drawTitle = function (ctx, title) {
        ctx.fillStyle = this.textColor;
        ctx.font = this.textFont;

        var textWidth = ctx.measureText( title ).width;
        ctx.fillText( title, (_canvas.width - textWidth) / 2, 32);
    };

    Visualization.prototype._drawWords = function (ctx, words, metricRange, showIDs) {
        ctx.strokeStyle = this.wordStrokeColor;
        ctx.lineWidth = 1;

        var indexComputer = IndexComputer();

        words.forEach( (word, index) => {
            var alpha = app.Metric.getAlpha( word, this.colorMetric, metricRange );
            this._drawWord( ctx, word, alpha, 
                showIDs ? indexComputer.feed( word.x, word.y ) : null);
        });
    };

    Visualization.prototype._drawWord = function (ctx, word, backgroundAlpha, indexes) {
        if (backgroundAlpha > 0) {
            //backgroundAlpha = Math.sin( backgroundAlpha * Math.PI / 2);
            ctx.fillStyle = app.Colors.rgb2rgba( this.wordHighlightColor, backgroundAlpha);
            ctx.fillRect( Math.round( word.x ), Math.round( word.y ), Math.round( word.width ), Math.round( word.height ) );
        }

        ctx.textAlign = 'start'; 
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = this.wordColor;
        ctx.fillText( word.text, word.x, word.y + 0.8 * word.height);

        if (indexes) {
            if (indexes.word === 0) {
                ctx.fillStyle = '#0F0';
                ctx.textAlign = 'end';
                ctx.fillText( '' + indexes.line, word.x - 20, word.y + 0.8 * word.height );
            }

            ctx.fillStyle = '#FF0';
            ctx.textAlign = 'center'; 
            ctx.fillText( '' + indexes.word, word.x + word.width / 2, word.y );
        }
        else {
            ctx.strokeRect( word.x, word.y, word.width, word.height);
        }
    };

    var _height;
    var _width;
    var _callbacks;
    var _view;
    var _canvas;
    var _sessionPrompt;
    var _filePrompt;

    var _sessionPromtCallback;
    var _filePromtCallback;

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

    app.Visualization = Visualization;
    
})( this.Reading || module.exports );
