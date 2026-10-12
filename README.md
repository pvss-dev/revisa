# Revisa

Aplicação de revisão espaçada baseada na planilha fornecida. Permite cadastro e login, agenda de revisões, acompanhamento de questões e acertos, provas e importação da planilha original. Os intervalos de revisão podem ser ajustados para a conta inteira ou para um assunto específico.

## Desenvolvimento

É necessário um PostgreSQL acessível. Crie `.env` com `DATABASE_URL` apontando para um banco de desenvolvimento vazio (veja `.env.example`) e execute:

```bash
npm ci
npm run dev
```

O comando de desenvolvimento aplica as migrações Prisma antes de iniciar. Abra `http://localhost:3000`. Para conferir as regras e a compilação: `npm run check` e `npm run build`. Mudanças futuras no modelo ficam em `prisma/schema.prisma` e devem gerar uma nova migração com `npx prisma migrate dev --name nome_da_mudanca`.

## Estilos

O projeto usa Tailwind CSS 4 com o plugin PostCSS. As utilidades ficam nas classes JSX, e as cores compartilhadas estão em `@theme` no `app/globals.css`. Estilos específicos do aplicativo continuam no mesmo arquivo, na camada `components`. O Preflight do Tailwind não é importado para preservar os estilos de base já existentes durante a migração.

## Produção

O arquivo `docker-compose.yml` é exclusivo da produção: sobe a aplicação e um PostgreSQL 18 dedicado no mesmo projeto, usa a rede existente do Nginx e não publica as portas 3000 ou 5432 na VPS. Os dados do banco ficam no volume nomeado `revisa_prisma_postgres_data`. A imagem da aplicação é publicada no GitHub Container Registry.

O passo a passo adaptado à VPS e ao Nginx fornecidos está em [deploy/PRODUCAO.md](deploy/PRODUCAO.md). O GitHub Actions executa CI, publica a imagem e faz o deploy por SSH. O Prisma aplica as migrações na inicialização e a aplicação oferece `/api/health` para verificação. O primeiro deploy com Prisma usa o novo volume `revisa_prisma_postgres_data`, começando com um banco vazio conforme autorizado.

## Google Calendar

A integração usa OAuth 2.0 no servidor e a API oficial do Google Calendar. Cada etapa de revisão recebe um identificador determinístico e também é mapeada no PostgreSQL, evitando eventos duplicados mesmo após uma nova tentativa. Operações que falham ficam em uma fila persistente e podem ser repetidas em **Meu perfil → Google Calendar**.

No Google Cloud Console, habilite a **Google Calendar API**, configure a tela de consentimento e crie um cliente OAuth do tipo **Aplicativo da Web**. Cadastre exatamente esta URI de redirecionamento:

```text
https://revisa.pvss.dev.br/api/integrations/google/callback
```

No ambiente `production` do repositório, adicione os secrets `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` e `GOOGLE_TOKEN_ENCRYPTION_KEY`. Gere a chave de criptografia uma única vez com `openssl rand -base64 32`. Adicione também a variable `GOOGLE_REDIRECT_URI` com a URI acima. O workflow grava e preserva esses valores no `.env.production` da VPS.

## Regras da planilha

- A aba **CONCURSOS** importa disciplina, assunto, datas, prioridade e resultados concluídos de `Q0` a `Q4`.
- As datas de revisão são calculadas a partir da data das primeiras questões. Mudar essa data ou os intervalos recalcula as revisões planejadas sem apagar resultados já concluídos.
- A planilha não registra a data real de execução das revisões importadas. Esses resultados são marcados como importados, e a data real pode ser preenchida depois.
- A aba **PROVAS NA ÍNTEGRA** contém apenas uma grade vazia. As respostas das provas são registradas no aplicativo.
- A mesma planilha não é importada duas vezes na mesma conta.
