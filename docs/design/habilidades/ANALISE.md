# Habilidades e itens: análise do que existe (21/11/2026)

Pedidos 8, 9 e 10 do mestre (21/11, literais no PEDIDOS.md): separar "Itens e habilidades" em duas páginas, melhorar e
caçar erros na montagem de habilidade ("não estou vendo técnica de reação", "testar fácil só apertando um botão") e dar
aos itens a mesma mecânica (cura, dano, área, reviver, antídoto, debuff).

Este arquivo é o MAPA e a LISTA DE ERROS. O desenho do sistema novo está em [SISTEMA.md](SISTEMA.md).

**Como foi feito:** leitura do código e das fichas reais gravadas. Nada foi executado, nenhum teste rodou e nenhum
arquivo do app mudou. Cada erro abaixo diz se foi "lido no código" ou "visto no dado real". Antes de consertar, quem
implementa reproduz (regra 13 do projeto).

Caminhos: tudo em `client/src/` salvo quando dito.

---

## 1. Mapa do sistema de hoje

### 1.1 Onde mora cada coisa

| Parte | Arquivo | O que faz |
|---|---|---|
| Botão "Itens e habilidades" | `components/livros/MundoDoLivro.tsx:39-47` (lista), `:44` (rótulo), `:166` (número) | Um marcador só; o número soma catálogo do livro + Acervo do app |
| Página dele | `components/livros/PaginaItens.tsx` (1112 linhas) | Catálogo com filtros (Armas, Habilidades, Itens, Perícias, Vantagens, Desvantagens) e "Ficha que recebe" |
| Aba do mundo | `stores/mundoDoLivroStore.ts:28` (`AbaDoMundo`) | O valor `itens` é uma aba só |
| Catálogo do livro (REGRA) | `lib/livros/catalogo.ts:52-80` | `{ id, tipo: arma/habilidade/item, nome, texto, campos }`. Só texto. Grava em `livros/<sistema>/catalogo.json` |
| Acervo do app (COISA) | `lib/acervoDeItens.ts:73-103` | `{ nome, imagem, descricao, categoria, preco, empilhavel, municoes, luz, pasta }`. Grava em `itens/itens.json` |
| Item na mochila | `types/map.ts:786-853` (`DadosDoItem`, `CarriedItem`) | Cópia do item dado: nome, imagem, descrição, quantidade, luz |
| Coisa x regra | `lib/livros/coisaERegra.ts` | Item vai para a MOCHILA; arma vira cartão na aba Armas com o mesmo `itemId` |
| Cartão da ficha | `lib/personagem.ts:47-119` (`CartaoDaFicha`) | `campos` (texto), `extras`, `modificadores`, `subcartoes`, `mecanica?`, `mecanicaProposta?`, `oculta?`, `armaPadrao?`, `itemId?` |
| Editor do cartão | `components/FichaAbas.tsx:460` (lista), `:648` (cartão) | Nome, campos, Mecânica, "Para os jogadores", Campos extras (+ Campo, + Evolução, + Opção), Subir/Descer/Remover |
| Teclado da fórmula | `components/CampoDeDano.tsx` | Botões dos atributos com o valor da ficha, Dano da Arma, % da vida do alvo, operadores, prévia "O app calcula sozinho = 80" |
| Editor da mecânica | `components/batalha/MecanicaDaTecnica.tsx`, `BlocosDaMecanica.tsx` | "Comece por um modelo" + 7 blocos (custo, ação, alvo, teste, dano, efeitos, limites) + resumo em frases |
| Peças (dado) | `lib/batalha/mecanica/modelo.ts:175` (`MecanicaV1`) | Versão 1. Leitor rígido: chave desconhecida = "mecânica inválida" |
| Modelos prontos | `lib/batalha/mecanica/modelos.ts:25-31` | 5: Golpe simples, Golpe em área, Cura, Debuff com teste, Buff em aliado |
| Peças para o motor | `lib/batalha/mecanica/leitura.ts:196` (`linhaDasPecas`) | Traduz as peças para a MESMA linha da tabela à mão (`MecanicaAMao`) |
| Tabela à mão | `lib/batalha/mecanicasAMao.ts:265` (tipo), `:450-780` (tabela) | Cerca de 45 linhas presas ao `cartaoId` das fichas reais. É o que o motor SABE fazer hoje |
| Fórmula | `lib/batalha/formula.ts:9-29` (gramática), `:470` (% da vida) | Soma, produto, parênteses, atributos, Dano da Arma, Dano da Bala. Sem dado (1d6), sem avaliar texto como código |
| Leitura única da técnica | `lib/batalha/leituraDaTecnica.ts:93` | Custo, ação, tempo, Overload, tipo: do texto ou das peças |
| Pode usar? / lança | `lib/batalha/golpe.ts:382` (`podeAgir`), `:753` (`lancarGolpe`) | Regra pura; a store aplica (`stores/batalha/golpe.ts`), fábrica única `stores/batalhaFabrica.ts` |
| Jogador na rede | `net/batalhaNoHost.ts` | Pedidos `batalha.agir`, `batalha.reagir` e outros. O d20 rola no host |
| Outro motor | `net/batalhaDBTNoHost.ts`, `lib/dbt/**` | Dragon Ball: motor separado. A página Itens some nele (`MundoDoLivro.tsx:65`) |

