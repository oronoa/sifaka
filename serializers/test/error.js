var error = function (options) {
    options = options || {};
    return {
        serialize: function (data, extra, localOptions, callback) {
            var err = new Error("Failed to serialize");
            callback(err, null, extra);
        }, deserialize: function (data, extra, localOptions, callback) {
            callback(null, data, extra);
        },

    }
}
exports.error = error;
