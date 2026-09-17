/*
 * Quantos lados a "Sala Circular" usa.
 *
 * "Sala Circular" é o mesmo polígono regular de "Polígono Regular", só que com
 * a contagem de lados fixada aqui em vez de escolhida pelo usuário (ver
 * PolygonSidesControls, que só aparece para 'roomPolygon').
 *
 * Mora num módulo próprio, e não dentro de PixiCanvas.tsx, porque quem decide a
 * suavidade do círculo é a geometria (drawingFactory), não o canvas.
 *
 * POR QUE 64, e não os 24 de antes: num polígono regular inscrito, o meio de
 * cada lado fica a `cos(pi/N)` do raio, então o contorno desenhado oscila
 * `1 - cos(pi/N)` — 0,86% com 24 lados, que num raio de 280 px são 2,4 px de
 * achatamento, visíveis a olho nu no topo, na base e nas laterais (foi essa a
 * medição do passeio cego de 17/09/2026: 1,00% medido, mínimo 278,6 px, máximo
 * 281,4 px). Com 64 lados a oscilação cai para 0,12% — 0,34 px no mesmo raio,
 * abaixo do próprio antialiasing do traço, ou seja, indistinguível de um
 * círculo em qualquer zoom prático. E como a oscilação é RELATIVA ao raio, o
 * número vale para círculo grande e pequeno igualmente.
 *
 * O preço é uma parede por lado: uma Sala Circular passa a nascer com 64
 * paredes vinculadas em vez de 24 (a numeração `regionEdgeIndex` 0..N-1 e toda
 * a edição de vértice continuam funcionando sem mudança — ver
 * buildRegularPolygonRoomFromDraft). 64 é potência de dois e múltiplo de 4, o
 * que mantém o polígono simétrico nos quatro quadrantes, e a ~27 px de aresta
 * num raio de 280 px cada vértice continua grande o bastante para ser pego com
 * o ponteiro.
 */
export const ROOM_CIRCLE_SIDES = 64
