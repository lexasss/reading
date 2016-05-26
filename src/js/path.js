// Requires:
//      app,Colors
//      app.firebase
//      utils.metric

(function (app) { 'use strict';

    // Path visualization constructor
    // Arguments:
    //      options: {
    //          fixationColor       - fixation color
    //          saccadeColor        - saccade color
    //          connectionColor     - connection color
    //          colorMetric         - word background coloring metric
    //          showConnections     - flat to display fixation-word connections
    //          showSaccades        - flag to display saccades
    //          showFixations       - flag to display fixations
    //          showOriginalFixLocation - flag to display original fixation location
    //      }
    function Path(options) {

        this.fixationColor = options.fixationColor || '#000';
        this.saccadeColor = options.saccadeColor || '#08F';
        this.connectionColor = options.connectionColor || '#FF0';

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

        app.Visualization.call( this, options );
    }

    app.loaded( () => { // we have to defer the prototype definitio until the Visualization mudule is loaded

    Path.prototype = Object.create( app.Visualization.prototype );
    Path.prototype.base = app.Visualization.prototype;
    Path.prototype.constructor = Path;

    Path.prototype._fillDataQueryList = function (list) {
        this._snapshot.forEach( childSnapshot => {
            var option = document.createElement('option');
            option.value = childSnapshot.key();
            option.textContent = childSnapshot.key();
            list.appendChild( option );
        });
    };

    Path.prototype._load = function (name) {
        if (!this._snapshot) {
            return;
        }

        var session = this._snapshot.child( name );
        if (session && session.exists()) {
            var sessionVal = session.val();
            if (sessionVal) {
                var fixations = this._remapStatic( sessionVal );
                var metricRange = app.Metric.compute( sessionVal.words, this.colorMetric );

                var ctx = this._getCanvas2D();

                this._drawWords( ctx, sessionVal.words, metricRange );
                if (this.showFixations && fixations) {
                    this._drawFixations( ctx, fixations );
                }
                this._drawTitle( ctx, name );
            }
        } else {
            window.alert( 'record ' + name + ' does not exist' );
        }
    };

   Path.prototype._drawFixations = function (ctx, fixations) {
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

    Path.prototype._drawFixation = function (ctx, fixation) {
        if (fixation.line !== undefined) {
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
        
        var result = [];
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
    };

    });

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
    
})( this.Reading || module.exports );
