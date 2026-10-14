const fs = require('fs');
const path = require('path');
const glob = require('glob');

const componentsDir = path.join(__dirname, 'src', 'components');
const cssFiles = glob.sync(componentsDir + '/**/*.css');

cssFiles.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  // Replace hardcoded #fff with var(--color-surface)
  if (content.match(/background:\s*#fff(?:fff)?;/ig)) {
    content = content.replace(/background:\s*#fff(?:fff)?;/ig, 'background: var(--color-surface);');
    changed = true;
  }
  if (content.match(/color:\s*#fff(?:fff)?;/ig)) {
    content = content.replace(/color:\s*#fff(?:fff)?;/ig, 'color: var(--color-surface);');
    changed = true;
  }
  
  // Replace spacing with space vars
  const spacingReplacements = [
    { regex: /padding:\s*16px/g, replace: 'padding: var(--space-4)' },
    { regex: /padding:\s*24px/g, replace: 'padding: var(--space-6)' },
    { regex: /gap:\s*8px/g, replace: 'gap: var(--space-2)' },
    { regex: /gap:\s*12px/g, replace: 'gap: var(--space-3)' },
    { regex: /gap:\s*16px/g, replace: 'gap: var(--space-4)' },
    { regex: /gap:\s*24px/g, replace: 'gap: var(--space-6)' },
    { regex: /margin-bottom:\s*16px/g, replace: 'margin-bottom: var(--space-4)' },
    { regex: /margin-bottom:\s*24px/g, replace: 'margin-bottom: var(--space-6)' },
    { regex: /margin-top:\s*16px/g, replace: 'margin-top: var(--space-4)' },
  ];

  spacingReplacements.forEach(({regex, replace}) => {
    if (content.match(regex)) {
      content = content.replace(regex, replace);
      changed = true;
    }
  });

  // Smooth transitions
  if (content.match(/ease-in-out/g) || content.match(/ease/g) || content.match(/linear/g)) {
    content = content.replace(/transition:\s*(.*?)\s+ease-in-out/g, 'transition: $1 var(--transition-normal)');
    content = content.replace(/transition:\s*all\s+(?:0\.2s|200ms)\s+ease/g, 'transition: all var(--transition-fast)');
    changed = true;
  }

  // Micro-interactions for buttons
  if (path.basename(file) === 'Button.css') {
    if (!content.includes('transform: translateY')) {
      content = content.replace(/(\.btn:hover\s*{[\s\S]*?)}/g, '$1\n  transform: translateY(-1px) scale(1.02);\n}');
      content += '\n.btn:active {\n  transform: translateY(1px) scale(0.98);\n}\n';
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(file, content);
    console.log(`Updated ${path.basename(file)}`);
  }
});