### 1.2 Como um golpe resolve hoje

```
mira (tela) --pedido--> podeAgir (regra) --> lancarGolpe (dano que chega, quem reage)
   --> cada alvo reage: d20 + mod   OU   técnica de reação no lugar do d20
   --> dano final (x fator da saída) --> Escudo primeiro, depois HP
   --> selo pega se acertou --> recarga, usos e custo cobrados --> linha no registro (com Desfazer)
```

- **Dano que chega** (`lib/batalha/reacao.ts:109`): base x Concentração (carga 0 a 3) x Surpresa x extras, dividido entre
  alvos, para baixo uma vez.
- **Reação normal** (`reacao.ts:38-45`): d20 + modificador. 1 natural = crítico (x1,5); total 10 = metade; 15 = esquiva;
  20 = contra-ataque; abaixo de 10 recebe inteiro.
- **Dano na ficha** (`reacao.ts:154`): gasta o Escudo primeiro, o resto vai ao HP. Perfurante vai direto ao HP
  (com porcentagem parcial só na técnica de TEXTO).
- **Área** (`lib/batalha/area.ts:25`): raio em volta de quem usa, quadrado à frente, linha à frente. A área é
  pré-marcação da mira (`components/batalha/dadosDoMenu.ts:970-999`); quem usa pode desmarcar. O host não confere
  quem estava dentro.

### 1.3 Reação hoje

- **Existe no motor**, mas só para técnica de TEXTO: `lib/batalha/reacaoComTecnica.ts:156` lista as técnicas cujo Tipo é
  "Reação" ou cuja Ação é dupla ("Reação/Ação Completa"). Elas aparecem na caixa REAÇÃO e são usadas NO LUGAR do d20
  (`:310`). Cobram custo, marcam recarga e usos, não gastam ação da vez. Quem já rolou o d20 não pode mais trocar pela
  técnica (`:74`).
- **O que a reação faz** vem de texto (`lib/batalha/tiposDaHabilidade.ts:135-172`: "esquiv" = esquiva, "metade", "rebat" =
  contra, "rola 1d20" = rolar) ou da tabela à mão por `cartaoId` (`mecanicasAMao.ts:42-84`): fator do dano que fica
  (Defender 90%), devolver o dano dividido, curar parte do que chegava, rolar d20 + maior modificador e anular com 15,
  valer contra Overload e contra Surpresa, selo em quem atacou (Marcado), rebater em área perto.
- **No construtor não existe.** Ver erro B01.

### 1.4 Condições (selos) e duração

- Tabela nome para regra: `lib/batalha/condicoes.ts:63-101`. Com regra de verdade: Atordoado e Paralisado (só passa a
  vez, não reage), Aéreo (sem esquiva e contra), Cego (Percepção 0), Marcado (esquiva com desvantagem), Sangrando e
  Queimando (10 de HP por vez, pelo botão Aplicar do mestre; Queimando renova), mais os de uma ficha só.
