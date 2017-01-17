
// Requires:
//      Firebase

var Reading = Reading || {};

// "components" contains selectors for each component
Reading.init = function (components) {

    Reading.loadingCallbacks.forEach( callback => { callback(); } );

    // DB
    Reading.firebase = new Firebase("https://burning-torch-9217.firebaseio.com/school/");

    // setup
    var syllabifier = new Reading.Syllabifier({
    });

    var textSplitter = new Reading.TextSplitter({
        root: components.text
    }, {
        prepareForSyllabification: syllabifier.prepareForSyllabification.bind( syllabifier )
    });

    var text = new Reading.Text({
        root: components.text
    }, {
        splitText: textSplitter.split.bind( textSplitter )
    });

    var visualizationCallbacks = {
        shown: text.hide,
        hidden: function () {
            if (text.initialVisibility()) {
                text.show();
            }
        }
    };

    Reading.Visualization.init( components.visualization, visualizationCallbacks );

    Reading.WordList.instance = new Reading.WordList( { container: components.wordlist } );

    var path = new Reading.Path({
        root: components.visualization
    });
    var wordGazing = new Reading.WordGazing({
        root: components.visualization,
        spacingNames: text.spacings
    });
    var rtv = new Reading.RTV({
        root: components.visualization
    });
    var gazeReplay = new Reading.GazeReplay({
        root: components.visualization
    });

    var textEditor = new Reading.TextEditor({
        root: components.textEditor,
        text: components.text
    }, {
        splitText: textSplitter.split.bind( textSplitter ),
        getText: text.getText.bind( text ),
        setText: text.setText.bind( text )
    });

    var controls = new Reading.Controls({
        root: components.controls
    }, {
        getTexts: function () { return text.texts; },
        getSpacings: function () { return text.spacings; },
        switchText: text.switchText.bind( text ),
        switchSpacing: text.switchSpacing.bind( text ),
        selectSession: path.queryData.bind( path ),
        selectCondition: wordGazing.queryData.bind( wordGazing ),
        selectFile: path.queryFile.bind( path ),
        simulate: rtv.queryData.bind( rtv ),
        gazeReplay: gazeReplay.queryData.bind( gazeReplay ),
    });

    var options = new Reading.Options({
        root: components.options,
        text: components.textContainer + ' ' + components.text
    }, {    // services
        showPointer: function (value) { return value === undefined ?
            GazeTargets.getSettings( 'pointer/show' ) :
            GazeTargets.updateSettings( { pointer: { show: value } } );
        },
        highlightWord: function (value) { return value === undefined ?
            syllabifier.highlightingEnabled :
            (syllabifier.highlightingEnabled = value);
        },
        syllabify: function (value) { return value === undefined ?
            syllabifier.syllabificationEnabled :
            (syllabifier.syllabificationEnabled = value);
        },
        voice: function (value) { return value === undefined ?
            syllabifier.voiceEnabled :
            (syllabifier.voiceEnabled = value);
        },
        hideText: function (value) { return value === undefined ?
            !text.initialVisibility() :
            text.initialVisibility( !value );
        },
        path: {
            colorMetric: function (value) { return value === undefined ?
                path.colorMetric :
                (path.colorMetric = value);
            },
            mapping: function (value) { return value === undefined ?
                path.mapping :
                (path.mapping = value);
            },
            showIDs: function (value) { return value === undefined ?
                path.showIDs :
                (path.showIDs = value);
            },
            showConnections: function (value) { return value === undefined ?
                path.showConnections :
                (path.showConnections = value);
            },
            showSaccades: function (value) { return value === undefined ?
                path.showSaccades :
                (path.showSaccades = value);
            },
            showFixations: function (value) { return value === undefined ?
                path.showFixations :
                (path.showFixations = value);
            },
            showOriginalFixLocation: function (value) { return value === undefined ?
                path.showOriginalFixLocation :
                (path.showOriginalFixLocation = value);
            }
        },
        wordGazing: {
            colorMetric: function (value) { return value === undefined ?
                wordGazing.colorMetric :
                (wordGazing.colorMetric = value);
            },
            showFixations: function (value) { return value === undefined ?
                wordGazing.showFixations :
                (wordGazing.showFixations = value);
            },
            uniteSpacings: function (value) { return value === undefined ?
                wordGazing.uniteSpacings :
                (wordGazing.uniteSpacings = value);
            },
            showRegressions: function (value) { return value === undefined ?
                wordGazing.showRegressions :
                (wordGazing.showRegressions = value);
            }
        },
        texts: function (value) { return value === undefined ?
            text.texts :
            text.setTexts( value )
        }
    }, {    // utils
        editText: textEditor.show.bind( textEditor ),
    });

    var statistics = new Reading.Statistics({
        root: components.statistics,
        wordClass: textSplitter.wordClass
    }, {
        getTextSetup: text.getSetup.bind( text )
    });

    /*var gazeTargetsManager = */new Reading.GazeTargetsManager({
        trackingStarted: function () {
            syllabifier.init();
            text.reset();
            statistics.init();
            options.lock();
            controls.lock();
            if (!text.initialVisibility()) {
                text.show();
            }
        },
        trackingStopped: function () {
            syllabifier.reset();
            statistics.print();
            options.unlock();
            controls.unlock();
            if (!text.initialVisibility()) {
                text.hide();
            }
            text.reset();
        },
        wordFocused: function (word) {
            syllabifier.setFocusedWord( word );
            statistics.setFocusedWord( word );
        },
        wordLeft: function (/*word*/) {
            syllabifier.setFocusedWord( null );
            statistics.setFocusedWord( null );
        },
        updateControls: controls.onStateUpdated,
        fixation: statistics.logFixation
    });
};

Reading.loaded = function (callback) {
    Reading.loadingCallbacks.push( callback );
};

Reading.loadingCallbacks = [];
// Requires:
//      shortcut
//      GazeTargets
//      utils/logger

(function (app) { 'use strict';

    // Initializes and sets callbacks for the app controls
    // Constructor arguments:
    //      options: {
    //          root:               - controls container element ID
    //      }
    //      services: {
    //          getTexts ()         - retrieve the list of texts
    //          getSpacings ()      - retrieve the list of spacings
    //          switchText (id)     - switch the text to "id"
    //          switchSpacing (id)  - switch the spacing to "id"
    //          selectSession ()    - show a DB session selection dialog
    //          selectCondition ()  - show a condition selection dialog
    //      }
    function Controls (options, services) {
        this.root = options.root || document.documentElement;

        _services = services;

        var logError = app.Logger.moduleErrorPrinter( 'Controls' );
        _services.getTexts = _services.getTexts || logError( 'getTexts' );
        _services.getSpacings = _services.getSpacings || logError( 'getSpacings' );
        _services.switchText = _services.switchText || logError( 'switchText' );
        _services.switchSpacing = _services.switchSpacing || logError( 'switchSpacing' );
        _services.selectSession = _services.selectSession || logError( 'selectSession' );
        _services.selectCondition = _services.selectCondition || logError( 'selectCondition' );
        _services.selectFile = _services.selectFile || logError( 'selectFile' );
        _services.simulate = _services.simulate || logError( 'simulate' );
        _services.gazeReplay = _services.gazeReplay || logError( 'gazeReplay' );

        //var container = document.querySelector( this.root );

        _device = document.querySelector( this.root + ' .device' );

        _options = document.querySelector( this.root + ' .options' );
        _options.addEventListener('click', function () {
            GazeTargets.ETUDriver.showOptions();
        });

        _calibrate = document.querySelector( this.root + ' .calibrate' );
        _calibrate.addEventListener('click', function () {
            GazeTargets.ETUDriver.calibrate();
        });

        _toggle = document.querySelector( this.root + ' .toggle' );
        _toggle.addEventListener('click', function () {
            setButtonDisabled( _toggle, true );
            GazeTargets.ETUDriver.toggleTracking();
        });

        _textSwitchers = document.querySelector( this.root + ' .text' );
        var texts = _services.getTexts();
        for (let i = 0; i < texts.length; i += 1) {
            let swither = document.createElement('div');
            swither.className = 'button';
            swither.textContent = 'Text ' + (i + 1);
            swither.addEventListener('click', getTextSwitcherHandler( i ));
            if (i === 0) {
                swither.classList.add('selected');
            }
            _textSwitchers.appendChild( swither );
        }

        _spacingSwitchers = document.querySelector( this.root + ' .spacing' );
        var spacings = _services.getSpacings();
        for (let i = 0; i < spacings.length; i += 1) {
            let swither = document.createElement('div');
            swither.className = 'button';
            swither.textContent = spacings[ i ];
            swither.addEventListener('click', getSpacingSwitcherHandler( i ));
            if (i === 0) {
                swither.classList.add('selected');
            }
            _spacingSwitchers.appendChild( swither );
        }

        _loadSession = document.querySelector( this.root + ' .loadSession' );
        _loadSession.addEventListener('click', function () {
            _services.selectSession();
        });

        _loadCondition = document.querySelector( this.root + ' .loadCondition' );
        _loadCondition.addEventListener('click', function () {
            _services.selectCondition();
        });

        _loadFile = document.querySelector( this.root + ' .loadFile' );
        _loadFile.addEventListener('click', function () {
            _services.selectFile();
        });

        _simulate = document.querySelector( this.root + ' .simulate' );
        _simulate.addEventListener('click', function () {
            _services.simulate( true );
        });

        _gazeReplay = document.querySelector( this.root + ' .gazeReplay' );
        _gazeReplay.addEventListener('click', function () {
            _services.gazeReplay( true );
        });

        // shortcut.add( 'Space', function() {
        //     _toggle.click();
        // });

        _connectionTimeout = setTimeout(function () {
            _device.textContent = 'Disconnected';
        }, 3000);

        _services.switchText(0);
        _services.switchSpacing(0);
    }

    Controls.prototype.lock = function () {
        setButtonBlockDisabled( _textSwitchers, true );
        setButtonBlockDisabled( _spacingSwitchers, true );
        _loadSession.classList.add( 'disabled' );
        _loadCondition.classList.add( 'disabled' );
        _loadFile.classList.add( 'disabled' );
        _simulate.classList.add( 'disabled' );
        _gazeReplay.classList.add( 'disabled' );
    };

    Controls.prototype.unlock = function () {
        setButtonBlockDisabled( _textSwitchers, false );
        setButtonBlockDisabled( _spacingSwitchers, false );
        _loadSession.classList.remove( 'disabled' );
        _loadCondition.classList.remove( 'disabled' );
        _loadFile.classList.remove( 'disabled' );
        _simulate.classList.remove( 'disabled' );
        _gazeReplay.classList.remove( 'disabled' );
    };

    Controls.prototype.onStateUpdated = function (state) {
        if (state.device) {
            _device.textContent = state.device;
            clearTimeout( _connectionTimeout );
        }
        else if (!state.isConnected) {
            _device.textContent = 'Disconnected';
        }

        setButtonDisabled( _options, !state.isServiceRunning || state.isTracking || state.isBusy);
        setButtonDisabled( _calibrate, !state.isConnected || state.isTracking || state.isBusy);
        setButtonDisabled( _toggle, !state.isCalibrated || state.isBusy);

        _toggle.textContent = state.isTracking ? 'Stop' : 'Start';
    };

    // private

    function setButtonDisabled(button, isDisabled) {
        if (isDisabled) {
            button.classList.add('disabled');
        } else {
            button.classList.remove('disabled');
        }
    }

    function setButtonBlockDisabled(container, isDisabled) {
        var switches = container.childNodes;
        for (var i = 0; i < switches.length; i += 1) {
            setButtonDisabled( switches.item(i), isDisabled);
        }
    }

    function getTextSwitcherHandler(index) {
        return function () {
            _services.switchText( index );
            select(this, _textSwitchers);
        };
    }

    function getSpacingSwitcherHandler(index) {
        return function () {
            _services.switchSpacing( index );
            select(this, _spacingSwitchers);
        };
    }

    function select(button, container) {
        var switches = container.childNodes;
        for (var i = 0; i < switches.length; i += 1) {
            switches.item(i).classList.remove('selected');
        }
        button.classList.add('selected');
    }

    var _services;
    var _device;
    var _options;
    var _calibrate;
    var _toggle;

    var _textSwitchers;
    var _spacingSwitchers;
    var _loadSession;
    var _loadCondition;
    var _loadFile;
    var _simulate;
    var _gazeReplay;

    var _connectionTimeout;

    app.Controls = Controls;

})( this.Reading || module.exports );

// Requires:
//      app,Colors
//      app.firebase
//      utils.metric
//      utils.remapExporter

(function (app) { 'use strict';

    // Real-time visualization constructor
    // Arguments:
    //      options: {
    //          // name font options
    //          nameFontFamily
    //          nameFontSize
    //          nameFont,
    //          basePointerSize (Number) - minimum pointer size
    //      }
    function GazeReplay (options) {

        this.nameFontFamily = options.nameFontFamily || 'Calibri, Arial, sans-serif';
        this.nameFontSize = options.nameFontFamily || 14;
        this.nameFont = options.nameFontFamily || `bold ${this.nameFontSize}px ${this.nameFontFamily}`;

        Track.basePointerSize = options.basePointerSize || Track.basePointerSize;

        this.words = null;

        options.wordColor = options.wordColor || '#222';
        options.colorMetric = app.Metric.Type.NONE;

        app.Visualization.call( this, options );
    }

    app.loaded( () => { // we have to defer the prototype definition until the Visualization mudule is loaded

    GazeReplay.prototype = Object.create( app.Visualization.prototype );
    GazeReplay.prototype.base = app.Visualization.prototype;
    GazeReplay.prototype.constructor = GazeReplay;

    GazeReplay.prototype._stopAll = function () {
        if (this._tracks) {
            this._tracks.forEach( track => track.stop() );
        }
    }

    GazeReplay.prototype._fillDataQueryList = function (list) {

        var conditions = this._getConditions( false );
        var result = new Map();

        for (var key of conditions.keys()) {
            result.set( `Text #${key}`, conditions.get( key ) );
        }

        return result;
    };

    GazeReplay.prototype._load = function (names) {
        if (!this._snapshot) {
            return;
        }

        if (!this._tracks) {    // first time, since we do not nullify this._tracks
            let onHidden = this._callbacks().hidden;
            this._callbacks().hidden = () => {
                this._stopAll();
                if (onHidden) {
                    onHidden();
                }
            }
        }

        Track.colorIndex = 0;
        var tracks = [];
        names.forEach( (name, index) => {
            var session = this._snapshot.child( name );
            if (session && session.exists()) {
                var sessionVal = session.val();
                if (sessionVal && sessionVal.fixations) {
                    tracks.push( new Track( app.Visualization.root, name, sessionVal ) );
                    this.words = sessionVal.words;
                }
            }
        });

        if (!tracks.length) {
            return;
        }

        var ctx = this._getCanvas2D();

        // var words = tracks[0].words;
        this._drawWords( ctx, this.words, null, false, true );
        this._drawNames( ctx, tracks );

        this._run( ctx, tracks );
        this._tracks = tracks;
    };

    GazeReplay.prototype._drawNames = function (ctx, tracks) {
        tracks.forEach( (track, ti) => {
            ctx.textAlign = 'left';
            ctx.textBaseline = 'bottom';
            ctx.fillStyle = track.color;
            ctx.font = this.nameFont;

            ctx.fillText(
                track.name,
                8,
                64 + 25 * ti
            );
        });
    };

    GazeReplay.prototype._run = function (ctx, tracks) {
        tracks.forEach( (track, ti) => {
            track.start(
                // fixation
                (fixation, pointer) => {
                },
                 // done
                () => {
                    ctx.textAlign = 'left';
                    ctx.textBaseline = 'bottom';
                    ctx.strokeStyle = '#000';
                    ctx.fillStyle = track.color;
                    ctx.font = this.nameFont;
                    ctx.fillText(
                        'v',
                        5,
                        20 + 25 * ti
                    );
                }
            );
        })
    };

    }); // end of delayed call

    function Track (root, name, session) {
        this.root = root;
        this.name = name;
        this.color = Track.colors[ Track.colorIndex++ % Track.colors.length ];

        this.pointerSize = 8;
        this.fixationTimer = null;
        this.nextTimer = null;

        this.fixations = session.fixations;

        this.delay = Math.round( 3000 * Math.random() );
        this.fixationIndex = -1;

        this.__next = this._next.bind( this );
    }

    Track.basePointerSize = 6;

    Track.colorIndex = 0;

    Track.colors = [
        '#4D4D4D',
        '#5DA5DA',
        '#FAA43A',
        '#60BD68',
        '#F17CB0',
        '#B2912F',
        '#B276B2',
        '#DECF3F',
        '#F15854',

        // '#FF0000',
        // '#00FF00',
        // '#0000FF',
        // '#FFFF00',
        // '#FF00FF',
        // '#00FFFF',
        // '#800000',
        // '#008000',
        // '#000080',
        // '#808000',
        // '#800080',
        // '#008080',
        // '#C0C0C0',
        // '#808080',
        // '#9999FF',
        // '#993366',
        // '#FFFFCC',
        // '#CCFFFF',
        // '#660066',
        // '#FF8080',
        // '#0066CC',
        // '#CCCCFF',
        // '#000080',
        // '#FF00FF',
        // '#FFFF00',
        // '#00FFFF',
        // '#800080',
        // '#800000',
        // '#008080',
        // '#0000FF',
        // '#00CCFF',
        // '#CCFFFF',
        // '#CCFFCC',
        // '#FFFF99',
        // '#99CCFF',
        // '#FF99CC',
        // '#CC99FF',
        // '#FFCC99',
        // '#3366FF',
        // '#33CCCC',
        // '#99CC00',
        // '#FFCC00',
        // '#FF9900',
        // '#FF6600',
        // '#666699',
        // '#969696',
        // '#003366',
        // '#339966',
        // '#003300',
        // '#333300',
        // '#993300',
        // '#993366',
        // '#333399',
        // '#333333',
    ];

    Track.prototype.start = function (onFixation, onCompleted) {
        this.onFixation = onFixation;
        this.onCompleted = onCompleted;

        this.fixationIndex = 0;

        this.pointer = document.createElement( 'div' );
        this.pointer.classList.add( 'track_pointer' );
        this.pointer.classList.add( 'invisible' );
        this.root.appendChild( this.pointer );

        this.nextTimer = setTimeout( this.__next, this.delay);
    }

    Track.prototype.stop = function () {
        if (this.nextTimer) {
            clearTimeout( this.nextTimer );
            this.nextTimer = null;
        }

        if (this.fixationTimer) {
            clearTimeout( this.fixationTimer );
            this.fixationTimer = null;
        }

        if (this.pointer) {
            this.root.removeChild( this.pointer );
            this.pointer = null;
        }
    }

    Track.prototype._next = function () {
        let fixation = this.fixations[ this.fixationIndex ];

        this._moveFixation( fixation );

        this.fixationIndex++;
        if (this.fixationIndex < this.fixations.length) {
            let pause = this.fixations[ this.fixationIndex ].ts - fixation.ts;
            this.nextTimer = setTimeout( this.__next, pause );
        }
        else {
            this.onCompleted();
            this.root.removeChild( this.pointer );
            this.pointer = null;
            this.nextTimer = null;
        }
    }

    Track.prototype._moveFixation = function (fixation) {
        if (this.fixationTimer) {
            clearTimeout( this.fixationTimer );
            this.fixationTimer = null;
        }

        if (fixation) {
            this.onFixation( fixation, this.pointer );

            if (fixation.x > 0 && fixation.y > 0) {
                const size = Track.basePointerSize + Math.sqrt( fixation.duration / 30 );
                this.pointer.style = `left: ${fixation.x - size / 2}px;
                                      top: ${fixation.y - size / 2}px;
                                      width: ${size}px;
                                      height: ${size}px;
                                      border-radius: ${size / 2}px;
                                      background-color: ${this.color};`;
                this.pointer.classList.remove( 'invisible' );
            }

            this.fixationTimer = setTimeout( () => {
                this.fixationTimer = null;
                if (this.pointer) {
                    this.pointer.classList.add( 'invisible' );
                }
            }, fixation.duration);
        }
        else {
            this.pointer.classList.add( 'invisible' );
        }
    }

    app.GazeReplay = GazeReplay;

})( this.Reading || module.exports );

// Requires:
//      GazeTargets

