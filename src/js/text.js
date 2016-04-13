(function (app) { 'use strict';

    // Text controller
    // Constructor arguments:
    //      options: {
    //          root:       - ID of the element that stores the text
    //      }
    //      textSplitter:   - text splitter
    function Text(options, textSplitter) {
        
        _textContainer = document.querySelector( options.root || '#textContainer' );
        _textSplitter = textSplitter;

        this.texts = [
            [
                'Matka on ollut pitkä, mutta ihana',
                'Tapasin Lapissa myös joulupukin',
                'Minä luulin, että Lapissa on aina lunta',
                'Mutta ei siellä ollut yhtään lunta'
            ],
            [
                'Pelkäsin, että joulupukki kysyy minulta,',
                'Olenko ollut kiltti.',
                'Mutta ei hän kysynyt.',
                'Joulupukki kysyi, mistä me tulemme.'
            ],
            [
                'Minä ymmärsin heti, että nyt piti lähteä.',
                'Seuraavaksi joulupukin luo meni',
                'Kaksi japanilaista tyttöä'
            ]
        ];

        this.spacings = ['x-small', 'small', 'median', 'large', 'x-large'];
    }

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

        _textSplitter.split();
    };

    Text.prototype.switchSpacing = function (index) {
        _spacingIndex = index;
        _textContainer.className = this.spacings[ _spacingIndex ];
    };

    Text.prototype.getCurrentTextIndex = function () {
        return _textIndex;
    };

    Text.prototype.getCurrentSpacingIndex = function () {
        return _spacingIndex;
    };

    Text.prototype.features = function () {
        return {
            text: _textIndex,
            lineSize: _spacingIndex
        };
    };

    var _textContainer;
    var _textSplitter;
    var _textIndex = 0;
    var _spacingIndex = 0;

    app.Text = Text;
    
})( Reading || window );
