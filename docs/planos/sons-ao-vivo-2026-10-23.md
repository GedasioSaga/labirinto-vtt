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

**Correção da F5b depois da revisão (23/10)**

- **A F5b NÃO entra na main antes da F5a.** Sem a rota `/sons/<id>`, a chave e o `net_sons_aventura` do Rust, o mestre vê "Os sons não vão tocar na mesa" (`hostBridge.ts` ~1800) e o jogador não traz arquivo nenhum. O aviso é consequência da F5a ausente e não foi mexido.
- **Pré-carga em fila** (`lib/sons/aoVivo/motor.ts`): no máximo `PRE_CARGA_MAX_ARQUIVOS` = 4 arquivos (a página manda 4, o aparelho corta o resto), uma busca por vez e só sem outra busca no ar; o toque busca na hora e passa à frente. O 4 vem do contrato da F5a: 30 buscas por 10 s por IP, e os 4 jogadores e a TV podem sair pelo mesmo IP (túnel de uma casa, NAT): 5 x 4 = 20, sobram 10 para os toques. Uma busca de pré-carga por aparelho deixa a vaga do toque nas 2 por chave e nas 6 da sala. O `SOM_PRECARGA_MAX` = 32 do protocolo segue como teto da mensagem.
- **Decodificar adiantado com orçamento**: o teto de 1 MB é do arquivo comprimido (1 MB de MP3 vira ~25 MB). A pré-carga decodifica um arquivo por vez e só enquanto a estimativa (24x os bytes) cabe na metade do orçamento do cache; o resto fica em bytes e decodifica no clique.
- **Evento `carregando`** no motor: sai quando a voz que esperava o gesto sai da espera; a faixinha some na hora, sem esperar o arquivo. Volta a esperar (o `<audio>` recusado no iOS), avisa `esperando` de novo.
- **Mudo**: com o aparelho calado a faixinha não aparece e o `sem-gesto` não vai ao mestre; tirar o Mudo mostra a faixinha.
- **A TV ignora o Mudo e o volume guardados** no `lb-som` daquele navegador e toca no volume padrão (0,35), o de uma TV que nunca guardou nada; o volume da sala é o da própria TV. Escolhido no lugar de um controle de som na TV por ser o menor que fecha: a TV não tem quem mexa nela, e o Mudo guardado vinha de outra página no mesmo navegador.
- **Recusa do motor do mestre depois do clique** (o arquivo não abre no WebView2): a página chama `ponte.parar`, e a mesa para o toque também.
- **Chave da mídia** zerada antes do `setState` de erro (erro do mestre, conta recusada) e no erro `kicked`.
- Hardening opcional: a instância na rede já é `som-<uuid>` sorteado (`ponteDosSons.ts`), nunca o id do efeito. Revogar as Blob URLs no fim de sessão ficou de fora: pede um método novo no `MotorAoVivo` e mexe em todos os motores de mentira dos testes (hoje elas são revogadas no `desmontar`, que roda quando a conexão da página sai).
- Visto no print do e2e (390 px): a faixinha "Toque para ouvir" cobre o chip "Fora das salas" do jogador, no topo. Não mexido (layout da faixinha é da F5b; fica para a revisão de design).

**Fechamento (b) do `/media`, feito pelo lado TypeScript (23/10)**

Achado da auditoria da F5b: `/media/{id}` serve `<appData>/midia` sem chave e sem conferir a sala (também pelo túnel), e o áudio da biblioteca ia parar ali por dois caminhos: a importação (`guardarAudio`) e a abertura da aventura (`importarMidiaDaPasta` copiava todo áudio de `<aventura>/midia`). Quem visse o id num `som.tocar` baixaria o arquivo depois, contornando a liberação por conexão da F5a. Decisão do usuário (23/10/2026, a recomendada: a opção TypeScript barata): o áudio da biblioteca não entra mais em `<appData>/midia`; mora em `<aventura>/midia` e só sai por `/sons/{id}` com a chave.

