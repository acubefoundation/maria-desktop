const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'pages', 'CoffeeEntriesPage.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// Add useSearchParams if needed
if (!content.includes('useSearchParams')) {
  content = content.replace(/import \{ Link, useNavigate \} from 'react-router-dom';/, "import { Link, useNavigate, useSearchParams } from 'react-router-dom';");
}

// Add useSearchParams hook
if (!content.includes('const [searchParams] = useSearchParams();')) {
  content = content.replace(/const navigate = useNavigate\(\);/, "const navigate = useNavigate();\n  const [searchParams] = useSearchParams();");
}

// Read search param for initial state
content = content.replace(/const \[search, setSearch\] = useState\(''\);/, "const [search, setSearch] = useState(searchParams.get('search') || '');");

fs.writeFileSync(filePath, content);
console.log("Updated CoffeeEntriesPage.jsx");
