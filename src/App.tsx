//import logo from './logo.svg';
import './App.css';
import { Provider as ReduxProvider } from "react-redux";
import { BrowserRouter } from "react-router-dom";
import { store } from './redux/store';
import { Main } from './Main';

function App() {
  return (
    <ReduxProvider store={store}>
        <BrowserRouter>
            {/* <ToastContainer />
            <UiModals /> */}
            <Main />
        </BrowserRouter>
    </ReduxProvider>
);
}

export default App;
