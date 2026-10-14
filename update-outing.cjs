const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'pages', 'NewOutingPage.jsx');
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(/<button type="button" className="btn-print">[\s\S]*?<\/button>/, '');

fs.writeFileSync(filePath, content);
console.log("Updated NewOutingPage.jsx");
