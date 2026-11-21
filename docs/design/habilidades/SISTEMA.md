# Efeitos: um sistema só para habilidades e itens (21/11/2026)

Desenho para os pedidos 8, 9 e 10 do mestre (21/11). O mapa do que existe e a lista de erros estão em
[ANALISE.md](ANALISE.md). Este arquivo é o plano para o Opus 5.5 construir. Nenhum código do app foi escrito.

**Quem decidiu o quê.** As decisões M1 a M4 são do MESTRE (chegaram pelo coordenador em 21/11). As decisões C1 a C24
são do CLAUDE e esperam a confirmação do mestre (lista na seção 13). Onde o texto diz "decisão C7", é uma delas.

## Em uma página

- **Uma peça só**, a `mecanica` (versão 2), descreve o que uma habilidade, uma arma ou um ITEM faz: custo, ação, alvo,
  teste, dano e uma lista de efeitos (cura, reviver, tirar condição, pôr condição com número, barreira, dreno...).
- **O motor não é reescrito.** Ele já sabe fazer quase tudo por uma tabela programada à mão para as fichas dos
  jogadores. O sistema novo abre essas capacidades nas peças, pelo mesmo ponto de costura de hoje.
- **Reação:** a técnica pode ser marcada "usar no lugar da reação" e dizer o que faz (anula, fica com parte do dano,
  rola um dado, devolve, marca quem atacou, cura).
- **Testar:** um botão no cartão roda a habilidade ou o item num Boneco de treino e mostra, numa miniaba, o passo a
  passo (dado, fórmula, dano ou cura, a reação do alvo, a condição aplicada). Não toca no mapa nem nas fichas.
- **Itens:** o item do Acervo ganha as mesmas peças. Cerca de 25 modelos prontos (poção, antídoto, pluma de reviver,
  granadas). No fim, "Usar item" entra na batalha para jogador, mestre e NPC com ficha.
- **Biblioteca:** o botão "Itens e habilidades" vira duas páginas, cada uma com uma frase dizendo para que serve.
- **Nada se perde:** as técnicas montadas de hoje (versão 1) continuam lidas; as fichas de texto não mudam.

---

## 1. O problema, as restrições e a escolha

**O que o mestre precisa:** montar muita coisa (inclusive reação) sem errar, entender a tela, testar com um clique, e
ter nos itens o mesmo poder das habilidades.

**Restrições reais (conferidas):**
- Um motor, três entradas (mapa, Arena de testes, site do Lobby) pela mesma fábrica (`stores/batalhaFabrica.ts`). Regra
  nova mora em `lib/batalha/**`, senão uma entrada fica diferente da outra.
- 28 fichas reais, 241 cartões, 9 com mecânica montada, cerca de 45 técnicas na tabela à mão. Nenhuma pode mudar de
  comportamento sem o mestre mandar.
- Todo efeito precisa de linha no registro com Desfazer (é a regra da batalha de hoje).
- O jogador não manda número: o host calcula. Vale para item também.
- Dragon Ball (`lib/dbt/**`) é outro motor: fica fora (decisão C22).
- Itens: UMA fonte por personagem (decisão M4). Outro agente está juntando a aba Itens com a mochila agora.

**Abordagens consideradas:**

| | Abordagem | Veredito |
|---|---|---|
| A | **Estender as peças de hoje para a versão 2 e traduzir para a mesma linha do motor** (`linhaDasPecas`) | **Escolhida.** Menor risco: o caminho já roda nas três entradas e tem Desfazer |
| B | Motor novo de efeitos genéricos (eventos, pilha de efeitos) | Rejeitada: reescreve o que funciona e triplica o risco nas 11 fichas dos jogadores |
| C | Linguagem de script por habilidade | Rejeitada (já tinha sido em 08/11): o mestre não programa e o script viajaria pela rede |
| D | Sistema de itens separado do de habilidades | Rejeitada: duas telas, duas regras, dois lugares para errar. O pedido 10 diz "a mesma mecânica" |

---

## 2. Modelo de dados (versão 2 das peças)

Mora onde a versão 1 mora: `CartaoDaFicha.mecanica` (técnica e arma) e, novo, no item (seção 5). A versão 2 é um
SUPERCONJUNTO da 1: toda peça de hoje vale na 2 sem mudar de sentido (decisão C2).

```ts
// client/src/lib/batalha/mecanica/modelo.ts  (esboço; os nomes seguem os de hoje)
export const VERSAO_DA_MECANICA = 2

type Recurso = 'hp' | 'sp' | 'escudo'
type NumeroSimples = { fixo: number } | { formula: string }          // igual à v1
/** Parte da vida ou do SP de alguém: "25% do HP máximo do alvo". */
type Porcento = { porcento: number; de: 'hpMaximo' | 'hpAtual' | 'hpQueFalta' | 'spMaximo'; deQuem: 'alvo' | 'quemUsa' }
type Numero = NumeroSimples | Porcento | { porCarga: [NumeroSimples, NumeroSimples, NumeroSimples, NumeroSimples] }

/** COMO entra em jogo. Ausente = 'ativa' (toda mecânica v1). */
type Uso = 'ativa' | 'reacao' | 'ativaOuReacao'

interface Limite { recarga?: number; usosPorBatalha?: number; porRodada?: number; overload?: true }

/** Além do SP e do HP: gastar coisa da mochila (a Medicina gasta 1 Kit Médico). */
interface CustoEmItem { nome: string; itemId?: string; quantos: number }

type FormaDoAlvo =
  | { tipo: 'um' }
  | { tipo: 'varios'; max: number; dividirDano?: true }
  | { tipo: 'linha'; casas: number }
  | { tipo: 'quadrado'; lado: number; centro: 'si' | 'frente' | 'ponto' }     // 'ponto' é novo
  | { tipo: 'raio'; casas: number; centro?: 'si' | 'alvo' | 'ponto' }         // ausente = 'si' (v1)

interface AlvoDaMecanica {
  quem: 'inimigos' | 'aliados' | 'todos' | 'si' | 'escolha'
  forma: FormaDoAlvo
  alcance?: number                 // em casas; ausente = sem limite conferido (como hoje)
  estado?: 'dePe' | 'caido'        // ausente = 'dePe'; 'caido' = quem está com 0 de vida (reviver)
  exigeSelo?: string               // só vale em quem tem este selo ("Redoma")
}

type Teste =
  | { tipo: 'reacao' }
  | { tipo: 'naoErra' }
  | { tipo: 'resistencia'; alvo: QuemRolaNoTeste; cd: CdDoTeste; sePassar: 'nada' | 'metade' | 'devolveCusto' }  // 'metade' é novo
  | { tipo: 'disputa'; usuario: QuemRolaNoTeste; alvo: QuemRolaNoTeste }

interface DanoDaMecanica {         // um dano por uso, como hoje
  base: NumeroSimples | Porcento
  arma?: 'nenhuma' | 'padrao' | 'perguntar'
  perfurante?: boolean
  perfuracao?: number              // 1 a 99: só esta parte vai direto ao HP ("Perfurante 50%")
  segundoGolpe?: { fracao: number; perfurante: boolean }   // outro golpe nos mesmos alvos, com outra reação
  multiplicadores: { concentracao: boolean; surpresa: boolean; extra?: { nome: string; vezes: number }[] }
}
```

