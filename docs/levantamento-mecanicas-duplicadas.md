# Levantamento: coisas que representam a mesma mecânica

Pedido do dono: "levantamento de duas coisas que representam a mesma mecânica". Nasceu de um caso concreto: as balas existem 2 vezes ("Tipos de bala" na ficha, com quantidade que não desconta, e o item Bala de Prata do Acervo).

- Data: 25/11/2026. Quatro relatórios, um por ângulo: itens/ficha/loja, batalha, mapa/cena/visão, personagens/mestre/Lobby.
- É só leitura do código. Nada foi testado no app. "Certeza" abaixo é a confiança de quem leu o código, não prova em jogo.
- Resultado: 33 achados mais as balas (linha 0). Gravidade: 7 Alta, 17 Média, 9 Baixa.
- Nenhum código foi alterado por este levantamento.
- Decisões já tomadas para as balas: (1) fonte única = item na mochila; (2) converter sozinho os "Tipos de bala" das fichas; (3) dano automático, efeito como lembrete; (4) "Balas" = Munição.

## Os padrões por trás

Os 33 achados se repetem em poucas causas. Entre parênteses, o Nº da tabela.

- **Cópia feita uma vez que nunca mais acompanha a fonte** (2, 11, 13, 24, 29, 32; 28 liga só pelo nome). O preço da banca, a vaga da mochila, o nome e a foto do token, a peça da estante são copiados quando nascem. Se o original muda depois, a cópia fica velha. Só efeito e requisitos do item seguem o Acervo.
- **Posse em dois lugares** (0, 1, 5, 8, 10, 23). O cartão da ficha guarda uma coisa e a mochila guarda a mesma coisa: balas, arma, kit médico, itens antigos da aba Itens, inventário do Dragon Ball, mochila e moedas no boneco x na ficha. Um lado muda e o outro não acompanha.
- **Regra que só entende uma forma** (6, 7, 18, 19, 20, 25, 26). Chão: peça x Sala x textura x desenho cheio; cada regra reconhece só algumas dessas formas. Escuro: tema x período x Cena escura x Sala escura. "Oculto para jogadores" vale para Sala, não para Região.
- **Dois juízes, dois caminhos para a mesma ação** (3, 4, 9, 14, 16, 17). Condição: selo da batalha x pastilha do token. Dano: ajuste da ficha x batalha. "Usar": efeito do item x palpite pelo nome. Edição da ficha: validador do Lobby x rede local. Mira: Mesa x menu da vez. Aliado no Dragon Ball: lado do combatente x equipes.
- **Vários sistemas para a mesma ideia** (12, 15, 21, 22, 31). Luz do item x luz presa no token; forma na ficha x forma no token; de quem é o personagem em 6 campos; 4 jeitos de dar texto para ler; 5+ sistemas de pastas.
- Sem padrão: 27 (aura só no token), 30 (de propósito), 33 (campo interno sem uso).

## Tabela principal

Como ler:
- Gravidade: quando o relatório deu nota intermediária (ex.: ALTA-MÉDIA), vale o primeiro nível; a nota original está em "Detalhes técnicos". Quando dois relatórios divergem, vale o mais alto.
- Ordem: por gravidade e, dentro dela, pelo impacto no jogo (número cobrado ou mostrado errado vem antes de vazamento visual e de regra de mapa).
- "Não indicada" em Fonte única: o relatório não disse qual lado deve vencer. "Não informada" em Certeza: o relatório não deu certeza.

