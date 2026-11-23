import { nomeDaNovaOpcao, temExtrasDaEvolucao } from '../../../../lib/batalha/escolhaEEvolucao'
import { NOME_DO_TEXTO_DE_ANTES } from '../../../../lib/batalha/mecanica/textoGerado'
import type { CartaoDaFicha } from '../../../../lib/personagem'

type Extra = CartaoDaFicha['extras'][number]

/** Os extras que têm lugar próprio no editor (a Evolução) ou que o app escreve (o "Texto de antes"). */
function temLugarProprio(extra: Extra): boolean {
  return extra.nome === NOME_DO_TEXTO_DE_ANTES || temExtrasDaEvolucao({ extras: [extra] })
}

/**
 * LINHA CAMPOS EXTRAS (EDITOR.md §3.6; protótipo `htmlCampos`): as anotações do cartão, menos as da
 * Evolução (linha própria). O "Texto de antes" aparece só para ler: é o texto que o mestre escreveu
 * antes de montar, e o Desmontar o põe de volta.
 */
export function LinhaDosCampos({ cartao, onChange }: { cartao: CartaoDaFicha; onChange: (cartao: CartaoDaFicha) => void }) {
  const visiveis = cartao.extras.map((extra, indice) => ({ extra, indice })).filter(({ extra }) => !temLugarProprio(extra))
  const textoDeAntes = cartao.extras.find((extra) => extra.nome === NOME_DO_TEXTO_DE_ANTES)
  const trocar = (indice: number, mudanca: Partial<Extra>) => onChange({ ...cartao, extras: cartao.extras.map((extra, i) => (i === indice ? { ...extra, ...mudanca } : extra)) })
  const tirar = (indice: number) => onChange({ ...cartao, extras: cartao.extras.filter((_extra, i) => i !== indice) })
  const por = (nome: string) => onChange({ ...cartao, extras: [...cartao.extras, { nome, valor: '' }] })
  return (
    <>
      {visiveis.length === 0 ? (
        <p className="lb-ed__vazio">Nenhum campo extra.</p>
      ) : (
        <div className="lb-ed__extras">
          {visiveis.map(({ extra, indice }) => (
            <div key={indice} className="lb-ed__extra">
              <input className="lb-ed__entrada" value={extra.nome} placeholder="Campo" aria-label={`Nome do campo ${indice + 1}`} onChange={(evento) => trocar(indice, { nome: evento.target.value })} />
              <input className="lb-ed__entrada" value={extra.valor} placeholder="Valor" aria-label={`Valor do campo ${extra.nome || indice + 1}`} onChange={(evento) => trocar(indice, { valor: evento.target.value })} />
              <button type="button" className="lb-ed__bt lb-ed__bt--fantasma lb-ed__bt--p lb-ed__bt--ic" aria-label={`Tirar o campo ${extra.nome || indice + 1}`} onClick={() => tirar(indice)}>
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="lb-ed__linha-acoes">
        <button type="button" className="lb-ed__bt lb-ed__bt--p" onClick={() => por('')}>
          + Campo
        </button>
        <button type="button" className="lb-ed__bt lb-ed__bt--fantasma lb-ed__bt--p" onClick={() => por(nomeDaNovaOpcao(cartao))}>
          + Opção
        </button>
        <span className="lb-ed__dica">A Evolução tem lugar próprio, acima.</span>
      </div>
      {textoDeAntes !== undefined && (
        <details className="lb-ed__textos">
          <summary>{NOME_DO_TEXTO_DE_ANTES} (o que estava escrito antes de montar)</summary>
          <pre className="lb-ed__texto-antes">{textoDeAntes.valor}</pre>
        </details>
      )}
    </>
  )
}
