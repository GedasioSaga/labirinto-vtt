import { useEffect, useRef } from 'react'
import { DANO_MAX, MODS_POR_SELO_MAX, type ModDoSelo } from '../../lib/batalha/combate'
import type { AlvoDeMod } from '../../lib/batalha/selos'

/**
 * AS LINHAS "ATRIBUTO / DELTA" DE UM SELO (tipos de habilidade F2, seção 4c
 * do plano): o que o selo soma enquanto existe ("FOR +20", "Reação +3"). Na
 * mira de Buff/Debuff (a sugestão lida do Efeito, sempre editável) e no "Pôr
 * selo..." do mestre. Até `MODS_POR_SELO_MAX` linhas; linha vazia ou 0 não
 * entra (a lógica também a descarta); o mesmo atributo duas vezes é recusado
 * (a conta mostraria "FOR +20, FOR +10").
 */

/** Uma linha como a tela a guarda: o delta é o texto digitado ("+20", "-15"). */
export interface LinhaDeMod {
  chave: string
  alvo: string
  delta: string
}

let proximaChave = 0
function novaChave(): string {
  proximaChave += 1
  return `mod-${proximaChave}`
}

/** "+20", "-15": como a pílula escreve (`textoDoMod`). */
function comSinal(numero: number): string {
  return numero < 0 ? String(numero) : `+${numero}`
}

/** Os mods de um selo (o sugerido, o que já existe) em linhas editáveis. */
export function linhasDosMods(mods: readonly ModDoSelo[] | undefined): LinhaDeMod[] {
  return (mods ?? []).slice(0, MODS_POR_SELO_MAX).map((mod) => ({ chave: novaChave(), alvo: mod.alvo, delta: comSinal(mod.delta) }))
}

/** "+20", "-15", "20", "−15" (o menos tipográfico também); vazio = 0; torto ou acima do teto = `null`. */
export function lerDelta(texto: string): number | null {
  const limpo = texto.replace(/\s+/g, '').replace('−', '-')
  if (limpo === '' || limpo === '+' || limpo === '-') return 0
  const achado = /^([+-]?)(\d{1,7})$/.exec(limpo)
  if (achado === null) return null
  const valor = Number(achado[2])
  if (!Number.isFinite(valor) || valor > DANO_MAX) return null
  return achado[1] === '-' ? -valor : valor
}

function rotuloDe(alvos: readonly AlvoDeMod[], id: string): AlvoDeMod {
  return alvos.find((alvo) => alvo.id === id) ?? { id, rotulo: id, curto: id }
}

/** "FOR +20, Dano +30": o resumo das linhas que valem (as tortas e as de 0 ficam de fora). */
export function resumoDasLinhas(linhas: readonly LinhaDeMod[], alvos: readonly AlvoDeMod[]): string {
  return linhas
    .map((linha) => ({ linha, delta: lerDelta(linha.delta) }))
    .filter((item): item is { linha: LinhaDeMod; delta: number } => item.delta !== null && item.delta !== 0)
    .map(({ linha, delta }) => `${rotuloDe(alvos, linha.alvo).curto} ${comSinal(delta)}`)
    .join(', ')
}

/** As linhas que vão no pedido (`selo.mods`), ou o porquê de não irem. Delta 0 sai calado. */
export function modsDasLinhas(linhas: readonly LinhaDeMod[], alvos: readonly AlvoDeMod[]): { mods: ModDoSelo[] } | { erro: string } {
  const mods: ModDoSelo[] = []
  for (const [i, linha] of linhas.entries()) {
    const delta = lerDelta(linha.delta)
    if (delta === null) return { erro: `Linha ${i + 1} do selo: escreva um número inteiro, como +20 ou -15.` }
    if (delta === 0) continue
    if (mods.some((mod) => mod.alvo === linha.alvo)) return { erro: `${rotuloDe(alvos, linha.alvo).rotulo} está em duas linhas do selo: deixe uma só.` }
    mods.push({ alvo: linha.alvo, delta })
  }
  return { mods }
}

export interface LinhasDeModsProps {
  linhas: readonly LinhaDeMod[]
  alvos: readonly AlvoDeMod[]
  onMudar: (linhas: LinhaDeMod[]) => void
  /** Para os ids e rótulos ("selo da mira", "selo em Ilo"). */
  idBase: string
  /** O que a legenda diz ao lado de "Modificadores". */
  dica?: string
}

