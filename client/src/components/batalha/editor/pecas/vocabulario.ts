import type { TipoQueBate } from '../../../../lib/batalha/mecanica/modelo'
import { ATRIBUTO_DA_VELOCIDADE, nomeDoAtributoDaPeca, type EfeitoDoGatilho, type IdDoElemento, type QuandoOGatilhoDispara } from '../../../../lib/batalha/mecanica/pecas'
import type { NomeDoGlifo } from './glifos'

/**
 * O VOCABULÁRIO DAS PEÇAS NA TELA (rework do editor de habilidades, E4; o "vocabulário do app" do
 * protótipo aprovado: `ATRIBUTOS`, `STATUS`, `CONDICOES`, `TIPOS_QUE_BATEM`, `ELEMENTOS`, `GATILHOS`,
 * `EFEITOS_DO_GATILHO`). Só a forma de mostrar e escolher: o que vale e os padrões moram em
 * `lib/batalha/mecanica/pecas.ts`.
 */

export interface OpcaoDaPeca<T extends string> {
  valor: T
  rotulo: string
}

const comNome = (id: string): OpcaoDaPeca<string> => ({ valor: id, rotulo: nomeDoAtributoDaPeca(id) })

/** Os 8 atributos da ficha (a fórmula do "Muda atributo", o teste da Marca, a soma do Devolve). */
export const ATRIBUTOS_DAS_PECAS: readonly OpcaoDaPeca<string>[] = ['forca', 'agilidade', 'percepcao', 'resistencia', 'intuicao', 'espirito', 'carisma', 'determinacao'].map(comNome)

/** O que dá para subir ou descer: os 8 atributos e os números da batalha (a Velocidade é a Agilidade da vez). */
export const STATUS_DAS_PECAS: readonly OpcaoDaPeca<string>[] = [...ATRIBUTOS_DAS_PECAS, ...[ATRIBUTO_DA_VELOCIDADE, 'ca', 'escudo', 'sp', 'vida', 'dano', 'alcance'].map(comNome)]

/** As condições que o protótipo oferece (o comportamento vem do nome, como no selo dos Efeitos). */
export const CONDICOES_DAS_PECAS: readonly { nome: string; faz: string }[] = [
  { nome: 'Atordoado', faz: 'perde a próxima ação' },
  { nome: 'Paralisado', faz: 'não anda' },
  { nome: 'Aéreo', faz: 'no ar' },
  { nome: 'Marcado', faz: 'o próximo golpe dá o dobro' },
  { nome: 'Cura reduzida', faz: 'cura pela metade' },
  { nome: 'Sangrando', faz: 'perde vida no começo da vez' },
  { nome: 'Queimando', faz: 'perde vida no começo da vez' },
  { nome: 'Envenenado', faz: 'perde vida por vez e a cura cai pela metade' },
  { nome: 'Congelado', faz: 'alcance cai 2 casas e reage com desvantagem' },
  { nome: 'Eletrizado', faz: 'perde 10 de SP no fim da vez' },
  { nome: 'Cego', faz: 'Percepção fica em 0' },
  { nome: 'Enfraquecido', faz: '−20 de Força e −10 de dano' },
  { nome: 'Lento', faz: 'perde Velocidade' },
  { nome: 'Fortalecido', faz: '+10 de dano' },
  { nome: 'Fadiga', faz: 'cansaço depois da transformação' },
  { nome: 'Protegido', faz: 'leva menos dano' },
]

export const BATIDAS_NA_TELA: readonly OpcaoDaPeca<TipoQueBate>[] = [
  { valor: 'impacto', rotulo: 'Impacto' },
  { valor: 'cortante', rotulo: 'Cortante' },
  { valor: 'perfurante', rotulo: 'Perfurante' },
]

