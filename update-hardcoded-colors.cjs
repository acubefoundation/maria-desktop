const fs = require('fs');
const path = require('path');
const glob = require('glob');

const srcDir = path.join(__dirname, 'src');
const files = glob.sync(srcDir + '/**/*.{css,jsx}');

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  // Replace hardcoded navy #1a1a2e
  if (content.match(/#1a1a2e/ig)) {
    content = content.replace(/#1a1a2e/ig, 'hsl(225, 15%, 15%)');
    changed = true;
  }
  
  // Replace hardcoded orange #e67e22
  if (content.match(/#e67e22/ig)) {
    content = content.replace(/#e67e22/ig, 'var(--color-accent)');
    changed = true;
  }

  // Replace hardcoded black #000 or #000000 with var(--color-text)
  if (content.match(/#000(000)?\b/ig)) {
    content = content.replace(/#000(000)?\b/ig, 'var(--color-text)');
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(file, content);
    console.log(`Updated colors in ${path.basename(file)}`);
  }
});
