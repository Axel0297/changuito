/**
 * Genera el dataset del dia y lo publica como archivo adjunto de una release.
 *
 * Por que aca y no en GitHub Actions: el portal de datos abiertos **bloquea por
 * IP** a los runners (403 desde Azure/EE.UU., con y sin User-Agent, incluso en
 * su pagina raiz). Desde una conexion argentina responde normal. Asi que el ETL
 * tiene que correr en una maquina de aca; lo unico que viaja a GitHub es el
 * resultado ya recortado.
 *
 * Se publican dos archivos:
 *   version.json   unos pocos bytes con la fecha de los datos
 *   dataset.json   los precios (~10 MB)
 *
 * La app pide primero version.json y solo baja el dataset si hay algo mas
 * nuevo. Sin esa separacion se bajarian 10 MB cada vez que se abre la app.
 *
 * Uso:  npm run publicar
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const PUBLICO = path.join(ROOT, 'publico');
const TAG = 'dataset';

// gh portable, descargado por no tener el CLI instalado a nivel sistema.
const GH = path.join(ROOT, '.herramientas', 'bin', 'gh.exe');

const log = (...a) => console.log('[publicar]', ...a);

function gh(args, opciones = {}) {
  return execFileSync(GH, args, {
    encoding: 'utf8',
    env: { ...process.env, GH_PAGER: 'cat' },
    ...opciones,
  });
}

function repoActual() {
  const salida = gh(['repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner']);
  return salida.trim();
}

function main() {
  if (!fs.existsSync(GH)) {
    throw new Error(
      'No encuentro gh en .herramientas/bin/gh.exe.\n' +
        '  Descargalo de https://github.com/cli/cli/releases y descomprimilo ahi.'
    );
  }

  const repo = repoActual();
  log('repo: ' + repo);

  // 1. Generar el dataset con el ETL de siempre.
  fs.mkdirSync(PUBLICO, { recursive: true });
  const salida = path.join(PUBLICO, 'dataset.json');
  const args = ['etl/build-dataset.mjs', '--salida', salida, ...process.argv.slice(2)];
  log('corriendo el ETL...');
  execFileSync(process.execPath, args, { cwd: ROOT, stdio: 'inherit' });

  const dataset = JSON.parse(fs.readFileSync(salida, 'utf8'));

  // 2. Chequeo de cordura: mejor no publicar nada que publicar algo vacio
  //    encima de un dataset que funcionaba.
  const sano =
    dataset.sucursales?.length > 0 &&
    dataset.productos?.length > 1000 &&
    dataset.precios?.length > 1000;
  if (!sano) {
    throw new Error(
      `El dataset salio sospechoso (${dataset.sucursales?.length} sucursales, ` +
        `${dataset.productos?.length} productos). No se publica.`
    );
  }

  // 3. El archivito de version, que es lo que la app consulta a cada rato.
  const version = {
    fecha_datos: dataset.fecha_datos,
    generado: dataset.generado,
    centro: dataset.centro.nombre,
    sucursales: dataset.sucursales.length,
    productos: dataset.productos.length,
    precios: dataset.precios.length,
  };
  const versionPath = path.join(PUBLICO, 'version.json');
  fs.writeFileSync(versionPath, JSON.stringify(version, null, 2));

  // 4. La release existe una sola vez y se le reemplazan los adjuntos.
  try {
    gh(['release', 'view', TAG], { stdio: 'pipe' });
    log('actualizando la release "' + TAG + '"');
  } catch {
    log('creando la release "' + TAG + '"');
    gh([
      'release', 'create', TAG,
      '--title', 'Dataset de precios',
      '--notes', 'Datos de SEPA recortados a la zona. Se actualiza con `npm run publicar`.',
    ]);
  }

  log('subiendo archivos...');
  gh(['release', 'upload', TAG, salida, versionPath, '--clobber']);

  const base = `https://github.com/${repo}/releases/latest/download`;
  log('---');
  log(`datos del ${version.fecha_datos}: ${version.sucursales} sucursales, ` +
      `${version.productos.toLocaleString('es-AR')} productos`);
  log('version: ' + base + '/version.json');
  log('dataset: ' + base + '/dataset.json');
}

try {
  main();
} catch (e) {
  console.error('[publicar] fallo:', e.message || e);
  process.exit(1);
}
