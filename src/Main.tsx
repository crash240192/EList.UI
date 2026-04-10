import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { routes } from "./Routes";
import AuthPage from "./pages/Auth/AuthPage";
import RegistrationPage from "./pages/Register/RegistrationPage";
import { shallowEqual, useDispatch, useSelector } from "react-redux";
import { ReduxState } from "./redux/store";
import { useEffect } from "react";
import { loadContactTypes } from "./redux/reducers/ContactsReducer";
import ActivationPage from "./pages/ActivationPage/ActivationPage";
import Sidebar from "./components/Main/Sidebar/Sidebar";
import Header from "./components/Main/Header/Header";
import ContentWrapper from "./components/Main/ContentWrapper/ContentWrapper";
import './App.css'
import SearchList from "./pages/SearchList/SearchList";
import Subscriptions from "./pages/Subscriptions/Subscriptions";
import Wallet from "./pages/Wallet/Wallet";
import Notifications from "./pages/Notifications/Notifications";

// import { shallowEqual, useDispatch, useSelector } from "react-redux";

// import { LoginPage } from "./pages/LoginPage/LoginPage";
// import { ReduxState } from "./redux/store";
// import { routes } from "./Routes";
// import { getPages, setLoading } from "./redux/actions/Page";
// import { ConfirmEmailPage } from "./pages/ConfirmEmailPage/ConfirmEmailPage";
// import { ResetPasswordPage } from "./pages/ResetPasswordPage/ResetPasswordPage";
// import { Error } from "./pages/Error/Error";
// import { Pages } from "./pages/Pages";
// import { SigninEsia } from "./pages/SigninEsia/SigninEsia";
// import { VCSPage } from "./pages/VCSPage/VCSPage";

export function Main() {
    const dispatch = useDispatch();
    const { token } = useSelector(({ auth }: ReduxState) => auth);
    const { activationRequired } = useSelector(({ auth }: ReduxState) => auth, shallowEqual);
    const { contactTypes } = useSelector(({ contacts }: ReduxState) => contacts, shallowEqual);
    
    const navigate = useNavigate();
    
    // const {sessionId} = useSelector(
    //     ({auth}: ReduxState) => auth,
    //     shallowEqual
    // );
    // const {pages} = useSelector(
    //     ({page}: ReduxState) => page,
    //     shallowEqual
    // );

    // useEffect(() => {
    //     if (sessionId === null) {
    //         dispatch(setLoading(false));
    //     }
    //     if (sessionId && pages.length === 0) {
    //         dispatch(getPages(sessionId));
    //     }
    // }, [sessionId]);

    //return(<Redirect isAllowed = {token !== null} />);

    // if (token === null)
    // return <AuthPage/>;
    useEffect(() => {
        {
            if (!contactTypes)
                dispatch(loadContactTypes());
        }
    }, [contactTypes]);

    useEffect(() => {
        {
            if (!token)
                navigate(routes.auth)
            else 
            {
                if (activationRequired === true)
                    navigate(routes.activation)
                else
                navigate(routes.main)
            }
        }
    }, [token, activationRequired]);


    if (!token || activationRequired == true)
        return (
            <Routes>
                <Route
                    path={routes.auth}
                    element={<AuthPage />}
                />
                <Route
                    path={routes.registration}
                    element={<RegistrationPage />}
                />
                <Route
                    path={routes.activation}
                    element={<ActivationPage />}
                />
            </Routes>
        )
    else
        return (<div className="main">
            <Header />
            <Sidebar />
            <div className="content-wrapper">
                <Routes>
                    <Route
                        path={routes.main} 
                        element = {<ContentWrapper /> }
                    />
                    <Route
                        path={routes.subscriptions}
                        element={<Subscriptions />}
                    />
                    <Route
                        path={routes.notifications}
                        element={<Notifications />}
                    />
                    <Route
                        path={routes.wallet}
                        element={<Wallet />}
                    />
                </Routes>
            </div>
        </div>);
}