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