- **Abrir**: `importarMidiaDaPasta` (`lib/midiaDaPasta.ts`) lê o `sons.json` irmão da pasta DIRETO do disco, não da loja (a abertura corre antes de a loja ler a aventura nova, e a loja ainda teria a anterior), e não traz áudio que ele cita. `audiosCitadosNoTexto` (`lib/sons/biblioteca.ts`) conta todo texto com forma de id ou de ref de áudio, inclusive no efeito torto que a leitura descartaria. Na dúvida (ilegível, versão mais nova, acima de 1 MB, disco recusou) nenhum áudio vem. Sem `sons.json`, igual a antes; imagem nunca muda; o `sons.json` só é lido quando a pasta tem áudio. Nada é apagado: o arquivo continua na pasta.
- **Importar**: `guardarArquivoDeSom(bytes, dir)` grava direto em `<aventura>/midia` (`guardarAudioNaPasta`: mesmo teto e assinatura do `guardarAudio`, nunca escreve por atalho, erro sem caminho). Exceção: a aventura nova ainda sem pasta guarda em `<appData>/midia`, e a primeira gravação leva para a pasta, como antes.
- **Mestre toca**: `criarCarregadorDoMestre` (`lib/sons/aoVivo/carregadorDoMestre.ts`) lê `<aventura>/midia/<id>` com a pasta da loja (`dir`), conferido (tamanho antes dos bytes, assinatura e hash); sem ele lá, `<appData>/midia` (aventura sem pasta, som de versão anterior). **Jogador e TV**: sem mudança, `/sons/{id}` com a chave.
- **Dança**: sem mudança. A música do pino vai para `<appData>/midia` por `guardarAudio` e nunca viajou na pasta (`idsDaMidiaUsada` só leva imagem). Borda: o MESMO arquivo como música da dança e som da biblioteca, aberto em outro computador, não chega mais a `<appData>/midia`, e a dança ali cai no 404 "A música não está mais na sala", o mesmo de qualquer música que não viajou.
- **Fica aberto**: (1) cópias antigas: o áudio da biblioteca que uma versão anterior já pôs em `<appData>/midia` (importado neste computador ou trazido ao abrir) continua lá e continua servido por `/media` sem chave, até o usuário limpar ou até a F5d; (2) o som importado numa aventura nova antes da primeira gravação fica em `<appData>/midia`. Limpeza opcional proposta, NÃO feita: ao gravar, apagar de `<appData>/midia` o áudio que o `sons.json` cita, que já está inteiro e com hash conferido em `<aventura>/midia` e que nenhum pino de dança usa. É barata, mas apaga arquivo global do app e a lista da dança exige ler todas as cenas: pede decisão do usuário.
- **A F5a ainda precisa** da rota `/sons/{id}` (chave, liberação por conexão, `net_sons_aventura`): sem ela o som da biblioteca não chega a jogador nem TV. A F5d continua necessária para fechar `/media` ao áudio da dança e às cópias antigas.
- **Revisão (23/10)**: o som que o mestre só acha em `<appData>/midia` com a pasta aberta volta para `<aventura>/midia` com o hash conferido; se não der, aviso sem caminho ("não toca na mesa"). `guardarAudioNaPasta` só poupa a cópia cujo hash confere: a do mesmo tamanho com outro conteúdo é regravada.
- A chave da mídia no jogador agora aceita só 64 hex minúsculos, como o Rust: maiúscula é torta e a boa de antes fica (`playerConnection.ts`).

## F5a (lado Rust dos sons ao vivo), 23/10

Feita na branch `feat/sons-ao-vivo`, só em `desktop/src-tauri`: `net/sons.rs` (novo), `net/server.rs` (chave, rota, limpeza), `net/commands.rs` (`net_send` com `liberar`, `net_sons_aventura`), `lib.rs`, `tests/net_sons.rs` (novo). Contrato da seção 2 de `sons-f5-plano-tecnico-2026-10-23.md`.

**Como ficou (o que o TypeScript confere)**

