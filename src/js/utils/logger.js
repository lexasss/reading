(function (app) {

    var Logger = { };

    Logger.moduleErrorPrinter = (moduleName) => {
        if (this.Reading !== undefined) {
            return () => { };
        }
        
        return (missingService) => {
            console.error( 'Missing "${missingService}" service for "${moduleName}"' );
        };
    };

    Logger.moduleLogPrinter = (moduleName) => {
        var print = (item) => {
            console.log( item );
        };

        if (this.Reading !== undefined) {
            return () => { };
        }

        return (title) => {
            console.log( '\n', moduleName );
            console.log( title );
            for (var i = 1; i < arguments.length; i += 1) {
                var data = arguments[i];
                if (data === undefined) {
                    continue;
                }
                if (data instanceof Array) {
                    data.forEach( print );
                }
                else {
                    console.log( data );
                }
            }
        };
    };

    Logger.forModule = (moduleName) => {
        var print = (item) => {
            console.log( item );
        };

        if (this.Reading !== undefined) {
            return () => { };
        }

        return {
            start: (title) => {
                return new Record( title );
            },
            end: (record) => {
                console.log( '\n', moduleName );
                record.print();
                records.delete( record.id );
            } 
        };
    };

    function Record (title) {
        this.id = Symbol( title );
        this._record = title ? [ title ] : [];
        records.set( this.id, this );
    }

    Record.prototype.push = function () {
        this._record.push( Array.prototype.join.call( arguments, ' ' ) );
    }

    Record.prototype.print = function () {
        console.log( '    ' + this._record.join( '\n    ' ) );
    }

    var records = new Map();

    app.Logger = Logger;

})( this.Reading || module.exports );