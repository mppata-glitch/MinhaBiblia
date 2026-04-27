# MinhaBiblia PWA (Multi-Versões)

Uma aplicação progressiva (PWA) rápida, moderna e focada no uso offline para leitura da Bíblia Sagrada (NVI, NVT, KJV).

![MinhaBiblia Screenshot](https://raw.githubusercontent.com/mppata-glitch/MinhaBiblia/master/static/favicon.svg)

## 🚀 Funcionalidades

- **Múltiplas Versões**: Suporte para NVI (Nova Versão Internacional), NVT (Nova Versão Transformadora) e KJV (King James Version).
- **Acesso Offline**: Funciona sem internet através de Service Workers.
- **Busca Avançada**: Pesquisa rápida por livros e versículos com suporte a termos fonéticos.
- **Leitura Contínua**: Scroll infinito para transições suaves entre capítulos.
- **Modo Escuro**: Interface adaptativa com suporte a temas dark/light.
- **Design Moderno**: Construído com Tailwind CSS v4 para máximo desempenho visual.
- **Analytics**: Integração com Google Analytics para estatísticas de uso.

## 🛠️ Technologies

- **Backend**: Go (Golang)
- **Database**: SQLite (modernc.org/sqlite - pure Go)
- **Frontend**: Vanilla JS (ES6+), HTML5, Tailwind CSS v4
- **Deployment**: Docker, Docker Swarm, Portainer Webhooks

## 📦 How to run locally

1. Clone the repository:
   ```bash
   git clone https://github.com/mppata-glitch/MinhaBiblia.git
   cd MinhaBiblia
   git checkout en-version
   ```

2. Configure environment:
   Create a `.env` file based on `.env.example`.

3. Run via Docker:
   ```bash
   docker-compose up -d
   ```
   Access at `http://localhost:8081`.

## ☕ Support the Project

If this project was useful to you and you'd like to help with server expenses and maintenance, feel free to support us with any amount via PIX:

- **Support here**: [Support via PIX (Nubank)](https://nubank.com.br/cobrar/38y8q/69ef5c65-a3f0-49a6-86b6-02a2893ddff5)

Every help is very welcome to keep the Word accessible to everyone!

## 🤝 Credits and Contributions

The Bible data in JSON format used in this project was provided by:
- **Repository**: [thiagobodruk/bible](https://github.com/thiagobodruk/bible)
- **Author**: Thiago Bodruk

## 📄 License

This project is for study and personal use. Please check the license terms of the Bible data in the original repository.

---
Developed by [Chat Gênios](https://www.chatgenios.com.br)