```ts
/** Em quem o efeito cai. 'atacante' só existe na reação (quem bateu em mim). Ausente = 'alvo'. */
type EmQuem = 'alvo' | 'quemUsa' | 'atacante'

/** O que o selo faz além do nome. O nome conhecido (Atordoado, Cego...) continua trazendo a regra dele. */
interface RegraDoSelo {
  trava?: true                              // só passa a vez e não reage
  tiraSaidas?: ('esquiva' | 'contra')[]
  reageComDesvantagem?: true
  danoRecebido?: number                     // -20 = toma 20% a menos; +50 = toma 50% a mais
  curaRecebida?: number                     // -50 = a cura que recebe cai pela metade
}

type Efeito =
  | { tipo: 'selo'; nome: string; duracao: number | 'ateTirar' | 'proximoGolpe'; natureza?: 'buff' | 'debuff'; em?: EmQuem
      mods?: { alvo: string; delta: NumeroSimples }[]          // atributo, 'dano' ou 'reacao'; delta negativo tira
      porTurno?: { recurso: 'hp' | 'sp'; quanto: { fixo: number }; sinal: 'tira' | 'da'; direto: boolean; paraQuemUsa?: number }
      regra?: RegraDoSelo
      seJaTem?: 'renova' | 'ignora' }                            // ausente = põe outro, como hoje
  | { tipo: 'cura'; recurso: Recurso; quanto: Numero; em?: EmQuem }
  | { tipo: 'reviver'; volta: Numero }                           // só em alvo caído
  | { tipo: 'tirarSelos'; quais: 'negativos' | 'positivos' | 'todos' | { nomes: string[] }; em?: EmQuem }
  | { tipo: 'dreno'; recurso: 'hp' | 'sp'; porcentoDoDano: number }   // parte do dano causado volta para quem usa
  | { tipo: 'mover'; como: 'empurrar' | 'puxar'; casas: number }      // fase 9; até lá o app só lembra
  | { tipo: 'aMao'; texto: string }                              // porta de escape, como hoje

/** A técnica usada NO LUGAR da reação (decisão M2). Só com uso 'reacao' ou 'ativaOuReacao'. */
interface Reacao {
  defesa:
    | { tipo: 'anula' }                                          // não toma nada (como a Esquiva)
    | { tipo: 'fica'; porcento: number }                         // toma só esta parte (Defender 90% = 90)
    | { tipo: 'rola'; atributos: string[]; anulaCom: number }    // d20 + o maior mod; total >= anulaCom anula
    | { tipo: 'nenhuma' }                                        // toma o golpe e faz os efeitos (contra-golpe puro)
  devolve?: { divididoPor: number } | { formula: string; somaOQueChegou?: true }   // dano em quem atacou, sem reação
  curaDoQueChegava?: number                                      // % do dano que chegava vira vida
  valeContra?: ('overload' | 'surpresa')[]                       // ausente = só golpe comum
  soOMestre?: true                                               // o jogador vê apagada e pede ao mestre
}

export interface MecanicaV2 {
  versao: 2
  uso?: Uso
  acao: 'simples' | 'bonus' | 'completa' | 'livre' | 'perguntar'  // ignorada quando o uso é só 'reacao'
  custos: Custo[]                                                 // igual à v1 (SP/HP, ao usar, por vez, depois)
  custoEmItem?: CustoEmItem
  limite: Limite
  alvo: AlvoDaMecanica
  teste: Teste
  dano?: DanoDaMecanica
  efeitos: Efeito[]                                               // até 8; vários selos valem (teto de 3)
  reacao?: Reacao
}
```

**Regras do dado (todas conferidas por `lerMecanica`, como hoje):**
- Tudo ou nada por cartão: com `mecanica`, o texto de Custo, Ação, Tempo e Dano é só descrição.
- Chave desconhecida = "mecânica inválida" (o cartão vira à mão com aviso). Versão maior que a do app = "atualize o app".
- `reacao` exige `uso` de reação; `reviver` exige `alvo.estado: 'caido'`; `em: 'atacante'` só dentro de reação;
  cura e reviver não pedem teste nem reação do alvo.
- Tetos de hoje continuam (8 efeitos, fórmula de 200 letras, CD até 99). O número digitado acima do teto é recusado
  com a frase certa (conserta o B19).

---

## 3. Catálogo de efeitos

"Motor hoje" diz se a regra já roda (pela tabela à mão ou pelo texto) e só falta abrir na peça, ou se é regra nova.

| O que o mestre quer | Peça | Motor hoje | Fase |
|---|---|---|---|
| Dano em 1 alvo, por fórmula | `dano.base` | roda | pronto |
| Dano em área em volta, à frente, em linha | `alvo.forma` | roda | pronto |
| Dano em área LONGE (granada, chuva) | `forma.centro: 'ponto'` ou `'alvo'` + `alcance` | **novo** (`area.ts` só mede de quem usa) | 6 |
| Dano dividido entre vários | `varios.dividirDano` | roda | pronto |
| Dois golpes | `dano.segundoGolpe` | roda por tabela (`segundoGolpe`) | 5 |
| Perfurante parcial | `dano.perfuracao` | roda no texto (`golpe.perfuracao`) | 5 |
| % da vida do alvo dentro de uma conta | `Porcento` na base, ou a fórmula aceitar o termo | parte roda (sozinho) | 5 |
| Cura de HP | `cura` | roda | pronto |
| Recuperar SP, dar Escudo (barreira) | `cura.recurso: 'sp' / 'escudo'` | **novo**, pequeno (hoje a cura só mexe no HP) | 5 |
| Cura em área | `cura` + `alvo.forma` em aliados | roda | pronto |
| Reviver | `reviver` + `alvo.estado: 'caido'` | **novo** | 6 |
| Antídoto, colírio (tira UMA condição) | `tirarSelos.quais: { nomes }` | **novo**, pequeno (hoje tira todos os negativos) | 5 |
| Tira todas as negativas | `tirarSelos: 'negativos'` | roda | pronto |
| Debuff com duração e teste | `selo` + `teste` | roda | pronto |
| Buff ou debuff COM NÚMERO (Força +20, Reação +5) | `selo.mods` | roda no texto (`SeloDoGolpe.mods`) | 5 |
| Vários selos no mesmo golpe | lista de `selo` | **novo**, pequeno (hoje o golpe leva 1) | 5 |
| Selo em quem usa (postura, "+8 em reação") | `selo.em: 'quemUsa'` | roda por tabela (`seloEmQuemUsa`) | 5 |
| Veneno, sangramento, queimadura por vez | `selo.porTurno` (tira) | roda (botão Aplicar do mestre) | pronto |
| Regeneração por vez | `selo.porTurno` (dá) | **novo**, pequeno | 5 |
| Dreno por vez (alvo perde SP, quem usa ganha) | `porTurno` com `paraQuemUsa` | roda por tabela (`drenoNoFimDaVez`) | 5 |
| Roubo de vida | `dreno` | roda por nome de selo (`curaDoDano`) | 5 |
| Redução de dano, cura cortada | `selo.regra.danoRecebido / curaRecebida` | roda para raça e forma; a cura cortada é só lembrete | 5 |
| Metade do dano se passar no teste | `sePassar: 'metade'` | **novo**, pequeno | 5 |
| Só vale contra quem tem o selo X | `alvo.exigeSelo` | roda por tabela (`soContraOSelo`) | 5 |
| Gasta um item da mochila | `custoEmItem` | roda por tabela (`gastaItem`) | 5 |
| **Reação com técnica** | `uso` + `reacao` | roda por tabela e texto | 4 |
| Empurrar, puxar | `mover` | à mão (o mestre move a ficha) | 9 |
| Invocar | fica no sistema de Invocação de hoje | roda (sistema próprio) | fora |
| Passiva com gatilho | fica no texto + lembrete de hoje | roda como lembrete | 9 |

**Crítico:** continua como é (o 1 natural no d20 de quem REAGE = x1,5). Não entra dado de crítico do atacante
(decisão C9). Golpe furtivo ou em ponto vital continua pelo multiplicador com nome.

---

## 4. Técnica de reação

**Decisão M2 (do mestre):** "Podem ser usadas no lugar da reação para fazer algo." Quando a batalha pede a reação do
alvo, ele pode gastar a reação NESTA técnica em vez de rolar o d20.

O motor já faz isso para técnica de texto (`lib/batalha/reacaoComTecnica.ts`); a versão 2 só deixa MONTAR.

**Como fica na mesa:**
1. Um golpe chega em mim. A caixa REAÇÃO abre com "Rolar o d20" e, embaixo, um botão para cada técnica de reação que
   eu tenho ("Usar Bloqueio"). Técnica sem SP, em recarga ou já usada aparece apagada com o motivo (já é assim).
