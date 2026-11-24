# Mapa de referência 5: prisão moderna

Análise de 24/11/2026, feita pelo Claude olhando a imagem por região (6 recortes ampliados 2x). O mapa tem: pavilhão de celas em U (oeste), dois pavilhões em fileira (nordeste), vestiário com chuveiros e mictórios, pátio de musculação, sala de controle com monitores, lavanderia, enfermaria com leitos azuis, casa de máquinas (caldeira e tanques), refeitório com linha de servir, cozinha industrial, biblioteca, sala de recreação (pingue-pongue, TV), escritórios, sala de visitas, recepção com cadeiras de espera, banheiros públicos, estacionamento com viaturas e moto, muro com refletores, cascalho e calçada.

Legenda:
- **novo**: o app não tem.
- **versão**: o app tem o objeto, mas falta esta forma ou este material (a base é o id que já existe).
- **existe**: já dá para pôr no mapa como está.
- **complexo**: forma orgânica, muitas partes, luz ou brilho, água, construção grande. **simples**: móvel ou peça de forma direta.

Os itens marcados com (tema) não aparecem exatamente no mapa, mas combinam com a prisão e foram pedidos pelo dono ("formas novas, tipo a versão de metal de uma cadeira").

## 1. Objetos

### Celas e pavilhão

| Item | Tipo | Base | Complexidade | Onde aparece / o que desenhar |
|---|---|---|---|---|
| Cama de cela (catre de metal preso à parede) | versão | `catre` | simples | Todas as celas. Estrado de chapa de aço, colchão fino, sem cabeceira de madeira |
| Vaso com pia de aço (peça única de cela) | versão | `vasoSanitarioModerno` | simples | Canto de cada cela: privada e pia num bloco só de inox, sem tampa |
| Mesinha de cela (tampo de aço preso à parede com banco) | novo | | simples | Tampo branco ao lado da cama, com papéis e caneca |
| Cela com grade | existe | `celaComGrade` | | Frente das celas |
| Beliche de metal | versão | `beliche` | simples | (tema) Beliche de cela, de tubo de aço cinza, em vez do militar |
| Mesa de pátio com bancos fixos (mesa de piquenique de ripas) | novo | | simples | Pavilhões e pátio: mesa de ripas com dois bancos presos, vista de cima |
| Mesa de aço com bancos redondos fixos | versão | `mesaQuadrada` | simples | (tema) Mesa de pavilhão chumbada no chão, 4 banquinhos redondos presos |
| Escada de metal com degrau vazado (lance solto) | novo | | simples | Pavilhões: os lances trapezoidais de chapa xadrez que sobem para a galeria |

### Vestiário e banheiros

| Item | Tipo | Base | Complexidade | Onde aparece / o que desenhar |
|---|---|---|---|---|
| Chuveiro coletivo de parede (ducha em baia aberta) | novo | | simples | Fileira de 9 baias com ducha e ralo, sem porta |
| Mictório | novo | | simples | Vestiário e banheiros da recepção |
| Pia coletiva (bancada com 6 a 8 cubas) | novo | | simples | Fileira de pias de aço do vestiário |
| Banco de vestiário (duas tábuas sobre pés de ferro) | novo | | simples | Meio do vestiário; parecido com o banco de praça, mas sem encosto |
| Divisória de banheiro (baia de privada) | novo | | simples | Banheiros públicos da recepção |
| Armário de vestiário (fileira de portinhas) | versão | `armarioDeFerro` | simples | Vestiário dos guardas; fileira de 4 portas estreitas com respiro |
| Box de chuveiro | existe | `boxDeChuveiro` | | |
| Vaso sanitário moderno | existe | `vasoSanitarioModerno` | | Banheiros da recepção |
| Gabinete de banheiro | existe | `gabineteDeBanheiro` | | |
| Lixeira de pedal | existe | `lixeiraDePedal` | | |

### Refeitório e cozinha

