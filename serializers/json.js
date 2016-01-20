var json = function (options) {
    options = options || {};
    return {
        serialize: function (data, localOptions, callback) {
            localOptions = localOptions || {};
            var replacer = localOptions.replacer || options.replacer;
            if(replacer) {
                data = JSON.stringify(data, replacer)
            } else {
                data = JSON.stringify(data)
            }
            callback(null, data);
        }, deserialize: function (data, localOptions, callback) {
            localOptions = localOptions || {};
            var reviver = localOptions.reviver || options.reviver;
            if(reviver) {
                data = JSON.parse(data, reviver)
            } else {
                data = JSON.parse(data)
            }
            callback(null, data);
        },

    }
}

exports.json = json;
exports.revivers = {
    ISODate: function (name, value) {
        if(typeof value === "string" && /^\d\d\d\d-\d\d-\d\dT\d\d:\d\d:\d\d.\d\d\dZ$/.test(value)) {
            return new Date(value);
        }
        return value;
    }
}