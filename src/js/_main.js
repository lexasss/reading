// Requires:
//      Firebase

var Reading = Reading || {};

// "components" contains selectors for each component 
Reading.init = function (components) {

    Reading.loadingCallbacks.forEach( callback => { callback(); } );

    // DB
    Reading.firebase = new Firebase("https://burning-torch-9217.firebaseio.com/school/");

    // setup
    var textSplitter = new Reading.TextSplitter({
        root: components.text
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

    var path = new Reading.Path({
        root: components.visualization
    });
    var wordGazing = new Reading.WordGazing({
        root: components.visualization,
        spacingNames: text.spacings
    });

    var controls = new Reading.Controls({
        root: components.controls
    }, {
        getTexts: function () { return text.texts; },
        getSpacings: function () { return text.spacings; },
        switchText: text.switchText.bind( text ),
        switchSpacing: text.switchSpacing.bind( text ),
        selectSession: path.queryData.bind( path ),
        selectCondition: wordGazing.queryData.bind( wordGazing )
    });

    var options = new Reading.Options({
        root: components.options,
        text: components.textContainer + ' ' + components.text
    }, {
        showPointer: function (value) { return value === undefined ?
            GazeTargets.getSettings( 'pointer/show' ) :
            GazeTargets.updateSettings( { pointer: { show: value } } );
        },
        highlightWord: function (value) { return value === undefined ? 
            textSplitter.highlightCurrentWord :
            (textSplitter.highlightCurrentWord = value);
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
        }
    });

    var statistics = new Reading.Statistics({
        root: components.statistics, 
        wordClass: textSplitter.wordClass
    }, {
        getTextSetup: text.getSetup.bind( text )
    });

    var textEditor = new Reading.TextEditor({
        root: components.textEditor,
        text: components.text
    }, {
        splitText: textSplitter.split.bind( textSplitter )
    });

    /*var gazeTargetsManager = */new Reading.GazeTargetsManager({
        trackingStarted: function () {
            textSplitter.init();
            statistics.init();
            textEditor.lock();
            options.lock();
            controls.lock();
            if (!text.initialVisibility()) {
                text.show();
            }
        },
        trackingStopped: function () {
            textSplitter.reset();
            statistics.print();
            textEditor.unlock();
            options.unlock();
            controls.unlock();
            if (!text.initialVisibility()) {
                text.hide();
            }
        },
        wordFocused: function (word) {
            textSplitter.setFocusedWord( word );
            statistics.setFocusedWord( word );
        },
        wordLeft: function (/*word*/) {
            textSplitter.setFocusedWord( null );
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