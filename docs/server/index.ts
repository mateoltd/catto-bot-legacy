import express from 'express';
import cors from 'cors';
import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, resolve, relative, normalize, sep } from 'path';

const app = express();
const PORT = 3001;

// Project root is two levels up from docs/server
const PROJECT_ROOT = resolve(import.meta.dirname, '../..');

// Security configuration - block patterns from .gitignore + sensitive files
const BLOCKED_PATTERNS = [
  // From .gitignore
  'node_modules',
  '.git',
  'dist/',
  '.env',
  '*.log',
  'coverage',
  '.nyc_output',
  '.turbo',
  '.vercel',
  '.next',
  // Sensitive patterns
  'secrets',
  'credentials',
  '.pem',
  '.key',
  '.secret',
  'password',
  'token',
  // Build artifacts
  '.vitepress/cache',
  '.vitepress/dist',
];
const MAX_FILE_SIZE = 500 * 1024; // 500KB

// Middleware
app.use(express.json());
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://127.0.0.1:5173', 'http://127.0.0.1:5174'],
  methods: ['GET', 'POST'],
}));

// Resolve a relative path to an absolute path within project root
// Returns null if the path escapes the project root
function resolveSafePath(relativePath: string): string | null {
  // First, reject obvious traversal attempts
  if (relativePath.includes('..') || relativePath.includes('\0')) {
    return null;
  }

  // Block absolute paths in the input
  if (relativePath.startsWith('/') || /^[a-zA-Z]:/.test(relativePath)) {
    return null;
  }

  // Resolve to absolute path
  const absolutePath = resolve(PROJECT_ROOT, relativePath);

  // Critical: Verify the resolved path is still within PROJECT_ROOT
  // This catches any edge cases that bypass the string checks above
  const normalizedRoot = resolve(PROJECT_ROOT) + sep;
  const normalizedPath = resolve(absolutePath);

  if (!normalizedPath.startsWith(normalizedRoot) && normalizedPath !== resolve(PROJECT_ROOT)) {
    return null;
  }

  return absolutePath;
}

// Security: Validate path is safe to access
function isPathSafe(requestedPath: string): { safe: boolean; reason?: string; absolutePath?: string } {
  // Resolve and validate containment
  const absolutePath = resolveSafePath(requestedPath);
  if (!absolutePath) {
    return { safe: false, reason: 'Invalid path or path traversal attempt' };
  }

  // Check for blocked patterns (from .gitignore + sensitive files)
  const normalizedForCheck = requestedPath.toLowerCase().replace(/\\/g, '/');
  for (const pattern of BLOCKED_PATTERNS) {
    // Handle glob patterns like *.log
    if (pattern.startsWith('*.')) {
      const ext = pattern.slice(1).toLowerCase();
      if (normalizedForCheck.endsWith(ext)) {
        return { safe: false, reason: `Access to '${pattern}' files is blocked` };
      }
    } else if (normalizedForCheck.includes(pattern.toLowerCase())) {
      return { safe: false, reason: `Access to '${pattern}' is blocked` };
    }
  }

  return { safe: true, absolutePath };
}

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Read file endpoint
app.post('/api/read', (req, res) => {
  try {
    const { path: filePath, startLine, endLine } = req.body;

    if (!filePath || typeof filePath !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid path' });
    }

    const pathCheck = isPathSafe(filePath);
    if (!pathCheck.safe || !pathCheck.absolutePath) {
      return res.status(403).json({ error: pathCheck.reason });
    }

    const absolutePath = pathCheck.absolutePath;

    if (!existsSync(absolutePath)) {
      return res.status(404).json({ error: `File not found: ${filePath}` });
    }

    const stats = statSync(absolutePath);

    if (!stats.isFile()) {
      return res.status(400).json({ error: 'Path is not a file' });
    }

    if (stats.size > MAX_FILE_SIZE) {
      return res.status(413).json({ error: `File too large (max ${MAX_FILE_SIZE / 1024}KB)` });
    }

    let content = readFileSync(absolutePath, 'utf-8');

    // Apply line range if specified
    if (startLine !== undefined || endLine !== undefined) {
      const lines = content.split('\n');
      const start = Math.max(0, (startLine || 1) - 1);
      const end = endLine ? Math.min(lines.length, endLine) : lines.length;
      content = lines.slice(start, end).join('\n');
    }

    res.json({
      path: filePath,
      content,
      lines: content.split('\n').length,
    });
  } catch (error) {
    console.error('Read error:', error);
    res.status(500).json({ error: 'Failed to read file' });
  }
});

