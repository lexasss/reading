// Requires:
//      app,Colors
//      app.firebase
//      utils/wordSplit
//      utils/metric
//      utils/visualization

if (!this.Reading) {
    var wordSplit = require('./utils/wordSplit.js');
}

(function (app) { 'use strict';

    // Word gazing display routine
    // Constructor arguments:
    //      options: {
    //          spacingNames        - spacing names
    //          fixationColor       - fixation color
    //          colorMetric         - the metric to map onto the word background color
    //          showFixations       - fixation display flag
    //          uniteSpacings       - if true, then the sessions with different spacing will be united
    //          showRegressions     - regression display flag
    //      }
    function WordGazing (options) {

        this.spacingNames = options.spacingNames;
        this.fixationColor = options.fixationColor || '#FFF';
        
        this.colorMetric = options.colorMetric || app.Metric.Type.DURATION;
        this.showFixations = options.showFixations !== undefined ? options.showFixations : false;
        this.uniteSpacings = options.uniteSpacings !== undefined ? options.uniteSpacings : true;
        this.showRegressions = options.showRegressions !== undefined ? options.showRegressions : false;

        app.Visualization.call( this, options );
    }

    app.loaded( () => { // we have to defer the prototype definitio until the Visualization mudule is loaded

    WordGazing.prototype = Object.create( app.Visualization.prototype );
    WordGazing.prototype.base = app.Visualization.prototype;
    WordGazing.prototype.constructor = WordGazing;

    WordGazing.prototype._fillDataQueryList = function (list) {
        var conditions = new Map();
        this._snapshot.forEach( childSnapshot => {
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
    };

    WordGazing.prototype._load = function( conditionName, conditionTitle ) {
        if (!this._snapshot) {
            return;
        }

        var words, fixes;
        var fixations = [];
        var sessionNames = [];
        this._snapshot.forEach( childSnapshot => {
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
            var ctx = this._getCanvas2D();
            var metricRange = app.Metric.compute( words, this.colorMetric );

            this._drawWords( ctx, words, metricRange );

            if (this.showFixations) {
                this._drawFixations( ctx, fixations );
            }

            this._drawTitle( ctx, `${conditionTitle} for ${sessionNames.length} sessions` );
        }
    };

    WordGazing.prototype._loadSession = function (words, sessionName) {
        var fixations;
        var session = this._snapshot.child( sessionName );
        if (session && session.exists()) {
            var sessionVal = session.val();
            if (sessionVal && sessionVal.fixations && sessionVal.words) {
                if (!words) {   // this is the first session to load
                    words = sessionVal.words;
                }
                fixations = this._remapStatic( sessionVal, words );
            }
        } else {
            alert('record ' + sessionName + ' does not exist');
        }

        return [words, fixations];
    };

    WordGazing.prototype._remapStatic = function (session, words) {
        //localStorage.setItem('data', JSON.stringify(session));

        app.StaticFit.map({
            fixations: session.fixations,
            setup: session.setup,
            words: words
        });
        return session.fixations;
    };

    // Overriden from Visualization._drawWord
    WordGazing.prototype._drawWord = function (ctx, word, backgroundAlpha) {
        this.base._drawWord.call( this, ctx, word, backgroundAlpha );

        ctx.lineWidth = this.showRegressions && word.regressionCount ? word.regressionCount + 1 : 1;
        ctx.strokeRect( word.x, word.y, word.width, word.height);
        ctx.lineWidth = 1;
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
        });
    };

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

    });

    app.WordGazing = WordGazing;
    
})( this.Reading || module.exports );
