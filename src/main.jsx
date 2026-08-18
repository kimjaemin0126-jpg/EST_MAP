import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import ComparisonPage from './components/ComparisonPage'
import './styles/main.css'

const isComparisonPage = window.location.pathname.replace(/\/$/, '').endsWith('/comparison')
const RootComponent = isComparisonPage ? ComparisonPage : App

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RootComponent />
  </React.StrictMode>,
)
