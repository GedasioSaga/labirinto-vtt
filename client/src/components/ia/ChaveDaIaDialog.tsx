import { useEffect, useRef, useState } from 'react'
import { apagarChaves, CHAVE_MAX_CARACTERES, CHAVE_MIN_CARACTERES, CHAVES_MAX, chaveTemForma, ehModeloGemini, erroDaIa, guardarChaves, MODELO_PADRAO, MODELOS_GEMINI } from '../../lib/ia/portaDaIa'
import { useIaStore } from '../../stores/iaStore'
import { useToastStore } from '../../stores/toastStore'
import { IconeDoMundo } from '../livros/icones'

/**
 * A ENGRENAGEM do assistente (M4): provedor (só Gemini), modelo e até 3
 * chaves em campos de senha. "Guardar" manda as chaves ao cofre do Windows
 * pelo Rust e limpa os campos: a chave nunca volta à tela, que só diz
 * quantas há. Porte do `ia-config` do protótipo — uma seção dentro da
 * coluna, aberta e fechada pela engrenagem, não uma janela por cima.
 */

export const ID_DA_CONFIG = 'ia-config'

/** Onde o foco cai ao abrir: na primeira chave (engrenagem, "Pôr a chave") ou no modelo ("Trocar o modelo"). */
export type FocoDaConfig = 'chave' | 'modelo'

function frasesDasChaves(quantas: number): string {
  return `${quantas} ${quantas === 1 ? 'chave guardada' : 'chaves guardadas'} neste computador.`
}

