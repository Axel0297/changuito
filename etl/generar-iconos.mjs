/**
 * Genera los iconos de la app: una tiendita de barrio con toldo a rayas.
 *
 * Se dibuja en SVG y se rasteriza con sharp. Android pide varias piezas
 * distintas (fondo y frente separados para el icono adaptativo, mas una
 * silueta monocroma para los temas del sistema), asi que sale todo del mismo
 * dibujo con opciones.
 *
 * Uso:  node etl/generar-iconos.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const SALIDA = path.resolve(import.meta.dirname, '../movil/assets');

const C = {
  papel: '#f2e7d3',
  claro: '#fdf7ea',
  tinta: '#3b2a1e',
  teja: '#a8432c',
  oliva: '#5f7043',
  mostaza: '#c08a2e',
};

/**
 * El borde festoneado del toldo, que es lo que hace que se lea como tienda y
 * no como una casa. Ocho arcos de izquierda a derecha.
 */
function festones(x1, x2, y, cantidad) {
  const ancho = (x2 - x1) / cantidad;
  const r = ancho / 2;
  let d = `M ${x2} ${y}`;
  for (let i = 0; i < cantidad; i++) {
    d += ` a ${r} ${r} 0 0 1 ${-ancho} 0`;
  }
  return d;
}

/**
 * Donde vive el dibujo dentro del lienzo de 512. Se usa para centrarlo: el
 * dibujo no esta en el medio del viewBox (la vereda baja mas que lo que sube el
 * toldo), asi que escalar sin corregir lo deja corrido hacia abajo.
 */
const BBOX = { x: 88, y: 164, ancho: 336, alto: 296 };

/**
 * @param conFondo   pinta el fondo crema (icono suelto); sin el, transparente
 * @param monocromo  todo en un solo color, para el icono temático de Android
 * @param objetivo   cuantos px del lienzo de 512 debe ocupar el dibujo
 */
function svgTienda({ conFondo = true, monocromo = false, objetivo = 400 } = {}) {
  // En monocromo no alcanza con recolorear todo de negro: sale una mancha
  // ilegible. Lo que se lee es el contraste entre relleno y vacio, asi que las
  // superficies grandes (fachada, puerta) quedan huecas y solo se rellenan las
  // partes que dan la silueta: rayas del toldo, cornisa, vidriera y vereda.
  const c = monocromo
    ? {
        papel: 'none', claro: 'none', tinta: '#000',
        teja: '#000', oliva: 'none', mostaza: '#000',
      }
    : C;

  // Escalar para ocupar `objetivo` px, y correr el resultado hasta que el centro
  // del dibujo coincida con el centro del lienzo.
  const escala = objetivo / Math.max(BBOX.ancho, BBOX.alto);
  const tx = 256 - escala * (BBOX.x + BBOX.ancho / 2);
  const ty = 256 - escala * (BBOX.y + BBOX.alto / 2);
  const trazo = monocromo ? 11 : 7;

  const toldoT = 196;
  const toldoB = 262;
  const L = 88;
  const R = 424;

  const cuerpo = `
    <!-- fachada -->
    <rect x="108" y="${toldoB}" width="296" height="178" rx="4"
          fill="${c.claro}" stroke="${c.tinta}" stroke-width="${trazo}"/>

    <!-- vidriera -->
    <rect x="142" y="308" width="112" height="98" rx="3"
          fill="${monocromo ? "#000" : c.tinta}" stroke="${c.tinta}" stroke-width="${trazo}"/>
    ${
      monocromo
        ? ''
        : `<path d="M 152 396 L 244 318" stroke="${c.claro}" stroke-width="9" opacity="0.5"/>
           <path d="M 178 400 L 250 338" stroke="${c.claro}" stroke-width="6" opacity="0.35"/>`
    }

    <!-- puerta -->
    <path d="M 284 440 L 284 350 a 44 44 0 0 1 88 0 L 372 440 Z"
          fill="${c.oliva}" stroke="${c.tinta}" stroke-width="${trazo}"/>
    ${monocromo ? '' : `<circle cx="296" cy="382" r="7" fill="${c.mostaza}"/>`}

    <!-- vereda -->
    <rect x="88" y="440" width="336" height="20" rx="6"
          fill="${c.mostaza}" stroke="${c.tinta}" stroke-width="${trazo}"/>

    <!-- cornisa -->
    <rect x="88" y="164" width="336" height="34" rx="6"
          fill="${c.mostaza}" stroke="${c.tinta}" stroke-width="${trazo}"/>

    <!-- toldo a rayas con borde festoneado -->
    <defs>
      <clipPath id="toldo">
        <path d="M ${L} ${toldoT} L ${R} ${toldoT} L ${R} ${toldoB}
                 ${festones(L, R, toldoB, 8).replace(/^M [\d.]+ [\d.]+/, '')} Z"/>
      </clipPath>
    </defs>
    <g clip-path="url(#toldo)">
      <rect x="${L}" y="${toldoT}" width="${R - L}" height="90" fill="${monocromo ? 'none' : c.claro}"/>
      ${Array.from({ length: 4 }, (_, i) => {
        const w = (R - L) / 8;
        return `<rect x="${L + i * 2 * w}" y="${toldoT}" width="${w}" height="90" fill="${c.teja}"/>`;
      }).join('\n      ')}
    </g>
    <path d="M ${L} ${toldoT} L ${R} ${toldoT} L ${R} ${toldoB}
             ${festones(L, R, toldoB, 8).replace(/^M [\d.]+ [\d.]+/, '')} Z"
          fill="none" stroke="${c.tinta}" stroke-width="${trazo}" stroke-linejoin="round"/>
  `;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
    ${conFondo ? `<rect width="512" height="512" rx="96" fill="${c.papel}"/>` : ''}
    <g transform="translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${escala.toFixed(4)})">
      ${cuerpo}
    </g>
  </svg>`;
}

async function png(svg, archivo, tamano) {
  const destino = path.join(SALIDA, archivo);
  await sharp(Buffer.from(svg))
    .resize(tamano, tamano)
    .png({ compressionLevel: 9 })
    .toFile(destino);
  const kb = (fs.statSync(destino).size / 1024).toFixed(0);
  console.log(`  ${archivo.padEnd(32)} ${tamano}px  ${kb} KB`);
}

async function main() {
  fs.mkdirSync(SALIDA, { recursive: true });
  console.log('Generando iconos en movil/assets:\n');

  // Icono suelto (iOS y web): dibujo completo sobre fondo crema.
  await png(svgTienda({ conFondo: true, objetivo: 392 }), 'icon.png', 1024);
  await png(svgTienda({ conFondo: true, objetivo: 392 }), 'favicon.png', 64);

  // Android adaptativo: fondo y frente separados. El frente lleva margen
  // porque el sistema recorta los bordes con la forma que tenga el launcher.
  await png(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
       <rect width="512" height="512" fill="${C.papel}"/>
     </svg>`,
    'android-icon-background.png',
    1024
  );
  await png(svgTienda({ conFondo: false, objetivo: 300 }), 'android-icon-foreground.png', 1024);
  await png(
    svgTienda({ conFondo: false, monocromo: true, objetivo: 300 }),
    'android-icon-monochrome.png',
    1024
  );

  // Splash: sin fondo, que lo pone el propio splash screen.
  await png(svgTienda({ conFondo: false, objetivo: 440 }), 'splash-icon.png', 512);

  console.log('\nlisto');
}

main().catch((e) => {
  console.error('fallo:', e);
  process.exit(1);
});
