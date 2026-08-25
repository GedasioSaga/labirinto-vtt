# Labirinto

Um editor de mapa para VTT (virtual tabletop) de RPG — espaço onde o mestre desenha o cenário em tempo real. **MVP em construção**, não é produto pronto.

## O que é

Labirinto é um desktop app (Tauri 2 + React 19 + TypeScript) que deixa o mestre de jogo mapear o cenário visual rapidamente: desenha paredes, coloca luzes e cria regiões marcadas. Suporta grid quadrado (1 quadrado = N pixels), tokens de personagem, importação de fundo de imagem e salvamento/carregamento de mapas.

Desenvolvido para reduzir fricção na preparação visual — sem servidor, sem conta, tudo rodando localmente em Windows/macOS/Linux.

## Como rodar em dev

### Requisitos
- Node.js 18+
- Rust (apenas pra compilar desktop)

### Setup rápido

```bash
npm install

# Dev mode (recarrega ao salvar)
npm run tauri:dev

# Typecheck
npm run typecheck

# Testes
npm run test --workspace=client
```

Abre a app em ~2–3s. Grid e canvas já estão prontos pra desenhar.

## Ferramentas e como usar

Todas na barra superior-esquerda. A dica aparece ao selecionar.

### Selecionar (padrão)
- **Click em token:** seleciona + pode arrastar
- **Click no vazio:** deseleciona
- **Não desenha nada**, só interage

### Parede
- **Click + arrasta:** desenha parede reta de A até B
- Esc cancela se soltar antes
- Paredes bloqueiam movimento (os personagens vão dar de cara)

### Luz
- **Click único:** coloca luz naquele ponto
- Sem arrasta — um clique = uma luz
- Raio padrão é 1 quadrado (configurável depois)

### Região
- **Clique múltiplo:** adiciona ponto por ponto
- **Duplo clique:** fecha a forma (precisa ≥3 pontos)
- **Esc:** cancela e limpa todos os pontos
- Use pra marcar área de ativação, sala inteira, zona de perigo

## Comportamentos não óbvios

- **Travar na grade:** checkbox na barra. Tudo que desenha (parede, luz, ponto de região, token) snapa ao grid. Útil pra alinhar — desativa pra pixel-perfect.
- **Mostrar grid:** checkbox. Desenha linhas (ajuda visual).
- **Pan (mover mapa):** click-arrasta no vazio com ferramenta Selecionar
- **Zoom:** roda do mouse no ponto que quer focar
- **Importar fundo:** carrega imagem (PNG/JPG) como base do mapa — cenário do VTT vai embaixo
- **Salvar/Abrir:** JSON local. Exporta/importa pasta com dados do mapa.
- **Adicionar token:** cria token 1×1 (personagem/inimigo) — depois arrasta pra posição

## Limitações conhecidas

- **Não dá pra apagar:** parede, luz, região, token já desenhado — fica permanente até essa UI ser construída. Workaround: editar o `map.json` à mão se urgente.
- **Background não mexe:** importa imagem, mas não dá pra remover/trocar sem salvar mapa novo.
- **Sem tela de menu:** abre direto em mapa branco — não há "novo/abrir" na startup, só na barra.
- **Grid é quadrado:** hex-grid está em branch separado (`feature/hex-grid`), não em master.
- **Peças e props:** features planejadas, não implementadas ainda.

## Estrutura do projeto

```
labirinto/
├── client/              # Frontend React + PixiJS
│   ├── src/
│   │   ├── pixi/        # Renderização e interação do canvas (PixiJS)
│   │   ├── stores/      # Estado (Zustand)
│   │   ├── lib/         # I/O de arquivo, factory de objetos, interação
│   │   └── types/       # Tipos do mapa (Wall, Light, Region, Token, etc.)
│   └── test-results/    # Testes
└── desktop/
    └── src-tauri/       # Backend Rust (Tauri, diálogos, file system)
```

O frontend é React puro + PixiJS pra renderização 2D (muito mais rápido que canvas direto). O backend Tauri cuida de file I/O seguro, diálogos de arquivo e empacotamento desktop.

## Rodar testes

```bash
# Testes da app (vitest)
npm run test --workspace=client

# Typecheck (TSC)
npm run typecheck --workspace=client
```

Testes são mínimos por enquanto — MVP em progresso.

## Referências rápidas

- **Modelo de dados:** `client/src/types/map.ts` — Wall, Light, Region, Token, MapData
- **Interação do canvas:** `client/src/pixi/PixiCanvas.tsx` — pan, zoom, drawing modes, keyboard
- **Store (estado):** `client/src/stores/mapStore.ts` (Zustand) — estado global do mapa
- **Desenho:** `client/src/pixi/` — renderização de grid, paredes, luzes, regiões, tokens
- **I/O:** `client/src/lib/mapFileIO.ts` — salvar/carregar JSON do AppData

## Roadmap

- [x] MVP: grid, paredes, luzes, regiões, tokens
- [ ] Apagar objetos (UI)
- [ ] Editar propriedades de objeto (cor da luz, tag de região, nome de token)
- [ ] Hex-grid (`feature/hex-grid`)
- [ ] Props/peças customizadas (`feature/props`)
- [ ] Nivelamento de camadas (objeto embaixo de outro)
- [ ] Colaboração (múltiplos usuários)

## Notas

Projeto local, sem remoto no GitHub por enquanto. Histórico de decisões e specs em `docs/superpowers/` no repo `Projeto Labirinto`.
