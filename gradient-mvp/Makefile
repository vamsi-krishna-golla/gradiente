.PHONY: build test run stop

build:
	cd agent && go build -o ../bin/gradient-agent ./cmd/gradient-agent
	cd dashboard && npm install && npm run build
	cd simulator && pip install -r requirements.txt

test:
	cd agent && go test ./...

run:
	docker compose up --build

stop:
	docker compose down
