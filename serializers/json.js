var json = function (options) {
    options = options || {};
    return {
        serialize: function (data, extra, localOptions, callback) {
            localOptions = localOptions || {};
            var replacer = localOptions.replacer || options.replacer;
            if(replacer) {
                data = JSON.stringify(data, replacer)
                extra = JSON.stringify(extra, replacer)
            } else {
                data = JSON.stringify(data)
                extra = JSON.stringify(extra)
            }
            callback(null, data, extra);
        }, deserialize: function (data, extra, localOptions, callback) {
            localOptions = localOptions || {};
            var reviver = localOptions.reviver || options.reviver;
            if(reviver) {
                data = JSON.parse(data, reviver)
                extra = JSON.parse(extra, reviver)
            } else {
                data = JSON.parse(data)
                extra = JSON.parse(extra)
            }
            callback(null, data, extra);
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