2. Clico na técnica ANTES de rolar. Depois do dado, não troco mais (regra de hoje, mantida: decisão C5).
3. O app cobra o custo, marca recarga e usos, e resolve o golpe conforme a `defesa`:
   - **anula**: não tomo nada;
   - **fica com N%**: tomo só N% do dano que chegava;
   - **rola**: o app rola d20 + meu maior modificador entre os atributos escolhidos; com o total igual ou acima do
     número marcado, anula; abaixo, tomo inteiro (o 1 natural segue crítico);
   - **nenhuma**: tomo o golpe e só os efeitos acontecem.
4. Depois, os efeitos da técnica: selo em quem atacou (`em: 'atacante'`), selo ou cura em mim (`em: 'quemUsa'`),
   `devolve` (dano em quem atacou, sem reação dele), `curaDoQueChegava`.
5. Linha no registro: "X reage com Bloqueio: tomou 45 de 90", com Desfazer.

**Regras (decisões C5 e C6, do Claude):**
- Não gasta a ação da vez (regra de hoje). Uma técnica por golpe: reação é uma só.
- Limites: recarga, usos por batalha e o novo `porRodada` (padrão: sem limite por rodada; o mestre liga em "Limites").
- Atordoado e Paralisado não reagem, nem com técnica (regra de hoje).
- Contra Overload só vale a técnica que marcar `valeContra: ['overload']` ou que for ela mesma Overload; contra
  Surpresa, só a que marcar `'surpresa'` (regras de hoje, agora montáveis).
- Uso `ativaOuReacao` (a dupla "Reação/Ação Completa"): a mesma técnica aparece no menu da vez (faz dano, alvo, teste)
  e na caixa REAÇÃO (faz a `reacao`). Custo e recarga são os mesmos nos dois usos.
- Reagir pelo aliado (o "perto" do Aplauso) e gatilhos como "inimigo entrou no alcance" e "começo da vez" NÃO entram
  agora: hoje o app não sabe quem entrou onde. Ficam como lembrete do mestre (fase 9, sob demanda; decisão C17).

**Onde mexe:** `mecanica/modelo.ts` (peças), `mecanica/leitura.ts` (`acaoDasPecas` passa a dizer `tambemReacao`; a linha
ganha `reacao`), `tiposDaHabilidade.ts:74` (`lerTipo` lê o `uso` das peças no cartão montado), `reacaoComTecnica.ts:115`
e `:325` e `mecanicasAMao.ts:1047`, `:1204-1216` (as funções que hoje recebem só o id passam a receber o cartão, como
`mecanicaDoCartao` já aceita).

---

## 5. Itens com efeito

**Decisão M4 (do mestre):** uma fonte só por personagem. O desenho usa a lista única de vagas (a mochila) que o outro
agente está fechando. Nada aqui cria um segundo lugar para guardar item.

**Decisão M3 (do mestre):** "Jogador, Mestre, Npc com ficha, quando tudo tiver pronto bota na batalha usar item."

### 5.1 Onde o efeito mora

```ts
// lib/acervoDeItens.ts: o item do Acervo ganha um campo opcional
interface ItemDoCatalogo { /* ...o de hoje... */ efeito?: EfeitoDoItem }

// types/map.ts (DadosDoItem): vai com a cópia dada, como `luz` e `municoes` já vão
interface DadosDoItem { /* ...o de hoje... */ efeito?: EfeitoDoItem }

interface EfeitoDoItem {
  mecanica: MecanicaGuardada          // as MESMAS peças da técnica (versão 2), lidas por `lerMecanica`
  gasta: 'um' | 'nada'                // 'um' = cada uso tira 1 da pilha (poção); 'nada' = não acaba (amuleto)
  onde: 'sempre' | 'soNaBatalha' | 'soFora'
}
```

- A mecânica do item não usa `custos` em SP por padrão (o custo é o próprio item) e usa `acao` (decisão C7: Ação
  Simples de fábrica; o mestre troca para Bônus ou Livre por item).
- Fórmula de item pode usar os atributos de QUEM USA ("50 + Espírito"), mas os modelos vêm com número fixo: poção cura
  igual na mão de qualquer um.
