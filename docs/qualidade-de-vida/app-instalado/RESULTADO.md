# Teste visual no app instalado (Labirinto 0.6.1)

26/11/2026, 17h09-17h26 (hora dos prints). App instalado já aberto com depuração remota do WebView2 (`http://127.0.0.1:9222`), dirigido por cliques, arrastos e teclas reais com Playwright (`chromium.connectOverCDP`, `playwright` 1.62.1 do `node_modules` da raiz do repo; nada instalado). Janela de 1280 x 800. Nenhum código editado.

## Resumo por área

| Área | Veredito | Prints |
|---|---|---|
| 1. Criar Mapas | FUNCIONOU (com 1 comportamento confuso no Balde) | `criar-mapas-01` a `04` |
| 2. Carregar Mapa | FUNCIONOU EM PARTE (lista e reabrir ok; a lista de mapas não tem miniatura; Visão geral ainda com miniatura antiga) | `carregar-mapa-01` a `04` |
| 3. Prelúdio | FUNCIONOU | `preludio-01` a `03` |
| 4. Livros de regras | FUNCIONOU, com 1 bug de layout | `livros-01` a `03` |
| 5. Batalhas | FUNCIONOU (sem ficha ligada: não havia ficha de exemplo no mapa de teste) | `batalhas-01` a `03` |
| 6. Site do Lobby | FUNCIONOU EM PARTE (abre a tela de login do Cloudflare Access, sem a opção do Google) | `site-lobby-01` |

Mapa de teste: **TESTE-CLAUDE apagado** pela tela Carregar Mapa (o diálogo dizia `Apagar "TESTE-CLAUDE"? O arquivo é removido do disco...`; toast `"TESTE-CLAUDE" apagado.`). Depois disso, nenhum arquivo em `%APPDATA%/com.labirinto.app/maps` contém "TESTE-CLAUDE", "Porão de teste" ou "Teste Goblin". App deixado aberto na tela inicial.

## 1. Criar Mapas: FUNCIONOU

- Novo mapa "TESTE-CLAUDE", 16 x 12, grade quadrada (`criar-mapas-01`).
- Sala (arrastar), Porta (clique na parede da sala: entrou na lista "Neste mapa" como "Porta fechada · Sala 1"), Chão em Retângulo (tinta Pedra, material Calçamento) e Chão em Balde (grama na área vazia), Objeto por clique (Mesa) e **arrastado da lista** (Baú de ferro: a etiqueta com o nome segue o cursor e o baú cai onde soltou) (`criar-mapas-02`).
- Esc soltou a ferramenta (Objeto e Porta voltaram para Selecionar). Ctrl+S mostrou "Mapa salvo" (`criar-mapas-03`); o mapa apareceu depois em Carregar Mapa e reabriu com tudo.
- Ctrl+Z desfez o balde.

## 2. Carregar Mapa: FUNCIONOU EM PARTE

- A lista mostra as pastas do dono e o TESTE-CLAUDE em "Fora das pastas" (`carregar-mapa-01`). **A lista de mapas não tem miniatura nenhuma** (nem `img` nem `canvas` na tela; o código de `LoadMapScreen.tsx` também não tem). As miniaturas novas (commit `4f98792d`) estão na **lista de Cenas** dentro do mapa.
- Reabrir o TESTE-CLAUDE: abriu com sala, porta, chão, objetos e os 2 tokens.
- Miniatura da lista de Cenas (aparece com 2+ cenas, chave "Miniaturas"): **com textura e objetos** (calçamento de pedra, mesa, baú, sem tokens), 256 x 192 (`carregar-mapa-04`, extraída da imagem da tela). Enquadramento: o mapa inteiro, o que é o certo aqui porque a grama cobre o mapa todo.
- Visão geral (Cenas > Visão geral): o filtro funciona ("porão" acha "Porão de teste", sem diferenciar maiúscula; "xyz" mostra "Nenhuma cena com "xyz"") (`carregar-mapa-03`).

## 3. Prelúdio: FUNCIONOU