| Nº | Gravidade | O que está duplicado | O que você vê na mesa | Fonte única sugerida | Certeza |
|---|---|---|---|---|---|
| 0 | Já decidida | Balas: "Tipos de bala" no cartão da arma da ficha x item de Munição na mochila (ex.: Bala de Prata do Acervo) | A ficha mostra uma quantidade de bala que não desconta; a Bala de Prata é um item à parte, na mochila | Item na mochila (decidido) | Decidida |
| 1 | Alta | Item gasto por técnica (ex.: Kit Médico da Medicina): contador de usos da batalha x quantidade na mochila | O registro diz "gastou 1 Kit Médico", mas a mochila não muda; no fim da batalha os kits voltam. Já o item exigido nos requisitos e o "Usar" tiram de verdade | Mochila (gastarItemNaMesa). Mesmo padrão das balas | Alta |
| 2 | Alta | Preço da loja: texto da banca (LojaItem.preco) x preço do Acervo copiado na hora da escolha | O jogador vê o texto da banca, mas paga o valor do Acervo. Mestre muda para "5": cobra o do Acervo. "3 moedas" digitado: não cobra. Mudar no Acervo: não chega à banca | Número do Acervo | Alta |
| 3 | Alta | Condição: selo da batalha x pastilha com prazo no token (a ponte só vai da batalha para a pastilha) | Atordoado posto à mão não trava a vez. Sangrando/Queimando: o selo pede Aplicar ou pular, a pastilha tira vida sozinha, e as contagens diferem. Limpar na batalha tira só o selo; fora dela apaga a pastilha; a cura só tira Envenenado | Selo (da batalha) | Alta |
| 4 | Alta | Dano e cura: ajuste rápido na ficha (ex.: "-50") x "Dar dano", "Me dar dano", "Ajustar..." da batalha | O mesmo -50 dá resultado diferente. Na ficha mexe direto no número: sem Escudo, sem redução, sem registro, sem Desfazer, sem lembrete de vida baixa, sem acumulador, sem queda | Batalha | Média-alta |
| 5 | Alta | Dragon Ball: inventário da ficha (com carga e "equipado" que soma CA) x "Mochila do token", na mesma aba | Armadura dada ou comprada não soma CA nem carga. Item que vem do acervo, do livro ou do Lobby cai na mochila, e só o inventário da ficha conta | Mochila (Personagem.mochila). O relatório 1 diz "provável" | Alta |
| 6 | Alta | O que é "chão" no terreno alto: desenho cheio (Balde do Pincel) x peça e textura | Andar de cima feito com Pincel ou Balde vira céu aberto: fichas de cima vazam (varanda, pátio sem parede) e quem está em cima vê o andar de baixo pelo próprio chão | Não indicada. Pista: a textura já trata o desenho cheio como chão | Alta |
| 7 | Alta | "Oculto para jogadores": vale para Sala x não vale para Região comum | Marcar uma Região como oculta esconde só o desenho; fichas, objetos, chão e luzes de dentro continuam indo ao jogador | Não indicada. Falta decidir se vale para Região ou só Sala | Alta no código; média se é intencional |
| 8 | Média | Arma: cartão da aba Armas da ficha x arma da mochila | Arma vendida, dada ou largada continua no Atacar; arma com nomes diferentes aparece 2 vezes | Posse na mochila; regra no livro (ARMAS-FONTE-UNICA.md) | Alta no código |
| 9 | Média | "Usar" fora da batalha: efeito cadastrado no item x palpite pelo nome | Item sem efeito cai num palpite: gasta 1 e só tira Envenenado. "Poção — Cura 2d6" não cura | Efeito do item | Não informada |
| 10 | Média | Itens antigos: cartões da aba Itens x mochila | Item da aba Itens não aparece no Usar da batalha; o contador soma os dois; os cartões ficam até "Passar para a mochila" | Não indicada. A saída "Passar para a mochila" já existe | Não informada |
| 11 | Média | Vaga da mochila (e da banca) x item do Acervo: a vaga é cópia | Mudar foto, descrição, preço, luz ou munições no Acervo não muda as mochilas nem as bancas já criadas. Só efeito e requisitos acompanham | Acervo | Não informada |
| 12 | Média | Luz que a ficha carrega: luz do mapa presa ao token x item que ilumina (tocha) | Tocha da peça não se dá nem se larga, e acende em outro painel; tocha-item não aparece em Luzes | Não indicada | Não informada |
| 13 | Média | Nome e foto: ficha x token (copiados só no nascimento do token) | Trocou nome ou retrato na ficha (ou pelo Lobby) e o mapa e a batalha seguem mostrando o antigo | Ficha (publicName fica como exceção do mestre) | Alta |
| 14 | Média | Edição da ficha: validador do Lobby x rede local; acender do mestre por 2 caminhos | Foi o bug da Tocha (a22c9788). Suspeita: a mesma ficha em 2 bonecos pode acender mochilas diferentes | Não indicada | Suspeita; não comparado campo a campo |
| 15 | Média | Transformação ativa: ficha (cartões ativos) x Token.formaVisivel | Ligar a forma pela ficha ou pelo site não troca a imagem no mapa; só "Mudar ficha ›" troca | Ficha | Média |
| 16 | Média | Mira: pela Mesa x menu da vez | Na Mesa não há "usar mesmo assim" para alvo fora do alcance, a direção é sempre a frente do token e ela não marca sozinha quem está na área. O host recusa; o menu da vez pede confirmação | Menu da vez | Média |
| 17 | Média | Aliado no Dragon Ball: lado do combatente (flanco) e troca do mestre na ordem x equipes | O relatório não descreve o sintoma visível. Fatos: flanco lê o lado do combatente; o mestre troca o lado na ordem; o que o jogador vê dos aliados vem das equipes | Equipes (One Piece usa só equipes) | Média-alta |
| 18 | Média | "Escuro/Noite" em 4 controles: tema Escuro/Noite, período Noite, Cena escura, Sala escura | Mapa em breu (tema), mas o jogador vê longe e conta como "na luz": o tema não reduz visão nem conta como escuro no requisito "no escuro" | Não indicada | Alta |
| 19 | Média | "Fora do Chão: bloqueado": só reconhece peça de Chão e água; Sala, textura e desenho cheio não contam | Ficha não vê nem anda na área pintada além das peças | Não indicada | Alta |
| 20 | Média | Andares de 2 jeitos: pisos na mesma cena x cenas marcadas como andar | Terreno alto e tema por piso só funcionam nos pisos; as abas de memória só existem para cena-andar e mostram só o piso 0 da outra cena | Não indicada | Alta |
| 21 | Média | De quem é o personagem: Token.playerCharacter, Token.npc, Personagem.tipo, Personagem.dono, nomeDoJogador, Token.emprestada (o relatório diz "5 jeitos" e lista 6 campos) | Marca num lugar e o jogador não recebe pelo outro | Não indicada | Média no sintoma |
| 22 | Média | Dar texto para ler, 4 jeitos: papel no chão, pino "!"/"?", pino ligado a verbete, revelação do Grimório; cada um com seu "já leu" | Só o documento (papel) fica na ficha e no Lobby | Não indicada | Média |
| 23 | Média | Mochila e moedas: no boneco (token) x na ficha, espelhadas | A venda lê o boneco; o Lobby lê só a ficha; aventura não migrada usa o boneco. A migração roda ao abrir | Não indicada. Já há migração em andamento (mochila/espelho.ts) | Média |
| 24 | Média | Imagem da arma em 3 lugares: cartão, coisa do Acervo, cópia da vaga | Sem sintoma descrito no relatório. Já remendado na lista da biblioteca (f83e9951) | Acervo | Não informada |
| 25 | Baixa | "Chão pintado" lido de 2 jeitos: terrenoAlto x chaoPintado; coberturaDoPiso x chaoQueLimita | Erra para o lado de esconder mais; coberturaDoPiso conta até Região "Conta como Chão" desligada | chaoPintado.ts (ação indicada no relatório) | Alta |
| 26 | Baixa | Abrigo de chuva e neve: só Sala com teto ou cômodo | Chove dentro do castelo feito de paredes + Balde. Só visual | Não indicada | Alta |
| 27 | Baixa | Aura mora só no token; Personagem não tem | Outro boneco, outra cena ou cópia do NPC nasce sem aura | Não indicada | Alta |
| 28 | Baixa | Verbete do Grimório casa item só pelo nome | Renomear cria item duplicado; verbete sem ficha vira NPC sem ficha | Não indicada | Não informada |
| 29 | Baixa | Desafio.quem.nome e minigame.npc guardam cópia do nome do token | Renomear o token não muda o convite. O relatório também aponta que desafios.ts:434 apaga o "quem" quando divergem | Não indicada | Não informada |
| 30 | Baixa | "Comigo" (junta as mochilas de todas as fichas do jogador e mostra a maior bolsa) x inventário da ficha (só dela) | Números diferentes nas duas telas. O relatório marca como de propósito | Não se aplica (de propósito) | Não informada |
| 31 | Baixa | 5+ sistemas de pastas: PastaDoAcervo, pastasDosItens, pastasDeVerbetes, pastasDeMapas, pastasDeFichas -> fichasNoAcervo | O lugar da ficha em outro PC se acha pelo nome | Não indicada | Não informada |
| 32 | Baixa | Peça da estante guarda mochila, moedas e luzes próprias, copiadas ao pôr no mapa | Funciona como modelo; sem sintoma descrito | Não se aplica (funciona como modelo) | Não informada |
| 33 | Baixa | Token.health gravado sem uso | Campo interno; o relatório não descreve efeito na mesa | Não se aplica (campo sem uso) | Não informada |

