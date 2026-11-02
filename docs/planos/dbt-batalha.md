# Batalha Dragon Ball Tales: especificação de implementação (02/11/2026)

Plano mãe: `docs/planos/sistema-dragon-ball.md` (item 8, fase 3). Fontes: `docs/fontes/dragon-ball-tales/dossie/{batalha,j1-digest,j2-digest,j3-digest,nar-digest}.md` e `md/j3-08-4`, `j3-08-5`, `j3-09-*`, `j2-64`, `j2-65`, `j1-04`. Páginas = número impresso do Livro do Jogador V0.5.
Caminhos de código relativos a `client/src`. Linhas conferidas no commit 4f2eb6eb.

Regras herdadas do plano mãe, valem para cada fatia: nada do One Piece muda de comportamento; código novo só em `lib/dbt/`, `components/dbt/`, `stores/*DBT*`, `net/*DBT*`; edição em arquivo compartilhado só ADITIVA e só nos pontos listados na seção 18; sem rodar vitest/Playwright (escrever teste pode); `rtk proxy npx tsc --noEmit` em `client/` ao fim de cada bloco; commit só dos próprios caminhos.

## 1. Decisões de arquitetura

1. **Motor puro estilo reducer.** `lib/dbt/batalha/motor.ts` exporta `reduzir(nucleo, comando, autor, ctx) -> ResultadoDBT`. Sem store, sem rede, sem relógio, sem `Math.random`: dado, id e hora entram por `ctx`. A store só lê fichas, chama `reduzir`, grava fichas pela mesa e escreve a linha do registro.
2. **Uma entrada só na store:** `comando(sceneKey, autor, ComandoDBT)`. O mestre chama direto; o jogador chega pela ponte. Menos superfície para validar.
3. **O motor enumera as opções; o cliente só escolhe a chave.** `opcoesDeAcao` e `opcoesDaPendencia` calculam custo efetivo e motivo de bloqueio; o jogador manda `opcao: chave` e alvos; o host confere a chave contra a MESMA função. Nenhuma regra duplicada no cliente, nenhum número de regra vindo do fio.
4. **Ki e PV moram na ficha** (recursos `pv` e `pk`, plano mãe item 2), como o SP do One Piece. A batalha guarda só o que não é da ficha: débito do Choque, Ki bloqueado da transformação máxima, transformação ativa, condições, voo, agarrão, morte. Barra do token, ficha do jogador e ajuste rápido mostram o mesmo número, sem estado duplicado.
5. **Desfazer em pilha (LIFO) por foto do núcleo.** Cada comando vira UMA linha com a foto do núcleo de antes (objetos imutáveis, compartilhamento estrutural) e as partes de ficha (`partesDoAjuste`/`desfazerFicha`). Só a última linha válida se desfaz. Jogador não desfaz linha com d20 (evita re-rolar).
6. **Pendências em fila:** tudo que espera alguém (confirmação do mestre, janela de reação, teste, salvaguarda, Choque, ação gratuita, queda, escolhas de início de turno) é uma `Pendencia`. A ativa é `pendencias[0]`; aninhada entra na frente, irmã vai ao fim. Com fila vazia, o dono da vez age.
7. **Combatente = token.** `id` do combatente = `tokenId` (único na cena; o DBT não tem carta extra). Simplifica rede e recorte.
8. **Ficha sem `dbt` entra como combatente manual**: aparece na ordem, recebe iniciativa digitada, e o mestre resolve tudo à mão. Nunca quebra a batalha.

Rejeitadas: Ki só no estado da batalha (estado duplicado, ficha mentindo durante a luta); reversão por variante como o `Reversao` do One Piece (30 variantes, desfazer fora de ordem difícil de provar); estender `batalhaStore`/`TurnosDaCena` (viola independência; `useBatalhaStore` é instância única); reaproveitar mensagens `batalha.*` (o leitor estrito do jogador em `net/protocoloDaBatalha.ts:1161` derruba o estado DBT).

## 2. Estado por cena (`lib/dbt/batalha/tipos.ts`)

```ts
export type IdDoCombatente = string            // = tokenId
export type Lado = string                      // equipe.id; sem equipe: 'npc' ou 'pj'
export type Atributo = 'for' | 'des' | 'con' | 'int' | 'sab' | 'pod' | 'pre'
export type Rank = 'E' | 'D' | 'C' | 'B' | 'A' | 'Z'
export type Faixa = 'erro' | 'minimo' | 'medio' | 'completo'
export type NivelDeVoo = 0 | 1 | 2 | 3
export type ModoDaBatalha = 'automatico' | 'manual'
export type AutorDBT = AutorDaAcao             // import type de lib/batalha/turnos (só tipo)

export interface OpcoesDaBatalhaDBT {
  modo: ModoDaBatalha
  exaustao: boolean           // 8.5.1 (opcional no livro); padrão true, o mestre confirma no fim
  salvaguardaDeNpc: boolean   // padrão false: NPC a 0 PV fica fora de combate direto
}

export interface CombatenteDBT {
  id: IdDoCombatente
  personagemId: string | null       // null, ou ficha sem `dbt` = combatente manual
  nome: string
  lado: Lado
  npc: boolean
  iniciativa: RolagemDeIniciativa | null
  turnosJogados: number             // sobe no INÍCIO de cada Turno de Ação dele
  kiBloqueado: number               // 2º uso da transformação máxima (8.5.1.3): fora da recarga
  kiDebito: number                  // Choque sem Ki (9.5.6): sai na próxima recarga e zera
  transformacao: TransformacaoAtiva | null
  voo: NivelDeVoo
  agarrado: { porId: IdDoCombatente; acerto: number } | null
  condicoes: readonly CondicaoAtiva[]
  imuneA: readonly { condicao: IdDaCondicao; tecnicaId: string }[]   // Envenenado vencido
  temporarios: readonly ModificadorTemporario[]
  morte: { sucessos: number; falhas: number; situacao: 'de-pe' | 'salvaguarda' | 'inconsciente' | 'morto' }
  perdeProximoTurno: { motivo: string } | null   // Atordoado, Esforço Supremo, Confusão 10-16
  natural20: boolean                // iniciativa 20: imune na rodada 1, transformar de graça no 1º turno
  natural1: boolean                 // iniciativa 1: perde o Turno de Ação da rodada 1
  carga: { tecnicaId: string; cargas: number } | null          // Acumulação por rodada
  mantendo: { tecnicaId: string; alvos: readonly IdDoCombatente[]; total: number } | null  // Rajada Contínua
  acaoOculta: { ki: number; texto: string; ateRodada: number } | null  // texto só ao mestre
  reacaoEmDesvantagem: boolean      // nar 5: reação defensiva não consome Ki
  usos: { tecnicaDeRankMaximo: number; transfInferiores: readonly number[]; transfMaxima: number; choque: boolean }
}

export interface TurnoAtual {
  combatenteId: IdDoCombatente
  basicosUsados: number             // o próximo básico rola com -basicosUsados
  basicosAnunciados: number | null  // mais de 3 anunciados antes (9.2)
  tecnicasUsadas: readonly string[] // técnica não básica: 1x por Turno de Ação
  andou: number                     // casas no turno
  casasCobradas: number             // casas além do deslocamento já cobradas (Correr)
  desengajouDe: readonly IdDoCombatente[]
  barreiraUsada: boolean
  semTecnicas: boolean              // Esforço Supremo, Rajada mantida
}

export interface RolagemDeIniciativa { d20: number; total: number; destreza: number; desempate: number | null; transformou: string | null; digitada: boolean }
export interface TransformacaoAtiva { id: string; nome: string; estagio: number; epBonus: number; maxima: boolean; desdeRodada: number }
export interface ModificadorTemporario { id: string; rotulo: string; acerto: number; ca: number; dano: number; ateRodada: number | null }

export type QuandoExpira =
  | { tipo: 'inicioDoTurno'; turno: number }   // quando turnosJogados chega a `turno`
  | { tipo: 'fimDoTurno'; turno: number }      // ao fim do turno de número `turno`
  | { tipo: 'fimDaRodada'; rodada: number }
  | { tipo: 'turnosDeAcao'; restantes: number }
  | { tipo: 'teste' } | { tipo: 'evento' } | { tipo: 'fimDoCombate' }

export interface CondicaoAtiva {
  id: string
  condicao: IdDaCondicao                        // ids da seção 10, ou 'personalizada'
  nome: string
  origem: { combatenteId: IdDoCombatente | null; tecnicaId: string | null; tecnicaNome: string; kiDaTecnica: number }
  cd: number | null
  expira: QuandoExpira
  suprimidaAte: QuandoExpira | null             // Quebrado e Sangrando
  extra?: { atributo?: 'for' | 'des' | 'con'; intimidadorId?: string; tecnicaBloqueada?: string; controladorId?: string }
  aplicadaNaRodada: number
}

export interface OrdemDBT { cartas: readonly IdDoCombatente[]; vez: IdDoCombatente | null; rodada: number }

export interface NucleoDBT {             // tudo que o Desfazer volta
  fase: 'iniciativa' | 'combate'
  opcoes: OpcoesDaBatalhaDBT
  combatentes: Readonly<Record<IdDoCombatente, CombatenteDBT>>
  ordem: OrdemDBT
  turno: TurnoAtual | null
  pendencias: readonly Pendencia[]       // [0] = a ativa
}

export interface EstadoDBT extends NucleoDBT {
  registro: readonly LinhaDBT[]          // até REGISTRO_DBT_MAX
  efeitos: readonly EfeitoDBT[]          // fora do núcleo: efeito não se desfaz
}
```

Pendências (todas com `id: string` e `responde: { tipo: 'mestre' } | { tipo: 'combatente'; id }`; o mestre sempre pode responder qualquer uma):

