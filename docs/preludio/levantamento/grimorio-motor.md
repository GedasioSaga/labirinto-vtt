Raízes usadas abaixo:
- **G** = `C:/Users/gedasio.filho/OneDrive - Vertis Capital/Área de Trabalho/Tudo/Projeto Obsidian/grimorio`
- **O** = a pasta-mãe dele (`.../Projeto Obsidian`, onde estão o repo git e `docs/`)
- **TL** = `G/node_modules/@tldraw/editor/src/lib`
- **L** = `C:/dev/labirinto` (o Tauri do Labirinto fica em `L/desktop/src-tauri`, não em `client/`)

Consultei os dois grafos antes de buscar nos arquivos. Não abri `G/.env` nem `G/src-tauri/.env.local`.

## Mapa

**1. Stack do Grimório** (`G/package.json:15-38`; versões do package-lock; última release v0.15.0 em 01/10)
- **Tela:** React 19.2.7 + zustand 5.0.14, com uma store só, `useApp` (`G/src/state/store.ts:536`).
- **Mapa mental e mapa de masmorra:** usam **tldraw 4.5.12**. Não é react-flow, konva nem pixi.
- **Notas:** **TipTap 3.27.4** (`G/src/components/NotasEditor.tsx:2-3,70-71`).
- **Teia de vínculos:** código próprio, desenhado em SVG, com layout por "força" (`G/src/lib/grafoLayout.ts:1-13`).
- **Rust:** tauri 2.11.5, plugins dialog/http/opener/process/updater/oauth, oauth2 5, keyring 4.1.5, reqwest 0.12 com rustls (`G/src-tauri/Cargo.toml:21-44`). Tem comandos de disco próprios e Google Drive (`G/src-tauri/src/lib.rs:184-215`; auth.rs tem 466 linhas, drive.rs 1159).

**2. O mapa mental é o canvas do tldraw** (`G/src/components/CanvasView.tsx:64-86`)
- **Nós:** as formas padrão do tldraw mais 3 cartões próprios: personagem, cenário e item (`CanvasView.tsx:28-29`).
  - Cada cartão é um `BaseBoxShapeUtil` com props e migrações (`CharacterCardShape.tsx:51-64`).
  - O cartão lê a ficha ao vivo da store (`CharacterCardShape.tsx:151-154`). O canvas guarda só o id da ficha.
- **Ligações:** é a seta nativa do tldraw, presa nos dois cartões. Ela acompanha quando você arrasta (`G/src/components/ligacoesCanvas.ts:27-40`).
- **Soltar uma ficha da barra lateral** cria o cartão e já liga as relações salvas (`dropsDeEntidade.tsx:107,187` → `ligacoesCanvas.ts:78-93`).
- **Zoom, arrasto e seleção:** vêm prontos do tldraw. O mapa tem botões de zoom próprios (`ControleZoom.tsx:33-42`, plugados em `lib/montagemMapa.tsx:166`).
- **Tela da sessão:** dividida em notas TipTap + canvas + chat de IA (`Workspace.tsx:35-55`).

**3. Teia de vínculos (o "mapa de conexões" que já existe)** — `G/src/components/GrafoVinculos.tsx`
- **Layout:** Fruchterman-Reingold, sempre igual para os mesmos dados, 300 rodadas comparando todo par com todo par (`grafoLayout.ts:40,87-103`).
- **Zoom:** pela roda do mouse, ancorado no cursor (`:220-231`).
- **Arrastar nó:** atualiza o estado do React a cada movimento do mouse (`:259-270`). A posição só é salva ao soltar (`:238-243`).

**4. Desfazer**
- **Canvas e mapa:** Ctrl+Z do tldraw, só em memória (some ao fechar).
  - Tem pontos de parada próprios (`atalhosCanvas.ts:64`; `ComandosMapa.tsx:228`).
  - Ajustes automáticos ficam fora do histórico (`lib/ancoraPortaEditor.ts:251-252`).
  - A planta inteira gerada pela IA volta com um Ctrl+Z só (`lib/gerarMapaIA.ts:308-339`).
- **Teia:** sem desfazer, de propósito (`GrafoVinculos.tsx:245-257`).
- **Notas:** usam o desfazer do próprio TipTap.

