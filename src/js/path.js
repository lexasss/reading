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