## Detalhes técnicos

Referências copiadas dos 4 relatórios (`tmp\levantamento-duplicadas\1-itens.md`, `2-batalha.md`, `3-mapa.md`, `4-personagens.md`, fora do git). Os caminhos estão como nos relatórios, sem a pasta de cima: procure pelo nome do arquivo. "Rel. 1-4" = relatório; "item" = número do achado dentro dele.

- **0. Balas.** leituraDaFicha.ts:307-320 ("Tipos de bala" no cartão da arma) x lib/mochila/municao.ts:78 (Munição da mochila). Rel. 1, referência.
- **1. Kit Médico.** batalha/golpe.ts:676 (gastaItem só soma um uso na batalha); mecanicasAMao.ts:1320-1333 e acoes.ts:262-265 (sobra = mochila menos usos); stores/batalha/golpe.ts:885 (registro "gastou 1 Kit Médico"); stores/batalha/gastosDosRequisitos.ts:36-45 e stores/batalha/golpe.ts:751-757 (tiram de verdade). Rel. 2 item 1, ALTA.
- **2. Preço da loja.** PinLojaControls.tsx:209-212 (texto LojaItem.preco editável); PlayerPinCard.tsx:1078 (o que o jogador vê); PinLojaControls.tsx:40, loja.ts:44-45, vendaDaLoja.ts:31 (cobrança usa acervo.preco copiado na escolha). Rel. 1 item 1, ALTA.
- **3. Condição.** batalha/selos.ts; condicoes.ts:71-107 (selo); types/map.ts:1564,1751 e prazoDaCondicao.ts (pastilha); ponteDasCondicoes.ts:9-31 (ponte só batalha->pastilha); condicoes.ts:271 (só lê selos); condicoes.ts:79,303 (Aplicar/pular); stores/batalha/vez.ts:249-283 (pastilha tira vida sozinha); stores/batalha/golpe.ts:836 (tirarSelos); mochila/usarItemFora.ts:122-135 (fora apaga a pastilha); curaPeloItem.ts:33 (cura só tira Envenenado). Rel. 2 item 3, ALTA-MÉDIA.
- **4. Dano pela ficha.** ajusteDaFicha.ts:413-420; FichaNumeros.tsx; player/PlayerFicha.tsx; stores/batalha/nucleo.ts:120-135; stores/batalha/golpe.ts:1271; passivas.ts:501. Rel. 2 item 2, ALTA; certeza média-alta.
- **5. Dragon Ball, 2 inventários.** lib/dbt/modelo.ts:697 (FichaDBT.inventario); lib/dbt/regras/ficha.ts:235 (Rel. 1) e :236, :277 (Rel. 4); components/dbt/ficha/AbaInventario.tsx:11,45 (Rel. 1) e :18-44, :45-49 (Rel. 4); RpgDialogs.tsx:185 ("Mochila do token"); nuvem/caminho.ts:182 (o Lobby leva inventario e CAMPO_DO_ITEM por caminhos separados). Rel. 4 item 1, ALTA; Rel. 1 item 3, MÉDIA-ALTA.
- **6. Desenho cheio como chão.** baldeDeTinta.ts:6-10 (forma preenchida do Balde do Pincel); terrenoAlto.ts:100-110, :175, :262; baldeDeTextura.ts:85 (pintaOChao). Rel. 3 item 1, ALTA.
- **7. Região "Oculto para jogadores".** fogFilter.ts:554-556 (secretRoomsOf pega só Sala), :3048 (inSecretRoom), :3364 (hiddenAreas), :871 (playerHiddenRings); FichaDaRegiao.tsx:15,27; PropertiesPanel.tsx:333; "comentário :880" (o relatório não repete o arquivo). Rel. 3 item 2, ALTA/MÉDIA.
- **8. Arma ficha x mochila.** leituraDaFicha.ts:442-456 (armasDe põe no Atacar todo cartão da aba Armas, com ou sem vaga); :420-435 (a mochila só acrescenta, dedup por itemId ou nome); :420-458 (Rel. 2); docs/design/habilidades/ARMAS-FONTE-UNICA.md. Rel. 1 item 2, MÉDIA-ALTA; Rel. 2 item 4, MÉDIA.
- **9. "Usar" fora da batalha.** curaPeloItem.ts:48-56; RpgDialogs.tsx:341-351,396-400 (palpite pelo nome); RpgDialogs.tsx:388-394 e mochila/usarItemFora.ts:141 (UsarItemFora, quando há efeito). Rel. 1 item 4, MÉDIA.
- **10. Cartões antigos da aba Itens.** FichaAbas.tsx:99-170 ("Passar para a mochila"); FichaAbas.tsx:234 (contador soma os dois); batalha/itemNaBatalha.ts:44 (batalha só lê a mochila). Rel. 1 item 7, MÉDIA.
- **11. Vaga da mochila é cópia.** types/map.ts:788-830; mochila/efeitoNasCopias.ts:19-24 e stores/itensNaFonte.ts:35 (só efeito e requisitos seguem o Acervo). Rel. 1 item 6, MÉDIA.
- **12. Luz presa x item que ilumina.** types/map.ts:405 (Light.attachedTokenId); LightControls.tsx:147; stores/criarToken.ts:225 (peça vira isso); luzDoItem.ts:84,132; RpgDialogs.tsx:374. Rel. 1 item 8, MÉDIA.
- **13. Nome e foto do token.** stores/porPersonagemNoMapa.ts:134-142; ligarFicha.ts:30; batalha/dadosDaFaixa.ts:235,:353; mesaDoMestre.ts:121; dbt/batalha/dadosDaFaixaDBT.ts:115 (batalha prefere o token). Rel. 4 item 2, MÉDIA-ALTA.
- **14. Dois juízes na edição da ficha.** net/edicaoDoPersonagem.ts e hostSession (rede local) x lib/nuvem/caminho.ts (Lobby); commit a22c9788 (bug da Tocha); App.tsx:1241 (lê token.mochila) x RpgDialogs.tsx:380 (lê a ficha). Rel. 4 item 3, MÉDIA.
- **15. Transformação.** personagem.ts:246 (cartoesAtivos); dbt/modelo.ts:696; types/map.ts:1907 (Token.formaVisivel); mudarFicha.ts:50-60. Rel. 4 item 4, MÉDIA.
- **16. Mira.** batalhaJanela/espelhoOP.ts:90-94 (sem "usar mesmo assim"), :385-400 (não envia foraDoAlcance); miraDaMesa.ts:20 (direção sempre a frente do token); batalha/golpe.ts:965-968 (host recusa); MiraDoGolpe.tsx:710 (menu pede confirmação); relato de 312e4916 (Mesa não marca sozinha quem está na área). Rel. 2 item 6, MÉDIA.
- **17. Aliado no Dragon Ball.** dbt/batalha/trabalho.ts:202; OrdemDoMestreDBT.tsx:119; dbt/batalha/motor.ts:273; net/batalhaDBTNoHost.ts:172. Rel. 2 item 5, MÉDIA.
- **18. Escuro/Noite.** temasDoAmbiente.ts:16,49-56 (tema, só cor); periodo.ts:482-491 (período Noite); fogFilter.ts:3412-3418 (Cena escura e Sala escura); luzNaFicha.ts:13-20 (requisito "no escuro"). Rel. 3 item 4, MÉDIA.
- **19. Fora do Chão.** offFloor.ts:9-12,67-82; visibility.ts:232. Rel. 3 item 3, MÉDIA.
- **20. Andares de 2 jeitos.** pisos.ts:9-12; buildingFloors.ts:4-9; hostSession.ts:3562-3567 (abas de memória). Rel. 3 item 5, MÉDIA.
- **21. De quem é o personagem.** map.ts:1857 (Token.playerCharacter); map.ts:1816 (Token.npc, copiado só no nascimento, porPersonagemNoMapa.ts:141); Personagem.tipo; personagem.ts:284 (Personagem.dono); personagem.ts:304 (nomeDoJogador); map.ts:1836 (Token.emprestada). Rel. 4 item 5, MÉDIA.
- **22. Dar texto para ler.** documentos/noMapa.ts e personagem.ts:276 (papel no chão); LeiturasDoJogador em types/cenarioEFalas.ts:23 (pino "!"/"?"); preparo/pinoLigado.ts (copia para pin.description); preparo/revelado.ts (Grimório). Rel. 4 item 6, MÉDIA.
- **23. Mochila e moedas, boneco x ficha.** types/map.ts:1820-1824 (boneco); personagem.ts:265-267 (ficha); mochila/espelho.ts (espelho); hostSession.ts:10134 (venda lê o boneco); PainelMochila.tsx:48-49 (Lobby só a ficha); App.tsx:3313 (migração ao abrir). Rel. 1 item 9, MÉDIA-BAIXA; certeza média.
- **24. Imagem da arma.** gruposDaBiblioteca.ts:164-176; leituraDaFicha.ts:406; types/map.ts:796; remendo em f83e9951. Rel. 1 item 5, MÉDIA.
- **25. "Chão pintado" de 2 jeitos.** terrenoAlto.ts:138-168 (força soma, ignora recortes do Balde); chaoPintado.ts:31-81 (último passo vale, desconta recortes); coberturaDoPiso x chaoQueLimita (o relatório não dá arquivo:linha). Rel. 3 item 7, BAIXA; ação do relatório: terrenoAlto deveria usar chaoPintado.ts.
- **26. Chuva e neve.** abrigoDoAmbiente.ts:27-29; fogFilter.ts:583-594. Rel. 3 item 6, BAIXA.
- **27. Aura só no token.** map.ts:1899; auras.ts:20. Rel. 4 item 7, BAIXA-MÉDIA.
- **28. Verbete casa só pelo nome.** preludio/janela/verbeteNaMesa.ts:103; :124-127 (verbete sem ficha vira NPC sem ficha). Rel. 4 item 8, BAIXA.
- **29. Cópia do nome em Desafio e minigame.** map.ts:2793 (Desafio.quem.nome), :2820 (minigame.npc); desafios.ts:434. Rel. 4 item 9, BAIXA.
- **30. "Comigo".** player/main.tsx:1465-1488 (junta mochilas de todas as fichas e mostra a maior bolsa); player/main.tsx:1495-1503 (inventário da ficha, só dela). Rel. 1 item 10, BAIXA-MÉDIA (de propósito).
- **31. Sistemas de pastas.** PastaDoAcervo, pastasDosItens, pastasDeVerbetes, pastasDeMapas, pastasDeFichas -> fichasNoAcervo; fichasNoAcervo.ts:20-28 (lugar da ficha em outro PC se acha pelo nome). Rel. 4 item 10, BAIXA.
- **32. Peça da estante.** tokenLibrary.ts:97-111; :433 (cópia ao pôr no mapa). Rel. 1 item 11, BAIXA.
- **33. Token.health.** types/map.ts:1698-1703. Rel. 1 item 12, BAIXA (interno).

