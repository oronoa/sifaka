test:
	./node_modules/mocha/bin/mocha

loadtest:
	@echo "\n\nMake sure you are running the loadtest server script, with the correct options for the backend you wish to test\n\n"
	node ./node_modules/loadtest/bin/loadtest.js -n 5000 -c 20 http://127.0.0.1:8002 --rps 50

.PHONY:	test loadtest
