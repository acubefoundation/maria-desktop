const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'pages', 'DashboardPage.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// Remove Bay 01 location badge
content = content.replace(/<span className="dashboard__location-badge">Bay 01\s*?\s*Addis Hub<\/span>/, '');

// Remove DRY MILL ACTIVE TELEMETRY
content = content.replace(/<p className="dashboard__subtitle">[\s\S]*?<span[^>]*>-?<\/span>\s*DRY MILL ACTIVE TELEMETRY[\s\S]*?<\/p>/, '');

fs.writeFileSync(filePath, content);
console.log("Updated DashboardPage.jsx");
