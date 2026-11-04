import { readFileSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
let size = 0;
let input = '';
let prefix = '';
for (let index = 0; index < args.length; index += 1) {
  if (args[index] === '-b') {
    size = Number(args[index + 1]);
    index += 1;
  } else if (args[index] === '-a') {
    index += 1;
  } else if (!args[index].startsWith('-') && input === '') {
    input = args[index];
  } else if (!args[index].startsWith('-')) {
    prefix = args[index];
  }
}
if (!Number.isInteger(size) || size <= 0 || input === '' || prefix === '') {
  throw new Error('fake split expects -b BYTES [-d] [-a 3] INPUT PREFIX');
}
const content = readFileSync(input);
for (let offset = 0, part = 0; offset < content.length; offset += size, part += 1) {
  writeFileSync(`${prefix}${String(part).padStart(3, '0')}`, content.subarray(offset, offset + size));
}
