const fs = require('fs');
const path = require('path');
const glob = require('glob');

const srcDir = path.join(__dirname, 'src');
const files = glob.sync(srcDir + '/**/*.jsx');

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  // Replace weight="duotone" and weight="bold" and weight="fill" with weight="regular"
  // Unless it's CheckCircle or Drop which might make sense filled? Actually, rules say "Never Mix"
  // I will just replace all weights with regular except for specific active states.
  if (content.match(/weight="(duotone|bold|fill)"/g)) {
    // Only keep fill for CheckCircle or Coffee (logo)
    content = content.replace(/(<(?!CheckCircle|Coffee|Drop)[A-Z]\w*\b[^>]*)weight="(duotone|bold|fill)"/g, '$1weight="regular"');
    
    // Specifically for Sidebar, use regular by default, fill if isActive
    if (file.endsWith('Sidebar.jsx')) {
      content = content.replace(/weight="duotone"/g, 'weight={isActive ? "fill" : "regular"}');
    }
    
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(file, content);
    console.log(`Updated icons in ${path.basename(file)}`);
  }
});