**5. Salvamento automático**
- **Canvas e mapa**, em ordem:
  1. Espera 1 s depois da última mudança (`canvasDoc.ts:20,129-138`).
  2. Tira uma foto do documento inteiro, conteúdo + vista (`:120-122`).
  3. Relê o arquivo e regrava tudo formatado, numa fila por caminho (`vaultRepo.ts:168,347-352`).
  4. O Rust grava um `.tmp` e renomeia, com 3 tentativas por causa do OneDrive (`lib.rs:17-43`).
  - Ao fechar a tela, grava o que estava pendente (`canvasDoc.ts:140-148`).
- **Imagens:** viram arquivo no cofre; o JSON guarda só o caminho relativo (`canvasDoc.ts:30-53`).
- **Notas:** 800 ms (`NotasEditor.tsx:18,112`). Fichas, vínculos e teia também 800 ms (`store.ts:15,356,382`).
- **Sincronização com o Google Drive:** sobe uns 3 s depois de salvar e baixa a cada 60 s (`lib/sync/sincronizador.ts:33-36`).

**6. Por que apareceram cópias de conflito em 14/08** (commits 759fc4a de 14/08 e 2316fe9 de 15/08)
1. **O autosave do canvas grava fora da fila que o sync esvazia antes de cada ciclo.**
   - Na subida, o sync lia do disco um arquivo mais novo que o da varredura, mas registrava o hash velho.
   - No ciclo seguinte ele via "mudou dos dois lados" e criava uma cópia. Isso se repetia a cada ciclo enquanto o canvas estava aberto (`lib/sync/executar.ts:213-221`).
   - Correção: o arquivo que mudou durante o ciclo é adiado (`:251-261`), e essa checagem vem antes de preservar a cópia (`:316-322`).
2. **A cópia não era criada uma vez só.**
   - O nome leva dia, hora e minuto (`lib/sync/conflito.ts:122-126,141-158`).
   - Quando a transferência falhava, o ciclo seguinte preservava de novo com outro nome.
   - Correção: antes de criar, procura se já existe uma cópia igual (`preservar.ts:282`; `duplicata.ts:74,119`).
3. **O canvas aberto não relia o arquivo baixado**, e a próxima edição gravava a versão velha por cima (`canvasDoc.ts:152-164`).
   - Correção: um contador `recargasDoDisco` (`store.ts:264,634`) e releitura com `mergeRemoteChanges` (`canvasDoc.ts:165-183`).
- **Não há fusão em canvas nem em mapa:** conflito vira cópia inteira com id novo (`conflito.ts:20-31,86-91`). Só `vinculos.json` junta os dois lados (`:87`).

**7. Desempenho com mapa grande** (não medi; o Grimório não tem nenhum teste de desempenho)
- **Limite do tldraw:** 4000 formas por página por padrão (`TL/options.ts:172`). O Grimório não altera isso (`CanvasView.tsx:64-86`; `MapaView.tsx:115-121`).
- **Fora da tela:** o tldraw já pula o que não está visível (`TL/editor/Editor.ts:5185-5199`).
- **Autosave:** cada gravação relê e regrava o documento inteiro (`vaultRepo.ts:347-352`), então o custo cresce com o tamanho do mapa.
- **Teia:** o custo é n² × 300, na thread principal (`grafoLayout.ts:87-103`), e recalcula quando qualquer ficha muda (`GrafoVinculos.tsx:129-144,159-162`).

**8. Testes** (contei com busca de texto, não rodei nada)
- **Volume:** 151 arquivos de teste em `G/src/test`, cerca de 2080 casos. 52 rodam em jsdom e 18 importam tldraw.
- **Configuração:** timeout de 30 s por causa da primeira carga do tldraw (`G/vite.config.ts:37-73`) e um ajuste no jsdom para o TipTap (`src/test/setup.ts:10-27`).
- **Parte mais forte:** o motor de sync (executarPlano, reconciliar, conflito, duplicata, preservarPerdedor, e portaoDiscoReal em disco de verdade).
- **Lacuna:** a releitura do canvas depois do sync (`canvasDoc.ts:165-183`) não tem teste direto. Só o contador é testado (`recargaAposSync.test.ts:173-186`).

## Comparação com o Labirinto

**A base é a mesma; as diferenças de versão são pequenas**

