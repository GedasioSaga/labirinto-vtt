# Análise dos 8 mapas: para onde foi cada pedido

Feita pelo Claude em 24/11/2026. Usa como fonte as análises em `analise-mapa-1.md` a `analise-mapa-8.md`, nesta pasta, e mostra o destino de cada item que o mapa pediu.

## Como ler

Cada item do mapa termina num destes destinos:

- **nº N**: o número do item em `LISTA.md`.
- **existe**: o app já tem a peça igual. O nome do tipo vem entre parênteses.
- **fila**: cabe no sistema que já existe, mas ficou fora dos 120 por causa do teto de 12 lotes. Está na "Fila da próxima leva" da LISTA.
- **proposta**: precisa de sistema novo. Está em "Propostas para depois" da LISTA.
- **fora**: descartado, com o motivo escrito.

Quando dois mapas pedem a mesma coisa, os dois apontam para o mesmo número.

---

## Mapa 1: The Prison IV (prisão com salão redondo e sala de tortura)

**Objetos**
- Monte de palha de cela → nº 4
- Balde de dejetos → nº 5
- Grilhões de parede → nº 6
- Roda de carroça encostada → fila
- Tábua de pregos com argolas → nº 16
- Corpo enrolado em pano → nº 21
- Pertences confiscados → nº 27
- Mesa do carcereiro → nº 11
- Cadeira de metal → nº 1
- Catre de ferro de prisão → nº 3
- Mesa de ferro → nº 2
- Pilar com braseiro → nº 32
- Braseiro com ferros de marcar → nº 23
- Jaula de chão → nº 13
- Cepo do carrasco → nº 17
- Guilhotina → nº 26
- Roda de tortura → nº 25
- Molho de chaves no gancho → nº 12 (entra no quadro de chaves)
- Peças de prisão e tortura que já existem → existe (`celaComGrade`, `corrente`, `tochaDeParede`, `bueiro`, `potroDeTortura`, `damaDeFerro` e as outras da análise)

**Construções**
- Fosso gradeado com inscrições → nº 31
- Fosso de brasas → nº 24
- Forca com cadafalso → existe (`forcaComCadafalso`)
- Guarita → existe (`guarita`)

**Texturas**
- Piso de masmorra irregular → nº 111
- Pedra manchada de sangue → fila (por ora, o nº 20 sobre Lajotas de pedra faz o papel)
- Piso radial em anéis → proposta 3 (por ora, o nº 31 cobre o centro do salão)
- Parede de grades → proposta 1
- Lajotas escuras, laje de templo, parede castelo e escada de pedra → existe

**Carimbos**
- Palha espalhada → nº 10
- Luz pela grade do teto → fila
- Respingos de sangue → nº 20
- Rachadura de chão → nº 120
- Brasas e carvão espalhados → nº 29
- Fuligem no chão → fila
- Ratos → nº 30
- Poça, musgo e lama → existe (`poca`, `musgo`, `lama`)

## Mapa 2: The Prison (masmorra com canal, caverna e muralha)

**Objetos**
- Catre de palha de cela → nº 4
- Cama de ferro presa à parede → nº 3
- Cadeira de ferro → nº 1
- Mesa de ferro rebitada → nº 2
- Banco de pedra de cela → nº 9
- Latrina de cela → nº 8
- Balde de dejetos → nº 5
- Grilhões de parede → nº 6
- Bola de ferro com corrente → nº 7
- Bandeja de comida de prisioneiro → fila
- Quadro de chaves do carcereiro → nº 12
- Baú todo de ferro → nº 15
- Lanterna gradeada de parede → nº 33
- Arandela de meia-lua → fila
- Pufe / almofada de chão → fila
- Prancha vertical de tortura → nº 22
- Corpo envolto em mortalha → nº 21
- Gaiolas empilhadas de parede → nº 13 (várias jaulas lado a lado)
- Fosso de brasa com grade → nº 24
- Braseiro com ferros de marcar → nº 23
- Roda de tortura → nº 25
- Poste de açoite → nº 18
- Guilhotina → nº 26
- Guincho de corrente em leque → nº 28
- Grade de dreno quadrada → nº 14
- Grade de respiro em meia-lua → fila
- Pergaminhos enrolados → fila
- Pilha de roupas / trouxa → nº 87
- Potro, mesa de instrumentos, sangue, caixão e corrente → existe
- Escrivaninha, cadeiras, cama, beliche e depósito → existe

