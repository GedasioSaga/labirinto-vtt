# Mapa de referência 1: The Prison IV

Análise de 24/11/2026, feita pelo Claude sobre a imagem de 794x596 px. Recortei a imagem em 6 regiões e ampliei cada uma 3x: o bloco de celas de cima, o salão redondo, o escritório e o depósito do meio, o corredor de celas da direita, o alojamento e a despensa de baixo e a sala de tortura. Como a imagem é pequena, os detalhes miúdos (o que há dentro de cada cela, os instrumentos em cima das mesas) são leitura provável, não certa.

O catálogo `docs/design/objetos-24-11/CATALOGO.md` ainda não existe. A comparação foi feita direto no código: os rótulos em `client/src/lib/mobilia/pecasNovas.ts`, os 11 móveis antigos em `client/src/lib/mobilia.ts`, os carimbos em `client/src/carimbos/`, as texturas em `client/src/texturas/` e os materiais em `client/src/texturas/meioTermo/materiais.ts`.

## O que o mapa mostra

- **Bloco de celas de cima**: um corredor com 8 celas em cima e 5 embaixo. Cada cela tem a frente de grade (a linha pontilhada), um monte de palha ou um catre e às vezes um balde. No corredor há tochas na parede, bueiros, pilhas de caixas e de sacos e duas rodas de carroça encostadas na ponta da direita. No chão aparecem quadriculados de luz, que é a luz entrando pelas grades do teto.
- **Salão redondo**: o piso faz anéis de lajes em volta do centro. Quatro pilares têm fogo em cima. No meio há um fosso com grade em anel e um círculo de inscrições, e o centro tem um ponto vermelho que brilha. Há degraus nas quatro entradas, um carrinho de mão e, no corredor da esquerda, a mesa do carcereiro.
- **Escritório** (no meio, em cima): escrivaninha com livros e papéis verdes, duas poltronas, estante e mesinha.
- **Depósito** (no meio, à direita): pertences confiscados (roupas, sacos, trouxas), uma roda e uma peça de ferro.
- **Corredor de celas da direita**: 15 celas com catres, bueiros e tochas. A sala do topo tem uma mesa manchada de sangue.
- **Alojamento** (embaixo, à esquerda): camas, armários, caixas, um tapete grande e uma mesa redonda com comida.
- **Despensa** (embaixo, no meio): barris, sacos, caixas, um forno ou braseiro aceso, um caldeirão, uma roda e uma mesa com pratos.
- **Sala de tortura** (embaixo, à direita): muito sangue no chão, potro, instrumentos nas paredes, um nicho com fogo, uma tábua de pregos com argolas, dois corpos enrolados e o fosso de brasas (o quadrado laranja).

Legenda: **novo** = o app não tem. **versão** = o app tem a peça, mas falta esta versão (o id-base vem entre parênteses). **existe** = já dá para montar com o que há.
Complexidade: **complexo** = forma orgânica, muitas partes, luz ou brilho, água ou construção grande. **simples** = móvel ou peça de forma direta.

## 1. OBJETOS

### Existem (não precisam de nada)

| Item no mapa | No app |
|---|---|
| Frente de grade das celas | Cela com grade (`celaComGrade`) |
| Correntes | Corrente (`corrente`) |
| Tochas do corredor | Tocha de parede (`tochaDeParede`) |
| Grade de esgoto no chão | Bueiro (`bueiro`) |
| Caixas e sacos do corredor e da despensa | Pilha de caixas (`pilhaDeCaixas`), Sacos de grão (`sacosDeGrao`), Barril, Barris deitados (`barrisDeitados`) |
| Carrinho de mão do salão | Carrinho de mão (`carrinhoDeMao`) |
| Escritório | Escrivaninha (`escrivaninha`), Poltrona (`poltrona`), Estante de livros (`estanteDeLivros`) |
| Alojamento | Cama ou catre (`catre`), Beliche (`beliche`), Armário de ferro (`armarioDeFerro`), Mesa redonda (`mesaRedonda`) |
| Despensa | Caldeirão (`caldeirao`) |
| Sala de tortura | Potro de tortura (`potroDeTortura`), Dama de ferro (`damaDeFerro`), Mesa de instrumentos de tortura (`mesaDeInstrumentos`), Mesa de corte (`mesaDeCorte`), Sangue no chão (`sangueNoChao`), Ossos (`ossos`), Crânio (`cranio`) |
| Do tema, mesmo que não apareçam | Tronco de prisioneiro, Gaiola suspensa, Cadeira de interrogatório, Forca, Suporte de armas, Teia de aranha |

### Novos e versões