| Item | Tipo | Base | Complexidade | Onde aparece / o que desenhar |
|---|---|---|---|---|
| Linha de servir (balcão com cubas e vidro) | novo | | complexo | Refeitório: balcão comprido de inox com cubas de comida, trilho de bandeja e vidro de proteção |
| Pilha de bandejas | novo | | simples | Ponta da linha de servir |
| Cadeira de plástico | versão | `cadeira` | simples | Refeitório e visitas: cadeira azul de plástico, sem madeira |
| Mesa comprida de refeitório | existe | `mesa` | | Já há mesa; usar com a cadeira de plástico |
| Fogão industrial de inox (6 bocas, chapa) | versão | `fogao` | simples | Cozinha: corpo de inox, bocas grandes, sem forno de lenha |
| Bancada de inox (mesa de preparo) | novo | | simples | Cozinha: tampo de aço com tábuas e comida |
| Coifa | novo | | simples | (tema) Sobre o fogão industrial |
| Pia industrial de duas cubas | versão | `pia` | simples | Cozinha e casa das máquinas |
| Prateleira de despensa com mantimentos | versão | `prateleiraDeDeposito` | simples | Despensa: latas, sacos e caixas coloridas |
| Câmara frigorífica | existe | `camaraFrigorifica` | | |
| Pilha de caixas | existe | `pilhaDeCaixas` | | Despensa |
| Carrinho de transporte de comida | novo | | simples | (tema) Carrinho de inox com bandejas |

### Lavanderia

| Item | Tipo | Base | Complexidade | Onde aparece / o que desenhar |
|---|---|---|---|---|
| Máquina de lavar industrial | novo | | simples | Fileira de 3 com porta redonda de vidro |
| Secadora industrial | novo | | simples | (tema) Mesmo corpo, porta maior e sem água |
| Mesa de dobrar roupa | novo | | simples | Mesa de madeira com roupa dobrada no meio da lavanderia |
| Carrinho de roupa (cesto de lona com rodas) | novo | | simples | Junto das máquinas |
| Prateleira de uniformes dobrados | versão | `prateleiraDeToalhas` | simples | Parede comprida com pilhas de uniforme laranja |
| Cesto de roupa | existe | `cestoDeRoupa` | | |

### Enfermaria

| Item | Tipo | Base | Complexidade | Onde aparece / o que desenhar |
|---|---|---|---|---|
| Leito hospitalar (colchão azul, grade lateral) | versão | `macaComLencol` | simples | 6 quartos de enfermaria |
| Cadeira de exame / dentista | novo | | complexo | Sala de atendimento: encosto reclinável, braço com luz |
| Suporte de soro | novo | | simples | Ao lado dos leitos |
| Biombo hospitalar de rodinhas | versão | `biombo` | simples | Separando os leitos da sala de atendimento |
| Armário de remédios com porta de vidro | novo | | simples | (tema) Prateleira com frascos atrás do vidro |
| Cadeira de rodas | novo | | complexo | (tema) Rodas grandes, muitas partes |
| Mesa de exame (maca alta com papel) | versão | `mesaDeAutopsia` | simples | Sala com a maca azul: tampo estofado, não de pedra |
| Luminária articulada | existe | `luminariaArticulada` | | |
| Mesa de laboratório | existe | `mesaDeLaboratorio` | | |

### Casa de máquinas

| Item | Tipo | Base | Complexidade | Onde aparece / o que desenhar |
|---|---|---|---|---|
| Caldeira com manômetro | novo | | complexo | Máquina grande com mostrador redondo e canos |
| Tanque de pressão azul (vaso redondo, vista de cima) | novo | | simples | Par de tanques azuis com tampa de inspeção |
| Quadro elétrico | novo | | simples | Painel cinza com disjuntores |
| Tubulação de parede (canos e registros) | novo | | simples | Corredor técnico entre a enfermaria e o pavilhão |
| Aquecedor de água (boiler cilíndrico) | novo | | simples | Os dois cilindros brancos no topo da sala |
| Gerador | existe | `gerador` | | O bloco de grade ao lado da caldeira |

### Segurança, controle e entrada

| Item | Tipo | Base | Complexidade | Onde aparece / o que desenhar |
|---|---|---|---|---|
| Mesa de vigilância com monitores | novo | | complexo | Sala de controle: bancada em L com 4 telas acesas (brilho) |
| Pórtico detector de metal | novo | | simples | (tema) Arco cinza na entrada |
| Cabine de visita (vidro e interfone) | novo | | complexo | (tema) Divisória com vidro, banquinho e telefone dos dois lados |
| Balcão de recepção em L | novo | | simples | Recepção: balcão de madeira com computador e papéis |
| Fileira de cadeiras de espera | novo | | simples | Recepção: cadeiras azuis presas numa barra |
| Bebedouro de garrafão | novo | | simples | Os círculos azuis nos cantos de várias salas |
| Armário de armas trancado (rack com fuzis e escudos) | versão | `suporteDeArmas` | simples | Sala de armas dos guardas: escudo antimotim, cassetete, colete |
| Escudo antimotim e capacete na parede | novo | | simples | Sala de armas (amarelo e preto) |
| Holofote | existe | `holofote` | | |
| Cela com grade | existe | `celaComGrade` | | |

