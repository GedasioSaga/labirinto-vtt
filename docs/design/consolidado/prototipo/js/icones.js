/* Ícones de traço (24 px). Desenhados para esta proposta, sem biblioteca externa. */
(function () {
  'use strict';

  function engrenagem() {
    const dentes = 8;
    const pts = [];
    for (let i = 0; i < dentes; i++) {
      const a = (i / dentes) * Math.PI * 2;
      const meio = Math.PI / dentes;
      const fora = 9.4;
      const dentro = 7.1;
      const larg = meio * 0.42;
      const rampa = meio * 0.2;
      const p = (ang, r) => (12 + Math.cos(ang) * r).toFixed(2) + ' ' + (12 + Math.sin(ang) * r).toFixed(2);
      pts.push(p(a - larg - rampa, dentro), p(a - larg, fora), p(a + larg, fora), p(a + larg + rampa, dentro));
    }
    return '<path d="M' + pts.join('L') + 'Z"/><circle cx="12" cy="12" r="2.8"/>';
  }

  const p = (d) => '<path d="' + d + '"/>';
  const ponto = (x, y) => '<circle cx="' + x + '" cy="' + y + '" r="1.1" fill="currentColor" stroke="none"/>';

  const ICONES = {
    cursor: p('M6 3.5l12.5 7.3-5.4 1.6-2.3 5.3z'),
    parede: p('M3.5 6.5h17v11h-17z M3.5 12h17 M9 6.5V12 M15 12v5.5'),
    porta: p('M6.5 20.5V4.5h11v16 M4 20.5h16') + ponto(14.6, 12.6),
    portaAberta: p('M2.5 16h5 M16.5 16h5 M7.5 16l3.1-8.5'),
    portaFechada: p('M2.5 16h5 M16.5 16h5 M7.5 16h9'),
    sala: p('M10.5 18.5h-6v-13h15v13h-6'),
    circulo: '<circle cx="12" cy="12" r="7.5"/>',
    poligono: p('M12 4l7.6 5.5-2.9 9H7.3l-2.9-9z'),
    livre: p('M6 8.5c1.5-3.5 7-4.5 10-2.5s4 7.5 1 10.5-10 2.5-11.5-1S4.8 11.3 6 8.5z'),
    regiao: '<path d="M4.5 5.5h15v13h-15z" stroke-dasharray="2.6 2.2"/>',
    chao: p('M4 4h7v7H4z M13 4h7v7h-7z M4 13h7v7H4z M13 13h7v7h-7z'),
    escada: p('M4 19.5h4.5v-4h4v-4h4v-4H20'),
    caminho: '<path d="M4 18c3.5 0 4-5 8-5s4.5-6 8-6" stroke-dasharray="2.6 2.4"/>',
    bau: p('M4 10.5h16v8.5H4z M4 10.5a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4 M10.5 12.5h3v2.5h-3z'),
    luz: '<circle cx="12" cy="12" r="3.5"/>' + p('M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8'),
    zona: '<path d="M4.5 4.5h15v15h-15z" stroke-dasharray="3 2.4"/>' + p('M8.3 12c1-1.7 2.3-2.5 3.7-2.5s2.7.8 3.7 2.5c-1 1.7-2.3 2.5-3.7 2.5S9.3 13.7 8.3 12z'),
    pincelRevelar: p('M14.5 4.5l4 4-8 8-4.3 1 1-4.3z M4.5 20h5 M18.3 14.2l.7 1.6 1.6.7-1.6.7-.7 1.6-.7-1.6-1.6-.7 1.6-.7z'),
    lapis: p('M4.5 19.5l1-4.5L16 4.5l3.5 3.5L9 18.5z M14 6.5l3.5 3.5'),
    texto: p('M5.5 6.5v-2h13v2 M12 4.5v15 M9.5 19.5h5'),
    pino: p('M12 21s-6-5.7-6-10.5a6 6 0 0 1 12 0C18 15.3 12 21 12 21z') + '<circle cx="12" cy="10.5" r="2"/>',
    regua: p('M3.5 16.5l13-13 4 4-13 13z M7.5 12.5l2 2 M10.5 9.5l2 2 M13.5 6.5l2 2'),
    borracha: p('M9 19.5h10.5 M4.5 15l9.5-9.5 5.5 5.5-8.5 8.5H8z M9.3 10.2l5.5 5.5'),
    token: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="10" r="2.6"/>' + p('M7.6 17.3c1-2.1 2.6-3.1 4.4-3.1s3.4 1 4.4 3.1'),
    ficha: p('M6 3.5h12v17H6z M9 8h6 M9 11.5h6 M9 15h3.5'),
    cena: p('M3.5 6.5l5.5-2 6 2 5.5-2v13l-5.5 2-6-2-5.5 2z M9 4.5v13 M15 6.5v13'),
    aventura: p('M5 6.5a2 2 0 0 1 2-2h11.5v13H7a2 2 0 0 0-2 2z M5 19.5a2 2 0 0 1 2-2h11.5v2.5H7 M9 8.5h6'),
    acervo: p('M4 4.5h16v15H4z M4 12h16 M10 8.2h4 M10 15.7h4'),
    grupo: '<circle cx="9" cy="9" r="3"/><circle cx="16.5" cy="8.2" r="2.4"/>' + p('M3.5 18.5c.8-2.8 2.8-4.3 5.5-4.3s4.7 1.5 5.5 4.3 M15.6 13.3c2.4-.2 4.2 1.1 4.9 3.7'),
    chat: p('M4.5 5.5h15v10.5H10l-4 3.5v-3.5H4.5z'),
    cenas: p('M12 3.5l8.5 4.5L12 12.5 3.5 8z M3.5 12.3l8.5 4.5 8.5-4.5 M3.5 16.3l8.5 4.5 8.5-4.5'),
    mesa: '<rect x="4.5" y="4.5" width="15" height="15" rx="3"/>' + ponto(9, 9) + ponto(12, 12) + ponto(15, 15),
    desfazer: p('M9 6.5L4.5 11 9 15.5 M4.5 11H14a5 5 0 0 1 0 10h-2.5'),
    refazer: p('M15 6.5l4.5 4.5-4.5 4.5 M19.5 11H10a5 5 0 0 0 0 10h2.5'),
    salvar: p('M5 4h11l3 3v13H5z M8 4v4.5h7V4 M8 20v-6h8v6'),
    arquivo: p('M4 7.5V5.5h6l2 2h8v11.5H4z M4 10h16'),
    ajuda: '<circle cx="12" cy="12" r="8.5"/>' + p('M9.6 9.5a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.2.9-1.2 1.8 M12 16.6v.01'),
    reticencias: ponto(6, 12) + ponto(12, 12) + ponto(18, 12),
    mais: p('M12 5v14 M5 12h14'),
    lixo: p('M4.5 7h15 M9.5 7V4.5h5V7 M6.5 7l1 12.5h9l1-12.5 M10.5 10.5v6 M13.5 10.5v6'),
    olho: p('M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12z') + '<circle cx="12" cy="12" r="2.8"/>',
    olhoFechado: p('M3.5 3.5l17 17 M10.6 5.6A10 10 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a16.6 16.6 0 0 1-2.6 3.4 M6.4 6.9C3.9 8.6 2.5 12 2.5 12s3.5 6.5 9.5 6.5a9.6 9.6 0 0 0 4.2-1 M9.9 10a2.8 2.8 0 0 0 4 4'),
    cadeado: p('M6 11h12v9H6z M8.5 11V8a3.5 3.5 0 0 1 7 0v3'),
    floco: p('M12 3v18 M4.2 7.5l15.6 9 M4.2 16.5l15.6-9 M9.5 4.5L12 7l2.5-2.5 M9.5 19.5L12 17l2.5 2.5'),
    busca: '<circle cx="10.5" cy="10.5" r="6"/>' + p('M15 15l5 5'),
    dir: p('M9 6l6 6-6 6'),
    baixo: p('M6 9l6 6 6-6'),
    esq: p('M15 6l-6 6 6 6'),
    cima: p('M6 15l6-6 6 6'),
    x: p('M6.5 6.5l11 11M17.5 6.5l-11 11'),
    laser: '<circle cx="12" cy="12" r="2.2"/>' + p('M12 3v4M12 17v4M3 12h4M17 12h4'),
    som: p('M4.5 9.5h3.5l4.5-4v13l-4.5-4H4.5z M15.5 9a4.2 4.2 0 0 1 0 6 M18 6.5a7.8 7.8 0 0 1 0 11'),
    somMudo: p('M4.5 9.5h3.5l4.5-4v13l-4.5-4H4.5z M16 9.5l5 5 M21 9.5l-5 5'),
    convidar: '<circle cx="9.5" cy="8.5" r="3.2"/>' + p('M3.5 19c.8-3 3.1-4.6 6-4.6s5.2 1.6 6 4.6 M18.5 7.5v6 M15.5 10.5h6'),
    copiar: p('M8.5 8.5h11v11h-11z M15.5 8.5v-4h-11v11h4'),
    voltar: p('M10.5 5.5L4 12l6.5 6.5 M4.5 12H20'),
    pasta: p('M3.5 6.5h6l2 2h9v10.5h-17z'),
    coracao: p('M12 19.5s-7.5-4.6-7.5-10A4.2 4.2 0 0 1 12 7.1a4.2 4.2 0 0 1 7.5 2.4c0 5.4-7.5 10-7.5 10z'),
    estrela: p('M12 4l2.3 4.9 5.2.6-3.9 3.6 1.1 5.2L12 15.7l-4.7 2.6 1.1-5.2-3.9-3.6 5.2-.6z'),
    seta: p('M4.5 12h14 M13 6.5l5.5 5.5-5.5 5.5'),
    bandeira: p('M6 20.5V4 M6 4.5h11l-2 4 2 4H6'),
    marcador: p('M7 3.5h10v17l-5-3.5-5 3.5z'),
    mao: p('M8 11V5.5a1.5 1.5 0 0 1 3 0V11 M11 10V4.5a1.5 1.5 0 0 1 3 0V10 M14 10V6a1.5 1.5 0 0 1 3 0v7c0 4-2.5 7-6 7-2.5 0-4-1.3-5.4-3.5L4 13.2a1.4 1.4 0 0 1 2.4-1.5L8 13.5'),
    mochila: p('M6 9a6 6 0 0 1 12 0v11H6z M9.5 9V5.5h5V9 M9 14h6'),
    mira: '<circle cx="12" cy="12" r="6.5"/><circle cx="12" cy="12" r="1.5"/>' + p('M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3'),
    d20: p('M12 3l8 4.5v9L12 21l-8-4.5v-9z M12 3l-5 9h10z M7 12l5 9 5-9 M4 7.5l3 4.5 M20 7.5l-3 4.5'),
    caderno: p('M6 3.5h11.5a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H6z M9 3.5v17 M12 8h4 M12 11.5h4'),
    bussola: '<circle cx="12" cy="12" r="8.5"/>' + p('M15.2 8.8l-1.9 4.5-4.5 1.9 1.9-4.5z'),
    chave: '<circle cx="8" cy="15.5" r="3.5"/>' + p('M10.5 13l8-8 M16 7.5l2.5 2.5 M13.8 9.7l1.8 1.8'),
    peca: p('M5 8h4a2 2 0 1 1 4 0h4v4a2 2 0 1 1 0 4v4H5z'),
    loja: p('M4.5 9.5l1.5-5h12l1.5 5 M4.5 9.5v10h15v-10 M4.5 9.5h15 M10 19.5v-5h4v5'),
    cabine: p('M6.5 3.5h11v17h-11z M12 3.5v17 M8.3 9.5l1.2-1.4 1.2 1.4 M13.3 14.5l1.2 1.4 1.2-1.4'),
    filme: p('M4 6.5h16v13H4z M4 10.5h16 M8 6.5l-1.5 4 M13 6.5l-1.5 4 M18 6.5l-1.5 4'),
    joia: p('M7 4.5h10l3.5 4.5L12 20 3.5 9z M3.5 9h17 M9.5 4.5L12 9l2.5-4.5'),
    pulso: p('M3.5 12.5h4l2.5-6 4 11 2.5-5h4'),
    rota: '<circle cx="6" cy="6" r="2"/><circle cx="18" cy="18" r="2"/>' + p('M8 6h6.5a3 3 0 0 1 0 6h-5a3 3 0 0 0 0 6H16'),
    elo: p('M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1 M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1'),
    carroca: p('M3.5 14.5h17 M5.5 14.5V9h13v5.5 M9 9V6h6v3') + '<circle cx="7.5" cy="17.5" r="2"/><circle cx="16.5" cy="17.5" r="2"/>',
    relogio: '<circle cx="12" cy="12" r="8.5"/>' + p('M12 7.5V12l3 2'),
    lampiao: p('M9 4.5h6 M12 2.5v2 M8 8.5h8l-1 10H9z M8 8.5l1.2-4h5.6l1.2 4 M12 12v3'),
    janela: p('M5 4.5h14v15H5z M12 4.5v15 M5 12h14'),
    exclamacao: p('M12 5v9.5 M12 18.6v.2'),
    interrogacao: p('M9 9a3 3 0 1 1 4.3 2.7c-.8.4-1.3 1-1.3 1.9V15 M12 18.6v.2'),
    viagem: p('M5.5 19.5L12 4l6.5 15.5L12 16z'),
    alavanca: p('M5 19.5h14 M12 19.5l4-12.5') + '<circle cx="16.6" cy="5.6" r="2"/>',
    balde: p('M5 9.5h14l-1.5 10h-11z M6.5 9.5c0-2.8 2.5-5 5.5-5s5.5 2.2 5.5 5'),
    linha: p('M5 19L19 5'),
    curva: p('M5 19c0-9 5-14 14-14'),
    elipse: '<ellipse cx="12" cy="12" rx="8.5" ry="5.5"/>',
    imagem: p('M4.5 5.5h15v13h-15z M4.5 15.5l4-4 3.5 3.5 2.5-2.5 5 5') + '<circle cx="15.5" cy="9" r="1.5"/>',
    barril: '<ellipse cx="12" cy="5.5" rx="5.5" ry="2"/>' + p('M6.5 5.5c-1 4.5-1 8.5 0 13 M17.5 5.5c1 4.5 1 8.5 0 13 M6.5 18.5c1.3 1.3 9.7 1.3 11 0 M6 10h12 M6 14h12'),
    caixa: p('M4.5 7.5l7.5-3.5 7.5 3.5v9l-7.5 3.5-7.5-3.5z M4.5 7.5L12 11l7.5-3.5 M12 11v9'),
    cama: p('M3.5 18.5V7 M3.5 13.5h17v5 M3.5 10.5h7v3 M20.5 13.5V11a2 2 0 0 0-2-2h-8'),
    mesaMovel: p('M3.5 9.5h17 M5.5 9.5v9 M18.5 9.5v9 M5.5 13.5h13'),
    cadeira: p('M7.5 4.5v15 M7.5 12.5h9v7 M16.5 12.5V9'),
    play: p('M7.5 5.5l11 6.5-11 6.5z'),
    pausa: p('M8 5.5v13M16 5.5v13'),
    sino: p('M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 1.5h-14z M10 20h4'),
    abalo: p('M3 12h3l2-4 3 8 3-10 3 8 2-2h2'),
    ruido: p('M4 12h1.5 M8 8.5v7 M11.5 5.5v13 M15 8.5v7 M18.5 11v2'),
    monitor: p('M3.5 5h17v11h-17z M8.5 20h7 M12 16v4'),
    livro: p('M12 6.5c-2-1.5-5-2-8-1.5v13c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5v-13c-3-.5-6 0-8 1.5z M12 6.5v13'),
    carta: p('M4 6.5h16v11H4z M4 7l8 6 8-6'),
    seguir: p('M4.5 12h10 M10.5 7l5 5-5 5 M19.5 5v14'),
    trazer: p('M19.5 12h-14 M10.5 7l-5 5 5 5'),
    dispensar: p('M14.5 4.5h4v15h-4 M9.5 8l-4 4 4 4 M5.5 12h10'),
    expulsar: '<circle cx="12" cy="12" r="8.5"/>' + p('M9 9l6 6M15 9l-6 6'),
    moedas: '<ellipse cx="10" cy="7" rx="5.5" ry="2.5"/>' + p('M4.5 7v4c0 1.4 2.5 2.5 5.5 2.5s5.5-1.1 5.5-2.5V7 M8.5 16.4c.5 1.2 2.8 2.1 5.5 2.1 3 0 5.5-1.1 5.5-2.5v-4c0-1-1.3-1.9-3.2-2.3'),
    troca: p('M4.5 8.5h14l-3.5-3.5 M19.5 15.5h-14l3.5 3.5'),
    nevoa: p('M4 9h12 M7 12.5h13 M4 16h10'),
    confirma: p('M5 12.5l4.5 4.5L19 7.5'),
    alerta: p('M12 4l9 16H3z M12 10v4 M12 17.4v.2'),
    casa: p('M4 11l8-6.5 8 6.5 M6.5 9v10.5h11V9'),
    teclado: p('M3.5 6.5h17v11h-17z M7 10h.01M10.5 10h.01M14 10h.01M17.5 10h.01M7 14h10'),
    exportar: p('M12 15V4 M7.5 8.5L12 4l4.5 4.5 M4.5 14.5v5h15v-5'),
    importar: p('M12 4v11 M7.5 10.5L12 15l4.5-4.5 M4.5 14.5v5h15v-5'),
    varinha: p('M4.5 19.5l11-11 M15 4.5l.8 1.7 1.7.8-1.7.8-.8 1.7-.8-1.7-1.7-.8 1.7-.8z'),
    recolherEsq: p('M13 7l-5 5 5 5 M18 7l-5 5 5 5'),
    recolherDir: p('M11 7l5 5-5 5 M6 7l5 5-5 5'),
    selo: p('M7.5 5.5h9 M7.5 5.5v13h9 M10.5 9v6'),
    engrenagem: engrenagem(),
    pessoa: '<circle cx="12" cy="8" r="3.5"/>' + p('M5 20c1-3.8 3.6-5.6 7-5.6s6 1.8 7 5.6'),
  };

  function ic(nome, classe) {
    return '<svg class="ic' + (classe ? ' ' + classe : '') + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + (ICONES[nome] || '') + '</svg>';
  }

  window.GR_ICONES = ICONES;
  window.ic = ic;
})();
