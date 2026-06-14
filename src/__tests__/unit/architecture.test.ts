import fs from 'fs';
import path from 'path';

const SRC = path.resolve(__dirname, '../../');

type Layer = 'controller' | 'service' | 'repository' | 'model' | 'routes' | 'middleware' | 'client' | 'config' | 'other';

interface FileInfo {
  filePath: string;
  relativePath: string;
  layer: Layer;
  imports: string[];
}

const LAYER_PATTERNS: [RegExp, Layer][] = [
  [/\.controller\.ts$/, 'controller'],
  [/\.service\.ts$/, 'service'],
  [/\.repository\.ts$/, 'repository'],
  [/\.model\.ts$/, 'model'],
  [/\.routes\.ts$/, 'routes'],
  [/\.middleware\.ts$/, 'middleware'],
  [/\.client\.ts$/, 'client'],
];

const detectLayer = (filePath: string): Layer => {
  for (const [pattern, layer] of LAYER_PATTERNS) {
    if (pattern.test(filePath)) return layer;
  }
  const basename = path.basename(filePath);
  if (basename === 'app.ts' || basename === 'index.ts') return 'config';
  if (filePath.includes('/config/') || filePath.includes('\\config\\')) return 'config';
  if (filePath.includes('/dto/') || filePath.includes('\\dto\\')) return 'other';
  if (filePath.includes('/__tests__/') || filePath.includes('\\__tests__\\')) return 'other';
  if (filePath.includes('/docs/') || filePath.includes('\\docs\\')) return 'other';
  if (filePath.includes('/scripts/') || filePath.includes('\\scripts\\')) return 'other';
  return 'other';
};

const FORBIDDEN_IMPORTS: Record<Layer, Layer[]> = {
  controller: ['repository', 'model'],
  service: ['controller', 'routes', 'middleware'],
  repository: ['controller', 'service', 'routes', 'middleware'],
  model: ['controller', 'service', 'repository', 'routes', 'middleware', 'client'],
  routes: ['service', 'repository', 'model', 'client'],
  middleware: ['repository', 'model'],
  client: ['controller', 'routes', 'middleware'],
  config: [],
  other: [],
};

const importRegex = /from\s+['"](\..*?)['"]/g;

const resolveTargetLayer = (importPath: string, sourceDir: string): Layer | null => {
  const resolved = path.resolve(sourceDir, importPath);
  if (!resolved.endsWith('.ts') && !resolved.endsWith('.js')) {
    const candidates = ['.ts', '.js', '/index.ts', '/index.js']
      .map(ext => resolved + ext)
      .find(p => fs.existsSync(p));
    if (!candidates) return null;
    return detectLayer(candidates);
  }
  return detectLayer(resolved);
};

const collectFiles = (dir: string): string[] => {
  const result: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules') result.push(...collectFiles(full));
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
      result.push(full);
    }
  }
  return result;
};

describe('Architecture', () => {
  const allFiles = collectFiles(SRC).filter(f => !f.includes('__tests__'));
  const fileInfos: FileInfo[] = allFiles.map(fp => {
    const content = fs.readFileSync(fp, 'utf-8');
    const imports: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }
    return {
      filePath: fp,
      relativePath: path.relative(SRC, fp),
      layer: detectLayer(fp),
      imports,
    };
  });

  describe('naming conventions', () => {
    const moduleFiles = fileInfos.filter(f =>
      f.relativePath.startsWith('modules') &&
      f.layer !== 'other'
    );

    const namingFiles = moduleFiles.filter(f => path.basename(f.relativePath) !== 'index.ts');
    it.each(namingFiles)('$relativePath follows feature.layer.ts naming', ({ relativePath, layer }) => {
      const basename = path.basename(relativePath);
      expect(basename).toMatch(new RegExp(`^[a-z][a-z0-9-]*\\.${layer}\\.ts$`));
    });
  });

  describe('layering rules', () => {
    const checkImports = (fi: FileInfo): string[] => {
      const violations: string[] = [];
      const sourceDir = path.dirname(fi.filePath);
      const forbidden = FORBIDDEN_IMPORTS[fi.layer];

      for (const imp of fi.imports) {
        const targetLayer = resolveTargetLayer(imp, sourceDir);
        if (targetLayer && forbidden.includes(targetLayer)) {
          violations.push(
            `${fi.relativePath} imports from ${targetLayer} (${imp}) — forbidden for ${fi.layer} layer`
          );
        }
      }
      return violations;
    };

    const violations = fileInfos.flatMap(fi => checkImports(fi));

    it('no controller imports repository or model directly', () => {
      const ctrlViolations = violations.filter(v => v.includes('controller') && (v.includes('repository') || v.includes('model')));
      expect(ctrlViolations).toEqual([]);
    });

    it('no service imports controller, routes or middleware', () => {
      const svcViolations = violations.filter(v => v.includes('service'));
      expect(svcViolations).toEqual([]);
    });

    it('no repository imports controller, service, routes or middleware', () => {
      const repoViolations = violations.filter(v => v.includes('repository'));
      expect(repoViolations).toEqual([]);
    });

    it('no routes imports service, repository, model or client', () => {
      const routesViolations = violations.filter(v => v.includes('routes'));
      expect(routesViolations).toEqual([]);
    });

    it('no model imports any application layer', () => {
      const modelViolations = violations.filter(v => v.includes('model'));
      expect(modelViolations).toEqual([]);
    });
  });

  describe('no default exports in service / repository / model files', () => {
    const checkedFiles = fileInfos.filter(f =>
      f.relativePath.startsWith('modules') &&
      !f.relativePath.includes('__tests__') &&
      (f.layer === 'service' || f.layer === 'repository' || f.layer === 'model' || f.layer === 'controller' || f.layer === 'middleware')
    );

    it.each(checkedFiles)('$relativePath uses named exports only', ({ filePath }) => {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n').map(l => l.trim());
      const hasDefaultExport = lines.some(l =>
        /^export\s+default\s/.test(l) || /^export\s*\{[^}]*\bdefault\b[^}]*\}/.test(l)
      );
      expect(hasDefaultExport).toBe(false);
    });
  });
});
