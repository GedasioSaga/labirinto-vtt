# Sons ao vivo (Sistema 4)

Plano técnico do arquiteto de 23/10/2026, a partir do roteiro `docs/planos/roteiro-pos-redesign-2026-10-22.md` (seção 5.4) e das respostas do usuário em 23/10. Roda em paralelo com as camadas, sem editar os arquivos quentes delas.

## Decisões do usuário (não reabrir)

- Aba **Sons** no livro da mesa, ao lado de Grupo, Chat, Cenas e Mesa: grade de botões grandes, organizada e leve.
- Fonte: arquivo de áudio (mp3, wav, ogg, m4a) guardado NA AVENTURA, e link do YouTube incorporado (nada de baixar áudio).
- Recursos: volume por efeito, Parar tudo, atalhos 1 a 9, pastas e favoritos, loop para ambiente.
- Quem escuta: SELETOR FIXO no topo da aba (Todos = padrão, Só a cena atual, Jogadores escolhidos), vale para os próximos cliques.
- Desempenho: carregar sob demanda, cache, limite de efeitos ao mesmo tempo.
- Jogador no navegador: aproveita o toque que ele já dá; se um efeito chegar antes, aparece a faixinha "toque para ouvir".
- YouTube: SÓ O ÁUDIO, PLAYER ESCONDIDO. O usuário foi avisado de que isso pode ferir a política do player incorporado do YouTube e escolheu assim; o risco fica registrado aqui uma vez.
- Entrega: TUDO JUNTO (arquivos e YouTube). As fatias internas ordenam arquivos primeiro e YouTube por último.
- Depois: o som de ambiente por Dia, Tarde e Noite (sistema 1) usa esta biblioteca. Não entra agora.

## Fatos conferidos

- O teto de 15 MB vale só para áudio (`lib/midia.ts:91`, `media.rs:40`); imagem tem 2 MB. O `lib/midiaDaPasta.ts` só conhece imagem (`:158,224`).
- Todo som de hoje passa por um passa-baixa de 4 kHz (`lib/sons/contexto.ts:84,96-104`): música e efeito gravado precisam de caminho próprio.
- `lib/adventure.ts` já recebeu código das camadas (`:96,257`) e a fatia 7 delas vai mexer de novo: tratar `adventure.ts` e `adventureStore.ts` como QUENTES. Os dígitos 1 a 9 estão livres no `keymap.ts` (só Ctrl+0 é atalho).
- `hostSession.ts` NÃO precisa mudar: `listPlayers(source)` (`:2328`) dá `clientId`, `connected` e `sceneId`, e o envio usa o `dispatch` do `hostBridge` (`:1477-1488`).
- O jogador ignora mensagem desconhecida (`playerConnection.ts:4475`); o modelo a copiar é o da dança (`:4056-4070`).
- `App.tsx` não precisa mudar: o `LivroDaMesa` monta a `PaginaSons` sozinho. O ícone `som` já existe (usado pela `PaginaMesa`).

## 1. Modelo de dados

```ts
type AtalhoDeSom = 1|2|3|4|5|6|7|8|9
type FonteDoSom =
  | { tipo: 'arquivo'; ref: string /* 'midia:<sha256>.<mp3|ogg|wav|m4a>' */; bytes: number }
  | { tipo: 'youtube'; video: string /* /^[A-Za-z0-9_-]{11}$/ */; inicioS?: number }
interface EfeitoDeSom { id: string; nome: string /* até 40 */; fonte: FonteDoSom; volume: number /* 0..1, padrão 0.8 */;
  loop: boolean; pastaId: string | null; favorito?: true; atalho?: AtalhoDeSom /* único */; ordem: number }
interface PastaDeSons { id: string; nome: string; ordem: number }  // um nível só
interface BibliotecaDeSons { versao: 1; pastas: PastaDeSons[]; efeitos: EfeitoDeSom[] /* até 200 */ }
type AlvoDosSons = { tipo: 'todos' } | { tipo: 'cena'; sceneId: string } | { tipo: 'escolhidos'; playerIds: string[] }
```

