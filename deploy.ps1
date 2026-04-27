# Script para automatizar o build, push e deploy em produção
Write-Host "0. Compilando Tailwind CSS..."
pushd static; npx @tailwindcss/cli -i input.css -o output.css --minify; popd

Write-Host "1. Realizando build da imagem Docker..."
docker build -t marcospedro2/nvisagrada:latest .

if ($?) {
    Write-Host "2. Enviando imagem para o Docker Hub..."
    docker push marcospedro2/nvisagrada:latest

    if ($?) {
        Write-Host "3. Disparando webhook de deploy em produção (Portainer)..."
        try {
            $response = Invoke-RestMethod -Uri "https://pt.chatgenios.com.br/api/stacks/webhooks/8bc43be1-fcf5-4ba2-8560-22f4188a534f?PullImage=true" -Method Post
            Write-Host "Deploy disparado com sucesso!"
        } catch {
            Write-Host "Erro ao disparar o webhook: $_" -ForegroundColor Red
        }
    } else {
        Write-Host "Falha ao fazer o push da imagem." -ForegroundColor Red
    }
} else {
    Write-Host "Falha no build da imagem." -ForegroundColor Red
}