- Selos prontos sem regra (só o nome na carta): Envenenado, Lento, Preso, Confuso (`lib/batalha/selos.ts:41`).
- **Duração** (`selos.ts:198`): conta na vez de QUEM TEM o selo, desce 1 no fim de cada vez dele; a vez em que nasceu
  não conta. "Até tirarem" e "até o próximo golpe" também existem.
- **Mods** (`selos.ts:261`): um selo pode somar ou tirar de atributo, de "Dano" e de "Reação". Funciona na técnica de
  TEXTO ("Ganha +20 de Força por 2 turnos"). No construtor não: ver B03.
- Passivas (`lib/batalha/passivas.ts:57`): gatilhos lidos do texto (início do combate, rodada N, vida abaixo de X%).
  Nunca agem sozinhas: viram lembrete "Aplicar / pular".

### 1.5 Itens hoje

- Categorias de fábrica: Arma, Armadura, Consumível, Munição, Fruta, Chave, Tesouro, Peça de puzzle
  (`lib/acervoDeItens.ts:54`). O mestre já criou Balas, Comida e Ingredientes, Ferramenta, Peixes.
- **Item não tem efeito nem "usar".** As únicas ações de item na rede são acender a luz (`net/protocol.ts:722`,
  `net/hostSession.ts:9761`) e dar (`protocol.ts:890`). Munição é gasta pelo tiro (`lib/batalha/municaoDaFicha.ts`).
- Uma única ponte item para batalha: a Medicina gasta 1 Kit Médico da mochila por tabela à mão
  (`mecanicasAMao.ts:323`, `:1228`).

### 1.6 O que já existe para "testar"

- **Arena de testes** (`components/arena/*`, `lib/arena/*`): já tem o Judge-boneco (`lib/arena/boneco.ts`: vida infinita
  ou HP pedido, Escudo, modificador), que reage sozinho (`lib/arena/reacaoDoBoneco.ts`) e um placar de dano
  (`lib/arena/placar.ts`). Usa a mesma fábrica da batalha com cópias das fichas (`lib/batalha/mesa.ts`).
- **Treino do site** (`lib/treino/mesaEmMemoria.ts`, `lib/treino/duelo.ts:140`): o mesmo motor, puro, sem tela, com o
  d20 por parâmetro e semente fixa.
- Falta o atalho: hoje, para testar uma técnica é preciso sair da ficha, abrir a Arena, montar os lados e achar o golpe.

---

## 2. O que as fichas reais pedem

Lido de `%APPDATA%/com.labirinto.app/pastas/<campanha>/rpg.json` (28 fichas: 11 de jogador, 17 NPCs), do Acervo
(`itens/itens.json`, 26 itens) e do catálogo do livro (`livros/one-piece/catalogo.json`, 45 entradas). Aqui só a
mecânica, sem dados pessoais.

**Números:** 241 cartões; só 9 têm mecânica montada (8 de NPC e 1 arma). Tipos escritos: Debuff 11, Passiva 5, Ativa 4,
Buff 3, Reação 2, Invocação 1, vazio 51. Seis técnicas têm "Reação" na Ação. Atributos do sistema: Força, Agilidade,
Percepção, Resistência, Intuição, Espírito, Carisma, Determinação. Faixas: HP 300 a 1100, SP 60 a 240, Escudo 0 a 100;
atributos 0 a 100; dano de técnica de 30 a cerca de 400.

