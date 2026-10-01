# Publicação no Easypanel

Serviço publicado: `icom/experiencia-icom`.

- Repositório: `icomkids/icomkids-icon-kids-programa-`.
- Branch: `experiencia-icom`.
- Build Path: `/experiencia-icom`.
- Builder: Dockerfile; arquivo `Dockerfile`.
- Porta interna: `3000`.
- Domínio: `sistema.icomkids.com.br`, caminho e destino `/experiencia-icom`.
- Next.js basePath: `/experiencia-icom`.

O Dockerfile usa Node.js 24, pnpm 11.19.0 e lockfile congelado. Executa verificações e build standalone; inicia `node server.js` com usuário `node`.

## Ambiente em runtime

```env
PORT=3000
HOSTNAME=0.0.0.0
APP_URL=https://sistema.icomkids.com.br
SUPABASE_URL=https://swsfwthjxtqtkloexyjs.supabase.co
SUPABASE_SERVICE_ROLE_KEY=CONFIGURAR_SOMENTE_NO_EASYPANEL
```

Não usar build arguments ou NEXT_PUBLIC_ para a chave secreta. Não colocar valores secretos no GitHub.

## Supabase

Usa o projeto existente IcomKids. Migration inicial já aplicada; não reaplicar. Novas mudanças de banco devem ser migrations incrementais revisadas. O deploy Docker não aplica migrations automaticamente.

Supabase Auth usa o SMTP Resend existente. Redirect de recuperação: `https://sistema.icomkids.com.br/experiencia-icom/recuperar-senha`, coberto pela allowlist existente do domínio.

## Operação e validação

Deploy manual pelo serviço após atualizar a branch. Último build passou com TypeScript e 12 testes. Pesquisa DEMO concluída com persistência e alerta crítico confirmados. Falta validação do painel autenticado com a conta do usuário e confirmação da entrega do e-mail.

Verificar logs e abertura de `/experiencia-icom/admin/experiencia` após mudanças. Testar QR Code, CSV e permissões com usuários apropriados antes do uso real.
