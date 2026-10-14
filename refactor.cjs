const fs = require('fs');
const path = require('path');

const pagesDir = path.join(__dirname, 'src', 'pages');

const filesToRefactor = [
  'AuditLogPage.jsx',
  'CoffeeEntriesPage.jsx',
  'CompaniesPage.jsx',
  'DriversPage.jsx',
  'OutingsPage.jsx',
  'ReportsPage.jsx',
  'SettingsPage.jsx',
  'UsersPage.jsx'
];

filesToRefactor.forEach(filename => {
  const filePath = path.join(pagesDir, filename);
  if (!fs.existsSync(filePath)) return;
  
  let content = fs.readFileSync(filePath, 'utf8');

  // Replace page-container
  content = content.replace(/className="page-container"/g, 'className="mocca-page"');
  
  // Replace page-header
  content = content.replace(/className="page-header"/g, 'className="mocca-header"');

  // Replace page-title and add subtitle
  content = content.replace(/<h1 className="page-title">([^<]+)<\/h1>/g, '<div className="mocca-title-group"><span className="mocca-subtitle">WORKSPACE</span><h1 className="mocca-title">$1</h1></div>');

  // Replace Add buttons in headers
  content = content.replace(/<Button variant="primary" onClick=\{([^}]+)\}>\s*<Plus[^>]*>\s*([^<]+)\s*<\/Button>/g, 
    '<button className="mocca-header-btn" onClick={$1}><Plus size={18} weight="bold" /> $2</button>');

  // Some buttons might be Links
  content = content.replace(/<Button variant="primary" as=\{Link\} to="([^"]+)">\s*<Plus[^>]*>\s*([^<]+)\s*<\/Button>/g, 
    '<Link to="$1" className="mocca-header-btn" style={{textDecoration:"none"}}><Plus size={18} weight="bold" /> $2</Link>');

  // Toolbar
  content = content.replace(/className="toolbar"/g, 'className="mocca-toolbar"');
  content = content.replace(/className="toolbar__search"/g, 'className="mocca-search"');
  content = content.replace(/className="toolbar__icon"/g, 'className="mocca-search__icon"');
  content = content.replace(/className="toolbar__input"/g, 'className="mocca-search__input"');
  
  // Table Container
  content = content.replace(/className="table-container"/g, 'className="mocca-table-wrap"');

  fs.writeFileSync(filePath, content);
  console.log(`Refactored ${filename}`);
});