| O que as fichas fazem | Exemplos de mecânica | O construtor de hoje faz? |
|---|---|---|
| Dano por fórmula com arma | (Força + 20) + Dano da Arma | Sim |
| Multiplicador | (Força + 40) x 1,5; furtivo x3 | Sim |
| Área em volta / à frente / linha | raio 1; 6x6 à frente; linha de 6 | Sim |
| Área longe de quem usa | "chuva sobre uma área de 2 quadrados"; granada | **Não** |
| Dividir entre até 3 | dano dividido | Sim |
| Dois golpes | 2º golpe = metade, perfurante | **Não** (só na tabela) |
| Perfurante parcial | "Perfurante 50%" | **Não** |
| % da vida do alvo | 10% da vida atual | Só sozinho na fórmula |
| Teste contra CD | CD 12 + mod de Carisma; CD pela Concentração | Sim |
| Disputa | Força contra Resistência | Sim |
| Atordoar, cegar, sangrar, queimar | Atordoado 1; Sangrando 10 por 3 | Sim (1 selo por técnica) |
| Buff com número | "20% do Espírito em um atributo físico"; "+8 em reação"; Força +20 | **Não** (selo sem número) |
| Cura | Espírito de HP; 100 de HP; com Concentração 350 | Sim, só HP e só aliado |
| Tirar debuff | "remove debuff + cura" | Sim, só "todos os negativos" |
| Recuperar SP / Escudo | comida "+20 de SP" | **Não** |
| Dreno por turno | alvo perde 15 SP por vez, quem usa ganha 10 | **Não** (só na tabela) |
| Roubo de vida | 10% do dano vira vida | **Não** (só por nome de selo) |
| **Reação com técnica** | esquiva e marca; anula e cura 20%; defende 90% ou devolve; rola d20 + mod e anula com 15; rebate | **Não** |
| Passiva com gatilho | abaixo de 50% de HP recupera 30 por vez; +10 de Força por vez | **Não** (texto, lembrete) |
| Custo em % do HP, HP depois | 10% do HP máximo; perde 200 depois | Sim |
| Gasta item | cada uso gasta 1 Kit Médico | **Não** (só na tabela) |
| Empurrar, puxar | empurra N casas; puxa até quem usa | **Não** (à mão) |
| Invocar, armadilha | lobos; armadilhas no campo | Fora do construtor (sistema próprio / à mão) |
| Só vale contra alvo com selo X | "só contra quem está na redoma" | **Não** (só na tabela) |

**Itens com efeito escrito só em texto (Acervo real):** "Cura 100 de Hp ao ser consumido", "Recupera 100 de Vida",
"Cura 100 de vida", "Causa 150 de dano [em] quem está em volta", "aumenta temporariamente 20 de força", "aumenta 20 de
SP", "recuperar hp e sp". O mestre já pensa nos itens como efeitos; o app só guarda a frase.

**Sinais de que a tela não deixou fazer o que ele queria:**
- Um NPC tem uma habilidade chamada "Escudo", Tipo Ativa, com a mecânica do modelo "Golpe simples" intacta
  (Força + 20 de dano num inimigo). Ele quis uma defesa e só havia golpe.
- Seis cartões têm "80" no campo Dano (texto) e "Força + 20" nas peças: dois números para o mesmo golpe.
- Há cartões chamados "Sem nome" e "Habilidade" (o nome de fábrica).
- As 44 habilidades do catálogo do livro são só texto: nenhuma leva mecânica.

---

## 3. Erros e lacunas

Gravidade: **Alta** = o golpe sai errado ou a função pedida não existe; **Média** = confunde ou limita; **Baixa** =
acabamento. "Lacuna" = nunca foi feito (não é regressão). Fonte: "lido" = lido no código; "dado" = visto nas fichas.

### Alta

