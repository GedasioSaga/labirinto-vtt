import type { Personagem } from '../personagem'
import { lerSistemaDeRpg, type SistemaDeRpg } from '../sistemaDeRpg'
import { alvoDoCaminho, CAMPOS_DO_MESTRE, ESQUEMA_DO_CAMINHO, type NomeDaRegra } from './caminho'
import { ehRegistro, type Json } from './json'
import { podeEscreverNaFicha, podeVer } from './permissao'
import type { FichaGuardada, FichaNoEstado, Membro, MembroProjetado, OpGravada, Visibilidade } from './tipos'

/**
 * PROJEÇÃO (docs/planos/lobby-jogadores-2026-11-05.md §6.4): o que o jogador
 * recebe. Ele vê TUDO dos colegas, menos os campos do mestre (dono, combate,
 * soCenario, nomeDoJogador, notaDoMestre) e o bloco de NPC da ficha Dragon
 * Ball. Mochila e moedas ficam (≠ `paraOFio`, que é só da sala LAN).
 *
 * O INIMIGO LIBERADO para o treino (§8.2, T8) tem projeção própria, mais
 * estreita: além dos campos do mestre, também sem mochila e moedas (o que o
 * NPC carrega é segredo do mestre; o treino luta com a ficha).
 *
 * A remoção é pelo VALOR, não só pelo caminho: a op que cria ou apaga a
 * ficha inteira leva o doc no `valor` ou no `antes`, e os dois saem
 * projetados. Lista própria (`CAMPOS_DO_MESTRE`), sem importar código de
 * `personagem.ts`, que roda também no Worker.
 */

/** O que o inimigo liberado deixa para trás, além dos campos do mestre. */
const CAMPOS_FORA_DO_TREINO = ['mochila', 'moedas'] as const

/** As regras da tabela 4.7 que mexem na mochila e na bolsa: nunca saem de uma ficha do treino. */
const REGRAS_FORA_DO_TREINO: ReadonlySet<NomeDaRegra> = new Set<NomeDaRegra>(['vaga', 'quantidade', 'campoDoItem', 'moedas'])

/**
 * A cópia de treino tem id próprio (`treino_<id do NPC>`): nunca encontra a
 * ficha da mesa com o mesmo id (o NPC que vira jogador sobe com o id dele), e
 * o app reconhece a cópia que volta pelo `desde` sem precisar da visibilidade.
 */
export const PREFIXO_DA_COPIA_DE_TREINO = 'treino_'

export function idDaCopiaDeTreino(npcId: string): string {
  return `${PREFIXO_DA_COPIA_DE_TREINO}${npcId}`
}

export function ehCopiaDeTreino(fichaId: string): boolean {
  return fichaId.startsWith(PREFIXO_DA_COPIA_DE_TREINO)
}

/** A ficha sem os campos do mestre e sem o NPC da Dragon Ball; mantém mochila e moedas. Nunca muda a recebida. */
export function projetarParaJogador(doc: Personagem): Personagem {
  const copia: Personagem = { ...doc }
  for (const campo of CAMPOS_DO_MESTRE) delete copia[campo]
  if (copia.dbt !== undefined && copia.dbt.npc !== undefined) {
    // Sem a chave, como a ficha de jogador (nada de `npc: undefined`).
    const { npc: _doMestre, ...fichaPublica } = copia.dbt
    copia.dbt = fichaPublica
  }
  return copia
}

/** O inimigo liberado como o jogador o recebe: a projeção do jogador, também sem mochila e moedas. Nunca muda a recebida. */
export function projetarParaTreino(doc: Personagem): Personagem {
  const copia = projetarParaJogador(doc)
  for (const campo of CAMPOS_FORA_DO_TREINO) delete copia[campo]
  return copia
}

type ObjetoJson = { [chave: string]: Json }

function ehObjetoJson(valor: Json | undefined): valor is ObjetoJson {
  return valor !== undefined && valor !== null && typeof valor === 'object' && !Array.isArray(valor)
}

const CHAVES_DO_MESTRE: ReadonlySet<string> = new Set(CAMPOS_DO_MESTRE)
const CHAVES_FORA_DO_TREINO: ReadonlySet<string> = new Set([...CAMPOS_DO_MESTRE, ...CAMPOS_FORA_DO_TREINO])

