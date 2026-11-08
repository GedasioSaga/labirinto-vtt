## Mapa

**1. Onde a Preparação entra: tela inicial e barras laterais**
- As portas da tela inicial ficam em `C:/dev/labirinto/client/src/screens/MainMenu.tsx:173-179`: Criar Mapas, Carregar, Roleplay (:176), Livros de regras (:177) e Opções. "Embaixo de Roleplay" é uma porta nova entre :176 e :177. A porta Livros já é opcional pela prop `onLivros?` (:26-27): sem a prop, a porta não aparece.
- O Roleplay hoje é só uma casca "Em construção": `C:/dev/labirinto/client/src/screens/RoleplayScreen.tsx:8-21`.
- Uma tela nova precisa de três coisas:
  - o tipo `Screen` em `C:/dev/labirinto/client/src/types/screen.ts:1`;
  - a tela pai em `C:/dev/labirinto/client/src/lib/navigation.ts:9-19`;
  - o roteamento em `C:/dev/labirinto/client/src/App.tsx:3298-3373` (Roleplay está em :3357).
- Para cumprir "entra no app depois", o caminho é uma flag em `C:/dev/labirinto/client/src/lib/features.ts:10-41`, que esconde sem apagar. Um teste fixa a lista de portas: `C:/dev/labirinto/client/src/screens/MainMenu.test.tsx:25-37`.
- Livro do mestre (barra esquerda do editor):
  - tem quatro marcadores fixos (Ficha, Cena, Aventura, Acervo) em `C:/dev/labirinto/client/src/components/livro/LivroDoMestre.tsx:50-55`;
  - o tipo `PaginaDoMestre` está em `C:/dev/labirinto/client/src/stores/livroDoMestreStore.ts:10`;
  - as páginas são montadas em `C:/dev/labirinto/client/src/components/PropertiesPanel.tsx:1147-1173`.
- Livro da mesa (barra direita): Grupo, Chat, Cenas, Batalha, Mesa e Sons, em `C:/dev/labirinto/client/src/components/livro/LivroDaMesa.tsx:125-135`.
- O Mundo do Livro já resolve o problema de "abrir pela tela inicial e também por cima do mapa":
  - pela porta: sistema → campanha (pasta) → mundo, em `C:/dev/labirinto/client/src/screens/LivrosScreen.tsx:16-22` e :40;
  - pelo editor, com `origem:'editor'`, em `C:/dev/labirinto/client/src/components/PersonagensSection.tsx:388-392`, numa camada própria em `C:/dev/labirinto/client/src/App.tsx:4717`.
- Choque de nome: `C:/dev/labirinto/client/src/components/grimorio/` já existe e é o kit visual do app (classes `gr-*`, `comum.ts:4-8`). Não é o Grimório do usuário, então trazê-lo com o mesmo nome confunde.

**2. Aventura e o que dá para ligar a um nó do mapa mental**
- Uma aventura é uma pasta com `adventure.json` e `scenes/<id>/map.json` (`C:/dev/labirinto/client/src/lib/adventure.ts:11-22`, :127-133). Ela guarda:
  - cenas em árvore (região › cidade › bairro › casa), :30-35;
  - agenda, :57-62;
  - estados do mundo, :63-69;
  - cabines, :70-76;
  - sistema e personagens, :84-91;
  - equipes, :92-97;
  - período, :106-112.
- A página Aventura tem só Pinos, Agenda e Estado do mundo (`C:/dev/labirinto/client/src/components/livro/PaginaAventura.tsx:5-18`, recheio em `C:/dev/labirinto/client/src/App.tsx:3651-3687`). Não existe roteiro de sessão.
- Alvos de link com id estável:

