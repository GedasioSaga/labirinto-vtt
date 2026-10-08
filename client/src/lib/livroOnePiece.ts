import type { CapituloDoLivro, CatalogosDoSistema } from './sistemaDeRpg'

/**
 * LIVRO DE REGRAS DO ONE PIECE — dado puro, gerado por script (fora do
 * repositório) a partir de uma cópia do banco do projeto-rpg-v2, em 08/10/2026:
 *  - capítulos: as 14 notas de regra que o projeto-rpg-v2 manda à IA como
 *    "REGRAS DO SISTEMA" (`regras_notas`, migration 0013:284), na mesma ordem.
 *    Ficam de fora `#ficha` (uma ficha de exemplo) e `#dicas-do-mestre` (cita
 *    outro RPG), como lá. Texto como veio do Discord, só sem as linhas de
 *    preenchimento invisível;
 *  - catálogos: `catalogo_pericia` (47), `catalogo_vantagem` (30) e
 *    `catalogo_desvantagem` (47) — os 35 normalizados + 12 novos da migration
 *    0013 nas perícias, +17 vantagens e +29 desvantagens sobre o import do v1;
 *  - raças e ofícios: os nomes da ficha; a descrição da raça é o primeiro
 *    parágrafo da nota dela, a do ofício a seção dele em `#oficios` (Curandeiro
 *    não tem seção lá).
 * Não editar à mão: a entrega 6 (editor de sistema) é quem muda o livro.
 */