- Mora em `<pasta da aventura>/sons.json`, ao lado do `adventure.json` (nenhum campo novo no `adventure.json`). Os áudios ficam em `<aventura>/midia/`.
- Salva sozinho, 400 ms depois de cada mudança; não deixa o mapa "não salvo" e não entra no Ctrl+Z (é configuração).
- Aventura nova sem pasta: biblioteca na memória, gravada quando a pasta aparecer. Mapa solto fica fora da v1: a aba mostra "Salve como aventura para guardar sons aqui".
- O áudio viaja com a pasta: `midiaDaPasta` passa a aceitar id de áudio (confere o tipo pela assinatura dos bytes, teto de 15 MB). Aventura antiga: biblioteca vazia, nada migra. App antigo abrindo aventura nova ignora `sons.json` e os áudios.

## 2. Rede

Mensagens novas, só do mestre para o jogador, com parser em `net/protocol.ts` no modelo de `parseSceneNote`:

- `som.tocar { instancia, fonte, volume, loop, deslocamentoS? }` (o nome do efeito NÃO vai junto, para não estragar surpresa), `som.parar { instancia, fadeMs? }`, `som.pararTudo {}`, `som.volume { instancia, volume }`, `som.precarregar { midias }`; do jogador ao mestre, opcional, `som.falhou { instancia, motivo }`.
- `net/audienciaDosSons.ts` (puro): `destinatarios(alvo, PlayerInfo[])` devolve os `clientId` conectados. Métodos novos no `hostBridge`: `tocarSomAoVivo`, `pararSomAoVivo`, `pararTodosOsSons`, `volumeDoSom`. Loop é estado: o bridge guarda os loops ativos e `reconciliarSons()` manda `som.tocar` a quem entra ou volta e `som.parar` a quem sai da cena. Efeito curto é evento.
- "Só a cena atual" vira, no clique, a cena aberta no editor (o seletor mostra "Só a cena: Taverna").
- **A tela da mesa (a TV) TAMBÉM TOCA** (decisão do usuário de 23/10, contra a recomendação de ignorar na v1): ela entra em "Todos" e em "Só a cena" quando estiver na cena, e não aparece em "Escolhidos" (que lista jogadores). A F4 e a F5 têm de cobrir a TV: confirmar como a tela da mesa se conecta (recorte `filterMapForGroup`, `hostSession.ts` ~4847; hoje ela ignora a dança, `playerConnection.ts` ~4056), instalar nela o motor e a faixinha, e tratar o autoplay sem gesto (a TV precisa de um toque inicial uma vez ou de um navegador com autoplay liberado). Avisar o mestre quando a TV ainda não destravou o áudio. Se isso exigir mexer no `hostSession.ts`, anunciar antes: é arquivo quente das camadas.
- Sincronia: sem acerto de relógio; efeito curto toca quando chega (menos de 100 ms na LAN, 100 a 400 ms pelo túnel). Loop pego no meio começa em `deslocamentoS % duração`. Efeito curto esperando toque há mais de 2 s é descartado.
- Jogador: `case 'som.*'` no `playerConnection` e `ouvirSons(listener)`; `player/sonsAoVivoDoJogador.ts` instalado em `player/main.tsx` ao lado de `:2321`.
- Motor compartilhado em `lib/sons/aoVivo/motor.ts`: o mestre lê do disco (`lerAudioGuardado`), o jogador busca `fetch('/media/<id>')`. Cache em duas camadas (bytes e áudio decodificado): até 1 MB decodificado (corte total cerca de 150 MB no PC e 60 MB no celular); acima de 1 MB vira Blob tocado por `<audio>` ligado ao Web Audio (pular para o meio, porque `/media` não tem Range). Limites: 8 sons simultâneos, 3 loops, 2 YouTube; efeito curto acima do limite derruba o mais antigo, loop acima do limite é recusado no mestre com aviso. Saída própria `aoVivo` no `contexto.ts` sem o passa-baixa. Volume final = volume do efeito × volume do aparelho (`somStore`) ao quadrado, a mesma curva dos sons de clima (decisão do dono, 23/10); Mudo zera o ganho sem parar o loop; Parar faz fade de 150 ms.
- Faixinha: `player/FaixaTocarParaOuvir.tsx` montada em `player/main.tsx` (não no `PlayerView.tsx`); aparece quando chega `som.tocar` com o áudio ainda não destravado; o toque destrava e os loops começam com o deslocamento corrigido; no iOS o mesmo gesto destrava 2 `<audio>` de reserva. Pré-carga: ao receber o mapa, o mestre manda `som.precarregar` com os favoritos de até 1 MB.

