# DRE Eduarda | Dashboard 2026

Dashboard web responsivo para acompanhar a pasta consolidada de 2026 publicada no Google Sheets.

## Como funciona

- O app carrega o CSV publicado pelo Google Sheets.
- Na Vercel, a rota `api/data.js` busca a planilha e evita bloqueios de CORS no navegador.
- Os filtros, indicadores, graficos e tabela se adaptam automaticamente as colunas da planilha.
- Nao usa Supabase nesta primeira versao, porque a fonte atual ja esta publicada como CSV.

## Publicacao recomendada

1. Criar um repositorio no GitHub.
2. Enviar estes arquivos para o repositorio.
3. Entrar na Vercel e importar o repositorio.
4. Publicar usando as configuracoes padrao da Vercel.

Depois disso, a direcao acessa o link gerado pela Vercel no computador ou no celular.

## Quando usar Supabase

Use Supabase se precisar de login por usuario, dados privados, historico de alteracoes, auditoria, ou formularios de edicao dentro do proprio dashboard.
