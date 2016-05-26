// Base for visualizations
// Interface to implement:
//		_load
//		_fillDataQueryList

(function (app) { 'use strict';

    // Visualization constructor
    // Arguments:
    //      options: {
    //          wordColor           - word color
    //          wordHighlightColor  - mapped word rectangle color
    //          wordStrokeColor     - word rectable border color
    //          textColor           - info text color
    //          textFont            - info text font
    //      }
	function Visualization (options) {
        this.wordColor = options.wordColor || '#CCC';
        this.wordHighlightColor = options.wordHighlightColor || '#606';
        this.wordStrokeColor = options.wordStrokeColor || '#800';
        this.textColor = options.textColor || '#CCC';
        this.textFont = options.textFont || '32px Arial';

		this._snapshot = null;
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
        _sessionPrompt = document.querySelector( root + ' .prompt' );

        _view.classList.add( 'invisible' );
        _sessionPrompt.classList.add( 'invisible' );

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
    };

    Visualization.prototype.queryData = function () {
        if (this._snapshot) {
            this._showDataSelectionDialog();
            return;
        }

        app.firebase.once('value', snapshot => {
            if (!snapshot.exists()) {
                alert('no records in DB');
                return;
            }

            this._snapshot = snapshot;
            this._showDataSelectionDialog();

        }, function (err) {
            alert(err);
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

    Visualization.prototype._drawWords = function (ctx, words, metricRange) {
        ctx.strokeStyle = this.wordStrokeColor;
        ctx.lineWidth = 1;
        
        words.forEach( word => {
            var alpha = app.Metric.getAlpha( word, this.colorMetric, metricRange );
            this._drawWord( ctx, word, alpha );
        });
    };

    Visualization.prototype._drawWord = function (ctx, word, backgroundAlpha) {
        if (backgroundAlpha > 0) {
            //backgroundAlpha = Math.sin( backgroundAlpha * Math.PI / 2);
            ctx.fillStyle = app.Colors.rgb2rgba( this.wordHighlightColor, backgroundAlpha);
            ctx.fillRect( Math.round( word.x ), Math.round( word.y ), Math.round( word.width ), Math.round( word.height ) );
        }

        ctx.fillStyle = this.wordColor;
        ctx.fillText( word.text, word.x, word.y + 0.8 * word.height);

        ctx.strokeRect( word.x, word.y, word.width, word.height);
    };

    var _height;
    var _width;
    var _callbacks;
    var _view;
    var _canvas;
    var _sessionPrompt;

    var _sessionPromtCallback;

    app.Visualization = Visualization;
    
})( this.Reading || module.exports );