```ts
export type Pendencia =
  | { tipo: 'declaracao'; faltam: readonly IdDoCombatente[] }        // fase iniciativa: transformar antes?
  | { tipo: 'confirmar'; etapa: 'ataque' | 'resolucao' | 'teste' | 'especial'; ataque?: AtaqueResolvido; teste?: TesteAgendado }  // modo manual
  | { tipo: 'reacao'; janela: JanelaDeReacao }
  | { tipo: 'teste'; teste: TesteAgendado }                         // agarrão (escolher DES ou FOR), soltar-se
  | { tipo: 'salvaguarda'; combatenteId: IdDoCombatente }
  | { tipo: 'choque'; choque: ChoqueEmCurso }
  | { tipo: 'apoioAoChoque'; ataqueId: string; defensorId: IdDoCombatente; faltaEP: number; apoios: readonly ApoioAoChoque[] }
  | { tipo: 'acaoGratuita'; combatenteId: IdDoCombatente; contra: IdDoCombatente; motivo: 'erroCritico' | 'oportunidade' | 'previsivel' }
  | { tipo: 'inicioDoTurno'; combatenteId: IdDoCombatente; escolhas: readonly ('manterRajada' | 'continuarCarga' | 'tentarSoltar')[] }
  | { tipo: 'queda'; combatenteId: IdDoCombatente; podeEstabilizar: boolean }
  | { tipo: 'ataqueForcado'; combatenteId: IdDoCombatente; alvoSugerido: IdDoCombatente | null }  // Confusão 1-9

export interface AtaqueResolvido {
  id: string
  atacanteId: IdDoCombatente
  alvoId: IdDoCombatente
  tecnica: { id: string; nome: string; rank: Rank; tipo: 'fisica' | 'ki' | 'magica' | 'hibrida'; ki: number }
  modo: 'dano' | 'agarrar'
  basicos: number                                    // 1, ou n condensados
  rolagem: { d20: number; dados: readonly number[]; vantagem: -1 | 0 | 1; fontes: readonly string[]; partes: readonly ParteDaConta[]; total: number; digitada: boolean } | null
  salvaguarda: { cd: number; d20: number; total: number } | null   // técnica com Adicionar Salvaguarda
  ca: number | null
  difEP: number
  margem: number
  faixa: Faixa
  critico: boolean
  erroCritico: boolean
  danoCompleto: number
  danoPrevisto: number
  efeitos: readonly EfeitoPrevisto[]                 // condição (CD), gatilho do tipo de dano, Sangria, Instável
  kiPago: boolean
}
export interface ParteDaConta { rotulo: string; valor: number }   // "INT +3", "EP +2", "Dif. EP -1", "Básico -1"

export interface JanelaDeReacao {
  ataque: AtaqueResolvido
  convidados: readonly IdDoCombatente[]            // [alvo] + quem entrou com "Reagir também"
  respostas: Readonly<Record<IdDoCombatente, 'nao' | readonly ReacaoEscolhida[]>>
  profundidade: number                             // reativa sobre reativa; teto 3
}
export interface ReacaoEscolhida { chave: string; tipo: 'defensiva' | 'barreira' | 'reativa' | 'choque' | 'movimento' | 'livre'; tecnicaId: string | null; ki: number }

export interface ChoqueEmCurso {
  ataqueId: string; atacanteId: IdDoCombatente; defensorId: IdDoCombatente
  tecnicaAtacante: string; tecnicaDefensor: string; bonusDefensor: number
  placar: { atacante: number; defensor: number }
  apostas: { atacante: number | null; defensor: number | null }    // pontos de +1 (5 Ki cada)
  rolagens: readonly { atacante: number; defensor: number }[]
}

export interface LinhaDBT {
  id: string; seq: number; quando: number; rodada: number; autor: AutorDBT
  tipo: 'inicio' | 'iniciativa' | 'vez' | 'acao' | 'tecnica' | 'reacao' | 'dano' | 'cura' | 'condicao' | 'teste'
      | 'transformacao' | 'movimento' | 'voo' | 'choque' | 'morte' | 'ficha' | 'mestre'
  texto: string; detalhes: readonly string[]                   // mestre, com todos os números
  textoPublico: string; detalhesPublicos: readonly string[]    // jogador: sem PV, CA e Ki de quem ele não vê
  envolve: { tokenIds: readonly string[]; personagemIds: readonly string[] }
  comD20: boolean
  reversao: { nucleo: NucleoDBT; fichas: readonly { personagemId: string; partes: readonly ParteDaFicha[] }[] }
  desfeita?: { por: string; quando: number }
}
```

`TesteAgendado`, `ApoioAoChoque`, `EfeitoPrevisto` e `EfeitoDBT` (seq, tipo rolagem/dano/cura/condicao/transformacao, tokenIds, d20, faixa, numero) ficam no mesmo arquivo, no mesmo estilo.

Constantes: `REGISTRO_DBT_MAX = 300`, `REGISTRO_DBT_JOGADOR_MAX = 50`, `TEXTO_DBT_MAX = 200`, `DETALHES_MAX = 8`, `EFEITOS_DBT_GUARDADOS = 20`, `ALVOS_MAX = 12`, `PROFUNDIDADE_DE_REACAO_MAX = 3`, `DESLOCAMENTO_M = 9`, `PASSO_DE_CORRIDA_M = 1.5`, `CD_ESTABILIZAR = 15`, `KI_DECOLAR = 4`, `KI_MUDAR_NIVEL = 2`, `KI_ESTABILIZAR = 1`, `KI_POR_PONTO_DE_CHOQUE = 5`.

A store embrulha: `CenaDBT = EstadoDBT & CaminhosNoMestre & { rev: number; turnosRev: number; judge?: JudgeNaCena }` (o mesmo formato que `getCaminhosDaBatalha` devolve hoje, `net/hostSession.ts:1773`).

## 3. Contrato com a ficha e as regras (`lib/dbt/batalha/leitura.ts`)

`modelo.ts` e `regras/*` ainda estão sendo escritos. O motor NUNCA importa os dois direto: só `leitura.ts` importa, e entrega ao motor a forma abaixo. Se os nomes reais divergirem, ajusta-se só este arquivo.

```ts
export interface FichaLida {
  personagemId: string; nome: string
  atributos: Record<Atributo, number>
  epBase: number
  caBase: number                    // 10 + mod DES + EP base + armadura (sem transformação, sem condição)
  pv: { atual: number; max: number }; pk: { atual: number; max: number }
  pkBloqueadosDaFicha: number       // exaustão de batalhas anteriores (até Descanso Longo)
  armaduraKiPorTurno: number
  rankMaximo: Rank | null           // pelo PDL (E 10k, D 20k, C 30k, B 40k, A 80k, Z 120k)
  usosTransfMaximaDesdeDescanso: number
  choqueDisponivel: boolean
  tamanho: number
  tecnicas: readonly TecnicaLida[]  // só as ATIVAS
  transformacoes: readonly { id: string; nome: string; estagio: number; epBonus: number; ki: number; maxima: boolean }[]
  movimentos: readonly { id: string; nome: string; ki: number | null; reacao: boolean }[]   // movimentos marciais e talentos ativos com [KI: X]
}
export interface TecnicaLida {
  id: string; nome: string; rank: Rank; tipo: 'fisica' | 'ki' | 'magica' | 'hibrida'; atributoDeAcerto: Atributo
  ki: number; dano: { minimo: number; medio: number; completo: number }
  basica: boolean; reativa: boolean; defensiva: boolean; barreira: number; cura: boolean
  salvaguarda: { atributo: Atributo } | null
  exaustiva: boolean; golpeCritico: number; precisao: number; dificuldade: number; estagiosExtras: number
  acumulacao: boolean; rajadaContinua: boolean; sangria: boolean; esforcoSupremo: boolean; verbal: boolean; somatica: boolean
  efeitoNegativo: { condicao: IdDaCondicao } | null
  alcance: { tipo: 'toque' | 'curto' | 'longo' | 'area'; metros: number | null; queimaRoupa: boolean }
  especial: boolean                 // técnica especial: sem rótulo, o mestre confirma efeito e dano
  uso: 'acao' | 'reacao' | 'ambos'
}
export function lerFichaParaBatalha(personagem: Personagem, sistema: SistemaDeRpg | null): FichaLida | null  // null = sem `dbt`
```

Funções esperadas das regras puras (plano mãe item 6). Se faltar alguma na hora da fatia 1, o escritor a acrescenta no arquivo de regras (as regras já terminaram, não há conflito):

| Função | Arquivo | Contrato |
|---|---|---|
| `modificador(v)` | `regras/ficha.ts` | `floor((v-10)/2)` (p. 6, pelos exemplos) |
| `derivadosDBT(ficha)` | `regras/ficha.ts` | `{ pvMax, pkMax, ca, st, epBase }` |
| `rankMaximoPorPdl(pdl)` | `regras/tecnicas.ts` | tabela p. 58 |
| `resolverTecnica(t)` | `regras/tecnicas.ts` | campos de `TecnicaLida` a partir dos rótulos |
| `faixaDaMargem(margem, difEP)` | `regras/dano.ts` | `difEP >= 0`; tabela 2.3.3 literal (1 a 10; acima de 10, -1 por nível) |
| `danoDaFaixa(completo, faixa)` | `regras/dano.ts` | floor de 1/4 e 1/2 (p. 84) |
| `subirEstagios(faixa, n, minimo)` | `regras/dano.ts` | estágio acima de completo vira +dano mínimo (p. 76-77) |
| `penalidadePorEP(epAtk, epAlvo)` | `regras/dano.ts` | `max(0, epAlvo - epAtk)` |
| `faixaInvertida(rolagem, alvo)` | `regras/dano.ts` | igual ou acima completo; 1-5 abaixo médio; 6+ abaixo mínimo |
| `vitoriaAutomatica(epA, epB)` | `regras/dano.ts` | maior >= 2x menor, com menor >= 1 |
| `kiDaTransformacao(t)`, `epDaTransformacao(t)` | `regras/transformacoes.ts` | valor da ficha; padrão 3 x estágio e +estágio |

Campos que a ficha precisa ter (pedido ao dono de `modelo.ts`; se faltar, a fatia 1 acrescenta como opcional): `FichaDBT.desgaste?: { pkBloqueados: number; usosTransfMaxima: number; choqueUsado: boolean }`, zerado pelo botão "Descanso Longo" da ficha Scouter.

## 4. Máquina de fases

