# Análise do mapa de referência 4: fortaleza escura

24/11/2026. Mapa: fortaleza escura com celas, ritual com correntes, água azul e luz vermelha (imagem 14.png, 1008 x 1680).
Olhei o mapa por quatro faixas, ampliadas duas vezes: a caverna do ritual (topo), o bloco das celas (meio), o salão azul e as salas de serviço (baixo), e o cais com o mar (pé).

Como ler:
- **novo**: o app não tem.
- **versão**: o app tem a peça, mas falta esta versão (por exemplo, o catre de ferro, quando só existe o de madeira).
- **existe**: já dá para montar com o que o app tem.
- Complexidade: **complexo** = forma orgânica, muitas partes, luz ou brilho, água, construção grande. **simples** = móvel ou peça de forma direta.
- Os itens marcados como "tema" não aparecem no mapa. São versões que combinam com ele, porque o dono pediu formas novas no estilo da cadeira de metal.

O que o mapa tem, por região:
- **Topo, a caverna do ritual.** Uma plataforma redonda de pedra fica sobre o abismo, presa por 8 correntes a pilares baixos. No meio dela há um altar com um vulto deitado, dentro de um anel verde. Em volta, uma passarela octogonal com escadas retas e diagonais. Nos cantos há ilhotas de rocha ocas, com correntes longas indo até a parede da caverna, e nichos com balistas. Do alto desce um feixe de luz azul.
- **Muralha do ritual.** Bastiões com balistas, globos vermelhos acesos no chão, uma calha de brasa no alto do muro, um selo dourado de quadrado e losango e dois arcos ogivais na entrada. Há também um buraco na rocha.
- **Meio, as celas.** Um bloco de celas à esquerda (4 x 3, com esteiras de palha e um balde). Do outro lado, fileiras de celas estreitas com grilhões e restos de ossos. Os corredores são de tijolo avermelhado, com arandelas vermelhas. Há uma sala de selo com uma estátua encapuzada, uma mesa do carcereiro, caixas e barris, uma jaula de chão, grades quadradas no piso e uma escada com passadeira vermelha.
- **Salão de cascalho.** Cascalho azulado manchado de sangue, bancos tombados e flâmulas vermelhas nas paredes.
- **Baixo à esquerda, o salão azul.** Ladrilho miúdo azulado com um grande selo de órbitas e um yin-yang no centro. Tem uma estátua de besta ladeada por gárgulas, mais gárgulas nos cantos e cortinas vermelhas nas passagens. Ao lado fica uma salinha rosada com escrivaninha, livros e escada.
- **Baixo à direita, as salas de serviço.** Um depósito com fardos alongados (parecem mortalhas), cordas, suporte de armas, cavaletes e uma mesa com mapa. Uma cozinha verde com forno de pão, pá de forno e mesa de comida. Uma despensa rosada com potes, tinas abertas coloridas e caixas. Um corredor laranja aceso, quartos com cama e tapete, uma balaustrada de madeira e um banco estofado vermelho no corredor.
- **Pé do mapa, o cais.** O mar azul com reflexos, um píer de madeira até a praia de areia com rochedos, e o portão da fortaleza guardado por duas gárgulas.

---

## 1. OBJETOS

