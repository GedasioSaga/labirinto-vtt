import { useMemo, useState, type FormEvent } from 'react'
import type { EdicoesDoMestre, Faixa, NucleoDBT, OpcaoDaPendencia, Pendencia } from '../../../lib/dbt/batalha/tipos'
import { Interruptor } from '../ficha/pecas'
import { nomeDoCombatente, previaDoAtaque, tituloDaPendencia, type Fichas } from './dadosDaBatalhaDBT'
import { FaixaDoGolpe, NumeroDoGolpe, PartesDaConta } from './pecasDaBatalhaDBT'

/**
 * O CARTÃO DO MODO MANUAL (seção 15, `ConfirmacaoDBT`): o cálculo pronto,
 * cada número editável, a prévia refeita pelo próprio motor (`editarAtaque`
 * num trabalho que não rola dado). Só vai ao motor o que o mestre mudou.
 * Enter confirma; "Cancelar ação" só enquanto nada foi pago.
 */

type PendenciaDeConfirmar = Extract<Pendencia, { tipo: 'confirmar' }>

export interface ConfirmacaoDBTProps {
  pendencia: PendenciaDeConfirmar
  nucleo: NucleoDBT
  fichas: Fichas
  opcoes: readonly OpcaoDaPendencia[]
  onConfirmar: (edicoes: EdicoesDoMestre) => void
  onCancelar: () => void
  ocupado?: boolean
}

/** Campo vazio = sem edição; texto que não é número também. */
function numeroDoCampo(texto: string): number | null {
  if (texto.trim() === '') return null
  const valor = Number(texto)
  return Number.isFinite(valor) ? Math.trunc(valor) : null
}

function CampoDeNumero({ rotulo, valor, onTrocar, placeholder, min, max }: { rotulo: string; valor: string; onTrocar: (texto: string) => void; placeholder: string; min?: number; max?: number }) {
  return (
    <label className="dbb-campo">
      {rotulo}
      <input className="dbf-inp" type="number" inputMode="numeric" min={min} max={max} value={valor} placeholder={placeholder} onChange={(evento) => onTrocar(evento.target.value)} />
    </label>
  )
}

