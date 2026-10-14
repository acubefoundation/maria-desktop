const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'pages', 'StockPage.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// Replace inline colors with CSS variables
content = content.replace(/background:\s*'#dbeafe'/g, "background: 'var(--color-unprocessed)'");
content = content.replace(/background:\s*'#f59e0b'/g, "background: 'var(--color-in-cleaning)'");
content = content.replace(/background:\s*'#10b981'/g, "background: 'var(--color-clean)'");
content = content.replace(/color:\s*'#10b981'/g, "color: 'var(--color-clean)'");
content = content.replace(/background:\s*'#ef4444'/g, "background: 'var(--color-reject)'");
content = content.replace(/color:\s*'#ef4444'/g, "color: 'var(--color-reject)'");
content = content.replace(/background:\s*'#92400e'/g, "background: 'var(--color-waste)'");
content = content.replace(/color:\s*'#92400e'/g, "color: 'var(--color-waste)'");
content = content.replace(/background:\s*'#bfdbfe'/g, "background: 'var(--color-unprocessed)'"); // for the dot

fs.writeFileSync(filePath, content);
console.log("Updated StockPage.jsx inline colors");
