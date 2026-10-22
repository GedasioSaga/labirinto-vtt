// PONTE DO PROTÓTIPO (não vai para o app). Os módulos em ../modulos/porta/ importam
// '../../portas/animacoesDePorta', o mesmo caminho que terão em client/src/animacoes/porta/.
// Aqui esse caminho cai neste arquivo, que reexporta o código REAL do app: o desenho das
// novas usa os mesmos tracarRetanguloDaPorta e desenharBatente da porta parada.
export * from '../../../../client/src/portas/animacoesDePorta'
