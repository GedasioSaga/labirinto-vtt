/**
 * DADOS DO DRAGON BALL TALES — os catálogos gerados por scripts/dbt/gerar-dados.cjs
 * batem com o contrato (lib/dbt/modelo.ts) e com as contagens do livro.
 */
import { describe, expect, it } from 'vitest'
import { CAPITULO_TEXTO_MAX, LIVRO_CAPITULOS_MAX } from '../../sistemaDeRpg'
import { ATRIBUTO_DA_PERICIA, COLECOES_DE_NPC_PRONTO, IDS_DAS_PERICIAS, RANKS } from '../modelo'
import { LIVRO_DRAGON_BALL } from '../livro/livroDragonBall'
import { CONDICOES } from './condicoes'
import { ESTAGIOS_DE_DANO } from './estagiosDeDano'
import { MOVIMENTOS_MARCIAIS } from './movimentosMarciais'
import { INDICE_DOS_NPCS_PRONTOS, carregarNpcsProntos } from './npcsProntos'
import { PERICIAS } from './pericias'
import { RACAS } from './racas'
import { RANKS_DE_TECNICA } from './ranks'
import { ROTULOS } from './rotulos'
import { TALENTOS } from './talentos'
import { VIDA_POR_GOLPE } from './tabelas'

const semRepetidos = (ids: string[]) => new Set(ids).size === ids.length
const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/

describe('catálogos do livro', () => {
  it('as 13 perícias, na ordem e com o atributo do contrato', () => {
    expect(PERICIAS.map((p) => p.id)).toEqual([...IDS_DAS_PERICIAS])
    for (const p of PERICIAS) expect(p.atributo).toBe(ATRIBUTO_DA_PERICIA[p.id])
  })

  it('contagens do livro: 134 rótulos, 49 talentos, 64 movimentos, 20 condições, 6 ranks', () => {
    expect(ROTULOS).toHaveLength(134)
    expect(TALENTOS).toHaveLength(49)
    expect(MOVIMENTOS_MARCIAIS).toHaveLength(64)
    expect(CONDICOES).toHaveLength(20)
    expect(RANKS_DE_TECNICA.map((r) => r.rank)).toEqual([...RANKS])
    expect(ESTAGIOS_DE_DANO.map((e) => e.id)).toEqual(['erro', 'minimo', 'medio', 'completo'])
  })

  it('ids estáveis: únicos e em kebab-case', () => {
    for (const lista of [ROTULOS, RACAS, CONDICOES]) {
      expect(semRepetidos(lista.map((x) => x.id))).toBe(true)
      for (const x of lista) expect(x.id).toMatch(KEBAB)
    }
  })

  it('raças: 7 do básico e as de suplemento, cada uma com arquivo; raça base existe', () => {
    expect(RACAS.filter((r) => r.fonte === 'basico')).toHaveLength(7)
    expect(RACAS.filter((r) => r.fonte === 'suplemento').length).toBeGreaterThanOrEqual(28)
    const ids = new Set(RACAS.map((r) => r.id))
    for (const r of RACAS) {
      expect(r.arquivo.length).toBeGreaterThan(0)
      if (r.racaBase !== undefined) expect(ids.has(r.racaBase)).toBe(true)
    }
    // O exemplo do livro: Saiyajin soma 12 de PV a cada 10.000 PDL (CON 12 + raça 12 = 72 PV).
    expect(RACAS.find((r) => r.id === 'saiyajin')?.vidaPor10k).toBe(12)
  })

  it('vida por golpe do Livro do Narrador: ND 3, Rank E, Comum = 36 PV', () => {
    expect(3 * VIDA_POR_GOLPE.comum.E).toBe(36)
  })
})

describe('NPCs prontos', () => {
  it('o índice tem os 41 e o carregador devolve as mesmas fichas', async () => {
    expect(INDICE_DOS_NPCS_PRONTOS).toHaveLength(41)
    const npcs = await carregarNpcsProntos()
    expect(npcs.map((n) => n.id)).toEqual(INDICE_DOS_NPCS_PRONTOS.map((n) => n.id))
    expect(semRepetidos(npcs.map((n) => n.id))).toBe(true)
    for (const n of npcs) expect(COLECOES_DE_NPC_PRONTO).toContain(n.colecao)
  })
})

describe('livro', () => {
  it('cabe nos tetos do leitor e abre com o aviso legal', () => {
    expect(LIVRO_DRAGON_BALL.length).toBeLessThanOrEqual(LIVRO_CAPITULOS_MAX)
    expect(semRepetidos(LIVRO_DRAGON_BALL.map((c) => c.id))).toBe(true)
    for (const c of LIVRO_DRAGON_BALL) {
      expect(c.id.startsWith('dbt-')).toBe(true)
      expect(c.texto.length).toBeLessThanOrEqual(CAPITULO_TEXTO_MAX)
    }
    expect(LIVRO_DRAGON_BALL[0].texto).toContain('CC BY-NC-SA 2.5 BR')
  })

  it('sem metadado de transcrição', () => {
    for (const c of LIVRO_DRAGON_BALL) {
      expect(c.texto).not.toMatch(/<!--|^>?\s*Fonte:|Nota de transcrição|\[lore resumido\]|[✓➢➔]/m)
    }
  })
})
