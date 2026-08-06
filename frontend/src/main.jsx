import React from 'react'
import ReactDOM from 'react-dom/client'
import { Amplify } from 'aws-amplify';
import '@aws-amplify/ui-react/styles.css';
import App from './App.jsx'
import './index.css'

Amplify.configure({
  Auth: {
    Cognito: {
      identityPoolId: 'ap-southeast-1:16d2361e-bff6-40a3-85af-7ebc324a39a6',
      allowGuestAccess: true,
    }
  }
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
