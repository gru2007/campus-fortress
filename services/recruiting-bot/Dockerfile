FROM golang:1.26-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/recruiting-bot .

FROM alpine:3.23
RUN apk add --no-cache ca-certificates && addgroup -g 10001 bot && adduser -D -u 10001 -G bot bot && mkdir /data && chown bot:bot /data
COPY --from=build /out/recruiting-bot /usr/local/bin/recruiting-bot
USER bot
WORKDIR /data
EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/recruiting-bot"]