export const LIVRO_ONE_PIECE: CapituloDoLivro[] = [
  {
    id: "mecanicas",
    titulo: "Mecânicas",
    ordem: 1,
    texto: "# Pontos de Proficiência\nPontos de Proficiência são como pontos de evolução/personalização, ao passar das sessões você vai ganhando esse pontos para personalizar o seu personagem ao evoluir um aspecto dele, normalmente você precisa de dois pontos de proficiência para evoluir algum aspecto contudo caso venha evoluir o mesmo aspecto múltiplas vezes a quantidade para evoluir pode aumentar mas também o poder e a eficiência tambem aumentarão para que se torne justo.\n\n# Pontos Saga\nEsse pontos servem como uma vantagem que pode ser usada quando estiver em apuros ou quando quiser repetir um teste em especifico. Esse pontos são adquiridos quando mestre oferece a você uma chance de falhar em algum teste ou fazer algo em específico que tenha haver com alguma desvantagem que você decidiu colocar em seu personagem.\n\nOBS: Você pode ter no maximo 2 pontos saga\n\n# Modificadores\nRegras dos Modificadores:\n- A cada 2 ranks completos, o personagem ganha +1 no modificador.\n- Ranks ímpares não alteram o modificador até que o próximo rank par seja alcançado.\n\nResumo:\nRank 1: Sem modificador.\nRank 2: +1 no modificador.\nRank 3: +1 no modificador.\nRank 4: +2 no modificador.\nRank 5: +2 no modificador.\nRank 6: +3 no modificador.\nRank 7: +3 no modificador.\nRank 8: +4 no modificador.\nRank 9: +4 no modificador.\nRank 10: +5 no modificador.\n\n# Tecnicas Overload\nCertas técnicas vão requerer muito da capacidade do seu personagem em troca disso causarão um quantidade gigantesca de dano, essas técnicas são chamadas de Orverload pois só podem ser usadas uma vez no dia, é possível ter várias técnicas Overload contudo ao usar uma você fica incapaz de usar as outras.\n\n# Habilidades\nVocê pode criar habilidades com diferentes efeitos. Ao criar seu personagem, você começará com três habilidades (isso pode ser modificado).\n\n# Perícias\nVocê pode escolher 2 perícias de sua preferência, independentemente do seu ofício. Se sua raça permitir mais, sinta-se à vontade para escolher. Ao escolher seu ofício, você pode selecionar 2 perícias adicionais relacionadas a ele, totalizando 4 perícias iniciais.\n\n# Vantagens e Desvantagens\nVocê pode começar com 5 vantagens e quantas desvantagens desejar."
  },
  {
    id: "status",
    titulo: "Status",
    ordem: 2,
    texto: "## **Atributos Físicos**\n\n**Força:** *Determina a capacidade física do personagem em combate corpo a corpo.*\nRank 1 (1♪)\nRank 2 (40 ♪)\nRank 3 (90 ♪)\nRank 4 (150 ♪)\nRank 5 (320 ♪)\nRank 6 (510 ♪)\nRank 7 (765 ♪)\nRank 8 (1725 ♪)\nRank 9 (2200 ♪)\nRank 10 (2700 ♪)*\nExemplo: Você quer quebrar um porta na porrada, levantar uma arma pesada, você quer usar a força das pernas para dar um grande salto.\n\n**Agilidade:** *Reflete a velocidade e destreza do personagem, seja em combate ou para realizar ações rápidas.*\nRank 1 (1♪) 1Q\nRank 2 (33 ♪) 2Q\nRank 3 (60 ♪) 3Q\nRank 4 (90♪) 4Q\nRank 5 (140 ♪) 5Q\nRank 6 (210 ♪) 6Q\nRank 7 (315 ♪) 7Q\nRank 8 (400 ♪) 8Q\nRank 9 (600 ♪) 9Q\nRank 10 (950 ♪) 10Q*\nExemplo: Você quer correr até um local, dar blitz em alguém, você quer reagir de uma certa maneira.\n\n**Percepção:** *Reflete a capacidade de observação e reagir a detalhes cruciais, por meio dos 5 principais sentidos. Incluindo precisão e leitura dos movimentos inimigos.*\nRank 1 (1♪)\nRank 2 (30 ♪)\nRank 3 (80 ♪)\nRank 4 (130 ♪)\nRank 5 (220 ♪)\nRank 6 (330 ♪)\nRank 7 (500 ♪)\nRank 8 (750 ♪)\nRank 9 (1125 ♪)\nRank 10 (1500 ♪)\nExemplo: Você quer jogar algo em um lugar, Você olha em volta, você está procurando algo em específico, você quer analisar uma pessoa.\n\n**Resistência:** *A resistência física para suportar danos ou resistir a condições adversas, é o quanto você também se mantem fazendo algo. O total de vida e escudo é:* 50.150 de Vida 16500 de Escudo\n*Rank 0 (0♪)*: 300 HP\n*Rank 1 (1♪)*: +300 HP\n*Rank 2 (40♪)*: +300 HP\n*Rank 3 (140♪)*: +300 HP\n*Rank 4 (240♪)*: +600 HP\n*Rank 5 (480♪)*: +895 HP\n*Rank 6 (720♪)*: +1.495 HP\n*Rank 7 (1620♪)*: +4.480 HP\n*Rank 8 (2430♪)*: +7.465 HP\n*Rank 9 (5500♪)*: +11.940 HP\n*Rank 10 (8250♪)*: +22.375 HP\nExemplo: Você recebe um ataque dependendo da sua resistência nem arranhar seu corpo vai, você quer treinar sua resistência vai influenciar seu horários.\n\n## **Atributos Mentais e Espirituais**\n\n**Intuição:** *Percepção instintiva, capacidade de antecipar movimentos ou detectar perigos, e inteligência, aqui a inteligência e intuição servem como um só. Além disso a Intuição vai ser algo que o mestre vai falar para você mas você pode pedir para usar intuição quando quiser.*\nRank 1 (1♪)\nRank 2 (30 ♪)\nRank 3 (80 ♪)\nRank 4 (150 ♪)\nRank 5 (240 ♪)\nRank 6 (275 ♪)\nRank 7 (360 ♪)\nRank 8 (540 ♪)\nRank 9 (810 ♪)\nRank 10 (1215♪ +)\nExemplo: Você quer seguir sua intuição de qual o caminho é certo, usando a sua intuição do que você conhece(Uso no caso mais voltado para inteligência) para fazer uma ação mais efetiva ou até achar um ponto fraco se usado junto com percepção.\n\n**Espírito:**  *Reflete a confiança e a presença de uma pessoa, ou seja a aura que você exala, mas não só isso mesmo sem um atributo mental/espiritual ele influência em certas técnicas que vão além da força, percepção e afins como akuma no mi ou armas especiais. Além disso o Espírito está ligado ao SP que você recebe quando mais Espírito mais SP*\nRank 0 (0♪) +20 SP\nRank 1 (1♪) + 40 SP\nRank 2 (35♪) + 60 SP\nRank 3 (75 ♪) + 80 SP\nRank 4 (115 ♪) + 100 SP\nRank 5 (140 ♪) + 110 SP\nRank 6 (210 ♪) + 120 SP\nRank 7 (315 ♪) + 130 SP\nRank 8 (472 ♪) + 140 SP\nRank 9 (700 ♪) + 150 SP\nRank 10 (1060♪) + 160 SP\nRank 11 (1590♪) + 170 SP\nRank 12 (2385♪) + 180 SP\nRank 13 (2500♪) + 190 SP\nExemplo: Você usar um golpe de uma akuma no mi certo espirito é necessário, você usar SP para aumentar sua habilidade\n\n**Carisma:** *Reflete a influência social e o quão boa é sua persuasão, influenciar as pessoas, fingi e afins,.*\nRank 1 (1♪)\nRank 2 (20 ♪)\nRank 3 (55 ♪)\nRank 4 (100 ♪)\nRank 5 (150 ♪)\nRank 6 (200 ♪)\nRank 7 (240 ♪)\nRank 8 (315 ♪)\nRank 9 (472 ♪)\nRank 10 (700 ♪)*\nExemplo: Você quer levantar a moral do grupo, quer convenser alguém, quer fingir ser alguem, que mandar a mentira da sua vida e o cara acreditar na cara dura.\n\n**Determinação:** *Força de vontade do personagem para continuar lutando, mesmo em situações extremas, reduzir o dano levado, aguentar golpes mentais.*\nRank 1 (1♪)\nRank 2 (16 ♪)\nRank 3 (40 ♪)\nRank 4 (80 ♪)\nRank 5 (130 ♪)\nRank 6 (175 ♪)\nRank 7 (195 ♪)\nRank 8 (295 ♪)\nRank 9 (440 ♪)\nRank 10 (660 ♪+)\nRank 11 (1590♪)\nRank 12 (2385♪)\nRank 13 (2500♪+)\n\nA determinação do personagem não é apenas uma característica narrativa, mas uma força dinâmica que impacta diretamente as interações fora de combate. A partir do rank 4 em determinação ao perder 50 % da vida você recebe um redução permanente baseada na sua determinação, que dura até recuperar a vida.\nRank 4: 10%\nRank 5: 15%\nRank 6: 20%\nRank 7: 25%\nRank 8: 30%\nRank 9: 40%\nRank 10: 50%\n***Atenção:*** A partir do rank 11, você ganhar vantagens contra haki do rei e se chegar em 13 você não toma Haki do Rei por nada."
  },
  {
    id: "acoes-de-combate",
    titulo: "Ações de combate",
    ordem: 3,
    texto: "## AÇÃO COMPLETA\nEste tipo de ação exige todo o seu tempo e esforço durante uma rodada. Uma ação completa, é a junção de ação simples, ação de movimento. Você ainda pode realizar ações livres, ações bônus e reações.\n\nExemplo: Ataques combinados, Transformações(pode variar), Golpes Extremos(Um golpe definitivo), um turno que você tira para só atacar mas esse ataque vai além.\n\n##  AÇÃO SIMPLES:\nUma ação simples representa a atividade principal que um personagem pode realizar em seu turno, normalmente envolvendo ataques, uso de habilidades ou técnicas. Essa ação requer parte do foco do personagem, mas permite que ele ainda se mova, reaja ou faça outras ações menores durante o turno.\n\nExemplos: Você desfere dano ao seu inimigo, você agarra um inimigo, afins.\n\n##  REAÇÃO\nNa ação de reação, você pode esquivar, contra-atacar ou utilizar uma habilidade do Estilo de Combate ou Akuma no mi. Normalmente você terá uma reação no turno, contudo isso pode ser modificado não só com habilidades mas em situação que você se encontra enfrentando vários inimigos e está sozinho.\n\n**Como Funcionará a Reação:**\nVocê caso não esteja usando uma habilidade para burlar esse sistema jogará um dado 1d20 que decidirá o que você pode fazer.\n\n**Defender: ** Defender quer dizer que você vai tomar metade do dano. Joga um 1d20 sem modificador, se o resultado for 10 ou mais, a defesa é bem-sucedida.\n**Esquiva: **Esquivar quer dizer que você não vai tomar dano nenhum. Joga um 1d20 sem modificador, se o resultado for 15 ou mais, a esquiva é bem-sucedida.\n**Contra-ataque:** Contra-Atacar quer dizer que você não vai tomar dado nenhum e ainda vai dar dano nele, Joga um 1d20 sem modificador, se o resultado for 20 ou mais, o contra-ataque é bem-sucedida.\n\nExemplo: Um cara da marinha vai te atacar e tu quer reagir, então tu jogar um dado se for 10 tu consegue defender, se for 15 tu consegue esquivar ou defender e se for 20 perfeito você consegue defender, esquivar ou contra-atacar.\n‎‎\n\n## AÇÃO DE MOVIMENTO\nNo seu turno, você pode se mover a uma distância igual ao seu deslocamento máximo. Pode usar o máximo ou o mínimo do seu deslocamento durante seu turno, seguindo as regras a seguir. Você pode saltar, escalar e nadar, vai funcionar da mesma forma. Esses diferentes modos de movimento podem ser combinados com caminhada ou podem constituir todo o seu movimento.\n\nVocê pode também vir a quebrar seu movimento em seu turno, usando parte do seu deslocamento antes e depois de sua ação.\nExemplo: se você tem deslocamento de 9 blocos, você pode andar 3 blocos, realizar sua ação e então se mover mais 6 blocos e até mesmo se tiver uma ação extra poderá atacar de novo;\n\nEm caso de terrenos dificeis(Cavernas, Arbustos, Escadarias ou o que o mestre definir como terreno dificil), o movimento pode ser reduzido variadamente, cada caso é um caso, você pode necessitar de mais blocos para se mover e até mesmo outras ações.\n‎‎‎‎‎‎‎‎\n\n## CONCENTRAÇÃO\nEm certas citações de combate você pode decidir se concentrar para aumentar a eficácia da sua ação sem precisar gastar SP, a concentração é ativa quando você abre mão de sua ação simples ou qualquer ação extra. Se você perder a concentração, a técnica se encerra.\n\nAtenção 1: 3 concentrações é número máximo que você pode fazer para buffar.\nAtenção 2: Caso você venha a chegar a carga máxima de concentração não poderá usar o Aprimoramento de Ação.\nAtenção 3: Ao chegar a carga máxima de concentração, a ação que você fizer será considerada ação completa uma vez que você está fazendo algo com o máximo de capacidade.\n\nCada \"Concentração\" dependendo do que está se concentrando você tem efeito diferente.\n\nExemplo 1 : Você se concentra para jogar algo em um lugar, a sua primeira concentração vai te dar vantagem no dados, a segunda vai te dar duas vantagens no dado e a terceira é acerto garantido.\n\nExemplo 2: Você se concentra para atacar ou usar uma técnica, o primeiro tudo adicionara 0.5x de dano na sua próxima ação ficando 1,5x, o segundo turno adicionará mais 0.5x de dano a sua próxima ação ficando 2,0x e o terceiro turno vai adicionar 1,5x de dano a sua próxima ação ficando 3,5x.\n‎‎‎‎‎‎‎‎\n\n## APRIMORAMENTO DE AÇÃO\nVocê pode gastar uma parte do seu SP(pontos de energia especial), para elevar o poder de uma habilidade, técnica, ação, etc.  No geral personaliza suas capacidades de combate ou suporte para se adaptar melhor a cada situação. Você pode usar isso em todas as ações e até reação, contudo se você gastar muito SP dependendo da situação vai virar Ação Completa.\n\nExemplo de Uso:\nFogo - 0SP\nBola de fogo - 10SP\nBola de fogo maior - 20SP\nBola de fogo em Kamehameha - 30SP\nBola de fogo em área esférica - 40SP\n\"Sol\" - 50SP\n\nPara a recuperação do SP, é necessário não utilizar habilidades no geral como técnicas ou qualquer coisa que use SP.\n\n# Ação Bônus e Livre\nAção bônus, não passa de uma ação extra em seu turno, ela serve como uma ação simples. Já ação livres são ações que não representam nada demais, como falar, pegar um item no chão e observar.\n\n# Condições para um \"Acerto Crítico\" (1.5x de dano)\nNormalmente Golpes furtivos ou falhas críticas.\n\n# Rodada e Turno\nA **rodada** é o ciclo completo em que todos os participantes da cena (jogadores e inimigos) têm a oportunidade de agir. Uma rodada começa no momento em que o primeiro jogador ou criatura toma sua ação e termina quando todos os participantes já tiveram a chance de agir uma vez. Assim, ela representa um \"período de tempo\" dentro do jogo, que pode variar.\n\nExemplo em Jogo: Em uma batalha, temos três jogadores (A, B e C) e dois inimigos (X e Y). Na rodada:\nA age.\nX age.\nB age.\nY age.\nC age. Ao fim da ação de C, a rodada termina, e uma nova rodada começa.\n\nO **turno** é o momento dentro de uma rodada em que um único personagem ou criatura realiza suas ações. Durante o turno, o participante pode tomar decisões e realizar ações, como atacar, se movimentar, usar habilidades ou interagir com o ambiente. A ordem dos turnos é baseada na velocidade onde o mais veloz começa mas pode ser alterada se o jogador/npc tiver alguma habilidade que quebre essa regra.\n\nExemplo em Jogo: No turno de A, ele decide:\nUsar a ação principal para atacar um inimigo.\nSe mover para trás de uma cobertura.\nNão usa sua ação bônus ou reação.\nDepois que A termina, o próximo na ordem de velocidade toma seu turno."
  },
  {
    id: "oficios",
    titulo: "Ofícios",
    ordem: 4,
    texto: "⊹───────────────⊱{Ofícios}⊰───────────────⊹\n\nInicialmente você poderá escolher um ofício para ser inserido na ficha de seu personagem. Cada ofício tem uma característica e bonificação própria e poderá ajudá-lo de formas diferentes no futuro. Ao escolher um ofício, você pode está pegando 2 pericias relacionadas.\n\n## Arqueólogo\nEstuda as sociedades, podendo ser tanto as que ainda existem, quanto as já extintas, através de seus restos materiais. Possui facilidade para aprender línguas novas, conhece e entende sobre praticamente todos os assuntos relacionados a historia e a línguas mortas ou esquecidas, juntamente com o fato de poder identificar idade e talvez o próprio nome de um artefato antigo, além de seu preço.\n\n**Perícias Relacionadas:**\nHistória Perdida\nCriptografia\nGeografia\nCiências Proibidas\n\n## Artista\nÉ um personagem dotado de habilidades, artísticas e teatrais, sua função à primeira vista é divertir as pessoas. O artista consiste de várias facetas, ele pode ser tanto um palhaço como um malabarista ou um ator. Faz gracejos, momices, pilhérias e trejeitos, combinados com malabarismos, para divertir o público ou como um dramaturgo para faze-lo chorar. Também pode cantar, dançar, pintar, fotografar ou até mesmo expressar sua arte em belas roupas.\n\n**Perícias Relacionadas:**\nAcrobacia\nAtuação\nCostura\nDança\nIlusionismo\nInstrumentos Musicais\nPintura\nDisfarce\n\n# Carpinteiro\nO carpinteiro executa os mais diversos trabalhos em madeira, desde móveis, ferramentas, artigos para construção civil, construção naval, entre outros. É o único com habilidade e conhecimento suficiente para concertar, construir e criar as mais variadas engenhocas envolvendo madeira, prego e etc... Deve ter noções de geometria e um vasto conhecimento de como lidar com madeira no seu estado natural (madeira maciça), o que o diferencia da marcenaria.\n\n**Perícias Relacionadas:**\nArrombamento\nCarpintaria\nMarcenaria\nEngenharia(Voltado para madeira)\n\n## Cientista\nSão as pessoas focadas em adquirir e transmitir conhecimento. Através dos diversos âmbitos da ciência, estes personagens se esforçam para tornar a vida mais confortável, as armas mais potentes, os navios mais modernos e qualquer campo em que a ciência possa ser aplicada para agregar uma funcionalidade adicional. Por esta razão, cientistas são extremamente versáteis e se adaptam muito bem aos outros domínios, uma vez que sua necessidade pelo saber é insaciável e precisam estar sempre adquirindo mais conhecimento, ou seja, é possível que um ferreiro e um cientista trabalhem em conjunto para confeccionar um ciborgue, ou colaborar com um médico para criar remédios ou substâncias diferenciadas, sem que os dois necessariamente tenham entendimento pleno das áreas alheias ou ofícios especiais.\n\n**Perícias Relacionadas:**\nBotânica\nCiências Proibidas\nFísica\nQuímica\nZoologia\n\n## Cozinheiro\nÉ o responsável por elaborar os pratos e cuidar da cozinha do navio, sendo o único capaz de elaborar refeições, completas e saborosas em pouquíssimo tempo e com quase qualquer ingrediente a sua mão. Afinal, uma dieta equilibrada e saborosa é tão necessária dentro de um navio quanto as velas do mastro, pois é ela que manterá os tripulantes do navio fortes e saudáveis.\n\n**Perícias Relacionadas:**\nCulinária\nNutrição\nPesca\nBotânica\nToxicologia\n\n## Ferreiro\nO ferreiro é uma pessoa que cria objetos de ferro ou aço por “forjar” o metal, para criar armas como espadas, bastões, rifles, balas e etc. Ferreiro é uma profissão muito interessante, pois você pode criar armas excepcionais usando metais, pedras raras e até mesmo couro, invadindo um pouco do espaço do artesão, para poder criar objetos mortíferos de diversas formas diferentes. Além de balas estranhas, por exemplo, balas de veneno. O resultado é claro dependerá de sua experiência e da matéria-prima que ele tiver em mãos.\n\n**Perícias Relacionadas:**\nCostura\nEngenharia\nCriação de Projéteis\nForja\nMecânica\n\n## Gatuno\nPersonagens desse ofício vivem no melhor estilo que o seu dinheiro (ou o dos outros) pode comprar, e fazendo o menor esforço possível. É um ladrão e larápio que tenta conseguir dinheiro passando a perna nos outros. Ele tem que ser muito rápido e certeiro (agilidade e destreza) para invadir lugares ou roubar as pessoas sem ser detectado, ou ter um alto carisma para “pescar” suas vítimas. Geralmente possuem conexões e maiores conhecimentos do submundo do crime, encontrando locais que vendam coisas “interessantes” mais facilmente que seus colegas.\n\n**Perícias Relacionadas:**\nArrombamento\nDisfarce\nFalsificação\nFurtividade\n\n## Médico\nEle se ocupa da saúde humana e/ou animal, prevenindo, diagnosticando e curando as doenças, o que requer conhecimento detalhado de disciplinas acadêmicas (como anatomia e fisiologia) por detrás das doenças e do tratamento. A diferença entre os dois é mais funcional, pois o medico utiliza poções e conhecimentos sobre medicina, para salvar os seus pacientes, eles tendem a abandonar o lado espiritual do mundo se pregando somente a esses conhecimentos. Enquanto o curandeiro usa ervas e rituais religiosos (quase mágicos) para auxilia-lo. Os médicos se dão bem na maioria das culturas exceto as menos desenvolvidas e religiosas, já os curandeiros são o o oposto disso. Então se por acaso escolher essa profissão, deve optar na ficha pelo termo Medico ou Curandeiro, não poderá escolher os dois.\n\n**Perícias Relacionadas:**\nBotânica\nCirurgia\nNutrição\nPrimeiros Socorros\nToxicologia\nVeterinária\nMedicina\n\n## Navegador\nÉ aquele que domina a ciência, arte, ou prática de planejar e executar uma viagem de um ponto de partida até seu ponto de destino. Consegue prever com grandiosa precisão sobre os aspectos climáticos do momento, e como se localizar com precisão no mar usando somente a bússola e um mapa. A figura do navegador é indispensável para qualquer tripulação.\n\n**Perícias Relacionadas:**\nGeografia\nMeteorologia\nNavegação\nPilotagem"
  },
  {
    id: "pericias",
    titulo: "Perícias",
    ordem: 5,
    texto: "# **Perícias**\nSão como atributos que vão ajudar os jogadores em rolagens, dando vantagens e diminuição de cd em certas ocasiões, além de poderem ajudar em vários aspectos. Todo personagem pode escolher 2 perícias a sua vontade, pode ser adicionais do seu oficio ou separada. Ao evoluir a sua intuição, você pode está pegando mais perícias, no caso a dois ranks, você tem direito de pegar uma pericia a mais,\n\nExemplo: Quando você alcançar o rank2 em intuição poderá escolher 1 perícias a mais, e você vai poder repeter o processo quando alcançar rank4.\n\n**Caça: **Sempre que você quiser colher informações, seja através de relatos de pessoas comuns, outros caçadores de recompensas, procurando arquivos e documentos ou identificando padrões e hábitos de suas caças. **(Percepção)**\n\n**Conhecimentos Gerais:** Quando você quiser realizar ações relacionadas a assuntos diversos como navegação e medicina. **(Intuição)**\n\n**Carpintaria:** Carpinteiros são hábeis não apenas em construir, mas também em reparar estruturas e objetos feitos em sua maior parte de madeira. Realizar trabalhos manuais com madeira em uma velocidade incrível é possível somente aos carpinteiros. Caso você queira criar um objeto específico como uma escada, ou fazer a cópia de objetos como chaves, criar ou fortificar portas e estruturas. **(Intuição)**\n\n**Noção de Batalha:** Ao tentar se manter frio e observar tudo o que está acontecendo no campo de batalha, tentar adivinhar onde estão posicionados grupamentos inimigos, entender as estratégias dos seus adversários. **(Percepção)**\n\n**Analisar Criatura:** Com uma capacidade de observação acima do normal, o combatente pode analisar inimigos e aliados para saber se eles representam alguma ameaça, se estão sendo controlados ou agindo estranhamente. **(Percepção)**\n\n**Medicina:** Sempre que você quiser diagnosticar uma doença, tratá-la, aliviar os efeitos de feridas brutais, procurar conhecimentos em livros e outras atividades relacionadas à saúde.**(Intuição)**\n\n**Arrombamento:** Ato de diligencia que consiste no ingresso em imóveis e abertura de móveis, fechados, mediante ordem judicial, a fim de encontrar coisas ou pessoas para apreensão. **(Força e/ou Percepção)**\n\n**Culinária:** É uma arte que combina habilidades técnicas, criatividade e conhecimento para criar pratos incríveis e satisfatórios. .**(Intuição)**\n\n**Criação de Projéteis:** Possui facilidade na criação de projeteis de tipo variados de materiais. **(Percepção/Intuição)**\n\n**Meteorologia:** você sabe prever o clima nos dias ou momentos seguintes. **(Intuição)**\n\n**Natação: **você sabe nadar em todos os estilos possíveis, além de conseguir mergulhar com os equipamentos adequados e fazer apneia para prolongar o fôlego. **(Agilidade)**\n\n**Nutrição:** você reconhece todos os segredos para promover, recuperar e manter a saúde por meio da alimentação, tendo conhecimento sobre os nutrientes de cada alimento e sabendo identificar a qualidade dos mesmos. Não significa que você saiba cozinhar. **(Intuição)**\n\n**Pintura:** você sabe desenhar e pintar, criando bandeiras ou belos quadros que podem lhe render dinheiro. **(Intuição)**\n\n**Prestidigitação: ** Você pode fazer truques com pequenos objetos, fazendo sumir moedas, lenços e cartas de baralho como se fosse mágica. **(Espírito)**\n\n**Flexibilidade: ** você é muito ágil e esguio, podendo fazer proezas nas quais pessoas acreditam que você não conseguiria fazer.** (Agilidade)**\n\n**Primeiros Socorros: **você sabe fazer curativos, reduzir fraturas, deter sangramentos e outras coisas que se deve fazer ou não fazer em caso de acidentes com vítimas.  **(Intuição)**\n\n**Sedução:** você sabe fingir sentimentos românticos com relação à vítima além de conseguir ser sensual e atrativo. É como lábia e intimidação, mas utiliza a sensualidade.** (Espírito)**\n\n**Toxicologia:** você tem conhecimento em venenos e conhece seus efeitos, sabendo como prepará-los e como neutralizá-los.  **(Intuição)**\n\n**Veterinária:** você pode fazer diagnósticos, prestar primeiros socorros e fazer cirurgias em animais. Funciona como Medicina, mas apenas para animais. **(Intuição)**\n\n**Zoologia:** você consegue analisar os animais no que se refere à sua biologia, genética, fisiologia, anatomia, ecologia, geografia e evolução.  **(Intuição)**\n\n**Acrobacia: **Você consegue andar na corda bamba, cair sem se machucar e fazer outras proezas acrobáticas. **(Agilidade)**\n\n**História Perdida: **Sempre que você lidar ou quiser decifrar escrituras antigas, línguas desconhecidas ou Poneglyphs. **(Intuição)**\n\n**Disfarce:**São peças de vestuário ou qualquer método ou técnica que muda a aparência de algo ou alguém de modo a esconder a sua verdadeira identidade. A camuflagem é um tipo de disfarce usado em pessoas, animais e/ou objetos. **(Carisma)**\n\n**Furtividade:** Você pode desaparecer nas sombras, andar sem fazer barulho, sumir na multidão, seguir alguém sem ser notado. **(Agilidade/Espírito)**\n\n**Cirurgia: **Você se torna apto a fazer tratamentos mais complexos, capazes de tratar tanto feridas profundas como doenças muito graves.**(Intuição)**\n\n**Primeiros Socorros: **Você pode tratar de ferimentos, doenças e venenos.**(Intuição)**\n\n**Navegação:** Sempre que o navegador quiser realizar ações como achar uma direção ou caminho, criar mapas, entender mudanças climáticas repentinas, fazer previsões do tempo, escolher correntes marinhas ou velejar por tempestades. Além disso você sabe dizer onde está e em que direção deve seguir, além de conseguir ler mapas com precisão.**(Intuição)**\n\n**Atletismo: **É utilizada para realizar façanhas atléticas, como correr rápido, escalar montanhas, nada em águas revoltas e pular. **(Agilidade)**\n\n**Lógica: **Em suma, a lógica serve para se pensar corretamente. .**(Intuição)**\n\n**Pesca:** você sabe pegar peixes e outros animais aquáticos com linha e anzol, rede ou arpão. **(Percepção)**\n\n**Pilotagem:** Você sabe os fundamentos para pilotar os veículos e por isso pode aprender rapidamente como manobrar qualquer um com um pouco de prática. **(intuição)**\n\n**Marcenaria: **você tem a habilidade de de transformar madeira em um objeto útil ou decorativo. Você possui o dom da criatividade e saber desenhar em perspectiva, além de ter um vasto conhecimento do uso das ferramentas e materiais dessa área. A marcenaria está mais ligada ao trabalho artesanal. **(Intuição)**\n\n**Anatomia:** Permite ao personagem entender a estrutura e funcionamento do corpo humano e de outras criaturas. Pode ser usada para identificar ferimentos ou doenças, e realizar procedimentos médicos complexos.** (Intuição)**\n\n**Botânica: **Habilidade de identificar, cultivar e utilizar plantas para diversos fins, como medicina, venenos ou alimentação. Inclui o conhecimento de ecossistemas e a capacidade de encontrar plantas raras. **(Intuição)**\n\n**Falsificação:** Habilidade de criar cópias convincentes de documentos, assinaturas, e outros itens importantes. Inclui a capacidade de detectar falsificações feitas por outros. **(Percepção/Intuição)**\n\n**Engenharia: **Conhecimento técnico para projetar, construir e reparar máquinas, estruturas e dispositivos complexos. Inclui a capacidade de entender e criar planos detalhados. **(Intuição)**\n\n**Geografia:** Conhecimento sobre a disposição física do mundo, incluindo mapas, terrenos, climas e ecossistemas. Útil para navegação e planejamento de viagens. **Intuição**\n\n**Ciências Proibidas:** Estudo de conhecimentos ocultos e perigosos, como magia negra, alquimia avançada e outras práticas proibidas. Inclui a capacidade de identificar e utilizar esses conhecimentos de forma segura. **Intuição**\n\n**Física: **Compreensão das leis naturais que governam o movimento, energia e forças. Útil para criar dispositivos, entender fenômenos naturais e resolver problemas complexos. **Intuição**\n\n**Química:** Habilidade de manipular substâncias químicas para criar poções, explosivos, venenos e outros compostos. Inclui o conhecimento de reações químicas e segurança no manuseio de materiais perigosos. **Intuição**\n\n**Criptografia:** Capacidade de criar e decifrar códigos e mensagens secretas. Inclui o conhecimento de técnicas de criptografia e a habilidade de proteger informações sensíveis. **Intuição**\n\n**Atuação:** Habilidade de interpretar papéis e personagens de forma convincente. Útil para enganar, entreter ou influenciar outras pessoas. **Intuição**\n\n**Costura: **Habilidade de criar e reparar roupas e tecidos. Inclui técnicas de costura, bordado e design de vestuário. **Intuição**\n\n**Ilusionismo:** Arte de criar ilusões visuais e auditivas para enganar ou entreter. Inclui truques de mágica e técnicas de distração. **(Percepção/Intuição)**\n\n**Instrumentos Musicais:** Habilidade de tocar e compor música usando diversos instrumentos. Inclui o conhecimento de teoria musical e técnicas de performance. **(Intuição)**\n\n**Disfarce: **Capacidade de alterar a aparência e comportamento para se passar por outra pessoa. Inclui técnicas de maquiagem, atuação e criação de identidades falsas. **(Intuição/Percepção)**\n\n**Forja: **Habilidade de trabalhar com metais para criar armas, armaduras e outros itens metálicos. Inclui técnicas de aquecimento, moldagem e temperamento de metais. **(Força/Intuição)**\n\n**Mecânica: **Capacidade de entender, construir e reparar mecanismos e dispositivos mecânicos. Inclui o conhecimento de engrenagens, motores e sistemas de movimento. **Intuição**\n\n**Dança**Você sabe dançar e encantar os outros por meio da sua dança. **Carisma**"
  },
  {
    id: "vantagens",
    titulo: "Vantagens",
    ordem: 6,
    texto: "# Vantagens\n\nVocê pode escolher até 5 vantagens para o seu personagem, podendo evoluir isso com pontos de proficiência.\n\n**Acrobata:** Desde pequeno, você sempre gostou de alturas e de se aventurar em situações perigosas, que dependiam totalmente das suas habilidades e equilíbrio, pode ter crescido em um circo e aprendido técnicas ou só tem predisposição para isso.\n**Você recebe vantagem em Testes de Agilidade (Acrobacia).**\n\n**Álter Ego Heroico:** Você possui uma identidade secreta, à sua escolha, que pode ser invocada sempre que estiver em perigo, desde que esteja com seus trajes de herói em mãos. Quando vestido de herói, deve proteger sua verdadeira identidade de todos.\n**Enquanto vestido de herói, recebe vantagem em jogadas de Agilidade e é sempre o primeiro agir em uma batalha.**\n\n**Aparência Inofensiva: **Por algum motivo você não parece perigoso. Talvez pareça muito pequeno, muito fraco, uma menininha segurando um pirulito. Você escolhe o motivo. Além de outros benefícios, como não levantar suspeitas, possuir esta individualidade também ajuda em combates, pegando oponentes desprevenidos. O truque não funciona com ninguém que já tenha visto você lutar, e também não engana duas vezes a mesma pessoa.\n**Recebe vantagem para acertar alguém que não desconfie de você, usando esta individualidade. Recebe vantagem em testes de furtividade**\n\n**Armadura de Músculos: **Você dedicou incontáveis horas ao treino físico, moldando seu corpo como uma verdadeira fortaleza. Seja por natureza ou determinação, sua musculatura densa e resistente é capaz de absorver impactos impressionantes, tornando-o um adversário formidável.\n**Você recebe vantagem em testes para resistir a debuffs físicos**\n\n**Atleta:** Você sempre gostou de praticar esportes, sempre foi muito bom em qualquer um que se dispusesse a praticar e pode até ter certa fama em um esporte específico.\n**Você recebe vantagem em Testes de Agilidade (Atletismo).**\n\n**Aura Assassina: **Você emana uma presença intimidadora, que não tem nada a ver com sua aparência física, seja por já ter matado incontáveis pessoas ou talvez por possuir uma grande fúria contida dentro de si.\n**Você recebe vantagem em Teste de Espírito (Intimidação).**\n\n**Audição Aguçada:** Possui uma audição sensível, capaz de perceber sons baixos e distantes, ou identificar de onde se originam.\n**Você tem vantagem em Testes de Percepção relacionados à audição.**\n\n**Beleza Natural: **O personagem nasceu com uma beleza chamativa. Mesmo sem o devido preparo, ele já é bonito suficiente para chamar atenção e conquistar olhares.\n**Você tem vantagem em Testes de Carisma (Persuasão) em pessoas que possam te enxergar.**\n\n**Comandante Inato:** Você está sempre orientando seus companheiros e os preparando mentalmente, mesmo sem que eles percebam, porém, no menor sinal de ameaça, você consegue organizá-los rapidamente, de maneira que todos consigam se posicionar da melhor forma em um combate.\n**Desde que você esteja presente, todos os seus aliados recebem Vantagem de Determinação. Você pode escolher a ordem de seus companheiros se eles permitirem.**\n\n**Controle de Multidões:** Você tem dom da palavra, e uma aura que desperta a confiança das massas.\n**Este dom permite incitar revoltas, espalhar desconfianças, vender produtos ou discursar em público com uma margem de sucesso bem maior.**\n\n**Coragem: **Você é desprovido do medo convencional. Em situações críticas, onde a maioria das pessoas fugiriam apavoradas, você continua firme.\n**Recebe vantagens em Testes de contra Espírito e Determinação(Intimidação).**\n\n**Corpo Vigoroso: **Você nasceu com um corpo mais rígido e enérgico, suas feridas se curam mais rápido e seu corpo aguenta muito mais esforço e ferimentos que o normal.\nVocê tem o extra de 100 de HP (Pode aumentar com pontos de proficiência).\n\n**Emotivo:** Você se sensibiliza facilmente com a dor dos outros e qualquer história triste o faz chorar. Isso faz com que sua interação seja mais fácil e que os outros sintam confiança em suas palavras e seus consolos.\nRecebe vantagem em Testes de Carisma para lidar com pessoas amigáveis.\n\n**Faro Aguçado:** Você tem um olfato com sensores capazes de farejar o mínimo odor. Quando identifica o cheiro de algo ou alguém, consegue seguir seu rastro, mesmo a grandes distâncias e em meio a outros cheiros, mas pode perder o alvo caso este modifique seu cheiro ou algo externo apague os rastros, como chuvas pesadas ou cheiros muito mais fortes interferindo a busca.\n**Você tem vantagem em Testes de Percepção relacionados ao olfato.**\n\n**Frieza: **Seu personagem possui um grande controle das emoções, mesmo que você perca um braço, seja insultado ou veja um amigo morrendo, consegue conter suas emoções e continuar a agir com racionalidade.\n**Recebe vantagem em Testes contra Intuição (Provocação).**\n\n**Homem das Neves:** O personagem é habituado à neve e ao gelo, sofre menos penalidades com temperaturas severamente baixas e conhecimento para se abrigar (fazer iglus) e proteger durante nevascas, ou pescar em lagos congelados.\n**Neste terreno, o personagem recebe vantagem em todos os Testes de Resistência.**\n\n**Homem das Selvas: **O personagem sabe como sobreviver em uma floresta ou selva, evitando seus perigos naturais e extraindo dela o que precisa para sobreviver. Isso inclui habilidades de caça e pesca, subir em árvores, dentre outras.\n**Neste terreno, o personagem recebe vantagem em todos os Testes de Resistência.**\n\n**Homem dos Mares:** O personagem é habituado ao mar, mas não como um pirata ou qualquer guerreiro. Ele foi um pescador, um ajudante, um marujo simples em alto-mar. Sofre menos ao lidar com tempestades, ondas, e outros efeitos climáticos que afetam os navios.\n**Neste terreno, o personagem recebe vantagem em todos os Testes de Resistência, jogadas de acerto e dano e o período de descanso curto e longo são reduzidos pela metade.**\n\n**Imunidade:** Seu corpo resiste naturalmente aos microrganismos que provocam doenças. Você nunca pegará uma doença ou infecção “naturalmente”. Se você for inoculado à força, seu corpo fará o possível para expulsar os agentes o mais rápido possível.\n**Você possui vantagens ao fazer Testes de Resistência contra doenças. **\n\n**Instintos Animais: **Talvez você tenha crescido em um local com culturas tribais ou em meio aos animais, talvez tenha combatido muitas feras, durante sua vida, ou só nasceu assim. O fato é que você se parece muito com um animal, às vezes, e têm instintos de sobrevivência aflorados.\n**Sempre que uma criatura assumida como inimiga estiver no seu campo de visão, você pode fazer Teste de Intuição para saber se ele é mais fraco, igualmente forte ou mais forte que você.**\n\n**Invisibilidade:** Você pode ficar invisível, não literalmente, apenas tem uma presença sútil e calma. Fora de um combate, pode usar esta habilidade durante quanto tempo desejar contanto que permaneça praticamente imóvel.\n**Você recebem vantagem em testes de furtividade e facilidade de se esconder**\n\n**Lábia:** Você cria as histórias mais loucas e as pessoas acreditam. Capaz de convencer os demais de que o céu é de outra cor, apenas contando uma história, embora, nem todas as pessoas sejam idiotas.\n**Você tem vantagem em teste de carisma para convencer outras pessoas ou fazerem falar sobre algo.**\n\n**Negativo:** Você é negativo por natureza, sempre é pessimista e sempre espera o pior. Quando algo dá errado, você simplesmente aceita. Por definição nada que alguém faça, diga ou mesmo habilidades de Akuma no Mi podem deixar você depressivo ou sem querer agir, pois, não tem como ficar pior do que já é.\n**Você é imune às condições Apaixonado, Empoderado, Enfeitiçado, Enfurecido, Letárgico, Paralisado e Sonolento. Contudo essa é uma vantagem/desvantagem, pode ocorrer situações que você abaixa a moral do time**\n\n**Olhos de Águia:** Você possui olhos que não podem ser enganados e que enxergam perfeitamente até onde sua vista alcança podendo ler e identificar mesmo as menores letras e símbolos.\n**Você tem vantagem em Testes de Percepção relacionados à visão.**\n\n**Preparação Para a Batalha:** Você precisa de um pequeno ritual para conseguir extrair o ápice da sua determinação em um combate.\n**Usando uma ação simples ou bônus para reproduzir uma mania (colocar uma bandana, acender um cigarro, arregaçar as mangas e etc.), durante os próximos dois turnos você recebe uma quantia de pontos no seu principal status, no número não é fixo e pode ser melhorado.  **\n\n**Recuperação Espantosa:** O personagem possui uma recuperação fora do normal, seja para dores ou para fadiga. Enquanto uma pessoa normal estaria de cama, recuperando-se de uma batalha, você já está ativo e pronto para a próxima.\n**Em certas situações de você desmaiar(ou outras situações que te deixaram incapacitado) em batalha, depois de poucos turnos(Depende do que causou) você recupera uma quantidade não fixa de vida e acorda podendo voltar para batalha ou fazer outra, contudo só funciona uma vez por batalha.**\n\n**Resistência a Venenos:** Em algum momento de sua vida, o personagem foi exposto a venenos perigosos e se recuperou, criando anticorpos para combatê-lo. Graças a isso, ele possui uma resistência maior a venenos, porém não é totalmente imune, podendo apresentar sintomas reduzidos ou parciais para venenos fortes.\n**Você possui vantagem em Testes de Resistência contra venenos.**\n\n**Resistência ao Álcool: **Por algum motivo você adquiriu uma resistência maior ao álcool do que pessoas normais, podendo resistir aos efeitos da embriaguez.\n**Você tem vantagem em Testes de Resistência contra a condição “Bêbado”.**\n\n**Sensitivo: **Seu personagem possui grande intuição, uma sensibilidade extrema que lhe permite saber sobre coisas mesmo sem ter acesso a informações sobre elas. Isso tem mais a ver com empatia entre seres vivos e racionais.\n**Recebe vantagem em todos os Testes de Intuição.**\n\n**Senso de Direção Impecável: **Você possui uma bússola no cérebro. Nunca se perde, mesmo em labirintos ou castelos, sabe sempre de que lado fica o norte e de onde você veio."
  },
  {
    id: "desvantagens",
    titulo: "Desvantagens",
    ordem: 7,
    texto: "# Desvantagens\n\nEscolha quantas quiser\n\n**Amnésia: **Você simplesmente não consegue guardar informação por muito tempo, mesmo que sejam coisas bobas ou muito importantes. Pode até esquecer que perdeu um braço.\n**(Você tem desvantagem em Testes de Inteligência e Determinação) **\n\n**Analfabeto:** Você não foi devidamente alfabetizado na sua infância e não consegue ler absolutamente nada, o que pode vir a se tornar inconveniente em muitas situações, felizmente sempre é possível aprender a ler e escrever, independente da sua idade.\n**(Você é incapaz de Ler) **\n\n**Audição Ruim:** Sua audição é reduzida por um defeito genético, sequela de uma batalha ou algum outro motivo.\n**(Você tem desvantagem em Testes de Percepção que envolvam a Audição) **\n\n**Cego: **Você não enxerga. O personagem compensa a perda da visão, tornando-se mais sensível aos outros estímulos sensoriais. Mas as imagens e as pistas visuais lhes passam desapercebidas.\n**(Sua percepção é zerada e você se torna incapaz de ver) **\n\n**Churriado: **Você tem muitos pontos positivos, mas a força física certamente não é uma delas, e por mais que você invista seu\ntempo em treinar seu corpo, para aumentar sua força física, o resultado vai acabar sendo só uma aparência melhor.\n**(Você tem desvantagem em Testes de Força e Resistência) **\n\n**Cleptomaníaco:** Você rouba coisas de que não precisa, não por seu valor, apenas por serem interessantes. Sempre que surgir a chance de roubar algo, você irá roubar. Um cleptomaníaco nunca devolve para os donos o produto de seus roubos, e lutará para evitar que isso aconteça.\n\n**Compulsivo:** Existe algo que você precisa fazer constantemente e que lhe traz alguma gratificação emocional, normalmente um alívio de ansiedade e/ou angústia. São hábitos mal adaptativos que já foram executados inúmeras vezes e acontecem quase automaticamente. É comum que haja um \"gatilho\" ou situações que tragam sua compulsão à tona.\n\n**Convencido:** Seu tópico de conversação favorito é você mesmo. Você sempre tenta levar todas as conversas para o tópico das suas conquistas e sucessos, e nunca falha em tentar receber o crédito por qualquer coisa com a qual esteja remotamente relacionado. Você não consegue evitar lembrar de seus feitos.\n\n**Coração Mole: **Você não aguenta ver os outros sofrerem e evita qualquer situação que implique em causar dor física ou emocional em alguém que não mereça ou não possa se defender.\n**(Suas jogadas de ataque contra criaturas que possam te causar empatia recebem Desvantagem) **\n\n**Curioso:** Você simplesmente é curioso demais em um assunto específico, sempre que algo te chama atenção sobre ele, você sente uma vontade incontrolável para descobrir tudo que pode sobre o assunto, muitas vezes deixando para trás o seu bom senso.\n\n**Demente:** Sua inteligência e capacidade de aprendizado são reduzidas. Por conta disso, não consegue aprender nada sozinho.\n**(Você só consegue fazer treinamentos se houver um tutor para te ensinar, mesmo que o treinamento não especifique isso)**\n\n**Dependente: **Você se sente totalmente inseguro quando não tem seus companheiros para te ajudar ou proteger, pode ser por medo, insegurança ou por sempre querer se mostrar.\n**(Enquanto não estiver com nenhum companheiro ou criatura que esteja cooperando contigo, dentro do seu raio de visão, você recebe Desvantagem em todas as suas jogadas)**\n\n**Distraído:** Você tem dificuldade para se concentrar em alguma coisa. Consequentemente, seu personagem geralmente não possui o conhecimento necessário em várias situações.\n\n**Dívida de Jogo: **Você deve uma quantidade absurda de dinheiro para uma ou várias personalidades muito poderosas e influentes, essa quantia é algo que você talvez nunca consiga pagar, além disso, os esforços de tentar passar seus credores para trás só aumentam a vontade de tentarem te pegar.\n(Independentemente de onde você esteja, você nunca está seguro e a qualquer momento podem surgir empregados e contratados dos seus credores para tentar te capturar)\n\n**Falta de Sorte:** A vida parece sempre querer rir da sua cara, não importa o quanto você tente e se prepare, alguma coisa sempre acaba dando errada.\n**(O Mestre pode transformar um Teste bem sucedido em uma falha, esse sucesso pode ser sua ou de qualquer outro, desde que seja para atrapalhar sua vida)**\n\n**Fantasioso:** Você acredita ser alguém ou alguma coisa que não é, ou acha que pode fazer alguma coisa de que não é capaz. Fantasias são sustentadas pelas convicções do personagem, portanto não é uma boa ideia tentar o contrariar.\n**(Sempre que alguém for contrário ou não acreditar na sua fantasia, você recebe a condição “Enfurecido” e ataca a criatura que discordou da sua fantasia) **\n\n**Fúria Incontrolável:** Tudo é capaz de te irritar e provocar sua fúria, desde ataques que te causem dor até uma provocação infantil e que seja obviamente uma armadilha.\n**(Você recebe desvantagem em Testes de Intuição contra Testes de Habilidade de Espirito/intuição (Provocação) e não pode ser acalmado) **\n\n‎‎‎‎‎‎‎‎\n**Ganancioso: **Você realmente ama dinheiro, talvez, o motivo que lhe fez partir para se aventurar nos mares. Sempre que alguém falar de formas de ganhar quantidades consideráveis de dinheiro, por um pedido, uma missão ou revelando a localização de um tesouro escondido, você não consegue resistir, caso perca a oportunidade, você é acometido por uma grande depressão.\n\n**Ignorante: **Você acha que já possui quase todo o conhecimento necessário para atingir seus objetivos e, para o conhecimento que não tem, é só percorrer um caminho único, para você, outros conhecimentos são perda de tempo.\n\n**Ingênuo:** Talvez faltem alguns parafusos na sua cabeça, ou talvez você jamais tenha aprendido a separar a realidade da ficção. Não importa por que, você é extremamente vulnerável a mentiras sutis e meias-verdades.\n\n**Linhagem Demoníaca:** Você é filho ou descendente de qualquer grau de uma figura, conhecida em todo o mundo, considerada execrável por uma grande parte da sociedade e, talvez, até maioria. Quando àqueles que odeiam essa pessoa descobrem sua relação com ela, eles transmitem todo esse ódio para você.\n**(Você recebe preconceito severo de qualquer pessoa que odeie o seu antepassado)**\n\n**Má Fama:** Você é infame. Talvez você tenha fracassado em alguma missão importante, foi derrotado ou humilhado publicamente, é um ex-criminoso tentando se regenerar. Por algum motivo, ninguém acredita ou confia em você, além de terem grandes suspeitas sobre seus atos, seja de forma merecida ou não. Ao escolher este defeito, você pode definir uma alcunha inicial, com aprovação do Mestre.\n**(Você recebe Desvantagem em Testes de Habilidade de Carisma -Persuasão- ) **\n\n**Medroso: **O medo é seu companheiro constante, qualquer coisa possivelmente assustadora o impressiona e faz com que esbugalhe os olhos e grite, mesmo que você seja capaz de fazer o mesmo ou até superar ou que a criatura seja mais fraca que você.\n**(Você é sempre o último a agir) **\n\n**Mentiroso:** Você sempre tenta se sobressair com suas mentiras, sempre que tiver a oportunidade de parecer melhor do que você realmente é, não há hesitação, mesmo que faça com que um oponente mais poderoso se interesse em tirar sua vida. Chega a mentir tanto que começa a ser desacreditado.\n**(Você Desvantagem Testes de Carisma -Enganação-) **\n\n**Monstruoso: **Sua aparência é repulsiva e assustadora. Você não pode sair pelas ruas como gente normal; as pessoas ficarão assustadas ou furiosas. Todos que possuem esta desvantagem, podem esconder sua monstruosidade com roupas adequadas.\n**(Você recebe preconceito Severo)**\n\n**Mudo:** Um personagem mudo é incapaz de produzir fala, sendo preciso recorrer a outros meios para se comunicar, como a língua de sinais.\n**(Você falha automaticamente em ações que dependam da fala) **\n\n**Narcisista**: Você ama a si mesmo e está sempre cuidando da própria aparência com grande afinco. Sua aparência reflete no desempenho de suas performances, caso não esteja arrumado e se sentindo belo ou esteja sujo, mesmo as batalhas não serão travadas com grande vontade.\n\n**Orgulho Cego:** Você é incapaz de ignorar provocações e insultos de qualquer tipo direcionados a você, seus companheiros ou entes queridos, independentemente do quão a situação seja inapropriada para isso, podendo partir para a violência caso fique muito irritado.\n\n**Paranoico:** Você não confia em ninguém, nem em seus amigos. Nunca pede e nem aceita nenhuma ajuda, nem mesmo o tratamento de seus ferimentos. Não consegue descansar ou dormir direito: mesmo que esteja em uma estalagem ou outro lugar que parece ser totalmente seguro.\n**(Você precisa de um tempo para se acalmar e achar que está tudo certo, para começar um descanso curto ou longo) **\n\n‎‎‎‎‎‎‎‎\n**Rosto Debochado: **Sua cara incita o ódio e parece que sempre está fazendo graça às custas de todo mundo.\n**(Sempre que um combate se iniciar, quando não fizer diferença para as criaturas inimigas qual alvo escolher, elas sempre escolherão você)**\n\n**Sedutor Incorrigível: **Você não consegue resistir a fazer tentativas casuais para seduzir qualquer um que encaixe em seus critérios de parceiro sexual, mesmo que você possa não querer ter um relacionamento sério (ou qualquer relacionamento). Porém isso não significa que você é um bom sedutor.\n**(Enquanto estiver na presença de seu interesse amoroso, você não consegue se concentrar)**\n\n**Senso de Direção Ruim:** Você é tão ruim com senso de direção que pode se perder em um corredor sem portas ou janelas e não importa se seus amigos estiverem de olho em você, no primeiro deslize, você some da vista deles, como mágica.\n\n**Sinceridade Excessiva:** Você é incapaz de mentir, seja por valores morais ou simplesmente dificuldade em ocultar a verdade. E por mais que você se esforce para contar uma mentira, sempre será óbvio que não se trata da verdade.\n\n**Sonâmbulo:** Você pode começar a andar e falar enquanto dorme. Você pode até lutar e agir como se estivesse consciente, mas acorda se sofrer qualquer dano e não se lembra de nada que tenha acontecido enquanto estava sonâmbulo.\n**(Ao final de cada descanso, você deve fazer um Teste de resistência para saber se conseguiu descansar. Em caso de falha, você não se beneficia de nenhuma característica de um descanso longo) **\n\n**Sonolência: **Por algum motivo você está sempre com sono, não importa se dormiu normalmente no dia anterior ou se acabou de dormir. Em qualquer momento, exceto, talvez, durante batalhas, você pode cair no sono.\n\n**Sósia: **Você é parecido com a descrição de outra pessoa, o que causa a confusão de identidades. Isso pode provocar inúmeras situações desagradáveis, ou mesmo perigosas, principalmente se o seu \"outro eu\" tiver péssima reputação ou estiver sendo procurado por algum crime.\n\n**Suicida: **Você não dá valor à própria vida. Embora não tenha coragem para se matar, sempre procura oportunidades de morrer desafiando inimigos poderosos, correndo riscos desnecessários ou fazendo coisas de forma impensada.\n\n**Surdo:** Você é totalmente surdo, incapaz de ouvir qualquer som. Isso pode ter ocorrido por um acidente, um ferimento antigo ou você nasceu assim.\n**(Você falha automaticamente em Testes Percepção que dependam da audição) **\n\n**Timidez:** Você sente uma dificuldade enorme em lidar com pessoas, mesmo que você seja amigo delas, e tenta evitar situações sociais sempre que possível.\n**(Você recebe Desvantagem Testes de Carisma -Atuação-)**\n\n**Trapalhão:** Sempre que você se move, sai esbarrando em tudo pela sua frente ou tropeça no nada, não consegue carregar qualquer coisa sem que tudo acabe no chão.\n\n**Trauma Profundo/Fobia: **Em seu passado você passou por uma situação traumática irrecuperável, desde uma perda terrível, ter sofrido agressões ou qualquer evento negativamente marcante.\n**(Toda vez que você se depara com uma situação semelhante ou possui um gatilho que traga suas memórias à tona, você é tomado por perturbações nítidas que pode te impedir de realizar ações ou comprometer sua concentração, devendo fazer um Teste de Espirito, se passar no Teste, você supera momentaneamente o trauma, se falhar, todos os seus Testes passam a ter Desvantagem por um turno.) **\n\n‎‎‎‎‎‎‎‎\n**Vício: **Você é viciado em alguma substância que precisa estar presente no seu sangue. Desde álcool, nicotina, açúcar, drogas ilícitas, alimentos comuns ou compostos mais simples.\n\n**Visão Ruim:** Você tem uma visão defeituosa devido a um problema incorrigível, por exemplo, ser caolho, míope ou enxergar mal por algum outro motivo, você pode usar óculos para corrigir, mas quando o deixa cair ou o perde, a dificuldade de enxergar é clara.\n**(Você tem desvantagem em Testes de Percepção) **\n\n**Voz Fina:** Você possui uma voz tão fina que chega a ser engraçada e não importa o quanto tente engrossar ou disfarçar e também não importa o seu tamanho ou aparência, nada impede que quem ouça sua voz ache a engraçada.\n**(Você tem desvantagem em Testes de Espírito -Intimidação- com criaturas que possam te ouvir)**"
  },
  {
    id: "akuma-no-mi",
    titulo: "Akuma no Mi",
    ordem: 8,
    texto: "# Akuma no Mi\nAs Akuma no Mi são frutas místicas que concedem poderes a quem as consome, mas ao custo de perder a capacidade de nadar. Existem três tipos principais de Akuma no Mi:\n\n**Paramecia:** Concede habilidades sobre-humanas que podem variar amplamente.\n\n**Zoan: **Permite ao usuário se transformar em um animal específico ou em uma forma híbrida entre ser e animal. Existem subcategorias, como as Zoan Míticas, que permitem transformações em criaturas lendárias, e as Zoan Ancestrais, que permitem transformações em animais pré-históricos.\n\n**Logia: **Concede ao usuário a habilidade de se transformar em um elemento natural e manipular esse elemento à vontade.\n\nNo RPG vamos seguir os seguintes pontos:\n\n- **Descoberta e Consumo:** As frutas são raras e valiosas, vocês vão pode encontrar explorando ilhas em sua maioria ou em baús do tesouro. Normalmente ao encontrar iremos fazer um ganha para saber qual akuma no mi é.\nSite a Ser Usado:\nTipos de frutas:\nhttps://wheelofnames.com/au5-bkc\n\nFrutas Logias:\nhttps://wheelofnames.com/upz-gh3\n\nZoan Mítica\nhttps://wheelofnames.com/nj2-jmc\n\nZoan Normal\nhttps://wheelofnames.com/nzw-c2n\n\nZoan Ancestral\nhttps://wheelofnames.com/gb6-w48\n\nFrutas Paramecias\nhttps://wheelofnames.com/wha-duw\n\n- **Efeito Logia:** No nosso jogo, o efeito Logia funcionará de maneira diferente. Você terá uma \"Barra de Logia\" que concederá intangibilidade. Inicialmente, você será intangível a apenas um ataque, após o qual perderá a intangibilidade e ficará vulnerável a ataques normais(Isso serve para NPC com frutas logia). A barra de Logia só é recuperado depois da batalha. Para facilitar é como no jogo GPO."
  },
  {
    id: "raca-humano",
    titulo: "Raça: Humano",
    ordem: 9,
    texto: "# Humanos\nOs Humanos são a raça dominante no mundo, já que superam a maioria das outras raças, e estão geralmente entre as mais avançadas e organizadas tecnologicamente. A maioria das ilhas é habitada por seres humanos, mesmo na Grand Line, onde a maioria das raças mais fortes, como os Homens-Peixes e os ogros, são encontradas.\n\n- PONTOS POSITIVOS\n{Cap maior em Determinação, Intuição e Carisma}\n\nAdaptação: O humano escolhe 2 Perícias para adicionar a ficha, à sua escolha.\nMestre de Oficio: O humano pode escolher uma perícia a mais do ofício.\nDeterminação: O humano tem vantagem em testes de determinação.\nMestres: Começa com um Ponto de Proficiência.\n\n- PONTOS NEGATIVOS\nMentalmente instável: São mais propenso à ataques mentais.\n\nhttps://cdn.discordapp.com/attachments/1243774819468709978/1287467975808389172/gol-d-roger-one-piece.gif\n\n# Humanos\nOs Humanos são a raça dominante no mundo, já que superam a maioria das outras raças, e estão geralmente entre as mais avançadas e organizadas tecnologicamente. A maioria das ilhas é habitada por seres humanos, mesmo na Grand Line, onde a maioria das raças mais fortes, como os Homens-Peixes e os ogros, são encontradas.\n\n- PONTOS POSITIVOS\n{Cap maior em Determinação, Intuição e Carisma}\n\nAdaptação: O humano escolhe 2 Perícias para adicionar a ficha, à sua escolha.\nMestre de Oficio: O humano pode escolher uma perícia a mais do ofício.\nDeterminação: O humano tem vantagem em testes de determinação.\nMestres: Começa com um Ponto de Proficiência.\n\n- PONTOS NEGATIVOS\nMentalmente instável: São mais propenso à ataques mentais.\n\nhttps://cdn.discordapp.com/attachments/1243774819468709978/1287467975808389172/gol-d-roger-one-piece.gif"
  },
  {
    id: "raca-skypean",
    titulo: "Raça: Skypean",
    ordem: 10,
    texto: "# Skypieans/Celestiais\nSkypieans treinam seus cabelos para crescer como a antena de um inseto desde jovem. Seu estilo de asa é muito diferente dos Birkans, com estilo mais próximo das asas de Shandia. Suas asas tendem a ter penas mais curtas que são um pouco menos numerosas que as de um Shandia, muitas vezes essas penas são mais grossas e arredondadas. Eles estão tão próximos que às vezes as asas parecem idênticas. No entanto, a principal diferença entre Shandia e Skypieans é que os Skypieans costumam ter tons de pele mais claros. Eles usam trajes civis mais simples do que os Shandia e Birkans.\n\n- PONTOS POSITIVOS\n{Cap maior em Agilidade e Percepção}\n\nHabitat Natural (Céu): Um celestial não recebe nenhum tipo de penalidade por estar em altitude elevada.\nHerança Cultural: Um celestial conhece todos os tipos de dials e suas funcionalidades. À escolha do jogador, o personagem recebe 2 dials cotidianos diferentes e 1 dial bélico.\nLeveza: Os celestiais recebem redução em qualquer dano de queda e podem planar.\nOxigênio Abundante: Recebe vantagem em Teste de Agilidade (Acrobacia).\nMantra: São muito propensos a possuir o Haki da Observação que vê o futuro.\n\n- PONTOS NEGATIVOS\nPreconceito (Leve): Os celestiais são raros nos oceanos normais, por conta das pessoas não serem acostumadas a verem suas asas, eles podem ser discriminados em uma \"primeira vista\", tornando qualquer tipo de interação possivelmente mais difícil.\n\nhttps://tenor.com/view/one-piece-wyper-one-piece-wyper-sky-island-skypiea-gif-26175632\n\n# Skypieans/Celestiais\nSkypieans treinam seus cabelos para crescer como a antena de um inseto desde jovem. Seu estilo de asa é muito diferente dos Birkans, com estilo mais próximo das asas de Shandia. Suas asas tendem a ter penas mais curtas que são um pouco menos numerosas que as de um Shandia, muitas vezes essas penas são mais grossas e arredondadas. Eles estão tão próximos que às vezes as asas parecem idênticas. No entanto, a principal diferença entre Shandia e Skypieans é que os Skypieans costumam ter tons de pele mais claros. Eles usam trajes civis mais simples do que os Shandia e Birkans.\n\n- PONTOS POSITIVOS\n{Cap maior em Agilidade e Percepção}\n\nHabitat Natural (Céu): Um celestial não recebe nenhum tipo de penalidade por estar em altitude elevada.\nHerança Cultural: Um celestial conhece todos os tipos de dials e suas funcionalidades. À escolha do jogador, o personagem recebe 2 dials cotidianos diferentes e 1 dial bélico.\nLeveza: Os celestiais recebem redução em qualquer dano de queda e podem planar.\nOxigênio Abundante: Recebe vantagem em Teste de Agilidade (Acrobacia).\nMantra: São muito propensos a possuir o Haki da Observação que vê o futuro.\n\n- PONTOS NEGATIVOS\nPreconceito (Leve): Os celestiais são raros nos oceanos normais, por conta das pessoas não serem acostumadas a verem suas asas, eles podem ser discriminados em uma \"primeira vista\", tornando qualquer tipo de interação possivelmente mais difícil."
  },
  {
    id: "raca-tritao",
    titulo: "Raça: Tritão",
    ordem: 11,
    texto: "# Tritões\nOs homens-peixes são mais parecidos com peixes do que tritões, geralmente parecendo uma combinação entre um homem e um peixe ou outra criatura aquática. Eles também têm brânquias entre os ombros e o pescoço, às vezes cobertos por suas roupas, além de muitas vezes terem mãos palmadas. Dependendo da espécie, eles podem ter vários membros (principalmente braços extras). O tamanho também pode diferir muito entre os indivíduos.\n\n- PONTOS POSITIVOS\n{Cap(s) maior(es) em [Depende do tritão]}\n\nForça Superior: Possui vantagem em Testes de Resistência e Testes de Força.\nMaestria Cultural: O homem-peixe começa com 2 pontos de proficiência no uso de tridentes.\nNatação Superior: O homens-peixe, quando estão debaixo d’água, desferem um dano maior que varia conforme você é forte.\nRespiração Adaptável: Os homens-peixe possuem brânquias e pulmões, possibilitando uma respiração normal em ambientes com água ou ar.\nVisão Submersa: Os olhos dos homens-peixe são adaptados para funcionar normalmente embaixo d’água, em caso de escuridão total eles só enxergam em tons de cinza.\nMaestria Karatê: Você pode usar o Karate Tritão em potencial máximo e moldar a água a seu favor.\n\n- PONTOS NEGATIVOS\n\nCriatura do Mar: Os homens-peixe precisam de duas vezes mais água que humanos em um dia normal e quatro vezes mais em um dia quente, para não receber Níveis de Exaustão.\nPreconceito (Severo): Por serem julgados como uma raça inferior ou ameaçadora, os homens-peixe são rejeitados e rejeitam maior parte da raça humana, tornando qualquer tipo de interação mais difícil.\n\nhttps://cdn.discordapp.com/attachments/1243774819468709978/1287471504107503709/one-piece-one-piece-film-red.gif\n\n# Tritões\nOs homens-peixes são mais parecidos com peixes do que tritões, geralmente parecendo uma combinação entre um homem e um peixe ou outra criatura aquática. Eles também têm brânquias entre os ombros e o pescoço, às vezes cobertos por suas roupas, além de muitas vezes terem mãos palmadas. Dependendo da espécie, eles podem ter vários membros (principalmente braços extras). O tamanho também pode diferir muito entre os indivíduos.\n\n- PONTOS POSITIVOS\n{Cap(s) maior(es) em [Depende do tritão]}\n\nForça Superior: Possui vantagem em Testes de Resistência e Testes de Força.\nMaestria Cultural: O homem-peixe começa com 2 pontos de proficiência no uso de tridentes.\nNatação Superior: O homens-peixe, quando estão debaixo d’água, desferem um dano maior que varia conforme você é forte.\nRespiração Adaptável: Os homens-peixe possuem brânquias e pulmões, possibilitando uma respiração normal em ambientes com água ou ar.\nVisão Submersa: Os olhos dos homens-peixe são adaptados para funcionar normalmente embaixo d’água, em caso de escuridão total eles só enxergam em tons de cinza.\nMaestria Karatê: Você pode usar o Karate Tritão em potencial máximo e moldar a água a seu favor.\n\n- PONTOS NEGATIVOS\n\nCriatura do Mar: Os homens-peixe precisam de duas vezes mais água que humanos em um dia normal e quatro vezes mais em um dia quente, para não receber Níveis de Exaustão.\nPreconceito (Severo): Por serem julgados como uma raça inferior ou ameaçadora, os homens-peixe são rejeitados e rejeitam maior parte da raça humana, tornando qualquer tipo de interação mais difícil.\n\nhttps://cdn.discordapp.com/attachments/1243774819468709978/1287471504107503709/one-piece-one-piece-film-red.gif"
  },
  {
    id: "raca-lunariano",
    titulo: "Raça: Lunariano",
    ordem: 12,
    texto: "# Lunarianos\nNormalmente, humanos comuns desconhecem totalmente a existência de um lunariano. Mas ainda existem aqueles com maior conhecimento e que já ouviram histórias ou lendas sobre, junto com a informação de uma grande recompensa, dada pelo governo, por pistas de onde encontrar um.\n\n - PONTOS POSITIVOS\n{Cap maior em Força, Resistência e Agilidade.}\n\nControle do Fogo: O lunariano pode gerar fogo e imbuir seus ataques com o mesmo ou ataques únicos com essa característica.\n\nCorpo Forjado: Com uma ação livre, o lunariano pode alternar entre duas formas: “Ignição” e “Resiliente”.\n\nIgnição: Enquanto nesta forma, o orbe de fogo presente nas costas do lunariano se extingui e ele recebe um aumento em sua velocidade de até 1.2x podendo evoluir, contudo não pode usar o seu Controle do Fogo.\n• Ao usar a ação “Atacar” o lunariano pode realizar um ataque adicional (acumula com a característica “Ataque Extra”), mas apenas uma vez por rodada. Esta característica pode ser usada 2 vezes por batalha.\n• O deslocamento do lunariano adiciona mais 2 Quadrados (caso receba outro deslocamento, prevalece o maior);\n\nResiliente: Enquanto nesta forma, um orbe de fogo surge nas costas do lunariano e ele recebe um aumento em sua resistência.\n• O lunariano recebe 20% a menos de danos, sua pele fica tão dura que laminas ou balas não perfuram seu corpo. (A casos especiais que conseguem passar), essa característica só dura enquanto o lunariano tiver resistência.\n• Enquanto nesta forma, o lunariano não pode possuir um deslocamento maior que 6 Quadrados.\n\n- PONTOS NEGATIVOS\n\nCabeça à Prêmio: O Governo Mundial busca capturar ou exterminar qualquer membro da raça lunariana, estando dispostos a recompensar com fortunas qualquer pessoa que possa lhes conceder mesmo pistas do paradeiro de um. Você terá sua cabeça a prépio só por existir.\n\nPreconceito (Severo): Por possuírem grandes asas negras e fogo atrás da cabeça, as pessoas podem ser levadas pelas ideias supersticiosas e crenças para terem cautela ou preconceito em lidar com lunarianos, tornando qualquer tipo de interação mais difícil.\n\nhttps://tenor.com/view/king-one-piece-fire-lunarian-alber-gif-6807844285701314676\n\n# Lunarianos\nNormalmente, humanos comuns desconhecem totalmente a existência de um lunariano. Mas ainda existem aqueles com maior conhecimento e que já ouviram histórias ou lendas sobre, junto com a informação de uma grande recompensa, dada pelo governo, por pistas de onde encontrar um.\n\n - PONTOS POSITIVOS\n{Cap maior em Força, Resistência e Agilidade.}\n\nControle do Fogo: O lunariano pode gerar fogo e imbuir seus ataques com o mesmo ou ataques únicos com essa característica.\n\nCorpo Forjado: Com uma ação livre, o lunariano pode alternar entre duas formas: “Ignição” e “Resiliente”.\n\nIgnição: Enquanto nesta forma, o orbe de fogo presente nas costas do lunariano se extingui e ele recebe um aumento em sua velocidade de até 1.2x podendo evoluir, contudo não pode usar o seu Controle do Fogo.\n• Ao usar a ação “Atacar” o lunariano pode realizar um ataque adicional (acumula com a característica “Ataque Extra”), mas apenas uma vez por rodada. Esta característica pode ser usada 2 vezes por batalha.\n• O deslocamento do lunariano adiciona mais 2 Quadrados (caso receba outro deslocamento, prevalece o maior);\n\nResiliente: Enquanto nesta forma, um orbe de fogo surge nas costas do lunariano e ele recebe um aumento em sua resistência.\n• O lunariano recebe 20% a menos de danos, sua pele fica tão dura que laminas ou balas não perfuram seu corpo. (A casos especiais que conseguem passar), essa característica só dura enquanto o lunariano tiver resistência.\n• Enquanto nesta forma, o lunariano não pode possuir um deslocamento maior que 6 Quadrados.\n\n- PONTOS NEGATIVOS\n\nCabeça à Prêmio: O Governo Mundial busca capturar ou exterminar qualquer membro da raça lunariana, estando dispostos a recompensar com fortunas qualquer pessoa que possa lhes conceder mesmo pistas do paradeiro de um. Você terá sua cabeça a prépio só por existir.\n\nPreconceito (Severo): Por possuírem grandes asas negras e fogo atrás da cabeça, as pessoas podem ser levadas pelas ideias supersticiosas e crenças para terem cautela ou preconceito em lidar com lunarianos, tornando qualquer tipo de interação mais difícil.\n\nhttps://tenor.com/view/king-one-piece-fire-lunarian-alber-gif-6807844285701314676"
  },
  {
    id: "raca-ogro",
    titulo: "Raça: Ogro",
    ordem: 13,
    texto: "# Onis\nA Tribo Oni é uma raça de gigantes que têm características demoníacas. Embora estejam quase extintos hoje, durante o Século Vazio, eles vagaram pelos mares como guerreiros da destruição em massa. Por esta razão, eles ganharam o epíteto, Gigantes antigos.\n\n- PONTOS POSITIVOS\n{Cap maior em Força e Resistência}\n\nArma Favorita: As proporções do seu corpo favorecem o uso de armas de grande porte. Quando estiver empunhando uma arma favorita (escolha qualquer arma corpo-a-corpo com a propriedade “Pesada”), o dano dela será 1.2x sua Força.\n\nForça Aumentada: Oni possuem força física superior devido à sua anatomia monstruosa, o que lhes dá vantagem em combate corpo a corpo e ao usar armas pesadas. Vantagens em Testes de Força e  você vai ganhando dano base começando por +20 de dano base.\n\nGolpe de Chifres: Com uma ação bônus, o ogro consegue usar seus chifres para fazer uma jogada de ataque corpo-a-corpo (desde que nesse turno você não tenha usado ou use a ação ‘‘atacar’’). O ataque corpo-a-corpo desarmado com esta característica causa.\n\nSuperioridade do Ogro: Seu corpo é naturalmente mais resistente que o de outras criaturas. Sempre que você receber qualquer tipo de dano (exceto dano Verdadeiro), esse dano é reduzido em 30%.\n\n- PONTOS NEGATIVOS\n\nFúria Sanguinária: O ogro pode escolher entrar em fúria podendo ficar por 3 turnos em furia. Em cada um dos seus turnos enquanto estiver em fúria, o oni ataca a criatura mais próxima que ele possa ver.  nessa forma forma a Superioridade do Ogro passa de 30% para 40%, e Arma Favorita passa de 1.2x para 1.3x, contudo nessa forma você é incapaz de se defender de qualquer golpe, ou lançar técnicas que precisem de concentração.\n\nPreconceito (Leve): Os ogros possuem corpos grandes e chamativos que inspiram o medo, por conta de seu ar assustador e seus chifres, tornando qualquer tipo de interação possivelmente mais difícil.\n\nFalta de Carisma: Você sofre desvantagem em testes de carisma pelos outros se sentirem intimidados pela sua presença.\n\nOrgulho: Os ogros são incapazes de desviar por conta do seu orgulho, podendo somente defender.\n\nhttps://tenor.com/view/one-piece-kaido-yonko-the-four-emperors-kanabo-gif-24870026\n\n# Onis\nA Tribo Oni é uma raça de gigantes que têm características demoníacas. Embora estejam quase extintos hoje, durante o Século Vazio, eles vagaram pelos mares como guerreiros da destruição em massa. Por esta razão, eles ganharam o epíteto, Gigantes antigos.\n\n- PONTOS POSITIVOS\n{Cap maior em Força e Resistência}\n\nArma Favorita: As proporções do seu corpo favorecem o uso de armas de grande porte. Quando estiver empunhando uma arma favorita (escolha qualquer arma corpo-a-corpo com a propriedade “Pesada”), o dano dela será 1.2x sua Força.\n\nForça Aumentada: Oni possuem força física superior devido à sua anatomia monstruosa, o que lhes dá vantagem em combate corpo a corpo e ao usar armas pesadas. Vantagens em Testes de Força e  você vai ganhando dano base começando por +20 de dano base.\n\nGolpe de Chifres: Com uma ação simples, o ogro consegue usar seus chifres para fazer uma jogada de ataque corpo-a-corpo (desde que nesse turno você não tenha usado ou use a ação ‘‘atacar’’). O ataque corpo-a-corpo desarmado com esta característica causa.\n\nSuperioridade do Ogro: Seu corpo é naturalmente mais resistente que o de outras criaturas. Sempre que você receber qualquer tipo de dano (exceto dano Verdadeiro), esse dano é reduzido em 30%.\n\n- PONTOS NEGATIVOS\n\nFúria Sanguinária: O ogro pode escolher entrar em fúria podendo ficar por 3 turnos em furia. Em cada um dos seus turnos enquanto estiver em fúria, o oni ataca a criatura mais próxima que ele possa ver.  nessa forma forma a Superioridade do Ogro passa de 30% para 40%, e Arma Favorita passa de 1.2x para 1.3x, contudo nessa forma você é incapaz de se defender de qualquer golpe, ou lançar técnicas que precisem de concentração.\n\nPreconceito (Leve): Os ogros possuem corpos grandes e chamativos que inspiram o medo, por conta de seu ar assustador e seus chifres, tornando qualquer tipo de interação possivelmente mais difícil.\n\nFalta de Carisma: Você sofre desvantagem em testes de carisma pelos outros se sentirem intimidados pela sua presença.\n\nOrgulho: Os ogros são incapazes de desviar por conta do seu orgulho, podendo somente defender."
  },
  {
    id: "raca-mink",
    titulo: "Raça: Mink",
    ordem: 14,
    texto: "# Minks\nOs Minks são uma raça distinta e notável que habita a ilha de Zou. Eles possuem características físicas únicas que os diferenciam das outras raças do mundo, eles têm uma ampla gama de aparências físicas, mas geralmente compartilham traços animais em sua anatomia. Sua pelagem ou pele pode variar em cores e padrões, correspondendo à espécie animal da qual descendem.\n\n- PONTOS POSITIVOS\n{Cap maior em Agilidade }\n\nElectro: Você pode imbuir eletricidade ao seus golpes, e usar essa característica para dar dano extra.\n\nFurtividade Animal: Nenhuma criatura consegue ter vantagens ao fazer um Teste de Percepção para tentar localizar um mink, mesmo com o uso do Haki da Observação.\n\nInstinto de Presa: A natureza animal dos Minks lhes dá um instinto de caça afiado. O personagem tem vantagem em rastrear presas e se aproximar sorrateiramente de inimigos.\n\nSulong: Quando um Mink olha para a lua cheia, ele pode entrar na forma Sulong, aumentando suas habilidades físicas e capacidades de combate. Durante a transformação, o personagem ganha os seguintes benefícios:\n• Força e Agilidade Aumentadas: O personagem recebe um bônus significativo em sua Força e Destreza.\n• Controle de Eletricidade Aprimorado: A habilidade Electro é amplificada, permitindo ao personagem causar ainda mais dano elétrico com seus ataques.\n\n- PONTOS NEGATIVOS\nInstintos Animalescos: Para todo mink existe algum objeto que o faz perder o controle de alguma forma. Por exemplo, um mink coelho, ao ver uma cenoura, se sente impelido a deixar de fazer o que estava fazendo e ir morder a cenoura. Nesses casos, o mink deve fazer um Teste de Espírito (CD 15) para não sucumbir aos seus instintos e ficar 1d4 turnos “distraído” (condição “Atordoado”), ou até que receba dano.\n\nPreconceito (Severo): Devido à aparência de um mink, é comum que os humanos os temam como se fossem criaturas perigosas, tornando qualquer tipo de interação possivelmente mais difícil.\n\nhttps://tenor.com/view/one-piece-inuarashi-one-piece-inuarashi-nekomamushi-nekomamushi-one-piece-gif-26181232\n\n# Minks\nOs Minks são uma raça distinta e notável que habita a ilha de Zou. Eles possuem características físicas únicas que os diferenciam das outras raças do mundo, eles têm uma ampla gama de aparências físicas, mas geralmente compartilham traços animais em sua anatomia. Sua pelagem ou pele pode variar em cores e padrões, correspondendo à espécie animal da qual descendem.\n\n- PONTOS POSITIVOS\n{Cap maior em Agilidade }\n\nElectro: Você pode imbuir eletricidade ao seus golpes, e usar essa característica para dar dano extra.\n\nFurtividade Animal: Nenhuma criatura consegue ter vantagens ao fazer um Teste de Percepção para tentar localizar um mink, mesmo com o uso do Haki da Observação.\n\nInstinto de Presa: A natureza animal dos Minks lhes dá um instinto de caça afiado. O personagem tem vantagem em rastrear presas e se aproximar sorrateiramente de inimigos.\n\nSulong: Quando um Mink olha para a lua cheia, ele pode entrar na forma Sulong, aumentando suas habilidades físicas e capacidades de combate. Durante a transformação, o personagem ganha os seguintes benefícios:\n• Força e Agilidade Aumentadas: O personagem recebe um bônus significativo em sua Força e Destreza.\n• Controle de Eletricidade Aprimorado: A habilidade Electro é amplificada, permitindo ao personagem causar ainda mais dano elétrico com seus ataques.\n\n- PONTOS NEGATIVOS\nInstintos Animalescos: Para todo mink existe algum objeto que o faz perder o controle de alguma forma. Por exemplo, um mink coelho, ao ver uma cenoura, se sente impelido a deixar de fazer o que estava fazendo e ir morder a cenoura. Nesses casos, o mink deve fazer um Teste de Espírito (CD 15) para não sucumbir aos seus instintos e ficar 1d4 turnos “distraído” (condição “Atordoado”), ou até que receba dano.\n\nPreconceito (Severo): Devido à aparência de um mink, é comum que os humanos os temam como se fossem criaturas perigosas, tornando qualquer tipo de interação possivelmente mais difícil.\n\nhttps://tenor.com/view/one-piece-inuarashi-one-piece-inuarashi-nekomamushi-nekomamushi-one-piece-gif-26181232"
  }
]