| # | Objeto | Tipo | Base no app | Complexidade | Descrição |
|---|---|---|---|---|---|
| 1 | Corrente longa esticada (traçada) | versão | `corrente` | simples | A corrente de ferro traçada ponto a ponto entre dois apoios, como as 8 que seguram a plataforma e as que cruzam o abismo. Hoje a `corrente` é uma peça de 1 casa. O traçado seguiria o `muroDeFogo` (`Prop.tracado`). |
| 2 | Corrente pendurada com gancho | versão (tema) | `corrente` | simples | A corrente que desce do teto com um gancho na ponta, para a sala de tortura e as celas. |
| 3 | Globo de luz vermelha no chão | novo | — | complexo | Um anel de ferro com um globo vermelho aceso e um pino de fixação (os círculos vermelhos da muralha). Ilumina em vermelho e entra em `LUZ_DOS_OBJETOS`. |
| 4 | Tocha de parede de chama vermelha | versão | `tochaDeParede` | complexo | A arandela das celas e dos corredores, com a chama e a luz vermelhas no lugar das laranja. |
| 5 | Braseiro de fogo mágico (vermelho ou azul) | versão (tema) | `braseiro` | complexo | O braseiro de ritual com a chama colorida e a luz da mesma cor. |
| 6 | Selo geométrico dourado (quadrado e losango) | versão | `circuloMagico` | simples | O selo rente ao chão da entrada do ritual e da sala da estátua: um quadrado, um losango e um círculo em traço dourado. |
| 7 | Selo de órbitas azul brilhante | versão | `circuloMagico` | complexo | O grande selo do salão azul: elipses cruzadas como órbitas, com um yin-yang no centro e brilho azul fraco. |
| 8 | Esteira de palha (enxergão) | versão | `catre` | simples | A cama de preso: um colchão de palha rente ao chão, sem estrutura. São as esteiras das celas da esquerda. |
| 9 | Catre de ferro | versão (tema) | `catre` | simples | O catre de prisão com estrado de barras de ferro e um cobertor ralo. |
| 10 | Cadeira de ferro | versão (tema) | `cadeira` | simples | A cadeira do carcereiro, de barra de ferro rebitada, para a mesa da guarda. |
| 11 | Mesa de ferro do carcereiro | versão (tema) | `mesa` | simples | A mesa de chapa de ferro com rebites, para o posto da guarda. |
| 12 | Jaula de chão | versão | `gaiolaSuspensa` | simples | A gaiola quadrada de barras pousada no chão, de 1 casa (a do bloco da direita). |
| 13 | Grade quadrada de chão (ralo de masmorra) | versão | `bueiro` | simples | O ralo de ferro quadrado rente ao chão, que aparece duas vezes nos corredores das celas. |
| 14 | Painel de chaves do carcereiro | novo (tema) | — | simples | Uma tábua de parede com ganchos e molhos de chaves. |
| 15 | Flâmula vermelha triangular de parede | versão | `tapecariaDeParede` | simples | As flâmulas vermelhas pontudas presas nas paredes do salão de cascalho e do portão. |
| 16 | Cortina vermelha de passagem | novo | — | simples | O reposteiro pesado preso no vão da porta, aberto em meia-lua, como nas passagens do salão azul. |
| 17 | Banco tombado | versão | `bancosDeCapela` | simples | O banco de madeira caído de lado, como os do salão de cascalho. |
| 18 | Banco estofado vermelho | versão | `banqueta` | simples | O banco comprido com assento de veludo vermelho e pontas douradas, do corredor das salas de serviço. |
| 19 | Barril aberto com líquido | versão | `barril` | simples | O barril sem tampa, cheio de tinta, vinho ou água, como as tinas coloridas da despensa. |
| 20 | Pá de forno | novo | — | simples | A pá de cabo comprido, encostada ou deitada junto ao forno de pão. |
| 21 | Fardo embrulhado (mortalha) | novo | — | complexo | Um volume alongado enrolado em pano e amarrado com corda, como os do depósito. A leitura é incerta: podem ser corpos amortalhados ou sacos compridos. A forma é orgânica. |
| 22 | Feixe de luz do teto | novo | — | complexo | Um raio de luar azul e translúcido que desce sobre o chão, como sobre a plataforma do ritual. É luz pintada por cima do que está embaixo. |
| 23 | Balista | existe | `balista` | complexo | As balistas dos nichos e dos bastiões. |
| 24 | Altar redondo | existe | `altarRedondo` | simples | O altar do meio da plataforma. O vulto deitado sai com a `lajeDeSacrificio`, que já existe. |
| 25 | Laje de sacrifício | existe | `lajeDeSacrificio` | simples | A pedra onde o vulto está preso. |
| 26 | Corrente (grilhões de parede) | existe | `corrente` | simples | Os grilhões das celas estreitas (o desenho já traz a placa, a corrente e os aros). |
| 27 | Cela com grade | existe | `celaComGrade` | simples | Serve para as celas soltas. O bloco inteiro está nas construções (item C4). |
| 28 | Sangue no chão | existe | `sangueNoChao` | simples | As manchas do salão de cascalho e do salão azul. |
| 29 | Ossos e crânio | existe | `ossos`, `cranio` | simples | Os restos nas celas estreitas. |
| 30 | Caixa, pilha de caixas e barril | existe | `caixa`, `pilhaDeCaixas`, `barril` | simples | Nos corredores, no depósito e na despensa. |
| 31 | Balde | existe | `balde` | simples | O balde das celas. |
| 32 | Mesa, cadeira e banqueta | existe | `mesa`, `cadeira`, `banqueta` | simples | O posto da guarda e as salas de serviço. |
| 33 | Mesa de guerra (mesa com mapa) | existe | `mesaDeGuerra` | simples | A mesa com mapa e papéis do depósito. |
| 34 | Cordas enroladas | existe | `cordasEnroladas` | simples | Os rolos de corda do depósito. |
| 35 | Suporte de armas | existe | `suporteDeArmas` | simples | O suporte do depósito. |
| 36 | Serra (cavalete) | existe | `serra` | simples | Os cavaletes de madeira do depósito. |
| 37 | Forno de pão | existe | `fornoDePao` | simples | O forno da cozinha verde. |
| 38 | Prateleira de potes | existe | `prateleiraDePotes` | simples | A despensa rosada. |
| 39 | Escrivaninha e estante de livros | existe | `escrivaninha`, `estanteDeLivros` | simples | A salinha rosada ao lado do salão azul. |
| 40 | Cama de casal e criado-mudo | existe | `camaDeCasal`, `criadoMudo` | simples | Os quartos de baixo à direita. |
| 41 | Tapete e tapete longo | existe | `tapete`, `tapeteLongo` | simples | O tapete do quarto, a passadeira vermelha da escada e o corredor laranja. |
| 42 | Cerca (balaustrada de madeira) | existe | `cerca` | simples | A balaustrada do canto de baixo à direita. |
| 43 | Píer | existe | `pier` | simples | O cais de madeira até a praia. |
| 44 | Escombros de pedra | existe | `escombrosDePedra` | simples | O entulho na beira da caverna. |

