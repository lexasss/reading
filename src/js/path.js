// Requires:
//      app,Colors
//      app.firebase
//      app.WordList
//      utils.metric
//      utils.remapExporter
(function (app) { 'use strict';

    // Path visualization constructor
    // Arguments:
    //      options: {
    //          fixationColor       - fixation color
    //          showIDs             - if set, fixations and words are labelled by IDs. FIxations also have single color
    //          saccadeColor        - saccade color
    //          connectionColor     - connection color
    //          showConnections     - flat to display fixation-word connections
    //          showSaccades        - flag to display saccades
    //          showFixations       - flag to display fixations
    //          showOriginalFixLocation - flag to display original fixation location
    //          originalFixationColor - original fixation color, if displayed
    //          greyFixationColor   - the color of fixation used for inspection
    //          fixationNumberColor - the color of fixation number
    //          greyFixationSize    - size of grey fixations
    //          numberFont          - fixation number font
    //      }
    function Path (options) {

        this.fixationColor = options.fixationColor || '#000';
        this.saccadeColor = options.saccadeColor || '#08F';
        this.connectionColor = options.connectionColor || '#F00';
        this.showIDs = options.showIDs || true;

        this.showConnections = options.showConnections !== undefined ? options.showConnections : false;
        this.showSaccades = options.showSaccades !== undefined ? options.showSaccades : false;
        this.showFixations = options.showFixations !== undefined ? options.showFixations : false;
        this.showOriginalFixLocation = options.showOriginalFixLocation !== undefined ? options.showOriginalFixLocation : false;
        this.originalFixationColor = options.originalFixationColor || 'rgba(0,0,0,0.15)';
        this.greyFixationColor = options.greyFixationColor || 'rgba(0,0,0,0.5)';
        this.fixationNumberColor = options.fixationNumberColor || '#FF0';
        this.greyFixationSize = options.greyFixationSize || 15;
        this.numberFont = options.numberFont || 'bold 16px Verdana';

        var lineColorA = 0.5;
        this.lineColors = [
            `rgba(255,0,0,${lineColorA}`,
            `rgba(255,255,0,${lineColorA}`,
            `rgba(0,255,0,${lineColorA}`,
            `rgba(0,255,224,${lineColorA}`,
            `rgba(0,128,255,${lineColorA}`,
            `rgba(255,0,255,${lineColorA}`,
        ];

        app.Visualization.call( this, options );
    }

    app.loaded( () => { // we have to defer the prototype definition until the Visualization mudule is loaded

    Path.prototype = Object.create( app.Visualization.prototype );
    Path.prototype.base = app.Visualization.prototype;
    Path.prototype.constructor = Path;

    Path.prototype.queryFile = function () {

        var readFile = function (resolve) {
            return function (file) {
                var reader = new FileReader();
                reader.onload = function (e) {
                    var lines = e.target.result.split( '\r\n' );
                    resolve({
                        rows: lines,
                        filename: file.name
                    });
                };

                console.log( 'loading', file.name );
                reader.readAsText( file );
            };
        };

        function selectAndLoadFile( showDialogProcedure, prompt ) {
            return new Promise((resolve, reject) => {
                showDialogProcedure( prompt, readFile( resolve ) );
            });
        }

        var showFileSelectionDialog = this._showFileSelectionDialog.bind( this );
        var data = {};
        selectAndLoadFile( showFileSelectionDialog, 'Select fixations:' )
            .then( fixations => {
                data.fixations = app.lundDataParser.fixations( fixations.rows );
                data.stimuliIndex = +fixations.filename
                    .split( '.' )[0]
                    .split( '_' )[1]
                    - 1;
                return selectAndLoadFile( showFileSelectionDialog, 'Select stiumuli:' );
            }).then( words => {
                data.words = app.lundDataParser.words( words.rows, data.stimuliIndex);
                this._remapAndShow( words.filename, data );
            });
    };

    Path.prototype._fillDataQueryList = function (list) {
        this._snapshot.forEach( childSnapshot => {
            var option = document.createElement('option');
            option.value = childSnapshot.key();
            option.textContent = childSnapshot.key();
            if (this._sessioName === option.value) {
                option.selected = true;
            }
            list.appendChild( option );
        });

        // app.RemapExporter.export( this._snapshot, this._remapStatic );
        //app.RemapExporter.export( this._snapshot, this._remapDynamic );
    };

    Path.prototype._load = function (name) {
        if (!this._snapshot) {
            return;
        }

        app.WordList.instance.show();

        //app.RemapExporter.save( app.RemapExporter.exportFixations( this._snapshot ).join( '\n' ), 'fixations.txt' );
        //app.RemapExporter.save( app.RemapExporter.exportWords( this._snapshot ).join( '\n' ), 'words.txt' );

        var session = this._snapshot.child( name );
        if (session && session.exists()) {
            var sessionVal = session.val();
            if (sessionVal) {
                this._remapAndShow( name, sessionVal );
            }
        } else {
            window.alert( 'record ' + name + ' does not exist' );
        }
    };

    Path.prototype._remapAndShow = function (name, data) {
        this._sessioName = name;

        var fixations;
        switch (this.mapping) {
            case app.Visualization.Mapping.STATIC: fixations = this._remapStatic( data ); break;
            case app.Visualization.Mapping.DYNAMIC: fixations = this._remapDynamic( data ); break;
            default: console.error( 'unknown mapping type' ); return;
        }

        var metricRange = app.Metric.compute( data.words, this.colorMetric );

        var ctx = this._getCanvas2D();

        this._drawWords( ctx, data.words, metricRange, this.showIDs, (this.showIDs && !this.showConnections) );
        if (this.showFixations && fixations) {
            this._drawFixations( ctx, fixations );
        }
        this._drawTitle( ctx, name );

        app.WordList.instance.fill( data.words );
    };

    Path.prototype._drawFixations = function (ctx, fixations) {
        ctx.fillStyle = this.fixationColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = this.numberFont;

        var prevFix, fix;
        var id = 0;
        for (var i = 0; i < fixations.length; i += 1) {
            fix = fixations[i];
            if (fix.x <= 0 && fix.y <= 0) {
                continue;
            }

            ctx.strokeStyle = this.saccadeColor;
            if (this.showSaccades && prevFix) {
                this._drawSaccade( ctx, prevFix, fix );
            }

            if (this.showConnections && fix.word) {
                ctx.strokeStyle = this.connectionColor;
                this._drawConnection( ctx, fix, {x: fix.word.rect.left, y: fix.word.rect.top} );
            }

            ctx.strokeStyle = '#808';
            this._drawFixation( ctx, fix, fix.id );

            prevFix = fix;
            id++;
        }
    };

    Path.prototype._drawGreyFixation = function (ctx, fixation, id) {
        ctx.fillStyle = this.greyFixationColor;
        ctx.beginPath();
        ctx.arc( fixation._x ? fixation._x : fixation.x, fixation.y, this.greyFixationSize, 0, 2*Math.PI);
        ctx.fill();

        ctx.fillStyle = this.fixationNumberColor;
        ctx.fillText( '' + id, fixation._x ? fixation._x : fixation.x, fixation.y );
    }

    Path.prototype._drawFixation = function (ctx, fixation, id) {
        var circleSize;

        if (this.showIDs) {
            this._drawGreyFixation( ctx, fixation, id );
            circleSize = this.greyFixationSize;
        }
        else {
            if (fixation.line !== undefined) {
                ctx.fillStyle = this.lineColors[ fixation.line % 6 ];
            }
            else {
                ctx.fillStyle = this.fixationColor;
            }

            circleSize = Math.round( Math.sqrt( fixation.duration ) ) / 2;

            ctx.beginPath();
            ctx.arc( fixation.x, fixation.y, circleSize, 0, 2*Math.PI);
            ctx.fill();

            if (fixation.merged) {
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc( fixation.x, fixation.y, circleSize + 3, 0, 2*Math.PI);
                ctx.stroke();
                ctx.lineWidth = 1;
            }
        }

        if (this.showOriginalFixLocation /*&& fixation._x*/) {
            ctx.fillStyle = this.originalFixationColor;
            ctx.beginPath();
            ctx.arc( fixation.x, fixation.y, circleSize, 0, 2*Math.PI);
            ctx.fill();
        }
    };

    Path.prototype._drawSaccade = function (ctx, from, to) {
        ctx.beginPath();
        ctx.moveTo( this.showIDs ? (from._x ? from._x : from.x) : from.x, from.y );
        ctx.lineTo( this.showIDs ? (to._x ? to._x : to.x) : to.x, to.y );
        ctx.stroke();
    };

    Path.prototype._drawConnection = function (ctx, from, to) {
        ctx.beginPath();
        ctx.moveTo( this.showIDs ? (from._x ? from._x : from.x) : from.x, from.y );
        ctx.lineTo( to.x, to.y );
        ctx.stroke();
    };

    Path.prototype._remapDynamic = function (session) {
        app.Logger.enabled = false;

        var fixations = app.Fixations;
        fixations.init( 80, 50 );
        fixations.reset();

        var layout = session.words.map( (word, id) => {
            return new Word({ left: word.x, top: word.y, right: word.x + word.width, bottom: word.y + word.height }, word.text  );
        });

        /*
        var model = app.Model2;

        model.init({
            linePredictor: {
                factors: {
                    currentLineDefDist: 0.4,
                    currentLineMaxDist: 0.4,
                    newLineSaccadeLengthFraction: 0.1
                }
            }
        });

        model.reset( layout );
        //model.callbacks( { onMapped: function (fixation) {} } );
        */

        var model = DGWM;
        model.init({
            fixationDetector: {
                minDuration: 100,
                threshold: 35,
                sampleDuration: 30,
                filterDemph: 0.4
            },
            textModel: {
                isTextFixed: true
            },
            line: {
                useModel: false,
                modelMaxGradient: 0.15,
                modelTypeSwitchThreshold: 8,
                modelRemoveOldFixThreshold: 10
            },
            dgwm: {
                saccadeYThresholdInLines: 1.2,
                saccadeYThresholdInSpacings: 1.75,
                fixationXDistFromLineThresholdInPixels: 100,
                fixationYDistFromLineThresholdInSpaces: 0.7,
                fixationYOffsetDiffThresholdInLines: 0.49,
                emptyLineSuperority: 0.3,
                effectiveLengthReductionMinWordLength: 1,
                effectiveLengthReductionInChars: 3
            }
        });

        model.setWords( layout );

        var result = [];
        var fixID = 0;
        session.fixations.forEach( function (fix) {
            var fixation = fixations.add( fix.x, fix.y, fix.duration );
            if (fixation) {
                fixation.id = fixID++;
                model.feedFixation( fixation );
                result.push( fixation );
            }
        });

        return result;
    };

    Path.prototype._remapStatic = function (session) {
        // localStorage.setItem('data', JSON.stringify(session));
        app.StaticFit.map( session );
        return session.fixations;
    };

    }); // end of delayed call

    function exportFixations (snapshot) {
        var records = [];
        snapshot.forEach( childSnapshot => {
            var sessionName = childSnapshot.key();
            var session = snapshot.child( sessionName );
            if (session && session.exists()) {
                var sessionVal = session.val();
                records.push( `\n${sessionName.split('_')[0]}` );
                if (sessionVal && sessionVal.fixations) {
                    records.push( `${sessionVal.setup.lineSize}\t${sessionVal.setup.textID}` );
                    sessionVal.fixations.forEach( fix => {
                        //if (fix.x > 0 && fix.y > 0) {
                            records.push( `${fix.ts}\t${fix.x}\t${fix.y}\t${fix.duration}` );
                        //}
                    });
                }
            }
        });

        return records;
    };

    function exportWords (snapshot) {
        var records = [];
        var texts = [];

        snapshot.forEach( childSnapshot => {
            var sessionName = childSnapshot.key();
            var parts = sessionName.split('_');
            var textID = parts[1];
            var lineSpacing = parts[2];
            if (lineSpacing !== '2') {
                return;
            }
            if (texts.indexOf( textID ) < 0) {
                var session = snapshot.child( sessionName );
                if (session && session.exists()) {
                    var sessionVal = session.val();
                    if (sessionVal && sessionVal.words) {
                        texts.push( textID );
                        records.push( `\n${textID}\t${lineSpacing}\n` );
                        sessionVal.words.forEach( word => {
                            records.push( `${word.x}\t${word.y}\t${word.width}\t${word.height}\t${word.text}\n` );
                        });
                    }
                }
            }

        });

        return records;
    }

    function Word (rect, text) {
        this.left = rect.left;
        this.top = rect.top;
        this.right = rect.right;
        this.bottom = rect.bottom;
        this.textContent = text;
    }

    Word.prototype.getBoundingClientRect = function () {
        return this;
    };

    app.Path = Path;

})( this.Reading || module.exports );