| peça | Grimório | Labirinto |
|---|---|---|
| React / zustand | 19.2.7 / 5.0.14 | 19.2.8 / 5.0.15 |
| Vite / Vitest / TS / jsdom | 7.3.6 / 4.1.10 / 5.8.3 / 29.1.1 | 7.3.6 / 4.1.11 / 5.8.3 / 29.1.1 |
| Tauri (Rust / api JS) | 2.11.5 / 2.11.1 | 2.12.2 / 2.12.2 |
| plugins JS updater / process / dialog | 2.10.1 / 2.3.1 / 2.7.1 | 2.13.2 / 2.4.0 / 2.7.2 |

- **Seria novo no Labirinto:** tldraw, TipTap, plugin-http e plugin-opener. No Rust: tauri-plugin-http/oauth/opener, oauth2 e keyring 4.
- **Sem choque:**
  - O tldraw pede React ^19.2.1, e o Labirinto tem 19.2.8.
  - O keyring 4 usa keyring-core 1.0.0 e windows-native-keyring-store 1.1.0, as mesmas versões que o Labirinto já usa (`L/desktop/src-tauri/Cargo.toml:46-47`).
- **Choque real, o reqwest:**
  - O Labirinto usa 0.13 com native-tls (`Cargo.toml:25`).
  - O Grimório usa 0.12 com rustls, puxado por ele mesmo, pelo oauth2 5 e pelo tauri-plugin-http 2.5.9 (está no Cargo.lock).
  - Juntando os dois, o programa leva duas cópias do reqwest e duas camadas de TLS.
- **Tamanho:**
  - O build inteiro do Grimório dá 2,2 MB (`G/dist/assets/index-ldoLjgw7.js`).
  - No Labirinto o maior pedaço main tem 1,79 MB, e ele já separa LivroDeRegras (3,67 MB) e three (746 KB).
  - O tldraw tem de entrar só quando a tela abrir (import dinâmico).

**Dá para trazer como está.** São arquivos TypeScript puros; conferi que não importam React, tldraw nem Tauri:
- grafoLayout, grafoVinculos, grafoLayoutPersistido, vinculos, ligacaoCenario, cartaoCanvas, markdownHtml.
- `vaultRepo.ts`, que só depende da interface FsBridge (`fsBridge.ts:21-31`).
- O motor `lib/sync/*`, menos `driveBridge.ts`; as dependências entram por parâmetro (`ciclo.ts:43-57`).

**Precisa adaptar** (troca as ligações, mantém o desenho)
- **Telas do canvas, cartões, teia e notas:** CanvasView, canvasDoc, os 3 cartões, dropsDeEntidade, GrafoVinculos e NotasEditor.
  - Dependem de `useApp` (53 arquivos fora de teste) e de `convertFileSrc` (17).
  - As chamadas ao Rust (`invoke`) ficam concentradas em 4 pontes: fsBridge, hashBridge, googleAuth e `sync/driveBridge`.
- **Disco:**
  - O Labirinto só lê e grava dentro de `$APPDATA` (`L/desktop/src-tauri/capabilities/default.json:26-27`; `tauri.conf.json:25-27`). O cofre do Grimório pode estar em qualquer pasta.
  - Caminho limpo: escrever um FsBridge em cima do `@tauri-apps/plugin-fs`, cujas permissões já existem (`default.json:10-21`), e o cofre morar em AppData.
- **Regra de salvar:**
  - O Grimório grava tudo sozinho.
  - O Labirinto usa Salvar explícito mais uma cópia de recuperação a cada 10 s (`L/client/src/stores/recoveryAutosave.ts:9-30`).
  - Falta decidir qual regra vale para o material de preparação.
- **Desfazer:**
  - Os dois funcionam diferente: o tldraw guarda em memória, por editor; o Labirinto guarda fotos do mapa, até 50 passos (`L/client/src/stores/mapStore.ts:401-402,1660-1671`).
  - O Ctrl+Z global do Labirinto só age na tela `editor` (`L/client/src/App.tsx:1823-1857`, guarda na `:1827`).
  - Uma tela nova não conflita. O lugar óbvio é abaixo de Roleplay, que hoje é só um aviso de "em construção" (`L/client/src/screens/RoleplayScreen.tsx:8-21`; tipo em `L/client/src/types/screen.ts:1`).
- **Testes:** o Labirinto não tem setupFiles nem timeout (`L/client/vite.config.ts:66-80`). Os testes do Grimório precisam levar o `setup.ts` e os 30 s.

