(function (app) { 'use strict';

    // Controller for the text options side-slider
    // Constructor arguments:
    //      options: {
    //          root:   - slideout element ID
    //          text:   - full text selector
    //      }
    //      services: {
    //          isShowingPointer ()     - provides gaze pointer visibility info
    //          isHighlighingWords ()   - provides word highlighting info
    //      }
    //      callbacks: {
    //          showPointer (bool)      - gaze point visibility must be changed
    //          highlightWord (bool)    - word highlighting must be changed
    //      }
    function Options(options, services, callbacks) {

        this.root = options.root || '#options';
        
        this._slideout = document.querySelector( this.root );

        _services = services;
        _services.isShowingPointer = _services.isShowingPointer || console.error( 'No "isShowingPointer" service for Options' );
        _services.isHighlighingWords = _services.isHighlighingWords || console.error( 'No "isHighlighingWords" service for Options' );

        _callbacks = callbacks;
        
        var cssRules = [
            { name: 'color', type: 'color', cssrule: options.text, id: 'text', prefix: '#', suffix: '' },
            { name: 'color', type: 'color', cssrule: options.text + ' .currentWord', id: 'currentWord', prefix: '#', suffix: '' },
            { name: 'font-size', type: 'string', cssrule: options.text, id: 'fontSize', prefix: '', suffix: '' },
            //{ name: 'line-height', type: 'string', cssrule: options.text, id: 'lineHeight', prefix: '', suffix: '' },
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

        bindSettingsToEditors( this.root );

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

    var _services;
    var _callbacks;

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
                rule.editor.value = rule.initial;  //color.fromString( rule.initial );
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
                rule.value = rule.editor.value; //'#' + rule.editor.color;
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
                rule.editor.value = rule.value;//color.fromString( rules.value );
            }
            else if (rule.type === 'string') {
                rule.editor.value = rule.value;
            }
        }
    }

    function bindSettingsToEditors(root) {
        var showPointer = document.querySelector( root + ' #showPointer' );
        showPointer.checked = _services.isShowingPointer();
        showPointer.addEventListener( 'click', function (e) {
            if (_callbacks.showPointer) {
                _callbacks.showPointer( this.checked );
            }
        });
        
        var hiliteWord = document.querySelector( root + ' #hiliteWord' );
        hiliteWord.checked = _services.isHighlighingWords();
        hiliteWord.addEventListener( 'click', function (e) {
            if (_callbacks.highlightWord) {
                _callbacks.highlightWord( this.checked );
            }
        });

    }

    app.Options = Options;
    
})( Reading || window );