**Construções**
- Fosso escalonado → nº 31 (junto com o fosso do mapa 1)
- Cabeceira do canal → fila
- Estátua de guardião em nicho → fila
- Ornamento de pedra em espiral → fila
- Fornalha de incineração → nº 24
- Passarela coberta na muralha → fila (depende da telha em escama)
- Boca de caverna / túnel → fila
- Pátio de exercício cercado → fora: já se monta com a Cerca de ferro (ou o nº 100) e um portão
- Brecha na muralha → fora: já se monta com o Muro e os `escombrosDePedra`
- Portão gradeado, guarita, torre de vigia, cela e montanha → existe

**Texturas**
- Parede de tijolo vermelho com chapas → nº 117
- Parede de grade de cela → proposta 1
- Laje de masmorra → nº 111
- Telha de barro em escama → fila
- Piso de tijolo escuro de cela → nº 112
- Pedra lavrada do canal → fila
- Grade no chão, escada de pedra, água e caverna → existe

**Carimbos**
- Cachoeira → nº 75
- Espuma / correnteza → nº 80
- Folhagem rasteira de caverna → fila
- Rachadura no chão → nº 120
- Mancha de umidade na parede → proposta 7
- Rastro de sangue → nº 20
- Pedregulhos, lama, poça e musgo → existe

## Mapa 3: cortiço

**Objetos**
- Catre / cama simples → existe (`catre`)
- Catre desarrumado → nº 81
- Colchão de palha no chão → nº 4
- Cama de trapos → nº 108
- Cama de caixotes → nº 82
- Mesa redonda com cadeiras → existe (`mesaRedonda`)
- Mesa de caixote → nº 83
- Cadeira remendada → nº 84
- Banco comprido de tábua → nº 85
- Toco de vela no pires → nº 105
- Lampião → existe (`lampiao`)
- Lampião de lata → fila
- Fogareiro de ferro barrigudo → nº 106
- Lareira → existe (`lareira`)
- Poltrona → existe (`poltrona`)
- Poltrona rasgada → fila
- Tapete retangular e redondo → existe (`tapete`)
- Tapete puído → fila (só depois que o outro agente soltar os arquivos do tapete)
- Tapete longo → existe (`tapeteLongo`)
- Esteira redonda de palha → fila
- Cortina de pano no vão da porta → nº 86
- Pilha de caixas, caixa e barril quebrados → existe
- Barris deitados → existe (`barrisDeitados`)
- Destroços de madeira → existe (`destrocosDeMadeira`)
- Monte de entulho e lixo → nº 107
- Saco de trapos / trouxa → nº 87
- Penico → nº 5 (entra no balde de dejetos)
- Balde de água → existe (`balde`)
- Balde de lata enferrujado → fila
- Panelas e bacias → existe
- Prateleira de potes → existe
- Prateleira de tábua torta → fila
- Bancada de ferramentas → existe
- Escrivaninha → existe
- Carroça quebrada → existe
- Círculo riscado no chão → existe (`circuloMagico`)
- Sangue no chão → existe (`sangueNoChao`)
- Corpo coberto por lençol → nº 21
- Ratos → nº 30
- Cachorro vira-lata deitado → fila (a leitura do mapa é incerta)
- Varal de roupa → existe
- Escada de mão encostada → fila

**Construções**
- Barraco de tábuas pronto → fila
- Passarela de tábuas sobre a lama → nº 88
- Latrina de madeira → fila
- Bomba d'água com cocho → fila
- Vala de esgoto → fila
- Barraca de lona remendada → fila
- Degraus de madeira → existe (ferramenta Escada, madeira)

**Texturas**
- Chão de tábua velha → existe (`madeira-gasta`)
- Tábuas com frestas → nº 115
- Rua de lama escura com cascalho → fila
- Lama com lixo miúdo → fila
- Parede de tábuas → existe
- Parede de tábuas remendadas → nº 118
- Parede caiada → fila
- Telhado remendado → fila