| Item | Tipo | Complexidade | O que desenhar |
|---|---|---|---|
| Monte de palha de cela | novo | simples | A "cama" do preso: um monte achatado de palha com fios soltos em volta, rente ao chão (ehMovelDoChao). Está em quase todas as celas. |
| Balde de dejetos | versão (`balde`) | simples | O balde de cela: madeira escura, aro de ferro e tampa torta ou sem tampa, com o conteúdo escuro. Hoje o app só tem o balde de água. |
| Grilhões de parede | versão (`corrente`) | simples | Duas argolas chumbadas na parede, com correntes curtas e algemas abertas penduradas. A corrente de hoje é solta; esta é a de prender o preso. |
| Roda de carroça encostada | novo | simples | Uma roda de madeira com aro de ferro e raios, deitada ou encostada. Aparece na ponta do corredor de cima (duas), no depósito e na despensa. |
| Tábua de pregos com argolas | novo | simples | Uma prancha comprida de madeira, cheia de pregos, com argolas de ferro nas pontas para pulsos e tornozelos. Está embaixo, na sala de tortura. |
| Corpo enrolado em pano | novo | complexo | Um vulto comprido, enrolado em pano listrado e amarrado com cordas. São dois no meio da sala de tortura. A forma é orgânica. |
| Pertences confiscados | novo | complexo | Um monte de roupas dobradas, trouxas, sacos, botas e uma espada embainhada. É o depósito do meio. Tem muitas partes. |
| Mesa do carcereiro | versão (`escrivaninha`) | simples | Uma mesa rústica de madeira e ferro, com livro de registro aberto, tinteiro e molho de chaves. Está no corredor da esquerda do salão. |
| Cadeira de metal | versão (`cadeira`) | simples | Uma cadeira de ferro rebitado, de espaldar reto. Hoje a cadeira só tem madeira na escolha de material. |
| Catre de ferro de prisão | versão (`catre`) | simples | Uma armação de ferro presa à parede com correntes, colchão fino de lona e sem travesseiro. Hoje o catre só tem madeira. |
| Mesa de ferro | versão (`mesa`) | simples | Uma mesa de chapa de ferro com rebites e pés de cantoneira. Hoje a mesa só tem madeira. |
| Pilar com braseiro | versão (`pilar`) | complexo | O pilar quadrado de pedra com uma bacia de fogo em cima, que ilumina (LUZ_DOS_OBJETOS). São os 4 pilares do salão redondo. |
| Braseiro com ferros de marcar | versão (`braseiro`) | complexo | O braseiro com brasa acesa e três ferros de marcar enfiados nela, com os cabos para fora. Ilumina. É o nicho de fogo da sala de tortura. |
| Jaula de chão | versão (`gaiolaSuspensa`) | simples | Uma jaula baixa de barras, apoiada no chão, do tamanho de uma pessoa agachada. Não aparece no mapa, mas combina com a prisão. |
| Cepo do carrasco | versão (`tocoComMachado`) | simples | Um cepo de madeira escura com o entalhe do pescoço, o machado de carrasco encostado e mancha de sangue. Não aparece no mapa, mas combina com a prisão. |
| Guilhotina | novo | simples | Duas colunas de madeira, uma lâmina inclinada, o cepo com a meia-lua e um cesto embaixo. Não aparece no mapa, mas combina com a prisão. |
| Roda de tortura | novo | simples | Uma roda grande de madeira num eixo, com cravos e tiras de couro. Não aparece no mapa, mas combina com a sala de tortura. |
| Molho de chaves no gancho | novo | simples | Um gancho de parede com uma argola de chaves grandes de ferro. Vai bem ao lado da mesa do carcereiro. |

## 2. CONSTRUÇÕES

| Item | Tipo | Complexidade | O que desenhar |
|---|---|---|---|
| Fosso gradeado com inscrições | novo | complexo | A peça do meio do salão redondo: um poço redondo e largo, coberto por uma grade em anel, com um círculo de pedra com letras gravadas em volta e, no centro, um olho ou gema vermelha que brilha. Ocupa cerca de 6x6 casas. Barra a passagem (pela grade, só no centro), não tapa a visão e ilumina de leve. |
| Fosso de brasas | novo | complexo | O quadrado laranja da sala de tortura: uma cova de 2x2 casas com borda de pedra, cheia de brasa viva que ilumina. Barra a passagem, não tapa a visão e brilha (LUZ_DOS_OBJETOS). |
| Forca com cadafalso | existe (`forcaComCadafalso`) | complexo | Não aparece no mapa, mas é do tema e já existe. |
| Guarita | existe (`guarita`) | simples | Não aparece no mapa, mas serve para o portão de uma prisão. Já existe. |
| Bloco de celas pronto | não entra | | O app não tem peça pré-montada de várias partes (prefab). As celas deste mapa se fazem com Parede, Porta e Cela com grade. Fica registrado como limite, não como item. |