(function (app) { 'use strict';

    // Initializes and sets callbacks for the GazeTargets global object
    // Constructor arguments:
    //      callbacks: {
    //          trackingStarted ()      - triggers when the tracking starts
    //          trackingStopped ()      - triggers when the tracking ends
    //          wordFocused (word)      - triggers when a word becomes focused
    //                  word: the word DOM object 
    //          wordLeft (word)         - triggers when gaze leaves a word
    //                  word: the word DOM object 
    //      }
    function GazeTargetsManager(callbacks) {

        GazeTargets.init({
            etudPanel: {
               show: false
            },
            pointer: {
                show: false
            },
            targets: [
                {
                    selector: '.word',
                    selection: {
                        type: GazeTargets.selection.types.none
                    },
                    mapping: {
                        className: ''
                    }
                }
            ],
            mapping: {
                type: GazeTargets.mapping.types.reading,  
                source: GazeTargets.mapping.sources.fixations,
                readingModel: GazeTargets.mapping.readingModel.campbell,
                expansion: 30,
                reading: {
                    maxSaccadeLength: 250,
                    maxSaccadeAngleRatio: 0.7,
                    fixedText: true
                }
            }
        }, {
            state: function (state) {
                if (state.isTracking) {
                    if (callbacks.trackingStarted)
                        callbacks.trackingStarted();
                }
                else if (state.isStopped) {
                    if (callbacks.trackingStopped)
                        callbacks.trackingStopped();
                }

                if (callbacks.updateControls) {
                    callbacks.updateControls( state );
                }
            },

            target: function (event, target) {
                if (event === 'focused') {
                    if (callbacks.wordFocused)
                        callbacks.wordFocused( target );
                }
                else if (event === 'left') {
                    if (callbacks.wordLeft)
                        callbacks.wordLeft( target );
                }
            },

            fixation: callbacks.fixation
        });
    }

    app.GazeTargetsManager = GazeTargetsManager;
    
})( this.Reading || module.exports );


// Requires:
//      model/zone

if (!this.Reading) {
    module.exports.Zone = require('./zone.js').Zone;
}

(function (app) { 'use strict';

    var Fixations = {

        init: function (options) {
            options = options || {};

            _minDuration = options.minDuration || 80;
            _threshold = options.threshold || 70;
            _sampleDuration = options.sampleDuration || 33;
            _lpc = options.filterDemph || 0.4;
            _invLpc = 1 - _lpc;
            
            _zone = app.Zone;

            _currentFixation = new Fixation( -10000, -10000, Number.MAX_VALUE );
            _currentFixation.saccade = new Saccade( 0, 0 );
        },

        feed: function (data1, data2) {

            var result;
            if (data2 !== undefined) {    // this is smaple
                result = parseSample( data1, data2 );
            }
            else {
                result = parseFixation( data1 );
            }
            return result;
        },

        add: function (x, y, duration) {
            if (duration < _minDuration) {
                return null;
            }

            var fixation = new Fixation( x, y, duration );
            fixation.previous = _currentFixation;
            _currentFixation.next = fixation;
            
            fixation.saccade = new Saccade( x - _currentFixation.x, y - _currentFixation.y );
            
            _currentFixation = fixation;
                
            return _currentFixation;
        },

        reset: function () {
            _fixations.length = 0;

            _currentFixation = new Fixation(-10000, -10000, Number.MAX_VALUE);
            _currentFixation.saccade = new Saccade(0, 0);

            _candidate = null;
        },

        current: function() {
            return _currentFixation;
        }
    };

    // internal
    var _minDuration;
    var _threshold;
    var _sampleDuration;

    var _fixations = [];
    var _currentFixation;
    var _candidate = null;

    var _lpc;
    var _invLpc;

    var _zone;

    function parseSample (x, y) {
        var dx = x - _currentFixation.x;
        var dy = y - _currentFixation.y;
        var result;

        if (Math.sqrt( dx * dx + dy * dy) > _threshold) {
            if (_candidate === null) {
                _candidate = new Fixation(x, y, _sampleDuration);
                _candidate.previous = _currentFixation;
                _candidate.saccade = new Saccade(x - _currentFixation.x, y - _currentFixation.y);
                _currentFixation.next = _candidate;
            }
            else {
                _candidate.x = _lpc * x + _invLpc * _candidate.x;
                _candidate.y = _lpc * y + _invLpc * _candidate.y;
                _candidate.duration += _sampleDuration;
                _currentFixation = _candidate;
                _candidate = null;
            }
        }
        else {
            _candidate = null;
            var prevDuration = _currentFixation.duration;
            _currentFixation.duration += _sampleDuration;
            _currentFixation.x = _lpc * _currentFixation.x + _invLpc * x;
            _currentFixation.y = _lpc * _currentFixation.y + _invLpc * y;
            
            if (prevDuration < _minDuration && _currentFixation.duration >= _minDuration) {
                result = _currentFixation;
            }
        }

        return result;
    }

    function parseFixation (progressingFixation) {

        if (progressingFixation.duration < _minDuration) {
            return null;
        }

        var result = null;
        if (_currentFixation.duration > progressingFixation.duration) {
            var fixation = new Fixation( progressingFixation.x, progressingFixation.y, progressingFixation.duration );
            fixation.previous = _currentFixation;
            _currentFixation.next = fixation;
            
            var saccade = progressingFixation.saccade;
            if (saccade) {
                fixation.saccade = new Saccade( saccade.dx, saccade.dy );
            }
            else {
                fixation.saccade = new Saccade( progressingFixation.x - _currentFixation.x, 
                                                progressingFixation.y - _currentFixation.y );
            }
            
            _currentFixation = fixation;
            _fixations.push( _currentFixation );
                
            result = _currentFixation;
        }
        else {
            _currentFixation.duration = progressingFixation.duration;
            _currentFixation.x = progressingFixation.x;
            _currentFixation.y = progressingFixation.y;
        }

        return result;
    }

    // Fixation
    function Fixation (x, y, duration) {
        this.x = x;
        this.y = y;
        this.duration = duration;
        this.saccade = null;
        this.word = null;
        this.previous = null;
        this.next = null;
    }

    Fixation.prototype.toString = function () {
        return 'FIX ' + this.x + ',' + this.y + ' / ' + this.duration +
            'ms S=[' + this.saccade + '], W=[' + this.word + ']';
    };

    // Saccade
    function Saccade (x, y) {
        this.x = x;
        this.y = y;
        this.zone = _zone.nonreading;
        this.newLine = false;
    }

    Saccade.prototype.toString = function () {
        return this.x + ',' + this.y + ' / ' + this.zone + ',' + this.newLine;
    };

    // Publication
    app.Fixations = Fixations;
    app.Fixation = Fixation;
    app.Saccade = Saccade;

})( this.Reading || module.exports );
// Requires:
//      utils/logger

if (!this.Reading) {
    module.exports.Logger = require('../utils/logger.js').Logger;
    module.exports.Line = require('./line.js').Line;
}

(function (app) { 'use strict';

    var Geometry = {

        init: function (options) {
            options = options || {};

            _isTextFixed = options.isTextFixed || true;

            _logger = app.Logger.forModule( 'Geometry' );
        },

        create: function (targets) {
            if (_isTextFixed && _lines.length > 0) {
                return null;
            }

            this.reset();
        
            compute( targets );

            return this.model();
        },

        reset: function () {
            // _lines.forEach(function (line) {
            //     line.forEach(function (w) {
            //         _logger.log('new Word({ left: ' + w.rect.left + 
            //             ', top: ' + w.rect.top + 
            //             ', right: ' + w.rect.right + 
            //             ', bottom: ' + w.rect.bottom + ' }),');
            //     });
            // });
            _lines = [];
            _lineSpacing = 0;
            _lineHeight = 0;
            _lineWidth = 0;
        },

        model: function () {
            return {
                lines: _lines,
                lineSpacing: _lineSpacing,
                lineHeight: _lineHeight,
                lineWidth: _lineWidth
            };
        }
    };

    var _isTextFixed;

    var _lines = [];
    var _lineSpacing;
    var _lineHeight;
    var _lineWidth;

    var _logger;

    function compute (targets) {

        var lineY = 0;
        var currentLine = null;

        for (var i = 0; i < targets.length; i += 1) {
            var target = targets[i];
            var rect = target.getBoundingClientRect();
            if (lineY < rect.top || !currentLine) {
                if (currentLine) {
                    _lineSpacing += rect.top - currentLine.top;
                    _lineHeight += currentLine.bottom - currentLine.top;
                    if (_lineWidth < currentLine.right - currentLine.left) {
                        _lineWidth = currentLine.right - currentLine.left;
                    }
                }
                currentLine = new app.Line( rect, i, target, _lines.length, _lines[ _lines.length - 1 ] );
                _lines.push( currentLine );
                lineY = rect.top;
            }
            else {
                currentLine.add( rect, i, target );
            }
//                _logger.log('{ left: ' + Math.round(rect.left) + ', top: ' + Math.round(rect.top) + ', right: ' + Math.round(rect.right) + ', bottom: ' + Math.round(rect.bottom) + ' }');
        }

        if (currentLine) {
            _lineHeight += currentLine.bottom - currentLine.top;
            _lineHeight /= _lines.length;
            if (_lineWidth < currentLine.right - currentLine.left) {
                _lineWidth = currentLine.right - currentLine.left;
            }
        }

        if (_lines.length > 1) {
            _lineSpacing /= _lines.length - 1;
        }
        else if (_lines.length > 0) {
            var line = _lines[0];
            _lineSpacing = 2 * (line.bottom - line.top);
        }
        
        var log = _logger.start( _lines.length + ' lines' );
        _logger.end( log );
    }

    // Publication
    app.Geometry = Geometry;

})( this.Reading || module.exports );
// Requires:
//      libs/regression
//      utils/logger

if (!this.Reading) {
    var regression = require('../../../libs/regression.js');
    module.exports.Logger = require('../utils/logger.js').Logger;
}

(function (app) { 'use strict';
    
    // Line object
    function Line (word, wordID, dom, index, prevLine) {
        this.left = Number.MAX_VALUE;
        this.top = Number.MAX_VALUE;
        this.right = Number.MIN_VALUE;
        this.bottom = Number.MIN_VALUE;
        this.center = undefined;

        this.index = index || 0;
        this.previous = prevLine || null;
        this.next = null;
        if (this.previous) {
            this.previous.next = this;
        }
        
        this.fixations = [];
        this.fitEq = null;

        this.words = [];

        if (word) {
            this.add( word, wordID, dom );
        }
    }

    Line.init = function () {
        _logger = app.Logger.forModule( 'Line' );
    };

    Line.prototype.width = function () {
        return this.right - this.left;
    };

    Line.prototype.add = function (word, wordID, dom) {
        this.left = Math.min( this.left, word.left );
        this.right = Math.max( this.right, word.right );
        this.top = Math.min( this.top, word.top );
        this.bottom = Math.max( this.bottom, word.bottom );

        this.center = {
            x: (this.left + this.right) / 2,
            y: (this.top + this.bottom) / 2
        };

        this.words.push( new Word( word, wordID, dom, this ) );
    };

    Line.prototype.addFixation = function (fixation) {

        this.fixations.push( [fixation.x, fixation.y, fixation.saccade] );
        _log = _logger.start();

        if (this.fixations.length > 1) {
            this._removeOldFixation();
            var type = this.fixations.length < _modelTypeSwitchThreshold ? 'linear' : 'polynomial';
            var model = regression.model( type, this.fixations, 2 );
            this.fitEq = model.equation;
            _log.push( 'model for line', this.index, ':', this.fitEq );

            if (type === 'linear') {    // put restriction on the gradient
                if (this.fitEq[1] < -_modelMaxGradient) {
                    this.fitEq = fixLinearModel( this.fixations, -_modelMaxGradient );
                    _log.push( 'model reset to', this.fitEq );
                }
                else if (this.fitEq[1] > _modelMaxGradient) {
                    this.fitEq = fixLinearModel( this.fixations, _modelMaxGradient );
                    _log.push( 'model reset to', this.fitEq );
                }
            }
        }
        
        _logger.end( _log );
    };

    // returns difference between model x and the actual x
    Line.prototype.fit = function (x, y) {
        if (this.fitEq) {
            var result = y - regression.fit( this.fitEq, x );
            //_logger.log( 'fitting', x, 'to line', this.index, ': error is ', result );
            var log = _logger.start();
            log.push( 'e[', this.index, '|', x, y, '] =', Math.floor( result ) );
            _logger.end( log );

            return result;
        }
        return Number.MAX_VALUE;
    };

    Line.prototype._removeOldFixation = function () {
        var lastIndex = this.fixations.length - 1;
        if (lastIndex < 5) {
            return;
        }

        var index = lastIndex;
        var fix;
        while (index > 0) {
            fix = this.fixations[ index ];
            if (index > 0 && fix[2].newLine) {       // the current line started here
                if (lastIndex - index + 1 > _modelRemoveOldFixThreshold) {     // lets have at least N fixations
                    this.fixations = this.fixations.slice( index );
                    _log.push( 'line fixations: reduced' );
                }
                break;
            }
            index -= 1;
        }
    };

    // internal
    var _modelMaxGradient = 0.15;
    var _modelTypeSwitchThreshold = 8;
    var _modelRemoveOldFixThreshold = 10;

    var _logger;
    var _log;

    function fixLinearModel (fixations, gradient) {
        var sum = 0;
        for (var i = 0; i < fixations.length; ++i) {
            var fix = fixations[i];
            sum += fix[1] - gradient * fix[0];
        }
        return [sum / fixations.length, gradient];
    }

    // Word object
    function Word (rect, id, dom, line) {
        this.rect = rect;
        this.id = id;
        this.dom = dom;
        this.line = line;
        this.index = line.words.length;
    }

    Word.prototype.toString = function () {
        return this.rect.left + ',' + this.rect.top + ' / ' + this.line.index;
    };

    // Publication
    app.Line = Line;
    app.Word = Word;

})( this.Reading || module.exports );
// Requires:
//      utils/logger

if (!this.Reading) {
    var logger = require('../utils/logger.js').Logger;
    module.exports.Line = require('./line.js').Line;
}

(function (app) { 'use strict';

    var LinePredictor = {

        init: function (geomModel, settings) {
            _geomModel = geomModel;

            settings = settings || {};

            _currentLineDistReduce = settings.currentLineDistReduce || 0.8;

            _threshold = (settings.threshold || 0.45) * _geomModel.lineSpacing;
            _thresholdForCurrentLine = (settings.thresholdForCurrentLine || 0.55) * _geomModel.lineSpacing;
            _thresholdForSaccade = (settings.thresholdForSaccade || 0.3) * _geomModel.lineSpacing;
            _newLineSaccadeLengthFraction = settings.newLineSaccadeLength || -0.7;

            _logger = (logger || app.Logger).forModule( 'LinePredictor' );
            
            _log = _logger.start();
            _log.push( 'currentLineDistReduce: ', _currentLineDistReduce );
            _log.push( 'currentLineDefDist: ', _threshold );
            _log.push( 'currentLineMaxDist: ', _thresholdForCurrentLine );
            _log.push( 'newLineSaccadeLengthFraction: ', _newLineSaccadeLengthFraction );
            _log.push( 'geomModel.lineSpacing: ', _geomModel.lineSpacing );
            _logger.end( _log );
        },

        get: function (isEnteredReadingMode, currentFixation, currentLine, offset) {
            var result = null;
            
            _log = _logger.start();

            if (currentFixation.previous && currentFixation.previous.saccade.newLine && !currentLine.fitEq) {
                result = checkAgainstCurrentLine( currentFixation, offset );
            }
            else if (isEnteredReadingMode || currentFixation) {
                result = guessCurrentLine( currentFixation, currentLine, offset );
            }

            if (!result) {
                result = getClosestLine( currentFixation, offset );
            }

            if (result && (!currentLine || result.index !== currentLine.index)) {
                currentFixation.saccade.newLine = true;
            }

            _logger.end( _log );
            return result;
        },

        reset: function() {
            _geomModel = null;
        }
    };

    // internal
    var _geomModel;
    var _logger;
    var _log;

    var _currentLineDistReduce;
    var _guessMaxDist;
    var _thresholdForCurrentLine;
    var _thresholdForSaccade;
    var _threshold;
    var _newLineSaccadeLengthFraction;

    function guessCurrentLine(fixation, currentLine, offset) {
        var result = null;
        var perfectLineMatch = false;
        var minDiff = Number.MAX_VALUE;
        var minDiffAbs = Number.MAX_VALUE;
        var currentLineIndex = currentLine ? currentLine.index : -1;
        var x = fixation.x;
        var y = fixation.y;

        var lines = _geomModel.lines;
        for (var i = 0; i < lines.length; ++i) {
            var line = lines[i];
            var diff = line.fit( x, y );
            var diffAbs = Math.abs( diff );
            if (currentLineIndex === line.index) {      // current line has priority:
                if (diffAbs < _threshold) {     // it must be followed in case the fixation is close
                    result = line;
                    minDiff = diff;
                    minDiffAbs = diffAbs;
                    perfectLineMatch = true;
                    _log.push( 'following the current line #', currentLineIndex );
                    break;
                }
                else if (diff != Number.MAX_VALUE) {                                  // if the distance exceeds the threshold, then 
                    diff *= _currentLineDistReduce;      // lets artificially reduce the distance
                    diffAbs = Math.abs( diff );
                    _log.push( '>>', Math.floor( diff ) );
                }
            }
            if (diffAbs < minDiffAbs) {
                result = line;
                minDiffAbs = diffAbs;
                minDiff = diff;
            }
        }

        if (!perfectLineMatch) {    // only for printing the minDiff out
            _log.push( 'dist =', minDiff != Number.MAX_VALUE ? Math.floor( minDiff ) : 'N/A' );
        }

        // threshold must depend on the saccade type: long regressive is most likely belong to a new line, 
        // thus compare the diff against reduced threshold from the lower bound

        var newLineSaccadeLength = currentLine ? currentLine.width() * _newLineSaccadeLengthFraction : 100000;
        var threshold = fixation.saccade.x < newLineSaccadeLength ? _thresholdForSaccade : _threshold;
        _log.push( 'threshold:', threshold );
        
        if (minDiffAbs < threshold ) {
            if (!perfectLineMatch) {
                _log.push( 'most likely:', result ? result.index : '---' );
            }
        }
        else if (currentLine) {     // maybe, this is a quick jump to some other line?
            result = checkLineJump( result, minDiff, currentLine, fixation, threshold );
        }
        else {
            result = null;
        }

        return result;
    }

    function checkLineJump (result, diff, currentLine, fixation, threshold) {

        _log.levelUp();
        _log.push( 'checking possible jump...' );

        var currentLineIndex = currentLine ? currentLine.index : -1;
        var lineIndex = -1;

        if (diff != Number.MAX_VALUE) { 
            lineIndex = currentLineIndex + Math.round( diff / _geomModel.lineSpacing );
            _log.push( 'supposed line:', lineIndex );
        }

        var lines = _geomModel.lines;
        if (0 <= lineIndex && lineIndex < lines.length) {

            var acceptSupposedLine = true;

            // check which one fits better
            var supposedLine = lines[ lineIndex ];
            if (supposedLine.fitEq) {   // this line was visited already, lets check which line, the supposed or the current is closer
                var supposedLineDiff = Math.abs( supposedLine.fit( fixation.x, fixation.y ) );
                _log.push( ' >> dist =', Math.floor( supposedLineDiff ) );
                if (supposedLineDiff >= Math.abs( diff ) ) {
                    acceptSupposedLine = false;
                    _log.push( ' >> keep the line #', result.index );
                }
            }
            else if (supposedLine.index === currentLineIndex + 1) { // maybe, we should stay on the current line?
                // the supposed line is next line
                _log.push( 'looks like a new line... check it!' );

                // first, lets check the average fitting of the fixation to the current line, 
                // but taking into account only lines visited already
                var avgOffset = 0;
                var count = 0;
                for (var li = 0; li < lines.length; ++li) {
                    var line = lines[ li ];
                    if (li === currentLineIndex || !line.fitEq) {
                        continue;
                    }

                    avgOffset += line.fit( fixation.x, fixation.y ) - (currentLineIndex - li) * _geomModel.lineSpacing;
                    count++;
                }

                if (count) {
                    avgOffset /= count;
                    _log.push( 'the average fitting offset is ', avgOffset );
                    if (avgOffset < threshold) {
                        acceptSupposedLine = false;
                        result = currentLine;
                        _log.push( '- stay on line #', result.index );
                    }
                    else {
                        // accept the supposed line
                    }
                }
                else {
                    // only one line was discovered so far - the current line
                    // so, just accept the supposed line
                    _log.push( 'nothing to compare with...' );
                }
            }
            else {
                _log.push( 'just accept it' );
                // what can we do here?
                // just accepting the supposed line
            }

            if (acceptSupposedLine) {
                result = supposedLine;
                _log.push( 'jump to supposed line #', result.index );
            }
        }
        else {
            result = null;
            _log.push( '...invalid' );
        }

        _log.levelDown();
        return result;
    }

    function checkAgainstCurrentLine( currentFixation, offset ) {
        var minDist = Number.MAX_VALUE;
        var dist;
        var currentLine = null;
        var previousLine = null;
        var closestFixation = null;

        var fixation = currentFixation.previous;
        while (fixation) {
            if (fixation.word) {
                var line = fixation.word.line;
                if (!currentLine) {
                    currentLine = line;
                }
                if (line.index != currentLine.index) {
                    if (currentLine.index - line.index === 1) {
                        previousLine = line;
                    }
                    break;
                }
                dist = Math.abs( currentFixation.y + offset - currentLine.center.y );
                if (dist < minDist) {
                    minDist = dist;
                    closestFixation = fixation;
                }
            }

            fixation = fixation.previous;
        }

        var result = closestFixation && (minDist < _thresholdForCurrentLine) ? currentLine : null;

        _log.push( 'dist :', minDist );
        _log.push( 'is following the current line:', result ? 'yes' : 'no' );

        // If recognized as not following but still not too far and recently jumped from the previous line,
        // then check whether it fits this previous line
        if (!result && previousLine && minDist < _geomModel.lineSpacing) {
            var diff = Math.abs( previousLine.fit( currentFixation.x, currentFixation.y ) );
            if (diff < _thresholdForCurrentLine) {
                result = previousLine;
                _log.push( 'back to the prev line' );
            }
            else {
                result = currentLine;
                _log.push( 'still better fit than to the previous line' );
            }
        }

        return result;
    }

    function getClosestLine( fixation, offset ) {
        var result = null;
        var minDist = Number.MAX_VALUE;
        var line, dist;

        _log.push( 'searching the closest line given the offset',  offset );
        _log.levelUp();
        var lines = _geomModel.lines;
        for (var i = 0; i < lines.length; ++i) {
            line = lines[i];
            dist = Math.abs( fixation.y + offset - line.center.y );
            _log.push( '#' + i + '=' + dist );
            if (dist < minDist) {
                minDist = dist;
                result = line;
            }
        }

        _log.levelDown();
        _log.push( 'closest:',  result.index );
        return result;        
    }

    // Publication
    app.LinePredictor = LinePredictor;

})( this.Reading || module.exports );