**Carimbos**
- Lama → existe
- Poça suja de esgoto → nº 110
- Tábuas soltas → fila
- Lixo espalhado → nº 89
- Mato seco entre as tábuas → nº 90
- Folhas secas → existe
- Fumaça de chaminé → proposta 5

## Mapa 4: fortaleza escura do ritual

**Objetos**
- Corrente longa esticada → fila
- Corrente pendurada com gancho → fila
- Globo de luz vermelha → nº 34
- Tocha de chama vermelha → fila
- Braseiro de fogo mágico → nº 56 (a chama fria entrou; a vermelha ficou na fila)
- Selo geométrico dourado → fila
- Selo de órbitas azul → nº 35
- Esteira de palha → nº 4
- Catre de ferro → nº 3
- Cadeira de ferro → nº 1
- Mesa de ferro do carcereiro → nº 2
- Jaula de chão → nº 13
- Grade quadrada de chão → nº 14
- Painel de chaves → nº 12
- Flâmula vermelha → fila
- Cortina vermelha de passagem → nº 86
- Banco tombado → fila
- Banco estofado vermelho → fila
- Barril aberto com líquido → fila
- Pá de forno → fila
- Fardo embrulhado (mortalha) → nº 21
- Feixe de luz do teto → fila
- Balista → existe (`balista`)
- Altar redondo e laje de sacrifício → existe
- Corrente, cela, sangue, ossos e crânio → existe
- Móveis de serviço → existe

**Construções**
- Plataforma de ritual suspensa → nº 36
- Gárgula → nº 37
- Estátua de besta → nº 38
- Bloco de celas → proposta 2
- Pilar de amarração → fila
- Estátua encapuzada → nº 39
- Bastião com ameias → fora: já se monta com o Muro e a `torreDePedra`
- Arco ogival gótico → fila
- Ponte de corrente → nº 40
- Portão, abismo, mar, escada e barranco → existe

**Texturas**
- Ladrilho miúdo azulado → nº 116
- Lajota em diagonal → fila
- Tijolo de masmorra avermelhado → nº 112
- Cascalho azulado → fila
- Pedra escura de fortaleza (parede) → nº 119
- Rocha de caverna, laje de templo, losangos, areia e assoalho → existe

**Carimbos**
- Pilar de rocha no abismo → fila
- Buraco na rocha → fila
- Rachadura no chão → nº 120
- Rastro de sangue → nº 20
- Névoa rasteira → proposta 6
- Fenda em brasa vermelha → fora: a `fendaEmBrasa` que já existe é vermelho-laranja e já acende
- Cristais vermelhos → fila
- Pedras, rochedo, seixos e poça → existe

## Mapa 5: presídio moderno

**Objetos**
- Cama de cela de metal → nº 3
- Vaso com pia de aço → nº 91
- Mesinha de cela → nº 92
- Beliche de metal → fora: o `beliche` já aceita o material ferro
- Mesa de pátio com bancos fixos → nº 93
- Chuveiro coletivo → nº 94
- Armário de vestiário → nº 95
- Cadeira de plástico → nº 96
- Máquina de lavar industrial → nº 97
- Leito hospitalar → nº 98
- Mesa de escritório com computador → nº 99
- Cerca de alambrado → nº 100
- Mesa de aço com bancos redondos → fila
- Escada de metal vazada → fila
- Mictório → fila
- Pia coletiva → fila
- Banco de vestiário → fila
- Divisória de banheiro → fila
- Linha de servir → fila
- Pilha de bandejas → fila
- Fogão industrial → fila
- Bancada de inox → fila
- Coifa → fila
- Pia industrial → fila
- Prateleira de despensa → fila
- Carrinho de comida → fila
- Secadora → fila
- Mesa de dobrar roupa → fila
- Carrinho de roupa → fila
- Prateleira de uniformes → fila
- Cadeira de exame → fila
- Suporte de soro → fila
- Biombo hospitalar → fila
- Armário de remédios → fila
- Cadeira de rodas → fila
- Mesa de exame estofada → fila
- Caldeira → fila
- Tanque de pressão → fila
- Quadro elétrico → fila
- Tubulação de parede → fila
- Boiler → fila
- Mesa de vigilância → fila
- Pórtico detector de metal → fila
- Cabine de visita → fila
- Balcão de recepção → fila
- Cadeiras de espera → fila
- Bebedouro → fila
- Rack antimotim → fila
- Escudo e capacete antimotim → fila
- Arquivo de aço → fila
- Estação de trabalho dupla → fila
- Carteira escolar → fila
- Quadro branco → fila
- Mesa de pingue-pongue → fila
- Televisão → fila
- Banco de supino → fila
- Barra fixa → fila
- Suporte de halteres → fila
- Saco de pancada → fila
- Tabela de basquete → fila
- Arquibancada de metal → fila
- Viatura de polícia → fila
- Camburão → fila
- Moto de polícia → fila
- Refletor de muro → fila
- Poste moderno → fila
- Balizador → fila
- Caçamba de lixo → fila
- Cela com grade, mesa comprida, câmara frigorífica, gerador, estante, banheiro moderno, holofote, arame, cancela, barreira, bueiro, sofá e os outros da análise → existe