## 2. CONSTRUÇÕES

| # | Construção | Tipo | Base no app | Complexidade | Descrição |
|---|---|---|---|---|---|
| C1 | Plataforma de ritual suspensa por correntes | novo | — | complexo | O disco de pedra sobre o abismo, com borda de pilaretes, um anel mágico verde e argolas de onde saem as correntes. É o centro do mapa. Junta o item 1 (as correntes) e o altar redondo. |
| C2 | Gárgula | novo | — | complexo | A gárgula de pedra agachada, de asas fechadas, vista de cima. São as seis do salão azul e as duas do portão. Ficaria em Monumentos e colunas, junto da estátua. |
| C3 | Estátua de besta (demônio) | novo | — | complexo | A estátua grande de criatura com chifres e asas, encostada na parede do salão azul. |
| C4 | Bloco de celas | novo (tema) | `celaComGrade` | complexo | Uma fileira de 3 ou 4 celas com grade e portinhola numa peça só, como o bloco da esquerda. Hoje não há peça pré-montada: as celas são feitas à mão, com paredes e porta. |
| C5 | Pilar de amarração | versão | `pilar` | simples | O pilar baixo e quadrado com topo em pirâmide e uma argola para a corrente. São os 8 da passarela octogonal. |
| C6 | Estátua encapuzada (cultista) | versão | `estatua` | complexo | O vulto de pedra de capuz e túnica, da sala do selo dourado. |
| C7 | Bastião com ameias | versão | `torreDePedra` | complexo | O canto saliente da muralha com ameias e nicho de balista, como os dois do topo. |
| C8 | Arco ogival gótico | versão | `arcoDoPortao` | simples | O arco pontudo de pedra das duas portas da entrada do ritual. |
| C9 | Ponte de corrente de ferro | versão (tema) | `ponte` | complexo | A ponte suspensa de correntes e tábuas sobre o abismo. Hoje a `ponte` é de madeira, de pedra ou de corda. |
| C10 | Portão com grade levadiça | existe | `portaoComGradeLevadica` | complexo | O portão da fortaleza na beira do cais. |
| C11 | Estátua | existe | `estatua` | simples | Serve de base para as estátuas, enquanto a gárgula e a besta não existem. |
| C12 | Pilar | existe | `pilar` | simples | Os pilares da passarela, na forma de hoje. |
| C13 | Abismo (ferramenta) | existe | `lib/abismo.ts` | complexo | O vazio escuro em volta da plataforma do ritual. |
| C14 | Água: mar (ferramenta) | existe | `lib/agua/` | complexo | O mar azul que cerca a fortaleza (o tipo `mar` na cor `mar`). |
| C15 | Escada (ferramenta) | existe | escada | simples | As escadas retas e diagonais da passarela, a escada de pedra do salão e a da salinha. |
| C16 | Barranco (ferramenta) | existe | `lib/barranco.ts` | simples | A borda de rocha da caverna e da costa. |

## 3. TEXTURAS