// Reading model

if (!this.Reading) {
    module.exports.Logger = require('../utils/logger.js').Logger;
    module.exports.Line = require('./line.js').Line;
    module.exports.Geometry = require('./geometry.js').Geometry;
    module.exports.Fixations = require('./fixations.js').Fixations;
    module.exports.Zone = require('./zone.js').Zone;
    module.exports.LinePredictor = require('./linePredictor.js').LinePredictor;
}

(function (app) { 'use strict';

    var Model1 = {

        // Initializes the model
        // Arguments:
        //  _settings
        //      forgettingFactor        (0.2) relative number 0.1..0.5
        //      readingThreshold        (3) number of fixations
        //      nonreadingThreshold     (2) number of fixations
        //      slope                   (0.15) 0.1..0.2
        //      progressiveLeft         (-1) em
        //      progressiveRight        (9) em
        //      readingZoneMarginY      (1) em
        //      neutralZoneMarginY      (2) em
        //      linePredictor:
        //          currentLineDistReduce   - (0.8)     // fraction of the real distance
        //          guessMaxDist            - (3)
        //          currentLineDefDist      - (0.5)     // fraction of the lineSpace
        //          currentLineMaxDist      - (0.7)     // fraction of the lineSpace
        //          newLineSaccadeLength    - (-0.7)    // fraction of the max line width
        //  commons:
        //      fixedText               bool
        init: function (settings, commons) {
            settings = settings || {};
            commons = commons || {};

            _settings = {
                forgettingFactor: settings.forgettingFactor || 0.2,
                readingThreshold: settings.readingThreshold || 3,
                nonreadingThreshold: settings.nonreadingThreshold || 2,
                slope: settings.slope || 0.15,
                progressiveLeft: settings.progressiveLeft || -1,
                progressiveRight: settings.progressiveRight || 9,
                readingZoneMarginY: settings.readingZoneMarginY || 1,
                neutralZoneMarginY: settings.neutralZoneMarginY || 2,
                linePredictor: settings.linePredictor || {}
            };

            app.Line.init();

            _geometry = app.Geometry;
            _geometry.init( commons.fixedText !== undefined ? commons.fixedText : true);

            _fixationDetector = app.Fixations;
            _fixationDetector.init();

            _zone = app.Zone;
            //newLineDetector = app.NewLineDetector;
            _linePredictor = app.LinePredictor;

            _logger = app.Logger.forModule( 'Model1' );
        },

        feedFixation: function (fixation) {
            if (!fixation) {
                lastFixation = null;
                return;
            }

            _log = _logger.start( '--- fix ---' );
            _log.push( fixation.toString() );

            // new line searcfh disabled -->
            //var newLine = classifySaccadeZone( fixation );
            var guessedZone = scoreReading === 0 && fixation.saccade.x < 0 ?
                _zone.nonreading :
                _zone.match( fixation.saccade );

            fixation.saccade.zone = guessedZone;
            updateScores( guessedZone );
            // --> replacement

            var switched = updateMode();

            if (isReadingMode) {
                var switchedToReading = switched.toReading;
                var fix = switched.toReading ? getFirstReadingFixation( fixation ) : fixation;

                _log.push( 'Mapping' );
                while (fix) {
                    if (switched.toReading) {
                        _log.push( '' );
                        _log.push( fix.toString() );
                    }
                    lastMapped = map( fix, switchedToReading );
                    switchedToReading = false;

                    if (fix === fixation) {
                        break;
                    }

                    fix = fix.next;
                }
                _log.levelDown();
            }
            else {
                lastMapped = null;
            }

            lastFixation = fixation;

            _logger.end( _log );
        },

        feed: function (targets, data1, data2) {
            createGeometry(targets);

            var newFixation = _fixationDetector.feed( data1, data2 );
            if (newFixation) {
                this.feedFixation( newFixation );
            }
            else {
                lastFixation = null;
            }

            return lastMapped ? lastMapped.dom : null;
        },

        reset: function (targets) {
            _geometry.reset();
            _fixationDetector.reset();
            _zone.reset();
            //newLineDetector.reset();
            _linePredictor.reset();

            isReadingMode = false;
            scoreReading = 0;
            scoreNonReading = 0;
            
            offset = 0;
            currentLine = null;
            lastMapped = null;
            lastFixation = null;

            if (targets) {
                createGeometry( targets );
            }
        },

        callbacks: function (callbacks) {
            if (!callbacks) {
                return _callbacks;
            }
            else {
                _callbacks.onMapped = callbacks.onMapped;
            }
        },

        currentWord: function () {
            return lastMapped;
        },

        mappedFix: function () {
            return lastFixation;
        }
    };

    // internal
    var _settings;

    var _geometry;
    var _fixationDetector;
    var _zone;
    //var newLineDetector;
    var _linePredictor;

    var isReadingMode;
    var scoreReading;
    var scoreNonReading;

    var offset;
    var currentLine;
    var lastMapped;
    var lastFixation;

    var _logger;
    var _log;

    var _callbacks = {
        onMapped: null
    };

    function createGeometry (targets) {
        var geomModel = _geometry.create( targets );
        if (geomModel) {
            _zone.init({
                progressiveLeft: _settings.progressiveLeft,
                progressiveRight: _settings.progressiveRight,
                readingMarginY: _settings.readingZoneMarginY,
                neutralMarginY: _settings.neutralZoneMarginY,
                slope: _settings.slope
            }, geomModel);
            // newLineDetector.init({
            //     minMarginY: 0.3,
            //     maxMarginY: 1.3,
            //     slope: _settings.slope
            // }, geomModel);
            _linePredictor.init( geomModel, _settings.linePredictor );
        }
    }

    function updateScores (guessedZone) {
        switch (guessedZone) {
            case _zone.reading:
                _log.push( `zone ${guessedZone}: reading` );
                scoreReading++;
                scoreNonReading -= _settings.forgettingFactor;
                break;
            case _zone.neutral:
                _log.push( `zone ${guessedZone}: neutral` );
                //scoreNonReading++;
                break;
            default:
                _log.push( `zone ${guessedZone}: nonreading` );
                scoreNonReading = _settings.nonreadingThreshold;
                scoreReading = 0;
        }

        scoreReading = scoreReading < _settings.readingThreshold ? scoreReading : _settings.readingThreshold;
        scoreReading = scoreReading > 0 ? scoreReading : 0;
        scoreNonReading = scoreNonReading < _settings.nonreadingThreshold ? scoreNonReading : _settings.nonreadingThreshold;
        scoreNonReading = scoreNonReading > 0 ? scoreNonReading : 0;
    }

    function updateMode() {
        var result = {
            toReading: false,
            toNonReading: false
        };

        if (!isReadingMode && scoreReading === _settings.readingThreshold) {
            changeMode(true);
            result.toReading = true;
        }
        else if (isReadingMode && scoreNonReading === _settings.nonreadingThreshold) {
            changeMode(false);
            result.toNonReading = true;
        }

        return result;
    }

    function changeMode(toReading) {
        _log.push( 'change Mode', toReading );
        isReadingMode = toReading;
    }

    function updateOffset( fixation, line ) {
        if (isReadingMode && line) {
            offset = line.center.y - fixation.y;
            _log.push( 'offset', offset );
        }
    }

    function map(fixation, isSwitchedToReading) {

        currentLine = _linePredictor.get( isSwitchedToReading, fixation, currentLine, offset );

        if (isReadingMode && (isSwitchedToReading || fixation.saccade.zone === _zone.reading)) {
            updateOffset( fixation, currentLine );
        }

        var mapped = mapToWord( fixation, currentLine ); // , isSwitchedToReading ?

        if (mapped) {
            var outlierFix = searchOutlier( fixation, mapped.line.index );
            if (outlierFix) {
                _logger.log( 'outlier fixation is backtracked: line #', mapped.line.index );
                mapToWord( outlierFix, mapped.line, true );
            }
        }
        
        return mapped;
    }

    function mapToWord(fixation, line, skipFix) {

        var log = _logger.start( 'MAP' );

        if (!line) {
            //logger.log(logger.Type.error, '    ???');
            return null;
        }

        if (isReadingMode && !skipFix) { // && fixation.saccade.zone === zone.reading ?
            line.addFixation( fixation );
        }
        
        var x = fixation.x;
        var result = null;
        var minDist = Number.MAX_VALUE;

        var words = line.words;
        for (var i = 0; i < words.length; ++i) {
            var word = words[i];
            var rect = word.rect;
                
            var dist = x < rect.left ? (rect.left - x) : (x > rect.right ? x - rect.right : 0);
            if (dist < minDist) {
                result = word;
                minDist = dist;
                if (dist === 0) {
                    break;
                }
            }
        }

        fixation.word = result;

        if (result && _callbacks.onMapped) {
            _callbacks.onMapped( fixation );
        }
        
        log.push('[d=', Math.floor( minDist ), ']', result ? result.line.index + ',' + result.index : '' );
        _logger.end( log );

        return result;
    }

    /*function backtrackFixations( currentFixation, line ) {
        _logger.log( '------ backtrack ------' );    
        var isReadingZone = true;
        var fixation = currentFixation.previous;
        while (fixation && !fixation.saccade.newLine) {
            if (fixation.saccade.zone === _zone.nonreading) {
                fixation.word = mapToWord( fixation, line, true );
                break;
            }
            if (!isReadingZone && fixation.saccade.zone !== _zone.reading) {
                break;
            }
            fixation.word = mapToWord( fixation, line );
            isReadingZone = fixation.saccade.zone === _zone.reading;
            fixation = fixation.previous;
        }
        _logger.log( '------ ///////// ------' );
    }*/

    function getFirstReadingFixation( currentFixation ) {
        var log = _logger.start( '------ backtrack ------' );
        var result = null;
        var isReadingZone = true;
        var fixation = currentFixation.previous;
        while (fixation && !fixation.saccade.newLine) {
            if (fixation.saccade.zone === _zone.nonreading) {
                result = isReadingZone ? fixation : fixation.next;
                log.push( '--, finish' );
                break;
            }
            if (!isReadingZone && fixation.saccade.zone !== _zone.reading) {
                result = fixation.next;
                log.push( '++, finish' );
                break;
            }
            result = fixation;
            isReadingZone = fixation.saccade.zone === _zone.reading;
            fixation = fixation.previous;
            log.push( '--' );
        }

        _logger.end( log );

        return result;
    }

    // outlier is the fixation that is the only fixation on another line
    function searchOutlier( fixation, lineIndex ) {
        var candidate = null;
        var pattern = [true, false, true];
        var matched = 0;
        var index = 0;

        while (index < 3 && fixation) {
            if (!fixation.word) {
                break;
            }

            var isOnCurrentLine = lineIndex === fixation.word.line.index;
            if (isOnCurrentLine === pattern[ index ]) {
                ++matched;
            }
            if (index === 1) {
                candidate = fixation;
            }

            fixation = fixation.previous;
            ++index;
        }
                
        return matched === pattern.length ? candidate : null;
    }
    
    // Publication
    app.Model1 = Model1;

})( this.Reading || module.exports );
// Reading model 2

if (!this.Reading) {
    module.exports.Logger = require('../utils/logger.js').Logger;
    module.exports.Line = require('./line.js').Line;
    module.exports.Geometry = require('./geometry.js').Geometry;
    module.exports.Fixations = require('./fixations.js').Fixations;
    module.exports.Zone = require('./zone.js').Zone;
}

(function (app) { 'use strict';

    var Model2 = {

        // Initializes the model
        // Arguments:
        //      settings
        init: function (settings) {
            settings = settings || {};

            _settings = {
            };

            app.Line.init();

            _geometry = app.Geometry;
            _geometry.init( true );

            _fixationDetector = app.Fixations;
            _fixationDetector.init();

            _logger = app.Logger.forModule( 'Model2' );
        },

        feedFixation: function (fixation) {
            if (!fixation) {
                return;
            }

            _lastFixation = fixation;

            _log = _logger.start( '--- fix ---' );
            _log.push( fixation.toString() );

            _currentLine = lineFromSaccade( fixation.saccade.y ); // line, null, or false

            if (!_currentLine) {
                _currentLine = lineFromAbsolutePosition( fixation );
            }
            else {  // check how far the fixation from the currentlt mapped line
                _currentLine = ensureFixationIsClose( fixation );
            }

            _lastMapped = mapToWord( fixation );

            _logger.end( _log );

            return _lastMapped ? _lastMapped.dom : null;
        },

        feed: function (targets, x, y) {
            var result = null;

            _geomModel = _geometry.create( targets );

            var newFixation = _fixationDetector.feed( x, y );
            if (newFixation) {
                result = this.feedFixation( newFixation );
            }
            else {
                _lastFixation = null;
            }

            return result;
        },

        reset: function (targets) {
            _geometry.reset();
            _fixationDetector.reset();

            _currentLine = null;
            _lastMapped = null;
            _lastFixation = null;
            _geomModel = null;

            if (targets) {
                _geomModel = _geometry.create( targets );
            }
        },

        callbacks: function (callbacks) {
            if (!callbacks) {
                return _callbacks;
            }
            else {
                _callbacks.onMapped = callbacks.onMapped;
            }
        },

        currentWord: function () {
            return _lastMapped;
        },

        mappedFix: function () {
            return lastFixation;
        }
    };

    // internal
    var _settings;

    var _geometry;
    var _fixationDetector;
    var _logger;
    var _log;

    var _geomModel;
    var _currentLine;
    var _lastMapped;
    var _lastFixation;

    var _callbacks = {
        onMapped: null
    };

    function lineFromSaccade (dy) {
        var saccadeThreshold = _geomModel.lineHeight * 1.2;
        var nextLineSaccadeThreshold = _geomModel.lineSpacing * 1.75;
        
        var lineChange = Number.NaN;

        if (Math.abs( dy ) < saccadeThreshold) {
            lineChange = 0;
        }
        else if (dy > 0 && dy < nextLineSaccadeThreshold)  {
            lineChange = 1;
        }
        else if (dy < 0) {
            lineChange = Math.round( dy / _geomModel.lineSpacing);
        }

        _log.push( Number.isNaN( lineChange ) ? 'chaotic jump' : 'line changed by ' + lineChange);

        var result = null;
        if (_currentLine && !Number.isNaN( lineChange )) {
            var newLineIndex = _currentLine.index + lineChange;
            if (newLineIndex >= 0 && newLineIndex < _geomModel.lines.length) {
                result = _geomModel.lines[ newLineIndex ];
                _log.push( 'line #', result.index );
            }
            else {
                _log.push( 'jump outside the line' );
            }
        } 
        else {
            result = false;
            _log.push( 'cannot estimate line from saccade' );
        }


        return result;
    }

    function lineFromAbsolutePosition (fixation) {
        var verticalThreshold = _geomModel.lineSpacing * 0.5;
        var horizontalThreshold = 200;
        var result = _geomModel.lines.find( (line) => {
            let dy = Math.abs( fixation.y - line.center.y );
            let dx = fixation.x < line.left ? line.left - fixation.x : 
                    (fixation.x > line.right ? fixation.x - line.right : 0);
            return dx < horizontalThreshold && dy < verticalThreshold;
        });

        if (result) {
            _log.push( 'line #', result.index );
        }
        else {
            _log.push( 'the fixation is not on any line' );
        }

        return result;
    }

    function ensureFixationIsClose (fixation) {
        var fixOffsetY = fixation.y - _currentLine.center.y;
        _log.push( 'checking the Y offset', fixOffsetY );

        var doesNotFollow = _geomModel.lines.find( line => {
            if (!line.fixations.length) {
                return false;
            }

            var y = line.center.y;
            _log.push( '    ly =', y );
            var avgOffsetY = line.fixations.reduce( (sum, fix) => {
                _log.push( '    :', (fix[1] - y) );
                return sum + (fix[1] - y);
            }, 0) / line.fixations.length;

            _log.push( '    d = ', avgOffsetY );

            if (avgOffsetY === undefined) {
                return false;
            }
            
            return fixOffsetY < avgOffsetY - _geomModel.lineHeight || 
                   fixOffsetY > avgOffsetY + _geomModel.lineHeight
        });

        if (doesNotFollow) {
            _log.push( 'the line is too far, mapping naively' );
            return lineFromAbsolutePosition( fixation );
        }

        return _currentLine;
    }

    function mapToWord (fixation) {
        if (!_currentLine) {
            return null;
        }

        _currentLine.addFixation( fixation );
        fixation.line = _currentLine.index;

        var x = fixation.x;
        var result = null;
        var minDist = Number.MAX_VALUE;

        var words = _currentLine.words;
        for (var i = 0; i < words.length; ++i) {
            var word = words[i];
            var rect = word.rect;
                
            var dist = x < rect.left ? (rect.left - x) : (x > rect.right ? x - rect.right : 0);
            if (dist < minDist) {
                result = word;
                minDist = dist;
                if (dist === 0) {
                    break;
                }
            }
        }

        fixation.word = result;

        if (result && _callbacks.onMapped) {
            _callbacks.onMapped( fixation );
        }
        
        _log.push( '[d=', Math.floor( minDist ), ']', result ? result.line.index + ',' + result.index : '' );

        return result;
    }

    // Publication
    app.Model2 = Model2;

})( this.Reading || module.exports );
// Reading model: mathes reading zone

(function (root) {

    'use strict';

    var NewLineDetector = {

        init: function (settings, geomModel) {
            lineMaxWidth = geomModel.lineWidth;
            minMarginY = (settings.minMarginY || 0.3) * geomModel.lineSpacing;
            maxMarginY = (settings.maxMarginY || 1.3) * geomModel.lineSpacing;
            slope = settings.slope || 0.1;

            zones = root.GazeTargets.Models.Reading.Zone;
            logger = root.GazeTargets.Logger;
        },

        search: function (currentFixation) {

            if (!isInZone(currentFixation.saccade)) {
                return null;
            }

            logger.log('new line? compare against the current line');
            var result = compareAgainstCurrentLine( currentFixation );
            logger.log('    line: ', result ? result.index : '-');

            return result;
        },

        reset: function () {
        }
    };

    // internal
    var lineMaxWidth;
    var minMarginY;
    var maxMarginY;
    var slope;

    var zones;
    var logger;

    function isInZone(saccade) {
        var heightDelta = -saccade.x * slope;
        var left = -lineMaxWidth;
        var top = minMarginY - heightDelta;
        var bottom = maxMarginY + heightDelta;
        return left < saccade.x && saccade.x < 0 && 
               top < saccade.y && saccade.y < bottom;
    }

    // function isInZone(saccade) {
    //     var left = -lineMaxWidth;
    //     var top = minMarginY;
    //     var bottom = maxMarginY;
    //     return left < saccade.x && saccade.x < -20 && 
    //            top < saccade.y && saccade.y < bottom;
    // }

    function compareAgainstCurrentLine(currentFixation) {
        
        var firstLineFixation = getFirstFixationOnItsLine( currentFixation );

        if (!firstLineFixation) {
            logger.log('    cannot do it');
            return null;
        }

        var verticalJump = currentFixation.y - firstLineFixation.y;
        if ( minMarginY < verticalJump) {
            logger.log('    is below the current', verticalJump);
            return firstLineFixation.word.line.next;
        }

        return null;
    }

    function getFirstFixationOnItsLine(currentFixation) {

        var previousFixation = currentFixation.previous;
        if (!previousFixation || !previousFixation.word) {  // previous fixation should be mapped onto a word
            return null;
        }

        var currentLine = previousFixation.word.line;
        var fixation = previousFixation;
        var result = previousFixation;

        while (fixation) {
            if (fixation.word) {                // the fixation was mapped onto a word, lets test its line
                if (fixation.word.line === currentLine) {   // same line, continue moving backward
                    result = fixation;
                    if (result.x < currentFixation.x) {     // no need to search further for more  
                        break;
                    }
                }
                else if (fixation.word.line) {  // the fixation mapped onto another line, break
                    break;
                }
            }
            else if (fixation.saccade.zone === zones.nonreading) {   // 
                break;
            }

            fixation = fixation.previous;
        }

        return result;
    }
        
    // Publication
    if (!root.GazeTargets) {
        root.GazeTargets = {};
    }

    if (!root.GazeTargets.Models) {
        root.GazeTargets.Models = {};
    }

    if (!root.GazeTargets.Models.Reading) {
        root.GazeTargets.Models.Reading = {};
    }

    root.GazeTargets.Models.Reading.NewLineDetector = NewLineDetector;

})(window);
// Requires:
//      utils/logger