**Construções**
- Torre de vigia → existe
- Guarita → existe
- Caixa d'água e contêiner → existe
- Torre de concreto com holofote → fila
- Portão deslizante → fila
- Quadra poliesportiva → fila
- Torre de iluminação → fila

**Texturas**
- Piso epóxi → fila
- Lajota cerâmica cinza-azulada → fila
- Carpete em placas → fila
- Asfalto zebrado → fila
- Parede de bloco de concreto → fila
- Parede de grade de ferro → proposta 1
- Parede de alambrado → proposta 1 (por ora, a cerca nº 100 barra a passagem e deixa a visão passar)
- Concreto, azulejo, tábua, borracha, asfalto, cascalho, calçamento, chapa xadrez e as paredes concreto, tijolo e azulejo de hospital → existe

**Carimbos**
- Rachadura no concreto → nº 120
- Mancha de óleo → fila
- Lixo espalhado → nº 89
- Mato na fresta → nº 90
- Mancha de umidade → fila
- Grafite de chão → fila
- Poça, musgo e folhas secas → existe

## Mapa 6: templo na selva

**Objetos**
- Ponte de laje com mureta → existe (`ponte`, forma Pedra)
- Ponte de pedra quebrada → nº 61
- Ponte de tábuas quebrada → nº 62
- Ponte larga sobre pilares → nº 76
- Píer de madeira → existe (`pier`)
- Calçada de pedra sobre a água → nº 63
- Muro em ruína em L → nº 64
- Blocos de cantaria soltos → existe (`escombrosDePedra`)
- Pedestal redondo entalhado → nº 65
- Coluna de templo com glifos → nº 66
- Estela → nº 67
- Cabeça colossal de pedra → nº 73
- Ídolo dourado → nº 74
- Estátua de jaguar ou serpente → fila
- Totem tribal → fila
- Tocha de bambu → fila
- Braseiro de pedra escalonado → fila
- Altar de sacrifício escalonado → fila
- Laje de pressão → fila
- Baú de pedra → fila
- Canoa escavada → fila
- Urnas de barro pintado → fila
- Rede de dormir → existe
- Crânios e ossos → existe

**Construções**
- Pirâmide em degraus → nº 71
- Pirâmide alagada → nº 71 (forma alagada)
- Topo do templo → nº 72
- Cabana com telhado de lajes → nº 68
- Cabana de palha sobre palafitas → fila
- Cascata em degraus → nº 75
- Tanque com borda de pedra → nº 69
- Alicerce de casa em ruína → nº 64 (vários trechos de muro em ruína)
- Ilha de rocha com barranco → existe (ferramentas Barranco e Penhasco)
- Escadaria de pedra larga → existe (ferramenta Escada; o degrau de arenito está na fila)

**Texturas**
- Laje de arenito rachada → fila
- Grama, trilha, areia, rocha, chão de selva, pedra com musgo e água turquesa → existe
- Água corrente com espuma → proposta 4 (por ora, o nº 80 faz a espuma)
- Parede de templo entalhada → fila
- Escada de arenito → fila
- Telhado de lajes com musgo → fila (o nº 68 já leva o telhado no próprio desenho)

