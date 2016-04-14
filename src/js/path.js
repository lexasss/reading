(function (app) { 'use strict';

    // Path display routine
    // Constructor arguments:
    //      options: {
    //          root:         - selector for the element that contains statistics view
    //      }
    //      callbacks: {
    //          shown:       - the path overlay was displayed
    //          hidden:       - the path overlay was hidden
    //      }
    function Path(options, callbacks) {

        this.root = options.root || document.documentElement;

        _view = document.querySelector( this.root );
        _canvas = document.querySelector( this.root + ' canvas');
        _sessionPrompt = document.querySelector( this.root + ' .prompt' );

        _view.classList.add( 'invisible' );
        _sessionPrompt.classList.add( 'invisible' );

        var self = this;

        var load = document.querySelector('.loadPath' );
        load.addEventListener('click', function () {
            self._select();
            if (callbacks.shown) {
                callbacks.shown();
            }
        });

        var close = document.querySelector( this.root + ' .close' );
        close.addEventListener('click', function () {
            _view.classList.add( 'invisible' );
            if (callbacks.hidden) {
                callbacks.hidden();
            }
        });

        var select = document.querySelector( this.root + ' .select' );
        select.addEventListener('click', function () {
            var list = document.querySelector( 'select', _sessionPrompt );
            self._load( list.options[ list.selectedIndex ].value );
        });
    }

    Path.prototype._select = function () {
        app.firebase.once('value', function (snapshot) {
            if (snapshot.exists()) {

                _snapshot = snapshot;
                _view.classList.remove( 'invisible' );

                var list = document.querySelector( 'select', _sessionPrompt );
                list.innerHTML = '';
                snapshot.forEach( function (childSnapshot) {
                    var option = document.createElement('option');
                    option.value = childSnapshot.key();
                    option.textContent = childSnapshot.key();
                    list.appendChild( option );
                    //var childData = childSnapshot.val();
                });

                _sessionPrompt.classList.remove( 'invisible' );
            } else {
                alert('no records in DB');
            }
        }, function (err) {
            alert(err);
        });
    };

    Path.prototype._load = function( name ) {
        if (!_snapshot) {
            return;
        }

        _sessionPrompt.classList.add( 'invisible' );
        
        var session = _snapshot.child( name );
        if (session && session.exists()) {
            this._show( session.val() );
        } else {
            alert('record ' + name + ' does not exist');
        }

        _snapshot = null;
    };

    Path.prototype._show = function (session) {
        if (!session) {
            return;
        }

        var ctx = getCanvas2D();

        if (session.words) {
            var words = session.words;
            for (var i = 0; i < words.length; i += 1) {
                this._drawWord( ctx, words[i] );
            }
        }

        if (session.fixations) {
            var fixations = session.fixations;
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

    Path.prototype._drawWord = function (ctx, word) {
        ctx.strokeRect( word.x, word.y, word.width, word.height);
    };

    var _view;
    var _canvas;
    var _sessionPrompt;
    var _snapshot;

    function getCanvas2D() {
        var canvasWidth = parseInt( window.getComputedStyle( _canvas ).width );
        var canvasHeight = parseInt( window.getComputedStyle( _canvas ).height );
        _canvas.setAttribute( 'width',  canvasWidth );
        _canvas.setAttribute( 'height', canvasHeight );

        var ctx = _canvas.getContext('2d');

        ctx.clearRect(0, 0, canvasWidth, canvasHeight);

        ctx.fillStyle = '#0000FF';
        ctx.strokeStyle = '#FF0000';

        return ctx;
    }

    app.Path = Path;
    
})( Reading || window );
