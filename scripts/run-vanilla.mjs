// The component and site tests again, on the L5 spike's plain elements (dist/vanilla/), with
// ZUBRA_UI_EMIT=vanilla set however the shell spells it.
import { spawnSync } from 'node:child_process';
const result = spawnSync(process.execPath, ['--test', 'test/components.test.js', 'test/site.test.js', 'test/snippets.test.js', 'test/slots.test.js'], { stdio: 'inherit', env: { ...process.env, ZUBRA_UI_EMIT: 'vanilla' } });
process.exit(result.status ?? 1);
