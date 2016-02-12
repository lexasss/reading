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