- Primeiro frame de toda conexão (jogador e TV): `{"type":"midia.chave","chave":"<64 hex minúsculos>"}`, posto na fila antes de o mestre saber da conexão. 32 bytes de `OsRng`; se o SO não der aleatoriedade, a conexão segue sem chave e sem sons.
- `GET /sons/{id}` com `X-Labirinto-Chave: <64 hex minúsculos>`. Ordem: método, `Host` (IP literal ou o túnel ativo), taxa e simultâneas (429), chave, liberação, caminho real, teto, assinatura e hash.
- 200: `Content-Type` pela assinatura (`audio/mpeg|ogg|wav|mp4`), `Content-Length`, `X-Content-Type-Options: nosniff`, `Cache-Control: private, no-store`, `Cross-Origin-Resource-Policy: same-origin`, `Vary: X-Labirinto-Chave`. Sem Range.
- Toda recusa: o MESMO 404, corpo vazio, `nosniff`, `private, no-store`, `Vary` (teste compara byte a byte, menos `date`). Método que não é GET (HEAD também) e `Host` de fora também caem nele, não em 405.
- 429 com `Retry-After` em segundos inteiros: 1 quando falta vaga simultânea; até 10 (o tempo até a busca mais velha sair da janela) na taxa por IP.
- `net_send({ clientId, msg, liberar? })`: erros `midia-invalida` (id que não é áudio), `limite-de-liberacao` (mais de 32 no envio; desde a correção da auditoria, passar de 256 na conexão NÃO é erro: sai a liberação mais velha), `cliente-invalido` (conexão que o servidor não tem). Sem `liberar`, o de sempre. `net_sons_aventura({ pasta })`: `sem-sala`, `pasta-invalida`.
- Desde a correção da auditoria: fora do túnel, a chave só vale do aparelho (IP, ou o /64 no IPv6) que abriu o socket; a busca de outro aparelho é o mesmo 404.

**Decisões e divergências do plano**

- **Pasta**: guardo `canonicalize(pasta)` + `midia` (não `canonicalize(pasta/midia)`), porque a aventura sem som ainda não tem `midia`. Na leitura, o caminho REAL do arquivo tem de ser EXATAMENTE `<raiz>/<id>`: link ou junção no arquivo ou na própria `midia` leva o caminho para outro lugar e dá 404. Mais estrito que `starts_with`.
- **Pasta recusada tira a anterior** (a sala nunca segue servindo a aventura que o mestre deixou); a mesma pasta de novo não revoga; outra pasta ou `null` revoga tudo.
- **Simultâneas por chave contam a chave como veio no cabeçalho**, antes de saber se vale: o 429 é decidido antes de olhar chave e id. Sem chave ou chave torta dividem um balde de 2. O 429 não conta na taxa.
- **A vaga vive no corpo**: o 200 sai em pedaços de 256 KiB lidos e com o SHA-256 conferido ANTES do primeiro byte (o hash precisa do arquivo inteiro); cada pedaço é solto ao sair, e a vaga só volta quando o último sai ou o cliente desiste. Para isso entrou a dependência direta `futures-core 0.3` (já estava no `Cargo.lock` pelo axum; nada novo baixado). Pico de memória continua 6 x 15 MB.
- **Tempo constante**: a comparação lê sempre os 32 bytes, sem sair no primeiro diferente, e a busca passa por todas as chaves da sala sem parar na que bate (teste conta as leituras). Escrito à mão, sem o crate `subtle`.
- **Tabela de IPs com teto de 4096**: cheia, IP novo recebe 429 até a janela limpar.
- **m4a estrito só em `/sons`**: caixa `ftyp` de 16 bytes ou mais, múltipla de 4, que cabe no arquivo, e marca `M4A `, `M4B `, `mp42` ou `isom` (as mesmas do TS). `/media` fica como está até a F5d.
- `Cache-Control: private, no-store` no lugar de só `no-store`.
- `tests/net_server.rs`: 2 testes passaram a ler o `midia.chave` antes da primeira mensagem.

**Riscos que ficam**

- TOCTOU entre `canonicalize` e `open` (trocar o arquivo por um link no meio): exige atacante local na pasta da aventura, e o hash igual ao id torna inútil (só confirma conteúdo que ele já conhece). Link físico idem.
- Link de ARQUIVO no Windows pede o modo de desenvolvedor: desde a correção da auditoria o caso é o teste próprio `link_de_arquivo_para_fora_e_o_mesmo_404`, `#[ignore]` no Windows (roda com `cargo test --test net_sons -- --ignored` numa máquina com o modo ligado; falha com mensagem se não conseguir criar o link). Nesta máquina ele NÃO rodou; quem barra o link é o `symlink_metadata` do arquivo (`is_file` falso para link).
- A F5d (fechar `/media` ao áudio) continua pendente; o teste `achado_f5d_media_ainda_serve_audio_sem_chave` prova o buraco de hoje e deve ser invertido nela.

**Evidência (23/10)**