export function LinhasDeMods({ linhas, alvos, onMudar, idBase, dica = 'somam enquanto o selo existir' }: LinhasDeModsProps) {
  const campos = useRef(new Map<string, HTMLSelectElement>())
  const botaoDePor = useRef<HTMLButtonElement>(null)
  const focar = useRef<string | null>(null)
  const cheio = linhas.length >= MODS_POR_SELO_MAX

  // A linha nova recebe o foco no atributo; tirar devolve o foco ao "+ Linha" (o Tab segue a leitura).
  useEffect(() => {
    const chave = focar.current
    if (chave === null) return
    focar.current = null
    if (chave === '') botaoDePor.current?.focus()
    else campos.current.get(chave)?.focus()
  }, [linhas])

  const por = () => {
    if (cheio) return
    const usados = new Set(linhas.map((linha) => linha.alvo))
    const livre = alvos.find((alvo) => !usados.has(alvo.id)) ?? alvos[0]
    if (livre === undefined) return
    const nova: LinhaDeMod = { chave: novaChave(), alvo: livre.id, delta: '' }
    focar.current = nova.chave
    onMudar([...linhas, nova])
  }
  const mudar = (chave: string, parte: Partial<Omit<LinhaDeMod, 'chave'>>) => onMudar(linhas.map((linha) => (linha.chave === chave ? { ...linha, ...parte } : linha)))
  const tirar = (chave: string) => {
    focar.current = ''
    onMudar(linhas.filter((linha) => linha.chave !== chave))
  }

  return (
    <fieldset className="bt-mods">
      <legend className="bt-mods__legenda">
        Modificadores <small>{dica}</small>
      </legend>
      {linhas.length === 0 ? (
        <p className="bt-mods__vazio">Nenhum: o selo só marca.</p>
      ) : (
        <ul className="bt-mods__lista">
          {linhas.map((linha, i) => {
            const delta = lerDelta(linha.delta)
            const alvo = rotuloDe(alvos, linha.alvo)
            const foraDaLista = !alvos.some((candidato) => candidato.id === linha.alvo)
            const repetido = linhas.some((outra, j) => j < i && outra.alvo === linha.alvo)
            const nome = `${alvo.curto} ${linha.delta.trim() || '0'}`
            return (
              <li key={linha.chave} className="bt-mods__linha" data-sinal={delta === null || delta === 0 ? undefined : delta > 0 ? 'mais' : 'menos'}>
                <select
                  ref={(elemento) => {
                    if (elemento === null) campos.current.delete(linha.chave)
                    else campos.current.set(linha.chave, elemento)
                  }}
                  id={`${idBase}-mod-${linha.chave}`}
                  aria-label={`Linha ${i + 1}: atributo`}
                  aria-invalid={repetido ? true : undefined}
                  value={linha.alvo}
                  onChange={(evento) => mudar(linha.chave, { alvo: evento.target.value })}
                >
                  {foraDaLista && <option value={linha.alvo}>{linha.alvo} (fora do sistema)</option>}
                  {alvos.map((opcao) => (
                    <option key={opcao.id} value={opcao.id}>
                      {opcao.curto !== opcao.rotulo ? `${opcao.rotulo} (${opcao.curto})` : opcao.rotulo}
                    </option>
                  ))}
                </select>
                <input
                  className="bt-num bt-mods__delta"
                  aria-label={`Linha ${i + 1}: quanto soma (${alvo.rotulo}); com menos, tira`}
                  inputMode="text"
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={9}
                  placeholder="+10"
                  value={linha.delta}
                  aria-invalid={delta === null ? true : undefined}
                  onFocus={(evento) => evento.target.select()}
                  onChange={(evento) => mudar(linha.chave, { delta: evento.target.value })}
                />
                <button type="button" className="bt-mods__tirar" aria-label={`Tirar a linha ${nome}`} title="Tirar esta linha" onClick={() => tirar(linha.chave)}>
                  <span aria-hidden="true">×</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
      <div className="bt-mods__pe">
        <button ref={botaoDePor} type="button" className="bt-botao bt-botao--p bt-mods__por" disabled={cheio || alvos.length === 0} onClick={por}>
          + Linha
        </button>
        <small className="bt-mods__nota">{cheio ? `Até ${MODS_POR_SELO_MAX} linhas por selo.` : 'Com menos, tira (-15). Linha vazia ou 0 não entra.'}</small>
      </div>
    </fieldset>
  )
}
