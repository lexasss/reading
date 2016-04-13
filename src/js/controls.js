(function (app) { 'use strict';

    // Initializes and sets callbacks for the app controls
    // Constructor arguments:
    //      options: {
    //          root:   - controls container element ID
    //      }
    //      text:       - text controller
    function Controls(options, text) {
        this.root = options.root || document.documentElement;

        var container = document.querySelector( this.root );

        _device = document.querySelector( this.root + ' .device' );
        
        _options = document.querySelector( this.root + ' .options' );
        _options.addEventListener('click', function () {
            GazeTargets.ETUDriver.showOptions();
        });

        _calibrate = document.querySelector( this.root + ' .calibrate' );
        _calibrate.addEventListener('click', function () {
            GazeTargets.ETUDriver.calibrate();
        });

        _toggle = document.querySelector( this.root + ' .toggle' );
        _toggle.addEventListener('click', function () {
            GazeTargets.ETUDriver.toggleTracking();
        });

        _textSwitchers = document.querySelector( this.root + ' .text' );
        for (var i = 0; i < text.texts.length; i += 1) {
            var swither = document.createElement('div');
            swither.className = 'button';
            swither.textContent = 'Text ' + (i + 1);
            swither.addEventListener('click', getTextSwitcherHandler( text, i ));
            if (i === 0) {
                swither.classList.add('selected');
            }
            _textSwitchers.appendChild( swither );
        }

        _spacingSwitchers = document.querySelector( this.root + ' .spacing' );
        for (var i = 0; i < text.spacings.length; i += 1) {
            var swither = document.createElement('div');
            swither.className = 'button';
            swither.textContent = text.spacings[ i ];
            swither.addEventListener('click', getSpacingSwitcherHandler( text, i ));
            if (i === 0) {
                swither.classList.add('selected');
            }
            _spacingSwitchers.appendChild( swither );
        }

        _connectionTimeout = setTimeout(function () {
            _device.textContent = 'Disconnected';
        }, 3000);
        
        text.switchText(0);
        text.switchSpacing(0);
    }

    Controls.prototype.onStateUpdated = function (state) {
        if (state.device) {
            _device.textContent = state.device;
            clearTimeout( _connectionTimeout );
        } 
        else if (!state.isConnected) {
            _device.textContent = 'Disconnected';
        }

        setDisabled( _options, !state.isServiceRunning || state.isTracking || state.isBusy);
        setDisabled( _calibrate, !state.isConnected || state.isTracking || state.isBusy);
        setDisabled( _toggle, !state.isCalibrated || state.isBusy);

        _toggle.textContent = state.isTracking ? 'Stop' : 'Start';
    };

    // private

    function setDisabled(button, disabled) {
        if (disabled) {
            button.classList.add('disabled');
        } else {
            button.classList.remove('disabled');
        }
    };

    function getTextSwitcherHandler(text, index) {
        return function () { 
            text.switchText( index );
            select(this, _textSwitchers);
        }
    };

    function getSpacingSwitcherHandler(text, index) {
        return function () { 
            text.switchSpacing( index );
            select(this, _spacingSwitchers);
        }
    };

    function select(button, container) {
        var switches = container.childNodes;
        for (var i = 0; i < switches.length; i += 1) {
            switches.item(i).classList.remove('selected');
        }
        button.classList.add('selected');
    }

    var _device;
    var _options;
    var _calibrate;
    var _toggle;

    var _textSwitchers;
    var _spacingSwitchers;
    
    var _connectionTimeout;

    app.Controls = Controls;
    
})( Reading || window );