- **O que o jogador recebe:** a vaga dele leva só um resumo em frase (`efeitoResumo`, até 200 letras: "Cura 100 de HP.
  Gasta 1."), não as peças. O host lê o efeito da cópia DELE e o pedido do jogador traz só o id da vaga (decisão C8):
  o pacote da mochila fica leve e ninguém forja efeito.

### 5.2 "Usar item" na batalha (última fase, decisão M3)

```
menu da vez: [Atacar] [Habilidades] [Itens] ...
   Itens -> lista das vagas com efeito (as sem efeito não aparecem) -> a MESMA mira do golpe
   pedido { tipo: 'item', vagaId, alvos }  -> host: acha a vaga na mochila de quem usa, lê as peças,
   monta a "técnica" do item (como a arma montada já faz, golpe.ts:357) -> podeAgir -> lancarGolpe
   -> tira 1 da pilha (o mesmo caminho da munição) -> registro com Desfazer (devolve o item)
```

- **Quem usa:** o jogador (da mochila do personagem dele), o mestre (de qualquer ficha) e o NPC com ficha (da mochila da
  ficha dele, pelo painel da vez do NPC). NPC sem ficha não tem mochila: o mestre usa "Dar dano" como hoje.
- **Em quem:** em si, em aliado ou em inimigo, conforme `alvo.quem`. Item de toque (poção no colega) pede o colega a até
  1 casa; item arremessado (granada) tem `alcance` (decisão C7). Como a área hoje, o alcance pré-marca na mira e o
  mestre confere.
- **Fora da batalha:** o botão "Usar" na vaga da mochila (ficha do jogador e do mestre) aplica cura, tira condição e
  gasta o item, com aviso no chat. Só os itens que não pedem alvo inimigo nem teste; granada fora da batalha é "Dar
  dano" do mestre (decisão C19).
- **Vida a 0 e reviver:** o item de reviver só marca quem está caído (0 de vida) e ainda na ordem. Premissa a validar
  na fase 6: o que o app faz hoje com a ficha a 0 (ela fica na ordem com a carta apagada?). O `programador` confere em
  `lib/batalha/turnos.ts` e `lib/livros/combate.ts` (`fichaSemHp`) antes de desenhar a mira do caído.

---

## 6. Testar (um botão)

**Decisão M1 (do mestre):** "Boneco de Treino e uma miniaba para ver o que tá acontecendo tipo um preview."

### 6.1 O que o mestre vê

- No cartão da habilidade (aberto para editar ou só lendo), na entrada da página Habilidades e no item da página
  Itens: botão **Testar**.
- Abre a miniaba **Teste** ao lado (em tela estreita, por cima), sem sair de onde está:

```
+--------------------------------------------------------------+
| TESTE: Corte que sangra            [Testar de novo] [Fechar] |
| Quem usa: (a ficha aberta)   Alvo: Boneco de treino  [mudar] |
| Concentração: 0 1 2 3        Dado do alvo: sorteado | fixo 12|
+--------------------------------------------------------------+
| 1 Custo        30 SP           SP 120 -> 90                  |
| 2 Alvo         Boneco de treino (1)                          |
| 3 Fórmula      50 Força + 20 + 8 Espada = 78                 |
| 4 Reação       d20 12 + 0 = 12 -> Defende (metade)           |
| 5 Dano         78 x 0,5 = 39   Escudo 20 -> 0, HP 500 -> 481 |
| 6 Condição     Sangrando por 3 vezes do alvo (10 por vez)    |
| 7 Depois       recarga 2; usos 1 de 3                        |
+--------------------------------------------------------------+
| [Passar 1 vez do alvo]  -> Sangrando: -10 HP (HP 471), 2     |
+--------------------------------------------------------------+
```

- **Boneco de treino:** o Judge-boneco da Arena (`lib/arena/boneco.ts`), com ajustes: HP (ou infinito), Escudo,
  atributos (para o teste de resistência), como reage (rola d20, parado, sempre passa, sempre falha), condições com
  que começa (para testar antídoto) e "caído" (para testar reviver). Em área: de 1 a 6 bonecos já dentro dela.
- **Alvo de verdade:** "mudar" troca o boneco por uma CÓPIA de qualquer ficha da pasta. A ficha de verdade não muda.
- **Reação:** se a técnica é de reação, o teste inverte: o boneco bate (dano ajustável, comum, Overload ou Surpresa) e
  a ficha reage com a técnica.
- **Item:** igual; mostra também "Gasta 1: tinha 3, ficam 2".
- **Recusa também é resultado:** "Não saiu: SP insuficiente (tem 0, custa 30)" aparece como passo 1 em vermelho. É o
  que teria avisado do erro B02.
- **Peça à mão:** aparece como passo "À mão: o mestre confere" (nada é fingido).

### 6.2 Como funciona por baixo

- **Sem segunda regra.** O teste roda o MESMO motor da batalha numa mesa em memória (`MesaDaBatalha`,
  `lib/batalha/mesa.ts`), com cópias das fichas, como a Arena e o treino do site já fazem
  (`lib/arena/copias.ts`, `lib/treino/mesaEmMemoria.ts`). Nenhum cálculo é refeito na tela: os passos saem do que o
  motor devolveu (o golpe lançado, a rolagem, as reversões da linha do registro).
- A cópia da ficha é a do RASCUNHO (o que está na tela, ainda sem salvar), então dá para ajustar um número e testar
  de novo sem gravar nada.
- O d20 entra por parâmetro (o motor já aceita): sorteado, ou fixo quando o mestre quer ver "e se ele tirar 15?".

```ts
// client/src/lib/batalha/ensaio/ensaio.ts  (novo, puro: sem store global, sem rede, sem mapa)
interface PedidoDeEnsaio {
  oQue: { tipo: 'tecnica'; cartao: CartaoDaFicha } | { tipo: 'item'; nome: string; efeito: EfeitoDoItem }
  quemUsa: Personagem                      // cópia do rascunho
  sistema: SistemaDeRpg
  alvo: { tipo: 'boneco'; ajustes: AjustesDoBonecoDeTreino; quantos: number } | { tipo: 'ficha'; personagem: Personagem }
  carga: 0 | 1 | 2 | 3
  dados?: readonly number[]                // d20 fixos, na ordem em que o motor pede; ausente = sorteia
  comoReacao?: { dano: number; tipo: 'comum' | 'overload' | 'surpresa' }
}
interface PassoDoEnsaio {
  tipo: 'recusa' | 'custo' | 'alvos' | 'formula' | 'teste' | 'reacao' | 'dano' | 'cura' | 'reviveu' | 'selo' | 'tirouSelo' | 'depois' | 'aMao'
  titulo: string                           // "Reação"
  texto: string                            // "d20 12 + 0 = 12: Defende (metade)"
  de?: number; para?: number; recurso?: string
}
interface ResultadoDoEnsaio { passos: PassoDoEnsaio[]; estado: unknown /* a mesa depois, para o "Passar 1 vez" */ }
export function ensaiar(pedido: PedidoDeEnsaio): ResultadoDoEnsaio
export function passarUmaVez(estado: unknown): ResultadoDoEnsaio
```

Decisão C12 (do Claude): o teste é uma peça nova e pequena (`lib/batalha/ensaio/` + `components/ensaio/`), que reusa o
boneco e as cópias da Arena. Não é um modo da Arena: a Arena continua sendo a luta inteira; o Teste é um golpe só.

---

## 7. Biblioteca em duas páginas

Hoje: um marcador "Itens e habilidades 192" (`components/livros/MundoDoLivro.tsx:44`). Fica assim:

| Marcador | Frase no topo da página | O que lista | Número |
|---|---|---|---|
| **Itens** | "As coisas que os personagens carregam e usam: poção, arma, granada, chave. Crie o item, diga o que ele faz, teste e dê a uma ficha." | Acervo do app + armas e itens do catálogo do livro. Filtros: Tudo, Com efeito, Armas, Consumíveis, Munição, o resto das categorias | itens do Acervo + armas e itens do catálogo |
| **Habilidades** | "Os golpes e poderes das fichas. Monte por um modelo, teste no boneco e ponha na ficha de quem vai usar." | Habilidades do catálogo. Filtros: Tudo, Ataque, Cura e apoio, Condição, Reação, e "Do livro" (Perícias, Vantagens, Desvantagens) | habilidades do catálogo + as do livro |

- Arma fica em **Itens** (é coisa que se carrega; a regra dela vai junto) e perícia, vantagem e desvantagem ficam em
  **Habilidades**, no filtro "Do livro" (decisão C10).
- Cada entrada mostra o resumo em frases da mecânica e os botões **Testar**, **Editar**, **Pôr em [ficha]**.
- "Nova habilidade" e "Novo item" abrem pelos MODELOS (seção 9), não por um formulário vazio.
- A entrada do catálogo passa a guardar a `mecanica` (conserta o B04): `lib/livros/catalogo.ts` ganha o campo opcional;
  "Pôr em" e "Juntar das fichas" levam a mecânica junto.
- Onde mexe: `MundoDoLivro.tsx:39-47`, `:65`, `:160-170`; `stores/mundoDoLivroStore.ts:28` (`AbaDoMundo` ganha
  `'habilidades'`); `PaginaItens.tsx` vira duas páginas com as peças comuns num arquivo só;
  `EntradaDoCatalogoDialog.tsx` ganha o bloco Mecânica.

---

## 8. A tela de montar: simples primeiro

O sistema é grande; a tela não pode ser. Três degraus (decisão C14):

1. **Modelo.** "O que esta habilidade faz?" em botões grandes por grupo: Ataque, Cura e apoio, Condição, Reação.
   Um clique monta tudo. O modelo APROVEITA o que o cartão já diz: se o Dano de texto é "80", o modelo entra com 80; se
   o Custo é vazio e a ficha tem 0 de SP, entra sem custo (conserta o B02).
2. **Os números.** Só as 3 ou 4 linhas que aquele modelo usa, em frase: "Dá [Força + 20] de dano em [1 inimigo]. Custa
   [30] [SP]. Deixa [Sangrando] por [3] vezes." O resumo em frases e o botão **Testar** ficam sempre à vista.
3. **Avançado (dobrado).** Os blocos de hoje (custo, ação, alvo, teste, dano, efeitos, limites) mais os novos
   ("Quando usa": na vez, no lugar da reação, os dois). Quem não abre, não vê.

Outras regras da tela:
- Com mecânica, os campos de texto Ação, Custo, Tempo e Dano somem da edição e ficam num dobrado "Texto antigo (só
  descrição)" (conserta o B08). Nada é apagado.
- "+ Opção" e "+ Evolução" no cartão montado avisam: "na técnica montada isto só muda o texto do registro" até a fase
  que montar opções de verdade (conserta o B09 sem prometer o que não faz).
- Nome vazio: o campo fica vermelho com "Dê um nome", e o Salvar não grava "Sem nome" (B14). O botão vira "Remover" com
  o nome só para leitor de tela; remover cartão com mecânica pede confirmação e dá "Desfazer" (B15).
- A tecla "% da vida do alvo" passa a valer dentro da conta, ou sai da fileira e vira uma opção "Dano pela vida do alvo"
  (B10; o `programador` escolhe a que mexer menos na gramática).
- `BlocosDaMecanica.tsx` (775 linhas) se divide num arquivo por bloco antes de crescer.

---

## 9. Modelos prontos

Números de partida calibrados pelas fichas da mesa (HP 300 a 1100, SP 60 a 240, atributos até 100). Nomes e textos
originais; de Final Fantasy e Resident Evil vem só a ideia da mecânica (decisão C13). O mestre troca nome e número.

Leitura da tabela: custo · ação · alvo · como acerta · o que faz · limite.

### 9.1 Habilidades (22)

