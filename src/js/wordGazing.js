// Requires:
//      app,Colors
//      app.firebase

(function (app) { 'use strict';

    // Word gazing display routine
    // Constructor arguments:
    //      options: {
    //          root                - selector for the element that contains statistics view
    //          fixationColor       - fixation color
    //          wordColor           - word color
    //          wordHighlightColor  - mapped word rectangle color
    //          wordStrokeColor     - word rectable border color
    //      }
    //      callbacks: {
    //          shown ()      - the path overlay was displayed
    //          hidden ()     - the path overlay was hidden
    //      }
    function WordGazing (options, callbacks) {

        this.root = options.root || document.documentElement;
        this.fixationColor = options.fixationColor || '#FFF';
        this.wordColor = options.wordColor || '#CCC';
        this.wordHighlightColor = options.wordHighlightColor || '#606';
        this.wordStrokeColor = options.wordStrokeColor || '#800';
        this.durationTransp = options.durationTransp || 100;
        this.durationOpaque = options.durationOpaque || 1000;
        this.textColor = options.textColor || '#CCC';
        this.textFont = options.textFont || '32px Arial';

        _callbacks = callbacks;

        _view = document.querySelector( this.root );
        _canvas = document.querySelector( this.root + ' canvas');
        _sessionPrompt = document.querySelector( this.root + ' .prompt' );

        _view.classList.add( 'invisible' );
        _sessionPrompt.classList.add( 'invisible' );

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
        select.addEventListener('click', () => {
            var list = document.querySelector( 'select', _sessionPrompt );
            var selectedOption = list.options[ list.selectedIndex ];
            this._load( selectedOption.value, selectedOption.textContent );
        });
    }

    WordGazing.prototype.select = function () {
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

            var conditions = new Map();
            snapshot.forEach( function (childSnapshot) {
                var sessionName = childSnapshot.key();
                var key = getConditionNameFromSessionName( sessionName );
                if (key) {
                    var sessions = conditions.get( key ) || [];
                    sessions.push( sessionName );
                    conditions.set( key, sessions );
                }
            });

            for (var [key, condition] of conditions) {
                var option = document.createElement('option');
                var nameParts = key.split( '_' );
                option.value = key;
                option.textContent = `Text ${nameParts[0]}, spacing ${nameParts[1]}`;
                list.appendChild( option );
            }

            _sessionPrompt.classList.remove( 'invisible' );

        }, function (err) {
            alert(err);
        });
    };

    WordGazing.prototype._load = function( conditionName, conditionTitle ) {
        if (!_snapshot) {
            return;
        }

        _sessionPrompt.classList.add( 'invisible' );
        
        var words, fixes;
        var fixations = [];
        var sessionNames = [];
        _snapshot.forEach( childSnapshot => {
            var sessionName = childSnapshot.key();
            var key = getConditionNameFromSessionName( sessionName );
            if (key === conditionName) {
                sessionNames.push( sessionName.split( '_' )[0] );
                [words, fixes] = this._loadSession( words, sessionName );
                if (fixes) {
                    fixations.push( ...fixes );
                }
            }
        });

        if (words) {
            var maxDuration = this._computeWordDurations( _ctx, words );
            this._drawWords( _ctx, words, maxDuration );
            this._drawTitle( _ctx, conditionTitle, sessionNames );
            this._drawFixations( _ctx, fixations );
        }
        
        _snapshot = null;
    };

    WordGazing.prototype._loadSession = function (words, sessionName) {
        var fixations;
        var session = _snapshot.child( sessionName );
        if (session && session.exists()) {
            var sessionVal = session.val();
            if (sessionVal) {
                if (!words) {   // this is the first session to load
                    _ctx = getCanvas2D();
                    words = sessionVal.words;
                }
                fixations = this._remapStatic( sessionVal, words );
            }
        } else {
            alert('record ' + sessionName + ' does not exist');
        }

        return [words, fixations];
    }

    WordGazing.prototype._remapStatic = function (session, words) {
        //localStorage.setItem('data', JSON.stringify(session));

        app.StaticFit.map({
            fixations: session.fixations,
            setup: session.setup,
            words: words
        });
        return session.fixations;
    }

    WordGazing.prototype._drawTitle = function (ctx, condition, names) {
        ctx.fillStyle = this.textColor;
        ctx.font = this.textFont;

        var text = condition + ' for ' + names.join( ', ' );
        var textWidth = ctx.measureText( text ).width;
        ctx.fillText( text, (_canvas.width - textWidth) / 2, 32 );
    }

    WordGazing.prototype._computeWordDurations = function (ctx, words) {
        var result = 0;
        words.forEach( word => {
            if (word.fixations) {
                word.duration = word.fixations.reduce( (sum, fix) => {
                    return sum + fix.duration;
                }, 0);
                if (result < word.duration) {
                    result = word.duration;
                }
            }
        });
        return result;
    }

    WordGazing.prototype._drawWords = function (ctx, words, maxDuration) {
        ctx.strokeStyle = this.wordStrokeColor;
        ctx.fillStyle = this.wordHighlightColor;
        
        words.forEach( word => {
            this._highlightWordBox( ctx, word, maxDuration );
            this._drawWord( ctx, word );
        });
    };

    WordGazing.prototype._highlightWordBox = function (ctx, word, maxDuration) {
        var duration = word.duration;
        console.log(duration);
        if (duration > this.durationTransp) {
            var alpha = (duration - this.durationTransp) / (maxDuration - this.durationTransp);
            alpha = Math.sin( alpha * Math.PI / 2);
            console.log('   ', alpha);
            ctx.fillStyle = app.Colors.rgb2rgba( this.wordHighlightColor, alpha);
            ctx.fillRect( Math.round( word.x ), Math.round( word.y ), Math.round( word.width ), Math.round( word.height ) );
        }
    };

    WordGazing.prototype._drawWord = function (ctx, word) {
        ctx.fillStyle = this.wordColor;
        ctx.fillText( word.text, word.x, word.y + 0.8 * word.height);
        ctx.strokeRect( word.x, word.y, word.width, word.height);
    };

    WordGazing.prototype._drawFixations = function (ctx, fixations) {
        ctx.fillStyle = this.fixationColor;

        fixations.forEach( fixation => {
            if (fixation.x <= 0 && fixation.y <= 0) {
                return;
            }

            ctx.beginPath();
            ctx.arc( fixation.x, fixation.y, 2,
                //Math.round( Math.sqrt( fixation.duration ) ) / 2, 
                0, 2*Math.PI );
            ctx.fill();

            // if (fix.word) {
            //     ctx.strokeStyle = this.connectionColor;
            //     this._drawConnection( ctx, fix, {x: fix.word.left, y: fix.word.top} );
            //     ctx.strokeStyle = this.saccadeColor;
            // }
        });
    };

    /*
    Path.prototype._drawConnection = function (ctx, from, to) {
        ctx.beginPath();
        ctx.moveTo( from.x, from.y );
        ctx.lineTo( to.x, to.y );
        ctx.stroke();
    };
    */

    var _callbacks;
    var _view;
    var _canvas;
    var _ctx;
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

    function getConditionNameFromSessionName (sessionName) {
        var result;
        var nameParts = sessionName.split( '_' );
        if (nameParts.length === 3) {
            result = nameParts[1] + '_' + nameParts[2];
        }
        return result;
    }

    app.WordGazing = WordGazing;
    
})( Reading || window );
