# MinhaBíblia PWA

Uma aplicação web progressiva (PWA) rápida, moderna e offline-first para leitura da Bíblia Sagrada (NVI).

![MinhaBíblia Screenshot](https://raw.githubusercontent.com/mppata-glitch/MinhaBiblia/master/static/favicon.svg) <!-- Você pode substituir por um screenshot real depois -->

## 🚀 Funcionalidades

- **Acesso Offline**: Funciona sem internet através de Service Workers.
- **Busca Avançada**: Pesquisa rápida por livros e versículos (insensível a acentos).
- **Leitura Contínua**: Scroll infinito para transição suave entre capítulos.
- **Modo Escuro**: Interface adaptável com suporte a tema dark/light.
- **Design Moderno**: Construído com Tailwind CSS v4 para máxima performance visual.
- **Analytics**: Integração com Google Analytics via URL Query Parameters para estatísticas precisas.

## 🛠️ Tecnologias

- **Backend**: Go (Golang)
- **Banco de Dados**: SQLite (modernc.org/sqlite - pure Go)
- **Frontend**: Vanilla JS (ES6+), HTML5, Tailwind CSS v4
- **Deploy**: Docker, Docker Swarm, Portainer Webhooks

## 📦 Como rodar localmente

1. Clone o repositório:
   ```bash
   git clone https://github.com/mppata-glitch/MinhaBiblia.git
   cd MinhaBiblia
   ```

2. Configure o ambiente:
   Crie um arquivo `.env` baseado no `.env.example`.

3. Execute via Docker:
   ```bash
   docker-compose up -d
   ```
   Acesse em `http://localhost:8081`.

## 🤝 Créditos e Contribuições

Os dados bíblicos em formato JSON utilizados neste projeto foram gentilmente disponibilizados por:
- **Repositório**: [thiagobodruk/bible](https://github.com/thiagobodruk/bible)
- **Autor**: Thiago Bodruk

## 📄 Licença

Este projeto é para fins de estudo e uso pessoal. Verifique os termos de licença dos dados bíblicos no repositório original.

---
Desenvolvido por [mpp.app.br](https://mpp.app.br)
