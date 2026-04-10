import { useDispatch } from 'react-redux';
import styles from './Header.module.scss'
import { signOut } from '../../../redux/reducers/AuthReducer';
import accIco from '../../../assets/images/account_ico.png';
import { useNavigate } from 'react-router-dom';
import { routes } from '../../../Routes';
import logo2 from '../../../assets/images/Logo2.png';
import { SetViewMode } from '../../../redux/reducers/SystemReducer';

export default function Header() {
    const dispatch = useDispatch();
    const navigate = useNavigate();

    function logout() {
        dispatch(signOut())
    }

    return (
        <div className={styles.header}>
            <img className={styles.account_ico} src={accIco} />
            <img className={styles.logo2} src={logo2} onClick={() => navigate(routes.main)} />
            {/* <img className={styles.logo} src={logo} /> */}

            {/* <ToggleSwitch></ToggleSwitch> */}
            <div className={styles.header_buttons}>
                <div>
                    <button onClick={() => dispatch(SetViewMode('map'))}>Карта</button>
                    <button onClick={() => dispatch(SetViewMode('list'))}>Список</button>
                </div>
                <div className={styles.divider}></div>
                <button onClick={logout}>SignOut</button>
            </div>
        </div>);
}