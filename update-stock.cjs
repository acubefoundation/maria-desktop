const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'pages', 'StockPage.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// Replace custom stock-page__header with mocca-header
content = content.replace(/<div className="stock-page__header">[\s\S]*?<div className="stock-page__title-group">/, '<div className="mocca-header">\n        <div className="mocca-title-group">');
content = content.replace(/<span className="stock-page__subtitle">LIVE SILO STATUS<\/span>/, '<span className="mocca-subtitle">WORKSPACE</span>');
content = content.replace(/<h1 className="stock-page__title">([\s\S]*?)<\/h1>/, '<h1 className="mocca-title">$1</h1>');
content = content.replace(/<\/div>\s*<\/div>\s*<div className="stock-controls">/, '</div>\n      </div>\n\n      <div className="stock-controls">');

// Update search to use mocca-toolbar and mocca-search
content = content.replace(/<div className="stock-controls">/, '<div className="mocca-toolbar" style={{flexDirection: "column", alignItems: "stretch"}}>');
content = content.replace(/<div className="stock-search">/, '<div className="mocca-search" style={{maxWidth: "100%"}}>');
content = content.replace(/className="stock-search__icon"/, 'className="mocca-search__icon"');
content = content.replace(/className="stock-search__input"/, 'className="mocca-search__input"');

fs.writeFileSync(filePath, content);
console.log("Updated StockPage.jsx");
