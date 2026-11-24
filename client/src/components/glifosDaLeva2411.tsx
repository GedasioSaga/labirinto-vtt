/**
 * Os ícones da leva de 24/11/2026 (lotes L01 a L11 da lista dos 8 mapas): um desenho por objeto, de cima ou de
 * frente como o objeto se lê melhor, na grade de 24 do `Icon` (`icons.tsx`). Moram aqui para não crescer o
 * `glifoDoMovel`, que chama este no fim.
 */
import type { ReactNode } from 'react'
import type { TipoMobilia } from '../types/map'

export function glifoDaLeva2411(tipo: TipoMobilia): ReactNode {
  switch (tipo) {
    case 'cadeiraDeFerro':
      return (
        <>
          <path d="M5 4h14v3.5H5z" /><path d="M6 7.5V20h12V7.5" /><path d="M9 11v6M12 11v6M15 11v6" />
        </>
      )
    case 'mesaDeFerro':
      return (
        <>
          <rect x="3" y="7" width="18" height="10" /><path d="M5.5 9.5h.01M18.5 9.5h.01M5.5 14.5h.01M18.5 14.5h.01M12 7v10" />
        </>
      )
    case 'catreDeFerro':
      return (
        <>
          <path d="M3 4h18" /><rect x="4" y="9" width="16" height="9" /><path d="M5 4l-.5 5M19 4l.5 5M8 9v9M12 9v9M16 9v9" />
        </>
      )
    case 'esteiraDePalha':
      return (
        <>
          <rect x="7" y="3" width="10" height="18" rx="3" /><path d="M9 7l2 3M13 6l2 4M9 13l3 2M13 14l2 3" />
        </>
      )
    case 'baldeDeDejetos':
      return (
        <>
          <circle cx="12" cy="12" r="7.5" /><circle cx="11" cy="11" r="4.5" /><path d="M13.5 15.2a4.5 4.5 0 0 0 2.2-2.4" />
        </>
      )
    case 'grilhoesDeParede':
      return (
        <>
          <path d="M3 4h18M8 4v5M16 4v5" /><path d="M5.5 15a2.5 2.5 0 1 0 5 0 2.5 2.5 0 0 0-2.5-2.5M13.5 15a2.5 2.5 0 1 0 5 0 2.5 2.5 0 0 0-2.5-2.5" />
        </>
      )
    case 'bolaDeFerroComCorrente':
      return (
        <>
          <circle cx="16" cy="16" r="4.5" /><path d="M12.6 12.6l-1.4-1.4M10.2 10.2 8.8 8.8" /><circle cx="6.5" cy="6.5" r="2.5" />
        </>
      )
    case 'latrinaDeCela':
      return (
        <>
          <rect x="4" y="4" width="16" height="16" rx="1" /><ellipse cx="12" cy="10" rx="2.5" ry="3.5" /><path d="M12 13.5v2.5M7.5 15v3M16.5 15v3" />
        </>
      )
    case 'bancoDePedra':
      return (
        <>
          <rect x="3" y="8" width="18" height="6" rx="1" /><path d="M5 14v3h4v-3M15 14v3h4v-3" />
        </>
      )
    case 'mesaDoCarcereiro':
      return (
        <>
          <rect x="3" y="6" width="18" height="12" /><path d="M6.5 10l3 1 3-1v5l-3 1-3-1zM9.5 11v5" /><circle cx="17" cy="10" r="1.2" />
        </>
      )
    case 'quadroDeChaves':
      return (
        <>
          <rect x="4" y="3" width="16" height="9" /><path d="M8 6v3M16 6v3" /><circle cx="12" cy="16" r="2.5" /><path d="M12 18.5V22M12 20.5h2" />
        </>
      )
    case 'jaulaDeChao':
      return (
        <>
          <rect x="4" y="4" width="16" height="16" /><path d="M8 4v16M12 4v16M16 4v16M4 12h16" />
        </>
      )
    case 'raloDeMasmorra':
      return (
        <>
          <rect x="5" y="5" width="14" height="14" /><path d="M5 9.7h14M5 14.3h14M9.7 5v14M14.3 5v14" /><path d="M3 21l2-2" />
        </>
      )
    case 'bauDeFerro':
      return (
        <>
          <rect x="3" y="6" width="18" height="12" rx="1" /><path d="M8 6v12M16 6v12M3 10h18" /><rect x="11" y="12" width="2" height="3" />
        </>
      )
    case 'tabuaDePregos':
      return (
        <>
          <rect x="3" y="8" width="18" height="8" /><path d="M6 11h.01M9 13h.01M12 11h.01M15 13h.01M18 11h.01" /><path d="M3 6h2M19 6h2" />
        </>
      )
    case 'cepoDoCarrasco':
      return (
        <>
          <rect x="5" y="5" width="14" height="14" rx="1.5" /><path d="M10 5v3a2 2 0 0 0 4 0V5M10 19v-3a2 2 0 0 1 4 0v3" />
        </>
      )
    case 'posteDeAcoite':
      return (
        <>
          <path d="M12 3v18M9 21h6" /><circle cx="14.5" cy="8" r="2" /><path d="M14.5 10c0 3 2 4 1 7" />
        </>
      )
    case 'gradeDeCorredor':
      return (
        <>
          <path d="M3 10h18M3 14h18" /><circle cx="6" cy="12" r="1.2" /><circle cx="10" cy="12" r="1.2" /><circle cx="14" cy="12" r="1.2" /><circle cx="18" cy="12" r="1.2" />
        </>
      )
    case 'corpoAmortalhado':
      return (
        <>
          <path d="M3 12a3 3 0 0 1 3-3h1.5c1.5-1 3-1 4.5-1H19c1.5 0 2 2 2 4s-.5 4-2 4h-7c-1.5 0-3 0-4.5-1H6a3 3 0 0 1-3-3z" /><path d="M10 8.2v7.6M14 8v8M17.5 8v8" />
        </>
      )
    case 'pranchaDeTortura':
      return (
        <>
          <rect x="8" y="3" width="8" height="15" /><path d="M8 7h8M8 13h8M8 18l-3 3M16 18l3 3M5 21h14" />
        </>
      )
    case 'braseiroComFerros':
      return (
        <>
          <circle cx="10" cy="10" r="5.5" /><path d="M13.5 13.5l6 2.5M12.5 14.5l4 6M14.5 12h6.5" />
        </>
      )
    case 'fossoDeBrasas':
      return (
        <>
          <rect x="3" y="3" width="18" height="18" rx="2" /><rect x="6.5" y="6.5" width="11" height="11" /><path d="M10 6.5v11M14 6.5v11M6.5 10h11M6.5 14h11" />
        </>
      )
    case 'rodaDeTortura':
      return (
        <>
          <circle cx="12" cy="12" r="6.5" /><circle cx="12" cy="12" r="1.5" /><path d="M12 5.5v-3M12 18.5v3M5.5 12h-3M18.5 12h3M7.4 7.4 5.3 5.3M16.6 16.6l2.1 2.1M16.6 7.4l2.1-2.1M7.4 16.6l-2.1 2.1" />
        </>
      )
    case 'guilhotina':
      return (
        <>
          <path d="M7 21V3M17 21V3M5 3h14M7 7h10L7 10" /><path d="M7 15h10M10 15a2 2 0 0 0 4 0" />
        </>
      )
    case 'pertencesConfiscados':
      return (
        <>
          <ellipse cx="12" cy="13" rx="8" ry="5.5" /><path d="M4 6l15 14M6 4.5 3.5 7" />
        </>
      )
    case 'guinchoDeCorrente':
      return (
        <>
          <path d="M3 4h18" /><rect x="6" y="6" width="12" height="5" rx="2.5" /><path d="M9 11v4M9 17v2M15 11l1 3M16.5 16l1 4" /><circle cx="9" cy="16" r="1" />
        </>
      )
    case 'fossoDoSalao':
      return (
        <>
          <circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="3" /><path d="M12 12h.01" />
        </>
      )
    case 'pilarComBraseiro':
      return (
        <>
          <path d="M8 21h8M9.5 21v-9M14.5 21v-9M7 12h10l-1.5-2.5h-7z" /><path d="M12 9.5c-1.8-1.5-.5-3.5 0-6 1.5 2 2.5 4 0 6z" />
        </>
      )
    case 'lanternaGradeada':
      return (
        <>
          <path d="M4 3h16M12 3v3" /><rect x="8.5" y="6" width="7" height="11" rx="1" /><path d="M10.8 6v11M13.2 6v11M10 20h4" />
        </>
      )
    case 'globoDeLuzRubra':
      return (
        <>
          <circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="5" /><path d="M10.2 10.8a2.2 2.2 0 0 1 2-1.8" />
        </>
      )
    case 'seloDeOrbitas':
      return (
        <>
          <circle cx="12" cy="12" r="8.5" /><path d="M12 3.5a4.25 4.25 0 0 1 0 8.5 4.25 4.25 0 0 0 0 8.5" /><circle cx="12" cy="7.75" r="1" /><circle cx="12" cy="16.25" r="1" />
        </>
      )
    case 'plataformaDeRitual':
      return (
        <>
          <circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3.5" /><path d="M6.3 6.3h.01M17.7 6.3h.01M6.3 17.7h.01M17.7 17.7h.01M12 4h.01M12 20h.01" />
        </>
      )
    case 'gargula':
      return (
        <>
          <path d="M7 21h10M8 21v-4h8v4" /><path d="M9 17c0-3 1-5 3-5s3 2 3 5" /><path d="M10 9.5l1-2.5h2l1 2.5-2 2.5z" /><path d="M8.5 14c-2-1-2.5-4-1.5-6M15.5 14c2-1 2.5-4 1.5-6" />
        </>
      )
    case 'estatuaDeBesta':
      return (
        <>
          <path d="M4 21h16M5 21v-3h14v3" /><path d="M8 18v-6l4-3 4 3v6" /><path d="M10 9.5 8 4M14 9.5 16 4" />
        </>
      )
    case 'estatuaEncapuzada':
      return (
        <>
          <path d="M8 21h8M9 21l1-1h4l1 1" /><path d="M9.5 20 8 11a4 4 0 0 1 8 0l-1.5 9" /><path d="M10.5 10a1.5 1.5 0 0 1 3 0v1h-3z" />
        </>
      )
    case 'ponteDeCorrente':
      return (
        <>
          <path d="M3 8h18M3 16h18M3 6v4M21 6v4M3 14v4M21 14v4" /><path d="M6 9.5v5M9 9.5v5M12 9.5v5M15 9.5v5M18 9.5v5" />
        </>
      )
    case 'sarcofagoEntreaberto':
      return (
        <>
          <rect x="5" y="2.5" width="11" height="16" rx="1" /><path d="M8 7h11v14.5H8z" /><path d="M5.5 5.5 8 7" />
        </>
      )
    case 'sarcofagoDeBronze':
      return (
        <>
          <rect x="5" y="3" width="14" height="18" rx="2" /><rect x="7" y="5" width="10" height="14" rx="1.5" /><circle cx="12" cy="10" r="2" /><path d="M10 15h4" />
        </>
      )
    case 'caixaoDeFerro':
      return (
        <>
          <path d="M9 3h6l3 5-2 13H8L6 8z" /><path d="M6.8 11h10.4M7.4 16h9.2" />
        </>
      )
    case 'lajeTumular':
      return (
        <>
          <rect x="6" y="3" width="12" height="18" rx="1" /><path d="M9 8h6M9 11h6M9 14h4M18 18l-2 3" />
        </>
      )
    case 'nichoFunerario':
      return (
        <>
          <path d="M3 4h18M5 4v16h14V4" /><path d="M8 18v-6a4 4 0 0 1 8 0v6z" />
        </>
      )
    case 'colunaLisa':
      return (
        <>
          <circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="5.5" /><path d="M12 12h.01" />
        </>
      )
    case 'pilastraQuadrada':
      return (
        <>
          <path d="M3 5h18" /><rect x="6.5" y="5" width="11" height="6" /><path d="M5 5v8h14V5" />
        </>
      )
    case 'urnaFuneraria':
      return (
        <>
          <path d="M9 4h6M10 4v2c-3 1-4 4-4 7 0 3 2 5 4 6h4c2-1 4-3 4-6 0-3-1-6-4-7V4" /><path d="M9 21h6" />
        </>
      )
    case 'columbario':
      return (
        <>
          <path d="M3 3h18v18H3zM12 3v18" /><rect x="5" y="6" width="5" height="4" /><rect x="14" y="6" width="5" height="4" /><rect x="5" y="14" width="5" height="4" /><rect x="14" y="14" width="5" height="4" />
        </>
      )
    case 'estradoEmMeiaLua':
      return (
        <>
          <path d="M3 5h18M3 5a9 9 0 0 0 18 0M6.5 5a5.5 5.5 0 0 0 11 0M9.5 5a2.5 2.5 0 0 0 5 0" />
        </>
      )
    case 'sarcofagoDeCristais':
      return (
        <>
          <rect x="7" y="4" width="10" height="16" rx="1" /><path d="M4 20l1.5-4 1 4M18 20l1-5 1.5 5M17 5l1.5-2.5 1 3" />
        </>
      )
    case 'relicarioDeCristal':
      return (
        <>
          <rect x="4" y="6" width="16" height="12" rx="1" /><path d="M12 8l4 4-4 4-4-4z" />
        </>
      )
    case 'lajeTumularAcesa':
      return (
        <>
          <rect x="6" y="3" width="12" height="18" rx="1" /><path d="M10 6h4l-2 2.5zM10 11h4l-2-2.5z" /><path d="M16 21l2-3-1-2" />
        </>
      )
    case 'pedestalComCristal':
      return (
        <>
          <path d="M3 3v18M3 3h18" /><path d="M3 19A16 16 0 0 0 19 3M3 14A11 11 0 0 0 14 3" /><path d="M7 9l1.5-4 1.5 4-1.5 1.5z" />
        </>
      )
    case 'arandelaDeCristal':
      return (
        <>
          <path d="M5 3h14M12 3v5M9 8h6" /><path d="M12 9l-2.5 4 2.5 7 2.5-7z" />
        </>
      )
    case 'braseiroDeChamaFria':
      return (
        <>
          <path d="M5 12h14l-2 4H7z" /><path d="M8 16l-2 5M16 16l2 5M12 16v5" /><path d="M10 11c-1-2 1-3 0-6M12 11c1-2-1-4 1-7M14 11c-1-2 1-3 0-5" />
        </>
      )
    case 'ossario':
      return (
        <>
          <path d="M3 3h18M4 20h16" /><circle cx="7" cy="9" r="2.5" /><circle cx="12" cy="8" r="2.5" /><circle cx="17" cy="9" r="2.5" /><circle cx="9.5" cy="14.5" r="2.5" /><circle cx="14.5" cy="14.5" r="2.5" />
        </>
      )
    case 'arcossolio':
      return (
        <>
          <path d="M3 21V9a9 9 0 0 1 18 0v12" /><path d="M6 21V10a6 6 0 0 1 12 0v11" /><rect x="7.5" y="15" width="9" height="4" />
        </>
      )
    case 'seloDeCristal':
      return (
        <>
          <path d="M12 3l9 9-9 9-9-9z" /><path d="M12 7l5 5-5 5-5-5z" /><path d="M12 12h.01" />
        </>
      )
    case 'ponteDePedraQuebrada':
      return (
        <>
          <path d="M3 7h18M3 17h18" /><path d="M10 9l1.5 1 1-1 1.5 1.5-1 2 1 2-2 1-1.5-1-1.5 1z" />
        </>
      )
    case 'ponteDeTabuasQuebrada':
      return (
        <>
          <path d="M3 7h18M3 17h18" /><path d="M5 8v8M8 8v8M14 8v8M17.5 8.5 16.5 16M20 8v8" />
        </>
      )
    case 'calcadaSobreAgua':
      return (
        <>
          <path d="M8 3v18M16 3v18M8 8h8M8 13h8M8 18h8M12 8v5" /><path d="M2.5 10c1-1 2 1 3 0M18.5 14c1-1 2 1 3 0" />
        </>
      )
    case 'muroEmRuina':
      return (
        <>
          <path d="M3 3h12M3 3v12M3 6h9M6 3v9" /><rect x="15" y="15" width="4" height="3" /><rect x="10" y="18" width="3" height="2.5" />
        </>
      )
    case 'pedestalEntalhado':
      return (
        <>
          <circle cx="12" cy="12" r="8.5" /><path d="M12 7l4.3 2.5v5L12 17l-4.3-2.5v-5z" />
        </>
      )
    case 'colunaComGlifos':
      return (
        <>
          <rect x="4" y="14" width="16" height="7" /><path d="M7 14V8l2-2 2 1.5 2-2.5 2 1.5 2-1V14" /><path d="M9 10h6M9 12h6" />
        </>
      )
    case 'estelaMaia':
      return (
        <>
          <path d="M7 21V7a5 3 0 0 1 10 0v14" /><path d="M5 21h14M9.5 10h5M9.5 13h5M9.5 16h5" />
        </>
      )
    case 'cabanaDeLajes':
      return (
        <>
          <path d="M3 21h18M5 21v-9h14v9" /><path d="M4 12l3-3h10l3 3M7 9l2-3h6l2 3M9 6l3-3 3 3" /><path d="M10.5 21v-5h3v5" />
        </>
      )
    case 'tanqueComBorda':
      return (
        <>
          <rect x="2.5" y="5" width="19" height="14" rx="1" /><rect x="5.5" y="8" width="13" height="8" /><circle cx="15.5" cy="13.5" r="1.3" />
        </>
      )
    case 'piramideEmDegraus':
      return (
        <>
          <path d="M2 21h20M4 21v-4h16v4M6 17v-4h12v4M8 13V9h8v4M10 9V5h4v4" />
        </>
      )
    case 'topoDoTemplo':
      return (
        <>
          <rect x="3" y="3" width="18" height="18" /><path d="M9 21v-8h6v8M9 15h6M9 17h6M9 19h6" /><path d="M6 6h12v4H6z" />
        </>
      )
    case 'cabecaColossal':
      return (
        <>
          <path d="M5 20V10a7 7 0 0 1 14 0v10z" /><path d="M5 10h14M8 13.5h2.5M13.5 13.5H16M9.5 17.5h5" />
        </>
      )
    case 'idoloDourado':
      return (
        <>
          <path d="M7 21h10M8 21v-3h8v3" /><circle cx="12" cy="6.5" r="2.5" /><path d="M9.5 18l.5-6.5a2 2 0 0 1 4 0l.5 6.5M8 11l2 1M16 11l-2 1" />
        </>
      )
    case 'cascataEmDegraus':
      return (
        <>
          <path d="M3 4h4v5h5v5h5v6h4" /><path d="M8 6c1 1 0 2 1 3M13 11c1 1 0 2 1 3M18 16c1 1 0 2 1 3" />
        </>
      )
    case 'ponteSobrePilares':
      return (
        <>
          <path d="M3 8h18M3 16h18" /><path d="M8 8 6 5h4L8 8M16 8l-2-3h4l-2 3M8 16l-2 3h4l-2-3M16 16l-2 3h4l-2-3" />
        </>
      )
    case 'catreDesarrumado':
      return (
        <>
          <rect x="3" y="3" width="12" height="18" rx="1" /><path d="M3 8h12" /><path d="M8 11c3 0 5 1 7 3 2 1 4 1 6 3l-2 4h-6" />
        </>
      )
    case 'camaDeCaixotes':
      return (
        <>
          <path d="M4 4h16M4 8h16M4 16h16M4 20h16" /><rect x="6" y="5" width="12" height="14" rx="2" />
        </>
      )
    case 'mesaDeCaixote':
      return (
        <>
          <rect x="6" y="6" width="12" height="12" /><path d="M12 2l10 10-10 10L2 12z" />
        </>
      )
    case 'cadeiraRemendada':
      return (
        <>
          <path d="M6 4v7M18 4v3l-1 1M6 6h7" /><rect x="5" y="11" width="14" height="9" /><path d="M16.5 17l3 1M16.5 19l3 1" />
        </>
      )
    case 'bancoCorrido':
      return (
        <>
          <rect x="2" y="9" width="20" height="6" /><path d="M5 7v10M12 7v10M19 7v10" />
        </>
      )
    case 'cortinaDePassagem':
      return (
        <>
          <path d="M3 5h18" /><path d="M5 5c0 5 1 10 0 15M9 5c0 5-1 10 0 15M13 5c0 5 1 10 0 15M17 5c0 5-1 10 0 15" />
        </>
      )
    case 'trouxaDeRoupa':
      return (
        <>
          <path d="M3 17c0-5 3-9 6-9s6 4 6 9z" /><path d="M7 8l2-3 2 3M15 13h6M15 16h6M15 19h6" />
        </>
      )
    case 'passarelaDeTabuas':
      return (
        <>
          <path d="M4 6h7M13 6h7M5 10h6M12.5 10h7M4 14h7.5M13 14h6.5M5 18h6M12 18h8" />
        </>
      )
    case 'vasoComPiaDeAco':
      return (
        <>
          <path d="M3 3h18" /><rect x="7" y="3" width="10" height="5" /><path d="M9 5.5h6M8 8v4a4 5 0 0 0 8 0V8" /><ellipse cx="12" cy="12" rx="2" ry="2.5" />
        </>
      )
    case 'mesinhaDeCela':
      return (
        <>
          <path d="M3 3h18" /><rect x="6" y="3" width="12" height="6" /><circle cx="12" cy="16" r="3" />
        </>
      )
    case 'mesaDePatio':
      return (
        <>
          <rect x="4" y="9" width="16" height="6" /><rect x="4" y="4" width="16" height="2.5" /><rect x="4" y="17.5" width="16" height="2.5" />
        </>
      )
    case 'chuveiroColetivo':
      return (
        <>
          <path d="M3 3h18M5 3v16M19 3v16M12 3v3" /><path d="M9.5 6h5l-1 2h-3z" /><path d="M10 11v1M12 11v2M14 11v1" /><circle cx="12" cy="17" r="1" />
        </>
      )
    case 'armarioDeVestiario':
      return (
        <>
          <rect x="3" y="4" width="18" height="16" /><path d="M7.5 4v16M12 4v16M16.5 4v16" /><path d="M4.5 7h1.5M9 7h1.5M13.5 7h1.5M18 7h1.5" />
        </>
      )
    case 'cadeiraDePlastico':
      return (
        <>
          <path d="M5 4h14v4H5z" /><path d="M9 5v2M12 5v2M15 5v2" /><path d="M5.5 8l1 12h11l1-12" />
        </>
      )
    case 'maquinaDeLavar':
      return (
        <>
          <rect x="4" y="3" width="16" height="18" rx="1.5" /><circle cx="12" cy="13" r="4.5" /><path d="M7 6h4M15 6h.01" />
        </>
      )
    case 'leitoHospitalar':
      return (
        <>
          <rect x="6" y="4" width="12" height="16" /><path d="M6 8h12M4 9v8M20 9v8" /><path d="M5 3h.01M19 3h.01M5 21h.01M19 21h.01" />
        </>
      )
    case 'mesaComComputador':
      return (
        <>
          <rect x="3" y="7" width="18" height="12" /><rect x="7" y="7" width="7" height="2.5" /><path d="M8 13h6M16 9v10" />
        </>
      )
    case 'cercaDeAlambrado':
      return (
        <>
          <path d="M3 5v14M21 5v14M12 5v14" /><path d="M3 7l4.5 5L12 7l4.5 5L21 7M3 17l4.5-5 4.5 5 4.5-5 4.5 5" />
        </>
      )
    case 'arquibancadaDePedra':
      return (
        <>
          <path d="M3 21A18 18 0 0 1 21 3M8 21A13 13 0 0 1 21 8M13 21a8 8 0 0 1 8-8" />
        </>
      )
    case 'fossoDeArena':
      return (
        <>
          <circle cx="12" cy="11" r="8" /><circle cx="12" cy="11" r="5.5" /><path d="M10.5 16.3V22M13.5 16.3V22" />
        </>
      )
    case 'balaustradaDeCamarote':
      return (
        <>
          <path d="M3 18a12 10 0 0 1 18 0" /><path d="M6 14.5v3M9 12.5v3M12 11.8v3M15 12.5v3M18 14.5v3" /><rect x="10" y="4" width="4" height="4" />
        </>
      )
    case 'pocoDeSangue':
      return (
        <>
          <circle cx="11" cy="11" r="7.5" /><circle cx="11" cy="11" r="4.5" /><path d="M16.5 16.5l3 3M18 21h3" />
        </>
      )
    case 'velaNoPires':
      return (
        <>
          <circle cx="11" cy="13" r="6.5" /><circle cx="11" cy="13" r="2" /><path d="M17.5 13h2a1.5 1.5 0 0 1 0 3h-2" /><path d="M11 11c-1-2 0-3 0-5 1 1.5 1.5 3 0 5z" />
        </>
      )
    case 'salamandra':
      return (
        <>
          <path d="M3 3h18" /><circle cx="10" cy="15" r="5" /><path d="M12 10.5V7h5V3M8 18h4" />
        </>
      )
    case 'monteDeEntulho':
      return (
        <>
          <path d="M3 19c1-5 4-9 9-9s8 4 9 9z" /><path d="M8 14l2-1M13 15l2 1M11 12l1-1M14 8l7-4" />
        </>
      )
    case 'camaDeTrapos':
      return (
        <>
          <rect x="7" y="3" width="10" height="3" rx="1.5" /><path d="M5 9c3-2 11-2 14 0 1 4 1 8-1 11H6C4 17 4 13 5 9z" /><path d="M7 12c3 1 7 0 10 2M8 16l8-2" />
        </>
      )
    default:
      return null
  }
}