| # | Modelo | Peças |
|---|---|---|
| H01 | Golpe simples | 30 SP · Simples · 1 inimigo · reage · dano Força + 20 |
| H02 | Golpe em área | 50 SP · Completa · inimigos no 3x3 à frente · reage · dano Força + 20 · recarga 2 |
| H03 | Giro | 30 SP · Simples · inimigos a 1 casa em volta · reage · dano Força + Agilidade + 30 · recarga 1 |
| H04 | Disparo em linha | 20 SP · Simples · todos numa linha de 6 · reage · dano Espírito + 20 · recarga 1 |
| H05 | Explosão à distância | 40 SP · Completa · todos a 1 casa de um ponto, alcance 6 · teste de Agilidade CD 13, metade se passar · dano Espírito + 30 · recarga 2 |
| H06 | Golpe perfurante | 35 SP · Completa · 1 inimigo · reage · dano Força + 50, perfuração 100% (ou 50%) · recarga 3 |
| H07 | Golpe duplo | 40 SP · Completa · 1 inimigo · reage · dano Força + Espírito + 20; 2º golpe com metade, perfurante · recarga 3 |
| H08 | Corte que sangra | 30 SP · Simples · 1 inimigo · reage · dano Força + 20 + Dano da Arma · Sangrando 3 (10 por vez) |
| H09 | Atordoar com teste | 30 SP · Simples · 1 inimigo · teste de Resistência CD 12 · sem dano · Atordoado 1 · recarga 2 |
| H10 | Enfraquecer | 20 SP · Simples · 1 inimigo · reage · sem dano · selo Enfraquecido 2: Força -20, Dano -10 |
| H11 | Cura | 30 SP · Simples · 1 aliado · sem teste · cura Espírito + 50 de HP |
| H12 | Cura em área | 50 SP · Completa · aliados a 2 casas em volta · cura Espírito de HP · recarga 3 |
| H13 | Purificar | 30 SP · Simples · 1 aliado · tira as condições negativas e cura 30 · 2 usos por batalha |
| H14 | Reviver | 60 SP · Completa · 1 aliado caído · volta com 25% do HP máximo · 1 uso por batalha |
| H15 | Buff em aliado | 20 SP · Bônus · 1 aliado · selo Fortalecido 2: Força +20 |
| H16 | Barreira | 30 SP · Simples · 1 aliado · +50 de Escudo · recarga 2 |
| H17 | Dreno de vida | 35 SP · Simples · 1 inimigo · reage · dano Espírito + 20; quem usa recupera 50% do dano · recarga 2 |
| H18 | Esquiva perfeita (reação) | 25 SP · no lugar da reação · anula o golpe · Marcado 3 em quem atacou · recarga 3 |
| H19 | Bloqueio (reação) | 20 SP · no lugar da reação · fica com 50% do dano · recarga 2 |
| H20 | Aparar (reação com dado) | 30 SP · no lugar da reação · d20 + maior mod de Força ou Agilidade; 15 ou mais anula · recarga 3 |
| H21 | Contra-golpe (reação) | 25 SP · no lugar da reação · fica com 90% do dano e devolve metade dele em quem atacou · recarga 4 |
| H22 | Overload | 100 SP · Completa · 1 inimigo · não erra · dano (Força + Espírito) + 100, perfurante · Atordoado 2 · Overload (1 por batalha) |

### 9.2 Itens (25)

Todos: Ação Simples, gasta 1 por uso, sem custo de SP. "Toque" = em si ou num aliado a até 1 casa.

| # | Modelo | Ideia de origem | Peças |
|---|---|---|---|
| I01 | Poção Pequena | poção comum | toque · cura 50 de HP |
| I02 | Poção Grande | poção forte | toque · cura 100 de HP (é a "Porção Grande" do Acervo de hoje) |
| I03 | Poção Suprema | poção máxima | toque · cura 50% do HP máximo |
| I04 | Tônico de Fôlego | frasco de energia | toque · recupera 30 de SP |
| I05 | Tônico Maior | frasco de energia forte | toque · recupera 50% do SP máximo |
| I06 | Elixir Completo | elixir | toque · HP e SP cheios |
| I07 | Elixir do Bando | elixir de grupo | aliados a até 2 casas de quem usa · 50% do HP máximo e 50% do SP máximo em cada um |
| I08 | Pluma do Retorno | item de reviver | toque em aliado caído · volta com 25% do HP máximo |
| I09 | Pluma Dourada | reviver completo | toque em aliado caído · volta com o HP cheio |
| I10 | Antídoto | cura de veneno | toque · tira Envenenado |
| I11 | Colírio | cura de cegueira | toque · tira Cego |
| I12 | Sais de Despertar | cura de paralisia | toque em OUTRO (quem está travado não usa) · tira Atordoado e Paralisado |
| I13 | Bandagem | curativo | toque · tira Sangrando e cura 20 de HP |
| I14 | Pomada Fria | cura de queimadura | toque · tira Queimando |
| I15 | Panaceia | remédio geral | toque · tira todas as condições negativas |
| I16 | Erva Verde | erva de cura | toque · cura 25% do HP máximo |
| I17 | Mistura Verde e Rubra | ervas combinadas | toque · HP cheio |
| I18 | Mistura Verde e Azul | erva com antídoto | toque · cura 25% do HP máximo e tira Envenenado |
| I19 | Spray de Primeiros Socorros | spray médico | toque · HP cheio e tira Sangrando |
| I20 | Granada de Estilhaços | granada de mão | todos a 1 casa de um ponto, alcance 6 · teste de Agilidade CD 13, metade se passar · 150 de dano (o número da "Granada" do Acervo de hoje) |
| I21 | Granada de Clarão | granada de luz | todos a 2 casas de um ponto, alcance 6 · teste de Percepção CD 13 · quem falha fica Cego 1 · sem dano |
| I22 | Garrafa Incendiária | granada de fogo | todos a 1 casa de um ponto, alcance 5 · reage · 60 de dano e Queimando 3 (10 por vez) |
| I23 | Frasco de Ácido | granada de ácido | 1 alvo, alcance 4 · reage · 80 de dano com perfuração 50% · selo Corroído 3: Resistência -15 |
| I24 | Tônico de Guerra | comida que fortalece | toque · selo Vigor 3: Força +20 (o "Peixe Leão" do Acervo de hoje) |
| I25 | Fita de Diário | item de salvar | só fora da batalha · à mão: "o mestre guarda este ponto da cena para voltar" |

Variações de um clique: "só fora da batalha" (comida: o Pão cura 30), "não gasta" (amuleto), "em inimigo" (pó
paralisante = o H09 num frasco). Os itens do Acervo de hoje com efeito no texto ganham um botão "Sugerir efeito" que
abre o modelo mais parecido já preenchido; nada é convertido sozinho (decisão C3).

### 9.3 Três exemplos escritos nas peças

```json
{ "versao": 2, "uso": "reacao", "acao": "livre", "custos": [{ "recurso": "sp", "quanto": { "fixo": 20 }, "quando": "aoUsar" }],
  "limite": { "recarga": 2 }, "alvo": { "quem": "si", "forma": { "tipo": "um" } }, "teste": { "tipo": "naoErra" },
  "efeitos": [], "reacao": { "defesa": { "tipo": "fica", "porcento": 50 } } }
```
Bloqueio (H19): no lugar da reação, toma metade.

```json
{ "versao": 2, "acao": "simples", "custos": [], "limite": {},
  "alvo": { "quem": "todos", "forma": { "tipo": "raio", "casas": 1, "centro": "ponto" }, "alcance": 6 },
  "teste": { "tipo": "resistencia", "alvo": { "atributo": "agilidade" }, "cd": { "fixo": 13 }, "sePassar": "metade" },
  "dano": { "base": { "fixo": 150 }, "multiplicadores": { "concentracao": false, "surpresa": false } }, "efeitos": [] }
```
Granada de Estilhaços (I20), dentro de `{ "mecanica": ..., "gasta": "um", "onde": "sempre" }`.

```json
{ "versao": 2, "acao": "simples", "custos": [], "limite": {},
  "alvo": { "quem": "aliados", "forma": { "tipo": "um" }, "alcance": 1 }, "teste": { "tipo": "naoErra" },
  "efeitos": [ { "tipo": "cura", "recurso": "hp", "quanto": { "porcento": 25, "de": "hpMaximo", "deQuem": "alvo" } },
               { "tipo": "tirarSelos", "quais": { "nomes": ["Envenenado"] } } ] }
```
Mistura Verde e Azul (I18).

---

## 10. Migração: nada se perde

