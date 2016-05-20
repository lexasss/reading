// Requires:
//      Firebase

var Reading = Reading || {};

// "components" contains selectors for each component 
Reading.init = function (components) {
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

	var visualizationRoot = { root: components.path	};
	var visualizationCallbacks = {
	    shown: text.hide,
	    hidden: function () {
	    	if (text.initialVisibility()) {
	    		text.show();
	    	}
	    }
	};

	var path = new Reading.Path( visualizationRoot, visualizationCallbacks );
	var wordGazing = new Reading.WordGazing( visualizationRoot, visualizationCallbacks );

	var controls = new Reading.Controls({
	    root: components.controls
	}, {
	    getTexts: function () { return text.texts; },
	    getSpacings: function () { return text.spacings; },
	    switchText: text.switchText.bind( text ),
	    switchSpacing: text.switchSpacing.bind( text ),
	    selectSession: path.select.bind( path ),
	    selectCondition: wordGazing.select.bind( wordGazing ),
	});

	var options = new Reading.Options({
	    root: components.options,
	    text: components.textContainer + ' ' + components.text
	}, {
		showPointer: function (value) { 
			if (value !== undefined) {
				GazeTargets.updateSettings( { pointer: { show: value } } );
			} else {
				return GazeTargets.getSettings( 'pointer/show' );
			}
		},
		highlightWord: function (value) {
			if (value !== undefined) {
				textSplitter.highlightCurrentWord = value; 
			} else {
				return textSplitter.highlightCurrentWord;
			}
		},
		hideText: function (value) {
			if (value !== undefined) {
				text.initialVisibility( !value ); 
			} else {
				return !text.initialVisibility();
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

	var gazeTargetsManager = new Reading.GazeTargetsManager({
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
	    wordLeft: function (word) {
	        textSplitter.setFocusedWord( null );
	        statistics.setFocusedWord( null );
	    },
	    updateControls: controls.onStateUpdated,
	    fixation: statistics.logFixation
	});
};