## 3. YouTube (só áudio, player escondido)

- `lib/sons/youtube/linkDoYoutube.ts` (puro): aceita `watch?v=`, `youtu.be/`, `shorts/`, `embed/`, `music.youtube` e `t=`; guarda só o id de 11 caracteres; o endereço do iframe é montado a partir do id validado, nunca da URL colada.
- `lib/sons/youtube/playerEscondido.ts`: carrega `iframe_api` só no primeiro uso; contêiner fora da tela, direto no `document.body`, nos dois lados; iframe com `allow="autoplay"`, `youtube-nocookie.com`, `enablejsapi=1`, `origin=`, `playsinline=1`; no máximo 2 players reaproveitados; volume = efeito × aparelho; loop volta para `inicioS` no `ENDED`.
- Erros 100, 101/150 (muitas vezes bloqueio de região), 2, 5 e 153 (sem Referer, conhecido em webview) viram `som.falhou` e o botão do mestre mostra "não tocou para N". Ao colar o link o mestre testa no próprio player escondido antes de guardar. Latência de 1 a 3 s na primeira vez.
- Gesto: no Chrome a ativação passa ao iframe com `allow=autoplay`; no iOS Safari a faixinha chama `playVideo()` dentro do toque.
- **Risco de política (registrado uma vez):** player escondido ou menor que 200x200 contraria a política do player incorporado do YouTube. A escolha é do usuário, que foi avisado.

## 4. Interface

- `livroDaMesaStore.ts` ganha `'sons'`; `LivroDaMesa.tsx` ganha a entrada (ícone `som`) e uma folha que monta `<PaginaSons />` sozinha; a página só lê stores e o `hostBridge` por `net/ponteDosSons.ts` (registrada pelo próprio bridge). Zero mudança no `App.tsx`. Arquivos novos: `components/livro/PaginaSons.tsx` e `sons.css` próprio.
- Topo fixo: seletor segmentado (Todos / Só a cena: X / Escolhidos, com chips), "Tocar neste computador" (lembrado no aparelho) e "Parar tudo". Abaixo: chips de pasta (Favoritos primeiro), grade de botões grandes com selo do atalho, loop marcado e barra fina de progresso; "+" com "Importar arquivo" (reaproveita o seletor da música da dança) e "Colar link"; o lápis edita nome, volume, loop, atalho, pasta e favorito.
- Atalhos 1 a 9: `keymap.ts` ganha `SOUND_SLOT_KEYS` e `resolverAtalhoDeSom(evt)`, só sem modificador e fora de campo de texto, com um hook na folha Sons (sempre montada), sem disparar com diálogo modal aberto; teste garante que `resolveShortcut` segue devolvendo null para os dígitos.
- Skills do Emil (CLAUDE.md §2l): `emil-design-eng` e `frontend-design`. O clique toca na hora, sem animação na frente do som; só o selo pulsa, em até 150 ms. Teste no browser no fim.

## 5. Fatias (commit na main só dos próprios caminhos; teste nasce vermelho)

Escritor: `programador-frontend` (opus@xhigh); F3 também com as skills do Emil.

