// Requires:
//      app,Colors
//      app.firebase
//      app.WordList
//      utils/metric
//      utils/visualization

(function (app) { 'use strict';

    // Word gazing display routine
    // Constructor arguments:
    //      options: {
    //          spacingNames        - spacing names
    //          fixationColor       - fixation color
    //          showFixations       - fixation display flag
    //          uniteSpacings       - if true, then the sessions with different spacing will be united
    //          showRegressions     - regression display flag
    //      }
    function WordGazing (options) {

        this.spacingNames = options.spacingNames;
        this.fixationColor = options.fixationColor || '#000';

        this.showFixations = options.showFixations !== undefined ? options.showFixations : false;
        this.uniteSpacings = options.uniteSpacings !== undefined ? options.uniteSpacings : true;
        this.showRegressions = options.showRegressions !== undefined ? options.showRegressions : false;

        app.Visualization.call( this, options );
    }

    app.loaded( () => { // we have to defer the prototype definition until the Visualization mudule is loaded

    WordGazing.prototype = Object.create( app.Visualization.prototype );
    WordGazing.prototype.base = app.Visualization.prototype;
    WordGazing.prototype.constructor = WordGazing;

    WordGazing.prototype._fillDataQueryList = function (list) {
        var conditions = this._getConditions( this.uniteSpacings );

        for (var key of conditions.keys()) {
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

        app.WordList.instance.show();

        var words, fixes;
        var fixations = [];
        var sessionNames = [];
        this._snapshot.forEach( childSnapshot => {
            var sessionName = childSnapshot.key();
            var key = this._getConditionNameFromSessionName( sessionName, !this.uniteSpacings );
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

            var showIDs = false;
            this._drawWords( ctx, words, metricRange, showIDs );

            if (this.showFixations) {
                this._drawFixations( ctx, fixations );
            }

            this._drawTitle( ctx, `${conditionTitle} for ${sessionNames.length} sessions` );

            app.WordList.instance.fill( words, { units: app.WordList.Units.PERCENTAGE } );
        }
    };

    WordGazing.prototype._loadSession = function (words, sessionName) {
        var fixations;
        var participantName = getParticipantNameFromSessionName( sessionName );
        var session = this._snapshot.child( sessionName );
        if (session && session.exists()) {
            var sessionVal = session.val();
            if (sessionVal && sessionVal.fixations && sessionVal.words) {
                if (!words) {   // this is the first session to load
                    words = sessionVal.words;
                }
                // switch (this.mapping) {
                //     case app.Visualization.Mapping.STATIC: fixations = this._remapStatic( sessionVal, words ); break;
                //     case app.Visualization.Mapping.DYNAMIC: fixations = this._remapDynamic( data ); break;
                //     default: console.error( 'unknown mapping type' ); return;
                // }
                fixations = this._remapStatic( sessionVal, words )
                fixations.forEach( fixation => {
                    fixation.participant = participantName;
                });
            }
        } else {
            window.alert( 'record ' + sessionName + ' does not exist' );
        }

        //calcParticipantGazing( words );
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
    WordGazing.prototype._drawWord = function (ctx, word, backgroundAlpha, indexes) {
        this.base._drawWord.call( this, ctx, word, backgroundAlpha, indexes );

        if (!indexes) {
            if (this.showRegressions && word.regressionCount) {
                ctx.lineWidth = word.regressionCount + 1;
                ctx.strokeRect( word.x, word.y, word.width, word.height);
                ctx.lineWidth = 1;
            }
        }
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

    });

    function getParticipantNameFromSessionName (sessionName) {
        var nameParts = sessionName.split( '_' );
        if (nameParts.length === 3) {
            return nameParts[0];
        }
    }

    function compareParticipnatsByDuration (a, b) {
        if (a.duration < b.duration) {
            return 1;
        }
        if (a.duration > b.duration) {
            return -1;
        }
        return 0;
    }

    function calcParticipantGazing( words ) {
        words.forEach( word => {
            if (!word.fixations) {
                return;
            }

            let participants = new Map();
            word.fixations.forEach( fixation => {
                let participantDuration = participants.get( fixation.participant );
                if (!participantDuration) {
                    participants.set( fixation.participant, fixation.duration );
                }
                else {
                    participants.set( fixation.participant, participantDuration + fixation.duration );
                }
            });

            word.participants = [];
            participants.forEach( (value, key) => {
                word.participants.push({
                    name: key,
                    duration: value
                });
            });
            word.participants = word.participants.sort( compareParticipnatsByDuration );
        });
    }

    app.WordGazing = WordGazing;

})( this.Reading || module.exports );
