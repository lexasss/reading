// Project namespace

var Reading = Reading || {};

// "components" contains selectors for each component 
Reading.init = function (components) {
	// DB
	Reading.firebase = new Firebase("https://burning-torch-9217.firebaseio.com/");

	// setup
	var textSplitter = new Reading.TextSplitter({
	    root: components.text
	});

	var text = new Reading.Text({
	    root: components.text
	}, {
	    splitText: textSplitter.split.bind( textSplitter )
	});

	var path = new Reading.Path({ 
	    root: components.path
	}, {
	    shown: text.hide,
	    hidden: text.show
	});

	var controls = new Reading.Controls({
	    root: components.controls
	}, {
	    getTexts: function () { return text.texts; },
	    getSpacings: function () { return text.spacings; },
	    switchText: text.switchText.bind( text ),
	    switchSpacing: text.switchSpacing.bind( text ),
	    selectSession: path.select.bind( path )
	});

	var options = new Reading.Options({
	    root: components.options,
	    text: components.text
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
	    },
	    trackingStopped: function () {
	        textSplitter.reset();
	        statistics.print();
	        textEditor.unlock();
	        options.unlock();
	        controls.unlock();
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