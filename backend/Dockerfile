FROM golang:1.25-alpine AS build

WORKDIR /src
COPY go.mod go.sum* ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /out/pennywise ./cmd/server

FROM alpine:3.22

RUN adduser -D -H pennywise
USER pennywise
WORKDIR /app
COPY --from=build /out/pennywise /app/pennywise

EXPOSE 8080
ENTRYPOINT ["/app/pennywise"]