| # | Fatia | Arquivos-chave | Aceite (vermelho primeiro) | Quente? |
|---|---|---|---|---|
| F1 | Dados e disco | `lib/sons/biblioteca.ts`, `bibliotecaNoDisco.ts`, `stores/bibliotecaDeSonsStore.ts`, `lib/midiaDaPasta.ts`, diagrama `docs/diagrams/sons-ao-vivo.html` + INDEX | ida e volta do `sons.json`; aventura antiga = vazia; entrada inválida descartada; atalho único; wav de 14 MB vai e volta com hash conferido; png renomeado para .mp3 recusado | nenhum |
| F2 | Motor local | `lib/sons/aoVivo/motor.ts`, `contexto.ts` (ganho `aoVivo`), `audioFalso.fixture.ts` | 9º efeito derruba o mais antigo; 4º loop recusado; mudo zera o ganho sem parar; som ao vivo não passa pelo passa-baixa; nada toca antes do gesto; 2 toques = 1 leitura de bytes | nenhum |
| F3 | Aba Sons, só local | `PaginaSons.tsx`, `sons.css`, `LivroDaMesa.tsx`, `livroDaMesaStore.ts`, `keymap.ts`, `LivroDaMesa.test.tsx` | marcador Sons aparece; clique toca; tecla 3 toca o atalho 3; tecla 3 em campo de texto não toca; Parar tudo para os loops; importar e editar | nenhum (`App.tsx` e `icones.tsx` intactos) |
| F4 | Rede de arquivos | `protocol.ts`, `net/audienciaDosSons.ts`, `ponteDosSons.ts`, `hostBridge.ts`, `playerConnection.ts` | host de mentira: "Só a cena" chega só a quem está nela; escolhido desconectado não recebe; quem entra com loop tocando recebe `tocar` com deslocamento, quem sai recebe `parar`; mensagem malformada ignorada; tela da mesa ignora | nenhum (`hostSession` intacto) |
| F5 | Jogador toca e faixinha | `player/sonsAoVivoDoJogador.ts`, `FaixaTocarParaOuvir.tsx`, `player/main.tsx`; carregador de bytes do jogador (`fetch('/media/<id>')`) | e2e `task-sons-ao-vivo-arquivo`: `tocar` antes do gesto mostra a faixa, o toque começa no deslocamento; `ControleDeSom` muda o ganho do loop; 1 só busca de `/media` para 2 toques; pré-carga dos favoritos pequenos; arquivo de 2 MB por `<audio>` com `createMediaElementSource` e deslocamento (seek num Blob); loop do `<audio>` recusado com `NotAllowedError` e o contexto já rodando recomeça no próximo toque (o aviso de destravamento do motor só vem quando o contexto volta a rodar; as 2 reservas do iOS cobrem) | nenhum |
| F6 | YouTube (medir antes do código) | `lib/sons/youtube/*`, motor, `PaginaSons` (colar link), `protocol.ts` | lê 8 formatos e recusa o resto; API falsa: `ENDED` com loop volta a `inicioS`; erro 150 vira aviso no mestre; e2e com `iframe_api` em stub local | nenhum |
| F7 | Fechamento | INDEX, jornada, medições | suíte completa 1 vez; 4 jornadas seladas das camadas verdes; teste no browser; teste do autoplay e do `<audio>` reserva num iPhone e num Android de verdade | nenhum |

Carregadores de bytes do motor (injetados em `criarMotorAoVivoDoNavegador`): ficam para a F3 (mestre: `lerAudioGuardado`) e a F5 (jogador: `fetch` de `/media`). O motor já põe prazo neles (`PRAZO_DO_CARREGAMENTO_MS`, 30 s, a calibrar na medição do túnel).

Medição da F6 antes do código (só leitura, sem commit): (a) o iframe no WebView2 (`http://tauri.localhost`) dá erro 153? Se der, o player do mestre carrega por uma página servida pelo servidor da sala (`127.0.0.1`), que só existe com a sala aberta, e essa página é do `programador-rust`; (b) navegador do jogador em LAN http e pelo túnel https; (c) iPhone Safari.

## 6. Riscos e como medir