if (!this.Reading) {
    module.exports.Logger = require('../utils/logger.js').Logger;
}

(function (app) { 'use strict';

    var Zone = {

        // types
        nonreading: 0,
        neutral: 1,
        reading: 2,

        init: function (settings, geomModel) {
            _lineHeight = geomModel.lineHeight;
            _progressiveLeft = Math.round(( settings.progressiveLeft || -1.5) * _lineHeight );
            _progressiveRight = Math.round( (settings.progressiveRight || 10) * _lineHeight );
            _regressiveLeft = -geomModel.lineWidth - 500;
            _regressiveRight = 0;
            _readingMarginY = Math.round( (settings.readingMarginY || 1.5) * _lineHeight );
            _neutralMarginY = Math.round( (settings.neutralMarginY || 3) * _lineHeight );
            _slope = settings.slope || 0.1;

            _logger = app.Logger.forModule( 'Zone' );
        },

        match: function (saccade) {
            _log = _logger.start();
            _log.push( 'saccade:', saccade.x, saccade.y );
            var zone = this.nonreading;

            if (isInsideBox( _readingMarginY, saccade)) {
                zone = this.reading;
            }
            else if (isInsideBox( _neutralMarginY, saccade )) {
                zone = this.neutral;
            }

            _log.push( 'result: ', zone );
            _logger.end( _log );

            return zone;
        },

        reset: function () {
        }
    };

    // internal
    var _lineHeight;
    var _progressiveLeft;
    var _progressiveRight;
    var _regressiveLeft;
    var _regressiveRight;
    var _readingMarginY;
    var _neutralMarginY;
    var _slope;

    var _logger;
    var _log;

    function isInsideProgressive (marginY, saccade) {
        var heightDelta = saccade.x * _slope;
        var margin = Math.round( marginY + heightDelta );
        _log.push( 'Progressive: [', _progressiveLeft, _progressiveRight, -margin, margin, ']' );
        return _progressiveLeft < saccade.x && saccade.x < _progressiveRight && 
               -margin < saccade.y && saccade.y < margin;
    }

    function isInsideRegressive (marginY, saccade) {
        var heightDelta = -saccade.x * _slope;
        var margin = Math.round( marginY + heightDelta );
        _log.push( 'Regressive: [', _regressiveLeft, _regressiveRight, -margin, margin, ']' );
        return _regressiveLeft < saccade.x && saccade.x < 0 && 
               -margin < saccade.y && saccade.y < margin;
    }

    function isInsideBox (marginY, saccade) {
        return isInsideProgressive( marginY, saccade ) || isInsideRegressive( marginY, saccade );
    }
    
    // Publication
    app.Zone = Zone;

})( this.Reading || module.exports );
// Requires:
//      utils/logger

