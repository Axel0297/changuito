/**
 * Compila el APK.
 *
 * Existe solo para poner EAS_NO_VCS=1, y eso tiene una razon concreta: el
 * dataset (`assets/dataset.json`, ~8 MB que se regeneran a diario) esta en el
 * .gitignore, pero la app lo necesita dentro del bundle.
 *
 * Cuando el proyecto no era un repo git, EAS empaquetaba los archivos del
 * directorio respetando .easignore y el dataset entraba. Apenas se creo el
 * repo, EAS paso a armar el paquete desde git, y ahi el dataset dejo de
 * viajar: .easignore puede *sacar* archivos, pero no puede *meter* uno que git
 * ignora. El build fallaba con "Unable to resolve module ../assets/dataset.json".
 *
 * Con EAS_NO_VCS=1 se vuelve al empaquetado por directorio y el dataset entra.
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = path.resolve(import.meta.dirname, '..');
const DATASET = path.join(RAIZ, 'assets', 'dataset.json');

if (!fs.existsSync(DATASET)) {
  console.error(
    'Falta assets/dataset.json, que es lo que la app trae de fabrica.\n' +
      '  Generalo con:  npm run movil        (desde la raiz del repo)'
  );
  process.exit(1);
}

const mb = (fs.statSync(DATASET).size / 1048576).toFixed(1);
console.log(`dataset presente: ${mb} MB`);

const extra = process.argv.slice(2).join(' ');
execSync(
  `npx eas-cli build --platform android --profile preview ${extra}`.trim(),
  { cwd: RAIZ, stdio: 'inherit', env: { ...process.env, EAS_NO_VCS: '1' }, shell: true }
);