- Ctrl+Alt+P na tela inicial: 1ª vez "Prelúdio desligado neste PC." e a porta some; 2ª vez "Prelúdio ligado neste PC." e a porta volta. Deixado **ligado**, como estava (`preludio-01`).
- Abri e só olhei: Início, Enciclopédia (`preludio-02`) e o quadro da "Sessão 3: Reino de Goa" (`preludio-03`). Nada digitado.
- Ao abrir, o próprio app rodou a cópia diária no Google Drive ("Copiando…" e depois "Nada mudou desde a última cópia"). Esperei acabar antes de sair. O print da página inicial do Prelúdio não foi guardado porque mostra o e-mail da conta.

## 4. Livros de regras: FUNCIONOU, com 1 bug

- Livro One Piece (pasta do dono): Itens com o sistema novo ("Do Acervo": boomerang "volta para a mão", granada e balas gastas da mochila, consumíveis) (`livros-01`); NPCs de combate > Zumbi (`livros-02`); ficha do Zumbi só para ver, fechada com Esc (`livros-03`). Nenhum botão de editar, +/- nem seletor tocado.

## 5. Batalhas: FUNCIONOU

- Dois tokens de teste ("Teste Guerreiro" e "Teste Goblin"). **Sem ficha ligada**: o mapa de teste não tinha sistema nem personagem (o seletor Personagem só tinha "— sem personagem"); não liguei ficha do dono.
- Iniciar batalha: o aviso diz "Teste Guerreiro e Teste Goblin estão sem ficha e ficam fora: ligue uma ficha no token…" (`batalhas-01`). A abertura "Espadas cruzadas · Royals" tocou (preferência do dono mantida).
- Mesa da batalha reduzida, ao lado do mapa: "Ninguém na ordem." (`batalhas-02`).
- Mais > "Encerrar batalha…" pede confirmação ("Continuar a batalha" / "Encerrar a batalha") (`batalhas-03`); confirmei e a cena voltou para "Iniciar batalha".

## 6. Site do Lobby: FUNCIONOU EM PARTE

- Aba nova no mesmo WebView2 pelo CDP: funcionou, e a aba foi fechada depois. `https://labirintolobby.pages.dev` responde 302 para a tela do Cloudflare Access "Log in to labirintolobby - Cloudflare Pages", **só com e-mail + "Send login code"** (`site-lobby-01`). Também com `curl` sem cookie.

## Bugs e estranhezas novas

Certeza alta = vi acontecer. Incerto = vi, mas não sei se é de propósito ou o que está certo.