- Autoplay e celular: contexto suspenso com a tela bloqueada, `<audio>` no iOS só toca se destravado. Medir num iPhone e num Android de verdade (fatia dona: F7); o mestre vê quantos jogadores não destravaram (`som.falhou` com `sem-gesto`).
- Banda do túnel Cloudflare: 5 MB para 4 jogadores são 20 MB subindo do mestre. Medir o tempo até o primeiro som com 1 e 5 MB e 4 abas, pelo túnel e com banda limitada; se passar de 3 s para 1 MB, aumentar a pré-carga.
- Teto de 15 MB e aventura gorda: a importação recusa com `AUDIO_GRANDE_DEMAIS`; a página mostra o total em MB da pasta de mídia e avisa acima de 200 MB.
- Memória do áudio decodificado no celular: medir o heap com 3 loops e 5 efeitos curtos e ajustar o limite de 1 MB.
- Travada: p95 do quadro com 8 sons e a aba aberta, nenhuma tarefa longa de 200 ms ou mais.
- Política do YouTube: risco aceito pelo usuário. Na prática o erro mais comum é o 150 (vídeo ou região), que chega ao mestre por `som.falhou`.
- **Pendência (revisão da F3, 23/10): limpar da pasta os áudios que nenhum efeito usa mais ao gravar.** Hoje apagar um som tira o botão e a entrada do `sons.json`, mas o arquivo continua em `<aventura>/midia/` (nem `midiaDaPasta.ts` nem `bibliotecaNoDisco.ts` removem arquivo), e o peso do pé vem do `readDir` da pasta: com 201 MB, apagar 10 sons deixa o pé em 201 MB e o aviso aceso. Por isso o aviso da página só diz que o arquivo fica, sem mandar apagar sons. A limpeza é código de disco da F1 (`bibliotecaNoDisco.ts`): ao gravar, tirar da pasta o áudio que nenhum efeito referencia, sem tocar nas imagens que também moram ali.
- **Registro (revisão da F3, 23/10): em 390 px a barra de ferramentas do mapa fica POR CIMA do livro da mesa.** Medido no e2e da aba Sons com `elementFromPoint` em grade de 12 px sobre a página do livro (x 64-327, y 12-832): `.lb-toolbar__group` e `.lb-ferr` cobrem os mesmos 33 pontos (x ~238-330, y ~700-840) na página Cenas, anterior à F3, e na página Sons. Não é da F3 (ela não toca em CSS fora de `.lb-sons`) e tapa conteúdo de verdade: o clique ali cai num botão de ferramenta, não no cartão. Dono: o layout do app no celular (barra em `Toolbar.tsx`/`main.css`, ordem de camadas com o livro aberto); não mexido aqui.
- Convivência com as camadas: nenhuma fatia edita arquivo quente. Se `LivroDaMesa.tsx` ou `keymap.ts` entrarem no escopo da fatia 6 das camadas, combinar a vez antes da F3.

## F4 (rede dos sons), 23/10

Feita na branch `feat/sons-ao-vivo`. Só a rede: o jogador ainda não toca (F5), o seletor de audiência ainda não está na tela (F5/F6), YouTube não vai pela rede (F6).

**O que entrou**

- `net/protocol.ts`: `som.tocar { instancia, fonte, volume, loop, deslocamentoS? }`, `som.parar { instancia, fadeMs? }`, `som.pararTudo`, `som.volume`, `som.precarregar { midias }` (mestre → jogador e TV, `parseSomHostMessage`) e `som.falhou { instancia, motivo }` (jogador ou TV → mestre, `parseSomFalhou`). Forma errada recusa a mensagem inteira, sem exceção; a cópia leva só os campos conhecidos. `fonte` é só `{ tipo: 'arquivo', midia: '<sha256>.<ext>' }`: nem nome, nem pasta, nem a `ref` do disco. Tetos: instância `[A-Za-z0-9_-]{1,80}`, volume 0 a 1, deslocamento até uma semana, fade até 10 s, pré-carga até 32 ids.
- `net/audienciaDosSons.ts` (puro): `destinatarios(alvo, jogadores, telas)`. Todos = jogadores conectados + TV; Só a cena = conectados na cena + TV se `tableScene()` for a cena; Escolhidos = marcados conectados, TV nunca.
- `net/hostBridge.ts`: `tocarSomAoVivo`, `pararSomAoVivo`, `pararTodosOsSons`, `volumeDoSom`, `precarregarSonsAoVivo`, `falhasDoSom`, `midiasDeSomLiberadas`. Loops ativos guardados com alvo, volume e início; `reconciliarSons()` roda em `notifyPlayersIfChanged` (antes do "lista igual", porque a TV não muda a lista), no `broadcastNow` (ficha levada de cena pelo editor, cena da TV trocada) e ao cair: quem entra, volta ou chega recebe `som.tocar` com `deslocamentoS` (o jogador faz `% duração`), quem sai da cena recebe `som.parar`. Efeito curto é evento: lembrado (até 32) só para Parar e volume irem a quem o recebeu, nunca reenviado. Tocar de novo a mesma instância troca o toque e manda `som.parar` a quem ficou fora do alvo novo. O 4º loop é recusado na rede também (`MAX_LOOPS` do motor), porque o mestre pode estar com "Tocar neste computador" desligado. Parar tudo vai a todos os conectados, TV junto.
- `net/ponteDosSons.ts`: registro da rede (a ponte se registra ao abrir a sala e sai ao fechar; a Visão de jogador passa `redeDosSons: false` para a sala de teste não roubar o som da mesa) e `criarPonteDosSons({ motor, rede })`, que toca no motor do mestre e manda à rede. À rede vai um apelido sorteado por efeito (`som-<uuid>`, fixo na vida da ponte para tocar de novo trocar o toque nos dois lados), nunca o id da biblioteca. O que o motor do mestre recusa na hora não vai à mesa.
- `player/playerConnection.ts`: `case 'som.*'` passa pelo parser e chama `ouvirSons(listener)`; `informarSomFalhou(instancia, motivo)` manda o `som.falhou` conferido.

