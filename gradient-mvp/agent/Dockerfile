FROM golang:1.22-alpine AS build
WORKDIR /app
COPY . .
RUN go mod tidy && go build -o /gradient-agent ./cmd/gradient-agent
FROM alpine:3.20
COPY --from=build /gradient-agent /gradient-agent
ENTRYPOINT ["/gradient-agent"]
