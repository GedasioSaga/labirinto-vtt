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