- `cargo clippy --all-targets --all-features -- -D warnings -W clippy::unwrap_used -W clippy::expect_used`: exit 0, sem aviso.
- `cargo test --lib --test net_sons --test net_server`: 90 + 11 + 14 passaram, 0 falhas; `--test net_dev_proxy`: 4 passaram.
- 16 mutações, uma por vez (aplicar, `cargo test --lib --test net_sons`, reverter), todas VERMELHAS: comparação que sai no 1º byte (`comparacao_le_sempre_os_32_bytes`, `busca_da_chave_passa_por_todas_as_conexoes`); chave ausente aceita (`oraculo_...`); id fora do liberado (`trocar_a_raiz_...`); link seguido (`symlink_e_juncao_nao_saem`); tipo pela extensão (`tipo_vem_da_assinatura_...`, `le_o_audio_em_pedacos_...`); 403 no não liberado e `no-store` faltando num caminho (`oraculo_...` e outros 5); taxa sem teto (`taxa_por_ip_...`); simultâneas sem teto (`simultaneas_duas_por_chave_...`); vaga solta antes do corpo (`simultaneas_seguram_a_vaga_ate_o_corpo_sair`); queda sem limpeza (`queda_e_kick_apagam_a_chave`); kick sem limpeza (`kick_esquece_a_conexao_dos_sons`); envio falho sem desfazer (`net_send_libera_antes_e_desfaz_se_falhar`); troca de aventura sem revogar (`trocar_a_raiz_...`); liberadas sem teto (`liberadas_por_conexao_tem_teto`); m4a com qualquer marca (`m4a_exige_ftyp_...`).
- Não rodado aqui: o e2e `task-sons-ao-vivo-arquivo` (TypeScript, fica para o orquestrador) e a prova real `tauri dev` + navegador.

### F5a, correção da auditoria de segurança e da revisão (23/10, rodada 2)

Só `desktop/src-tauri`: `net/conexao.rs` (novo), `net/server.rs`, `net/sons.rs`, `net/commands.rs`, `net/mod.rs`, `tests/net_sons.rs`. Commit `899b13c3`.

| Achado | Correção | Prova (teste vermelho na mutação) |
|---|---|---|
| 1 (médio) vaga presa ao corpo sem prazo de escrita | (a) `ListenerDaSala` embrulha todo `TcpStream` em `ComPrazoDeEscrita`: escrita pendente 30 s sem NENHUM byte saindo é erro e a conexão cai, levando corpo, vaga e memória. (b) `CorpoDoSom` com prazo total de 120 s: o fluxo dá erro e solta os pedaços. (c) queda e kick cortam as conexões HTTP que levam corpo para a chave | `escrita_parada_cai_no_prazo`, `cada_byte_que_sai_renova_o_prazo`, `corte_derruba_a_escrita_parada_na_hora`, `prazo_total_vencido_recusa_a_proxima_escrita`, `corpo_vencido_da_erro_e_marca_o_socket`, `busca_parada_cai_no_prazo_e_devolve_a_vaga`, `queda_corta_as_buscas_da_chave`, `kick_esquece_a_conexao_dos_sons` |
| 2 (médio) corrida no `net_sons_aventura` | `SonsDaSala.vez`: cada chamada pega a vez ANTES da conferência (o `None` também); só a vez mais nova muda a raiz | `vez_velha_nao_muda_a_raiz`, `conferencia_velha_nao_passa_por_cima_da_nova` (determinístico: a conferência velha fica presa num canal até a nova terminar) |
| 3 (médio) `Midia` com outra caixa dava 404 no Windows | na leitura: `symlink_metadata(raiz).is_dir()` (recusa junção na `midia`) e o arquivo real tem de ser `canonicalize(raiz).join(id)` | `midia_com_outra_caixa_serve_no_windows`, `juncao_na_midia_nao_sai_nem_para_dentro_da_aventura`, `aventura_trocada_por_juncao_depois_de_aberta_nao_sai` |
| 4 (baixo) chave não presa ao aparelho | `Conexao.aparelho = limit_key(ip)` fora do túnel (`None` pelo túnel); `autorizar` exige o mesmo `limit_key` do pedido | `chave_so_vale_no_aparelho_que_abriu_fora_do_tunel`, caso novo "chave certa de outro aparelho" no `oraculo_...` |
| 5 (endurecimento) chave secreta como chave do `HashMap` | `LimiteDasBuscas` guarda só o SHA-256 da chave | `limite_guarda_o_resumo_e_nao_a_chave` |
| 6 (baixo) 256 liberações travavam todo `net_send` | sai a liberação mais velha; quem é liberado de novo vira o mais novo; o despejo só acontece DEPOIS do envio sair (`confirmar`), então envio que falha não apaga nada | `teto_de_liberadas_tira_a_mais_velha`, `envio_que_falha_no_teto_nao_despeja_nada`, `net_send_no_teto_despeja_a_liberacao_mais_velha` |
| 7 testes | `Retry-After` para cima (6,1 s vira "7"); link de arquivo virou teste próprio ignorado no Windows | `retry_after_arredonda_para_cima`; `link_de_arquivo_para_fora_e_o_mesmo_404` |

