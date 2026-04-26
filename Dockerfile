FROM golang:alpine AS builder

WORKDIR /app

# Copia arquivos de dependência
COPY go.mod go.sum ./
RUN go mod download

# Copia todo o código e pastas do projeto
COPY . .

# Compila o binário do servidor de forma estática (CGO_ENABLED=0)
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o minhabiblia-server ./cmd/server

# Imagem final minúscula e segura
FROM alpine:latest
RUN apk --no-cache add ca-certificates tzdata

WORKDIR /app

# Copia o binário e as pastas essenciais do builder
COPY --from=builder /app/minhabiblia-server .
COPY --from=builder /app/static ./static
COPY --from=builder /app/db ./db

# Define as variáveis de ambiente internamente para o container
ENV PORT=8080
ENV DB_PATH=/app/db/biblia.db
ENV STATIC_PATH=/app/static

# Expõe a porta do container
EXPOSE 8080

# Inicia o servidor
CMD ["./minhabiblia-server"]
