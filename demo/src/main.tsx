import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../../src/styles.css';
import './demo.css';
import { Demo } from './Demo';

const root = document.getElementById('root');
if (!root) {
  throw new Error('Demo root element was not found.');
}

createRoot(root).render(
  <StrictMode>
    <Demo />
  </StrictMode>,
);