**Decisões**

- **A TV trata os `som.*`** (não ignora): entregues a `ouvirSons` como no jogador, para a F5 instalar o motor nela sem mexer na conexão de novo. A trava de envio da TV ganhou uma exceção, só o `som.falhou`, para o mestre saber que a TV não destravou o áudio (`sem-gesto`). Os `clientId` das TVs saem de `lastHeard` + `session.isTable`: `hostSession.ts` intacto.
- **Segurança do canal**: a ponte descarta calada todo `som.*` vindo de jogador ou TV (objeto) antes da sessão; só o `som.falhou` é lido, e só conta para um toque que foi mesmo para aquela conexão, uma vez por conexão, com teto de 10 por 10 s. Não vira mensagem para ninguém: é só o número do "não tocou para N". `som.*` em forma de texto JSON segue o caminho de qualquer lixo (a sessão não tem caso de som).
- `som.falhou` fica FORA da união `PlayerMessage`: a `routeMessage` da sessão cobre a união inteira (`hostSession.ts:9138`, TS2366 se ela crescer) e a sessão nunca vê a mensagem. A ponte a lê com `parseSomFalhou`; o `send` do jogador aceita `PlayerMessage | SomFalhouMessage`.
- Sem `som.pararTudo` ao fechar a sala: o jogador lê `room.closed` e para os dele (F5).

**Ficou de fora**

- e2e leve: não feito. Nada da F4 é visível numa página: o jogador só entrega a `ouvirSons` (ninguém ouve até a F5) e no mestre nada na tela chama a ponte ainda (o seletor é F5/F6). O e2e só provaria "a página não caiu", o que `playerConnection.sons.test.ts` já prova com o parser de verdade. O `task-sons-ao-vivo-arquivo` da F5 cobre a ponta a ponta.
- O gatilho da pré-carga (ao receber o mapa, favoritos de até 1 MB) e a chamada da ponte pela `PaginaSons`: F5.
- Diagrama da rede dos sons: não desenhado (a linha no `docs/diagrams/INDEX.md` não é desta fatia).

**Revisão da F4 (23/10): decisões**

