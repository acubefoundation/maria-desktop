import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/global.css';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

/*
 * Drop the index.html boot screen once React has actually painted. createRoot
 * commits asynchronously, so removing it synchronously would blank the page
 * for a frame; two frames of delay guarantees the app is on screen first.
 */
requestAnimationFrame(() =>
  requestAnimationFrame(() => {
    document.getElementById('boot-splash')?.remove();
  }),
);