**Reescrever ou deixar de fora**
- **Mapa de masmorra do Grimório** (MapaView, cerca de 20 formas e ferramentas, gerarMapaIA e plantaMapaIA): repete o editor Pixi do Labirinto (`L/client/src/pixi/PixiCanvas.tsx`, 9470 linhas; câmera em `pixi/world.ts:14-21,43`).
  - Recomendo deixar de fora. Mapas antigos só entram com um conversor de tldraw para o formato do Labirinto (MapData).
  - **Cuidado:** o canvas registra as formas de mapa porque dá para colar porta ou sala nele (`CanvasView.tsx:19-29`). Um canvas antigo com peça de mapa colada não abre sem essas formas. É preciso mantê-las registradas ou migrar.
- **Google Drive e IA Gemini:** o Drive (cerca de 1600 linhas de Rust) e o Gemini (`lib/gemini.ts`) duplicam a nuvem do Labirinto (`L/desktop/src-tauri/src/nuvem.rs:1-12`) e o `ia.rs`. É preciso escolher um de cada.
- **O que falta nos dois:** o Grimório não tem nada de revelar ao jogador, linha do tempo nem cartaz de procurado (a busca não achou nada). Isso precisa ser construído no Labirinto, que já tem agenda com eventos datados (`L/client/src/lib/adventure.ts:57-62`).

## Como se conecta
1. Você arrasta uma ficha → `criarHandlersDeDrop` cria o cartão e as setas (`dropsDeEntidade.tsx:107,187`).
2. O tldraw avisa a mudança (`canvasDoc.ts:129`) → 1 s depois o VaultRepo grava na fila (`vaultRepo.ts:347-352`) → o Rust grava de forma segura (`lib.rs:17-43`) → 3 s depois o sync sobe para o Drive (`sincronizador.ts:36`).
3. Na volta: o sync baixa → `recargasDoDisco` sobe (`store.ts:634`) → o canvas aberto relê o arquivo, a não ser que haja gravação pendente (`canvasDoc.ts:165-183`).
4. O cartão não copia a ficha, lê a store na hora de desenhar (`CharacterCardShape.tsx:151-154`). Esse id é o ponto natural para ligar com a aventura do Labirinto.

## Pontas soltas
- **Licença do tldraw (decisão sua antes de trazer):**
  - Não é MIT (`G/node_modules/tldraw/LICENSE.md`).
  - Em 13/07 a marca d'água foi aceita como "uso pessoal" (`O/docs/superpowers/specs/2026-07-13-grimorio-design.md:29`). O Labirinto é público e publica releases, então essa premissa muda.
  - Pelo código: em http conta como desenvolvimento e mostra a marca d'água. O Labirinto não liga `useHttpsScheme`, e o padrão do Tauri 2 no Windows é http.
  - Em https fora de localhost e sem chave, o editor some depois de 5 s (`TL/license/LicenseProvider.tsx:11-13,30-45`; `LicenseManager.ts:127-133,478-491`). Ou seja, o site do lobby não pode usar tldraw sem licença.
- **Suspeitas:**
  - `G/src/components/canvasDoc.ts:175-177`  a releitura também aplica a câmera e a seleção salvas no arquivo (`TL/config/TLSessionStateSnapshot.ts:257-269`), então a vista pode pular para a do outro PC.
  - `G/src/lib/sync/executar.ts:221-223`  o hash é conferido antes de o Rust ler o arquivo para subir. Um autosave nesse intervalo ainda registra o hash velho (`:232`): é a mesma causa de 14/08, numa janela menor.
  - `G/src-tauri/Cargo.toml:33-35`  o comentário diz que só existe uma cópia do reqwest, mas o Cargo.lock tem 0.12.28 e 0.13.4.
  - `G/src-tauri/src/lib.rs:12-15`  os comandos de disco aceitam qualquer caminho, e o acesso a arquivos está liberado em `**` com csp null (`G/src-tauri/tauri.conf.json:22-23`). Não copiar esse padrão para o Labirinto.
- **Não verifiquei:**
  - Onde fica o cofre de verdade. Se estiver no OneDrive, são dois sincronizadores no mesmo arquivo; o app avisa (`lib/sync/parear.ts:116-136`).
  - Não li `auth.rs` e `drive.rs` por dentro (têm credencial), o `PainelPropriedades` (46,8 KB) nem o `store.ts` inteiro.
  - Não medi tempo de nada.
  - Também não chequei os outros atalhos de teclado globais do Labirinto (`App.tsx:1202,3132,3177`).