| Alvo | Id e como chegar lá |
|---|---|
| Cena | `scene_<uuid>` (`adventure.ts:131-133`); `switchScene` em `C:/dev/labirinto/client/src/stores/adventureStore.ts:402` e :1866 |
| Pino | cena + pino; `goToPin` (`adventureStore.ts:415`, :1903); nome do local em `C:/dev/labirinto/client/src/types/map.ts:830-840` |
| Sala, pino ou ficha em outra cena | busca em `C:/dev/labirinto/client/src/lib/buscaNaAventura.ts:6-50` + `irAoAchado` (`App.tsx:192`, :3788) |
| Token → ficha | `Token.characterId` (`types/map.ts:1447-1449`) |
| Personagem ou NPC | `Personagem.id` e `tipo` (`C:/dev/labirinto/client/src/lib/personagem.ts:110-122`) |
| Evento da agenda | `id` (`C:/dev/labirinto/client/src/lib/agendaDaCampanha.ts:45-55`) |

- O editor sabe a que pasta o mapa aberto pertence (`adventureStore.ts:225-233`).

**3. Mundo do Livro e Acervo**
- O Mundo do Livro só tem fichas: Jogadores, NPCs de combate, Comparar, Saúde, Itens e habilidades, Anotações e Arena (`C:/dev/labirinto/client/src/components/livros/MundoDoLivro.tsx:38-46`), mais o assistente de IA (:23-31).
  - Anotações é uma `notaDoMestre` por ficha, que só o mestre vê (`C:/dev/labirinto/client/src/components/livros/PaginaAnotacoes.tsx:7-16`; `personagem.ts:171-192`).
  - Só abre no One Piece ou Dragon Ball, e numa pasta com Sistema universal (`LivrosScreen.tsx:42-49`, :76-102).
- Lugares e facções não existem como verbete:
  - um lugar é uma Região dentro de uma cena;
  - uma facção é só um rótulo de até 40 letras por Sala, mais o alerta da cena (`C:/dev/labirinto/client/src/lib/faccoes.ts:4-17`, :55-58).
- O Acervo é do app inteiro, não da campanha (`C:/dev/labirinto/client/src/components/livro/PaginaAcervo.tsx:21-31`):
  - tokens em `<appData>/tokens/acervo.json` (`C:/dev/labirinto/client/src/lib/tokenLibrary.ts:38-40`);
  - itens em `<appData>/itens/itens.json` (`C:/dev/labirinto/client/src/lib/acervoDeItens.ts:7-16`);
  - catálogo do livro por sistema em `<appData>/livros/<sistemaId>/catalogo.json` (`C:/dev/labirinto/client/src/lib/livros/catalogoNoDisco.ts:1-4`).
- Já existe um Markdown seguro, sem link, imagem nem HTML, em `C:/dev/labirinto/client/src/lib/marcacaoLeve.ts:1-12`. Serve para escrever verbetes, mas falta o `[[link]]` do Obsidian.

**4. Onde os dados moram e como a nuvem sincroniza**
- No disco do app ficam `<appData>/pastas/indice.json`, `<appData>/pastas/<id>/rpg.json` (sistema, personagens, equipes, treino) e `<appData>/pastas/<id>/midia/` (`C:/dev/labirinto/client/src/lib/pastasDeMapas.ts:10-33`, :66-83). Cada mapa é achado pela chave da pasta dele em `<appData>/maps` (:26-28, :52-58). A mídia da aventura é copiada para `<pasta da aventura>/midia/` (`C:/dev/labirinto/client/src/lib/midiaDaPasta.ts:12-35`).
- **Armadilha:** os leitores aceitam só as chaves que conhecem. Qualquer chave nova some no próximo Salvar:
  - `parseAdventure`, em `adventure.ts:288-305`;
  - `rpgDoArquivo` e `serializarRpg`, em `pastasDeMapas.ts:265-272` e :321-330.

  Dado novo precisa entrar nesses leitores ou morar num arquivo próprio.