| # | Textura | Tipo | Base no app | Complexidade | Descrição |
|---|---|---|---|---|---|
| T1 | Ladrilho miúdo de pedra azulada | versão | `azulejo-branco` / `laje-de-templo` | simples | O chão do salão azul: quadradinhos de pedra cinza-azulada, menores que a laje de templo. |
| T2 | Lajota de pedra em diagonal | versão | `laje-de-templo` | simples | As lajotas quadradas giradas 45 graus dos corredores de baixo e do corredor do salão. |
| T3 | Tijolo de masmorra avermelhado | versão | `rua-de-tijolos` | simples | O tijolo escuro e avermelhado dos corredores das celas, mais encardido que a rua de tijolos. |
| T4 | Cascalho azulado frio | versão | `cascalho` | simples | O cascalho cinza-azulado do salão central, mais frio que o cascalho de hoje. |
| T5 | Pedra escura de fortaleza (parede) | versão | `castelo` (MATERIAIS_DA_PAREDE) | simples | A parede de blocos quase pretos, de basalto, do mapa todo. Entra no fim da lista, para não mudar a semente das juntas. |
| T6 | Rocha de caverna | existe | `rocha-de-caverna` (chão e parede) | simples | O chão e a parede da caverna do ritual. |
| T7 | Laje de templo | existe | `laje-de-templo` | simples | A passarela octogonal e a plataforma. |
| T8 | Losangos | existe | `losangos-*` | simples | O piso verde da cozinha. Fica bem com uma cor verde-acinzentada, que pode ser uma forma nova do cartão. |
| T9 | Areia | existe | `areia` | simples | A praia do cais. |
| T10 | Assoalho | existe | `assoalho-claro` / `tabua-envernizada` | simples | Os quartos e a despensa. |

## 4. CARIMBOS

| # | Carimbo | Tipo | Base no app | Complexidade | Descrição |
|---|---|---|---|---|---|
| K1 | Pilar de rocha no abismo | novo | — | complexo | A ilhota de rocha oca que sobe do abismo, de borda irregular, como as quatro da caverna. |
| K2 | Buraco na rocha | novo | — | complexo | Uma toca escura de boca irregular num chão de pedra (o buraco do canto de cima à direita). |
| K3 | Rachadura no chão | novo | — | simples | Uma fenda fina e ramificada na pedra. A caverna tem várias. O catálogo confirma que o app não tem rachadura. |
| K4 | Rastro de sangue | novo | — | simples | Respingos e um rastro arrastado, mais solto que o objeto `sangueNoChao`, como o do salão de cascalho. |
| K5 | Névoa rasteira | novo | — | complexo | Uma névoa roxa e translúcida sobre o abismo e o chão da caverna. |
| K6 | Fenda em brasa vermelha (calha da muralha) | versão | `fendaEmBrasa` | complexo | A brasa comprida no alto da muralha do ritual, em tom vermelho. Ilumina (`LUZ_DOS_CARIMBOS`). |
| K7 | Cristais vermelhos | versão (tema) | `cristais` / `cristaisVerdes` | complexo | Cristais de cor de sangue que brilham em vermelho, para o ritual. |
| K8 | Pedras | existe | `pedras` | simples | Os rochedos da praia do cais. |
| K9 | Rochedo com musgo | existe | `rochedoComMusgo` | simples | A pedra grande da costa. |
| K10 | Seixos | existe | `seixos` | simples | O cascalho miúdo da beira da caverna. |
| K11 | Poça | existe | `poca` | simples | As poças da caverna. |

---

## Resumo

- **Novos (15):**
  - Objetos: o globo de luz vermelha, o painel de chaves, a cortina de passagem, a pá de forno, o fardo embrulhado e o feixe de luz.
  - Construções: a plataforma de ritual, a gárgula, a estátua de besta e o bloco de celas.
  - Carimbos: o pilar de rocha no abismo, o buraco na rocha, a rachadura, o rastro de sangue e a névoa.
- **Versões (28):**
  - Objetos: a corrente traçada e a pendurada; a tocha e o braseiro de luz colorida; os dois selos; a esteira e o catre de ferro; a cadeira e a mesa de ferro; a jaula de chão; a grade de chão; a flâmula; o banco tombado; o banco estofado; o barril aberto.
  - Construções: o pilar de amarração, a estátua encapuzada, o bastião, o arco ogival e a ponte de corrente.
  - Texturas: 5.
  - Carimbos: 2.
- **O que mais pesa no mapa** é a plataforma de ritual com as correntes traçadas (C1 + item 1) e a luz vermelha (itens 3, 4 e 5, e o carimbo K6). Sem essas peças, o mapa perde a cara.
- **Ponto incerto:** o item 21 (os fardos alongados do depósito). A imagem não deixa claro se são mortalhas ou sacos. Convém o mestre confirmar antes de desenhar.
