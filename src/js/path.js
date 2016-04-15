// Requires:
//      app,Colors
//      app.firebase

(function (app) { 'use strict';

    // Path display routine
    // Constructor arguments:
    //      options: {
    //          root            - selector for the element that contains statistics view
    //          fixationColor   - fixation color
    //          wordColor       - mapped word rectangle color
    //          wordStrokeColor - word rectable border color
    //      }
    //      callbacks: {
    //          shown ()      - the path overlay was displayed
    //          hidden ()     - the path overlay was hidden
    //      }
    function Path(options, callbacks) {

        this.root = options.root || document.documentElement;
        this.fixationColor = options.fixationColor || '#00F';
        this.wordColor = options.wordColor || '#F00';
        this.wordStrokeColor = options.wordStrokeColor || '#F00';

        _callbacks = callbacks;

        _view = document.querySelector( this.root );
        _canvas = document.querySelector( this.root + ' canvas');
        _sessionPrompt = document.querySelector( this.root + ' .prompt' );

        _view.classList.add( 'invisible' );
        _sessionPrompt.classList.add( 'invisible' );

        var self = this;

        var close = document.querySelector( this.root + ' .close' );
        close.addEventListener('click', function () {
            _view.classList.add( 'invisible' );

            var ctx = _canvas.getContext('2d');
            ctx.clearRect(0, 0, _width, _height);

            if (callbacks.hidden) {
                callbacks.hidden();
            }
        });

        var select = document.querySelector( this.root + ' .select' );
        select.addEventListener('click', function () {
            var list = document.querySelector( 'select', _sessionPrompt );
            self._load( list.options[ list.selectedIndex ].value );
        });
    }

    Path.prototype.select = function () {
        app.firebase.once('value', function (snapshot) {
            if (!snapshot.exists()) {
                alert('no records in DB');
                return;
            }

            if (_callbacks.shown) {
                _callbacks.shown();
            }

            _snapshot = snapshot;
            _view.classList.remove( 'invisible' );

            var list = document.querySelector( 'select', _sessionPrompt );
            list.innerHTML = '';
            snapshot.forEach( function (childSnapshot) {
                var option = document.createElement('option');
                option.value = childSnapshot.key();
                option.textContent = childSnapshot.key();
                list.appendChild( option );
                //var childData = childSnapshot.val();
            });

            _sessionPrompt.classList.remove( 'invisible' );

        }, function (err) {
            alert(err);
        });
    };

    Path.prototype._load = function( name ) {
        if (!_snapshot) {
            return;
        }

        _sessionPrompt.classList.add( 'invisible' );
        
        var session = _snapshot.child( name );
        if (session && session.exists()) {
            this._show( session.val() );
        } else {
            alert('record ' + name + ' does not exist');
        }

        _snapshot = null;
    };

    Path.prototype._show = function (session) {
        if (!session) {
            return;
        }

        var ctx = getCanvas2D();

        if (session.words) {
            ctx.strokeStyle = this.wordStrokeColor;
            ctx.fillStyle = this.wordColor;
            var words = session.words;
            for (var i = 0; i < words.length; i += 1) {
                this._drawWord( ctx, words[i] );
            }
        }

        if (session.fixations) {
            ctx.fillStyle = this.fixationColor;
            var fixations = session.fixations;
            for (var i = 0; i < fixations.length; i += 1) {
                this._drawFixation( ctx, fixations[i] );
            }
        }
    };

    Path.prototype._drawFixation = function (ctx, fixation) {
        ctx.beginPath();
        ctx.arc( fixation.x, fixation.y, fixation.duration / 30, 0, 2*Math.PI);
        ctx.fill();
    };

    Path.prototype._drawWord = function (ctx, word) {

        if (word.duration) {
            ctx.fillStyle = app.Colors.rgb2rgba( this.wordColor, Math.min( 1, word.duration / 500) );
            ctx.fillRect( word.x, word.y, word.width, word.height);
        }

        ctx.fillStyle = '#FFFF00';
        ctx.fillText( word.text, word.x, word.y + 0.8 * word.height);

        ctx.strokeRect( word.x, word.y, word.width, word.height);
    };

    var _callbacks;
    var _view;
    var _canvas;
    var _sessionPrompt;
    var _snapshot;
    var _height;
    var _width;

    function getCanvas2D() {
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
    }

    app.Path = Path;
    
})( Reading || window );
