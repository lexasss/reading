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

    // Path display routine
    // Constructor arguments:
    //      options: {
    //          root:         - selector for the element that contains statistics view
    //      }
    function Path(options) {

        this.root = options.root || document.documentElement;

        _view = document.querySelector( this.root );
        _view.style.display = 'none';

        _canvas = document.querySelector( this.root + ' canvas');

        var self = this;

        var load = document.querySelector('.loadPath' );
        load.addEventListener('click', function () {
            self._load();
        });

        var close = document.querySelector( this.root + ' .close' );
        close.addEventListener('click', function () {
            _view.style.display = 'none';
        });
    }

    Path.prototype._load = function () {
        var name = prompt( 'Please enter the name', '' );
        if (name) {
            var self = this;
            app.firebase.once('value', function(snapshot) {
                if (snapshot.exists()) {
                    var b = snapshot.child(name);
                    if (b.exists()) {
                        self._show(b);
                    } else {
                        alert('record ' + name + ' does not exist');
                    }
                } else {
                    alert('no records in DB');
                }
            }, function (err) {
                alert(err);
            });
        }
    };

    Path.prototype._show = function (data) {
        _view.style.display = 'block';
        var record = data.val();
        if (record && record.fixations) {

            var fixations = record.fixations;
            
            var canvasWidth = parseInt( window.getComputedStyle( _canvas ).width );
            var canvasHeight = parseInt( window.getComputedStyle( _canvas ).height );
            _canvas.setAttribute( 'width',  canvasWidth );
            _canvas.setAttribute( 'height', canvasHeight );

            var ctx = _canvas.getContext('2d');

            ctx.clearRect(0, 0, canvasWidth, canvasHeight);
            ctx.fillStyle = "#FF0000";

            for (var i = 0; i < fixations.length; i += 1) {
                this._drawFixation( ctx, fixations[i] );
            }
        }
    };

    Path.prototype._drawFixation = function (ctx, fixation) {
        ctx.beginPath();
        ctx.arc( fixation.x, fixation.y, fixation.duration / 30, 0, 2*Math.PI);
        ctx.fill();
    };

    var _view;
    var _canvas;

    app.Path = Path;
    
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
            var record = _map.get(_currentWord);
            if (record) {
                record.stop();
            }
        }

        var text = Record.getHeader() + '\n';

        _map.forEach(function (record) {
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
        _map.clear();
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

    // Logs fixation
    Statistics.prototype.logFixation = function (fixation) {
        _fixations.push(new Fixation(fixation));
    };

    // private
    Statistics.prototype._saveLocal = function () {
        var textToWrite = document.querySelector( this.root + ' textarea' ).value;
        var textFileAsBlob = new Blob([textToWrite], {type: 'text/plain'});
        
        var downloadLink = document.createElement("a");
        downloadLink.download = 'results.txt';
        downloadLink.innerHTML = 'Download File';

        var URL = window.URL || window.webkitURL;
        downloadLink.href = URL.createObjectURL( textFileAsBlob );
        downloadLink.onclick = function(event) { // self-destrly
            document.body.removeChild(event.target);
        };
        downloadLink.style.display = 'none';
        document.body.appendChild( downloadLink );

        downloadLink.click();
    }

    Statistics.prototype._saveRemote = function () {
        var name = prompt( 'Please enter the name', GUID() );
        if (name) {
            var record = app.firebase.child( name );
            record.set({
                fixations: _fixationsFiltered
            });
        }
    }

    // private
    var _view;
    var _currentWord = null;
    var _map = new Map();
    var _fixations = [];
    var _fixationsFiltered = [];

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

    function GUID() {
        return Math.random().toString(36).substring(2, 15) +
            Math.random().toString(36).substring(2, 15);
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

        var currentWord = document.querySelector( '.currentWord' );
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