- **Pré-carga por audiência** (decisão do orquestrador): `precarregarSonsAoVivo(midias, alvo)` manda só a quem o seletor escolheu (Todos, Só a cena, Escolhidos; a TV nunca em Escolhidos). A pré-carga nova troca a anterior; quem passa a ser da audiência (entra, volta, chega à cena) recebe na reconciliação. Motivo: o id é o hash do conteúdo, e com um pacote público de sons o jogador descobre por dicionário qual é o som antes da hora; o argumento do hash de 256 bits NÃO vale para áudio de pacote público. A assinatura ficou `(midias, alvo?)`, com `alvo` ausente = Todos (o padrão do seletor), porque os testes da F4 chamam a forma de um argumento e não podiam ser editados: a F5 passa SEMPRE o alvo de agora.
- **Liberado por conexão**: o host guarda, por `clientId`, os áudios que mandou a ELA (tocar ou pré-carregar); `midiasDeSomLiberadas(clientId)` é o que a F5 confere. Sai na queda, na aba velha trocada (`session.replaced`, sem esperar o `close` do Rust, que também passa por `dropClient`) e ao fechar a sala. Sem `clientId`, a união (só leitura do mestre).
- `som.*` só é descartado calado de quem entrou (TV aceita ou jogador com assento), e antes da marca de "aba de lado"; quem não entrou segue para a sessão, que recusa e derruba como todo lixo.
- O "não tocou para N" de um loop conta quem o ouve AGORA: a reconciliação poda quem caiu ou saiu da cena (a conexão nova conta de novo, se falhar). A TV só ouve "Só a cena" quando a cena escolhida ainda está no mundo (como o `tableView`).
- `stop()` tira a rede do registro e esquece loops e pré-carga ANTES de esperar o `room.closed` sair; nessa espera toda chamada de som responde `sem-sala`.
- **Loops guardados na conexão do jogador**: até 3 loops vivos por instância, repassados a cada nova assinatura de `ouvirSons` com o deslocamento somado à espera (a F5 que monta ou remonta a tela não perde o loop; o mestre não reenvia). O volume que chega sem ouvinte vale no guardado; `som.parar`, `som.pararTudo`, efeito curto na mesma instância, `room.closed`, `kicked`, `session.replaced` e a queda do socket apagam. Efeito curto é evento: não se guarda.
- **Apelidos junto da rede**: o apelido de rede de cada efeito mora num mapa por rede (a ponte da sala), não na instância da ponte: a aba que remonta com loop tocando ainda para o loop antigo. Parar tira o apelido do efeito, Parar tudo tira todos (apagar um efeito na F5 deve chamar `parar`, que poda).
- Motor local aceitou e a mesa recusou (ex.: 4º loop na rede, com loops tocados com "Tocar neste computador" desligado): o local para e a recusa volta para a tela avisar. `sem-sala` não para o local.
- A mutação "ignorar desconectado" em `destinatarios` é equivalente na integração (o `connected` da sessão é exatamente `clientId !== null`, `hostSession.ts` ~11035): o teste de unidade basta.

**Para a F5 auditar (acesso a `/media/<id>`)**

1. Hoje `/media/{id}` só serve `<appData>/midia/` (`desktop/src-tauri/src/net/media.rs:6-8`), e os sons moram em `<aventura>/midia/`: decidir entre copiar o áudio para a mídia do app ao tocar ou pré-carregar, ou uma rota nova no Rust (`programador-rust`). Manter as três defesas do `media.rs`: id estrito, teto por tipo, assinatura e hash conferidos. Se abrir rota para `<aventura>/midia`: resolver o caminho real, não seguir symlink, servir só da aventura aberta.
2. **Autorização por conexão**: servir a cada conexão só os ids de `midiasDeSomLiberadas(clientId)` (o que esta sala mandou a ELA), com o token da conexão conferido no Rust. 200 contra 404 já entrega quais sons existem, então a lista é por conexão, não por sala. Hoje `/media` não pede prova de que a pessoa está na sala (já era assim antes da F4), e não há limite de taxa por IP: as duas coisas entram junto.
3. O jogador monta a URL só de `fonte.midia` já validado (`ehIdDeAudio`), nunca de outro campo; mesma origem.
4. Sem Range: o arquivo de 15 MB sobe inteiro por jogador. Pensar em teto de buscas simultâneas por conexão e medir no túnel (risco da seção 6).
5. Tipo da resposta pelo conteúdo (assinatura), com `X-Content-Type-Options: nosniff`.
6. O motivo do `som.falhou` é de lista fechada; a tela do mestre mostra só a contagem, nunca texto vindo do jogador.
7. Parar tudo no jogador ao ler `room.closed`, `kicked`, `session.replaced` e na queda: o mestre não manda nada nesses casos.
8. A pré-carga só leva ids (favoritos de até 1 MB), nunca nome ou pasta, e não entrega a biblioteca a quem entra.

