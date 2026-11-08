# Construtor de mecânicas (08/11/2026)

Pedido (08/11, literal): "Acho que com esse grilling da até para você melhor o sistema de fazer Skill né, pode trabalhar
em cima disso, futuramente é provavel ter mecânicas novas e afins mas é bom criar um espaço no programa que aceite tudo isso."
Ajuste do mestre (08/11, literal): "na verdade as que já existem programe na mão mas as proximas pode usufruir já de um
sistema pois npcs normalmente não vão ter super mecanicas especiais."

**O que é:** um jeito de montar uma técnica NOVA (de NPC, na maioria) escolhendo peças numa tela, sem escrever regra em
texto. O motor executa as peças. **O que não é:** migração. As 11 fichas atuais continuam lidas pelo texto como hoje, e
as mecânicas delas entram à mão na F2 do conserto (`docs/planos/conserto-fichas-2026-11-08.md`).

**Abordagens consideradas:**
- A. Continuar lendo texto com mais regex: rejeitada. É de onde vieram B2, B4, B5 e B7 (`docs/auditoria-fichas/00-sistema.md`).
- B. **Peças de dado opcionais no cartão, versionadas. O motor lê as peças quando existem e, senão, o texto.** Escolhida.
- C. Mini-linguagem ou script por técnica: rejeitada. O mestre não programa, e o script viajaria na ficha (LAN e Lobby).
- D. Motor genérico de eventos para qualquer regra: rejeitada. É grande demais para o que um NPC precisa.

## 1. Modelo de dados das peças

Mora no próprio cartão: `CartaoDaFicha.mecanica?` (`client/src/lib/personagem.ts:44`). Sem o campo, o cartão abre e
joga igual a hoje. O padrão é o da ficha DBT: `versao` e um leitor que recusa versão futura (`client/src/lib/dbt/modelo.ts:35`
e `:1020`). Vale para técnica, arma e bala (o efeito da arma com usos sai daqui). Forma e passiva ficam para depois.

```ts
// client/src/lib/batalha/mecanica/modelo.ts (esboço)
export const VERSAO_DA_MECANICA = 1
type Numero =
  | { fixo: number }
  | { formula: string }                                       // a gramática de lerDano: "(Força + Espírito) x 1,5 + 100"
  | { porCarga: [Numero, Numero, Numero, Numero | 'automatico'] }      // Concentração 0..3
  | { pergunta: string; quem: 'usuario' | 'mestre'; sugestao?: Numero } // = "tela do mestre com números livres"
interface Custo { recurso: 'sp' | 'hp'; quanto: Numero | { porcento: number; de: 'maximo' | 'atual' }
                  quando: 'aoUsar' | 'porTurno' | 'depois' }                 // porTurno = lembrete "Aplicar / pular"
type Acao = 'simples' | 'bonus' | 'completa' | 'livre' | 'reacao' | 'perguntar'
interface Limite { recarga?: number; usosPorBatalha?: number; overload?: true }      // overload herda as regras da F1
interface Alvo { quem: 'inimigos' | 'aliados' | 'todos' | 'si' | 'escolha'; alcance?: Numero
  forma: { tipo: 'um' } | { tipo: 'varios'; max: number; dividirDano?: true }
       | { tipo: 'linha'; casas: number } | { tipo: 'quadrado'; lado: number; centro: 'si' | 'frente' | 'ponto' }
       | { tipo: 'raio'; casas: number } }
type Teste =
  | { tipo: 'reacao'; vantagem?: 'alvo'; desvantagem?: 'alvo' }   // o d20 de sempre (10 / 15 / 20)
  | { tipo: 'naoErra' }
  | { tipo: 'resistencia'; atributo: string; cd: Numero; sePassar: 'nada' | 'metade' | 'devolveCusto' }
  | { tipo: 'disputa'; doUsuario: string; doAlvo: string; vantagem?: 'usuario' | 'alvo' }
interface Dano { base: Numero; arma?: 'nenhuma' | 'padrao' | 'perguntar'; perfurante?: boolean | 'perguntar'
  golpes?: number                                                     // 2 = o alvo reage 2 vezes
  multiplicadores: { concentracao: boolean; surpresa: boolean; extra?: { nome: string; vezes: number; perguntar?: true }[] } }
type Efeito =
  | { tipo: 'selo'; nome: string; duracao: number | 'perguntar' | 'ateTirar' | 'fimDaProximaVezDoAlvo' | 'proximoGolpe'
      porTurno?: { recurso: 'hp' | 'sp'; quanto: Numero; direto: boolean }        // sempre com botão Aplicar
      mods?: { alvo: string; delta?: Numero; zerar?: true }[]; tiraSaidas?: ('esquiva' | 'contra')[]
      soLembrete?: string; renova?: true }
  | { tipo: 'cura'; recurso: 'hp' | 'sp'; quanto: Numero; emQuem: 'si' | 'alvo' }
  | { tipo: 'tirarSelos'; quais: 'negativos' | 'todos' }
  | { tipo: 'aMao'; texto: string }                                   // porta de escape: o app só lembra o mestre
interface Ramo { rotulo: string; troca: Partial<Omit<MecanicaV1, 'versao' | 'ramos'>> }
export interface MecanicaV1 {
  versao: 1; acao: Acao; custos: Custo[]; limite: Limite; alvo: Alvo; teste: Teste
  dano?: Dano; efeitos: Efeito[]                                      // no máximo 8
  ramos?: { pergunta: string; opcoes: Ramo[] }                        // "cortante ou perfurante?", "quantos quadrados?"
  // fatias posteriores, opcionais (a v1 sem eles continua válida):
  gatilho?: Gatilho; requisito?: { depoisDe: string; janela: 'mesmaVez' | 'proximaVez' }; invocar?: Invocar
}
// No cartão, fora da mecânica: oculta?: true (o jogador vê "???").
```