### Escritório, biblioteca e sala de aula

| Item | Tipo | Base | Complexidade | Onde aparece / o que desenhar |
|---|---|---|---|---|
| Mesa de escritório com computador | versão | `escrivaninha` | simples | Escritórios: tampo branco ou de madeira, monitor, teclado, papéis |
| Arquivo de aço (gaveteiro) | novo | | simples | Escritórios |
| Estação de trabalho dupla (baias com divisória) | novo | | simples | Sala dos agentes: 4 mesas encostadas com divisória no meio |
| Carteira escolar | novo | | simples | Sala de aula: mesa pequena com cadeira |
| Quadro branco | versão | `quadroDeAvisos` | simples | Parede da sala de aula e do escritório |
| Estante de livros | existe | `estanteDeLivros` | | Biblioteca, em fileiras compridas |
| Cadeira giratória | existe | `cadeiraGiratoria` | | |
| Sofá | existe | `sofa` | | Sala de recreação e sala dos agentes |
| Poltrona | existe | `poltrona` | | |

### Recreação e pátio

| Item | Tipo | Base | Complexidade | Onde aparece / o que desenhar |
|---|---|---|---|---|
| Mesa de pingue-pongue | novo | | simples | Sala de recreação, duas mesas azuis com rede e raquetes |
| Televisão de parede / rack com TV | novo | | simples | Sala de recreação (a barra branca na parede, com cadeiras viradas para ela) |
| Banco de supino com barra | novo | | simples | Pátio de musculação |
| Barra fixa / paralela | novo | | simples | Pátio: o "T" e as barras duplas |
| Suporte de halteres e anilhas | novo | | simples | Pátio e academia dos guardas (as fileiras de pesos redondos pretos) |
| Saco de pancada | versão | `bonecoDeTreino` | simples | (tema) Saco pendurado no lugar do boneco de palha |
| Tabela de basquete | novo | | simples | (tema) Pátio |
| Arquibancada de metal | versão | `arquibancadaDeTorneio` | simples | Pátio: as 3 fileiras compridas de banco de alumínio |
| Mesa de jogo | existe | `mesaDeJogo` | | Mesa de cartas da recreação |

### Estacionamento e muro

| Item | Tipo | Base | Complexidade | Onde aparece / o que desenhar |
|---|---|---|---|---|
| Viatura de polícia (sedã com giroflex) | novo | | complexo | Estacionamento; forma moderna, não serve o carro antigo; luz azul e vermelha |
| Camburão / utilitário preto | novo | | complexo | Estacionamento: SUV grande com giroflex |
| Moto de polícia | novo | | complexo | Duas motos pretas nas vagas |
| Refletor de muro (luminária de parede com braço) | versão | `holofote` | complexo | Todo o muro e a fachada: luz quente em cone (brilho) |
| Poste de iluminação moderno | novo | | complexo | (tema) Poste alto de rua com luz |
| Balizador / frade de calçada | novo | | simples | Fileira de pinos redondos na calçada da frente |
| Caçamba de lixo | novo | | simples | As caixas escuras encostadas no muro leste |
| Cerca de alambrado (tela com mourão) | versão | `cercaDeFerro` | simples | Pátio e estacionamento: tela de arame, não grade de ferro forjado |
| Arame farpado em rolo | existe | `arameFarpado` | | Topo do muro (tema) |
| Cancela listrada | existe | `cancelaListrada` | | Entrada do estacionamento (tema) |
| Barreira de concreto | existe | `barreiraDeConcreto` | | |
| Bueiro | existe | `bueiro` | | |

## 2. Construções

| Item | Tipo | Base | Complexidade | O que é |
|---|---|---|---|---|
| Torre de vigia | existe | `torreDeVigia` | | As duas torres pequenas no topo (escada, guarita) servem a torre que já existe |
| Guarita | existe | `guarita` | | Portaria do estacionamento |
| Torre de vigia de concreto com holofote | versão | `torreDeVigia` | complexo | (tema) Torre de presídio de concreto, cabine de vidro e holofote no teto (luz), em vez da de madeira |
| Portão deslizante de presídio (eclusa) | novo | | complexo | (tema) Portão de grade de aço de duas folhas sobre trilho, com motor; barra a passagem |
| Quadra de basquete / poliesportiva | versão | `campinho` | complexo | (tema) Quadra de concreto pintada com as linhas e as duas tabelas |
| Torre de iluminação (mastro alto com 4 refletores) | novo | | complexo | (tema) Ilumina o pátio inteiro |
| Caixa d'água elevada | existe | `caixaDAguaElevada` | | (tema) |
| Contêiner | existe | `conteiner` | | (tema) |