```
[Iniciar] -> fase iniciativa
   pendência declaracao (cada um: transformar antes do 1º turno? o mestre pode pular)
   -> rolarIniciativa (host rola, ou o mestre digita) -> ordem
   -> comecar -> fase combate, rodada 1, vez = 1ª carta que joga
fase combate, para a carta da vez:
   iniciarTurno (6.1) -> [pendências de início] -> AÇÃO LIVRE (fila vazia)
   agir -> (manual: confirmar ataque) -> paga Ki -> rola -> erro: fim
                                                     -> acerto: janela de reação -> (manual: confirmar resolução)
                                                        -> aplica dano/condição -> [salvaguarda] [reativas] [ação gratuita]
   ... repete agir até passar
   passar -> terminarTurno -> próxima carta (deu a volta: terminarRodada)
[Encerrar] -> resumo do fim (exaustão editável) -> aplica na ficha -> desliga
```

`agir` só vale com `fase === 'combate'`, vez do combatente e `pendencias.length === 0`. `passar` exige fila vazia. Toda pendência tem "Responder por ele" para o mestre.

## 5. Iniciativa (9.1, p. 113)

1. `declaracao`: cada combatente com ficha DBT escolhe "transformar antes" (uma transformação da ficha) ou não. Jogador declara pela rede; NPC, o mestre. O mestre pode "Rolar já" (quem não declarou não transforma).
2. Total = `d20 + mod(DES) + EP base + (transformou ? epBonus : 0)`. d20 do host; em modo manual o mestre sobrescreve cada d20.
3. Ordem: primeiro os 20 naturais (entre eles: maior DES bruta, depois re-rolagem só entre os empatados); depois o resto por total decrescente; empate: maior DES bruta; persistindo, re-rola só entre eles (manual: o mestre arrasta).
4. 20 natural: `natural20 = true` (imune a condição na rodada 1; transformar no 1º turno custa 0, inclusive a declarada antes). 1 natural: `natural1 = true` (pula o Turno de Ação da rodada 1; reage normalmente).
5. Ki inicial = recarga normal (6.1 passo 3) menos o custo da transformação declarada (0 com 20 natural). A transformação declarada entra em `transformacao`, com os usos de exaustão contados.
6. Combatente incluído no meio: rola a dele e entra na posição do total; não age na rodada em que entrou se a vez já passou da posição.

## 6. Turno de Ação, rodada e ações

### 6.1 Início do Turno de Ação (`iniciarTurno`), nesta ordem

1. `turnosJogados += 1`; `turno = TurnoAtual` novo.
2. Expira `inicioDoTurno` com `turno <= turnosJogados`: Exposto não consumido, barreiras (CA), supressão de Sangrando; temporários com `ateRodada < rodada`.
3. Recarga: `pk = clamp(pkMax - pkBloqueadosDaFicha - kiBloqueado - kiDebito - armaduraKiPorTurno, 0, pkMax)`; `kiDebito = 0`. Gravado na ficha; linha "Ki 3 -> 28".
4. Morte: `situacao === 'salvaguarda'` -> pendência `salvaguarda` (PJ: o jogador clica "Rolar", o host rola; NPC: automático) e a vez passa sozinha. `inconsciente`/`morto`: a vez passa sozinha.
5. Testes de início (seção 10, coluna "Expira / teste"): rolados pelo host (manual: `confirmar` etapa teste). Confusão Mental rola 1d20 do efeito e depois SAB.
6. Perde a vez: `perdeProximoTurno` (consome), `natural1` na rodada 1, Confusão 10-16 -> linha e `passar` automático. Confusão 1-9 -> pendência `ataqueForcado` (mestre; alvo sugerido = aliado mais próximo pela posição, técnica = básica de maior dano).
7. Escolhas (pendência `inicioDoTurno` do dono): manter Rajada Contínua (paga o Ki de novo, mantém o total original, `semTecnicas = true` no turno) ou soltar; continuar a carga (passa a vez, `cargas += 1`) ou disparar; tentar soltar o agarrão (teste resistido, seção 11).

### 6.2 Ações do Turno de Ação

Custo efetivo de técnica = `ki x multiplicadores`; multiplicadores distintos se multiplicam: Exaustiva x2; Sobrecarregado em técnica de tipo `ki` x2 (consome a condição); "reações custam o dobro" (Atordoado ou Paralisado) x2 uma vez só; Choque de Poder x2. Reação em Desvantagem zera o custo de reação defensiva (exige Ki atual >= custo, não desconta).

| Ação | Ki | Resolução |
|---|---|---|
| Mover | 0 até o deslocamento | Contado em casas pelo `somarCaminho` (seção 11). Pode dividir o movimento no turno; conta o total |
| Correr | 1 por 1,5 m além | Cobrado sozinho ao passar do deslocamento (`ceil(metrosPorCasa / 1.5)` por casa) |
| Técnica (física, Ki, mágica, híbrida) | da técnica | Ataque, seção 7. Não básica: 1x por Turno de Ação |
| Ataque Básico (técnica com "Técnica Básica") | de cada uso | O k-ésimo básico do turno rola com -(k-1), valendo entre técnicas básicas diferentes |
| Mais de 3 básicos | soma dos custos | Só se anunciado antes do 1º básico (`basicosAnunciados`, 4 a 10). Uma rolagem com -(0+1+...+(n-1)); dano = n x dano da faixa; uma janela de reação |
| Técnica com Adicionar Salvaguarda | da técnica | Sem rolagem de acerto: o alvo faz a salvaguarda (7.3) |
| Técnica de cura | da técnica | Rolagem vs CA do aliado, escala invertida; nunca em si; sem janela |
| Técnica de Barreira | da técnica | CA + n rótulos até o início do próximo turno; 1 barreira por turno |
| Técnica especial | impresso | Sempre passa por `confirmar` etapa especial (o mestre digita dano e efeito), mesmo no automático |
| Agarrar | da técnica usada | Declarado no pedido (`modo: 'agarrar'`); acerto sem dano -> teste resistido (seção 11) |
| Desengajar de X | `max(2, 2 x EP total de X)` | `desengajouDe += X`; o mestre não abre ataque de oportunidade de X |
| Decolar / mudar nível / pousar | 4 / 2 / 0 | Decolar põe no nível 1; mudar = 2 por mudança, qualquer número de níveis |
| Transformar | da transformação | 0 com 20 natural no 1º turno. Troca de estágio paga o novo inteiro. Destransformar: 0 |
| Carregar (Acumulação por rodada) | 0 | Gasta o turno: `carga = { cargas: 1 }` e passa a vez |
| Carga por Ki (Acumulação) | + Ki da técnica por carga | No mesmo pedido (`cargasKi` 1 a 5); não mistura com a carga por rodada |
| Ação Oculta | o Ki declarado | Paga na hora; texto só ao mestre; `ateRodada = rodada + 1`; o mestre dispara pelo menu |
| Levantar (Caído) | Ki da técnica que derrubou | Tira Caído (dividir com aliado: o mestre ajusta Ki à mão) |
| Movimento marcial / talento ativo | `[KI: X]` | Paga e escreve a linha; efeito aplicado pelo mestre (temporários) |
| Ação narrativa | 0 | Linha opcional |
| Passar | 0 | `terminarTurno` |

Bloqueios calculados por `opcoesDeAcao` (a opção aparece com o motivo, nunca some): Ki insuficiente; técnica não básica já usada no turno; Paralisado (não ataca nem move); Agarrado (só ataca quem agarra); Alucinação (sem alvo único); Cego (sem ataque de longo alcance); Lacuna Mental (técnica sorteada); `semTecnicas`; físico corpo a corpo contra alvo em nível de voo acima (9.5.7).

### 6.3 Fim do turno e da rodada

`terminarTurno`: expira `fimDoTurno` com `turno === turnosJogados` (Silenciado, Paralisado, Cego, Alucinação, Desequilibrado, Quebra de Guarda, Efeito Negativo sem duração, supressão do Quebrado); Lacuna Mental `restantes -= 1`, em 0 expira; `turno = null`; vez = próxima carta que não está `inconsciente`/`morto` (quem está em `salvaguarda` recebe a vez só para rolar).

`terminarRodada` (a vez deu a volta): tira o "reações x2" do Atordoado aplicado nesta rodada; descarta Ação Oculta com `ateRodada === rodada` (linha só ao mestre); `natural20` deixa de imunizar ao fim da rodada 1; `rodada += 1`; recalcula os avisos: vitória automática (par a par) e "lado sem ninguém de pé: encerrar?". Aviso nunca encerra sozinho.

## 7. Ataque, passo a passo (`ataque.ts`)

### 7.1 Conta do acerto

```
dados   = vantagem 0: [d20]; +1: [d20, d20] pega o maior; -1: pega o menor
d20     = o dado escolhido (o natural vale para crítico)
total   = d20 + mod(atributoDeAcerto)            // mod com Quebrado (-1 no FOR/DES/CON da condição)
        + EP total do atacante                   // base + bônus da transformação (2.3.1)
        + tecnica.precisao + soma(temporarios.acerto)
        - penalidadePorEP(EP total atk, EP total alvo)   // 2.3.2
        - redutor do básico                      // k-1, ou a soma condensada
        - 2 se o atacante está Desnorteado
CA      = caBase(DES efetivo) + soma(temporarios.ca) + barreiras ativas - 2 se Desnorteado
        = 0 se o alvo tem Quebra de Guarda (consome)
difEP   = max(0, EP total atk - EP total alvo)
margem  = total - CA
critico = d20 >= min(20 - tecnica.golpeCritico, alvo Exposto ? 16 : 20)    // Exposto consome
erro    = d20 === 1                                                          // erro crítico
faixa   = erro ? 'erro' : critico ? 'completo' : faixaDaMargem(margem, difEP)
```

Vantagem e desvantagem (fontes automáticas; qualquer vantagem com qualquer desvantagem = rolagem normal; não acumulam): Envenenado (desv. em tudo); Alucinação (desv. no ataque); Intimidado (desv. contra o intimidador); Cego (desv. no ataque); Verbal com Silenciado (desv.); sob ameaça, técnica de alcance acima de 3 m com inimigo adjacente, salvo `queimaRoupa` (desv.); flanqueamento corpo a corpo no mesmo nível de voo (vant.); alvo Caído (vant.). As posicionais vêm de `posicao.ts` e só existem com `ctx.posicoes` (cena aberta no mapa do mestre); sem posição, ficam desligadas e o mestre liga à mão. O jogador nunca liga vantagem.

### 7.2 Dano previsto