**Decisões e divergências desta rodada**

- **(c) corta a conexão em vez de só zerar a conta.** Zerar a vaga na queda deixaria o corpo (até 15 MB) preso no socket parado até o prazo de 30 s; um jogador que reconecta em laço juntaria corpos sem teto (o teto de 6 por sala deixaria de limitar a memória). Cada conexão HTTP tem um `Corte` (no `ConnectInfo`, tipo `ConexaoHttp`): a queda ou o kick o aciona, a escrita parada acorda e dá erro, o hyper derruba a conexão e a vaga volta no `drop` do corpo, junto com a memória. Na prática volta em milissegundos (o teste espera menos de 10 s com prazo de escrita de 30 s).
- **(b) o prazo total vale também no socket.** Com o buffer do hyper cheio, ele não pede pedaço novo ao corpo; um cliente que goteja 1 byte a cada 29 s escaparia de (a) e de um prazo só no fluxo. O `CorpoDoSom` marca o prazo no `Corte` da conexão e o `ComPrazoDeEscrita` recusa a escrita seguinte depois dele (visto no máximo 30 s depois, na próxima escrita). Ao soltar o corpo o prazo sai, e a resposta seguinte da mesma conexão (keep-alive) começa sem prazo.
- **120 s de prazo total**: 15 MB em 120 s pede ~1 Mbit/s; o som típico (até 3 MB) passa com 200 kbit/s.
- **O prazo de escrita vale para toda conexão da sala, inclusive o WebSocket.** Só arma com escrita pendente: quem só está ouvindo não cai; um jogador cujo socket não aceita NENHUM byte por 30 s cai (o navegador lê o socket mesmo com a aba em segundo plano).
- **3: além do pedido, a raiz real tem de continuar na mesma aventura** (`parent` igual ao guardado). Só com `canonicalize(raiz)`, uma junção posta no lugar da pasta da aventura DEPOIS do `net_sons_aventura` passaria (antes era barrada pela comparação com a raiz fixa). Renomear só a caixa da pasta da aventura com a sala aberta dá 404 até o mestre reabrir.
- **2: a chamada velha devolve o resultado da pasta dela, sem aplicar** (`Ok` se a pasta era válida, `pasta-invalida` se não). Quem manda é a vez mais nova.
- **4: pelo túnel não há amarra**, nos dois sentidos: chave de socket aberto pelo túnel vale de qualquer aparelho; chave de socket da LAN pedida pelo túnel cai no 404 (o IP efetivo é outro).
- Os testes de integração passaram a abrir o socket de cada jogador de `127.0.0.<origem>` (`entrar(sala, nome, origem)`), e cada busca sai do aparelho do dono da chave.
- `server::serve` continua com a mesma assinatura; `serve_com_prazo` existe para o teste não esperar 30 s.

**Riscos que ficam**

- **`busca_presa` no macOS**: os testes de vaga presa (`simultaneas_seguram_a_vaga_ate_o_corpo_sair`, `busca_parada_cai_no_prazo_e_devolve_a_vaga`, `queda_corta_as_buscas_da_chave`) contam com 15 MB não caber nos buffers do loopback. No macOS o autoajuste de buffer pode chegar a vários MB por lado (`kern.ipc.maxsockbuf`); se o corpo inteiro couber, a busca não fica parada e esses testes falham ou oscilam lá. No Windows passaram.
- Cliente que goteja: (a) e (b) juntos limitam a vaga a 120 s mais no máximo 30 s.
- O link de arquivo não foi exercitado nesta máquina (sem modo de desenvolvedor).

**Fora do escopo agora**

