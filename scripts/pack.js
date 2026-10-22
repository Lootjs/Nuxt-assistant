// Builds dist/nuxt-assistant-<version>.zip for the Chrome Web Store from the extension files only
// (no package.json, tests or node_modules). Uses no dependencies: the zip is written with node:zlib.
import { readFileSync, readdirSync, mkdirSync, writeFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { crc32, deflateRawSync } from 'node:zlib';

const root = join(import.meta.dirname, '..');

const EXTENSION_FILES = [
    'manifest.json',
    'background.js',
    'nuxt-assistant.html',
    'nuxt-assistant.js',
    'nuxt-assistant-panel.html',
    'nuxt-assistant-panel.css',
    'images',
    'src',
];

function collectFiles(path) {
    if (!statSync(path).isDirectory()) {
        return [path];
    }

    return readdirSync(path).sort().flatMap(name => collectFiles(join(path, name)));
}

function dosDateTime(date) {
    return {
        time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
        date: ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
    };
}

function createZip(entries) {
    const localParts = [];
    const centralParts = [];
    let offset = 0;
    const { time, date } = dosDateTime(new Date());

    for (const { name, data } of entries) {
        const nameBuffer = Buffer.from(name, 'utf8');
        const compressed = deflateRawSync(data, { level: 9 });
        const checksum = crc32(data);

        const local = Buffer.alloc(30);
        local.writeUInt32LE(0x04034b50, 0); // local file header signature
        local.writeUInt16LE(20, 4); // version needed to extract
        local.writeUInt16LE(0x0800, 6); // flags: UTF-8 file names
        local.writeUInt16LE(8, 8); // compression: deflate
        local.writeUInt16LE(time, 10);
        local.writeUInt16LE(date, 12);
        local.writeUInt32LE(checksum, 14);
        local.writeUInt32LE(compressed.length, 18);
        local.writeUInt32LE(data.length, 22);
        local.writeUInt16LE(nameBuffer.length, 26);
        local.writeUInt16LE(0, 28); // extra field length

        const central = Buffer.alloc(46);
        central.writeUInt32LE(0x02014b50, 0); // central directory header signature
        central.writeUInt16LE(20, 4); // version made by
        central.writeUInt16LE(20, 6); // version needed to extract
        central.writeUInt16LE(0x0800, 8);
        central.writeUInt16LE(8, 10);
        central.writeUInt16LE(time, 12);
        central.writeUInt16LE(date, 14);
        central.writeUInt32LE(checksum, 16);
        central.writeUInt32LE(compressed.length, 20);
        central.writeUInt32LE(data.length, 24);
        central.writeUInt16LE(nameBuffer.length, 28);
        // extra length, comment length, disk number, internal and external attributes stay 0
        central.writeUInt32LE(offset, 42);

        localParts.push(local, nameBuffer, compressed);
        centralParts.push(central, nameBuffer);
        offset += local.length + nameBuffer.length + compressed.length;
    }

    const centralDirectory = Buffer.concat(centralParts);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0); // end of central directory signature
    end.writeUInt16LE(entries.length, 8);
    end.writeUInt16LE(entries.length, 10);
    end.writeUInt32LE(centralDirectory.length, 12);
    end.writeUInt32LE(offset, 16);

    return Buffer.concat([...localParts, centralDirectory, end]);
}

const entries = EXTENSION_FILES
    .flatMap(file => collectFiles(join(root, file)))
    .map(path => ({ name: relative(root, path).split(sep).join('/'), data: readFileSync(path) }));

const { version } = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
const outputDir = join(root, 'dist');
const outputPath = join(outputDir, `nuxt-assistant-${version}.zip`);

mkdirSync(outputDir, { recursive: true });
writeFileSync(outputPath, createZip(entries));

console.log(`${relative(root, outputPath)}: ${entries.length} files`);
entries.forEach(({ name }) => console.log(`  ${name}`));
