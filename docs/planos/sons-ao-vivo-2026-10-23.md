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
- "Só a cena atual" vira, no clique, a cena aberta no editor (o seletor mostra "Só a cena: Taverna"). A tela da mesa ignora som na v1.
- Sincronia: sem acerto de relógio; efeito curto toca quando chega (menos de 100 ms na LAN, 100 a 400 ms pelo túnel). Loop pego no meio começa em `deslocamentoS % duração`. Efeito curto esperando toque há mais de 2 s é descartado.
- Jogador: `case 'som.*'` no `playerConnection` e `ouvirSons(listener)`; `player/sonsAoVivoDoJogador.ts` instalado em `player/main.tsx` ao lado de `:2321`.
- Motor compartilhado em `lib/sons/aoVivo/motor.ts`: o mestre lê do disco (`lerAudioGuardado`), o jogador busca `fetch('/media/<id>')`. Cache em duas camadas (bytes e áudio decodificado): até 1 MB decodificado (corte total cerca de 150 MB no PC e 60 MB no celular); acima de 1 MB vira Blob tocado por `<audio>` ligado ao Web Audio (pular para o meio, porque `/media` não tem Range). Limites: 8 sons simultâneos, 3 loops, 2 YouTube; efeito curto acima do limite derruba o mais antigo, loop acima do limite é recusado no mestre com aviso. Saída própria `aoVivo` no `contexto.ts` sem o passa-baixa. Volume final = volume do efeito × volume do aparelho (`somStore`); Mudo zera o ganho sem parar o loop; Parar faz fade de 150 ms.
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
| F5 | Jogador toca e faixinha | `player/sonsAoVivoDoJogador.ts`, `FaixaTocarParaOuvir.tsx`, `player/main.tsx` | e2e `task-sons-ao-vivo-arquivo`: `tocar` antes do gesto mostra a faixa, o toque começa no deslocamento; `ControleDeSom` muda o ganho do loop; 1 só busca de `/media` para 2 toques; pré-carga dos favoritos pequenos | nenhum |
| F6 | YouTube (medir antes do código) | `lib/sons/youtube/*`, motor, `PaginaSons` (colar link), `protocol.ts` | lê 8 formatos e recusa o resto; API falsa: `ENDED` com loop volta a `inicioS`; erro 150 vira aviso no mestre; e2e com `iframe_api` em stub local | nenhum |
| F7 | Fechamento | INDEX, jornada, medições | suíte completa 1 vez; 4 jornadas seladas das camadas verdes; teste no browser | nenhum |

Medição da F6 antes do código (só leitura, sem commit): (a) o iframe no WebView2 (`http://tauri.localhost`) dá erro 153? Se der, o player do mestre carrega por uma página servida pelo servidor da sala (`127.0.0.1`), que só existe com a sala aberta, e essa página é do `programador-rust`; (b) navegador do jogador em LAN http e pelo túnel https; (c) iPhone Safari.

## 6. Riscos e como medir

- Autoplay e celular: contexto suspenso com a tela bloqueada, `<audio>` no iOS só toca se destravado. Medir num iPhone e num Android de verdade; o mestre vê quantos jogadores não destravaram (`som.falhou` com `sem-gesto`).
- Banda do túnel Cloudflare: 5 MB para 4 jogadores são 20 MB subindo do mestre. Medir o tempo até o primeiro som com 1 e 5 MB e 4 abas, pelo túnel e com banda limitada; se passar de 3 s para 1 MB, aumentar a pré-carga.
- Teto de 15 MB e aventura gorda: a importação recusa com `AUDIO_GRANDE_DEMAIS`; a página mostra o total em MB da pasta de mídia e avisa acima de 200 MB.
- Memória do áudio decodificado no celular: medir o heap com 3 loops e 5 efeitos curtos e ajustar o limite de 1 MB.
- Travada: p95 do quadro com 8 sons e a aba aberta, nenhuma tarefa longa de 200 ms ou mais.
- Política do YouTube: risco aceito pelo usuário. Na prática o erro mais comum é o 150 (vídeo ou região), que chega ao mestre por `som.falhou`.
- Convivência com as camadas: nenhuma fatia edita arquivo quente. Se `LivroDaMesa.tsx` ou `keymap.ts` entrarem no escopo da fatia 6 das camadas, combinar a vez antes da F3.

## Pendente de decisão do usuário

- A tela da mesa (a TV) toca os sons? Na v1 ela ignora (como faz com a dança).
