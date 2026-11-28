# Plano de arte por tema (mapas top-down): objetos, construções, texturas e carimbos

Feito pelo Claude em 28/11/2026, item 3 do /goal do dono de 28/11 01:35 (PEDIDOS.md, última entrada). O dono não responde perguntas: toda escolha abaixo é a recomendada, anotada como decisão do Claude.

## Como uma peça nova entra no app (do desenho até o editor)

1. **Desenho.** O desenhista escreve `client/src/texturas/meioTermo/moveis/<tipo>.ts` (`montar<Tipo>`), arte por código no motor do Meio-Termo, e a folha para aprovar em `docs/design/arte-temas/folhas/<id>.png`. O estúdio `~/jogos/texturas-labirinto` gera só as folhas de PAREDE (Python, `prova/paredes/materiais/<id>.py`) e a arte Godot do Desenhado.
2. **Tipo.** O integrador põe o id em `client/src/lib/mobilia/tipos.ts:18` (`TIPOS_MOBILIA`). É esse id que o mapa salvo guarda.
3. **Ficha e catálogo.** `lib/mobilia/pecasNovas.ts:136` (nome, artigo, tamanho), `:1210` (`PECAS_NOVAS_PRONTAS`, que alimenta o catálogo em `:1325`) e o traço provisório do estilo Simples em `:4932`.
4. **Imagem.** `texturas/meioTermo/moveis/index.ts:434` (`MONTADORES`) e `:953` (`TIPOS_COM_TEXTURA`), materiais em `texturas/meioTermo/materiais.ts:177`, perfil 3/4 em `moveis/tresQuartos.ts`, ícone num `case` do arquivo de glifos (`components/glifosDaLeva2411.tsx:251` é o da última leva).
5. **Lugar no editor.** `lib/mobilia/gruposDoObjeto.ts:68` (grupo) e `:534` (palavras da busca). Construção vai em `lib/mobilia/construcoes.ts:41`. Luz em `lib/luzDoFogo.ts:61`.
6. **Versão hoje.** São 9 pontos de código por tipo: `types/map.ts:2199` (`mobiliaForma`) → `lib/mobilia.ts:293` → `lib/mapFactory.ts:1066` → `stores/mapStore.ts:3687` → `App.tsx:4551` → `components/MobiliaControls.tsx:613` (o botão "Versão" no painel do objeto clicado) → `pixi/rasterDosMoveis.ts:253-270` (vira `variante`) → o desenho lê `c.variante` (`moveis/nichoFunerario.ts:299`).
7. **Versão neste plano (I0).** Um campo só, `Prop.mobiliaVersao`, mais a tabela `lib/mobilia/versoes.ts`. O desenho de cada versão fica em arquivo novo, `moveis/versoes/<tipo>Versoes.ts`, e `montarCena` o escolhe (`moveis/index.ts:1116`). O mestre clica no objeto e escolhe a versão no painel.
8. **Carimbo.** `carimbos/novos/<id>.ts` mais uma linha em `carimbos/novos/index.ts:118`; luz em `lib/luzDoFogo.ts:148`; brilho que pulsa no campo `brilho` (`carimbos/embutidos.ts:59`).
9. **Chão.** `texturas/chaos/<id>.ts` (`cor(u, v)`) mais uma linha em `texturas/embutidas.ts:1412`. A variação do chão é `forma.grupo`: um cartão com várias formas.
10. **Parede.** O estúdio gera `client/src/texturas/paredes/imagens/<id>.png` e `amostras/<id>.png`. A linha entra no FIM de `texturas/paredes/catalogo.ts:105`, porque a posição entra na semente das juntas, e o id entra em `types/map.ts:116`. No estilo Desenhado, tipo sem arte Godot usa o desenho do Atual (`pixi/rasterDosMoveis.ts:386`).

---

## Decisões (Claude, 28/11/2026)