Fora do alcance hoje: o mapa tem salas prontas (bloco de celas, vestiário inteiro, refeitório). O app NÃO tem estrutura pré-montada de várias peças (prefab, sala pronta, kit). Se o dono quiser "Ala de celas pronta", isso é um sistema novo, não um objeto, e precisa ser decidido antes.

## 3. Texturas

### Chão

| Item | Tipo | Base | Complexidade | Onde aparece |
|---|---|---|---|---|
| Concreto | existe | `concreto` | | Pátio e celas |
| Piso epóxi polido (concreto liso claro com brilho) | versão | `concreto` | simples | Pavilhões e corredores: chão claro, liso, com reflexo de luz |
| Azulejo branco | existe | `azulejo-branco` | | Vestiário e cozinha |
| Lajota de cerâmica cinza-azulada (grade fina) | versão | `azulejo-branco` | simples | Enfermaria e banheiros: quadrado pequeno com rejunte escuro |
| Carpete de escritório (placas azuis com textura) | novo | | simples | Escritórios, biblioteca, sala dos agentes |
| Piso de madeira de sala de visitas | existe | `tabua-envernizada` | | Visitas e recepção |
| Piso de borracha | existe | `piso-de-borracha` | | Academia dos guardas |
| Linóleo verde | existe | `linoleo-verde` | | (tema) Enfermaria antiga |
| Asfalto com faixa | existe | `asfalto-faixa` | | Estacionamento |
| Asfalto com faixa zebrada amarela (área proibida) | versão | `asfalto-faixa` | simples | Os cantos riscados do estacionamento |
| Cascalho | existe | `cascalho` | | Faixa entre o muro e o prédio |
| Calçamento | existe | `calcamento` | | Calçada da frente |
| Chapa de aço xadrez (piso antiderrapante) | existe | `chao-de-metal-xadrez` | | Os degraus e o patamar das escadas dos pavilhões |

### Parede

| Item | Tipo | Base | Complexidade | Onde aparece |
|---|---|---|---|---|
| Concreto | existe | `concreto` | | Muro externo e corpo do prédio |
| Bloco de concreto pintado (parede de cela) | novo | | simples | Celas e corredores: blocos aparentes pintados de branco gelo |
| Tijolo | existe | `tijolo` | | Recepção e sala de visitas (parede vermelha) |
| Azulejo de hospital | existe | `azulejo-de-hospital` | | Enfermaria |
| Grade de ferro (parede de barras) | novo | | complexo | Frente das celas e galeria; deixa ver através, mexe com a visão (fora do padrão de parede cheia: decidir antes) |
| Alambrado (parede de tela) | novo | | complexo | Divisão do pátio e do estacionamento; mesmo problema de transparência da grade |

Lembrete da receita: material de parede novo entra sempre no FIM de MATERIAIS_DA_PAREDE.

## 4. Carimbos

O mapa é quase todo urbano; quase nada de natureza. O que cabe:

| Item | Tipo | Base | Complexidade | Onde aparece |
|---|---|---|---|---|
| Poça | existe | `poca` | | (tema) Pátio molhado |
| Rachadura no concreto | novo | | simples | Pátio e cascalho; o app não tem rachadura genérica |
| Mancha de óleo | novo | | simples | Vagas do estacionamento |
| Lixo espalhado (papéis, copo, lata) | novo | | simples | Pátio e encosto das caçambas |
| Mato na fresta (tufo de erva daninha) | novo | | simples | (tema) Bordas do cascalho e do muro |
| Mancha de umidade / sujeira de chão | novo | | simples | (tema) Celas e corredores velhos |
| Grafite pequeno de chão (tag) | novo | | simples | (tema) Pátio |
| Musgo | existe | `musgo` | | (tema) Pé do muro |
| Folhas secas | existe | `folhasSecas` | | (tema) Estacionamento |

## Resumo da contagem

- Objetos: 68 novos ou versões (48 novos, 20 versões) e 23 que já existem.
- Construções: 4 novos ou versões (2 novos, 2 versões) e 4 que já existem.
- Texturas: 7 novas ou versões (chão: 1 nova e 3 versões; parede: 3 novas) e 12 que já existem.
- Carimbos: 6 novos e 3 que já existem.

Mais fortes para a prisão, na ordem: cama de cela, vaso com pia de aço, mesa de pátio de ripas, linha de servir, máquina de lavar, leito hospitalar, mesa de vigilância, viatura, refletor de muro, banco de supino e halteres, carpete de escritório, bloco de concreto pintado.
