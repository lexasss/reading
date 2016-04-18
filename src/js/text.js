(function (app) { 'use strict';

    // Text controller
    // Constructor arguments:
    //      options: {
    //          root:       - ID of the element that stores the text
    //      }
    //      services: {
    //          splitText ()        - service to split the updated text
    //      }
    function Text(options, services) {

        this.root = options.root || '#textContainer';
        _services = services;

        _services.splitText = _services.splitText || console.error( 'No "splitText" service for Text' );

        _textContainer = document.querySelector( this.root );
        
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
                'Kaksi japanilaista tyttöä',
                'Joulupukki osasi puhua heille japania,',
				'Japanilaiset ottivat minusta monta valokuvaa,',
				'Ehkä minä olen nyt kuuluisa kissa Japanissa.'

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

        _services.splitText();
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

    Text.prototype.show = function(first_argument) {
        _textContainer.classList.remove( 'invisible' );
    };

    Text.prototype.hide = function(first_argument) {
        _textContainer.classList.add( 'invisible' );
    };

    Text.prototype.getSetup = function () {
        return {
            textID: _textIndex,
            lineSize: _spacingIndex
        };
    };

    var _textContainer;
    var _services;
    var _textIndex = 0;
    var _spacingIndex = 0;

    app.Text = Text;
    
})( Reading || window );
