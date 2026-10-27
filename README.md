# #_4root CTI | CVE — frontend (v9)

Site estático (HTML + CSS + JS puros) com o design system oficial da #_4root
(navbar, hero com partículas, tipografia QB One/Sora/Ubuntu, glitch, scanlines).

## Rodar localmente

**Opção A — junto com o backend (recomendado):**
extraia `cti-back` e `cti-front` no mesmo diretório e rode o backend:

```bash
cd cti-back && pip install -r requirements.txt && python app.py
```

Abra **http://localhost:5000** — front e API na mesma origem.

**Opção B — front separado:**

```bash
cd cti-front && python3 -m http.server 8080
```

Abra **http://localhost:8080** — a detecção automática aponta a API para
`http://127.0.0.1:5000` (CORS liberado no backend). Para apontar para outra
URL, edite `config.js`.

## Funcionalidades (v9)

- **Explorer com slider CVE ⇄ KEV** — dois painéis lado a lado no estilo
  "tela de android": arraste para o lado, use as setas `<` `>` no cabeçalho
  (ao lado das tabs, sem nunca cobrir os cards), as tabs
  `01 // explorar cves` / `02 // exploração ativa kev`, os dots ou as
  teclas ← →. A URL reflete o painel (`#explorer-cves` / `#explorer-kev`).
- **Busca por ID específico** — digite `2026-30707` ou `CVE-2026-30707` (Enter
  ou Ctrl+K) e o detalhe abre direto, ignorando a janela de datas; se a CVE não
  estiver no banco local, o backend busca na NVD/MITRE na hora e grava.
- **Painel de filtros fixo (sticky)** — busca, janela de publicação (24h/7d/
  30d/90d/1a/tudo), severidade, ordenação (recentes/antigas/maior score/epss)
  e por página. Governa os DOIS painéis de uma vez, igual cti.wazuh.com.
- **Cards de CVE e KEV em grade** — 3 a 4 cards por fileira (responsivo),
  com fundo em tons de cinza claros para leitura confortável.
- **Dashboard unificado no final da página** — KPIs + timeline, severidade,
  distribuição CVSS, vetor de ataque, privilégios exigidos, top CWE com
  rolagem e exploração ativa por período. Todos Apache ECharts, interativos,
  clicáveis (clicar aplica o filtro no explorer) e **sem nunca desaparecer**.
- **Módulo de correlação interna // CVE × KEV** — taxa de exploração,
  dias até exploração, correlação temporal (publicações × entradas no KEV),
  produtos e fabricantes mais visados pelo KEV (com rolagem para ver todos),
  perfil de severidade (exploradas × não exploradas) e ransomware.
- **Omnisearch Ctrl+K** — CVE, produto e fabricante com navegação por teclado.
- **Modal de detalhe** — CVSS decodificado, EPSS, bloco KEV (ransomware/prazo),
  CPEs clicáveis e referências.
- **Loading em tudo** — boot terminal, skeletons, barra de progresso e toasts.
- Responsivo (navbar mobile oficial com socials da comunidade).

## Design

- Tokens oficiais: `#00ff41` (neon), `#ff0040` (alerta), fundo `#050505`
- Fontes self-hosted: QB One (títulos), Sora (UI), Ubuntu (corpo),
  JetBrains Mono (dados/terminal)
- `static/css/4root.css` = base oficial do site principal;
  `static/css/cti.css` = componentes CTI nos mesmos tokens