/** O mesmo que `projetarParaJogador` (ou `projetarParaTreino`), sobre o doc em JSON do `valor`/`antes` de uma op. */
function projetarDocEmJson(valor: Json | undefined, tiradas: ReadonlySet<string>): Json | undefined {
  if (!ehObjetoJson(valor)) return valor
  const publico: ObjetoJson = Object.fromEntries(Object.entries(valor).filter(([chave]) => !tiradas.has(chave)))
  const dbt = publico.dbt
  if (ehObjetoJson(dbt) && Object.hasOwn(dbt, 'npc')) {
    publico.dbt = Object.fromEntries(Object.entries(dbt).filter(([chave]) => chave !== 'npc'))
  }
  return publico
}

/**
 * A op como o jogador a recebe, nos quatro pontos (`estado`, `aplicada`,
 * `historico`, `exportar`). `null` = não vai: ficha escondida, campo do
 * mestre (o jogador vê um buraco na numeração das revs, de propósito) ou, na
 * ficha do treino, a mochila e a bolsa. Na ficha inteira (`[]`), `valor` e
 * `antes` saem projetados pela projeção da visibilidade dela.
 */
export function projetarOpParaJogador(op: OpGravada, visivel: Visibilidade): OpGravada | null {
  if (visivel === 'mestre') return null
  const alvo = alvoDoCaminho(op.caminho)
  if (alvo === null || !ESQUEMA_DO_CAMINHO[alvo.regra].visivelAoJogador) return null
  if (visivel === 'treino' && REGRAS_FORA_DO_TREINO.has(alvo.regra)) return null
  if (alvo.regra !== 'ficha') return op
  const tiradas = visivel === 'treino' ? CHAVES_FORA_DO_TREINO : CHAVES_DO_MESTRE
  const projetada: OpGravada = { ...op }
  const valor = projetarDocEmJson(op.valor, tiradas)
  const antes = projetarDocEmJson(op.antes, tiradas)
  if (valor !== undefined) projetada.valor = valor
  if (antes !== undefined) projetada.antes = antes
  return projetada
}

/**
 * A ficha no `estado` para quem a recebe; `null` = não vê. Para o jogador,
 * o doc vai projetado (a do treino, pela projeção do treino). `ehMinha` =
 * quem recebe pode editá-la (dono, ou o mestre); `nomeDoDono` = `null` na
 * ficha sem dono e no inimigo do treino (o dono é campo do mestre e não
 * chega ao jogador nem pelo nome).
 */
export function fichaNoEstado(eu: Membro, ficha: FichaGuardada, nomeDaConta: (contaId: string) => string | null): FichaNoEstado | null {
  if (!podeVer(eu.papel, ficha) || ficha.apagada) return null
  const doTreino = ficha.visivel === 'treino'
  const dono = doTreino ? undefined : ficha.doc.dono
  const projetar = doTreino ? projetarParaTreino : projetarParaJogador
  return {
    doc: eu.papel === 'mestre' ? ficha.doc : projetar(ficha.doc),
    visivel: ficha.visivel,
    rev: ficha.rev,
    ehMinha: podeEscreverNaFicha(eu, ficha),
    nomeDoDono: dono === undefined ? null : nomeDaConta(dono),
  }
}

/** O que fica fora do sistema no `estado`: o livro de regras e os catálogos dele. */
const PARTES_DO_LIVRO: ReadonlySet<string> = new Set(['livro', 'catalogos'])

/**
 * O sistema publicado como o `estado` o leva (F1): só o que a ficha usa
 * (escolhas, recursos, atributos e abas), pela mesma leitura tolerante do app.
 * O livro e os catálogos ficam de fora, como no `rpg.sistema` da sala LAN
 * (`sistemaSemLivro`): passam de 1 MB no Dragon Ball, iriam em todo `estado`,
 * e o site não os mostra. Saem ANTES de ler: ler confere campo a campo, e o
 * livro é o grosso do sistema. `null` = o guardado não é um sistema que este
 * código lê (formato futuro, motor desconhecido): o `estado` vai sem ele.
 */
export function sistemaParaOJogador(publicado: unknown): SistemaDeRpg | null {
  const semLivro = ehRegistro(publicado) ? Object.fromEntries(Object.entries(publicado).filter(([chave]) => !PARTES_DO_LIVRO.has(chave))) : publicado
  const lido = lerSistemaDeRpg(semLivro)
  return lido.ok ? lido.sistema : null
}

/** Os membros como o jogador os vê: só os ativos, sem e-mail (só `/api/eu` devolve o próprio). */
export function projetarMembros(membros: readonly Membro[]): MembroProjetado[] {
  return membros.filter((membro) => membro.estado === 'ativo').map(({ contaId, nome, papel }) => ({ contaId, nome, papel }))
}