Regras do dado:
- **Tudo ou nada por cartão.** Com `mecanica`, Custo, Dano e Efeito em texto viram só descrição. Nada de mistura campo
  a campo, assim nunca fica a dúvida "valeu o texto ou a peça?".
- `lerMecanica(valor: unknown)` confere tudo: tetos de tamanho, fórmula de até 200 caracteres, atributo que o sistema
  tem. Peça torta = `null`, e o cartão vira "à mão" com o aviso "mecânica inválida". Versão maior que a do app = "atualize
  o app". Nesse caso não volta para o texto, que pode estar velho.
- Migração só entre versões da própria peça (`migrar[1→2]` encadeado). **As fichas atuais não migram** (ordem do mestre).
- Só o mestre grava `mecanica` e `oculta`. A edição do jogador parte do personagem gravado e preserva os dois, como já
  faz com `dono` e `combate` (`personagem.ts:164-182`).

## 2. Como o motor executa

O achado que guia o plano: a leitura do cartão está repetida em 3 lugares. Os três montam as mesmas leituras
(`LeituraDoCusto`, `LeituraDaAcao`, `LeituraDoTempo`, `LeituraDoDano`, selo): `tecnicasNoMenu` (`lib/batalha/acoes.ts:264-300`),
`tecnicaPedida` (`lib/batalha/golpe.ts:192-210`) e `tecnicaRecalculada`, do duelo do Lobby (`lib/treino/duelo.ts:337`).
A Saúde lê de novo (`lib/livros/saude.ts:181`). **A costura:** uma função só, `leituraDaTecnica(cartao, ctx)`. Sem
`mecanica`, ela chama os leitores de texto de hoje. Com `mecanica`, traduz as peças para as MESMAS leituras. Na fatia C1,
o resto do motor não percebe a diferença.

