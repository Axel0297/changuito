/**
 * Tokens del sistema de diseño **Organic** (claude.ai/design), traducidos a
 * React Native.
 *
 * Organic es cálido y redondeado: fondo crema, superficies arena, acento
 * terracota y un segundo acento salvia, con rampas tonales de 100 a 900
 * generadas sobre una misma escala perceptual. Controles en pill (999) y
 * contenedores muy redondeados.
 *
 * Los nombres viejos (fondo, texto, acento…) se conservan para no renombrar
 * media app; lo que cambia es a qué token de Organic apunta cada uno.
 */

/** Rampas tal cual vienen del sistema. */
export const RAMPA = {
  neutral: {
    100: '#f9f4ed', 200: '#eee7db', 300: '#dcd3c4', 400: '#c0b6a5', 500: '#a19786',
    600: '#82796a', 700: '#645c50', 800: '#474238', 900: '#2e2b25',
  },
  // Terracota: el acento de marca.
  acento: {
    100: '#fff2eb', 200: '#ffe1d0', 300: '#ffc6a5', 400: '#f6a06b', 500: '#d67f48',
    600: '#b2622d', 700: '#8c491a', 800: '#643312', 900: '#402310',
  },
  // Salvia: el segundo acento, que acá hace de "esto conviene".
  salvia: {
    100: '#f0fae1', 200: '#e1eecc', 300: '#ccdbb2', 400: '#aebf92', 500: '#8fa073',
    600: '#728157', 700: '#56633f', 800: '#3d472b', 900: '#272e1b',
  },
};

export const C = {
  fondo: '#f5ead8',
  /** En Organic la superficie es mas oscura que el fondo, no mas clara. */
  tarjeta: '#ebddc5',
  texto: '#201e1d',
  suave: RAMPA.neutral[600],
  borde: 'rgba(32, 30, 29, 0.16)',

  /** Terracota: acciones, marca, sellos de descuento. */
  acento: '#c67139',
  acentoSuave: RAMPA.acento[100],
  acentoFuerte: RAMPA.acento[700],

  /**
   * Salvia: lo barato, lo que conviene. Para texto se usa el paso 700, porque
   * el salvia base sobre este fondo no llega a contraste de lectura.
   */
  ok: RAMPA.salvia[700],
  okBase: '#7a8a5e',
  okSuave: RAMPA.salvia[100],

  /** Lo que falta o encarece. */
  alerta: RAMPA.acento[700],
  alertaSuave: RAMPA.acento[200],

  mostaza: RAMPA.acento[600],
  mostazaSuave: RAMPA.acento[100],
  sombra: RAMPA.neutral[900],
};

/** Colores de las etiquetas ilustradas, tomados de las rampas del sistema. */
export const COLORES_ETIQUETA = [
  '#c67139',
  RAMPA.salvia[600],
  RAMPA.acento[600],
  RAMPA.salvia[700],
  RAMPA.acento[800],
  RAMPA.neutral[700],
];

/** Escala de espaciado de Organic (densidad 1.10). */
export const E = {
  1: 4.4,
  2: 8.8,
  3: 13.2,
  4: 17.6,
  6: 26.4,
  8: 35.2,
};

/** Radios. Los controles chicos van en pill; los contenedores, muy redondeados. */
export const R = {
  sm: 8,
  md: 16,
  lg: 28,
  /** tarjetas y diálogos: lg * 1.15 */
  contenedor: 32,
  pill: 999,
};

/** Elevación, ya tonalizada contra el fondo cálido. */
export const SOMBRA = {
  sm: {
    shadowColor: RAMPA.neutral[900],
    shadowOpacity: 0.14,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  md: {
    shadowColor: RAMPA.neutral[900],
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  lg: {
    shadowColor: RAMPA.neutral[900],
    shadowOpacity: 0.22,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
};

export const F = {
  titulo: 'Caprasimo_400Regular',
  cuerpo: 'Figtree_400Regular',
  cuerpoMedio: 'Figtree_600SemiBold',
  cuerpoFuerte: 'Figtree_700Bold',
};
