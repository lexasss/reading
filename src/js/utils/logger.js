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

    app.Logger = Logger;

})( this.Reading || module.exports );