export function ChaveDaIaDialog({ focoInicial = 'chave' }: { focoInicial?: FocoDaConfig }) {
  const chaves = useIaStore((state) => state.chaves)
  const modelo = useIaStore((state) => state.modelo)
  const [campos, setCampos] = useState<string[]>([''])
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [confirmandoApagar, setConfirmandoApagar] = useState(false)
  const primeiraRef = useRef<HTMLInputElement>(null)
  const modeloRef = useRef<HTMLSelectElement>(null)

  // Abriu: o foco vai para onde quem abriu pediu (a seção fecha e abre de novo a cada pedido).
  useEffect(() => {
    if (focoInicial === 'modelo') modeloRef.current?.focus()
    else primeiraRef.current?.focus()
  }, [focoInicial])

  const trocarCampo = (i: number, valor: string) => {
    setCampos((atuais) => atuais.map((atual, j) => (j === i ? valor : atual)))
    setErro(null)
  }

  const outraChave = () => {
    if (campos.length >= CHAVES_MAX) return
    setCampos((atuais) => [...atuais, ''])
  }

  // O campo novo de "Outra chave" recebe o foco assim que aparece.
  const quantosCampos = useRef(campos.length)
  useEffect(() => {
    if (campos.length > quantosCampos.current) document.getElementById(`ia-chave-${campos.length - 1}`)?.focus()
    quantosCampos.current = campos.length
  }, [campos.length])

  const guardar = async () => {
    const preenchidas = campos.map((campo) => campo.trim()).filter((campo) => campo.length > 0)
    if (preenchidas.length === 0) {
      setErro('Cole ao menos uma chave antes de guardar.')
      primeiraRef.current?.focus()
      return
    }
    const torta = campos.findIndex((campo) => campo.trim().length > 0 && !chaveTemForma(campo))
    if (torta >= 0) {
      setErro(`A chave ${torta + 1} não tem a forma de uma chave do Gemini (${CHAVE_MIN_CARACTERES} a ${CHAVE_MAX_CARACTERES} letras, números, - ou _).`)
      document.getElementById(`ia-chave-${torta}`)?.focus()
      return
    }
    setOcupado(true)
    try {
      const ficaram = await guardarChaves(preenchidas)
      useIaStore.getState().definirChaves(ficaram)
      // Guardada, a chave sai da tela e da memória do componente.
      setCampos([''])
      setErro(null)
      setConfirmandoApagar(false)
      useToastStore.getState().push('info', `Chave guardada no cofre do Windows. ${frasesDasChaves(ficaram)}`)
    } catch (falha) {
      setErro(erroDaIa(falha).message)
    } finally {
      setOcupado(false)
    }
  }

  const apagar = async () => {
    setOcupado(true)
    try {
      await apagarChaves()
      useIaStore.getState().definirChaves(0)
      setConfirmandoApagar(false)
      setErro(null)
      useToastStore.getState().push('info', 'Chaves apagadas deste computador.')
      primeiraRef.current?.focus()
    } catch (falha) {
      setErro(erroDaIa(falha).message)
    } finally {
      setOcupado(false)
    }
  }

  const trocarModelo = (valor: string) => {
    const escolhido = ehModeloGemini(valor) ? valor : MODELO_PADRAO
    useIaStore
      .getState()
      .trocarModelo(escolhido)
      .catch((falha: unknown) => useToastStore.getState().push('error', falha instanceof Error ? falha.message : String(falha)))
  }

  const guardadas = chaves ?? 0
  return (
    <section className="ia-config" id={ID_DA_CONFIG} aria-labelledby="ia-config-tit">
      <h3 className="ia-config__tit" id="ia-config-tit">
        Chave da IA
      </h3>
      <div className="ia-config__lin">
        <div className="mu-campo">
          <label htmlFor="ia-prov">Provedor</label>
          <select className="mu-seletor" id="ia-prov" disabled aria-describedby="ia-prov-dica">
            <option>Gemini</option>
          </select>
        </div>
        <div className="mu-campo">
          <label htmlFor="ia-modelo">Modelo</label>
          <select ref={modeloRef} className="mu-seletor" id="ia-modelo" value={modelo} onChange={(event) => trocarModelo(event.target.value)}>
            {MODELOS_GEMINI.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </div>
      </div>
      <span className="mu-campo__dica" id="ia-prov-dica">
        Só Gemini. A chave fica no cofre do Windows; o app nunca a mostra de volta.
      </span>
      {campos.map((valor, i) => (
        <div className="mu-campo" key={i}>
          <label htmlFor={`ia-chave-${i}`}>{campos.length > 1 ? `Chave ${i + 1}` : 'Chave'}</label>
          <input
            ref={i === 0 ? primeiraRef : undefined}
            className="mu-entrada"
            type="password"
            id={`ia-chave-${i}`}
            value={valor}
            onChange={(event) => trocarCampo(i, event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                void guardar()
              }
            }}
            autoComplete="off"
            spellCheck={false}
            maxLength={CHAVE_MAX_CARACTERES + 20}
            placeholder="Cole a chave do Google AI Studio"
            aria-invalid={erro !== null && valor.trim().length > 0 && !chaveTemForma(valor) ? true : undefined}
            aria-describedby={erro === null ? undefined : 'ia-chave-erro'}
          />
        </div>
      ))}
      <span className="mu-campo__dica">Mais de uma chave: quando a cota de uma acaba, o app passa para a próxima. Guardar troca as chaves que já estão lá.</span>
      {erro !== null && (
        <span className="mu-campo__erro" id="ia-chave-erro" role="alert">
          {erro}
        </span>
      )}
      <div className="mu-pg-acoes">
        <button type="button" className="mu-bt mu-bt--p" onClick={outraChave} disabled={campos.length >= CHAVES_MAX || ocupado}>
          <IconeDoMundo nome="mais" />
          Outra chave
        </button>
        <button type="button" className="mu-bt mu-bt--p mu-bt--primario" onClick={() => void guardar()} disabled={ocupado} aria-busy={ocupado || undefined}>
          Guardar
        </button>
      </div>
      <p className={guardadas > 0 ? 'ia-config__estado ia-config__estado--ok' : 'ia-config__estado'} aria-live="polite">
        {chaves === null ? 'Não deu para saber se há chave guardada.' : guardadas > 0 ? frasesDasChaves(guardadas) : 'Nenhuma chave guardada.'}
      </p>
      {guardadas > 0 &&
        (confirmandoApagar ? (
          <div className="ia-config__apagar" role="group" aria-label="Apagar as chaves">
            <span>Apagar {guardadas === 1 ? 'a chave' : `as ${guardadas} chaves`} deste computador?</span>
            <button type="button" className="mu-bt mu-bt--p mu-bt--perigo" onClick={() => void apagar()} disabled={ocupado}>
              Apagar
            </button>
            <button type="button" className="mu-bt mu-bt--p mu-bt--fantasma" onClick={() => setConfirmandoApagar(false)} disabled={ocupado}>
              Manter
            </button>
          </div>
        ) : (
          <div className="mu-pg-acoes">
            <button type="button" className="mu-bt mu-bt--p mu-bt--perigo" onClick={() => setConfirmandoApagar(true)} disabled={ocupado}>
              <IconeDoMundo nome="lixo" />
              Apagar chaves
            </button>
          </div>
        ))}
      <p className="mu-campo__dica">A chave continua no Windows mesmo se o app for desinstalado: "Apagar chaves" tira de lá.</p>
    </section>
  )
}