// List directory endpoint
app.post('/api/list', (req, res) => {
  try {
    const { path: dirPath } = req.body;

    if (!dirPath || typeof dirPath !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid path' });
    }

    const pathCheck = isPathSafe(dirPath);
    if (!pathCheck.safe || !pathCheck.absolutePath) {
      return res.status(403).json({ error: pathCheck.reason });
    }

    const absolutePath = pathCheck.absolutePath;

    if (!existsSync(absolutePath)) {
      return res.status(404).json({ error: `Directory not found: ${dirPath}` });
    }

    const stats = statSync(absolutePath);

    if (!stats.isDirectory()) {
      return res.status(400).json({ error: 'Path is not a directory' });
    }

    const entries = readdirSync(absolutePath, { withFileTypes: true });
    const files: Array<{ name: string; type: 'file' | 'directory'; size?: number }> = [];

    for (const entry of entries) {
      // Skip hidden files and blocked patterns
      if (entry.name.startsWith('.')) continue;

      const entryPath = join(dirPath, entry.name).replace(/\\/g, '/');
      const entryCheck = isPathSafe(entryPath);
      if (!entryCheck.safe || !entryCheck.absolutePath) continue;

      if (entry.isDirectory()) {
        files.push({ name: entry.name + '/', type: 'directory' });
      } else if (entry.isFile()) {
        const entryStats = statSync(join(absolutePath, entry.name));
        files.push({ name: entry.name, type: 'file', size: entryStats.size });
      }
    }

    // Sort: directories first, then files, alphabetically
    files.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    res.json({
      path: dirPath,
      entries: files,
      count: files.length,
    });
  } catch (error) {
    console.error('List error:', error);
    res.status(500).json({ error: 'Failed to list directory' });
  }
});

// Search code endpoint
app.post('/api/search', (req, res) => {
  try {
    const { query, filePattern, maxResults = 50 } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid query' });
    }

    const results: Array<{
      path: string;
      line: number;
      content: string;
      context: string;
    }> = [];

    const searchRegex = new RegExp(escapeRegex(query), 'gi');

    // Search recursively in directories
    function searchDirectory(dir: string) {
      const pathCheck = isPathSafe(dir);
      if (!pathCheck.safe || !pathCheck.absolutePath) return;

      const absolutePath = pathCheck.absolutePath;
      if (!existsSync(absolutePath)) return;

      try {
        const entries = readdirSync(absolutePath, { withFileTypes: true });

        for (const entry of entries) {
          if (results.length >= maxResults) return;
          if (entry.name.startsWith('.')) continue;

          const entryPath = join(dir, entry.name).replace(/\\/g, '/');
          const entryCheck = isPathSafe(entryPath);
          if (!entryCheck.safe || !entryCheck.absolutePath) continue;

          if (entry.isDirectory()) {
            searchDirectory(entryPath);
          } else if (entry.isFile()) {
            // Check file pattern if specified
            if (filePattern) {
              const pattern = filePattern.replace('*', '.*');
              if (!new RegExp(pattern + '$', 'i').test(entry.name)) continue;
            }

            // Only search text files
            const ext = entry.name.split('.').pop()?.toLowerCase();
            const textExtensions = ['ts', 'js', 'tsx', 'jsx', 'json', 'md', 'vue', 'css', 'html', 'prisma', 'yaml', 'yml'];
            if (!ext || !textExtensions.includes(ext)) continue;

            const fullPath = join(absolutePath, entry.name);
            const stats = statSync(fullPath);
            if (stats.size > MAX_FILE_SIZE) continue;

            try {
              const content = readFileSync(fullPath, 'utf-8');
              const lines = content.split('\n');

              for (let i = 0; i < lines.length && results.length < maxResults; i++) {
                if (searchRegex.test(lines[i])) {
                  // Get context (line before and after)
                  const contextStart = Math.max(0, i - 1);
                  const contextEnd = Math.min(lines.length, i + 2);
                  const context = lines.slice(contextStart, contextEnd).join('\n');

                  results.push({
                    path: entryPath,
                    line: i + 1,
                    content: lines[i].trim(),
                    context,
                  });

                  // Reset regex lastIndex for global flag
                  searchRegex.lastIndex = 0;
                }
              }
            } catch {
              // Skip files that can't be read
            }
          }
        }
      } catch {
        // Skip directories that can't be read
      }
    }

    // Search in common source directories
    const searchDirs = ['src', 'docs', 'prisma', 'scripts'];
    for (const dir of searchDirs) {
      if (results.length >= maxResults) break;
      searchDirectory(dir);
    }

    // Also search root-level config files
    if (results.length < maxResults) {
      const rootFiles = ['package.json', 'tsconfig.json', 'eslint.config.js'];
      for (const file of rootFiles) {
        if (results.length >= maxResults) break;
        const filePath = join(PROJECT_ROOT, file);
        if (existsSync(filePath)) {
          try {
            const content = readFileSync(filePath, 'utf-8');
            const lines = content.split('\n');
            for (let i = 0; i < lines.length && results.length < maxResults; i++) {
              if (searchRegex.test(lines[i])) {
                results.push({
                  path: file,
                  line: i + 1,
                  content: lines[i].trim(),
                  context: lines.slice(Math.max(0, i - 1), Math.min(lines.length, i + 2)).join('\n'),
                });
                searchRegex.lastIndex = 0;
              }
            }
          } catch {
            // Skip files that can't be read
          }
        }
      }
    }

    res.json({
      query,
      results,
      count: results.length,
      truncated: results.length >= maxResults,
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Failed to search' });
  }
});

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

app.listen(PORT, () => {
  console.log(`Docs API server running at http://localhost:${PORT}`);
  console.log(`Serving files from: ${PROJECT_ROOT}`);
});
