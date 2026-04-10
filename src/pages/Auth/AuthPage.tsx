import { shallowEqual, useDispatch, useSelector } from "react-redux";
import { useEffect, useState } from "react";
import { authorize } from "../../redux/reducers/AuthReducer";
import styles from './AuthPage.module.scss'
import { useNavigate } from "react-router-dom";
import { routes } from "../../Routes";
import { ReduxState } from "../../redux/store";

export default function AuthPage() {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const [login, setLogin] = useState('');
    const [password, setPassword] = useState('')
    const { activationRequired, token } = useSelector(({auth}: ReduxState) => auth, shallowEqual);
    
    useEffect(() => {
        if (token)
            {
                let act = activationRequired === true;
                if (activationRequired === true)
                    navigate(routes.activation)
                else
                    navigate(routes.main);
            }
    },[token, activationRequired])


    function signIn() {
        dispatch(authorize(login, password));
    }

    return (
        <div className={styles.auth_wrapper}>
            Auth
            <div className={styles.auth_data_input_wrapper}>
                <label htmlFor="login">Логин:</label>
                <input id="login" type="text" value={login} onChange={e => setLogin(e.currentTarget.value)} />
                <label htmlFor="password">Пароль:</label>
                <input id="password" type="password" value={password} onChange={e => setPassword(e.currentTarget.value)} required />
            </div>

            <div className={styles.buttons_wrapper}>
                <button onClick={signIn}>Login</button>
                <button onClick={() => navigate(routes.registration)}>Register</button>
            </div>

            <div className={styles.change_pass_wrapper}>
                <a onClick={() => navigate("/changePassword")}>Забыл пароль?</a>
            </div>
        </div>
    );
}