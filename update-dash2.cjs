const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'pages', 'DashboardPage.jsx');
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(/<span className="dashboard__location-badge">.*?<\/span>/, '');
content = content.replace(/<p className="dashboard__subtitle">[\s\S]*?<\/p>/, '');

fs.writeFileSync(filePath, content);
console.log("Updated DashboardPage.jsx");