```
estagios = indice(faixa) + tecnica.estagiosExtras + (alvo Sangrando e não suprimido ? 1 : 0) + cargas
           (só se acertou; erro fica erro)
{faixa, extra} = subirEstagios(faixa, estagios, tecnica.dano.minimo)
dano = danoDaFaixa(completo, faixa) + extra + soma(temporarios.dano)
critico: dano = dano x 2 (depois dos bônus do atacante, antes da mitigação)
condensado: dano = n x dano
modo agarrar: dano = 0
```

### 7.3 Técnica com Adicionar Salvaguarda

`CD = 8 + mod(atributoDeAcerto) + EP base do atacante + tecnica.dificuldade - penalidadePorEP`. O alvo rola `d20 + mod(salvaguarda.atributo) + EP total do alvo`. `falhaPor = CD - rolagem`; se `<= 0` nada acontece; senão `faixa = faixaDaMargem(falhaPor, difEP)`. Sem crítico. Dano acima de 0 abre janela de reação.

### 7.4 Sequência

1. `calcularAtaque` monta `AtaqueResolvido` (sem mexer em nada). Modo manual -> pendência `confirmar` etapa ataque e para.
2. `pagarAtaque` (ficha); Sangria: o atacante sofre dano = EP total, sem mitigação, acerte ou erre; Esforço Supremo: `semTecnicas` e `perdeProximoTurno`; Ki chegou a 0 -> a transformação acaba.
3. Erro (inclui erro crítico): linha. Erro crítico -> pendência `acaoGratuita` do alvo contra o atacante (0 Ki, qualquer técnica, o atacante não reage). Rótulo Previsível no erro -> linha de aviso ao mestre (ele abre a ação gratuita pelo menu).
4. Acerto -> pendência `reacao` (seção 8). Técnica de área: uma rolagem, comparada à CA de cada alvo; uma janela por alvo atingido, na ordem da iniciativa dos alvos.
5. Fechada a janela: `resolverJanela` recalcula com barreiras, soma a mitigação, monta o resultado. Modo manual -> `confirmar` etapa resolução.
6. `aplicarResultado`: `danoFinal = max(0, danoPrevisto recalculado - mitigação)`; PV na ficha (piso 0, o excedente vai à linha). Depois, nesta ordem: Instável no atacante (sofre `floor(danoFinal / 2)`); Efeito Negativo só se `danoFinal > 0` (técnica sem dano: basta acertar), teste do alvo vs CD (seção 10); gatilho do tipo de dano se crítico ou `margem >= 12`: o alvo rola `d20 + mod` SEM EP vs o `total`, falha 1-2 / 3-5 / 6-11 / 12+ = nível 1-4, linha com o texto do rótulo (efeito pelo mestre); dano no agarrador -> pendência `teste` de soltar-se para quem ele agarra; dano direto encerra Controle Mental; crítico destrói a armadura do alvo (linha; campo da ficha se o modelo tiver); PV <= 0 -> seção 12.
7. Reativas escolhidas viram ataques novos (pendências na frente, profundidade + 1, teto 3).

## 8. Janela de reação (9.3, p. 114)

- Abre só em acerto ("errar pela CA já é esquiva e bloqueio"). Sem movimento na reação.
- Convidado fixo: o alvo (NPC alvo: o mestre responde; Enter = "Não reagir"). Os outros entram por opção: enquanto a janela está aberta, todo combatente (menos o atacante) com alguma reação pagável vê "Reagir também"; entrar o põe em `convidados`. NPC que não é o alvo só entra pelo mestre.
- A janela resolve quando todos os convidados responderam, ou quando o mestre clica "Resolver reações". Resolução na ordem: alvo primeiro, depois iniciativa. O Ki das reações é cobrado NA RESOLUÇÃO (reação que perdeu o sentido não cobra).
- Limite: cada técnica 1x por janela por reator, salvo Técnica Básica (Registro V0.3). Uma barreira por turno de reação.

| Reação | Ki | Efeito |
|---|---|---|
| Choque de Poder (só o alvo) | 2 x Ki da técnica de ação usada; Reativa: 1x e sem débito | Substitui o ataque: seção 9. As outras reações da janela caem sem custo |
| Técnica de Barreira | da técnica | CA + n; recalcula margem e faixa do ataque aberto (pode virar erro); vale até o início do próximo turno do reator |
| Técnica Defensiva | da técnica | Rola `d20 + mod + EP total + temporários` vs o `total` do ataque; `faixaInvertida`; mitigação = `danoDaFaixa(completo da defensiva, faixa)`; mitigações somam |
| Técnica Reativa (ou técnica com `uso` reacao/ambos) | da técnica | Ataque novo contra o atacante (ou alvo válido da técnica), resolvido depois deste |
| Movimento marcial / talento com reação | `[KI: X]` | Paga; mitigação digitada pelo mestre (a resolução vira `confirmar` mesmo no automático) |
| Estabilizar voo (na queda) | 1 | DES CD 15; seção 11 |
| Ação Oculta pronta | já paga | Só o mestre dispara; vira a ação descrita, resolvida à mão |
| Não reagir | 0 | |

Multiplicadores de reação: Atordoado ou Paralisado x2. Reação em Desvantagem (interruptor por combatente, o mestre liga; o painel sugere quando o lado dele tem 1 de pé e o outro 2 ou mais): Defensiva, Barreira, Estabilizar e talentos marcados como defensivos custam 0 se `pk >= custo`. Choque e Reativa pagam normal.

## 9. Choque de Poder (9.5.6, p. 116-117)

1. Elegível: o alvo; técnica do ataque de tipo `ki` ou `fisica`; técnica do defensor de ação, Rank >= o da técnica do atacante; `choqueDisponivel` na ficha e `usos.choque` falso; EP total igual. Com EP menor, a opção aparece como "Choque (falta +N EP)" e abre `apoioAoChoque`.
2. `apoioAoChoque`: aliados entram por opção com técnica de Rank >= a do atacante; cada um dá +1 EP e paga 2 x Ki da técnica + 1 Ki por 1,5 m até ficar ao lado do defensor (distância por `posicao.ts`; sem posição, o mestre digita). O excedente acima do EP do atacante vira +1 no acerto do defensor (`bonusDefensor`). Faltou EP quando o mestre fecha: o Choque não acontece, ninguém paga, a janela volta sem a opção.
3. Paga o Ki do defensor; o que faltar vira `kiDebito` (não com Reativa). `usos.choque = true`.
4. Rodadas: cada lado aposta 0 a N pontos (5 Ki cada, pagos na hora) ANTES de rolar; o host guarda as duas apostas e só então rola `d20 + mod + EP total + aposta (+ bonusDefensor)` para cada lado. Maior vence a rodada; empate não pontua e rola de novo. O primeiro a 3 vence. Jogador aposta pela rede; NPC, o mestre; no manual o mestre sobrescreve os d20.
5. O perdedor sofre `completo(técnica do vencedor) + floor(completo(técnica do perdedor) / 2)`, sem CA, sem nova janela. Depois segue 7.4 passo 6 (salvaguarda, transformação etc.).

## 10. Condições (`condicoes.ts`, 9.7, p. 120-123)

Aplicação (Efeito Negativo ou o mestre): `CD = 8 + mod(atributo de acerto da técnica) + EP base do aplicador + tecnica.dificuldade`. Teste do alvo: `d20 + mod(atributo) + EP total`; igualar a CD passa. Atributo com "ou": o motor usa o maior modificador (o mestre troca no manual). Recusa: `natural20` na rodada 1; `imuneA` (Envenenado vencido pela mesma técnica); Quebrado da mesma técnica. O número entre parênteses do livro é o custo do rótulo Efeito Negativo (j2-64) e não entra na batalha.

"Fim do próximo turno" = `{ tipo: 'fimDoTurno', turno: turnosJogados + 1 }` no momento da aplicação (vale igual dentro e fora da vez dele). "Início do próximo turno" = `{ tipo: 'inicioDoTurno', turno: turnosJogados + 1 }`.

| Id | Teste ao aplicar | Efeito na batalha | Expira / teste para sair |
|---|---|---|---|
| atordoado | CON | `perdeProximoTurno`; reações x2; acaba a transformação; voando: queda com estabilizar | o x2 no fim da rodada em que foi aplicado; a perda da vez quando consumida |
| desnorteado | SAB ou CON | -2 no acerto e na CA | teste SAB ou CON no início de cada turno |
| quebrado | CON | -1 no mod de FOR, DES ou CON (`extra.atributo`; técnica física = FOR, senão CON); acumula, não da mesma técnica | fim do combate; teste CON no início suprime até o fim do turno |
| enraizado | DES | não move (aviso no movimento) | teste DES no início do turno |
| envenenado | CON | desvantagem em tudo | teste CON no início; vencer = `imuneA` àquela técnica |
| sangrando | CON | +1 estágio no dano recebido | só cura tira; teste CON no início suprime até o início do próximo turno |
| silenciado | CON | técnica Verbal com desvantagem | fim do próximo turno |
| sobrecarregado | POD | próxima técnica de tipo `ki` custa x2 | evento: ao usar |
| quebra-de-guarda | DES | próximo ataque contra ele usa CA 0 | evento: ao ser atacado; ou fim do próximo turno |
| caido | DES | deslocamento pela metade; ataques contra com vantagem; `kiParaLevantar` = Ki da técnica | evento: Levantar |
| desequilibrado | DES | não voa; voando: queda SEM estabilizar | fim do próximo turno |
| exposto | DES | próximo ataque contra ele: crítico em 16-20 | evento: próximo ataque recebido; ou início do próximo turno |
| paralisado | CON | não move nem ataca; reações x2 | fim do próximo turno |
| intimidado | SAB | desvantagem contra o intimidador; aviso ao se aproximar | teste SAB no início de cada turno |
| cego | CON | sem ataque de longo alcance; desvantagem no ataque | fim do próximo turno |
| lacuna-mental | SAB | o host sorteia uma técnica ativa ou transformação da ficha: bloqueada; transformação ativa sorteada acaba | 2 turnos de ação |
| instavel | INT ou POD | sofre metade do dano que causar com técnica ofensiva | teste INT ou POD no início do turno |
| confusao-mental | SAB | início do turno: 1d20, 1-9 `ataqueForcado`, 10-16 perde a vez, 17-20 normal | teste SAB logo depois do 1d20 |
| controle-mental | SAB | a vez dele é pulada; o MESTRE o comanda (combatenteId dele) na vez do controlador | a cada rodada, no início da vez que seria dele: PRE do controlador vs SAB; dano direto encerra |
| alucinacao-sensorial | SAB | desvantagem no ataque; sem técnica de alvo único | fim do próximo turno |
| personalizada | o mestre escolhe | só texto (efeito pelo mestre via temporários) | fim do próximo turno, ou teste do atributo escolhido |