| Passo da resolução | Peças | Reaproveita |
|---|---|---|
| 1. Pode usar? | `limite`, `custos`, `acao`, `requisito` | `motivoDaTecnica` acoes.ts:219; `podeAgir` golpe.ts:215 |
| 2. Perguntas na hora | `acao:'perguntar'`, `ramos`, `Numero.pergunta`, arma e perfurante perguntados | chips de `variantesDe` escolhaEEvolucao.ts:146 |
| 3. Quem é atingido | `alvo` | `casasNoCirculo` medicao.ts:94; `casasDaRegua` ferramentasDoJogador.ts:138 |
| 4. Dano base | `dano.base`, `arma` | `lerDano` formula.ts:496 com `ContextoDaFormula` formula.ts:34 (bônus dos selos já entra) |
| 5. Multiplicadores | `dano.multiplicadores` | `danoQueChega` reacao.ts:61, que vira a única dona da ordem |
| 6. Acerta? | `teste` | d20 de reação reacao.ts:26; `podeReagir` golpe.ts:296; o teste da marca marca.ts:134 é o molde |
| 7. Aplica | dano, `efeitos` | `ajustesDoDano` reacao.ts:104 (perfurante); `criarSelo` selos.ts:136; `ajustesDoCusto` golpe.ts:281 |
| 8. Depois | `limite`, custo `depois` | `depoisDaTecnica` golpe.ts:271 |
| 9. Troca de vez | custo e selo `porTurno`, `gatilho` | `passarVez` turnos.ts:398; lembrete "Aplicar / pular" `efeitoPorTurno` passivas.ts:301 |

- **Ordem do dano (fixa, numa função só):** base mais as somas (arma, bala, bônus dos selos) → × concentração →
  × Surpresa → × extras na ordem da lista (furtivo, ponto vital, marca) → divisão entre os alvos (`dividirDano`) → para
  baixo UMA vez, no fim. Bate com o grilling: Polaridade (55 + 30) × 3,5 = 297; Florescer furtivo × Surpresa.
- **Respostas no pedido:** um campo genérico `respostas?: Record<string, string | number>` no `PedidoDeAcao`
  (`combate.ts:273`). O host confere cada resposta contra a peça. Nenhum campo novo por mecânica.
- **Quem calcula:** hoje o host confia no número da tela (golpe.ts:60-61). Na técnica montada, ele recalcula pelas peças
  e respostas, como o duelo já faz (duelo.ts:337), e a tela mostra só a prévia. (Decisão pendente com o mestre: quem pode mudar o número.)
- **Teste novo** em `lib/batalha/mecanica/teste.ts`: o host rola d20 + modificador do rank contra a CD, ou d20 contra
  d20, com vantagem de 2 d20 (a regra da F1). Puro, com o d20 por parâmetro; o Desfazer volta junto com a linha.
- **Peça `aMao`:** não executa nada. Vira linha no registro e lembrete ao mestre ("Batata-mina: confira quem pisou").
- Tudo fica em `client/src/lib/batalha/mecanica/` (modelo, leitura, alvos, teste, dano), puro, sem store. A mesa, o
  duelo, a Arena e o robô usam a mesma regra, e isso evita repetir o B10.

## 3. A tela de editar

No cartão da ficha (`components/FichaAbas.tsx`), botão **"Montar mecânica"**, só para o mestre. O formulário tem 7
blocos na ordem do pipeline, escritos em frases e não em jargão:
1. **Quanto custa:** recurso, número ou %, e se cobra ao usar, a cada vez ou depois.
2. **Que ação gasta:** 6 botões, inclusive "Perguntar na hora".
3. **Em quem pega:** o desenho do alvo (1, vários, linha, quadrado, raio) e se pega só inimigos, aliados ou a escolher.
4. **Como acerta:** o alvo reage normal, não erra, o alvo testa [atributo] contra [CD], ou disputa.
5. **Quanto dano:** caixa de fórmula com os atributos em botões e prévia ao vivo ("= 257 com a ficha de hoje"), mais os
   interruptores de concentração, Surpresa e arma.
6. **O que deixa:** os selos prontos (`SELOS_PRONTOS`, selos.ts:38), com duração e "tira X por vez (botão Aplicar)".
7. **Limites:** recarga, usos por batalha, Overload.