- Uma campanha do Lobby é uma pasta, registrada em `<appData>/nuvem/campanhas.json` (`C:/dev/labirinto/client/src/net/nuvem/estadoNoDisco.ts:7-19`, :164-168).
- O publicar começa em `C:/dev/labirinto/client/src/screens/PastaDeMapasConfig.tsx:134` (JogadoresDoLobby) e passa por `publicarPasta` em `C:/dev/labirinto/client/src/components/nuvem/ponteDoLobby.ts:283`.
- A sincronia ao vivo hoje é **só de fichas**, uma mudança por campo (`C:/dev/labirinto/client/src/lib/nuvem/tipos.ts:6-15`). A mudança passa por dois pontos de captura (`C:/dev/labirinto/client/src/net/nuvem/emissor.ts:12-22`), pelo sincronizador (`C:/dev/labirinto/client/src/net/nuvem/nuvemNoApp.ts:21-28`) e chega ao DO Campanha. Lá a entrada HTTP fica em `C:/dev/labirinto/lobby/nuvem/src/campanha.ts:224-256`, e as mensagens do WebSocket (ola, ops, chat, mural, duelo, luta, livro) em :850-875.
- O banco do DO (`C:/dev/labirinto/lobby/nuvem/src/esquema.ts:18-213`) tem membros, fichas (`visivel` = mesa, treino ou mestre), ops, chat, mural, duelos, lutas e mídia. **Não há** tabela de enciclopédia, mapa, conexão nem cartaz.
- O modelo de "só o revelado" a copiar:
  - a ficha sobe inteira e o servidor tira os campos do mestre na saída (`tipos.ts:142-153`; `C:/dev/labirinto/client/src/lib/nuvem/projecao.ts:10-24`, :47-57);
  - quem vê o quê é decidido por `visivel` (`C:/dev/labirinto/client/src/lib/nuvem/permissao.ts:34-41`);
  - o mestre confere com "Ver como jogador" (`C:/dev/labirinto/client/src/lib/nuvem/verComo.ts:8-26`).
- Imagens de cartaz ou mapa usam `midia:<sha256>.<ext>`, enviada à parte e servida em `GET /api/c/:id/midia/:midiaId` (`C:/dev/labirinto/lobby/nuvem/src/rotas.ts:32-40`; `C:/dev/labirinto/client/src/net/nuvem/midiaNaNuvem.ts:8-26`). O teto é 2 MB por imagem e 300 MB por campanha (:39-41).
- O site tem as rotas `/c/:id`, fichas, ficha, chat, mural e treino (`C:/dev/labirinto/client/src/lobby-site/dados/rotas.ts:4-41`). O saguão da mesa está em `C:/dev/labirinto/client/src/lobby-site/telas/lobby/TelaLobby.tsx:86-96`, e os atalhos em `.../lobby/AtalhosDaMesa.tsx:10-16`.

**5. Tempo da campanha e mural**
- Agenda: a hora da mesa é dia + apito (Aurora, Meio, Brasa, Sombra). Os eventos têm data, avisam o mestre e podem tocar um alarme nas cenas (`agendaDaCampanha.ts:1-12`, :16-62).
  - Mora em `Adventure.agenda` e nunca vai ao jogador (`adventure.ts:57-62`).
  - A tela está em `App.tsx:3659-3668`.
- O período Dia/Tarde/Noite está em `adventure.ts:106-112` e `C:/dev/labirinto/client/src/lib/periodo.ts:16-19`. O controle sem sala aberta fica no painel Grupo (`C:/dev/labirinto/client/src/components/RoomPanel.tsx:1511-1512`).
- Rastros do que aconteceu na mesa:
  - Diário de viagens, só do mestre (`C:/dev/labirinto/client/src/lib/travelLog.ts:1-20`), aparece na página Mesa (`C:/dev/labirinto/client/src/components/livro/PaginaMesa.tsx:13`);
  - quem recebeu e quem leu cada pino (`C:/dev/labirinto/client/src/net/hostSession.ts:1576-1579`), com o painel escondido em `features.ts:19-20`.
- Mural do Lobby:
  - só o mestre posta, edita e fixa; todos leem e reagem;
  - cada notícia tem até 4.000 letras e imagem opcional; notícia fixada vira aviso;
  - código em `C:/dev/labirinto/lobby/nuvem/src/mural.ts:36-52` e `C:/dev/labirinto/client/src/lib/nuvem/muralDoLobby.ts:9-28` e :50-75; tabelas em `esquema.ts:127-158`;
  - o mestre posta pelo site (`C:/dev/labirinto/client/src/lobby-site/telas/mural/TelaMural.tsx:15`, :95). O app do PC não tem tela de mural.