| # | O que | Onde | Como ver | Fonte |
|---|---|---|---|---|
| B01 | **Técnica de reação não dá para montar.** A peça de ação não tem "reação"; a leitura das peças marca `tambemReacao: false`; a reação da tabela só é achada por id | `lib/batalha/mecanica/modelo.ts:59`; `mecanica/leitura.ts:97-100`; `tiposDaHabilidade.ts:74-83`; `mecanicasAMao.ts:1047` | Montar mecânica em qualquer técnica: nenhum bloco oferece reação. Com o campo Tipo = "Reação" o cartão montado até entra na caixa REAÇÃO, mas o que ele faz sai do texto do Efeito, não das peças | lido + dado ("Escudo") |
| B02 | **O modelo pronto ignora o que o cartão já diz.** Troca dano, custo e ação pelos de fábrica (Força + 20, 30 SP) | `mecanica/modelos.ts:77-108` (a função não recebe o cartão); `components/batalha/MecanicaDaTecnica.tsx:277` | NPC com Dano "80" e SP 0: Montar mecânica, Golpe simples. O golpe passa a valer Força + 20 (20 num NPC de Força 0) e a custar 30 SP que ele não tem | lido + dado (6 cartões) |
| B03 | **Buff montado não muda número nenhum.** O selo das peças não tem mods; o modelo "Buff em aliado" manda conferir à mão | `mecanica/modelo.ts:169`; `mecanica/leitura.ts:176-184`; `mecanica/modelos.ts:97-106` | Modelo "Buff em aliado": "Fortalecido" aparece na carta e a Força do aliado fica igual. A técnica de TEXTO "+20 de Força por 2 turnos" soma (`selos.ts:474-503`): o construtor faz menos que o texto | lido |
| B04 | **A biblioteca não guarda mecânica.** A entrada do catálogo só tem texto; "Juntar das fichas" e "Pôr em" jogam a mecânica fora | `lib/livros/catalogo.ts:52-80`, `:275-286`, `:330-335` | Juntar das fichas com a "Bolha" montada, depois "Pôr em" outro NPC: o cartão chega sem a cura | lido + dado (0 de 44) |
| B05 | **"Trazer de outra ficha" perde a mecânica programada à mão.** A cópia nasce com id novo e a tabela é por id | `lib/trazerDeOutraFicha.ts:28-37`; `mecanicasAMao.ts:790-793` | Trazer para um NPC qualquer técnica da tabela (as cerca de 45 das fichas dos jogadores): na batalha ela vira texto puro, sem aviso | lido |
| B06 | **Item não tem efeito nem "usar"** (lacuna, pedido 10) | `lib/acervoDeItens.ts:73-103`; `types/map.ts:786-820`; `net/protocol.ts:722`, `:890` | Poção na mochila: não há botão de usar; o mestre desconta a vida à mão | lido + dado |

### Média

| # | O que | Onde | Como ver | Fonte |
|---|---|---|---|---|
| B07 | Custo por fórmula é multiplicado pela força do NPC (usa o leitor de DANO) | `lib/batalha/leituraDaTecnica.ts:76-79` chama `lerDano` (`formula.ts:533`); o certo é `lerFormula` (`formula.ts:543`) | NPC de combate com força 1,5 e custo "Espírito + 10": cobra 1,5 vez | lido |
| B08 | Texto e peças ficam os dois na tela de edição, com números diferentes | `components/FichaAbas.tsx:708-742` (campos seguem editáveis); só a leitura esconde (`:331`, `:355-360`) | Cartão com mecânica: Ação, Custo, Tempo e Dano de texto continuam ali | lido + dado |
| B09 | "+ Opção" e "+ Evolução" não mexem nas peças | `FichaAbas.tsx:871-886`; `lib/batalha/escolhaEEvolucao.ts:147-159` | Técnica montada + "Opção 2": a mira pergunta e o golpe sai igual | lido |
| B10 | "% da vida do alvo" só vale sozinho no campo, mas a tecla fica ao lado das outras | `formula.ts:470` (regra ancorada do começo ao fim); `components/CampoDeDano.tsx:60-66` | "Força + 10% da vida do alvo" = "O app não entende: vai à mão" | lido |
| B11 | Um efeito de cada tipo; cura só HP e só em aliado; tirar selos só "todos os negativos" | `mecanica/modelo.ts:453-460`, `:170-171` | Não dá: golpe que sangra E enfraquece; antídoto; recuperar SP; dano + cura em quem usa | lido |
| B12 | Área só nasce de quem usa; não há alcance nem área num ponto | `mecanica/modelo.ts:69-74`; `lib/batalha/area.ts:25` | Granada, "chuva sobre 2 quadrados": não dá | lido |
| B13 | Perfuração parcial não existe na técnica montada | `lib/batalha/golpe.ts:852` | "Perfurante 50%" | lido |
| B14 | Nome vazio vira "Sem nome" GRAVADO, e o botão lê "Remover Sem nome" | `lib/personagem.ts:512`; `FichaAbas.tsx:920` | Apagar o nome e salvar: a técnica passa a se chamar "Sem nome" na ficha e no registro da batalha | lido + dado |
| B15 | Apagar sem confirmação nem desfazer: Remover o cartão, "Tirar a mecânica", e "Recomeçar de um modelo" (que sobrescreve no clique) | `FichaAbas.tsx:534`, `:919`; `MecanicaDaTecnica.tsx:183-191`, `:256`, `:334-339` | Um clique errado apaga a mecânica; só o Cancelar da ficha inteira desfaz | lido |
| B16 | Teste de resistência sem "metade se passar" | `mecanica/modelo.ts:109` | Explosão que dá metade em quem passa: não dá | lido |
| B17 | Requisito ("só contra quem tem o selo X"), 2º golpe, dreno e "gasta item" só existem na tabela à mão | `mecanicasAMao.ts:295`, `:323`, `:336`, `:352` | NPC novo não consegue | lido |