## 11. Movimento, voo, agarrão, oportunidade

- Casas do deslocamento = `max(1, floor(9 / metrosPorCasa))`; Caído = metade (floor). `metrosPorCasa`: `MapScale.unit` "m"/"metro(s)" -> `unitsPerCell`; "ft"/"pé(s)"/"feet" -> `unitsPerCell x 0.3048`; outro -> 1,5 (`types/map.ts:2152`).
- `somarCaminho(sceneKey, tokenId, blocos, casas)` da store DBT: soma caminho e trilha como o One Piece (`somarNaTrilha`, `lib/batalha/caminhoAndado.ts`) e, se o token é o da vez, `turno.andou += blocos`; casas acima do deslocamento ainda não cobradas -> cobra Correr (linha "Correu 1,5 m: -1 Ki", desfazível). Sem Ki: linha "sem Ki para correr: o mestre decide" (o host já aceitou o passo; o mestre move de volta). Fora da vez: linha só ao mestre "moveu fora da vez". Enraizado, Agarrado, Paralisado: a mesma linha de aviso (bloquear no host fica fora do v1). Movimento do mestre no mapa não passa pelo host e não conta (como hoje).
- Voo: 6.2. Queda (`queda`): Atordoado ou "Derrubar" do mestre com voo acima de 0 -> opção Estabilizar (1 Ki x multiplicadores; `d20 + mod DES + EP total >= 15` fica no nível, sem dano) ou cair; Desequilibrado: cai sem opção. Cair = nível 0 e `1d20 x níveis` de dano contundente (host rola, sem CA, sem janela).
- Agarrar: acerto em `modo: 'agarrar'` -> janela normal (dano 0) -> pendência `teste` do defensor: escolhe DES ou FOR, rola `d20 + mod + EP total` vs `ataque.total`; empate = fica como está (livre). Falhou: `agarrado = { porId, acerto: total }`. Soltar-se: no início do turno (opção) ou quando o agarrador sofre dano; mesmo teste; empate = continua preso. Alvo maior que o agarrador (`Token.size`): aviso, o mestre decide.
- Ataque de oportunidade: o mestre abre pelo menu da carta ("Oportunidade de Y contra X"; recusado se Y está em `desengajouDe` de X neste turno) -> pendência `acaoGratuita` motivo oportunidade: Y escolhe técnica de ação, Ki normal. Detecção automática pelo caminho fica fora do v1.

## 12. Morte (9.5.10, p. 119-120)

- PV <= 0 com `situacao 'de-pe'`: PV 0 na ficha; a transformação acaba; PJ (e NPC se `salvaguardaDeNpc`): `situacao = 'salvaguarda'` e a 1ª rolagem já (pendência na frente); NPC sem a opção: `inconsciente` direto.
- Rolagem: `d20 >= 10` sucesso, senão falha, sem modificador. 3 sucessos -> `inconsciente` (0 PV, fora de combate); 3 falhas -> `morto`. Entre uma e outra, uma rolagem no início de cada turno dele.
- Cura acima de 0 -> `de-pe`, contadores zerados. Dano a 0 PV em `inconsciente` -> volta a `salvaguarda` com contadores zerados.
- O mestre sobrescreve qualquer resultado; raciais (Duro de Matar, regeneração Majin, Zenkai, Androide Ilimitado) ficam com o mestre no v1.

## 13. Fim da batalha (`fim.ts`)

`resumoDoFim(cena, fichas)` por personagem com ficha DBT:

```
pctTecnicas   = opcoes.exaustao ? 5 x usos.tecnicaDeRankMaximo : 0   // só Rank >= C e Rank == rankMaximo
pctInferiores = opcoes.exaustao ? soma(5 x estagio de cada uso inferior) : 0
novos         = floor(pkMax x (pctTecnicas + pctInferiores) / 100) + kiBloqueado
pkBloqueados  = min(pkMax, desgaste.pkBloqueados + novos)            // exemplo p. 107: 6 usos C, 30 PK -> 9
```

O mestre vê a tabela (editável) e escolhe "Aplicar e encerrar" ou "Encerrar sem aplicar". Aplicar grava por `mesa.ajustarPersonagem` (uma entrada de histórico por ficha): `dbt.desgaste` (`pkBloqueados`, `usosTransfMaxima += usos.transfMaxima`, `choqueUsado ||= usos.choque`) e `pk atual = max(0, pkMax - pkBloqueados)`. PV fica como está. Transformação e condições somem com a batalha (Quebrado é "até o fim do combate"). Depois `desligar` (o host manda `batalhaDBT.estado: null` uma vez). Encerrar não se desfaz; o histórico da ficha guarda tudo.

## 14. Registro e Desfazer (`registro.ts`)

- Um comando = uma linha. `reversao.nucleo` é o núcleo ANTES do comando; `reversao.fichas` são as partes de cada ficha mudada (`partesDoAjuste(antes, depois, sistema)`, import de `lib/batalha/registro.ts`).
- `podeDesfazerDBT(linha, quem, registro)`: a linha é a última não desfeita do registro E (mestre, OU jogador autor da linha com `comD20 === false` e tipo em movimento, voo, transformacao, acao, ficha).
- Desfazer: `nucleo = linha.reversao.nucleo`; cada ficha: `desfazerFicha(atual, sistema, partes, quem, agora)` (delta sobre o valor de agora) -> `mesa.ajustarPersonagem`; marca `desfeita`. Efeitos não voltam.
- `registrarAjuste(personagemId, antes, depois, autor)` (ajuste rápido de ficha durante a batalha): linha tipo `ficha` com o núcleo atual como foto (desfazer só volta a ficha).
- Texto do jogador (`textoPublico`): d20 natural e total são públicos; CA, PV e Ki só de quem ele vê como "eu" ou "aliado"; dano em NPC sai só como faixa ("Médio").

## 15. Automático x manual

`opcoes.modo` troca a qualquer hora (linha "mestre"); uma pendência `confirmar` já aberta fica até ser confirmada.

**Automático:** o host rola e aplica tudo; para só nas escolhas de alguém (declaração, janela de reação, agarrão, aposta do Choque, escolhas de início de turno, salvaguarda de PJ, ação gratuita) e nas técnicas especiais e talentos com mitigação digitada. Errou: Desfazer volta um passo por vez.

**Manual:** cada etapa abaixo vira um cartão `ConfirmacaoDBT` no topo do painel do mestre, com o cálculo pronto e cada número editável. O jogador vê "Aguardando o mestre confirmar".

| Etapa | O que o mestre muda | Pular |
|---|---|---|
| Iniciativa | d20 de cada um (dado físico), ordem final (arrastar), efeito do 1 e do 20 | |
| Ataque | d20 (marca `digitada`), vantagem/desvantagem e fontes, temporários, CA usada, faixa (erro/mínimo/médio/completo/crítico), dano previsto | [x] Gastar Ki, [x] Abrir reações |
| Resolução | mitigação de cada reação (d20 e faixa da defensiva), dano final, CD e atributo de cada condição | [x] Aplicar dano, [x] cada condição, [x] Instável, [x] gatilho do tipo de dano |
| Teste (condição, agarrão, estabilizar, morte) | d20 e "passou/falhou" | |
| Choque | d20 de cada rodada | |
| Fim | toda a tabela de exaustão | aplicar ou não, por ficha |

Sempre, nos dois modos, pelo menu da carta: aplicar/tirar condição; temporários; trocar lado; Reação em Desvantagem; derrubar (queda); abrir ataque de oportunidade ou ação gratuita; disparar ação oculta; dar a vez; mover carta; incluir/tirar combatente; fechar janela; responder por qualquer um. Ki e PV pelo ajuste rápido de sempre (vira linha `ficha`). A recarga de Ki é sempre automática (desfazível).

UI do cartão: uma linha de conta legível ("Goku -> Kamehameha em Vegeta: d20 [14] +3 INT +2 EP -1 dif. EP = 18 vs CA [16] -> margem 2 -> [Mínimo] 11"), campos entre colchetes editáveis, faixa em controle segmentado, uma caixa por passo, Enter = Confirmar, "Cancelar ação" (nada foi pago ainda).

## 16. Módulos e funções públicas

`lib/dbt/batalha/` é puro. Imports permitidos: `lib/dbt/*`; de `lib/batalha/` só `mesa` (tipo), `registro` (`partesDoAjuste`, `desfazerFicha`, tipo `ParteDaFicha`), `turnos` (só `type AutorDaAcao`), `caminhoAndado`, `blocos` (tipo `Casa`), `judge`, `equipes`; `lib/ajusteDaFicha`. Proibidos: `formula`, `golpe`, `reacao`, `reacaoComTecnica`, `acoes`, `leituraDaFicha`, `transformacao`, `invocacao`, `marca`, `selos`, `passivas`, `contador`, `regrasDoCampo`, `vistaDoJogador` e `stores/batalhaStore`.