- **F5d** (fechar `/media` ao áudio e migrar a dança para `/sons`) é a próxima fatia e NÃO bloqueia integrar a F5a.
- **Cache do hash** por (caminho, tamanho, mtime): depois. Hoje cada busca lê e confere o arquivo inteiro.

**Evidência (23/10, rodada 2)**

- `cargo clippy --all-targets --all-features -- -D warnings -W clippy::unwrap_used -W clippy::expect_used`: exit 0, sem aviso.
- `cargo test --lib --test net_sons --test net_server --test net_dev_proxy` (com `CARGO_INCREMENTAL=0` e `CARGO_PROFILE_DEV_DEBUG=0`): lib 106, `net_dev_proxy` 4, `net_server` 14, `net_sons` 13 passaram e 1 ignorado (o link de arquivo), 0 falhas.
- 19 mutações, uma por vez (aplicar, rodar só os testes do achado com `--no-fail-fast`, restaurar e atualizar o mtime), todas VERMELHAS: relógio que não derruba, progresso que não desarma, corte que não acorda, listener sem prazo, socket que ignora o prazo total, fluxo que ignora o prazo, prazo que não vai ao socket, esquecer sem cortar, vez ignorada, `None` sem vez, comparação com a raiz guardada, sem `is_dir` da raiz, sem `parent`, aparelho ignorado, socket que não amarra o aparelho, chave guardada como veio, sem despejo, envio que não confirma, `Retry-After` sem arredondar. A do "corte que não acorda" ficou VERDE na primeira rodada (o `timeout` de 10 s do teste acordava a escrita e ela via o corte); o teste passou a exigir o corte em menos de 5 s (commit `ce523f97`) e a mutação ficou vermelha.
- Depois das mutações: clippy de novo exit 0 e os mesmos 106 + 4 + 14 + 13 (1 ignorado) verdes.

## F5d (fechar `/media` ao áudio + endurecimento da LAN), 24/10

Lado Rust, só `desktop/src-tauri`: `net/conexao.rs`, `net/server.rs`, `net/sons.rs`, `Cargo.toml` (dependência direta `http-body 1`, já no `Cargo.lock`, aprovada pelo orquestrador), `tests/net_conexoes.rs` (novo), `tests/net_sons.rs`, `tests/net_server.rs`. Commit `102aa48c`. Lado TypeScript (a dança por `/sons`): `4a0041f2`, `fe4fd005`.

| Item | Correção | Prova (vermelho na mutação) |
|---|---|---|
| F5d `/media` serve áudio sem chave | `media_file`: id de áudio (`eh_audio`) é o mesmo 404 do id que não existe, antes de tocar o disco; o tipo lido passa por um segundo filtro. Áudio só sai por `/sons/{id}` | `media_nao_serve_audio_f5d` (o antigo `achado_f5d_...` invertido: mp3/ogg/wav/m4a dão 404 byte a byte igual ao ausente, mesmo liberados; `/sons` com a chave serve; a png segue 200), `media_nao_serve_o_audio_nem_dentro_do_teto` |
| 1 prazo total some com o corpo solto (~400 KB presos) | o `drop` do `CorpoDoSom` não tira mais o prazo; o `CorpoVigiado` (middleware `vigiar_pedido`) marca `resposta_saiu`, e o prazo só sai no `poll_flush` do socket (o hyper só o chama com o buffer dele vazio) | `corpo_vencido_da_erro_e_marca_o_socket` (invertido), `resposta_que_saiu_segura_o_prazo_ate_o_socket_escoar`, `escoar_tira_o_prazo_total_e_arma_o_do_cabecalho` |
| 2 sem teto de conexões nem prazo do cabeçalho | `Semaphore` de `CONEXOES_MAX` (128) no `ListenerDaSala::accept`, a vaga mora no socket, a excedente é fechada no aceite; prazo do cabeçalho de 10 s (`PRAZO_DO_CABECALHO`) no `poll_read`, do aceite e de cada resposta escoada até o pedido chegar ao roteador; bytes gotejando não renovam; o 101 nunca volta a esperar | `cabecalho_gotejando_cai_no_prazo`, `cabecalho_que_chegou_nao_tem_prazo`, `sala_cheia_fecha_a_conexao_excedente`, `pedido_que_nao_termina_cai_no_prazo_do_cabecalho`, `keep_alive_ocioso_cai_no_prazo_do_cabecalho`, `websocket_nao_cai_no_prazo_do_cabecalho`, `a_conexao_129_e_fechada_no_aceite` |
| 3 prazo total chegava a ~150 s | o relógio da escrita parada vence em min(sem progresso, prazo total) (`Sleep::reset`) | `prazo_total_vence_a_escrita_parada_antes_do_prazo_sem_progresso` |
| 4 junção na `midia` para a pasta irmã | `caminho_real_confere` exige `raiz_real.file_name()` igual a `midia` (ASCII, sem caixa) | `caminho_real_tem_de_ser_exatamente_raiz_mais_id` (casos `outra` e `MIDIA`) |