(function (app) { 'use strict';

    // Controller for the text options side-slider
    // Constructor arguments:
    //      options: {
    //          root:   - slideout element ID
    //          text:   - full text selector
    //      }
    //      services: {             - get/set services
    //          showPointer (bool)
    //          highlightWord (bool)
    //          syllabify (bool)
    //          voice (bool)
    //          hideText (bool)
    //          path {
    //              colorMetric (index)
    //              mapping (index)
    //              showIDs (bool)
    //              showConnections (bool)
    //              showSaccades (bool)
    //              showFixations (bool)
    //              showOriginalFixLocation (bool)
    //          }
    //          wordGazing {
    //              colorMetric (index)
    //              showFixations (bool)
    //              uniteSpacings (bool)
    //              showRegressions (bool)
    //          }
    //      }
    function Options(options, services, utils) {

        this.root = options.root || '#options';

        this._slideout = document.querySelector( this.root );

        var logError = app.Logger.moduleErrorPrinter( 'Options' );

        _services = services;

        _services.showPointer = _services.showPointer || logError( 'showPointer' );
        _services.highlightWord = _services.highlightWord || logError( 'highlightWord' );
        _services.syllabify = _services.syllabify || logError( 'syllabify' );
        _services.voice = _services.voice || logError( 'voice' );
        _services.hideText = _services.hideText || logError( 'hideText' );

        _services.path = _services.path || {};
        _services.path.colorMetric = _services.path.colorMetric || logError( 'path.colorMetric"' );
        _services.path.mapping = _services.path.mapping || logError( 'path.mapping"' );
        _services.path.showConnections = _services.path.showConnections || logError( 'path.showConnections' );
        _services.path.showSaccades = _services.path.showSaccades || logError( 'path.showSaccades' );
        _services.path.showFixations = _services.path.showFixations || logError( 'path.showFixations' );
        _services.path.showOriginalFixLocation = _services.path.showOriginalFixLocation || logError( 'path.showOriginalFixLocation' );

        _services.wordGazing = _services.wordGazing || {};
        _services.wordGazing.colorMetric = _services.wordGazing.colorMetric || logError( 'wordGazing.colorMetric' );
        _services.wordGazing.showFixations = _services.wordGazing.showFixations || logError( 'wordGazing.showFixations' );
        _services.wordGazing.uniteSpacings = _services.wordGazing.uniteSpacings || logError( 'wordGazing.uniteSpacings' );
        _services.wordGazing.showRegressions = _services.wordGazing.showRegressions || logError( 'wordGazing.showRegressions' );

        _utils = utils;

        var cssRules = [
            /*{
                name:        rule CSS name
                type:        the type of control to represent the rule
                selector:    rule selector
                id:          control ID
                prefix:      the rule value prefix not to be shown in the control
                suffix:      the rule value suffix not to be shown in the control
                value:     [auto-filled] rule value
                initial:   [auto-filled] initial rule value
                editor:    [auto-filled] rule control
            }*/
            { name: 'color', type: 'color', selector: options.text, id: 'text', prefix: '#', suffix: '' },
            { name: 'color', type: 'color', selector: options.text + ' .currentWord', id: 'currentWord', prefix: '#', suffix: '' },
            { name: 'font-size', type: 'string', selector: options.text, id: 'fontSize', prefix: '', suffix: '' },
            //{ name: 'line-height', type: 'string', selector: options.text, id: 'lineHeight', prefix: '', suffix: '' },
        ];

        this._style = document.createElement( 'style' );
        document.body.appendChild( this._style );

        var editText = document.querySelector( this.root + ' .editText' );
        editText.addEventListener( 'click', () => {
            _utils.editText();
        });

        var apply = document.querySelector( this.root + ' .save' );
        apply.addEventListener( 'click', () => {
            getRulesFromEditors( this._style, cssRules );
            this._slideout.classList.remove( 'expanded' );

            saveSettings( cssRules );
        });

        var close = document.querySelector( this.root + ' .close' );
        close.addEventListener( 'click', () => {
            this._slideout.classList.remove( 'expanded' );
        });

        var slideoutTitle = document.querySelector( this.root + ' .title');
        slideoutTitle.addEventListener( 'click', () => {
            this._slideout.classList.toggle( 'expanded' );
            setRulesToEditors( cssRules );
        });

        window.addEventListener( 'load', () => {
            loadSettings( cssRules );
            this._style.innerHTML = cssRules.reduce( function (css, rule) {
                return css + rule.selector + ' { ' + rule.name + ': ' + rule.initial + rule.suffix + ' !important; } ';
            }, '');

            obtainInitialRules( cssRules );

            bindSettingsToEditors( this.root );
            bindRulesToEditors( cssRules, this.root + ' #' );
        });
    }

    // Disables editing
    Options.prototype.lock = function () {
        this._slideout.classList.add( 'locked' );
    };

    // Enables editing
    Options.prototype.unlock = function () {
        this._slideout.classList.remove( 'locked' );
    };

    // private

    var _services;
    var _utils;

    function loadSettings(cssRules) {
        var options = JSON.parse( localStorage.getItem('options') );
        if (!options) {
            return;
        }

        var services = _services;

        var pop = function (storage, srv) {
            for (var name in storage) {
                if (name === 'css') {
                    continue;
                }
                else if (Array.isArray( storage[ name ] )) {
                    srv[ name ]( storage[ name ] );
                }
                else if (typeof storage[ name ] === 'object') {
                    pop( storage[ name ], srv[ name ] );
                }
                else if (srv[ name ]) {
                    srv[ name ]( storage[ name ] );
                }
            }
        };

        pop( options, services );

        // for (var name in options) {
        //     if (_services[ name ]) {
        //         _services[ name ]( options[name] );
        //     }
        // }

        if (options.css) {
            var ruleInitilization = (rule) => {
                if (rule.selector === parts[0] && rule.name === parts[1]) {
                    rule.initial = options.css[ savedRule ];
                }
            };
            for (var savedRule in options.css) {
                var parts = savedRule.split( '____' );
                cssRules.forEach( ruleInitilization );
            }
        }
    }

    function saveSettings(cssRules) {
        var options = {};
        var services = _services;

        var push = function (storage, srv) {
            for (var name in srv) {
                if (typeof srv[ name ] === 'function') {
                    storage[ name ] = srv[ name ]();
                }
                else if (typeof srv[ name ] === 'object') {
                    storage[ name ] = { };
                    push( storage[ name ], srv[ name ] );
                }
            }
        };

        push( options, services );

        options.css = {};
        cssRules.forEach( function (rule) {
            options.css[ rule.selector + '____' + rule.name ] = rule.value;
        });

        localStorage.setItem( 'options', JSON.stringify( options) );
    }

    function componentToHex( c ) {
        var hex = c.toString(16);
        return hex.length == 1 ? "0" + hex : hex;
    }

    function rgbToHex( r, g, b ) {
        return '#' + componentToHex( r ) + componentToHex( g ) + componentToHex( b );
    }

    function cssColorToHex( cssColor ) {

        var colorRegex = /^\D+(\d+)\D+(\d+)\D+(\d+)\D+$/gim;
        var colorComps = colorRegex.exec( cssColor );

        return rgbToHex(
            parseInt( colorComps[ 1 ] ),
            parseInt( colorComps[ 2 ] ),
            parseInt( colorComps[ 3 ] ) );
    }

    function cssToJS( cssName ) {

        var dashIndex = cssName.indexOf( '-' );
        while (dashIndex >= 0) {
            var char = cssName.charAt( dashIndex + 1);
            cssName = cssName.replace( '-' + char,  char.toUpperCase() );
            dashIndex = cssName.indexOf( '-' );
        }
        return cssName;
    }

    function obtainInitialRules( rules ) {

        for (var s = 0; s < document.styleSheets.length; s++) {
            var sheet = document.styleSheets[ s ];
            for (var r = 0; r < sheet.cssRules.length; r++) {
                var rule = sheet.cssRules[ r ];
                for (var c = 0; c < rules.length; c++) {
                    var customRule = rules[ c ];
                    if (rule.selectorText === customRule.selector) {
                        if (customRule.initial === undefined) {
                            if (customRule.type === 'color') {
                                customRule.initial = cssColorToHex( rule.style.color );
                            }
                            else if (customRule.type === 'string') {
                                customRule.initial = rule.style[ cssToJS( customRule.name ) ];
                            }
                        }
                        customRule.value = customRule.initial;
                    }
                }
            }
        }
    }

    function bindRulesToEditors( rules, idBase ) {

        for (var i = 0; i < rules.length; i++) {
            var rule = rules[ i ];
            rule.editor = document.querySelector( idBase + rule.id );

            if (rule.type === 'color') {
                rule.editor.value = rule.initial;  //color.fromString( rule.initial );
            }
            else if (rule.type === 'string') {
                rule.editor.value = rule.initial;
            }
        }
    }

    function getRulesFromEditors( style, rules ) {

        var styleText = '';
        for (var i = 0; i < rules.length; i++) {
            var rule = rules[ i ];
            if (rule.type === 'color') {
                rule.value = rule.editor.value; //'#' + rule.editor.color;
            }
            else if (rule.type === 'string') {
                rule.value = rule.editor.value;
            }
            styleText += rule.selector + ' { ' + rule.name + ': ' + rule.value + rule.suffix + ' !important; } ';
        }
        style.innerHTML = styleText;
    }

    function setRulesToEditors( rules ) {

        for (var i = 0; i < rules.length; i++) {
            var rule = rules[ i ];
            if (rule.type === 'color') {
                rule.editor.value = rule.value;//color.fromString( rules.value );
            }
            else if (rule.type === 'string') {
                rule.editor.value = rule.value;
            }
        }
    }

    function bindSettingsToEditors(root) {
        var bindCheckbox = (id, service) => {
            var flag = document.querySelector( root + ' #' + id );
            flag.checked = service();
            flag.addEventListener( 'click', function () {
                service( this.checked );
            });
        };

        var bindSelect = (id, service) => {
            var select = document.querySelector( root + ' #' + id );
            select.selectedIndex = service();
            select.addEventListener( 'change', function () {
                service( this.selectedIndex );
            });
        };

        bindCheckbox( 'showPointer', _services.showPointer );
        bindCheckbox( 'highlightWord', _services.highlightWord );
        bindCheckbox( 'syllabify', _services.syllabify );
        bindCheckbox( 'voice', _services.voice );
        bindCheckbox( 'hiddenText', _services.hideText );

        bindSelect( 'path_mapping', _services.path.mapping );

        bindSelect( 'path_colorMetric', _services.path.colorMetric );
        bindCheckbox( 'path_showIDs', _services.path.showIDs );
        bindCheckbox( 'path_showConnections', _services.path.showConnections );
        bindCheckbox( 'path_showSaccades', _services.path.showSaccades );
        bindCheckbox( 'path_showFixations', _services.path.showFixations );
        bindCheckbox( 'path_showOriginalFixLocation', _services.path.showOriginalFixLocation );

        bindSelect( 'wordGazing_colorMetric', _services.wordGazing.colorMetric );
        bindCheckbox( 'wordGazing_showFixations', _services.wordGazing.showFixations );
        bindCheckbox( 'wordGazing_uniteSpacings', _services.wordGazing.uniteSpacings );
        bindCheckbox( 'wordGazing_showRegressions', _services.wordGazing.showRegressions );
    }

    app.Options = Options;

})( this.Reading || module.this.exports );

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
                this._drawConnection( ctx, fix, {x: fix.word.left, y: fix.word.top} );
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
        var model = app.Model2;

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

        var layout = session.words.map( function (word) {
            return new Word({ left: word.x, top: word.y, right: word.x + word.width, bottom: word.y + word.height });
        });

        fixations.reset();
        model.reset( layout );
        //model.callbacks( { onMapped: function (fixation) {} } );

        var result = [];
        session.fixations.forEach( function (fix) {
            var fixation = fixations.add( fix.x, fix.y, fix.duration );
            if (fixation) {
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

    function Word (rect) {
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

// Requires:
//      app,Colors
//      app.firebase
//      utils.metric
//      utils.remapExporter

(function (app) { 'use strict';

    // Real-time visualization constructor
    // Arguments:
    //      options: {
    //          focusColor           - focus color
    //          wordReadingColor     - color of a word read normally
    //          wordLongReadingColor - color of a word read long
    //      }
    function RTV (options) {

        this.focusColor = options.focusColor || '#F80';

        this.longFixationThreshold = 1000;

        this.wordWidth = 100;
        this.wordHeight = 20;
        this.wordPaddingX = 4;
        this.wordPaddingY = 4;

        this.fontFamily = 'Calibri, Arial, sans-serif';
        this.captionFontSize = 16;
        this.captionFont = `${this.captionFontSize}px ${this.fontFamily}`;

        options.wordColor = options.wordColor || '#222';
        options.wordFont = options.wordFont || `${this.wordHeight - this.wordPaddingY}px ${this.fontFamily}`;

        app.Visualization.call( this, options );
    }

    app.loaded( () => { // we have to defer the prototype definition until the Visualization mudule is loaded

    RTV.prototype = Object.create( app.Visualization.prototype );
    RTV.prototype.base = app.Visualization.prototype;
    RTV.prototype.constructor = RTV;

    RTV.prototype._stopAll = function () {
        if (this._tracks) {
            this._tracks.forEach( track => track.stop() );
        }
    }

    RTV.prototype._fillDataQueryList = function (list) {

        var conditions = this._getConditions( true );
        var result = new Map();

        for (var key of conditions.keys()) {
            result.set( `Text #${+key + 1}`, conditions.get( key ) );
        }

        return result;
    };

    RTV.prototype._load = function (names) {
        if (!this._snapshot) {
            return;
        }

        if (!this._tracks) {    // first time, since we do not nullify this._tracks
            let onHidden = this._callbacks().hidden;
            this._callbacks().hidden = () => {
                this._stopAll();
                if (onHidden) {
                    onHidden();
                }
            }
        }

        var tracks = [];
        names.forEach( (name, index) => {
            var session = this._snapshot.child( name );
            if (session && session.exists()) {
                var sessionVal = session.val();
                if (sessionVal && sessionVal.fixations) {
                    tracks.push( new Track( app.Visualization.root, name, sessionVal ) );
                }
            }
        });

        if (!tracks.length) {
            return;
        }

        var ctx = this._getCanvas2D();

        var words = tracks[0].words;
        this._computeFontSize( words );
        this._drawWords( ctx, tracks[0].words );
        this._drawTracks( ctx, tracks );

        this._run( ctx, tracks );
        this._tracks = tracks;
    };

    RTV.prototype._computeFontSize = function (words) {
        var height = document.querySelector( '#visualization' ).offsetHeight;
        var trackHeight = height - 2 * (this.captionFontSize + 2 * this.wordPaddingY);
        this.wordHeight = Math.min( 24, Math.max( 8, Math.floor( trackHeight / words.length ) ) );
        this.wordFont = `${this.wordHeight - this.wordPaddingY}px ${this.fontFamily}`;
    };

    RTV.prototype._drawWords = function (ctx, words) {
        ctx.textAlign = 'end';
        ctx.textBaseline = 'top';
        ctx.fillStyle = this.wordColor;
        ctx.font = this.wordFont;

        var width = words.reduce( (max, word) => {
            return Math.max( max, ctx.measureText( word.text ).width );
        }, 0 );
        this.wordWidth = width + 2 * this.wordPaddingX;

        words.forEach( (word, index) => {
            ctx.fillText(
                word.text,
                width + this.wordPaddingX,
                this.captionFontSize + 2 * this.wordPaddingY + this.wordHeight * index + this.wordPaddingY
            );
        });
    };

    RTV.prototype._drawTracks = function (ctx, tracks) {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = this.wordColor;
        ctx.font = this.captionFont;
        ctx.strokeStyle = '#000';

        var trackOffsetX = 0;
        tracks.forEach( track => {
            track.setRect(
                this.wordWidth + trackOffsetX,
                this.captionFontSize + 2 * this.wordPaddingY,
                ctx.measureText( track.name ).width + 2 * this.wordPaddingX,
                this.wordHeight
            );

            ctx.fillText(
                track.name,
                track.x + track.width * 0.5,
                track.y - this.wordPaddingY
            );
            track.words.forEach( (word, wi) => {
                ctx.strokeRect(
                    track.x,
                    track.y + this.wordHeight * wi,
                    track.width,
                    this.wordHeight
                );
            });

            trackOffsetX += track.width;
        });
    };

    RTV.prototype._run = function (ctx, tracks) {
        tracks.forEach( (track, ti) => {
            track.start(
                (word, duration, pointer) => {
                    let rawWord = track.words[ word.id ];
                    rawWord.totalDuration = rawWord.totalDuration + duration;

                    let tone = 255 - 24 * Math.min( 10, 1 + Math.floor( rawWord.totalDuration / this.longFixationThreshold ) );
                    ctx.fillStyle = `rgb(${tone},${tone},${tone})`;  //'rgba(0,0,0,0.40)';

                    let y = track.y + word.id * track.height;
                    ctx.fillRect( track.x, y, track.width - 1, track.height );
                    pointer.style = `left: ${track.x + Math.round((track.width - pointer.offsetWidth) / 2)}px;
                                     top: ${y + Math.round((track.height - pointer.offsetHeight) / 2)}px`;
                },
                () => {
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'top';
                    ctx.fillStyle = this.wordColor;
                    ctx.fillText(
                        'done',
                        track.x + track.width * 0.5,
                        track.y + this.wordHeight * track.words.length + this.wordPaddingY
                    );
                }
            );
        })
    };

    }); // end of delayed call

    function Track (root, name, session) {
        this.root = root;
        this.name = name;

        this.x = 0;
        this.y = 0;
        this.width = 0;
        this.heigth = 0;
        this.pointerSize = 8;
        this.fixationTimer = null;
        this.nextTimer = null;

        session.words.forEach( word => {
            word.totalDuration = 0;
        })

        app.StaticFit.map( session );

        this.fixations = session.fixations;
        this.words = session.words;

        this.delay = Math.round( 3000 * Math.random() );
        this.fixationIndex = -1;

        this.__next = this._next.bind( this );
    }

    Track.prototype.setRect = function (x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
    }

    Track.prototype.start = function (onWordFixated, onCompleted) {
        this.onWordFixated = onWordFixated;
        this.onCompleted = onCompleted;

        this.fixationIndex = 0;

        this.pointer = document.createElement( 'div' );
        this.pointer.classList.add( 'track_pointer' );
        this.pointer.classList.add( 'invisible' );
        this.root.appendChild( this.pointer );

        this.nextTimer = setTimeout( this.__next, this.delay);
    }

    Track.prototype.stop = function () {
        if (this.nextTimer) {
            clearTimeout( this.nextTimer );
            this.nextTimer = null;
        }

        if (this.fixationTimer) {
            clearTimeout( this.fixationTimer );
            this.fixationTimer = null;
        }

        if (this.pointer) {
            this.root.removeChild( this.pointer );
            this.pointer = null;
        }
    }

    Track.prototype._next = function () {
        let fixation = this.fixations[ this.fixationIndex ];

        this._moveFixation( fixation.word, fixation.duration );

        this.fixationIndex++;
        if (this.fixationIndex < this.fixations.length) {
            let pause = this.fixations[ this.fixationIndex ].ts - fixation.ts;
            this.nextTimer = setTimeout( this.__next, pause );
        }
        else {
            this.onCompleted();
            this.root.removeChild( this.pointer );
            this.pointer = null;
            this.nextTimer = null;
        }
    }

    Track.prototype._moveFixation = function (word, duration) {
        if (this.fixationTimer) {
            clearTimeout( this.fixationTimer );
            this.fixationTimer = null;
        }

        if (word) {
            this.onWordFixated( word, duration, this.pointer );

            let y = this.y + word.id * this.height;
            this.pointer.style = `left: ${this.x + (this.width - this.pointerSize) / 2}px;
                                  top: ${y + (this.height - this.pointerSize) / 2}px`;
            this.pointer.classList.remove( 'invisible' );

            this.fixationTimer = setTimeout( () => {
                this.fixationTimer = null;
                this.pointer.classList.add( 'invisible' );
            }, duration);
        }
        else {
            this.pointer.classList.add( 'invisible' );
        }
    }

    app.RTV = RTV;

})( this.Reading || module.exports );

// Requires:
//      regression.js
//      utils/logger

if (!this.Reading) {
    var regression = require('../../libs/regression.js');
    var logger = require('./utils/logger.js').Logger;
}

(function(app) {

    let MARGIN_X = 100;
    let MARGIN_Y = 180;
    let FIT_THESHOLD = 25;
    let SKIMMING_THRESHOLD_X = 500;
    let SKIMMING_THRESHOLD_Y = 40;
    let SCALE_DIFF_THRESHOLD = 0.9;
    let MAX_LINEAR_GRADIENT = 0.15;
    let LONG_SET_LENGTH_THRESHOLD = 3;
    let EMPTY_LINE_DETECTION_FACTOR = 1.7; // factor of the line height

    let MIN_DURATION_REMOVING = 150; // ms, set to 0 to disable
    let MIN_DURATION_MERGING = 240; // ms, set to 0 to disable
    let MIN_INTERFIX_DIST = 40; // px
    let DROP_SHORT_SETS = true;

    let CORRECT_FOR_EMPTY_LINES = true;

    const SET_TYPE = {
        LONG: 'long',
        SHORT: 'short',
        ANY: 'any'
    };

    let log;

    function settings (value) {
        if (!value) {
            return {
                marginX: MARGIN_X,
                marginY: MARGIN_Y,
                fitThreshold: FIT_THESHOLD,
                skimmigThresholdX: SKIMMING_THRESHOLD_X,
                skimmigThresholdY: SKIMMING_THRESHOLD_Y,
                scaleDiffThreshold: SCALE_DIFF_THRESHOLD,
                maxLinearGradient: MAX_LINEAR_GRADIENT,
                longSetLengthThreshold: LONG_SET_LENGTH_THRESHOLD,
                emptyLineDetectionFactor: EMPTY_LINE_DETECTION_FACTOR,
                minDurationRemoving: MIN_DURATION_REMOVING,
                minDurationMerging: MIN_DURATION_MERGING,
                minInterfixDist: MIN_INTERFIX_DIST,
                correctForEmptyLines: CORRECT_FOR_EMPTY_LINES,
                dropShortSets: DROP_SHORT_SETS,
                logging: (logger || app.Logger).enabled
            };
        }
        else {
            MARGIN_X = value.marginX !== undefined ? value.marginX : MARGIN_X;
            MARGIN_Y = value.marginY !== undefined ? value.marginY : MARGIN_Y;
            FIT_THESHOLD = value.fitThreshold !== undefined ? value.fitThreshold : FIT_THESHOLD;
            SKIMMING_THRESHOLD_X = value.skimmigThresholdX !== undefined ? value.skimmigThresholdX : SKIMMING_THRESHOLD_X;
            SKIMMING_THRESHOLD_Y = value.skimmigThresholdY !== undefined ? value.skimmigThresholdY : SKIMMING_THRESHOLD_Y;
            SCALE_DIFF_THRESHOLD = value.scaleDiffThreshold !== undefined ? value.scaleDiffThreshold : SCALE_DIFF_THRESHOLD;
            MAX_LINEAR_GRADIENT = value.maxLinearGradient !== undefined ? value.maxLinearGradient : MAX_LINEAR_GRADIENT;
            LONG_SET_LENGTH_THRESHOLD = value.longSetLengthThreshold !== undefined ? value.longSetLengthThreshold : LONG_SET_LENGTH_THRESHOLD;
            EMPTY_LINE_DETECTION_FACTOR = value.emptyLineDetectionFactor !== undefined ? value.emptyLineDetectionFactor : EMPTY_LINE_DETECTION_FACTOR;
            MIN_DURATION_REMOVING = value.minDurationRemoving !== undefined ? value.minDurationRemoving : MIN_DURATION_REMOVING;
            MIN_DURATION_MERGING = value.minDurationMerging !== undefined ? value.minDurationMerging : MIN_DURATION_MERGING;
            MIN_INTERFIX_DIST = value.minInterfixDist !== undefined ? value.minInterfixDist : MIN_INTERFIX_DIST;
            CORRECT_FOR_EMPTY_LINES = value.correctForEmptyLines !== undefined ? value.correctForEmptyLines : CORRECT_FOR_EMPTY_LINES;
            DROP_SHORT_SETS = value.dropShortSets !== undefined ? value.dropShortSets : DROP_SHORT_SETS,
            (logger || app.Logger).enabled = value.logging !== undefined ? value.logging : (logger || app.Logger).enabled;
        }
    }

    function map (data) {
        if (!data.fixations || !data.words) {
            return;
        }

        //log = (logger || app.Logger).forModule( 'StaticFit' ).log;
        log = (logger || app.Logger).moduleLogPrinter( 'StaticFit' );

        var text = getText( data.words );
        //var fixations = filterFixations( data.fixations, text.box );
        //var progressions = splitToProgressions( fixations );
        if (MIN_DURATION_MERGING || MIN_DURATION_MERGING) {
            data.fixations = filterFixations( data.fixations, text.box );
        }
        var progressions = splitToProgressions( data.fixations );
        var sets = mergeSets( progressions, text.lines.length );
        sets = dropShortSets( sets, 1 );
        sortAndAlignLines( sets, text.lines );

        if (data.maxLineID) {
            sets = ensureCorrectMaxAssignedLineID( sets, text.lines, data.maxLineID );
        }

        //assignFixationsToLines( sets );
        //log( 'Fixations distributed across lines', data.fixations );

        mapToWords( sets, text.lines );
        computeRegressions( data.fixations );
        removeTransitionsToNextLine( data.fixations, data.words );
    }

    function getText (words) {
        var lines = [];
        var box = {left: Number.MAX_VALUE, top: Number.MAX_VALUE, right: 0, bottom: 0};
        var currentY = Number.MIN_VALUE;
        var currentLine;

        var createNewLine = function (word) {
            currentLine = [ word ];
            currentLine.id = word.row ? word.row - 1 : lines.length;
            lines.push( currentLine );
        };

        for (var i = 0; i < words.length; i += 1) {
            var word = words[i];
            word.id = i;
            if (word.x < box.left) { box.left = word.x;    }
            if (word.y < box.top) { box.top = word.y;    }
            if (word.x + word.width > box.right) { box.right = word.x + word.width;    }
            if (word.y + word.height > box.bottom) { box.bottom = word.y + word.height;    }

            if (word.y != currentY) {
                currentY = word.y;
                createNewLine( word );
            }
            else {
                currentLine.push( word );
            }
        }

        log( 'lines: ' + lines.length );

        return {
            box: box,
            lines: lines
        };
    }

    function filterFixations (fixations, textbox) {
        return joinShortFixatoins( removeFarFixations( fixations, textbox ) );
    }

    function removeFarFixations (fixations, textbox) {
        var result = [];

        for (var i = 0; i < fixations.length; i += 1) {
            var fix = fixations[i];
            fix.id = i;
            if (fix.x > textbox.left - MARGIN_X &&
                fix.x < textbox.right + MARGIN_X &&
                fix.y > textbox.top - MARGIN_Y &&
                fix.y < textbox.bottom + MARGIN_Y) {
                result.push( fix );
            }
        }

        return result;
    }

    function joinShortFixatoins (fixations) {
        const dist = (a, b) => Math.sqrt( Math.pow( a.x - b.x, 2 ) + Math.pow( a.y - b.y, 2 ) );
        const join = (a, b) => {
            let totalDuration = a.duration + b.duration;
            a.x = (a.x * a.duration + b.x * b.duration) / totalDuration;
            a.y = (a.y * a.duration + b.y * b.duration) / totalDuration;
            a.duration = totalDuration;
            a.merged = true;
        };
        const joinInteration = (fixes) => {
            const result = [];
            let prevFix, prevPrevFix;
            for (let i = 0; i < fixes.length; i += 1) {
                let fix = fixes[i];
                if (prevPrevFix && prevFix.duration < MIN_DURATION_MERGING ) {
                    let distToPrev = dist( prevFix, prevPrevFix );
                    let distToNext = dist( prevFix, fix );
                    if (distToPrev < MIN_INTERFIX_DIST || distToNext < MIN_INTERFIX_DIST) {
                        if (distToNext < distToPrev) {
                            join( fix, prevFix );
                        }
                        else {
                            join( prevPrevFix, prevFix );
                        }
                        result.pop();
                        prevFix = prevPrevFix;
                    }
                    else if (prevFix.duration < MIN_DURATION_REMOVING) {
                        result.pop();
                        prevFix = prevPrevFix;
                    }
                }

                result.push( fix );

                prevPrevFix = prevFix;
                prevFix = fix;
            }
            return result;
        };

        let fixationCount;
        let result = fixations;

        do {
            fixationCount = result.length;
            result = joinInteration( result );
        } while (result.length !== fixationCount);

        return result;
    }

    function splitToProgressions (fixations) {
        var result = [];
        var currentLine;

        var createNewSet = function (fixation) {
            currentLine = [ fixation ];
            result.push( currentLine );
            return fixation;
        };

        var inReadingBox = function (dx, dy) {
             return  dx > 0 && dx < SKIMMING_THRESHOLD_X &&
                     Math.abs( dy ) < SKIMMING_THRESHOLD_Y;
         };

        var lastFix = createNewSet( fixations[0] );

        for (var i = 1; i < fixations.length; i += 1) {
            var fix = fixations[i];
            if (!inReadingBox( fix.x - lastFix.x, fix.y - lastFix.y )) {
                lastFix = createNewSet( fix );
            }
            else {
                currentLine.push( fix );
                lastFix = fix;
            }
        }

        log( 'sets of progressive fixations:', result );
        return result;
    }

    function dropShortSets (fixationSets, maxRejectionLength ) {
        if (!DROP_SHORT_SETS) {
            return fixationSets;
        }

        var result = [];

        for (var i = 0; i < fixationSets.length; i += 1) {
            var fixationSet = fixationSets[i];
            if (fixationSet.length > maxRejectionLength) {
                result.push( fixationSet );
            }
        }

        return result;
    }

    function sortAndAlignLines (fixationLines, textLines) {
        fixationLines.sort( (a, b) => {
            return avgY( a ) - avgY( b );
        });

        let interlineDist = 9;
        if (textLines.length > 1) {
            let interlineDists = [];
            for (let i = 1; i < textLines.length; i += 1) {
                interlineDists.push( textLines[i][0].y - textLines[i - 1][0].y );
            }
            interlineDist = median( interlineDists );
            /*/
            for (let i = 1; i < textLines.length; i += 1) {
                interlineDist += textLines[i][0].y - textLines[i - 1][0].y;
            }
            interlineDist = interlineDist / (textLines.length - 1);
            */
        }
        else {
            interlineDist = Number.MAX_VALUE;
        }

        let currentLineID = 0;
        let lastLineY = 0;
        for (let i = 0; i < fixationLines.length; i += 1) {
            let fixations = fixationLines[i];
            let currentLineY = 0;
            for (let j = 0; j < fixations.length; j += 1) {
                currentLineY += fixations[j].y;
            }
            currentLineY /= fixations.length;

            if (CORRECT_FOR_EMPTY_LINES && i > 0 && (currentLineY - lastLineY) > EMPTY_LINE_DETECTION_FACTOR * interlineDist) {
                console.log('-- line is ', currentLineID);
                currentLineID += Math.round( (currentLineY - lastLineY) / interlineDist ) - 1;
                console.log('    but corrected to ', currentLineID);
            }

            for (let j = 0; j < fixations.length; j += 1) {
                fixations[j].line = currentLineID;
            }

            lastLineY = currentLineY;
            currentLineID += 1;
        }
    }

    function ensureCorrectMaxAssignedLineID( sets, lines, maxLineID ) {

        const getMaxLineID = function  (sets) {
            return sets.reduce( (acc1, set) => {
                return set.reduce( (acc2, value) => {
                    return acc2 > value.line ? acc2 : value.line;
                }, acc1);
            }, 0);
        };

        if (getMaxLineID( sets ) > maxLineID) {
            let prevSetCount = sets.length;
            sets = mergeSetsOfType( sets, maxLineID, SET_TYPE.LONG, 2, SET_TYPE.LONG );
            if (sets.length != prevSetCount) {
                console.log('    >1');
                sortAndAlignLines( sets, lines );
                console.log('    <');
            }
        }

        if (getMaxLineID( sets ) > maxLineID) {
            let prevSetCount = sets.length;
            sets = mergeSetsOfType( sets, maxLineID, SET_TYPE.LONG, 1, SET_TYPE.LONG, Number.MAX_VALUE );
            if (sets.length != prevSetCount) {
                console.log('    >2');
                sortAndAlignLines( sets, lines );
                console.log('    <');
            }
        }

        let currentMaxLineID = getMaxLineID( sets );
        while (currentMaxLineID > maxLineID) {
            // still the last line ID is too big... then search for a missed line ID
            let mappedLineIDs = new Array( currentMaxLineID + 1);
            for (let i = 0; i < sets.length; i += 1) {
                mappedLineIDs[ sets[i][0].line ] = true;
            }

            let missingLineID = mappedLineIDs.reduceRight( (acc, val, index) => {
                return acc < 0 && !val ? index : acc;
            }, -1);

            if (missingLineID < 0) {
                break;
            }

            for (let i = sets.length - 1; i >= 0; i -= 1) {
                if (sets[i][0].line > missingLineID) {
                    let fixations = sets[i];
                    for (let j = 0; j < fixations.length; j += 1) {
                        fixations[j].line -= 1;
                    }
                }
            }

            currentMaxLineID = getMaxLineID( sets );
        }

        return sets;
    }

    function assignFixationsToLines (fixationLines) {

        for (let i = 0; i < fixationLines.length; i += 1) {
            let fixations = fixationLines[i];
            for (let j = 0; j < fixations.length; j += 1) {
                fixations[j].line = i;
            }
        }
    }

    function mapToWords (fixationLines, textLines) {

        let getTextLine = function (lineID) {
            let textLine;
            for (let j = 0; j < textLines.length; j += 1) {
                if (lineID === textLines[j].id) {
                    textLine = textLines[j];
                    break;
                }
            }
            return textLine;
        };

        for (let i = 0; i < fixationLines.length; i += 1) {
            let fixations = fixationLines[i];
            let lineID = fixations[0].line;
            let textLine = getTextLine( lineID );

            if (textLine !== undefined) {
                adjustFixations( fixations, textLine );
                mapFixationsWithinLine( fixations, textLine );
            }
        }
    }

    function mergeSets (fixationsSets, lineCount) {

        var result;

        log( '============================' );
        log( 'Joining only long sets' );
        result = mergeSetsOfType( fixationsSets, lineCount, SET_TYPE.LONG );

        log( '============================' );
        log( 'Merging short to long sets' );
        result = mergeSetsOfType( result, lineCount, SET_TYPE.SHORT );

        log( '============================' );
        log( 'Merging the remained single-fixation sets with short sets' );
        result = mergeSetsOfType( result, lineCount, SET_TYPE.SHORT, 2 );

        if (result.length > lineCount) {
            log( '============================' );
            log( 'Still too long. Merging the shorts sets with any other sets' );
            result = mergeSetsOfType( result, lineCount, SET_TYPE.LONG, 2, SET_TYPE.LONG );
        }

        if (result.length > lineCount) {
            log( '============================' );
            log( 'And still too long... Just merge closest sets until we get the right number' );
            result = dropShortSets( result, 2);
            result = mergeSetsOfType( result, lineCount, SET_TYPE.LONG, 1, SET_TYPE.LONG, Number.MAX_VALUE );
        }

        log( '============================' );
        log( 'Final sets', result );

        return result;
    }

    function mergeSetsOfType (fixationsSets, lineCount, setLengthType, longSetThreshold, joiningLengthType, fitThreshold) {
        while (fixationsSets.length > lineCount) {
            var newSets = mergeTwoNearestSets( fixationsSets, setLengthType, longSetThreshold, joiningLengthType, fitThreshold );

            if (!newSets) {
                break;
            }

            fixationsSets = newSets;
        }

        return fixationsSets;
    }

    function mergeTwoNearestSets (fixationsSets, setLengthType, longSetThreshold, joiningLengthType, fitThreshold) {

        var isForcedMerging = fitThreshold > 1;

        joiningLengthType = joiningLengthType || SET_TYPE.LONG;
        longSetThreshold = longSetThreshold || LONG_SET_LENGTH_THRESHOLD;
        fitThreshold = fitThreshold || FIT_THESHOLD;

        var unions = [];
        for (var i = 0; i < fixationsSets.length; i += 1) {
            var set1 = fixationsSets[i];
            if (setLengthType === SET_TYPE.LONG && set1.length < longSetThreshold) {
                continue;
            }
            else if (setLengthType === SET_TYPE.SHORT && set1.length >= longSetThreshold) {
                continue;
            }

            for (var j = 0; j < fixationsSets.length; j += 1) {
                if (i === j) {
                    continue;
                }

                var set2 = fixationsSets[j];
                if (joiningLengthType === SET_TYPE.LONG && set2.length < longSetThreshold) {
                    continue;
                }
                else if (joiningLengthType === SET_TYPE.SHORT && set2.length >= longSetThreshold) {
                    continue;
                }

                unions.push({
                    set1: i,
                    set2: j,
                    error: getUnionError( set1, set2 )
                });
            }
        }

        var result;
        var invalidUnions = {};

        do {
            var minError = Number.MAX_VALUE;
            var minIndex = -1;
            for (var n = 0; n < unions.length; n += 1) {
                if (invalidUnions[n]) {
                    continue;
                }
                var union = unions[n];
                if (union.error < minError) {
                    minIndex = n;
                    minError = union.error;
                }
            }

            if (minIndex >= 0 && minError < fitThreshold) {
                var areSetsJoined = joinSets( fixationsSets, unions[ minIndex ], isForcedMerging ? Number.MAX_VALUE : undefined );
                if (areSetsJoined) {
                    result = fixationsSets;
                }
                else {
                    invalidUnions[ minIndex ] = true;
                }
            }
            else {
                result = null;
            }
        } while (result === undefined);

        return result;
    }

    function getUnionError( set1, set2 ) {
        var newSet = set1.concat( set2 );
        var model = regression.model( 'linear', fixationSetToFitArray( newSet ) );
        return getFittingError( newSet, model.equation );
    }

    function joinSets( fixationsSets, union, maxGradient ) {
        maxGradient = maxGradient || MAX_LINEAR_GRADIENT;

        var set1 = fixationsSets[ union.set1 ];
        var set2 = fixationsSets[ union.set2 ];
        var newSet = set1.concat( set2 );

        var model = regression.model( 'linear', fixationSetToFitArray( newSet ) );
        if (Math.abs( model.equation[1] ) < maxGradient) {
            var minIndex = Math.min( union.set1, union.set2 );
            var maxIndex = Math.max( union.set1, union.set2 );

            fixationsSets.splice( maxIndex, 1 );
            fixationsSets.splice( minIndex, 1 );
            fixationsSets.push( newSet );

            log( 'best union:', union );
            log( 'Joining sets: ', '1' ,set1, '2', set2 );
            return true;
        }

        return false;
    }

    function fixationSetToFitArray (fixations) {
        var result = [];
        for (var i = 0; i < fixations.length; i += 1) {
            var fix = fixations[i];
            result.push( [fix.x, fix.y] );
        }
        return result;
    }

    function getFittingError (fixations, model) {
        var error2 = 0;

        for (var i = 0; i < fixations.length; i += 1) {
            var fix = fixations[i];
            var y = regression.fit( model, fix.x );
            error2 += (fix.y - y) * (fix.y - y);
        }

        return Math.sqrt( error2 / fixations.length );
    }

    function avgY (fixations) {
        var sumY = 0;
        for (var i = 0; i < fixations.length; i += 1) {
            sumY += fixations[i].y;
        }
        return sumY / fixations.length;
    }

    function adjustFixations( fixations, words ) {
        const WORD_CHAR_SKIP_START = 3;
        const WORD_CHAR_SKIP_END = 6;

        const getNewLeftMostX = function (word) {
            if (word.text.length > 2 * WORD_CHAR_SKIP_START) {
                return word.x + Math.floor( WORD_CHAR_SKIP_START / word.text.length * word.width );
            }
            else {
                return word.x + Math.floor( word.width / 2 );
            }
        };
        const getNewRightMostX = function (word) {
            if (word.text.length > WORD_CHAR_SKIP_START + WORD_CHAR_SKIP_END) {
                return word.x + Math.floor( (word.text.length - WORD_CHAR_SKIP_END) / word.text.length * word.width );
            }
            else {
                return word.x + Math.floor( word.width / 2 );
            }
        };

        const firstWord = words[0];
        const leftThreshold = firstWord.x + firstWord.width;
        const lastWord = words[ words.length - 1 ];
        const rightThreshold = lastWord.fixations && lastWord.fixations.length === 1 ? lastWord.x : lastWord.x + lastWord.width;

        let leftMostX = Number.MAX_VALUE,
            rightMostX = Number.MIN_VALUE;

        for (let i = 0; i < fixations.length; i += 1) {
            let fix = fixations[i];
            if (fix.x < leftMostX) {
                leftMostX = fix.x;
            }
            else if (fix.x > rightMostX) {
                rightMostX = fix.x;
            }
        }

        log( 'left: ' + leftMostX + ' ' + leftThreshold );
        log( 'right: ' + rightMostX + ' ' + rightThreshold );

        if (leftMostX < leftThreshold || rightMostX > rightThreshold) {
            // Calculate the scaling factor
            let newLeftMostX = leftMostX < leftThreshold ?  // if the left-most fixation lands left to the 2nd word...
                            getNewLeftMostX( words[0] ) :   // ...estimate its expected location
                            leftMostX;                      // otherwise we do not know where it shoud be...
            let newRightMostX = rightMostX > rightThreshold ?               // if the right-most fixation lands right to the 2nd last word...
                            getNewRightMostX( words[ words.length - 1] ) :  // ...estimate its expected location
                            rightMostX;                                     // otherwise we do not know where it shoud be...
            let newRange = newRightMostX - newLeftMostX;
            let oldRange = rightMostX - leftMostX;
            let scale = newRange / oldRange;

            // limit the scaling factor
            let boundCorrection = 0;
            if (scale < SCALE_DIFF_THRESHOLD) {
                scale = SCALE_DIFF_THRESHOLD;
                boundCorrection = (scale * oldRange - newRange) / 2;
            }
            else if (scale > (2 - SCALE_DIFF_THRESHOLD)) {
                scale = 2 - SCALE_DIFF_THRESHOLD;
                boundCorrection = -(scale * oldRange - newRange) / 2;
            }
            newLeftMostX -= boundCorrection;
            newRightMostX += boundCorrection;

            // Recalculate x's
            log( 'X >>>>>>' );
            for (let i = 0; i < fixations.length; i += 1) {
                let fix = fixations[i];
                fix._x = fix.x;
                fix.x = newLeftMostX + scale * (fix.x - leftMostX);
                log( fix.x + ' >> ' + fix._x );
            }
        }
    }

    function mapFixationsWithinLine( fixations, words ) {
        for (var i = 0; i < fixations.length; i += 1) {
            var fix = fixations[i];
            var minDist = Number.MAX_VALUE;
            var minDistWordID = -1;
            for (var j = 0; j < words.length; j += 1) {
                var word = words[j];
                var effectiveWordWidth = word.fixations || word.text.length < 3  ? 0.7 * word.width : word.width;
                if (fix.x >= word.x && fix.x < effectiveWordWidth) {
                    minDistWordID = j;
                    minDist = 0;
                    break;
                }
                else {
                    var dist = Math.max( word.x - fix.x, fix.x - (word.x + effectiveWordWidth) );
                    if (dist < minDist) {
                        minDist = dist;
                        minDistWordID = j;
                    }
                }
            }

            var closestWord = words[ minDistWordID ];
            fix.word = {
                left: closestWord.x,
                top: closestWord.y,
                right: closestWord.x + closestWord.width,
                bottom: closestWord.y + closestWord.height,
                index: minDistWordID,
                text: closestWord.text,
                id: closestWord.id
            };

            if (closestWord.fixations) {
                closestWord.fixations.push( fix );
            }
            else {
                closestWord.fixations = [ fix ];
            }
        }
    }

    function computeRegressions (fixations) {
        var getPrevMappedFix = function (index, step) {
            var result;
            var passed = 0;
            for (var i = index - 1; i >= 0; i -= 1) {
                var fix = fixations[i];
                if (fix.line !== undefined) {
                    passed += 1;
                    if (passed === step) {
                        result = fix;
                        break;
                    }
                }
            }

            return result;
        };

        var getNextMappedFix = function (index, step) {
            var result;
            var passed = 0;
            for (var i = index + 1; i < fixations.length; i += 1) {
                var fix = fixations[i];
                if (fix.line !== undefined) {
                    passed += 1;
                    if (passed === step) {
                        result = fix;
                        break;
                    }
                }
            }

            return result;
        };

        for (var i = 0; i < fixations.length; i += 1) {
            var fix = fixations[i];
            if (fix.line !== undefined && fix.word !== undefined) {
                var prevFix = getPrevMappedFix( i, 1 );
                fix.isRegression = prevFix && fix.line == prevFix.line && fix.word.index < prevFix.word.index ? true : false;
                if (fix.isRegression) {    // requires correction in ceratin conditions
                    var nextFix = getNextMappedFix( i, 1 );
                    if (nextFix !== undefined && nextFix.line != fix.line) {
                        fix.isRegression = false;
                    }
                    else {
                        //var prevFix = getPrevMappedFix( i, 1 );
                        var prev2Fix = getPrevMappedFix( i, 2 );
                        if (prevFix !== undefined && prev2Fix !== undefined && prevFix.line != prev2Fix.line) {
                            fix.isRegression = false;
                        }
                    }
                }
            }
        }
    }

    function removeTransitionsToNextLine (fixations, words) {
        var index = fixations.length - 1;

        const getPrevFixationOnLine = function (index) {
            let result = null;
            for (; index > 0; index -= 1) {
                var fix = fixations[ index ];
                if (fix.line !== undefined) {
                    result = fix;
                    break;
                }
            }

            return result;
        };

        const getLastChunkSaccade = function (index, direction) {
            let result = null;
            for (; index > 0; index -= 1) {
                var fix = fixations[ index ];
                if (fix.line === undefined) {
                    continue;
                }

                var prevFix = getPrevFixationOnLine( index - 1 );
                if (!prevFix) {
                    index = 0;
                    break;
                }

                if (direction < 0 ? fix.x < prevFix.x : fix.x >= prevFix.x) {
                    result = fix;
                    break;
                }
            }

            return [ result, index ];
        };

        while (index) {
            let [firstProgressionFix, firstProgressionFixIndex] = getLastChunkSaccade( index, -1 );
            if (!firstProgressionFixIndex) {
                break;
            }

            var [lastProgressionFix, index] = getLastChunkSaccade( firstProgressionFixIndex, 1 );

            if (!lastProgressionFix) {
                continue;
            }

            if (firstProgressionFix.line === lastProgressionFix.line + 1) {
                for (let i = index + 1; i < firstProgressionFixIndex; i += 1) {
                    let fix = fixations[ i ];
                    if (fix.word) {
                        let word = words[ fix.word.id ];
                        word.fixations = word.fixations.filter( f => f.id !== fix.id );
                        fix.word = null;
                        fix.line = undefined;
                        log( 'Mapping removed for fix #', fix.id );
                    }
                }
            }
        }
    }

    function median (array) {
        if (array.length <= 5) {
            return array[ Math.floor( array.length / 2 ) ];
        }

        let sets = new Array( Math.floor( array.length / 5 ) + (array.length % 5 ? 1 : 0) );
        for (let i = 0; i < sets.length; i+=1) {
            sets[i] = [];
        }
        for (let i = 0; i < array.length; i+=1) {
            sets[ Math.floor( i / 5 ) ].push( array[i] );
        }

        let medians = [];
        sets.forEach( set => {
            set.sort( (a, b) => {
                return a - b;
            });
            medians.push( set[ Math.floor( set.length / 2 ) ] );
        });

        return median( medians );
    }

    // Export
    app.StaticFit = {
        map: map,
        settings: settings
    };

})( this.Reading || module.exports );
// Requires:
//      app.firebase
//      utils/logger

(function (app) { 'use strict';

    // Text highlighting propagation routine
    // Constructor arguments:
    //      options: {
    //          root:               - selector for the element that contains statistics view
    //      }
    //      services: {
    //          getTextSetup ()     - get an object woth text setup parameters
    //      }
    function Statistics(options, services) {

        this.root = options.root || document.documentElement;
        this.wordSelector = '.' + options.wordClass || '.word';

        _services = services;

        var logError = app.Logger.moduleErrorPrinter( 'Statistics' );
        _services.getTextSetup = _services.getTextSetup || logError( 'getTextSetup' );

        _view = document.querySelector( this.root );
        _view.style.display = 'none';

        var self = this;

        var close = document.querySelector( this.root + ' .close' );
        close.addEventListener('click', function () {
            _view.style.display = 'none';
        });

        var saveLocal = document.querySelector( this.root + ' .saveLocal' );
        saveLocal.addEventListener('click', function () {
            self._saveLocal();
        });

        var saveRemote = document.querySelector( this.root + ' .saveRemote' );
        saveRemote.addEventListener('click', function () {
            self._saveRemote();
        });
    }

    // Print the statistics
    Statistics.prototype.print = function () {
        
        if (_currentWord) {
            var record = _words.get(_currentWord);
            if (record) {
                record.stop();
            }
        }

        var text = Record.getHeader() + '\n';

        _words.forEach(function (record) {
            text += record.toString() + '\n';
        });

        text += '\n' + Fixation.getHeader() + '\n';

        _fixationsFiltered = [];        
        var lastFix = null;
        for (var i = 0; i < _fixations.length; i += 1) {
            var fix = _fixations[i];
            if (fix.duration <= 80) {
                continue;
            }
            if (!lastFix || lastFix.ts !== fix.ts) {
                text += fix.toString() + '\n';
                if (lastFix) {
                    _fixationsFiltered.push( lastFix );
                }
            }
            lastFix = fix;
        }

        var textarea = document.querySelector( this.root + ' textarea' );
        textarea.value = text;

        _view.style.display = 'block    ';
    };

    // Prepares to collect data
    Statistics.prototype.init = function () {
        
        _currentWord = null;
        _words.clear();
        _fixations = [];
        
        _view.style.display = 'none';
    };

    // Propagates the highlighing if the focused word is the next after the current
    // Arguments:
    //        word:         - the focused word  (DOM element)
    Statistics.prototype.setFocusedWord = function (word) {

        var record;
        if (_currentWord != word) {
            if (_currentWord) {
                record = _words.get(_currentWord);
                if (record) {
                    record.stop();
                }
            }
            if (word) {
                record = _words.get(word);
                if (!record) {
                    record = new Record(word);
                    _words.set(word, record);
                }

                record.start();
            }
        }

        _currentWord = word;
    };

    // Logs fixation
    Statistics.prototype.logFixation = function (fixation) {
        _fixations.push(new Fixation(fixation));
    };

    // private
    Statistics.prototype._saveLocal = function () {
        var data = document.querySelector( this.root + ' textarea' ).value;
        var blob = new Blob([data], {type: 'text/plain'});
        
        var downloadLink = document.createElement("a");
        downloadLink.download = 'results.txt';
        downloadLink.innerHTML = 'Download File';

        var URL = window.URL || window.webkitURL;
        downloadLink.href = URL.createObjectURL( blob );
        downloadLink.onclick = function(event) { // self-destrly
            document.body.removeChild(event.target);
        };
        downloadLink.style.display = 'none';
        document.body.appendChild( downloadLink );

        downloadLink.click();
    };

    Statistics.prototype._saveRemote = function () {
        var name = window.prompt( 'Please enter the name', GUID() );
        if (name) {
            var setup = _services.getTextSetup();
            var record = app.firebase.child( name + '_' + setup.textID + '_' + setup.lineSize);
            record.set({
                fixations: _fixationsFiltered,
                words: this._getWordsList(),
                setup: setup
            });
        }
    };

    Statistics.prototype._getWordsList = function () {
        var list = [];
        var words = document.querySelectorAll( this.wordSelector );
        var emptyMapping = new Record();

        for (var i = 0; i < words.length; i += 1) {
            var word = words.item(i);
            var rect = word.getBoundingClientRect();
            var mapping = _words.get( word ) || emptyMapping;  // this._getMapping( rect );
            list.push({
                text: word.textContent,
                x: rect.left,
                y: rect.top,
                width: rect.width,
                height: rect.height,
                timestamp: mapping.timestamp || 0,
                duration: mapping.duration || 0,
                focusCount: mapping.focusCount || 0
            });
        }
        return list;
    };

    Statistics.prototype._getMapping = function (rect) {
        var result = {
            duration: 0,
            focusCount: 0,
            timestamp: 0
        };

        for (var word of _words.values()) {
            var r = word.rect;
            if (Math.abs(r.left - rect.left) < 1 && Math.abs(r.top - rect.top) < 1) {
                result.duration = word.duration;
                result.focusCount = word.focusCount;
                result.timestamp = word.timestamp;
                break;
            }
        }

        return result;
    };

    // private
    var _services;
    var _view;
    var _currentWord = null;
    var _words = new Map();
    var _fixations = [];
    var _fixationsFiltered = [];

    // definitions

    function Record(elem) {
        this.rect = elem ? elem.getBoundingClientRect() : null;
        this.text = elem ? elem.textContent : '';
        this.duration = 0;
        this.focusCount = 0;
        this.timestamp = 0;
    }

    Record.prototype.start = function () {
        this.timestamp = window.performance.now();
        this.focusCount++;
    };

    Record.prototype.stop = function () {
        this.duration += window.performance.now() - this.timestamp;
    };

    Record.prototype.toString = function () {
        return this.text + '\t' + Math.round(this.duration) + '\t' + this.focusCount + '\t' +
            Math.round(this.rect.left) + '\t' + Math.round(this.rect.top) + '\t' + 
            Math.round(this.rect.width) + '\t' + Math.round(this.rect.height);
    };

    Record.getHeader = function () {
        return 'text\tdur\tfocus\tx\ty\tw\th';
    };

    function Fixation(fixation) {
        this.ts = fixation.ts;
        this.x = Math.round(fixation.x);
        this.y = Math.round(fixation.y);
        this.duration = fixation.duration;
    }

    Fixation.prototype.toString = function () {
        return this.ts + '\t' + this.x + '\t' + this.y + '\t' + this.duration;
    };
    
    Fixation.getHeader = function () {
        return 'ts\tx\ty\tdur';
    };

    // private functions

    function GUID() {
        return Math.random().toString(36).substring(2, 15) +
            Math.random().toString(36).substring(2, 15);
    }

    // export

    app.Statistics = Statistics;
    
})( this.Reading || module.exports );

(function (app) { 'use strict';

    // Word highlighting propagation routine
    // Constructor arguments:
    //      options: {
    //          syllabificationEnabled
    //          highlightingEnabled
    //          voiceEnabled
    //          threshold - minimum fixation duration in ms to consider the word should be split
    //      }
    function Syllabifier( options ) {

        this.syllabificationEnabled = options.syllabificationEnabled || false;
        this.highlightingEnabled = options.highlightingEnabled || false;
        this.voiceEnabled = options.voiceEnabled || false;
        this.threshold = options.threshold || 1000;

        this.className = 'currentWord';
        this.spacer = '-';

        this.timer = null;
        this.currentWord = null;
        this.words = null;
    }

    // Resets the highlighting
    Syllabifier.prototype.reset = function () {

        if (this.currentWord) {
            this.currentWord.classList.remove( this.className );
            this.currentWord = null;
        }

        clearTimeout( this.timer );
        this.timer = null;
        this.words = null;
    };

    Syllabifier.prototype.init = function () {
        this.words = new Map();
        if (this.syllabificationEnabled) {
            this.timer = setInterval( () => {
                this._tick();
            }, 30);
        }
    };

    Syllabifier.prototype._tick = function () {
        for (let key of this.words.keys()) {
            let duration = this.words.get( key );
            if (duration >= 0) {    // if duration is <0, then this word is split already
                duration = Math.max( 0, duration + (key === this.currentWord ? 30 : -30) );

                if (duration > this.threshold) {
                    duration = -1;

                    const textNodes = Array.from( key.childNodes).filter( node => node.nodeType === Node.TEXT_NODE);
                    const text = textNodes[0].textContent.trim();
                    key.innerHTML = this.syllabifyWord( text );

                    if (this.voiceEnabled) {
                        responsiveVoice.speak( text, 'Finnish Female' );
                    }
                }

                this.words.set( key, duration );
            }
        }
    };

    // Propagates / removed the highlighing
    // Arguments:
    //   word: - the focused word (DOM)
    Syllabifier.prototype.setFocusedWord = function (word) {

        if (this.currentWord != word) {
            if (this.highlightingEnabled) {
                if (this.currentWord) {
                    this.currentWord.classList.remove( this.className );
                }
                if (word) {
                    word.classList.add( this.className );
                }
            }
            this.currentWord = word;

            if (word && !this.words.has( word )) {
                this.words.set( word, 0 );
            }
        }
    };

    Syllabifier.prototype.syllabify = function( text ) {

        if (!this.syllabificationEnabled) {
            return text;
        }

        return text.map( line => {
            const words = line.split( ' ' ).map( word => word.toLowerCase() );
            return words.map( word => this.syllabifyWord( word ) ).join( ' ' );
        });
    };

    Syllabifier.prototype.prepareForSyllabification = function( text ) {

        if (!this.syllabificationEnabled) {
            return text;
        }

        const prepareWord = word => {
            const syllabifiedWord = this.syllabifyWord( word );
            const spacesCount = syllabifiedWord.length - word.length;
            const halfSpacesCount = Math.round( spacesCount / 2 );

            return  '<span class="syllab">' +
                        (Array( halfSpacesCount + 1 ).join( this.spacer ) ) +
                    '</span>' +
                    word +
                    '<span class="syllab">' +
                        (Array( spacesCount - halfSpacesCount + 1 ).join( this.spacer ) ) +
                    '</span>';
        };

        if ( text instanceof Array ) {
            return text.map( line => {
                const words = line.split( ' ' ).map( word => word.toLowerCase() );
                return words.map( prepareWord ).join( ' ' );
            });
        }
        else {
            return prepareWord( text );
        }
    };

    Syllabifier.prototype.syllabifyWord = function (word) {
        const vowels = [ 'a', 'o', 'u', 'i', 'e', 'ä', 'ö', 'y' ];
        const consonants = [ 'b', 'c', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'm',
                            'n', 'p', 'q', 'r', 's', 't', 'v', 'w', 'x', 'z' ];
        const diftongs = [ 'ai', 'ei', 'oi', 'ui', 'yi', 'äi', 'öi', 'au', 'eu',
                            'iu', 'ou', 'ey', 'iy', 'äy', 'öy', 'ie', 'uo', 'yö' ];

        const getType = c => vowels.includes( c ) ? 'V' : ( consonants.includes( c ) ? 'C' : '_' );

        const result = [];

        let hasVowel = false;
        for (let i = word.length - 1; i >= 0; i--) {
            let separate = false;
            const char = word[i];
            const type = getType( char );
            if (type === 'V') {
                if (i < word.length - 1) {
                    const charPrevious = word[ i + 1 ];
                    const typePrevious = getType( charPrevious );
                    if (charPrevious !== char && typePrevious === type
                        && !diftongs.includes( char + charPrevious)) {
                        result.unshift( this.spacer );
                    }
                }
                hasVowel = true;
            }
            else if (type === 'C' && hasVowel) {
                separate = i > 0;
                if (i === 1) {
                    const charNext = word[i - 1];
                    const typeNext = getType( charNext );
                    if (typeNext === type) {
                        separate = false;
                    }
                }
            }
            result.unshift( char );

            if (separate) {
                result.unshift( this.spacer );
                hasVowel = false;
            }
        }

        return result.join('');
    }

    // test
    // syllabified.forEach( line => line.forEach( word => { console.log(word); } ));

    // export

    app.Syllabifier = Syllabifier;

})( this.Reading || module.exports );

// Requires:
//      utils/logger

(function (app) { 'use strict';

    // Text controller
    // Constructor arguments:
    //      options: {
    //          root:       - ID of the element that stores the text
    //      }
    //      services: {
    //          splitText ()        - service to split the updated text
    //      }
    function Text(options, services) {

        this.root = options.root || '#textContainer';

        _services = services;

        var logError = app.Logger.moduleErrorPrinter( 'Text' );
        _services.splitText = _services.splitText || logError( 'splitText' );

        _textContainer = document.querySelector( this.root );

        this.texts = [
            /*[
                'Steroidivyöhykkeen pienimpiä kivikappaleita sanotaan',
                'meteoroideiksi. Joskus sellainen voi pudota maanpinnalle.',
                'Tällöin sitä kutsutaan meteoriitiksi.'
            ],*/
            [
                'Asteroidit eli pikkuplaneetat ovat pääosin kivisiä,',
                'metallisia ja jäisiä kappaleita, jotka kiertävät Aurinkoa',
                'omilla radoillaan. Suurin osa asteroideista sijaitsee',
                'Marsin ja Jupiterin välissä olevalla asteroidivyöhykkeellä.'
            ],
            [
                'Komeetat eli pyrstötähdet ovat pieniä kappaleita,',
                'jotka koostuvat jäästä ja pölystä. Ne kiertävät Aurinkoa',
                'omilla radoillaan. Kun komeetta liikkuu lähelle Aurinkoa,',
                'sille syntyy kaasusta ja pölystä pyrstö. Pyrstö voi olla miljoonien',
                'kilometrien pituinen. Pyrstö heijastaa Auringon valoa.'
            ],
            [
                'Aurinko on Maata lähinnä oleva tähti. Se on',
                'erittäin kuuma kaasupallo. Lämpötila Auringon pinnassa on',
                'noin 6 000 °C. Auringosta säteilee valoa ja lämpöä.',
                'Maa sijaitsee sopivalla etäisyydellä Auringosta.',
                'Aurinko on kooltaan 109 kertaa suurempi kuin maapallo.',
                'Aurinko ja kahdeksan planeettaa muodostavat aurinkokunnan.'
            ],
            [
                'Matka on ollut pitkä, mutta ihana. Tapasin Lapissa myös joulupukin.',
                'Minä luulin, että Lapissa on aina lunta mutta ei siellä ollut yhtään',
                'lunta. Pelkäsin, että joulupukki kysyy minulta, olenko ollut kiltti.',
                'Mutta ei hän kysynyt. Joulupukki kysyi, mistä me tulemme. Minä sanoin,',
                'että tulemme Kaislarannasta. Sitten joulupukki sanoi, että oli hauska',
                'tavata ja good bye! Minä ymmärsin heti, että nyt piti lähteä.'
            ]
        ];

        this.spacings = ['x-small', 'small', 'median', 'large', 'x-large'];

        this._initialVisibility = true;
    }

    Text.prototype.reset = function () {
        this.switchText( _textIndex );
    }

    Text.prototype.initialVisibility = function (value) {
        if (value !== undefined) {
            this._initialVisibility = value;
            if (this._initialVisibility) {
                this.show();
            }
            else {
                this.hide();
            }
        }
        else {
            return this._initialVisibility;
        }
    };

    Text.prototype.switchText = function (index) {
        _textIndex = index;
        var lines = this.texts[ index ];
        if (!lines) {
            return;
        }

        _textContainer.innerHTML = '';

        for (var i = 0; i < lines.length; i += 1) {
            var line = document.createElement('div');
            line.className = 'line';
            line.textContent = lines[i];

            _textContainer.appendChild( line );
        }

        _services.splitText();
    };

    Text.prototype.switchSpacing = function (index) {
        _textContainer.classList.remove( this.spacings[ _spacingIndex ] );
        _spacingIndex = index;
        _textContainer.classList.add( this.spacings[ _spacingIndex ] );
    };

    Text.prototype.getCurrentTextIndex = function () {
        return _textIndex;
    };

    Text.prototype.getCurrentSpacingIndex = function () {
        return _spacingIndex;
    };

    Text.prototype.show = function() {
        _textContainer.classList.remove( 'invisible' );
    };

    Text.prototype.hide = function() {
        _textContainer.classList.add( 'invisible' );
    };

    Text.prototype.getSetup = function () {
        return {
            textID: _textIndex,
            lineSize: _spacingIndex
        };
    };

    Text.prototype.getText = function () {
        return this.texts[ _textIndex ].join( '\n' );
    }

    Text.prototype.setText = function (text) {
        this.texts[ _textIndex ] = text.split( '\n' );
        this.switchText( _textIndex );
    }

    Text.prototype.setTexts = function (texts) {
        this.texts = texts;
        this.switchText( _textIndex );
    }

    var _textContainer;
    var _services;
    var _textIndex = 0;
    var _spacingIndex = 0;

    app.Text = Text;

})( this.Reading || module.exports );

// Requires:
//      utils/logger

(function (app) { 'use strict';

    // Controller for the text editing side-slider
    // Constructor arguments:
    //      options: {
    //          root:         - slideout element ID
    //          text:         - ID of the element that stores the text to edit
    //      }
    //      services: {
    //          splitText ()        - service to split the updated text
    //      }
    function TextEditor(options, services) {

        this.root = options.root || '#textEditor';
        this.text = options.text || '#text';

        var logError = app.Logger.moduleErrorPrinter( 'TextEditor' );
        _services.splitText = services.splitText || logError( 'splitText' );
        _services.getText = services.getText || logError( 'getText' );
        _services.setText = services.setText || logError( 'setText' );

        this._slideout = document.querySelector( this.root );

        var text = document.querySelector( this.text );

        this._editorText = document.querySelector( this.root + ' .text' );
        this._editorText.value = text.textContent;

        var save = document.querySelector( this.root + ' .save' );
        save.addEventListener( 'click', (e) => {
            _services.setText( this._editorText.value );
            this._slideout.classList.add( 'hidden' );
        });

        var cancel = document.querySelector( this.root + ' .cancel' );
        cancel.addEventListener( 'click', (e) => {
            this._slideout.classList.add( 'hidden' );
        });
    }

    TextEditor.prototype.show = function () {
        this._editorText.value = _services.getText();
        this._slideout.classList.remove( 'hidden' );
    };

    var _services = {};

    app.TextEditor = TextEditor;

})( this.Reading || module.exports );

(function (app) { 'use strict';

    // Text splitting into words routine
    // Constructor arguments:
    //      options: {
    //          root:       - selector for the element that contains text for reading
    //      }
    //      services: {
    //          prepareForSyllabification:  - enlarges a word to compensate for word syllabification
    //      }
    function TextSplitter( options, services ) {
        this.root = options.root || document.documentElement;

        _services = services;

        this.wordClass = 'word';
    }

    // Splits the text nodes into words, each in its own span.word element
    TextSplitter.prototype.split = function () {

        var re = /[^\s]+/gi;

        var nodeIterator = document.createNodeIterator(
            document.querySelector( this.root ),
            NodeFilter.SHOW_TEXT,
            { acceptNode: function(node) {
                if ( ! /^\s*$/.test(node.data) ) {
                    return NodeFilter.FILTER_ACCEPT;
                }
                return NodeFilter.FILTER_REJECT;
            }}
        );

        // Show the content of every non-empty text node that is a child of root
        var node;
        var docFrags = [];

        while ((node = nodeIterator.nextNode())) {

            var word;
            var index = 0;
            var docFrag = document.createDocumentFragment();

            while ((word = re.exec( node.textContent )) !== null) {

                if (index < word.index) {
                    var space = document.createTextNode( node.textContent.substring( index, word.index ) );
                    docFrag.appendChild( space );
                }

                var wordText = _services.prepareForSyllabification( word[ 0 ] );

                var span = document.createElement( 'span' );
                span.classList.add( this.wordClass );
                span.innerHTML = wordText;
                docFrag.appendChild( span );

                index = re.lastIndex;
            }

            docFrags.push( {
                node: node,
                docFrag: docFrag
            });
        }

        docFrags.forEach( function (item) {
            item.node.parentNode.replaceChild( item.docFrag, item.node );
        });
    };

    // private
    var _services;

    // export

    app.TextSplitter = TextSplitter;

})( this.Reading || module.exports );


(function (app) { 'use strict';

    var Colors = { };

    // 'colors' is an array of {color: #XXX or #XXXXXX, weight: real}
    Colors.mix = function( colors ) {
        var c = 0;
        var m = 0;
        var y = 0;
        var k = 0;
        var w = 0;
        for ( var i = 0; i < colors.length; i += 1 )
        {
            var color = rgb2cmyk( colors[ i ].color );
            var weight = colors[ i ].weight;
            c += color.c * weight;
            m += color.m * weight;
            y += color.y * weight;
            k += color.k * weight;
            w += weight;
        }
        var cmyk = {
            c: c / w,
            m: m / w,
            y: y / w,
            k: k / w
        };
        var result = cmyk2rgb( cmyk );
        return result;
    };

    // color is a string of #XXX or #XXXXXX}
    Colors.rgb2rgba = function( color, alpha ) {
        var cmyk = rgb2cmyk( color );
        
        var r = cmyk.c * (1.0 - cmyk.k) + cmyk.k;
        var g = cmyk.m * (1.0 - cmyk.k) + cmyk.k;
        var b = cmyk.y * (1.0 - cmyk.k) + cmyk.k;
        r = Math.round( (1.0 - r) * 255.0 );
        g = Math.round( (1.0 - g) * 255.0 );
        b = Math.round( (1.0 - b) * 255.0 );
        return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
    };

    // ------------------------------------------------------
    // Private
    // ------------------------------------------------------
    
    function rgb2cmyk( color ) {
        color = color.substr( 1 );

        var compLength = color.length === 3 ? 1 : 2;
        var r = parseInt( clone( color.substr( 0 * compLength, compLength ), 3 - compLength), 16 );
        var g = parseInt( clone( color.substr( 1 * compLength, compLength ), 3 - compLength), 16 );
        var b = parseInt( clone( color.substr( 2 * compLength, compLength ), 3 - compLength), 16 );
        var c = 255 - r;
        var m = 255 - g;
        var y = 255 - b;
        var k = Math.min( c, m, y );
        c = ((c - k) / (255 - k));
        m = ((m - k) / (255 - k));
        y = ((y - k) / (255 - k));

        return {
            c: c,
            m: m,
            y: y,
            k: k / 255
        };
    }

    function cmyk2rgb( color ) {
        var r = color.c * (1.0 - color.k) + color.k;
        var g = color.m * (1.0 - color.k) + color.k;
        var b = color.y * (1.0 - color.k) + color.k;
        r = Math.round( (1.0 - r) * 255.0 + 0.5 );
        g = Math.round( (1.0 - g) * 255.0 + 0.5 );
        b = Math.round( (1.0 - b) * 255.0 + 0.5 );
        return '#' + decToHex( r ) + decToHex( g ) + decToHex( b );
    }

    function decToHex( aNum, aPadding ) {
        var hex = Number( aNum ).toString( 16 );
        aPadding = !aPadding && aPadding !== 0 ? 2 : aPadding;

        while (hex.length < aPadding) {
            hex = '0' + hex;
        }

        return hex;
    }

    function clone( str, count ) {
        var result = '';
        for (var i = 0; i < count; i += 1) {
            result += str;
        }
        return result;
    }

    app.Colors = Colors;

})( this.Reading || module.exports );

(function (app) {

    var Logger = {
        enabled: true
    };

    Logger.moduleErrorPrinter = (moduleName) => {
        if (this.Reading !== undefined) {
            return () => { };
        }

        return (missingService) => {
            console.error( 'Missing "${missingService}" service for "${moduleName}"' );
        };
    };

    Logger.moduleLogPrinter = (moduleName) => {
        var print = (item) => {
            console.log( item );
        };

        if (this.Reading !== undefined) {
            return () => { };
        }

        return (title) => {
            if (!Logger.enabled) {
                return;
            }

            console.log( '\n', moduleName );
            console.log( title );
            for (var i = 1; i < arguments.length; i += 1) {
                var data = arguments[i];
                if (data === undefined) {
                    continue;
                }
                if (data instanceof Array) {
                    data.forEach( print );
                }
                else {
                    console.log( data );
                }
            }
        };
    };

    Logger.forModule = (moduleName) => {
        // if (this.Reading !== undefined) {
        //     return () => { };
        // }

        return {
            start: (title) => {
                return new Record( moduleName, title );
            },
            end: (record) => {
                records.delete( record.id );
            },
            log: function () {
                if (!Logger.enabled) {
                    return;
                }
                console.log( moduleName, ...arguments );
            }
        };
    };

    function Record (module, title) {
        this.id = Symbol( title );
        this._record = []; //title ? [ title ] : [];
        this.level = 0;

        this.generalPadding = '';
        for (let i = 0; i < records.size; i += 1) {
            this.generalPadding += Record.padding;
        }

        records.set( this.id, this );

        if (!Logger.enabled) {
            return;
        }

        console.log( '' + this.generalPadding + module );

        if (title) {
            console.log( Record.padding + this.generalPadding + title );
        }
    }

    Record.padding = '    ';

    Record.prototype.push = function () {
        var levelPadding = '';
        for (var i = 0; i < this.level; i += 1) {
            levelPadding += Record.padding;
        }
        //this._record.push( padding + Array.prototype.join.call( arguments, ' ' ) );
        if (!Logger.enabled) {
            return;
        }
        console.log( Record.padding + this.generalPadding + levelPadding + Array.prototype.join.call( arguments, ' ' ) );
    };

    Record.prototype.levelUp = function (text) {
        if (text !== undefined) {
            this.push( text );
        }
        this.level += 1;
    };

    Record.prototype.levelDown = function () {
        this.level -= 1;
        if (this.level < 0) {
            this.level = 0;
        }
    };

    Record.prototype.notEmpty = function () {
        return this._record.length > 0;
    };

    Record.prototype.print = function () {
        if (!Logger.enabled) {
            return;
        }
        console.log( Record.padding + this.generalPadding + this._record.join( '\n' + Record.padding ) );
    };

    var records = new Map();

    app.Logger = Logger;

})( this.Reading || module.exports );
(function (app) { 'use strict';

    var lundDataParser = { };

    lundDataParser.words = function (rows, index) {
        let pages = [];
        let words = [];
        pages.push( { words: words } );

        rows.forEach( row => {
            if (row[0] === '#') {
                return;
            }

            let values = row.split( '\t' );
            if (values.length !== 9) {
                return;
            }

            let pageID = +values[0];
            if (pageID > pages.length) {
                words = [];
                pages.push( { words: words } );
            }

            let word = new Word(
                +values[1], // x1
                +values[2], // y1
                +values[3], // x2
                +values[4], // y2
                +values[6], // col
                +values[7], // row
                values[8]   // text
            );
            words.push( word );
        });

        return pages[ index ].words;
    };

    lundDataParser.fixations = function (rows) {
        let fixations = [];

        rows.forEach( (row, index) => {
            if (index === 0) {
                return;
            }

            let values = row.split( '\t' );
            if (values.length < 8) {
                return;
            }

            let fixation = new Fixation(
                +values[0],     // ts
                +values[1],     // duraiton
                +values[2],     // x
                +values[3],     // y
                +values[4],     // wordID
                values[5] === 'NaN' ? -1 : +values[5],  // col
                values[6] === 'NaN' ? -1 : +values[6],  // row
                values[7]   // text
            );
            fixations.push( fixation );
        });

        return fixations;
    };

    function Word (x1, y1, x2, y2, col, row, text) {
        this.x = x1;
        this.y = y1;
        this.width = x2 - x1;
        this.height = y2 - y1;
        this.row = row;
        this.col = col;
        this.text = text;
    }

    function Fixation (ts, duration, x, y, wordID, col, row, text) {
        this.ts = ts;
        this.duration = duration;
        this.x = x;
        this.y = y;
        this.wordID = wordID;
        this.row = row;
        this.col = col;
        this.text = text;
    }

    app.lundDataParser = lundDataParser;
    
})( this.Reading || module.exports );

(function (app) { 'use strict';

    var Metric = { };

    Metric.compute = function (words, metricType) {

        var maxRange = 0;

        words.forEach( word => {
            if (word.fixations) {
                var params = word.fixations.reduce( (sum, fix) => {
                    sum.duration += fix.duration;
                    sum.regressionCount += fix.isRegression ? 1 : 0;
                    return sum; 
                }, {
                    duration: 0, 
                    regressionCount: 0
                } );
                
                word.duration = params.duration;
                word.regressionCount = params.regressionCount;
                word.charSpeed = 1000 * word.text.length / word.duration;
                word.syllableSpeed = 1000 * app.WordSplit.syllables( word.text ).length / word.duration;

                var metricValue = 0;
                switch (metricType) {
                case Metric.Type.DURATION:
                    metricValue = word.duration;
                    break;
                case Metric.Type.CHAR_SPEED:
                    metricValue = word.charSpeed;
                    break;
                case Metric.Type.SYLL_SPEED:
                    metricValue = word.syllableSpeed;
                    break;
                }
                
                if (maxRange < metricValue) {
                    maxRange = metricValue;
                }
            }
        });

        return maxRange;
    };

    Metric.getAlpha = function (word, metricType, metricRange) {
        return alphaComputers[ metricType ]( word, metricRange );
    };

    function mapDurationToAlpha (word, maxDuration) {
        var result = 0;
        if (word.duration > DURATION_TRANSPARENT) {
            result = (word.duration - DURATION_TRANSPARENT) / (maxDuration - DURATION_TRANSPARENT);
        }
        return result;
    }

    function mapCharSpeedTAlpha (word, maxCharSpeed) {
        var result = 0;
        if (word.charSpeed > 0) {
            result = 1 - word.charSpeed / maxCharSpeed;
        }
        return result;
    }

    function mapSyllableSpeedToAlpha (word, maxSyllableSpeed) {
        var result = 0;
        if (word.syllableSpeed > 0) {
            result = 1 - word.syllableSpeed / maxSyllableSpeed;
        }
        return result;
    }

    const alphaComputers = [
        function () { return 0; },      // for NONE
        mapDurationToAlpha,
        mapCharSpeedTAlpha,
        mapSyllableSpeedToAlpha,
    ];

    const DURATION_TRANSPARENT = 100;
    
    Metric.Type = {
        NONE: 0,
        DURATION: 1,
        CHAR_SPEED: 2,
        SYLL_SPEED: 3,
    };

    app.Metric = Metric;
    
})( this.Reading || module.exports );

(function (app) { 'use strict';

    const MappingsToSave = {
        NONE: 0,
        FIXATIONS: 1,
        WORDS: 2,
        UNIQUE_WORDS: 4,
        PARTICIPANTS: 8
    };

    const MAPPING_TO_SAVE = MappingsToSave.FIXATIONS;

    var RemapExporter = { };

    RemapExporter.export = function (snapshot, remap) {
        if (MAPPING_TO_SAVE === MappingsToSave.NONE) {
            return;
        }

        var logs = createLogs( snapshot, remap );
        saveLogs( logs );
    };

    RemapExporter.save = function (data, filename) {
        var blob = new Blob([data], {type: 'text/plain'});

        var downloadLink = document.createElement("a");
        downloadLink.download = filename;
        downloadLink.innerHTML = 'Download File';

        var URL = window.URL || window.webkitURL;
        downloadLink.href = URL.createObjectURL( blob );
        downloadLink.onclick = function(event) { // self-destrly
            document.body.removeChild(event.target);
        };
        downloadLink.style.display = 'none';
        document.body.appendChild( downloadLink );

        downloadLink.click();
    };

    function createLogs (snapshot, remap) {
        var logs = {
            fixations: [],
            words: [],
            uniqueWords: new Map(),
            participants: new Map()
        };

        snapshot.forEach( childSnapshot => {
            var session = childSnapshot.val();
            if (!session.fixations || !session.words) {
                return;
            }

            var fixations = remap( session );

            var id = childSnapshot.key();

            if (MAPPING_TO_SAVE & MappingsToSave.FIXATIONS) {
                //Array.prototype.push.apply( logs.fixations, logFixations( id, fixations ) );
                logs.fixations = logs.fixations.concat( id, ...logFixations( fixations ) );
            }

            if (MAPPING_TO_SAVE & MappingsToSave.WORDS) {
                Array.prototype.push.apply( logs.words, logWords( id, fixations, session.words ) );
            }

            if (MAPPING_TO_SAVE & MappingsToSave.UNIQUE_WORDS) {
                logUniqueWords( fixations, session.words, logs.uniqueWords );
            }
            if (MAPPING_TO_SAVE & MappingsToSave.PARTICIPANTS) {
                logParticipants( id, fixations, session.words, logs.participants );
            }
        });

        return logs;
    }

    function saveLogs( logs ) {
        if (MAPPING_TO_SAVE & MappingsToSave.FIXATIONS) {
            RemapExporter.save( logs.fixations.join( '\r\n' ), 'mapping_fixations.txt' );
        }
        if (MAPPING_TO_SAVE & MappingsToSave.WORDS) {
            RemapExporter.save( logs.words.join( '\r\n' ), 'mapping_words.txt' );
        }
        if (MAPPING_TO_SAVE & MappingsToSave.UNIQUE_WORDS) {
            var data = [];
            logs.uniqueWords.forEach( word => {
                data.push( `${word.text}\t${word.duration}\t${word.avgFixDur()}` );
            });
            RemapExporter.save( data.join( '\r\n' ), 'mapping_uniqueWords.txt' );
        }
        if (MAPPING_TO_SAVE & MappingsToSave.PARTICIPANTS) {
            var data = [];
            logs.participants.forEach( participant => {
                data.push( participant.id );
                participant.words.forEach( word => {
                    data.push( `${word.text}\t${word.duration}\t${word.avgFixDur()}` );
                });
            });
            RemapExporter.save( data.join( '\r\n' ), 'mapping_participants.txt' );
        }
    }

    function logFixations (fixations) {
        //var i = 0;
        var fixations = fixations.map( fix => {
            var x = fix._x !== undefined ? fix._x : fix.x;
            if (x < 0 || fix.y < 0 ) {
                return null;
            }
            var word = !fix.word ? '' : fix.word.index;
            var line = fix.line === undefined || fix.line === null || word === '' ? -1 : fix.line;
            return `${x}\t${fix.y}\t${fix.duration}\t${fix.id}\t${line}\t${word}`;
//            return `${x}\t${fix.y}\t${fix.duration}\t${line}\t${word}\t` +
//                ( !fix.word ? `\t` : `${fix.word.text}\t` );
        });

        return fixations.filter( record => { return record !== null; } );
    }

    function logWords (id, fixations, words) {
        var counters = new Map();

        fixations.forEach( fixation => {
            var line = fixation.line === undefined || fixation.line === null ? -1 : fixation.line;
            var word = !fixation.word ? -1 : fixation.word.index;
            if (line >= 0 && word >= 0) {
                var wordID = `${line}_${word}`;
                var wordText = fixation.word.text;
                if (!counters.has( wordID )) {
                    counters.set( wordID, new Counter( wordText, fixation.duration ) );
                }
                else {
                    counters.get( wordID ).add( fixation.duration );
                }
            }
        });

        var words = [ id ];
        counters.forEach( word => {
            words.push( `${word.text}\t${word.duration}\t${word.avgFixDur()}` );
        });

        return words;
    }

    function logUniqueWords (fixations, words, accumulator) {
        fixations.forEach( fixation => {
            if (!fixation.word) {
                return;
            }

            var word = fixation.word.text.toLowerCase().match( /([a-z]|[0-9]|ä|ö)+/ )[0];
            if (!accumulator.has( word )) {
                accumulator.set( word, new Counter( word, fixation.duration ) );
            }
            else {
                accumulator.get( word ).add( fixation.duration );
            }
        });
    }

    function logParticipants (id, fixations, words, accumulator) {
        var participantID = id.split( '_' )[0];
        var participant = accumulator.get( participantID );
        if (!participant) {
            participant = {
                id: participantID,
                words: new Map()
            };
            accumulator.set( participantID, participant );
        }
        var words = participant.words;

        fixations.forEach( fixation => {
            if (!fixation.word) {
                return;
            }

            var word = fixation.word.text.toLowerCase().match( /([a-z]|[0-9]|ä|ö)+/ )[0];
            if (!words.has( word )) {
                words.set( word, new Counter( word, fixation.duration ) );
            }
            else {
                words.get( word ).add( fixation.duration );
            }
        });
    }

    function Counter (text, duration) {
        this.text = text;
        this.duration = duration;
        this.durationCount = 1;
        this.count = 1;
    }

    Counter.prototype.add = function (duration) {
        this.duration += duration;
        this.durationCount++;
    }

    Counter.prototype.avgFixDur = function () {
        return this.duration / this.durationCount;
    }

    Counter.prototype.avgDur = function () {
        return this.duration / this.count;
    }

    app.RemapExporter = RemapExporter;

})( this.Reading || module.exports );

// Base for visualizations
//
// Requires:
//
// Interface to implement:
//        _load
//        _fillDataQueryList

(function (app) { 'use strict';

    // Visualization constructor
    // Arguments:
    //      options: {
    //          wordColor           - word color
    //          wordFont      c     - word font
    //          wordHighlightColor  - mapped word rectangle color
    //          wordStrokeColor     - word rectable border color
    //          infoColor           - info text color
    //          infoFont            - info text font
    //          colorMetric         - word background coloring metric
    //          mapping             - mapping type
    //      }
    function Visualization (options) {
        this.wordColor = options.wordColor || '#080'//'#CCC';
        this.wordFont = options.wordFont || '22pt Calibri, Arial, sans-serif';
        this.wordHighlightColor = options.wordHighlightColor || '#606';
        this.wordStrokeColor = options.wordStrokeColor || '#888';
        this.infoColor = options.infoColor || '#444';
        this.infoFont = options.infoFont || '18px Arial';

        this.colorMetric = options.colorMetric !== undefined ? options.colorMetric : app.Metric.Type.DURATION;
        this.mapping = options.mapping !== undefined ? options.mapping : Visualization.Mapping.STATIC;

        this._snapshot = null;
        this._sessioName = '';
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
        _wait = _view.querySelector( '.wait' );
        _canvas = document.querySelector( root + ' canvas');
        _sessionPrompt = document.querySelector( root + ' #session' );
        _filePrompt = document.querySelector( root + ' #file' );

        _view.classList.add( 'invisible' );
        _sessionPrompt.classList.add( 'invisible' );
        _filePrompt.classList.add( 'invisible' );

        Visualization.root = document.querySelector( root );

        var close = document.querySelector( root + ' .close' );
        close.addEventListener( 'click', () => {
            _view.classList.add( 'invisible' );

            var ctx = _canvas.getContext('2d');
            ctx.clearRect( 0, 0, _width, _height );

            if (callbacks.hidden) {
                callbacks.hidden();
            }
        });

        var select = document.querySelector( root + ' .select' );
        select.addEventListener( 'click', () => {
            var list = _sessionPrompt.querySelector( '#conditions' );
            _sessionPrompt.classList.add( 'invisible' );

            if (list.multiple) {
                var options = [];
                for (var i = 0; i < list.selectedOptions.length; i++) {
                    options.push( list.selectedOptions[i].value );
                }
                _sessionPromtCallback( options );
            }
            else {
                var selectedOption = list.options[ list.selectedIndex ];
                _sessionPromtCallback( selectedOption.value, selectedOption.textContent );
            }
        });

        var browse = document.querySelector( root + ' .file' );
        browse.addEventListener( 'change', e => {
            var fileName = e.target.files[0];
            _filePrompt.classList.add( 'invisible' );

            _filePromtCallback( fileName );
        });

        var categories = document.querySelector( root + ' #categories' );
        categories.addEventListener( 'change', e => {
            var selectedOption = e.target.options[ e.target.selectedIndex ];

            if (selectedOption && selectedOption.data) {
                var list = _sessionPrompt.querySelector( '#conditions' );
                list.innerHTML = '';
                selectedOption.data.forEach( session => {
                    addOption( list, session );
                });
            }
        });
    };

    Visualization.prototype.queryData = function (multiple) {
        if (_callbacks.shown) {
            _callbacks.shown();
        }

        _view.classList.remove( 'invisible' );
        _wait.classList.remove( 'invisible' );

        if (this._snapshot) {
            this._showDataSelectionDialog( multiple );
            return;
        }

        if (_waiting) {
            return;
        }

        _waiting = true;
        app.firebase.once( 'value', snapshot => {
            _waiting = false;

            if (!snapshot.exists()) {
                window.alert( 'no records in DB' );
                return;
            }

            this._snapshot = snapshot;

            if (!_view.classList.contains('invisible')) {
                this._showDataSelectionDialog( multiple );
            }

        }, function (err) {
            window.alert( err );
        });
    };

    Visualization.prototype._callbacks = function () {
        return _callbacks;
    }

    Visualization.prototype._getConditionNameFromSessionName = function (sessionName, considerSpacings) {
        var result;
        var nameParts = sessionName.split( '_' );
        if (nameParts.length === 3) {
            result = nameParts[1];
            if (considerSpacings) {
                result += ', spacing #' + nameParts[2];
            }
        }
        return result;
    }

    Visualization.prototype._getConditions = function (uniteSpacings) {
        var conditions = new Map();
        this._snapshot.forEach( childSnapshot => {
            var sessionName = childSnapshot.key();
            var key = this._getConditionNameFromSessionName( sessionName, !uniteSpacings );
            if (key) {
                var sessions = conditions.get( key ) || [];
                sessions.push( sessionName );
                conditions.set( key, sessions );
            }
        });

        return new Map([...conditions.entries()].sort());
    }

    Visualization.prototype._showDataSelectionDialog = function (multiple) {
        _wait.classList.add( 'invisible' );

        var list = _sessionPrompt.querySelector( '#conditions' );
        list.multiple = !!multiple;
        list.innerHTML = '';

        var categories = this._fillDataQueryList( list );

        var catList = _sessionPrompt.querySelector( '#categories' );
        if (categories) {
            catList.innerHTML = '';
            catList.classList.remove( 'hidden' );
            for (var key of categories.keys()) {
                addOption( catList, key, key, categories.get( key ) );
            }
            var event = new Event('change');
            catList.dispatchEvent( event );
        }
        else {
            catList.classList.add( 'hidden' );
        }

        _sessionPromtCallback = this._load.bind( this );
        _sessionPrompt.classList.remove( 'invisible' );
    };

    Visualization.prototype._showFileSelectionDialog = function (prompt, callback) {
        if (_callbacks.shown) {
            _callbacks.shown();
        }

        _view.classList.remove( 'invisible' );

        _filePromtCallback = callback;
        _filePrompt.querySelector( '.title' ).textContent = prompt || 'Select a file:';
        _filePrompt.querySelector( '.file' ).filename = '';
        _filePrompt.classList.remove( 'invisible' );
    };

    Visualization.prototype._getCanvas2D = function () {
        if (!_width || !_height) {
            _width = parseInt( window.getComputedStyle( _canvas ).width );
            _height = parseInt( window.getComputedStyle( _canvas ).height );
            _canvas.setAttribute( 'width',  _width );
            _canvas.setAttribute( 'height', _height );
        }

        var ctx = _canvas.getContext('2d');

        ctx.font = this.wordFont;
        ctx.clearRect(0, 0, _width, _height);

        return ctx;
    };

    Visualization.prototype._drawTitle = function (ctx, title) {
        ctx.fillStyle = this.infoColor;
        ctx.font = this.infoFont;

        var textWidth = ctx.measureText( title ).width;
        ctx.fillText( title, (_canvas.width - textWidth) / 2, 32);
    };

    Visualization.prototype._drawWords = function (ctx, words, metricRange, showIDs, hideBoundingBox) {
        ctx.strokeStyle = this.wordStrokeColor;
        ctx.lineWidth = 1;

        var indexComputer = IndexComputer();

        words.forEach( (word, index) => {
            var alpha = app.Metric.getAlpha( word, this.colorMetric, metricRange );
            this._drawWord( ctx, word, alpha,
                showIDs ? indexComputer.feed( word.x, word.y ) : null,
                hideBoundingBox);
        });
    };

    Visualization.prototype._drawWord = function (ctx, word, backgroundAlpha, indexes, hideBoundingBox) {
        if (backgroundAlpha > 0) {
            //backgroundAlpha = Math.sin( backgroundAlpha * Math.PI / 2);
            // ctx.fillStyle = app.Colors.rgb2rgba( this.wordHighlightColor, backgroundAlpha);
            // ctx.fillRect( Math.round( word.x ), Math.round( word.y ), Math.round( word.width ), Math.round( word.height ) );
        }

        ctx.font = this.wordFont;
        ctx.textAlign = 'start';
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = this.wordColor;
        ctx.fillText( word.text, word.x, word.y + 0.8 * word.height);

        if (backgroundAlpha > 0) {
            ctx.fillStyle = app.Colors.rgb2rgba( this.wordHighlightColor, backgroundAlpha);
            ctx.fillText( word.text, word.x, word.y + 0.8 * word.height);
        }

        if (indexes) {
            if (indexes.word === 0) {
                ctx.fillStyle = '#080';
                ctx.textAlign = 'end';
                ctx.fillText( '' + indexes.line, word.x - 20, word.y + 0.8 * word.height );
            }

            ctx.fillStyle = '#008';
            ctx.textAlign = 'center';
            ctx.fillText( '' + indexes.word, word.x + word.width / 2, word.y );
        }

        if (!hideBoundingBox) {
            if (word.participants) {
                ctx.font = '12px Arial';
                word.participants.forEach( (participant, index) => {
                    if (index > 2) {
                        return;
                    }
                    let id = +participant.name.substr(1);
                    ctx.fillStyle = '#004' //`rgb(${10*id},0,0)`;
                    ctx.fillText( participant.name, word.x, word.y + index * 15 - 20);
                });
                ctx.font = this.wordFont;
            }
            else {
                ctx.strokeRect( word.x, word.y, word.width, word.height);
            }
        }
    };

    var _height;
    var _width;
    var _callbacks;
    var _view;
    var _wait;
    var _canvas;
    var _sessionPrompt;
    var _filePrompt;

    var _sessionPromtCallback;
    var _filePromtCallback;

    var _waiting = false;

    var IndexComputer = function () {
        var lastX = -1;
        var lastY = -1;
        var currentWordIndex = -1;
        var currentLineIndex = -1;

        return {
            feed: function (x, y) {
                if (y > lastY) {
                    currentLineIndex++;
                    currentWordIndex = 0;
                }
                else if (x > lastX) {
                    currentWordIndex++;
                }

                lastX = x;
                lastY = y;

                return {
                    word: currentWordIndex,
                    line: currentLineIndex
                };
            }
        };
    };

    function addOption (list, value, text, data) {
        var option = document.createElement( 'option' );
        option.value = value;
        option.textContent = text || value;
        if (data) {
            option.data = data;
        }
        list.appendChild( option );

        return option;
    }

    Visualization.Mapping = {
        STATIC: 0,
        DYNAMIC: 1
    };

    app.Visualization = Visualization;

})( this.Reading || module.exports );

(function (app) { 'use strict';

    var WordSplit = {};

    WordSplit.syllables = function (word) {
        var result = [];
        var syllable = '';
        var chain = '';
        word = word.toLowerCase( word );

        var isVowel = vowel => { return c === vowel; };

        var isMatchingSyllableBound = (bound, index) => {   // then search for the matching bound
//console.log('--- bound check ---' );
            var isMatching = chain.endsWith( bound[2] );
//console.log(bound[2], isMatching);
            if (isMatching && index === 3) {         // cannot be diftong or long vowel
                var s = syllable.substr( -2, 2 );
                if (s[0] === s[1]) {
                    isMatching = false;
//console.log('    cancel - this is long vowel');
                }
                else if (DIFTONGS.some( diftong => { return s === diftong; } )) {
                    isMatching = false;
//console.log('    cancel - this is diftong');
                }
            }
            return isMatching;
        };

        for (var i = 0; i < word.length; i += 1) {
            var c = word[i];
            syllable +=c;

            var charType = VOWELS.some( isVowel ) ? VOWEL : CONSONANT;
            chain += charType;
//console.log(chain, ':', syllable);
            if (charType === VOWEL && chain.length > 1) {            // when there are at least 2 chars, and the lst one is vowel,
                var boundIndex = bounds.findIndex( isMatchingSyllableBound );
                if (boundIndex >= 0) {
                    var newSyllableLength = bounds[ boundIndex ][1].length;
//console.log(newSyllableLength);
                    result.push( syllable.substr( 0, syllable.length - newSyllableLength ) );
//console.log('syllable found:', syllable.substr( 0, syllable.length - newSyllableLength ));
                    syllable = syllable.substr( -newSyllableLength, newSyllableLength );
//console.log('   text left:', syllable);
                    chain = chain.substr( -newSyllableLength, newSyllableLength );
//console.log('   chain left:', chain);
                }
            }
        }
        
        result.push( syllable );
//console.log('   text left:', syllable);

        return result;
    };

    const VOWEL = 'v';
    const CONSONANT = 'c';

    const VOWELS = [ 'a', 'o', 'u', 'i', 'e', 'ä', 'ö', 'y' ];
    const DIFTONGS = [
        'ai', 'ei', 'oi', 'ui', 'yi', 'äi', 'öi', 
        'au', 'eu', 'iu', 'ou',
        'äy', 'ey', 'iy', 'öy',
        'ie', 'uo', 'yö'
    ];
    var bounds = [
        [ VOWEL, CONSONANT+VOWEL ],
        [ VOWEL+CONSONANT, CONSONANT+VOWEL ],
        [ VOWEL+CONSONANT+CONSONANT, CONSONANT+VOWEL ],
        [ VOWEL, VOWEL ]
    ];

    bounds.forEach( item => {
        item.push( item[0] + item[1] );
    });

    app.WordSplit = WordSplit;
    
})( this.Reading || module.exports );

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

(function (app) { 'use strict';

	// Word statistic list
    // Arguments:
    //      options: {
    //          container   - container selector
    function WordList (options) {
        this._container = document.querySelector( options.container );

        const close = app.Visualization.root.querySelector( '.close' );
        close.addEventListener( 'click', () => {
            this._container.classList.add( 'invisible' );
        });

        const drowpdown = this._container.querySelector( '.button' );
        const table = this._container.querySelector( '.table' );
        drowpdown.addEventListener( 'click', () => {
            drowpdown.classList.toggle( 'dropped' );
            table.classList.toggle( 'invisible' );
        });
    }

    WordList.instance = null;
    WordList.Units = {
    	MS: 'ms',
    	PERCENTAGE: '%'
    };

    WordList.prototype.show = function() {
		this._container.classList.remove( 'invisible' );
    }

    // Options: {
    //		units (String): [ms, %]
    // }
    WordList.prototype.fill = function( words, options = {} ) {
        const table = this._container.querySelector( '.table' );
        table.innerHTML = '';

        const descending = (a, b) => b.duration - a.duration;
        words = words.map( word => word ).sort( descending );

        const units = options.units || WordList.Units.MS;
        const totalDuration = words.reduce( (sum, word) => (sum + word.duration), 0);

        words.forEach( word => {
        	let value = word.duration;
        	if (units === WordList.Units.MS) {
        		value = Math.round( value );
        	}
        	else if (units === WordList.Units.PERCENTAGE) {
        		value = (100 * value / totalDuration).toFixed(1) + '%';
        	}

            const wordItem = document.createElement( 'span' );
            wordItem.classList.add( 'word' );
            wordItem.textContent = word.text;

            const durationItem = document.createElement( 'span' );
            durationItem.classList.add( 'duration' );
            durationItem.textContent = value;

            const record = document.createElement( 'div' );
            record.classList.add( 'record' );
            record.appendChild( wordItem );
            record.appendChild( durationItem );

            table.appendChild( record );
        });
    }

    app.WordList = WordList;

})( this.Reading || module.exports );
