.PHONY: build test run stop smoke

build:
	cd agent && go build -o ../bin/gradient-agent ./cmd/gradient-agent
	cd simulator && python -m pip install -r requirements.txt
	cd dashboard && npm install && npm run build

test:
	cd agent && go test ./...
	cd simulator && python -m py_compile simulator.py

smoke:
	./scripts_smoke_test.sh

run:
	docker compose up --build

stop:
	docker compose down