Blocos que não se aplicam ficam fechados. No topo há **modelos prontos** ("Golpe simples", "Golpe em área", "Debuff
com teste", "Buff em aliado", "Cura") e **"Copiar de outra técnica"**: um NPC sai em 3 cliques. Embaixo, um **resumo em
frases** gerado das peças: "Gasta 30 SP e a Ação Simples. Acerta 1 inimigo, que reage normal. Dano Força + 20 (= 80).
Se acertar: Atordoado por 1 vez." Uma etiqueta diz "o motor faz tudo" ou "tem 1 peça à mão". A Saúde da ficha conta o
cartão montado como automático.
- **O que o jogador vê:** o resumo em frases e os números calculados, sem editar nada. Cartão com `oculta` aparece como "???".

## 4. As mecânicas do grilling cabem nas peças? (prova de que o modelo aguenta, NÃO lista de migração)

Legenda: **cabe**; **falta X** (peça pequena a acrescentar); **à mão** (vai na peça `aMao`, de propósito).

| Mecânica (ficha) | Peças | Estado |
|---|---|---|
| SP fixo; bloqueada sem SP (Sai Dai Rin 105/60) | `custos` + passo 1 | cabe |
| 10% do HP máximo (Chamas Celestes) | `porcento`, `de:'maximo'` | cabe |
| "Perde 200 de HP" depois (Sai Dai Rin) | `Custo.quando:'depois'` | cabe |
| Custo por vez ao manter (Giro, formas) | `quando:'porTurno'` | cabe (na forma, fatia posterior) |
| Usos por batalha (Medicina 3, Boomerang 3) | `limite.usosPorBatalha`, mecânica na arma | cabe |
| Ataque extra 2 por batalha mesmo trocando de forma (Ignição) | o uso conta pelo efeito, não pelo cartão | falta: chave de uso por efeito |
| Overload: não erra, Completa, 1 por batalha, metade dos atributos | `limite.overload` + regras da F1 | cabe |
| Ação perguntada (transformação) | `acao:'perguntar'` | cabe |
| Dividir entre até 3 (Lua Incandescente) | `varios`, `max 3`, `dividirDano` | cabe |
| Linha reta (Projeção), 6x6 à frente (Aplauso), a 1 casa (Giro de Pá) | linha / quadrado / raio + `quem:'inimigos'` | cabe |
| Cortante ou perfurante (Projeção) | `ramos` | cabe |
| ESP do alvo contra 12 + mod. de CAR (dança da Aira) | `teste.resistencia`, `cd:{formula}` | falta: `mod(Atributo)` na fórmula |
| CD por carga 11/14/acerta (Vagn); carga 1-2 sobe a CD, 3 automático (Aira) | `cd:{porCarga}` | cabe |
| Pontos de Proficiência em Fruta na CD | `Numero.pergunta` (não é atributo) | cabe, perguntando |
| Disputa de FOR com vantagem contra RES (Corta Cenoura) | `teste.disputa` | cabe |
| Passou no teste, devolve SP e uso (Explosão) | `sePassar:'devolveCusto'` | cabe |
| Desvantagem na esquiva (Olhar artístico); Ryoko escolhe entre 2 | `teste.reacao.desvantagem`; `ramos` | cabe |
| Fórmula com atributos e arma (Sai Dai Rin 257, Pá) | `dano.base`, `arma` | cabe |
| Pergunta a arma, com a padrão marcada (Siegfried) | `arma:'perguntar'` | cabe |
| 100/135/151 por quadrado empurrado (Grande Chifre) | `ramos` 1/2/3, cada um com sua fórmula | cabe (o empurrão em si fica à mão) |
| Ponto vital ×1,5 (Quebra-Queixo); furtivo ×3 com Surpresa ×1,5 (Florescer) | `multiplicadores.extra` | cabe |
| Dois golpes, reação 2 vezes (Rapid Dash) | `dano.golpes: 2` | cabe |
| Concentração aumenta o alcance (Rapid Water) | `alcance` como `Numero` com `porCarga` | cabe |
| +20 de dano e −10 SP opcional (Electro, Imbuir Fogo) | `ramos` sim/não | cabe |
| Atordoado 1, Queimando renovado, Sangramento 10×3 direto no HP; Redoma até o próximo golpe | `selo` + `porTurno`, `renova`, `proximoGolpe` | cabe |
| Aéreo até o fim da próxima vez, sem esquiva/contra; Cego zera PER; Ferido por prata só lembra | `fimDaProximaVezDoAlvo`, `tiraSaidas`, `mods.zerar`, `soLembrete` | cabe |
| Remove tudo (Revigorar) / dobra os debuffs (Explosão) | `tirarSelos` / — | cabe / à mão |
| Cura 100, concentração 150/200/350 (Medicina); 20% do ESP num atributo escolhido (Bênção) | `cura` + `porCarga`; `mods.delta` por fórmula + `ramos` | cabe (roubo de vida 10%: falta, gatilho) |
| Números do mestre (Sulong, super lobo) | `Numero.pergunta`, `quem:'mestre'` | cabe (C6) |
| Início do combate, começo da vez, cai a 0, alguém chega perto, preso tenta agir | `gatilho` | C8 (sempre lembrete) |
| Orquídea → Florescer; lobos, Planta, Lovecats; habilidade oculta | `requisito`; `invocar` + ficha própria; `oculta` | C9; C10 (plano próprio); C7 |
| Armadilha que dispara ao pisar (Batata-mina, Emaranhalga) | objeto no mapa + gatilho | à mão |
| Pergunta a CADA alvo "tem metal?" (Imã-Gumelo) | a pergunta é de quem usa, não do alvo | à mão |
| Rebater Overload perto (May); básico melhor enquanto o aliado tem a Bênção (Aira) | reação a evento de outra ficha; condição cruzada | à mão |
| Lobo a cada Atacar durante a forma (Caçada); Defender 90% ou devolver ÷7 (Armadura Humana) | gatilho + invocação na forma; saída de reação própria | à mão |

Saldo: quase tudo cabe nas peças comuns ou na C8. O que fica à mão é regra entre fichas ou objeto no mapa, raro em NPC.

## 5. Fatias de entrega (em ordem; 1 dono por vez na batalha; no máximo 2 testes por situação)

| Fatia | Entrega | Pronto quando | Risco |
|---|---|---|---|
| **C1** Modelo e costura | `mecanica/modelo.ts`, `lerMecanica`, `leituraDaTecnica` única nos 4 leitores; peças custo, ação, limite, dano por fórmula, perfurante, 1 selo com duração | um NPC de teste com mecânica dá o mesmo golpe que o texto equivalente; os cartões das 11 fichas leem idênticos antes e depois (numa cópia do `rpg.json`) | mexer nos 4 leitores muda ficha antiga; a comparação é o portão |
| **C2** Tela de montar | 7 blocos, modelos prontos, copiar, resumo em frases, prévia do número, vista do jogador | o mestre monta "Espadada do Marinheiro" sem digitar texto e usa na batalha; o jogador vê o resumo | tela grande: começar pelos blocos 1, 2, 5 e 7 |
| **C3** Alvo e área | vários com divisão, linha, quadrado, raio, filtro; a mira marca pela grade, quem usa pode mudar | um 3x3 na grade de teste marca os tokens certos; 71 dividido por 3 dá 23 | borda da grade, token grande |
| **C4** Teste e disputa | `teste.ts`: CD fixa, fórmula ou por carga, vantagem, `sePassar`; `mod()` na fórmula | NPC com "RES contra 12": falhou, Atordoado; passou, nada (d20 fixo) | duplicar a vantagem da F1: usar a função dela |
| **C5** Selos vivos | `porTurno` com Aplicar, durações especiais, `tiraSaidas`, `zerar`, `soLembrete`, `renova`, `cura`, `tirarSelos` | Sangramento 10×3 pede Aplicar 3 vezes e vai direto no HP | depende da semântica de selo da F1 |
| **C6** Perguntas e tela do mestre | `ramos`, `Numero.pergunta` (de quem usa ou do mestre), arma e perfurante perguntados | "cortante ou perfurante?" troca o selo; o número do mestre chega ao golpe | pergunta ao mestre trava a vez: precisa de "responde depois" |
| **C7** Oculta | `oculta`; o recorte ao jogador troca o cartão por "???" | o texto não chega ao jogador pela rede (conferir o pacote) | edição do jogador apagar o cartão oculto |
| **C8** Gatilhos | início do combate, começo/fim da vez, cai a 0, entrou na área, preso tenta agir; sempre lembrete | uma Planta de NPC lembra o mestre quando alguém entra no raio | a parte mais presa à troca de vez |
| **C9** Combo / **C10** Companion | `requisito.depoisDe`; `invocar` com ficha-modelo, limite, evolução | C9 só com o 2º caso; C10 com plano próprio (F3 item 5 do conserto) | C10 é o maior: não abrir antes da C8 |

C1 a C5 cobrem quase todo NPC; da C6 em diante, só sob demanda. Quem implementa: `programador-frontend` (TypeScript), um
por vez; `designer-opus` desenha a tela da C2.

## 6. O que muda na F2 (à mão) e cuidados com a F1

A F2 continua à mão, ficha por ficha. Para não atrapalhar o construtor, ela deve **evitar**:
- **`if (cartao.nome === 'Corta Cenoura')` espalhado** no golpe, na reação e na store. O que é à mão mora num arquivo só,
  `lib/batalha/mecanicasAMao.ts`: tabela por **cartaoId** que passa parâmetros às funções gerais. Depois, o construtor só
  troca "a linha da tabela" por "a peça do cartão".
- **Função de um personagem só.** Escrever a geral, pura, com parâmetros: `testeDeResistencia({ atributo, cd, vantagem })`,
  `alvosNaArea(forma, origem)`, `seloPorTurno({ recurso, quanto, direto })`.
- **Campo novo no pedido por mecânica** (`cortanteOuPerfurante`). Usar já o `respostas` genérico da seção 2.
- **Mais regex no texto, ou extra com nome mágico novo** ("Concentração:", "CD:") como canal de regra. Os de hoje
  (`gatilho` passivas.ts:63, `contador` contador.ts:24) ficam; não criar outros.
- **Segunda conta da ordem dos multiplicadores.** Tudo por `danoQueChega` (reacao.ts:61), também no duelo.
- **Comportamento de selo escondido no nome.** "Atordoado só passa a vez" vira tabela nome → comportamento, que a peça `selo` reusa.
- **Bom fazer cedo:** unificar os 4 leitores (seção 2) no começo da F2. É o C1 sem as peças.

Cuidados com a F1 (em andamento; mexe em golpe.ts, turnos.ts, selos.ts, batalhaFabrica.ts):
- O construtor só toca na batalha depois da F1 fechada (commit e árvore limpa): um dono por vez.
- Reusar o que a F1 cria (2 d20, Overload, selo por vez, batalha salva). Pedir que a batalha salva grave o `TurnosDaCena`
  inteiro, não uma lista de campos, para as respostas e os testes da mecânica entrarem sem mexer na gravação.
- Ordem: F1 → F2 (à mão, seguindo esta seção) → C1 a C5 → C6+ sob demanda.

## O que NÃO fazer (YAGNI)

- Linguagem de script, condicionais genéricas (se/então) ou editor de nós ligados por fios.
- Migrar as 11 fichas, nem com um botão "converter tudo".
- Biblioteca global de técnicas no livro: o reuso vem de "copiar de" e da variação de NPC (`combate.modeloId`).
- Física de empurrão e colisão, munição contada, regra entre duas fichas: é a peça `aMao`.
- Gatilho que age sozinho: todo gatilho é lembrete com Aplicar ou pular, como as passivas hoje.
- IA preenchendo peças; "sugerir a partir do texto" no editor só se o mestre pedir.
