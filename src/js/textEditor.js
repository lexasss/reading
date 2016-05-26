// Requires:
//      utils/logger

(function (app) { 'use strict';

    // Controller for the text editing side-slider
    // Constructor arguments:
    //      options: {
    //          root:         - slideout element ID
    //          text:         - ID of the element that stores the text to edit
    //      }
    //      services: {
    //          splitText ()        - service to split the updated text
    //      }
    function TextEditor(options, services) {

        this.root = options.root || '#textEditor';
        this.text = options.text || '#text';

        var logError = app.Logger.moduleErrorPrinter( 'TextEditor' );
        services.splitText = services.splitText || logError( 'splitText' );
        
        this._slideout = document.querySelector( this.root );

        var text = document.querySelector( this.text );
        var editorText = document.querySelector( this.root + ' .text' );
        editorText.value = text.textContent;

        var apply = document.querySelector( this.root + ' .apply' );
        apply.addEventListener( 'click', function () {
            text.textContent = editorText.value;
            services.splitText();
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
    
})( this.Reading || module.exports );
