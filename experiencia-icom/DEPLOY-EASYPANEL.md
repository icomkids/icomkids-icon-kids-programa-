# Publicação no Easypanel

O destino de hospedagem definido é o Easypanel. Repositório confirmado: `icomkids/icomkids-icon-kids-programa-`. A aplicação fica em `/experiencia-icom` e deve ser publicada como serviço próprio do projeto `icom` no Easypanel. O banco Supabase ainda precisa ser identificado e configurado.

## Antes de publicar

1. Identifique o projeto Supabase pelo link `/dashboard/project/REFERENCIA`, não pelo link da organização.
2. Conecte o Supabase do chat à conta que tem acesso ao projeto. Não compartilhe senhas ou tokens em mensagens.
3. Conecte o GitHub e informe o repositório já associado ao Easypanel.
4. Informe o endereço do painel, nome do projeto, serviço e domínio da aplicação.
5. Analise o banco e o repositório existentes antes de aplicar migrations ou substituir arquivos. A migration inicial deste código pressupõe tabelas novas e não deve ser aplicada sem essa análise.

## Serviço da aplicação

- Fonte: repositório GitHub e branch definidos no serviço existente.
- Build Path: diretório que contém `package.json` e `Dockerfile`.
- Builder: Dockerfile.
- Dockerfile Path: `Dockerfile`.
- Porta interna: `3000`.
- Comando: o Dockerfile inicia `node server.js`; não substitua por `next start` no modo standalone.
- Domínio: o domínio da aplicação deve encaminhar para a porta 3000 com HTTPS.

O Dockerfile usa Node.js 24, pnpm 11.19.0, lockfile congelado e build Next.js standalone. O runner trabalha com usuário `node`, sem root, e inclui arquivos públicos e assets estáticos.

## Variáveis de ambiente do serviço

Defina diretamente no serviço do Easypanel, apenas em runtime:

```env
SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_SERVICE_ROLE_KEY=CHAVE_SECRETA_DO_PROJETO
```

Não use build arguments para segredos. Não envie as chaves por chat, não as coloque no GitHub e não use o prefixo `NEXT_PUBLIC_`.

## Banco e acesso

Aplicar migrations no Supabase é uma etapa explícita, independente do deploy da imagem; não acontece automaticamente no Dockerfile. Após a análise e aplicação, provisionar o primeiro usuário no Supabase Auth e seu registro autorizado em `experience_users`.

## Verificações

O build standalone deve gerar `.next/standalone/server.js`. No Easypanel, verificar logs do build e do serviço, abrir `/experiencia` e `/admin/experiencia`, autenticar o administrador e concluir uma experiência DEMO. Confirmar persistência após reinício, bloqueio de duplicidade, alertas, QR Code, permissões da liderança e separação de dados DEMO.

O host local não tem Docker disponível; a imagem ainda precisa ser construída e verificada no servidor Easypanel. O build Next.js é verificável localmente.

Documentação oficial: https://easypanel.io/docs/builders e https://easypanel.io/docs/services/app.
