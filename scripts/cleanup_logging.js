const fs = require('fs');

const files = [
    'src/auth/AuthProvider.tsx',
    'src/services/auth/appleSignIn.ts',
    'src/lib/supabaseClient.ts',
    'src/lib/queries.ts',
    'src/navigation/index.tsx',
    'src/components/MiniPlayer.tsx',
    'src/theme/index.tsx',
    'src/lib/bookIdentity.ts',
    'src/screens/CommunityWisdomScreen.tsx',
    'src/screens/AuthScreen.tsx',
    'src/screens/WelcomeScreen.tsx',
    'src/screens/LibraryScreen.tsx',
    'src/screens/SupportMangalamScreen.tsx',
    'src/screens/StreaksScreen.tsx',
    'src/screens/SettingsScreen.tsx',
    'src/screens/PlayScreen.tsx',
    'src/screens/AboutScreen.tsx',
    'src/screens/HomeScreen.tsx',
    'src/screens/BookDashboardScreen.tsx',
    'src/screens/LoginScreen.tsx',
    'src/store/useAudioStore.ts'
];

files.forEach(filepath => {
    if (!fs.existsSync(filepath)) return;
    let content = fs.readFileSync(filepath, 'utf8');

    const hasConsoleLogs = /console\./.test(content);
    if (!hasConsoleLogs) return;

    // Add import statement at the top if there will be remaining logs (or just unconditionally, since unused imports aren't a big deal if we add it only where we replace, but let's be careful and only add it if we are replacing with logger)
    let needsLogger = false;

    // Specific logic for useAudioStore.ts to strip the massive amount of diagnostic crap
    if (filepath === 'src/store/useAudioStore.ts') {
        content = content.replace(/console\.log\(`\[DEBUG(.*?)`\);?\n?/g, '');
        content = content.replace(/console\.log\(`\[DIAG(.*?)`\);?\n?/g, '');
        content = content.replace(/console\.log\(`\[DIAG(.*?)\n?.*?\n?.*?\n?\);\n?/g, ''); // For multiline logs
        // remove all console.log with [DEBUG, [DIAG...
        const lines = content.split('\n');
        content = lines.filter(line => {
            if (line.includes('console.log(') && (line.includes('[DEBUG') || line.includes('[DIAG'))) return false;
            return true;
        }).join('\n');
    }

    // Now remove ALL console.log logs that print big objects with "RESUME_DEBUG", "REMOTE_SYNC", etc.
    content = content.replace(/console\.log\('REMOTE_SYNC_EVENT'[\s\S]*?\}\);/g, '');
    content = content.replace(/console\.log\('REMOTE_PROGRESS_SYNC'[\s\S]*?\}\);/g, '');
    content = content.replace(/console\.log\('RESUME_DEBUG'[\s\S]*?\}\);/g, '');
    content = content.replace(/console\.log\('RESUME_FINAL'[\s\S]*?\}\);/g, '');
    content = content.replace(/console\.log\('RESUME_FALLBACK_LOCAL_USED'[\s\S]*?\}\);/g, '');

    // Now replacing the general logs
    if (content.includes('console.log(') || content.includes('console.warn(') || content.includes('console.error(')) {
        content = content.replace(/console\.warn/g, 'logger.warn');
        content = content.replace(/console\.error/g, 'logger.error');
        
        // Convert any remaining useful console.log to logger.log, but mostly we want to strip component render logs
        content = content.replace(/console\.log/g, 'logger.log');

        needsLogger = true;
    }

    // Add import if needed
    if (needsLogger && !content.includes('import { logger }')) {
        // Calculate the nested path to logger
        const depth = filepath.split('/').length - 2;
        const relativePath = depth === 0 ? './lib/logger' : '../'.repeat(depth) + 'lib/logger';
        
        // Find last import
        const lines = content.split('\n');
        let lastImportIndex = -1;
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].startsWith('import ')) {
                lastImportIndex = i;
            }
        }
        
        if (lastImportIndex !== -1) {
            lines.splice(lastImportIndex + 1, 0, `import { logger } from '${relativePath}';`);
        } else {
            lines.unshift(`import { logger } from '${relativePath}';`);
        }
        content = lines.join('\n');
    }

    fs.writeFileSync(filepath, content, 'utf8');
});