## 3. TEXTURAS

| Item | Tipo | Complexidade | O que desenhar |
|---|---|---|---|
| Lajotas de pedra escura | existe | simples | O piso geral dos corredores e celas (cartão Lajotas de pedra, forma Escura). |
| Laje de templo | existe | simples | Serve para as salas de piso mais regular (escritório e alojamento). |
| Piso de masmorra irregular | versão (Lajotas de pedra) | simples | Lajes de tamanhos diferentes, com rejunte largo e escuro, umidade nos cantos e algumas lajes rachadas. É o chão das celas e do corredor da direita. Entra como 3ª forma do cartão Lajotas de pedra. |
| Pedra manchada de sangue | versão (Lajotas de pedra) | simples | Lajes escuras com manchas vinho velhas espalhadas sem padrão e sem listra. É o chão da sala de tortura. Sem vermelho vivo, para respeitar a regra da cor contida. |
| Piso radial em anéis | novo | complexo | As lajes fazem coroas em volta de um centro, como no salão redondo. É difícil porque a textura hoje é cor(u,v) repetida; o anel depende do centro da sala. Talvez precise ser uma construção de chão, e não uma textura. |
| Parede de pedra de masmorra | existe | simples | Os blocos cinza com rejunte claro do mapa são o material castelo ou pedra-rústica. |
| Parede de grades | novo | complexo | Um material de parede feito de barras de ferro verticais, para desenhar a frente das celas com a ferramenta Parede. Por ser grade, a visão deveria passar por ela, e isso é regra nova de visão, não só de imagem. Se entrar, vai no fim de MATERIAIS_DA_PAREDE. |
| Chão de metal com grade | existe | simples | Para alçapões e passarelas (cartão Chão de metal, forma Grade). |
| Escada de pedra | existe | simples | As escadas do mapa são de blocos de pedra (pedra-cascalho ou pedra-pedregulhos). |

## 4. CARIMBOS

| Item | Tipo | Complexidade | O que desenhar |
|---|---|---|---|
| Palha espalhada | novo | simples | Fios e tufos de palha soltos no chão, em tom de feno apagado. Aparece no chão das celas e em volta dos catres. |
| Luz pela grade do teto | novo | complexo | Um quadriculado de luz fria no chão, com bordas suaves, como a luz que cai por uma grade no teto. Aparece três vezes no corredor de cima e duas no salão. É brilho, não fonte de luz: só clareia a pintura. |
| Respingos de sangue | versão (`sangueNoChao`) | simples | Respingos pequenos e gotas em várias formas, para espalhar com o carimbo. Hoje só existe o objeto Sangue no chão, que é uma mancha só. A sala de tortura tem dezenas deles. |
| Rachadura de chão | novo | simples | Uma fenda fina e ramificada na pedra, sem brilho. Hoje não existe nenhuma rachadura genérica. Aparece nas lajes de quase todas as salas. |
| Brasas e carvão espalhados | versão (`fendaEmBrasa`) | complexo | Pedaços de carvão e brasas soltas que brilham, para pôr em volta do fosso de brasas e dos braseiros. A fenda em brasa que existe é uma fenda, não um monte solto. |
| Fuligem no chão | novo | simples | Uma mancha preta e esfumada, de queimado, para pôr embaixo de braseiros e tochas. |
| Ratos | novo | complexo | Dois ou três ratos pequenos em poses diferentes. Não se veem no mapa, mas são do tema de prisão. A forma é orgânica. |
| Poça, musgo e lama | existe | simples | Servem para a umidade da masmorra (`poca`, `musgo`, `lama`). |

## Resumo

- **Objetos**: 18 entre novos e versões (8 novos e 10 versões). 4 são complexos: o corpo enrolado, os pertences confiscados, o pilar com braseiro e o braseiro com ferros.
- **Construções**: 2 novas, ambas complexas: o fosso gradeado com inscrições e o fosso de brasas.
- **Texturas**: 4 entre novas e versões. 2 são complexas: o piso radial e a parede de grades. As duas mexem em regra (centro da textura, visão através da parede), não só em desenho.
- **Carimbos**: 7 entre novos e versões. 3 são complexos: a luz pela grade, as brasas e os ratos.
- O que o mapa mais pede e o app não tem: a **cama de palha**, os **grilhões de parede**, os **respingos de sangue**, a **rachadura** e o **fosso de brasas**. Com esses cinco, uma prisão deste tipo fica montável quase inteira.