| Arquivo | Responsabilidade | Públicas |
|---|---|---|
| `tipos.ts` | seção 2 + constantes | tipos |
| `leitura.ts` | ficha -> `FichaLida` (único que importa `modelo.ts` e `regras/*`) | `lerFichaParaBatalha`, `fichasDaCena(personagens, sistema, combatentes)` |
| `contas.ts` | números puros | `epTotal`, `modEfetivo`, `caEfetiva`, `custoEfetivo`, `vantagemDoAtaque`, `rolarComVantagem`, `montarAcerto`, `casasDoDeslocamento`, `metrosPorCasa`, `kiDaCorrida`, `kiDeDesengajar`, `kiDeVoo` |
| `condicoes.ts` | tabela da seção 10 e tique | `COMPORTAMENTO`, `aplicarCondicao`, `testesDoInicio`, `expirarNoInicio`, `expirarNoFim`, `expirarNaRodada`, `efeitosNaRolagem` |
| `ordem.ts` | iniciativa e vez | `rolarIniciativas`, `ordenarIniciativa`, `iniciarTurno`, `terminarTurno`, `terminarRodada`, `proximaVez`, `turnoNoM` |
| `acoes.ts` | opções e ações de 6.2 | `opcoesDeAcao`, `agir` |
| `ataque.ts` | seção 7 | `calcularAtaque`, `pagarAtaque`, `abrirJanela`, `resolverJanela`, `aplicarResultado` |
| `reacoes.ts` | seção 8 | `opcoesDeReacao`, `entrarNaJanela`, `responderJanela` |
| `choque.ts` | seção 9 | `podeChocar`, `abrirChoque`, `apostar`, `rolarRodadaDoChoque` |
| `morte.ts` | seção 12 | `caiu`, `rolarSalvaguarda`, `curou` |
| `posicao.ts` | grade | `PosicoesDaCena`, `adjacentes`, `flanqueado`, `sobAmeaca`, `distanciaEmMetros`, `aliadoMaisProximo` |
| `pendencias.ts` | responder a qualquer pendência | `opcoesDaPendencia`, `responder` |
| `fim.ts` | seção 13 e avisos | `resumoDoFim`, `mudancasDoFim`, `vitoriasAutomaticas`, `ladoDerrotado` |
| `registro.ts` | seção 14 | `novaLinha`, `comLinhaDBT`, `podeDesfazerDBT`, `linhasParaJogador`, `linhasDoMestre` (-> `LinhaNaTela`) |
| `motor.ts` | despacho | `nucleoInicial(inicio, fichas, ctx)`, `reduzir(nucleo, comando, autor, ctx)` |
| `vista.ts` | recortes | `VistaDBT` (tipo do fio), `vistaParaJogadorDBT(cena, ctxJogador)`, `vistaDoMestreDBT(cena, fichas)`, `podeComandar(cena, ctxJogador, comando)` |
| `ponte.ts` | contrato host e store | `PonteDaBatalhaDBT` |
| `inicio.ts` | quem entra | `entrantesDaCena(tokens, personagens, equipes, incluir?)`: mesmo filtro de `combatentesIniciais` (hidden, sem characterId, `entraNaBatalha`), sem ordenar; lado = equipe, senão `token.npc ? 'npc' : 'pj'` |

```ts
export type ComandoDBT =
  | { tipo: 'declarar'; combatenteId: string; transformacaoId: string | null }
  | { tipo: 'rolarIniciativa'; digitados?: Readonly<Record<string, number>> }
  | { tipo: 'ordenar'; ordem: readonly string[] }                 // mestre
  | { tipo: 'comecar' }
  | { tipo: 'agir'; combatenteId: string; vez: { rodada: number; turno: number }; opcao: string; alvos: readonly string[]; extras?: ExtrasDaAcao }
  | { tipo: 'responder'; pendenciaId: string; combatenteId: string | null; opcao: string; aposta?: number; atributo?: 'des' | 'for'; edicoes?: EdicoesDoMestre }
  | { tipo: 'passar'; vez: { combatenteId: string; rodada: number; turno: number } }
  | { tipo: 'andou'; tokenId: string; blocos: number }
  | { tipo: 'mestre'; acao: AcaoDoMestreDBT }                      // menu da carta, seção 15
export interface ExtrasDaAcao { modo?: 'dano' | 'agarrar'; cargasKi?: number; basicos?: number; nivelDeVoo?: NivelDeVoo; textoOculto?: string; kiOculto?: number }
export interface ContextoDBT { fichas: ReadonlyMap<string, FichaLida | null>; posicoes: PosicoesDaCena | null; rolar: (lados: number) => number; gerarId: () => string; agora: number }
export interface ResultadoDBT {
  nucleo: NucleoDBT
  fichas: readonly { personagemId: string; pv?: number; pk?: number; dbt?: (f: FichaDBT) => FichaDBT }[]   // valores finais, não deltas
  linha: Omit<LinhaDBT, 'id' | 'seq' | 'quando' | 'reversao' | 'desfeita'> | null
  efeitos: readonly Omit<EfeitoDBT, 'seq'>[]
  recusa?: string                                                 // nucleo inalterado
}
```

O motor mantém, durante um comando, uma cópia local de PV/PK de cada ficha (lida no começo) e devolve os valores finais: assim "Ki chegou a 0" e "PV chegou a 0" são vistos no mesmo comando.

`stores/batalhaDBTStore.ts`:

```ts
export function criarBatalhaDBTStore(mesa: MesaDaBatalha, deps: { rolar: (lados: number) => number; agora: () => number; posicoes: (sceneKey: string) => PosicoesDaCena | null }): LojaDaBatalhaDBT
export const useBatalhaDBTStore = criarBatalhaDBTStore(mesaDaAventura, { rolar: secureRollDie, agora: Date.now, posicoes: posicoesDaCenaAberta })
// estado: { cenas: Record<sceneKey, CenaDBT>; anuncio: { seq; sceneKey; transicao?; texto? } | null }
// ações: ligar(sceneKey, abertura, inicio): boolean   (recusa se a cena já está na batalha One Piece; o App passa o teste)
//        desligar, ligada, reset, zerarCaminhos, somarCaminho, moverJudge,
//        comando(sceneKey, autor, ComandoDBT): { ok: boolean; motivo?: string },
//        desfazer(sceneKey, linhaId, autor): boolean, registrarAjuste(personagemId, antes, depois, autor),
//        resumoDoFim(sceneKey), encerrar(sceneKey, resumo | null)
export const ponteDaBatalhaDBT: PonteDaBatalhaDBT
export function deveAvisarJogadoresDBT(state, previous): boolean   // chaves, zerados, turnosRev (como deveAvisarJogadores)
export function vezTokenIdDaCenaDBT(state, sceneKey): string | null
export function esperandoOMestreDBT(state, sceneKey): number       // pendências do mestre + vez de NPC
export function efeitosDaCenaDBT(state, sceneKey): readonly EfeitoDBT[]
```

Corpo de `comando`: lê a cena -> monta `ctx` (fichas via `leitura.ts` a partir de `mesa.personagens()`/`mesa.sistema()`, `deps.posicoes`, `deps.rolar`) -> `reduzir` -> recusa: devolve `{ ok: false, motivo }` -> para cada ficha do resultado: `mesa.ajustarPersonagem` com `aplicarAjustes(personagem, sistema, [ajusteDoAtualDigitado(p, 'pv', v), ...], quem, agora)` e, se houver, a função `dbt`; guarda `partesDoAjuste` -> grava a linha com `reversao` e os efeitos com `seq` -> `turnosRev += 1`. `stores/posicoesDaCenaDBT.ts`: `posicoesDaCenaAberta(sceneKey)` lê `useMapStore` só se a cena é a aberta; senão `null`.

`PonteDaBatalhaDBT` (`lib/dbt/batalha/ponte.ts`): `cena(sceneKey): (EstadoDBT & { judge?: JudgeNaCena }) | null`; `comando(sceneKey, autor, comando): boolean`; `desfazer(sceneKey, linhaId, autor): boolean`; `registrarAjuste(personagemId, antes, depois, autor): void`; `fichasLidas(sceneKey): ReadonlyMap<string, FichaLida | null>` (para o recorte).

## 17. Rede

`net/protocoloDaBatalhaDBT.ts` (prefixo próprio; leitores genéricos podem ser importados, tipos de mensagem do One Piece não):

| Mensagem | Sentido | Campos | Validação |
|---|---|---|---|
| `batalhaDBT.agir` | jogador -> host | `reqId`, `combatenteId`, `vez {rodada, turno}`, `opcao`, `alvos[]`, `extras?` | ids até 80 chars; `alvos` até 12, sem repetir; `cargasKi` 0-5; `basicos` 4-10; `nivelDeVoo` 0-3; `textoOculto` até 200; `kiOculto` 0-200; inteiros |
| `batalhaDBT.responder` | jogador -> host | `reqId`, `pendenciaId`, `combatenteId`, `opcao`, `aposta?` 0-10, `atributo?` des ou for | idem; nunca d20, total, dano ou CA |
| `batalhaDBT.passar` | jogador -> host | `reqId`, `vez {combatenteId, rodada, turno}` | idem |
| `batalhaDBT.desfazer` | jogador -> host | `reqId`, `linhaId` | idem |
| `batalhaDBT.estado` | host -> jogador | `estado: VistaDBT` ou `null` | leitor estrito (campo torto derruba a mensagem); tetos de lista |
| `batalhaDBT.resultado` | host -> jogador | `reqId`, `ok`, `motivo?` (até 120) | |
| `batalhaDBT.efeitos` | host -> jogador | `efeitos: EfeitoDBT[]` (até 20) | só tokens do recorte; número de dano só em "eu"/"aliado" |

Campo a mais (ex.: um d20) no pedido do jogador é ignorado pelo leitor; o motor nunca lê número de rolagem do fio. Aliados: `batalhaDBT.aliados` (host -> jogador, fase final de 02/11) leva os personagens dos aliados de equipe que estão na ordem, pelo `paraOFio` (sem dado de mestre, sem `dbt.npc`), antes do recorte e só quando a lista muda pela referência; o leitor recusa a mensagem inteira com personagem torto, NPC, campo de mestre, `dbt.npc`, id repetido ou acima de 64. O jogador guarda em `batalhaDBTAliados` e a carta do aliado abre o `PerfilDaCarta` (`quemOlha="jogador"`); o `estado: null` leva os dois embora.

`VistaDBT` (em `vista.ts`): `{ fase, rodada, modo, vez (tokenId), turno {n, m}, cartas[] (só tokens do recorte: tokenId, nome do recorte, lado eu/aliado/outro, iniciativa, pv/pk só eu e aliado, condições, transformação, voo, situação, agarrado), meus[] (combatentes dele: pv, pk, EP base e total, CA, deslocamento {casas, andou}, voo, acoes: OpcaoDeAcao[] só na vez dele), pendencias[] (só as dele, com opcoes {chave, rotulo, ki, gratis, bloqueio} e o que pedem: aposta ou atributo), janela (se ele vê atacante ou alvo; dano previsto só se o alvo é eu/aliado; "Reagir também" se ele tem reação pagável), aguardando (texto), registro (até 50, texto público), judge? }`.