**Carimbos**
- Palmeira → existe
- Palmeira de selva → nº 77
- Palmeira com raízes → nº 77 (a semente varia)
- Árvore de copa redonda → existe
- Copa verde-azulada → fila
- Arbusto com frutinhas, raiz, galhos, tronco, toco, pedras, seixos, rochedo, pedras de passo, musgo, samambaia, bananeira, bambuzal e vitória-régia → existe
- Moita tropical → nº 78
- Cipós pendurados → nº 79
- Bromélias e orquídeas → fila
- Espuma de cachoeira → nº 80
- Blocos de cantaria caídos → nº 70

## Mapa 7: arena com celas e forja

**Objetos**
- Catre de ferro de cela → nº 3
- Cadeira de ferro → nº 1
- Mesa de ferro chumbada → nº 2
- Mesa de madeira com cadeiras → existe
- Banco de tábua sem encosto → nº 85
- Caixote / banquinho → existe (`banqueta`, `caixa`)
- Balde de dejetos → nº 5
- Fornalha acesa → existe (`fornalha`)
- Pilha de caixotes → existe
- Prateleira de parede → existe
- Cama com criado-mudo → existe
- Poço de sangue → nº 104
- Grade levadiça solta → nº 19
- Balaustrada curva → nº 103
- Laje de pressão em losango → fila
- Argola de parede com corrente → nº 6
- Portão de jaula de fera → fila
- Suporte de armas de gladiador → fila
- Ossos e sangue no fosso → existe

**Construções**
- Arquibancada de pedra em anel → nº 101 (quatro quartos de anel)
- Arquibancada de pedra reta → fila
- Fosso de arena → nº 102
- Tribuna → fila
- Cela com grade → existe
- Ringue de luta → existe
- Escada em caracol e escada reta → existe (ferramenta Escada)

**Texturas**
- Granito escuro salpicado → nº 113
- Terra batida rachada → nº 109
- Pedra de degrau gasta → fila
- Rocha de caverna, parede de pedra rústica e escada de pedra → existe

**Carimbos**
- Névoa saindo da caverna → existe (ferramenta Neblina)
- Rachaduras no chão → nº 120
- Poça de sangue → nº 20
- Rastro de luta → fila
- Clarão de brasa → existe (luz do fogo)

## Mapa 8: cripta ciano

**Objetos**
- Túmulo de pedra → existe (`tumuloDePedra`)
- Sarcófago aceso com cristais → nº 51
- Sarcófago com a tampa empurrada → nº 41
- Sarcófago de bronze → nº 42
- Caixão de ferro → nº 43
- Relicário de cristal → nº 52
- Laje tumular no chão → nº 44
- Laje tumular acesa → nº 53
- Nicho funerário → nº 45
- Nicho funerário aberto → nº 45 (forma aberta)
- Coluna redonda lisa → nº 46
- Pilastra quadrada → nº 47
- Pilar com base quadrada → existe (`pilar`)
- Pedestal de canto com cristal → nº 54
- Arandela de cristal → nº 55
- Estátua da abside → existe (`estatua`, `anjoDePedra`)
- Mureta de pedra → existe (`muroBaixoDePedra`)
- Altar de cristal → fila
- Braseiro de chama azul → nº 56
- Candelabro de chama fria → fila
- Urna funerária → nº 48
- Ossário → nº 57
- Banco de pedra → nº 9
- Crânio, ossos e teia → existe

**Construções**
- Arcossólio → nº 58
- Parede de gavetas (columbário) → nº 49
- Estrado em meia-lua → nº 50
- Abside com nicho de estátua → fora: já se monta com parede curva, pedestal e `estatua`
- Mausoléu → existe (`mausoleu`)

**Texturas**
- Lajotas de pedra → existe
- Losangos de pedra → fila
- Lajeado poligonal escuro → nº 114
- Lajes que brilham → fila
- Mármore vinho → fila
- Parede de pedra clara → existe (`castelo`, `pedra-rustica`)
- Degrau de pedra talhada → fila

**Carimbos**
- Cristais ciano → nº 59
- Lascas de cristal → nº 59 (a semente faz a versão pequena)
- Névoa fria → proposta 6
- Rachadura no chão → nº 120
- Selo de cristal no chão → nº 60 (virou objeto rente, para ter luz)
- Estalagmite → existe
- Pedras e seixos → existe
- Musgo → existe
