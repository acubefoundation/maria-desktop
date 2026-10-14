const fs = require('fs');
const path = require('path');

const globalCssPath = path.join(__dirname, 'src', 'styles', 'global.css');
let content = fs.readFileSync(globalCssPath, 'utf8');

// Replace the mocca CSS with updated styles based on Robi's practices
const moccaRegex = /\/\* MoccaTrace Global Page Layouts \*\/[\s\S]*$/;

const newMoccaCss = `/* MoccaTrace Global Page Layouts */
.mocca-page {
  padding-bottom: var(--space-12);
}
.mocca-header {
  background: hsl(225, 15%, 15%); /* Slightly tinted, low sat dark */
  padding: var(--space-8);
  border-radius: var(--radius-xl);
  margin-bottom: var(--space-6);
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #fafafa; /* Off-white */
  box-shadow: var(--shadow-sm);
  position: relative;
  overflow: hidden;
  transition: all var(--transition-normal);
}
.mocca-header::before {
  content: "";
  position: absolute;
  top: 0; right: 0; bottom: 0; left: 0;
  background: linear-gradient(135deg, rgba(255,255,255,0.03) 0%, transparent 100%);
  pointer-events: none;
}
.mocca-title-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  position: relative;
  z-index: 1;
}
.mocca-subtitle {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 1px;
  color: var(--color-accent);
  text-transform: uppercase;
}
.mocca-title {
  font-family: var(--font-display);
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.5px;
  margin: 0;
  display: flex;
  align-items: center;
  gap: var(--space-3);
}
.mocca-header-btn {
  background: var(--color-accent);
  color: #ffffff;
  border: none;
  padding: var(--space-3) var(--space-6);
  border-radius: var(--radius-full);
  font-weight: 600;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  cursor: pointer;
  transition: transform var(--transition-fast), background var(--transition-fast), box-shadow var(--transition-fast);
  position: relative;
  z-index: 1;
  box-shadow: 0 4px 12px hsla(28, 75%, 45%, 0.2);
}
.mocca-header-btn:hover {
  transform: translateY(-2px) scale(1.02);
  background: hsl(28, 75%, 40%);
  box-shadow: 0 6px 16px hsla(28, 75%, 45%, 0.3);
}
.mocca-header-btn:active {
  transform: translateY(0) scale(0.98);
}
.mocca-toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  margin-bottom: var(--space-6);
  background: var(--color-surface);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-neutral);
  box-shadow: var(--shadow-sm);
}
.mocca-search {
  position: relative;
  flex: 1;
  max-width: 400px;
}
.mocca-search__icon {
  position: absolute;
  left: var(--space-3);
  top: 50%;
  transform: translateY(-50%);
  color: var(--color-tertiary);
}
.mocca-search__input {
  width: 100%;
  height: 44px;
  padding: 0 var(--space-4) 0 42px;
  border: 1px solid var(--color-neutral);
  border-radius: var(--radius-full);
  font-size: 14px;
  background: hsl(210, 20%, 98%);
  transition: all var(--transition-fast);
}
.mocca-search__input:focus {
  outline: none;
  border-color: var(--color-accent);
  background: var(--color-surface);
  box-shadow: 0 0 0 3px hsla(28, 75%, 45%, 0.1);
}
.mocca-table-wrap {
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-neutral);
  overflow: hidden;
  box-shadow: var(--shadow-sm);
}
`;

if (moccaRegex.test(content)) {
  content = content.replace(moccaRegex, newMoccaCss);
  fs.writeFileSync(globalCssPath, content);
  console.log("Updated global.css");
} else {
  console.log("Could not find mocca block in global.css");
}