| O que existe hoje | O que acontece | Quando |
|---|---|---|
| 9 cartões com mecânica versão 1 | `lerMecanica` lê a 1 e a 2. A 1 é convertida em memória (`migrarV1ParaV2`, função pura e total: muda a versão, o resto é igual). No disco ela só vira 2 quando o mestre EDITAR aquela mecânica e salvar | fase 2 |
| Cartões de texto (as fichas dos jogadores, os "Golpe 80" dos NPCs) | Não mudam. Continuam lidos pelo texto e pela tabela à mão. A ordem do mestre de 08/11 ("as que já existem programe na mão") segue valendo (decisão C3) | sempre |
| Técnica de texto que o mestre QUISER montar | "Montar mecânica" abre já preenchido com o que o texto e a tabela dizem (custo, ação, dano, selo, reação). Ele confere, testa e salva. Enquanto não salvar, vale o texto | fases 0 e 4 |
| Cópias feitas por "Trazer de outra ficha" | O cartão copiado guarda `copiaDe` (o id do original) e a tabela à mão passa a valer nele (conserta o B05). As cópias já feitas antes disso continuam texto: a tela mostra "esta técnica perdeu a regra ao ser trazida; traga de novo" quando o nome bate com uma linha da tabela | fase 0 |
| 44 habilidades do catálogo do livro (só texto) | Continuam. Ganham o campo `mecanica` vazio; "Juntar das fichas" de novo traz a mecânica das que já estão montadas nas fichas (por nome, só nas entradas sem mecânica) | fase 1 |
| 26 itens do Acervo | Continuam iguais (o campo `efeito` é opcional). Índice do Acervo passa da versão 4 para a 5 sem transformar nada. "Sugerir efeito" é um botão, não uma conversão | fase 7 |
| Mochilas das fichas | A vaga ganha `efeito` só para item dado DEPOIS da fase 7. Um botão no Acervo "Atualizar as cópias nas mochilas" leva o efeito às vagas que têm o mesmo `itemId` (com a lista do que vai mudar antes de confirmar) | fase 7 |

**Cópias de segurança (antes da primeira gravação de cada fase que muda formato):** `rpg.json.antes-dos-efeitos`,
`itens.json.antes-dos-efeitos`, `catalogo.json.antes-dos-efeitos`, ao lado dos arquivos, como os consertos de 08/11
fizeram.

**Portão de toda fase que toca o motor (a "regra de ouro" de 08/11):** numa CÓPIA do `rpg.json` real, cada um dos 241
cartões dá a mesma leitura antes e depois (custo, ação, tempo, dano, selo, reação: a saída de `leituraDaTecnica` e de
`mecanicaDoCartao`). Diferença = a fase não fecha.

**App mais velho lendo dado mais novo:** a versão 2 num app que só conhece a 1 aparece como "Mecânica feita num app
mais novo: atualize o app" e o golpe vira à mão; nada é apagado (o cartão guarda a mecânica opaca). O site do Lobby e o
Worker precisam sair junto com a versão do app que grava a 2 (seção 12).

---

## 11. Plano de construção (para o Opus 5.5 xhigh)

Regras do plano: uma fase por vez na batalha (um dono em `lib/batalha/**` e `stores/batalha/**`); cada fase termina
com `rtk proxy npx tsc --noEmit` limpo, o portão das fichas (quando toca o motor) e commit só dos próprios caminhos,
direto na main. As fases 1 e 3 (telas) podem andar ao lado de uma fase de motor, porque os arquivos não se cruzam.
Testes automáticos: seguem a regra do mestre (no máximo 2 por situação; o portão das fichas é uma conferência, não uma
suíte nova). Cada aceite abaixo é algo que o mestre consegue VER.

### Fase 0: consertos que não esperam o sistema novo

- **Faz:** B02 (modelo aproveita Dano, Custo e Ação do cartão; sem SP na ficha, entra sem custo), B05 (`copiaDe`), B07
  (custo por fórmula sem a força do NPC), B08 (texto antigo dobrado), B14 (nome vazio), B15 (confirmar e desfazer), B18,
  B19, B20, B22 (o aviso do "Trazer" diz que veio oculta).
- **Arquivos:** `lib/batalha/mecanica/modelos.ts`, `components/batalha/MecanicaDaTecnica.tsx`, `BlocosDaMecanica.tsx`,
  `lib/batalha/leituraDaTecnica.ts`, `components/FichaAbas.tsx`, `lib/personagem.ts`, `lib/trazerDeOutraFicha.ts`,
  `lib/batalha/mecanicasAMao.ts`.
- **Quem:** `programador-frontend` (telas) depois `programador` (as duas linhas do motor), em sequência.
- **Aceite:** (1) NPC com Dano "80" e 0 de SP: Montar mecânica, Golpe simples: o resumo diz "Dano: 80" e "Não custa
  nada". (2) Trazer a Revigorar para um NPC e usar na Arena: tira as condições e cura. (3) Apagar o nome e salvar: a
  tela pede o nome e não grava "Sem nome". (4) Remover um cartão com mecânica pede confirmação e o Desfazer devolve.
  (5) Portão das fichas sem diferença.

### Fase 1: biblioteca em duas páginas

- **Faz:** seção 7 inteira; conserta o B04.
- **Arquivos:** `components/livros/MundoDoLivro.tsx`, `PaginaItens.tsx` (vira `PaginaItens.tsx` + `PaginaHabilidades.tsx`
  + peças comuns), `EntradaDoCatalogoDialog.tsx`, `icones.tsx`, `itens.css`, `stores/mundoDoLivroStore.ts`,
  `lib/livros/catalogo.ts`, `lib/livros/acervoNoLivro.ts`.
- **Quem:** `designer-opus` (o desenho das duas páginas, por protótipo) e `programador-frontend`.
- **Aceite:** (1) Dois marcadores, "Itens" e "Habilidades", cada um com a frase do topo e o seu número; a soma dos dois
  é o número de hoje. (2) "Juntar das fichas" traz a Bolha COM a cura; "Pôr em" outro NPC e a ficha mostra o resumo da
  mecânica. (3) No mundo do Dragon Ball os dois marcadores somem, como hoje.

### Fase 2: as peças versão 2 (sem tela nova)

- **Faz:** os tipos da seção 2; `lerMecanica` lê 1 e 2; `migrarV1ParaV2`; as funções da tabela que hoje recebem só o
  id passam a receber o cartão (`reacaoAMaoDe`, `disputaNoAcerto`, `rebatePertoDe`, `corpoACorpoDe`,
  `reageContraOverload`, `reageContraSurpresa`, `soOMestreReage`, `motivoDoSeloPedido`, `itensQueSobram`,
  `usosContamOAdicional`). Peça nova que o motor ainda não executa é RECUSADA pela leitura com a frase "este app ainda
  não executa X" (nunca roda pela metade); cada fase seguinte libera as suas.
- **Arquivos:** `lib/batalha/mecanica/modelo.ts`, `leitura.ts`, `resumo.ts`, `migracao.ts` (novo),
  `lib/batalha/mecanicasAMao.ts`, e os que chamam aquelas funções (`reacaoComTecnica.ts`, `golpe.ts`,
  `stores/batalha/golpe.ts`).
- **Quem:** `programador`.
- **Aceite:** (1) Portão das fichas sem diferença. (2) Os 9 cartões montados abrem no editor e salvam sem mudar o
  golpe. (3) Um cartão com `"versao": 3` escrito à mão mostra "atualize o app" e não some ao salvar a ficha.

### Fase 3: Testar (Boneco de treino + miniaba)

- **Faz:** seção 6. Funciona já com tudo o que o motor executa hoje (texto, tabela e peças).
- **Arquivos:** `lib/batalha/ensaio/ensaio.ts`, `passos.ts`, `bonecoDeTreino.ts` (novos; reusam `lib/arena/boneco.ts`,
  `reacaoDoBoneco.ts`, `copias.ts` e a fábrica `stores/batalhaFabrica.ts`), `components/ensaio/PainelDeEnsaio.tsx` e
  `.css` (novos), o botão em `components/batalha/MecanicaDaTecnica.tsx`, `components/FichaAbas.tsx` (cartão lido) e nas
  duas páginas da biblioteca.