**Decisões e divergências**

- **(1) o prazo sai no `poll_flush`, não no início do pedido seguinte** (a sugestão da auditoria). O hyper 1.11 lê o cabeçalho seguinte assim que a resposta termina (`can_read_head` do servidor não olha o buffer de escrita): com pipelining, o pedido 2 zeraria o prazo com o fim do pedido 1 ainda no buffer, e o gotejamento voltaria. O middleware fica, para marcar o fim da resposta e para tirar o prazo do cabeçalho.
- **(2) o prazo do cabeçalho vale também para a keep-alive ociosa** (como o `header_read_timeout` do hyper, que arma a cada cabeçalho). Sem isso, um pedido rápido seguido de silêncio seguraria a vaga para sempre e 128 conexões ociosas fechariam a sala. O navegador reabre a conexão fechada por ociosidade sozinho.
- **Sala cheia fecha na hora** (`try_acquire_owned` depois do `accept`), em vez de esperar vaga antes do `accept`: sem ramo de erro impossível, e a conexão excedente recebe o fechamento em vez de ficar parada no backlog.
- `serve_com_limites(listener, room, LimitesDaSala)` é novo; `serve` e `serve_com_prazo` mantêm a assinatura.

**Riscos que ficam**

- Cliente com pipelining: o prazo do cabeçalho pode armar enquanto o pedido seguinte já roda (o escoar do pedido anterior chega depois do middleware do seguinte); se esse pedido levar mais de 10 s lendo do socket, a conexão cai. Navegador e `cloudflared` não fazem pipelining.
- Comentários no TypeScript ainda citam `/media` para áudio (`lib/sons/aoVivo/motor.ts:13`, `net/ponteDosSons.ts:45`, `net/hostBridge.ts:1153`, `net/protocol.ts:2243` e `:2355`); o código não busca áudio por `/media` (só `ImagemDaMesa` usa `URL_DA_MIDIA_NA_SALA`). São do dono do TypeScript.
- `media::ler_midia` ainda sabe ler áudio (os testes dela usam); a rota é que recusa.

**Evidência (24/10)**

- Tudo pela fila (`suite-lock.cjs --nome f5d-rust`), com `CARGO_INCREMENTAL=0` e `CARGO_PROFILE_DEV_DEBUG=0`.
- `cargo clippy --all-targets --all-features -- -D warnings -W clippy::unwrap_used -W clippy::expect_used`: exit 0, sem aviso.
- `cargo test --all-targets`: lib 112, `net_conexoes` 4, `net_dev_proxy` 4, `net_server` 14, `net_sons` 13 + 1 ignorado (o link de arquivo, ver F5a), 0 falhas.
- 11 mutações em 5 rodadas (cada rodada com mutações de testes disjuntos; restaurar por cópia e atualizar o mtime), todas VERMELHAS: M1 relógio só sem progresso; M2 `resposta_saiu` tira o prazo; M3 `drop` do corpo tira o prazo; M4 `escoou` sem tirar o prazo; M5 `escoou` sem armar o cabeçalho (sozinha também: o keep-alive fica aberto); M6 leitura sem prazo do cabeçalho; M7 `accept` sem semáforo; M8 vigiar também o 101; M9 sem `file_name`; M10 `/media` sem recusar áudio; M11 roteador sem o middleware (o WebSocket cai no prazo do aceite).

## Decisões do usuário em 23/10

- Plano aprovado; começar pela F1 em paralelo com as camadas.
- A TV da mesa também toca os sons (ver seção 2).
- Fechamento (b) do `/media` (recomendado, opção TypeScript barata): o áudio da biblioteca de sons não entra mais em `<appData>/midia`; fica em `<aventura>/midia` e só sai por `/sons/{id}` (ver F5b).