## O que o levantamento não cobriu

Juntado das seções "Fora" e "Sem verificar" dos 4 relatórios. O que não está nos 4 ângulos também não foi olhado.

- **Rel. 1 (itens, ficha, loja):** Worker do Lobby; importação do Grimório (preparo/importar/inventario.ts); condições (Token.conditions x batalha), que o Rel. 2 cobriu (Nº 3); retrato da ficha x foto do token, que o Rel. 4 cobriu (Nº 13).
- **Rel. 2 (batalha):** divergência entre batalha normal, Arena e treino (mesma fábrica, docs/diagrams/combate-tres-entradas.html) sem verificar; condições do Dragon Ball x selos do One Piece (regra própria); lembrete duplo marca.ts x passivas.ts (Olhar Artístico).
- **Rel. 3 (mapa):** marcações (pino, marcador, desenho com texto, carimbo, papel); portas e passagens (porta, escada levaAoPiso, pino de viagem, roomLink); penhasco, abismo e barranco x parede; PixiCanvas.tsx e PlayerView.tsx só por grep.
- **Rel. 4 (personagens):** mochila e moedas token x ficha, em migração (mochila/espelho.ts), que o Rel. 1 cobriu (Nº 23); caminho.ts x edicaoDoPersonagem.ts campo a campo (ligado ao Nº 14); livros/* e puzzles a fundo.
- **Em todos:** nada foi rodado no app. Antes de construir qualquer frente, reproduzir o sintoma na mesa.

## Próximo passo sugerido

Cinco frentes de unificação, uma por padrão. A ordem de ataque recomendada começa pelo que dá resultado errado em jogo (item que volta, preço cobrado errado, condição que não trava, dano sem regra):

1. Balas (0), Kit Médico (1) e arma (8), da frente A: mesmo padrão de posse.
2. Preço da loja (2), da frente B.
3. Condições (3) e dano pela ficha (4), da frente C.
4. Os dois Alta do mapa (6, 7), da frente D.
5. O resto de cada frente, por gravidade.

**Nenhuma frente começa sem decisão do dono.** Cada uma passa por plano e perguntas antes de construir.

### Frente A: posse em um lugar só (a mochila)
- Itens: 0, 1, 8; depois 5, 10, 23.
- Por quê primeiro: as balas já têm decisão, e Kit Médico e arma repetem o mesmo problema (dois lugares guardam a mesma coisa e um não desconta).
- Decidir: a mochila passa a ser a dona também de Kit Médico e arma, como nas balas? Arma e itens que hoje existem só como cartão da ficha são convertidos sozinhos, como nas balas? No Dragon Ball, qual inventário vence (o Rel. 1 acha a mochila "provável")?

### Frente B: cópia que acompanha a fonte
- Itens: 2 primeiro; depois 11, 24, 13, 29, 28. O 32 (estante) funciona como modelo e pode ficar como está.
- Decidir: o preço da banca continua texto livre (ex.: "3 moedas") ou passa a ser sempre o número do Acervo? Mudou no Acervo, as bancas e mochilas já criadas mudam junto? Nome e foto do token passam a seguir a ficha, com o publicName do mestre como exceção?

### Frente C: um juiz só para a mesma ação
- Itens: 3 e 4 primeiro; depois 9, 16, 17, 14.
- Decidir: o "-50" da ficha passa a seguir as regras da batalha (Escudo, redução, registro, Desfazer)? Na condição, o selo da batalha vence, e o que acontece com a pastilha e o prazo? "Usar" sem efeito cadastrado deixa de adivinhar pelo nome?

### Frente D: regras de mapa que entendem todas as formas
- Itens: 6 e 7 primeiro; depois 19, 25, 18, 26, 20.
- É outra parte do código: pode ser planejada à parte das frentes A a C.
- Decidir: o que conta como "chão" (peça, Sala, textura, desenho cheio) numa definição só? "Oculto para jogadores" em Região esconder só o desenho é de propósito? O que "escuro" significa quando tema, período e cena escura discordam?

### Frente E: vários sistemas para a mesma ideia
- Itens: 12, 15, 21, 22, 31; o 27 (aura) pode entrar aqui.
- Por quê por último: impacto menor na mesa e mudança maior de estrutura.
- Decidir: em cada caso, qual dos sistemas fica e o que acontece com o que já foi criado no outro.
