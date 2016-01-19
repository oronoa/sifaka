/*global suite, test, suiteSetup, suiteTeardown, setup, Object, Array */

var Backend = require("../../backends/inmemory-test");

var should = require('should');
suite('InMemoryTest Backend', function () {
    suiteSetup(function (done) {
        done();
    });

    suiteTeardown(function (done) {
        done();
    });

    setup(function (done) {
        done();
    });

    test('should contain a get method', function (done) {
        var b = new Backend();
        // First check the data isn't in the backend, and don't claim the lock, as we're not intending to do any work
        b.get("abc", {noLock: true}, function (err, data, status) {
            should.exist(status);
            status.should.have.property("hit", false);
            status.should.have.property("locked", false);
            status.should.have.property("ownLock", false);
            // Now set the data in the cache
            b.store("abc", 123,null,  {}, function (err, success) {
                // Try a get again, this time claiming the global lock
                b.get("abc", {}, function (err, data, status) {
                    should.exist(status);
                    status.should.have.property("hit", true);
                    status.should.have.property("locked", false);
                    status.should.have.property("ownLock", false);
                    should.exist(data);
                    data.should.equal(123);
                    done();
                });
            });
        });
    });

    var sharedTests = require("./common_tests")();
    var runTest = function(testName, tst){
        test(testName, function (done) {
            var testFn = tst.bind(this);
            var b = new Backend();
            return testFn(b, done)
        });
    }

    for(var testName in sharedTests) {
       runTest(testName, sharedTests[testName]);
    }

});








