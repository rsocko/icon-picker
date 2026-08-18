import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../../src/styles.css';
import './explorer.css';
import { ExplorerPage } from './ExplorerPage';

const root = document.getElementById('root');
if (!root) {
  throw new Error('Explorer root element was not found.');
}

createRoot(root).render(
  <StrictMode>
    <ExplorerPage />
  </StrictMode>,
);
