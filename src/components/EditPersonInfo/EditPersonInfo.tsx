import { shallowEqual, useDispatch, useSelector } from 'react-redux'
import styles from './EditPersonInfo.module.scss'
import { ReduxState } from '../../redux/store';
import { useContext, useEffect, useState } from 'react';
import { loadCurrentPersonInfo, updatePersonInfo } from '../../redux/reducers/PersonInfo';
import { SetPersonInfoRequest } from '../../api/models/PersonInfo/Requests/SetPersonInfoRequest';

export default function EditPersonInfo() {
    const dispatch = useDispatch();
    const { currentPersonInfo } = useSelector(({ persons }: ReduxState) => persons, shallowEqual)
    const { currentAccount } = useSelector(({ accounts }: ReduxState) => accounts, shallowEqual)
    const [lastName, setLastName] = useState(null);
    const [firstName, setfirstName] = useState(null);
    const [patronymic, setPatronymic] = useState(null);
    const [birthDate, setbirthDate] = useState(null);
    const [gender, setGender] = useState(null);

    useEffect(() =>{
        if (currentPersonInfo)
        {
            debugger;
            setLastName(currentPersonInfo.lastName);
            setfirstName(currentPersonInfo.firstName);
            setPatronymic(currentPersonInfo.patronymic);
            setbirthDate(currentPersonInfo.birthDate);
            setGender(currentPersonInfo.gender);
        }
    }, [currentPersonInfo])

    function saveChanges(){
        let request : SetPersonInfoRequest = {
            birthDate,
            gender,
            lastName,
            firstName,
            patronymic
        }
        dispatch(updatePersonInfo(currentAccount.id, request));
    }

    return (
        <div className={styles.main_wrapper}>
            <div className={styles.personal_data_wrapper}>
                <label htmlFor='lastName'>Фамилия:</label>
                <input id='lastName' value={lastName} onChange={e => setLastName(e.currentTarget.value)} ></input>

                <label htmlFor='firstName'>Имя:</label>
                <input id='firstName' value={firstName} onChange={e => setfirstName(e.currentTarget.value)}></input>

                <label htmlFor='patronymic'>Отчество:</label>
                <input id='patronymic' value={patronymic} onChange={e => setPatronymic(e.currentTarget.value)}></input>

                <label htmlFor='birthDate'>Дата рождения:</label>
                <input type='date' id='birthDate' value={birthDate} onChange={e => setbirthDate(e.currentTarget.value)}></input>

                <label htmlFor='newGender'>Пол:</label>
                <select id='newGender' value={gender} onChange={e => setGender(e.currentTarget.value !=='' ? e.currentTarget.value : null)}>
                    <option value={null}></option>
                    <option value="Male">Мужской</option>
                    <option value="Female">Женский</option>
                </select>
            </div>

            <div className={styles.buttons_wrapper}>
                <button onClick={() => saveChanges()}>save</button>
            </div>            
        </div>
    );
}