/**
 * Estilos de la app, escritos contra los tokens del sistema **Organic**.
 *
 * Reglas del sistema que se respetan acá: nada de valores sueltos —todo sale de
 * `C`, `E`, `R`, `SOMBRA` y `F`—, controles chicos en pill, contenedores muy
 * redondeados, y el segundo acento (salvia) usado como voz propia y no como
 * simple detalle.
 *
 * Semántica de color en esta app:
 *   terracota  marca y acciones (pestaña activa, escanear, sello de descuento)
 *   salvia     lo barato, lo que conviene, la cobertura completa
 *   acento-700 lo que falta o encarece
 */
import { StyleSheet } from 'react-native';
import { C, E, F, R, SOMBRA } from './tema';

export const s = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: C.fondo },
  contenido: { flex: 1, paddingHorizontal: E[4] },
  scrollFondo: { paddingBottom: E[8] },
  centrado: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: E[6] },
  flex: { flex: 1 },
  derecha: { alignItems: 'flex-end' },
  cargando: { marginTop: E[3], color: C.suave, fontFamily: F.cuerpo, fontSize: 15 },

  // — encabezado —
  // Centrado y con aire arriba: pegado al borde quedaba abajo de la barra de
  // estado. El safe area ya reserva la altura del sistema; esto es el respiro
  // que va por encima de eso.
  encabezado: {
    paddingHorizontal: E[4], paddingTop: E[6], paddingBottom: E[4],
    alignItems: 'center',
  },
  supratitulo: {
    fontSize: 11, color: C.acento, fontFamily: F.cuerpoMedio,
    textTransform: 'uppercase', letterSpacing: 2.4, textAlign: 'center',
  },
  titulo: {
    fontSize: 34, color: C.texto, fontFamily: F.titulo,
    letterSpacing: -0.5, marginTop: E[1], lineHeight: 40, textAlign: 'center',
  },
  subtitulo: {
    fontSize: 12.5, color: C.suave, fontFamily: F.cuerpo,
    marginTop: E[1], textAlign: 'center',
  },

  // — pestañas, en pill —
  pestanas: { flexDirection: 'row', paddingHorizontal: E[4], gap: E[1], marginBottom: E[3] },
  pestana: {
    flex: 1, paddingVertical: E[2], borderRadius: R.pill,
    backgroundColor: 'transparent', borderWidth: 1, borderColor: 'transparent',
  },
  pestanaActiva: { backgroundColor: C.acento },
  pestanaTexto: {
    textAlign: 'center', color: C.suave, fontFamily: F.cuerpoMedio, fontSize: 13,
  },
  pestanaTextoActivo: { color: C.fondo },

  // — búsqueda —
  filaBusqueda: { flexDirection: 'row', gap: E[2], marginBottom: E[3] },
  buscador: {
    backgroundColor: C.tarjeta, borderRadius: R.pill, paddingHorizontal: E[4],
    paddingVertical: E[2], fontSize: 15, color: C.texto, fontFamily: F.cuerpo,
    borderWidth: 1, borderColor: C.borde, minHeight: 42,
  },
  botonEscanear: {
    backgroundColor: C.acento, borderRadius: R.pill, paddingHorizontal: E[4],
    justifyContent: 'center',
  },
  botonEscanearTexto: { color: C.fondo, fontFamily: F.cuerpoFuerte, fontSize: 13 },

  // — filas de producto —
  filaProducto: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: C.tarjeta,
    borderRadius: R.lg, padding: E[3], marginBottom: E[2],
  },
  textoFila: { marginLeft: E[3] },
  nombreProducto: { fontSize: 14, color: C.texto, fontFamily: F.cuerpoMedio, lineHeight: 19 },
  metaProducto: { fontSize: 11.5, color: C.suave, marginTop: 3, fontFamily: F.cuerpo },
  agregar: {
    fontSize: 22, color: C.acento, paddingHorizontal: E[2], fontFamily: F.cuerpoFuerte,
  },
  agregado: { color: C.suave },
  quitar: { fontSize: 11.5, color: C.alerta, marginTop: 5, fontFamily: F.cuerpo },

  contador: { flexDirection: 'row', alignItems: 'center', gap: E[3] },
  contadorBoton: {
    fontSize: 20, color: C.acento, fontFamily: F.cuerpoFuerte,
    width: 22, textAlign: 'center',
  },
  contadorValor: {
    fontSize: 15, color: C.texto, minWidth: 18, textAlign: 'center',
    fontFamily: F.cuerpoFuerte,
  },

  // — rótulos de sección —
  rotulo: { flexDirection: 'row', alignItems: 'center', gap: E[2], marginTop: E[6], marginBottom: E[2] },
  rotuloLinea: { flex: 1, height: 1, backgroundColor: C.borde },
  rotuloTexto: {
    fontSize: 10.5, color: C.suave, fontFamily: F.cuerpoMedio,
    textTransform: 'uppercase', letterSpacing: 1.6,
  },
  seccionSinTope: {
    fontSize: 10.5, color: C.suave, marginBottom: E[2], fontFamily: F.cuerpoMedio,
    textTransform: 'uppercase', letterSpacing: 1.6,
  },
  filaEntre: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  enlace: { color: C.alerta, fontSize: 12.5, fontFamily: F.cuerpoMedio },
  vacioTitulo: {
    fontSize: 22, color: C.texto, marginBottom: E[2], textAlign: 'center',
    fontFamily: F.titulo, lineHeight: 26,
  },
  vacio: { color: C.suave, textAlign: 'center', lineHeight: 21, fontFamily: F.cuerpo, fontSize: 14 },

  // — chips —
  filaRadio: { flexDirection: 'row', gap: E[1], marginBottom: E[1] },
  chip: {
    paddingVertical: 6, paddingHorizontal: E[3], borderRadius: R.pill,
    backgroundColor: C.tarjeta, borderWidth: 1, borderColor: 'transparent',
  },
  chipActivo: { backgroundColor: C.acento, borderColor: C.acento },
  chipTexto: { color: C.suave, fontSize: 12, fontFamily: F.cuerpoMedio },
  chipTextoActivo: { color: C.fondo },
  chipAncho: { flex: 1, alignItems: 'center' },
  filaModo: { flexDirection: 'row', gap: E[2], marginTop: E[2] },

  filaRubros: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: E[2] },
  chipChico: {
    paddingVertical: 5, paddingHorizontal: E[3], borderRadius: R.pill,
    backgroundColor: C.tarjeta, borderWidth: 1, borderColor: 'transparent',
  },
  chipChicoActivo: { backgroundColor: C.okSuave, borderColor: C.okBase },
  chipChicoTexto: { color: C.suave, fontSize: 11.5, fontFamily: F.cuerpo },

  nota: {
    fontSize: 11.5, color: C.suave, fontFamily: F.cuerpo,
    lineHeight: 17, marginTop: E[3], marginBottom: E[2],
  },

  // — el destacado: lo que conviene, en salvia —
  sello: {
    backgroundColor: C.okSuave, borderRadius: R.contenedor,
    paddingVertical: E[6], paddingHorizontal: E[4], alignItems: 'center',
    marginTop: E[4], ...SOMBRA.md,
  },
  selloInterior: { alignItems: 'center' },
  selloEtiqueta: {
    fontSize: 10, color: C.ok, fontFamily: F.cuerpoMedio,
    textTransform: 'uppercase', letterSpacing: 2.4,
  },
  selloNombre: {
    fontSize: 26, color: C.texto, marginTop: E[2], fontFamily: F.titulo,
    textAlign: 'center', lineHeight: 30,
  },
  selloDireccion: {
    fontSize: 12, color: C.suave, marginTop: E[1], fontFamily: F.cuerpo, textAlign: 'center',
  },
  selloTotal: { fontSize: 40, color: C.ok, marginTop: E[2], fontFamily: F.titulo, lineHeight: 46 },
  selloAhorro: {
    fontSize: 13.5, color: C.texto, marginTop: E[1], fontFamily: F.cuerpo, textAlign: 'center',
  },

  aviso: {
    backgroundColor: C.alertaSuave, borderRadius: R.contenedor, padding: E[4], marginTop: E[4],
  },
  avisoTitulo: { color: C.alerta, marginBottom: E[1], fontFamily: F.titulo, fontSize: 17 },
  avisoTexto: { color: C.texto, fontSize: 13, lineHeight: 19, fontFamily: F.cuerpo },

  // — tarjetas —
  tarjeta: {
    backgroundColor: C.tarjeta, borderRadius: R.lg, padding: E[4], marginBottom: E[2],
  },
  nombreCadena: { fontSize: 16, color: C.texto, fontFamily: F.cuerpoFuerte },
  total: { fontSize: 17, color: C.texto, fontFamily: F.cuerpoFuerte },
  totalGrande: { fontSize: 30, color: C.ok, fontFamily: F.titulo, lineHeight: 36 },
  cobertura: { fontSize: 11.5, marginTop: 3, fontFamily: F.cuerpoMedio },
  coberturaOk: { color: C.ok },
  coberturaParcial: { color: C.alerta },
  faltantes: {
    fontSize: 11.5, color: C.suave, marginTop: E[2], fontFamily: F.cuerpo, lineHeight: 17,
  },
  notaAhorro: { fontSize: 12.5, color: C.texto, marginTop: E[2], fontFamily: F.cuerpo },

  sustitutos: { marginTop: E[2], paddingTop: E[2], borderTopWidth: 1, borderTopColor: C.borde },
  sustituto: { fontSize: 11.5, color: C.texto, fontFamily: F.cuerpo, lineHeight: 17 },
  sustitutoEtiqueta: { color: C.ok, fontFamily: F.cuerpoMedio },
  sustitutoUnidad: { color: C.acentoFuerte, fontFamily: F.cuerpoMedio },

  punteado: { height: 1, backgroundColor: C.borde, marginTop: E[3], marginBottom: E[1] },
  filaItem: { flexDirection: 'row', alignItems: 'center', marginTop: E[2], gap: E[2] },
  itemDesc: { flex: 1, fontSize: 12, color: C.suave, fontFamily: F.cuerpo },
  itemPrecio: { fontSize: 12.5, color: C.texto, fontFamily: F.cuerpoFuerte },

  // — ofertas —
  tarjetaOferta: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: C.tarjeta,
    borderRadius: R.lg, padding: E[3], marginBottom: E[2],
  },
  filaPrecios: { flexDirection: 'row', alignItems: 'baseline', gap: E[2], marginTop: E[1] },
  precioOferta: { fontSize: 18, color: C.ok, fontFamily: F.cuerpoFuerte },
  precioTachado: {
    fontSize: 12.5, color: C.suave, fontFamily: F.cuerpo, textDecorationLine: 'line-through',
  },
  porUnidad: { fontSize: 11.5, color: C.acentoFuerte, fontFamily: F.cuerpoMedio },
  selloDescuento: {
    backgroundColor: C.acento, borderRadius: R.pill, paddingHorizontal: E[2],
    paddingVertical: 5, marginLeft: E[2],
  },
  selloDescuentoTexto: { color: C.fondo, fontFamily: F.cuerpoFuerte, fontSize: 13 },

  pie: {
    fontSize: 11, color: C.suave, textAlign: 'center', marginTop: E[6],
    lineHeight: 16, fontFamily: F.cuerpo,
  },
});
