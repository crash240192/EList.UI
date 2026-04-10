import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import styles from './Sidebar.module.scss'
import { ReduxState } from '../../../redux/store';
import { useEffect } from 'react';
import { loadCurrentAccountData } from '../../../redux/reducers/AccountsReducer';
import { loadCurrentPersonInfo } from '../../../redux/reducers/PersonInfo';
import PersonInfoComponent from '../../Panels/PersonInfo/CurrentPersonInfoComponent';
import { NavLink } from 'react-router-dom';
import { routes } from '../../../Routes';
import IcoBtn from '../../Panels/IcoBtn/IcoBtn';
import { ReactComponent as followersIco } from '../../../assets/images/followers_ico.png';
//import LoadingButton from '@mui/lab/';
// import icobtn from '@mui/lab/LoadingButton'
import SaveIcon from '@mui/icons-material/People';

export default function Sidebar() {
    const dispatch = useDispatch();
    const { currentAccount } = useSelector(({ accounts }: ReduxState) => accounts, shallowEqual);
    const { currentPersonInfo } = useSelector(({ persons }: ReduxState) => persons, shallowEqual);

    useEffect(() => {
        if (!currentAccount)
            dispatch(loadCurrentAccountData())
    }, [currentAccount])

    useEffect(() => {
        if (!currentPersonInfo)
            dispatch(loadCurrentPersonInfo())
    }, [currentPersonInfo])

    return (
        <div className={styles.sidebar}>
            {/* <div className='personal-data-wrapper'>
                <PersonInfoComponent />
                {currentAccount != null ? <div>noPersonInfo</div> : <div></div>}                 
            </div> */}

            <div className={styles.sidebar_navigation}>
                <NavLink to={routes.subscriptions}>Подписки</NavLink>
                <NavLink to={routes.notifications}>Уведомления</NavLink>
                <NavLink to={routes.wallet}>Кошелёк</NavLink>
            </div>

            <div className={styles.sidebar_events}>
                мои актуальные ивенты
            </div>

            {/* <IcoBtn
            text=''
            ico={}
            >
                
            </IcoBtn> */}

        </div>
    );
}