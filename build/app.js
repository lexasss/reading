// Project namespace

var Reading = Reading || {};


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
            panel: {
               show: true
            },
            pointer: {
                show: true
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
                type: GazeTargets.mapping.types.expanded,  
                source: GazeTargets.mapping.sources.fixations,
                model: GazeTargets.mapping.models.none,
                expansion: 30,
                reading: {
                    maxSaccadeLength: 250,      // maximum progressing saccade length, in pixels
                    maxSaccadeAngleRatio: 0.7   // |sacc.y| / sacc.dx
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
            }
        });
    }

    app.GazeTargetsManager = GazeTargetsManager;
    
})( Reading || window );

(function (app) { 'use strict';

    // Controller for the text options side-slider
    // Constructor arguments:
    //        options: {
    //            root:         - slideout element ID
    //            text:         - ID of the element that stores the text to edit
    //        }
    function Options(options) {

        this.root = options.root || '#options';
        this.text = options.text || '#textContainer';
        
        this._slideout = document.querySelector( this.root );

        var cssRules = [
            { name: 'color', type: 'color', cssrule: '.readingText', id: 'text', prefix: '#', suffix: '' },
            { name: 'color', type: 'color', cssrule: '.readingText .currentWord', id: 'currentWord', prefix: '#', suffix: '' },
            { name: 'font-size', type: 'string', cssrule: '.readingText', id: 'fontSize', prefix: '', suffix: '' },
            { name: 'line-height', type: 'string', cssrule: '.readingText', id: 'lineHeight', prefix: '', suffix: '' },
        ];

        this._style = document.createElement( 'style' );
        document.body.appendChild( this._style );

        var self = this;
        
        var apply = document.querySelector( this.root + ' .save' );
        apply.addEventListener( 'click', function () {
            getRulesFromEditors( self._style, cssRules );
            self._slideout.classList.remove( 'expanded' );
        });

        var close = document.querySelector( this.root + ' .close' );
        close.addEventListener( 'click', function () {
            self._slideout.classList.remove( 'expanded' );
        });

        var slideoutTitle = document.querySelector( this.root + ' .title');
        slideoutTitle.addEventListener( 'click', function (e) {
            self._slideout.classList.toggle( 'expanded' );
            setRulesToEditors( cssRules );
        });

        window.addEventListener( 'load', function () {
            obtainInitialRules( cssRules );
            bindRulesToEditors( cssRules, self.root + ' #' );
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
                    if (rule.selectorText === customRule.cssrule) {
                        if (customRule.type === 'color') {
                            customRule.initial = cssColorToHex( rule.style.color );
                        }
                        else if (customRule.type === 'string') {
                            customRule.initial = rule.style[ cssToJS( customRule.name ) ];
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
                rule.editor.color.fromString( rule.initial );
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
                rule.value = '#' + rule.editor.color;
            }
            else if (rule.type === 'string') {
                rule.value = rule.editor.value;
            }
            styleText += rule.cssrule + ' { ' + rule.name + ': ' + rule.value + rule.suffix + ' !important; } ';
        }
        style.innerHTML = styleText;
    }

    function setRulesToEditors( rules ) {

        for (var i = 0; i < rules.length; i++) {
            var rule = rules[ i ];
            if (rule.type === 'color') {
                rule.editor.color.fromString( rules.value );
            }
            else if (rule.type === 'string') {
                rule.editor.value = rule.value;
            }
        }
    }

    app.Options = Options;
    
})( Reading || window );

(function (app) { 'use strict';

    // Text highlighting propagation routine
    // Constructor arguments:
    //      options: {
    //          root:         - selector for the element that contains statistics view
    //      }
    function Statistics(options) {

        this.root = options.root || document.documentElement;

        _view = document.querySelector( this.root );
        _view.style.display = 'none';

        var close = document.querySelector( this.root + ' .close' );
        close.addEventListener('click', function () {
            _view.style.display = 'none';
        });
    }

    // Print the statistics
    Statistics.prototype.print = function () {
        
        if (_currentWord) {
            var record = _map.get(_currentWord);
            if (record) {
                record.stop();
            }
        }

        var text = Record.getHeader() + '\n';

        _map.forEach(function (record) {
            text += record.toString() + '\n';
        });

        var textarea = document.querySelector( this.root + ' textarea' );
        textarea.value = text;

        _view.style.display = 'block    ';
    };

    // Prepares to collect data
    Statistics.prototype.init = function () {
        
        _currentWord = null;
        _map.clear();
        
        _view.style.display = 'none';
    };

    // Propagates the highlighing if the focused word is the next after the current
    // Arguments:
    //        word:         - the focused word  (DOM element)
    Statistics.prototype.setFocusedWord = function (word) {

        var record;
        if (_currentWord != word) {
            if (_currentWord) {
                record = _map.get(_currentWord);
                if (record) {
                    record.stop();
                }
            }
            if (word) {
                record = _map.get(word);
                if (!record) {
                    record = new Record(word);
                    _map.set(word, record);
                }

                record.start();
            }
        }

        _currentWord = word;
    };

    // private
    var _view;
    var _currentWord = null;
    var _map = new Map();

    // definitions

    function Record(elem) {
        this.rect = elem.getBoundingClientRect();
        this.text = elem.textContent;
        this.duration = 0;
        this.focusCount = 0;
        this._startTime = 0;
    }

    Record.prototype.start = function () {
        this._startTime = performance.now();
        this.focusCount++;
    };

    Record.prototype.stop = function () {
        this.duration += performance.now() - this._startTime;
    }

    Record.prototype.toString = function () {
        return this.text + '\t' + Math.round(this.duration) + '\t' + this.focusCount + '\t' +
            Math.round(this.rect.left) + '\t' + Math.round(this.rect.top) + '\t' + 
            Math.round(this.rect.width) + '\t' + Math.round(this.rect.height);
    }

    Record.getHeader = function () {
        return 'text\tdur\tfocus\tx\ty\tw\th';
    }

    // export

    app.Statistics = Statistics;
    
})( Reading || window );

(function (app) { 'use strict';

    // Controller for the text editing side-slider
    // Constructor arguments:
    //        options: {
    //            root:         - slideout element ID
    //            text:         - ID of the element that stores the text to edit
    //        }
    //        callbacks: {
    //            splitText ()        - request to split the updated text
    //        }
    function TextEditor(options, callbacks) {

        this.root = options.root || '#textEditor';
        this.text = options.text || '#textContainer';
        
        this._slideout = document.querySelector( this.root );

        var pageText = document.querySelector( this.text );
        var editorText = document.querySelector( this.root + ' .text' );
        editorText.value = pageText.textContent;

        var apply = document.querySelector( this.root + ' .apply' );
        apply.addEventListener( 'click', function () {
            pageText.textContent = editorText.value;
            if (callbacks.splitText)
                callbacks.splitText();
        });
    }

    // Disables editing
    TextEditor.prototype.lock = function () {

        this._slideout.classList.add( 'locked' );
    };

    // Enables editing
    TextEditor.prototype.unlock = function () {
        
        this._slideout.classList.remove( 'locked' );
    };

    app.TextEditor = TextEditor;
    
})( Reading || window );

(function (app) { 'use strict';

    // Text highlighting propagation routine
    // Constructor arguments:
    //      options: {
    //          root:         - selector for the element that contains text for reading
    //          minReadingDuration  - minimum fixation duration to consider the word has been read (ms)
    //      }
    function TextHighlighter(options) {

        this.root = options.root || document.documentElement;
        this.split();
    }

    // Splits the text nodes into words, each in its own span.word element
    TextHighlighter.prototype.split = function () {

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

                var span = document.createElement( 'span' );
                span.classList.add( 'word' );
                span.textContent = word[ 0 ];
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

    // Resets the highlighting 
    TextHighlighter.prototype.reset = function () {

        var currentWord = document.querySelector( '.currentWord' );
        if (currentWord) {
            currentWord.classList.remove( 'currentWord' );
        }
    };

    // Sets the first word highlighted 
    TextHighlighter.prototype.init = function () {

        this.reset();
    };

    // Propagates the highlighing if the focused word is the next after the current
    // Arguments:
    //        word:         - the focused word 
    TextHighlighter.prototype.setFocusedWord = function (word) {

        currentWord = document.querySelector( '.currentWord' );
        if (currentWord != word) {
            if (currentWord) {
                currentWord.classList.remove( 'currentWord' );
            }
            if (word) {
                word.classList.add( 'currentWord' );
            }
        }
    };

    // private

    // export

    app.TextHighlighter = TextHighlighter;
    
})( Reading || window );