/** O ícone e a cor de cada elemento do Imbuir; o próprio usa a estrela e o latão. */
export const ELEMENTOS_NA_TELA: Readonly<Record<IdDoElemento | 'proprio', { icone: NomeDoGlifo; cor: string }>> = {
  fogo: { icone: 'fogo', cor: '#ec7a68' },
  gelo: { icone: 'gelo', cor: '#9cc7e6' },
  eletricidade: { icone: 'raio', cor: '#f0d35c' },
  veneno: { icone: 'veneno', cor: '#a9bd72' },
  luz: { icone: 'luz', cor: '#f4e3a8' },
  trevas: { icone: 'trevas', cor: '#b8a0de' },
  vento: { icone: 'vento', cor: '#b9d8c8' },
  proprio: { icone: 'estrela', cor: 'var(--lb-peca-latao)' },
}

export const GATILHOS_NA_TELA: readonly OpcaoDaPeca<QuandoOGatilhoDispara>[] = [
  { valor: 'inicio', rotulo: 'No início da batalha' },
  { valor: 'comeco', rotulo: 'No começo de cada vez do dono' },
  { valor: 'rodada', rotulo: 'Na rodada' },
  { valor: 'vidaAbaixo', rotulo: 'Quando a vida do dono cair abaixo de' },
  { valor: 'aoReceber', rotulo: 'Ao receber dano' },
  { valor: 'aoAcertar', rotulo: 'Ao acertar um golpe' },
  { valor: 'aoCair', rotulo: 'Ao cair a 0 de vida' },
]

export const EFEITOS_DO_GATILHO_NA_TELA: readonly OpcaoDaPeca<EfeitoDoGatilho['tipo']>[] = [
  { valor: 'atributo', rotulo: 'Sobe atributo' },
  { valor: 'recuperar', rotulo: 'Recupera por turno' },
  { valor: 'escudo', rotulo: 'Ganha Escudo' },
  { valor: 'condSi', rotulo: 'Condição em si' },
  { valor: 'condAlvo', rotulo: 'Condição no alvo' },
  { valor: 'aviso', rotulo: 'Aviso ao mestre' },
]

/** O efeito novo do "+ efeito" do gatilho (o `efeitoDoGatilhoNovo` do protótipo). */
export function efeitoDoGatilhoNovo(tipo: EfeitoDoGatilho['tipo']): EfeitoDoGatilho {
  switch (tipo) {
    case 'atributo':
      return { tipo, atributo: 'forca', valor: 10, turnos: 2 }
    case 'recuperar':
      return { tipo, recurso: 'hp', valor: 10, turnos: 3 }
    case 'escudo':
      return { tipo, valor: 30 }
    case 'condSi':
      return { tipo, condicao: { nome: 'Fortalecido', turnos: 2 } }
    case 'condAlvo':
      return { tipo, condicao: { nome: 'Atordoado', turnos: 1 } }
    case 'aviso':
      return { tipo, texto: 'Avise a mesa: a passiva disparou.' }
  }
}

/** "turno" ou "turnos". */
export function turnos(n: number): string {
  return Math.abs(n) === 1 ? 'turno' : 'turnos'
}

/** "vez" ou "vezes". */
export function vezes(n: number): string {
  return Math.abs(n) === 1 ? 'vez' : 'vezes'
}

/** Um nome que ainda não está na lista ("Resposta 3", "Próprio 2"), sem olhar maiúscula. */
export function nomeLivre(base: string, usados: readonly string[], comecaEm = 1): string {
  const ocupados = new Set(usados.map((nome) => nome.trim().toLocaleLowerCase('pt-BR')))
  for (let n = comecaEm; ; n += 1) {
    const nome = `${base} ${n}`
    if (!ocupados.has(nome.toLocaleLowerCase('pt-BR'))) return nome
  }
}

/** A lista com o item `indice` trocado. */
export function trocado<T>(lista: readonly T[], indice: number, novo: T): T[] {
  return lista.map((item, atual) => (atual === indice ? novo : item))
}

/** A lista sem o item `indice`. */
export function semOItem<T>(lista: readonly T[], indice: number): T[] {
  return lista.filter((_item, atual) => atual !== indice)
}
