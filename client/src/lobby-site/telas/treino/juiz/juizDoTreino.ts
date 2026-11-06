import { fichaDoBoneco, NOME_DO_BONECO } from '../../../../lib/arena/boneco'
import { BONECO_PADRAO } from '../../../../lib/arena/tipos'
import { temMaximo } from '../../../../lib/ajusteDaFicha'
import type { Personagem } from '../../../../lib/personagem'
import type { SistemaDeRpg } from '../../../../lib/sistemaDeRpg'
import { recursoDeVida } from '../../../../lib/vidaDaFicha'
import { comTecnicasDeTreino, lerTecnicasDeTreino, type TecnicaDeTreino } from './tecnicaDeTreino'

/**
 * O JUDGE NO TREINO SOLO (fatia J, pedido de 06/11/2026: "o boneco de teste
 * vai ser o juiz e eles vão poder dar técnicas e modificar os status deles").
 * O adversário padrão do treino é o boneco da Arena de testes do app
 * (`lib/arena/boneco.ts`: a ficha NPC "Judge", sem técnica, Agilidade 0, o HP e
 * o Escudo do `BONECO_PADRAO`), com o desenho do Judge da Arena como retrato.
 * Aqui a pessoa muda o HP, o SP, o Escudo e cada atributo dele e lhe dá
 * técnicas (`tecnicaDeTreino.ts`). A vida infinita da Arena fica de fora: no
 * treino a luta precisa acabar para ter vencedor.
 *
 * Os ajustes moram SÓ neste navegador, por mesa: nunca vão ao servidor, e o
 * "Voltar ao padrão" apaga. O robô que joga pelo Judge é o mesmo do treino.
 */

const VERSAO = 1
const PREFIXO = 'labirinto.lobby.juizDoTreino'
/** O id da ficha do Judge no treino (a cópia que luta ganha o id da vaga, como toda ficha). */
export const ID_DO_JUIZ = 'treino_juiz'
export const NOME_DO_JUIZ = NOME_DO_BONECO
/** O desenho do Judge da Arena (o 1º quadro da folha `assets/judge/judge-folha.webp`, de frente), em `public-lobby/`. */
export const RETRATO_DO_JUIZ = '/judge-retrato.webp'
/** O maior número de um campo do Judge (o mesmo teto do rascunho de treino). */
export const NUMERO_DO_JUIZ_MAX = 99_999
/** O SP com que o Judge nasce: o bastante para usar as técnicas que ganhar. */
const SP_PADRAO = 100

export interface AjustesDoJuiz {
  versao: typeof VERSAO
  /** HP máximo (e o atual: a luta começa com ele cheio). */
  hp: number
  sp: number
  escudo: number
  /** Só os que mudaram do padrão (0): atributo → valor. */
  atributos: Record<string, number>
  tecnicas: TecnicaDeTreino[]
  salvoEm: number
}

export function ajustesPadraoDoJuiz(): AjustesDoJuiz {
  return { versao: VERSAO, hp: BONECO_PADRAO.hp, sp: SP_PADRAO, escudo: BONECO_PADRAO.escudo, atributos: {}, tecnicas: [], salvoEm: 0 }
}

/** O Judge saiu do padrão? */
export function juizMudou(ajustes: AjustesDoJuiz): boolean {
  const padrao = ajustesPadraoDoJuiz()
  return ajustes.hp !== padrao.hp || ajustes.sp !== padrao.sp || ajustes.escudo !== padrao.escudo || Object.keys(ajustes.atributos).length > 0 || ajustes.tecnicas.length > 0
}

function chave(campanhaId: string, demo: boolean): string {
  return `${PREFIXO}.${demo ? 'demo.' : ''}${campanhaId}`
}

function numero(valor: unknown, min: number): number | null {
  return typeof valor === 'number' && Number.isSafeInteger(valor) && valor >= min && valor <= NUMERO_DO_JUIZ_MAX ? valor : null
}

function lerAtributos(valor: unknown, sistema: SistemaDeRpg): Record<string, number> | null {
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) return null
  const conhecidos = new Set(sistema.atributos.map((atributo) => atributo.id))
  const lidos: Record<string, number> = {}
  for (const [id, bruto] of Object.entries(valor)) {
    const lido = numero(bruto, 0)
    if (lido === null) return null
    // Atributo que o sistema não tem mais só deixa de valer (o livro pode ter mudado).
    if (conhecidos.has(id)) lidos[id] = lido
  }
  return lidos
}

