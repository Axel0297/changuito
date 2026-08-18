/**
 * Compila el APK.
 *
 * Chequea antes de gastar 15 minutos de cola que el dataset este generado Y
 * versionado, porque las dos cosas hacen falta:
 *
 * EAS arma el paquete del build desde git. Si `assets/dataset.json` no esta
 * commiteado, no viaja, y el build muere recien en la fase de bundling con
 * "Unable to resolve module ../assets/dataset.json". Ni .easignore ni
 * EAS_NO_VCS alcanzan para meter un archivo que git no tiene: se probaron los
 * dos y fallaron igual. La unica forma es versionarlo.
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

// Que exista en disco no alcanza: tiene que estar en git o no llega al build.
const seguimiento = execSync('git ls-files --error-unmatch assets/dataset.json', {
  cwd: RAIZ, stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf8',
}).trim();
if (!seguimiento) {
  console.error('assets/dataset.json existe pero no esta versionado: el build no lo va a recibir.');
  process.exit(1);
}

const pendiente = execSync('git status --porcelain assets/dataset.json', {
  cwd: RAIZ, encoding: 'utf8',
}).trim();
if (pendiente) {
  console.error(
    `El dataset cambio y no esta commiteado (${pendiente}).
` +
      '  El build usa lo que hay en git, asi que compilarias con el dataset viejo.
' +
      '  Correlo:  git add movil/assets/dataset.json && git commit -m "Actualizar dataset"'
  );
  process.exit(1);
}

console.log(`dataset presente y versionado: ${mb} MB`);

const extra = process.argv.slice(2).join(' ');
execSync(
  `npx eas-cli build --platform android --profile preview ${extra}`.trim(),
  { cwd: RAIZ, stdio: 'inherit', shell: true }
);