export const CATALOGOS_ONE_PIECE: CatalogosDoSistema = {
  pericias: [
    {
      nome: "Acrobacia",
      descricao: "Você consegue andar na corda bamba, cair sem se machucar e fazer outras proezas acrobáticas.",
      atributos: [
        "agilidade"
      ]
    },
    {
      nome: "Analisar Criatura",
      descricao: "Com uma capacidade de observação acima do normal, o combatente pode analisar inimigos e aliados para saber se eles representam alguma ameaça, se estão sendo controlados ou agindo estranhamente.",
      atributos: [
        "percepcao"
      ]
    },
    {
      nome: "Anatomia",
      descricao: "Permite ao personagem entender a estrutura e funcionamento do corpo humano e de outras criaturas. Pode ser usada para identificar ferimentos ou doenças, e realizar procedimentos médicos complexos.",
      atributos: [
        "intuicao"
      ]
    },
    {
      nome: "Arrombamento",
      descricao: "Ato de diligencia que consiste no ingresso em imóveis e abertura de móveis, fechados, mediante ordem judicial, a fim de encontrar coisas ou pessoas para apreensão.",
      atributos: [
        "forca",
        "percepcao"
      ]
    },
    {
      nome: "Atletismo",
      descricao: "É utilizada para realizar façanhas atléticas, como correr rápido, escalar montanhas, nada em águas revoltas e pular.",
      atributos: [
        "agilidade"
      ]
    },
    {
      nome: "Atuação",
      descricao: "Habilidade de interpretar papéis e personagens de forma convincente. Útil para enganar, entreter ou influenciar outras pessoas.",
      atributos: [
        "intuicao"
      ]
    },
    {
      nome: "Botânica",
      descricao: "Habilidade de identificar, cultivar e utilizar plantas para diversos fins, como medicina, venenos ou alimentação. Inclui o conhecimento de ecossistemas e a capacidade de encontrar plantas raras.",
      atributos: [
        "intuicao"
      ]
    },
    {
      nome: "Caça",
      descricao: "Sempre que você quiser colher informações, seja através de relatos de pessoas comuns, outros caçadores de recompensas, procurando arquivos e documentos ou identificando padrões e hábitos de suas caças.",
      atributos: [
        "percepcao"
      ]
    },
    {
      nome: "Carpintaria",
      descricao: "Carpinteiros são hábeis não apenas em construir, mas também em reparar estruturas e objetos feitos em sua maior parte de madeira. Realizar trabalhos manuais com madeira em uma velocidade incrível é possível somente ...",
      atributos: [
        "intuicao"
      ]
    },
    {
      nome: "Ciências Proibidas",
      descricao: "Estudo de conhecimentos ocultos e perigosos, como magia negra, alquimia avançada e outras práticas proibidas. Inclui a capacidade de identificar e utilizar esses conhecimentos de forma segura.",
      atributos: [
        "intuicao"
      ]
    },
    {
      nome: "Cirurgia",
      descricao: "Você se torna apto a fazer tratamentos mais complexos, capazes de tratar tanto feridas profundas como doenças muito graves.",
      atributos: [
        "intuicao"
      ]
    },
    {
      nome: "Conhecimentos Gerais",
      descricao: "Quando você quiser realizar ações relacionadas a assuntos diversos como navegação e medicina.",
      atributos: [
        "intuicao"
      ]
    },
    {
      nome: "Costura",
      descricao: "Habilidade de criar e reparar roupas e tecidos. Inclui técnicas de costura, bordado e design de vestuário.",
      atributos: [
        "intuicao"
      ]
    },
    {
      nome: "Criação de Projéteis",
      descricao: "Possui facilidade na criação de projeteis de tipo variados de materiais.",
      atributos: [
        "percepcao",
        "intuicao"
      ]
    },
    {
      nome: "Criptografia",
      descricao: "Capacidade de criar e decifrar códigos e mensagens secretas. Inclui o conhecimento de técnicas de criptografia e a habilidade de proteger informações sensíveis.",
      atributos: [
        "intuicao"
      ]
    },
    {
      nome: "Culinária",
      descricao: "É uma arte que combina habilidades técnicas, criatividade e conhecimento para criar pratos incríveis e satisfatórios.",
      atributos: [
        "intuicao"
      ]
    },
    {
      nome: "Dança",
      descricao: "Você sabe dançar e encantar os outros por meio da sua dançar.",
      atributos: [
        "carisma"
      ]
    },
    {
      nome: "Disfarce",
      descricao: "Capacidade de alterar a aparência e comportamento para se passar por outra pessoa. Inclui técnicas de maquiagem, atuação e criação de identidades falsas.",
      atributos: [
        "intuicao",
        "percepcao"
      ]
    },
    {
      nome: "Engenharia",
      descricao: "Conhecimento técnico para projetar, construir e reparar máquinas, estruturas e dispositivos complexos. Inclui a capacidade de entender e criar planos detalhados.",
      atributos: [
        "intuicao"
      ]
    },
    {
      nome: "Falsificação",
      descricao: "Habilidade de criar cópias convincentes de documentos, assinaturas, e outros itens importantes. Inclui a capacidade de detectar falsificações feitas por outros.",
      atributos: [
        "percepcao",
        "intuicao"
      ]
    },
    {
      nome: "Física",
      descricao: "Compreensão das leis naturais que governam o movimento, energia e forças. Útil para criar dispositivos, entender fenômenos naturais e resolver problemas complexos.",
      atributos: [
        "intuicao"
      ]
    },
    {
      nome: "Flexibilidade",
      descricao: "Você é muito ágil e esguio, podendo fazer proezas nas quais pessoas acreditam que você não conseguiria fazer.",
      atributos: [
        "agilidade"
      ]
    },
    {
      nome: "Forja",
      descricao: "Habilidade de trabalhar com metais para criar armas, armaduras e outros itens metálicos. Inclui técnicas de aquecimento, moldagem e temperamento de metais.",
      atributos: [
        "forca",
        "intuicao"
      ]
    },
    {
      nome: "Furtividade",
      descricao: "Você pode desaparecer nas sombras, andar sem fazer barulho, sumir na multidão, seguir alguém sem ser notado.",
      atributos: [
        "agilidade",
        "espirito"
      ]
    },
    {
      nome: "Geografia",
      descricao: "Conhecimento sobre a disposição física do mundo, incluindo mapas, terrenos, climas e ecossistemas. Útil para navegação e planejamento de viagens.",
      atributos: [
        "intuicao"
      ]
    },
    {
      nome: "História Perdida",
      descricao: "Sempre que você lidar ou quiser decifrar escrituras antigas, línguas desconhecidas ou Poneglyphs.",
      atributos: [
        "intuicao"
      ]
    },
    {
      nome: "Ilusionismo",
      descricao: "Arte de criar ilusões visuais e auditivas para enganar ou entreter. Inclui truques de mágica e técnicas de distração.",
      atributos: [
        "percepcao",
        "intuicao"
      ]
    },
    {
      nome: "Instrumentos Musicais",
      descricao: "Habilidade de tocar e compor música usando diversos instrumentos. Inclui o conhecimento de teoria musical e técnicas de performance.",
      atributos: [
        "intuicao"
      ]
    },
    {
      nome: "Lógica",
      descricao: "Em suma, a lógica serve para se pensar corretamente.",
      atributos: [
        "intuicao"
      ]
    },
    {
      nome: "Marcenaria",
      descricao: "Você tem a habilidade de transformar madeira em um objeto útil ou decorativo. Você possui o dom da criatividade e saber desenhar em perspectiva, além de ter um vasto conhecimento do uso das ferramentas e materiais des...",
      atributos: [
        "intuicao"
      ]
    },
    {
      nome: "Mecânica",
      descricao: "Capacidade de entender, construir e reparar mecanismos e dispositivos mecânicos. Inclui o conhecimento de engrenagens, motores e sistemas de movimento.",
      atributos: [
        "intuicao"
      ]
    },
    {
      nome: "Medicina",
      descricao: "Sempre que você quiser diagnosticar uma doença, tratá-la, aliviar os efeitos de feridas brutais, procurar conhecimentos em livros e outras atividades relacionadas à saúde.",
      atributos: [
        "intuicao"
      ]
    },
    {
      nome: "Meteorologia",
      descricao: "Você sabe prever o clima nos dias ou momentos seguintes.",
      atributos: [
        "intuicao"
      ]
    },
    {
      nome: "Natação",
      descricao: "Você sabe nadar em todos os estilos possíveis, além de conseguir mergulhar com os equipamentos adequados e fazer apneia para prolongar o fôlego.",
      atributos: [
        "agilidade"
      ]
    },
    {
      nome: "Navegação",
      descricao: "Sempre que o navegador quiser realizar ações como achar uma direção ou caminho, criar mapas, entender mudanças climáticas repentinas, fazer previsões do tempo, escolher correntes marinhas ou velejar por tempestades. Além disso você sabe dizer onde está e em que direção deve seguir, além de conseguir ler mapas com precisão.",
      atributos: [
        "intuicao"
      ]
    },
    {
      nome: "Noção de Batalha",
      descricao: "Ao tentar se manter frio e observar tudo o que está acontecendo no campo de batalha, tentar adivinhar onde estão posicionados grupamentos inimigos, entender as estratégias dos seus adversários.",
      atributos: [
        "percepcao"
      ]
    },
    {
      nome: "Nutrição",
      descricao: "você reconhece todos os segredos para promover, recuperar e manter a saúde por meio da alimentação, tendo conhecimento sobre os nutrientes de cada alimento e sabendo identificar a qualidade dos mesmos. Não significa que você saiba cozinhar.",
      atributos: [
        "intuicao"
      ]
    },
    {
      nome: "Pesca",
      descricao: "Você sabe pegar peixes e outros animais aquáticos com linha e anzol, rede ou arpão.",
      atributos: [
        "percepcao"
      ]
    },
    {
      nome: "Pilotagem",
      descricao: "Você sabe os fundamentos para pilotar os veículos e por isso pode aprender rapidamente como manobrar qualquer um com um pouco de prática.",
      atributos: [
        "intuicao"
      ]
    },
    {
      nome: "Pintura",
      descricao: "Você sabe desenhar e pintar, criando bandeiras ou belos quadros que podem lhe render dinheiro.",
      atributos: [
        "intuicao"
      ]
    },
    {
      nome: "Prestidigitação",
      descricao: "Você pode fazer truques com pequenos objetos, fazendo sumir moedas, lenços e cartas de baralho como se fosse mágica.",
      atributos: [
        "espirito"
      ]
    },
    {
      nome: "Primeiros Socorros",
      descricao: "Você pode tratar de ferimentos, doenças e venenos.",
      atributos: [
        "intuicao"
      ]
    },
    {
      nome: "Química",
      descricao: "Habilidade de manipular substâncias químicas para criar poções, explosivos, venenos e outros compostos. Inclui o conhecimento de reações químicas e segurança no manuseio de materiais perigosos.",
      atributos: [
        "intuicao"
      ]
    },
    {
      nome: "Sedução",
      descricao: "Você sabe fingir sentimentos românticos com relação à vítima além de conseguir ser sensual e atrativo. É como lábia e intimidação, mas utiliza a sensualidade.",
      atributos: [
        "espirito"
      ]
    },
    {
      nome: "Toxicologia",
      descricao: "você tem conhecimento em venenos e conhece seus efeitos, sabendo como prepará-los e como neutralizá-los.",
      atributos: [
        "intuicao"
      ]
    },
    {
      nome: "Veterinária",
      descricao: "Você pode fazer diagnósticos, prestar primeiros socorros e fazer cirurgias em animais. Funciona como Medicina, mas apenas para animais.",
      atributos: [
        "intuicao"
      ]
    },
    {
      nome: "Zoologia",
      descricao: "Você consegue analisar os animais no que se refere à sua biologia, genética, fisiologia, anatomia, ecologia, geografia e evolução.",
      atributos: [
        "intuicao"
      ]
    }
  ],
  vantagens: [
    {
      nome: "Acrobata",
      descricao: "Desde pequeno, você sempre gostou de alturas e de se aventurar em situações perigosas, que dependiam totalmente das suas habilidades e equilíbrio, pode ter crescido em um circo e aprendido técnicas ou só tem predisposição para isso.",
      efeito: "Você recebe vantagem em Testes de Agilidade (Acrobacia)."
    },
    {
      nome: "Álter Ego Heroico",
      descricao: "Você possui uma identidade secreta, à sua escolha, que pode ser invocada sempre que estiver em perigo, desde que esteja com seus trajes de herói em mãos. Quando vestido de herói, deve proteger sua verdadeira identidade de todos.",
      efeito: "Enquanto vestido de herói, recebe vantagem em jogadas de Agilidade e é sempre o primeiro agir em uma batalha."
    },
    {
      nome: "Aparência Inofensiva",
      descricao: "Por algum motivo você não parece perigoso. Talvez pareça muito pequeno, muito fraco, uma menininha segurando um pirulito. Você escolhe o motivo. Além de outros benefícios, como não levantar suspeitas, possuir esta individualidade também ajuda em combates, pegando oponentes desprevenidos. O truque não funciona com ninguém que já tenha visto você lutar, e também não engana duas vezes a mesma pessoa.",
      efeito: "Recebe vantagem para acertar alguém que não desconfie de você, usando esta individualidade. Recebe vantagem em testes de furtividade."
    },
    {
      nome: "Armadura de Músculos",
      descricao: "Você dedicou incontáveis horas ao treino físico, moldando seu corpo como uma verdadeira fortaleza. Seja por natureza ou determinação, sua musculatura densa e resistente é capaz de absorver impactos impressionantes, tornando-o um adversário formidável.",
      efeito: "Você recebe vantagem em testes para resistir a debuffs físicos"
    },
    {
      nome: "Atleta",
      descricao: "Você sempre gostou de praticar esportes, sempre foi muito bom em qualquer um que se dispusesse a praticar e pode até ter certa fama em um esporte específico.",
      efeito: "Você recebe vantagem em Testes de Agilidade (Atletismo)."
    },
    {
      nome: "Audição Aguçada",
      descricao: "Possui uma audição sensível, capaz de perceber sons baixos e distantes, ou identificar de onde se originam.",
      efeito: "Você tem vantagem em Testes de Percepção relacionados à audição"
    },
    {
      nome: "Aura Assassina",
      descricao: "Você emana uma presença intimidadora, que não tem nada a ver com sua aparência física, seja por já ter matado incontáveis pessoas ou talvez por possuir uma grande fúria contida dentro de si.",
      efeito: "Você recebe vantagem em Teste de Espírito (Intimidação)."
    },
    {
      nome: "Beleza Natural",
      descricao: "O personagem nasceu com uma beleza chamativa. Mesmo sem o devido preparo, ele já é bonito suficiente para chamar atenção e conquistar olhares.",
      efeito: "Você tem vantagem em Testes de Carisma (Persuasão) em pessoas que possam te enxergar."
    },
    {
      nome: "Comandante Inato",
      descricao: "Você está sempre orientando seus companheiros e os preparando mentalmente, mesmo sem que eles percebam, porém, no menor sinal de ameaça, você consegue organizá-los rapidamente, de maneira que todos consigam se posicionar da melhor forma em um combate.",
      efeito: "Desde que você esteja presente, todos os seus aliados recebem Vantagem de Determinação. Você pode escolher a ordem de seus companheiros se eles permitirem."
    },
    {
      nome: "Controle de Multidões",
      descricao: "Você tem dom da palavra, e uma aura que desperta a confiança das massas.",
      efeito: "Este dom permite incitar revoltas, espalhar desconfianças, vender produtos ou discursar em público com uma margem de sucesso bem maior."
    },
    {
      nome: "Coragem",
      descricao: "Você é desprovido do medo convencional. Em situações críticas, onde a maioria das pessoas fugiriam apavoradas, você continua firme.",
      efeito: "Recebe vantagens em Testes de contra Espírito e Determinação(Intimidação)."
    },
    {
      nome: "Corpo Vigoroso",
      descricao: "Você nasceu com um corpo mais rígido e enérgico, suas feridas se curam mais rápido e seu corpo aguenta muito mais esforço e ferimentos que o normal.",
      efeito: "Você tem o extra de 100 de HP (Pode aumentar com pontos de proficiência)."
    },
    {
      nome: "Emotivo",
      descricao: "Você se sensibiliza facilmente com a dor dos outros e qualquer história triste o faz chorar. Isso faz com que sua interação seja mais fácil e que os outros sintam confiança em suas palavras e seus consolos.",
      efeito: "Recebe vantagem em Testes de Carisma para lidar com pessoas amigáveis."
    },
    {
      nome: "Faro Aguçado",
      descricao: "Você tem um olfato com sensores capazes de farejar o mínimo odor. Quando identifica o cheiro de algo ou alguém, consegue seguir seu rastro, mesmo a grandes distâncias e em meio a outros cheiros, mas pode perder o alvo caso este modifique seu cheiro ou algo externo apague os rastros, como chuvas pesadas ou cheiros muito mais fortes interferindo a busca.",
      efeito: "Você tem vantagem em Testes de Percepção relacionados ao olfato"
    },
    {
      nome: "Frieza",
      descricao: "Seu personagem possui um grande controle das emoções, mesmo que você perca um braço, seja insultado ou veja um amigo morrendo, consegue conter suas emoções e continuar a agir com racionalidade.",
      efeito: "Recebe vantagem em Testes contra Intuição (Provocação)."
    },
    {
      nome: "Homem das Neves",
      descricao: "O personagem é habituado à neve e ao gelo, sofre menos penalidades com temperaturas severamente baixas e conhecimento para se abrigar (fazer iglus) e proteger durante nevascas, ou pescar em lagos congelados.",
      efeito: "Neste terreno, o personagem recebe vantagem em todos os Testes de Resistência."
    },
    {
      nome: "Homem das Selvas",
      descricao: "O personagem sabe como sobreviver em uma floresta ou selva, evitando seus perigos naturais e extraindo dela o que precisa para sobreviver. Isso inclui habilidades de caça e pesca, subir em árvores, dentre outras.",
      efeito: "Neste terreno, o personagem recebe vantagem em todos os Testes de Resistência."
    },
    {
      nome: "Homem dos Mares",
      descricao: "O personagem é habituado ao mar, mas não como um pirata ou qualquer guerreiro. Ele foi um pescador, um ajudante, um marujo simples em alto-mar. Sofre menos ao lidar com tempestades, ondas, e outros efeitos climáticos que afetam os navios.",
      efeito: "Neste terreno, o personagem recebe vantagem em todos os Testes de Resistência, jogadas de acerto e dano e o período de descanso curto e longo são reduzidos pela metade."
    },
    {
      nome: "Imunidade",
      descricao: "Seu corpo resiste naturalmente aos microrganismos que provocam doenças. Você nunca pegará uma doença ou infecção “naturalmente”. Se você for inoculado à força, seu corpo fará o possível para expulsar os agentes o mais rápido possível.",
      efeito: "Você possui vantagens ao fazer Testes de Resistência contra doenças."
    },
    {
      nome: "Instintos Animais",
      descricao: "Talvez você tenha crescido em um local com culturas tribais ou em meio aos animais, talvez tenha combatido muitas feras, durante sua vida, ou só nasceu assim. O fato é que você se parece muito com um animal, às vezes, e têm instintos de sobrevivência aflorados.",
      efeito: "Sempre que uma criatura assumida como inimiga estiver no seu campo de visão, você pode fazer Teste de Intuição para saber se ele é mais fraco, igualmente forte ou mais forte que você."
    },
    {
      nome: "Invisibilidade",
      descricao: "Você pode ficar invisível, não literalmente, apenas tem uma presença sútil e calma. Fora de um combate, pode usar esta habilidade durante quanto tempo desejar contanto que permaneça praticamente imóvel.",
      efeito: "Você recebe vantagem em testes de furtividade e facilidade de se esconder."
    },
    {
      nome: "Lábia",
      descricao: "Você cria as histórias mais loucas e as pessoas acreditam. Capaz de convencer os demais de que o céu é de outra cor, apenas contando uma história, embora, nem todas as pessoas sejam idiotas.",
      efeito: "Você tem vantagem em teste de carisma para convencer outras pessoas ou fazerem falar sobre algo."
    },
    {
      nome: "Negativo",
      descricao: "Você é negativo por natureza, sempre é pessimista e sempre espera o pior. Quando algo dá errado, você simplesmente aceita. Por definição nada que alguém faça, diga ou mesmo habilidades de Akuma no Mi podem deixar você depressivo ou sem querer agir, pois, não tem como ficar pior do que já é.",
      efeito: "Você é imune às condições Apaixonado, Empoderado, Enfeitiçado, Enfurecido, Letárgico, Paralisado e Sonolento. Contudo essa é uma vantagem/desvantagem, pode ocorrer situações que você abaixa a moral do time."
    },
    {
      nome: "Olhos de Águia",
      descricao: "Você possui olhos que não podem ser enganados e que enxergam perfeitamente até onde sua vista alcança podendo ler e identificar mesmo as menores letras e símbolos.",
      efeito: "Você tem vantagem em Testes de Percepção relacionados à visão."
    },
    {
      nome: "Preparação Para a Batalha",
      descricao: "Você precisa de um pequeno ritual para conseguir extrair o ápice da sua determinação em um combate.",
      efeito: "Usando uma ação simples ou bônus para reproduzir uma mania (colocar uma bandana, acender um cigarro, arregaçar as mangas e etc.), durante os próximos dois turnos você recebe uma quantia de pontos no seu principal status, no número não é fixo e pode ser melhorado."
    },
    {
      nome: "Recuperação Espantosa",
      descricao: "O personagem possui uma recuperação fora do normal, seja para dores ou para fadiga. Enquanto uma pessoa normal estaria de cama, recuperando-se de uma batalha, você já está ativo e pronto para a próxima.",
      efeito: "Em certas situações de você desmaiar(ou outras situações que te deixaram incapacitado) em batalha, depois de poucos turnos(Depende do que causou) você recupera uma quantidade não fixa de vida e acorda podendo voltar para batalha ou fazer outra, contudo só funciona uma vez por batalha."
    },
    {
      nome: "Resistência a Venenos",
      descricao: "Em algum momento de sua vida, o personagem foi exposto a venenos perigosos e se recuperou, criando anticorpos para combatê-lo. Graças a isso, ele possui uma resistência maior a venenos, porém não é totalmente imune, podendo apresentar sintomas reduzidos ou parciais para venenos fortes.",
      efeito: "Você possui vantagem em Testes de Resistência contra venenos."
    },
    {
      nome: "Resistência ao Álcool",
      descricao: "Por algum motivo você adquiriu uma resistência maior ao álcool do que pessoas normais, podendo resistir aos efeitos da embriaguez.",
      efeito: "Você tem vantagem em Testes de Resistência contra a condição “Bêbado”."
    },
    {
      nome: "Sensitivo",
      descricao: "Seu personagem possui grande intuição, uma sensibilidade extrema que lhe permite saber sobre coisas mesmo sem ter acesso a informações sobre elas. Isso tem mais a ver com empatia entre seres vivos e racionais.",
      efeito: "Recebe vantagem em todos os Testes de Intuição"
    },
    {
      nome: "Senso de Direção Impecável",
      descricao: "Você possui uma bússola no cérebro. Nunca se perde, mesmo em labirintos ou castelos, sabe sempre de que lado fica o norte e de onde você veio.",
      efeito: ""
    }
  ],
  desvantagens: [
    {
      nome: "Amnésia",
      descricao: "Você simplesmente não consegue guardar informação por muito tempo, mesmo que sejam coisas bobas ou muito importantes. Pode até esquecer que perdeu um braço.",
      efeito: "Você tem desvantagem em Testes de Inteligência e Determinação."
    },
    {
      nome: "Analfabeto",
      descricao: "Você não foi devidamente alfabetizado na sua infância e não consegue ler absolutamente nada, o que pode vir a se tornar inconveniente em muitas situações, felizmente sempre é possível aprender a ler e escrever, independente da sua idade.",
      efeito: "(Você é incapaz de Ler)"
    },
    {
      nome: "Audição Ruim",
      descricao: "Sua audição é reduzida por um defeito genético, sequela de uma batalha ou algum outro motivo.",
      efeito: "Você tem desvantagem em Testes de Percepção que envolvam a Audição."
    },
    {
      nome: "Cego",
      descricao: "Você não enxerga. O personagem compensa a perda da visão, tornando-se mais sensível aos outros estímulos sensoriais. Mas as imagens e as pistas visuais lhes passam desapercebidas.",
      efeito: "(Sua percepção é zerada e você se torna incapaz de ver)"
    },
    {
      nome: "Churriado",
      descricao: "Você tem muitos pontos positivos, mas a força física certamente não é uma delas, e por mais que você invista seu tempo em treinar seu corpo, para aumentar sua força física, o resultado vai acabar sendo só uma aparência melhor.",
      efeito: "(Você tem desvantagem em Testes de Força e Resistência)"
    },
    {
      nome: "Cleptomaníaco",
      descricao: "Você rouba coisas de que não precisa, não por seu valor, apenas por serem interessantes. Sempre que surgir a chance de roubar algo, você irá roubar. Um cleptomaníaco nunca devolve para os donos o produto de seus roubos, e lutará para evitar que isso aconteça.",
      efeito: ""
    },
    {
      nome: "Compulsivo",
      descricao: "Existe algo que você precisa fazer constantemente e que lhe traz alguma gratificação emocional, normalmente um alívio de ansiedade e/ou angústia. São hábitos mal adaptativos que já foram executados inúmeras vezes e acontecem quase automaticamente. É comum que haja um \"gatilho\" ou situações que tragam sua compulsão à tona.",
      efeito: ""
    },
    {
      nome: "Condição Rara(Doença das Trevas)",
      descricao: "-",
      efeito: "-"
    },
    {
      nome: "Convencido",
      descricao: "Seu tópico de conversação favorito é você mesmo. Você sempre tenta levar todas as conversas para o tópico das suas conquistas e sucessos, e nunca falha em tentar receber o crédito por qualquer coisa com a qual esteja remotamente relacionado. Você não consegue evitar lembrar de seus feitos.",
      efeito: ""
    },
    {
      nome: "Coração Mole",
      descricao: "Você não aguenta ver os outros sofrerem e evita qualquer situação que implique em causar dor física ou emocional em alguém que não mereça ou não possa se defender.",
      efeito: "(Suas jogadas de ataque contra criaturas que possam te causar empatia recebem Desvantagem)"
    },
    {
      nome: "Curioso",
      descricao: "Você simplesmente é curioso demais em um assunto específico, sempre que algo te chama atenção sobre ele, você sente uma vontade incontrolável para descobrir tudo que pode sobre o assunto, muitas vezes deixando para trás o seu bom senso.",
      efeito: ""
    },
    {
      nome: "Demente",
      descricao: "Sua inteligência e capacidade de aprendizado são reduzidas. Por conta disso, não consegue aprender nada sozinho.",
      efeito: "Você só consegue fazer treinamentos se houver um tutor para te ensinar, mesmo que o treinamento não especifique isso."
    },
    {
      nome: "Dependente",
      descricao: "Você se sente totalmente inseguro quando não tem seus companheiros para te ajudar ou proteger, pode ser por medo, insegurança ou por sempre querer se mostrar.",
      efeito: "Enquanto não estiver com nenhum companheiro ou criatura que esteja cooperando contigo, dentro do seu raio de visão, você recebe Desvantagem em todas as suas jogadas."
    },
    {
      nome: "Distraído",
      descricao: "Você tem dificuldade para se concentrar em alguma coisa. Consequentemente, seu personagem geralmente não possui o conhecimento necessário em várias situações.",
      efeito: ""
    },
    {
      nome: "Dívida de Jogo",
      descricao: "Você deve uma quantidade absurda de dinheiro para uma ou várias personalidades muito poderosas e influentes, essa quantia é algo que você talvez nunca consiga pagar, além disso, os esforços de tentar passar seus credores para trás só aumentam a vontade de tentarem te pegar.",
      efeito: "Independentemente de onde você esteja, você nunca está seguro e a qualquer momento podem surgir empregados e contratados dos seus credores para tentar te capturar."
    },
    {
      nome: "Falta de Sorte",
      descricao: "A vida parece sempre querer rir da sua cara, não importa o quanto você tente e se prepare, alguma coisa sempre acaba dando errada.",
      efeito: "O Mestre pode transformar um Teste bem sucedido em uma falha, esse sucesso pode ser sua ou de qualquer outro, desde que seja para atrapalhar sua vida."
    },
    {
      nome: "Fantasioso",
      descricao: "Você acredita ser alguém ou alguma coisa que não é, ou acha que pode fazer alguma coisa de que não é capaz. Fantasias são sustentadas pelas convicções do personagem, portanto não é uma boa ideia tentar o contrariar.",
      efeito: "Sempre que alguém for contrário ou não acreditar na sua fantasia, você recebe a condição “Enfurecido” e ataca a criatura que discordou da sua fantasia."
    },
    {
      nome: "Fúria Incontrolável",
      descricao: "Tudo é capaz de te irritar e provocar sua fúria, desde ataques que te causem dor até uma provocação infantil e que seja obviamente uma armadilha.",
      efeito: "Você recebe desvantagem em Testes de Intuição contra Testes de Habilidade de Espírito/Intuição (Provocação) e não pode ser acalmado."
    },
    {
      nome: "Ganancioso",
      descricao: "Você realmente ama dinheiro, talvez, o motivo que lhe fez partir para se aventurar nos mares. Sempre que alguém falar de formas de ganhar quantidades consideráveis de dinheiro, por um pedido, uma missão ou revelando a localização de um tesouro escondido, você não consegue resistir, caso perca a oportunidade, você é acometido por uma grande depressão.",
      efeito: ""
    },
    {
      nome: "Ignorante",
      descricao: "Você acha que já possui quase todo o conhecimento necessário para atingir seus objetivos e, para o conhecimento que não tem, é só percorrer um caminho único, para você, outros conhecimentos são perda de tempo.",
      efeito: "-"
    },
    {
      nome: "Impulsivo",
      descricao: "Devido à sua natureza impulsiva, você frequentemente toma decisões rápidas e sem pensar nas consequências. Isso pode levar a situações perigosas ou desfavoráveis, tanto para você quanto para seus companheiros. Sua impaciência e tendência a agir por instinto podem resultar em erros críticos em momentos importantes.",
      efeito: "-"
    },
    {
      nome: "Ingênuo",
      descricao: "Talvez faltem alguns parafusos na sua cabeça, ou talvez você jamais tenha aprendido a separar a realidade da ficção. Não importa por que, você é extremamente vulnerável a mentiras sutis e meias-verdades.",
      efeito: ""
    },
    {
      nome: "Linhagem Demoníaca",
      descricao: "Você é filho ou descendente de qualquer grau de uma figura, conhecida em todo o mundo, considerada execrável por uma grande parte da sociedade e, talvez, até maioria. Quando àqueles que odeiam essa pessoa descobrem sua relação com ela, eles transmitem todo esse ódio para você.",
      efeito: "Você recebe preconceito severo de qualquer pessoa que odeie o seu antepassado"
    },
    {
      nome: "Má Fama",
      descricao: "Você é infame. Talvez você tenha fracassado em alguma missão importante, foi derrotado ou humilhado publicamente, é um ex-criminoso tentando se regenerar. Por algum motivo, ninguém acredita ou confia em você, além de terem grandes suspeitas sobre seus atos, seja de forma merecida ou não. Ao escolher este defeito, você pode definir uma alcunha inicial, com aprovação do Mestre.",
      efeito: "(Você recebe Desvantagem em Testes de Habilidade de Carisma -Persuasão- )"
    },
    {
      nome: "Medroso",
      descricao: "O medo é seu companheiro constante, qualquer coisa possivelmente assustadora o impressiona e faz com que esbugalhe os olhos e grite, mesmo que você seja capaz de fazer o mesmo ou até superar ou que a criatura seja mais fraca que você.",
      efeito: "Você é sempre o último a agir."
    },
    {
      nome: "Mentiroso",
      descricao: "Você sempre tenta se sobressair com suas mentiras, sempre que tiver a oportunidade de parecer melhor do que você realmente é, não há hesitação, mesmo que faça com que um oponente mais poderoso se interesse em tirar sua vida. Chega a mentir tanto que começa a ser desacreditado.",
      efeito: "Você recebe Desvantagem em Testes de Carisma (Enganação)."
    },
    {
      nome: "Monstruoso",
      descricao: "Sua aparência é repulsiva e assustadora. Você não pode sair pelas ruas como gente normal; as pessoas ficarão assustadas ou furiosas. Todos que possuem esta desvantagem, podem esconder sua monstruosidade com roupas adequadas.",
      efeito: "Você recebe preconceito Severo."
    },
    {
      nome: "Mudo",
      descricao: "Um personagem mudo é incapaz de produzir fala, sendo preciso recorrer a outros meios para se comunicar, como a língua de sinais.",
      efeito: "Você falha automaticamente em ações que dependam da fala."
    },
    {
      nome: "Narcisista",
      descricao: "Você ama a si mesmo e está sempre cuidando da própria aparência com grande afinco. Sua aparência reflete no desempenho de suas performances, caso não esteja arrumado e se sentindo belo ou esteja sujo, mesmo as batalhas não serão travadas com grande vontade.",
      efeito: "-"
    },
    {
      nome: "Orgulho Cego",
      descricao: "Você é incapaz de ignorar provocações e insultos de qualquer tipo direcionados a você, seus companheiros ou entes queridos, independentemente do quão a situação seja inapropriada para isso, podendo partir para a violência caso fique muito irritado.",
      efeito: "-"
    },
    {
      nome: "Paranoico",
      descricao: "Você não confia em ninguém, nem em seus amigos. Nunca pede e nem aceita nenhuma ajuda, nem mesmo o tratamento de seus ferimentos. Não consegue descansar ou dormir direito: mesmo que esteja em uma estalagem ou outro lugar que parece ser totalmente seguro.",
      efeito: "Você precisa de um tempo para se acalmar e achar que está tudo certo, para começar um descanso curto ou longo."
    },
    {
      nome: "Rosto Debochado",
      descricao: "Sua cara incita o ódio e parece que sempre está fazendo graça às custas de todo mundo.",
      efeito: "(Sempre que um combate se iniciar, quando não fizer diferença para as criaturas inimigas qual alvo escolher, elas sempre escolherão você)"
    },
    {
      nome: "Rude e Arrogante",
      descricao: "Você se considera superior aos outros e tem pouca paciência para quem não corresponde às suas expectativas. Fala de maneira ríspida, interrompe explicações e faz críticas sem se preocupar com o constrangimento que provoca. Reconhecer os próprios erros fere seu orgulho, enquanto receber ordens ou ser corrigido costuma despertar seu desprezo. Mesmo quando pretende ajudar, sua postura transforma conselhos em insultos e afasta pessoas que poderiam estar ao seu lado.",
      efeito: "Você sofre penalidade em testes sociais que dependam de cordialidade, diplomacia ou de conquistar a simpatia de alguém. Ao ser contrariado, corrigido ou ter sua autoridade questionada, deve realizar um teste de Determinação para conter uma resposta grosseira ou desdenhosa. Em caso de falha, sua reação causa atrito e pode comprometer negociações ou a disposição dos envolvidos em ajudá-lo."
    },
    {
      nome: "Sedutor Incorrigível",
      descricao: "Você não consegue resistir a fazer tentativas casuais para seduzir qualquer um que encaixe em seus critérios de parceiro sexual, mesmo que você possa não querer ter um relacionamento sério (ou qualquer relacionamento). Porém isso não significa que você é um bom sedutor.",
      efeito: "(Enquanto estiver na presença de seu interesse amoroso, você não consegue se concentrar)"
    },
    {
      nome: "Senso de Direção Ruim",
      descricao: "Você é tão ruim com senso de direção que pode se perder em um corredor sem portas ou janelas e não importa se seus amigos estiverem de olho em você, no primeiro deslize, você some da vista deles, como mágica.",
      efeito: "-"
    },
    {
      nome: "Sinceridade Excessiva",
      descricao: "Você é incapaz de mentir, seja por valores morais ou simplesmente dificuldade em ocultar a verdade. E por mais que você se esforce para contar uma mentira, sempre será óbvio que não se trata da verdade.",
      efeito: "-"
    },
    {
      nome: "Sonâmbulo",
      descricao: "Você pode começar a andar e falar enquanto dorme. Você pode até lutar e agir como se estivesse consciente, mas acorda se sofrer qualquer dano e não se lembra de nada que tenha acontecido enquanto estava sonâmbulo.",
      efeito: "Ao final de cada descanso, você deve fazer um Teste de resistência para saber se conseguiu descansar. Em caso de falha, você não se beneficia de nenhuma característica de um descanso longo."
    },
    {
      nome: "Sonolência",
      descricao: "Por algum motivo você está sempre com sono, não importa se dormiu normalmente no dia anterior ou se acabou de dormir. Em qualquer momento, exceto, talvez, durante batalhas, você pode cair no sono.",
      efeito: ""
    },
    {
      nome: "Sósia",
      descricao: "Você é parecido com a descrição de outra pessoa, o que causa a confusão de identidades. Isso pode provocar inúmeras situações desagradáveis, ou mesmo perigosas, principalmente se o seu \"outro eu\" tiver péssima reputação ou estiver sendo procurado por algum crime.",
      efeito: ""
    },
    {
      nome: "Suicida",
      descricao: "Você não dá valor à própria vida. Embora não tenha coragem para se matar, sempre procura oportunidades de morrer desafiando inimigos poderosos, correndo riscos desnecessários ou fazendo coisas de forma impensada.",
      efeito: ""
    },
    {
      nome: "Surdo",
      descricao: "Você é totalmente surdo, incapaz de ouvir qualquer som. Isso pode ter ocorrido por um acidente, um ferimento antigo ou você nasceu assim.",
      efeito: "Você falha automaticamente em Testes de Percepção que dependam da audição."
    },
    {
      nome: "Timidez",
      descricao: "Você sente uma dificuldade enorme em lidar com pessoas, mesmo que você seja amigo delas, e tenta evitar situações sociais sempre que possível.",
      efeito: "Você recebe Desvantagem em Testes de Carisma (Atuação)."
    },
    {
      nome: "Trapalhão",
      descricao: "Sempre que você se move, sai esbarrando em tudo pela sua frente ou tropeça no nada, não consegue carregar qualquer coisa sem que tudo acabe no chão.",
      efeito: ""
    },
    {
      nome: "Trauma Profundo/Fobia",
      descricao: "Em seu passado você passou por uma situação traumática irrecuperável, desde uma perda terrível, ter sofrido agressões ou qualquer evento negativamente marcante.",
      efeito: "(Toda vez que você se depara com uma situação semelhante ou possui um gatilho que traga suas memórias à tona, você é tomado por perturbações nítidas que pode te impedir de realizar ações ou comprometer sua concentração, devendo fazer um Teste de Espirito, se passar no Teste, você supera momentaneamente o trauma, se falhar, todos os seus Testes passam a ter Desvantagem por um turno.)"
    },
    {
      nome: "Vício",
      descricao: "Você é viciado em alguma substância que precisa estar presente no seu sangue. Desde álcool, nicotina, açúcar, drogas ilícitas, alimentos comuns ou compostos mais simples.",
      efeito: ""
    },
    {
      nome: "Visão Ruim",
      descricao: "Você tem uma visão defeituosa devido a um problema incorrigível, por exemplo, ser caolho, míope ou enxergar mal por algum outro motivo, você pode usar óculos para corrigir, mas quando o deixa cair ou o perde, a dificuldade de enxergar é clara.",
      efeito: "Você tem desvantagem em Testes de Percepção."
    },
    {
      nome: "Voz Fina",
      descricao: "Você possui uma voz tão fina que chega a ser engraçada e não importa o quanto tente engrossar ou disfarçar e também não importa o seu tamanho ou aparência, nada impede que quem ouça sua voz ache a engraçada.",
      efeito: "Você tem desvantagem em Testes de Espírito (Intimidação) com criaturas que possam te ouvir."
    }
  ],
  racas: [
    {
      nome: "Humano",
      descricao: "Os Humanos são a raça dominante no mundo, já que superam a maioria das outras raças, e estão geralmente entre as mais avançadas e organizadas tecnologicamente. A maioria das ilhas é habitada por seres humanos, mesmo na Grand Line, onde a maioria das raças mais fortes, como os Homens-Peixes e os ogros, são encontradas."
    },
    {
      nome: "Skypean",
      descricao: "Skypieans treinam seus cabelos para crescer como a antena de um inseto desde jovem. Seu estilo de asa é muito diferente dos Birkans, com estilo mais próximo das asas de Shandia. Suas asas tendem a ter penas mais curtas que são um pouco menos numerosas que as de um Shandia, muitas vezes essas penas são mais grossas e arredondadas. Eles estão tão próximos que às vezes as asas parecem idênticas. No entanto, a principal diferença entre Shandia e Skypieans é que os Skypieans costumam ter tons de pele mais claros. Eles usam trajes civis mais simples do que os Shandia e Birkans."
    },
    {
      nome: "Tritão",
      descricao: "Os homens-peixes são mais parecidos com peixes do que tritões, geralmente parecendo uma combinação entre um homem e um peixe ou outra criatura aquática. Eles também têm brânquias entre os ombros e o pescoço, às vezes cobertos por suas roupas, além de muitas vezes terem mãos palmadas. Dependendo da espécie, eles podem ter vários membros (principalmente braços extras). O tamanho também pode diferir muito entre os indivíduos."
    },
    {
      nome: "Lunariano",
      descricao: "Normalmente, humanos comuns desconhecem totalmente a existência de um lunariano. Mas ainda existem aqueles com maior conhecimento e que já ouviram histórias ou lendas sobre, junto com a informação de uma grande recompensa, dada pelo governo, por pistas de onde encontrar um."
    },
    {
      nome: "Ogro",
      descricao: "A Tribo Oni é uma raça de gigantes que têm características demoníacas. Embora estejam quase extintos hoje, durante o Século Vazio, eles vagaram pelos mares como guerreiros da destruição em massa. Por esta razão, eles ganharam o epíteto, Gigantes antigos."
    },
    {
      nome: "Mink",
      descricao: "Os Minks são uma raça distinta e notável que habita a ilha de Zou. Eles possuem características físicas únicas que os diferenciam das outras raças do mundo, eles têm uma ampla gama de aparências físicas, mas geralmente compartilham traços animais em sua anatomia. Sua pelagem ou pele pode variar em cores e padrões, correspondendo à espécie animal da qual descendem."
    }
  ],
  oficios: [
    {
      nome: "Arqueólogo",
      descricao: "Estuda as sociedades, podendo ser tanto as que ainda existem, quanto as já extintas, através de seus restos materiais. Possui facilidade para aprender línguas novas, conhece e entende sobre praticamente todos os assuntos relacionados a historia e a línguas mortas ou esquecidas, juntamente com o fato de poder identificar idade e talvez o próprio nome de um artefato antigo, além de seu preço.\n\n**Perícias Relacionadas:**\nHistória Perdida\nCriptografia\nGeografia\nCiências Proibidas"
    },
    {
      nome: "Artista",
      descricao: "É um personagem dotado de habilidades, artísticas e teatrais, sua função à primeira vista é divertir as pessoas. O artista consiste de várias facetas, ele pode ser tanto um palhaço como um malabarista ou um ator. Faz gracejos, momices, pilhérias e trejeitos, combinados com malabarismos, para divertir o público ou como um dramaturgo para faze-lo chorar. Também pode cantar, dançar, pintar, fotografar ou até mesmo expressar sua arte em belas roupas.\n\n**Perícias Relacionadas:**\nAcrobacia\nAtuação\nCostura\nDança\nIlusionismo\nInstrumentos Musicais\nPintura\nDisfarce"
    },
    {
      nome: "Carpinteiro",
      descricao: "O carpinteiro executa os mais diversos trabalhos em madeira, desde móveis, ferramentas, artigos para construção civil, construção naval, entre outros. É o único com habilidade e conhecimento suficiente para concertar, construir e criar as mais variadas engenhocas envolvendo madeira, prego e etc... Deve ter noções de geometria e um vasto conhecimento de como lidar com madeira no seu estado natural (madeira maciça), o que o diferencia da marcenaria.\n\n**Perícias Relacionadas:**\nArrombamento\nCarpintaria\nMarcenaria\nEngenharia(Voltado para madeira)"
    },
    {
      nome: "Cientista",
      descricao: "São as pessoas focadas em adquirir e transmitir conhecimento. Através dos diversos âmbitos da ciência, estes personagens se esforçam para tornar a vida mais confortável, as armas mais potentes, os navios mais modernos e qualquer campo em que a ciência possa ser aplicada para agregar uma funcionalidade adicional. Por esta razão, cientistas são extremamente versáteis e se adaptam muito bem aos outros domínios, uma vez que sua necessidade pelo saber é insaciável e precisam estar sempre adquirindo mais conhecimento, ou seja, é possível que um ferreiro e um cientista trabalhem em conjunto para confeccionar um ciborgue, ou colaborar com um médico para criar remédios ou substâncias diferenciadas, sem que os dois necessariamente tenham entendimento pleno das áreas alheias ou ofícios especiais.\n\n**Perícias Relacionadas:**\nBotânica\nCiências Proibidas\nFísica\nQuímica\nZoologia"
    },
    {
      nome: "Cozinheiro",
      descricao: "É o responsável por elaborar os pratos e cuidar da cozinha do navio, sendo o único capaz de elaborar refeições, completas e saborosas em pouquíssimo tempo e com quase qualquer ingrediente a sua mão. Afinal, uma dieta equilibrada e saborosa é tão necessária dentro de um navio quanto as velas do mastro, pois é ela que manterá os tripulantes do navio fortes e saudáveis.\n\n**Perícias Relacionadas:**\nCulinária\nNutrição\nPesca\nBotânica\nToxicologia"
    },
    {
      nome: "Ferreiro",
      descricao: "O ferreiro é uma pessoa que cria objetos de ferro ou aço por “forjar” o metal, para criar armas como espadas, bastões, rifles, balas e etc. Ferreiro é uma profissão muito interessante, pois você pode criar armas excepcionais usando metais, pedras raras e até mesmo couro, invadindo um pouco do espaço do artesão, para poder criar objetos mortíferos de diversas formas diferentes. Além de balas estranhas, por exemplo, balas de veneno. O resultado é claro dependerá de sua experiência e da matéria-prima que ele tiver em mãos.\n\n**Perícias Relacionadas:**\nCostura\nEngenharia\nCriação de Projéteis\nForja\nMecânica"
    },
    {
      nome: "Gatuno",
      descricao: "Personagens desse ofício vivem no melhor estilo que o seu dinheiro (ou o dos outros) pode comprar, e fazendo o menor esforço possível. É um ladrão e larápio que tenta conseguir dinheiro passando a perna nos outros. Ele tem que ser muito rápido e certeiro (agilidade e destreza) para invadir lugares ou roubar as pessoas sem ser detectado, ou ter um alto carisma para “pescar” suas vítimas. Geralmente possuem conexões e maiores conhecimentos do submundo do crime, encontrando locais que vendam coisas “interessantes” mais facilmente que seus colegas.\n\n**Perícias Relacionadas:**\nArrombamento\nDisfarce\nFalsificação\nFurtividade"
    },
    {
      nome: "Médico",
      descricao: "Ele se ocupa da saúde humana e/ou animal, prevenindo, diagnosticando e curando as doenças, o que requer conhecimento detalhado de disciplinas acadêmicas (como anatomia e fisiologia) por detrás das doenças e do tratamento. A diferença entre os dois é mais funcional, pois o medico utiliza poções e conhecimentos sobre medicina, para salvar os seus pacientes, eles tendem a abandonar o lado espiritual do mundo se pregando somente a esses conhecimentos. Enquanto o curandeiro usa ervas e rituais religiosos (quase mágicos) para auxilia-lo. Os médicos se dão bem na maioria das culturas exceto as menos desenvolvidas e religiosas, já os curandeiros são o o oposto disso. Então se por acaso escolher essa profissão, deve optar na ficha pelo termo Medico ou Curandeiro, não poderá escolher os dois.\n\n**Perícias Relacionadas:**\nBotânica\nCirurgia\nNutrição\nPrimeiros Socorros\nToxicologia\nVeterinária\nMedicina"
    },
    {
      nome: "Curandeiro"
    },
    {
      nome: "Navegador",
      descricao: "É aquele que domina a ciência, arte, ou prática de planejar e executar uma viagem de um ponto de partida até seu ponto de destino. Consegue prever com grandiosa precisão sobre os aspectos climáticos do momento, e como se localizar com precisão no mar usando somente a bússola e um mapa. A figura do navegador é indispensável para qualquer tripulação.\n\n**Perícias Relacionadas:**\nGeografia\nMeteorologia\nNavegação\nPilotagem"
    }
  ]
}
