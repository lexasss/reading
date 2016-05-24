// Requires:
//      app,Colors
//      app.firebase
//      utils.metric

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
    //          showConnections     - flat to display fixation-word connections
    //          showSaccades        - flag to display saccades
    //          showFixations       - flag to display fixations
    //          showOriginalFixLocation - flag to display original fixation location
    //      }
    //      callbacks: {
    //          shown ()      - the path overlay was displayed
    //          hidden ()     - the path overlay was hidden
    //      }
    function Path(options, callbacks) {

        this.root = options.root || document.documentElement;
        this.fixationColor = options.fixationColor || '#000';
        this.saccadeColor = options.saccadeColor || '#08F';
        this.connectionColor = options.connectionColor || '#FF0';
        this.wordColor = options.wordColor || '#CCC';
        this.wordHighlightColor = options.wordHighlightColor || '#606';
        this.wordStrokeColor = options.wordStrokeColor || '#800';
        this.durationTransp = options.durationTransp || 100;
        this.durationOpaque = options.durationOpaque || 1000;
        this.textColor = options.textColor || '#CCC';
        this.textFont = options.textFont || '32px Arial';

        this.colorMetric = options.colorMetric || app.Metric.Type.DURATION;
        this.showConnections = options.showConnections !== undefined ? options.showConnections : false;
        this.showSaccades = options.showSaccades !== undefined ? options.showSaccades : false;
        this.showFixations = options.showFixations !== undefined ? options.showFixations : false;
        this.showOriginalFixLocation = options.showOriginalFixLocation !== undefined ? options.showOriginalFixLocation : false;

        var lineColorA = 0.5;
        this.lineColors = [
            'rgba(255,0,0,' + lineColorA +')',
            'rgba(255,255,0,' + lineColorA +')',
            'rgba(0,255,0,' + lineColorA +')',
            'rgba(0,255,224,' + lineColorA +')',
            'rgba(0,128,255,' + lineColorA +')',
            'rgba(255,0,255,' + lineColorA +')',
        ];

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
            var list = _sessionPrompt.querySelector( 'select' );
            self._load( list.options[ list.selectedIndex ].value );
        });
    }

    Path.prototype.queryData = function () {
        if (_snapshot) {
            this.showSessionSelectionDialog();
            return;
        }

        app.firebase.once('value', snapshot => {
            if (!snapshot.exists()) {
                alert('no records in DB');
                return;
            }

            _snapshot = snapshot;
            this.showSessionSelectionDialog();

        }, function (err) {
            alert(err);
        });
    };

    Path.prototype.showSessionSelectionDialog = function () {
        if (_callbacks.shown) {
            _callbacks.shown();
        }

        _view.classList.remove( 'invisible' );

        var list = _sessionPrompt.querySelector( 'select' );
        list.innerHTML = '';
        _snapshot.forEach( childSnapshot => {
            var option = document.createElement('option');
            option.value = childSnapshot.key();
            option.textContent = childSnapshot.key();
            list.appendChild( option );
        });

        _sessionPrompt.classList.remove( 'invisible' );
    }

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
                var fixations = this._remapStatic( sessionVal );
                var metricRange = app.Metric.compute( sessionVal.words, this.colorMetric );
                //this._showHighlights( ctx, fixations );
                this._drawWords( ctx, sessionVal.words, metricRange );
                if (this.showFixations) {
                    this._showFixations( ctx, fixations );
                }
                this._drawTitle( ctx, name );
            }
        } else {
            alert('record ' + name + ' does not exist');
        }
    };

    /*
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
    };*/

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
            this._highlightWord( ctx, word, duration );
        }
    };

    Path.prototype._drawWords = function (ctx, words, metricRange) {
        var converter = [
            function () { return 0; },
            this._mapDurationToColor.bind( this ),
            this._mapCharSpeedToColor.bind( this ),
            this._mapSyllableSpeedToColor.bind( this ),
        ];

        ctx.strokeStyle = this.wordStrokeColor;
        //ctx.fillStyle = this.wordHighlightColor;
        
        words.forEach( word => {
            var alpha = converter[ this.colorMetric ]( ctx, word, metricRange );
            this._drawWord( ctx, word, alpha );
        });
    };

    Path.prototype._mapDurationToColor = function (ctx, word, maxDuration) {
        var result = 0;
        if (word.duration > this.durationTransp) {
            result = (word.duration - this.durationTransp) / (maxDuration - this.durationTransp);
        }
        return result;
    };

    Path.prototype._mapCharSpeedToColor = function (ctx, word, maxCharSpeed) {
        var result = 0;
        if (word.charSpeed > 0) {
            result = 1 - word.charSpeed / maxCharSpeed;
        }
        return result;
    };

    Path.prototype._mapSyllableSpeedToColor = function (ctx, word, maxSyllableSpeed) {
        var result = 0;
        if (word.syllableSpeed > 0) {
            result = 1 - word.syllableSpeed / maxSyllableSpeed;
        }
        return result;
    };

    Path.prototype._showFixations = function (ctx, fixations) {
        ctx.fillStyle = this.fixationColor;
        ctx.strokeStyle = this.saccadeColor;

        var prevFix, fix;
        for (var i = 0; i < fixations.length; i += 1) {
            fix = fixations[i];
            if (fix.x <= 0 && fix.y <= 0) {
                continue;
            }

            if (this.showSaccades && prevFix) {
                this._drawSaccade( ctx, prevFix, fix );
            }

            this._drawFixation( ctx, fix );

            if (this.showConnections && fix.word) {
                ctx.strokeStyle = this.connectionColor;
                this._drawConnection( ctx, fix, {x: fix.word.left, y: fix.word.top} );
                ctx.strokeStyle = this.saccadeColor;
            }

            prevFix = fix;
        }
    };

    Path.prototype._drawTitle = function (ctx, title) {
        ctx.fillStyle = this.textColor;
        ctx.font = this.textFont;

        var textWidth = ctx.measureText( title ).width;
        ctx.fillText( title, (_canvas.width - textWidth) / 2, 32);
    }

    Path.prototype._drawFixation = function (ctx, fixation) {
        if (fixation.line != undefined) {
            ctx.fillStyle = this.lineColors[ fixation.line % 6 ];
        }
        else {
            ctx.fillStyle = this.fixationColor;
        }

        ctx.beginPath();
        ctx.arc( fixation.x, fixation.y, Math.round( Math.sqrt( fixation.duration ) ) / 2, 0, 2*Math.PI);
        ctx.fill();

        if (this.showOriginalFixLocation && fixation._x) {
            ctx.fillStyle = "rgba(255,255,255,0.15)";
            ctx.beginPath();
            ctx.arc( fixation._x, fixation.y, Math.round( Math.sqrt( fixation.duration ) ) / 2, 0, 2*Math.PI);
            ctx.fill();
        }
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

    Path.prototype._drawWord = function (ctx, word, backgroundAlpha) {

        // if (word.duration && !ignoreDuration) {
        //     ctx.fillStyle = app.Colors.rgb2rgba( this.wordHighlightColor, 
        //             Math.max( 0, Math.min( 1, (word.duration - this.durationTransp) / (this.durationOpaque - this.durationTransp) ) ) );
        //     ctx.fillRect( word.x, word.y, word.width, word.height);
        // }

        if (backgroundAlpha > 0) {
            //backgroundAlpha = Math.sin( backgroundAlpha * Math.PI / 2);
            ctx.fillStyle = app.Colors.rgb2rgba( this.wordHighlightColor, backgroundAlpha);
            ctx.fillRect( Math.round( word.x ), Math.round( word.y ), Math.round( word.width ), Math.round( word.height ) );
        }

        ctx.fillStyle = this.wordColor;
        ctx.fillText( word.text, word.x, word.y + 0.8 * word.height);

        ctx.lineWidth = 1;
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

    Path.prototype._remapStatic = function (session) {
        localStorage.setItem('data', JSON.stringify(session));

        app.StaticFit.map(session);
        return session.fixations;
    }

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