## F5b (lado TypeScript dos sons ao vivo), 23/10

Contrato congelado em `docs/planos/sons-f5-plano-tecnico-2026-10-23.md` (seções 2 e 3). Feita contra um Rust de mentira: a F5a (rota `/sons/<id>`, chave, `net_send` com `liberar`, `net_sons_aventura`) ainda não existe.

**Decisões**

- `liberar` só vai no `net_send` quando não está vazio: o Rust de hoje e os testes antigos seguem iguais (`net/liberacaoDosSons.ts`, `hostBridge.ts` no `sendToClient`).
- O carregador lê a chave por getter (`conexao.chaveDaMidia`), porque ela muda a cada socket. O 429 tem uma nova tentativa, dentro do prazo, e relê a chave. Nenhuma mensagem de erro leva a chave (`player/carregadorDeSons.ts`).
- O instalador descobre o fim de sessão pelo estado da conexão: closed, kicked, replaced, error (a queda da TV) e reconnecting (a queda do jogador) chamam `pararTudo` (`player/sonsAoVivoDoJogador.ts`).
- iOS: o `play()` do `<audio>` recusado com o contexto já rodando recomeça no toque seguinte. O motor ganhou `aoReporReservas`, e a reserva reposta no toque chama `retomar` (`lib/sons/aoVivo/motor.ts`).
- A faixinha mora em `main.tsx` e em `TableScreen.tsx`, nunca no `PlayerView`. O texto é fixo, sem nada vindo do host. A entrada é de 160 ms, só em opacidade e transform, e sem deslocamento com movimento reduzido. A saída é na hora.
- A pasta da aventura: `informarPastaDosSons` em `net/ponteDosSons.ts` guarda a última pasta que a aba Sons informou. A rede que se registra recebe essa pasta, se houver uma; a rede registrada recebe cada troca. O `hostBridge` só chama `net_sons_aventura` com a sala aberta, e a recusa vira aviso ao mestre. O `hostBridge` continua sem importar store.
- A `PaginaSons` toca, para, Parar tudo, muda o volume e apaga pela ponte, com o alvo Todos (a página ainda não tem seletor). O Ouvir do lápis fica só no computador do mestre. A recusa `limite-de-loops` da mesa mostra o mesmo aviso do motor.

**Ficou de fora**

- O seletor Todos / Cena / Escolhidos na página: o alvo é sempre Todos.
- Quando o último favorito sai, a pré-carga anterior continua valendo no `hostBridge`: o `som.precarregar` vazio é recusado pelo protocolo.
- `docs/diagrams/sons-ao-vivo.html` e o INDEX: o hook pediu a atualização, mas o INDEX é proibido para esta fatia. Fica para o orquestrador.
- A F5a inteira (Rust).

**Para o auditor**

1. A URL sai só do id validado (`ehIdDeAudio`): `carregadorDeSons.ts`, `fetch('/sons/'+id)` relativo, com `redirect:'error'`, `credentials:'omit'` e `mode:'same-origin'`.
2. A chave fica fora de log, de toast e do `som.falhou` (`sonsAoVivoDoJogador.test.ts` confere que a chave não aparece no `som.falhou`).
3. A Blob URL é revogada pelo motor (`revogarUrl` em `criarMotorAoVivoDoNavegador`).
4. A faixinha não mostra texto do host (`FaixaTocarParaOuvir.test.tsx`).
5. O áudio só é liberado a quem recebeu a mensagem; a TV entra no Todos (`hostBridge.liberacao.test.ts`).
6. A chave é zerada em queda, kicked, room.closed, session.replaced, socket novo e detach (`playerConnection.chave.test.ts`).
7. O corpo da resposta tem teto de 15 MB, mesmo quando o `Content-Length` mente (leitura em stream com teto).

## Decisões do usuário em 23/10

- Plano aprovado; começar pela F1 em paralelo com as camadas.
- A TV da mesa também toca os sons (ver seção 2).