- **Quem:** `programador` (o ensaio puro) depois `designer-opus` + `programador-frontend` (a miniaba).
- **Aceite:** (1) Um clique em Testar no "Golpe Com clava" mostra custo, fórmula com os números da ficha, o d20 do
  boneco, o dano no Escudo e no HP. (2) Com o dado fixo em 15 o boneco esquiva e o passo do dano diz 0. (3) "Passar 1
  vez" mostra o Sangrando tirando 10. (4) Depois de 20 testes, a ficha real e o mapa estão iguais (HP, SP, usos). (5)
  Técnica sem SP mostra a recusa como passo 1. (6) O mesmo golpe, com o mesmo dado, na Arena de testes dá o mesmo
  número.

### Fase 4: reação montada

- **Faz:** seção 4; bloco "Quando usa" no editor; modelos H18 a H21; no Testar, o boneco bate e a ficha reage.
- **Arquivos:** `mecanica/modelo.ts` (libera `uso` e `reacao`), `mecanica/leitura.ts`, `mecanica/resumo.ts`,
  `mecanica/modelos.ts`, `lib/batalha/tiposDaHabilidade.ts`, `reacaoComTecnica.ts`, `stores/batalha/golpe.ts`,
  `components/batalha/BlocosDaMecanica.tsx` (dividido por bloco aqui), `TecnicasDaReacao.tsx`, `CaixaDeReacao.tsx`,
  `lib/batalha/ensaio/*`.
- **Quem:** `programador` depois `programador-frontend`.
- **Aceite:** (1) O NPC "Escudo" recebe o modelo Bloqueio; na Arena, atacado, a caixa REAÇÃO mostra "Usar Escudo", ele
  toma metade, paga 20 SP e entra em recarga. (2) Depois de rolar o d20 o botão fica apagado com o motivo. (3) O
  Contra-golpe devolve o dano em quem atacou e o Desfazer devolve tudo. (4) Passo de Valsa, Giro da Lança, Armadura
  Humana, Recuperação de forças e Aplauso (de texto e tabela) reagem igual a antes: portão das fichas.

### Fase 5: efeitos do lote A (o que o motor já sabe, aberto nas peças)

- **Faz:** `selo.mods`, vários selos, `em: 'quemUsa'`, cura de SP e de Escudo, tirar condição por nome, regeneração,
  dreno por vez e roubo de vida, `regra` do selo (dano recebido, cura recebida), perfuração parcial, 2º golpe, "metade
  se passar", `exigeSelo`, `custoEmItem`, `Porcento`; os 3 degraus do editor (seção 8); modelos H01 a H17 e H22 (menos
  H05 e H14, que esperam a fase 6); B09, B10, B11, B13, B16, B17, B21.
- **Arquivos:** `mecanica/*`, `lib/batalha/golpe.ts`, `reacao.ts`, `selos.ts`, `condicoes.ts` (a regra passa a vir do
  nome OU da peça), `formula.ts` (o termo da vida do alvo), `stores/batalha/golpe.ts`, `stores/batalha/selos.ts`,
  `stores/batalha/passivas.ts`, `lib/batalha/registro.ts` (reversão de cada efeito novo), `vistaDoJogador.ts`,
  `components/batalha/BlocosDaMecanica*`.
- **Quem:** `programador` (motor, em 2 ou 3 commits pequenos: selos; curas e tirar; dano), depois `programador-frontend`.
- **Aceite (cada um visto no Testar):** (1) "Buff em aliado": a Força do alvo sobe 20 na conta do próximo golpe dele e
  volta depois de 2 vezes. (2) Golpe com Sangrando E Enfraquecido põe os dois. (3) Barreira soma 50 no Escudo; Tônico
  recupera SP. (4) "Tira Envenenado" deixa o Sangrando. (5) "Perfuração 50%" de 100 de dano com Escudo 80: 50 direto no
  HP, 50 no Escudo. (6) Explosão com o alvo passando no teste: metade. (7) Portão das fichas.

### Fase 6: efeitos do lote B (regra nova no motor)

- **Faz:** área num ponto e em volta de um alvo, `alcance` (pré-marcação na mira, como a área de hoje), reviver e o
  alvo caído; modelos H05 e H14.
- **Antes de codar (validar premissa):** o que a ficha a 0 de vida faz hoje na ordem dos turnos, e como a mira lista
  os caídos (`lib/batalha/turnos.ts`, `lib/livros/combate.ts`, `components/batalha/dadosDoMenu.ts`). Se a ficha a 0 sai
  da ordem, reviver precisa devolvê-la: isso muda o tamanho da fase e o mestre decide antes.
- **Arquivos:** `lib/batalha/area.ts`, `components/batalha/dadosDoMenu.ts`, `MiraDoGolpe.tsx`, `escolhaNoMapa.ts`,
  `lib/batalha/golpe.ts`, `stores/batalha/golpe.ts`, `lib/arena/grade.ts` (a Arena e o Testar marcam o ponto).
- **Quem:** `programador` depois `programador-frontend`.
- **Aceite:** (1) "Explosão à distância" na Arena: escolho uma casa a até 6, a mira marca quem está a 1 casa dela.
  (2) Reviver num caído: volta com 25% do HP e pode agir na próxima vez dele; num de pé, a mira recusa com o motivo.
  (3) Portão das fichas.

### Fase 7: itens com efeito (depois que a mochila única do outro agente estiver na main)

- **Faz:** seção 5.1; o editor do item do Acervo ganha "O que ele faz" (os mesmos 3 degraus, com os 25 modelos);
  Testar no item; o resumo em frase na vaga da mochila; "Sugerir efeito" e "Atualizar as cópias nas mochilas".
- **Arquivos:** `lib/acervoDeItens.ts`, `types/map.ts`, `lib/items.ts` (leitura da vaga), `lib/fogFilter.ts` e
  `net/hostSession.ts` (a vaga do jogador leva só o resumo), `components/AcervoDeItensPanel.tsx`,
  `components/InventarioDaFicha.tsx`, `components/livros/PaginaItens.tsx`, `lib/batalha/mecanica/modelosDeItem.ts`
  (novo), `lib/batalha/ensaio/*`.
- **Quem:** `programador` depois `programador-frontend`.
- **Aceite:** (1) Novo item, modelo "Poção Grande", Testar: "Cura 100 de HP. Gasta 1: tinha 1, fica 0". (2) Dado a um
  jogador, a vaga dele mostra "Cura 100 de HP". (3) Os 26 itens de hoje abrem iguais, e o `itens.json` de antes está
  guardado ao lado. (4) O pacote que vai ao jogador não traz as peças do efeito, só a frase.

### Fase 8: "Usar item" na batalha (decisão M3: por último)

- **Faz:** seção 5.2: pedido novo `{ tipo: 'item' }`, o botão Itens no menu da vez (jogador e mestre), no painel da vez
  do NPC com ficha, o gasto com Desfazer, e o "Usar" fora da batalha.
- **Arquivos:** `lib/batalha/combate.ts` (`PedidoDeAcao`), `golpe.ts`, `acoes.ts`, `stores/batalha/golpe.ts`,
  `stores/batalhaFabrica.ts`, `lib/batalha/registro.ts`, `vistaDoJogador.ts`, `net/protocoloDaBatalha.ts`,
  `net/batalhaNoHost.ts`, `components/batalha/MenuDaVez.tsx`, `dadosDoMenu.ts`, `PainelDaVezDoNpc.tsx`,
  `BatalhaDoJogador.tsx`, `BatalhaDoMestre.tsx`, `components/arena/*`, o treino do site (`lib/treino/duelo.ts`) e o
  Worker do Lobby.
- **Quem:** `programador` depois `programador-frontend`; `automacao-devops` republica o site e o Worker.
- **Aceite:** (1) O jogador, na vez dele, abre Itens, usa a Poção Grande num aliado ao lado: o aliado ganha 100 de HP,
  a pilha desce 1, o registro diz quem usou o quê em quem; Desfazer devolve a vida e a poção. (2) O mestre usa a Granada
  por um NPC com ficha: área, teste, metade para quem passou. (3) O pedido de um jogador com o id de uma vaga que não é
  dele é recusado. (4) Item sem efeito não aparece na lista. (5) Na Arena e no site o mesmo item dá o mesmo resultado.

### Fase 9: sob demanda (não começar sem o mestre pedir)