1. **Livros > NPCs de combate: o nome do NPC sai uma letra por linha** ("Z u m b i"), com o Assistente do mestre aberto em 1280 px. O `h3.mu-bes-det__nome` mede **0 px de largura** (132 px de altura): a coluna do nome encolhe até zero ao lado de "Abrir ficha / Só no cenário / lixeira". Esperado: nome numa linha. Certeza alta (`livros-02`).
2. **Visão geral das cenas ainda usa a miniatura antiga**: SVG chapado (1 rect, 7 paths, 2 círculos) sem o calçamento de pedra, sem mesa nem baú, e com os tokens. A lista de Cenas já usa a nova (`carregar-mapa-02` x `carregar-mapa-04`). Certeza alta sobre o que aparece; incerto se a Visão geral entrava no pedido de 25/11.
3. **Visão geral com 1 resultado no filtro: o cartão estica na largura toda** (cerca de 870 px de largura) e o nome da cena fica fora da tela, só aparece rolando (`carregar-mapa-03`). Certeza alta.
4. **Lobby sem a opção do Google**: a tela do Access só oferece código por e-mail, e o nome da aplicação é "labirintolobby - Cloudflare Pages". O PEDIDOS (U0) fala em Google como provedor e em entrar com o Google. Certeza alta sobre a tela; incerto se a configuração mudou de propósito.
5. **Chão > Balde: com a tinta Grama escolhida, pintou marrom**, porque o balde pinta na camada ativa ("Pintando em Camada 1", que nasceu Terra) e a tinta só vale para camada nova (`lib/camadasDoPincel.ts`). Com "+ Nova camada" antes, pintou verde. Do jeito que foi feito, mas a tinta destacada promete outra cor (`criar-mapas-04`). Certeza alta; incerto se é bug.
6. **Prelúdio > quadro da sessão mostra a marca "Get a license for production"** no canto de baixo à direita (marca d'água do tldraw sem licença) (`preludio-03`). Certeza alta; incerto se já era conhecido.
7. Contagens que não batem (incerto, pode ser que contem coisas diferentes): Carregar Mapa diz "One Piece · 23 jogadores" e "Dragon Ball · 1 jogador"; Livros de regras diz 11 e 0 jogadores. No livro, a aba Itens diz 41 e o filtro "Todos" diz 39.
8. A ficha do Zumbi no livro está com **HP 78/300** (o modelo do livro machucado). Incerto: pode ser resto de uma batalha antiga, de antes de "zumbis com ficha própria".
9. Depois de iniciar a batalha, a seleção passou do token "Teste Guerreiro" para a "Sala 1" sem clique meu. Incerto: não reproduzi.
10. O chão em Retângulo não aparecia 700 ms depois de soltar o mouse e apareceu no print seguinte. Incerto: medi uma vez só.
11. Menores (visual): no toast "Mapa salvo" o × fica sozinho numa linha embaixo do texto; a seta de recolher pasta em Carregar Mapa (▾ de 13 px) parece um ponto; o cabeçalho da batalha diz "One Piece" num mapa sem sistema escolhido.

## O que foi tocado

- Criado, editado e apagado: só o TESTE-CLAUDE (com a cena "Porão de teste" dentro dele).
- Dados do dono: nada editado, salvo, apagado ou movido. Pastas, livros, fichas, itens e sons só olhados. Mesa online não aberta; nada enviado ao Lobby.
- Arquivos do app alterados durante a sessão, fora o mapa de teste: `preludio-copia/ultima.json` (a cópia diária automática ao abrir o Prelúdio) e `nuvem/camp_…/estado.json` (17:07, da sincronização do app, antes da minha primeira ação). Os `maps` do dono têm data de 11:49 e 12:05.
- Ctrl+Alt+P deixado ligado, como estava.

## O que ficou de fora

- Batalha com ficha ligada: não havia ficha de exemplo no mapa de teste, e ligar uma ficha do dono poderia mexer nela.
- O "Enter" e o arrasto por teclado nas listas, o Desfazer da batalha e a janela "Em janela" não foram testados.

---

# Passeio 2: mestre e jogador nas áreas que faltaram (Labirinto 0.6.1)

26/11/2026, 19h06-19h29 (hora dos prints). Mesmo jeito do passeio 1: app instalado aberto, Playwright `connectOverCDP` em `http://127.0.0.1:9222` (`playwright` 1.62.1 do `node_modules` da raiz; nada instalado), cliques, arrastos e teclas reais. Janela do mestre 1280 x 800; janela do jogador 1100 x 750. Nenhum código editado.

## Resumo por área

| Área | Veredito | Prints |
|---|---|---|
| 1. Sala de jogadores na rede local | NÃO DEU PARA TESTAR a sala de rede (bloqueada nesta sessão, ver abaixo). Pelo substituto local, a **Visão de jogador**: FUNCIONOU EM PARTE (ficha, andar, pino, chat, dados e inventário sim; batalha do lado do jogador não apareceu) | `p2-sala-01` a `03` |
| 2. Sons | FUNCIONOU | `p2-sons-01`, `02` |
| 3. Tela inicial e ficha do mestre (Mochila e equipamento, Condições) | FUNCIONOU, com atritos de uso | `p2-inicio-01`, `p2-ficha-01`, `02` |

## 1. Sala de jogadores: a sala de rede não foi aberta

- Montei o TESTE-CLAUDE-2 fora das pastas (16 x 12, sistema One Piece), com 2 personagens de teste do próprio mapa ("Teste Jogador", tipo Jogador, HP 30 e SP 10; "Teste Inimigo", tipo NPC, HP 20), 2 tokens ligados a eles e 1 pino "Placa velha" com texto.
- Conferi no código que a sala desse mapa ficaria **só na rede local**: o Lobby só recebe a sala quando a pasta aberta está publicada lá (`App.tsx:1436` + `campanhaDaPastaAberta`, `App.tsx:478`), e mapa fora das pastas dá `null`. O "Tornar pública" fica no Convidar e eu não ia tocar.
- **O clique em "Abrir mesa online" foi barrado pelo controle de permissões da sessão** (o classificador automático recusou abrir o servidor). Não tentei contornar. Por isso **não testei**: sala aberta, link local, entrar como jogador por aba nova, fechar a sala. Para testar isso, o dono precisa liberar essa ação, ou fazer à mão.
- **Substituto usado: "Visão de jogador"** (botão do topo da Mesa online). Abre uma janela local do app ("Teste — nada fica no jogo"), sem rede, que mostra o jogo como o jogador vê. Tudo abaixo foi feito nela.

### Como jogador, na Visão de jogador

- **Achar a própria ficha:** a lista "Escolher a ficha" abre com Enter. O botão **Ficha** abre a ficha One Piece (HP 30/30, SP 10/10, com botão Editar). O botão **"Minha ficha"** (ícone de mira) só centraliza o mapa no token: o nome promete outra coisa.
- **Andar:** arrastar o token funcionou. Ele chegou ao lado do pino. Na tela do mestre aparece um fantasma "Teste" ligado à ficha real por uma linha pontilhada. Ficou bom: o mestre vê onde o testador está sem que nada mude no jogo.
- **Ler o pino:** o clique no "!" abriu o quadro "Placa velha", com o texto em máquina de escrever e o botão PULAR (`p2-sala-01`). **Ao mesmo tempo** abriu, atrás, um cartão "Ponto de interesse" com o mesmo texto. O Enter fechou o quadro e o Esc fechou o cartão: são duas camadas para um pino só.
- **Chat:** abas Cena e Global, o Enter envia, a mensagem aparece com a hora. Ela **não chegou** ao Chat do mestre (talvez de propósito no modo de teste).
- **Dados:** escolhi d20, quantidade e modificador, e cliquei em Rolar. O resultado "Teste Jogador 1d20 = 20" sai num selo pequeno no canto de baixo à direita, longe do botão. **O selo não sumiu**: ficou na tela por minutos, até eu fechar a janela. A aba Dados não guarda histórico, e o mestre não viu a rolagem.
- **Inventário novo (tecla I):** grade de 16 vagas, com retrato, nome, "Bem" e atalhos (setas, Enter, Esc, I). Na primeira abertura mostrou **"Nada na mochila"** (`p2-sala-02`), porque a ficha tinha perdido os itens (bug 3). Quando dei a Porção Grande de novo, ela apareceu **ao vivo** no inventário e em "Comigo", com Dar item e Largar.
- **Batalha com o jogador dentro:** "Iniciar com 2" funcionou (a abertura do dono tocou). O NPC veio primeiro. O ataque "Mão nua" saiu como "0 sem reação" na hora, sem perguntar nada ao jogador. Na **vez do jogador** (vez 2 de 2), a janela dele **não mostrou** menu da vez, mira nem reação. Só apareceu "Em batalha: Medir, Círculo, Cone, Visão" e "Você andou 0 blocos" (`p2-sala-03`). Fechei e reabri a Visão no meio da batalha, e nada mudou. Encerrei pelo Mais > "Encerrar a batalha". Por isso **mirar e reagir ficaram sem teste**.

## 2. Sons: FUNCIONOU

- Painel Sons com 62 músicas e 8 efeitos, **todas pelo YouTube** (o som depende de internet).
- Volume de 25% para **10%** pelas setas do teclado. A faixa "Fim" tocou **~3,4 s**, com "1 tocando" e a faixa destacada (`p2-sons-01`). "Parar tudo" parou, e o botão voltou a ficar desabilitado.
- **Abrir em janela:** abriu a janela "Sons · Labirinto" (420 x 760) com o volume em 10, já sincronizado (`p2-sons-02`). No livro ficou "Sons abertos em janela", com "Trazer de volta" e "Mostrar a janela". **"Trazer de volta ao livro"**, na própria janela, fechou a janela e devolveu o painel.
- Volume devolvido para **25%**, como estava. Nenhuma faixa editada, nenhuma repetição mexida.

## 3. Tela inicial e ficha do mestre: FUNCIONOU

- **Tela inicial** (`p2-inicio-01`): limpa, com 5 entradas e o rodapé de atualização. Ela diz "Você está na versão mais nova (0.6.1)", mas o `latest.json` publicado já é 0.6.2. O texto vem da checagem feita quando o app abriu e não se renova. Não cliquei em "Procurar atualizações" para não instalar nada.
- **Mochila e equipamento** (ficha de teste): "+ Adicionar" abre a busca no Acervo, com sugestões (Garrucha, Porção Grande, balas...). O clique na sugestão dá o item, com o aviso "Garrucha entrou na mochila de Teste Jogador." e Desfazer. Clicar no item mostra o cartão (Equipar/Guardar, Editar, Tirar, Fechar). "Equipar" pôs a arma em Equipado > Arma (`p2-ficha-01`).
- **Condições** ficam no painel do token, não na ficha. Com o token ligado à ficha, aparece um formulário: Condição, Duração, "Vida por vez" e "Pôr condição". O texto "Mora na ficha de Teste Jogador: aparece igual no mapa, na batalha e na tela do jogador" explica bem. "Envenenado" entrou com "faltam 2 turnos · tira 3 de vida no começo da vez", um × para tirar e Desfazer (`p2-ficha-02`). Com o token sem ficha, a mesma seção é feita de chips (Envenenado, Caído, Dormindo...).

## Bugs e estranhezas do passeio 2

Certeza alta = vi acontecer. Incerto = vi, mas não sei se é de propósito ou qual é a causa.

1. **A Visão de jogador grava nomes num arquivo do app inteiro.** O `%APPDATA%/com.labirinto.app/livros/jogadores-vistos.json` ganhou "Teste Jogador" e "Teste Inimigo", com hora desta sessão, mas a janela diz "Teste — nada fica no jogo". Esse arquivo vale para todas as campanhas. Os dois nomes passam a aparecer em Livros de regras > Jogadores ("Nomes vistos na mesa" e "Entraram na mesa e não têm ficha"), e a tela não tem como tirar. Arquivo provável: `client/src/net/hostBridge.ts:3050` (`registrarVistos`) recebendo os jogadores da visão de teste (`client/src/net/visaoDeTeste/visaoDeTeste.ts`). Certeza alta. **Não apaguei as duas entradas**: o arquivo é do dono e só sai mexendo no disco. Elas somem sozinhas quando a lista passar de 64 nomes, ou o dono pode pedir para tirar.
2. **Na Visão de jogador, a batalha não aparece para o jogador:** na vez dele não há menu da vez, mira nem reação, nem depois de reabrir a janela. O app liga `getBatalha` na visão de teste (`App.tsx:1225`), e a janela do jogador só mostra a batalha com `state.batalhaEstado` (`client/src/player/main.tsx:2255`). Parece que deveria aparecer. Certeza alta de que não apareceu; incerto se é esperado no modo de teste.
3. **Os itens da ficha sumiram uma vez.** A Garrucha (equipada) e a Porção Grande, dadas pelo "+ Adicionar", sumiram da ficha do mestre e da do jogador. No meio houve: Editar com HP/SP e "Armas por batalha" e Salvar; criar 2 tokens e ligar um à ficha; o pino; Ctrl+S; abrir a Visão de jogador. **Não reproduzi.** Testei de novo Editar/Salvar sem mudar nada, com HP, com "Armas por batalha", com a arma equipada, e fechando e reabrindo a Visão, e os itens ficaram. Incerto; vale um teste dirigido.
4. **A ficha nova fechou sozinha** com o nome digitado e sem salvar (o "Teste Jogador" se perdeu). Antes disso, o seletor de Sistema também fechou e o One Piece ficou escolhido sem um clique meu confirmado. Pode ser efeito da automação, porque nas duas vezes um clique do Playwright estava esperando o botão ficar "estável". Incerto.
5. **Enter na busca do "+ Adicionar" não faz nada.** Com "Porção" digitado, o botão "Item novo: Porção" fica destacado em laranja, mas o Enter não dá o item nem cria um novo. Certeza alta; incerto se é de propósito.
6. **Depois do "+ Adicionar", o foco vai para o `BODY`**, e é preciso clicar no campo de busca para digitar. Certeza alta.
7. Atalhos que confundem (certeza alta): "Minha ficha" só centraliza; o pino abre quadro e cartão ao mesmo tempo; o selo do dado não some.
8. **"Você está na versão mais nova (0.6.1)" com a 0.6.2 já publicada.** É a checagem da abertura, que não se renova enquanto o app fica aberto. Incerto.
9. Menores (visual, certeza alta):
   - Na Mochila do mestre, o item aparece só como foto, sem nome nem quantidade, e o mouse em cima não mostra nada.
   - "Armas por batalha" aparece duas vezes: no seletor da esquerda ("— nenhuma") e no contador da Mochila ("Sem limite"). Os dois estão ligados, mas "nenhuma" se lê como zero armas.
   - Na ficha nova, Raça, Ofício, Armas e Etiquetas vêm em cima e o **Nome fica embaixo, fora da vista**, sem foco.
   - Salvar a ficha não dá aviso.
   - O aviso de item cobre as abas da ficha.
   - Token novo nasce no centro, em cima do outro (o "Teste Inimigo" cobriu o nome do "Teste Jogador").
   - No Acervo de tokens, os nomes são cortados em 2 ou 3 letras ("Ali…", "Ba…").
   - O Grupo mostra "Fora da batalha · Turno 1 · Passar turno" sem batalha nenhuma.
   - No inventário do jogador, as vagas vazias têm um X e parecem bloqueadas.
   - Em Sons, o ícone de "Abrir em janela" é o mesmo de "Trazer de volta".

## Sugestões de qualidade de vida

| Para | Sugestão | Impacto | Esforço |
|---|---|---|---|
| Mestre | Visão de jogador que não grava nada fora do teste (bug 1) e que mostra a batalha do jogador (bug 2): é o jeito do mestre ensaiar a vez do jogador sozinho | alto | médio |
| Jogador | Selo do dado que some em ~5 s e histórico curto (as últimas 5 rolagens) na aba Dados; avisar o mestre da rolagem | alto | baixo |
| Mestre | Ficha nova com o Nome no topo e o foco nele; aviso "Ficha salva" | médio | baixo |
| Mestre | Mochila com nome e quantidade embaixo da foto; Enter na busca do "+ Adicionar" dá a 1ª sugestão (ou o "Item novo"); foco no campo ao abrir | médio | baixo |
| Jogador | Pino abre uma camada só (o quadro); renomear "Minha ficha" para "Centralizar em mim" | médio | baixo |
| Mestre | Token novo nasce numa casa livre perto do centro; nomes do Acervo de tokens com 2 linhas ou dica ao passar o mouse | baixo | baixo |
| Mestre | Na seleção de fichas da Visão de jogador, abrir já na ficha de Jogador (hoje o Enter abriu a do NPC "Teste Inimigo", que vinha primeiro) | baixo | baixo |
| Jogador | Vagas vazias do inventário sem o X (moldura vazia); o X só para vaga bloqueada | baixo | baixo |

## O que foi tocado no passeio 2

- Criado, editado e **apagado pela tela**: TESTE-CLAUDE-2. O diálogo dizia `Apagar "TESTE-CLAUDE-2"? O arquivo é removido do disco e a ação não tem volta.`; depois veio o toast `"TESTE-CLAUDE-2" apagado.` e a linha sumiu da lista. Os personagens "Teste Jogador" e "Teste Inimigo", os 2 tokens e o pino moravam no mapa e foram junto. Uma busca em `%APPDATA%/com.labirinto.app` não acha mais "TESTE-CLAUDE-2", "Placa velha", "Aqui jaz o teste do Claude" nem a mensagem de chat; só sobram os 2 nomes em `livros/jogadores-vistos.json` (bug 1).
- **Quase acidente, sem estrago:** ao procurar o "Apagar" do TESTE-CLAUDE-2, meu seletor pegou o "Apagar" da **pasta "One Piece"**. Abriu o diálogo `Apagar a pasta "One Piece"? Os 5 mapas dela voltam para a lista — nenhum mapa é apagado...`. Li o nome no diálogo e cliquei em **Cancelar**. A pasta continua lá, com os 5 mapas. Depois apaguei o mapa de teste pelo botão da própria linha, conferindo o nome no diálogo.
- **Sala de rede:** nunca abriu (ação barrada), então não havia sala para fechar. A Visão de jogador foi fechada.
- Volume dos sons: 25 → 10 → 25 ("Só neste computador").
- Batalha no mapa de teste: iniciada e encerrada. A abertura do dono ("Espadas cruzadas · Royals") tocou.
- Dados do dono: nada editado, salvo, apagado ou movido. O aviso "As fichas de NPC desta aventura agora ficam aqui... Entendi" do Acervo ficou como estava (não cliquei).
- App deixado aberto na tela inicial.
