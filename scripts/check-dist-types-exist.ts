import { existsSync } from 'fs';
import { join } from 'path';

const typeFile = join(process.cwd(), 'index.d.ts');

if (!existsSync(typeFile)) {
	console.error(`Error: Type declaration file not found at ${typeFile}`);
	process.exit(1);
}
