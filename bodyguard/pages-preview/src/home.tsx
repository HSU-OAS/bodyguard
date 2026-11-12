// FR-S-06/FR-V-03: approved Figma shell for the isolated inspection; no auth/API bypass.
import { createRoot } from 'react-dom/client'
import { createElement } from 'react'
import { BrowserRouter } from 'react-router'
import { FigmaHomePage } from '../../frontend/src/pages/FigmaHomePage'
import './home.css'

const container = document.querySelector('#root')
if (!container) throw new Error('Preview root unavailable')
createRoot(container).render(
  createElement(BrowserRouter, { basename: '/bodyguard' },
    createElement(FigmaHomePage, { inspectionHref: '/bodyguard/inspection.html' })),
)
