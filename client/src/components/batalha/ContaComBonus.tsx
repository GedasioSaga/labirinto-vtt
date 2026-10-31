import { ALVO_DA_REACAO, type BonusDaBatalha, type ParteDoBonus } from '../../lib/batalha/combate'
import { textoDoBonus } from '../../lib/batalha/formula'

/**
 * A CONTA DO DANO COM O BÔNUS DOS SELOS DESTACADO (tipos de habilidade F2): a
 * fórmula já escreve "160 Força +20 (Fúria) + 5 Balmung = 185"; aqui cada
 * "+20 (Fúria)" ganha a cor do selo (soma verde, perda roxa), de leve. O
 * texto não muda: quem lê a conta lê o mesmo, só que vê de onde veio.
 */

interface TrechoDoBonus {
  texto: string
  sinal: 'mais' | 'menos'
}

/** "+20 (Fúria)", "-15 (Lento)": os pedaços que a conta escreve, sem repetir. A Reação não entra na conta do dano. */
function trechosDoBonus(bonus: BonusDaBatalha | undefined): TrechoDoBonus[] {
  if (bonus === undefined) return []
  const trechos = new Map<string, TrechoDoBonus>()
  for (const [alvo, partes] of Object.entries(bonus)) {
    if (alvo === ALVO_DA_REACAO) continue
    for (const parte of partes) {
      const texto = textoDoBonus([parte]).trim()
      if (texto !== '' && !trechos.has(texto)) trechos.set(texto, { texto, sinal: parte.delta < 0 ? 'menos' : 'mais' })
    }
  }
  return [...trechos.values()]
}

type Pedaco = { texto: string; trecho: TrechoDoBonus | null }

/** A conta em pedaços: o texto comum e cada trecho do bônus, na ordem em que aparecem. */
function partirConta(conta: string, trechos: readonly TrechoDoBonus[]): Pedaco[] {
  const pedacos: Pedaco[] = []
  let desde = 0
  for (;;) {
    let achado: { indice: number; trecho: TrechoDoBonus } | null = null
    for (const trecho of trechos) {
      const indice = conta.indexOf(trecho.texto, desde)
      if (indice !== -1 && (achado === null || indice < achado.indice)) achado = { indice, trecho }
    }
    if (achado === null) break
    if (achado.indice > desde) pedacos.push({ texto: conta.slice(desde, achado.indice), trecho: null })
    pedacos.push({ texto: achado.trecho.texto, trecho: achado.trecho })
    desde = achado.indice + achado.trecho.texto.length
  }
  if (desde < conta.length) pedacos.push({ texto: conta.slice(desde), trecho: null })
  return pedacos
}

export function ContaComBonus({ conta, bonus }: { conta: string; bonus: BonusDaBatalha | undefined }) {
  const trechos = trechosDoBonus(bonus)
  if (trechos.length === 0) return <>{conta}</>
  return (
    <>
      {partirConta(conta, trechos).map((pedaco, i) =>
        pedaco.trecho === null ? (
          pedaco.texto
        ) : (
          <span key={i} className="bt-bonus" data-sinal={pedaco.trecho.sinal}>
            {pedaco.texto}
          </span>
        ),
      )}
    </>
  )
}

/** "+3 (Foco)", "+3 (Foco) -2 (Lento)": de onde vem o modificador inicial da reação; nenhum = vazio. */
export function origemDoBonus(partes: readonly ParteDoBonus[]): string {
  return textoDoBonus(partes).trim()
}
