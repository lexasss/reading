// Requires:
//      app,Colors
//      app.firebase

(function (app) { 'use strict';

    // Path display routine
    // Constructor arguments:
    //      options: {
    //          root                - selector for the element that contains statistics view
    //          fixationColor       - fixation color
    //          saccadeColor        - saccade color
    //          connectionColor     - connection color
    //          wordColor           - word color
    //          wordHighlightColor  - mapped word rectangle color
    //          wordStrokeColor     - word rectable border color
    //      }
    //      callbacks: {
    //          shown ()      - the path overlay was displayed
    //          hidden ()     - the path overlay was hidden
    //      }
    function Path(options, callbacks) {

        this.root = options.root || document.documentElement;
        this.fixationColor = options.fixationColor || '#00F';
        this.saccadeColor = options.saccadeColor || '#006';
        this.connectionColor = options.connectionColor || '#FF0';
        this.wordColor = options.wordColor || '#FF0';
        this.wordHighlightColor = options.wordHighlightColor || '#F00';
        this.wordStrokeColor = options.wordStrokeColor || '#F00';
        this.durationTransp = options.durationTransp || 100;
        this.durationOpaque = options.durationOpaque || 1000;

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
            var sessionVal = session.val();
            if (sessionVal) {
                var ctx = getCanvas2D();
                var fixations = this._remap( sessionVal );
                this._showHighlights( ctx, fixations );
                this._showWords( ctx, sessionVal.words );
                this._showFixations( ctx, fixations );
                //this._show( ctx, sessionVal );
            }
        } else {
            alert('record ' + name + ' does not exist');
        }

        _snapshot = null;
    };

    Path.prototype._show = function (ctx, session) {
        if (session.words) {
            ctx.strokeStyle = this.wordStrokeColor;
            ctx.fillStyle = this.wordHighlightColor;
            var words = session.words;
            for (var i = 0; i < words.length; i += 1) {
                this._drawWord( ctx, words[i] );
            }
        }

        if (session.fixations) {
            ctx.fillStyle = this.fixationColor;
            ctx.strokeStyle = this.fixationColor;
            var fixations = session.fixations;
            var prevFix, fix;
            for (var i = 0; i < fixations.length; i += 1) {
                fix = fixations[i];
                if (i > 0) {
                    this._drawSaccade( ctx, prevFix, fix );
                }
                this._drawFixation( ctx, fix );
                prevFix = fix;
            }
        }
    };

    Path.prototype._showHighlights = function (ctx, fixations) {
        var words = new Map();
        for (var i = 0; i < fixations.length; i += 1) {
            var fix = fixations[i];
            if (fix.word) {
                var wordDuration = words.get( fix.word ) || 0;
                words.set( fix.word, wordDuration + fix.duration );
            }
        }

        for (var [word, duration] of words) {
            this._highlightWord( ctx, word.rect, duration );
        }
    };

    Path.prototype._showWords = function (ctx, words) {
        ctx.strokeStyle = this.wordStrokeColor;
        ctx.fillStyle = this.wordHighlightColor;
        
        for (var i = 0; i < words.length; i += 1) {
            this._drawWord( ctx, words[i], true );
        }
    };

    Path.prototype._showFixations = function (ctx, fixations) {
        ctx.fillStyle = this.fixationColor;
        ctx.strokeStyle = this.saccadeColor;

        var prevFix, fix;
        for (var i = 0; i < fixations.length; i += 1) {
            fix = fixations[i];
            if (i > 0) {
                this._drawSaccade( ctx, prevFix, fix );
            }
            this._drawFixation( ctx, fix );

            if (fix.word) {
                ctx.strokeStyle = this.connectionColor;
                this._drawConnection( ctx, fix, {x: fix.word.rect.left, y: fix.word.rect.top} );
                ctx.strokeStyle = this.saccadeColor;
            }

            prevFix = fix;
        }
    };

    Path.prototype._drawFixation = function (ctx, fixation) {
        ctx.beginPath();
        ctx.arc( fixation.x, fixation.y, Math.round( Math.sqrt( fixation.duration ) ) / 2, 0, 2*Math.PI);
        ctx.fill();
    };

    Path.prototype._drawSaccade = function (ctx, from, to) {
        ctx.beginPath();
        ctx.moveTo( from.x, from.y );
        ctx.lineTo( to.x, to.y );
        ctx.stroke();
    };

    Path.prototype._drawConnection = function (ctx, from, to) {
        ctx.beginPath();
        ctx.moveTo( from.x, from.y );
        ctx.lineTo( to.x, to.y );
        ctx.stroke();
    };

    Path.prototype._drawWord = function (ctx, word, ignoreDuration) {

        if (word.duration && !ignoreDuration) {
            ctx.fillStyle = app.Colors.rgb2rgba( this.wordHighlightColor, 
                    Math.max( 0, Math.min( 1, (word.duration - this.durationTransp) / (this.durationOpaque - this.durationTransp) ) ) );
            ctx.fillRect( word.x, word.y, word.width, word.height);
        }

        ctx.fillStyle = this.wordColor;
        ctx.fillText( word.text, word.x, word.y + 0.8 * word.height);

        ctx.strokeRect( word.x, word.y, word.width, word.height);
    };

    Path.prototype._highlightWord = function (ctx, word, duration) {
        ctx.fillStyle = app.Colors.rgb2rgba( this.wordHighlightColor, 
                    Math.max( 0, Math.min( 1, (duration - this.durationTransp) / (this.durationOpaque - this.durationTransp) ) ) );
        ctx.fillRect( Math.round( word.left ), Math.round( word.top ), 
                    Math.round( word.right - word.left ), Math.round( word.bottom - word.top ) );
    };

    Path.prototype._remap = function (session) {
        var fixations = GazeTargets.Models.Reading.Fixations;
        var model = GazeTargets.Models.Reading.Campbell;
        var logger = GazeTargets.Logger;

        fixations.init( 80, 50 );
        model.init({
            linePredictor: {
                factors: {
                    currentLineDefDist: 0.4,
                    currentLineMaxDist: 0.4,
                    newLineSaccadeLengthFraction: 0.1
                }
            }
        });

        var layout = session.words.map(function (word) {
            return new Word({ left: word.x, top: word.y, right: word.x + word.width, bottom: word.y + word.height });
        });

        logger.level( logger.Level.debug );
        
        fixations.reset();
        model.reset( layout );
        //model.callbacks( { onMapped: function (fixation) {} } );
        
        var result = []
        session.fixations.forEach(function (fix) {
            var fixation = fixations.add( fix.x, fix.y, fix.duration );
            if (fixation) {
                model.feedFixation( fixation );
                result.push( fixation );
            }
        });

        logger.level( logger.Level.silent );
        
        return result;
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

    function Word(rect) {
        this.left = rect.left;
        this.top = rect.top;
        this.right = rect.right;
        this.bottom = rect.bottom;
    }

    Word.prototype.getBoundingClientRect = function () {
        return this;
    };

    app.Path = Path;
    
})( Reading || window );
