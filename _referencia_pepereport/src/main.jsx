import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { Provider } from 'react-redux'
import almacen from './Redux/almacen.js'

createRoot(document.getElementById('root')).render(



  <Provider store={almacen}>
    <App />
  </Provider>,



  // <StrictMode>
  // <App />
  //</StrictMode>,
)
