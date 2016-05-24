// Requires:
//      app,Colors
//      app.firebase
//      utils/wordSplit
//      utils/colorMetric
//      utils/metric

if (!this['Reading']) {
    var wordSplit = require('./utils/wordSplit.js');
}

(function (app) { 'use strict';

    // Word gazing display routine
    // Constructor arguments:
    //      options: {
    //          root                - selector for the element that contains statistics view
    //          spacingNames        - spacing names
    //          fixationColor       - fixation color
    //          wordColor           - word color
    //          wordHighlightColor  - mapped word rectangle color
    //          wordStrokeColor     - word rectable border color
    //          durationTransp      - transparency is 100% for this and lower durations 
    //          durationOpaque      - transparency is 0% for this and longer durations 
    //          textColor           - info text color
    //          textFont            - info text font
    //          colorMetric         - the metric to map onto the word background color
    //          showFixations       - fixation display flag
    //          uniteSpacings       - if true, then the sessions with different spacing will be united
    //          showRegressions     - regression display flag
    //      }
    //      callbacks: {x
    //          shown ()      - the path overlay was displayed
    //          hidden ()     - the path overlay was hidden
    //      }
    function WordGazing (options, callbacks) {

        this.root = options.root || document.documentElement;
        this.spacingNames = options.spacingNames;
        this.fixationColor = options.fixationColor || '#FFF';
        this.wordColor = options.wordColor || '#CCC';
        this.wordHighlightColor = options.wordHighlightColor || '#606';
        this.wordStrokeColor = options.wordStrokeColor || '#800';
        this.durationTransp = options.durationTransp || 100;
        this.durationOpaque = options.durationOpaque || 1000;
        this.textColor = options.textColor || '#CCC';
        this.textFont = options.textFont || '32px Arial';
        
        this.colorMetric = options.colorMetric || app.Metric.Type.DURATION;
        this.showFixations = options.showFixations !== undefined ? options.showFixations : false;
        this.uniteSpacings = options.uniteSpacings !== undefined ? options.uniteSpacings : true;
        this.showRegressions = options.showRegressions !== undefined ? options.showRegressions : false;

        _callbacks = callbacks;

        _view = document.querySelector( this.root );
        _canvas = document.querySelector( this.root + ' canvas');
        _sessionPrompt = document.querySelector( this.root + ' .prompt' );

        _view.classList.add( 'invisible' );
        _sessionPrompt.classList.add( 'invisible' );

        var close = document.querySelector( this.root + ' .close' );
        close.addEventListener('click', () => {
            _view.classList.add( 'invisible' );

            var ctx = _canvas.getContext('2d');
            ctx.clearRect(0, 0, _width, _height);

            if (callbacks.hidden) {
                callbacks.hidden();
            }
        });

        var select = document.querySelector( this.root + ' .select' );
        select.addEventListener('click', () => {
            var list = _sessionPrompt.querySelector( 'select' );
            var selectedOption = list.options[ list.selectedIndex ];
            this._load( selectedOption.value, selectedOption.textContent );
        });
    }

    WordGazing.prototype.queryData = function () {
        if (_snapshot) {
            this.showConditionSelectionDialog();
            return;
        }

        app.firebase.once('value', snapshot => {
            if (!snapshot.exists()) {
                alert('no records in DB');
                return;
            }

            _snapshot = snapshot;
            this.showConditionSelectionDialog();

        }, function (err) {
            alert(err);
        });
    };

    WordGazing.prototype.showConditionSelectionDialog = function () {
        if (_callbacks.shown) {
            _callbacks.shown();
        }

        _view.classList.remove( 'invisible' );

        var list = _sessionPrompt.querySelector( 'select' );
        list.innerHTML = '';

        var conditions = new Map();
        _snapshot.forEach( childSnapshot => {
            var sessionName = childSnapshot.key();
            var key = getConditionNameFromSessionName( sessionName, !this.uniteSpacings );
            if (key) {
                var sessions = conditions.get( key ) || [];
                sessions.push( sessionName );
                conditions.set( key, sessions );
            }
        });

        for (var [key, condition] of conditions) {
            var option = document.createElement('option');
            var nameParts = key.split( '_' );
            var spacingName = this.spacingNames ? this.spacingNames[ +nameParts[1] ] : nameParts[1];
            option.value = key;
            option.textContent = `Text #${+nameParts[0] + 1}`;
            if (!this.uniteSpacings) {
                option.textContent += `, spacing "${spacingName}"`;
            }
            list.appendChild( option );
        }

        _sessionPrompt.classList.remove( 'invisible' );
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
            var key = getConditionNameFromSessionName( sessionName, !this.uniteSpacings );
            if (key === conditionName) {
                [words, fixes] = this._loadSession( words, sessionName );
                if (fixes) {
                    sessionNames.push( sessionName.split( '_' )[0] );
                    fixations.push( ...fixes );
                }
            }
        });

        if (words) {
            var metricRange = app.Metric.compute( words, this.colorMetric );
            this._drawWords( _ctx, words, metricRange );
            if (this.showFixations) {
                this._drawFixations( _ctx, fixations );
            }
            this._drawTitle( _ctx, conditionTitle, sessionNames );
        }
    };

    WordGazing.prototype._loadSession = function (words, sessionName) {
        var fixations;
        var session = _snapshot.child( sessionName );
        if (session && session.exists()) {
            var sessionVal = session.val();
            if (sessionVal && sessionVal.fixations && sessionVal.words) {
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

        var text = `${condition} for ${names.length} sessions`;
        var textWidth = ctx.measureText( text ).width;
        ctx.fillText( text, (_canvas.width - textWidth) / 2, 32 );
    }

    WordGazing.prototype._drawWords = function (ctx, words, metricRange) {
        var colorMetric = app.Metric.Type;
        var converter = [
            function () { return 0; },
            this._mapDurationToColor.bind( this ),
            this._mapCharSpeedToColor.bind( this ),
            this._mapSyllableSpeedToColor.bind( this ),
        ];
        
        ctx.strokeStyle = this.wordStrokeColor;
        
        words.forEach( word => {
            var alpha = converter[ this.colorMetric ]( ctx, word, metricRange );
            this._drawWord( ctx, word, alpha );
        });
    };

    WordGazing.prototype._mapDurationToColor = function (ctx, word, maxDuration) {
        var result = 0;
        if (word.duration > this.durationTransp) {
            result = (word.duration - this.durationTransp) / (maxDuration - this.durationTransp);
        }
        return result;
    };

    WordGazing.prototype._mapCharSpeedToColor = function (ctx, word, maxCharSpeed) {
        var result = 0;
        if (word.charSpeed > 0) {
            result = 1 - word.charSpeed / maxCharSpeed;
        }
        return result;
    };

    WordGazing.prototype._mapSyllableSpeedToColor = function (ctx, word, maxSyllableSpeed) {
        var result = 0;
        if (word.syllableSpeed > 0) {
            result = 1 - word.syllableSpeed / maxSyllableSpeed;
        }
        return result;
    };

    WordGazing.prototype._drawWord = function (ctx, word, backgroundAlpha) {
        if (backgroundAlpha > 0) {
            //backgroundAlpha = Math.sin( backgroundAlpha * Math.PI / 2);
            ctx.fillStyle = app.Colors.rgb2rgba( this.wordHighlightColor, backgroundAlpha);
            ctx.fillRect( Math.round( word.x ), Math.round( word.y ), Math.round( word.width ), Math.round( word.height ) );
        }

        ctx.fillStyle = this.wordColor;
        ctx.fillText( word.text, word.x, word.y + 0.8 * word.height);

        ctx.lineWidth = this.showRegression && word.regressionCount ? word.regressionCount + 1 : 1;
        ctx.strokeRect( word.x, word.y, word.width, word.height);
    };

    WordGazing.prototype._drawFixations = function (ctx, fixations) {
        ctx.fillStyle = this.fixationColor;

        fixations.forEach( fixation => {
            if (fixation.x <= 0 && fixation.y <= 0) {
                return;
            }

            ctx.beginPath();
            ctx.arc( fixation.x, fixation.y, 2, 0, 2*Math.PI );
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

    function getConditionNameFromSessionName (sessionName, considerSpacings) {
        var result;
        var nameParts = sessionName.split( '_' );
        if (nameParts.length === 3) {
            result = nameParts[1];
            if (considerSpacings) {
                result += '_' + nameParts[2];
            }
        }
        return result;
    }

    app.WordGazing = WordGazing;
    
})( this['Reading'] || module.exports );
