# Publicar o Revisa na VPS

Este roteiro usa o Nginx e o Certbot que já rodam em `/root/projects/nginx`, o subdomínio **`revisa.pvss.dev.br`** e o deploy via GitHub Actions. O PostgreSQL 18 sobe junto com a aplicação no Compose do Revisa. O certificado e o bloco HTTPS já foram configurados na VPS; a seção 3 fica como referência para reinstalações.

## 1. Confira a rede do Nginx

Na VPS, confirme a rede Docker do Nginx:

```bash
docker inspect nginx --format '{{range $name, $_ := .NetworkSettings.Networks}}{{println $name}}{{end}}'
```

A rede informada na VPS é `nginx_local-net`. Use esse valor em `PROXY_NETWORK`. O Compose cria uma rede privada para a comunicação entre aplicação e banco; nenhuma porta do PostgreSQL é publicada.

## 2. Deixe o GitHub preparar a aplicação

Assim como no projeto transcriptor, use `VPS_USER=root` e um diretório em `/root/projects`. O workflow cria `/root/projects/revisa` automaticamente; você não precisa enviar arquivos do aplicativo por SCP.

No primeiro deploy, o script gera uma senha aleatória na própria VPS e grava `/root/projects/revisa/.env.production` com permissão `600`. Nos deploys seguintes ele lê e preserva essa senha. O Compose cria o banco `revisa`, o usuário `revisa` e o volume `revisa_postgres_data`. A aplicação acessa o banco pela rede privada `db`.

Guarde uma cópia segura de `.env.production` junto dos backups do banco. Se o volume `revisa_postgres_data` existir mas esse arquivo desaparecer, o workflow interrompe o deploy em vez de gerar outra senha incompatível.

## 3. Nginx e certificado (já concluídos)

O certificado do novo subdomínio precisa existir **antes** de ativar o bloco HTTPS. O anexo mostra o Nginx em `/root/projects/nginx`; para essa instalação, use o acesso `root` ao copiar a configuração e executar os comandos desta etapa. No computador local, envie primeiro a configuração HTTP:

```bash
scp deploy/revisa.http.conf.example root@IP_DA_VPS:/root/projects/nginx/conf.d/revisa.conf
```

Na VPS:

```bash
docker exec nginx nginx -t
docker exec nginx nginx -s reload
cd /root/projects/nginx
docker compose run --rm --entrypoint certbot certbot certonly --webroot -w /var/www/certbot -d revisa.pvss.dev.br --email SEU_EMAIL --agree-tos --no-eff-email
```

O Certbot já compartilha `./certbot/www` com o Nginx para o desafio HTTP e `./certbot/conf` para os certificados. Confirme que a emissão terminou com sucesso. Agora, no computador local, substitua o arquivo HTTP pelo bloco HTTPS:

```bash
scp deploy/revisa.https.conf.example root@IP_DA_VPS:/root/projects/nginx/conf.d/revisa.conf
```

Na VPS, valide antes de recarregar:

```bash
docker exec nginx nginx -t
docker exec nginx nginx -s reload
```

Esse bloco resolve `revisa-app` pelo DNS interno do Docker, então o Nginx pode iniciar mesmo antes do primeiro deploy. Após renovações do Certbot, recarregue o Nginx para ele ler o certificado renovado. O loop de renovação presente no Compose anexado não faz esse recarregamento; configure um reload diário no agendador da VPS, por exemplo `docker exec nginx nginx -s reload`.

## 4. Configure o repositório e o GitHub Actions

Crie um repositório GitHub vazio. Antes do primeiro push, crie nele o ambiente **production** e adicione:

| Tipo | Nome | Valor |
| --- | --- | --- |
| Variable | `VPS_USER` | `root` |
| Variable | `VPS_APP_DIR` | `/root/projects/revisa` |
| Secret | `VPS_HOST` | mesmo IP ou hostname usado pelo transcriptor |
| Secret | `VPS_SSH_KEY` | chave privada SSH autorizada para `root` na VPS |
| Variable opcional | `PROXY_NETWORK` | `nginx_local-net` é o padrão já configurado |
| Secret opcional | `VPS_PORT` | porta SSH, se diferente de 22 |
| Secret opcional | `VPS_SSH_FINGERPRINT` | fingerprint do host SSH |

A chave pública correspondente precisa estar em `~/.ssh/authorized_keys` do usuário SSH na VPS. Coloque **o conteúdo desta pasta na raiz** do repositório; os arquivos `.github/workflows/` precisam estar nessa raiz. O projeto anexado não tem um repositório Git inicializado. Na pasta local do Revisa:

```bash
git init -b main
git add .
git status --short
git commit -m "Preparar Revisa para produção"
git remote add origin URL_DO_REPOSITORIO
git push -u origin main
```

Confira o que `git status --short` selecionou antes do commit; `.env`, `.env.production` e backups não devem entrar no repositório. O primeiro push para `main` executa testes e build, publica a imagem no GHCR e roda o deploy. O workflow prepara `/root/projects/revisa`, gera `.env.production`, envia `docker-compose.yml`, faz login temporário no GHCR, baixa a imagem, inicia o PostgreSQL e o aplicativo e espera o estado `healthy`. O código da aplicação está na imagem; não é necessário clonar o repositório na VPS.

## 5. Verifique a publicação

Na VPS:

```bash
cd /root/projects/revisa
docker compose --env-file .env.production -f docker-compose.yml config --quiet
docker compose --env-file .env.production -f docker-compose.yml ps
docker compose --env-file .env.production -f docker-compose.yml logs --tail=100 db app
```

Os serviços `db` e `app` devem ficar `healthy`. Abra `https://revisa.pvss.dev.br/api/health`; a resposta esperada é `{"ok":true}`. Depois teste cadastro, login e importação da planilha no domínio. Se houver erro de banco, confira a senha e os logs de `db`. Se houver erro 502, confira `PROXY_NETWORK`, o alias `revisa-app` e se `app` está `healthy`.

## Atualizações, retorno e dados

Cada push para `main` publica uma imagem identificada pelo commit e a implanta. Para voltar a uma versão, execute manualmente **Actions → Deploy**, informando `sha-` seguido do hash completo do commit anterior. O script tenta restaurar a imagem anterior se a nova não ficar saudável. Migrações do banco não são desfeitas no retorno; faça backup antes de mudanças de esquema.

O banco fica no volume nomeado `revisa_postgres_data`. Não execute `docker compose down -v`, pois isso remove o volume. Inclua o banco `revisa` na sua rotina de backups, por exemplo:

```bash
docker compose --env-file .env.production -f docker-compose.yml exec -T db pg_dump -U revisa -Fc revisa > revisa.dump
```

Guarde o arquivo de backup fora da VPS também. O aplicativo não oferece recuperação de senha por e-mail; cadastros públicos devem ser acompanhados de monitoramento e política de senhas adequada.