Passiva com gatilho montada por peças; empurrar e puxar movendo a ficha no mapa; reagir pelo aliado e gatilhos de
posição; cargas de item (3 usos no mesmo frasco); dado na fórmula (2d6); opções e evolução montadas; efeitos no motor
do Dragon Ball.

```
Ordem:  0 consertos -> 1 biblioteca (pode andar ao lado) -> 2 peças v2 -> 3 Testar -> 4 reação
        -> 5 lote A -> 6 lote B -> 7 itens -> 8 usar item na batalha -> 9 sob demanda
```

---

## 12. Riscos e como ver cedo

| Risco | Como aparece | O que fazer |
|---|---|---|
| Mexer no motor muda uma das 11 fichas dos jogadores | Um golpe conhecido dá outro número | O portão das fichas em toda fase de motor; o Testar (fase 3) vira a conferência de cada fase seguinte |
| As três entradas (mapa, Arena, site) ficarem diferentes | O item funciona no mapa e não no site | Regra só em `lib/batalha/**` e na fábrica; o aceite da fase 8 pede o mesmo resultado nas três |
| O site do Lobby ou o Worker com versão velha | "Mecânica feita num app mais novo" para os jogadores do site | Publicar site e Worker junto com a versão do app que grava a versão 2 (fases 2 e 8) |
| Efeito novo sem Desfazer | Desfazer devolve a vida mas não tira o selo novo | Cada efeito novo nasce com a reversão dele em `registro.ts`; o aceite testa o Desfazer |
| O Testar mostrar um número e a batalha outro | Perde a confiança no botão | O Testar não calcula nada: lê o que o motor devolveu. Aceite 6 da fase 3 compara com a Arena |
| A tela de montar virar um painel de avião | O mestre volta a escrever texto | Modelos primeiro, 3 ou 4 linhas, avançado dobrado; o `designer-opus` aprova por protótipo antes de codar |
| Duas fontes de item (o que o outro agente está consertando) | "Tem a bala na mochila e a batalha diz que não tem" | As fases 7 e 8 só começam depois daquele conserto estar na main; o efeito mora na vaga única |
| Pacote da mochila mais pesado (ela vai em todo retrato da cena) | Lentidão com muitos itens | O jogador recebe só a frase do efeito; as peças ficam no host (decisão C8) |
| Jogador forjar efeito ou usar item que não tem | Cura infinita | O pedido traz só o id da vaga; o host lê o efeito da cópia dele e confere a posse e a quantidade |
| Reviver depender de como a ficha a 0 vive na ordem | A fase 6 cresce | Premissa validada ANTES de codar; se for grande, o mestre decide |
| Área longe sem conferência do host | Jogador marca quem está fora | Igual à área de hoje: a mira pré-marca e o mestre confere. Conferir no host fica para depois, se incomodar |
| Arquivos grandes (`golpe.ts` 1340 linhas, `stores/batalha/golpe.ts` 1068) | Conflito entre agentes | Um dono por vez na batalha; fases de tela em arquivos separados |
| Disco cheio (já aconteceu) | Build falha no meio | Conferir o espaço livre antes de cada fase longa (piso de 8 GB) |

---

## 13. Decisões

### Do mestre (21/11/2026, pelo coordenador)

| # | Decisão | Literal |
|---|---|---|
| M1 | Testar = Boneco de treino + miniaba de prévia com o passo a passo | "Boneco de Treino e uma miniaba para ver o que ta acontecendo tipo um preview" |
| M2 | Técnica de reação = usada no lugar da reação normal, para fazer algo | "Podem ser usada no lugar da reação para fazer algo." |
| M3 | Quem usa item: jogador, mestre e NPC com ficha; "Usar item" entra na batalha quando o resto estiver pronto | "Jogador, Mestre, Npc com ficha, quando tudo tiver pronto bota na batalha usar item." |
| M4 | Uma fonte de itens por personagem (a lista única que está sendo fechada agora); nada de segundo depósito | (orientação do coordenador) |

### Do Claude, para o mestre confirmar

| # | Decisão | Se o mestre disser não |
|---|---|---|
| C1 | Habilidade, arma e item usam a MESMA peça (`mecanica`) e o mesmo editor | Volta a opção D da seção 1 (duas telas) |
| C2 | A versão 2 é a 1 com mais campos; a 1 continua lida; vira 2 só quando o mestre edita | Converter tudo de uma vez num botão |
| C3 | Nada é convertido sozinho: nem as fichas de texto, nem os itens com efeito escrito. Só "abrir já preenchido" e "sugerir" | Converter as 11 fichas dos jogadores para peças (reabre a ordem de 08/11) |
| C4 | Até 8 efeitos por habilidade, até 3 condições no mesmo golpe | Outros tetos |
| C5 | A técnica de reação é escolhida ANTES do d20; depois do dado não troca. Uma por golpe. Não gasta ação da vez | Poder trocar depois de ver o dado |
| C6 | Limite da reação: recarga e usos, mais "vezes por rodada" opcional (de fábrica, sem limite por rodada) | Toda reação com técnica valer 1 vez por rodada |
| C7 | Usar item gasta a Ação Simples de fábrica (trocável por item); toque = até 1 casa; arremesso tem alcance | Item como Ação Bônus de fábrica |
| C8 | O jogador vê a frase do efeito, não as peças; o host calcula | Mandar as peças ao jogador |
| C9 | Crítico fica como é (1 natural de quem reage). Sem dado de crítico do atacante | Criar acerto crítico do atacante |
| C10 | Arma fica na página Itens; perícia, vantagem e desvantagem ficam na página Habilidades, filtro "Do livro" | Uma terceira página "Do livro" |
| C11 | As frases do topo das duas páginas (seção 7) | Outro texto |
| C12 | O Testar é peça própria que reusa o boneco da Arena; não é um modo da Arena | Abrir a Arena já montada |
| C13 | 22 modelos de habilidade e 25 de item, com os nomes e números da seção 9 | Trocar nomes e números |
| C14 | A tela em 3 degraus: modelo, os números, avançado dobrado | Mostrar tudo aberto |
| C15 | O modelo aproveita o que o cartão já diz (dano, custo, ação) | O modelo sempre com os números de fábrica |
| C16 | Com mecânica, os campos de texto antigos ficam dobrados em "Texto antigo" | Deixar à vista |
| C17 | Empurrar, puxar, gatilho de passiva e reagir pelo aliado ficam para a fase 9 (até lá, lembrete) | Subir algum deles na fila |
| C18 | Reviver só vale em quem está com 0 de vida e na ordem; volta com a parte do HP que a peça diz | Outra regra de queda |
| C19 | Fora da batalha, "Usar" vale para cura, condição e buff; item de dano fora da batalha é "Dar dano" do mestre | Granada fora da batalha pelo jogador |
| C20 | Item gasta 1 por uso ou não gasta; "cargas" (3 usos no mesmo frasco) só na fase 9 | Cargas já na fase 7 |
| C21 | Granada e explosão pegam TODOS na área, aliados também (o mestre desmarca na mira) | Só inimigos |
| C22 | Dragon Ball fica fora: lá os dois marcadores continuam escondidos | Levar os efeitos ao outro motor |
| C23 | Remover cartão com mecânica pede confirmação e dá Desfazer; "Tirar a mecânica" também | Um clique, como hoje |
| C24 | A ordem das fases (seção 11): consertos, biblioteca, peças, Testar, reação, efeitos, itens, usar item | Outra ordem (por exemplo, itens antes da reação) |

---

## Próximo passo

1. **O mestre confirma** as decisões C1 a C24 (ou muda as que quiser). As que mais mexem no trabalho: C3, C5, C7, C21
   e C24.
2. **Fase 0** para o `programador-frontend`, com este arquivo e o [ANALISE.md](ANALISE.md) como entrada (os erros B02,
   B05, B07, B08, B14, B15, B18, B19, B20 e B22, cada um com arquivo e linha). Ela não depende de nenhuma decisão em
   aberto além da C15, C16 e C23.
3. **Fase 1** (as duas páginas) pode sair ao mesmo tempo com o `designer-opus`: é o pedido 8, o mais visível, e não
   toca na batalha.