`net/batalhaDBTNoHost.ts`: `criarBatalhaDBTNoHost({ ponte, agora }) -> { entrou, sync, agir, responder, passar, desfazer }`, com o padrão do One Piece COPIADO (não importado: o arquivo dele é misto): estado enviado por clientId (diff por JSON), teto de pedidos por jogador por janela (mesmos números do One Piece), `reqId` idempotente por conexão (32 guardados), efeitos por `seq`, `null` uma vez ao sair. Conferências antes da store: conexão com `lugar` de batalha; `combatenteId` em `meusTokens` E personagem em `meusPersonagens` (posse, como o One Piece); alvos em `fichasNaTela` dele; `podeComandar` (vez dele com fila vazia para `agir`/`passar`; pendência endereçada a um combatente dele, ou janela aberta com "Reagir também", para `responder`; `podeDesfazerDBT` para `desfazer`). O autor é sempre `{ tipo: 'jogador', playerId, nome }` montado pelo host.

## 18. Pontos de despacho em arquivos compartilhados (aditivos, linhas conferidas)

`App.tsx`
- `:50` import: somar `useBatalhaDBTStore, ponteDaBatalhaDBT, deveAvisarJogadoresDBT, vezTokenIdDaCenaDBT, esperandoOMestreDBT`.
- `:924` `getBatalha: (k) => op.ligada(k) || dbt.ligada(k)`; `:925` `onBatalhaAndou` vai à store que tem a cena (`op.ligada(k) ? op.somarCaminho : dbt.somarCaminho`); `:927` `getCaminhosDaBatalha: (k) => op.cenas[k] ?? dbt.cenas[k] ?? null`; `:929` somar `ponteDaBatalhaDBT`.
- `:986` (visão de teste) `getBatalha` com o mesmo OU.
- `:1033-1038` segundo `useEffect` assinando `useBatalhaDBTStore`: `anuncio` -> `anunciarBatalha`; `deveAvisarJogadoresDBT` -> `notifyBatalhaChanged`.
- `:1417` NÃO mudar `batalhaNaCenaAberta` (ela liga montagens do One Piece em `:1434`, `:1465`, `:3282`, `:3286`, `:3319`); somar `batalhaDBTNaCenaAberta`. `:1419` `vezTokenId = op ?? dbt`; `:1420` `esperandoNaBatalha = op + dbt`.
- `:3250` `batalhaLigada={batalhaNaCenaAberta || batalhaDBTNaCenaAberta}` (caminho andado é infra).
- `:3282` mira do mestre: OU com a mira DBT (`useMiraDBT`, store pequena em `components/dbt/batalha/`).
- `:3319` somar `{batalhaDBTNaCenaAberta && <FaixaDoMestreDBT sceneKey=... />}`.
- `:4347` `batalha={motorDoSistema(sistema ativo) === 'dragon-ball-tales' ? <PaginaDaBatalhaDBT .../> : <PaginaDaBatalha .../>}`. O slot em `components/livro/LivroDaMesa.tsx:305` só renderiza (o dossiê apontava ali; o despacho real é no App). Uma página só = um Shift+B só.

`components/RpgDialogs.tsx:128`: somar `useBatalhaDBTStore.getState().registrarAjuste(...)` ao lado do One Piece (ajuste rápido do mestre).

`net/protocol.ts`: `:63-65` imports; `:1197-1199` união jogador -> host `| BatalhaDBTPlayerMessage`; `:2049` união host -> jogador `| BatalhaDBTHostMessage`; `:3438-3463` cases `batalhaDBT.agir`, `batalhaDBT.responder`, `batalhaDBT.passar`, `batalhaDBT.desfazer`.

`net/hostSession.ts`
- `:1781` opção `ponteDaBatalhaDBT?: PonteDaBatalhaDBT`.
- `:3577` `const batalhaDBTNoHost = criarBatalhaDBTNoHost({ ponte: options.ponteDaBatalhaDBT, agora: () => now() })`.
- `:5513` `outbound.push(...batalhaDBTNoHost.entrou(conexaoNaBatalha(clientId, playerId, world), world.rpg))`.
- `:7656` `lugarNaBatalha`: trocar `options.ponteDaBatalha === undefined` por `options.ponteDaBatalha === undefined && options.ponteDaBatalhaDBT === undefined` (único trecho modificado; com a ponte One Piece presente nada muda para ela).
- `:7878` somar `options.ponteDaBatalhaDBT?.registrarAjuste(...)`.
- `:7900` função nova `handleBatalhaDBT`, copiando o cuidado `broadcastsFeitos`/`jaSaiu` de `:7904-7907` (senão o sync manda a ficha velha por cima).
- `:9749-9762` cases novos `batalhaDBT.*` -> `handleBatalhaDBT`.
- `:11267` `outbound.push(...batalhaDBTNoHost.sync(conexoesNaBatalha(world), world.rpg))`.
- `:3723` `emBatalha` não muda (usa `getBatalha`, que vira OU). Rust não muda (sem allowlist de mensagem).

`player/playerConnection.ts`: `:373` estado `batalhaDBTEstado?: VistaDBT` e `batalhaDBTEfeitos`; `:4897-4925` cases `batalhaDBT.estado`, `batalhaDBT.resultado`, `batalhaDBT.efeitos` (a mesa/TV ignora, como no One Piece); `:2756-2763` `esquecerBatalha` limpa também os campos DBT; métodos novos `agirNaBatalhaDBT`, `responderNaBatalhaDBT`, `passarVezNaBatalhaDBT`, `desfazerNaBatalhaDBT` no padrão de `:6035-6130` (o mesmo mapa `pedidosDeBatalha`).

`player/main.tsx`: `:1451` `vezTokenId` com fallback DBT; `:1453` `judge` com fallback; `:1535` `aoEscolherFicha` também com `batalhaDBTEstado`; `:1544` somar `<BatalhaDoJogadorDBT>` quando houver `batalhaDBTEstado`; `:1698` somar `<FaixaDoJogadorDBT>`.

## 19. Telas (`components/dbt/batalha/`)

Componentes só de apresentação, alimentados por view-model (`vistaDoMestreDBT` no mestre, `VistaDBT` no jogador). Reusam sem editar: `components/batalha/FaixaDaOrdem.tsx` (com `regras={null}`), `CartaDaOrdem.tsx`, `RegistroDaBatalha.tsx`, `MenuDaCarta.tsx`, `components/livro/QuemEntraNaBatalha.tsx`. `dadosDaFaixaDBT.ts` monta `DadosDaFaixa`/`DadosDaCarta` (transformação em `forma`, condições em `selos` com `mods: ''`, PV/PK em `recursos`).

| Arquivo | O que faz |
|---|---|
| `PaginaDaBatalhaDBT.tsx` | página do livro: controle + painel quando ligada |
| `ControleDaBatalhaDBT.tsx` | Iniciar/Encerrar, Shift+B, abertura, opções (modo, exaustão, salvaguarda de NPC), "Quem entra" |
| `PainelIniciativaDBT.tsx` | declarações, Rolar, tabela, arrastar empate |
| `PainelDoMestreDBT.tsx` | vez, pendências do mestre, `ConfirmacaoDBT`, avisos (vitória automática, lado caído), ações do NPC da vez |
| `MenuDeAcoesDBT.tsx` | lista de `OpcaoDeAcao` com custo e bloqueio; contador "4/6 casas"; voo; transformar (mestre e jogador) |
| `EscolhaDeAlvoDBT.tsx` | alvo por toque no mapa (`aoEscolherFicha`) ou lista; prévia de chance só para o mestre |
| `CaixaDeReacaoDBT.tsx` | janela: quem atacou, faixa, dano previsto (se eu/aliado), opções, "Reagir também" |
| `PendenciaDBT.tsx` | testes, salvaguarda ("Rolar"), queda, agarrão (DES/FOR), escolhas de início |
| `ChoqueDePoderDBT.tsx` | placar até 3, aposta de Ki |
| `ConfirmacaoDBT.tsx` | cartão do modo manual (seção 15) |
| `FimDaBatalhaDBT.tsx` | resumo de exaustão editável |
| `FaixaDoMestreDBT.tsx`, `FaixaDoJogadorDBT.tsx` | `FaixaDaOrdem` + registro + menu da carta |
| `BatalhaDoJogadorDBT.tsx` | contêiner do jogador: menu na vez, reação, pendências |
| `EfeitosDBT.tsx` | número ou faixa flutuando sobre o token (opcional da fatia 3) |
| `miraDBT.ts` | store mínima "mirando" para o mestre |

Visual: segue a ficha Scouter (plano mãe item 7) e passa pelas skills de design do Emil na fatia 3.

## 20. Fatias (em série; até 2 escritores, todos `programador-frontend`)

**Fatia 1, motor + store** (1 escritor): `lib/dbt/batalha/*`, `stores/batalhaDBTStore.ts`, `stores/posicoesDaCenaDBT.ts`, testes escritos e não rodados `lib/dbt/batalha/*.test.ts` e `stores/batalhaDBTStore.test.ts`. Primeiro passo: ler `modelo.ts` e `regras/*` reais e fechar `leitura.ts`.
Aceite: (a) `rtk proxy npx tsc --noEmit` limpo; (b) `rg -n "lib/batalha/(formula|golpe|reacao|reacaoComTecnica|acoes|leituraDaFicha|transformacao|invocacao|marca|selos|passivas|contador|regrasDoCampo|vistaDoJogador)|stores/batalhaStore" client/src/lib/dbt client/src/stores/batalhaDBTStore.ts` vazio; (c) `git diff --stat` só nos caminhos da fatia; (d) os testes escritos cobrem, com números do livro: CA 18 (17 erra, 19-20 mínimo, 21-23 médio, 24+ completo); dif. EP +2 (margem 0 mínimo, 1-3 médio, 4+ completo); alvo 2 EP acima = -2 no acerto; crítico 44 -> 88; 5 básicos = -10 numa rolagem; Kamehameha 11/22/44; empate de iniciativa pela DES bruta; 20 natural na frente; recarga com débito do Choque; Exposto crítico com 16; Sangrando sobe estágio e o excedente soma o mínimo; Atordoado perde a vez e reage x2; Desnorteado -2/-2; salvaguarda 3/3; exaustão 6 usos C em 30 PK = 9; Desfazer LIFO volta Ki e PV; jogador não desfaz linha com d20; opção fora de `opcoesDeAcao` recusada.

