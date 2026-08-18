/**
 * Prueba del motor de comparacion contra el dataset real.
 * Uso: node core/probar.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  crearIndice, sucursalesCercanas, buscarProductos,
  compararCarrito, formatearPesos,
} from './comparador.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const dataset = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/trelew.json'), 'utf8'));

console.time('indexado');
const indice = crearIndice(dataset);
console.timeEnd('indexado');

// Usuario parado en el centro de Trelew, dispuesto a moverse 5 km.
const cercanas = sucursalesCercanas(indice, { lat: -43.2530, lon: -65.3090, radioKm: 5 });
console.log(`\n${cercanas.length} sucursales a menos de 5 km:`);
for (const s of cercanas) {
  console.log(`  ${String(s.distancia).padStart(4)} km  ${indice.cadenaPorId.get(s.cadena).nombre.padEnd(24)}${s.direccion}`);
}

// El usuario arma su carrito buscando por texto.
const busquedas = ['leche', 'aceite girasol', 'yerba', 'fideos', 'papel higienico', 'coca cola'];
const carrito = [];
console.log('\nArmando carrito:');
for (const q of busquedas) {
  const r = buscarProductos(indice, q, { sucursales: cercanas, limite: 1 });
  if (!r.length) { console.log(`  "${q}" -> sin resultados`); continue; }
  const p = r[0];
  carrito.push({ indice: p.indice, cantidad: 1 });
  console.log(`  "${q}" -> ${p.desc} (en ${p.cadenas} cadenas)`);
}

console.time('\ncomparacion');
const res = compararCarrito(indice, carrito, cercanas);
console.timeEnd('\ncomparacion');

console.log(`\nCarrito de ${carrito.length} productos, por sucursal:\n`);
console.log('  ' + 'SUPER'.padEnd(26) + 'TIENE'.padEnd(8) + 'TOTAL'.padStart(10) + '   DIST');
console.log('  ' + '-'.repeat(56));
for (const r of res.porSucursal) {
  console.log(
    '  ' + r.cadena.nombre.padEnd(26) +
    `${r.items.length}/${carrito.length}`.padEnd(8) +
    formatearPesos(r.total).padStart(10) +
    '   ' + r.sucursal.distancia + ' km'
  );
}

const mejorCompleta = res.completas[0];
if (mejorCompleta) {
  const peorCompleta = res.completas[res.completas.length - 1];
  console.log(`\n  Con el carrito completo, el mas barato es ${mejorCompleta.cadena.nombre} (${formatearPesos(mejorCompleta.total)}).`);
  if (peorCompleta !== mejorCompleta) {
    const ahorro = peorCompleta.total - mejorCompleta.total;
    console.log(`  Ahorras ${formatearPesos(ahorro)} frente a ${peorCompleta.cadena.nombre}.`);
  }
} else {
  console.log('\n  Ninguna sucursal tiene el carrito completo.');
}

console.log(`\nCompra dividida (cada cosa donde esta mas barata): ${formatearPesos(res.dividida.total)}`);
for (const p of res.dividida.paradas) {
  console.log(`  ${p.cadena.nombre.padEnd(26)}${formatearPesos(p.total).padStart(10)}  (${p.items.length} items)`);
  for (const it of p.items) console.log(`      ${it.desc.slice(0, 46).padEnd(48)}${formatearPesos(it.precio)}`);
}
if (mejorCompleta) {
  const extra = mejorCompleta.total - res.dividida.total;
  console.log(`\n  Comprar todo en ${mejorCompleta.cadena.nombre} cuesta ${formatearPesos(extra)} mas que dividir en ${res.dividida.paradas.length} paradas.`);
}
