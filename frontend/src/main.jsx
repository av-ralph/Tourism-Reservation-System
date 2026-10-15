import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import './Readability.css'
import './Interface.css'
import './MinimalTheme.css'
import './Responsive.css'
import './ButtonTheme.css'
import './CollegeBanner.css'
import './DesignPolish.css'
import './DeviceLayouts.css'
import './StudentMenu.css'
import './ApprovalFlow.css'
import './StaffHeader.css'
import './StaffExperience.css'
import './LogoBranding.css'
import './ModalExperience.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