**Fatia 2, fio** (o mesmo escritor, depois da 1): `net/protocoloDaBatalhaDBT.ts`, `net/batalhaDBTNoHost.ts`, `lib/dbt/batalha/vista.ts` (se não ficou na 1), os pontos da seção 18 em `net/protocol.ts`, `net/hostSession.ts`, `App.tsx` (só fiação: `:50`, `:924-929`, `:986`, `:1033-1038`, `:1417-1420`), `components/RpgDialogs.tsx`, `player/playerConnection.ts`. Testes escritos `net/protocoloDaBatalhaDBT.test.ts`, `net/batalhaDBTNoHost.test.ts`.
Aceite: tsc limpo; `git diff` nos arquivos compartilhados só com linhas somadas, fora as 4 expressões trocadas listadas (`getBatalha` duas vezes, `getCaminhosDaBatalha`, `lugarNaBatalha`); testes escritos cobrem posse recusada, vez errada, reqId repetido não age duas vezes, número de dado no pedido ignorado, `estado: null` ao desligar, cena One Piece não recebe `batalhaDBT.*` e cena DBT não recebe `batalha.estado`.

**Fatia 3, telas** (pode ser um 2º escritor: o lado do mestre logo após a fatia 1, o do jogador após a 2): `components/dbt/batalha/*`, `App.tsx` `:3250`, `:3282`, `:3319`, `:4347`, `player/main.tsx` `:1451`, `:1453`, `:1535`, `:1544`, `:1698`; Judge DBT por último (o efeito de `App.tsx:1433-1452` replicado para a store DBT).
Aceite: tsc limpo; build; roteiro da fase 5 (mestre + jogador em duas janelas): iniciar numa aventura Dragon Ball; o jogador declara transformação; rolar iniciativa; o jogador ataca com técnica (o Ki desce na ficha dele); o mestre reage com Barreira e com Defensiva; condição aplicada aparece na carta; modo manual: o mestre digita o d20 e troca a faixa; transformar; Desfazer volta um passo; PV a 0 abre a salvaguarda; Encerrar aplica a exaustão; numa aventura One Piece, a batalha abre igual a antes.

## 21. Ambiguidades do livro e decisão

1. Reação gasta "ST" (9.3): é Ki (8.5, 9.5.6, nota do transcritor).
2. Vantagem/desvantagem não definidas: 2d20 maior/menor; uma de cada anula; não acumulam.
3. Margem 0: erra (8.4 "igual ou inferior", exemplo CA 18). Com EP maior, a tabela 2.3.3 vale literal, inclusive a quebra a partir de -5 e o "1" seco da linha -1; acima de 10 níveis, -1 por nível.
4. EP 2.3.1 e 2.3.2 somam; a diferença usa EP total (transformação incluída); a tabela de faixas só desloca a favor do mais forte.
5. Arredondamento de 1/4, 1/2, mitigação, metade do Choque e do Instável: para baixo (p. 84: 1/4 de 50 = 12). Exaustão: soma as % e arredonda o total para baixo.
6. Crítico "dano final dobrado": dobra depois dos bônus do atacante e antes da mitigação da reação.
7. Quebra de Guarda "ignora a CA": o próximo ataque contra ele usa CA 0 (na prática, completo); 1 natural ainda erra; consome.
8. Sangrando no completo: o estágio extra vira +dano mínimo, a mesma regra da Acumulação e da Devastadora (p. 76-77).
9. "Ataque Básico" (9.2) = rótulo "Técnica Básica" (o único que existe, j2-64). Técnica não básica: 1x por Turno de Ação (j2-64, textos da Técnica Básica e da Reativa), mais estrito que "duas vezes seguidas".
10. Mais de 3 básicos condensados: uma faixa para todos; dano = n x dano da faixa; Ki = soma; uma janela.
11. Salvaguarda contra a morte: 3 sucessos / 3 falhas (o parágrafo); os marcadores descrevem o estado final. 1ª rolagem na hora, depois uma por turno dele.
12. Voo: decolar 4 Ki (nível 1); mudar de nível 2 Ki por mudança, qualquer número de níveis (exemplo p. 117); pousar 0. Nível 3 = "voo altíssimo"; o vão 20-21 m não importa (níveis são abstratos).
13. Queda: estabilizar = fica no nível, sem dano; senão vai ao chão com 1d20 por nível. Desequilibrado não deixa estabilizar.
14. Penalidade de armadura "-X Ki por turno": sai da recarga de cada turno.
15. Exaustão: por uso ("toda vez", 8.5.1.2 e 8.5.1.3); 2º uso da transformação máxima: Ki bloqueado na hora e somado à exaustão no fim (fica até Descanso Longo). Regra opcional: ligada por padrão, o mestre confirma no fim.
16. Empate em teste resistido (agarrão, soltar-se): fica como está. Teste contra CD: igualar passa. Choque: empate não pontua e rola de novo.
17. Reação em Desvantagem (nar 5): interruptor por combatente; reação defensiva não desconta Ki mas exige ter o Ki; sugestão automática quando o lado dele tem 1 de pé contra 2 ou mais.
18. Atordoado: perde o próximo Turno de Ação (quando vier); "reações x2" até o fim da rodada em que foi atingido; acaba a transformação.
19. "Fim do próximo turno" = o próximo Turno de Ação do afetado que começar depois da aplicação.
20. Teste de condição: `d20 + mod + EP total` (2.3.1, "todas as rolagens"); CD com EP base (8.1.2). Condição sem atributo de teste no livro: tabela da seção 10 (decisão nossa; o mestre troca no manual). "Ou" = maior modificador.
21. Gatilho do tipo de dano: sem EP no teste do alvo ("não afetado pela escala"); o efeito do rótulo é aplicado pelo mestre no v1.
22. Testes sem momento definido (Enraizado, Envenenado, Instável, Sangrando): no início do turno do afetado, um por condição.
23. Imunidade do 20 natural "no primeiro turno" = rodada 1 (o livro usa "primeiro turno" para a 1ª rodada em "perdendo seu turno de ação no primeiro turno").
24. Vitória automática (2.3.4): só aviso ao mestre, par a par, com o menor EP >= 1 (EP 0 viraria derrota para qualquer EP 1).
25. Choque "reação ofensiva não sofre disto": técnica Reativa no Choque paga 1x e não gera débito. "Mesma EP" = EP total.
26. Movimento "uma única vez por turno": conta o total de casas no turno; dividir é permitido (o VTT anda passo a passo).
27. Barreira usada como reação recalcula o ataque que abriu a janela (senão a reação seria inútil); vale até o início do próximo turno do reator.
28. Defensiva: soma EP total na rolagem (é rolagem, 2.3.1), sem a penalidade de 2.3.2 (não é ataque).
29. Adicionar Salvaguarda, "escala se aplica igual": a faixa desloca a favor do mais forte e a CD cai pela diferença quando o atacante é mais fraco.
30. Efeito Negativo em técnica de dano: testa só se o dano final (depois da mitigação) for maior que 0 (j2-64, "se o alvo receber dano").
31. Lacuna Mental "o Mestre sorteia": o host sorteia entre técnicas ativas e transformações; o mestre pode trocar.
32. Controle Mental: no v1 só o mestre comanda o controlado.

## 22. Riscos e como detectar cedo

1. **API real de `modelo.ts`/`regras/*` diferente da seção 3.** Detectar: o primeiro passo da fatia 1 é escrever `leitura.ts` contra os arquivos reais e rodar tsc antes de qualquer outro arquivo. Contenção: só `leitura.ts` importa os dois.
2. **`App.tsx`: a flag de batalha alimenta montagens do One Piece.** Trocar `batalhaNaCenaAberta` por OU montaria `FaixaDoMestre`, `EfeitosDoMestre`, mira e Judge do One Piece numa cena DBT. Detectar: `git diff App.tsx` não pode tocar `:1417`; revisão linha a linha na fatia 2.
3. **`hostSession.lugarNaBatalha` (`:7656`) e o sync duplo.** Sem a troca da condição, a conexão nunca entra na batalha DBT numa sessão sem ponte One Piece; sem o cuidado `jaSaiu` de `:7905`, o sync manda ficha velha. Detectar: teste escrito do host (fatia 2) só com a ponte DBT.
4. **Escrita de ficha a cada ação** (recarga por turno, Ki, PV): o histórico da ficha cresce e cada escrita sincroniza personagens. O One Piece já faz o mesmo com SP; `aplicarAjustes` junta entradas em 5 s. Detectar: passeio da fase 5 com 6 combatentes por 5 rodadas, conferindo travada (p95) no mestre.
5. **Desfazer LIFO com ajuste rápido no meio:** o mestre precisa desfazer o ajuste antes da ação. Aceito por previsibilidade; a tela explica "desfaça as de cima primeiro".
6. **Posição só da cena aberta:** batalha numa cena que o mestre não está olhando perde flanco, sob ameaça e distância do apoio. Fallback: fontes desligadas, o mestre liga à mão; linha "posição desconhecida".
7. **`pk` ao fim:** se a ficha Scouter recalcular `pk atual` ao abrir, pode apagar a exaustão. Combinar com o dono da ficha: `pkBloqueados` só sai pelo Descanso Longo.
8. **Mesma cena nas duas stores:** `ligar` DBT recusa se `op.ligada(k)`, e o controle One Piece nunca aparece numa aventura DBT (despacho em `App.tsx:4347`).

## 23. Fora do v1 (fica com o mestre, com linha no registro)

Efeitos dos rótulos de tipo de dano (Tracionante, Pregante etc.), Isolante, Presságio, Lastro, Carga Crescente, Ataque Curvo, Fragmentação; raciais (Duro de Matar, regeneração Majin, Zenkai, Raça Guerreira, Androide Ilimitado e Absorvente, Ōzaru); detecção automática do ataque de oportunidade; bloquear o movimento de Enraizado/Agarrado/Paralisado no host; dividir o Ki de Levantar. (O perfil completo do aliado, `batalhaDBT.aliados`, entrou na fase final.) A Arena DBT (fase 4) usa `criarBatalhaDBTStore(mesaDaArena, deps)` sem mudança no motor.