function lerDoTexto(texto: string, sistema: SistemaDeRpg): AjustesDoJuiz | null {
  let bruto: unknown
  try {
    bruto = JSON.parse(texto)
  } catch {
    return null
  }
  if (typeof bruto !== 'object' || bruto === null) return null
  const registro = bruto as Record<string, unknown>
  const hp = numero(registro.hp, 1)
  const sp = numero(registro.sp, 0)
  const escudo = numero(registro.escudo, 0)
  const atributos = lerAtributos(registro.atributos, sistema)
  const tecnicas = lerTecnicasDeTreino(registro.tecnicas)
  if (registro.versao !== VERSAO || hp === null || sp === null || escudo === null || atributos === null || tecnicas === null || typeof registro.salvoEm !== 'number') return null
  return { versao: VERSAO, hp, sp, escudo, atributos, tecnicas, salvoEm: registro.salvoEm }
}

/** Os ajustes guardados; nenhum, tortos ou sem armazenamento = o padrão. */
export function lerAjustesDoJuiz(campanhaId: string, demo: boolean, sistema: SistemaDeRpg): AjustesDoJuiz {
  try {
    const texto = window.localStorage.getItem(chave(campanhaId, demo))
    return (texto === null ? null : lerDoTexto(texto, sistema)) ?? ajustesPadraoDoJuiz()
  } catch {
    return ajustesPadraoDoJuiz()
  }
}

/** Guarda; `false` = o navegador não deixou (modo privado, cheio ou bloqueado). */
export function guardarAjustesDoJuiz(campanhaId: string, demo: boolean, ajustes: AjustesDoJuiz): boolean {
  try {
    window.localStorage.setItem(chave(campanhaId, demo), JSON.stringify(ajustes))
    return true
  } catch {
    return false
  }
}

export function apagarAjustesDoJuiz(campanhaId: string, demo: boolean): void {
  try {
    window.localStorage.removeItem(chave(campanhaId, demo))
  } catch {
    // Sem armazenamento: não havia o que apagar.
  }
}

/** O recurso no valor, com o máximo igual quando o recurso tem máximo (como o boneco da Arena grava). */
function comRecurso(ficha: Personagem, sistema: SistemaDeRpg, recursoId: string, valor: number): Personagem {
  const maximos = temMaximo(sistema, recursoId) ? { ...ficha.maximos, [recursoId]: valor } : ficha.maximos
  return { ...ficha, recursos: { ...ficha.recursos, [recursoId]: valor }, maximos }
}

/** O recurso de energia com atual e máximo (no One Piece, o SP): o que não é vida nem Escudo. */
export function recursoDaEnergia(sistema: SistemaDeRpg): SistemaDeRpg['recursos'][number] | null {
  const vida = recursoDeVida(sistema)
  return sistema.recursos.find((recurso) => recurso.atualEMaximo === true && recurso.id !== vida?.id) ?? null
}

/**
 * A ficha do Judge com os ajustes: a do boneco da Arena (`fichaDoBoneco`,
 * sem vida infinita), o SP, os atributos, as técnicas de treino e o retrato
 * do Judge. Sempre uma ficha nova: nada aqui é a ficha de alguém.
 */
export function fichaDoJuiz(sistema: SistemaDeRpg, ajustes: AjustesDoJuiz): Personagem {
  let ficha = fichaDoBoneco(sistema, { ...BONECO_PADRAO, infinito: false, hp: ajustes.hp, escudo: ajustes.escudo }, ID_DO_JUIZ)
  const energia = recursoDaEnergia(sistema)
  if (energia !== null) ficha = comRecurso(ficha, sistema, energia.id, ajustes.sp)
  ficha ={ ...ficha, retrato: RETRATO_DO_JUIZ, descricao: 'O boneco de teste da Arena.', atributos: { ...ficha.atributos, ...ajustes.atributos } }
  return comTecnicasDeTreino(ficha, ajustes.tecnicas)
}
