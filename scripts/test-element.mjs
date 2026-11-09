// The component, site, snippet and slot tests again, on the plain custom elements that
// `--emit element` writes (dist/elements/), with ZUBRA_UI_EMIT=element set however the shell spells it.
import { spawnSync } from 'node:child_process';
const result = spawnSync(process.execPath, ['--test', 'test/components.test.js', 'test/site.test.js', 'test/snippets.test.js', 'test/slots.test.js'], { stdio: 'inherit', env: { ...process.env, ZUBRA_UI_EMIT: 'element' } });
process.exit(result.status ?? 1);
