const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'pages', 'CoffeeEntriesPage.jsx');
let content = fs.readFileSync(filePath, 'utf8');

if (!content.includes('useEffect(() => { setSearch(searchParams.get(')) {
  content = content.replace(/const \[search, setSearch\] = useState\(searchParams\.get\('search'\) \|\| ''\);/, `const [search, setSearch] = useState(searchParams.get('search') || '');
  
  useEffect(() => {
    const urlSearch = searchParams.get('search');
    if (urlSearch !== null && urlSearch !== search) {
      setSearch(urlSearch);
    }
  }, [searchParams]);`);
}

fs.writeFileSync(filePath, content);
console.log("Updated CoffeeEntriesPage.jsx with useEffect");
