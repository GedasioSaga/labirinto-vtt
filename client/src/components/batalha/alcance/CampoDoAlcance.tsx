import { CASAS_MAX } from '../../../lib/batalha/mecanica/modelo'
import type { CorDoAlcance } from '../../../lib/batalha/alcance/cor'
import { descreverAlcance, type FormaDoAlcance } from '../../../lib/batalha/alcance/forma'
import { CampoInteiro, Marcar } from '../blocos/controles'
import { EscolhaDaForma } from './EscolhaDaForma'
import { ANEL_MINIMO, FORMAS_DO_CAMPO, FORMA_DO_CAMPO_DE_PARTIDA, casasNoTeto, formaComOutroDesenho, formaDoCampoDe } from './formaNaTela'

/**
 * O CAMPO `alcance` (fase F, ALCANCE.md §3.2 item 3 e §8): o cartão só de texto da ficha e a
 * entrada do catálogo sem mecânica montada. O mesmo seletor de forma da mecânica, gravando a
 * forma inteira no campo. Sem marcar = sem alcance (nada acende, a mesa não confere).
 */

function NumerosDoCampo({ forma, onChange }: { forma: FormaDoAlcance; onChange: (forma: FormaDoAlcance) => void }) {
  switch (forma.tipo) {
    case 'si':
      return null
    case 'frente':
      return <CampoInteiro rotulo="Lado" valor={forma.lado} minimo={1} maximo={CASAS_MAX} depois={`casas (${forma.lado} x ${forma.lado})`} onChange={(lado) => onChange({ ...forma, lado })} />
    case 'alvo':
      if (forma.de !== undefined) {
        const de = forma.de
        return (
          <>
            <CampoInteiro rotulo="De" valor={de} minimo={ANEL_MINIMO} maximo={forma.ate} depois="casas" onChange={(novo) => onChange({ ...forma, de: novo })} />
            <CampoInteiro rotulo="Até" valor={forma.ate} minimo={Math.max(ANEL_MINIMO, de)} maximo={CASAS_MAX} depois="casas (nunca colado)" onChange={(ate) => onChange({ ...forma, ate })} />
          </>
        )
      }
      return <CampoInteiro rotulo="Até" valor={forma.ate} minimo={1} maximo={CASAS_MAX} depois="casas de quem usa" onChange={(ate) => onChange({ ...forma, ate })} />
    case 'ponto':
    case 'ficha': {
      const raio = forma.raio ?? Math.max(1, Math.floor(((forma.lado ?? 3) - 1) / 2))
      return (
        <>
          <CampoInteiro rotulo="O centro a até" valor={forma.ate} minimo={1} maximo={CASAS_MAX} depois="casas" onChange={(ate) => onChange({ ...forma, ate })} />
          <CampoInteiro rotulo="Explode" valor={raio} minimo={1} maximo={CASAS_MAX} depois={`${raio === 1 ? 'casa' : 'casas'} em volta`} onChange={(novo) => onChange({ tipo: forma.tipo, ate: forma.ate, raio: casasNoTeto(novo) })} />
        </>
      )
    }
    default:
      return <CampoInteiro rotulo="Distância" valor={forma.ate} minimo={1} maximo={CASAS_MAX} depois="casas" onChange={(ate) => onChange({ ...forma, ate })} />
  }
}

interface CampoDoAlcanceProps {
  /** A forma lida do campo; `null` = sem alcance (ou torto). */
  valor: FormaDoAlcance | null
  /** O campo existe mas não se lê (app mais novo): fica guardado como está até a pessoa mudar. */
  torto?: boolean
  cor: CorDoAlcance
  onChange: (forma: FormaDoAlcance | null) => void
  soLeitura?: boolean
}

export function CampoDoAlcance({ valor, torto = false, cor, onChange, soLeitura = false }: CampoDoAlcanceProps) {
  if (soLeitura) {
    return <p className="lb-field__hint lb-alc__frase">{valor === null ? 'Sem alcance definido.' : `Alcance: ${descreverAlcance(valor)}.`}</p>
  }
  return (
    <div className="lb-alc">
      <Marcar rotulo="Tem alcance (as casas que acendem na batalha)" marcado={valor !== null} onChange={(sim) => onChange(sim ? FORMA_DO_CAMPO_DE_PARTIDA : null)} />
      {valor === null ? (
        <p className="lb-field__hint">{torto ? 'O alcance guardado veio de um app mais novo: fica como está até você marcar outro.' : 'Sem alcance: na mesa nada acende e a distância não é conferida.'}</p>
      ) : (
        <>
          <EscolhaDaForma legenda="Forma do alcance" opcoes={FORMAS_DO_CAMPO} valor={formaDoCampoDe(valor)} cor={cor} onChange={(tipo) => onChange(formaComOutroDesenho(valor, tipo))} />
          <div className="lb-mec__linha lb-mec__linha--recuo">
            <NumerosDoCampo forma={valor} onChange={onChange} />
          </div>
          <p className="lb-field__hint lb-alc__frase">{descreverAlcance(valor)}.</p>
        </>
      )}
    </div>
  )
}
