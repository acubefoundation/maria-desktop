const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'components', 'layout', 'TopBar.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// Add useNavigate import
if (!content.includes('useNavigate')) {
  content = content.replace(/import React from 'react';/, "import React, { useState } from 'react';\nimport { useNavigate } from 'react-router-dom';");
}

// Add state and handleKeyDown
content = content.replace(/export function TopBar\(\{\s*onMenuToggle\s*\}\) \{/, `export function TopBar({ onMenuToggle }) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      navigate('/entries?search=' + encodeURIComponent(searchQuery.trim()));
      setSearchQuery('');
    }
  };
`);

// Update input
content = content.replace(/<input type="text" placeholder="Search batches, companies..." className="topbar__search-input" \/>/, `<input 
            type="text" 
            placeholder="Search batches, companies..." 
            className="topbar__search-input" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />`);

fs.writeFileSync(filePath, content);
console.log("Updated TopBar.jsx");