1. **A versão fica dentro do objeto**, como o dono pediu: um cartão no catálogo, e a escolha no painel ao clicar no objeto. Isto substitui a regra da leva de 24/11 (`docs/design/objetos-24-11/LISTA.md:36`, "versão é tipo novo"). Os tipos-irmãos que já existem continuam iguais no mapa salvo. Eles só passam a aparecer como família (I0-b).
2. **O I0 vem antes de encaixar qualquer versão.** O mecanismo genérico custa uma vez. Sem ele, cada família de versões custa 9 pontos de código (linha 6 acima).
3. **Uma versão nasce só quando a FORMA ou o ESTADO muda**: aberto, quebrado, com neve, cor da chama, brasão. Cor e madeira não viram versão, porque os lugares de material já cobrem isso (5 madeiras, 3 metais, 5 tecidos e 4 pedras em `materiais.ts:159-164`).
4. **Lava, neve e inferno entram primeiro como MATERIAL**: obsidiana, gelo e osso nas pedras, cobre nos metais (I0-d), no molde do inox e do mármore de 16/11. Assim todo objeto de pedra (altar, pilar, colunas, sarcófagos, estátuas) ganha a cara de lava, gelo ou ossos sem desenho novo. A versão desenhada fica para o que muda de forma (trono de gelo, muro com neve).
5. **Neve automática por cima de qualquer objeto: não.** Ela sairia como mancha branca. Vai para Propostas. A neve desenhada entra só nas peças de fora mais usadas.
6. **A arte sai no estilo Atual (Meio-Termo), por código**, como as levas de 11 a 24/11. O estilo Simples recebe o traço provisório. O Desenhado usa o Atual, e o botão de versão só aparece no Atual, como o da cova (`MobiliaControls.tsx:613`).
7. **Toda animação usa um dos 5 animadores do I0-e** (girar, oscilar, vapor, fio d'água, piscar) ou a chama que já existe. Nenhum lote inventa motor de animação.
8. **O desenhista só cria arquivos novos**, os da coluna "Arquivos novos". Os registros são do integrador. Dois lotes nunca escrevem no mesmo arquivo.
9. **Peças da "Fila da próxima leva" de 24/11** (`objetos-24-11/LISTA.md:386`) que caem num tema entraram aqui. Estão marcadas "fila 24/11".
10. **A Pintura (pedido de 27/11 18:23) tem plano próprio** e não entra aqui.

---

## Inventário do que o app já tem (28/11/2026, lido do código)

**Objetos e construções.** São 426 tipos em `lib/mobilia/tipos.ts`, com 441 arquivos de desenho em `texturas/meioTermo/moveis/`.

- **Objeto** (352 tipos em 24 grupos, `gruposDoObjeto.ts`): Sala e quarto 32, Cozinha 12, Banheiro 20, Armazenagem 12, Rua e jardim 22, Cemitério 21, Feira 10, Oficina 10, Fazenda 8, Destroços 14, Esporte 9, Porto 8, **Templo e masmorra 46**, **Sala de tortura 17**, Magia 4, Necrotério e laboratório 11, Tesouro 8, **Castelo 13**, Cerco 7, Base militar 15, Mar e piratas 14, Taverna 13, Descanso 14, Cidade e vila 12.
- **Construção** (74 tipos em 10 grupos, `construcoes.ts`): Torres 6, Praça 5, Monumentos 15, Abrigos e passagens 10, Castelo 9, Base militar 7, Cidade e porto 5, Vila e campo 5, Lazer 8, Natureza e relevo 4.

**Variações que já existem:**

| Mecanismo | Onde | Tipos |
|---|---|---|
| Forma ou estado no painel (`mobiliaForma`, um caminho por tipo) | `types/map.ts:2199` | tapete (redondo), pratos (3), fogo aceso/apagado (lareira, fornalha, forno, braseiro, 2 tochas, holofote, luminária, pilar com braseiro, lanterna gradeada, globo rubro), troncos e feno, chafariz, cata-ventos e moinho, ponte (madeira/pedra/corda), cova (3), montanha (com neve) |
| **Desenhada mas sem botão (achado)** | `lib/mobilia/nichoFunerario.ts`, `lib/mobilia/piramideEmDegraus.ts` | nicho funerário Fechado/Aberto e pirâmide Seca/Alagada: o desenho lê `c.variante`, mas nada passa a variante (`rasterDosMoveis.ts:253-270`) nem mostra o botão. O mestre nunca vê a 2ª forma. O I0-a liga as duas. |
| Lugar de material | `materiais.ts:159-177` | madeira, metal, tecido e pedra de cada peça |
| Tipo-irmão como versão | `tipos.ts` | blocos de inscrições Azul/Vermelho/Dourado, caracol-telefone (3), estátua de cavalo (com/sem pedestal), montanha (3 tamanhos), lápide e lápide torta, laje tumular e laje acesa |
| Desenho pelo id | `pecasNovas.ts:1353` | lápide: 3 contornos sorteados pelo id |

**Chão.** São 59 texturas embutidas (`embutidas.ts:1412`). Sete cartões têm formas: Campo 4, Lajotas 3, Chão de metal 4, Pisos de madeira 7, Pisos de pedra 10, Base militar 5, Cerâmica 7. As soltas: areia, duna, floresta, bosque, pinheiros, chão de floresta, pântano, terra, terra rachada, cascalho, serra, neve, convés, calçamento, linóleo, rua de tijolos, tijolo de cela, granito salpicado e lajeado poligonal. O Desenhado tem 19 chãos Godot (`texturas/desenhado/chao.ts:35`). **Não há** gelo, cinza, obsidiana, tabuleiro nem calçada moderna.

**Parede.** São 18 materiais (`paredes/catalogo.ts:105`): castelo, pedra rústica, pedra com musgo, tijolo, madeira, madeira velha, troncos, bambu, palha, ferro, concreto, sacos de areia, mármore preto, rocha de caverna, azulejo de hospital, tijolo com chapas, tábuas remendadas e pedra de fortaleza. **Não há** reboco, arenito, gelo, ossos, latão nem ameias.

**Outros sistemas.** Telhados (telha, palha, madeira, ardósia), escadas (7 materiais), barranco (terra, pedra, areia, neve, grama), água (rio, lago, mar e **lava animada**, `types/map.ts:2654`), efeitos de ambiente (chuva, brasas, neve, folhas, fumaça) e neblina.

**Carimbos.** São 72: 12 em `embutidos.ts` e 60 em `novos/` (1 aposentado). Natureza: 30 árvores e plantas, mais conchas, algas, coral, cacto e cacto redondo. Masmorra: rachadura, sangue (4), ratos, lixo, poça de esgoto, lama, palha, brasas, fenda em brasa e rocha vulcânica (as duas brilham), cristais (3 cores, brilham), cogumelos que brilham, estalagmite, bloco de gelo, monte de neve, árvore congelada, crânio de boi e mato na fresta. **Não há** veio de minério, runas, ossos soltos, luz de vitral, neve nas pedras nem galinhas.

**O que já mexe.** Fogueira e fogo de casa (lareira, fornalha, forno, braseiro, 2 tochas; `pixi/chamasDasFogueiras.ts`), fogo e muro de fogo (`pixi/fogosDoMapa.ts`, com fios de fumaça em `lib/mobilia/fogo.ts:136`), água do chafariz (`pixi/aguaDosChafarizes.ts`), pás dos cata-ventos (`pixi/pasDoVento.ts:269`), brilho que pulsa nos carimbos (`pixi/brilhoDosCarimbos.ts`), água e lava (`pixi/aguaDoMapa.ts`) e os efeitos de ambiente. A chama é só laranja. Pilar com braseiro, braseiro com ferros, fosso de brasas, velas e lustre são desenhos parados.

**Estúdio** (`~/jogos/texturas-labirinto`, sem git). Faz a arte Godot do Desenhado (`INVENTARIO.md`: 19 chãos, 37 móveis, traços) e o gerador Python das paredes (`prova/paredes/gerar_paredes_v2.py`, um arquivo por material em `prova/paredes/materiais/`). Objetos e carimbos do Atual são código no app, feitos por desenhistas Opus (levas de 11 a 24/11).

---

## Pesquisa (referência de TIPO de peça; nada copiado)

**Método.** Li cerca de 190 descrições de pacotes top-down do itch.io, nos 16 temas, como battlemaps de RPG e tilesets 2D. Busca direta: DuckDuckGo, Bing e Reddit bloqueiam robô. Analisei 5 imagens:

- **Esgoto** (tileset "Medieval Sewer Dungeon"): água em três tons (verde suja, azul limpa e redemoinho), canos de barro e ferro com cotovelo e ponta quebrada, boca de cano na parede jorrando água, parede de tijolo com limo verde escorrendo, borda de canal em pedra, lajotas rachadas com poça, grade de piso, barris, caixotes e entulho.
- **Reino demoníaco** ("Ashveil"): chão de cinza avermelhada, mansão de ardósia escura, postes de **chama verde**, árvores de **costela e espinha**, poça roxa, cerca de ferro, gárgulas, forca com gaiola, velas no chão e **caldeirão verde**.
- **Battlemaps vulcânicos**: templo de laje escura entre dois canais de lava, plataformas redondas, árvores de folha carmim, **crosta rachada com veio laranja**, pontes de tábua sobre a lava, barraco de mineiro e **respiradouros acesos**.
- **Interior steampunk** ("KR Steampunk Interiors"): lajota bege, papel damasco, janelas ovais com aro de latão, poltronas capitonê, lustre de bronze, arandelas de latão e **painel de mostradores**.
- **Cidade com torre do relógio**: a torre fica na praça, com o **mostrador** visto de cima. Pouco útil além disso.

**O padrão que valida "variações de neve e lava".** Um pacote de battlemap ("Sewer Temple", Map Doctor) vende o MESMO mapa em versões Chains, Empty, **Flooded, Frozen, Lava**, Toxic. Os pacotes de vila de inverno vendem "o mesmo telhado e a mesma casa com neve". Mesma peça com outro estado é o que o mercado entrega.

---

## Por tema: o que já temos, o que falta e o que entra

Legenda: **(a)** novo, **(b)** variação de item que existe, **(c)** textura de chão ou parede, **(d)** carimbo, **(e)** animado. Prioridade e lote entre colchetes. "Fila" = vale a pena, mas ficou fora dos 12 lotes.

### Dungeons (masmorra)
- **Já temos:** 46 peças de Templo e masmorra, 17 de Sala de tortura, Tesouro, cripta, lajotas e piso de masmorra, paredes castelo, pedra e fortaleza, carimbos de rachadura, sangue, ratos e brasas.
- **Referência** (Lanternmoor Dungeon, Dungeon & Crypt Kit, Tactical Dungeon, Sewer Temple): placa de pressão, lâmina pendular, baú aberto, nichos abertos e selados, parede de crânios, corrente pendurada, gaiola, estante revirada, tochas e braseiros animados, runas no chão, fogo-fátuo.
- (a) placa de pressão [alta, L01, fila 24/11]; escada de mão [média, L01, fila 24/11]; corrente pendurada [média, L01, fila 24/11]; lâmina pendular [média, L02]. Alavanca de parede: fora, porque o pino Alavanca já faz o papel.
- (b) baú aberto [alta, L01]; alçapão aberto [alta, L01]; armadilha recolhida [média, L01]; cor da chama no braseiro, nas tochas e no pilar com braseiro [alta, L02]; grilhões com esqueleto [média, L02]; estante revirada e vazia [média, L02].
- (c) parede Ossuário [alta, L02]; lajota em diagonal: entra como forma do Tabuleiro [L03].
- (d) runas no chão, que pulsam [alta, L02]; ossos espalhados [média, L02]; fuligem [baixa, fila].
- (e) chama colorida e chama nas peças paradas [alta, I0-c]; lâmina balançando [I0-e].

### Castelo
- **Já temos:** grupo Castelo (13), Cerco (7), construções do castelo (9), ponte levadiça, portão com grade, paredes castelo e fortaleza, tapete longo e lareira. É o tema mais completo.
- **Referência** (pacotes de interior de castelo): trono no estrado, estandartes e tapeçarias com brasão, lustre de velas, lareira grande, vitral, ameias, banquete, capela, peças de xadrez gigantes no salão.
- (a) nada de peso, já temos quase tudo.
- (b) trono de gelo, obsidiana e ossos [alta, L03]; tapeçaria e estandarte com 4 brasões [média, L03]; lustre apagado e caído [média, L03]; lareira de salão [média, L03]; estátua de cavaleiro, rei e dama [média, L03].
- (c) parede Muralha com ameias [alta, L03]; mármore vinho [baixa, fila 24/11].
- (d) luz de vitral [alta, L03].
- (e) as velas do lustre ganham chama [I0-c].

### Cavernas
- **Já temos:** chão e parede de rocha de caverna, basalto, estalagmite, cristais (3 cores), cogumelos, cipós, musgo, poça, lama, cascata em degraus, ponte de corda e teia.
- **Referência** (Crystal Caverns, Verdant Ironworks, tilesets de caverna): mina com carrinho e trilho, escoras, veios de minério, pilhas de minério, abismo, pilares de rocha, morcegos, cristais grandes.
- (a) carrinho de mina, trilho de mina e escora de mina [alta, L04]; pilha de minério [média, L04].
- (b) nada: material e brilho cobrem.
- (c) chão de mina [média, L04]; parede Rocha com veios [alta, L04]; cascalho azulado [baixa, fila 24/11].
- (d) buraco na rocha [alta, L04, fila 24/11]; pilar de rocha [média, L04, fila 24/11]; morcegos [média, L04]; cristais vermelhos [média, L04, fila 24/11].
- (e) nada novo: cristais e cogumelos já brilham.

### Prisão
- **Já temos:** a leva de 24/11 inteira (L01, L02 e L10 daquela lista: peças de ferro da cela, grilhões, latrina, jaula, quadro de chaves, mesa do carcereiro, beliche, chuveiro coletivo), cela com grade, guarita e sala de tortura.
- **Referência** (1-BIT Prison, Dungeon & Crypt Kit, Tactical Dungeon): fileira de celas, porta de cela aberta ou arrombada, gaiola pendurada, grade de piso.
- (a) portão de jaula [média, L01, fila 24/11].
- (b) cela aberta e arrombada [alta, L01]; gaiola suspensa aberta e com ossos [média, L01].
- (c) parede de grades que deixa a visão passar: é **sistema** (Propostas, nº 1).
- (d) e (e): nada novo.

### Esgotos
- **Já temos:** bueiro, ralo, grade de corredor, passarela de tábuas, poça de esgoto, ratos, lixo, lama, água verde e barrenta, pedras com lama.
- **Referência** (a imagem do esgoto, Septic Sewers, Lanternmoor): canos e cotovelos, boca de cano jorrando, válvula, comporta, canal, parede com limo, chão molhado.
- (a) cano [alta, L05]; saída de esgoto [alta, L05]; comporta [média, L05].
- (b) bueiro aberto [alta, L05]; ralo transbordando [média, L05]; grade arrombada [baixa, L05].
- (c) parede Tijolo com limo [alta, L05]; chão Tijolo de esgoto [média, L05].
- (d) limo [média, L05].
- (e) água escorrendo da saída [I0-e, fio d'água].

### Cidade medieval
- **Já temos:** Feira (10), Cidade e vila (12), placa de loja, banca de frutas, toldo, coreto, poste com relógio, forca, chafariz, poço, calçamento, paralelepípedo, rua de tijolos e telhados.
- **Referência** (Medieval Village, pacotes de mercado): placas por ofício, carroça de feno ou barris, bancas com mercadorias, poço com telhado, fonte de parede, lampião de rua, praça em leque, rua de lama, fachada caiada.
- (a) fonte de parede [média, L06].
- (b) placa de loja com 5 ofícios [alta, L06]; carroça com feno, com barris e coberta [alta, L06]; barraca com tecidos, cerâmica e peixe [média, L06]; lampião em poste de rua e poste a gás [média, L06]; poço com telhado e com manivela [média, L06].
- (c) calçada em leque [alta, L06]; rua de lama [média, L06, fila 24/11]; parede caiada [alta, L06, fila 24/11].
- (d) pombos [baixa, fila].
- (e) água da fonte [I0-e].

### Vila
- **Já temos:** Fazenda (8), galinheiro, colmeia, horta, plantação, espantalho, roda d'água, moinho, pombal, silo, baia, chiqueiro, varal, cerca, sebe e muro baixo.
- **Referência** (pacotes de vila, vila japonesa, fazenda): cercas de estaca e vime, barril de chuva, roda de carroça encostada, casinha de cachorro, banco de tronco, abóboras, galinhas soltas, terra arada, taipa.
- (a) roda de carroça [média, L07, fila 24/11]; banco de tronco [média, L07]; casinha de cachorro [baixa, L07].
- (b) cerca de estacas, de vime e com neve [alta, L07]; horta de abóboras e de repolhos [média, L07]; barril aberto com água e tombado [média, L07].
- (c) terra arada [média, L07]; parede Taipa [média, L07].
- (d) galinhas [média, L07].

### Cidade moderna
- **Já temos:** Base militar (15), banheiro moderno, necrotério, carro antigo, barreira de concreto, contêiner, antena, caixa de água elevada, asfalto com faixa, concreto, cadeira de plástico, computador e máquina de lavar.
- **Referência** (cidades modernas 16x16, cidade americana, cidade em quadrinho): poste, semáforo, hidrante, placas, lixeiras e caçambas, ponto de ônibus, carros e viaturas, cones, faixa de pedestres, calçada.
- (a) poste moderno, semáforo, hidrante, placa de trânsito, lixeira de rua e carro moderno [alta, L11]; cone de trânsito e ponto de ônibus [média, L11]; moto, orelhão e máquina de refrigerante [baixa, fila].
- (c) faixa de pedestres [alta, L11, fila 24/11]; calçada portuguesa [alta, L11]; bloco de concreto [média, fila 24/11].
- (d) mancha de óleo e marcas no asfalto [baixa, fila 24/11].
- (e) semáforo trocando de luz [I0-e, piscar].

### Xadrez
- **Já temos:** xadrez de jardim (objeto pequeno). A "Chapa xadrez" do chão de metal é chapa antiderrapante, não tabuleiro.
- **Referência:** quase não há pacote top-down. Em RPG, o tema é a sala de xadrez gigante com o tabuleiro vivo.
- (a) peça de xadrez gigante com 7 versões [alta, L03].
- (c) cartão Tabuleiro com 5 formas [alta, L03].

### Neve (variações)
- **Já temos:** chão de neve, pinheiro com neve, árvore congelada, bloco de gelo, monte de neve, montanha com neve, barranco de neve e o efeito neve.
- **Referência** (vilas de inverno 16x16, Rimetock): neve fofa e pisada, pegadas, gelo de lago rachado, cerca e muro com neve, telhado com neve, boneco de neve, trenó, iglu.
- (a) boneco de neve [média, L08]; iglu [média, L08]; trenó [baixa, L08].
- (b) muro baixo com neve [alta, L08]; banco com neve [média, L08]; cerca com neve [L07]; tenda com neve [L12]; trono de gelo [L03]; o material gelo vale para toda pedra [I0-d].
- (c) neve pisada e gelo no cartão Neve [alta, L08]; parede Pedra nevada [alta, L08].
- (d) pedras com neve [alta, L08]; pegadas na neve [média, L08]; arbusto nevado, toco com neve e cristais de gelo [baixa, fila].
- (e) telhado com neve e lago congelado de verdade: Propostas nº 2 e 3.

### Lava (variações)
- **Já temos:** lava como líquido animado, basalto em colunas, rocha vulcânica, fenda em brasa, brasas espalhadas, efeito brasas e fosso de brasas.
- **Referência** (battlemaps vulcânicos, Volcanic Inferno Dungeon, Mossmallow Lava Caverns): obsidiana, crosta rachada, respiradouros, correntes gigantes, cinzas, pontes sobre lava.
- (a) respiradouro vulcânico [média, L09].
- (b) trono de obsidiana [L03]; o material obsidiana vale para toda pedra [I0-d].
- (c) basalto com brasa [alta, L09]; cinzas [alta, L09]; parede Obsidiana [média, L09].
- (e) vapor do respiradouro [I0-e].

### Inferno
- **Já temos:** gárgula, estátua de besta, círculo mágico, selo de órbitas, plataforma de ritual, poço de sangue, sangue (4), ossário, ossos e crânio.
- **Referência** (Ashveil, Demon Realm, Dark Fantasy Dungeon Builder): chão de cinza vermelha, chama verde, árvores de ossos, portais, estacas com crânio, chão de ossos, runas.
- (a) portal [alta, L09]; estaca com crânio e pilar de ossos [média, L09].
- (b) caldeirão verde borbulhando [média, L09]; chama verde ou roxa [L02]; trono de ossos [L03]; o material osso [I0-d].
- (d) árvore de ossos [média, L09]; runas [L02]; enxofre [baixa, fila].
- (e) redemoinho do portal [I0-e, girar]; bolhas do caldeirão [I0-e, vapor].

### Torre do relógio, Steampunk e Clockpunk (um lote: Mecanismos)
- **Já temos:** poste com relógio, torre do sino, sino, relógio de sol, sucata de engrenagens, elevador antigo, gerador, chão de metal, parede de ferro, telescópio e globo.
- **Referência** (Verdant Ironworks, Rimetock, Clocktower kit, KR Steampunk Interiors, Cogworks Factory): engrenagens que giram, pêndulo, mostrador gigante, relógio de pé, caldeira com manômetro, canos de latão com válvula, autômatos, esfera armilar, poste a gás. Clockpunk é o mesmo mecanismo em madeira e latão, sem vapor.
- (a) engrenagem, relógio de pé, caldeira a vapor e autômato [alta, L10]; mostrador do relógio, esfera armilar e painel de válvulas [média, L10]; dirigível, bancada de relojoeiro e mesa de inventor [baixa, fila].
- (b) poste a gás [L06]; cano de latão [L05, pelo material]; o material cobre [I0-d].
- (c) mosaico de engrenagem e parede Chapa de latão [média, L10]; Latão rebitado como forma do Chão de metal [baixa, fila].
- (e) girar (engrenagem, ponteiros, planetário), oscilar (pêndulo) e vapor (caldeira) [I0-e].

### Deserto
- **Já temos:** areia, duna, terra rachada, cacto, cacto redondo, arbusto que rola, crânio de boi, palmeira, pirâmide maia, obelisco, tenda e ânforas.
- **Referência** (Desert City, Desert Oasis, Egyptian & Mythology): tamareira, banca de especiarias, tenda beduína, coluna de papiro, esfinge, arenito em blocos e lajes, adobe, torre de vento.
- (a) esfinge, coluna egípcia, banca de especiarias e ossada gigante [média, L12]; torre de vento [baixa, fila].
- (b) tenda beduína [média, L12].
- (c) arenito em lajes [alta, L12, fila 24/11]; paredes Blocos de arenito [alta] e Adobe [média], as duas no L12.
- (d) tamareira [média, L12].
- (e) areia soprando: Propostas nº 6.

---

## I0: o encaixe genérico (integrador, `programador-frontend` em xhigh; não é lote de desenho)

Cinco entregas pequenas, cada uma testável sozinha. A I0-a vem primeiro. As outras entram quando o lote que depende delas chega.

- **I0-a. Versões dentro do objeto [alta].**
  - `Prop.mobiliaVersao?: string` em `types/map.ts`, ao lado de `mobiliaForma` (:2199). Ausente = a 1ª versão, o desenho de hoje. Só se grava o que difere. Versão desconhecida some na leitura.
  - Tabela nova `lib/mobilia/versoes.ts`: `VERSOES_DO_MOVEL[tipo]` com `rotulo` e a lista de `opcoes` (id e nome), sem Pixi e sem `types/map.ts`.
  - A leitura e a travessia passam pela mesma porta de `lib/mobilia.ts:293`.
  - Uma ação `trocarVersaoDoMovel` com histórico, no molde da cova (`mapFactory.ts:1066`, `mapStore.ts:3687`, `App.tsx:819` e `:4551`).
  - Um botão "Versão" para todo tipo da tabela (`MobiliaControls.tsx:613`), com miniaturas se sair barato.
  - Em `rasterDosMoveis.ts:253`, a `versao` entra no desenho e na chave da imagem **separada de `variante`**. A `variante` já é o fogo, a pilha e a lápide: misturar as duas quebra a lareira.
  - Em `montarCena` (`moveis/index.ts:1116`): primeiro `VERSOES_DESENHADAS[tipo][versao]` (registro novo em `moveis/versoes/index.ts`), senão `MONTADORES`.
  - Ligar já o nicho funerário (Fechado/Aberto) e a pirâmide em degraus (Seca/Alagada), que só precisam do caminho.
- **I0-b. Famílias no catálogo [média].**
  - Um cartão por família na escolha do objeto (`components/livro/EscolhaDoObjeto.tsx`). O botão "Versão" troca o TIPO, porque a troca de tipo já existe (`pecasNovas.ts:1344`). O mapa salvo não muda.
  - Famílias de objeto: blocos de inscrições (3), caracol-telefone (3), estátua de cavalo (2), montanha (3), lápide e lápide torta, laje tumular e laje acesa.
  - Famílias de carimbo: sangue (4), cristais (com os vermelhos), ipê (2), girassol e girassóis, cacto e cacto redondo, pinheiro e pinheiro com neve, pedras e pedras com neve, palmeira e tamareira.
- **I0-c. Chama colorida e chama nas peças paradas [alta, L02 e L03 dependem].**
  - Cor da chama (laranja, azul, verde, roxa) lida da versão, em `pixi/chamasDasFogueiras.ts` (borda, miolo e fagulha) e na cor da luz (`lib/luzDoFogo.ts:61`).
  - Línguas novas em `lib/mobilia/fogoDeCasa.ts:30`: pilar com braseiro, braseiro com ferros, fosso de brasas e churrasqueira.
  - Chama pequena, sem fagulha, para as velas: candelabro de chão, lustre de velas, velas e oferendas, vela no pires.
- **I0-d. Materiais novos [alta].**
  - Obsidiana, gelo e osso no FIM das pedras; cobre no FIM dos metais (`materiais.ts:159-164`).
  - Molde: o inox e o mármore de 16/11, com `SO_PELO_TOM_OFICIAL`. Assim nenhum mapa salvo muda de cara.
  - Tons de partida (régua "não estoura", canal até 245): obsidiana `#2a2630` com reflexo frio; gelo `#b9cfd8`; osso `#cfc3a6`; cobre `#9a5f3c`.
- **I0-e. Cinco animadores [alta, L02, L05, L06, L09, L10 e L11 dependem].**
  - **Girar**, no molde de `pasDoVento.ts:269`: engrenagem, ponteiros, planetário e portal.
  - **Oscilar**: pêndulo e lâmina.
  - **Vapor**, com os fios de fumaça de `lib/mobilia/fogo.ts:136`: caldeira, respiradouro e bolhas.
  - **Fio de água**, no molde de `aguaDosChafarizes.ts`: saída de esgoto e fonte de parede.
  - **Piscar**: semáforo.
  - Todos respeitam "menos movimento" e efeitos desligados. Sem peça na tela, não pedem quadro.

**Contrato com o desenhista** (vale para os lotes desde já: dá para desenhar antes do I0 ficar pronto):

- **Versão:** `V/<tipo>Versoes.ts` exporta `versoesDo<Tipo>`, um registro de id da versão para `MontarMovel`, com a mesma assinatura de `MontarMovel` (`moveis/contexto.ts`). A versão tem a mesma pegada do tipo, porque trocar não mexe no tamanho. Ela pode importar o que o arquivo base já exporta, mas **nunca edita o arquivo base**.
- **Parte que mexe:** o arquivo exporta `montar<Tipo>` (a parte parada) e `montar<Tipo>QueMexe` (só a peça que gira ou balança, no próprio quadro), mais `ANIMACAO_DO_<TIPO>` com o animador, o pivô (x e y em fração da pegada) e o período em ms. O integrador liga isso ao animador.
- **Luz:** o brilho pintado é fraco. O relatório sugere a cor e o raio para `LUZ_DOS_OBJETOS` ou `LUZ_DOS_CARIMBOS`.

---

## Lotes de produção

Valem as regras de arte da leva de 24/11 (`docs/design/objetos-24-11/LISTA.md:20-37`, estilo `docs/design/ESTILO-DO-RPG.md`), com a troca da Decisão 1: versão é desenho novo em `V/`, no mesmo tipo.

- **Desenhistas:** `designer-opus` em max, por ordem do dono de 28/11. Até 3 em paralelo, um lote cada.
- **Integrador:** `programador-frontend` em xhigh, um só. Encaixa lote por lote e faz commit só dos próprios caminhos.
- **Folha para aprovar:** uma por peça, com **todas as versões lado a lado** (o dono escolhe vendo).

**Abreviações:**

| Sigla | Caminho |
|---|---|
| `M/` | `client/src/texturas/meioTermo/moveis/` |
| `V/` | `client/src/texturas/meioTermo/moveis/versoes/` (pasta nova) |
| `K/` | `client/src/carimbos/novos/` |
| `C/` | `client/src/texturas/chaos/` |
| `P/<id>` | estúdio `prova/paredes/materiais/<id>.py`, mais app `client/src/texturas/paredes/imagens/<id>.png` e `imagens/amostras/<id>.png` |
| `F/` | `docs/design/arte-temas/folhas/` |

Todos os ids e arquivos abaixo foram conferidos em 28/11: nenhum existe.

### L01 Masmorra: baús, celas e armadilhas (simples). Temas: Dungeons e Prisão

| Nº | Peça | Id | Tipo | Versões | Prior. | Arquivos novos |
|---|---|---|---|---|---|---|
| 1 | Baú | `bau` | versão | Fechado (hoje) / Aberto com tesouro / Aberto vazio | alta | `V/bauVersoes.ts`, `F/bau-versoes.png` |
| 2 | Cela com grade | `celaComGrade` | versão | Fechada (hoje) / Aberta / Arrombada | alta | `V/celaComGradeVersoes.ts`, `F/cela-com-grade-versoes.png` |
| 3 | Alçapão | `alcapao` | versão | Fechado (hoje) / Aberto (buraco escuro, tampa caída) | alta | `V/alcapaoVersoes.ts`, `F/alcapao-versoes.png` |
| 4 | Armadilha de espinhos | `armadilhaDeEspinhos` | versão | a de hoje / Recolhida (só as fendas) | média | `V/armadilhaDeEspinhosVersoes.ts`, `F/armadilha-de-espinhos-versoes.png` |
| 5 | Gaiola suspensa | `gaiolaSuspensa` | versão | a de hoje / Aberta vazia / Com ossos | média | `V/gaiolaSuspensaVersoes.ts`, `F/gaiola-suspensa-versoes.png` |
| 6 | Placa de pressão | `placaDePressao` | novo | Quadrada / Losango / Afundada | alta | `M/placaDePressao.ts`, `F/placa-de-pressao.png` |
| 7 | Escada de mão | `escadaDeMao` | novo | Encostada / Deitada | média | `M/escadaDeMao.ts`, `F/escada-de-mao.png` |
| 8 | Corrente pendurada | `correntePendurada` | novo | Com gancho / Com grilhão | média | `M/correntePendurada.ts`, `F/corrente-pendurada.png` |
| 9 | Portão de jaula | `portaoDeJaula` | novo | Fechado / Aberto | média | `M/portaoDeJaula.ts`, `F/portao-de-jaula.png` |

### L02 Masmorra: chama colorida, ossos e runas (complexo). Temas: Dungeons, Cripta e Inferno. Depende de I0-c e I0-e

| Nº | Peça | Id | Tipo | Versões | Prior. | Arquivos novos |
|---|---|---|---|---|---|---|
| 1 | Braseiro | `braseiro` | versão | Laranja (hoje) / Azul / Verde / Roxa (brasa no tom; a chama é do I0-c) | alta | `V/braseiroVersoes.ts`, `F/braseiro-versoes.png` |
| 2 | Tocha de parede | `tochaDeParede` | versão | as mesmas 4 | alta | `V/tochaDeParedeVersoes.ts`, `F/tocha-de-parede-versoes.png` |
| 3 | Tocha de pé | `tochaDePe` | versão | as mesmas 4 | alta | `V/tochaDePeVersoes.ts`, `F/tocha-de-pe-versoes.png` |
| 4 | Pilar com braseiro | `pilarComBraseiro` | versão | as mesmas 4 | média | `V/pilarComBraseiroVersoes.ts`, `F/pilar-com-braseiro-versoes.png` |
| 5 | Grilhões de parede | `grilhoesDeParede` | versão | Vazios (hoje) / Com esqueleto | média | `V/grilhoesDeParedeVersoes.ts`, `F/grilhoes-de-parede-versoes.png` |
| 6 | Estante de livros | `estanteDeLivros` | versão | Cheia (hoje) / Revirada / Vazia com teias | média | `V/estanteDeLivrosVersoes.ts`, `F/estante-de-livros-versoes.png` |
| 7 | Lâmina pendular | `laminaPendular` | novo, oscila | Parada / Balançando | média | `M/laminaPendular.ts`, `F/lamina-pendular.png` |
| 8 | Runas no chão | `runas-no-chao` | carimbo com `brilho` | (semente) | alta | `K/runasNoChao.ts`, `F/runas-no-chao.png` |
| 9 | Ossos espalhados | `ossos-espalhados` | carimbo | (semente) | média | `K/ossosEspalhados.ts`, `F/ossos-espalhados.png` |
| 10 | Ossuário | `ossuario` | parede de crânios | — | alta | `P/ossuario`, `F/ossuario.png` |

### L03 Castelo e xadrez (complexo). Temas: Castelo, Xadrez, Neve, Lava e Inferno

| Nº | Peça | Id | Tipo | Versões | Prior. | Arquivos novos |
|---|---|---|---|---|---|---|
| 1 | Trono real | `tronoReal` | versão | Real (hoje) / Gelo / Obsidiana / Ossos | alta | `V/tronoRealVersoes.ts`, `F/trono-real-versoes.png` |
| 2 | Tapeçaria | `tapecariaDeParede` | versão | a de hoje / Leão / Dragão / Águia / Torre (heráldica genérica) | média | `V/tapecariaDeParedeVersoes.ts`, `F/tapecaria-versoes.png` |
| 3 | Estandarte de pé | `estandarteDePe` | versão | os mesmos 4 brasões | média | `V/estandarteDePeVersoes.ts`, `F/estandarte-versoes.png` |
| 4 | Lustre de velas | `lustreDeVelas` | versão | Aceso (hoje) / Apagado / Caído no chão | média | `V/lustreDeVelasVersoes.ts`, `F/lustre-versoes.png` |
| 5 | Lareira | `lareira` | versão | Simples (hoje) / De salão (larga, pedra lavrada, brasão); o Fogo aceso/apagado continua | média | `V/lareiraVersoes.ts`, `F/lareira-versoes.png` |
| 6 | Estátua | `estatua` (construção) | versão | a de hoje / Cavaleiro / Rei / Dama | média | `V/estatuaVersoes.ts`, `F/estatua-versoes.png` |
| 7 | Peça de xadrez gigante | `pecaDeXadrez` | novo | Peão / Torre / Cavalo / Bispo / Rainha / Rei / Tombada (o lado sai pelo material: mármore ou ardósia) | alta | `M/pecaDeXadrez.ts`, `F/peca-de-xadrez.png` |
| 8 | Tabuleiro | `tabuleiro-marmore`, `tabuleiro-madeira`, `tabuleiro-jardim`, `tabuleiro-vermelho`, `tabuleiro-diagonal` | chão, cartão "Tabuleiro" | 5 formas, 1 casa = 1 quadrado | alta | `C/tabuleiro.ts` (5 funções), `F/tabuleiro.png` |
| 9 | Luz de vitral | `luz-de-vitral` | carimbo de luz colorida no chão | (semente) | alta | `K/luzDeVitral.ts`, `F/luz-de-vitral.png` |
| 10 | Muralha com ameias | `muralha-com-ameias` | parede | — | alta | `P/muralha-com-ameias`, `F/muralha-com-ameias.png` |

### L04 Cavernas e mina (simples)

| Nº | Peça | Id | Tipo | Versões | Prior. | Arquivos novos |
|---|---|---|---|---|---|---|
| 1 | Carrinho de mina | `carrinhoDeMina` | novo | Vazio / Com minério / Com ouro | alta | `M/carrinhoDeMina.ts`, `F/carrinho-de-mina.png` |
| 2 | Trilho de mina | `trilhoDeMina` | novo | Reto (estica) / Curva / Batente | alta | `M/trilhoDeMina.ts`, `F/trilho-de-mina.png` |
| 3 | Escora de mina | `escoraDeMina` | novo | Inteira / Quebrada | alta | `M/escoraDeMina.ts`, `F/escora-de-mina.png` |
| 4 | Pilha de minério | `pilhaDeMinerio` | novo | Ferro / Ouro / Cristal | média | `M/pilhaDeMinerio.ts`, `F/pilha-de-minerio.png` |
| 5 | Buraco na rocha | `buraco-na-rocha` | carimbo | (semente) | alta | `K/buracoNaRocha.ts`, `F/buraco-na-rocha.png` |
| 6 | Pilar de rocha | `pilar-de-rocha` | carimbo | (semente) | média | `K/pilarDeRocha.ts`, `F/pilar-de-rocha.png` |
| 7 | Morcegos | `morcegos` | carimbo (bando no teto, visto de cima) | (semente) | média | `K/morcegos.ts`, `F/morcegos.png` |
| 8 | Cristais vermelhos | `cristais-vermelhos` | carimbo, família Cristais, luz parada | (semente) | média | `K/cristaisVermelhos.ts`, `F/cristais-vermelhos.png` |
| 9 | Chão de mina | `chao-de-mina` | chão (terra batida escura com pedrisco) | — | média | `C/chaoDeMina.ts`, `F/chao-de-mina.png` |
| 10 | Rocha com veios | `rocha-com-veios` | parede (rocha de caverna com veio de minério) | — | alta | `P/rocha-com-veios`, `F/rocha-com-veios.png` |

### L05 Esgotos e canos (complexo). Depende de I0-e (fio de água)

| Nº | Peça | Id | Tipo | Versões | Prior. | Arquivos novos |
|---|---|---|---|---|---|---|
| 1 | Cano | `cano` | novo | Reto (estica) / Cotovelo / Junção em T / Com válvula; material ferro, latão ou barro | alta | `M/cano.ts`, `F/cano.png` |
| 2 | Saída de esgoto | `saidaDeEsgoto` | novo, fio de água | Seca / Escorrendo | alta | `M/saidaDeEsgoto.ts`, `F/saida-de-esgoto.png` |
| 3 | Comporta | `comporta` | novo | Fechada / Aberta | média | `M/comporta.ts`, `F/comporta.png` |
| 4 | Bueiro | `bueiro` | versão | Fechado (hoje) / Aberto (tampa ao lado) | alta | `V/bueiroVersoes.ts`, `F/bueiro-versoes.png` |
| 5 | Ralo de masmorra | `raloDeMasmorra` | versão | Seco (hoje) / Transbordando | média | `V/raloDeMasmorraVersoes.ts`, `F/ralo-versoes.png` |
| 6 | Grade de corredor | `gradeDeCorredor` | versão | Inteira (hoje) / Arrombada | baixa | `V/gradeDeCorredorVersoes.ts`, `F/grade-de-corredor-versoes.png` |
| 7 | Limo | `limo` | carimbo (lodo verde) | (semente) | média | `K/limo.ts`, `F/limo.png` |
| 8 | Tijolo de esgoto | `tijolo-de-esgoto` | chão (tijolo molhado com poças) | — | média | `C/tijoloDeEsgoto.ts`, `F/tijolo-de-esgoto.png` |
| 9 | Tijolo com limo | `tijolo-com-limo` | parede | — | alta | `P/tijolo-com-limo`, `F/tijolo-com-limo.png` |

### L06 Cidade medieval (simples). Depende de I0-e (fio de água) só na fonte

| Nº | Peça | Id | Tipo | Versões | Prior. | Arquivos novos |
|---|---|---|---|---|---|---|
| 1 | Placa de loja | `placaDeLoja` | versão | a de hoje / Ferreiro (bigorna) / Alquimista (frasco) / Padaria (pão) / Armaduras (escudo) / Estalagem (cama) | alta | `V/placaDeLojaVersoes.ts`, `F/placa-de-loja-versoes.png` |
| 2 | Carroça | `carroca` | versão | Vazia (hoje) / Com feno / Com barris / Coberta (lona) | alta | `V/carrocaVersoes.ts`, `F/carroca-versoes.png` |
| 3 | Barraca de feira | `barraca` (construção) | versão | a de hoje / Tecidos / Cerâmica / Peixe | média | `V/barracaVersoes.ts`, `F/barraca-versoes.png` |
| 4 | Lampião | `lampiao` | versão | De pé (hoje) / Poste de rua / Poste a gás vitoriano | média | `V/lampiaoVersoes.ts`, `F/lampiao-versoes.png` |
| 5 | Poço | `poco` (construção) | versão | Simples (hoje) / Com telhado / Com manivela | média | `V/pocoVersoes.ts`, `F/poco-versoes.png` |
| 6 | Fonte de parede | `fonteDeParede` | novo, fio de água | Correndo / Seca | média | `M/fonteDeParede.ts`, `F/fonte-de-parede.png` |
| 7 | Calçada em leque | `calcada-em-leque` | chão (paralelepípedo em arcos) | — | alta | `C/calcadaEmLeque.ts`, `F/calcada-em-leque.png` |
| 8 | Rua de lama | `rua-de-lama` | chão | — | média | `C/ruaDeLama.ts`, `F/rua-de-lama.png` |
| 9 | Parede caiada | `parede-caiada` | parede (reboco branco gasto) | — | alta | `P/parede-caiada`, `F/parede-caiada.png` |

### L07 Vila e fazenda (simples; a cerca é a peça difícil)

| Nº | Peça | Id | Tipo | Versões | Prior. | Arquivos novos |
|---|---|---|---|---|---|---|
| 1 | Cerca | `cerca` | versão | Tábuas (hoje) / Estacas / Vime / Tábuas com neve (as 4 respeitam a curva e o esticar) | alta | `V/cercaVersoes.ts`, `F/cerca-versoes.png` |
| 2 | Horta | `horta` | versão | Legumes (hoje) / Abóboras / Repolhos | média | `V/hortaVersoes.ts`, `F/horta-versoes.png` |
| 3 | Barril | `barril` | versão | Fechado (hoje) / Aberto com água / Tombado | média | `V/barrilVersoes.ts`, `F/barril-versoes.png` |
| 4 | Roda de carroça | `rodaDeCarroca` | novo | Encostada / Deitada | média | `M/rodaDeCarroca.ts`, `F/roda-de-carroca.png` |
| 5 | Banco de tronco | `bancoDeTronco` | novo | Tronco / Tábua sobre tocos | média | `M/bancoDeTronco.ts`, `F/banco-de-tronco.png` |
| 6 | Casinha de cachorro | `casinhaDeCachorro` | novo | Vazia / Com tigela | baixa | `M/casinhaDeCachorro.ts`, `F/casinha-de-cachorro.png` |
| 7 | Galinhas | `galinhas` | carimbo | (semente) | média | `K/galinhas.ts`, `F/galinhas.png` |
| 8 | Terra arada | `terra-arada` | chão (sulcos de plantio) | — | média | `C/terraArada.ts`, `F/terra-arada.png` |
| 9 | Taipa | `taipa` | parede (pau a pique) | — | média | `P/taipa`, `F/taipa.png` |

### L08 Neve (simples)

| Nº | Peça | Id | Tipo | Versões | Prior. | Arquivos novos |
|---|---|---|---|---|---|---|
| 1 | Muro baixo de pedra | `muroBaixoDePedra` | versão | o de hoje / Com neve | alta | `V/muroBaixoDePedraVersoes.ts`, `F/muro-baixo-versoes.png` |
| 2 | Banco de praça | `bancoDePraca` | versão | o de hoje / Com neve | média | `V/bancoDePracaVersoes.ts`, `F/banco-de-praca-versoes.png` |
| 3 | Boneco de neve | `bonecoDeNeve` | novo | Clássico / Derretendo | média | `M/bonecoDeNeve.ts`, `F/boneco-de-neve.png` |
| 4 | Iglu | `iglu` (construção) | novo | Inteiro / Em ruína | média | `M/iglu.ts`, `F/iglu.png` |
| 5 | Trenó | `treno` | novo | De carga / Pequeno | baixa | `M/treno.ts`, `F/treno.png` |
| 6 | Pedras com neve | `pedras-com-neve` | carimbo, família Pedras | (semente) | alta | `K/pedrasComNeve.ts`, `F/pedras-com-neve.png` |
| 7 | Pegadas na neve | `pegadas-na-neve` | carimbo de traço (segue o rumo, `traco`) | (semente) | média | `K/pegadasNaNeve.ts`, `F/pegadas-na-neve.png` |
| 8 | Neve pisada | `neve-pisada` | chão, cartão Neve | — | alta | `C/nevePisada.ts`, `F/neve-pisada.png` |
| 9 | Gelo | `gelo` | chão, cartão Neve (lago congelado rachado) | — | alta | `C/gelo.ts`, `F/gelo.png` |
| 10 | Pedra nevada | `pedra-nevada` | parede (pedra com neve no topo) | — | alta | `P/pedra-nevada`, `F/pedra-nevada.png` |

O integrador põe a `neve` que já existe no cartão Neve como forma "Fofa". O id não muda.

### L09 Lava e inferno (complexo). Depende de I0-e (girar e vapor)

| Nº | Peça | Id | Tipo | Versões | Prior. | Arquivos novos |
|---|---|---|---|---|---|---|
| 1 | Portal | `portalMagico` | novo, gira o redemoinho | Infernal / Arcano / Gelo / Apagado | alta | `M/portalMagico.ts`, `F/portal-magico.png` |
| 2 | Respiradouro vulcânico | `respiradouroVulcanico` | novo, vapor | Ativo / Adormecido | média | `M/respiradouroVulcanico.ts`, `F/respiradouro-vulcanico.png` |
| 3 | Estaca com crânio | `estacaComCranio` | novo | Uma / Três | média | `M/estacaComCranio.ts`, `F/estaca-com-cranio.png` |
| 4 | Pilar de ossos | `pilarDeOssos` | novo | — | média | `M/pilarDeOssos.ts`, `F/pilar-de-ossos.png` |
| 5 | Caldeirão | `caldeirao` | versão, vapor | o de hoje / Verde borbulhando | média | `V/caldeiraoVersoes.ts`, `F/caldeirao-versoes.png` |
| 6 | Árvore de ossos | `arvore-de-ossos` | carimbo | (semente) | média | `K/arvoreDeOssos.ts`, `F/arvore-de-ossos.png` |
| 7 | Cinzas | `cinzas` | chão (cinza com brasinhas) | — | alta | `C/cinzas.ts`, `F/cinzas.png` |
| 8 | Basalto com brasa | `basalto-com-brasa` | chão (crosta com veio de brasa) | — | alta | `C/basaltoComBrasa.ts`, `F/basalto-com-brasa.png` |
| 9 | Obsidiana | `obsidiana` | parede | — | média | `P/obsidiana`, `F/obsidiana.png` |

### L10 Mecanismos: torre do relógio, steampunk e clockpunk (complexo). Depende de I0-e

| Nº | Peça | Id | Tipo | Versões | Prior. | Arquivos novos |
|---|---|---|---|---|---|---|
| 1 | Engrenagem | `engrenagem` | novo, gira | Simples / Par engrenado / Com catraca; material ferro, latão ou madeira (clockpunk) | alta | `M/engrenagem.ts`, `F/engrenagem.png` |
| 2 | Relógio de pé | `relogioDePe` | novo, pêndulo oscila | Clássico / Quebrado | alta | `M/relogioDePe.ts`, `F/relogio-de-pe.png` |
| 3 | Caldeira a vapor | `caldeiraAVapor` | novo, vapor | Ligada / Fria | alta | `M/caldeiraAVapor.ts`, `F/caldeira-a-vapor.png` |
| 4 | Autômato | `automato` | novo | De corda (madeira e latão) / A vapor (ferro e cobre) / Desmontado | alta | `M/automato.ts`, `F/automato.png` |
| 5 | Mostrador do relógio | `mostradorDeRelogio` | novo, ponteiros giram | Inteiro / Quebrado | média | `M/mostradorDeRelogio.ts`, `F/mostrador-de-relogio.png` |
| 6 | Esfera armilar | `esferaArmilar` | novo, gira | Esfera armilar / Planetário | média | `M/esferaArmilar.ts`, `F/esfera-armilar.png` |
| 7 | Painel de válvulas | `painelDeValvulas` | novo | — | média | `M/painelDeValvulas.ts`, `F/painel-de-valvulas.png` |
| 8 | Mosaico de engrenagem | `mosaico-de-engrenagem` | chão (latão na pedra) | — | média | `C/mosaicoDeEngrenagem.ts`, `F/mosaico-de-engrenagem.png` |
| 9 | Chapa de latão | `chapa-de-latao` | parede rebitada | — | média | `P/chapa-de-latao`, `F/chapa-de-latao.png` |

### L11 Cidade moderna (simples). Depende de I0-e (piscar) só no semáforo

| Nº | Peça | Id | Tipo | Versões | Prior. | Arquivos novos |
|---|---|---|---|---|---|---|
| 1 | Poste de luz | `posteDeLuzModerno` | novo | Simples / Duplo | alta | `M/posteDeLuzModerno.ts`, `F/poste-de-luz.png` |
| 2 | Semáforo | `semaforo` | novo, pisca | Verde / Amarelo / Vermelho / Ciclo | alta | `M/semaforo.ts`, `F/semaforo.png` |
| 3 | Hidrante | `hidrante` | novo | — | alta | `M/hidrante.ts`, `F/hidrante.png` |
| 4 | Placa de trânsito | `placaDeTransito` | novo | Pare / Preferência / Proibido estacionar / Pedestres / Velocidade | alta | `M/placaDeTransito.ts`, `F/placa-de-transito.png` |
| 5 | Lixeira de rua | `lixeiraDeRua` | novo | Lixeira / Contêiner / Caçamba de entulho | alta | `M/lixeiraDeRua.ts`, `F/lixeira-de-rua.png` |
| 6 | Carro moderno | `carroModerno` | novo | Sedã / Hatch / Táxi / Viatura / Ambulância (sem marca; a lataria pega a Cor do móvel) | alta | `M/carroModerno.ts`, `F/carro-moderno.png` |
| 7 | Cone de trânsito | `coneDeTransito` | novo | Cone / Cavalete / Barril listrado | média | `M/coneDeTransito.ts`, `F/cone-de-transito.png` |
| 8 | Ponto de ônibus | `pontoDeOnibus` | novo | — | média | `M/pontoDeOnibus.ts`, `F/ponto-de-onibus.png` |
| 9 | Faixa de pedestres | `faixa-de-pedestres` | chão | — | alta | `C/faixaDePedestres.ts`, `F/faixa-de-pedestres.png` |
| 10 | Calçada portuguesa | `calcada-portuguesa` | chão (ondas preto e branco) | — | alta | `C/calcadaPortuguesa.ts`, `F/calcada-portuguesa.png` |

O integrador junta a calçada em leque (L06), a faixa e a calçada portuguesa num cartão "Rua e calçada".

### L12 Deserto (simples)

| Nº | Peça | Id | Tipo | Versões | Prior. | Arquivos novos |
|---|---|---|---|---|---|---|
| 1 | Tenda | `tenda` (construção) | versão | a de hoje / Beduína (listrada) / Com neve (as duas aqui, para o arquivo não se dividir com o L08) | média | `V/tendaVersoes.ts`, `F/tenda-versoes.png` |
| 2 | Esfinge | `esfinge` (construção) | novo | Inteira / Em ruína | média | `M/esfinge.ts`, `F/esfinge.png` |
| 3 | Coluna egípcia | `colunaEgipcia` | novo | Inteira / Quebrada | média | `M/colunaEgipcia.ts`, `F/coluna-egipcia.png` |
| 4 | Banca de especiarias | `barracaDeEspeciarias` | novo | — | média | `M/barracaDeEspeciarias.ts`, `F/barraca-de-especiarias.png` |
| 5 | Ossada gigante | `ossadaGigante` | novo (costelas e crânio de fera; serve o inferno) | — | média | `M/ossadaGigante.ts`, `F/ossada-gigante.png` |
| 6 | Tamareira | `tamareira` | carimbo, família Palmeira | (semente) | média | `K/tamareira.ts`, `F/tamareira.png` |
| 7 | Arenito em lajes | `arenito-em-lajes` | chão | — | alta | `C/arenitoEmLajes.ts`, `F/arenito-em-lajes.png` |
| 8 | Blocos de arenito | `blocos-de-arenito` | parede | — | alta | `P/blocos-de-arenito`, `F/blocos-de-arenito.png` |
| 9 | Adobe | `adobe` | parede (barro rebocado) | — | média | `P/adobe`, `F/adobe.png` |

**Total: 113 peças.** São 43 objetos ou construções novos, 32 famílias de versões em tipos que já existem, 14 chãos, 11 paredes e 13 carimbos. A isso se somam 4 materiais (I0-d), que viram variação em toda peça de pedra e de metal.

---

## Ordem e paralelismo

| Onda | Desenhistas (até 3, um lote cada) | Integrador |
|---|---|---|
| 1 | L01, L02, L03 | I0-a (versões, nicho e pirâmide), I0-c (chama), I0-d (materiais); depois encaixa L01 |
| 2 | L04, L05, L06 | I0-e (animadores), I0-b (famílias); encaixa L02 e L03 |
| 3 | L07, L08, L09 | encaixa L04 a L06 |
| 4 | L10, L11, L12 | encaixa L07 a L12 |

- O desenhista começa sem esperar o I0, porque o contrato acima basta. O integrador encaixa na ordem dos lotes.
- Publicar ao fechar cada onda: a regra "várias frentes = esperar o conjunto" vale por onda.
- Antes de cada onda, conferir o disco: piso de 8 GB (crise de 23/10 e 31/10).
- Uma suíte pesada por vez na máquina.

**Testes (regra do dono de 28/11: 1 a 3 por lote, os que atacam o problema):**

1. Folha de contato do lote, no molde de `moveis/folhaDeObjetosNovos.test.ts`: toda versão pinta, nenhum canal acima de 245, a pegada fica igual entre versões.
2. Ida e volta do mapa: a versão gravada volta igual, a versão desconhecida some, mapa antigo abre igual. Uma vez no I0-a, e de novo só se o lote mudar a regra.
3. Peça que mexe: o gráfico do movimento, amostrado a cada 0,1 s sem renderizar (ângulo da engrenagem, fase do pêndulo), e nenhuma tarefa longa de 200 ms ou mais com 20 peças animadas na tela.

---

## Fila da próxima leva (vale a pena; ficou fora pelo teto de 12 lotes)

- **Masmorra e prisão:** fuligem (carimbo), pergaminhos enrolados, bandeja de prisioneiro, arandela de meia-lua, grade de respiro, círculo mágico em versões (Arcano / Infernal / Natural).
- **Castelo:** mármore vinho (forma de Pisos de pedra), flâmula.
- **Cavernas:** cascalho azulado, folhagem rasteira de caverna, drusa gigante.
- **Neve:** arbusto nevado, toco com neve, cristais de gelo (carimbos).
- **Inferno:** enxofre (carimbo), chão de ossos.
- **Mecanismos:** dirigível ancorado, bancada de relojoeiro, mesa de inventor, Latão rebitado (forma do Chão de metal).
- **Cidade moderna:** moto e bicicleta, orelhão, máquina de refrigerante, parede de bloco de concreto, mancha de óleo, marcas no asfalto, o resto do presídio moderno da fila de 24/11.
- **Cidade e deserto:** pombos (carimbo), torre de vento, sarcófago egípcio.

## Propostas para depois (precisam de sistema novo)

1. **Parede que deixa a visão passar** (grade de cela, alambrado, vitrine): a mais pedida para Prisão. É a proposta 1 de 24/11.
2. **Lago congelado como líquido** (`liquido: 'gelo'` no programa da água, como a lava de 15/11). Até lá, o chão Gelo (L08) cobre.
3. **Telhado com neve** (cobertura em `texturas/telhado.ts`): o pacote de vila de inverno inteiro depende disso.
4. **Neve automática por cima de qualquer objeto.** Recusada agora, porque sem saber o tampo de cada peça sai mancha.
5. **Cano e trilho traçados à mão**, como o muro de fogo (`tracado` em mais tipos). Até lá, eles esticam e têm a curva como versão.
6. **Efeito de ambiente "areia soprando"** para o deserto.
7. **Decalque de parede** (limo escorrendo, pichação): proposta 7 de 24/11.
8. **Cartão com formas também nas paredes**, como no chão: hoje cada material é solto.

## Riscos (e como notar cedo)

- **O I0-a mexe em arquivos centrais** (`types/map.ts`, `stores/mapStore.ts`, `App.tsx` com 285 KB), com outros agentes na main. Commit só dos próprios caminhos (`git commit -- <caminhos>`) e um escritor por arquivo.
- **`variante` e `versao` misturadas quebram a lareira, a pilha e a lápide.** O teste 2 do I0-a cobre lareira de salão apagada.
- **As ameias podem pedir código em `pixi/paredeEmPecas.ts`**, se a receita da parede não alternar merlões. O desenhista do L03 avisa no relatório e o integrador decide.
- **A cerca desenha por trechos e com curva.** Versão que ignora isso some nas emendas. A folha do L07 mostra a cerca curva e esticada nas 4 versões.
- **Animação demais derruba o quadro.** O teste 3 mede, e com "menos movimento" tudo para.
- **Cor gritante** no portal, nas runas, na chama verde e no vitral: a régua "não estoura" (canal até 245, saturação contida) vale para brilho também.
- **Direito autoral:** brasões genéricos, carro sem marca, placa de trânsito genérica, nada de sprite ou paleta dos pacotes da pesquisa. Aviso de 1 linha se aparecer referência de jogo.

## Próximo passo

- **Integrador** (`programador-frontend`, Opus 5.5 xhigh): começar pela **I0-a**. Recebe este arquivo, seções "I0" e "Contrato com o desenhista". Critério de pronto: abrir um mapa com nicho funerário, clicar nele, escolher "Aberto" no painel, ver o nicho aberto, e salvar e reabrir igual. Mais os testes 1 e 2.
- **Ao mesmo tempo, 3 desenhistas** (`designer-opus`, Opus 5.5 max) pegam **L01, L02 e L03**. Cada um recebe a tabela do seu lote, a seção "Contrato com o desenhista" e as regras de arte de `docs/design/objetos-24-11/LISTA.md:20-37`. Cada um escreve só os arquivos da coluna "Arquivos novos".