**O que dá para reaproveitar e o que falta**
- **Mapa mental:** não existe nada parecido (nenhum editor de nós). Falta tudo: modelo, tela e links.
- **Linha do tempo:**
  - já existem a Agenda, o período e o Diário de viagens;
  - falta a linha visual, datas e eras livres, e o link do evento a cenas e personagens.
- **Enciclopédia revelada:**
  - já existem a projeção com `visivel`, o Ver como, o mural, o `marcacaoLeve`, as pistas da mesa local e o "Mostrar agora a…" (`C:/dev/labirinto/client/src/net/hostBridge.mostrarPista.test.ts:1-5`);
  - falta o verbete em si, o "revelado" por verbete e por conta, as tabelas e mensagens no DO, a rota no site e o `[[link]]`.
- **Mapa-múndi:**
  - já existem a cena Continente (`types/map.ts:2353-2386`), Exportar PNG (`LivroDoMestre.tsx:280`) e o "Baixar meu caderno", que monta a planta que o jogador conhece (`C:/dev/labirinto/client/src/player/meuCaderno.ts:1-12`);
  - falta uma imagem com só o revelado no servidor e pinos clicáveis no site.
- **Mapa de conexões:**
  - só existem as equipes da batalha e o rótulo de facção por Sala;
  - falta a relação entre pessoas e facções e a tela de grafo.
- **Cartazes de procurado:**
  - já existem retrato (mídia), nome e descrição na ficha, e notícias com imagem;
  - falta o campo de recompensa e situação, o desenho do cartaz e a publicação.

## Como se conecta
- No editor, a tela inicial leva ao editor, que tem o Livro do mestre à esquerda e o Livro da mesa à direita. A aventura sabe a que pasta pertence, e a pasta é a campanha do Lobby.
- Por isso a Preparação deve morar por pasta, num arquivo próprio em `<appData>/pastas/<id>/`. Os links usam o par chave do mapa + cena, mais o pino, token ou personagem.
- Caminho do dado até o site: disco → captura (hoje só de fichas) → fila → Rust (`nuvem.rs`) → portão do site (`C:/dev/labirinto/lobby/site/functions/api/[[rota]].ts`) → DO Campanha (SQLite) → WebSocket → site, já filtrado pelo papel de quem vê.
- Para mostrar só o revelado há dois caminhos:
  - **(a) filtrar no app** e subir só o que foi revelado: o segredo nunca sai do PC;
  - **(b) copiar o modelo das fichas:** sobe tudo e o DO filtra na saída. É o que as fichas fazem hoje.

## Pontas soltas
- O Grimório não foi olhado: o escopo desta tarefa era só o Labirinto.
- Não li por dentro `SceneOverview.tsx` e `MapPreview.tsx`. Falta confirmar se servem de miniatura fora do editor.
- Não conferi `C:/dev/labirinto/lobby/site/src/portao.ts` nem `client/public-lobby/_routes.json`. Uma rota HTTP nova talvez precise entrar neles; uma mensagem nova do WebSocket entra em `campanha.ts:850-875`.
- Não li o corpo de `irAoAchado` (`stores/buscaDoMestre.ts`) nem dos leitores de `pastasDeMapas.ts:479-492` (a fila de gravação por pasta).
- Nenhum diagrama foi gerado (este agente só lê). Os que já existem: `C:/dev/labirinto/docs/diagrams/lobby-arquitetura.html` e `C:/dev/labirinto/docs/diagrams/periodo-da-sessao.html`.
- Não é bug, mas é risco: `C:/dev/labirinto/client/src/lib/adventure.ts:288-305` apaga em silêncio qualquer chave nova do `adventure.json`. Se outra ferramenta, como um Grimório importado, gravar algo ali, isso some no próximo Salvar.