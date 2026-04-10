import { useEffect, useState } from 'react';
import './ActivationPage.css';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import { ReduxState } from '../../redux/store';
import { useNavigate } from 'react-router-dom';
import { routes } from '../../Routes';
import { activate, signOut } from '../../redux/reducers/AuthReducer';

export default function ActivationPage(){
    const dispatch = useDispatch();
    const [code, setCode] = useState('');
    const {activationRequired} = useSelector(({auth}: ReduxState) => auth, shallowEqual)
    const navigate = useNavigate();

    useEffect(() =>{
        if (!activationRequired)
            navigate(routes.main);
    },[activationRequired])

    function sendActivationCode(){
        dispatch(activate(code))
    }

    function logout(){
        dispatch(signOut())
    }

    return(
    <div className="activation-wrapper">
        <div className='activation-code-wrapper'>
            Код активации: 
            <input className='input' onChange={e => setCode(e.currentTarget.value)}/>
        </div>
        <div className='activation-button-wrapper'>
            <button className='button' onClick={sendActivationCode}>Активировать</button>
            <button className='button' onClick={logout}>Выйти</button>
        </div>
    </div>);
}