export function ConfirmacaoDBT({ pendencia, nucleo, fichas, opcoes, onConfirmar, onCancelar, ocupado = false }: ConfirmacaoDBTProps) {
  const ataque = pendencia.ataque
  const resolucao = pendencia.etapa === 'resolucao'
  const [d20, setD20] = useState('')
  const [ca, setCa] = useState('')
  const [faixa, setFaixa] = useState<Faixa | null>(null)
  const [critico, setCritico] = useState<boolean | null>(null)
  const [dano, setDano] = useState('')
  const [mitigacao, setMitigacao] = useState('')
  const [gastarKi, setGastarKi] = useState(true)
  const [abrirReacoes, setAbrirReacoes] = useState(ataque === undefined ? true : !ataque.semJanela)
  const [aplicarDano, setAplicarDano] = useState(true)
  const [efeitos, setEfeitos] = useState<readonly boolean[]>(() => ataque?.efeitos.map((efeito) => efeito.aplicar) ?? [])

  const edicoes = useMemo<EdicoesDoMestre>(() => {
    const saida: EdicoesDoMestre = {}
    if (ataque === undefined) return saida
    const d20Digitado = numeroDoCampo(d20)
    if (d20Digitado !== null && ataque.rolagem !== null && d20Digitado !== ataque.rolagem.d20) saida.d20 = Math.min(20, Math.max(1, d20Digitado))
    const caDigitada = numeroDoCampo(ca)
    if (caDigitada !== null && caDigitada !== ataque.ca) saida.ca = caDigitada
    if (critico !== null && critico !== ataque.critico) saida.critico = critico
    if (faixa !== null) saida.faixa = faixa
    const danoDigitado = numeroDoCampo(dano)
    if (danoDigitado !== null) saida.dano = Math.max(0, danoDigitado)
    const mitigacaoDigitada = numeroDoCampo(mitigacao)
    if (resolucao && mitigacaoDigitada !== null) saida.mitigacao = Math.max(0, mitigacaoDigitada)
    if (!resolucao && !ataque.kiPago && !gastarKi) saida.gastarKi = false
    if (!resolucao && abrirReacoes === ataque.semJanela) saida.abrirReacoes = abrirReacoes
    if (resolucao && !aplicarDano) saida.aplicarDano = false
    if (efeitos.some((aplicar, indice) => aplicar !== ataque.efeitos[indice]?.aplicar)) saida.aplicarEfeitos = efeitos
    return saida
  }, [ataque, d20, ca, critico, faixa, dano, mitigacao, resolucao, gastarKi, abrirReacoes, aplicarDano, efeitos])

  const previa = useMemo(() => (ataque === undefined ? null : previaDoAtaque(nucleo, fichas, ataque, edicoes)), [nucleo, fichas, ataque, edicoes])
  const podeCancelar = opcoes.some((opcao) => opcao.chave === 'cancelar')
  const confirmar = opcoes.find((opcao) => opcao.chave === 'confirmar')

  const enviar = (evento: FormEvent) => {
    evento.preventDefault()
    if (ocupado || confirmar === undefined || confirmar.bloqueio !== null) return
    onConfirmar(edicoes)
  }

  const teste = pendencia.teste
  const finalPrevisto = previa === null ? 0 : Math.max(0, previa.danoPrevisto - previa.mitigacao)

  return (
    <form className="dbb-cartao" onSubmit={enviar} aria-label="Confirmação do mestre">
      <p className="dbb-cartao__t">{tituloDaPendencia(nucleo, pendencia)}</p>
      {pendencia.etapa === 'especial' && <p className="dbb-cartao__d">Técnica especial: confira o dano e os efeitos antes de seguir.</p>}
      {teste !== undefined && ataque === undefined && (
        <p className="dbb-cartao__d">
          {nomeDoCombatente(nucleo, teste.combatenteId)}: {teste.atributos.map((atributo) => atributo.toUpperCase()).join(' ou ')} contra {teste.contra}. Role à mesa e confirme.
        </p>
      )}
      {ataque !== undefined && previa !== null && (
        <>
          {previa.rolagem !== null && <PartesDaConta partes={previa.rolagem.partes} />}
          {previa.salvaguarda !== null && (
            <p className="dbb-cartao__d">
              Salvaguarda do alvo: d20 {previa.salvaguarda.d20}, total {previa.salvaguarda.total} contra CD {previa.salvaguarda.cd}
            </p>
          )}
          <div className="dbb-golpe">
            {previa.rolagem !== null && <NumeroDoGolpe valor={previa.rolagem.total} rotulo={`acerto, d20 ${previa.rolagem.d20}`} />}
            {previa.ca !== null && <NumeroDoGolpe valor={previa.ca} rotulo="CA" tipo="ca" />}
            <NumeroDoGolpe valor={resolucao ? finalPrevisto : previa.danoPrevisto} rotulo={resolucao ? `dano final${previa.mitigacao > 0 ? `, mitigou ${previa.mitigacao}` : ''}` : 'dano previsto'} tipo="dano" />
          </div>
          <FaixaDoGolpe faixa={previa.faixa} critico={previa.critico} onEscolher={setFaixa} />
          <div className="dbb-campos">
            {!resolucao && ataque.rolagem !== null && <CampoDeNumero rotulo="d20" valor={d20} onTrocar={setD20} placeholder={String(ataque.rolagem.d20)} min={1} max={20} />}
            {!resolucao && ataque.ca !== null && <CampoDeNumero rotulo="CA usada" valor={ca} onTrocar={setCa} placeholder={String(ataque.ca)} />}
            {resolucao && <CampoDeNumero rotulo="Mitigação" valor={mitigacao} onTrocar={setMitigacao} placeholder={String(ataque.mitigacao)} min={0} />}
            <CampoDeNumero rotulo={resolucao ? 'Dano final' : 'Dano previsto'} valor={dano} onTrocar={setDano} placeholder={String(resolucao ? finalPrevisto : previa.danoPrevisto)} min={0} />
          </div>
          <div className="dbb-marcas">
            {!resolucao && (
              <Interruptor ligado={previa.critico} onTrocar={() => setCritico(!previa.critico)}>
                Crítico
              </Interruptor>
            )}
            {!resolucao && !ataque.kiPago && (
              <Interruptor ligado={gastarKi} onTrocar={() => setGastarKi(!gastarKi)}>
                Gastar o Ki da técnica
              </Interruptor>
            )}
            {!resolucao && (
              <Interruptor ligado={abrirReacoes} onTrocar={() => setAbrirReacoes(!abrirReacoes)}>
                Abrir reações
              </Interruptor>
            )}
            {resolucao && (
              <Interruptor ligado={aplicarDano} onTrocar={() => setAplicarDano(!aplicarDano)}>
                Aplicar dano
              </Interruptor>
            )}
            {ataque.efeitos.map((efeito, indice) => (
              <Interruptor key={`${efeito.tipo}-${indice}`} ligado={efeitos[indice] ?? efeito.aplicar} onTrocar={() => setEfeitos(efeitos.map((aplicar, outro) => (outro === indice ? !aplicar : aplicar)))}>
                {efeito.texto}
                {efeito.cd !== null ? ` (CD ${efeito.cd})` : ''}
              </Interruptor>
            ))}
          </div>
        </>
      )}
      <div className="dbb-cartao__acoes">
        <button type="submit" className="dbf-btn dbf-btn--pri" disabled={ocupado || confirmar === undefined || confirmar.bloqueio !== null} aria-keyshortcuts="Enter">
          {ocupado ? 'Enviando…' : resolucao ? 'Aplicar' : 'Confirmar'}
        </button>
        {podeCancelar && (
          <button type="button" className="dbf-btn dbf-btn--ghost dbf-btn--perigo" disabled={ocupado} onClick={onCancelar}>
            Cancelar ação
          </button>
        )}
      </div>
    </form>
  )
}