### Baixa

| # | O que | Onde | Como ver | Fonte |
|---|---|---|---|---|
| B18 | Multiplicador com texto inválido fica na tela e não grava (campo solto) | `components/batalha/BlocosDaMecanica.tsx:534-543` | Digitar "abc" ou "0" no multiplicador: a tela mostra, a ficha guarda o valor de antes | lido |
| B19 | Número acima do teto vira "fórmula" e passa (CD 150, cura 9999999) | `BlocosDaMecanica.tsx:158-165` | CD "150": aceita, com o teto em 99 | lido |
| B20 | O cartão recém-criado fecha quando se cria outro | `FichaAbas.tsx:462`, `:531`, `:698` | "+ Habilidade", preencher, "+ Habilidade" de novo: o primeiro fecha | lido |
| B21 | Concentração guardada é gasta à toa numa cura que não "muda com a Concentração" | `mecanica/leitura.ts:214-221`; `mecanicasAMao.ts:1091-1094` | Concentrar e usar a cura fixa: a carga some, a cura é a mesma | lido, não rodado |
| B22 | "Trazer de outra ficha" traz o cartão ainda oculto | `lib/trazerDeOutraFicha.ts:29` | Trazer uma técnica oculta: chega como "???" para o jogador | lido |
| B23 | Alvo "Inimigos" de 1 alvo não é conferido pelo host | `lib/batalha/golpe.ts:640-651` | O pedido forjado acerta um aliado | lido |
| B24 | Fórmula sem dado (1d6), sem recurso (HP perdido, SP atual) e sem atributo de duas palavras | `formula.ts:9-29`, `:215-224` | "2d6 + 10" vai para "Personalizado" (à mão) | lido |

### O que NÃO é erro (conferido)

- Habilidade oculta: o cartão oculto nunca vai ao jogador (`lib/personagem.ts:88-93`, `lib/habilidadeOculta.ts`); a
  técnica oculta sai como "???" no golpe e no selo (`golpe.ts:843`, `:889-892`).
- Subir/Descer mantém o cartão e o rascunho da mecânica (a chave é o id do cartão, `FichaAbas.tsx:525`).
- A fórmula não avalia texto como código; divisão por zero vira "não entende" (`formula.ts:313`).
- A ordem do dano tem uma função só (`reacao.ts:109`).
- Peça torta ou de app mais novo nunca roda pela metade: o cartão vira "à mão" com aviso (`mecanica/modelo.ts:490`).

---

## 4. Conclusão para o desenho

1. O motor sabe fazer bem mais do que a tela deixa montar: a tabela à mão (`MecanicaAMao`) já tem reação, 2º golpe,
   dreno, selo em quem usa, gasto de item, requisito de selo. O caminho mais curto e mais seguro é **abrir essas
   capacidades nas peças**, não escrever um motor novo.
2. A costura já existe e é boa: as peças viram a mesma linha da tabela (`linhaDasPecas`). O sistema novo entra por ela.
3. Item hoje é só coisa. Para ter efeito, ele precisa levar as MESMAS peças da técnica e um pedido "usar item" na
   batalha.
4. Para testar, o Judge-boneco e a mesa em memória já existem: falta o botão que monta tudo sozinho e a "miniaba" que
   conta o passo a passo.
